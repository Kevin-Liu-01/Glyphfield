import { describe, expect, it } from 'vitest';

import {
  capVisibleFontWeight,
  clampTypographyPreviewSize,
  measureTypingSample,
  TYPOGRAPHY_PREVIEW_DEFAULT_SIZES,
  TYPOGRAPHY_PREVIEW_MAX_SIZES,
} from '../typography';

describe('typography helpers', () => {
  it('caps preview weights at the supported visible maximum', () => {
    expect(capVisibleFontWeight(400)).toBe(400);
    expect(capVisibleFontWeight(700)).toBe(550);
  });

  it('keeps every typography specimen below the landing hero type floor', () => {
    expect(Math.max(...Object.values(TYPOGRAPHY_PREVIEW_MAX_SIZES))).toBe(44);
    expect(TYPOGRAPHY_PREVIEW_DEFAULT_SIZES.Display).toBe(40);
    expect(clampTypographyPreviewSize('Display', 180)).toBe(44);
    expect(clampTypographyPreviewSize('Accent', 96)).toBe(36);
  });

  it('measures editable specimen text with monkeytype-style WPM', () => {
    expect(measureTypingSample('one two\nthree', 30_000)).toEqual({
      characters: 13,
      lines: 2,
      seconds: 30,
      words: 3,
      wordsPerMinute: 5,
    });
  });

  it('keeps an idle or empty typing session at zero WPM', () => {
    expect(measureTypingSample('', 0)).toEqual({
      characters: 0,
      lines: 0,
      seconds: 0,
      words: 0,
      wordsPerMinute: 0,
    });
  });
});
