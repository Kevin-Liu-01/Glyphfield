import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  LIVE_MATERIAL_OPTIONS,
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

  it('offers the ten Ariadne scene families alongside ShaderGradient', () => {
    const ariadneMaterials = LIVE_MATERIAL_OPTIONS.filter(({ engine }) => engine === 'Glyphfield GLSL');
    expect(ariadneMaterials).toHaveLength(10);
    expect(ariadneMaterials.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        'ariadne-fluid-chrome',
        'ariadne-pixel-beams',
        'ariadne-soft-register',
        'ariadne-circuit',
      ])
    );
  });
});
