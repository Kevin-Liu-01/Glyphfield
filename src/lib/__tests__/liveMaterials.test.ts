import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  brandMaterialPalette,
  LIVE_MATERIAL_LOOK_PRESETS,
  LIVE_MATERIAL_PALETTES,
  LIVE_MATERIAL_OPTIONS,
  liveMaterialLookPreset,
  normalizeLiveMaterialId,
  SHADER_GRADIENT_SOURCE_URL,
} from '../liveMaterials';

describe('live materials', () => {
  it('preserves the supplied ShaderGradient preset as editable defaults', () => {
    expect(DEFAULT_LIVE_MATERIAL_SETTINGS).toMatchObject({
      amplitude: 3.2,
      brightness: 0.8,
      colorA: '#73BFC4',
      colorB: '#FF810A',
      colorC: '#8DA0CE',
      density: 0.8,
      frequency: 5.5,
      rotationY: 130,
      rotationZ: 70,
      strength: 0.3,
    });
    expect(SHADER_GRADIENT_SOURCE_URL).toContain('type=sphere');
    expect(SHADER_GRADIENT_SOURCE_URL).toContain('envPreset=city');
    expect(SHADER_GRADIENT_SOURCE_URL).toContain('grain=on');
  });

  it('offers the ten Shaders.com study scene families alongside ShaderGradient', () => {
    const shadersMaterials = LIVE_MATERIAL_OPTIONS.filter(({ engine }) => engine === 'Shaders.com study');
    expect(shadersMaterials).toHaveLength(10);
    expect(shadersMaterials.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'shaders-fluid-chrome',
        'shaders-pixel-beams',
        'shaders-soft-register',
        'shaders-circuit',
      ])
    );
  });

  it('offers the glyph field alongside original mesh, grain, and dither gradient materials', () => {
    const glyphfieldMaterials = LIVE_MATERIAL_OPTIONS.filter(({ engine }) => engine === 'Glyphfield');
    expect(glyphfieldMaterials.map(({ id }) => id)).toEqual([
      'glyphfield-glyph-field',
      'glyphfield-mesh-gradient',
      'glyphfield-grain-gradient',
      'glyphfield-dither-gradient',
    ]);
  });

  it('ships original color combinations and migrates legacy scene prefixes', () => {
    expect(LIVE_MATERIAL_PALETTES).toHaveLength(8);
    expect(new Set(LIVE_MATERIAL_PALETTES.flatMap(({ colors }) => colors)).size).toBeGreaterThan(16);
    expect(normalizeLiveMaterialId('legacy-fluid-chrome')).toBe('shaders-fluid-chrome');
  });

  it('shares a broad set of editable look presets across material surfaces', () => {
    expect(LIVE_MATERIAL_LOOK_PRESETS).toHaveLength(7);
    expect(new Set(LIVE_MATERIAL_LOOK_PRESETS.map(({ materialId }) => materialId)).size).toBeGreaterThan(5);
    expect(liveMaterialLookPreset('polished-chrome')).toMatchObject({
      materialId: 'shaders-fluid-chrome',
      settings: {
        brightness: 0.82,
        grain: 8,
        strength: 0.46,
      },
    });
  });

  it('builds the default material palette from the active brand colors', () => {
    expect(brandMaterialPalette({
      colors: [
        { hex: '#111111', id: 'ink', name: 'Ink', role: 'Primary' },
        { hex: '#FFFFFF', id: 'paper', name: 'Paper', role: 'Surface' },
        { hex: '#5B4DFF', id: 'emphasis', name: 'Signal', role: 'Accent' },
      ],
      id: 'sample',
      name: 'Sample Brand',
      shortName: 'Sample',
    })).toMatchObject({
      colors: ['#111111', '#5B4DFF', '#FFFFFF'],
      id: 'brand-sample',
      name: 'Sample colors',
    });
  });
});
