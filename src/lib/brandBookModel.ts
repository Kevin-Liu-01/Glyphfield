/**
 * Brand book structure and edits: sections, one-idea pages, default copy from
 * the identity, layout variants, surfaces, images, and the versioned source.
 * Rendering lives in BrandBook.tsx; this module stays framework-free.
 */
import type { BrandIdentity } from './brandIdentity';
import { BRAND_SURFACE_TONES, brandVisualAssets, type BrandSurfaceTone } from './brandOutputKit';
import { brandSampleEvent, brandSamplePerson } from './brandContent';
import { getEmailLifecycleTemplate } from './emailLifecycle';

export const BOOK_SECTION_IDS = [
  'strategy',
  'logo',
  'colour',
  'typography',
  'device',
  'imagery',
  'voice',
  'applications',
  'motion',
] as const;

export type BookSectionId = (typeof BOOK_SECTION_IDS)[number];
export type BookGroupId = BookSectionId | 'intro' | 'closing';

export const BOOK_SECTION_NAMES: Record<BookGroupId, string> = {
  applications: 'Applications',
  closing: 'Closing',
  colour: 'Colour',
  device: 'Graphic device',
  imagery: 'Imagery',
  intro: 'Introduction',
  logo: 'Logo',
  motion: 'Motion',
  strategy: 'Strategy',
  typography: 'Typography',
  voice: 'Voice',
};

const BOOK_SECTION_SUMMARIES: Record<BookSectionId, string> = {
  applications: 'The system at work: grid, print, digital, social, and event surfaces.',
  colour: 'Palette, roles, proportion, and every approved pairing with its contrast.',
  device: 'The ownable graphic idea, how it is built, and how far it can flex.',
  imagery: 'What images show, how they are treated, and the approved library.',
  logo: 'The signature, its family, protected space, minimum sizes, and misuse.',
  motion: 'Timing, easing, and how the device behaves when it moves.',
  strategy: 'Why the brand exists, who it serves, and the idea that organizes it.',
  typography: 'Typefaces, pairing, the type scale, and the role of each style.',
  voice: 'How the brand sounds, with real lines to use and lines to avoid.',
};

/** Page layouts. The first variant is the default. */
export const BOOK_PAGE_VARIANTS = {
  applicationsDigital: ['web', 'email'],
  applicationsEvent: ['badge', 'backdrop'],
  applicationsGrid: ['twelve', 'six'],
  applicationsPrint: ['stationery', 'card'],
  applicationsSheet: ['grid', 'strip'],
  applicationsSocial: ['posts', 'stories'],
  closing: ['mark', 'statement'],
  colourPairings: ['matrix', 'cards'],
  colourPalette: ['tiles', 'bands'],
  colourProportion: ['bar', 'field'],
  colourTints: ['ramps', 'steps'],
  contents: ['list', 'columns'],
  cover: ['device', 'image', 'type'],
  deviceConstruction: ['grid', 'annotated'],
  deviceHero: ['full', 'split'],
  deviceIcons: ['grid', 'large'],
  deviceRules: ['split', 'stacked'],
  deviceVariations: ['triptych', 'pair'],
  foreword: ['letter', 'statement'],
  imageryDirection: ['split', 'full'],
  imageryLibrary: ['grid', 'feature'],
  imageryTreatment: ['compare', 'single'],
  logoClearspace: ['diagram', 'grid'],
  logoColorways: ['grid', 'row'],
  logoFamily: ['grid', 'stack'],
  logoMinimum: ['scale', 'table'],
  logoMisuse: ['grid', 'list'],
  logoPrimary: ['centered', 'offset'],
  motionPrinciples: ['curves', 'list'],
  motionSequence: ['frames', 'strip'],
  motionTokens: ['table', 'cards'],
  opener: ['numeral', 'device', 'image'],
  strategyAudience: ['grid', 'list'],
  strategyChallenge: ['flow', 'columns'],
  strategyMission: ['split', 'stacked'],
  strategyPillars: ['list', 'grid'],
  strategyPremise: ['statement', 'centered'],
  typeDisplay: ['specimen', 'glyphs'],
  typePairing: ['split', 'stacked'],
  typeRoles: ['table', 'cards'],
  typeScale: ['ladder', 'sample'],
  typeText: ['columns', 'single'],
  voiceDoDont: ['split', 'rows'],
  voiceMessaging: ['hierarchy', 'cards'],
  voicePrinciples: ['list', 'grid'],
  voiceSample: ['email', 'web'],
} as const satisfies Record<string, readonly string[]>;

export type BookPageKind = keyof typeof BOOK_PAGE_VARIANTS;

export const BOOK_VARIANT_LABELS: Record<string, string> = {
  annotated: 'Annotated', backdrop: 'Backdrop', badge: 'Badge', bands: 'Bands', bar: 'Bar', cards: 'Cards',
  card: 'Card', centered: 'Centered', columns: 'Columns', compare: 'Compare', curves: 'Curves', device: 'Device',
  diagram: 'Diagram', email: 'Email', feature: 'Feature', field: 'Field', flow: 'Flow', frames: 'Frames',
  full: 'Full bleed', glyphs: 'Glyphs', grid: 'Grid', hierarchy: 'Hierarchy', image: 'Image', large: 'Large',
  letter: 'Letter', list: 'List', mark: 'Mark', matrix: 'Matrix', numeral: 'Numeral', offset: 'Offset',
  pair: 'Pair', posts: 'Posts', ramps: 'Ramps', row: 'Row', rows: 'Rows', sample: 'Sample', scale: 'Scale',
  single: 'Single', six: 'Six columns', specimen: 'Specimen', split: 'Split', stack: 'Stack', stacked: 'Stacked',
  statement: 'Statement', stationery: 'Stationery', steps: 'Steps', stories: 'Stories', strip: 'Strip',
  table: 'Table', tiles: 'Tiles', triptych: 'Triptych', twelve: 'Twelve columns', type: 'Type', web: 'Web',
};

export type BookPageDefinition = {
  /** Default copy for every editable slot on the page. */
  copy: Record<string, string>;
  group: BookGroupId;
  id: string;
  /** True when the layout shows a swappable library image. */
  image: boolean;
  kind: BookPageKind;
  title: string;
  tone: BrandSurfaceTone;
};

type PageSeed = Omit<BookPageDefinition, 'group' | 'image'> & { image?: boolean };

function first(values: readonly unknown[] | undefined, fallback = ''): string {
  return values?.find((value): value is string => typeof value === 'string' && value.trim().length > 0) ?? fallback;
}

function at(values: readonly unknown[] | undefined, index: number, fallback = ''): string {
  const value = values?.[index];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function opener(section: BookSectionId, identity: BrandIdentity, tone: BrandSurfaceTone): PageSeed {
  return {
    copy: { summary: BOOK_SECTION_SUMMARIES[section], title: BOOK_SECTION_NAMES[section] },
    id: `${section}-opener`,
    image: true,
    kind: 'opener',
    title: BOOK_SECTION_NAMES[section],
    tone,
  };
}

/** Full-page accent, unless the brand keeps its accent to one element (GT: never a wash). */
function accentPageTone(identity: BrandIdentity): BrandSurfaceTone {
  return identity.artDirection?.preview === 'translation-frame' ? 'ink' : 'accent';
}

/** Dark-led identities open sections on their deep colour; light-led ones on paper. */
function openerTone(identity: BrandIdentity, index: number): BrandSurfaceTone {
  const preview = identity.artDirection?.preview;
  if (preview === 'economic-ledger' || preview === 'network-horizon' || preview === 'focus-window') return index % 3 === 1 ? 'accent' : 'paper';
  if (preview === 'translation-frame') return index % 2 === 0 ? 'ink' : 'paper';
  return index % 3 === 2 ? 'accent' : 'deep';
}

function strategyPages(identity: BrandIdentity): PageSeed[] {
  const strategy = identity.strategy;
  return [
    { copy: { aside: identity.positioning, statement: strategy?.concept ?? identity.tagline }, id: 'strategy-premise', kind: 'strategyPremise', title: 'Brand idea', tone: 'paper' },
    { copy: { challenge: strategy?.challenge ?? '', outcome: strategy?.outcome ?? '', promise: strategy?.promise ?? '' }, id: 'strategy-challenge', kind: 'strategyChallenge', title: 'Challenge, promise, outcome', tone: 'paper' },
    { copy: { mission: identity.mission, position: identity.positioning }, id: 'strategy-mission', kind: 'strategyMission', title: 'Mission and position', tone: 'muted' },
    { copy: { lead: `${identity.name} speaks to the people who build with it, buy it, and recommend it.` }, id: 'strategy-audience', kind: 'strategyAudience', title: 'Audience and personality', tone: 'paper' },
    { copy: { lead: 'Four commitments decide every brand choice. When two options look equally good, choose the one that serves these first.' }, id: 'strategy-pillars', kind: 'strategyPillars', title: 'Pillars and values', tone: 'paper' },
  ];
}

function logoPages(identity: BrandIdentity): PageSeed[] {
  return [
    { copy: { lead: identity.dossier?.logo ?? 'The mark is a signature, not a decoration. Give it room and keep it exact.' }, id: 'logo-primary', kind: 'logoPrimary', title: 'Primary mark', tone: 'paper' },
    { copy: { lead: 'Use the artwork files as supplied. Choose the mark for small or square spaces and the wordmark where there is room to read.' }, id: 'logo-family', kind: 'logoFamily', title: 'Logo family', tone: 'paper' },
    { copy: { lead: 'Keep a clear zone equal to half the mark height on every side. Nothing else enters it: no type, edges, or imagery.' }, id: 'logo-clearspace', kind: 'logoClearspace', title: 'Clear space', tone: 'muted' },
    { copy: { lead: 'Below these sizes the signature loses detail. Scale up rather than redraw.' }, id: 'logo-minimum', kind: 'logoMinimum', title: 'Minimum size', tone: 'paper' },
    { copy: { lead: 'The logo appears in its approved colours on approved surfaces only. Pick the version with the strongest contrast.' }, id: 'logo-colorways', kind: 'logoColorways', title: 'Colourways', tone: 'paper' },
    { copy: { lead: first(identity.dossier?.prohibited.filter((rule) => /logo|mark|wordmark|symbol/i.test(rule)), 'Never alter the artwork. Every change below weakens recognition.') }, id: 'logo-misuse', kind: 'logoMisuse', title: 'Misuse', tone: 'paper' },
  ];
}

function colourPages(identity: BrandIdentity): PageSeed[] {
  return [
    { copy: { lead: identity.dossier?.color ?? 'A small palette, used with discipline, is easier to recognise than a large one.' }, id: 'colour-palette', kind: 'colourPalette', title: 'Palette', tone: 'paper' },
    { copy: { lead: 'Most of every surface is the dominant colour. The accent appears rarely, so it always means something.' }, id: 'colour-proportion', kind: 'colourProportion', title: 'Proportion', tone: 'paper' },
    { copy: { lead: 'Every text pairing is measured against WCAG 2.2. Use AA pairs for body copy and reserve the rest for display sizes.' }, id: 'colour-pairings', kind: 'colourPairings', title: 'Pairings and contrast', tone: 'paper' },
    { copy: { lead: 'Tints extend the core colours for interface states and charts. Never use a tint as a new brand colour.' }, id: 'colour-tints', kind: 'colourTints', title: 'Tonal ranges', tone: 'muted' },
  ];
}

function typographyPages(identity: BrandIdentity): PageSeed[] {
  return [
    { copy: { lead: identity.typography?.find((font) => font.role === 'Display')?.usage ?? 'Large statements and headlines.', sample: identity.tagline }, id: 'type-display', kind: 'typeDisplay', title: 'Display typeface', tone: 'paper' },
    { copy: { lead: identity.typography?.find((font) => font.role === 'Body')?.usage ?? 'Reading, interface, and explanation.', sample: identity.positioning || identity.mission }, id: 'type-text', kind: 'typeText', title: 'Text typeface', tone: 'paper' },
    { copy: { body: identity.positioning, headline: identity.strategy?.promise ?? identity.tagline }, id: 'type-pairing', kind: 'typePairing', title: 'Pairing', tone: 'muted' },
    { copy: { lead: 'One modular scale (1.333, perfect fourth) from a 16 px base. Tight leading for display, generous leading for text.' }, id: 'type-scale', kind: 'typeScale', title: 'Type scale', tone: 'paper' },
    { copy: { lead: identity.dossier?.typography ?? 'Each role has one job. Do not substitute faces between roles.' }, id: 'type-roles', kind: 'typeRoles', title: 'Roles', tone: 'paper' },
  ];
}

function devicePages(identity: BrandIdentity): PageSeed[] {
  const graphic = identity.graphicSystem;
  return [
    { copy: { body: graphic?.description ?? '', title: graphic?.device ?? 'Graphic device' }, id: 'device-hero', kind: 'deviceHero', title: 'The device', tone: 'deep' },
    { copy: { lead: graphic?.composition ?? '' }, id: 'device-construction', kind: 'deviceConstruction', title: 'Construction', tone: 'paper' },
    { copy: { lead: identity.dossier?.graphicDevice ?? 'The device flexes in scale and crop while its idea stays intact.' }, id: 'device-variations', kind: 'deviceVariations', title: 'Variations', tone: 'paper' },
    { copy: { lead: 'Icons share one stroke, one grid, and one corner radius with the rest of the system.' }, id: 'device-icons', kind: 'deviceIcons', title: 'Icon system', tone: 'muted' },
    { copy: { lead: 'Rules that keep the device ownable.' }, id: 'device-rules', kind: 'deviceRules', title: 'Device rules', tone: 'paper' },
  ];
}

function imageryPages(identity: BrandIdentity): PageSeed[] {
  return [
    { copy: { body: identity.dossier?.imagery ?? '', title: identity.graphicSystem?.imageDirection ?? '' }, id: 'imagery-direction', image: true, kind: 'imageryDirection', title: 'Image direction', tone: 'paper' },
    { copy: { lead: 'Approved library images. Use them as supplied; crop for composition, never for decoration.' }, id: 'imagery-library', image: true, kind: 'imageryLibrary', title: 'Library', tone: 'paper' },
    { copy: { lead: identity.style?.imageTreatment === 'natural' ? 'Images keep their natural colour. Correct exposure and white balance; never tint.' : `Images use the ${identity.style?.imageTreatment} treatment so photography sits inside the palette.` }, id: 'imagery-treatment', image: true, kind: 'imageryTreatment', title: 'Treatment', tone: 'muted' },
  ];
}

/** Three distinct levels: when the promise or a phrase repeats the tagline, step to the next line. */
function messagingCopy(identity: BrandIdentity): Record<string, string> {
  const tagline = identity.tagline;
  const candidates = [identity.strategy?.promise, identity.strategy?.concept, identity.positioning].filter((value): value is string => Boolean(value?.trim()));
  const promise = candidates.find((value) => value !== tagline) ?? '';
  const phrase = (identity.voice?.phrases ?? []).find((value) => value !== tagline && value !== promise) ?? identity.mission ?? '';
  return { phrase, promise, tagline };
}

function voicePages(identity: BrandIdentity): PageSeed[] {
  const welcome = getEmailLifecycleTemplate('welcome-email', identity);
  return [
    { copy: { lead: identity.dossier?.personality ?? 'How the brand sounds when it is at its best.' }, id: 'voice-principles', kind: 'voicePrinciples', title: 'Voice principles', tone: 'paper' },
    { copy: { lead: 'Real lines in real places. Write the left column; the right column is the version to leave out.' }, id: 'voice-dodont', kind: 'voiceDoDont', title: 'Do and don’t', tone: 'paper' },
    { copy: messagingCopy(identity), id: 'voice-messaging', kind: 'voiceMessaging', title: 'Messaging hierarchy', tone: 'muted' },
    { copy: { body: welcome?.body ?? identity.positioning, cta: welcome?.cta ?? 'Get started', subject: welcome?.subject ?? `Welcome to ${identity.name}` }, id: 'voice-sample', kind: 'voiceSample', title: 'Voice in use', tone: 'paper' },
  ];
}

function applicationPages(identity: BrandIdentity): PageSeed[] {
  return [
    { copy: { lead: identity.dossier?.layout ?? 'A twelve-column grid with generous margins aligns every surface.' }, id: 'applications-grid', kind: 'applicationsGrid', title: 'Layout grid', tone: 'paper' },
    { copy: { name: brandSamplePerson(identity).name, role: brandSamplePerson(identity).role }, id: 'applications-print', kind: 'applicationsPrint', title: 'Stationery', tone: 'muted' },
    { copy: { body: identity.positioning, headline: identity.tagline }, id: 'applications-digital', image: true, kind: 'applicationsDigital', title: 'Digital', tone: 'paper' },
    { copy: { headline: at(identity.voice?.phrases, 1, identity.tagline) }, id: 'applications-social', image: true, kind: 'applicationsSocial', title: 'Social', tone: 'paper' },
    { copy: { event: brandSampleEvent(identity).name, name: brandSamplePerson(identity).name }, id: 'applications-event', kind: 'applicationsEvent', title: 'Events', tone: 'muted' },
    { copy: { lead: 'The applications in this book, side by side.' }, id: 'applications-sheet', image: true, kind: 'applicationsSheet', title: 'Identity in use', tone: 'deep' },
  ];
}

function motionPages(identity: BrandIdentity): PageSeed[] {
  return [
    { copy: { lead: identity.dossier?.motion ?? 'Motion clarifies change. It never decorates.' }, id: 'motion-principles', kind: 'motionPrinciples', title: 'Motion principles', tone: 'paper' },
    { copy: { lead: 'Use these tokens in code and in edit. Do not invent new durations.' }, id: 'motion-tokens', kind: 'motionTokens', title: 'Motion tokens', tone: 'paper' },
    { copy: { lead: 'The device in five frames.' }, id: 'motion-sequence', kind: 'motionSequence', title: 'Device in motion', tone: 'deep' },
  ];
}

const SECTION_PAGES: Record<BookSectionId, (identity: BrandIdentity) => PageSeed[]> = {
  applications: applicationPages,
  colour: colourPages,
  device: devicePages,
  imagery: imageryPages,
  logo: logoPages,
  motion: motionPages,
  strategy: strategyPages,
  typography: typographyPages,
  voice: voicePages,
};

function withGroup(group: BookGroupId, page: PageSeed): BookPageDefinition {
  return { ...page, group, image: page.image ?? false };
}

/** Every page of the default book for an identity, grouped and in order. */
export function bookPageDefinitions(identity: BrandIdentity): Record<BookGroupId, BookPageDefinition[]> {
  const sections = Object.fromEntries(BOOK_SECTION_IDS.map((section, index) => [
    section,
    [opener(section, identity, openerTone(identity, index)), ...SECTION_PAGES[section](identity)].map((page) => withGroup(section, page)),
  ])) as Record<BookSectionId, BookPageDefinition[]>;
  return {
    ...sections,
    closing: [withGroup('closing', { copy: { statement: identity.tagline }, id: 'closing', kind: 'closing', title: 'Closing', tone: accentPageTone(identity) })],
    intro: [
      withGroup('intro', { copy: { subtitle: identity.strategy?.concept ?? identity.description, title: identity.tagline }, id: 'cover', image: true, kind: 'cover', title: 'Cover', tone: 'deep' }),
      withGroup('intro', { copy: { title: 'Contents' }, id: 'contents', kind: 'contents', title: 'Contents', tone: 'paper' }),
      withGroup('intro', { copy: { body: `These guidelines describe the ideas and repeatable choices that make ${identity.name} recognisable. Use them as a shared standard, not a collection of decoration. When a situation is not covered here, choose the option that is simplest and closest to the brand idea.`, statement: identity.description }, id: 'foreword', kind: 'foreword', title: 'Using this book', tone: accentPageTone(identity) }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Overrides and resolution
// ---------------------------------------------------------------------------

export type BookPageOverride = {
  assetId?: string;
  copy?: Record<string, string>;
  hidden?: boolean;
  tone?: BrandSurfaceTone;
  variant?: string;
};

export type BookOverrides = {
  pages?: Record<string, BookPageOverride>;
  sectionOrder?: BookSectionId[];
  sections?: Partial<Record<BookSectionId, { hidden?: boolean }>>;
};

export type BookPage = BookPageDefinition & {
  assetId: string;
  hidden: boolean;
  variant: string;
  variants: readonly string[];
};

export type BookSection = {
  hidden: boolean;
  id: BookGroupId;
  name: string;
  pages: BookPage[];
};

export function bookImageAssetIds(identity: BrandIdentity): string[] {
  return brandVisualAssets(identity).map(({ id }) => id);
}

function defaultPageAsset(page: BookPageDefinition, index: number, images: readonly string[]): string {
  if (!page.image || images.length === 0) return '';
  return images[index % images.length]!;
}

function resolvePage(page: BookPageDefinition, override: BookPageOverride | undefined, index: number, images: readonly string[]): BookPage {
  const variants = BOOK_PAGE_VARIANTS[page.kind] as readonly string[];
  return {
    ...page,
    assetId: override?.assetId ?? defaultPageAsset(page, index, images),
    copy: { ...page.copy, ...override?.copy },
    hidden: override?.hidden ?? false,
    tone: override?.tone ?? page.tone,
    variant: override?.variant && variants.includes(override.variant) ? override.variant : variants[0]!,
    variants,
  };
}

export function sectionOrder(overrides: BookOverrides | undefined): BookSectionId[] {
  const order = (overrides?.sectionOrder ?? []).filter((id) => BOOK_SECTION_IDS.includes(id));
  return [...new Set([...order, ...BOOK_SECTION_IDS])];
}

export function resolveBook(identity: BrandIdentity, overrides: BookOverrides | undefined): BookSection[] {
  const definitions = bookPageDefinitions(identity);
  const images = bookImageAssetIds(identity);
  let imageIndex = 0;
  const resolveGroup = (id: BookGroupId, hidden: boolean): BookSection => ({
    hidden,
    id,
    name: BOOK_SECTION_NAMES[id],
    pages: definitions[id].map((page) => {
      const resolved = resolvePage(page, overrides?.pages?.[page.id], page.image ? imageIndex : 0, images);
      if (page.image) imageIndex += 1;
      return resolved;
    }),
  });
  return [
    resolveGroup('intro', false),
    ...sectionOrder(overrides).map((id) => resolveGroup(id, overrides?.sections?.[id]?.hidden ?? false)),
    resolveGroup('closing', false),
  ];
}

/** Pages that print and receive folios, in reading order. */
export function visibleBookPages(sections: readonly BookSection[]): Array<BookPage & { folio: number; section: BookSection }> {
  let folio = 0;
  return sections.flatMap((section) => (section.hidden ? [] : section.pages.flatMap((page) => {
    if (page.hidden) return [];
    folio += 1;
    return [{ ...page, folio, section }];
  })));
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export const BOOK_SOURCE_SCHEMA = 'glyphfield.brand-book';
export const BOOK_SOURCE_VERSION = 1;
const MAX_COPY = 1200;

export function bookSource(identity: BrandIdentity, overrides: BookOverrides | undefined) {
  return {
    schema: BOOK_SOURCE_SCHEMA,
    sections: resolveBook(identity, overrides).map((section) => ({
      hidden: section.hidden,
      id: section.id,
      name: section.name,
      pages: section.pages.map((page) => ({
        assetId: page.assetId,
        copy: page.copy,
        hidden: page.hidden,
        id: page.id,
        imageSlot: page.image,
        title: page.title,
        tone: page.tone,
        variant: page.variant,
        variants: page.variants,
      })),
    })),
    version: BOOK_SOURCE_VERSION,
  };
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function parsePageCopy(value: unknown, page: BookPageDefinition, path: string): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  const copy = record(value, path);
  const next: Record<string, string> = {};
  for (const [slot, text] of Object.entries(copy)) {
    if (!(slot in page.copy)) throw new RangeError(`${path}.${slot} is not an editable slot; use ${Object.keys(page.copy).join(', ')}.`);
    if (typeof text !== 'string') throw new TypeError(`${path}.${slot} must be a string.`);
    if (text.length > MAX_COPY) throw new RangeError(`${path}.${slot} must be at most ${MAX_COPY} characters.`);
    if (text !== page.copy[slot]) next[slot] = text;
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function parseHidden(value: unknown, path: string): true | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new TypeError(`${path} must be a Boolean.`);
  return value || undefined;
}

function parseVariant(value: unknown, defaults: BookPage, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (!defaults.variants.includes(String(value))) throw new RangeError(`${path} must be one of ${defaults.variants.join(', ')}.`);
  return value !== defaults.variants[0] ? String(value) : undefined;
}

function parseTone(value: unknown, page: BookPageDefinition, path: string): BrandSurfaceTone | undefined {
  if (value === undefined) return undefined;
  if (!BRAND_SURFACE_TONES.includes(value as BrandSurfaceTone)) throw new RangeError(`${path} must be one of ${BRAND_SURFACE_TONES.join(', ')}.`);
  return value !== page.tone ? value as BrandSurfaceTone : undefined;
}

function parseAsset(value: unknown, page: BookPageDefinition, defaults: BookPage, images: readonly string[], path: string): string | undefined {
  if (value === undefined || !page.image) return undefined;
  if (value !== '' && !images.includes(String(value))) throw new RangeError(`${path} must be an identity image asset ID.`);
  return value !== defaults.assetId ? String(value) : undefined;
}

function parsePage(value: Record<string, unknown>, page: BookPageDefinition, defaults: BookPage, images: readonly string[], path: string): BookPageOverride | undefined {
  const override: BookPageOverride = {
    assetId: parseAsset(value.assetId, page, defaults, images, `${path}.assetId`),
    copy: parsePageCopy(value.copy, page, `${path}.copy`),
    hidden: parseHidden(value.hidden, `${path}.hidden`),
    tone: parseTone(value.tone, page, `${path}.tone`),
    variant: parseVariant(value.variant, defaults, `${path}.variant`),
  };
  const entries = Object.entries(override).filter(([, entry]) => entry !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) as BookPageOverride : undefined;
}

type BookParseContext = {
  images: readonly string[];
  next: Required<Pick<BookOverrides, 'pages' | 'sections'>>;
  pagesById: Map<string, BookPageDefinition>;
  resolvedById: Map<string, BookPage>;
};

function parseSectionVisibility(section: Record<string, unknown>, id: BookSectionId, path: string, context: BookParseContext) {
  if (section.hidden === undefined) return;
  if (typeof section.hidden !== 'boolean') throw new TypeError(`${path}.hidden must be a Boolean.`);
  if (section.hidden) context.next.sections[id] = { hidden: true };
  else delete context.next.sections[id];
}

function parseSectionPages(pages: unknown, id: BookGroupId, path: string, context: BookParseContext) {
  if (pages === undefined) return;
  if (!Array.isArray(pages)) throw new TypeError(`${path}.pages must be an array.`);
  pages.forEach((pageEntry, pageIndex) => {
    const pagePath = `${path}.pages.${pageIndex}`;
    const pageValue = record(pageEntry, pagePath);
    const page = context.pagesById.get(String(pageValue.id));
    if (!page || page.group !== id) throw new RangeError(`${pagePath}.id is not a page of section ${id}.`);
    const override = parsePage(pageValue, page, context.resolvedById.get(page.id)!, context.images, pagePath);
    if (override) context.next.pages[page.id] = override;
    else delete context.next.pages[page.id];
  });
}

/**
 * Validate a book source document into normalized overrides. Sections listed
 * set the order of the nine reorderable sections; omitted sections and pages
 * keep their current settings.
 */
export function parseBookSource(identity: BrandIdentity, value: unknown, previous: BookOverrides | undefined): BookOverrides {
  const source = record(value, 'source');
  if (source.version !== undefined && source.version !== BOOK_SOURCE_VERSION) throw new RangeError(`Brand book source version ${String(source.version)} is not supported.`);
  if (source.sections === undefined) return previous ?? {};
  if (!Array.isArray(source.sections)) throw new TypeError('sections must be an array.');
  const context: BookParseContext = {
    images: bookImageAssetIds(identity),
    next: { pages: { ...previous?.pages }, sections: { ...previous?.sections } },
    pagesById: new Map(Object.values(bookPageDefinitions(identity)).flat().map((page) => [page.id, page])),
    resolvedById: new Map(resolveBook(identity, undefined).flatMap((section) => section.pages).map((page) => [page.id, page])),
  };
  const order: BookSectionId[] = [];
  source.sections.forEach((entry, sectionIndex) => {
    const path = `sections.${sectionIndex}`;
    const section = record(entry, path);
    const id = String(section.id) as BookGroupId;
    if (!(id in BOOK_SECTION_NAMES)) throw new RangeError(`${path}.id must be one of intro, ${BOOK_SECTION_IDS.join(', ')}, closing.`);
    if (BOOK_SECTION_IDS.includes(id as BookSectionId)) {
      order.push(id as BookSectionId);
      parseSectionVisibility(section, id as BookSectionId, path, context);
    }
    parseSectionPages(section.pages, id, path, context);
  });
  const next: BookOverrides = { ...context.next };
  const completeOrder = [...order, ...sectionOrder(previous).filter((id) => !order.includes(id))];
  if (completeOrder.join() !== BOOK_SECTION_IDS.join()) next.sectionOrder = completeOrder;
  if (Object.keys(context.next.pages).length === 0) delete next.pages;
  if (Object.keys(context.next.sections).length === 0) delete next.sections;
  return next;
}

/** Keep only persisted edits that still validate against the identity. */
export function sanitizeBookOverrides(identity: BrandIdentity, value: unknown): BookOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    const resolved = resolveBook(identity, value as BookOverrides);
    return parseBookSource(identity, { sections: resolved.map((section) => ({ hidden: section.hidden, id: section.id, pages: section.pages })), version: BOOK_SOURCE_VERSION }, undefined);
  } catch {
    return {};
  }
}

export function updateBookPage(identity: BrandIdentity, overrides: BookOverrides, pageId: string, patch: BookPageOverride): BookOverrides {
  const current = overrides.pages?.[pageId] ?? {};
  const merged: BookPageOverride = { ...current, ...patch, copy: patch.copy ? { ...current.copy, ...patch.copy } : current.copy };
  return sanitizeBookOverrides(identity, { ...overrides, pages: { ...overrides.pages, [pageId]: merged } });
}

export function resetBookPage(overrides: BookOverrides, pageId: string): BookOverrides {
  if (!overrides.pages?.[pageId]) return overrides;
  const pages = { ...overrides.pages };
  delete pages[pageId];
  return { ...overrides, pages };
}

export function updateBookSection(overrides: BookOverrides, sectionId: BookSectionId, patch: { hidden?: boolean; move?: -1 | 1 }): BookOverrides {
  const next: BookOverrides = { ...overrides, sections: { ...overrides.sections } };
  if (patch.hidden !== undefined) {
    if (patch.hidden) next.sections![sectionId] = { hidden: true };
    else delete next.sections![sectionId];
  }
  if (patch.move) {
    const order = sectionOrder(overrides);
    const index = order.indexOf(sectionId);
    const target = index + patch.move;
    if (target >= 0 && target < order.length) {
      order.splice(index, 1);
      order.splice(target, 0, sectionId);
      next.sectionOrder = order;
    }
  }
  if (next.sectionOrder?.join() === BOOK_SECTION_IDS.join()) delete next.sectionOrder;
  if (Object.keys(next.sections!).length === 0) delete next.sections;
  return next;
}
