// @vitest-environment happy-dom

import { afterEach, describe, expect, it } from 'vitest';
import { canvasInsertionColors } from '../canvasInsertionColors';

const originalClass = document.documentElement.className;
afterEach(() => { document.documentElement.className = originalClass; });

describe('canvas insertion colors', () => {
  it('uses black content with a white outline in light mode', () => {
    document.documentElement.className = 'light';
    expect(canvasInsertionColors()).toEqual({ color: '#000000', outlineColor: '#FFFFFF' });
  });

  it('uses white content with a black outline in dark mode', () => {
    document.documentElement.className = 'dark';
    expect(canvasInsertionColors()).toEqual({ color: '#FFFFFF', outlineColor: '#000000' });
  });

  it('samples each insertion without changing colors captured for earlier layers', () => {
    document.documentElement.className = 'light';
    const first = canvasInsertionColors();
    document.documentElement.className = 'dark';
    const second = canvasInsertionColors();
    expect(first.color).toBe('#000000');
    expect(second.color).toBe('#FFFFFF');
    second.color = '#AABBCC';
    expect(canvasInsertionColors().color).toBe('#FFFFFF');
  });
});
