import { describe, expect, it } from 'vitest';

import {
  normalizeStudioArtboardDimensions,
  STUDIO_ARTBOARD_PRESETS,
  studioArtboardPresetForSize,
} from '../artboardSizes';

describe('shared Studio artboard sizes', () => {
  it('keeps one complete preset vocabulary for Design Lab and Animation Studio', () => {
    expect(STUDIO_ARTBOARD_PRESETS.map(({ id }) => id)).toEqual([
      'wide',
      'square',
      'opengraph',
      'banner',
      'portrait',
      'story',
      'portrait-3-4',
      'portrait-2-3',
      'portrait-1-2',
    ]);
    expect(studioArtboardPresetForSize(1200, 630)?.label).toBe('OG Social');
    expect(studioArtboardPresetForSize(1080, 1920)?.label).toBe('Story');
    expect(studioArtboardPresetForSize(1234, 777)).toBeUndefined();
  });

  it('adds a complete third row of distinct portrait ratios', () => {
    const portraitRow = STUDIO_ARTBOARD_PRESETS.slice(6);
    expect(portraitRow.map(({ label, width, height }) => ({ label, width, height }))).toEqual([
      { label: '3:4', width: 1080, height: 1440 },
      { label: '2:3', width: 1080, height: 1620 },
      { label: '1:2', width: 1080, height: 2160 },
    ]);
    for (const preset of portraitRow) {
      expect(preset.height).toBeGreaterThan(preset.width);
      expect(studioArtboardPresetForSize(preset.width, preset.height)).toBe(preset);
      expect(normalizeStudioArtboardDimensions(preset)).toEqual({
        width: preset.width,
        height: preset.height,
      });
    }
    expect(new Set(STUDIO_ARTBOARD_PRESETS.map(({ width, height }) => width / height)).size)
      .toBe(STUDIO_ARTBOARD_PRESETS.length);
  });

  it('rounds and clamps custom dimensions without coupling width and height', () => {
    expect(normalizeStudioArtboardDimensions({ height: 777.7, width: 1234.4 })).toEqual({
      height: 778,
      width: 1234,
    });
    expect(normalizeStudioArtboardDimensions({ height: 10, width: 99999 })).toEqual({
      height: 120,
      width: 4096,
    });
  });
});
