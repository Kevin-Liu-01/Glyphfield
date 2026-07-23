import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_PALETTES,
  LIVE_MATERIAL_OPTIONS,
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

  it('ships original color combinations and migrates legacy scene prefixes', () => {
    expect(LIVE_MATERIAL_PALETTES).toHaveLength(8);
    expect(new Set(LIVE_MATERIAL_PALETTES.flatMap(({ colors }) => colors)).size).toBeGreaterThan(16);
    expect(normalizeLiveMaterialId('legacy-fluid-chrome')).toBe('shaders-fluid-chrome');
  });
});
