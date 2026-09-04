import type { BrandIdentity } from './brandIdentity';

export const PAPER_SHADER_FAMILIES = [
  { description: 'Flowing color spots with organic distortion, swirl, and fine surface grain.', label: 'Mesh Gradient', presets: ['Default', 'Ink', 'Purple', 'Beach'], slug: 'mesh-gradient' },
  { description: 'A turbulent luminous ring shaped by layered GPU noise.', label: 'Smoke Ring', presets: ['Default', 'Line', 'Solar', 'Cloud'], slug: 'smoke-ring' },
  { description: 'A neural field of animated filaments, contrast, and colored light.', label: 'Neuro Noise', presets: ['Default', 'Sensation', 'Bloodstream', 'Ghost'], slug: 'neuro-noise' },
  { description: 'Orbiting color particles with soft depth and luminous motion.', label: 'Dot Orbit', presets: ['Default', 'Bubbles', 'Shine', 'Hallucinatory'], slug: 'dot-orbit' },
  { description: 'A graphic dot lattice animated through geometric fields.', label: 'Dot Grid', presets: ['Default', 'Triangles', 'Tree line', 'Wallpaper'], slug: 'dot-grid' },
  { description: 'Layered simplex noise shaped into soft, dimensional color fields.', label: 'Simplex Noise', presets: ['Default', 'Spots', 'First contact', 'Bubblegum'], slug: 'simplex-noise' },
  { description: 'Soft animated color bodies merging through an implicit surface field.', label: 'Metaballs', presets: ['Default', 'Ink Drops', 'Solar', 'Background'], slug: 'metaballs' },
  { description: 'A precise field of soft graphic waves with editable spacing and amplitude.', label: 'Waves', presets: ['Default', 'Groovy', 'Tangled up', 'Ride the wave'], slug: 'waves' },
  { description: 'Organic Perlin turbulence with tactile, continuously moving contours.', label: 'Perlin Noise', presets: ['Default', 'Nintendo Water', 'Moss', 'Worms'], slug: 'perlin-noise' },
  { description: 'Animated Voronoi cells with controllable glow, gaps, and distortion.', label: 'Voronoi', presets: ['Default', 'Lights', 'Cells', 'Bubbles'], slug: 'voronoi' },
  { description: 'Marbled color bands warped through layered noise and swirl.', label: 'Warp', presets: ['Default', 'Cauldron Pot', 'Live Ink', 'Kelp', 'Nectar', 'Passion'], slug: 'warp' },
  { description: 'Volumetric radial light with layered rays, bloom, and atmospheric density.', label: 'God Rays', presets: ['Default', 'Warp', 'Linear', 'Ether'], slug: 'god-rays' },
  { description: 'A tapered procedural spiral with controllable noise and softness.', label: 'Spiral', presets: ['Default', 'Jungle', 'Droplet', 'Swirl'], slug: 'spiral' },
  { description: 'Layered color bands twisted into a soft animated vortex.', label: 'Swirl', presets: ['Default', '007', 'Opening', 'Candy'], slug: 'swirl' },
  { description: 'Ordered GPU dithering over animated procedural fields.', label: 'Dithering', presets: ['Default', 'Warp', 'Sine Wave', 'Ripple', 'Bugs', 'Swirl'], slug: 'dithering' },
  { description: 'A tactile animated gradient with dense analog grain and soft color bloom.', label: 'Grain Gradient', presets: ['Default', 'Wave', 'Dots', 'Truchet', 'Ripple', 'Blob'], slug: 'grain-gradient' },
  { description: 'A luminous animated perimeter with flexible shape and energy falloff.', label: 'Pulsing Border', presets: ['Default', 'Circle', 'Northern lights', 'Solid line'], slug: 'pulsing-border' },
  { description: 'Dimensional translucent color planes with animated depth.', label: 'Color Panels', presets: ['Default', 'Glass', 'Gradient', 'Opening'], slug: 'color-panels' },
  { description: 'A crisp, art-directed mesh gradient for quiet editorial surfaces.', label: 'Static Mesh', presets: ['Default', '1960s', 'Sunset', 'Sea'], slug: 'static-mesh-gradient' },
  { description: 'Layered radial color fields with graphic, controlled falloff.', label: 'Static Radial', presets: ['Default', 'Lo-Fi', 'Cross Section', 'Radial'], slug: 'static-radial-gradient' },
  { description: 'Procedural fibers, folds, crumples, and tactile paper grain.', label: 'Paper Texture', presets: ['Default', 'Cardboard', 'Abstract', 'Details'], slug: 'paper-texture' },
  { description: 'Image refraction through animated fluted and folded glass.', label: 'Fluted Glass', presets: ['Default', 'Abstract', 'Waves', 'Folds'], slug: 'fluted-glass' },
  { description: 'Refractive water caustics with layered surface motion.', label: 'Water', presets: ['Default', 'Slow-mo', 'Abstract', 'Streaming'], slug: 'water' },
  { description: 'Image-aware ordered dithering with graphic color separation.', label: 'Image Dithering', presets: ['Default', 'Noise', 'Retro', 'Natural'], slug: 'image-dithering' },
  { description: 'Thermal contour mapping with glow, depth, and atmospheric noise.', label: 'Heatmap', presets: ['Default', 'Sepia'], slug: 'heatmap' },
  { description: 'A chromatic liquid-metal surface with contour, dispersion, and flowing reflection.', label: 'Liquid Metal', presets: ['Default', 'Noir', 'Backdrop', 'Stripes'], slug: 'liquid-metal' },
  { description: 'Image-driven halftone dots with tactile print texture.', label: 'Halftone Dots', presets: ['Default', 'LED screen', 'Mosaic', 'Round and square'], slug: 'halftone-dots' },
  { description: 'Layered cyan, magenta, yellow, and black print screening.', label: 'Halftone CMYK', presets: ['Default', 'Drops', 'Newspaper', 'Vintage'], slug: 'halftone-cmyk' },
  { description: 'Gem-like refractive smoke with luminous internal color.', label: 'Gem Smoke', presets: ['Default', 'Fire', 'Fluorescent', 'Infrared'], slug: 'gem-smoke' },
] as const;

export type PaperShaderFamilyId = (typeof PAPER_SHADER_FAMILIES)[number]['slug'];
export type PaperLiveMaterialId = `paper-${string}`;

export type PaperLiveMaterialDefinition = {
  description: string;
  family: PaperShaderFamilyId;
  id: PaperLiveMaterialId;
  name: string;
  presetIndex: number;
  presetName: string;
};

function paperPresetSlug(name: string): string {
  return name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export const PAPER_LIVE_MATERIAL_DEFINITIONS: readonly PaperLiveMaterialDefinition[] = PAPER_SHADER_FAMILIES.flatMap(
  (family) => family.presets.map((presetName, presetIndex) => ({
    description: `${family.description} Paper’s ${presetName} preset.`,
    family: family.slug,
    id: `paper-${family.slug}${presetIndex === 0 ? '' : `-${paperPresetSlug(presetName)}`}` as PaperLiveMaterialId,
    name: presetIndex === 0 ? family.label : `${family.label} · ${presetName}`,
    presetIndex,
    presetName,
  }))
);

export const PAPER_LIVE_MATERIAL_IDS = PAPER_LIVE_MATERIAL_DEFINITIONS.map(({ id }) => id);

export type LiveMaterialId =
  | 'holo-cloth-silk'
  | 'shadergradient-prismatic-sphere'
  | 'glyphfield-glyph-field'
  | 'glyphfield-mesh-gradient'
  | 'glyphfield-grain-gradient'
  | 'glyphfield-dither-gradient'
  | 'pavel-fluid-energy'
  | 'shaders-pixel-beams'
  | 'shaders-soft-register'
  | 'shaders-spectral-bloom'
  | 'shaders-pistons'
  | 'shaders-fluid-chrome'
  | 'shaders-chroma-flow'
  | 'shaders-drift'
  | 'shaders-mosaic'
  | 'shaders-circuit'
  | 'study-line-field'
  | 'study-chrome-glares'
  | 'study-relief-gradient'
  | 'study-orbit-gradient'
  | 'study-radiant-void'
  | 'study-galactic-rings'
  | PaperLiveMaterialId;

export type LiveMaterialSettings = {
  amplitude: number;
  brightness: number;
  centerX: number;
  centerY: number;
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
  engine: 'Holo material' | 'ShaderGradient' | 'Shaders.com study' | 'Glyphfield' | 'WebGL Fluid' | 'Paper Shaders' | 'Design study';
  id: LiveMaterialId;
  name: string;
  qualityScore: number;
  sourceLabel?: string;
  sourceUrl?: string;
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

export const WEBGL_FLUID_SOURCE_URL =
  'https://github.com/PavelDoGreat/WebGL-Fluid-Simulation';

export const PAPER_SHADERS_SOURCE_URL = 'https://github.com/paper-design/shaders';

export const HOLOCLOTH_SOURCE_URL = 'https://github.com/dmitrykurash/holocloth';

const EVIL_RABBIT_SHADERS_SOURCE_URL = 'https://shaders.evilrabbit.com/';

const GRADIENTOOL_SOURCE_URL = 'https://www.gradientool.com/';

const GRAINIENT_SOURCE_URL = 'https://grainient.supply/freebies';

const PAPER_FAMILY_QUALITY: Record<PaperShaderFamilyId, number> = {
  'liquid-metal': 92,
  'gem-smoke': 90,
  'god-rays': 89,
  'smoke-ring': 88,
  'mesh-gradient': 87,
  'warp': 86,
  'grain-gradient': 85,
  'water': 84,
  'neuro-noise': 83,
  'static-mesh-gradient': 82,
  'static-radial-gradient': 81,
  'metaballs': 80,
  'perlin-noise': 78,
  'simplex-noise': 77,
  'voronoi': 76,
  'swirl': 75,
  'spiral': 74,
  'color-panels': 73,
  'pulsing-border': 72,
  'waves': 71,
  'dithering': 70,
  'dot-orbit': 68,
  'heatmap': 67,
  'fluted-glass': 65,
  'paper-texture': 62,
  'dot-grid': 60,
  'image-dithering': 58,
  'halftone-dots': 56,
  'halftone-cmyk': 55,
};

const PAPER_PRESET_BONUS: Readonly<Record<string, number>> = {
  'paper-gem-smoke-fire': 2.8,
  'paper-gem-smoke-fluorescent': 2.4,
  'paper-god-rays-ether': 2.6,
  'paper-grain-gradient-wave': 2.2,
  'paper-liquid-metal-noir': 3,
  'paper-liquid-metal-stripes': 2.5,
  'paper-mesh-gradient-purple': 2,
  'paper-smoke-ring-solar': 2.8,
  'paper-static-mesh-gradient-sunset': 2.2,
  'paper-warp-live-ink': 2.7,
  'paper-water-abstract': 2.1,
};

const PAPER_LIVE_MATERIAL_OPTIONS: readonly LiveMaterialOption[] = PAPER_LIVE_MATERIAL_DEFINITIONS.map(
  ({ description, family, id, name, presetIndex }) => ({
    description,
    engine: 'Paper Shaders',
    id,
    name,
    qualityScore: PAPER_FAMILY_QUALITY[family] + (PAPER_PRESET_BONUS[id] ?? (presetIndex === 0 ? 0.8 : 0)),
    sourceLabel: 'Paper · Apache-2.0',
    sourceUrl: PAPER_SHADERS_SOURCE_URL,
  })
);

export const DEFAULT_LIVE_MATERIAL_ID: LiveMaterialId = 'shadergradient-prismatic-sphere';

export const DEFAULT_LIVE_MATERIAL_SETTINGS: LiveMaterialSettings = {
  amplitude: 3.2,
  brightness: 0.8,
  centerX: 0.5,
  centerY: 0.5,
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

export function liveMaterialMotionRate(speed: number): number {
  if (!Number.isFinite(speed) || speed <= 0) return 0;
  return Math.min(3, Math.sqrt(Math.min(1.5, speed)) * 2.1);
}

export function liveMaterialMotionTimeMs(timeMs: number, speed: number): number {
  if (!Number.isFinite(timeMs) || timeMs <= 0) return 0;
  return timeMs * liveMaterialMotionRate(speed);
}

export type ShaderGradientMotionClock = {
  animate: 'off' | 'on';
  uSpeed: number;
  uTime: number;
};

export function resolveShaderGradientMotionClock(
  captureTimeMs: number | null,
  speed: number,
  paused: boolean
): ShaderGradientMotionClock {
  if (captureTimeMs !== null) {
    return {
      animate: 'off',
      // ShaderGradient's loop path derives its phase from uTime / loopDuration;
      // uSpeed controls the path radius. Keep those uniforms independent so a
      // controlled frame closes at the declared loop duration at every speed.
      uSpeed: liveMaterialMotionRate(speed),
      uTime: Math.max(0, captureTimeMs) / 1_000,
    };
  }

  return {
    animate: paused ? 'off' : 'on',
    uSpeed: paused ? 0 : liveMaterialMotionRate(speed),
    uTime: 0,
  };
}

export function liveMaterialCenterOffset(
  settings: Partial<Pick<LiveMaterialSettings, 'centerX' | 'centerY'>>
): { x: number; y: number } {
  const centerX = Math.min(1, Math.max(0, settings.centerX ?? 0.5));
  const centerY = Math.min(1, Math.max(0, settings.centerY ?? 0.5));
  return {
    x: centerX * 2 - 1,
    y: centerY * 2 - 1,
  };
}

export const LIVE_MATERIAL_PALETTES: readonly LiveMaterialPalette[] = [
  { colors: ['#050505', '#F4F4F0', '#737373'], description: 'Neutral chrome with a clean paper highlight.', id: 'monochrome-chrome', name: 'Monochrome chrome' },
  { colors: ['#0D0E12', '#D7E6FF', '#7A82A1'], description: 'Cold silver with a blue-violet reflected edge.', id: 'mercury', name: 'Mercury' },
  { colors: ['#110829', '#865CFF', '#F3A6FF'], description: 'Deep ultraviolet lifted by an electric pink glint.', id: 'ultraviolet', name: 'Ultraviolet' },
  { colors: ['#081310', '#D6FF45', '#3CD6A3'], description: 'Dark mineral green with a sharp signal-lime edge.', id: 'signal-lime', name: 'Signal lime' },
  { colors: ['#1A0A07', '#FF7A45', '#FFD2A8'], description: 'Burnished copper moving into a warm specular highlight.', id: 'copper-heat', name: 'Copper heat' },
  { colors: ['#07131C', '#5BD8FF', '#EAFBFF'], description: 'Near-black blue, cyan energy, and an icy white crest.', id: 'arctic', name: 'Arctic' },
  { colors: ['#0C0C0E', '#FF4D2E', '#F2EEE8'], description: 'Ink, vermilion, and warm paper for editorial motion.', id: 'vermilion-ink', name: 'Vermilion ink' },
  { colors: ['#07112F', '#345DFF', '#A7D8FF'], description: 'Saturated cobalt with a soft atmospheric bloom.', id: 'cobalt-bloom', name: 'Cobalt bloom' },
  { colors: ['#07090D', '#394457', '#F5F7FA'], description: 'Surface Lab’s quiet directional field with deep edge contrast.', id: 'surface-signal-axis', name: 'Signal axis' },
  { colors: ['#06070A', '#28334A', '#EEF2FF'], description: 'Surface Lab’s architectural dark-blue terraces and cool highlight.', id: 'surface-signal-terraces', name: 'Signal terraces' },
  { colors: ['#25113D', '#FF763D', '#FFD06A'], description: 'Surface Lab’s warm amber, coral, and lilac orbit palette.', id: 'surface-solar-orbit', name: 'Solar orbit' },
  { colors: ['#061A22', '#28B9B1', '#B9FFF2'], description: 'Surface Lab’s mineral cyan field with an icy mint crest.', id: 'surface-mineral-wave', name: 'Mineral wave' },
  { colors: ['#DDD8CE', '#F3F0EA', '#FFFFFF'], description: 'Surface Lab’s warm paper neutrals and focused white aperture.', id: 'surface-paper-aperture', name: 'Paper aperture' },
  { colors: ['#F4F4F0', '#181818', '#737373'], description: 'Surface Lab’s monochrome ink-and-paper dither palette.', id: 'surface-ink-dither', name: 'Ink dither' },
  { colors: ['#130A33', '#795CFF', '#7BFFD9'], description: 'Surface Lab’s electric violet and signal-mint pixel palette.', id: 'surface-signal-dither', name: 'Signal dither' },
];

export const LIVE_MATERIAL_LOOK_PRESETS: readonly LiveMaterialLookPreset[] = [
  {
    description: 'A woven holographic surface with moving folds, anisotropic thread highlights, and fine foil sparkle.',
    id: 'holo-cloth',
    materialId: 'holo-cloth-silk',
    name: 'Holo cloth',
    settings: { amplitude: 5.2, brightness: 0.94, density: 1.05, detail: 6.2, frequency: 7.2, grain: 24, rotationZ: 12, speed: 0.22, strength: 0.76 },
  },
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
    description: 'Broad spectral currents converging into one soft, luminous energy field.',
    id: 'spectral-focus',
    materialId: 'shaders-spectral-bloom',
    name: 'Spectral focus',
    settings: { amplitude: 3.8, brightness: 1.04, density: 0.78, detail: 3.2, frequency: 4.2, grain: 12, rotationZ: 28, speed: 0.26, strength: 0.82 },
  },
  {
    description: 'A responsive GPU fluid field with luminous dye, soft advection, and restrained simulation detail.',
    id: 'electric-fluid',
    materialId: 'pavel-fluid-energy',
    name: 'Electric fluid',
    settings: { amplitude: 4.2, brightness: 1.08, density: 1.12, detail: 3.8, frequency: 4.6, grain: 8, speed: 0.48, strength: 0.92 },
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

const ALL_LIVE_MATERIAL_OPTIONS: readonly LiveMaterialOption[] = [
  {
    description: 'A woven holographic textile with procedural folds, thread highlights, and iridescent foil response.',
    engine: 'Holo material',
    id: 'holo-cloth-silk',
    name: 'Holo Cloth',
    qualityScore: 100.5,
    sourceLabel: 'HoloCloth · MIT',
    sourceUrl: HOLOCLOTH_SOURCE_URL,
  },
  {
    description: 'The supplied animated sphere preset with environment light and film grain.',
    engine: 'ShaderGradient',
    id: 'shadergradient-prismatic-sphere',
    name: 'Prismatic sphere',
    qualityScore: 90.5,
  },
  {
    description: 'A spatial letterform built from hundreds of live glyphs, with editable depth, motion, density, and color.',
    engine: 'Glyphfield',
    id: 'glyphfield-glyph-field',
    name: 'Glyph field',
    qualityScore: 93,
  },
  {
    description: 'An original three-color mesh field with broad, editable focal movement.',
    engine: 'Glyphfield',
    id: 'glyphfield-mesh-gradient',
    name: 'Mesh gradient',
    qualityScore: 90,
  },
  {
    description: 'A tactile gradient with animated pigment movement and integrated film grain.',
    engine: 'Glyphfield',
    id: 'glyphfield-grain-gradient',
    name: 'Grain gradient',
    qualityScore: 89,
  },
  {
    description: 'A three-color flow resolved through a crisp ordered-dither matrix.',
    engine: 'Glyphfield',
    id: 'glyphfield-dither-gradient',
    name: 'Dither gradient',
    qualityScore: 82,
  },
  ...PAPER_LIVE_MATERIAL_OPTIONS,
  {
    description: 'A live GPU dye field adapted from Pavel Dobryakov’s MIT-licensed WebGL Fluid Simulation.',
    engine: 'WebGL Fluid',
    id: 'pavel-fluid-energy',
    name: 'Fluid Energy',
    qualityScore: 98,
    sourceLabel: 'PavelDoGreat · MIT',
    sourceUrl: WEBGL_FLUID_SOURCE_URL,
  },
  {
    description: 'Plasma sliced through an adjustable ordered-dither field.',
    engine: 'Shaders.com study',
    id: 'shaders-pixel-beams',
    name: 'Pixel Beams',
    qualityScore: 77,
  },
  {
    description: 'A soft four-stop flow with a fine print-registration screen.',
    engine: 'Shaders.com study',
    id: 'shaders-soft-register',
    name: 'Soft Register',
    qualityScore: 89.5,
  },
  {
    description: 'Soft spectral currents blended into a continuous, luminous energy bloom.',
    engine: 'Shaders.com study',
    id: 'shaders-spectral-bloom',
    name: 'Spectral Bloom',
    qualityScore: 100,
  },
  {
    description: 'Hard directional rays broken across a tactile paper surface.',
    engine: 'Shaders.com study',
    id: 'shaders-pistons',
    name: 'Pistons',
    qualityScore: 87.5,
  },
  {
    description: 'Architectural chrome shaped by dark reflection cards, narrow strip lights, and restrained movement.',
    engine: 'Shaders.com study',
    id: 'shaders-fluid-chrome',
    name: 'Architectural Chrome',
    qualityScore: 97,
  },
  {
    description: 'Directional chroma movement viewed through fluted glass.',
    engine: 'Shaders.com study',
    id: 'shaders-chroma-flow',
    name: 'Chroma Flow',
    qualityScore: 88,
  },
  {
    description: 'A controlled smoke plume with editable emission and decay.',
    engine: 'Shaders.com study',
    id: 'shaders-drift',
    name: 'Drift',
    qualityScore: 86.5,
  },
  {
    description: 'An animated swirl reduced into a graphic pixel mosaic.',
    engine: 'Shaders.com study',
    id: 'shaders-mosaic',
    name: 'Mosaic',
    qualityScore: 79,
  },
  {
    description: 'A neon grid warped over a moving high-contrast field.',
    engine: 'Shaders.com study',
    id: 'shaders-circuit',
    name: 'Circuit',
    qualityScore: 84,
  },
  {
    description: 'An original luminous contour field inspired by Evil Rabbit’s line-based shader direction.',
    engine: 'Design study',
    id: 'study-line-field',
    name: 'Electric Lines',
    qualityScore: 99,
    sourceLabel: 'Evil Rabbit · visual reference',
    sourceUrl: `${EVIL_RABBIT_SHADERS_SOURCE_URL}#lines`,
  },
  {
    description: 'Original chrome light cards and moving glares inspired by Evil Rabbit’s metal studies.',
    engine: 'Design study',
    id: 'study-chrome-glares',
    name: 'Chrome Glares',
    qualityScore: 94.5,
    sourceLabel: 'Evil Rabbit · visual reference',
    sourceUrl: `${EVIL_RABBIT_SHADERS_SOURCE_URL}#glares`,
  },
  {
    description: 'A dimensional color relief with editable ridges, grain, and directional light.',
    engine: 'Design study',
    id: 'study-relief-gradient',
    name: 'Relief Gradient',
    qualityScore: 94,
    sourceLabel: 'Gradientool · visual reference',
    sourceUrl: GRADIENTOOL_SOURCE_URL,
  },
  {
    description: 'Layered color bodies orbiting through a smooth procedural gradient field.',
    engine: 'Design study',
    id: 'study-orbit-gradient',
    name: 'Orbit Gradient',
    qualityScore: 93.5,
    sourceLabel: 'Gradientool · visual reference',
    sourceUrl: GRADIENTOOL_SOURCE_URL,
  },
  {
    description: 'An original dark-centered aura with spectral grain and a soft radiant aperture.',
    engine: 'Design study',
    id: 'study-radiant-void',
    name: 'Radiant Void',
    qualityScore: 96,
    sourceLabel: 'Grainient · visual reference',
    sourceUrl: GRAINIENT_SOURCE_URL,
  },
  {
    description: 'Original refractive rings with galactic color separation and tactile grain.',
    engine: 'Design study',
    id: 'study-galactic-rings',
    name: 'Galactic Rings',
    qualityScore: 95,
    sourceLabel: 'Grainient · visual reference',
    sourceUrl: GRAINIENT_SOURCE_URL,
  },
];

export const LIVE_MATERIAL_OPTIONS: readonly LiveMaterialOption[] = [...ALL_LIVE_MATERIAL_OPTIONS]
  .sort((left, right) => right.qualityScore - left.qualityScore || left.name.localeCompare(right.name));

export const STATIC_SURFACE_MATERIAL_IDS: readonly LiveMaterialId[] =
  PAPER_LIVE_MATERIAL_DEFINITIONS.reduce<LiveMaterialId[]>((ids, { family, id }) => {
    if (family === 'static-mesh-gradient' || family === 'static-radial-gradient') ids.push(id);
    return ids;
  }, []);

const STATIC_SURFACE_MATERIAL_ID_SET = new Set<LiveMaterialId>(STATIC_SURFACE_MATERIAL_IDS);

function isSurfaceLabStaticMaterial(id: LiveMaterialId): boolean {
  return STATIC_SURFACE_MATERIAL_ID_SET.has(id);
}

export const DISCOVERABLE_LIVE_MATERIAL_OPTIONS: readonly LiveMaterialOption[] =
  LIVE_MATERIAL_OPTIONS.filter(({ id }) => !isSurfaceLabStaticMaterial(id));

export function normalizeLiveMaterialId(value?: string | null): LiveMaterialId {
  if (!value) return DEFAULT_LIVE_MATERIAL_ID;
  const exact = LIVE_MATERIAL_OPTIONS.find(({ id }) => id === value);
  if (exact) return exact.id;
  const legacySuffix = value.split('-').slice(1).join('-');
  return LIVE_MATERIAL_OPTIONS.find(({ id }) => id.endsWith(legacySuffix))?.id ?? DEFAULT_LIVE_MATERIAL_ID;
}

export function getLiveMaterial(id: LiveMaterialId): LiveMaterialOption {
  const normalizedId = normalizeLiveMaterialId(id);
  return LIVE_MATERIAL_OPTIONS.find((material) => material.id === normalizedId)
    ?? LIVE_MATERIAL_OPTIONS.find((material) => material.id === DEFAULT_LIVE_MATERIAL_ID)
    ?? LIVE_MATERIAL_OPTIONS[0]!;
}

export function liveMaterialSourceName({
  engine,
  sourceLabel,
}: Pick<LiveMaterialOption, 'engine' | 'sourceLabel'>): string {
  if (engine === 'Shaders.com study') return 'Shaders.com';
  if (engine === 'WebGL Fluid') return 'WebGL';
  if (engine === 'Paper Shaders') return 'Paper';
  if (engine === 'Design study' && sourceLabel) return sourceLabel.split('·')[0]!.trim().replaceAll(' ', '');
  if (engine === 'Holo material') return 'HoloCloth';
  if (engine === 'Design study') return 'Study';
  return engine;
}

export function isPaperLiveMaterialId(id: LiveMaterialId): id is PaperLiveMaterialId {
  return PAPER_LIVE_MATERIAL_DEFINITIONS.some((material) => material.id === id);
}

export function getPaperLiveMaterialDefinition(id: PaperLiveMaterialId): PaperLiveMaterialDefinition {
  return PAPER_LIVE_MATERIAL_DEFINITIONS.find((material) => material.id === id)
    ?? PAPER_LIVE_MATERIAL_DEFINITIONS[0]!;
}
