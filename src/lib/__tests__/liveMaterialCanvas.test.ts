import { describe, expect, it } from 'vitest';

import { paperControlOverrides, resolvePaperShaderScale } from '@/components/LiveMaterialCanvas';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';

describe('Paper shader preview controls', () => {
  const presetParams = {
    colorBack: '#730d54',
    colorFront: '#00becc',
    colors: ['#151310', '#d3a86b', '#f0edea'],
    scale: 1.2,
  };

  it('preserves a preset native palette for authentic previews', () => {
    const overrides = paperControlOverrides(
      presetParams,
      DEFAULT_LIVE_MATERIAL_SETTINGS,
      true
    );

    expect(overrides).not.toHaveProperty('colorBack');
    expect(overrides).not.toHaveProperty('colorFront');
    expect(overrides).not.toHaveProperty('colors');
    expect(overrides).not.toHaveProperty('scale');
    expect(presetParams).toEqual({
      colorBack: '#730d54',
      colorFront: '#00becc',
      colors: ['#151310', '#d3a86b', '#f0edea'],
      scale: 1.2,
    });
  });

  it('still applies the editable studio palette on the active canvas', () => {
    const overrides = paperControlOverrides(
      presetParams,
      DEFAULT_LIVE_MATERIAL_SETTINGS,
      false
    );

    expect(overrides.colorBack).toBe(DEFAULT_LIVE_MATERIAL_SETTINGS.colorA);
    expect(overrides.colorFront).toBe(DEFAULT_LIVE_MATERIAL_SETTINGS.colorB);
    expect(overrides.colors).toEqual([
      DEFAULT_LIVE_MATERIAL_SETTINGS.colorB,
      DEFAULT_LIVE_MATERIAL_SETTINGS.colorC,
      DEFAULT_LIVE_MATERIAL_SETTINGS.colorA,
    ]);
  });

  it('applies the full 0.1×–10× zoom range after presentation sizing', () => {
    expect(resolvePaperShaderScale(undefined, 0.25)).toBe(0.25);
    expect(resolvePaperShaderScale(undefined, 10)).toBe(10);
    expect(resolvePaperShaderScale(0.6, 1, { gemSmoke: true })).toBeCloseTo(1.12);
    expect(resolvePaperShaderScale(0.6, 0.25, { gemSmoke: true })).toBeCloseTo(0.28);
    expect(resolvePaperShaderScale(0.6, 10, { gemSmoke: true })).toBeCloseTo(11.2);
  });
});
