import type { CSSProperties } from 'react';

import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandColor,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { brandFontStack } from '@/lib/brandTokens';
import {
  mixHexColors,
  normalizeHexOrFallback,
  resolveReadableColor,
} from '@/lib/color';
import {
  resolveSemanticColors,
  SEMANTIC_COLOR_ROLES,
  semanticHexes,
  type ColorMode,
  type SemanticColorRole,
} from '@/lib/colorSystem';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceString,
} from '@/lib/sourceCode';
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';

/**
 * Component library model without React rendering: the catalog, the tool settings
 * and their source format (version 2, migrating version 1 and the old per-field
 * drafts), per-identity content, the light/dark palettes and the size metrics the
 * markup generator turns into CSS, Tailwind and HTML.
 */

export type ComponentFamily =
  | 'actions'
  | 'forms'
  | 'navigation'
  | 'feedback'
  | 'data'
  | 'cards'
  | 'overlays'
  | 'messaging'
  | 'commerce'
  | 'content';

export const COMPONENT_FAMILY_OPTIONS = [
  { label: 'Actions', value: 'actions' },
  { label: 'Forms', value: 'forms' },
  { label: 'Navigation', value: 'navigation' },
  { label: 'Feedback', value: 'feedback' },
  { label: 'Data display', value: 'data' },
  { label: 'Cards', value: 'cards' },
  { label: 'Overlays', value: 'overlays' },
  { label: 'Messaging', value: 'messaging' },
  { label: 'Commerce', value: 'commerce' },
  { label: 'Content', value: 'content' },
] as const;

/** States a pattern can show; each pattern lists the ones that apply to it. */
export const COMPONENT_STATES = [
  { id: 'default', label: 'Default' },
  { id: 'hover', label: 'Hover' },
  { id: 'focus', label: 'Focus visible' },
  { id: 'active', label: 'Pressed' },
  { id: 'selected', label: 'Selected' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'loading', label: 'Loading' },
  { id: 'error', label: 'Error' },
] as const;

export type ComponentStateId = (typeof COMPONENT_STATES)[number]['id'];

const CONTROL_STATES = ['default', 'hover', 'focus', 'disabled', 'loading', 'error'] as const satisfies readonly ComponentStateId[];
const ACTION_STATES = ['default', 'hover', 'focus', 'active', 'disabled', 'loading'] as const satisfies readonly ComponentStateId[];
const CHOICE_STATES = ['default', 'hover', 'focus', 'selected', 'disabled', 'error'] as const satisfies readonly ComponentStateId[];
const NAV_STATES = ['default', 'hover', 'focus', 'selected', 'disabled'] as const satisfies readonly ComponentStateId[];
const SURFACE_STATES = ['default', 'loading', 'error'] as const satisfies readonly ComponentStateId[];
const CARD_STATES = ['default', 'hover', 'focus', 'loading'] as const satisfies readonly ComponentStateId[];

export const COMPONENT_PATTERNS = [
  { description: 'Primary, secondary, outline, ghost and destructive actions.', family: 'actions', id: 'buttons', label: 'Buttons', states: ACTION_STATES },
  { description: 'Square actions with an accessible name and no visible label.', family: 'actions', id: 'icon-buttons', label: 'Icon buttons', states: ACTION_STATES },
  { description: 'A segmented control and a joined pager.', family: 'actions', id: 'button-groups', label: 'Button groups', states: NAV_STATES },
  { description: 'Labelled text fields with hints, icons and validation.', family: 'forms', id: 'inputs', label: 'Inputs', states: CONTROL_STATES },
  { description: 'Multi-line text with a character count.', family: 'forms', id: 'textareas', label: 'Textareas', states: CONTROL_STATES },
  { description: 'A native select styled with the brand tokens.', family: 'forms', id: 'selects', label: 'Selects', states: CONTROL_STATES },
  { description: 'Independent options with descriptions.', family: 'forms', id: 'checkboxes', label: 'Checkboxes', states: CHOICE_STATES },
  { description: 'One choice from a short list.', family: 'forms', id: 'radios', label: 'Radios', states: CHOICE_STATES },
  { description: 'Settings that take effect immediately.', family: 'forms', id: 'toggles', label: 'Switches', states: CHOICE_STATES },
  { description: 'A drop zone for local files.', family: 'forms', id: 'uploaders', label: 'Uploaders', states: ['default', 'hover', 'focus', 'disabled', 'error'] },
  { description: 'The product header with the current page marked.', family: 'navigation', id: 'navigation', label: 'Navigation bar', states: NAV_STATES },
  { description: 'Grouped app navigation with counts.', family: 'navigation', id: 'sidebars', label: 'Sidebars', states: NAV_STATES },
  { description: 'Views of one object with arrow-key navigation.', family: 'navigation', id: 'tabs', label: 'Tabs', states: NAV_STATES },
  { description: 'The path to the current page.', family: 'navigation', id: 'breadcrumbs', label: 'Breadcrumbs', states: ['default', 'hover', 'focus'] },
  { description: 'Page through a long list.', family: 'navigation', id: 'pagination', label: 'Pagination', states: NAV_STATES },
  { description: 'Search every action from the keyboard.', family: 'overlays', id: 'command-menu', label: 'Command menu', states: ['default', 'selected', 'loading', 'error'] },
  { description: 'A focused decision over the page.', family: 'overlays', id: 'dialogs', label: 'Modals', states: ['default', 'loading', 'error'] },
  { description: 'A side panel for editing without leaving the page.', family: 'overlays', id: 'sheets', label: 'Sheets', states: ['default', 'loading', 'error'] },
  { description: 'A small menu attached to its trigger.', family: 'overlays', id: 'popovers', label: 'Popovers', states: ['default', 'hover', 'focus', 'disabled'] },
  { description: 'A short label shown on hover and focus.', family: 'overlays', id: 'tooltips', label: 'Tooltips', states: ['default', 'hover', 'focus'] },
  { description: 'Inline messages for every status.', family: 'feedback', id: 'alerts', label: 'Alerts', states: ['default'] },
  { description: 'Transient confirmation with an undo.', family: 'feedback', id: 'toasts', label: 'Toasts', states: ['default', 'loading', 'error'] },
  { description: 'Determinate progress and steps.', family: 'feedback', id: 'progress', label: 'Progress', states: ['default', 'loading', 'error'] },
  { description: 'Compact status and count labels.', family: 'feedback', id: 'badges', label: 'Badges', states: ['default'] },
  { description: 'What to do when there is nothing here yet.', family: 'feedback', id: 'empty-states', label: 'Empty states', states: SURFACE_STATES },
  { description: 'Rows of records with status and tabular numbers.', family: 'data', id: 'tables', label: 'Tables', states: ['default', 'hover', 'selected', 'loading', 'error'] },
  { description: 'Key figures with their change.', family: 'data', id: 'stats', label: 'Stats', states: SURFACE_STATES },
  { description: 'A bar chart drawn from the palette.', family: 'data', id: 'charts', label: 'Charts', states: ['default', 'hover', 'selected', 'loading'] },
  { description: 'A plan with its price and inclusions.', family: 'commerce', id: 'pricing', label: 'Pricing', states: CARD_STATES },
  { description: 'Payment details with an order summary.', family: 'commerce', id: 'checkout', label: 'Checkout', states: CONTROL_STATES },
  { description: 'Product and content cards.', family: 'cards', id: 'cards', label: 'Cards', states: CARD_STATES },
  { description: 'A customer quote with attribution.', family: 'cards', id: 'testimonials', label: 'Testimonials', states: ['default'] },
  { description: 'A message list with a reading pane.', family: 'messaging', id: 'inbox', label: 'Inbox', states: ['default', 'hover', 'selected', 'loading'] },
  { description: 'A discussion thread with a composer.', family: 'messaging', id: 'comments', label: 'Comments', states: ['default', 'focus', 'loading', 'error'] },
  { description: 'Long-form reading with a pull quote.', family: 'content', id: 'article-body', label: 'Article body', states: ['default'] },
  { description: 'Page metadata as a definition list.', family: 'content', id: 'metadata', label: 'Metadata', states: ['default'] },
] as const satisfies ReadonlyArray<{
  description: string;
  family: ComponentFamily;
  id: string;
  label: string;
  states: readonly ComponentStateId[];
}>;

export type ComponentPatternId = (typeof COMPONENT_PATTERNS)[number]['id'];
export type ComponentPattern = (typeof COMPONENT_PATTERNS)[number];
export type ComponentElevation = 'none' | 'soft' | 'strong';
export type ComponentDensity = 'compact' | 'comfortable' | 'spacious';
export type ComponentSize = 'sm' | 'default' | 'lg';
export type ComponentSurface = 'base' | 'soft';
export type ComponentTheme = 'light' | 'dark' | 'both';
export type ComponentCodeFormat = 'react' | 'html';

export function getFirstComponentPattern(family: ComponentFamily): ComponentPatternId {
  return COMPONENT_PATTERNS.find((pattern) => pattern.family === family)?.id ?? 'buttons';
}

export function componentPattern(id: string): ComponentPattern | undefined {
  return COMPONENT_PATTERNS.find((pattern) => pattern.id === id);
}

// ── Palette ─────────────────────────────────────────────────────────────────

/** The tool's custom palette, used when brand defaults are off. */
export type ComponentPalette = {
  accent: string;
  accentForeground: string;
  background: string;
  border: string;
  danger: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  success: string;
  surface: string;
};

export const COMPONENT_PALETTE_KEYS = ['background', 'surface', 'foreground', 'accent', 'accentForeground', 'muted', 'mutedForeground', 'border', 'success', 'danger'] as const satisfies readonly (keyof ComponentPalette)[];

function colorById(identity: BrandIdentity, id: string, index: number, fallback: string): string {
  return normalizeHexOrFallback(
    identity.colors.find((color) => color.id === id)?.hex ?? identity.colors[index]?.hex,
    fallback
  );
}

/** The identity's light semantic roles as an editable custom palette. */
export function componentBrandPalette(identity: BrandIdentity): ComponentPalette {
  const light = semanticHexes(resolveSemanticColors(identity, 'light'));
  const foreground = colorById(identity, 'ink', 0, light.foreground);
  const background = colorById(identity, 'paper', 1, light.background);
  return {
    accent: light.primary,
    accentForeground: resolveReadableColor(light.primary, light['primary-foreground'], 4.5).color,
    background,
    border: light.border ?? mixHexColors(foreground, background, 0.8),
    danger: light.negative,
    foreground,
    muted: light['surface-muted'],
    mutedForeground: light['foreground-muted'],
    success: light.positive,
    surface: light.surface,
  };
}

export type ComponentRoleColors = Record<SemanticColorRole, string>;

function paletteRoles(palette: ComponentPalette, caution: string): ComponentRoleColors {
  return {
    background: palette.background,
    border: palette.border,
    caution,
    focus: palette.accent,
    foreground: palette.foreground,
    'foreground-muted': palette.mutedForeground,
    negative: palette.danger,
    positive: palette.success,
    primary: palette.accent,
    'primary-foreground': palette.accentForeground,
    surface: palette.surface,
    'surface-muted': palette.muted,
  };
}

/** A custom palette shown on a dark surface: the text color becomes the canvas. */
function invertedPaletteRoles(palette: ComponentPalette, caution: string): ComponentRoleColors {
  const background = palette.foreground;
  return {
    background,
    border: mixHexColors(background, palette.surface, 0.24),
    caution,
    focus: palette.accent,
    foreground: palette.surface,
    'foreground-muted': mixHexColors(palette.surface, background, 0.38),
    negative: palette.danger,
    positive: palette.success,
    primary: palette.accent,
    'primary-foreground': palette.accentForeground,
    surface: background,
    'surface-muted': mixHexColors(background, palette.surface, 0.1),
  };
}

/** Role colors for one mode: the identity's semantic roles, or the custom palette. */
export function componentRoleColors(identity: BrandIdentity, settings: Pick<ComponentLibrarySettings, 'colors' | 'useBrandDefaults'>, mode: ColorMode): ComponentRoleColors {
  const semantic = semanticHexes(resolveSemanticColors(identity, mode));
  if (settings.useBrandDefaults) return semantic;
  return mode === 'light' ? paletteRoles(settings.colors, semantic.caution) : invertedPaletteRoles(settings.colors, semantic.caution);
}

// ── Settings ────────────────────────────────────────────────────────────────

export const COMPONENT_SOURCE_VERSION = 2;

export type ComponentLibrarySettings = {
  asset: { id: string; opacity: number };
  borderWidth: number;
  codeFormat: ComponentCodeFormat;
  colors: ComponentPalette;
  density: ComponentDensity;
  disabled: boolean;
  elevation: ComponentElevation;
  label: string;
  letterSpacing: number;
  pattern: ComponentPatternId;
  radius: number;
  size: ComponentSize;
  supportingCopy: string;
  surface: ComponentSurface;
  textScale: number;
  theme: ComponentTheme;
  typography: { role: BrandTypography['role']; weight: number };
  useBrandDefaults: boolean;
};

export function defaultComponentSettings(identity: BrandIdentity): ComponentLibrarySettings {
  return {
    asset: { id: 'none', opacity: 10 },
    borderWidth: 1,
    codeFormat: 'react',
    colors: componentBrandPalette(identity),
    density: identity.style.density,
    disabled: false,
    elevation: 'soft',
    label: 'Get started',
    letterSpacing: 0,
    pattern: 'buttons',
    radius: identity.style.borderRadius,
    size: 'default',
    supportingCopy: identity.description,
    surface: 'base',
    textScale: 100,
    theme: 'both',
    typography: { role: 'Body', weight: brandTypographyRole(identity, 'Body').weight ?? 400 },
    useBrandDefaults: true,
  };
}

/** Radius, density and type follow the identity while brand defaults are on. */
export function resolvedComponentSettings(identity: BrandIdentity, settings: ComponentLibrarySettings): ComponentLibrarySettings {
  if (!settings.useBrandDefaults) return settings;
  return {
    ...settings,
    density: identity.style.density,
    radius: identity.style.borderRadius,
    typography: { role: 'Body', weight: brandTypographyRole(identity, 'Body').weight ?? 400 },
  };
}

const DENSITIES: readonly ComponentDensity[] = ['compact', 'comfortable', 'spacious'];
const SIZES: readonly ComponentSize[] = ['sm', 'default', 'lg'];
const ELEVATIONS: readonly ComponentElevation[] = ['none', 'soft', 'strong'];
const THEMES: readonly ComponentTheme[] = ['light', 'dark', 'both'];
const CODE_FORMATS: readonly ComponentCodeFormat[] = ['react', 'html'];
const ROLES: readonly BrandTypography['role'][] = ['Display', 'Body', 'Accent', 'Code'];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function oneOf<T extends string>(value: string, options: readonly T[], field: string): T {
  if (!(options as readonly string[]).includes(value)) throw new RangeError(`${field} must be one of ${options.join(', ')}.`);
  return value as T;
}

/**
 * Validate component source. Version 1 sources (no `version`, `surface: 'inverse'`,
 * `family`) migrate: inverse becomes the dark theme on the base surface.
 */
export function parseComponentSource(identity: BrandIdentity, current: ComponentLibrarySettings, source: string | Record<string, unknown>): ComponentLibrarySettings {
  const next = typeof source === 'string' ? parseSourceObject(source) : source;
  const assetSource = sourceObject(next, 'asset') ?? {};
  const colorsSource = sourceObject(next, 'colors') ?? {};
  const typographySource = sourceObject(next, 'typography') ?? {};
  const pattern = sourceString(next, 'pattern', current.pattern);
  const patternConfig = componentPattern(pattern);
  if (!patternConfig) throw new RangeError(`Unknown component pattern "${pattern}".`);
  const family = sourceString(next, 'family', patternConfig.family);
  if (!COMPONENT_FAMILY_OPTIONS.some(({ value }) => value === family)) throw new RangeError('Unknown component family.');
  if (family !== patternConfig.family) throw new RangeError('The component does not belong to that family.');
  const rawSurface = sourceString(next, 'surface', current.surface);
  if (!['base', 'soft', 'inverse'].includes(rawSurface)) throw new RangeError('Unknown component surface.');
  const role = sourceString(typographySource, 'role', current.typography.role);
  if (!ROLES.includes(role as BrandTypography['role']) || !identity.typography.some((entry) => entry.role === role)) throw new RangeError('Unknown typography role.');
  const colors = Object.fromEntries(COMPONENT_PALETTE_KEYS.map((key) => [
    key,
    normalizeHexOrFallback(sourceString(colorsSource, key, current.colors[key]), current.colors[key]),
  ])) as ComponentPalette;
  const theme = rawSurface === 'inverse' && next.theme === undefined ? 'dark' : sourceString(next, 'theme', current.theme);
  return {
    asset: {
      id: sourceString(assetSource, 'id', current.asset.id),
      opacity: clamp(sourceNumber(assetSource, 'opacity', current.asset.opacity), 0, 100),
    },
    borderWidth: clamp(sourceNumber(next, 'borderWidth', current.borderWidth), 0, 4),
    codeFormat: oneOf(sourceString(next, 'codeFormat', current.codeFormat), CODE_FORMATS, 'codeFormat'),
    colors,
    density: oneOf(sourceString(next, 'density', current.density), DENSITIES, 'density'),
    disabled: sourceBoolean(next, 'disabled', current.disabled),
    elevation: oneOf(sourceString(next, 'elevation', current.elevation), ELEVATIONS, 'elevation'),
    label: sourceString(next, 'label', current.label),
    letterSpacing: clamp(sourceNumber(next, 'letterSpacing', current.letterSpacing), -6, 12),
    pattern: patternConfig.id,
    radius: clamp(sourceNumber(next, 'radius', current.radius), 0, 32),
    size: oneOf(sourceString(next, 'size', current.size), SIZES, 'size'),
    supportingCopy: sourceString(next, 'supportingCopy', current.supportingCopy),
    surface: rawSurface === 'inverse' ? 'base' : rawSurface as ComponentSurface,
    textScale: clamp(sourceNumber(next, 'textScale', current.textScale), 70, 140),
    theme: oneOf(theme, THEMES, 'theme'),
    typography: {
      role: role as BrandTypography['role'],
      weight: clamp(sourceNumber(typographySource, 'weight', current.typography.weight), 100, 900),
    },
    useBrandDefaults: sourceBoolean(next, 'useBrandDefaults', current.useBrandDefaults),
  };
}

/** Source keeps version 1's field names and adds version, theme and codeFormat. */
export function componentSource(settings: ComponentLibrarySettings): Record<string, unknown> {
  const pattern = componentPattern(settings.pattern) ?? COMPONENT_PATTERNS[0];
  return {
    version: COMPONENT_SOURCE_VERSION,
    asset: settings.asset,
    borderWidth: settings.borderWidth,
    codeFormat: settings.codeFormat,
    colors: settings.colors,
    density: settings.density,
    disabled: settings.disabled,
    elevation: settings.elevation,
    family: pattern.family,
    label: settings.label,
    letterSpacing: settings.letterSpacing,
    pattern: pattern.id,
    radius: settings.radius,
    size: settings.size,
    supportingCopy: settings.supportingCopy,
    surface: settings.surface,
    textScale: settings.textScale,
    theme: settings.theme,
    typography: settings.typography,
    useBrandDefaults: settings.useBrandDefaults,
  };
}

/** Version 1 stored one draft per field; these are their field names. */
export const LEGACY_COMPONENT_DRAFT_FIELDS = {
  asset: ['asset-id', 'asset-opacity'],
  borderWidth: 'border-width',
  colors: {
    accent: 'color-accent',
    accentForeground: 'color-accent-foreground',
    background: 'color-background',
    border: 'color-border',
    danger: 'color-danger',
    foreground: 'color-foreground',
    muted: 'color-muted',
    mutedForeground: 'color-muted-foreground',
    success: 'color-success',
    surface: 'color-surface',
  },
  density: 'density',
  disabled: 'disabled',
  elevation: 'elevation',
  family: 'family',
  label: 'label',
  letterSpacing: 'letter-spacing',
  pattern: 'pattern',
  radius: 'radius',
  size: 'size',
  supportingCopy: 'supporting-copy',
  surface: 'surface',
  textScale: 'text-scale',
  typography: ['font-role', 'font-weight'],
  useBrandDefaults: 'use-brand-defaults',
} as const;

/**
 * Build version 2 settings from version 1 per-field drafts. `read(field)` returns
 * the stored value or undefined; invalid values keep the defaults.
 */
export function migrateLegacyComponentDrafts(identity: BrandIdentity, read: (field: string) => unknown): ComponentLibrarySettings | null {
  const fields = LEGACY_COMPONENT_DRAFT_FIELDS;
  const scalarFields = ['borderWidth', 'density', 'disabled', 'elevation', 'label', 'letterSpacing', 'pattern', 'radius', 'size', 'supportingCopy', 'surface', 'textScale', 'useBrandDefaults'] as const;
  const legacy: Record<string, unknown> = {};
  for (const key of scalarFields) {
    const value = read(fields[key]);
    if (value !== undefined) legacy[key] = value;
  }
  const colors: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(fields.colors)) {
    const value = read(field);
    if (value !== undefined) colors[key] = value;
  }
  if (Object.keys(colors).length) legacy.colors = colors;
  const [assetId, assetOpacity] = fields.asset.map(read);
  if (assetId !== undefined || assetOpacity !== undefined) legacy.asset = { ...(assetId !== undefined ? { id: assetId } : {}), ...(assetOpacity !== undefined ? { opacity: assetOpacity } : {}) };
  const [role, weight] = fields.typography.map(read);
  if (role !== undefined || weight !== undefined) legacy.typography = { ...(role !== undefined ? { role } : {}), ...(weight !== undefined ? { weight } : {}) };
  if (!Object.keys(legacy).length) return null;
  const defaults = defaultComponentSettings(identity);
  try {
    return parseComponentSource(identity, defaults, legacy);
  } catch {
    // A stale pattern or family from an older catalog keeps every other field.
    const { pattern: _pattern, ...rest } = legacy;
    try {
      return parseComponentSource(identity, defaults, rest);
    } catch {
      return null;
    }
  }
}

// ── Metrics ─────────────────────────────────────────────────────────────────

export type ComponentMetrics = {
  /** Control height. */
  h: number;
  /** Small control height (sidebar rows, segments, page buttons). */
  hSm: number;
  /** Horizontal control padding. */
  px: number;
  /** Left padding of a field with a leading icon. */
  pxIcon: number;
  /** Gap between related items, and a tighter gap inside controls. */
  gap: number;
  gapSm: number;
  /** Card and panel padding. */
  pad: number;
  /** Section spacing. */
  space: number;
  /** Table cell and text-field vertical padding. */
  cellY: number;
  fieldY: number;
  radius: number;
  radiusSm: number;
  /** Corner radius for check boxes, never rounder than a quarter of the box. */
  radiusXs: number;
  radiusLg: number;
  border: number;
  icon: number;
  check: number;
  switchW: number;
  switchH: number;
  switchThumb: number;
  switchTravel: number;
  badgeH: number;
  navH: number;
  text: number;
  textSm: number;
  textXs: number;
  textLg: number;
  textXl: number;
  textDisplay: number;
  weight: number;
  weightStrong: number;
  /** Letter spacing in em. */
  tracking: number;
};

/** Metrics that are lengths in px; the preview exposes each as --gf-<name>. */
export const COMPONENT_LENGTH_METRICS = [
  'h', 'hSm', 'px', 'pxIcon', 'gap', 'gapSm', 'pad', 'space', 'cellY', 'fieldY', 'radiusSm', 'radiusXs', 'radiusLg', 'border',
  'icon', 'check', 'switchW', 'switchH', 'switchThumb', 'switchTravel', 'badgeH', 'navH',
  'text', 'textSm', 'textXs', 'textLg', 'textXl', 'textDisplay',
] as const satisfies readonly (keyof ComponentMetrics)[];

const DENSITY_METRICS: Record<ComponentDensity, { gap: number; h: number; pad: number; px: number; space: number; text: number }> = {
  compact: { gap: 6, h: 32, pad: 14, px: 10, space: 16, text: 13 },
  comfortable: { gap: 8, h: 36, pad: 18, px: 14, space: 22, text: 14 },
  spacious: { gap: 12, h: 44, pad: 24, px: 18, space: 30, text: 15 },
};

const SIZE_OFFSET: Record<ComponentSize, { h: number; text: number }> = {
  default: { h: 0, text: 0 },
  lg: { h: 6, text: 1 },
  sm: { h: -4, text: -1 },
};

export function componentMetrics(settings: Pick<ComponentLibrarySettings, 'borderWidth' | 'density' | 'letterSpacing' | 'radius' | 'size' | 'textScale' | 'typography'>): ComponentMetrics {
  const density = DENSITY_METRICS[settings.density] ?? DENSITY_METRICS.comfortable;
  const size = SIZE_OFFSET[settings.size] ?? SIZE_OFFSET.default;
  const scale = clamp(settings.textScale, 70, 140) / 100;
  const text = Math.round((density.text + size.text) * scale);
  const radius = Math.round(clamp(settings.radius, 0, 32));
  const h = density.h + size.h;
  const px = density.px + size.h / 2;
  const gapSm = Math.max(4, density.gap - 2);
  const icon = text + 2;
  const check = text + 2;
  const switchH = check + 4;
  const switchW = switchH * 2 - 4;
  const weight = capVisibleFontWeight(clamp(settings.typography.weight, 100, MAX_VISIBLE_FONT_WEIGHT));
  return {
    badgeH: Math.max(18, Math.round(text * 1.5)),
    border: clamp(settings.borderWidth, 0, 4),
    cellY: Math.round(density.gap * 1.4),
    check,
    fieldY: Math.max(6, Math.round((h - text * 1.5) / 2)),
    gap: density.gap,
    gapSm,
    h,
    hSm: Math.max(24, h - 6),
    icon,
    navH: h + 20,
    pad: density.pad,
    px,
    pxIcon: px + icon + gapSm,
    radius,
    radiusLg: Math.min(40, Math.round(radius * 1.5)),
    radiusSm: Math.max(0, Math.round(radius * 0.6)),
    radiusXs: Math.min(Math.max(0, Math.round(radius * 0.6)), Math.round(check / 4)),
    space: density.space,
    switchH,
    switchThumb: check,
    switchTravel: switchW - check - 4,
    switchW,
    text,
    textDisplay: Math.round(text * 2.6),
    textLg: Math.round(text * 1.15),
    textSm: Math.max(10, text - 1),
    textXl: Math.round(text * 1.6),
    textXs: Math.max(10, text - 2),
    tracking: Math.round(clamp(settings.letterSpacing, -6, 12)) / 100,
    weight,
    weightStrong: capVisibleFontWeight(Math.max(500, weight + 100)),
  };
}

export function componentElevationShadow(elevation: ComponentElevation, foreground: string): string {
  if (elevation === 'none') return 'none';
  const shadowColor = normalizeHexOrFallback(foreground, '#000000');
  if (elevation === 'strong') return `0 22px 55px ${shadowColor}2E, 0 3px 10px ${shadowColor}1F`;
  return `0 10px 28px ${shadowColor}1F, 0 2px 6px ${shadowColor}14`;
}

/** CSS custom properties for one preview pane: semantic roles, fonts, radius and metrics. */
export function componentPreviewVariables(
  identity: BrandIdentity,
  settings: ComponentLibrarySettings,
  colors: ComponentRoleColors
): CSSProperties {
  const metrics = componentMetrics(settings);
  const variables: Record<string, string | number> = {};
  for (const { id } of SEMANTIC_COLOR_ROLES) variables[`--brand-${id}`] = colors[id];
  for (const role of ROLES) {
    const stack = brandFontStack(brandTypographyFamily(identity, role), role);
    variables[`--brand-font-${role.toLocaleLowerCase()}`] = stack.map((name, index) => (index === 0 ? JSON.stringify(name) : name)).join(', ');
  }
  variables['--brand-radius'] = `${metrics.radius}px`;
  for (const key of COMPONENT_LENGTH_METRICS) variables[`--gf-${key}`] = `${metrics[key]}px`;
  variables['--gf-weight'] = metrics.weight;
  variables['--gf-weightStrong'] = metrics.weightStrong;
  variables['--gf-tracking'] = `${metrics.tracking}em`;
  variables['--gf-shadow'] = componentElevationShadow(settings.elevation, colors.foreground);
  return variables as CSSProperties;
}

// ── Content ─────────────────────────────────────────────────────────────────

export type ComponentStat = { label: string; value: string };

export type ComponentContent = {
  audiences: string[];
  description: string;
  domain: string;
  email: string;
  handle: string;
  name: string;
  phrases: string[];
  pillars: string[];
  positioning: string;
  products: string[];
  stats: ComponentStat[];
  short: string;
  tagline: string;
  values: string[];
  writeExamples: string[];
};

function pad<T>(values: readonly T[], minimum: number, fallback: readonly T[]): T[] {
  const output = [...values];
  for (const value of fallback) {
    if (output.length >= minimum) break;
    if (!output.includes(value)) output.push(value);
  }
  return output;
}

/** "335+ cities" → { value: '335+', label: 'cities' }; "Developer-first APIs" → its first word. */
export function parseProofStat(proof: string): ComponentStat {
  const match = /^([$€£¥]?\d[\d.,]*\s?(?:[%+×x]|[KMBT]\+?|\+)?)\s+(.+)$/i.exec(proof.trim());
  if (match) return { label: match[2]!.trim(), value: match[1]!.trim() };
  const [first = proof, ...rest] = proof.trim().split(/\s+/);
  return { label: rest.join(' ') || proof, value: first };
}

export function componentContent(identity: BrandIdentity): ComponentContent {
  const domain = (identity.website || `${identity.id}.com`).replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const products = pad(identity.products.filter(Boolean), 4, [...identity.applications.map(({ name }) => name), 'Overview', 'Settings', 'Billing', 'Team']);
  const parsedStats = identity.proof.map(parseProofStat).filter(({ value }) => /\d/.test(value));
  return {
    audiences: pad(identity.audiences.filter(Boolean), 3, ['Product teams', 'Engineering', 'Design']),
    description: identity.description,
    domain,
    email: identity.contactEmail || `hello@${domain}`,
    handle: identity.socialHandle || `@${identity.id}`,
    name: identity.name,
    phrases: pad(identity.voice.phrases.filter(Boolean), 2, [identity.tagline, identity.positioning]),
    pillars: pad(identity.strategy.pillars.filter(Boolean), 3, identity.values),
    positioning: identity.positioning,
    products,
    short: identity.shortName,
    stats: pad(parsedStats, 3, [{ label: 'Products', value: String(identity.products.length || 1) }, { label: 'Audiences', value: String(identity.audiences.length || 1) }, { label: 'Values', value: String(identity.values.length || 1) }]),
    tagline: identity.tagline,
    values: pad(identity.values.filter(Boolean), 3, identity.strategy.pillars),
    writeExamples: identity.voice.examples?.map(({ write }) => write).filter(Boolean) ?? [],
  };
}

/** Palette colors that read as text on the surface, for chart series. */
export function componentChartColors(identity: BrandIdentity, colors: ComponentRoleColors): string[] {
  const used = new Set([colors.background.toLocaleUpperCase()]);
  const candidates = [colors.primary, colors.positive, colors.caution, colors['foreground-muted'], ...identity.colors.map((color: BrandColor) => color.hex)];
  return candidates
    .map((hex) => normalizeHexOrFallback(hex))
    .filter((hex) => (used.has(hex) ? false : (used.add(hex), true)))
    .slice(0, 4);
}
