'use client';

import { useEffect, useRef, useState } from 'react';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { createShaderEffectsRenderer } from '@/lib/shaderEffectsRenderer';
import { getShaderEffect } from '@/lib/shaderEffects';
import { createLiveMaterialClock } from '@/lib/liveMaterialClock';
import { createLiveMaterialFrameLoop } from '@/lib/liveMaterialFrameLoop';
import { resolveLiveMaterialPixelRatio } from '@/lib/liveMaterialRenderBudget';
import { createLiveMaterialPreviewSignal, registerLiveMaterialRuntime, type LiveMaterialFrameState } from '@/lib/liveMaterialPreview';
import { liveMaterialMotionRate, type LiveMaterialSettings } from '@/lib/liveMaterials';

type Props = {
  materialId: string; settings: LiveMaterialSettings; active: boolean; paused: boolean;
  captureTimeMs: number | null; frameState?: LiveMaterialFrameState; frameRate: number;
  maxPixelCount?: number; renderScale: number; patternScale: number; sourceImage?: string;
};

export default function ShaderEffectsSurface(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gpuCanvas = useRef<HTMLCanvasElement>(null);
  const current = useCommittedRef(props);
  const invalidate = useRef<() => void>(() => {});
  const [error, setError] = useState('');
  const { materialId } = props;
  const sourceImage = props.sourceImage || String(props.settings.effectProps?.sourceImage || '');
  useEffect(() => {
    const surface = host.current!;
    const output = canvas.current!;
    const gpu = gpuCanvas.current!;
    const stateful = getShaderEffect(materialId)?.stateful ?? false;
    const context = output.getContext('2d');
    if (!context) return;
    let disposed = false;
    let busy = false;
    let pending = false;
    let resizeRequested = true;
    let lastFrame = 0;
    let presentedFrame = 0;
    let painted = false;
    let warmupFrames = 0;
    let assetWaitStarted = 0;
    let lastSize = '';
    let adapter: Awaited<ReturnType<typeof createShaderEffectsRenderer>> | undefined;
    let unregister = () => {};
    const clock = createLiveMaterialClock('webgpu', materialId);
    const signal = createLiveMaterialPreviewSignal(surface);
    const fail = (cause: unknown) => {
      if (disposed) return;
      surface.dataset.liveMaterialReady = 'error';
      setError(cause instanceof Error ? cause.message : 'WebGPU could not render this material.');
      loop.dispose();
    };
    const resize = async () => {
      if (!adapter || disposed) return;
      const { width, height } = surface.getBoundingClientRect();
      const settings = current.current;
      const ratio = resolveLiveMaterialPixelRatio({ cssWidth: width, cssHeight: height, devicePixelRatio: window.devicePixelRatio, maxDevicePixelRatio: 2, maxPixelCount: settings.maxPixelCount, renderScale: settings.renderScale });
      const size = `${width}:${height}:${ratio}`;
      if (size === lastSize) return;
      lastSize = size;
      adapter.renderer.setResolutionScale(ratio / Math.min(window.devicePixelRatio || 1, 2));
      adapter.renderer.resize(Math.max(1, width), Math.max(1, height));
      // Upstream resize applies on its next animation frame. A paused surface
      // must wait for that backing buffer before publishing/copying its pixels.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (disposed) return;
      adapter.renderer.stopAnimation();
    };
    const drawingStopped = () => disposed || clock.frozen;
    const draw = async (now: number) => {
      if (!adapter || drawingStopped()) return;
      if (busy) { pending = true; return; }
      busy = true;
      try {
        const state = current.current;
        if (resizeRequested) { resizeRequested = false; await resize(); }
        if (drawingStopped()) return;
        adapter.update(state.settings, state.patternScale);
        const frame = clock.draw({ now, rate: liveMaterialMotionRate(state.settings.speed), active: state.active, paused: state.paused, captureTimeMs: stateful ? null : state.captureTimeMs, frameState: state.frameState });
        const delta = (frame - lastFrame) / 1000;
        const assetsReadyBeforeDraw = adapter.assetsReady();
        await adapter.renderer.renderSyntheticFrame(stateful ? Math.max(0, Math.min(0.064, delta)) : delta);
        if (drawingStopped()) return;
        const failure = adapter.renderer.getFailureReason();
        if (failure) throw new Error(`WebGPU rendering unavailable (${failure}).`);
        lastFrame = frame;
        if (!assetsReadyBeforeDraw) {
          assetWaitStarted ||= now;
          if (now - assetWaitStarted > 15000) throw new Error('The source image did not finish loading.');
          pending = true;
          return;
        }
        if (warmupFrames++ < 2) { pending = true; return; }
        // Keep an owned 2D buffer: WebGPU may recycle its presented texture before
        // the editor's synchronous freeze/export path reads it.
        if (output.width !== gpu.width || output.height !== gpu.height) { output.width = gpu.width; output.height = gpu.height; }
        context.clearRect(0, 0, output.width, output.height);
        context.drawImage(gpu, 0, 0);
        surface.dataset.liveMaterialReady = 'true';
        presentedFrame = frame;
        signal.publish();
        if (!painted) {
          painted = true;
          unregister = registerLiveMaterialRuntime(output, { readFrame: (time) => ({ ...clock.read(time), frame: presentedFrame }), freeze: () => clock.freeze(), resume: () => { clock.resume(); loop.invalidate(); }, redraw: () => loop.invalidate() });
        }
      } catch (cause) { fail(cause); }
      finally { busy = false; if (pending && !disposed) { pending = false; loop.invalidate(); } }
    };
    const loop = createLiveMaterialFrameLoop({ draw: (now) => { void draw(now); }, frameRate: () => Math.min(30, current.current.frameRate), isAnimating: () => !!adapter && !disposed && !clock.frozen && current.current.active && !current.current.paused && current.current.captureTimeMs === null && current.current.settings.speed > 0 });
    invalidate.current = () => { resizeRequested = true; surface.dataset.liveMaterialReady = 'false'; loop.invalidate(); };
    const onPointer = () => { if (!current.current.paused && current.current.captureTimeMs === null) loop.invalidate(); };
    const observer = new ResizeObserver(() => { resizeRequested = true; surface.dataset.liveMaterialReady = 'false'; loop.invalidate(); });
    observer.observe(surface);
    setError('');
    surface.dataset.liveMaterialReady = 'false';
    void createShaderEffectsRenderer(gpu, materialId, current.current.settings, sourceImage).then((created) => {
      if (disposed) { created.dispose(); return; }
      adapter = created;
      adapter.renderer.setOnUnavailable((reason) => fail(new Error(`WebGPU unavailable: ${reason}`)));
      loop.invalidate();
      // Media textures and fonts load asynchronously in the upstream engine.
      gpu.addEventListener('pointermove', onPointer);
    }).catch(fail);
    return () => {
      disposed = true;
      invalidate.current = () => {};
      observer.disconnect(); loop.dispose(); signal.dispose(); unregister();
      gpu.removeEventListener('pointermove', onPointer);
      adapter?.dispose();
    };
  }, [materialId, sourceImage, props.settings.effectProps?.surface, current]);
  useEffect(() => { invalidate.current(); }, [props]);
  return <div ref={host} className='absolute inset-0 size-full' data-shader-effects={materialId} data-live-material-ready='false'>
    <canvas ref={canvas} aria-label='Shaders.com material preview' className='pointer-events-none absolute inset-0 size-full' />
    <canvas ref={gpuCanvas} data-shader-internal='true' aria-hidden='true' className='absolute inset-0 size-full opacity-0' />
    {error ? <div role='status' className='absolute inset-0 grid place-content-center bg-background/90 p-5 text-center text-xs text-muted-foreground'>{error}</div> : null}
  </div>;
}
