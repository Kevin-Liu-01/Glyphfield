// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AnimationTimelinePreview from '@/components/AnimationTimelinePreview';
import { DEFAULT_SETTINGS } from '@/lib/studio';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';
import type { StudioSource } from '@/lib/renderFrame';

const mocks = vi.hoisted(() => ({
  slot: vi.fn(), release: vi.fn(), encode: vi.fn(), presentation: vi.fn(), preload: vi.fn(), composite: vi.fn(),
}));
vi.mock('@/lib/shaderPreviewBudget', () => ({ requestShaderPreviewSlot: (grant: () => void) => {
  mocks.slot(); grant(); return mocks.release;
} }));
vi.mock('@/lib/renderFrame', () => ({ renderFrame: vi.fn() }));
vi.mock('@/lib/liveMaterialPreview', () => ({ readLiveMaterialPresentation: mocks.presentation }));
vi.mock('@/lib/shaderFramePresentation', () => ({
  preloadShaderFramePresentation: mocks.preload,
  drawShaderFramePresentation: mocks.composite,
}));
vi.mock('@/components/LazyLiveMaterialCanvas', () => ({ default: () => (
  <canvas data-live-material-ready='false' width={120} height={80} />
) }));

describe('Animation inspector shader preview lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;
  let observers: Set<IntersectionObserverCallback>;
  let rafs: Map<number, FrameRequestCallback>;
  let serial = 0;
  let fixture = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    mocks.slot.mockClear(); mocks.release.mockClear(); mocks.encode.mockClear();
    mocks.presentation.mockReset(); mocks.preload.mockReset(); mocks.composite.mockReset();
    mocks.preload.mockResolvedValue(undefined);
    mocks.encode.mockReturnValue('data:image/webp;base64,YQ==');
    observers = new Set(); rafs = new Map();
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { observers.add(callback); }
      observe() {} disconnect() {}
    });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { rafs.set(++serial, callback); return serial; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => rafs.delete(id));
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(mocks.encode);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    host = document.createElement('div');
    host.className = 'studio-project-workspace-layer'; host.dataset.active = 'true';
    document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount()); host.remove();
    vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  });
  async function render() {
    const sources: StudioSource[] = [{ id: 'text', kind: 'text', text: 'Preview', background: {
      style: 'shader', materialId: 'paper-dithering-swirl', angle: 0, opacity: 1,
      colorA: '#000000', colorB: '#ffffff', colorC: '#eeeeee',
      materialSettings: { ...DEFAULT_LIVE_MATERIAL_SETTINGS, speed: ++fixture / 100 },
    } }];
    await act(async () => root.render(<AnimationTimelinePreview authenticShader index={0} kind='frame'
      layout='tooltip' settings={DEFAULT_SETTINGS} sources={sources} />));
  }
  async function visible(value: boolean) {
    await act(async () => observers.forEach(cb => cb([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver)));
  }
  async function advance(ms = 2000) {
    await act(async () => vi.advanceTimersByTime(ms));
    await act(async () => { const pending = [...rafs.values()]; rafs.clear(); pending.forEach(cb => cb(performance.now())); });
  }
  async function ready() {
    const canvas = host.querySelector<HTMLCanvasElement>('[data-live-material-ready]')!;
    await act(async () => { canvas.dataset.liveMaterialReady = 'true'; });
    await advance(32);
    return canvas;
  }
  it('does not allocate an offscreen inspector WebGL preview', async () => {
    await render(); await advance();
    expect(mocks.slot).not.toHaveBeenCalled();
    expect(host.querySelector('[data-live-material-ready]')).toBeNull();
  });
  it('waits for actual renderer readiness, not just allocated canvas dimensions', async () => {
    await render(); await visible(true); await advance();
    expect(mocks.slot).toHaveBeenCalledOnce();
    expect(mocks.encode).not.toHaveBeenCalled();
    await act(async () => { host.querySelector<HTMLElement>('[data-live-material-ready]')!.dataset.liveMaterialReady = 'true'; });
    await advance(32);
    expect(mocks.encode).toHaveBeenCalledOnce();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(host.querySelector('.animation-timeline-preview-shader-image')).not.toBeNull();
  });
  it('releases an in-flight capture when its owning project becomes inactive', async () => {
    await render(); await visible(true);
    expect(mocks.slot).toHaveBeenCalledOnce();
    await act(async () => { host.dataset.active = 'false'; });
    await advance();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(mocks.encode).not.toHaveBeenCalled();
    expect(host.querySelector('[data-live-material-ready]')).toBeNull();
  });
  it('never caches a failed shader canvas as a successful preview', async () => {
    await render(); await visible(true);
    await act(async () => { host.querySelector<HTMLElement>('[data-live-material-ready]')!.dataset.liveMaterialReady = 'error'; });
    await advance();
    expect(mocks.encode).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it('waits for grain decoding and encodes the composited presentation, not the raw shader canvas', async () => {
    const presentation = { filter: 'brightness(1.4) contrast(1.1) saturate(0.8)', grainOpacity: 0.25, grainTileSize: 104 };
    let resolveGrain!: () => void;
    mocks.presentation.mockReturnValue(presentation);
    mocks.preload.mockReturnValue(new Promise<void>(resolve => { resolveGrain = resolve; }));
    await render(); await visible(true);
    const nativeCanvas = await ready();
    expect(mocks.preload).toHaveBeenCalledExactlyOnceWith(presentation);
    expect(mocks.composite).not.toHaveBeenCalled();
    expect(mocks.encode).not.toHaveBeenCalled();
    // Provider updates during the shared asset load must not start another capture.
    await act(async () => { nativeCanvas.dataset.liveMaterialReady = 'true'; });
    await advance(32);
    expect(mocks.preload).toHaveBeenCalledOnce();
    await act(async () => resolveGrain());
    expect(mocks.composite).toHaveBeenCalledExactlyOnceWith(expect.any(Object), nativeCanvas, presentation,
      { x: 0, y: 0, width: 120, height: 80 });
    expect(mocks.encode).toHaveBeenCalledExactlyOnceWith('image/webp', 0.86);
    expect(mocks.encode.mock.contexts[0]).not.toBe(nativeCanvas);
    expect(mocks.composite.mock.invocationCallOrder[0]).toBeLessThan(mocks.encode.mock.invocationCallOrder[0]!);
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it.each(['hidden', 'unmounted'] as const)('does not encode an async presentation after the preview is %s', async (state) => {
    let resolveGrain!: () => void;
    mocks.presentation.mockReturnValue({ grainOpacity: 0.2 });
    mocks.preload.mockReturnValue(new Promise<void>(resolve => { resolveGrain = resolve; }));
    await render(); await visible(true); await ready();
    expect(mocks.preload).toHaveBeenCalledOnce();
    if (state === 'hidden') await visible(false);
    else await act(async () => root.render(null));
    await act(async () => resolveGrain());
    expect(mocks.composite).not.toHaveBeenCalled();
    expect(mocks.encode).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it('uses the representative fallback if presentation assets fail, without caching raw pixels', async () => {
    mocks.preload.mockRejectedValue(new Error('Grain decode failed'));
    await render(); await visible(true); await ready();
    expect(mocks.composite).not.toHaveBeenCalled();
    expect(mocks.encode).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
    expect(host.querySelector<HTMLElement>('.animation-timeline-preview-shader-image')?.style.backgroundImage)
      .not.toContain('data:image/');
  });
  it('waits for Paper presentation registration after the renderer ready commit', async () => {
    await render(); await visible(true);
    const canvas = host.querySelector<HTMLCanvasElement>('[data-live-material-ready]')!;
    canvas.className = 'paper-shader-host';
    await ready();
    expect(mocks.encode).not.toHaveBeenCalled();
    mocks.presentation.mockReturnValue({ filter: 'brightness(1.2)' });
    await advance(100);
    expect(mocks.composite).toHaveBeenCalledOnce();
    expect(mocks.encode).toHaveBeenCalledOnce();
  });
  it('ignores late grain completion after the bounded capture timeout', async () => {
    let resolveGrain!: () => void;
    mocks.presentation.mockReturnValue({ grainOpacity: 0.2 });
    mocks.preload.mockReturnValue(new Promise<void>(resolve => { resolveGrain = resolve; }));
    await render(); await visible(true); await ready();
    expect(mocks.preload).toHaveBeenCalledOnce();
    await advance(15_000);
    await act(async () => resolveGrain());
    expect(mocks.composite).not.toHaveBeenCalled();
    expect(mocks.encode).not.toHaveBeenCalled();
    expect(mocks.release).toHaveBeenCalledOnce();
  });
});
