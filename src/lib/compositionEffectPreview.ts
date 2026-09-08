import type { CompositionEffectSettings } from './compositionEffects';

type EffectPresentation = { opacity: number; settings: CompositionEffectSettings };
type EffectPreview = { opacity?: number; settings?: Partial<CompositionEffectSettings> };

/** A checkpoint must not attach transient converter pixels to a committed recipe. */
export function assertCompositionEffectCaptureReady(
  layers: readonly (EffectPresentation & { id: string })[],
  visibleIds: ReadonlySet<string>,
  previews: ReadonlyMap<string, EffectPreview>
): void {
  const editing = layers.some((layer) => {
    if (!visibleIds.has(layer.id)) return false;
    const preview = previews.get(layer.id);
    if (!preview) return false;
    return (preview.opacity !== undefined && preview.opacity !== layer.opacity)
      || Object.entries(preview.settings ?? {}).some(([key, value]) => (
        value !== layer.settings[key as keyof CompositionEffectSettings]
      ));
  });
  if (editing) throw new Error('Finish editing the converter control before capturing its updated appearance.');
}

/** Live previews may be transient; capture always resolves the saved recipe. */
export function resolveCompositionEffectPreview(
  layer: EffectPresentation,
  preview: EffectPreview | undefined,
  capturing = false
): EffectPresentation {
  if (capturing || !preview) return layer;
  return {
    opacity: preview.opacity ?? layer.opacity,
    settings: preview.settings ? { ...layer.settings, ...preview.settings } : layer.settings,
  };
}
