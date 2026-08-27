import {
  buildBackgroundSvg,
  DEFAULT_BACKGROUND_SETTINGS,
  SURFACE_MATERIAL_IDS,
  type BackgroundDitherShape,
  type BackgroundGradient,
  type BackgroundPattern,
  type BackgroundSettings,
  type BackgroundStyle,
} from '@/lib/backgroundSvg';
import { AGENT_SHADER_LIBRARY } from '@/lib/agentCatalog';
import { OPEN_SURFACE_LIBRARY_IDS } from '@/lib/openSurfaceLibrary';
import { BRAND_ELEMENTS, type BrandElement } from '@/lib/brandElements';
import {
  BUILT_IN_BRAND_IDENTITIES,
  STARTER_BRAND_IDENTITY,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { escapeXml } from '@/lib/download';
import {
  defaultCompositionEffectSettings,
  type CompositionEffectKind,
  type CompositionEffectSettings,
} from '@/lib/compositionEffects';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import { DEFAULT_LOGO_APPEARANCE } from '@/lib/logoAppearance';
import { shaderLabMaterials, shaderLabSettingsFor } from '@/lib/shaderLab';
import { clampShaderZoom } from '@/lib/shaderZoom';
import {
  buildShaderSequenceTimeline,
  normalizeShaderSequenceSettings,
  shaderSequenceMaterialIds,
  type ShaderSequenceSettings,
} from '@/lib/shaderSequence';
import { DEFAULT_TEXT_EFFECT } from '@/lib/textEffects';
import {
  defaultTemplatePartner,
  templateBrandLogo,
  templatePartnerOptions,
  type TemplateKind,
} from '@/lib/templateAssets';
import { buildTemplateSvg, type SlideLayout, type TemplateTexture } from '@/lib/templateSvg';

const AGENT_IDENTITY_PRESETS = [
  'custom',
  'starter',
  'template',
  'gt',
  'ramp',
  'mintlify',
  'tailwind',
  'viteplus',
  'cloudflare',
  'stripe',
] as const;

type AgentIdentityPreset = (typeof AGENT_IDENTITY_PRESETS)[number];
type AgentOutput = 'json' | 'raw';

type AgentIdentity = {
  base: BrandIdentity | null;
  description: string;
  id: string;
  ink: string;
  logoDataUrl: string | null;
  name: string;
  paper: string;
  positioning: string;
  preset: AgentIdentityPreset;
  shortName: string;
  tagline: string;
  website: string;
};

type AgentGenerationBase = {
  filename: string;
  identity: AgentIdentity;
  output: AgentOutput;
};

export type AgentBackgroundPlan = AgentGenerationBase & {
  kind: 'background';
  logoPath: string | null;
  settings: BackgroundSettings;
};

export type AgentTemplatePlan = AgentGenerationBase & {
  backgroundImageDataUrl: string | null;
  background: string;
  body: string;
  brandLogoPath: string | null;
  foreground: string;
  height: number;
  kind: 'template';
  partnerLogoDataUrl: string | null;
  partnerLogoPath: string | null;
  slideLayout: SlideLayout;
  template: TemplateKind;
  texture: TemplateTexture;
  title: string;
  width: number;
};

export type AgentElementBriefPlan = AgentGenerationBase & {
  element: BrandElement;
  kind: 'element-brief';
};

type AgentDesignText = {
  align: 'center' | 'left' | 'right';
  color: string;
  fontRole: 'Accent' | 'Body' | 'Code' | 'Display';
  lineHeight: number;
  name: string;
  opacity: number;
  scale: number;
  tracking: number;
  value: string;
  weight: number;
  widthScale: number;
  wrap: 'nowrap' | 'wrap';
  x: number;
  y: number;
};

export type AgentDesignSequencePlan = AgentGenerationBase & {
  backgroundColor: string;
  effect: {
    opacity: number;
    settings: CompositionEffectSettings;
  } | null;
  exportSettings: {
    durationMs: number;
    fps: number;
    gifLoop: 'raw' | 'seamless';
    quality: 'balanced' | 'best' | 'fast';
    width: number;
  };
  includeBrandMark: boolean;
  kind: 'design-sequence';
  logoPath: string | null;
  ratio: 'opengraph' | 'square' | 'wide';
  sequence: ShaderSequenceSettings;
  shader: {
    blendMode: 'multiply' | 'normal' | 'overlay' | 'screen';
    materialId: LiveMaterialId;
    opacity: number;
    settings: LiveMaterialSettings;
    shaderSize: number;
  };
  texts: AgentDesignText[];
};

export type AgentGenerationPlan =
  | AgentBackgroundPlan
  | AgentDesignSequencePlan
  | AgentElementBriefPlan
  | AgentTemplatePlan;

const AGENT_GENERATION_REQUEST_FIELDS = {
  background: ['identity', 'kind', 'output', 'settings'],
  'design-sequence': [
    'backgroundColor',
    'effect',
    'export',
    'identity',
    'includeBrandMark',
    'kind',
    'ratio',
    'sequence',
    'shader',
    'texts',
  ],
  'element-brief': ['elementId', 'identity', 'kind'],
  template: [
    'background',
    'backgroundImageDataUrl',
    'body',
    'foreground',
    'identity',
    'kind',
    'output',
    'partnerId',
    'partnerLogoDataUrl',
    'slideLayout',
    'template',
    'texture',
    'title',
  ],
} as const satisfies Record<AgentGenerationPlan['kind'], readonly string[]>;

export type AgentArtifact = {
  content: string;
  filename: string;
  height?: number;
  mimeType: 'application/json' | 'image/svg+xml';
  output: AgentOutput;
  width?: number;
};

export class AgentGenerationError extends Error {
  readonly code: string;
  readonly field: string;
  readonly status: number;

  constructor(message: string, field: string, code = 'invalid_request', status = 400) {
    super(message);
    this.code = code;
    this.field = field;
    this.name = 'AgentGenerationError';
    this.status = status;
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgentGenerationError(`${field} must be an object.`, field);
  }
  return value as Record<string, unknown>;
}

function assertAllowedFields(
  input: Record<string, unknown>,
  allowedFields: readonly string[],
  field: string
): void {
  const unknownField = Object.keys(input)
    .filter((key) => !allowedFields.includes(key))
    .sort()[0];
  if (unknownField) {
    throw new AgentGenerationError(
      `${field}.${unknownField} is not part of the generation contract.`,
      `${field}.${unknownField}`,
      'unknown_field'
    );
  }
}

function oneOf<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
  field: string
): T {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new AgentGenerationError(`${field} must be one of: ${values.join(', ')}.`, field);
  }
  return value as T;
}

function textValue(
  value: unknown,
  fallback: string,
  field: string,
  maximumLength: number
): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') {
    throw new AgentGenerationError(`${field} must be a string.`, field);
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maximumLength) {
    throw new AgentGenerationError(
      `${field} must contain 1–${maximumLength} characters.`,
      field
    );
  }
  return trimmed;
}

function numberValue(
  value: unknown,
  fallback: number,
  field: string,
  minimum: number,
  maximum: number,
  integer = false,
  code = 'invalid_request'
): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AgentGenerationError(`${field} must be a finite number.`, field, code);
  }
  if (value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    const qualifier = integer ? 'an integer' : 'a number';
    throw new AgentGenerationError(
      `${field} must be ${qualifier} between ${minimum} and ${maximum}.`,
      field,
      code
    );
  }
  return value;
}

function booleanValue(value: unknown, fallback: boolean, field: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') {
    throw new AgentGenerationError(`${field} must be a boolean.`, field);
  }
  return value;
}

function numericOneOf<T extends number>(
  value: unknown,
  values: readonly T[],
  fallback: T,
  field: string
): T {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !values.includes(value as T)) {
    throw new AgentGenerationError(`${field} must be one of: ${values.join(', ')}.`, field);
  }
  return value as T;
}

function colorValue(value: unknown, fallback: string, field: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) {
    throw new AgentGenerationError(`${field} must be a six-digit HEX color.`, field);
  }
  return value.toLocaleUpperCase();
}

function imageDataUrl(value: unknown, field: string): string | null {
  if (value === undefined) return null;
  if (
    typeof value !== 'string' ||
    value.length > 5_000_000 ||
    !/^data:image\/(?:gif|jpeg|png|svg\+xml|webp);base64,[a-z0-9+/=]+$/i.test(value)
  ) {
    throw new AgentGenerationError(
      `${field} must be a base64 image data URL no larger than 5 MB.`,
      field
    );
  }
  return value;
}

function recordArray(value: unknown, field: string, maximumLength: number): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length > maximumLength) {
    throw new AgentGenerationError(`${field} must be an array with at most ${maximumLength} items.`, field);
  }
  return value.map((item, index) => asRecord(item, `${field}.${index}`));
}

function liveMaterialIdValue(value: unknown, fallback: LiveMaterialId, field: string): LiveMaterialId {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !shaderLabMaterials('', 'all').some(({ id }) => id === value)) {
    throw new AgentGenerationError(`${field} must reference an ID returned by /api/materials.`, field);
  }
  return value as LiveMaterialId;
}

function liveMaterialSettingsValue(
  value: unknown,
  materialId: LiveMaterialId,
  palette: readonly string[]
): LiveMaterialSettings {
  const input = asRecord(value, 'shader.settings');
  const defaults = shaderLabSettingsFor(materialId, {
    ...DEFAULT_LIVE_MATERIAL_SETTINGS,
    colorA: palette[0] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorA,
    colorB: palette[1] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorB,
    colorC: palette[2] ?? DEFAULT_LIVE_MATERIAL_SETTINGS.colorC,
  });
  const output = { ...defaults } as unknown as Record<string, number | string>;
  const controls = AGENT_SHADER_LIBRARY.controls as unknown as Record<string, {
    maximum?: number;
    minimum?: number;
    type: string;
  }>;
  Object.entries(input).forEach(([key, value]) => {
    const fallback = output[key];
    const control = controls[key];
    if (fallback === undefined || !control) {
      throw new AgentGenerationError(`shader.settings.${key} is not a shared material control.`, `shader.settings.${key}`);
    }
    output[key] = typeof fallback === 'number'
      ? numberValue(
          value,
          fallback,
          `shader.settings.${key}`,
          control.minimum ?? -10_000,
          control.maximum ?? 10_000
        )
      : colorValue(value, fallback, `shader.settings.${key}`);
  });
  return output as unknown as LiveMaterialSettings;
}

function slug(value: string): string {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'brand';
}

function shortNameFor(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join('')
    .slice(0, 3)
    .toLocaleUpperCase() || 'BR';
}

function baseColor(identity: BrandIdentity, id: string, fallback: string): string {
  return identity.colors.find((color) => color.id === id)?.hex ?? fallback;
}

function resolveAgentIdentity(value: unknown): AgentIdentity {
  const input = asRecord(value, 'identity');
  const preset = oneOf(
    input.preset,
    AGENT_IDENTITY_PRESETS,
    'starter',
    'identity.preset'
  );
  const base = preset === 'custom'
    ? null
    : BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === preset) ?? null;
  const fallbackName = base?.name ?? 'Custom Brand';
  const name = textValue(input.name, fallbackName, 'identity.name', 80);
  const shortName = textValue(
    input.shortName,
    base?.shortName ?? shortNameFor(name),
    'identity.shortName',
    8
  );

  return {
    base,
    description: textValue(
      input.description,
      base?.description ?? 'A custom identity generated through the Glyphfield agent API.',
      'identity.description',
      320
    ),
    id: preset === 'custom' ? slug(name) : preset,
    ink: colorValue(
      input.ink,
      base ? baseColor(base, 'ink', '#181818') : '#181818',
      'identity.ink'
    ),
    logoDataUrl: imageDataUrl(input.logoDataUrl, 'identity.logoDataUrl'),
    name,
    paper: colorValue(
      input.paper,
      base ? baseColor(base, 'paper', '#FFFFFF') : '#FFFFFF',
      'identity.paper'
    ),
    positioning: textValue(
      input.positioning,
      base?.positioning ?? 'Add a concise positioning statement for this identity.',
      'identity.positioning',
      320
    ),
    preset,
    shortName,
    tagline: textValue(
      input.tagline,
      base?.tagline ?? 'A clear idea, made repeatable.',
      'identity.tagline',
      180
    ),
    website: textValue(
      input.website,
      base?.website ?? 'example.com',
      'identity.website',
      200
    ),
  };
}

function outputValue(value: unknown): AgentOutput {
  return oneOf(value, ['json', 'raw'] as const, 'json', 'output');
}

function backgroundSettings(value: unknown): BackgroundSettings {
  const input = asRecord(value, 'settings');
  const width = numberValue(
    input.width,
    DEFAULT_BACKGROUND_SETTINGS.width,
    'settings.width',
    64,
    4096,
    true,
    'invalid_dimensions'
  );
  const height = numberValue(
    input.height,
    DEFAULT_BACKGROUND_SETTINGS.height,
    'settings.height',
    64,
    4096,
    true,
    'invalid_dimensions'
  );
  if (width * height > 12_000_000) {
    throw new AgentGenerationError(
      'settings width × height must not exceed 12,000,000 pixels.',
      'settings',
      'pixel_limit'
    );
  }

  return {
    angle: numberValue(input.angle, DEFAULT_BACKGROUND_SETTINGS.angle, 'settings.angle', -360, 360),
    bandCount: numberValue(input.bandCount, DEFAULT_BACKGROUND_SETTINGS.bandCount, 'settings.bandCount', 3, 24, true),
    bandDepth: numberValue(input.bandDepth, DEFAULT_BACKGROUND_SETTINGS.bandDepth, 'settings.bandDepth', 0, 100),
    bandGap: numberValue(input.bandGap, DEFAULT_BACKGROUND_SETTINGS.bandGap, 'settings.bandGap', 0, 64),
    colorA: colorValue(input.colorA, DEFAULT_BACKGROUND_SETTINGS.colorA, 'settings.colorA'),
    colorB: colorValue(input.colorB, DEFAULT_BACKGROUND_SETTINGS.colorB, 'settings.colorB'),
    colorC: colorValue(input.colorC, DEFAULT_BACKGROUND_SETTINGS.colorC, 'settings.colorC'),
    ditherMatrix: numericOneOf(
      input.ditherMatrix,
      [2, 4, 8] as const,
      DEFAULT_BACKGROUND_SETTINGS.ditherMatrix,
      'settings.ditherMatrix',
    ),
    ditherShape: oneOf(
      input.ditherShape,
      ['dots', 'squares'] as const satisfies readonly BackgroundDitherShape[],
      DEFAULT_BACKGROUND_SETTINGS.ditherShape,
      'settings.ditherShape'
    ),
    focalX: numberValue(input.focalX, DEFAULT_BACKGROUND_SETTINGS.focalX, 'settings.focalX', 0, 100),
    focalY: numberValue(input.focalY, DEFAULT_BACKGROUND_SETTINGS.focalY, 'settings.focalY', 0, 100),
    gradient: oneOf(
      input.gradient,
      ['linear', 'radial', 'mesh', 'orbit', 'wave', 'bloom'] as const satisfies readonly BackgroundGradient[],
      DEFAULT_BACKGROUND_SETTINGS.gradient,
      'settings.gradient'
    ),
    grain: numberValue(input.grain, DEFAULT_BACKGROUND_SETTINGS.grain, 'settings.grain', 0, 100),
    height,
    logoColor: colorValue(input.logoColor, DEFAULT_BACKGROUND_SETTINGS.logoColor, 'settings.logoColor'),
    logoOpacity: numberValue(input.logoOpacity, DEFAULT_BACKGROUND_SETTINGS.logoOpacity, 'settings.logoOpacity', 0, 100),
    logoScale: numberValue(input.logoScale, DEFAULT_BACKGROUND_SETTINGS.logoScale, 'settings.logoScale', 5, 90),
    logoTone: oneOf(input.logoTone, ['black', 'white'] as const, DEFAULT_BACKGROUND_SETTINGS.logoTone, 'settings.logoTone'),
    logoX: numberValue(input.logoX, DEFAULT_BACKGROUND_SETTINGS.logoX, 'settings.logoX', -50, 50),
    logoY: numberValue(input.logoY, DEFAULT_BACKGROUND_SETTINGS.logoY, 'settings.logoY', -50, 50),
    lightingEnabled: booleanValue(
      input.lightingEnabled,
      DEFAULT_BACKGROUND_SETTINGS.lightingEnabled,
      'settings.lightingEnabled'
    ),
    pattern: oneOf(
      input.pattern,
      ['none', 'dots', 'lines', 'grid', 'fibers', 'speckles', 'topographic', 'crosshatch'] as const satisfies readonly BackgroundPattern[],
      DEFAULT_BACKGROUND_SETTINGS.pattern,
      'settings.pattern'
    ),
    patternOpacity: numberValue(input.patternOpacity, DEFAULT_BACKGROUND_SETTINGS.patternOpacity, 'settings.patternOpacity', 0, 100),
    relief: numberValue(input.relief, DEFAULT_BACKGROUND_SETTINGS.relief, 'settings.relief', 0, 80),
    spacing: numberValue(input.spacing, DEFAULT_BACKGROUND_SETTINGS.spacing, 'settings.spacing', 8, 256, true),
    style: oneOf(
      input.style,
      ['gradient', 'grain-gradient', 'dither', 'pattern'] as const satisfies readonly BackgroundStyle[],
      DEFAULT_BACKGROUND_SETTINGS.style,
      'settings.style'
    ),
    surfaceAngle: numberValue(input.surfaceAngle, DEFAULT_BACKGROUND_SETTINGS.surfaceAngle, 'settings.surfaceAngle', 0, 180),
    surfaceDepth: numberValue(input.surfaceDepth, DEFAULT_BACKGROUND_SETTINGS.surfaceDepth, 'settings.surfaceDepth', 0, 100),
    surfaceMaterial: oneOf(
      input.surfaceMaterial,
      SURFACE_MATERIAL_IDS,
      DEFAULT_BACKGROUND_SETTINGS.surfaceMaterial,
      'settings.surfaceMaterial'
    ),
    surfaceMetallic: numberValue(input.surfaceMetallic, DEFAULT_BACKGROUND_SETTINGS.surfaceMetallic, 'settings.surfaceMetallic', 0, 100),
    surfaceOpenArea: numberValue(input.surfaceOpenArea, DEFAULT_BACKGROUND_SETTINGS.surfaceOpenArea, 'settings.surfaceOpenArea', 0, 92),
    surfaceRoughness: numberValue(input.surfaceRoughness, DEFAULT_BACKGROUND_SETTINGS.surfaceRoughness, 'settings.surfaceRoughness', 0, 100),
    surfaceScale: numberValue(input.surfaceScale, DEFAULT_BACKGROUND_SETTINGS.surfaceScale, 'settings.surfaceScale', 12, 140),
    surfaceTextureAmount: numberValue(input.surfaceTextureAmount, DEFAULT_BACKGROUND_SETTINGS.surfaceTextureAmount, 'settings.surfaceTextureAmount', 0, 100),
    surfaceIrregularity: numberValue(input.surfaceIrregularity, DEFAULT_BACKGROUND_SETTINGS.surfaceIrregularity, 'settings.surfaceIrregularity', 0, 100),
    surfaceLibraryAssetId: oneOf(
      input.surfaceLibraryAssetId,
      ['', ...OPEN_SURFACE_LIBRARY_IDS],
      DEFAULT_BACKGROUND_SETTINGS.surfaceLibraryAssetId,
      'settings.surfaceLibraryAssetId'
    ),
    width,
  };
}

function backgroundPlan(input: Record<string, unknown>): AgentBackgroundPlan {
  const identity = resolveAgentIdentity(input.identity);
  const settings = backgroundSettings(input.settings);
  const mark = identity.base?.assets.find(({ id }) =>
    id === (settings.logoTone === 'white' ? 'mark-light' : 'mark-dark')
  );

  return {
    filename: `${slug(identity.name)}-background-${settings.width}x${settings.height}.svg`,
    identity,
    kind: 'background',
    logoPath: identity.logoDataUrl ? null : mark?.path ?? null,
    output: outputValue(input.output),
    settings,
  };
}

function templatePlan(input: Record<string, unknown>): AgentTemplatePlan {
  const identity = resolveAgentIdentity(input.identity);
  const template = oneOf(
    input.template,
    ['blog', 'partnership', 'slides'] as const,
    'slides',
    'template'
  );
  const texture = oneOf(
    input.texture,
    ['dark', 'grid', 'noise', 'white'] as const,
    'white',
    'texture'
  );
  const slideLayout = oneOf(
    input.slideLayout,
    ['title', 'section', 'agenda', 'split', 'metrics', 'quote', 'timeline', 'statement', 'comparison', 'process', 'chart', 'team', 'image', 'closing'] as const,
    'title',
    'slideLayout'
  );
  const isDark = texture === 'dark';
  const width = template === 'slides' ? 1600 : 1200;
  const height = template === 'slides' ? 900 : template === 'blog' ? 630 : 600;
  const defaultTitle = template === 'partnership'
    ? `${identity.name} × ${identity.base ? defaultTemplatePartner(identity.base).label : 'Northstar'}`
    : template === 'blog'
      ? identity.positioning
      : identity.tagline;
  const brandLogo = identity.base
    ? templateBrandLogo(identity.base, template, isDark)
    : null;
  const partnerOptions = templatePartnerOptions(identity.base ?? STARTER_BRAND_IDENTITY);
  const defaultPartner = identity.base
    ? defaultTemplatePartner(identity.base)
    : defaultTemplatePartner(STARTER_BRAND_IDENTITY);
  const partnerId = textValue(
    input.partnerId,
    defaultPartner.id,
    'partnerId',
    80
  );
  const selectedPartner = partnerOptions.find(({ id }) => id === partnerId);
  if (template === 'partnership' && !input.partnerLogoDataUrl && !selectedPartner) {
    throw new AgentGenerationError(
      `partnerId must reference a public partner asset: ${partnerOptions.map(({ id }) => id).join(', ')}.`,
      'partnerId'
    );
  }

  return {
    background: colorValue(
      input.background,
      isDark ? identity.ink : identity.paper,
      'background'
    ),
    backgroundImageDataUrl: imageDataUrl(
      input.backgroundImageDataUrl,
      'backgroundImageDataUrl'
    ),
    body: textValue(
      input.body,
      template === 'slides' ? 'Foundation\nExpression\nApplication\nDelivery' : identity.description,
      'body',
      1000
    ),
    brandLogoPath: identity.logoDataUrl ? null : brandLogo?.path ?? null,
    filename: `${slug(identity.name)}-${template}-${width}x${height}.svg`,
    foreground: colorValue(
      input.foreground,
      isDark ? identity.paper : identity.ink,
      'foreground'
    ),
    height,
    identity,
    kind: 'template',
    output: outputValue(input.output),
    partnerLogoDataUrl: imageDataUrl(input.partnerLogoDataUrl, 'partnerLogoDataUrl'),
    partnerLogoPath:
      template === 'partnership' && !input.partnerLogoDataUrl
        ? selectedPartner?.path ?? null
        : null,
    slideLayout,
    template,
    texture,
    title: textValue(input.title, defaultTitle, 'title', 240),
    width,
  };
}

function elementBriefPlan(input: Record<string, unknown>): AgentElementBriefPlan {
  const elementId = textValue(input.elementId, '', 'elementId', 80);
  const element = BRAND_ELEMENTS.find(({ id }) => id === elementId);
  if (!element) {
    throw new AgentGenerationError(
      'elementId must reference an ID returned by /api/elements.',
      'elementId'
    );
  }
  const identity = resolveAgentIdentity(input.identity);

  return {
    element,
    filename: `${slug(identity.name)}-${element.id}-brief.json`,
    identity,
    kind: 'element-brief',
    output: 'json',
  };
}

function designSequencePlan(input: Record<string, unknown>): AgentDesignSequencePlan {
  const identity = resolveAgentIdentity(input.identity);
  const shaderInput = asRecord(input.shader, 'shader');
  const materialId = liveMaterialIdValue(shaderInput.materialId, 'paper-gem-smoke', 'shader.materialId');
  const sequenceInput = asRecord(input.sequence, 'sequence');
  const sequence = normalizeShaderSequenceSettings({
    cutCount: numberValue(sequenceInput.cutCount, 10, 'sequence.cutCount', 8, 12, true),
    finalHoldMs: numberValue(sequenceInput.finalHoldMs, 5_000, 'sequence.finalHoldMs', 3_000, 6_000, true),
    pace: oneOf(sequenceInput.pace, ['accelerating', 'even'] as const, 'accelerating', 'sequence.pace'),
  });
  const baseColors = identity.base?.colors.map(({ hex }) => hex) ?? [];
  const palette = [identity.ink, baseColors[2] ?? '#737373', identity.paper];
  const effectInput = input.effect === undefined || input.effect === null
    ? null
    : asRecord(input.effect, 'effect');
  const effectKind = effectInput
    ? oneOf(
        effectInput.kind,
        ['ascii', 'bayer', 'halftone', 'posterize'] as const satisfies readonly CompositionEffectKind[],
        'bayer',
        'effect.kind'
      )
    : null;
  const effectDefaults = effectKind ? defaultCompositionEffectSettings(effectKind) : null;
  const effectSettings = effectDefaults && effectInput
    ? {
        ...effectDefaults,
        background: colorValue(effectInput.background, effectDefaults.background, 'effect.background'),
        cellSize: numberValue(effectInput.cellSize, effectDefaults.cellSize, 'effect.cellSize', 1, 64),
        contrast: numberValue(effectInput.contrast, effectDefaults.contrast, 'effect.contrast', 0.1, 4),
        foreground: colorValue(effectInput.foreground, effectDefaults.foreground, 'effect.foreground'),
        invert: booleanValue(effectInput.invert, effectDefaults.invert, 'effect.invert'),
        levels: numberValue(effectInput.levels, effectDefaults.levels, 'effect.levels', 2, 8, true),
        threshold: numberValue(effectInput.threshold, effectDefaults.threshold, 'effect.threshold', 0, 1),
      }
    : null;
  const textInputs = input.texts === undefined
    ? [{ value: 'Open Source' }]
    : recordArray(input.texts, 'texts', 32);
  const texts = textInputs.map((text, index): AgentDesignText => ({
    align: oneOf(text.align, ['center', 'left', 'right'] as const, 'center', `texts.${index}.align`),
    color: colorValue(text.color, identity.paper, `texts.${index}.color`),
    fontRole: oneOf(text.fontRole, ['Accent', 'Body', 'Code', 'Display'] as const, 'Display', `texts.${index}.fontRole`),
    lineHeight: numberValue(text.lineHeight, 1, `texts.${index}.lineHeight`, 0.7, 1.8),
    name: textValue(text.name, `Text ${index + 1}`, `texts.${index}.name`, 80),
    opacity: numberValue(text.opacity, 1, `texts.${index}.opacity`, 0, 1),
    scale: numberValue(text.scale, 1, `texts.${index}.scale`, 0.2, 3),
    tracking: numberValue(text.tracking, 0, `texts.${index}.tracking`, -0.12, 0.2),
    value: textValue(text.value, 'Open Source', `texts.${index}.value`, 1_000),
    weight: numberValue(text.weight, 500, `texts.${index}.weight`, 100, 900, true),
    widthScale: numberValue(text.widthScale, 1, `texts.${index}.widthScale`, 0.25, 3),
    wrap: oneOf(text.wrap, ['nowrap', 'wrap'] as const, 'wrap', `texts.${index}.wrap`),
    x: numberValue(text.x, 0, `texts.${index}.x`, -5_000, 5_000),
    y: numberValue(text.y, index * 120, `texts.${index}.y`, -5_000, 5_000),
  }));
  const exportInput = asRecord(input.export, 'export');
  const logoPath = identity.base?.assets.find(({ id }) => id === 'mark-light')?.path
    ?? identity.base?.assets.find(({ id }) => id === 'logo-light')?.path
    ?? identity.base?.assets.find(({ id }) => id === 'mark-dark')?.path
    ?? null;

  return {
    backgroundColor: colorValue(input.backgroundColor, '#111216', 'backgroundColor'),
    effect: effectSettings && effectInput ? {
      opacity: numberValue(effectInput.opacity, 1, 'effect.opacity', 0, 1),
      settings: effectSettings,
    } : null,
    exportSettings: {
      durationMs: numberValue(exportInput.durationMs, 1_600, 'export.durationMs', 1_200, 4_000, true),
      fps: numericOneOf(exportInput.fps, [12, 15, 24, 30] as const, 30, 'export.fps'),
      gifLoop: oneOf(exportInput.gifLoop, ['raw', 'seamless'] as const, 'seamless', 'export.gifLoop'),
      quality: oneOf(exportInput.quality, ['balanced', 'best', 'fast'] as const, 'best', 'export.quality'),
      width: numberValue(exportInput.width, 1_920, 'export.width', 320, 3_840, true),
    },
    filename: `${slug(identity.name)}-design-lab-shader-sequence.json`,
    identity,
    includeBrandMark: booleanValue(input.includeBrandMark, true, 'includeBrandMark'),
    kind: 'design-sequence',
    logoPath: identity.logoDataUrl ? null : logoPath,
    output: 'json',
    ratio: oneOf(input.ratio, ['opengraph', 'square', 'wide'] as const, 'wide', 'ratio'),
    sequence,
    shader: {
      blendMode: oneOf(shaderInput.blendMode, ['multiply', 'normal', 'overlay', 'screen'] as const, 'normal', 'shader.blendMode'),
      materialId,
      opacity: numberValue(shaderInput.opacity, 1, 'shader.opacity', 0, 1),
      settings: liveMaterialSettingsValue(shaderInput.settings, materialId, palette),
      shaderSize: clampShaderZoom(numberValue(shaderInput.shaderSize, 1, 'shader.shaderSize', 0.1, 10)),
    },
    texts,
  };
}

export function planAgentGeneration(value: unknown): AgentGenerationPlan {
  const input = asRecord(value, 'request');
  const kind = oneOf(
    input.kind,
    ['background', 'design-sequence', 'element-brief', 'template'] as const,
    'template',
    'kind'
  );
  assertAllowedFields(input, AGENT_GENERATION_REQUEST_FIELDS[kind], 'request');

  if (kind === 'background') return backgroundPlan(input);
  if (kind === 'design-sequence') return designSequencePlan(input);
  if (kind === 'element-brief') return elementBriefPlan(input);
  return templatePlan(input);
}

export function agentAssetPaths(plan: AgentGenerationPlan): string[] {
  const paths = plan.kind === 'background'
    ? [plan.logoPath]
    : plan.kind === 'design-sequence'
      ? [plan.logoPath]
    : plan.kind === 'template'
      ? [plan.brandLogoPath, plan.partnerLogoPath]
      : [];
  return [...new Set(paths.filter((path): path is string => Boolean(path)))];
}

function monogramDataUrl(identity: AgentIdentity, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><text x="256" y="310" text-anchor="middle" fill="${color}" font-family="Switzer,Arial,sans-serif" font-size="180" font-weight="550">${escapeXml(identity.shortName)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function identityBrief(identity: AgentIdentity) {
  const base = identity.base ?? STARTER_BRAND_IDENTITY;
  return {
    colors: base.colors.map((color) => ({
      ...color,
      hex: color.id === 'ink' ? identity.ink : color.id === 'paper' ? identity.paper : color.hex,
    })),
    description: identity.description,
    id: identity.id,
    name: identity.name,
    positioning: identity.positioning,
    shortName: identity.shortName,
    tagline: identity.tagline,
    typography: base.typography,
    voice: base.voice,
    website: identity.website,
  };
}

export function renderAgentGeneration(
  plan: AgentGenerationPlan,
  assets: Readonly<Record<string, string>>
): AgentArtifact {
  if (plan.kind === 'background') {
    const logo = plan.identity.logoDataUrl ?? (plan.logoPath ? assets[plan.logoPath] : null);
    return {
      content: buildBackgroundSvg(plan.settings, {
        logo: logo ?? undefined,
        name: plan.identity.shortName,
      }),
      filename: plan.filename,
      height: plan.settings.height,
      mimeType: 'image/svg+xml',
      output: plan.output,
      width: plan.settings.width,
    };
  }

  if (plan.kind === 'design-sequence') {
    const shaderId = 'shader-canvas-1';
    const effectId = 'effect-sequence-1';
    const logoId = 'logo-brand';
    const logo = plan.identity.logoDataUrl
      ?? (plan.logoPath ? assets[plan.logoPath] : null)
      ?? monogramDataUrl(plan.identity, plan.identity.paper);
    const textLayers = plan.texts.map((text, index) => ({
      align: text.align,
      color: text.color,
      fontRole: text.fontRole,
      id: `text-agent-${index + 1}`,
      lineHeight: text.lineHeight,
      name: text.name,
      opacity: text.opacity,
      textEffect: { ...DEFAULT_TEXT_EFFECT },
      tracking: text.tracking,
      transform: {
        heightScale: 1,
        scale: text.scale,
        widthScale: text.widthScale,
        x: text.x,
        y: text.y,
      },
      value: text.value,
      visible: true,
      weight: text.weight,
      wrap: text.wrap,
    }));
    const layerOrder = [
      shaderId,
      ...(plan.effect ? [effectId] : []),
      ...(plan.includeBrandMark ? [logoId] : []),
      ...textLayers.map(({ id }) => id),
    ];
    const sequenceMaterialIds = shaderSequenceMaterialIds(plan.shader.materialId, plan.sequence.cutCount);
    const sequenceTimeline = buildShaderSequenceTimeline(sequenceMaterialIds, plan.sequence);
    const document = {
      version: 3,
      composition: {
        assets: [],
        backgroundColor: plan.backgroundColor,
        effectLayers: plan.effect ? [{
          id: effectId,
          name: `${plan.effect.settings.kind[0]!.toUpperCase()}${plan.effect.settings.kind.slice(1)}`,
          opacity: plan.effect.opacity,
          settings: plan.effect.settings,
          visible: true,
        }] : [],
        groups: [],
        layerOrder,
        layerShaders: {},
        logos: plan.includeBrandMark ? [{
          appearance: { ...DEFAULT_LOGO_APPEARANCE },
          color: plan.identity.paper,
          id: logoId,
          name: 'Brand mark',
          opacity: 1,
          transform: { scale: 1, x: 0, y: 0 },
          url: logo,
          visible: true,
        }] : [],
        shaderLayers: [{
          ...plan.shader,
          id: shaderId,
          name: 'Canvas shader 1',
          visible: true,
        }],
        textLayers,
      },
      exportSettings: plan.exportSettings,
      ratio: plan.ratio,
      shaderSequence: {
        ...plan.sequence,
        targetLayerId: shaderId,
      },
      timeline: { frame: 0, paused: false },
    };
    return {
      content: JSON.stringify({
        automation: {
          apply: "await window.glyphfield.studio.applySource(response.document)",
          export: "await window.glyphfield.studio.invoke('design.export', { format: 'mp4', mode: 'shader-sequence', download: true })",
          exports: {
            gif: "await window.glyphfield.studio.invoke('design.export', { format: 'gif', download: true })",
            jpg: "await window.glyphfield.studio.invoke('design.export', { format: 'jpg', download: true })",
            mp4: "await window.glyphfield.studio.invoke('design.export', { format: 'mp4', download: true })",
            png: "await window.glyphfield.studio.invoke('design.export', { format: 'png', download: true })",
            shaderSequenceGif: "await window.glyphfield.studio.invoke('design.export', { format: 'gif', mode: 'shader-sequence', download: true })",
            shaderSequenceMp4: "await window.glyphfield.studio.invoke('design.export', { format: 'mp4', mode: 'shader-sequence', download: true })",
          },
          global: 'window.glyphfield.studio',
          open: '/studio',
        },
        document,
        kind: plan.kind,
        schemaVersion: 1,
        sequence: {
          durationMs: sequenceTimeline.at(-1)?.endMs ?? 0,
          timeline: sequenceTimeline,
        },
      }, null, 2),
      filename: plan.filename,
      mimeType: 'application/json',
      output: 'json',
    };
  }

  if (plan.kind === 'element-brief') {
    return {
      content: JSON.stringify(
        {
          element: plan.element,
          generation: {
            previewFamily: plan.element.preview,
            source: '/api/elements',
          },
          identity: identityBrief(plan.identity),
          schemaVersion: 1,
        },
        null,
        2
      ),
      filename: plan.filename,
      mimeType: 'application/json',
      output: 'json',
    };
  }

  const brandLogo = plan.identity.logoDataUrl
    ?? (plan.brandLogoPath ? assets[plan.brandLogoPath] : null)
    ?? monogramDataUrl(plan.identity, plan.foreground);
  const partnerLogo = plan.partnerLogoDataUrl
    ?? (plan.partnerLogoPath ? assets[plan.partnerLogoPath] : null);
  return {
    content: buildTemplateSvg({
      background: plan.background,
      backgroundImage: plan.backgroundImageDataUrl,
      body: plan.body,
      brandLogo,
      foreground: plan.foreground,
      height: plan.height,
      identityName: plan.identity.name,
      invertPartner: plan.texture === 'dark',
      kind: plan.template,
      partnerLogo,
      slideLayout: plan.slideLayout,
      texture: plan.texture,
      title: plan.title,
      website: plan.identity.website,
      width: plan.width,
    }),
    filename: plan.filename,
    height: plan.height,
    mimeType: 'image/svg+xml',
    output: plan.output,
    width: plan.width,
  };
}
