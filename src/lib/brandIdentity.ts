import {
  BASEMENT_BRAND_IDENTITY,
  BUILT_IN_BRAND_IDENTITIES,
  GT_BRAND_IDENTITY,
  STARTER_BRAND_IDENTITY,
  TEMPLATE_BRAND_IDENTITY,
} from './identityPresets';

export {
  BASEMENT_BRAND_IDENTITY,
  BUILT_IN_BRAND_IDENTITIES,
  GT_BRAND_IDENTITY,
  STARTER_BRAND_IDENTITY,
  TEMPLATE_BRAND_IDENTITY,
};

export type BrandAsset = {
  id: string;
  label: string;
  path: string;
  surface: 'light' | 'dark' | 'any';
  type: 'background' | 'icon' | 'image' | 'logo' | 'product' | 'proof' | 'texture';
  usage?: string;
};

export type BrandColor = {
  hex: string;
  id: string;
  name: string;
  role: string;
};

export type BrandTypography = {
  family: string;
  fontId?: string;
  letterSpacing?: number;
  lineHeight?: number;
  role: 'Display' | 'Body' | 'Accent' | 'Code';
  usage: string;
  weight?: number;
};

export type BrandFontAsset = {
  family: string;
  fileName: string;
  format: 'opentype' | 'truetype' | 'woff' | 'woff2';
  id: string;
  label: string;
  path: string;
  style: 'italic' | 'normal';
  weight: number;
  weightMax?: number;
  weightMin?: number;
};

export type BrandMotion = {
  curve: string;
  description: string;
  durationMs: number;
  id: string;
  name: string;
  previewPath: string;
};

export type BrandStyle = {
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

export type BrandStrategy = {
  challenge: string;
  concept: string;
  outcome: string;
  personality: string[];
  pillars: string[];
  promise: string;
};

export type BrandGraphicSystem = {
  composition: string;
  description: string;
  device: string;
  imageDirection: string;
  pattern: 'blocks' | 'brackets' | 'burst' | 'circuit' | 'flow' | 'grid' | 'orbit' | 'rays' | 'steps' | 'wave';
  rules: string[];
};

export const DEFAULT_BRAND_STYLE: BrandStyle = {
  borderRadius: 6,
  density: 'comfortable',
  grid: 'none',
  imageTreatment: 'natural',
  logoScale: 100,
};

export type BrandIdentity = {
  applications: BrandApplication[];
  assets: BrandAsset[];
  audiences: string[];
  builtIn: boolean;
  colors: BrandColor[];
  contactEmail: string;
  description: string;
  fonts?: BrandFontAsset[];
  greetings: string[];
  graphicSystem: BrandGraphicSystem;
  id: string;
  kind: 'template' | 'example' | 'custom';
  motion: BrandMotion[];
  mission: string;
  name: string;
  positioning: string;
  products: string[];
  proof: string[];
  proofAssets: BrandAsset[];
  revision: number;
  shortName: string;
  socialHandle: string;
  sourceNotes: string[];
  style: BrandStyle;
  strategy: BrandStrategy;
  tagline: string;
  typography: BrandTypography[];
  voice: {
    avoid: string[];
    phrases: string[];
    principles: string[];
  };
  values: string[];
  website: string;
};

export const DEFAULT_BRAND_FONT_ASSETS: readonly BrandFontAsset[] = [
  {
    family: 'Switzer',
    fileName: 'Switzer-Regular.ttf',
    format: 'truetype',
    id: 'switzer-400',
    label: 'Switzer Regular',
    path: '/fonts/switzer-400.ttf',
    style: 'normal',
    weight: 400,
  },
  {
    family: 'Switzer',
    fileName: 'Switzer-Medium.ttf',
    format: 'truetype',
    id: 'switzer-500',
    label: 'Switzer Medium',
    path: '/fonts/switzer-500.ttf',
    style: 'normal',
    weight: 500,
  },
  {
    family: 'Inter',
    fileName: 'Inter-Variable.ttf',
    format: 'truetype',
    id: 'inter-variable',
    label: 'Inter Variable',
    path: '/fonts/inter-variable.ttf',
    style: 'normal',
    weight: 400,
    weightMax: 900,
    weightMin: 100,
  },
  {
    family: 'Geist Mono',
    fileName: 'GeistMono-Variable.ttf',
    format: 'truetype',
    id: 'geist-mono-variable',
    label: 'Geist Mono Variable',
    path: '/fonts/geist-mono-variable.ttf',
    style: 'normal',
    weight: 400,
    weightMax: 900,
    weightMin: 100,
  },
];

function bundledFontId(family: string, role: BrandTypography['role']): string | undefined {
  const normalizedFamily = family.toLocaleLowerCase();
  if (normalizedFamily.includes('switzer')) return role === 'Display' ? 'switzer-500' : 'switzer-400';
  if (normalizedFamily.includes('geist mono')) return 'geist-mono-variable';
  if (normalizedFamily.includes('inter')) return 'inter-variable';
  return undefined;
}

function normalizeTypography(font: BrandTypography): BrandTypography {
  return {
    ...font,
    fontId: font.fontId ?? bundledFontId(font.family, font.role),
    letterSpacing: font.letterSpacing ?? (font.role === 'Display' ? -3 : 0),
    lineHeight: font.lineHeight ?? (font.role === 'Display' ? 0.96 : 1.5),
    weight: font.weight ?? (font.role === 'Display' ? 700 : font.role === 'Code' ? 450 : 400),
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

export function brandFontFaceCss(identity: BrandIdentity): string {
  return brandFontAssets(identity)
    .map((font) => {
      const weight = font.weightMin !== undefined && font.weightMax !== undefined
        ? `${font.weightMin} ${font.weightMax}`
        : String(font.weight);
      return `@font-face{font-family:${JSON.stringify(font.family)};src:url(${JSON.stringify(font.path)}) format(${JSON.stringify(font.format)});font-style:${font.style};font-weight:${weight};font-display:swap;}`;
    })
    .join('');
}

const PIXEL_GLYPHS: Record<string, string> = {
  '0': '111/101/101/101/111',
  '1': '010/110/010/010/111',
  '2': '110/001/111/100/111',
  '3': '110/001/111/001/110',
  '4': '101/101/111/001/001',
  '5': '111/100/110/001/110',
  '6': '011/100/111/101/111',
  '7': '111/001/010/010/010',
  '8': '111/101/111/101/111',
  '9': '111/101/111/001/110',
  A: '010/101/111/101/101',
  B: '110/101/110/101/110',
  C: '011/100/100/100/011',
  D: '110/101/101/101/110',
  E: '111/100/110/100/111',
  F: '111/100/110/100/100',
  G: '011/100/101/101/011',
  H: '101/101/111/101/101',
  I: '111/010/010/010/111',
  J: '001/001/001/101/010',
  K: '101/101/110/101/101',
  L: '100/100/100/100/111',
  M: '101/111/111/101/101',
  N: '101/111/111/111/101',
  O: '010/101/101/101/010',
  P: '110/101/110/100/100',
  Q: '010/101/101/111/011',
  R: '110/101/110/101/101',
  S: '011/100/010/001/110',
  T: '111/010/010/010/010',
  U: '101/101/101/101/111',
  V: '101/101/101/101/010',
  W: '101/101/111/111/101',
  X: '101/101/010/101/101',
  Y: '101/101/010/010/010',
  Z: '111/001/010/100/111',
};

function hashPixelSeed(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createPixelRandom(seed: string): () => number {
  let state = hashPixelSeed(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function createPixelMark(label: string, seed: string, inverted: boolean): string {
  const normalizedLabel = label.replace(/[^A-Z0-9]/gi, '').toLocaleUpperCase().slice(0, 3) || 'BR';
  const random = createPixelRandom(`${seed}:${normalizedLabel}:${inverted ? 'light' : 'dark'}`);
  const background = inverted ? '#FFFFFF' : '#181818';
  const foreground = inverted ? '#181818' : '#FFFFFF';
  const pixelSize = normalizedLabel.length === 1 ? 6 : normalizedLabel.length === 2 ? 5 : 4;
  const labelWidth = normalizedLabel.length * pixelSize * 3 + (normalizedLabel.length - 1) * pixelSize;
  const labelX = (64 - labelWidth) / 2;
  const labelY = (64 - pixelSize * 5) / 2;

  const texture = Array.from({ length: 18 }, () => {
    let x = Math.floor(random() * 14 + 1) * 4;
    let y = Math.floor(random() * 14 + 1) * 4;
    if (x > 8 && x < 56 && y > 12 && y < 52) {
      y = random() > 0.5 ? 4 : 56;
    }
    const size = random() > 0.78 ? 8 : 4;
    const opacity = (0.08 + random() * 0.14).toFixed(2);
    return `<rect x="${Math.min(x, 60)}" y="${Math.min(y, 60)}" width="${size}" height="${size}" fill="${foreground}" opacity="${opacity}"/>`;
  }).join('');

  const glyphs = [...normalizedLabel]
    .map((character, characterIndex) => {
      const rows = (PIXEL_GLYPHS[character] ?? '111/101/010/000/010').split('/');
      return rows
        .flatMap((row, rowIndex) =>
          [...row].map((pixel, columnIndex) =>
            pixel === '1'
              ? `<rect x="${labelX + characterIndex * pixelSize * 4 + columnIndex * pixelSize}" y="${labelY + rowIndex * pixelSize}" width="${pixelSize}" height="${pixelSize}"/>`
              : ''
          )
        )
        .join('');
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges"><rect width="64" height="64" fill="${background}"/>${texture}<g fill="${foreground}">${glyphs}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function createPixelBrandAssets(label: string, seed: string): BrandAsset[] {
  return [
    {
      id: 'mark-dark',
      label: 'Generated pixel mark / dark',
      path: createPixelMark(label, seed, false),
      surface: 'light',
      type: 'logo',
    },
    {
      id: 'mark-light',
      label: 'Generated pixel mark / light',
      path: createPixelMark(label, seed, true),
      surface: 'dark',
      type: 'logo',
    },
  ];
}

function hasGeneratedPixelAssets(identity: BrandIdentity): boolean {
  return identity.assets.some(({ label }) => label.startsWith('Generated pixel mark'));
}

export function updateGeneratedPixelAssets(
  assets: BrandAsset[],
  label: string,
  seed: string
): BrandAsset[] {
  const generatedAssets = createPixelBrandAssets(label, seed);
  return assets.map((asset) =>
    asset.label.startsWith('Generated pixel mark')
      ? generatedAssets.find(({ id }) => id === asset.id) ?? asset
      : asset
  );
}

function cloneBrandIdentity(identity: BrandIdentity): BrandIdentity {
  return {
    ...identity,
    applications: (identity.applications ?? STARTER_BRAND_IDENTITY.applications).map(
      (application) => ({ ...application })
    ),
    assets: identity.assets.map((asset) => ({ ...asset })),
    audiences: [...(identity.audiences ?? [])],
    colors: (identity.colors ?? []).map((color) => ({ ...color })),
    contactEmail: identity.contactEmail ?? '',
    fonts: brandFontAssets(identity).map((font) => ({ ...font })),
    greetings: [...(identity.greetings ?? [])],
    graphicSystem: {
      ...STARTER_BRAND_IDENTITY.graphicSystem,
      ...identity.graphicSystem,
      rules: [
        ...(identity.graphicSystem?.rules ?? STARTER_BRAND_IDENTITY.graphicSystem.rules),
      ],
    },
    mission: identity.mission ?? identity.positioning ?? '',
    motion: (identity.motion ?? []).map((motion) => ({ ...motion })),
    products: [...(identity.products ?? [])],
    proof: [...(identity.proof ?? [])],
    proofAssets: (identity.proofAssets ?? []).map((asset) => ({ ...asset })),
    revision: identity.revision ?? 1,
    socialHandle: identity.socialHandle ?? '',
    sourceNotes: [...(identity.sourceNotes ?? [])],
    style: { ...DEFAULT_BRAND_STYLE, ...identity.style },
    strategy: {
      ...STARTER_BRAND_IDENTITY.strategy,
      ...identity.strategy,
      personality: [
        ...(identity.strategy?.personality ?? STARTER_BRAND_IDENTITY.strategy.personality),
      ],
      pillars: [
        ...(identity.strategy?.pillars ?? STARTER_BRAND_IDENTITY.strategy.pillars),
      ],
    },
    typography: (identity.typography ?? []).map(normalizeTypography),
    values: [...(identity.values ?? [])],
    voice: {
      avoid: [...(identity.voice?.avoid ?? [])],
      phrases: [...(identity.voice?.phrases ?? [])],
      principles: [...(identity.voice?.principles ?? [])],
    },
  };
}

function mergeBrandIdentity(
  identity: BrandIdentity,
  fallback: BrandIdentity
): BrandIdentity {
  return cloneBrandIdentity({
    ...fallback,
    ...identity,
    applications: identity.applications ?? fallback.applications,
    contactEmail: identity.contactEmail ?? fallback.contactEmail,
    graphicSystem: {
      ...fallback.graphicSystem,
      ...identity.graphicSystem,
      rules: identity.graphicSystem?.rules ?? fallback.graphicSystem.rules,
    },
    mission: identity.mission ?? fallback.mission,
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

export function createBrandIdentity(name: string, id = crypto.randomUUID()): BrandIdentity {
  const trimmedName = name.trim() || 'Untitled brand';
  const shortName = trimmedName
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toLocaleUpperCase();

  const resolvedShortName = shortName || 'BR';

  return {
    applications: STARTER_BRAND_IDENTITY.applications.map((item) => ({ ...item })),
    assets: createPixelBrandAssets(resolvedShortName, id),
    audiences: [],
    builtIn: false,
    colors: GT_BRAND_IDENTITY.colors.map((color) => ({ ...color })),
    contactEmail: '',
    description: 'A local brand identity ready for assets, tokens, motion, and repeatable graphics.',
    fonts: DEFAULT_BRAND_FONT_ASSETS.map((font) => ({ ...font })),
    greetings: ['Welcome'],
    graphicSystem: {
      composition: 'Choose a consistent layout behavior for this identity.',
      description: 'Define the recognizable graphic device that connects every application.',
      device: 'Add a graphic device',
      imageDirection: 'Describe subject, crop, color treatment, and caption behavior.',
      pattern: 'grid',
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
    typography: GT_BRAND_IDENTITY.typography.map(normalizeTypography),
    voice: {
      avoid: [],
      phrases: [],
      principles: ['Clear', 'Specific', 'Consistent'],
    },
    values: ['Clarity', 'Utility', 'Consistency'],
    website: '',
  };
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

export function hydrateBrandIdentities(value: unknown): BrandIdentity[] {
  const storedIdentities = Array.isArray(value) ? value.filter(isBrandIdentity) : [];
  const builtInIds = new Set(BUILT_IN_BRAND_IDENTITIES.map(({ id }) => id));
  const customIdentities = storedIdentities.filter(
    ({ id }) => !builtInIds.has(id)
  );
  const builtInIdentities = BUILT_IN_BRAND_IDENTITIES.map((preset) => {
    const storedIdentity = storedIdentities.find(({ id }) => id === preset.id);
    const identity =
      storedIdentity?.revision === preset.revision
        ? mergeBrandIdentity(storedIdentity, preset)
        : cloneBrandIdentity(preset);
    return {
      ...identity,
      builtIn: true,
      id: preset.id,
      kind: preset.kind,
      revision: preset.revision,
    };
  });
  const hydratedCustomIdentities = customIdentities.map((identity) => {
      const clonedIdentity = cloneBrandIdentity(identity);
      const generatedAssets = createPixelBrandAssets(
        clonedIdentity.shortName,
        clonedIdentity.id
      );
      return {
        ...clonedIdentity,
        assets: [
          ...generatedAssets.filter(
            (generatedAsset) =>
              !clonedIdentity.assets.some(({ id }) => id === generatedAsset.id)
          ),
          ...clonedIdentity.assets,
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

export function duplicateBrandIdentity(identity: BrandIdentity, id = crypto.randomUUID()): BrandIdentity {
  const clonedIdentity = cloneBrandIdentity(identity);
  return {
    ...clonedIdentity,
    assets: hasGeneratedPixelAssets(clonedIdentity)
      ? updateGeneratedPixelAssets(clonedIdentity.assets, clonedIdentity.shortName, id)
      : clonedIdentity.assets,
    builtIn: false,
    id,
    kind: 'custom',
    name: `${identity.name} copy`,
  };
}

export function brandAssetPath(identity: BrandIdentity, id: string): string | undefined {
  return identity.assets.find((asset) => asset.id === id)?.path;
}
