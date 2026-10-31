import type {
  BrandColor,
  BrandColorPairing,
  BrandColorSystem,
  BrandIdentity,
} from './brandIdentity';
import { brandCssVariables, brandDesignTokens, brandTailwindTheme, brandTokenName, type BrandTokenSection } from './brandTokens';
import { formatOklch, normalizeHex, normalizeHexOrFallback } from './color';
import {
  compactColorSystem,
  isHex,
  isSemanticColorRole,
  parseColorRef,
  pruneColorSystem,
  prunePairings,
} from './colorSystem';
import { parseSourceObject, sourceNumber, sourceObjectArray, sourceString } from './sourceCode';

/**
 * The Color tokens tool's working state and source format, without React.
 * Palette, pairings and the colour system live on the identity; per-token opacity
 * is a tool preference kept in its draft.
 *
 * Source version 2: { version, colors: [{ id, name, role, hex, opacity, proportion }],
 * colorPairings, colorSystem }. Version 1 ({ colors: [{ hex, id, name, opacity, role }] })
 * still applies; missing fields fall back to the palette entry at the same index.
 */

export const COLOR_TOOL_SOURCE_VERSION = 2;

export type ColorWorkingState = {
  colorPairings?: BrandColorPairing[];
  colorSystem?: BrandColorSystem;
  colors: BrandColor[];
  /** Token opacity in percent, by color id; 100 when absent. */
  opacity: Readonly<Record<string, number>>;
};

export function colorWorkingState(identity: BrandIdentity, opacity: Readonly<Record<string, number>> = {}): ColorWorkingState {
  return {
    ...(identity.colorPairings ? { colorPairings: identity.colorPairings } : {}),
    ...(identity.colorSystem ? { colorSystem: identity.colorSystem } : {}),
    colors: identity.colors,
    opacity,
  };
}

/** The identity with the working palette, pairings and colour system. */
export function withColorWorkingState(identity: BrandIdentity, state: ColorWorkingState): BrandIdentity {
  const { colorPairings: _pairings, colorSystem: _system, ...rest } = identity;
  return {
    ...rest,
    ...(state.colorPairings ? { colorPairings: state.colorPairings } : {}),
    ...(state.colorSystem ? { colorSystem: state.colorSystem } : {}),
    colors: state.colors,
  };
}

export function colorOpacity(state: Pick<ColorWorkingState, 'opacity'>, id: string): number {
  const value = state.opacity[id];
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 100;
}

export function colorToolSource(state: ColorWorkingState): Record<string, unknown> {
  return {
    version: COLOR_TOOL_SOURCE_VERSION,
    colors: state.colors.map((color) => ({
      hex: normalizeHexOrFallback(color.hex),
      id: color.id,
      name: color.name,
      opacity: colorOpacity(state, color.id),
      ...(typeof color.proportion === 'number' ? { proportion: color.proportion } : {}),
      role: color.role,
    })),
    ...(state.colorPairings ? { colorPairings: state.colorPairings } : {}),
    ...(state.colorSystem ? { colorSystem: state.colorSystem } : {}),
  };
}

const COLOR_ID = /^[a-z][a-z0-9-]{0,39}$/;

function readPairings(value: unknown, ids: ReadonlySet<string>): BrandColorPairing[] {
  if (!Array.isArray(value)) throw new TypeError('colorPairings must be an array of { foreground, background, usage, level? }.');
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new TypeError(`colorPairings[${index}] must be an object.`);
    const record = entry as Record<string, unknown>;
    const foreground = sourceString(record, 'foreground', '');
    const background = sourceString(record, 'background', '');
    for (const [side, id] of [['foreground', foreground], ['background', background]] as const) {
      if (!ids.has(id)) throw new RangeError(`colorPairings[${index}].${side} "${id}" does not match any colors[].id.`);
    }
    const level = record.level;
    if (level !== undefined && level !== 'AA' && level !== 'AA-large') throw new RangeError(`colorPairings[${index}].level must be AA or AA-large.`);
    return { background, foreground, ...(level ? { level } : {}), usage: sourceString(record, 'usage', `${foreground} on ${background}`) };
  });
}

function readColorSystem(value: unknown, ids: ReadonlySet<string>): BrandColorSystem | undefined {
  if (value === null) return undefined;
  if (!value || typeof value !== 'object') throw new TypeError('colorSystem must be an object with light, dark and scales.');
  const record = value as Record<string, unknown>;
  const system: BrandColorSystem = {};
  for (const mode of ['light', 'dark'] as const) {
    const roles = record[mode];
    if (roles === undefined) continue;
    if (!roles || typeof roles !== 'object') throw new TypeError(`colorSystem.${mode} must be an object of role → color ref.`);
    const entries: [string, string][] = [];
    for (const [role, ref] of Object.entries(roles)) {
      if (!isSemanticColorRole(role)) throw new RangeError(`colorSystem.${mode}.${role} is not a semantic role.`);
      const parsed = typeof ref === 'string' ? parseColorRef(ref) : null;
      if (!parsed || !ids.has(parsed.id)) throw new RangeError(`colorSystem.${mode}.${role} "${String(ref)}" must be a color id or a scale step such as "ink.700".`);
      entries.push([role, ref as string]);
    }
    system[mode] = Object.fromEntries(entries);
  }
  if (record.scales !== undefined) {
    if (!Array.isArray(record.scales)) throw new TypeError('colorSystem.scales must be an array.');
    system.scales = record.scales.map((entry, index) => {
      const scale = entry as Record<string, unknown>;
      const id = sourceString(scale, 'id', '');
      if (!ids.has(id)) throw new RangeError(`colorSystem.scales[${index}].id "${id}" does not match any colors[].id.`);
      const number = (key: string, minimum: number, maximum: number) => {
        if (scale[key] === undefined) return {};
        const parsed = scale[key];
        if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
          throw new RangeError(`colorSystem.scales[${index}].${key} must be a number from ${minimum} to ${maximum}.`);
        }
        return { [key]: parsed };
      };
      return {
        id,
        ...(typeof scale.anchor === 'boolean' ? { anchor: scale.anchor } : {}),
        ...number('chroma', 0, 200),
        ...number('darkest', 0, 0.5),
        ...number('hueShift', -90, 90),
        ...number('lightest', 0.5, 1),
      };
    });
  }
  return compactColorSystem(system);
}

/** Validate Color tokens source and return the next working state. */
export function parseColorToolSource(current: ColorWorkingState, source: string | Record<string, unknown>): ColorWorkingState {
  const value = typeof source === 'string' ? parseSourceObject(source) : source;
  const entries = sourceObjectArray(value, 'colors');
  if (!entries) throw new TypeError('colors must be an array of color objects.');
  if (!entries.length) throw new RangeError('colors must contain at least one color.');
  const opacity: Record<string, number> = {};
  const colors = entries.map((entry, index): BrandColor => {
    const previous = current.colors[index];
    const id = sourceString(entry, 'id', previous?.id ?? `color-${index + 1}`);
    if (!COLOR_ID.test(id)) throw new RangeError(`colors[${index}].id "${id}" must be lowercase letters, digits and hyphens, starting with a letter.`);
    const rawHex = sourceString(entry, 'hex', previous?.hex ?? '#000000');
    if (!isHex(rawHex)) throw new RangeError(`colors[${index}].hex "${rawHex}" is not a HEX color.`);
    opacity[id] = Math.min(100, Math.max(0, sourceNumber(entry, 'opacity', colorOpacity(current, id))));
    const proportion = entry.proportion === undefined ? previous?.id === id ? previous.proportion : undefined : sourceNumber(entry, 'proportion', Number.NaN);
    if (proportion !== undefined && (!Number.isFinite(proportion) || proportion < 0 || proportion > 100)) throw new RangeError(`colors[${index}].proportion must be a number from 0 to 100.`);
    return {
      hex: normalizeHex(rawHex),
      id,
      name: sourceString(entry, 'name', previous?.name ?? `Color ${index + 1}`),
      ...(proportion !== undefined ? { proportion } : {}),
      role: sourceString(entry, 'role', previous?.role ?? ''),
    };
  });
  const ids = new Set<string>();
  colors.forEach((color, index) => {
    if (ids.has(color.id)) throw new RangeError(`colors[${index}].id "${color.id}" is already used; ids must be unique.`);
    ids.add(color.id);
  });
  const colorPairings = value.colorPairings !== undefined
    ? readPairings(value.colorPairings, ids)
    : current.colorPairings ? prunePairings(current.colorPairings, colors) : undefined;
  const colorSystem = value.colorSystem !== undefined
    ? readColorSystem(value.colorSystem, ids)
    : pruneColorSystem(current.colorSystem, colors);
  return {
    ...(colorPairings ? { colorPairings } : {}),
    ...(colorSystem ? { colorSystem } : {}),
    colors,
    opacity,
  };
}

// ── Tokens ──────────────────────────────────────────────────────────────────

export const COLOR_TOKEN_FORMATS = [
  { id: 'oklch-css', label: 'OKLCH CSS' },
  { id: 'css', label: 'CSS variables' },
  { id: 'tailwind', label: 'Tailwind v4' },
  { id: 'dtcg', label: 'Design tokens (DTCG)' },
] as const;

export type ColorTokenFormat = (typeof COLOR_TOKEN_FORMATS)[number]['id'];

const COLOR_TOKEN_SECTIONS: readonly BrandTokenSection[] = ['color', 'scale', 'semantic'];

export function isColorTokenFormat(value: unknown): value is ColorTokenFormat {
  return COLOR_TOKEN_FORMATS.some(({ id }) => id === value);
}

/** The original Color tokens output: one OKLCH custom property per color, named by color name, with opacity. */
export function legacyOklchTokens(state: ColorWorkingState): string {
  return state.colors
    .map((color) => `--color-${brandTokenName(color.name)}: ${formatOklch(color.hex).replace(')', ` / ${colorOpacity(state, color.id)}%)`)}; /* ${normalizeHexOrFallback(color.hex)} */`)
    .join('\n');
}

/** Color tokens in one format. CSS, Tailwind and DTCG come from brandTokens.ts. */
export function colorTokens(identity: BrandIdentity, state: ColorWorkingState, format: ColorTokenFormat = 'oklch-css'): string {
  if (format === 'oklch-css') return legacyOklchTokens(state);
  const working = withColorWorkingState(identity, state);
  const options = { include: COLOR_TOKEN_SECTIONS };
  if (format === 'css') return brandCssVariables(working, options);
  if (format === 'tailwind') return brandTailwindTheme(working, options);
  return `${JSON.stringify(brandDesignTokens(working, options), null, 2)}\n`;
}

// ── Version 1 drafts ────────────────────────────────────────────────────────

/**
 * Version 1 kept edited colors in a tool draft and never touched the identity.
 * Returns the draft as a working state when it differs from the identity palette,
 * so the tool can offer it as pending identity changes; otherwise null.
 */
export function migrateLegacyColorDraft(identity: BrandIdentity, legacy: unknown): ColorWorkingState | null {
  if (!Array.isArray(legacy) || !legacy.length) return null;
  try {
    const next = parseColorToolSource(colorWorkingState(identity), { colors: legacy });
    const changed = next.colors.length !== identity.colors.length || next.colors.some((color, index) => {
      const current = identity.colors[index];
      return !current || current.id !== color.id || normalizeHexOrFallback(current.hex) !== color.hex || current.name !== color.name || current.role !== color.role;
    });
    const opacityChanged = Object.values(next.opacity).some((value) => value !== 100);
    if (!changed && !opacityChanged) return null;
    // Keep the identity's proportions; version 1 did not store them.
    return {
      ...next,
      colors: next.colors.map((color) => {
        const proportion = identity.colors.find(({ id }) => id === color.id)?.proportion;
        return typeof proportion === 'number' ? { ...color, proportion } : color;
      }),
    };
  } catch {
    return null;
  }
}
