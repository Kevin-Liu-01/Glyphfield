import { describe, expect, it } from 'vitest';

import {
  moodboardFilename,
  MOODBOARD_EXPORT_PRESETS,
  resolveMoodboardExport,
} from '../moodboard';

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
