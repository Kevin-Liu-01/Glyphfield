import { describe, expect, it } from 'vitest';

import { PAPER_ADDITIONAL_SHADER_RENDERERS } from '@/components/paperShaderAdditionalRegistry';
import { readPaperShaderRenderer } from '@/components/paperShaderRegistry';
import type { PaperShaderRenderer } from '@/components/paperShaderRenderer';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  PAPER_SHADER_FAMILIES,
  liveMaterialMotionRate,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  paperControlOverrides,
  paperPaletteOverrides,
  paperShaderFilter,
  paperShaderGrainOpacity,
} from '@/lib/paperShaderControls';

const COLOR_KEYS = ['colorA', 'colorB', 'colorC'] as const;
const EDITABLE_NUMBER_SETTINGS = {
  amplitude: 7.7,
  brightness: 1.23,
  centerX: 0.13,
  centerY: 0.87,
  density: 1.42,
  detail: 7.4,
  frequency: 9.2,
  grain: 73,
  rotationZ: 37,
  speed: 0.81,
  strength: 1.08,
} as const satisfies Partial<Record<keyof LiveMaterialSettings, number>>;

function rendererFor(family: (typeof PAPER_SHADER_FAMILIES)[number]['slug']): PaperShaderRenderer {
  return readPaperShaderRenderer(family)
    ?? PAPER_ADDITIONAL_SHADER_RENDERERS[family as keyof typeof PAPER_ADDITIONAL_SHADER_RENDERERS];
}

describe('Paper shader palette coverage', () => {
  it.each(PAPER_SHADER_FAMILIES)('$label uses every authored palette slot in every preset', ({ slug }) => {
    const renderer = rendererFor(slug);
    expect(renderer).toBeDefined();

    renderer.presets.forEach((preset) => {
      const baseline = paperPaletteOverrides(preset.params, DEFAULT_LIVE_MATERIAL_SETTINGS);

      COLOR_KEYS.forEach((key, index) => {
        const changed = paperPaletteOverrides(preset.params, {
          ...DEFAULT_LIVE_MATERIAL_SETTINGS,
          [key]: ['#112233', '#445566', '#778899'][index],
        });
        expect(changed, `${slug} / ${preset.name} ignores ${key}`).not.toEqual(baseline);
      });
    });
  });

  it.each(PAPER_SHADER_FAMILIES)('$label maps every shared Design Lab control in every preset', ({ slug }) => {
    const renderer = rendererFor(slug);

    renderer.presets.forEach((preset) => {
      const signature = (settings: LiveMaterialSettings) => ({
        filter: paperShaderFilter(false, settings),
        grainOpacity: paperShaderGrainOpacity(false, settings),
        motionRate: liveMaterialMotionRate(settings.speed),
        overrides: paperControlOverrides(preset.params, settings, false),
      });
      const baseline = signature(DEFAULT_LIVE_MATERIAL_SETTINGS);

      Object.entries(EDITABLE_NUMBER_SETTINGS).forEach(([key, value]) => {
        const changed = signature({ ...DEFAULT_LIVE_MATERIAL_SETTINGS, [key]: value });
        expect(changed, `${slug} / ${preset.name} ignores ${key}`).not.toEqual(baseline);
      });
    });
  });
});
