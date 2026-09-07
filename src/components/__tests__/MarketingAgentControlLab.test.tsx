// @vitest-environment happy-dom

import { act, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveMaterialCanvasProps } from '@/components/LiveMaterialCanvas';
import { landingRenderQualityStore } from '@/lib/landingRenderQuality';

const activity = vi.hoisted(() => ({ active: false, near: false }));
const renderer = vi.hoisted(() => ({ create: vi.fn(), release: vi.fn() }));

vi.mock('@/hooks/useViewportActivity', () => ({
  useViewportActivity: (_ref: unknown, { rootMargin }: { rootMargin: string }) => (
    rootMargin === '960px 0px' ? activity.near : activity.active
  ),
}));
vi.mock('@/hooks/useDeferredRuntime', () => ({ useDeferredRuntime: (enabled: boolean) => enabled }));
vi.mock('@/components/LazyLiveMaterialCanvas', () => ({
  default: ({ frameRate, maxPixelCount, paused, renderScale, settings }: LiveMaterialCanvasProps) => {
    useEffect(() => {
      renderer.create();
      return () => { renderer.release(); };
    }, []);
    return <canvas data-frame-rate={frameRate} data-max-pixel-count={maxPixelCount} data-paused={String(paused)} data-render-scale={renderScale} data-speed={settings.speed} />;
  },
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@/components/ui/StudioRange', () => ({
  default: ({ children, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { children?: ReactNode }) => (
    <input {...props} type='range'>{children}</input>
  ),
}));

import MarketingAgentControlLab from '@/components/MarketingAgentControlLab';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('MarketingAgentControlLab viewport lifecycle', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let scan: { pause: ReturnType<typeof vi.fn>; play: ReturnType<typeof vi.fn>; updatePlaybackRate: ReturnType<typeof vi.fn> };
  let originalGetAnimations: PropertyDescriptor | undefined;
  let motionPreference: MediaQueryList;

  function render() {
    act(() => root.render(<MarketingAgentControlLab />));
  }

  function contract() {
    return container.querySelector('.marketing-agent-json')?.textContent;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    activity.active = false;
    activity.near = false;
    scan = { pause: vi.fn(), play: vi.fn(), updatePlaybackRate: vi.fn() };
    motionPreference = Object.assign(new EventTarget(), {
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
    }) as MediaQueryList;
    vi.stubGlobal('matchMedia', () => motionPreference);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    originalGetAnimations = Object.getOwnPropertyDescriptor(Element.prototype, 'getAnimations');
    Object.defineProperty(Element.prototype, 'getAnimations', {
      configurable: true,
      value: () => [scan as unknown as Animation],
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (originalGetAnimations) Object.defineProperty(Element.prototype, 'getAnimations', originalGetAnimations);
    else Reflect.deleteProperty(Element.prototype, 'getAnimations');
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does no offscreen agent work, then warms a paused shader before activating the same canvas', () => {
    render();
    const initial = contract();
    expect(container.querySelector('canvas')).toBeNull();
    act(() => vi.advanceTimersByTime(10_000));
    expect(contract()).toBe(initial);
    expect(vi.getTimerCount()).toBe(0);
    expect(scan.pause).toHaveBeenCalled();

    activity.near = true;
    render();
    const canvas = container.querySelector('canvas');
    expect(canvas?.dataset.paused).toBe('true');
    expect(renderer.create).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);

    activity.active = true;
    render();
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(canvas?.dataset.paused).toBe('false');
    expect(scan.play).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3_000));
    expect(contract()).not.toBe(initial);
  });

  it('cancels an active drag offscreen without changing values and resumes without resetting the source', () => {
    activity.near = true;
    activity.active = true;
    render();
    act(() => vi.advanceTimersByTime(2_000));
    expect(container.querySelector('[data-phase="dragging"]')).not.toBeNull();
    const interrupted = contract();
    const canvas = container.querySelector('canvas');

    activity.active = false;
    render();
    expect(canvas?.dataset.paused).toBe('true');
    expect(container.querySelector('[data-phase="dragging"]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(20_000));
    expect(contract()).toBe(interrupted);

    activity.active = true;
    render();
    expect(contract()).toBe(interrupted);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.release).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(3_000));
    expect(contract()).not.toBe(interrupted);

    const beforeRelease = contract();
    activity.active = false;
    activity.near = false;
    render();
    expect(container.querySelector('canvas')).toBeNull();
    expect(renderer.release).toHaveBeenCalledTimes(1);
    expect(contract()).toBe(beforeRelease);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes inactive connector DOM and restores the connections without resetting controls or the nearby canvas', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 640, 400));
    activity.near = true;
    render();
    const canvas = container.querySelector('canvas');
    const initialContract = contract();
    const initialNodeCount = container.querySelectorAll('*').length;
    expect(container.querySelector('.marketing-agent-connectors')).toBeNull();

    activity.active = true;
    render();
    expect(container.querySelector('.marketing-agent-connectors path[d]')).not.toBeNull();
    expect(container.querySelectorAll('*').length).toBeGreaterThan(initialNodeCount);

    activity.active = false;
    render();
    expect(container.querySelector('.marketing-agent-connectors')).toBeNull();
    expect(container.querySelectorAll('*').length).toBe(initialNodeCount);
    expect(contract()).toBe(initialContract);
    expect(container.querySelector('canvas')).toBe(canvas);

    activity.active = true;
    render();
    expect(container.querySelector('.marketing-agent-connectors path[d]')).not.toBeNull();
    expect(contract()).toBe(initialContract);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledTimes(1);
  });

  it('cancels autonomous timers and live motion when reduced-motion preference changes, retaining the current source', () => {
    Reflect.set(motionPreference, 'matches', true);
    activity.near = true;
    activity.active = true;
    render();
    const canvas = container.querySelector('canvas');
    const initial = contract();
    expect(canvas?.dataset.paused).toBe('true');
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10_000));
    expect(contract()).toBe(initial);

    act(() => {
      Reflect.set(motionPreference, 'matches', false);
      motionPreference.dispatchEvent(new Event('change'));
    });
    expect(canvas?.dataset.paused).toBe('false');
    act(() => vi.advanceTimersByTime(2_400));
    expect(contract()).not.toBe(initial);
    expect(container.querySelector('[data-phase="dragging"]')).not.toBeNull();
    const interrupted = contract();

    act(() => {
      Reflect.set(motionPreference, 'matches', true);
      motionPreference.dispatchEvent(new Event('change'));
    });
    expect(canvas?.dataset.paused).toBe('true');
    expect(container.querySelector('[data-phase="dragging"]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(10_000));
    expect(contract()).toBe(interrupted);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledTimes(1);
    expect(renderer.release).not.toHaveBeenCalled();
  });

  it('applies landing quality without resetting control values, animation cadence, or the canvas', () => {
    activity.near = true;
    render();
    const canvas = container.querySelector('canvas');
    const initial = contract();
    const speed = canvas?.dataset.speed;
    act(() => landingRenderQualityStore.setMode('low'));
    expect(canvas?.dataset.maxPixelCount).toBe('64800');
    expect(canvas?.dataset.frameRate).toBe('60');
    expect(canvas?.dataset.speed).toBe(speed);
    expect(contract()).toBe(initial);
    expect(container.querySelector('canvas')).toBe(canvas);
    expect(renderer.create).toHaveBeenCalledTimes(1);
    act(() => landingRenderQualityStore.setMode('auto'));
  });
});
