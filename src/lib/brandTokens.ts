import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
  type BrandTypography,
} from './brandIdentity';
import { normalizeHex } from './color';

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
 * typography roles are display/body/accent/code; type steps are BRAND_TYPE_STEPS.
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

export type BrandTokenSerializerOptions = {
  /** Complete `@font-face` rules to prepend, such as the brand kit's local font files. */
  fontFaces?: readonly string[];
};

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

/** W3C Design Tokens Community Group format (2025.10): color, font, size, typography, radius, motion. */
export function brandDesignTokens(identity: BrandIdentity): Record<string, unknown> {
  const color = Object.fromEntries(identity.colors.map((entry) => [entry.id, {
    $description: entry.role,
    $extensions: { 'app.glyphfield': { name: entry.name, ...(typeof entry.proportion === 'number' ? { proportion: entry.proportion } : {}) } },
    $type: 'color',
    $value: { colorSpace: 'srgb', components: rgbComponents(entry.hex), hex: normalizeHex(entry.hex).toLocaleLowerCase() },
  }]));
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
    return [key, {
      $description: typographyRole.usage,
      $type: 'typography',
      $value: {
        fontFamily: `{font.family.${key}}`,
        fontSize: `{size.${BRAND_ROLE_TYPE_STEP[role]}}`,
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
    color,
    font: { family, weight },
    ...(identity.motion.length ? { motion } : {}),
    radius: { base: { $type: 'dimension', $value: { unit: 'px', value: identity.style.borderRadius } } },
    size,
    typography,
  };
}

function header(identity: BrandIdentity, title: string): string {
  return `/* ${identity.name} — ${title}. Exported by Glyphfield from project "${identity.id}". */`;
}

function withFontFaces(options: BrandTokenSerializerOptions): string[] {
  return options.fontFaces?.length ? ['', ...options.fontFaces] : [];
}

/** `:root` custom properties: --brand-color-*, --brand-font-*, --brand-text-*, --brand-radius, motion. */
export function brandCssVariables(identity: BrandIdentity, options: BrandTokenSerializerOptions = {}): string {
  const lines: string[] = [];
  for (const color of identity.colors) lines.push(`  --brand-color-${color.id}: ${normalizeHex(color.hex)}; /* ${color.name} — ${color.role.replace(/\*\//g, '')} */`);
  lines.push('');
  for (const role of ROLES) {
    const typography = brandTypographyRole(identity, role);
    const key = roleKey(role);
    lines.push(`  --brand-font-${key}: ${cssFontStack(brandFontStack(brandTypographyFamily(identity, role), role))};`);
    lines.push(`  --brand-font-${key}-weight: ${typography.weight ?? 400};`);
    lines.push(`  --brand-font-${key}-leading: ${typography.lineHeight ?? 1.5};`);
    lines.push(`  --brand-font-${key}-tracking: ${typography.letterSpacing ?? 0}px;`);
  }
  lines.push('');
  for (const step of brandTypeScale(identity)) lines.push(`  --brand-text-${step.name}: ${step.rem}rem; /* ${step.px}px */`);
  lines.push('', `  --brand-radius: ${identity.style.borderRadius}px;`);
  for (const motion of identity.motion) {
    lines.push(`  --brand-duration-${brandTokenName(motion.id)}: ${motion.durationMs}ms;`);
    lines.push(`  --brand-ease-${brandTokenName(motion.id)}: ${motion.curve};`);
  }
  return [header(identity, 'CSS custom properties'), ...withFontFaces(options), '', ':root {', ...lines, '}', ''].join('\n');
}

/**
 * A Tailwind CSS v4 theme, pasted after `@import "tailwindcss";`. Utilities follow
 * the token names: bg-paper text-ink, font-display text-display, rounded-brand.
 */
export function brandTailwindTheme(identity: BrandIdentity, options: BrandTokenSerializerOptions = {}): string {
  const lines: string[] = [];
  for (const color of identity.colors) lines.push(`  --color-${color.id}: ${normalizeHex(color.hex)};`);
  lines.push('');
  for (const role of ROLES) lines.push(`  --font-${roleKey(role)}: ${cssFontStack(brandFontStack(brandTypographyFamily(identity, role), role))};`);
  lines.push('');
  const roleByStep = new Map(ROLES.map((role) => [BRAND_ROLE_TYPE_STEP[role], brandTypographyRole(identity, role)]));
  for (const step of brandTypeScale(identity)) {
    lines.push(`  --text-${step.name}: ${step.rem}rem;`);
    const role = roleByStep.get(step.name);
    if (!role) continue;
    lines.push(`  --text-${step.name}--line-height: ${role.lineHeight ?? 1.5};`);
    lines.push(`  --text-${step.name}--letter-spacing: ${role.letterSpacing ?? 0}px;`);
    lines.push(`  --text-${step.name}--font-weight: ${role.weight ?? 400};`);
  }
  lines.push('', `  --radius-brand: ${identity.style.borderRadius}px;`);
  for (const motion of identity.motion) {
    if (parseCubicBezier(motion.curve)) lines.push(`  --ease-${brandTokenName(motion.id)}: ${motion.curve};`);
  }
  return [
    header(identity, 'Tailwind CSS v4 theme'),
    '/* Usage: bg-paper text-ink, font-display text-display, rounded-brand. */',
    ...withFontFaces(options),
    '',
    '@theme {',
    ...lines,
    '}',
    '',
  ].join('\n');
}
