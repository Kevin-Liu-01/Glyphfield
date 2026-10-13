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

function nativeProps(item, definition) {
  const props = {
    ...(item.category === 'Shape Effects' ? { surface: { type: 'select', label: 'Surface', group: 'Framing', default: 'canvas', options: [{ label: 'Full canvas', value: 'canvas' }, { label: 'Shape', value: 'shape' }] } } : {}),
    ...(definition.requiresChild || item.name === 'ImageTexture' ? { sourceImage: { type: 'local-image', label: 'Source image', group: 'Source', default: '' } } : {}),
  };
  for (const [key, prop] of Object.entries(definition.props)) {
    props[key] = { default: prop.default === 'transparent' && [prop.ui?.type].flat().includes('color') ? '#00000000' : prop.ui?.options?.find((option) => String(option.value).toLowerCase() === String(prop.default).toLowerCase())?.value ?? prop.default, ...prop.ui };
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
