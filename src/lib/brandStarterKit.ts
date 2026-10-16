/**
 * The starter kit a brand is built from: tested eight-role palettes, type
 * pairings from the bundled fonts, the graphic devices any palette can drive,
 * corner radii, and named directions that combine them. Applying a choice
 * changes the visual system and keeps the brand's name and copy.
 */
import type {
  BrandColor,
  BrandColorPairing,
  BrandFontAsset,
  BrandIdentity,
  BrandTypography,
} from './brandIdentity';
import { hasGeneratedPixelAssets, updateGeneratedPixelAssets } from './brandPixelMark';

type BrandPattern = BrandIdentity['graphicSystem']['pattern'];
type BrandDensity = BrandIdentity['style']['density'];

const ROLE_IDS = ['ink', 'paper', 'muted', 'emphasis', 'success', 'warning', 'progress', 'error'] as const;
type RoleId = (typeof ROLE_IDS)[number];

export type StarterPalette = {
  colors: BrandColor[];
  /** Dark-first palettes give ink the dominant share of the field. */
  darkFirst: boolean;
  description: string;
  id: string;
  name: string;
  /** Text pairs the palette is tested for; each passes its WCAG level. */
  pairings: BrandColorPairing[];
};

export type StarterPairing = {
  description: string;
  fonts: BrandFontAsset[];
  id: string;
  name: string;
  typography: BrandTypography[];
};

export type StarterDevice = Pick<BrandIdentity['graphicSystem'], 'composition' | 'description' | 'rules'> & {
  name: string;
  pattern: BrandPattern;
};

export type StarterKitChoice = {
  corners?: number;
  density?: BrandDensity;
  device?: BrandPattern;
  palette?: string;
  pairing?: string;
};

export type StarterDirection = Required<StarterKitChoice> & {
  description: string;
  id: string;
  name: string;
};

/* Fonts ------------------------------------------------------------------ */

/** Every font file Glyphfield ships for general use; brand-licensed faces live with their brands. */
export const STARTER_KIT_FONTS: readonly BrandFontAsset[] = [
  {
    family: 'Switzer',
    fileName: 'Switzer-Regular.ttf',
    format: 'truetype',
    id: 'switzer-400',
    label: 'Switzer Regular',
    license: 'ITF Free Font License (Fontshare); not redistributable as a font package',
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
    license: 'ITF Free Font License (Fontshare); not redistributable as a font package',
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
  {
    family: 'Instrument Serif',
    fileName: 'InstrumentSerif-Regular.ttf',
    format: 'truetype',
    id: 'instrument-serif-400',
    label: 'Instrument Serif Regular',
    license: 'SIL Open Font License 1.1',
    path: '/fonts/brands/starter/instrument-serif-400.ttf',
    style: 'normal',
    weight: 400,
  },
];

/* Palettes --------------------------------------------------------------- */

const ROLE_USAGE: Record<RoleId, string> = {
  emphasis: 'The one accent: a single selection, action or figure per view',
  error: 'Deep panels, reversed sections and the dark end of the system',
  ink: 'Text, marks and decisive surfaces',
  muted: 'Working surfaces, cards and quiet structure',
  paper: 'Dominant open field and reading surface',
  progress: 'Secondary text, dates and metadata',
  success: 'Soft accent fields, selected rows and positive states',
  warning: 'Annotations and items that need attention',
};

const DARK_FIRST_USAGE: Partial<Record<RoleId, string>> = {
  ink: 'Dominant dark field, marks and text on light surfaces',
  paper: 'Reversed type and light editorial fields',
};

/** Shares in ROLE_IDS order: about 60 / 30 / 10 with the accent at 6%. */
const LIGHT_FIRST_SHARES = [18, 60, 12, 6, 2, 1, 1, 0];
const DARK_FIRST_SHARES = [56, 26, 6, 6, 2, 1, 1, 2];

function textPairs(accentLabel: 'ink' | 'paper', accentLevel: 'AA' | 'AA-large', darkFirst: boolean): BrandColorPairing[] {
  return [
    darkFirst
      ? { background: 'ink', foreground: 'paper', level: 'AA', usage: 'Body text and headlines on the dark field' }
      : { background: 'paper', foreground: 'ink', level: 'AA', usage: 'Body text and headlines' },
    { background: 'muted', foreground: 'ink', level: 'AA', usage: 'Text on quiet surfaces' },
    { background: 'paper', foreground: 'progress', level: 'AA', usage: 'Secondary text and metadata' },
    { background: 'success', foreground: 'ink', level: 'AA', usage: 'Text on soft accent fields' },
    { background: 'emphasis', foreground: accentLabel, level: accentLevel, usage: 'Labels on the accent' },
    { background: 'error', foreground: 'paper', level: 'AA', usage: 'Reversed text on deep panels' },
    ...(darkFirst ? [{ background: 'ink', foreground: 'emphasis', level: 'AA-large' as const, usage: 'Accent figures on the dark field' }] : []),
  ];
}

function palette({
  accentLabel,
  accentLevel = 'AA',
  darkFirst = false,
  description,
  id,
  name,
  swatches,
}: {
  accentLabel: 'ink' | 'paper';
  accentLevel?: 'AA' | 'AA-large';
  darkFirst?: boolean;
  description: string;
  id: string;
  name: string;
  swatches: Record<RoleId, readonly [hex: string, name: string]>;
}): StarterPalette {
  const shares = darkFirst ? DARK_FIRST_SHARES : LIGHT_FIRST_SHARES;
  return {
    colors: ROLE_IDS.map((role, index) => ({
      hex: swatches[role][0],
      id: role,
      name: swatches[role][1],
      proportion: shares[index]!,
      role: (darkFirst ? DARK_FIRST_USAGE[role] : undefined) ?? ROLE_USAGE[role],
    })),
    darkFirst,
    description,
    id,
    name,
    pairings: textPairs(accentLabel, accentLevel, darkFirst),
  };
}

/** Contrast checked for every pair in `pairings`: ink on paper clears 14:1 in each palette. */
export const STARTER_PALETTES: readonly StarterPalette[] = [
  palette({
    accentLabel: 'paper',
    accentLevel: 'AA-large',
    description: 'Signal blue on white',
    id: 'signal',
    name: 'Signal',
    swatches: { emphasis: ['#2F6BFF', 'Signal blue'], error: ['#20283A', 'Deep blue'], ink: ['#171A21', 'Night'], muted: ['#EEF2F8', 'Fog'], paper: ['#FFFFFF', 'Paper'], progress: ['#677084', 'Slate'], success: ['#CDE0FF', 'Sky'], warning: ['#FFCB69', 'Warm note'] },
  }),
  palette({
    accentLabel: 'ink',
    description: 'Navy ink with coral',
    id: 'harbor',
    name: 'Harbor',
    swatches: { emphasis: ['#FF5A47', 'Coral'], error: ['#13294B', 'Deep navy'], ink: ['#0F1B2D', 'Navy'], muted: ['#ECEFF3', 'Harbor fog'], paper: ['#FBFAF7', 'Shell'], progress: ['#5B677A', 'Tide'], success: ['#FFD6CC', 'Blush'], warning: ['#FFC65C', 'Buoy'] },
  }),
  palette({
    accentLabel: 'paper',
    description: 'Warm ember on cream',
    id: 'ember',
    name: 'Ember',
    swatches: { emphasis: ['#C4431A', 'Ember'], error: ['#3B2219', 'Hearth'], ink: ['#231A14', 'Char'], muted: ['#F1E7D8', 'Oat'], paper: ['#FBF6EE', 'Cream'], progress: ['#74665A', 'Ash'], success: ['#F6CBB0', 'Glow'], warning: ['#F2B441', 'Amber'] },
  }),
  palette({
    accentLabel: 'paper',
    description: 'Terracotta on sand',
    id: 'clay',
    name: 'Clay',
    swatches: { emphasis: ['#A84B29', 'Terracotta'], error: ['#4A2619', 'Kiln'], ink: ['#2B1D16', 'Umber'], muted: ['#EADFCF', 'Dune'], paper: ['#F5EEE3', 'Sand'], progress: ['#74645A', 'Earth'], success: ['#E9BFA4', 'Clay'], warning: ['#D8A23F', 'Ochre'] },
  }),
  palette({
    accentLabel: 'paper',
    description: 'Black and white with one red',
    id: 'mono',
    name: 'Mono',
    swatches: { emphasis: ['#E0261F', 'Red'], error: ['#1C1C1C', 'Carbon'], ink: ['#111111', 'Ink'], muted: ['#F2F2F2', 'Fog'], paper: ['#FFFFFF', 'Paper'], progress: ['#5E5E5E', 'Graphite'], success: ['#D6D6D6', 'Silver'], warning: ['#A3A3A3', 'Steel'] },
  }),
  palette({
    accentLabel: 'ink',
    darkFirst: true,
    description: 'Deep forest with mint',
    id: 'forest',
    name: 'Forest',
    swatches: { emphasis: ['#3EDB9A', 'Mint'], error: ['#14392A', 'Deep forest'], ink: ['#0B1F17', 'Forest night'], muted: ['#DCE7DD', 'Sage'], paper: ['#F1F5EF', 'Mist'], progress: ['#56685D', 'Moss'], success: ['#AEEFD0', 'Pale mint'], warning: ['#E6C76A', 'Pollen'] },
  }),
  palette({
    accentLabel: 'paper',
    darkFirst: true,
    description: 'Ultraviolet and mint on violet black',
    id: 'ultraviolet',
    name: 'Ultraviolet',
    swatches: { emphasis: ['#6E4BFF', 'Ultraviolet'], error: ['#251A4E', 'Deep violet'], ink: ['#110C24', 'Void'], muted: ['#E6E1FA', 'Lilac'], paper: ['#F6F4FF', 'Haze'], progress: ['#5F5880', 'Dusk'], success: ['#4FF0C0', 'Mint'], warning: ['#C9B8FF', 'Lavender'] },
  }),
  palette({
    accentLabel: 'ink',
    darkFirst: true,
    description: 'Ink with citrus',
    id: 'citrus',
    name: 'Citrus',
    swatches: { emphasis: ['#D7F53B', 'Citrus'], error: ['#1E2019', 'Olive black'], ink: ['#121212', 'Ink'], muted: ['#E4E4DB', 'Ash'], paper: ['#F6F6F0', 'Bone'], progress: ['#63635B', 'Graphite'], success: ['#EEF8B8', 'Pale citrus'], warning: ['#FF9F3D', 'Tangerine'] },
  }),
];

/* Type pairings ---------------------------------------------------------- */

function kitFonts(ids: readonly string[]): BrandFontAsset[] {
  return ids.flatMap((id) => STARTER_KIT_FONTS.filter((font) => font.id === id));
}

export const STARTER_PAIRINGS: readonly StarterPairing[] = [
  {
    description: 'Switzer, Instrument Serif and Geist Mono',
    fonts: kitFonts(['switzer-400', 'switzer-500', 'instrument-serif-400', 'geist-mono-variable']),
    id: 'swiss',
    name: 'Swiss',
    typography: [
      { family: 'Switzer', fontId: 'switzer-500', letterSpacing: -0.5, lineHeight: 1, role: 'Display', usage: 'Direct headlines and compact product statements', weight: 500 },
      { family: 'Switzer', fontId: 'switzer-400', letterSpacing: 0, lineHeight: 1.5, role: 'Body', usage: 'Interface copy, notes and long-form reading', weight: 400 },
      { family: 'Instrument Serif', fontId: 'instrument-serif-400', letterSpacing: -0.2, lineHeight: 1.12, role: 'Accent', usage: 'Observations, quotes and editorial emphasis', weight: 400 },
      { family: 'Geist Mono', fontId: 'geist-mono-variable', letterSpacing: 0, lineHeight: 1.45, role: 'Code', usage: 'Dates, states, owners, versions and metadata', weight: 400 },
    ],
  },
  {
    description: 'Inter and Geist Mono',
    fonts: kitFonts(['inter-variable', 'geist-mono-variable']),
    id: 'neutral',
    name: 'Neutral',
    typography: [
      { family: 'Inter', fontId: 'inter-variable', letterSpacing: -0.7, lineHeight: 0.98, role: 'Display', usage: 'Headlines, statements and key figures', weight: 550 },
      { family: 'Inter', fontId: 'inter-variable', letterSpacing: 0, lineHeight: 1.55, role: 'Body', usage: 'Interface copy, documentation and long-form reading', weight: 400 },
      { family: 'Inter', fontId: 'inter-variable', letterSpacing: 0, lineHeight: 1.3, role: 'Accent', usage: 'Labels, pull quotes and short emphasis', weight: 500 },
      { family: 'Geist Mono', fontId: 'geist-mono-variable', letterSpacing: 0, lineHeight: 1.5, role: 'Code', usage: 'Commands, tokens, data and technical metadata', weight: 400 },
    ],
  },
  {
    description: 'Instrument Serif display with Inter text',
    fonts: kitFonts(['instrument-serif-400', 'inter-variable', 'geist-mono-variable']),
    id: 'editorial',
    name: 'Editorial',
    typography: [
      { family: 'Instrument Serif', fontId: 'instrument-serif-400', letterSpacing: -0.5, lineHeight: 1.02, role: 'Display', usage: 'Editorial headlines and statements', weight: 400 },
      { family: 'Inter', fontId: 'inter-variable', letterSpacing: 0, lineHeight: 1.55, role: 'Body', usage: 'Interface copy and long-form reading', weight: 400 },
      { family: 'Instrument Serif', fontId: 'instrument-serif-400', letterSpacing: -0.2, lineHeight: 1.15, role: 'Accent', usage: 'Quotes, captions and editorial emphasis', weight: 400 },
      { family: 'Geist Mono', fontId: 'geist-mono-variable', letterSpacing: 0, lineHeight: 1.5, role: 'Code', usage: 'Dates, sources and technical metadata', weight: 400 },
    ],
  },
  {
    description: 'Geist Mono display with Inter text',
    fonts: kitFonts(['geist-mono-variable', 'inter-variable']),
    id: 'technical',
    name: 'Technical',
    typography: [
      { family: 'Geist Mono', fontId: 'geist-mono-variable', letterSpacing: -1, lineHeight: 1.02, role: 'Display', usage: 'Headlines, figures and system statements', weight: 500 },
      { family: 'Inter', fontId: 'inter-variable', letterSpacing: 0, lineHeight: 1.55, role: 'Body', usage: 'Interface copy, documentation and long-form reading', weight: 400 },
      { family: 'Geist Mono', fontId: 'geist-mono-variable', letterSpacing: 0, lineHeight: 1.4, role: 'Accent', usage: 'Labels, states and short emphasis', weight: 400 },
      { family: 'Geist Mono', fontId: 'geist-mono-variable', letterSpacing: 0, lineHeight: 1.5, role: 'Code', usage: 'Commands, tokens, data and logs', weight: 400 },
    ],
  },
];

/* Devices ---------------------------------------------------------------- */

/** The device copy a new brand starts with; it counts as unwritten. */
export const STARTER_DEVICE_PLACEHOLDER = 'Add a graphic device';

/**
 * Devices offered to new brands. GT's globe ('none') and Ramp's ledger card
 * ('steps') belong to those brands and are not offered.
 */
export const STARTER_DEVICES: readonly StarterDevice[] = [
  {
    composition: 'One signal window anchors an edge of each composition; notes, evidence and copy align to the open field beside it.',
    description: 'A framed window isolates the one thing that matters now: an image, a decision, a figure or the next action. The field around it stays quiet.',
    name: 'Signal window',
    pattern: 'brackets',
    rules: ['One signal window per composition', 'Keep the field around the window quiet', 'Use the accent for focus, not decoration', 'Pair every claim with evidence or a next step'],
  },
  {
    composition: 'Type and images align to the grid columns; one cell filled with the accent marks the focal point.',
    description: 'A visible modular grid shows the structure behind every layout, and one emphasized cell marks the point of focus.',
    name: 'Construction grid',
    pattern: 'grid',
    rules: ['Every element sits on the grid', 'One emphasized cell per composition', 'Grid lines stay hairline and quiet', 'Empty cells set the rhythm'],
  },
  {
    composition: 'The center sits off-axis and the rings run past the frame; copy sits in the open quadrant.',
    description: 'Concentric paths circle one center, so a single product, figure or idea reads as the point the rest moves around.',
    name: 'Orbit',
    pattern: 'orbit',
    rules: ['One center per composition', 'Rings crop at the frame edge', 'The accent marks the center or one moving point', 'Copy never crosses a ring'],
  },
  {
    composition: 'The band runs diagonally across a corner or an edge; copy sits on the flat field opposite it.',
    description: 'Layered bands of the palette sweep across the field in one continuous gradient.',
    name: 'Gradient band',
    pattern: 'flow',
    rules: ['One band per composition', 'Palette colors only', 'The band bleeds off at least one edge', 'Text sits on flat color, never on the band'],
  },
  {
    composition: 'The beam starts at an edge and ends on the subject or the headline; the rest of the field stays dark.',
    description: 'A beam of light crosses a dark field and lands on the one thing the composition is about.',
    name: 'Light beam',
    pattern: 'rays',
    rules: ['One beam per composition', 'The beam points at the subject', 'The field around the beam stays dark', 'The accent appears only in the light'],
  },
  {
    composition: 'The current runs edge to edge behind the lower third; headlines sit above it on open space.',
    description: 'Currents built from regular segments run across the field and show steady, continuous movement.',
    name: 'Current',
    pattern: 'wave',
    rules: ['Currents run edge to edge', 'Segments keep one size and rhythm', 'The accent marks one current only', 'Text stays above or below the current'],
  },
  {
    composition: 'The wall fills one side and a single accent block breaks it; type sits on the open side.',
    description: 'A wall of dithered blocks builds tone from small squares, and one solid accent block interrupts it.',
    name: 'Dither wall',
    pattern: 'blocks',
    rules: ['One interruption per composition', 'Tone comes from block density, not gradients', 'Blocks stay on one grid', 'No small text over the wall'],
  },
  {
    composition: 'The arch rises from the lower edge; the headline sits in the open space above it.',
    description: 'Lines of light bend into one bright arch, so many paths read as converging on a single point.',
    name: 'Light arch',
    pattern: 'burst',
    rules: ['One arch per composition', 'Lines converge on a single point', 'The brightest light sits at the center', 'Type stays clear of the converging lines'],
  },
  {
    composition: 'The horizon sits in the lower third with paths crossing it toward the edges; copy sits in the open space above.',
    description: 'A horizon crossed by connected paths shows many points joining one network.',
    name: 'Network horizon',
    pattern: 'circuit',
    rules: ['One horizon per composition', 'Paths meet at nodes and never end loose', 'The accent marks where paths cross the horizon', 'The space above the horizon stays open for copy'],
  },
];

/* Corners and directions ------------------------------------------------- */

export const STARTER_CORNERS: readonly { label: string; value: number }[] = [
  { label: 'Square', value: 0 },
  { label: 'Soft', value: 6 },
  { label: 'Round', value: 12 },
  { label: 'Pill', value: 20 },
];

export const STARTER_DIRECTIONS: readonly StarterDirection[] = [
  { corners: 6, density: 'comfortable', description: 'Signal blue, Switzer and a framed window', device: 'brackets', id: 'signal', name: 'Signal', pairing: 'swiss', palette: 'signal' },
  { corners: 12, density: 'comfortable', description: 'Navy and coral, Inter and an orbit', device: 'orbit', id: 'harbor', name: 'Harbor', pairing: 'neutral', palette: 'harbor' },
  { corners: 0, density: 'spacious', description: 'Ember on cream, a serif display and a light beam', device: 'rays', id: 'ember', name: 'Ember', pairing: 'editorial', palette: 'ember' },
  { corners: 12, density: 'comfortable', description: 'Deep forest and mint, Switzer and a current', device: 'wave', id: 'forest', name: 'Forest', pairing: 'swiss', palette: 'forest' },
  { corners: 6, density: 'compact', description: 'Ultraviolet and mint, a mono display and a network horizon', device: 'circuit', id: 'ultraviolet', name: 'Ultraviolet', pairing: 'technical', palette: 'ultraviolet' },
  { corners: 0, density: 'compact', description: 'Ink and citrus, Inter and a dither wall', device: 'blocks', id: 'citrus', name: 'Citrus', pairing: 'neutral', palette: 'citrus' },
];

/** New brands start from Harbor; the Starter example uses Signal. */
export const DEFAULT_STARTER_DIRECTION: StarterDirection = STARTER_DIRECTIONS.find(({ id }) => id === 'harbor')!;

export function starterPalette(id: string): StarterPalette | undefined {
  return STARTER_PALETTES.find((candidate) => candidate.id === id);
}

export function starterPairing(id: string): StarterPairing | undefined {
  return STARTER_PAIRINGS.find((candidate) => candidate.id === id);
}

export function starterDevice(pattern: BrandPattern): StarterDevice | undefined {
  return STARTER_DEVICES.find((candidate) => candidate.pattern === pattern);
}

/* Applying a choice ------------------------------------------------------ */

/** True while the device copy is the placeholder or a kit device's, so a new device may replace it. */
function isStarterDeviceCopy(device: string): boolean {
  const name = device.trim().toLocaleLowerCase().replace(/^the\s+/, '');
  return !name
    || name === STARTER_DEVICE_PLACEHOLDER.toLocaleLowerCase()
    || STARTER_DEVICES.some((candidate) => candidate.name.toLocaleLowerCase() === name);
}

function colorPatch(identity: BrandIdentity, paletteId: string | undefined): Partial<BrandIdentity> {
  const chosen = paletteId ? starterPalette(paletteId) : undefined;
  if (!chosen) return {};
  // The eight roles are replaced; colors the brand added itself stay.
  const colors = [
    ...chosen.colors.map((color) => ({ ...color })),
    ...identity.colors.filter(({ id }) => !(ROLE_IDS as readonly string[]).includes(id)),
  ];
  return {
    // Generated marks are redrawn in the new ink, paper and accent.
    ...(hasGeneratedPixelAssets(identity.assets) ? { assets: updateGeneratedPixelAssets(identity.assets, identity.shortName, identity.id, colors) } : {}),
    // Declared text pairs are replaced so they stay valid; undeclared pairs keep deriving from the palette.
    ...(identity.colorPairings?.length ? { colorPairings: chosen.pairings.map((pair) => ({ ...pair })) } : {}),
    colors,
  };
}

function typePatch(identity: BrandIdentity, pairingId: string | undefined): Partial<BrandIdentity> {
  const chosen = pairingId ? starterPairing(pairingId) : undefined;
  if (!chosen) return {};
  const kitIds = new Set(chosen.fonts.map(({ id }) => id));
  return {
    // Bundled files the new roles no longer use are dropped; uploaded fonts stay.
    fonts: [
      ...chosen.fonts.map((font) => ({ ...font })),
      ...(identity.fonts ?? []).filter((font) => !font.path.startsWith('/') && !kitIds.has(font.id)),
    ],
    // Each role keeps the usage line the brand wrote for it.
    typography: chosen.typography.map((role) => ({
      ...role,
      usage: identity.typography.find((current) => current.role === role.role)?.usage || role.usage,
    })),
  };
}

function devicePatch(identity: BrandIdentity, pattern: BrandPattern | undefined): Partial<BrandIdentity> {
  if (!pattern) return {};
  const chosen = starterDevice(pattern);
  // The brand's own device copy stays; kit or placeholder copy follows the device.
  if (!chosen || !isStarterDeviceCopy(identity.graphicSystem.device)) {
    return { graphicSystem: { ...identity.graphicSystem, pattern } };
  }
  return {
    graphicSystem: {
      ...identity.graphicSystem,
      composition: chosen.composition,
      description: chosen.description,
      device: chosen.name,
      pattern,
      rules: [...chosen.rules],
    },
  };
}

function stylePatch(identity: BrandIdentity, { corners, density }: StarterKitChoice): Partial<BrandIdentity> {
  if (corners === undefined && !density) return {};
  return {
    style: {
      ...identity.style,
      ...(corners === undefined ? {} : { borderRadius: corners }),
      ...(density ? { density } : {}),
    },
  };
}

/** Only the fields a kit choice changes, ready for a merge-style `update(patch)`. */
export function starterKitPatch(identity: BrandIdentity, choice: StarterKitChoice): Partial<BrandIdentity> {
  return {
    ...colorPatch(identity, choice.palette),
    ...typePatch(identity, choice.pairing),
    ...devicePatch(identity, choice.device),
    ...stylePatch(identity, choice),
  };
}

/** The identity with a palette, pairing, device, corners or a whole direction applied. Name and copy are kept. */
export function applyStarterKit(identity: BrandIdentity, choice: StarterKitChoice): BrandIdentity {
  return { ...identity, ...starterKitPatch(identity, choice) };
}

/** Which kit palette, pairing, device and corners the identity currently uses, if any. */
export function starterKitSelection(identity: BrandIdentity): { corners?: number; device?: BrandPattern; palette?: string; pairing?: string } {
  const hex = (colors: readonly BrandColor[], id: string) => colors.find((color) => color.id === id)?.hex.toLocaleUpperCase();
  const fontId = (typography: readonly BrandTypography[], role: BrandTypography['role']) => typography.find((current) => current.role === role)?.fontId;
  return {
    corners: STARTER_CORNERS.find(({ value }) => value === identity.style.borderRadius)?.value,
    device: identity.graphicSystem.pattern,
    palette: STARTER_PALETTES.find((candidate) => ROLE_IDS.every((role) => hex(candidate.colors, role) === hex(identity.colors, role)))?.id,
    pairing: STARTER_PAIRINGS.find((candidate) => (
      (['Display', 'Body', 'Accent', 'Code'] as const).every((role) => fontId(candidate.typography, role) === fontId(identity.typography, role))
    ))?.id,
  };
}
