import { describe, expect, it } from 'vitest';

import {
  clampShaderZoom,
  formatShaderZoom,
  interpolateShaderZoom,
  shaderZoomFromSlider,
  shaderZoomToSlider,
  stepShaderZoom,
} from '@/lib/shaderZoom';

describe('shader zoom', () => {
  it('centers 1× on a logarithmic 0.1×–10× track', () => {
    expect(shaderZoomToSlider(0.1)).toBeCloseTo(-1);
    expect(shaderZoomToSlider(1)).toBeCloseTo(0);
    expect(shaderZoomToSlider(10)).toBeCloseTo(1);
    expect(shaderZoomFromSlider(-0.5)).toBeCloseTo(Math.sqrt(0.1));
    expect(shaderZoomFromSlider(0.5)).toBeCloseTo(Math.sqrt(10));
  });

  it('clamps imported values and exposes useful multiplicative stops', () => {
    expect(clampShaderZoom(0)).toBe(0.1);
    expect(clampShaderZoom(20)).toBe(10);
    expect(stepShaderZoom(1, -1)).toBe(0.5);
    expect(stepShaderZoom(1, 1)).toBe(2);
    expect(formatShaderZoom(0.25)).toBe('0.25×');
    expect(formatShaderZoom(10)).toBe('10×');
  });

  it('interpolates in perceptual logarithmic space without overshooting', () => {
    const zoomingIn = interpolateShaderZoom(1, 10, 16, 45);
    const zoomingOut = interpolateShaderZoom(1, 0.1, 16, 45);
    expect(zoomingIn).toBeGreaterThan(1);
    expect(zoomingIn).toBeLessThan(10);
    expect(zoomingOut).toBeLessThan(1);
    expect(zoomingOut).toBeGreaterThan(0.1);
    expect(Math.log10(zoomingIn)).toBeCloseTo(-Math.log10(zoomingOut));
  });
});
