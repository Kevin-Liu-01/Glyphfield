export type LiveMaterialId =
  | 'shadergradient-prismatic-sphere'
  | 'ariadne-pixel-beams'
  | 'ariadne-soft-register'
  | 'ariadne-spectral-bloom'
  | 'ariadne-pistons'
  | 'ariadne-fluid-chrome'
  | 'ariadne-chroma-flow'
  | 'ariadne-drift'
  | 'ariadne-mosaic'
  | 'ariadne-circuit'
  | 'ariadne-dedalus-bloom';

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
  engine: 'ShaderGradient' | 'Glyphfield GLSL';
  id: LiveMaterialId;
  name: string;
};

export const SHADER_GRADIENT_SOURCE_URL =
  'https://shadergradient.co/customize?animate=on&axesHelper=off&brightness=0.8&cAzimuthAngle=270&cDistance=0.5&cPolarAngle=180&cameraZoom=15.1&color1=%2373bfc4&color2=%23ff810a&color3=%238da0ce&destination=onCanvas&embedMode=off&envPreset=city&format=gif&fov=45&frameRate=10&gizmoHelper=hide&grain=on&lightType=env&pixelDensity=1&positionX=-0.1&positionY=0&positionZ=0&range=enabled&rangeEnd=40&rangeStart=0&rotationX=0&rotationY=130&rotationZ=70&shader=defaults&type=sphere&uAmplitude=3.2&uDensity=0.8&uFrequency=5.5&uSpeed=0.3&uStrength=0.3&uTime=0&wireframe=false&zoomOut=true';

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

export const LIVE_MATERIAL_OPTIONS: readonly LiveMaterialOption[] = [
  {
    description: 'The supplied animated sphere preset with environment light and film grain.',
    engine: 'ShaderGradient',
    id: 'shadergradient-prismatic-sphere',
    name: 'Prismatic sphere',
  },
  {
    description: 'Plasma sliced through an adjustable ordered-dither field.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-pixel-beams',
    name: 'Pixel Beams',
  },
  {
    description: 'A soft four-stop flow with a fine print-registration screen.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-soft-register',
    name: 'Soft Register',
  },
  {
    description: 'A radial color bloom with spectral rotation and print texture.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-spectral-bloom',
    name: 'Spectral Bloom',
  },
  {
    description: 'Hard directional rays broken across a tactile paper surface.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-pistons',
    name: 'Pistons',
  },
  {
    description: 'A refractive glass lens over an animated swirl and flow field.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-fluid-chrome',
    name: 'Fluid Chrome',
  },
  {
    description: 'Directional chroma movement viewed through fluted glass.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-chroma-flow',
    name: 'Chroma Flow',
  },
  {
    description: 'A controlled smoke plume with editable emission and decay.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-drift',
    name: 'Drift',
  },
  {
    description: 'An animated swirl reduced into a graphic pixel mosaic.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-mosaic',
    name: 'Mosaic',
  },
  {
    description: 'A neon grid warped over a moving high-contrast field.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-circuit',
    name: 'Circuit',
  },
  {
    description: 'A dimensional blob and wave composition with film grain.',
    engine: 'Glyphfield GLSL',
    id: 'ariadne-dedalus-bloom',
    name: 'Dedalus Bloom',
  },
];

export function getLiveMaterial(id: LiveMaterialId): LiveMaterialOption {
  return LIVE_MATERIAL_OPTIONS.find((material) => material.id === id) ?? LIVE_MATERIAL_OPTIONS[0]!;
}
