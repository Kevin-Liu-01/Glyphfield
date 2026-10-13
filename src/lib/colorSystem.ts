import type {
  BrandColor,
  BrandColorPairing,
  BrandColorScale,
  BrandColorSystem,
  BrandIdentity,
} from './brandIdentity';
import {
  colorContrastRatio,
  gamutMapOklch,
  hexToLinearRgb,
  hexToOklch,
  linearRgbToHex,
  normalizeHex,
  normalizeHexOrFallback,
  oklabDistance,
  oklchToHex,
} from './color';

/**
 * The colour system behind one identity, without React or DOM:
 * - OKLCH tint/shade scales per palette color (perceptually even lightness, gamut mapped).
 * - Semantic roles with derived light and dark mappings plus identity overrides.
 * - WCAG 2 and APCA contrast, the full palette matrix, and approved pairings.
 * - Colour-vision-deficiency simulation and confusable pairs.
 * - Proportion helpers for the 60/30/10 balance.
 *
 * A color ref is a palette id ("ink") or one of its scale steps ("ink.700").
 */

export const COLOR_SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type ColorScaleStep = (typeof COLOR_SCALE_STEPS)[number];

export const DEFAULT_COLOR_SCALE = {
  anchor: true,
  chroma: 100,
  darkest: 0.22,
  hueShift: 0,
  lightest: 0.975,
} as const;

export type ResolvedColorScaleSettings = {
  anchor: boolean;
  chroma: number;
  darkest: number;
  hueShift: number;
  lightest: number;
};

export type ColorScaleSwatch = {
  anchored: boolean;
  chroma: number;
  hex: string;
  hue: number;
  lightness: number;
  step: ColorScaleStep;
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function resolveColorScaleSettings(settings?: Partial<BrandColorScale>): ResolvedColorScaleSettings {
  const lightest = clamp(finite(settings?.lightest, DEFAULT_COLOR_SCALE.lightest), 0.5, 1);
  const darkest = clamp(finite(settings?.darkest, DEFAULT_COLOR_SCALE.darkest), 0, Math.min(0.5, lightest - 0.1));
  return {
    anchor: settings?.anchor ?? DEFAULT_COLOR_SCALE.anchor,
    chroma: clamp(finite(settings?.chroma, DEFAULT_COLOR_SCALE.chroma), 0, 200),
    darkest,
    hueShift: clamp(finite(settings?.hueShift, DEFAULT_COLOR_SCALE.hueShift), -90, 90),
    lightest,
  };
}

/**
 * Eleven steps with evenly spaced OKLCH lightness from `lightest` to `darkest`.
 * Chroma follows the base color and tapers toward white and black, then each
 * step is gamut mapped to sRGB by reducing chroma only. With `anchor`, the step
 * nearest the base lightness is the exact palette HEX.
 */
export function colorScale(hex: string, settings?: Partial<BrandColorScale>): ColorScaleSwatch[] {
  const base = hexToOklch(normalizeHexOrFallback(hex));
  const resolved = resolveColorScaleSettings(settings);
  const count = COLOR_SCALE_STEPS.length;
  const lightnessAt = (index: number) => resolved.lightest + (resolved.darkest - resolved.lightest) * (index / (count - 1));
  let anchorIndex = -1;
  if (resolved.anchor) {
    let nearest = Number.POSITIVE_INFINITY;
    COLOR_SCALE_STEPS.forEach((_, index) => {
      const distance = Math.abs(lightnessAt(index) - base.lightness);
      if (distance < nearest) {
        nearest = distance;
        anchorIndex = index;
      }
    });
  }
  const baseChroma = base.chroma * (resolved.chroma / 100);
  return COLOR_SCALE_STEPS.map((step, index) => {
    if (index === anchorIndex) {
      return { anchored: true, chroma: base.chroma, hex: normalizeHexOrFallback(hex), hue: base.hue, lightness: base.lightness, step };
    }
    const lightness = lightnessAt(index);
    const towardWhite = lightness > base.lightness;
    const span = towardWhite ? 1 - base.lightness : base.lightness;
    const distance = span > 0.0001 ? Math.abs(lightness - base.lightness) / span : 1;
    const envelope = 1 - Math.min(1, distance) ** 2 * (towardWhite ? 0.86 : 0.55);
    const hue = (((base.hue + resolved.hueShift * (index / (count - 1) - 0.5)) % 360) + 360) % 360;
    const mapped = gamutMapOklch({ chroma: baseChroma * envelope, hue, lightness });
    return { anchored: false, chroma: mapped.chroma, hex: oklchToHex(mapped), hue: mapped.hue, lightness: mapped.lightness, step };
  });
}

export function colorScaleSettings(identity: Pick<BrandIdentity, 'colorSystem'>, colorId: string): BrandColorScale | undefined {
  return identity.colorSystem?.scales?.find((scale) => scale.id === colorId);
}

/** Every palette color's scale, keyed by color id. */
export function brandColorScales(identity: Pick<BrandIdentity, 'colors' | 'colorSystem'>): Map<string, ColorScaleSwatch[]> {
  return new Map(identity.colors.map((color) => [color.id, colorScale(color.hex, colorScaleSettings(identity, color.id))]));
}

// ── Color refs ──────────────────────────────────────────────────────────────

export type ColorRef = { id: string; step?: ColorScaleStep };

const COLOR_REF_PATTERN = /^([a-z][a-z0-9-]{0,39})(?:\.(\d{2,3}))?$/;

export function parseColorRef(ref: string): ColorRef | null {
  const match = COLOR_REF_PATTERN.exec(ref.trim());
  if (!match) return null;
  if (match[2] === undefined) return { id: match[1]! };
  const step = Number(match[2]);
  return (COLOR_SCALE_STEPS as readonly number[]).includes(step) ? { id: match[1]!, step: step as ColorScaleStep } : null;
}

export function formatColorRef({ id, step }: ColorRef): string {
  return step === undefined ? id : `${id}.${step}`;
}

type ScaleCache = Map<string, ColorScaleSwatch[]>;

function scaleFor(identity: Pick<BrandIdentity, 'colors' | 'colorSystem'>, id: string, cache?: ScaleCache): ColorScaleSwatch[] | null {
  const cached = cache?.get(id);
  if (cached) return cached;
  const color = identity.colors.find((entry) => entry.id === id);
  if (!color) return null;
  const scale = colorScale(color.hex, colorScaleSettings(identity, id));
  cache?.set(id, scale);
  return scale;
}

/** HEX for a color ref, or null when it names no palette color or step. */
export function resolveColorRef(identity: Pick<BrandIdentity, 'colors' | 'colorSystem'>, ref: string, cache?: ScaleCache): string | null {
  const parsed = parseColorRef(ref);
  if (!parsed) return null;
  const color = identity.colors.find((entry) => entry.id === parsed.id);
  if (!color) return null;
  if (parsed.step === undefined) return normalizeHexOrFallback(color.hex);
  return scaleFor(identity, parsed.id, cache)?.find(({ step }) => step === parsed.step)?.hex ?? null;
}

// ── Contrast ────────────────────────────────────────────────────────────────

export type WcagLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';
export type ApcaLevel = 'body' | 'content' | 'large' | 'spot' | 'fail';

export function wcagLevel(ratio: number): WcagLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return 'fail';
}

/** APCA-W3 0.0.98G-4g lightness contrast (Lc). Positive for dark text on light backgrounds. */
export function apcaContrast(text: string, background: string): number {
  const luminance = (hex: string) => {
    const normalized = normalizeHexOrFallback(hex).slice(1);
    const [red, green, blue] = [0, 2, 4].map((offset) => (Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255) ** 2.4);
    return 0.2126729 * red! + 0.7151522 * green! + 0.072175 * blue!;
  };
  const softClamp = (y: number) => (y > 0.022 ? y : y + (0.022 - y) ** 1.414);
  const textY = softClamp(luminance(text));
  const backgroundY = softClamp(luminance(background));
  if (Math.abs(backgroundY - textY) < 0.0005) return 0;
  if (backgroundY > textY) {
    const sapc = (backgroundY ** 0.56 - textY ** 0.57) * 1.14;
    return sapc < 0.1 ? 0 : (sapc - 0.027) * 100;
  }
  const sapc = (backgroundY ** 0.65 - textY ** 0.62) * 1.14;
  return sapc > -0.1 ? 0 : (sapc + 0.027) * 100;
}

/** Bronze-level APCA use cases by |Lc|: body ≥ 75, content ≥ 60, large ≥ 45, spot ≥ 30. */
export function apcaLevel(lc: number): ApcaLevel {
  const value = Math.abs(lc);
  if (value >= 75) return 'body';
  if (value >= 60) return 'content';
  if (value >= 45) return 'large';
  if (value >= 30) return 'spot';
  return 'fail';
}

export type ContrastResult = {
  apca: number;
  apcaLevel: ApcaLevel;
  background: string;
  backgroundHex: string;
  foreground: string;
  foregroundHex: string;
  ratio: number;
  wcag: WcagLevel;
};

export function contrastResult(foreground: Pick<BrandColor, 'hex' | 'id'>, background: Pick<BrandColor, 'hex' | 'id'>): ContrastResult {
  const foregroundHex = normalizeHexOrFallback(foreground.hex);
  const backgroundHex = normalizeHexOrFallback(background.hex);
  const ratio = colorContrastRatio(foregroundHex, backgroundHex);
  const apca = apcaContrast(foregroundHex, backgroundHex);
  return {
    apca,
    apcaLevel: apcaLevel(apca),
    background: background.id,
    backgroundHex,
    foreground: foreground.id,
    foregroundHex,
    ratio,
    wcag: wcagLevel(ratio),
  };
}

/** Rows are foregrounds, columns are backgrounds, both in palette order. The diagonal is included. */
export function contrastMatrix(colors: readonly Pick<BrandColor, 'hex' | 'id'>[]): ContrastResult[][] {
  return colors.map((foreground) => colors.map((background) => contrastResult(foreground, background)));
}

// ── Pairings ────────────────────────────────────────────────────────────────

export function pairingLevelForRatio(ratio: number): BrandColorPairing['level'] | null {
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA-large';
  return null;
}

export function pairingRequiredRatio(pairing: Pick<BrandColorPairing, 'level'>): number {
  return pairing.level === 'AA-large' ? 3 : 4.5;
}

export function findPairing(pairings: readonly BrandColorPairing[], foreground: string, background: string): BrandColorPairing | undefined {
  return pairings.find((pairing) => pairing.foreground === foreground && pairing.background === background);
}

/**
 * Add or remove one approved text pairing. A new pairing records the best level its
 * contrast reaches; pairs below 3:1 cannot be approved and return the list unchanged.
 */
export function toggleColorPairing(
  pairings: readonly BrandColorPairing[],
  colors: readonly Pick<BrandColor, 'hex' | 'id' | 'name'>[],
  foreground: string,
  background: string
): BrandColorPairing[] {
  if (findPairing(pairings, foreground, background)) {
    return pairings.filter((pairing) => !(pairing.foreground === foreground && pairing.background === background));
  }
  const foregroundColor = colors.find(({ id }) => id === foreground);
  const backgroundColor = colors.find(({ id }) => id === background);
  if (!foregroundColor || !backgroundColor || foreground === background) return [...pairings];
  const level = pairingLevelForRatio(colorContrastRatio(normalizeHexOrFallback(foregroundColor.hex), normalizeHexOrFallback(backgroundColor.hex)));
  if (!level) return [...pairings];
  return [...pairings, {
    background,
    foreground,
    level,
    usage: level === 'AA' ? `${foregroundColor.name} text on ${backgroundColor.name}` : `Large ${foregroundColor.name} type and icons on ${backgroundColor.name}`,
  }];
}

/** Pairings whose colors exist; levels are kept as declared so a regression stays visible. */
export function prunePairings(pairings: readonly BrandColorPairing[], colors: readonly Pick<BrandColor, 'id'>[]): BrandColorPairing[] {
  const ids = new Set(colors.map(({ id }) => id));
  return pairings.filter((pairing) => ids.has(pairing.foreground) && ids.has(pairing.background));
}

// ── Semantic roles ──────────────────────────────────────────────────────────

export const SEMANTIC_COLOR_ROLES = [
  { id: 'background', kind: 'surface', label: 'Background', usage: 'Page canvas behind everything' },
  { id: 'surface', kind: 'surface', label: 'Surface', usage: 'Cards, panels, inputs and menus' },
  { id: 'surface-muted', kind: 'surface', label: 'Muted surface', usage: 'Quiet fills, hover rows and table headers' },
  { id: 'foreground', kind: 'text', label: 'Text', usage: 'Body text, headings and icons' },
  { id: 'foreground-muted', kind: 'text', label: 'Muted text', usage: 'Secondary text, hints and metadata' },
  { id: 'border', kind: 'line', label: 'Border', usage: 'Dividers, outlines and input borders' },
  { id: 'primary', kind: 'accent', label: 'Primary', usage: 'Primary actions, selection and links' },
  { id: 'primary-foreground', kind: 'text', label: 'On primary', usage: 'Text and icons on primary' },
  { id: 'focus', kind: 'line', label: 'Focus ring', usage: 'Keyboard focus outline' },
  { id: 'positive', kind: 'status', label: 'Positive', usage: 'Success and healthy states' },
  { id: 'caution', kind: 'status', label: 'Caution', usage: 'Warnings that need attention' },
  { id: 'negative', kind: 'status', label: 'Negative', usage: 'Errors and destructive actions' },
] as const;

export type SemanticColorRole = (typeof SEMANTIC_COLOR_ROLES)[number]['id'];
export type ColorMode = 'light' | 'dark';
export const COLOR_MODES: readonly ColorMode[] = ['light', 'dark'];

export function isSemanticColorRole(value: string): value is SemanticColorRole {
  return SEMANTIC_COLOR_ROLES.some(({ id }) => id === value);
}

/** Text and non-text pairs every mode must pass; non-text and status need 3:1. */
export const SEMANTIC_CONTRAST_CHECKS: readonly { background: SemanticColorRole; foreground: SemanticColorRole; minimum: number }[] = [
  { background: 'background', foreground: 'foreground', minimum: 4.5 },
  { background: 'surface', foreground: 'foreground', minimum: 4.5 },
  { background: 'surface-muted', foreground: 'foreground', minimum: 4.5 },
  { background: 'background', foreground: 'foreground-muted', minimum: 4.5 },
  { background: 'surface', foreground: 'foreground-muted', minimum: 4.5 },
  { background: 'primary', foreground: 'primary-foreground', minimum: 4.5 },
  { background: 'background', foreground: 'primary', minimum: 3 },
  { background: 'background', foreground: 'focus', minimum: 3 },
  { background: 'background', foreground: 'positive', minimum: 3 },
  { background: 'background', foreground: 'caution', minimum: 3 },
  { background: 'background', foreground: 'negative', minimum: 3 },
];

type PaletteSource = Pick<BrandIdentity, 'colors' | 'colorSystem'>;

function paletteIdFor(identity: PaletteSource, id: string, index: number): string | undefined {
  return identity.colors.find((color) => color.id === id)?.id ?? identity.colors[index]?.id;
}

function stepRef(id: string, step: ColorScaleStep): string {
  return `${id}.${step}`;
}

/** The scale step whose contrast against `background` is the lowest that still meets `minimum`. */
function quietestReadableStep(identity: PaletteSource, id: string, background: string, minimum: number, cache: ScaleCache): string | null {
  const scale = scaleFor(identity, id, cache);
  if (!scale) return null;
  const candidates = scale
    .map((swatch) => ({ ratio: colorContrastRatio(swatch.hex, background), swatch }))
    .filter(({ ratio }) => ratio >= minimum)
    .sort((first, second) => first.ratio - second.ratio);
  const best = candidates[0]?.swatch;
  return best ? (best.anchored ? id : stepRef(id, best.step)) : null;
}

/** The scale step whose contrast against `background` is nearest `target`. */
function stepNearContrast(identity: PaletteSource, id: string, background: string, target: number, cache: ScaleCache): string | null {
  const scale = scaleFor(identity, id, cache);
  if (!scale) return null;
  const best = [...scale].sort((first, second) => (
    Math.abs(colorContrastRatio(first.hex, background) - target) - Math.abs(colorContrastRatio(second.hex, background) - target)
  ))[0];
  return best ? (best.anchored ? id : stepRef(id, best.step)) : null;
}

/** The scale step nearest a target OKLCH lightness. */
function stepNearLightness(identity: PaletteSource, id: string, lightness: number, cache: ScaleCache): string | null {
  const scale = scaleFor(identity, id, cache);
  if (!scale) return null;
  const best = [...scale].sort((first, second) => Math.abs(first.lightness - lightness) - Math.abs(second.lightness - lightness))[0];
  return best ? (best.anchored ? id : stepRef(id, best.step)) : null;
}

/** The color itself when it reaches `minimum` on `background`, else its nearest scale step that does. */
function readableVariant(identity: PaletteSource, id: string, background: string, minimum: number, cache: ScaleCache): string {
  const hex = resolveColorRef(identity, id, cache);
  if (!hex || colorContrastRatio(hex, background) >= minimum) return id;
  const base = hexToOklch(hex).lightness;
  const scale = scaleFor(identity, id, cache) ?? [];
  const best = scale
    .filter((swatch) => colorContrastRatio(swatch.hex, background) >= minimum)
    .sort((first, second) => Math.abs(first.lightness - base) - Math.abs(second.lightness - base))[0];
  return best ? (best.anchored ? id : stepRef(id, best.step)) : id;
}

function betterContrast(identity: PaletteSource, background: string, candidates: readonly string[], cache: ScaleCache): string {
  return [...candidates].sort((first, second) => (
    colorContrastRatio(resolveColorRef(identity, second, cache) ?? '#000000', background)
      - colorContrastRatio(resolveColorRef(identity, first, cache) ?? '#000000', background)
  ))[0] ?? candidates[0]!;
}

/** The next lighter step of a ref's scale, or the ref itself at the light end. */
function lighterStep(identity: PaletteSource, ref: string, cache: ScaleCache): string {
  const parsed = parseColorRef(ref);
  const scale = parsed ? scaleFor(identity, parsed.id, cache) : null;
  if (!parsed || !scale) return ref;
  const index = parsed.step === undefined
    ? scale.findIndex(({ anchored }) => anchored)
    : scale.findIndex(({ step }) => step === parsed.step);
  const lighter = index > 0 ? scale[index - 1] : undefined;
  if (!lighter) return ref;
  return lighter.anchored ? parsed.id : stepRef(parsed.id, lighter.step);
}

/**
 * Semantic roles derived from the palette ids ink, paper, muted, emphasis, success,
 * warning and error. Surfaces stay flat (cards separate with borders); text and
 * status roles use the nearest scale step that stays readable; primary keeps the
 * exact brand accent in light mode.
 */
export function defaultSemanticMapping(identity: PaletteSource, mode: ColorMode, cache: ScaleCache = new Map()): Record<SemanticColorRole, string> {
  const ink = paletteIdFor(identity, 'ink', 0) ?? 'ink';
  const paper = paletteIdFor(identity, 'paper', 1) ?? ink;
  const accent = paletteIdFor(identity, 'emphasis', 3) ?? ink;
  const lightness = (ref: string) => hexToOklch(resolveColorRef(identity, ref, cache) ?? '#000000').lightness;
  const [dark, light] = lightness(ink) <= lightness(paper) ? [ink, paper] : [paper, ink];
  const paletteId = (id: string) => identity.colors.find((color) => color.id === id)?.id;

  if (mode === 'light') {
    const background = light;
    const backgroundHex = resolveColorRef(identity, background, cache) ?? '#FFFFFF';
    const muted = paletteId('muted') ?? stepNearLightness(identity, dark, 0.95, cache) ?? background;
    const primaryHex = resolveColorRef(identity, accent, cache) ?? backgroundHex;
    const status = (id: string, fallback: string) => {
      const found = paletteId(id);
      return found ? readableVariant(identity, found, backgroundHex, 3, cache) : fallback;
    };
    return {
      background,
      border: stepNearContrast(identity, dark, backgroundHex, 1.45, cache) ?? muted,
      caution: status('warning', accent),
      focus: colorContrastRatio(primaryHex, backgroundHex) >= 3 ? accent : dark,
      foreground: dark,
      'foreground-muted': quietestReadableStep(identity, dark, backgroundHex, 4.5, cache) ?? dark,
      negative: status('error', dark),
      positive: status('success', accent),
      primary: accent,
      'primary-foreground': betterContrast(identity, primaryHex, [light, dark], cache),
      surface: background,
      'surface-muted': muted,
    };
  }

  const background = lightness(dark) <= 0.3 ? dark : stepNearLightness(identity, dark, 0.2, cache) ?? dark;
  const backgroundHex = resolveColorRef(identity, background, cache) ?? '#000000';
  const primary = readableVariant(identity, accent, backgroundHex, 3, cache);
  const primaryHex = resolveColorRef(identity, primary, cache) ?? backgroundHex;
  const status = (id: string, fallback: string) => {
    const found = paletteId(id);
    return found ? readableVariant(identity, found, backgroundHex, 3, cache) : fallback;
  };
  return {
    background,
    border: stepNearContrast(identity, dark, backgroundHex, 1.45, cache) ?? background,
    caution: status('warning', primary),
    focus: primary,
    foreground: light,
    'foreground-muted': quietestReadableStep(identity, dark, backgroundHex, 4.5, cache) ?? light,
    negative: status('error', light),
    positive: status('success', primary),
    primary,
    'primary-foreground': betterContrast(identity, primaryHex, [background, light], cache),
    surface: background,
    'surface-muted': lighterStep(identity, background, cache),
  };
}

export type ResolvedSemanticColor = {
  /** Derived default ref for this role and mode. */
  defaultRef: string;
  hex: string;
  overridden: boolean;
  ref: string;
};

export type ResolvedSemanticColors = Record<SemanticColorRole, ResolvedSemanticColor>;

/** Defaults plus the identity's overrides; an override that resolves to nothing falls back to the default. */
export function resolveSemanticColors(identity: PaletteSource, mode: ColorMode, cache: ScaleCache = new Map()): ResolvedSemanticColors {
  const defaults = defaultSemanticMapping(identity, mode, cache);
  const overrides = identity.colorSystem?.[mode] ?? {};
  return Object.fromEntries(SEMANTIC_COLOR_ROLES.map(({ id }) => {
    const override = overrides[id];
    const overrideHex = typeof override === 'string' ? resolveColorRef(identity, override, cache) : null;
    const defaultRef = defaults[id];
    const ref = overrideHex ? override! : defaultRef;
    return [id, {
      defaultRef,
      hex: overrideHex ?? resolveColorRef(identity, defaultRef, cache) ?? '#000000',
      overridden: Boolean(overrideHex),
      ref,
    }];
  })) as ResolvedSemanticColors;
}

export function semanticHexes(resolved: ResolvedSemanticColors): Record<SemanticColorRole, string> {
  return Object.fromEntries(Object.entries(resolved).map(([role, value]) => [role, value.hex])) as Record<SemanticColorRole, string>;
}

export type SemanticContrastCheck = (typeof SEMANTIC_CONTRAST_CHECKS)[number] & { passes: boolean; ratio: number };

export function semanticContrastChecks(resolved: ResolvedSemanticColors): SemanticContrastCheck[] {
  return SEMANTIC_CONTRAST_CHECKS.map((check) => {
    const ratio = colorContrastRatio(resolved[check.foreground].hex, resolved[check.background].hex);
    return { ...check, passes: ratio >= check.minimum, ratio };
  });
}

/** Set or clear (ref = null, or the derived default) one role override, dropping empty containers. */
export function setSemanticOverride(
  identity: PaletteSource,
  mode: ColorMode,
  role: SemanticColorRole,
  ref: string | null
): BrandColorSystem | undefined {
  const defaults = defaultSemanticMapping(identity, mode);
  const current = { ...(identity.colorSystem?.[mode] ?? {}) };
  if (ref === null || ref === defaults[role]) delete current[role];
  else current[role] = ref;
  return compactColorSystem({ ...identity.colorSystem, [mode]: current });
}

/** Update one color's scale settings; settings equal to the defaults are dropped. */
export function setColorScaleSettings(
  identity: PaletteSource,
  colorId: string,
  patch: Partial<Omit<BrandColorScale, 'id'>> | null
): BrandColorSystem | undefined {
  const scales = (identity.colorSystem?.scales ?? []).filter((scale) => scale.id !== colorId);
  if (patch) {
    const merged = { ...colorScaleSettings(identity, colorId), ...patch, id: colorId };
    const next: BrandColorScale = { id: colorId };
    for (const key of ['anchor', 'chroma', 'darkest', 'hueShift', 'lightest'] as const) {
      const value = merged[key];
      if (value !== undefined && value !== DEFAULT_COLOR_SCALE[key]) (next as Record<string, unknown>)[key] = value;
    }
    if (Object.keys(next).length > 1) scales.push(next);
  }
  return compactColorSystem({ ...identity.colorSystem, scales });
}

export function compactColorSystem(system: BrandColorSystem | undefined): BrandColorSystem | undefined {
  if (!system) return undefined;
  const next: BrandColorSystem = {};
  for (const mode of COLOR_MODES) {
    const entries = Object.entries(system[mode] ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0);
    if (entries.length) next[mode] = Object.fromEntries(entries);
  }
  if (system.scales?.length) next.scales = system.scales.map((scale) => ({ ...scale }));
  return Object.keys(next).length ? next : undefined;
}

/** Drop overrides and scales that point at colors that no longer exist. */
export function pruneColorSystem(system: BrandColorSystem | undefined, colors: readonly Pick<BrandColor, 'id'>[]): BrandColorSystem | undefined {
  if (!system) return undefined;
  const ids = new Set(colors.map(({ id }) => id));
  const keep = (ref: string) => {
    const parsed = parseColorRef(ref);
    return Boolean(parsed && ids.has(parsed.id));
  };
  return compactColorSystem({
    dark: Object.fromEntries(Object.entries(system.dark ?? {}).filter(([, ref]) => typeof ref === 'string' && keep(ref))),
    light: Object.fromEntries(Object.entries(system.light ?? {}).filter(([, ref]) => typeof ref === 'string' && keep(ref))),
    scales: system.scales?.filter((scale) => ids.has(scale.id)),
  });
}

// ── Colour vision ───────────────────────────────────────────────────────────

export const COLOR_VISION_MODES = [
  { id: 'normal', label: 'Typical vision', prevalence: '' },
  { id: 'protanopia', label: 'Protanopia', prevalence: 'No red cones · about 1% of men' },
  { id: 'deuteranopia', label: 'Deuteranopia', prevalence: 'No green cones · about 1% of men' },
  { id: 'tritanopia', label: 'Tritanopia', prevalence: 'No blue cones · rare' },
  { id: 'achromatopsia', label: 'Achromatopsia', prevalence: 'No color · rare' },
] as const;

export type ColorVisionMode = (typeof COLOR_VISION_MODES)[number]['id'];

// Machado, Oliveira and Fernandes (2009), severity 1.0, applied in linear sRGB.
const CVD_MATRICES: Record<'deuteranopia' | 'protanopia' | 'tritanopia', readonly [readonly number[], readonly number[], readonly number[]]> = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

export function simulateColorVision(hex: string, mode: ColorVisionMode): string {
  const normalized = normalizeHexOrFallback(hex);
  if (mode === 'normal') return normalized;
  const linear = hexToLinearRgb(normalized);
  if (mode === 'achromatopsia') {
    const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
    return linearRgbToHex([luminance, luminance, luminance]);
  }
  const matrix = CVD_MATRICES[mode];
  const [red, green, blue] = matrix.map((row) => row[0]! * linear[0] + row[1]! * linear[1] + row[2]! * linear[2]) as [number, number, number];
  return linearRgbToHex([red, green, blue]);
}

export type ConfusablePair = { distance: number; first: string; second: string; typicalDistance: number };

/**
 * Palette pairs that are distinct in typical vision but nearly merge under `mode`.
 * Distances are OKLab; below about 0.06 two flat swatches are hard to tell apart.
 */
export function confusableColorPairs(colors: readonly Pick<BrandColor, 'hex' | 'id'>[], mode: ColorVisionMode, threshold = 0.06): ConfusablePair[] {
  if (mode === 'normal') return [];
  const pairs: ConfusablePair[] = [];
  colors.forEach((first, index) => {
    for (const second of colors.slice(index + 1)) {
      const typicalDistance = oklabDistance(normalizeHexOrFallback(first.hex), normalizeHexOrFallback(second.hex));
      if (typicalDistance < threshold * 1.6) continue;
      const distance = oklabDistance(simulateColorVision(first.hex, mode), simulateColorVision(second.hex, mode));
      if (distance < threshold) pairs.push({ distance, first: first.id, second: second.id, typicalDistance });
    }
  });
  return pairs.sort((first, second) => first.distance - second.distance);
}

// ── Proportion ──────────────────────────────────────────────────────────────

export function proportionTotal(colors: readonly Pick<BrandColor, 'proportion'>[]): number {
  return colors.reduce((sum, color) => sum + (typeof color.proportion === 'number' ? color.proportion : 0), 0);
}

/** Whole numbers proportional to `weights` that add up to exactly `total` (largest remainder). */
function distributeWhole(weights: readonly number[], total: number): number[] {
  const weightSum = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);
  if (weightSum <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((weight) => (Math.max(0, weight) / weightSum) * total);
  const whole = raw.map(Math.floor);
  let remainder = total - whole.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ fraction: value - Math.floor(value), index })).sort((first, second) => second.fraction - first.fraction);
  for (const { index } of order) {
    if (remainder <= 0) break;
    whole[index]! += 1;
    remainder -= 1;
  }
  return whole;
}

/** Scale proportions to sum to exactly 100 with whole numbers. */
export function normalizeProportions<T extends Pick<BrandColor, 'proportion'>>(colors: readonly T[]): T[] {
  if (proportionTotal(colors) <= 0) return colors.map((color) => ({ ...color }));
  const shares = distributeWhole(colors.map((color) => color.proportion ?? 0), 100);
  return colors.map((color, index) => ({ ...color, proportion: shares[index]! }));
}

/**
 * Set one color's share. With `rebalance`, the other shares keep their ratios and fill
 * the rest so the total is exactly 100; otherwise only the one value changes.
 */
export function setColorProportion<T extends Pick<BrandColor, 'id' | 'proportion'>>(colors: readonly T[], id: string, value: number, rebalance: boolean): T[] {
  const share = Math.round(clamp(value, 0, 100));
  const next = colors.map((color) => (color.id === id ? { ...color, proportion: share } : { ...color }));
  if (!rebalance) return next;
  const others = next.filter((color) => color.id !== id);
  if (!others.length) return next;
  const otherTotal = proportionTotal(others);
  // Spread evenly when the others have no shares yet.
  const shares = distributeWhole(others.map((color) => (otherTotal > 0 ? color.proportion ?? 0 : 1)), 100 - share);
  const byId = new Map(others.map((color, index) => [color.id, shares[index]!]));
  return next.map((color) => ({ ...color, proportion: color.id === id ? share : byId.get(color.id) ?? 0 }));
}

export type ProportionSummary = {
  accent: number;
  dominant: { id: string; share: number } | null;
  passes: boolean;
  total: number;
};

/** The same balance the brand audit checks: total near 100, a dominant field ≥ 45, accent ≤ 20. */
export function proportionSummary(colors: readonly Pick<BrandColor, 'id' | 'proportion'>[]): ProportionSummary {
  const shares = colors.filter((color) => typeof color.proportion === 'number');
  const total = proportionTotal(shares);
  const dominant = shares.reduce<{ id: string; share: number } | null>((best, color) => (
    !best || (color.proportion ?? 0) > best.share ? { id: color.id, share: color.proportion ?? 0 } : best
  ), null);
  const accent = colors.find(({ id }) => id === 'emphasis')?.proportion ?? 0;
  return {
    accent,
    dominant,
    passes: shares.length > 0 && total >= 90 && total <= 110 && (dominant?.share ?? 0) >= 45 && accent <= 20,
    total,
  };
}

// ── Palette editing ─────────────────────────────────────────────────────────

/** Palette ids every Glyphfield tool reads; they can be edited but not removed. */
export const CORE_COLOR_IDS = ['ink', 'paper', 'muted', 'emphasis'] as const;

export function nextColorId(colors: readonly Pick<BrandColor, 'id'>[], base = 'color'): string {
  const ids = new Set(colors.map(({ id }) => id));
  for (let index = 1; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!ids.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/** Remove a non-core color and every pairing, override and scale that referenced it. */
export function removePaletteColor(identity: BrandIdentity, id: string): BrandIdentity {
  if ((CORE_COLOR_IDS as readonly string[]).includes(id)) return identity;
  const colors = identity.colors.filter((color) => color.id !== id);
  const colorSystem = pruneColorSystem(identity.colorSystem, colors);
  const { colorSystem: _previous, ...rest } = identity;
  return {
    ...rest,
    ...(identity.colorPairings ? { colorPairings: prunePairings(identity.colorPairings, colors) } : {}),
    ...(colorSystem ? { colorSystem } : {}),
    colors,
  };
}

/** Replace the colorSystem field, removing it when empty. */
export function withColorSystem(identity: BrandIdentity, colorSystem: BrandColorSystem | undefined): BrandIdentity {
  const { colorSystem: _previous, ...rest } = identity;
  return colorSystem ? { ...rest, colorSystem } : rest;
}

export function safeHex(value: unknown, fallback = '#000000'): string {
  return normalizeHexOrFallback(value, fallback);
}

export function isHex(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    normalizeHex(value);
    return true;
  } catch {
    return false;
  }
}
