import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  COMPONENT_PATTERN_ICONS,
  ComponentPatternIcon,
} from '@/components/ComponentLibraryCatalog';
import { COMPONENT_PATTERNS } from '@/lib/componentLibrary';

describe('ComponentLibraryCatalog', () => {
  it('assigns a distinct icon to every component pattern', () => {
    const patternIds = COMPONENT_PATTERNS.map(({ id }) => id).sort();
    const mappedPatternIds = Object.keys(COMPONENT_PATTERN_ICONS).sort();

    expect(mappedPatternIds).toEqual(patternIds);
    expect(new Set(Object.values(COMPONENT_PATTERN_ICONS))).toHaveLength(COMPONENT_PATTERNS.length);
  });

  it('renders catalog icons as decorative SVGs', () => {
    const markup = renderToStaticMarkup(
      <ComponentPatternIcon className='catalog-glyph' pattern='buttons' />
    );

    expect(markup).toContain('<svg');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('catalog-glyph');
  });
});
