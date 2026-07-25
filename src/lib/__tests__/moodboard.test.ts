import { describe, expect, it } from 'vitest';

import {
  isMoodboardAsset,
  moodboardFilename,
  moodboardAssets,
  MOODBOARD_EXPORT_PRESETS,
  resolveMoodboardExport,
} from '../moodboard';
import { GT_BRAND_IDENTITY } from '../brandIdentity';

describe('resolveMoodboardExport', () => {
  it.each([
    ['standard', 1600, 2000],
    ['retina', 2400, 3000],
    ['high', 3200, 4000],
    ['ultra', 4800, 6000],
  ] as const)('resolves the %s preset', (presetId, width, height) => {
    expect(resolveMoodboardExport(presetId, 2400, 'system')).toMatchObject({
      height,
      width,
    });
  });

  it.each([
    [300, 800, 1000],
    [1833.8, 1834, 2293],
    [8000, 4800, 6000],
  ])('clamps custom width %s while preserving the 4:5 board ratio', (input, width, height) => {
    expect(resolveMoodboardExport('custom', input, 'system')).toMatchObject({ height, width });
  });

  it.each([
    ['standard', 1600, 900],
    ['retina', 2400, 1350],
    ['high', 3200, 1800],
    ['ultra', 4800, 2700],
  ] as const)('preserves the 16:9 showcase ratio for %s', (presetId, width, height) => {
    expect(resolveMoodboardExport(presetId, 2400, 'showcase')).toMatchObject({
      height,
      width,
    });
  });

  it.each([
    ['standard', 1600, 2400],
    ['retina', 2400, 3600],
    ['high', 3200, 4800],
    ['ultra', 4800, 7200],
  ] as const)('preserves the 2:3 complete-catalog ratio for %s', (presetId, width, height) => {
    expect(resolveMoodboardExport(presetId, 2400, 'catalog')).toMatchObject({
      height,
      width,
    });
  });

  it('exposes presets in increasing resolution order', () => {
    expect(MOODBOARD_EXPORT_PRESETS.map(({ id }) => id)).toEqual([
      'standard',
      'retina',
      'high',
      'ultra',
      'custom',
    ]);
  });
});

describe('moodboardFilename', () => {
  it('includes the project and exact exported dimensions', () => {
    expect(moodboardFilename('General Translation', 3200, 4000)).toBe(
      'general-translation-moodboard-3200x4000.png'
    );
  });
});

describe('moodboardAssets', () => {
  it('only returns source-native or original library files', () => {
    const assets = moodboardAssets(GT_BRAND_IDENTITY);

    expect(assets.length).toBeGreaterThanOrEqual(6);
    expect(assets.every(isMoodboardAsset)).toBe(true);
    expect(assets.some(({ type }) => type === 'reference' || type === 'proof')).toBe(false);
    expect(assets.some(({ path }) => /\/references\/|\/screenshots\//.test(path))).toBe(false);
  });

  it('rejects browser captures even when they are tagged as native', () => {
    const screenshot = {
      ...GT_BRAND_IDENTITY.assets.find(({ id }) => id === 'library-hero')!,
      path: '/screenshots/browser-capture.png',
      tags: ['source-native'],
    };

    expect(isMoodboardAsset(screenshot)).toBe(false);
  });
});
