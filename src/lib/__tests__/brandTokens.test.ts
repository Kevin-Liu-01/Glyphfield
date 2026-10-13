import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES, createBrandIdentity } from '../brandIdentity';
import {
  BRAND_TYPE_STEPS,
  brandCssVariables,
  brandDesignTokens,
  brandFontStack,
  brandTailwindTheme,
  brandTokenName,
  brandTypeScale,
  parseCubicBezier,
} from '../brandTokens';

const identity = {
  ...createBrandIdentity('Acme Labs', 'acme'),
  colors: [
    { hex: '#111111', id: 'ink', name: 'Ink', proportion: 30, role: 'Text' },
    { hex: '#FFFFFF', id: 'paper', name: 'Paper', proportion: 60, role: 'Background' },
    { hex: '#C6FF3D', id: 'emphasis', name: 'Lime', proportion: 10, role: 'Accent' },
  ],
  motion: [{ curve: 'cubic-bezier(0.2, 0.8, 0.2, 1)', description: 'Settle', durationMs: 600, id: 'Settle In', name: 'Settle', previewPath: '' }],
  typeScale: { basePx: 16, ratio: 1.25 },
};

describe('brandTypeScale', () => {
  it('builds a modular scale from caption to display', () => {
    const scale = brandTypeScale(identity);
    expect(scale.map(({ name }) => name)).toEqual(BRAND_TYPE_STEPS.map(({ name }) => name));
    expect(scale.find(({ name }) => name === 'body')).toMatchObject({ px: 16, rem: 1, step: 0 });
    expect(scale.find(({ name }) => name === 'lead')?.px).toBe(20);
    expect(scale.find(({ name }) => name === 'display')?.px).toBe(61.04);
    expect(brandTypeScale({}).find(({ name }) => name === 'small')?.px).toBe(12.8);
  });
});

describe('brandDesignTokens', () => {
  it('emits W3C DTCG 2025.10 color, font, size, typography and motion tokens', () => {
    const tokens = brandDesignTokens(identity) as Record<string, Record<string, Record<string, unknown>>>;
    expect(tokens.color!.emphasis).toEqual({
      $description: 'Accent',
      $extensions: { 'app.glyphfield': { name: 'Lime', proportion: 10 } },
      $type: 'color',
      $value: { colorSpace: 'srgb', components: [0.7765, 1, 0.2392], hex: '#c6ff3d' },
    });
    expect(tokens.size!.body).toEqual({ $type: 'dimension', $value: { unit: 'px', value: 16 } });
    expect(tokens.typography!.display).toMatchObject({
      $type: 'typography',
      $value: { fontFamily: '{font.family.display}', fontSize: '{size.display}', fontWeight: '{font.weight.display}' },
    });
    expect(tokens.motion!['settle-in']).toEqual({
      $description: 'Settle',
      duration: { $type: 'duration', $value: { unit: 'ms', value: 600 } },
      easing: { $type: 'cubicBezier', $value: [0.2, 0.8, 0.2, 1] },
    });
    expect(JSON.stringify(tokens)).not.toContain('undefined');
  });

  it('serializes every built-in identity', () => {
    for (const builtIn of BUILT_IN_BRAND_IDENTITIES) {
      const tokens = brandDesignTokens(builtIn) as { color: Record<string, unknown> };
      expect(Object.keys(tokens.color)).toEqual(builtIn.colors.map(({ id }) => id));
    }
  });
});

describe('CSS serializers', () => {
  it('writes --brand- custom properties and optional font faces', () => {
    const css = brandCssVariables(identity, { fontFaces: ['@font-face { font-family: "Acme"; }'] });
    expect(css).toContain('--brand-color-emphasis: #C6FF3D; /* Lime — Accent */');
    expect(css).toContain('--brand-text-body: 1rem; /* 16px */');
    expect(css).toContain('--brand-font-display: "Inter", ui-sans-serif, system-ui, sans-serif;');
    expect(css).toContain('--brand-ease-settle-in: cubic-bezier(0.2, 0.8, 0.2, 1);');
    expect(css.indexOf('@font-face')).toBeLessThan(css.indexOf(':root {'));
    expect(brandCssVariables(identity)).not.toContain('@font-face');
  });

  it('writes a Tailwind v4 @theme block with role-aware text steps', () => {
    const theme = brandTailwindTheme(identity);
    expect(theme).toContain('@theme {');
    expect(theme).toContain('  --color-ink: #111111;');
    expect(theme).toContain('  --font-code: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace;');
    expect(theme).toMatch(/--text-display: [\d.]+rem;\n {2}--text-display--line-height: [\d.]+;/);
    expect(theme).toContain('--radius-brand: 6px;');
  });
});

describe('helpers', () => {
  it('names tokens and font stacks predictably', () => {
    expect(brandTokenName('Settle In!')).toBe('settle-in');
    expect(brandFontStack('Arizona Flare', 'Display')).toEqual(['Arizona Flare', 'ui-serif', 'Georgia', 'serif']);
    expect(brandFontStack('Inter', 'Code').at(-1)).toBe('monospace');
    expect(parseCubicBezier('ease-out')).toBeNull();
  });
});
