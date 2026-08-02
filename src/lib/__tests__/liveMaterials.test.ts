import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  brandMaterialPalette,
  LIVE_MATERIAL_LOOK_PRESETS,
  LIVE_MATERIAL_PALETTES,
  LIVE_MATERIAL_OPTIONS,
  PAPER_LIVE_MATERIAL_IDS,
  PAPER_SHADER_FAMILIES,
  PAPER_SHADERS_SOURCE_URL,
  STATIC_SURFACE_MATERIAL_IDS,
  DISCOVERABLE_LIVE_MATERIAL_OPTIONS,
  liveMaterialLookPreset,
  normalizeLiveMaterialId,
  SHADER_GRADIENT_SOURCE_URL,
  WEBGL_FLUID_SOURCE_URL,
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

  it('offers the curated Shaders.com study scene families without Dedalus Bloom', () => {
    const shadersMaterials = LIVE_MATERIAL_OPTIONS.filter(({ engine }) => engine === 'Shaders.com study');
    expect(shadersMaterials).toHaveLength(9);
    expect(shadersMaterials.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'shaders-fluid-chrome',
        'shaders-pixel-beams',
        'shaders-soft-register',
        'shaders-circuit',
      ])
    );
    expect(LIVE_MATERIAL_OPTIONS.some(({ id }) => String(id) === 'shaders-dedalus-bloom')).toBe(false);
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

  it('credits the MIT-licensed WebGL fluid material at its source', () => {
    expect(LIVE_MATERIAL_OPTIONS.find(({ id }) => id === 'pavel-fluid-energy')).toMatchObject({
      engine: 'WebGL Fluid',
      sourceLabel: 'PavelDoGreat · MIT',
      sourceUrl: WEBGL_FLUID_SOURCE_URL,
    });
    expect(WEBGL_FLUID_SOURCE_URL).toBe('https://github.com/PavelDoGreat/WebGL-Fluid-Simulation');
  });

  it('offers the shared Apache-licensed Paper shader collection', () => {
    const paperMaterials = LIVE_MATERIAL_OPTIONS.filter(({ engine }) => engine === 'Paper Shaders');
    expect(PAPER_SHADER_FAMILIES).toHaveLength(29);
    expect(paperMaterials).toHaveLength(120);
    expect(LIVE_MATERIAL_OPTIONS).toHaveLength(141);
    expect(paperMaterials.map(({ id }) => id)).toEqual(expect.arrayContaining(PAPER_LIVE_MATERIAL_IDS));
    expect(new Set(PAPER_LIVE_MATERIAL_IDS).size).toBe(PAPER_LIVE_MATERIAL_IDS.length);
    expect(new Set(paperMaterials.map(({ sourceUrl }) => sourceUrl))).toEqual(new Set([PAPER_SHADERS_SOURCE_URL]));
    expect(paperMaterials.every(({ sourceLabel }) => sourceLabel === 'Paper · Apache-2.0')).toBe(true);
  });

  it('routes explicitly static Paper fields to Surface Lab discovery', () => {
    expect(STATIC_SURFACE_MATERIAL_IDS).toHaveLength(8);
    expect(STATIC_SURFACE_MATERIAL_IDS.every((id) =>
      String(id).startsWith('paper-static-mesh-gradient')
      || String(id).startsWith('paper-static-radial-gradient')
    )).toBe(true);
    expect(DISCOVERABLE_LIVE_MATERIAL_OPTIONS).toHaveLength(LIVE_MATERIAL_OPTIONS.length - 8);
    expect(DISCOVERABLE_LIVE_MATERIAL_OPTIONS.some(({ id }) => STATIC_SURFACE_MATERIAL_IDS.includes(id))).toBe(false);
  });

  it('curates all sources by visual quality and includes attributable design studies', () => {
    const qualityScores = LIVE_MATERIAL_OPTIONS.map(({ qualityScore }) => qualityScore);
    expect(qualityScores).toEqual(qualityScores.toSorted((left, right) => right - left));
    expect(LIVE_MATERIAL_OPTIONS.slice(0, 12).map(({ engine }) => engine)).toEqual(
      expect.arrayContaining(['Shaders.com study', 'Design study', 'WebGL Fluid', 'Paper Shaders'])
    );
    expect(LIVE_MATERIAL_OPTIONS.filter(({ engine }) => engine === 'Design study').map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'study-line-field',
        'study-relief-gradient',
        'study-radiant-void',
        'study-galactic-rings',
      ])
    );
  });

  it('ships original color combinations and migrates legacy scene prefixes', () => {
    expect(LIVE_MATERIAL_PALETTES).toHaveLength(15);
    expect(new Set(LIVE_MATERIAL_PALETTES.flatMap(({ colors }) => colors)).size).toBeGreaterThan(32);
    expect(LIVE_MATERIAL_PALETTES.map(({ id }) => id)).toEqual(expect.arrayContaining([
      'surface-paper-aperture',
      'surface-signal-dither',
      'surface-solar-orbit',
    ]));
    expect(normalizeLiveMaterialId('legacy-fluid-chrome')).toBe('shaders-fluid-chrome');
  });

  it('shares a broad set of editable look presets across material surfaces', () => {
    expect(LIVE_MATERIAL_LOOK_PRESETS).toHaveLength(8);
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
