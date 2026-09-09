import { describe, expect, it } from 'vitest';
import { applyShaderNumericFilter } from '../shaderNumericFilter';

describe('origin-clean numeric shader filters', () => {
  it('applies brightness then contrast in order, clamps each step and preserves alpha', () => {
    const pixels = new Uint8ClampedArray([200, 100, 20, 128]);
    applyShaderNumericFilter(pixels, 'brightness(2) contrast(0.5)');
    expect([...pixels]).toEqual([191, 164, 84, 128]);
  });

  it('applies the CSS sRGB saturation matrix without changing transparent alpha', () => {
    const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 0]);
    applyShaderNumericFilter(pixels, 'saturate(0)');
    expect([...pixels]).toEqual([54, 54, 54, 255, 182, 182, 182, 0]);
  });

  it('leaves identity filters alone and clips over-saturation', () => {
    const pixels = new Uint8ClampedArray([180, 80, 20, 231]);
    applyShaderNumericFilter(pixels, 'brightness(1) contrast(1) saturate(1)');
    expect([...pixels]).toEqual([180, 80, 20, 231]);
    applyShaderNumericFilter(pixels, 'saturate(2)');
    expect([...pixels]).toEqual([255, 63, 0, 231]);
  });
});
