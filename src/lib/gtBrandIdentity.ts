import type { BrandAsset, BrandFontAsset, BrandIdentity } from './brandIdentity';
import { GT_SYSTEM } from './gtBrandSystem';
import { application, asset, REVISION } from './identityPresetHelpers';

type GtPicture = {
  alt: string;
  credit: string;
  file: string;
  focal?: [number, number];
  label: string;
  /** Artifact pictures are cut from public-domain or CC originals; the rest is GT artwork. */
  license?: string;
  original?: { owner: string; url: string };
  slot: string;
  surface: BrandAsset['surface'];
  type: BrandAsset['type'];
};

const GT_ARTWORK = '© General Translation, Inc. Brand-system artwork included with permission for this identity; not covered by Glyphfield\'s MIT license';

// Slots the templates read first, then the rest of the set. Mood pictures follow GT's artifact
// picture standard: the brand's tone grid, screened through the 8 x 8 Bayer matrix at 1px cells.
const GT_PICTURES: readonly GtPicture[] = [
  { alt: 'The earth drawn in characters from twenty writing systems on ink', credit: 'The glyph globe, General Translation', file: 'glyph-globe.webp', focal: [0.66, 0.5], label: 'Glyph globe', slot: 'overview', surface: 'dark', type: 'image' },
  { alt: 'The Rosetta Stone printed in the Bayer dither on ink', credit: 'Photograph: Hans Hillewaert, CC BY-SA 4.0; screened by General Translation', file: 'rosetta-stone.png', original: { owner: 'Hans Hillewaert', url: 'https://commons.wikimedia.org/wiki/File:Rosetta_Stone.JPG' }, focal: [0.6, 0.45], label: 'The Rosetta Stone', license: 'CC BY-SA 4.0', slot: 'editorial', surface: 'dark', type: 'image' },
  { alt: 'A Latin manuscript page with a marginal gloss, dithered on paper', credit: 'Image: MS f Med. 23, Boston Public Library, public domain', file: 'marginal-gloss.png', original: { owner: 'Boston Public Library', url: 'https://commons.wikimedia.org/wiki/File:Alexandreis_with_gloss_-_in_Latin_-_DPLA_-_98b56ea1ebec780d88ec0bdfa6750159_%28page_69%29.jpg' }, label: 'A marginal gloss', license: 'Public domain', slot: 'detail', surface: 'light', type: 'texture' },
  { alt: 'The Blue Marble, the western hemisphere dithered on ink', credit: 'Image: NASA, Reto Stöckli, 2007, public domain', file: 'blue-marble.png', original: { owner: 'NASA', url: 'https://commons.wikimedia.org/wiki/File:Blue_Marble_Western_Hemisphere.jpg' }, focal: [0.2, 0.5], label: 'The Blue Marble', license: 'Public domain', slot: 'atmosphere', surface: 'dark', type: 'background' },
  { alt: 'The Great Wave off Kanagawa dithered on paper', credit: 'Print: Katsushika Hokusai, about 1831, public domain', file: 'great-wave.png', original: { owner: 'Katsushika Hokusai', url: 'https://commons.wikimedia.org/wiki/File:Tsunami_by_hokusai_19th_century.jpg' }, focal: [0.4, 0.45], label: 'The Great Wave', license: 'Public domain', slot: 'campaign', surface: 'light', type: 'image' },
  { alt: 'Code wrapped in the T component beside the page it translates', credit: 'How General Translation works, General Translation', file: 'how-gt-works.webp', focal: [0.5, 0.5], label: 'You wrap your text in <T>', slot: 'interface', surface: 'dark', type: 'product' },
  { alt: 'Glyphs from many writing systems drifting across ink', credit: 'The glyph field, General Translation', file: 'glyph-field.webp', label: 'Glyph field', slot: 'motion', surface: 'dark', type: 'motion' },
  { alt: 'The dithered globe with the doubled-line GT mark at its center', credit: 'The dithered globe, General Translation', file: 'globe-mark.webp', label: 'Globe and mark', slot: 'hero', surface: 'dark', type: 'image' },
  { alt: 'Submarine telegraph cables of 1901 dithered on ink', credit: 'Map: Eastern Telegraph Company, 1901, public domain', file: 'telegraph-cables.png', original: { owner: 'Eastern Telegraph Company', url: 'https://commons.wikimedia.org/wiki/File:1901_Eastern_Telegraph_cables.png' }, focal: [0.6, 0.45], label: 'Telegraph cables, 1901', license: 'Public domain', slot: 'workflow', surface: 'dark', type: 'image' },
  { alt: 'GENERAL over TRANSLATION in the race-type livery stack', credit: 'The livery stack speed mark, General Translation', file: 'speed-livery.webp', label: 'Livery stack', slot: 'system', surface: 'light', type: 'image' },
  { alt: 'A Sanskrit manuscript in Devanagari dithered on ink', credit: 'Photograph: Ms Sarah Welch, CC BY-SA 4.0; screened by General Translation', file: 'devanagari-manuscript.png', original: { owner: 'Ms Sarah Welch', url: 'https://commons.wikimedia.org/wiki/File:Prashna_Upanishad_sample_manuscript_page,_Sanskrit,_Devanagari_script.jpg' }, label: 'Devanagari manuscript', license: 'CC BY-SA 4.0', slot: 'material', surface: 'dark', type: 'texture' },
  { alt: 'Horizon lines crossing a sphere on ink', credit: 'The horizon field, General Translation', file: 'horizon-field.webp', focal: [0.5, 0.7], label: 'Horizon field', slot: 'signal', surface: 'dark', type: 'background' },
  { alt: 'Blue gem smoke in the signal accent', credit: 'Material: gem smoke, Paper Shaders, rendered in Glyphfield for General Translation', file: 'gem-smoke.webp', label: 'Signal gem smoke', slot: 'gem-smoke', surface: 'dark', type: 'background' },
  { alt: 'The glyph globe on paper, ink land and blue ocean', credit: 'The glyph globe, General Translation', file: 'glyph-globe-light.webp', focal: [0.66, 0.5], label: 'Glyph globe on paper', slot: 'globe-light', surface: 'light', type: 'image' },
  { alt: 'The bar monogram printed as dither cells on ink', credit: 'The bar monogram speed mark, General Translation', file: 'speed-monogram.webp', label: 'Bar monogram', slot: 'speed-monogram', surface: 'dark', type: 'image' },
  { alt: 'An Ottoman calligraphy exercise dithered on paper', credit: 'Calligraphy: Ahmed Karahisari, 16th century, public domain', file: 'karahisari-calligraphy.png', original: { owner: 'Ahmed Karahisari', url: 'https://commons.wikimedia.org/wiki/File:Ahmed_Karahisari_-_Karalama_%28calligraphy_exercise%29_-_Google_Art_Project.jpg' }, label: "Karahisari's calligraphy", license: 'Public domain', slot: 'calligraphy', surface: 'light', type: 'texture' },
  { alt: 'A proto-cuneiform clay tablet dithered on ink', credit: 'Photograph: The Metropolitan Museum of Art, Open Access, public domain', file: 'cuneiform-tablet.png', original: { owner: 'The Metropolitan Museum of Art', url: 'https://images.metmuseum.org/CRDImages/an/original/DP293245.jpg' }, focal: [0.35, 0.45], label: 'Proto-cuneiform tablet', license: 'Public domain', slot: 'tablet', surface: 'dark', type: 'image' },
  { alt: "A mariner's compass rose engraved in 1748, dithered on paper", credit: 'Engraving: Emanuel Bowen, 1748, public domain', file: 'bowen-compass.png', original: { owner: 'Emanuel Bowen', url: 'https://commons.wikimedia.org/wiki/File:1748_Bowen_Mariner%27s_Compass_and_Armillary_Sphere_-_Geographicus_-_CircleofWinds-bowen-1747.jpg' }, label: "Bowen's compass", license: 'Public domain', slot: 'compass', surface: 'light', type: 'image' },
  { alt: 'The Louisbourg lighthouse against the sea at dusk', credit: 'Photograph: Ken Heaton, CC BY-SA 4.0; screened by General Translation', file: 'louisbourg-lighthouse.png', original: { owner: 'Ken Heaton', url: 'https://commons.wikimedia.org/wiki/File:Louisbourg_Lighthouse,_waves_breaking_in_a_fall_storm_1.jpg' }, focal: [0.45, 0.5], label: 'Louisbourg lighthouse', license: 'CC BY-SA 4.0', slot: 'lighthouse', surface: 'dark', type: 'image' },
];

function gtLibraryAssets(): BrandAsset[] {
  return GT_PICTURES.map(({ alt, credit, file, focal, label, license, original, slot, surface, type }) => {
    const artifact = Boolean(original);
    return {
      alt,
      attribution: credit,
      ...(focal ? { focalPoint: { x: focal[0], y: focal[1] } } : {}),
      id: `library-${slot}`,
      label,
      license: license ?? GT_ARTWORK,
      path: `/brands/gt/library/${file}`,
      redistribution: artifact ? 'bundled' : 'original',
      sourceOwner: original?.owner ?? 'General Translation',
      sourceUrl: original?.url ?? 'https://generaltranslation.com',
      surface,
      tags: [
        type,
        'source-native',
        artifact ? 'artifact-picture' : 'brand-system',
        'people-free',
        ...(type === 'product' ? ['centered-product'] : []),
        ...(type === 'background' || type === 'texture' ? ['background-safe'] : []),
      ],
      type,
      usage: artifact
        ? 'Artifact picture of writing or the sea, screened in GT\'s Bayer dither; show its credit where it is published.'
        : 'GT brand-system artwork for identity, editorial, launch and motion compositions.',
    };
  });
}

const GT_FONT_ASSETS: BrandFontAsset[] = [
  {
    family: 'Rasmus Inter',
    fileName: 'Inter-Variable.ttf',
    format: 'truetype',
    id: 'inter-variable',
    label: 'Rasmus Inter Variable',
    license: 'SIL Open Font License 1.1',
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
    license: 'SIL Open Font License 1.1',
    path: '/fonts/geist-mono-variable.ttf',
    style: 'normal',
    weight: 400,
    weightMax: 900,
    weightMin: 100,
  },
];

export const GT_BRAND_IDENTITY: BrandIdentity = {
  ...GT_SYSTEM,
  applications: [
    application('identity', 'Identity thesis', 'foundation', '1600 × 1000', 'The GT mark, multilingual promise, and source-of-truth idea in one opening composition.'),
    application('logo-family', 'Logo family', 'foundation', 'Responsive system', 'The GT mark, live-set company name, product lockups, and strict black-or-white surface behavior.'),
    application('language-motion', 'Language morph', 'marketing', 'GIF / video', 'Centered greetings move between writing systems with a short cubic-bezier morph fade.'),
    application('welcome-email', 'Welcome email', 'marketing', '640 px / responsive', 'A spare onboarding email that introduces the platform through language, product paths, and community.'),
    application('onboarding-sequence', 'Onboarding email sequence', 'marketing', 'Day 1 / 3 / 5 / 6', 'A milestone-aware program that adapts the next action to API-key, translation, and activation state.'),
    application('utility-email', 'Utility email family', 'product', 'Magic link / invitation', 'Straightforward authentication and invitation messages with one trusted action and concise recovery guidance.'),
    application('billing-alerts', 'Billing alert family', 'product', 'Balance / payment / limits', 'Operational threshold alerts that make urgency, account state, and the recovery action immediately legible.'),
    application('email-system-sheet', 'Email system contact sheet', 'foundation', '12+ templates', 'The complete lifecycle, utility, transactional, and billing program arranged for side-by-side system review.'),
    application('cli', 'Developer CLI', 'developer', '80 columns', 'Commands, locale state, diffs, and Locadex handoff rendered as a credible developer surface.'),
    application('product', 'Localization workspace', 'product', '1440 × 1024', 'Repository context, translation status, review state, and delivery are treated as one system.'),
    application('editorial', 'Engineering story', 'editorial', '1600 × 900', 'A high-contrast editorial cover pairing multilingual type with code-level detail.'),
    application('event', 'Global product pass', 'event', 'CR80 / lanyard', 'A monochrome attendee system whose variable field is language rather than decoration.'),
    application('social', 'Launch sequence', 'social', '1:1 / 16:9', 'Repeatable announcements built from locale metadata, open space, and centered language transitions.'),
    application('docs', 'Documentation header', 'developer', '1440 × 480', 'A technical masthead connecting framework packages, commands, and implementation guides.'),
  ],
  assets: [
    asset('mark-dark', 'Black GT mark', '/brands/gt/logos/mark-black.svg', 'light'),
    asset('mark-light', 'White GT mark', '/brands/gt/logos/mark-white.svg', 'dark'),
    { ...asset('identity-field', 'Glyph globe on ink', '/brands/gt/library/glyph-globe.webp', 'dark', 'background', 'The identity\'s cover field: the glyph globe on ink.'), attribution: 'The glyph globe, General Translation', focalPoint: { x: 0.66, y: 0.5 }, license: GT_ARTWORK, tags: ['background', 'brand-diagram', 'cover'] },
    ...gtLibraryAssets(),
  ],
  audiences: ['Product engineers', 'Localization teams', 'Developer-first companies', 'AI-native product teams'],
  builtIn: true,
  colorPairings: [
    { background: 'paper', foreground: 'ink', level: 'AA', usage: 'Body text and headlines' },
    { background: 'ink', foreground: 'paper', level: 'AA', usage: 'Reversed type on black' },
    { background: 'paper', foreground: 'progress', level: 'AA', usage: 'Secondary text and metadata' },
    { background: 'muted', foreground: 'ink', level: 'AA', usage: 'Text on quiet surfaces' },
    { background: 'emphasis', foreground: 'paper', level: 'AA', usage: 'Text on the signal accent' },
  ],
  colors: [
    { hex: '#070707', id: 'ink', name: 'Ink', proportion: 26, role: 'Primary type, marks and dark surfaces' },
    { hex: '#FFFFFF', id: 'paper', name: 'Paper', proportion: 62, role: 'Dominant light surface and reversed type' },
    { hex: '#F4F4F4', id: 'muted', name: 'Mist', proportion: 7, role: 'Quiet product and editorial surfaces' },
    { hex: '#2F5CE0', id: 'emphasis', name: 'Signal blue', proportion: 2, role: 'The one spectral accent: a single element per composition, lifted to #86A8FF on ink; never a wash' },
    { hex: '#D4D4D4', id: 'success', name: 'Cloud', proportion: 1, role: 'Completed and healthy states' },
    { hex: '#8A8F98', id: 'warning', name: 'Titanium', proportion: 1, role: 'Hairlines, metadata and large secondary marks; never small text on white' },
    { hex: '#525252', id: 'progress', name: 'Graphite', proportion: 1, role: 'Secondary text and in-progress states' },
    { hex: '#262626', id: 'error', name: 'Charcoal', proportion: 0, role: 'Destructive actions without introducing chroma' },
  ],
  contactEmail: 'hello@generaltranslation.com',
  customers: ['Cursor', 'Ramp', 'Mintlify', 'ClickHouse', 'Profound', 'Partiful'],
  description: 'Four absolute colors and one signal blue, Inter throughout, and writing systems as the material: a globe drawn in glyphs and pictures of writing printed in a 1-bit Bayer dither make one source resolving into every language feel like infrastructure.',
  greetings: ['Welcome', '你好', '환영합니다', 'ようこそ', 'أهلاً وسهلاً', 'Bienvenidos'],
  fonts: GT_FONT_ASSETS,
  graphicSystem: {
    composition: 'One decisive statement sits beside one glyph or dither picture, on ink or paper, with the blue accent spent on a single element.',
    description: 'Glyphs make up greater wholes: the earth drawn in twenty writing systems, a field of scripts condensing into one word, and historical writing printed as ordered dither.',
    device: 'The glyph globe',
    imageDirection: 'The glyph globe, the glyph field and artifact pictures of writing and the sea (the Rosetta Stone, manuscripts, calligraphy, cuneiform, the Blue Marble) screened in the 8 x 8 Bayer dither on ink or paper, each with its credit; real product shown through the T component. No stock photography, private people, flags, maps with borders, shadows or flowcharts.',
    pattern: 'none',
    rules: ['Four absolute colors plus one signal blue per composition', 'Square corners and 1px hairlines; no shadows', 'Print density as Bayer dither, never as alpha veils', 'Draw the GT mark in one ink, by itself', 'Set everything in Inter, headings at weight 500 or lighter', 'Keep headlines within two lines', 'Never connect content with diagram boxes or lines'],
  },
  id: 'gt',
  kind: 'example',
  mission: 'Make every product feel native in every language without disconnecting content from code.',
  motion: [
    { curve: 'cubic-bezier(0.4, 0, 0.2, 1)', description: 'Fast centered language morph with a one-second word hold.', durationMs: 1000, id: 'morph-1000', name: 'Morph / 1.00 s', previewPath: '/examples/gt-morph-one-second.gif' },
    { curve: 'cubic-bezier(0.4, 0, 0.2, 1)', description: 'The default centered morph cadence for brand introductions.', durationMs: 1250, id: 'morph-1250', name: 'Morph / 1.25 s', previewPath: '/examples/gt-morph.gif' },
    { curve: 'cubic-bezier(0.4, 0, 0.2, 1)', description: 'A more spacious morph for hero and presentation surfaces.', durationMs: 1500, id: 'morph-1500', name: 'Morph / 1.50 s', previewPath: '/examples/gt-morph-fast.gif' },
    { curve: 'cubic-bezier(0.4, 0, 0.2, 1)', description: 'Letter-by-letter typing and deletion without a cursor.', durationMs: 1750, id: 'type-delete', name: 'Type + delete', previewPath: '/examples/gt-type-delete.gif' },
  ],
  name: 'General Translation',
  positioning: 'GT is the internationalization infrastructure for teams that want product language to move with their code—from authoring and context to review, automation, and delivery.',
  productDetails: [
    { name: 'Internationalization', summary: 'Open-source i18n libraries and SDKs for Next.js, React, React Native, TanStack, Node.js and Python.' },
    { name: 'Locadex', summary: 'A cloud AI agent that connects General Translation to your code, content and context sources.' },
    { name: 'Translation review', summary: 'Review and approve translations with your team over web, API or CLI.' },
    { name: 'CDN delivery', summary: 'Translations served from the edge, close to every user.' },
  ],
  products: ['Internationalization', 'Locadex', 'Translation review', 'CDN delivery'],
  proof: ['Ready to ship in 120+ locales', 'Open-source libraries for every major framework', 'SOC 2 Type II and ISO 27001', 'Locadex opens translation pull requests'],
  proofAssets: [
    asset('cursor', 'Cursor', '/brands/gt/proof/cursor.svg', 'light', 'proof'),
    asset('ramp', 'Ramp', '/brands/gt/proof/ramp.svg', 'light', 'proof'),
    asset('mintlify', 'Mintlify', '/brands/gt/proof/mintlify.svg', 'light', 'proof'),
    asset('clickhouse', 'ClickHouse', '/brands/gt/proof/clickhouse.svg', 'light', 'proof'),
  ],
  revision: REVISION + 6,
  samples: {
    actions: ['Add a locale', 'Run Locadex on this repository', 'Review translations', 'Publish to the CDN'],
    code: { label: 'Translate a component', snippet: "import { T } from 'gt-next';\n\nexport default function Page() {\n  return <T><h1>Welcome back</h1></T>;\n}" },
    event: { date: 'Thu 14 Nov', location: 'Online', name: 'GT office hours: shipping your first locale', time: '17:00 UTC' },
    install: 'npm install gt-next',
    metric: { change: '18 locales · 0 missing', label: 'Strings translated', value: '12,480' },
    person: { name: 'Ana Souza', role: 'Localization engineer' },
    plans: [
      { features: ['Unlimited projects', 'Unlimited users', 'Unlimited languages'], name: 'Starter', price: '$0' },
      { features: ['Everything in Starter', 'SOC 2 Type II and ISO 27001'], name: 'Enterprise', price: 'Contact us' },
    ],
    release: { items: ['Connects to your code, content and context sources', 'Review over web, API or CLI', 'Ready to ship in 120+ locales'], title: 'Locadex opens translation pull requests' },
  },
  shortName: 'GT',
  socialHandle: '@generaltranslation',
  sourceNotes: ['Official GT mark and current product language', 'Official General Translation homepage and pricing · reviewed October 2026 (customers, products, locales, compliance, plans)', 'GT brand canon (BRAND.md and DESIGN.md, October 2026): colors, type, marks and language as material', 'GT brand-system artwork: glyph globes, glyph field, horizon field, speed marks and the How GT works still', 'Ten artifact pictures cut to the Blue Marble standard from public-domain and CC BY-SA originals, credited per image', 'Multilingual email motion studies created in Glyphfield'],
  strategy: {
    challenge: 'Localization usually lives outside the codebase, in string files, vendor portals and spreadsheets. Copy changes in code, translations lag behind, and the context a translator needs is gone by the time they see the string.',
    concept: 'One source, every language: the string in code is the origin, and every locale is a faithful expression of it.',
    outcome: 'Product teams treat every locale like the source language: translations arrive in the same pull request, reviewers see context, and nothing waits on a vendor round trip.',
    personality: ['Exact', 'Calm', 'Developer-native', 'Global'],
    pillars: ['Language stays connected to code', 'Context travels with every string', 'Automation remains reviewable', 'Every locale is a first-class product surface'],
    promise: 'Ship every language with the same confidence as the source language.',
  },
  style: { borderRadius: 0, density: 'comfortable', grid: 'none', imageTreatment: 'monochrome', logoScale: 100 },
  tagline: 'Every language. One source.',
  typeScale: { basePx: 16, ratio: 1.333 },
  typography: [
    { family: 'Rasmus Inter', fontId: 'inter-variable', letterSpacing: -0.7, lineHeight: 0.98, role: 'Display', usage: 'Large identity statements, campaign headlines, and decisive product moments', weight: 500 },
    { family: 'Rasmus Inter', fontId: 'inter-variable', letterSpacing: 0.05, lineHeight: 1.58, role: 'Body', usage: 'Interface copy, documentation, email, and long-form explanation', weight: 400 },
    { family: 'Rasmus Inter', fontId: 'inter-variable', letterSpacing: 0.15, lineHeight: 1.34, role: 'Accent', usage: 'Multilingual specimens with optical centering by writing system', weight: 400 },
    { family: 'Geist Mono', fontId: 'geist-mono-variable', letterSpacing: 0.25, lineHeight: 1.5, role: 'Code', usage: 'Commands, locale codes, tokens, diffs, and technical metadata', weight: 400 },
  ],
  values: ['Source of truth', 'Context over strings', 'Developer agency', 'Global by default'],
  voice: {
    examples: [
      { avoid: 'Unlock global growth with AI-powered localization magic.', context: 'Docs quickstart', write: 'Wrap your text in <T>. Translations stay next to the code that renders them.' },
      { avoid: 'Your content is now available worldwide, instantly!', context: 'Pull request summary', write: 'Locadex translated 214 strings into 12 locales. Review the diff before you merge.' },
      { avoid: 'Translation failed. Please try again later.', context: 'Missing context warning', write: 'This string has no context. Add a description so the translation fits where it appears.' },
    ],
    avoid: ['Abstract global-growth clichés', 'Unverifiable speed claims', 'Translation language detached from developer workflow'],
    phrases: ['Code is the source of truth.', 'Language moves with the product.', 'Let Locadex open the PR.'],
    principles: ['Developer-first', 'Direct and concrete', 'Technically credible', 'Globally aware'],
  },
  website: 'generaltranslation.com',
};
