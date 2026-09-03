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
    ]);
    expect(studioArtboardPresetForSize(1200, 630)?.label).toBe('OG Social');
    expect(studioArtboardPresetForSize(1080, 1920)?.label).toBe('Story');
    expect(studioArtboardPresetForSize(1234, 777)).toBeUndefined();
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
