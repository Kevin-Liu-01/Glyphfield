import { Dithering, GrainGradient, ditheringPresets, grainGradientPresets } from '@paper-design/shaders-react';
import { describe, expect, it } from 'vitest';

import { loadPaperShaderRenderer, readPaperShaderRenderer } from '@/components/paperShaderRegistry';
import { PAPER_SHADER_FAMILIES } from '@/lib/liveMaterials';

describe('native Paper shader registry', () => {
  it('serves the exact landing components and presets without loading the rest', async () => {
    expect(readPaperShaderRenderer('dithering')).toEqual({ component: Dithering, presets: ditheringPresets });
    expect(readPaperShaderRenderer('grain-gradient')).toEqual({ component: GrainGradient, presets: grainGradientPresets });
    expect(await loadPaperShaderRenderer('dithering')).toBe(readPaperShaderRenderer('dithering'));
    for (const { slug } of PAPER_SHADER_FAMILIES) {
      if (slug !== 'dithering' && slug !== 'grain-gradient') expect(readPaperShaderRenderer(slug)).toBeUndefined();
    }
  });

  it('loads every canonical family once with its original preset order and caches the renderer', async () => {
    const renderers = await Promise.all(PAPER_SHADER_FAMILIES.map(({ slug }) => loadPaperShaderRenderer(slug)));
    for (const [index, family] of PAPER_SHADER_FAMILIES.entries()) {
      const renderer = renderers[index]!;
      expect(renderer.presets.map(({ name }) => name)).toEqual(family.presets);
      expect(readPaperShaderRenderer(family.slug)).toBe(renderer);
      expect(await loadPaperShaderRenderer(family.slug)).toBe(renderer);
    }
  });
});
