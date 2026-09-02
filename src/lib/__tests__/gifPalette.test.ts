import { quantize } from 'gifenc';
import { describe, expect, it } from 'vitest';

import {
  collectGifPaletteSample,
  gifPaletteFramePixelBudget,
  gifProtectedColors,
  gifRgbFromHex,
  gifSampleFrameIndices,
  quantizeGifPalette,
  sampleGifPixels,
} from '@/lib/gifPalette';

function noisyFrame(seed: number): Uint8ClampedArray {
  // Large enough to make the authored color statistically rare, without
  // turning coverage instrumentation into the dominant test workload.
  const width = 96;
  const height = 48;
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const x = index % width;
    const y = Math.floor(index / width);
    pixels[index * 4] = (x * 3 + seed * 29) % 256;
    pixels[index * 4 + 1] = (y * 5 + x + seed * 43) % 256;
    pixels[index * 4 + 2] = (x + y * 7 + seed * 61) % 256;
    pixels[index * 4 + 3] = 255;
  }
  for (let index = 0; index < 30; index += 1) {
    pixels[index * 4] = 247;
    pixels[index * 4 + 1] = 31;
    pixels[index * 4 + 2] = 90;
  }
  return pixels;
}

function nearestPaletteColor(palette: number[][], target: readonly number[]): number[] | undefined {
  return [...palette].sort((left, right) => {
    const distance = (color: number[]) => color.slice(0, 3).reduce((total, channel, index) => (
      total + (channel - (target[index] ?? 0)) ** 2
    ), 0);
    return distance(left) - distance(right);
  })[0];
}

describe('GIF palette stability', () => {
  it('reserves authored foreground colors that ordinary frame quantization drops', () => {
    const textColor = [247, 31, 90] as const;
    const ordinaryPalettes = [0, 1, 2].map((seed) => quantize(noisyFrame(seed), 64, { format: 'rgb565' }));
    const ordinaryMatches = ordinaryPalettes.map((palette) => nearestPaletteColor(palette, textColor));

    expect(new Set(ordinaryMatches.map((color) => color?.join(':'))).size).toBeGreaterThan(1);
    expect(ordinaryMatches).not.toContainEqual([...textColor]);

    const protectedPalettes = [0, 1, 2].map((seed) => quantizeGifPalette({
      format: 'rgb565',
      maxColors: 64,
      pixels: noisyFrame(seed),
      protectedColors: [textColor],
      quantize,
    }));
    expect(protectedPalettes.every((palette) => palette.some((color) => (
      color[0] === textColor[0] && color[1] === textColor[1] && color[2] === textColor[2]
    )))).toBe(true);
  });

  it('samples the start, middle, and end of motion within a fixed memory budget', () => {
    const indices = gifSampleFrameIndices(120);
    const perFrameBudget = gifPaletteFramePixelBudget(indices.length);
    const frames = indices.map((index) => sampleGifPixels(noisyFrame(index), perFrameBudget));
    const sample = collectGifPaletteSample(frames);

    expect(indices).toEqual([0, 17, 34, 51, 68, 85, 102, 119]);
    expect(sample.byteLength).toBeLessThanOrEqual(262_144 * 4);
    expect(sample.byteLength).toBeGreaterThan(0);
  });

  it('normalizes, deduplicates, and rejects invalid protected colors', () => {
    expect(gifRgbFromHex('#f6a')).toEqual([255, 102, 170]);
    expect(gifRgbFromHex('not-a-color')).toBeNull();
    expect(gifProtectedColors(['#FF66AA', '#f6a', '#101820'])).toEqual([
      [255, 102, 170],
      [16, 24, 32],
    ]);
  });
});
