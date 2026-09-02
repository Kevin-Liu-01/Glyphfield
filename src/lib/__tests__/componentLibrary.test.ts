import { describe, expect, it } from 'vitest';

import { GT_BRAND_IDENTITY } from '@/lib/brandIdentity';
import {
  COMPONENT_FAMILY_OPTIONS,
  COMPONENT_PATTERNS,
  componentBrandPalette,
  componentPreviewStyle,
  getFirstComponentPattern,
} from '@/lib/componentLibrary';

describe('component library model', () => {
  it('keeps every pattern attached to a selectable family', () => {
    const families = new Set(COMPONENT_FAMILY_OPTIONS.map(({ value }) => value));
    expect(COMPONENT_PATTERNS).toHaveLength(32);
    expect(COMPONENT_PATTERNS.every(({ family }) => families.has(family))).toBe(true);
    expect(getFirstComponentPattern('forms')).toBe('inputs');
    expect(getFirstComponentPattern('content')).toBe('article-body');
  });

  it('derives a complete, readable palette from the identity', () => {
    const palette = componentBrandPalette(GT_BRAND_IDENTITY);
    expect(palette).toMatchObject({
      accent: expect.stringMatching(/^#[\dA-F]{6}$/i),
      accentForeground: expect.stringMatching(/^#[\dA-F]{6}$/i),
      background: expect.stringMatching(/^#[\dA-F]{6}$/i),
      foreground: expect.stringMatching(/^#[\dA-F]{6}$/i),
    });
    expect(Object.values(palette)).toHaveLength(10);
  });

  it.each(['base', 'soft', 'inverse'] as const)('builds stable %s preview tokens', (surface) => {
    const palette = componentBrandPalette(GT_BRAND_IDENTITY);
    const style = componentPreviewStyle(12, GT_BRAND_IDENTITY, {
      borderWidth: 0.5,
      elevation: 'strong',
      letterSpacing: -2,
      palette,
      surface,
      textScale: 112,
    });
    const tokens = style as unknown as Record<string, number | string | undefined>;

    expect(style).toMatchObject({
      '--component-border-width': '0.5px',
      '--component-letter-spacing': '-0.02em',
      '--component-radius': '12px',
      '--component-text-scale': 1.12,
    });
    expect(tokens['--component-elevation']).toContain('0 22px 55px');
    expect(tokens['--background']).toMatch(/\d/);
    expect(style.fontFamily).toBeTruthy();
  });

  it('supports flat and default appearances', () => {
    const palette = componentBrandPalette(GT_BRAND_IDENTITY);
    const defaults = componentPreviewStyle(0, GT_BRAND_IDENTITY) as unknown as Record<string, unknown>;
    const flat = componentPreviewStyle(4, GT_BRAND_IDENTITY, {
      borderWidth: 2,
      elevation: 'none',
      letterSpacing: 0,
      palette,
      surface: 'base',
      textScale: 100,
    }) as unknown as Record<string, unknown>;
    expect(defaults['--component-border-width']).toBe('1px');
    expect(flat['--component-elevation']).toBe('none');
  });
});
