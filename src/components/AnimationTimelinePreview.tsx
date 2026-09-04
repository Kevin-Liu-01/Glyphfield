'use client';

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { resolveTimeline } from '@/lib/animation';
import type { LiveMaterialId } from '@/lib/liveMaterials';
import { renderFrame, type StudioSource } from '@/lib/renderFrame';
import { shaderPreviewAssetPath } from '@/lib/shaderLab';
import { requestShaderPreviewSlot } from '@/lib/shaderPreviewBudget';
import type { StudioSettings } from '@/lib/studio';

const MAX_STATIC_SHADER_EDGE = 400;
const shaderPreviewImages = new Map<LiveMaterialId, HTMLImageElement>();
const shaderPreviewRequests = new Map<LiveMaterialId, Promise<HTMLImageElement>>();
const capturedAnimationShaderPreviews = new Map<string, string>();

function requestShaderPreviewImage(materialId: LiveMaterialId): Promise<HTMLImageElement> {
  const cached = shaderPreviewImages.get(materialId);
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  const pending = shaderPreviewRequests.get(materialId);
  if (pending) return pending;
  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      shaderPreviewImages.set(materialId, image);
      shaderPreviewRequests.delete(materialId);
      resolve(image);
    };
    image.onerror = () => {
      shaderPreviewRequests.delete(materialId);
      reject(new Error(`Unable to load the ${materialId} shader preview.`));
    };
    image.src = shaderPreviewAssetPath(materialId);
  });
  shaderPreviewRequests.set(materialId, request);
  return request;
}

function shaderBackgroundSignature(sources: readonly StudioSource[]): string {
  return JSON.stringify(sources.map((source) => {
    const background = source.background;
    if (background?.style !== 'shader') return null;
    return {
      colorA: background.colorA,
      colorB: background.colorB,
      colorC: background.colorC,
      materialId: background.materialId,
      materialSettings: background.materialSettings,
      opacity: background.opacity,
      patternScale: background.patternScale,
    };
  }));
}

function freezeShaderBackgrounds(
  sources: readonly StudioSource[],
  cache: Map<string, HTMLCanvasElement>
): readonly StudioSource[] {
  return sources.map((source) => {
    const background = source.background;
    const image = background?.image;
    if (background?.style !== 'shader') return source;
    if (!image) {
      const preview = shaderPreviewImages.get(background.materialId);
      return preview ? { ...source, background: { ...background, image: preview } } : source;
    }
    if (!(image instanceof HTMLCanvasElement)) return source;
    const key = JSON.stringify({
      colorA: background.colorA,
      colorB: background.colorB,
      colorC: background.colorC,
      materialId: background.materialId,
      materialSettings: background.materialSettings,
      opacity: background.opacity,
      patternScale: background.patternScale,
    });
    let snapshot = cache.get(key);
    if (!snapshot && image.width > 0 && image.height > 0) {
      const scale = Math.min(1, MAX_STATIC_SHADER_EDGE / image.width, MAX_STATIC_SHADER_EDGE / image.height);
      snapshot = document.createElement('canvas');
      snapshot.width = Math.max(1, Math.round(image.width * scale));
      snapshot.height = Math.max(1, Math.round(image.height * scale));
      snapshot.getContext('2d')?.drawImage(image, 0, 0, snapshot.width, snapshot.height);
      cache.set(key, snapshot);
    }
    if (!snapshot) return source;
    return { ...source, background: { ...background, image: snapshot } };
  });
}

function StaticAnimationShaderPreview({
  captureKey,
  materialId,
  patternScale,
  settings,
}: {
  captureKey: string;
  materialId: LiveMaterialId;
  patternScale: number;
  settings: StudioSettings['shaderSettings'];
}) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState(() => capturedAnimationShaderPreviews.get(captureKey));
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (preview) return;
    let released = false;
    const releaseSlot = requestShaderPreviewSlot(() => {
      if (!released) setRendering(true);
    });
    return () => {
      released = true;
      releaseSlot();
    };
  }, [preview]);

  useEffect(() => {
    if (!rendering || preview) return;
    let disposed = false;
    let attempts = 0;
    let timer = 0;
    const capture = () => {
      if (disposed) return;
      const canvas = hostRef.current?.querySelector('canvas');
      if (canvas?.width && canvas.height) {
        try {
          const dataUrl = canvas.toDataURL('image/webp', 0.86);
          capturedAnimationShaderPreviews.set(captureKey, dataUrl);
          setPreview(dataUrl);
          setRendering(false);
          return;
        } catch {
          // The deterministic material thumbnail remains visible if capture is unavailable.
        }
      }
      attempts += 1;
      if (attempts < 14) timer = window.setTimeout(capture, 90);
      else {
        setPreview(shaderPreviewAssetPath(materialId));
        setRendering(false);
      }
    };
    timer = window.setTimeout(capture, 180);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [captureKey, materialId, preview, rendering]);

  return (
    <span
      aria-hidden='true'
      className='animation-timeline-preview-shader'
      ref={hostRef}
      style={!preview && !rendering
        ? { backgroundImage: `url("${shaderPreviewAssetPath(materialId)}")` }
        : undefined}
    >
      {preview ? (
        <span
          className='animation-timeline-preview-shader-image'
          style={{ backgroundImage: `url("${preview}")` }}
        />
      ) : rendering ? (
        <LazyLiveMaterialCanvas
          activeWhileMounted
          captureTimeMs={1_600}
          frameRate={1}
          materialId={materialId}
          maxPixelCount={100_000}
          patternScale={patternScale}
          paused
          renderScale={0.65}
          settings={settings}
        />
      ) : null}
    </span>
  );
}

type AnimationTimelinePreviewProps = {
  authenticShader?: boolean;
  index: number;
  kind: 'frame' | 'transition';
  layout?: 'timeline' | 'tooltip';
  settings: StudioSettings;
  sources: readonly StudioSource[];
};

function AnimationTimelinePreview({
  authenticShader = false,
  index,
  kind,
  layout = 'timeline',
  settings,
  sources,
}: AnimationTimelinePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shaderSnapshotsRef = useRef(new Map<string, HTMLCanvasElement>());
  const shaderSignatureRef = useRef('');
  const selectedBackground = sources[index % Math.max(1, sources.length)]?.background;
  const showAuthenticShader = authenticShader && selectedBackground?.style === 'shader';
  const selectedShaderSettings = useMemo(() => (
    selectedBackground?.style === 'shader'
      ? {
        ...settings.shaderSettings,
        ...selectedBackground.materialSettings,
        colorA: selectedBackground.colorA,
        colorB: selectedBackground.colorB,
        colorC: selectedBackground.colorC,
      }
      : settings.shaderSettings
  ), [selectedBackground, settings.shaderSettings]);
  const selectedShaderCaptureKey = useMemo(() => JSON.stringify({
    materialId: selectedBackground?.style === 'shader' ? selectedBackground.materialId : null,
    patternScale: selectedBackground?.style === 'shader' ? selectedBackground.patternScale : null,
    settings: selectedShaderSettings,
  }), [selectedBackground, selectedShaderSettings]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sources.length === 0) return;
    let disposed = false;
    let activated = layout === 'tooltip';
    const logicalWidth = Math.max(120, settings.width);
    const logicalHeight = Math.max(120, settings.height);
    const currentSource = sources[index % sources.length];
    const nextSource = sources[(index + 1) % sources.length];
    const previewSources = kind === 'transition' && nextSource
      ? [currentSource, nextSource]
      : [currentSource];
    const shaderSignature = shaderBackgroundSignature(previewSources);
    if (shaderSignatureRef.current !== shaderSignature) {
      shaderSnapshotsRef.current.clear();
      shaderSignatureRef.current = shaderSignature;
    }
    const tooltipLayout = layout === 'tooltip';
    const fallbackWidth = tooltipLayout ? 300 : kind === 'frame' ? 220 : 84;
    const fallbackHeight = tooltipLayout
      ? Math.max(1, Math.round(fallbackWidth * logicalHeight / logicalWidth))
      : 80;
    const drawPreview = () => {
      const staticSources = freezeShaderBackgrounds(previewSources, shaderSnapshotsRef.current);
      const previewWidth = Math.max(1, Math.round(canvas.clientWidth || fallbackWidth));
      const previewHeight = Math.max(1, Math.round(canvas.clientHeight || fallbackHeight));
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      const renderWidth = Math.round(previewWidth * pixelRatio);
      const renderHeight = Math.round(previewHeight * pixelRatio);
      if (canvas.width !== renderWidth) canvas.width = renderWidth;
      if (canvas.height !== renderHeight) canvas.height = renderHeight;
      const context = canvas.getContext('2d');
      if (!context) return;
      const timeMs = kind === 'transition'
        ? settings.holdMs + settings.transitionMs / 2
        : Math.max(0, Math.min(settings.holdMs / 2, settings.holdMs - 1));
      const scale = Math.min(canvas.width / logicalWidth, canvas.height / logicalHeight);
      const offsetX = (canvas.width - logicalWidth * scale) / 2;
      const offsetY = (canvas.height - logicalHeight * scale) / 2;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!showAuthenticShader) {
        context.fillStyle = '#0b0b0b';
        context.fillRect(0, 0, canvas.width, canvas.height);
      }
      context.save();
      context.translate(offsetX, offsetY);
      context.scale(scale, scale);
      renderFrame(
        context,
        staticSources,
        { ...settings, height: logicalHeight, width: logicalWidth },
        resolveTimeline(timeMs, {
          holdMs: settings.holdMs,
          itemCount: staticSources.length,
          transitionMs: settings.transitionMs,
        }),
        { omitBackground: showAuthenticShader }
      );
      context.restore();
    };
    const activate = () => {
      if (disposed) return;
      activated = true;
      drawPreview();
      const materialIds = new Set(previewSources.flatMap((source) => (
        source.background?.style === 'shader' && !source.background.image
          ? [source.background.materialId]
          : []
      )));
      materialIds.forEach((materialId) => {
        void requestShaderPreviewImage(materialId).then(() => {
          if (!disposed) drawPreview();
        }).catch(() => {
          // The authored color fallback remains visible when a preview asset cannot load.
        });
      });
    };
    let intersectionObserver: IntersectionObserver | null = null;
    if (activated || typeof IntersectionObserver === 'undefined') {
      activate();
    } else {
      intersectionObserver = new IntersectionObserver(([entry]) => {
        if (!entry?.isIntersecting) return;
        intersectionObserver?.disconnect();
        intersectionObserver = null;
        activate();
      }, { rootMargin: '160px' });
      intersectionObserver.observe(canvas);
    }
    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => {
        if (activated) drawPreview();
      });
    resizeObserver?.observe(canvas);
    return () => {
      disposed = true;
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, [index, kind, layout, settings, showAuthenticShader, sources]);

  return (
    <>
      {showAuthenticShader ? (
        <StaticAnimationShaderPreview
          captureKey={selectedShaderCaptureKey}
          key={selectedShaderCaptureKey}
          materialId={selectedBackground.materialId}
          patternScale={selectedBackground.patternScale ?? 1}
          settings={selectedShaderSettings}
        />
      ) : null}
      <canvas
        aria-hidden='true'
        className='animation-timeline-preview-canvas'
        data-preview-layout={layout}
        data-transparent-background={showAuthenticShader ? 'true' : undefined}
        ref={canvasRef}
      />
    </>
  );
}

function previewSettingsMatch(first: StudioSettings, second: StudioSettings): boolean {
  return first.alignX === second.alignX
    && first.alignY === second.alignY
    && first.background === second.background
    && first.backgroundAngle === second.backgroundAngle
    && first.backgroundSecondary === second.backgroundSecondary
    && first.backgroundStyle === second.backgroundStyle
    && first.backgroundTransition === second.backgroundTransition
    && first.bezier === second.bezier
    && first.blur === second.blur
    && first.fit === second.fit
    && first.fontSize === second.fontSize
    && first.fontWeight === second.fontWeight
    && first.foreground === second.foreground
    && first.height === second.height
    && first.packageId === second.packageId
    && first.scale === second.scale
    && first.shaderSettings === second.shaderSettings
    && first.width === second.width;
}

export default memo(AnimationTimelinePreview, (first, second) => (
  first.authenticShader === second.authenticShader
  && first.index === second.index
  && first.kind === second.kind
  && first.layout === second.layout
  && first.sources === second.sources
  && previewSettingsMatch(first.settings, second.settings)
));
