import type { BrandColor, BrandIdentity } from '@/lib/brandIdentity';
import { commentText } from '@/lib/brandOutputKit';
import { brandCssVariables, brandTailwindTheme, type BrandTokenSection } from '@/lib/brandTokens';
import {
  componentContent,
  componentPattern,
  componentRoleColors,
  resolvedComponentSettings,
  type ComponentCodeFormat,
  type ComponentLibrarySettings,
  type ComponentPatternId,
} from '@/lib/componentLibrary';
import { collectClasses, componentCss, markupContext, toHtml, toJsx } from '@/lib/componentMarkup';
import { componentTree, EMPTY_DEMO_STATE } from '@/lib/componentTemplates';
import { COLOR_MODES, SEMANTIC_COLOR_ROLES } from '@/lib/colorSystem';

/**
 * Copyable code for one component, generated from the same settings as the preview.
 * Tokens come from brandTokens.ts (semantic light/dark roles, fonts, radius); the
 * component rules come from componentMarkup.ts.
 */

export type ComponentCodeFile = {
  code: string;
  language: 'css' | 'html' | 'tsx';
  name: string;
};

const TOKEN_SECTIONS: readonly BrandTokenSection[] = ['semantic', 'type', 'radius'];

/**
 * The identity the token serializers see: the component radius, and with brand
 * defaults off, the custom palette as semantic overrides on synthetic colors.
 */
export function componentTokenIdentity(identity: BrandIdentity, settings: ComponentLibrarySettings): BrandIdentity {
  const resolved = resolvedComponentSettings(identity, settings);
  const withRadius: BrandIdentity = { ...identity, style: { ...identity.style, borderRadius: resolved.radius } };
  if (resolved.useBrandDefaults) return withRadius;
  const colors: BrandColor[] = [...identity.colors];
  const system: Record<'dark' | 'light', Record<string, string>> = { dark: {}, light: {} };
  for (const mode of COLOR_MODES) {
    const roles = componentRoleColors(identity, resolved, mode);
    for (const { id, label } of SEMANTIC_COLOR_ROLES) {
      const colorId = `component-${mode}-${id}`;
      colors.push({ hex: roles[id], id: colorId, name: `${label} (${mode})`, role: 'Component library override' });
      system[mode][id] = colorId;
    }
  }
  return { ...withRadius, colorSystem: { ...identity.colorSystem, ...system }, colors };
}

function componentName(identity: BrandIdentity, pattern: ComponentPatternId): string {
  const words = `${identity.name} ${componentPattern(pattern)?.label ?? pattern}`
    .replace(/[^A-Za-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  const name = words.map((word) => word[0]!.toLocaleUpperCase() + word.slice(1)).join('');
  return /^[A-Z]/.test(name) ? name : `Brand${name}`;
}

export function componentCode(
  identity: BrandIdentity,
  settings: ComponentLibrarySettings,
  pattern: ComponentPatternId = settings.pattern,
  format: ComponentCodeFormat = settings.codeFormat
): ComponentCodeFile[] {
  const resolved = resolvedComponentSettings(identity, settings);
  const tokenIdentity = componentTokenIdentity(identity, resolved);
  const light = componentRoleColors(identity, resolved, 'light');
  const context = markupContext(resolved, light.foreground, false);
  const tree = componentTree(pattern, {
    content: componentContent(identity),
    demo: EMPTY_DEMO_STATE,
    live: false,
    settings: { ...resolved, disabled: false },
    state: 'default',
    uid: 'gf',
  });
  const name = componentName(identity, pattern);
  if (format === 'html') {
    const css = [
      brandCssVariables(tokenIdentity, { include: TOKEN_SECTIONS }).trimEnd(),
      '',
      `/* ${commentText(componentPattern(pattern)?.label ?? pattern)} */`,
      componentCss(collectClasses(tree), context),
      '',
    ].join('\n');
    return [
      { code: `${toHtml(tree)}\n`, language: 'html', name: `${pattern}.html` },
      { code: css, language: 'css', name: 'components.css' },
    ];
  }
  const tsx = [
    `/* ${commentText(`${identity.name} — ${componentPattern(pattern)?.label ?? pattern}. Styles come from theme.css (Tailwind CSS v4).`)} */`,
    '',
    `export function ${name}() {`,
    '  return (',
    toJsx(tree, context, 2),
    '  );',
    '}',
    '',
  ].join('\n');
  return [
    { code: tsx, language: 'tsx', name: `${name}.tsx` },
    { code: brandTailwindTheme(tokenIdentity, { include: TOKEN_SECTIONS }), language: 'css', name: 'theme.css' },
  ];
}
