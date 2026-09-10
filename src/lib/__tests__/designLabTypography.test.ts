import { describe, expect, it } from 'vitest';

import {
  DEFAULT_DESIGN_LAB_FONT_SIZE,
  MAX_DESIGN_LAB_FONT_SIZE,
  MIN_DESIGN_LAB_FONT_SIZE,
  designLabFontSizeUpdate,
  designLabTextDecorationLine,
  resolveDesignLabFontSize,
  resolveDesignLabFontSizeCqw,
  validateDesignLabTextTypography,
} from '../designLabTypography';

const ARTBOARDS = [
  { name: 'square', width: 1080, height: 1080 },
  { name: 'banner', width: 1920, height: 640 },
  { name: 'portrait', width: 720, height: 1280 },
];

describe('Design Lab font sizes', () => {
  it('exports the new-layer default and control bounds without using them as source limits', () => {
    expect(DEFAULT_DESIGN_LAB_FONT_SIZE).toBe(48);
    expect(MIN_DESIGN_LAB_FONT_SIZE).toBe(1);
    expect(MAX_DESIGN_LAB_FONT_SIZE).toBe(2048);
  });

  it.each(ARTBOARDS)('preserves legacy sizing on $name artboards', (dimensions) => {
    const layer = { transform: { x: 0, y: 0, scale: 0.37 } };
    expect(resolveDesignLabFontSize(layer, dimensions.height)).toBe(dimensions.height * 0.17 * 0.37);
    expect(resolveDesignLabFontSizeCqw(layer, dimensions)).toBeCloseTo(dimensions.height / dimensions.width * 17 * 0.37);
    expect(layer).not.toHaveProperty('fontSize');
  });

  for (const fontSize of [1, 12, 48]) {
    it.each(ARTBOARDS)(`renders explicit ${fontSize}px text on $name artboards`, (dimensions) => {
      const layer = { fontSize, transform: { x: 0, y: 0, scale: 1 } };
      expect(resolveDesignLabFontSize(layer, dimensions.height)).toBe(fontSize);
      expect(resolveDesignLabFontSizeCqw(layer, dimensions) * dimensions.width / 100).toBeCloseTo(fontSize);
    });
  }

  it('applies transform scale to the base font size, not the explicit text box', () => {
    const layer = { fontSize: 12, transform: { x: 0.2, y: -0.3, scale: 2.5, widthScale: 0.8, heightScale: 0.4 } };
    expect(resolveDesignLabFontSize(layer, 1080)).toBe(30);
  });

  it('keeps artboard typography independent of viewport zoom', () => {
    const layer = { fontSize: 12, transform: { x: 0, y: 0, scale: 1 } };
    for (const viewportZoom of [0.1, 0.5, 1, 2, 8]) {
      const dimensions = { width: 1920, height: 640, viewportZoom };
      expect(resolveDesignLabFontSize(layer, dimensions.height)).toBe(12);
      expect(resolveDesignLabFontSizeCqw(layer, dimensions)).toBe(0.625);
    }
  });

  it.each([0.25, 4096])('does not clamp or mutate an existing %spx size', (fontSize) => {
    const layer = Object.freeze({ fontSize, transform: Object.freeze({ x: 0, y: 0, scale: 2 }) });
    expect(resolveDesignLabFontSize(layer, 1080)).toBe(fontSize * 2);
    expect(() => validateDesignLabTextTypography(layer)).not.toThrow();
    expect(layer.fontSize).toBe(fontSize);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('uses legacy rendering for invalid explicit size %s', (fontSize) => {
    expect(resolveDesignLabFontSize({ fontSize, transform: { scale: 2, x: 0, y: 0 } }, 1000)).toBe(340);
  });
});

describe('Design Lab font size edits', () => {
  it('canonicalizes the displayed px size without moving or resizing an explicit text box', () => {
    const transform = Object.freeze({ scale: 2.5, x: 0.2, y: -0.3, widthScale: 0.8, heightScale: 0.4, custom: 'retained' });
    const layer = Object.freeze({ fontSize: 12, fontStyle: 'italic' as const, transform });
    const update = designLabFontSizeUpdate(layer, 48);
    expect(update).toEqual({ fontSize: 48, transform: { ...transform, scale: 1 } });
    expect(update.transform).not.toBe(transform);
    expect(resolveDesignLabFontSize({ ...layer, ...update }, 1080)).toBe(48);
    expect(layer.transform.scale).toBe(2.5);
    expect(layer.fontSize).toBe(12);
  });

  it('preserves a legacy box by resolving absent width and height to one before resetting scale', () => {
    const layer = { transform: { scale: 0.4, x: -0.25, y: 0.15 } };
    expect(designLabFontSizeUpdate(layer, 12)).toEqual({
      fontSize: 12,
      transform: { scale: 1, x: -0.25, y: 0.15, widthScale: 1, heightScale: 1 },
    });
    expect(layer.transform).not.toHaveProperty('widthScale');
  });

  it('preserves independently supplied box dimensions', () => {
    expect(designLabFontSizeUpdate({ transform: { scale: 2, x: 0, y: 0, widthScale: 0.2 } }, 1).transform)
      .toEqual({ scale: 1, x: 0, y: 0, widthScale: 0.2, heightScale: 1 });
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid update size %s', (size) => {
    expect(() => designLabFontSizeUpdate({ transform: { scale: 1, x: 0, y: 0 } }, size)).toThrow(/fontSize/);
  });
});

describe('Design Lab typography source validation', () => {
  it.each([{}, { fontSize: undefined, fontStyle: undefined }, { fontSize: 1 }, { fontSize: 4096 }, { fontStyle: 'normal' }, { fontStyle: 'italic' }, { underline: true }, { strikethrough: false }])('accepts optional legacy or valid typography %j', (value) => {
    expect(() => validateDesignLabTextTypography(value)).not.toThrow();
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, '12', true])('rejects malformed fontSize %s', (fontSize) => {
    expect(() => validateDesignLabTextTypography({ fontSize })).toThrow(/fontSize/);
  });

  it.each(['oblique', 'Italic', '', null, 1, true, ['italic'], { toString: () => 'italic' }])('rejects unsupported fontStyle %s', (fontStyle) => {
    expect(() => validateDesignLabTextTypography({ fontStyle })).toThrow(/fontStyle/);
  });

  it.each(['underline', 'true', 1, null, [], {}])('rejects malformed underline %s', (underline) => {
    expect(() => validateDesignLabTextTypography({ underline })).toThrow(/underline/);
  });

  it.each(['line-through', 'true', 1, null, [], {}])('rejects malformed strikethrough %s', (strikethrough) => {
    expect(() => validateDesignLabTextTypography({ strikethrough })).toThrow(/strikethrough/);
  });

  it.each([null, undefined, [], 'text', 1, true])('rejects a non-object layer %s', (value) => {
    expect(() => validateDesignLabTextTypography(value)).toThrow(/object/);
  });
});

describe('Design Lab text decoration', () => {
  it.each([
    [{}, 'none'],
    [{ underline: true }, 'underline'],
    [{ strikethrough: true }, 'line-through'],
    [{ strikethrough: true, underline: true }, 'underline line-through'],
  ] as const)('resolves independent decorations from %j', (typography, expected) => {
    expect(designLabTextDecorationLine(typography)).toBe(expected);
  });
});
