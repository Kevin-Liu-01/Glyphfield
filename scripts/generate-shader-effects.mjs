/** Regenerate after upgrading the pinned MIT-licensed shaders dependency. */
import { writeFile } from 'node:fs/promises';
import { getAllShaders } from 'shaders/registry';

const infrastructure = {
  Group: 'Use Design Lab layer groups to compose effects.',
  HTMLInCanvas: 'Experimental Chrome-only DOM capture; use Design Lab text and image layers.',
  WebcamTexture: 'Camera capture is not enabled by selecting a material.',
  VideoTexture: 'Video input is a media source, not a standalone material.',
};

// Library order. Finished full-frame materials lead; filters that need a
// source follow; colour adjustments and raw shape primitives come last.
// Within a tier the listed order wins (0.1 apart). Every material must be listed.
const QUALITY_TIERS = [
  [90, ['Aurora', 'LiquidMetal', 'Chrome', 'Holographic', 'Godrays', 'Plasma', 'MeshGradient', 'Nebula', 'ThinFilm', 'FlowingGradient', 'Prism', 'Strands']],
  [86, ['Obsidian', 'LightEdge', 'Neon', 'Irradiance', 'Water', 'Marble', 'Swirl', 'Blob', 'Glass', 'BrushedMetal', 'Hologram', 'Frost', 'Plastic', 'Goo', 'MultiPointGradient', 'Waveform', 'LensFlare', 'StudioBackground', 'SunBurst', 'CarbonFiber', 'Heatmap']],
  [80, ['CurlNoise', 'Voronoi', 'Ripples', 'ConicGradient', 'Voxels', 'SmokeFill', 'Particles', 'InkFlow', 'Smoke', 'SmokeFlow', 'ReactionDiffusion', 'ChromaFlow', 'FloatingParticles', 'FallingLines', 'FractalNoise', 'ErosionNoise', 'Fog', 'ParticleFlow', 'MagneticFilings', 'Boids', 'Beam', 'Crystal']],
  [72, ['SimplexNoise', 'PerlinNoise', 'WorleyNoise', 'WaveletNoise', 'GaborNoise', 'DiamondGradient', 'LinearGradient', 'RadialGradient', 'IsometricCubes', 'Truchet', 'Weave', 'Spiral', 'Scratches', 'SineWave', 'Engraving', 'Halftone', 'Ascii', 'Dither', 'GradientMap', 'Chalkboard', 'CRTScreen', 'Watercolor', 'LightLeak', 'ParticleField', 'Emboss']],
  [64, ['VHS', 'Glitch', 'FlutedGlass', 'GlassTiles', 'Kaleidoscope', 'Form3D', 'Surface3D', 'ContourLines', 'Glow', 'Sparkle', 'ChromaticAberration', 'LensDistortion', 'Shatter', 'PixelSort', 'CursorRipples', 'CursorTrail', 'DataMosh', 'Paper', 'Stone', 'Wool', 'Pixelate', 'ColorWheel', 'TriangularGrid', 'HexGrid', 'DotGrid', 'BrickPattern', 'Chevron', 'Stripes', 'BlockNoise', 'BlueNoise']],
  [56, ['Spherize', 'Twirl', 'WaveDistortion', 'FlowField', 'Bulge', 'ConcentricSpin', 'BarShift', 'PolarCoordinates', 'Repeater', 'GridDistortion', 'Liquify', 'PixelThrow', 'FilmGrain', 'CompressionArtifacts', 'ReflectivePlane', 'BokehBlur', 'ProgressiveBlur', 'TiltShift', 'ZoomBlur', 'AngularBlur', 'ChannelBlur', 'DiffuseBlur', 'LinearBlur', 'Blur', 'ObjectTracker', 'KeyFrames', 'TimeTrail', 'Vignette', 'DropShadow', 'DisplacementMap', 'RectangularCoordinates', 'Mirror', 'Bend', 'Stretch', 'Perspective', 'CornerPin', 'Checkerboard', 'Grid', 'Text', 'ImageTexture']],
  [44, ['PagePeel', 'RippleWipe', 'NoiseDissolve', 'BlockDissolve', 'DiamondWipe', 'IrisWipe', 'RadialWipe', 'VenetianBlinds', 'SliceWipe', 'CheckerWipe', 'RandomBars', 'BarnDoors', 'LinearWipe', 'Flip']],
  [34, ['FilmStock', 'Duotone', 'Tritone', 'Posterize', 'Solarize', 'Tint', 'Invert', 'Grayscale', 'HueShift', 'Saturation', 'Vibrance', 'Exposure', 'BrightnessContrast', 'Sharpness', 'SolidColor']],
  [24, ['Flower', 'Star', 'Ring', 'Polygon', 'Heart', 'Arc', 'Crescent', 'Circle', 'Ellipse', 'RoundedRect', 'Cross', 'Teardrop', 'Vesica', 'Parallelogram', 'Trapezoid', 'Line']],
];
const qualityScores = new Map(QUALITY_TIERS.flatMap(([score, names]) => names.map((name, index) => [name, Math.round((score - index * 0.1) * 10) / 10])));

// Glyphfield defaults where the upstream default is a no-op, or where a colour
// mode would ignore the seeded palette.
const DEFAULT_OVERRIDES = {
  BrightnessContrast: { brightness: 0.08, contrast: 0.45 },
  ColorWheel: { mode: 'custom' },
  CornerPin: { topLeft: { x: 0.08, y: 0.1 }, topRight: { x: 0.94, y: 0.02 }, bottomLeft: { x: 0.02, y: 0.96 }, bottomRight: { x: 0.9, y: 0.86 } },
  Dither: { colorA: '#000000' },
  Exposure: { exposure: 1.7 },
  Flip: { flipX: true },
  Glitch: { intensity: 0.85 },
  GradientMap: { palette: 'custom' },
  HueShift: { shift: 120 },
  InkFlow: { colorMode: 'custom' },
  Perspective: { pan: 24, tilt: 16 },
  Saturation: { intensity: 1.8 },
  Sharpness: { sharpness: 2.5 },
  Solarize: { threshold: 0.35 },
  ThinFilm: { mode: 'custom' },
  Vibrance: { intensity: 1.2 },
};

// Which shared palette stop seeds each colour prop, in prop order: base =
// settings.colorA, main = colorB, highlight = colorC; null keeps upstream.
// Unlisted effects use order: one colour -> main, two -> base/main, more cycle.
const SHAPE_ROLES = ['main', 'highlight'];
const PALETTE_ROLES = {
  Aurora: ['main', 'highlight', 'base'],
  Beam: ['highlight', 'main'],
  Boids: ['main', 'highlight'],
  BrickPattern: ['main', 'base'],
  BrushedMetal: ['highlight', 'base'],
  CarbonFiber: ['highlight', 'base'],
  Chalkboard: ['base', 'highlight'],
  Chrome: ['highlight', 'main', 'highlight'],
  ContourLines: ['main', 'base'],
  Crystal: ['highlight', 'main'],
  CursorTrail: ['main', 'highlight'],
  Dither: ['base', 'highlight'],
  DropShadow: ['base'],
  Duotone: ['base', 'highlight'],
  Engraving: ['base', 'highlight'],
  FallingLines: ['main', 'main'],
  FlowingGradient: ['base', 'main', 'highlight', 'main'],
  FlutedGlass: ['highlight'],
  Glass: ['highlight', 'highlight', 'main'],
  Godrays: ['main', 'base'],
  Goo: ['main', 'highlight'],
  Grid: ['main', 'base'],
  Halftone: ['highlight', null, null, null, 'base'],
  Heatmap: ['base', 'highlight'],
  InkFlow: ['main', 'base', 'main', 'highlight'],
  Irradiance: ['base'],
  IsometricCubes: ['main', 'highlight', 'base'],
  KeyFrames: ['main', 'highlight', 'highlight'],
  LightLeak: ['highlight', 'main', 'base'],
  LiquidMetal: ['highlight', 'base'],
  MagneticFilings: ['main', 'highlight'],
  Marble: ['highlight', 'main', 'base'],
  Nebula: ['highlight', 'main', 'base'],
  Neon: ['main', 'highlight', 'main'],
  ObjectTracker: ['highlight', 'main', 'base', 'highlight'],
  ParticleFlow: ['main', 'highlight'],
  Particles: ['main', 'highlight'],
  Plastic: ['main', 'base', 'highlight'],
  Prism: ['highlight'],
  Smoke: ['main', 'highlight'],
  SmokeFill: ['main', 'highlight'],
  SmokeFlow: ['main', 'highlight'],
  Spherize: ['highlight'],
  StudioBackground: ['base', 'highlight', 'main', 'highlight'],
  SunBurst: ['main', 'base'],
  Surface3D: ['highlight'],
  Vignette: ['base'],
  Voronoi: ['main', 'highlight', 'base'],
  Voxels: ['main', 'base', 'highlight', 'base'],
  Watercolor: ['highlight'],
  Waveform: ['main', 'highlight'],
};
const ORDER_ROLES = ['base', 'main', 'highlight'];
const typesOf = (control) => [control.type].flat();

function paletteRoles(name, category, colorKeys) {
  const roles = PALETTE_ROLES[name] ?? (colorKeys.length === 1 ? ['main'] : category === 'Shapes' ? SHAPE_ROLES : colorKeys.map((_, index) => ORDER_ROLES[index % 3]));
  if (roles.length !== colorKeys.length) throw new Error(`${name}: palette roles must match ${colorKeys.length} colour props.`);
  return Object.fromEntries(colorKeys.map((key, index) => [key, roles[index]]));
}

function nativeProps(item, definition) {
  const props = {
    ...(item.category === 'Shape Effects' ? { surface: { type: 'select', label: 'Surface', group: 'Framing', default: 'canvas', options: [{ label: 'Full canvas', value: 'canvas' }, { label: 'Shape', value: 'shape' }] } } : {}),
    ...(definition.requiresChild || item.name === 'ImageTexture' ? { sourceImage: { type: 'local-image', label: 'Source image', group: 'Source', default: '' } } : {}),
  };
  const overrides = DEFAULT_OVERRIDES[item.name] ?? {};
  for (const [key, prop] of Object.entries(definition.props)) {
    const upstream = prop.default === 'transparent' && [prop.ui?.type].flat().includes('color') ? '#00000000' : prop.ui?.options?.find((option) => String(option.value).toLowerCase() === String(prop.default).toLowerCase())?.value ?? prop.default;
    props[key] = { default: Object.hasOwn(overrides, key) ? overrides[key] : upstream, ...prop.ui };
  }
  // One Speed control: the shared clock drives motion and the native multiplier
  // is hidden. Patterns that default to frozen get a slow rate the clock can move.
  if (props.speed) props.speed = { ...props.speed, default: props.speed.default === 0 ? 0.5 : props.speed.default, hidden: true };
  const colorKeys = Object.keys(props).filter((key) => typesOf(props[key]).includes('color'));
  for (const [key, role] of Object.entries(colorKeys.length ? paletteRoles(item.name, item.category, colorKeys) : {})) if (role) props[key].palette = role;
  for (const control of Object.values(props)) {
    // A non-empty stop list overrides Color A/B upstream, so it takes all three stops.
    if (typesOf(control).includes('gradient-stops') && Array.isArray(control.default)) control.palette = 'ramp';
    if (typesOf(control).includes('list') && Array.isArray(control.default) && control.default.some((entry) => entry?.color)) control.palette = 'lights';
  }
  return props;
}

const index = [];
const props = {};
for (const item of getAllShaders()) {
  const { default: definition } = await import(`shaders/core/${item.name}`);
  const id = `shader-effects-${item.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`;
  const isMaterial = !infrastructure[item.name];
  if (isMaterial && !qualityScores.has(item.name)) throw new Error(`Add ${item.name} to a quality tier.`);
  index.push({
    id,
    component: item.name,
    name: item.name.replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
    category: item.category,
    description: item.description ?? item.name,
    requiresChild: !!definition.requiresChild,
    stateful: item.category === 'Interactive' || ['TimeTrail', 'ParticleField', 'KeyFrames', 'SmokeFill', 'Particles'].includes(item.name),
    infrastructure: infrastructure[item.name] ?? null,
    qualityScore: qualityScores.get(item.name) ?? 0,
  });
  if (isMaterial) props[id] = nativeProps(item, definition);
}
const lines = (rows) => rows.join(',\n');
await writeFile('src/lib/shaderEffectsIndex.generated.json', `[\n${lines(index.map((entry) => JSON.stringify(entry)))}\n]\n`);
await writeFile('src/lib/shaderEffectsProps.generated.json', `{\n${lines(Object.entries(props).map(([id, value]) => `${JSON.stringify(id)}: ${JSON.stringify(value)}`))}\n}\n`);
await writeFile('src/lib/shaderEffectsLoaders.generated.ts', '// Generated by scripts/generate-shader-effects.mjs; lazy chunks keep the GPU engine out of initial page loads.\nexport const shaderEffectsLoaders = {\n' + index.map((e) => `  ${e.component}: () => import('shaders/core/${e.component}'),`).join('\n') + '\n};\n');
console.log(`Generated ${index.length} components (${Object.keys(props).length} materials).`);
