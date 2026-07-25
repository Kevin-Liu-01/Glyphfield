import { describe, expect, it } from 'vitest';

import {
  formatOklch,
  hexToHsv,
  hsvToHex,
  normalizeHex,
  oklchToHex,
  parseOklch,
} from '../color';

describe('normalizeHex', () => {
  it('normalizes supported shorthand and full HEX values', () => {
    expect(normalizeHex('#fff')).toBe('#FFFFFF');
    expect(normalizeHex('111111')).toBe('#111111');
  });
});

describe('formatOklch', () => {
  it('converts neutral endpoints and a chromatic color to stable OKLCH labels', () => {
    expect(formatOklch('#FFFFFF')).toBe('oklch(100% 0 0)');
    expect(formatOklch('#000000')).toBe('oklch(0% 0 0)');
    expect(formatOklch('#3B82F6')).toBe('oklch(62.3% 0.188 259.8)');
  });

  it('accepts editable OKLCH syntax and converts it back to a displayable HEX color', () => {
    const parsed = parseOklch('oklch(62.3% 0.188 259.8)');
    expect(parsed).not.toBeNull();
    expect(oklchToHex(parsed!)).toBe('#3B82F6');
    expect(parseOklch('rgb(20 30 40)')).toBeNull();
  });
});

describe('HSV color editing', () => {
  it('round-trips primary colors and preserves neutral brightness', () => {
    expect(hexToHsv('#FF0000')).toEqual({ hue: 0, saturation: 1, value: 1 });
    expect(hsvToHex(120, 1, 1)).toBe('#00FF00');
    expect(hsvToHex(240, 1, 1)).toBe('#0000FF');
    expect(hsvToHex(25, 0, 0.5)).toBe('#808080');
  });
});
