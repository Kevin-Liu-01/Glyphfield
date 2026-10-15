'use client';

import dynamic from 'next/dynamic';
import { memo, startTransition, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { T as GTText } from 'gt-next';
import { Clapperboard, Download, ImageDown } from '@/components/ui/SolidIcons';

import CanvasViewport from '@/components/CanvasViewport';
import { canvasInsertionColors } from '@/lib/canvasInsertionColors';
import CanvasDimensionHandles from '@/components/CanvasDimensionHandles';
import AnimationCanvasSelection from '@/components/AnimationCanvasSelection';
import { AnimationLayoutGuides, AnimationRotateHandle, animationSafeMargin } from '@/components/AnimationLayerOverlay';
import type { AnimationAlignEdge, AnimationKeyframePatch, AnimationSceneTimingPatch } from '@/components/AnimationMotionControls';
import { resolveSceneTrim, type SceneTrimMode } from '@/components/AnimationTimelineHandles';
import { AnimationError, AnimationSourceDrawer } from '@/components/AnimationStudioFeedback';
import { DesignVersionHeaderControls, DesignVersionProvider, type DesignVersionControlsProps } from '@/components/DesignVersionControls';
import StudioFileMenu from '@/components/StudioFileMenu';
import BrandFontFaces from '@/components/BrandFontFaces';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import type { ExportPreviewAsset } from '@/components/ExportPreview';
import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioControls, { type AnimationMotionActions, type AnimationPlayheadContext } from '@/components/StudioControls';
import StudioArtboardBar from '@/components/StudioArtboardBar';
import StudioToolHeader, { StudioToolbarGroup } from '@/components/StudioToolHeader';
import StudioErrorNotice from '@/components/ui/StudioErrorNotice';
import { MotionTranslationContext } from '@/components/MotionTranslation';
import TimelinePanel from '@/components/TimelinePanel';
import { Button } from '@/components/ui/Button';
import { useAncestorWorkspaceActivity } from '@/hooks/useAncestorWorkspaceActivity';
import { useAnimationActionHistory } from '@/hooks/useAnimationActionHistory';
import { useCanvasSelectionDismiss } from '@/hooks/useCanvasSelectionDismiss';
import { useCachedGT } from '@/hooks/useCachedGT';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  advancePlaybackTime,
  animationTimelineChanged,
  clampTimelineZoom,
  DEFAULT_TIMELINE_ZOOM,
  resolveAnimationPreviewResolution,
  resolveSequencePosition,
  sequenceLayoutsEqual,
  sequenceSceneTime,
  shouldRenderAnimationPreview,
  type SequenceLayout,
  type TimelinePosition,
} from '@/lib/animation';
import {
  ANIMATION_ARTBOARD_PRESETS,
  animationArtboardPresetForSize,
  cloneAnimationArtboardSnapshot,
  DEFAULT_ANIMATION_ARTBOARD_ID,
  restoreAnimationArtboardWorkspace,
  type AnimationArtboard,
  type AnimationArtboardId,
  type AnimationArtboardSnapshot,
} from '@/lib/animationArtboards';
import {
  createAnimationCanvasDocument,
  parseAnimationCanvasDocument,
  type AnimationDocumentState,
} from '@/lib/animationDocument';
import {
  animationExportSignature,
  describeAnimationScenes,
  parseAnimationKeyframeRemove,
  parseAnimationKeyframeSet,
  parseAnimationMotionPreset,
  parseAnimationSceneUpdate,
  parseAnimationSeekInput,
} from '@/lib/animationAutomation';
import {
  isMotionPresetId,
  motionPresetKeyframes,
  sceneSettledTime,
  normalizeSceneMotion,
  poseFromFrame,
  resolveKeyframePose,
  retimeKeyframe,
  upsertKeyframe,
  type AnimationKeyframe,
  type AnimationPose,
  type MotionPresetId,
  type TextAnimationSettings,
} from '@/lib/animationMotion';
import type { createAnimationShaderExport } from '@/lib/animationShaderExport';
import {
  animationAudioClipEndMs,
  audioPeaks,
  createEmptyAnimationAudioState,
  mixAnimationAudio,
  normalizeAnimationAudioState,
  removeAnimationAudioClip,
  splitAnimationAudioClip,
  updateAnimationAudioClip,
  type AnimationAudioAsset,
  type AnimationAudioState,
} from '@/lib/animationAudio';
import {
  animationStartersFor,
  buildAnimationStarter,
  isAnimationStarterId,
  type AnimationStarterId,
} from '@/lib/animationStarters';
import { brandTypographyFamily, type BrandFontAsset, type BrandIdentity } from '@/lib/brandIdentity';
import { colorContrastRatio } from '@/lib/color';
import type { DesignLabProjectIdentity } from '@/lib/designLabProjectFile';
import {
  canvasDocumentContentRevision,
  isCanvasDocumentEnvelope,
} from '@/lib/canvasDocument';
import { blobToDataUrl, imageUrlToDataUrl } from '@/lib/download';
import type { LiveMaterialSettings } from '@/lib/liveMaterials';
import { readLiveMaterialPresentation, type LiveMaterialFrameState } from '@/lib/liveMaterialPreview';
import { createLiveMaterialFramePacer } from '@/lib/liveMaterialRenderBudget';
import { preloadShaderFramePresentation } from '@/lib/shaderFramePresentation';
import {
  canCompositeShaderDirectly,
  hasAnimatedShaderBackgrounds,
  measureStudioSourceBounds,
  renderFrame,
  resolveStudioBackgroundOpacity,
  sceneMovesDuringHold,
  type StudioSource,
} from '@/lib/renderFrame';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceString,
  sourceStringArray,
} from '@/lib/sourceCode';
import { savedDesignStorageKey } from '@/lib/savedDesigns';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { downloadStudioArtifact, registerStudioAutomation } from '@/lib/studioAutomation';
import {
  applyFrameSettings,
  createDefaultFrameSettings,
  DEFAULT_SETTINGS,
  DEFAULT_TEXT_FRAMES,
  mergeStudioBackground,
  mergeStudioFrameSettings,
  orderStudioSources,
  resolveStudioFrameSettings,
  resolveStudioSequenceLayout,
  resolveStudioTransitionSettings,
  type ImportedImage,
  type SourceMode,
  type StudioBackgroundSettings,
  type StudioFrameSettings,
  type StudioSettings,
  type StudioTransitionSettings,
} from '@/lib/studio';

const T = memo(GTText);
T.displayName = 'AnimationStudioTranslation';

const ExportPreview = dynamic(() => import('@/components/ExportPreview'), { ssr: false });

const INTERACTIVE_PREVIEW_FPS = 60;

async function readAnimationProjectFile(file: File) {
  return (await import('@/lib/animationProjectFile')).readAnimationProjectFile(file);
}

async function validateAnimationFontFiles(fonts: readonly BrandFontAsset[]) {
  if (fonts.length === 0) return;
  if (typeof FontFace === 'undefined') throw new Error('This browser cannot validate the project font files.');
  await Promise.all(fonts.map((font) => {
    const weight = font.weightMin !== undefined && font.weightMax !== undefined
      ? `${font.weightMin} ${font.weightMax}` : String(font.weight);
    return new FontFace(JSON.stringify(font.family),
      `url(${JSON.stringify(font.path)}) format(${JSON.stringify(font.format)})`,
      { style: font.style, weight }).load();
  }));
}

async function waitForAnimationFonts(sources: readonly StudioSource[]) {
  if (!document.fonts) return;
  const fonts = new Set(sources.filter((source) => source.kind === 'text').map((source) => (
    `${source.fontWeight ?? 500} 64px ${JSON.stringify(source.fontFamily ?? 'Switzer')}`
  )));
  await Promise.all([...fonts].map((font) => document.fonts.load(font)));
}

async function loadImportedImage(file: File): Promise<ImportedImage> {
  const url = await blobToDataUrl(file);
  const image = new Image();
  image.src = url;
  await image.decode();
  return {
    height: image.naturalHeight,
    id: crypto.randomUUID(),
    image,
    name: file.name,
    url,
    width: image.naturalWidth,
  };
}

async function loadStoredImage({
  height,
  id,
  name,
  source,
  width,
}: {
  height: number;
  id: string;
  name: string;
  source: string;
  width: number;
}): Promise<ImportedImage> {
  const image = new Image();
  image.src = source;
  await image.decode();
  return {
    height: image.naturalHeight || height,
    id,
    image,
    name,
    url: source,
    width: image.naturalWidth || width,
  };
}

/** The identity mark before it decodes: its scene, name and selection exist, its pixels do not yet. */
function pendingImageSource(path: string, name: string): StudioSource {
  return { height: 0, id: 'brand-logo', image: null, kind: 'image', name, url: path, width: 0 };
}

async function loadImageSource(path: string, name: string): Promise<StudioSource> {
  const image = new Image();
  image.src = path;
  await image.decode();
  return {
    height: image.naturalHeight,
    id: 'brand-logo',
    image,
    kind: 'image',
    name,
    url: path,
    width: image.naturalWidth,
  };
}

function createBrowserAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Audio editing is unavailable in this browser.');
  return new AudioContextClass();
}

async function closeBrowserAudioContext(context: AudioContext | null): Promise<void> {
  if (!context || context.state === 'closed') return;
  try {
    await context.close();
  } catch {
    // Fast refresh can race an earlier close; teardown is already complete.
  }
}

async function decodeAudioSource(context: AudioContext, source: string): Promise<AudioBuffer> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Audio asset could not be loaded (${response.status}).`);
  return context.decodeAudioData(await response.arrayBuffer());
}

/** Exact unscaled layer bounds from the renderer's own measurement, for selection and alignment. */
function animationSourceBounds(
  source: StudioSource | null,
  settings: StudioSettings & { fontFamily?: string },
  canvasWidth: number,
  canvasHeight: number
): { height: number; width: number } {
  if (!source) return { height: 80, width: 160 };
  return measureStudioSourceBounds(source, { ...settings, height: canvasHeight, width: canvasWidth });
}

type AnimationDragPreview = { pose: Partial<AnimationPose>; sourceId: string };

/** Applies a transient canvas drag pose to the preview only; state commits on release. */
function applyDragPreview(sources: readonly StudioSource[], preview: AnimationDragPreview | null): readonly StudioSource[] {
  if (!preview) return sources;
  return sources.map((source) => source.id === preview.sourceId
    ? { ...source, ...preview.pose, keyframes: undefined }
    : source);
}

const ANIMATION_LAYER_ID = 'animation-selected-layer';
const UNHANDLED_ACTION = Symbol('unhandled animation action');

type AnimationExportFormat = 'gif' | 'mp4' | 'png';
const ANIMATION_EXPORT_LABELS: Record<AnimationExportFormat, string> = {
  gif: 'Rendering GIF preview',
  mp4: 'Rendering MP4 preview',
  png: 'Rendering poster frame',
};
const ANIMATION_EXPORT_FORMATS: Record<AnimationExportFormat, ExportPreviewAsset['format']> = { gif: 'GIF', mp4: 'MP4', png: 'PNG' };

/** One full-resolution frame at the playhead, through the same renderer and shader capture as motion export. */
async function renderAnimationPoster(
  settings: StudioSettings,
  timeMs: number,
  draw: (context: CanvasRenderingContext2D) => Promise<void>
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(120, settings.width);
  canvas.height = Math.max(120, settings.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas rendering is unavailable.');
  await draw(context);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob || blob.size === 0) throw new Error(`The poster frame at ${Math.round(timeMs)}ms could not be encoded.`);
  return blob;
}
const LAYER_PREVIEW_TRANSFORM = /translate3d\((-?[\d.]+)%,\s*(-?[\d.]+)%,\s*0(?:px)?\)\s*scale3d\((-?[\d.]+),\s*(-?[\d.]+),\s*1\)/;

/**
 * Reads the shared editable layer's GPU drag preview so the canvas content
 * follows the pointer live, without a React render per pointer frame.
 */
function readLayerDragPreview(
  stage: HTMLElement,
  committed: { alignX: number; alignY: number; scale: number },
  base: { height: number; width: number },
  canvas: { height: number; width: number },
  anchorStart: boolean
): Partial<AnimationPose> | null {
  const layer = stage.querySelector<HTMLElement>(`[data-canvas-layer-id="${ANIMATION_LAYER_ID}"]`);
  if (!layer || layer.dataset.interactionPreview !== 'gpu') return null;
  const match = LAYER_PREVIEW_TRANSFORM.exec(layer.style.transform);
  if (!match) return null;
  const [, translateX, translateY, scaleX] = match.map(Number);
  const startWidth = base.width * committed.scale;
  const startHeight = base.height * committed.scale;
  const scale = committed.scale * (Number.isFinite(scaleX) && scaleX! > 0 ? scaleX! : 1);
  // The box scales about its centre; a leading-edge anchor sits half a width left of it.
  const centerX = (committed.alignX * canvas.width) / 2 + (anchorStart ? startWidth / 2 : 0) + (translateX! / 100) * startWidth;
  const x = centerX - (anchorStart ? (base.width * scale) / 2 : 0);
  const y = (committed.alignY * canvas.height) / 2 + (translateY! / 100) * startHeight;
  return {
    alignX: Math.min(1, Math.max(-1, (x / canvas.width) * 2)),
    alignY: Math.min(1, Math.max(-1, (y / canvas.height) * 2)),
    scale,
  };
}

/** One stable object whose methods always call the latest render's handlers. */
function useStableHandlers<T extends Record<string, (...args: never[]) => unknown>>(handlers: T): T {
  const handlersRef = useRef(handlers);
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });
  const [stable] = useState(() => Object.fromEntries(Object.keys(handlers).map((key) => [
    key,
    (...args: unknown[]) => (handlersRef.current[key] as unknown as (...input: unknown[]) => unknown)(...args),
  ])) as unknown as T);
  return stable;
}

function initialAnimationStarter(identity: BrandIdentity | undefined, presentationMode: boolean) {
  if (presentationMode || !identity || !isFreshAnimationWorkspace(identity.id)) return null;
  return buildAnimationStarter({
    createId: newKeyframeId,
    hasLogo: identity.assets.some((asset) => asset.type === 'logo'),
    identity,
    starterId: 'brand-intro',
  });
}

/** Draft initial values: the starter on a first visit, otherwise the legacy identity defaults. */
function animationDraftDefaults(
  starter: ReturnType<typeof initialAnimationStarter>,
  identity: BrandIdentity | undefined,
  identitySettings: StudioSettings,
  identityTextFrames: string
) {
  return {
    backgroundOverrides: starter?.backgroundOverrides ?? {},
    frameSettings: starter?.frameSettings ?? {},
    includeBrandLogo: starter?.includeBrandLogo ?? Boolean(identity),
    sequenceBackground: starter?.sequenceBackground,
    sequenceOrder: starter?.sequenceOrder ?? [],
    settings: starter?.settings ?? identitySettings,
    textFrames: starter?.textFrames ?? identityTextFrames,
  };
}

function resolveCaptionFontFamily(identity: BrandIdentity | undefined): string | undefined {
  return identity ? brandTypographyFamily(identity, 'Code') : undefined;
}

/** True when this identity has never opened Animation in this browser: no drafts to preserve. */
function isFreshAnimationWorkspace(identityId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const prefix = `glyphfield-draft-v1:${identityId}:animation:`;
    // Content keys only: mount-time migrations also write `settings`.
    return !['text-frames', 'frame-settings', 'sequence-order', 'sequence-background-v1'].some((key) => window.localStorage.getItem(`${prefix}${key}`) !== null);
  } catch {
    return false;
  }
}

/** The logo artwork that reads on a field: dark marks on light fields, light marks on dark ones. */
function brandLogoAssetFor(identity: BrandIdentity | undefined, fieldColor: string) {
  const fieldIsLight = colorContrastRatio(fieldColor, '#000000') > 7;
  const surface = fieldIsLight ? 'light' : 'dark';
  const logos = identity?.assets.filter((asset) => asset.type === 'logo') ?? [];
  return logos.find((asset) => asset.surface === surface && asset.id.includes('mark'))
    ?? logos.find((asset) => asset.surface === surface)
    ?? logos.find((asset) => asset.surface === 'dark' && asset.id.includes('mark'))
    ?? logos[0];
}

/** The landing presentation keeps the plain inspector: no keyframe or timing editors. */
function editorOnlyControlProps(
  presentationMode: boolean,
  motion: AnimationMotionActions,
  playhead: AnimationPlayheadContext
): { motion?: AnimationMotionActions; playhead?: AnimationPlayheadContext } {
  return presentationMode ? {} : { motion, playhead };
}

function brandLogoPathFor(identity: BrandIdentity | undefined, fieldColor: string): string | undefined {
  return brandLogoAssetFor(identity, fieldColor)?.path;
}

function newKeyframeId(): string {
  return `key-${globalThis.crypto?.randomUUID?.().slice(0, 8) ?? Math.random().toString(36).slice(2, 10)}`;
}

/** Transitions and scenes with keyframes or a text entrance redraw every due frame. */
function previewContentIsAnimated(
  position: TimelinePosition,
  sources: readonly StudioSource[],
  current: StudioSource | undefined
): boolean {
  return (position.phase === 'transition' && sources.length > 1) || sceneMovesDuringHold(current);
}

function renderInteractiveAnimationPreview({
  attachShaderLayers,
  backgroundOverrides,
  canvas,
  currentSettings,
  currentSources,
  dragPreview,
  frameIsDue,
  frameSettings,
  position,
  previewDirty,
  previousRenderedSourceId,
  previewResolution,
  shaderPresentationReady,
}: {
  attachShaderLayers: (sources: readonly StudioSource[]) => StudioSource[];
  backgroundOverrides: Record<string, boolean>;
  canvas: HTMLCanvasElement | null;
  currentSettings: StudioSettings;
  currentSources: readonly StudioSource[];
  dragPreview: AnimationDragPreview | null;
  frameIsDue: boolean;
  frameSettings: Record<string, StudioFrameSettings>;
  position: TimelinePosition;
  previewDirty: boolean;
  previousRenderedSourceId: string;
  previewResolution: { height: number; width: number };
  shaderPresentationReady: boolean;
}): { rendered: boolean; sourceId: string } {
  const currentSource = currentSources[position.index];
  const nextSource = currentSources[position.nextIndex];
  const directComposite = canCompositeShaderDirectly(
    currentSource,
    nextSource,
    backgroundOverrides
  );
  const contentIsAnimated = previewContentIsAnimated(position, currentSources, currentSource);
  const compositedBackgroundIsAnimated = !directComposite && (
    currentSource?.background?.style === 'shader'
    || (position.phase === 'transition' && nextSource?.background?.style === 'shader')
  );
  const shouldRender = shouldRenderAnimationPreview({
    compositedBackgroundIsAnimated,
    contentIsAnimated,
    currentSourceId: currentSource?.id,
    frameIsDue,
    pageVisible: true,
    previewDirty,
    previousSourceId: previousRenderedSourceId,
  });
  if (!canvas || !shouldRender) {
    return { rendered: false, sourceId: previousRenderedSourceId };
  }
  // Keep the previous complete frame while the shared grain tile decodes.
  // Direct GPU compositing does not need the 2D presentation resource.
  if (compositedBackgroundIsAnimated && !shaderPresentationReady) {
    return { rendered: false, sourceId: previousRenderedSourceId };
  }
  const logicalWidth = Math.max(120, currentSettings.width);
  const logicalHeight = Math.max(120, currentSettings.height);
  const width = previewResolution.width;
  const height = previewResolution.height;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return { rendered: false, sourceId: previousRenderedSourceId };
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, width, height);
  context.save();
  context.scale(width / logicalWidth, height / logicalHeight);
  renderFrame(
    context,
    attachShaderLayers(applyDragPreview(currentSources, dragPreview)),
    {
      ...currentSettings,
      ...resolveStudioTransitionSettings(
        currentSettings,
        currentSource ? frameSettings[currentSource.id]?.transition : undefined
      ),
      width: logicalWidth,
      height: logicalHeight,
    },
    position,
    { omitBackground: directComposite }
  );
  context.restore();
  return { rendered: true, sourceId: currentSource?.id ?? '' };
}

/** Observes the shared layer's drag preview and forwards the decoded pose to the canvas loop. */
function AnimationLayerDragBridge({
  anchorStart,
  base,
  canvas,
  onPreview,
  pose,
  stageRef,
}: {
  anchorStart: boolean;
  base: { height: number; width: number };
  canvas: { height: number; width: number };
  onPreview: (pose: Partial<AnimationPose> | null) => void;
  pose: AnimationPose;
  stageRef: RefObject<HTMLDivElement | null>;
}) {
  const latestRef = useRef({ anchorStart, base, canvas, onPreview, pose });
  useLayoutEffect(() => {
    latestRef.current = { anchorStart, base, canvas, onPreview, pose };
  });
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof MutationObserver === 'undefined') return;
    let active = false;
    const observer = new MutationObserver(() => {
      const latest = latestRef.current;
      const preview = readLayerDragPreview(stage, latest.pose, latest.base, latest.canvas, latest.anchorStart);
      if (!preview && !active) return;
      active = Boolean(preview);
      latest.onPreview(preview);
    });
    observer.observe(stage, { attributeFilter: ['style', 'data-interaction-preview'], attributes: true, subtree: true });
    return () => {
      observer.disconnect();
      if (active) latestRef.current.onPreview(null);
    };
  }, [stageRef]);
  return null;
}

function AnimationShaderLayers({
  active,
  activeShaderSourceIds,
  backgroundOverrides,
  directShaderComposite,
  embedded,
  exportProgress,
  isPlaying,
  overrideShaderSettings,
  presentationMode,
  previewFrameRate,
  previewMaxPixelCount,
  sequenceBackground,
  sequenceShaderIsActive,
  sequenceShaderLayerRef,
  sequenceShaderOpacity,
  sequenceShaderSettings,
  shaderCaptureTimeMs,
  shaderFrameStates,
  shaderLayerRefs,
  showSequenceShader,
  sources,
  studioShaderSettings,
  viewportVisible,
}: {
  active: boolean;
  activeShaderSourceIds: Set<string>;
  backgroundOverrides: Record<string, boolean>;
  directShaderComposite: boolean;
  embedded: boolean;
  exportProgress: number | null;
  isPlaying: boolean;
  overrideShaderSettings: Map<string, StudioSettings['shaderSettings']>;
  presentationMode: boolean;
  previewFrameRate: number;
  previewMaxPixelCount: number;
  sequenceBackground: StudioBackgroundSettings;
  sequenceShaderIsActive: boolean;
  sequenceShaderLayerRef: RefObject<HTMLDivElement | null>;
  sequenceShaderOpacity: number;
  sequenceShaderSettings: StudioSettings['shaderSettings'];
  shaderCaptureTimeMs: number | null;
  shaderFrameStates: ReadonlyMap<string, LiveMaterialFrameState>;
  shaderLayerRefs: RefObject<Map<string, HTMLDivElement>>;
  showSequenceShader: boolean;
  sources: readonly StudioSource[];
  studioShaderSettings: StudioSettings['shaderSettings'];
  viewportVisible: boolean;
}) {
  const retainOffscreenContext = embedded && presentationMode;
  const enabled = active && (viewportVisible || retainOffscreenContext);
  const previewPaused = !active || !viewportVisible || !isPlaying;
  return (
    <>
      {showSequenceShader ? (
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0'
          data-animation-shader-active={sequenceShaderIsActive ? 'true' : 'false'}
          data-animation-shader-layer='sequence'
          ref={sequenceShaderLayerRef}
          style={{ opacity: directShaderComposite ? sequenceShaderOpacity : 0 }}
        >
          <LiveMaterialCanvas
            activeWhileMounted={retainOffscreenContext}
            captureTimeMs={shaderCaptureTimeMs}
            enabled={enabled || exportProgress !== null}
            frameRate={previewFrameRate}
            frameState={shaderFrameStates.get('sequence')}
            materialId={sequenceBackground.materialId}
            maxPixelCount={previewMaxPixelCount}
            patternScale={sequenceBackground.patternScale ?? 1}
            paused={exportProgress === null && (previewPaused || !sequenceShaderIsActive)}
            settings={sequenceShaderSettings}
          />
        </div>
      ) : null}
      {sources.map((source) => (
        backgroundOverrides[source.id] && source.background?.style === 'shader' ? (
          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 opacity-0'
            data-animation-shader-layer='override'
            key={`${source.id}-${source.background.materialId}`}
            ref={(element) => {
              if (element) shaderLayerRefs.current.set(source.id, element);
              else shaderLayerRefs.current.delete(source.id);
            }}
          >
            <LiveMaterialCanvas
              activeWhileMounted={retainOffscreenContext}
              captureTimeMs={shaderCaptureTimeMs}
              enabled={exportProgress !== null || (enabled && activeShaderSourceIds.has(source.id))}
              frameRate={previewFrameRate}
              frameState={shaderFrameStates.get(`source-${source.id}`)}
              materialId={source.background.materialId}
              maxPixelCount={previewMaxPixelCount}
              patternScale={source.background.patternScale ?? 1}
              paused={exportProgress === null && previewPaused}
              settings={overrideShaderSettings.get(source.id) ?? studioShaderSettings}
            />
          </div>
        ) : null
      ))}
    </>
  );
}

function animationPackageLabel(packageId: string): string {
  return packageId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function resolveActiveAnimationArtboard(
  artboards: readonly AnimationArtboard[],
  activeArtboardId: AnimationArtboardId
): AnimationArtboard | null {
  return artboards.find(({ id }) => id === activeArtboardId) ?? artboards[0] ?? null;
}

function resolvedAnimationArtboardId(artboard: AnimationArtboard | null): AnimationArtboardId {
  return artboard?.id ?? DEFAULT_ANIMATION_ARTBOARD_ID;
}

function selectedAnimationTransition(
  index: number | null,
  sources: readonly StudioSource[],
  frameSettings: Readonly<Record<string, StudioFrameSettings>>,
  settings: StudioSettings
) {
  const source = index === null ? null : sources[index] ?? null;
  const override = source ? frameSettings[source.id]?.transition : undefined;
  return {
    hasOverride: Boolean(override),
    settings: resolveStudioTransitionSettings(settings, override),
    source,
  };
}

function AnimationArtboardBar({
  activeArtboardId,
  artboards,
  frameCount,
  height,
  onAdd,
  onDimensionsChange,
  onDuplicate,
  onRemove,
  onRename,
  onSelect,
  packageId,
  totalMs,
  width,
}: {
  activeArtboardId: AnimationArtboardId;
  artboards: readonly AnimationArtboard[];
  frameCount: number;
  height: number;
  onAdd: () => void;
  onDimensionsChange: (dimensions: { height: number; width: number }) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onSelect: (id: AnimationArtboardId) => void;
  packageId: string;
  totalMs: number;
  width: number;
}) {
  return (
    <StudioArtboardBar
      activeArtboardId={activeArtboardId}
      addLabel='Add animation artboard'
      ariaLabel='Animation artboards'
      artboards={artboards}
      contextMenuLabel='Animation artboard'
      contextTrigger='animation-artboard'
      dimensions={{ height, width }}
      duplicateLabel='Duplicate animation artboard'
      onAdd={onAdd}
      onDimensionsChange={onDimensionsChange}
      onDuplicate={onDuplicate}
      onRemove={onRemove}
      onRename={onRename}
      onSelect={(id) => onSelect(id as AnimationArtboardId)}
      removeLabel='Delete animation artboard'
      selectLabel='Active animation artboard'
      summary={<>
        {frameCount} frame{frameCount === 1 ? '' : 's'} · {(totalMs / 1000).toFixed(2)}s · {animationPackageLabel(packageId)}
      </>}
      untitledName='Untitled animation'
    />
  );
}

function animationStudioClassName({
  compactControls,
  embedded,
  presentationMode,
}: {
  compactControls: boolean;
  embedded: boolean;
  presentationMode: boolean;
}): string {
  if (!embedded) return 'studio-grid min-h-dvh bg-background text-foreground';
  return [
    'animation-studio h-full min-h-0 bg-background text-foreground',
    compactControls ? 'animation-studio-compact-controls' : '',
    presentationMode ? 'animation-studio-presentation' : '',
  ].filter(Boolean).join(' ');
}

function AnimationVersionWorkspace({ children, presentationMode, ...versionProps }: DesignVersionControlsProps & {
  children: ReactNode;
  presentationMode: boolean;
}) {
  if (presentationMode) return children;
  return <DesignVersionProvider {...versionProps}>{children}</DesignVersionProvider>;
}

function animationWorkspaceInput<T>(presentationMode: boolean, input: T): T | null {
  return presentationMode ? null : input;
}

function animationDocumentRevision(document: { revision: number } | null): string {
  return document ? String(document.revision) : '';
}

function resolveAnimationFontFamily(identity: BrandIdentity | undefined): string {
  return identity ? brandTypographyFamily(identity, 'Display') : 'Switzer';
}

function animationHistoryEnabled(presentationMode: boolean, autosaveState: string): boolean {
  return !presentationMode && autosaveState !== 'loading';
}

function animationHistorySelection(selectedId: string | null, sourceIds: readonly string[]): string | null {
  return selectedId && sourceIds.includes(selectedId) ? selectedId : sourceIds[0] ?? null;
}

function useSettledValue<T>(value: T, delayMs: number): { pending: boolean; value: T } {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    if (settled === value) return;
    const timer = window.setTimeout(() => {
      startTransition(() => setSettled(value));
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, settled, value]);
  return { pending: settled !== value, value: settled };
}

/** Keeps one layout object while scene timing is unchanged, so memoized timeline children stay put. */
function useStableSequenceLayout(layout: SequenceLayout): SequenceLayout {
  const layoutRef = useRef(layout);
  if (!sequenceLayoutsEqual(layoutRef.current, layout)) layoutRef.current = layout;
  return layoutRef.current;
}

function frameDefaultsMatch(first: StudioSettings, second: StudioSettings): boolean {
  return first.alignX === second.alignX
    && first.alignY === second.alignY
    && first.background === second.background
    && first.backgroundAngle === second.backgroundAngle
    && first.backgroundSecondary === second.backgroundSecondary
    && first.backgroundStyle === second.backgroundStyle
    && first.fit === second.fit
    && first.fontSize === second.fontSize
    && first.fontWeight === second.fontWeight
    && first.foreground === second.foreground
    && first.scale === second.scale
    && first.shaderSettings === second.shaderSettings;
}

function mergeAnimationSettings(
  identitySettings: StudioSettings,
  storedSettings: StudioSettings,
  shaderSettings: StudioSettings['shaderSettings'],
  compact: boolean
): StudioSettings {
  const merged = { ...identitySettings, ...storedSettings, shaderSettings };
  if (!compact) return merged;
  return { ...merged, fontSize: Math.min(88, merged.fontSize) };
}

function useFrameResolutionSettings(settings: StudioSettings): StudioSettings {
  const settingsRef = useRef(settings);
  if (!frameDefaultsMatch(settingsRef.current, settings)) settingsRef.current = settings;
  return settingsRef.current;
}

function resolvedAnimationAutosaveState(
  pending: boolean,
  state: ReturnType<typeof usePortableCanvasWorkspace>['autosaveState']
) {
  return pending ? 'preparing' as const : state;
}

function resolvedAnimationSource(pending: boolean, source: string | null): string | null {
  return pending ? null : source;
}

function interactiveAnimationPreviewPixelBudget(presentationMode: boolean): number {
  return presentationMode ? 360_000 : 1_000_000;
}

function animationBrandLogoSource(brandLogo: StudioSource | null): string | undefined {
  return brandLogo?.kind === 'image' ? brandLogo.url : undefined;
}

function resolveSelectedFrameSettings(
  source: StudioSource | null,
  frameSettings: Record<string, StudioFrameSettings>,
  settings: StudioSettings
): StudioFrameSettings | null {
  if (!source) return null;
  return mergeStudioFrameSettings(settings, frameSettings[source.id]);
}

function AnimationStudio({
  active = true,
  autoPlay = false,
  compactControls = false,
  embedded = false,
  identity: brandIdentity,
  initialFontWeight,
  initialSequenceBackground,
  previewFrameRate = INTERACTIVE_PREVIEW_FPS,
  presentationMode = false,
  viewportVisible = true,
}: {
  active?: boolean;
  autoPlay?: boolean;
  compactControls?: boolean;
  embedded?: boolean;
  identity?: BrandIdentity;
  initialFontWeight?: number;
  initialSequenceBackground?: Partial<StudioBackgroundSettings>;
  previewFrameRate?: number;
  presentationMode?: boolean;
  viewportVisible?: boolean;
}) {
  const gt = useCachedGT();
  const translateRef = useCommittedRef(gt);
  // One translator identity for the editor's lifetime: General Translation can
  // return a new function per render, which would re-render every consumer.
  const [motionGT] = useState(() => ((message: string, options?: Parameters<typeof gt>[1]) => translateRef.current(message, options)) as typeof gt);
  const [projectIdentity, setProjectIdentity] = useState<DesignLabProjectIdentity | null>(null);
  const identity = useMemo(() => brandIdentity && projectIdentity
    ? { ...brandIdentity, fonts: projectIdentity.fonts, typography: projectIdentity.typography }
    : brandIdentity, [brandIdentity, projectIdentity]);
  const animationFontFamily = resolveAnimationFontFamily(identity);
  const identitySettings = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    fontWeight: initialFontWeight ?? DEFAULT_SETTINGS.fontWeight,
    background: identity?.colors.find(({ id }) => id === 'ink')?.hex ?? DEFAULT_SETTINGS.background,
    foreground: identity?.colors.find(({ id }) => id === 'paper')?.hex ?? DEFAULT_SETTINGS.foreground,
  }), [identity, initialFontWeight]);
  const identityTextFrames = identity?.greetings.join('\n') || DEFAULT_TEXT_FRAMES;
  const identityId = identity?.id ?? 'default';
  // A first visit opens on the identity's brand intro. Existing drafts and
  // autosaved documents keep their own content; the landing hero keeps its look.
  const [starterDefaults] = useState(() => initialAnimationStarter(identity, presentationMode));
  const draftDefaults = animationDraftDefaults(starterDefaults, identity, identitySettings, identityTextFrames);
  const studioExport = useStudioExportProgress(`${identityId}:animation`);
  const [storedSettings, setStoredSettings] = useStudioDraft<StudioSettings>(
    identityId,
    'animation',
    'settings',
    draftDefaults.settings
  );
  useEffect(() => {
    if (initialFontWeight === undefined) return;
    setStoredSettings((current) => current.fontWeight === initialFontWeight
      ? current
      : { ...current, fontWeight: initialFontWeight });
  }, [initialFontWeight, setStoredSettings]);
  const [qualityDefaultsMigrated, setQualityDefaultsMigrated] = useStudioDraft(
    identityId,
    'animation',
    'quality-defaults-v2',
    false
  );
  const mergedShaderSettings = useMemo(() => ({
    ...identitySettings.shaderSettings,
    ...storedSettings.shaderSettings,
  }), [identitySettings.shaderSettings, storedSettings.shaderSettings]);
  const settings = useMemo<StudioSettings & { fontFamily: string }>(() => {
    return { ...mergeAnimationSettings(
      identitySettings,
      storedSettings,
      mergedShaderSettings,
      compactControls
    ), fontFamily: animationFontFamily };
  }, [animationFontFamily, compactControls, identitySettings, mergedShaderSettings, storedSettings]);
  const frameResolutionSettings = useFrameResolutionSettings(settings);
  const [mode, setMode] = useState<SourceMode>('sequence');
  const [textFrames, setTextFrames] = useStudioDraft(
    identityId,
    'animation',
    'text-frames',
    draftDefaults.textFrames
  );
  const [images, setImages] = useState<ImportedImage[]>([]);
  const [brandLogo, setBrandLogo] = useState<StudioSource | null>(null);
  const [failedBrandLogoPath, setFailedBrandLogoPath] = useState<string | null>(null);
  const [includeBrandLogo, setIncludeBrandLogo] = useStudioDraft(
    identityId,
    'animation',
    'include-brand-logo',
    draftDefaults.includeBrandLogo
  );
  const [sequenceOrder, setSequenceOrder] = useStudioDraft<string[]>(
    identityId,
    'animation',
    'sequence-order',
    draftDefaults.sequenceOrder
  );
  const [frameSettings, setFrameSettings] = useStudioDraft<Record<string, StudioFrameSettings>>(
    identityId,
    'animation',
    'frame-settings',
    draftDefaults.frameSettings
  );
  const defaultSequenceBackground = useMemo(() => mergeStudioBackground(
    createDefaultFrameSettings(frameResolutionSettings).background,
    initialSequenceBackground ?? {},
    frameResolutionSettings.shaderSettings
  ), [frameResolutionSettings, initialSequenceBackground]);
  const [storedSequenceBackground, setStoredSequenceBackground] = useStudioDraft<StudioBackgroundSettings>(
    identityId,
    'animation',
    'sequence-background-v1',
    () => draftDefaults.sequenceBackground ?? defaultSequenceBackground
  );
  const sequenceBackground = useMemo(() => mergeStudioBackground(
    defaultSequenceBackground,
    storedSequenceBackground,
    settings.shaderSettings
  ), [defaultSequenceBackground, settings.shaderSettings, storedSequenceBackground]);
  const sequenceShaderOpacity = resolveStudioBackgroundOpacity(sequenceBackground);
  const [backgroundOverrides, setBackgroundOverrides] = useStudioDraft<Record<string, boolean>>(
    identityId,
    'animation',
    'background-overrides-v1',
    draftDefaults.backgroundOverrides
  );
  const [backgroundScopeMigrated, setBackgroundScopeMigrated] = useStudioDraft(
    identityId,
    'animation',
    'background-scope-migrated-v1',
    false
  );
  const [backgroundEditScope, setBackgroundEditScope] = useState<'sequence' | 'frame'>('sequence');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(() => (
    sequenceOrder[0]
      ?? (includeBrandLogo && identity?.assets.some((asset) => asset.type === 'logo') ? 'brand-logo' : 'text-0')
  ));
  const [selectedTransitionIndex, setSelectedTransitionIndex] = useState<number | null>(null);
  const [selectedEffectTarget, setSelectedEffectTarget] = useState<
    'background' | 'content'
  >('content');
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [playbackRate, setPlaybackRate] = useStudioDraft(
    identityId,
    'animation',
    'playback-rate',
    1
  );
  const [timelineZoom, setTimelineZoom] = useStudioDraft(
    identityId,
    'animation',
    'timeline-zoom-v1',
    DEFAULT_TIMELINE_ZOOM
  );
  const [guidesVisible, setGuidesVisible] = useStudioDraft(
    identityId,
    'animation',
    'layout-guides-v1',
    false
  );
  const dragPreviewRef = useRef<AnimationDragPreview | null>(null);
  const [fontRevision, setFontRevision] = useState(0);
  const [audioState, setAudioState] = useState<AnimationAudioState>(createEmptyAnimationAudioState);
  const [selectedAudioClipId, setSelectedAudioClipId] = useState<string | null>(null);
  const [audioBufferRevision, setAudioBufferRevision] = useState(0);
  const [activeTimeline, setActiveTimeline] = useState({ index: 0, nextIndex: 0 });
  const [shaderCaptureTimeMs, setShaderCaptureTimeMs] = useState<number | null>(null);
  const [shaderFrameStates, setShaderFrameStates] = useState<ReadonlyMap<string, LiveMaterialFrameState>>(() => new Map());
  const [shaderPresentationReady, setShaderPresentationReady] = useState(false);
  const shaderPresentationReadyRef = useCommittedRef(shaderPresentationReady);
  const exportJobRef = useRef(false);
  const sourceApplySequenceRef = useRef(0);
  const activeRef = useCommittedRef(active);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [documentCreatedAt] = useState(() => new Date().toISOString());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const workspaceVisibleRef = useRef(false);
  const workspaceIntersectingRef = useRef(true);
  const canvasSelectionRef = useRef<HTMLDivElement>(null);
  const sequenceShaderLayerRef = useRef<HTMLDivElement>(null);
  const shaderLayerRefs = useRef(new Map<string, HTMLDivElement>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef(new Map<string, AudioBuffer>());
  const audioHydrationGenerationRef = useRef(0);
  const audioPlaybackNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const audioPlaybackRequestedRef = useRef(false);
  const audioScheduleRevisionRef = useRef(0);
  const playheadRef = useRef(0);
  const previewDirtyRef = useRef(true);
  const previewClockResetRef = useRef(true);
  const previewResolutionRef = useRef({ height: 1, width: 1 });
  const requestPreviewFrameRef = useRef<() => void>(() => undefined);
  const playheadListenersRef = useRef(new Set<(timeMs: number) => void>());
  const initialSelectionAppliedRef = useRef(false);
  const publishPlayhead = useCallback((timeMs: number) => {
    for (const listener of playheadListenersRef.current) listener(timeMs);
  }, []);
  const subscribeToPlayhead = useCallback((listener: (timeMs: number) => void) => {
    playheadListenersRef.current.add(listener);
    listener(playheadRef.current);
    return () => playheadListenersRef.current.delete(listener);
  }, []);
  useCanvasSelectionDismiss(canvasSelectionRef, () => {
    // Dismissing swaps the whole inspector; never block the pointer event on it.
    startTransition(() => {
      setSelectedSourceId(null);
      setSelectedTransitionIndex(null);
      setBackgroundEditScope('sequence');
      setSelectedEffectTarget('content');
    });
  });

  const captionFontFamily = resolveCaptionFontFamily(identity);
  // Text scenes keep their identity while their line is unchanged, so an edit to
  // one line never invalidates every other scene's resolved source.
  const textSourceCacheRef = useRef(new Map<string, StudioSource>());
  const textSources = useMemo<StudioSource[]>(() => {
    const previous = textSourceCacheRef.current;
    const next = new Map<string, StudioSource>();
    const resolved = (textFrames === '' ? [] : textFrames.split('\n')).map((line, index) => {
      const id = `text-${index}`;
      const text = line || 'New frame';
      const cached = previous.get(id);
      const source = cached?.kind === 'text' && cached.text === text && cached.fontFamily === animationFontFamily && cached.captionFontFamily === captionFontFamily
        ? cached
        : { captionFontFamily, fontFamily: animationFontFamily, id, kind: 'text' as const, text };
      next.set(id, source);
      return source;
    });
    textSourceCacheRef.current = next;
    return resolved;
  }, [animationFontFamily, captionFontFamily, textFrames]);
  const imageSources = useMemo<StudioSource[]>(
    () =>
      images.map((image) => ({
        height: image.height,
        id: image.id,
        image: image.image,
        kind: 'image',
        name: image.name,
        url: image.url,
        width: image.width,
      })),
    [images]
  );
  // Until the identity mark decodes, a stand-in holds its scene, so the first
  // render (the server's included) already lists every scene and the selection.
  const pendingBrandLogoAsset = brandLogoAssetFor(identity, sequenceBackground.colorA);
  const shownBrandLogo = useMemo(() => brandLogo ?? (
    pendingBrandLogoAsset && pendingBrandLogoAsset.path !== failedBrandLogoPath
      ? pendingImageSource(pendingBrandLogoAsset.path, pendingBrandLogoAsset.label)
      : null
  ), [brandLogo, failedBrandLogoPath, pendingBrandLogoAsset]);
  const baseSources = useMemo(
    () => [
      ...(includeBrandLogo && shownBrandLogo ? [shownBrandLogo] : []),
      ...textSources,
      ...imageSources,
    ],
    [imageSources, includeBrandLogo, shownBrandLogo, textSources]
  );
  const resolvedFrameSettings = useMemo(
    () => Object.fromEntries(baseSources.map((source) => [
      source.id,
      resolveStudioFrameSettings(
        frameResolutionSettings,
        frameSettings[source.id],
        sequenceBackground,
        Boolean(backgroundOverrides[source.id])
      ),
    ])),
    [backgroundOverrides, baseSources, frameResolutionSettings, frameSettings, sequenceBackground]
  );
  // Unchanged scenes keep their object identity, so memoized storyboard and
  // inspector thumbnails redraw only for the scene an edit actually touched.
  const resolvedSourceCacheRef = useRef(new Map<string, { inputs: readonly unknown[]; source: StudioSource }>());
  const resolvedSources = useMemo(() => {
    const previous = resolvedSourceCacheRef.current;
    const next = new Map<string, { inputs: readonly unknown[]; source: StudioSource }>();
    const ordered = orderStudioSources(baseSources, sequenceOrder).map((source) => {
      const inputs = [
        source.kind === 'text' ? source.text : source.image,
        source.kind === 'text' ? source.fontFamily : source.url,
        frameSettings[source.id],
        Boolean(backgroundOverrides[source.id]),
        sequenceBackground,
        frameResolutionSettings,
      ] as const;
      const cached = previous.get(source.id);
      const resolved = cached && cached.inputs.every((value, index) => Object.is(value, inputs[index]))
        ? cached.source
        : applyFrameSettings(source, resolvedFrameSettings[source.id] ?? createDefaultFrameSettings(frameResolutionSettings));
      next.set(source.id, { inputs, source: resolved });
      return resolved;
    });
    resolvedSourceCacheRef.current = next;
    return ordered;
  }, [backgroundOverrides, baseSources, frameResolutionSettings, frameSettings, resolvedFrameSettings, sequenceBackground, sequenceOrder]);
  const currentArtboardSnapshot = useMemo<AnimationArtboardSnapshot>(() => ({
    audio: audioState,
    backgroundOverrides,
    frameSettings,
    sequenceBackground,
    sequenceOrder,
    settings,
  }), [audioState, backgroundOverrides, frameSettings, sequenceBackground, sequenceOrder, settings]);
  const [activeArtboardId, setActiveArtboardId] = useStudioDraft<AnimationArtboardId>(
    identityId,
    'animation',
    'active-artboard-v1',
    DEFAULT_ANIMATION_ARTBOARD_ID
  );
  const [artboards, setArtboards] = useState<AnimationArtboard[]>(() => [{
    id: DEFAULT_ANIMATION_ARTBOARD_ID,
    name: `${animationArtboardPresetForSize(settings.width, settings.height)?.label ?? 'Custom'} animation`,
    snapshot: cloneAnimationArtboardSnapshot(currentArtboardSnapshot),
  }]);
  const workspaceArtboards = useMemo(() => artboards.map((artboard) => (
    artboard.id === activeArtboardId
      ? { ...artboard, snapshot: currentArtboardSnapshot }
      : artboard
  )), [activeArtboardId, artboards, currentArtboardSnapshot]);
  const workspaceArtboardsRef = useCommittedRef(workspaceArtboards);
  const activeArtboardIdRef = useCommittedRef(activeArtboardId);
  const currentArtboardSnapshotRef = useCommittedRef(currentArtboardSnapshot);
  const activeArtboard = resolveActiveAnimationArtboard(workspaceArtboards, activeArtboardId);
  const animationState = useMemo<AnimationDocumentState>(() => ({
    ...(projectIdentity ? { identity: projectIdentity } : {}),
    activeArtboardId,
    artboards: workspaceArtboards,
    audio: audioState,
    backgroundOverrides,
    frameSettings,
    includeBrandLogo,
    mode,
    playbackRate,
    sequenceBackground,
    sequenceOrder,
    settings,
    textFrames,
  }), [
    activeArtboardId,
    workspaceArtboards,
    audioState,
    backgroundOverrides,
    frameSettings,
    includeBrandLogo,
    mode,
    playbackRate,
    projectIdentity,
    sequenceBackground,
    sequenceOrder,
    settings,
    textFrames,
  ]);
  const animationDocumentInput = useMemo(() => ({
    sources: resolvedSources,
    state: animationState,
  }), [animationState, resolvedSources]);
  const animationDocumentInputRef = useCommittedRef(animationDocumentInput);
  const settledAnimationDocumentInput = useSettledValue(animationWorkspaceInput(presentationMode, animationDocumentInput), 180);
  const animationDocument = useMemo(() => {
    if (presentationMode || !settledAnimationDocumentInput.value) return null;
    const draft = createAnimationCanvasDocument({
      brandId: identityId,
      createdAt: documentCreatedAt,
      id: `${identityId}:animation:scene`,
      revision: 1,
      sources: settledAnimationDocumentInput.value.sources,
      state: settledAnimationDocumentInput.value.state,
      title: `${identity?.name ?? 'Glyphfield'} Animation`,
      updatedAt: documentCreatedAt,
    });
    return {
      ...draft,
      revision: canvasDocumentContentRevision(draft, { omitMetadataKeys: ['peaks'] }),
    };
  }, [documentCreatedAt, identity?.name, identityId, presentationMode, settledAnimationDocumentInput.value]);
  const sources = resolvedSources;
  const fontSourcesRef = useCommittedRef(sources);
  const animationFonts = sources.filter((source) => source.kind === 'text')
    .map((source) => `${source.fontFamily}:${source.fontWeight}`).join('|');
  useEffect(() => {
    let cancelled = false;
    void waitForAnimationFonts(fontSourcesRef.current).then(() => {
      if (cancelled) return;
      previewDirtyRef.current = true;
      setFontRevision((revision) => revision + 1);
      requestPreviewFrameRef.current();
    }).catch(() => {
      if (!cancelled) setError('The animation font could not be loaded.');
    });
    return () => { cancelled = true; };
  }, [animationFonts, fontSourcesRef]);
  useEffect(() => {
    if (initialSelectionAppliedRef.current || sources.length === 0) return;
    if (selectedSourceId === 'brand-logo' && includeBrandLogo && !shownBrandLogo) return;
    initialSelectionAppliedRef.current = true;
    const initialSource = sources.find(({ id }) => id === selectedSourceId) ?? sources[0];
    setSelectedSourceId(initialSource.id);
    setSelectedTransitionIndex(null);
    setSelectedEffectTarget('content');
    setBackgroundEditScope('sequence');
    playheadRef.current = 0;
  }, [includeBrandLogo, selectedSourceId, shownBrandLogo, sources]);
  useEffect(() => {
    if (selectedTransitionIndex === null) return;
    if (sources.length < 2 || selectedTransitionIndex >= sources.length) {
      setSelectedTransitionIndex(null);
    }
  }, [selectedTransitionIndex, sources.length]);
  const animationWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identityId, 'animation'),
    [identityId]
  );
  const portableAnimation = usePortableCanvasWorkspace({
    applySource: applyStudioSource,
    document: animationDocument,
    suspendAutosave: settledAnimationDocumentInput.pending,
    workspaceKey: animationWorkspaceKey,
  });
  const animationSource = resolvedAnimationSource(
    settledAnimationDocumentInput.pending,
    portableAnimation.source
  );
  const autosaveState = resolvedAnimationAutosaveState(
    settledAnimationDocumentInput.pending,
    portableAnimation.autosaveState
  );
  const animationAutomationRef = useCommittedRef({
    applySource: applyStudioSource,
    exportAnimation: handleExport,
    invokeMotion: invokeMotionAction,
    prepareProjectFile,
    source: animationSource,
  });
  useEffect(() => {
    if (presentationMode) return;
    return registerStudioAutomation({
      actions: studioToolActionNames('animation'),
      applySource: (source) => animationAutomationRef.current.applySource(source),
      getSource: () => {
        const source = animationAutomationRef.current.source;
        if (source === null) throw new Error('The portable animation source is still preparing.');
        return source;
      },
      invoke: async (action, input) => {
        const motionResult = animationAutomationRef.current.invokeMotion(action, input);
        if (motionResult !== UNHANDLED_ACTION) return motionResult;
        if (action === 'animation.export.project') {
          const asset = await animationAutomationRef.current.prepareProjectFile();
          setLastExport(asset);
          return asset;
        }
        let format: AnimationExportFormat;
        let download = false;
        if (action === 'animation.export') {
          if (!input || typeof input !== 'object' || Array.isArray(input)) {
            throw new TypeError("animation.export requires { format: 'gif' | 'mp4' | 'png', download? }.");
          }
          const request = input as { download?: unknown; format?: unknown };
          if (request.format !== 'gif' && request.format !== 'mp4' && request.format !== 'png') {
            throw new TypeError('animation.export format must be gif, mp4, or png.');
          }
          if (request.download !== undefined && typeof request.download !== 'boolean') {
            throw new TypeError('animation.export download must be Boolean.');
          }
          format = request.format;
          download = request.download === true;
        } else if (action === 'animation.export.gif') {
          format = 'gif';
        } else if (action === 'animation.export.mp4') {
          format = 'mp4';
        } else if (action === 'animation.export.png') {
          format = 'png';
        } else {
          throw new RangeError(`Unknown Animation action: ${action}.`);
        }
        const asset = await animationAutomationRef.current.exportAnimation(format, true);
        if (!asset) throw new Error(`Animation could not export ${format.toUpperCase()}.`);
        if (download) downloadStudioArtifact(asset);
        return asset;
      },
      toolId: 'animation',
    }, workspaceRef.current);
  }, [animationAutomationRef, presentationMode]);
  const historySnapshot = useMemo(() => ({
    state: animationState, images, brandLogo, sourceIds: sources.map(({ id }) => id),
  }), [animationState, brandLogo, images, sources]);
  const actionHistory = useAnimationActionHistory({
    disabled: exportProgress !== null,
    enabled: animationHistoryEnabled(presentationMode, portableAnimation.autosaveState),
    onRestore: restoreAnimationHistory,
    scope: animationWorkspaceKey,
    value: historySnapshot,
    workspaceRef,
  });
  useEffect(() => {
    if (autosaveState === 'loading' || artboards.some(({ id }) => id === activeArtboardId)) return;
    const fallback = artboards[0];
    if (!fallback) return;
    activeArtboardIdRef.current = fallback.id;
    setActiveArtboardId(fallback.id);
  }, [activeArtboardId, activeArtboardIdRef, artboards, autosaveState, setActiveArtboardId]);
  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? null;
  const selectedFrameSettings = useMemo(() => resolveSelectedFrameSettings(
    selectedSource,
    resolvedFrameSettings,
    settings
  ), [resolvedFrameSettings, selectedSource, settings]);
  // Per-cut identity is kept while a cut's override and the defaults are unchanged.
  const transitionCacheRef = useRef(new Map<string, { inputs: readonly unknown[]; value: ReturnType<typeof resolveStudioTransitionSettings> }>());
  const transitionSettings = useMemo(() => {
    const previous = transitionCacheRef.current;
    const next = new Map<string, { inputs: readonly unknown[]; value: ReturnType<typeof resolveStudioTransitionSettings> }>();
    const resolved = sources.map((source) => {
      const inputs = [frameSettings[source.id]?.transition, settings.backgroundTransition, settings.bezier, settings.packageId] as const;
      const cached = previous.get(source.id);
      const value = cached && cached.inputs.every((entry, index) => Object.is(entry, inputs[index]))
        ? cached.value
        : resolveStudioTransitionSettings(settings, frameSettings[source.id]?.transition);
      next.set(source.id, { inputs, value });
      return value;
    });
    transitionCacheRef.current = next;
    return resolved;
  }, [frameSettings, settings, sources]);
  const selectedTransition = useMemo(() => selectedAnimationTransition(
    selectedTransitionIndex,
    sources,
    frameSettings,
    settings
  ), [frameSettings, selectedTransitionIndex, settings, sources]);
  const selectedTransitionSource = selectedTransition.source;
  const selectedTransitionSettings = selectedTransition.settings;
  const hasSelectedTransitionOverride = selectedTransition.hasOverride;
  const sequenceLayout = useStableSequenceLayout(resolveStudioSequenceLayout(
    sources.map(({ id }) => id),
    frameSettings,
    settings
  ));
  const totalMs = sequenceLayout.totalMs;
  const activeShaderSourceIds = new Set([
    sources[activeTimeline.index]?.id,
    sources[activeTimeline.nextIndex]?.id,
  ]);
  const directShaderComposite = canCompositeShaderDirectly(
    sources[activeTimeline.index],
    sources[activeTimeline.nextIndex],
    backgroundOverrides
  );
  const hasSequenceShaderSources = sequenceBackground.style === 'shader'
    && sources.some((source) => !backgroundOverrides[source.id]);
  const sequenceShaderIsActive = hasSequenceShaderSources
    && sources.some((source) => (
      activeShaderSourceIds.has(source.id) && !backgroundOverrides[source.id]
    ));
  const timelineRequiresShaderSync = sources.some((source) => backgroundOverrides[source.id])
    && (
      sequenceBackground.style === 'shader'
      || sources.some((source) => (
        backgroundOverrides[source.id] && source.background?.style === 'shader'
      ))
    );
  const sequenceShaderSettings = useMemo(() => ({
    ...settings.shaderSettings,
    ...sequenceBackground.materialSettings,
    colorA: sequenceBackground.colorA,
    colorB: sequenceBackground.colorB,
    colorC: sequenceBackground.colorC,
  }), [sequenceBackground, settings.shaderSettings]);
  const overrideShaderSettings = useMemo(() => new Map(
    sources.reduce<Array<[string, LiveMaterialSettings]>>((entries, source) => {
      if (!backgroundOverrides[source.id] || source.background?.style !== 'shader') return entries;
      entries.push([source.id, {
        ...settings.shaderSettings,
        ...source.background?.materialSettings,
        colorA: source.background?.colorA ?? settings.shaderSettings.colorA,
        colorB: source.background?.colorB ?? settings.shaderSettings.colorB,
        colorC: source.background?.colorC ?? settings.shaderSettings.colorC,
      }]);
      return entries;
    }, [])
  ), [backgroundOverrides, settings.shaderSettings, sources]);
  const canvasWidth = Math.max(120, settings.width);
  const canvasHeight = Math.max(120, settings.height);
  const resolvedPreviewFrameRate = Math.min(60, Math.max(12, previewFrameRate));
  const previewMaxPixelCount = interactiveAnimationPreviewPixelBudget(presentationMode);
  const selectedBounds = useMemo(() => animationSourceBounds(
    selectedSource,
    settings,
    canvasWidth,
    canvasHeight
  // fontRevision re-measures once the brand face finishes loading.
  ), [canvasHeight, canvasWidth, fontRevision, selectedSource, settings]);

  const settingsRef = useCommittedRef(settings);
  const sourcesRef = useCommittedRef(sources);
  const layoutRef = useCommittedRef(sequenceLayout);
  const selectedSourceIdRef = useCommittedRef(selectedSourceId);
  const frameSettingsRef = useCommittedRef(frameSettings);
  const imagesRef = useCommittedRef(images);
  const workspaceActiveRef = useCommittedRef(active);
  const viewportVisibleRef = useCommittedRef(viewportVisible);
  const isPlayingRef = useCommittedRef(isPlaying);
  const playbackRateRef = useCommittedRef(playbackRate);
  const audioStateRef = useCommittedRef(audioState);
  const activeTimelineRef = useCommittedRef(activeTimeline);
  const backgroundOverridesRef = useCommittedRef(backgroundOverrides);
  const timelineRequiresShaderSyncRef = useCommittedRef(timelineRequiresShaderSync);

  const selectDisplayedSource = useCallback((index: number) => {
    const sourceId = sourcesRef.current[index]?.id ?? null;
    if (selectedSourceIdRef.current === sourceId) return;
    selectedSourceIdRef.current = sourceId;
    // Following the displayed scene is low priority: it must never cost a frame.
    startTransition(() => setSelectedSourceId(sourceId));
  }, [selectedSourceIdRef, sourcesRef]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const updateResolution = () => {
      const bounds = canvas.getBoundingClientRect();
      const next = resolveAnimationPreviewResolution({
        devicePixelRatio: window.devicePixelRatio,
        logicalHeight: canvasHeight,
        logicalWidth: canvasWidth,
        maxPixelCount: previewMaxPixelCount,
        viewportHeight: bounds.height,
        viewportWidth: bounds.width,
      });
      const current = previewResolutionRef.current;
      if (current.width === next.width && current.height === next.height) return;
      previewResolutionRef.current = next;
      previewDirtyRef.current = true;
      requestPreviewFrameRef.current();
    };
    updateResolution();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateResolution);
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [canvasHeight, canvasWidth, previewMaxPixelCount]);

  const getAudioContext = useCallback(() => {
    audioContextRef.current ??= createBrowserAudioContext();
    return audioContextRef.current;
  }, []);

  const stopAudioPlayback = useCallback(() => {
    audioScheduleRevisionRef.current += 1;
    for (const source of audioPlaybackNodesRef.current) {
      try {
        source.stop();
      } catch {
        // A source that already ended is safe to discard.
      }
    }
    audioPlaybackNodesRef.current = [];
  }, []);

  const clearAudioBuffers = useCallback(() => {
    audioHydrationGenerationRef.current += 1;
    audioBuffersRef.current.clear();
  }, []);

  const hydrateAudioBuffers = useCallback(async (assets: readonly AnimationAudioAsset[]) => {
    if (assets.length === 0) return;
    const generation = audioHydrationGenerationRef.current;
    const isCurrentAsset = (asset: AnimationAudioAsset) => generation === audioHydrationGenerationRef.current
      && audioStateRef.current.assets.some((current) => current.id === asset.id && current.source === asset.source);
    const context = getAudioContext();
    let changed = false;
    const hydrated = new Map<string, Pick<AnimationAudioAsset, 'durationMs' | 'peaks' | 'source'>>();
    for (const asset of assets) {
      if (!isCurrentAsset(asset)) return;
      let buffer = audioBuffersRef.current.get(asset.id);
      if (!buffer) {
        buffer = await decodeAudioSource(context, asset.source);
        if (!isCurrentAsset(asset)) return;
        audioBuffersRef.current.set(asset.id, buffer);
        changed = true;
      }
      if (asset.peaks.length === 0 || Math.abs(asset.durationMs - buffer.duration * 1_000) > 1) {
        hydrated.set(asset.id, {
          durationMs: Math.round(buffer.duration * 1_000),
          peaks: audioPeaks(buffer),
          source: asset.source,
        });
      }
    }
    if (hydrated.size > 0) {
      setAudioState((current) => {
        if (generation !== audioHydrationGenerationRef.current) return current;
        const assets = current.assets.map((asset) => {
          const patch = hydrated.get(asset.id);
          return patch?.source === asset.source ? { ...asset, ...patch } : asset;
        });
        return assets.every((asset, index) => asset === current.assets[index]) ? current : { ...current, assets };
      });
    }
    if (changed) setAudioBufferRevision((revision) => revision + 1);
  }, [audioStateRef, getAudioContext]);

  const scheduleAudioPlayback = useCallback(async (timeMs: number) => {
    stopAudioPlayback();
    if (!audioPlaybackRequestedRef.current || !isPlayingRef.current || !workspaceVisibleRef.current) return;
    const scheduleRevision = audioScheduleRevisionRef.current;
    const state = audioStateRef.current;
    if (state.muted || state.volume <= 0 || state.clips.length === 0) return;
    try {
      await hydrateAudioBuffers(state.assets);
      if (!isPlayingRef.current || !workspaceVisibleRef.current || audioScheduleRevisionRef.current !== scheduleRevision) return;
      const context = getAudioContext();
      try {
        await context.resume();
      } catch {
        // Browsers may defer audible playback until the first user gesture.
        return;
      }
      if (context.state !== 'running' || !workspaceVisibleRef.current || audioScheduleRevisionRef.current !== scheduleRevision) return;
      const rate = playbackRateRef.current;
      const now = context.currentTime;
      const nextNodes: AudioBufferSourceNode[] = [];
      for (const clip of state.clips) {
        if (animationAudioClipEndMs(clip) <= timeMs || clip.volume <= 0) continue;
        const buffer = audioBuffersRef.current.get(clip.assetId);
        if (!buffer) continue;
        const elapsedClipMs = Math.max(0, timeMs - clip.timelineStartMs);
        const sourceOffsetMs = clip.trimStartMs + elapsedClipMs;
        const remainingMs = clip.trimEndMs - sourceOffsetMs;
        if (remainingMs <= 0) continue;
        const source = context.createBufferSource();
        const gain = context.createGain();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        gain.gain.value = state.volume * clip.volume;
        source.connect(gain).connect(context.destination);
        const delaySeconds = Math.max(0, clip.timelineStartMs - timeMs) / 1000 / rate;
        source.start(now + delaySeconds, sourceOffsetMs / 1000, remainingMs / 1000);
        nextNodes.push(source);
      }
      audioPlaybackNodesRef.current = nextNodes;
    } catch {
      setError(gt('The audio track could not be decoded in this browser.'));
    }
  }, [audioStateRef, getAudioContext, gt, hydrateAudioBuffers, isPlayingRef, playbackRateRef, stopAudioPlayback]);

  const syncWorkspaceVisibility = useCallback((projectActive: boolean) => {
    const visible = projectActive
      && workspaceActiveRef.current
      && viewportVisibleRef.current
      && workspaceIntersectingRef.current
      && document.visibilityState !== 'hidden';
    workspaceVisibleRef.current = visible;
    previewClockResetRef.current = true;
    if (!visible) {
      stopAudioPlayback();
      return;
    }
    requestPreviewFrameRef.current();
    if (isPlayingRef.current) {
      audioPlaybackRequestedRef.current = true;
      void scheduleAudioPlayback(playheadRef.current);
    }
  }, [isPlayingRef, scheduleAudioPlayback, stopAudioPlayback, viewportVisibleRef, workspaceActiveRef]);

  const projectWorkspaceActiveRef = useAncestorWorkspaceActivity(workspaceRef, syncWorkspaceVisibility);

  useEffect(() => {
    setAudioState((current) => current.clips.length === 0
      ? current
      : normalizeAnimationAudioState(current, totalMs));
  }, [totalMs]);

  useEffect(() => {
    if (!isPlaying) {
      stopAudioPlayback();
      return;
    }
    void scheduleAudioPlayback(playheadRef.current);
    return stopAudioPlayback;
  }, [audioBufferRevision, audioState, isPlaying, playbackRate, scheduleAudioPlayback, stopAudioPlayback]);

  useEffect(() => {
    if (audioState.clips.length === 0) return;
    const unlockAudio = () => {
      if (!audioPlaybackRequestedRef.current || !isPlayingRef.current) return;
      const context = getAudioContext();
      if (context.state === 'running') return;
      void context.resume().then(() => {
        if (context.state === 'running' && isPlayingRef.current) {
          void scheduleAudioPlayback(playheadRef.current);
        }
      }).catch(() => {
        // The next explicit play action can retry if this gesture is not accepted.
      });
    };
    document.addEventListener('pointerdown', unlockAudio, { capture: true, once: true });
    document.addEventListener('keydown', unlockAudio, { capture: true, once: true });
    return () => {
      document.removeEventListener('pointerdown', unlockAudio, { capture: true });
      document.removeEventListener('keydown', unlockAudio, { capture: true });
    };
  }, [audioState.clips.length, getAudioContext, isPlayingRef, scheduleAudioPlayback]);

  useEffect(() => () => {
    clearAudioBuffers();
    stopAudioPlayback();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    void closeBrowserAudioContext(context);
  }, [clearAudioBuffers, stopAudioPlayback]);

  useEffect(() => {
    previewDirtyRef.current = true;
    requestPreviewFrameRef.current();
  }, [sequenceLayout, settings, sources]);

  useMountEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const observer = new IntersectionObserver(([entry]) => {
      workspaceIntersectingRef.current = entry?.isIntersecting ?? true;
      syncWorkspaceVisibility(projectWorkspaceActiveRef.current);
    });
    observer.observe(workspace);
    return () => observer.disconnect();
  });

  useMountEffect(() => {
    if (!starterDefaults) return;
    // Persist the starter as drafts at once, so a reload or remount reopens the
    // same complete sequence instead of mixing it with legacy defaults.
    setStoredSettings({ ...starterDefaults.settings });
    try {
      // Equal strings are not rewritten by the draft hook; record the starter text explicitly.
      window.localStorage.setItem(`glyphfield-draft-v1:${identityId}:animation:text-frames`, JSON.stringify(starterDefaults.textFrames));
    } catch {
      // Storage can be unavailable; the in-memory starter stays authoritative.
    }
    setIncludeBrandLogo(starterDefaults.includeBrandLogo);
    setSequenceOrder([...starterDefaults.sequenceOrder]);
    setFrameSettings({ ...starterDefaults.frameSettings });
    setStoredSequenceBackground({ ...starterDefaults.sequenceBackground });
    setBackgroundOverrides({ ...starterDefaults.backgroundOverrides });
  });

  useMountEffect(() => {
    if (qualityDefaultsMigrated) return;
    setStoredSettings((current) => ({
      ...current,
      colors: current.colors <= 64 ? 256 : current.colors,
    }));
    setQualityDefaultsMigrated(true);
  });

  useMountEffect(() => {
    if (backgroundScopeMigrated) return;
    try {
      const storagePrefix = `glyphfield-draft-v1:${identityId}:animation:`;
      const savedSettings = JSON.parse(window.localStorage.getItem(`${storagePrefix}settings`) ?? '{}') as Partial<StudioSettings>;
      const savedFrames = JSON.parse(window.localStorage.getItem(`${storagePrefix}frame-settings`) ?? '{}') as Record<string, StudioFrameSettings>;
      const legacySettings: StudioSettings = {
        ...identitySettings,
        ...savedSettings,
        shaderSettings: {
          ...identitySettings.shaderSettings,
          ...savedSettings.shaderSettings,
        },
      };
      const defaultFingerprint = JSON.stringify(createDefaultFrameSettings(legacySettings).background);
      const inferredOverrides = Object.fromEntries(
        Object.entries(savedFrames).reduce<Array<[string, true]>>((entries, [id, frame]) => {
          if (JSON.stringify(frame.background) !== defaultFingerprint) entries.push([id, true]);
          return entries;
        }, [])
      );
      if (Object.keys(inferredOverrides).length > 0) {
        setBackgroundOverrides(inferredOverrides);
      }
    } catch {
      // Invalid legacy drafts are ignored by the persistent-state hook as well.
    }
    setBackgroundScopeMigrated(true);
  });

  // The identity mark follows the field: light marks on dark fields, dark marks
  // on light ones. A logo restored from a project file is never replaced.
  const brandLogoAssetPath = brandLogoPathFor(identity, sequenceBackground.colorA);
  const brandLogoFromProjectRef = useRef(false);
  useEffect(() => {
    const sourceSequence = sourceApplySequenceRef.current;
    const brandLogoAsset = brandLogoAssetFor(identity, sequenceBackground.colorA);
    if (!brandLogoAsset || brandLogoFromProjectRef.current) return;
    let cancelled = false;
    void loadImageSource(brandLogoAsset.path, brandLogoAsset.label)
      .then((source) => {
        if (!cancelled && sourceSequence === sourceApplySequenceRef.current && !brandLogoFromProjectRef.current) setBrandLogo(source);
      })
      .catch(() => {
        if (!cancelled) {
          setFailedBrandLogoPath(brandLogoAsset.path);
          setError(translateRef.current('The brand logo could not be loaded.'));
          setSelectedSourceId((current) => current === 'brand-logo' ? 'text-0' : current);
        }
      });
    return () => {
      cancelled = true;
    };
  // Only a different artwork path reloads the mark; the translator and asset
  // object change identity between renders and must never retrigger the load.
  }, [brandLogoAssetPath]);

  useEffect(() => {
    if (!active) {
      audioPlaybackRequestedRef.current = false;
      isPlayingRef.current = false;
      setIsPlaying(false);
    }
    syncWorkspaceVisibility(projectWorkspaceActiveRef.current);
  }, [active, isPlayingRef, projectWorkspaceActiveRef, syncWorkspaceVisibility, viewportVisible]);

  const brandLogoSource = animationBrandLogoSource(brandLogo);
  useEffect(() => {
    const source = brandLogoSource;
    if (presentationMode || !source || /^data:[^;,]+;base64,/i.test(source)) return;
    let active = true;
    void imageUrlToDataUrl(source).then((embeddedSource) => {
      if (!active || embeddedSource === source) return;
      setBrandLogo((current) => current?.kind === 'image' && current.url === source
        ? { ...current, url: embeddedSource }
        : current);
    }).catch(() => {
      if (active) setError(translateRef.current('The brand logo could not be embedded for sharing.'));
    });
    return () => {
      active = false;
    };
  }, [brandLogoSource, presentationMode, translateRef]);

  const attachedShaderCacheRef = useRef(new WeakMap<StudioSource, { image: HTMLCanvasElement; source: StudioSource }>());
  const attachShaderLayers = useCallback((currentSources: readonly StudioSource[]): StudioSource[] => {
    if (!shaderPresentationReadyRef.current) return [...currentSources];
    return currentSources.map((source) => {
      if (source.background?.style !== 'shader') return source;
      const wrapper = backgroundOverridesRef.current[source.id]
        ? shaderLayerRefs.current.get(source.id)
        : sequenceShaderLayerRef.current;
      const image = wrapper?.querySelector('canvas');
      if (!image) return source;
      // Reuse the attached copy so memoized thumbnails keep a stable source.
      const cached = attachedShaderCacheRef.current.get(source);
      if (cached?.image === image) return cached.source;
      const attached = {
        ...source,
        background: { ...source.background, image, shaderPresentation: readLiveMaterialPresentation(wrapper ?? null) },
      };
      attachedShaderCacheRef.current.set(source, { image, source: attached });
      return attached;
    });
  }, []);

  useMountEffect(() => {
    let disposed = false;
    // One deduplicated decode for this workspace, never async work in a tick.
    void preloadShaderFramePresentation({ grainOpacity: 1 }).then(() => {
      if (disposed) return;
      setShaderPresentationReady(true);
      previewDirtyRef.current = true;
      requestPreviewFrameRef.current();
    }).catch((error: unknown) => {
      if (!disposed) setError(error instanceof Error ? error.message : 'The shader presentation could not be loaded.');
    });
    return () => { disposed = true; };
  });

  useMountEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      isPlayingRef.current = false;
      setIsPlaying(false);
    }

    let animationFrame: number | null = null;
    let sleepTimer = 0;
    let disposed = false;
    let previousTimestamp = performance.now();
    const framePacer = createLiveMaterialFramePacer();
    let previousRenderedSourceId = '';

    function requestTick() {
      window.clearTimeout(sleepTimer);
      sleepTimer = 0;
      if (disposed || animationFrame !== null) return;
      animationFrame = requestAnimationFrame(tick);
    }

    // Playback wakes for due frames only. Every requested frame costs the page a
    // style, layout and layerize pass, so a 60 fps preview on a 120 Hz display
    // would otherwise pay that twice per drawn frame.
    function requestNextPlaybackTick(frameTime: number) {
      // The pacer runs on frame timestamps; the work already done this frame is spent.
      const delayMs = framePacer.delayUntilNext(frameTime) - Math.max(0, performance.now() - frameTime);
      if (delayMs < 10) {
        requestTick();
        return;
      }
      sleepTimer = window.setTimeout(requestTick, delayMs - 8);
    }

    function tick(timestamp: number) {
      animationFrame = null;
      if (disposed) return;
      if (!workspaceVisibleRef.current || document.visibilityState === 'hidden') {
        previousTimestamp = timestamp;
        return;
      }
      const resetClock = previewClockResetRef.current;
      previewClockResetRef.current = false;
      const elapsed = resetClock || !isPlayingRef.current
        ? 0
        : Math.min(100, timestamp - previousTimestamp);
      previousTimestamp = timestamp;
      const currentSettings = settingsRef.current;
      const currentSources = sourcesRef.current;
      const currentLayout = layoutRef.current;
      const playbackWasRunning = isPlayingRef.current;
      const duration = currentLayout.totalMs;

      if (isPlayingRef.current && duration > 0) {
        const previousPlayheadMs = playheadRef.current;
        const advance = advancePlaybackTime({
          currentTimeMs: playheadRef.current,
          durationMs: duration,
          elapsedMs: elapsed,
          loop: currentSettings.loop,
          playbackRate: playbackRateRef.current,
        });
        playheadRef.current = advance.timeMs;
        if (!advance.stopped && advance.timeMs < previousPlayheadMs) {
          void scheduleAudioPlayback(advance.timeMs);
        }
        if (advance.stopped) {
          audioPlaybackRequestedRef.current = false;
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      }
      const frameIsDue = framePacer.shouldDraw(
        timestamp,
        resolvedPreviewFrameRate,
        !isPlayingRef.current || previewDirtyRef.current || resetClock
      );
      // The playhead UI moves on the frames the preview draws: on a 120 Hz display a
      // 60 fps preview would otherwise pay for timeline updates nobody sees drawn.
      if (frameIsDue) publishPlayhead(playheadRef.current);

      const position = resolveSequencePosition(playheadRef.current, currentLayout);
      if (playbackWasRunning) selectDisplayedSource(position.index);
      const previousActiveTimeline = activeTimelineRef.current;
      if (
        timelineRequiresShaderSyncRef.current
        && animationTimelineChanged(position, previousActiveTimeline)
      ) {
        const nextActiveTimeline = { index: position.index, nextIndex: position.nextIndex };
        activeTimelineRef.current = nextActiveTimeline;
        setActiveTimeline(nextActiveTimeline);
      }

      const previewRender = renderInteractiveAnimationPreview({
        attachShaderLayers,
        backgroundOverrides: backgroundOverridesRef.current,
        canvas: canvasRef.current,
        currentSettings,
        currentSources,
        dragPreview: dragPreviewRef.current,
        frameIsDue,
        frameSettings: frameSettingsRef.current,
        position,
        previewDirty: previewDirtyRef.current,
        previousRenderedSourceId,
        previewResolution: previewResolutionRef.current,
        shaderPresentationReady: shaderPresentationReadyRef.current,
      });
      if (previewRender.rendered) {
        previousRenderedSourceId = previewRender.sourceId;
        previewDirtyRef.current = false;
      }
      if (isPlayingRef.current) requestNextPlaybackTick(timestamp);
    }

    const handleVisibilityChange = () => {
      syncWorkspaceVisibility(projectWorkspaceActiveRef.current);
    };
    requestPreviewFrameRef.current = requestTick;
    document.addEventListener('visibilitychange', handleVisibilityChange);
    requestTick();
    return () => {
      disposed = true;
      requestPreviewFrameRef.current = () => undefined;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      window.clearTimeout(sleepTimer);
      for (const image of imagesRef.current) URL.revokeObjectURL(image.url);
    };
  });

  function updateSettings(patch: Partial<StudioSettings>) {
    setStoredSettings((current) => ({ ...current, ...patch }));
  }

  function applyArtboardSnapshot(snapshot: AnimationArtboardSnapshot) {
    clearAudioBuffers();
    setShaderFrameStates(new Map());
    setShaderCaptureTimeMs(null);
    const next = cloneAnimationArtboardSnapshot(snapshot);
    setAudioState(normalizeAnimationAudioState(
      next.audio ?? createEmptyAnimationAudioState(),
      resolveStudioSequenceLayout(sources.map(({ id }) => id), next.frameSettings, next.settings).totalMs
    ));
    setStoredSettings(next.settings);
    setFrameSettings(next.frameSettings);
    setStoredSequenceBackground(next.sequenceBackground);
    setBackgroundOverrides(next.backgroundOverrides);
    setSequenceOrder(next.sequenceOrder);
    setSelectedSourceId(next.sequenceOrder[0] ?? (includeBrandLogo && shownBrandLogo ? 'brand-logo' : 'text-0'));
    setSelectedTransitionIndex(null);
    setBackgroundEditScope('sequence');
    setSelectedEffectTarget('content');
    setLastExport(null);
    seek(0);
  }

  function activateArtboard(id: AnimationArtboardId) {
    if (id === activeArtboardIdRef.current) return;
    const committed = workspaceArtboardsRef.current.map((artboard) => (
      artboard.id === activeArtboardIdRef.current
        ? { ...artboard, snapshot: cloneAnimationArtboardSnapshot(currentArtboardSnapshotRef.current) }
        : artboard
    ));
    const nextArtboard = committed.find((artboard) => artboard.id === id);
    if (!nextArtboard) return;
    const snapshot = cloneAnimationArtboardSnapshot(nextArtboard.snapshot);
    workspaceArtboardsRef.current = committed;
    activeArtboardIdRef.current = id;
    currentArtboardSnapshotRef.current = snapshot;
    setArtboards(committed);
    setActiveArtboardId(id);
    applyArtboardSnapshot(snapshot);
  }

  function addArtboard() {
    const usedSizes = new Set(workspaceArtboardsRef.current.map(({ snapshot }) => (
      `${snapshot.settings.width}x${snapshot.settings.height}`
    )));
    const preset = ANIMATION_ARTBOARD_PRESETS.find(({ height, width }) => !usedSizes.has(`${width}x${height}`))
      ?? ANIMATION_ARTBOARD_PRESETS[workspaceArtboardsRef.current.length % ANIMATION_ARTBOARD_PRESETS.length]!;
    const id = `animation-artboard-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as AnimationArtboardId;
    const snapshot = cloneAnimationArtboardSnapshot(currentArtboardSnapshotRef.current);
    snapshot.settings = { ...snapshot.settings, height: preset.height, width: preset.width };
    const committed = workspaceArtboardsRef.current.map((artboard) => artboard.id === activeArtboardIdRef.current
      ? { ...artboard, snapshot: cloneAnimationArtboardSnapshot(currentArtboardSnapshotRef.current) }
      : artboard);
    const nextArtboard: AnimationArtboard = {
      id,
      name: `${preset.label} animation`,
      snapshot,
    };
    const nextArtboards = [...committed, nextArtboard];
    workspaceArtboardsRef.current = nextArtboards;
    activeArtboardIdRef.current = id;
    currentArtboardSnapshotRef.current = snapshot;
    setArtboards(nextArtboards);
    setActiveArtboardId(id);
    applyArtboardSnapshot(snapshot);
  }

  function duplicateArtboard() {
    if (!activeArtboard) return;
    const id = `animation-artboard-${globalThis.crypto?.randomUUID?.() ?? Date.now()}` as AnimationArtboardId;
    const snapshot = cloneAnimationArtboardSnapshot(currentArtboardSnapshotRef.current);
    const committed = workspaceArtboardsRef.current.map((artboard) => artboard.id === activeArtboardIdRef.current
      ? { ...artboard, snapshot: cloneAnimationArtboardSnapshot(currentArtboardSnapshotRef.current) }
      : artboard);
    const nextArtboards = [...committed, {
      id,
      name: `${activeArtboard.name} copy`,
      snapshot,
    }];
    workspaceArtboardsRef.current = nextArtboards;
    activeArtboardIdRef.current = id;
    currentArtboardSnapshotRef.current = snapshot;
    setArtboards(nextArtboards);
    setActiveArtboardId(id);
    applyArtboardSnapshot(snapshot);
  }

  function removeActiveArtboard() {
    const current = workspaceArtboardsRef.current;
    if (current.length <= 1) return;
    const activeIndex = current.findIndex(({ id }) => id === activeArtboardIdRef.current);
    const fallback = current[activeIndex === current.length - 1 ? activeIndex - 1 : activeIndex + 1];
    if (!fallback) return;
    const nextArtboards = current.filter(({ id }) => id !== activeArtboardIdRef.current);
    const snapshot = cloneAnimationArtboardSnapshot(fallback.snapshot);
    workspaceArtboardsRef.current = nextArtboards;
    activeArtboardIdRef.current = fallback.id;
    currentArtboardSnapshotRef.current = snapshot;
    setArtboards(nextArtboards);
    setActiveArtboardId(fallback.id);
    applyArtboardSnapshot(snapshot);
  }

  function renameActiveArtboard(name: string) {
    const nextName = name.slice(0, 48);
    const nextArtboards = workspaceArtboardsRef.current.map((artboard) => (
      artboard.id === activeArtboardIdRef.current ? { ...artboard, name: nextName } : artboard
    ));
    workspaceArtboardsRef.current = nextArtboards;
    setArtboards(nextArtboards);
  }

  function addTextSource() {
    const lines = textFrames.length > 0 ? textFrames.split('\n') : [];
    let number = lines.length + 1;
    let label = number === 1 ? 'New frame' : `New frame ${number}`;
    const existing = new Set(lines);
    while (existing.has(label)) {
      number += 1;
      label = `New frame ${number}`;
    }
    const id = `text-${lines.length}`;
    const { color } = canvasInsertionColors();
    setFrameSettings((current) => ({
      ...current,
      [id]: { ...createDefaultFrameSettings(frameResolutionSettings), foreground: color },
    }));
    setTextFrames([...lines, label].join('\n'));
    setMode('sequence');
    setSelectedTransitionIndex(null);
    setSelectedSourceId(id);
    setSelectedEffectTarget('content');
    setBackgroundEditScope('sequence');
    changePlaying(false);
    playheadRef.current = totalMs;
  }

  function updateTextSource(id: string, value: string) {
    const index = Number.parseInt(id.replace('text-', ''), 10);
    if (!Number.isInteger(index) || index < 0) return;
    setTextFrames((current) => {
      const lines = current.split('\n');
      if (index >= lines.length) return current;
      lines[index] = value;
      return lines.join('\n');
    });
  }

  async function importFiles(files: FileList) {
    try {
      const imageFiles = Array.from(files).reduce<File[]>((accepted, file) => {
        if (file.type.startsWith('image/')) accepted.push(file);
        return accepted;
      }, []);
      const imported = await Promise.all(imageFiles.map(loadImportedImage));
      setImages((current) => [...current, ...imported]);
      if (imported[0]) {
        setSelectedTransitionIndex(null);
        setSelectedSourceId(imported[0].id);
        setSelectedEffectTarget('content');
      }
      setMode('sequence');
      setError(null);
      seek(0);
    } catch {
      setError(gt('One or more images could not be decoded.'));
    }
  }

  async function importAudioFiles(files: FileList) {
    const audioFiles = Array.from(files).filter((file) => file.type.startsWith('audio/'));
    if (audioFiles.length === 0) {
      setError(gt('Choose an audio file to add to the timeline.'));
      return;
    }
    try {
      const context = getAudioContext();
      const assets: AnimationAudioAsset[] = [];
      const clips: AnimationAudioState['clips'][number][] = [];
      let cursorMs = Math.min(playheadRef.current, Math.max(0, totalMs - 100));
      for (const file of audioFiles) {
        const [source, buffer] = await Promise.all([
          blobToDataUrl(file),
          context.decodeAudioData(await file.arrayBuffer()),
        ]);
        const assetId = globalThis.crypto?.randomUUID?.() ?? `audio-${Date.now()}-${assets.length}`;
        const clipId = globalThis.crypto?.randomUUID?.() ?? `clip-${Date.now()}-${clips.length}`;
        const durationMs = Math.round(buffer.duration * 1000);
        if (durationMs < 100) continue;
        if (totalMs - cursorMs < 100) cursorMs = 0;
        const asset: AnimationAudioAsset = {
          durationMs,
          id: assetId,
          mimeType: file.type || 'audio/mpeg',
          name: file.name,
          peaks: audioPeaks(buffer),
          source,
        };
        assets.push(asset);
        audioBuffersRef.current.set(assetId, buffer);
        const clipDurationMs = totalMs > 0
          ? Math.min(durationMs, Math.max(100, totalMs - cursorMs))
          : durationMs;
        clips.push({
          assetId,
          id: clipId,
          timelineStartMs: cursorMs,
          trimEndMs: clipDurationMs,
          trimStartMs: 0,
          volume: 1,
        });
        cursorMs += clipDurationMs;
      }
      if (assets.length === 0) throw new Error('Audio clips must be at least 100ms long.');
      setAudioState((current) => normalizeAnimationAudioState({
        ...current,
        assets: [...current.assets, ...assets],
        clips: [...current.clips, ...clips],
      }, totalMs));
      setSelectedAudioClipId(clips[0]?.id ?? null);
      setAudioBufferRevision((revision) => revision + 1);
      setError(null);
    } catch {
      setError(gt('One or more audio files could not be decoded.'));
    }
  }

  function updateAudioClip(clipId: string, patch: Partial<AnimationAudioState['clips'][number]>) {
    setAudioState((current) => updateAnimationAudioClip(current, clipId, patch, totalMs));
  }

  function removeAudioClip(clipId: string) {
    setAudioState((current) => {
      const next = removeAnimationAudioClip(current, clipId);
      const retained = new Set(next.assets.map(({ id }) => id));
      for (const assetId of audioBuffersRef.current.keys()) {
        if (!retained.has(assetId)) audioBuffersRef.current.delete(assetId);
      }
      return next;
    });
    setSelectedAudioClipId((current) => current === clipId ? null : current);
  }

  function splitAudioClip(clipId: string) {
    const nextId = globalThis.crypto?.randomUUID?.() ?? `clip-${Date.now()}`;
    const next = splitAnimationAudioClip(
      audioState,
      clipId,
      playheadRef.current,
      nextId,
      totalMs
    );
    if (next === audioState) return;
    setAudioState(next);
    setSelectedAudioClipId(nextId);
  }

  function removeImage(id: string) {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((image) => image.id !== id);
    });
    setFrameSettings((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setBackgroundOverrides((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    if (selectedSourceId === id) {
      setSelectedSourceId(null);
      setBackgroundEditScope('sequence');
    }
    seek(0);
  }

  function removeSource(id: string) {
    const source = sources.find((candidate) => candidate.id === id);
    if (!source) return;
    if (source.id === 'brand-logo') {
      setIncludeBrandLogo(false);
    } else if (source.kind === 'image') {
      removeImage(source.id);
      return;
    } else {
      const removedIndex = Number.parseInt(source.id.replace('text-', ''), 10);
      if (!Number.isInteger(removedIndex) || removedIndex < 0) return;
      const lines = textFrames.split('\n');
      lines.splice(removedIndex, 1);
      setTextFrames(lines.length > 0 ? lines.join('\n') : 'New frame');
      setFrameSettings((current) => Object.fromEntries(Object.entries(current).flatMap(([key, value]) => {
        if (!key.startsWith('text-')) return [[key, value]];
        const index = Number.parseInt(key.replace('text-', ''), 10);
        if (index === removedIndex) return [];
        return [[index > removedIndex ? `text-${index - 1}` : key, value]];
      })));
      setBackgroundOverrides((current) => Object.fromEntries(Object.entries(current).flatMap(([key, value]) => {
        if (!key.startsWith('text-')) return [[key, value]];
        const index = Number.parseInt(key.replace('text-', ''), 10);
        if (index === removedIndex) return [];
        return [[index > removedIndex ? `text-${index - 1}` : key, value]];
      })));
      setSequenceOrder((current) => current.flatMap((key) => {
        if (!key.startsWith('text-')) return [key];
        const index = Number.parseInt(key.replace('text-', ''), 10);
        if (index === removedIndex) return [];
        return [index > removedIndex ? `text-${index - 1}` : key];
      }));
    }
    setSelectedSourceId(shownBrandLogo ? 'brand-logo' : 'text-0');
    setSelectedTransitionIndex(null);
    setSelectedEffectTarget('content');
    setBackgroundEditScope('sequence');
    seek(0);
  }

  function moveSource(id: string, direction: -1 | 1) {
    const currentOrder = sources.map((source) => source.id);
    const index = currentOrder.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(index, 1);
    if (!moved) return;
    nextOrder.splice(target, 0, moved);
    setSequenceOrder(nextOrder);
  }

  function updateSelectedFrame(patch: Partial<StudioFrameSettings>) {
    if (!selectedSource) return;
    const { alignX, alignY, opacity, rotation, scale, ...rest } = patch;
    const pose = Object.fromEntries(Object.entries({ alignX, alignY, opacity, rotation, scale })
      .filter(([, value]) => value !== undefined)) as Partial<AnimationPose>;
    if (Object.keys(pose).length > 0 && frameSettingsRef.current[selectedSource.id]?.keyframes?.length) {
      updatePose(selectedSource.id, pose);
      if (Object.keys(rest).length === 0) return;
      patch = rest;
    }
    setFrameSettings((current) => {
      const base = current[selectedSource.id] ?? createDefaultFrameSettings(settings);
      return {
        ...current,
        [selectedSource.id]: {
          ...base,
          ...patch,
          background: patch.background ?? base.background,
        },
      };
    });
  }

  /** Time into a scene's hold at the playhead (0 when another scene is displayed). */
  function sceneTimeFor(sourceId: string): number {
    const index = sourcesRef.current.findIndex(({ id }) => id === sourceId);
    const position = resolveSequencePosition(playheadRef.current, layoutRef.current);
    if (index < 0 || position.index !== index) return 0;
    return Math.round(position.sceneElapsedMs ?? 0);
  }

  function keyframeTolerance(): number {
    return Math.max(4, 500 / Math.max(1, settingsRef.current.fps));
  }

  function patchStoredFrame(sourceId: string, update: (frame: StudioFrameSettings) => StudioFrameSettings) {
    setFrameSettings((current) => {
      const base = current[sourceId] ?? createDefaultFrameSettings(settingsRef.current);
      const next = update(base);
      return next === base ? current : { ...current, [sourceId]: next };
    });
    previewDirtyRef.current = true;
    requestPreviewFrameRef.current();
  }

  /** Static pose without keyframes; with keyframes, writes (or inserts) the keyframe at the playhead. */
  function updatePose(sourceId: string, patch: Partial<AnimationPose>, atMs = sceneTimeFor(sourceId)) {
    patchStoredFrame(sourceId, (frame) => {
      if (!frame.keyframes?.length) return { ...frame, ...patch };
      const merged = mergeStudioFrameSettings(settingsRef.current, frame);
      const pose = { ...resolveKeyframePose(poseFromFrame(merged), frame.keyframes, atMs), ...patch };
      return { ...frame, keyframes: upsertKeyframe(frame.keyframes, atMs, pose, keyframeTolerance(), newKeyframeId) };
    });
  }

  function addKeyframe(sourceId: string, atMs = sceneTimeFor(sourceId)) {
    patchStoredFrame(sourceId, (frame) => {
      const merged = mergeStudioFrameSettings(settingsRef.current, frame);
      const pose = resolveKeyframePose(poseFromFrame(merged), frame.keyframes, atMs);
      return { ...frame, keyframes: upsertKeyframe(frame.keyframes, atMs, pose, keyframeTolerance(), newKeyframeId) };
    });
  }

  function removeKeyframe(sourceId: string, keyframeId: string) {
    patchStoredFrame(sourceId, (frame) => {
      const removed = frame.keyframes?.find(({ id }) => id === keyframeId);
      if (!removed) return frame;
      const keyframes = frame.keyframes!.filter(({ id }) => id !== keyframeId);
      // Removing the last keyframe keeps its pose as the scene's static pose.
      return keyframes.length > 0
        ? { ...frame, keyframes }
        : { ...frame, ...poseFromFrame(removed), keyframes: undefined };
    });
  }

  function changeKeyframe(sourceId: string, keyframeId: string, patch: AnimationKeyframePatch) {
    const index = sourcesRef.current.findIndex(({ id }) => id === sourceId);
    const holdMs = layoutRef.current.holds[index] ?? settingsRef.current.holdMs;
    patchStoredFrame(sourceId, (frame) => {
      if (!frame.keyframes?.some(({ id }) => id === keyframeId)) return frame;
      let keyframes: AnimationKeyframe[] = frame.keyframes;
      if (patch.easing) keyframes = keyframes.map((keyframe) => keyframe.id === keyframeId ? { ...keyframe, easing: patch.easing! } : keyframe);
      if (patch.atMs !== undefined) keyframes = retimeKeyframe(keyframes, keyframeId, patch.atMs, holdMs);
      return { ...frame, keyframes };
    });
  }

  function clearKeyframes(sourceId: string) {
    const atMs = sceneTimeFor(sourceId);
    patchStoredFrame(sourceId, (frame) => {
      if (!frame.keyframes?.length) return frame;
      const merged = mergeStudioFrameSettings(settingsRef.current, frame);
      return { ...frame, ...resolveKeyframePose(poseFromFrame(merged), frame.keyframes, atMs), keyframes: undefined };
    });
  }

  function applyMotionPreset(sourceId: string, preset: MotionPresetId) {
    if (!isMotionPresetId(preset)) throw new RangeError(`Unknown motion preset: ${String(preset)}.`);
    const index = sourcesRef.current.findIndex(({ id }) => id === sourceId);
    const holdMs = layoutRef.current.holds[index] ?? settingsRef.current.holdMs;
    patchStoredFrame(sourceId, (frame) => {
      const merged = mergeStudioFrameSettings(settingsRef.current, frame);
      // Presets build around the settled pose: the last keyframe when keyed.
      const settled = resolveKeyframePose(poseFromFrame(merged), frame.keyframes, holdMs);
      return { ...frame, ...settled, keyframes: motionPresetKeyframes(preset, settled, holdMs, newKeyframeId) };
    });
  }

  function setTextAnimation(sourceId: string, next: TextAnimationSettings | undefined) {
    patchStoredFrame(sourceId, (frame) => normalizeSceneMotion({ ...frame, textAnimation: next }, 'textAnimation'));
  }

  function setSceneTiming(sourceId: string, patch: AnimationSceneTimingPatch) {
    patchStoredFrame(sourceId, (frame) => {
      const next = { ...frame };
      if (patch.holdMs !== undefined) next.holdMs = patch.holdMs === null ? undefined : patch.holdMs;
      if (patch.transitionMs !== undefined) next.transitionMs = patch.transitionMs === null ? undefined : patch.transitionMs;
      return normalizeSceneMotion(next, 'timing');
    });
  }

  function setSelectedTransitionTiming(transitionMs: number | null) {
    if (!selectedTransitionSource) return;
    setSceneTiming(selectedTransitionSource.id, { transitionMs });
  }

  /** Storyboard trim: roll keeps later scenes in place, ripple shifts them. */
  function trimScene(index: number, deltaMs: number, mode: SceneTrimMode) {
    const ids = sourcesRef.current.map(({ id }) => id);
    const result = resolveSceneTrim({ deltaMs, holds: layoutRef.current.holds, index, mode });
    const sourceId = ids[index];
    if (!sourceId) return;
    setFrameSettings((current) => {
      const defaults = createDefaultFrameSettings(settingsRef.current);
      const next = { ...current, [sourceId]: { ...(current[sourceId] ?? defaults), holdMs: result.holdMs } };
      const nextId = ids[index + 1];
      if (result.nextHoldMs !== undefined && nextId) {
        next[nextId] = { ...(current[nextId] ?? defaults), holdMs: result.nextHoldMs };
      }
      return next;
    });
  }

  function alignSelected(edge: AnimationAlignEdge) {
    if (!selectedSource || !selectedFrameSettings) return;
    const atMs = sceneTimeFor(selectedSource.id);
    const pose = resolveKeyframePose(poseFromFrame(selectedFrameSettings), selectedFrameSettings.keyframes, atMs);
    const width = selectedBounds.width * pose.scale;
    const height = selectedBounds.height * pose.scale;
    const margin = animationSafeMargin(canvasWidth, canvasHeight);
    const toAlign = (center: number, size: number) => Math.min(1, Math.max(-1, (center / size) * 2 - 1));
    // Horizontal anchors are the layer centre, or its leading edge for start-anchored text.
    const leading = selectedSource.kind === 'text' && selectedFrameSettings.textAnchor === 'start' ? width / 2 : 0;
    const patch: Partial<AnimationPose> = {};
    if (edge === 'left') patch.alignX = toAlign(margin + width / 2 - leading, canvasWidth);
    if (edge === 'center') patch.alignX = toAlign(canvasWidth / 2 - leading, canvasWidth);
    if (edge === 'right') patch.alignX = toAlign(canvasWidth - margin - width / 2 - leading, canvasWidth);
    if (edge === 'top') patch.alignY = toAlign(margin + height / 2, canvasHeight);
    if (edge === 'middle') patch.alignY = 0;
    if (edge === 'bottom') patch.alignY = toAlign(canvasHeight - margin - height / 2, canvasHeight);
    updatePose(selectedSource.id, patch, atMs);
  }

  function seekScene(sourceId: string, atMs: number) {
    const index = sourcesRef.current.findIndex(({ id }) => id === sourceId);
    if (index < 0) return;
    changePlaying(false);
    seek(sequenceSceneTime(layoutRef.current, index) + Math.min(atMs, (layoutRef.current.holds[index] ?? 0) - 1));
  }

  function updateSequenceBackground(
    patch: Partial<StudioBackgroundSettings>
  ) {
    const next = mergeStudioBackground(
      sequenceBackground,
      patch,
      settings.shaderSettings
    );
    setStoredSequenceBackground(next);
    setStoredSettings((current) => ({
      ...current,
      background: next.colorA,
      backgroundSecondary: next.colorB,
      backgroundStyle: next.style,
      shaderSettings: next.materialSettings,
    }));
  }

  function updateSelectedBackground(
    patch: Partial<StudioBackgroundSettings>
  ) {
    if (backgroundEditScope !== 'frame' || !selectedSource) {
      updateSequenceBackground(patch);
      return;
    }
    setFrameSettings((current) => {
      const base = current[selectedSource.id] ?? createDefaultFrameSettings(settings);
      const currentBackground = backgroundOverrides[selectedSource.id]
        ? base.background
        : sequenceBackground;
      return {
        ...current,
        [selectedSource.id]: {
          ...base,
          background: mergeStudioBackground(
            currentBackground,
            patch,
            settings.shaderSettings
          ),
        },
      };
    });
    setBackgroundOverrides((current) => ({ ...current, [selectedSource.id]: true }));
  }

  function applyLibraryBackground(
    patch: Partial<StudioBackgroundSettings>
  ) {
    if (sources.length === 0) return;
    updateSelectedBackground(patch);
    if (selectedSource) setSelectedEffectTarget('background');
    const index = selectedSource
      ? sources.findIndex((source) => source.id === selectedSource.id)
      : 0;
    seek(sequenceSceneTime(layoutRef.current, Math.max(0, index)));
  }

  function resetBackgroundOverride(sourceId: string) {
    setBackgroundOverrides((current) => {
      const next = { ...current };
      delete next[sourceId];
      return next;
    });
  }

  function resetSelectedBackgroundOverride() {
    if (!selectedSource) return;
    resetBackgroundOverride(selectedSource.id);
  }

  function clearBackgroundOverrides() {
    setBackgroundOverrides({});
    setBackgroundEditScope('sequence');
  }

  function resetSelectedFrame() {
    if (!selectedSource) return;
    setFrameSettings((current) => {
      const next = { ...current };
      delete next[selectedSource.id];
      return next;
    });
    resetSelectedBackgroundOverride();
  }

  function seek(timeMs: number) {
    const duration = layoutRef.current.totalMs;
    const next = Math.min(Math.max(0, timeMs), duration);
    if (!isPlayingRef.current && shaderFrameStates.size) setShaderCaptureTimeMs(next);
    playheadRef.current = next;
    previewDirtyRef.current = true;
    publishPlayhead(next);
    requestPreviewFrameRef.current();
    const nextTimeline = resolveSequencePosition(next, layoutRef.current);
    const nextActiveTimeline = { index: nextTimeline.index, nextIndex: nextTimeline.nextIndex };
    const previousActiveTimeline = activeTimelineRef.current;
    if (
      timelineRequiresShaderSyncRef.current
      && (
        nextActiveTimeline.index !== previousActiveTimeline.index
        || nextActiveTimeline.nextIndex !== previousActiveTimeline.nextIndex
      )
    ) {
      activeTimelineRef.current = nextActiveTimeline;
      setActiveTimeline(nextActiveTimeline);
    }
    if (isPlayingRef.current) void scheduleAudioPlayback(next);
  }

  function changePlaying(playing: boolean) {
    if (playing && totalMs > 0 && playheadRef.current >= totalMs) seek(0);
    if (playing) {
      setShaderCaptureTimeMs(null);
      selectDisplayedSource(resolveSequencePosition(playheadRef.current, layoutRef.current).index);
      setSelectedTransitionIndex(null);
      setBackgroundEditScope('sequence');
      setSelectedEffectTarget('content');
    }
    audioPlaybackRequestedRef.current = playing;
    previewClockResetRef.current = true;
    isPlayingRef.current = playing;
    setIsPlaying(playing);
    publishPlayhead(playheadRef.current);
    requestPreviewFrameRef.current();
  }

  async function waitForShaderCapture(timeMs: number, shaderExport: ReturnType<typeof createAnimationShaderExport>) {
    flushSync(() => setShaderCaptureTimeMs(timeMs));
    await shaderExport.refresh();
  }

  function requestPlaybackChange(playing: boolean) {
    if (exportJobRef.current) return;
    changePlaying(playing);
    if (!playing) inspectPlayhead();
  }

  function inspectPlayhead() {
    const position = resolveSequencePosition(playheadRef.current, layoutRef.current);
    if (!isPlayingRef.current && position.phase === 'transition') {
      setSelectedSourceId(null);
      setSelectedTransitionIndex(position.index);
    } else {
      selectDisplayedSource(position.index);
      setSelectedTransitionIndex(null);
    }
    setSelectedEffectTarget('content');
    setBackgroundEditScope('sequence');
  }

  function requestPlayheadChange(timeMs: number) {
    if (exportJobRef.current) return;
    seek(timeMs);
    // Scrubbing redraws the canvas at once; the inspector catches up when idle.
    startTransition(() => inspectPlayhead());
  }

  async function handleExport(format: AnimationExportFormat, throwOnError = false): Promise<ExportPreviewAsset | undefined> {
    if (exportJobRef.current) {
      if (throwOnError) throw new Error('Wait for the current export before starting another one.');
      return;
    }
    if (sources.length === 0) {
      const message = gt('Add at least one frame before exporting.');
      setError(message);
      if (throwOnError) throw new Error(message);
      return;
    }

    exportJobRef.current = true;
    setError(null);
    studioExport.start(ANIMATION_EXPORT_LABELS[format], 0);
    let resumeAfterExport = isPlayingRef.current;
    let entryTimeMs = playheadRef.current;
    const entryDocument = animationDocumentInputRef.current;
    const entrySignature = animationExportSignature(entryDocument);
    // Identity first; a background asset embed with the same visual signature is not an edit.
    const isCurrentDocument = () => animationDocumentInputRef.current === entryDocument
      || animationExportSignature(animationDocumentInputRef.current) === entrySignature;
    const isCurrentWorkspace = () => activeRef.current && projectWorkspaceActiveRef.current && Boolean(workspaceRef.current?.isConnected);
    const assertCurrentDocument = () => {
      if (!isCurrentDocument() || !isCurrentWorkspace()) throw new Error('The animation changed during export. Reopen it and export again.');
    };
    const shaderBackgroundsAreActive = hasAnimatedShaderBackgrounds(sources);
    let shaderExport: ReturnType<typeof createAnimationShaderExport> | undefined;
    let entryPose: ReturnType<ReturnType<typeof createAnimationShaderExport>['captureEntryPose']> | undefined;
    let restoredFrameStates = shaderFrameStates;
    let playbackChanged = false;
    const restorePreview = async () => {
      entryPose?.release();
      try {
        if (playbackChanged && shaderExport && shaderBackgroundsAreActive && isCurrentDocument()) {
          // Restore the native entry anchor before disabling export-only
          // renderers, rather than leaving a paused canvas at the final sample.
          flushSync(() => {
            setShaderFrameStates(restoredFrameStates);
            setShaderCaptureTimeMs(entryTimeMs);
          });
          // A retained, hidden workspace cannot draw. Keep its correct anchor
          // ready for return without waiting on a renderer that is now disabled.
          if (isCurrentWorkspace()) await shaderExport.refresh();
        } else if (playbackChanged && !isCurrentDocument()) {
          setShaderCaptureTimeMs(null);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : 'The paused shader preview could not be restored.');
      } finally {
        shaderExport?.dispose();
        setExportProgress(null);
        exportJobRef.current = false;
        if (playbackChanged && resumeAfterExport && isCurrentDocument() && isCurrentWorkspace()) changePlaying(true);
        previewDirtyRef.current = true;
        requestPreviewFrameRef.current();
        studioExport.finish();
      }
    };
    try {
      const [{ createAnimationShaderExport }] = await Promise.all([
        import('@/lib/animationShaderExport'), waitForAnimationFonts(sources),
      ]);
      assertCurrentDocument();
      // Playback can advance while the first export chunk loads. Anchor the
      // captured native pose to its current playhead, not the earlier click.
      resumeAfterExport = isPlayingRef.current;
      entryTimeMs = playheadRef.current;
      shaderExport = createAnimationShaderExport(sources, (source) => backgroundOverrides[source.id]
        ? { key: `source-${source.id}`, root: () => shaderLayerRefs.current.get(source.id) ?? null }
        : { key: 'sequence', root: () => sequenceShaderLayerRef.current });
      entryPose = shaderExport.captureEntryPose(entryTimeMs);
      restoredFrameStates = new Map([...shaderFrameStates, ...entryPose.states]);
      flushSync(() => {
        changePlaying(false);
        playbackChanged = true;
        setShaderFrameStates(restoredFrameStates);
        setExportProgress(0);
        if (shaderBackgroundsAreActive) setShaderCaptureTimeMs(entryTimeMs);
      });
      entryPose.release();
      if (shaderBackgroundsAreActive) await waitForShaderCapture(0, shaderExport);
      assertCurrentDocument();
      const exportSources = shaderExport.sources;
      const beforeFrame = async (timeMs: number) => {
        assertCurrentDocument();
        if (shaderBackgroundsAreActive) await waitForShaderCapture(timeMs, shaderExport!);
        assertCurrentDocument();
      };
      const onProgress = (progress: number) => {
        setExportProgress(progress);
        studioExport.update(progress);
      };
      const renderAt = (context: CanvasRenderingContext2D, timeMs: number) => {
        const position = resolveSequencePosition(timeMs, sequenceLayout);
        renderFrame(
          context,
          exportSources,
          {
            ...settings,
            ...(transitionSettings[position.index] ?? resolveStudioTransitionSettings(settings, undefined)),
            height: context.canvas.height,
            width: context.canvas.width,
          },
          position
        );
      };
      const encoders: Record<AnimationExportFormat, () => Promise<Blob>> = {
        gif: async () => (await import('@/lib/exportGif')).exportGif({
          beforeFrame: (frame) => beforeFrame(frame.atMs),
          config: settings,
          layout: sequenceLayout,
          onProgress,
          resolveRenderConfig: (frame) => ({
            ...settings,
            ...(transitionSettings[frame.position.index] ?? resolveStudioTransitionSettings(settings, undefined)),
          }),
          sampleHold: (index) => shaderBackgroundsAreActive || sceneMovesDuringHold(exportSources[index]),
          sources: exportSources,
        }),
        mp4: async () => {
          const { encodeCanvasMp4 } = await import('@/lib/canvasExport');
          await hydrateAudioBuffers(audioState.assets);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(120, settings.width);
          canvas.height = Math.max(120, settings.height);
          const context = canvas.getContext('2d');
          if (!context) throw new Error('Canvas rendering is unavailable.');
          const audio = audioState.clips.length
            ? mixAnimationAudio(getAudioContext(), audioState, audioBuffersRef.current, totalMs)
            : null;
          return encodeCanvasMp4({
            audio,
            canvas,
            durationMs: totalMs,
            fps: settings.fps,
            onProgress,
            quality: 'balanced',
            renderFrame: async (frame) => {
              await beforeFrame(frame.timeMs);
              context.clearRect(0, 0, canvas.width, canvas.height);
              renderAt(context, frame.timeMs);
            },
          });
        },
        png: () => renderAnimationPoster(settings, entryTimeMs, async (context) => {
          await beforeFrame(entryTimeMs);
          renderAt(context, entryTimeMs);
        }),
      };
      const blob = await encoders[format]();
      const fileName = format === 'png'
        ? `studio-${settings.packageId}-${Math.round(entryTimeMs)}ms.png`
        : `studio-${settings.packageId}.${format}`;
      assertCurrentDocument();
      const asset: ExportPreviewAsset = {
        blob,
        fileName,
        format: ANIMATION_EXPORT_FORMATS[format],
        height: settings.height,
        width: settings.width,
      };
      setLastExport(asset);
      return asset;
    } catch (error) {
      const message = error instanceof Error ? error.message : format === 'mp4'
        ? gt('The MP4 could not be encoded. Try a smaller canvas or another browser.')
        : gt('The GIF could not be encoded. Try a smaller canvas or lower frame rate.');
      setError(message);
      if (throwOnError) throw error instanceof Error ? error : new Error(message);
    } finally {
      await restorePreview();
    }
  }

  function startNewAnimation() {
    setProjectIdentity(null);
    setShaderFrameStates(new Map());
    setShaderCaptureTimeMs(null);
    const scratchSnapshot = cloneAnimationArtboardSnapshot({
      audio: createEmptyAnimationAudioState(),
      backgroundOverrides: {},
      frameSettings: {},
      sequenceBackground: createDefaultFrameSettings(identitySettings).background,
      sequenceOrder: [],
      settings: identitySettings,
    });
    const scratchArtboards: AnimationArtboard[] = [{
      id: DEFAULT_ANIMATION_ARTBOARD_ID,
      name: 'Untitled animation',
      snapshot: cloneAnimationArtboardSnapshot(scratchSnapshot),
    }];

    workspaceArtboardsRef.current = scratchArtboards;
    activeArtboardIdRef.current = DEFAULT_ANIMATION_ARTBOARD_ID;
    currentArtboardSnapshotRef.current = scratchSnapshot;
    setArtboards(scratchArtboards);
    setActiveArtboardId(DEFAULT_ANIMATION_ARTBOARD_ID);
    setStoredSettings(scratchSnapshot.settings);
    setStoredSequenceBackground(scratchSnapshot.sequenceBackground);
    setTextFrames('New frame');
    setMode('sequence');
    setIncludeBrandLogo(false);
    setSequenceOrder([]);
    setFrameSettings({});
    setBackgroundOverrides({});
    setBackgroundEditScope('sequence');
    setSelectedSourceId('text-0');
    setSelectedTransitionIndex(null);
    setSelectedEffectTarget('content');
    setImages([]);
    setError(null);
    setPlaybackRate(1);
    setAudioState(scratchSnapshot.audio ?? createEmptyAnimationAudioState());
    setSelectedAudioClipId(null);
    clearAudioBuffers();
    setAudioBufferRevision((revision) => revision + 1);
    setLastExport(null);
    changePlaying(false);
    seek(0);
  }

  function describeAnimation() {
    return {
      durationMs: layoutRef.current.totalMs,
      fps: settingsRef.current.fps,
      height: settingsRef.current.height,
      playheadMs: Math.round(playheadRef.current),
      scenes: describeAnimationScenes(sourcesRef.current, layoutRef.current),
      starters: starters.map(({ description, id, name, scenes }) => ({ description, id, name, scenes })),
      width: settingsRef.current.width,
    };
  }

  function sceneForAutomation(sceneId: string, action: string): StudioSource {
    const source = sourcesRef.current.find(({ id }) => id === sceneId);
    if (!source) throw new RangeError(`${action} sceneId ${sceneId} is not in this animation. Read animation.describe first.`);
    return source;
  }

  /**
   * Scene, keyframe, playhead, and starter actions. Updates flush synchronously
   * so the returned description is the committed state the canvas renders.
   */
  function invokeMotionAction(action: string, input: unknown): unknown {
    if (exportJobRef.current && action !== 'animation.describe') throw new Error('Wait for the current export before editing the animation.');
    switch (action) {
      case 'animation.describe':
        return describeAnimation();
      case 'animation.seek': {
        const timeMs = parseAnimationSeekInput(input);
        flushSync(() => {
          changePlaying(false);
          seek(timeMs);
          inspectPlayhead();
        });
        return describeAnimation();
      }
      case 'animation.scene.update': {
        const update = parseAnimationSceneUpdate(input);
        const source = sceneForAutomation(update.sceneId, action);
        if (update.textAnimation !== undefined && source.kind !== 'text') {
          throw new TypeError('animation.scene.update textAnimation applies to text scenes only.');
        }
        flushSync(() => {
          if (update.holdMs !== undefined || update.transitionMs !== undefined) {
            setSceneTiming(source.id, { holdMs: update.holdMs, transitionMs: update.transitionMs });
          }
          if (update.textAnimation !== undefined) setTextAnimation(source.id, update.textAnimation ?? undefined);
          if (update.pose) updatePose(source.id, update.pose);
        });
        return describeAnimation();
      }
      default:
        return invokeKeyframeAction(action, input);
    }
  }

  function invokeKeyframeAction(action: string, input: unknown): unknown {
    switch (action) {
      case 'animation.keyframe.set': {
        const request = parseAnimationKeyframeSet(input);
        const source = sceneForAutomation(request.sceneId, action);
        flushSync(() => {
          addKeyframe(source.id, request.atMs);
          if (request.pose) updatePose(source.id, request.pose, request.atMs);
        });
        if (request.easing) {
          const keyframe = frameSettingsRef.current[source.id]?.keyframes?.find(({ atMs }) => Math.abs(atMs - request.atMs) <= keyframeTolerance());
          if (keyframe) flushSync(() => changeKeyframe(source.id, keyframe.id, { easing: request.easing }));
        }
        return describeAnimation();
      }
      case 'animation.keyframe.remove': {
        const request = parseAnimationKeyframeRemove(input);
        const source = sceneForAutomation(request.sceneId, action);
        if (!frameSettingsRef.current[source.id]?.keyframes?.some(({ id }) => id === request.keyframeId)) {
          throw new RangeError(`animation.keyframe.remove keyframe ${request.keyframeId} is not on scene ${source.id}.`);
        }
        flushSync(() => removeKeyframe(source.id, request.keyframeId));
        return describeAnimation();
      }
      case 'animation.motion.preset': {
        const request = parseAnimationMotionPreset(input);
        const source = sceneForAutomation(request.sceneId, action);
        flushSync(() => applyMotionPreset(source.id, request.preset));
        return describeAnimation();
      }
      case 'animation.starter.apply': {
        const starterId = input && typeof input === 'object' ? (input as { starterId?: unknown }).starterId : undefined;
        if (!isAnimationStarterId(starterId)) throw new TypeError("animation.starter.apply requires { starterId: 'brand-intro' | 'product-reel' | 'proof-points' }.");
        flushSync(() => applyStarter(starterId));
        return describeAnimation();
      }
      default:
        return UNHANDLED_ACTION;
    }
  }

  /** Replaces the active artboard with an identity starter; undo restores the previous sequence. */
  function applyStarter(starterId: AnimationStarterId) {
    if (exportJobRef.current) throw new Error('Wait for the current export before applying a starter.');
    if (!identity) throw new Error('Starters need an active brand identity.');
    if (!isAnimationStarterId(starterId)) throw new RangeError(`Unknown Animation starter: ${String(starterId)}.`);
    const starter = buildAnimationStarter({
      createId: newKeyframeId,
      hasLogo: identity.assets.some((asset) => asset.type === 'logo'),
      identity,
      starterId,
    });
    brandLogoFromProjectRef.current = false;
    const logoAsset = brandLogoAssetFor(identity, starter.sequenceBackground.colorA);
    if (logoAsset && logoAsset.path !== brandLogoAssetPath) {
      void loadImageSource(logoAsset.path, logoAsset.label).then(setBrandLogo).catch(() => {
        setError(gt('The brand logo could not be loaded.'));
      });
    }
    changePlaying(false);
    setShaderFrameStates(new Map());
    setShaderCaptureTimeMs(null);
    setImages([]);
    setStoredSettings(starter.settings);
    setTextFrames(starter.textFrames);
    setMode('sequence');
    setIncludeBrandLogo(starter.includeBrandLogo);
    setSequenceOrder(starter.sequenceOrder);
    setFrameSettings(starter.frameSettings);
    setStoredSequenceBackground(starter.sequenceBackground);
    setBackgroundOverrides(starter.backgroundOverrides);
    setSelectedSourceId(starter.sequenceOrder[0] ?? 'text-0');
    setSelectedTransitionIndex(null);
    setSelectedEffectTarget('content');
    setBackgroundEditScope('sequence');
    setLastExport(null);
    playheadRef.current = 0;
    previewDirtyRef.current = true;
    publishPlayhead(0);
    requestPreviewFrameRef.current();
  }

  function applyAnimationState(input: AnimationDocumentState) {
    const nextMode = input.mode;
    if (!['sequence', 'text', 'images'].includes(nextMode)) {
      throw new TypeError('Mode must be sequence, text, or images.');
    }
    const nextPlaybackRate = input.playbackRate;
    if (nextPlaybackRate <= 0 || nextPlaybackRate > 4) {
      throw new RangeError('Playback rate must be greater than 0 and no more than 4.');
    }
    // Scene timing, keyframes, captions, and entrances fail with field paths before any state changes.
    const validatedFrameSettings = Object.fromEntries(Object.entries(input.frameSettings).map(([id, frame]) => {
      if (!frame || typeof frame !== 'object' || Array.isArray(frame)) throw new TypeError(`frameSettings.${id} must be an object.`);
      return [id, normalizeSceneMotion(frame as object, `frameSettings.${id}`)];
    }));
    const next: AnimationDocumentState = { ...input, frameSettings: validatedFrameSettings };

    const restoredSnapshot = cloneAnimationArtboardSnapshot({
      audio: normalizeAnimationAudioState(next.audio ?? createEmptyAnimationAudioState()),
      backgroundOverrides: next.backgroundOverrides as Record<string, boolean>,
      frameSettings: next.frameSettings as Record<string, StudioFrameSettings>,
      sequenceBackground: next.sequenceBackground as StudioBackgroundSettings,
      sequenceOrder: [...next.sequenceOrder],
      settings: next.settings as StudioSettings,
    });
    const restoredWorkspace = restoreAnimationArtboardWorkspace({
      activeArtboardId: next.activeArtboardId,
      artboards: next.artboards,
    }, restoredSnapshot);

    setProjectIdentity(next.identity ?? null);
    setShaderFrameStates(new Map());
    setShaderCaptureTimeMs(null);

    setMode(nextMode as SourceMode);
    setTextFrames(next.textFrames);
    setIncludeBrandLogo(next.includeBrandLogo);
    setSequenceOrder([...next.sequenceOrder]);
    setStoredSettings(next.settings as StudioSettings);
    setFrameSettings(restoredSnapshot.frameSettings);
    setStoredSequenceBackground(next.sequenceBackground as StudioBackgroundSettings);
    setBackgroundOverrides(next.backgroundOverrides as Record<string, boolean>);
    setPlaybackRate(nextPlaybackRate);
    setAudioState(restoredSnapshot.audio ?? createEmptyAnimationAudioState());
    setSelectedAudioClipId(null);
    clearAudioBuffers();
    workspaceArtboardsRef.current = restoredWorkspace.artboards;
    activeArtboardIdRef.current = restoredWorkspace.activeArtboardId;
    currentArtboardSnapshotRef.current = restoredSnapshot;
    setArtboards(restoredWorkspace.artboards);
    setActiveArtboardId(restoredWorkspace.activeArtboardId);
    setSelectedSourceId(next.sequenceOrder[0] ?? (next.includeBrandLogo && shownBrandLogo ? 'brand-logo' : 'text-0'));
    setSelectedTransitionIndex(null);
    setBackgroundEditScope('sequence');
    setSelectedEffectTarget('content');
    seek(0);
  }

  async function applyStudioSource(source: string) {
    if (exportJobRef.current) throw new Error('Wait for the current export before opening another animation.');
    const request = ++sourceApplySequenceRef.current;
    const originalInput = animationDocumentInputRef.current;
    const parsed = parseSourceObject(source);
    if (isCanvasDocumentEnvelope(parsed)) {
      const { animationProjectIdentity, namespaceAnimationProjectIdentity, validateAnimationProjectDocument } = await import('@/lib/animationProjectFile');
      const restored = parseAnimationCanvasDocument(source);
      validateAnimationProjectDocument(restored.document);
      const importedIdentity = animationProjectIdentity(restored.document);
      const localIdentity = importedIdentity ? namespaceAnimationProjectIdentity(importedIdentity, identityId) : undefined;
      const [storedImages] = await Promise.all([
        Promise.all(restored.assets.map(loadStoredImage)),
        validateAnimationFontFiles(localIdentity?.fonts ?? []),
      ]);
      if (request !== sourceApplySequenceRef.current || originalInput !== animationDocumentInputRef.current) {
        throw new Error('The animation changed while the project was opening. Open it again to replace the latest edits.');
      }
      if (exportJobRef.current) throw new Error('Wait for the current export before opening another animation.');
      const restoredLogo = storedImages.find(({ id }) => id === 'brand-logo');
      flushSync(() => {
        applyAnimationState({ ...restored.state, identity: localIdentity });
        brandLogoFromProjectRef.current = Boolean(restoredLogo);
        if (restoredLogo) setBrandLogo({ ...restoredLogo, kind: 'image' });
        setImages(storedImages.filter(({ id }) => id !== 'brand-logo'));
        changePlaying(false);
        setLastExport(null);
      });
      return;
    }

    applyAnimationState({
      audio: audioState,
      backgroundOverrides: sourceObject(parsed, 'backgroundOverrides') ?? backgroundOverrides,
      frameSettings: sourceObject(parsed, 'frameSettings') ?? frameSettings,
      includeBrandLogo: sourceBoolean(parsed, 'includeBrandLogo', includeBrandLogo),
      mode: sourceString(parsed, 'mode', mode),
      playbackRate: sourceNumber(parsed, 'playbackRate', playbackRate),
      sequenceBackground: sourceObject(parsed, 'sequenceBackground') ?? sequenceBackground,
      sequenceOrder: sourceStringArray(parsed, 'sequenceOrder', sequenceOrder),
      settings: sourceObject(parsed, 'settings') ?? settings,
      textFrames: sourceString(parsed, 'textFrames', textFrames),
    });
  }

  function restoreAnimationHistory(snapshot: typeof historySnapshot) {
    const timeMs = playheadRef.current;
    const selectedId = selectedSourceId;
    applyAnimationState(snapshot.state);
    setImages(snapshot.images);
    setBrandLogo(snapshot.brandLogo);
    setSelectedSourceId(animationHistorySelection(selectedId, snapshot.sourceIds));
    changePlaying(false);
    setLastExport(null);
    seek(timeMs);
  }

  async function prepareProjectFile() {
    if (exportJobRef.current) throw new Error('Wait for the current export before downloading a project.');
    const input = animationDocumentInputRef.current;
    const document = createAnimationCanvasDocument({
      brandId: identityId, createdAt: documentCreatedAt, id: `${identityId}:animation:scene`, revision: 1,
      sources: input.sources, state: input.state, title: `${identity?.name ?? 'Glyphfield'} Animation`, updatedAt: new Date().toISOString(),
    });
    const { prepareAnimationProjectFile } = await import('@/lib/animationProjectFile');
    const file = await prepareAnimationProjectFile(document, document.title, undefined, identity);
    if (input !== animationDocumentInputRef.current) throw new Error('The animation changed while preparing the project file. Download it again.');
    return file;
  }

  /** Master time where a scene reads as composed (after its entrance and last keyframe). */
  function settledSceneTime(id: string): number {
    const index = Math.max(0, sourcesRef.current.findIndex((source) => source.id === id));
    const source = sourcesRef.current[index];
    const start = sequenceSceneTime(layoutRef.current, index);
    return source ? start + sceneSettledTime(source, layoutRef.current.holds[index] ?? 0) : start;
  }

  function selectSource(id: string) {
    if (exportJobRef.current) return;
    setSelectedTransitionIndex(null);
    setSelectedSourceId(id);
    setSelectedEffectTarget('content');
    changePlaying(false);
    seek(settledSceneTime(id));
  }

  function selectSourceBackground(id: string) {
    if (exportJobRef.current) return;
    setSelectedTransitionIndex(null);
    setSelectedSourceId(id);
    setSelectedEffectTarget('background');
    setBackgroundEditScope('frame');
    changePlaying(false);
    seek(settledSceneTime(id));
  }

  function selectTransition(index: number) {
    if (exportJobRef.current) return;
    if (sources.length < 2) return;
    const resolvedIndex = Math.min(Math.max(0, index), sources.length - 1);
    setSelectedSourceId(null);
    setSelectedTransitionIndex(resolvedIndex);
    setSelectedEffectTarget('content');
    setBackgroundEditScope('sequence');
    changePlaying(false);
    seek(sequenceSceneTime(sequenceLayout, resolvedIndex, 'transition'));
  }

  function updateSelectedTransitionSettings(patch: Partial<StudioTransitionSettings>) {
    if (!selectedTransitionSource) return;
    setFrameSettings((current) => {
      const sourceSettings = current[selectedTransitionSource.id]
        ?? resolvedFrameSettings[selectedTransitionSource.id]
        ?? createDefaultFrameSettings(settings);
      const transition = resolveStudioTransitionSettings(settings, sourceSettings.transition);
      return {
        ...current,
        [selectedTransitionSource.id]: {
          ...sourceSettings,
          transition: {
            ...transition,
            ...patch,
            bezier: patch.bezier ? [...patch.bezier] : transition.bezier,
          },
        },
      };
    });
    previewDirtyRef.current = true;
  }

  function resetSelectedTransition() {
    if (!selectedTransitionSource) return;
    setFrameSettings((current) => {
      const sourceSettings = current[selectedTransitionSource.id];
      if (!sourceSettings?.transition) return current;
      return {
        ...current,
        [selectedTransitionSource.id]: { ...sourceSettings, transition: undefined },
      };
    });
    previewDirtyRef.current = true;
  }

  function selectSequenceBackground() {
    if (exportJobRef.current) return;
    setSelectedSourceId(null);
    setSelectedTransitionIndex(null);
    setSelectedEffectTarget('background');
    setBackgroundEditScope('sequence');
    changePlaying(false);
  }

  const previewSources = useMemo(
    () => attachShaderLayers(sources),
    [attachShaderLayers, shaderPresentationReady, sources]
  );
  const starters = useMemo(() => (identity && !presentationMode ? animationStartersFor(identity) : []), [identity, presentationMode]);
  const controlActions = useStableHandlers({
    onAddText: addTextSource,
    onApplyStarter: applyStarter,
    onBackgroundChange: updateSelectedBackground,
    onBackgroundScopeChange: setBackgroundEditScope,
    onClearBackgroundOverrides: clearBackgroundOverrides,
    onFiles: importFiles,
    onFrameSettingsChange: updateSelectedFrame,
    onIncludeBrandLogoChange: (include: boolean) => {
      setIncludeBrandLogo(include);
      if (!include && selectedSourceId === 'brand-logo') {
        setSelectedSourceId('text-0');
        setSelectedTransitionIndex(null);
        setBackgroundEditScope('sequence');
        setSelectedEffectTarget('content');
      }
      seek(0);
    },
    onLibraryBackgroundChange: applyLibraryBackground,
    onMoveSource: moveSource,
    onRemoveSource: removeSource,
    onResetBackgroundOverride: resetBackgroundOverride,
    onResetFrame: resetSelectedFrame,
    onResetSelectedBackgroundOverride: resetSelectedBackgroundOverride,
    onResetSelectedTransition: resetSelectedTransition,
    onSelectedTransitionSettingsChange: updateSelectedTransitionSettings,
    onSelectSequenceBackground: selectSequenceBackground,
    onSelectSource: selectSource,
    onSelectSourceBackground: selectSourceBackground,
    onSelectTransition: selectTransition,
    onSettingsChange: updateSettings,
    onTextSourceChange: updateTextSource,
  });
  const motionActions: AnimationMotionActions = useStableHandlers({
    onAddKeyframe: (sourceId: string) => addKeyframe(sourceId),
    onAlign: alignSelected,
    onClearKeyframes: clearKeyframes,
    onGuidesVisibleChange: setGuidesVisible,
    onKeyframeChange: changeKeyframe,
    onMotionPreset: applyMotionPreset,
    onPoseChange: (patch: Partial<AnimationPose>) => {
      if (selectedSource) updatePose(selectedSource.id, patch);
    },
    onRemoveKeyframe: removeKeyframe,
    onSceneTimingChange: setSceneTiming,
    onSeekScene: seekScene,
    onTextAnimationChange: setTextAnimation,
    onTransitionTimingChange: setSelectedTransitionTiming,
  });
  const timelineActions = useStableHandlers({
    onAudioClipChange: updateAudioClip,
    onAudioFiles: (files: FileList) => void importAudioFiles(files),
    onAudioMutedChange: (muted: boolean) => setAudioState((current) => ({ ...current, muted })),
    onAudioRemoveClip: removeAudioClip,
    onAudioSplitClip: splitAudioClip,
    onAudioVolumeChange: (volume: number) => setAudioState((current) => ({ ...current, volume })),
    onKeyframeRemove: removeKeyframe,
    onKeyframeRetime: (sourceId: string, keyframeId: string, atMs: number) => changeKeyframe(sourceId, keyframeId, { atMs }),
    onKeyframeSelect: (sourceId: string) => {
      if (selectedSourceIdRef.current !== sourceId) selectSource(sourceId);
    },
    onPlayChange: requestPlaybackChange,
    onRateChange: (rate: number) => {
      playbackRateRef.current = rate;
      setPlaybackRate(rate);
    },
    onSceneTrim: trimScene,
    onSeek: requestPlayheadChange,
    onSelectSource: selectSource,
    onSelectTransition: selectTransition,
    onZoomChange: (zoom: number) => setTimelineZoom(clampTimelineZoom(zoom)),
  });
  const playheadContext = useMemo<AnimationPlayheadContext>(() => ({
    currentMsRef: playheadRef,
    guidesVisible,
    isPlaying,
    layout: sequenceLayout,
    subscribeToPlayhead,
  }), [guidesVisible, isPlaying, sequenceLayout, subscribeToPlayhead]);
  const backgroundOverrideSourceIds = useMemo(
    () => sources.filter((source) => backgroundOverrides[source.id]).map(({ id }) => id),
    [backgroundOverrides, sources]
  );
  const sceneKeyframes = useMemo(() => Object.fromEntries(sources.flatMap((source) => (
    source.keyframes?.length ? [[source.id, source.keyframes]] : []
  ))), [sources]);
  const studioControlProps = {
    ...controlActions,
    backgroundOverrideCount: backgroundOverrideSourceIds.length,
    backgroundOverrideSourceIds,
    backgroundScope: backgroundEditScope,
    brandLogoAvailable: Boolean(shownBrandLogo),
    compact: compactControls,
    frameSettings: selectedFrameSettings,
    hasSelectedBackgroundOverride: Boolean(selectedSource && backgroundOverrides[selectedSource.id]),
    hasImageSources: sources.some((source) => source.kind === 'image'),
    hasSelectedTransitionOverride,
    identity,
    includeBrandLogo,
    ...editorOnlyControlProps(presentationMode, motionActions, playheadContext),
    previewSources,
    selectedSource,
    selectedEffectTarget,
    selectedTransitionIndex,
    selectedTransitionSettings,
    sequenceBackground,
    settings,
    sources,
    starters,
    transitionSettings,
  };
  function renderWorkspace() {
    return (
      <div
      className={animationStudioClassName({ compactControls, embedded, presentationMode })}
      ref={workspaceRef}
    >
      {projectIdentity && identity ? <BrandFontFaces identity={identity} /> : null}
      {presentationMode ? null : <StudioToolHeader
        layout='balanced'
        actions={(
          <>
          <StudioToolbarGroup label='Animation saving and versions'>
            <DesignVersionHeaderControls />
          </StudioToolbarGroup>
          <StudioToolbarGroup label='Project files, code, and export'>
            <StudioFileMenu sourceDisabled={animationSource === null} onSource={() => setSourceOpen(true)}
              project={{ disabled: exportProgress !== null || animationSource === null, open: applyStudioSource, prepare: prepareProjectFile, read: readAnimationProjectFile, workspaceLabel: 'Animation Studio' }}
              sections={[{ items: [{ description: gt('Full-size PNG of the frame at the playhead.'), disabled: exportProgress !== null, icon: <ImageDown />, id: 'poster-frame', label: gt('Export poster frame'), onSelect: () => void handleExport('png') }], label: gt('Still') }]} />
            {lastExport ? <ExportPreview asset={lastExport} className='hidden xl:inline-flex' /> : null}
            <Button
              disabled={exportProgress !== null}
              onClick={() => void handleExport('gif')}
              type='button'
              variant='outline'
            >
              <Download aria-hidden='true' />
              <T>GIF</T>
            </Button>
            <Button
              className='px-4'
              disabled={exportProgress !== null}
              onClick={() => void handleExport('mp4')}
              type='button'
            >
              <Clapperboard aria-hidden='true' />
              <T>Export MP4</T>
            </Button>
            <StudioErrorNotice error={error} onDismiss={() => setError(null)} title='Animation action failed' />
          </StudioToolbarGroup>
          </>
        )}
        metadata={embedded ? undefined : <T>Studio / Motion</T>}
        title={<T>Animation</T>}
        toolId='animation'
      />}

      <div className={embedded ? 'animation-body lab-workspace' : 'studio-body animation-body lab-workspace'}>
        <StudioControls {...studioControlProps} panel='source' />

        <section className='animation-canvas-section flex min-w-0 flex-col bg-background'>
          <div className='flex min-h-0 flex-1 flex-col'>
            <AnimationArtboardBar
              activeArtboardId={resolvedAnimationArtboardId(activeArtboard)}
              artboards={workspaceArtboards}
              frameCount={sources.length}
              height={settings.height}
              onAdd={addArtboard}
              onDimensionsChange={updateSettings}
              onDuplicate={duplicateArtboard}
              onRemove={removeActiveArtboard}
              onRename={renameActiveArtboard}
              onSelect={activateArtboard}
              packageId={settings.packageId}
              totalMs={totalMs}
              width={settings.width}
            />

            <CanvasViewport
              actionHistory={presentationMode ? undefined : actionHistory}
              autoFit={compactControls}
              className='min-h-[420px] flex-1'
              draftKey={compactControls ? 'compact-canvas-fit-v1' : 'canvas-zoom'}
              identityId={identityId}
              maxZoom={compactControls ? 100 : 200}
              onDeselect={() => {
                setSelectedSourceId(null);
                setSelectedTransitionIndex(null);
                setBackgroundEditScope('sequence');
                setSelectedEffectTarget('content');
              }}
              stageClassName='studio-stage flex min-h-full items-center justify-center p-8'
              toolId='animation'
            >
              <div
                className='relative w-full max-w-5xl bg-black smooth-shadow-ring-xl smooth-ring-foreground/20'
                onPointerDown={() => {
                  setSelectedSourceId(null);
                  setSelectedTransitionIndex(null);
                  setBackgroundEditScope('sequence');
                  setSelectedEffectTarget('content');
                }}
                ref={canvasSelectionRef}
                style={{ aspectRatio: `${Math.max(120, settings.width)} / ${Math.max(120, settings.height)}` }}
              >
                <AnimationShaderLayers
                  active={active}
                  activeShaderSourceIds={activeShaderSourceIds}
                  backgroundOverrides={backgroundOverrides}
                  directShaderComposite={directShaderComposite}
                  embedded={embedded}
                  exportProgress={exportProgress}
                  isPlaying={isPlaying}
                  overrideShaderSettings={overrideShaderSettings}
                  presentationMode={presentationMode}
                  previewFrameRate={resolvedPreviewFrameRate}
                  previewMaxPixelCount={previewMaxPixelCount}
                  sequenceBackground={sequenceBackground}
                  sequenceShaderIsActive={sequenceShaderIsActive}
                  sequenceShaderLayerRef={sequenceShaderLayerRef}
                  sequenceShaderOpacity={sequenceShaderOpacity}
                  sequenceShaderSettings={sequenceShaderSettings}
                  shaderCaptureTimeMs={shaderCaptureTimeMs}
                  shaderFrameStates={shaderFrameStates}
                  shaderLayerRefs={shaderLayerRefs}
                  showSequenceShader={hasSequenceShaderSources}
                  sources={sources}
                  studioShaderSettings={settings.shaderSettings}
                  viewportVisible={viewportVisible}
                />
                <canvas
                  aria-label={gt('Animation preview canvas')}
                  className='absolute inset-0 z-10 size-full'
                  height={1}
                  ref={canvasRef}
                  width={1}
                />
                {selectedSource && selectedFrameSettings ? (
                  <AnimationCanvasSelection
                    active={active}
                    currentMsRef={playheadRef}
                    isPlaying={isPlaying}
                    layout={sequenceLayout}
                    selectedIndex={sources.findIndex((source) => source.id === selectedSource.id)}
                    subscribeToPlayhead={subscribeToPlayhead}
                    viewportVisible={viewportVisible}
                  >
                    {(sceneElapsedMs) => {
                      const pose = resolveKeyframePose(poseFromFrame(selectedFrameSettings), selectedFrameSettings.keyframes, sceneElapsedMs);
                      const label = selectedSource.kind === 'text' ? selectedSource.text : selectedSource.name;
                      const anchorStart = selectedSource.kind === 'text' && selectedFrameSettings.textAnchor === 'start';
                      // A leading-edge anchor sits half the scaled width left of the box centre.
                      const anchorOffset = (scale: number) => (anchorStart ? (selectedBounds.width * scale) / 2 : 0);
                      return (
                        <>
                          <EditableCanvasLayer
                            baseHeight={selectedBounds.height}
                            baseWidth={selectedBounds.width}
                            baseX={(canvasWidth - selectedBounds.width) / 2}
                            baseY={(canvasHeight - selectedBounds.height) / 2}
                            canvasHeight={canvasHeight}
                            canvasWidth={canvasWidth}
                            label={label}
                            layerId={ANIMATION_LAYER_ID}
                            onChange={(transform) => updatePose(selectedSource.id, {
                              alignX: Math.min(1, Math.max(-1, ((transform.x - anchorOffset(transform.scale)) / canvasWidth) * 2)),
                              alignY: Math.min(1, Math.max(-1, (transform.y / canvasHeight) * 2)),
                              scale: transform.scale,
                            }, sceneElapsedMs)}
                            onDeselect={() => {
                              setSelectedSourceId(null);
                              setSelectedTransitionIndex(null);
                              setSelectedEffectTarget('content');
                            }}
                            onSelect={() => {
                              setSelectedTransitionIndex(null);
                              setSelectedSourceId(selectedSource.id);
                            }}
                            selected
                            transform={{
                              scale: pose.scale,
                              x: (pose.alignX * canvasWidth) / 2 + anchorOffset(pose.scale),
                              y: (pose.alignY * canvasHeight) / 2,
                            }}
                            zIndex={30}
                          >
                            <span />
                          </EditableCanvasLayer>
                          <AnimationRotateHandle
                            anchor={anchorStart ? 'start' : 'center'}
                            baseHeight={selectedBounds.height}
                            baseWidth={selectedBounds.width}
                            canvasHeight={canvasHeight}
                            canvasWidth={canvasWidth}
                            label={`${gt('Rotate')} ${label}`}
                            onCommit={(rotation) => updatePose(selectedSource.id, { rotation }, sceneElapsedMs)}
                            onPreview={(rotation) => {
                              dragPreviewRef.current = rotation === null ? null : { pose: { ...pose, rotation }, sourceId: selectedSource.id };
                              previewDirtyRef.current = true;
                              requestPreviewFrameRef.current();
                            }}
                            pose={pose}
                          />
                          <AnimationLayerDragBridge
                            anchorStart={anchorStart}
                            base={selectedBounds}
                            canvas={{ height: canvasHeight, width: canvasWidth }}
                            onPreview={(preview) => {
                              dragPreviewRef.current = preview ? { pose: { ...pose, ...preview }, sourceId: selectedSource.id } : null;
                              previewDirtyRef.current = true;
                              requestPreviewFrameRef.current();
                            }}
                            pose={pose}
                            stageRef={canvasSelectionRef}
                          />
                        </>
                      );
                    }}
                  </AnimationCanvasSelection>
                ) : null}
                {guidesVisible ? <AnimationLayoutGuides height={canvasHeight} width={canvasWidth} /> : null}
                <div
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-y-0 z-20 w-px bg-white/20'
                  style={{ left: `${(((selectedFrameSettings?.alignX ?? settings.alignX) + 1) / 2) * 100}%` }}
                />
                <div
                  aria-hidden='true'
                  className='pointer-events-none absolute inset-x-0 z-20 h-px bg-white/20'
                  style={{ top: `${(((selectedFrameSettings?.alignY ?? settings.alignY) + 1) / 2) * 100}%` }}
                />
                <CanvasDimensionHandles
                  canvasRef={canvasSelectionRef}
                  height={canvasHeight}
                  onChange={({ height, width }) => updateSettings({ height, width })}
                  width={canvasWidth}
                />
              </div>
            </CanvasViewport>

            {presentationMode ? <AnimationError error={error} /> : null}
          </div>

          <TimelinePanel
            audio={audioState}
            currentMsRef={playheadRef}
            disabled={exportProgress !== null}
            isPlaying={isPlaying}
            onAudioClipChange={timelineActions.onAudioClipChange}
            onAudioFiles={timelineActions.onAudioFiles}
            onAudioMutedChange={timelineActions.onAudioMutedChange}
            onAudioRemoveClip={timelineActions.onAudioRemoveClip}
            onAudioSelectedClipChange={setSelectedAudioClipId}
            onAudioSplitClip={timelineActions.onAudioSplitClip}
            onAudioVolumeChange={timelineActions.onAudioVolumeChange}
            keyframes={sceneKeyframes}
            layout={sequenceLayout}
            onKeyframeRemove={timelineActions.onKeyframeRemove}
            onKeyframeRetime={timelineActions.onKeyframeRetime}
            onKeyframeSelect={timelineActions.onKeyframeSelect}
            onSceneTrim={presentationMode ? undefined : timelineActions.onSceneTrim}
            onZoomChange={presentationMode ? undefined : timelineActions.onZoomChange}
            onPlayChange={timelineActions.onPlayChange}
            onRateChange={timelineActions.onRateChange}
            onSeek={timelineActions.onSeek}
            onSelectSource={timelineActions.onSelectSource}
            onSelectTransition={timelineActions.onSelectTransition}
            playbackRate={playbackRate}
            presentationMode={presentationMode}
            previewSources={previewSources}
            selectedAudioClipId={selectedAudioClipId}
            selectedSourceId={selectedSourceId}
            selectedTransitionIndex={selectedTransitionIndex}
            settings={settings}
            subscribeToPlayhead={subscribeToPlayhead}
            sources={sources}
            totalMs={totalMs}
            transitionSettings={transitionSettings}
            zoom={timelineZoom}
          />
        </section>
        <StudioControls {...studioControlProps} panel='properties' />
      </div>
      <AnimationSourceDrawer
        onApply={applyStudioSource}
        onClose={() => setSourceOpen(false)}
        open={sourceOpen}
        source={animationSource}
        title={gt('Animation source')}
      />
      </div>
    );
  }

  return (
    <MotionTranslationContext.Provider value={motionGT}>
    <AnimationVersionWorkspace
      autosaveState={autosaveState}
      collectionLabel='Saved animations'
      defaultName='Untitled animation'
      draftLabel='Autosaved animation'
      identityId={identityId}
      itemLabel='animation'
      layout='toolbar'
      onNew={startNewAnimation}
      onOpen={applyStudioSource}
      presentationMode={presentationMode}
      revision={animationDocumentRevision(animationDocument)}
      source={() => animationSource}
      toolId='animation'
      workspaceLabel='Animation Studio'
    >
      {renderWorkspace()}
    </AnimationVersionWorkspace>
    </MotionTranslationContext.Provider>
  );
}

export default memo(AnimationStudio);
