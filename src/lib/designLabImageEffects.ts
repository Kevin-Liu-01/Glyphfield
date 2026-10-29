// Shaders.com image effects as Design Lab Effect layers. An image effect reads
// the composited layers beneath it, so it sits in the layer stack beside the
// built-in converters instead of in the shader material library. This module
// carries only the catalog index; the WebGPU processor loads on first use.
import type { CompositionEffectSettings } from './compositionEffects';
import { SHADER_EFFECTS, getShaderEffect, type ShaderEffect, type ShaderEffectProps } from './shaderEffects';
import type { ShaderEffectPalette } from './shaderEffectsProps';

export type DesignLabImageEffectId = ShaderEffect['id'];

/**
 * What an Effect layer stores. `effectId` selects a Shaders.com image effect,
 * which replaces the built-in converter named by `kind`; `effectProps` holds
 * explicit edits only, and defaults resolve when the effect renders.
 */
export type DesignLabEffectSettings = CompositionEffectSettings & {
  effectId?: DesignLabImageEffectId;
  effectProps?: ShaderEffectProps;
};

export type DesignLabImageEffectStatus = 'error' | 'loading' | 'ready' | 'unsupported';

const CATEGORY_ORDER = ['Stylize', 'Blurs', 'Distortions', 'Adjustments', 'Transitions', 'Interactive', 'Shape Effects'];

function categoryRank(category: string): number {
  const index = CATEGORY_ORDER.indexOf(category);
  return index < 0 ? CATEGORY_ORDER.length : index;
}

/** Every image effect, best first. */
export const DESIGN_LAB_IMAGE_EFFECTS: readonly ShaderEffect[] = SHADER_EFFECTS
  .filter((effect) => effect.requiresChild)
  .sort((left, right) => right.qualityScore - left.qualityScore || left.name.localeCompare(right.name));

/** Upstream categories in picker order. */
export const DESIGN_LAB_IMAGE_EFFECT_CATEGORIES: readonly string[] = [...new Set(DESIGN_LAB_IMAGE_EFFECTS.map(({ category }) => category))]
  .sort((left, right) => categoryRank(left) - categoryRank(right) || left.localeCompare(right));

/**
 * Effect layers store no colours of their own. Their colour props resolve from
 * the active brand palette (ink, accent, highlight), the colours a new shader
 * layer starts with; explicit effectProps still win.
 */
export function designLabImageEffectPalette(colors: readonly [string, string, string]): ShaderEffectPalette {
  return { colorA: colors[0], colorB: colors[1], colorC: colors[2] };
}

export function isDesignLabImageEffectId(value: unknown): value is DesignLabImageEffectId {
  return typeof value === 'string' && getShaderEffect(value)?.requiresChild === true;
}

export function designLabImageEffect(id: string | undefined): ShaderEffect | undefined {
  return id && isDesignLabImageEffectId(id) ? getShaderEffect(id) : undefined;
}

/** Category groups for the picker. Every search word must match the name, description or category. */
export function designLabImageEffectGroups(query = ''): { category: string; effects: ShaderEffect[] }[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = DESIGN_LAB_IMAGE_EFFECTS.filter((effect) => {
    const haystack = `${effect.name} ${effect.description} ${effect.category}`.toLocaleLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  return DESIGN_LAB_IMAGE_EFFECT_CATEGORIES
    .map((category) => ({ category, effects: matches.filter((effect) => effect.category === category) }))
    .filter(({ effects }) => effects.length > 0);
}

// An Effect layer's pixels come from the layers beneath it, never an upload.
const HOST_SUPPLIED_PROPS = new Set(['sourceImage']);

/**
 * Structural check for saved sources and Browser API input. Control values
 * validate separately against the lazily loaded control metadata.
 */
export function assertDesignLabEffectSettings(settings: unknown, label = 'Effect layer'): void {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return;
  const { effectId, effectProps } = settings as { effectId?: unknown; effectProps?: unknown };
  if (effectId === undefined) {
    if (effectProps !== undefined) throw new TypeError(`${label} effectProps need an effectId.`);
    return;
  }
  if (!isDesignLabImageEffectId(effectId)) {
    throw new TypeError(`${label} effectId must be an image effect ID listed in /api/materials imageEffects.`);
  }
  if (effectProps !== undefined) assertDesignLabEffectProps(effectProps, label);
}

/** effectProps must be an object without upstream inputs the layer stack supplies. */
export function assertDesignLabEffectProps(effectProps: unknown, label = 'Effect layer'): asserts effectProps is ShaderEffectProps {
  if (!effectProps || typeof effectProps !== 'object' || Array.isArray(effectProps)) throw new TypeError(`${label} effectProps must be an object.`);
  const hostKey = Object.keys(effectProps).find((key) => HOST_SUPPLIED_PROPS.has(key));
  if (hostKey) throw new TypeError(`${label} effectProps.${hostKey} does not apply: an Effect layer processes the layers beneath it.`);
}

export type ImageEffectPass<Id extends string, EffectId extends Id = Id> = {
  /** Count of layers to compose before this effect runs, in stack order. */
  beneathCount: number;
  layerId: EffectId;
};

/** One pass per image effect, in stack order. */
export function planImageEffectPasses<Id extends string, EffectId extends Id>(
  layerIds: readonly Id[],
  isImageEffect: (layerId: Id) => layerId is EffectId
): ImageEffectPass<Id, EffectId>[] {
  return layerIds.flatMap((layerId, index) => isImageEffect(layerId) ? [{ beneathCount: index, layerId }] : []);
}

type CanvasFactory = () => HTMLCanvasElement;

const createDocumentCanvas: CanvasFactory = () => document.createElement('canvas');

function sizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
}

/**
 * Two-pass compositing. For each image effect in stack order: compose the
 * layers beneath it (earlier image effects already resolved), run the effect
 * on those pixels, and keep a copy at the requested size. The caller's final
 * compose draws each copy where the stack reaches its layer. `run` returns
 * null when an effect is unavailable; that layer is left out, so the layers
 * beneath it show unchanged.
 */
export async function resolveImageEffectOutputs<Id extends string, EffectId extends Id>({
  composeBeneath,
  createCanvas = createDocumentCanvas,
  height,
  layerIds,
  outputs = new Map(),
  passes,
  run,
  source = createCanvas(),
  width,
}: {
  composeBeneath: (
    context: CanvasRenderingContext2D,
    beneath: readonly Id[],
    resolved: ReadonlyMap<EffectId, HTMLCanvasElement>
  ) => unknown;
  createCanvas?: CanvasFactory;
  height: number;
  layerIds: readonly Id[];
  /** Canvases kept between calls, keyed by layer, so live previews reuse them. */
  outputs?: Map<EffectId, HTMLCanvasElement>;
  passes: readonly ImageEffectPass<Id, EffectId>[];
  run: (layerId: EffectId, source: HTMLCanvasElement) => Promise<HTMLCanvasElement | null>;
  /** Reused for every pass: the effect has read it by the time `run` settles. */
  source?: HTMLCanvasElement;
  width: number;
}): Promise<Map<EffectId, HTMLCanvasElement>> {
  const resolved = new Map<EffectId, HTMLCanvasElement>();
  sizeCanvas(source, width, height);
  const sourceContext = source.getContext('2d');
  if (!sourceContext) throw new Error('Canvas rendering is unavailable.');
  for (const pass of passes) {
    sourceContext.clearRect(0, 0, width, height);
    await composeBeneath(sourceContext, layerIds.slice(0, pass.beneathCount), resolved);
    const result = await run(pass.layerId, source);
    if (!result) continue;
    const output = outputs.get(pass.layerId) ?? createCanvas();
    outputs.set(pass.layerId, output);
    sizeCanvas(output, width, height);
    const outputContext = output.getContext('2d');
    if (!outputContext) throw new Error('Canvas rendering is unavailable.');
    outputContext.clearRect(0, 0, width, height);
    outputContext.drawImage(result, 0, 0, width, height);
    resolved.set(pass.layerId, output);
  }
  return resolved;
}

/** Layers by id, keeping the first entry per id as `find` would. */
export function firstLayerById<T extends { id: string }>(layers: readonly T[]): Map<string, T> {
  const byId = new Map<string, T>();
  for (const layer of layers) if (!byId.has(layer.id)) byId.set(layer.id, layer);
  return byId;
}
