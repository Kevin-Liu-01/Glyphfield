'use client';

// Design Lab layer lists: the bottom layer dock and the inspector's layer
// list. Each row is memoized on its own layer, selection and order, so editing
// one layer re-renders one row. Very long lists skip layout and paint for
// off-screen rows while keeping them in the accessibility tree for agents.
import { memo, type ComponentProps, type MouseEvent as ReactMouseEvent, type ReactNode, type RefObject, type WheelEvent as ReactWheelEvent } from 'react';

import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import CompositionEffectThumbnail from '@/components/CompositionEffectThumbnail';
import { imageCropElementStyle } from '@/components/DesignLabCanvasContent';
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Grid3X3, ImagePlus, Layers3, Lock, LockOpen, Sparkles, Sticker, Trash2, Type } from '@/components/ui/SolidIcons';
import { contextMenuPositionFromElement, contextMenuPositionFromEvent, type StudioContextMenuPosition } from '@/components/ui/StudioContextMenu';
import StudioPreviewTooltip from '@/components/ui/StudioPreviewTooltip';
import { brandTypographyFamily, resolveBrandTypographyWeight, type BrandIdentity } from '@/lib/brandIdentity';
import {
  isAssetLayerId,
  isCanvasLayerId,
  isContentLayerId,
  isEffectLayerId,
  isLogoLayerId,
  isShaderLayerId,
  isStickerLayer,
  isTextLayerId,
  resolvedTextAppearance,
  resolveTextRunStyle,
  type CanvasLayerId,
  type CompositionAsset,
  type CompositionEffectLayer,
  type CompositionLayerId,
  type CompositionLogoLayer,
  type CompositionShaderLayer,
  type CompositionTextLayer,
  type ContentLayerId,
  type ShaderApplication,
  type TextAppearanceSettings,
  type TextLayerId,
} from '@/lib/designLabModel';
import { designLabImageEffect } from '@/lib/designLabImageEffects';
import { designLabTextDecorationLine, resolveDesignLabFontSize } from '@/lib/designLabTypography';
import type { ImageCropSettings } from '@/lib/imagePlacement';
import { getLiveMaterial } from '@/lib/liveMaterials';
import { textStyleSegments } from '@/lib/richText';
import { shaderPreviewAssetPath } from '@/lib/shaderLab';
import styles from './DesignLabLayerDock.module.css';

/** Lists at least this long render off-screen rows lazily. */
export const DESIGN_LAB_LONG_LAYER_LIST = 40;


export type DesignLabListedLayer = CompositionAsset | CompositionEffectLayer | CompositionLogoLayer | CompositionShaderLayer | CompositionTextLayer;

export type DesignLabLayerRowActions = {
  duplicateLayer: (id: CompositionLayerId) => void;
  moveLayer: (id: CompositionLayerId, direction: -1 | 1) => void;
  openCanvasSelectionMenu: (id: CanvasLayerId, event: ReactMouseEvent<HTMLDivElement>) => void;
  openLayerMenu: (id: CompositionLayerId, position: StudioContextMenuPosition) => void;
  removeLayer: (id: CompositionLayerId) => void;
  selectLayerFromStack: (id: CompositionLayerId) => void;
  toggleLayerLock: (id: CompositionLayerId) => void;
  toggleLayerVisibility: (id: CompositionLayerId) => void;
  updateTextValue: (id: TextLayerId, value: string) => void;
};

export type DesignLabLayerRowProps = {
  actions: DesignLabLayerRowActions;
  appliedShader: ShaderApplication | null;
  canMoveBackward: boolean;
  canMoveForward: boolean;
  groupName?: string;
  identity: BrandIdentity;
  index: number;
  kind: string;
  label: string;
  layer: DesignLabListedLayer;
  lazy: boolean;
  /** Undefined for converters, which have no canvas geometry to lock. */
  locked?: boolean;
  selected: boolean;
  visible: boolean;
};

function LayerLockButton({ className, label, layerId, locked, onToggle }: {
  className?: string;
  label: string;
  layerId: CompositionLayerId;
  locked: boolean;
  onToggle: (id: CompositionLayerId) => void;
}) {
  return (
    <button
      aria-label={`${locked ? 'Unlock' : 'Lock'} ${label}`}
      aria-pressed={locked}
      className={className}
      data-locked={locked ? 'true' : 'false'}
      onClick={() => onToggle(layerId)}
      title={locked ? 'Unlock layer' : 'Lock layer'}
      type='button'
    >
      {locked ? <Lock aria-hidden='true' /> : <LockOpen aria-hidden='true' />}
    </button>
  );
}

export function CanvasLayerKindIcon({ layerId, sticker = false }: { layerId: CompositionLayerId; sticker?: boolean }) {
  if (sticker) return <Sticker aria-hidden='true' />;
  if (isShaderLayerId(layerId)) return <Sparkles aria-hidden='true' />;
  if (isEffectLayerId(layerId)) return <Grid3X3 aria-hidden='true' />;
  if (isTextLayerId(layerId)) return <Type aria-hidden='true' />;
  if (isLogoLayerId(layerId)) return <Layers3 aria-hidden='true' />;
  return <ImagePlus aria-hidden='true' />;
}

export function resolveLayerDockLayers(
  layerId: CompositionLayerId,
  {
    assets,
    effects,
    logos,
    shaders,
    text,
  }: {
    assets: readonly CompositionAsset[];
    effects: readonly CompositionEffectLayer[];
    logos: readonly CompositionLogoLayer[];
    shaders: readonly CompositionShaderLayer[];
    text: readonly CompositionTextLayer[];
  }
) {
  return {
    assetLayer: isAssetLayerId(layerId) ? assets.find(({ id }) => id === layerId) ?? null : null,
    effectLayer: isEffectLayerId(layerId) ? effects.find(({ id }) => id === layerId) ?? null : null,
    logoLayer: isLogoLayerId(layerId) ? logos.find(({ id }) => id === layerId) ?? null : null,
    shaderLayer: isShaderLayerId(layerId) ? shaders.find(({ id }) => id === layerId) ?? null : null,
    textLayer: isTextLayerId(layerId) ? text.find(({ id }) => id === layerId) ?? null : null,
  };
}

export function resolveLayerDockShader(
  layerId: CompositionLayerId,
  shaderLayer: CompositionShaderLayer | null,
  layerShaders: Partial<Record<ContentLayerId, ShaderApplication>>
): ShaderApplication | null {
  if (shaderLayer) return shaderLayer;
  if (!isContentLayerId(layerId)) return null;
  return layerShaders[layerId] ?? null;
}

export function LayerDockStaticPreview({
  effectLayer,
  imageCrop,
  label,
  onSelect,
  previewUrl,
}: {
  effectLayer: CompositionEffectLayer | null;
  imageCrop?: ImageCropSettings;
  label: string;
  onSelect: () => void;
  previewUrl?: string;
}) {
  let preview: ReactNode = <span aria-hidden='true' />;
  if (effectLayer) preview = <EffectLayerThumbnail layer={effectLayer} />;
  else if (previewUrl) preview = <img alt='' draggable={false} src={previewUrl} style={imageCropElementStyle(imageCrop)} />;
  return (
    <button className='shader-lab-v2-dock-preview-select' aria-label={`Select ${label} preview`} onClick={onSelect} type='button'>
      {preview}
    </button>
  );
}

/** A built-in converter draws its own pattern; an image effect shows its library thumbnail. */
function EffectLayerThumbnail({ layer }: { layer: CompositionEffectLayer }) {
  const effectId = layer.settings.effectId;
  if (!effectId) return <CompositionEffectThumbnail kind={layer.settings.kind} settings={layer.settings} />;
  return (
    <span aria-hidden='true' className={`composition-effect-thumbnail ${styles.imageEffectThumbnail}`} data-image-effect={effectId}>
      <img alt='' draggable={false} src={shaderPreviewAssetPath(effectId)} />
    </span>
  );
}

export function layerDockTooltipDescription({
  appliedShader,
  effectLayer,
  layerId,
  sticker,
  textLayer,
}: {
  appliedShader: ShaderApplication | null;
  effectLayer: CompositionEffectLayer | null;
  layerId: CompositionLayerId;
  sticker: boolean;
  textLayer: CompositionTextLayer | null;
}): string {
  if (sticker) return `An editable sticker layer with a non-destructive die-cut treatment${appliedShader ? ` and ${getLiveMaterial(appliedShader.materialId).name}` : ''}.`;
  const imageEffect = designLabImageEffect(effectLayer?.settings.effectId);
  if (imageEffect) return `Applies the ${imageEffect.name} image effect to every visible layer beneath it.`;
  if (effectLayer) return `Converts every visible layer beneath it with the ${effectLayer.settings.kind} effect.`;
  if (isShaderLayerId(layerId) && appliedShader) {
    return `${getLiveMaterial(appliedShader.materialId).name} fills this movable background layer.`;
  }
  if (textLayer) return `Editable text on the canvas${appliedShader ? ` with ${getLiveMaterial(appliedShader.materialId).name} applied` : ''}.`;
  if (isLogoLayerId(layerId)) return `A reusable brand mark${appliedShader ? ` filled with ${getLiveMaterial(appliedShader.materialId).name}` : ''}.`;
  return `An imported image layer${appliedShader ? ` styled with ${getLiveMaterial(appliedShader.materialId).name}` : ''}.`;
}

export function RichTextLayerPreview({ layer, identity }: { layer: CompositionTextLayer; identity: BrandIdentity }) {
  const baseSize = resolveDesignLabFontSize(layer, 900);
  return textStyleSegments(layer.value, layer.runs).map((run) => {
    const style = resolveTextRunStyle(layer, identity, 900, run.style);
    return <span key={run.start} style={{ color: style.color, fontFamily: style.fontFamily,
      fontSize: `${style.fontSize / baseSize}em`, fontStyle: style.fontStyle, fontWeight: style.fontWeight,
      letterSpacing: `${style.tracking}em`, textDecorationLine: designLabTextDecorationLine(style),
      textDecorationThickness: 'from-font', textUnderlineOffset: '0.12em' }}>{layer.value.slice(run.start, run.end)}</span>;
  });
}

export function TextLayerDockPreview({ layer, identity, onSelect, onChange }: {
  layer: CompositionTextLayer; identity: BrandIdentity; onSelect: () => void; onChange: (value: string) => void;
}) {
  if (layer.runs?.length) return <button aria-label={`Select ${layer.name} preview`} onClick={onSelect} type='button'>
    <span className='shader-lab-v2-dock-rich-text' style={{ opacity: layer.opacity }}><RichTextLayerPreview layer={layer} identity={identity} /></span>
  </button>;
  const appearance = resolvedTextAppearance(layer);
  return <input aria-label={`Edit ${layer.name}`} onChange={(event) => onChange(event.target.value)}
    onFocus={onSelect} onKeyDown={(event) => event.stopPropagation()}
    style={{ color: appearance.color, fontFamily: `${JSON.stringify(brandTypographyFamily(identity, appearance.fontRole))}, sans-serif`,
      fontStyle: layer.fontStyle ?? 'normal', fontWeight: resolveBrandTypographyWeight(identity, appearance.fontRole, layer.weight),
      letterSpacing: `${layer.tracking}em`, opacity: appearance.opacity, textDecorationColor: appearance.color,
      textDecorationLine: designLabTextDecorationLine(layer), textDecorationThickness: 'from-font', textUnderlineOffset: '0.12em' }}
    type='text' value={layer.value} />;
}

export function LayerDockTooltipPreview({
  appliedShader,
  effectLayer,
  identity,
  imageCrop,
  previewUrl,
  textAppearance,
  textLayer,
}: {
  appliedShader: ShaderApplication | null;
  effectLayer: CompositionEffectLayer | null;
  identity: BrandIdentity;
  imageCrop?: ImageCropSettings;
  previewUrl?: string;
  textAppearance: TextAppearanceSettings | null;
  textLayer: CompositionTextLayer | null;
}) {
  return (
    <div className='studio-layer-tooltip-preview'>
      {appliedShader ? (
        <img
          alt=''
          className='studio-layer-tooltip-preview__material'
          draggable={false}
          src={shaderPreviewAssetPath(appliedShader.materialId)}
        />
      ) : null}
      {effectLayer ? <EffectLayerThumbnail layer={effectLayer} /> : null}
      {previewUrl ? <img alt='' draggable={false} src={previewUrl} style={imageCropElementStyle(imageCrop)} /> : null}
      {textLayer && textAppearance ? (
        <span
          style={{
            color: textAppearance.color,
            fontFamily: `${JSON.stringify(brandTypographyFamily(identity, textAppearance.fontRole))}, sans-serif`,
            fontStyle: textLayer.fontStyle ?? 'normal',
            fontWeight: resolveBrandTypographyWeight(identity, textAppearance.fontRole, textLayer.weight),
            letterSpacing: `${textLayer.tracking}em`,
            opacity: textAppearance.opacity,
            textDecorationColor: textAppearance.color,
            textDecorationLine: 'none',
            textDecorationThickness: 'from-font',
            textUnderlineOffset: '0.12em',
          }}
        >{textLayer.value ? <RichTextLayerPreview layer={textLayer} identity={identity} /> : 'Empty text layer'}</span>
      ) : null}
    </div>
  );
}

export function scrollLayerDockWithWheel(event: ReactWheelEvent<HTMLDivElement>) {
  if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
  const dock = event.currentTarget;
  const maximumScroll = Math.max(0, dock.scrollWidth - dock.clientWidth);
  if (maximumScroll === 0) return;
  const unit = event.deltaMode === 1
    ? 16
    : event.deltaMode === 2
      ? dock.clientWidth
      : 1;
  const nextScroll = Math.max(0, Math.min(maximumScroll, dock.scrollLeft + event.deltaY * unit));
  if (nextScroll === dock.scrollLeft) return;
  event.preventDefault();
  dock.scrollLeft = nextScroll;
}

function layerRowParts(layer: DesignLabListedLayer) {
  const layerId = layer.id as CompositionLayerId;
  const assetLayer = isAssetLayerId(layerId) ? layer as CompositionAsset : null;
  const effectLayer = isEffectLayerId(layerId) ? layer as CompositionEffectLayer : null;
  const logoLayer = isLogoLayerId(layerId) ? layer as CompositionLogoLayer : null;
  const textLayer = isTextLayerId(layerId) ? layer as CompositionTextLayer : null;
  return {
    assetLayer,
    effectLayer,
    layerId,
    previewUrl: logoLayer?.url ?? assetLayer?.url,
    stickerLayer: isStickerLayer(assetLayer, textLayer),
    textAppearance: textLayer ? resolvedTextAppearance(textLayer) : null,
    textLayer,
  };
}

function LayerRowTooltip({
  appliedShader,
  children,
  identity,
  index,
  kind,
  label,
  layer,
  meta,
}: {
  appliedShader: ShaderApplication | null;
  children: ComponentProps<typeof StudioPreviewTooltip>['children'];
  identity: BrandIdentity;
  index: number;
  kind: string;
  label: string;
  layer: DesignLabListedLayer;
  meta: string;
}) {
  const { assetLayer, effectLayer, layerId, previewUrl, stickerLayer, textAppearance, textLayer } = layerRowParts(layer);
  return (
    <StudioPreviewTooltip
      description={layerDockTooltipDescription({ appliedShader, effectLayer, layerId, sticker: stickerLayer, textLayer })}
      eyebrow={`${String(index + 1).padStart(2, '0')} · ${kind}`}
      meta={meta}
      preview={(
        <LayerDockTooltipPreview
          appliedShader={appliedShader}
          effectLayer={effectLayer}
          identity={identity}
          imageCrop={assetLayer?.imageCrop}
          previewUrl={previewUrl}
          textAppearance={textAppearance}
          textLayer={textLayer}
        />
      )}
      title={label}
    >
      {children}
    </StudioPreviewTooltip>
  );
}

/** One layer in the bottom dock: preview, inline text edit and order actions. */
export const DesignLabDockLayer = memo(function DesignLabDockLayer({
  actions,
  appliedShader,
  canMoveBackward,
  canMoveForward,
  groupName,
  identity,
  index,
  kind,
  label,
  layer,
  lazy,
  locked,
  selected,
  visible: layerIsVisible,
}: DesignLabLayerRowProps) {
  const { effectLayer, layerId, previewUrl, stickerLayer, textLayer, assetLayer } = layerRowParts(layer);
  const imageCrop = assetLayer?.imageCrop;
  return (
    <LayerRowTooltip
      appliedShader={appliedShader}
      identity={identity}
      index={index}
      kind={kind}
      label={label}
      layer={layer}
      meta={`${layerIsVisible ? 'Visible' : 'Hidden'}${groupName ? ` · ${groupName}` : ''} · Right-click for actions`}
    >
      <div
        aria-label={`${label} layer`}
        className={lazy ? `shader-lab-v2-dock-layer ${styles.lazyDockRow}` : 'shader-lab-v2-dock-layer'}
        data-kind={kind.toLocaleLowerCase().replaceAll(' ', '-')}
        data-locked={locked ? 'true' : undefined}
        data-material={appliedShader ? 'true' : 'false'}
        data-selected={selected ? 'true' : 'false'}
        data-studio-context-trigger='layer'
        data-visible={layerIsVisible}
        onContextMenu={(event) => {
          if (isCanvasLayerId(layerId)) {
            actions.openCanvasSelectionMenu(layerId, event);
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          actions.selectLayerFromStack(layerId);
          actions.openLayerMenu(layerId, contextMenuPositionFromEvent(event));
        }}
        role='group'
      >
        <button
          aria-keyshortcuts='Shift+F10'
          className='shader-lab-v2-dock-layer-select'
          onClick={() => actions.selectLayerFromStack(layerId)}
          onKeyDown={(event) => {
            if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return;
            event.preventDefault();
            if (isCanvasLayerId(layerId)) {
              event.currentTarget.dispatchEvent(new MouseEvent('contextmenu', {
                bubbles: true,
                clientX: event.currentTarget.getBoundingClientRect().left + 24,
                clientY: event.currentTarget.getBoundingClientRect().top + 24,
              }));
              return;
            }
            actions.selectLayerFromStack(layerId);
            actions.openLayerMenu(layerId, contextMenuPositionFromElement(event.currentTarget));
          }}
          title={`Select ${label}`}
          type='button'
        >
          <span className='shader-lab-v2-dock-layer-icon'><CanvasLayerKindIcon layerId={layerId} sticker={stickerLayer} /></span>
          <span className='shader-lab-v2-dock-layer-copy'>
            <strong>{label}</strong>
            <small>{String(index + 1).padStart(2, '0')} · {kind}{groupName ? ` · ${groupName}` : ''}</small>
          </span>
        </button>
        <div className='shader-lab-v2-dock-layer-preview'>
          {appliedShader ? (
            <span className='shader-lab-v2-dock-material-frame'>
              <AuthenticShaderPreview materialId={appliedShader.materialId} settings={appliedShader.settings} />
            </span>
          ) : null}
          {textLayer ? (
            <TextLayerDockPreview layer={textLayer} identity={identity} onSelect={() => actions.selectLayerFromStack(textLayer.id)}
              onChange={(value) => actions.updateTextValue(textLayer.id, value)} />
          ) : (
            <LayerDockStaticPreview effectLayer={effectLayer} imageCrop={imageCrop} label={label} onSelect={() => actions.selectLayerFromStack(layerId)} previewUrl={previewUrl} />
          )}
        </div>
        <div className={locked === undefined ? 'shader-lab-v2-dock-layer-actions' : `shader-lab-v2-dock-layer-actions ${styles.lockableActions}`}>
          <button aria-label={`Duplicate ${label}`} onClick={() => actions.duplicateLayer(layerId)} title='Duplicate' type='button'><Copy aria-hidden='true' /></button>
          <button aria-label={`Move ${label} forward`} disabled={!canMoveForward} onClick={() => actions.moveLayer(layerId, 1)} title='Move forward' type='button'><ArrowUp aria-hidden='true' /></button>
          <button aria-label={`Move ${label} backward`} disabled={!canMoveBackward} onClick={() => actions.moveLayer(layerId, -1)} title='Move backward' type='button'><ArrowDown aria-hidden='true' /></button>
          <button aria-label={`${layerIsVisible ? 'Hide' : 'Show'} ${label}`} aria-pressed={layerIsVisible} onClick={() => actions.toggleLayerVisibility(layerId)} title={layerIsVisible ? 'Hide layer' : 'Show layer'} type='button'>{layerIsVisible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}</button>
          {locked === undefined ? null : <LayerLockButton label={label} layerId={layerId} locked={locked} onToggle={actions.toggleLayerLock} />}
          <button aria-label={`Delete ${label}`} onClick={() => actions.removeLayer(layerId)} title='Delete' type='button'><Trash2 aria-hidden='true' /></button>
        </div>
      </div>
    </LayerRowTooltip>
  );
});

/** One row in the inspector's layer list. */
export const DesignLabInspectorLayer = memo(function DesignLabInspectorLayer({
  actions,
  appliedShader,
  groupName,
  identity,
  index,
  kind,
  label,
  layer,
  lazy,
  locked,
  selected,
  visible: layerIsVisible,
}: DesignLabLayerRowProps) {
  const { layerId, stickerLayer } = layerRowParts(layer);
  const openLayerMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (isCanvasLayerId(layerId)) {
      actions.openCanvasSelectionMenu(layerId, event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    actions.selectLayerFromStack(layerId);
    actions.openLayerMenu(layerId, contextMenuPositionFromEvent(event));
  };
  return (
    <LayerRowTooltip
      appliedShader={appliedShader}
      identity={identity}
      index={index}
      kind={kind}
      label={label}
      layer={layer}
      meta={`${layerIsVisible ? 'Visible' : 'Hidden'}${groupName ? ` · ${groupName}` : ''}`}
    >
      <div
        className={['design-layer-inspector-row', lazy ? styles.lazyListRow : '', locked === undefined ? '' : styles.lockableRow].filter(Boolean).join(' ')}
        data-locked={locked ? 'true' : undefined}
        data-selected={selected ? 'true' : 'false'}
        data-studio-context-trigger='layer'
        data-visible={layerIsVisible ? 'true' : 'false'}
        onContextMenu={openLayerMenu}
        role='listitem'
      >
        <button
          aria-keyshortcuts='Shift+F10'
          className='design-layer-inspector-select'
          onClick={() => actions.selectLayerFromStack(layerId)}
          onKeyDown={(event) => {
            if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return;
            event.preventDefault();
            event.currentTarget.parentElement?.dispatchEvent(new MouseEvent('contextmenu', {
              bubbles: true,
              clientX: event.currentTarget.getBoundingClientRect().left + 24,
              clientY: event.currentTarget.getBoundingClientRect().top + 18,
            }));
          }}
          type='button'
        >
          <span><CanvasLayerKindIcon layerId={layerId} sticker={stickerLayer} /></span>
          <span><strong>{label}</strong><small>{String(index + 1).padStart(2, '0')} · {kind}{groupName ? ` · ${groupName}` : ''}</small></span>
        </button>
        {locked === undefined ? null : (
          <LayerLockButton className='design-layer-inspector-visibility' label={label} layerId={layerId} locked={locked} onToggle={actions.toggleLayerLock} />
        )}
        <button
          aria-label={`${layerIsVisible ? 'Hide' : 'Show'} ${label}`}
          aria-pressed={layerIsVisible}
          className='design-layer-inspector-visibility'
          onClick={() => actions.toggleLayerVisibility(layerId)}
          title={layerIsVisible ? 'Hide layer' : 'Show layer'}
          type='button'
        >
          {layerIsVisible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
        </button>
      </div>
    </LayerRowTooltip>
  );
});

export type DesignLabLayerDockActions = {
  addBrandMarkLayer: () => void;
  addCanvasShader: () => void;
  addEffectLayer: () => void;
  addLogoFiles: (files: FileList | null) => void;
  addTextLayer: () => void;
  openImageImport: (files?: readonly File[], placementMode?: 'image' | 'sticker') => void;
};

/** Bottom dock: add-layer buttons, import status and the layer stack. */
export const DesignLabLayerDockPanel = memo(function DesignLabLayerDockPanel({
  actions,
  editingCanvas,
  importState,
  layerCount,
  logoInputRef,
  rows,
}: {
  actions: DesignLabLayerDockActions;
  editingCanvas: boolean;
  importState: { message: string; status: string };
  layerCount: number;
  logoInputRef: RefObject<HTMLInputElement | null>;
  rows: ReactNode;
}) {
  const { addBrandMarkLayer, addCanvasShader, addEffectLayer, addLogoFiles, addTextLayer, openImageImport } = actions;
  return (
    <div className='shader-lab-v2-bottom-dock' data-canvas-selection-preserve>
      <input accept='image/*,.svg,.avif,.bmp' aria-label='Choose logos for the canvas' className='sr-only' multiple onChange={(event) => void addLogoFiles(event.target.files)} ref={logoInputRef} type='file' />
      <div className='shader-lab-v2-dock-create'>
        <div className='shader-lab-v2-dock-heading'>
          <span><Layers3 aria-hidden='true' />Layers</span>
          <small>{layerCount} total · front to back</small>
        </div>
        <div className='shader-lab-v2-dock-add' aria-label='Add canvas layer' role='group'>
          <button aria-label='Add text layer' onClick={() => addTextLayer()} type='button'><Type aria-hidden='true' /><span>Text</span></button>
          <button aria-label='Add shader layer' onClick={() => addCanvasShader()} type='button'><Sparkles aria-hidden='true' /><span>Shader</span></button>
          <button aria-label='Add effect layer' disabled={editingCanvas} title={editingCanvas ? 'Frame your selection to apply composition-wide effects' : 'Add effect layer'} onClick={() => addEffectLayer()} type='button'><Grid3X3 aria-hidden='true' /><span>Effect</span></button>
          <button aria-label='Add brand mark' onClick={addBrandMarkLayer} type='button'><Layers3 aria-hidden='true' /><span>Mark</span></button>
          <button aria-label='Add sticker layer' onClick={() => openImageImport([], 'sticker')} type='button'><Sticker aria-hidden='true' /><span>Sticker</span></button>
          <button aria-label='Add image layer' className='shader-lab-v2-dock-add-image' onClick={() => openImageImport()} title='Open the shared Asset library or import new images' type='button'><ImagePlus aria-hidden='true' /><span>Image</span></button>
        </div>
        <span aria-live='polite' className='shader-lab-v2-image-import-status' data-state={importState.status}>
          {importState.message || 'Images keep their aspect ratio when added.'}
        </span>
      </div>

      <div
        aria-label='Canvas layer stack'
        className='shader-lab-v2-dock-stack studio-scroll-area'
        onWheel={scrollLayerDockWithWheel}
        role='region'
        tabIndex={0}
      >
        {rows}
      </div>
    </div>
  );
});
