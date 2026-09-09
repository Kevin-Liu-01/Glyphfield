import { describe, expect, it } from 'vitest';

import {
  canvasTextLineX,
  layoutCanvasText,
  layoutCanvasTextBlock,
  trackedTextWidth,
} from '../canvasText';

const measureText = (value: string) => Array.from(value).length * 10;

describe('layoutCanvasText', () => {
  it('wraps on word boundaries when possible', () => {
    expect(layoutCanvasText('one two three', 74, measureText, 0, 'wrap')).toEqual([
      'one two',
      'three',
    ]);
  });

  it('breaks otherwise unbreakable text without dropping characters', () => {
    const value = 'abcdefghijkl';
    const lines = layoutCanvasText(value, 40, measureText, 0, 'wrap');

    expect(lines).toEqual(['abcd', 'efgh', 'ijkl']);
    expect(lines.join('')).toBe(value);
  });

  it('keeps extended grapheme clusters intact when emergency wrapping', () => {
    const family = '👨‍👩‍👧‍👦';
    const lines = layoutCanvasText(`${family}ab`, 12, measureText, 0, 'wrap');

    expect(lines[0]).toBe(family);
    expect(lines.slice(1).join('')).toBe('ab');
  });

  it('preserves authored line breaks with wrapping on or off', () => {
    expect(layoutCanvasText('first\nsecond', 200, measureText, 0, 'wrap')).toEqual([
      'first',
      'second',
    ]);
    expect(layoutCanvasText('first\nsecond', 20, measureText, 0, 'nowrap')).toEqual([
      'first',
      'second',
    ]);
  });

  it('uses native whole-line metrics when the canvas provides them', () => {
    const measureLine = (value: string) => value === 'AV' ? 18 : measureText(value);

    expect(layoutCanvasText('AVX', 28, measureText, 0, 'wrap', measureLine)).toEqual([
      'AV',
      'X',
    ]);
  });
});

describe('trackedTextWidth', () => {
  it('includes spacing only between grapheme clusters', () => {
    expect(trackedTextWidth('abc', measureText, 2)).toBe(34);
    expect(trackedTextWidth('', measureText, 2)).toBe(0);
  });
});

describe('canvasTextLineX', () => {
  it('positions left, centered, and right-aligned lines inside the text area', () => {
    expect(canvasTextLineX('left', 20, 200, 80)).toBe(20);
    expect(canvasTextLineX('center', 20, 200, 80)).toBe(80);
    expect(canvasTextLineX('right', 20, 200, 80)).toBe(140);
  });
});

describe('Design Lab intrinsic text block', () => {
  const measureLine = (value: string) => Array.from(value).reduce((sum, character) => sum + (character === 'W' ? 40 : character === 'M' ? 35 : 9), 0);

  it('wraps a tiny flex item at its widest grapheme, not the selection width', () => {
    const layout = layoutCanvasTextBlock({
      value: 'MWiiiiii', boxWidth: 5, boxHeight: 2, fontSize: 40, lineHeight: 48,
      letterSpacing: 0, measureLine, measureText: measureLine, wrap: 'wrap',
    });
    expect(layout.lines).toEqual(['M', 'W', 'iiii', 'ii']);
    expect(layout).toMatchObject({ height: 192, offsetY: -76, lineOffsetY: 0 });
  });

  it('keeps the one-em grid minimum separate from intrinsic multi-line height', () => {
    const layout = layoutCanvasTextBlock({
      value: 'AB\nCD', boxWidth: 5, boxHeight: 2, fontSize: 40, lineHeight: 48,
      letterSpacing: 0, measureLine, measureText: measureLine, wrap: 'nowrap',
    });
    expect(layout).toEqual({ lines: ['AB', 'CD'], height: 96, offsetY: -28, lineOffsetY: 0 });
  });
});
