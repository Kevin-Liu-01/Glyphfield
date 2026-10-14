import { loadShaderEffectsProps } from './shaderEffects';

/**
 * Starts loading a material's engine code when someone points at it in a library, so choosing
 * it paints sooner. Paper and Glyphfield's own materials ship with the canvas and need nothing.
 */
export function preloadLiveMaterial(materialId: string): void {
  if (materialId.startsWith('shader-effects-')) {
    void import('../components/ShaderEffectsSurface');
    void loadShaderEffectsProps();
  } else if (materialId === 'shadergradient-prismatic-sphere') {
    void import('../components/ShaderGradientSurface');
  }
}
