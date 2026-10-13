import index from './shaderEffectsIndex.generated.json';
import type { LiveMaterialSettings } from './liveMaterials';

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
  /** Which shared palette stop seeds this prop until it is edited. */
  palette?: ShaderEffectPaletteRole;
};
/** base = settings.colorA, main = colorB, highlight = colorC; a ramp takes all three. */
export type ShaderEffectPaletteRole = 'base' | 'main' | 'highlight' | 'ramp' | 'lights';
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

/** The surface inputs that change pixels. Hosts pass fresh settings objects on every render. */
export type ShaderEffectRenderInputs = {
  active: boolean;
  captureTimeMs: number | null;
  frameRate: number;
  frameState?: unknown;
  patternScale: number;
  paused: boolean;
  settings: Pick<LiveMaterialSettings, 'colorA' | 'colorB' | 'colorC' | 'effectProps' | 'speed'>;
};

function sameEffectProps(left: ShaderEffectProps = {}, right: ShaderEffectProps = {}): boolean {
  if (left === right) return true;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => Object.hasOwn(right, key) && left[key] === right[key]);
}

/** Whether a native surface must redraw, compared by value rather than object identity. */
export function shaderEffectInputsChanged(previous: ShaderEffectRenderInputs, next: ShaderEffectRenderInputs): boolean {
  return previous.active !== next.active || previous.paused !== next.paused || previous.captureTimeMs !== next.captureTimeMs
    || previous.frameState !== next.frameState || previous.frameRate !== next.frameRate || previous.patternScale !== next.patternScale
    || (['colorA', 'colorB', 'colorC', 'speed'] as const).some((key) => previous.settings[key] !== next.settings[key])
    || !sameEffectProps(previous.settings.effectProps, next.settings.effectProps);
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
