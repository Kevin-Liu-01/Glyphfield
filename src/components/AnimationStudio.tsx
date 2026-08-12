'use client';

import NextImage from 'next/image';
import { useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import { Download, RotateCcw } from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasDimensionHandles from '@/components/CanvasDimensionHandles';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import StudioControls from '@/components/StudioControls';
import TimelinePanel from '@/components/TimelinePanel';
import { Button } from '@/components/ui/Button';
import { useCanvasSelectionDismiss } from '@/hooks/useCanvasSelectionDismiss';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  cycleDurationMs,
  resolveTimeline,
} from '@/lib/animation';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { exportGif } from '@/lib/exportGif';
import { renderFrame, type StudioSource } from '@/lib/renderFrame';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceString,
  sourceStringArray,
  stringifySource,
} from '@/lib/sourceCode';
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
import { PRODUCT_BRAND } from '@/lib/productBrand';

async function loadImportedImage(file: File): Promise<ImportedImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return {
      height: image.naturalHeight,
      id: crypto.randomUUID(),
      image,
      name: file.name,
      url,
      width: image.naturalWidth,
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
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
    width: image.naturalWidth,
  };
}

export default function AnimationStudio({
  compactControls = false,
  embedded = false,
  identity,
  initialSequenceBackground,
}: {
  compactControls?: boolean;
  embedded?: boolean;
  identity?: BrandIdentity;
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
  const [storedSettings, setStoredSettings] = useStudioDraft<StudioSettings>(
    identityId,
    'animation',
    'settings',
    identitySettings
  );
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
  const [playheadMs, setPlayheadMs] = useState(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasSelectionRef = useRef<HTMLDivElement>(null);
  const sequenceShaderLayerRef = useRef<HTMLDivElement>(null);
  const shaderLayerRefs = useRef(new Map<string, HTMLDivElement>());
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
  const sources = useMemo(
    () =>
      orderStudioSources(baseSources, sequenceOrder).map((source) =>
        applyFrameSettings(source, resolvedFrameSettings[source.id] ?? createDefaultFrameSettings(settings))
      ),
    [baseSources, resolvedFrameSettings, sequenceOrder, settings]
  );
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
  const visiblePlayhead = totalMs === 0 ? 0 : Math.min(playheadMs, totalMs);
  const visibleTimeline = resolveTimeline(visiblePlayhead, {
    holdMs: settings.holdMs,
    itemCount: Math.max(1, sources.length),
    transitionMs: settings.transitionMs,
  });
  const activeShaderSourceIds = new Set([
    sources[visibleTimeline.index]?.id,
    sources[visibleTimeline.nextIndex]?.id,
  ]);
  const hasSequenceShaderSources = sequenceBackground.style === 'shader'
    && sources.some((source) => !backgroundOverrides[source.id]);
  const sequenceShaderIsActive = hasSequenceShaderSources
    && sources.some((source) => (
      activeShaderSourceIds.has(source.id) && !backgroundOverrides[source.id]
    ));
  const sequenceShaderSettings = useMemo(() => ({
    ...settings.shaderSettings,
    ...sequenceBackground.materialSettings,
    colorA: sequenceBackground.colorA,
    colorB: sequenceBackground.colorB,
    colorC: sequenceBackground.colorC,
  }), [sequenceBackground, settings.shaderSettings]);
  const overrideShaderSettings = useMemo(() => new Map(
    sources
      .filter((source) => (
        backgroundOverrides[source.id] && source.background?.style === 'shader'
      ))
      .map((source) => [source.id, {
        ...settings.shaderSettings,
        ...source.background?.materialSettings,
        colorA: source.background?.colorA ?? settings.shaderSettings.colorA,
        colorB: source.background?.colorB ?? settings.shaderSettings.colorB,
        colorC: source.background?.colorC ?? settings.shaderSettings.colorC,
      }])
  ), [backgroundOverrides, settings.shaderSettings, sources]);
  const canvasWidth = Math.max(120, settings.width);
  const canvasHeight = Math.max(120, settings.height);
  const selectedBounds = selectedSource?.kind === 'text'
    ? {
        height: Math.min(canvasHeight * 0.72, (selectedFrameSettings?.fontSize ?? settings.fontSize) * 1.45),
        width: Math.min(canvasWidth * 0.88, Math.max(96, Array.from(selectedSource.text).length * (selectedFrameSettings?.fontSize ?? settings.fontSize) * 0.62)),
      }
    : selectedSource
      ? (() => {
          const ratio = selectedSource.width / Math.max(1, selectedSource.height);
          const maxWidth = canvasWidth * 0.68;
          const maxHeight = canvasHeight * 0.68;
          const width = Math.min(maxWidth, maxHeight * ratio);
          return { height: width / ratio, width };
        })()
      : { height: 80, width: 160 };

  const settingsRef = useRef(settings);
  const sourcesRef = useRef(sources);
  const imagesRef = useRef(images);
  const isPlayingRef = useRef(isPlaying);
  const playbackRateRef = useRef(playbackRate);
  const playheadRef = useRef(playheadMs);
  const backgroundOverridesRef = useRef(backgroundOverrides);
  settingsRef.current = settings;
  sourcesRef.current = sources;
  imagesRef.current = images;
  isPlayingRef.current = isPlaying;
  playbackRateRef.current = playbackRate;
  backgroundOverridesRef.current = backgroundOverrides;

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
        Object.entries(savedFrames)
          .filter(([, frame]) => JSON.stringify(frame.background) !== defaultFingerprint)
          .map(([id]) => [id, true])
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
    let previousUiTimestamp = 0;

    function tick(timestamp: number) {
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
        const next = playheadRef.current + elapsed * playbackRateRef.current;
        if (currentSettings.loop) {
          playheadRef.current = next % duration;
        } else if (next >= duration) {
          playheadRef.current = duration;
          isPlayingRef.current = false;
          setIsPlaying(false);
        } else {
          playheadRef.current = next;
        }
      }

      const canvas = canvasRef.current;
      const previewFrameInterval = isPlayingRef.current
        ? 1000 / Math.max(1, Math.min(30, currentSettings.fps))
        : 120;
      const shouldRender = document.visibilityState !== 'hidden'
        && timestamp - previousRenderTimestamp >= previewFrameInterval;
      if (canvas && shouldRender) {
        previousRenderTimestamp = timestamp;
        const width = Math.max(120, currentSettings.width);
        const height = Math.max(120, currentSettings.height);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        const context = canvas.getContext('2d');
        if (context) {
          const position = resolveTimeline(playheadRef.current, {
            holdMs: currentSettings.holdMs,
            itemCount: Math.max(1, currentSources.length),
            transitionMs: currentSettings.transitionMs,
          });
          renderFrame(
            context,
            attachShaderLayers(currentSources),
            { ...currentSettings, width, height },
            position
          );
        }
      }

      const uiFrameInterval = 1000 / Math.max(1, Math.min(20, currentSettings.fps));
      if (timestamp - previousUiTimestamp >= uiFrameInterval) {
        previousUiTimestamp = timestamp;
        setPlayheadMs(playheadRef.current);
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
      const imported = await Promise.all(
        Array.from(files)
          .filter((file) => file.type.startsWith('image/'))
          .map(loadImportedImage)
      );
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
    changePlaying(false);
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
    setPlayheadMs(next);
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

  async function handleExport() {
    if (sources.length === 0) {
      setError(gt('Add at least one frame before exporting.'));
      return;
    }

    setError(null);
    setExportProgress(0);
    changePlaying(false);
    try {
      const blob = await exportGif({
        config: settings,
        onProgress: setExportProgress,
        sources: attachShaderLayers(sources),
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
      setExportProgress(null);
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

  function applyStudioSource(source: string) {
    const parsed = parseSourceObject(source);
    const nextMode = sourceString(parsed, 'mode', mode);
    if (!['sequence', 'text', 'images'].includes(nextMode)) {
      throw new TypeError('Mode must be sequence, text, or images.');
    }
    const nextSettings = sourceObject(parsed, 'settings');
    const nextFrameSettings = sourceObject(parsed, 'frameSettings');
    const nextSequenceBackground = sourceObject(parsed, 'sequenceBackground');
    const nextBackgroundOverrides = sourceObject(parsed, 'backgroundOverrides');
    const nextPlaybackRate = sourceNumber(parsed, 'playbackRate', playbackRate);
    if (nextPlaybackRate <= 0 || nextPlaybackRate > 4) {
      throw new RangeError('Playback rate must be greater than 0 and no more than 4.');
    }

    setMode(nextMode as SourceMode);
    setTextFrames(sourceString(parsed, 'textFrames', textFrames));
    setIncludeBrandLogo(sourceBoolean(parsed, 'includeBrandLogo', includeBrandLogo));
    setSequenceOrder(sourceStringArray(parsed, 'sequenceOrder', sequenceOrder));
    if (nextSettings) setStoredSettings(nextSettings as StudioSettings);
    if (nextFrameSettings) {
      setFrameSettings(nextFrameSettings as Record<string, StudioFrameSettings>);
    }
    if (nextSequenceBackground) {
      setStoredSequenceBackground(nextSequenceBackground as StudioBackgroundSettings);
    }
    if (nextBackgroundOverrides) {
      setBackgroundOverrides(nextBackgroundOverrides as Record<string, boolean>);
    }
    setPlaybackRate(nextPlaybackRate);
    setSelectedSourceId(null);
    setBackgroundEditScope('sequence');
    seek(0);
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

  return (
    <div
      className={
        embedded
          ? `animation-studio h-full min-h-0 bg-background text-foreground${compactControls ? ' animation-studio-compact-controls' : ''}`
          : 'studio-grid min-h-dvh bg-background text-foreground'
      }
    >
      <header
        className={`app-navbar ${embedded ? 'animation-toolbar' : 'studio-header'} border-b border-border bg-background/95`}
      >
        <div className={`flex min-w-0 items-center border-r border-border ${compactControls ? 'gap-2 px-3 py-2' : 'gap-4 px-5 py-3'}`}>
          {embedded ? null : (
            <div className='grid size-9 shrink-0 place-items-center bg-foreground font-mono text-xs font-bold text-background'>
              ST
            </div>
          )}
          {embedded && compactControls ? (
            <NextImage
              alt=''
              aria-hidden='true'
              className='size-5 shrink-0 object-contain'
              height={20}
              src={PRODUCT_BRAND.markWhitePath}
              width={20}
            />
          ) : null}
          <div className='min-w-0'>
            <h1 className={`truncate font-semibold tracking-tight ${compactControls ? 'text-sm' : 'text-lg'}`}>
              <T>Animation</T>
            </h1>
            {embedded ? null : (
              <p className='truncate font-mono text-xs uppercase tracking-widest text-muted-foreground'>
                <T>Studio / Motion</T>
              </p>
            )}
          </div>
        </div>

        {embedded ? null : (
          <div className='hidden min-w-0 items-center border-r border-border px-5 lg:flex'>
            <p className='max-w-xl text-sm leading-5 text-muted-foreground'>
              <T>
                Import frames, tune one deterministic playhead, and export a production-ready GIF without uploading anything.
              </T>
            </p>
          </div>
        )}

        <div className='flex items-center justify-end gap-2 px-4'>
          <SourceCodeButton onClick={() => setSourceOpen(true)} />
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
            loading={exportProgress !== null}
            onClick={handleExport}
            type='button'
          >
            <Download aria-hidden='true' />
            {exportProgress === null ? (
              <T>Export GIF</T>
            ) : (
              `${Math.round(exportProgress * 100)}%`
            )}
          </Button>
        </div>
      </header>

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
                {hasSequenceShaderSources ? (
                  <div
                    aria-hidden='true'
                    className='pointer-events-none absolute inset-0 opacity-0'
                    data-animation-shader-active={sequenceShaderIsActive ? 'true' : 'false'}
                    data-animation-shader-layer='sequence'
                    ref={sequenceShaderLayerRef}
                  >
                    <LiveMaterialCanvas
                      enabled
                      frameRate={Math.max(1, Math.min(30, settings.fps))}
                      materialId={sequenceBackground.materialId}
                      patternScale={sequenceBackground.patternScale ?? 1}
                      paused={exportProgress === null && (!isPlaying || !sequenceShaderIsActive)}
                      settings={sequenceShaderSettings}
                    />
                  </div>
                ) : null}
                {sources.map((source) =>
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
                        enabled={exportProgress !== null || activeShaderSourceIds.has(source.id)}
                        frameRate={Math.max(1, Math.min(30, settings.fps))}
                        materialId={source.background.materialId}
                        patternScale={source.background.patternScale ?? 1}
                        paused={!isPlaying && exportProgress === null}
                        settings={overrideShaderSettings.get(source.id) ?? settings.shaderSettings}
                      />
                    </div>
                  ) : null
                )}
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

            {error ? (
              <div className='border-t border-status-error-border bg-status-error-background px-4 py-3 text-sm text-status-error' role='alert'>
                {error}
              </div>
            ) : null}
          </div>

          <TimelinePanel
            currentMs={visiblePlayhead}
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
      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · animation scene'
          onApply={applyStudioSource}
          onClose={() => setSourceOpen(false)}
          source={stringifySource({
            backgroundOverrides,
            frameSettings,
            includeBrandLogo,
            mode,
            playbackRate,
            sequenceOrder,
            sequenceBackground,
            settings,
            textFrames,
          })}
          title={gt('Animation source')}
        />
      ) : null}
    </div>
  );
}
