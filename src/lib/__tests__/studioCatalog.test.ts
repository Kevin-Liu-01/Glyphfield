import { describe, expect, it } from 'vitest';

import {
  filterStudioTools,
  getProjectTabDensity,
  getProjectTabScrollCues,
  STUDIO_TOOLS,
} from '../studioCatalog';

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
    expect(filterStudioTools(STUDIO_TOOLS, 'dither').map(({ id }) => id)).toContain(
      'backgrounds'
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

describe('getProjectTabDensity', () => {
  it.each([
    [1, 'full'],
    [5, 'full'],
    [6, 'compact'],
    [9, 'compact'],
    [10, 'marks'],
    [13, 'marks'],
    [14, 'scroll'],
    [18, 'scroll'],
  ])('uses a delayed fallback presentation for %i open tabs', (tabCount, density) => {
    expect(getProjectTabDensity(tabCount)).toBe(density);
  });

  it.each([
    [3, 620, 1280, 'full'],
    [4, 620, 1280, 'compact'],
    [5, 620, 1280, 'compact'],
    [6, 620, 1280, 'marks'],
    [11, 620, 1280, 'marks'],
    [12, 620, 1280, 'scroll'],
    [4, 1100, 1800, 'full'],
  ])(
    'uses %i tabs in %ipx of rail space at a %ipx viewport as %s',
    (tabCount, availableWidth, viewportWidth, density) => {
      expect(getProjectTabDensity(tabCount, availableWidth, viewportWidth)).toBe(density);
    }
  );
});

describe('getProjectTabScrollCues', () => {
  it.each([
    [0, 620, 620, false, false],
    [0, 620, 638, false, false],
    [0, 620, 639, false, true],
    [24, 620, 660, true, false],
  ])(
    'for %ipx scroll within %ipx of %ipx shows left=%s and right=%s',
    (scrollLeft, clientWidth, scrollWidth, canScrollLeft, canScrollRight) => {
      expect(getProjectTabScrollCues(scrollLeft, clientWidth, scrollWidth)).toEqual({
        canScrollLeft,
        canScrollRight,
      });
    }
  );
});
