import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIVE_MATERIAL_ID,
  LIVE_MATERIAL_OPTIONS,
  PAPER_LIVE_MATERIAL_DEFINITIONS,
} from '../liveMaterials';
import { getShaderMotionCapabilities } from '../shaderMotionCapabilities';

describe('shader motion capabilities', () => {
  it('covers every canonical catalog material, including static surfaces', () => {
    for (const { id } of LIVE_MATERIAL_OPTIONS) {
      const capabilities = getShaderMotionCapabilities(id);
      expect(capabilities.materialId).toBe(id);
      expect(capabilities.supportsPngSnapshot).toBe(true);
      expect(['static', 'direct-time', 'procedural', 'stateful']).toContain(capabilities.motionModel);
      expect(typeof capabilities.supportsEditableSeek).toBe('boolean');
      expect(capabilities.loop).toBeDefined();
    }
  });

  it('requires a pixel snapshot for fluid, never timestamp-only simulation reconstruction', () => {
    expect(getShaderMotionCapabilities('pavel-fluid-energy')).toEqual({
      materialId: 'pavel-fluid-energy',
      provider: 'fluid',
      motionModel: 'stateful',
      supportsPngSnapshot: true,
      supportsEditableSeek: false,
      loop: { kind: 'continuous', periodMs: null },
    });
  });

  it('separates a configured sphere period from an arbitrary universal frame sequence', () => {
    expect(getShaderMotionCapabilities('shadergradient-prismatic-sphere')).toMatchObject({
      provider: 'shadergradient',
      motionModel: 'direct-time',
      supportsEditableSeek: true,
      loop: { kind: 'configured', periodSource: 'loopDurationMs', pixelVerified: false },
    });
  });

  it('classifies time-independent Paper fragments, not merely zero-speed presets, as static', () => {
    const staticFamilies = new Set([
      'dot-grid', 'fluted-glass', 'halftone-cmyk', 'halftone-dots',
      'image-dithering', 'paper-texture', 'static-mesh-gradient',
      'static-radial-gradient', 'waves',
    ]);
    for (const { family, id } of PAPER_LIVE_MATERIAL_DEFINITIONS) {
      expect(getShaderMotionCapabilities(id)).toMatchObject({
        provider: 'paper',
        motionModel: staticFamilies.has(family) ? 'static' : 'procedural',
        supportsEditableSeek: !staticFamilies.has(family),
      });
      if (staticFamilies.has(family)) {
        expect(getShaderMotionCapabilities(id).loop).toEqual({ kind: 'static' });
      }
    }
  });

  it.each([
    ['paper-dithering-sine-wave', 'wave', 4 * Math.PI],
    ['paper-dithering-ripple', 'ripple', 4 * Math.PI / 3],
    ['paper-dithering-swirl', 'swirl', Math.PI],
  ] as const)('records %s as a shape-specific analytic candidate, not a verified pixel loop', (id, shape, period) => {
    expect(getShaderMotionCapabilities(id).loop).toEqual({
      kind: 'analytic-candidate',
      providerTimePeriod: period,
      providerTimeUnit: 'seconds',
      requiresPresetShape: shape,
      pixelVerified: false,
    });
  });

  it('does not infer a loop for all dither presets or other Paper noise fields', () => {
    for (const id of ['paper-dithering', 'paper-dithering-warp', 'paper-dithering-bugs', 'paper-gem-smoke', 'paper-perlin-noise'] as const) {
      expect(getShaderMotionCapabilities(id).loop).toEqual({ kind: 'continuous', periodMs: null });
    }
  });

  it('keeps custom shader and Canvas2D time addressable without promising a repeat period', () => {
    for (const { id, engine } of LIVE_MATERIAL_OPTIONS) {
      if (['Paper Shaders', 'ShaderGradient', 'WebGL Fluid'].includes(engine)) continue;
      expect(getShaderMotionCapabilities(id)).toMatchObject({
        provider: id === 'glyphfield-glyph-field' ? 'canvas2d' : 'custom-glsl',
        motionModel: 'direct-time',
        supportsEditableSeek: true,
        loop: { kind: 'continuous', periodMs: null },
      });
    }
  });

  it('uses the canonical material fallback instead of inventing capabilities for an unknown Paper ID', () => {
    expect(getShaderMotionCapabilities('paper-not-in-the-catalog'))
      .toEqual(getShaderMotionCapabilities(DEFAULT_LIVE_MATERIAL_ID));
  });
});
