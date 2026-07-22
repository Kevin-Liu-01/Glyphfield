import { describe, expect, it } from 'vitest';

import { formatOklch, normalizeHex } from '../color';

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
});
