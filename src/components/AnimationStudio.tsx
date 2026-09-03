'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { T, useGT } from 'gt-next';
import { Clapperboard, Copy, Download, PanelsTopLeft, Plus, RotateCcw, Trash2 } from '@/components/ui/SolidIcons';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasDimensionHandles from '@/components/CanvasDimensionHandles';
import ArtboardSizeMenu from '@/components/ArtboardSizeMenu';
import { AnimationError, AnimationSourceDrawer } from '@/components/AnimationStudioFeedback';
import DesignVersionControls from '@/components/DesignVersionControls';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';
import { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioControls from '@/components/StudioControls';
import StudioToolHeader from '@/components/StudioToolHeader';
import TimelinePanel from '@/components/TimelinePanel';
import { Button } from '@/components/ui/Button';
import StudioContextMenu, {
  contextMenuPositionFromElement,
  contextMenuPositionFromEvent,
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import StudioSelect from '@/components/ui/StudioSelect';
import { useCanvasSelectionDismiss } from '@/hooks/useCanvasSelectionDismiss';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  advancePlaybackTime,
  animationTimelineChanged,
  cycleDurationMs,
  resolveTimeline,
  shouldRenderAnimationPreview,
} from '@/lib/animation';
import {
  ANIMATION_ARTBOARD_PRESETS,
  animationArtboardPresetForSize,
  animationArtboardSnapshotSignature,
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
  animationAudioClipEndMs,
  audioPeaks,
  createDefaultAnimationAudioState,
  createEmptyAnimationAudioState,
  mixAnimationAudio,
  normalizeAnimationAudioState,
  removeAnimationAudioClip,
  splitAnimationAudioClip,
  updateAnimationAudioClip,
  type AnimationAudioAsset,
  type AnimationAudioState,
} from '@/lib/animationAudio';
import type { BrandIdentity } from '@/lib/brandIdentity';
import {
  canvasDocumentContentRevision,
  isCanvasDocumentEnvelope,
} from '@/lib/canvasDocument';
import { encodeCanvasMp4 } from '@/lib/canvasExport';
import { blobToDataUrl, imageUrlToDataUrl } from '@/lib/download';
import { exportGif } from '@/lib/exportGif';
import type { LiveMaterialSettings } from '@/lib/liveMaterials';
import {
  canCompositeShaderDirectly,
  hasAnimatedShaderBackgrounds,
  renderFrame,
  resolveStudioBackgroundOpacity,
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
import {
  applyFrameSettings,
  createDefaultFrameSettings,
  DEFAULT_SETTINGS,
  DEFAULT_TEXT_FRAMES,
  mergeStudioBackground,
  orderStudioSources,
  resolveStudioFrameSettings,
  resolveStudioTransitionSettings,
  type ImportedImage,
  type SourceMode,
  type StudioBackgroundSettings,
  type StudioFrameSettings,
  type StudioSettings,
  type StudioTransitionSettings,
} from '@/lib/studio';

const INTERACTIVE_PREVIEW_FPS = 60;

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

function animationSourceBounds(
  source: StudioSource | null,
  frameSettings: StudioFrameSettings | null,
  settings: StudioSettings,
  canvasWidth: number,
  canvasHeight: number
): { height: number; width: number } {
  if (!source) return { height: 80, width: 160 };
  if (source.kind === 'text') {
    const fontSize = frameSettings?.fontSize ?? settings.fontSize;
    return {
      height: Math.min(canvasHeight * 0.72, fontSize * 1.45),
      width: Math.min(canvasWidth * 0.88, Math.max(96, Array.from(source.text).length * fontSize * 0.62)),
    };
  }
  const ratio = source.width / Math.max(1, source.height);
  const maxWidth = canvasWidth * 0.68;
  const maxHeight = canvasHeight * 0.68;
  const width = Math.min(maxWidth, maxHeight * ratio);
  return { height: width / ratio, width };
}

function AnimationShaderLayers({
  activeShaderSourceIds,
  backgroundOverrides,
  directShaderComposite,
  exportProgress,
  isPlaying,
  overrideShaderSettings,
  sequenceBackground,
  sequenceShaderIsActive,
  sequenceShaderLayerRef,
  sequenceShaderOpacity,
  sequenceShaderSettings,
  shaderCaptureTimeMs,
  shaderLayerRefs,
  showSequenceShader,
  sources,
  studioShaderSettings,
}: {
  activeShaderSourceIds: Set<string>;
  backgroundOverrides: Record<string, boolean>;
  directShaderComposite: boolean;
  exportProgress: number | null;
  isPlaying: boolean;
  overrideShaderSettings: Map<string, StudioSettings['shaderSettings']>;
  sequenceBackground: StudioBackgroundSettings;
  sequenceShaderIsActive: boolean;
  sequenceShaderLayerRef: RefObject<HTMLDivElement | null>;
  sequenceShaderOpacity: number;
  sequenceShaderSettings: StudioSettings['shaderSettings'];
  shaderCaptureTimeMs: number | null;
  shaderLayerRefs: RefObject<Map<string, HTMLDivElement>>;
  showSequenceShader: boolean;
  sources: readonly StudioSource[];
  studioShaderSettings: StudioSettings['shaderSettings'];
}) {
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
            captureTimeMs={shaderCaptureTimeMs}
            enabled
            frameRate={INTERACTIVE_PREVIEW_FPS}
            materialId={sequenceBackground.materialId}
            patternScale={sequenceBackground.patternScale ?? 1}
            paused={exportProgress === null && (!isPlaying || !sequenceShaderIsActive)}
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
              captureTimeMs={shaderCaptureTimeMs}
              enabled={exportProgress !== null || activeShaderSourceIds.has(source.id)}
              frameRate={INTERACTIVE_PREVIEW_FPS}
              materialId={source.background.materialId}
              patternScale={source.background.patternScale ?? 1}
              paused={!isPlaying && exportProgress === null}
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
  workspaceControls,
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
  workspaceControls?: ReactNode;
}) {
  const active = artboards.find(({ id }) => id === activeArtboardId) ?? artboards[0];
  const [menuPosition, setMenuPosition] = useState<StudioContextMenuPosition | null>(null);
  return (
    <section
      aria-keyshortcuts='Shift+F10'
      aria-label='Animation artboards'
      className='animation-artboard-bar'
      data-canvas-selection-preserve
      data-has-file-controls={workspaceControls ? 'true' : 'false'}
      data-studio-context-trigger='animation-artboard'
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuPosition(contextMenuPositionFromEvent(event));
      }}
      onKeyDown={(event) => {
        if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return;
        event.preventDefault();
        setMenuPosition(contextMenuPositionFromElement(event.currentTarget));
      }}
      tabIndex={0}
    >
      {workspaceControls ? (
        <div className='animation-artboard-file-controls'>{workspaceControls}</div>
      ) : null}
      <div className='animation-artboard-bar-picker'>
        <PanelsTopLeft aria-hidden='true' />
        <StudioSelect
          ariaLabel='Active animation artboard'
          className='animation-artboard-select'
          onValueChange={(id) => onSelect(id as AnimationArtboardId)}
          options={artboards.map((artboard) => ({
            label: artboard.name.trim() || 'Untitled animation',
            value: artboard.id,
          }))}
          value={active?.id}
        />
      </div>
      <ArtboardSizeMenu
        artboardName={active?.name ?? 'Untitled animation'}
        className='animation-artboard-dimensions'
        dimensions={{ height, width }}
        onArtboardNameChange={onRename}
        onDimensionsChange={onDimensionsChange}
      />
      <span className='animation-artboard-summary'>
        {frameCount} frame{frameCount === 1 ? '' : 's'} · {(totalMs / 1000).toFixed(2)}s · {animationPackageLabel(packageId)}
      </span>
      <div className='animation-artboard-actions'>
        <Button aria-label='Add animation artboard' onClick={onAdd} size='sm' type='button' variant='outline'>
          <Plus aria-hidden='true' /><span>Add</span>
        </Button>
        <Button aria-label='Duplicate animation artboard' onClick={onDuplicate} size='icon-sm' title='Duplicate artboard' type='button' variant='outline'>
          <Copy aria-hidden='true' />
        </Button>
        <Button aria-label='Delete animation artboard' disabled={artboards.length <= 1} onClick={onRemove} size='icon-sm' title='Delete artboard' type='button' variant='outline'>
          <Trash2 aria-hidden='true' />
        </Button>
      </div>
      <StudioContextMenu
        detail={active ? `${active.snapshot.settings.width} × ${active.snapshot.settings.height}` : undefined}
        label={active?.name ?? 'Animation artboard'}
        onClose={() => setMenuPosition(null)}
        position={menuPosition}
        sections={[
          {
            items: [
              { icon: <Copy aria-hidden='true' />, id: 'duplicate-animation-artboard', label: 'Duplicate artboard', onSelect: onDuplicate, shortcut: '⌘D' },
              { icon: <Plus aria-hidden='true' />, id: 'new-animation-artboard', label: 'New artboard', onSelect: onAdd },
            ],
          },
          {
            items: [
              { danger: true, disabled: artboards.length <= 1, icon: <Trash2 aria-hidden='true' />, id: 'delete-animation-artboard', label: 'Delete artboard', onSelect: onRemove },
            ],
          },
        ]}
      />
    </section>
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

function presentationWorkspaceControls(
  presentationMode: boolean,
  controls: ReactNode
): ReactNode | undefined {
  if (presentationMode) return undefined;
  return controls;
}

function AnimationStudio({
  autoPlay = false,
  compactControls = false,
  embedded = false,
  identity,
  initialFontWeight,
  initialSequenceBackground,
  presentationMode = false,
}: {
  autoPlay?: boolean;
  compactControls?: boolean;
  embedded?: boolean;
  identity?: BrandIdentity;
  initialFontWeight?: number;
  initialSequenceBackground?: Partial<StudioBackgroundSettings>;
  presentationMode?: boolean;
}) {
  const gt = useGT();
  const identitySettings = useMemo(() => ({
    ...DEFAULT_SETTINGS,
    background: identity?.colors.find(({ id }) => id === 'ink')?.hex ?? DEFAULT_SETTINGS.background,
    foreground: identity?.colors.find(({ id }) => id === 'paper')?.hex ?? DEFAULT_SETTINGS.foreground,
  }), [identity]);
  const identityTextFrames = identity?.greetings.join('\n') || DEFAULT_TEXT_FRAMES;
  const identityId = identity?.id ?? 'default';
  const studioExport = useStudioExportProgress(`${identityId}:animation`);
  const [storedSettings, setStoredSettings] = useStudioDraft<StudioSettings>(
    identityId,
    'animation',
    'settings',
    identitySettings
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
  const settings = useMemo<StudioSettings>(() => {
    const mergedSettings = {
      ...identitySettings,
      ...storedSettings,
      shaderSettings: {
        ...identitySettings.shaderSettings,
        ...storedSettings.shaderSettings,
      },
    };
    return compactControls
      ? { ...mergedSettings, fontSize: Math.min(88, mergedSettings.fontSize) }
      : mergedSettings;
  }, [compactControls, identitySettings, storedSettings]);
  const [mode, setMode] = useState<SourceMode>('sequence');
  const [textFrames, setTextFrames] = useStudioDraft(
    identityId,
    'animation',
    'text-frames',
    identityTextFrames
  );
  const [images, setImages] = useState<ImportedImage[]>([]);
  const [brandLogo, setBrandLogo] = useState<StudioSource | null>(null);
  const [includeBrandLogo, setIncludeBrandLogo] = useStudioDraft(
    identityId,
    'animation',
    'include-brand-logo',
    Boolean(identity)
  );
  const [sequenceOrder, setSequenceOrder] = useStudioDraft<string[]>(
    identityId,
    'animation',
    'sequence-order',
    []
  );
  const [frameSettings, setFrameSettings] = useStudioDraft<Record<string, StudioFrameSettings>>(
    identityId,
    'animation',
    'frame-settings',
    {}
  );
  const defaultSequenceBackground = useMemo(() => mergeStudioBackground(
    createDefaultFrameSettings(settings).background,
    initialSequenceBackground ?? {},
    settings.shaderSettings
  ), [initialSequenceBackground, settings]);
  const [storedSequenceBackground, setStoredSequenceBackground] = useStudioDraft<StudioBackgroundSettings>(
    identityId,
    'animation',
    'sequence-background-v1',
    defaultSequenceBackground
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
    {}
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
  const [audioState, setAudioState] = useState<AnimationAudioState>(createDefaultAnimationAudioState);
  const [selectedAudioClipId, setSelectedAudioClipId] = useState<string | null>(null);
  const [audioBufferRevision, setAudioBufferRevision] = useState(0);
  const [activeTimeline, setActiveTimeline] = useState({ index: 0, nextIndex: 0 });
  const [shaderCaptureTimeMs, setShaderCaptureTimeMs] = useState<number | null>(null);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [documentCreatedAt] = useState(() => new Date().toISOString());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const workspaceVisibleRef = useRef(true);
  const canvasSelectionRef = useRef<HTMLDivElement>(null);
  const sequenceShaderLayerRef = useRef<HTMLDivElement>(null);
  const shaderLayerRefs = useRef(new Map<string, HTMLDivElement>());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef(new Map<string, AudioBuffer>());
  const audioPlaybackNodesRef = useRef<AudioBufferSourceNode[]>([]);
  const audioScheduleRevisionRef = useRef(0);
  const playheadRef = useRef(0);
  const previewDirtyRef = useRef(true);
  const initialSelectionAppliedRef = useRef(false);
  useCanvasSelectionDismiss(canvasSelectionRef, () => {
    setSelectedSourceId(null);
    setSelectedTransitionIndex(null);
    setBackgroundEditScope('sequence');
    setSelectedEffectTarget('content');
  });

  const textSources = useMemo<StudioSource[]>(
    () =>
      textFrames
        .split('\n')
        .map((text, index) => ({ id: `text-${index}`, kind: 'text' as const, text: text || 'New frame' })),
    [textFrames]
  );
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
  const baseSources = useMemo(
    () => [
      ...(includeBrandLogo && brandLogo ? [brandLogo] : []),
      ...textSources,
      ...imageSources,
    ],
    [brandLogo, imageSources, includeBrandLogo, textSources]
  );
  const resolvedFrameSettings = useMemo(
    () => Object.fromEntries(baseSources.map((source) => [
      source.id,
      resolveStudioFrameSettings(
        settings,
        frameSettings[source.id],
        sequenceBackground,
        Boolean(backgroundOverrides[source.id])
      ),
    ])),
    [backgroundOverrides, baseSources, frameSettings, sequenceBackground, settings]
  );
  const resolvedSources = useMemo(
    () =>
      orderStudioSources(baseSources, sequenceOrder).map((source) =>
        applyFrameSettings(source, resolvedFrameSettings[source.id] ?? createDefaultFrameSettings(settings))
      ),
    [baseSources, resolvedFrameSettings, sequenceOrder, settings]
  );
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
  const currentArtboardSignature = useMemo(
    () => animationArtboardSnapshotSignature(currentArtboardSnapshot),
    [currentArtboardSnapshot]
  );
  const workspaceArtboards = useMemo(() => artboards.map((artboard) => (
    artboard.id === activeArtboardId
      ? { ...artboard, snapshot: currentArtboardSnapshot }
      : artboard
  )), [activeArtboardId, artboards, currentArtboardSnapshot]);
  const workspaceArtboardsRef = useCommittedRef(workspaceArtboards);
  const activeArtboardIdRef = useCommittedRef(activeArtboardId);
  const currentArtboardSnapshotRef = useCommittedRef(currentArtboardSnapshot);
  const pendingArtboardApplyRef = useRef<{ id: AnimationArtboardId; signature: string } | null>(null);
  const activeArtboard = resolveActiveAnimationArtboard(workspaceArtboards, activeArtboardId);
  const animationState = useMemo<AnimationDocumentState>(() => ({
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
    sequenceBackground,
    sequenceOrder,
    settings,
    textFrames,
  ]);
  const animationDocument = useMemo(() => {
    const draft = createAnimationCanvasDocument({
      brandId: identityId,
      createdAt: documentCreatedAt,
      id: `${identityId}:animation:scene`,
      revision: 1,
      sources: resolvedSources,
      state: animationState,
      title: `${identity?.name ?? 'Glyphfield'} Animation`,
      updatedAt: documentCreatedAt,
    });
    return {
      ...draft,
      revision: canvasDocumentContentRevision(draft, { omitMetadataKeys: ['peaks'] }),
    };
  }, [animationState, documentCreatedAt, identity?.name, identityId, resolvedSources]);
  const sources = useMemo(() => {
    const sourceById = new Map(resolvedSources.map((source) => [source.id, source]));
    return animationDocument.pageIds.flatMap((pageId) => {
      const elementId = animationDocument.pages[pageId]?.elementIds[0];
      const source = elementId ? sourceById.get(elementId) : undefined;
      return source ? [source] : [];
    });
  }, [animationDocument, resolvedSources]);
  useEffect(() => {
    if (initialSelectionAppliedRef.current || sources.length === 0) return;
    if (selectedSourceId === 'brand-logo' && includeBrandLogo && !brandLogo) return;
    initialSelectionAppliedRef.current = true;
    const initialSource = sources.find(({ id }) => id === selectedSourceId) ?? sources[0];
    setSelectedSourceId(initialSource.id);
    setSelectedTransitionIndex(null);
    setSelectedEffectTarget('content');
    setBackgroundEditScope('sequence');
    playheadRef.current = 0;
  }, [brandLogo, includeBrandLogo, selectedSourceId, sources]);
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
    workspaceKey: animationWorkspaceKey,
  });
  const animationSource = portableAnimation.source;
  const autosaveState = portableAnimation.autosaveState;
  useEffect(() => {
    if (autosaveState === 'loading') return;
    const pending = pendingArtboardApplyRef.current;
    if (pending) {
      if (pending.id !== activeArtboardId || pending.signature !== currentArtboardSignature) return;
      pendingArtboardApplyRef.current = null;
    }
    setArtboards((current) => {
      const target = current.find(({ id }) => id === activeArtboardId);
      if (!target) return current;
      if (animationArtboardSnapshotSignature(target.snapshot) === currentArtboardSignature) return current;
      const next = current.map((artboard) => artboard.id === activeArtboardId
        ? { ...artboard, snapshot: cloneAnimationArtboardSnapshot(currentArtboardSnapshot) }
        : artboard);
      workspaceArtboardsRef.current = next;
      return next;
    });
  }, [activeArtboardId, autosaveState, currentArtboardSignature, currentArtboardSnapshot, workspaceArtboardsRef]);
  useEffect(() => {
    if (autosaveState === 'loading' || artboards.some(({ id }) => id === activeArtboardId)) return;
    const fallback = artboards[0];
    if (!fallback) return;
    activeArtboardIdRef.current = fallback.id;
    setActiveArtboardId(fallback.id);
  }, [activeArtboardId, activeArtboardIdRef, artboards, autosaveState, setActiveArtboardId]);
  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? null;
  const selectedFrameSettings = selectedSource
    ? resolvedFrameSettings[selectedSource.id] ?? createDefaultFrameSettings(settings)
    : null;
  const transitionSettings = useMemo(
    () => sources.map((source) => resolveStudioTransitionSettings(
      settings,
      frameSettings[source.id]?.transition
    )),
    [frameSettings, settings, sources]
  );
  const selectedTransition = selectedAnimationTransition(
    selectedTransitionIndex,
    sources,
    frameSettings,
    settings
  );
  const selectedTransitionSource = selectedTransition.source;
  const selectedTransitionSettings = selectedTransition.settings;
  const hasSelectedTransitionOverride = selectedTransition.hasOverride;
  const totalMs = cycleDurationMs({
    holdMs: settings.holdMs,
    itemCount: sources.length,
    transitionMs: settings.transitionMs,
  });
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
  const selectedBounds = animationSourceBounds(
    selectedSource,
    selectedFrameSettings,
    settings,
    canvasWidth,
    canvasHeight
  );

  const settingsRef = useCommittedRef(settings);
  const sourcesRef = useCommittedRef(sources);
  const frameSettingsRef = useCommittedRef(frameSettings);
  const imagesRef = useCommittedRef(images);
  const isPlayingRef = useCommittedRef(isPlaying);
  const playbackRateRef = useCommittedRef(playbackRate);
  const audioStateRef = useCommittedRef(audioState);
  const activeTimelineRef = useCommittedRef(activeTimeline);
  const backgroundOverridesRef = useCommittedRef(backgroundOverrides);
  const timelineRequiresShaderSyncRef = useCommittedRef(timelineRequiresShaderSync);

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

  const hydrateAudioBuffers = useCallback(async (assets: readonly AnimationAudioAsset[]) => {
    if (assets.length === 0) return;
    const context = getAudioContext();
    let changed = false;
    const hydrated = new Map<string, Pick<AnimationAudioAsset, 'durationMs' | 'peaks'>>();
    for (const asset of assets) {
      let buffer = audioBuffersRef.current.get(asset.id);
      if (!buffer) {
        buffer = await decodeAudioSource(context, asset.source);
        audioBuffersRef.current.set(asset.id, buffer);
        changed = true;
      }
      if (asset.peaks.length === 0 || Math.abs(asset.durationMs - buffer.duration * 1_000) > 1) {
        hydrated.set(asset.id, {
          durationMs: Math.round(buffer.duration * 1_000),
          peaks: audioPeaks(buffer),
        });
      }
    }
    if (hydrated.size > 0) {
      setAudioState((current) => ({
        ...current,
        assets: current.assets.map((asset) => {
          const patch = hydrated.get(asset.id);
          return patch ? { ...asset, ...patch } : asset;
        }),
      }));
    }
    if (changed) setAudioBufferRevision((revision) => revision + 1);
  }, [getAudioContext]);

  const scheduleAudioPlayback = useCallback(async (timeMs: number) => {
    stopAudioPlayback();
    const scheduleRevision = audioScheduleRevisionRef.current;
    const state = audioStateRef.current;
    if (state.muted || state.volume <= 0 || state.clips.length === 0) return;
    try {
      await hydrateAudioBuffers(state.assets);
      if (!isPlayingRef.current || audioScheduleRevisionRef.current !== scheduleRevision) return;
      const context = getAudioContext();
      try {
        await context.resume();
      } catch {
        // Browsers may defer audible playback until the first user gesture.
        return;
      }
      if (context.state !== 'running') return;
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

  useEffect(() => {
    setAudioState((current) => normalizeAnimationAudioState(current, totalMs));
  }, [totalMs]);

  useEffect(() => {
    void hydrateAudioBuffers(audioState.assets).catch(() => {
      setError(gt('One or more audio files could not be decoded.'));
    });
  }, [audioState.assets, gt, hydrateAudioBuffers]);

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
    stopAudioPlayback();
    const context = audioContextRef.current;
    audioContextRef.current = null;
    void closeBrowserAudioContext(context);
  }, [stopAudioPlayback]);

  useEffect(() => {
    previewDirtyRef.current = true;
  }, [settings, sources]);

  useMountEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const observer = new IntersectionObserver(([entry]) => {
      workspaceVisibleRef.current = entry?.isIntersecting ?? true;
    });
    observer.observe(workspace);
    return () => observer.disconnect();
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

  useMountEffect(() => {
    const logoAsset =
      identity?.assets.find(
        (asset) => asset.type === 'logo' && asset.surface === 'dark' && asset.id.includes('mark')
      ) ?? identity?.assets.find((asset) => asset.type === 'logo');
    if (!logoAsset) return;
    let cancelled = false;
    void loadImageSource(logoAsset.path, logoAsset.label)
      .then((source) => {
        if (!cancelled) setBrandLogo(source);
      })
      .catch(() => {
        if (!cancelled) {
          setError(gt('The brand logo could not be loaded.'));
          setSelectedSourceId((current) => current === 'brand-logo' ? 'text-0' : current);
        }
      });
    return () => {
      cancelled = true;
    };
  });

  const brandLogoSource = brandLogo?.kind === 'image' ? brandLogo.url : undefined;
  useEffect(() => {
    const source = brandLogoSource;
    if (!source || /^data:[^;,]+;base64,/i.test(source)) return;
    let active = true;
    void imageUrlToDataUrl(source).then((embeddedSource) => {
      if (!active) return;
      setBrandLogo((current) => current?.kind === 'image' && current.url === source
        ? { ...current, url: embeddedSource }
        : current);
    }).catch(() => {
      if (active) setError(gt('The brand logo could not be embedded for sharing.'));
    });
    return () => {
      active = false;
    };
  }, [brandLogoSource, gt]);

  function attachShaderLayers(currentSources: readonly StudioSource[]): StudioSource[] {
    return currentSources.map((source) => {
      if (source.background?.style !== 'shader') return source;
      const wrapper = backgroundOverridesRef.current[source.id]
        ? shaderLayerRefs.current.get(source.id)
        : sequenceShaderLayerRef.current;
      const image = wrapper?.querySelector('canvas');
      if (!image) return source;
      return {
        ...source,
        background: { ...source.background, image },
      };
    });
  }

  useMountEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      isPlayingRef.current = false;
      setIsPlaying(false);
    }

    let animationFrame = 0;
    let previousTimestamp = performance.now();
    let previousRenderTimestamp = 0;
    let previousRenderedSourceId = '';

    function tick(timestamp: number) {
      if (!workspaceVisibleRef.current) {
        previousTimestamp = timestamp;
        animationFrame = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Math.min(100, timestamp - previousTimestamp);
      previousTimestamp = timestamp;
      const currentSettings = settingsRef.current;
      const currentSources = sourcesRef.current;
      const duration = cycleDurationMs({
        holdMs: currentSettings.holdMs,
        itemCount: currentSources.length,
        transitionMs: currentSettings.transitionMs,
      });

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
          isPlayingRef.current = false;
          setIsPlaying(false);
        }
      }

      const position = resolveTimeline(playheadRef.current, {
        holdMs: currentSettings.holdMs,
        itemCount: Math.max(1, currentSources.length),
        transitionMs: currentSettings.transitionMs,
      });
      const previousActiveTimeline = activeTimelineRef.current;
      if (
        timelineRequiresShaderSyncRef.current
        && animationTimelineChanged(position, previousActiveTimeline)
      ) {
        const nextActiveTimeline = { index: position.index, nextIndex: position.nextIndex };
        activeTimelineRef.current = nextActiveTimeline;
        setActiveTimeline(nextActiveTimeline);
      }

      const canvas = canvasRef.current;
      const currentSource = currentSources[position.index];
      const nextSource = currentSources[position.nextIndex];
      const directComposite = canCompositeShaderDirectly(
        currentSource,
        nextSource,
        backgroundOverridesRef.current
      );
      const previewFrameInterval = isPlayingRef.current
        ? 1000 / INTERACTIVE_PREVIEW_FPS
        : 120;
      const frameIsDue = timestamp - previousRenderTimestamp >= previewFrameInterval;
      const contentIsAnimated = position.phase === 'transition' && currentSources.length > 1;
      const shouldRender = shouldRenderAnimationPreview({
        contentIsAnimated,
        currentSourceId: currentSource?.id,
        directComposite,
        frameIsDue,
        pageVisible: document.visibilityState !== 'hidden',
        previewDirty: previewDirtyRef.current,
        previousSourceId: previousRenderedSourceId,
      });
      if (canvas && shouldRender) {
        previousRenderTimestamp = timestamp;
        previousRenderedSourceId = currentSource?.id ?? '';
        previewDirtyRef.current = false;
        const width = Math.max(120, currentSettings.width);
        const height = Math.max(120, currentSettings.height);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, width, height);
          renderFrame(
            context,
            attachShaderLayers(currentSources),
            {
              ...currentSettings,
              ...resolveStudioTransitionSettings(
                currentSettings,
                currentSource ? frameSettingsRef.current[currentSource.id]?.transition : undefined
              ),
              width,
              height,
            },
            position,
            { omitBackground: directComposite }
          );
        }
      }
      animationFrame = requestAnimationFrame(tick);
    }

    animationFrame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrame);
      for (const image of imagesRef.current) URL.revokeObjectURL(image.url);
    };
  });

  function updateSettings(patch: Partial<StudioSettings>) {
    setStoredSettings((current) => ({ ...current, ...patch }));
  }

  function applyArtboardSnapshot(snapshot: AnimationArtboardSnapshot) {
    const next = cloneAnimationArtboardSnapshot(snapshot);
    setAudioState(normalizeAnimationAudioState(
      next.audio ?? createDefaultAnimationAudioState(),
      cycleDurationMs({
        holdMs: next.settings.holdMs,
        itemCount: sources.length,
        transitionMs: next.settings.transitionMs,
      })
    ));
    setStoredSettings(next.settings);
    setFrameSettings(next.frameSettings);
    setStoredSequenceBackground(next.sequenceBackground);
    setBackgroundOverrides(next.backgroundOverrides);
    setSequenceOrder(next.sequenceOrder);
    setSelectedSourceId(next.sequenceOrder[0] ?? (includeBrandLogo && brandLogo ? 'brand-logo' : 'text-0'));
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
    pendingArtboardApplyRef.current = {
      id,
      signature: animationArtboardSnapshotSignature(snapshot),
    };
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
    pendingArtboardApplyRef.current = { id, signature: animationArtboardSnapshotSignature(snapshot) };
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
    pendingArtboardApplyRef.current = { id, signature: animationArtboardSnapshotSignature(snapshot) };
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
    pendingArtboardApplyRef.current = {
      id: fallback.id,
      signature: animationArtboardSnapshotSignature(snapshot),
    };
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
    setSelectedSourceId(brandLogo ? 'brand-logo' : 'text-0');
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
    seek(Math.max(0, index) * (settings.holdMs + settings.transitionMs));
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
    const duration = cycleDurationMs({
      holdMs: settingsRef.current.holdMs,
      itemCount: sourcesRef.current.length,
      transitionMs: settingsRef.current.transitionMs,
    });
    const next = Math.min(Math.max(0, timeMs), duration);
    playheadRef.current = next;
    const nextTimeline = resolveTimeline(next, {
      holdMs: settingsRef.current.holdMs,
      itemCount: Math.max(1, sourcesRef.current.length),
      transitionMs: settingsRef.current.transitionMs,
    });
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
      setSelectedSourceId(null);
      setSelectedTransitionIndex(null);
      setBackgroundEditScope('sequence');
      setSelectedEffectTarget('content');
    }
    isPlayingRef.current = playing;
    setIsPlaying(playing);
  }

  async function waitForShaderCapture(timeMs: number, initial = false) {
    flushSync(() => setShaderCaptureTimeMs(timeMs));
    await new Promise<void>((resolve) => {
      let remainingFrames = initial ? 10 : 3;
      const settleFrame = () => {
        remainingFrames -= 1;
        if (remainingFrames === 0) resolve();
        else requestAnimationFrame(settleFrame);
      };
      requestAnimationFrame(settleFrame);
    });
  }

  async function handleExport(format: 'gif' | 'mp4') {
    if (sources.length === 0) {
      setError(gt('Add at least one frame before exporting.'));
      return;
    }

    setError(null);
    studioExport.start(format === 'mp4' ? 'Rendering MP4 preview' : 'Rendering GIF preview', 0);
    const resumeAfterExport = isPlayingRef.current;
    changePlaying(false);
    const shaderBackgroundsAreActive = hasAnimatedShaderBackgrounds(sources);
    try {
      flushSync(() => {
        setExportProgress(0);
        if (shaderBackgroundsAreActive) setShaderCaptureTimeMs(0);
      });
      if (shaderBackgroundsAreActive) await waitForShaderCapture(0, true);
      const exportSources = attachShaderLayers(sources);
      const onProgress = (progress: number) => {
        setExportProgress(progress);
        studioExport.update(progress);
      };
      const blob = format === 'gif'
        ? await exportGif({
            beforeFrame: shaderBackgroundsAreActive
              ? (frame) => waitForShaderCapture(frame.atMs)
              : undefined,
            config: settings,
            onProgress,
            resolveRenderConfig: (frame) => ({
              ...settings,
              ...(transitionSettings[frame.position.index] ?? resolveStudioTransitionSettings(settings, undefined)),
            }),
            sampleHoldFrames: shaderBackgroundsAreActive,
            sources: exportSources,
          })
        : await (async () => {
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
                if (shaderBackgroundsAreActive) await waitForShaderCapture(frame.timeMs);
                context.clearRect(0, 0, canvas.width, canvas.height);
                const position = resolveTimeline(frame.timeMs, {
                  holdMs: settings.holdMs,
                  itemCount: sources.length,
                  transitionMs: settings.transitionMs,
                });
                renderFrame(
                  context,
                  exportSources,
                  {
                    ...settings,
                    ...(transitionSettings[position.index] ?? resolveStudioTransitionSettings(settings, undefined)),
                    height: canvas.height,
                    width: canvas.width,
                  },
                  position
                );
              },
            });
          })();
      const fileName = `studio-${settings.packageId}.${format}`;
      setLastExport({
        blob,
        fileName,
        format: format === 'mp4' ? 'MP4' : 'GIF',
        height: settings.height,
        width: settings.width,
      });
    } catch {
      setError(format === 'mp4'
        ? gt('The MP4 could not be encoded. Try a smaller canvas or another browser.')
        : gt('The GIF could not be encoded. Try a smaller canvas or lower frame rate.'));
    } finally {
      setShaderCaptureTimeMs(null);
      setExportProgress(null);
      if (resumeAfterExport) changePlaying(true);
      studioExport.finish();
    }
  }

  function resetStudio() {
    const resetBackground = createDefaultFrameSettings(identitySettings).background;
    const resetSnapshot: AnimationArtboardSnapshot = {
      audio: createDefaultAnimationAudioState(),
      backgroundOverrides: {},
      frameSettings: {},
      sequenceBackground: resetBackground,
      sequenceOrder: [],
      settings: identitySettings,
    };
    const resetArtboards: AnimationArtboard[] = [{
      id: DEFAULT_ANIMATION_ARTBOARD_ID,
      name: `${animationArtboardPresetForSize(identitySettings.width, identitySettings.height)?.label ?? 'Custom'} animation`,
      snapshot: cloneAnimationArtboardSnapshot(resetSnapshot),
    }];
    workspaceArtboardsRef.current = resetArtboards;
    activeArtboardIdRef.current = DEFAULT_ANIMATION_ARTBOARD_ID;
    currentArtboardSnapshotRef.current = resetSnapshot;
    pendingArtboardApplyRef.current = null;
    setArtboards(resetArtboards);
    setActiveArtboardId(DEFAULT_ANIMATION_ARTBOARD_ID);
    setStoredSettings(identitySettings);
    setStoredSequenceBackground(resetBackground);
    setTextFrames(identityTextFrames);
    setMode('sequence');
    setIncludeBrandLogo(Boolean(identity));
    setSequenceOrder([]);
    setFrameSettings({});
    setBackgroundOverrides({});
    setBackgroundEditScope('sequence');
    setSelectedSourceId(brandLogo ? 'brand-logo' : 'text-0');
    setSelectedTransitionIndex(null);
    setSelectedEffectTarget('content');
    setError(null);
    setPlaybackRate(1);
    setAudioState(createDefaultAnimationAudioState());
    setSelectedAudioClipId(null);
    audioBuffersRef.current.clear();
    setLastExport(null);
    changePlaying(true);
    seek(0);
  }

  function startNewAnimation() {
    const scratchSnapshot = cloneAnimationArtboardSnapshot({
      audio: createDefaultAnimationAudioState(),
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
    pendingArtboardApplyRef.current = null;
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
    setAudioState(scratchSnapshot.audio ?? createDefaultAnimationAudioState());
    setSelectedAudioClipId(null);
    audioBuffersRef.current.clear();
    setAudioBufferRevision((revision) => revision + 1);
    setLastExport(null);
    changePlaying(false);
    seek(0);
  }

  function applyAnimationState(next: AnimationDocumentState) {
    const nextMode = next.mode;
    if (!['sequence', 'text', 'images'].includes(nextMode)) {
      throw new TypeError('Mode must be sequence, text, or images.');
    }
    const nextPlaybackRate = next.playbackRate;
    if (nextPlaybackRate <= 0 || nextPlaybackRate > 4) {
      throw new RangeError('Playback rate must be greater than 0 and no more than 4.');
    }

    const restoredSnapshot: AnimationArtboardSnapshot = {
      audio: normalizeAnimationAudioState(next.audio ?? createDefaultAnimationAudioState()),
      backgroundOverrides: next.backgroundOverrides as Record<string, boolean>,
      frameSettings: next.frameSettings as Record<string, StudioFrameSettings>,
      sequenceBackground: next.sequenceBackground as StudioBackgroundSettings,
      sequenceOrder: [...next.sequenceOrder],
      settings: next.settings as StudioSettings,
    };
    const restoredWorkspace = restoreAnimationArtboardWorkspace({
      activeArtboardId: next.activeArtboardId,
      artboards: next.artboards,
    }, restoredSnapshot);

    setMode(nextMode as SourceMode);
    setTextFrames(next.textFrames);
    setIncludeBrandLogo(next.includeBrandLogo);
    setSequenceOrder([...next.sequenceOrder]);
    setStoredSettings(next.settings as StudioSettings);
    setFrameSettings(next.frameSettings as Record<string, StudioFrameSettings>);
    setStoredSequenceBackground(next.sequenceBackground as StudioBackgroundSettings);
    setBackgroundOverrides(next.backgroundOverrides as Record<string, boolean>);
    setPlaybackRate(nextPlaybackRate);
    setAudioState(restoredSnapshot.audio ?? createEmptyAnimationAudioState());
    setSelectedAudioClipId(null);
    audioBuffersRef.current.clear();
    pendingArtboardApplyRef.current = null;
    workspaceArtboardsRef.current = restoredWorkspace.artboards;
    activeArtboardIdRef.current = restoredWorkspace.activeArtboardId;
    currentArtboardSnapshotRef.current = restoredSnapshot;
    setArtboards(restoredWorkspace.artboards);
    setActiveArtboardId(restoredWorkspace.activeArtboardId);
    setSelectedSourceId(next.sequenceOrder[0] ?? (next.includeBrandLogo && brandLogo ? 'brand-logo' : 'text-0'));
    setSelectedTransitionIndex(null);
    setBackgroundEditScope('sequence');
    setSelectedEffectTarget('content');
    seek(0);
  }

  async function applyStudioSource(source: string) {
    const parsed = parseSourceObject(source);
    if (isCanvasDocumentEnvelope(parsed)) {
      const restored = parseAnimationCanvasDocument(source);
      applyAnimationState(restored.state);
      const storedImages = await Promise.all(restored.assets.map(loadStoredImage));
      const restoredLogo = storedImages.find(({ id }) => id === 'brand-logo');
      if (restoredLogo) setBrandLogo({ ...restoredLogo, kind: 'image' });
      setImages(storedImages.filter(({ id }) => id !== 'brand-logo'));
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

  function selectSource(id: string) {
    setSelectedTransitionIndex(null);
    setSelectedSourceId(id);
    setSelectedEffectTarget('content');
    changePlaying(false);
    const index = sources.findIndex((source) => source.id === id);
    seek(Math.max(0, index) * (settings.holdMs + settings.transitionMs));
  }

  function selectSourceBackground(id: string) {
    setSelectedTransitionIndex(null);
    setSelectedSourceId(id);
    setSelectedEffectTarget('background');
    setBackgroundEditScope('frame');
    changePlaying(false);
    const index = sources.findIndex((source) => source.id === id);
    seek(Math.max(0, index) * (settings.holdMs + settings.transitionMs));
  }

  function selectTransition(index: number) {
    if (sources.length < 2) return;
    const resolvedIndex = Math.min(Math.max(0, index), sources.length - 1);
    setSelectedSourceId(null);
    setSelectedTransitionIndex(resolvedIndex);
    setSelectedEffectTarget('content');
    setBackgroundEditScope('sequence');
    changePlaying(false);
    seek(resolvedIndex * (settings.holdMs + settings.transitionMs) + settings.holdMs + settings.transitionMs / 2);
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
    setSelectedSourceId(null);
    setSelectedTransitionIndex(null);
    setSelectedEffectTarget('background');
    setBackgroundEditScope('sequence');
    changePlaying(false);
  }

  const previewSources = attachShaderLayers(sources);
  const studioControlProps = {
    backgroundOverrideCount: sources.filter((source) => backgroundOverrides[source.id]).length,
    backgroundOverrideSourceIds: sources.filter((source) => backgroundOverrides[source.id]).map(({ id }) => id),
    backgroundScope: backgroundEditScope,
    brandLogoAvailable: Boolean(brandLogo),
    compact: compactControls,
    frameSettings: selectedFrameSettings,
    hasSelectedBackgroundOverride: Boolean(selectedSource && backgroundOverrides[selectedSource.id]),
    hasImageSources: sources.some((source) => source.kind === 'image'),
    hasSelectedTransitionOverride,
    identity,
    includeBrandLogo,
    onAddText: addTextSource,
    onBackgroundChange: updateSelectedBackground,
    onBackgroundScopeChange: setBackgroundEditScope,
    onClearBackgroundOverrides: clearBackgroundOverrides,
    onLibraryBackgroundChange: applyLibraryBackground,
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
    previewSources,
    selectedSource,
    selectedEffectTarget,
    selectedTransitionIndex,
    selectedTransitionSettings,
    sequenceBackground,
    settings,
    sources,
    transitionSettings,
  };
  const animationWorkspaceControls = presentationWorkspaceControls(presentationMode,
    <DesignVersionControls
      autosaveState={autosaveState}
      collectionLabel='Saved animations'
      defaultName='Untitled animation'
      draftLabel='Autosaved animation'
      identityId={identityId}
      itemLabel='animation'
      layout='toolbar'
      onNew={startNewAnimation}
      onOpen={applyStudioSource}
      revision={String(animationDocument.revision)}
      source={() => animationSource}
      toolId='animation'
      workspaceLabel='Animation Studio'
    />
  );

  function renderWorkspace() {
    return (
      <div
      className={animationStudioClassName({ compactControls, embedded, presentationMode })}
      ref={workspaceRef}
    >
      <StudioToolHeader
        actions={(
          <>
          <SourceCodeButton disabled={animationSource === null} onClick={() => setSourceOpen(true)} />
          <ExportPreview asset={lastExport} className='hidden xl:inline-flex' />
          <Button
            aria-label={gt('Reset studio')}
            className='studio-reset'
            onClick={resetStudio}
            size='icon'
            type='button'
            variant='outline'
          >
            <RotateCcw aria-hidden='true' />
          </Button>
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
          </>
        )}
        metadata={embedded ? undefined : <T>Studio / Motion</T>}
        title={<T>Animation</T>}
        toolId='animation'
      />

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
              workspaceControls={animationWorkspaceControls}
            />

            <CanvasViewport
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
                  activeShaderSourceIds={activeShaderSourceIds}
                  backgroundOverrides={backgroundOverrides}
                  directShaderComposite={directShaderComposite}
                  exportProgress={exportProgress}
                  isPlaying={isPlaying}
                  overrideShaderSettings={overrideShaderSettings}
                  sequenceBackground={sequenceBackground}
                  sequenceShaderIsActive={sequenceShaderIsActive}
                  sequenceShaderLayerRef={sequenceShaderLayerRef}
                  sequenceShaderOpacity={sequenceShaderOpacity}
                  sequenceShaderSettings={sequenceShaderSettings}
                  shaderCaptureTimeMs={shaderCaptureTimeMs}
                  shaderLayerRefs={shaderLayerRefs}
                  showSequenceShader={hasSequenceShaderSources}
                  sources={sources}
                  studioShaderSettings={settings.shaderSettings}
                />
                <canvas
                  aria-label={gt('Animation preview canvas')}
                  className='absolute inset-0 z-10 size-full'
                  height={canvasHeight}
                  ref={canvasRef}
                  width={canvasWidth}
                />
                {selectedSource && selectedFrameSettings ? (
                  <EditableCanvasLayer
                    baseHeight={selectedBounds.height}
                    baseWidth={selectedBounds.width}
                    baseX={(canvasWidth - selectedBounds.width) / 2}
                    baseY={(canvasHeight - selectedBounds.height) / 2}
                    canvasHeight={canvasHeight}
                    canvasWidth={canvasWidth}
                    label={selectedSource.kind === 'text' ? selectedSource.text : selectedSource.name}
                    onChange={(transform) => updateSelectedFrame({
                      alignX: Math.min(1, Math.max(-1, (transform.x / canvasWidth) * 2)),
                      alignY: Math.min(1, Math.max(-1, (transform.y / canvasHeight) * 2)),
                      scale: transform.scale,
                    })}
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
                      scale: selectedFrameSettings.scale,
                      x: (selectedFrameSettings.alignX * canvasWidth) / 2,
                      y: (selectedFrameSettings.alignY * canvasHeight) / 2,
                    }}
                    zIndex={30}
                  >
                    <span />
                  </EditableCanvasLayer>
                ) : null}
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

            <AnimationError error={error} />
          </div>

          <TimelinePanel
            audio={audioState}
            currentMsRef={playheadRef}
            isPlaying={isPlaying}
            onAudioClipChange={updateAudioClip}
            onAudioFiles={(files) => void importAudioFiles(files)}
            onAudioMutedChange={(muted) => setAudioState((current) => ({ ...current, muted }))}
            onAudioRemoveClip={removeAudioClip}
            onAudioSelectedClipChange={setSelectedAudioClipId}
            onAudioSplitClip={splitAudioClip}
            onAudioVolumeChange={(volume) => setAudioState((current) => ({ ...current, volume }))}
            onPlayChange={changePlaying}
            onRateChange={(rate) => {
              playbackRateRef.current = rate;
              setPlaybackRate(rate);
            }}
            onSeek={seek}
            onSelectSource={selectSource}
            onSelectTransition={selectTransition}
            playbackRate={playbackRate}
            presentationMode={presentationMode}
            previewSources={previewSources}
            selectedAudioClipId={selectedAudioClipId}
            selectedSourceId={selectedSourceId}
            selectedTransitionIndex={selectedTransitionIndex}
            settings={settings}
            sources={sources}
            totalMs={totalMs}
            transitionSettings={transitionSettings}
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

  return renderWorkspace();
}

export default memo(AnimationStudio);
