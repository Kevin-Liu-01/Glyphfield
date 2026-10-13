/** Browser-only adapter. Each upstream component is imported only when selected. */
import { createGpuUniformsMap, getNaturalSize, rootPassthrough, shaderRendererGPU, type GpuShaderDefinition } from 'shaders/core';
import { shaderEffectsLoaders } from './shaderEffectsLoaders.generated';
import { getShaderEffect } from './shaderEffects';
import { shaderEffectRenderProps, shaderEffectUsesBands } from './shaderEffectsProps';
import { normalizeHexOrFallback } from './color';
import type { LiveMaterialSettings } from './liveMaterials';

/** Luminance-only sample for filters; its tones map through the active palette. */
const DEFAULT_SOURCE = '/shader-effects-source.svg';

function paletteMapColors(settings: LiveMaterialSettings) {
  return { colorLow: normalizeHexOrFallback(settings.colorA, '#000000'), colorMid: normalizeHexOrFallback(settings.colorB, '#808080'), colorHigh: normalizeHexOrFallback(settings.colorC, '#FFFFFF') };
}

export async function createShaderEffectsRenderer(canvas: HTMLCanvasElement, id: string, settings: LiveMaterialSettings, sourceImage?: string) {
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
    if (renderer.getFailureReason()) throw new Error('This material requires a browser and device with WebGPU support.');
    renderer.registerNode('root', rootPassthrough.fragment, null, null, {}, rootPassthrough);
    const resolve = (next: LiveMaterialSettings) => shaderEffectRenderProps(id, next, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    const props = resolve(settings);
    const register = (nodeId: string, def: GpuShaderDefinition, parent: string, values: Record<string, unknown>, order = 0) => {
      const defaults = Object.fromEntries(Object.entries(def.props).map(([key, prop]) => [key, prop.default]));
      renderer.registerNode(nodeId, def.fragment, parent, { blendMode: 'normal', opacity: 1, renderOrder: order }, createGpuUniformsMap(def, { ...defaults, ...values }, nodeId), def);
    };
    if (effect.component === 'ImageTexture') Object.assign(props, { url: imageUrl!, objectFit: 'cover' });
    const nodes = shaderEffectUsesBands(id, props) ? ['effect', 'band-1', 'band-2', 'band-3', 'band-4'] : ['effect'];
    const nodeProps = (values: typeof props, index: number): typeof props => nodes.length > 1 ? { ...values, center: { x: 0.5, y: -0.2 + index * 0.35 } } : values;
    nodes.forEach((nodeId, index) => register(nodeId, definition, 'root', nodeProps(props, index), index));
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
    let previousInput: LiveMaterialSettings = settings;
    let previousAspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    let previousScale: number | undefined;
    return {
      renderer,
      assetsReady: () => !imageUrl || !!getNaturalSize(imageUrl),
      update(next: LiveMaterialSettings, scale: number) {
        const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
        const inputChanged = next.effectProps !== previousInput.effectProps || next.colorA !== previousInput.colorA || next.colorB !== previousInput.colorB || next.colorC !== previousInput.colorC;
        if (inputChanged || aspect !== previousAspect) {
          previousInput = next;
          previousAspect = aspect;
          const values = resolve(next);
          nodes.forEach((nodeId, index) => {
            const oldValues = nodeProps(previous, index);
            for (const [key, value] of Object.entries(nodeProps(values, index))) {
              if (definition.props[key] && JSON.stringify(oldValues[key]) !== JSON.stringify(value)) renderer.updateUniformValue(nodeId, key, value);
            }
          });
          previous = values;
          if (paletteMap) Object.entries(paletteMapColors(next)).forEach(([key, value]) => renderer.updateUniformValue('palette-map', key, value));
        }
        if (scale === previousScale) return;
        previousScale = scale;
        nodes.forEach((nodeId) => renderer.updateNodeMetadata(nodeId, { transform: { scale, offsetX: 0, offsetY: 0, rotation: 0, anchorX: 0.5, anchorY: 0.5, edges: props.surface === 'shape' ? 'transparent' : 'mirror' } }));
      },
      dispose: () => renderer.cleanup(),
    };
  } catch (error) {
    renderer.cleanup();
    throw error;
  }
}
