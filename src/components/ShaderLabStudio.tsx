'use client';

import { loadShaderEffectsProps, type ShaderEffectProps } from '@/lib/shaderEffects';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  Files,
  Frame,
  ImagePlus,
  Layers3,
  LayoutGrid,
  Lock,
  LockOpen,
  Move,
  PaintBrush,
  Plus,
  Scissors,
  Search,
  Sparkles,
  Trash2,
  X,
} from '@/components/ui/SolidIcons';
import { memo, startTransition, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject, type SetStateAction } from 'react';
import { flushSync } from 'react-dom';

import CanvasViewport, { type CanvasActionHistory } from '@/components/CanvasViewport';
import { clearTextStyleProperties, editTextRuns, formatTextRange, INLINE_TEXT_KEYS, textStyleSegments, validateTextStyleRuns, type InlineTextStyle, type ResolvedTextStyle, type TextSelectionRange } from '@/lib/richText';
import { arrangeCanvasFrames, translateCanvasFrame } from '@/lib/canvasViewport';
import { canvasInsertionColors } from '@/lib/canvasInsertionColors';
import CanvasSelectionMenu, { type CanvasSelectionMenuPosition } from '@/components/CanvasSelectionMenu';
import CanvasSelectionClip, { canvasSelectionLocalBounds, paintCanvasSelectionBounds, trackCanvasSelectionNavigation } from '@/components/CanvasSelectionClip';
import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import { beginShaderFrameCapture, shaderFrameMatches, shaderFrameRecipeKey, type CapturedShaderFrame, type ShaderFrameCaptureRequest } from '@/lib/captureShaderFrames';
import { captureComposedEffectFrames } from '@/lib/captureEffectFrames';
import { pauseShaderFrames } from '@/lib/pauseShaderFrames';
import { selectedCanvasLayerElement } from '@/lib/designLabCanvasPreview';
import { checkpointCanvasHistory, redoCanvasCheckpointHistory, undoCanvasCheckpointHistory } from '@/lib/canvasCheckpointHistory';
import { assertCompositionEffectCaptureReady, resolveCompositionEffectPreview } from '@/lib/compositionEffectPreview';
import { applyEffectFrameCaptures } from '@/lib/effectFrameDocument';
import { withCapturedShaderImages, type CapturedShaderImage } from '@/lib/withCapturedShaderImages';
import { importShaderFrameAssets, normalizeShaderFrameSnapshot, type ShaderFrameSnapshot } from '@/lib/shaderFrameAssets';
import { applyShaderFrameCaptures, prepareShaderFrameDocumentSource } from '@/lib/shaderFrameDocument';
import { getShaderMotionCapabilities } from '@/lib/shaderMotionCapabilities';
import { drawShaderFramePresentation, normalizeShaderFramePresentation, preloadShaderFramePresentation } from '@/lib/shaderFramePresentation';
import {
  DEFAULT_DESIGN_LAB_FONT_SIZE,
  designLabTextDecorationLine,
  resolveDesignLabFontSize,
  validateDesignLabTextTypography,
} from '@/lib/designLabTypography';
import { DesignVersionProvider } from '@/components/DesignVersionControls';
import {
  alignCanvasSelection,
  canvasLayerDimensions,
  canvasSelectionBounds,
  canvasThirdsSnapTargets,
  isCanvasTextEditingTarget,
  MIN_CANVAS_LAYER_SCALE,
  nextCanvasLayerSelection,
  normalizeCanvasLayerTransform,
  rotateCanvasVector,
  withCanvasLayerRotation,
  type CanvasLayerAlignment,
  type CanvasLayerBounds,
  type CanvasSelectionItem,
  type CanvasLayerTransform,
} from '@/lib/canvasInteraction';
import { type ExportPreviewAsset } from '@/components/ExportPreview';
import { designLabProjectIdentity, namespaceDesignLabProjectIdentity, prepareDesignLabProjectFile, type DesignLabProjectIdentity } from '@/lib/designLabProjectFile';
import BrandFontFaces from '@/components/BrandFontFaces';
import ImageAssetModal, { type ImageAssetPlacementMode, type ImageImportRequest, type PendingImageImport } from '@/components/ImageAssetModal';
import { LabPanelHeading, StudioSidebar } from '@/components/LabWorkspace';
import { LiveMaterialSourceTag } from '@/components/LiveMaterialSourceLabel';
import SourceCodeDrawer from '@/components/LazySourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioContextMenu, {
  contextMenuPositionFromElement,
  contextMenuPositionFromEvent,
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import ShaderLibraryFilters from '@/components/ShaderLibraryFilters';
import { useRenderQuality } from '@/hooks/useLandingRenderQuality';
import { studioRenderQualityStore } from '@/lib/landingRenderQuality';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';
import { useMountEffect } from '@/hooks/useMountEffect';

export { ShaderZoomControl } from '@/components/DesignLabInspector';

function canvasSelectionAnnouncement(count: number, groupName?: string): string {
  if (count === 0) return 'Canvas selection cleared.';
  const plural = count === 1 ? '' : 's';
  const group = groupName ? ` in ${groupName}` : '';
  return `${count} canvas layer${plural} selected${group}.`;
}

function isCanvasClipboardEditingTarget(target: EventTarget | null): boolean {
  return isCanvasTextEditingTarget(target);
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
import { useStudioDraft } from '@/hooks/usePersistentState';
import { immutableJsonSignature } from '@/lib/immutableJsonSignature';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  brandAssetPath,
  brandTypographyRole,
  resolveBrandTypographyWeight,
  selectableFontAssets,
  type BrandAsset,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { canvasTextCharacters, trackedTextWidth } from '@/lib/canvasText';
import { canvasPaintFamilyList, prepareCanvasPaintFamilies } from '@/lib/canvasPaintFonts';
import { layoutNativeCanvasText } from '@/lib/canvasTextLayout';
import {
  canvasToImageBlob,
  encodeCanvasGif,
  encodeCanvasMp4,
  resolveMotionFrame,
  resolveExportDimensions,
  type MotionLoopReport,
  type MotionFrame,
  type StillImageFormat,
} from '@/lib/canvasExport';
import { loadCanvasImage } from '@/lib/canvasDrawing';
import { canvasImageViewportKey, loadCanvasImageAtViewport } from '@/lib/canvasSvgViewport';
import { canvasRevisionFromSignature, isCanvasDocumentEnvelope, parseCanvasDocument } from '@/lib/canvasDocument';
import {
  normalizeStudioArtboardDimensions,
  STUDIO_ARTBOARD_PRESETS,
  studioArtboardPresetForSize,
  type StudioArtboardDimensions,
} from '@/lib/artboardSizes';
import {
  DESIGN_LAB_CLIPBOARD_MIME,
  designLabCutTarget,
  hydrateDesignLabClipboardFrames,
  parseDesignLabClipboard,
  reanchorDesignLabClipboardSnapshot,
  remapDesignLabClipboardSnapshot,
  serializeDesignLabClipboard,
  writePreparedDesignLabClipboard,
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
  brandMaterialPalette,
  getLiveMaterial,
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
} from '@/lib/designLabDocument';
import { parseSourceObject } from '@/lib/sourceCode';
import {
  clearLiveMaterialTimePreview,
  normalizeLiveMaterialFrameState,
  previewLiveMaterialPatternScale,
  previewLiveMaterialSettings,
  previewLiveMaterialTime,
  readLiveMaterialPresentation,
  requestLiveMaterialRedraw,
} from '@/lib/liveMaterialPreview';
import { createLiveMaterialFramePacer, liveMaterialInstancePixelBudget } from '@/lib/liveMaterialRenderBudget';
import { waitForLiveMaterialReady } from '@/lib/liveMaterialReadiness';
import { observePausedCompositionReadiness } from '@/lib/pausedCompositionRedraw';
import {
  DEFAULT_LOGO_APPEARANCE,
  drawLogoAppearanceLayer,
  logoAppearanceCssFilter,
  logoAppearanceDitherMask,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';
import { copyTextToClipboard } from '@/lib/clipboard';
import { imageUrlToDataUrl } from '@/lib/download';
import {
  DEFAULT_IMAGE_CROP,
  fitImageLayerToCanvas,
  imageCropSourceBounds,
  isImageCropSettings,
  normalizeImageCropSettings,
  previewContainedImageBounds,
  type ImageCropSettings,
} from '@/lib/imagePlacement';
import { createImportedBrandAsset, imageLibraryErrorMessage, readEmbeddedImageFile } from '@/lib/imageAssets';
import {
  SHADER_LAB_CATEGORIES,
  shaderLabCategoryCount,
  shaderLabMaterials,
  shaderLabSettingsFor,
  shaderPreviewAssetPath,
  type ShaderLabCategory,
  type ShaderLabKind,
  type ShaderLabSource,
} from '@/lib/shaderLab';
import {
  savedDesignStorageKey,
} from '@/lib/savedDesigns';
import { clampShaderZoom } from '@/lib/shaderZoom';
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
  drawStickerFinishOverlay,
  normalizeStickerFinish,
  type StickerFinishSettings,
} from '@/lib/surfaceSticker';
import { downloadStudioArtifact, registerStudioAutomation } from '@/lib/studioAutomation';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import type { StudioTool, StudioToolId } from '@/lib/studioCatalog';
import {
  applyTextEffectMask,
  createTextEffectGradient,
  resolveTextEffectSettings,
  textEffectCssStyle,
  type TextEffectSettings,
} from '@/lib/textEffects';

import { DESIGN_CANVAS_ID, DESIGN_CANVAS_DIMENSIONS, designSurfaceSize, designLayerWorldBounds, nextPastedArtboardPosition, reparentDesignLayer, packDesignWorkspace, unpackDesignWorkspace } from '@/lib/designWorkspace';
import CanvasRenderBoundary from '@/components/CanvasRenderBoundary';
import {
  colorWithOpacity,
  DEFAULT_EXPORT_SETTINGS,
  DEFAULT_LAYER_TRANSFORM,
  designExportSettingsSignature,
  normalizeDesignExportSettings,
  RATIO_OPTIONS,
  DEFAULT_TEXT_APPEARANCE,
  DEFAULT_TEXT_LAYER_TRANSFORM,
  isAssetLayerId,
  isCanvasLayerId,
  isContentLayerId,
  isEffectLayerId,
  isLogoLayerId,
  isShaderLayerId,
  isTextLayerId,
  layerGeometry,
  layerKind,
  resolvedLogoAppearance,
  resolvedTextAppearance,
  resolvedTextTransform,
  resolveTextFontWeight,
  resolveTextRunStyle,
  STICKER_IMAGE_APPEARANCE,
  STICKER_TEXT_APPEARANCE,
  textFontFamily,
  textFontWeightRange,
  textLayerFont,
  textShadowStyle,
  type AssetLayerId,
  type CanvasLayerId,
  type CompositionAsset,
  type CompositionEffectLayer,
  type CompositionLayerGroup,
  type CompositionLayerGroupId,
  type CompositionLayerId,
  type CompositionLogoLayer,
  type CompositionShaderLayer,
  type CompositionTextLayer,
  type ContentLayerId,
  type DesignArtboard,
  type DesignExportFormat,
  type DesignExportSettings,
  type DesignMotionMode,
  type DesignRatioOption,
  type DesignArtboardId,
  type DesignArtboardSnapshot,
  type DesignShaderSequenceSettings,
  type EffectLayerId,
  type LogoLayerId,
  type ShaderApplication,
  type ShaderLayerId,
  type ShaderRatio,
  type TextAppearanceSettings,
  type TextLayerId,
} from '@/lib/designLabModel';
import {
  applyAssetEdit,
  applyLogoEdit,
  applyPeerTextEdit,
  peerEdit,
  type AssetLayerEdit,
  type LogoLayerEdit,
  type ShaderEdit,
  type TextLayerEdit,
} from '@/lib/designLabSelectionEdit';
import { applyImageCropPreviewStyles, stickerFinishCssVariables } from '@/components/DesignLabCanvasContent';
import {
  DESIGN_LAB_PREVIEW_MAX_PIXEL_COUNT,
  DesignLabArtboardFrame,
  DesignLabArtboardPreviewLayer,
  DesignLabStageLayer,
  previewStageLayerCrop,
  type DesignLabArtboardActions,
  type DesignLabLiveMaterialState,
  type DesignLabStageActions,
} from '@/components/DesignLabStage';
import { useStableHandlers } from '@/hooks/useStableHandlers';
import { useLocalValueStore } from '@/hooks/useValueStore';
import { arrangeCanvasUnits, canArrangeUnits, isDesignLabArrangement, type DesignLabArrangement } from '@/lib/designLabArrange';
import {
  DESIGN_LAB_IMAGE_EFFECT_CATEGORIES,
  DESIGN_LAB_IMAGE_EFFECTS,
  assertDesignLabEffectProps,
  assertDesignLabEffectSettings,
  designLabImageEffect,
  designLabImageEffectPalette,
  planImageEffectPasses,
  resolveImageEffectOutputs,
  type DesignLabImageEffectId,
  type DesignLabImageEffectStatus,
} from '@/lib/designLabImageEffects';
import { createImageEffectProcessorPool, imageEffectFailureStatus, type ImageEffectProcessorPool } from '@/lib/designLabImageEffectRuntime';
import { applyDesignLabLayerStyle, extractDesignLabLayerStyle, type DesignLabLayerStyle, type DesignLabStyledLayer } from '@/lib/designLabStyle';
import { resolveDesignLabShortcut, type DesignLabShortcutCommand } from '@/lib/designLabShortcuts';
import { preloadLiveMaterial } from '@/lib/liveMaterialPreload';
import {
  DesignLabInspectorPanel,
  type DesignLabInspectorActions,
  type DesignLabInspectorArtboard,
  type DesignLabTextSelection,
} from '@/components/DesignLabInspector';
import {
  DESIGN_LAB_LONG_LAYER_LIST,
  DesignLabDockLayer,
  DesignLabInspectorLayer,
  DesignLabLayerDockPanel,
  type DesignLabLayerDockActions,
  type DesignLabLayerRowActions,
  type DesignLabLayerRowProps,
} from '@/components/DesignLabLayerDock';
import {
  DesignLabArtboardToolbar,
  DesignLabHeader,
  DesignLabMotionStrip,
  DesignLabPreviewQualityToggle,
  DesignLabShortcutsButton,
  DesignLabShortcutsPanel,
  type DesignLabArtboardToolbarActions,
  type DesignLabHeaderActions,
  type DesignLabMotionStripActions,
} from '@/components/DesignLabChrome';

type TextEffectRenderScratch = {
  fill: HTMLCanvasElement;
  mask: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
};

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

type DesignArtboardWorkspaceSource = {
  activeArtboardId?: DesignArtboardId;
  activeSurfaceId?: string;
  artboards?: DesignArtboard[];
  canvas?: DesignArtboard;
};

function emptyDesignCanvas(): DesignArtboard {
  return {
    id: DESIGN_CANVAS_ID, name: 'Canvas', x: 0, y: 0,
    snapshot: {
      assets: [], backgroundColor: '#FFFFFF', dimensions: { ...DESIGN_CANVAS_DIMENSIONS },
      effectLayers: [], groups: [], layerOrder: [], layerShaders: {}, logos: [],
      ratio: 'wide', shaderLayers: [], textLayers: [],
      shaderSequence: { ...DEFAULT_DESIGN_SHADER_SEQUENCE_SETTINGS, targetLayerId: null },
      timeline: { frame: 0, paused: false, timeMs: 0 },
    },
  };
}

type DesignCanvasHistoryEntry = {
  artboards: DesignArtboard[];
  projectTypography: DesignLabProjectIdentity | null;
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
      imageCrop: asset.imageCrop ? { ...asset.imageCrop } : undefined,
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
      ...(Number.isFinite(snapshot.timeline?.timeMs) ? { timeMs: Math.max(0, snapshot.timeline.timeMs!) } : {}),
    },
  };
}

function cloneDesignArtboards(artboards: readonly DesignArtboard[]): DesignArtboard[] {
  return artboards.map((artboard) => ({ ...artboard, snapshot: cloneArtboardSnapshot(artboard.snapshot) }));
}

// Live playback advances continuously and is not a user action. Keeping that
// clock out of signatures prevents history churn while retaining an exact frame
// whenever the user pauses or scrubs the timeline.
const signatureSnapshotViews = new WeakMap<DesignArtboardSnapshot, DesignArtboardSnapshot>();
const signatureArtboardViews = new WeakMap<DesignArtboard, DesignArtboard>();

// Snapshots and artboards are immutable, so their views are reused across calls and
// immutableJsonSignature's per-object cache skips every unchanged board.
function signatureSnapshotView(snapshot: DesignArtboardSnapshot): DesignArtboardSnapshot {
  let view = signatureSnapshotViews.get(snapshot);
  if (!view) {
    view = { ...snapshot, timeline: snapshot.timeline.paused ? snapshot.timeline : { frame: 0, paused: false } };
    signatureSnapshotViews.set(snapshot, view);
  }
  return view;
}

function signatureArtboardView(artboard: DesignArtboard): DesignArtboard {
  let view = signatureArtboardViews.get(artboard);
  if (!view) {
    view = { ...artboard, snapshot: signatureSnapshotView(artboard.snapshot) };
    signatureArtboardViews.set(artboard, view);
  }
  return view;
}

function designCanvasHistorySignature(artboards: readonly DesignArtboard[], typographyRevision: number | null = null): string {
  return immutableJsonSignature({ projectTypography: typographyRevision, artboards: artboards.map(signatureArtboardView) });
}

function artboardSnapshotPersistenceSignature(snapshot: DesignArtboardSnapshot): string {
  return immutableJsonSignature(signatureSnapshotView(snapshot));
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
    canRedo: history.future.length > 0 && history.present?.signature === signature,
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

function designArtboardDisplaySize(dimensions: StudioArtboardDimensions, displayScale?: number): StudioArtboardDimensions {
  return designSurfaceSize(dimensions, displayScale);
}

/**
 * Opened projects play their shaders. Every source capture stores a paused
 * timeline, so honouring it would open each project on a frozen canvas.
 */
function playingSnapshot(snapshot: DesignArtboardSnapshot): DesignArtboardSnapshot {
  return { ...snapshot, timeline: { ...snapshot.timeline, paused: false } };
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
      snapshot: playingSnapshot(cloneArtboardSnapshot(artboard.snapshot)),
      x: artboard.x,
      y: artboard.y,
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
  if (!artboards.some(({ id }) => id === DESIGN_CANVAS_ID)) artboards.push(emptyDesignCanvas());
  return { activeArtboardId, artboards };
}

const DESIGN_ARTBOARD_TOUR_STEPS = [
  {
    description: 'Each artboard is an independent export surface. Copy and paste an artboard or any selected layers with Cmd/Ctrl+C and V.',
    Icon: Frame,
    title: 'Build with artboards',
  },
  {
    description: 'Drag an inactive artboard by its surface or any artboard by its name. Click its contents to edit. Use the artboard map to navigate, center the selected board, or fit everything.',
    Icon: Move,
    title: 'Arrange the workspace',
  },
  {
    description: 'Click empty canvas to add loose ideas. Drag layers out of an artboard or back into one. Frame selection turns loose layers into an output; project files save everything.',
    Icon: Frame,
    title: 'Work beyond the frame',
  },
  {
    description: 'Select an artboard, then add and arrange its layers below. Export always uses the active artboard.',
    Icon: Layers3,
    title: 'Edit in context',
  },
] as const;

const DesignArtboardTour = memo(function DesignArtboardTour({
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
});

function artboardSnapshotSignature(snapshot: DesignArtboardSnapshot): string {
  return immutableJsonSignature(snapshot);
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

const CanvasSelectionAssemblyOverlay = memo(function CanvasSelectionAssemblyOverlay({
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
  const overlayRef = useRef<HTMLDivElement>(null);
  const [screenBounds, setScreenBounds] = useState<{
    height: number;
    left: number;
    top: number;
    viewport: HTMLElement;
    width: number;
  } | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const viewport = stage.closest<HTMLElement>('.canvas-viewport');
    if (!viewport) return;
    let frame = 0;
    let navigation: ReturnType<typeof trackCanvasSelectionNavigation> = null;
    const measure = () => {
      if (stage.closest('[data-canvas-initializing="true"]')) {
        setScreenBounds(null);
        return;
      }
      const stageBounds = stage.getBoundingClientRect();
      const next = {
        ...canvasSelectionLocalBounds({
          height: bounds.height / canvasHeight * stageBounds.height,
          left: stageBounds.left + bounds.left / canvasWidth * stageBounds.width,
          top: stageBounds.top + bounds.top / canvasHeight * stageBounds.height,
          width: bounds.width / canvasWidth * stageBounds.width,
        }, viewport),
        viewport,
      };
      navigation = trackCanvasSelectionNavigation(next, viewport, stage.closest('.canvas-viewport-stage'));
      if (overlayRef.current) {
        paintCanvasSelectionBounds(overlayRef.current, next);
        return;
      }
      setScreenBounds((current) => current
        && Math.abs(current.height - next.height) < 0.25
        && Math.abs(current.left - next.left) < 0.25
        && Math.abs(current.top - next.top) < 0.25
        && Math.abs(current.width - next.width) < 0.25
        && current.viewport === next.viewport
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
    if (viewport) resizeObserver.observe(viewport);
    if (viewportStage) resizeObserver.observe(viewportStage);
    const transformObserver = viewportStage ? new MutationObserver(() => {
      if (overlayRef.current && navigation) paintCanvasSelectionBounds(overlayRef.current, navigation());
      else scheduleMeasure();
    }) : null;
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
  const { viewport, ...selectionBounds } = screenBounds;
  return (
    <CanvasSelectionClip viewport={viewport}>
      <div aria-hidden='true' className='canvas-selection-assembly' data-canvas-selection-preserve ref={overlayRef} style={selectionBounds}>
        <span className='canvas-selection-assembly__label'>{label}</span>
      </div>
    </CanvasSelectionClip>
  );
});

const DEFAULT_CANVAS_SHADER_ID = 'shader-canvas-1' as const satisfies ShaderLayerId;
const DESIGN_LAB_INITIAL_PAN = { x: 0, y: -40 };
/** Image effects re-run on the GPU per preview frame; 10 fps keeps motion beneath them readable. */
const IMAGE_EFFECT_PREVIEW_FRAME_RATE = 10;
// High renders live shaders near device resolution; Auto drops to the draft
// budget after sustained slow frames and returns when they recover. Exports
// always use output resolution.
const DESIGN_LAB_PREVIEW_PIXEL_BUDGETS = {
  high: { maxPerInstance: 2_400_000, minPerInstance: 240_000, totalBudget: 4_800_000 },
  low: { maxPerInstance: DESIGN_LAB_PREVIEW_MAX_PIXEL_COUNT, minPerInstance: 48_000, totalBudget: 300_000 },
} as const;
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
  timeline?: { frame?: number; paused?: boolean; timeMs?: number };
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
  composition.effectLayers?.forEach((layer) => assertDesignLabEffectSettings(layer.settings, `Effect layer ${layer.id}`));
  assertOptionalArray(composition.textLayers, 'Text layers', (layer) => !layer.id?.startsWith('text-') || typeof layer.value !== 'string');
  composition.textLayers?.forEach(validateDesignLabTextTypography);
  assertOptionalArray(composition.logos, 'Mark layers', (layer) => !layer.id?.startsWith('logo-'));
  assertOptionalArray(composition.assets, 'Image layers', (layer) => (
    !layer.id?.startsWith('asset-')
    || (layer.imageCrop !== undefined && !isImageCropSettings(layer.imageCrop))
  ));
  assertOptionalArray(composition.groups, 'Layer groups', (group) => !group.id?.startsWith('group-') || !Array.isArray(group.layerIds));
  assertOptionalArray(composition.layerOrder, 'Layer order', (id) => typeof id !== 'string');
}

function isInvalidWorkspaceArtboard(artboard: DesignArtboard): boolean {
  return !artboard?.id?.startsWith('artboard-')
    || (artboard.displayScale !== undefined && (!Number.isFinite(artboard.displayScale) || artboard.displayScale <= 0))
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
  workspace.artboards.forEach(({ snapshot }) => validateCompositionLayers(snapshot));
}

function validateShaderTimeline(timeline: DesignLabCompositionSource['timeline']) {
  if (timeline?.frame !== undefined && (!Number.isFinite(timeline.frame) || timeline.frame < 0)) throw new TypeError('Motion timeline frame is invalid.');
  if (timeline?.timeMs !== undefined && (!Number.isFinite(timeline.timeMs) || timeline.timeMs < 0)) throw new TypeError('Shader time must be a nonnegative number of milliseconds.');
}

function validateCompositionMetadata(parsed: DesignLabCompositionSource): void {
  const { composition } = parsed;
  if (parsed.ratio && !isShaderRatio(parsed.ratio)) throw new TypeError('Unknown canvas ratio.');
  if (parsed.canvasDimensions && (
    !Number.isFinite(parsed.canvasDimensions.width)
    || !Number.isFinite(parsed.canvasDimensions.height)
  )) throw new TypeError('Canvas dimensions are invalid.');
  if (composition.backgroundColor && !/^#[\dA-F]{6}$/i.test(composition.backgroundColor)) throw new TypeError('Canvas background must be a six-digit HEX color.');
  validateShaderTimeline(parsed.timeline);
  if (parsed.shaderSequence?.pace && !['accelerating', 'even'].includes(parsed.shaderSequence.pace)) throw new TypeError('Shader sequence pacing is invalid.');
  if (parsed.shaderSequence?.sequenceOffset !== undefined && !Number.isFinite(parsed.shaderSequence.sequenceOffset)) throw new TypeError('Shader sequence variation is invalid.');
  if (parsed.shaderSequence?.targetLayerId && !parsed.shaderSequence.targetLayerId.startsWith('shader-')) throw new TypeError('Shader sequence target is invalid.');
  validateArtboardWorkspace(parsed.workspace);
}

/** Native effect props validate against control metadata that loads on demand. */
async function validateShaderEffectSettings(parsed: DesignLabCompositionSource): Promise<void> {
  const compositions = [parsed.composition, ...(parsed.workspace?.artboards ?? []).map(({ snapshot }) => snapshot)];
  const layers = compositions
    .flatMap((composition) => [...(composition.shaderLayers ?? []), ...Object.values(composition.layerShaders ?? {})])
    .flatMap((layer) => layer?.settings?.effectProps === undefined ? [] : [{ effectProps: layer.settings.effectProps, materialId: layer.materialId }]);
  // Image-effect Effect layers carry the same native props under their effectId.
  const effects = compositions.flatMap((composition) => composition.effectLayers ?? [])
    .flatMap(({ settings }) => settings?.effectId ? [{ effectProps: settings.effectProps ?? {}, materialId: settings.effectId }] : []);
  if (!layers.length && !effects.length) return;
  const { validateShaderEffectProps } = await loadShaderEffectsProps();
  [...layers, ...effects].forEach(({ effectProps, materialId }) => validateShaderEffectProps(materialId, effectProps));
}

async function parseCompositionSource(source: string): Promise<DesignLabCompositionSource> {
  const sourceRoot = parseSourceObject(source);
  const parsed = (
    isCanvasDocumentEnvelope(sourceRoot)
      ? parseDesignLabCanvasDocument(source)
      : sourceRoot
  ) as DesignLabCompositionSource;
  if (parsed.workspace) {
    const canvas = parsed.workspace.canvas;
    if (canvas && (canvas.id !== DESIGN_CANVAS_ID || canvas.x !== 0 || canvas.y !== 0
      || canvas.snapshot?.dimensions.width !== DESIGN_CANVAS_DIMENSIONS.width
      || canvas.snapshot?.dimensions.height !== DESIGN_CANVAS_DIMENSIONS.height || canvas.displayScale !== undefined)) {
      throw new TypeError('The canvas coordinate space is fixed; move its layers instead.');
    }
    parsed.workspace = unpackDesignWorkspace(parsed.workspace) as DesignArtboardWorkspaceSource;
    delete parsed.workspace.canvas;
    delete parsed.workspace.activeSurfaceId;
  }
  if (!parsed?.composition) throw new TypeError('A composition object is required.');
  validateCompositionLayers(parsed.composition);
  validateCompositionMetadata(parsed);
  await validateShaderEffectSettings(parsed);
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
      imageCrop: asset.imageCrop ? { ...asset.imageCrop } : undefined,
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
      imageCrop: normalizeImageCropSettings(savedAsset.imageCrop ?? current?.imageCrop),
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
        frameState: normalizeLiveMaterialFrameState(application.frameState),
        frameSnapshot: normalizeShaderFrameSnapshot(application.frameSnapshot),
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
    frameState: normalizeLiveMaterialFrameState(layer.frameState),
    frameSnapshot: normalizeShaderFrameSnapshot(layer.frameSnapshot),
    settings: { ...layer.settings },
    shaderSize: clampShaderZoom(layer.shaderSize),
    transform: normalizeCanvasLayerTransform(layer.transform, DEFAULT_LAYER_TRANSFORM),
  }));
  if (targetLayerId && !layers.some(({ id }) => id === targetLayerId)) {
    throw new TypeError('Shader sequence target layer does not exist.');
  }
  return layers;
}

function restoredEffectLayers(layers: readonly CompositionEffectLayer[]): CompositionEffectLayer[] {
  return layers.map((layer) => ({
    ...layer,
    frameSnapshot: normalizeShaderFrameSnapshot(layer.frameSnapshot),
    settings: { ...layer.settings },
  }));
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
      onFocus={() => preloadLiveMaterial(material.id)}
      onPointerEnter={() => preloadLiveMaterial(material.id)}
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

function syncSelectedCanvasLayerOverlay(layer: HTMLElement) {
  const viewport = layer.closest<HTMLElement>('.canvas-viewport');
  const overlay = viewport?.querySelector<HTMLElement>('.editable-canvas-layer-selection');
  if (!overlay || !viewport) return;
  const bounds = canvasSelectionLocalBounds(layer.getBoundingClientRect(), viewport);
  overlay.style.left = `${bounds.left}px`;
  overlay.style.top = `${bounds.top}px`;
  overlay.style.width = `${bounds.width}px`;
  overlay.style.height = `${bounds.height}px`;
}

function dataTransferHasFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files');
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

function drawImageCrop(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  crop?: Partial<ImageCropSettings>
) {
  const source = imageCropSourceBounds({
    boxHeight: height,
    boxWidth: width,
    crop,
    imageHeight: image.naturalHeight || 1,
    imageWidth: image.naturalWidth || 1,
  });
  context.drawImage(
    image,
    source.x,
    source.y,
    source.width,
    source.height,
    0,
    0,
    width,
    height
  );
}

export function createContainedLayer(
  image: HTMLImageElement,
  width: number,
  height: number,
  color?: string,
  fillFrame = false,
  imageCrop?: Partial<ImageCropSettings>
) {
  const layer = document.createElement('canvas');
  layer.width = Math.max(1, Math.round(width));
  layer.height = Math.max(1, Math.round(height));
  const layerContext = layer.getContext('2d');
  if (!layerContext) return layer;
  // Fit in the exact authored box, not its rounded backing buffer. The final
  // compositor maps this buffer back to width/height; fitting before that map
  // distorts intrinsic image proportions, especially for very small layers.
  layerContext.scale(layer.width / width, layer.height / height);
  if (fillFrame && normalizeImageCropSettings(imageCrop).enabled) {
    drawImageCrop(layerContext, image, width, height, imageCrop);
  } else if (fillFrame) {
    layerContext.drawImage(image, 0, 0, width, height);
  } else {
    const bounds = previewContainedImageBounds({
      boxHeight: height,
      boxWidth: width,
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
    layerContext.fillRect(0, 0, width, height);
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

/** Turns the context clockwise about the center of a layer's output box, as the canvas turns the layer. */
export function rotateContextAboutBox(context: CanvasRenderingContext2D, box: OutputLayerBox, degrees: number) {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  context.translate(centerX, centerY);
  context.rotate(degrees * Math.PI / 180);
  context.translate(-centerX, -centerY);
}

function paintSolidDesignLabText(
  context: CanvasRenderingContext2D,
  appearance: TextAppearanceSettings,
  pattern: CanvasPattern | null,
  paintTextLines: PaintTextLines,
  rotation = 0
) {
  context.fillStyle = pattern ?? appearance.color;
  if (appearance.shadowEnabled) {
    // Canvas shadow offsets ignore the context's rotation; turn them so the
    // shadow falls where the canvas shows it on the rotated layer.
    const offset = rotateCanvasVector({ x: appearance.shadowOffsetX, y: appearance.shadowOffsetY }, rotation);
    context.shadowBlur = appearance.shadowBlur;
    context.shadowColor = colorWithOpacity(appearance.shadowColor, appearance.shadowOpacity / 100);
    context.shadowOffsetX = offset.x;
    context.shadowOffsetY = offset.y;
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

export function paintDesignLabTextLayer({
  application,
  box,
  canvasHeight,
  canvasWidth,
  context,
  height,
  identity,
  layer,
  paintShaderApplication,
  rotation,
  textEffectScratch,
  width,
}: {
  application?: ShaderApplication;
  box: OutputLayerBox;
  canvasHeight: number;
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
  /** The layer's rotation; the caller has already turned the context by it. */
  rotation?: number;
  textEffectScratch: TextEffectRenderScratch;
  width: number;
}) {
  if (!layer.value) return;
  const appearance = resolvedTextAppearance(layer);
  context.save();
  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  // Match the canvas's cqw sizing in authored coordinates. Output-height rounding
  // and an export-only minimum must never change the font or its line breaks.
  const fontSize = resolveDesignLabFontSize(layer, canvasHeight) * width / canvasWidth;
  const spacing = layer.tracking * fontSize;
  const { family, weight: fontWeight } = textLayerFont(identity, layer);
  const fontFamily = `${JSON.stringify(family)}, Arial, sans-serif`;
  context.font = `${layer.fontStyle ?? 'normal'} ${fontWeight} ${fontSize}px ${canvasPaintFamilyList(fontFamily)}`;
  context.fontKerning = 'normal';
  const supportsNativeLetterSpacing = typeof context.letterSpacing === 'string';
  if (supportsNativeLetterSpacing) context.letterSpacing = `${spacing}px`;
  const measureText = (text: string) => context.measureText(text).width;
  const outputScale = width / canvasWidth;
  const textLayout = layoutNativeCanvasText({
    align: layer.align,
    boxHeight: box.height / outputScale,
    boxWidth: box.width / outputScale,
    fontFamily,
    fontSize: resolveDesignLabFontSize(layer, canvasHeight),
    fontStyle: layer.fontStyle ?? 'normal',
    fontWeight,
    lineHeight: layer.lineHeight,
    tracking: layer.tracking,
    value: layer.value,
    wrap: layer.wrap,
    runs: layer.runs?.length ? textStyleSegments(layer.value, layer.runs).map((run) => ({ ...run, style: resolveTextRunStyle(layer, identity, canvasHeight, run.style) })) : undefined,
  });
  const { lines } = textLayout;
  const textBox = { ...box, height: textLayout.height * outputScale, y: box.y + textLayout.offsetY * outputScale };
  const metrics = context.measureText('Mg');
  const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent || fontSize * 0.2;
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
  const decorationLine = designLabTextDecorationLine(layer);
  const decorationThickness = Math.max(1, fontSize * 0.055);
  const paintDecorations = (
    target: CanvasRenderingContext2D,
    lineX: number,
    baseline: number,
    lineWidth: number,
    inline?: ResolvedTextStyle,
  ) => {
    const decoration = inline ? designLabTextDecorationLine(inline) : decorationLine;
    const size = inline ? inline.fontSize * outputScale : fontSize;
    const thickness = inline ? Math.max(1, size * 0.055) : decorationThickness;
    const inlineMetrics = inline ? target.measureText('Mg') : metrics;
    const inlineAscent = inline ? inlineMetrics.fontBoundingBoxAscent || inlineMetrics.actualBoundingBoxAscent || size * 0.8 : ascent;
    const inlineDescent = inline ? inlineMetrics.fontBoundingBoxDescent || inlineMetrics.actualBoundingBoxDescent || size * 0.2 : descent;
    if (lineWidth <= 0 || decoration === 'none') return;
    if (decoration.includes('underline')) {
      const underlineCenter = baseline + Math.max(thickness, inlineDescent * 0.36);
      target.fillRect(lineX, underlineCenter - thickness / 2, lineWidth, thickness);
    }
    if (decoration.includes('line-through')) {
      const strikethroughCenter = baseline - inlineAscent * 0.32;
      target.fillRect(lineX, strikethroughCenter - thickness / 2, lineWidth, thickness);
    }
  };
  const paintTextLines = (target: CanvasRenderingContext2D, mode: 'fill' | 'stroke') => {
    configureTextContext(target);
    lines.forEach(({ value: line, x, baseline: nativeBaseline, style: inline }) => {
      const runSpacing = inline ? inline.tracking * inline.fontSize * outputScale : spacing;
      if (inline) {
        target.font = `${inline.fontStyle} ${inline.fontWeight} ${inline.fontSize * outputScale}px ${canvasPaintFamilyList(inline.fontFamily)}`;
        if (supportsNativeLetterSpacing) target.letterSpacing = `${runSpacing}px`;
        if (mode === 'fill' && target === context && !pattern && appearance.textEffect.kind === 'solid') target.fillStyle = inline.color;
      }
      const measureRun = (value: string) => inline ? target.measureText(value).width : measureText(value);
      const baseline = box.y + nativeBaseline * outputScale;
      const lineX = box.x + x * outputScale;
      if (supportsNativeLetterSpacing) {
        const lineWidth = measureRun(line);
        if (mode === 'stroke') target.strokeText(line, lineX, baseline);
        else {
          target.fillText(line, lineX, baseline);
          paintDecorations(target, lineX, baseline, lineWidth, inline);
        }
        return;
      }
      const characters = canvasTextCharacters(line);
      const lineWidth = trackedTextWidth(line, measureRun, runSpacing);
      let cursor = lineX;
      characters.forEach((character) => {
        if (mode === 'stroke') target.strokeText(character, cursor, baseline);
        else target.fillText(character, cursor, baseline);
        cursor += measureRun(character) + runSpacing;
      });
      if (mode === 'fill') {
        paintDecorations(target, lineX, baseline, lineWidth, inline);
      }
    });
  };

  if (appearance.textEffect.kind === 'solid') {
    paintSolidDesignLabText(context, appearance, pattern, paintTextLines, rotation);
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
    box: textBox,
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
  effectAction: (action: string, input: unknown) => Promise<unknown>;
  formatText: (input: unknown) => Promise<unknown>;
  layerAction: (action: string, input: unknown) => Promise<unknown>;
  workspaceAction: (action: string, input: unknown) => Promise<unknown>;
  prepareCompositionSource: () => Promise<string>;
  prepareProjectFile: () => Promise<ExportPreviewAsset>;
  pauseShaderHistory: () => void;
  playShaderHistory: () => void;
  seekShaderTime: (timeMs: number) => void;
  describeShaderMotion: () => object;
  exportForAutomation: (request: DesignAutomationExportInput) => Promise<ExportPreviewAsset>;
  normalizedShaderSequenceSettings: DesignShaderSequenceSettings;
  previewShaderSequence: () => void;
  isSequencePreviewing: () => boolean;
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

/** Validates `design.layers.*` input; unknown keys are rejected like other Design Lab actions. */
export function designLayerActionInput(action: string, input: unknown): {
  arrangement?: DesignLabArrangement;
  layerId?: string;
  layerIds?: string[];
  locked?: boolean;
  rotation?: number;
} {
  const allowed: Record<string, readonly string[]> = {
    'design.layers.arrange': ['arrangement', 'layerIds'],
    'design.layers.copyStyle': ['layerId'],
    'design.layers.lock': ['layerIds', 'locked'],
    'design.layers.pasteStyle': ['layerIds'],
    'design.layers.rotate': ['layerIds', 'rotation'],
  };
  const keys = allowed[action];
  if (!keys) throw new RangeError(`Unknown Design Lab action: ${action}.`);
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !keys.includes(key))) {
    throw new TypeError(`${action} accepts only { ${keys.join(', ')} }.`);
  }
  const request = input as Record<string, unknown>;
  if (request.layerIds !== undefined && (!Array.isArray(request.layerIds) || request.layerIds.some((id) => typeof id !== 'string'))) {
    throw new TypeError('layerIds must be an array of layer ids.');
  }
  assertDesignLayerActionValues(action, request);
  return request as ReturnType<typeof designLayerActionInput>;
}

function assertDesignLayerActionValues(action: string, request: Record<string, unknown>) {
  if (action === 'design.layers.arrange' && !isDesignLabArrangement(request.arrangement)) {
    throw new TypeError('arrangement must be left, horizontal-center, right, top, vertical-center, bottom, distribute-horizontal or distribute-vertical.');
  }
  if (action === 'design.layers.lock' && typeof request.locked !== 'boolean') throw new TypeError('locked must be true or false.');
  if (action === 'design.layers.copyStyle' && typeof request.layerId !== 'string') throw new TypeError('layerId must identify a layer.');
  if (action === 'design.layers.rotate' && (typeof request.rotation !== 'number' || !Number.isFinite(request.rotation))) {
    throw new TypeError('rotation must be a finite number of degrees.');
  }
  if ((action === 'design.layers.lock' || action === 'design.layers.pasteStyle' || action === 'design.layers.rotate') && !Array.isArray(request.layerIds)) {
    throw new TypeError('layerIds must list at least one layer.');
  }
}

const DESIGN_EFFECT_ACTION_FIELDS: Readonly<Record<string, readonly string[]>> = {
  'design.effects.add': ['effectId', 'effectProps', 'kind', 'opacity'],
  'design.effects.configure': ['effectId', 'effectProps', 'kind', 'layerId', 'opacity'],
  'design.effects.describe': [],
};

export type DesignEffectActionInput = {
  effectId?: DesignLabImageEffectId;
  effectProps?: ShaderEffectProps;
  kind?: CompositionEffectKind;
  layerId?: string;
  opacity?: number;
};

function assertDesignEffectFields(request: Record<string, unknown>) {
  if (request.kind !== undefined && !COMPOSITION_EFFECT_PRESETS.some(({ kind }) => kind === request.kind)) {
    throw new TypeError('kind must be bayer, ascii, halftone or posterize.');
  }
  if (request.kind !== undefined && request.effectId !== undefined) {
    throw new TypeError('Pass kind for a built-in converter or effectId for an image effect, not both.');
  }
  const { opacity } = request;
  if (opacity !== undefined && (typeof opacity !== 'number' || !Number.isFinite(opacity) || opacity < 0 || opacity > 1)) {
    throw new TypeError('opacity must be a number from 0 to 1.');
  }
}

/**
 * Validates `design.effects.*` input. Effect props are checked here for shape
 * only; their control values validate against metadata the host loads lazily.
 */
export function designEffectActionInput(action: string, input: unknown): DesignEffectActionInput {
  const keys = DESIGN_EFFECT_ACTION_FIELDS[action];
  if (!keys) throw new RangeError(`Unknown Design Lab action: ${action}.`);
  if (input === undefined && action === 'design.effects.describe') return {};
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((key) => !keys.includes(key))) {
    throw new TypeError(keys.length ? `${action} accepts only { ${keys.join(', ')} }.` : `${action} takes no input.`);
  }
  const request = input as Record<string, unknown>;
  assertDesignEffectFields(request);
  if (action === 'design.effects.configure') {
    if (typeof request.layerId !== 'string') throw new TypeError('layerId must identify an Effect layer.');
    if (Object.keys(request).length === 1) throw new TypeError('design.effects.configure needs effectId, kind, effectProps or opacity.');
  }
  if (request.effectId !== undefined || action === 'design.effects.add') {
    assertDesignLabEffectSettings({ effectId: request.effectId, effectProps: request.effectProps }, action);
  } else if (request.effectProps !== undefined) {
    // configure may edit the props of the layer's current image effect.
    assertDesignLabEffectProps(request.effectProps, action);
  }
  return request as DesignEffectActionInput;
}

function designAutomationSeekTime(input: unknown): number {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some((key) => key !== 'timeMs')
    || typeof (input as { timeMs?: unknown }).timeMs !== 'number') {
    throw new TypeError('design.frame.seek requires { timeMs }.');
  }
  return (input as { timeMs: number }).timeMs;
}

function designWorkspaceActionInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Workspace actions require an input object.');
  const request = input as { target?: unknown; layerIds?: unknown; placement?: unknown };
  if (Object.keys(request).some((key) => !['target', 'layerIds', 'placement'].includes(key))) throw new TypeError('Unknown workspace action field.');
  return request;
}

/** Action families that one handler validates and runs. */
const DESIGN_AUTOMATION_ACTION_FAMILIES = [
  ['design.workspace.', 'workspaceAction'],
  ['design.layers.', 'layerAction'],
  ['design.effects.', 'effectAction'],
] as const satisfies readonly (readonly [string, keyof DesignAutomationHandlers])[];

async function invokeDesignAutomationAction(handlers: DesignAutomationHandlers, action: string, input: unknown) {
  const family = DESIGN_AUTOMATION_ACTION_FAMILIES.find(([prefix]) => action.startsWith(prefix));
  if (family) return handlers[family[1]](action, input);
  switch (action) {
    case 'design.text.format':
      return handlers.formatText(input);
    case 'design.frame.capture':
      return handlers.prepareCompositionSource();
    case 'design.export.project':
      return handlers.prepareProjectFile();
    case 'design.frame.pause':
      handlers.pauseShaderHistory();
      return null;
    case 'design.frame.play':
      handlers.playShaderHistory();
      return null;
    case 'design.frame.seek': {
      handlers.seekShaderTime(designAutomationSeekTime(input));
      return null;
    }
    case 'design.motion.describe':
      return handlers.describeShaderMotion();
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
      if (!handlers.isSequencePreviewing()) handlers.previewShaderSequence();
      return null;
    case 'design.sequence.stop':
      if (handlers.isSequencePreviewing()) handlers.stopShaderSequencePreview();
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
  const textWeightRange = textLayer
    ? textFontWeightRange(identity, textFontFamily(identity, textLayer))
    : { max: 900, min: 100 };
  const textRenderedWeight = textLayer ? textLayerFont(identity, textLayer).weight : 400;
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

type DesignLabCanvasSelectionInput = {
  canvasDimensions: StudioArtboardDimensions;
  compositionAssets: CompositionAsset[];
  duplicateLayers: (ids: readonly CompositionLayerId[]) => Promise<CompositionLayerId[]>;
  layerGroups: CompositionLayerGroup[];
  layerGroupByLayerId: ReadonlyMap<CanvasLayerId, CompositionLayerGroup>;
  layerOrder: CompositionLayerId[];
  /** Visible and unlocked: the layers a canvas gesture may select or move. */
  layerSelectable: (id: CompositionLayerId) => boolean;
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
  captureCompositionFrame: () => Promise<ReturnType<typeof createDesignLabCanvasDocument>>;
  compositionAssets: CompositionAsset[];
  effectLayers: CompositionEffectLayer[];
  logoLayers: CompositionLogoLayer[];
  removeAsset: (id: AssetLayerId) => void;
  removeEffectLayer: (id: EffectLayerId) => void;
  removeLogoLayer: (id: LogoLayerId) => void;
  removeTextLayer: (id: TextLayerId) => void;
  setCompositionAssets: Dispatch<SetStateAction<CompositionAsset[]>>;
  setEffectLayers: Dispatch<SetStateAction<CompositionEffectLayer[]>>;
  setExportError: Dispatch<SetStateAction<string | null>>;
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
  captureCompositionFrame,
  compositionAssets,
  effectLayers,
  logoLayers,
  removeAsset,
  removeEffectLayer,
  removeLogoLayer,
  removeTextLayer,
  setCompositionAssets,
  setEffectLayers,
  setExportError,
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
  const duplicatingRef = useRef(false);
  function placeLayerAfter(sourceId: CompositionLayerId, nextId: CompositionLayerId) {
    setLayerOrder((current) => {
      const sourceIndex = current.indexOf(sourceId);
      if (sourceIndex < 0) return [...current, nextId];
      return [...current.slice(0, sourceIndex + 1), nextId, ...current.slice(sourceIndex + 1)];
    });
    setSelectedLayerId(nextId);
  }

  function placeDuplicatedContentLayer<LayerId extends ContentLayerId>(
    sourceId: LayerId,
    nextId: LayerId,
    captured: DesignLabCompositionSource['composition']
  ): LayerId {
    const sourceShader = captured.layerShaders?.[sourceId];
    if (sourceShader) {
      setLayerShaders((current) => ({
        ...current,
        [nextId]: structuredClone(sourceShader),
      }));
    }
    placeLayerAfter(sourceId, nextId);
    return nextId;
  }

  function duplicateShaderLayer(id: ShaderLayerId, captured: DesignLabCompositionSource['composition']): ShaderLayerId | null {
    const source = captured.shaderLayers?.find((layer) => layer.id === id);
    if (!source) return null;
    const nextId = `shader-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as ShaderLayerId;
    const transform = normalizeCanvasLayerTransform(source.transform, DEFAULT_LAYER_TRANSFORM);
    setShaderLayers((current) => [...current, {
      ...structuredClone(source),
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

  function duplicateTextLayer(id: TextLayerId, captured: DesignLabCompositionSource['composition']): TextLayerId | null {
    const source = captured.textLayers?.find((layer) => layer.id === id);
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
    return placeDuplicatedContentLayer(id, nextId, captured);
  }

  function duplicateLogoLayer(id: LogoLayerId, captured: DesignLabCompositionSource['composition']): LogoLayerId | null {
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
    return placeDuplicatedContentLayer(id, nextId, captured);
  }

  function duplicateImageLayer(id: AssetLayerId, captured: DesignLabCompositionSource['composition']): AssetLayerId | null {
    const source = compositionAssets.find((asset) => asset.id === id);
    if (!source) return null;
    const nextId = `asset-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as AssetLayerId;
    setCompositionAssets((current) => [...current, {
      ...source,
      appearance: source.appearance ? { ...source.appearance } : undefined,
      id: nextId,
      imageCrop: source.imageCrop ? { ...source.imageCrop } : undefined,
      name: `${source.name} copy`,
      stickerFinish: source.stickerFinish ? { ...source.stickerFinish } : undefined,
      transform: { ...source.transform, x: source.transform.x + 32, y: source.transform.y + 32 },
    }]);
    return placeDuplicatedContentLayer(id, nextId, captured);
  }

  function duplicateCapturedLayer(id: CompositionLayerId, captured: DesignLabCompositionSource['composition']): CompositionLayerId | null {
    if (isShaderLayerId(id)) return duplicateShaderLayer(id, captured);
    if (isEffectLayerId(id)) return duplicateEffectLayer(id);
    if (isTextLayerId(id)) return duplicateTextLayer(id, captured);
    if (isLogoLayerId(id)) return duplicateLogoLayer(id, captured);
    return duplicateImageLayer(id, captured);
  }

  async function duplicateLayers(ids: readonly CompositionLayerId[]): Promise<CompositionLayerId[]> {
    if (duplicatingRef.current || ids.length === 0) return [];
    duplicatingRef.current = true;
    try {
      const document = await captureCompositionFrame();
      const captured = (await parseCompositionSource(serializeExistingDesignLabCanvasDocument(document))).composition;
      const nextIds = [...new Set(ids)].flatMap((id) => {
        const nextId = duplicateCapturedLayer(id, captured);
        return nextId ? [nextId] : [];
      });
      setExportError(null);
      return nextIds;
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The selected shader frames could not be duplicated.');
      return [];
    } finally {
      duplicatingRef.current = false;
    }
  }

  async function duplicateLayer(id: CompositionLayerId): Promise<CompositionLayerId | null> {
    return (await duplicateLayers([id]))[0] ?? null;
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

  function setLayersVisibility(ids: readonly CompositionLayerId[], visible: boolean) {
    const targets = new Set(ids);
    setShaderLayers((current) => current.map((layer) => targets.has(layer.id) ? { ...layer, visible } : layer));
    setEffectLayers((current) => current.map((layer) => targets.has(layer.id) ? { ...layer, visible } : layer));
    setLogoLayers((current) => current.map((layer) => targets.has(layer.id) ? { ...layer, visible } : layer));
    setTextLayers((current) => current.map((layer) => targets.has(layer.id) ? { ...layer, visible } : layer));
    setCompositionAssets((current) => current.map((layer) => targets.has(layer.id) ? { ...layer, visible } : layer));
  }

  function removeShadersFromContent(ids: readonly ContentLayerId[]) {
    if (!ids.length) return;
    setLayerShaders((current) => {
      const next = { ...current };
      ids.forEach((id) => delete next[id]);
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

  return { duplicateLayer, duplicateLayers, layerLabel, removeLayer, removeShadersFromContent, resolvedLayerKind, setLayersVisibility, toggleLayerVisibility };
}

function useDesignLabCanvasSelection({
  canvasDimensions,
  compositionAssets,
  duplicateLayers,
  layerGroups,
  layerGroupByLayerId,
  layerOrder,
  layerSelectable,
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
    return ids.filter(layerSelectable);
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

  /** Turns each layer about its own center; position and size are unchanged. */
  function rotateCanvasLayers(ids: readonly CanvasLayerId[], degrees: number) {
    const updates = new Map<CanvasLayerId, CanvasLayerTransform>();
    ids.forEach((layerId) => {
      const transform = canvasLayerTransform(layerId);
      if (transform) updates.set(layerId, withCanvasLayerRotation(transform, degrees));
    });
    updateCanvasLayerTransforms(updates);
  }

  /** An inspector frame edit: the selection moves together, and layers of the same kind take the new size. */
  function updateSelectionFrame(id: CanvasLayerId, nextTransform: CanvasLayerTransform) {
    const current = canvasLayerTransform(id);
    if (!current) return;
    const ids = selectedCanvasLayerIdSet.has(id) ? selectedCanvasLayerIds : [id];
    if (ids.length <= 1) {
      updateCanvasLayerTransforms(new Map([[id, nextTransform]]));
      return;
    }
    const before: Partial<Record<string, unknown>> = current;
    const after: Partial<Record<string, unknown>> = nextTransform;
    const size = Object.fromEntries([...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((key) => key !== 'x' && key !== 'y' && before[key] !== after[key])
      .map((key) => [key, after[key]]));
    const updates = new Map<CanvasLayerId, CanvasLayerTransform>();
    ids.forEach((layerId) => {
      const transform = canvasLayerTransform(layerId);
      if (!transform) return;
      updates.set(layerId, {
        ...transform,
        ...(layerKind(layerId) === layerKind(id) ? size : {}),
        x: transform.x + nextTransform.x - current.x,
        y: transform.y + nextTransform.y - current.y,
      });
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

  /** Selected layers grouped into rigid units: a fully selected group moves as one. */
  function selectionUnits(ids: readonly CanvasLayerId[] = selectedCanvasLayerIds): CanvasLayerId[][] {
    const idSet = new Set(ids);
    const claimed = new Set<CanvasLayerId>();
    const units: CanvasLayerId[][] = [];
    for (const id of ids) {
      if (claimed.has(id)) continue;
      const group = groupForLayer(id);
      const unit = group && group.layerIds.every((layerId) => idSet.has(layerId)) ? group.layerIds : [id];
      unit.forEach((layerId) => claimed.add(layerId));
      units.push([...unit]);
    }
    return units;
  }

  function arrangeCanvasSelection(arrangement: DesignLabArrangement, ids: readonly CanvasLayerId[] = selectedCanvasLayerIds): boolean {
    const units = selectionUnits(ids);
    if (!canArrangeUnits(arrangement, units.length)) return false;
    const offsets = arrangeCanvasUnits(units.map((unit) => unit.flatMap((layerId): CanvasSelectionItem[] => {
      const transform = canvasLayerTransform(layerId);
      return transform ? [{ geometry: layerGeometry(layerId, canvasDimensions), transform }] : [];
    })), arrangement);
    const updates = new Map<CanvasLayerId, CanvasLayerTransform>();
    units.forEach((unit, index) => unit.forEach((layerId) => {
      const transform = canvasLayerTransform(layerId);
      const offset = offsets[index]!;
      if (transform) updates.set(layerId, { ...transform, x: transform.x + offset.x, y: transform.y + offset.y });
    }));
    updateCanvasLayerTransforms(updates);
    return true;
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

  function moveCanvasSelectionToEdge(edge: 'back' | 'front') {
    const selected = new Set<CompositionLayerId>(selectedCanvasLayerIds);
    setLayerOrder((current) => {
      const selectedIds = current.filter((id) => selected.has(id));
      const remaining = current.filter((id) => !selected.has(id));
      return edge === 'front' ? [...remaining, ...selectedIds] : [...selectedIds, ...remaining];
    });
  }

  function selectAllCanvasLayers() {
    const ids = layerOrder.filter((id): id is CanvasLayerId => isCanvasLayerId(id) && layerSelectable(id));
    setSelectedCanvasLayerIds(ids);
    setSelectedLayerId(ids.at(-1) ?? null);
    setSelectionMenuPosition(null);
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

  async function duplicateCanvasSelection() {
    const sourceIds = layerOrder.filter((layerId): layerId is CanvasLayerId => (
      isCanvasLayerId(layerId) && selectedCanvasLayerIdSet.has(layerId)
    ));
    const nextIds = (await duplicateLayers(sourceIds)).filter(isCanvasLayerId);
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

  return {
    alignCanvasAssembly,
    arrangeCanvasSelection,
    deselectCanvasLayers,
    duplicateCanvasSelection,
    groupCanvasSelection,
    groupForLayer,
    movementBoundsFor,
    moveCanvasSelection,
    moveCanvasSelectionToEdge,
    openCanvasSelectionMenu,
    removeCanvasSelection,
    rotateCanvasLayers,
    selectCanvasAssembly,
    selectAllCanvasLayers,
    selectedCanvasBounds,
    selectedCanvasGroup,
    selectedCanvasLayerIdSet,
    selectedGroupedAssemblies,
    selectionUnits,
    selectLayerFromStack,
    ungroupCanvasSelection,
    updateCanvasLayerTransform,
    updateSelectionFrame,
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

const DesignArtboardContextMenu = memo(function DesignArtboardContextMenu({
  activeArtboardId,
  artboards,
  menu,
  onArrange,
  onClose,
  onCopy,
  onDelete,
  onDuplicate,
  onFocus,
  onNew,
  onPaste,
}: {
  activeArtboardId: DesignArtboardId;
  artboards: readonly DesignArtboard[];
  menu: DesignArtboardMenuState | null;
  onArrange: () => void;
  onClose: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onFocus: (id: DesignArtboardId) => void;
  onNew: () => void;
  onPaste: () => void;
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
            { icon: <Copy aria-hidden='true' />, id: 'copy-artboard', label: 'Copy artboard', onSelect: onCopy, shortcut: '⌘C' },
            { icon: <Files aria-hidden='true' />, id: 'paste-artboard', label: 'Paste', onSelect: onPaste, shortcut: '⌘V' },
            { icon: <Files aria-hidden='true' />, id: 'duplicate-artboard', label: 'Duplicate artboard', onSelect: onDuplicate },
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
});

function layerStyleMenuSection(
  layerId: CompositionLayerId,
  canPaste: boolean,
  onCopyStyle: (id: CompositionLayerId) => void,
  onPasteStyle: (id: CompositionLayerId) => void
) {
  return {
    label: 'Style',
    items: [
      { icon: <PaintBrush aria-hidden='true' />, id: 'copy-layer-style', label: 'Copy style', onSelect: () => onCopyStyle(layerId), shortcut: '⌥⌘C' },
      { disabled: !canPaste, icon: <PaintBrush aria-hidden='true' />, id: 'paste-layer-style', label: 'Paste style', onSelect: () => onPasteStyle(layerId), shortcut: '⌥⌘V' },
    ],
  };
}

function layerLockMenuItem(layerId: CompositionLayerId, locked: boolean, onToggleLock: (id: CompositionLayerId) => void) {
  return {
    checked: locked,
    icon: locked ? <Lock aria-hidden='true' /> : <LockOpen aria-hidden='true' />,
    id: 'toggle-layer-lock',
    label: locked ? 'Unlock layer' : 'Lock layer',
    onSelect: () => onToggleLock(layerId),
    shortcut: '⇧⌘L',
  };
}

const LayerDockContextMenu = memo(function LayerDockContextMenu({
  canPasteStyle,
  layerKind,
  layerLabel,
  layerLocked,
  layerOrder,
  layerVisible,
  menu,
  onClose,
  onCopy,
  onCopyStyle,
  onCut,
  onDelete,
  onDuplicate,
  onMove,
  onMoveToEdge,
  onPaste,
  onPasteStyle,
  onToggleLock,
  onToggleVisibility,
}: {
  canPasteStyle: boolean;
  layerKind: (id: CompositionLayerId) => string;
  layerLabel: (id: CompositionLayerId) => string;
  layerLocked: (id: CompositionLayerId) => boolean;
  layerOrder: readonly CompositionLayerId[];
  layerVisible: (id: CompositionLayerId) => boolean;
  menu: LayerDockMenuState | null;
  onClose: () => void;
  onCopy: (id: CompositionLayerId) => void;
  onCopyStyle: (id: CompositionLayerId) => void;
  onCut: (id: CompositionLayerId) => void;
  onDelete: (id: CompositionLayerId) => void;
  onDuplicate: (id: CompositionLayerId) => void;
  onMove: (id: CompositionLayerId, direction: -1 | 1) => void;
  onMoveToEdge: (id: CompositionLayerId, edge: 'back' | 'front') => void;
  onPaste: () => void;
  onPasteStyle: (id: CompositionLayerId) => void;
  onToggleLock: (id: CompositionLayerId) => void;
  onToggleVisibility: (id: CompositionLayerId) => void;
}) {
  const layerId = menu && layerOrder.includes(menu.layerId) ? menu.layerId : null;
  const visible = layerId ? layerVisible(layerId) : false;
  const locked = layerId ? layerLocked(layerId) : false;
  const canvasLayer = isCanvasLayerId(layerId);
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
            { icon: <Copy aria-hidden='true' />, id: 'copy-layer', label: 'Copy layer', onSelect: () => onCopy(layerId), shortcut: '⌘C' },
            { disabled: locked, icon: <Scissors aria-hidden='true' />, id: 'cut-layer', label: 'Cut layer', onSelect: () => onCut(layerId), shortcut: '⌘X' },
            { icon: <Copy aria-hidden='true' />, id: 'paste-layer', label: 'Paste', onSelect: onPaste, shortcut: '⌘V' },
            { icon: <Files aria-hidden='true' />, id: 'duplicate-layer', label: 'Duplicate layer', onSelect: () => onDuplicate(layerId), shortcut: '⌘D' },
          ],
        },
        ...(canvasLayer ? [layerStyleMenuSection(layerId, canPasteStyle && !locked, onCopyStyle, onPasteStyle)] : []),
        {
          label: 'Visibility',
          items: [
            {
              checked: visible,
              icon: visible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />,
              id: 'toggle-layer',
              label: visible ? 'Layer visible' : 'Layer hidden',
              onSelect: () => onToggleVisibility(layerId),
            },
            ...(canvasLayer ? [layerLockMenuItem(layerId, locked, onToggleLock)] : []),
          ],
        },
        {
          label: 'Layer order',
          items: [
            { disabled: orderIndex === layerOrder.length - 1, icon: <ArrowUp aria-hidden='true' />, id: 'move-layer-forward', label: 'Bring forward', onSelect: () => onMove(layerId, 1), shortcut: '⌘]' },
            { disabled: orderIndex === layerOrder.length - 1, icon: <ArrowUp aria-hidden='true' />, id: 'move-layer-front', label: 'Bring to front', onSelect: () => onMoveToEdge(layerId, 'front'), shortcut: '⇧⌘]' },
            { disabled: orderIndex === 0, icon: <ArrowDown aria-hidden='true' />, id: 'move-layer-backward', label: 'Send backward', onSelect: () => onMove(layerId, -1), shortcut: '⌘[' },
            { disabled: orderIndex === 0, icon: <ArrowDown aria-hidden='true' />, id: 'move-layer-back', label: 'Send to back', onSelect: () => onMoveToEdge(layerId, 'back'), shortcut: '⇧⌘[' },
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
});

export default function ShaderLabStudio({
  active = true,
  automationToolId,
  identity: brandIdentity,
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
  const [projectTypography, setProjectTypography] = useState<DesignLabProjectIdentity | null>(null);
  const identity = useMemo(() => projectTypography?.id === brandIdentity.id
    ? { ...brandIdentity, fonts: projectTypography.fonts, typography: projectTypography.typography }
    : brandIdentity, [brandIdentity, projectTypography]);
  const projectTypographyRevision = useMemo(() => projectTypography
    ? canvasRevisionFromSignature(immutableJsonSignature(projectTypography)) : null, [projectTypography]);
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:design-lab`);
  const brandPalette = useMemo(() => brandMaterialPalette(identity), [identity]);
  const imageEffectPalette = useMemo(() => designLabImageEffectPalette(brandPalette.colors), [brandPalette.colors]);
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
  const captureCompositionFrameRef = useCommittedRef(captureCompositionFrame);
  const exportStillRef = useCommittedRef(exportStill);
  const exportMotionRef = useCommittedRef(exportMotion);
  const studioRootRef = useRef<HTMLDivElement>(null);
  const projectWorkspaceActiveRef = useAncestorWorkspaceActivity(stageRef);
  const defaultShaderMigrationRef = useRef('');
  const effectCanvasRefs = useRef<Map<EffectLayerId, HTMLCanvasElement>>(new Map());
  const effectScratchRefs = useRef<Map<EffectLayerId, CompositionEffectScratch>>(new Map());
  const effectPreviewBufferRef = useRef<HTMLCanvasElement | null>(null);
  const effectPreviewOverridesRef = useRef<Map<EffectLayerId, {
    opacity?: number;
    settings?: Partial<CompositionEffectSettings>;
  }>>(new Map());
  const shaderApplicationPreviewOverridesRef = useRef<Map<ShaderLayerId | ContentLayerId, ShaderApplication>>(new Map());
  const textLayerPreviewOverridesRef = useRef<Map<TextLayerId, CompositionTextLayer>>(new Map());
  const logoLayerPreviewOverridesRef = useRef<Map<LogoLayerId, CompositionLogoLayer>>(new Map());
  const assetLayerPreviewOverridesRef = useRef<Map<AssetLayerId, CompositionAsset>>(new Map());
  const canvasBackgroundPreviewOverrideRef = useRef<string | null>(null);
  const effectPreviewRedrawRef = useRef<(() => void) | null>(null);
  // Image-effect Effect layers: one WebGPU processor per layer for the live
  // preview, the last output per layer, and a status the stage and inspector show.
  const imageEffectPreviewPoolRef = useRef<ImageEffectProcessorPool | null>(null);
  const imageEffectPreviewOutputsRef = useRef(new Map<EffectLayerId, HTMLCanvasElement>());
  const imageEffectPreviewSourceRef = useRef<HTMLCanvasElement | null>(null);
  // Effect time for previews: advances while playing, holds while paused.
  const imageEffectPreviewClockRef = useRef({ lastFrameAt: 0, seconds: 0 });
  // Preview runs share canvases, so a restarted preview loop waits for the last run.
  const imageEffectPreviewQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const imageEffectStatusStore = useLocalValueStore<ReadonlyMap<string, DesignLabImageEffectStatus>>(new Map());
  useEffect(() => () => {
    imageEffectPreviewPoolRef.current?.dispose();
    imageEffectPreviewPoolRef.current = null;
  }, []);
  const textEffectScratchRefs = useRef<Map<TextLayerId, TextEffectRenderScratch>>(new Map());
  const logoInputRef = useRef<HTMLInputElement>(null);
  const materialLibraryRef = useRef<HTMLDivElement>(null);
  const materialLoadMoreRef = useRef<HTMLButtonElement>(null);
  const imageImportRequestIdRef = useRef(0);
  const selectMaterialRef = useCommittedRef(selectMaterial);
  const handleMaterialSelect = useCallback((materialId: LiveMaterialId) => {
    selectMaterialRef.current(materialId);
  }, [selectMaterialRef]);
  const convertedAssetLibrary = useConvertedAssets();
  const compositionAssetUrlsRef = useRef<string[]>([]);
  const previewFrameRef = useRef(0);
  const previewTimeRef = useRef(0);
  const frameCapturePendingRef = useRef(false);
  const sourceApplySequenceRef = useRef(0);
  const effectCaptureShaderImagesRef = useRef<ReadonlyMap<string, CapturedShaderImage> | null>(null);
  const exportJobRef = useRef(false);
  const exportFailureRef = useRef<unknown>(null);
  useEffect(() => () => { sourceApplySequenceRef.current += 1; }, []);
  useEffect(() => {
    void preloadShaderFramePresentation({ grainOpacity: 1 }).catch(() => {
      // Capture/export reports an explicit error if the presentation cannot load.
    });
  }, []);
  const sequenceCaptureRef = useRef<ShaderSequenceCapture | null>(null);
  const sequencePreviewingRef = useRef(false);
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
  const [previewTimeMs, setPreviewTimeMs] = useState(0);
  const [shaderTimelineRestore, setShaderTimelineRestore] = useState({
    revision: 0, timeMs: 0, pendingKeys: [] as string[],
  });
  const [frameCapturePending, setFrameCapturePending] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ShaderLabCategory>('all');
  const [materialSource, setMaterialSource] = useState<ShaderLabSource>('all');
  const [materialKind, setMaterialKind] = useState<ShaderLabKind>('all');
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
  // Text ranges change on every native selection change; only the text
  // inspector subscribes, so selecting characters never re-renders the editor.
  const textSelectionStore = useLocalValueStore<DesignLabTextSelection | null>(null);
  const textSelectionRef = useRef<DesignLabTextSelection | null>(null);
  function rememberTextSelection(layerId: TextLayerId, range: TextSelectionRange) {
    const next = range.end > range.start ? { ...range, layerId } : null;
    if (JSON.stringify(next) === JSON.stringify(textSelectionRef.current)) return;
    textSelectionRef.current = next;
    textSelectionStore.set(next);
  }
  function clearTextRange() {
    textSelectionRef.current = null;
    textSelectionStore.set(null);
  }
  const [cropEditingLayerId, setCropEditingLayerId] = useState<AssetLayerId | null>(null);
  const [artboardMenu, setArtboardMenu] = useState<DesignArtboardMenuState | null>(null);
  const [layerDockMenu, setLayerDockMenu] = useState<LayerDockMenuState | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  // Status messages are transient; only the artboard toolbar subscribes.
  const canvasStatusStore = useLocalValueStore<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [captureTimeMs, setCaptureTimeMs] = useState<number | null>(null);
  const [sequenceCapture, setSequenceCapture] = useState<ShaderSequenceCapture | null>(null);
  const [sequencePreviewing, setSequencePreviewing] = useState(false);
  const [exporting, setExporting] = useState<'gif' | 'jpg' | 'mp4' | 'png' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [imageDropActive, setImageDropActive] = useState(false);
  const [pendingLayerDrop, setPendingLayerDrop] = useState<{ targetId: DesignArtboardId; layerId: CanvasLayerId } | null>(null);
  const canvasInsertionPointRef = useRef<{ x: number; y: number } | null>(null);
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
  useEffect(() => {
    textSelectionRef.current = null;
    textSelectionStore.set(null);
  }, [activeArtboardId, storedSelectedLayerId, textSelectionStore]);
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
  }, emptyDesignCanvas()]);
  const [workspaceTourOpen, setWorkspaceTourOpen] = useStudioDraft(
    identity.id,
    tool.id,
    'design-lab-artboard-tour-v1',
    false
  );
  const [workspaceTourStep, setWorkspaceTourStep] = useState(0);
  const [motionWorkspaceOpen, setMotionWorkspaceOpen] = useState(false);
  const [artboardFocusRequest, setArtboardFocusRequest] = useState<{ id: DesignArtboardId; revision: number } | null>(null);
  const initialArtboardFocusedRef = useRef(false);
  const [workspaceFitRevision, setWorkspaceFitRevision] = useState(0);
  const pendingArtboardApplyRef = useRef<{ id: DesignArtboardId; signature: string } | null>(null);
  const artboardMoveCleanupRef = useRef<(() => void) | null>(null);
  const artboardActivationRef = useRef<{ id: DesignArtboardId; result: Promise<boolean> } | null>(null);
  const pendingArtboardLayerRef = useRef<{ artboardId: DesignArtboardId; layerId: CanvasLayerId } | null>(null);
  const designLabClipboardRef = useRef<string | null>(null);
  const styleClipboardRef = useRef<DesignLabLayerStyle | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pointerInEditorRef = useRef(false);
  const imagePlacementModeRef = useRef<ImageAssetPlacementMode>('image');
  const canvasClipboardStatusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // SVG data URLs may be percent-encoded, not base64. Both are already
    // embedded; reprocessing them creates an endless resolved-promise loop.
    const candidates = [
      ...logoLayers.map(({ id, url }) => ({ id, url })),
      ...compositionAssets.map(({ id, url }) => ({ id, url })),
    ].filter(({ url }) => !/^data:/i.test(url));
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
      const embed = <T extends { id: LogoLayerId | AssetLayerId; url: string }>(current: T[]): T[] => {
        let changed = false;
        const next = current.map((layer) => {
          const url = embeddedSources.get(layer.id);
          if (!url || url === layer.url) return layer;
          changed = true;
          return { ...layer, url };
        });
        return changed ? next : current;
      };
      setLogoLayers(embed);
      setCompositionAssets(embed);
    });
    return () => {
      cancelled = true;
    };
  }, [compositionAssets, logoLayers]);

  const canvasDimensions = useMemo(
    () => normalizeStudioArtboardDimensions(storedCanvasDimensions, studioDimensionsForRatio(ratio)),
    [ratio, storedCanvasDimensions]
  );
  const ratioOption = useMemo<DesignRatioOption>(() => RATIO_OPTIONS.find((option) => option.value === ratio) ?? {
    ...canvasDimensions,
    label: 'Custom',
    value: 'custom' as const,
  }, [canvasDimensions, ratio]);
  const normalizedExportSettings = useMemo(
    () => normalizeDesignExportSettings(exportSettings),
    [exportSettings]
  );
  const boundedPreviewFrame = resolveMotionFrame(
    normalizedExportSettings.durationMs,
    normalizedExportSettings.fps,
    previewFrame
  ).index;
  const previewCaptureTimeMs = previewTimeMs;
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
    timeline: { frame: boundedPreviewFrame, paused, timeMs: previewTimeMs },
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
    previewTimeMs,
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
  // The surface the editor has rendered. activeArtboardIdRef moves before the render.
  const shownSurfaceRef = useCommittedRef({ id: activeArtboardId, ready: activeArtboardSnapshotReady });
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
    () => designCanvasHistorySignature(workspaceArtboards, projectTypographyRevision),
    [projectTypographyRevision, workspaceArtboards]
  );
  const designHistorySignatureRef = useCommittedRef(designHistorySignature);
  const activeArtboard = resolveActiveDesignArtboard(workspaceArtboards, activeArtboardId);
  const editingCanvas = activeArtboardId === DESIGN_CANVAS_ID;
  // Artboards add rule-of-thirds lines to edge and center snapping; the open canvas has no frame to divide.
  const artboardThirdsSnapTargets = useMemo(
    () => editingCanvas ? undefined : canvasThirdsSnapTargets(canvasDimensions.width, canvasDimensions.height),
    [canvasDimensions.height, canvasDimensions.width, editingCanvas]
  );
  const outputArtboards = workspaceArtboards.filter(({ id }) => id !== DESIGN_CANVAS_ID);
  const activeArtboardRawName = activeArtboard?.name ?? '';
  const workspaceSize = useMemo(
    () => ({ width: 1, height: 1 }),
    []
  );
  const selectedCanvasLayerIds = useMemo(
    () => storedSelectedCanvasLayerIds.filter((id) => canvasLayerIdSet.has(id)),
    [canvasLayerIdSet, storedSelectedCanvasLayerIds]
  );
  const savedDesignRevision = useMemo(() => `${designExportSettingsSignature(ratio, normalizedExportSettings)}:${immutableJsonSignature({
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
    projectTypography: projectTypographyRevision,
  })}`, [activeArtboardId, canvasBackground, compositionAssets, effectLayers, layerGroups, layerOrder, layerShaders, logoLayers, normalizedExportSettings, normalizedShaderSequenceSettings, projectTypographyRevision, ratio, shaderLayers, textLayers, workspaceArtboards]);
  const savedDesignWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identity.id, tool.id),
    [identity.id, tool.id]
  );
  const savedDesignRevisionRef = useCommittedRef(savedDesignRevision);
  const compositionSignature = `${savedDesignRevision}:frame=${boundedPreviewFrame}:time=${previewTimeMs}:paused=${paused}`;
  const compositionSignatureRef = useCommittedRef(compositionSignature);
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
    identity: projectTypography?.id === identity.id ? projectTypography : undefined,
    layerOrder,
    layerShaders,
    logos: logoLayers,
    ratio,
    revision: canvasRevisionFromSignature(compositionSignature),
    shaderLayers,
    shaderSequence: normalizedShaderSequenceSettings,
    textLayers,
    timeline: { frame: boundedPreviewFrame, paused, timeMs: previewTimeMs },
    title: `${identity.name} ${tool.name}`,
    updatedAt: compositionDocumentCreatedAt,
    width: canvasDimensions.width,
    workspace: packDesignWorkspace(workspaceArtboards, activeArtboardId),
  }), [
    // This content signature covers all layers, artboards, typography, export
    // settings and timeline. Synchronizing an equivalent artboard snapshot must
    // not construct and serialize the same portable document a second time.
    compositionDocumentCreatedAt,
    compositionSignature,
    identity.id,
    identity.name,
    tool.id,
    tool.name,
  ]);
  const portableDesignLab = usePortableCanvasWorkspace({
    applySource: applyCompositionSource,
    document: designLabDocument,
    workspaceKey: savedDesignWorkspaceKey,
  });
  const compositionAutosaveState = portableDesignLab.autosaveState;
  const autosaveStateRef = useCommittedRef(compositionAutosaveState);
  useEffect(() => {
    if (compositionAutosaveState !== 'loading') setDraftHydrated(true);
  }, [compositionAutosaveState]);
  useEffect(() => {
    if (!active || compositionAutosaveState === 'loading' || initialArtboardFocusedRef.current) return;
    if (!artboards.some(({ id }) => id === activeArtboardId)) return;
    initialArtboardFocusedRef.current = true;
    setArtboardFocusRequest({ id: activeArtboardId, revision: 0 });
  }, [active, activeArtboardId, artboards, compositionAutosaveState]);
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
  const historyHandlers = useStableHandlers({
    redo: () => redoDesignCanvas(),
    undo: () => undoDesignCanvas(),
  });
  // designHistoryRef is replaced, never mutated, and every replacement bumps the revision.
  const canvasActionHistory = useMemo(() => presentCanvasActionHistory(
    designHistoryRef.current,
    designHistorySignature,
    historyHandlers.redo,
    historyHandlers.undo
  ), [designHistoryRevision, designHistorySignature, historyHandlers]);

  useEffect(() => {
    cancelAnimationFrame(sequencePreviewAnimationRef.current);
    sequencePreviewAnimationRef.current = 0;
    if (!active || !sequencePreviewing) return;
    sequencePreviewLastTimeRef.current = performance.now();
    sequencePreviewAnimationRef.current = requestAnimationFrame(sequencePreviewTickRef.current);
    return () => cancelAnimationFrame(sequencePreviewAnimationRef.current);
  }, [active, sequencePreviewing]);
  const materials = useMemo(() => shaderLabMaterials(query, category, materialSource, materialKind), [category, materialKind, materialSource, query]);
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
  useEffect(() => {
    if (!cropEditingLayerId) return;
    const cropTargetExists = compositionAssets.some(({ id }) => id === cropEditingLayerId);
    if (!cropTargetExists || selectedLayerId !== cropEditingLayerId || selectedCanvasLayerIds.length !== 1) {
      setCropEditingLayerId(null);
    }
  }, [compositionAssets, cropEditingLayerId, selectedCanvasLayerIds.length, selectedLayerId]);
  const stageLayerById = useMemo(() => new Map<CompositionLayerId, CompositionShaderLayer | CompositionEffectLayer | CompositionTextLayer | CompositionLogoLayer | CompositionAsset>([
    ...shaderLayers.map((layer) => [layer.id, layer] as const),
    ...effectLayers.map((layer) => [layer.id, layer] as const),
    ...textLayers.map((layer) => [layer.id, layer] as const),
    ...logoLayers.map((layer) => [layer.id, layer] as const),
    ...compositionAssets.map((layer) => [layer.id, layer] as const),
  ]), [compositionAssets, effectLayers, logoLayers, shaderLayers, textLayers]);
  const layerGroupByLayerId = useMemo(() => {
    const groups = new Map<CanvasLayerId, CompositionLayerGroup>();
    for (const group of layerGroups) {
      for (const layerId of group.layerIds) groups.set(layerId, group);
    }
    return groups;
  }, [layerGroups]);
  const {
    duplicateLayer,
    duplicateLayers,
    layerLabel,
    removeLayer,
    removeShadersFromContent,
    resolvedLayerKind,
    setLayersVisibility,
    toggleLayerVisibility,
  } = useDesignLabLayerActions({
    captureCompositionFrame,
    compositionAssets,
    effectLayers,
    logoLayers,
    removeAsset,
    removeEffectLayer,
    removeLogoLayer,
    removeTextLayer,
    setCompositionAssets,
    setEffectLayers,
    setExportError,
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
    arrangeCanvasSelection,
    deselectCanvasLayers,
    duplicateCanvasSelection,
    groupCanvasSelection,
    groupForLayer,
    movementBoundsFor,
    moveCanvasSelection,
    moveCanvasSelectionToEdge,
    openCanvasSelectionMenu,
    removeCanvasSelection,
    rotateCanvasLayers,
    selectAllCanvasLayers,
    selectCanvasAssembly,
    selectedCanvasBounds,
    selectedCanvasGroup,
    selectedCanvasLayerIdSet,
    selectedGroupedAssemblies,
    selectionUnits,
    selectLayerFromStack,
    ungroupCanvasSelection,
    updateCanvasLayerTransform,
    updateSelectionFrame,
  } = useDesignLabCanvasSelection({
    canvasDimensions,
    compositionAssets,
    duplicateLayers,
    layerGroups,
    layerGroupByLayerId,
    layerOrder,
    layerSelectable: (id) => layerVisible(id) && !layerLocked(id),
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
    const pending = pendingArtboardLayerRef.current;
    if (!pending || pending.artboardId !== activeArtboardId || !activeArtboardSnapshotReady) return;
    pendingArtboardLayerRef.current = null;
    if (layerOrder.includes(pending.layerId)) selectLayerFromStack(pending.layerId);
  }, [activeArtboardId, activeArtboardSnapshotReady, layerOrder, selectLayerFromStack]);
  useEffect(() => () => artboardMoveCleanupRef.current?.(), []);
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

  function seekShaderTime(timeMs: number) {
    assertShaderTimelineReady();
    if (sequencePreviewingRef.current) throw new Error('Stop the shader sequence preview before exploring a shader frame.');
    if (exportJobRef.current || frameCapturePendingRef.current) throw new Error('Wait for the current shader capture or export before seeking.');
    if (!Number.isFinite(timeMs) || timeMs < 0) throw new Error('Choose a nonnegative shader time.');
    if (!compositionCanSeek) throw new Error('Fluid is a stateful simulation. Capture a frame instead of seeking its history.');
    if (!paused) beginShaderTimeScrub();
    setShaderLayers((current) => current.map((layer) => ({ ...layer, frameSnapshot: undefined })));
    setLayerShaders((current) => Object.fromEntries(Object.entries(current).map(([id, application]) => [id,
      application ? { ...application, frameSnapshot: undefined } : application,
    ])) as Partial<Record<ContentLayerId, ShaderApplication>>);
    clearLiveMaterialTimePreview('design-lab');
    previewTimeRef.current = timeMs;
    setPreviewTimeMs(timeMs);
    setPaused(true);
  }

  function beginShaderTimeScrub() {
    pauseShaderHistory();
  }

  function pauseShaderHistory() {
    assertShaderTimelineReady();
    if (paused) return previewTimeMs;
    const timeMs = previewTimeRef.current;
    const operation = pauseShaderFrames(shaderCaptureRequests(timeMs), timeMs);
    try {
      flushSync(() => {
        setShaderLayers((current) => current.map((layer) => operation.states.has(`canvas-${layer.id}`)
          ? { ...layer, frameState: operation.states.get(`canvas-${layer.id}`), frameSnapshot: undefined } : layer));
        setLayerShaders((current) => Object.fromEntries(Object.entries(current).map(([id, application]) => [id,
          application && operation.states.has(`content-${id}`)
            ? { ...application, frameState: operation.states.get(`content-${id}`), frameSnapshot: undefined } : application,
        ])) as Partial<Record<ContentLayerId, ShaderApplication>>);
        previewTimeRef.current = timeMs;
        setPreviewTimeMs(timeMs);
        setPaused(true);
      });
    } finally {
      operation.release();
    }
    return timeMs;
  }

  function freezeCurrentShaderFrame() {
    if (exportJobRef.current || frameCapturePendingRef.current || sequencePreviewingRef.current) return;
    try {
      pauseShaderHistory();
      setExportError(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The shader could not be paused.');
    }
  }

  function playShaderHistory() {
    if (exportJobRef.current || frameCapturePendingRef.current || sequencePreviewingRef.current || shaderTimelineRestoring) return;
    clearLiveMaterialTimePreview('design-lab');
    setPaused(false);
  }

  function clearTransientCompositionPreviews() {
    effectPreviewOverridesRef.current.clear();
    shaderApplicationPreviewOverridesRef.current.clear();
    textLayerPreviewOverridesRef.current.clear();
    logoLayerPreviewOverridesRef.current.clear();
    assetLayerPreviewOverridesRef.current.clear();
    canvasBackgroundPreviewOverrideRef.current = null;
  }

  function applyArtboardSnapshot(snapshot: DesignArtboardSnapshot) {
    clearTransientCompositionPreviews();
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
    const nextTimeMs = next.timeline.timeMs ?? nextFrame * 1_000 / normalizedExportSettings.fps;
    beginShaderTimelineRestore(nextTimeMs, next.shaderLayers, next.layerShaders);
    previewTimeRef.current = nextTimeMs;
    setPreviewTimeMs(nextTimeMs);
    setPaused(next.timeline.paused);
    setSelectedLayerId(null);
    setSelectedCanvasLayerIds([]);
    setSelectionMenuPosition(null);
  }

  function createDesignHistoryEntry(
    nextArtboards: readonly DesignArtboard[],
    label: string,
    signature?: string,
    nextTypography = projectTypography
  ): DesignCanvasHistoryEntry {
    const clonedArtboards = cloneDesignArtboards(nextArtboards);
    designHistorySequenceRef.current += 1;
    return {
      artboards: clonedArtboards,
      // Imported typography is immutable. Retain its font bytes by reference
      // instead of copying large embedded fonts for every canvas action.
      projectTypography: nextTypography,
      detail: `${clonedArtboards.length} artboard${clonedArtboards.length === 1 ? '' : 's'}`,
      id: `canvas-action-${designHistorySequenceRef.current}`,
      label,
      signature: signature ?? designCanvasHistorySignature(clonedArtboards, nextTypography
        ? canvasRevisionFromSignature(immutableJsonSignature(nextTypography)) : null),
    };
  }

  function checkpointDesignCanvasHistory(
    nextArtboards = workspaceArtboardsRef.current,
    signature = designHistorySignatureRef.current,
    label?: string,
    nextTypography = projectTypography
  ) {
    window.clearTimeout(designHistoryTimerRef.current);
    designHistoryTimerRef.current = 0;
    const history = designHistoryRef.current;
    // Pointer/key selection events are common. Use the already computed revision
    // before cloning any artboard or serializing its captured shader assets.
    if (history.present?.signature === signature) return;
    const next = createDesignHistoryEntry(nextArtboards, label ?? (history.present
      ? describeDesignCanvasChange(history.present.artboards, nextArtboards)
      : 'Opened canvas'), signature, nextTypography);
    designHistoryRef.current = checkpointCanvasHistory(history, next);
    // Only the undo controls and history list read the revision.
    startTransition(() => setDesignHistoryRevision((revision) => revision + 1));
  }

  function checkpointAppliedDesignSource(nextArtboards: DesignArtboard[], nextTypography: DesignLabProjectIdentity | null) {
    // A source replacement is one complete action. Preserve an earlier pending
    // edit, then close the normalized source action before the next gesture.
    if (draftHydrated) checkpointDesignCanvasHistory();
    const typographyRevision = nextTypography ? canvasRevisionFromSignature(immutableJsonSignature(nextTypography)) : null;
    const signature = designCanvasHistorySignature(nextArtboards, typographyRevision);
    checkpointDesignCanvasHistory(nextArtboards, signature, draftHydrated ? 'Applied source' : 'Opened canvas', nextTypography);
    return signature;
  }

  function beginCanvasHistoryPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !draftHydrated || !activeArtboardSnapshotReady) return;
    if (event.target instanceof Element
      && event.target.closest('.canvas-action-history, .canvas-viewport-toolbar')) return;
    checkpointDesignCanvasHistory();
  }

  function beginCanvasHistoryKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.repeat || !draftHydrated || !activeArtboardSnapshotReady || isCanvasTextEditingTarget(event.target)) return;
    if ((event.metaKey || event.ctrlKey) && ['z', 'y'].includes(event.key.toLowerCase())) return;
    if (event.target instanceof Element
      && event.target.closest('.canvas-action-history, .canvas-viewport-toolbar')) return;
    checkpointDesignCanvasHistory();
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
    designHistorySignatureRef.current = entry.signature;
    activeArtboardIdRef.current = activeId;
    currentArtboardSnapshotRef.current = activeEntry.snapshot;
    setProjectTypography(entry.projectTypography);
    setArtboards(nextArtboards);
    setActiveArtboardId(activeId);
    applyArtboardSnapshot(activeEntry.snapshot);
  }

  function undoDesignCanvas() {
    const history = designHistoryRef.current;
    if (!history.present) return;
    window.clearTimeout(designHistoryTimerRef.current);
    designHistoryTimerRef.current = 0;
    const liveSignature = designHistorySignatureRef.current;
    const liveEntry = history.present.signature === liveSignature ? history.present : createDesignHistoryEntry(
      workspaceArtboardsRef.current,
      describeDesignCanvasChange(history.present.artboards, workspaceArtboardsRef.current),
      liveSignature
    );
    const transition = undoCanvasCheckpointHistory(history, liveEntry);
    if (!transition) return;
    designHistoryRef.current = transition.history;
    restoreDesignHistoryEntry(transition.restored);
    setDesignHistoryRevision((revision) => revision + 1);
    announceCanvasClipboard(`Undid ${transition.undone.label.toLocaleLowerCase()}`);
  }

  function redoDesignCanvas() {
    const history = designHistoryRef.current;
    const transition = redoCanvasCheckpointHistory(history, designHistorySignatureRef.current);
    if (!transition) return;
    window.clearTimeout(designHistoryTimerRef.current);
    designHistoryTimerRef.current = 0;
    designHistoryRef.current = transition.history;
    restoreDesignHistoryEntry(transition.restored);
    setDesignHistoryRevision((revision) => revision + 1);
    announceCanvasClipboard(`Redid ${transition.restored.label.toLocaleLowerCase()}`);
  }

  const artboardOperationRef = useRef(false);
  const activateArtboardRef = useCommittedRef(activateArtboard);

  function requestArtboardFocus(id: DesignArtboardId) {
    setArtboardFocusRequest((current) => ({ id, revision: (current?.revision ?? 0) + 1 }));
  }

  function canvasInsertionTransform() {
    if (!editingCanvas) return { x: 0, y: 0 };
    if (canvasInsertionPointRef.current) return canvasInsertionPointRef.current;
    const viewport = stageRef.current?.closest('.canvas-viewport-scroll')?.getBoundingClientRect();
    const stage = stageRef.current?.getBoundingClientRect();
    if (!viewport || !stage || !stage.width) return { x: 0, y: 0 };
    return {
      x: (viewport.left + viewport.width / 2 - stage.left) / stage.width * canvasDimensions.width - canvasDimensions.width / 2,
      y: (viewport.top + viewport.height / 2 - stage.top) / stage.height * canvasDimensions.height - canvasDimensions.height / 2,
    };
  }

  function activateCanvasAtPoint(point: { x: number; y: number }) {
    const workspace = studioRootRef.current?.querySelector('.design-artboard-workspace');
    const rect = workspace?.getBoundingClientRect();
    if (workspace instanceof HTMLElement && rect) {
      const scale = rect.width / workspace.offsetWidth;
      const unitScale = designSurfaceSize(DESIGN_CANVAS_DIMENSIONS).width / DESIGN_CANVAS_DIMENSIONS.width;
      canvasInsertionPointRef.current = {
        x: (point.x - rect.left) / scale / unitScale - DESIGN_CANVAS_DIMENSIONS.width / 2,
        y: (point.y - rect.top) / scale / unitScale - DESIGN_CANVAS_DIMENSIONS.height / 2,
      };
    }
    deselectCanvasLayers();
    return activateArtboard(DESIGN_CANVAS_ID);
  }

  async function moveLayersToSurface(targetId: DesignArtboardId, ids = selectedCanvasLayerIds, placeBeside = false, newArtboard?: DesignArtboard) {
    if (!ids.length || targetId === activeArtboardIdRef.current || artboardOperationRef.current) return false;
    artboardOperationRef.current = true;
    try {
      const captured = await captureArtboardBeforeLeaving();
      const surfaces = newArtboard ? [...workspaceArtboardsRef.current, newArtboard] : workspaceArtboardsRef.current;
      const from = surfaces.find(({ id }) => id === captured.artboardId)!;
      const to = surfaces.find(({ id }) => id === targetId);
      if (!to) throw new Error('That destination is no longer available.');
      const moving = new Set(ids);
      const snapshot = captured.snapshot;
      const anchored = reanchorDesignLabClipboardSnapshot(snapshot,
        to.snapshot.timeline.timeMs ?? to.snapshot.timeline.frame * 1000 / normalizedExportSettings.fps) as unknown as DesignArtboardSnapshot;
      const offset = placeBeside && targetId === DESIGN_CANVAS_ID
        ? { x: designArtboardDisplaySize(snapshot.dimensions, from.displayScale).width + 64, y: 0 } : { x: 0, y: 0 };
      const occupied = new Set(to.snapshot.layerOrder);
      const idMap = new Map(ids.map((id) => [id, occupied.has(id)
        ? `${id.split('-')[0]}-${globalThis.crypto.randomUUID()}` as CanvasLayerId : id]));
      const transfer = <T extends { id: CanvasLayerId; transform: CanvasLayerTransform }>(layers: T[]): T[] => layers
        .filter(({ id }) => moving.has(id))
        .map((layer) => ({ ...reparentDesignLayer(layer, from, to, offset), id: idMap.get(layer.id)! as T['id'] }));
      const kept = <T extends { id: string }>(layers: T[]) => layers.filter(({ id }) => !moving.has(id as CanvasLayerId));
      const source: DesignArtboardSnapshot = {
        ...snapshot, assets: kept(snapshot.assets), logos: kept(snapshot.logos),
        shaderLayers: kept(snapshot.shaderLayers), textLayers: kept(snapshot.textLayers),
        layerOrder: kept(snapshot.layerOrder.map((id) => ({ id }))).map(({ id }) => id),
        layerShaders: Object.fromEntries(Object.entries(snapshot.layerShaders).filter(([id]) => !moving.has(id as CanvasLayerId))),
        groups: snapshot.groups.map((group) => ({ ...group, layerIds: group.layerIds.filter((id) => !moving.has(id)) })).filter(({ layerIds }) => layerIds.length > 1),
        shaderSequence: { ...snapshot.shaderSequence,
          targetLayerId: snapshot.shaderSequence.targetLayerId && moving.has(snapshot.shaderSequence.targetLayerId)
            ? null : snapshot.shaderSequence.targetLayerId },
      };
      const destination: DesignArtboardSnapshot = {
        ...to.snapshot,
        assets: [...to.snapshot.assets, ...transfer(snapshot.assets)],
        logos: [...to.snapshot.logos, ...transfer(snapshot.logos)],
        shaderLayers: [...to.snapshot.shaderLayers, ...transfer(anchored.shaderLayers)],
        textLayers: [...to.snapshot.textLayers, ...transfer(snapshot.textLayers)],
        layerOrder: [...to.snapshot.layerOrder, ...snapshot.layerOrder.filter((id) => moving.has(id as CanvasLayerId)).map((id) => idMap.get(id as CanvasLayerId)!)],
        layerShaders: { ...to.snapshot.layerShaders, ...Object.fromEntries(Object.entries(anchored.layerShaders)
          .filter(([id]) => moving.has(id as CanvasLayerId)).map(([id, value]) => [idMap.get(id as CanvasLayerId), value])) },
        groups: [...to.snapshot.groups, ...snapshot.groups.filter((group) => group.layerIds.every((id) => moving.has(id)))
          .map((group) => ({ ...group, id: `group-${globalThis.crypto.randomUUID()}` as CompositionLayerGroupId, layerIds: group.layerIds.map((id) => idMap.get(id)!) }))],
      };
      // Ownership changes can remove or introduce the sequence's target. Use
      // the editor's resolver before taking the hydration checkpoint, otherwise
      // the normalized live state never matches and remains an inert preview.
      for (const surface of [source, destination]) {
        surface.shaderSequence = resolveShaderSequencePresentation(
          surface.shaderLayers, surface.shaderSequence, normalizeShaderSequenceSettings(surface.shaderSequence)
        ).settings;
      }
      // Converter caches belong to an exact stack, not to the destination surface.
      source.effectLayers = source.effectLayers.map((layer) => ({ ...layer, frameSnapshot: undefined }));
      destination.effectLayers = destination.effectLayers.map((layer) => ({ ...layer, frameSnapshot: undefined }));
      const next = surfaces.map((surface) => surface.id === from.id ? { ...surface, snapshot: source }
        : surface.id === to.id ? { ...surface, snapshot: destination } : surface);
      applyActiveArtboard({ ...to, snapshot: destination }, next, false);
      // A move between surfaces is one action, so it records itself. The next drag can start
      // while the destination still loads, when its pointer-down checkpoint is skipped.
      checkpointDesignCanvasHistory(next, designCanvasHistorySignature(next, projectTypographyRevision));
      const nextIds = [...idMap.values()];
      setSelectedCanvasLayerIds(nextIds);
      setSelectedLayerId(nextIds.at(-1) ?? null);
      announceCanvasClipboard(`Moved ${ids.length} layer${ids.length === 1 ? '' : 's'} to ${to.name}`);
      setExportError(null);
      return true;
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The layers could not be moved.');
      return false;
    } finally {
      artboardOperationRef.current = false;
    }
  }

  function finishLayerMove(layerId: CanvasLayerId, point: { x: number; y: number }) {
    const target = [...outputArtboards].reverse().find((surface) => {
      const rect = studioRootRef.current?.querySelector(`[data-artboard-id="${CSS.escape(surface.id)}"]`)?.getBoundingClientRect();
      return rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
    });
    const targetId = target?.id ?? DESIGN_CANVAS_ID;
    if (targetId !== activeArtboardId) setPendingLayerDrop({ targetId, layerId });
  }

  async function frameCanvasSelection() {
    if (!editingCanvas || !selectedCanvasBounds || !selectedCanvasLayerIds.length) return false;
    const padding = 48;
    const dimensions = normalizeStudioArtboardDimensions({
      width: Math.ceil(selectedCanvasBounds.width + padding * 2),
      height: Math.ceil(selectedCanvasBounds.height + padding * 2),
    });
    if (dimensions.width < selectedCanvasBounds.width + padding * 2 || dimensions.height < selectedCanvasBounds.height + padding * 2) {
      setExportError('This selection exceeds the maximum artboard size. Frame a smaller group of layers.');
      return false;
    }
    const surface: DesignArtboard = {
      ...emptyDesignCanvas(), id: `artboard-${globalThis.crypto.randomUUID()}`,
      name: `Artboard ${outputArtboards.length + 1}`, displayScale: .45,
      x: (selectedCanvasBounds.left - padding) * .45,
      y: (selectedCanvasBounds.top - padding) * .45,
      snapshot: { ...emptyDesignCanvas().snapshot, dimensions, ratio: 'custom', backgroundColor: DEFAULT_CANVAS_BACKGROUND },
    };
    return moveLayersToSurface(surface.id, selectedCanvasLayerIds, false, surface);
  }

  useEffect(() => {
    if (!pendingLayerDrop) return;
    // Commit the direct-manipulation preview before capturing the source stack.
    const frame = requestAnimationFrame(() => {
      setPendingLayerDrop(null);
      const ids = selectedCanvasLayerIds.includes(pendingLayerDrop.layerId) ? selectedCanvasLayerIds : [pendingLayerDrop.layerId];
      void moveLayersToSurface(pendingLayerDrop.targetId, ids);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingLayerDrop]);

  async function captureArtboardBeforeLeaving() {
    const artboardId = activeArtboardIdRef.current;
    const captured = await parseCompositionSource(serializeExistingDesignLabCanvasDocument(await captureCompositionFrame()));
    const snapshot = captured.workspace?.artboards?.find((artboard) => artboard.id === artboardId)?.snapshot;
    if (!snapshot || activeArtboardIdRef.current !== artboardId) {
      throw new Error('The active artboard changed before its shader frames could be preserved.');
    }
    return { artboardId, snapshot: cloneArtboardSnapshot(snapshot) };
  }

  function applyActiveArtboard(artboard: DesignArtboard, nextArtboards: DesignArtboard[], focus: boolean) {
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
    const snapshot = cloneArtboardSnapshot(artboard.snapshot);
    pendingArtboardApplyRef.current = { id: artboard.id, signature: artboardSnapshotSignature(snapshot) };
    activeArtboardIdRef.current = artboard.id;
    currentArtboardSnapshotRef.current = snapshot;
    setActiveArtboardId(artboard.id);
    applyArtboardSnapshot(snapshot);
    if (focus) requestArtboardFocus(artboard.id);
  }

  /**
   * Browser API surface changes retry while the editor is busy or a shader is still
   * loading (both at startup), then resolve only once the editor shows the surface, so
   * the next action (an export or a describe) never acts on the previous one.
   */
  async function activateSurfaceForApi(id: DesignArtboardId, focus: boolean): Promise<boolean> {
    const deadline = performance.now() + 10_000;
    while (!await activateArtboard(id, focus)) {
      if (performance.now() > deadline) return false;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
    }
    return surfaceShown(id);
  }

  async function surfaceShown(id: DesignArtboardId): Promise<boolean> {
    const deadline = performance.now() + 5_000;
    while (shownSurfaceRef.current.id !== id || !shownSurfaceRef.current.ready) {
      if (performance.now() > deadline) return false;
      // Timers, not animation frames: a background tab must not stall an agent.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 16));
    }
    return true;
  }

  /**
   * The autosave restore replaces the whole workspace when it finishes, so Browser API
   * calls made while it loads (right after a reload) wait for it instead of being undone.
   */
  async function autosaveLoaded(): Promise<void> {
    const deadline = performance.now() + 10_000;
    while (autosaveStateRef.current === 'loading') {
      if (performance.now() > deadline) throw new Error('This project is still loading its autosave. Wait a moment and try again.');
      await new Promise<void>((resolve) => window.setTimeout(resolve, 25));
    }
  }

  async function activateArtboard(id: DesignArtboardId, focus = false): Promise<boolean> {
    if (id === activeArtboardIdRef.current) {
      if (focus) requestArtboardFocus(id);
      return true;
    }
    const pendingActivation = artboardActivationRef.current;
    if (pendingActivation) {
      const activated = await pendingActivation.result;
      if (pendingActivation.id === id) {
        if (activated && focus) requestArtboardFocus(id);
        return activated;
      }
      return activateArtboardRef.current(id, focus);
    }
    if (artboardOperationRef.current || frameCapturePendingRef.current
      || !workspaceArtboardsRef.current.some((artboard) => artboard.id === id)) return false;
    artboardOperationRef.current = true;
    const result = (async () => {
      try {
        const captured = await captureArtboardBeforeLeaving();
        const committedArtboards = workspaceArtboardsRef.current.map((artboard) => artboard.id === captured.artboardId
          ? { ...artboard, snapshot: captured.snapshot } : artboard);
        const nextArtboard = committedArtboards.find((artboard) => artboard.id === id);
        if (!nextArtboard) throw new Error('The selected artboard is no longer available.');
        applyActiveArtboard(nextArtboard, committedArtboards, focus);
        setExportError(null);
        return true;
      } catch (error) {
        setExportError(error instanceof Error ? error.message : 'The artboard shader frames could not be preserved.');
        return false;
      } finally {
        artboardOperationRef.current = false;
        artboardActivationRef.current = null;
      }
    })();
    artboardActivationRef.current = { id, result };
    return result;
  }

  function nextArtboardPosition(nextDimensions: StudioArtboardDimensions) {
    const count = workspaceArtboardsRef.current.filter(({ id }) => id !== DESIGN_CANVAS_ID).length;
    const column = count % 3;
    const row = Math.floor(count / 3);
    const size = designArtboardDisplaySize(nextDimensions);
    return {
      x: 280 + column * Math.max(816, size.width + 96),
      y: 240 + row * 620,
    };
  }

  async function addArtboard(duplicate = false) {
    if (artboardOperationRef.current || frameCapturePendingRef.current) return;
    artboardOperationRef.current = true;
    try {
      const captured = await captureArtboardBeforeLeaving();
      const currentArtboards = workspaceArtboardsRef.current;
      const sourceArtboard = currentArtboards.find((artboard) => artboard.id === captured.artboardId);
      const id = `artboard-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as DesignArtboardId;
      const snapshot = duplicate ? cloneArtboardSnapshot(captured.snapshot) : {
        assets: [],
        backgroundColor: captured.snapshot.backgroundColor,
        dimensions: { ...captured.snapshot.dimensions },
        effectLayers: [],
        groups: [],
        layerOrder: [],
        layerShaders: {},
        logos: [],
        ratio: captured.snapshot.ratio,
        shaderLayers: [],
        shaderSequence: { ...DEFAULT_DESIGN_SHADER_SEQUENCE_SETTINGS, targetLayerId: null },
        textLayers: [],
        timeline: { frame: 0, paused: false, timeMs: 0 },
      } satisfies DesignArtboardSnapshot;
      const nextArtboard: DesignArtboard = {
        id,
        displayScale: duplicate ? sourceArtboard?.displayScale : undefined,
        name: duplicate ? `${sourceArtboard?.name ?? 'Artboard'} copy` : `Artboard ${currentArtboards.filter(({ id }) => id !== DESIGN_CANVAS_ID).length + 1}`,
        snapshot,
        ...nextArtboardPosition(snapshot.dimensions),
      };
      const nextArtboards = [
        ...currentArtboards.map((artboard) => artboard.id === captured.artboardId
          ? { ...artboard, snapshot: captured.snapshot } : artboard),
        nextArtboard,
      ];
      applyActiveArtboard(nextArtboard, nextArtboards, true);
      setExportError(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The artboard could not be created with its captured shader frames.');
    } finally {
      artboardOperationRef.current = false;
    }
  }

  function removeActiveArtboard() {
    if (activeArtboardIdRef.current === DESIGN_CANVAS_ID) return;
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
    if (activeArtboardIdRef.current === DESIGN_CANVAS_ID) return;
    const nextName = name.trimStart().slice(0, 48);
    const nextArtboards = workspaceArtboardsRef.current.map((artboard) => (
      artboard.id === activeArtboardIdRef.current ? { ...artboard, name: nextName } : artboard
    ));
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
  }

  function updateActiveArtboardDimensions(dimensions: StudioArtboardDimensions) {
    if (activeArtboardIdRef.current === DESIGN_CANVAS_ID) return;
    const next = normalizeStudioArtboardDimensions(dimensions, canvasDimensions);
    const preset = studioArtboardPresetForSize(next.width, next.height);
    setCanvasDimensions(next);
    setRatio(preset?.id ?? 'custom');
  }

  function arrangeArtboards() {
    const layout = arrangeCanvasFrames(workspaceArtboardsRef.current.filter(({ id }) => id !== DESIGN_CANVAS_ID).map((artboard) => ({
      artboard,
      ...designArtboardDisplaySize(artboard.snapshot.dimensions, artboard.displayScale),
    })));
    const nextArtboards = [...layout.map(({ artboard, x, y }) => ({ ...artboard, x, y })),
      ...workspaceArtboardsRef.current.filter(({ id }) => id === DESIGN_CANVAS_ID)];
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
    setWorkspaceFitRevision((revision) => revision + 1);
  }

  function selectArtboardFromPicker(id: DesignArtboardId) {
    deselectCanvasLayers();
    activateArtboard(id, true);
  }

  function translateArtboard(id: DesignArtboardId, deltaX: number, deltaY: number, minY = -Infinity) {
    const nextArtboards = workspaceArtboardsRef.current.map((artboard) => artboard.id === id
      ? translateCanvasFrame(artboard, { deltaX, deltaY, minX: -Infinity, minY })
      : artboard);
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
    return nextArtboards.find((artboard) => artboard.id === id) ?? null;
  }

  async function nudgeArtboard(event: ReactKeyboardEvent<HTMLButtonElement>, artboard: DesignArtboard) {
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      event.preventDefault();
      event.stopPropagation();
      const position = contextMenuPositionFromElement(event.currentTarget);
      if (await activateArtboard(artboard.id)) setArtboardMenu({ artboardId: artboard.id, position });
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
    if (frameCapturePendingRef.current) return;
    deselectCanvasLayers();
    const step = event.shiftKey ? 64 : 16;
    if (!await activateArtboard(artboard.id)) return;
    const moved = translateArtboard(artboard.id, direction.x * step, direction.y * step);
    if (moved) announceCanvasClipboard(`Moved ${moved.name} to ${moved.x}, ${moved.y}`);
  }

  function beginArtboardMove(event: ReactPointerEvent<HTMLElement>, artboard: DesignArtboard) {
    if (event.button !== 0 || event.isPrimary === false || frameCapturePendingRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    artboardMoveCleanupRef.current?.();
    // A board gesture owns selection, but must commit the last typed character
    // before the current inspector/editor is removed or its snapshot captured.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    deselectCanvasLayers();
    const shell = event.currentTarget.closest<HTMLElement>('.design-artboard-shell');
    if (!shell) return;
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startY = event.clientY;
    let deltaX = 0;
    let deltaY = 0;
    const dragHandle = shell;
    const artboardScale = shell.getBoundingClientRect().width / designArtboardDisplaySize(artboard.snapshot.dimensions, artboard.displayScale).width;
    let moved = false;
    let frame = 0;
    dragHandle.setPointerCapture(pointerId);
    shell.dataset.selecting = 'true';
    function updatePosition(clientX: number, clientY: number) {
      if (!moved && Math.hypot(clientX - startX, clientY - startY) < 3) return;
      moved = true;
      deltaX = (clientX - startX) / Math.max(0.01, artboardScale);
      deltaY = (clientY - startY) / Math.max(0.01, artboardScale);
      shell!.dataset.moving = 'true';
    }
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      updatePosition(moveEvent.clientX, moveEvent.clientY);
      if (frame || !moved) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        shell.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
      });
    };
    const cleanup = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', cancelPointer);
      window.removeEventListener('blur', cancel);
      dragHandle.removeEventListener('lostpointercapture', cancelPointer);
      shell.style.transform = '';
      delete shell.dataset.moving;
      if (dragHandle.hasPointerCapture(pointerId)) dragHandle.releasePointerCapture(pointerId);
      artboardMoveCleanupRef.current = null;
    };
    const cancel = () => {
      cleanup();
      delete shell.dataset.selecting;
    };
    const cancelPointer = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId === pointerId) cancel();
    };
    const finish = (finishEvent: PointerEvent) => {
      if (finishEvent.pointerId !== pointerId) return;
      updatePosition(finishEvent.clientX, finishEvent.clientY);
      cleanup();
      // Commit geometry before capturing. The latest committed callback then
      // captures the same source revision, rather than invalidating its own drag.
      if (moved) flushSync(() => {
        const moved = translateArtboard(artboard.id, deltaX, deltaY);
        if (moved && (Math.abs(deltaX) >= 0.5 || Math.abs(deltaY) >= 0.5)) {
          announceCanvasClipboard(`Moved ${moved.name} to ${moved.x}, ${moved.y} · autosaving`);
        }
      });
      void activateArtboardRef.current(artboard.id).finally(() => { delete shell.dataset.selecting; });
    };
    artboardMoveCleanupRef.current = cancel;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', cancelPointer);
    window.addEventListener('blur', cancel);
    dragHandle.addEventListener('lostpointercapture', cancelPointer);
  }

  useEffect(() => {
    if (!draftHydrated) return;
    const pending = pendingArtboardApplyRef.current;
    if (pending) {
      if (pending.id !== activeArtboardId || pending.signature !== currentArtboardSignature) return;
      pendingArtboardApplyRef.current = null;
    }
    const syncActiveArtboard = () => setArtboards((current) => {
      const target = current.find((artboard) => artboard.id === activeArtboardId);
      if (!target) return current;
      if (artboardSnapshotPersistenceSignature(target.snapshot) === currentArtboardPersistenceSignature) return current;
      const nextArtboards = current.map((artboard) => artboard.id === activeArtboardId
        ? { ...artboard, snapshot: cloneArtboardSnapshot(currentArtboardSnapshot) }
        : artboard);
      workspaceArtboardsRef.current = nextArtboards;
      return nextArtboards;
    });
    // The active artboard already renders from live state. After an ordinary
    // edit this copy changes nothing on screen, so it waits behind input.
    if (pending) syncActiveArtboard();
    else startTransition(syncActiveArtboard);
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
      checkpointDesignCanvasHistory(workspaceArtboards, designHistorySignature, 'Opened canvas');
      return;
    }
    if (history.present.signature === designHistorySignature) return;
    window.clearTimeout(designHistoryTimerRef.current);
    designHistoryTimerRef.current = window.setTimeout(() => {
      checkpointDesignCanvasHistory();
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
        && !layer.frameSnapshot && !layer.frameState
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
    const needsWeightNormalization = textLayers.some((layer) => layer.weight !== textLayerFont(identity, layer).weight);
    if (!needsWeightNormalization) return;
    setTextLayers((current) => current.map((layer) => ({ ...layer, weight: textLayerFont(identity, layer).weight })));
  }, [identity, setTextLayers, textLayers]);

  /** The primary layer's shader, then every other selected shader layer and content layer. */
  function shaderEditTargets(): CanvasLayerId[] {
    const primary = selectedShaderLayer?.id ?? selectedContentLayerId;
    if (!primary) return [];
    return selectedCanvasLayerIds.includes(primary) ? [primary, ...selectedCanvasLayerIds.filter((id) => id !== primary)] : [primary];
  }

  /** Edits each target's material. Only the primary content layer gains one; peers without a material keep none. */
  function editSelectedShaders(editFor: (application: ShaderApplication) => ShaderEdit) {
    const targets = shaderEditTargets();
    const primary = targets[0];
    if (!primary) return;
    function apply<Application extends ShaderApplication>(application: Application): Application {
      const edit = editFor(application);
      const recipeChanged = edit.materialId !== undefined || edit.settings !== undefined || edit.shaderSize !== undefined;
      return {
        ...application,
        ...edit,
        settings: edit.settings ? { ...application.settings, ...edit.settings } : application.settings,
        shaderSize: edit.shaderSize === undefined ? application.shaderSize : clampShaderZoom(edit.shaderSize),
        ...(recipeChanged ? { frameSnapshot: undefined } : {}),
        ...(edit.materialId === undefined ? {} : { frameState: undefined }),
      };
    }
    targets.forEach((id) => shaderApplicationPreviewOverridesRef.current.delete(id));
    const shaderIds = new Set<CanvasLayerId>(targets.filter(isShaderLayerId));
    if (shaderIds.size) setShaderLayers((current) => current.map((layer) => shaderIds.has(layer.id) ? apply(layer) : layer));
    const contentIds = targets.filter(isContentLayerId);
    if (contentIds.length) setLayerShaders((current) => {
      const next = { ...current };
      contentIds.forEach((id) => {
        const application = current[id] ?? (id === primary ? shaderApplicationFor(activeMaterialId, brandPalette.colors) : undefined);
        if (application) next[id] = apply(application);
      });
      return next;
    });
  }

  /** `settings` is a partial patch: each target keeps the settings the edit does not name. */
  function updateSelectedShader(update: ShaderEdit) {
    editSelectedShaders(() => update);
  }

  function resetSelectedShader() {
    editSelectedShaders((application) => ({ settings: shaderLabSettingsFor(application.materialId, initialSettings), shaderSize: 1 }));
  }

  function updateCanvasBackground(color: string) {
    canvasBackgroundPreviewOverrideRef.current = null;
    setCanvasBackground(color);
  }

  function previewCanvasBackground(color: string) {
    if (frameCapturePendingRef.current) return;
    canvasBackgroundPreviewOverrideRef.current = color;
    if (stageRef.current) stageRef.current.style.backgroundColor = color;
    effectPreviewRedrawRef.current?.();
  }

  function previewSelectedShaderUpdate(update: Partial<ShaderApplication>) {
    if (frameCapturePendingRef.current || !editingShader) return;
    const id = selectedShaderLayer?.id ?? selectedContentLayerId;
    if (!id) return;
    const current = shaderApplicationPreviewOverridesRef.current.get(id) ?? editingShader;
    shaderApplicationPreviewOverridesRef.current.set(id, {
      ...current,
      ...update,
      settings: update.settings ? { ...current.settings, ...update.settings } : current.settings,
      shaderSize: update.shaderSize === undefined ? current.shaderSize : clampShaderZoom(update.shaderSize),
    });
    effectPreviewRedrawRef.current?.();
  }

  function previewSelectedShaderSetting<Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) {
    if (!selectedShaderPreviewChannel) return;
    previewLiveMaterialSettings(selectedShaderPreviewChannel, { [key]: value });
    previewSelectedShaderUpdate({ settings: { ...settings, [key]: value } });
  }

  function previewSelectedShaderSize(value: number) {
    if (!selectedShaderPreviewChannel) return;
    previewLiveMaterialPatternScale(selectedShaderPreviewChannel, value);
    previewSelectedShaderUpdate({ shaderSize: value });
  }

  function previewSelectedShaderOpacity(value: number) {
    if (!selectedShaderPreviewChannel) return;
    previewSelectedShaderUpdate({ opacity: value });
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
    if (!selectedTextLayer || !selectedTextAppearance) return;
    const nextAppearance: TextAppearanceSettings = {
      ...selectedTextAppearance,
      ...patch,
      textEffect: patch.textEffect
        ? { ...selectedTextAppearance.textEffect, ...patch.textEffect }
        : selectedTextAppearance.textEffect,
    };
    previewSelectedTextLayer({ ...nextAppearance, textEffect: nextAppearance.textEffect });
    const layer = selectedCanvasLayerElement(stageRef.current, selectedCanvasLayerIds.length);
    const text = layer?.querySelector<HTMLElement>('.shader-lab-v2-layer-text');
    if (!text) return;
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

  function previewSelectedTextLayer(update: Partial<Omit<CompositionTextLayer, 'id'>>) {
    if (frameCapturePendingRef.current || !selectedTextLayer) return;
    const current = textLayerPreviewOverridesRef.current.get(selectedTextLayer.id) ?? selectedTextLayer;
    textLayerPreviewOverridesRef.current.set(selectedTextLayer.id, {
      ...current,
      ...update,
      textEffect: update.textEffect
        ? { ...resolveTextEffectSettings(current.textEffect), ...update.textEffect }
        : current.textEffect,
      transform: update.transform ? { ...current.transform, ...update.transform } : current.transform,
    });
    effectPreviewRedrawRef.current?.();
  }

  function previewSelectedTextWidth(widthScale: number) {
    if (!selectedTextLayer || !selectedTextTransform) return;
    const geometry = layerGeometry(selectedTextLayer.id, canvasDimensions);
    const width = geometry.baseWidth * widthScale;
    const centerX = geometry.baseX + geometry.baseWidth / 2 + selectedTextTransform.x;
    previewSelectedTextLayer({ transform: { ...selectedTextTransform, widthScale } });
    const layer = selectedCanvasLayerElement(stageRef.current, selectedCanvasLayerIds.length);
    if (!layer) return;
    layer.style.left = `${(centerX - width / 2) / canvasDimensions.width * 100}%`;
    layer.style.width = `${width / canvasDimensions.width * 100}%`;
    syncSelectedCanvasLayerOverlay(layer);
  }

  function previewSelectedContentOpacity(value: number) {
    if (selectedTextLayer) previewSelectedTextLayer({ opacity: value });
    if (selectedLogoLayer) previewSelectedLogoLayer({ opacity: value });
    if (selectedAsset) previewSelectedAssetLayer({ opacity: value });
    const layer = selectedCanvasLayerElement(stageRef.current, selectedCanvasLayerIds.length);
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

  function previewSelectedImageCrop(patch: Partial<ImageCropSettings>) {
    if (!selectedAsset) return;
    const imageCrop = normalizeImageCropSettings({ ...selectedAsset.imageCrop, ...patch });
    previewSelectedAssetLayer({ imageCrop });
    const layer = selectedCanvasLayerElement(stageRef.current, selectedCanvasLayerIds.length);
    if (!layer) return;
    applyImageCropPreviewStyles(layer, imageCrop);
  }

  function previewSelectedLogoLayer(update: Partial<Omit<CompositionLogoLayer, 'id'>>) {
    if (frameCapturePendingRef.current || !selectedLogoLayer) return;
    const current = logoLayerPreviewOverridesRef.current.get(selectedLogoLayer.id) ?? selectedLogoLayer;
    logoLayerPreviewOverridesRef.current.set(selectedLogoLayer.id, {
      ...current,
      ...update,
      appearance: update.appearance
        ? { ...resolvedLogoAppearance(current.appearance), ...update.appearance }
        : current.appearance,
      transform: update.transform ? { ...current.transform, ...update.transform } : current.transform,
    });
    effectPreviewRedrawRef.current?.();
  }

  function previewSelectedAssetLayer(update: Partial<Omit<CompositionAsset, 'id'>>) {
    if (frameCapturePendingRef.current || !selectedAsset) return;
    const current = assetLayerPreviewOverridesRef.current.get(selectedAsset.id) ?? selectedAsset;
    assetLayerPreviewOverridesRef.current.set(selectedAsset.id, {
      ...current,
      ...update,
      appearance: update.appearance
        ? { ...resolvedLogoAppearance(current.appearance), ...update.appearance }
        : current.appearance,
      imageCrop: update.imageCrop
        ? normalizeImageCropSettings({ ...current.imageCrop, ...update.imageCrop })
        : current.imageCrop,
      stickerFinish: update.stickerFinish
        ? normalizeStickerFinish({ ...current.stickerFinish, ...update.stickerFinish })
        : current.stickerFinish,
      transform: update.transform ? { ...current.transform, ...update.transform } : current.transform,
    });
    effectPreviewRedrawRef.current?.();
  }

  function previewSelectedLogoAppearance(
    patch: Partial<LogoAppearanceSettings>,
    logoColor = selectedLogoLayer?.color ?? '#FFFFFF'
  ) {
    if (!selectedLogoAppearance && !selectedAssetAppearance) return;
    const currentAppearance = selectedLogoAppearance ?? selectedAssetAppearance;
    if (!currentAppearance) return;
    const nextAppearance = { ...currentAppearance, ...patch };
    if (selectedLogoLayer) previewSelectedLogoLayer({ appearance: nextAppearance, color: logoColor });
    if (selectedAsset) previewSelectedAssetLayer({ appearance: nextAppearance });
    const layer = selectedCanvasLayerElement(stageRef.current, selectedCanvasLayerIds.length);
    if (!layer) return;
    layer.querySelectorAll<HTMLElement>('[data-appearance-content="true"]')
      .forEach((content) => {
        content.style.color = logoColor;
        content.style.filter = logoAppearanceCssFilter(nextAppearance);
      });
    const ditherMask = logoAppearanceDitherMask(nextAppearance);
    layer.querySelectorAll<HTMLElement>('[data-appearance-dither-mask="true"]')
      .forEach((content) => {
        content.style.maskImage = ditherMask?.image ?? 'none';
        content.style.maskPosition = ditherMask ? '0 0' : '';
        content.style.maskRepeat = ditherMask ? 'repeat' : '';
        content.style.maskSize = ditherMask?.size ?? '';
        content.style.webkitMaskImage = ditherMask?.image ?? 'none';
        content.style.webkitMaskPosition = ditherMask ? '0 0' : '';
        content.style.webkitMaskRepeat = ditherMask ? 'repeat' : '';
        content.style.webkitMaskSize = ditherMask?.size ?? '';
      });
  }

  function previewSelectedStickerFinish(patch: Partial<StickerFinishSettings>) {
    if (selectedAsset?.kind !== 'sticker') return;
    const finish = normalizeStickerFinish({ ...selectedAsset.stickerFinish, ...patch });
    previewSelectedAssetLayer({ stickerFinish: finish });
    const layer = selectedCanvasLayerElement(stageRef.current, selectedCanvasLayerIds.length);
    const overlay = layer?.querySelector<HTMLElement>('.shader-lab-v2-sticker-finish-overlay');
    if (!overlay) return;
    Object.entries(stickerFinishCssVariables(finish)).forEach(([property, value]) => {
      overlay.style.setProperty(property, value);
    });
  }

  function updateSetting<Key extends keyof LiveMaterialSettings>(key: Key, value: LiveMaterialSettings[Key]) {
    updateSelectedShader({ settings: { [key]: value } });
  }

  /** Puts the material on every selected layer; each keeps its own blend mode, opacity and zoom. */
  function selectMaterial(nextId: LiveMaterialId) {
    const targets = shaderEditTargets();
    if (!targets.length) {
      addCanvasShader(nextId);
      return;
    }
    const applicationFor = (current?: ShaderApplication) => shaderApplicationFor(nextId, brandPalette.colors, {
      blendMode: current?.blendMode,
      opacity: current?.opacity,
      shaderSize: current?.shaderSize,
    });
    targets.forEach((id) => shaderApplicationPreviewOverridesRef.current.delete(id));
    const shaderIds = new Set<CanvasLayerId>(targets.filter(isShaderLayerId));
    if (shaderIds.size) setShaderLayers((current) => current.map((layer) => shaderIds.has(layer.id) ? { ...layer, ...applicationFor(layer) } : layer));
    const contentIds = targets.filter(isContentLayerId);
    if (contentIds.length) setLayerShaders((current) => ({
      ...current,
      ...Object.fromEntries(contentIds.map((id) => [id, applicationFor(current[id])])),
    }));
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
    if (layer.materialId === materialId) return { ...layer, frameSnapshot: undefined };
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
    sequencePreviewingRef.current = false;
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
    if (sequencePreviewingRef.current) {
      stopShaderSequencePreview();
      return;
    }
    if (!sequenceTargetLayer || shaderSequenceTimeline.length === 0 || exportJobRef.current || frameCapturePendingRef.current) return;
    try {
      assertMotionIsSeekable('sequence');
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'This shader sequence cannot be time-sampled.');
      return;
    }
    sequencePreviewingRef.current = true;
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
      transform: { ...DEFAULT_LAYER_TRANSFORM, ...canvasInsertionTransform() },
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

  /** Adds a built-in converter, or an image effect when `image` names one, above every layer. */
  function addEffectLayer(
    kind: CompositionEffectKind = 'bayer',
    image?: { effectId: DesignLabImageEffectId; effectProps?: ShaderEffectProps }
  ): EffectLayerId | null {
    if (editingCanvas) { setExportError('Frame your selection to apply a composition-wide converter.'); return null; }
    const id = `effect-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as EffectLayerId;
    const preset = COMPOSITION_EFFECT_PRESETS.find((option) => option.kind === kind)!;
    const imageEffect = designLabImageEffect(image?.effectId);
    const number = effectLayers.filter(({ settings }) => imageEffect
      ? settings.effectId === imageEffect.id
      : !settings.effectId && settings.kind === kind).length + 1;
    const layer: CompositionEffectLayer = {
      id,
      name: `${imageEffect?.name ?? preset.label} ${number}`,
      opacity: 1,
      settings: imageEffect
        ? { ...defaultCompositionEffectSettings(kind), effectId: imageEffect.id, effectProps: image?.effectProps ?? {} }
        : defaultCompositionEffectSettings(kind),
      visible: true,
    };
    setEffectLayers((current) => [...current, layer]);
    setLayerOrder((current) => [...current, id]);
    setSelectedLayerId(id);
    setSelectedCanvasLayerIds([]);
    return id;
  }

  function updateEffectLayer(id: EffectLayerId, update: Partial<Omit<CompositionEffectLayer, 'id'>>) {
    effectPreviewOverridesRef.current.delete(id);
    setEffectLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...update } : layer));
  }

  function previewEffectLayer(
    id: EffectLayerId,
    update: { opacity?: number; settings?: Partial<CompositionEffectSettings> }
  ) {
    if (frameCapturePendingRef.current) return;
    const current = effectPreviewOverridesRef.current.get(id);
    effectPreviewOverridesRef.current.set(id, {
      ...current,
      ...update,
      settings: update.settings ? { ...current?.settings, ...update.settings } : current?.settings,
    });
    effectPreviewRedrawRef.current?.();
  }

  function selectEffectPreset(layer: CompositionEffectLayer, kind: CompositionEffectKind) {
    const preset = COMPOSITION_EFFECT_PRESETS.find((option) => option.kind === kind)!;
    updateEffectLayer(layer.id, {
      name: preset.label,
      settings: defaultCompositionEffectSettings(kind),
    });
  }

  /** Switches an Effect layer to an image effect. Settings start from the effect's defaults unless given. */
  function selectImageEffect(layer: CompositionEffectLayer, effectId: DesignLabImageEffectId, effectProps: ShaderEffectProps = {}) {
    const imageEffect = designLabImageEffect(effectId);
    if (!imageEffect) return;
    updateEffectLayer(layer.id, {
      name: imageEffect.name,
      settings: { ...layer.settings, effectId: imageEffect.id, effectProps },
    });
  }

  function removeEffectLayer(id: EffectLayerId) {
    effectPreviewOverridesRef.current.delete(id);
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
      color: canvasInsertionColors().color,
      id,
      name: number === 1 ? 'Brand mark' : `Brand mark ${number}`,
      opacity: 1,
      transform: { ...DEFAULT_LAYER_TRANSFORM, ...(editingCanvas ? canvasInsertionTransform() : { x: offset, y: offset }) },
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
    const { color } = canvasInsertionColors();
    try {
      const converted = await convertedAssetLibrary.importFiles(images, 2048);
      const nextLayers = converted.map((asset, index): CompositionLogoLayer => {
      return {
        appearance: { ...DEFAULT_LOGO_APPEARANCE },
        color,
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
      ...canvasInsertionColors(),
      fontSize: DEFAULT_DESIGN_LAB_FONT_SIZE,
      fontStyle: 'normal',
      id,
      kind,
      lineHeight: 0.95,
      name: sticker ? `Text sticker ${nextNumber}` : `Text ${nextNumber}`,
      strikethrough: false,
      tracking: -0.06,
      transform: { ...DEFAULT_TEXT_LAYER_TRANSFORM, ...(editingCanvas ? canvasInsertionTransform() : placement) },
      underline: false,
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
    textLayerPreviewOverridesRef.current.delete(id);
    setTextLayers((current) => current.map((layer) =>
      layer.id === id ? {
        ...layer, ...update,
        runs: 'runs' in update ? update.runs : update.value !== undefined ? editTextRuns(layer.value, update.value, layer.runs) : layer.runs,
      } : layer
    ));
  }

  function updateTextFormatting(id: TextLayerId, update: Partial<Omit<CompositionTextLayer, 'id'>>) {
    const selection = textSelectionRef.current;
    const range = selection?.layerId === id && selectedLayerId === id ? selection : null;
    const patch = Object.fromEntries(INLINE_TEXT_KEYS.filter((key) => update[key] !== undefined).map((key) => [key, update[key]])) as InlineTextStyle;
    if (!Object.keys(patch).length) { updateTextLayer(id, update); return; }
    setTextLayers((current) => current.map((layer) => {
      if (layer.id !== id) return layer;
      if (!range) return { ...layer, ...update, runs: clearTextStyleProperties(layer.runs, patch) };
      const scaledPatch = patch.fontSize === undefined ? patch : { ...patch, fontSize: patch.fontSize / layer.transform.scale };
      return { ...layer, runs: formatTextRange(layer.value, layer.runs, range, scaledPatch) };
    }));
    textLayerPreviewOverridesRef.current.delete(id);
  }

  function formatSelectedTextShortcut(id: TextLayerId, format: 'bold' | 'italic' | 'underline') {
    const layer = textLayers.find((layer) => layer.id === id);
    const range = textSelectionRef.current;
    if (!layer || !range || range.layerId !== id) return;
    const style = textStyleSegments(layer.value, layer.runs).find((run) => run.start <= range.start && run.end > range.start)?.style ?? {};
    const resolved = { ...layer, ...style };
    const bounds = textFontWeightRange(identity, textFontFamily(identity, layer, style));
    if (format === 'bold' && (bounds.max < 600 || bounds.min >= 600)) return;
    updateTextFormatting(id, format === 'bold' ? { weight: resolved.weight >= 600 ? 400 : 700 }
      : format === 'italic' ? { fontStyle: resolved.fontStyle === 'italic' ? 'normal' : 'italic' }
        : { underline: !resolved.underline });
  }

  function removeTextLayer(id: TextLayerId) {
    textEffectScratchRefs.current.delete(id);
    textLayerPreviewOverridesRef.current.delete(id);
    shaderApplicationPreviewOverridesRef.current.delete(id);
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

  /** The other selected content layers, when the primary is part of a multi-layer selection. */
  function selectionPeers(id: ContentLayerId): Set<CompositionLayerId> {
    if (!selectedCanvasLayerIds.includes(id)) return new Set();
    return new Set<CompositionLayerId>(selectedCanvasLayerIds.filter((peer) => peer !== id && isContentLayerId(peer)));
  }

  function editSelectionPeers(primary: { id: ContentLayerId; transform: CanvasLayerTransform }, edit: TextLayerEdit | LogoLayerEdit | AssetLayerEdit) {
    const peers = selectionPeers(primary.id);
    if (!peers.size) return;
    const shared = <Edit extends TextLayerEdit | LogoLayerEdit | AssetLayerEdit>(id: ContentLayerId) => (
      peers.has(id) ? peerEdit<Edit>(edit, primary, id) : null
    );
    peers.forEach((id) => {
      textLayerPreviewOverridesRef.current.delete(id as TextLayerId);
      logoLayerPreviewOverridesRef.current.delete(id as LogoLayerId);
      assetLayerPreviewOverridesRef.current.delete(id as AssetLayerId);
    });
    setTextLayers((current) => current.map((layer) => {
      const peer = shared<TextLayerEdit>(layer.id);
      return peer ? applyPeerTextEdit(layer, peer) : layer;
    }));
    setLogoLayers((current) => current.map((layer) => {
      const peer = shared<LogoLayerEdit>(layer.id);
      return peer ? applyLogoEdit(layer, peer) : layer;
    }));
    setCompositionAssets((current) => current.map((layer) => {
      const peer = shared<AssetLayerEdit>(layer.id);
      return peer ? applyAssetEdit(layer, peer) : layer;
    }));
  }

  /** An inspector text edit. A character range stays within its own box; otherwise the selection follows. */
  function editTextSelection(id: TextLayerId, edit: TextLayerEdit, formatting: boolean) {
    const primary = textLayers.find((layer) => layer.id === id);
    if (!primary) return;
    const { textEffect, transform, ...rest } = edit;
    const update: Partial<Omit<CompositionTextLayer, 'id'>> = {
      ...rest,
      ...(textEffect ? { textEffect: { ...resolveTextEffectSettings(primary.textEffect), ...textEffect } } : {}),
      ...(transform ? { transform: { ...primary.transform, ...transform } } : {}),
    };
    if (formatting) updateTextFormatting(id, update);
    else updateTextLayer(id, update);
    const range = textSelectionRef.current;
    if (formatting && range?.layerId === id && selectedLayerId === id) return;
    editSelectionPeers(primary, edit);
  }

  function editLogoSelection(id: LogoLayerId, edit: LogoLayerEdit) {
    const primary = logoLayers.find((layer) => layer.id === id);
    if (!primary) return;
    updateLogoLayer(id, applyLogoEdit(primary, edit));
    editSelectionPeers(primary, edit);
  }

  function editAssetSelection(id: AssetLayerId, edit: AssetLayerEdit) {
    const primary = compositionAssets.find((layer) => layer.id === id);
    if (!primary) return;
    updateAssetLayer(id, applyAssetEdit(primary, edit));
    editSelectionPeers(primary, edit);
  }

  function updateLogoLayer(id: LogoLayerId, update: Partial<Omit<CompositionLogoLayer, 'id'>>) {
    logoLayerPreviewOverridesRef.current.delete(id);
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
    logoLayerPreviewOverridesRef.current.delete(id);
    shaderApplicationPreviewOverridesRef.current.delete(id);
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
    const insertion = canvasInsertionTransform();
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
          x: insertion.x + (column - (columns - 1) / 2) * 44,
          y: insertion.y + (row - (rows - 1) / 2) * 36,
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
  }, [canvasDimensions.height, canvasDimensions.width, compositionAssets, editingCanvas, ratio]);

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
      onIdentitySave({ ...brandIdentity, assets: [...brandIdentity.assets, ...importedAssets] });
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
      const message = imageLibraryErrorMessage(error);
      setImageImportError(message);
      setImageImportState({ message, status: 'error' });
    }
  }, [brandIdentity, onIdentitySave, placeBrandAssets]);

  const deleteSavedAsset = useCallback((asset: BrandAsset) => {
    try {
      if (!onIdentitySave) throw new Error('This project cannot update shared assets yet.');
      onIdentitySave({
        ...brandIdentity,
        assets: brandIdentity.assets.filter((candidate) => candidate.id !== asset.id),
        proofAssets: brandIdentity.proofAssets.filter((candidate) => candidate.id !== asset.id),
      });
      setImageImportError(null);
      setImageImportState({
        message: `Deleted ${asset.label} from Assets. Existing canvas layers were kept.`,
        status: 'success',
      });
    } catch (error) {
      const message = imageLibraryErrorMessage(error);
      setImageImportError(message);
      setImageImportState({ message, status: 'error' });
    }
  }, [brandIdentity, onIdentitySave]);

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
    canvasStatusStore.set(message);
    if (canvasClipboardStatusTimerRef.current !== null) {
      window.clearTimeout(canvasClipboardStatusTimerRef.current);
    }
    canvasClipboardStatusTimerRef.current = window.setTimeout(() => {
      canvasClipboardStatusTimerRef.current = null;
      canvasStatusStore.set(null);
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

  const clipboardOperationRef = useRef(false);
  const pasteDesignLabClipboardRef = useCommittedRef(pasteDesignLabClipboard);

  async function currentDesignLabClipboardSource(
    forceArtboard = false,
    explicitLayerIds?: readonly CompositionLayerId[]
  ) {
    let layerIds = forceArtboard
      ? []
      : explicitLayerIds
        ? layerOrder.filter((id) => explicitLayerIds.includes(id))
        : canvasClipboardLayerIds();
    const artboardId = activeArtboardIdRef.current;
    if (artboardId === DESIGN_CANVAS_ID && !layerIds.length) layerIds = [...layerOrder];
    if (artboardId === DESIGN_CANVAS_ID && !layerIds.length) throw new Error('Add or select canvas layers before copying.');
    const captured = await captureCompositionFrame();
    const portableSource = await prepareShaderFrameDocumentSource(captured);
    const portable = parseCanvasDocument(portableSource);
    const parsed = await parseCompositionSource(portableSource);
    const artboard = parsed.workspace?.artboards?.find((item) => item.id === artboardId);
    if (!artboard) throw new Error('The copied artboard is no longer available.');
    const frameAssets = Object.values(portable.assets).filter(({ id }) => id.startsWith('shader-frame:'));
    const source = layerIds.length > 0
      ? serializeDesignLabClipboard({
          frameAssets,
          kind: 'layers',
          layerIds,
          snapshot: artboard.snapshot,
        })
      : serializeDesignLabClipboard({ artboard, frameAssets, kind: 'artboard' });
    return { label: layerIds.length > 0 ? `${layerIds.length} layer${layerIds.length === 1 ? '' : 's'}` : artboard.name, source };
  }

  /** Text fields, and text the user has selected, keep the browser's own clipboard behaviour. */
  function ownsClipboardEvent(event: ClipboardEvent): boolean {
    if (!workspaceActiveRef.current || !projectWorkspaceActiveRef.current || isCanvasClipboardEditingTarget(event.target)) return false;
    const browserSelection = window.getSelection();
    return !(browserSelection && !browserSelection.isCollapsed && browserSelection.toString());
  }

  function copyDesignLabSelection(event: ClipboardEvent) {
    if (!ownsClipboardEvent(event)) return;
    event.preventDefault();
    void copyDesignLabSelectionFromMenu();
  }

  /** ⌘X copies the selected layers, then deletes them. Without a layer selection it does nothing. */
  function cutDesignLabSelection(event: ClipboardEvent) {
    if (!ownsClipboardEvent(event)) return;
    const layerIds = canvasClipboardLayerIds();
    if (layerIds.length === 0) return;
    event.preventDefault();
    const target = designLabCutTarget({
      canvasSelectionCount: selectedCanvasLayerIds.length,
      chosenLayerLocked: layerLocked(layerIds[0]!),
    });
    if (target === 'copy-only') {
      void copyDesignLabSelectionFromMenu(false, layerIds).then((copied) => {
        if (copied) announceCanvasClipboard('The layer is locked, so it was copied and not cut');
      });
      return;
    }
    const remove = target === 'canvas-selection' ? removeCanvasSelection : () => removeLayer(layerIds[0]!);
    void cutDesignLabSelectionFromMenu(remove, layerIds);
  }

  async function copyDesignLabSelectionFromMenu(
    forceArtboard = false,
    explicitLayerIds?: readonly CompositionLayerId[]
  ) {
    if (clipboardOperationRef.current) return false;
    clipboardOperationRef.current = true;
    try {
      const prepared = currentDesignLabClipboardSource(forceArtboard, explicitLayerIds).then((copy) => {
        designLabClipboardRef.current = copy.source;
        return copy;
      });
      // Begin the browser write in the original input event, before PNG encoding.
      const written = writePreparedDesignLabClipboard(prepared.then(({ source }) => source));
      const [copy, systemClipboard] = await Promise.all([prepared, written]);
      announceCanvasClipboard(`Copied ${copy.label}${systemClipboard ? '' : ' · use Paste in the canvas menu'}`);
      setExportError(null);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The selected design could not be copied.';
      setExportError(message);
      announceCanvasClipboard(message);
      return false;
    } finally {
      clipboardOperationRef.current = false;
    }
  }

  async function cutDesignLabSelectionFromMenu(
    remove: () => void,
    explicitLayerIds?: readonly CompositionLayerId[]
  ) {
    if (await copyDesignLabSelectionFromMenu(false, explicitLayerIds)) {
      remove();
      announceCanvasClipboard('Cut selection · ready to paste');
    }
  }

  async function pasteDesignLabSelectionFromMenu() {
    let source = designLabClipboardRef.current ?? '';
    try {
      source = await navigator.clipboard.readText() || source;
    } catch {
      // Browser clipboard permission is optional; use the last local copy instead.
    }
    const payload = parseDesignLabClipboard(source) ?? parseDesignLabClipboard(designLabClipboardRef.current ?? '');
    if (!payload) {
      announceCanvasClipboard('Nothing from Glyphfield is ready to paste');
      return;
    }
    // Clipboard permission UI can outlive a render; operate on the current editor.
    await pasteDesignLabClipboardRef.current(payload);
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

  function pasteCapturedArtboard(
    artboard: Extract<DesignLabClipboardPayload, { kind: 'artboard' }>['artboard'],
    snapshot: DesignArtboardSnapshot,
    captured: { artboardId: DesignArtboardId; snapshot: DesignArtboardSnapshot }
  ) {
    const existing = workspaceArtboardsRef.current.map((artboard) => (
      artboard.id === captured.artboardId
        ? { ...artboard, snapshot: captured.snapshot }
        : artboard
    ));
    const { x, y } = nextPastedArtboardPosition(existing, artboard);
    const id = `artboard-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as DesignArtboardId;
    const nextArtboard: DesignArtboard = {
      id,
      name: nextPastedArtboardName(artboard.name),
      displayScale: typeof artboard.displayScale === 'number' && Number.isFinite(artboard.displayScale) && artboard.displayScale > 0 ? artboard.displayScale : undefined,
      snapshot,
      x,
      y,
    };
    applyActiveArtboard(nextArtboard, [...existing, nextArtboard], true);
    announceCanvasClipboard(`Pasted ${nextArtboard.name} · autosaving`);
  }

  async function pasteDesignLabClipboard(payload: DesignLabClipboardPayload) {
    if (clipboardOperationRef.current || artboardOperationRef.current) return;
    clipboardOperationRef.current = true;
    artboardOperationRef.current = true;
    const signature = compositionSignatureRef.current;
    const sourceSequence = sourceApplySequenceRef.current;
    const artboardId = activeArtboardIdRef.current;
    try {
      await hydrateDesignLabClipboardFrames(payload);
      if (signature !== compositionSignatureRef.current || sourceSequence !== sourceApplySequenceRef.current
        || artboardId !== activeArtboardIdRef.current) {
        throw new Error('The design changed while copied shader frames were loading. Paste again.');
      }
      const captured = await captureArtboardBeforeLeaving();
      const source = payload.kind === 'layers' ? payload.snapshot : payload.artboard.snapshot;
      const anchored = reanchorDesignLabClipboardSnapshot(source, previewTimeRef.current);
      const remapped = remapDesignLabClipboardSnapshot(anchored, payload.kind === 'layers'
        ? { layerIds: payload.layerIds, offset: 32, renameLayers: true } : {});
      const snapshot = remapped.snapshot as unknown as DesignArtboardSnapshot;
      if (payload.kind === 'layers') {
        if (remapped.layerIds.length > 0) mergePastedLayers(snapshot, remapped.layerIds);
      } else {
        pasteCapturedArtboard(payload.artboard, snapshot, captured);
      }
      setExportError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The copied design could not be pasted.';
      setExportError(message);
      announceCanvasClipboard(message);
    } finally {
      artboardOperationRef.current = false;
      clipboardOperationRef.current = false;
    }
  }

  /** ⌘] / ⌘[ and their Shift forms: the canvas selection, or the one layer chosen in the layer list. */
  function reorderSelection(direction: 'backward' | 'forward', toEdge: boolean) {
    if (selectedCanvasLayerIds.length > 0) {
      if (toEdge) moveCanvasSelectionToEdge(direction === 'forward' ? 'front' : 'back');
      else moveCanvasSelection(direction === 'forward' ? 1 : -1);
    } else if (selectedLayerId) {
      if (toEdge) moveLayerToEdge(selectedLayerId, direction === 'forward' ? 'front' : 'back');
      else moveLayer(selectedLayerId, direction === 'forward' ? 1 : -1);
    }
  }

  /** ⌘D and Delete: the canvas selection, or the one unlocked layer chosen in the layer list. */
  function duplicateOrDeleteSelection(kind: 'delete' | 'duplicate') {
    if (selectedCanvasLayerIds.length > 0) {
      if (kind === 'delete') removeCanvasSelection();
      else void duplicateCanvasSelection();
    } else if (selectedLayerId && !layerLocked(selectedLayerId)) {
      if (kind === 'delete') removeLayer(selectedLayerId);
      else void duplicateLayer(selectedLayerId);
    }
  }

  function addLayerFromShortcut(layer: Extract<DesignLabShortcutCommand, { kind: 'add' }>['layer']) {
    if (layer === 'text') addTextLayer();
    else if (layer === 'shader') addCanvasShader();
    else if (layer === 'mark') addBrandMarkLayer();
    else if (layer === 'image') openImageImport();
    else if (layer === 'sticker') openImageImport([], 'sticker');
    else if (editingCanvas) announceCanvasClipboard('Frame your selection to apply composition-wide effects');
    else addEffectLayer();
  }

  function arrangeFromShortcut(arrangement: DesignLabArrangement) {
    if (arrangeCanvasSelection(arrangement)) return;
    announceCanvasClipboard(arrangement.startsWith('distribute-')
      ? 'Select three or more layers to distribute' : 'Select two or more layers to align');
  }

  function runEditorShortcut(command: DesignLabShortcutCommand) {
    if (command.kind === 'shortcuts') setShortcutsOpen((open) => !open);
    else if (command.kind === 'select-all') selectAllCanvasLayers();
    else if (command.kind === 'order') reorderSelection(command.direction, command.toEdge);
    else if (command.kind === 'delete' || command.kind === 'duplicate') duplicateOrDeleteSelection(command.kind);
    else if (command.kind === 'group') groupCanvasSelection();
    else if (command.kind === 'ungroup') ungroupCanvasSelection();
    else if (command.kind === 'copy-style') copyLayerStyle();
    else if (command.kind === 'paste-style') pasteLayerStyle();
    else if (command.kind === 'toggle-lock') toggleSelectionLock();
    else if (command.kind === 'arrange') arrangeFromShortcut(command.arrangement);
    else addLayerFromShortcut(command.layer);
  }

  const handleEditorShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.repeat || !workspaceActiveRef.current || !projectWorkspaceActiveRef.current) return;
    const root = studioRootRef.current;
    const target = event.target instanceof Element ? event.target : null;
    // Typing, menus and dialogs keep their keys; the editor must be focused or under the pointer.
    if (!root || isCanvasTextEditingTarget(event.target)
      || target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="menu"], [role="dialog"], [role="listbox"]')) return;
    if (!root.contains(document.activeElement) && !pointerInEditorRef.current) return;
    const command = resolveDesignLabShortcut(event);
    if (!command) return;
    event.preventDefault();
    runEditorShortcut(command);
  });

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => handleEditorShortcut(event);
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  const handleDesignLabCopy = useEffectEvent(copyDesignLabSelection);
  const handleDesignLabCut = useEffectEvent(cutDesignLabSelection);
  const handleDesignLabPaste = useEffectEvent((event: ClipboardEvent) => {
    if (!workspaceActiveRef.current || !projectWorkspaceActiveRef.current || isCanvasClipboardEditingTarget(event.target)) return;
    const customSource = event.clipboardData?.getData(DESIGN_LAB_CLIPBOARD_MIME) ?? '';
    const textSource = event.clipboardData?.getData('text/plain') ?? '';
    const localSource = event.clipboardData?.files.length ? '' : designLabClipboardRef.current ?? '';
    const payload = parseDesignLabClipboard(customSource || textSource || localSource);
    if (payload) {
      event.preventDefault();
      void pasteDesignLabClipboard(payload);
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
    const handleCut = (event: ClipboardEvent) => handleDesignLabCut(event);
    const handlePaste = (event: ClipboardEvent) => {
      handleDesignLabPaste(event);
    };
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
    };
  }, [active]);

  useEffect(() => () => {
    if (canvasClipboardStatusTimerRef.current !== null) {
      window.clearTimeout(canvasClipboardStatusTimerRef.current);
    }
  }, []);

  async function handleImageDrop(event: ReactDragEvent<HTMLElement>) {
    if (!dataTransferHasFiles(event.dataTransfer)) return;
    event.preventDefault();
    setImageDropActive(false);
    const files = Array.from(event.dataTransfer.files);
    const board = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-artboard-id]') : null;
    const ready = board?.dataset.artboardId
      ? await activateArtboard(board.dataset.artboardId as DesignArtboardId)
      : await activateCanvasAtPoint({ x: event.clientX, y: event.clientY });
    if (ready) openImageImport(files);
  }

  function removeAsset(id: AssetLayerId) {
    const removed = compositionAssets.find((asset) => asset.id === id);
    const remaining = compositionAssets.filter((asset) => asset.id !== id);
    if (removed?.url.startsWith('blob:') && !remaining.some((asset) => asset.url === removed.url)) {
      URL.revokeObjectURL(removed.url);
      compositionAssetUrlsRef.current = compositionAssetUrlsRef.current.filter((url) => url !== removed.url);
    }
    assetLayerPreviewOverridesRef.current.delete(id);
    shaderApplicationPreviewOverridesRef.current.delete(id);
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

  function moveLayerToEdge(id: CompositionLayerId, edge: 'back' | 'front') {
    setLayerOrder((current) => {
      if (!current.includes(id)) return current;
      const remaining = current.filter((layerId) => layerId !== id);
      return edge === 'front' ? [...remaining, id] : [id, ...remaining];
    });
  }

  function updateAssetTransform(id: AssetLayerId, transform: CanvasLayerTransform) {
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, transform } : asset));
  }

  function updateAssetLayer(id: AssetLayerId, update: Partial<Omit<CompositionAsset, 'id'>>) {
    assetLayerPreviewOverridesRef.current.delete(id);
    setCompositionAssets((current) => current.map((asset) => asset.id === id ? { ...asset, ...update } : asset));
  }

  function setImageCropEditing(id: AssetLayerId, editing: boolean) {
    const asset = compositionAssets.find((candidate) => candidate.id === id);
    if (!asset) return;
    if (editing) {
      const crop = normalizeImageCropSettings(asset.imageCrop);
      if (!crop.enabled) updateAssetLayer(id, { imageCrop: { ...crop, enabled: true } });
      selectCanvasAssembly(id);
      setCropEditingLayerId(id);
      setSelectionMenuPosition(null);
      announceCanvasClipboard(`Editing crop for ${asset.name} · drag the image inside the blue frame`);
      window.requestAnimationFrame(() => {
        stageRef.current?.querySelector<HTMLElement>('.image-crop-editor-overlay')?.focus({ preventScroll: true });
      });
      return;
    }
    setCropEditingLayerId((current) => current === id ? null : current);
  }

  function resetImageCrop(id: AssetLayerId) {
    updateAssetLayer(id, { imageCrop: { ...DEFAULT_IMAGE_CROP, enabled: true } });
    announceCanvasClipboard('Crop reset to a centered fill');
  }

  async function setImageCropAspect(id: AssetLayerId, value: string) {
    if (value === 'freeform') return;
    const asset = compositionAssets.find((candidate) => candidate.id === id);
    if (!asset) return;
    let aspect = Number(value);
    if (value === 'original') {
      try {
        const image = await loadCanvasImage(asset.url);
        aspect = (image.naturalWidth || 1) / (image.naturalHeight || 1);
      } catch (error) {
        setExportError(error instanceof Error ? error.message : 'The image ratio could not be read.');
        return;
      }
    }
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    const geometry = layerGeometry(id, canvasDimensions);
    const current = canvasLayerDimensions(asset.transform, geometry);
    let width = current.width;
    let height = width / aspect;
    const maximumHeight = canvasDimensions.height * 1.5;
    if (height > maximumHeight) {
      height = maximumHeight;
      width = height * aspect;
    }
    updateAssetLayer(id, {
      imageCrop: { ...normalizeImageCropSettings(asset.imageCrop), enabled: true },
      transform: {
        ...asset.transform,
        heightScale: Math.max(MIN_CANVAS_LAYER_SCALE, height / geometry.baseHeight),
        widthScale: Math.max(MIN_CANVAS_LAYER_SCALE, width / geometry.baseWidth),
      },
    });
    setImageCropEditing(id, true);
  }

  function layerVisible(id: CompositionLayerId) {
    return !designLabDocument.elements[id]?.hidden;
  }

  function layerLocked(id: CompositionLayerId) {
    return Boolean(designLabDocument.elements[id]?.locked);
  }

  /** Canvas layers that keyboard and menu commands act on: the canvas selection, else the selected layer. */
  function commandLayerIds(): CanvasLayerId[] {
    if (selectedCanvasLayerIds.length > 0) return selectedCanvasLayerIds;
    return selectedLayerId && isCanvasLayerId(selectedLayerId) ? [selectedLayerId] : [];
  }

  function setLayersLocked(ids: readonly CompositionLayerId[], locked: boolean) {
    const targets = new Set(ids.filter(isCanvasLayerId));
    if (targets.size === 0) return;
    const lock = <T extends { id: string; locked?: boolean }>(layer: T): T => {
      if (!targets.has(layer.id as CanvasLayerId) || Boolean(layer.locked) === locked) return layer;
      const next = { ...layer };
      if (locked) next.locked = true;
      else delete next.locked;
      return next;
    };
    setShaderLayers((current) => current.map(lock));
    setTextLayers((current) => current.map(lock));
    setLogoLayers((current) => current.map(lock));
    setCompositionAssets((current) => current.map(lock));
    // A locked layer leaves the canvas selection but stays open in the inspector.
    if (locked) setSelectedCanvasLayerIds((current) => current.filter((id) => !targets.has(id)));
    announceCanvasClipboard(`${locked ? 'Locked' : 'Unlocked'} ${targets.size} layer${targets.size === 1 ? '' : 's'}`);
  }

  function toggleLayerLock(id: CompositionLayerId) {
    setLayersLocked([id], !layerLocked(id));
  }

  function toggleSelectionLock() {
    const ids = commandLayerIds();
    if (ids.length === 0) return;
    setLayersLocked(ids, !ids.every(layerLocked));
  }

  function styledLayer(id: CompositionLayerId): DesignLabStyledLayer | null {
    if (!isCanvasLayerId(id)) return null;
    const layer = stageLayerById.get(id);
    return layer ? layer as DesignLabStyledLayer : null;
  }

  function copyLayerStyle(id: CompositionLayerId | null = selectedLayerId): boolean {
    const layer = id ? styledLayer(id) : null;
    if (!layer) {
      announceCanvasClipboard('Select a text, mark, image or shader layer to copy its style');
      return false;
    }
    styleClipboardRef.current = extractDesignLabLayerStyle(layer, isContentLayerId(layer.id) ? layerShaders[layer.id] : undefined);
    announceCanvasClipboard(`Copied style from ${layer.name}`);
    return true;
  }

  function pasteLayerStyle(ids: readonly CompositionLayerId[] = commandLayerIds()): number {
    const style = styleClipboardRef.current;
    const targets = new Set(ids.filter((id) => styledLayer(id) && !layerLocked(id)));
    if (!style || targets.size === 0) {
      announceCanvasClipboard(style ? 'Select unlocked layers to paste the style onto' : 'Copy a style first');
      return 0;
    }
    const restyle = <T extends DesignLabStyledLayer>(layer: T): T => (
      targets.has(layer.id as CompositionLayerId) ? applyDesignLabLayerStyle(layer, style).layer : layer
    );
    targets.forEach((id) => {
      shaderApplicationPreviewOverridesRef.current.delete(id as ShaderLayerId | ContentLayerId);
      if (isTextLayerId(id)) textLayerPreviewOverridesRef.current.delete(id);
      if (isLogoLayerId(id)) logoLayerPreviewOverridesRef.current.delete(id);
      if (isAssetLayerId(id)) assetLayerPreviewOverridesRef.current.delete(id);
    });
    setShaderLayers((current) => current.map(restyle));
    setTextLayers((current) => current.map(restyle));
    setLogoLayers((current) => current.map(restyle));
    setCompositionAssets((current) => current.map(restyle));
    const contentTargets = [...targets].filter(isContentLayerId);
    // A copied material fills content layers; without one they keep their own.
    if (style.material && contentTargets.length > 0) {
      const material = style.material;
      setLayerShaders((current) => ({
        ...current,
        ...Object.fromEntries(contentTargets.map((id) => [id, { ...material, settings: { ...material.settings } }])),
      }));
    }
    announceCanvasClipboard(`Pasted style onto ${targets.size} layer${targets.size === 1 ? '' : 's'}`);
    return targets.size;
  }

  const designLabPage = designLabDocument.pages[designLabDocument.pageIds[0]!]!;
  const listedLayerIds = designLabPage.elementIds as CompositionLayerId[];
  const visibleLayerIds = useMemo(
    () => listedLayerIds.filter((id) => !designLabDocument.elements[id]?.hidden),
    [designLabDocument, listedLayerIds]
  );
  const visibleLayerIdSet = useMemo(() => new Set(visibleLayerIds), [visibleLayerIds]);
  // Content keys: the document is rebuilt for every edit, while these change
  // only when the listed layers or their visibility do.
  const listedLayerKey = listedLayerIds.join('\u0000');
  const hiddenLayerKey = listedLayerIds.filter((id) => designLabDocument.elements[id]?.hidden).join('\u0000');
  const visibleShaderCapabilities = useMemo(() => [
    ...shaderLayers.filter(({ id }) => visibleLayerIdSet.has(id)),
    ...Object.entries(layerShaders).flatMap(([id, application]) => application && visibleLayerIdSet.has(id as CompositionLayerId) ? [application] : []),
  ].map(({ materialId }) => getShaderMotionCapabilities(materialId)), [layerShaders, shaderLayers, visibleLayerIdSet]);
  const compositionCanSeek = visibleShaderCapabilities.every(({ motionModel }) => motionModel !== 'stateful');
  const compositionHasMotion = visibleShaderCapabilities.some(({ motionModel }) => motionModel !== 'static');
  const explorerCapabilities = visibleShaderCapabilities.find(({ motionModel }) => motionModel === 'stateful')
    ?? visibleShaderCapabilities.find(({ motionModel }) => motionModel !== 'static')
    ?? visibleShaderCapabilities[0];
  const visibleShaderRendererCount = useMemo(
    () => visibleLayerIds.reduce((count, layerId) => (
      isShaderLayerId(layerId) || (isContentLayerId(layerId) && layerShaders[layerId])
        ? count + 1
        : count
    ), 0),
    [layerShaders, visibleLayerIds]
  );
  const shaderTimelineRestoring = shaderTimelineRestore.pendingKeys.some((key) => {
    const id = key.slice(key.indexOf('-') + 1) as CompositionLayerId;
    if (!visibleLayerIdSet.has(id)) return false;
    const application = key.startsWith('canvas-')
      ? shaderLayers.find((layer) => layer.id === id)
      : layerShaders[id as ContentLayerId];
    return application && !(paused && shaderFrameMatches(application.frameSnapshot, application));
  });

  function assertShaderTimelineReady() {
    if (shaderTimelineRestoring) throw new Error('The restored shader time is still loading. Wait for its preview before capturing or exporting.');
  }

  function beginShaderTimelineRestore(timeMs: number, layers: readonly CompositionShaderLayer[], applications: Partial<Record<ContentLayerId, ShaderApplication>>) {
    clearLiveMaterialTimePreview('design-lab');
    setShaderTimelineRestore((current) => ({
      revision: current.revision + 1,
      timeMs,
      pendingKeys: [
        ...layers.map(({ id }) => `canvas-${id}`),
        ...Object.entries(applications).filter(([, application]) => Boolean(application)).map(([id]) => `content-${id}`),
      ],
    }));
  }

  function finishShaderTimelineRestore(key: string, revision: number) {
    setShaderTimelineRestore((current) => current.revision === revision && current.pendingKeys.includes(key)
      ? { ...current, pendingKeys: current.pendingKeys.filter((pendingKey) => pendingKey !== key) }
      : current);
  }
  const previewQuality = useRenderQuality(studioRenderQualityStore, active && livePreviewRuntimeReady && !paused && compositionHasMotion);
  const livePreviewPixelBudget = liveMaterialInstancePixelBudget({
    instanceCount: visibleShaderRendererCount,
    ...DESIGN_LAB_PREVIEW_PIXEL_BUDGETS[previewQuality.quality],
  });

  function compositionSetupSource(): string | null {
    // The portable document already contains this exact timeline and revision.
    // Save controls and selection renders must not reserialize every embedded
    // image and font just to determine whether a source is available.
    return portableDesignLab.source;
  }

  function shaderCaptureRequests(timeMs: number): ShaderFrameCaptureRequest[] {
    const applications: Array<[string, ShaderApplication]> = shaderLayers
      .filter((layer) => visibleLayerIdSet.has(layer.id))
      .map((layer) => [`canvas-${layer.id}`, layer]);
    Object.entries(layerShaders).forEach(([id, application]) => {
      if (application && visibleLayerIdSet.has(id as CompositionLayerId)) applications.push([`content-${id}`, application]);
    });
    return applications.map(([key, application]) => ({
      key,
      recipeKey: shaderFrameRecipeKey(application),
      root: stageRef.current?.querySelector(`[data-shader-instance="${CSS.escape(key)}"]`) ?? null,
      ...(paused && application.frameState && shaderFrameMatches(application.frameSnapshot, application)
        ? { existing: { frameSnapshot: { ...application.frameSnapshot!, timeMs }, frameState: { ...application.frameState, timelineTimeMs: timeMs } } } : {}),
    }));
  }

  function applyCapturedShaderFrames(captures: ReadonlyMap<string, CapturedShaderFrame>, timeMs: number) {
    setShaderLayers((current) => current.map((layer) => ({ ...layer, ...captures.get(`canvas-${layer.id}`) })));
    setLayerShaders((current) => Object.fromEntries(Object.entries(current).map(([id, application]) => [
      id, application ? { ...application, ...captures.get(`content-${id}`) } : application,
    ])) as Partial<Record<ContentLayerId, ShaderApplication>>);
    previewTimeRef.current = timeMs;
    setPreviewTimeMs(timeMs);
    setPaused(true);
  }

  function assertCanvasEditsCommitted() {
    assertShaderTimelineReady();
    if (stageRef.current?.closest('.shader-lab-v2')?.querySelector('[data-canvas-preview-pending="true"]')) {
      throw new Error('Finish adjusting the canvas control before saving or exporting its updated appearance.');
    }
  }

  function assertShaderEditsCommitted() {
    if (stageRef.current?.querySelector('[data-shader-frame-editing="true"], [data-live-material-editing="true"]')) {
      throw new Error('Finish editing the shader control before saving or exporting its updated appearance.');
    }
  }

  function commitFocusedCanvasText() {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement) || !focused.matches('[data-canvas-editable]') || !stageRef.current?.contains(focused)) return false;
    flushSync(() => focused.blur());
    return true;
  }

  async function captureCompositionFrame(): Promise<ReturnType<typeof createDesignLabCanvasDocument>> {
    if (commitFocusedCanvasText()) return captureCompositionFrameRef.current();
    assertCanvasEditsCommitted();
    if (sequencePreviewingRef.current) throw new Error('Stop the shader sequence preview before saving or capturing the composition.');
    assertShaderEditsCommitted();
    assertCompositionEffectCaptureReady(effectLayers, visibleLayerIdSet, effectPreviewOverridesRef.current);
    if (exportJobRef.current) throw new Error('Wait for the current export before capturing another shader frame.');
    if (frameCapturePendingRef.current) throw new Error('A shader frame capture is already in progress.');
    const timeMs = paused ? previewTimeMs : previewTimeRef.current;
    const sourceDocument = designLabDocument;
    const signature = compositionSignatureRef.current;
    const sourceSequence = sourceApplySequenceRef.current;
    const artboardId = activeArtboardIdRef.current;
    frameCapturePendingRef.current = true;
    setFrameCapturePending(true);
    let resume: (() => void) | undefined;
    try {
      const operation = beginShaderFrameCapture(shaderCaptureRequests(timeMs), timeMs, { hold: true, previewGroup: 'design-lab' });
      resume = operation.resume;
      const [captures, effectCaptures] = await Promise.all([operation.result, captureCompositionEffectFrames(operation.result)]);
      if (signature !== compositionSignatureRef.current || sourceSequence !== sourceApplySequenceRef.current
        || artboardId !== activeArtboardIdRef.current) {
        throw new Error('The design changed during capture. Capture the updated design again.');
      }
      const shaderDocument = applyShaderFrameCaptures(sourceDocument, captures, {
        activeArtboardId: artboardId,
        timeline: { frame: boundedPreviewFrame, paused: true, timeMs },
      });
      const capturedDocument = applyEffectFrameCaptures(shaderDocument, effectCaptures, artboardId);
      flushSync(() => {
        applyCapturedShaderFrames(captures, timeMs);
        if (effectCaptures.size) setEffectLayers((current) => current.map((layer) => ({
          ...layer,
          frameSnapshot: normalizeShaderFrameSnapshot(capturedDocument.elements[layer.id]?.data.frameSnapshot) ?? layer.frameSnapshot,
        })));
      });
      return capturedDocument;
    } finally {
      resume?.();
      frameCapturePendingRef.current = false;
      setFrameCapturePending(false);
    }
  }

  async function prepareCompositionSource(): Promise<string> {
    return prepareShaderFrameDocumentSource(await captureCompositionFrame());
  }

  async function prepareProjectFile() {
    const document = await captureCompositionFrame();
    const assertFresh = exportFreshnessGuard();
    const file = await prepareDesignLabProjectFile(document, `${identity.name}-design-lab`, undefined, identity);
    assertFresh();
    return file;
  }

  async function prepareDesignVersionSource() {
    const document = await captureCompositionFrame();
    const revision = savedDesignRevisionRef.current;
    return { source: await prepareShaderFrameDocumentSource(document), revision };
  }

  async function saveCurrentShaderFrame() {
    try {
      await captureCompositionFrame();
      setExportError(null);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'The shader frame could not be captured.');
    }
  }

  function assertShaderWorkspaceIdle() {
    if (sequencePreviewingRef.current) throw new Error('Stop the shader sequence preview before opening another design.');
    if (exportJobRef.current || frameCapturePendingRef.current) throw new Error('Wait for the current capture or export before opening another design.');
  }

  async function prepareImportedProjectTypography(source: string) {
    if (!isCanvasDocumentEnvelope(parseSourceObject(source))) return null;
    const document = parseCanvasDocument(source);
    const importedIdentity = designLabProjectIdentity(document);
    await importShaderFrameAssets(document);
    return importedIdentity ? namespaceDesignLabProjectIdentity(importedIdentity, brandIdentity.id) : null;
  }

  async function applyCompositionSource(source: string) {
    assertShaderWorkspaceIdle();
    clearTransientCompositionPreviews();
    const sourceSequence = ++sourceApplySequenceRef.current;
    const parsed = await parseCompositionSource(source);
    const importedTypography = await prepareImportedProjectTypography(source);
    if (sourceSequence !== sourceApplySequenceRef.current) throw new Error('A newer design was opened while frame assets were loading.');

    const nextShaderLayers = restoredShaderLayers(
      parsed.composition.shaderLayers,
      shaderLayers,
      parsed.shaderSequence?.targetLayerId
    );
    const nextEffectLayers = restoredEffectLayers(parsed.composition.effectLayers ?? effectLayers);
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
    const nextTimeMs = Number.isFinite(parsed.timeline?.timeMs)
      ? Math.max(0, parsed.timeline!.timeMs!)
      : nextPreviewFrame * 1_000 / nextExportSettings.fps;
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
      timeline: { frame: nextPreviewFrame, paused: false, timeMs: nextTimeMs },
    };
    const restoredWorkspace = restoreDesignArtboardWorkspace(parsed.workspace, restoredActiveSnapshot);
    const restoredWorkspaceSnapshot = restoredWorkspace.artboards.find(
      ({ id }) => id === restoredWorkspace.activeArtboardId
    )?.snapshot ?? restoredActiveSnapshot;

    const restoredHistorySignature = checkpointAppliedDesignSource(restoredWorkspace.artboards, importedTypography);

    // Opening source updates a set of independently persisted fields. Keep the
    // exact saved artboard authoritative until every live field has reached the
    // same snapshot; otherwise an intermediate render can publish the previous
    // (often centered default-logo) state back into the workspace and autosave.
    pendingArtboardApplyRef.current = {
      id: restoredWorkspace.activeArtboardId,
      signature: artboardSnapshotSignature(restoredWorkspaceSnapshot),
    };
    workspaceArtboardsRef.current = restoredWorkspace.artboards;
    designHistorySignatureRef.current = restoredHistorySignature;
    activeArtboardIdRef.current = restoredWorkspace.activeArtboardId;
    currentArtboardSnapshotRef.current = restoredWorkspaceSnapshot;

    beginShaderTimelineRestore(nextTimeMs, nextShaderLayers, nextLayerShaders);
    setProjectTypography(importedTypography);
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
    previewTimeRef.current = nextTimeMs;
    setPreviewTimeMs(nextTimeMs);
    setPaused(false);
    setSelectedLayerId(null);
    setSelectedCanvasLayerIds([]);
  }

  async function copySetup() {
    try {
      const setup = await prepareCompositionSource();
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
    if (effectCaptureShaderImagesRef.current) {
      const captured = effectCaptureShaderImagesRef.current.get(instanceKey);
      if (!captured) throw new Error('A converter is missing its captured shader input.');
      drawShaderFramePresentation(context, captured.image, captured.presentation, { x: 0, y: 0, width, height });
      return;
    }
    const host = stageRef.current?.querySelector<HTMLElement>(`[data-shader-instance="${instanceKey}"]`);
    const frozenImage = host?.querySelector<HTMLImageElement>('[data-shader-frame-ready="true"] [data-shader-frame-image]');
    // Still exports provide immutable images above. Sampled motion must read
    // the native canvas, even while the previous saved PNG is fading out.
    if (!exportJobRef.current && frozenImage?.complete && frozenImage.naturalWidth) {
      drawShaderFramePresentation(context, frozenImage, normalizeShaderFramePresentation(application.frameSnapshot?.presentation), { x: 0, y: 0, width, height });
      return;
    }
    const liveCanvas = host?.querySelector('canvas');
    if (liveCanvas?.width && liveCanvas.height) {
      drawShaderFramePresentation(context, liveCanvas, readLiveMaterialPresentation(host ?? null), { x: 0, y: 0, width, height });
      return;
    }
    if (exportJobRef.current) throw new Error('A shader frame is not ready for export.');
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

  function transientCompositionPreviewEnabled() {
    return !frameCapturePendingRef.current
      && !exportJobRef.current
      && !effectCaptureShaderImagesRef.current;
  }

  function renderedShaderApplication(
    id: ShaderLayerId | ContentLayerId,
    application: ShaderApplication | undefined
  ) {
    if (!application || !transientCompositionPreviewEnabled()) return application;
    return shaderApplicationPreviewOverridesRef.current.get(id) ?? application;
  }

  function renderedCompositionMediaLayer(layerId: LogoLayerId | AssetLayerId) {
    if (isLogoLayerId(layerId)) {
      const layer = logoLayers.find((candidate) => candidate.id === layerId);
      if (!layer || !transientCompositionPreviewEnabled()) return layer;
      return logoLayerPreviewOverridesRef.current.get(layerId) ?? layer;
    }
    const layer = compositionAssets.find((candidate) => candidate.id === layerId);
    if (!layer || !transientCompositionPreviewEnabled()) return layer;
    return assetLayerPreviewOverridesRef.current.get(layerId) ?? layer;
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
      : renderedShaderApplication(layerId, shaderLayer) ?? shaderLayer;
    const transform = normalizeCanvasLayerTransform(shaderLayer.transform, DEFAULT_LAYER_TRANSFORM);
    const box = outputLayerBox(layerId, transform, width, height);
    context.save();
    context.globalAlpha = renderedShader.opacity;
    context.globalCompositeOperation = renderedShader.blendMode === 'normal'
      ? 'source-over'
      : renderedShader.blendMode;
    if (transform.rotation) rotateContextAboutBox(context, box, transform.rotation);
    context.translate(box.x, box.y);
    paintShaderApplication(context, box.width, box.height, `canvas-${layerId}`, renderedShader);
    context.restore();
  }

  function paintCompositionEffect(
    context: CanvasRenderingContext2D,
    layerId: EffectLayerId,
    width: number,
    height: number,
    onEffectPainted?: (effectId: EffectLayerId, source: HTMLCanvasElement) => void,
    imageEffectOutputs?: ReadonlyMap<EffectLayerId, HTMLCanvasElement>
  ) {
    const effectLayer = effectLayers.find((layer) => layer.id === layerId);
    if (!effectLayer) return;
    const rendered = resolveCompositionEffectPreview(
      effectLayer,
      effectPreviewOverridesRef.current.get(layerId),
      Boolean(effectCaptureShaderImagesRef.current)
    );
    if (effectLayer.settings.effectId) {
      // Image effects run before this compose (resolveImageEffectOutputs).
      // Without an output the layers beneath show unchanged.
      const output = imageEffectOutputs?.get(layerId);
      if (output) {
        context.save();
        context.globalAlpha = Math.min(1, Math.max(0, rendered.opacity));
        context.globalCompositeOperation = 'source-over';
        context.drawImage(output, 0, 0, width, height);
        context.restore();
      }
      onEffectPainted?.(layerId, context.canvas);
      return;
    }
    let scratch = effectScratchRefs.current.get(layerId);
    if (!scratch) {
      scratch = createCompositionEffectScratch() ?? undefined;
      if (scratch) effectScratchRefs.current.set(layerId, scratch);
    }
    applyCompositionEffect(context, width, height, {
      ...rendered.settings,
      cellSize: rendered.settings.cellSize * width / 960,
    }, rendered.opacity, scratch);
    onEffectPainted?.(layerId, context.canvas);
  }

  function paintCompositionImage(
    context: CanvasRenderingContext2D,
    layerId: LogoLayerId | AssetLayerId,
    width: number,
    height: number,
    images: ReadonlyMap<string, HTMLImageElement>
  ) {
    const layer = renderedCompositionMediaLayer(layerId);
    const image = layer ? images.get(layer.id) : null;
    if (!layer || !image) return;
    const box = outputLayerBox(layer.id, layer.transform, width, height);
    const rotation = layer.transform.rotation ?? 0;
    if (!rotation) {
      paintCompositionMedia(context, layer, image, box, true);
      return;
    }
    // Paint unrotated on a canvas with room for the outline and shadow, then
    // turn it: parts beyond the artboard and the shadow turn with the layer,
    // as they do on the canvas.
    const appearance = resolvedLogoAppearance(layer.appearance);
    const pad = Math.ceil(2
      + (appearance.borderEnabled ? appearance.borderWidth : 0)
      + (appearance.shadowEnabled
        ? appearance.shadowBlur * 2 + Math.max(Math.abs(appearance.shadowOffsetX), Math.abs(appearance.shadowOffsetY))
        : 0));
    const local = document.createElement('canvas');
    local.width = Math.max(1, Math.ceil(box.width + pad * 2));
    local.height = Math.max(1, Math.ceil(box.height + pad * 2));
    const localContext = local.getContext('2d');
    if (!localContext) return;
    paintCompositionMedia(localContext, layer, image, { ...box, x: pad, y: pad }, false);
    const blendMode = renderedShaderApplication(layer.id, layerShaders[layer.id])?.blendMode ?? 'normal';
    context.save();
    context.globalCompositeOperation = blendMode === 'normal' ? 'source-over' : blendMode;
    rotateContextAboutBox(context, box, rotation);
    context.drawImage(local, box.x - pad, box.y - pad);
    context.restore();
    local.width = 0;
    local.height = 0;
  }

  /** One image or mark layer at `box`. `blend` applies its shader's blend mode here; a caller that composites later passes false. */
  function paintCompositionMedia(
    context: CanvasRenderingContext2D,
    layer: CompositionLogoLayer | CompositionAsset,
    image: HTMLImageElement,
    box: OutputLayerBox,
    blend: boolean
  ) {
    const isLogo = isLogoLayerId(layer.id);
    const application = renderedShaderApplication(layer.id, layerShaders[layer.id]);
    const appearance = resolvedLogoAppearance(layer.appearance);
    const layerOpacity = layer.opacity ?? 1;
    const stickerFinish = !isLogo && (layer as CompositionAsset).kind === 'sticker'
      ? normalizeStickerFinish((layer as CompositionAsset).stickerFinish)
      : null;
    const imageCrop = !isLogo ? (layer as CompositionAsset).imageCrop : undefined;
    if (!application) {
      const contained = createContainedLayer(
        image,
        box.width,
        box.height,
        isLogo ? (layer as CompositionLogoLayer).color ?? '#FFFFFF' : undefined,
        !isLogo,
        imageCrop
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
      `content-${layer.id}`,
      application
    );
    materialContext.globalCompositeOperation = 'destination-in';
    materialContext.save();
    materialContext.scale(materialLayer.width / box.width, materialLayer.height / box.height);
    if (isLogo) {
      drawContained(
        materialContext,
        image,
        image.naturalWidth || 1,
        image.naturalHeight || 1,
        0,
        0,
        box.width,
        box.height
      );
    } else {
      if (normalizeImageCropSettings(imageCrop).enabled) {
        drawImageCrop(materialContext, image, box.width, box.height, imageCrop);
      } else {
        materialContext.drawImage(image, 0, 0, box.width, box.height);
      }
    }
    materialContext.restore();
    context.save();
    context.globalAlpha = application.opacity;
    if (blend) {
      context.globalCompositeOperation = application.blendMode === 'normal'
        ? 'source-over'
        : application.blendMode;
    }
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
    onEffectPainted?: (effectId: EffectLayerId, source: HTMLCanvasElement) => void,
    imageEffectOutputs?: ReadonlyMap<EffectLayerId, HTMLCanvasElement>
  ) {
    const backgroundPreview = transientCompositionPreviewEnabled()
      ? canvasBackgroundPreviewOverrideRef.current
      : null;
    const renderedDocument = backgroundPreview
      ? {
          ...designLabDocument,
          pages: {
            ...designLabDocument.pages,
            [designLabPage.id]: { ...designLabPage, background: backgroundPreview },
          },
        }
      : designLabDocument;
    return renderCanvasDocumentPage({
      context,
      document: renderedDocument,
      elementIds: frameLayerIds,
      height,
      manageCompositing: false,
      pageId: designLabPage.id,
      renderElement: ({ element }) => {
        const layerId = element.id as CompositionLayerId;
        if (isShaderLayerId(layerId)) return paintCompositionShader(context, layerId, width, height);
        if (isEffectLayerId(layerId)) return paintCompositionEffect(context, layerId, width, height, onEffectPainted, imageEffectOutputs);
        if (isLogoLayerId(layerId) || isAssetLayerId(layerId)) {
          return paintCompositionImage(context, layerId, width, height, images);
        }

      if (isTextLayerId(layerId)) {
        const committedTextLayer = textLayers.find((layer) => layer.id === layerId);
        const textLayer = committedTextLayer && transientCompositionPreviewEnabled()
          ? textLayerPreviewOverridesRef.current.get(layerId) ?? committedTextLayer
          : committedTextLayer;
        if (!textLayer || !textLayer.value) return;
        const transform = resolvedTextTransform(textLayer.transform);
        const box = outputLayerBox(layerId, transform, width, height);
        // The renderer restores the context after each layer.
        if (transform.rotation) rotateContextAboutBox(context, box, transform.rotation);
        return paintDesignLabTextLayer({
          application: renderedShaderApplication(layerId, layerShaders[layerId]),
          box,
          canvasHeight: canvasDimensions.height,
          canvasWidth: canvasDimensions.width,
          context,
          height,
          identity,
          layer: textLayer,
          paintShaderApplication,
          rotation: transform.rotation,
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
    const families = new Set<string>();
    await Promise.all(visibleTextLayers.flatMap((layer) => textStyleSegments(layer.value, layer.runs).map(async (run) => {
      const family = textFontFamily(identity, layer, run.style);
      families.add(family);
      const weight = resolveTextFontWeight(identity, family, run.style.weight ?? layer.weight);
      const style = run.style.fontStyle ?? layer.fontStyle ?? 'normal';
      const faces = await document.fonts.load(
        `${style} ${weight} 64px ${JSON.stringify(family)}`,
        layer.value.slice(run.start, run.end) || 'Ag'
      );
      const isBundledBrandFont = selectableFontAssets(identity).some((font) => (
        font.family === family && (font.style === style || font.style === 'normal')
      ));
      if (isBundledBrandFont && faces.length === 0) {
        throw new Error(`${family} ${weight} could not be loaded for export.`);
      }
    })));
    await prepareCanvasPaintFamilies(selectableFontAssets(identity), families);
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  async function loadCompositionImages(layerIds?: ReadonlySet<string>) {
    const entries = [
      ...logoLayers.map((layer) => ({ layer, svgViewport: false })),
      ...compositionAssets.map((layer) => ({
        layer,
        svgViewport: !normalizeImageCropSettings(layer.imageCrop).enabled,
      })),
    ];
    return new Map(await Promise.all(entries.filter(({ layer }) => !layerIds || layerIds.has(layer.id))
      .map(async ({ layer, svgViewport }) => {
        const box = outputLayerBox(layer.id, layer.transform, canvasDimensions.width, canvasDimensions.height);
        const image = svgViewport
          ? await loadCanvasImageAtViewport(layer.url, box.width, box.height)
          : await loadCanvasImage(layer.url);
        return [layer.id, image] as const;
      })));
  }

  function imageEffectLayer(layerId: CompositionLayerId): (CompositionEffectLayer & { settings: { effectId: DesignLabImageEffectId } }) | null {
    if (!isEffectLayerId(layerId)) return null;
    const layer = effectLayers.find(({ id }) => id === layerId);
    return layer?.settings.effectId ? layer as CompositionEffectLayer & { settings: { effectId: DesignLabImageEffectId } } : null;
  }

  function imageEffectPassesFor(layerIds: readonly CompositionLayerId[]) {
    return planImageEffectPasses(layerIds, (layerId): layerId is EffectLayerId => imageEffectLayer(layerId) !== null);
  }

  function setImageEffectStatus(layerId: EffectLayerId, status: DesignLabImageEffectStatus) {
    const current = imageEffectStatusStore.get();
    if (current.get(layerId) === status) return;
    imageEffectStatusStore.set(new Map(current).set(layerId, status));
  }

  /**
   * Live preview: runs each image effect on the layers beneath it with the
   * preview processors and keeps the outputs, which snapshots reuse. A
   * failure leaves that layer out and records why, so the canvas shows the
   * source and the stage and inspector say what happened. Runs share
   * canvases, so a restarted preview loop queues behind the previous run.
   */
  function resolvePreviewImageEffects({
    composeBeneath,
    height,
    layerIds,
    timeSeconds,
    width,
  }: {
    composeBeneath: (
      context: CanvasRenderingContext2D,
      beneath: readonly CompositionLayerId[],
      resolved: ReadonlyMap<EffectLayerId, HTMLCanvasElement>
    ) => unknown;
    height: number;
    layerIds: readonly CompositionLayerId[];
    timeSeconds: number;
    width: number;
  }) {
    const pool = imageEffectPreviewPoolRef.current ?? createImageEffectProcessorPool();
    imageEffectPreviewPoolRef.current = pool;
    pool.retain(new Map(effectLayers.flatMap(({ id, settings }) => settings.effectId ? [[id, settings.effectId] as const] : [])));
    const source = imageEffectPreviewSourceRef.current ?? document.createElement('canvas');
    imageEffectPreviewSourceRef.current = source;
    const resolve = () => resolveImageEffectOutputs({
      composeBeneath,
      height,
      outputs: imageEffectPreviewOutputsRef.current,
      passes: imageEffectPassesFor(layerIds),
      run: async (layerId, pixels) => {
        const layer = imageEffectLayer(layerId);
        if (!layer) return null;
        if (imageEffectStatusStore.get().get(layer.id) !== 'ready') setImageEffectStatus(layer.id, 'loading');
        try {
          const output = await pool.process(layer.id, layer.settings.effectId, pixels, layer.settings.effectProps ?? {}, timeSeconds, imageEffectPalette);
          setImageEffectStatus(layer.id, 'ready');
          return output;
        } catch (error) {
          setImageEffectStatus(layer.id, imageEffectFailureStatus(error));
          return null;
        }
      },
      source,
      width,
    });
    const result = imageEffectPreviewQueueRef.current.then(resolve);
    imageEffectPreviewQueueRef.current = result.catch(() => undefined);
    return result;
  }

  /**
   * Exports: runs every visible image effect at export size with a fresh
   * processor pool, so effect time starts at zero. Unlike the preview, an
   * effect that cannot render stops the export.
   */
  async function resolveExportImageEffects(
    pool: ImageEffectProcessorPool,
    width: number,
    height: number,
    timeSeconds: number,
    composeBeneath: (
      context: CanvasRenderingContext2D,
      beneath: readonly CompositionLayerId[],
      resolved: ReadonlyMap<EffectLayerId, HTMLCanvasElement>
    ) => unknown,
    layerIds: readonly CompositionLayerId[] = visibleLayerIds
  ): Promise<ReadonlyMap<EffectLayerId, HTMLCanvasElement> | undefined> {
    const passes = imageEffectPassesFor(layerIds);
    if (!passes.length) return undefined;
    return resolveImageEffectOutputs({
      composeBeneath,
      height,
      passes,
      run: async (layerId, pixels) => {
        const layer = imageEffectLayer(layerId);
        if (!layer) return null;
        try {
          return await pool.process(layer.id, layer.settings.effectId, pixels, layer.settings.effectProps ?? {}, timeSeconds, imageEffectPalette);
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'The image effect could not render.';
          throw new Error(`${layer.name}: ${reason} Hide this layer to export without it.`);
        }
      },
      width,
    });
  }

  async function captureCompositionEffectFrames(shaderFrames: Promise<Map<string, CapturedShaderFrame>>): Promise<Map<string, ShaderFrameSnapshot>> {
    const ids = visibleLayerIds.filter(isEffectLayerId);
    if (!ids.length) return new Map();
    const prefix = visibleLayerIds.slice(0, visibleLayerIds.lastIndexOf(ids.at(-1)!) + 1);
    const [images, captures] = await Promise.all([
      loadCompositionImages(new Set(prefix)),
      shaderFrames,
      waitForCompositionFonts(),
      preloadShaderFramePresentation({ grainOpacity: 1 }),
    ]);
    const width = Math.min(640, canvasDimensions.width);
    const height = Math.max(1, Math.round(width * canvasDimensions.height / canvasDimensions.width));
    const buffer = document.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    const context = buffer.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Converter capture is unavailable.');
    try {
      // Snapshots record what the canvas shows: an image effect contributes
      // its last preview output, so saving never waits on the GPU, and an
      // effect that cannot render is left out here as it is on the canvas.
      const statuses = imageEffectStatusStore.get();
      const imageEffectOutputs = new Map([...imageEffectPreviewOutputsRef.current]
        .filter(([layerId]) => statuses.get(layerId) === 'ready' && imageEffectLayer(layerId) !== null));
      let encoding!: Promise<Map<string, ShaderFrameSnapshot>>;
      await withCapturedShaderImages(captures, (shaderImages) => {
        effectCaptureShaderImagesRef.current = shaderImages;
        try {
          // This callback copies every converter synchronously. The override is
          // removed before encoding yields, so live previews never consume it.
          encoding = captureComposedEffectFrames(ids, (copy) => composeFrame(
            context, width, height, images, prefix, copy, imageEffectOutputs
          ));
        } finally {
          effectCaptureShaderImagesRef.current = null;
        }
      });
      return await encoding;
    } finally {
      buffer.width = 0;
      buffer.height = 0;
    }
  }

  const composeFrameRef = useCommittedRef(composeFrame);
  const imageEffectPassesForRef = useCommittedRef(imageEffectPassesFor);
  const resolvePreviewImageEffectsRef = useCommittedRef(resolvePreviewImageEffects);
  const loadCompositionImagesRef = useCommittedRef(loadCompositionImages);
  const lastPreviewEffectIndex = visibleLayerIds.findLastIndex(isEffectLayerId);
  const effectPreviewOrderSignature = lastPreviewEffectIndex < 0
    ? ''
    : visibleLayerIds.slice(0, lastPreviewEffectIndex + 1).join('|');
  const compositionImageSignature = useMemo(() => [
    ...logoLayers.map(({ id, url }) => `${id}:${url}`),
    ...compositionAssets.map(({ id, imageCrop, url, transform }) => {
      const box = outputLayerBox(id, transform, canvasDimensions.width, canvasDimensions.height);
      return `${id}:${canvasImageViewportKey(url, box.width, box.height)}:${JSON.stringify(normalizeImageCropSettings(imageCrop))}`;
    }),
  ].join('|'), [logoLayers, compositionAssets, canvasDimensions.width, canvasDimensions.height]);
  const pausedEffectPreviewSignature = paused ? compositionSignature : '';

  useEffect(() => {
    const activeEffectIds = visibleLayerIds.filter(isEffectLayerId);
    if (!active || activeEffectIds.length === 0) return;

    let animationFrame = 0;
    let cancelled = false;
    let inViewport = true;
    const framePacer = createLiveMaterialFramePacer();
    let rendering = false;
    let previewWidth = Math.min(640, canvasDimensions.width);
    let targetFrameRate = 60;
    let renderDurationTotal = 0;
    let renderSamples = 0;
    let pausedRedraw: ReturnType<typeof observePausedCompositionReadiness> | undefined;
    let sourceRedrawPending = paused;
    let skippedWhileRendering = false;
    const lastEffectIndex = Math.max(...activeEffectIds.map((effectId) => visibleLayerIds.indexOf(effectId)));
    const previewLayerIds = visibleLayerIds.slice(0, lastEffectIndex + 1);
    const requestPausedRedraw = () => {
      sourceRedrawPending = true;
      pausedRedraw?.request();
    };
    const redrawPausedSource = () => {
      if (!paused || !sourceRedrawPending) return;
      // Paper redraws synchronously, so copy it in this same task before
      // Safari clears the default WebGL buffer. Scheduled renderers are picked
      // up by the remaining settling frames below.
      sourceRedrawPending = !requestLiveMaterialRedraw(stageRef.current);
    };
    if (paused) effectPreviewRedrawRef.current = requestPausedRedraw;
    const observer = typeof IntersectionObserver === 'undefined' || !stageRef.current
      ? null
      : new IntersectionObserver(([entry]) => {
          inViewport = entry?.isIntersecting ?? true;
          if (inViewport) pausedRedraw?.request();
        }, { rootMargin: '120px' });
    if (observer && stageRef.current) observer.observe(stageRef.current);

    const previewHeightFor = (width: number) => Math.max(1, Math.round(width * canvasDimensions.height / canvasDimensions.width));
    const paintEffectPreview = (
      images: Map<string, HTMLImageElement>,
      imageEffectOutputs?: ReadonlyMap<EffectLayerId, HTMLCanvasElement>
    ) => {
      const previewHeight = previewHeightFor(previewWidth);
      const buffer = effectPreviewBufferRef.current ?? document.createElement('canvas');
      effectPreviewBufferRef.current = buffer;
      if (buffer.width !== previewWidth) buffer.width = previewWidth;
      if (buffer.height !== previewHeight) buffer.height = previewHeight;
      const context = buffer.getContext('2d', { willReadFrequently: true });
      if (!context) return;
      composeFrameRef.current(
        context,
        previewWidth,
        previewHeight,
        images,
        previewLayerIds,
        (effectId, source) => {
          const canvas = effectCanvasRefs.current.get(effectId);
          if (!canvas) return;
          if (canvas.width !== previewWidth) canvas.width = previewWidth;
          if (canvas.height !== previewHeight) canvas.height = previewHeight;
          const visibleContext = canvas.getContext('2d');
          if (!visibleContext) return;
          visibleContext.clearRect(0, 0, previewWidth, previewHeight);
          visibleContext.drawImage(source, 0, 0);
        },
        imageEffectOutputs
      );
    };
    // Image effects run on the GPU and resolve asynchronously: compose the
    // layers beneath each one, run it, then paint the whole preview. A paused
    // canvas renders again if a settling frame arrived during the run.
    const paintImageEffectPreview = (images: Map<string, HTMLImageElement>) => {
      rendering = true;
      const width = previewWidth;
      const height = previewHeightFor(width);
      void resolvePreviewImageEffectsRef.current({
        composeBeneath: (context, beneath, resolved) => composeFrameRef.current(context, width, height, images, beneath, undefined, resolved),
        height,
        layerIds: previewLayerIds,
        timeSeconds: imageEffectPreviewClockRef.current.seconds,
        width,
      }).then((outputs) => {
        if (!cancelled) paintEffectPreview(images, outputs);
      }).catch(() => {
        // Each effect reports its own failure; a compose error keeps the last frame.
      }).finally(() => {
        rendering = false;
        if (cancelled || !paused || !skippedWhileRendering) return;
        skippedWhileRendering = false;
        paintImageEffectPreview(images);
      });
    };

    void loadCompositionImagesRef.current().then((images) => {
      if (cancelled) return;
      // Converters render synchronously; the measured cost sizes the next frames.
      const paintConverterPreview = () => {
        rendering = true;
        const renderStartedAt = performance.now();
        try {
          paintEffectPreview(images);
        } catch {
          // Safari can expose a shader canvas one paint before it becomes
          // readable. Keep the last good converter frame and retry instead
          // of leaving the preview loop permanently locked.
          if (paused) pausedRedraw?.request();
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
        rendering = false;
      };
      const advanceImageEffectClock = (now: number) => {
        const clock = imageEffectPreviewClockRef.current;
        if (!paused && clock.lastFrameAt) clock.seconds += Math.min(0.25, Math.max(0, (now - clock.lastFrameAt) / 1000));
        clock.lastFrameAt = paused ? 0 : now;
      };
      const tick = (now: number) => {
        if (cancelled) return;
        redrawPausedSource();
        advanceImageEffectClock(now);
        const hasImageEffects = imageEffectPassesForRef.current(previewLayerIds).length > 0;
        if (rendering && paused) skippedWhileRendering = true;
        const frameRate = hasImageEffects ? Math.min(targetFrameRate, IMAGE_EFFECT_PREVIEW_FRAME_RATE) : targetFrameRate;
        const shouldRender = workspaceActiveRef.current
          && projectWorkspaceActiveRef.current
          && inViewport
          && !document.hidden
          && !rendering
          && framePacer.shouldDraw(now, frameRate, paused);
        if (shouldRender && hasImageEffects) paintImageEffectPreview(images);
        else if (shouldRender) paintConverterPreview();
        if (!paused) animationFrame = requestAnimationFrame(tick);
      };
      if (paused && stageRef.current) {
        pausedRedraw = observePausedCompositionReadiness(stageRef.current, tick);
      } else {
        animationFrame = requestAnimationFrame(tick);
      }
    }).catch(() => {
      // Imported image errors should not take down the editable composition.
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      pausedRedraw?.disconnect();
      if (effectPreviewRedrawRef.current === requestPausedRedraw) effectPreviewRedrawRef.current = null;
      cancelAnimationFrame(animationFrame);
    };
  }, [
    canvasDimensions.height,
    canvasDimensions.width,
    active,
    compositionImageSignature,
    composeFrameRef,
    effectPreviewOrderSignature,
    imageEffectPassesForRef,
    loadCompositionImagesRef,
    paused,
    pausedEffectPreviewSignature,
    resolvePreviewImageEffectsRef,
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
        for (const run of layer.runs ?? []) if (run.style.color) colors.push(run.style.color);
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
    if (editingCanvas) { setExportError('Select an artboard to export. Loose canvas layers are saved in your project.'); return null; }
    if (commitFocusedCanvasText()) return exportStillRef.current(format);
    if (exportJobRef.current || frameCapturePendingRef.current) return null;
    exportJobRef.current = true;
    exportFailureRef.current = null;
    setExporting(format);
    setExportError(null);
    studioExport.start(`Rendering ${format.toUpperCase()} preview`);
    try {
      const startedAt = performance.now();
      assertCanvasEditsCommitted();
      if (sequencePreviewingRef.current) throw new Error('Stop the shader sequence preview before exporting the current frame.');
      assertShaderEditsCommitted();
      assertCompositionEffectCaptureReady(effectLayers, visibleLayerIdSet, effectPreviewOverridesRef.current);
      const timeMs = pauseShaderHistory();
      const settingsSignature = compositionSignatureRef.current;
      const assertFresh = exportFreshnessGuard();
      // Re-render every shader at the controlled time, which sizes it for the export.
      await waitForCapturedFrame({ durationMs: 0, index: 0, timeMs: timeMs - previewTimeRef.current });
      assertFresh();
      const capture = beginShaderFrameCapture(shaderCaptureRequests(timeMs), timeMs, { mode: 'transient', previewGroup: 'design-lab' });
      const captures = await capture.result;
      assertFresh();
      await waitForCompositionFonts();
      const output = createExportCanvas();
      const context = output.getContext('2d');
      if (!context) throw new Error('Canvas rendering is unavailable.');
      const images = await loadCompositionImages();
      assertFresh();
      const composeCaptured = (
        target: CanvasRenderingContext2D,
        layerIds: readonly CompositionLayerId[],
        imageEffectOutputs?: ReadonlyMap<EffectLayerId, HTMLCanvasElement>
      ) => withCapturedShaderImages(captures, (shaderImages) => {
        effectCaptureShaderImagesRef.current = shaderImages;
        try {
          composeFrame(target, output.width, output.height, images, layerIds, undefined, imageEffectOutputs);
        } finally {
          effectCaptureShaderImagesRef.current = null;
        }
      });
      const imageEffectPool = createImageEffectProcessorPool();
      try {
        const imageEffectOutputs = await resolveExportImageEffects(
          imageEffectPool,
          output.width,
          output.height,
          timeMs / 1000,
          (target, beneath, resolved) => composeCaptured(target, beneath, resolved)
        );
        assertFresh();
        await composeCaptured(context, visibleLayerIds, imageEffectOutputs);
      } finally {
        imageEffectPool.dispose();
      }
      const quality = normalizedExportSettings.quality === 'fast'
        ? 0.82
        : normalizedExportSettings.quality === 'best'
          ? 0.96
          : 0.9;
      const blob = await canvasToImageBlob(output, format, quality);
      assertFresh();
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
      exportFailureRef.current = error;
      setExportError(error instanceof Error ? error.message : 'The still image could not be exported.');
      return null;
    } finally {
      exportJobRef.current = false;
      setCaptureTimeMs(null);
      setExporting(null);
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
      setCaptureTimeMs(nextSequenceCapture ? frame.timeMs : previewTimeRef.current + frame.timeMs);
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
    await waitForLiveMaterialReady(stageRef.current);
  }

  function exportFreshnessGuard() {
    const signature = compositionSignatureRef.current;
    const sourceSequence = sourceApplySequenceRef.current;
    const artboardId = activeArtboardIdRef.current;
    return () => {
      assertCanvasEditsCommitted();
      assertShaderEditsCommitted();
      assertCompositionEffectCaptureReady(effectLayers, visibleLayerIdSet, effectPreviewOverridesRef.current);
      if (signature !== compositionSignatureRef.current || sourceSequence !== sourceApplySequenceRef.current
        || artboardId !== activeArtboardIdRef.current) throw new Error('The design changed during export. Export the updated design again.');
    };
  }

  function assertMotionIsSeekable(motionMode: DesignMotionMode) {
    if (!compositionCanSeek || (motionMode === 'sequence' && sequenceMaterialIds.some((id) => getShaderMotionCapabilities(id).motionModel === 'stateful'))) {
      throw new Error('Fluid motion needs a live recording, not timestamp sampling. Capture a PNG frame or hide Fluid before exporting a sampled clip.');
    }
  }

  async function exportMotion(format: 'gif' | 'mp4', motionMode: DesignMotionMode = 'standard'): Promise<ExportPreviewAsset | null> {
    if (editingCanvas) { setExportError('Select an artboard to export. Loose canvas layers are saved in your project.'); return null; }
    if (commitFocusedCanvasText()) return exportMotionRef.current(format, motionMode);
    return renderMotionExport(format, motionMode);
  }

  async function renderMotionExport(format: 'gif' | 'mp4', motionMode: DesignMotionMode): Promise<ExportPreviewAsset | null> {
    if (exportJobRef.current || frameCapturePendingRef.current) return null;
    exportFailureRef.current = null;
    if (motionMode === 'sequence' && (!sequenceTargetLayer || shaderSequenceTimeline.length === 0)) {
      setExportError('Add a canvas shader before exporting a shader sequence.');
      return null;
    }
    if (sequencePreviewingRef.current) {
      setExportError('Stop the shader sequence preview before exporting its clip.');
      return null;
    }
    exportJobRef.current = true;
    setExporting(format);
    setExportError(null);
    studioExport.start(`Rendering ${motionMode === 'sequence' ? 'shader sequence ' : ''}${format.toUpperCase()} preview`, 0);
    let disposeImageEffects: (() => void) | null = null;
    try {
      assertMotionIsSeekable(motionMode);
      const startedAt = performance.now();
      assertCanvasEditsCommitted();
      assertShaderEditsCommitted();
      assertCompositionEffectCaptureReady(effectLayers, visibleLayerIdSet, effectPreviewOverridesRef.current);
      pauseShaderHistory();
      const settingsSignature = compositionSignatureRef.current;
      const assertFresh = exportFreshnessGuard();
      await preloadShaderFramePresentation({ grainOpacity: 1 });
      await waitForCompositionFonts();
      const { durationMs, fps, quality } = normalizedExportSettings;
      const resolvedDurationMs = motionMode === 'sequence' ? shaderSequenceDuration : durationMs;
      const output = createExportCanvas();
      const context = output.getContext('2d', { willReadFrequently: format === 'gif' });
      if (!context) throw new Error('Canvas rendering is unavailable.');
      const images = await loadCompositionImages();
      const imageEffectPool = createImageEffectProcessorPool();
      disposeImageEffects = () => imageEffectPool.dispose();
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
        assertFresh();
        // Image effects take this frame's time, so effect motion follows the clip.
        const imageEffectOutputs = await resolveExportImageEffects(
          imageEffectPool,
          output.width,
          output.height,
          frame.timeMs / 1000,
          (target, beneath, resolved) => composeFrame(target, output.width, output.height, images, beneath, undefined, resolved)
        );
        assertFresh();
        composeFrame(context, output.width, output.height, images, visibleLayerIds, undefined, imageEffectOutputs);
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
      assertFresh();
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
      exportFailureRef.current = error;
      setExportError(error instanceof Error ? error.message : `The ${format.toUpperCase()} could not be exported.`);
      return null;
    } finally {
      disposeImageEffects?.();
      exportJobRef.current = false;
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
    if (editingCanvas) throw new Error('Select an artboard to export. Loose canvas layers are saved in your project.');
    assertShaderWorkspaceIdle();
    const motionMode: DesignMotionMode = request.mode === 'shader-sequence' ? 'sequence' : 'standard';
    const asset = request.format === 'png' || request.format === 'jpg'
      ? await exportStill(request.format)
      : await exportMotion(request.format, motionMode);
    if (!asset) throw exportFailureRef.current ?? new Error(`Design Lab could not export ${request.format.toUpperCase()}.`);
    if (request.download) downloadStudioArtifact(asset);
    return asset;
  }

  /** Effect layers on the active artboard, front to back as stacked, with the image effects on offer. */
  function describeEffectLayers() {
    const statuses = imageEffectStatusStore.get();
    return {
      builtIn: COMPOSITION_EFFECT_PRESETS.map(({ description, kind, label }) => ({ description, kind, label })),
      imageEffects: {
        categories: DESIGN_LAB_IMAGE_EFFECT_CATEGORIES,
        effects: DESIGN_LAB_IMAGE_EFFECTS.map(({ category, id, name }) => ({ category, id, name })),
        controls: '/api/materials imageEffects.effects[].nativeControls',
      },
      layers: layerOrder.filter(isEffectLayerId).flatMap((layerId) => {
        const layer = effectLayers.find(({ id }) => id === layerId);
        if (!layer) return [];
        const { effectId, effectProps, kind } = layer.settings;
        return [{
          id: layer.id,
          name: layer.name,
          opacity: layer.opacity,
          visible: layer.visible,
          ...(effectId
            ? { effectId, effectProps: effectProps ?? {}, ...(statuses.get(layer.id) ? { status: statuses.get(layer.id) } : {}) }
            : { kind }),
        }];
      }),
    };
  }

  const designAutomationRef = useCommittedRef({
    layerAction: async (action: string, input: unknown) => {
      assertShaderWorkspaceIdle();
      const request = designLayerActionInput(action, input);
      const surfaceIds = new Set<string>(layerOrder);
      const ids = (request.layerIds ?? []).map((id) => {
        if (!surfaceIds.has(id) || !isCanvasLayerId(id as CompositionLayerId)) throw new TypeError(`${id} is not a text, mark, image or shader layer on the active surface.`);
        return id as CanvasLayerId;
      });
      if (action === 'design.layers.arrange') {
        const unlocked = (ids.length ? ids : selectedCanvasLayerIds).filter((id) => !layerLocked(id));
        if (!arrangeCanvasSelection(request.arrangement!, unlocked)) {
          throw new Error('Choose at least two unlocked layers to align, or three to distribute.');
        }
      } else if (action === 'design.layers.lock') {
        if (ids.length === 0) throw new TypeError('layerIds must list at least one layer.');
        setLayersLocked(ids, request.locked!);
      } else if (action === 'design.layers.rotate') {
        const unlocked = ids.filter((id) => !layerLocked(id));
        if (unlocked.length === 0) throw new Error('Choose at least one unlocked layer to rotate.');
        rotateCanvasLayers(unlocked, request.rotation!);
      } else if (action === 'design.layers.copyStyle') {
        if (!surfaceIds.has(request.layerId!) || !copyLayerStyle(request.layerId as CompositionLayerId)) {
          throw new TypeError('layerId must identify a text, mark, image or shader layer on the active surface.');
        }
        return null;
      } else if (pasteLayerStyle(ids) === 0) {
        throw new Error('Copy a style first, then paste it onto unlocked layers.');
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return null;
    },
    effectAction: async (action: string, input: unknown) => {
      const request = designEffectActionInput(action, input);
      if (action === 'design.effects.describe') return describeEffectLayers();
      assertShaderWorkspaceIdle();
      const target = action === 'design.effects.configure'
        ? effectLayers.find(({ id }) => id === request.layerId && layerOrder.includes(id))
        : undefined;
      if (action === 'design.effects.configure' && !target) throw new TypeError('layerId must identify an Effect layer on the active artboard.');
      const effectId = request.effectId ?? (request.kind ? undefined : target?.settings.effectId);
      if (request.effectProps !== undefined) {
        if (!effectId) throw new TypeError('This Effect layer uses a built-in converter. Set effectId to an image effect before effectProps.');
        const { validateShaderEffectProps } = await loadShaderEffectsProps();
        validateShaderEffectProps(effectId, request.effectProps);
      }
      let layerId = target?.id;
      if (!target) {
        layerId = addEffectLayer(request.kind ?? 'bayer', request.effectId ? { effectId: request.effectId, effectProps: request.effectProps } : undefined) ?? undefined;
        if (!layerId) throw new Error('Effect layers apply to a whole artboard. Activate an artboard first.');
      } else if (request.kind) {
        selectEffectPreset(target, request.kind);
      } else if (request.effectId) {
        selectImageEffect(target, request.effectId, request.effectProps ?? {});
      } else if (request.effectProps !== undefined) {
        updateEffectLayer(target.id, { settings: { ...target.settings, effectProps: request.effectProps } });
      }
      if (request.opacity !== undefined) updateEffectLayer(layerId!, { opacity: request.opacity });
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return { layerId };
    },
    formatText: async (input: unknown) => {
      assertShaderWorkspaceIdle();
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || Object.keys(input).some((key) => !['layerId', 'start', 'end', 'style'].includes(key))) {
        throw new TypeError('design.text.format requires { layerId, start, end, style }.');
      }
      const request = input as { layerId: string; start: number; end: number; style: InlineTextStyle };
      const layer = textLayers.find(({ id }) => id === request.layerId);
      if (!layer) throw new TypeError('layerId must identify a text layer on the active surface.');
      validateTextStyleRuns([{ start: request.start, end: request.end, style: request.style }], layer.value);
      setTextLayers((current) => current.map((text) => text.id === layer.id
        ? { ...text, runs: formatTextRange(text.value, text.runs, request, request.style) } : text));
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      return null;
    },
    workspaceAction: async (action: string, input: unknown) => {
      if (action === 'design.workspace.describe') return {
        activeSurface: editingCanvas ? 'canvas' : activeArtboardId,
        canvas: { layerIds: workspaceArtboards.find(({ id }) => id === DESIGN_CANVAS_ID)?.snapshot.layerOrder ?? [] },
        artboards: outputArtboards.map(({ id, name, x, y, snapshot }) => ({ id, name, x, y, ...snapshot.dimensions, layerIds: snapshot.layerOrder })),
      };
      if (action === 'design.workspace.frameSelection') {
        if (!await frameCanvasSelection()) throw new Error('Select loose canvas layers before framing them.');
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return null;
      }
      const request = designWorkspaceActionInput(input);
      const target = request.target === 'canvas' ? DESIGN_CANVAS_ID : request.target;
      if (typeof target !== 'string' || !workspaceArtboards.some(({ id }) => id === target)) throw new TypeError('Choose canvas or an existing artboard id.');
      if (action === 'design.workspace.activate') {
        if (!await activateSurfaceForApi(target as DesignArtboardId, target !== DESIGN_CANVAS_ID)) throw new Error('The editing surface could not be activated.');
        return null;
      }
      if (action !== 'design.workspace.move') throw new TypeError(`Unknown workspace action: ${action}`);
      if (!Array.isArray(request.layerIds) || !request.layerIds.length || request.layerIds.some((id) => typeof id !== 'string' || !isCanvasLayerId(id as CompositionLayerId) || !layerOrder.includes(id as CompositionLayerId))) {
        throw new TypeError('layerIds must identify movable layers on the active surface.');
      }
      if (request.placement !== undefined && request.placement !== 'preserve' && request.placement !== 'beside') throw new TypeError('placement must be preserve or beside.');
      if (!await moveLayersToSurface(target as DesignArtboardId, [...new Set(request.layerIds)] as CanvasLayerId[], request.placement === 'beside')) throw new Error('The layers could not be moved.');
      // The destination becomes the active surface; resolve once it is shown.
      await surfaceShown(target as DesignArtboardId);
      return null;
    },
    applyCompositionSource,
    compositionSetupSource,
    prepareCompositionSource,
    prepareProjectFile,
    pauseShaderHistory: () => { assertShaderWorkspaceIdle(); pauseShaderHistory(); },
    playShaderHistory: () => { assertShaderWorkspaceIdle(); assertShaderTimelineReady(); playShaderHistory(); },
    seekShaderTime,
    describeShaderMotion: () => ({
      timeMs: paused ? previewTimeMs : previewTimeRef.current,
      paused,
      layers: shaderCaptureRequests(paused ? previewTimeMs : previewTimeRef.current).map(({ key }) => {
        const application = key.startsWith('canvas-')
          ? shaderLayers.find(({ id }) => `canvas-${id}` === key)
          : layerShaders[key.slice('content-'.length) as ContentLayerId];
        return { layerId: key.slice(key.indexOf('-') + 1), ...getShaderMotionCapabilities(application!.materialId) };
      }),
    }),
    exportForAutomation,
    normalizedShaderSequenceSettings,
    previewShaderSequence: () => { assertShaderWorkspaceIdle(); assertMotionIsSeekable('sequence'); previewShaderSequence(); },
    isSequencePreviewing: () => sequencePreviewingRef.current,
    shaderSequenceDuration,
    shaderSequenceTimeline,
    stopShaderSequencePreview,
    updateShaderSequenceSettings,
  });

  useEffect(() => registerStudioAutomation({
    actions: studioToolActionNames('material'),
    applySource: async (source) => {
      await autosaveLoaded();
      return designAutomationRef.current.applyCompositionSource(source);
    },
    getSource: () => {
      const source = designAutomationRef.current.compositionSetupSource();
      if (source === null) throw new Error('Portable composition code is still being prepared.');
      return source;
    },
    invoke: async (action, input) => {
      await autosaveLoaded();
      return invokeDesignAutomationAction(designAutomationRef.current, action, input);
    },
    toolId: automationToolId ?? tool.id,
  }, studioRootRef.current), [automationToolId, designAutomationRef, tool.id]);

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

  const stageActions = useStableHandlers<DesignLabStageActions>({
    deselectCanvasLayers,
    rotateCanvasLayer: (layerId, rotation) => rotateCanvasLayers([layerId], rotation),
    finishLayerMove,
    formatSelectedTextShortcut,
    openCanvasSelectionMenu,
    previewAssetCrop: (layerId, imageCrop) => {
      previewStageLayerCrop(stageRef.current, layerId, imageCrop);
      previewSelectedAssetLayer({ imageCrop });
    },
    registerEffectCanvas: (layerId, canvas) => {
      if (canvas) effectCanvasRefs.current.set(layerId, canvas);
      else effectCanvasRefs.current.delete(layerId);
    },
    rememberTextSelection,
    selectCanvasAssembly,
    setImageCropEditing,
    undoRedo: (redo) => redo ? redoDesignCanvas() : undoDesignCanvas(),
    updateAssetCrop: (layerId, imageCrop) => updateAssetLayer(layerId, { imageCrop }),
    updateCanvasLayerTransform,
    updateTextLayer,
  });
  const artboardActions = useStableHandlers<DesignLabArtboardActions>({
    activateArtboard,
    beginArtboardMove,
    deselectCanvasLayers,
    nudgeArtboard: (event, artboard) => void nudgeArtboard(event, artboard),
    openArtboardMenu: (artboardId, position) => setArtboardMenu({ artboardId, position }),
    queueArtboardLayer: (artboardId, layerId) => {
      pendingArtboardLayerRef.current = layerId ? { artboardId, layerId } : null;
    },
  });
  const restoreReadyHandlers = useStableHandlers({ finishShaderTimelineRestore });
  const exportPixelCount = exportDimensions.width * exportDimensions.height;
  const liveMaterialState = useMemo<DesignLabLiveMaterialState>(() => ({
    active,
    captureTimeMs,
    defaultLoopDurationMs: DEFAULT_EXPORT_SETTINGS.durationMs,
    exportPixelCount,
    imageEffectStatusStore,
    livePreviewPixelBudget,
    livePreviewRuntimeReady,
    onRestoreReady: restoreReadyHandlers.finishShaderTimelineRestore,
    paused,
    previewCaptureTimeMs,
    sequenceCapture,
    sequencePreviewing,
    shaderTimelineRestore,
    shaderTimelineRestoring,
  }), [active, captureTimeMs, exportPixelCount, imageEffectStatusStore, livePreviewPixelBudget, livePreviewRuntimeReady, paused,
    previewCaptureTimeMs, restoreReadyHandlers, sequenceCapture, sequencePreviewing, shaderTimelineRestore, shaderTimelineRestoring]);

  function renderShaderLibrary() {
    return (
      <StudioSidebar className='shader-lab-v2-library' kind='library' label='Shader library' scrollRef={materialLibraryRef} side='left' storageKey='design-lab-library'>
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
              {option.label}<span>{shaderLabCategoryCount(option.id, materialSource, materialKind)}</span>
            </button>
          ))}
        </div>
        <ShaderLibraryFilters
          className='mx-3'
          kind={materialKind}
          onKindChange={(kind) => {
            setVisibleMaterialCount(SHADER_LIBRARY_INITIAL_CARD_COUNT);
            setMaterialKind(kind);
          }}
          onSourceChange={(source) => {
            setVisibleMaterialCount(SHADER_LIBRARY_INITIAL_CARD_COUNT);
            setMaterialSource(source);
          }}
          source={materialSource}
        />
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
      </StudioSidebar>
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

  function renderArtboard(artboard: DesignArtboard) {
    if (artboard.id === DESIGN_CANVAS_ID) return renderLooseCanvas(artboard);
    const selected = artboard.id === activeArtboardId;
    const pending = pendingArtboardApplyRef.current;
    const selectedReady = selected && (
      !pending
      || (pending.id === artboard.id && pending.signature === currentArtboardSignature)
    );
    return (
      <DesignLabArtboardFrame
        actions={artboardActions}
        active={active}
        announcement={selectedReady ? canvasSelectionAnnouncement(selectedCanvasLayerIds.length, selectedCanvasGroup?.name) : undefined}
        artboard={artboard}
        defaultLoopDurationMs={DEFAULT_EXPORT_SETTINGS.durationMs}
        exportDurationMs={normalizedExportSettings.durationMs}
        exportFps={normalizedExportSettings.fps}
        identity={identity}
        key={artboard.id}
        materialId={selectedReady ? sequenceCapture?.materialId ?? editingShader?.materialId : undefined}
        selected={selected}
        selectedReady={selectedReady}
        snapshot={selectedReady ? currentArtboardSnapshot : artboard.snapshot}
        stageRef={selectedReady ? stageRef : undefined}
      >
        {selectedReady ? visibleLayerIds.map(renderStageLayer) : null}
      </DesignLabArtboardFrame>
    );
  }

  function renderLooseCanvas(surface: DesignArtboard) {
    const ready = editingCanvas && activeArtboardSnapshotReady;
    const snapshot = ready ? currentArtboardSnapshot : surface.snapshot;
    const size = designArtboardDisplaySize(snapshot.dimensions);
    const layers = [...snapshot.assets, ...snapshot.logos, ...snapshot.textLayers, ...snapshot.shaderLayers];
    const looseCaptureTimeMs = surface.snapshot.timeline.timeMs ?? resolveMotionFrame(
      normalizedExportSettings.durationMs,
      normalizedExportSettings.fps,
      surface.snapshot.timeline.frame
    ).timeMs;
    return <div className='design-loose-canvas' key={surface.id} style={{ left: surface.x, top: surface.y, ...size }}>
      <div className='shader-lab-v2-stage design-loose-stage' data-canvas-surface='canvas'
        data-testid={ready ? 'shader-lab-live-stage' : undefined}
        ref={ready ? stageRef : undefined}>
        {ready ? visibleLayerIds.map(renderStageLayer) : snapshot.layerOrder.map((id, index) => {
          const layer = layers.find((layer) => layer.id === id);
          const box = layer ? designLayerWorldBounds(surface, layer) : { x: 0, y: 0, ...size };
          return <CanvasRenderBoundary key={id} bounds={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
            {() => <DesignLabArtboardPreviewLayer active={active} artboard={surface} captureTimeMs={looseCaptureTimeMs}
              defaultLoopDurationMs={DEFAULT_EXPORT_SETTINGS.durationMs} identity={identity} index={index} layerId={id} />}
          </CanvasRenderBoundary>;
        })}
        {layers.filter(({ visible }) => visible).map((layer, index) => {
          const box = designLayerWorldBounds(surface, layer);
          const style = { left: box.x - surface.x, top: box.y - surface.y, width: box.width, height: box.height, zIndex: 1000 + index };
          return ready ? <span key={layer.id} className='design-loose-fit-marker' data-canvas-fit-target='true'
            data-canvas-focus-target={index === 0 ? 'true' : undefined} style={style} />
            : <button aria-label={`Select ${layer.name} on canvas`} className='design-loose-hit-target' data-canvas-fit-target='true'
              data-canvas-interactive key={layer.id} style={style} type='button' onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                pendingArtboardLayerRef.current = { artboardId: DESIGN_CANVAS_ID, layerId: layer.id };
                void activateArtboard(DESIGN_CANVAS_ID);
              }} />;
        })}
        {layers.length === 0 && ready ? <span className='design-loose-fit-marker' data-canvas-focus-target='true' style={{ width: size.width, height: size.height }} /> : null}
      </div>
    </div>;
  }

  function renderStageLayer(layerId: CompositionLayerId, index: number) {
    const layer = stageLayerById.get(layerId);
    if (!layer) return null;
    return (
      <DesignLabStageLayer
        actions={stageActions}
        application={isContentLayerId(layerId) ? layerShaders[layerId] : undefined}
        canvasDimensions={canvasDimensions}
        cropEditing={cropEditingLayerId === layerId}
        identity={identity}
        index={index}
        key={layerId}
        layer={layer}
        liveState={liveMaterialState}
        movementBounds={isCanvasLayerId(layerId) ? movementBoundsFor(layerId) : null}
        selected={isCanvasLayerId(layerId) && selectedCanvasLayerIdSet.has(layerId)}
        showSelectionControls={selectedCanvasLayerIds.length <= 1}
        snapTargets={artboardThirdsSnapTargets}
      />
    );
  }

  const layerRowActions = useStableHandlers<DesignLabLayerRowActions>({
    duplicateLayer: (id) => void duplicateLayer(id),
    moveLayer,
    openCanvasSelectionMenu,
    openLayerMenu: (layerId, position) => setLayerDockMenu({ layerId, position }),
    removeLayer,
    selectLayerFromStack,
    toggleLayerLock,
    toggleLayerVisibility,
    updateTextValue: (id, value) => updateTextLayer(id, { value }),
  });

  function layerRowProps(layerId: CompositionLayerId, index: number): (DesignLabLayerRowProps & { key: string }) | null {
    const layer = stageLayerById.get(layerId);
    if (!layer) return null;
    const orderIndex = layerOrder.indexOf(layerId);
    return {
      actions: layerRowActions,
      appliedShader: isShaderLayerId(layerId) ? layer as CompositionShaderLayer : isContentLayerId(layerId) ? layerShaders[layerId] ?? null : null,
      canMoveBackward: orderIndex !== 0,
      canMoveForward: orderIndex !== layerOrder.length - 1,
      groupName: isCanvasLayerId(layerId) ? groupForLayer(layerId)?.name : undefined,
      identity,
      index,
      key: layerId,
      kind: resolvedLayerKind(layerId),
      label: layerLabel(layerId),
      layer,
      lazy: listedLayerIds.length >= DESIGN_LAB_LONG_LAYER_LIST,
      locked: isCanvasLayerId(layerId) ? layerLocked(layerId) : undefined,
      selected: selectedLayerId === layerId || (isCanvasLayerId(layerId) && selectedCanvasLayerIdSet.has(layerId)),
      visible: layerVisible(layerId),
    };
  }

  function renderDockLayer(layerId: CompositionLayerId, index: number) {
    const props = layerRowProps(layerId, index);
    if (!props) return null;
    const { key, ...rowProps } = props;
    return <DesignLabDockLayer key={key} {...rowProps} />;
  }

  function renderInspectorLayer(layerId: CompositionLayerId, index: number) {
    const props = layerRowProps(layerId, index);
    if (!props) return null;
    const { key, ...rowProps } = props;
    return <DesignLabInspectorLayer key={key} {...rowProps} />;
  }

  const inspectorActions = useStableHandlers<DesignLabInspectorActions>({
    activateArtboard: (id) => {
      deselectCanvasLayers();
      void activateArtboard(id as DesignArtboardId, true);
    },
    addArtboard: (duplicate) => void addArtboard(duplicate),
    addBrandMarkLayer: () => addBrandMarkLayer(),
    addCanvasShader: () => addCanvasShader(),
    addEffectLayer: () => addEffectLayer(),
    addTextLayer: () => addTextLayer(),
    arrangeArtboards: () => arrangeArtboards(),
    clearTextRange,
    copySetup: () => void copySetup(),
    openImageImport: (placementMode) => openImageImport([], placementMode),
    previewCanvasBackground,
    previewEffectLayer,
    previewSelectedContentOpacity,
    previewSelectedImageCrop,
    previewSelectedLogoAppearance,
    previewSelectedShaderOpacity,
    previewSelectedShaderSetting,
    previewSelectedShaderSize,
    previewSelectedStickerFinish,
    previewSelectedTextAppearance,
    previewSelectedTextLayer,
    previewSelectedTextWidth,
    rememberTextSelection,
    removeActiveArtboard: () => removeActiveArtboard(),
    removeShaderFromSelectedContent: () => removeShadersFromContent(shaderEditTargets().filter(isContentLayerId)),
    resetSelectedShader,
    renameActiveArtboard,
    resetAssetTransform: (id) => updateAssetTransform(id, DEFAULT_LAYER_TRANSFORM),
    resetLogoTransform: (id) => updateLogoTransform(id, DEFAULT_LAYER_TRANSFORM),
    selectConvertedLogo,
    selectEffectPreset,
    selectImageEffect: (layer, effectId) => selectImageEffect(layer, effectId),
    setImageCropAspect: (id, value) => void setImageCropAspect(id, value),
    setImageCropEditing,
    toggleWorkspaceTour: () => setWorkspaceTourOpen((value) => !value),
    updateActiveArtboardDimensions,
    updateAssetLayer: editAssetSelection,
    updateCanvasBackground,
    updateCanvasLayerTransform: updateSelectionFrame,
    rotateCanvasLayer: (id, rotation) => rotateCanvasLayers(selectedCanvasLayerIds.includes(id) ? selectedCanvasLayerIds : [id], rotation),
    updateEffectLayer,
    updateLogoLayer: editLogoSelection,
    updateSelectedShader,
    updateSetting,
    updateTextFormatting: (id, edit) => editTextSelection(id, edit, true),
    updateTextLayer: (id, edit) => editTextSelection(id, edit, false),
  });
  const inspectorComposition = useMemo(() => ({
    effectCount: effectLayers.length,
    listedLayerCount: listedLayerIds.length,
    logoCount: logoLayers.length,
    placedImageCount: compositionAssets.filter(({ kind }) => kind !== 'sticker').length,
    savedAssetCount: identity.assets.length + identity.proofAssets.length,
    shaderCount: shaderLayers.length,
    stickerCount: compositionAssets.filter(({ kind }) => kind === 'sticker').length + textLayers.filter(({ kind }) => kind === 'sticker').length,
    textCount: textLayers.filter(({ kind }) => kind !== 'sticker').length,
    visibleLayerCount: visibleLayerIds.length,
    visibleShaderCount: shaderLayers.filter(({ visible }) => visible).length,
  }), [compositionAssets, effectLayers.length, identity.assets.length, identity.proofAssets.length, listedLayerIds.length,
    logoLayers.length, shaderLayers, textLayers, visibleLayerIds.length]);
  const inspectorArtboardsSignature = outputArtboards.map(({ id, name, snapshot }) => (
    `${id}\u0000${name}\u0000${snapshot.dimensions.width}x${snapshot.dimensions.height}\u0000${snapshot.layerOrder.length}`
  )).join('\u0001');
  const inspectorArtboards = useMemo<DesignLabInspectorArtboard[]>(() => outputArtboards.map((artboard) => ({
    id: artboard.id,
    layerCount: artboard.snapshot.layerOrder.length,
    name: resolvedDesignArtboardName(artboard.name),
    sizeLabel: studioArtboardPresetForSize(artboard.snapshot.dimensions.width, artboard.snapshot.dimensions.height)?.label ?? 'Custom',
  // The signature covers every displayed field; the artboard list changes with each edit.
  })), [inspectorArtboardsSignature]);
  const inspectorLayerRows = useMemo(
    () => [...listedLayerIds].reverse().map(renderInspectorLayer),
    // renderInspectorLayer reads only these values and stable row actions.
    [hiddenLayerKey, identity, layerGroupByLayerId, layerOrder, layerShaders, listedLayerKey, selectedCanvasLayerIdSet, selectedLayerId, stageLayerById]
  );
  const convertedAssets = useMemo(() => convertedAssetLibrary, [
    convertedAssetLibrary.assets,
    convertedAssetLibrary.busy,
    convertedAssetLibrary.error,
  ]);

  function renderCanvasSelectionMenu() {
    const selectedAssetId = selectedAsset?.id;
    const cropEditing = Boolean(selectedAssetId && cropEditingLayerId === selectedAssetId);
    return (
      <CanvasSelectionMenu
        canCrop={selectedCanvasLayerIds.length === 1 && Boolean(selectedAssetId)}
        canGroup={selectedCanvasLayerIds.length > 1 && !selectedCanvasGroup}
        canUngroup={selectedGroupedAssemblies.length > 0}
        count={selectedCanvasLayerIds.length}
        cropEditing={cropEditing}
        groupName={selectedCanvasGroup?.name}
        placementSection={{ label: 'Move to', items: [
          ...(editingCanvas ? [{ id: 'frame-selection', icon: <Frame aria-hidden='true' />, label: 'Frame selection', onSelect: () => void frameCanvasSelection() }] : []),
          ...(!editingCanvas ? [{ id: 'move-to-canvas', icon: <Move aria-hidden='true' />, label: 'Move to canvas', onSelect: () => void moveLayersToSurface(DESIGN_CANVAS_ID, selectedCanvasLayerIds, true) }] : []),
          ...outputArtboards.filter(({ id }) => id !== activeArtboardId).map((board) => ({
            id: `move-to-${board.id}`, icon: <Frame aria-hidden='true' />, label: board.name,
            onSelect: () => void moveLayersToSurface(board.id),
          })),
        ] }}
        arrangeUnitCount={selectionUnits().length}
        onAlign={alignCanvasAssembly}
        onArrange={(arrangement) => { arrangeCanvasSelection(arrangement); }}
        onBringForward={() => moveCanvasSelection(1)}
        onBringToFront={() => moveCanvasSelectionToEdge('front')}
        onClose={() => setSelectionMenuPosition(null)}
        canPasteStyle={Boolean(styleClipboardRef.current)}
        onCopy={() => void copyDesignLabSelectionFromMenu()}
        onCopyStyle={() => { copyLayerStyle(); }}
        onPasteStyle={() => { pasteLayerStyle(); }}
        onToggleLock={toggleSelectionLock}
        onCrop={selectedAssetId ? () => setImageCropEditing(selectedAssetId, !cropEditing) : undefined}
        onCut={() => void cutDesignLabSelectionFromMenu(removeCanvasSelection)}
        onDelete={removeCanvasSelection}
        onDuplicate={duplicateCanvasSelection}
        onGroup={groupCanvasSelection}
        onPaste={() => void pasteDesignLabSelectionFromMenu()}
        onResetCrop={selectedAssetId ? () => resetImageCrop(selectedAssetId) : undefined}
        onSelectAll={selectAllCanvasLayers}
        onSendBackward={() => moveCanvasSelection(-1)}
        onSendToBack={() => moveCanvasSelectionToEdge('back')}
        onToggleVisibility={() => {
          const visible = selectedCanvasLayerIds.every(layerVisible);
          setLayersVisibility(selectedCanvasLayerIds, !visible);
        }}
        onUngroup={ungroupCanvasSelection}
        position={selectionMenuPosition}
        selectionVisible={selectedCanvasLayerIds.every(layerVisible)}
      />
    );
  }

  const headerActions = useStableHandlers<DesignLabHeaderActions>({
    applyCompositionSource,
    dismissExportError: () => setExportError(null),
    exportPng: () => void exportStill('png'),
    openSource: () => setSourceOpen(true),
    prepareProjectFile,
    previewExportFormat,
    refreshExportPreview,
    updateExportSettings,
  });
  const artboardToolbarActions = useStableHandlers<DesignLabArtboardToolbarActions>({
    addArtboard: (duplicate) => void addArtboard(duplicate),
    editLooseCanvas: () => {
      deselectCanvasLayers();
      void activateArtboard(DESIGN_CANVAS_ID);
    },
    frameCanvasSelection: () => void frameCanvasSelection(),
    removeActiveArtboard: () => removeActiveArtboard(),
    renameActiveArtboard,
    selectArtboardFromPicker: (id) => selectArtboardFromPicker(id as DesignArtboardId),
    toggleWorkspaceTour: () => setWorkspaceTourOpen((value) => !value),
    updateActiveArtboardDimensions,
  });
  const motionActions = useStableHandlers<DesignLabMotionStripActions>({
    beginShaderTimeScrub,
    closeMotionWorkspace: () => setMotionWorkspaceOpen(false),
    exportShaderSequence: () => void exportMotion('mp4', 'sequence'),
    freezeCurrentShaderFrame,
    playShaderHistory,
    previewShaderSequence,
    previewTime: (timeMs) => {
      previewLiveMaterialTime('design-lab', timeMs);
      effectPreviewRedrawRef.current?.();
    },
    rememberLiveTime: (timeMs) => { previewTimeRef.current = timeMs; },
    saveCurrentShaderFrame: () => void saveCurrentShaderFrame(),
    seekShaderTime,
    shuffleShaderSequence: () => updateShaderSequenceSettings({ sequenceOffset: normalizedShaderSequenceSettings.sequenceOffset + 1 }),
    toggleMotionWorkspace: () => setMotionWorkspaceOpen((value) => !value),
    updateShaderSequenceSettings,
  });
  const dockActions = useStableHandlers<DesignLabLayerDockActions>({
    addBrandMarkLayer: () => addBrandMarkLayer(),
    addCanvasShader: () => addCanvasShader(),
    addEffectLayer: () => addEffectLayer(),
    addLogoFiles: (files) => void addLogoFiles(files),
    addTextLayer: () => addTextLayer(),
    openImageImport: (files, placementMode) => openImageImport(files, placementMode),
  });
  const viewportActions = useStableHandlers({
    arrangeArtboards: () => arrangeArtboards(),
    backgroundClick: (point: { x: number; y: number }) => { void activateCanvasAtPoint(point); },
    deselectCanvasLayers: () => deselectCanvasLayers(),
  });
  const dockLayerRows = useMemo(
    () => [...listedLayerIds].reverse().map(renderDockLayer),
    // renderDockLayer reads only these values and stable row actions.
    [hiddenLayerKey, identity, layerGroupByLayerId, layerOrder, layerShaders, listedLayerKey, selectedCanvasLayerIdSet, selectedLayerId, stageLayerById]
  );
  const artboardNamesSignature = workspaceArtboards.map(({ id, name }) => `${id}\u0000${name}`).join('\u0001');
  const artboardPickerOptions = useMemo(
    () => workspaceArtboards.map(({ id, name }) => ({ id, name })),
    // The signature covers every field the picker shows.
    [artboardNamesSignature]
  );
  const artboardSummary = `${layerOrder.length} layer${layerOrder.length === 1 ? '' : 's'} · ${outputArtboards.length} artboard${outputArtboards.length === 1 ? '' : 's'}`;
  const toggleShortcuts = useCallback(() => setShortcutsOpen((open) => !open), []);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);
  const previewQualityToggle = useMemo(() => (
    <>
      <span className='canvas-toolbar-divider' />
      <DesignLabPreviewQualityToggle
        automaticallyReduced={previewQuality.automaticallyReduced}
        mode={previewQuality.mode}
        quality={previewQuality.quality}
      />
      <DesignLabShortcutsButton onToggle={toggleShortcuts} open={shortcutsOpen} />
    </>
  ), [previewQuality.automaticallyReduced, previewQuality.mode, previewQuality.quality, shortcutsOpen, toggleShortcuts]);
  const navigationItems = useMemo(() => workspaceArtboards.flatMap((artboard) => artboard.id === DESIGN_CANVAS_ID
    ? [...artboard.snapshot.assets, ...artboard.snapshot.logos, ...artboard.snapshot.textLayers, ...artboard.snapshot.shaderLayers]
      .filter(({ visible }) => visible).map((layer) => ({ id: `canvas-${layer.id}`, label: layer.name,
        ...designLayerWorldBounds(artboard, layer), active: editingCanvas && selectedCanvasLayerIds.includes(layer.id) }))
    : [{
    id: artboard.id,
    label: artboard.name,
    x: artboard.x,
    y: artboard.y,
    ...designArtboardDisplaySize(artboard.snapshot.dimensions, artboard.displayScale),
    active: artboard.id === activeArtboardId,
  }]), [activeArtboardId, editingCanvas, selectedCanvasLayerIds, workspaceArtboards]);
  const imageAssetLibrary = useMemo(
    () => [...identity.assets, ...identity.proofAssets],
    [identity.assets, identity.proofAssets]
  );

  function renderMotionStrip() {
    return (
      <DesignLabMotionStrip
        actions={motionActions}
        busy={frameCapturePending || Boolean(exporting) || sequencePreviewing || shaderTimelineRestoring}
        canSeek={compositionCanSeek && compositionHasMotion}
        capabilities={explorerCapabilities}
        exporting={Boolean(exporting)}
        motionWorkspaceOpen={motionWorkspaceOpen}
        playing={active && !paused && captureTimeMs === null}
        sequenceDurationMs={shaderSequenceDuration}
        sequenceMaterialIds={sequenceMaterialIds}
        sequencePreviewing={sequencePreviewing}
        sequenceSettings={normalizedShaderSequenceSettings}
        sequenceTargetOptions={sequenceTargetOptions}
        timeMs={previewTimeMs}
      />
    );
  }

  function renderWorkspaceMenus() {
    return (
      <>
        {artboardMenu ? <DesignArtboardContextMenu
          activeArtboardId={activeArtboardId}
          artboards={workspaceArtboards}
          menu={artboardMenu}
          onArrange={arrangeArtboards}
          onClose={() => setArtboardMenu(null)}
          onCopy={() => {
            deselectCanvasLayers();
            void copyDesignLabSelectionFromMenu(true);
          }}
          onDelete={removeActiveArtboard}
          onDuplicate={() => addArtboard(true)}
          onFocus={(id) => activateArtboard(id, true)}
          onNew={() => addArtboard(false)}
          onPaste={() => void pasteDesignLabSelectionFromMenu()}
        /> : null}
        {layerDockMenu ? <LayerDockContextMenu
          canPasteStyle={Boolean(styleClipboardRef.current)}
          layerKind={resolvedLayerKind}
          layerLabel={layerLabel}
          layerLocked={layerLocked}
          layerOrder={layerOrder}
          layerVisible={layerVisible}
          menu={layerDockMenu}
          onClose={() => setLayerDockMenu(null)}
          onCopy={(id) => {
            selectLayerFromStack(id);
            void copyDesignLabSelectionFromMenu(false, [id]);
          }}
          onCopyStyle={(id) => { copyLayerStyle(id); }}
          onCut={(id) => {
            selectLayerFromStack(id);
            void cutDesignLabSelectionFromMenu(() => removeLayer(id), [id]);
          }}
          onPasteStyle={(id) => { pasteLayerStyle([id]); }}
          onToggleLock={toggleLayerLock}
          onDelete={removeLayer}
          onDuplicate={duplicateLayer}
          onMove={moveLayer}
          onMoveToEdge={moveLayerToEdge}
          onPaste={() => void pasteDesignLabSelectionFromMenu()}
          onToggleVisibility={toggleLayerVisibility}
        /> : null}
        {selectedCanvasLayerIds.length > 1 && selectedCanvasBounds ? (
          <CanvasSelectionAssemblyOverlay
            bounds={selectedCanvasBounds}
            canvasHeight={canvasDimensions.height}
            canvasWidth={canvasDimensions.width}
            label={selectedCanvasGroup?.name ?? `${selectedCanvasLayerIds.length} layers`}
            stageRef={stageRef}
          />
        ) : null}
        {selectionMenuPosition ? renderCanvasSelectionMenu() : null}
      </>
    );
  }

  function renderStudioDialogs() {
    return (
      <>
        {renderSourceEditor()}
        {imageImportOpen ? <ImageAssetModal
          assets={imageAssetLibrary}
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
          onDelete={deleteSavedAsset}
          onImport={importAndSaveImages}
          onPlace={placeSavedAsset}
          open={imageImportOpen}
          placementMode={imagePlacementMode}
          request={imageImportRequest}
        /> : null}
      </>
    );
  }

  function renderStudio() {
    return (
    <div
      className='shader-lab-v2 tool-shell h-full min-h-0'
      onKeyDownCapture={beginCanvasHistoryKey}
      onPointerDownCapture={beginCanvasHistoryPointer}
      onPointerEnter={() => { pointerInEditorRef.current = true; }}
      onPointerLeave={() => { pointerInEditorRef.current = false; }}
      ref={studioRootRef}
    >
      <DesignLabHeader
        actions={headerActions}
        currentExportSettingsSignature={lastExport ? currentExportSettingsSignature : ''}
        exportError={exportError}
        exporting={exporting}
        frameCapturePending={frameCapturePending}
        lastExport={lastExport}
        lastExportFormat={lastExportRequest?.format ?? null}
        navigation={navigation}
        normalizedExportSettings={normalizedExportSettings}
        previewNeedsRefresh={previewNeedsRefresh}
        ratioOption={ratioOption}
        sourceAvailable={portableDesignLab.source !== null}
        title={tool.name}
        toolId={tool.id}
      />
      {projectTypography?.id === identity.id ? <BrandFontFaces identity={identity} /> : null}

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
          <DesignLabArtboardToolbar
            actions={artboardToolbarActions}
            activeArtboardId={activeArtboardId}
            artboards={artboardPickerOptions}
            canFrameSelection={editingCanvas && selectedCanvasLayerIds.length > 0}
            canvasDimensions={canvasDimensions}
            editingCanvas={editingCanvas}
            statusStore={canvasStatusStore}
            summary={artboardSummary}
            workspaceTourOpen={workspaceTourOpen}
          />
          {shortcutsOpen ? <DesignLabShortcutsPanel onClose={closeShortcuts} /> : null}
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
            toolbarActions={previewQualityToggle}
            draftKey='shader-lab-v6-workspace-zoom'
            fitKey={workspaceFitRevision}
            focusKey={artboardFocusRequest ? `${artboardFocusRequest.id}:${artboardFocusRequest.revision}` : undefined}
            focusOffsetY={16}
            identityId={identity.id}
            initialPan={DESIGN_LAB_INITIAL_PAN}
            initialViewReady={compositionAutosaveState !== 'loading' && Boolean(artboardFocusRequest)}
            initialZoom={40}
            maxZoom={800}
            minZoom={5}
            navigationItems={navigationItems}
            onArrangeArtboards={viewportActions.arrangeArtboards}
            onDeselect={viewportActions.deselectCanvasLayers}
            onBackgroundClick={viewportActions.backgroundClick}
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
          {renderWorkspaceMenus()}
          {renderMotionStrip()}
          <DesignLabLayerDockPanel
            actions={dockActions}
            editingCanvas={editingCanvas}
            importState={imageImportState}
            layerCount={listedLayerIds.length}
            logoInputRef={logoInputRef}
            rows={dockLayerRows}
          />
        </section>

        <DesignLabInspectorPanel
          actions={inspectorActions}
          activeArtboardId={activeArtboardId}
          activeArtboardRawName={activeArtboardRawName}
          brandPalette={brandPalette}
          canvasBackground={canvasBackground}
          canvasDimensions={canvasDimensions}
          composition={inspectorComposition}
          contentKind={selectedContentLayerId ? resolvedLayerKind(selectedContentLayerId) : null}
          convertedAssetLibrary={convertedAssets}
          copied={copied}
          copyError={copyError}
          cropEditingLayerId={cropEditingLayerId}
          imageEffectStatusStore={imageEffectStatusStore}
          description={designLabInspectorDescription({
            hasContent: Boolean(selectedContentLayerId),
            hasEffect: Boolean(selectedEffectLayer),
            hasLayerShader: Boolean(selectedLayerShader),
            hasShader: Boolean(selectedShaderLayer),
            materialName: material.name,
          })}
          editingCanvas={editingCanvas}
          editingShader={editingShader}
          identity={identity}
          layerRows={inspectorLayerRows}
          material={material}
          outputArtboards={inspectorArtboards}
          paused={paused}
          selectedAssetInspector={selectedAssetInspector}
          selectedCanvasLayerCount={selectedCanvasLayerIds.length}
          selectedContentLayerId={selectedContentLayerId}
          selectedEffectLayer={selectedEffectLayer}
          selectedLayerId={selectedLayerId}
          selectedLayerShader={selectedLayerShader}
          selectedLogoInspector={selectedLogoInspector}
          selectedShaderLayer={selectedShaderLayer}
          selectedTextInspector={selectedTextInspector}
          settings={settings}
          shaderSize={shaderSize}
          stageRef={stageRef}
          textSelectionStore={textSelectionStore}
          textRenderedWeight={selectedTextRenderedWeight}
          textWeightRange={selectedTextWeightRange}
          title={selectedLayerId ? layerLabel(selectedLayerId) : 'Design Lab'}
          workspaceTourOpen={workspaceTourOpen}
        />
      </div>
      {renderStudioDialogs()}
    </div>
    );
  }

  return (
    <DesignVersionProvider
      autosaveState={compositionAutosaveState}
      identityId={identity.id}
      onOpen={applyCompositionSource}
      prepareSource={prepareDesignVersionSource}
      revision={savedDesignRevision}
      source={compositionSetupSource}
      toolId={tool.id}
      workspaceLabel='Design Lab'
    >
      {renderStudio()}
    </DesignVersionProvider>
  );
}
