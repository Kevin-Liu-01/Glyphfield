import index from './shaderEffectsIndex.generated.json';

export type ShaderEffectValue = string | number | boolean | null | ShaderEffectValue[] | { [key: string]: ShaderEffectValue };
export type ShaderEffectProps = Record<string, ShaderEffectValue>;
export type ShaderEffectControl = {
  default?: ShaderEffectValue;
  type?: string | string[];
  label?: string;
  group?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { label: string; value: string | number }[];
  condition?: Record<string, ShaderEffectValue>;
  hidden?: boolean;
};
/** Light catalog record. Per-effect controls live in `shaderEffectsProps`. */
export type ShaderEffect = {
  id: `shader-effects-${string}`;
  component: string;
  name: string;
  description: string;
  category: string;
  requiresChild: boolean;
  stateful: boolean;
  infrastructure: string | null;
  /** Library order, set by the generator's tier map. */
  qualityScore: number;
};
export const SHADER_EFFECTS_VERSION = '4.0.1';
export const SHADER_EFFECTS_SOURCE = 'https://github.com/shader-effects-inc/shaders';
export const SHADER_EFFECT_COMPONENTS = index as readonly ShaderEffect[];
export const SHADER_EFFECTS = SHADER_EFFECT_COMPONENTS.filter((effect) => !effect.infrastructure);
const byId = new Map(SHADER_EFFECTS.map((effect) => [effect.id, effect]));
export function getShaderEffect(id: string): ShaderEffect | undefined {
  return byId.get(id as ShaderEffect['id']);
}

export type ShaderEffectsPropsModule = typeof import('./shaderEffectsProps');
let propsModule: Promise<ShaderEffectsPropsModule> | undefined;
let loadedPropsModule: ShaderEffectsPropsModule | undefined;

/**
 * The one lazy boundary for per-effect control metadata (~240 KB), so the
 * library and landing page only carry the index. Server code imports
 * `./shaderEffectsProps` directly.
 */
export function loadShaderEffectsProps(): Promise<ShaderEffectsPropsModule> {
  propsModule ??= import('./shaderEffectsProps').then((loaded) => {
    loadedPropsModule = loaded;
    return loaded;
  }, (error: unknown) => {
    propsModule = undefined;
    throw error;
  });
  return propsModule;
}

/** The control metadata if it already loaded, so remounts render without a loading frame. */
export function loadedShaderEffectsProps(): ShaderEffectsPropsModule | undefined {
  return loadedPropsModule;
}
