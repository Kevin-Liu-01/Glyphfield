/**
 * Runs one Shaders.com image effect (a component that needs a child image) over pixels the
 * host supplies, such as the composition beneath a Design Lab Effect layer. Browser only.
 * Upstream decodes image URLs itself, so each new source is handed over as a blob URL.
 */
import { getNaturalSize, getWebGPUSupport } from 'shaders/core';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from './liveMaterials';
import { SHADER_EFFECTS, getShaderEffect, type ShaderEffect, type ShaderEffectProps } from './shaderEffects';
import type { ShaderEffectPalette } from './shaderEffectsProps';
import { createShaderEffectsRenderer } from './shaderEffectsRenderer';

/** Effects that transform an image; these belong in Effect layers, not the material library. */
export const SHADER_IMAGE_EFFECTS: readonly ShaderEffect[] = SHADER_EFFECTS.filter((effect) => effect.requiresChild);

export function isShaderImageEffect(id: string): boolean {
  return getShaderEffect(id)?.requiresChild === true;
}

export type ShaderEffectProcessor = {
  /**
   * Renders the effect over `source` at its pixel size. `palette` seeds the
   * effect's colour props, as a shader layer's colours do. Returns the
   * processor's own canvas: copy it before the next call.
   */
  process: (source: HTMLCanvasElement, effectProps: ShaderEffectProps, timeSeconds?: number, palette?: ShaderEffectPalette) => Promise<HTMLCanvasElement>;
  dispose: () => void;
};

const SOURCE_TIMEOUT_MS = 10_000;

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function canvasBlobUrl(source: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => source.toBlob((blob) => (
    blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('The effect source could not be encoded.'))
  ), 'image/png'));
}

export async function createShaderEffectProcessor(effectId: string): Promise<ShaderEffectProcessor> {
  if (!isShaderImageEffect(effectId)) throw new Error(`${effectId} is not an image effect.`);
  const { supported } = await getWebGPUSupport();
  if (!supported) throw new Error('This effect needs a browser and device with WebGPU.');
  const gpu = document.createElement('canvas');
  const output = document.createElement('canvas');
  const outputContext = output.getContext('2d');
  if (!outputContext) throw new Error('Canvas rendering is unavailable.');
  // The first source arrives with the first process() call; until then upstream holds its sample.
  let adapter: Awaited<ReturnType<typeof createShaderEffectsRenderer>> | null = null;
  let sourceUrl: string | null = null;
  let size = '';
  let lastTime = 0;
  let queue: Promise<unknown> = Promise.resolve();
  let disposed = false;

  async function render(source: HTMLCanvasElement, effectProps: ShaderEffectProps, timeSeconds: number, palette?: ShaderEffectPalette) {
    if (disposed) throw new Error('The effect processor was disposed.');
    const width = Math.max(1, source.width);
    const height = Math.max(1, source.height);
    const settings = { ...DEFAULT_LIVE_MATERIAL_SETTINGS, ...palette, effectProps };
    const nextUrl = await canvasBlobUrl(source);
    if (!adapter) {
      adapter = await createShaderEffectsRenderer(gpu, effectId, settings, nextUrl, width / height);
    } else {
      adapter.renderer.updateUniformValue('source', 'url', nextUrl);
    }
    const previousUrl = sourceUrl;
    sourceUrl = nextUrl;
    const nextSize = `${width}x${height}`;
    if (nextSize !== size) {
      size = nextSize;
      // Resolution scale 1/dpr makes the backing store exactly the source's pixel size.
      adapter.renderer.setResolutionScale(1 / Math.min(window.devicePixelRatio || 1, 2));
      adapter.renderer.resize(width, height);
      await nextFrame();
      adapter.renderer.stopAnimation();
    }
    adapter.update(settings, 1, width / height);
    const startedAt = performance.now();
    while (!getNaturalSize(nextUrl)) {
      if (performance.now() - startedAt > SOURCE_TIMEOUT_MS) throw new Error('The effect source did not load.');
      await adapter.renderer.renderSyntheticFrame(0);
    }
    await adapter.renderer.renderSyntheticFrame(Math.max(0, timeSeconds - lastTime), { waitForGpu: true });
    lastTime = Math.max(lastTime, timeSeconds);
    if (adapter.renderer.getFailureReason()) throw new Error('WebGPU could not render this effect.');
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    if (output.width !== gpu.width || output.height !== gpu.height) { output.width = gpu.width; output.height = gpu.height; }
    outputContext!.clearRect(0, 0, output.width, output.height);
    outputContext!.drawImage(gpu, 0, 0);
    return output;
  }

  return {
    // Calls are serialised: one upstream renderer, one source texture.
    process: (source, effectProps, timeSeconds = 0, palette) => {
      const result = queue.then(() => render(source, effectProps, timeSeconds, palette));
      queue = result.catch(() => undefined);
      return result;
    },
    dispose: () => {
      disposed = true;
      adapter?.dispose();
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    },
  };
}
