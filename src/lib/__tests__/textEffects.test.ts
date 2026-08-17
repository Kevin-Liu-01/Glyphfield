import { describe, expect, it } from 'vitest';

import {
  resolveTextEffectSettings,
  textEffectCssStyle,
  textEffectOpacityAt,
} from '@/lib/textEffects';

const bounds = { height: 100, width: 200, x: 0, y: 0 };

describe('text effects', () => {
  it('normalizes persisted settings without breaking older solid text layers', () => {
    expect(resolveTextEffectSettings()).toMatchObject({
      backgroundColor: '#111216',
      kind: 'solid',
      amount: 100,
      scale: 12,
    });
    expect(resolveTextEffectSettings({ amount: 140, scale: 1 })).toMatchObject({ amount: 100, scale: 4 });
    expect(resolveTextEffectSettings({ color: '#7BFFD9' })).toMatchObject({ backgroundColor: '#7BFFD9' });
  });

  it('recreates the ordered ProtoTemplate density sweep from solid to sparse', () => {
    const settings = { amount: 100, angle: 0, backgroundColor: '#111216', kind: 'dither' as const, scale: 12 };
    const left = Array.from({ length: 96 }, (_, index) => (
      textEffectOpacityAt(settings, 18 + index % 12, 10 + Math.floor(index / 12) * 3, bounds)
    ));
    const right = Array.from({ length: 96 }, (_, index) => (
      textEffectOpacityAt(settings, 178 + index % 12, 10 + Math.floor(index / 12) * 3, bounds)
    ));
    const average = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
    expect(average(left)).toBe(1);
    expect(average(right)).toBeLessThan(0.2);
  });

  it('keeps effect strength non-destructive and emits opaque two-color glyph fills', () => {
    expect(textEffectOpacityAt({ kind: 'halftone', amount: 0 }, 10, 10, bounds)).toBe(1);
    const ditherStyle = textEffectCssStyle({ backgroundColor: '#111216', kind: 'dither' }, '#FFFFFF');
    expect(String(ditherStyle.backgroundImage)).toContain('data:image/svg+xml');
    expect(ditherStyle.maskImage).toBeUndefined();
    expect(decodeURIComponent(String(ditherStyle.backgroundImage))).toContain('fill="#111216"');
    const gradientStyle = textEffectCssStyle({ backgroundColor: '#7BFFD9', kind: 'gradient' }, '#8AA8FF');
    expect(gradientStyle.backgroundClip).toBe('text');
    expect(String(gradientStyle.backgroundImage)).toContain('linear-gradient(11deg, #8AA8FF, #7BFFD9)');
  });
});
