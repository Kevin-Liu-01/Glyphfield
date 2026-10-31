import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
  type BrandTypography,
} from './brandIdentity';
import { commentText, cssTimingFunction } from './brandOutputKit';
import { formatOklch, normalizeHex } from './color';
import {
  brandColorScales,
  COLOR_MODES,
  resolveSemanticColors,
  SEMANTIC_COLOR_ROLES,
  type ColorMode,
} from './colorSystem';

/**
 * Pure design-token serializers for one BrandIdentity. No React or DOM.
 *
 * - brandDesignTokens(identity): W3C Design Tokens Community Group JSON (2025.10 format).
 * - brandCssVariables(identity, options): `:root` custom properties prefixed `--brand-`.
 * - brandTailwindTheme(identity, options): a Tailwind CSS v4 `@theme` block.
 * - brandTypeScale(identity): the modular type scale steps (caption … display).
 * - brandFontStack(family, role): a family plus a generic fallback stack.
 * - brandTokenName(value): a token-safe kebab-case name.
 *
 * Token names: colors use their identity `id` (`--brand-color-ink`, `--color-ink`);
 * scale steps append the step (`--brand-color-ink-700`, `--color-ink-700`);
 * semantic roles are SEMANTIC_COLOR_ROLES with light and dark values
 * (`--brand-primary`, Tailwind `bg-primary`); typography roles are
 * display/body/accent/code; type steps are BRAND_TYPE_STEPS.
 *
 * `include` limits output to some sections, such as ['type'] for type tokens only.
 */

export type BrandTypeStep = {
  /** Step name used in token names, such as `body` or `display`. */
  name: string;
  /** Power of the scale ratio relative to the base size. */
  step: number;
};

export type BrandTypeScaleStep = BrandTypeStep & {
  px: number;
  rem: number;
};

export type BrandTokenSection = 'color' | 'scale' | 'semantic' | 'type' | 'radius' | 'motion';

export const BRAND_TOKEN_SECTIONS: readonly BrandTokenSection[] = ['color', 'scale', 'semantic', 'type', 'radius', 'motion'];

export type BrandTokenSerializerOptions = {
  /** Complete `@font-face` rules to prepend, such as the brand kit's local font files. */
  fontFaces?: readonly string[];
  /** Sections to emit; every section when omitted. */
  include?: readonly BrandTokenSection[];
};

function sectionFilter(options: BrandTokenSerializerOptions): (section: BrandTokenSection) => boolean {
  const include = options.include?.length ? new Set(options.include) : null;
  return (section) => !include || include.has(section);
}

/** Modular steps from caption (-2) to display (+6). */
export const BRAND_TYPE_STEPS: readonly BrandTypeStep[] = [
  { name: 'caption', step: -2 },
  { name: 'small', step: -1 },
  { name: 'body', step: 0 },
  { name: 'lead', step: 1 },
  { name: 'h4', step: 2 },
  { name: 'h3', step: 3 },
  { name: 'h2', step: 4 },
  { name: 'h1', step: 5 },
  { name: 'display', step: 6 },
];

export const DEFAULT_BRAND_TYPE_SCALE = { basePx: 16, ratio: 1.25 } as const;

/** The type step each typography role is set at by default. */
export const BRAND_ROLE_TYPE_STEP: Readonly<Record<BrandTypography['role'], string>> = {
  Accent: 'lead',
  Body: 'body',
  Code: 'small',
  Display: 'display',
};

const ROLES: readonly BrandTypography['role'][] = ['Display', 'Body', 'Accent', 'Code'];

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function brandTokenName(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'token';
}

/** The type step a role is set at: the identity's typeScale.roleSteps entry, else the default. */
export function brandRoleTypeStep(identity: Pick<BrandIdentity, 'typeScale'>, role: BrandTypography['role']): string {
  const step = identity.typeScale?.roleSteps?.[role];
  return step && BRAND_TYPE_STEPS.some(({ name }) => name === step) ? step : BRAND_ROLE_TYPE_STEP[role];
}

/**
 * Tracking relative to size: the role's px tracking divided by the px size it is set at,
 * so large display type keeps its slight negative tracking at any size.
 */
export function brandTrackingEm(letterSpacingPx: number, sizePx: number): string {
  const em = sizePx > 0 ? Math.round((letterSpacingPx / sizePx) * 1000) / 1000 : 0;
  return em === 0 ? '0' : `${em}em`;
}

/** CSS font-variation-settings for a role's fixed axes, or null when the role uses none. */
export function brandFontVariationSettings(typography: Pick<BrandTypography, 'opticalSize'>): string | null {
  return typeof typography.opticalSize === 'number' ? `"opsz" ${typography.opticalSize}` : null;
}

/** CSS font-style for a role: `oblique Ndeg` when a slant is set. */
export function brandFontStyle(typography: Pick<BrandTypography, 'slant'>): string | null {
  return typeof typography.slant === 'number' && typography.slant !== 0 ? `oblique ${typography.slant}deg` : null;
}

/** Sizes are basePx × ratio^step, rounded to 0.01px; rem assumes a 16px root. */
export function brandTypeScale(identity: Pick<BrandIdentity, 'typeScale'>): BrandTypeScaleStep[] {
  const { basePx, ratio } = identity.typeScale ?? DEFAULT_BRAND_TYPE_SCALE;
  return BRAND_TYPE_STEPS.map(({ name, step }) => {
    const px = round(basePx * ratio ** step, 2);
    return { name, px, rem: round(px / 16, 4), step };
  });
}

export function brandFontStack(family: string, role: BrandTypography['role']): string[] {
  if (role === 'Code' || /mono/i.test(family)) return [family, 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'];
  if (/serif|flare|garamond|tiempos|times/i.test(family) && !/sans/i.test(family)) return [family, 'ui-serif', 'Georgia', 'serif'];
  return [family, 'ui-sans-serif', 'system-ui', 'sans-serif'];
}

/** Quote the brand family; the generic fallbacks are plain identifiers. */
function cssFontStack(stack: readonly string[]): string {
  return stack.map((name, index) => (index === 0 ? JSON.stringify(name) : name)).join(', ');
}

/** Parse `cubic-bezier(x1, y1, x2, y2)` into numbers, or null for any other easing. */
export function parseCubicBezier(curve: string): [number, number, number, number] | null {
  const match = curve.match(/cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/i);
  if (!match) return null;
  const values = match.slice(1, 5).map(Number) as [number, number, number, number];
  return values.every(Number.isFinite) ? values : null;
}

function rgbComponents(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex).slice(1);
  return [0, 2, 4].map((offset) => round(Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255, 4)) as [number, number, number];
}

function roleKey(role: BrandTypography['role']): string {
  return role.toLocaleLowerCase();
}

function dtcgColor(hex: string): { colorSpace: 'srgb'; components: [number, number, number]; hex: string } {
  return { colorSpace: 'srgb', components: rgbComponents(hex), hex: normalizeHex(hex).toLocaleLowerCase() };
}

/** A DTCG alias for a color ref: `{color.ink}` or `{palette.ink.700}`. */
function dtcgColorAlias(ref: string): string {
  const [id, step] = ref.split('.');
  return step ? `{palette.${id}.${step}}` : `{color.${id}}`;
}

/**
 * W3C Design Tokens Community Group format (2025.10): color, palette (OKLCH scales),
 * semantic (light and dark roles as aliases), font, size, typography, radius, motion.
 */
export function brandDesignTokens(identity: BrandIdentity, options: BrandTokenSerializerOptions = {}): Record<string, unknown> {
  const includes = sectionFilter(options);
  const color = Object.fromEntries(identity.colors.map((entry) => [entry.id, {
    $description: entry.role,
    $extensions: { 'app.glyphfield': { name: entry.name, ...(typeof entry.proportion === 'number' ? { proportion: entry.proportion } : {}) } },
    $type: 'color',
    $value: dtcgColor(entry.hex),
  }]));
  const scales = brandColorScales(identity);
  const palette = Object.fromEntries([...scales].map(([id, scale]) => [id, Object.fromEntries(scale.map((swatch) => [String(swatch.step), {
    ...(swatch.anchored ? { $extensions: { 'app.glyphfield': { anchored: true } } } : {}),
    $type: 'color',
    $value: dtcgColor(swatch.hex),
  }]))]));
  const semantic = Object.fromEntries(COLOR_MODES.map((mode) => {
    const resolved = semanticColors(identity, mode);
    return [mode, Object.fromEntries(SEMANTIC_COLOR_ROLES.map(({ id, usage }) => [id, {
      $description: usage,
      $type: 'color',
      $value: dtcgColorAlias(resolved[id].ref),
    }]))];
  }));
  const family = Object.fromEntries(ROLES.map((role) => [roleKey(role), {
    $description: brandTypographyRole(identity, role).usage,
    $type: 'fontFamily',
    $value: brandFontStack(brandTypographyFamily(identity, role), role),
  }]));
  const weight = Object.fromEntries(ROLES.map((role) => [roleKey(role), {
    $type: 'fontWeight',
    $value: brandTypographyRole(identity, role).weight ?? 400,
  }]));
  const size = Object.fromEntries(brandTypeScale(identity).map(({ name, px }) => [name, {
    $type: 'dimension',
    $value: { unit: 'px', value: px },
  }]));
  const typography = Object.fromEntries(ROLES.map((role) => {
    const typographyRole = brandTypographyRole(identity, role);
    const key = roleKey(role);
    const axes = {
      ...(typeof typographyRole.opticalSize === 'number' ? { opticalSize: typographyRole.opticalSize } : {}),
      ...(typeof typographyRole.slant === 'number' && typographyRole.slant !== 0 ? { slant: typographyRole.slant } : {}),
    };
    return [key, {
      $description: typographyRole.usage,
      ...(Object.keys(axes).length ? { $extensions: { 'app.glyphfield': axes } } : {}),
      $type: 'typography',
      $value: {
        fontFamily: `{font.family.${key}}`,
        fontSize: `{size.${brandRoleTypeStep(identity, role)}}`,
        fontWeight: `{font.weight.${key}}`,
        letterSpacing: { unit: 'px', value: typographyRole.letterSpacing ?? 0 },
        lineHeight: typographyRole.lineHeight ?? 1.5,
      },
    }];
  }));
  const motion = Object.fromEntries(identity.motion.map((entry) => {
    const curve = parseCubicBezier(entry.curve);
    return [brandTokenName(entry.id), {
      $description: entry.description,
      duration: { $type: 'duration', $value: { unit: 'ms', value: entry.durationMs } },
      ...(curve ? { easing: { $type: 'cubicBezier', $value: curve } } : {}),
    }];
  }));
  return {
    $description: `${identity.name} design tokens, exported by Glyphfield.`,
    $extensions: {
      'app.glyphfield': {
        identityId: identity.id,
        name: identity.name,
        revision: identity.revision,
        typeScale: identity.typeScale ?? DEFAULT_BRAND_TYPE_SCALE,
      },
    },
    ...(includes('color') ? { color } : {}),
    ...(includes('type') ? { font: { family, weight } } : {}),
    ...(includes('motion') && identity.motion.length ? { motion } : {}),
    ...(includes('scale') ? { palette } : {}),
    ...(includes('radius') ? { radius: { base: { $type: 'dimension', $value: { unit: 'px', value: identity.style.borderRadius } } } } : {}),
    ...(includes('semantic') ? { semantic } : {}),
    ...(includes('type') ? { size, typography } : {}),
  };
}

function header(identity: BrandIdentity, title: string): string {
  return `/* ${commentText(`${identity.name} — ${title}. Exported by Glyphfield from project "${identity.id}".`)} */`;
}

function withFontFaces(options: BrandTokenSerializerOptions): string[] {
  return options.fontFaces?.length ? ['', ...options.fontFaces] : [];
}

const semanticCache = new WeakMap<BrandIdentity, Partial<Record<ColorMode, ReturnType<typeof resolveSemanticColors>>>>();

/** Semantic roles for one identity object, resolved once per mode while serializers run. */
function semanticColors(identity: BrandIdentity, mode: ColorMode): ReturnType<typeof resolveSemanticColors> {
  const entry = semanticCache.get(identity) ?? {};
  const resolved = entry[mode] ?? resolveSemanticColors(identity, mode);
  entry[mode] = resolved;
  semanticCache.set(identity, entry);
  return resolved;
}

function semanticDeclarations(identity: BrandIdentity, mode: ColorMode, prefix: string, indent: string): string[] {
  const resolved = semanticColors(identity, mode);
  return SEMANTIC_COLOR_ROLES.map(({ id }) => `${indent}${prefix}${id}: ${resolved[id].hex}; /* ${commentText(resolved[id].ref)} */`);
}

/** Dark values for `prefers-color-scheme: dark` (unless data-theme="light") and for data-theme="dark" or .dark. */
function darkModeBlocks(identity: BrandIdentity, prefix: string): string[] {
  return [
    '@media (prefers-color-scheme: dark) {',
    '  :root:not([data-theme="light"]):not(.light) {',
    ...semanticDeclarations(identity, 'dark', prefix, '    '),
    '  }',
    '}',
    '',
    ':root[data-theme="dark"],',
    '.dark {',
    ...semanticDeclarations(identity, 'dark', prefix, '  '),
    '}',
  ];
}

function cssTypeLines(identity: BrandIdentity): string[] {
  const scale = new Map(brandTypeScale(identity).map((step) => [step.name, step]));
  // Kerning stays on everywhere; optical sizing follows the size unless a role fixes opsz.
  const rendering = ['  --brand-font-kerning: normal;', '  --brand-font-feature-settings: "kern" 1;', '  --brand-font-optical-sizing: auto;'];
  return [...rendering, ...ROLES.flatMap((role) => {
    const typography = brandTypographyRole(identity, role);
    const key = roleKey(role);
    const step = scale.get(brandRoleTypeStep(identity, role));
    const variation = brandFontVariationSettings(typography);
    const style = brandFontStyle(typography);
    return [
      `  --brand-font-${key}: ${cssFontStack(brandFontStack(brandTypographyFamily(identity, role), role))};`,
      ...(step ? [`  --brand-font-${key}-size: ${step.rem}rem; /* ${step.name}, ${step.px}px */`] : []),
      `  --brand-font-${key}-weight: ${typography.weight ?? 400};`,
      `  --brand-font-${key}-leading: ${typography.lineHeight ?? 1.5};`,
      `  --brand-font-${key}-tracking: ${brandTrackingEm(typography.letterSpacing ?? 0, step?.px ?? 16)}; /* ${typography.letterSpacing ?? 0}px at ${step?.px ?? 16}px */`,
      ...(variation ? [`  --brand-font-${key}-variation: ${variation};`] : []),
      ...(style ? [`  --brand-font-${key}-style: ${style};`] : []),
    ];
  })];
}

/**
 * `:root` custom properties: --brand-color-* (and scale steps), semantic roles
 * (--brand-background … --brand-negative, with dark values), --brand-font-*,
 * --brand-text-*, --brand-radius, motion.
 */
export function brandCssVariables(identity: BrandIdentity, options: BrandTokenSerializerOptions = {}): string {
  const includes = sectionFilter(options);
  const groups: string[][] = [];
  if (includes('color')) {
    groups.push(identity.colors.map((color) => `  --brand-color-${color.id}: ${normalizeHex(color.hex)}; /* ${commentText(`${color.name} — ${color.role}`)} */`));
  }
  if (includes('scale')) {
    for (const [id, scale] of brandColorScales(identity)) {
      groups.push(scale.map((swatch) => `  --brand-color-${id}-${swatch.step}: ${swatch.hex}; /* ${formatOklch(swatch.hex)}${swatch.anchored ? ', brand value' : ''} */`));
    }
  }
  if (includes('semantic')) groups.push(semanticDeclarations(identity, 'light', '--brand-', '  '));
  if (includes('type')) groups.push(cssTypeLines(identity), brandTypeScale(identity).map((step) => `  --brand-text-${step.name}: ${step.rem}rem; /* ${step.px}px */`));
  const tail: string[] = [];
  if (includes('radius')) tail.push(`  --brand-radius: ${identity.style.borderRadius}px;`);
  if (includes('motion')) {
    for (const motion of identity.motion) {
      tail.push(`  --brand-duration-${brandTokenName(motion.id)}: ${motion.durationMs}ms;`);
      tail.push(`  --brand-ease-${brandTokenName(motion.id)}: ${cssTimingFunction(motion.curve)};`);
    }
  }
  if (tail.length) groups.push(tail);
  const lines = groups.flatMap((group, index) => (index === 0 ? group : ['', ...group]));
  return [
    header(identity, 'CSS custom properties'),
    ...withFontFaces(options),
    '',
    ':root {',
    ...lines,
    '}',
    ...(includes('semantic') ? ['', ...darkModeBlocks(identity, '--brand-')] : []),
    '',
  ].join('\n');
}

function tailwindTypeLines(identity: BrandIdentity): string[][] {
  const families = ROLES.map((role) => `  --font-${roleKey(role)}: ${cssFontStack(brandFontStack(brandTypographyFamily(identity, role), role))};`);
  const roleByStep = new Map<string, BrandTypography>();
  for (const role of ROLES) {
    const step = brandRoleTypeStep(identity, role);
    if (!roleByStep.has(step)) roleByStep.set(step, brandTypographyRole(identity, role));
  }
  const sizes = brandTypeScale(identity).flatMap((step) => {
    const role = roleByStep.get(step.name);
    return [
      `  --text-${step.name}: ${step.rem}rem;`,
      ...(role ? [
        `  --text-${step.name}--line-height: ${role.lineHeight ?? 1.5};`,
        `  --text-${step.name}--letter-spacing: ${brandTrackingEm(role.letterSpacing ?? 0, step.px)};`,
        `  --text-${step.name}--font-weight: ${role.weight ?? 400};`,
      ] : []),
    ];
  });
  return [families, sizes];
}

function tailwindTailLines(identity: BrandIdentity, includes: (section: BrandTokenSection) => boolean): string[] {
  return [
    ...(includes('radius') ? [`  --radius-brand: ${identity.style.borderRadius}px;`] : []),
    ...(includes('motion') ? identity.motion.map((motion) => `  --ease-${brandTokenName(motion.id)}: ${cssTimingFunction(motion.curve)};`) : []),
  ];
}

function tailwindSemanticBlock(identity: BrandIdentity): string[] {
  const paletteIds = new Set(identity.colors.map(({ id }) => id));
  // A palette color named like a role keeps its utility; the role stays a CSS variable.
  const roles = SEMANTIC_COLOR_ROLES.filter(({ id }) => !paletteIds.has(id));
  return [
    '',
    '/* Semantic roles: light by default, dark with prefers-color-scheme, data-theme="dark" or .dark. */',
    '@theme inline {',
    ...roles.map(({ id }) => `  --color-${id}: var(--brand-${id});`),
    '}',
    '',
    ':root {',
    ...semanticDeclarations(identity, 'light', '--brand-', '  '),
    '}',
    '',
    ...darkModeBlocks(identity, '--brand-'),
  ];
}

function tailwindUsage(includes: (section: BrandTokenSection) => boolean): string {
  const examples: [BrandTokenSection, string][] = [
    ['color', 'bg-paper text-ink'],
    ['scale', 'bg-ink-700'],
    ['semantic', 'bg-background text-foreground bg-primary'],
    ['type', 'font-display text-display'],
    ['radius', 'rounded-brand'],
  ];
  return `/* Usage: ${examples.filter(([section]) => includes(section)).map(([, usage]) => usage).join(', ')}. */`;
}

/**
 * A Tailwind CSS v4 theme, pasted after `@import "tailwindcss";`. Utilities follow
 * the token names: bg-paper text-ink, bg-ink-700, font-display text-display,
 * rounded-brand, and semantic bg-background text-foreground bg-primary that switch
 * with prefers-color-scheme, data-theme="dark" or .dark.
 */
export function brandTailwindTheme(identity: BrandIdentity, options: BrandTokenSerializerOptions = {}): string {
  const includes = sectionFilter(options);
  const groups: string[][] = [];
  if (includes('color')) groups.push(identity.colors.map((color) => `  --color-${color.id}: ${normalizeHex(color.hex)};`));
  if (includes('scale')) groups.push([...brandColorScales(identity)].flatMap(([id, scale]) => scale.map((swatch) => `  --color-${id}-${swatch.step}: ${swatch.hex};`)));
  if (includes('type')) groups.push(...tailwindTypeLines(identity));
  const tail = tailwindTailLines(identity, includes);
  if (tail.length) groups.push(tail);
  const lines = groups.flatMap((group, index) => (index === 0 ? group : ['', ...group]));
  return [
    header(identity, 'Tailwind CSS v4 theme'),
    tailwindUsage(includes),
    ...withFontFaces(options),
    ...(lines.length ? ['', '@theme {', ...lines, '}'] : []),
    ...(includes('semantic') ? tailwindSemanticBlock(identity) : []),
    '',
  ].join('\n');
}
