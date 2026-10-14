// Browser-only processors for image-effect Effect layers, one per layer. The
// WebGPU processor module loads on first use, so Design Lab pays for it only
// when a composition contains an image effect.
import type { DesignLabImageEffectStatus } from './designLabImageEffects';
import type { ShaderEffectProcessor } from './shaderEffectProcessor';
import type { ShaderEffectProps } from './shaderEffects';

type PoolEntry = { effectId: string; processor: Promise<ShaderEffectProcessor> };

export type ImageEffectProcessorPool = {
  /** Runs the layer's effect; the result is the processor's own canvas, so copy it before the next call. */
  process: (
    layerId: string,
    effectId: string,
    source: HTMLCanvasElement,
    effectProps: ShaderEffectProps,
    timeSeconds: number
  ) => Promise<HTMLCanvasElement>;
  /** Disposes processors for layers that are gone or now use another effect. Maps layer ID to effect ID. */
  retain: (layers: ReadonlyMap<string, string>) => void;
  dispose: () => void;
};

export function createImageEffectProcessorPool(): ImageEffectProcessorPool {
  const entries = new Map<string, PoolEntry>();
  const release = (layerId: string) => {
    const entry = entries.get(layerId);
    entries.delete(layerId);
    void entry?.processor.then((processor) => processor.dispose(), () => undefined);
  };
  return {
    process: async (layerId, effectId, source, effectProps, timeSeconds) => {
      let entry = entries.get(layerId);
      if (entry?.effectId !== effectId) {
        if (entry) release(layerId);
        // A failed processor stays cached, so a browser without WebGPU is
        // asked once per effect rather than on every preview frame.
        entry = {
          effectId,
          processor: import('./shaderEffectProcessor').then(({ createShaderEffectProcessor }) => createShaderEffectProcessor(effectId)),
        };
        entries.set(layerId, entry);
      }
      const processor = await entry.processor;
      return processor.process(source, effectProps, timeSeconds);
    },
    retain: (layers) => {
      for (const [layerId, entry] of entries) {
        if (layers.get(layerId) !== entry.effectId) release(layerId);
      }
    },
    dispose: () => {
      [...entries.keys()].forEach(release);
    },
  };
}

export function imageEffectFailureStatus(error: unknown): DesignLabImageEffectStatus {
  return error instanceof Error && /WebGPU/i.test(error.message) ? 'unsupported' : 'error';
}
