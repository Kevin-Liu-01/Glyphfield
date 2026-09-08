'use client';

import { cloneElement, isValidElement, memo, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';

import { acquireShaderFrameAssetUrl, type ShaderFrameSnapshot } from '@/lib/shaderFrameAssets';
import {
  normalizeShaderFramePresentation,
  preloadShaderFramePresentation,
  shaderFrameGrainStyle,
} from '@/lib/shaderFramePresentation';
import { createLiveMaterialPreviewSignal, LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT, LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT,
  type LiveMaterialPatternScalePreview, type LiveMaterialSettingsPreview } from '@/lib/liveMaterialPreview';
import { clampShaderZoom } from '@/lib/shaderZoom';
import type { LiveMaterialCanvasProps } from './LiveMaterialCanvas';

import ShaderSkeleton from './ShaderSkeleton';

type LoadedFrame = { key: string; status: 'loading' | 'ready' | 'error'; snapshot?: ShaderFrameSnapshot; url?: string };
type FrozenPreview = { key: object; revision: number; settings: LiveMaterialSettingsPreview['settings']; patternScale?: number };

/** Edits are transient renderer props, not mutations of the saved recipe/PNG. */
function useFrozenShaderPreview(snapshot: ShaderFrameSnapshot | undefined, channel: string | undefined, children: ReactNode) {
  const [preview, setPreview] = useState<FrozenPreview>();
  const native = isValidElement<LiveMaterialCanvasProps>(children) && children.props.settings ? children : undefined;
  const key = useMemo(() => snapshot && channel ? {} : undefined,
    [snapshot, channel, native?.props.settings, native?.props.patternScale, native?.props.frameState]);
  const active = Boolean(key && preview?.key === key && native);
  const canPreview = Boolean(native);

  useEffect(() => {
    if (!key || !channel || !canPreview) return;
    let pending: FrozenPreview = { key, revision: 0, settings: {} };
    let frame = 0;
    const publish = () => {
      frame = 0;
      setPreview(pending);
    };
    const enqueue = (patch: Partial<FrozenPreview>) => {
      pending = { ...pending, ...patch, revision: pending.revision + 1 };
      if (!frame) frame = requestAnimationFrame(publish);
    };
    const settings = (event: Event) => {
      const detail = (event as CustomEvent<LiveMaterialSettingsPreview>).detail;
      if (detail?.channel !== channel) return;
      enqueue({ settings: { ...pending.settings, ...detail.settings } });
    };
    const scale = (event: Event) => {
      const detail = (event as CustomEvent<LiveMaterialPatternScalePreview>).detail;
      if (detail?.channel !== channel || !Number.isFinite(detail.value)) return;
      enqueue({ patternScale: clampShaderZoom(detail.value) });
    };
    window.addEventListener(LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, settings);
    window.addEventListener(LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT, scale);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(LIVE_MATERIAL_SETTINGS_PREVIEW_EVENT, settings);
      window.removeEventListener(LIVE_MATERIAL_PATTERN_SCALE_PREVIEW_EVENT, scale);
    };
  }, [canPreview, channel, key]);

  const rendered = useMemo(() => active && native && preview ? cloneElement(native, {
    // The wrapper owns this short-lived event stream. Do not apply the same
    // event twice in the child or rebuild the persistent application per drag.
    previewChannel: undefined,
    settings: { ...native.props.settings, ...preview.settings },
    patternScale: preview.patternScale ?? native.props.patternScale,
  }) : children, [active, children, native, preview]);
  return { active, editing: active ? 'true' : undefined, rendered, revision: active ? preview!.revision : undefined };
}

function nativeShaderReady(container: HTMLElement | null): boolean {
  const surfaces = Array.from(container?.querySelectorAll('[data-live-material-ready]') ?? []);
  return surfaces.length > 0 && surfaces.every((surface) => surface.getAttribute('data-live-material-ready') === 'true');
}

function shaderFrameLabel(captured: boolean, status: LoadedFrame['status']) {
  if (!captured) return 'Live shader';
  return status === 'error' ? 'Captured shader frame unavailable' : 'Captured shader frame';
}

function usePaintedPreviewRevision(hostRef: RefObject<HTMLDivElement | null>, revision?: number) {
  const signal = useRef<ReturnType<typeof createLiveMaterialPreviewSignal> | undefined>(undefined);
  useEffect(() => {
    const host = hostRef.current;
    if (!host || revision === undefined) {
      signal.current?.dispose();
      signal.current = undefined;
      if (host) delete host.dataset.shaderFramePreviewRevision;
      return;
    }
    signal.current ??= createLiveMaterialPreviewSignal(host, 'shaderFramePreviewRevision');
    signal.current.publish();
  }, [hostRef, revision]);
  useEffect(() => () => signal.current?.dispose(), []);
}

function useShaderFrameImage(snapshot: ShaderFrameSnapshot | undefined, editing: boolean) {
  const [frame, setFrame] = useState<LoadedFrame>({ key: '', status: 'loading' });
  const [liveReady, setLiveReady] = useState(false);
  const nativeHostRef = useRef<HTMLDivElement>(null);
  // On Resume, keep the already-decoded PNG until the newly mounted native
  // renderer has drawn. Its URL lease stays owned for that entire handoff.
  const activeSnapshot = snapshot && !editing ? snapshot : (!liveReady ? frame.snapshot ?? snapshot : undefined);
  const resolved = useMemo(() => {
    try {
      return { presentation: normalizeShaderFramePresentation(activeSnapshot?.presentation), invalid: false };
    } catch {
      return { presentation: {}, invalid: true };
    }
  }, [activeSnapshot?.presentation]);
  const { presentation, invalid } = resolved;
  const grain = Boolean(presentation.grainOpacity);
  const key = activeSnapshot ? `${activeSnapshot.assetId}:${activeSnapshot.width}x${activeSnapshot.height}:${grain}` : '';
  const imageRef = useRef<HTMLImageElement>(null);
  const current = frame.key === key ? frame : undefined;
  const status = invalid ? 'error' : current?.status ?? 'loading';
  const url = invalid ? undefined : current?.url;
  const ready = status === 'ready';
  const resuming = (!snapshot || editing) && ready;

  useEffect(() => {
    if (snapshot && !editing) {
      setLiveReady(false);
      return;
    }
    const host = nativeHostRef.current;
    if (!host) return;
    let paint = 0;
    let nextPaint = 0;
    const checkReady = () => {
      if (paint || !nativeShaderReady(host)) return;
      // Initial native props already contain the edit. Keep the exact PNG
      // through its first painted draw, including lazy Paper/R3F effects.
      paint = requestAnimationFrame(() => {
        nextPaint = requestAnimationFrame(() => {
          paint = 0;
          if (nativeShaderReady(host)) setLiveReady(true);
        });
      });
    };
    const observer = new MutationObserver(checkReady);
    observer.observe(host, { attributes: true, attributeFilter: ['data-live-material-ready'], childList: true, subtree: true });
    checkReady();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(paint);
      cancelAnimationFrame(nextPaint);
    };
  }, [editing, snapshot]);

  useEffect(() => {
    if (invalid) return;
    if (!activeSnapshot) {
      setFrame((previous) => previous.key ? { key: '', status: 'loading' } : previous);
      return;
    }
    let disposed = false;
    let lease: Awaited<ReturnType<typeof acquireShaderFrameAssetUrl>> | undefined;
    setFrame({ key, snapshot: activeSnapshot, status: 'loading' });
    void (async () => {
      try {
        const acquired = await acquireShaderFrameAssetUrl(activeSnapshot.assetId);
        if (disposed) {
          acquired.release();
          return;
        }
        lease = acquired;
        await preloadShaderFramePresentation(grain ? { grainOpacity: 1 } : undefined);
        if (!disposed) setFrame({ key, snapshot: activeSnapshot, status: 'loading', url: acquired.url });
      } catch {
        if (!disposed) setFrame({ key, snapshot: activeSnapshot, status: 'error' });
      }
    })();
    return () => {
      disposed = true;
      lease?.release();
    };
  }, [grain, invalid, key, activeSnapshot?.assetId]);

  const finishImage = async (image: HTMLImageElement) => {
    let nextStatus: LoadedFrame['status'] = 'ready';
    try {
      if (typeof image.decode === 'function') await image.decode();
      if (image.naturalWidth !== activeSnapshot?.width || image.naturalHeight !== activeSnapshot?.height) {
        throw new Error('The captured shader frame dimensions do not match.');
      }
    } catch {
      nextStatus = 'error';
    }
    if (!image.isConnected || imageRef.current !== image) return;
    setFrame((previous) => previous.key === key && previous.url === url && previous.status !== 'error'
      ? { ...previous, status: nextStatus } : previous);
  };

  return {
    activeSnapshot,
    finishImage,
    grain,
    imageRef,
    key,
    nativeHostRef,
    onError: () => setFrame((previous) => previous.key === key ? { ...previous, status: 'error' } : previous),
    presentation,
    ready,
    resuming,
    status,
    url,
  };
}

function ShaderFrameImage({
  children,
  className = '',
  previewChannel,
  snapshot,
  style,
}: {
  children?: ReactNode;
  className?: string;
  previewChannel?: string;
  snapshot?: ShaderFrameSnapshot;
  style?: CSSProperties;
}) {
  const preview = useFrozenShaderPreview(snapshot, previewChannel, children);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { activeSnapshot, finishImage, grain, imageRef, key, nativeHostRef, onError, presentation, ready, resuming, status, url } = useShaderFrameImage(snapshot, preview.active);

  usePaintedPreviewRevision(wrapperRef, preview.revision);

  return (
    <div
      aria-label={shaderFrameLabel(Boolean(activeSnapshot), status)}
      className={`absolute inset-0 size-full isolate overflow-hidden ${className}`}
      data-live-material-ready={snapshot && !preview.active ? status === 'error' ? 'error' : String(ready) : undefined}
      data-shader-frame-asset-id={activeSnapshot?.assetId}
      data-shader-frame-editing={preview.editing}
      data-shader-frame-ready={activeSnapshot ? String(ready) : undefined}
      ref={wrapperRef}
      style={style}
    >
      <div className='absolute inset-0 size-full' data-shader-frame-live-view='true' ref={nativeHostRef} style={{ opacity: resuming ? 0 : 1 }}>
        {(!snapshot || !ready || preview.active) && preview.rendered}
      </div>
      {activeSnapshot && !ready && children == null && <ShaderSkeleton state={status === 'error' ? 'unavailable' : 'loading'} />}
      {activeSnapshot && status === 'error' && <span className='sr-only' role='status'>The captured shader frame could not be loaded.</span>}
      {url && activeSnapshot && (
        <div className='pointer-events-none absolute inset-0 size-full isolate' style={{ filter: presentation.filter, opacity: ready ? 1 : 0 }}>
          <img
            alt='Captured shader frame'
            data-shader-frame-image='true'
            decoding='async'
            draggable={false}
            height={activeSnapshot.height}
            key={key}
            onError={onError}
            onLoad={(event) => { void finishImage(event.currentTarget); }}
            ref={imageRef}
            src={url}
            style={{ display: 'block', height: '100%', inset: 0, maxHeight: 'none', maxWidth: 'none', objectFit: 'fill', position: 'absolute', width: '100%' }}
            width={activeSnapshot.width}
          />
          {grain && <span aria-hidden='true' className='paper-material-grain pointer-events-none absolute inset-0' style={shaderFrameGrainStyle(presentation, activeSnapshot.width)} />}
        </div>
      )}
    </div>
  );
}

export default memo(ShaderFrameImage);
