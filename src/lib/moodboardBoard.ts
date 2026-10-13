/**
 * Editable moodboard model: the tiles on each board, their per-identity recipe,
 * a 12-column justified row layout, and the versioned source format.
 */
import type { BrandArtDirection, BrandIdentity } from './brandIdentity';
import {
  BRAND_SURFACE_TONES,
  brandVisualAssets,
  type BrandSurfaceTone,
} from './brandOutputKit';
import {
  brandCustomers,
  brandMessaging,
  brandProducts,
  brandProofStatements,
  brandSampleEvent,
  brandSamplePerson,
} from './brandContent';
import { getEmailLifecycleTemplate } from './emailLifecycle';
import {
  MOODBOARD_COMPOSITIONS,
  moodboardAssets,
  type MoodboardComposition,
} from './moodboard';

export const MOODBOARD_TILE_VARIANTS = {
  badge: ['lanyard', 'card'],
  billboard: ['device', 'image'],
  card: ['pair', 'front'],
  cover: ['device', 'image', 'type'],
  device: ['field', 'construction', 'crops'],
  email: ['message', 'inbox'],
  imagery: ['single', 'pair', 'triptych'],
  logo: ['pair', 'single', 'clearspace'],
  motion: ['curve', 'frames'],
  palette: ['proportion', 'swatches', 'pairs', 'tints'],
  poster: ['device', 'image', 'type'],
  proof: ['figures', 'list'],
  social: ['post', 'story'],
  statement: ['concept', 'promise'],
  type: ['glyph', 'scale', 'phrases', 'pairing', 'charset'],
  voice: ['quote', 'dodont'],
  web: ['hero', 'product'],
} as const satisfies Record<string, readonly string[]>;

export type MoodboardTileKind = keyof typeof MOODBOARD_TILE_VARIANTS;

export const MOODBOARD_TILE_LABELS: Record<MoodboardTileKind, string> = {
  badge: 'Event badge',
  billboard: 'Billboard',
  card: 'Business card',
  cover: 'Key visual',
  device: 'Graphic device',
  email: 'Email',
  imagery: 'Imagery',
  logo: 'Logo',
  motion: 'Motion',
  palette: 'Colour',
  poster: 'Poster',
  proof: 'Proof',
  social: 'Social post',
  statement: 'Statement',
  type: 'Typography',
  voice: 'Voice',
  web: 'Website',
};

export const MOODBOARD_VARIANT_LABELS: Record<string, string> = {
  card: 'Card',
  charset: 'Character set',
  clearspace: 'Clear space',
  concept: 'Concept',
  construction: 'Construction',
  crops: 'Crops',
  curve: 'Curve',
  device: 'Device',
  dodont: 'Do and don’t',
  field: 'Field',
  figures: 'Figures',
  frames: 'Frames',
  front: 'Front',
  glyph: 'Glyph',
  hero: 'Hero',
  image: 'Image',
  inbox: 'Inbox',
  lanyard: 'Lanyard',
  list: 'List',
  message: 'Message',
  pair: 'Pair',
  pairing: 'Pairing',
  pairs: 'Contrast pairs',
  phrases: 'Phrases',
  post: 'Post',
  product: 'Product',
  promise: 'Promise',
  proportion: 'Proportion',
  quote: 'Quote',
  scale: 'Scale',
  single: 'Single',
  story: 'Story',
  swatches: 'Swatches',
  tints: 'Tints',
  triptych: 'Triptych',
  type: 'Type',
};

/** Kinds whose layout uses a swappable library image. */
export const MOODBOARD_IMAGE_KINDS: ReadonlySet<MoodboardTileKind> = new Set([
  'billboard', 'cover', 'imagery', 'poster', 'social', 'web',
]);

export const MOODBOARD_TILE_SPANS = [3, 4, 6, 8, 12] as const;
export type MoodboardTileSpan = (typeof MOODBOARD_TILE_SPANS)[number];

export const MOODBOARD_SPAN_LABELS: Record<MoodboardTileSpan, string> = {
  12: 'Full width · 12 columns',
  3: 'Quarter · 3 columns',
  4: 'Third · 4 columns',
  6: 'Half · 6 columns',
  8: 'Two thirds · 8 columns',
};

export type MoodboardTileCopy = { body: string; caption: string; headline: string };
export const MOODBOARD_COPY_FIELDS = ['headline', 'body', 'caption'] as const;
export type MoodboardCopyField = (typeof MOODBOARD_COPY_FIELDS)[number];

export type MoodboardTile = {
  assetId: string;
  copy: MoodboardTileCopy;
  hidden: boolean;
  id: string;
  kind: MoodboardTileKind;
  span: MoodboardTileSpan;
  tone: BrandSurfaceTone;
  variant: string;
};

export type MoodboardTileOverride = {
  assetId?: string;
  copy?: Partial<MoodboardTileCopy>;
  hidden?: boolean;
  span?: MoodboardTileSpan;
  tone?: BrandSurfaceTone;
  variant?: string;
};

export type MoodboardSurface = 'dark' | 'light';

export type MoodboardBoardOverride = {
  order?: string[];
  surface?: MoodboardSurface;
  tiles?: Record<string, MoodboardTileOverride>;
  title?: string;
};

export type MoodboardOverrides = Partial<Record<MoodboardComposition, MoodboardBoardOverride>>;

export type MoodboardBoard = {
  composition: MoodboardComposition;
  surface: MoodboardSurface;
  tiles: MoodboardTile[];
  title: string;
};

export const MOODBOARD_BOARD_TITLES: Record<MoodboardComposition, string> = {
  campaign: 'Launch campaign',
  catalog: 'Complete brand system',
  showcase: 'Brand showcase',
  specimen: 'Type and colour specimen',
  system: 'System review',
};

export const MOODBOARD_BOARD_SIZES: Record<MoodboardComposition, { height: number; width: number }> = {
  campaign: { height: 900, width: 1600 },
  catalog: { height: 2400, width: 1600 },
  showcase: { height: 900, width: 1600 },
  specimen: { height: 2000, width: 1600 },
  system: { height: 2000, width: 1600 },
};

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

type ToneRole = 'accent' | 'contrast' | 'feature' | 'quiet';

type TileTemplate = {
  kind: MoodboardTileKind;
  role: ToneRole | 'muted';
  span: MoodboardTileSpan;
  variant?: string;
};

type BoardRecipe = {
  coverVariant: 'device' | 'image' | 'type';
  /** Library asset IDs, in order of preference, for image slots. */
  imagery: readonly string[];
  surface: MoodboardSurface;
  tones: Record<ToneRole, BrandSurfaceTone>;
};

const RECIPES: Record<BrandArtDirection['moodboard'], BoardRecipe> = {
  'cinematic-field': {
    coverVariant: 'device',
    imagery: ['library-campaign', 'library-overview', 'library-atmosphere', 'library-interface', 'library-motion', 'library-hero'],
    surface: 'dark',
    tones: { accent: 'accent', contrast: 'deep', feature: 'ink', quiet: 'paper' },
  },
  'editorial-evidence': {
    coverVariant: 'image',
    imagery: ['library-campaign', 'library-editorial', 'library-detail', 'library-interface', 'library-overview', 'library-motion'],
    surface: 'light',
    tones: { accent: 'accent', contrast: 'deep', feature: 'paper', quiet: 'muted' },
  },
  'knowledge-system': {
    coverVariant: 'device',
    imagery: ['library-hero', 'library-editorial', 'library-workflow', 'library-detail', 'library-system', 'library-atmosphere'],
    surface: 'light',
    tones: { accent: 'accent', contrast: 'deep', feature: 'deep', quiet: 'paper' },
  },
  'modular-proof': {
    coverVariant: 'image',
    imagery: ['library-editorial', 'library-campaign', 'library-hero', 'library-detail', 'library-signal', 'library-overview'],
    surface: 'dark',
    tones: { accent: 'accent', contrast: 'ink', feature: 'ink', quiet: 'paper' },
  },
  'monochrome-language': {
    coverVariant: 'device',
    imagery: ['library-advance', 'library-constellation', 'library-overview', 'library-editorial', 'library-material', 'library-workflow'],
    surface: 'light',
    tones: { accent: 'muted', contrast: 'ink', feature: 'ink', quiet: 'paper' },
  },
  'network-atlas': {
    coverVariant: 'device',
    imagery: ['library-overview', 'library-system', 'library-workflow', 'library-editorial', 'library-hero', 'library-signal'],
    surface: 'light',
    tones: { accent: 'accent', contrast: 'deep', feature: 'paper', quiet: 'muted' },
  },
  'product-spectrum': {
    coverVariant: 'device',
    imagery: ['library-atmosphere', 'library-editorial', 'library-detail', 'library-hero', 'library-interface', 'library-material'],
    surface: 'light',
    tones: { accent: 'accent', contrast: 'ink', feature: 'deep', quiet: 'paper' },
  },
  'research-wall': {
    coverVariant: 'device',
    imagery: ['library-hero', 'library-system', 'library-signal', 'library-workflow', 'library-material', 'library-atmosphere'],
    surface: 'light',
    tones: { accent: 'accent', contrast: 'deep', feature: 'muted', quiet: 'paper' },
  },
  'utility-current': {
    coverVariant: 'device',
    imagery: ['library-overview', 'library-editorial', 'library-campaign', 'library-hero', 'library-system', 'library-interface'],
    surface: 'dark',
    tones: { accent: 'accent', contrast: 'ink', feature: 'deep', quiet: 'paper' },
  },
};

const BOARD_TEMPLATES: Record<MoodboardComposition, readonly TileTemplate[]> = {
  campaign: [
    { kind: 'cover', role: 'feature', span: 6 },
    { kind: 'billboard', role: 'quiet', span: 6, variant: 'device' },
    { kind: 'poster', role: 'quiet', span: 3, variant: 'type' },
    { kind: 'social', role: 'quiet', span: 3 },
    { kind: 'email', role: 'muted', span: 3 },
    { kind: 'badge', role: 'quiet', span: 3 },
    { kind: 'web', role: 'quiet', span: 8 },
    { kind: 'proof', role: 'contrast', span: 4 },
  ],
  catalog: [
    { kind: 'cover', role: 'feature', span: 4 },
    { kind: 'logo', role: 'quiet', span: 4, variant: 'pair' },
    { kind: 'type', role: 'contrast', span: 4, variant: 'glyph' },
    { kind: 'palette', role: 'quiet', span: 4, variant: 'proportion' },
    { kind: 'device', role: 'feature', span: 4, variant: 'construction' },
    { kind: 'imagery', role: 'quiet', span: 4, variant: 'triptych' },
    { kind: 'voice', role: 'accent', span: 4, variant: 'quote' },
    { kind: 'proof', role: 'contrast', span: 4 },
    { kind: 'poster', role: 'quiet', span: 4 },
    { kind: 'social', role: 'quiet', span: 4 },
    { kind: 'card', role: 'quiet', span: 4 },
    { kind: 'motion', role: 'quiet', span: 4 },
  ],
  showcase: [
    { kind: 'cover', role: 'feature', span: 8 },
    { kind: 'poster', role: 'quiet', span: 4 },
    { kind: 'type', role: 'contrast', span: 4, variant: 'glyph' },
    { kind: 'palette', role: 'quiet', span: 4, variant: 'proportion' },
    { kind: 'imagery', role: 'quiet', span: 4, variant: 'single' },
    { kind: 'social', role: 'quiet', span: 4 },
    { kind: 'voice', role: 'accent', span: 4, variant: 'quote' },
    { kind: 'card', role: 'quiet', span: 4 },
  ],
  specimen: [
    { kind: 'type', role: 'contrast', span: 8, variant: 'glyph' },
    { kind: 'type', role: 'quiet', span: 4, variant: 'pairing' },
    { kind: 'type', role: 'quiet', span: 12, variant: 'scale' },
    { kind: 'type', role: 'quiet', span: 6, variant: 'charset' },
    { kind: 'type', role: 'feature', span: 6, variant: 'phrases' },
    { kind: 'palette', role: 'quiet', span: 12, variant: 'proportion' },
    { kind: 'palette', role: 'quiet', span: 6, variant: 'pairs' },
    { kind: 'palette', role: 'quiet', span: 6, variant: 'tints' },
  ],
  system: [
    { kind: 'logo', role: 'quiet', span: 8, variant: 'pair' },
    { kind: 'statement', role: 'accent', span: 4 },
    { kind: 'type', role: 'quiet', span: 6, variant: 'scale' },
    { kind: 'palette', role: 'quiet', span: 6, variant: 'proportion' },
    { kind: 'device', role: 'feature', span: 4, variant: 'construction' },
    { kind: 'imagery', role: 'quiet', span: 8, variant: 'triptych' },
    { kind: 'voice', role: 'quiet', span: 6, variant: 'dodont' },
    { kind: 'motion', role: 'contrast', span: 6, variant: 'curve' },
    { kind: 'proof', role: 'contrast', span: 4 },
    { kind: 'card', role: 'quiet', span: 4 },
    { kind: 'web', role: 'quiet', span: 4 },
  ],
};

type Direction = BrandArtDirection['moodboard'];
const t = (kind: MoodboardTileKind, role: TileTemplate['role'], span: MoodboardTileSpan, variant?: string): TileTemplate => ({ kind, role, span, variant });

/**
 * Showcase and campaign boards follow each identity's art direction: hero
 * proportion, tile mix and which applications appear differ per direction, so
 * nine boards side by side never read as one template recoloured. Rows sum to
 * twelve columns.
 */
const DIRECTION_TEMPLATES: Partial<Record<Direction, Partial<Record<MoodboardComposition, readonly TileTemplate[]>>>> = {
  'cinematic-field': {
    campaign: [t('billboard', 'feature', 12, 'device'), t('poster', 'quiet', 4, 'type'), t('social', 'quiet', 4, 'story'), t('proof', 'contrast', 4), t('web', 'quiet', 8), t('badge', 'quiet', 4, 'lanyard')],
    showcase: [t('cover', 'feature', 8), t('proof', 'contrast', 4), t('billboard', 'quiet', 12, 'image'), t('type', 'contrast', 4, 'glyph'), t('social', 'quiet', 4, 'story'), t('motion', 'quiet', 4, 'curve')],
  },
  'editorial-evidence': {
    campaign: [t('billboard', 'quiet', 8, 'image'), t('proof', 'accent', 4), t('poster', 'quiet', 4, 'type'), t('social', 'quiet', 4), t('email', 'muted', 4), t('web', 'quiet', 12)],
    showcase: [t('proof', 'accent', 4), t('cover', 'feature', 8), t('web', 'quiet', 8), t('poster', 'quiet', 4, 'type'), t('type', 'contrast', 3, 'scale'), t('palette', 'quiet', 3, 'proportion'), t('card', 'quiet', 3, 'front'), t('social', 'quiet', 3)],
  },
  'knowledge-system': {
    campaign: [t('web', 'quiet', 8), t('cover', 'feature', 4), t('email', 'muted', 4), t('social', 'quiet', 4, 'story'), t('badge', 'quiet', 4), t('voice', 'accent', 6, 'dodont'), t('proof', 'contrast', 6)],
    showcase: [t('web', 'quiet', 8), t('cover', 'feature', 4), t('type', 'quiet', 4, 'pairing'), t('voice', 'quiet', 4, 'dodont'), t('imagery', 'quiet', 4, 'single'), t('email', 'muted', 6), t('palette', 'quiet', 6, 'proportion')],
  },
  'modular-proof': {
    campaign: [t('cover', 'feature', 8), t('poster', 'accent', 4, 'type'), t('imagery', 'quiet', 8, 'pair'), t('social', 'quiet', 4), t('billboard', 'quiet', 6, 'device'), t('badge', 'quiet', 3), t('card', 'quiet', 3)],
    showcase: [t('cover', 'feature', 8), t('poster', 'accent', 4, 'type'), t('statement', 'contrast', 4, 'promise'), t('imagery', 'quiet', 8, 'pair'), t('billboard', 'quiet', 6, 'device'), t('social', 'quiet', 3), t('proof', 'contrast', 3)],
  },
  'monochrome-language': {
    campaign: [t('cover', 'feature', 8), t('type', 'contrast', 4, 'phrases'), t('social', 'quiet', 4), t('poster', 'quiet', 4), t('badge', 'quiet', 4), t('web', 'quiet', 6), t('email', 'muted', 6)],
    showcase: [t('cover', 'feature', 6), t('type', 'contrast', 6, 'phrases'), t('imagery', 'quiet', 8, 'triptych'), t('statement', 'quiet', 4, 'concept'), t('web', 'quiet', 4), t('voice', 'accent', 4, 'quote'), t('card', 'quiet', 4)],
  },
  'network-atlas': {
    campaign: [t('cover', 'feature', 12), t('poster', 'quiet', 3), t('social', 'quiet', 3), t('email', 'muted', 3), t('badge', 'quiet', 3), t('web', 'quiet', 8), t('proof', 'contrast', 4)],
    showcase: [t('cover', 'feature', 12), t('proof', 'contrast', 4), t('device', 'quiet', 4, 'construction'), t('imagery', 'quiet', 4, 'single'), t('web', 'quiet', 6), t('badge', 'quiet', 3), t('palette', 'quiet', 3, 'proportion')],
  },
  'product-spectrum': {
    campaign: [t('cover', 'feature', 8), t('web', 'quiet', 4), t('poster', 'quiet', 4), t('social', 'quiet', 4, 'story'), t('email', 'muted', 4), t('billboard', 'quiet', 8, 'device'), t('proof', 'contrast', 4)],
    showcase: [t('cover', 'feature', 8), t('web', 'quiet', 4), t('poster', 'quiet', 4), t('imagery', 'quiet', 8, 'triptych'), t('proof', 'contrast', 4), t('type', 'contrast', 4, 'glyph'), t('card', 'quiet', 4)],
  },
  'research-wall': {
    campaign: [t('cover', 'feature', 6), t('imagery', 'quiet', 6, 'pair'), t('poster', 'quiet', 3, 'type'), t('social', 'quiet', 3), t('email', 'muted', 3), t('card', 'quiet', 3), t('web', 'quiet', 8), t('statement', 'accent', 4, 'promise')],
    showcase: [t('cover', 'feature', 6), t('imagery', 'quiet', 3, 'single'), t('statement', 'accent', 3, 'concept'), t('imagery', 'quiet', 8, 'triptych'), t('voice', 'quiet', 4, 'quote'), t('web', 'quiet', 4), t('email', 'muted', 4), t('card', 'quiet', 4)],
  },
  'utility-current': {
    campaign: [t('cover', 'feature', 12), t('web', 'quiet', 6), t('social', 'quiet', 3), t('poster', 'quiet', 3, 'type'), t('email', 'muted', 4), t('badge', 'quiet', 4), t('proof', 'contrast', 4)],
    showcase: [t('cover', 'feature', 12), t('web', 'quiet', 6), t('type', 'quiet', 6, 'scale'), t('social', 'quiet', 4), t('palette', 'quiet', 4, 'swatches'), t('card', 'quiet', 4)],
  },
};

function boardTemplate(identity: BrandIdentity, composition: MoodboardComposition): readonly TileTemplate[] {
  return DIRECTION_TEMPLATES[identity.artDirection?.moodboard]?.[composition] ?? BOARD_TEMPLATES[composition];
}

function recipeFor(identity: BrandIdentity): BoardRecipe {
  return RECIPES[identity.artDirection?.moodboard] ?? RECIPES['modular-proof'];
}

function toneFor(recipe: BoardRecipe, role: ToneRole | 'muted'): BrandSurfaceTone {
  if (role === 'muted') return 'muted';
  return recipe.tones[role];
}

/** Library assets for image slots, in recipe order, then any other eligible asset. */
export function moodboardImageAssetIds(identity: BrandIdentity): string[] {
  const eligible = moodboardAssets(identity).map(({ id }) => id);
  // Custom identities without curated library files fall back to any visual asset.
  const pool = eligible.length > 0 ? eligible : brandVisualAssets(identity).map(({ id }) => id);
  const preferred = recipeFor(identity).imagery.filter((id) => pool.includes(id));
  return [...new Set([...preferred, ...pool])];
}

function list(values: readonly unknown[] | undefined, count: number): string[] {
  return (values ?? []).filter((value): value is string => typeof value === 'string' && value.trim().length > 0).slice(0, count);
}

type CopyBuilder = (identity: BrandIdentity, variant: string) => MoodboardTileCopy;

function copy(headline: string, body = '', caption = ''): MoodboardTileCopy {
  return { body, caption, headline };
}

const DEFAULT_COPY: Record<MoodboardTileKind, CopyBuilder> = {
  badge: (identity) => {
    const person = brandSamplePerson(identity);
    const event = brandSampleEvent(identity);
    return copy(person.name, event.name, person.role);
  },
  billboard: (identity) => copy(brandMessaging(identity).phrases[0] ?? identity.tagline, '', identity.website),
  card: (identity) => {
    const person = brandSamplePerson(identity);
    return copy(person.name, person.role, identity.contactEmail || identity.website);
  },
  cover: (identity) => copy(identity.tagline, brandMessaging(identity).promise, identity.website),
  device: (identity) => copy(identity.graphicSystem?.device ?? 'Graphic device', identity.graphicSystem?.description ?? '', 'Graphic device'),
  email: (identity) => {
    const template = getEmailLifecycleTemplate('welcome-email', identity);
    return copy(template?.subject ?? `Welcome to ${identity.name}`, template?.body ?? identity.positioning, template?.cta ?? 'Get started');
  },
  imagery: (identity) => copy('Imagery', identity.graphicSystem?.imageDirection ?? '', 'Image direction'),
  logo: (identity) => copy(identity.name, identity.dossier?.logo ?? '', 'Primary and reverse'),
  motion: (identity) => {
    const motion = identity.motion?.[0];
    return copy(motion?.name ?? 'Brand cadence', motion?.description ?? identity.dossier?.motion ?? '', motion ? `${motion.durationMs} ms · ${motion.curve}` : '900 ms · cubic-bezier(.22, 1, .36, 1)');
  },
  palette: () => copy('Colour', '', 'Proportion · roles · contrast'),
  poster: (identity) => {
    const product = brandProducts(identity)[0];
    return copy(brandMessaging(identity).phrases[1] ?? identity.tagline, product?.name ?? identity.name, identity.website);
  },
  proof: (identity) => {
    const proof = brandProofStatements(identity);
    const customers = brandCustomers(identity);
    return copy(proof[0] ?? identity.tagline, [...proof.slice(1, 4), ...(proof.length < 2 ? customers.slice(0, 3) : [])].join('\n'), customers.length ? `Proof · ${customers.slice(0, 3).join(', ')}` : 'Proof');
  },
  social: (identity) => {
    const product = brandProducts(identity)[0];
    return copy(brandMessaging(identity).phrases[2] ?? identity.tagline, product?.summary || brandMessaging(identity).promise, identity.socialHandle || identity.website);
  },
  statement: (identity, variant) => variant === 'promise'
    ? copy(brandMessaging(identity).promise || identity.tagline, identity.positioning ?? '', 'Promise')
    : copy(identity.strategy?.concept ?? identity.tagline, identity.strategy?.challenge ?? '', 'Concept'),
  type: (identity, variant) => {
    const display = identity.typography?.find((font) => font.role === 'Display') ?? identity.typography?.[0];
    if (variant === 'phrases') return copy(brandMessaging(identity).phrases[0] ?? identity.tagline, list(identity.greetings, 6).join('  ·  '), 'Voice in type');
    if (variant === 'scale') return copy(identity.tagline, identity.mission ?? '', `Type scale · ${identity.typeScale?.ratio ?? 1.333}`);
    return copy(display?.family ?? identity.name, display?.usage ?? '', 'Display typeface');
  },
  voice: (identity) => copy(brandMessaging(identity).phrases[0] ?? identity.tagline, list(identity.voice?.principles, 4).join(' · '), 'Voice'),
  web: (identity) => copy(brandMessaging(identity).promise || identity.tagline, identity.positioning ?? '', brandProducts(identity).slice(0, 4).map(({ name }) => name).join('  ')),
};

/** Kinds whose headline is a brand line; a board never prints the same line twice. */
const LINE_KINDS: ReadonlySet<MoodboardTileKind> = new Set(['billboard', 'cover', 'poster', 'social', 'statement', 'type', 'voice', 'web']);

function sameLine(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}

/** Swap a headline that already appears on the board for the next unused brand line. */
function distinctHeadline(identity: BrandIdentity, tile: MoodboardTileCopy, kind: MoodboardTileKind, variant: string, used: string[]): MoodboardTileCopy {
  if (!LINE_KINDS.has(kind) || (kind === 'type' && variant !== 'phrases' && variant !== 'scale')) return tile;
  if (!used.some((line) => sameLine(line, tile.headline))) {
    used.push(tile.headline);
    return tile;
  }
  const messaging = brandMessaging(identity);
  const pool = [identity.tagline, messaging.promise, ...messaging.phrases, ...brandProofStatements(identity), ...brandProducts(identity).map(({ summary }) => summary), identity.mission];
  const next = pool.find((line) => line?.trim() && !used.some((usedLine) => sameLine(usedLine, line)));
  if (!next) return tile;
  used.push(next);
  return { ...tile, headline: next };
}

function templateVariant(template: TileTemplate, recipe: BoardRecipe): string {
  if (template.variant) return template.variant;
  if (template.kind === 'cover' || template.kind === 'poster') {
    return template.kind === 'cover' ? recipe.coverVariant : recipe.coverVariant === 'image' ? 'image' : 'device';
  }
  return MOODBOARD_TILE_VARIANTS[template.kind][0];
}

function defaultAssetId(kind: MoodboardTileKind, index: number, images: readonly string[]): string {
  if (!MOODBOARD_IMAGE_KINDS.has(kind) || images.length === 0) return '';
  const offsets: Partial<Record<MoodboardTileKind, number>> = { billboard: 1, imagery: 1, poster: 2, social: 3, web: 4 };
  return images[((offsets[kind] ?? 0) + index) % images.length]!;
}

export function defaultMoodboardTiles(
  identity: BrandIdentity,
  composition: MoodboardComposition
): MoodboardTile[] {
  const recipe = recipeFor(identity);
  const images = moodboardImageAssetIds(identity);
  const counts = new Map<MoodboardTileKind, number>();
  const used: string[] = [];
  return boardTemplate(identity, composition).map((template) => {
    const count = counts.get(template.kind) ?? 0;
    counts.set(template.kind, count + 1);
    const variant = templateVariant(template, recipe);
    return {
      assetId: defaultAssetId(template.kind, count, images),
      copy: distinctHeadline(identity, DEFAULT_COPY[template.kind](identity, variant), template.kind, variant, used),
      hidden: false,
      id: count === 0 ? template.kind : `${template.kind}-${count + 1}`,
      kind: template.kind,
      span: template.span,
      tone: toneFor(recipe, template.role),
      variant,
    };
  });
}

export function defaultMoodboardSurface(identity: BrandIdentity): MoodboardSurface {
  return recipeFor(identity).surface;
}

function applyTileOverride(tile: MoodboardTile, override: MoodboardTileOverride | undefined): MoodboardTile {
  if (!override) return tile;
  return {
    ...tile,
    assetId: override.assetId ?? tile.assetId,
    copy: { ...tile.copy, ...override.copy },
    hidden: override.hidden ?? tile.hidden,
    span: override.span ?? tile.span,
    tone: override.tone ?? tile.tone,
    variant: override.variant ?? tile.variant,
  };
}

function orderTiles(tiles: MoodboardTile[], order: readonly string[] | undefined): MoodboardTile[] {
  if (!order?.length) return tiles;
  const byId = new Map(tiles.map((tile) => [tile.id, tile]));
  const ordered = order.flatMap((id) => {
    const tile = byId.get(id);
    if (!tile) return [];
    byId.delete(id);
    return [tile];
  });
  return [...ordered, ...byId.values()];
}

export function resolveMoodboardBoard(
  identity: BrandIdentity,
  composition: MoodboardComposition,
  overrides: MoodboardOverrides | undefined
): MoodboardBoard {
  const board = overrides?.[composition];
  const tiles = defaultMoodboardTiles(identity, composition)
    .map((tile) => applyTileOverride(tile, board?.tiles?.[tile.id]));
  return {
    composition,
    surface: board?.surface ?? defaultMoodboardSurface(identity),
    tiles: orderTiles(tiles, board?.order),
    title: board?.title ?? MOODBOARD_BOARD_TITLES[composition],
  };
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export type MoodboardRect = { height: number; width: number; x: number; y: number };

/** Row weight: larger and feature tiles earn taller rows. */
function moodboardTileEmphasis(tile: Pick<MoodboardTile, 'kind' | 'span' | 'variant'>): number {
  if (tile.kind === 'cover') return tile.span >= 6 ? 1.6 : 1.2;
  if (tile.kind === 'palette' && tile.variant === 'proportion' && tile.span === 12) return 0.62;
  if (tile.kind === 'type' && tile.variant === 'scale' && tile.span === 12) return 1.1;
  if (tile.kind === 'type' && tile.variant === 'glyph') return tile.span >= 8 ? 1.5 : 1.15;
  if (tile.span >= 8) return 1.3;
  return 1;
}

type LayoutRow = { tiles: Array<{ span: number; tile: MoodboardTile }>; weight: number };

function packRows(tiles: readonly MoodboardTile[]): LayoutRow[] {
  const rows: LayoutRow[] = [];
  let current: LayoutRow = { tiles: [], weight: 0 };
  let used = 0;
  for (const tile of tiles) {
    if (used + tile.span > 12 && current.tiles.length > 0) {
      rows.push(current);
      current = { tiles: [], weight: 0 };
      used = 0;
    }
    current.tiles.push({ span: tile.span, tile });
    current.weight = Math.max(current.weight, moodboardTileEmphasis(tile));
    used += tile.span;
  }
  if (current.tiles.length > 0) rows.push(current);
  return rows.map(justifyRow);
}

/** Stretch a short row to the full 12 columns, growing the widest tiles first. */
function justifyRow(row: LayoutRow): LayoutRow {
  const total = row.tiles.reduce((sum, { span }) => sum + span, 0);
  if (total === 12) return row;
  const scaled = row.tiles.map(({ span, tile }) => ({ span: Math.max(1, Math.floor((span / total) * 12)), tile }));
  let remainder = 12 - scaled.reduce((sum, { span }) => sum + span, 0);
  const byWidth = [...scaled].sort((left, right) => right.span - left.span);
  for (let index = 0; remainder > 0; index = (index + 1) % byWidth.length) {
    byWidth[index]!.span += 1;
    remainder -= 1;
  }
  return { ...row, tiles: scaled };
}

export function layoutMoodboardTiles(
  tiles: readonly MoodboardTile[],
  frame: MoodboardRect,
  gap: number
): Array<{ rect: MoodboardRect; tile: MoodboardTile }> {
  const visible = tiles.filter((tile) => !tile.hidden);
  const rows = packRows(visible);
  if (rows.length === 0) return [];
  const column = (frame.width - gap * 11) / 12;
  const available = frame.height - gap * (rows.length - 1);
  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  let y = frame.y;
  return rows.flatMap((row, rowIndex) => {
    const height = rowIndex === rows.length - 1
      ? frame.y + frame.height - y
      : Math.round((available * row.weight) / totalWeight);
    let start = 0;
    const placed = row.tiles.map(({ span, tile }) => {
      const x = frame.x + start * (column + gap);
      start += span;
      return { rect: { height, width: Math.round(span * column + (span - 1) * gap), x: Math.round(x), y }, tile };
    });
    y += height + gap;
    return placed;
  });
}

// ---------------------------------------------------------------------------
// Source
// ---------------------------------------------------------------------------

export const MOODBOARD_SOURCE_SCHEMA = 'glyphfield.moodboard';
export const MOODBOARD_SOURCE_VERSION = 2;
const MAX_COPY_LENGTH = 600;

type MoodboardSourceTile = MoodboardTile & { label: string; variants: readonly string[] };

export function moodboardSourceBoards(identity: BrandIdentity, overrides: MoodboardOverrides | undefined) {
  return Object.fromEntries(MOODBOARD_COMPOSITIONS.map((composition) => {
    const board = resolveMoodboardBoard(identity, composition, overrides);
    return [composition, {
      surface: board.surface,
      tiles: board.tiles.map((tile): MoodboardSourceTile => ({
        ...tile,
        label: MOODBOARD_TILE_LABELS[tile.kind],
        variants: MOODBOARD_TILE_VARIANTS[tile.kind],
      })),
      title: board.title,
    }];
  }));
}

function sourceRecord(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, path: string, maximum = MAX_COPY_LENGTH): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new TypeError(`${path} must be a string.`);
  if (value.length > maximum) throw new RangeError(`${path} must be at most ${maximum} characters.`);
  return value;
}

function parseCopy(value: unknown, defaults: MoodboardTileCopy, path: string): Partial<MoodboardTileCopy> | undefined {
  if (value === undefined) return undefined;
  const record = sourceRecord(value, path);
  const copyOverride: Partial<MoodboardTileCopy> = {};
  for (const field of MOODBOARD_COPY_FIELDS) {
    const next = optionalString(record[field], `${path}.${field}`);
    if (next !== undefined && next !== defaults[field]) copyOverride[field] = next;
  }
  return Object.keys(copyOverride).length > 0 ? copyOverride : undefined;
}

function enumValue<T extends string | number>(value: unknown, allowed: readonly T[], path: string): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) throw new RangeError(`${path} must be one of ${allowed.join(', ')}.`);
  return value as T;
}

function parseTile(
  value: Record<string, unknown>,
  tile: MoodboardTile,
  assetIds: readonly string[],
  path: string
): MoodboardTileOverride | undefined {
  const variant = enumValue(value.variant, MOODBOARD_TILE_VARIANTS[tile.kind] as readonly string[], `${path}.variant`);
  const span = enumValue(value.span, MOODBOARD_TILE_SPANS, `${path}.span`);
  const tone = enumValue(value.tone, BRAND_SURFACE_TONES, `${path}.tone`);
  const assetId = enumValue(value.assetId, ['', ...assetIds], `${path}.assetId`);
  if (value.hidden !== undefined && typeof value.hidden !== 'boolean') throw new TypeError(`${path}.hidden must be a Boolean.`);
  const candidate: MoodboardTileOverride = {
    assetId: assetId !== tile.assetId ? assetId : undefined,
    copy: parseCopy(value.copy, tile.copy, `${path}.copy`),
    hidden: value.hidden !== tile.hidden ? value.hidden as boolean | undefined : undefined,
    span: span !== tile.span ? span : undefined,
    tone: tone !== tile.tone ? tone : undefined,
    variant: variant !== tile.variant ? variant : undefined,
  };
  const entries = Object.entries(candidate).filter(([, entry]) => entry !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) as MoodboardTileOverride : undefined;
}

function parseBoardMeta(
  identity: BrandIdentity,
  composition: MoodboardComposition,
  record: Record<string, unknown>,
  previous: MoodboardBoardOverride | undefined
): MoodboardBoardOverride {
  const next: MoodboardBoardOverride = {};
  const title = optionalString(record.title, `boards.${composition}.title`, 120) ?? previous?.title;
  if (title !== undefined && title !== MOODBOARD_BOARD_TITLES[composition]) next.title = title;
  const surface = enumValue(record.surface, ['dark', 'light'] as const, `boards.${composition}.surface`) ?? previous?.surface;
  if (surface && surface !== defaultMoodboardSurface(identity)) next.surface = surface;
  return next;
}

function parseBoardTiles(
  identity: BrandIdentity,
  composition: MoodboardComposition,
  entries: unknown,
  previous: MoodboardBoardOverride | undefined
): Pick<MoodboardBoardOverride, 'order' | 'tiles'> {
  if (!Array.isArray(entries)) throw new TypeError(`boards.${composition}.tiles must be an array.`);
  const defaults = defaultMoodboardTiles(identity, composition);
  const byId = new Map(defaults.map((tile) => [tile.id, tile]));
  const assetIds = moodboardImageAssetIds(identity);
  // Tiles omitted from a partial list keep their settings and follow the listed tiles.
  const tiles: Record<string, MoodboardTileOverride> = { ...previous?.tiles };
  const order: string[] = [];
  entries.forEach((entry, index) => {
    const path = `boards.${composition}.tiles.${index}`;
    const tileRecord = sourceRecord(entry, path);
    const tile = byId.get(String(tileRecord.id));
    if (!tile) throw new RangeError(`${path}.id must be one of ${[...byId.keys()].join(', ')}.`);
    if (order.includes(tile.id)) throw new RangeError(`${path}.id repeats ${tile.id}.`);
    order.push(tile.id);
    const override = parseTile(tileRecord, tile, assetIds, path);
    if (override) tiles[tile.id] = override;
    else delete tiles[tile.id];
  });
  const defaultOrder = defaults.map(({ id }) => id);
  const previousOrder = (previous?.order ?? defaultOrder).filter((id) => byId.has(id) && !order.includes(id));
  const completeOrder = [...order, ...previousOrder, ...defaultOrder.filter((id) => !order.includes(id) && !previousOrder.includes(id))];
  return {
    order: completeOrder.join() !== defaultOrder.join() ? completeOrder : undefined,
    tiles: Object.keys(tiles).length > 0 ? tiles : undefined,
  };
}

function parseBoard(
  identity: BrandIdentity,
  composition: MoodboardComposition,
  value: unknown,
  previous: MoodboardBoardOverride | undefined
): MoodboardBoardOverride | undefined {
  if (value === undefined) return previous;
  const record = sourceRecord(value, `boards.${composition}`);
  const tiles = record.tiles === undefined
    ? { order: previous?.order, tiles: previous?.tiles }
    : parseBoardTiles(identity, composition, record.tiles, previous);
  const next = Object.fromEntries(Object.entries({ ...parseBoardMeta(identity, composition, record, previous), ...tiles })
    .filter(([, entry]) => entry !== undefined)) as MoodboardBoardOverride;
  return Object.keys(next).length > 0 ? next : undefined;
}

/**
 * Validates `boards` from a moodboard source document and returns normalized
 * overrides. Values equal to the identity defaults are dropped so untouched copy
 * keeps following later identity edits. Boards absent from the source keep their
 * previous overrides.
 */
export function parseMoodboardOverrides(
  identity: BrandIdentity,
  boards: unknown,
  previous: MoodboardOverrides | undefined
): MoodboardOverrides {
  if (boards === undefined) return previous ?? {};
  const record = sourceRecord(boards, 'boards');
  const unknown = Object.keys(record).filter((key) => !MOODBOARD_COMPOSITIONS.includes(key as MoodboardComposition));
  if (unknown.length > 0) throw new RangeError(`boards contains unknown board ${unknown[0]}; use ${MOODBOARD_COMPOSITIONS.join(', ')}.`);
  const next: MoodboardOverrides = {};
  for (const composition of MOODBOARD_COMPOSITIONS) {
    const board = parseBoard(identity, composition, record[composition], previous?.[composition]);
    if (board) next[composition] = board;
  }
  return next;
}

/** Drop persisted overrides that no longer validate (renamed tiles, removed assets). */
export function sanitizeMoodboardOverrides(identity: BrandIdentity, value: unknown): MoodboardOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: MoodboardOverrides = {};
  for (const composition of MOODBOARD_COMPOSITIONS) {
    const board = (value as Record<string, unknown>)[composition];
    if (!board || typeof board !== 'object') continue;
    try {
      const resolved = resolveMoodboardBoard(identity, composition, { [composition]: board as MoodboardBoardOverride });
      const parsed = parseBoard(identity, composition, {
        surface: resolved.surface,
        tiles: resolved.tiles,
        title: resolved.title,
      }, undefined);
      if (parsed) next[composition] = parsed;
    } catch {
      // A corrupt board falls back to its identity defaults.
    }
  }
  return next;
}

/** Apply one tile edit and normalize it against the defaults. */
export function updateMoodboardTile(
  identity: BrandIdentity,
  overrides: MoodboardOverrides,
  composition: MoodboardComposition,
  tileId: string,
  patch: MoodboardTileOverride
): MoodboardOverrides {
  const board = resolveMoodboardBoard(identity, composition, overrides);
  const tiles = board.tiles.map((tile) => (tile.id === tileId ? applyTileOverride(tile, patch) : tile));
  return parseMoodboardOverrides(identity, { [composition]: { surface: board.surface, tiles, title: board.title } }, overrides);
}

export function updateMoodboardBoard(
  identity: BrandIdentity,
  overrides: MoodboardOverrides,
  composition: MoodboardComposition,
  patch: { order?: string[]; surface?: MoodboardSurface; title?: string }
): MoodboardOverrides {
  const board = resolveMoodboardBoard(identity, composition, overrides);
  const byId = new Map(board.tiles.map((tile) => [tile.id, tile]));
  const tiles = patch.order ? patch.order.flatMap((id) => byId.get(id) ?? []) : board.tiles;
  return parseMoodboardOverrides(identity, {
    [composition]: { surface: patch.surface ?? board.surface, tiles, title: patch.title ?? board.title },
  }, overrides);
}

export function resetMoodboardTile(overrides: MoodboardOverrides, composition: MoodboardComposition, tileId: string): MoodboardOverrides {
  const board = overrides[composition];
  if (!board?.tiles?.[tileId]) return overrides;
  const tiles = { ...board.tiles };
  delete tiles[tileId];
  const next: MoodboardBoardOverride = { ...board, tiles };
  if (Object.keys(tiles).length === 0) delete next.tiles;
  return { ...overrides, [composition]: next };
}

export function resetMoodboardBoard(overrides: MoodboardOverrides, composition: MoodboardComposition): MoodboardOverrides {
  const next = { ...overrides };
  delete next[composition];
  return next;
}
