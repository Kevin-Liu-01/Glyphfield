/** Browser-only adapter. Each upstream component is imported only when selected. */
import { createGpuUniformsMap, getNaturalSize, rootPassthrough, shaderRendererGPU, type GpuShaderDefinition } from 'shaders/core';
import { shaderEffectsLoaders } from './shaderEffectsLoaders.generated';
import { getShaderEffect } from './shaderEffects';
import { shaderEffectRenderProps } from './shaderEffectsProps';
import { normalizeHexOrFallback } from './color';
import type { LiveMaterialSettings } from './liveMaterials';

/** Luminance-only sample for filters; its tones map through the active palette. */
const DEFAULT_SOURCE = '/shader-effects-source.svg';

function paletteMapColors(settings: LiveMaterialSettings) {
  return { colorLow: normalizeHexOrFallback(settings.colorA, '#000000'), colorMid: normalizeHexOrFallback(settings.colorB, '#808080'), colorHigh: normalizeHexOrFallback(settings.colorC, '#FFFFFF') };
}

function samePalette(left: LiveMaterialSettings, right: LiveMaterialSettings): boolean {
  return left.colorA === right.colorA && left.colorB === right.colorB && left.colorC === right.colorC;
}

/**
 * Builds one upstream renderer. Renderers share upstream's page-wide default
 * GPU device; call only after the host has confirmed WebGPU support.
 */
export async function createShaderEffectsRenderer(canvas: HTMLCanvasElement, id: string, settings: LiveMaterialSettings, sourceImage: string | undefined, aspect: number) {
  const effect = getShaderEffect(id);
  if (!effect) throw new Error('Unknown Shaders.com material.');
  const load = shaderEffectsLoaders[effect.component as keyof typeof shaderEffectsLoaders];
  const definition = (await load()).default as GpuShaderDefinition;
  // Upstream decodes data/blob URLs and rasterises the SVG sample itself.
  const imageUrl = effect.requiresChild || effect.component === 'ImageTexture' ? sourceImage || DEFAULT_SOURCE : undefined;
  const paletteMapped = effect.requiresChild && !sourceImage;
  const [image, paletteMap] = await Promise.all([
    effect.requiresChild ? shaderEffectsLoaders.ImageTexture() : undefined,
    paletteMapped ? shaderEffectsLoaders.GradientMap() : undefined,
  ]);
  const renderer = shaderRendererGPU();
  try {
    await renderer.initialize({ canvas, observeElement: false });
    renderer.stopAnimation();
    const failure = renderer.getFailureReason();
    if (failure) throw new Error(`WebGPU unavailable (${failure}).`);
    renderer.registerNode('root', rootPassthrough.fragment, null, null, {}, rootPassthrough);
    const register = (nodeId: string, def: GpuShaderDefinition, parent: string, values: Record<string, unknown>, order = 0) => {
      const defaults = Object.fromEntries(Object.entries(def.props).map(([key, prop]) => [key, prop.default]));
      renderer.registerNode(nodeId, def.fragment, parent, { blendMode: 'normal', opacity: 1, renderOrder: order }, createGpuUniformsMap(def, { ...defaults, ...values }, nodeId), def);
    };
    const props = shaderEffectRenderProps(id, settings, aspect);
    register('effect', definition, 'root', effect.component === 'ImageTexture' ? { ...props, url: imageUrl, objectFit: 'cover' } : props);
    // Filters without an image read a structured sample mapped onto the brand palette.
    if (paletteMap) register('palette-map', paletteMap.default as GpuShaderDefinition, 'effect', { palette: 'custom', speed: 0, ...paletteMapColors(settings) });
    if (image) register('source', image.default as GpuShaderDefinition, paletteMap ? 'palette-map' : 'effect', { url: imageUrl, objectFit: 'cover' });
    if (effect.component === 'DisplacementMap') {
      const { default: noise } = await shaderEffectsLoaders.SimplexNoise();
      register('displacement', noise, 'root', { scale: 3 }, -1);
      renderer.updateNodeMetadata('displacement', { visible: false });
      renderer.updateUniformValue('effect', 'source', 'displacement');
    }
    renderer.stopAnimation();
    let previous = props;
    let previousSettings = settings;
    let previousAspect = aspect;
    let previousScale: number | undefined;
    return {
      renderer,
      assetsReady: () => !imageUrl || !!getNaturalSize(imageUrl),
      /** Applies changed uniforms only; settings arrive as new objects on every host render. */
      update(next: LiveMaterialSettings, scale: number, nextAspect: number) {
        const paletteChanged = !samePalette(next, previousSettings);
        if (next.effectProps !== previousSettings.effectProps || paletteChanged || nextAspect !== previousAspect) {
          const values = shaderEffectRenderProps(id, next, nextAspect);
          for (const [key, value] of Object.entries(values)) {
            if (definition.props[key] && JSON.stringify(previous[key]) !== JSON.stringify(value)) renderer.updateUniformValue('effect', key, value);
          }
          if (paletteMap && paletteChanged) Object.entries(paletteMapColors(next)).forEach(([key, value]) => renderer.updateUniformValue('palette-map', key, value));
          previous = values;
          previousSettings = next;
          previousAspect = nextAspect;
        }
        if (scale === previousScale) return;
        previousScale = scale;
        renderer.updateNodeMetadata('effect', { transform: { scale, offsetX: 0, offsetY: 0, rotation: 0, anchorX: 0.5, anchorY: 0.5, edges: props.surface === 'shape' ? 'transparent' : 'mirror' } });
      },
      dispose: () => renderer.cleanup(),
    };
  } catch (error) {
    renderer.cleanup();
    throw error;
  }
}
