'use client';

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import LazyLiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import { useAncestorWorkspaceActivity } from '@/hooks/useAncestorWorkspaceActivity';
import { useViewportActivity } from '@/hooks/useViewportActivity';
import { resolveTimeline } from '@/lib/animation';
import type { LiveMaterialId } from '@/lib/liveMaterials';
import { readLiveMaterialPresentation } from '@/lib/liveMaterialPreview';
import { renderFrame, type StudioSource } from '@/lib/renderFrame';
import { drawShaderFramePresentation, preloadShaderFramePresentation, type ShaderFramePresentation } from '@/lib/shaderFramePresentation';
import { shaderPreviewAssetPath } from '@/lib/shaderLab';
import { requestShaderPreviewSlot } from '@/lib/shaderPreviewBudget';
import type { StudioSettings } from '@/lib/studio';

const MAX_STATIC_SHADER_EDGE = 400;
const shaderPreviewImages = new Map<LiveMaterialId, HTMLImageElement>();
const shaderPreviewRequests = new Map<LiveMaterialId, Promise<HTMLImageElement>>();
const capturedAnimationShaderPreviews = new Map<string, string>();
const MAX_CAPTURED_SHADER_PREVIEWS = 32;
// One immutable current variant per native canvas. The weak owner lets closed
// workspaces release their buffers without retaining every edited appearance.
const frozenShaderPreviews = new WeakMap<HTMLCanvasElement, { key: string; canvas: HTMLCanvasElement }>();
const UNREADY_SHADER = '[data-live-material-ready="false"], [data-live-material-ready="error"]';

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

function snapshotShaderCanvas(image: HTMLCanvasElement, key: string): HTMLCanvasElement | undefined {
  if (image.width < 1 || image.height < 1 || image.closest(UNREADY_SHADER)) {
    frozenShaderPreviews.delete(image);
    return;
  }
  const cached = frozenShaderPreviews.get(image);
  if (cached?.key === key) return cached.canvas;
  frozenShaderPreviews.delete(image);
  const scale = Math.min(1, MAX_STATIC_SHADER_EDGE / image.width, MAX_STATIC_SHADER_EDGE / image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  if (!context) return;
  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
  } catch {
    // An unavailable native buffer must not poison every card's shared image.
    canvas.width = 0;
    canvas.height = 0;
    return;
  }
  frozenShaderPreviews.set(image, { key, canvas });
  return canvas;
}

function freezeShaderBackgrounds(sources: readonly StudioSource[]): readonly StudioSource[] {
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
      presentation: background.shaderPresentation,
      width: image.width,
      height: image.height,
    });
    const snapshot = snapshotShaderCanvas(image, key);
    // Keep the existing authored gradient while the real native buffer is
    // pending/failed. Never permanently freeze or repeatedly copy blank pixels.
    return { ...source, background: { ...background, image: snapshot } };
  });
}

function observeShaderPreviewSources(sources: readonly StudioSource[], redraw: () => void): MutationObserver | null {
  const roots = new Set<Element>();
  for (const source of sources) {
    const image = source.background?.image;
    if (source.background?.style !== 'shader' || !(image instanceof HTMLCanvasElement)) continue;
    roots.add(image.closest('[data-live-material-surface]') ?? image.closest(UNREADY_SHADER) ?? image);
  }
  if (!roots.size) return null;
  const observer = new MutationObserver(redraw);
  // The host may attach a native canvas before its first paint. Retry only on
  // native readiness/size changes, never on the shader's moving frame clock.
  roots.forEach((root) => observer.observe(root, {
    attributes: true, attributeFilter: ['data-live-material-ready', 'width', 'height'], subtree: true,
  }));
  return observer;
}

async function capturePresentedShaderPreview(
  canvas: HTMLCanvasElement,
  presentation: ShaderFramePresentation | undefined,
  isCurrent: () => boolean
): Promise<string | undefined> {
  await preloadShaderFramePresentation(presentation);
  if (!isCurrent()) return;
  const snapshot = document.createElement('canvas');
  snapshot.width = canvas.width;
  snapshot.height = canvas.height;
  try {
    const context = snapshot.getContext('2d');
    if (!context) throw new Error('The shader thumbnail canvas is unavailable.');
    // Paper grain and color filters live outside its native canvas. Resolve the
    // same isolated group used by export before replacing it with one bitmap.
    drawShaderFramePresentation(context, canvas, presentation, {
      x: 0, y: 0, width: snapshot.width, height: snapshot.height,
    });
    return snapshot.toDataURL('image/webp', 0.86);
  } finally {
    snapshot.width = 0;
    snapshot.height = 0;
  }
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
  const [workspaceActive, setWorkspaceActive] = useState(true);
  useAncestorWorkspaceActivity(hostRef, setWorkspaceActive);
  const visible = useViewportActivity(hostRef, { rootMargin: '80px' });
  const active = workspaceActive && visible;

  useEffect(() => {
    if (preview || !active) return;
    let released = false;
    const releaseSlot = requestShaderPreviewSlot(() => {
      if (!released) setRendering(true);
    });
    return () => {
      released = true;
      releaseSlot();
      setRendering(false);
    };
  }, [active, preview]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !active || !rendering || preview) return;
    let disposed = false;
    let capturing = false;
    let settled = false;
    let frame = 0;
    let registrationTimer = 0;
    const fallback = () => {
      if (disposed || settled) return;
      settled = true;
      setPreview(shaderPreviewAssetPath(materialId));
    };
    const capture = () => {
      frame = 0;
      window.clearTimeout(registrationTimer);
      registrationTimer = 0;
      if (disposed || settled || capturing) return;
      if (host.querySelector('[data-live-material-ready="error"]')) {
        fallback();
        return;
      }
      // Allocated buffers can be blank while provider textures compile/decode.
      if (host.querySelector('[data-live-material-ready="false"]')) return;
      const canvas = host.querySelector('canvas');
      if (canvas?.width && canvas.height) {
        const presentation = readLiveMaterialPresentation(host);
        if (!presentation && host.querySelector('.paper-shader-host')) {
          // The ready DOM commit can precede the provider's passive runtime
          // registration. Wait for its metadata; never cache unfiltered pixels.
          registrationTimer = window.setTimeout(schedule, 50);
          return;
        }
        capturing = true;
        const isCurrent = () => !disposed && !settled && host.contains(canvas)
          && !host.querySelector('[data-live-material-ready="false"], [data-live-material-ready="error"]');
        void capturePresentedShaderPreview(canvas, presentation, isCurrent).then((dataUrl) => {
          capturing = false;
          if (!dataUrl || !isCurrent()) return;
          if (!dataUrl.startsWith('data:image/')) { fallback(); return; }
          // Editing a color/size can create many distinct previews. Keep the
          // session cache bounded, without changing an already displayed image.
          while (capturedAnimationShaderPreviews.size >= MAX_CAPTURED_SHADER_PREVIEWS) {
            const oldest = capturedAnimationShaderPreviews.keys().next().value;
            if (oldest === undefined) break;
            capturedAnimationShaderPreviews.delete(oldest);
          }
          capturedAnimationShaderPreviews.set(captureKey, dataUrl);
          settled = true;
          setPreview(dataUrl);
        }).catch(fallback);
      }
    };
    function schedule() {
      if (!disposed && !settled && !frame && !capturing) frame = requestAnimationFrame(capture);
    }
    const observer = new MutationObserver(schedule);
    observer.observe(host, { attributes: true, attributeFilter: ['data-live-material-ready'], childList: true, subtree: true });
    const timer = window.setTimeout(fallback, 15_000);
    schedule();
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(registrationTimer);
      window.clearTimeout(timer);
    };
  }, [active, captureKey, materialId, preview, rendering]);

  return (
    <span
      aria-hidden='true'
      className='animation-timeline-preview-shader'
      ref={hostRef}
      style={!preview && !(active && rendering)
        ? { backgroundImage: `url("${shaderPreviewAssetPath(materialId)}")` }
        : undefined}
    >
      {preview ? (
        <span
          className='animation-timeline-preview-shader-image'
          style={{ backgroundImage: `url("${preview}")` }}
        />
      ) : active && rendering ? (
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
    const tooltipLayout = layout === 'tooltip';
    const fallbackWidth = tooltipLayout ? 300 : kind === 'frame' ? 220 : 84;
    const fallbackHeight = tooltipLayout
      ? Math.max(1, Math.round(fallbackWidth * logicalHeight / logicalWidth))
      : 80;
    const drawPreview = () => {
      const staticSources = freezeShaderBackgrounds(previewSources);
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
    let shaderObserver: MutationObserver | null = null;
    const activate = () => {
      if (disposed) return;
      activated = true;
      shaderObserver ??= observeShaderPreviewSources(previewSources, () => {
        if (!disposed) drawPreview();
      });
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
      shaderObserver?.disconnect();
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
