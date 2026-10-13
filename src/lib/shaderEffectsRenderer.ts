/** Browser-only adapter. Each upstream component is imported only when selected. */
import { createGpuUniformsMap, getNaturalSize, rootPassthrough, shaderRendererGPU, type GpuShaderDefinition } from 'shaders/core';
import { shaderEffectsLoaders } from './shaderEffectsLoaders.generated';
import { getShaderEffect } from './shaderEffects';
import { shaderEffectRenderProps, shaderEffectUsesBands } from './shaderEffectsProps';
import type { LiveMaterialSettings } from './liveMaterials';

async function rasterSource(source: string): Promise<string> {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.src = source;
  await image.decode();
  const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot prepare the source image.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Cannot decode source image.')), 'image/png'));
  return URL.createObjectURL(blob);
}

export async function createShaderEffectsRenderer(canvas: HTMLCanvasElement, id: string, settings: LiveMaterialSettings, sourceImage?: string) {
  const effect = getShaderEffect(id);
  if (!effect) throw new Error('Unknown Shaders.com material.');
  const load = shaderEffectsLoaders[effect.component as keyof typeof shaderEffectsLoaders];
  const definition = (await load()).default as GpuShaderDefinition;
  const renderer = shaderRendererGPU();
  let imageUrl: string | undefined;
  try {
    if ((effect.requiresChild && sourceImage) || effect.component === 'ImageTexture') imageUrl = await rasterSource(sourceImage || '/shader-effects-source.svg');
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
    if (effect.component === 'ImageTexture') props.url = imageUrl!;
    const nodes = shaderEffectUsesBands(id, props) ? ['effect', 'band-1', 'band-2', 'band-3', 'band-4'] : ['effect'];
    const nodeProps = (values: typeof props, index: number): typeof props => nodes.length > 1 ? { ...values, center: { x: 0.5, y: -0.2 + index * 0.35 } } : values;
    nodes.forEach((nodeId, index) => register(nodeId, definition, 'root', nodeProps(props, index), index));
    if (effect.requiresChild) {
      const { default: source } = imageUrl ? await shaderEffectsLoaders.ImageTexture() : await shaderEffectsLoaders.FlowingGradient();
      register('source', source, 'effect', imageUrl ? { url: imageUrl, fit: 'cover' } : { speed: 0.35, distortion: 0.7 });
    }
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
        }
        if (scale === previousScale) return;
        previousScale = scale;
        nodes.forEach((nodeId) => renderer.updateNodeMetadata(nodeId, { transform: { scale, offsetX: 0, offsetY: 0, rotation: 0, anchorX: 0.5, anchorY: 0.5, edges: props.surface === 'shape' ? 'transparent' : 'mirror' } }));
      },
      dispose: () => { renderer.cleanup(); if (imageUrl) URL.revokeObjectURL(imageUrl); },
    };
  } catch (error) {
    renderer.cleanup();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    throw error;
  }
}
