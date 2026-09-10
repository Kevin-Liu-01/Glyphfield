import { Dithering, GrainGradient, ditheringPresets, grainGradientPresets } from '@paper-design/shaders-react';

import { paperShaderRenderer, type PaperShaderRenderer } from '@/components/paperShaderRenderer';
import type { PaperShaderFamilyId } from '@/lib/liveMaterials';

const renderers: Partial<Record<PaperShaderFamilyId, PaperShaderRenderer>> = {
  dithering: paperShaderRenderer(Dithering, ditheringPresets),
  'grain-gradient': paperShaderRenderer(GrainGradient, grainGradientPresets),
};
let additionalRenderers: Promise<void> | undefined;

export function readPaperShaderRenderer(family: PaperShaderFamilyId): PaperShaderRenderer | undefined {
  return renderers[family];
}

/** Only the native families used above the fold belong in the startup graph. */
export async function loadPaperShaderRenderer(family: PaperShaderFamilyId): Promise<PaperShaderRenderer> {
  const ready = readPaperShaderRenderer(family);
  if (ready) return ready;
  additionalRenderers ??= import('@/components/paperShaderAdditionalRegistry').then(({ PAPER_ADDITIONAL_SHADER_RENDERERS }) => {
    Object.assign(renderers, PAPER_ADDITIONAL_SHADER_RENDERERS);
  }).catch((error: unknown) => {
    additionalRenderers = undefined;
    throw error;
  });
  await additionalRenderers;
  const renderer = readPaperShaderRenderer(family);
  if (!renderer) throw new Error(`Paper shader ${family} is unavailable.`);
  return renderer;
}
