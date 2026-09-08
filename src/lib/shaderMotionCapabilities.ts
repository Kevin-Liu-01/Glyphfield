import {
  getLiveMaterial,
  getPaperLiveMaterialDefinition,
  isPaperLiveMaterialId,
  type LiveMaterialId,
  type PaperShaderFamilyId,
} from './liveMaterials';

export type ShaderMotionModel = 'static' | 'direct-time' | 'procedural' | 'stateful';
export type ShaderMotionProvider = 'paper' | 'shadergradient' | 'canvas2d' | 'custom-glsl' | 'fluid';

export type ShaderLoopCapability =
  | Readonly<{ kind: 'static' }>
  // No supported period has been established. This does not prove aperiodicity.
  | Readonly<{ kind: 'continuous'; periodMs: null }>
  | Readonly<{
    kind: 'configured';
    periodSource: 'loopDurationMs';
    pixelVerified: false;
  }>
  | Readonly<{
    kind: 'analytic-candidate';
    providerTimePeriod: number;
    providerTimeUnit: 'seconds';
    requiresPresetShape: 'wave' | 'ripple' | 'swirl';
    pixelVerified: false;
  }>;

export type ShaderMotionCapabilities = Readonly<{
  materialId: LiveMaterialId;
  provider: ShaderMotionProvider;
  motionModel: ShaderMotionModel;
  /** An authentic, ready canvas can be captured; a fallback image is not a capture. */
  supportsPngSnapshot: true;
  /** Time is independently addressable, not a promise of cross-device pixel identity. */
  supportsEditableSeek: boolean;
  loop: ShaderLoopCapability;
}>;

// Audited against @paper-design/shaders 0.0.78. Static means the fragment
// output never reads time, not that a preset happens to set speed to zero.
const PAPER_MOTION_MODELS = {
  'color-panels': 'procedural',
  'dithering': 'procedural',
  'dot-grid': 'static',
  'dot-orbit': 'procedural',
  'fluted-glass': 'static',
  'gem-smoke': 'procedural',
  'god-rays': 'procedural',
  'grain-gradient': 'procedural',
  'halftone-cmyk': 'static',
  // This shader declares u_time but does not use it in its output.
  'halftone-dots': 'static',
  'heatmap': 'procedural',
  'image-dithering': 'static',
  'liquid-metal': 'procedural',
  'mesh-gradient': 'procedural',
  'metaballs': 'procedural',
  'neuro-noise': 'procedural',
  'paper-texture': 'static',
  'perlin-noise': 'procedural',
  'pulsing-border': 'procedural',
  'simplex-noise': 'procedural',
  'smoke-ring': 'procedural',
  'spiral': 'procedural',
  'static-mesh-gradient': 'static',
  'static-radial-gradient': 'static',
  'swirl': 'procedural',
  'voronoi': 'procedural',
  'warp': 'procedural',
  'water': 'procedural',
  'waves': 'static',
} as const satisfies Record<PaperShaderFamilyId, ShaderMotionModel>;

const CONTINUOUS_LOOP = { kind: 'continuous', periodMs: null } as const;
const STATIC_LOOP = { kind: 'static' } as const;

// These are periods of the GLSL u_time input, not playback milliseconds.
// Paper's setFrame is in milliseconds; host speed/preset transforms still apply.
// A shape override invalidates the candidate. No candidate authorizes a
// seamless-export claim until real pixels have been checked at the boundary.
const PAPER_LOOP_CANDIDATES: Partial<Record<LiveMaterialId, ShaderLoopCapability>> = {
  'paper-dithering-sine-wave': {
    kind: 'analytic-candidate',
    providerTimePeriod: 4 * Math.PI,
    providerTimeUnit: 'seconds',
    requiresPresetShape: 'wave',
    pixelVerified: false,
  },
  'paper-dithering-ripple': {
    kind: 'analytic-candidate',
    providerTimePeriod: 4 * Math.PI / 3,
    providerTimeUnit: 'seconds',
    requiresPresetShape: 'ripple',
    pixelVerified: false,
  },
  'paper-dithering-swirl': {
    kind: 'analytic-candidate',
    providerTimePeriod: Math.PI,
    providerTimeUnit: 'seconds',
    requiresPresetShape: 'swirl',
    pixelVerified: false,
  },
};

/**
 * Describes the actual renderer selected by the canonical catalog. Capabilities
 * concern shader time only: source assets, pointer uniforms, dimensions, settings
 * and provider versions must also be held fixed for editable reconstruction.
 */
export function getShaderMotionCapabilities(materialId: LiveMaterialId): ShaderMotionCapabilities {
  const { id } = getLiveMaterial(materialId);

  if (isPaperLiveMaterialId(id)) {
    const { family } = getPaperLiveMaterialDefinition(id);
    const motionModel = PAPER_MOTION_MODELS[family];
    return {
      materialId: id,
      provider: 'paper',
      motionModel,
      supportsPngSnapshot: true,
      supportsEditableSeek: motionModel !== 'static',
      loop: motionModel === 'static' ? STATIC_LOOP : PAPER_LOOP_CANDIDATES[id] ?? CONTINUOUS_LOOP,
    };
  }

  if (id === 'pavel-fluid-energy') {
    return {
      materialId: id,
      provider: 'fluid',
      motionModel: 'stateful',
      supportsPngSnapshot: true,
      supportsEditableSeek: false,
      loop: CONTINUOUS_LOOP,
    };
  }

  if (id === 'shadergradient-prismatic-sphere') {
    return {
      materialId: id,
      provider: 'shadergradient',
      motionModel: 'direct-time',
      supportsPngSnapshot: true,
      supportsEditableSeek: true,
      loop: { kind: 'configured', periodSource: 'loopDurationMs', pixelVerified: false },
    };
  }

  return {
    materialId: id,
    provider: id === 'glyphfield-glyph-field' ? 'canvas2d' : 'custom-glsl',
    motionModel: 'direct-time',
    supportsPngSnapshot: true,
    supportsEditableSeek: true,
    loop: CONTINUOUS_LOOP,
  };
}
