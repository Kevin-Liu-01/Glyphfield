import { describe, expect, it, vi } from 'vitest';

import {
  createLandingRenderQualityStore,
  landingRenderBudget,
  parseLandingRenderQualityMode,
} from '@/lib/landingRenderQuality';

function harness(storedMode: unknown = 'auto') {
  let now = 0;
  let id = 0;
  let visible = true;
  let reducedMotion = false;
  const frames = new Map<number, FrameRequestCallback>();
  const activities = new Set<() => void>();
  const writeMode = vi.fn();
  const store = createLandingRenderQualityStore(() => ({
    cancelFrame: (frameId) => { frames.delete(frameId); },
    isVisible: () => visible,
    prefersReducedMotion: () => reducedMotion,
    readMode: () => storedMode,
    requestFrame: (callback) => { frames.set(++id, callback); return id; },
    subscribeActivity: (listener) => { activities.add(listener); return () => { activities.delete(listener); }; },
    writeMode,
  }));
  return {
    activities,
    advance: (duration: number, interval = 16) => {
      for (let elapsed = 0; elapsed < duration; elapsed += interval) {
        now += interval;
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(now));
      }
    },
    frames,
    setReducedMotion: (value: boolean) => { reducedMotion = value; activities.forEach((listener) => listener()); },
    setVisible: (value: boolean) => { visible = value; activities.forEach((listener) => listener()); },
    store,
    writeMode,
  };
}

describe('landing render quality policy', () => {
  it('keeps the existing high-resolution budget and only changes resolution in low mode', () => {
    expect(landingRenderBudget('high', 0.58, 180_000)).toEqual({ maxPixelCount: 180_000, renderScale: 0.58 });
    expect(landingRenderBudget('high', 0.6)).toEqual({ maxPixelCount: undefined, renderScale: 0.6 });
    expect(landingRenderBudget('low', 0.58, 180_000)).toEqual({ maxPixelCount: 90_000, renderScale: 0.58 * Math.SQRT1_2 });
    expect(landingRenderBudget('low', 0.6).maxPixelCount).toBe(64_800);
  });

  it('has one shared sampler and does no work while every demo is offscreen', () => {
    const { store, frames, activities, advance } = harness();
    const notify = vi.fn();
    const unsubscribe = store.subscribe(notify);
    expect(frames.size).toBe(0);
    const stopFirst = store.registerVisibleRenderer();
    const stopSecond = store.registerVisibleRenderer();
    expect(frames.size).toBe(1);
    advance(20_000);
    expect(notify).not.toHaveBeenCalled();
    stopFirst();
    expect(frames.size).toBe(1);
    stopSecond();
    expect(frames.size).toBe(0);
    unsubscribe();
    expect(activities.size).toBe(0);
  });

  it('ignores warmup and isolated slow frames, then downgrades once for sustained poor cadence', () => {
    const { store, advance, frames } = harness();
    const notify = vi.fn();
    store.subscribe(notify);
    store.registerVisibleRenderer();
    advance(4_500, 50);
    expect(store.getSnapshot().quality).toBe('high');
    advance(10_000, 16);
    expect(store.getSnapshot().quality).toBe('high');
    advance(8_000, 50);
    expect(store.getSnapshot()).toEqual({ mode: 'auto', quality: 'low', automaticallyReduced: true });
    expect(notify).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
    advance(60_000, 16);
    expect(store.getSnapshot().quality).toBe('low');
    expect(notify).toHaveBeenCalledOnce();
  });

  it.each([25, 1_000 / 30])('reduces resolution for sustained %sms frames instead of accepting a sub-60fps cadence', (interval) => {
    const { store, advance, frames } = harness();
    const notify = vi.fn();
    store.subscribe(notify);
    store.registerVisibleRenderer();
    advance(4_700, interval);
    expect(store.getSnapshot().quality).toBe('high');
    advance(3_000, interval);
    expect(store.getSnapshot()).toEqual({ mode: 'auto', quality: 'low', automaticallyReduced: true });
    expect(notify).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
  });

  it('accepts normal frame jitter and occasional dropped frames but detects repeatedly skipped 60Hz frames', () => {
    const { store, advance } = harness();
    store.subscribe(vi.fn());
    store.registerVisibleRenderer();
    for (let index = 0; index < 800; index += 1) {
      const interval = index % 10 === 0 ? 1_000 / 30 : index % 2 === 0 ? 17 : 18;
      advance(interval, interval);
    }
    expect(store.getSnapshot().quality).toBe('high');
    for (let index = 0; index < 500; index += 1) {
      const interval = index % 4 === 0 ? 1_000 / 30 : 1_000 / 60;
      advance(interval, interval);
    }
    expect(store.getSnapshot().quality).toBe('low');
  });

  it.each(['hidden', 'reduced motion', 'offscreen'] as const)('suspends and resets evidence when %s', (reason) => {
    const test = harness();
    test.store.subscribe(vi.fn());
    let unregister = test.store.registerVisibleRenderer();
    test.advance(4_700, 50);
    if (reason === 'hidden') test.setVisible(false);
    else if (reason === 'reduced motion') test.setReducedMotion(true);
    else unregister();
    expect(test.frames.size).toBe(0);
    test.advance(20_000, 100);
    expect(test.store.getSnapshot().quality).toBe('high');
    if (reason === 'hidden') test.setVisible(true);
    else if (reason === 'reduced motion') test.setReducedMotion(false);
    else unregister = test.store.registerVisibleRenderer();
    test.advance(4_700, 50);
    expect(test.store.getSnapshot().quality).toBe('high');
    test.advance(3_000, 50);
    expect(test.store.getSnapshot().quality).toBe('low');
    unregister();
  });

  it('never interprets background-like multi-second gaps as slow rendering', () => {
    const { store, advance } = harness();
    store.subscribe(vi.fn());
    store.registerVisibleRenderer();
    advance(30_000, 1_000);
    advance(4_700, 50);
    expect(store.getSnapshot().quality).toBe('high');
  });

  it('honors and persists explicit overrides without ever automatically upgrading', () => {
    const { store, advance, frames, writeMode } = harness();
    store.subscribe(vi.fn());
    store.registerVisibleRenderer();
    advance(8_000, 50);
    expect(store.getSnapshot().quality).toBe('low');
    store.setMode('high');
    advance(20_000, 50);
    expect(store.getSnapshot().quality).toBe('high');
    expect(frames.size).toBe(0);
    expect(writeMode).toHaveBeenLastCalledWith('high');
    store.setMode('auto');
    expect(store.getSnapshot().quality).toBe('low');
    store.setMode('low');
    expect(writeMode).toHaveBeenLastCalledWith('low');
  });

  it('restores a persisted override without starting a sampler or changing the server snapshot', () => {
    const { store, frames, setReducedMotion } = harness('high');
    expect(store.getServerSnapshot().mode).toBe('auto');
    setReducedMotion(true);
    store.subscribe(vi.fn());
    store.registerVisibleRenderer();
    expect(store.getSnapshot()).toEqual({ mode: 'high', quality: 'high', automaticallyReduced: false });
    expect(frames.size).toBe(0);
    expect(parseLandingRenderQualityMode('extreme')).toBe('auto');
    expect(parseLandingRenderQualityMode({ mode: 'low' })).toBe('auto');
  });
});
