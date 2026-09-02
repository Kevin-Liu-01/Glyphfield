'use client';

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { T, useGT } from 'gt-next';
import { Download, RotateCcw } from '@/components/ui/SolidIcons';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasDimensionHandles from '@/components/CanvasDimensionHandles';
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
  createAnimationCanvasDocument,
  parseAnimationCanvasDocument,
  type AnimationDocumentState,
} from '@/lib/animationDocument';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { canvasRevisionFromSignature, isCanvasDocumentEnvelope } from '@/lib/canvasDocument';
import { blobToDataUrl, imageUrlToDataUrl } from '@/lib/download';
import { exportGif } from '@/lib/exportGif';
import type { LiveMaterialSettings } from '@/lib/liveMaterials';
import {
  canCompositeShaderDirectly,
  hasAnimatedShaderBackgrounds,
  renderFrame,
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
  type ImportedImage,
  type SourceMode,
  type StudioBackgroundSettings,
  type StudioFrameSettings,
  type StudioSettings,
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
          className={`pointer-events-none absolute inset-0 ${directShaderComposite ? 'opacity-100' : 'opacity-0'}`}
          data-animation-shader-active={sequenceShaderIsActive ? 'true' : 'false'}
          data-animation-shader-layer='sequence'
          ref={sequenceShaderLayerRef}
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

function AnimationStudio({
  compactControls = false,
  embedded = false,
  identity,
  initialFontWeight,
  initialSequenceBackground,
}: {
  compactControls?: boolean;
  embedded?: boolean;
  identity?: BrandIdentity;
  initialFontWeight?: number;
  initialSequenceBackground?: Partial<StudioBackgroundSettings>;
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
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedEffectTarget, setSelectedEffectTarget] = useState<
    'background' | 'content'
  >('content');
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useStudioDraft(
    identityId,
    'animation',
    'playback-rate',
    1
  );
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
  const playheadRef = useRef(0);
  const previewDirtyRef = useRef(true);
  useCanvasSelectionDismiss(canvasSelectionRef, () => {
    setSelectedSourceId(null);
    setBackgroundEditScope('sequence');
  });

  const textSources = useMemo<StudioSource[]>(
    () =>
      textFrames
        .split('\n')
        .map((text) => text.trim())
        .filter(Boolean)
        .map((text, index) => ({ id: `text-${index}`, kind: 'text' as const, text })),
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
  const animationState = useMemo<AnimationDocumentState>(() => ({
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
  const animationRevision = useMemo(() => JSON.stringify({
    sources: resolvedSources.map((source) => source.kind === 'text'
      ? { ...source }
      : { ...source, image: undefined }),
    state: animationState,
  }), [animationState, resolvedSources]);
  const animationDocument = useMemo(() => createAnimationCanvasDocument({
    brandId: identityId,
    createdAt: documentCreatedAt,
    id: `${identityId}:animation:scene`,
    revision: canvasRevisionFromSignature(animationRevision),
    sources: resolvedSources,
    state: animationState,
    title: `${identity?.name ?? 'Glyphfield'} Animation`,
    updatedAt: documentCreatedAt,
  }), [animationRevision, animationState, documentCreatedAt, identity?.name, identityId, resolvedSources]);
  const sources = useMemo(() => {
    const sourceById = new Map(resolvedSources.map((source) => [source.id, source]));
    return animationDocument.pageIds.flatMap((pageId) => {
      const elementId = animationDocument.pages[pageId]?.elementIds[0];
      const source = elementId ? sourceById.get(elementId) : undefined;
      return source ? [source] : [];
    });
  }, [animationDocument, resolvedSources]);
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
  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? null;
  const selectedFrameSettings = selectedSource
    ? resolvedFrameSettings[selectedSource.id] ?? createDefaultFrameSettings(settings)
    : null;
  const labels = sources.map((source) =>
    source.kind === 'text' ? source.text : source.name
  );
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
  const imagesRef = useCommittedRef(images);
  const isPlayingRef = useCommittedRef(isPlaying);
  const playbackRateRef = useCommittedRef(playbackRate);
  const activeTimelineRef = useCommittedRef(activeTimeline);
  const backgroundOverridesRef = useCommittedRef(backgroundOverrides);
  const timelineRequiresShaderSyncRef = useCommittedRef(timelineRequiresShaderSync);

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
        if (!cancelled) setError(gt('The brand logo could not be loaded.'));
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
        const advance = advancePlaybackTime({
          currentTimeMs: playheadRef.current,
          durationMs: duration,
          elapsedMs: elapsed,
          loop: currentSettings.loop,
          playbackRate: playbackRateRef.current,
        });
        playheadRef.current = advance.timeMs;
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
            { ...currentSettings, width, height },
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

  function changeMode(nextMode: SourceMode) {
    setMode(nextMode);
    seek(0);
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

  function resetSelectedBackgroundOverride() {
    if (!selectedSource) return;
    setBackgroundOverrides((current) => {
      const next = { ...current };
      delete next[selectedSource.id];
      return next;
    });
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
  }

  function changePlaying(playing: boolean) {
    if (playing && totalMs > 0 && playheadRef.current >= totalMs) seek(0);
    if (playing) {
      setSelectedSourceId(null);
      setBackgroundEditScope('sequence');
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

  async function handleExport() {
    if (sources.length === 0) {
      setError(gt('Add at least one frame before exporting.'));
      return;
    }

    setError(null);
    studioExport.start('Rendering GIF preview', 0);
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
      const blob = await exportGif({
        beforeFrame: shaderBackgroundsAreActive
          ? (frame) => waitForShaderCapture(frame.atMs)
          : undefined,
        config: settings,
        onProgress: (progress) => {
          setExportProgress(progress);
          studioExport.update(progress);
        },
        sampleHoldFrames: shaderBackgroundsAreActive,
        sources: exportSources,
      });
      const fileName = `studio-${settings.packageId}.gif`;
      setLastExport({
        blob,
        fileName,
        format: 'GIF',
        height: settings.height,
        width: settings.width,
      });
    } catch {
      setError(gt('The GIF could not be encoded. Try a smaller canvas or lower frame rate.'));
    } finally {
      setShaderCaptureTimeMs(null);
      setExportProgress(null);
      if (resumeAfterExport) changePlaying(true);
      studioExport.finish();
    }
  }

  function resetStudio() {
    setStoredSettings(identitySettings);
    setStoredSequenceBackground(createDefaultFrameSettings(identitySettings).background);
    setTextFrames(identityTextFrames);
    setMode('sequence');
    setIncludeBrandLogo(Boolean(identity));
    setSequenceOrder([]);
    setFrameSettings({});
    setBackgroundOverrides({});
    setBackgroundEditScope('sequence');
    setSelectedSourceId(null);
    setSelectedEffectTarget('content');
    setError(null);
    setPlaybackRate(1);
    setLastExport(null);
    changePlaying(true);
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

    setMode(nextMode as SourceMode);
    setTextFrames(next.textFrames);
    setIncludeBrandLogo(next.includeBrandLogo);
    setSequenceOrder([...next.sequenceOrder]);
    setStoredSettings(next.settings as StudioSettings);
    setFrameSettings(next.frameSettings as Record<string, StudioFrameSettings>);
    setStoredSequenceBackground(next.sequenceBackground as StudioBackgroundSettings);
    setBackgroundOverrides(next.backgroundOverrides as Record<string, boolean>);
    setPlaybackRate(nextPlaybackRate);
    setSelectedSourceId(null);
    setBackgroundEditScope('sequence');
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

  const studioControlProps = {
    backgroundOverrideCount: sources.filter((source) => backgroundOverrides[source.id]).length,
    backgroundScope: backgroundEditScope,
    brandLogoAvailable: Boolean(brandLogo),
    compact: compactControls,
    frameSettings: selectedFrameSettings,
    hasSelectedBackgroundOverride: Boolean(selectedSource && backgroundOverrides[selectedSource.id]),
    hasImageSources: sources.some((source) => source.kind === 'image'),
    identity,
    images,
    includeBrandLogo,
    mode,
    onBackgroundChange: updateSelectedBackground,
    onBackgroundScopeChange: setBackgroundEditScope,
    onClearBackgroundOverrides: clearBackgroundOverrides,
    onLibraryBackgroundChange: applyLibraryBackground,
    onFiles: importFiles,
    onFrameSettingsChange: updateSelectedFrame,
    onIncludeBrandLogoChange: (include: boolean) => {
      setIncludeBrandLogo(include);
      if (!include && selectedSourceId === 'brand-logo') {
        setSelectedSourceId(null);
        setBackgroundEditScope('sequence');
      }
      seek(0);
    },
    onModeChange: changeMode,
    onMoveSource: moveSource,
    onRemoveImage: removeImage,
    onResetFrame: resetSelectedFrame,
    onResetSelectedBackgroundOverride: resetSelectedBackgroundOverride,
    onSelectedEffectTargetChange: setSelectedEffectTarget,
    onSelectSource: (id: string) => {
      setSelectedSourceId(id);
      setSelectedEffectTarget('content');
      changePlaying(false);
      const index = sources.findIndex((source) => source.id === id);
      seek(Math.max(0, index) * (settings.holdMs + settings.transitionMs));
    },
    onSettingsChange: updateSettings,
    onTextFramesChange: setTextFrames,
    selectedSource,
    selectedEffectTarget,
    sequenceBackground,
    settings,
    sources,
    textFrames,
  };

  function renderWorkspace() {
    return (
      <div
      className={
        embedded
          ? `animation-studio h-full min-h-0 bg-background text-foreground${compactControls ? ' animation-studio-compact-controls' : ''}`
          : 'studio-grid min-h-dvh bg-background text-foreground'
      }
      ref={workspaceRef}
    >
      <StudioToolHeader
        actions={(
          <>
          <DesignVersionControls
            autosaveState={autosaveState}
            identityId={identityId}
            onOpen={(source) => void applyStudioSource(source)}
            revision={String(animationDocument.revision)}
            source={() => animationSource}
            toolId='animation'
            workspaceLabel='Animation Studio'
          />
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
            className='px-4'
            disabled={exportProgress !== null}
            onClick={handleExport}
            type='button'
          >
            <Download aria-hidden='true' />
            <T>Export GIF</T>
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
            <div className='flex items-center justify-between gap-4 border-b border-border bg-background px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground'>
              <span>
                <T>Canvas</T> / {settings.width}×{settings.height}
              </span>
              <span>
                {settings.packageId} / cubic-bezier({settings.bezier.join(', ')})
              </span>
            </div>

            <CanvasViewport
              autoFit={compactControls}
              className='min-h-[420px] flex-1'
              draftKey={compactControls ? 'compact-canvas-fit-v1' : 'canvas-zoom'}
              identityId={identityId}
              maxZoom={compactControls ? 100 : 200}
              onDeselect={() => {
                setSelectedSourceId(null);
                setBackgroundEditScope('sequence');
              }}
              stageClassName='studio-stage flex min-h-full items-center justify-center p-8'
              toolId='animation'
            >
              <div
                className='relative w-full max-w-5xl bg-black smooth-shadow-ring-xl smooth-ring-foreground/20'
                onPointerDown={() => {
                  setSelectedSourceId(null);
                  setBackgroundEditScope('sequence');
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
                    onDeselect={() => setSelectedSourceId(null)}
                    onSelect={() => setSelectedSourceId(selectedSource.id)}
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
            currentMsRef={playheadRef}
            fps={settings.fps}
            holdMs={settings.holdMs}
            isPlaying={isPlaying}
            labels={labels}
            onPlayChange={changePlaying}
            onRateChange={(rate) => {
              playbackRateRef.current = rate;
              setPlaybackRate(rate);
            }}
            onSeek={seek}
            playbackRate={playbackRate}
            totalMs={totalMs}
            transitionMs={settings.transitionMs}
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
