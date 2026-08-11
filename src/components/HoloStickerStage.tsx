'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';

import { GlyphfieldHoloStickerRenderer } from '@/lib/holoStickerRenderer';
import type { StickerFinishSettings } from '@/lib/surfaceSticker';
import { browserSupportsWebGL2, markWebGLContextUnavailable } from '@/lib/webglContext';

export type HoloStickerStageHandle = {
  exportPng: (size?: number) => Promise<Blob | null>;
};

type RenderState = 'checking' | 'fallback' | 'loading' | 'ready' | 'recovering';

function loadArtwork(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(url)) image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to load sticker artwork'));
    image.src = url;
  });
}

function fallbackArtwork(label: string) {
  const safe = label.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="540" viewBox="0 0 900 540"><rect width="900" height="540" rx="108" fill="#15171a"/><path d="M70 85h760v370H70z" fill="none" stroke="#fff" stroke-opacity=".09" stroke-width="2"/><text x="450" y="296" text-anchor="middle" fill="#fff" font-family="Arial,sans-serif" font-size="126" font-weight="700" letter-spacing="-6">${safe}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const HoloStickerStage = forwardRef<HoloStickerStageHandle, {
  artworkUrl?: string;
  fallbackSvg: string;
  finish: StickerFinishSettings;
  label: string;
}>(function HoloStickerStage({ artworkUrl, fallbackSvg, finish, label }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<GlyphfieldHoloStickerRenderer | null>(null);
  const finishRef = useRef(finish);
  const [renderState, setRenderState] = useState<RenderState>('checking');
  const [retry, setRetry] = useState(0);
  finishRef.current = finish;

  useImperativeHandle(ref, () => ({
    async exportPng(size = 2048) {
      return rendererRef.current?.exportPng(finishRef.current, size) ?? null;
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    let disposed = false;
    let frame = 0;
    let renderer: GlyphfieldHoloStickerRenderer | null = null;
    let visible = true;
    let lastWidth = 1;
    let lastHeight = 1;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!browserSupportsWebGL2()) {
      setRenderState('fallback');
      const timer = window.setTimeout(() => setRetry((value) => value + 1), 3_000);
      return () => window.clearTimeout(timer);
    }

    setRenderState('loading');
    try {
      renderer = new GlyphfieldHoloStickerRenderer(canvas);
      rendererRef.current = renderer;
    } catch {
      markWebGLContextUnavailable();
      setRenderState('fallback');
      const timer = window.setTimeout(() => setRetry((value) => value + 1), 3_000);
      return () => window.clearTimeout(timer);
    }

    const resize = new ResizeObserver(([entry]) => {
      lastWidth = Math.max(1, Math.round(entry.contentRect.width));
      lastHeight = Math.max(1, Math.round(entry.contentRect.height));
      renderer?.render(finishRef.current, lastWidth, lastHeight, performance.now() / 1_000);
    });
    resize.observe(host);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    }, { rootMargin: '120px' });
    intersection.observe(host);

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      if (disposed) return;
      markWebGLContextUnavailable();
      setRenderState('recovering');
      window.setTimeout(() => setRetry((value) => value + 1), 2_100);
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    const sourceUrl = artworkUrl || fallbackArtwork(label);
    loadArtwork(sourceUrl).catch(() => loadArtwork(fallbackArtwork(label))).then((image) => {
      if (disposed || !renderer) return;
      renderer.setArtwork(image, sourceUrl);
      renderer.render(finishRef.current, lastWidth, lastHeight, 0);
      setRenderState('ready');
    }).catch(() => {
      if (!disposed) setRenderState('fallback');
    });

    const tick = (time: number) => {
      if (!disposed) {
        if (visible && document.visibilityState === 'visible') renderer?.render(finishRef.current, lastWidth, lastHeight, time / 1_000);
        if (!reduceMotion) frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      renderer?.dispose();
      if (rendererRef.current === renderer) rendererRef.current = null;
    };
  }, [artworkUrl, label, retry]);

  useEffect(() => {
    const bounds = hostRef.current?.getBoundingClientRect();
    if (!bounds) return;
    rendererRef.current?.render(finish, Math.max(1, bounds.width), Math.max(1, bounds.height), performance.now() / 1_000);
  }, [finish]);

  function updateTilt(clientX: number, clientY: number) {
    const bounds = hostRef.current?.getBoundingClientRect();
    if (!bounds) return;
    rendererRef.current?.setTilt(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -(((clientY - bounds.top) / bounds.height) * 2 - 1)
    );
  }

  const fallbackUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(fallbackSvg)}`;
  const portableArtwork = artworkUrl || fallbackUrl;
  const portableMask = `url("${portableArtwork.replaceAll('"', '%22')}")`;
  const stageStyle = {
    '--holo-border': finish.borderColor,
    '--holo-fallback-angle': `${finish.glintAngle}deg`,
    '--holo-fallback-opacity': Math.max(0.12, finish.intensity / 125),
  } as CSSProperties;
  return (
    <div
      className='holo-sticker-stage'
      data-holo-sticker-stage='true'
      data-render-status={renderState}
      onPointerLeave={() => rendererRef.current?.setTilt(0, 0)}
      onPointerMove={(event) => updateTilt(event.clientX, event.clientY)}
      ref={hostRef}
      style={stageStyle}
    >
      <div aria-hidden='true' className='holo-sticker-checker' />
      <div aria-hidden='true' className='holo-sticker-fallback'>
        <img alt='' src={portableArtwork} />
        <span className='holo-sticker-fallback-foil' style={{ maskImage: portableMask, WebkitMaskImage: portableMask }} />
      </div>
      <canvas aria-label={`${label} holographic die-cut sticker preview`} className='holo-sticker-canvas' ref={canvasRef} role='img' />
      <div aria-hidden='true' className='holo-sticker-vignette' />
      <div className='holo-sticker-render-state' data-state={renderState}>
        <span className='holo-sticker-state-dot' />
        {renderState === 'ready' ? 'Live foil' : renderState === 'recovering' ? 'Recovering renderer' : renderState === 'fallback' ? 'Portable preview' : 'Preparing foil'}
      </div>
    </div>
  );
});

export default HoloStickerStage;
