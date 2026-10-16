import {
  BASEMENT_BRAND_IDENTITY,
  BUILT_IN_BRAND_IDENTITIES,
  GT_BRAND_IDENTITY,
  STARTER_BRAND_IDENTITY,
} from './identityPresets';
import { brandIdentityFingerprint } from './brandIdentityFingerprint';
import { createPixelBrandAssets, hasGeneratedPixelAssets, updateGeneratedPixelAssets } from './brandPixelMark';
import { applyStarterKit, DEFAULT_STARTER_DIRECTION, STARTER_DEVICE_PLACEHOLDER, STARTER_KIT_FONTS } from './brandStarterKit';
import { isPristineBuiltInIdentity } from './builtInIdentityRevision';
import { migrateGtTypography } from './gtTypographyMigration';
import { normalizeHexOrFallback } from './color';
import { capVisibleFontWeight } from './typography';

export {
  BASEMENT_BRAND_IDENTITY,
  BUILT_IN_BRAND_IDENTITIES,
  GT_BRAND_IDENTITY,
  STARTER_BRAND_IDENTITY,
};

export type BrandAsset = {
  alt?: string;
  attribution?: string;
  focalPoint?: {
    x: number;
    y: number;
  };
  id: string;
  license?: string;
  label: string;
  path: string;
  redistribution?: 'bundled' | 'original' | 'research-only' | 'url-only';
  sourceOwner?: string;
  sourceUrl?: string;
  surface: 'light' | 'dark' | 'any';
  tags?: string[];
  type:
    | 'background'
    | 'icon'
    | 'image'
    | 'logo'
    | 'motion'
    | 'product'
    | 'proof'
    | 'reference'
    | 'texture';
  usage?: string;
};

export type BrandReference = {
  assetId?: string;
  category: 'campaign' | 'concept' | 'material' | 'motion' | 'official';
  capturedAt?: string;
  id: string;
  intendedUse: string;
  owner: string;
  redistribution: 'bundled' | 'original' | 'research-only' | 'url-only';
  sourceUrl: string;
  status: 'captured' | 'planned' | 'reviewed';
  title: string;
};

export type BrandDossier = {
  applications: string[];
  color: string;
  graphicDevice: string;
  imagery: string;
  layout: string;
  logo: string;
  motion: string;
  personality: string;
  premise: string;
  prohibited: string[];
  provenance: string;
  renderingRecipe: string[];
  typography: string;
};

export type BrandArtDirection = {
  moodboard:
    | 'cinematic-field'
    | 'editorial-evidence'
    | 'knowledge-system'
    | 'modular-proof'
    | 'monochrome-language'
    | 'network-atlas'
    | 'product-spectrum'
    | 'research-wall'
    | 'utility-current';
  preview:
    | 'editorial-interruption'
    | 'economic-ledger'
    | 'focus-window'
    | 'knowledge-beam'
    | 'network-horizon'
    | 'programmable-field'
    | 'translation-frame'
    | 'unified-terminal'
    | 'utility-wave';
  titleMaxLines: 1 | 2;
};

export type BrandColor = {
  hex: string;
  id: string;
  name: string;
  /** Approximate share of visual space, 0–100, used for 60/30/10 proportion checks. */
  proportion?: number;
  role: string;
};

/** A foreground/background color pair the brand intends for text or icons. */
export type BrandColorPairing = {
  background: string;
  foreground: string;
  /** AA needs 4.5:1 for body text; AA-large needs 3:1 for large display text and icons. */
  level?: 'AA' | 'AA-large';
  usage: string;
};

/** A modular type scale: sizes are basePx × ratio^step. */
export type BrandTypeScale = {
  basePx: number;
  ratio: number;
  /** The scale step each role is set at, such as { Display: 'h1' }; omitted roles use the defaults. */
  roleSteps?: Partial<Record<BrandTypography['role'], string>>;
};

/** OKLCH tint and shade scale settings for one palette color; omitted fields use the defaults. */
export type BrandColorScale = {
  /** Snap the step nearest in lightness to the exact palette HEX (default true). */
  anchor?: boolean;
  /** Chroma as a percentage of the palette color's own chroma (default 100). */
  chroma?: number;
  /** OKLCH lightness of the darkest step, 0–1. */
  darkest?: number;
  /** Hue rotation in degrees from the lightest to the darkest step. */
  hueShift?: number;
  /** The colors[].id this scale belongs to. */
  id: string;
  /** OKLCH lightness of the lightest step, 0–1. */
  lightest?: number;
};

/**
 * Semantic color roles for light and dark modes, plus per-color scale settings.
 * Role values are color refs: a colors[].id ("ink") or one of its scale steps ("ink.700").
 * Omitted roles are derived from the palette.
 */
export type BrandColorSystem = {
  dark?: Partial<Record<string, string>>;
  light?: Partial<Record<string, string>>;
  scales?: BrandColorScale[];
};

export type BrandVoiceExample = {
  avoid: string;
  context: string;
  write: string;
};

/** A product and the one line that says what it does. `name` matches an entry in `products`. */
export type BrandProductDetail = {
  name: string;
  summary: string;
};

/**
 * Sample content that templates use in place of placeholders: a person and an
 * event that fit the brand. These are samples, never claims about real people.
 */
export type BrandSamples = {
  /** Short product actions for command menus, checklists and dialogs, such as "Refund a payment". */
  actions?: string[];
  /** A real request, command or snippet that developer templates show. */
  code?: {
    label: string;
    snippet: string;
  };
  event?: {
    date: string;
    location: string;
    name: string;
    time?: string;
  };
  /** The install or getting-started command. */
  install?: string;
  /** One dashboard figure, shown as sample interface data. */
  metric?: {
    change: string;
    label: string;
    value: string;
  };
  person?: {
    name: string;
    role: string;
  };
  /** Published plans or engagement types for pricing and checkout templates. */
  plans?: {
    features: string[];
    name: string;
    price: string;
  }[];
  /** A release or update headline and its changes. */
  release?: {
    items: string[];
    title: string;
  };
};

export type BrandTypography = {
  family: string;
  fontId?: string;
  letterSpacing?: number;
  lineHeight?: number;
  /** Fixed optical size (the `opsz` axis); omitted means automatic optical sizing. */
  opticalSize?: number;
  role: 'Display' | 'Body' | 'Accent' | 'Code';
  /** Oblique angle in degrees, leaning right; uses the font's `slnt` axis when it has one. */
  slant?: number;
  usage: string;
  weight?: number;
};

export type BrandFontAsset = {
  family: string;
  fileName: string;
  format: 'opentype' | 'truetype' | 'woff' | 'woff2';
  id: string;
  label: string;
  /** License name or usage terms for the font file, such as "OFL-1.1" or "Commercial desktop + web". */
  license?: string;
  path: string;
  sourceUrl?: string;
  style: 'italic' | 'normal';
  weight: number;
  weightMax?: number;
  weightMin?: number;
};

type BrandMotion = {
  curve: string;
  description: string;
  durationMs: number;
  id: string;
  name: string;
  previewPath: string;
};

type BrandStyle = {
  borderRadius: number;
  density: 'compact' | 'comfortable' | 'spacious';
  grid: 'none' | 'dots' | 'lines';
  imageTreatment: 'natural' | 'monochrome' | 'duotone';
  logoScale: number;
};

export type BrandApplication = {
  category:
    | 'foundation'
    | 'product'
    | 'marketing'
    | 'editorial'
    | 'social'
    | 'developer'
    | 'event'
    | 'physical';
  description: string;
  format: string;
  id: string;
  name: string;
};

type BrandStrategy = {
  challenge: string;
  concept: string;
  outcome: string;
  personality: string[];
  pillars: string[];
  promise: string;
};

type BrandGraphicSystem = {
  composition: string;
  description: string;
  device: string;
  imageDirection: string;
  pattern: 'blocks' | 'brackets' | 'burst' | 'circuit' | 'flow' | 'grid' | 'none' | 'orbit' | 'rays' | 'steps' | 'wave';
  rules: string[];
};

const DEFAULT_BRAND_STYLE: BrandStyle = {
  borderRadius: 6,
  density: 'comfortable',
  grid: 'none',
  imageTreatment: 'natural',
  logoScale: 100,
};

export type BrandIdentity = {
  applications: BrandApplication[];
  artDirection: BrandArtDirection;
  assets: BrandAsset[];
  audiences: string[];
  builtIn: boolean;
  colorPairings?: BrandColorPairing[];
  colorSystem?: BrandColorSystem;
  colors: BrandColor[];
  contactEmail: string;
  /** Customer or client names, kept apart from the proof statements in `proof`. */
  customers?: string[];
  description: string;
  dossier: BrandDossier;
  fonts?: BrandFontAsset[];
  greetings: string[];
  graphicSystem: BrandGraphicSystem;
  id: string;
  kind: 'template' | 'example' | 'custom';
  motion: BrandMotion[];
  mission: string;
  name: string;
  positioning: string;
  /** Content fingerprint of the shipped preset a built-in was hydrated from. */
  presetFingerprint?: string;
  /** One-line summaries for the names in `products`. */
  productDetails?: BrandProductDetail[];
  products: string[];
  /** Verifiable proof statements such as published metrics. Customer names belong in `customers`. */
  proof: string[];
  proofAssets: BrandAsset[];
  references: BrandReference[];
  revision: number;
  /** Sample person and event content for templates. */
  samples?: BrandSamples;
  shortName: string;
  socialHandle: string;
  sourceNotes: string[];
  style: BrandStyle;
  strategy: BrandStrategy;
  tagline: string;
  typeScale?: BrandTypeScale;
  typography: BrandTypography[];
  voice: {
    avoid: string[];
    /** Before/after copy examples that show the voice in a real context. */
    examples?: BrandVoiceExample[];
    phrases: string[];
    principles: string[];
  };
  values: string[];
  website: string;
};

/** The bundled faces an identity without font records falls back to. */
const DEFAULT_BRAND_FONT_ASSETS: readonly BrandFontAsset[] = STARTER_KIT_FONTS.filter(({ family }) => family !== 'Instrument Serif');

function bundledFontId(family: string, role: BrandTypography['role']): string | undefined {
  const normalizedFamily = family.toLocaleLowerCase();
  if (normalizedFamily.includes('switzer')) return role === 'Display' ? 'switzer-500' : 'switzer-400';
  if (normalizedFamily.includes('geist mono')) return 'geist-mono-variable';
  if (normalizedFamily.includes('inter')) return 'inter-variable';
  return undefined;
}

function normalizeTypography(font: BrandTypography): BrandTypography {
  const fallbackWeight = font.role === 'Display' ? 550 : font.role === 'Code' ? 450 : 400;
  return {
    ...font,
    fontId: font.fontId ?? bundledFontId(font.family, font.role),
    letterSpacing: font.letterSpacing ?? (font.role === 'Display' ? -3 : 0),
    lineHeight: font.lineHeight ?? (font.role === 'Display' ? 0.96 : 1.5),
    weight: capVisibleFontWeight(font.weight ?? fallbackWeight),
  };
}

export function brandFontAssets(identity: BrandIdentity): BrandFontAsset[] {
  return identity.fonts?.length
    ? identity.fonts
    : DEFAULT_BRAND_FONT_ASSETS.map((font) => ({ ...font }));
}

export function brandTypographyRole(
  identity: BrandIdentity,
  role: BrandTypography['role']
): BrandTypography {
  const matching = identity.typography.find((font) => font.role === role)
    ?? identity.typography[0]
    ?? {
      family: 'Switzer',
      role,
      usage: 'Brand typography',
    };
  return normalizeTypography(matching);
}

export function brandTypographyFamily(
  identity: BrandIdentity,
  role: BrandTypography['role']
): string {
  const typography = brandTypographyRole(identity, role);
  return brandFontAssets(identity).find((font) => font.id === typography.fontId)?.family
    ?? typography.family;
}

export function brandTypographyWeightRange(
  identity: BrandIdentity,
  role: BrandTypography['role']
): { max: number; min: number } {
  const family = brandTypographyFamily(identity, role);
  const assets = brandFontAssets(identity).filter((font) => (
    font.family === family && font.style === 'normal'
  ));
  if (assets.length === 0) return { max: 900, min: 100 };
  return {
    max: Math.max(...assets.map((font) => font.weightMax ?? font.weight)),
    min: Math.min(...assets.map((font) => font.weightMin ?? font.weight)),
  };
}

export function resolveBrandTypographyWeight(
  identity: BrandIdentity,
  role: BrandTypography['role'],
  requestedWeight: number
): number {
  const family = brandTypographyFamily(identity, role);
  const assets = brandFontAssets(identity).filter((font) => (
    font.family === family && font.style === 'normal'
  ));
  if (assets.length === 0) return Math.min(900, Math.max(100, Math.round(requestedWeight)));

  const variableAsset = assets.find((font) => (
    font.weightMin !== undefined && font.weightMax !== undefined
  ));
  if (variableAsset?.weightMin !== undefined && variableAsset.weightMax !== undefined) {
    return Math.min(variableAsset.weightMax, Math.max(variableAsset.weightMin, Math.round(requestedWeight)));
  }

  const availableWeights = [...new Set(assets.map(({ weight }) => weight))].sort((left, right) => left - right);
  return availableWeights.reduce((nearest, candidate) => {
    const candidateDistance = Math.abs(candidate - requestedWeight);
    const nearestDistance = Math.abs(nearest - requestedWeight);
    return candidateDistance < nearestDistance || (candidateDistance === nearestDistance && candidate > nearest)
      ? candidate
      : nearest;
  }, availableWeights[0] ?? Math.round(requestedWeight));
}

/** @font-face rules for a list of font records. */
export function fontAssetFaceCss(fonts: readonly BrandFontAsset[]): string {
  return fonts
    .map((font) => {
      const weight = font.weightMin !== undefined && font.weightMax !== undefined
        ? `${font.weightMin} ${font.weightMax}`
        : String(font.weight);
      return `@font-face{font-family:${JSON.stringify(font.family)};src:url(${JSON.stringify(font.path)}) format(${JSON.stringify(font.format)});font-style:${font.style};font-weight:${weight};font-display:swap;}`;
    })
    .join('');
}

export function brandFontFaceCss(identity: BrandIdentity): string {
  return fontAssetFaceCss(brandFontAssets(identity));
}

function cloneBrandAsset(asset: BrandAsset): BrandAsset {
  return {
    ...asset,
    focalPoint: asset.focalPoint ? { ...asset.focalPoint } : undefined,
    tags: asset.tags ? [...asset.tags] : undefined,
  };
}

function cloneBrandDossier(identity: BrandIdentity): BrandIdentity['dossier'] {
  return {
    ...STARTER_BRAND_IDENTITY.dossier,
    ...identity.dossier,
    applications: [
      ...(identity.dossier?.applications ?? STARTER_BRAND_IDENTITY.dossier.applications),
    ],
    prohibited: [
      ...(identity.dossier?.prohibited ?? STARTER_BRAND_IDENTITY.dossier.prohibited),
    ],
    renderingRecipe: [
      ...(identity.dossier?.renderingRecipe ?? STARTER_BRAND_IDENTITY.dossier.renderingRecipe),
    ],
  };
}

function cloneBrandGraphicSystem(identity: BrandIdentity): BrandIdentity['graphicSystem'] {
  return {
    ...STARTER_BRAND_IDENTITY.graphicSystem,
    ...identity.graphicSystem,
    rules: [
      ...(identity.graphicSystem?.rules ?? STARTER_BRAND_IDENTITY.graphicSystem.rules),
    ],
  };
}

function cloneBrandStrategy(identity: BrandIdentity): BrandIdentity['strategy'] {
  return {
    ...STARTER_BRAND_IDENTITY.strategy,
    ...identity.strategy,
    personality: [
      ...(identity.strategy?.personality ?? STARTER_BRAND_IDENTITY.strategy.personality),
    ],
    pillars: [
      ...(identity.strategy?.pillars ?? STARTER_BRAND_IDENTITY.strategy.pillars),
    ],
  };
}

function cloneBrandVoice(identity: BrandIdentity): BrandIdentity['voice'] {
  return {
    ...identity.voice,
    avoid: [...(identity.voice?.avoid ?? [])],
    ...(identity.voice?.examples ? { examples: identity.voice.examples.map((example) => ({ ...example })) } : {}),
    phrases: [...(identity.voice?.phrases ?? [])],
    principles: [...(identity.voice?.principles ?? [])],
  };
}

function cloneBrandSamples(samples: BrandSamples): BrandSamples {
  return {
    ...samples,
    ...(samples.actions ? { actions: [...samples.actions] } : {}),
    ...(samples.code ? { code: { ...samples.code } } : {}),
    ...(samples.event ? { event: { ...samples.event } } : {}),
    ...(samples.metric ? { metric: { ...samples.metric } } : {}),
    ...(samples.person ? { person: { ...samples.person } } : {}),
    ...(samples.plans ? { plans: samples.plans.map((plan) => ({ ...plan, features: [...plan.features] })) } : {}),
    ...(samples.release ? { release: { ...samples.release, items: [...samples.release.items] } } : {}),
  };
}

function cloneBrandColorSystem(system: BrandColorSystem): BrandColorSystem {
  return {
    ...system,
    ...(system.dark ? { dark: { ...system.dark } } : {}),
    ...(system.light ? { light: { ...system.light } } : {}),
    ...(system.scales ? { scales: system.scales.map((scale) => ({ ...scale })) } : {}),
  };
}

/** Optional colour and type system fields, deep-copied when present. */
function cloneSystemFields(identity: BrandIdentity): Pick<BrandIdentity, 'colorSystem' | 'typeScale'> {
  const typeScale = identity.typeScale
    ? { ...identity.typeScale, ...(identity.typeScale.roleSteps ? { roleSteps: { ...identity.typeScale.roleSteps } } : {}) }
    : undefined;
  return {
    ...(identity.colorSystem ? { colorSystem: cloneBrandColorSystem(identity.colorSystem) } : {}),
    ...(typeScale ? { typeScale } : {}),
  };
}

/** Optional collections, copied only when present so absent fields stay absent. */
function cloneOptionalRecords(identity: BrandIdentity): Partial<BrandIdentity> {
  return {
    ...(identity.colorPairings ? { colorPairings: identity.colorPairings.map((pairing) => ({ ...pairing })) } : {}),
    ...(identity.customers ? { customers: [...identity.customers] } : {}),
    ...(identity.productDetails ? { productDetails: identity.productDetails.map((detail) => ({ ...detail })) } : {}),
    ...(identity.samples ? { samples: cloneBrandSamples(identity.samples) } : {}),
    ...cloneSystemFields(identity),
  };
}

function cloneBrandIdentity(identity: BrandIdentity): BrandIdentity {
  return {
    ...identity,
    artDirection: {
      ...STARTER_BRAND_IDENTITY.artDirection,
      ...identity.artDirection,
    },
    applications: (identity.applications ?? STARTER_BRAND_IDENTITY.applications).map(
      (application) => ({ ...application })
    ),
    assets: identity.assets.map(cloneBrandAsset),
    audiences: [...(identity.audiences ?? [])],
    colors: (identity.colors ?? []).map((color) => ({
      ...color,
      hex: normalizeHexOrFallback(color.hex),
    })),
    contactEmail: identity.contactEmail ?? '',
    fonts: brandFontAssets(identity).map((font) => ({ ...font })),
    greetings: [...(identity.greetings ?? [])],
    dossier: cloneBrandDossier(identity),
    graphicSystem: cloneBrandGraphicSystem(identity),
    mission: identity.mission ?? identity.positioning ?? '',
    motion: (identity.motion ?? []).map((motion) => ({ ...motion })),
    products: [...(identity.products ?? [])],
    proof: [...(identity.proof ?? [])],
    proofAssets: (identity.proofAssets ?? []).map(cloneBrandAsset),
    references: (identity.references ?? []).map((reference) => ({ ...reference })),
    revision: identity.revision ?? 1,
    socialHandle: identity.socialHandle ?? '',
    sourceNotes: [...(identity.sourceNotes ?? [])],
    style: { ...DEFAULT_BRAND_STYLE, ...identity.style },
    strategy: cloneBrandStrategy(identity),
    ...cloneOptionalRecords(identity),
    typography: (identity.typography ?? []).map(normalizeTypography),
    values: [...(identity.values ?? [])],
    voice: cloneBrandVoice(identity),
  };
}

function mergeBrandIdentity(
  identity: BrandIdentity,
  fallback: BrandIdentity
): BrandIdentity {
  const storedAssetIds = new Set(identity.assets.map(({ id }) => id));

  return cloneBrandIdentity({
    ...fallback,
    ...identity,
    applications: identity.applications ?? fallback.applications,
    artDirection: {
      ...fallback.artDirection,
      ...identity.artDirection,
    },
    assets: [
      ...identity.assets,
      ...fallback.assets.filter(({ id }) => !storedAssetIds.has(id)),
    ],
    contactEmail: identity.contactEmail ?? fallback.contactEmail,
    dossier: {
      ...fallback.dossier,
      ...identity.dossier,
      applications: identity.dossier?.applications ?? fallback.dossier.applications,
      prohibited: identity.dossier?.prohibited ?? fallback.dossier.prohibited,
      renderingRecipe:
        identity.dossier?.renderingRecipe ?? fallback.dossier.renderingRecipe,
    },
    graphicSystem: {
      ...fallback.graphicSystem,
      ...identity.graphicSystem,
      rules: identity.graphicSystem?.rules ?? fallback.graphicSystem.rules,
    },
    mission: identity.mission ?? fallback.mission,
    references: identity.references ?? fallback.references,
    revision: identity.revision ?? fallback.revision,
    socialHandle: identity.socialHandle ?? fallback.socialHandle,
    style: { ...fallback.style, ...identity.style },
    strategy: {
      ...fallback.strategy,
      ...identity.strategy,
      personality: identity.strategy?.personality ?? fallback.strategy.personality,
      pillars: identity.strategy?.pillars ?? fallback.strategy.pillars,
    },
    values: identity.values ?? fallback.values,
  });
}

/**
 * The short form a new name gets: initials for several words (GT), the word
 * itself for a one-word name up to eight letters (Kestrel), else its first three.
 */
export function shortNameFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((word) => word[0]).join('').slice(0, 3).toLocaleUpperCase();
  const word = words[0] ?? '';
  return word.length <= 8 ? word : word.slice(0, 3).toLocaleUpperCase();
}

/**
 * A new brand: placeholder copy on the default starter direction's palette, type,
 * device and corners. The device copy stays a placeholder until a device is chosen.
 */
export function createBrandIdentity(name: string, id = crypto.randomUUID()): BrandIdentity {
  const trimmedName = name.trim() || 'Untitled brand';
  const resolvedShortName = shortNameFromName(trimmedName) || 'BR';
  const direction = DEFAULT_STARTER_DIRECTION;

  // The kit fills colors, fonts and typography and redraws the marks in the palette.
  return applyStarterKit({
    applications: STARTER_BRAND_IDENTITY.applications.map((item) => ({ ...item })),
    artDirection: { ...STARTER_BRAND_IDENTITY.artDirection },
    assets: createPixelBrandAssets(resolvedShortName, id),
    audiences: [],
    builtIn: false,
    colors: [],
    contactEmail: '',
    description: 'A local brand identity ready for assets, tokens, motion, and repeatable graphics.',
    dossier: {
      applications: ['Identity preview', 'Moodboard', 'Launch graphic'],
      color: 'Assign each color a role and define how much visual space it may occupy.',
      graphicDevice: 'Create one recognizable device that can survive across formats.',
      imagery: 'Define subjects, crops, treatments, and the relationship between image and copy.',
      layout: 'Define spacing, alignment, hierarchy, and maximum line counts before decorating.',
      logo: 'Document the mark, wordmark, lockups, clear space, scale, and surface behavior.',
      motion: 'Describe pace, easing, transitions, loops, and reduced-motion behavior.',
      personality: 'Choose a small set of specific traits that guide both writing and design.',
      premise: 'Explain why this identity exists and the change it should make visible.',
      prohibited: ['Do not use decoration without a strategic role'],
      provenance: 'Created locally in Glyphfield. Add a source and usage status to every reference.',
      renderingRecipe: ['Set hierarchy', 'Choose one focal element', 'Apply the brand device', 'Run export preflight'],
      typography: 'Assign real font files to display, body, accent, and code roles.',
    },
    fonts: [],
    greetings: ['Welcome'],
    graphicSystem: {
      composition: 'Choose a consistent layout behavior for this identity.',
      description: 'Define the recognizable graphic device that connects every application.',
      device: STARTER_DEVICE_PLACEHOLDER,
      imageDirection: 'Describe subject, crop, color treatment, and caption behavior.',
      pattern: direction.device,
      rules: ['Connect every expression to the central brand idea'],
    },
    id,
    kind: 'custom',
    motion: [],
    mission: 'Add the durable change this brand exists to create.',
    name: trimmedName,
    positioning: 'Add a concise positioning statement for this identity.',
    products: [],
    proof: [],
    proofAssets: [],
    references: [],
    revision: 1,
    shortName: resolvedShortName,
    socialHandle: `@${trimmedName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '')}`,
    sourceNotes: ['Created locally in Glyphfield'],
    style: { ...DEFAULT_BRAND_STYLE },
    strategy: {
      challenge: 'Describe the problem this identity must help solve.',
      concept: 'Name the idea that organizes the system.',
      outcome: 'Describe the change this identity should create.',
      personality: ['Clear', 'Specific', 'Recognizable'],
      pillars: ['Add the first strategic pillar'],
      promise: 'Write the durable promise this brand makes.',
    },
    tagline: 'Add a clear brand line.',
    typography: [],
    voice: {
      avoid: [],
      phrases: [],
      principles: ['Clear', 'Specific', 'Consistent'],
    },
    values: ['Clarity', 'Utility', 'Consistency'],
    website: '',
  }, { corners: direction.corners, density: direction.density, palette: direction.palette, pairing: direction.pairing });
}

function isBrandIdentity(value: unknown): value is BrandIdentity {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<BrandIdentity>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.colors) &&
    Array.isArray(candidate.assets)
  );
}

function migrateBasementDisplaySpacing(
  identity: BrandIdentity | undefined,
  preset: BrandIdentity
): BrandIdentity | undefined {
  const storedDisplay = identity?.typography.find(({ role }) => role === 'Display');
  const presetDisplay = preset.typography.find(({ role }) => role === 'Display');
  if (
    preset.id !== 'basement'
    || !identity
    || storedDisplay?.letterSpacing !== -5
    || storedDisplay.lineHeight !== 0.88
    || !presetDisplay
  ) return identity;
  return {
    ...identity,
    typography: identity.typography.map((typography) =>
      typography.role === 'Display'
        ? {
            ...typography,
            letterSpacing: presetDisplay.letterSpacing,
            lineHeight: presetDisplay.lineHeight,
            usage: presetDisplay.usage,
          }
        : typography
    ),
  };
}

/** One-time content migrations for edited built-ins saved by earlier releases. */
/**
 * A release can retire bundled artwork. An edited built-in keeps its own uploads (data URLs) and every
 * bundled file the preset still ships, but drops links to bundled files that no longer exist.
 */
function dropRetiredBundledAssets(identity: BrandIdentity, preset: BrandIdentity): BrandIdentity {
  const shipped = new Set(preset.assets.map(({ path }) => path));
  const assets = identity.assets.filter(({ path }) => !/^\/(brands|templates|screenshots)\//.test(path) || shipped.has(path));
  return assets.length === identity.assets.length ? identity : { ...identity, assets };
}

function migrateStoredBuiltIn(identity: BrandIdentity, preset: BrandIdentity): BrandIdentity {
  const migrated = migrateBasementDisplaySpacing(
    migrateGtTypography(identity, preset, DEFAULT_BRAND_FONT_ASSETS),
    preset
  ) ?? identity;
  return dropRetiredBundledAssets(migrated, preset);
}

/** The shipped version of a built-in identity, ready to replace an edited copy. */
export function restoreBuiltInBrandIdentity(id: string): BrandIdentity | undefined {
  const preset = BUILT_IN_BRAND_IDENTITIES.find((candidate) => candidate.id === id);
  if (!preset) return undefined;
  const shipped = cloneBrandIdentity(preset);
  return { ...shipped, builtIn: true, presetFingerprint: brandIdentityFingerprint(shipped) };
}

/** True when a built-in identity differs from the preset it was hydrated from. */
export function isEditedBuiltInIdentity(identity: BrandIdentity): boolean {
  return identity.builtIn
    && typeof identity.presetFingerprint === 'string'
    && brandIdentityFingerprint(identity) !== identity.presetFingerprint;
}

/** Fill defaults and copy nested records without dropping unknown fields. */
export function normalizeBrandIdentity(identity: BrandIdentity): BrandIdentity {
  return cloneBrandIdentity(identity);
}

export function hydrateBrandIdentities(value: unknown): BrandIdentity[] {
  const storedIdentities = Array.isArray(value) ? value.filter(isBrandIdentity) : [];
  const builtInIds = new Set(BUILT_IN_BRAND_IDENTITIES.map(({ id }) => id));
  const retiredBuiltInIds = new Set(['template']);
  const customIdentities = storedIdentities.filter(
    ({ id }) => !builtInIds.has(id) && !retiredBuiltInIds.has(id)
  );
  const builtInIdentities = BUILT_IN_BRAND_IDENTITIES.map((preset) => {
    const storedIdentity = storedIdentities.find(({ id }) => id === preset.id);
    const shipped = cloneBrandIdentity(preset);
    // Untouched built-ins always refresh to the shipped preset. Edited ones keep
    // every stored value on any revision; the preset only backfills missing fields.
    const identity = !storedIdentity || isPristineBuiltInIdentity(storedIdentity)
      ? shipped
      : mergeBrandIdentity(migrateStoredBuiltIn(storedIdentity, preset), preset);
    return {
      ...identity,
      builtIn: true,
      id: preset.id,
      kind: preset.kind,
      presetFingerprint: brandIdentityFingerprint(shipped),
      revision: preset.revision,
    };
  });
  const hydratedCustomIdentities = customIdentities.map((identity) => {
      const clonedIdentity = cloneBrandIdentity(identity);
      const { colors, id: seed, shortName } = clonedIdentity;
      const generatedAssets = createPixelBrandAssets(shortName, seed, colors);
      // Missing marks are added and generated ones redrawn, so they follow the current name and palette.
      return {
        ...clonedIdentity,
        assets: [
          ...generatedAssets.filter(
            (generatedAsset) =>
              !clonedIdentity.assets.some(({ id }) => id === generatedAsset.id)
          ),
          ...updateGeneratedPixelAssets(clonedIdentity.assets, shortName, seed, colors),
        ],
        builtIn: false,
        kind: 'custom' as const,
      };
    });
  return [
    ...builtInIdentities.filter(({ kind }) => kind === 'template'),
    ...hydratedCustomIdentities,
    ...builtInIdentities.filter(({ kind }) => kind === 'example'),
  ];
}

export function nextBrandIdentityCopyName(
  name: string,
  existingNames: readonly string[]
): string {
  const trimmedName = name.trim() || 'Untitled brand';
  const baseName = trimmedName.replace(/\s+copy(?:\s+\d+)?$/i, '').trim() || trimmedName;
  const occupiedNames = new Set(existingNames.map((candidate) => candidate.trim().toLocaleLowerCase()));
  let copyNumber = 1;
  while (occupiedNames.has(`${baseName} copy ${copyNumber}`.toLocaleLowerCase())) copyNumber += 1;
  return `${baseName} copy ${copyNumber}`;
}

export function renameBrandIdentity(identity: BrandIdentity, name: string): BrandIdentity {
  const trimmedName = name.trim();
  if (!trimmedName || trimmedName === identity.name) return identity;
  const shortName = shortNameFromName(trimmedName);
  return {
    ...identity,
    assets: hasGeneratedPixelAssets(identity.assets)
      ? updateGeneratedPixelAssets(identity.assets, shortName || identity.shortName, identity.id, identity.colors)
      : identity.assets,
    name: trimmedName,
    shortName: shortName || identity.shortName,
  };
}

export function duplicateBrandIdentity(
  identity: BrandIdentity,
  id = crypto.randomUUID(),
  existingNames: readonly string[] = []
): BrandIdentity {
  const clonedIdentity = cloneBrandIdentity(identity);
  return {
    ...clonedIdentity,
    assets: hasGeneratedPixelAssets(clonedIdentity.assets)
      ? updateGeneratedPixelAssets(clonedIdentity.assets, clonedIdentity.shortName, id, clonedIdentity.colors)
      : clonedIdentity.assets,
    builtIn: false,
    id,
    kind: 'custom',
    name: nextBrandIdentityCopyName(identity.name, existingNames),
  };
}

export function brandAssetPath(identity: BrandIdentity, id: string): string | undefined {
  return identity.assets.find((asset) => asset.id === id)?.path;
}
