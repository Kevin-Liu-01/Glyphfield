import { describe, expect, it } from 'vitest';

import { DEFAULT_BACKGROUND_SETTINGS } from '../backgroundSvg';
import {
  buildSurfaceStickerSvg,
  normalizeStickerFinish,
  STICKER_FINISH_PRESETS,
} from '../surfaceSticker';

describe('surface stickers', () => {
  it('offers a broad set of production-inspired static finishes', () => {
    expect(STICKER_FINISH_PRESETS).toHaveLength(12);
    expect(STICKER_FINISH_PRESETS.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'holo-vinyl',
      'prismatic',
      'mirror-chrome',
      'retroreflective',
      'epoxy-dome',
      'embossed-foil',
    ]));
  });

  it('clamps editable finish values', () => {
    expect(normalizeStickerFinish({ depth: 200, edgeWidth: -3, intensity: -10, texture: 140 })).toMatchObject({
      depth: 100,
      edgeWidth: 2,
      intensity: 0,
      texture: 100,
    });
  });

  it('builds a portable die-cut SVG with the surface, laminate, edge, and shadow layers', () => {
    const svg = buildSurfaceStickerSvg(
      { ...DEFAULT_BACKGROUND_SETTINGS, gradient: 'bloom' },
      {
        finish: { presetId: 'holo-vinyl' },
        logo: 'data:image/svg+xml;base64,MARK',
        name: 'Glyphfield',
      }
    );

    expect(svg).toContain('data-sticker-finish="holo-vinyl"');
    expect(svg).toContain('id="sticker-cut"');
    expect(svg).toContain('id="sticker-art"');
    expect(svg).toContain('operator="dilate"');
    expect(svg).toContain('data-sticker-finish-layer="spectrum"');
    expect(svg).toContain('data:image/svg+xml;base64,MARK');
    expect(svg).toContain('GLYPHFIELD / HOLO VINYL');
  });
});
