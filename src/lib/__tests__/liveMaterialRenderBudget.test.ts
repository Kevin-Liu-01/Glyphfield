import { describe, expect, it } from 'vitest';

import {
  liveMaterialFrameIsDue,
  liveMaterialInstancePixelBudget,
  resolveLiveMaterialPixelRatio,
} from '@/lib/liveMaterialRenderBudget';

describe('live material render budget', () => {
  it('keeps every native 60Hz frame despite fractional vsync timestamps', () => {
    let lastDrawn = 100;
    let drawn = 0;
    for (let index = 1; index <= 60; index += 1) {
      const time = 100 + index * 16.6;
      if (!liveMaterialFrameIsDue(time, lastDrawn, 60)) continue;
      lastDrawn = time;
      drawn += 1;
    }
    expect(drawn).toBe(60);
  });

  it('continues respecting the lower render budget on high-refresh displays', () => {
    let lastDrawn = 100;
    let drawn = 0;
    for (let index = 1; index <= 120; index += 1) {
      const time = 100 + index * (1_000 / 120);
      if (!liveMaterialFrameIsDue(time, lastDrawn, 30)) continue;
      lastDrawn = time;
      drawn += 1;
    }
    expect(drawn).toBe(30);
  });

  it('caps a high-density canvas to its pixel budget', () => {
    const ratio = resolveLiveMaterialPixelRatio({
      cssHeight: 450,
      cssWidth: 800,
      devicePixelRatio: 2,
      maxDevicePixelRatio: 3,
      maxPixelCount: 180_000,
      renderScale: 1,
    });

    expect(ratio).toBeCloseTo(Math.sqrt(0.5));
    expect(Math.round(800 * ratio) * Math.round(450 * ratio)).toBeLessThanOrEqual(180_500);
  });

  it('keeps the requested density when it already fits', () => {
    expect(resolveLiveMaterialPixelRatio({
      cssHeight: 180,
      cssWidth: 320,
      devicePixelRatio: 1,
      maxDevicePixelRatio: 2.5,
      maxPixelCount: 180_000,
      renderScale: 1,
    })).toBe(1);
  });

  it('shares the Design Lab budget as live shader layers accumulate', () => {
    const budgetFor = (instanceCount: number) => liveMaterialInstancePixelBudget({
      instanceCount,
      maxPerInstance: 120_000,
      minPerInstance: 48_000,
      totalBudget: 300_000,
    });

    expect(budgetFor(1)).toBe(120_000);
    expect(budgetFor(2)).toBe(120_000);
    expect(budgetFor(3)).toBe(100_000);
    expect(budgetFor(4)).toBe(75_000);
  });
});
