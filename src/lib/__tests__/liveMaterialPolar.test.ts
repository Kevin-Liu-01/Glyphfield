import { describe, expect, it } from 'vitest';

import {
  quantizeAngularCycles,
  SEAMLESS_POLAR_GLSL,
  seamlessAngularWarp,
  seamlessAngularWave,
} from '../liveMaterialPolar';

describe('live material polar math', () => {
  it('quantizes editable frequencies into closed radial cycles', () => {
    expect(quantizeAngularCycles(6.4, 3)).toBe(6);
    expect(quantizeAngularCycles(1.2, 3)).toBe(3);
    expect(SEAMLESS_POLAR_GLSL).toContain('floor(abs(frequency) + 0.5)');
  });

  it('matches both sides of the atan branch cut at every animation phase', () => {
    for (const phase of [0, 0.3, 1.1, 2.7, 5.4]) {
      expect(seamlessAngularWave(-Math.PI, 6.4, phase, 3)).toBeCloseTo(
        seamlessAngularWave(Math.PI, 6.4, phase, 3),
        12
      );
      expect(seamlessAngularWarp(-Math.PI, phase)).toBeCloseTo(
        seamlessAngularWarp(Math.PI, phase),
        12
      );
    }
  });
});
