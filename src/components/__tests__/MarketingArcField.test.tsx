// @vitest-environment happy-dom

import { act, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveMaterialCanvasProps } from '@/components/LiveMaterialCanvas';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';
import { landingRenderQualityStore } from '@/lib/landingRenderQuality';

const renderer = vi.hoisted(() => ({ create: vi.fn(), release: vi.fn() }));

vi.mock('@/components/LiveMaterialCanvas', () => ({
  default: ({ enabled = true, frameRate, maxPixelCount, paused, renderScale }: LiveMaterialCanvasProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
      if (!enabled) return;
      renderer.create();
      const frame = requestAnimationFrame(() => {
        if (canvasRef.current) canvasRef.current.dataset.liveMaterialReady = 'true';
      });
      return () => {
        cancelAnimationFrame(frame);
        renderer.release();
      };
    }, [enabled]);
    return enabled ? <canvas data-frame-rate={frameRate} data-live-material-ready='false' data-max-pixel-count={maxPixelCount} data-paused={String(paused)} data-render-scale={renderScale} ref={canvasRef} /> : null;
  },
}));

import MarketingArcField from '@/components/MarketingArcField';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('MarketingArcField renderer prewarming', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let observers: Map<string, IntersectionObserverCallback>;
  let idleCallbacks: Map<number, IdleRequestCallback>;
  let visibility: DocumentVisibilityState;
  let motionPreference: MediaQueryList;

  function intersect(margin: string, isIntersecting: boolean) {
    const callback = observers.get(margin);
    if (!callback) throw new Error(`Missing ${margin} observer`);
    act(() => callback([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver));
  }

  function completeIdlePrewarm() {
    act(() => vi.advanceTimersByTime(420));
    expect(renderer.create).not.toHaveBeenCalled();
    act(() => {
      idleCallbacks.forEach((callback) => callback({ didTimeout: false, timeRemaining: () => 16 }));
      idleCallbacks.clear();
    });
    act(() => vi.advanceTimersByTime(20));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    observers = new Map();
    idleCallbacks = new Map();
    let idleId = 0;
    visibility = 'visible';
    motionPreference = Object.assign(new EventTarget(), {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
    }) as MediaQueryList;
    vi.stubGlobal('matchMedia', () => motionPreference);
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
        observers.set(options.rootMargin!, callback);
      }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => {
      idleCallbacks.set(++idleId, callback);
      return idleId;
    });
    vi.stubGlobal('cancelIdleCallback', (id: number) => idleCallbacks.delete(id));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function render(persistAfterReady = false, eager = false) {
    act(() => root.render(<MarketingArcField
      eager={eager}
      materialId='paper-dithering-warp'
      persistAfterReady={persistAfterReady}
      settings={DEFAULT_LIVE_MATERIAL_SETTINGS}
    />));
  }

  it('admits a fast-arriving shader while scrolling keeps postponing idle prewarm', () => {
    render();
    intersect('960px 0px', true);
    for (let index = 0; index < 3; index += 1) {
      act(() => { vi.advanceTimersByTime(200); window.dispatchEvent(new Event('scroll')); });
    }
    expect(container.querySelector('canvas')).toBeNull();
    intersect('96px 0px', true);
    expect(container.querySelector('canvas')?.dataset.paused).toBe('false');
    expect(renderer.create).toHaveBeenCalledOnce();
    expect(idleCallbacks.size).toBe(0);
  });

  it('retains the urgently mounted canvas through active-edge exits while idle never runs', () => {
    render();
    intersect('960px 0px', true);
    act(() => vi.advanceTimersByTime(420));
    expect(idleCallbacks.size).toBe(1);
    intersect('96px 0px', true);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(idleCallbacks.size).toBe(0);
    intersect('96px 0px', false);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(canvas?.dataset.paused).toBe('true');
    intersect('96px 0px', true);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledOnce();
    expect(renderer.release).not.toHaveBeenCalled();
  });

  it('handles active-edge observer delivery before the wider prewarm observer', () => {
    render();
    intersect('96px 0px', true);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    intersect('960px 0px', true);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledOnce();
  });

  it('urgently loads a static reduced-motion frame without waiting for idle', () => {
    Reflect.set(motionPreference, 'matches', true);
    render();
    intersect('960px 0px', true);
    intersect('96px 0px', true);
    expect(container.querySelector('canvas')?.dataset.paused).toBe('true');
    expect(renderer.create).toHaveBeenCalledOnce();
    expect(idleCallbacks.size).toBe(0);
  });

  it('does not urgently mount in a hidden tab but admits immediately on visibility return', () => {
    visibility = 'hidden';
    render();
    intersect('960px 0px', true);
    intersect('96px 0px', true);
    expect(container.querySelector('canvas')).toBeNull();
    act(() => { visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    expect(container.querySelector('canvas')?.dataset.paused).toBe('false');
    expect(renderer.create).toHaveBeenCalledOnce();
  });

  it.each([false, true])('respects persistAfterReady=%s after urgent admission leaves the full range', (persist) => {
    render(persist);
    intersect('960px 0px', true);
    intersect('96px 0px', true);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    intersect('96px 0px', false);
    intersect('960px 0px', false);
    expect(container.querySelector('canvas')).toBe(persist ? canvas : null);
    expect(renderer.release).toHaveBeenCalledTimes(persist ? 0 : 1);
  });

  it('mounts an eager hero renderer before any delay or idle callback and retains it offscreen', () => {
    render(true, true);
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(renderer.create).toHaveBeenCalledOnce();
    expect(canvas?.dataset.paused).toBe('true');
    intersect('96px 0px', true);
    expect(canvas?.dataset.paused).toBe('false');
    intersect('96px 0px', false);
    intersect('960px 0px', false);
    act(() => vi.advanceTimersByTime(500));
    expect(idleCallbacks.size).toBe(0);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(canvas?.dataset.paused).toBe('true');
    expect(renderer.release).not.toHaveBeenCalled();
    intersect('960px 0px', true);
    intersect('96px 0px', true);
    expect(canvas?.dataset.paused).toBe('false');
    expect(renderer.create).toHaveBeenCalledOnce();
  });

  it('starts an eager reduced-motion hero paused and resumes the same renderer when allowed', () => {
    Reflect.set(motionPreference, 'matches', true);
    render(true, true);
    intersect('96px 0px', true);
    const canvas = container.querySelector('canvas');
    expect(canvas?.dataset.paused).toBe('true');
    expect(renderer.create).toHaveBeenCalledOnce();
    act(() => {
      Reflect.set(motionPreference, 'matches', false);
      motionPreference.dispatchEvent(new Event('change'));
    });
    expect(canvas?.dataset.paused).toBe('false');
    act(() => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(canvas?.dataset.paused).toBe('true');
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledOnce();
  });

  it('prepares an idle paused renderer ahead of visibility and resumes the same canvas on reentry', () => {
    render();
    expect(container.querySelector('canvas')).toBeNull();
    intersect('960px 0px', true);
    completeIdlePrewarm();
    const canvas = container.querySelector('canvas');
    expect(canvas?.dataset.liveMaterialReady).toBe('true');
    expect(canvas?.dataset.paused).toBe('true');
    expect(canvas?.dataset.frameRate).toBe('60');
    expect(renderer.create).toHaveBeenCalledTimes(1);

    intersect('96px 0px', true);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(canvas?.dataset.paused).toBe('false');
    expect(canvas?.dataset.frameRate).toBe('60');
    intersect('96px 0px', false);
    expect(canvas?.dataset.paused).toBe('true');
    intersect('96px 0px', true);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledTimes(1);
    expect(renderer.release).not.toHaveBeenCalled();
  });

  it('releases nonpersistent renderers outside the preparation range', () => {
    render();
    intersect('960px 0px', true);
    completeIdlePrewarm();
    intersect('960px 0px', false);
    expect(container.querySelector('canvas')).toBeNull();
    expect(renderer.release).toHaveBeenCalledTimes(1);
  });

  it('pauses a hidden tab without discarding a nearby nonpersistent canvas or prewarm state', () => {
    render();
    intersect('960px 0px', true);
    completeIdlePrewarm();
    intersect('96px 0px', true);
    const canvas = container.querySelector('canvas');
    expect(canvas?.dataset.paused).toBe('false');

    act(() => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(canvas?.dataset.paused).toBe('true');
    expect(renderer.release).not.toHaveBeenCalled();

    act(() => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(canvas?.dataset.paused).toBe('false');
    expect(renderer.create).toHaveBeenCalledTimes(1);
    expect(idleCallbacks.size).toBe(0);
  });

  it('retains an already prepared persistent hero renderer while paused far away', () => {
    render(true);
    intersect('960px 0px', true);
    completeIdlePrewarm();
    const canvas = container.querySelector('canvas');
    intersect('960px 0px', false);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(canvas?.dataset.paused).toBe('true');
    expect(renderer.release).not.toHaveBeenCalled();
  });

  it('keeps its renderer paused for reduced motion and responds to preference changes without remounting', () => {
    Reflect.set(motionPreference, 'matches', true);
    render();
    intersect('960px 0px', true);
    completeIdlePrewarm();
    intersect('96px 0px', true);
    const canvas = container.querySelector('canvas');
    expect(canvas?.dataset.paused).toBe('true');
    expect(container.firstElementChild?.getAttribute('data-shader-active')).toBe('false');

    act(() => {
      Reflect.set(motionPreference, 'matches', false);
      motionPreference.dispatchEvent(new Event('change'));
    });
    expect(canvas?.dataset.paused).toBe('false');

    act(() => {
      Reflect.set(motionPreference, 'matches', true);
      motionPreference.dispatchEvent(new Event('change'));
    });
    expect(canvas?.dataset.paused).toBe('true');
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledTimes(1);
    expect(renderer.release).not.toHaveBeenCalled();
  });

  it('changes only resolution when quality is overridden, retaining the prepared canvas and reduced-motion pause', () => {
    Reflect.set(motionPreference, 'matches', true);
    render();
    intersect('960px 0px', true);
    completeIdlePrewarm();
    intersect('96px 0px', true);
    const canvas = container.querySelector('canvas');
    act(() => landingRenderQualityStore.setMode('low'));
    expect(canvas?.dataset.maxPixelCount).toBe('45000');
    expect(canvas?.dataset.frameRate).toBe('60');
    expect(Number(canvas?.dataset.renderScale)).toBeCloseTo(0.5 * Math.SQRT1_2);
    act(() => landingRenderQualityStore.setMode('high'));
    expect(canvas?.dataset.renderScale).toBe('0.5');
    expect(canvas?.dataset.frameRate).toBe('60');
    expect(canvas?.dataset.paused).toBe('true');
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledTimes(1);
    expect(renderer.release).not.toHaveBeenCalled();
    act(() => landingRenderQualityStore.setMode('auto'));
  });
});
