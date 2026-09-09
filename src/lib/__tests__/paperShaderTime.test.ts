import { describe, expect, it } from 'vitest';

import { liveMaterialMotionRate } from '@/lib/liveMaterials';
import { resolvePaperShaderFrame } from '@/lib/paperShaderTime';

const options = {
  materialId: 'paper-gem-smoke' as const,
  timeMs: 1250,
  speed: 0.3,
  preserveGeometry: false,
  preset: { frame: 0, speed: 1 },
};

describe('Paper native millisecond frame resolution', () => {
  it('maps authored time using both the user and preset rates without modulo or frame-index conversion', () => {
    expect(resolvePaperShaderFrame(options)).toBe(1 + 1250 * liveMaterialMotionRate(0.3));
    expect(resolvePaperShaderFrame({ ...options, timeMs: 91_250, preset: { frame: 300, speed: 0.5 } }))
      .toBe(301 + 91_250 * liveMaterialMotionRate(0.3) * 0.5);
  });

  it('restores an exact native anchor and advances only the timeline offset from that anchor', () => {
    const frameState = { version: 2 as const, engine: 'paper' as const,
      materialId: options.materialId, frame: 734.125, timelineTimeMs: 1250 };
    expect(resolvePaperShaderFrame({ ...options, frameState })).toBe(734.125);
    expect(resolvePaperShaderFrame({ ...options, timeMs: 2250, frameState }))
      .toBeCloseTo(734.125 + 1000 * liveMaterialMotionRate(0.3));
  });

  it('retains legacy Paper anchors and preset-preserving motion semantics', () => {
    const frameState = { version: 1 as const, engine: 'paper' as const, frame: 100.25, timelineTimeMs: 1000 };
    expect(resolvePaperShaderFrame({ ...options, preserveGeometry: true, frameState,
      preset: { frame: 99, speed: 0.5 } })).toBe(225.25);
    expect(resolvePaperShaderFrame({ ...options, preserveGeometry: true, preset: { frame: 99, speed: 0 } }))
      .toBe(100 + 1250 * 0.35);
  });

  it('ignores foreign material/engine anchors', () => {
    expect(resolvePaperShaderFrame({ ...options, frameState: {
      version: 2, engine: 'paper', materialId: 'paper-dithering', frame: 999, timelineTimeMs: 1250,
    } })).toBe(resolvePaperShaderFrame(options));
    expect(resolvePaperShaderFrame({ ...options, frameState: {
      version: 2, engine: 'webgl', frame: 999, timelineTimeMs: 1250,
    } })).toBe(resolvePaperShaderFrame(options));
  });
});
