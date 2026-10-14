import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES, createBrandIdentity, GT_BRAND_IDENTITY, type BrandIdentity } from '../brandIdentity';
import { colorContrastRatio, hexToOklch, oklchInSrgbGamut } from '../color';
import {
  apcaContrast,
  apcaLevel,
  COLOR_SCALE_STEPS,
  colorScale,
  confusableColorPairs,
  contrastMatrix,
  defaultSemanticMapping,
  normalizeProportions,
  parseColorRef,
  proportionSummary,
  removePaletteColor,
  resolveColorRef,
  resolveSemanticColors,
  semanticContrastChecks,
  setColorProportion,
  setColorScaleSettings,
  setSemanticOverride,
  simulateColorVision,
  toggleColorPairing,
  wcagLevel,
} from '../colorSystem';

const acme: BrandIdentity = {
  ...createBrandIdentity('Acme', 'acme'),
  colors: [
    { hex: '#111111', id: 'ink', name: 'Ink', proportion: 30, role: 'Text' },
    { hex: '#FFFFFF', id: 'paper', name: 'Paper', proportion: 60, role: 'Background' },
    { hex: '#F2F2F2', id: 'muted', name: 'Mist', role: 'Quiet surfaces' },
    { hex: '#635BFF', id: 'emphasis', name: 'Blurple', proportion: 10, role: 'Accent' },
    { hex: '#D62828', id: 'error', name: 'Red', role: 'Errors' },
    { hex: '#2A9D2A', id: 'success', name: 'Green', role: 'Success' },
  ],
};

describe('colorScale', () => {
  it('builds eleven evenly spaced, in-gamut OKLCH steps anchored on the brand color', () => {
    const scale = colorScale('#635BFF');
    expect(scale.map(({ step }) => step)).toEqual([...COLOR_SCALE_STEPS]);
    const anchored = scale.filter(({ anchored }) => anchored);
    expect(anchored).toHaveLength(1);
    expect(anchored[0]!.hex).toBe('#635BFF');
    const free = scale.filter(({ anchored }) => !anchored);
    for (const swatch of scale) {
      expect(swatch.hex).toMatch(/^#[\dA-F]{6}$/);
      expect(oklchInSrgbGamut({ chroma: swatch.chroma, hue: swatch.hue, lightness: swatch.lightness })).toBe(true);
    }
    const lightness = free.map(({ lightness }) => lightness);
    expect([...lightness].sort((first, second) => second - first)).toEqual(lightness);
    expect(scale[0]!.lightness).toBeCloseTo(0.975, 3);
    expect(scale.at(-1)!.lightness).toBeCloseTo(0.22, 3);
    const gaps = scale.slice(1).map((swatch, index) => scale[index]!.lightness - swatch.lightness).filter((_, index) => !scale[index]!.anchored && !scale[index + 1]!.anchored);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 5);
  });

  it('honors chroma, lightness range, hue shift and anchoring settings', () => {
    const neutral = colorScale('#635BFF', { anchor: false, chroma: 0 });
    expect(neutral.every(({ chroma }) => chroma < 0.0001)).toBe(true);
    const narrow = colorScale('#635BFF', { anchor: false, darkest: 0.4, lightest: 0.9 });
    expect(narrow[0]!.lightness).toBeCloseTo(0.9, 3);
    expect(narrow.at(-1)!.lightness).toBeCloseTo(0.4, 3);
    const shifted = colorScale('#635BFF', { anchor: false, hueShift: 40 });
    expect(shifted.at(-1)!.hue - shifted[0]!.hue).toBeGreaterThan(20);
  });
});

describe('color refs', () => {
  it('parses palette ids and scale steps', () => {
    expect(parseColorRef('ink')).toEqual({ id: 'ink' });
    expect(parseColorRef('brand-lime.700')).toEqual({ id: 'brand-lime', step: 700 });
    expect(parseColorRef('ink.650')).toBeNull();
    expect(parseColorRef('Ink')).toBeNull();
  });

  it('resolves refs through the identity scale settings', () => {
    expect(resolveColorRef(acme, 'emphasis')).toBe('#635BFF');
    expect(resolveColorRef(acme, 'missing')).toBeNull();
    const step = resolveColorRef(acme, 'emphasis.900');
    const tuned = { ...acme, colorSystem: setColorScaleSettings(acme, 'emphasis', { darkest: 0.1 }) };
    expect(resolveColorRef(tuned, 'emphasis.950')).not.toBe(resolveColorRef(acme, 'emphasis.950'));
    expect(step).toMatch(/^#[\dA-F]{6}$/);
  });

  it('drops scale settings that equal the defaults', () => {
    expect(setColorScaleSettings(acme, 'ink', { chroma: 100, lightest: 0.975 })).toBeUndefined();
    expect(setColorScaleSettings(acme, 'ink', { chroma: 50 })).toEqual({ scales: [{ chroma: 50, id: 'ink' }] });
  });
});

describe('contrast', () => {
  it('grades WCAG ratios and APCA lightness contrast', () => {
    expect(wcagLevel(7.2)).toBe('AAA');
    expect(wcagLevel(4.5)).toBe('AA');
    expect(wcagLevel(3.1)).toBe('AA-large');
    expect(wcagLevel(2)).toBe('fail');
    expect(apcaContrast('#000000', '#FFFFFF')).toBeCloseTo(106.04, 1);
    expect(apcaContrast('#FFFFFF', '#000000')).toBeCloseTo(-107.88, 1);
    expect(apcaContrast('#777777', '#777777')).toBe(0);
    expect(apcaLevel(-80)).toBe('body');
    expect(apcaLevel(50)).toBe('large');
  });

  it('builds a square foreground × background matrix', () => {
    const matrix = contrastMatrix(acme.colors);
    expect(matrix).toHaveLength(acme.colors.length);
    expect(matrix[0]![1]).toMatchObject({ background: 'paper', foreground: 'ink', wcag: 'AAA' });
    expect(matrix[0]![0]!.ratio).toBeCloseTo(1, 5);
  });

  it('approves pairings at the level their contrast reaches and refuses unreadable ones', () => {
    const added = toggleColorPairing([], acme.colors, 'ink', 'paper');
    expect(added).toEqual([{ background: 'paper', foreground: 'ink', level: 'AA', usage: 'Ink text on Paper' }]);
    expect(toggleColorPairing(added, acme.colors, 'ink', 'paper')).toEqual([]);
    expect(toggleColorPairing([], acme.colors, 'muted', 'paper')).toEqual([]);
  });
});

describe('semantic roles', () => {
  it('derives readable light and dark mappings for every built-in identity', () => {
    for (const identity of BUILT_IN_BRAND_IDENTITIES) {
      for (const mode of ['light', 'dark'] as const) {
        const resolved = resolveSemanticColors(identity, mode);
        const text = semanticContrastChecks(resolved).find((check) => check.foreground === 'foreground' && check.background === 'background')!;
        expect(text.passes, `${identity.id} ${mode}`).toBe(true);
        expect(resolved['foreground-muted'].hex).toMatch(/^#[\dA-F]{6}$/);
      }
      const dark = resolveSemanticColors(identity, 'dark');
      expect(hexToOklch(dark.background.hex).lightness, identity.id).toBeLessThan(0.45);
    }
  });

  it('keeps muted text readable and the primary label legible', () => {
    const light = resolveSemanticColors(acme, 'light');
    expect(colorContrastRatio(light['foreground-muted'].hex, light.background.hex)).toBeGreaterThanOrEqual(4.5);
    expect(light['primary-foreground'].ref).toBe('paper');
    const dark = defaultSemanticMapping(acme, 'dark');
    expect(dark.foreground).toBe('paper');
    expect(dark.background).toBe('ink');
  });

  it('applies valid overrides, ignores broken ones, and drops overrides equal to the default', () => {
    const colorSystem = { dark: { primary: 'nope.700' }, light: { primary: 'emphasis.700' } };
    const resolved = resolveSemanticColors({ ...acme, colorSystem }, 'light');
    expect(resolved.primary).toMatchObject({ overridden: true, ref: 'emphasis.700' });
    expect(resolveSemanticColors({ ...acme, colorSystem }, 'dark').primary.overridden).toBe(false);
    const defaults = defaultSemanticMapping(acme, 'light');
    expect(setSemanticOverride({ ...acme, colorSystem: { light: { primary: 'ink' } } }, 'light', 'primary', defaults.primary)).toBeUndefined();
    expect(setSemanticOverride(acme, 'dark', 'border', 'ink.700')).toEqual({ dark: { border: 'ink.700' } });
  });
});

describe('colour vision', () => {
  it('keeps neutrals and collapses red/green for deuteranopia', () => {
    expect(simulateColorVision('#FFFFFF', 'protanopia')).toBe('#FFFFFF');
    expect(simulateColorVision('#000000', 'deuteranopia')).toBe('#000000');
    const gray = simulateColorVision('#D62828', 'achromatopsia');
    expect(gray.slice(1, 3)).toBe(gray.slice(3, 5));
    const pairs = confusableColorPairs([{ hex: '#D62828', id: 'red' }, { hex: '#7A8A00', id: 'olive' }, { hex: '#FFFFFF', id: 'white' }], 'deuteranopia', 0.1);
    expect(pairs.map(({ first, second }) => `${first}/${second}`)).toContain('red/olive');
    expect(confusableColorPairs(acme.colors, 'normal')).toEqual([]);
  });
});

describe('proportion', () => {
  it('normalizes to exactly 100 and rebalances the others', () => {
    const normalized = normalizeProportions([{ proportion: 1 }, { proportion: 1 }, { proportion: 1 }]);
    expect(normalized.map(({ proportion }) => proportion)).toEqual([34, 33, 33]);
    const rebalanced = setColorProportion(acme.colors, 'emphasis', 20, true);
    expect(rebalanced.reduce((sum, color) => sum + (color.proportion ?? 0), 0)).toBe(100);
    expect(rebalanced.find(({ id }) => id === 'emphasis')!.proportion).toBe(20);
    expect(rebalanced.find(({ id }) => id === 'paper')!.proportion).toBeGreaterThan(rebalanced.find(({ id }) => id === 'ink')!.proportion!);
    expect(setColorProportion(acme.colors, 'ink', 50, false).find(({ id }) => id === 'paper')!.proportion).toBe(60);
    expect(proportionSummary(acme.colors)).toMatchObject({ accent: 10, dominant: { id: 'paper', share: 60 }, passes: true, total: 100 });
    expect(proportionSummary(GT_BRAND_IDENTITY.colors).passes).toBe(true);
  });
});

describe('palette editing', () => {
  it('removes a color with its pairings and overrides but never a core color', () => {
    const identity: BrandIdentity = {
      ...acme,
      colorPairings: [{ background: 'paper', foreground: 'error', level: 'AA', usage: 'Errors' }, { background: 'paper', foreground: 'ink', level: 'AA', usage: 'Body' }],
      colorSystem: { light: { negative: 'error.700', primary: 'emphasis' }, scales: [{ chroma: 80, id: 'error' }] },
    };
    const next = removePaletteColor(identity, 'error');
    expect(next.colors.map(({ id }) => id)).not.toContain('error');
    expect(next.colorPairings).toEqual([{ background: 'paper', foreground: 'ink', level: 'AA', usage: 'Body' }]);
    expect(next.colorSystem).toEqual({ light: { primary: 'emphasis' } });
    expect(removePaletteColor(identity, 'ink')).toBe(identity);
  });
});
