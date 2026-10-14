'use client';

// Design Lab canvas stage. Each layer, live material and inactive artboard is
// a memoized component with narrow props, so a commit re-renders only the
// layers whose data, selection or playback state changed. Editor actions come
// from the host as stable handlers.
import { memo, useCallback, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';

import {
  CanvasTextLayerContent,
  shaderBlendStyle,
  ShaderMaskedMediaContent,
  StickerFinishOverlay,
  applyImageCropPreviewStyles,
  type RenderLiveMaterial,
} from '@/components/DesignLabCanvasContent';
import CanvasRenderBoundary from '@/components/CanvasRenderBoundary';
import { DesignLabImageEffectNotice, type DesignLabImageEffectStatusStore } from '@/components/DesignLabEffectPicker';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import ImageCropEditorOverlay from '@/components/ImageCropEditorOverlay';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import RestoredLiveMaterialCanvas from '@/components/RestoredLiveMaterialCanvas';
import ShaderFrameImage from '@/components/ShaderFrameImage';
import ShaderSkeleton from '@/components/ShaderSkeleton';
import { Move } from '@/components/ui/SolidIcons';
import { contextMenuPositionFromEvent, type StudioContextMenuPosition } from '@/components/ui/StudioContextMenu';
import { STUDIO_ARTBOARD_PRESETS, type StudioArtboardDimensions } from '@/lib/artboardSizes';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { normalizeCanvasLayerTransform, type CanvasLayerBounds, type CanvasLayerTransform, type CanvasSnapTargets } from '@/lib/canvasInteraction';
import {
  DEFAULT_LAYER_TRANSFORM,
  isAssetLayerId,
  isEffectLayerId,
  isLogoLayerId,
  isShaderLayerId,
  isTextLayerId,
  layerGeometry,
  resolvedTextTransform,
  type AssetLayerId,
  type CanvasLayerId,
  type CompositionAsset,
  type CompositionEffectLayer,
  type CompositionLayerId,
  type CompositionLogoLayer,
  type CompositionShaderLayer,
  type CompositionTextLayer,
  type ContentLayerId,
  type DesignArtboard,
  type ShaderApplication,
  type ShaderLayerId,
  type TextLayerId,
} from '@/lib/designLabModel';
import { resolveDesignLabFontSizeCqw } from '@/lib/designLabTypography';
import { designSurfaceSize } from '@/lib/designWorkspace';
import { resolveMotionFrame } from '@/lib/canvasExport';
import { effectFrameMatches } from '@/lib/effectFrameDocument';
import { normalizeImageCropSettings, type ImageCropSettings } from '@/lib/imagePlacement';
import type { TextSelectionRange, TextStyleRun } from '@/lib/richText';
import { shaderFrameMatches } from '@/lib/captureShaderFrames';
import { clampShaderZoom } from '@/lib/shaderZoom';

export const DESIGN_LAB_PREVIEW_MAX_PIXEL_COUNT = 120_000;
// Captures lift the device-ratio cap; the export pixel count then sets the canvas size.
export const DESIGN_LAB_CAPTURE_SUPERSAMPLE = 8;
export const DESIGN_LAB_PREVIEW_FRAME_RATE = 60;

/** Playback and capture state shared by every live shader on the active surface. */
export type DesignLabLiveMaterialState = {
  active: boolean;
  captureTimeMs: number | null;
  defaultLoopDurationMs: number;
  exportPixelCount: number;
  /** Per Effect layer: whether its image effect renders, so the stage can say when it cannot. */
  imageEffectStatusStore: DesignLabImageEffectStatusStore;
  livePreviewPixelBudget: number;
  livePreviewRuntimeReady: boolean;
  onRestoreReady: (instanceKey: string, revision: number) => void;
  paused: boolean;
  previewCaptureTimeMs: number;
  sequenceCapture: { application: ShaderApplication; layerId: ShaderLayerId } | null;
  sequencePreviewing: boolean;
  shaderTimelineRestore: { pendingKeys: readonly string[]; revision: number; timeMs: number };
  shaderTimelineRestoring: boolean;
};

export type DesignLabStageActions = {
  deselectCanvasLayers: () => void;
  finishLayerMove: (layerId: CanvasLayerId, point: { x: number; y: number }) => void;
  formatSelectedTextShortcut: (layerId: TextLayerId, format: 'bold' | 'italic' | 'underline') => void;
  openCanvasSelectionMenu: (layerId: CanvasLayerId, event: ReactMouseEvent<HTMLDivElement>) => void;
  previewAssetCrop: (layerId: AssetLayerId, imageCrop: ImageCropSettings) => void;
  registerEffectCanvas: (layerId: `effect-${string}`, canvas: HTMLCanvasElement | null) => void;
  rememberTextSelection: (layerId: TextLayerId, range: TextSelectionRange) => void;
  rotateCanvasLayer: (layerId: CanvasLayerId, rotation: number) => void;
  selectCanvasAssembly: (layerId: CanvasLayerId, additive?: boolean) => void;
  setImageCropEditing: (layerId: AssetLayerId, editing: boolean) => void;
  undoRedo: (redo: boolean) => void;
  updateAssetCrop: (layerId: AssetLayerId, imageCrop: ImageCropSettings) => void;
  updateCanvasLayerTransform: (layerId: CanvasLayerId, transform: CanvasLayerTransform) => void;
  updateTextLayer: (layerId: TextLayerId, update: { runs?: TextStyleRun[]; value: string }) => void;
};

export const DesignLabLiveMaterial = memo(function DesignLabLiveMaterial({
  application,
  instanceKey,
  state,
}: {
  application: ShaderApplication;
  instanceKey: string;
  state: DesignLabLiveMaterialState;
}) {
  const {
    active,
    captureTimeMs,
    livePreviewRuntimeReady,
    paused,
    previewCaptureTimeMs,
    sequenceCapture,
    sequencePreviewing,
    shaderTimelineRestore,
    shaderTimelineRestoring,
  } = state;
  const controlledTimeMs = captureTimeMs ?? (paused ? previewCaptureTimeMs : null);
  const renderedApplication = sequenceCapture && instanceKey === `canvas-${sequenceCapture.layerId}`
    ? sequenceCapture.application
    : application;
  const frozenSnapshot = paused && !sequencePreviewing && captureTimeMs === null && shaderFrameMatches(renderedApplication.frameSnapshot, renderedApplication)
    ? renderedApplication.frameSnapshot : undefined;
  const liveCanvas = !livePreviewRuntimeReady && captureTimeMs === null ? <ShaderSkeleton /> : (
    <RestoredLiveMaterialCanvas
      activeWhileMounted
      captureTimeMs={controlledTimeMs}
      className='absolute inset-0 size-full'
      enabled={active}
      frameRate={DESIGN_LAB_PREVIEW_FRAME_RATE}
      frameState={renderedApplication.frameState}
      key={instanceKey}
      loopDurationMs={renderedApplication.frameState?.loopDurationMs ?? state.defaultLoopDurationMs}
      materialId={renderedApplication.materialId}
      maxPixelCount={captureTimeMs === null
        ? state.livePreviewPixelBudget
        : Math.max(DESIGN_LAB_PREVIEW_MAX_PIXEL_COUNT, state.exportPixelCount)}
      patternScale={clampShaderZoom(renderedApplication.shaderSize)}
      paused={!active || paused || controlledTimeMs !== null}
      previewChannel={instanceKey}
      previewGroup='design-lab'
      renderScale={captureTimeMs === null ? 1 : DESIGN_LAB_CAPTURE_SUPERSAMPLE}
      restoreTimeMs={shaderTimelineRestore.pendingKeys.includes(instanceKey)
        ? paused ? previewCaptureTimeMs : shaderTimelineRestore.timeMs : undefined}
      holdRestoredPlayback={shaderTimelineRestoring}
      onRestoreReady={() => state.onRestoreReady(instanceKey, shaderTimelineRestore.revision)}
      settings={renderedApplication.settings}
    />
  );
  return <ShaderFrameImage key={`${instanceKey}:restore-${shaderTimelineRestore.revision}`} className='absolute inset-0 size-full' previewChannel={instanceKey} snapshot={frozenSnapshot}>{liveCanvas}</ShaderFrameImage>;
});

function useLiveMaterialRenderer(state: DesignLabLiveMaterialState): RenderLiveMaterial {
  return useCallback((application: ShaderApplication, instanceKey: string) => (
    <DesignLabLiveMaterial application={application} instanceKey={instanceKey} state={state} />
  ), [state]);
}

type StageLayer = CompositionAsset | CompositionEffectLayer | CompositionLogoLayer | CompositionShaderLayer | CompositionTextLayer;

type DesignLabStageLayerProps = {
  actions: DesignLabStageActions;
  application?: ShaderApplication;
  canvasDimensions: StudioArtboardDimensions;
  cropEditing: boolean;
  identity: BrandIdentity;
  index: number;
  layer: StageLayer;
  liveState: DesignLabLiveMaterialState;
  movementBounds: CanvasLayerBounds | null;
  selected: boolean;
  showSelectionControls: boolean;
  /** Extra snap lines, such as the artboard's thirds. */
  snapTargets?: CanvasSnapTargets;
};

function sameBounds(first: CanvasLayerBounds | null, second: CanvasLayerBounds | null): boolean {
  if (first === second) return true;
  if (!first || !second) return false;
  return first.left === second.left && first.top === second.top
    && first.width === second.width && first.height === second.height;
}

function stageLayerPropsEqual(previous: DesignLabStageLayerProps, next: DesignLabStageLayerProps): boolean {
  return previous.actions === next.actions
    && previous.application === next.application
    && previous.canvasDimensions === next.canvasDimensions
    && previous.cropEditing === next.cropEditing
    && previous.identity === next.identity
    && previous.index === next.index
    && previous.layer === next.layer
    && previous.liveState === next.liveState
    && sameBounds(previous.movementBounds, next.movementBounds)
    && previous.selected === next.selected
    && previous.showSelectionControls === next.showSelectionControls
    && previous.snapTargets === next.snapTargets;
}

/** One editable layer on the active surface. */
export const DesignLabStageLayer = memo(function DesignLabStageLayer({
  actions,
  application,
  canvasDimensions,
  cropEditing,
  identity,
  index,
  layer,
  liveState,
  movementBounds,
  selected,
  showSelectionControls,
  snapTargets,
}: DesignLabStageLayerProps) {
  const renderLiveMaterial = useLiveMaterialRenderer(liveState);
  const layerId = layer.id as CompositionLayerId;
  const zIndex = 4 + index;
  const registerEffectCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (isEffectLayerId(layerId)) actions.registerEffectCanvas(layerId, canvas);
  }, [actions, layerId]);
  if (isEffectLayerId(layerId)) {
    const effectLayer = layer as CompositionEffectLayer;
    return (
      <>
        <canvas
          aria-hidden='true'
          className='shader-lab-v2-composition-effect'
          data-effect-kind={effectLayer.settings.kind}
          data-image-effect={effectLayer.settings.effectId}
          ref={registerEffectCanvas}
          style={{ zIndex }}
        />
        {effectLayer.settings.effectId
          ? <DesignLabImageEffectNotice layerId={effectLayer.id} store={liveState.imageEffectStatusStore} variant='stage' />
          : null}
      </>
    );
  }
  const canvasLayerId = layerId as CanvasLayerId;
  const canvasLayer = layer as Exclude<StageLayer, CompositionEffectLayer>;
  const geometry = layerGeometry(canvasLayerId, canvasDimensions);
  const shared = {
    ...geometry,
    canvasHeight: canvasDimensions.height,
    canvasWidth: canvasDimensions.width,
    // Locked layers stay visible but ignore canvas pointer and keyboard edits.
    interactive: !canvasLayer.locked,
    label: layer.name,
    layerId,
    movementBounds,
    onChange: (transform: CanvasLayerTransform) => actions.updateCanvasLayerTransform(canvasLayerId, transform),
    onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => actions.openCanvasSelectionMenu(canvasLayerId, event),
    onDeselect: actions.deselectCanvasLayers,
    onMoveComplete: (point: { x: number; y: number }) => actions.finishLayerMove(canvasLayerId, point),
    onRotate: (rotation: number) => actions.rotateCanvasLayer(canvasLayerId, rotation),
    onSelect: (additive?: boolean) => actions.selectCanvasAssembly(canvasLayerId, additive),
    rotation: canvasLayer.transform.rotation ?? 0,
    selected,
    selectionMember: selected,
    showSelectionControls,
    snapTargets,
    zIndex,
  };
  if (isShaderLayerId(layerId)) {
    const shaderLayer = layer as CompositionShaderLayer;
    const transform = normalizeCanvasLayerTransform(shaderLayer.transform, DEFAULT_LAYER_TRANSFORM);
    return (
      <EditableCanvasLayer
        {...shared}
        className='shader-lab-v2-composition-layer shader-lab-v2-composition-shader'
        resizeMode='box'
        transform={transform}
      >
        <div
          className='shader-lab-v2-canvas-material'
          data-shader-instance={`canvas-${layerId}`}
          key='content'
          style={{
            mixBlendMode: shaderBlendStyle(shaderLayer.blendMode),
            opacity: shaderLayer.opacity,
          }}
        >
          {renderLiveMaterial(shaderLayer, `canvas-${layerId}`)}
        </div>
      </EditableCanvasLayer>
    );
  }
  if (isLogoLayerId(layerId)) {
    const logoLayer = layer as CompositionLogoLayer;
    return (
      <EditableCanvasLayer {...shared} className='shader-lab-v2-composition-layer' transform={logoLayer.transform}>
        <ShaderMaskedMediaContent
          application={application}
          appearance={logoLayer.appearance}
          fallbackColor={logoLayer.color ?? '#FFFFFF'}
          instanceKey={`content-${layerId}`}
          key='content'
          label={logoLayer.name}
          opacity={logoLayer.opacity ?? 1}
          renderMaterial={renderLiveMaterial}
          url={logoLayer.url}
        />
      </EditableCanvasLayer>
    );
  }
  if (isTextLayerId(layerId)) {
    const textLayer = layer as CompositionTextLayer;
    const transform = resolvedTextTransform(textLayer.transform);
    const textFontSizeCqw = resolveDesignLabFontSizeCqw(textLayer, canvasDimensions);
    return (
      <EditableCanvasLayer
        {...shared}
        allowContentInteraction
        className='shader-lab-v2-composition-layer'
        resizeMode='box'
        transform={transform}
      >
        <CanvasTextLayerContent
          application={application}
          canvasHeight={canvasDimensions.height}
          fontSizeCqw={textFontSizeCqw}
          identity={identity}
          key='content'
          layer={textLayer}
          onChange={(value) => actions.updateTextLayer(layerId, { value })}
          onFocus={() => actions.selectCanvasAssembly(layerId)}
          onRichChange={(value, runs) => actions.updateTextLayer(layerId, { value, runs })}
          onSelectionChange={(range) => actions.rememberTextSelection(layerId, range)}
          onFormat={(format) => actions.formatSelectedTextShortcut(layerId, format)}
          onUndoRedo={actions.undoRedo}
          renderMaterial={renderLiveMaterial}
        />
      </EditableCanvasLayer>
    );
  }
  const asset = layer as CompositionAsset;
  const assetId = layerId as AssetLayerId;
  return (
    <EditableCanvasLayer
      {...shared}
      allowContentInteraction={cropEditing}
      className='shader-lab-v2-composition-layer'
      cropEditing={cropEditing}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        actions.setImageCropEditing(assetId, true);
      }}
      resizeMode={normalizeImageCropSettings(asset.imageCrop).enabled ? 'box' : 'scale'}
      transform={asset.transform}
    >
      <ShaderMaskedMediaContent
        application={application}
        appearance={asset.appearance}
        fallbackColor='#FFFFFF'
        imageCrop={asset.imageCrop}
        instanceKey={`content-${layerId}`}
        key='content'
        label={asset.name}
        opacity={asset.opacity ?? 1}
        preserveColors
        renderMaterial={renderLiveMaterial}
        url={asset.url}
      />
      {asset.kind === 'sticker' ? <StickerFinishOverlay finish={asset.stickerFinish} imageCrop={asset.imageCrop} key='finish' url={asset.url} /> : null}
      {cropEditing ? (
        <ImageCropEditorOverlay
          crop={normalizeImageCropSettings(asset.imageCrop)}
          key='crop-editor'
          label={asset.name}
          onChange={(imageCrop) => actions.updateAssetCrop(assetId, imageCrop)}
          onDone={() => actions.setImageCropEditing(assetId, false)}
          onPreview={(imageCrop) => actions.previewAssetCrop(assetId, imageCrop)}
          sourcePreview={(
            <>
              <ShaderMaskedMediaContent
                application={application}
                appearance={asset.appearance}
                fallbackColor='#FFFFFF'
                instanceKey={`crop-source-${layerId}`}
                label={`${asset.name} crop source`}
                opacity={asset.opacity ?? 1}
                preserveColors
                renderMaterial={renderLiveMaterial}
                url={asset.url}
              />
              {asset.kind === 'sticker' ? <StickerFinishOverlay finish={asset.stickerFinish} url={asset.url} /> : null}
            </>
          )}
          url={asset.url}
        />
      ) : null}
    </EditableCanvasLayer>
  );
}, stageLayerPropsEqual);

/** Applies a crop preview to the rendered layer without a React commit. */
export function previewStageLayerCrop(stage: HTMLElement | null, layerId: AssetLayerId, imageCrop: ImageCropSettings) {
  const layer = stage?.querySelector<HTMLElement>(`[data-canvas-layer-id="${CSS.escape(layerId)}"]`);
  if (layer) applyImageCropPreviewStyles(layer, imageCrop);
}

function renderArtboardPreviewMaterial(
  application: ShaderApplication,
  instanceKey: string,
  captureTimeMs: number,
  active: boolean,
  defaultLoopDurationMs: number
): ReactNode {
  if (shaderFrameMatches(application.frameSnapshot, application)) {
    return <ShaderFrameImage className='absolute inset-0 size-full' snapshot={application.frameSnapshot!} />;
  }
  return (
    <LiveMaterialCanvas
      captureTimeMs={captureTimeMs}
      className='absolute inset-0 size-full'
      enabled={active}
      frameRate={24}
      frameState={application.frameState}
      key={instanceKey}
      loopDurationMs={application.frameState?.loopDurationMs ?? defaultLoopDurationMs}
      materialId={application.materialId}
      maxPixelCount={420_000}
      patternScale={clampShaderZoom(application.shaderSize)}
      paused
      renderScale={0.72}
      settings={application.settings}
    />
  );
}

/** A non-interactive layer of an inactive artboard, drawn from its snapshot. */
export const DesignLabArtboardPreviewLayer = memo(function DesignLabArtboardPreviewLayer({
  active,
  artboard,
  captureTimeMs,
  defaultLoopDurationMs,
  identity,
  index,
  layerId,
}: {
  active: boolean;
  artboard: DesignArtboard;
  captureTimeMs: number;
  defaultLoopDurationMs: number;
  identity: BrandIdentity;
  index: number;
  layerId: CompositionLayerId;
}) {
  const { snapshot } = artboard;
  const zIndex = 4 + index;
  const renderMaterial: RenderLiveMaterial = (application, instanceKey) => (
    renderArtboardPreviewMaterial(application, instanceKey, captureTimeMs, active, defaultLoopDurationMs)
  );
  const inert = {
    canvasHeight: snapshot.dimensions.height,
    canvasWidth: snapshot.dimensions.width,
    interactive: false,
    onChange: () => undefined,
    onDeselect: () => undefined,
    onSelect: () => undefined,
    selected: false,
    zIndex,
  };
  if (isEffectLayerId(layerId)) {
    const layer = snapshot.effectLayers.find(({ id }) => id === layerId);
    if (!layer?.visible) return null;
    return (
      <div className='shader-lab-v2-composition-effect' data-effect-kind={layer.settings.kind} style={{ zIndex }}>
        {effectFrameMatches(layer.frameSnapshot, snapshot, layerId)
          ? <ShaderFrameImage snapshot={layer.frameSnapshot} />
          : <ShaderSkeleton state='unavailable' />}
      </div>
    );
  }
  if (isShaderLayerId(layerId)) {
    const layer = snapshot.shaderLayers.find(({ id }) => id === layerId);
    if (!layer?.visible) return null;
    const transform = normalizeCanvasLayerTransform(layer.transform, DEFAULT_LAYER_TRANSFORM);
    return (
      <EditableCanvasLayer
        {...layerGeometry(layerId, snapshot.dimensions)}
        {...inert}
        className='shader-lab-v2-composition-layer shader-lab-v2-composition-shader'
        label={layer.name}
        layerId={layerId}
        resizeMode='box'
        rotation={transform.rotation ?? 0}
        transform={transform}
      >
        <div className='shader-lab-v2-canvas-material' data-shader-instance={`canvas-${layerId}`} key='content' style={{ mixBlendMode: shaderBlendStyle(layer.blendMode), opacity: layer.opacity }}>
          {renderMaterial(layer, `canvas-${layerId}`)}
        </div>
      </EditableCanvasLayer>
    );
  }
  if (isTextLayerId(layerId)) {
    const layer = snapshot.textLayers.find(({ id }) => id === layerId);
    if (!layer?.visible) return null;
    const transform = resolvedTextTransform(layer.transform);
    return (
      <EditableCanvasLayer
        {...layerGeometry(layerId, snapshot.dimensions)}
        {...inert}
        allowContentInteraction
        className='shader-lab-v2-composition-layer'
        label={layer.name}
        layerId={layerId}
        resizeMode='box'
        rotation={transform.rotation ?? 0}
        transform={transform}
      >
        <CanvasTextLayerContent
          application={snapshot.layerShaders[layerId]}
          canvasHeight={snapshot.dimensions.height}
          fontSizeCqw={resolveDesignLabFontSizeCqw(layer, snapshot.dimensions)}
          identity={identity}
          key='content'
          layer={layer}
          onChange={() => undefined}
          onFocus={() => undefined}
          renderMaterial={renderMaterial}
        />
      </EditableCanvasLayer>
    );
  }
  const layer = isLogoLayerId(layerId)
    ? snapshot.logos.find(({ id }) => id === layerId)
    : snapshot.assets.find(({ id }) => id === layerId);
  if (!layer?.visible) return null;
  return (
    <EditableCanvasLayer
      {...layerGeometry(layerId as CanvasLayerId, snapshot.dimensions)}
      {...inert}
      className='shader-lab-v2-composition-layer'
      label={layer.name}
      layerId={layerId}
      rotation={layer.transform.rotation ?? 0}
      transform={layer.transform}
    >
      <ShaderMaskedMediaContent
        application={snapshot.layerShaders[layerId as ContentLayerId]}
        appearance={layer.appearance}
        fallbackColor={isLogoLayerId(layerId) ? (layer as CompositionLogoLayer).color ?? '#FFFFFF' : '#FFFFFF'}
        imageCrop={isAssetLayerId(layerId) ? (layer as CompositionAsset).imageCrop : undefined}
        instanceKey={`content-${layerId}`}
        key='content'
        label={layer.name}
        opacity={layer.opacity ?? 1}
        preserveColors={isAssetLayerId(layerId)}
        renderMaterial={renderMaterial}
        url={layer.url}
      />
      {'kind' in layer && layer.kind === 'sticker' ? <StickerFinishOverlay finish={layer.stickerFinish} imageCrop={layer.imageCrop} key='finish' url={layer.url} /> : null}
    </EditableCanvasLayer>
  );
});

export type DesignLabArtboardActions = {
  activateArtboard: (id: DesignArtboard['id'], focus?: boolean) => Promise<boolean>;
  beginArtboardMove: (event: ReactPointerEvent<HTMLElement>, artboard: DesignArtboard) => void;
  deselectCanvasLayers: () => void;
  nudgeArtboard: (event: ReactKeyboardEvent<HTMLButtonElement>, artboard: DesignArtboard) => void;
  openArtboardMenu: (artboardId: DesignArtboard['id'], position: StudioContextMenuPosition) => void;
  queueArtboardLayer: (artboardId: DesignArtboard['id'], layerId: CanvasLayerId | null) => void;
};

/**
 * One artboard on the workspace. Inactive artboards render their snapshot and
 * skip every commit that does not change them; the active artboard receives
 * its memoized stage layers as children.
 */
export const DesignLabArtboardFrame = memo(function DesignLabArtboardFrame({
  actions,
  active,
  announcement,
  artboard,
  children,
  defaultLoopDurationMs,
  exportDurationMs,
  exportFps,
  identity,
  materialId,
  selected,
  selectedReady,
  snapshot,
  stageRef,
}: {
  actions: DesignLabArtboardActions;
  active: boolean;
  announcement?: string;
  artboard: DesignArtboard;
  children?: ReactNode;
  defaultLoopDurationMs: number;
  exportDurationMs: number;
  exportFps: number;
  identity: BrandIdentity;
  materialId?: string;
  selected: boolean;
  selectedReady: boolean;
  snapshot: DesignArtboard['snapshot'];
  stageRef?: RefObject<HTMLDivElement | null>;
}) {
  const { beginArtboardMove, nudgeArtboard } = actions;
  const size = designSurfaceSize(snapshot.dimensions, artboard.displayScale);
  const preset = STUDIO_ARTBOARD_PRESETS.find(({ id }) => id === snapshot.ratio);
  const ratioPresentation = preset
    ? { height: preset.height, label: preset.label, width: preset.width }
    : { ...snapshot.dimensions, label: 'Custom' };
  const previewLayerIds = selectedReady ? [] : snapshot.layerOrder.filter((layerId) => {
    if (isShaderLayerId(layerId)) return snapshot.shaderLayers.some((layer) => layer.id === layerId && layer.visible);
    if (isTextLayerId(layerId)) return snapshot.textLayers.some((layer) => layer.id === layerId && layer.visible);
    if (isLogoLayerId(layerId)) return snapshot.logos.some((layer) => layer.id === layerId && layer.visible);
    if (isAssetLayerId(layerId)) return snapshot.assets.some((layer) => layer.id === layerId && layer.visible);
    return snapshot.effectLayers.some((layer) => layer.id === layerId && layer.visible);
  });
  const artboardCaptureTimeMs = snapshot.timeline.timeMs ?? resolveMotionFrame(
    exportDurationMs,
    exportFps,
    snapshot.timeline.frame
  ).timeMs;
  return (
    <article
      aria-current={selected ? 'true' : undefined}
      aria-label={`${artboard.name} artboard`}
      className='design-artboard-shell'
      data-active={selected ? 'true' : 'false'}
      data-artboard-id={artboard.id}
      data-canvas-fit-target='true'
      data-canvas-focus-target={selected ? 'true' : undefined}
      data-canvas-interactive
      data-studio-context-trigger='artboard'
      onContextMenu={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const position = {
          ...contextMenuPositionFromEvent(event),
          anchor: event.currentTarget.querySelector<HTMLButtonElement>('.design-artboard-label button'),
        };
        if (await actions.activateArtboard(artboard.id)) actions.openArtboardMenu(artboard.id, position);
      }}
      onPointerDownCapture={(event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (event.button !== 0 || event.currentTarget.closest('[data-space-pressed="true"]')) return;
        if (!selectedReady || target?.closest('.design-artboard-label')
          || !target?.closest('.editable-canvas-layer, [data-canvas-selection-preserve]')) {
          beginArtboardMove(event, artboard);
        }
      }}
      onDoubleClickCapture={(event) => {
        // Inert artboard previews cannot receive their own pointer events.
        // Resolve their topmost layer by geometry, then select after hydration.
        if (selectedReady || (event.target instanceof Element && event.target.closest('.design-artboard-label'))) return;
        const layer = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-canvas-layer-id]')).reverse().find((node) => {
          const bounds = node.getBoundingClientRect();
          return event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom;
        });
        const layerId = layer?.dataset.canvasLayerId as CanvasLayerId | undefined;
        if (!layerId) return;
        event.preventDefault();
        event.stopPropagation();
        actions.queueArtboardLayer(artboard.id, layerId);
        void actions.activateArtboard(artboard.id).then((activated) => {
          if (!activated) actions.queueArtboardLayer(artboard.id, null);
        });
      }}
      style={{ height: size.height, left: artboard.x, top: artboard.y, width: size.width }}
    >
      <header
        aria-label={`Drag ${artboard.name} artboard`}
        className='design-artboard-label'
        data-canvas-selection-preserve
      >
        <button
          aria-keyshortcuts='Shift+F10'
          aria-label={`Move ${artboard.name}. Drag, or use the arrow keys.`}
          onKeyDown={(event) => nudgeArtboard(event, artboard)}
          title='Drag to move · Arrow keys nudge · Shift moves farther'
          type='button'
        >
          <Move aria-hidden='true' />
          <span>{artboard.name}</span>
        </button>
        <span>{ratioPresentation.label} · {snapshot.layerOrder.length} layers</span>
      </header>
      <div
        className={`shader-lab-v2-stage shader-lab-v2-stage-${snapshot.ratio}`}
        data-material-id={selectedReady ? materialId : undefined}
        data-testid={selectedReady ? 'shader-lab-live-stage' : undefined}
        onPointerDown={selectedReady ? (event) => {
          if (event.button === 0) actions.deselectCanvasLayers();
        } : undefined}
        ref={selectedReady ? stageRef : undefined}
        style={{
          aspectRatio: `${ratioPresentation.width} / ${ratioPresentation.height}`,
          backgroundColor: snapshot.backgroundColor,
        }}
      >
        <CanvasRenderBoundary keepAlive={selectedReady}>{() => selectedReady
          ? children
          : previewLayerIds.map((layerId, index) => (
            <DesignLabArtboardPreviewLayer
              active={active}
              artboard={artboard}
              captureTimeMs={artboardCaptureTimeMs}
              defaultLoopDurationMs={defaultLoopDurationMs}
              identity={identity}
              index={index}
              key={layerId}
              layerId={layerId}
            />
          ))}</CanvasRenderBoundary>
        {selectedReady ? <span aria-live='polite' className='sr-only'>
          {announcement}
        </span> : null}
      </div>
    </article>
  );
});
