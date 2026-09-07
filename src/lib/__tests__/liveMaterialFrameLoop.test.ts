import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLiveMaterialFrameLoop } from '@/lib/liveMaterialFrameLoop';

describe('live material demand rendering', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  const paint = (time: number) => {
    const scheduled = [...callbacks.values()];
    callbacks.clear();
    scheduled.forEach((callback) => callback(time));
  };

  beforeEach(() => {
    callbacks = new Map();
    nextFrame = 0;
    vi.stubGlobal('window', { clearTimeout, setTimeout });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('freezes a paused simulation without redrawing or injecting new state', () => {
    const draw = vi.fn();
    const loop = createLiveMaterialFrameLoop({ draw, frameRate: () => 60, isAnimating: () => false });
    loop.invalidate();
    paint(16);
    paint(32);
    paint(48);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(0);
    loop.dispose();
  });

  it('responds to paused edits once and coalesces multiple invalidations', () => {
    const draw = vi.fn();
    const loop = createLiveMaterialFrameLoop({ draw, frameRate: () => 60, isAnimating: () => false });
    loop.invalidate();
    paint(16);
    loop.invalidate();
    loop.invalidate();
    loop.invalidate();
    paint(32);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(callbacks.size).toBe(0);
    loop.dispose();
  });

  it('resumes native frames and releases all pending work on disposal', () => {
    let active = false;
    const draw = vi.fn();
    const loop = createLiveMaterialFrameLoop({ draw, frameRate: () => 60, isAnimating: () => active });
    loop.invalidate();
    paint(16);
    active = true;
    loop.invalidate();
    paint(32);
    paint(48);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(callbacks.size).toBe(1);
    loop.dispose();
    paint(64);
    loop.invalidate();
    expect(callbacks.size).toBe(0);
    expect(draw).toHaveBeenCalledTimes(3);
  });
});
