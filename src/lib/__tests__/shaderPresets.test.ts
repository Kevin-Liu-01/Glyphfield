import { describe, expect, it } from 'vitest';

import { SHADER_PRESETS } from '../shaderPresets';

describe('SHADER_PRESETS', () => {
  it('offers a distinct, navigable set of fragment shaders', () => {
    expect(SHADER_PRESETS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(SHADER_PRESETS.map(({ id }) => id)).size).toBe(SHADER_PRESETS.length);
    expect(SHADER_PRESETS.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['liquid-metal', 'mercury', 'brushed-steel'])
    );

    for (const preset of SHADER_PRESETS) {
      expect(preset.fragmentSource).toContain('void main()');
      expect(preset.fragmentSource).toContain('u_resolution');
      expect(preset.fragmentSource).toContain('u_time');
      expect(preset.fragmentSource).toContain('u_distortion');
    }
  });
});
