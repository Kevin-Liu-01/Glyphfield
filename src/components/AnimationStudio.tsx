'use client';

import { useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import { Download, RotateCcw } from 'lucide-react';

import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import LiveMaterialCanvas from '@/components/LiveMaterialCanvas';
import StudioControls from '@/components/StudioControls';
import TimelinePanel from '@/components/TimelinePanel';
import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { cycleDurationMs, resolveTimeline } from '@/lib/animation';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { exportGif } from '@/lib/exportGif';
import { renderFrame, type StudioSource } from '@/lib/renderFrame';
import {
  applyFrameSettings,
  createDefaultFrameSettings,
  DEFAULT_SETTINGS,
  DEFAULT_TEXT_FRAMES,
  orderStudioSources,
  type ImportedImage,
  type SourceMode,
  type StudioFrameSettings,
  type StudioSettings,
} from '@/lib/studio';

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
  embedded = false,
  identity,
}: {
  embedded?: boolean;
  identity?: BrandIdentity;
}) {
  const gt = useGT();
  const identitySettings = {
    ...DEFAULT_SETTINGS,
    background: identity?.colors.find(({ id }) => id === 'ink')?.hex ?? DEFAULT_SETTINGS.background,
    foreground: identity?.colors.find(({ id }) => id === 'paper')?.hex ?? DEFAULT_SETTINGS.foreground,
  };
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
  const settings: StudioSettings = {
    ...identitySettings,
    ...storedSettings,
    shaderSettings: {
      ...identitySettings.shaderSettings,
      ...storedSettings.shaderSettings,
    },
  };
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
  const [selectedSourceId, setSelectedSourceId] = useState('brand-logo');
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useStudioDraft(
    identityId,
    'animation',
    'playback-rate',
    1
  );
  const [playheadMs, setPlayheadMs] = useState(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [lastExport, setLastExport] = useState<{ size: number; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shaderLayerRefs = useRef(new Map<string, HTMLDivElement>());

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
  const sources = useMemo(
    () =>
      orderStudioSources(baseSources, sequenceOrder).map((source) =>
        applyFrameSettings(
          source,
          frameSettings[source.id] ?? createDefaultFrameSettings(settings)
        )
      ),
    [baseSources, frameSettings, sequenceOrder, settings]
  );
  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? sources[0] ?? null;
  const selectedFrameSettings = selectedSource
    ? frameSettings[selectedSource.id] ?? createDefaultFrameSettings(settings)
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
  const lastExportRef = useRef(lastExport);
  settingsRef.current = settings;
  sourcesRef.current = sources;
  imagesRef.current = images;
  isPlayingRef.current = isPlaying;
  playbackRateRef.current = playbackRate;
  lastExportRef.current = lastExport;

  useMountEffect(() => {
    if (qualityDefaultsMigrated) return;
    setStoredSettings((current) => ({
      ...current,
      colors: current.colors <= 64 ? 256 : current.colors,
    }));
    setQualityDefaultsMigrated(true);
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
      const wrapper = shaderLayerRefs.current.get(source.id);
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
      if (canvas) {
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

      if (timestamp - previousUiTimestamp >= 40) {
        previousUiTimestamp = timestamp;
        setPlayheadMs(playheadRef.current);
      }
      animationFrame = requestAnimationFrame(tick);
    }

    animationFrame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrame);
      for (const image of imagesRef.current) URL.revokeObjectURL(image.url);
      if (lastExportRef.current) URL.revokeObjectURL(lastExportRef.current.url);
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
      if (imported[0]) setSelectedSourceId(imported[0].id);
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

  function updateSelectedBackground(
    patch: Partial<StudioFrameSettings['background']>
  ) {
    if (!selectedFrameSettings) return;
    updateSelectedFrame({
      background: {
        ...selectedFrameSettings.background,
        ...patch,
        materialSettings: patch.materialSettings
          ?? selectedFrameSettings.background.materialSettings
          ?? settings.shaderSettings,
      },
    });
  }

  function resetSelectedFrame() {
    if (!selectedSource) return;
    setFrameSettings((current) => {
      const next = { ...current };
      delete next[selectedSource.id];
      return next;
    });
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
      const url = URL.createObjectURL(blob);
      if (lastExportRef.current) URL.revokeObjectURL(lastExportRef.current.url);
      const completedExport = { size: blob.size, url };
      lastExportRef.current = completedExport;
      setLastExport(completedExport);
      const anchor = document.createElement('a');
      anchor.download = `studio-${settings.packageId}.gif`;
      anchor.href = url;
      anchor.click();
    } catch {
      setError(gt('The GIF could not be encoded. Try a smaller canvas or lower frame rate.'));
    } finally {
      setExportProgress(null);
    }
  }

  function resetStudio() {
    setStoredSettings(identitySettings);
    setTextFrames(identityTextFrames);
    setMode('sequence');
    setIncludeBrandLogo(Boolean(identity));
    setSequenceOrder([]);
    setFrameSettings({});
    setSelectedSourceId('brand-logo');
    setError(null);
    setPlaybackRate(1);
    if (lastExportRef.current) URL.revokeObjectURL(lastExportRef.current.url);
    lastExportRef.current = null;
    setLastExport(null);
    changePlaying(true);
    seek(0);
  }

  return (
    <div
      className={
        embedded
          ? 'animation-studio h-full min-h-0 bg-background text-foreground'
          : 'studio-grid min-h-dvh bg-background text-foreground'
      }
    >
      <header
        className={`app-navbar ${embedded ? 'animation-toolbar' : 'studio-header'} border-b border-border bg-background/95`}
      >
        <div className='flex min-w-0 items-center gap-4 border-r border-border px-5 py-3'>
          {embedded ? null : (
            <div className='grid size-9 shrink-0 place-items-center bg-foreground font-mono text-xs font-bold text-background'>
              ST
            </div>
          )}
          <div className='min-w-0'>
            <h1 className='truncate text-lg font-semibold tracking-tight'>
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
          {lastExport ? (
            <Button asChild className='hidden font-mono text-xs xl:inline-flex' variant='outline'>
              <a download={`studio-${settings.packageId}.gif`} href={lastExport.url}>
                <T>GIF ready</T> · {Math.max(1, Math.round(lastExport.size / 1024))} KB
              </a>
            </Button>
          ) : null}
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

      <div className={embedded ? 'animation-body' : 'studio-body'}>
        <StudioControls
          brandLogoAvailable={Boolean(brandLogo)}
          frameSettings={selectedFrameSettings}
          hasImageSources={sources.some((source) => source.kind === 'image')}
          images={images}
          includeBrandLogo={includeBrandLogo}
          mode={mode}
          onBackgroundChange={updateSelectedBackground}
          onFiles={importFiles}
          onFrameSettingsChange={updateSelectedFrame}
          onIncludeBrandLogoChange={(include) => {
            setIncludeBrandLogo(include);
            if (include) {
              setSelectedSourceId('brand-logo');
              changePlaying(false);
            }
            seek(0);
          }}
          onModeChange={changeMode}
          onMoveSource={moveSource}
          onRemoveImage={removeImage}
          onResetFrame={resetSelectedFrame}
          onSelectSource={(id) => {
            setSelectedSourceId(id);
            changePlaying(false);
            const index = sources.findIndex((source) => source.id === id);
            seek(Math.max(0, index) * (settings.holdMs + settings.transitionMs));
          }}
          onSettingsChange={updateSettings}
          onTextFramesChange={setTextFrames}
          selectedSource={selectedSource}
          settings={settings}
          sources={sources}
          textFrames={textFrames}
        />

        <section className='flex min-w-0 flex-col bg-background'>
          <div className='flex min-h-0 flex-1 flex-col'>
            <div className='flex items-center justify-between gap-4 border-b border-border bg-background px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground'>
              <span>
                <T>Canvas</T> / {settings.width}×{settings.height}
              </span>
              <span>
                {settings.packageId} / cubic-bezier({settings.bezier.join(', ')})
              </span>
            </div>

            <div className='studio-stage flex min-h-[420px] flex-1 items-center justify-center overflow-auto p-8'>
              <div
                className='relative w-full max-w-5xl border border-foreground/20 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.12)]'
                style={{ aspectRatio: `${Math.max(120, settings.width)} / ${Math.max(120, settings.height)}` }}
              >
                {sources.map((source) =>
                  source.background?.style === 'shader' ? (
                    <div
                      aria-hidden='true'
                      className='pointer-events-none absolute inset-0 opacity-0'
                      key={`${source.id}-${source.background.materialId}`}
                      ref={(element) => {
                        if (element) shaderLayerRefs.current.set(source.id, element);
                        else shaderLayerRefs.current.delete(source.id);
                      }}
                    >
                      <LiveMaterialCanvas
                        materialId={source.background.materialId}
                        paused={!isPlaying && exportProgress === null}
                        settings={{
                          ...settings.shaderSettings,
                          ...source.background.materialSettings,
                          colorA: source.background.colorA,
                          colorB: source.background.colorB,
                          colorC: source.background.colorC,
                        }}
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
              </div>
            </div>

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
      </div>
    </div>
  );
}
