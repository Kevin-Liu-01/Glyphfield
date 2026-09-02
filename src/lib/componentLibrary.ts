import type { CSSProperties } from 'react';

import {
  brandTypographyFamily,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import {
  mixHexColors,
  normalizeHexOrFallback,
  resolveReadableColor,
} from '@/lib/color';

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

export const COMPONENT_PATTERNS = [
  { family: 'actions', id: 'buttons', label: 'Buttons' },
  { family: 'actions', id: 'icon-buttons', label: 'Icon buttons' },
  { family: 'actions', id: 'button-groups', label: 'Button groups' },
  { family: 'forms', id: 'inputs', label: 'Inputs' },
  { family: 'forms', id: 'textareas', label: 'Textareas' },
  { family: 'forms', id: 'selects', label: 'Selects' },
  { family: 'forms', id: 'checkboxes', label: 'Checkboxes' },
  { family: 'forms', id: 'radios', label: 'Radios' },
  { family: 'forms', id: 'toggles', label: 'Toggles' },
  { family: 'forms', id: 'uploaders', label: 'Uploaders' },
  { family: 'navigation', id: 'navigation', label: 'Navigation' },
  { family: 'navigation', id: 'sidebars', label: 'Sidebars' },
  { family: 'navigation', id: 'tabs', label: 'Tabs' },
  { family: 'navigation', id: 'breadcrumbs', label: 'Breadcrumbs' },
  { family: 'navigation', id: 'pagination', label: 'Pagination' },
  { family: 'overlays', id: 'command-menu', label: 'Command menu' },
  { family: 'overlays', id: 'dialogs', label: 'Dialogs' },
  { family: 'overlays', id: 'popovers', label: 'Popovers' },
  { family: 'overlays', id: 'tooltips', label: 'Tooltips' },
  { family: 'feedback', id: 'alerts', label: 'Alerts' },
  { family: 'feedback', id: 'toasts', label: 'Toasts' },
  { family: 'feedback', id: 'progress', label: 'Progress' },
  { family: 'data', id: 'tables', label: 'Tables' },
  { family: 'data', id: 'stats', label: 'Stats' },
  { family: 'data', id: 'charts', label: 'Charts' },
  { family: 'commerce', id: 'pricing', label: 'Pricing' },
  { family: 'commerce', id: 'checkout', label: 'Checkout' },
  { family: 'cards', id: 'testimonials', label: 'Testimonials' },
  { family: 'messaging', id: 'inbox', label: 'Inbox' },
  { family: 'messaging', id: 'comments', label: 'Comments' },
  { family: 'content', id: 'article-body', label: 'Article body' },
  { family: 'content', id: 'metadata', label: 'Metadata' },
] as const satisfies ReadonlyArray<{
  family: ComponentFamily;
  id: string;
  label: string;
}>;

export type ComponentPatternId = (typeof COMPONENT_PATTERNS)[number]['id'];
export type ComponentElevation = 'none' | 'soft' | 'strong';

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

export type ComponentPreviewAppearance = {
  borderWidth: number;
  elevation: ComponentElevation;
  letterSpacing: number;
  palette: ComponentPalette;
  surface: 'base' | 'soft' | 'inverse';
  textScale: number;
};

export function getFirstComponentPattern(family: ComponentFamily): ComponentPatternId {
  return COMPONENT_PATTERNS.find((pattern) => pattern.family === family)?.id ?? 'buttons';
}

function colorById(identity: BrandIdentity, id: string, index: number, fallback: string): string {
  return normalizeHexOrFallback(
    identity.colors.find((color) => color.id === id)?.hex ?? identity.colors[index]?.hex,
    fallback
  );
}

export function componentBrandPalette(identity: BrandIdentity): ComponentPalette {
  const foreground = colorById(identity, 'ink', 0, '#171A21');
  const background = colorById(identity, 'paper', 1, '#FFFFFF');
  const muted = colorById(identity, 'muted', 2, mixHexColors(foreground, background, 0.92));
  const accent = colorById(identity, 'emphasis', 3, foreground);
  const success = colorById(identity, 'success', 4, '#16803C');
  const mutedForeground = colorById(identity, 'progress', 6, mixHexColors(foreground, background, 0.42));
  const danger = colorById(identity, 'error', 7, '#DC2626');

  return {
    accent,
    accentForeground: resolveReadableColor(accent, background, 4.5).color,
    background,
    border: mixHexColors(foreground, background, 0.8),
    danger,
    foreground,
    muted,
    mutedForeground,
    success,
    surface: background,
  };
}

function hexToHslChannels(value: string): string {
  const hex = normalizeHexOrFallback(value).slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16) / 255;
  const green = Number.parseInt(hex.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(hex.slice(4, 6), 16) / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;

  if (delta > 0) {
    if (maximum === red) hue = ((green - blue) / delta) % 6;
    else if (maximum === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return `${Number(hue.toFixed(1))} ${Number((saturation * 100).toFixed(1))}% ${Number((lightness * 100).toFixed(1))}%`;
}

function resolveComponentSurfaces(
  palette: ComponentPalette,
  surfaceMode: ComponentPreviewAppearance['surface']
) {
  if (surfaceMode === 'inverse') {
    return {
      border: mixHexColors(palette.foreground, palette.surface, 0.28),
      canvas: palette.foreground,
      foreground: palette.surface,
      muted: mixHexColors(palette.foreground, palette.surface, 0.18),
      mutedForeground: mixHexColors(palette.surface, palette.foreground, 0.35),
      surface: palette.foreground,
    };
  }

  return {
    border: palette.border,
    canvas: surfaceMode === 'soft' ? palette.muted : palette.background,
    foreground: palette.foreground,
    muted: palette.muted,
    mutedForeground: palette.mutedForeground,
    surface: palette.surface,
  };
}

function componentElevationShadow(elevation: ComponentElevation, foreground: string): string {
  if (elevation === 'none') return 'none';
  const shadowColor = normalizeHexOrFallback(foreground, '#000000');
  if (elevation === 'strong') {
    return `0 22px 55px ${shadowColor}2E, 0 3px 10px ${shadowColor}1F`;
  }
  return `0 10px 28px ${shadowColor}1F, 0 2px 6px ${shadowColor}14`;
}

export function componentPreviewStyle(
  radius: number,
  identity: BrandIdentity,
  appearance?: ComponentPreviewAppearance
): CSSProperties {
  const palette = appearance?.palette ?? componentBrandPalette(identity);
  const surfaceMode = appearance?.surface ?? 'base';
  const elevation = appearance?.elevation ?? 'soft';
  const { border, canvas, foreground, muted, mutedForeground, surface } =
    resolveComponentSurfaces(palette, surfaceMode);
  const shadow = componentElevationShadow(elevation, palette.foreground);

  return {
    '--accent': hexToHslChannels(palette.accent),
    '--accent-foreground': hexToHslChannels(palette.accentForeground),
    '--background': hexToHslChannels(surface),
    '--border': hexToHslChannels(border),
    '--card': hexToHslChannels(surface),
    '--card-foreground': hexToHslChannels(foreground),
    '--component-border-width': `${appearance?.borderWidth ?? 1}px`,
    '--component-canvas': hexToHslChannels(canvas),
    '--component-elevation': shadow,
    '--component-letter-spacing': `${(appearance?.letterSpacing ?? 0) / 100}em`,
    '--component-radius': `${radius}px`,
    '--component-text-scale': (appearance?.textScale ?? 100) / 100,
    '--emphasis': hexToHslChannels(palette.accent),
    '--foreground': hexToHslChannels(foreground),
    '--input': hexToHslChannels(border),
    '--muted': hexToHslChannels(muted),
    '--muted-foreground': hexToHslChannels(mutedForeground),
    '--popover': hexToHslChannels(surface),
    '--popover-foreground': hexToHslChannels(foreground),
    '--primary': hexToHslChannels(palette.accent),
    '--primary-foreground': hexToHslChannels(palette.accentForeground),
    '--ring': hexToHslChannels(palette.accent),
    '--secondary': hexToHslChannels(muted),
    '--secondary-foreground': hexToHslChannels(foreground),
    '--status-error': hexToHslChannels(palette.danger),
    '--status-error-background': `${hexToHslChannels(palette.danger)} / 0.12`,
    '--status-error-border': `${hexToHslChannels(palette.danger)} / 0.32`,
    '--status-success': hexToHslChannels(palette.success),
    '--status-success-background': `${hexToHslChannels(palette.success)} / 0.12`,
    '--status-success-border': `${hexToHslChannels(palette.success)} / 0.32`,
    fontFamily: brandTypographyFamily(identity, 'Body'),
  } as CSSProperties;
}
