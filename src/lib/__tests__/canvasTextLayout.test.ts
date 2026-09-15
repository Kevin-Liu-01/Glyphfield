import { describe, expect, it, vi } from 'vitest';
import { canvasTextRangeRect } from '../canvasTextLayout';

function rect(x: number, y: number, width: number, height: number) {
  return { x, y, width, height, top: y, left: x, right: x + width, bottom: y + height } as DOMRect;
}

function range(rects: DOMRect[], union: DOMRect) {
  return { getClientRects: () => rects as unknown as DOMRectList, getBoundingClientRect: vi.fn(() => union) };
}

describe('native text range geometry', () => {
  it('ignores Safari 26.4 zero-width previous-line carets at a soft wrap', () => {
    // Actual native Safari geometry for the m in a wrapped "most".
    const caret = rect(955.3922, 403.25, 0, 18.9);
    const glyph = rect(688.9922, 418.55, 13.5, 18.9);
    const selection = range([caret, glyph], rect(688.9922, 403.25, 266.4, 34.2));
    expect(canvasTextRangeRect(selection)).toBe(glyph);
    expect(selection.getBoundingClientRect).not.toHaveBeenCalled();
  });

  it('retains ordinary and right-to-left painted glyph positions', () => {
    const glyph = rect(200, 80, 14, 22);
    expect(canvasTextRangeRect(range([glyph], glyph))).toBe(glyph);
  });

  it('keeps a trailing whitespace caret when no painted fragment exists', () => {
    const caret = rect(40, 60, 0, 20);
    expect(canvasTextRangeRect(range([caret], caret))).toBe(caret);
  });

  it('retains empty geometry for ranges without layout', () => {
    const empty = rect(0, 0, 0, 0);
    expect(canvasTextRangeRect(range([], empty))).toBe(empty);
  });
});
