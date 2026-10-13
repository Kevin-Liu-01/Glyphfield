import type { ComponentLibrarySettings, ComponentMetrics } from '@/lib/componentLibrary';
import { componentElevationShadow, componentMetrics } from '@/lib/componentLibrary';

/**
 * One description of each component's markup and style, rendered three ways:
 * the live preview (React, scoped CSS with forced-state hooks), plain HTML + CSS,
 * and React + Tailwind CSS v4. Styles are written once as declarations per class
 * and state; the CSS and Tailwind outputs are both generated from them.
 *
 * Values use a small token language:
 *   $role, $role/40   semantic color (40 % alpha)       → var(--brand-role) / bg-role/40
 *   @name             a ComponentMetrics length or font → var(--gf-name) in preview, px in export
 *   @radius           the brand radius                  → var(--brand-radius) / rounded-brand
 *   @font, @fontCode  role font stacks                  → var(--brand-font-body) / font-body
 */

// ── Element tree ────────────────────────────────────────────────────────────

export type UiAttrValue = string | number | boolean | undefined;
export type UiElement = {
  attrs?: Record<string, UiAttrValue>;
  children?: UiNode[];
  className?: string;
  style?: Record<string, string>;
  tag: string;
};
export type UiNode = string | UiElement | null | false | undefined;

export function el(tag: string, className?: string, attrs?: Record<string, UiAttrValue> | null, ...children: UiNode[]): UiElement {
  return { attrs: attrs ?? undefined, children, className, tag };
}

export function isElement(node: UiNode): node is UiElement {
  return typeof node === 'object' && node !== null;
}

/** Attributes that drive the live demo and the state matrix only; never exported. */
export const PREVIEW_ONLY_ATTRIBUTES = ['data-action', 'data-force', 'data-roving'] as const;

// ── Icons (24 × 24, 1.75 stroke, currentColor) ──────────────────────────────

const ICONS = {
  'alert': ['M12 9v4', 'M12 17h.01', 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'],
  'arrow-right': ['M5 12h14', 'm13 5 7 7-7 7'],
  'check': ['M20 6 9 17l-5-5'],
  'check-circle': ['M22 11.1V12a10 10 0 1 1-5.9-9.1', 'm22 4-10 10-3-3'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-left': ['m15 18-6-6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  'copy': ['M8 8h12v12H8z', 'M16 8V4H4v12h4'],
  'download': ['M12 3v12', 'm7 10 5 5 5-5', 'M5 21h14'],
  'folder': ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  'info': ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z', 'M12 16v-4', 'M12 8h.01'],
  'minus': ['M5 12h14'],
  'more': ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  'plus': ['M12 5v14', 'M5 12h14'],
  'search': ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z', 'm21 21-4.3-4.3'],
  'sliders': ['M4 21v-7', 'M4 10V3', 'M12 21v-9', 'M12 8V3', 'M20 21v-5', 'M20 12V3', 'M1 14h6', 'M9 8h6', 'M17 16h6'],
  'spinner': ['M21 12a9 9 0 1 1-6.2-8.6'],
  'star': ['m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z'],
  'upload': ['M12 15V3', 'm7 8 5-5 5 5', 'M5 21h14'],
  'x': ['M18 6 6 18', 'm6 6 12 12'],
} as const;

export type UiIconName = keyof typeof ICONS;

export function icon(name: UiIconName, className = 'gf-icon'): UiElement {
  return el('svg', className, {
    'aria-hidden': 'true',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    'stroke-width': 1.75,
    viewBox: '0 0 24 24',
  }, ...ICONS[name].map((d) => el('path', undefined, { d })));
}

// ── Style rules ─────────────────────────────────────────────────────────────

type Decls = Readonly<Record<string, string>>;

type StateKey =
  | 'base' | 'hover' | 'focus' | 'focusAny' | 'active' | 'disabled' | 'invalid' | 'selected' | 'current' | 'pressed'
  | 'checked' | 'busy' | 'placeholder' | 'expanded'
  | 'peerChecked' | 'peerFocus' | 'peerDisabled' | 'peerInvalid' | 'peerHover'
  | 'groupChecked' | 'groupHover' | 'groupFocus';

type Rule = Partial<Record<StateKey, Decls>> & {
  /** For group* states: the ancestor class (gets Tailwind `group`). */
  groupOf?: string;
  /** For peer* states: the preceding sibling class (gets Tailwind `peer`). */
  peerOf?: string;
};

const FOCUS_RING: Decls = { 'outline-color': '$focus', 'outline-offset': '2px', 'outline-style': 'solid', 'outline-width': '2px' };
const FIELD_FOCUS: Decls = { 'border-color': '$focus', 'outline-color': '$focus/25', 'outline-offset': '0px', 'outline-style': 'solid', 'outline-width': '3px' };
const DISABLED: Decls = { cursor: 'not-allowed', opacity: '0.5' };
const BORDERED: Decls = { 'border-color': '$border', 'border-style': 'solid', 'border-width': '@border' };
const HAIRLINE_BOTTOM: Decls = { 'border-bottom-color': '$border', 'border-bottom-style': 'solid', 'border-bottom-width': '1px' };
const SR_ONLY: Decls = { 'sr-only': '1' };

/** Declaration order matters: later classes override earlier ones with the same property. */
export const COMPONENT_RULES: Readonly<Record<string, Rule>> = {
  'gf-root': { base: { color: '$foreground', 'font-family': '@font', 'font-size': '@text', 'font-weight': '@weight', 'letter-spacing': '@tracking', 'line-height': '1.5' } },
  'gf-stack': { base: { display: 'flex', 'flex-direction': 'column', gap: '@gap' } },
  'gf-stack-lg': { base: { display: 'flex', 'flex-direction': 'column', gap: '@space' } },
  'gf-row': { base: { 'align-items': 'center', display: 'flex', 'flex-wrap': 'wrap', gap: '@gap' } },
  'gf-row-between': { base: { 'align-items': 'center', display: 'flex', gap: '@gap', 'justify-content': 'space-between' } },
  'gf-grow': { base: { flex: '1 1 0%', 'min-width': '0px' } },
  'gf-sr-only': { base: SR_ONLY },
  'gf-fieldset': { base: { 'border-width': '0px', margin: '0px', 'min-width': '0px', padding: '0px' } },
  'gf-icon': { base: { 'flex-shrink': '0', height: '@icon', width: '@icon' } },
  'gf-spinner': { base: { animation: 'spin', 'flex-shrink': '0', height: '@icon', width: '@icon' } },
  'gf-title': { base: { color: '$foreground', 'font-family': '@fontDisplay', 'font-size': '@textXl', 'font-weight': '@weightStrong', 'letter-spacing': '-0.01em', 'line-height': '1.15', margin: '0px' } },
  'gf-heading': { base: { color: '$foreground', 'font-size': '@textLg', 'font-weight': '@weightStrong', 'line-height': '1.3', margin: '0px' } },
  'gf-text': { base: { color: '$foreground', margin: '0px' } },
  'gf-muted': { base: { color: '$foreground-muted', 'font-size': '@textSm', margin: '0px' } },
  'gf-eyebrow': { base: { color: '$foreground-muted', 'font-family': '@fontCode', 'font-size': '@textXs', 'letter-spacing': '0.08em', margin: '0px', 'text-transform': 'uppercase' } },
  'gf-num': { base: { 'font-variant-numeric': 'tabular-nums' } },
  'gf-label': { base: { color: '$foreground', 'font-size': '@textSm', 'font-weight': '@weightStrong' } },
  'gf-hint': { base: { color: '$foreground-muted', 'font-size': '@textXs', margin: '0px' } },
  'gf-error-text': { base: { color: '$negative', 'font-size': '@textXs', margin: '0px' } },
  'gf-link': { base: { color: '$foreground', 'text-decoration-line': 'underline', 'text-underline-offset': '3px' }, focus: FOCUS_RING, hover: { color: '$foreground-muted' } },

  // Buttons
  'gf-btn': {
    active: { translate: '0 1px' },
    base: { 'align-items': 'center', 'border-color': 'transparent', 'border-radius': '@radius', 'border-style': 'solid', 'border-width': '@border', cursor: 'pointer', display: 'inline-flex', 'font-size': '@text', 'font-weight': '@weightStrong', gap: '@gapSm', height: '@h', 'justify-content': 'center', 'line-height': '1', 'padding-inline': '@px', transition: 'colors', 'user-select': 'none', 'white-space': 'nowrap' },
    busy: { cursor: 'progress' },
    disabled: DISABLED,
    focus: FOCUS_RING,
  },
  'gf-btn-primary': { active: { 'background-color': '$primary/80' }, base: { 'background-color': '$primary', color: '$primary-foreground' }, hover: { 'background-color': '$primary/88' } },
  'gf-btn-secondary': { active: { 'background-color': '$foreground/14' }, base: { 'background-color': '$surface-muted', color: '$foreground' }, hover: { 'background-color': '$foreground/8' } },
  'gf-btn-outline': { active: { 'background-color': '$foreground/8' }, base: { 'background-color': '$surface', 'border-color': '$border', color: '$foreground' }, hover: { 'background-color': '$surface-muted' } },
  'gf-btn-ghost': { active: { 'background-color': '$foreground/8' }, base: { 'background-color': 'transparent', color: '$foreground' }, hover: { 'background-color': '$surface-muted' } },
  'gf-btn-danger': { active: { 'background-color': '$negative/16' }, base: { 'background-color': 'transparent', 'border-color': '$negative/45', color: '$negative' }, hover: { 'background-color': '$negative/8' } },
  'gf-btn-icon': { base: { 'padding-inline': '0px', width: '@h' } },
  'gf-btn-block': { base: { width: '100%' } },
  'gf-segmented': { base: { 'background-color': '$surface-muted', 'border-radius': '@radius', display: 'inline-flex', gap: '2px', padding: '2px' } },
  'gf-segment': {
    base: { 'background-color': 'transparent', 'border-color': 'transparent', 'border-radius': '@radiusSm', 'border-style': 'solid', 'border-width': '1px', color: '$foreground-muted', cursor: 'pointer', 'font-size': '@textSm', 'font-weight': '@weightStrong', height: '@hSm', 'padding-inline': '@px', transition: 'colors' },
    disabled: DISABLED,
    focus: FOCUS_RING,
    hover: { color: '$foreground' },
    pressed: { 'background-color': '$surface', 'border-color': '$border', color: '$foreground' },
  },
  'gf-joined': { base: { display: 'inline-flex' } },
  'gf-joined-first': { base: { 'border-bottom-right-radius': '0px', 'border-top-right-radius': '0px' } },
  'gf-joined-mid': { base: { 'border-radius': '0px', 'margin-left': '-1px' } },
  'gf-joined-last': { base: { 'border-bottom-left-radius': '0px', 'border-top-left-radius': '0px', 'margin-left': '-1px' } },

  // Fields
  'gf-field': { base: { display: 'flex', 'flex-direction': 'column', gap: '@gapSm' } },
  'gf-control': { base: { 'align-items': 'center', display: 'flex', position: 'relative' } },
  'gf-input': {
    base: { ...BORDERED, 'background-color': '$surface', 'border-radius': '@radius', color: '$foreground', 'font-size': '@text', height: '@h', 'padding-inline': '@px', transition: 'colors', width: '100%' },
    disabled: { 'background-color': '$surface-muted', color: '$foreground-muted', cursor: 'not-allowed' },
    focusAny: FIELD_FOCUS,
    hover: { 'border-color': '$foreground-muted' },
    invalid: { 'border-color': '$negative' },
    placeholder: { color: '$foreground-muted' },
  },
  'gf-input-leading': { base: { 'padding-left': '@pxIcon' } },
  'gf-input-trailing': { base: { 'padding-right': '@pxIcon' } },
  'gf-textarea': { base: { height: 'auto', 'line-height': '1.5', 'min-height': '112px', 'padding-block': '@fieldY', resize: 'vertical' } },
  'gf-select': { base: { appearance: 'none', cursor: 'pointer', 'padding-right': '@pxIcon' } },
  'gf-adornment': { base: { color: '$foreground-muted', left: '@px', 'pointer-events': 'none', position: 'absolute' } },
  'gf-adornment-end': { base: { color: '$foreground-muted', 'pointer-events': 'none', position: 'absolute', right: '@px' } },
  'gf-adornment-end-spin': { base: { animation: 'spin', color: '$foreground-muted', height: '@icon', 'pointer-events': 'none', position: 'absolute', right: '@px', width: '@icon' } },

  // Choices
  'gf-choice': { base: { 'align-items': 'flex-start', cursor: 'pointer', display: 'flex', gap: '@gap', position: 'relative' } },
  'gf-choice-input': SR_ONLY_RULE(),
  'gf-checkbox': {
    base: { ...BORDERED, 'align-items': 'center', 'background-color': '$surface', 'border-color': '$foreground-muted', 'border-radius': '@radiusXs', color: 'transparent', display: 'grid', 'flex-shrink': '0', height: '@check', 'justify-items': 'center', 'margin-top': '2px', transition: 'colors', width: '@check' },
    groupHover: { 'border-color': '$foreground' },
    groupOf: 'gf-choice',
    peerChecked: { 'background-color': '$primary', 'border-color': '$primary', color: '$primary-foreground' },
    peerDisabled: DISABLED,
    peerFocus: FOCUS_RING,
    peerInvalid: { 'border-color': '$negative' },
    peerOf: 'gf-choice-input',
  },
  'gf-radio': {
    base: { ...BORDERED, 'align-items': 'center', 'background-color': '$surface', 'border-color': '$foreground-muted', 'border-radius': '9999px', color: 'transparent', display: 'grid', 'flex-shrink': '0', height: '@check', 'justify-items': 'center', 'margin-top': '2px', transition: 'colors', width: '@check' },
    groupHover: { 'border-color': '$foreground' },
    groupOf: 'gf-choice',
    peerChecked: { 'background-color': '$primary', 'border-color': '$primary', color: '$primary-foreground' },
    peerDisabled: DISABLED,
    peerFocus: FOCUS_RING,
    peerInvalid: { 'border-color': '$negative' },
    peerOf: 'gf-choice-input',
  },
  'gf-check-mark': { base: { height: '75%', width: '75%' } },
  'gf-radio-dot': { base: { 'background-color': 'currentColor', 'border-radius': '9999px', height: '40%', width: '40%' } },
  'gf-switch': {
    base: { 'align-items': 'center', 'background-color': '$foreground-muted', 'border-radius': '9999px', 'border-width': '0px', cursor: 'pointer', display: 'inline-flex', 'flex-shrink': '0', height: '@switchH', padding: '2px', transition: 'colors', width: '@switchW' },
    checked: { 'background-color': '$primary' },
    disabled: DISABLED,
    focus: FOCUS_RING,
    invalid: { 'outline-color': '$negative', 'outline-offset': '2px', 'outline-style': 'solid', 'outline-width': '2px' },
  },
  'gf-switch-thumb': {
    base: { 'background-color': '$background', 'border-radius': '9999px', height: '@switchThumb', transition: 'transform', width: '@switchThumb' },
    groupChecked: { 'background-color': '$primary-foreground', translate: '@switchTravel 0' },
    groupOf: 'gf-switch',
  },
  'gf-dropzone': {
    base: { 'align-items': 'center', 'background-color': '$surface', 'border-color': '$foreground-muted', 'border-radius': '@radiusLg', 'border-style': 'dashed', 'border-width': '1px', color: '$foreground-muted', cursor: 'pointer', display: 'flex', 'flex-direction': 'column', gap: '@gap', 'justify-content': 'center', 'min-height': '176px', padding: '@pad', 'text-align': 'center', transition: 'colors' },
    hover: { 'background-color': '$surface-muted', 'border-color': '$foreground' },
    invalid: { 'border-color': '$negative', color: '$negative' },
    peerDisabled: DISABLED,
    peerFocus: FOCUS_RING,
    peerOf: 'gf-choice-input',
  },

  // Navigation
  'gf-nav': { base: { ...HAIRLINE_BOTTOM, 'align-items': 'center', 'background-color': '$surface', display: 'flex', gap: '@space', height: '@navH', 'padding-inline': '@pad' } },
  'gf-brand': { base: { color: '$foreground', 'font-family': '@fontDisplay', 'font-size': '@textLg', 'font-weight': '@weightStrong', 'letter-spacing': '-0.01em', 'text-decoration-line': 'none' } },
  'gf-nav-list': { base: { display: 'flex', flex: '1 1 0%', gap: '2px', 'list-style': 'none', margin: '0px', padding: '0px' } },
  'gf-nav-link': {
    base: { 'align-items': 'center', 'border-radius': '@radiusSm', color: '$foreground-muted', display: 'inline-flex', 'font-size': '@textSm', height: '@hSm', 'padding-inline': '10px', 'text-decoration-line': 'none', transition: 'colors' },
    current: { 'background-color': '$surface-muted', color: '$foreground' },
    focus: FOCUS_RING,
    hover: { color: '$foreground' },
  },
  'gf-sidebar': { base: { 'background-color': '$surface-muted', 'border-right-color': '$border', 'border-right-style': 'solid', 'border-right-width': '1px', display: 'flex', 'flex-direction': 'column', gap: '2px', padding: '@gap', width: '232px' } },
  'gf-sidebar-heading': { base: { color: '$foreground-muted', 'font-family': '@fontCode', 'font-size': '@textXs', 'letter-spacing': '0.08em', margin: '0px', 'padding-bottom': '4px', 'padding-inline': '10px', 'padding-top': '10px', 'text-transform': 'uppercase' } },
  'gf-sidebar-item': {
    base: { 'align-items': 'center', 'background-color': 'transparent', 'border-color': 'transparent', 'border-radius': '@radiusSm', 'border-style': 'solid', 'border-width': '1px', color: '$foreground-muted', cursor: 'pointer', display: 'flex', 'font-size': '@textSm', gap: '@gapSm', height: '@hSm', 'padding-inline': '10px', 'text-align': 'left', 'text-decoration-line': 'none', transition: 'colors', width: '100%' },
    current: { 'background-color': '$surface', 'border-color': '$border', color: '$foreground' },
    disabled: DISABLED,
    focus: FOCUS_RING,
    hover: { color: '$foreground' },
  },
  'gf-count': { base: { color: '$foreground-muted', 'font-size': '@textXs', 'font-variant-numeric': 'tabular-nums', 'margin-left': 'auto' } },
  'gf-tablist': { base: { ...HAIRLINE_BOTTOM, display: 'flex', gap: '@space' } },
  'gf-tab': {
    base: { 'align-items': 'center', 'background-color': 'transparent', 'border-bottom-color': 'transparent', 'border-bottom-style': 'solid', 'border-bottom-width': '2px', 'border-width': '0px', color: '$foreground-muted', cursor: 'pointer', display: 'inline-flex', 'font-size': '@text', 'font-weight': '@weightStrong', gap: '@gapSm', height: '@h', 'margin-bottom': '-1px', padding: '0px', transition: 'colors' },
    disabled: DISABLED,
    focus: FOCUS_RING,
    hover: { color: '$foreground' },
    selected: { 'border-bottom-color': '$focus', color: '$foreground' },
  },
  'gf-tabpanel': { base: { 'padding-top': '@space' } },
  'gf-breadcrumbs': { base: { 'align-items': 'center', color: '$foreground-muted', display: 'flex', 'flex-wrap': 'wrap', 'font-size': '@textSm', gap: '@gapSm', 'list-style': 'none', margin: '0px', padding: '0px' } },
  'gf-crumb': { base: { 'align-items': 'center', display: 'inline-flex', gap: '@gapSm' } },
  'gf-crumb-link': { base: { 'border-radius': '4px', color: '$foreground-muted', 'text-decoration-line': 'none', transition: 'colors' }, focus: FOCUS_RING, hover: { color: '$foreground', 'text-decoration-line': 'underline', 'text-underline-offset': '3px' } },
  'gf-crumb-current': { base: { color: '$foreground', 'font-weight': '@weightStrong' } },
  'gf-page': {
    base: { 'align-items': 'center', 'background-color': 'transparent', 'border-color': 'transparent', 'border-radius': '@radiusSm', 'border-style': 'solid', 'border-width': '1px', color: '$foreground-muted', cursor: 'pointer', display: 'inline-flex', 'font-size': '@textSm', 'font-variant-numeric': 'tabular-nums', height: '@hSm', 'justify-content': 'center', 'min-width': '@hSm', 'padding-inline': '6px', transition: 'colors' },
    current: { 'background-color': '$surface', 'border-color': '$border', color: '$foreground', 'font-weight': '@weightStrong' },
    disabled: DISABLED,
    focus: FOCUS_RING,
    hover: { 'background-color': '$surface-muted', color: '$foreground' },
  },

  // Surfaces and overlays
  'gf-card': { base: { ...BORDERED, 'background-color': '$surface', 'border-radius': '@radiusLg', 'box-shadow': '@shadow', overflow: 'hidden' } },
  'gf-card-flat': { base: { 'box-shadow': 'none' } },
  'gf-card-body': { base: { display: 'flex', 'flex-direction': 'column', gap: '@gap', padding: '@pad' } },
  'gf-card-footer': { base: { 'align-items': 'center', 'border-top-color': '$border', 'border-top-style': 'solid', 'border-top-width': '1px', display: 'flex', gap: '@gap', 'justify-content': 'space-between', 'padding-block': '@gap', 'padding-inline': '@pad' } },
  'gf-card-interactive': { base: { cursor: 'pointer', display: 'block', 'text-align': 'left', 'text-decoration-line': 'none', transition: 'colors' }, focus: FOCUS_RING, hover: { 'border-color': '$foreground-muted' } },
  'gf-media': { base: { 'align-items': 'end', 'aspect-ratio': '16 / 9', 'background-color': '$surface-muted', color: '$foreground', display: 'flex', 'font-family': '@fontDisplay', 'font-size': '@textXl', 'letter-spacing': '-0.02em', padding: '@pad' } },
  'gf-skeleton': { base: { animation: 'pulse', 'background-color': '$foreground/10', 'border-radius': '@radiusSm', display: 'block', height: '@textSm' } },
  'gf-scrim': { base: { 'align-items': 'center', 'background-color': 'rgb(0 0 0 / 0.45)', display: 'flex', inset: '0px', 'justify-content': 'center', padding: '@space', position: '@overlayPosition' } },
  'gf-dialog': { base: { ...BORDERED, 'background-color': '$surface', 'border-radius': '@radiusLg', 'box-shadow': '@shadow', display: 'flex', 'flex-direction': 'column', gap: '@gap', 'max-width': '440px', padding: '@pad', width: '100%' } },
  'gf-dialog-footer': { base: { display: 'flex', gap: '@gap', 'justify-content': 'flex-end', 'padding-top': '@gapSm' } },
  'gf-sheet': { base: { 'background-color': '$surface', 'border-left-color': '$border', 'border-left-style': 'solid', 'border-left-width': '1px', bottom: '0px', 'box-shadow': '@shadow', display: 'flex', 'flex-direction': 'column', 'max-width': '100%', position: '@overlayPosition', right: '0px', top: '0px', width: '360px' } },
  'gf-sheet-scrim': { base: { 'background-color': 'rgb(0 0 0 / 0.3)', inset: '0px', position: '@overlayPosition' } },
  'gf-sheet-header': { base: { ...HAIRLINE_BOTTOM, 'align-items': 'flex-start', display: 'flex', gap: '@gap', 'justify-content': 'space-between', padding: '@pad' } },
  'gf-sheet-body': { base: { display: 'flex', flex: '1 1 0%', 'flex-direction': 'column', gap: '@space', overflow: 'auto', padding: '@pad' } },
  'gf-sheet-footer': { base: { 'border-top-color': '$border', 'border-top-style': 'solid', 'border-top-width': '1px', display: 'flex', gap: '@gap', 'justify-content': 'flex-end', padding: '@pad' } },
  'gf-anchor': { base: { display: 'inline-flex', position: 'relative' } },
  'gf-popover': { base: { ...BORDERED, 'background-color': '$surface', 'border-radius': '@radius', 'box-shadow': '@shadow', display: 'flex', 'flex-direction': 'column', gap: '2px', 'min-width': '220px', padding: '4px', position: 'absolute', right: '0px', top: 'calc(100% + 6px)', 'z-index': '10' } },
  'gf-menu-item': {
    base: { 'align-items': 'center', 'background-color': 'transparent', 'border-radius': '@radiusSm', 'border-width': '0px', color: '$foreground', cursor: 'pointer', display: 'flex', 'font-size': '@textSm', gap: '@gapSm', height: '@hSm', 'padding-inline': '10px', 'text-align': 'left', width: '100%' },
    disabled: DISABLED,
    focus: { ...FOCUS_RING, 'outline-offset': '-2px' },
    hover: { 'background-color': '$surface-muted' },
    selected: { 'background-color': '$surface-muted' },
  },
  'gf-menu-danger': { base: { color: '$negative' } },
  'gf-separator': { base: { 'background-color': '$border', 'border-width': '0px', height: '1px', 'margin-block': '4px' } },
  'gf-tooltip-anchor': { base: { display: 'inline-flex', position: 'relative' } },
  'gf-tooltip': {
    base: { 'background-color': '$foreground', 'border-radius': '@radiusSm', bottom: 'calc(100% + 8px)', color: '$background', 'font-size': '@textXs', left: '50%', opacity: '0', 'padding-block': '4px', 'padding-inline': '8px', 'pointer-events': 'none', position: 'absolute', transition: 'opacity', translate: '-50% 0', 'white-space': 'nowrap' },
    groupFocus: { opacity: '1' },
    groupHover: { opacity: '1' },
    groupOf: 'gf-tooltip-anchor',
  },
  'gf-command': { base: { ...BORDERED, 'background-color': '$surface', 'border-radius': '@radiusLg', 'box-shadow': '@shadow', 'max-width': '520px', overflow: 'hidden', width: '100%' } },
  'gf-command-search': { base: { ...HAIRLINE_BOTTOM, 'align-items': 'center', color: '$foreground-muted', display: 'flex', gap: '@gap', height: '52px', 'padding-inline': '@pad' } },
  'gf-command-field': { base: { 'background-color': 'transparent', 'border-width': '0px', color: '$foreground', flex: '1 1 0%', 'font-size': '@text', height: '100%', 'outline-style': 'none' }, placeholder: { color: '$foreground-muted' } },
  'gf-command-list': { base: { display: 'flex', 'flex-direction': 'column', gap: '2px', 'list-style': 'none', margin: '0px', padding: '6px' } },
  'gf-kbd': { base: { ...BORDERED, 'border-radius': '4px', 'border-width': '1px', color: '$foreground-muted', 'font-family': '@fontCode', 'font-size': '@textXs', 'margin-left': 'auto', 'padding-block': '1px', 'padding-inline': '6px' } },

  // Feedback
  'gf-alert': { base: { ...BORDERED, 'align-items': 'flex-start', 'background-color': '$surface', 'border-radius': '@radius', display: 'flex', gap: '@gap', padding: '@pad' } },
  'gf-alert-positive': { base: { 'background-color': '$positive/8', 'border-color': '$positive/45' } },
  'gf-alert-caution': { base: { 'background-color': '$caution/10', 'border-color': '$caution/50' } },
  'gf-alert-negative': { base: { 'background-color': '$negative/8', 'border-color': '$negative/45' } },
  'gf-tone-positive': { base: { color: '$positive' } },
  'gf-tone-caution': { base: { color: '$caution' } },
  'gf-tone-negative': { base: { color: '$negative' } },
  'gf-tone-muted': { base: { color: '$foreground-muted' } },
  'gf-toast': { base: { ...BORDERED, 'align-items': 'flex-start', 'background-color': '$surface', 'border-radius': '@radiusLg', 'box-shadow': '@shadow', display: 'flex', gap: '@gap', 'max-width': '400px', padding: '@pad', width: '100%' } },
  'gf-progress': { base: { 'background-color': '$surface-muted', 'border-radius': '9999px', height: '8px', overflow: 'hidden', width: '100%' } },
  'gf-progress-bar': { base: { 'background-color': '$focus', 'border-radius': '9999px', height: '100%', transition: 'width' } },
  'gf-progress-error': { base: { 'background-color': '$negative' } },
  'gf-progress-busy': { base: { animation: 'pulse' } },
  'gf-steps': { base: { display: 'grid', gap: '@gap', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', 'list-style': 'none', margin: '0px', padding: '0px' } },
  'gf-step': { base: { 'border-top-color': '$border', 'border-top-style': 'solid', 'border-top-width': '2px', color: '$foreground-muted', 'font-size': '@textSm', 'padding-top': '@gapSm' }, current: { 'border-top-color': '$focus', color: '$foreground' } },
  'gf-step-done': { base: { 'border-top-color': '$foreground', color: '$foreground' } },
  'gf-badge': { base: { 'align-items': 'center', 'border-radius': '@radiusSm', 'border-style': 'solid', 'border-width': '1px', display: 'inline-flex', 'font-size': '@textXs', 'font-weight': '@weightStrong', gap: '6px', height: '@badgeH', 'line-height': '1', 'padding-inline': '8px', 'white-space': 'nowrap' } },
  'gf-badge-neutral': { base: { 'background-color': '$surface-muted', 'border-color': '$border', color: '$foreground' } },
  'gf-badge-primary': { base: { 'background-color': '$primary', 'border-color': 'transparent', color: '$primary-foreground' } },
  'gf-badge-outline': { base: { 'background-color': 'transparent', 'border-color': '$border', color: '$foreground' } },
  'gf-dot': { base: { 'background-color': 'currentColor', 'border-radius': '9999px', 'flex-shrink': '0', height: '6px', width: '6px' } },
  'gf-empty': { base: { 'align-items': 'center', display: 'flex', 'flex-direction': 'column', gap: '@gap', 'max-width': '420px', 'padding-block': '@space', 'text-align': 'center' } },
  'gf-empty-icon': { base: { ...BORDERED, 'align-items': 'center', 'background-color': '$surface-muted', 'border-radius': '@radiusLg', color: '$foreground', display: 'flex', height: '48px', 'justify-content': 'center', width: '48px' } },

  // Data
  'gf-table-wrap': { base: { ...BORDERED, 'background-color': '$surface', 'border-radius': '@radiusLg', overflow: 'hidden' } },
  'gf-table': { base: { 'border-collapse': 'collapse', 'font-size': '@textSm', width: '100%' } },
  'gf-th': { base: { ...HAIRLINE_BOTTOM, 'background-color': '$surface-muted', color: '$foreground-muted', 'font-size': '@textXs', 'font-weight': '@weightStrong', 'padding-block': '10px', 'padding-inline': '@px', 'text-align': 'left', 'white-space': 'nowrap' } },
  'gf-tr': { hover: { 'background-color': '$surface-muted' } },
  'gf-tr-selected': { base: { 'background-color': '$primary/10' } },
  'gf-td': { base: { ...HAIRLINE_BOTTOM, color: '$foreground', 'padding-block': '@cellY', 'padding-inline': '@px' } },
  'gf-td-num': { base: { 'font-variant-numeric': 'tabular-nums', 'text-align': 'right' } },
  'gf-stats': { base: { ...BORDERED, 'background-color': '$border', 'border-radius': '@radiusLg', display: 'grid', gap: '1px', 'grid-template-columns': 'repeat(3, minmax(0, 1fr))', overflow: 'hidden' } },
  'gf-stat': { base: { 'background-color': '$surface', display: 'flex', 'flex-direction': 'column', gap: '@gapSm', padding: '@pad' } },
  'gf-stat-value': { base: { color: '$foreground', 'font-family': '@fontDisplay', 'font-size': '@textXl', 'font-variant-numeric': 'tabular-nums', 'font-weight': '@weightStrong', 'letter-spacing': '-0.02em', 'line-height': '1.1', margin: '0px' } },
  'gf-bars': { base: { ...HAIRLINE_BOTTOM, 'align-items': 'flex-end', display: 'flex', gap: '@gapSm', height: '168px' } },
  'gf-bar': {
    base: { 'background-color': '$foreground/14', 'border-top-left-radius': '@radiusSm', 'border-top-right-radius': '@radiusSm', 'border-width': '0px', cursor: 'pointer', flex: '1 1 0%', padding: '0px', transition: 'colors' },
    focus: FOCUS_RING,
    hover: { 'background-color': '$foreground/30' },
    pressed: { 'background-color': '$focus' },
  },
  'gf-axis': { base: { color: '$foreground-muted', display: 'flex', 'font-family': '@fontCode', 'font-size': '@textXs', gap: '@gapSm' } },
  'gf-axis-label': { base: { flex: '1 1 0%', 'text-align': 'center' } },

  // Commerce and content
  'gf-price': { base: { color: '$foreground', 'font-family': '@fontDisplay', 'font-size': '@textDisplay', 'font-variant-numeric': 'tabular-nums', 'font-weight': '@weightStrong', 'letter-spacing': '-0.03em', 'line-height': '1', margin: '0px' } },
  'gf-list': { base: { display: 'flex', 'flex-direction': 'column', gap: '@gapSm', 'list-style': 'none', margin: '0px', padding: '0px' } },
  'gf-list-item': { base: { 'align-items': 'flex-start', display: 'flex', 'font-size': '@textSm', gap: '@gapSm' } },
  'gf-split': { base: { display: 'grid', 'grid-template-columns': 'minmax(0, 1.4fr) minmax(0, 1fr)' } },
  'gf-aside': { base: { 'background-color': '$surface-muted', 'border-left-color': '$border', 'border-left-style': 'solid', 'border-left-width': '1px', display: 'flex', 'flex-direction': 'column', gap: '@gap', padding: '@pad' } },
  'gf-grid-2': { base: { display: 'grid', gap: '@gap', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' } },
  'gf-quote': { base: { color: '$foreground', 'font-family': '@fontDisplay', 'font-size': '@textXl', 'letter-spacing': '-0.01em', 'line-height': '1.25', margin: '0px' } },
  'gf-avatar': { base: { 'align-items': 'center', 'background-color': '$foreground', 'border-radius': '9999px', color: '$background', display: 'flex', 'flex-shrink': '0', 'font-size': '@textXs', 'font-weight': '@weightStrong', height: '32px', 'justify-content': 'center', width: '32px' } },
  'gf-inbox': { base: { display: 'grid', 'grid-template-columns': 'minmax(0, 0.9fr) minmax(0, 1.4fr)', 'min-height': '320px' } },
  'gf-inbox-list': { base: { 'border-right-color': '$border', 'border-right-style': 'solid', 'border-right-width': '1px', display: 'flex', 'flex-direction': 'column', gap: '2px', padding: '6px' } },
  'gf-inbox-item': {
    base: { 'background-color': 'transparent', 'border-radius': '@radiusSm', 'border-width': '0px', color: '$foreground', cursor: 'pointer', display: 'flex', 'flex-direction': 'column', gap: '2px', padding: '10px', 'text-align': 'left', transition: 'colors', width: '100%' },
    current: { 'background-color': '$surface-muted' },
    focus: { ...FOCUS_RING, 'outline-offset': '-2px' },
    hover: { 'background-color': '$surface-muted' },
  },
  'gf-truncate': { base: { overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' } },
  'gf-article': { base: { display: 'flex', 'flex-direction': 'column', gap: '@gap', 'max-width': '62ch' } },
  'gf-lead': { base: { color: '$foreground-muted', 'font-size': '@textLg', 'line-height': '1.55', margin: '0px' } },
  'gf-prose': { base: { color: '$foreground', 'line-height': '1.7', margin: '0px' } },
  'gf-blockquote': { base: { 'border-left-color': '$focus', 'border-left-style': 'solid', 'border-left-width': '2px', color: '$foreground', 'font-family': '@fontDisplay', 'font-size': '@textLg', 'line-height': '1.4', margin: '0px', 'padding-left': '@pad' } },
  'gf-dl': { base: { ...BORDERED, 'border-radius': '@radiusLg', display: 'grid', 'font-size': '@textSm', 'grid-template-columns': '140px minmax(0, 1fr)', margin: '0px', overflow: 'hidden' } },
  'gf-dt': { base: { ...HAIRLINE_BOTTOM, 'background-color': '$surface-muted', color: '$foreground-muted', 'font-family': '@fontCode', 'font-size': '@textXs', 'padding-block': '@cellY', 'padding-inline': '@px' } },
  'gf-dd': { base: { ...HAIRLINE_BOTTOM, color: '$foreground', margin: '0px', 'overflow-wrap': 'anywhere', 'padding-block': '@cellY', 'padding-inline': '@px' } },
};

function SR_ONLY_RULE(): Rule {
  return { base: SR_ONLY };
}

// ── Token resolution ────────────────────────────────────────────────────────

export type MarkupContext = {
  metrics: ComponentMetrics;
  /** Preview CSS uses custom properties and forced-state selectors. */
  preview: boolean;
  shadow: string;
  /** The role whose font family components use. */
  fontRole: 'display' | 'body' | 'accent' | 'code';
};

export function markupContext(settings: ComponentLibrarySettings, foreground: string, preview: boolean): MarkupContext {
  return {
    fontRole: settings.typography.role.toLocaleLowerCase() as MarkupContext['fontRole'],
    metrics: componentMetrics(settings),
    preview,
    shadow: componentElevationShadow(settings.elevation, foreground),
  };
}

type ColorToken = { alpha?: number; role: string };

function parseColorToken(value: string): ColorToken | null {
  const match = /^\$([a-z-]+)(?:\/(\d{1,3}))?$/.exec(value);
  if (!match) return null;
  return { alpha: match[2] === undefined ? undefined : Number(match[2]), role: match[1]! };
}

function cssColor(token: ColorToken): string {
  const variable = `var(--brand-${token.role})`;
  return token.alpha === undefined ? variable : `color-mix(in oklab, ${variable} ${token.alpha}%, transparent)`;
}

const FONT_TOKENS: Record<string, (context: MarkupContext) => string> = {
  '@font': (context) => context.fontRole,
  '@fontCode': () => 'code',
  '@fontDisplay': () => 'display',
};

/** A single token or a space-separated list of tokens and plain values, as CSS. */
function cssValue(value: string, context: MarkupContext): string {
  return value.split(' ').map((part) => cssToken(part, context)).join(' ');
}

function cssToken(token: string, context: MarkupContext): string {
  const color = parseColorToken(token);
  if (color) return cssColor(color);
  if (!token.startsWith('@')) return token;
  if (token in FONT_TOKENS) return `var(--brand-font-${FONT_TOKENS[token]!(context)})`;
  if (token === '@radius') return 'var(--brand-radius)';
  if (token === '@shadow') return context.preview ? 'var(--gf-shadow)' : context.shadow;
  if (token === '@overlayPosition') return context.preview ? 'absolute' : 'fixed';
  if (token === '@tracking') return context.preview ? 'var(--gf-tracking)' : `${context.metrics.tracking}em`;
  const name = token.slice(1) as keyof ComponentMetrics;
  const metric = context.metrics[name];
  if (typeof metric !== 'number') return token;
  if (name === 'weight' || name === 'weightStrong') return context.preview ? `var(--gf-${name})` : String(metric);
  return context.preview ? `var(--gf-${name})` : `${metric}px`;
}

// ── CSS ─────────────────────────────────────────────────────────────────────

type SelectorParts = {
  force: (name: string) => string[];
  group: string;
  peer: string;
  preview: boolean;
  self: string;
};

const NOT_DISABLED = ':not(:disabled):not([aria-disabled="true"])';

/** Selectors per state; forced-state hooks only exist in the preview. */
const STATE_SELECTORS: Readonly<Record<StateKey, (parts: SelectorParts) => string[]>> = {
  active: ({ force, self }) => [`${self}:active:not(:disabled)`, ...force('active')],
  base: ({ self }) => [self],
  busy: ({ self }) => [`${self}[aria-busy="true"]`],
  checked: ({ self }) => [`${self}:checked`, `${self}[aria-checked="true"]`],
  current: ({ self }) => [`${self}[aria-current="page"]`, `${self}[aria-current="true"]`],
  disabled: ({ self }) => [`${self}:disabled`, `${self}[aria-disabled="true"]`],
  expanded: ({ self }) => [`${self}[aria-expanded="true"]`],
  focus: ({ force, self }) => [`${self}:focus-visible`, ...force('focus')],
  focusAny: ({ force, self }) => [`${self}:focus`, ...force('focus')],
  groupChecked: ({ group, self }) => [`${group}[aria-checked="true"] ${self}`],
  groupFocus: ({ group, preview, self }) => [`${group}:focus-within ${self}`, ...(preview ? [`${group}[data-force="focus"] ${self}`] : [])],
  groupHover: ({ group, preview, self }) => [`${group}:hover ${self}`, ...(preview ? [`${group}[data-force="hover"] ${self}`] : [])],
  hover: ({ force, self }) => [`${self}:hover${NOT_DISABLED}`, ...force('hover')],
  invalid: ({ self }) => [`${self}[aria-invalid="true"]`],
  peerChecked: ({ peer, self }) => [`${peer}:checked ~ ${self}`],
  peerDisabled: ({ peer, self }) => [`${peer}:disabled ~ ${self}`],
  peerFocus: ({ peer, preview, self }) => [`${peer}:focus-visible ~ ${self}`, ...(preview ? [`${peer}[data-force="focus"] ~ ${self}`] : [])],
  peerHover: ({ peer, preview, self }) => [`${peer}:hover ~ ${self}`, ...(preview ? [`${peer}[data-force="hover"] ~ ${self}`] : [])],
  peerInvalid: ({ peer, self }) => [`${peer}[aria-invalid="true"] ~ ${self}`],
  placeholder: ({ self }) => [`${self}::placeholder`],
  pressed: ({ self }) => [`${self}[aria-pressed="true"]`],
  selected: ({ self }) => [`${self}[aria-selected="true"]`],
};

function stateSelectors(className: string, state: StateKey, rule: Rule, preview: boolean): string[] {
  const self = `.${className}`;
  return STATE_SELECTORS[state]({
    force: (name) => (preview ? [`${self}[data-force="${name}"]`] : []),
    group: rule.groupOf ? `.${rule.groupOf}` : '',
    peer: rule.peerOf ? `.${rule.peerOf}` : '',
    preview,
    self,
  });
}

const STATE_ORDER: readonly StateKey[] = [
  'base', 'placeholder', 'hover', 'groupHover', 'peerHover', 'pressed', 'current', 'selected', 'checked', 'peerChecked', 'groupChecked',
  'expanded', 'busy', 'invalid', 'peerInvalid', 'active', 'focusAny', 'focus', 'peerFocus', 'groupFocus', 'disabled', 'peerDisabled',
];

const KEYFRAMES = {
  pulse: '@keyframes gf-pulse { 50% { opacity: 0.5; } }',
  spin: '@keyframes gf-spin { to { transform: rotate(360deg); } }',
} as const;

const ANIMATIONS: Record<string, string> = {
  pulse: 'gf-pulse 1.6s ease-in-out infinite',
  spin: 'gf-spin 0.8s linear infinite',
};

const TRANSITIONS: Record<string, string> = {
  colors: 'background-color 140ms ease, border-color 140ms ease, color 140ms ease, outline-color 140ms ease',
  opacity: 'opacity 140ms ease',
  transform: 'transform 160ms ease, translate 160ms ease, background-color 160ms ease',
  width: 'width 240ms ease',
};

function cssDeclarations(decls: Decls, context: MarkupContext): string[] {
  const lines: string[] = [];
  for (const [property, value] of Object.entries(decls)) {
    if (property === 'sr-only') {
      lines.push('position: absolute', 'width: 1px', 'height: 1px', 'padding: 0', 'margin: -1px', 'overflow: hidden', 'clip: rect(0, 0, 0, 0)', 'white-space: nowrap', 'border-width: 0');
    } else if (property === 'animation') {
      lines.push(`animation: ${ANIMATIONS[value] ?? value}`);
    } else if (property === 'transition') {
      lines.push(`transition: ${TRANSITIONS[value] ?? value}`);
    } else {
      lines.push(`${property}: ${cssValue(value, context)}`);
    }
  }
  return lines;
}

/** Every class used in a tree, in document order. */
export function collectClasses(node: UiNode, into: Set<string> = new Set()): Set<string> {
  if (!isElement(node)) return into;
  for (const name of node.className?.split(/\s+/) ?? []) if (name) into.add(name);
  for (const child of node.children ?? []) collectClasses(child, into);
  return into;
}

/**
 * CSS for the classes in use, in rule-definition order so later classes override
 * earlier ones. `scope` prefixes every selector (the preview pane root).
 */
export function componentCss(classes: ReadonlySet<string>, context: MarkupContext, scope = ''): string {
  const blocks: string[] = [];
  const animations = new Set<keyof typeof KEYFRAMES>();
  const prefix = scope ? `${scope} ` : '';
  for (const [className, rule] of Object.entries(COMPONENT_RULES)) {
    if (!classes.has(className)) continue;
    for (const state of STATE_ORDER) {
      const decls = rule[state];
      if (!decls) continue;
      if (decls.animation && decls.animation in KEYFRAMES) animations.add(decls.animation as keyof typeof KEYFRAMES);
      const selectors = stateSelectors(className, state, rule, context.preview).map((selector) => `${prefix}${selector}`);
      blocks.push(`${selectors.join(',\n')} {\n${cssDeclarations(decls, context).map((line) => `  ${line};`).join('\n')}\n}`);
    }
  }
  for (const name of animations) blocks.push(KEYFRAMES[name]);
  if (animations.size) blocks.push(`@media (prefers-reduced-motion: reduce) {\n  ${prefix}[class*="gf-"] { animation-duration: 2.4s !important; transition-duration: 0ms !important; }\n}`);
  return blocks.join('\n\n');
}

// ── Tailwind ────────────────────────────────────────────────────────────────

const TAILWIND_VARIANT: Record<Exclude<StateKey, 'base'>, string> = {
  active: 'active:',
  busy: 'aria-busy:',
  checked: 'aria-checked:',
  current: 'aria-[current=page]:',
  disabled: 'disabled:',
  expanded: 'aria-expanded:',
  focus: 'focus-visible:',
  focusAny: 'focus:',
  groupChecked: 'group-aria-checked:',
  groupFocus: 'group-focus-within:',
  groupHover: 'group-hover:',
  hover: 'hover:',
  invalid: 'aria-invalid:',
  peerChecked: 'peer-checked:',
  peerDisabled: 'peer-disabled:',
  peerFocus: 'peer-focus-visible:',
  peerHover: 'peer-hover:',
  peerInvalid: 'peer-aria-invalid:',
  placeholder: 'placeholder:',
  pressed: 'aria-pressed:',
  selected: 'aria-selected:',
};

const NAMED_FONT_SIZES: Record<number, string> = { 12: 'xs', 14: 'sm', 16: 'base', 18: 'lg', 20: 'xl', 24: '2xl', 30: '3xl', 36: '4xl', 48: '5xl', 60: '6xl' };
const NAMED_WEIGHTS: Record<number, string> = { 100: 'thin', 200: 'extralight', 300: 'light', 400: 'normal', 500: 'medium', 600: 'semibold', 700: 'bold' };

function arbitrary(value: string): string {
  return value.replaceAll(' ', '_');
}

/** A spacing utility: 16px → `p-4`, 6px → `p-1.5`, 13px → `p-[13px]`. */
function spacing(prefix: string, px: number): string {
  if (px === 0) return `${prefix}-0`;
  const negative = px < 0 ? '-' : '';
  const magnitude = Math.abs(px);
  if ((magnitude * 4) % 1 === 0 && magnitude % 2 === 0) return `${negative}${prefix}-${magnitude / 4}`;
  return `${negative}${prefix}-[${magnitude}px]`;
}

type ResolvedValue =
  | { kind: 'color'; token: ColorToken }
  | { kind: 'px'; px: number }
  | { kind: 'radius' }
  | { kind: 'font'; role: string }
  | { kind: 'raw'; value: string };

function resolveToken(value: string, context: MarkupContext): ResolvedValue {
  const color = parseColorToken(value);
  if (color) return { kind: 'color', token: color };
  if (value === '@radius') return { kind: 'radius' };
  if (value in FONT_TOKENS) return { kind: 'font', role: FONT_TOKENS[value]!(context) };
  if (value.startsWith('@')) {
    const resolved = cssToken(value, { ...context, preview: false });
    const px = /^(-?\d+(?:\.\d+)?)px$/.exec(resolved);
    return px ? { kind: 'px', px: Number(px[1]) } : { kind: 'raw', value: resolved };
  }
  const px = /^(-?\d+(?:\.\d+)?)px$/.exec(value);
  return px ? { kind: 'px', px: Number(px[1]) } : { kind: 'raw', value };
}

function colorClass(prefix: string, token: ColorToken): string {
  return `${prefix}-${token.role}${token.alpha === undefined ? '' : `/${token.alpha}`}`;
}

const SPACING_PROPERTIES: Record<string, string> = {
  bottom: 'bottom', gap: 'gap', height: 'h', inset: 'inset', left: 'left', margin: 'm', 'margin-bottom': 'mb', 'margin-left': 'ml', 'margin-right': 'mr',
  'margin-block': 'my', 'margin-top': 'mt', 'max-width': 'max-w', 'min-height': 'min-h', 'min-width': 'min-w', padding: 'p', 'padding-block': 'py', 'padding-bottom': 'pb',
  'padding-inline': 'px', 'padding-left': 'pl', 'padding-right': 'pr', 'padding-top': 'pt', right: 'right', top: 'top', width: 'w',
};

const KEYWORD_CLASSES: Record<string, Record<string, string>> = {
  'align-items': { baseline: 'items-baseline', center: 'items-center', end: 'items-end', 'flex-end': 'items-end', 'flex-start': 'items-start', start: 'items-start', stretch: 'items-stretch' },
  appearance: { none: 'appearance-none' },
  // Scrims stay black in both themes.
  'background-color': { 'rgb(0 0 0 / 0.3)': 'bg-black/30', 'rgb(0 0 0 / 0.45)': 'bg-black/45' },
  'border-collapse': { collapse: 'border-collapse' },
  'border-style': { dashed: 'border-dashed', none: 'border-none', solid: 'border-solid' },
  cursor: { default: 'cursor-default', 'not-allowed': 'cursor-not-allowed', pointer: 'cursor-pointer', progress: 'cursor-progress' },
  display: { block: 'block', contents: 'contents', flex: 'flex', grid: 'grid', 'inline-block': 'inline-block', 'inline-flex': 'inline-flex', none: 'hidden' },
  flex: { '1 1 0%': 'flex-1', none: 'flex-none' },
  'flex-direction': { column: 'flex-col', row: 'flex-row' },
  'flex-shrink': { '0': 'shrink-0' },
  'flex-wrap': { wrap: 'flex-wrap' },
  'font-variant-numeric': { 'tabular-nums': 'tabular-nums' },
  'justify-content': { center: 'justify-center', end: 'justify-end', 'flex-end': 'justify-end', 'flex-start': 'justify-start', 'space-between': 'justify-between' },
  'justify-items': { center: 'justify-items-center' },
  'list-style': { none: 'list-none' },
  'outline-style': { none: 'outline-none', solid: 'outline-solid' },
  overflow: { auto: 'overflow-auto', hidden: 'overflow-hidden' },
  'overflow-wrap': { anywhere: 'wrap-anywhere' },
  'pointer-events': { none: 'pointer-events-none' },
  position: { absolute: 'absolute', fixed: 'fixed', relative: 'relative' },
  resize: { vertical: 'resize-y' },
  'text-align': { center: 'text-center', left: 'text-left', right: 'text-right' },
  'text-decoration-line': { none: 'no-underline', underline: 'underline' },
  'text-overflow': { ellipsis: 'text-ellipsis' },
  'text-transform': { uppercase: 'uppercase' },
  transition: { colors: 'transition-colors', opacity: 'transition-opacity', transform: 'transition-transform', width: 'transition-[width]' },
  'user-select': { none: 'select-none' },
  'white-space': { nowrap: 'whitespace-nowrap' },
};

const COLOR_PREFIX: Record<string, string> = {
  'background-color': 'bg', 'border-bottom-color': 'border-b', 'border-color': 'border', 'border-left-color': 'border-l', 'border-right-color': 'border-r',
  'border-top-color': 'border-t', color: 'text', 'outline-color': 'outline',
};

const BORDER_WIDTH_PREFIX: Record<string, string> = {
  'border-bottom-width': 'border-b', 'border-left-width': 'border-l', 'border-right-width': 'border-r', 'border-top-width': 'border-t', 'border-width': 'border',
};

const RADIUS_PREFIX: Record<string, string> = {
  'border-bottom-left-radius': 'rounded-bl', 'border-bottom-right-radius': 'rounded-br', 'border-radius': 'rounded', 'border-top-left-radius': 'rounded-tl', 'border-top-right-radius': 'rounded-tr',
};

type Declaration = {
  context: MarkupContext;
  property: string;
  /** The value with tokens resolved for export (px numbers, colors, fonts). */
  resolved: () => ResolvedValue;
  value: string;
};

type Converter = (declaration: Declaration) => string[] | null;

function exportCss(value: string, context: MarkupContext): string {
  return cssValue(value, { ...context, preview: false });
}

const convertSpecial: Converter = ({ property, value }) => {
  if (property === 'sr-only') return ['sr-only'];
  if (property === 'animation') return [value === 'spin' ? 'animate-spin' : value === 'pulse' ? 'animate-pulse' : `[animation:${arbitrary(value)}]`];
  // Tailwind's preflight already draws borders solid; border-b and friends set the width.
  if (/^border(-(top|right|bottom|left))?-style$/.test(property) && value === 'solid') return [];
  return null;
};

const convertKeyword: Converter = ({ context, property, value }) => {
  const table = KEYWORD_CLASSES[property];
  if (!table) return null;
  const keyword = table[value] ?? (value.startsWith('@') ? table[cssToken(value, { ...context, preview: false })] : undefined);
  return keyword ? [keyword] : null;
};

function translateUtilities(values: readonly ResolvedValue[]): string[] {
  const [x, y] = values;
  const output: string[] = [];
  if (x?.kind === 'px' && x.px !== 0) output.push(spacing('translate-x', x.px));
  if (x?.kind === 'raw' && x.value !== '0') output.push(x.value === '-50%' ? '-translate-x-1/2' : `translate-x-[${x.value}]`);
  if (y?.kind === 'px' && y.px !== 0) output.push(spacing('translate-y', y.px));
  return output.length ? output : ['translate-none'];
}

const convertMultiPart: Converter = ({ context, property, value }) => {
  const parts = value.split(' ');
  if (parts.length < 2) return null;
  if (property === 'translate') return translateUtilities(parts.map((part) => resolveToken(part, context)));
  return [`[${property}:${arbitrary(exportCss(value, context))}]`];
};

const convertColor: Converter = ({ property, resolved, value }) => {
  const prefix = COLOR_PREFIX[property];
  if (!prefix) return null;
  const token = resolved();
  if (token.kind === 'color') return [colorClass(prefix, token.token)];
  if (value === 'transparent') return [`${prefix}-transparent`];
  if (value === 'currentColor') return [`${prefix}-current`];
  return null;
};

const convertBorderWidth: Converter = ({ property, resolved }) => {
  const prefix = BORDER_WIDTH_PREFIX[property];
  const token = resolved();
  if (!prefix || token.kind !== 'px') return null;
  if (token.px === 1) return [prefix];
  return [Number.isInteger(token.px) && [0, 2, 4, 8].includes(token.px) ? `${prefix}-${token.px}` : `${prefix}-[${token.px}px]`];
};

const convertRadius: Converter = ({ property, resolved }) => {
  const prefix = RADIUS_PREFIX[property];
  if (!prefix) return null;
  const token = resolved();
  if (token.kind === 'radius') return [`${prefix}-brand`];
  if (token.kind !== 'px') return null;
  return [token.px === 0 ? `${prefix}-none` : token.px >= 9999 ? `${prefix}-full` : `${prefix}-[${token.px}px]`];
};

const SPACING_KEYWORDS: Readonly<Record<string, string>> = { '100%': 'full', '50%': '1/2', auto: 'auto' };

const convertSpacing: Converter = ({ property, resolved }) => {
  const prefix = SPACING_PROPERTIES[property];
  if (!prefix) return null;
  const token = resolved();
  if (token.kind === 'px') return [spacing(prefix, token.px)];
  if (token.kind !== 'raw') return null;
  const keyword = SPACING_KEYWORDS[token.value];
  return [keyword ? `${prefix}-${keyword}` : `${prefix}-[${arbitrary(token.value)}]`];
};

/** Typography properties whose tokens resolve to px or plain values. */
const TYPE_CONVERTERS: Readonly<Record<string, (token: ResolvedValue) => string | null>> = {
  'font-family': (token) => (token.kind === 'font' ? `font-${token.role}` : null),
  'font-size': (token) => (token.kind === 'px' ? (NAMED_FONT_SIZES[token.px] ? `text-${NAMED_FONT_SIZES[token.px]}` : `text-[${token.px}px]`) : null),
  'font-weight': (token) => (token.kind === 'raw' ? (NAMED_WEIGHTS[Number(token.value)] ? `font-${NAMED_WEIGHTS[Number(token.value)]}` : `font-[${token.value}]`) : null),
  'letter-spacing': (token) => (token.kind === 'raw' ? (token.value === '0em' ? 'tracking-normal' : `tracking-[${token.value}]`) : null),
  'line-height': (token) => (token.kind === 'raw' ? (token.value === '1' ? 'leading-none' : `leading-[${token.value}]`) : null),
  opacity: (token) => (token.kind === 'raw' ? `opacity-${Math.round(Number(token.value) * 100)}` : null),
  'outline-offset': (token) => (token.kind === 'px' ? (token.px < 0 ? `-outline-offset-${-token.px}` : `outline-offset-${token.px}`) : null),
  'outline-width': (token) => (token.kind === 'px' ? `outline-${token.px}` : null),
  'text-underline-offset': (token) => (token.kind === 'px' ? `underline-offset-${token.px}` : null),
  translate: (token) => (token.kind === 'px' ? spacing('translate-x', token.px) : null),
};

const convertType: Converter = ({ property, resolved }) => {
  const convert = TYPE_CONVERTERS[property];
  const utility = convert?.(resolved());
  return utility ? [utility] : null;
};

const GRID_COLUMNS: Readonly<Record<string, string>> = {
  'repeat(2, minmax(0, 1fr))': 'grid-cols-2',
  'repeat(3, minmax(0, 1fr))': 'grid-cols-3',
};

const convertMisc: Converter = ({ context, property, value }) => {
  if (property === 'z-index') return [`z-${value}`];
  if (property === 'aspect-ratio') return [value === '16 / 9' ? 'aspect-video' : `aspect-[${value.replaceAll(' ', '')}]`];
  if (property === 'grid-template-columns') return [GRID_COLUMNS[value] ?? `grid-cols-[${arbitrary(value.replaceAll(', ', ','))}]`];
  if (property === 'box-shadow') {
    const shadow = cssToken(value, { ...context, preview: false });
    return [shadow === 'none' ? 'shadow-none' : `shadow-[${arbitrary(shadow.replaceAll(', ', ','))}]`];
  }
  return null;
};

const CONVERTERS: readonly Converter[] = [
  convertSpecial, convertKeyword, convertMultiPart, convertColor, convertBorderWidth, convertRadius,
  convertSpacing, convertType, convertMisc,
];

/** One CSS declaration as Tailwind CSS v4 utilities (usually one); unknown ones become arbitrary properties. */
function tailwindUtilities(property: string, value: string, context: MarkupContext): string[] {
  let cached: ResolvedValue | null = null;
  const declaration: Declaration = { context, property, resolved: () => (cached ??= resolveToken(value, context)), value };
  for (const convert of CONVERTERS) {
    const utilities = convert(declaration);
    if (utilities) return utilities;
  }
  return [`[${property}:${arbitrary(exportCss(value, context))}]`];
}

/** Classes other rules name as their Tailwind `group` or `peer`. */
const MARKER_CLASSES: ReadonlyMap<string, 'group' | 'peer'> = new Map(Object.values(COMPONENT_RULES).flatMap((rule) => [
  ...(rule.groupOf ? [[rule.groupOf, 'group'] as const] : []),
  ...(rule.peerOf ? [[rule.peerOf, 'peer'] as const] : []),
]));

/** Declarations per state for an element's classes, later classes overriding earlier ones. */
function mergedDeclarations(names: readonly string[]): Map<StateKey, Map<string, string>> {
  const merged = new Map<StateKey, Map<string, string>>();
  for (const rule of names.map((name) => COMPONENT_RULES[name]).filter((rule): rule is Rule => Boolean(rule))) {
    for (const state of STATE_ORDER) {
      const decls = rule[state];
      if (!decls) continue;
      const target = merged.get(state) ?? new Map<string, string>();
      for (const [property, value] of Object.entries(decls)) target.set(property, value);
      merged.set(state, target);
    }
  }
  return merged;
}

function buildTailwindClassName(names: readonly string[], context: MarkupContext): string {
  const markers = names.map((name) => MARKER_CLASSES.get(name)).filter((marker): marker is 'group' | 'peer' => Boolean(marker));
  const merged = mergedDeclarations(names);
  const utilities: string[] = [...markers];
  for (const state of STATE_ORDER) {
    const variant = state === 'base' ? '' : TAILWIND_VARIANT[state];
    for (const [property, value] of merged.get(state) ?? []) {
      for (const utility of tailwindUtilities(property, value, context)) utilities.push(`${variant}${utility}`);
    }
  }
  return [...new Set(utilities)].join(' ');
}

const tailwindCache = new WeakMap<MarkupContext, Map<string, string>>();

/** Tailwind classes for an element: its rules merged in order, then each state as a variant. */
export function tailwindClassName(className: string | undefined, context: MarkupContext): string {
  const key = className ?? '';
  const cache = tailwindCache.get(context) ?? new Map<string, string>();
  tailwindCache.set(context, cache);
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const result = buildTailwindClassName(key.split(/\s+/).filter(Boolean), context);
  cache.set(key, result);
  return result;
}

// ── Serializers ─────────────────────────────────────────────────────────────

const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'path', 'circle', 'rect']);

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;');
}

function exportedAttributes(node: UiElement): [string, UiAttrValue][] {
  return Object.entries(node.attrs ?? {}).filter(([name, value]) => value !== undefined && value !== false && !(PREVIEW_ONLY_ATTRIBUTES as readonly string[]).includes(name));
}

function styleString(style: Record<string, string>): string {
  return Object.entries(style).map(([property, value]) => `${property}: ${value}`).join('; ');
}

/** Plain HTML with the semantic gf-* classes. */
export function toHtml(node: UiNode, depth = 0): string {
  if (!isElement(node)) return typeof node === 'string' ? escapeText(node) : '';
  const indent = '  '.repeat(depth);
  const attrs = [
    node.className ? ` class="${escapeAttribute(node.className)}"` : '',
    ...exportedAttributes(node).map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${escapeAttribute(String(value))}"`)),
    node.style ? ` style="${escapeAttribute(styleString(node.style))}"` : '',
  ].join('');
  const children = (node.children ?? []).filter((child) => child !== null && child !== false && child !== undefined && child !== '');
  if (VOID_TAGS.has(node.tag) && !children.length) return `${indent}<${node.tag}${attrs}${node.tag === 'path' || node.tag === 'circle' || node.tag === 'rect' ? ' /' : ''}>`;
  if (children.every((child) => typeof child === 'string')) return `${indent}<${node.tag}${attrs}>${children.map((child) => escapeText(child as string)).join('')}</${node.tag}>`;
  return [`${indent}<${node.tag}${attrs}>`, ...children.map((child) => (typeof child === 'string' ? `${indent}  ${escapeText(child)}` : toHtml(child, depth + 1))), `${indent}</${node.tag}>`].join('\n');
}

/** HTML attribute names as React props. */
export const REACT_ATTRIBUTE_NAMES: Readonly<Record<string, string>> = {
  'aria-hidden': 'aria-hidden',
  autocomplete: 'autoComplete',
  checked: 'defaultChecked',
  colspan: 'colSpan',
  for: 'htmlFor',
  maxlength: 'maxLength',
  readonly: 'readOnly',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-width': 'strokeWidth',
  tabindex: 'tabIndex',
  value: 'defaultValue',
  viewbox: 'viewBox',
};

function jsxAttributeValue(value: UiAttrValue): string {
  if (value === true) return '';
  if (typeof value === 'number') return `={${value}}`;
  return `=${JSON.stringify(String(value))}`;
}

/** JSX with Tailwind classes generated from the same rules. */
export function toJsx(node: UiNode, context: MarkupContext, depth = 0): string {
  if (!isElement(node)) return typeof node === 'string' ? escapeJsxText(node) : '';
  const indent = '  '.repeat(depth);
  const className = tailwindClassName(node.className, context);
  const attrs = [
    className ? ` className=${JSON.stringify(className)}` : '',
    ...exportedAttributes(node).map(([name, value]) => ` ${REACT_ATTRIBUTE_NAMES[name.toLocaleLowerCase()] ?? name}${jsxAttributeValue(value)}`),
    node.style ? ` style={${JSON.stringify(node.style)}}` : '',
  ].join('');
  const children = (node.children ?? []).filter((child) => child !== null && child !== false && child !== undefined && child !== '');
  if (!children.length) return `${indent}<${node.tag}${attrs} />`;
  if (children.every((child) => typeof child === 'string')) return `${indent}<${node.tag}${attrs}>${children.map((child) => escapeJsxText(child as string)).join('')}</${node.tag}>`;
  return [`${indent}<${node.tag}${attrs}>`, ...children.map((child) => (typeof child === 'string' ? `${indent}  ${escapeJsxText(child)}` : toJsx(child, context, depth + 1))), `${indent}</${node.tag}>`].join('\n');
}

function escapeJsxText(value: string): string {
  return /[{}<>]/.test(value) ? `{${JSON.stringify(value)}}` : value;
}
