import { describe, expect, it } from 'vitest';

import {
  BRAND_ELEMENTS,
  createBrandElementSettings,
  filterBrandElements,
  parseBrandElementSource,
} from '../brandElements';
import { GT_BRAND_IDENTITY } from '../brandIdentity';

describe('BRAND_ELEMENTS', () => {
  it('covers digital, developer, social, editorial, event, and physical identity applications', () => {
    expect(BRAND_ELEMENTS.length).toBeGreaterThanOrEqual(84);
    expect(new Set(BRAND_ELEMENTS.map(({ id }) => id)).size).toBe(BRAND_ELEMENTS.length);
    expect(new Set(BRAND_ELEMENTS.map(({ category }) => category))).toEqual(
      new Set(['Digital', 'Product', 'Developer', 'Social', 'Editorial', 'Event', 'Physical'])
    );
    expect(BRAND_ELEMENTS.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'welcome-email',
        'onboarding-day3-no-api-key-email',
        'onboarding-day3-api-key-email',
        'onboarding-day3-live-email',
        'onboarding-day5-no-api-key-email',
        'onboarding-day6-api-key-email',
        'onboarding-day6-live-email',
        'auth-magic-link-email',
        'membership-invitation-email',
        'enterprise-intro-email',
        'billing-payment-failed-email',
        'usage-hard-limit-email',
        'locadex-setup-complete-email',
        'email-system-sheet',
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
        'auth-screen',
        'onboarding-checklist',
        'api-reference-hero',
        'video-thumbnail',
        'case-study-cover',
        'booth-wall',
      ])
    );
  });
});

describe('filterBrandElements', () => {
  it.each([
    ['email', ['welcome-email', 'auth-magic-link-email', 'email-signature']],
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

    expect(settings).not.toHaveProperty('eyebrow');
    expect(settings.headline).not.toBe(webCard.name);
  });
});
});

describe('parseBrandElementSource', () => {
  const welcome = BRAND_ELEMENTS.find(({ id }) => id === 'welcome-email')!;

  it('round-trips version 2 source without storing defaults', () => {
    const settings = createBrandElementSettings(welcome, GT_BRAND_IDENTITY);
    const parsed = parseBrandElementSource({ ...settings, elementId: 'welcome-email', schema: 'glyphfield.brand-element', version: 2 }, BRAND_ELEMENTS, 'x-post', GT_BRAND_IDENTITY);
    expect(parsed).toEqual({ elementId: 'welcome-email', overrides: {} });
  });

  it('applies version 1 settings to the selected element and keeps only edits', () => {
    const parsed = parseBrandElementSource({ headline: 'Audit element', layout: 'split', unknownField: true }, BRAND_ELEMENTS, 'welcome-email', GT_BRAND_IDENTITY);
    expect(parsed).toEqual({ elementId: 'welcome-email', overrides: { headline: 'Audit element', layout: 'split' } });
  });

  it('clamps numbers and rejects invalid values with field names', () => {
    expect(parseBrandElementSource({ artworkScale: 900 }, BRAND_ELEMENTS, 'web-card', GT_BRAND_IDENTITY).overrides).toEqual({ artworkScale: 200 });
    expect(() => parseBrandElementSource({ accentColor: 'red' }, BRAND_ELEMENTS, 'web-card', GT_BRAND_IDENTITY)).toThrow(/accentColor/);
    expect(() => parseBrandElementSource({ layout: 'grid' }, BRAND_ELEMENTS, 'web-card', GT_BRAND_IDENTITY)).toThrow(/layout/);
    expect(() => parseBrandElementSource({ showLogo: 'yes' }, BRAND_ELEMENTS, 'web-card', GT_BRAND_IDENTITY)).toThrow(/showLogo/);
    expect(() => parseBrandElementSource({ elementId: 'nope' }, BRAND_ELEMENTS, 'web-card', GT_BRAND_IDENTITY)).toThrow(/elementId/);
    expect(() => parseBrandElementSource({ version: 3 }, BRAND_ELEMENTS, 'web-card', GT_BRAND_IDENTITY)).toThrow(/version 3/);
  });
});
