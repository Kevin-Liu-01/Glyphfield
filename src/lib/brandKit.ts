import {
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandFontAsset,
  type BrandIdentity,
  type BrandTypography,
} from './brandIdentity';
import { auditBrandHealth, brandContrastResults } from './brandHealth';
import {
  BRAND_ROLE_TYPE_STEP,
  brandCssVariables,
  brandDesignTokens,
  brandTailwindTheme,
  brandTokenName,
  brandTypeScale,
} from './brandTokens';
import { normalizeHex } from './color';
import { createStoredZip, type ZipEntry } from './zipStore';

/**
 * Brand kit export: the token files from brandTokens.ts (DTCG JSON, CSS custom
 * properties, Tailwind CSS v4 `@theme`), a `brand.md` written for coding agents,
 * the logo pack, licensed font files, and one store-only ZIP holding all of them.
 */
export const BRAND_KIT_FORMATS = ['zip', 'dtcg', 'css', 'tailwind', 'markdown', 'logos'] as const;
export type BrandKitFormat = (typeof BRAND_KIT_FORMATS)[number];

export const BRAND_KIT_FILE_NAMES: Record<Exclude<BrandKitFormat, 'logos' | 'zip'>, string> = {
  css: 'tokens/brand.css',
  dtcg: 'tokens/tokens.json',
  markdown: 'brand.md',
  tailwind: 'tokens/tailwind.css',
};

const ROLES: readonly BrandTypography['role'][] = ['Display', 'Body', 'Accent', 'Code'];

export function brandKitSlug(identity: BrandIdentity): string {
  return identity.name
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'brand';
}

const OPEN_FONT_LICENSE = /\b(?:OFL|SIL Open Font|Apache|MIT|CC0|Ubuntu Font)\b/i;

/** Font files the kit may include: uploaded by the brand owner, or under an open font license. */
export function brandKitIncludedFonts(identity: BrandIdentity): BrandFontAsset[] {
  const used = new Set(identity.typography.map(({ fontId }) => fontId));
  return brandFontAssets(identity).filter((font) => used.has(font.id)
    && (font.path.startsWith('data:') || OPEN_FONT_LICENSE.test(font.license ?? '')));
}

function fontFileName(font: BrandFontAsset): string {
  const extension = font.format === 'opentype' ? 'otf' : font.format === 'truetype' ? 'ttf' : font.format;
  const base = font.fileName.replace(/\.(otf|ttf|woff2?)$/i, '').replace(/[^A-Za-z0-9._-]+/g, '-') || font.id;
  return `fonts/${base}.${extension}`;
}

/** @font-face rules pointing at the kit's fonts/ folder, relative to tokens/. */
export function brandKitFontFaces(identity: BrandIdentity): string[] {
  const included = new Set(brandKitIncludedFonts(identity).map(({ id }) => id));
  const used = new Set(identity.typography.map(({ fontId }) => fontId));
  return brandFontAssets(identity).filter((font) => used.has(font.id)).map((font) => {
    const weight = font.weightMin !== undefined && font.weightMax !== undefined ? `${font.weightMin} ${font.weightMax}` : String(font.weight);
    const rule = `@font-face {\n  font-family: ${JSON.stringify(font.family)};\n  src: url(${JSON.stringify(`../${fontFileName(font)}`)}) format(${JSON.stringify(font.format)});\n  font-style: ${font.style};\n  font-weight: ${weight};\n  font-display: swap;\n}`;
    return included.has(font.id)
      ? rule
      : `/* ${font.label} is not included: kits package only uploaded or open-licensed fonts. Add your licensed copy at ${fontFileName(font)}. */\n${rule}`;
  });
}

function table(headings: readonly string[], rows: readonly (readonly string[])[]): string {
  const escape = (value: string) => value.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
  return [
    `| ${headings.join(' | ')} |`,
    `| ${headings.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escape).join(' | ')} |`),
  ].join('\n');
}

function bullets(values: readonly string[]): string {
  return values.filter((value) => value.trim()).map((value) => `- ${value}`).join('\n');
}

function logoAssets(identity: BrandIdentity) {
  return identity.assets.filter(({ type }) => type === 'logo');
}

function extensionFor(path: string): string {
  const mime = path.match(/^data:([^;,]+)/)?.[1];
  if (mime) {
    if (mime === 'image/svg+xml') return 'svg';
    if (mime === 'image/jpeg') return 'jpg';
    return mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin';
  }
  return path.split(/[?#]/)[0]!.split('.').pop()?.toLocaleLowerCase() || 'bin';
}

export function brandLogoFileName(asset: { id: string; path: string }): string {
  return `logos/${brandTokenName(asset.id)}.${extensionFor(asset.path)}`;
}

function rulesSection(identity: BrandIdentity): string[] {
  return [
    '## Rules for every change',
    bullets([
      'Use the tokens in `tokens/brand.css` (or `tokens/tailwind.css`) instead of raw hex values, font names or pixel sizes.',
      'Text and backgrounds use the approved pairs below; never place text on a pair that fails WCAG AA.',
      ...(identity.colors.some((color) => typeof color.proportion === 'number')
        ? ['Keep the palette in proportion: the dominant field stays dominant and the accent stays rare.']
        : []),
      'Use only the logo files in `logos/`; never redraw, recolor, stretch or add effects to a mark.',
      ...identity.graphicSystem.rules,
      ...identity.dossier.prohibited.map((rule) => (/^(no|never|do not|don't)\b/i.test(rule) ? rule : `Avoid: ${rule}`)),
    ]),
  ];
}

function voiceSection(identity: BrandIdentity): string[] {
  const examples = identity.voice.examples ?? [];
  return [
    '## Voice and copy',
    identity.voice.principles.length ? `Principles: ${identity.voice.principles.join(' · ')}.` : '',
    identity.strategy.personality.length ? `Personality: ${identity.strategy.personality.join(', ')}.` : '',
    identity.voice.phrases.length ? `Approved phrases:\n\n${bullets(identity.voice.phrases.map((phrase) => `“${phrase}”`))}` : '',
    identity.voice.avoid.length ? `Avoid:\n\n${bullets(identity.voice.avoid)}` : '',
    examples.length ? table(['Context', 'Write', 'Avoid'], examples.map((example) => [example.context, example.write, example.avoid || '—'])) : '',
  ];
}

function colorSection(identity: BrandIdentity): string[] {
  const contrast = brandContrastResults(identity);
  return [
    '## Color',
    table(['Token', 'Hex', 'Name', 'Role', 'Share'], identity.colors.map((color) => [
      `\`--brand-color-${color.id}\``,
      `\`${normalizeHex(color.hex)}\``,
      color.name,
      color.role,
      typeof color.proportion === 'number' ? `${color.proportion}%` : '—',
    ])),
    contrast.length ? `Approved text pairs:\n\n${table(['Foreground', 'Background', 'Use', 'Ratio', 'WCAG'], contrast.map((pair) => [
      pair.foreground,
      pair.background,
      pair.usage,
      `${pair.ratio.toFixed(2)}:1`,
      pair.passes ? `${pair.level} pass` : `${pair.level} FAIL`,
    ]))}` : '',
    identity.dossier.color,
  ];
}

function typographySection(identity: BrandIdentity): string[] {
  const scale = brandTypeScale(identity);
  const included = new Set(brandKitIncludedFonts(identity).map(({ id }) => id));
  const fonts = brandFontAssets(identity).filter((font) => identity.typography.some(({ fontId }) => fontId === font.id));
  const fontLine = (font: BrandFontAsset) => `${font.label} (${font.format})${font.license ? ` — ${font.license}` : ''}${included.has(font.id) ? ` → \`${fontFileName(font)}\`` : ' — not included; use your licensed copy'}`;
  return [
    '## Typography',
    table(['Role', 'Family', 'Weight', 'Line height', 'Tracking', 'Size token', 'Use'], ROLES.map((role) => {
      const typography = brandTypographyRole(identity, role);
      return [
        role,
        brandTypographyFamily(identity, role),
        String(typography.weight ?? 400),
        String(typography.lineHeight ?? 1.5),
        `${typography.letterSpacing ?? 0}px`,
        `\`--brand-text-${BRAND_ROLE_TYPE_STEP[role]}\``,
        typography.usage,
      ];
    })),
    `Type scale: ${identity.typeScale?.basePx ?? 16}px base × ${identity.typeScale?.ratio ?? 1.25} — ${scale.map(({ name, px }) => `${name} ${px}px`).join(', ')}.`,
    fonts.length ? `Font files:\n\n${bullets(fonts.map(fontLine))}` : '',
    identity.dossier.typography,
  ];
}

function logoSection(identity: BrandIdentity): string[] {
  const surfaceLabel = (surface: string) => (surface === 'light' ? 'light surfaces' : surface === 'dark' ? 'dark surfaces' : 'any surface');
  return [
    '## Logos',
    logoAssets(identity).length
      ? table(['File', 'Use on', 'Label'], logoAssets(identity).map((asset) => [`\`${brandLogoFileName(asset)}\``, surfaceLabel(asset.surface), asset.label]))
      : 'No logo files are defined yet.',
    identity.dossier.logo,
  ];
}

function deviceSection(identity: BrandIdentity): string[] {
  const { graphicSystem } = identity;
  return [
    '## Graphic device and imagery',
    graphicSystem.device ? `**${graphicSystem.device}.** ${graphicSystem.description}` : '',
    graphicSystem.composition,
    graphicSystem.imageDirection ? `Imagery: ${graphicSystem.imageDirection}` : '',
    identity.motion.length ? `Motion:\n\n${bullets(identity.motion.map((motion) => `${motion.name} — ${motion.durationMs}ms, \`${motion.curve}\`. ${motion.description}`))}` : '',
  ];
}

const CODE_SECTION = [
  '## Using the brand in code',
  '```css\n@import "./tokens/brand.css";\n\nbody {\n  background: var(--brand-color-paper);\n  color: var(--brand-color-ink);\n  font: var(--brand-font-body-weight) var(--brand-text-body) / var(--brand-font-body-leading) var(--brand-font-body);\n}\n\nh1 {\n  font-family: var(--brand-font-display);\n  font-size: var(--brand-text-display);\n  font-weight: var(--brand-font-display-weight);\n  line-height: var(--brand-font-display-leading);\n  letter-spacing: var(--brand-font-display-tracking);\n}\n```',
  'With Tailwind CSS v4, `@import "./tokens/tailwind.css";` after `@import "tailwindcss";` and use classes such as `bg-paper text-ink font-display text-display rounded-brand`.',
];

function strategySection(identity: BrandIdentity): string[] {
  return [
    '## Strategy',
    table(['', ''], [
      ['Challenge', identity.strategy.challenge],
      ['Central idea', identity.strategy.concept],
      ['Promise', identity.strategy.promise],
      ['Outcome', identity.strategy.outcome],
    ]),
    identity.strategy.pillars.length ? `Pillars:\n\n${bullets(identity.strategy.pillars)}` : '',
    '## Products, audiences and proof',
    identity.products.length ? `Products: ${identity.products.join(', ')}.` : '',
    identity.audiences.length ? `Audiences: ${identity.audiences.join(', ')}.` : '',
    identity.proof.length ? `Proof (use only as published): ${identity.proof.join(', ')}.` : '',
    identity.applications.length ? `## Applications\n\n${table(['Application', 'Format', 'Intent'], identity.applications.map((item) => [item.name, item.format, item.description]))}` : '',
  ];
}

const CHECKLIST_SECTION = [
  '## Before you ship',
  bullets([
    'Colors come from tokens and every text pair passes WCAG AA.',
    'Headlines use the Display role; body copy uses the Body role at the body step or larger.',
    'Copy follows the voice principles and avoids the listed words.',
    'Logos are untouched files from `logos/` on the surface they were made for.',
    'Claims, metrics and customer names match the brand\'s published sources.',
  ]),
];

/** Guidelines for coding agents: how to use the brand in code and in copy. */
export function brandGuidelinesMarkdown(identity: BrandIdentity): string {
  const report = auditBrandHealth(identity);
  const sections = [
    `# ${identity.name} brand guidelines`,
    `> For coding agents and contributors. Exported by Glyphfield from project \`${identity.id}\`. Brand health ${report.score}/100 (${report.grade}). Tokens live in \`tokens/\`; logos in \`logos/\`.`,
    identity.tagline ? `**${identity.tagline}**` : '',
    identity.positioning,
    identity.mission ? `Mission: ${identity.mission}` : '',
    ...rulesSection(identity),
    ...voiceSection(identity),
    ...colorSection(identity),
    ...typographySection(identity),
    ...logoSection(identity),
    ...deviceSection(identity),
    ...CODE_SECTION,
    ...strategySection(identity),
    ...CHECKLIST_SECTION,
    identity.sourceNotes.length ? `## Sources\n\n${bullets(identity.sourceNotes)}` : '',
  ];
  return `${sections.filter((section) => section.trim()).join('\n\n')}\n`;
}

export type BrandKitFile = {
  bytes: Uint8Array;
  mimeType: string;
  name: string;
};

function textFile(name: string, mimeType: string, content: string): BrandKitFile {
  return { bytes: new TextEncoder().encode(content), mimeType, name };
}

export function brandKitTextFile(identity: BrandIdentity, format: Exclude<BrandKitFormat, 'logos' | 'zip'>): BrandKitFile {
  if (format === 'dtcg') return textFile(BRAND_KIT_FILE_NAMES.dtcg, 'application/json', `${JSON.stringify(brandDesignTokens(identity), null, 2)}\n`);
  const fontFaces = brandKitFontFaces(identity);
  if (format === 'css') return textFile(BRAND_KIT_FILE_NAMES.css, 'text/css', brandCssVariables(identity, { fontFaces }));
  if (format === 'tailwind') return textFile(BRAND_KIT_FILE_NAMES.tailwind, 'text/css', brandTailwindTheme(identity, { fontFaces }));
  return textFile(BRAND_KIT_FILE_NAMES.markdown, 'text/markdown', brandGuidelinesMarkdown(identity));
}

/** Decode a data: URL into bytes without a network request. */
export function dataUrlBytes(url: string): Uint8Array {
  const comma = url.indexOf(',');
  if (!url.startsWith('data:') || comma < 0) throw new TypeError('Expected a data: URL.');
  const metadata = url.slice(5, comma);
  const payload = url.slice(comma + 1);
  if (/;base64$/i.test(metadata)) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  return new TextEncoder().encode(decodeURIComponent(payload));
}

export type BrandKitFileLoader = (path: string) => Promise<Uint8Array>;

async function loadPath(path: string, load: BrandKitFileLoader): Promise<Uint8Array> {
  return path.startsWith('data:') ? dataUrlBytes(path) : load(path);
}

export async function brandLogoFiles(identity: BrandIdentity, load: BrandKitFileLoader): Promise<BrandKitFile[]> {
  const seen = new Set<string>();
  const files: BrandKitFile[] = [];
  for (const asset of logoAssets(identity)) {
    const name = brandLogoFileName(asset);
    if (seen.has(name)) continue;
    seen.add(name);
    files.push({ bytes: await loadPath(asset.path, load), mimeType: asset.path.match(/^data:([^;,]+)/)?.[1] ?? 'application/octet-stream', name });
  }
  return files;
}

/** Every kit file: brand.md, tokens, identity source, logos and includable fonts. */
export async function brandKitFiles(identity: BrandIdentity, load: BrandKitFileLoader): Promise<BrandKitFile[]> {
  const fonts = await Promise.all(brandKitIncludedFonts(identity).map(async (font) => ({
    bytes: await loadPath(font.path, load),
    mimeType: `font/${font.format === 'opentype' ? 'otf' : font.format === 'truetype' ? 'ttf' : font.format}`,
    name: fontFileName(font),
  })));
  const uniqueFonts = fonts.filter((font, index) => fonts.findIndex(({ name }) => name === font.name) === index);
  return [
    brandKitTextFile(identity, 'markdown'),
    brandKitTextFile(identity, 'dtcg'),
    brandKitTextFile(identity, 'css'),
    brandKitTextFile(identity, 'tailwind'),
    textFile('identity.json', 'application/json', `${JSON.stringify(identity, null, 2)}\n`),
    ...(await brandLogoFiles(identity, load)),
    ...uniqueFonts,
  ];
}

export function brandKitZip(identity: BrandIdentity, files: readonly BrandKitFile[], modified?: Date): Uint8Array {
  const folder = `${brandKitSlug(identity)}-brand-kit`;
  const entries: ZipEntry[] = files.map((file) => ({ bytes: file.bytes, name: `${folder}/${file.name}` }));
  return createStoredZip(entries, modified);
}
