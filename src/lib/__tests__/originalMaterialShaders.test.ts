import { describe, expect, it } from 'vitest';
import { fluidEmitters } from '../fluidSimulationShaders';
import { DISCOVERABLE_LIVE_MATERIAL_OPTIONS } from '../liveMaterials';
import { hexToSrgb, linearToOklab, shaderColor, srgbToLinear } from '../materialColor';
import { ORIGINAL_MATERIAL_IDS, isOriginalMaterialId, originalFragmentSource } from '../originalMaterialShaders';

describe('original material shaders', () => {
  it('covers every original catalog material with a GLSL ES 3.00 source', () => {
    for (const id of ORIGINAL_MATERIAL_IDS) {
      expect(DISCOVERABLE_LIVE_MATERIAL_OPTIONS.some((option) => option.id === id)).toBe(true);
      const source = originalFragmentSource(id);
      expect(source.startsWith('#version 300 es')).toBe(true);
      expect(source).toMatch(/writeColor(WithGrain)?\(/);
      expect(source).not.toContain('gl_FragColor');
    }
    expect(isOriginalMaterialId('paper-mesh-gradient')).toBe(false);
  });
});

describe('material color conversion', () => {
  it('converts sRGB hex to linear light and OKLab', () => {
    expect(hexToSrgb('#ff8000')).toEqual([1, 128 / 255, 0]);
    const [red, green] = srgbToLinear([1, 0.5, 0]);
    expect(red).toBeCloseTo(1, 6);
    expect(green).toBeCloseTo(0.214, 3);
    const [lightness, a, b] = linearToOklab([1, 1, 1]);
    expect(lightness).toBeCloseTo(1, 4);
    expect(a).toBeCloseTo(0, 4);
    expect(b).toBeCloseTo(0, 4);
    expect(shaderColor('#FFFFFF')).toBe(shaderColor('#FFFFFF'));
  });
});

describe('fluid emitters', () => {
  it('stay inside the frame with unit directions', () => {
    for (let time = 0; time < 60; time += 0.37) {
      for (const emitter of fluidEmitters(time, 5.5)) {
        expect(emitter.x).toBeGreaterThan(0);
        expect(emitter.x).toBeLessThan(1);
        expect(emitter.y).toBeGreaterThan(0);
        expect(emitter.y).toBeLessThan(1);
        expect(Math.hypot(emitter.dx, emitter.dy)).toBeCloseTo(1, 6);
      }
    }
  });
});
