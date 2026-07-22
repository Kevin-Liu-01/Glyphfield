import { describe, expect, it } from 'vitest';

import { filterStudioTools, STUDIO_TOOLS } from '../studioCatalog';

describe('filterStudioTools', () => {
  it('finds tools by name, category, and capability keywords', () => {
    expect(filterStudioTools(STUDIO_TOOLS, 'terminal').map(({ id }) => id)).toContain(
      'terminal'
    );
    expect(filterStudioTools(STUDIO_TOOLS, 'open graph').map(({ id }) => id)).toContain(
      'opengraph'
    );
    expect(filterStudioTools(STUDIO_TOOLS, 'font upload').map(({ id }) => id)).toEqual(
      expect.arrayContaining(['opengraph', 'typography'])
    );
    expect(filterStudioTools(STUDIO_TOOLS, 'moodboard').map(({ id }) => id)).toContain(
      'design-board'
    );
    expect(filterStudioTools(STUDIO_TOOLS, 'shader').map(({ id }) => id)).toContain(
      'logo-shader'
    );
    expect(filterStudioTools(STUDIO_TOOLS, 'lanyard').map(({ id }) => id)).toContain(
      'brand-elements'
    );
  });

  it('returns the full navigable catalog for an empty query', () => {
    expect(filterStudioTools(STUDIO_TOOLS, '')).toHaveLength(STUDIO_TOOLS.length);
    expect(new Set(STUDIO_TOOLS.map(({ id }) => id)).size).toBe(STUDIO_TOOLS.length);
  });
});
