/** Per-effect control metadata, validation, and render props. Load on the client through `loadShaderEffectsProps`. */
import controls from './shaderEffectsProps.generated.json';
import { normalizeHex } from './color';
import type { LiveMaterialSettings } from './liveMaterials';
import { getShaderEffect, type ShaderEffectControl, type ShaderEffectProps, type ShaderEffectValue } from './shaderEffects';

export type ShaderEffectPalette = Pick<LiveMaterialSettings, 'colorA' | 'colorB' | 'colorC'>;
export type ShaderEffectSettings = ShaderEffectPalette & Pick<LiveMaterialSettings, 'effectProps'>;

const CONTROLS = controls as unknown as Readonly<Record<string, Readonly<Record<string, ShaderEffectControl>>>>;

export function getShaderEffectControls(id: string): Readonly<Record<string, ShaderEffectControl>> | undefined {
  return Object.hasOwn(CONTROLS, id) ? CONTROLS[id] : undefined;
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

// Source images are multi-MB data URLs; re-validate only when the string changes.
let acceptedSourceImage = '';
function validateSourceImage(value: unknown): string {
  if (typeof value === 'string' && (value === '' || value === acceptedSourceImage)) return value;
  if (typeof value !== 'string' || value.length > 16_000_000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) throw new Error('Source image must be a local PNG, JPEG or WebP under 12 MB.');
  acceptedSourceImage = value;
  return value;
}

/** Validate portable native props at the HTTP, source, and renderer boundaries. */
export function validateShaderEffectProps(id: string, input: unknown): ShaderEffectProps {
  const effectControls = getShaderEffectControls(id);
  if (!effectControls || !input || typeof input !== 'object' || Array.isArray(input)) throw new Error('effectProps must be an object for a Shaders.com WebGPU material.');
  const result: ShaderEffectProps = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(effectControls, key)) throw new Error(`Unknown effectProps.${key}.`);
    const control = effectControls[key];
    if (key === 'sourceImage' && control?.type === 'local-image') {
      result[key] = validateSourceImage(value);
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
  const effectControls = getShaderEffectControls(id);
  return effectControls ? Object.fromEntries(Object.entries(effectControls)
    .filter(([, prop]) => prop.default !== undefined && ![prop.type].flat().some((type) => ['image-upload', 'video-upload', 'layer'].includes(type ?? '')))
    .map(([key, prop]) => [key, structuredClone(prop.default!)])) : {};
}

function paletteHex(value: string): string | undefined {
  try { return normalizeHex(value); } catch { return undefined; }
}

/** Keep a default's transparency, e.g. a fade to clear, when the palette recolours it. */
function withDefaultAlpha(color: string, fallback: ShaderEffectValue | undefined): string {
  return typeof fallback === 'string' && /^#[\da-f]{8}$/i.test(fallback) && !/ff$/i.test(fallback) ? `${color}${fallback.slice(7)}` : color;
}

/** Colour props seeded from the shared palette, per the generator's role map. */
export function shaderEffectPaletteProps(id: string, palette: ShaderEffectPalette): ShaderEffectProps {
  const stops = { base: paletteHex(palette.colorA), main: paletteHex(palette.colorB), highlight: paletteHex(palette.colorC) };
  const result: ShaderEffectProps = {};
  for (const [key, control] of Object.entries(getShaderEffectControls(id) ?? {})) {
    const role = control.palette;
    if (role === 'ramp' && stops.base && stops.main && stops.highlight) {
      result[key] = [{ color: stops.base, position: 0 }, { color: stops.main, position: 0.5 }, { color: stops.highlight, position: 1 }];
    } else if (role === 'lights' && Array.isArray(control.default) && stops.main && stops.highlight) {
      const [main, highlight] = [stops.main, stops.highlight];
      result[key] = control.default.map((light, index) => light && typeof light === 'object' && !Array.isArray(light) ? { ...structuredClone(light), color: index % 2 ? highlight : main } : light);
    } else if (role === 'base' || role === 'main' || role === 'highlight') {
      const color = stops[role];
      if (color) result[key] = withDefaultAlpha(color, control.default);
    }
  }
  return result;
}

/** Defaults, then the shared palette, then explicit edits, which always win. */
export function resolveShaderEffectProps(id: string, settings: ShaderEffectSettings): ShaderEffectProps {
  return { ...shaderEffectDefaults(id), ...shaderEffectPaletteProps(id, settings), ...settings.effectProps };
}

/** Controls the inspector shows for the resolved props. */
export function visibleShaderEffectControls(id: string, props: ShaderEffectProps): [string, ShaderEffectControl][] {
  return Object.entries(getShaderEffectControls(id) ?? {}).filter(([name, control]) => props[name] !== undefined
    && !control.hidden
    && !['shapeType', 'shapeSdfUrl'].includes(name)
    && Object.entries(control.condition ?? {}).every(([key, expected]) => Array.isArray(expected) ? expected.includes(props[key] ?? null) : props[key] === expected)
    && !(props.surface === 'canvas' && (control.group === 'Shape' || control.group === 'Position')));
}

// Edge-lit materials need their rim in frame; the rest overscan past the output.
const FRAMED_PANEL_IDS = new Set(['shader-effects-neon', 'shader-effects-light-edge', 'shader-effects-thin-film', 'shader-effects-obsidian']);

/** Keep the native material, but fit its analytic surface to the output instead of a demo sphere. */
export function shaderEffectRenderProps(id: string, settings: ShaderEffectSettings, aspect = 1): ShaderEffectProps {
  const props = resolveShaderEffectProps(id, { ...settings, effectProps: validateShaderEffectProps(id, settings.effectProps ?? {}) });
  if (getShaderEffect(id)?.category !== 'Shape Effects' || props.surface === 'shape') return props;
  // Surface geometry uses height-normalized half extents. One inset panel keeps a
  // single node at any aspect; its margin follows the shorter side.
  const halfWidth = Math.max(0.01, aspect) / 2;
  const margin = FRAMED_PANEL_IDS.has(id) ? -0.16 * Math.min(halfWidth, 0.5) : 0.15;
  return { ...props, origin: 'center', center: { x: 0.5, y: 0.5 }, scale: 1, rotation: 0,
    shape: JSON.stringify({ type: 'roundedRectSDF', width: halfWidth + margin, height: 0.5 + margin, rounding: Math.max(0, -margin * 0.75) }),
    shapeType: 'roundedRectSDF', shapeSdfUrl: '' };
}
