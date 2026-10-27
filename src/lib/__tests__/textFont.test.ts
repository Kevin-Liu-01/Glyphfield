import { describe, expect, it } from 'vitest';

import { brandTypographyFamily, STARTER_BRAND_IDENTITY } from '../brandIdentity';
import { resolveTextRunStyle, textFontFamily, textLayerFont, type CompositionTextLayer } from '../designLabModel';
import { applyDesignLabLayerStyle, extractDesignLabLayerStyle } from '../designLabStyle';
import { clearTextStyleProperties, formatTextRange } from '../richText';

const identity = STARTER_BRAND_IDENTITY;
const text = (overrides: Partial<CompositionTextLayer> = {}): CompositionTextLayer => ({
  align: 'center', id: 'text-a', lineHeight: 1, name: 'Text', tracking: 0, transform: { scale: 1, x: 0, y: 0 },
  value: 'Hello world', visible: true, weight: 400, wrap: 'wrap', ...overrides,
});

describe('text layer fonts', () => {
  it('draws a picked font, falls back to the role for an unknown id, and lets a run role win', () => {
    expect(textFontFamily(identity, text())).toBe(brandTypographyFamily(identity, 'Display'));
    expect(textFontFamily(identity, text({ fontId: 'katagami-sans-variable' }))).toBe('Katagami Sans');
    expect(textFontFamily(identity, text({ fontId: 'removed-font', fontRole: 'Code' }))).toBe(brandTypographyFamily(identity, 'Code'));
    const layer = text({ fontId: 'katagami-sans-variable' });
    expect(textFontFamily(identity, layer, { fontRole: 'Body' })).toBe(brandTypographyFamily(identity, 'Body'));
    expect(textFontFamily(identity, layer, { fontId: 'katagami-mono-variable' })).toBe('Katagami Mono');
  });

  it('resolves weight against the picked font, not the role font', () => {
    const layer = text({ fontId: 'katagami-serif-variable', weight: 900 });
    expect(textLayerFont(identity, layer)).toEqual({ family: 'Katagami Serif', weight: 900 });
    expect(resolveTextRunStyle(layer, identity, 900, { weight: 120 }).fontWeight).toBe(120);
    expect(textLayerFont(identity, text({ fontId: 'katagami-mono-variable', weight: 900 })).weight).toBe(700);
  });

  it('treats a role and a font as one setting in ranges, whole-box edits and pasted styles', () => {
    const picked = formatTextRange('Hello world', undefined, { start: 0, end: 5 }, { fontId: 'katagami-sans-variable' });
    const role = formatTextRange('Hello world', picked, { start: 0, end: 5 }, { fontRole: 'Code' });
    expect(textFontFamily(identity, text({ runs: role }), role[0]!.style)).toBe(brandTypographyFamily(identity, 'Code'));
    expect(clearTextStyleProperties([{ start: 0, end: 5, style: { fontRole: 'Code', color: '#FF0000' } }], { fontId: 'katagami-sans-variable' }))
      .toEqual([{ start: 0, end: 5, style: { color: '#FF0000' } }]);
    const pasted = applyDesignLabLayerStyle(text({ fontId: 'katagami-sans-variable' }), extractDesignLabLayerStyle(text({ fontRole: 'Body' }))).layer;
    expect(textFontFamily(identity, pasted)).toBe(brandTypographyFamily(identity, 'Body'));
  });
});
