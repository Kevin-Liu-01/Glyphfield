'use client';

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CircleGauge,
  Clapperboard,
  Clock3,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileImage,
  Film,
  Frame,
  Grid3X3,
  ImageDown,
  ImagePlus,
  Layers3,
  LayoutGrid,
  MonitorUp,
  Move,
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  Ruler,
  Search,
  Sparkles,
  Sticker,
  Trash2,
  Type,
  WandSparkles,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
} from '@/components/ui/SolidIcons';
import { memo, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type SetStateAction, type WheelEvent as ReactWheelEvent } from 'react';
import { createPortal, flushSync } from 'react-dom';

import CanvasViewport, { type CanvasActionHistory } from '@/components/CanvasViewport';
import ArtboardSizeMenu, { ArtboardSetupFields } from '@/components/ArtboardSizeMenu';
import { arrangeCanvasFrames, translateCanvasFrame } from '@/lib/canvasViewport';
import CanvasSelectionMenu, { type CanvasSelectionMenuPosition } from '@/components/CanvasSelectionMenu';
import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import AssetConversionLibrary from '@/components/AssetConversionLibrary';
import StudioRange from '@/components/ui/StudioRange';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import CompositionEffectThumbnail from '@/components/CompositionEffectThumbnail';
import DesignVersionControls from '@/components/DesignVersionControls';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import {
  alignCanvasSelection,
  canvasLayerDimensions,
  canvasSelectionBounds,
  isAdditiveCanvasSelection,
  MIN_CANVAS_LAYER_SCALE,
  nextCanvasLayerSelection,
  normalizeCanvasLayerTransform,
  type CanvasLayerAlignment,
  type CanvasLayerBounds,
  type CanvasSelectionItem,
  type CanvasLayerTransform,
} from '@/lib/canvasInteraction';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import ImageAssetModal, { type ImageAssetPlacementMode, type ImageImportRequest, type PendingImageImport } from '@/components/ImageAssetModal';
import { LabInspectorSection, LabPanelHeading } from '@/components/LabWorkspace';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { LiveMaterialSourceTag } from '@/components/LiveMaterialSourceLabel';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import LogoAppearancePreview, { AppearanceFilteredContent } from '@/components/LogoAppearancePreview';
import { ConditionalRender, OptionalRender } from '@/components/RenderControl';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
import TextEffectThumbnail from '@/components/TextEffectThumbnail';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioContextMenu, {
  contextMenuPositionFromElement,
  contextMenuPositionFromEvent,
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import StudioPreviewTooltip from '@/components/ui/StudioPreviewTooltip';
import StudioSelect from '@/components/ui/StudioSelect';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useMountEffect } from '@/hooks/useMountEffect';

function canvasSelectionAnnouncement(count: number, groupName?: string): string {
  if (count === 0) return 'Canvas selection cleared.';
  const plural = count === 1 ? '' : 's';
  const group = groupName ? ` in ${groupName}` : '';
  return `${count} canvas layer${plural} selected${group}.`;
}

function isCanvasClipboardEditingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function designLabInspectorDescription({
  hasContent,
  hasEffect,
  hasLayerShader,
  hasShader,
  materialName,
}: {
  hasContent: boolean;
  hasEffect: boolean;
  hasLayerShader: boolean;
  hasShader: boolean;
  materialName: string;
}): string {
  if (hasShader) return 'Tune this full-canvas material, then place it anywhere in the layer stack.';
  if (hasEffect) return 'Convert every layer beneath this point without flattening the composition.';
  if (hasContent) {
    return `Style, position, and export this layer${hasLayerShader ? ` with ${materialName} applied` : ''}.`;
  }
  return 'Select a layer to edit its content and appearance, or add a new one below.';
}
import { useAncestorWorkspaceActivity } from '@/hooks/useAncestorWorkspaceActivity';
import { useConvertedAssets } from '@/hooks/useConvertedAssets';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useDismissibleMenu } from '@/hooks/useDismissibleMenu';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  brandAssetPath,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  brandTypographyWeightRange,
  resolveBrandTypographyWeight,
  type BrandAsset,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import {
  canvasTextCharacters,
  canvasTextLineX,
  layoutCanvasText,
  trackedTextWidth,
  type CanvasTextAlign,
  type CanvasTextWrap,
} from '@/lib/canvasText';
import {
  canvasToImageBlob,
  buildMotionFrames,
  encodeCanvasGif,
  encodeCanvasMp4,
  resolveLoopedMotionFrame,
  resolveMotionFrame,
  resolveExportDimensions,
  resolveSeamlessLoopOverlapFrames,
  type MotionLoopMode,
  type MotionLoopReport,
  type MotionExportQuality,
  type MotionFrame,
  type StillImageFormat,
} from '@/lib/canvasExport';
import { drawCanvasImageCover, loadCanvasImage } from '@/lib/canvasDrawing';
import { canvasRevisionFromSignature, isCanvasDocumentEnvelope } from '@/lib/canvasDocument';
import {
  normalizeStudioArtboardDimensions,
  STUDIO_ARTBOARD_PRESETS,
  studioArtboardPresetForSize,
  type StudioArtboardDimensions,
  type StudioArtboardPresetId,
} from '@/lib/artboardSizes';
import {
  DESIGN_LAB_CLIPBOARD_MIME,
  parseDesignLabClipboard,
  remapDesignLabClipboardSnapshot,
  serializeDesignLabClipboard,
  type DesignLabClipboardPayload,
} from '@/lib/designLabClipboard';
import { renderCanvasDocumentPage } from '@/lib/canvasRenderer';
import type { ConvertedAsset } from '@/lib/convertedAssets';
import {
  applyCompositionEffect,
  COMPOSITION_EFFECT_PRESETS,
  createCompositionEffectScratch,
  defaultCompositionEffectSettings,
  type CompositionEffectScratch,
  type CompositionEffectKind,
  type CompositionEffectSettings,
} from '@/lib/compositionEffects';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_PALETTES,
  brandMaterialPalette,
  getLiveMaterial,
  isPaperLiveMaterialId,
  normalizeLiveMaterialId,
  type LiveMaterialId,
  type LiveMaterialOption,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  createDesignLabCanvasDocument,
  parseDesignLabCanvasDocument,
  reconcileDesignLabLayerGroups,
  reconcileDesignLabLayerOrder,
  serializeExistingDesignLabCanvasDocument,
  withDesignLabTimeline,
} from '@/lib/designLabDocument';
import { parseSourceObject } from '@/lib/sourceCode';
import {
  clearLiveMaterialTimePreview,
  previewLiveMaterialPatternScale,
  previewLiveMaterialSettings,
  previewLiveMaterialTime,
} from '@/lib/liveMaterialPreview';
import { liveMaterialInstancePixelBudget } from '@/lib/liveMaterialRenderBudget';
import {
  buildImageSvgFilter,
  buildLogoSvgFilter,
  DEFAULT_LOGO_APPEARANCE,
  drawLogoAppearanceLayer,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';
import { copyTextToClipboard } from '@/lib/clipboard';
import { imageUrlToDataUrl } from '@/lib/download';
import {
  fitImageLayerToCanvas,
  previewContainedImageBounds,
} from '@/lib/imagePlacement';
import { createImportedBrandAsset, readEmbeddedImageFile } from '@/lib/imageAssets';
import {
  SHADER_LAB_CATEGORIES,
  shaderLabCategoryCount,
  shaderLabMaterials,
  shaderMaterialPreviewStyle,
  shaderLabSettingsFor,
  shaderPreviewAssetPath,
  type ShaderLabCategory,
} from '@/lib/shaderLab';
import {
  savedDesignStorageKey,
} from '@/lib/savedDesigns';
import {
  clampShaderZoom,
  formatShaderZoom,
  shaderZoomFromSlider,
  shaderZoomToSlider,
  SHADER_ZOOM_MAX,
  SHADER_ZOOM_MIN,
  SHADER_ZOOM_SLIDER_MAX,
  SHADER_ZOOM_SLIDER_MIN,
  SHADER_ZOOM_SLIDER_STEP,
  stepShaderZoom,
} from '@/lib/shaderZoom';
import {
  buildShaderSequenceTimeline,
  DEFAULT_SHADER_SEQUENCE_SETTINGS,
  normalizeShaderSequenceSettings,
  shaderSequenceDurationMs,
  shaderSequenceMaterialIds,
  shaderSequenceSegmentAt,
  type ShaderSequenceSettings,
} from '@/lib/shaderSequence';
import {
  DEFAULT_STICKER_FINISH,
  STICKER_FINISH_PRESETS,
  drawStickerFinishOverlay,
  normalizeStickerFinish,
  stickerFinishSwatch,
  type StickerFinishSettings,
} from '@/lib/surfaceSticker';
import { downloadStudioArtifact, registerStudioAutomation } from '@/lib/studioAutomation';
import type { StudioTool, StudioToolId } from '@/lib/studioCatalog';
import {
  applyTextEffectMask,
  createTextEffectGradient,
  DEFAULT_TEXT_EFFECT,
  resolveTextEffectSettings,
  textEffectCssStyle,
  TEXT_EFFECT_PRESETS,
  type TextEffectSettings,
} from '@/lib/textEffects';

type ShaderRatio = StudioArtboardPresetId | 'custom';
type ShaderBlendMode = 'multiply' | 'normal' | 'overlay' | 'screen';
type ShaderLayerId = `shader-${string}`;
type EffectLayerId = `effect-${string}`;
type LogoLayerId = `logo-${string}`;
type TextLayerId = `text-${string}`;
type AssetLayerId = `asset-${string}`;
type ContentLayerId = LogoLayerId | TextLayerId | AssetLayerId;
type CanvasLayerId = ShaderLayerId | ContentLayerId;
type CompositionLayerId = ShaderLayerId | EffectLayerId | ContentLayerId;
type CompositionLayerGroupId = `group-${string}`;

type CompositionLayerGroup = {
  id: CompositionLayerGroupId;
  layerIds: CanvasLayerId[];
  name: string;
};

type ShaderApplication = {
  blendMode: ShaderBlendMode;
  materialId: LiveMaterialId;
  opacity: number;
  settings: LiveMaterialSettings;
  shaderSize: number;
};

type CompositionShaderLayer = ShaderApplication & {
  id: ShaderLayerId;
  name: string;
  transform: CanvasLayerTransform;
  visible: boolean;
};

type CompositionEffectLayer = {
  id: EffectLayerId;
  name: string;
  opacity: number;
  settings: CompositionEffectSettings;
  visible: boolean;
};


type CompositionLogoLayer = {
  appearance?: LogoAppearanceSettings;
  color?: string;
  convertedAssetId?: string;
  id: LogoLayerId;
  name: string;
  opacity?: number;
  transform: CanvasLayerTransform;
  url: string;
  visible: boolean;
};

type CompositionAsset = {
  appearance?: LogoAppearanceSettings;
  id: AssetLayerId;
  kind?: ImageAssetPlacementMode;
  libraryAssetId?: string;
  name: string;
  opacity?: number;
  stickerFinish?: StickerFinishSettings;
  transform: CanvasLayerTransform;
  url: string;
  visible: boolean;
};

type CompositionTextLayer = {
  align: CanvasTextAlign;
  color?: string;
  fontRole?: BrandTypography['role'];
  id: TextLayerId;
  kind?: 'sticker' | 'text';
  lineHeight: number;
  name: string;
  opacity?: number;
  outlineColor?: string;
  outlineEnabled?: boolean;
  outlineWidth?: number;
  shadowBlur?: number;
  shadowColor?: string;
  shadowEnabled?: boolean;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  textEffect?: TextEffectSettings;
  tracking: number;
  transform: CanvasLayerTransform;
  value: string;
  visible: boolean;
  weight: number;
  wrap: CanvasTextWrap;
};

type LayerGeometry = {
  baseHeight: number;
  baseWidth: number;
  baseX: number;
  baseY: number;
};

type TextAppearanceSettings = {
  color: string;
  fontRole: BrandTypography['role'];
  opacity: number;
  outlineColor: string;
  outlineEnabled: boolean;
  outlineWidth: number;
  shadowBlur: number;
  shadowColor: string;
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
  textEffect: TextEffectSettings;
};

type TextEffectRenderScratch = {
  fill: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
};

type DesignExportSettings = {
  durationMs: number;
  fps: number;
  gifLoop: MotionLoopMode;
  quality: MotionExportQuality;
  width: number;
};

type DesignRatioOption = StudioArtboardDimensions & {
  label: string;
  value: ShaderRatio;
};

type DesignExportFormat = 'gif' | 'jpg' | 'mp4' | 'png';
type DesignMotionMode = 'sequence' | 'standard';
type DesignAutomationExportInput = {
  download?: boolean;
  format: 'gif' | 'jpg' | 'mp4' | 'png';
  mode?: 'shader-sequence' | 'standard';
};
type ImageImportState = {
  message: string;
  status: 'error' | 'idle' | 'importing' | 'success';
};

type DesignExportRequest = {
  format: DesignExportFormat;
  motionMode?: DesignMotionMode;
  settingsSignature: string;
};

type DesignShaderSequenceSettings = ShaderSequenceSettings & {
  sequenceOffset: number;
  targetLayerId: ShaderLayerId | null;
};

type DesignArtboardId = `artboard-${string}`;

type DesignArtboardTimeline = {
  frame: number;
  paused: boolean;
};

type DesignArtboardSnapshot = {
  assets: CompositionAsset[];
  backgroundColor: string;
  dimensions: StudioArtboardDimensions;
  effectLayers: CompositionEffectLayer[];
  groups: CompositionLayerGroup[];
  layerOrder: CompositionLayerId[];
  layerShaders: Partial<Record<ContentLayerId, ShaderApplication>>;
  logos: CompositionLogoLayer[];
  ratio: ShaderRatio;
  shaderLayers: CompositionShaderLayer[];
  shaderSequence: DesignShaderSequenceSettings;
  textLayers: CompositionTextLayer[];
  timeline: DesignArtboardTimeline;
};

type DesignArtboard = {
  id: DesignArtboardId;
  name: string;
  snapshot: DesignArtboardSnapshot;
  x: number;
  y: number;
};

type DesignArtboardWorkspaceSource = {
  activeArtboardId?: DesignArtboardId;
  artboards?: DesignArtboard[];
};

type DesignCanvasHistoryEntry = {
  artboards: DesignArtboard[];
  detail: string;
  id: string;
  label: string;
  signature: string;
};

type DesignCanvasHistoryState = {
  future: DesignCanvasHistoryEntry[];
  past: DesignCanvasHistoryEntry[];
  present: DesignCanvasHistoryEntry | null;
};

const DEFAULT_DESIGN_ARTBOARD_ID = 'artboard-main' as DesignArtboardId;
const DESIGN_WORKSPACE_WIDTH = 2_800;
const DESIGN_WORKSPACE_HEIGHT = 1_800;

function resolvedDesignArtboardName(name: string | undefined): string {
  return name?.trim() || 'Untitled artboard';
}

function cloneArtboardSnapshot(snapshot: DesignArtboardSnapshot): DesignArtboardSnapshot {
  const dimensions = normalizeStudioArtboardDimensions(
    snapshot.dimensions,
    studioDimensionsForRatio(snapshot.ratio)
  );
  return {
    assets: snapshot.assets.map((asset) => ({
      ...asset,
      appearance: asset.appearance ? { ...asset.appearance } : undefined,
      stickerFinish: asset.stickerFinish ? { ...asset.stickerFinish } : undefined,
      transform: { ...asset.transform },
    })),
    backgroundColor: snapshot.backgroundColor,
    dimensions,
    effectLayers: snapshot.effectLayers.map((layer) => ({ ...layer, settings: { ...layer.settings } })),
    groups: snapshot.groups.map((group) => ({ ...group, layerIds: [...group.layerIds] })),
    layerOrder: [...snapshot.layerOrder],
    layerShaders: Object.fromEntries(Object.entries(snapshot.layerShaders).map(([id, application]) => [
      id,
      application ? { ...application, settings: { ...application.settings } } : application,
    ])) as DesignArtboardSnapshot['layerShaders'],
    logos: snapshot.logos.map((layer) => ({
      ...layer,
      appearance: layer.appearance ? { ...layer.appearance } : undefined,
      transform: { ...layer.transform },
    })),
    ratio: snapshot.ratio,
    shaderLayers: snapshot.shaderLayers.map((layer) => ({
      ...layer,
      settings: { ...layer.settings },
      transform: { ...layer.transform },
    })),
    shaderSequence: {
      ...snapshot.shaderSequence,
      sequenceOffset: Number.isFinite(snapshot.shaderSequence.sequenceOffset)
        ? Math.max(0, Math.round(snapshot.shaderSequence.sequenceOffset))
        : 0,
    },
    textLayers: snapshot.textLayers.map((layer) => ({
      ...layer,
      textEffect: layer.textEffect ? { ...layer.textEffect } : undefined,
      transform: { ...layer.transform },
    })),
    timeline: {
      frame: Number.isFinite(snapshot.timeline?.frame) ? Math.max(0, Math.round(snapshot.timeline.frame)) : 0,
      paused: snapshot.timeline?.paused ?? true,
    },
  };
}

function cloneDesignArtboards(artboards: readonly DesignArtboard[]): DesignArtboard[] {
  return artboards.map((artboard) => ({ ...artboard, snapshot: cloneArtboardSnapshot(artboard.snapshot) }));
}

function designCanvasHistorySignature(artboards: readonly DesignArtboard[]): string {
  return JSON.stringify(artboards.map((artboard) => ({
    ...artboard,
    snapshot: {
      ...artboard.snapshot,
      // Live playback advances continuously and is not a user action. Keeping
      // that clock out of the signature prevents history churn while retaining
      // an exact frame whenever the user pauses or scrubs the timeline.
      timeline: artboard.snapshot.timeline.paused
        ? artboard.snapshot.timeline
        : { frame: 0, paused: false },
    },
  })));
}

function artboardSnapshotPersistenceSignature(snapshot: DesignArtboardSnapshot): string {
  return JSON.stringify({
    ...snapshot,
    timeline: snapshot.timeline.paused
      ? snapshot.timeline
      : { frame: 0, paused: false },
  });
}

function canUndoDesignCanvasHistory(history: DesignCanvasHistoryState, signature: string): boolean {
  if (history.past.length > 0) return true;
  return Boolean(history.present && history.present.signature !== signature);
}

function resolveActiveDesignArtboard(
  artboards: readonly DesignArtboard[],
  activeArtboardId: DesignArtboardId
): DesignArtboard | null {
  return artboards.find(({ id }) => id === activeArtboardId) ?? artboards[0] ?? null;
}

function presentCanvasActionHistory(
  history: DesignCanvasHistoryState,
  signature: string,
  onRedo: () => void,
  onUndo: () => void
): CanvasActionHistory {
  const entries = [...history.past.slice(-7), ...(history.present ? [history.present] : [])];
  return {
    canRedo: history.future.length > 0,
    canUndo: canUndoDesignCanvasHistory(history, signature),
    entries: entries.map((entry) => ({
      current: entry === history.present,
      detail: entry.detail,
      id: entry.id,
      label: entry.label,
    })),
    onRedo,
    onUndo,
  };
}

function describeDesignCanvasChange(previous: readonly DesignArtboard[], next: readonly DesignArtboard[]): string {
  if (next.length > previous.length) return 'Added artboard';
  if (next.length < previous.length) return 'Deleted artboard';
  for (const artboard of next) {
    const before = previous.find(({ id }) => id === artboard.id);
    if (!before) return 'Added artboard';
    if (before.name !== artboard.name) return 'Renamed artboard';
    if (before.x !== artboard.x || before.y !== artboard.y) return 'Moved artboard';
    if (
      before.snapshot.dimensions.width !== artboard.snapshot.dimensions.width
      || before.snapshot.dimensions.height !== artboard.snapshot.dimensions.height
    ) return 'Resized artboard';
    const beforeLayers = before.snapshot.layerOrder.length;
    const nextLayers = artboard.snapshot.layerOrder.length;
    if (nextLayers > beforeLayers) return 'Added layer';
    if (nextLayers < beforeLayers) return 'Deleted layer';
    if (
      before.snapshot.timeline.frame !== artboard.snapshot.timeline.frame
      || before.snapshot.timeline.paused !== artboard.snapshot.timeline.paused
    ) return 'Changed shader frame';
    if (artboardSnapshotSignature(before.snapshot) !== artboardSnapshotSignature(artboard.snapshot)) {
      return 'Updated canvas';
    }
  }
  return 'Updated canvas';
}

function studioDimensionsForRatio(ratio: ShaderRatio): StudioArtboardDimensions {
  // Design Lab used a 1200px square before dimensions became part of each
  // artboard snapshot. Preserve that legacy canvas exactly when restoring an
  // older draft; newly selected Square presets still use the shared 1080px size.
  if (ratio === 'square') return { height: 1200, width: 1200 };
  const preset = STUDIO_ARTBOARD_PRESETS.find(({ id }) => id === ratio);
  return preset ?? STUDIO_ARTBOARD_PRESETS[0];
}

function designArtboardDisplaySize(dimensions: StudioArtboardDimensions): StudioArtboardDimensions {
  const scale = Math.min(720 / dimensions.width, 520 / dimensions.height);
  return {
    height: Math.round(dimensions.height * scale),
    width: Math.round(dimensions.width * scale),
  };
}

function designArtboardWorkspaceSize(artboards: readonly DesignArtboard[]): { height: number; width: number } {
  return artboards.reduce((workspace, artboard) => {
    const size = designArtboardDisplaySize(artboard.snapshot.dimensions);
    return {
      height: Math.max(workspace.height, artboard.y + size.height + 360),
      width: Math.max(workspace.width, artboard.x + size.width + 360),
    };
  }, { height: DESIGN_WORKSPACE_HEIGHT, width: DESIGN_WORKSPACE_WIDTH });
}

function restoreDesignArtboardWorkspace(
  workspace: DesignArtboardWorkspaceSource | undefined,
  activeSnapshot: DesignArtboardSnapshot
): { activeArtboardId: DesignArtboardId; artboards: DesignArtboard[] } {
  const seenIds = new Set<DesignArtboardId>();
  const incomingArtboards = (workspace?.artboards ?? []).flatMap((artboard) => {
    if (seenIds.has(artboard.id)) return [];
    seenIds.add(artboard.id);
    return [{
      ...artboard,
      name: resolvedDesignArtboardName(artboard.name),
      snapshot: cloneArtboardSnapshot(artboard.snapshot),
      x: Math.max(80, artboard.x),
      y: Math.max(96, artboard.y),
    }];
  });
  const activeArtboardId = incomingArtboards.some(({ id }) => id === workspace?.activeArtboardId)
    ? workspace!.activeArtboardId!
    : incomingArtboards[0]?.id ?? DEFAULT_DESIGN_ARTBOARD_ID;
  const artboards = incomingArtboards.length > 0
    ? incomingArtboards.map((artboard) => artboard.id === activeArtboardId
        ? { ...artboard, snapshot: cloneArtboardSnapshot(activeSnapshot) }
        : artboard)
    : [{
        id: DEFAULT_DESIGN_ARTBOARD_ID,
        name: 'Artboard 1',
        snapshot: cloneArtboardSnapshot(activeSnapshot),
        x: 280,
        y: 240,
      } satisfies DesignArtboard];
  return { activeArtboardId, artboards };
}

const DESIGN_ARTBOARD_TOUR_STEPS = [
  {
    description: 'Each artboard is an independent export surface. Copy and paste an artboard or any selected layers with Cmd/Ctrl+C and V.',
    Icon: Frame,
    title: 'Build with artboards',
  },
  {
    description: 'Drag an artboard by its name. Pan the dotted workspace, then zoom or fit the full board from the top-right controls.',
    Icon: Move,
    title: 'Arrange the workspace',
  },
  {
    description: 'Layers can sit beyond an artboard edge while you explore. Only the portion inside the active artboard is included when you export.',
    Icon: Frame,
    title: 'Work beyond the frame',
  },
  {
    description: 'Select an artboard, then add and arrange its layers below. Export always uses the active artboard.',
    Icon: Layers3,
    title: 'Edit in context',
  },
] as const;

function DesignArtboardTour({
  onClose,
  onNext,
  step,
}: {
  onClose: () => void;
  onNext: () => void;
  step: number;
}) {
  const boundedStep = Math.min(DESIGN_ARTBOARD_TOUR_STEPS.length - 1, Math.max(0, step));
  const tourStep = DESIGN_ARTBOARD_TOUR_STEPS[boundedStep]!;
  const { Icon } = tourStep;
  return (
    <aside className='design-artboard-tour' data-canvas-selection-preserve>
      <div><span>{boundedStep + 1} / {DESIGN_ARTBOARD_TOUR_STEPS.length}</span><button aria-label='Close artboard tutorial' onClick={onClose} type='button'><X aria-hidden='true' /></button></div>
      <Icon aria-hidden='true' />
      <strong>{tourStep.title}</strong>
      <p>{tourStep.description}</p>
      <footer>
        <button onClick={onClose} type='button'>Skip</button>
        <button onClick={onNext} type='button'>{boundedStep === DESIGN_ARTBOARD_TOUR_STEPS.length - 1 ? 'Done' : 'Next'}</button>
      </footer>
    </aside>
  );
}

function artboardSnapshotSignature(snapshot: DesignArtboardSnapshot): string {
  return JSON.stringify(snapshot);
}

function artboardSnapshotReady(
  pending: { id: DesignArtboardId; signature: string } | null,
  activeArtboardId: DesignArtboardId,
  currentSignature: string
): boolean {
  return !pending || (
    pending.id === activeArtboardId
    && pending.signature === currentSignature
  );
}

type ShaderSequenceCapture = {
  application: ShaderApplication;
  layerId: ShaderLayerId;
  materialId: LiveMaterialId;
};

const RATIO_OPTIONS: readonly { height: number; label: string; value: StudioArtboardPresetId; width: number }[] = (
  STUDIO_ARTBOARD_PRESETS.map(({ height, id, label, width }) => ({ height, label, value: id, width }))
);

const DEFAULT_EXPORT_SETTINGS: DesignExportSettings = {
  durationMs: 1_600,
  fps: 30,
  gifLoop: 'seamless',
  quality: 'balanced',
  width: 960,
};
const EXPORT_WIDTH_PRESETS = [
  { label: 'Compact', width: 640 },
  { label: 'Standard', width: 960 },
  { label: 'Large', width: 1_280 },
  { label: 'Full', width: 1_920 },
] as const;
const EXPORT_QUALITY_OPTIONS: readonly { description: string; label: string; value: MotionExportQuality }[] = [
  { description: 'Quick preview', label: 'Fast', value: 'fast' },
  { description: 'Everyday export', label: 'Balanced', value: 'balanced' },
  { description: 'Most detail', label: 'Best', value: 'best' },
];

function normalizeDesignExportSettings(settings?: Partial<DesignExportSettings>): DesignExportSettings {
  return {
    durationMs: settings?.durationMs && [1_200, 1_600, 2_400, 4_000].includes(settings.durationMs)
      ? settings.durationMs
      : DEFAULT_EXPORT_SETTINGS.durationMs,
    fps: settings?.fps && [12, 15, 24, 30, 60].includes(settings.fps)
      ? settings.fps
      : DEFAULT_EXPORT_SETTINGS.fps,
    gifLoop: settings?.gifLoop === 'raw' ? 'raw' : 'seamless',
    quality: settings?.quality && EXPORT_QUALITY_OPTIONS.some(({ value }) => value === settings.quality)
      ? settings.quality
      : DEFAULT_EXPORT_SETTINGS.quality,
    width: Number.isFinite(settings?.width) && (settings?.width ?? 0) > 0
      ? settings!.width!
      : DEFAULT_EXPORT_SETTINGS.width,
  };
}

function designExportSettingsSignature(ratio: ShaderRatio, settings: DesignExportSettings): string {
  return [ratio, settings.width, settings.quality, settings.durationMs, settings.fps, settings.gifLoop].join(':');
}

function DesignExportControls({
  format,
  onChange,
  ratioOption,
  settings,
}: {
  format: DesignExportFormat;
  onChange: (patch: Partial<DesignExportSettings>) => void;
  ratioOption: DesignRatioOption;
  settings: DesignExportSettings;
}) {
  const dimensions = resolveExportDimensions({
    aspectHeight: ratioOption.height,
    aspectWidth: ratioOption.width,
    width: settings.width,
  });
  const frameCount = Math.max(2, Math.round(settings.durationMs / (1_000 / settings.fps)));
  const loopOverlapFrames = resolveSeamlessLoopOverlapFrames({
    durationMs: settings.durationMs,
    fps: settings.fps,
    height: dimensions.height,
    width: dimensions.width,
  });
  const motion = format === 'gif' || format === 'mp4';

  return (
    <div className='shader-lab-v2-output-controls'>
      <div className='shader-lab-v2-export-overview' aria-label='Current output settings'>
        <div>
          <MonitorUp aria-hidden='true' />
          <span><small>Output size</small><strong>{dimensions.width} × {dimensions.height}</strong></span>
        </div>
        <div>
          {motion ? <Film aria-hidden='true' /> : <FileImage aria-hidden='true' />}
          {motion
            ? <span><small>Animation · {frameCount} frames</small><strong>{settings.durationMs / 1_000}s · {settings.fps} FPS</strong></span>
            : <span><small>Static image</small><strong>{format.toUpperCase()} · {settings.quality}</strong></span>}
        </div>
      </div>
      <div className='shader-lab-v2-export-presets' aria-label='Export size presets'>
        {EXPORT_WIDTH_PRESETS.map((preset) => {
          const presetDimensions = resolveExportDimensions({
            aspectHeight: ratioOption.height,
            aspectWidth: ratioOption.width,
            width: preset.width,
          });
          return (
            <button
              aria-pressed={dimensions.width === presetDimensions.width}
              key={preset.width}
              onClick={() => onChange({ width: preset.width })}
              type='button'
            >
              <strong>{preset.label}</strong>
              <small>{presetDimensions.width}×{presetDimensions.height}</small>
            </button>
          );
        })}
      </div>
      <label className='shader-lab-v2-export-width'>
        <span><Ruler aria-hidden='true' />Custom width</span>
        <span>
          <input
            aria-label='Export width in pixels'
            max={3_840}
            min={320}
            onBlur={() => onChange({ width: dimensions.width })}
            onChange={(event) => {
              const width = event.currentTarget.valueAsNumber;
              if (Number.isFinite(width)) onChange({ width });
            }}
            step={2}
            type='number'
            value={settings.width}
          />
          <i>px</i>
        </span>
      </label>
      <div className='shader-lab-v2-export-quality'>
        <span><CircleGauge aria-hidden='true' />Quality</span>
        <div>
          {EXPORT_QUALITY_OPTIONS.map((option) => {
            const QualityIcon = option.value === 'fast' ? Zap : option.value === 'balanced' ? CircleGauge : Sparkles;
            return (
              <button
                aria-pressed={settings.quality === option.value}
                key={option.value}
                onClick={() => onChange({ quality: option.value })}
                title={option.description}
                type='button'
              >
                <QualityIcon aria-hidden='true' />
                <span><strong>{option.label}</strong><small>{option.description}</small></span>
              </button>
            );
          })}
        </div>
      </div>
      {motion ? (
        <div className='shader-lab-v2-export-motion'>
          <label>
            <span><Clock3 aria-hidden='true' />Duration</span>
            <StudioSelect
              ariaLabel='Export duration'
              onValueChange={(value) => onChange({ durationMs: Number(value) })}
              options={[
                { label: '1.2 seconds', value: '1200' },
                { label: '1.6 seconds', value: '1600' },
                { label: '2.4 seconds', value: '2400' },
                { label: '4 seconds', value: '4000' },
              ]}
              value={String(settings.durationMs)}
            />
          </label>
          <label>
            <span><Film aria-hidden='true' />Frame rate</span>
            <StudioSelect
              ariaLabel='Export frame rate'
              onValueChange={(value) => onChange({ fps: Number(value) })}
              options={[12, 15, 24, 30, 60].map((fps) => ({ label: `${fps} FPS`, value: String(fps) }))}
              value={String(settings.fps)}
            />
          </label>
        </div>
      ) : null}
      {format === 'gif' ? (
        <div className='shader-lab-v2-export-quality shader-lab-v2-export-loop'>
          <span><Repeat2 aria-hidden='true' />GIF loop</span>
          <div>
            <button
              aria-pressed={settings.gifLoop === 'seamless'}
              onClick={() => onChange({ gifLoop: 'seamless' })}
              title='Blend and verify the closing frame for a smooth loop.'
              type='button'
            >Seamless</button>
            <button
              aria-pressed={settings.gifLoop === 'raw'}
              onClick={() => onChange({ gifLoop: 'raw' })}
              title='Repeat captured frames without correcting the seam.'
              type='button'
            >Raw motion</button>
          </div>
          <small>{settings.gifLoop === 'seamless'
            ? `Smooth close · ${loopOverlapFrames}-frame overlap verified after render`
            : 'Direct repeat · best for shaders that already loop naturally'}</small>
        </div>
      ) : null}
    </div>
  );
}

function DesignExportWorkspace({
  disabled,
  format,
  onChange,
  onFormatChange,
  ratioOption,
  settings,
}: {
  disabled: boolean;
  format: DesignExportFormat;
  onChange: (patch: Partial<DesignExportSettings>) => void;
  onFormatChange: (format: DesignExportFormat) => void;
  ratioOption: DesignRatioOption;
  settings: DesignExportSettings;
}) {
  const formats: readonly { description: string; icon: typeof ImageDown; label: string; value: DesignExportFormat }[] = [
    { description: 'Transparent image', icon: ImageDown, label: 'PNG', value: 'png' },
    { description: 'Smaller image', icon: FileImage, label: 'JPG', value: 'jpg' },
    { description: 'Looping motion', icon: Film, label: 'GIF', value: 'gif' },
    { description: 'Video', icon: Clapperboard, label: 'MP4', value: 'mp4' },
  ];

  return (
    <div className='shader-export-workspace' aria-busy={disabled}>
      <div className='shader-export-format' aria-label='Export format'>
        {formats.map((option) => {
          const FormatIcon = option.icon;
          return (
            <button
              aria-pressed={format === option.value}
              disabled={disabled}
              key={option.value}
              onClick={() => onFormatChange(option.value)}
              type='button'
            >
              <FormatIcon aria-hidden='true' />
              <span><strong>{option.label}</strong><small>{option.description}</small></span>
            </button>
          );
        })}
      </div>
      <DesignExportControls
        format={format}
        onChange={onChange}
        ratioOption={ratioOption}
        settings={settings}
      />
    </div>
  );
}

function ShaderSequenceControls({
  disabled,
  durationMs,
  materialIds,
  onChange,
  onExport,
  onPreview,
  onShuffle,
  previewing,
  settings,
  targetOptions,
}: {
  disabled: boolean;
  durationMs: number;
  materialIds: readonly LiveMaterialId[];
  onChange: (patch: Partial<DesignShaderSequenceSettings>) => void;
  onExport: () => void;
  onPreview: () => void;
  onShuffle: () => void;
  previewing: boolean;
  settings: DesignShaderSequenceSettings;
  targetOptions: readonly { label: string; value: ShaderLayerId }[];
}) {
  const introCount = Math.max(0, materialIds.length - 1);
  const occurrences = new Map<LiveMaterialId, number>();
  const sequenceItems = materialIds.map((materialId) => {
    const occurrence = (occurrences.get(materialId) ?? 0) + 1;
    occurrences.set(materialId, occurrence);
    return { key: `${materialId}:${occurrence}`, materialId };
  });
  return (
    <div className='shader-lab-v2-sequence-builder'>
      <div className='shader-lab-v2-sequence-summary'>
        <span><Clapperboard aria-hidden='true' /><strong>Shader cuts</strong></span>
        <code>{(durationMs / 1_000).toFixed(1)}s</code>
      </div>
      <p>Keep the composition locked while one background runs through {introCount} cuts and lands on its current shader.</p>
      <div className='shader-lab-v2-sequence-strip studio-scroll-area' aria-label='Shader cut sequence' role='list'>
        {sequenceItems.map(({ key, materialId }, index) => {
          const material = getLiveMaterial(materialId);
          const final = index === materialIds.length - 1;
          return (
            <StudioPreviewTooltip
              description={final
                ? `The sequence lands on ${material.name} and holds for ${(settings.finalHoldMs / 1_000).toFixed(1)} seconds.`
                : `${material.name} appears as cut ${index + 1} in the ${settings.pace} shader progression.`}
              eyebrow={final ? 'Final hold' : `Shader cut ${String(index + 1).padStart(2, '0')}`}
              key={key}
              meta={`${index + 1} of ${materialIds.length} · ${settings.pace} pacing`}
              preview={<img alt='' src={shaderPreviewAssetPath(materialId)} />}
              title={material.name}
            >
              <span aria-label={`${index + 1}. ${material.name}${final ? ', final hold' : ''}`} data-final={final ? 'true' : 'false'} role='listitem' tabIndex={0}>
                <img alt='' src={shaderPreviewAssetPath(materialId)} />
                <i>{final ? 'Hold' : String(index + 1).padStart(2, '0')}</i>
              </span>
            </StudioPreviewTooltip>
          );
        })}
      </div>
      <label className='shader-lab-v2-sequence-field'>
        <span>Background layer</span>
        <StudioSelect
          ariaLabel='Shader sequence background layer'
          disabled={targetOptions.length === 0}
          onValueChange={(value) => onChange({ targetLayerId: value as ShaderLayerId })}
          options={targetOptions}
          value={settings.targetLayerId ?? targetOptions[0]?.value ?? ''}
        />
      </label>
      <div className='shader-lab-v2-export-motion'>
        <label>
          <span><Film aria-hidden='true' />Cuts</span>
          <StudioSelect
            ariaLabel='Shader sequence cut count'
            onValueChange={(value) => onChange({ cutCount: Number(value) })}
            options={[8, 9, 10, 11, 12].map((count) => ({ label: `${count} shaders`, value: String(count) }))}
            value={String(settings.cutCount)}
          />
        </label>
        <label>
          <span><Clock3 aria-hidden='true' />Final hold</span>
          <StudioSelect
            ariaLabel='Shader sequence final hold'
            onValueChange={(value) => onChange({ finalHoldMs: Number(value) })}
            options={[3_000, 4_000, 5_000, 6_000].map((holdMs) => ({ label: `${holdMs / 1_000} seconds`, value: String(holdMs) }))}
            value={String(settings.finalHoldMs)}
          />
        </label>
      </div>
      <div className='shader-lab-v2-sequence-pace' aria-label='Shader cut pacing'>
        {([
          { label: 'Accelerating', value: 'accelerating' },
          { label: 'Even', value: 'even' },
        ] as const).map((option) => (
          <button aria-pressed={settings.pace === option.value} key={option.value} onClick={() => onChange({ pace: option.value })} type='button'>{option.label}</button>
        ))}
      </div>
      <div className='shader-lab-v2-sequence-actions'>
        <button disabled={disabled || targetOptions.length === 0} onClick={onShuffle} type='button'>
          <Repeat2 aria-hidden='true' />
          <span>New cuts</span>
        </button>
        <button disabled={disabled || targetOptions.length === 0} onClick={onPreview} type='button'>
          {previewing ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
          <span>{previewing ? 'Stop preview' : 'Preview cuts'}</span>
        </button>
        <button disabled={disabled || targetOptions.length === 0} onClick={onExport} type='button'>
          <Download aria-hidden='true' />
          <span>Export MP4</span>
        </button>
      </div>
    </div>
  );
}

function ShaderFrameHistoryControl({
  durationMs,
  fps,
  frame,
  onFramePreview,
  onPauseAtFrame,
  onPlay,
  onScrub,
  onScrubPreview,
  playing,
}: {
  durationMs: number;
  fps: number;
  frame: number;
  onFramePreview: (frame: number) => void;
  onPauseAtFrame: (frame: number) => void;
  onPlay: () => void;
  onScrub: (frame: number) => void;
  onScrubPreview: (frame: number) => void;
  playing: boolean;
}) {
  const frames = buildMotionFrames(durationMs, fps);
  const frameCount = frames.length;
  const boundedFrame = resolveMotionFrame(durationMs, fps, frame).index;
  const [displayFrame, setDisplayFrame] = useState(boundedFrame);
  const pendingScrubFrameRef = useRef<number | null>(null);
  const latestScrubFrameRef = useRef<number | null>(null);
  const scrubAnimationFrameRef = useRef(0);
  const previewPlaybackFrame = useEffectEvent(onFramePreview);
  const previewPlaybackTime = useEffectEvent(onScrubPreview);
  const playbackStartFrameRef = useCommittedRef(boundedFrame);

  useEffect(() => {
    if (!playing) setDisplayFrame(boundedFrame);
  }, [boundedFrame, playing]);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now();
    const startFrame = playbackStartFrameRef.current;
    let animationFrame = 0;
    let previousFrame = -1;
    const tick = (now: number) => {
      const nextFrame = resolveLoopedMotionFrame({
        durationMs,
        elapsedMs: now - startedAt,
        fps,
        startFrame,
      }).index;
      if (nextFrame !== previousFrame) {
        previousFrame = nextFrame;
        previewPlaybackFrame(nextFrame);
        previewPlaybackTime(nextFrame);
        setDisplayFrame(nextFrame);
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, [durationMs, fps, playbackStartFrameRef, playing]);

  useEffect(() => () => cancelAnimationFrame(scrubAnimationFrameRef.current), []);

  function scheduleScrub(nextFrame: number) {
    const boundedNextFrame = Math.min(frameCount - 1, Math.max(0, Math.round(nextFrame)));
    setDisplayFrame(boundedNextFrame);
    pendingScrubFrameRef.current = boundedNextFrame;
    latestScrubFrameRef.current = boundedNextFrame;
    if (scrubAnimationFrameRef.current) return;
    scrubAnimationFrameRef.current = requestAnimationFrame(() => {
      scrubAnimationFrameRef.current = 0;
      const previewFrame = pendingScrubFrameRef.current;
      pendingScrubFrameRef.current = null;
      if (previewFrame === null) return;
      onFramePreview(previewFrame);
      onScrubPreview(previewFrame);
    });
  }

  function flushScrub() {
    cancelAnimationFrame(scrubAnimationFrameRef.current);
    scrubAnimationFrameRef.current = 0;
    const nextFrame = pendingScrubFrameRef.current ?? latestScrubFrameRef.current;
    pendingScrubFrameRef.current = null;
    latestScrubFrameRef.current = null;
    if (nextFrame === null) return;
    onFramePreview(nextFrame);
    onScrubPreview(nextFrame);
    onScrub(nextFrame);
  }

  const seconds = resolveMotionFrame(durationMs, fps, displayFrame).timeMs / 1_000;
  return (
    <section className='shader-lab-v2-frame-history' data-canvas-selection-preserve>
      <button
        aria-label={playing ? 'Pause at current shader frame' : 'Play shader history'}
        onClick={() => playing ? onPauseAtFrame(displayFrame) : onPlay()}
        title={playing ? 'Pause at this frame' : 'Resume live shader motion'}
        type='button'
      >
        {playing ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
      </button>
      <div className='shader-lab-v2-frame-history-copy'>
        <span><Clock3 aria-hidden='true' />Motion timeline</span>
        <small>{playing ? 'Live' : 'Selected'} · {seconds.toFixed(2)}s</small>
      </div>
      <StudioRange
        aria-label='Deterministic motion timeline'
        max={frameCount - 1}
        min={0}
        onBlur={flushScrub}
        onInput={(event) => scheduleScrub(Number(event.currentTarget.value))}
        onPointerCancel={flushScrub}
        onPointerDown={() => {
          if (playing) onPauseAtFrame(displayFrame);
        }}
        onPointerUp={flushScrub}
        step={1}
        value={displayFrame}
      />
      <output aria-live='off'>
        <strong>{String(displayFrame + 1).padStart(2, '0')}</strong>
        <span>/ {String(frameCount).padStart(2, '0')}</span>
      </output>
    </section>
  );
}

function CanvasSelectionAssemblyOverlay({
  bounds,
  canvasHeight,
  canvasWidth,
  label,
  stageRef,
}: {
  bounds: CanvasLayerBounds;
  canvasHeight: number;
  canvasWidth: number;
  label: string;
  stageRef: RefObject<HTMLDivElement | null>;
}) {
  const [screenBounds, setScreenBounds] = useState<{
    height: number;
    left: number;
    top: number;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let frame = 0;
    const measure = () => {
      const stageBounds = stage.getBoundingClientRect();
      const next = {
        height: bounds.height / canvasHeight * stageBounds.height,
        left: stageBounds.left + bounds.left / canvasWidth * stageBounds.width,
        top: stageBounds.top + bounds.top / canvasHeight * stageBounds.height,
        width: bounds.width / canvasWidth * stageBounds.width,
      };
      setScreenBounds((current) => current
        && Math.abs(current.height - next.height) < 0.25
        && Math.abs(current.left - next.left) < 0.25
        && Math.abs(current.top - next.top) < 0.25
        && Math.abs(current.width - next.width) < 0.25
        ? current
        : next);
    };
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const viewportStage = stage.closest('.canvas-viewport-stage');
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(stage);
    if (viewportStage) resizeObserver.observe(viewportStage);
    const transformObserver = viewportStage ? new MutationObserver(scheduleMeasure) : null;
    transformObserver?.observe(viewportStage!, { attributeFilter: ['style'], attributes: true });
    document.addEventListener('scroll', scheduleMeasure, { capture: true, passive: true });
    window.addEventListener('resize', scheduleMeasure, { passive: true });
    measure();
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      transformObserver?.disconnect();
      document.removeEventListener('scroll', scheduleMeasure, true);
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [bounds.height, bounds.left, bounds.top, bounds.width, canvasHeight, canvasWidth, stageRef]);

  if (!screenBounds) return null;
  return createPortal(
    <div aria-hidden='true' className='canvas-selection-assembly' data-canvas-selection-preserve style={screenBounds}>
      <span className='canvas-selection-assembly__label'>{label}</span>
    </div>,
    document.body
  );
}

const DEFAULT_LAYER_TRANSFORM: CanvasLayerTransform = { scale: 1, x: 0, y: 0 };
const DEFAULT_CANVAS_SHADER_ID = 'shader-canvas-1' as const satisfies ShaderLayerId;
const DESIGN_LAB_PREVIEW_MAX_PIXEL_COUNT = 120_000;
const DESIGN_LAB_PREVIEW_MIN_PIXEL_COUNT = 48_000;
const DESIGN_LAB_PREVIEW_TOTAL_PIXEL_BUDGET = 300_000;
const DESIGN_LAB_PREVIEW_FRAME_RATE = 60;
const SHADER_LIBRARY_INITIAL_CARD_COUNT = 12;
const SHADER_LIBRARY_CARD_BATCH_SIZE = 24;
const DEFAULT_DESIGN_SHADER_SEQUENCE_SETTINGS: DesignShaderSequenceSettings = {
  ...DEFAULT_SHADER_SEQUENCE_SETTINGS,
  sequenceOffset: 0,
  targetLayerId: DEFAULT_CANVAS_SHADER_ID,
};
const DEFAULT_SHADER_MATERIAL_ID = 'paper-gem-smoke' as const satisfies LiveMaterialId;
const LEGACY_DEFAULT_SHADER_MATERIAL_ID = 'holo-cloth-silk' as const satisfies LiveMaterialId;
const DEFAULT_CANVAS_BACKGROUND = '#111216';
const DEFAULT_LOGO_LAYER_ID = 'logo-brand' as const satisfies LogoLayerId;
const DEFAULT_DESIGN_LAB_LAYER_ORDER = [
  DEFAULT_CANVAS_SHADER_ID,
  DEFAULT_LOGO_LAYER_ID,
] as const satisfies readonly CompositionLayerId[];
const DEFAULT_DESIGN_LAB_SELECTED_LAYER_ID = DEFAULT_CANVAS_SHADER_ID;
const DEFAULT_TEXT_LAYER_TRANSFORM: CanvasLayerTransform = {
  ...DEFAULT_LAYER_TRANSFORM,
  heightScale: 1,
  widthScale: 1,
};
const DEFAULT_TEXT_APPEARANCE: TextAppearanceSettings = {
  color: '#FFFFFF',
  fontRole: 'Display',
  opacity: 1,
  outlineColor: '#000000',
  outlineEnabled: false,
  outlineWidth: 1,
  shadowBlur: 18,
  shadowColor: '#000000',
  shadowEnabled: false,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  shadowOpacity: 35,
  textEffect: { ...DEFAULT_TEXT_EFFECT },
};
const STICKER_IMAGE_APPEARANCE: LogoAppearanceSettings = {
  ...DEFAULT_LOGO_APPEARANCE,
  borderColor: '#FFFFFF',
  borderEnabled: true,
  borderOpacity: 100,
  borderWidth: 7,
  shadowBlur: 18,
  shadowColor: '#000000',
  shadowEnabled: true,
  shadowOffsetX: 0,
  shadowOffsetY: 10,
  shadowOpacity: 34,
};
const STICKER_TEXT_APPEARANCE: Partial<TextAppearanceSettings> = {
  outlineColor: '#FFFFFF',
  outlineEnabled: true,
  outlineWidth: 7,
  shadowBlur: 18,
  shadowColor: '#000000',
  shadowEnabled: true,
  shadowOffsetX: 0,
  shadowOffsetY: 10,
  shadowOpacity: 34,
};

function isTextLayerId(layerId: CompositionLayerId | null): layerId is TextLayerId {
  return layerId?.startsWith('text-') ?? false;
}

function isShaderLayerId(layerId: CompositionLayerId | null): layerId is ShaderLayerId {
  return layerId?.startsWith('shader-') ?? false;
}

function isEffectLayerId(layerId: CompositionLayerId | null): layerId is EffectLayerId {
  return layerId?.startsWith('effect-') ?? false;
}

function isLogoLayerId(layerId: CompositionLayerId | null): layerId is LogoLayerId {
  return layerId?.startsWith('logo-') ?? false;
}

function isAssetLayerId(layerId: CompositionLayerId | null): layerId is AssetLayerId {
  return layerId?.startsWith('asset-') ?? false;
}

function isContentLayerId(layerId: CompositionLayerId | null): layerId is ContentLayerId {
  return isLogoLayerId(layerId) || isTextLayerId(layerId) || isAssetLayerId(layerId);
}

function isCanvasLayerId(layerId: CompositionLayerId | null): layerId is CanvasLayerId {
  return isShaderLayerId(layerId) || isContentLayerId(layerId);
}

function CanvasLayerKindIcon({ layerId, sticker = false }: { layerId: CompositionLayerId; sticker?: boolean }) {
  if (sticker) return <Sticker aria-hidden='true' />;
  if (isShaderLayerId(layerId)) return <Sparkles aria-hidden='true' />;
  if (isEffectLayerId(layerId)) return <Grid3X3 aria-hidden='true' />;
  if (isTextLayerId(layerId)) return <Type aria-hidden='true' />;
  if (isLogoLayerId(layerId)) return <Layers3 aria-hidden='true' />;
  return <ImagePlus aria-hidden='true' />;
}

function isStickerLayer(
  assetLayer: CompositionAsset | null,
  textLayer: CompositionTextLayer | null
): boolean {
  return assetLayer?.kind === 'sticker' || textLayer?.kind === 'sticker';
}

function resolveLayerDockLayers(
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

function resolveLayerDockShader(
  layerId: CompositionLayerId,
  shaderLayer: CompositionShaderLayer | null,
  layerShaders: Partial<Record<ContentLayerId, ShaderApplication>>
): ShaderApplication | null {
  if (shaderLayer) return shaderLayer;
  if (!isContentLayerId(layerId)) return null;
  return layerShaders[layerId] ?? null;
}

function LayerDockStaticPreview({
  effectLayer,
  label,
  onSelect,
  previewUrl,
}: {
  effectLayer: CompositionEffectLayer | null;
  label: string;
  onSelect: () => void;
  previewUrl?: string;
}) {
  let preview: ReactNode = <span aria-hidden='true' />;
  if (effectLayer) preview = <CompositionEffectThumbnail kind={effectLayer.settings.kind} />;
  else if (previewUrl) preview = <img alt='' draggable={false} src={previewUrl} />;
  return (
    <button className='shader-lab-v2-dock-preview-select' aria-label={`Select ${label} preview`} onClick={onSelect} type='button'>
      {preview}
    </button>
  );
}

function layerDockTooltipDescription({
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
  if (effectLayer) return `Converts every visible layer beneath it with the ${effectLayer.settings.kind} effect.`;
  if (isShaderLayerId(layerId) && appliedShader) {
    return `${getLiveMaterial(appliedShader.materialId).name} fills this movable background layer.`;
  }
  if (textLayer) return `Editable text on the canvas${appliedShader ? ` with ${getLiveMaterial(appliedShader.materialId).name} applied` : ''}.`;
  if (isLogoLayerId(layerId)) return `A reusable brand mark${appliedShader ? ` filled with ${getLiveMaterial(appliedShader.materialId).name}` : ''}.`;
  return `An imported image layer${appliedShader ? ` styled with ${getLiveMaterial(appliedShader.materialId).name}` : ''}.`;
}

function LayerDockTooltipPreview({
  appliedShader,
  effectLayer,
  identity,
  previewUrl,
  textAppearance,
  textLayer,
}: {
  appliedShader: ShaderApplication | null;
  effectLayer: CompositionEffectLayer | null;
  identity: BrandIdentity;
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
      {effectLayer ? <CompositionEffectThumbnail kind={effectLayer.settings.kind} /> : null}
      {previewUrl ? <img alt='' draggable={false} src={previewUrl} /> : null}
      {textLayer && textAppearance ? (
        <span
          style={{
            color: textAppearance.color,
            fontFamily: `${JSON.stringify(brandTypographyFamily(identity, textAppearance.fontRole))}, sans-serif`,
            fontWeight: resolveBrandTypographyWeight(identity, textAppearance.fontRole, textLayer.weight),
            letterSpacing: `${textLayer.tracking}em`,
            opacity: textAppearance.opacity,
          }}
        >{textLayer.value || 'Empty text layer'}</span>
      ) : null}
    </div>
  );
}

type DesignLabCompositionSource = {
  canvasDimensions?: Partial<StudioArtboardDimensions>;
  composition: {
    assets?: Array<Partial<CompositionAsset> & Pick<CompositionAsset, 'id'>>;
    backgroundColor?: string;
    effectLayers?: CompositionEffectLayer[];
    groups?: CompositionLayerGroup[];
    layerOrder?: CompositionLayerId[];
    layerShaders?: Partial<Record<ContentLayerId, ShaderApplication>>;
    logos?: Array<Partial<CompositionLogoLayer> & Pick<CompositionLogoLayer, 'id'>>;
    shaderLayers?: CompositionShaderLayer[];
    textLayers?: CompositionTextLayer[];
  };
  exportSettings?: Partial<DesignExportSettings>;
  ratio?: ShaderRatio;
  shaderSequence?: Partial<DesignShaderSequenceSettings>;
  timeline?: { frame?: number; paused?: boolean };
  version?: number;
  workspace?: DesignArtboardWorkspaceSource;
};

function assertOptionalArray<T>(
  value: T[] | undefined,
  label: string,
  isInvalid: (item: T) => boolean
): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some(isInvalid)) throw new TypeError(`${label} are invalid.`);
}

function validateCompositionLayers(composition: DesignLabCompositionSource['composition']): void {
  assertOptionalArray(composition.shaderLayers, 'Shader layers', (layer) => !layer.id?.startsWith('shader-'));
  assertOptionalArray(composition.effectLayers, 'Converter layers', (layer) => !layer.id?.startsWith('effect-'));
  assertOptionalArray(composition.textLayers, 'Text layers', (layer) => !layer.id?.startsWith('text-') || typeof layer.value !== 'string');
  assertOptionalArray(composition.logos, 'Mark layers', (layer) => !layer.id?.startsWith('logo-'));
  assertOptionalArray(composition.assets, 'Image layers', (layer) => !layer.id?.startsWith('asset-'));
  assertOptionalArray(composition.groups, 'Layer groups', (group) => !group.id?.startsWith('group-') || !Array.isArray(group.layerIds));
  assertOptionalArray(composition.layerOrder, 'Layer order', (id) => typeof id !== 'string');
}

function isInvalidWorkspaceArtboard(artboard: DesignArtboard): boolean {
  return !artboard?.id?.startsWith('artboard-')
    || typeof artboard.name !== 'string'
    || !Number.isFinite(artboard.x)
    || !Number.isFinite(artboard.y)
    || !artboard.snapshot
    || !isShaderRatio(artboard.snapshot.ratio)
    || (artboard.snapshot.dimensions !== undefined && (
      !Number.isFinite(artboard.snapshot.dimensions.width)
      || !Number.isFinite(artboard.snapshot.dimensions.height)
    ));
}

function isShaderRatio(value: unknown): value is ShaderRatio {
  return value === 'custom' || RATIO_OPTIONS.some(({ value: option }) => option === value);
}

function validateArtboardWorkspace(workspace: DesignArtboardWorkspaceSource | undefined): void {
  if (workspace?.artboards === undefined) return;
  if (!Array.isArray(workspace.artboards) || workspace.artboards.some(isInvalidWorkspaceArtboard)) {
    throw new TypeError('Artboard workspace is invalid.');
  }
}

function validateCompositionMetadata(parsed: DesignLabCompositionSource): void {
  const { composition } = parsed;
  if (parsed.ratio && !isShaderRatio(parsed.ratio)) throw new TypeError('Unknown canvas ratio.');
  if (parsed.canvasDimensions && (
    !Number.isFinite(parsed.canvasDimensions.width)
    || !Number.isFinite(parsed.canvasDimensions.height)
  )) throw new TypeError('Canvas dimensions are invalid.');
  if (composition.backgroundColor && !/^#[\dA-F]{6}$/i.test(composition.backgroundColor)) throw new TypeError('Canvas background must be a six-digit HEX color.');
  if (parsed.timeline?.frame !== undefined && (!Number.isFinite(parsed.timeline.frame) || parsed.timeline.frame < 0)) throw new TypeError('Motion timeline frame is invalid.');
  if (parsed.shaderSequence?.pace && !['accelerating', 'even'].includes(parsed.shaderSequence.pace)) throw new TypeError('Shader sequence pacing is invalid.');
  if (parsed.shaderSequence?.sequenceOffset !== undefined && !Number.isFinite(parsed.shaderSequence.sequenceOffset)) throw new TypeError('Shader sequence variation is invalid.');
  if (parsed.shaderSequence?.targetLayerId && !parsed.shaderSequence.targetLayerId.startsWith('shader-')) throw new TypeError('Shader sequence target is invalid.');
  validateArtboardWorkspace(parsed.workspace);
}

function parseCompositionSource(source: string): DesignLabCompositionSource {
  const sourceRoot = parseSourceObject(source);
  const parsed = (
    isCanvasDocumentEnvelope(sourceRoot)
      ? parseDesignLabCanvasDocument(source)
      : sourceRoot
  ) as DesignLabCompositionSource;
  if (!parsed?.composition) throw new TypeError('A composition object is required.');
  validateCompositionLayers(parsed.composition);
  validateCompositionMetadata(parsed);
  return parsed;
}

function restoredLogoLayers(
  savedLayers: DesignLabCompositionSource['composition']['logos'],
  currentLayers: readonly CompositionLogoLayer[],
  builtInLogo: string
): CompositionLogoLayer[] {
  if (!savedLayers) {
    return currentLayers.map((layer) => ({
      ...layer,
      appearance: layer.appearance ? { ...layer.appearance } : undefined,
      transform: { ...layer.transform },
    }));
  }
  const currentById = new Map(currentLayers.map((layer) => [layer.id, layer]));
  return savedLayers.map((savedLayer) => {
    const current = currentById.get(savedLayer.id);
    return {
      appearance: savedLayer.appearance ? { ...savedLayer.appearance } : current?.appearance ?? { ...DEFAULT_LOGO_APPEARANCE },
      color: savedLayer.color ?? current?.color ?? '#FFFFFF',
      convertedAssetId: savedLayer.convertedAssetId,
      id: savedLayer.id,
      name: savedLayer.name ?? current?.name ?? 'Brand mark',
      opacity: savedLayer.opacity ?? current?.opacity ?? 1,
      transform: normalizeCanvasLayerTransform(savedLayer.transform, current?.transform ?? DEFAULT_LAYER_TRANSFORM),
      url: savedLayer.url ?? current?.url ?? builtInLogo,
      visible: savedLayer.visible ?? current?.visible ?? true,
    };
  });
}

function restoredImageLayers(
  savedAssets: DesignLabCompositionSource['composition']['assets'],
  currentAssets: readonly CompositionAsset[]
): CompositionAsset[] {
  if (!savedAssets) {
    return currentAssets.map((asset) => ({
      ...asset,
      appearance: asset.appearance ? { ...asset.appearance } : undefined,
      transform: { ...asset.transform },
    }));
  }
  const currentById = new Map(currentAssets.map((asset) => [asset.id, asset]));
  return savedAssets.flatMap((savedAsset) => {
    const current = currentById.get(savedAsset.id);
    const url = savedAsset.url ?? current?.url;
    if (!url) return [];
    const kind = restoredImageLayerKind(savedAsset, current);
    return [{
      appearance: restoredImageLayerAppearance(savedAsset, current),
      id: savedAsset.id,
      kind,
      libraryAssetId: savedAsset.libraryAssetId ?? current?.libraryAssetId,
      name: savedAsset.name ?? current?.name ?? 'Image',
      opacity: savedAsset.opacity ?? current?.opacity ?? 1,
      stickerFinish: restoredStickerFinish(kind, savedAsset.stickerFinish ?? current?.stickerFinish),
      transform: normalizeCanvasLayerTransform(savedAsset.transform, current?.transform ?? DEFAULT_LAYER_TRANSFORM),
      url,
      visible: savedAsset.visible ?? current?.visible ?? true,
    }];
  });
}

function restoredImageLayerAppearance(
  savedAsset: Partial<CompositionAsset>,
  current: CompositionAsset | undefined
): LogoAppearanceSettings {
  if (savedAsset.appearance) return { ...savedAsset.appearance };
  return current?.appearance ?? { ...DEFAULT_LOGO_APPEARANCE };
}

function restoredImageLayerKind(
  savedAsset: Partial<CompositionAsset>,
  current: CompositionAsset | undefined
): ImageAssetPlacementMode {
  if (savedAsset.kind === 'sticker') return 'sticker';
  return current?.kind === 'sticker' ? 'sticker' : 'image';
}

function restoredStickerFinish(
  kind: ImageAssetPlacementMode,
  value?: Partial<StickerFinishSettings>
): StickerFinishSettings | undefined {
  return kind === 'sticker' ? normalizeStickerFinish(value) : undefined;
}

function restoredLayerShaders(
  savedShaders: DesignLabCompositionSource['composition']['layerShaders'] | undefined,
  currentShaders: Partial<Record<ContentLayerId, ShaderApplication>>,
  allowedIds: ReadonlySet<CompositionLayerId>
): Partial<Record<ContentLayerId, ShaderApplication>> {
  const restored: Partial<Record<ContentLayerId, ShaderApplication>> = {};
  for (const [id, application] of Object.entries(savedShaders ?? currentShaders)) {
    const layerId = id as CompositionLayerId;
    if (!allowedIds.has(layerId) || !isContentLayerId(layerId)) continue;
    restored[layerId] = application ? {
        ...application,
        settings: { ...application.settings },
        shaderSize: clampShaderZoom(application.shaderSize),
      } : application;
  }
  return restored;
}

function restoredShaderLayers(
  savedLayers: readonly CompositionShaderLayer[] | undefined,
  currentLayers: readonly CompositionShaderLayer[],
  targetLayerId: ShaderLayerId | null | undefined
): CompositionShaderLayer[] {
  const layers = (savedLayers ?? currentLayers).map((layer) => ({
    ...layer,
    settings: { ...layer.settings },
    shaderSize: clampShaderZoom(layer.shaderSize),
    transform: normalizeCanvasLayerTransform(layer.transform, DEFAULT_LAYER_TRANSFORM),
  }));
  if (targetLayerId && !layers.some(({ id }) => id === targetLayerId)) {
    throw new TypeError('Shader sequence target layer does not exist.');
  }
  return layers;
}

function restoredShaderSequence(
  saved: Partial<DesignShaderSequenceSettings> | undefined,
  layers: readonly CompositionShaderLayer[],
  current: DesignShaderSequenceSettings
): DesignShaderSequenceSettings {
  if (!saved) return current;
  return {
    ...normalizeShaderSequenceSettings(saved),
    sequenceOffset: Math.max(0, Math.round(saved.sequenceOffset ?? current.sequenceOffset)),
    targetLayerId: saved.targetLayerId
      ?? layers.find(({ visible }) => visible)?.id
      ?? layers[0]?.id
      ?? null,
  };
}

function restoredLayerOrder({
  assets,
  effects,
  logos,
  requested,
  shaders,
  text,
}: {
  assets: readonly CompositionAsset[];
  effects: readonly CompositionEffectLayer[];
  logos: readonly CompositionLogoLayer[];
  requested: readonly CompositionLayerId[];
  shaders: readonly CompositionShaderLayer[];
  text: readonly CompositionTextLayer[];
}): CompositionLayerId[] {
  return reconcileDesignLabLayerOrder({
    assets: assets.map(({ id }) => id),
    effects: effects.map(({ id }) => id),
    logos: logos.map(({ id }) => id),
    shaders: shaders.map(({ id }) => id),
    stored: requested,
    text: text.map(({ id }) => id),
  }) as CompositionLayerId[];
}

function resolvedTextTransform(transform: CanvasLayerTransform): CanvasLayerTransform {
  return {
    ...transform,
    heightScale: transform.heightScale ?? 1,
    widthScale: transform.widthScale ?? 1,
  };
}

function resolvedTextAppearance(layer: CompositionTextLayer): TextAppearanceSettings {
  return {
    color: layer.color ?? DEFAULT_TEXT_APPEARANCE.color,
    fontRole: layer.fontRole ?? DEFAULT_TEXT_APPEARANCE.fontRole,
    opacity: layer.opacity ?? DEFAULT_TEXT_APPEARANCE.opacity,
    outlineColor: layer.outlineColor ?? DEFAULT_TEXT_APPEARANCE.outlineColor,
    outlineEnabled: layer.outlineEnabled ?? DEFAULT_TEXT_APPEARANCE.outlineEnabled,
    outlineWidth: layer.outlineWidth ?? DEFAULT_TEXT_APPEARANCE.outlineWidth,
    shadowBlur: layer.shadowBlur ?? DEFAULT_TEXT_APPEARANCE.shadowBlur,
    shadowColor: layer.shadowColor ?? DEFAULT_TEXT_APPEARANCE.shadowColor,
    shadowEnabled: layer.shadowEnabled ?? DEFAULT_TEXT_APPEARANCE.shadowEnabled,
    shadowOffsetX: layer.shadowOffsetX ?? DEFAULT_TEXT_APPEARANCE.shadowOffsetX,
    shadowOffsetY: layer.shadowOffsetY ?? DEFAULT_TEXT_APPEARANCE.shadowOffsetY,
    shadowOpacity: layer.shadowOpacity ?? DEFAULT_TEXT_APPEARANCE.shadowOpacity,
    textEffect: resolveTextEffectSettings(layer.textEffect),
  };
}

function resolvedLogoAppearance(settings?: LogoAppearanceSettings): LogoAppearanceSettings {
  return { ...DEFAULT_LOGO_APPEARANCE, ...settings };
}

function colorWithOpacity(color: string, opacity: number): string {
  const hex = color.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const value = Number.parseInt(hex, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

function scrollLayerDockWithWheel(event: ReactWheelEvent<HTMLDivElement>) {
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

function textShadowStyle(settings: TextAppearanceSettings): string | undefined {
  if (!settings.shadowEnabled) return undefined;
  return `${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${colorWithOpacity(settings.shadowColor, settings.shadowOpacity / 100)}`;
}

function CanvasEditableText({
  className,
  label,
  onChange,
  onFocus,
  style,
  value,
}: {
  className: string;
  label: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  style: CSSProperties;
  value: string;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const onChangeRef = useCommittedRef(onChange);
  const pendingValueRef = useRef<string | null>(null);
  const commitTimerRef = useRef(0);

  function flushTextChange() {
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = 0;
    const nextValue = pendingValueRef.current;
    pendingValueRef.current = null;
    if (nextValue !== null) onChangeRef.current(nextValue);
  }

  function scheduleTextChange(nextValue: string) {
    pendingValueRef.current = nextValue;
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = window.setTimeout(flushTextChange, 140);
  }

  useLayoutEffect(() => {
    const text = textRef.current;
    if (!text || document.activeElement === text || text.innerText === value) return;
    text.innerText = value;
  }, [value]);

  useEffect(() => () => window.clearTimeout(commitTimerRef.current), []);

  return (
    <span
      aria-label={label}
      aria-multiline='true'
      className={className}
      contentEditable='plaintext-only'
      data-canvas-editable='true'
      onBlur={(event) => {
        pendingValueRef.current = event.currentTarget.innerText.replace(/\r\n/g, '\n');
        flushTextChange();
      }}
      onFocus={onFocus}
      onInput={(event) => scheduleTextChange(event.currentTarget.innerText.replace(/\r\n/g, '\n'))}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') event.currentTarget.blur();
      }}
      onPointerDown={(event) => {
        if (isAdditiveCanvasSelection(event)) {
          event.preventDefault();
          return;
        }
        event.stopPropagation();
      }}
      ref={textRef}
      role='textbox'
      spellCheck
      style={style}
      suppressContentEditableWarning
      tabIndex={0}
    />
  );
}

function InspectorTextArea({
  ariaLabel,
  onChange,
  onPreview,
  value,
}: {
  ariaLabel: string;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
  value: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const onChangeRef = useCommittedRef(onChange);
  const onPreviewRef = useCommittedRef(onPreview);
  const pendingValueRef = useRef<string | null>(null);
  const commitTimerRef = useRef(0);

  function flushTextChange() {
    window.clearTimeout(commitTimerRef.current);
    commitTimerRef.current = 0;
    const nextValue = pendingValueRef.current;
    pendingValueRef.current = null;
    if (nextValue !== null) onChangeRef.current(nextValue);
  }

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || document.activeElement === input || input.value === value) return;
    input.value = value;
  }, [value]);

  useEffect(() => () => window.clearTimeout(commitTimerRef.current), []);

  return (
    <textarea
      aria-label={ariaLabel}
      defaultValue={value}
      onBlur={(event) => {
        pendingValueRef.current = event.currentTarget.value;
        flushTextChange();
      }}
      onInput={(event) => {
        pendingValueRef.current = event.currentTarget.value;
        onPreviewRef.current?.(event.currentTarget.value);
        window.clearTimeout(commitTimerRef.current);
        commitTimerRef.current = window.setTimeout(flushTextChange, 140);
      }}
      placeholder='Type something'
      ref={inputRef}
      rows={2}
    />
  );
}

function layerGeometry(layerId: CanvasLayerId, canvas: StudioArtboardDimensions): LayerGeometry {
  if (isShaderLayerId(layerId)) {
    return {
      baseHeight: canvas.height,
      baseWidth: canvas.width,
      baseX: 0,
      baseY: 0,
    };
  }
  if (isTextLayerId(layerId)) {
    const baseWidth = canvas.width * 0.72;
    const baseHeight = canvas.height * 0.25;
    return {
      baseHeight,
      baseWidth,
      baseX: (canvas.width - baseWidth) / 2,
      baseY: (canvas.height - baseHeight) / 2,
    };
  }
  if (isLogoLayerId(layerId)) {
    const baseWidth = canvas.width * 0.42;
    const baseHeight = canvas.height * 0.32;
    return {
      baseHeight,
      baseWidth,
      baseX: (canvas.width - baseWidth) / 2,
      baseY: (canvas.height - baseHeight) / 2,
    };
  }
  const baseWidth = canvas.width * 0.34;
  const baseHeight = canvas.height * 0.38;
  return {
    baseHeight,
    baseWidth,
    baseX: (canvas.width - baseWidth) / 2,
    baseY: (canvas.height - baseHeight) / 2,
  };
}

const PRIMARY_CONTROLS: readonly {
  key: keyof Pick<LiveMaterialSettings, 'speed' | 'frequency' | 'strength' | 'detail' | 'grain' | 'brightness'>;
  label: string;
  max: number;
  min: number;
  step: number;
}[] = [
  { key: 'speed', label: 'Shader speed', max: 1.5, min: 0, step: 0.01 },
  { key: 'frequency', label: 'Frequency', max: 12, min: 0.5, step: 0.1 },
  { key: 'strength', label: 'Warp', max: 1.5, min: 0, step: 0.01 },
  { key: 'detail', label: 'Detail', max: 9, min: 0.5, step: 0.1 },
  { key: 'grain', label: 'Texture', max: 100, min: 0, step: 1 },
  { key: 'brightness', label: 'Light', max: 1.6, min: 0.35, step: 0.01 },
];

const ADVANCED_CONTROLS: readonly {
  key: keyof Pick<LiveMaterialSettings, 'amplitude' | 'density' | 'rotationZ'>;
  label: string;
  max: number;
  min: number;
  step: number;
}[] = [
  { key: 'amplitude', label: 'Amplitude', max: 10, min: 0, step: 0.1 },
  { key: 'density', label: 'Density', max: 2, min: 0.1, step: 0.01 },
  { key: 'rotationZ', label: 'Rotation', max: 180, min: -180, step: 1 },
];

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => ({
    '"': '&quot;',
    '&': '&amp;',
    "'": '&apos;',
    '<': '&lt;',
    '>': '&gt;',
  })[character] ?? character);
}

function monogramDataUrl(identity: Pick<BrandIdentity, 'shortName'>): string {
  const label = escapeXml(identity.shortName.slice(0, 3).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320"><text x="320" y="214" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="164" font-weight="700">${label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function paintFallback(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: LiveMaterialSettings
) {
  const gradient = context.createLinearGradient(0, height, width, 0);
  gradient.addColorStop(0, settings.colorA);
  gradient.addColorStop(0.52, settings.colorB);
  gradient.addColorStop(1, settings.colorC);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

function shaderApplicationFor(
  materialId: LiveMaterialId,
  colors: readonly [string, string, string] | readonly string[],
  overrides: Partial<Pick<ShaderApplication, 'blendMode' | 'opacity' | 'shaderSize'>> = {}
): ShaderApplication {
  return {
    blendMode: overrides.blendMode ?? 'normal',
    materialId,
    opacity: overrides.opacity ?? 1,
    settings: shaderLabSettingsFor(materialId, {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: colors[0] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorA,
      colorB: colors[1] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorB,
      colorC: colors[2] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorC,
    }),
    shaderSize: clampShaderZoom(overrides.shaderSize ?? 1),
  };
}

function shaderBlendStyle(blendMode: ShaderBlendMode): CSSProperties['mixBlendMode'] {
  return blendMode === 'normal' ? 'normal' : blendMode;
}

function RangeControl({
  formatValue,
  label,
  max,
  min,
  onChange,
  onPreview,
  step,
  value,
}: {
  formatValue?: (value: number) => string;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onPreview?: (value: number) => void;
  step: number;
  value: number;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const pendingValueRef = useRef<number | null>(null);
  const latestValueRef = useRef<number | null>(null);
  const valueFrameRef = useRef(0);
  const scrubbingRef = useRef(false);

  useEffect(() => {
    if (!scrubbingRef.current && pendingValueRef.current === null && valueFrameRef.current === 0) {
      setDisplayValue(value);
    }
  }, [value]);

  useEffect(() => () => cancelAnimationFrame(valueFrameRef.current), []);

  function flushValue() {
    cancelAnimationFrame(valueFrameRef.current);
    valueFrameRef.current = 0;
    const nextValue = pendingValueRef.current ?? latestValueRef.current;
    pendingValueRef.current = null;
    latestValueRef.current = null;
    if (nextValue === null) return;
    onPreview?.(nextValue);
    onChange(nextValue);
  }

  function scheduleValue(nextValue: number) {
    setDisplayValue(nextValue);
    pendingValueRef.current = nextValue;
    latestValueRef.current = nextValue;
    if (valueFrameRef.current) return;
    valueFrameRef.current = requestAnimationFrame(() => {
      valueFrameRef.current = 0;
      if (pendingValueRef.current === null) return;
      const previewValue = pendingValueRef.current;
      pendingValueRef.current = null;
      (onPreview ?? onChange)(previewValue);
    });
  }

  return (
    <label className='shader-lab-v2-range'>
      <StudioRangeLabel
        label={label}
        value={<output>{formatValue?.(displayValue) ?? (Number.isInteger(step) ? Math.round(displayValue) : displayValue.toFixed(2))}</output>}
      />
      <StudioRange
        aria-label={label}
        max={max}
        min={min}
        onBlur={() => {
          scrubbingRef.current = false;
          flushValue();
        }}
        onInput={(event) => scheduleValue(Number(event.currentTarget.value))}
        onPointerCancel={() => {
          scrubbingRef.current = false;
          flushValue();
        }}
        onPointerDown={() => { scrubbingRef.current = true; }}
        onPointerUp={() => {
          scrubbingRef.current = false;
          flushValue();
        }}
        step={step}
        value={displayValue}
      />
    </label>
  );
}

function ShaderZoomControl({
  onChange,
  onPreview,
  value,
}: {
  onChange: (value: number) => void;
  onPreview?: (value: number) => void;
  value: number;
}) {
  const zoom = clampShaderZoom(value);
  const [sliderValue, setSliderValue] = useState(() => shaderZoomToSlider(zoom));
  const [zoomEntry, setZoomEntry] = useState(() => formatShaderZoom(zoom).slice(0, -1));
  const pendingZoomRef = useRef<number | null>(null);
  const latestZoomRef = useRef<number | null>(null);
  const zoomFrameRef = useRef(0);
  const scrubbingRef = useRef(false);
  const editingEntryRef = useRef(false);

  useEffect(() => {
    if (!scrubbingRef.current && pendingZoomRef.current === null && zoomFrameRef.current === 0) {
      setSliderValue(shaderZoomToSlider(zoom));
      if (!editingEntryRef.current) setZoomEntry(formatShaderZoom(zoom).slice(0, -1));
    }
  }, [zoom]);

  useEffect(() => () => cancelAnimationFrame(zoomFrameRef.current), []);

  function flushZoom() {
    cancelAnimationFrame(zoomFrameRef.current);
    zoomFrameRef.current = 0;
    const nextZoom = pendingZoomRef.current ?? latestZoomRef.current;
    pendingZoomRef.current = null;
    latestZoomRef.current = null;
    if (nextZoom === null) return;
    onPreview?.(nextZoom);
    onChange(nextZoom);
  }

  function scheduleZoom(nextSliderValue: number) {
    setSliderValue(nextSliderValue);
    const nextZoom = shaderZoomFromSlider(nextSliderValue);
    setZoomEntry(formatShaderZoom(nextZoom).slice(0, -1));
    pendingZoomRef.current = nextZoom;
    latestZoomRef.current = nextZoom;
    if (zoomFrameRef.current) return;
    zoomFrameRef.current = requestAnimationFrame(() => {
      zoomFrameRef.current = 0;
      if (pendingZoomRef.current === null) return;
      const nextZoom = pendingZoomRef.current;
      pendingZoomRef.current = null;
      (onPreview ?? onChange)(nextZoom);
    });
  }

  function applyZoom(nextValue: number) {
    cancelAnimationFrame(zoomFrameRef.current);
    zoomFrameRef.current = 0;
    pendingZoomRef.current = null;
    latestZoomRef.current = null;
    scrubbingRef.current = false;
    const nextZoom = clampShaderZoom(nextValue);
    setSliderValue(shaderZoomToSlider(nextZoom));
    setZoomEntry(formatShaderZoom(nextZoom).slice(0, -1));
    onPreview?.(nextZoom);
    onChange(nextZoom);
  }

  function commitZoomEntry() {
    editingEntryRef.current = false;
    const nextZoom = Number(zoomEntry);
    if (!Number.isFinite(nextZoom) || nextZoom <= 0) {
      setZoomEntry(formatShaderZoom(zoom).slice(0, -1));
      return;
    }
    applyZoom(nextZoom);
  }

  return (
    <div className='shader-lab-v2-range shader-lab-v2-zoom-control'>
      <StudioRangeLabel
        label='Shader zoom'
        value={(
          <span className='shader-lab-v2-zoom-value'>
            <input
              aria-label='Shader zoom value'
              inputMode='decimal'
              max={SHADER_ZOOM_MAX}
              min={SHADER_ZOOM_MIN}
              onBlur={commitZoomEntry}
              onChange={(event) => setZoomEntry(event.target.value)}
              onFocus={() => { editingEntryRef.current = true; }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur();
                if (event.key === 'Escape') {
                  setZoomEntry(formatShaderZoom(zoom).slice(0, -1));
                  event.currentTarget.blur();
                }
              }}
              step={0.05}
              type='number'
              value={zoomEntry}
            />
            <span aria-hidden='true'>×</span>
          </span>
        )}
      />
      <div className='shader-lab-v2-zoom-input'>
        <button
          aria-label='Zoom shader out'
          disabled={zoom <= 0.1}
          onClick={() => applyZoom(stepShaderZoom(zoom, -1))}
          title='Zoom shader out'
          type='button'
        ><ZoomOut aria-hidden='true' /></button>
        <StudioRange
          aria-label='Shader zoom slider'
          max={SHADER_ZOOM_SLIDER_MAX}
          min={SHADER_ZOOM_SLIDER_MIN}
          onBlur={() => {
            scrubbingRef.current = false;
            flushZoom();
          }}
          onInput={(event) => scheduleZoom(Number(event.currentTarget.value))}
          onPointerCancel={() => {
            scrubbingRef.current = false;
            flushZoom();
          }}
          onPointerDown={() => { scrubbingRef.current = true; }}
          onPointerUp={() => {
            scrubbingRef.current = false;
            flushZoom();
          }}
          step={SHADER_ZOOM_SLIDER_STEP}
          value={sliderValue}
        />
        <button
          aria-label='Zoom shader in'
          disabled={zoom >= 10}
          onClick={() => applyZoom(stepShaderZoom(zoom, 1))}
          title='Zoom shader in'
          type='button'
        ><ZoomIn aria-hidden='true' /></button>
      </div>
      <div aria-hidden='true' className='shader-lab-v2-zoom-scale'>
        <span>0.1×</span><span>1×</span><span>10×</span>
      </div>
    </div>
  );
}

function DesignLabEffectInspector({
  previewEffectLayer,
  selectEffectPreset,
  selectedEffectLayer,
  updateEffectLayer,
}: {
  previewEffectLayer: (
    id: EffectLayerId,
    update: { opacity?: number; settings?: Partial<CompositionEffectSettings> }
  ) => void;
  selectEffectPreset: (layer: CompositionEffectLayer, kind: CompositionEffectKind) => void;
  selectedEffectLayer: CompositionEffectLayer;
  updateEffectLayer: (
    id: EffectLayerId,
    update: Partial<Omit<CompositionEffectLayer, 'id'>>
  ) => void;
}) {
  return <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-effect-inspector' meta='Post-process' title='Converter'>
    <div className='shader-lab-v2-effect-presets' aria-label='Converter type'>
      {COMPOSITION_EFFECT_PRESETS.map((preset) => (
        <button
          aria-pressed={selectedEffectLayer.settings.kind === preset.kind}
          key={preset.kind}
          onClick={() => selectEffectPreset(selectedEffectLayer, preset.kind)}
          type='button'
        >
          <CompositionEffectThumbnail kind={preset.kind} />
          <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
        </button>
      ))}
    </div>
    <div className='shader-lab-v2-ranges'>
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Layer opacity'
        max={1}
        min={0}
        onChange={(opacity) => updateEffectLayer(selectedEffectLayer.id, { opacity })}
        onPreview={(opacity) => previewEffectLayer(selectedEffectLayer.id, { opacity })}
        step={0.01}
        value={selectedEffectLayer.opacity}
      />
      <RangeControl
        formatValue={(value) => `${Math.round(value)}px`}
        label='Cell size'
        max={28}
        min={selectedEffectLayer.settings.kind === 'ascii' ? 7 : selectedEffectLayer.settings.kind === 'halftone' ? 4 : 1}
        onChange={(cellSize) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, cellSize },
        })}
        onPreview={(cellSize) => previewEffectLayer(selectedEffectLayer.id, { settings: { cellSize } })}
        step={1}
        value={selectedEffectLayer.settings.cellSize}
      />
      <RangeControl
        formatValue={(value) => `${value.toFixed(2)}×`}
        label='Contrast'
        max={2.4}
        min={0.4}
        onChange={(contrast) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, contrast },
        })}
        onPreview={(contrast) => previewEffectLayer(selectedEffectLayer.id, { settings: { contrast } })}
        step={0.02}
        value={selectedEffectLayer.settings.contrast}
      />
      <RangeControl
        formatValue={(value) => `${value >= 0.5 ? '+' : ''}${Math.round((value - 0.5) * 200)}%`}
        label='Brightness'
        max={1}
        min={0}
        onChange={(threshold) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, threshold },
        })}
        onPreview={(threshold) => previewEffectLayer(selectedEffectLayer.id, { settings: { threshold } })}
        step={0.01}
        value={selectedEffectLayer.settings.threshold}
      />
      {selectedEffectLayer.settings.kind === 'posterize' ? (
        <RangeControl
          formatValue={(value) => `${Math.round(value)} tones`}
          label='Tone count'
          max={8}
          min={2}
          onChange={(levels) => updateEffectLayer(selectedEffectLayer.id, {
            settings: { ...selectedEffectLayer.settings, levels },
          })}
          onPreview={(levels) => previewEffectLayer(selectedEffectLayer.id, { settings: { levels } })}
          step={1}
          value={selectedEffectLayer.settings.levels}
        />
      ) : null}
    </div>
    <div className='shader-lab-v2-effect-colors'>
      <ColorControl
        ariaLabel='Converter foreground color'
        label='Foreground'
        onChange={(foreground) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, foreground },
        })}
        onPreview={(foreground) => previewEffectLayer(selectedEffectLayer.id, { settings: { foreground } })}
        value={selectedEffectLayer.settings.foreground}
      />
      <ColorControl
        ariaLabel='Converter background color'
        label='Background'
        onChange={(background) => updateEffectLayer(selectedEffectLayer.id, {
          settings: { ...selectedEffectLayer.settings, background },
        })}
        onPreview={(background) => previewEffectLayer(selectedEffectLayer.id, { settings: { background } })}
        value={selectedEffectLayer.settings.background}
      />
    </div>
    <div className='shader-lab-v2-effect-group'>
      <label>
        <span>Invert luminance</span>
        <StudioCheckbox
          checked={selectedEffectLayer.settings.invert}
          onChange={(event) => updateEffectLayer(selectedEffectLayer.id, {
            settings: { ...selectedEffectLayer.settings, invert: event.target.checked },
          })}
        />
      </label>
    </div>
  </LabInspectorSection>;
}

const ShaderMaterialCard = memo(function ShaderMaterialCard({
  material,
  onSelect,
  selected,
}: {
  material: LiveMaterialOption;
  onSelect: (materialId: LiveMaterialId) => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className='shader-lab-v2-material-card'
      onClick={() => onSelect(material.id)}
      type='button'
    >
      <span className='shader-lab-v2-material-preview'>
        <AuthenticShaderPreview materialId={material.id} />
        <LiveMaterialSourceTag material={material} />
      </span>
      <span className='shader-lab-v2-material-copy'>
        <strong>{material.name}</strong>
      </span>
    </button>
  );
});

function selectedCanvasLayerElement(selectedLayerCount: number): HTMLElement | null {
  if (selectedLayerCount !== 1) return null;
  return document.querySelector<HTMLElement>('.editable-canvas-layer[aria-pressed="true"]');
}

function syncSelectedCanvasLayerOverlay(layer: HTMLElement) {
  const overlay = document.querySelector<HTMLElement>('.editable-canvas-layer-selection');
  if (!overlay) return;
  const bounds = layer.getBoundingClientRect();
  overlay.style.left = `${bounds.left}px`;
  overlay.style.top = `${bounds.top}px`;
  overlay.style.width = `${bounds.width}px`;
  overlay.style.height = `${bounds.height}px`;
}

function previewSelectedTextStyle(
  selectedLayerCount: number,
  property: keyof CSSStyleDeclaration,
  value: string
) {
  const layer = selectedCanvasLayerElement(selectedLayerCount);
  const text = layer?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
  if (!text) return;
  Reflect.set(text.style, property, value);
}

function dataTransferHasFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files');
}

function layerKind(id: CompositionLayerId) {
  if (isShaderLayerId(id)) return 'Shader';
  if (isEffectLayerId(id)) return 'Converter';
  if (isLogoLayerId(id)) return 'Brand mark';
  if (isTextLayerId(id)) return 'Editable text';
  return 'Image';
}

function drawContained(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  context.drawImage(
    source,
    x + (width - renderedWidth) / 2,
    y + (height - renderedHeight) / 2,
    renderedWidth,
    renderedHeight
  );
}

function createContainedLayer(
  image: HTMLImageElement,
  width: number,
  height: number,
  color?: string,
  fillFrame = false
) {
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.round(width));
  layer.height = Math.max(1, Math.round(height));
  const layerContext = layer.getContext('2d');
  if (!layerContext) return layer;
  if (fillFrame) {
    layerContext.drawImage(image, 0, 0, layer.width, layer.height);
  } else {
    const bounds = previewContainedImageBounds({
      boxHeight: layer.height,
      boxWidth: layer.width,
      imageHeight: image.naturalHeight || 1,
      imageWidth: image.naturalWidth || 1,
    });
    drawContained(
      layerContext,
      image,
      image.naturalWidth || 1,
      image.naturalHeight || 1,
      bounds.x,
      bounds.y,
      bounds.width,
      bounds.height
    );
  }
  if (color) {
    layerContext.globalCompositeOperation = 'source-in';
    layerContext.fillStyle = color;
    layerContext.fillRect(0, 0, layer.width, layer.height);
  }
  return layer;
}

function resetTextEffectContext(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const scratchContext = canvas.getContext('2d');
  if (!scratchContext) return null;
  scratchContext.setTransform(1, 0, 0, 1, 0, 0);
  scratchContext.clearRect(0, 0, width, height);
  scratchContext.filter = 'none';
  scratchContext.globalAlpha = 1;
  scratchContext.globalCompositeOperation = 'source-over';
  scratchContext.shadowBlur = 0;
  scratchContext.shadowColor = 'transparent';
  scratchContext.shadowOffsetX = 0;
  scratchContext.shadowOffsetY = 0;
  return scratchContext;
}

type OutputLayerBox = { height: number; width: number; x: number; y: number };
type PaintTextLines = (target: CanvasRenderingContext2D, mode: 'fill' | 'stroke') => void;

function paintSolidDesignLabText(
  context: CanvasRenderingContext2D,
  appearance: TextAppearanceSettings,
  pattern: CanvasPattern | null,
  paintTextLines: PaintTextLines
) {
  context.fillStyle = pattern ?? appearance.color;
  if (appearance.shadowEnabled) {
    context.shadowBlur = appearance.shadowBlur;
    context.shadowColor = colorWithOpacity(appearance.shadowColor, appearance.shadowOpacity / 100);
    context.shadowOffsetX = appearance.shadowOffsetX;
    context.shadowOffsetY = appearance.shadowOffsetY;
  }
  if (appearance.outlineEnabled) paintTextLines(context, 'stroke');
  paintTextLines(context, 'fill');
}

function paintDesignLabTextShadow({
  appearance,
  context,
  height,
  paintTextLines,
  shadowLayer,
  width,
}: {
  appearance: TextAppearanceSettings;
  context: CanvasRenderingContext2D;
  height: number;
  paintTextLines: PaintTextLines;
  shadowLayer: HTMLCanvasElement;
  width: number;
}) {
  if (!appearance.shadowEnabled) return;
  const shadowContext = resetTextEffectContext(shadowLayer, width, height);
  if (!shadowContext) return;
  const shadowColor = colorWithOpacity(appearance.shadowColor, appearance.shadowOpacity / 100);
  shadowContext.fillStyle = shadowColor;
  shadowContext.shadowBlur = appearance.shadowBlur;
  shadowContext.shadowColor = shadowColor;
  shadowContext.shadowOffsetX = appearance.shadowOffsetX;
  shadowContext.shadowOffsetY = appearance.shadowOffsetY;
  paintTextLines(shadowContext, 'fill');
  shadowContext.globalCompositeOperation = 'destination-out';
  shadowContext.shadowColor = 'transparent';
  shadowContext.shadowBlur = 0;
  shadowContext.shadowOffsetX = 0;
  shadowContext.shadowOffsetY = 0;
  paintTextLines(shadowContext, 'fill');
  context.drawImage(shadowLayer, 0, 0);
}

function paintDesignLabTextEffectFill({
  appearance,
  box,
  canvasWidth,
  context,
  fillLayer,
  height,
  materialLayer,
  paintTextLines,
  textMask,
  width,
}: {
  appearance: TextAppearanceSettings;
  box: OutputLayerBox;
  canvasWidth: number;
  context: CanvasRenderingContext2D;
  fillLayer: HTMLCanvasElement;
  height: number;
  materialLayer: HTMLCanvasElement | null;
  paintTextLines: PaintTextLines;
  textMask: HTMLCanvasElement;
  width: number;
}) {
  const textMaskContext = resetTextEffectContext(textMask, width, height);
  const fillContext = resetTextEffectContext(fillLayer, width, height);
  if (!textMaskContext || !fillContext) return;
  if (appearance.textEffect.kind !== 'gradient') {
    context.fillStyle = appearance.textEffect.backgroundColor;
    paintTextLines(context, 'fill');
  }
  textMaskContext.fillStyle = '#FFFFFF';
  paintTextLines(textMaskContext, 'fill');
  applyTextEffectMask(textMaskContext, box, appearance.textEffect, width / canvasWidth);
  if (materialLayer) {
    fillContext.drawImage(materialLayer, box.x, box.y, box.width, box.height);
    fillContext.globalCompositeOperation = 'color';
  }
  fillContext.fillStyle = appearance.textEffect.kind === 'gradient'
    ? createTextEffectGradient(fillContext, box, appearance.textEffect, appearance.color)
    : appearance.color;
  fillContext.fillRect(box.x, box.y, box.width, box.height);
  fillContext.globalCompositeOperation = 'destination-in';
  fillContext.drawImage(textMask, 0, 0);
  context.drawImage(fillLayer, 0, 0);
}

function paintDesignLabTextLayer({
  application,
  box,
  canvasWidth,
  context,
  height,
  identity,
  layer,
  paintShaderApplication,
  textEffectScratch,
  width,
}: {
  application?: ShaderApplication;
  box: OutputLayerBox;
  canvasWidth: number;
  context: CanvasRenderingContext2D;
  height: number;
  identity: BrandIdentity;
  layer: CompositionTextLayer;
  paintShaderApplication: (
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    instanceKey: string,
    application: ShaderApplication
  ) => void;
  textEffectScratch: TextEffectRenderScratch;
  width: number;
}) {
  if (!layer.value) return;
  const transform = resolvedTextTransform(layer.transform);
  const appearance = resolvedTextAppearance(layer);
  context.save();
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  const fontSize = Math.max(18, height * 0.17 * transform.scale);
  const lineHeight = fontSize * layer.lineHeight;
  const spacing = layer.tracking * fontSize;
  const fontWeight = resolveBrandTypographyWeight(identity, appearance.fontRole, layer.weight);
  const fontFamily = `${JSON.stringify(brandTypographyFamily(identity, appearance.fontRole))}, Arial, sans-serif`;
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.fontKerning = 'normal';
  const supportsNativeLetterSpacing = typeof context.letterSpacing === 'string';
  if (supportsNativeLetterSpacing) context.letterSpacing = `${spacing}px`;
  const measureText = (text: string) => context.measureText(text).width;
  const lines = layoutCanvasText(
    layer.value,
    box.width,
    measureText,
    spacing,
    layer.wrap,
    supportsNativeLetterSpacing ? measureText : undefined
  );
  const metrics = context.measureText('Mg');
  const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent || fontSize * 0.2;
  const lineBoxBaseline = (lineHeight - ascent - descent) / 2 + ascent;
  const totalHeight = Math.max(lineHeight, lines.length * lineHeight);
  const firstBaseline = box.y + Math.max(0, (box.height - totalHeight) / 2) + lineBoxBaseline;
  let materialLayer: HTMLCanvasElement | null = null;
  let pattern: CanvasPattern | null = null;
  if (application) {
    materialLayer = document.createElement('canvas');
    materialLayer.width = Math.max(1, Math.round(box.width));
    materialLayer.height = Math.max(1, Math.round(box.height));
    const materialContext = materialLayer.getContext('2d');
    if (materialContext) {
      paintShaderApplication(
        materialContext,
        materialLayer.width,
        materialLayer.height,
        `content-${layer.id}`,
        application
      );
      pattern = context.createPattern(materialLayer, 'repeat');
      pattern?.setTransform(new DOMMatrix().translate(box.x, box.y));
    }
  }
  context.globalAlpha = appearance.opacity * (application?.opacity ?? 1);
  context.globalCompositeOperation = application?.blendMode && application.blendMode !== 'normal'
    ? application.blendMode
    : 'source-over';
  context.lineJoin = 'round';
  context.lineWidth = Math.max(0.5, appearance.outlineWidth * 2);
  context.strokeStyle = appearance.outlineColor;

  const configureTextContext = (target: CanvasRenderingContext2D) => {
    target.textAlign = 'left';
    target.textBaseline = 'alphabetic';
    target.font = context.font;
    target.fontKerning = 'normal';
    if (supportsNativeLetterSpacing) target.letterSpacing = `${spacing}px`;
    target.lineJoin = 'round';
    target.lineWidth = context.lineWidth;
    target.strokeStyle = appearance.outlineColor;
  };
  const paintTextLines = (target: CanvasRenderingContext2D, mode: 'fill' | 'stroke') => {
    configureTextContext(target);
    lines.forEach((line, lineIndex) => {
      const baseline = firstBaseline + lineIndex * lineHeight;
      if (supportsNativeLetterSpacing) {
        const lineWidth = measureText(line);
        const lineX = canvasTextLineX(layer.align, box.x, box.width, lineWidth);
        if (mode === 'stroke') target.strokeText(line, lineX, baseline);
        else target.fillText(line, lineX, baseline);
        return;
      }
      const characters = canvasTextCharacters(line);
      const lineWidth = trackedTextWidth(line, measureText, spacing);
      let cursor = canvasTextLineX(layer.align, box.x, box.width, lineWidth);
      characters.forEach((character) => {
        if (mode === 'stroke') target.strokeText(character, cursor, baseline);
        else target.fillText(character, cursor, baseline);
        cursor += measureText(character) + spacing;
      });
    });
  };

  if (appearance.textEffect.kind === 'solid') {
    paintSolidDesignLabText(context, appearance, pattern, paintTextLines);
    context.restore();
    return;
  }

  paintDesignLabTextShadow({
    appearance,
    context,
    height,
    paintTextLines,
    shadowLayer: textEffectScratch.shadow,
    width,
  });
  if (appearance.outlineEnabled) paintTextLines(context, 'stroke');
  paintDesignLabTextEffectFill({
    appearance,
    box,
    canvasWidth,
    context,
    fillLayer: textEffectScratch.fill,
    height,
    materialLayer,
    paintTextLines,
    textMask: textEffectScratch.mask,
    width,
  });
  context.restore();
}

function designAutomationExportInput(input: unknown): DesignAutomationExportInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('design.export requires { format, mode?, download? }.');
  }
  const { download, format, mode } = input as { download?: unknown; format?: unknown; mode?: unknown };
  if (!['gif', 'jpg', 'mp4', 'png'].includes(String(format))) {
    throw new TypeError('design.export format must be png, jpg, gif, or mp4.');
  }
  if (mode !== undefined && mode !== 'standard' && mode !== 'shader-sequence') {
    throw new TypeError('design.export mode must be standard or shader-sequence.');
  }
  if (download !== undefined && typeof download !== 'boolean') {
    throw new TypeError('design.export download must be Boolean.');
  }
  if (mode === 'shader-sequence' && format !== 'gif' && format !== 'mp4') {
    throw new TypeError('Shader-sequence export supports GIF or MP4.');
  }
  return {
    download: download as boolean | undefined,
    format: format as DesignAutomationExportInput['format'],
    mode,
  };
}

type DesignAutomationHandlers = {
  exportForAutomation: (request: DesignAutomationExportInput) => Promise<ExportPreviewAsset>;
  normalizedShaderSequenceSettings: DesignShaderSequenceSettings;
  previewShaderSequence: () => void;
  sequencePreviewing: boolean;
  shaderSequenceDuration: number;
  shaderSequenceTimeline: ReturnType<typeof buildShaderSequenceTimeline>;
  stopShaderSequencePreview: () => void;
  updateShaderSequenceSettings: (patch: Partial<DesignShaderSequenceSettings>) => void;
};

const DESIGN_AUTOMATION_EXPORT_REQUESTS: Readonly<Record<string, DesignAutomationExportInput>> = {
  'design.export.gif': { format: 'gif' },
  'design.export.jpg': { format: 'jpg' },
  'design.export.mp4': { format: 'mp4' },
  'design.export.png': { format: 'png' },
  'design.export.shader-sequence.gif': { format: 'gif', mode: 'shader-sequence' },
  'design.export.shader-sequence.mp4': { format: 'mp4', mode: 'shader-sequence' },
};

async function invokeDesignAutomationAction(handlers: DesignAutomationHandlers, action: string, input: unknown) {
  switch (action) {
    case 'design.sequence.describe':
      return {
        durationMs: handlers.shaderSequenceDuration,
        materials: handlers.shaderSequenceTimeline,
        settings: handlers.normalizedShaderSequenceSettings,
      };
    case 'design.sequence.configure':
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw new TypeError('design.sequence.configure requires a settings object.');
      }
      handlers.updateShaderSequenceSettings(input as Partial<DesignShaderSequenceSettings>);
      return null;
    case 'design.sequence.preview':
      if (!handlers.sequencePreviewing) handlers.previewShaderSequence();
      return null;
    case 'design.sequence.stop':
      if (handlers.sequencePreviewing) handlers.stopShaderSequencePreview();
      return null;
    case 'design.export':
      return handlers.exportForAutomation(designAutomationExportInput(input));
    default: {
      const request = DESIGN_AUTOMATION_EXPORT_REQUESTS[action];
      if (!request) throw new RangeError(`Unknown Design Lab action: ${action}.`);
      return handlers.exportForAutomation(request);
    }
  }
}

type RenderLiveMaterial = (application: ShaderApplication, instanceKey: string) => ReactNode;

function canvasMediaMaskStyle(url: string, fillFrame = false): CSSProperties {
  const maskSize = fillFrame ? '100% 100%' : 'contain';
  return {
    WebkitMaskImage: `url("${url}")`,
    WebkitMaskPosition: 'center',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskSize: maskSize,
    maskImage: `url("${url}")`,
    maskMode: 'alpha',
    maskPosition: 'center',
    maskRepeat: 'no-repeat',
    maskSize,
  };
}

function ShaderMaskedMediaContent({
  application,
  appearance: appearanceSettings,
  fallbackColor,
  instanceKey,
  label,
  opacity,
  preserveColors = false,
  renderMaterial,
  url,
}: {
  application?: ShaderApplication;
  appearance?: LogoAppearanceSettings;
  fallbackColor: string;
  instanceKey: string;
  label: string;
  opacity: number;
  preserveColors?: boolean;
  renderMaterial: RenderLiveMaterial;
  url: string;
}) {
  const appearance = resolvedLogoAppearance(appearanceSettings);
  if (!application && preserveColors) {
    return (
      <AppearanceFilteredContent
        ariaLabel={label}
        className='shader-lab-v2-appearance-preview shader-lab-v2-asset-preview'
        opacity={opacity}
        settings={appearance}
      >
        {/* The canvas frame already carries the imported image's aspect ratio. */}
        <img alt='' className='shader-lab-v2-layer-image' draggable={false} src={url} />
      </AppearanceFilteredContent>
    );
  }
  if (!application) {
    return (
      <LogoAppearancePreview
        ariaLabel={label}
        className='shader-lab-v2-appearance-preview'
        color={fallbackColor}
        logoPath={url}
        opacity={opacity}
        preserveColors={preserveColors}
        settings={appearance}
      />
    );
  }
  return (
    <div
      className='shader-lab-v2-appearance-preview shader-lab-v2-appearance-stack'
      style={{
        mixBlendMode: shaderBlendStyle(application.blendMode),
        opacity: opacity * application.opacity,
      }}
    >
      {appearance.borderEnabled ? (
        <LogoAppearancePreview
          ariaLabel={`${label} silhouette effects`}
          className='shader-lab-v2-appearance-stack-layer'
          color={appearance.borderColor}
          fillFrame={preserveColors}
          logoPath={url}
          settings={{
            ...appearance,
            ditherEnabled: false,
            invert: false,
            shadowEnabled: false,
          }}
          showSource={false}
        />
      ) : null}
      <AppearanceFilteredContent
        ariaLabel={`${label} material`}
        className='shader-lab-v2-appearance-stack-layer'
        settings={{ ...appearance, borderEnabled: false }}
      >
        <div
          className='shader-lab-v2-layer-logo-mask'
          data-shader-instance={instanceKey}
          style={canvasMediaMaskStyle(url, preserveColors)}
        >
          {renderMaterial(application, instanceKey)}
        </div>
      </AppearanceFilteredContent>
    </div>
  );
}

function stickerFinishCssVariables(value?: Partial<StickerFinishSettings>): Record<string, string> {
  const finish = normalizeStickerFinish(value);
  return {
    '--design-sticker-finish': stickerFinishSwatch(finish),
    '--design-sticker-finish-contrast': String(1 + finish.relief / 420),
    '--design-sticker-finish-glint': `${finish.glintAngle}deg`,
    '--design-sticker-finish-glint-opacity': String(0.18 + finish.relief / 128),
    '--design-sticker-finish-opacity': String(Math.max(0, Math.min(0.82, finish.intensity / 122))),
    '--design-sticker-finish-saturation': String(1 + finish.depth / 240),
    '--design-sticker-finish-texture': String(finish.texture / 260),
  };
}

function StickerFinishOverlay({
  finish,
  url,
}: {
  finish?: Partial<StickerFinishSettings>;
  url: string;
}) {
  const normalized = normalizeStickerFinish(finish);
  const maskImage = `url("${url.replaceAll('"', '%22')}")`;
  return (
    <span
      aria-hidden='true'
      className='shader-lab-v2-sticker-finish-overlay'
      data-sticker-finish={normalized.presetId}
      style={{
        ...stickerFinishCssVariables(normalized),
        maskImage,
        WebkitMaskImage: maskImage,
      } as CSSProperties}
    />
  );
}

function CanvasTextLayerContent({
  application,
  fontSizeCqw,
  identity,
  layer,
  onChange,
  onFocus,
  renderMaterial,
}: {
  application?: ShaderApplication;
  fontSizeCqw: number;
  identity: BrandIdentity;
  layer: CompositionTextLayer;
  onChange: (value: string) => void;
  onFocus: () => void;
  renderMaterial: RenderLiveMaterial;
}) {
  const appearance = resolvedTextAppearance(layer);
  const instanceKey = `content-${layer.id}`;
  const materialImage = application ? `url("${shaderPreviewAssetPath(application.materialId)}")` : undefined;
  return (
    <>
      {application ? (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 opacity-0'
          data-shader-instance={instanceKey}
        >
          {renderMaterial(application, instanceKey)}
        </div>
      ) : null}
      <CanvasEditableText
        className={`shader-lab-v2-layer-text ${application ? 'shader-lab-v2-layer-text-material' : ''}`}
        label={`Edit ${layer.name}`}
        onChange={onChange}
        onFocus={onFocus}
        style={{
          caretColor: appearance.color,
          color: appearance.color,
          fontFamily: `${JSON.stringify(brandTypographyFamily(identity, appearance.fontRole))}, Arial, sans-serif`,
          fontSize: `${fontSizeCqw}cqw`,
          fontWeight: resolveBrandTypographyWeight(identity, appearance.fontRole, layer.weight),
          justifyContent: layer.align === 'left' ? 'flex-start' : layer.align === 'right' ? 'flex-end' : 'center',
          letterSpacing: `${layer.tracking}em`,
          lineHeight: layer.lineHeight,
          mixBlendMode: application ? shaderBlendStyle(application.blendMode) : undefined,
          opacity: appearance.opacity * (application?.opacity ?? 1),
          overflowWrap: layer.wrap === 'wrap' ? 'anywhere' : 'normal',
          textAlign: layer.align,
          textShadow: textShadowStyle(appearance),
          WebkitTextStroke: appearance.outlineEnabled
            ? `${appearance.outlineWidth}px ${appearance.outlineColor}`
            : undefined,
          whiteSpace: layer.wrap === 'wrap' ? 'pre-wrap' : 'pre',
          ...textEffectCssStyle(appearance.textEffect, appearance.color, materialImage),
        }}
        value={layer.value}
      />
    </>
  );
}

function resolveDesignLabBrandLogo(identity: BrandIdentity): string {
  return brandAssetPath(identity, 'mark-light')
    ?? brandAssetPath(identity, 'logo-light')
    ?? brandAssetPath(identity, 'mark-dark')
    ?? monogramDataUrl(identity);
}

function resolveShaderSequencePresentation(
  shaderLayers: CompositionShaderLayer[],
  settings: DesignShaderSequenceSettings,
  normalizedSettings: ShaderSequenceSettings
) {
  const targetLayer = shaderLayers.find(({ id, visible }) => visible && id === settings.targetLayerId)
    ?? shaderLayers.find(({ visible }) => visible)
    ?? null;
  const resolvedSettings = {
    ...normalizedSettings,
    sequenceOffset: Math.max(0, Math.round(settings.sequenceOffset)),
    targetLayerId: targetLayer?.id ?? null,
  };
  const targetOptions: Array<{ label: string; value: ShaderLayerId }> = [];
  for (const { id, name, visible } of shaderLayers) {
    if (visible) targetOptions.push({ label: name, value: id });
  }
  const materialIds = targetLayer
    ? shaderSequenceMaterialIds(targetLayer.materialId, resolvedSettings.cutCount, undefined, resolvedSettings.sequenceOffset)
    : [];
  const timeline = materialIds.length > 1
    ? buildShaderSequenceTimeline(materialIds, resolvedSettings)
    : [];
  return {
    duration: shaderSequenceDurationMs(timeline),
    materialIds,
    settings: resolvedSettings,
    targetLayer,
    targetOptions,
    timeline,
  };
}

function resolveShaderEditingSelection({
  initialSettings,
  layerShaders,
  selectedLayerId,
  shaderLayers,
}: {
  initialSettings: LiveMaterialSettings;
  layerShaders: Partial<Record<ContentLayerId, ShaderApplication>>;
  selectedLayerId: CompositionLayerId | null;
  shaderLayers: CompositionShaderLayer[];
}) {
  const shaderLayer = isShaderLayerId(selectedLayerId)
    ? shaderLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const contentLayerId = isContentLayerId(selectedLayerId) ? selectedLayerId : null;
  const layerShader = contentLayerId ? layerShaders[contentLayerId] ?? null : null;
  const editingShader = shaderLayer ?? layerShader;
  const previewChannel = shaderLayer
    ? `canvas-${shaderLayer.id}`
    : contentLayerId
      ? `content-${contentLayerId}`
      : null;
  const activeMaterialId = normalizeLiveMaterialId(
    editingShader?.materialId ?? shaderLayers.at(-1)?.materialId ?? DEFAULT_SHADER_MATERIAL_ID
  );
  return {
    activeMaterialId,
    contentLayerId,
    editingShader,
    layerShader,
    material: getLiveMaterial(activeMaterialId),
    previewChannel,
    settings: editingShader?.settings ?? initialSettings,
    shaderLayer,
    shaderSize: clampShaderZoom(editingShader?.shaderSize ?? 1),
  };
}

function resolveContentLayerSelection({
  assets,
  identity,
  logos,
  selectedLayerId,
  textLayers,
}: {
  assets: CompositionAsset[];
  identity: BrandIdentity;
  logos: CompositionLogoLayer[];
  selectedLayerId: CompositionLayerId | null;
  textLayers: CompositionTextLayer[];
}) {
  const textLayer = isTextLayerId(selectedLayerId)
    ? textLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const textTransform = textLayer ? resolvedTextTransform(textLayer.transform) : null;
  const textAppearance = textLayer ? resolvedTextAppearance(textLayer) : null;
  const textWeightRange = textAppearance
    ? brandTypographyWeightRange(identity, textAppearance.fontRole)
    : { max: 900, min: 100 };
  const textRenderedWeight = textLayer && textAppearance
    ? resolveBrandTypographyWeight(identity, textAppearance.fontRole, textLayer.weight)
    : 400;
  const logoLayer = isLogoLayerId(selectedLayerId)
    ? logos.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const asset = isAssetLayerId(selectedLayerId)
    ? assets.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  return {
    asset,
    assetAppearance: asset ? resolvedLogoAppearance(asset.appearance) : null,
    assetInspector: asset ? {
      appearance: resolvedLogoAppearance(asset.appearance),
      asset,
    } : null,
    logoAppearance: logoLayer ? resolvedLogoAppearance(logoLayer.appearance) : null,
    logoInspector: logoLayer ? {
      appearance: resolvedLogoAppearance(logoLayer.appearance),
      layer: logoLayer,
    } : null,
    logoLayer,
    textAppearance,
    textInspector: textLayer && textAppearance && textTransform ? {
      appearance: textAppearance,
      layer: textLayer,
      transform: textTransform,
    } : null,
    textLayer,
    textRenderedWeight,
    textTransform,
    textWeightRange,
  };
}

type SelectedTextInspector = NonNullable<ReturnType<typeof resolveContentLayerSelection>['textInspector']>;
type TextAppearancePreviewPatch = Partial<Omit<TextAppearanceSettings, 'textEffect'>> & {
  textEffect?: Partial<TextEffectSettings>;
};

function DesignLabAssetLayerInspector({
  appearance,
  asset,
  previewAppearance,
  previewOpacity,
  previewStickerFinish,
  updateAsset,
}: {
  appearance: LogoAppearanceSettings;
  asset: CompositionAsset;
  previewAppearance: (patch: Partial<LogoAppearanceSettings>) => void;
  previewOpacity: (value: number) => void;
  previewStickerFinish: (patch: Partial<StickerFinishSettings>) => void;
  updateAsset: (update: Partial<Omit<CompositionAsset, 'id'>>) => void;
}) {
  const sticker = asset.kind === 'sticker';
  const finish = normalizeStickerFinish(asset.stickerFinish);
  const updateFinish = (patch: Partial<StickerFinishSettings>) => updateAsset({
    stickerFinish: normalizeStickerFinish({ ...finish, ...patch }),
  });

  return (
    <div aria-label={sticker ? 'Sticker appearance' : 'Image appearance'} className='shader-lab-v2-layer-settings' role='group'>
      <div className='shader-lab-v2-layer-settings-heading'>
        <strong>{sticker ? 'Sticker appearance' : 'Image appearance'}</strong>
        <span>{sticker ? 'Die-cut layer' : 'Non-destructive'}</span>
      </div>
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Layer opacity'
        max={1}
        min={0}
        onChange={(opacity) => updateAsset({ opacity })}
        onPreview={previewOpacity}
        step={0.01}
        value={asset.opacity ?? 1}
      />

      {sticker ? (
        <div className='shader-lab-v2-sticker-finish-panel'>
          <div className='shader-lab-v2-sticker-finish-heading'>
            <span><Sparkles aria-hidden='true' /><strong>Surface finish</strong></span>
            <small>{STICKER_FINISH_PRESETS.length} finishes</small>
          </div>
          <div aria-label='Sticker surface finish' className='shader-lab-v2-sticker-finish-presets' role='group'>
            {STICKER_FINISH_PRESETS.map((preset) => (
              <button
                aria-pressed={finish.presetId === preset.id}
                key={preset.id}
                onClick={() => updateAsset({ stickerFinish: { ...preset.settings } })}
                title={preset.description}
                type='button'
              >
                <span aria-hidden='true' style={{ background: preset.swatch }} />
                <strong>{preset.label}</strong>
              </button>
            ))}
          </div>
          <div className='shader-lab-v2-sticker-finish-controls'>
            <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Shine' max={100} min={0} onChange={(intensity) => updateFinish({ intensity })} onPreview={(intensity) => previewStickerFinish({ intensity })} step={1} value={finish.intensity} />
            <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Texture' max={100} min={0} onChange={(texture) => updateFinish({ texture })} onPreview={(texture) => previewStickerFinish({ texture })} step={1} value={finish.texture} />
            <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Relief' max={100} min={0} onChange={(relief) => updateFinish({ relief })} onPreview={(relief) => previewStickerFinish({ relief })} step={1} value={finish.relief} />
            <RangeControl formatValue={(value) => `${Math.round(value)}°`} label='Glint angle' max={180} min={0} onChange={(glintAngle) => updateFinish({ glintAngle })} onPreview={(glintAngle) => previewStickerFinish({ glintAngle })} step={1} value={finish.glintAngle} />
            <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Depth' max={100} min={0} onChange={(depth) => updateFinish({ depth })} onPreview={(depth) => previewStickerFinish({ depth })} step={1} value={finish.depth} />
          </div>
        </div>
      ) : null}

      <LogoAppearanceControls
        kind={sticker ? 'sticker' : 'image'}
        onChange={(patch) => updateAsset({ appearance: { ...appearance, ...patch } })}
        onPreview={previewAppearance}
        settings={appearance}
      />
      {!sticker ? (
        <Button
          onClick={() => updateAsset({
            appearance: { ...STICKER_IMAGE_APPEARANCE },
            kind: 'sticker',
            stickerFinish: { ...DEFAULT_STICKER_FINISH },
          })}
          size='sm'
          type='button'
          variant='outline'
        >
          <Sticker aria-hidden='true' />Make sticker
        </Button>
      ) : null}
    </div>
  );
}

function DesignLabTextLayerInspector({
  canvasHeight,
  canvasWidth,
  identity,
  previewSelectedContentOpacity,
  previewSelectedTextAppearance,
  previewSelectedTextWidth,
  selectedCanvasLayerCount,
  selection,
  textRenderedWeight,
  textWeightRange,
  updateTextLayer,
}: {
  canvasHeight: number;
  canvasWidth: number;
  identity: BrandIdentity;
  previewSelectedContentOpacity: (value: number) => void;
  previewSelectedTextAppearance: (patch: TextAppearancePreviewPatch) => void;
  previewSelectedTextWidth: (value: number) => void;
  selectedCanvasLayerCount: number;
  selection: SelectedTextInspector;
  textRenderedWeight: number;
  textWeightRange: { max: number; min: number };
  updateTextLayer: (id: TextLayerId, update: Partial<Omit<CompositionTextLayer, 'id'>>) => void;
}) {
  const {
    appearance: selectedTextAppearance,
    layer: selectedTextLayer,
    transform: selectedTextTransform,
  } = selection;
  return <>
    <label className='shader-lab-v2-text-input'>
      <Type aria-hidden='true' />
      <InspectorTextArea
        ariaLabel={`${selectedTextLayer.name} content`}
        onChange={(value) => updateTextLayer(selectedTextLayer.id, { value })}
        onPreview={(value) => {
          const text = selectedCanvasLayerElement(selectedCanvasLayerCount)
            ?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
          if (text) text.innerText = value;
        }}
        value={selectedTextLayer.value}
      />
    </label>
    <div aria-label='Typography' className='shader-lab-v2-text-controls'>
      <label className='shader-lab-v2-field'>
        <span>Brand font</span>
        <StudioSelect
          ariaLabel='Text font role'
          onValueChange={(fontRole) => {
            const nextRole = fontRole as BrandTypography['role'];
            updateTextLayer(selectedTextLayer.id, {
              fontRole: nextRole,
              weight: resolveBrandTypographyWeight(
                identity,
                nextRole,
                brandTypographyRole(identity, nextRole).weight ?? selectedTextLayer.weight
              ),
            });
          }}
          options={(['Display', 'Body', 'Accent', 'Code'] as const).map((role) => ({
            label: `${role} · ${brandTypographyFamily(identity, role)}`,
            value: role,
          }))}
          value={selectedTextAppearance.fontRole}
        />
      </label>
      <ColorControl
        ariaLabel='Text color'
        label='Text color'
        onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })}
        onPreview={(color) => previewSelectedTextAppearance({ color })}
        value={selectedTextAppearance.color}
      />
      <div className='shader-lab-v2-text-options'>
        <span>Wrap</span>
        <div>
          {(['wrap', 'nowrap'] as const).map((value) => (
            <button
              aria-pressed={selectedTextLayer.wrap === value}
              key={value}
              onClick={() => updateTextLayer(selectedTextLayer.id, { wrap: value })}
              type='button'
            >
              {value === 'wrap' ? 'On' : 'Off'}
            </button>
          ))}
        </div>
      </div>
      <div className='shader-lab-v2-text-options'>
        <span>Align</span>
        <div>
          {(['left', 'center', 'right'] as const).map((value) => (
            <button
              aria-pressed={selectedTextLayer.align === value}
              key={value}
              onClick={() => updateTextLayer(selectedTextLayer.id, { align: value })}
              type='button'
            >
              {value[0]!.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Text size'
        max={3}
        min={0.2}
        onChange={(scale) => updateTextLayer(selectedTextLayer.id, {
          transform: { ...selectedTextTransform, scale },
        })}
        onPreview={(scale) => previewSelectedTextStyle(
          selectedCanvasLayerCount,
          'fontSize',
          `${canvasHeight / canvasWidth * 17 * scale}cqw`
        )}
        step={0.05}
        value={selectedTextTransform.scale}
      />
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Text box width'
        max={3}
        min={0.25}
        onChange={(widthScale) => updateTextLayer(selectedTextLayer.id, {
          transform: { ...selectedTextTransform, widthScale },
        })}
        onPreview={previewSelectedTextWidth}
        step={0.05}
        value={selectedTextTransform.widthScale ?? 1}
      />
      <RangeControl
        formatValue={(value) => `${Math.round(value * 100)}%`}
        label='Layer opacity'
        max={1}
        min={0}
        onChange={(opacity) => updateTextLayer(selectedTextLayer.id, { opacity })}
        onPreview={previewSelectedContentOpacity}
        step={0.01}
        value={selectedTextAppearance.opacity}
      />
      <RangeControl
        formatValue={(value) => value.toFixed(2)}
        label='Line height'
        max={1.8}
        min={0.7}
        onChange={(lineHeight) => updateTextLayer(selectedTextLayer.id, { lineHeight })}
        onPreview={(lineHeight) => previewSelectedTextStyle(selectedCanvasLayerCount, 'lineHeight', String(lineHeight))}
        step={0.05}
        value={selectedTextLayer.lineHeight}
      />
      <RangeControl
        formatValue={(value) => String(Math.round(value))}
        label='Font weight'
        max={textWeightRange.max}
        min={textWeightRange.min}
        onChange={(weight) => updateTextLayer(selectedTextLayer.id, {
          weight: resolveBrandTypographyWeight(identity, selectedTextAppearance.fontRole, weight),
        })}
        onPreview={(weight) => previewSelectedTextStyle(selectedCanvasLayerCount, 'fontWeight', String(weight))}
        step={textWeightRange.max - textWeightRange.min <= 100 ? 100 : 50}
        value={textRenderedWeight}
      />
      <RangeControl
        formatValue={(value) => `${value.toFixed(2)}em`}
        label='Tracking'
        max={0.2}
        min={-0.12}
        onChange={(tracking) => updateTextLayer(selectedTextLayer.id, { tracking })}
        onPreview={(tracking) => previewSelectedTextStyle(selectedCanvasLayerCount, 'letterSpacing', `${tracking}em`)}
        step={0.01}
        value={selectedTextLayer.tracking}
      />
      <div className='shader-lab-v2-text-effects-panel'>
        <div className='shader-lab-v2-text-effects-heading'>
          <span><WandSparkles aria-hidden='true' />Text effects</span>
          <small>Glyph fill</small>
        </div>
        <div aria-label='Text effect presets' className='shader-lab-v2-text-effect-presets'>
          {TEXT_EFFECT_PRESETS.map((preset) => (
            <button
              aria-pressed={selectedTextAppearance.textEffect.kind === preset.settings.kind}
              key={preset.settings.kind}
              onClick={() => updateTextLayer(selectedTextLayer.id, { textEffect: { ...preset.settings } })}
              title={preset.description}
              type='button'
            >
              <TextEffectThumbnail settings={preset.settings} />
              <span><strong>{preset.label}</strong><small>{preset.description}</small></span>
            </button>
          ))}
        </div>
        {selectedTextAppearance.textEffect.kind !== 'solid' ? (
          <div className='shader-lab-v2-text-effect-tuning'>
            <div className='shader-lab-v2-effect-colors'>
              <ColorControl
                ariaLabel='Text effect foreground color'
                label='Foreground'
                onChange={(color) => updateTextLayer(selectedTextLayer.id, { color })}
                onPreview={(color) => previewSelectedTextAppearance({ color })}
                value={selectedTextAppearance.color}
              />
              <ColorControl
                ariaLabel='Text effect background color'
                label='Background'
                onChange={(backgroundColor) => updateTextLayer(selectedTextLayer.id, {
                  textEffect: { ...selectedTextAppearance.textEffect, backgroundColor },
                })}
                onPreview={(backgroundColor) => previewSelectedTextAppearance({ textEffect: { backgroundColor } })}
                value={selectedTextAppearance.textEffect.backgroundColor}
              />
            </div>
            {selectedTextAppearance.textEffect.kind !== 'gradient' ? <>
              <RangeControl
                formatValue={(value) => `${Math.round(value)}%`}
                label='Effect strength'
                max={100}
                min={0}
                onChange={(amount) => updateTextLayer(selectedTextLayer.id, {
                  textEffect: { ...selectedTextAppearance.textEffect, amount },
                })}
                onPreview={(amount) => previewSelectedTextAppearance({ textEffect: { amount } })}
                step={1}
                value={selectedTextAppearance.textEffect.amount}
              />
              <RangeControl
                formatValue={(value) => `${Math.round(value)}px`}
                label='Pattern scale'
                max={36}
                min={4}
                onChange={(scale) => updateTextLayer(selectedTextLayer.id, {
                  textEffect: { ...selectedTextAppearance.textEffect, scale },
                })}
                onPreview={(scale) => previewSelectedTextAppearance({ textEffect: { scale } })}
                step={1}
                value={selectedTextAppearance.textEffect.scale}
              />
            </> : null}
            {selectedTextAppearance.textEffect.kind !== 'halftone' ? (
              <RangeControl
                formatValue={(value) => `${Math.round(value)}°`}
                label='Effect angle'
                max={180}
                min={-180}
                onChange={(angle) => updateTextLayer(selectedTextLayer.id, {
                  textEffect: { ...selectedTextAppearance.textEffect, angle },
                })}
                onPreview={(angle) => previewSelectedTextAppearance({ textEffect: { angle } })}
                step={1}
                value={selectedTextAppearance.textEffect.angle}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className='shader-lab-v2-effect-group'>
        <label><span>Text outline</span><StudioCheckbox checked={selectedTextAppearance.outlineEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { outlineEnabled: event.target.checked })} /></label>
        {selectedTextAppearance.outlineEnabled ? <>
          <ColorControl ariaLabel='Text outline color' label='Outline color' onChange={(outlineColor) => updateTextLayer(selectedTextLayer.id, { outlineColor })} onPreview={(outlineColor) => previewSelectedTextAppearance({ outlineColor })} value={selectedTextAppearance.outlineColor} />
          <RangeControl label='Outline width' max={12} min={0.5} onChange={(outlineWidth) => updateTextLayer(selectedTextLayer.id, { outlineWidth })} onPreview={(outlineWidth) => previewSelectedTextAppearance({ outlineWidth })} step={0.5} value={selectedTextAppearance.outlineWidth} />
        </> : null}
      </div>
      <div className='shader-lab-v2-effect-group'>
        <label><span>Text shadow</span><StudioCheckbox checked={selectedTextAppearance.shadowEnabled} onChange={(event) => updateTextLayer(selectedTextLayer.id, { shadowEnabled: event.target.checked })} /></label>
        {selectedTextAppearance.shadowEnabled ? <>
          <ColorControl ariaLabel='Text shadow color' label='Shadow color' onChange={(shadowColor) => updateTextLayer(selectedTextLayer.id, { shadowColor })} onPreview={(shadowColor) => previewSelectedTextAppearance({ shadowColor })} value={selectedTextAppearance.shadowColor} />
          <RangeControl label='Shadow blur' max={64} min={0} onChange={(shadowBlur) => updateTextLayer(selectedTextLayer.id, { shadowBlur })} onPreview={(shadowBlur) => previewSelectedTextAppearance({ shadowBlur })} step={1} value={selectedTextAppearance.shadowBlur} />
          <RangeControl label='Shadow X' max={48} min={-48} onChange={(shadowOffsetX) => updateTextLayer(selectedTextLayer.id, { shadowOffsetX })} onPreview={(shadowOffsetX) => previewSelectedTextAppearance({ shadowOffsetX })} step={1} value={selectedTextAppearance.shadowOffsetX} />
          <RangeControl label='Shadow Y' max={48} min={-48} onChange={(shadowOffsetY) => updateTextLayer(selectedTextLayer.id, { shadowOffsetY })} onPreview={(shadowOffsetY) => previewSelectedTextAppearance({ shadowOffsetY })} step={1} value={selectedTextAppearance.shadowOffsetY} />
          <RangeControl formatValue={(value) => `${Math.round(value)}%`} label='Shadow opacity' max={100} min={0} onChange={(shadowOpacity) => updateTextLayer(selectedTextLayer.id, { shadowOpacity })} onPreview={(shadowOpacity) => previewSelectedTextAppearance({ shadowOpacity })} step={1} value={selectedTextAppearance.shadowOpacity} />
        </> : null}
      </div>
    </div>
  </>;
}

function DesignLabShaderInspector({
  brandPalette,
  editingShader,
  initialSettings,
  material,
  previewChannel,
  previewSelectedShaderOpacity,
  previewSelectedShaderSetting,
  settings,
  shaderSize,
  updateSelectedShader,
  updateSetting,
}: {
  brandPalette: ReturnType<typeof brandMaterialPalette>;
  editingShader: ShaderApplication;
  initialSettings: LiveMaterialSettings;
  material: LiveMaterialOption;
  previewChannel: string | null;
  previewSelectedShaderOpacity: (value: number) => void;
  previewSelectedShaderSetting: (key: keyof LiveMaterialSettings, value: number) => void;
  settings: LiveMaterialSettings;
  shaderSize: number;
  updateSelectedShader: (update: Partial<ShaderApplication>) => void;
  updateSetting: <Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) => void;
}) {
  return <>
    <LabInspectorSection className='shader-lab-v2-control-section' meta={material.name} title='Shader color'>
      <div className='shader-lab-v2-colors'>
        {([
          { key: 'colorA', label: 'Base color' },
          { key: 'colorB', label: 'Mid color' },
          { key: 'colorC', label: 'Light color' },
        ] as const).map(({ key, label }) => (
          <ColorControl
            ariaLabel={`Shader ${label.toLowerCase()}`}
            key={key}
            label={label}
            onChange={(color) => updateSetting(key, color)}
            onPreview={(color) => {
              if (previewChannel) previewLiveMaterialSettings(previewChannel, { [key]: color });
            }}
            value={settings[key]}
          />
        ))}
      </div>
      <div className='shader-lab-v2-palettes'>
        {[brandPalette, ...LIVE_MATERIAL_PALETTES.slice(0, 7)].map((palette) => (
          <button
            aria-label={`Apply ${palette.name} palette`}
            key={palette.id}
            onClick={() => updateSelectedShader({
              settings: {
                ...settings,
                colorA: palette.colors[0],
                colorB: palette.colors[1],
                colorC: palette.colors[2],
              },
            })}
            title={palette.name}
            type='button'
          >
            {palette.colors.map((color) => <i key={color} style={{ background: color }} />)}
          </button>
        ))}
      </div>
      <div className='shader-lab-v2-shader-meta'>
        <button
          onClick={() => updateSelectedShader({
            settings: shaderLabSettingsFor(editingShader.materialId, initialSettings),
            shaderSize: 1,
          })}
          type='button'
        ><RotateCcw aria-hidden='true' />Reset shader</button>
        {material.sourceUrl ? (
          <a href={material.sourceUrl} rel='noreferrer' target='_blank'>{material.sourceLabel ?? 'View source'}<ExternalLink aria-hidden='true' /></a>
        ) : null}
      </div>
    </LabInspectorSection>

    <LabInspectorSection className='shader-lab-v2-control-section' meta='Essentials' title='Shader settings'>
      <div className='shader-lab-v2-ranges'>
        <ShaderZoomControl
          onChange={(value) => updateSelectedShader({ shaderSize: value })}
          onPreview={(value) => {
            if (previewChannel) previewLiveMaterialPatternScale(previewChannel, value);
          }}
          value={shaderSize}
        />
        <RangeControl
          formatValue={(value) => `${Math.round(value * 100)}%`}
          label='Layer opacity'
          max={1}
          min={0}
          onChange={(value) => updateSelectedShader({ opacity: value })}
          onPreview={previewSelectedShaderOpacity}
          step={0.01}
          value={editingShader.opacity}
        />
        <div className='shader-lab-v2-text-options'>
          <span>Blend</span>
          <div>
            {(['normal', 'screen', 'overlay', 'multiply'] as const).map((value) => (
              <button
                aria-pressed={editingShader.blendMode === value}
                key={value}
                onClick={() => updateSelectedShader({ blendMode: value })}
                type='button'
              >
                {value.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
        {isPaperLiveMaterialId(editingShader.materialId) ? <>
          <RangeControl
            formatValue={(value) => `${Math.round(value * 100)}%`}
            label='Center X'
            max={1}
            min={0}
            onChange={(value) => updateSetting('centerX', value)}
            onPreview={(value) => previewSelectedShaderSetting('centerX', value)}
            step={0.01}
            value={settings.centerX ?? 0.5}
          />
          <RangeControl
            formatValue={(value) => `${Math.round(value * 100)}%`}
            label='Center Y'
            max={1}
            min={0}
            onChange={(value) => updateSetting('centerY', value)}
            onPreview={(value) => previewSelectedShaderSetting('centerY', value)}
            step={0.01}
            value={settings.centerY ?? 0.5}
          />
        </> : null}
        {PRIMARY_CONTROLS.map((control) => (
          <RangeControl
            {...control}
            formatValue={control.key === 'speed' ? (value) => `${value.toFixed(2)}×` : undefined}
            key={control.key}
            onChange={(value) => updateSetting(control.key, value)}
            onPreview={(value) => previewSelectedShaderSetting(control.key, value)}
            value={settings[control.key]}
          />
        ))}
      </div>
    </LabInspectorSection>
  </>;
}

function DesignLabShaderFrameInspector({
  canvasHeight,
  canvasWidth,
  layer,
  onChange,
}: {
  canvasHeight: number;
  canvasWidth: number;
  layer: CompositionShaderLayer;
  onChange: (transform: CanvasLayerTransform) => void;
}) {
  const transform = normalizeCanvasLayerTransform(layer.transform, DEFAULT_LAYER_TRANSFORM);
  const widthScale = transform.widthScale ?? transform.scale;
  const heightScale = transform.heightScale ?? transform.scale;
  return (
    <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-shader-frame' meta='Canvas bounds' title='Shader frame'>
      <p>Drag the shader directly on the canvas, or use exact position and size controls.</p>
      <div className='shader-lab-v2-ranges'>
        <RangeControl
          formatValue={(value) => `${Math.round(value)} px`}
          label='Horizontal position'
          max={canvasWidth}
          min={-canvasWidth}
          onChange={(x) => onChange({ ...transform, x })}
          step={1}
          value={transform.x}
        />
        <RangeControl
          formatValue={(value) => `${Math.round(value)} px`}
          label='Vertical position'
          max={canvasHeight}
          min={-canvasHeight}
          onChange={(y) => onChange({ ...transform, y })}
          step={1}
          value={transform.y}
        />
        <RangeControl
          formatValue={(value) => `${Math.round(value * 100)}%`}
          label='Frame width'
          max={3}
          min={MIN_CANVAS_LAYER_SCALE}
          onChange={(widthScale) => onChange({ ...transform, widthScale })}
          step={0.01}
          value={widthScale}
        />
        <RangeControl
          formatValue={(value) => `${Math.round(value * 100)}%`}
          label='Frame height'
          max={3}
          min={MIN_CANVAS_LAYER_SCALE}
          onChange={(heightScale) => onChange({ ...transform, heightScale })}
          step={0.01}
          value={heightScale}
        />
      </div>
      <Button onClick={() => onChange({ ...DEFAULT_LAYER_TRANSFORM })} size='sm' type='button' variant='outline'>
        <RotateCcw aria-hidden='true' />Fit shader to canvas
      </Button>
    </LabInspectorSection>
  );
}

type DesignLabCanvasSelectionInput = {
  canvasDimensions: StudioArtboardDimensions;
  compositionAssets: CompositionAsset[];
  duplicateLayer: (id: CompositionLayerId) => CompositionLayerId | null;
  layerGroups: CompositionLayerGroup[];
  layerGroupByLayerId: ReadonlyMap<CanvasLayerId, CompositionLayerGroup>;
  layerOrder: CompositionLayerId[];
  layerVisible: (id: CompositionLayerId) => boolean;
  logoLayers: CompositionLogoLayer[];
  removeLayer: (id: CompositionLayerId) => void;
  selectedCanvasLayerIds: CanvasLayerId[];
  setCompositionAssets: Dispatch<SetStateAction<CompositionAsset[]>>;
  setLayerGroups: Dispatch<SetStateAction<CompositionLayerGroup[]>>;
  setLayerOrder: Dispatch<SetStateAction<CompositionLayerId[]>>;
  setLogoLayers: Dispatch<SetStateAction<CompositionLogoLayer[]>>;
  setSelectedCanvasLayerIds: Dispatch<SetStateAction<CanvasLayerId[]>>;
  setSelectedLayerId: Dispatch<SetStateAction<CompositionLayerId | null>>;
  setSelectionMenuPosition: Dispatch<SetStateAction<CanvasSelectionMenuPosition | null>>;
  setShaderLayers: Dispatch<SetStateAction<CompositionShaderLayer[]>>;
  setTextLayers: Dispatch<SetStateAction<CompositionTextLayer[]>>;
  shaderLayers: CompositionShaderLayer[];
  textLayers: CompositionTextLayer[];
};

type DesignLabLayerActionsInput = {
  compositionAssets: CompositionAsset[];
  effectLayers: CompositionEffectLayer[];
  layerShaders: Partial<Record<ContentLayerId, ShaderApplication>>;
  logoLayers: CompositionLogoLayer[];
  removeAsset: (id: AssetLayerId) => void;
  removeEffectLayer: (id: EffectLayerId) => void;
  removeLogoLayer: (id: LogoLayerId) => void;
  removeTextLayer: (id: TextLayerId) => void;
  selectedContentLayerId: ContentLayerId | null;
  setCompositionAssets: Dispatch<SetStateAction<CompositionAsset[]>>;
  setEffectLayers: Dispatch<SetStateAction<CompositionEffectLayer[]>>;
  setLayerOrder: Dispatch<SetStateAction<CompositionLayerId[]>>;
  setLayerShaders: Dispatch<SetStateAction<Partial<Record<ContentLayerId, ShaderApplication>>>>;
  setLogoLayers: Dispatch<SetStateAction<CompositionLogoLayer[]>>;
  setSelectedLayerId: Dispatch<SetStateAction<CompositionLayerId | null>>;
  setShaderLayers: Dispatch<SetStateAction<CompositionShaderLayer[]>>;
  setTextLayers: Dispatch<SetStateAction<CompositionTextLayer[]>>;
  shaderLayers: CompositionShaderLayer[];
  textLayers: CompositionTextLayer[];
  toggleTextLayerVisibility: (layer: CompositionTextLayer) => void;
};

function useDesignLabLayerActions({
  compositionAssets,
  effectLayers,
  layerShaders,
  logoLayers,
  removeAsset,
  removeEffectLayer,
  removeLogoLayer,
  removeTextLayer,
  selectedContentLayerId,
  setCompositionAssets,
  setEffectLayers,
  setLayerOrder,
  setLayerShaders,
  setLogoLayers,
  setSelectedLayerId,
  setShaderLayers,
  setTextLayers,
  shaderLayers,
  textLayers,
  toggleTextLayerVisibility,
}: DesignLabLayerActionsInput) {
  function placeLayerAfter(sourceId: CompositionLayerId, nextId: CompositionLayerId) {
    setLayerOrder((current) => {
      const sourceIndex = current.indexOf(sourceId);
      if (sourceIndex < 0) return [...current, nextId];
      return [...current.slice(0, sourceIndex + 1), nextId, ...current.slice(sourceIndex + 1)];
    });
    setSelectedLayerId(nextId);
  }

  function placeDuplicatedContentLayer<LayerId extends ContentLayerId>(sourceId: LayerId, nextId: LayerId): LayerId {
    const sourceShader = layerShaders[sourceId];
    if (sourceShader) {
      setLayerShaders((current) => ({
        ...current,
        [nextId]: { ...sourceShader, settings: { ...sourceShader.settings } },
      }));
    }
    placeLayerAfter(sourceId, nextId);
    return nextId;
  }

  function duplicateShaderLayer(id: ShaderLayerId): ShaderLayerId | null {
    const source = shaderLayers.find((layer) => layer.id === id);
    if (!source) return null;
    const nextId = `shader-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as ShaderLayerId;
    const transform = normalizeCanvasLayerTransform(source.transform, DEFAULT_LAYER_TRANSFORM);
    setShaderLayers((current) => [...current, {
      ...source,
      id: nextId,
      name: `${source.name} copy`,
      settings: { ...source.settings },
      transform: {
        ...transform,
        x: transform.x + 32,
        y: transform.y + 32,
      },
    }]);
    placeLayerAfter(id, nextId);
    return nextId;
  }

  function duplicateEffectLayer(id: EffectLayerId): EffectLayerId | null {
    const source = effectLayers.find((layer) => layer.id === id);
    if (!source) return null;
    const nextId = `effect-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as EffectLayerId;
    setEffectLayers((current) => [...current, {
      ...source,
      id: nextId,
      name: `${source.name} copy`,
      settings: { ...source.settings },
    }]);
    placeLayerAfter(id, nextId);
    return nextId;
  }

  function duplicateTextLayer(id: TextLayerId): TextLayerId | null {
    const source = textLayers.find((layer) => layer.id === id);
    if (!source) return null;
    const nextId = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as TextLayerId;
    const transform = resolvedTextTransform(source.transform);
    setTextLayers((current) => [...current, {
      ...source,
      id: nextId,
      name: `${source.name} copy`,
      textEffect: source.textEffect ? { ...source.textEffect } : undefined,
      transform: { ...transform, x: transform.x + 32, y: transform.y + 32 },
    }]);
    return placeDuplicatedContentLayer(id, nextId);
  }

  function duplicateLogoLayer(id: LogoLayerId): LogoLayerId | null {
    const source = logoLayers.find((layer) => layer.id === id);
    if (!source) return null;
    const nextId = `logo-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as LogoLayerId;
    setLogoLayers((current) => [...current, {
      ...source,
      appearance: source.appearance ? { ...source.appearance } : undefined,
      id: nextId,
      name: `${source.name} copy`,
      transform: { ...source.transform, x: source.transform.x + 32, y: source.transform.y + 32 },
    }]);
    return placeDuplicatedContentLayer(id, nextId);
  }

  function duplicateImageLayer(id: AssetLayerId): AssetLayerId | null {
    const source = compositionAssets.find((asset) => asset.id === id);
    if (!source) return null;
    const nextId = `asset-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as AssetLayerId;
    setCompositionAssets((current) => [...current, {
      ...source,
      appearance: source.appearance ? { ...source.appearance } : undefined,
      id: nextId,
      name: `${source.name} copy`,
      stickerFinish: source.stickerFinish ? { ...source.stickerFinish } : undefined,
      transform: { ...source.transform, x: source.transform.x + 32, y: source.transform.y + 32 },
    }]);
    return placeDuplicatedContentLayer(id, nextId);
  }

  function duplicateLayer(id: CompositionLayerId): CompositionLayerId | null {
    if (isShaderLayerId(id)) return duplicateShaderLayer(id);
    if (isEffectLayerId(id)) return duplicateEffectLayer(id);
    if (isTextLayerId(id)) return duplicateTextLayer(id);
    if (isLogoLayerId(id)) return duplicateLogoLayer(id);
    return duplicateImageLayer(id);
  }

  function removeShaderLayer(id: ShaderLayerId) {
    setShaderLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function removeLayer(id: CompositionLayerId) {
    if (isShaderLayerId(id)) removeShaderLayer(id);
    else if (isEffectLayerId(id)) removeEffectLayer(id);
    else if (isLogoLayerId(id)) removeLogoLayer(id);
    else if (isTextLayerId(id)) removeTextLayer(id);
    else removeAsset(id);
  }

  function toggleLayerVisibility(id: CompositionLayerId) {
    if (isShaderLayerId(id)) {
      setShaderLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
      return;
    }
    if (isEffectLayerId(id)) {
      setEffectLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
      return;
    }
    if (isLogoLayerId(id)) {
      setLogoLayers((current) => current.map((layer) => layer.id === id ? { ...layer, visible: !layer.visible } : layer));
      return;
    }
    if (isTextLayerId(id)) {
      const layer = textLayers.find((candidate) => candidate.id === id);
      if (layer) toggleTextLayerVisibility(layer);
      return;
    }
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, visible: !asset.visible } : asset));
  }

  function removeShaderFromSelectedContent() {
    if (!selectedContentLayerId) return;
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[selectedContentLayerId];
      return next;
    });
  }

  function layerLabel(id: CompositionLayerId) {
    if (isShaderLayerId(id)) return shaderLayers.find((layer) => layer.id === id)?.name ?? 'Canvas shader';
    if (isEffectLayerId(id)) return effectLayers.find((layer) => layer.id === id)?.name ?? 'Converter';
    if (isLogoLayerId(id)) return logoLayers.find((layer) => layer.id === id)?.name ?? 'Mark';
    if (isTextLayerId(id)) return textLayers.find((layer) => layer.id === id)?.name ?? 'Text';
    return compositionAssets.find((asset) => asset.id === id)?.name ?? 'Image';
  }

  function resolvedLayerKind(id: CompositionLayerId) {
    if (isTextLayerId(id) && textLayers.find((layer) => layer.id === id)?.kind === 'sticker') return 'Sticker';
    if (isAssetLayerId(id) && compositionAssets.find((asset) => asset.id === id)?.kind === 'sticker') return 'Sticker';
    return layerKind(id);
  }

  return { duplicateLayer, layerLabel, removeLayer, removeShaderFromSelectedContent, resolvedLayerKind, toggleLayerVisibility };
}

function useDesignLabCanvasSelection({
  canvasDimensions,
  compositionAssets,
  duplicateLayer,
  layerGroups,
  layerGroupByLayerId,
  layerOrder,
  layerVisible,
  logoLayers,
  removeLayer,
  selectedCanvasLayerIds,
  setCompositionAssets,
  setLayerGroups,
  setLayerOrder,
  setLogoLayers,
  setSelectedCanvasLayerIds,
  setSelectedLayerId,
  setSelectionMenuPosition,
  setShaderLayers,
  setTextLayers,
  shaderLayers,
  textLayers,
}: DesignLabCanvasSelectionInput) {
  const selectedCanvasLayerIdSet = useMemo(
    () => new Set<CanvasLayerId>(selectedCanvasLayerIds),
    [selectedCanvasLayerIds]
  );

  function canvasLayerTransform(id: CanvasLayerId): CanvasLayerTransform | null {
    if (isShaderLayerId(id)) {
      const transform = shaderLayers.find((candidate) => candidate.id === id)?.transform;
      return transform ? normalizeCanvasLayerTransform(transform, DEFAULT_LAYER_TRANSFORM) : null;
    }
    if (isTextLayerId(id)) {
      const layer = textLayers.find((candidate) => candidate.id === id);
      return layer ? resolvedTextTransform(layer.transform) : null;
    }
    if (isLogoLayerId(id)) {
      return logoLayers.find((candidate) => candidate.id === id)?.transform ?? null;
    }
    return compositionAssets.find((candidate) => candidate.id === id)?.transform ?? null;
  }

  function updateCanvasLayerTransforms(updates: ReadonlyMap<CanvasLayerId, CanvasLayerTransform>) {
    setShaderLayers((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
    setTextLayers((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
    setLogoLayers((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
    setCompositionAssets((current) => current.map((layer) => {
      const transform = updates.get(layer.id);
      return transform ? { ...layer, transform } : layer;
    }));
  }

  function groupForLayer(id: CanvasLayerId) {
    return layerGroupByLayerId.get(id) ?? null;
  }

  function selectableAssemblyFor(id: CanvasLayerId): CanvasLayerId[] {
    const ids = groupForLayer(id)?.layerIds ?? [id];
    return ids.filter(layerVisible);
  }

  function selectCanvasAssembly(id: CanvasLayerId, additive = false) {
    const targetIds = selectableAssemblyFor(id);
    setSelectedCanvasLayerIds((current) => nextCanvasLayerSelection(current, targetIds, id, additive));
    if (additive && targetIds.every((layerId) => selectedCanvasLayerIdSet.has(layerId))) {
      const targetIdSet = new Set(targetIds);
      const remaining = selectedCanvasLayerIds.filter((layerId) => !targetIdSet.has(layerId));
      setSelectedLayerId(remaining.at(-1) ?? null);
    } else {
      setSelectedLayerId(id);
    }
    setSelectionMenuPosition(null);
  }

  function deselectCanvasLayers() {
    setSelectedCanvasLayerIds([]);
    setSelectedLayerId(null);
    setSelectionMenuPosition(null);
  }

  function selectLayerFromStack(id: CompositionLayerId) {
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds(isCanvasLayerId(id) ? selectableAssemblyFor(id) : []);
    setSelectionMenuPosition(null);
  }

  function updateCanvasLayerTransform(id: CanvasLayerId, nextTransform: CanvasLayerTransform) {
    const currentTransform = canvasLayerTransform(id);
    if (!currentTransform) return;
    const selectedIds = selectedCanvasLayerIdSet.has(id)
      ? selectedCanvasLayerIds
      : selectableAssemblyFor(id);
    if (selectedIds.length <= 1) {
      updateCanvasLayerTransforms(new Map([[id, nextTransform]]));
      return;
    }
    const deltaX = nextTransform.x - currentTransform.x;
    const deltaY = nextTransform.y - currentTransform.y;
    const updates = new Map<CanvasLayerId, CanvasLayerTransform>();
    selectedIds.forEach((layerId) => {
      const transform = canvasLayerTransform(layerId);
      if (!transform) return;
      updates.set(layerId, { ...transform, x: transform.x + deltaX, y: transform.y + deltaY });
    });
    updateCanvasLayerTransforms(updates);
  }

  const selectedCanvasItems = selectedCanvasLayerIds.flatMap((layerId): CanvasSelectionItem[] => {
    const transform = canvasLayerTransform(layerId);
    return transform ? [{ geometry: layerGeometry(layerId, canvasDimensions), transform }] : [];
  });
  const selectedCanvasBounds = canvasSelectionBounds(selectedCanvasItems);
  const selectedCanvasGroup = layerGroups.find((group) => (
    group.layerIds.length === selectedCanvasLayerIds.length
    && group.layerIds.every((layerId) => selectedCanvasLayerIdSet.has(layerId))
  )) ?? null;
  const selectedGroupedAssemblies = layerGroups.filter((group) => (
    group.layerIds.some((layerId) => selectedCanvasLayerIdSet.has(layerId))
  ));

  function movementBoundsFor(id: CanvasLayerId): CanvasLayerBounds | null {
    const layerIds = selectedCanvasLayerIdSet.has(id) && selectedCanvasLayerIds.length > 1
      ? selectedCanvasLayerIds
      : groupForLayer(id)?.layerIds ?? [];
    if (layerIds.length < 2) return null;
    return canvasSelectionBounds(layerIds.flatMap((layerId): CanvasSelectionItem[] => {
      const transform = canvasLayerTransform(layerId);
      return transform ? [{ geometry: layerGeometry(layerId, canvasDimensions), transform }] : [];
    }));
  }

  function openCanvasSelectionMenu(id: CanvasLayerId, event: ReactMouseEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!selectedCanvasLayerIdSet.has(id)) selectCanvasAssembly(id);
    setSelectionMenuPosition(contextMenuPositionFromEvent(event));
  }

  function groupCanvasSelection() {
    if (selectedCanvasLayerIds.length < 2) return;
    const layerIds = [...selectedCanvasLayerIds];
    const layerIdSet = new Set(layerIds);
    const id = `group-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as CompositionLayerGroupId;
    setLayerGroups((current) => {
      const nextNumber = current.reduce((largest, group) => {
        const match = /^Group (\d+)$/.exec(group.name);
        return Math.max(largest, Number(match?.[1] ?? 0));
      }, 0) + 1;
      return [
        ...current.filter((group) => !group.layerIds.some((layerId) => layerIdSet.has(layerId))),
        { id, layerIds, name: `Group ${nextNumber}` },
      ];
    });
  }

  function ungroupCanvasSelection() {
    if (selectedCanvasLayerIds.length === 0) return;
    setLayerGroups((current) => current.filter((group) => (
      !group.layerIds.some((layerId) => selectedCanvasLayerIdSet.has(layerId))
    )));
  }

  function alignCanvasAssembly(alignment: CanvasLayerAlignment) {
    if (selectedCanvasItems.length === 0) return;
    const transforms = alignCanvasSelection(
      selectedCanvasItems,
      canvasDimensions.width,
      canvasDimensions.height,
      alignment
    );
    const updates = new Map<CanvasLayerId, CanvasLayerTransform>();
    selectedCanvasLayerIds.forEach((layerId, index) => {
      const transform = transforms[index];
      if (transform) updates.set(layerId, transform);
    });
    updateCanvasLayerTransforms(updates);
  }

  function moveCanvasSelection(direction: -1 | 1) {
    const selected = new Set<CompositionLayerId>(selectedCanvasLayerIds);
    setLayerOrder((current) => {
      const next = [...current];
      if (direction > 0) {
        for (let index = next.length - 2; index >= 0; index -= 1) {
          if (selected.has(next[index]!) && !selected.has(next[index + 1]!)) {
            [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
          }
        }
      } else {
        for (let index = 1; index < next.length; index += 1) {
          if (selected.has(next[index]!) && !selected.has(next[index - 1]!)) {
            [next[index], next[index - 1]] = [next[index - 1]!, next[index]!];
          }
        }
      }
      return next;
    });
  }

  function removeCanvasSelection() {
    if (selectedCanvasLayerIds.length === 0) return;
    const idSet = new Set(selectedCanvasLayerIds);
    selectedCanvasLayerIds.forEach(removeLayer);
    setLayerGroups((current) => current.filter((group) => (
      !group.layerIds.some((layerId) => idSet.has(layerId))
    )));
    deselectCanvasLayers();
  }

  function duplicateCanvasSelection() {
    const sourceIds = layerOrder.filter((layerId): layerId is CanvasLayerId => (
      isCanvasLayerId(layerId) && selectedCanvasLayerIdSet.has(layerId)
    ));
    const nextIds = sourceIds.flatMap((layerId): CanvasLayerId[] => {
      const nextId = duplicateLayer(layerId);
      return nextId && isCanvasLayerId(nextId) ? [nextId] : [];
    });
    if (nextIds.length === 0) return;
    if (selectedCanvasGroup && nextIds.length > 1) {
      const id = `group-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as CompositionLayerGroupId;
      setLayerGroups((current) => [...current, {
        id,
        layerIds: nextIds,
        name: `${selectedCanvasGroup.name} copy`,
      }]);
    }
    setSelectedCanvasLayerIds(nextIds);
    setSelectedLayerId(nextIds.at(-1) ?? null);
  }

  function handleCanvasAssemblyKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (
      event.target instanceof HTMLElement
      && (event.target.isContentEditable || event.target.closest('input, textarea, select'))
    ) return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === 'g') {
      event.preventDefault();
      if (event.shiftKey) ungroupCanvasSelection();
      else groupCanvasSelection();
      return;
    }
    if (command && event.key.toLowerCase() === 'd') {
      event.preventDefault();
      duplicateCanvasSelection();
      return;
    }
    if ((event.key === 'Backspace' || event.key === 'Delete') && selectedCanvasLayerIds.length > 0) {
      event.preventDefault();
      removeCanvasSelection();
    }
  }

  return {
    alignCanvasAssembly,
    deselectCanvasLayers,
    duplicateCanvasSelection,
    groupCanvasSelection,
    groupForLayer,
    handleCanvasAssemblyKeyDown,
    movementBoundsFor,
    moveCanvasSelection,
    openCanvasSelectionMenu,
    removeCanvasSelection,
    selectCanvasAssembly,
    selectedCanvasBounds,
    selectedCanvasGroup,
    selectedCanvasLayerIdSet,
    selectedGroupedAssemblies,
    selectLayerFromStack,
    ungroupCanvasSelection,
    updateCanvasLayerTransform,
  };
}

type DesignArtboardMenuState = {
  artboardId: DesignArtboardId;
  position: StudioContextMenuPosition;
};

type LayerDockMenuState = {
  layerId: CompositionLayerId;
  position: StudioContextMenuPosition;
};

function DesignArtboardContextMenu({
  activeArtboardId,
  artboards,
  menu,
  onArrange,
  onClose,
  onDelete,
  onDuplicate,
  onFocus,
  onNew,
}: {
  activeArtboardId: DesignArtboardId;
  artboards: readonly DesignArtboard[];
  menu: DesignArtboardMenuState | null;
  onArrange: () => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onFocus: (id: DesignArtboardId) => void;
  onNew: () => void;
}) {
  const artboard = menu ? artboards.find(({ id }) => id === menu.artboardId) ?? null : null;
  return (
    <StudioContextMenu
      detail={artboard ? `${artboard.snapshot.dimensions.width} × ${artboard.snapshot.dimensions.height}` : undefined}
      label={artboard?.name ?? 'Artboard'}
      onClose={onClose}
      position={menu?.position ?? null}
      sections={artboard ? [
        {
          items: [
            {
              checked: artboard.id === activeArtboardId,
              icon: <Frame aria-hidden='true' />,
              id: 'focus-artboard',
              label: 'Focus artboard',
              onSelect: () => onFocus(artboard.id),
            },
            { icon: <Copy aria-hidden='true' />, id: 'duplicate-artboard', label: 'Duplicate artboard', onSelect: onDuplicate, shortcut: '⌘D' },
            { icon: <Plus aria-hidden='true' />, id: 'new-artboard', label: 'New artboard', onSelect: onNew },
          ],
        },
        {
          label: 'Workspace',
          items: [
            { icon: <LayoutGrid aria-hidden='true' />, id: 'arrange-artboards', label: 'Arrange all artboards', onSelect: onArrange },
          ],
        },
        {
          items: [
            { danger: true, disabled: artboards.length <= 1, icon: <Trash2 aria-hidden='true' />, id: 'delete-artboard', label: 'Delete artboard', onSelect: onDelete },
          ],
        },
      ] : []}
    />
  );
}

function LayerDockContextMenu({
  layerKind,
  layerLabel,
  layerOrder,
  layerVisible,
  menu,
  onClose,
  onDelete,
  onDuplicate,
  onMove,
  onToggleVisibility,
}: {
  layerKind: (id: CompositionLayerId) => string;
  layerLabel: (id: CompositionLayerId) => string;
  layerOrder: readonly CompositionLayerId[];
  layerVisible: (id: CompositionLayerId) => boolean;
  menu: LayerDockMenuState | null;
  onClose: () => void;
  onDelete: (id: CompositionLayerId) => void;
  onDuplicate: (id: CompositionLayerId) => void;
  onMove: (id: CompositionLayerId, direction: -1 | 1) => void;
  onToggleVisibility: (id: CompositionLayerId) => void;
}) {
  const layerId = menu && layerOrder.includes(menu.layerId) ? menu.layerId : null;
  const visible = layerId ? layerVisible(layerId) : false;
  const orderIndex = layerId ? layerOrder.indexOf(layerId) : -1;
  return (
    <StudioContextMenu
      detail={layerId ? layerKind(layerId) : undefined}
      label={layerId ? layerLabel(layerId) : 'Layer'}
      onClose={onClose}
      position={menu?.position ?? null}
      sections={layerId ? [
        {
          items: [
            { icon: <Copy aria-hidden='true' />, id: 'duplicate-layer', label: 'Duplicate layer', onSelect: () => onDuplicate(layerId), shortcut: '⌘D' },
            {
              checked: visible,
              icon: visible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />,
              id: 'toggle-layer',
              label: visible ? 'Layer visible' : 'Layer hidden',
              onSelect: () => onToggleVisibility(layerId),
            },
          ],
        },
        {
          label: 'Layer order',
          items: [
            { disabled: orderIndex === layerOrder.length - 1, icon: <ArrowUp aria-hidden='true' />, id: 'move-layer-forward', label: 'Bring forward', onSelect: () => onMove(layerId, 1) },
            { disabled: orderIndex === 0, icon: <ArrowDown aria-hidden='true' />, id: 'move-layer-backward', label: 'Send backward', onSelect: () => onMove(layerId, -1) },
          ],
        },
        {
          items: [
            { danger: true, icon: <Trash2 aria-hidden='true' />, id: 'delete-layer', label: 'Delete layer', onSelect: () => onDelete(layerId), shortcut: '⌫' },
          ],
        },
      ] : []}
    />
  );
}

export default function ShaderLabStudio({
  active = true,
  automationToolId,
  identity,
  navigation,
  onIdentitySave,
  tool,
}: {
  active?: boolean;
  automationToolId?: StudioToolId;
  identity: BrandIdentity;
  navigation?: ReactNode;
  onIdentitySave?: (identity: BrandIdentity) => void;
  tool: StudioTool;
}) {
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:design-lab`);
  const brandPalette = useMemo(() => brandMaterialPalette(identity), [identity]);
  const initialSettings = useMemo(() => shaderLabSettingsFor(DEFAULT_SHADER_MATERIAL_ID, {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    colorA: brandPalette.colors[0],
    colorB: brandPalette.colors[1],
    colorC: brandPalette.colors[2],
  }), [brandPalette.colors]);
  const builtInLogo = resolveDesignLabBrandLogo(identity);
  const initialShaderLayer = useMemo<CompositionShaderLayer>(() => ({
    ...shaderApplicationFor(DEFAULT_SHADER_MATERIAL_ID, brandPalette.colors),
    id: DEFAULT_CANVAS_SHADER_ID,
    name: 'Canvas shader 1',
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    visible: true,
  }), [brandPalette.colors]);
  const legacyDefaultShaderLayer = useMemo<CompositionShaderLayer>(() => ({
    ...shaderApplicationFor(LEGACY_DEFAULT_SHADER_MATERIAL_ID, brandPalette.colors),
    id: DEFAULT_CANVAS_SHADER_ID,
    name: 'Canvas shader 1',
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    visible: true,
  }), [brandPalette.colors]);
  const stageRef = useRef<HTMLDivElement>(null);
  const projectWorkspaceActiveRef = useAncestorWorkspaceActivity(stageRef);
  const defaultShaderMigrationRef = useRef('');
  const effectCanvasRefs = useRef<Map<EffectLayerId, HTMLCanvasElement>>(new Map());
  const effectScratchRefs = useRef<Map<EffectLayerId, CompositionEffectScratch>>(new Map());
  const effectPreviewBufferRef = useRef<HTMLCanvasElement | null>(null);
  const effectPreviewOverridesRef = useRef<Map<EffectLayerId, {
    opacity?: number;
    settings?: Partial<CompositionEffectSettings>;
  }>>(new Map());
  const textEffectScratchRefs = useRef<Map<TextLayerId, TextEffectRenderScratch>>(new Map());
  const logoInputRef = useRef<HTMLInputElement>(null);
  const materialLibraryRef = useRef<HTMLElement>(null);
  const materialLoadMoreRef = useRef<HTMLButtonElement>(null);
  const imageImportRequestIdRef = useRef(0);
  const selectMaterialRef = useCommittedRef(selectMaterial);
  const handleMaterialSelect = useCallback((materialId: LiveMaterialId) => {
    selectMaterialRef.current(materialId);
  }, [selectMaterialRef]);
  const convertedAssetLibrary = useConvertedAssets();
  const compositionAssetUrlsRef = useRef<string[]>([]);
  const previewFrameRef = useRef(0);
  const sequenceCaptureRef = useRef<ShaderSequenceCapture | null>(null);
  const sequencePreviewAnimationRef = useRef(0);
  const sequencePreviewElapsedRef = useRef(0);
  const sequencePreviewLastTimeRef = useRef(0);
  const sequencePreviewTickRef = useRef<FrameRequestCallback>(() => {});
  const sequencePreviewRestorePausedRef = useRef(false);
  const workspaceActiveRef = useCommittedRef(active);
  const livePreviewRuntimeReady = useDeferredRuntime(active, 150, {
    deferWhileInteracting: true,
    useIdleCallback: false,
  });
  const [compositionDocumentCreatedAt] = useState(() => new Date().toISOString());
  const [shaderLayers, setShaderLayers] = useStudioDraft<CompositionShaderLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v3-canvas-shaders',
    [initialShaderLayer]
  );
  const [effectLayers, setEffectLayers] = useStudioDraft<CompositionEffectLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v4-composition-effects',
    []
  );
  const [layerShaders, setLayerShaders] = useStudioDraft<Partial<Record<ContentLayerId, ShaderApplication>>>(
    identity.id,
    tool.id,
    'shader-lab-v3-layer-shaders',
    {}
  );
  const [ratio, setRatio] = useStudioDraft<ShaderRatio>(identity.id, tool.id, 'shader-lab-v2-ratio', 'wide');
  const [storedCanvasDimensions, setCanvasDimensions] = useStudioDraft<StudioArtboardDimensions>(
    identity.id,
    tool.id,
    'shader-lab-v1-canvas-dimensions',
    studioDimensionsForRatio(ratio)
  );
  useEffect(() => {
    // Older drafts persisted only a ratio. Migrate their exact historical
    // dimensions once, before the new independent width/height draft exists.
    try {
      const dimensionsKey = `glyphfield-draft-v1:${identity.id}:${tool.id}:shader-lab-v1-canvas-dimensions`;
      if (window.localStorage.getItem(dimensionsKey) !== null) return;
      const ratioKey = `glyphfield-draft-v1:${identity.id}:${tool.id}:shader-lab-v2-ratio`;
      const storedRatio = JSON.parse(window.localStorage.getItem(ratioKey) ?? 'null') as unknown;
      if (!isShaderRatio(storedRatio)) return;
      setCanvasDimensions(studioDimensionsForRatio(storedRatio));
    } catch {
      // Storage can be disabled; the in-memory default remains usable.
    }
  }, [identity.id, setCanvasDimensions, tool.id]);
  const [exportSettings, setExportSettings] = useStudioDraft<DesignExportSettings>(
    identity.id,
    tool.id,
    'shader-lab-v3-export-settings',
    DEFAULT_EXPORT_SETTINGS
  );
  useMountEffect(() => {
    // Lift untouched 15 FPS drafts to the denser default without rewriting
    // deliberate low-frame-rate export settings.
    try {
      const storageKey = `glyphfield-draft-v1:${identity.id}:${tool.id}:shader-lab-v3-export-settings`;
      const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? 'null') as Partial<DesignExportSettings> | null;
      if (!stored) return;
      const normalized = normalizeDesignExportSettings(stored);
      const isLegacyDefault = normalized.fps === 15
        && normalized.durationMs === 1_600
        && normalized.width === 960
        && normalized.quality === 'balanced'
        && normalized.gifLoop === 'seamless';
      if (isLegacyDefault) setExportSettings({ ...normalized, fps: DEFAULT_EXPORT_SETTINGS.fps });
    } catch {
      // Storage can be unavailable or malformed; the current draft remains valid.
    }
  });
  const [shaderSequenceSettings, setShaderSequenceSettings] = useStudioDraft<DesignShaderSequenceSettings>(
    identity.id,
    tool.id,
    'shader-lab-v1-shader-sequence',
    DEFAULT_DESIGN_SHADER_SEQUENCE_SETTINGS
  );
  const [canvasBackground, setCanvasBackground] = useStudioDraft(
    identity.id,
    tool.id,
    'shader-lab-v3-canvas-background',
    DEFAULT_CANVAS_BACKGROUND
  );
  const [textLayers, setTextLayers] = useStudioDraft<CompositionTextLayer[]>(
    identity.id,
    tool.id,
    'shader-lab-v2-text-layers-v1',
    []
  );
  const [storedLayerGroups, setLayerGroups] = useStudioDraft<CompositionLayerGroup[]>(
    identity.id,
    tool.id,
    'shader-lab-v1-layer-groups',
    []
  );
  const [paused, setPaused] = useState(false);
  const [previewFrame, setPreviewFrame] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ShaderLabCategory>('all');
  const [visibleMaterialCount, setVisibleMaterialCount] = useState(SHADER_LIBRARY_INITIAL_CARD_COUNT);
  const [logoLayers, setLogoLayers] = useState<CompositionLogoLayer[]>(() => [{
    appearance: { ...DEFAULT_LOGO_APPEARANCE },
    color: '#FFFFFF',
    id: DEFAULT_LOGO_LAYER_ID,
    name: 'Brand mark',
    opacity: 1,
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    url: builtInLogo,
    visible: true,
  }]);
  const [compositionAssets, setCompositionAssets] = useState<CompositionAsset[]>([]);
  const [storedLayerOrder, setLayerOrder] = useState<CompositionLayerId[]>(
    () => [...DEFAULT_DESIGN_LAB_LAYER_ORDER]
  );
  const [storedSelectedLayerId, setSelectedLayerId] = useState<CompositionLayerId | null>(
    DEFAULT_DESIGN_LAB_SELECTED_LAYER_ID
  );
  const [storedSelectedCanvasLayerIds, setSelectedCanvasLayerIds] = useState<CanvasLayerId[]>(
    [DEFAULT_DESIGN_LAB_SELECTED_LAYER_ID]
  );
  const [selectionMenuPosition, setSelectionMenuPosition] = useState<CanvasSelectionMenuPosition | null>(null);
  const [artboardMenu, setArtboardMenu] = useState<DesignArtboardMenuState | null>(null);
  const [layerDockMenu, setLayerDockMenu] = useState<LayerDockMenuState | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [canvasClipboardStatus, setCanvasClipboardStatus] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [captureTimeMs, setCaptureTimeMs] = useState<number | null>(null);
  const [sequenceCapture, setSequenceCapture] = useState<ShaderSequenceCapture | null>(null);
  const [sequencePreviewing, setSequencePreviewing] = useState(false);
  const [exporting, setExporting] = useState<'gif' | 'jpg' | 'mp4' | 'png' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [imageDropActive, setImageDropActive] = useState(false);
  const [imageImportState, setImageImportState] = useState<ImageImportState>({ message: '', status: 'idle' });
  const [imageImportOpen, setImageImportOpen] = useState(false);
  const [imagePlacementMode, setImagePlacementMode] = useState<ImageAssetPlacementMode>('image');
  const [imageImportRequest, setImageImportRequest] = useState<ImageImportRequest | null>(null);
  const [imageImportError, setImageImportError] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [lastExportRequest, setLastExportRequest] = useState<DesignExportRequest | null>(null);
  const [activeArtboardId, setActiveArtboardId] = useStudioDraft<DesignArtboardId>(
    identity.id,
    tool.id,
    'design-lab-active-artboard-v1',
    DEFAULT_DESIGN_ARTBOARD_ID
  );
  const [artboards, setArtboards] = useState<DesignArtboard[]>(() => [{
    id: DEFAULT_DESIGN_ARTBOARD_ID,
    name: 'Artboard 1',
    snapshot: {
      assets: compositionAssets,
      backgroundColor: canvasBackground,
      dimensions: normalizeStudioArtboardDimensions(storedCanvasDimensions),
      effectLayers,
      groups: storedLayerGroups,
      layerOrder: storedLayerOrder,
      layerShaders,
      logos: logoLayers,
      ratio,
      shaderLayers,
      shaderSequence: shaderSequenceSettings,
      textLayers,
      timeline: { frame: 0, paused: false },
    },
    x: 280,
    y: 240,
  }]);
  const [workspaceTourOpen, setWorkspaceTourOpen] = useStudioDraft(
    identity.id,
    tool.id,
    'design-lab-artboard-tour-v1',
    true
  );
  const [workspaceTourStep, setWorkspaceTourStep] = useState(0);
  const [motionWorkspaceOpen, setMotionWorkspaceOpen] = useState(false);
  const [artboardPickerOpen, setArtboardPickerOpen] = useState(false);
  const [artboardFocusRequest, setArtboardFocusRequest] = useState<{ id: DesignArtboardId; revision: number } | null>(null);
  const [workspaceFitRevision, setWorkspaceFitRevision] = useState(0);
  const pendingArtboardApplyRef = useRef<{ id: DesignArtboardId; signature: string } | null>(null);
  const designLabClipboardRef = useRef<string | null>(null);
  const imagePlacementModeRef = useRef<ImageAssetPlacementMode>('image');
  const canvasClipboardStatusTimerRef = useRef<number | null>(null);
  const artboardPickerRef = useRef<HTMLDivElement>(null);

  useDismissibleMenu(
    artboardPickerRef,
    () => setArtboardPickerOpen(false),
    '.design-artboard-picker'
  );

  useEffect(() => {
    const candidates = [
      ...logoLayers.map(({ id, url }) => ({ id, url })),
      ...compositionAssets.map(({ id, url }) => ({ id, url })),
    ].filter(({ url }) => !/^data:[^,]+;base64,/i.test(url));
    if (candidates.length === 0) return;
    let cancelled = false;
    void Promise.allSettled(candidates.map(async ({ id, url }) => (
      [id, await imageUrlToDataUrl(url)] as const
    ))).then((results) => {
      if (cancelled) return;
      const embeddedSources = new Map(results.flatMap((result) => (
        result.status === 'fulfilled' ? [result.value] : []
      )));
      if (embeddedSources.size === 0) return;
      setLogoLayers((current) => current.map((layer) => {
        const url = embeddedSources.get(layer.id);
        return url && url !== layer.url ? { ...layer, url } : layer;
      }));
      setCompositionAssets((current) => current.map((asset) => {
        const url = embeddedSources.get(asset.id);
        return url && url !== asset.url ? { ...asset, url } : asset;
      }));
    });
    return () => {
      cancelled = true;
    };
  }, [compositionAssets, logoLayers]);

  const canvasDimensions = useMemo(
    () => normalizeStudioArtboardDimensions(storedCanvasDimensions, studioDimensionsForRatio(ratio)),
    [ratio, storedCanvasDimensions]
  );
  const ratioOption = RATIO_OPTIONS.find((option) => option.value === ratio) ?? {
    ...canvasDimensions,
    label: 'Custom',
    value: 'custom' as const,
  };
  const normalizedExportSettings = useMemo(
    () => normalizeDesignExportSettings(exportSettings),
    [exportSettings]
  );
  const previewFrames = useMemo(
    () => buildMotionFrames(normalizedExportSettings.durationMs, normalizedExportSettings.fps),
    [normalizedExportSettings.durationMs, normalizedExportSettings.fps]
  );
  const boundedPreviewFrame = resolveMotionFrame(
    normalizedExportSettings.durationMs,
    normalizedExportSettings.fps,
    previewFrame
  ).index;
  const previewCaptureTimeMs = previewFrames[boundedPreviewFrame]!.timeMs;
  const exportDimensions = resolveExportDimensions({
    aspectHeight: ratioOption.height,
    aspectWidth: ratioOption.width,
    width: normalizedExportSettings.width,
  });
  const normalizedShaderSequenceBase = useMemo(
    () => normalizeShaderSequenceSettings(shaderSequenceSettings),
    [shaderSequenceSettings]
  );
  const sequencePresentation = useMemo(
    () => resolveShaderSequencePresentation(
      shaderLayers,
      shaderSequenceSettings,
      normalizedShaderSequenceBase
    ),
    [normalizedShaderSequenceBase, shaderLayers, shaderSequenceSettings]
  );
  const {
    duration: shaderSequenceDuration,
    materialIds: sequenceMaterialIds,
    settings: normalizedShaderSequenceSettings,
    targetLayer: sequenceTargetLayer,
    targetOptions: sequenceTargetOptions,
    timeline: shaderSequenceTimeline,
  } = sequencePresentation;
  const layerOrder = useMemo(() => reconcileDesignLabLayerOrder({
    assets: compositionAssets.map(({ id }) => id),
    effects: effectLayers.map(({ id }) => id),
    logos: logoLayers.map(({ id }) => id),
    shaders: shaderLayers.map(({ id }) => id),
    stored: storedLayerOrder,
    text: textLayers.map(({ id }) => id),
  }) as CompositionLayerId[], [compositionAssets, effectLayers, logoLayers, shaderLayers, storedLayerOrder, textLayers]);
  const layerOrderIdSet = useMemo(() => new Set<CompositionLayerId>(layerOrder), [layerOrder]);
  const selectedLayerId = storedSelectedLayerId && layerOrderIdSet.has(storedSelectedLayerId)
    ? storedSelectedLayerId
    : null;
  const canvasLayerIds = useMemo<CanvasLayerId[]>(() => [
    ...shaderLayers.map(({ id }) => id),
    ...textLayers.map(({ id }) => id),
    ...logoLayers.map(({ id }) => id),
    ...compositionAssets.map(({ id }) => id),
  ], [compositionAssets, logoLayers, shaderLayers, textLayers]);
  const canvasLayerIdSet = useMemo(() => new Set<CanvasLayerId>(canvasLayerIds), [canvasLayerIds]);
  const layerGroups = useMemo(
    () => reconcileDesignLabLayerGroups(storedLayerGroups, canvasLayerIds) as CompositionLayerGroup[],
    [canvasLayerIds, storedLayerGroups]
  );
  const currentArtboardSnapshot = useMemo<DesignArtboardSnapshot>(() => ({
    assets: compositionAssets,
    backgroundColor: canvasBackground,
    dimensions: canvasDimensions,
    effectLayers,
    groups: layerGroups,
    layerOrder,
    layerShaders,
    logos: logoLayers,
    ratio,
    shaderLayers,
    shaderSequence: normalizedShaderSequenceSettings,
    textLayers,
    timeline: { frame: boundedPreviewFrame, paused },
  }), [
    canvasBackground,
    canvasDimensions,
    compositionAssets,
    effectLayers,
    layerGroups,
    layerOrder,
    layerShaders,
    logoLayers,
    normalizedShaderSequenceSettings,
    ratio,
    shaderLayers,
    textLayers,
    boundedPreviewFrame,
    paused,
  ]);
  const currentArtboardSignature = useMemo(
    () => artboardSnapshotSignature(currentArtboardSnapshot),
    [currentArtboardSnapshot]
  );
  const currentArtboardPersistenceSignature = useMemo(
    () => artboardSnapshotPersistenceSignature(currentArtboardSnapshot),
    [currentArtboardSnapshot]
  );
  const pendingArtboardApply = pendingArtboardApplyRef.current;
  const activeArtboardSnapshotReady = artboardSnapshotReady(
    pendingArtboardApply,
    activeArtboardId,
    currentArtboardSignature
  );
  const workspaceArtboards = useMemo(() => artboards.map((artboard) => (
    artboard.id === activeArtboardId && activeArtboardSnapshotReady
      ? { ...artboard, snapshot: currentArtboardSnapshot }
      : artboard
  )), [activeArtboardId, activeArtboardSnapshotReady, artboards, currentArtboardSnapshot]);
  const workspaceArtboardsRef = useCommittedRef(workspaceArtboards);
  const activeArtboardIdRef = useCommittedRef(activeArtboardId);
  const currentArtboardSnapshotRef = useCommittedRef(currentArtboardSnapshot);
  const designHistoryRef = useRef<DesignCanvasHistoryState>({ future: [], past: [], present: null });
  const designHistoryTimerRef = useRef(0);
  const designHistorySequenceRef = useRef(0);
  const designHistoryRestoreSignatureRef = useRef<string | null>(null);
  const [designHistoryRevision, setDesignHistoryRevision] = useState(0);
  const designHistorySignature = useMemo(
    () => designCanvasHistorySignature(workspaceArtboards),
    [workspaceArtboards]
  );
  const activeArtboard = resolveActiveDesignArtboard(workspaceArtboards, activeArtboardId);
  const activeArtboardRawName = activeArtboard?.name ?? '';
  const activeArtboardName = resolvedDesignArtboardName(activeArtboard?.name);
  const workspaceSize = useMemo(
    () => designArtboardWorkspaceSize(workspaceArtboards),
    [workspaceArtboards]
  );
  const selectedCanvasLayerIds = useMemo(
    () => storedSelectedCanvasLayerIds.filter((id) => canvasLayerIdSet.has(id)),
    [canvasLayerIdSet, storedSelectedCanvasLayerIds]
  );
  const savedDesignRevision = useMemo(() => `${designExportSettingsSignature(ratio, normalizedExportSettings)}:${JSON.stringify({
    activeArtboardId,
    artboards: workspaceArtboards,
    background: canvasBackground,
    layerOrder,
    layerGroups,
    layerShaders,
    layers: {
      assets: compositionAssets,
      effects: effectLayers,
      logos: logoLayers,
      shaders: shaderLayers,
      text: textLayers,
    },
    shaderSequence: normalizedShaderSequenceSettings,
  })}`, [activeArtboardId, canvasBackground, compositionAssets, effectLayers, layerGroups, layerOrder, layerShaders, logoLayers, normalizedExportSettings, normalizedShaderSequenceSettings, ratio, shaderLayers, textLayers, workspaceArtboards]);
  const savedDesignWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identity.id, tool.id),
    [identity.id, tool.id]
  );
  const compositionSignature = `${savedDesignRevision}:frame=${boundedPreviewFrame}:paused=${paused}`;
  const designLabDocument = useMemo(() => createDesignLabCanvasDocument({
    assets: compositionAssets,
    backgroundColor: canvasBackground,
    brandId: identity.id,
    createdAt: compositionDocumentCreatedAt,
    effectLayers,
    exportSettings: normalizedExportSettings,
    groups: layerGroups,
    height: canvasDimensions.height,
    id: `${identity.id}:${tool.id}:composition`,
    layerOrder,
    layerShaders,
    logos: logoLayers,
    ratio,
    revision: canvasRevisionFromSignature(compositionSignature),
    shaderLayers,
    shaderSequence: normalizedShaderSequenceSettings,
    textLayers,
    timeline: { frame: boundedPreviewFrame, paused },
    title: `${identity.name} ${tool.name}`,
    updatedAt: compositionDocumentCreatedAt,
    width: canvasDimensions.width,
    workspace: {
      activeArtboardId,
      artboards: workspaceArtboards,
    },
  }), [
    activeArtboardId,
    canvasBackground,
    boundedPreviewFrame,
    canvasDimensions.height,
    canvasDimensions.width,
    compositionAssets,
    compositionDocumentCreatedAt,
    compositionSignature,
    effectLayers,
    identity.id,
    identity.name,
    layerGroups,
    layerOrder,
    layerShaders,
    logoLayers,
    normalizedExportSettings,
    normalizedShaderSequenceSettings,
    paused,
    ratio,
    shaderLayers,
    textLayers,
    tool.id,
    tool.name,
    workspaceArtboards,
  ]);
  const portableDesignLab = usePortableCanvasWorkspace({
    applySource: applyCompositionSource,
    document: designLabDocument,
    workspaceKey: savedDesignWorkspaceKey,
  });
  const compositionAutosaveState = portableDesignLab.autosaveState;
  const workspaceAutosaveLabel = compositionAutosaveState === 'loading'
    ? 'Restoring autosaved workspace…'
    : compositionAutosaveState === 'preparing'
      ? 'Preparing autosave…'
      : compositionAutosaveState === 'saving'
        ? 'Autosaving…'
        : compositionAutosaveState === 'error'
          ? 'Autosave needs attention'
          : `${workspaceArtboards.length} artboard${workspaceArtboards.length === 1 ? '' : 's'} · autosaved`;
  useEffect(() => {
    if (compositionAutosaveState !== 'loading') setDraftHydrated(true);
  }, [compositionAutosaveState]);
  useEffect(() => {
    if (compositionAutosaveState === 'loading' || artboards.some(({ id }) => id === activeArtboardId)) return;
    const fallbackId = artboards[0]?.id;
    if (!fallbackId) return;
    activeArtboardIdRef.current = fallbackId;
    setActiveArtboardId(fallbackId);
  }, [activeArtboardId, activeArtboardIdRef, artboards, compositionAutosaveState, setActiveArtboardId]);
  const currentExportSettingsSignature = compositionSignature;
  const previewNeedsRefresh = Boolean(
    lastExportRequest && lastExportRequest.settingsSignature !== currentExportSettingsSignature
  );
  const designHistoryView = designHistoryRef.current;
  const canvasActionHistory = presentCanvasActionHistory(
    designHistoryView,
    designHistorySignature,
    redoDesignCanvas,
    undoDesignCanvas
  );
  void designHistoryRevision;

  useEffect(() => {
    cancelAnimationFrame(sequencePreviewAnimationRef.current);
    sequencePreviewAnimationRef.current = 0;
    if (!active || !sequencePreviewing) return;
    sequencePreviewLastTimeRef.current = performance.now();
    sequencePreviewAnimationRef.current = requestAnimationFrame(sequencePreviewTickRef.current);
    return () => cancelAnimationFrame(sequencePreviewAnimationRef.current);
  }, [active, sequencePreviewing]);
  const materials = useMemo(() => shaderLabMaterials(query, category), [category, query]);
  const visibleMaterials = useMemo(
    () => materials.slice(0, visibleMaterialCount),
    [materials, visibleMaterialCount]
  );
  const remainingMaterialCount = Math.max(0, materials.length - visibleMaterials.length);

  useEffect(() => {
    const sentinel = materialLoadMoreRef.current;
    const root = materialLibraryRef.current;
    if (!sentinel || !root || remainingMaterialCount === 0) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisibleMaterialCount((count) => Math.min(materials.length, count + SHADER_LIBRARY_CARD_BATCH_SIZE));
    }, { root, rootMargin: '240px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [materials.length, remainingMaterialCount]);
  const selectedEffectLayer = isEffectLayerId(selectedLayerId)
    ? effectLayers.find(({ id }) => id === selectedLayerId) ?? null
    : null;
  const {
    activeMaterialId,
    contentLayerId: selectedContentLayerId,
    editingShader,
    layerShader: selectedLayerShader,
    material,
    previewChannel: selectedShaderPreviewChannel,
    settings,
    shaderLayer: selectedShaderLayer,
    shaderSize,
  } = resolveShaderEditingSelection({
    initialSettings,
    layerShaders,
    selectedLayerId,
    shaderLayers,
  });
  const {
    asset: selectedAsset,
    assetAppearance: selectedAssetAppearance,
    assetInspector: selectedAssetInspector,
    logoAppearance: selectedLogoAppearance,
    logoInspector: selectedLogoInspector,
    logoLayer: selectedLogoLayer,
    textAppearance: selectedTextAppearance,
    textInspector: selectedTextInspector,
    textLayer: selectedTextLayer,
    textRenderedWeight: selectedTextRenderedWeight,
    textTransform: selectedTextTransform,
    textWeightRange: selectedTextWeightRange,
  } = resolveContentLayerSelection({
    assets: compositionAssets,
    identity,
    logos: logoLayers,
    selectedLayerId,
    textLayers,
  });
  const layerGroupByLayerId = useMemo(() => {
    const groups = new Map<CanvasLayerId, CompositionLayerGroup>();
    for (const group of layerGroups) {
      for (const layerId of group.layerIds) groups.set(layerId, group);
    }
    return groups;
  }, [layerGroups]);
  const {
    duplicateLayer,
    layerLabel,
    removeLayer,
    removeShaderFromSelectedContent,
    resolvedLayerKind,
    toggleLayerVisibility,
  } = useDesignLabLayerActions({
    compositionAssets,
    effectLayers,
    layerShaders,
    logoLayers,
    removeAsset,
    removeEffectLayer,
    removeLogoLayer,
    removeTextLayer,
    selectedContentLayerId,
    setCompositionAssets,
    setEffectLayers,
    setLayerOrder,
    setLayerShaders,
    setLogoLayers,
    setSelectedLayerId,
    setShaderLayers,
    setTextLayers,
    shaderLayers,
    textLayers,
    toggleTextLayerVisibility,
  });
  const {
    alignCanvasAssembly,
    deselectCanvasLayers,
    duplicateCanvasSelection,
    groupCanvasSelection,
    groupForLayer,
    handleCanvasAssemblyKeyDown,
    movementBoundsFor,
    moveCanvasSelection,
    openCanvasSelectionMenu,
    removeCanvasSelection,
    selectCanvasAssembly,
    selectedCanvasBounds,
    selectedCanvasGroup,
    selectedCanvasLayerIdSet,
    selectedGroupedAssemblies,
    selectLayerFromStack,
    ungroupCanvasSelection,
    updateCanvasLayerTransform,
  } = useDesignLabCanvasSelection({
    canvasDimensions,
    compositionAssets,
    duplicateLayer,
    layerGroups,
    layerGroupByLayerId,
    layerOrder,
    layerVisible,
    logoLayers,
    removeLayer,
    selectedCanvasLayerIds,
    setCompositionAssets,
    setLayerGroups,
    setLayerOrder,
    setLogoLayers,
    setSelectedCanvasLayerIds,
    setSelectedLayerId,
    setSelectionMenuPosition,
    setShaderLayers,
    setTextLayers,
    shaderLayers,
    textLayers,
  });
  useEffect(() => {
    if (!workspaceTourOpen) return;
    setSelectedCanvasLayerIds([]);
    setSelectedLayerId(null);
    setSelectionMenuPosition(null);
    setArtboardMenu(null);
  }, [setSelectedCanvasLayerIds, setSelectedLayerId, setSelectionMenuPosition, workspaceTourOpen]);
  useEffect(() => () => {
    compositionAssetUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    previewFrameRef.current = boundedPreviewFrame;
    if (previewFrame !== boundedPreviewFrame) setPreviewFrame(boundedPreviewFrame);
  }, [boundedPreviewFrame, previewFrame]);

  const trackPreviewFrame = useCallback((frame: number) => {
    previewFrameRef.current = frame;
  }, []);

  function pauseAtPreviewFrame(frame: number) {
    const nextFrame = resolveMotionFrame(
      normalizedExportSettings.durationMs,
      normalizedExportSettings.fps,
      frame
    ).index;
    previewFrameRef.current = nextFrame;
    setPreviewFrame(nextFrame);
    setPaused(true);
  }

  function playShaderHistory() {
    clearLiveMaterialTimePreview('design-lab');
    setPaused(false);
  }

  function toggleShaderHistory() {
    if (paused) {
      playShaderHistory();
      return;
    }
    pauseAtPreviewFrame(previewFrameRef.current);
  }

  function applyArtboardSnapshot(snapshot: DesignArtboardSnapshot) {
    const next = cloneArtboardSnapshot(snapshot);
    const nextFrame = resolveMotionFrame(
      normalizedExportSettings.durationMs,
      normalizedExportSettings.fps,
      next.timeline.frame
    ).index;
    setRatio(next.ratio);
    setCanvasDimensions(next.dimensions);
    setCanvasBackground(next.backgroundColor);
    setShaderLayers(next.shaderLayers);
    setEffectLayers(next.effectLayers);
    setTextLayers(next.textLayers);
    setLayerGroups(next.groups);
    setLayerShaders(next.layerShaders);
    setLogoLayers(next.logos);
    setCompositionAssets(next.assets);
    setShaderSequenceSettings(next.shaderSequence);
    setLayerOrder(next.layerOrder);
    previewFrameRef.current = nextFrame;
    setPreviewFrame(nextFrame);
    setPaused(next.timeline.paused);
    setSelectedLayerId(null);
    setSelectedCanvasLayerIds([]);
    setSelectionMenuPosition(null);
  }

  function snapshotAtCurrentShaderFrame(snapshot: DesignArtboardSnapshot, freeze = false): DesignArtboardSnapshot {
    return {
      ...cloneArtboardSnapshot(snapshot),
      timeline: {
        frame: resolveMotionFrame(
          normalizedExportSettings.durationMs,
          normalizedExportSettings.fps,
          previewFrameRef.current
        ).index,
        paused: freeze || paused,
      },
    };
  }

  function createDesignHistoryEntry(
    nextArtboards: readonly DesignArtboard[],
    label: string
  ): DesignCanvasHistoryEntry {
    const clonedArtboards = cloneDesignArtboards(nextArtboards);
    designHistorySequenceRef.current += 1;
    return {
      artboards: clonedArtboards,
      detail: `${clonedArtboards.length} artboard${clonedArtboards.length === 1 ? '' : 's'}`,
      id: `canvas-action-${designHistorySequenceRef.current}`,
      label,
      signature: designCanvasHistorySignature(clonedArtboards),
    };
  }

  function restoreDesignHistoryEntry(entry: DesignCanvasHistoryEntry) {
    const nextArtboards = cloneDesignArtboards(entry.artboards);
    const activeId = nextArtboards.some(({ id }) => id === activeArtboardIdRef.current)
      ? activeArtboardIdRef.current
      : nextArtboards[0]?.id;
    const activeEntry = nextArtboards.find(({ id }) => id === activeId);
    if (!activeId || !activeEntry) return;
    window.clearTimeout(designHistoryTimerRef.current);
    designHistoryTimerRef.current = 0;
    designHistoryRestoreSignatureRef.current = entry.signature;
    pendingArtboardApplyRef.current = {
      id: activeId,
      signature: artboardSnapshotSignature(activeEntry.snapshot),
    };
    workspaceArtboardsRef.current = nextArtboards;
    activeArtboardIdRef.current = activeId;
    currentArtboardSnapshotRef.current = activeEntry.snapshot;
    setArtboards(nextArtboards);
    setActiveArtboardId(activeId);
    applyArtboardSnapshot(activeEntry.snapshot);
  }

  function undoDesignCanvas() {
    const history = designHistoryRef.current;
    if (!history.present) return;
    window.clearTimeout(designHistoryTimerRef.current);
    designHistoryTimerRef.current = 0;
    const liveArtboards = cloneDesignArtboards(workspaceArtboardsRef.current);
    const liveSignature = designCanvasHistorySignature(liveArtboards);
    if (liveSignature !== history.present.signature) {
      const liveEntry = createDesignHistoryEntry(
        liveArtboards,
        describeDesignCanvasChange(history.present.artboards, liveArtboards)
      );
      designHistoryRef.current = { ...history, future: [liveEntry, ...history.future] };
      restoreDesignHistoryEntry(history.present);
      setDesignHistoryRevision((revision) => revision + 1);
      announceCanvasClipboard(`Undid ${liveEntry.label.toLocaleLowerCase()}`);
      return;
    }
    const previous = history.past.at(-1);
    if (!previous) return;
    designHistoryRef.current = {
      future: [history.present, ...history.future],
      past: history.past.slice(0, -1),
      present: previous,
    };
    restoreDesignHistoryEntry(previous);
    setDesignHistoryRevision((revision) => revision + 1);
    announceCanvasClipboard(`Undid ${history.present.label.toLocaleLowerCase()}`);
  }

  function redoDesignCanvas() {
    const history = designHistoryRef.current;
    const next = history.future[0];
    if (!history.present || !next) return;
    window.clearTimeout(designHistoryTimerRef.current);
    designHistoryTimerRef.current = 0;
    designHistoryRef.current = {
      future: history.future.slice(1),
      past: [...history.past, history.present].slice(-39),
      present: next,
    };
    restoreDesignHistoryEntry(next);
    setDesignHistoryRevision((revision) => revision + 1);
    announceCanvasClipboard(`Redid ${next.label.toLocaleLowerCase()}`);
  }

  function requestArtboardFocus(id: DesignArtboardId) {
    setArtboardFocusRequest((current) => ({ id, revision: (current?.revision ?? 0) + 1 }));
  }

  function activateArtboard(id: DesignArtboardId, focus = false) {
    if (id === activeArtboardIdRef.current) {
      if (focus) requestArtboardFocus(id);
      return;
    }
    const committedArtboards = workspaceArtboardsRef.current.map((artboard) => (
      artboard.id === activeArtboardIdRef.current
        ? { ...artboard, snapshot: snapshotAtCurrentShaderFrame(currentArtboardSnapshotRef.current) }
        : artboard
    ));
    const nextArtboard = committedArtboards.find((artboard) => artboard.id === id);
    if (!nextArtboard) return;
    workspaceArtboardsRef.current = committedArtboards;
    setArtboards(committedArtboards);
    const nextSnapshot = cloneArtboardSnapshot(nextArtboard.snapshot);
    pendingArtboardApplyRef.current = {
      id,
      signature: artboardSnapshotSignature(nextSnapshot),
    };
    activeArtboardIdRef.current = id;
    currentArtboardSnapshotRef.current = nextSnapshot;
    setActiveArtboardId(id);
    applyArtboardSnapshot(nextSnapshot);
    if (focus) requestArtboardFocus(id);
  }

  function nextArtboardPosition(nextDimensions: StudioArtboardDimensions) {
    const column = workspaceArtboards.length % 3;
    const row = Math.floor(workspaceArtboards.length / 3);
    const size = designArtboardDisplaySize(nextDimensions);
    return {
      x: 280 + column * Math.max(816, size.width + 96),
      y: 240 + row * 620,
    };
  }

  function addArtboard(duplicate = false) {
    const id = `artboard-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as DesignArtboardId;
    const position = nextArtboardPosition(canvasDimensions);
    const snapshot = duplicate
      ? snapshotAtCurrentShaderFrame(currentArtboardSnapshot, true)
      : {
          assets: [],
          backgroundColor: canvasBackground,
          dimensions: canvasDimensions,
          effectLayers: [],
          groups: [],
          layerOrder: [],
          layerShaders: {},
          logos: [],
          ratio,
          shaderLayers: [],
          shaderSequence: { ...DEFAULT_DESIGN_SHADER_SEQUENCE_SETTINGS, targetLayerId: null },
          textLayers: [],
          timeline: { frame: 0, paused: true },
        } satisfies DesignArtboardSnapshot;
    const nextArtboard: DesignArtboard = {
      id,
      name: duplicate ? `${activeArtboard?.name ?? 'Artboard'} copy` : `Artboard ${workspaceArtboards.length + 1}`,
      snapshot,
      ...position,
    };
    const nextArtboards = [
      ...workspaceArtboardsRef.current.map((artboard) => artboard.id === activeArtboardIdRef.current
        ? { ...artboard, snapshot: snapshotAtCurrentShaderFrame(currentArtboardSnapshotRef.current) }
        : artboard),
      nextArtboard,
    ];
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
    pendingArtboardApplyRef.current = { id, signature: artboardSnapshotSignature(snapshot) };
    activeArtboardIdRef.current = id;
    currentArtboardSnapshotRef.current = snapshot;
    setActiveArtboardId(id);
    applyArtboardSnapshot(snapshot);
    requestArtboardFocus(id);
  }

  function removeActiveArtboard() {
    const currentArtboards = workspaceArtboardsRef.current;
    if (currentArtboards.length <= 1) return;
    const currentIndex = currentArtboards.findIndex(({ id }) => id === activeArtboardIdRef.current);
    const fallback = currentArtboards[currentIndex === currentArtboards.length - 1 ? currentIndex - 1 : currentIndex + 1];
    if (!fallback) return;
    const remaining = currentArtboards.filter(({ id }) => id !== activeArtboardIdRef.current);
    workspaceArtboardsRef.current = remaining;
    setArtboards(remaining);
    const snapshot = cloneArtboardSnapshot(fallback.snapshot);
    pendingArtboardApplyRef.current = { id: fallback.id, signature: artboardSnapshotSignature(snapshot) };
    activeArtboardIdRef.current = fallback.id;
    currentArtboardSnapshotRef.current = snapshot;
    setActiveArtboardId(fallback.id);
    applyArtboardSnapshot(snapshot);
    requestArtboardFocus(fallback.id);
  }

  function renameActiveArtboard(name: string) {
    const nextName = name.trimStart().slice(0, 48);
    const nextArtboards = workspaceArtboardsRef.current.map((artboard) => (
      artboard.id === activeArtboardIdRef.current ? { ...artboard, name: nextName } : artboard
    ));
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
  }

  function updateActiveArtboardDimensions(dimensions: StudioArtboardDimensions) {
    const next = normalizeStudioArtboardDimensions(dimensions, canvasDimensions);
    const preset = studioArtboardPresetForSize(next.width, next.height);
    setCanvasDimensions(next);
    setRatio(preset?.id ?? 'custom');
  }

  function arrangeArtboards() {
    const layout = arrangeCanvasFrames(workspaceArtboardsRef.current.map((artboard) => ({
      artboard,
      ...designArtboardDisplaySize(artboard.snapshot.dimensions),
    })));
    const nextArtboards = layout.map(({ artboard, x, y }) => ({ ...artboard, x, y }));
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
    setWorkspaceFitRevision((revision) => revision + 1);
  }

  function selectArtboardFromPicker(id: DesignArtboardId) {
    setArtboardPickerOpen(false);
    deselectCanvasLayers();
    activateArtboard(id, true);
  }

  function translateArtboard(id: DesignArtboardId, deltaX: number, deltaY: number, minY = 96) {
    const nextArtboards = workspaceArtboardsRef.current.map((artboard) => artboard.id === id
      ? translateCanvasFrame(artboard, { deltaX, deltaY, minX: 80, minY })
      : artboard);
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
    return nextArtboards.find((artboard) => artboard.id === id) ?? null;
  }

  function nudgeArtboard(event: ReactKeyboardEvent<HTMLButtonElement>, artboard: DesignArtboard) {
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      event.preventDefault();
      event.stopPropagation();
      activateArtboard(artboard.id);
      setArtboardMenu({
        artboardId: artboard.id,
        position: contextMenuPositionFromElement(event.currentTarget),
      });
      return;
    }
    const direction = {
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    deselectCanvasLayers();
    activateArtboard(artboard.id);
    const step = event.shiftKey ? 64 : 16;
    const moved = translateArtboard(artboard.id, direction.x * step, direction.y * step);
    if (moved) announceCanvasClipboard(`Moved ${moved.name} to ${moved.x}, ${moved.y}`);
  }

  function beginArtboardMove(event: ReactPointerEvent<HTMLElement>, artboard: DesignArtboard) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    deselectCanvasLayers();
    activateArtboard(artboard.id);
    const shell = event.currentTarget.closest<HTMLElement>('.design-artboard-shell');
    if (!shell) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let deltaX = 0;
    let deltaY = 0;
    const dragHandle = event.currentTarget;
    const artboardScale = shell.getBoundingClientRect().width / designArtboardDisplaySize(artboard.snapshot.dimensions).width;
    dragHandle.setPointerCapture(pointerId);
    shell.dataset.moving = 'true';
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      deltaX = (moveEvent.clientX - startX) / Math.max(0.01, artboardScale);
      deltaY = (moveEvent.clientY - startY) / Math.max(0.01, artboardScale);
      shell.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
    };
    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== pointerId) return;
      shell.style.transform = '';
      delete shell.dataset.moving;
      if (dragHandle.hasPointerCapture(pointerId)) dragHandle.releasePointerCapture(pointerId);
      const minimumVisibleY = Math.max(96, Math.ceil(36 / Math.max(0.01, artboardScale)));
      const moved = translateArtboard(artboard.id, deltaX, deltaY, minimumVisibleY);
      if (moved && (Math.abs(deltaX) >= 0.5 || Math.abs(deltaY) >= 0.5)) {
        announceCanvasClipboard(`Moved ${moved.name} to ${moved.x}, ${moved.y} · autosaving`);
      }
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  useEffect(() => {
    if (!draftHydrated) return;
    const pending = pendingArtboardApplyRef.current;
    if (pending) {
      if (pending.id !== activeArtboardId || pending.signature !== currentArtboardSignature) return;
      pendingArtboardApplyRef.current = null;
    }
    setArtboards((current) => {
      const target = current.find((artboard) => artboard.id === activeArtboardId);
      if (!target) return current;
      if (artboardSnapshotPersistenceSignature(target.snapshot) === currentArtboardPersistenceSignature) return current;
      const nextArtboards = current.map((artboard) => artboard.id === activeArtboardId
        ? { ...artboard, snapshot: cloneArtboardSnapshot(currentArtboardSnapshot) }
        : artboard);
      workspaceArtboardsRef.current = nextArtboards;
      return nextArtboards;
    });
  }, [activeArtboardId, currentArtboardPersistenceSignature, currentArtboardSnapshot, draftHydrated, workspaceArtboardsRef]);

  useEffect(() => {
    if (!draftHydrated) return;
    const pending = pendingArtboardApplyRef.current;
    if (pending && (pending.id !== activeArtboardId || pending.signature !== currentArtboardSignature)) return;
    if (designHistoryRestoreSignatureRef.current === designHistorySignature) {
      designHistoryRestoreSignatureRef.current = null;
      return;
    }
    const history = designHistoryRef.current;
    if (!history.present) {
      designHistoryRef.current = {
        future: [],
        past: [],
        present: createDesignHistoryEntry(workspaceArtboards, 'Opened canvas'),
      };
      setDesignHistoryRevision((revision) => revision + 1);
      return;
    }
    if (history.present.signature === designHistorySignature) return;
    window.clearTimeout(designHistoryTimerRef.current);
    designHistoryTimerRef.current = window.setTimeout(() => {
      designHistoryTimerRef.current = 0;
      const latestArtboards = cloneDesignArtboards(workspaceArtboardsRef.current);
      const current = designHistoryRef.current;
      if (!current.present) return;
      const signature = designCanvasHistorySignature(latestArtboards);
      if (signature === current.present.signature) return;
      const next = createDesignHistoryEntry(
        latestArtboards,
        describeDesignCanvasChange(current.present.artboards, latestArtboards)
      );
      designHistoryRef.current = {
        future: [],
        past: [...current.past, current.present].slice(-39),
        present: next,
      };
      setDesignHistoryRevision((revision) => revision + 1);
    }, 220);
    return () => window.clearTimeout(designHistoryTimerRef.current);
  }, [activeArtboardId, currentArtboardSignature, designHistorySignature, draftHydrated, workspaceArtboards, workspaceArtboardsRef]);

  useEffect(() => () => window.clearTimeout(designHistoryTimerRef.current), []);

  useEffect(() => {
    if (!draftHydrated) return;
    const migrationKey = `${identity.id}:${tool.id}:${brandPalette.colors.join('|')}`;
    if (defaultShaderMigrationRef.current === migrationKey) return;
    defaultShaderMigrationRef.current = migrationKey;
    const legacySettings = JSON.stringify(legacyDefaultShaderLayer.settings);
    setShaderLayers((current) => current.map((layer) => {
      const untouchedLegacyDefault = layer.id === legacyDefaultShaderLayer.id
        && layer.name === legacyDefaultShaderLayer.name
        && layer.visible === legacyDefaultShaderLayer.visible
        && layer.materialId === legacyDefaultShaderLayer.materialId
        && layer.blendMode === legacyDefaultShaderLayer.blendMode
        && layer.opacity === legacyDefaultShaderLayer.opacity
        && layer.shaderSize === legacyDefaultShaderLayer.shaderSize
        && JSON.stringify(layer.settings) === legacySettings;
      return untouchedLegacyDefault
        ? { ...initialShaderLayer }
        : { ...layer, transform: normalizeCanvasLayerTransform(layer.transform, DEFAULT_LAYER_TRANSFORM) };
    }));
  }, [brandPalette.colors, draftHydrated, identity.id, initialShaderLayer, legacyDefaultShaderLayer, setShaderLayers, tool.id]);

  useEffect(() => {
    const needsWeightNormalization = textLayers.some((layer) => {
      const fontRole = resolvedTextAppearance(layer).fontRole;
      return layer.weight !== resolveBrandTypographyWeight(identity, fontRole, layer.weight);
    });
    if (!needsWeightNormalization) return;
    setTextLayers((current) => current.map((layer) => {
      const fontRole = resolvedTextAppearance(layer).fontRole;
      return {
        ...layer,
        weight: resolveBrandTypographyWeight(identity, fontRole, layer.weight),
      };
    }));
  }, [identity, setTextLayers, textLayers]);

  function updateSelectedShader(update: Partial<ShaderApplication>) {
    const normalizedUpdate = update.shaderSize === undefined
      ? update
      : { ...update, shaderSize: clampShaderZoom(update.shaderSize) };
    if (selectedShaderLayer) {
      setShaderLayers((current) => current.map((layer) => (
        layer.id === selectedShaderLayer.id ? { ...layer, ...normalizedUpdate } : layer
      )));
      return;
    }
    if (!selectedContentLayerId) return;
    setLayerShaders((current) => ({
      ...current,
      [selectedContentLayerId]: {
        ...(current[selectedContentLayerId] ?? shaderApplicationFor(activeMaterialId, brandPalette.colors)),
        ...normalizedUpdate,
      },
    }));
  }

  function previewSelectedShaderSetting(key: keyof LiveMaterialSettings, value: number) {
    if (!selectedShaderPreviewChannel) return;
    previewLiveMaterialSettings(selectedShaderPreviewChannel, { [key]: value });
  }

  function previewSelectedShaderOpacity(value: number) {
    if (!selectedShaderPreviewChannel) return;
    const host = document.querySelector<HTMLElement>(
      `[data-shader-instance="${CSS.escape(selectedShaderPreviewChannel)}"]`
    );
    if (!host) return;
    if (selectedShaderLayer) {
      host.style.opacity = String(value);
      return;
    }
    const canvasLayer = host.closest<HTMLElement>('.editable-canvas-layer');
    if (selectedTextLayer && selectedTextAppearance) {
      const text = canvasLayer?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
      if (text) text.style.opacity = String(selectedTextAppearance.opacity * value);
      return;
    }
    const appearance = canvasLayer?.querySelector<HTMLElement>('.shader-lab-v2-appearance-stack');
    const contentOpacity = selectedLogoLayer?.opacity ?? selectedAsset?.opacity ?? 1;
    if (appearance) appearance.style.opacity = String(contentOpacity * value);
  }

  function previewSelectedTextAppearance(
    patch: Partial<Omit<TextAppearanceSettings, 'textEffect'>> & {
      textEffect?: Partial<TextEffectSettings>;
    }
  ) {
    if (!selectedTextAppearance) return;
    const layer = selectedCanvasLayerElement(selectedCanvasLayerIds.length);
    const text = layer?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
    if (!text) return;
    const nextAppearance: TextAppearanceSettings = {
      ...selectedTextAppearance,
      ...patch,
      textEffect: patch.textEffect
        ? { ...selectedTextAppearance.textEffect, ...patch.textEffect }
        : selectedTextAppearance.textEffect,
    };
    const materialBackgroundImage = selectedLayerShader
      ? `url("${shaderPreviewAssetPath(selectedLayerShader.materialId)}")`
      : undefined;
    const effectStyle = textEffectCssStyle(
      nextAppearance.textEffect,
      nextAppearance.color,
      materialBackgroundImage
    );
    text.style.color = nextAppearance.color;
    text.style.textShadow = textShadowStyle(nextAppearance) ?? '';
    text.style.webkitTextStroke = nextAppearance.outlineEnabled
      ? `${nextAppearance.outlineWidth}px ${nextAppearance.outlineColor}`
      : '';
    Object.entries(effectStyle).forEach(([property, value]) => {
      Reflect.set(text.style, property, value ?? '');
    });
  }

  function previewSelectedTextWidth(widthScale: number) {
    if (!selectedTextLayer || !selectedTextTransform) return;
    const layer = selectedCanvasLayerElement(selectedCanvasLayerIds.length);
    if (!layer) return;
    const geometry = layerGeometry(selectedTextLayer.id, canvasDimensions);
    const width = geometry.baseWidth * widthScale;
    const centerX = geometry.baseX + geometry.baseWidth / 2 + selectedTextTransform.x;
    layer.style.left = `${(centerX - width / 2) / canvasDimensions.width * 100}%`;
    layer.style.width = `${width / canvasDimensions.width * 100}%`;
    syncSelectedCanvasLayerOverlay(layer);
  }

  function previewSelectedContentOpacity(value: number) {
    const layer = selectedCanvasLayerElement(selectedCanvasLayerIds.length);
    if (!layer) return;
    const shaderOpacity = selectedLayerShader?.opacity ?? 1;
    if (selectedTextLayer) {
      const text = layer.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
      if (text) text.style.opacity = String(value * shaderOpacity);
      return;
    }
    const appearance = layer.querySelector<HTMLElement>('.shader-lab-v2-appearance-preview');
    if (appearance) appearance.style.opacity = String(value * shaderOpacity);
  }

  function previewSelectedLogoAppearance(
    patch: Partial<LogoAppearanceSettings>,
    logoColor = selectedLogoLayer?.color ?? '#FFFFFF'
  ) {
    if (!selectedLogoAppearance && !selectedAssetAppearance) return;
    const layer = selectedCanvasLayerElement(selectedCanvasLayerIds.length);
    if (!layer) return;
    const currentAppearance = selectedLogoAppearance ?? selectedAssetAppearance;
    if (!currentAppearance) return;
    const nextAppearance = { ...currentAppearance, ...patch };
    layer.querySelectorAll<SVGSVGElement>('.shader-lab-v2-appearance-preview svg, svg.shader-lab-v2-appearance-preview')
      .forEach((svg) => {
        const filterTarget = svg.querySelector<SVGElement>('image[filter], foreignObject[filter]');
        const filterReference = filterTarget?.getAttribute('filter');
        const filterId = filterReference?.match(/^url\(#(.+)\)$/)?.[1];
        const definitions = svg.querySelector<SVGDefsElement>('defs');
        if (!filterId || !definitions) return;
        const isSilhouette = svg.getAttribute('aria-label')?.includes('silhouette effects') ?? false;
        if (isSilhouette) {
          definitions.innerHTML = buildLogoSvgFilter({
            ...nextAppearance,
            ditherEnabled: false,
            invert: false,
            shadowEnabled: false,
          }, nextAppearance.borderColor, filterId, false);
          return;
        }
        if (filterTarget?.tagName.toLowerCase() === 'foreignobject' || selectedAsset) {
          definitions.innerHTML = buildImageSvgFilter({
            ...nextAppearance,
            ...(filterTarget?.tagName.toLowerCase() === 'foreignobject' && selectedLayerShader
              ? { borderEnabled: false }
              : {}),
          }, filterId);
          return;
        }
        definitions.innerHTML = buildLogoSvgFilter(
          nextAppearance,
          logoColor,
          filterId
        );
      });
  }

  function previewSelectedStickerFinish(patch: Partial<StickerFinishSettings>) {
    if (selectedAsset?.kind !== 'sticker') return;
    const layer = selectedCanvasLayerElement(selectedCanvasLayerIds.length);
    const overlay = layer?.querySelector<HTMLElement>('.shader-lab-v2-sticker-finish-overlay');
    if (!overlay) return;
    const finish = normalizeStickerFinish({ ...selectedAsset.stickerFinish, ...patch });
    Object.entries(stickerFinishCssVariables(finish)).forEach(([property, value]) => {
      overlay.style.setProperty(property, value);
    });
  }

  function updateSetting<Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) {
    updateSelectedShader({ settings: { ...settings, [key]: value } });
  }

  function selectMaterial(nextId: LiveMaterialId) {
    const nextApplication = shaderApplicationFor(nextId, brandPalette.colors, {
      blendMode: editingShader?.blendMode,
      opacity: editingShader?.opacity,
      shaderSize: editingShader?.shaderSize,
    });
    if (selectedShaderLayer) {
      setShaderLayers((current) => current.map((layer) => (
        layer.id === selectedShaderLayer.id ? { ...layer, ...nextApplication } : layer
      )));
      return;
    }
    if (selectedContentLayerId) {
      setLayerShaders((current) => ({ ...current, [selectedContentLayerId]: nextApplication }));
      return;
    }
    addCanvasShader(nextId);
  }

  function selectRandomMaterial() {
    const visibleChoices = materials.filter(({ id }) => id !== activeMaterialId);
    const choices = visibleChoices.length > 0
      ? visibleChoices
      : shaderLabMaterials('', 'all').filter(({ id }) => id !== activeMaterialId);
    const next = choices[Math.floor(Math.random() * choices.length)];
    if (next) selectMaterial(next.id);
  }

  function sequenceApplicationFor(
    layer: CompositionShaderLayer,
    materialId: LiveMaterialId
  ): ShaderApplication {
    if (layer.materialId === materialId) return layer;
    return shaderApplicationFor(materialId, brandPalette.colors, {
      blendMode: layer.blendMode,
      opacity: layer.opacity,
      shaderSize: layer.shaderSize,
    });
  }

  function applySequenceCapture(layer: CompositionShaderLayer, materialId: LiveMaterialId) {
    const capture: ShaderSequenceCapture = {
      application: sequenceApplicationFor(layer, materialId),
      layerId: layer.id,
      materialId,
    };
    sequenceCaptureRef.current = capture;
    setSequenceCapture(capture);
  }

  function clearSequenceCapture() {
    sequenceCaptureRef.current = null;
    setSequenceCapture(null);
  }

  function stopShaderSequencePreview() {
    cancelAnimationFrame(sequencePreviewAnimationRef.current);
    sequencePreviewAnimationRef.current = 0;
    sequencePreviewElapsedRef.current = 0;
    sequencePreviewLastTimeRef.current = 0;
    clearSequenceCapture();
    clearLiveMaterialTimePreview('design-lab');
    setSequencePreviewing(false);
    setPaused(sequencePreviewRestorePausedRef.current);
  }

  function previewShaderSequence() {
    if (sequencePreviewing) {
      stopShaderSequencePreview();
      return;
    }
    if (!sequenceTargetLayer || shaderSequenceTimeline.length === 0 || exporting) return;
    sequencePreviewRestorePausedRef.current = paused;
    setPaused(true);
    setSequencePreviewing(true);
    sequencePreviewElapsedRef.current = 0;
    sequencePreviewLastTimeRef.current = performance.now();
    let previousSegmentIndex = -1;
    const tick = (now: number) => {
      if (!workspaceActiveRef.current || !projectWorkspaceActiveRef.current) {
        sequencePreviewLastTimeRef.current = now;
        sequencePreviewAnimationRef.current = requestAnimationFrame(tick);
        return;
      }
      const previousTime = sequencePreviewLastTimeRef.current || now;
      sequencePreviewLastTimeRef.current = now;
      sequencePreviewElapsedRef.current += Math.max(0, now - previousTime);
      const elapsedMs = sequencePreviewElapsedRef.current;
      if (elapsedMs >= shaderSequenceDuration) {
        stopShaderSequencePreview();
        return;
      }
      const segment = shaderSequenceSegmentAt(shaderSequenceTimeline, elapsedMs);
      previewLiveMaterialTime('design-lab', elapsedMs);
      if (segment && segment.index !== previousSegmentIndex) {
        previousSegmentIndex = segment.index;
        applySequenceCapture(sequenceTargetLayer, segment.materialId);
      }
      sequencePreviewAnimationRef.current = requestAnimationFrame(tick);
    };
    sequencePreviewTickRef.current = tick;
    if (workspaceActiveRef.current) sequencePreviewAnimationRef.current = requestAnimationFrame(tick);
  }

  function addCanvasShader(materialId: LiveMaterialId = activeMaterialId) {
    const id = `shader-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as ShaderLayerId;
    const number = shaderLayers.length + 1;
    const layer: CompositionShaderLayer = {
      ...shaderApplicationFor(materialId, brandPalette.colors, {
        blendMode: shaderLayers.length === 0 ? 'normal' : 'screen',
        opacity: shaderLayers.length === 0 ? 1 : 0.72,
      }),
      id,
      name: `Canvas shader ${number}`,
      transform: { ...DEFAULT_LAYER_TRANSFORM },
      visible: true,
    };
    setShaderLayers((current) => [...current, layer]);
    setLayerOrder((current) => {
      const firstContent = current.findIndex((layerId) => !isShaderLayerId(layerId));
      const index = firstContent < 0 ? current.length : firstContent;
      return [...current.slice(0, index), id, ...current.slice(index)];
    });
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([id]);
  }

  function addEffectLayer(kind: CompositionEffectKind = 'bayer') {
    const id = `effect-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as EffectLayerId;
    const preset = COMPOSITION_EFFECT_PRESETS.find((option) => option.kind === kind)!;
    const number = effectLayers.filter((layer) => layer.settings.kind === kind).length + 1;
    const layer: CompositionEffectLayer = {
      id,
      name: `${preset.label} ${number}`,
      opacity: 1,
      settings: defaultCompositionEffectSettings(kind),
      visible: true,
    };
    setEffectLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([]);
  }

  function updateEffectLayer(id: EffectLayerId, update: Partial<Omit<CompositionEffectLayer, 'id'>>) {
    effectPreviewOverridesRef.current.delete(id);
    setEffectLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...update } : layer));
  }

  function previewEffectLayer(
    id: EffectLayerId,
    update: { opacity?: number; settings?: Partial<CompositionEffectSettings> }
  ) {
    const current = effectPreviewOverridesRef.current.get(id);
    effectPreviewOverridesRef.current.set(id, {
      ...current,
      ...update,
      settings: update.settings ? { ...current?.settings, ...update.settings } : current?.settings,
    });
  }

  function selectEffectPreset(layer: CompositionEffectLayer, kind: CompositionEffectKind) {
    const preset = COMPOSITION_EFFECT_PRESETS.find((option) => option.kind === kind)!;
    updateEffectLayer(layer.id, {
      name: preset.label,
      settings: defaultCompositionEffectSettings(kind),
    });
  }

  function removeEffectLayer(id: EffectLayerId) {
    setEffectLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function addBrandMarkLayer() {
    const id = `logo-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as LogoLayerId;
    const number = logoLayers.length + 1;
    const offset = (logoLayers.length % 8) * 28;
    const layer: CompositionLogoLayer = {
      appearance: { ...DEFAULT_LOGO_APPEARANCE },
      color: '#FFFFFF',
      id,
      name: number === 1 ? 'Brand mark' : `Brand mark ${number}`,
      opacity: 1,
      transform: { ...DEFAULT_LAYER_TRANSFORM, x: offset, y: offset },
      url: builtInLogo,
      visible: true,
    };
    setLogoLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([id]);
  }

  async function addLogoFiles(files: FileList | null) {
    const images = Array.from(files ?? []);
    if (images.length === 0) return;
    try {
      const converted = await convertedAssetLibrary.importFiles(images, 2048);
      const nextLayers = converted.map((asset, index): CompositionLogoLayer => {
      return {
        appearance: { ...DEFAULT_LOGO_APPEARANCE },
        color: '#FFFFFF',
        convertedAssetId: asset.id,
        id: `logo-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
        name: asset.originalName,
        opacity: 1,
        transform: { ...DEFAULT_LAYER_TRANSFORM, x: index * 28, y: index * 24 },
        url: asset.convertedDataUrl,
        visible: true,
      };
      });
      setLogoLayers((current) => [...current, ...nextLayers]);
      setLayerOrder((current) => [...current, ...nextLayers.map(({ id }) => id)]);
      setSelectedLayerId(nextLayers.at(-1)?.id ?? null);
      setSelectedCanvasLayerIds(nextLayers.map(({ id }) => id));
    } catch {
      // The converted asset library owns the user-facing error state.
    } finally {
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  function addTextLayer(kind: 'sticker' | 'text' = 'text') {
    const id = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as TextLayerId;
    const placement = [
      { x: 0, y: -220 },
      { x: 0, y: 220 },
      { x: -300, y: 0 },
      { x: 300, y: 0 },
      { x: -260, y: 260 },
      { x: 260, y: -260 },
    ][textLayers.length % 6] ?? { x: 0, y: 0 };
    const sticker = kind === 'sticker';
    const nextNumber = textLayers.reduce((largest, layer) => {
      const match = sticker ? /^Text sticker (\d+)$/.exec(layer.name) : /^Text (\d+)$/.exec(layer.name);
      return Math.max(largest, Number(match?.[1] ?? 0));
    }, 0) + 1;
    const layer: CompositionTextLayer = {
      align: 'center',
      ...DEFAULT_TEXT_APPEARANCE,
      ...(sticker ? STICKER_TEXT_APPEARANCE : {}),
      id,
      kind,
      lineHeight: 0.95,
      name: sticker ? `Text sticker ${nextNumber}` : `Text ${nextNumber}`,
      tracking: -0.06,
      transform: { ...DEFAULT_TEXT_LAYER_TRANSFORM, ...placement },
      value: sticker
        ? nextNumber === 1 ? identity.shortName : `Sticker ${nextNumber}`
        : nextNumber === 1 ? identity.name : `Text ${nextNumber}`,
      visible: true,
      weight: resolveBrandTypographyWeight(
        identity,
        DEFAULT_TEXT_APPEARANCE.fontRole,
        brandTypographyRole(identity, DEFAULT_TEXT_APPEARANCE.fontRole).weight ?? 500
      ),
      wrap: 'wrap',
    };
    setTextLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([id]);
  }

  function updateTextLayer(
    id: TextLayerId,
    update: Partial<Omit<CompositionTextLayer, 'id'>>
  ) {
    setTextLayers((current) => current.map((layer) =>
      layer.id === id ? { ...layer, ...update } : layer
    ));
  }

  function removeTextLayer(id: TextLayerId) {
    textEffectScratchRefs.current.delete(id);
    setTextLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function toggleTextLayerVisibility(layer: CompositionTextLayer) {
    updateTextLayer(layer.id, { visible: !layer.visible });
    if (selectedLayerId === layer.id && layer.visible) setSelectedLayerId(null);
  }

  function updateLogoTransform(id: LogoLayerId, transform: CanvasLayerTransform) {
    setLogoLayers((current) => current.map((layer) => layer.id === id ? { ...layer, transform } : layer));
  }

  function updateLogoLayer(id: LogoLayerId, update: Partial<Omit<CompositionLogoLayer, 'id'>>) {
    setLogoLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...update } : layer));
  }

  function selectConvertedLogo(asset: ConvertedAsset | null) {
    if (!selectedLogoLayer) return;
    updateLogoLayer(selectedLogoLayer.id, asset ? {
      convertedAssetId: asset.id,
      name: asset.originalName,
      url: asset.convertedDataUrl,
    } : {
      convertedAssetId: undefined,
      name: 'Brand mark',
      url: builtInLogo,
    });
  }

  function removeLogoLayer(id: LogoLayerId) {
    const removed = logoLayers.find((layer) => layer.id === id);
    const remaining = logoLayers.filter((layer) => layer.id !== id);
    if (removed?.url.startsWith('blob:') && removed.id !== DEFAULT_LOGO_LAYER_ID && !remaining.some((layer) => layer.url === removed.url)) {
      URL.revokeObjectURL(removed.url);
      compositionAssetUrlsRef.current = compositionAssetUrlsRef.current.filter((url) => url !== removed.url);
    }
    setLogoLayers((current) => current.filter((layer) => layer.id !== id));
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  const openImageImport = useCallback((files: readonly File[] = [], placementMode: ImageAssetPlacementMode = 'image') => {
    imageImportRequestIdRef.current += 1;
    imagePlacementModeRef.current = placementMode;
    setImagePlacementMode(placementMode);
    setImageImportRequest({ files, id: imageImportRequestIdRef.current });
    setImageImportError(null);
    setImageImportOpen(true);
  }, []);

  const placeBrandAssets = useCallback(async (assets: readonly BrandAsset[]) => {
    const placementMode = imagePlacementModeRef.current;
    const usedNames = new Set(compositionAssets.map(({ name }) => name));
    const geometry = layerGeometry('asset-import' as AssetLayerId, canvasDimensions);
    const columns = Math.min(3, assets.length);
    const rows = Math.ceil(assets.length / Math.max(1, columns));
    const results = await Promise.allSettled(assets.map(async (asset, index): Promise<CompositionAsset> => {
      const image = await loadCanvasImage(asset.path);
      const sourceName = asset.label.trim() || `Image ${compositionAssets.length + index + 1}`;
      let name = placementMode === 'sticker' ? `${sourceName} sticker` : sourceName;
      const baseName = name;
      let suffix = 2;
      while (usedNames.has(name)) {
        name = `${baseName} ${suffix}`;
        suffix += 1;
      }
      usedNames.add(name);
      const column = index % Math.max(1, columns);
      const row = Math.floor(index / Math.max(1, columns));
      return {
        appearance: placementMode === 'sticker'
          ? { ...STICKER_IMAGE_APPEARANCE }
          : { ...DEFAULT_LOGO_APPEARANCE },
        id: `asset-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${index}`}`,
        kind: placementMode,
        libraryAssetId: asset.id,
        name,
        opacity: 1,
        stickerFinish: placementMode === 'sticker' ? { ...DEFAULT_STICKER_FINISH } : undefined,
        transform: fitImageLayerToCanvas({
          ...geometry,
          canvasHeight: canvasDimensions.height,
          canvasWidth: canvasDimensions.width,
          imageHeight: image.naturalHeight,
          imageWidth: image.naturalWidth,
          x: (column - (columns - 1) / 2) * 44,
          y: (row - (rows - 1) / 2) * 36,
        }),
        url: asset.path,
        visible: true,
      };
    }));
    const nextAssets = results.flatMap((result): CompositionAsset[] => result.status === 'fulfilled' ? [result.value] : []);
    if (nextAssets.length === 0) throw new TypeError('The selected image could not be decoded.');
    setCompositionAssets((current) => [...current, ...nextAssets]);
    setLayerOrder((current) => [...current, ...nextAssets.map(({ id }) => id)]);
    setSelectedLayerId(nextAssets.at(-1)?.id ?? null);
    setSelectedCanvasLayerIds(nextAssets.map(({ id }) => id));
    return { failedCount: results.length - nextAssets.length, nextAssets };
  }, [canvasDimensions.height, canvasDimensions.width, compositionAssets, ratio]);

  const importAndSaveImages = useCallback(async (items: readonly PendingImageImport[]) => {
    setImageImportError(null);
    setImageImportState({ message: `Verifying and saving ${items.length} image${items.length === 1 ? '' : 's'}…`, status: 'importing' });
    const results = await Promise.allSettled(items.map(async ({ file, label }) => {
      const image = await readEmbeddedImageFile(file);
      await loadCanvasImage(image.source);
      return createImportedBrandAsset(image, label);
    }));
    const importedAssets = results.flatMap((result): BrandAsset[] => result.status === 'fulfilled' ? [result.value] : []);
    const readFailures = results.flatMap((result): string[] => result.status === 'rejected'
      ? [result.reason instanceof Error ? result.reason.message : 'An image could not be read.']
      : []);
    if (importedAssets.length === 0) {
      const message = readFailures[0] ?? 'Choose a supported image to continue.';
      setImageImportError(message);
      setImageImportState({ message, status: 'error' });
      return;
    }
    try {
      if (!onIdentitySave) throw new Error('This project cannot save shared assets yet.');
      onIdentitySave({ ...identity, assets: [...identity.assets, ...importedAssets] });
      const placed = await placeBrandAssets(importedAssets);
      const failedCount = readFailures.length + placed.failedCount;
      setImageImportOpen(false);
      setImageImportRequest(null);
      setImageImportState({
        message: failedCount > 0
          ? `Saved and placed ${placed.nextAssets.length}; ${failedCount} file${failedCount === 1 ? '' : 's'} failed.`
          : `Saved ${placed.nextAssets.length} image${placed.nextAssets.length === 1 ? '' : 's'} to Assets and placed ${placed.nextAssets.length} on canvas.`,
        status: failedCount > 0 ? 'error' : 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The image could not be saved.';
      setImageImportError(message);
      setImageImportState({ message, status: 'error' });
    }
  }, [identity, onIdentitySave, placeBrandAssets]);

  const placeSavedAsset = useCallback(async (asset: BrandAsset) => {
    setImageImportError(null);
    try {
      await placeBrandAssets([asset]);
      setImageImportOpen(false);
      setImageImportRequest(null);
      setImageImportState({ message: `Placed ${asset.label} from Assets.`, status: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The image could not be placed.';
      setImageImportError(message);
      setImageImportState({ message, status: 'error' });
    }
  }, [placeBrandAssets]);

  function announceCanvasClipboard(message: string) {
    setCanvasClipboardStatus(message);
    if (canvasClipboardStatusTimerRef.current !== null) {
      window.clearTimeout(canvasClipboardStatusTimerRef.current);
    }
    canvasClipboardStatusTimerRef.current = window.setTimeout(() => {
      canvasClipboardStatusTimerRef.current = null;
      setCanvasClipboardStatus(null);
    }, 2_400);
  }

  function canvasClipboardLayerIds(): CompositionLayerId[] {
    const selectedIds = selectedCanvasLayerIds.length > 0
      ? new Set<CompositionLayerId>(selectedCanvasLayerIds)
      : selectedLayerId
        ? new Set<CompositionLayerId>([selectedLayerId])
        : null;
    return selectedIds ? layerOrder.filter((id) => selectedIds.has(id)) : [];
  }

  function currentDesignLabClipboardSource() {
    const layerIds = canvasClipboardLayerIds();
    const source = layerIds.length > 0
      ? serializeDesignLabClipboard({
          kind: 'layers',
          layerIds,
          snapshot: currentArtboardSnapshotRef.current,
        })
      : activeArtboard
        ? serializeDesignLabClipboard({
            artboard: {
              ...activeArtboard,
              snapshot: currentArtboardSnapshotRef.current,
            },
            kind: 'artboard',
          })
        : null;
    return { layerIds, source };
  }

  function copyDesignLabSelection(event: ClipboardEvent) {
    if (!workspaceActiveRef.current || !projectWorkspaceActiveRef.current || isCanvasClipboardEditingTarget(event.target)) return;
    const browserSelection = window.getSelection();
    if (browserSelection && !browserSelection.isCollapsed && browserSelection.toString()) return;

    const { layerIds, source } = currentDesignLabClipboardSource();
    if (!source || !event.clipboardData) return;

    event.preventDefault();
    event.clipboardData.setData(DESIGN_LAB_CLIPBOARD_MIME, source);
    event.clipboardData.setData('text/plain', source);
    designLabClipboardRef.current = source;
    announceCanvasClipboard(layerIds.length > 0
      ? `Copied ${layerIds.length} layer${layerIds.length === 1 ? '' : 's'}`
      : `Copied ${activeArtboard?.name ?? 'artboard'}`);
  }

  async function copyDesignLabSelectionFromMenu() {
    const { layerIds, source } = currentDesignLabClipboardSource();
    if (!source) return;
    designLabClipboardRef.current = source;
    try {
      await navigator.clipboard.writeText(source);
    } catch {
      // The local clipboard remains available when browser clipboard permission is denied.
    }
    announceCanvasClipboard(layerIds.length > 0
      ? `Copied ${layerIds.length} layer${layerIds.length === 1 ? '' : 's'}`
      : `Copied ${activeArtboard?.name ?? 'artboard'}`);
  }

  async function pasteDesignLabSelectionFromMenu() {
    let source = designLabClipboardRef.current ?? '';
    try {
      source = await navigator.clipboard.readText() || source;
    } catch {
      // Browser clipboard permission is optional; use the last local copy instead.
    }
    const payload = parseDesignLabClipboard(source);
    if (!payload) {
      announceCanvasClipboard('Nothing from Glyphfield is ready to paste');
      return;
    }
    pasteDesignLabClipboard(payload);
  }

  function mergePastedLayers(snapshot: DesignArtboardSnapshot, pastedLayerIds: readonly string[]) {
    setShaderLayers((current) => [...current, ...snapshot.shaderLayers]);
    setEffectLayers((current) => [...current, ...snapshot.effectLayers]);
    setTextLayers((current) => [...current, ...snapshot.textLayers]);
    setLogoLayers((current) => [...current, ...snapshot.logos]);
    setCompositionAssets((current) => [...current, ...snapshot.assets]);
    setLayerGroups((current) => [...current, ...snapshot.groups]);
    setLayerShaders((current) => ({ ...current, ...snapshot.layerShaders }));
    setLayerOrder((current) => [...current, ...snapshot.layerOrder]);

    const canvasIds = pastedLayerIds.filter((id): id is CanvasLayerId => (
      isCanvasLayerId(id as CompositionLayerId)
    ));
    const selectedId = pastedLayerIds.at(-1) as CompositionLayerId | undefined;
    setSelectedCanvasLayerIds(canvasIds);
    setSelectedLayerId(selectedId ?? null);
    setSelectionMenuPosition(null);
    announceCanvasClipboard(`Pasted ${pastedLayerIds.length} layer${pastedLayerIds.length === 1 ? '' : 's'} · autosaving`);
  }

  function nextPastedArtboardName(sourceName: string): string {
    const names = new Set(workspaceArtboardsRef.current.map(({ name }) => name));
    const base = `${sourceName.replace(/ copy(?: \d+)?$/i, '') || 'Artboard'} copy`;
    if (!names.has(base)) return base;
    let suffix = 2;
    while (names.has(`${base} ${suffix}`)) suffix += 1;
    return `${base} ${suffix}`;
  }

  function pasteDesignLabClipboard(payload: DesignLabClipboardPayload) {
    if (payload.kind === 'layers') {
      const remapped = remapDesignLabClipboardSnapshot(payload.snapshot, {
        layerIds: payload.layerIds,
        offset: 32,
        renameLayers: true,
      });
      if (remapped.layerIds.length === 0) return;
      mergePastedLayers(remapped.snapshot as unknown as DesignArtboardSnapshot, remapped.layerIds);
      return;
    }

    const remapped = remapDesignLabClipboardSnapshot(payload.artboard.snapshot);
    const snapshot = remapped.snapshot as unknown as DesignArtboardSnapshot;
    const existing = workspaceArtboardsRef.current.map((artboard) => (
      artboard.id === activeArtboardIdRef.current
        ? { ...artboard, snapshot: cloneArtboardSnapshot(currentArtboardSnapshotRef.current) }
        : artboard
    ));
    let x = Math.max(80, payload.artboard.x + 48);
    let y = Math.max(96, payload.artboard.y + 48);
    while (existing.some((artboard) => Math.abs(artboard.x - x) < 24 && Math.abs(artboard.y - y) < 24)) {
      x += 48;
      y += 48;
    }
    const id = `artboard-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as DesignArtboardId;
    const nextArtboard: DesignArtboard = {
      id,
      name: nextPastedArtboardName(payload.artboard.name),
      snapshot,
      x,
      y,
    };
    const nextArtboards = [...existing, nextArtboard];
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
    pendingArtboardApplyRef.current = { id, signature: artboardSnapshotSignature(snapshot) };
    activeArtboardIdRef.current = id;
    currentArtboardSnapshotRef.current = snapshot;
    setActiveArtboardId(id);
    applyArtboardSnapshot(snapshot);
    requestArtboardFocus(id);
    announceCanvasClipboard(`Pasted ${nextArtboard.name} · autosaving`);
  }

  const handleDesignLabCopy = useEffectEvent(copyDesignLabSelection);
  const handleDesignLabPaste = useEffectEvent((event: ClipboardEvent) => {
    if (!workspaceActiveRef.current || !projectWorkspaceActiveRef.current || isCanvasClipboardEditingTarget(event.target)) return;
    const customSource = event.clipboardData?.getData(DESIGN_LAB_CLIPBOARD_MIME) ?? '';
    const textSource = event.clipboardData?.getData('text/plain') ?? '';
    const payload = parseDesignLabClipboard(customSource || textSource || (!event.clipboardData ? designLabClipboardRef.current ?? '' : ''));
    if (payload) {
      event.preventDefault();
      pasteDesignLabClipboard(payload);
      return;
    }
    const images = Array.from(event.clipboardData?.files ?? []).filter((file) => (
      file.type.startsWith('image/') || /\.(?:avif|bmp|gif|jpe?g|png|svg|webp)$/i.test(file.name)
    ));
    if (images.length === 0) return;
    event.preventDefault();
    openImageImport(images);
  });

  useEffect(() => {
    if (!active) return;
    const handleCopy = (event: ClipboardEvent) => handleDesignLabCopy(event);
    const handlePaste = (event: ClipboardEvent) => {
      handleDesignLabPaste(event);
    };
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
    };
  }, [active]);

  useEffect(() => () => {
    if (canvasClipboardStatusTimerRef.current !== null) {
      window.clearTimeout(canvasClipboardStatusTimerRef.current);
    }
  }, []);

  function handleImageDrop(event: ReactDragEvent<HTMLElement>) {
    if (!dataTransferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    setImageDropActive(false);
    openImageImport(Array.from(event.dataTransfer.files));
  }

  function removeAsset(id: AssetLayerId) {
    const removed = compositionAssets.find((asset) => asset.id === id);
    const remaining = compositionAssets.filter((asset) => asset.id !== id);
    if (removed?.url.startsWith('blob:') && !remaining.some((asset) => asset.url === removed.url)) {
      URL.revokeObjectURL(removed.url);
      compositionAssetUrlsRef.current = compositionAssetUrlsRef.current.filter((url) => url !== removed.url);
    }
    setCompositionAssets((current) => current.filter((asset) => asset.id !== id));
    setLayerShaders((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setLayerOrder((current) => current.filter((layerId) => layerId !== id));
    setSelectedLayerId((current) => current === id ? null : current);
  }

  function moveLayer(id: CompositionLayerId, direction: -1 | 1) {
    setLayerOrder((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  function updateAssetTransform(id: AssetLayerId, transform: CanvasLayerTransform) {
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, transform } : asset));
  }

  function updateAssetLayer(id: AssetLayerId, update: Partial<Omit<CompositionAsset, 'id'>>) {
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, ...update } : asset));
  }

  function layerVisible(id: CompositionLayerId) {
    return !designLabDocument.elements[id]?.hidden;
  }

  const designLabPage = designLabDocument.pages[designLabDocument.pageIds[0]!]!;
  const listedLayerIds = designLabPage.elementIds as CompositionLayerId[];
  const visibleLayerIds = useMemo(
    () => listedLayerIds.filter((id) => !designLabDocument.elements[id]?.hidden),
    [designLabDocument, listedLayerIds]
  );
  const visibleLayerIdSet = useMemo(() => new Set(visibleLayerIds), [visibleLayerIds]);
  const visibleShaderRendererCount = useMemo(
    () => visibleLayerIds.reduce((count, layerId) => (
      isShaderLayerId(layerId) || (isContentLayerId(layerId) && layerShaders[layerId])
        ? count + 1
        : count
    ), 0),
    [layerShaders, visibleLayerIds]
  );
  const livePreviewPixelBudget = liveMaterialInstancePixelBudget({
    instanceCount: visibleShaderRendererCount,
    maxPerInstance: DESIGN_LAB_PREVIEW_MAX_PIXEL_COUNT,
    minPerInstance: DESIGN_LAB_PREVIEW_MIN_PIXEL_COUNT,
    totalBudget: DESIGN_LAB_PREVIEW_TOTAL_PIXEL_BUDGET,
  });

  function compositionSetupSource(): string | null {
    if (!portableDesignLab.document) return null;
    return serializeExistingDesignLabCanvasDocument(withDesignLabTimeline(
      portableDesignLab.document,
      { frame: boundedPreviewFrame, paused },
      canvasRevisionFromSignature(compositionSignature)
    ));
  }

  function applyCompositionSource(source: string) {
    const parsed = parseCompositionSource(source);

    const nextShaderLayers = restoredShaderLayers(
      parsed.composition.shaderLayers,
      shaderLayers,
      parsed.shaderSequence?.targetLayerId
    );
    const nextEffectLayers = (parsed.composition.effectLayers ?? effectLayers).map((layer) => ({ ...layer, settings: { ...layer.settings } }));
    const nextTextLayers = (parsed.composition.textLayers ?? textLayers).map((layer) => ({
      ...layer,
      textEffect: layer.textEffect ? { ...layer.textEffect } : layer.textEffect,
      transform: normalizeCanvasLayerTransform(layer.transform, DEFAULT_TEXT_LAYER_TRANSFORM),
    }));
    const nextLogoLayers = restoredLogoLayers(parsed.composition.logos, logoLayers, builtInLogo);
    const nextAssets = restoredImageLayers(parsed.composition.assets, compositionAssets);
    const allowedIds = new Set<CompositionLayerId>([
      ...nextShaderLayers.map(({ id }) => id),
      ...nextEffectLayers.map(({ id }) => id),
      ...nextTextLayers.map(({ id }) => id),
      ...nextLogoLayers.map(({ id }) => id),
      ...nextAssets.map(({ id }) => id),
    ]);
    const nextOrder = restoredLayerOrder({
      assets: nextAssets,
      effects: nextEffectLayers,
      logos: nextLogoLayers,
      requested: parsed.composition.layerOrder ?? layerOrder,
      shaders: nextShaderLayers,
      text: nextTextLayers,
    });
    const nextLayerShaders = restoredLayerShaders(parsed.composition.layerShaders, layerShaders, allowedIds);
    const nextGroups = reconcileDesignLabLayerGroups(
      parsed.composition.groups ?? layerGroups,
      nextOrder.filter(isCanvasLayerId)
    ) as CompositionLayerGroup[];
    const nextExportSettings = parsed.exportSettings
      ? normalizeDesignExportSettings(parsed.exportSettings)
      : normalizedExportSettings;
    const nextShaderSequence = restoredShaderSequence(
      parsed.shaderSequence,
      nextShaderLayers,
      normalizedShaderSequenceSettings
    );
    const nextPreviewFrameCount = Math.max(2, Math.round(nextExportSettings.durationMs / (1_000 / nextExportSettings.fps)));
    const nextPreviewFrame = Math.min(
      nextPreviewFrameCount - 1,
      Math.max(0, Math.round(parsed.timeline?.frame ?? boundedPreviewFrame))
    );
    const restoredRatio = parsed.ratio ?? ratio;
    const restoredActiveSnapshot: DesignArtboardSnapshot = {
      assets: nextAssets,
      backgroundColor: (parsed.composition.backgroundColor ?? canvasBackground).toUpperCase(),
      dimensions: normalizeStudioArtboardDimensions(
        parsed.canvasDimensions,
        studioDimensionsForRatio(restoredRatio)
      ),
      effectLayers: nextEffectLayers,
      groups: nextGroups,
      layerOrder: nextOrder,
      layerShaders: nextLayerShaders,
      logos: nextLogoLayers,
      ratio: restoredRatio,
      shaderLayers: nextShaderLayers,
      shaderSequence: nextShaderSequence,
      textLayers: nextTextLayers,
      timeline: { frame: nextPreviewFrame, paused: parsed.timeline?.paused ?? paused },
    };
    const restoredWorkspace = restoreDesignArtboardWorkspace(parsed.workspace, restoredActiveSnapshot);
    const restoredWorkspaceSnapshot = restoredWorkspace.artboards.find(
      ({ id }) => id === restoredWorkspace.activeArtboardId
    )?.snapshot ?? restoredActiveSnapshot;

    // Opening source updates a set of independently persisted fields. Keep the
    // exact saved artboard authoritative until every live field has reached the
    // same snapshot; otherwise an intermediate render can publish the previous
    // (often centered default-logo) state back into the workspace and autosave.
    pendingArtboardApplyRef.current = {
      id: restoredWorkspace.activeArtboardId,
      signature: artboardSnapshotSignature(restoredWorkspaceSnapshot),
    };
    workspaceArtboardsRef.current = restoredWorkspace.artboards;
    activeArtboardIdRef.current = restoredWorkspace.activeArtboardId;
    currentArtboardSnapshotRef.current = restoredWorkspaceSnapshot;

    setRatio(restoredActiveSnapshot.ratio);
    setCanvasDimensions(restoredActiveSnapshot.dimensions);
    setCanvasBackground(restoredActiveSnapshot.backgroundColor);
    setShaderLayers(nextShaderLayers);
    setEffectLayers(nextEffectLayers);
    setTextLayers(nextTextLayers);
    setLayerGroups(nextGroups);
    setLayerShaders(nextLayerShaders);
    setLogoLayers(nextLogoLayers);
    setCompositionAssets(nextAssets);
    setExportSettings(nextExportSettings);
    setShaderSequenceSettings(nextShaderSequence);
    setArtboards(restoredWorkspace.artboards);
    setActiveArtboardId(restoredWorkspace.activeArtboardId);
    setLayerOrder(nextOrder);
    previewFrameRef.current = nextPreviewFrame;
    setPreviewFrame(nextPreviewFrame);
    setPaused(parsed.timeline?.paused ?? paused);
    setSelectedLayerId(null);
    setSelectedCanvasLayerIds([]);
  }

  async function copySetup() {
    const setup = compositionSetupSource();
    try {
      if (setup === null) throw new Error('Portable composition code is still being prepared.');
      await copyTextToClipboard(setup);
      setCopyError(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_600);
    } catch (error) {
      setCopied(false);
      setCopyError(error instanceof Error ? error.message : 'The composition code could not be copied.');
    }
  }

  function paintShaderApplication(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    instanceKey: string,
    application: ShaderApplication
  ) {
    const liveCanvas = stageRef.current?.querySelector<HTMLElement>(`[data-shader-instance="${instanceKey}"]`)?.querySelector('canvas');
    if (liveCanvas?.width && liveCanvas.height) {
      try {
        drawCanvasImageCover(context, liveCanvas, liveCanvas.width, liveCanvas.height, width, height);
        return;
      } catch {
        paintFallback(context, width, height, application.settings);
        return;
      }
    }
    paintFallback(context, width, height, application.settings);
  }

  function outputLayerBox(
    layerId: CanvasLayerId,
    transform: CanvasLayerTransform,
    outputWidth: number,
    outputHeight: number
  ) {
    const geometry = layerGeometry(layerId, canvasDimensions);
    const centerX = geometry.baseX + transform.x + geometry.baseWidth / 2;
    const centerY = geometry.baseY + transform.y + geometry.baseHeight / 2;
    const dimensions = canvasLayerDimensions(transform, geometry);
    const width = dimensions.width / canvasDimensions.width * outputWidth;
    const height = dimensions.height / canvasDimensions.height * outputHeight;
    return {
      height,
      width,
      x: centerX / canvasDimensions.width * outputWidth - width / 2,
      y: centerY / canvasDimensions.height * outputHeight - height / 2,
    };
  }

  function textEffectScratchFor(layerId: TextLayerId) {
    const current = textEffectScratchRefs.current.get(layerId);
    if (current) return current;
    const scratch = {
      fill: document.createElement('canvas'),
      mask: document.createElement('canvas'),
      shadow: document.createElement('canvas'),
    };
    textEffectScratchRefs.current.set(layerId, scratch);
    return scratch;
  }

  function paintCompositionShader(
    context: CanvasRenderingContext2D,
    layerId: ShaderLayerId,
    width: number,
    height: number
  ) {
    const shaderLayer = shaderLayers.find((layer) => layer.id === layerId);
    if (!shaderLayer) return;
    const capturedSequence = sequenceCaptureRef.current;
    const renderedShader = capturedSequence?.layerId === layerId
      ? capturedSequence.application
      : shaderLayer;
    const box = outputLayerBox(
      layerId,
      normalizeCanvasLayerTransform(shaderLayer.transform, DEFAULT_LAYER_TRANSFORM),
      width,
      height
    );
    context.save();
    context.globalAlpha = renderedShader.opacity;
    context.globalCompositeOperation = renderedShader.blendMode === 'normal'
      ? 'source-over'
      : renderedShader.blendMode;
    context.translate(box.x, box.y);
    paintShaderApplication(context, box.width, box.height, `canvas-${layerId}`, renderedShader);
    context.restore();
  }

  function paintCompositionEffect(
    context: CanvasRenderingContext2D,
    layerId: EffectLayerId,
    width: number,
    height: number,
    onEffectPainted?: (effectId: EffectLayerId, source: HTMLCanvasElement) => void
  ) {
    const effectLayer = effectLayers.find((layer) => layer.id === layerId);
    if (!effectLayer) return;
    const preview = effectPreviewOverridesRef.current.get(layerId);
    const previewSettings = preview?.settings
      ? { ...effectLayer.settings, ...preview.settings }
      : effectLayer.settings;
    let scratch = effectScratchRefs.current.get(layerId);
    if (!scratch) {
      scratch = createCompositionEffectScratch() ?? undefined;
      if (scratch) effectScratchRefs.current.set(layerId, scratch);
    }
    applyCompositionEffect(context, width, height, {
      ...previewSettings,
      cellSize: previewSettings.cellSize * width / 960,
    }, preview?.opacity ?? effectLayer.opacity, scratch);
    onEffectPainted?.(layerId, context.canvas);
  }

  function paintCompositionImage(
    context: CanvasRenderingContext2D,
    layerId: LogoLayerId | AssetLayerId,
    width: number,
    height: number,
    images: ReadonlyMap<string, HTMLImageElement>
  ) {
    const isLogo = isLogoLayerId(layerId);
    const layer = isLogo
      ? logoLayers.find((candidate) => candidate.id === layerId)
      : compositionAssets.find((candidate) => candidate.id === layerId);
    const image = layer ? images.get(layer.id) : null;
    if (!layer || !image) return;
    const box = outputLayerBox(layer.id, layer.transform, width, height);
    const application = layerShaders[layer.id];
    const appearance = resolvedLogoAppearance(layer.appearance);
    const layerOpacity = layer.opacity ?? 1;
    const stickerFinish = !isLogo && (layer as CompositionAsset).kind === 'sticker'
      ? normalizeStickerFinish((layer as CompositionAsset).stickerFinish)
      : null;
    if (!application) {
      const contained = createContainedLayer(
        image,
        box.width,
        box.height,
        isLogo ? (layer as CompositionLogoLayer).color ?? '#FFFFFF' : undefined,
        !isLogo
      );
      drawLogoAppearanceLayer(context, contained, box.x, box.y, box.width, box.height, appearance, layerOpacity);
      if (stickerFinish) drawStickerFinishOverlay(context, contained, box, stickerFinish, layerOpacity);
      return;
    }

    const materialLayer = document.createElement('canvas');
    materialLayer.width = Math.max(1, Math.round(box.width));
    materialLayer.height = Math.max(1, Math.round(box.height));
    const materialContext = materialLayer.getContext('2d');
    if (!materialContext) return;
    paintShaderApplication(
      materialContext,
      materialLayer.width,
      materialLayer.height,
      `content-${layerId}`,
      application
    );
    materialContext.globalCompositeOperation = 'destination-in';
    if (isLogo) {
      drawContained(
        materialContext,
        image,
        image.naturalWidth || 1,
        image.naturalHeight || 1,
        0,
        0,
        materialLayer.width,
        materialLayer.height
      );
    } else {
      materialContext.drawImage(image, 0, 0, materialLayer.width, materialLayer.height);
    }
    context.save();
    context.globalAlpha = application.opacity;
    context.globalCompositeOperation = application.blendMode === 'normal'
      ? 'source-over'
      : application.blendMode;
    drawLogoAppearanceLayer(
      context,
      materialLayer,
      box.x,
      box.y,
      box.width,
      box.height,
      appearance,
      layerOpacity
    );
    context.restore();
    if (stickerFinish) drawStickerFinishOverlay(context, materialLayer, box, stickerFinish, layerOpacity);
  }

  function composeFrame(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
    images: Map<string, HTMLImageElement>,
    frameLayerIds: readonly CompositionLayerId[] = visibleLayerIds,
    onEffectPainted?: (effectId: EffectLayerId, source: HTMLCanvasElement) => void
  ) {
    return renderCanvasDocumentPage({
      context,
      document: designLabDocument,
      elementIds: frameLayerIds,
      height,
      manageCompositing: false,
      pageId: designLabPage.id,
      renderElement: ({ element }) => {
        const layerId = element.id as CompositionLayerId;
        if (isShaderLayerId(layerId)) return paintCompositionShader(context, layerId, width, height);
        if (isEffectLayerId(layerId)) return paintCompositionEffect(context, layerId, width, height, onEffectPainted);
        if (isLogoLayerId(layerId) || isAssetLayerId(layerId)) {
          return paintCompositionImage(context, layerId, width, height, images);
        }

      if (isTextLayerId(layerId)) {
        const textLayer = textLayers.find((layer) => layer.id === layerId);
        if (!textLayer || !textLayer.value) return;
        const transform = resolvedTextTransform(textLayer.transform);
        return paintDesignLabTextLayer({
          application: layerShaders[layerId],
          box: outputLayerBox(layerId, transform, width, height),
          canvasWidth: canvasDimensions.width,
          context,
          height,
          identity,
          layer: textLayer,
          paintShaderApplication,
          textEffectScratch: textEffectScratchFor(layerId),
          width,
        });
      }
      },
      width,
    });
  }

  async function waitForCompositionFonts() {
    if (!document.fonts) return;
    const visibleTextLayers = textLayers.filter((layer) => (
      layer.visible && visibleLayerIdSet.has(layer.id) && layer.value.length > 0
    ));
    if (visibleTextLayers.length === 0) return;

    await document.fonts.ready;
    await Promise.all(visibleTextLayers.map(async (layer) => {
      const appearance = resolvedTextAppearance(layer);
      const family = brandTypographyFamily(identity, appearance.fontRole);
      const weight = resolveBrandTypographyWeight(identity, appearance.fontRole, layer.weight);
      const faces = await document.fonts.load(
        `${weight} 64px ${JSON.stringify(family)}`,
        layer.value || 'Ag'
      );
      const isBundledBrandFont = brandFontAssets(identity).some((font) => (
        font.family === family && font.style === 'normal'
      ));
      if (isBundledBrandFont && faces.length === 0) {
        throw new Error(`${family} ${weight} could not be loaded for export.`);
      }
    }));
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function loadCompositionImages() {
    const entries: [string, string][] = [
      ...logoLayers.map((layer): [string, string] => [layer.id, layer.url]),
      ...compositionAssets.map((asset): [string, string] => [asset.id, asset.url]),
    ];
    return new Map(await Promise.all(entries.map(async ([id, source]) => [id, await loadCanvasImage(source)] as const)));
  }

  const composeFrameRef = useCommittedRef(composeFrame);
  const loadCompositionImagesRef = useCommittedRef(loadCompositionImages);
  const lastPreviewEffectIndex = visibleLayerIds.findLastIndex(isEffectLayerId);
  const effectPreviewOrderSignature = lastPreviewEffectIndex < 0
    ? ''
    : visibleLayerIds.slice(0, lastPreviewEffectIndex + 1).join('|');
  const compositionImageSignature = [
    ...logoLayers.map(({ id, url }) => `${id}:${url}`),
    ...compositionAssets.map(({ id, url }) => `${id}:${url}`),
  ].join('|');
  const pausedEffectPreviewSignature = paused ? compositionSignature : '';

  useEffect(() => {
    const activeEffectIds = visibleLayerIds.filter(isEffectLayerId);
    if (!active || activeEffectIds.length === 0) return;

    let animationFrame = 0;
    let cancelled = false;
    let inViewport = true;
    let lastRenderedAt = -Infinity;
    let rendering = false;
    let previewWidth = Math.min(640, canvasDimensions.width);
    let targetFrameRate = 60;
    let renderDurationTotal = 0;
    let renderSamples = 0;
    const observer = typeof IntersectionObserver === 'undefined' || !stageRef.current
      ? null
      : new IntersectionObserver(([entry]) => {
          inViewport = entry?.isIntersecting ?? true;
        }, { rootMargin: '120px' });
    if (observer && stageRef.current) observer.observe(stageRef.current);

    void loadCompositionImagesRef.current().then((images) => {
      if (cancelled) return;
      const tick = (now: number) => {
        if (cancelled) return;
        const shouldRender = workspaceActiveRef.current
          && projectWorkspaceActiveRef.current
          && inViewport
          && !document.hidden
          && !rendering
          && (paused || now - lastRenderedAt >= 1000 / targetFrameRate);
        if (shouldRender) {
          rendering = true;
          const renderStartedAt = performance.now();
          const previewHeight = Math.max(1, Math.round(previewWidth * canvasDimensions.height / canvasDimensions.width));
          const buffer = effectPreviewBufferRef.current ?? document.createElement('canvas');
          effectPreviewBufferRef.current = buffer;
          if (buffer.width !== previewWidth) buffer.width = previewWidth;
          if (buffer.height !== previewHeight) buffer.height = previewHeight;
          const context = buffer.getContext('2d', { willReadFrequently: true });
          const lastEffectIndex = Math.max(...activeEffectIds.map((effectId) => visibleLayerIds.indexOf(effectId)));
          if (context) {
            composeFrameRef.current(
              context,
              previewWidth,
              previewHeight,
              images,
              visibleLayerIds.slice(0, lastEffectIndex + 1),
              (effectId, source) => {
                const canvas = effectCanvasRefs.current.get(effectId);
                if (!canvas) return;
                if (canvas.width !== previewWidth) canvas.width = previewWidth;
                if (canvas.height !== previewHeight) canvas.height = previewHeight;
                const visibleContext = canvas.getContext('2d');
                if (!visibleContext) return;
                visibleContext.clearRect(0, 0, previewWidth, previewHeight);
                visibleContext.drawImage(source, 0, 0);
              }
            );
          }
          renderDurationTotal = renderDurationTotal + performance.now() - renderStartedAt;
          renderSamples = renderSamples + 1;
          if (renderSamples >= 8) {
            const averageDuration = renderDurationTotal / renderSamples;
            if (averageDuration > 14) {
              if (previewWidth > 360) previewWidth = Math.max(360, Math.round(previewWidth * 0.84));
              else targetFrameRate = 30;
            } else if (averageDuration < 9) {
              targetFrameRate = 60;
              previewWidth = Math.min(640, canvasDimensions.width, Math.round(previewWidth * 1.12));
            }
            renderDurationTotal = 0;
            renderSamples = 0;
          }
          lastRenderedAt = now;
          rendering = false;
        }
        if (!paused) animationFrame = requestAnimationFrame(tick);
      };
      animationFrame = requestAnimationFrame(tick);
    }).catch(() => {
      // Imported image errors should not take down the editable composition.
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      cancelAnimationFrame(animationFrame);
    };
  }, [
    canvasDimensions.height,
    canvasDimensions.width,
    active,
    compositionImageSignature,
    composeFrameRef,
    effectPreviewOrderSignature,
    loadCompositionImagesRef,
    paused,
    pausedEffectPreviewSignature,
    visibleLayerIds,
  ]);

  function createExportCanvas() {
    const output = document.createElement('canvas');
    output.width = exportDimensions.width;
    output.height = exportDimensions.height;
    return output;
  }

  function gifProtectedCompositionColors(): string[] {
    const colors: string[] = [];
    visibleLayerIds.forEach((layerId) => {
      if (isTextLayerId(layerId) && !layerShaders[layerId]) {
        const layer = textLayers.find((candidate) => candidate.id === layerId);
        if (!layer) return;
        const appearance = resolvedTextAppearance(layer);
        colors.push(appearance.color);
        if (appearance.textEffect.kind !== 'solid') colors.push(appearance.textEffect.backgroundColor);
        if (appearance.outlineEnabled) colors.push(appearance.outlineColor);
        if (appearance.shadowEnabled) colors.push(appearance.shadowColor);
        return;
      }
      if (isLogoLayerId(layerId) && !layerShaders[layerId]) {
        const layer = logoLayers.find((candidate) => candidate.id === layerId);
        if (layer?.color) colors.push(layer.color);
      }
    });
    colors.push(canvasBackground);
    return colors;
  }

  async function exportStill(format: StillImageFormat): Promise<ExportPreviewAsset | null> {
    if (exporting) return null;
    const settingsSignature = currentExportSettingsSignature;
    const resumeAfterExport = !paused;
    const stillFrame = paused ? boundedPreviewFrame : previewFrameRef.current;
    flushSync(() => {
      setExporting(format);
      setCaptureTimeMs(resolveMotionFrame(
        normalizedExportSettings.durationMs,
        normalizedExportSettings.fps,
        stillFrame
      ).timeMs);
      setPaused(true);
    });
    setExportError(null);
    studioExport.start(`Rendering ${format.toUpperCase()} preview`);
    try {
      const startedAt = performance.now();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await waitForCompositionFonts();
      const output = createExportCanvas();
      const context = output.getContext('2d');
      if (!context) throw new Error('Canvas rendering is unavailable.');
      const images = await loadCompositionImages();
      composeFrame(context, output.width, output.height, images);
      const quality = normalizedExportSettings.quality === 'fast'
        ? 0.82
        : normalizedExportSettings.quality === 'best'
          ? 0.96
          : 0.9;
      const blob = await canvasToImageBlob(output, format, quality);
      const label = format === 'jpg' ? 'JPG' : 'PNG';
      const fileName = `${identity.id}-design-lab-${output.width}x${output.height}.${format}`;
      const asset: ExportPreviewAsset = {
        blob,
        elapsedMs: performance.now() - startedAt,
        fileName,
        format: label,
        height: output.height,
        width: output.width,
      };
      setLastExport(asset);
      setLastExportRequest({ format, settingsSignature });
      return asset;
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The still image could not be exported.');
      return null;
    } finally {
      setCaptureTimeMs(null);
      setExporting(null);
      if (resumeAfterExport) setPaused(false);
      studioExport.finish();
    }
  }

  async function waitForCapturedFrame(
    frame: MotionFrame,
    nextSequenceCapture: ShaderSequenceCapture | null = null
  ) {
    const materialChanged = sequenceCaptureRef.current?.materialId !== nextSequenceCapture?.materialId;
    sequenceCaptureRef.current = nextSequenceCapture;
    flushSync(() => {
      setSequenceCapture(nextSequenceCapture);
      setCaptureTimeMs(frame.timeMs);
    });
    await new Promise<void>((resolve) => {
      // Provider renderers stop their live loop before accepting the controlled clock.
      let remainingFrames = frame.index === 0 ? 10 : materialChanged ? 6 : 3;
      const settleFrame = () => {
        remainingFrames = remainingFrames - 1;
        if (remainingFrames === 0) resolve();
        else requestAnimationFrame(settleFrame);
      };
      requestAnimationFrame(settleFrame);
    });
  }

  async function exportMotion(format: 'gif' | 'mp4', motionMode: DesignMotionMode = 'standard'): Promise<ExportPreviewAsset | null> {
    if (exporting) return null;
    if (motionMode === 'sequence' && (!sequenceTargetLayer || shaderSequenceTimeline.length === 0)) {
      setExportError('Add a canvas shader before exporting a shader sequence.');
      return null;
    }
    if (sequencePreviewing) stopShaderSequencePreview();
    const settingsSignature = currentExportSettingsSignature;
    setExporting(format);
    setExportError(null);
    studioExport.start(`Rendering ${motionMode === 'sequence' ? 'shader sequence ' : ''}${format.toUpperCase()} preview`, 0);
    try {
      const startedAt = performance.now();
      await waitForCompositionFonts();
      const { durationMs, fps, quality } = normalizedExportSettings;
      const resolvedDurationMs = motionMode === 'sequence' ? shaderSequenceDuration : durationMs;
      const output = createExportCanvas();
      const context = output.getContext('2d', { willReadFrequently: format === 'gif' });
      if (!context) throw new Error('Canvas rendering is unavailable.');
      const images = await loadCompositionImages();
      const renderFrame = async (frame: MotionFrame) => {
        const segment = motionMode === 'sequence'
          ? shaderSequenceSegmentAt(shaderSequenceTimeline, frame.timeMs)
          : null;
        const nextSequenceCapture = segment && sequenceTargetLayer
          ? {
              application: sequenceApplicationFor(sequenceTargetLayer, segment.materialId),
              layerId: sequenceTargetLayer.id,
              materialId: segment.materialId,
            }
          : null;
        await waitForCapturedFrame(frame, nextSequenceCapture);
        composeFrame(context, output.width, output.height, images);
      };
      const sharedOptions = {
        canvas: output,
        durationMs: resolvedDurationMs,
        onProgress: studioExport.update,
        renderFrame,
      };
      let loopReport: MotionLoopReport | undefined;
      const blob = format === 'gif'
        ? await encodeCanvasGif({
            ...sharedOptions,
            colors: quality === 'fast' ? 64 : quality === 'best' ? 256 : 128,
            fps,
            loopMode: normalizedExportSettings.gifLoop,
            onLoopReport: (report) => { loopReport = report; },
            paletteFormat: quality === 'fast' ? 'rgb444' : 'rgb565',
            paletteStrategy: quality === 'best' ? 'per-frame' : 'global',
            protectedColors: gifProtectedCompositionColors(),
          })
        : await encodeCanvasMp4({ ...sharedOptions, fps, quality });
      const label = format.toUpperCase() as 'GIF' | 'MP4';
      const fileName = `${identity.id}-design-lab${motionMode === 'sequence' ? '-shader-sequence' : ''}-${output.width}x${output.height}.${format}`;
      const asset: ExportPreviewAsset = {
        blob,
        elapsedMs: performance.now() - startedAt,
        fileName,
        format: label,
        height: output.height,
        loopReport,
        width: output.width,
      };
      setLastExport(asset);
      setLastExportRequest({ format, motionMode, settingsSignature });
      return asset;
    } catch (error) {
      setExportError(error instanceof Error ? error.message : `The ${format.toUpperCase()} could not be exported.`);
      return null;
    } finally {
      sequenceCaptureRef.current = null;
      setSequenceCapture(null);
      setCaptureTimeMs(null);
      setExporting(null);
      studioExport.finish();
    }
  }

  function updateExportSettings(patch: Partial<DesignExportSettings>) {
    setExportSettings((current) => ({ ...current, ...patch }));
  }

  function updateShaderSequenceSettings(patch: Partial<DesignShaderSequenceSettings>) {
    setShaderSequenceSettings((current) => {
      const next = { ...current, ...patch };
      return {
        ...normalizeShaderSequenceSettings(next),
        sequenceOffset: Math.max(0, Math.round(next.sequenceOffset)),
        targetLayerId: next.targetLayerId,
      };
    });
  }

  async function exportForAutomation(request: DesignAutomationExportInput): Promise<ExportPreviewAsset> {
    const motionMode: DesignMotionMode = request.mode === 'shader-sequence' ? 'sequence' : 'standard';
    const asset = request.format === 'png' || request.format === 'jpg'
      ? await exportStill(request.format)
      : await exportMotion(request.format, motionMode);
    if (!asset) throw new Error(`Design Lab could not export ${request.format.toUpperCase()}.`);
    if (request.download) downloadStudioArtifact(asset);
    return asset;
  }

  const designAutomationRef = useCommittedRef({
    applyCompositionSource,
    compositionSetupSource,
    exportForAutomation,
    normalizedShaderSequenceSettings,
    previewShaderSequence,
    sequencePreviewing,
    shaderSequenceDuration,
    shaderSequenceTimeline,
    stopShaderSequencePreview,
    updateShaderSequenceSettings,
  });

  useEffect(() => registerStudioAutomation({
    actions: [
      'source.read',
      'source.apply',
      'controls.list',
      'control.activate',
      'control.set',
      'artifact.download',
      'design.sequence.describe',
      'design.sequence.configure',
      'design.sequence.preview',
      'design.sequence.stop',
      'design.export',
      'design.export.png',
      'design.export.jpg',
      'design.export.gif',
      'design.export.mp4',
      'design.export.shader-sequence.gif',
      'design.export.shader-sequence.mp4',
    ],
    applySource: (source) => designAutomationRef.current.applyCompositionSource(source),
    getSource: () => {
      const source = designAutomationRef.current.compositionSetupSource();
      if (source === null) throw new Error('Portable composition code is still being prepared.');
      return source;
    },
    invoke: (action, input) => invokeDesignAutomationAction(designAutomationRef.current, action, input),
    toolId: automationToolId ?? tool.id,
  }), [automationToolId, designAutomationRef, tool.id]);

  function refreshExportPreview() {
    if (!lastExportRequest || exporting) return;
    if (lastExportRequest.format === 'gif' || lastExportRequest.format === 'mp4') {
      void exportMotion(lastExportRequest.format, lastExportRequest.motionMode ?? 'standard');
      return;
    }
    void exportStill(lastExportRequest.format);
  }

  function previewExportFormat(format: DesignExportFormat) {
    if (exporting) return;
    if (format === 'gif' || format === 'mp4') {
      void exportMotion(format);
      return;
    }
    void exportStill(format);
  }

  function renderLiveMaterial(application: ShaderApplication, instanceKey: string) {
    const controlledTimeMs = captureTimeMs ?? (paused ? previewCaptureTimeMs : null);
    const renderedApplication = sequenceCapture && instanceKey === `canvas-${sequenceCapture.layerId}`
      ? sequenceCapture.application
      : application;
    if (!livePreviewRuntimeReady && captureTimeMs === null) {
      return (
        <span
          aria-hidden='true'
          className='absolute inset-0 block'
          style={shaderMaterialPreviewStyle(renderedApplication.materialId, renderedApplication.settings)}
        />
      );
    }
    return (
      <LiveMaterialCanvas
        captureTimeMs={controlledTimeMs}
        className='absolute inset-0 size-full'
        frameRate={DESIGN_LAB_PREVIEW_FRAME_RATE}
        key={`${instanceKey}:${renderedApplication.materialId}`}
        loopDurationMs={normalizedExportSettings.durationMs}
        materialId={renderedApplication.materialId}
        maxPixelCount={captureTimeMs === null
          ? livePreviewPixelBudget
          : Math.max(DESIGN_LAB_PREVIEW_MAX_PIXEL_COUNT, exportDimensions.width * exportDimensions.height)}
        patternScale={clampShaderZoom(renderedApplication.shaderSize)}
        paused={!active || paused || controlledTimeMs !== null}
        previewChannel={instanceKey}
        previewGroup='design-lab'
        renderScale={1}
        settings={renderedApplication.settings}
      />
    );
  }

  function renderStudioHeader() {
    return (
      <StudioToolHeader
        actions={(
          <>
            <SourceCodeButton disabled={portableDesignLab.source === null} onClick={() => setSourceOpen(true)} />
            {lastExport ? (
              <ExportPreview
                asset={lastExport}
                configuration={(
                  <DesignExportWorkspace
                    disabled={Boolean(exporting)}
                    format={exporting ?? lastExportRequest?.format ?? 'png'}
                    onChange={updateExportSettings}
                    onFormatChange={previewExportFormat}
                    ratioOption={ratioOption}
                    settings={normalizedExportSettings}
                  />
                )}
                needsRefresh={previewNeedsRefresh}
                onRefresh={refreshExportPreview}
                refreshKey={currentExportSettingsSignature}
                refreshing={Boolean(exporting)}
                triggerLabel='Export'
              />
            ) : (
              <Button aria-label='Open export settings' disabled={Boolean(exporting)} loading={exporting === 'png'} onClick={() => void exportStill('png')} type='button'>
                <Download aria-hidden='true' /><span className='responsive-toolbar-label'>Export</span>
              </Button>
            )}
            {exportError ? <span className='max-w-44 truncate text-[10px] text-status-error' role='alert' title={exportError}>{exportError}</span> : null}
            <Button aria-label={paused ? 'Play shader' : 'Pause shader'} onClick={toggleShaderHistory} size='icon' type='button' variant='outline'>
              {paused ? <Play aria-hidden='true' /> : <Pause aria-hidden='true' />}
            </Button>
          </>
        )}
        navigation={navigation}
        navigationLabel='Design Lab view'
        metadata='Compose graphics across artboards'
        status={(
          <DesignVersionControls
            autosaveState={compositionAutosaveState}
            identityId={identity.id}
            onOpen={applyCompositionSource}
            revision={savedDesignRevision}
            source={compositionSetupSource}
            toolId={tool.id}
            workspaceLabel='Design Lab'
          />
        )}
        title={tool.name}
        toolId={tool.id}
      />
    );
  }

  function renderArtboardToolbar(placement: 'canvas' | 'sidebar') {
    return (
      <div
        aria-label='Artboard workspace controls'
        className={`design-artboard-toolbar design-artboard-toolbar-${placement}`}
        data-canvas-selection-preserve
      >
        <div className='design-artboard-picker' ref={artboardPickerRef}>
          <button
            aria-expanded={artboardPickerOpen}
            aria-haspopup='menu'
            className='design-artboard-picker-trigger'
            onClick={() => setArtboardPickerOpen((open) => !open)}
            type='button'
          >
            <LayoutGrid aria-hidden='true' />
            <strong>{activeArtboardName}</strong>
            <ChevronDown aria-hidden='true' />
          </button>
          {artboardPickerOpen ? (
            <div aria-label='Choose an artboard' className='design-artboard-picker-menu' role='menu'>
              {workspaceArtboards.map((artboard) => {
                const option = studioArtboardPresetForSize(
                  artboard.snapshot.dimensions.width,
                  artboard.snapshot.dimensions.height
                );
                const selected = artboard.id === activeArtboardId;
                return (
                  <button
                    aria-checked={selected}
                    key={artboard.id}
                    onClick={() => selectArtboardFromPicker(artboard.id)}
                    role='menuitemradio'
                    type='button'
                  >
                    <Frame aria-hidden='true' />
                    <strong>{resolvedDesignArtboardName(artboard.name)}</strong>
                    <small>{option?.label ?? 'Custom'} · {artboard.snapshot.dimensions.width}×{artboard.snapshot.dimensions.height}</small>
                    {selected ? <Check aria-hidden='true' /> : <span aria-hidden='true' />}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <ArtboardSizeMenu
          artboardName={activeArtboardRawName}
          className='design-artboard-size-trigger'
          dimensions={canvasDimensions}
          onArtboardNameChange={renameActiveArtboard}
          onDimensionsChange={updateActiveArtboardDimensions}
        />
        <span aria-live='polite' className='sr-only'>{canvasClipboardStatus ?? workspaceAutosaveLabel}</span>
        <div aria-label='Artboard actions' role='group'>
          <button onClick={() => addArtboard(false)} title='Add blank artboard' type='button'><Plus aria-hidden='true' /><span>Add</span></button>
          <button onClick={() => addArtboard(true)} title='Duplicate active artboard' type='button'><Copy aria-hidden='true' /><span>Duplicate</span></button>
          <button onClick={arrangeArtboards} title='Tidy and fit artboards' type='button'><LayoutGrid aria-hidden='true' /><span>Arrange</span></button>
          <button disabled={workspaceArtboards.length <= 1} onClick={removeActiveArtboard} title='Delete active artboard' type='button'><Trash2 aria-hidden='true' /></button>
          <button aria-pressed={workspaceTourOpen} onClick={() => setWorkspaceTourOpen((value) => !value)} title='Artboard tutorial' type='button'><span>?</span></button>
        </div>
      </div>
    );
  }

  function renderShaderLibrary() {
    return (
      <aside className='shader-lab-v2-library studio-sidebar lab-sidebar lab-sidebar-left studio-scroll-area' aria-label='Shader library' data-canvas-selection-preserve ref={materialLibraryRef}>
        {renderArtboardToolbar('sidebar')}
        <LabPanelHeading
          action={<button aria-label='Choose a random shader' onClick={selectRandomMaterial} title='Random shader' type='button'><Sparkles aria-hidden='true' /></button>}
          className='shader-lab-v2-panel-heading'
          description={`${materials.length} of ${shaderLabCategoryCount('all')} materials`}
          title='Shader library'
        />
        <label className='shader-lab-v2-search'>
          <Search aria-hidden='true' />
          <input
            aria-label='Search shaders'
            onChange={(event) => {
              setVisibleMaterialCount(SHADER_LIBRARY_INITIAL_CARD_COUNT);
              setQuery(event.target.value);
            }}
            placeholder={`Search all ${shaderLabCategoryCount('all')} shaders`}
            type='search'
            value={query}
          />
        </label>
        <div aria-label='Shader categories' className='shader-lab-v2-categories' role='group'>
          {SHADER_LAB_CATEGORIES.map((option) => (
            <button
              aria-pressed={category === option.id}
              key={option.id}
              onClick={() => {
                setVisibleMaterialCount(SHADER_LIBRARY_INITIAL_CARD_COUNT);
                setCategory(option.id);
              }}
              type='button'
            >
              {option.label}<span>{shaderLabCategoryCount(option.id)}</span>
            </button>
          ))}
        </div>
        <div className='shader-lab-v2-material-grid studio-scroll-area'>
          {visibleMaterials.map((option) => (
            <ShaderMaterialCard key={option.id} material={option} onSelect={handleMaterialSelect} selected={editingShader?.materialId === option.id} />
          ))}
          {remainingMaterialCount > 0 ? (
            <button
              className='shader-lab-v2-load-more'
              onClick={() => setVisibleMaterialCount((count) => Math.min(materials.length, count + SHADER_LIBRARY_CARD_BATCH_SIZE))}
              ref={materialLoadMoreRef}
              type='button'
            >
              <span>Load more shaders</span>
              <small>{remainingMaterialCount} remaining</small>
            </button>
          ) : null}
        </div>
      </aside>
    );
  }

  function renderSourceEditor() {
    if (!sourceOpen || portableDesignLab.source === null) return null;
    return (
      <SourceCodeDrawer
        format='JSON · Design Lab composition'
        onApply={applyCompositionSource}
        onClose={() => setSourceOpen(false)}
        source={compositionSetupSource()!}
        title='Composition code'
      />
    );
  }

  function renderArtboardPreviewMaterial(
    application: ShaderApplication,
    instanceKey: string,
    captureTimeMs = previewCaptureTimeMs
  ) {
    return (
      <LiveMaterialCanvas
        captureTimeMs={captureTimeMs}
        className='absolute inset-0 size-full'
        frameRate={24}
        key={`${instanceKey}:${application.materialId}`}
        loopDurationMs={normalizedExportSettings.durationMs}
        materialId={application.materialId}
        maxPixelCount={420_000}
        patternScale={clampShaderZoom(application.shaderSize)}
        paused
        renderScale={0.72}
        settings={application.settings}
      />
    );
  }

  function renderInactiveArtboardLayer(artboard: DesignArtboard, layerId: CompositionLayerId, index: number) {
    const { snapshot } = artboard;
    const artboardCaptureTimeMs = resolveMotionFrame(
      normalizedExportSettings.durationMs,
      normalizedExportSettings.fps,
      snapshot.timeline.frame
    ).timeMs;
    const zIndex = 4 + index;
    if (isEffectLayerId(layerId)) return null;
    if (isShaderLayerId(layerId)) {
      const layer = snapshot.shaderLayers.find(({ id }) => id === layerId);
      if (!layer?.visible) return null;
      const transform = normalizeCanvasLayerTransform(layer.transform, DEFAULT_LAYER_TRANSFORM);
      return (
        <EditableCanvasLayer
          {...layerGeometry(layerId, snapshot.dimensions)}
          canvasHeight={snapshot.dimensions.height}
          canvasWidth={snapshot.dimensions.width}
          className='shader-lab-v2-composition-layer shader-lab-v2-composition-shader'
          interactive={false}
          key={layerId}
          label={layer.name}
          onChange={() => undefined}
          onDeselect={() => undefined}
          onSelect={() => undefined}
          resizeMode='box'
          selected={false}
          transform={transform}
          zIndex={zIndex}
        >
          <div className='shader-lab-v2-canvas-material' data-shader-instance={`canvas-${layerId}`} key='content' style={{ mixBlendMode: shaderBlendStyle(layer.blendMode), opacity: layer.opacity }}>
            {renderArtboardPreviewMaterial(layer, `canvas-${layerId}`, artboardCaptureTimeMs)}
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
          allowContentInteraction
          canvasHeight={snapshot.dimensions.height}
          canvasWidth={snapshot.dimensions.width}
          className='shader-lab-v2-composition-layer'
          interactive={false}
          key={layerId}
          label={layer.name}
          onChange={() => undefined}
          onDeselect={() => undefined}
          onSelect={() => undefined}
          resizeMode='box'
          selected={false}
          transform={transform}
          zIndex={zIndex}
        >
          <CanvasTextLayerContent
            application={snapshot.layerShaders[layerId]}
            fontSizeCqw={snapshot.dimensions.height / snapshot.dimensions.width * 17 * transform.scale}
            identity={identity}
            key='content'
            layer={layer}
            onChange={() => undefined}
            onFocus={() => undefined}
            renderMaterial={(application, instanceKey) => renderArtboardPreviewMaterial(application, instanceKey, artboardCaptureTimeMs)}
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
        {...layerGeometry(layerId, snapshot.dimensions)}
        canvasHeight={snapshot.dimensions.height}
        canvasWidth={snapshot.dimensions.width}
        className='shader-lab-v2-composition-layer'
        interactive={false}
        key={layerId}
        label={layer.name}
        onChange={() => undefined}
        onDeselect={() => undefined}
        onSelect={() => undefined}
        selected={false}
        transform={layer.transform}
        zIndex={zIndex}
      >
        <ShaderMaskedMediaContent
          application={snapshot.layerShaders[layerId as ContentLayerId]}
          appearance={layer.appearance}
          fallbackColor={isLogoLayerId(layerId) ? (layer as CompositionLogoLayer).color ?? '#FFFFFF' : '#FFFFFF'}
          instanceKey={`content-${layerId}`}
          key='content'
          label={layer.name}
          opacity={layer.opacity ?? 1}
          preserveColors={isAssetLayerId(layerId)}
          renderMaterial={(application, instanceKey) => renderArtboardPreviewMaterial(application, instanceKey, artboardCaptureTimeMs)}
          url={layer.url}
        />
        {'kind' in layer && layer.kind === 'sticker' ? <StickerFinishOverlay finish={layer.stickerFinish} key='finish' url={layer.url} /> : null}
      </EditableCanvasLayer>
    );
  }

  function renderArtboard(artboard: DesignArtboard) {
    const selected = artboard.id === activeArtboardId;
    const pending = pendingArtboardApplyRef.current;
    const selectedReady = selected && (
      !pending
      || (pending.id === artboard.id && pending.signature === currentArtboardSignature)
    );
    const snapshot = selectedReady ? currentArtboardSnapshot : artboard.snapshot;
    const size = designArtboardDisplaySize(snapshot.dimensions);
    const ratioPresentation: DesignRatioOption = RATIO_OPTIONS.find(({ value }) => value === snapshot.ratio) ?? {
      ...snapshot.dimensions,
      label: 'Custom',
      value: 'custom',
    };
    const previewLayerIds = snapshot.layerOrder.filter((layerId) => {
      if (isShaderLayerId(layerId)) return snapshot.shaderLayers.some((layer) => layer.id === layerId && layer.visible);
      if (isTextLayerId(layerId)) return snapshot.textLayers.some((layer) => layer.id === layerId && layer.visible);
      if (isLogoLayerId(layerId)) return snapshot.logos.some((layer) => layer.id === layerId && layer.visible);
      if (isAssetLayerId(layerId)) return snapshot.assets.some((layer) => layer.id === layerId && layer.visible);
      return snapshot.effectLayers.some((layer) => layer.id === layerId && layer.visible);
    });
    return (
      <article
        aria-current={selected ? 'true' : undefined}
        aria-label={`${artboard.name} artboard`}
        className='design-artboard-shell'
        data-active={selected ? 'true' : 'false'}
        data-canvas-fit-target='true'
        data-canvas-focus-target={selected ? 'true' : undefined}
        data-canvas-interactive
        data-studio-context-trigger='artboard'
        key={artboard.id}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          activateArtboard(artboard.id);
          setArtboardMenu({
            artboardId: artboard.id,
            position: {
              ...contextMenuPositionFromEvent(event),
              anchor: event.currentTarget.querySelector<HTMLButtonElement>('.design-artboard-label button'),
            },
          });
        }}
        onPointerDown={() => activateArtboard(artboard.id)}
        style={{ height: size.height, left: artboard.x, top: artboard.y, width: size.width }}
      >
        <header
          aria-label={`Drag ${artboard.name} artboard`}
          className='design-artboard-label'
          data-canvas-selection-preserve
          onPointerDown={(event) => beginArtboardMove(event, artboard)}
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
          data-material-id={selectedReady ? sequenceCapture?.materialId ?? editingShader?.materialId : undefined}
          data-testid={selectedReady ? 'shader-lab-live-stage' : undefined}
          onKeyDown={selectedReady ? handleCanvasAssemblyKeyDown : undefined}
          onPointerDown={selectedReady ? deselectCanvasLayers : undefined}
          ref={selectedReady ? stageRef : undefined}
          style={{
            aspectRatio: `${ratioPresentation.width} / ${ratioPresentation.height}`,
            backgroundColor: snapshot.backgroundColor,
          }}
        >
          {selectedReady
            ? visibleLayerIds.map(renderStageLayer)
            : previewLayerIds.map((layerId, index) => renderInactiveArtboardLayer(artboard, layerId, index))}
          {selectedReady ? <span aria-live='polite' className='sr-only'>
            {canvasSelectionAnnouncement(selectedCanvasLayerIds.length, selectedCanvasGroup?.name)}
          </span> : null}
          <div className='shader-lab-v2-stage-shade' aria-hidden='true' />
        </div>
      </article>
    );
  }

  function renderStageLayer(layerId: CompositionLayerId, index: number) {
    const zIndex = 4 + index;
    if (isShaderLayerId(layerId)) {
      const shaderLayer = shaderLayers.find((layer) => layer.id === layerId);
      if (!shaderLayer) return null;
      const geometry = layerGeometry(layerId, canvasDimensions);
      const transform = normalizeCanvasLayerTransform(shaderLayer.transform, DEFAULT_LAYER_TRANSFORM);
      return (
        <EditableCanvasLayer
          {...geometry}
          canvasHeight={canvasDimensions.height}
          canvasWidth={canvasDimensions.width}
          className='shader-lab-v2-composition-layer shader-lab-v2-composition-shader'
          key={layerId}
          label={shaderLayer.name}
          movementBounds={movementBoundsFor(layerId)}
          onChange={(nextTransform) => updateCanvasLayerTransform(layerId, nextTransform)}
          onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
          onDeselect={deselectCanvasLayers}
          onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
          resizeMode='box'
          selected={selectedCanvasLayerIdSet.has(layerId)}
          selectionMember={selectedCanvasLayerIdSet.has(layerId)}
          showSelectionControls={selectedCanvasLayerIds.length <= 1}
          transform={transform}
          zIndex={zIndex}
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
    if (isEffectLayerId(layerId)) {
      const effectLayer = effectLayers.find((layer) => layer.id === layerId);
      if (!effectLayer) return null;
      return (
        <canvas
          aria-hidden='true'
          className='shader-lab-v2-composition-effect'
          data-effect-kind={effectLayer.settings.kind}
          key={layerId}
          ref={(canvas) => {
            if (canvas) effectCanvasRefs.current.set(layerId, canvas);
            else effectCanvasRefs.current.delete(layerId);
          }}
          style={{ zIndex }}
        />
      );
    }

    const geometry = layerGeometry(layerId, canvasDimensions);
    if (isLogoLayerId(layerId)) {
      const logoLayer = logoLayers.find((layer) => layer.id === layerId);
      if (!logoLayer) return null;
      const application = layerShaders[layerId];
      return (
        <EditableCanvasLayer
          {...geometry}
          canvasHeight={canvasDimensions.height}
          canvasWidth={canvasDimensions.width}
          className='shader-lab-v2-composition-layer'
          key={layerId}
          label={logoLayer.name}
          movementBounds={movementBoundsFor(layerId)}
          onChange={(transform) => updateCanvasLayerTransform(layerId, transform)}
          onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
          onDeselect={deselectCanvasLayers}
          onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
          selected={selectedCanvasLayerIdSet.has(layerId)}
          selectionMember={selectedCanvasLayerIdSet.has(layerId)}
          showSelectionControls={selectedCanvasLayerIds.length <= 1}
          transform={logoLayer.transform}
          zIndex={zIndex}
        >
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
      const textLayer = textLayers.find((layer) => layer.id === layerId);
      if (!textLayer) return null;
      const application = layerShaders[layerId];
      const transform = resolvedTextTransform(textLayer.transform);
      const textFontSizeCqw = canvasDimensions.height / canvasDimensions.width * 17 * transform.scale;
      return (
        <EditableCanvasLayer
          {...geometry}
          allowContentInteraction
          canvasHeight={canvasDimensions.height}
          canvasWidth={canvasDimensions.width}
          className='shader-lab-v2-composition-layer'
          key={layerId}
          label={textLayer.name}
          movementBounds={movementBoundsFor(layerId)}
          onChange={(nextTransform) => updateCanvasLayerTransform(layerId, nextTransform)}
          onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
          onDeselect={deselectCanvasLayers}
          onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
          resizeMode='box'
          selected={selectedCanvasLayerIdSet.has(layerId)}
          selectionMember={selectedCanvasLayerIdSet.has(layerId)}
          showSelectionControls={selectedCanvasLayerIds.length <= 1}
          transform={transform}
          zIndex={zIndex}
        >
          <CanvasTextLayerContent
            application={application}
            fontSizeCqw={textFontSizeCqw}
            identity={identity}
            key='content'
            layer={textLayer}
            onChange={(value) => updateTextLayer(layerId, { value })}
            onFocus={() => selectCanvasAssembly(layerId)}
            renderMaterial={renderLiveMaterial}
          />
        </EditableCanvasLayer>
      );
    }
    const asset = compositionAssets.find(({ id }) => id === layerId);
    if (!asset) return null;
    const application = layerShaders[layerId];
    return (
      <EditableCanvasLayer
        {...geometry}
        canvasHeight={canvasDimensions.height}
        canvasWidth={canvasDimensions.width}
        className='shader-lab-v2-composition-layer'
        key={layerId}
        label={asset.name}
        movementBounds={movementBoundsFor(layerId)}
        onChange={(transform) => updateCanvasLayerTransform(layerId, transform)}
        onContextMenu={(event) => openCanvasSelectionMenu(layerId, event)}
        onDeselect={deselectCanvasLayers}
        onSelect={(additive) => selectCanvasAssembly(layerId, additive)}
        selected={selectedCanvasLayerIdSet.has(layerId)}
        selectionMember={selectedCanvasLayerIdSet.has(layerId)}
        showSelectionControls={selectedCanvasLayerIds.length <= 1}
        transform={asset.transform}
        zIndex={zIndex}
      >
        <ShaderMaskedMediaContent
          application={application}
          appearance={asset.appearance}
          fallbackColor='#FFFFFF'
          instanceKey={`content-${layerId}`}
          key='content'
          label={asset.name}
          opacity={asset.opacity ?? 1}
          preserveColors
          renderMaterial={renderLiveMaterial}
          url={asset.url}
        />
        {asset.kind === 'sticker' ? <StickerFinishOverlay finish={asset.stickerFinish} key='finish' url={asset.url} /> : null}
      </EditableCanvasLayer>
    );
  }

  function renderDockLayer(layerId: CompositionLayerId, index: number) {
    const layerIsVisible = layerVisible(layerId);
    const orderIndex = layerOrder.indexOf(layerId);
    const { assetLayer, effectLayer, logoLayer, shaderLayer, textLayer } = resolveLayerDockLayers(
      layerId,
      { assets: compositionAssets, effects: effectLayers, logos: logoLayers, shaders: shaderLayers, text: textLayers }
    );
    const appliedShader = resolveLayerDockShader(layerId, shaderLayer, layerShaders);
    const layerGroup = isCanvasLayerId(layerId) ? groupForLayer(layerId) : null;
    const textAppearance = textLayer ? resolvedTextAppearance(textLayer) : null;
    const previewUrl = logoLayer?.url ?? assetLayer?.url;
    const stickerLayer = isStickerLayer(assetLayer, textLayer);
    const selected = selectedLayerId === layerId
      || (isCanvasLayerId(layerId) && selectedCanvasLayerIdSet.has(layerId));
    return (
      <StudioPreviewTooltip
        description={layerDockTooltipDescription({ appliedShader, effectLayer, layerId, sticker: stickerLayer, textLayer })}
        eyebrow={`${String(index + 1).padStart(2, '0')} · ${resolvedLayerKind(layerId)}`}
        key={layerId}
        meta={`${layerIsVisible ? 'Visible' : 'Hidden'}${layerGroup ? ` · ${layerGroup.name}` : ''} · Right-click for actions`}
        preview={(
          <LayerDockTooltipPreview
            appliedShader={appliedShader}
            effectLayer={effectLayer}
            identity={identity}
            previewUrl={previewUrl}
            textAppearance={textAppearance}
            textLayer={textLayer}
          />
        )}
        title={layerLabel(layerId)}
      >
        <div
          aria-label={`${layerLabel(layerId)} layer`}
          className='shader-lab-v2-dock-layer'
          data-kind={resolvedLayerKind(layerId).toLocaleLowerCase().replaceAll(' ', '-')}
          data-material={appliedShader ? 'true' : 'false'}
          data-selected={selected ? 'true' : 'false'}
          data-studio-context-trigger='layer'
          data-visible={layerIsVisible}
          onContextMenu={(event) => {
            if (isCanvasLayerId(layerId)) {
              openCanvasSelectionMenu(layerId, event);
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            selectLayerFromStack(layerId);
            setLayerDockMenu({ layerId, position: contextMenuPositionFromEvent(event) });
          }}
          role='group'
        >
        <button
          aria-keyshortcuts='Shift+F10'
          className='shader-lab-v2-dock-layer-select'
          onClick={() => selectLayerFromStack(layerId)}
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
            selectLayerFromStack(layerId);
            setLayerDockMenu({ layerId, position: contextMenuPositionFromElement(event.currentTarget) });
          }}
          title={`Select ${layerLabel(layerId)}`}
          type='button'
        >
          <span className='shader-lab-v2-dock-layer-icon'><CanvasLayerKindIcon layerId={layerId} sticker={stickerLayer} /></span>
          <span className='shader-lab-v2-dock-layer-copy'>
            <strong>{layerLabel(layerId)}</strong>
            <small>{String(index + 1).padStart(2, '0')} · {resolvedLayerKind(layerId)}{layerGroup ? ` · ${layerGroup.name}` : ''}</small>
          </span>
        </button>
        <div className='shader-lab-v2-dock-layer-preview'>
          {appliedShader ? (
            <span className='shader-lab-v2-dock-material-frame'><AuthenticShaderPreview materialId={appliedShader.materialId} /></span>
          ) : null}
          {textLayer && textAppearance ? (
            <input
              aria-label={`Edit ${textLayer.name}`}
              onChange={(event) => updateTextLayer(textLayer.id, { value: event.target.value })}
              onFocus={() => selectLayerFromStack(textLayer.id)}
              onKeyDown={(event) => event.stopPropagation()}
              style={{
                color: textAppearance.color,
                fontFamily: `${JSON.stringify(brandTypographyFamily(identity, textAppearance.fontRole))}, sans-serif`,
                fontWeight: resolveBrandTypographyWeight(identity, textAppearance.fontRole, textLayer.weight),
                letterSpacing: `${textLayer.tracking}em`,
                opacity: textAppearance.opacity,
              }}
              type='text'
              value={textLayer.value}
            />
          ) : (
            <LayerDockStaticPreview effectLayer={effectLayer} label={layerLabel(layerId)} onSelect={() => selectLayerFromStack(layerId)} previewUrl={previewUrl} />
          )}
        </div>
        <div className='shader-lab-v2-dock-layer-actions'>
          <button aria-label={`Duplicate ${layerLabel(layerId)}`} onClick={() => duplicateLayer(layerId)} title='Duplicate' type='button'><Copy aria-hidden='true' /></button>
          <button aria-label={`Move ${layerLabel(layerId)} forward`} disabled={orderIndex === layerOrder.length - 1} onClick={() => moveLayer(layerId, 1)} title='Move forward' type='button'><ArrowUp aria-hidden='true' /></button>
          <button aria-label={`Move ${layerLabel(layerId)} backward`} disabled={orderIndex === 0} onClick={() => moveLayer(layerId, -1)} title='Move backward' type='button'><ArrowDown aria-hidden='true' /></button>
          <button aria-label={`${layerIsVisible ? 'Hide' : 'Show'} ${layerLabel(layerId)}`} aria-pressed={layerIsVisible} onClick={() => toggleLayerVisibility(layerId)} title={layerIsVisible ? 'Hide layer' : 'Show layer'} type='button'>{layerIsVisible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}</button>
          <button aria-label={`Delete ${layerLabel(layerId)}`} onClick={() => removeLayer(layerId)} title='Delete' type='button'><Trash2 aria-hidden='true' /></button>
        </div>
        </div>
      </StudioPreviewTooltip>
    );
  }

  function renderInspectorLayer(layerId: CompositionLayerId, index: number) {
    const layerIsVisible = layerVisible(layerId);
    const { assetLayer, effectLayer, logoLayer, shaderLayer, textLayer } = resolveLayerDockLayers(
      layerId,
      { assets: compositionAssets, effects: effectLayers, logos: logoLayers, shaders: shaderLayers, text: textLayers }
    );
    const appliedShader = resolveLayerDockShader(layerId, shaderLayer, layerShaders);
    const layerGroup = isCanvasLayerId(layerId) ? groupForLayer(layerId) : null;
    const textAppearance = textLayer ? resolvedTextAppearance(textLayer) : null;
    const previewUrl = logoLayer?.url ?? assetLayer?.url;
    const stickerLayer = isStickerLayer(assetLayer, textLayer);
    const selected = selectedLayerId === layerId
      || (isCanvasLayerId(layerId) && selectedCanvasLayerIdSet.has(layerId));
    const openLayerMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
      if (isCanvasLayerId(layerId)) {
        openCanvasSelectionMenu(layerId, event);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectLayerFromStack(layerId);
      setLayerDockMenu({ layerId, position: contextMenuPositionFromEvent(event) });
    };
    return (
      <StudioPreviewTooltip
        description={layerDockTooltipDescription({ appliedShader, effectLayer, layerId, sticker: stickerLayer, textLayer })}
        eyebrow={`${String(index + 1).padStart(2, '0')} · ${resolvedLayerKind(layerId)}`}
        key={layerId}
        meta={`${layerIsVisible ? 'Visible' : 'Hidden'}${layerGroup ? ` · ${layerGroup.name}` : ''}`}
        preview={(
          <LayerDockTooltipPreview
            appliedShader={appliedShader}
            effectLayer={effectLayer}
            identity={identity}
            previewUrl={previewUrl}
            textAppearance={textAppearance}
            textLayer={textLayer}
          />
        )}
        title={layerLabel(layerId)}
      >
        <div
          className='design-layer-inspector-row'
          data-selected={selected ? 'true' : 'false'}
          data-studio-context-trigger='layer'
          data-visible={layerIsVisible ? 'true' : 'false'}
          onContextMenu={openLayerMenu}
          role='listitem'
        >
          <button
            aria-keyshortcuts='Shift+F10'
            className='design-layer-inspector-select'
            onClick={() => selectLayerFromStack(layerId)}
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
            <span><strong>{layerLabel(layerId)}</strong><small>{String(index + 1).padStart(2, '0')} · {resolvedLayerKind(layerId)}{layerGroup ? ` · ${layerGroup.name}` : ''}</small></span>
          </button>
          <button
            aria-label={`${layerIsVisible ? 'Hide' : 'Show'} ${layerLabel(layerId)}`}
            aria-pressed={layerIsVisible}
            className='design-layer-inspector-visibility'
            onClick={() => toggleLayerVisibility(layerId)}
            title={layerIsVisible ? 'Hide layer' : 'Show layer'}
            type='button'
          >
            {layerIsVisible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
          </button>
        </div>
      </StudioPreviewTooltip>
    );
  }

  function renderStudio() {
    return (
    <div className='shader-lab-v2 tool-shell h-full min-h-0'>
      {renderStudioHeader()}

      <div className='shader-lab-v2-layout studio-scroll-area'>
        {renderShaderLibrary()}

        <section
          className='shader-lab-v2-workspace'
          data-image-drop={imageDropActive ? 'active' : undefined}
          onDragEnter={(event) => {
            if (!dataTransferHasFiles(event.dataTransfer)) return;
            event.preventDefault();
            setImageDropActive(true);
          }}
          onDragLeave={(event) => {
            if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
            setImageDropActive(false);
          }}
          onDragOver={(event) => {
            if (!dataTransferHasFiles(event.dataTransfer)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            setImageDropActive(true);
          }}
          onDrop={handleImageDrop}
        >
          {imageDropActive ? (
            <div className='shader-lab-v2-image-drop-overlay' role='status'>
              <span><ImagePlus aria-hidden='true' /></span>
              <strong>Drop images onto the canvas</strong>
              <small>They will be centered, fitted, and kept at their original aspect ratio.</small>
            </div>
          ) : null}
          {renderArtboardToolbar('canvas')}
          {workspaceTourOpen ? (
            <DesignArtboardTour
              onClose={() => setWorkspaceTourOpen(false)}
              onNext={() => workspaceTourStep >= DESIGN_ARTBOARD_TOUR_STEPS.length - 1
                ? setWorkspaceTourOpen(false)
                : setWorkspaceTourStep((step) => step + 1)}
              step={workspaceTourStep}
            />
          ) : null}
          <CanvasViewport
            actionHistory={canvasActionHistory}
            className='shader-lab-v2-composer-viewport'
            draftKey='shader-lab-v6-workspace-zoom'
            fitKey={workspaceFitRevision}
            focusKey={artboardFocusRequest ? `${artboardFocusRequest.id}:${artboardFocusRequest.revision}` : undefined}
            focusOffsetY={16}
            identityId={identity.id}
            initialPan={{ x: 0, y: -40 }}
            initialZoom={40}
            maxZoom={220}
            minZoom={10}
            onDeselect={deselectCanvasLayers}
            stageClassName='design-artboard-viewport-stage'
            toolId={tool.id}
          >
            <div
              className='shader-lab-v2-stage-wrap design-artboard-workspace'
              style={{ height: workspaceSize.height, width: workspaceSize.width }}
            >
              {workspaceArtboards.map(renderArtboard)}
            </div>
          </CanvasViewport>
          <DesignArtboardContextMenu
            activeArtboardId={activeArtboardId}
            artboards={workspaceArtboards}
            menu={artboardMenu}
            onArrange={arrangeArtboards}
            onClose={() => setArtboardMenu(null)}
            onDelete={removeActiveArtboard}
            onDuplicate={() => addArtboard(true)}
            onFocus={(id) => activateArtboard(id, true)}
            onNew={() => addArtboard(false)}
          />
          <LayerDockContextMenu
            layerKind={resolvedLayerKind}
            layerLabel={layerLabel}
            layerOrder={layerOrder}
            layerVisible={layerVisible}
            menu={layerDockMenu}
            onClose={() => setLayerDockMenu(null)}
            onDelete={removeLayer}
            onDuplicate={duplicateLayer}
            onMove={moveLayer}
            onToggleVisibility={toggleLayerVisibility}
          />
          {selectedCanvasLayerIds.length > 1 && selectedCanvasBounds ? (
            <CanvasSelectionAssemblyOverlay
              bounds={selectedCanvasBounds}
              canvasHeight={canvasDimensions.height}
              canvasWidth={canvasDimensions.width}
              label={selectedCanvasGroup?.name ?? `${selectedCanvasLayerIds.length} layers`}
              stageRef={stageRef}
            />
          ) : null}
          <CanvasSelectionMenu
            canGroup={selectedCanvasLayerIds.length > 1 && !selectedCanvasGroup}
            canUngroup={selectedGroupedAssemblies.length > 0}
            count={selectedCanvasLayerIds.length}
            groupName={selectedCanvasGroup?.name}
            onAlign={alignCanvasAssembly}
            onBringForward={() => moveCanvasSelection(1)}
            onClose={() => setSelectionMenuPosition(null)}
            onCopy={() => void copyDesignLabSelectionFromMenu()}
            onDelete={removeCanvasSelection}
            onDuplicate={duplicateCanvasSelection}
            onGroup={groupCanvasSelection}
            onPaste={() => void pasteDesignLabSelectionFromMenu()}
            onSendBackward={() => moveCanvasSelection(-1)}
            onUngroup={ungroupCanvasSelection}
            position={selectionMenuPosition}
          />
          <div className='design-motion-strip' data-canvas-selection-preserve>
            <ShaderFrameHistoryControl
              durationMs={normalizedExportSettings.durationMs}
              fps={normalizedExportSettings.fps}
              frame={boundedPreviewFrame}
              onFramePreview={trackPreviewFrame}
              onPauseAtFrame={pauseAtPreviewFrame}
              onPlay={playShaderHistory}
              onScrub={pauseAtPreviewFrame}
              onScrubPreview={(frame) => {
                previewLiveMaterialTime(
                  'design-lab',
                  resolveMotionFrame(
                    normalizedExportSettings.durationMs,
                    normalizedExportSettings.fps,
                    frame
                  ).timeMs
                );
              }}
              playing={!paused && captureTimeMs === null}
            />
            <button aria-expanded={motionWorkspaceOpen} onClick={() => setMotionWorkspaceOpen((value) => !value)} type='button'><Clapperboard aria-hidden='true' /><span>Shader sequence</span></button>
            <a href='/studio?tool=animation' title='Continue in Animation Studio'><ExternalLink aria-hidden='true' /><span>Animation</span></a>
          </div>
          {motionWorkspaceOpen ? (
            <aside className='design-motion-workspace' data-canvas-selection-preserve>
              <header><span><Clapperboard aria-hidden='true' /><strong>Shader sequence</strong></span><button aria-label='Close shader sequence' onClick={() => setMotionWorkspaceOpen(false)} type='button'><X aria-hidden='true' /></button></header>
              <p>Build a deterministic cut sequence for this artboard, preview it here, or continue with keyframes in Animation Studio.</p>
              <ShaderSequenceControls
                disabled={Boolean(exporting)}
                durationMs={shaderSequenceDuration}
                materialIds={sequenceMaterialIds}
                onChange={updateShaderSequenceSettings}
                onExport={() => void exportMotion('mp4', 'sequence')}
                onPreview={previewShaderSequence}
                onShuffle={() => updateShaderSequenceSettings({ sequenceOffset: normalizedShaderSequenceSettings.sequenceOffset + 1 })}
                previewing={sequencePreviewing}
                settings={normalizedShaderSequenceSettings}
                targetOptions={sequenceTargetOptions}
              />
              <a href='/studio?tool=animation'><ExternalLink aria-hidden='true' />Open Animation Studio</a>
            </aside>
          ) : null}
          <div className='shader-lab-v2-bottom-dock' data-canvas-selection-preserve>
            <input accept='image/*,.svg,.avif,.bmp' aria-label='Choose logos for the canvas' className='sr-only' multiple onChange={(event) => void addLogoFiles(event.target.files)} ref={logoInputRef} type='file' />
            <div className='shader-lab-v2-dock-create'>
              <div className='shader-lab-v2-dock-heading'>
                <span><Layers3 aria-hidden='true' />Layers</span>
                <small>{listedLayerIds.length} total · front to back</small>
              </div>
              <div className='shader-lab-v2-dock-add' aria-label='Add canvas layer' role='group'>
                <button aria-label='Add text layer' onClick={() => addTextLayer()} type='button'><Type aria-hidden='true' /><span>Text</span></button>
                <button aria-label='Add shader layer' onClick={() => addCanvasShader()} type='button'><Sparkles aria-hidden='true' /><span>Shader</span></button>
                <button aria-label='Add effect layer' onClick={() => addEffectLayer()} type='button'><Grid3X3 aria-hidden='true' /><span>Effect</span></button>
                <button aria-label='Add brand mark' onClick={addBrandMarkLayer} type='button'><Layers3 aria-hidden='true' /><span>Mark</span></button>
                <button aria-label='Add sticker layer' onClick={() => openImageImport([], 'sticker')} type='button'><Sticker aria-hidden='true' /><span>Sticker</span></button>
                <button aria-label='Add image layer' className='shader-lab-v2-dock-add-image' onClick={() => openImageImport()} title='Open the shared Asset library or import new images' type='button'><ImagePlus aria-hidden='true' /><span>Image</span></button>
              </div>
              <span aria-live='polite' className='shader-lab-v2-image-import-status' data-state={imageImportState.status}>
                {imageImportState.message || 'Images keep their aspect ratio when added.'}
              </span>
            </div>

            <div
              aria-label='Canvas layer stack'
              className='shader-lab-v2-dock-stack studio-scroll-area'
              onWheel={scrollLayerDockWithWheel}
              role='region'
              tabIndex={0}
            >
              {[...listedLayerIds].reverse().map(renderDockLayer)}
            </div>
          </div>
        </section>

        <aside className='shader-lab-v2-inspector studio-sidebar lab-sidebar lab-sidebar-right studio-scroll-area' aria-label='Design Lab controls' data-canvas-selection-preserve>
          <LabPanelHeading
            className='shader-lab-v2-inspector-intro'
            description={designLabInspectorDescription({
              hasContent: Boolean(selectedContentLayerId),
              hasEffect: Boolean(selectedEffectLayer),
              hasLayerShader: Boolean(selectedLayerShader),
              hasShader: Boolean(selectedShaderLayer),
              materialName: material.name,
            })}
            title={selectedLayerId ? layerLabel(selectedLayerId) : 'Design Lab'}
          />

          <ConditionalRender when={!selectedLayerId}>{() => <>
            <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-composition-setup design-composition-inspector' meta={`${canvasDimensions.width} × ${canvasDimensions.height}`} title='Composition'>
              <ArtboardSetupFields
                artboardName={activeArtboardRawName}
                className='design-artboard-inline-setup'
                dimensions={canvasDimensions}
                onArtboardNameChange={renameActiveArtboard}
                onDimensionsChange={updateActiveArtboardDimensions}
              />
              <div className='design-composition-appearance'>
                <div className='shader-lab-v2-composition-subhead'><h3>Appearance</h3><span>Active artboard</span></div>
                <ColorControl
                  ariaLabel='Artboard background color'
                  label='Background color'
                  onChange={setCanvasBackground}
                  onPreview={(color) => {
                    if (stageRef.current) stageRef.current.style.backgroundColor = color;
                  }}
                  value={canvasBackground}
                />
              </div>
              <dl className='shader-lab-v2-composition-metrics'>
                <div><dt>Layers</dt><dd>{visibleLayerIds.length} / {listedLayerIds.length}</dd></div>
                <div><dt>Shaders</dt><dd>{shaderLayers.filter(({ visible }) => visible).length}</dd></div>
                <div><dt>Motion</dt><dd>{paused ? 'Paused' : 'Live'}</dd></div>
              </dl>
            </LabInspectorSection>

            <LabInspectorSection className='shader-lab-v2-control-section design-artboard-inspector' meta={`${workspaceArtboards.length} total`} title='Artboards'>
              <div className='design-artboard-list' aria-label='Workspace artboards' role='group'>
                {workspaceArtboards.map((artboard, index) => (
                  <button aria-pressed={artboard.id === activeArtboardId} key={artboard.id} onClick={() => {
                    deselectCanvasLayers();
                    activateArtboard(artboard.id, true);
                  }} type='button'>
                    <Frame aria-hidden='true' />
                    <span><strong>{resolvedDesignArtboardName(artboard.name)}</strong><small>{studioArtboardPresetForSize(artboard.snapshot.dimensions.width, artboard.snapshot.dimensions.height)?.label ?? 'Custom'} · {artboard.snapshot.layerOrder.length} layers</small></span>
                    <i>{String(index + 1).padStart(2, '0')}</i>
                  </button>
                ))}
              </div>
              <div className='design-artboard-inspector-actions'>
                <button onClick={() => addArtboard(false)} type='button'><Plus aria-hidden='true' />New artboard</button>
                <button onClick={() => addArtboard(true)} type='button'><Copy aria-hidden='true' />Duplicate</button>
                <button onClick={arrangeArtboards} type='button'><LayoutGrid aria-hidden='true' />Arrange all</button>
                <button disabled={workspaceArtboards.length <= 1} onClick={removeActiveArtboard} type='button'><Trash2 aria-hidden='true' />Delete</button>
                <button aria-pressed={workspaceTourOpen} onClick={() => setWorkspaceTourOpen((value) => !value)} type='button'><span aria-hidden='true'>?</span>Artboard guide</button>
              </div>
            </LabInspectorSection>

            <LabInspectorSection className='shader-lab-v2-control-section design-layers-inspector' meta={`${listedLayerIds.length} total`} title='Layers'>
              <div className='shader-lab-v2-composition-subhead'><h3>Add layer</h3><span>To front</span></div>
              <div className='shader-lab-v2-composition-add' aria-label='Add composition layer' role='group'>
                <button onClick={() => addTextLayer()} type='button'><Type aria-hidden='true' /><span><strong>Text</strong><small>{textLayers.filter(({ kind }) => kind !== 'sticker').length} layers</small></span></button>
                <button onClick={() => addCanvasShader()} type='button'><Sparkles aria-hidden='true' /><span><strong>Shader</strong><small>{shaderLayers.length} layers</small></span></button>
                <button onClick={() => addEffectLayer()} type='button'><Grid3X3 aria-hidden='true' /><span><strong>Effect</strong><small>{effectLayers.length} layers</small></span></button>
                <button onClick={addBrandMarkLayer} type='button'><Layers3 aria-hidden='true' /><span><strong>Mark</strong><small>{logoLayers.length} layers</small></span></button>
                <button onClick={() => openImageImport([], 'sticker')} type='button'><Sticker aria-hidden='true' /><span><strong>Sticker</strong><small>{compositionAssets.filter(({ kind }) => kind === 'sticker').length + textLayers.filter(({ kind }) => kind === 'sticker').length} layers</small></span></button>
                <button onClick={() => openImageImport()} title='Open the shared Asset library or import new images' type='button'><ImagePlus aria-hidden='true' /><span><strong>Image</strong><small>{compositionAssets.filter(({ kind }) => kind !== 'sticker').length} placed · {identity.assets.length + identity.proofAssets.length} saved</small></span></button>
              </div>
              <div aria-label='Composition layers, front to back' className='design-layer-inspector-list' role='list'>
                {listedLayerIds.length > 0
                  ? [...listedLayerIds].reverse().map(renderInspectorLayer)
                  : <p className='design-layer-inspector-empty'>No layers yet. Add one above to begin.</p>}
              </div>
            </LabInspectorSection>
          </>}</ConditionalRender>

          <OptionalRender value={selectedEffectLayer}>{(selectedEffectLayer) => (
            <DesignLabEffectInspector
              previewEffectLayer={previewEffectLayer}
              selectEffectPreset={selectEffectPreset}
              selectedEffectLayer={selectedEffectLayer}
              updateEffectLayer={updateEffectLayer}
            />
          )}</OptionalRender>

          <OptionalRender value={editingShader}>{(editingShader) => (
            <DesignLabShaderInspector
              brandPalette={brandPalette}
              editingShader={editingShader}
              initialSettings={initialSettings}
              material={material}
              previewChannel={selectedShaderPreviewChannel}
              previewSelectedShaderOpacity={previewSelectedShaderOpacity}
              previewSelectedShaderSetting={previewSelectedShaderSetting}
              settings={settings}
              shaderSize={shaderSize}
              updateSelectedShader={updateSelectedShader}
              updateSetting={updateSetting}
            />
          )}</OptionalRender>
          <OptionalRender value={selectedShaderLayer}>{(selectedShaderLayer) => (
            <DesignLabShaderFrameInspector
              canvasHeight={canvasDimensions.height}
              canvasWidth={canvasDimensions.width}
              layer={selectedShaderLayer}
              onChange={(transform) => updateCanvasLayerTransform(selectedShaderLayer.id, transform)}
            />
          )}</OptionalRender>
          <OptionalRender value={selectedContentLayerId}>{(selectedContentLayerId) => <LabInspectorSection className='shader-lab-v2-control-section shader-lab-v2-layer-inspector' data-canvas-selection-preserve meta={resolvedLayerKind(selectedContentLayerId)} title='Selected layer'>
            <OptionalRender value={selectedTextInspector}>{(selection) => (
              <DesignLabTextLayerInspector
                canvasHeight={canvasDimensions.height}
                canvasWidth={canvasDimensions.width}
                identity={identity}
                previewSelectedContentOpacity={previewSelectedContentOpacity}
                previewSelectedTextAppearance={previewSelectedTextAppearance}
                previewSelectedTextWidth={previewSelectedTextWidth}
                selectedCanvasLayerCount={selectedCanvasLayerIds.length}
                selection={selection}
                textRenderedWeight={selectedTextRenderedWeight}
                textWeightRange={selectedTextWeightRange}
                updateTextLayer={updateTextLayer}
              />
            )}</OptionalRender>
            <OptionalRender value={selectedLogoInspector}>{({ appearance: selectedLogoAppearance, layer: selectedLogoLayer }) => (
              <div aria-label='Mark appearance' className='shader-lab-v2-layer-settings' role='group'>
                <div className='shader-lab-v2-layer-settings-heading'>
                  <strong>Mark appearance</strong>
                  <span>SVG-safe</span>
                </div>
                <ColorControl
                  ariaLabel='Mark color'
                  label='Mark color'
                  onChange={(color) => updateLogoLayer(selectedLogoLayer.id, { color })}
                  onPreview={(color) => previewSelectedLogoAppearance({}, color)}
                  value={selectedLogoLayer.color ?? '#FFFFFF'}
                />
                <RangeControl
                  formatValue={(value) => `${Math.round(value * 100)}%`}
                  label='Layer opacity'
                  max={1}
                  min={0}
                  onChange={(opacity) => updateLogoLayer(selectedLogoLayer.id, { opacity })}
                  onPreview={previewSelectedContentOpacity}
                  step={0.01}
                  value={selectedLogoLayer.opacity ?? 1}
                />
                <LogoAppearanceControls
                  onChange={(patch) => updateLogoLayer(selectedLogoLayer.id, { appearance: { ...selectedLogoAppearance, ...patch } })}
                  onPreview={previewSelectedLogoAppearance}
                  settings={selectedLogoAppearance}
                />
                <details className='shader-lab-v2-asset-conversion'>
                  <summary><span>SVG conversion & mark library</span><ChevronDown aria-hidden='true' /></summary>
                  <AssetConversionLibrary
                    compact
                    library={convertedAssetLibrary}
                    onSelect={selectConvertedLogo}
                    selectedAssetId={selectedLogoLayer.convertedAssetId ?? null}
                  />
                </details>
              </div>
            )}</OptionalRender>
            <OptionalRender value={selectedAssetInspector}>{({ appearance: selectedAssetAppearance, asset: selectedAsset }) => (
              <DesignLabAssetLayerInspector
                appearance={selectedAssetAppearance}
                asset={selectedAsset}
                previewAppearance={previewSelectedLogoAppearance}
                previewOpacity={previewSelectedContentOpacity}
                previewStickerFinish={previewSelectedStickerFinish}
                updateAsset={(update) => updateAssetLayer(selectedAsset.id, update)}
              />
            )}</OptionalRender>
            {selectedLayerShader ? (
              <Button className='mt-2 w-full' onClick={removeShaderFromSelectedContent} size='sm' type='button' variant='ghost'>
                <X aria-hidden='true' />Remove shader from layer
              </Button>
            ) : null}
            {selectedLogoLayer ? <Button className='mt-2 w-full' onClick={() => updateLogoTransform(selectedLogoLayer.id, DEFAULT_LAYER_TRANSFORM)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset mark position</Button> : null}
            {selectedAsset ? <Button className='mt-2 w-full' onClick={() => updateAssetTransform(selectedAsset.id, DEFAULT_LAYER_TRANSFORM)} size='sm' type='button' variant='ghost'><RotateCcw aria-hidden='true' />Reset image position</Button> : null}
            {selectedTextLayer ? (
              <Button
                className='mt-2 w-full'
                onClick={() => updateTextLayer(selectedTextLayer.id, { transform: DEFAULT_TEXT_LAYER_TRANSFORM })}
                size='sm'
                type='button'
                variant='ghost'
              ><RotateCcw aria-hidden='true' />Reset text box</Button>
            ) : null}
          </LabInspectorSection>}</OptionalRender>

          <OptionalRender value={editingShader}>{() => <details className='shader-lab-v2-advanced'>
            <summary>Advanced <ChevronDown aria-hidden='true' /></summary>
            <div className='shader-lab-v2-ranges'>
              {ADVANCED_CONTROLS.map((control) => (
                <RangeControl
                  {...control}
                  key={control.key}
                  onChange={(value) => updateSetting(control.key, value)}
                  onPreview={(value) => previewSelectedShaderSetting(control.key, value)}
                  value={settings[control.key]}
                />
              ))}
            </div>
          </details>}</OptionalRender>

          <section className='shader-lab-v2-handoff'>
            <Code2 aria-hidden='true' />
            <div><strong>Developer handoff</strong><span>Layer order + exact shader settings</span></div>
            <button onClick={() => void copySetup()} type='button'>{copied ? <Check aria-hidden='true' /> : 'Copy'}</button>
            {copyError ? <p className='shader-lab-v2-handoff-error' role='alert'>{copyError}</p> : null}
          </section>
        </aside>
      </div>
      {renderSourceEditor()}
      <ImageAssetModal
        assets={[...identity.assets, ...identity.proofAssets]}
        busy={imageImportState.status === 'importing'}
        error={imageImportError}
        onClose={() => {
          if (imageImportState.status === 'importing') return;
          setImageImportOpen(false);
          setImageImportRequest(null);
          setImageImportError(null);
        }}
        onCreateTextSticker={() => {
          addTextLayer('sticker');
          setImageImportOpen(false);
          setImageImportRequest(null);
          setImageImportState({ message: 'Added an editable text sticker.', status: 'success' });
        }}
        onImport={importAndSaveImages}
        onPlace={placeSavedAsset}
        open={imageImportOpen}
        placementMode={imagePlacementMode}
        request={imageImportRequest}
      />
    </div>
    );
  }

  return renderStudio();
}
