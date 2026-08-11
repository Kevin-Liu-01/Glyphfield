import { describe, expect, it } from 'vitest';

import { exactDistanceTransform } from '../holoStickerRenderer';

describe('holographic sticker cut field', () => {
  it('computes exact Euclidean distances from the artwork mask', () => {
    const mask = new Uint8Array(9);
    mask[4] = 1;
    const distance = exactDistanceTransform(mask, 3, 3);

    expect(distance[4]).toBe(0);
    expect(distance[1]).toBe(1);
    expect(distance[0]).toBeCloseTo(Math.SQRT2, 5);
    expect(distance[8]).toBeCloseTo(Math.SQRT2, 5);
  });
});
