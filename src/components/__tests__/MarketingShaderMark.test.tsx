// @vitest-environment happy-dom

import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveMaterialCanvasProps } from '@/components/LiveMaterialCanvas';
import { landingRenderQualityStore } from '@/lib/landingRenderQuality';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';
import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';

const activity = vi.hoisted(() => ({ ready: true, reducedMotion: false, visible: true }));
const renderer = vi.hoisted(() => ({ create: vi.fn(), release: vi.fn() }));

vi.mock('@/hooks/useDeferredRuntime', () => ({ useDeferredRuntime: vi.fn(() => activity.ready) }));
vi.mock('@/hooks/useViewportActivity', () => ({ useViewportActivity: () => activity.visible }));
vi.mock('@/hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => activity.reducedMotion }));
vi.mock('@/components/LiveMaterialCanvas', () => ({
  default: ({ activeWhileMounted, frameRate, maxPixelCount, paused, renderScale, settings }: LiveMaterialCanvasProps) => {
    useEffect(() => {
      renderer.create();
      return () => { renderer.release(); };
    }, []);
    return <canvas data-frame-rate={frameRate} data-max-pixel-count={maxPixelCount} data-paused={String(paused)} data-render-scale={renderScale} data-retained={String(activeWhileMounted)} data-speed={settings.speed} />;
  },
}));

import MarketingShaderMark from '@/components/MarketingShaderMark';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('MarketingShaderMark render cadence', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  function render() {
    act(() => root.render(<MarketingShaderMark materialId='paper-dithering-warp' settings={DEFAULT_LIVE_MATERIAL_SETTINGS} />));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(activity, { ready: true, reducedMotion: false, visible: true });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    landingRenderQualityStore.setMode('auto');
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    landingRenderQualityStore.setMode('auto');
  });

  it('targets 60fps and changes only resolution when quality changes', () => {
    render();
    const canvas = container.querySelector('canvas');
    expect(canvas?.dataset.frameRate).toBe('60');
    expect(canvas?.dataset.paused).toBe('false');
    const speed = canvas?.dataset.speed;
    act(() => landingRenderQualityStore.setMode('low'));
    expect(canvas?.dataset.frameRate).toBe('60');
    expect(canvas?.dataset.maxPixelCount).toBe('180000');
    expect(canvas?.dataset.speed).toBe(speed);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledOnce();
  });

  it.each(['offscreen', 'reduced motion'] as const)('pauses %s without discarding the prepared canvas', (reason) => {
    render();
    const canvas = container.querySelector('canvas');
    if (reason === 'offscreen') activity.visible = false;
    else activity.reducedMotion = true;
    render();
    act(() => landingRenderQualityStore.setMode('high'));
    expect(canvas?.dataset.paused).toBe('true');
    expect(canvas?.dataset.retained).toBe('true');
    expect(canvas?.dataset.frameRate).toBe('60');
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.release).not.toHaveBeenCalled();
    Object.assign(activity, { reducedMotion: false, visible: true });
    render();
    expect(canvas?.dataset.paused).toBe('false');
    expect(container.querySelector('canvas')).toBe(canvas);
  });

  it('mounts the above-the-fold renderer immediately without scheduling a deferred runtime', () => {
    activity.ready = false;
    render();
    expect(container.querySelector('canvas')?.dataset.frameRate).toBe('60');
    expect(renderer.create).toHaveBeenCalledOnce();
    expect(useDeferredRuntime).not.toHaveBeenCalled();
  });
});
