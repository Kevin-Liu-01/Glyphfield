import {
  BUILT_IN_BRAND_IDENTITIES,
  brandAssetPath,
  brandFontAssets,
  brandTypographyRole,
  type BrandIdentity,
} from './brandIdentity';
import type { CanvasAsset, CanvasDocument, CanvasElement, CanvasJsonValue } from './canvasDocument';
import { layoutCanvasText } from './canvasText';
import { colorContrastRatio } from './color';
import { escapeXml } from './download';
import type { ExpressionDeviceId } from './expressionDevices';
import { estimateTextWidth } from './expressionSvg';
import {
  createExpressionShell,
  dataString,
  defaultExpressionFormat,
  elementSlot,
  expressionAsset,
  expressionFormats,
  expressionState,
  insertPage,
  newExpressionElement,
  pageElements,
  pageSettings,
  pruneAssets,
  readCodeTabs,
  readStringArray,
  resolveExpressionColor,
  resolveExpressionFormat,
  roundBounds,
  scaleBoundsToFormat,
  touchDocument,
  uniqueElementId,
  uniquePageId,
  withAssets,
  withExpressionState,
  type CodeTab,
  type ExpressionColor,
  type ExpressionFontRole,
  type ExpressionFormat,
  type ExpressionPageSettings,
  type ExpressionToolKind,
  type LockupPartner,
} from './expressionModel';
import { capVisibleFontWeight } from './typography';

// ---------------------------------------------------------------------------
// Brand recipes: the identity's own device, surfaces, type roles and copy.

type KickerStyle = { casing: 'none' | 'uppercase'; role: ExpressionFontRole; tracking: number };

export type ExpressionRecipe = {
  /** Background generator palette as color roles: deep field, signal, highlight. */
  backgroundRoles: readonly [string, string, string];
  codeTheme: 'brand-dark' | 'brand-light';
  device: ExpressionDeviceId;
  headlineRole: ExpressionFontRole;
  headlineCasing: 'none' | 'uppercase';
  kicker: KickerStyle;
  layouts: Record<Exclude<ExpressionToolKind, 'slides'>, string>;
  /** Library image that carries the brand better than a generated device. */
  media: string | null;
  rules: boolean;
  surfaces: Record<ExpressionToolKind, ExpressionColor>;
};

const MONO_KICKER: KickerStyle = { casing: 'uppercase', role: 'Code', tracking: 0.08 };
const QUIET_KICKER: KickerStyle = { casing: 'none', role: 'Body', tracking: 0 };

const RECIPES: Record<string, ExpressionRecipe> = {
  basement: {
    backgroundRoles: ['ink', 'progress', 'emphasis'],
    codeTheme: 'brand-dark',
    device: 'interruption',
    headlineCasing: 'uppercase',
    headlineRole: 'Display',
    kicker: MONO_KICKER,
    layouts: { blog: 'statement', opengraph: 'statement', partnership: 'announcement', terminal: 'split' },
    media: null,
    rules: true,
    surfaces: { blog: 'ink', opengraph: 'ink', partnership: 'ink', slides: 'ink', terminal: 'ink' },
  },
  cloudflare: {
    backgroundRoles: ['error', 'emphasis', 'success'],
    codeTheme: 'brand-dark',
    device: 'horizon',
    headlineCasing: 'none',
    headlineRole: 'Display',
    kicker: MONO_KICKER,
    layouts: { blog: 'feature', opengraph: 'split', partnership: 'lockup', terminal: 'split' },
    media: null,
    rules: true,
    surfaces: { blog: 'paper', opengraph: 'paper', partnership: 'paper', slides: 'paper', terminal: 'paper' },
  },
  gt: {
    backgroundRoles: ['ink', 'progress', 'emphasis'],
    codeTheme: 'brand-dark',
    device: 'greetings',
    headlineCasing: 'none',
    headlineRole: 'Display',
    kicker: QUIET_KICKER,
    layouts: { blog: 'editorial', opengraph: 'split', partnership: 'lockup', terminal: 'card' },
    media: null,
    rules: false,
    surfaces: { blog: 'paper', opengraph: 'ink', partnership: 'paper', slides: 'paper', terminal: 'ink' },
  },
  mintlify: {
    backgroundRoles: ['error', 'emphasis', 'success'],
    codeTheme: 'brand-dark',
    device: 'beam',
    headlineCasing: 'none',
    headlineRole: 'Display',
    kicker: MONO_KICKER,
    layouts: { blog: 'feature', opengraph: 'split', partnership: 'centered', terminal: 'split' },
    media: null,
    rules: false,
    surfaces: { blog: 'paper', opengraph: 'error', partnership: 'paper', slides: 'paper', terminal: 'error' },
  },
  ramp: {
    backgroundRoles: ['error', 'progress', 'emphasis'],
    codeTheme: 'brand-dark',
    device: 'ledger',
    headlineCasing: 'none',
    headlineRole: 'Display',
    kicker: QUIET_KICKER,
    layouts: { blog: 'feature', opengraph: 'split', partnership: 'announcement', terminal: 'split' },
    media: 'library-campaign',
    rules: true,
    surfaces: { blog: 'paper', opengraph: 'paper', partnership: 'paper', slides: 'paper', terminal: 'paper' },
  },
  starter: {
    backgroundRoles: ['ink', 'emphasis', 'success'],
    codeTheme: 'brand-light',
    device: 'window',
    headlineCasing: 'none',
    headlineRole: 'Accent',
    kicker: MONO_KICKER,
    layouts: { blog: 'editorial', opengraph: 'split', partnership: 'lockup', terminal: 'card' },
    media: null,
    rules: true,
    surfaces: { blog: 'paper', opengraph: 'paper', partnership: 'paper', slides: 'paper', terminal: 'muted' },
  },
  stripe: {
    backgroundRoles: ['error', 'emphasis', 'success'],
    codeTheme: 'brand-dark',
    device: 'field',
    headlineCasing: 'none',
    headlineRole: 'Display',
    kicker: QUIET_KICKER,
    layouts: { blog: 'feature', opengraph: 'split', partnership: 'centered', terminal: 'split' },
    media: null,
    rules: false,
    surfaces: { blog: 'paper', opengraph: 'paper', partnership: 'paper', slides: 'paper', terminal: 'muted' },
  },
  tailwind: {
    backgroundRoles: ['error', 'ink', 'emphasis'],
    codeTheme: 'brand-dark',
    device: 'waves',
    headlineCasing: 'none',
    headlineRole: 'Display',
    kicker: MONO_KICKER,
    layouts: { blog: 'feature', opengraph: 'split', partnership: 'lockup', terminal: 'split' },
    media: null,
    rules: false,
    surfaces: { blog: 'ink', opengraph: 'ink', partnership: 'paper', slides: 'ink', terminal: 'error' },
  },
  viteplus: {
    backgroundRoles: ['ink', 'emphasis', 'success'],
    codeTheme: 'brand-dark',
    device: 'convergence',
    headlineCasing: 'none',
    headlineRole: 'Display',
    kicker: MONO_KICKER,
    layouts: { blog: 'feature', opengraph: 'split', partnership: 'centered', terminal: 'card' },
    media: null,
    rules: true,
    surfaces: { blog: 'paper', opengraph: 'paper', partnership: 'paper', slides: 'paper', terminal: 'ink' },
  },
};

const RECIPE_BY_PREVIEW: Record<BrandIdentity['artDirection']['preview'], string> = {
  'economic-ledger': 'ramp',
  'editorial-interruption': 'basement',
  'focus-window': 'starter',
  'knowledge-beam': 'mintlify',
  'network-horizon': 'cloudflare',
  'programmable-field': 'stripe',
  'translation-frame': 'gt',
  'unified-terminal': 'viteplus',
  'utility-wave': 'tailwind',
};

const BACKGROUND_PATTERNS: Readonly<Record<BrandIdentity['graphicSystem']['pattern'], 'crosshatch' | 'dots' | 'fibers' | 'grid' | 'lines' | 'topographic'>> = {
  blocks: 'grid', brackets: 'crosshatch', burst: 'lines', circuit: 'grid', flow: 'fibers', grid: 'grid', none: 'dots', orbit: 'dots', rays: 'lines', steps: 'lines', wave: 'topographic',
};

export function brandBackgroundPalette(identity: BrandIdentity): [string, string, string] {
  const colors = expressionColors(identity);
  const [a, b, c] = expressionRecipe(identity).backgroundRoles;
  return [
    resolveExpressionColor(a, colors, colors.ink!),
    resolveExpressionColor(b, colors, colors.ink!),
    resolveExpressionColor(c, colors, colors.paper!),
  ];
}

export function brandBackgroundPattern(identity: BrandIdentity) {
  return BACKGROUND_PATTERNS[identity.graphicSystem.pattern] ?? 'dots';
}

/**
 * Pattern backgrounds that read: the brand pattern drawn in whichever brand
 * colour stands out most from the deep field, at a spacing and weight scaled
 * to the canvas (about fourteen repeats across the short side).
 */
export function brandPatternSettings(identity: BrandIdentity, width: number, height: number) {
  const [deep, signal, highlight] = brandBackgroundPalette(identity);
  const stroke = colorContrastRatio(highlight, deep) >= colorContrastRatio(signal, deep) ? highlight : signal;
  return {
    colorB: stroke,
    pattern: brandBackgroundPattern(identity),
    patternOpacity: 56,
    spacing: Math.max(16, Math.round(Math.min(width, height) / 14)),
  };
}

export function expressionRecipe(identity: BrandIdentity): ExpressionRecipe {
  return RECIPES[identity.id] ?? RECIPES[RECIPE_BY_PREVIEW[identity.artDirection.preview]] ?? RECIPES.starter!;
}

const HEADLINES: Readonly<Record<string, string>> = {
  basement: 'Cool work that performs.',
  cloudflare: 'A better Internet, built everywhere.',
  gt: 'Every language. One source.',
  mintlify: 'Documentation that works for everyone.',
  ramp: 'Save time. Save money.',
  starter: 'Make the signal visible.',
  stripe: 'Build the internet economy.',
  tailwind: 'Build anything. Directly in your markup.',
  viteplus: 'One toolchain for the web.',
};

type CodeSample = { title: string; tabs: Omit<CodeTab, 'id'>[] };

const CODE_SAMPLES: Readonly<Record<string, CodeSample>> = {
  basement: {
    title: 'Treat code and performance as craft.',
    tabs: [{ code: "export default function Page() {\n  return (\n    <main className='grid min-h-svh place-items-center'>\n      <h1>Cool work that performs.</h1>\n    </main>\n  );\n}", highlight: [4], language: 'tsx', name: 'page.tsx' }],
  },
  cloudflare: {
    title: 'Run everywhere.',
    tabs: [
      { code: "export default {\n  async fetch(request, env, ctx): Promise<Response> {\n    const url = new URL(request.url);\n    return new Response(`Hello from ${url.hostname}`);\n  },\n} satisfies ExportedHandler<Env>;", highlight: [2], language: 'typescript', name: 'worker.ts' },
      { code: '$ npx wrangler deploy\n✓ Uploaded worker\n✓ Deployed to 335+ cities', highlight: [], language: 'bash', name: 'Terminal' },
    ],
  },
  gt: {
    title: 'Code is the source of truth.',
    tabs: [
      { code: "import { tx } from 'gt-next';\n\nexport function Greeting() {\n  return <h1>{tx('Hello, world')}</h1>;\n}", highlight: [4], language: 'typescript', name: 'greeting.tsx' },
      { code: '$ gt translate --locales es,ja,ar\n✓ 42 strings translated\n✓ 3 locale files written', highlight: [], language: 'bash', name: 'Terminal' },
    ],
  },
  mintlify: {
    title: 'Developers are users too.',
    tabs: [
      { code: '{\n  "$schema": "https://mintlify.com/docs.json",\n  "theme": "mint",\n  "name": "Acme",\n  "colors": { "primary": "#0D9373" },\n  "navigation": {\n    "groups": [{ "group": "Get started", "pages": ["index", "quickstart"] }]\n  }\n}', highlight: [5], language: 'json', name: 'docs.json' },
      { code: '$ npm i -g mint\n$ mint dev\n✓ Preview ready on http://localhost:3000', highlight: [], language: 'bash', name: 'Terminal' },
    ],
  },
  ramp: {
    title: 'Automate the manual.',
    tabs: [{ code: '$ curl https://api.ramp.com/developer/v1/transactions \\\n    -H "Authorization: Bearer $RAMP_API_TOKEN" \\\n    -G -d "page_size=25"', highlight: [1], language: 'bash', name: 'Terminal' }],
  },
  starter: {
    title: 'What did we learn?',
    tabs: [{ code: 'type Decision = {\n  question: string;\n  evidence: string[];\n  owner: string;\n  next: string;\n};', highlight: [3], language: 'typescript', name: 'decision.ts' }],
  },
  stripe: {
    title: 'Build new business models.',
    tabs: [
      { code: "import Stripe from 'stripe';\n\nconst stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);\n\nconst paymentIntent = await stripe.paymentIntents.create({\n  amount: 2000,\n  currency: 'usd',\n  automatic_payment_methods: { enabled: true },\n});", highlight: [5], language: 'typescript', name: 'server.ts' },
      { code: '$ stripe listen --forward-to localhost:4242/webhook\n✓ Ready! Your webhook signing secret is whsec_…', highlight: [], language: 'bash', name: 'Terminal' },
    ],
  },
  tailwind: {
    title: 'Style directly in your markup.',
    tabs: [{ code: '<div class="flex items-center gap-4 rounded-xl bg-white p-6 shadow-lg">\n  <img class="size-12 rounded-full" src="/avatar.png" alt="" />\n  <div>\n    <p class="text-sm font-medium text-slate-900">Utility-first</p>\n    <p class="text-sm text-slate-500">Compose in markup.</p>\n  </div>\n</div>', highlight: [1], language: 'html', name: 'card.html' }],
  },
  viteplus: {
    title: 'One toolchain.',
    tabs: [
      { code: "import { defineConfig } from 'vite';\n\nexport default defineConfig({\n  build: { target: 'esnext' },\n  server: { port: 5173 },\n});", highlight: [3], language: 'typescript', name: 'vite.config.ts' },
      { code: '$ vite dev\n  VITE ready in 212 ms\n  ➜  Local:   http://localhost:5173/', highlight: [], language: 'bash', name: 'Terminal' },
    ],
  },
};

function codeSample(identity: BrandIdentity): CodeSample {
  return CODE_SAMPLES[identity.id] ?? {
    title: identity.voice.phrases[0] ?? identity.tagline,
    tabs: [{ code: CODE_SAMPLES.gt!.tabs[0]!.code, highlight: [4], language: 'typescript', name: 'index.tsx' }],
  };
}

/** The legacy single-language samples, kept so the language switch still loads them. */
export const LEGACY_CODE_SAMPLES: Readonly<Record<'bash' | 'python' | 'typescript', string>> = {
  bash: '$ gt translate --locales es,ja,ar\n✓ 42 strings translated\n✓ 3 locale files written',
  python: 'from gt import translate\n\nresult = translate(\n    "Hello, world",\n    locales=["es", "ja", "ar"],\n)',
  typescript: "import { tx } from 'gt-next';\n\nexport function Greeting() {\n  return <h1>{tx('Hello, world')}</h1>;\n}",
};

// ---------------------------------------------------------------------------
// Brand resources

export function expressionColors(identity: BrandIdentity): Record<string, string> {
  const colors: Record<string, string> = { ink: '#18181B', paper: '#FFFFFF' };
  for (const color of identity.colors) colors[color.id] = color.hex.toUpperCase();
  return colors;
}

export function foregroundRole(identity: BrandIdentity, surface: ExpressionColor): 'ink' | 'paper' {
  const colors = expressionColors(identity);
  const background = resolveExpressionColor(surface, colors, colors.paper!);
  return colorContrastRatio(background, colors.ink!) >= colorContrastRatio(background, colors.paper!) ? 'ink' : 'paper';
}

export function isDarkSurface(identity: BrandIdentity, surface: ExpressionColor): boolean {
  return foregroundRole(identity, surface) === 'paper';
}

export type ExpressionFontResource = { asset: CanvasAsset; family: string; weight: number };

export function expressionFont(identity: BrandIdentity, role: ExpressionFontRole): ExpressionFontResource {
  const typography = brandTypographyRole(identity, role);
  const fonts = brandFontAssets(identity);
  const font = fonts.find(({ id }) => id === typography.fontId) ?? fonts.find(({ style }) => style === 'normal') ?? fonts[0]!;
  return {
    asset: expressionAsset(`font:${font.id}`, font.label, font.path, 'font'),
    family: font.family,
    weight: capVisibleFontWeight(typography.weight ?? font.weight),
  };
}

export function monogramSource(identity: BrandIdentity, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><text x="256" y="310" text-anchor="middle" fill="${color}" font-family="Switzer, Arial, sans-serif" font-size="180" font-weight="550">${escapeXml(identity.shortName)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function brandLogoAsset(identity: BrandIdentity, variant: 'mark' | 'wordmark', dark: boolean): { asset: CanvasAsset; libraryId: string | null } {
  const order = variant === 'wordmark'
    ? [dark ? 'wordmark-light' : 'wordmark', dark ? 'mark-light' : 'mark-dark']
    : [dark ? 'mark-light' : 'mark-dark', dark ? 'wordmark-light' : 'wordmark'];
  for (const id of order) {
    const path = brandAssetPath(identity, id);
    if (path) return { asset: expressionAsset(`logo:${id}`, `${identity.name} ${id}`, path), libraryId: id };
  }
  const colors = expressionColors(identity);
  return {
    asset: expressionAsset('logo:monogram', `${identity.name} monogram`, monogramSource(identity, dark ? colors.paper! : colors.ink!)),
    libraryId: null,
  };
}

function libraryImageAsset(identity: BrandIdentity, libraryId: string): CanvasAsset | null {
  const asset = [...identity.assets, ...identity.proofAssets].find(({ id }) => id === libraryId);
  return asset ? expressionAsset(`image:${asset.id}`, asset.label, asset.path) : null;
}

const KNOWN_ASPECTS: Readonly<Record<string, number>> = {
  'mark-dark': 1,
  'mark-light': 1,
  wordmark: 3.2,
  'wordmark-light': 3.2,
};

export function partnerAspectGuess(libraryId: string | null | undefined): number {
  return (libraryId && KNOWN_ASPECTS[libraryId]) || 2.6;
}

/** Partner choices: the identity's proof assets, then every other built-in identity. */
export function expressionPartnerOptions(identity: BrandIdentity): { id: string; label: string; path: string; aspect: number }[] {
  const proof = identity.proofAssets.map((asset) => ({ aspect: 2.8, id: asset.id, label: asset.label, path: asset.path }));
  const identities = BUILT_IN_BRAND_IDENTITIES
    .filter(({ id }) => id !== identity.id && !proof.some((option) => option.id === id))
    .flatMap((other) => {
      const path = brandAssetPath(other, 'wordmark') ?? brandAssetPath(other, 'mark-dark');
      return path ? [{ aspect: brandAssetPath(other, 'wordmark') ? 3.2 : 1, id: other.id, label: other.name, path }] : [];
    });
  return [...proof, ...identities, { aspect: 2.6, id: 'template-northstar', label: 'Northstar', path: '/templates/logos/northstar.svg' }];
}

/** The identity's own proof partner (Ramp first when listed), or null for an honest placeholder. */
export function defaultPartnerOption(identity: BrandIdentity) {
  const options = expressionPartnerOptions(identity).filter(({ id }) => identity.proofAssets.some((asset) => asset.id === id));
  return options.find(({ id }) => id === 'ramp') ?? options[0] ?? null;
}

export const PARTNER_PLACEHOLDER = 'Partner';

// ---------------------------------------------------------------------------
// Layout specifications

type Box = { height: number; width: number; x: number; y: number };

type BaseSpec = { box: Box; name: string; opacity?: number; slot: string };

type TextSpec = BaseSpec & {
  align?: 'center' | 'left' | 'right';
  casing?: 'none' | 'uppercase';
  content: string;
  fill?: ExpressionColor;
  fit?: boolean;
  kind: 'text';
  lineHeight?: number;
  maxLines?: number;
  role: ExpressionFontRole;
  size: number;
  tabular?: boolean;
  tracking?: number;
  valign?: 'bottom' | 'middle' | 'top';
  weight?: number;
};

type LogoSpec = BaseSpec & { align?: 'center' | 'end' | 'start'; kind: 'logo'; variant: 'mark' | 'wordmark' };
type ImageSpec = BaseSpec & { kind: 'image'; libraryId: string; radius?: number; treatment?: string };
type ShapeSpec = BaseSpec & { fill: ExpressionColor; kind: 'shape'; radius?: number; shape: 'ellipse' | 'line' | 'rect'; strokeWidth?: number };
type TextureSpec = BaseSpec & { fill: ExpressionColor; kind: 'texture'; spacing: number; texture: 'diagonal' | 'dots' | 'grid' | 'lines' | 'noise' };
type DeviceSpec = BaseSpec & { device: ExpressionDeviceId; kind: 'device' };
type CodeSpec = BaseSpec & { chrome: 'none' | 'tabs' | 'window'; kind: 'code'; radius: number; size: number };
type LockupSpec = BaseSpec & { justify: 'center' | 'end' | 'start'; kind: 'lockup'; verticalAlign: 'center' | 'top' | 'bottom' };
type ChartSpec = BaseSpec & { kind: 'chart'; labels: string[]; values: number[] };

export type SlotSpec = ChartSpec | CodeSpec | DeviceSpec | ImageSpec | LockupSpec | LogoSpec | ShapeSpec | TextSpec | TextureSpec;

type LayoutContext = {
  /** Emphasis when it reads as text on this surface, otherwise the foreground. */
  accent: ExpressionColor;
  /** Longest code tab in lines, so code windows can hug their content. */
  codeLines: number;
  dark: boolean;
  fg: 'ink' | 'paper';
  height: number;
  identity: BrandIdentity;
  kind: ExpressionToolKind;
  /** Margin on an 8px rhythm. */
  m: number;
  recipe: ExpressionRecipe;
  /** Size multiplier against the 1200 × 630 reference. */
  s: number;
  surface: ExpressionColor;
  text: (slot: string, fallback: string) => string;
  width: number;
};

type Layout = { id: string; label: string; specs: (context: LayoutContext) => SlotSpec[] };

const snap = (value: number) => Math.round(value / 8) * 8;
const px = (value: number) => Math.round(value);

function background(context: LayoutContext): ShapeSpec {
  return { box: { height: context.height, width: context.width, x: 0, y: 0 }, fill: context.surface, kind: 'shape', name: 'Background', shape: 'rect', slot: 'background' };
}

function defaultHeadline(context: LayoutContext): string {
  if (context.kind === 'opengraph') return HEADLINES[context.identity.id] ?? context.identity.tagline;
  if (context.kind === 'blog') return context.identity.voice.phrases[0] ?? context.identity.tagline;
  return context.identity.tagline;
}

function headline(context: LayoutContext, box: Box, size: number, extra: Partial<TextSpec> = {}): TextSpec {
  return {
    box,
    casing: context.recipe.headlineCasing,
    content: context.text('headline', defaultHeadline(context)),
    fill: context.fg,
    fit: true,
    kind: 'text',
    maxLines: 3,
    name: 'Headline',
    role: context.recipe.headlineRole,
    size: px(size * (context.recipe.headlineCasing === 'uppercase' ? 0.86 : 1)),
    slot: 'headline',
    valign: 'bottom',
    ...extra,
  };
}

function dek(context: LayoutContext, box: Box, size: number, extra: Partial<TextSpec> = {}): TextSpec {
  return {
    box,
    content: context.text('dek', context.identity.strategy.promise),
    fill: context.fg,
    fit: true,
    kind: 'text',
    maxLines: 3,
    name: 'Supporting copy',
    opacity: 0.72,
    role: 'Body',
    size: px(size),
    slot: 'dek',
    ...extra,
  };
}

function kicker(context: LayoutContext, box: Box, content: string, extra: Partial<TextSpec> = {}): TextSpec {
  const style = context.recipe.kicker;
  return {
    box,
    casing: style.casing,
    content: context.text('kicker', content),
    fill: context.fg,
    kind: 'text',
    maxLines: 1,
    name: 'Kicker',
    opacity: 0.7,
    role: style.role,
    size: px(Math.max(13, 14 * context.s)),
    slot: 'kicker',
    tracking: style.tracking,
    ...extra,
  };
}

function meta(context: LayoutContext, slot: string, name: string, box: Box, content: string, extra: Partial<TextSpec> = {}): TextSpec {
  return {
    box,
    content: context.text(slot, content),
    fill: context.fg,
    kind: 'text',
    maxLines: 1,
    name,
    opacity: 0.62,
    role: 'Body',
    size: px(Math.max(13, 15 * context.s)),
    slot,
    ...extra,
  };
}

function logo(context: LayoutContext, box: Box, variant: 'mark' | 'wordmark' = 'mark', align: LogoSpec['align'] = 'start'): LogoSpec {
  return { align, box, kind: 'logo', name: 'Brand logo', slot: 'logo', variant };
}

function rule(context: LayoutContext, slot: string, box: Box, opacity = 0.2): ShapeSpec {
  return { box, fill: context.fg, kind: 'shape', name: 'Divider', opacity, shape: 'line', slot, strokeWidth: 1 };
}

function proofText(context: LayoutContext): string {
  return context.identity.id === 'gt' ? context.identity.website : context.identity.proof[0] ?? context.identity.products[0] ?? '';
}

function proofChip(context: LayoutContext, x: number, y: number): SlotSpec[] {
  const proof = proofText(context);
  if (!proof) return [];
  const size = px(Math.max(13, 14 * context.s));
  const height = px(size * 2.8);
  const width = px(Math.min(context.width * 0.4, Math.max(160, proof.length * size * 0.62 + size * 2.6)));
  const emphasis = resolveExpressionColor('emphasis', expressionColors(context.identity), '#000000');
  const surface = resolveExpressionColor(context.surface, expressionColors(context.identity), '#FFFFFF');
  // A chip is its own field, so only an emphasis identical to the page falls back.
  const chipFill = colorContrastRatio(emphasis, surface) < 1.02 ? context.fg : 'emphasis';
  const chipText = foregroundRole(context.identity, chipFill);
  return [
    { box: { height, width, x, y }, fill: chipFill, kind: 'shape', name: 'Proof chip', radius: Math.min(context.identity.style.borderRadius, 6), shape: 'rect', slot: 'proof-chip' },
    { box: { height, width: width - size * 2, x: x + size, y }, content: context.text('proof', proof), fill: chipText, kind: 'text', maxLines: 1, name: 'Proof', role: 'Body', size, slot: 'proof', valign: 'middle', weight: 500 },
  ];
}

function media(context: LayoutContext, box: Box): SlotSpec {
  const libraryId = context.recipe.media;
  if (libraryId && [...context.identity.assets, ...context.identity.proofAssets].some(({ id }) => id === libraryId)) {
    return { box, kind: 'image', libraryId, name: 'Supporting image', slot: 'media', treatment: context.identity.style.imageTreatment };
  }
  return { box, device: context.recipe.device, kind: 'device', name: context.recipe.device === 'greetings' ? 'Language field' : 'Brand device', slot: 'media' };
}

function mediaForeground(context: LayoutContext): 'ink' | 'paper' {
  if (context.recipe.media) return 'paper';
  return context.recipe.device === 'window' || context.recipe.device === 'ledger' ? 'ink' : 'paper';
}

function landscape(context: LayoutContext) {
  return context.width / context.height >= 1.2;
}

// OpenGraph and social -------------------------------------------------------

const OPENGRAPH_LAYOUTS: Layout[] = [
  {
    id: 'split',
    label: 'Split',
    specs: (c) => {
      if (!landscape(c)) {
        const mediaHeight = snap(c.height * 0.46);
        const top = mediaHeight + c.m;
        return [
          background(c),
          media(c, { height: mediaHeight, width: c.width, x: 0, y: 0 }),
          logo(c, { height: px(48 * c.s), width: px(160 * c.s), x: c.m, y: top }),
          headline(c, { height: snap(c.height * 0.22), width: c.width - c.m * 2, x: c.m, y: top + px(80 * c.s) }, 72 * c.s),
          dek(c, { height: px(96 * c.s), width: c.width - c.m * 2, x: c.m, y: top + px(80 * c.s) + snap(c.height * 0.22) + px(24 * c.s) }, 22 * c.s),
          ...proofChip(c, c.m, c.height - c.m - px(40 * c.s)),
        ];
      }
      const split = snap(c.width * 0.515);
      const column = split - c.m * 2;
      return [
        background(c),
        media(c, { height: c.height, width: c.width - split, x: split, y: 0 }),
        logo(c, { height: px(52 * c.s), width: px(52 * c.s), x: c.m, y: px(64 * c.s) }),
        headline(c, { height: px(c.height * 0.36), width: column, x: c.m, y: px(c.height * 0.2) }, 56 * c.s, { maxLines: 3 }),
        dek(c, { height: px(64 * c.s), width: Math.min(column, px(440 * c.s)), x: c.m, y: px(c.height * 0.6) }, 16 * c.s, { maxLines: 3 }),
        ...proofChip(c, c.m, c.height - px(64 * c.s) - px(38 * c.s)),
        // The proof chip already carries the address when it is the website.
        ...(proofText(c) === c.identity.website ? [] : [meta(c, 'website', 'Website', { height: px(24 * c.s), width: px(320 * c.s), x: c.width - c.m - px(320 * c.s), y: c.height - px(64 * c.s) - px(24 * c.s) }, c.identity.website, { align: 'right', fill: mediaForeground(c), opacity: 0.84 })]),
      ];
    },
  },
  {
    id: 'statement',
    label: 'Statement',
    specs: (c) => [
      background(c),
      logo(c, { height: px(48 * c.s), width: px(180 * c.s), x: c.m, y: c.m }, 'wordmark'),
      headline(c, { height: c.height - c.m * 2 - px(160 * c.s), width: c.width - c.m * 2, x: c.m, y: c.m + px(80 * c.s) }, (landscape(c) ? 104 : 128) * c.s, { maxLines: 4, valign: 'middle' }),
      rule(c, 'rule', { height: 2, width: c.width - c.m * 2, x: c.m, y: c.height - c.m - px(40 * c.s) }),
      meta(c, 'website', 'Website', { height: px(28 * c.s), width: px(400 * c.s), x: c.m, y: c.height - c.m - px(28 * c.s) }, c.identity.website),
      meta(c, 'proof', 'Proof', { height: px(28 * c.s), width: px(460 * c.s), x: c.width - c.m - px(460 * c.s), y: c.height - c.m - px(28 * c.s) }, c.identity.proof[0] ?? c.identity.tagline, { align: 'right', tabular: true }),
    ],
  },
  {
    id: 'media',
    label: 'Full bleed',
    specs: (c) => [
      background(c),
      media(c, { height: c.height, width: c.width, x: 0, y: 0 }),
      { box: { height: px(c.height * 0.58), width: c.width, x: 0, y: px(c.height * 0.42) }, fill: '#000000', kind: 'shape', name: 'Scrim', opacity: 0.42, shape: 'rect', slot: 'scrim' },
      logo(c, { height: px(48 * c.s), width: px(48 * c.s), x: c.m, y: c.m }),
      headline(c, { height: px(c.height * 0.3), width: Math.min(c.width - c.m * 2, px(900 * c.s)), x: c.m, y: c.height - c.m - px(c.height * 0.3) - px(44 * c.s) }, 64 * c.s, { fill: 'paper' }),
      meta(c, 'website', 'Website', { height: px(24 * c.s), width: px(360 * c.s), x: c.m, y: c.height - c.m - px(20 * c.s) }, c.identity.website, { fill: 'paper', opacity: 0.8 }),
    ],
  },
  {
    id: 'centered',
    label: 'Centered',
    specs: (c) => [
      background(c),
      logo(c, { height: px(56 * c.s), width: px(240 * c.s), x: (c.width - px(240 * c.s)) / 2, y: c.m }, 'wordmark', 'center'),
      headline(c, { height: px(c.height * 0.4), width: c.width - c.m * 3, x: c.m * 1.5, y: px(c.height * 0.27) }, 68 * c.s, { align: 'center', valign: 'middle' }),
      dek(c, { height: px(60 * c.s), width: Math.min(c.width - c.m * 4, px(640 * c.s)), x: (c.width - Math.min(c.width - c.m * 4, px(640 * c.s))) / 2, y: px(c.height * 0.69) }, 18 * c.s, { align: 'center', maxLines: 2 }),
      meta(c, 'website', 'Website', { height: px(24 * c.s), width: px(400 * c.s), x: (c.width - px(400 * c.s)) / 2, y: c.height - c.m - px(24 * c.s) }, c.identity.website, { align: 'center' }),
    ],
  },
  {
    id: 'editorial',
    label: 'Editorial',
    specs: (c) => [
      background(c),
      kicker(c, { height: px(24 * c.s), width: px(520 * c.s), x: c.m, y: c.m }, c.identity.products[0] ?? c.identity.name),
      headline(c, { height: px(c.height * 0.46), width: c.width - c.m * 2, x: c.m, y: c.m + px(48 * c.s) }, 84 * c.s, { maxLines: 3, valign: 'top' }),
      rule(c, 'rule', { height: 2, width: c.width - c.m * 2, x: c.m, y: c.height - c.m - px(64 * c.s) }),
      logo(c, { height: px(40 * c.s), width: px(160 * c.s), x: c.m, y: c.height - c.m - px(40 * c.s) }, 'wordmark'),
      meta(c, 'website', 'Website', { height: px(28 * c.s), width: px(400 * c.s), x: c.width - c.m - px(400 * c.s), y: c.height - c.m - px(34 * c.s) }, c.identity.website, { align: 'right' }),
    ],
  },
];

// Blog -------------------------------------------------------------------------

const BLOG_LAYOUTS: Layout[] = [
  {
    id: 'editorial',
    label: 'Editorial',
    specs: (c) => [
      background(c),
      logo(c, { height: px(56 * c.s), width: px(56 * c.s), x: c.m, y: px(64 * c.s) }),
      meta(c, 'brand-name', 'Brand name', { height: px(28 * c.s), width: px(420 * c.s), x: c.m + px(74 * c.s), y: px(78 * c.s) }, c.identity.name, { opacity: 1, size: px(19 * c.s), weight: 500 }),
      // Editorial covers anchor the headline to the foot of the page, above the byline.
      headline(c, { height: c.height - px(c.height * 0.27) - px(148 * c.s), width: px((c.width - c.m * 2) * 0.86), x: c.m, y: px(c.height * 0.27) }, 72 * c.s, { valign: 'bottom' }),
      meta(c, 'website', 'Footer', { height: px(24 * c.s), width: px(420 * c.s), x: c.m, y: c.height - px(80 * c.s) }, c.identity.website),
    ],
  },
  {
    id: 'feature',
    label: 'Feature image',
    specs: (c) => {
      if (!landscape(c)) {
        const mediaHeight = snap(c.height * 0.5);
        return [
          background(c),
          media(c, { height: mediaHeight, width: c.width, x: 0, y: 0 }),
          kicker(c, { height: px(24 * c.s), width: c.width - c.m * 2, x: c.m, y: mediaHeight + c.m }, c.identity.products[0] ?? 'Journal'),
          headline(c, { height: px(c.height * 0.24), width: c.width - c.m * 2, x: c.m, y: mediaHeight + c.m + px(40 * c.s) }, 76 * c.s, { valign: 'top' }),
          logo(c, { height: px(40 * c.s), width: px(160 * c.s), x: c.m, y: c.height - c.m - px(40 * c.s) }, 'wordmark'),
        ];
      }
      const split = snap(c.width * 0.56);
      return [
        background(c),
        media(c, { height: c.height, width: c.width - split, x: split, y: 0 }),
        kicker(c, { height: px(24 * c.s), width: split - c.m * 2, x: c.m, y: c.m }, c.identity.products[0] ?? 'Journal'),
        headline(c, { height: px(c.height * 0.48), width: split - c.m * 2, x: c.m, y: c.m + px(52 * c.s) }, 60 * c.s, { maxLines: 4, valign: 'top' }),
        logo(c, { height: px(36 * c.s), width: px(150 * c.s), x: c.m, y: c.height - c.m - px(36 * c.s) }, 'wordmark'),
      ];
    },
  },
  {
    id: 'statement',
    label: 'Statement',
    specs: (c) => [
      background(c),
      kicker(c, { height: px(24 * c.s), width: px(500 * c.s), x: c.m, y: c.m }, c.identity.products[0] ?? 'Journal'),
      headline(c, { height: c.height - c.m * 2 - px(140 * c.s), width: c.width - c.m * 2, x: c.m, y: c.m + px(56 * c.s) }, 96 * c.s, { maxLines: 4, valign: 'middle' }),
      { box: { height: px(10 * c.s), width: px(c.width * 0.18), x: c.m, y: c.height - c.m - px(52 * c.s) }, fill: 'emphasis', kind: 'shape', name: 'Signal', shape: 'rect', slot: 'signal' },
      logo(c, { height: px(36 * c.s), width: px(150 * c.s), x: c.width - c.m - px(150 * c.s), y: c.height - c.m - px(36 * c.s) }, 'wordmark', 'end'),
    ],
  },
  {
    id: 'centered',
    label: 'Centered',
    specs: (c) => [
      background(c),
      logo(c, { height: px(48 * c.s), width: px(48 * c.s), x: (c.width - px(48 * c.s)) / 2, y: c.m }, 'mark', 'center'),
      kicker(c, { height: px(24 * c.s), width: px(600 * c.s), x: (c.width - px(600 * c.s)) / 2, y: px(c.height * 0.3) }, c.identity.name, { align: 'center' }),
      headline(c, { height: px(c.height * 0.36), width: c.width - c.m * 3, x: c.m * 1.5, y: px(c.height * 0.36) }, 64 * c.s, { align: 'center', valign: 'top' }),
      meta(c, 'website', 'Footer', { height: px(24 * c.s), width: px(400 * c.s), x: (c.width - px(400 * c.s)) / 2, y: c.height - c.m - px(24 * c.s) }, c.identity.website, { align: 'center' }),
    ],
  },
  {
    id: 'ledger',
    label: 'Index',
    specs: (c) => [
      background(c),
      logo(c, { height: px(40 * c.s), width: px(160 * c.s), x: c.m, y: c.m }, 'wordmark'),
      meta(c, 'issue', 'Issue', { height: px(24 * c.s), width: px(320 * c.s), x: c.width - c.m - px(320 * c.s), y: c.m + px(8 * c.s) }, `${c.identity.name} Journal`, { align: 'right' }),
      rule(c, 'rule', { height: 2, width: c.width - c.m * 2, x: c.m, y: c.m + px(72 * c.s) }, 0.9),
      headline(c, { height: px(c.height * 0.44), width: px((c.width - c.m * 2) * 0.78), x: c.m, y: c.m + px(104 * c.s) }, 64 * c.s, { valign: 'top' }),
      rule(c, 'rule-bottom', { height: 2, width: c.width - c.m * 2, x: c.m, y: c.height - c.m - px(48 * c.s) }),
      meta(c, 'website', 'Footer', { height: px(24 * c.s), width: px(420 * c.s), x: c.m, y: c.height - c.m - px(26 * c.s) }, c.identity.website),
    ],
  },
];

// Terminal card --------------------------------------------------------------

/** Window height that hugs the code, never taller than the room it has. */
function codeHeight(context: LayoutContext, size: number, available: number): number {
  return px(Math.min(available, Math.max(size * 3, 40) + (context.codeLines + 1.6) * size * 1.62));
}

function codeSpec(context: LayoutContext, box: Box, size: number, chrome: CodeSpec['chrome'] = 'tabs'): CodeSpec {
  return { box, chrome, kind: 'code', name: 'Code window', radius: Math.max(context.identity.style.borderRadius, 8) * context.s * 1.4, size: px(size), slot: 'code' };
}

const TERMINAL_LAYOUTS: Layout[] = [
  {
    id: 'card',
    label: 'Card',
    specs: (c) => {
      // The window hugs its code, and title plus window sit centered on the card.
      const size = 18 * c.s;
      const titleHeight = px(64 * c.s);
      const gap = px(30 * c.s);
      const windowHeight = px(Math.min(c.height - px(142 * c.s) - px(68 * c.s), Math.max(size * 3, 40) + (c.codeLines + 1.6) * size * 1.62));
      const top = Math.max(px(48 * c.s), px((c.height - titleHeight - gap - windowHeight) / 2));
      return [
        background(c),
        headline(c, { height: titleHeight, width: c.width - c.m * 2 - px(80 * c.s), x: c.m, y: top }, 42 * c.s, { maxLines: 1, name: 'Card title', slot: 'title', valign: 'middle', content: c.text('title', codeSample(c.identity).title) }),
        logo(c, { height: px(32 * c.s), width: px(32 * c.s), x: c.width - c.m - px(32 * c.s), y: top + (titleHeight - px(32 * c.s)) / 2 }, 'mark', 'end'),
        codeSpec(c, { height: windowHeight, width: c.width - c.m * 2, x: c.m, y: top + titleHeight + gap }, size),
      ];
    },
  },
  {
    id: 'split',
    label: 'Split',
    specs: (c) => {
      if (!landscape(c)) {
        return [
          background(c),
          kicker(c, { height: px(24 * c.s), width: c.width - c.m * 2, x: c.m, y: c.m }, c.identity.products[0] ?? 'Developers'),
          headline(c, { height: px(c.height * 0.2), width: c.width - c.m * 2, x: c.m, y: c.m + px(40 * c.s) }, 64 * c.s, { name: 'Card title', slot: 'title', valign: 'top', content: c.text('title', codeSample(c.identity).title) }),
          codeSpec(c, { height: px(c.height * 0.5), width: c.width - c.m * 2, x: c.m, y: px(c.height * 0.36) }, 20 * c.s),
          logo(c, { height: px(40 * c.s), width: px(160 * c.s), x: c.m, y: c.height - c.m - px(40 * c.s) }, 'wordmark'),
        ];
      }
      const column = px(c.width * 0.36);
      return [
        background(c),
        kicker(c, { height: px(24 * c.s), width: column, x: c.m, y: px(c.height * 0.28) }, c.identity.products[0] ?? 'Developers'),
        headline(c, { height: px(c.height * 0.32), width: column, x: c.m, y: px(c.height * 0.28) + px(36 * c.s) }, 44 * c.s, { maxLines: 4, name: 'Card title', slot: 'title', valign: 'top', content: c.text('title', codeSample(c.identity).title) }),
        logo(c, { height: px(32 * c.s), width: px(140 * c.s), x: c.m, y: c.height - c.m - px(32 * c.s) }, 'wordmark'),
        (() => {
          const height = codeHeight(c, 16 * c.s, c.height - c.m * 2);
          return codeSpec(c, { height, width: c.width - column - c.m * 3, x: column + c.m * 2, y: px((c.height - height) / 2) }, 16 * c.s);
        })(),
      ];
    },
  },
  {
    id: 'focus',
    label: 'Focus',
    specs: (c) => [
      background(c),
      codeSpec(c, { height: c.height - c.m * 2 - px(48 * c.s), width: c.width - c.m * 2, x: c.m, y: c.m }, 20 * c.s, 'window'),
      logo(c, { height: px(28 * c.s), width: px(120 * c.s), x: c.m, y: c.height - c.m - px(20 * c.s) }, 'wordmark'),
      meta(c, 'website', 'Website', { height: px(24 * c.s), width: px(360 * c.s), x: c.width - c.m - px(360 * c.s), y: c.height - c.m - px(18 * c.s) }, c.identity.website, { align: 'right' }),
    ],
  },
  {
    id: 'caption',
    label: 'Caption',
    specs: (c) => [
      background(c),
      codeSpec(c, { height: px(c.height * 0.62), width: c.width - c.m * 2, x: c.m, y: c.m }, 18 * c.s),
      headline(c, { height: px(c.height * 0.16), width: c.width - c.m * 2 - px(200 * c.s), x: c.m, y: c.m + px(c.height * 0.62) + px(28 * c.s) }, 36 * c.s, { maxLines: 2, name: 'Card title', slot: 'title', valign: 'top', content: c.text('title', codeSample(c.identity).title) }),
      logo(c, { height: px(36 * c.s), width: px(150 * c.s), x: c.width - c.m - px(150 * c.s), y: c.height - c.m - px(36 * c.s) }, 'wordmark', 'end'),
    ],
  },
];

// Partnership lockup -------------------------------------------------------------

function lockupSpec(box: Box, justify: LockupSpec['justify']): LockupSpec {
  return { box, justify, kind: 'lockup', name: 'Partner lockup', slot: 'lockup', verticalAlign: 'center' };
}

function partnershipTitle(context: LayoutContext): string {
  return context.text('headline', `${context.identity.name} × ${defaultPartnerOption(context.identity)?.label ?? PARTNER_PLACEHOLDER}`);
}

const PARTNERSHIP_LAYOUTS: Layout[] = [
  {
    id: 'lockup',
    label: 'Lockup',
    specs: (c) => [
      background(c),
      lockupSpec({ height: px(110 * c.s), width: c.width - c.m * 2, x: c.m, y: px(54 * c.s) }, 'start'),
      headline(c, { height: px(c.height * 0.3), width: c.width - c.m * 2, x: c.m, y: px(c.height * 0.38) }, 68 * c.s, { content: partnershipTitle(c), maxLines: 2, valign: 'middle' }),
      meta(c, 'website', 'Footer', { height: px(24 * c.s), width: px(420 * c.s), x: c.m, y: c.height - px(80 * c.s) }, c.identity.website),
    ],
  },
  {
    id: 'centered',
    label: 'Centered',
    specs: (c) => [
      background(c),
      lockupSpec({ height: px(150 * c.s), width: c.width - c.m * 2, x: c.m, y: px(c.height * 0.24) }, 'center'),
      headline(c, { height: px(c.height * 0.2), width: c.width - c.m * 2, x: c.m, y: px(c.height * 0.56) }, 40 * c.s, { align: 'center', content: partnershipTitle(c), maxLines: 2, valign: 'top' }),
      meta(c, 'website', 'Footer', { height: px(24 * c.s), width: px(420 * c.s), x: (c.width - px(420 * c.s)) / 2, y: c.height - c.m - px(24 * c.s) }, c.identity.website, { align: 'center' }),
    ],
  },
  {
    id: 'hero',
    label: 'Hero lockup',
    specs: (c) => [
      background(c),
      lockupSpec({ height: px(220 * c.s), width: c.width - c.m * 2, x: c.m, y: (c.height - px(220 * c.s)) / 2 }, 'center'),
      meta(c, 'website', 'Footer', { height: px(24 * c.s), width: px(420 * c.s), x: (c.width - px(420 * c.s)) / 2, y: c.height - c.m - px(24 * c.s) }, c.identity.website, { align: 'center' }),
    ],
  },
  {
    id: 'announcement',
    label: 'Announcement',
    specs: (c) => [
      background(c),
      kicker(c, { height: px(24 * c.s), width: px(500 * c.s), x: c.m, y: c.m }, 'Partnership'),
      headline(c, { height: c.height - c.m * 2 - px(44 * c.s) - px(132 * c.s), width: c.width - c.m * 2, x: c.m, y: c.m + px(44 * c.s) }, 76 * c.s, { content: partnershipTitle(c), valign: 'bottom' }),
      rule(c, 'rule', { height: 2, width: c.width - c.m * 2, x: c.m, y: c.height - c.m - px(96 * c.s) }),
      lockupSpec({ height: px(72 * c.s), width: px((c.width - c.m * 2) * 0.6), x: c.m, y: c.height - c.m - px(72 * c.s) }, 'start'),
      meta(c, 'website', 'Footer', { height: px(24 * c.s), width: px(360 * c.s), x: c.width - c.m - px(360 * c.s), y: c.height - c.m - px(48 * c.s) }, c.identity.website, { align: 'right' }),
    ],
  },
];

// Slides -------------------------------------------------------------------------

function slideChrome(c: LayoutContext): SlotSpec[] {
  return [
    logo(c, { height: px(30 * c.s), width: px(150 * c.s), x: c.m, y: c.m + px(5 * c.s) }, 'wordmark'),
    meta(c, 'website', 'Footer', { height: px(22 * c.s), width: px(420 * c.s), x: c.m, y: c.height - c.m - px(18 * c.s) }, c.identity.website, { size: px(Math.max(12, 13 * c.s)) }),
    meta(c, 'page-number', 'Page number', { height: px(22 * c.s), width: px(160 * c.s), x: c.width - c.m - px(160 * c.s), y: c.height - c.m - px(18 * c.s) }, '{page} / {pages}', { align: 'right', size: px(Math.max(12, 13 * c.s)), tabular: true }),
  ];
}

/** First content line under the slide chrome (logo plus breathing room). */
function slideTop(c: LayoutContext): number {
  return c.m + px(40 * c.s) + px(72 * c.s);
}

function estimateTextHeight(text: string, width: number, size: number, lineHeight: number): number {
  const lines = layoutCanvasText(text, width, () => 0, 0, 'wrap', (line) => estimateTextWidth(line, { family: '', size, weight: 400 }));
  return lines.length * size * lineHeight;
}

function items(c: LayoutContext, fallback: readonly string[]): string[] {
  const stored = c.text('items', '');
  const list = stored ? stored.split('\n').map((item) => item.trim()).filter(Boolean) : [];
  return list.length > 0 ? list : [...fallback];
}

function itemText(c: LayoutContext, index: number, value: string, box: Box, extra: Partial<TextSpec> = {}): TextSpec {
  return {
    box,
    content: value,
    fill: c.fg,
    fit: true,
    kind: 'text',
    maxLines: 2,
    name: `Item ${index + 1}`,
    role: 'Body',
    size: px(26 * c.s),
    slot: `item-${index + 1}`,
    ...extra,
  };
}

function itemNumber(c: LayoutContext, index: number, box: Box): TextSpec {
  return { box, content: String(index + 1).padStart(2, '0'), fill: c.fg, kind: 'text', maxLines: 1, name: `Number ${index + 1}`, opacity: 0.42, role: 'Code', size: px(Math.max(13, 15 * c.s)), slot: `number-${index + 1}`, tabular: true };
}

function parseProofFigure(value: string): { label: string; value: string } | null {
  const match = /^([$€£]?[\d.,]+\s?[%+KMBTkmbt×x]*\+?)\s*(.*)$/.exec(value.trim());
  if (!match || !/\d/.test(match[1]!)) return null;
  return { label: match[2]?.trim() || '', value: match[1]!.trim() };
}

/**
 * Figures for metric and chart slides: the identity's numeric proof, then its
 * named proof (customers), then a placeholder that says what belongs there.
 */
export function metricFigures(identity: BrandIdentity): { label: string; value: string }[] {
  const figures = proofFigures(identity);
  if (figures.length >= 2) return figures;
  const named = identity.proof.filter((value) => value.length <= 14).map((value) => ({ label: 'Customer', value }));
  if (named.length >= 2) return named;
  return [{ label: 'Add a figure', value: '—' }, { label: 'Add a figure', value: '—' }, { label: 'Add a figure', value: '—' }];
}

export function proofFigures(identity: BrandIdentity): { label: string; value: string }[] {
  return identity.proof.flatMap((proof) => {
    const figure = parseProofFigure(proof);
    return figure ? [figure] : [];
  });
}

const SLIDE_DEFAULT_ITEMS = ['Foundation', 'Expression', 'Application', 'Delivery'];

const SLIDE_LAYOUTS: Layout[] = [
  {
    id: 'title',
    label: 'Title',
    specs: (c) => [
      background(c),
      ...slideChrome(c),
      kicker(c, { height: px(26 * c.s), width: c.width - c.m * 2, x: c.m, y: px(c.height * 0.32) }, c.identity.name),
      headline(c, { height: px(c.height * 0.34), width: px((c.width - c.m * 2) * 0.82), x: c.m, y: px(c.height * 0.32) + px(44 * c.s) }, 104 * c.s, { valign: 'top' }),
    ],
  },
  {
    id: 'section',
    label: 'Section',
    specs: (c) => [
      background(c),
      ...slideChrome(c),
      { box: { height: px(c.height * 0.44), width: px(c.width * 0.3), x: c.m, y: px(c.height * 0.3) }, content: c.text('section-number', '01'), fill: c.accent, kind: 'text', maxLines: 1, name: 'Section number', role: 'Display', size: px(280 * c.s), slot: 'section-number', tabular: true, valign: 'middle' },
      headline(c, { height: px(c.height * 0.36), width: px(c.width * 0.56), x: px(c.width * 0.38), y: px(c.height * 0.34) }, 80 * c.s, { valign: 'middle' }),
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda',
    specs: (c) => {
      const list = items(c, c.identity.strategy.pillars.length ? c.identity.strategy.pillars : SLIDE_DEFAULT_ITEMS).slice(0, 5);
      const left = px(c.width * 0.5);
      const rowHeight = px(Math.min(96 * c.s, (c.height * 0.56) / list.length));
      return [
        background(c),
        ...slideChrome(c),
        headline(c, { height: px(c.height * 0.4), width: left - c.m * 2, x: c.m, y: px(c.height * 0.24) }, 72 * c.s, { content: c.text('headline', 'Agenda'), valign: 'top' }),
        ...list.flatMap((item, index) => {
          const y = px(c.height * 0.24) + index * rowHeight;
          return [
            rule(c, `rule-${index + 1}`, { height: 2, width: c.width - left - c.m, x: left, y }, 0.18),
            itemNumber(c, index, { height: px(24 * c.s), width: px(48 * c.s), x: left, y: y + px(20 * c.s) }),
            itemText(c, index, item, { height: rowHeight - px(28 * c.s), width: c.width - left - c.m - px(72 * c.s), x: left + px(72 * c.s), y: y + px(16 * c.s) }, { maxLines: 1, size: px(28 * c.s) }),
          ];
        }),
      ];
    },
  },
  {
    id: 'split',
    label: 'Split',
    specs: (c) => [
      background(c),
      ...slideChrome(c),
      headline(c, { height: px(c.height * 0.44), width: px(c.width * 0.42), x: c.m, y: px(c.height * 0.24) }, 66 * c.s, { valign: 'top' }),
      media(c, { height: c.height, width: px(c.width * 0.46), x: c.width - px(c.width * 0.46), y: 0 }),
    ],
  },
  {
    id: 'metrics',
    label: 'Metrics',
    specs: (c) => {
      const list = metricFigures(c.identity).slice(0, 3);
      const columnWidth = (c.width - c.m * 2 - px(48 * c.s) * (list.length - 1)) / list.length;
      return [
        background(c),
        ...slideChrome(c),
        headline(c, { height: px(c.height * 0.2), width: px((c.width - c.m * 2) * 0.7), x: c.m, y: slideTop(c) }, 60 * c.s, { maxLines: 2, valign: 'top' }),
        ...list.flatMap((figure, index) => {
          const x = c.m + index * (columnWidth + px(48 * c.s));
          return [
            rule(c, `rule-${index + 1}`, { height: 2, width: columnWidth, x, y: px(c.height * 0.53) }, 0.9),
            { box: { height: px(c.height * 0.16), width: columnWidth, x, y: px(c.height * 0.55) }, content: c.text(`metric-${index + 1}`, figure.value), fill: index === 0 ? c.accent : c.fg, fit: true, kind: 'text', maxLines: 1, name: `Metric ${index + 1}`, role: 'Display', size: px(96 * c.s), slot: `metric-${index + 1}`, tabular: true, valign: 'top' } satisfies TextSpec,
            { box: { height: px(56 * c.s), width: columnWidth, x, y: px(c.height * 0.73) }, content: c.text(`metric-${index + 1}-label`, figure.label), fill: c.fg, kind: 'text', maxLines: 2, name: `Metric label ${index + 1}`, opacity: 0.66, role: 'Body', size: px(20 * c.s), slot: `metric-${index + 1}-label` } satisfies TextSpec,
          ];
        }),
      ];
    },
  },
  {
    id: 'quote',
    label: 'Quote',
    specs: (c) => {
      // The attribution follows the quote instead of a fixed line, so short quotes stay one block.
      const top = slideTop(c);
      const indent = px(180 * c.s);
      const width = c.width - c.m * 2 - indent;
      const quote = c.text('headline', c.identity.voice.phrases[1] ?? c.identity.tagline);
      const size = px(60 * c.s);
      const boxHeight = px(c.height * 0.4);
      const textHeight = Math.min(boxHeight, estimateTextHeight(quote, width, size, 1.04));
      return [
        background(c),
        ...slideChrome(c),
        { box: { height: px(160 * c.s), width: px(140 * c.s), x: c.m, y: top - px(16 * c.s) }, content: '“', fill: c.accent, kind: 'text', maxLines: 1, name: 'Quote mark', role: 'Display', size: px(200 * c.s), slot: 'quote-mark' },
        headline(c, { height: boxHeight, width, x: c.m + indent, y: top }, size, { content: quote, maxLines: 4, role: c.recipe.headlineRole === 'Accent' ? 'Accent' : 'Display', valign: 'top' }),
        meta(c, 'attribution', 'Attribution', { height: px(28 * c.s), width: px(600 * c.s), x: c.m + indent, y: top + px(textHeight) + px(40 * c.s) }, `${c.identity.name}`, { opacity: 0.7, size: px(20 * c.s) }),
      ];
    },
  },
  {
    id: 'timeline',
    label: 'Timeline',
    specs: (c) => {
      const list = items(c, c.identity.products.length >= 3 ? c.identity.products : SLIDE_DEFAULT_ITEMS).slice(0, 4);
      const lineY = px(c.height * 0.64);
      const step = (c.width - c.m * 2) / list.length;
      return [
        background(c),
        ...slideChrome(c),
        headline(c, { height: px(c.height * 0.2), width: px((c.width - c.m * 2) * 0.72), x: c.m, y: slideTop(c) }, 60 * c.s, { maxLines: 2, valign: 'top' }),
        rule(c, 'timeline-rule', { height: 2, width: c.width - c.m * 2, x: c.m, y: lineY }, 0.3),
        ...list.flatMap((item, index) => {
          const x = c.m + index * step;
          return [
            { box: { height: px(16 * c.s), width: px(16 * c.s), x, y: lineY - px(7 * c.s) }, fill: index === 0 ? c.accent : c.fg, kind: 'shape', name: `Marker ${index + 1}`, shape: 'ellipse', slot: `marker-${index + 1}` } satisfies ShapeSpec,
            itemNumber(c, index, { height: px(24 * c.s), width: px(80 * c.s), x, y: lineY - px(52 * c.s) }),
            itemText(c, index, item, { height: px(72 * c.s), width: step - px(32 * c.s), x, y: lineY + px(32 * c.s) }, { size: px(24 * c.s) }),
          ];
        }),
      ];
    },
  },
  {
    id: 'statement',
    label: 'Statement',
    specs: (c) => [
      background(c),
      ...slideChrome(c),
      headline(c, { height: c.height - c.m * 2 - px(200 * c.s), width: c.width - c.m * 2, x: c.m, y: c.m + px(100 * c.s) }, 120 * c.s, { align: 'center', content: c.text('headline', c.identity.voice.phrases[0] ?? c.identity.tagline), maxLines: 3, valign: 'middle' }),
    ],
  },
  {
    id: 'comparison',
    label: 'Comparison',
    specs: (c) => {
      // The identity's own "avoid" and "do" voice rules make an honest before / after.
      const list = items(c, [c.identity.voice.avoid[0] ?? 'Before', c.identity.voice.principles[0] ?? 'After']);
      const columnWidth = (c.width - c.m * 2 - px(48 * c.s)) / 2;
      return [
        background(c),
        ...slideChrome(c),
        headline(c, { height: px(c.height * 0.16), width: c.width - c.m * 2, x: c.m, y: slideTop(c) }, 56 * c.s, { maxLines: 2, valign: 'top' }),
        ...[0, 1].flatMap((index) => {
          const x = c.m + index * (columnWidth + px(48 * c.s));
          return [
            { box: { height: px(c.height * 0.34), width: columnWidth, x, y: px(c.height * 0.48) }, fill: index === 1 ? 'emphasis' : c.fg, kind: 'shape', name: `Panel ${index + 1}`, opacity: index === 1 ? 1 : 0.06, radius: c.identity.style.borderRadius, shape: 'rect', slot: `panel-${index + 1}` } satisfies ShapeSpec,
            itemNumber(c, index, { height: px(24 * c.s), width: px(80 * c.s), x: x + px(36 * c.s), y: px(c.height * 0.48) + px(36 * c.s) }),
            itemText(c, index, list[index] ?? '', { height: px(c.height * 0.2), width: columnWidth - px(72 * c.s), x: x + px(36 * c.s), y: px(c.height * 0.48) + px(84 * c.s) }, { fill: index === 1 ? foregroundRole(c.identity, 'emphasis') : c.fg, maxLines: 4, role: 'Display', size: px(34 * c.s) }),
          ];
        }),
      ];
    },
  },
  {
    id: 'process',
    label: 'Process',
    specs: (c) => {
      const list = items(c, c.identity.strategy.pillars.length >= 3 ? c.identity.strategy.pillars : SLIDE_DEFAULT_ITEMS).slice(0, 4);
      const gap = px(24 * c.s);
      const columnWidth = (c.width - c.m * 2 - gap * (list.length - 1)) / list.length;
      return [
        background(c),
        ...slideChrome(c),
        headline(c, { height: px(c.height * 0.2), width: px((c.width - c.m * 2) * 0.72), x: c.m, y: slideTop(c) }, 58 * c.s, { maxLines: 2, valign: 'top' }),
        ...list.flatMap((item, index) => {
          const x = c.m + index * (columnWidth + gap);
          return [
            rule(c, `rule-${index + 1}`, { height: 2, width: columnWidth, x, y: px(c.height * 0.54) }, index === 0 ? 1 : 0.3),
            itemNumber(c, index, { height: px(24 * c.s), width: px(80 * c.s), x, y: px(c.height * 0.54) + px(24 * c.s) }),
            itemText(c, index, item, { height: px(c.height * 0.18), width: columnWidth - px(12 * c.s), x, y: px(c.height * 0.54) + px(64 * c.s) }, { maxLines: 3, size: px(26 * c.s), weight: 500 }),
          ];
        }),
      ];
    },
  },
  {
    id: 'chart',
    label: 'Chart',
    specs: (c) => {
      const figure = metricFigures(c.identity)[0]!;
      return [
        background(c),
        ...slideChrome(c),
        headline(c, { height: px(c.height * 0.2), width: px(c.width * 0.42), x: c.m, y: slideTop(c) }, 52 * c.s, { maxLines: 3, valign: 'top' }),
        { box: { height: px(c.height * 0.2), width: px(c.width * 0.42), x: c.m, y: px(c.height * 0.52) }, content: c.text('metric-1', figure.value), fill: c.accent, fit: true, kind: 'text', maxLines: 1, name: 'Metric', role: 'Display', size: px(128 * c.s), slot: 'metric-1', tabular: true, valign: 'bottom' },
        { box: { height: px(28 * c.s), width: px(c.width * 0.42), x: c.m, y: px(c.height * 0.74) }, casing: 'uppercase', content: c.text('metric-1-label', figure.label), fill: c.fg, kind: 'text', maxLines: 1, name: 'Metric label', opacity: 0.6, role: 'Code', size: px(16 * c.s), slot: 'metric-1-label', tracking: 0.08 },
        { box: { height: px(c.height * 0.78) - slideTop(c), width: px(c.width * 0.42), x: c.width - c.m - px(c.width * 0.42), y: slideTop(c) }, kind: 'chart', labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'], name: 'Chart', slot: 'chart', values: [42, 68, 55, 88, 100] },
      ];
    },
  },
  {
    id: 'team',
    label: 'Team',
    specs: (c) => {
      const list = items(c, c.identity.products.length >= 3 ? c.identity.products : ['Design', 'Engineering', 'Operations']).slice(0, 3);
      const step = (c.width - c.m * 2) / list.length;
      const diameter = px(Math.min(160 * c.s, step * 0.6, c.height * 0.2));
      return [
        background(c),
        ...slideChrome(c),
        headline(c, { height: px(c.height * 0.16), width: c.width - c.m * 2, x: c.m, y: slideTop(c) }, 56 * c.s, { maxLines: 2, valign: 'top' }),
        ...list.flatMap((item, index) => {
          const centerX = c.m + step * index + step / 2;
          return [
            { box: { height: diameter, width: diameter, x: centerX - diameter / 2, y: px(c.height * 0.42) }, fill: index === 0 ? 'emphasis' : c.fg, kind: 'shape', name: `Avatar ${index + 1}`, opacity: index === 0 ? 1 : 0.1, shape: 'ellipse', slot: `avatar-${index + 1}` } satisfies ShapeSpec,
            { box: { height: diameter, width: diameter, x: centerX - diameter / 2, y: px(c.height * 0.42) }, align: 'center', content: c.text(`initials-${index + 1}`, item.slice(0, 2).toUpperCase()), fill: index === 0 ? foregroundRole(c.identity, 'emphasis') : c.fg, kind: 'text', maxLines: 1, name: `Initials ${index + 1}`, role: 'Display', size: px(diameter * 0.3), slot: `initials-${index + 1}`, valign: 'middle' } satisfies TextSpec,
            itemText(c, index, item, { height: px(40 * c.s), width: step - px(24 * c.s), x: centerX - (step - px(24 * c.s)) / 2, y: px(c.height * 0.42) + diameter + px(28 * c.s) }, { align: 'center', maxLines: 1, size: px(24 * c.s) }),
          ];
        }),
      ];
    },
  },
  {
    id: 'image',
    label: 'Image',
    specs: (c) => [
      background(c),
      ...slideChrome(c),
      headline(c, { height: px(c.height * 0.4), width: px(c.width * 0.4), x: c.m, y: px(c.height * 0.28) }, 64 * c.s, { valign: 'top' }),
      media(c, { height: c.height - c.m * 2, width: px(c.width * 0.46), x: c.width - c.m - px(c.width * 0.46), y: c.m }),
    ],
  },
  {
    id: 'closing',
    label: 'Closing',
    specs: (c) => [
      background(c),
      logo(c, { height: px(64 * c.s), width: px(260 * c.s), x: (c.width - px(260 * c.s)) / 2, y: px(c.height * 0.24) }, 'wordmark', 'center'),
      headline(c, { height: px(c.height * 0.26), width: c.width - c.m * 2, x: c.m, y: px(c.height * 0.38) }, 80 * c.s, { align: 'center', content: c.text('headline', c.identity.voice.phrases[2] ?? c.identity.tagline), maxLines: 2, valign: 'middle' }),
      meta(c, 'website', 'Footer', { height: px(32 * c.s), width: px(600 * c.s), x: (c.width - px(600 * c.s)) / 2, y: px(c.height * 0.7) }, c.identity.website, { align: 'center', opacity: 0.7, size: px(22 * c.s) }),
    ],
  },
];

export const EXPRESSION_LAYOUTS: Record<ExpressionToolKind, readonly Layout[]> = {
  blog: BLOG_LAYOUTS,
  opengraph: OPENGRAPH_LAYOUTS,
  partnership: PARTNERSHIP_LAYOUTS,
  slides: SLIDE_LAYOUTS,
  terminal: TERMINAL_LAYOUTS,
};

export function expressionLayouts(kind: ExpressionToolKind): readonly { id: string; label: string }[] {
  return EXPRESSION_LAYOUTS[kind].map(({ id, label }) => ({ id, label }));
}

function resolveLayout(kind: ExpressionToolKind, layoutId: string): Layout {
  return EXPRESSION_LAYOUTS[kind].find(({ id }) => id === layoutId) ?? EXPRESSION_LAYOUTS[kind][0]!;
}

// ---------------------------------------------------------------------------
// Building and re-flowing layers

/** Style keys a person changed by hand; layouts re-flow geometry but keep these. */
export const STYLE_KEYS = ['align', 'casing', 'fill', 'fit', 'lineHeight', 'opacity', 'role', 'size', 'tracking', 'valign', 'weight', 'asset', 'shape', 'radius'] as const;

function styledKeys(element: CanvasElement | null): Set<string> {
  return new Set(element ? readStringArray(element, 'styled') : []);
}

function typographyDefaults(identity: BrandIdentity, role: ExpressionFontRole) {
  const typography = brandTypographyRole(identity, role);
  const divisor = role === 'Display' || role === 'Accent' ? 64 : 100;
  return {
    lineHeight: typography.lineHeight ?? (role === 'Display' ? 1 : 1.5),
    tracking: Math.max(-0.04, Math.min(0.12, (typography.letterSpacing ?? 0) / divisor)),
  };
}

type BuildResult = { assets: CanvasAsset[]; element: CanvasElement };

function specElementId(pageId: string, slot: string) {
  return `${pageId}:${slot}`;
}

type TextStyleValues = {
  align: 'center' | 'justify' | 'left' | 'right';
  casing: 'lowercase' | 'none' | 'uppercase';
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
};

/** textStyle field → the styled key that marks a hand-set value. */
const TEXT_STYLE_KEYS: Readonly<Record<keyof TextStyleValues, string>> = {
  align: 'align', casing: 'casing', fontSize: 'size', fontWeight: 'weight', letterSpacing: 'tracking', lineHeight: 'lineHeight',
};

function keepStyled<T extends object>(styled: Set<string>, keys: Readonly<Record<keyof T, string>>, current: Partial<T> | undefined, next: T): T {
  const result = { ...next };
  for (const key of Object.keys(keys) as (keyof T)[]) {
    if (styled.has(keys[key]) && current?.[key] !== undefined) result[key] = current[key] as T[keyof T];
  }
  return result;
}

function specTextStyle(spec: TextSpec, identity: BrandIdentity, role: ExpressionFontRole, weight: number): TextStyleValues {
  const defaults = typographyDefaults(identity, role);
  const display = role === 'Display' || role === 'Accent';
  return {
    align: spec.align ?? 'left',
    casing: spec.casing ?? 'none',
    fontSize: spec.size,
    fontWeight: capVisibleFontWeight(spec.weight ?? weight),
    letterSpacing: spec.tracking ?? defaults.tracking,
    lineHeight: spec.lineHeight ?? (display ? Math.min(defaults.lineHeight, 1.04) : defaults.lineHeight),
  };
}

function specTextData(spec: TextSpec): { fill: string; fit: string; valign: string } {
  return { fill: spec.fill ?? 'ink', fit: spec.fit ? 'shrink' : 'none', valign: spec.valign ?? 'top' };
}

function buildText(spec: TextSpec, existing: CanvasElement | null, identity: BrandIdentity, id: string): BuildResult {
  const styled = styledKeys(existing);
  const keepRole = styled.has('role') && Boolean(existing?.textStyle);
  const role = keepRole ? existing!.textStyle!.fontRole ?? spec.role : spec.role;
  const font = expressionFont(identity, role);
  const colors = expressionColors(identity);
  const element = existing ?? newExpressionElement(id, spec.name, 'text', { ...spec.box, rotation: 0 });
  const data = keepStyled(styled, { fill: 'fill', fit: 'fit', valign: 'valign' }, existing ? {
    fill: dataString(existing, 'fill') || undefined,
    fit: dataString(existing, 'fit') || undefined,
    valign: dataString(existing, 'valign') || undefined,
  } : undefined, specTextData(spec));
  const typography = keepStyled(styled, TEXT_STYLE_KEYS, existing?.textStyle, specTextStyle(spec, identity, role, font.weight));
  const opacity = styled.has('opacity') ? element.style.opacity : spec.opacity ?? 1;
  return {
    assets: [font.asset],
    element: {
      ...element,
      bounds: roundBounds({ ...spec.box, rotation: element.bounds.rotation }),
      content: existing?.content ?? spec.content,
      data: { ...element.data, ...data, maxLines: spec.maxLines ?? 0, slot: spec.slot, tabular: spec.tabular ?? false },
      style: { ...element.style, opacity },
      textStyle: {
        ...typography,
        color: resolveExpressionColor(data.fill, colors, colors.ink!),
        fontFamily: keepRole ? existing!.textStyle!.fontFamily : font.family,
        fontId: keepRole ? existing!.textStyle!.fontId : font.asset.id,
        fontRole: role,
        tokenBound: true,
      },
    },
  };
}

function buildLogo(spec: LogoSpec, existing: CanvasElement | null, identity: BrandIdentity, dark: boolean, id: string): BuildResult {
  const styled = styledKeys(existing);
  const element = existing ?? newExpressionElement(id, spec.name, 'logo', { ...spec.box, rotation: 0 });
  if (styled.has('asset') && existing?.assetId) {
    return { assets: [], element: { ...element, bounds: roundBounds({ ...spec.box, rotation: element.bounds.rotation }), data: { ...element.data, align: spec.align ?? 'start', slot: spec.slot } } };
  }
  const { asset, libraryId } = brandLogoAsset(identity, spec.variant, dark);
  return {
    assets: [asset],
    element: {
      ...element,
      assetId: asset.id,
      bounds: roundBounds({ ...spec.box, rotation: element.bounds.rotation }),
      data: { ...element.data, align: spec.align ?? 'start', libraryAssetId: libraryId, slot: spec.slot, variant: spec.variant },
    },
  };
}

function buildImage(spec: ImageSpec, existing: CanvasElement | null, identity: BrandIdentity, id: string): BuildResult {
  const styled = styledKeys(existing);
  const element = existing ?? newExpressionElement(id, spec.name, 'image', { ...spec.box, rotation: 0 });
  const asset = styled.has('asset') && existing?.assetId ? null : libraryImageAsset(identity, spec.libraryId);
  return {
    assets: asset ? [asset] : [],
    element: {
      ...element,
      assetId: asset?.id ?? element.assetId,
      bounds: roundBounds({ ...spec.box, rotation: element.bounds.rotation }),
      data: { ...element.data, libraryAssetId: asset ? spec.libraryId : element.data.libraryAssetId ?? null, slot: spec.slot, treatment: styled.has('treatment') ? element.data.treatment ?? 'natural' : spec.treatment ?? 'natural' },
      imageTreatment: element.imageTreatment ?? {
        blur: 0,
        crop: { height: 1, width: 1, x: 0, y: 0 },
        dither: 0,
        focalPoint: { x: 0.5, y: 0.5 },
        grain: 0,
        halation: 0,
        objectFit: 'cover',
        posterize: 0,
        saturation: 1,
      },
      style: { ...element.style, borderRadius: styled.has('radius') ? element.style.borderRadius : spec.radius ?? 0, opacity: styled.has('opacity') ? element.style.opacity : spec.opacity ?? 1 },
    },
  };
}

function buildShape(spec: ShapeSpec | TextureSpec, existing: CanvasElement | null, id: string): BuildResult {
  const styled = styledKeys(existing);
  const kind = spec.kind === 'texture' ? 'texture' : 'shape';
  const element = existing ?? newExpressionElement(id, spec.name, kind, { ...spec.box, rotation: 0 });
  const data: Record<string, CanvasJsonValue> = spec.kind === 'texture'
    ? { spacing: spec.spacing, texture: spec.texture }
    : { shape: styled.has('shape') ? element.data.shape ?? spec.shape : spec.shape, strokeWidth: spec.strokeWidth ?? (spec.shape === 'line' ? 1 : 0) };
  return {
    assets: [],
    element: {
      ...element,
      bounds: roundBounds({ ...spec.box, rotation: element.bounds.rotation }),
      data: { ...element.data, ...data, fill: styled.has('fill') ? element.data.fill ?? spec.fill : spec.fill, slot: spec.slot },
      // The page background starts locked so a canvas click selects content, not the page.
      locked: existing ? element.locked : spec.slot === 'background',
      style: {
        ...element.style,
        borderRadius: styled.has('radius') ? element.style.borderRadius : spec.kind === 'shape' ? spec.radius ?? 0 : 0,
        opacity: styled.has('opacity') ? element.style.opacity : spec.opacity ?? 1,
      },
    },
  };
}

function buildDevice(spec: DeviceSpec, existing: CanvasElement | null, identity: BrandIdentity, id: string): BuildResult {
  const font = expressionFont(identity, 'Body');
  const element = existing ?? newExpressionElement(id, spec.name, 'component', { ...spec.box, rotation: 0 });
  const styled = styledKeys(existing);
  return {
    assets: [font.asset],
    element: {
      ...element,
      bounds: roundBounds({ ...spec.box, rotation: element.bounds.rotation }),
      data: { ...element.data, component: 'device', device: styled.has('asset') ? element.data.device ?? spec.device : spec.device, slot: spec.slot },
      textStyle: element.textStyle ?? {
        align: 'left', casing: 'none', color: '#FFFFFF', fontFamily: font.family, fontId: font.asset.id, fontRole: 'Body',
        fontSize: 16, fontWeight: 450, letterSpacing: 0, lineHeight: 1.4, tokenBound: true,
      },
    },
  };
}

function codeTabsFor(identity: BrandIdentity) {
  return codeSample(identity).tabs.map((tab, index) => ({ ...tab, id: `tab-${index + 1}` }));
}

function buildCode(spec: CodeSpec, existing: CanvasElement | null, identity: BrandIdentity, recipe: ExpressionRecipe, id: string): BuildResult {
  const font = expressionFont(identity, 'Code');
  const styled = styledKeys(existing);
  const element = existing ?? newExpressionElement(id, spec.name, 'component', { ...spec.box, rotation: 0 });
  const keepRole = styled.has('role') && Boolean(existing?.textStyle);
  const typography = keepStyled(styled, { fontSize: 'size', fontWeight: 'weight', lineHeight: 'lineHeight' }, existing?.textStyle, {
    fontSize: spec.size,
    fontWeight: font.weight,
    lineHeight: 1.62,
  });
  return {
    assets: keepRole ? [] : [font.asset],
    element: {
      ...element,
      bounds: roundBounds({ ...spec.box, rotation: element.bounds.rotation }),
      data: {
        activeTab: 'tab-1',
        lineNumbers: true,
        tabs: codeTabsFor(identity),
        theme: recipe.codeTheme,
        ...element.data,
        chrome: styled.has('chrome') ? element.data.chrome ?? spec.chrome : spec.chrome,
        component: 'code',
        slot: spec.slot,
      },
      style: { ...element.style, borderRadius: styled.has('radius') ? element.style.borderRadius : spec.radius },
      textStyle: {
        ...typography,
        align: 'left',
        casing: 'none',
        color: '#FFFFFF',
        fontFamily: keepRole ? existing!.textStyle!.fontFamily : font.family,
        fontId: keepRole ? existing!.textStyle!.fontId : font.asset.id,
        fontRole: keepRole ? existing!.textStyle!.fontRole : 'Code',
        letterSpacing: existing?.textStyle?.letterSpacing ?? 0,
        tokenBound: true,
      },
    },
  };
}

export function lockupPartnersFor(identity: BrandIdentity, dark: boolean, partnerId?: string): { assets: CanvasAsset[]; partners: LockupPartner[] } {
  const brand = brandLogoAsset(identity, 'wordmark', dark);
  const brandPartner: LockupPartner = { aspect: partnerAspectGuess(brand.libraryId), assetId: brand.asset.id, id: 'brand', kind: 'logo', label: identity.name, sourceId: brand.libraryId ?? undefined };
  const option = expressionPartnerOptions(identity).find(({ id }) => id === partnerId) ?? defaultPartnerOption(identity);
  if (!option) {
    // No real partner on file: a written slot that reads as a placeholder, never a made-up brand.
    const font = expressionFont(identity, 'Display');
    return {
      assets: [brand.asset, font.asset],
      partners: [brandPartner, { aspect: 3, fontAssetId: font.asset.id, fontFamily: font.family, fontWeight: font.weight, id: 'partner-1', kind: 'text', label: PARTNER_PLACEHOLDER }],
    };
  }
  const partnerAsset = expressionAsset(`partner:${option.id}`, option.label, option.path);
  return {
    assets: [brand.asset, partnerAsset],
    partners: [brandPartner, { aspect: option.aspect, assetId: partnerAsset.id, id: 'partner-1', kind: 'logo', label: option.label, sourceId: option.id }],
  };
}

function buildLockup(spec: LockupSpec, existing: CanvasElement | null, identity: BrandIdentity, dark: boolean, id: string): BuildResult {
  const styled = styledKeys(existing);
  const element = existing ?? newExpressionElement(id, spec.name, 'component', { ...spec.box, rotation: 0 });
  const initial = existing ? null : lockupPartnersFor(identity, dark);
  return {
    assets: initial?.assets ?? [],
    element: {
      ...element,
      bounds: roundBounds({ ...spec.box, rotation: element.bounds.rotation }),
      data: {
        ...element.data,
        component: 'lockup',
        fill: styled.has('fill') ? element.data.fill ?? 'ink' : dark ? 'paper' : 'ink',
        justify: styled.has('align') ? element.data.justify ?? spec.justify : spec.justify,
        partners: initial ? initial.partners : element.data.partners ?? [],
        separator: element.data.separator ?? '×',
        sizing: element.data.sizing ?? 'optical',
        slot: spec.slot,
        tone: element.data.tone ?? 'mono',
        verticalAlign: element.data.verticalAlign ?? spec.verticalAlign,
      },
    },
  };
}

function buildChart(spec: ChartSpec, existing: CanvasElement | null, fg: string, id: string): BuildResult {
  const element = existing ?? newExpressionElement(id, spec.name, 'component', { ...spec.box, rotation: 0 });
  return {
    assets: [],
    element: {
      ...element,
      bounds: roundBounds({ ...spec.box, rotation: element.bounds.rotation }),
      data: { accent: 'emphasis', component: 'chart', fill: fg, labels: spec.labels, values: spec.values, ...element.data, slot: spec.slot },
    },
  };
}

function buildSpec(spec: SlotSpec, existing: CanvasElement | null, context: LayoutContext, id: string): BuildResult {
  if (spec.kind === 'text') return buildText(spec, existing, context.identity, id);
  if (spec.kind === 'logo') return buildLogo(spec, existing, context.identity, context.dark, id);
  if (spec.kind === 'image') return buildImage(spec, existing, context.identity, id);
  if (spec.kind === 'shape' || spec.kind === 'texture') return buildShape(spec, existing, id);
  if (spec.kind === 'device') return buildDevice(spec, existing, context.identity, id);
  if (spec.kind === 'code') return buildCode(spec, existing, context.identity, context.recipe, id);
  if (spec.kind === 'lockup') return buildLockup(spec, existing, context.identity, context.dark, id);
  return buildChart(spec, existing, context.fg, id);
}

function elementKindMatches(spec: SlotSpec, element: CanvasElement): boolean {
  if (spec.kind === 'text') return element.kind === 'text';
  if (spec.kind === 'logo') return element.kind === 'logo';
  if (spec.kind === 'image') return element.kind === 'image';
  if (spec.kind === 'shape') return element.kind === 'shape' || element.kind === 'line';
  if (spec.kind === 'texture') return element.kind === 'texture';
  if (spec.kind === 'device') return element.kind === 'component' && element.data.component === 'device';
  return element.kind === 'component' && element.data.component === spec.kind;
}

function isMediaLayer(element: CanvasElement): boolean {
  return element.kind === 'image' || element.kind === 'shader' || (element.kind === 'component' && element.data.component === 'device');
}

function isMediaSwap(spec: SlotSpec, element: CanvasElement): boolean {
  return (spec.kind === 'image' || spec.kind === 'device') && isMediaLayer(element);
}

function layoutContext(document: CanvasDocument, pageId: string, identity: BrandIdentity, surface: ExpressionColor, stash: Record<string, string>): LayoutContext {
  const page = document.pages[pageId]!;
  const recipe = expressionRecipe(identity);
  const width = page.width;
  const height = page.height;
  const s = Math.max(0.6, Math.sqrt((width * height) / (1200 * 630)) * (width / height >= 1.2 ? 1 : 0.92));
  const existing = new Map(pageElements(document, pageId).flatMap((element) => {
    const slot = elementSlot(element);
    return slot ? [[slot, element] as const] : [];
  }));
  const itemsText = [...existing.entries()]
    .filter(([slot, element]) => /^item-\d+$/.test(slot) && element.kind === 'text')
    .sort(([first], [second]) => Number(first.slice(5)) - Number(second.slice(5)))
    .map(([, element]) => element.content ?? '')
    .join('\n');
  const colors = expressionColors(identity);
  const surfaceHex = resolveExpressionColor(surface, colors, colors.paper!);
  const codeElement = [...existing.values()].find((element) => element.kind === 'component' && element.data.component === 'code');
  const codeTabs = codeElement ? readCodeTabs(codeElement) : codeSample(identity).tabs;
  return {
    codeLines: Math.max(1, ...codeTabs.map((tab) => tab.code.split('\n').length)),
    accent: colorContrastRatio(colors.emphasis ?? colors.ink!, surfaceHex) >= 3 ? 'emphasis' : foregroundRole(identity, surface),
    dark: isDarkSurface(identity, surface),
    fg: foregroundRole(identity, surface),
    height,
    identity,
    kind: expressionState(document).kind,
    m: snap(Math.max(40, Math.min(width, height) * 0.112)),
    recipe,
    s,
    surface,
    text: (slot, fallback) => {
      if (slot === 'items') return itemsText || stash.items || fallback;
      const element = existing.get(slot);
      if (element?.kind === 'text' && element.content !== undefined) return element.content;
      return stash[slot] ?? fallback;
    },
    width,
  };
}

/**
 * Re-flow one page into a layout. Slot layers keep their content, IDs, and any
 * style a person set by hand; free layers keep their place on top.
 */
export function applyExpressionLayout(
  document: CanvasDocument,
  pageId: string,
  layoutId: string,
  identity: BrandIdentity,
  options: { surface?: ExpressionColor } = {}
): CanvasDocument {
  const page = document.pages[pageId];
  if (!page) return document;
  const state = expressionState(document);
  const settings = pageSettings(document, pageId);
  const surface = options.surface ?? settings.surface;
  const layout = resolveLayout(state.kind, layoutId);
  const stash = { ...settings.stash };
  const context = layoutContext(document, pageId, identity, surface, stash);
  const specs = layout.specs(context);
  const current = pageElements(document, pageId);
  const bySlot = new Map(current.flatMap((element) => {
    const slot = elementSlot(element);
    return slot ? [[slot, element] as const] : [];
  }));
  const used = new Set<string>();
  const assets: CanvasAsset[] = [];
  const elements: Record<string, CanvasElement> = { ...document.elements };
  const slotIds: string[] = [];
  let scratch = document;
  for (const spec of specs) {
    const candidate = bySlot.get(spec.slot) ?? null;
    if (candidate && !elementKindMatches(spec, candidate) && isMediaSwap(spec, candidate)) {
      // A person swapped the media layer for an image, shader, or device; keep it.
      elements[candidate.id] = { ...candidate, bounds: roundBounds({ ...spec.box, rotation: candidate.bounds.rotation }) };
      slotIds.push(candidate.id);
      used.add(candidate.id);
      continue;
    }
    const existing = candidate && elementKindMatches(spec, candidate) ? candidate : null;
    const id = existing?.id ?? (candidate ? uniqueElementId(scratch, specElementId(pageId, `${spec.slot}-${spec.kind}`)) : uniqueElementId(scratch, specElementId(pageId, spec.slot)));
    const built = buildSpec(spec, existing, context, id);
    assets.push(...built.assets);
    elements[built.element.id] = built.element;
    scratch = { ...scratch, elements };
    slotIds.push(built.element.id);
    used.add(built.element.id);
  }
  const removed = current.filter((element) => elementSlot(element) && !used.has(element.id));
  for (const element of removed) {
    const slot = elementSlot(element)!;
    if (element.kind === 'text' && element.content) stash[/^item-\d+$/.test(slot) ? slot : slot] = element.content;
    delete elements[element.id];
  }
  if (context.text('items', '')) stash.items = context.text('items', '');
  const free = current.filter((element) => !elementSlot(element) && elements[element.id]).map(({ id }) => id);
  const colors = expressionColors(identity);
  const next = touchDocument(withAssets(document, assets), {
    elements,
    pages: {
      ...document.pages,
      [pageId]: { ...page, background: resolveExpressionColor(surface, colors, colors.paper!), elementIds: [...slotIds, ...free] },
    },
  });
  return pruneAssets(withExpressionState(next, (nextState) => ({
    ...nextState,
    pages: { ...nextState.pages, [pageId]: { layout: layout.id, stash: Object.keys(stash).length ? stash : undefined, surface } },
  })));
}

export function setExpressionFormat(document: CanvasDocument, formatId: string, identity: BrandIdentity): CanvasDocument {
  const state = expressionState(document);
  const format = resolveExpressionFormat(state.kind, formatId);
  let next = document;
  for (const pageId of document.pageIds) {
    const page = next.pages[pageId]!;
    const from = { height: page.height, width: page.width };
    const elements = { ...next.elements };
    for (const element of pageElements(next, pageId)) {
      if (elementSlot(element)) continue;
      elements[element.id] = { ...element, bounds: scaleBoundsToFormat(element.bounds, from, format) };
    }
    next = {
      ...next,
      elements,
      pages: { ...next.pages, [pageId]: { ...page, height: format.height, width: format.width } },
    };
    next = applyExpressionLayout(next, pageId, pageSettings(next, pageId).layout, identity);
  }
  return withExpressionState(touchDocument(next), (nextState) => ({ ...nextState, format: format.id }));
}

export function setPageSurface(document: CanvasDocument, pageId: string, surface: ExpressionColor, identity: BrandIdentity): CanvasDocument {
  // Light and dark marks swap with the surface; hand-picked fills stay.
  return applyExpressionLayout(document, pageId, pageSettings(document, pageId).layout, identity, { surface });
}

// ---------------------------------------------------------------------------
// Documents

export function expressionToolTitle(kind: ExpressionToolKind): string {
  return { blog: 'Blog cover', opengraph: 'OpenGraph', partnership: 'Partnership lockup', slides: 'Slide templates', terminal: 'Terminal card' }[kind];
}

type DeckSlide = { content?: Record<string, string>; layout: string };

export function defaultDeck(identity: BrandIdentity): DeckSlide[] {
  const figures = proofFigures(identity);
  return [
    { layout: 'title' },
    { layout: 'agenda' },
    figures.length >= 2
      ? { content: { headline: identity.voice.phrases[1] ?? identity.tagline }, layout: 'metrics' }
      : { content: { headline: identity.voice.phrases[1] ?? identity.tagline }, layout: 'statement' },
    { content: { headline: identity.voice.phrases[0] ?? identity.tagline }, layout: 'quote' },
    { layout: 'closing' },
  ];
}

export function createExpressionDocument(
  kind: ExpressionToolKind,
  identity: BrandIdentity,
  options: { deck?: readonly DeckSlide[]; format?: ExpressionFormat; layout?: string; surface?: ExpressionColor; toolId?: string } = {}
): CanvasDocument {
  const recipe = expressionRecipe(identity);
  const format = options.format ?? defaultExpressionFormat(kind);
  const surface = options.surface ?? recipe.surfaces[kind];
  const slides = kind === 'slides' ? options.deck ?? defaultDeck(identity) : [{ layout: options.layout ?? recipe.layouts[kind as Exclude<ExpressionToolKind, 'slides'>] }];
  const colors = expressionColors(identity);
  const pages = slides.map((slide, index) => ({
    background: resolveExpressionColor(surface, colors, colors.paper!),
    id: `page-${index + 1}`,
    name: kind === 'slides' ? `Slide ${index + 1}` : expressionToolTitle(kind),
    settings: { layout: slide.layout, stash: slide.content, surface } satisfies ExpressionPageSettings,
  }));
  let document = createExpressionShell({
    brandId: identity.id,
    format,
    id: `${identity.id}:${options.toolId ?? kind}:expression`,
    kind,
    pages,
    title: `${identity.name} ${expressionToolTitle(kind)}`,
    toolId: options.toolId ?? kind,
  });
  for (const page of pages) document = applyExpressionLayout(document, page.id, page.settings.layout, identity);
  return document;
}

export function newSlidePage(document: CanvasDocument, identity: BrandIdentity, layoutId: string, index: number): { document: CanvasDocument; pageId: string } {
  const pageId = uniquePageId(document);
  const reference = document.pages[document.pageIds[0]!]!;
  const surface = pageSettings(document, document.pageIds[0]!).surface;
  const colors = expressionColors(identity);
  const inserted = insertPage(document, {
    ...reference,
    background: resolveExpressionColor(surface, colors, colors.paper!),
    elementIds: [],
    id: pageId,
    name: `Slide ${document.pageIds.length + 1}`,
    notes: '',
  }, { layout: layoutId, surface }, [], index);
  return { document: applyExpressionLayout(inserted, pageId, layoutId, identity), pageId };
}

export function expressionFormatsFor(kind: ExpressionToolKind) {
  return expressionFormats(kind);
}
