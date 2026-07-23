export type BrandAsset = {
  id: string;
  label: string;
  path: string;
  surface: 'light' | 'dark' | 'any';
  type: 'logo' | 'product' | 'proof';
};

export type BrandColor = {
  hex: string;
  id: string;
  name: string;
  role: string;
};

export type BrandTypography = {
  family: string;
  role: 'Display' | 'Body' | 'Accent' | 'Code';
  usage: string;
};

export type BrandMotion = {
  curve: string;
  description: string;
  durationMs: number;
  id: string;
  name: string;
  previewPath: string;
};

export type BrandIdentity = {
  assets: BrandAsset[];
  audiences: string[];
  builtIn: boolean;
  colors: BrandColor[];
  description: string;
  greetings: string[];
  id: string;
  kind: 'template' | 'example' | 'custom';
  motion: BrandMotion[];
  name: string;
  positioning: string;
  products: string[];
  proof: string[];
  proofAssets: BrandAsset[];
  shortName: string;
  sourceNotes: string[];
  tagline: string;
  typography: BrandTypography[];
  voice: {
    avoid: string[];
    phrases: string[];
    principles: string[];
  };
  website: string;
};

export const GT_BRAND_IDENTITY: BrandIdentity = {
  assets: [
    {
      id: 'mark-dark',
      label: 'Black mark',
      path: '/brands/gt/logos/mark-black.svg',
      surface: 'light',
      type: 'logo',
    },
    {
      id: 'mark-light',
      label: 'White mark',
      path: '/brands/gt/logos/mark-white.svg',
      surface: 'dark',
      type: 'logo',
    },
    {
      id: 'banner',
      label: 'GT banner',
      path: '/brands/gt/logos/banner-black.svg',
      surface: 'light',
      type: 'logo',
    },
    {
      id: 'wordmark',
      label: 'General Translation wordmark',
      path: '/brands/gt/logos/wordmark-black.svg',
      surface: 'light',
      type: 'logo',
    },
    {
      id: 'wordmark-light',
      label: 'General Translation white wordmark',
      path: '/brands/gt/logos/wordmark-white.svg',
      surface: 'dark',
      type: 'logo',
    },
    {
      id: 'locadex',
      label: 'Locadex wordmark',
      path: '/brands/gt/logos/locadex-black.svg',
      surface: 'light',
      type: 'product',
    },
  ],
  audiences: [
    'Product engineers',
    'Localization teams',
    'Developer-first companies',
    'AI-native product teams',
  ],
  builtIn: true,
  colors: [
    { hex: '#181818', id: 'ink', name: 'Ink', role: 'Primary text and dark surfaces' },
    { hex: '#FFFFFF', id: 'paper', name: 'Paper', role: 'Base background' },
    { hex: '#F4F4F4', id: 'muted', name: 'Mist', role: 'Quiet surfaces and secondary controls' },
    { hex: '#E4E4E4', id: 'emphasis', name: 'Silver', role: 'Focus, selection, and primary emphasis' },
    { hex: '#D4D4D4', id: 'success', name: 'Cloud', role: 'Completed and healthy status' },
    { hex: '#A3A3A3', id: 'warning', name: 'Slate', role: 'Attention and warning status' },
    { hex: '#525252', id: 'progress', name: 'Graphite', role: 'Active and in-progress status' },
    { hex: '#262626', id: 'error', name: 'Charcoal', role: 'Destructive and error states' },
  ],
  description:
    'The end-to-end internationalization platform for developers, spanning product code, context-aware translation, delivery, and automated repository work.',
  greetings: ['Welcome', 'Bienvenidos', '你好', 'ようこそ', 'أهلاً وسهلاً'],
  id: 'gt',
  kind: 'example',
  motion: [
    {
      curve: 'cubic-bezier(0.4, 0, 0.2, 1)',
      description: 'Fast centered language morph with a one-second word hold.',
      durationMs: 1000,
      id: 'morph-1000',
      name: 'Morph / 1.00 s',
      previewPath: '/examples/gt-morph-one-second.gif',
    },
    {
      curve: 'cubic-bezier(0.4, 0, 0.2, 1)',
      description: 'The default centered morph cadence for brand introductions.',
      durationMs: 1250,
      id: 'morph-1250',
      name: 'Morph / 1.25 s',
      previewPath: '/examples/gt-morph.gif',
    },
    {
      curve: 'cubic-bezier(0.4, 0, 0.2, 1)',
      description: 'A more spacious morph for hero and presentation surfaces.',
      durationMs: 1500,
      id: 'morph-1500',
      name: 'Morph / 1.50 s',
      previewPath: '/examples/gt-morph-fast.gif',
    },
    {
      curve: 'cubic-bezier(0.4, 0, 0.2, 1)',
      description: 'Letter-by-letter typing and deletion without a cursor.',
      durationMs: 1750,
      id: 'type-delete',
      name: 'Type + delete',
      previewPath: '/examples/gt-type-delete.gif',
    },
  ],
  name: 'General Translation',
  positioning:
    'Code remains the source of truth while GT keeps product copy, documentation, and code moving together across locales.',
  products: ['Internationalization', 'Translation', 'Locadex', 'CDN delivery'],
  proof: ['Cursor', 'Cognition', 'Windsurf', 'Ramp', 'Mintlify', 'ClickHouse'],
  proofAssets: [
    { id: 'cursor', label: 'Cursor', path: '/brands/gt/proof/cursor.svg', surface: 'light', type: 'proof' },
    { id: 'ramp', label: 'Ramp', path: '/brands/gt/proof/ramp.svg', surface: 'light', type: 'proof' },
    { id: 'mintlify', label: 'Mintlify', path: '/brands/gt/proof/mintlify.svg', surface: 'light', type: 'proof' },
    { id: 'clickhouse', label: 'ClickHouse', path: '/brands/gt/proof/clickhouse.svg', surface: 'light', type: 'proof' },
    { id: 'windsurf', label: 'Windsurf', path: '/brands/gt/proof/windsurf.svg', surface: 'light', type: 'proof' },
  ],
  shortName: 'GT',
  sourceNotes: [
    'Identity assets from the dashboard and landing applications',
    'Semantic tokens and component rules audited from the GT product system',
    'Product language from landing metadata, llms.txt, and onboarding email',
    'Motion studies from the GT multilingual email animation set',
  ],
  tagline: 'End-to-end localization for the world’s best companies.',
  typography: [
    { family: 'Inter', role: 'Display', usage: 'Headlines, product UI, and high-emphasis brand copy' },
    { family: 'Inter', role: 'Body', usage: 'Interface copy, documentation, and long-form text' },
    { family: 'Inter', role: 'Accent', usage: 'Multilingual specimens and editorial emphasis' },
    { family: 'Geist Mono', role: 'Code', usage: 'Commands, identifiers, tokens, and technical metadata' },
  ],
  voice: {
    avoid: [
      'Abstract global-growth clichés',
      'Unverifiable speed claims',
      'Translation language detached from developer workflow',
    ],
    phrases: [
      'Code is the source of truth.',
      'Full-stack localization across buildtime, runtime, and review.',
      'Let Locadex open the PR.',
    ],
    principles: ['Developer-first', 'Direct and concrete', 'Technically credible', 'Globally aware'],
  },
  website: 'generaltranslation.com',
};

export const STARTER_BRAND_IDENTITY: BrandIdentity = {
  ...cloneBrandIdentity(GT_BRAND_IDENTITY),
  assets: [
    {
      id: 'mark-dark',
      label: 'Starter black mark',
      path: '/templates/logos/starter-mark.svg',
      surface: 'light',
      type: 'logo',
    },
    {
      id: 'mark-light',
      label: 'Starter white mark',
      path: '/templates/logos/starter-mark-white.svg',
      surface: 'dark',
      type: 'logo',
    },
    {
      id: 'wordmark',
      label: 'Starter wordmark',
      path: '/templates/logos/starter-wordmark.svg',
      surface: 'light',
      type: 'logo',
    },
    {
      id: 'wordmark-light',
      label: 'Starter white wordmark',
      path: '/templates/logos/starter-wordmark-white.svg',
      surface: 'dark',
      type: 'logo',
    },
  ],
  audiences: ['Your primary audience', 'The people your product serves'],
  builtIn: true,
  description:
    'A clean starting system with a neutral foundation, one accent, practical type roles, and room for your own assets.',
  greetings: ['Hello', 'Your idea', 'Your language'],
  id: 'starter',
  kind: 'template',
  motion: [],
  name: 'Starter',
  positioning: 'Describe what you make, who it is for, and why it matters in one concrete sentence.',
  products: ['Product', 'Platform', 'Community'],
  proof: [],
  proofAssets: [],
  shortName: 'ST',
  sourceNotes: [
    'A reusable starting point included with Glyphfield',
    'Duplicate this project to create a persistent brand workspace',
    'Open the GT project to see a fully populated identity',
  ],
  tagline: 'A clear idea, made repeatable.',
  voice: {
    avoid: ['Vague claims', 'Generic superlatives'],
    phrases: ['Say one useful thing clearly.'],
    principles: ['Clear', 'Specific', 'Consistent', 'Recognizable'],
  },
  website: 'yourbrand.com',
};

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
    assets: identity.assets.map((asset) => ({ ...asset })),
    audiences: [...identity.audiences],
    colors: identity.colors.map((color) => ({ ...color })),
    greetings: [...identity.greetings],
    motion: identity.motion.map((motion) => ({ ...motion })),
    products: [...identity.products],
    proof: [...identity.proof],
    proofAssets: identity.proofAssets.map((asset) => ({ ...asset })),
    sourceNotes: [...identity.sourceNotes],
    typography: identity.typography.map((font) => ({ ...font })),
    voice: {
      avoid: [...identity.voice.avoid],
      phrases: [...identity.voice.phrases],
      principles: [...identity.voice.principles],
    },
  };
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
    assets: createPixelBrandAssets(resolvedShortName, id),
    audiences: [],
    builtIn: false,
    colors: GT_BRAND_IDENTITY.colors.map((color) => ({ ...color })),
    description: 'A local brand identity ready for assets, tokens, motion, and repeatable graphics.',
    greetings: ['Welcome'],
    id,
    kind: 'custom',
    motion: [],
    name: trimmedName,
    positioning: 'Add a concise positioning statement for this identity.',
    products: [],
    proof: [],
    proofAssets: [],
    shortName: resolvedShortName,
    sourceNotes: ['Created locally in Glyphfield'],
    tagline: 'Add a clear brand line.',
    typography: GT_BRAND_IDENTITY.typography.map((font) => ({ ...font })),
    voice: {
      avoid: [],
      phrases: [],
      principles: ['Clear', 'Specific', 'Consistent'],
    },
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
  const customIdentities = Array.isArray(value)
    ? value
        .filter(isBrandIdentity)
        .filter(
          ({ id }) => id !== GT_BRAND_IDENTITY.id && id !== STARTER_BRAND_IDENTITY.id
        )
    : [];
  return [
    cloneBrandIdentity(STARTER_BRAND_IDENTITY),
    ...customIdentities.map((identity) => {
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
    }),
    cloneBrandIdentity(GT_BRAND_IDENTITY),
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
