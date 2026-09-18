import { describe, expect, it } from 'vitest';
import { clearTextStyleProperties, editTextRuns, formatTextRange, textStyleSegments, validateTextStyleRuns } from '../richText';

describe('portable inline text formatting', () => {
  it('formats only the selected characters and composes overlapping properties', () => {
    const bold = formatTextRange('Hello world', undefined, { start: 0, end: 5 }, { weight: 700 });
    const color = formatTextRange('Hello world', bold, { start: 3, end: 8 }, { color: '#FF0000' });
    expect(color).toEqual([
      { start: 0, end: 3, style: { weight: 700 } },
      { start: 3, end: 5, style: { weight: 700, color: '#FF0000' } },
      { start: 5, end: 8, style: { color: '#FF0000' } },
    ]);
    expect(textStyleSegments('Hello world', color).at(-1)).toEqual({ start: 8, end: 11, style: {} });
  });

  it('supports multiline selections, explicit false overrides and compact adjacent runs', () => {
    const runs = formatTextRange('A\nB\nC', undefined, { start: 0, end: 3 }, { underline: true });
    expect(formatTextRange('A\nB\nC', runs, { start: 3, end: 5 }, { underline: true })).toEqual([{ start: 0, end: 5, style: { underline: true } }]);
    expect(formatTextRange('A\nB\nC', runs, { start: 2, end: 3 }, { underline: false }).at(-1)?.style).toEqual({ underline: false });
  });

  it('remaps styles when editing before, inside, after, or over formatted text', () => {
    const runs = [{ start: 2, end: 4, style: { weight: 700 } }];
    expect(editTextRuns('abcdef', 'xabcdef', runs)).toEqual([{ start: 3, end: 5, style: { weight: 700 } }]);
    expect(editTextRuns('abcdef', 'abcXdef', runs)).toEqual([{ start: 2, end: 5, style: { weight: 700 } }]);
    expect(editTextRuns('abcdef', 'abQef', runs)).toEqual([{ start: 2, end: 3, style: { weight: 700 } }]);
    expect(editTextRuns('abcdef', 'abef', runs)).toEqual([]);
    expect(editTextRuns('abcdef', '', runs)).toEqual([]);
    expect(editTextRuns('abcdef', 'abcdef!', runs)).toEqual(runs);
  });

  it('whole-box edits remove only overrides for the properties being changed', () => {
    const runs = [{ start: 0, end: 2, style: { weight: 700, color: '#CC3322' } }];
    expect(clearTextStyleProperties(runs, { weight: 400 })).toEqual([{ start: 0, end: 2, style: { color: '#CC3322' } }]);
    expect(runs[0].style.weight).toBe(700);
  });

  it('uses the real selection to disambiguate repeated characters', () => {
    expect(editTextRuns('aaaa', 'aaaaa', [{ start: 0, end: 2, style: { weight: 700 } }], { start: 1, end: 1 }))
      .toEqual([{ start: 0, end: 3, style: { weight: 700 } }]);
  });

  it('validates portable ranges and rejects malformed, overlapping or out-of-bounds styles', () => {
    expect(() => validateTextStyleRuns([{ start: 0, end: 2, style: { color: '#CC3322', underline: true, weight: 700 } }], 'abc')).not.toThrow();
    for (const runs of [
      [{ start: -1, end: 2, style: {} }], [{ start: 0, end: 4, style: {} }],
      [{ start: 0, end: 2, style: {} }, { start: 1, end: 3, style: {} }],
      [{ start: 0, end: 2, style: { fontSize: NaN } }], [{ start: 0, end: 2, style: { underline: 'yes' } }],
      [{ start: 0, end: 2, style: { html: '<script>' } }],
    ]) expect(() => validateTextStyleRuns(runs, 'abc')).toThrow();
  });
});
