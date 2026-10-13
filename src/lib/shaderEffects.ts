import catalog from './shaderEffectsCatalog.generated.json';

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
};
export type ShaderEffect = {
  id: `shader-effects-${string}`;
  component: string;
  name: string;
  description: string;
  category: string;
  requiresChild: boolean;
  stateful: boolean;
  infrastructure: string | null;
  props: Record<string, ShaderEffectControl>;
};
export const SHADER_EFFECTS_VERSION = '4.0.1';
export const SHADER_EFFECTS_SOURCE = 'https://github.com/shader-effects-inc/shaders';
export const SHADER_EFFECT_COMPONENTS = catalog as unknown as readonly ShaderEffect[];
export const SHADER_EFFECTS = SHADER_EFFECT_COMPONENTS.filter((effect) => !effect.infrastructure);
const byId = new Map(SHADER_EFFECTS.map((effect) => [effect.id, effect]));
export function getShaderEffect(id: string): ShaderEffect | undefined {
  return byId.get(id as ShaderEffect['id']);
}

function safeValue(value: unknown, depth = 0): value is ShaderEffectValue {
  if (depth > 6) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 8192;
  if (Array.isArray(value)) return value.length <= 64 && value.every((item) => safeValue(item, depth + 1));
  return !!value && typeof value === 'object' && Object.keys(value).length <= 32
    && Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safeValue(item, depth + 1));
}

function isPosition(value: ShaderEffectValue): boolean {
  return !!value && !Array.isArray(value) && typeof value === 'object' && typeof value.x === 'number' && typeof value.y === 'number';
}

function validateStructuredControl(control: ShaderEffectControl, value: ShaderEffectValue) {
  const types = [control.type].flat();
  if (types.some((type) => type === 'shape' || type === 'shape3d')) {
    let shape: unknown;
    try { shape = JSON.parse(String(value)); } catch { throw new Error('Shape must contain valid JSON.'); }
    if (!shape || typeof shape !== 'object' || Array.isArray(shape) || !safeValue(shape)) throw new Error('Shape must be a JSON object.');
  }
  if (types.some((type) => type === 'gradient-stops' || type === 'list') && value !== null && !Array.isArray(value)) throw new Error('Stops and lights must be arrays.');
}

function validateControlValue(key: string, control: ShaderEffectControl, value: ShaderEffectValue) {
    const types = [control.type].flat();
    if (typeof control.default === 'number' && (typeof value !== 'number' || value < (control.min ?? -1e5) || value > (control.max ?? 1e5))) throw new Error(`effectProps.${key} is outside its numeric range.`);
    if (typeof control.default === 'boolean' && typeof value !== 'boolean') throw new Error(`effectProps.${key} must be boolean.`);
    if (typeof control.default === 'string' && typeof value !== 'string') throw new Error(`effectProps.${key} must be text.`);
    if (types.includes('color') && (typeof value !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value))) throw new Error(`effectProps.${key} must be a hex color.`);
    if (types.includes('position') && !isPosition(value)) throw new Error(`effectProps.${key} must have numeric x and y.`);
    if (control.options?.length && !control.options.some((option) => option.value === value)) throw new Error(`effectProps.${key} must be a listed option.`);
    // Local assets enter through the host's sourceImage path; no remote fetches in portable props.
    if (types.some((type) => type === 'image-upload' || type === 'video-upload' || type === 'layer')) throw new Error(`effectProps.${key} must be supplied through the host source layer.`);
}

/** Validate portable native props at the HTTP, source, and renderer boundaries. */
export function validateShaderEffectProps(id: string, input: unknown): ShaderEffectProps {
  const effect = getShaderEffect(id);
  if (!effect || !input || typeof input !== 'object' || Array.isArray(input)) throw new Error('effectProps must be an object for a Shaders.com WebGPU material.');
  const result: ShaderEffectProps = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(effect.props, key)) throw new Error(`Unknown effectProps.${key}.`);
    const control = effect.props[key];
    if (key === 'sourceImage' && control?.type === 'local-image') {
      if (typeof value !== 'string' || value.length > 16_000_000 || (value !== '' && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value))) throw new Error('Source image must be a local PNG, JPEG or WebP under 12 MB.');
      result[key] = value;
      continue;
    }
    if (!control || !safeValue(value)) throw new Error(`Invalid effectProps.${key}.`);
    validateControlValue(key, control, value);
    validateStructuredControl(control, value);
    result[key] = value;
  }
  return result;
}

export function shaderEffectDefaults(id: string): ShaderEffectProps {
  const effect = getShaderEffect(id);
  return effect ? Object.fromEntries(Object.entries(effect.props)
    .filter(([, prop]) => prop.default !== undefined && ![prop.type].flat().some((type) => ['image-upload', 'video-upload', 'layer'].includes(type ?? '')))
    .map(([key, prop]) => [key, structuredClone(prop.default!)])) : {};
}

/** Keep the native material, but fit its analytic surface to the output instead of a demo sphere. */
export function shaderEffectUsesBands(id: string, props: ShaderEffectProps): boolean {
  return props.surface !== 'shape' && ['shader-effects-neon', 'shader-effects-light-edge', 'shader-effects-thin-film', 'shader-effects-obsidian'].includes(id);
}

export function shaderEffectRenderProps(id: string, input: ShaderEffectProps, aspect = 1): ShaderEffectProps {
  const props = { ...shaderEffectDefaults(id), ...input };
  if (getShaderEffect(id)?.category !== 'Shape Effects' || props.surface === 'shape') return props;
  const width = Math.max(0.01, aspect) / 2;
  const bands = shaderEffectUsesBands(id, props);
  // Surface geometry uses height-normalized UVs. Overscan keeps the silhouette
  // and bevel outside the output, including very wide and portrait artboards.
  return { ...props, origin: 'center', center: { x: 0.5, y: 0.5 }, scale: 1, rotation: bands ? -18 : 0,
    shape: JSON.stringify({ type: 'roundedRectSDF', width: width + (bands ? 1 : 0.15), height: bands ? 0.065 : 0.65, rounding: 0 }),
    shapeType: 'roundedRectSDF', shapeSdfUrl: '' };
}
