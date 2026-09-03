import { describe, expect, it } from 'vitest';

import { DEFAULT_BACKGROUND_SETTINGS } from '../backgroundSvg';
import {
  buildSurfaceStickerSvg,
  normalizeStickerFinish,
  stickerFinishPalette,
  stickerFinishSwatch,
  stickerShaderSource,
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
    expect(stickerShaderSource('holo-vinyl')).toMatchObject({ license: 'MIT', name: 'HoloSticker' });
    expect(stickerShaderSource('prismatic')).toMatchObject({ license: 'MIT', name: 'HoloSticker' });
  });

  it('clamps editable finish values', () => {
    expect(normalizeStickerFinish({ bands: 80, bevelWidth: 90, borderColor: 'invalid', curl: -4, cutTolerance: 40, depth: 200, edgeWidth: -3, ink: 500, insetDepth: 140, intensity: -10, peelAmount: 140, seamWidth: -4, texture: 140 })).toMatchObject({
      bands: 20,
      bevelWidth: 32,
      borderColor: '#F7F7F2',
      curl: 2,
      cutTolerance: 12,
      depth: 100,
      edgeWidth: 2,
      ink: 200,
      insetDepth: 100,
      intensity: 0,
      peelAmount: 100,
      seamWidth: 0,
      texture: 100,
    });
  });

  it('shares every finish visual across live stickers and canvas exports', () => {
    expect(stickerFinishSwatch({ presetId: 'mirror-chrome' })).toBe(
      STICKER_FINISH_PRESETS.find(({ id }) => id === 'mirror-chrome')?.swatch
    );
    expect(stickerFinishPalette({ presetId: 'embossed-foil' })).toEqual([
      '#5E441E',
      '#F6DC91',
      '#9D772E',
      '#FFF0B1',
      '#60451F',
    ]);
    expect(stickerFinishPalette({ hueShift: 50, presetId: 'custom' })[0]).toBe('hsl(180 88% 76%)');
  });

  it('builds a portable die-cut SVG with the surface, laminate, edge, and shadow layers', () => {
    const svg = buildSurfaceStickerSvg(
      { ...DEFAULT_BACKGROUND_SETTINGS, gradient: 'bloom' },
      {
        finish: { presetId: 'holo-vinyl' },
        logo: 'data:image/svg+xml;base64,MARK',
        name: 'Glyphfield',
        surfaceAsset: 'data:image/png;base64,SURFACE',
      }
    );

    expect(svg).toContain('data-sticker-finish="holo-vinyl"');
    expect(svg).toContain('data-sticker-shader-source="HoloSticker"');
    expect(svg).toContain('data-sticker-shader-license="MIT"');
    expect(svg).toContain('id="sticker-cut"');
    expect(svg).toContain('id="sticker-art"');
    expect(svg).toContain('operator="dilate"');
    expect(svg).toContain('data-sticker-finish-layer="spectrum"');
    expect(svg).toContain('data-sticker-finish-layer="cut-border"');
    expect(svg).toContain('fill="#F7F7F2"');
    expect(svg).toContain('data:image/svg+xml;base64,MARK');
    expect(svg).toContain('data%3Aimage%2Fpng%3Bbase64%2CSURFACE');
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

  it('can omit the proof board while preserving the finished cutout for device scenes', () => {
    const svg = buildSurfaceStickerSvg(DEFAULT_BACKGROUND_SETTINGS, {
      logo: 'data:image/svg+xml;base64,MARK',
      name: 'Glyphfield',
      stage: 'transparent',
    });

    expect(svg).toContain('data-sticker-stage="transparent"');
    expect(svg).toContain('data-sticker-finish="holo-vinyl"');
    expect(svg).not.toContain('<rect width="100%" height="100%" fill="url(#sticker-stage)"/>');
    expect(svg).not.toContain('GLYPHFIELD / HOLO VINYL');
  });
});
