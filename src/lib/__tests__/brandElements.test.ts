import { describe, expect, it } from 'vitest';

import { BRAND_ELEMENTS, filterBrandElements } from '../brandElements';

describe('BRAND_ELEMENTS', () => {
  it('covers digital, developer, social, editorial, event, and physical identity applications', () => {
    expect(BRAND_ELEMENTS.length).toBeGreaterThanOrEqual(28);
    expect(new Set(BRAND_ELEMENTS.map(({ id }) => id)).size).toBe(BRAND_ELEMENTS.length);
    expect(new Set(BRAND_ELEMENTS.map(({ category }) => category))).toEqual(
      new Set(['Digital', 'Developer', 'Social', 'Editorial', 'Event', 'Physical'])
    );
    expect(BRAND_ELEMENTS.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'welcome-email',
        'cli-banner',
        'ascii-mark',
        'x-post',
        'slide-title',
        'lanyard',
        'business-card',
        'web-card',
        'logo-background',
      ])
    );
  });
});

describe('filterBrandElements', () => {
  it.each([
    ['email', ['welcome-email', 'transactional-email', 'email-signature']],
    ['twitter', ['x-post']],
    ['ascii', ['ascii-mark', 'cli-banner']],
    ['lanyard', ['lanyard']],
  ])('finds %s applications across names and keywords', (query, expectedIds) => {
    expect(filterBrandElements(BRAND_ELEMENTS, query).map(({ id }) => id)).toEqual(
      expect.arrayContaining(expectedIds)
    );
  });
});
