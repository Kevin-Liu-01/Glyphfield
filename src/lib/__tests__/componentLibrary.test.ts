import { describe, expect, it } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES, GT_BRAND_IDENTITY } from '@/lib/brandIdentity';
import { componentCode, componentTokenIdentity } from '@/lib/componentCode';
import {
  COMPONENT_FAMILY_OPTIONS,
  COMPONENT_PATTERNS,
  COMPONENT_STATES,
  componentBrandPalette,
  componentContent,
  componentMetrics,
  componentPreviewVariables,
  componentRoleColors,
  componentSource,
  defaultComponentSettings,
  getFirstComponentPattern,
  migrateLegacyComponentDrafts,
  parseComponentSource,
  parseProofStat,
} from '@/lib/componentLibrary';
import {
  collectClasses,
  componentCss,
  isElement,
  markupContext,
  tailwindClassName,
  toHtml,
  toJsx,
  type UiNode,
} from '@/lib/componentMarkup';
import { COMPONENT_TEMPLATES, componentTree, EMPTY_DEMO_STATE, type TemplateContext } from '@/lib/componentTemplates';

const settings = defaultComponentSettings(GT_BRAND_IDENTITY);

function context(state: TemplateContext['state'] = 'default', live = false): TemplateContext {
  return { content: componentContent(GT_BRAND_IDENTITY), demo: EMPTY_DEMO_STATE, live, settings, state, uid: 'test' };
}

function walk(node: UiNode, visit: (element: Exclude<UiNode, string | null | false | undefined>) => void) {
  if (!isElement(node)) return;
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

function textOf(node: UiNode): string {
  if (typeof node === 'string') return node;
  if (!isElement(node)) return '';
  return (node.children ?? []).map(textOf).join('');
}

describe('component catalog', () => {
  it('attaches every pattern to a family, a template and known states', () => {
    const families = new Set(COMPONENT_FAMILY_OPTIONS.map(({ value }) => value));
    const states = new Set(COMPONENT_STATES.map(({ id }) => id));
    expect(COMPONENT_PATTERNS).toHaveLength(36);
    expect(new Set(COMPONENT_PATTERNS.map(({ id }) => id)).size).toBe(36);
    for (const pattern of COMPONENT_PATTERNS) {
      expect(families.has(pattern.family)).toBe(true);
      expect(COMPONENT_TEMPLATES[pattern.id]).toBeTypeOf('function');
      expect(pattern.states.every((state) => states.has(state))).toBe(true);
      expect(pattern.states[0]).toBe('default');
    }
    expect(getFirstComponentPattern('forms')).toBe('inputs');
    expect(getFirstComponentPattern('content')).toBe('article-body');
  });

  it('keeps every version 1 pattern id', () => {
    const ids = new Set(COMPONENT_PATTERNS.map(({ id }) => id));
    for (const legacy of ['buttons', 'icon-buttons', 'button-groups', 'inputs', 'textareas', 'selects', 'checkboxes', 'radios', 'toggles', 'uploaders', 'navigation', 'sidebars', 'tabs', 'breadcrumbs', 'pagination', 'command-menu', 'dialogs', 'popovers', 'tooltips', 'alerts', 'toasts', 'progress', 'tables', 'stats', 'charts', 'pricing', 'checkout', 'testimonials', 'inbox', 'comments', 'article-body', 'metadata']) {
      expect(ids.has(legacy as never), legacy).toBe(true);
    }
  });
});

describe('palette and metrics', () => {
  it('derives a complete custom palette and light/dark role colors', () => {
    const palette = componentBrandPalette(GT_BRAND_IDENTITY);
    expect(Object.values(palette)).toHaveLength(10);
    expect(Object.values(palette).every((hex) => /^#[\dA-F]{6}$/.test(hex))).toBe(true);
    const custom = { ...settings, colors: { ...palette, accent: '#FF5500' }, useBrandDefaults: false };
    expect(componentRoleColors(GT_BRAND_IDENTITY, custom, 'light').primary).toBe('#FF5500');
    expect(componentRoleColors(GT_BRAND_IDENTITY, custom, 'dark').background).toBe(palette.foreground);
    expect(componentRoleColors(GT_BRAND_IDENTITY, settings, 'dark').background).toBe('#181818');
  });

  it('scales controls with density, size, text scale and radius', () => {
    const compact = componentMetrics({ ...settings, density: 'compact', size: 'sm' });
    const spacious = componentMetrics({ ...settings, density: 'spacious', size: 'lg', textScale: 120 });
    expect(compact.h).toBeLessThan(spacious.h);
    expect(spacious.text).toBeGreaterThan(compact.text);
    expect(componentMetrics({ ...settings, radius: 10 })).toMatchObject({ radius: 10, radiusLg: 15, radiusSm: 6 });
    const variables = componentPreviewVariables(GT_BRAND_IDENTITY, settings, componentRoleColors(GT_BRAND_IDENTITY, settings, 'light')) as Record<string, string>;
    expect(variables['--brand-primary']).toMatch(/^#/);
    expect(variables['--gf-h']).toBe('36px');
    expect(variables['--brand-font-body']).toContain('Inter');
  });

  it('turns proof lines into stats', () => {
    expect(parseProofStat('335+ cities')).toEqual({ label: 'cities', value: '335+' });
    expect(parseProofStat('$1.4T+ processed in 2024')).toEqual({ label: 'processed in 2024', value: '$1.4T+' });
    expect(parseProofStat('v4.0 full builds up to 5x faster').value).toBe('v4.0');
  });
});

describe('component source', () => {
  it('round-trips version 2 and migrates version 1 inverse surfaces to the dark theme', () => {
    const source = componentSource({ ...settings, label: 'Audit component' });
    expect(source).toMatchObject({ family: 'actions', label: 'Audit component', pattern: 'buttons', version: 2 });
    expect(parseComponentSource(GT_BRAND_IDENTITY, settings, JSON.stringify(source)).label).toBe('Audit component');
    const legacy = parseComponentSource(GT_BRAND_IDENTITY, settings, { family: 'forms', pattern: 'inputs', surface: 'inverse' });
    expect(legacy).toMatchObject({ pattern: 'inputs', surface: 'base', theme: 'dark' });
  });

  it('rejects unknown patterns, mismatched families and bad enums', () => {
    expect(() => parseComponentSource(GT_BRAND_IDENTITY, settings, { pattern: 'widgets' })).toThrow('Unknown component pattern');
    expect(() => parseComponentSource(GT_BRAND_IDENTITY, settings, { family: 'forms', pattern: 'buttons' })).toThrow('does not belong');
    expect(() => parseComponentSource(GT_BRAND_IDENTITY, settings, { density: 'roomy' })).toThrow('density');
    expect(() => parseComponentSource(GT_BRAND_IDENTITY, settings, { typography: { role: 'Heading' } })).toThrow('typography role');
  });

  it('migrates the version 1 per-field drafts', () => {
    const drafts: Record<string, unknown> = { 'asset-id': 'none', 'color-accent': '#123456', label: 'Ship it', pattern: 'tabs', radius: 14, surface: 'inverse', 'use-brand-defaults': false };
    const migrated = migrateLegacyComponentDrafts(GT_BRAND_IDENTITY, (field) => drafts[field]);
    expect(migrated).toMatchObject({ colors: { accent: '#123456' }, label: 'Ship it', pattern: 'tabs', radius: 14, theme: 'dark', useBrandDefaults: false });
    expect(migrateLegacyComponentDrafts(GT_BRAND_IDENTITY, () => undefined)).toBeNull();
    expect(migrateLegacyComponentDrafts(GT_BRAND_IDENTITY, (field) => (field === 'pattern' ? 'retired' : field === 'label' ? 'Kept' : undefined))?.label).toBe('Kept');
  });
});

describe('markup generation', () => {
  it('writes state CSS from one rule set, with forced states only in the preview', () => {
    const tree = componentTree('buttons', context());
    const classes = collectClasses(tree);
    const preview = componentCss(classes, markupContext(settings, '#181818', true), '[data-gf-root]');
    const exported = componentCss(classes, markupContext(settings, '#181818', false));
    expect(preview).toContain('[data-gf-root] .gf-btn-primary[data-force="hover"]');
    expect(preview).toContain('var(--gf-h)');
    expect(exported).not.toContain('data-force');
    expect(exported).toContain('.gf-btn:focus-visible');
    expect(exported).toContain('height: 36px');
    expect(exported).toContain('background-color: var(--brand-primary)');
    expect(exported).toContain('color-mix(in oklab, var(--brand-primary) 88%, transparent)');
  });

  it('converts the same rules to Tailwind utilities with state variants', () => {
    const classes = tailwindClassName('gf-btn gf-btn-primary', markupContext(settings, '#181818', false)).split(' ');
    expect(classes).toEqual(expect.arrayContaining(['inline-flex', 'h-9', 'rounded-brand', 'bg-primary', 'text-primary-foreground', 'hover:bg-primary/88', 'focus-visible:outline-focus', 'disabled:opacity-50']));
    expect(tailwindClassName('gf-checkbox', markupContext(settings, '#181818', false))).toContain('peer-checked:bg-primary');
    expect(tailwindClassName('gf-choice-input', markupContext(settings, '#181818', false))).toContain('peer');
    expect(tailwindClassName('gf-switch', markupContext(settings, '#181818', false)).split(' ')).toContain('group');
  });

  it('serializes HTML and JSX without preview hooks', () => {
    const tree = componentTree('tabs', context('default', true));
    const html = toHtml(tree);
    const jsx = toJsx(tree, markupContext(settings, '#181818', false));
    expect(html).toContain('role="tablist"');
    expect(html).not.toContain('data-action');
    expect(jsx).toContain('className="');
    expect(jsx).toContain('aria-selected="true"');
    expect(jsx).not.toContain('data-roving');
    expect(toJsx(componentTree('inputs', context()), markupContext(settings, '#181818', false))).toContain('htmlFor=');
  });

  it('renders every pattern in every state with labelled controls', () => {
    for (const pattern of COMPONENT_PATTERNS) {
      for (const state of pattern.states) {
        const tree = componentTree(pattern.id, context(state));
        const labels = new Set<string>();
        walk(tree, (element) => { if (element.tag === 'label' && typeof element.attrs?.for === 'string') labels.add(element.attrs.for); });
        walk(tree, (element) => {
          const attrs = element.attrs ?? {};
          const named = Boolean(attrs['aria-label'] || attrs['aria-labelledby'] || attrs.title);
          if (['input', 'select', 'textarea'].includes(element.tag) && attrs.type !== 'hidden') {
            expect(named || labels.has(String(attrs.id)), `${pattern.id}/${state} ${element.tag}#${String(attrs.id)}`).toBe(true);
          }
          if (element.tag === 'button') expect(named || textOf(element).trim().length > 0, `${pattern.id}/${state} button`).toBe(true);
        });
      }
    }
  });
});

describe('component code', () => {
  it('generates React + Tailwind and HTML + CSS for every pattern', () => {
    // Three identities with different palettes, fonts and radii keep this fast.
    for (const identity of BUILT_IN_BRAND_IDENTITIES.filter(({ id }) => ['gt', 'ramp', 'stripe'].includes(id))) {
      const identitySettings = defaultComponentSettings(identity);
      for (const pattern of COMPONENT_PATTERNS) {
        for (const format of ['react', 'html'] as const) {
          const files = componentCode(identity, identitySettings, pattern.id, format);
          expect(files).toHaveLength(2);
          for (const file of files) {
            expect(file.code.length, `${identity.id}/${pattern.id}/${file.name}`).toBeGreaterThan(60);
            expect(file.code).not.toMatch(/undefined|NaN|data-action|data-force/);
          }
          if (format === 'react') {
            expect(files[0]!.code).toMatch(/^\/\*[^\n]+\*\/\n\nexport function [A-Z][A-Za-z0-9]+\(\)/);
            expect(files[1]!.code).toContain('@theme inline {');
          } else {
            expect(files[0]!.code).toContain('class="gf-root');
            expect(files[1]!.code).toContain(':root {');
            expect(files[1]!.code).toContain('.gf-root {');
          }
        }
      }
    }
  }, 30_000);

  it('exports a custom palette and radius through the token serializers', () => {
    const custom = { ...settings, colors: { ...settings.colors, accent: '#FF5500' }, radius: 3, useBrandDefaults: false };
    const tokenIdentity = componentTokenIdentity(GT_BRAND_IDENTITY, custom);
    expect(tokenIdentity.style.borderRadius).toBe(3);
    const [, theme] = componentCode(GT_BRAND_IDENTITY, custom, 'buttons', 'react');
    expect(theme!.code).toContain('--brand-primary: #FF5500;');
    expect(theme!.code).toContain('--radius-brand: 3px;');
  });
});
