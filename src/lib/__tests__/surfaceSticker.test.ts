import { describe, expect, it } from 'vitest';

import { DEFAULT_BACKGROUND_SETTINGS } from '../backgroundSvg';
import {
  buildSurfaceStickerSvg,
  normalizeStickerFinish,
  STICKER_FINISH_PRESETS,
} from '../surfaceSticker';

describe('surface stickers', () => {
  it('offers a broad set of production-inspired static finishes', () => {
    expect(STICKER_FINISH_PRESETS).toHaveLength(13);
    expect(STICKER_FINISH_PRESETS.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'holo-vinyl',
      'prismatic',
      'mirror-chrome',
      'retroreflective',
      'epoxy-dome',
      'embossed-foil',
      'precision-metal-inset',
    ]));
  });

  it('clamps editable finish values', () => {
    expect(normalizeStickerFinish({ bevelWidth: 90, borderColor: 'invalid', depth: 200, edgeWidth: -3, insetDepth: 140, intensity: -10, seamWidth: -4, texture: 140 })).toMatchObject({
      bevelWidth: 32,
      borderColor: '#F7F7F2',
      depth: 100,
      edgeWidth: 2,
      insetDepth: 100,
      intensity: 0,
      seamWidth: 0,
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
    expect(svg).toContain('data-sticker-finish-layer="cut-border"');
    expect(svg).toContain('fill="#F7F7F2"');
    expect(svg).toContain('data:image/svg+xml;base64,MARK');
    expect(svg).toContain('GLYPHFIELD / HOLO VINYL');
  });

  it('builds a polished frame, separation seam, and recessed insert for precision metal emblems', () => {
    const svg = buildSurfaceStickerSvg(
      { ...DEFAULT_BACKGROUND_SETTINGS, colorA: '#15171A', colorB: '#5D6269', colorC: '#F3F5F7' },
      {
        finish: { borderColor: '#FFFFFF', presetId: 'precision-metal-inset' },
        logo: 'data:image/svg+xml;base64,MARK',
        name: 'Glyphfield',
      }
    );

    expect(svg).toContain('data-sticker-finish="precision-metal-inset"');
    expect(svg).toContain('id="sticker-frame"');
    expect(svg).toContain('id="sticker-seam"');
    expect(svg).toContain('data-sticker-finish-layer="polished-frame"');
    expect(svg).toContain('data-sticker-finish-layer="separation-seam"');
    expect(svg).toContain('data-sticker-finish-layer="matte-inset"');
    expect(svg).toContain('data-sticker-finish-layer="satin-brush"');
  });
});
