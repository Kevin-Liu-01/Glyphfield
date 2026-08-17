import { describe, expect, it } from 'vitest';

import {
  BAYER_8X8,
  defaultCompositionEffectSettings,
  renderCompositionEffect,
  type CompositionEffectSettings,
} from '@/lib/compositionEffects';

function solidBuffer(width: number, height: number, value: number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 4) {
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }
  return { data, height, width };
}

describe('composition effects', () => {
  it('uses the stable Prototemplate-style 8x8 Bayer ordering', () => {
    expect(BAYER_8X8).toHaveLength(8);
    expect(BAYER_8X8.flat()).toHaveLength(64);
    expect(new Set(BAYER_8X8.flat()).size).toBe(64);
    expect(Math.min(...BAYER_8X8.flat())).toBe(0);
    expect(Math.max(...BAYER_8X8.flat())).toBe(63);
  });

  it('produces a deterministic binary Bayer field', () => {
    const settings: CompositionEffectSettings = {
      ...defaultCompositionEffectSettings('bayer'),
      background: '#000000',
      foreground: '#FFFFFF',
    };
    const result = renderCompositionEffect(solidBuffer(8, 8, 128), settings);
    const tones = new Set<number>();
    for (let offset = 0; offset < result.data.length; offset += 4) tones.add(result.data[offset]!);
    expect([...tones].sort((a, b) => a - b)).toEqual([0, 255]);
  });

  it('keeps every converter opaque and at the source dimensions', () => {
    for (const kind of ['ascii', 'bayer', 'halftone', 'posterize'] as const) {
      const source = solidBuffer(20, 16, 172);
      const result = renderCompositionEffect(source, defaultCompositionEffectSettings(kind));
      expect(result.width).toBe(20);
      expect(result.height).toBe(16);
      expect(result.data).toHaveLength(source.data.length);
      for (let offset = 3; offset < result.data.length; offset += 4) expect(result.data[offset]).toBe(255);
    }
  });

  it('inverts tone without mutating its source pixels', () => {
    const source = solidBuffer(6, 6, 245);
    const before = [...source.data];
    const normal = renderCompositionEffect(source, defaultCompositionEffectSettings('posterize'));
    const inverted = renderCompositionEffect(source, {
      ...defaultCompositionEffectSettings('posterize'),
      invert: true,
    });
    expect([...source.data]).toEqual(before);
    expect(normal.data[0]).toBeGreaterThan(inverted.data[0]!);
  });

  it('reuses a correctly sized output buffer for smooth live rendering', () => {
    const source = solidBuffer(16, 12, 180);
    const reusable = new Uint8ClampedArray(source.data.length);
    const result = renderCompositionEffect(
      source,
      defaultCompositionEffectSettings('bayer'),
      reusable
    );
    expect(result.data).toBe(reusable);
    expect(result.data.some((channel) => channel !== 0)).toBe(true);
  });
});
