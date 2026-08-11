import { describe, expect, it } from 'vitest';

import { capVisibleFontWeight, measureTypingSample } from '../typography';

describe('typography helpers', () => {
  it('caps preview weights at the supported visible maximum', () => {
    expect(capVisibleFontWeight(400)).toBe(400);
    expect(capVisibleFontWeight(700)).toBe(550);
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
