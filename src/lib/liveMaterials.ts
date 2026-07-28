import type { BrandIdentity } from './brandIdentity';

export type LiveMaterialId =
  | 'shadergradient-prismatic-sphere'
  | 'glyphfield-glyph-field'
  | 'glyphfield-mesh-gradient'
  | 'glyphfield-grain-gradient'
  | 'glyphfield-dither-gradient'
  | 'shaders-pixel-beams'
  | 'shaders-soft-register'
  | 'shaders-spectral-bloom'
  | 'shaders-pistons'
  | 'shaders-fluid-chrome'
  | 'shaders-chroma-flow'
  | 'shaders-drift'
  | 'shaders-mosaic'
  | 'shaders-circuit'
  | 'shaders-dedalus-bloom';

export type LiveMaterialSettings = {
  amplitude: number;
  brightness: number;
  colorA: string;
  colorB: string;
  colorC: string;
  density: number;
  detail: number;
  frequency: number;
  grain: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  speed: number;
  strength: number;
};

export type LiveMaterialOption = {
  description: string;
  engine: 'ShaderGradient' | 'Shaders.com study' | 'Glyphfield';
  id: LiveMaterialId;
  name: string;
};

export type LiveMaterialPalette = {
  colors: readonly [string, string, string];
  description: string;
  id: string;
  name: string;
};

export type LiveMaterialLookPreset = {
  description: string;
  id: string;
  materialId: LiveMaterialId;
  name: string;
  settings: Partial<LiveMaterialSettings>;
};

export const SHADER_GRADIENT_SOURCE_URL =
  'https://shadergradient.co/customize?animate=on&axesHelper=off&brightness=0.8&cAzimuthAngle=270&cDistance=0.5&cPolarAngle=180&cameraZoom=15.1&color1=%2373bfc4&color2=%23ff810a&color3=%238da0ce&destination=onCanvas&embedMode=off&envPreset=city&format=gif&fov=45&frameRate=10&gizmoHelper=hide&grain=on&lightType=env&pixelDensity=1&positionX=-0.1&positionY=0&positionZ=0&range=enabled&rangeEnd=40&rangeStart=0&rotationX=0&rotationY=130&rotationZ=70&shader=defaults&type=sphere&uAmplitude=3.2&uDensity=0.8&uFrequency=5.5&uSpeed=0.3&uStrength=0.3&uTime=0&wireframe=false&zoomOut=true';

export const SHADERS_SOURCE_URL = 'https://shaders.com/';

export const DEFAULT_LIVE_MATERIAL_ID: LiveMaterialId = 'shadergradient-prismatic-sphere';

export const DEFAULT_LIVE_MATERIAL_SETTINGS: LiveMaterialSettings = {
  amplitude: 3.2,
  brightness: 0.8,
  colorA: '#73BFC4',
  colorB: '#FF810A',
  colorC: '#8DA0CE',
  density: 0.8,
  detail: 3.2,
  frequency: 5.5,
  grain: 32,
  rotationX: 0,
  rotationY: 130,
  rotationZ: 70,
  speed: 0.3,
  strength: 0.3,
};

export const LIVE_MATERIAL_PALETTES: readonly LiveMaterialPalette[] = [
  { colors: ['#050505', '#F4F4F0', '#737373'], description: 'Neutral chrome with a clean paper highlight.', id: 'monochrome-chrome', name: 'Monochrome chrome' },
  { colors: ['#0D0E12', '#D7E6FF', '#7A82A1'], description: 'Cold silver with a blue-violet reflected edge.', id: 'mercury', name: 'Mercury' },
  { colors: ['#110829', '#865CFF', '#F3A6FF'], description: 'Deep ultraviolet lifted by an electric pink glint.', id: 'ultraviolet', name: 'Ultraviolet' },
  { colors: ['#081310', '#D6FF45', '#3CD6A3'], description: 'Dark mineral green with a sharp signal-lime edge.', id: 'signal-lime', name: 'Signal lime' },
  { colors: ['#1A0A07', '#FF7A45', '#FFD2A8'], description: 'Burnished copper moving into a warm specular highlight.', id: 'copper-heat', name: 'Copper heat' },
  { colors: ['#07131C', '#5BD8FF', '#EAFBFF'], description: 'Near-black blue, cyan energy, and an icy white crest.', id: 'arctic', name: 'Arctic' },
  { colors: ['#0C0C0E', '#FF4D2E', '#F2EEE8'], description: 'Ink, vermilion, and warm paper for editorial motion.', id: 'vermilion-ink', name: 'Vermilion ink' },
  { colors: ['#07112F', '#345DFF', '#A7D8FF'], description: 'Saturated cobalt with a soft atmospheric bloom.', id: 'cobalt-bloom', name: 'Cobalt bloom' },
];

export const LIVE_MATERIAL_LOOK_PRESETS: readonly LiveMaterialLookPreset[] = [
  {
    description: 'A restrained mesh with broad color movement and a fine surface grain.',
    id: 'quiet-mesh',
    materialId: 'glyphfield-mesh-gradient',
    name: 'Quiet mesh',
    settings: { amplitude: 1.8, brightness: 0.86, density: 0.72, detail: 2.2, frequency: 3.4, grain: 14, speed: 0.18, strength: 0.28 },
  },
  {
    description: 'Architectural black-card reflections with narrow highlights and restrained motion.',
    id: 'polished-chrome',
    materialId: 'shaders-fluid-chrome',
    name: 'Polished chrome',
    settings: { amplitude: 2.2, brightness: 0.82, density: 0.7, detail: 4.8, frequency: 4.2, grain: 8, rotationZ: 8, speed: 0.12, strength: 0.46 },
  },
  {
    description: 'A soft, pigment-like field with visible paper grain and slow atmospheric drift.',
    id: 'soft-grain',
    materialId: 'glyphfield-grain-gradient',
    name: 'Soft grain',
    settings: { amplitude: 2.6, brightness: 0.92, density: 0.9, detail: 2.8, frequency: 3.2, grain: 42, speed: 0.16, strength: 0.34 },
  },
  {
    description: 'A crisp ordered-dither field with graphic contrast and a steady directional flow.',
    id: 'graphic-dither',
    materialId: 'glyphfield-dither-gradient',
    name: 'Graphic dither',
    settings: { amplitude: 3.4, brightness: 0.9, density: 1.1, detail: 3.6, frequency: 5.8, grain: 56, rotationZ: 18, speed: 0.24, strength: 0.62 },
  },
  {
    description: 'A luminous radial field with focused spectral energy and a polished highlight.',
    id: 'spectral-focus',
    materialId: 'shaders-spectral-bloom',
    name: 'Spectral focus',
    settings: { amplitude: 4.2, brightness: 1.08, density: 0.78, detail: 4.4, frequency: 6.4, grain: 18, rotationZ: 32, speed: 0.38, strength: 0.74 },
  },
  {
    description: 'A dense glyph volume with deliberate depth, measured movement, and a clean silhouette.',
    id: 'deep-glyph-field',
    materialId: 'glyphfield-glyph-field',
    name: 'Deep glyph field',
    settings: { amplitude: 4.8, brightness: 0.88, density: 1.28, detail: 5.2, frequency: 4.8, grain: 22, rotationX: 8, rotationY: 22, rotationZ: 0, speed: 0.2, strength: 0.58 },
  },
  {
    description: 'High-contrast directional energy with sharper repetition and faster motion.',
    id: 'kinetic-signal',
    materialId: 'shaders-pistons',
    name: 'Kinetic signal',
    settings: { amplitude: 5.6, brightness: 1.12, density: 1.2, detail: 5.8, frequency: 7.6, grain: 20, rotationZ: 26, speed: 0.62, strength: 1.05 },
  },
];

export function liveMaterialLookPreset(id: string): LiveMaterialLookPreset | undefined {
  return LIVE_MATERIAL_LOOK_PRESETS.find((preset) => preset.id === id);
}

export function brandMaterialPalette(
  identity: Pick<BrandIdentity, 'colors' | 'id' | 'name' | 'shortName'>
): LiveMaterialPalette {
  const label = identity.shortName.length > 1 ? identity.shortName : identity.name;
  const colorById = (...ids: string[]) =>
    ids
      .map((id) => identity.colors.find((color) => color.id === id)?.hex)
      .find((color): color is string => color !== undefined);
  const ink = colorById('ink', 'error', 'progress') ?? identity.colors[0]?.hex ?? '#181818';
  const accent = colorById('emphasis', 'primary', 'success', 'progress')
    ?? identity.colors.find(({ hex }) => hex !== ink)?.hex
    ?? '#737373';
  const highlight = colorById('paper', 'warning', 'success', 'muted')
    ?? identity.colors.find(({ hex }) => hex !== ink && hex !== accent)?.hex
    ?? '#FFFFFF';

  return {
    colors: [ink, accent, highlight],
    description: `The active ${identity.name} color system, applied as the default material palette.`,
    id: `brand-${identity.id}`,
    name: `${label} colors`,
  };
}

export const LIVE_MATERIAL_OPTIONS: readonly LiveMaterialOption[] = [
  {
    description: 'The supplied animated sphere preset with environment light and film grain.',
    engine: 'ShaderGradient',
    id: 'shadergradient-prismatic-sphere',
    name: 'Prismatic sphere',
  },
  {
    description: 'A spatial letterform built from hundreds of live glyphs, with editable depth, motion, density, and color.',
    engine: 'Glyphfield',
    id: 'glyphfield-glyph-field',
    name: 'Glyph field',
  },
  {
    description: 'An original three-color mesh field with broad, editable focal movement.',
    engine: 'Glyphfield',
    id: 'glyphfield-mesh-gradient',
    name: 'Mesh gradient',
  },
  {
    description: 'A tactile gradient with animated pigment movement and integrated film grain.',
    engine: 'Glyphfield',
    id: 'glyphfield-grain-gradient',
    name: 'Grain gradient',
  },
  {
    description: 'A three-color flow resolved through a crisp ordered-dither matrix.',
    engine: 'Glyphfield',
    id: 'glyphfield-dither-gradient',
    name: 'Dither gradient',
  },
  {
    description: 'Plasma sliced through an adjustable ordered-dither field.',
    engine: 'Shaders.com study',
    id: 'shaders-pixel-beams',
    name: 'Pixel Beams',
  },
  {
    description: 'A soft four-stop flow with a fine print-registration screen.',
    engine: 'Shaders.com study',
    id: 'shaders-soft-register',
    name: 'Soft Register',
  },
  {
    description: 'A radial color bloom with spectral rotation and print texture.',
    engine: 'Shaders.com study',
    id: 'shaders-spectral-bloom',
    name: 'Spectral Bloom',
  },
  {
    description: 'Hard directional rays broken across a tactile paper surface.',
    engine: 'Shaders.com study',
    id: 'shaders-pistons',
    name: 'Pistons',
  },
  {
    description: 'Architectural chrome shaped by dark reflection cards, narrow strip lights, and restrained movement.',
    engine: 'Shaders.com study',
    id: 'shaders-fluid-chrome',
    name: 'Architectural Chrome',
  },
  {
    description: 'Directional chroma movement viewed through fluted glass.',
    engine: 'Shaders.com study',
    id: 'shaders-chroma-flow',
    name: 'Chroma Flow',
  },
  {
    description: 'A controlled smoke plume with editable emission and decay.',
    engine: 'Shaders.com study',
    id: 'shaders-drift',
    name: 'Drift',
  },
  {
    description: 'An animated swirl reduced into a graphic pixel mosaic.',
    engine: 'Shaders.com study',
    id: 'shaders-mosaic',
    name: 'Mosaic',
  },
  {
    description: 'A neon grid warped over a moving high-contrast field.',
    engine: 'Shaders.com study',
    id: 'shaders-circuit',
    name: 'Circuit',
  },
  {
    description: 'A dimensional blob and wave composition with film grain.',
    engine: 'Shaders.com study',
    id: 'shaders-dedalus-bloom',
    name: 'Dedalus Bloom',
  },
];

export function normalizeLiveMaterialId(value: string): LiveMaterialId {
  const exact = LIVE_MATERIAL_OPTIONS.find(({ id }) => id === value);
  if (exact) return exact.id;
  const legacySuffix = value.split('-').slice(1).join('-');
  return LIVE_MATERIAL_OPTIONS.find(({ id }) => id.endsWith(legacySuffix))?.id ?? DEFAULT_LIVE_MATERIAL_ID;
}

export function getLiveMaterial(id: LiveMaterialId): LiveMaterialOption {
  const normalizedId = normalizeLiveMaterialId(id);
  return LIVE_MATERIAL_OPTIONS.find((material) => material.id === normalizedId) ?? LIVE_MATERIAL_OPTIONS[0]!;
}
