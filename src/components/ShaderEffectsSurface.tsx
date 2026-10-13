'use client';

import { useGT } from 'gt-next';
import { useEffect, useRef, useState } from 'react';
import { getWebGPUSupport } from 'shaders/core';
import AuthenticShaderPreview from '@/components/AuthenticShaderPreview';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { driveAmbientPointer } from '@/lib/ambientPointer';
import { createShaderEffectsRenderer } from '@/lib/shaderEffectsRenderer';
import { getShaderEffect, shaderEffectInputsChanged } from '@/lib/shaderEffects';
import { createLiveMaterialClock } from '@/lib/liveMaterialClock';
import { createLiveMaterialFrameLoop } from '@/lib/liveMaterialFrameLoop';
import { resolveLiveMaterialPixelRatio } from '@/lib/liveMaterialRenderBudget';
import { createLiveMaterialPreviewSignal, registerLiveMaterialRuntime, type LiveMaterialFrameState } from '@/lib/liveMaterialPreview';
import { liveMaterialMotionRate, type LiveMaterialId, type LiveMaterialSettings } from '@/lib/liveMaterials';

type Props = {
  materialId: LiveMaterialId; settings: LiveMaterialSettings; active: boolean; paused: boolean;
  captureTimeMs: number | null; frameState?: LiveMaterialFrameState; frameRate: number;
  maxPixelCount?: number; renderScale: number; patternScale: number; sourceImage?: string;
};
type Failure = 'unsupported' | 'failed';

// Stateful effects start from an empty field; simulate this much before the first paint.
const WARMUP_SECONDS = 3;
const WARMUP_STEP_SECONDS = 1 / 30;

export default function ShaderEffectsSurface(props: Props) {
  const gt = useGT();
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gpuCanvas = useRef<HTMLCanvasElement>(null);
  const current = useCommittedRef(props);
  const rendered = useRef(props);
  const invalidate = useRef<(resize: boolean) => void>(() => {});
  const [failure, setFailure] = useState<Failure | null>(null);
  const { materialId } = props;
  const sourceImage = props.sourceImage || String(props.settings.effectProps?.sourceImage || '');
  const surfaceMode = props.settings.effectProps?.surface;
  useEffect(() => {
    const surface = host.current!;
    const output = canvas.current!;
    const gpu = gpuCanvas.current!;
    const effect = getShaderEffect(materialId);
    const stateful = effect?.stateful ?? false;
    const interactive = effect?.category === 'Interactive';
    let warmed = !stateful;
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
    // The host's layout size; the hidden GPU canvas can measure 0 before layout.
    let size = { width: surface.clientWidth, height: surface.clientHeight };
    const aspect = () => size.width > 0 && size.height > 0 ? size.width / size.height : 1;
    let adapter: Awaited<ReturnType<typeof createShaderEffectsRenderer>> | undefined;
    let unregister = () => {};
    const clock = createLiveMaterialClock('webgpu', materialId);
    const signal = createLiveMaterialPreviewSignal(surface);
    // A failed surface shows its still thumbnail but reports 'error', so exports refuse it.
    const fail = (reason: Failure) => {
      if (disposed) return;
      surface.dataset.liveMaterialReady = 'error';
      setFailure(reason);
      loop.dispose();
    };
    const resize = async () => {
      if (!adapter || disposed) return;
      const { width, height } = size;
      const settings = current.current;
      const ratio = resolveLiveMaterialPixelRatio({ cssWidth: width, cssHeight: height, devicePixelRatio: window.devicePixelRatio, maxDevicePixelRatio: 2, maxPixelCount: settings.maxPixelCount, renderScale: settings.renderScale });
      const key = `${width}:${height}:${ratio}`;
      if (key === lastSize) return;
      lastSize = key;
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
        adapter.update(state.settings, state.patternScale, aspect());
        if (!warmed) {
          warmed = true;
          for (let elapsed = 0; elapsed < WARMUP_SECONDS && !drawingStopped(); elapsed += WARMUP_STEP_SECONDS) {
            // A faster sweep during warm-up leaves a full stroke for trail and ink effects.
            if (interactive) driveAmbientPointer(gpu, elapsed * 3, true);
            await adapter.renderer.renderSyntheticFrame(WARMUP_STEP_SECONDS);
          }
          if (drawingStopped()) return;
        }
        // Interactive effects follow a slow virtual cursor until someone moves the real one.
        if (interactive && !state.paused) driveAmbientPointer(gpu, WARMUP_SECONDS * 3 + now / 1000);
        // Stateful effects advance from their accumulated state; a requested time is ignored.
        const frame = clock.draw({ now, rate: liveMaterialMotionRate(state.settings.speed), active: state.active, paused: state.paused, captureTimeMs: stateful ? null : state.captureTimeMs, frameState: state.frameState });
        const delta = (frame - lastFrame) / 1000;
        const assetsReadyBeforeDraw = adapter.assetsReady();
        await adapter.renderer.renderSyntheticFrame(stateful ? Math.max(0, Math.min(0.064, delta)) : delta);
        if (drawingStopped()) return;
        if (adapter.renderer.getFailureReason()) throw new Error('WebGPU rendering failed.');
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
      } catch { fail('failed'); }
      finally { busy = false; if (pending && !disposed) { pending = false; loop.invalidate(); } }
    };
    const loop = createLiveMaterialFrameLoop({ draw: (now) => { void draw(now); }, frameRate: () => Math.min(30, current.current.frameRate), isAnimating: () => !!adapter && !disposed && !clock.frozen && current.current.active && !current.current.paused && current.current.captureTimeMs === null && current.current.settings.speed > 0 });
    invalidate.current = (resizeNeeded) => {
      if (resizeNeeded) resizeRequested = true;
      // A frozen frame stays published until it resumes; nothing would repaint it.
      if (clock.frozen || !adapter) return;
      surface.dataset.liveMaterialReady = 'false';
      loop.invalidate();
    };
    const onPointer = () => { if (!current.current.paused && current.current.captureTimeMs === null) loop.invalidate(); };
    const observer = new ResizeObserver(([entry]) => {
      if (entry) size = { width: entry.contentRect.width, height: entry.contentRect.height };
      invalidate.current(true);
    });
    observer.observe(surface);
    setFailure(null);
    surface.dataset.liveMaterialReady = 'false';
    // Probe WebGPU before loading the effect or its source image.
    void getWebGPUSupport().then(async ({ supported }) => {
      if (disposed) return;
      if (!supported) { fail('unsupported'); return; }
      const created = await createShaderEffectsRenderer(gpu, materialId, current.current.settings, sourceImage || undefined, aspect());
      if (disposed) { created.dispose(); return; }
      adapter = created;
      adapter.renderer.setOnUnavailable(() => fail('unsupported'));
      gpu.addEventListener('pointermove', onPointer);
      loop.invalidate();
    }).catch(() => fail('failed'));
    return () => {
      disposed = true;
      invalidate.current = () => {};
      observer.disconnect(); loop.dispose(); signal.dispose(); unregister();
      gpu.removeEventListener('pointermove', onPointer);
      adapter?.dispose();
    };
  }, [current, materialId, sourceImage, surfaceMode]);
  // Redraw only when a render input changes; resizes come from the observer.
  useEffect(() => {
    const previous = rendered.current;
    rendered.current = props;
    if (previous === props) return;
    const resolution = previous.renderScale !== props.renderScale || previous.maxPixelCount !== props.maxPixelCount;
    if (resolution || shaderEffectInputsChanged(previous, props)) invalidate.current(resolution);
  });
  return <div ref={host} className='absolute inset-0 size-full' data-shader-effects={materialId} data-live-material-ready='false'>
    <canvas ref={canvas} aria-label={gt('Shaders.com material preview')} className='pointer-events-none absolute inset-0 size-full' />
    <canvas ref={gpuCanvas} data-shader-internal='true' aria-hidden='true' className='absolute inset-0 size-full opacity-0' />
    {failure ? <>
      <AuthenticShaderPreview materialId={materialId} />
      <p role='status' className='absolute bottom-2 left-2 max-w-[calc(100%-1rem)] rounded bg-background/85 px-2 py-1 text-[10px] leading-4 text-muted-foreground'>
        {failure === 'unsupported' ? gt('WebGPU is unavailable here. Showing a still preview.') : gt('WebGPU could not render this material. Showing a still preview.')}
      </p>
    </> : null}
  </div>;
}
