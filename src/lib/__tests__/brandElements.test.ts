import { describe, expect, it } from 'vitest';

import {
  BRAND_ELEMENTS,
  createBrandElementSettings,
  filterBrandElements,
} from '../brandElements';
import { GT_BRAND_IDENTITY } from '../brandIdentity';

describe('BRAND_ELEMENTS', () => {
  it('covers digital, developer, social, editorial, event, and physical identity applications', () => {
    expect(BRAND_ELEMENTS.length).toBeGreaterThanOrEqual(47);
    expect(new Set(BRAND_ELEMENTS.map(({ id }) => id)).size).toBe(BRAND_ELEMENTS.length);
    expect(new Set(BRAND_ELEMENTS.map(({ category }) => category))).toEqual(
      new Set(['Digital', 'Product', 'Developer', 'Social', 'Editorial', 'Event', 'Physical'])
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
        'navigation-bar',
        'form-controls',
        'data-table',
        'pricing-card',
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

describe('createBrandElementSettings', () => {
  it('provides complete editable settings for every catalog element', () => {
    for (const element of BRAND_ELEMENTS) {
      const settings = createBrandElementSettings(element, GT_BRAND_IDENTITY);

      expect(settings.headline.length).toBeGreaterThan(0);
      expect(settings.backgroundColor).toMatch(/^#[\dA-F]{6}$/i);
      expect(settings.foregroundColor).toMatch(/^#[\dA-F]{6}$/i);
      expect(settings.accentColor).toMatch(/^#[\dA-F]{6}$/i);
      expect(settings.artworkScale).toBeGreaterThanOrEqual(40);
      expect(settings.patternOpacity).toBeGreaterThanOrEqual(0);
      expect(['split', 'stacked', 'centered']).toContain(settings.layout);
      expect(['none', 'dots', 'grid', 'dither']).toContain(settings.pattern);
    }
  });

  it('keeps editor-only template names out of default web artwork', () => {
    const webCard = BRAND_ELEMENTS.find(({ id }) => id === 'web-card')!;
    const settings = createBrandElementSettings(webCard, GT_BRAND_IDENTITY);

    expect(settings.eyebrow).toBe('');
    expect(settings.headline).not.toBe(webCard.name);
  });
});
});
