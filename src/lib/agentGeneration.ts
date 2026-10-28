import { validateShaderEffectProps } from './shaderEffectsProps';
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
  hydrateBrandIdentities,
  STARTER_BRAND_IDENTITY,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { colorContrastRatio } from '@/lib/color';
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
import type { CanvasDocument } from '@/lib/canvasDocument';
import {
  buildExpressionGenerationDocument,
  expressionGenerationAssetPaths,
  renderExpressionGeneration,
} from '@/lib/expressionGeneration';
import { expressionFormats, expressionState, type ExpressionToolKind } from '@/lib/expressionModel';
import { CODE_LANGUAGES } from '@/lib/expressionSvg';
import { validateBrandIdentitySource } from '@/lib/brandSource';
import { brandBackgroundPalette, brandPatternSettings, expressionLayouts, expressionPartnerOptions } from '@/lib/expressionTemplates';

const AGENT_IDENTITY_PRESETS = [
  'custom',
  'starter',
  'template',
  'basement',
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

type AgentBackgroundPlan = AgentGenerationBase & {
  kind: 'background';
  logoPath: string | null;
  settings: BackgroundSettings;
};

type AgentTemplatePlan = AgentGenerationBase & {
  brand: BrandIdentity;
  /** The Studio's expression document for this template, before assets are embedded. */
  document: CanvasDocument;
  height: number;
  kind: 'template';
  layout: string;
  template: ExpressionToolKind;
  width: number;
};

type AgentElementBriefPlan = AgentGenerationBase & {
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

type AgentDesignSequencePlan = AgentGenerationBase & {
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

export const AGENT_GENERATION_REQUEST_FIELDS = {
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
    'format',
    'identity',
    'kind',
    'language',
    'layout',
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
  const allowedFieldSet = new Set(allowedFields);
  const unknownField = Object.keys(input)
    .filter((key) => !allowedFieldSet.has(key))
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
    if (key === 'effectProps') {
      try { (output as unknown as LiveMaterialSettings).effectProps = validateShaderEffectProps(materialId, value); }
      catch (error) { throw new AgentGenerationError(error instanceof Error ? error.message : 'Invalid effectProps.', 'shader.settings.effectProps'); }
      return;
    }
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

const PRESET_IDENTITY_FIELDS = ['description', 'ink', 'logoDataUrl', 'name', 'paper', 'positioning', 'preset', 'shortName', 'tagline', 'website'] as const;

/**
 * A full identity object (as returned by /api/identities, or a project's custom
 * identity) is read as that identity. A preset object is strict: unknown fields
 * fail with a pointer to { preset } instead of silently rendering Starter.
 */
function fullIdentityValue(input: Record<string, unknown>): BrandIdentity | null {
  if (input.preset !== undefined || typeof input.id !== 'string') return null;
  const looksComplete = Array.isArray(input.colors) && Array.isArray(input.typography);
  if (!looksComplete) {
    const preset = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === input.id);
    if (!preset) {
      throw new AgentGenerationError(
        `identity.id must be an ID from /api/identities (${BUILT_IN_BRAND_IDENTITIES.map(({ id }) => id).join(', ')}), or pass { preset } with optional overrides.`,
        'identity.id',
        'unknown_identity'
      );
    }
    if (Object.keys(input).some((key) => key !== 'id')) {
      throw new AgentGenerationError('Pass either { id } alone, the complete identity object from /api/identities, or { preset } with overrides.', 'identity', 'invalid_identity');
    }
    return preset;
  }
  const { issues, ok } = validateBrandIdentitySource(input, 'full');
  if (!ok) {
    const first = issues.find(({ severity }) => severity === 'error')!;
    throw new AgentGenerationError(`identity is not valid: ${first.message} Validate with POST /api/brand/validate first.`, `identity.${first.path}`, 'invalid_identity');
  }
  const hydrated = hydrateBrandIdentities([input]).find(({ id }) => id === input.id);
  if (!hydrated) {
    throw new AgentGenerationError('identity could not be read as a complete BrandIdentity. Pass { preset: "gt" } or an identity object from /api/identities.', 'identity', 'invalid_identity');
  }
  return hydrated;
}

function agentIdentityFromBrand(base: BrandIdentity): AgentIdentity {
  const builtIn = (AGENT_IDENTITY_PRESETS as readonly string[]).includes(base.id) && BUILT_IN_BRAND_IDENTITIES.some(({ id }) => id === base.id);
  return {
    base,
    description: base.description,
    id: base.id,
    ink: baseColor(base, 'ink', '#181818'),
    logoDataUrl: null,
    name: base.name,
    paper: baseColor(base, 'paper', '#FFFFFF'),
    positioning: base.positioning,
    preset: builtIn ? base.id as AgentIdentityPreset : 'custom',
    shortName: base.shortName,
    tagline: base.tagline,
    website: base.website,
  };
}

function resolveAgentIdentity(value: unknown): AgentIdentity {
  const input = asRecord(value, 'identity');
  const full = fullIdentityValue(input);
  if (full) return agentIdentityFromBrand(full);
  const unknownField = Object.keys(input).filter((key) => !(PRESET_IDENTITY_FIELDS as readonly string[]).includes(key)).sort()[0];
  if (unknownField) {
    throw new AgentGenerationError(
      `identity.${unknownField} is not a preset override. Pass { preset: "gt" } with optional overrides (${PRESET_IDENTITY_FIELDS.join(', ')}), or the complete identity object from /api/identities.`,
      `identity.${unknownField}`,
      'unknown_field'
    );
  }
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

/** The BrandIdentity a template renders with: the preset plus the request's overrides. */
function agentBrandIdentity(identity: AgentIdentity): BrandIdentity {
  const base = identity.base ?? STARTER_BRAND_IDENTITY;
  const custom = identity.base === null;
  const logo = identity.logoDataUrl;
  const logoAssets = logo
    ? ['mark-dark', 'mark-light', 'wordmark', 'wordmark-light'].map((id) => ({ id, label: `${identity.name} logo`, path: logo, surface: 'any' as const, type: 'logo' as const }))
    : [];
  return {
    ...base,
    assets: [...logoAssets, ...base.assets.filter((asset) => !(logo && asset.type === 'logo') && !(custom && asset.type === 'logo'))],
    colors: base.colors.map((color) => color.id === 'ink' ? { ...color, hex: identity.ink } : color.id === 'paper' ? { ...color, hex: identity.paper } : color),
    description: identity.description,
    id: identity.id,
    name: identity.name,
    positioning: identity.positioning,
    proofAssets: custom ? [] : base.proofAssets,
    shortName: identity.shortName,
    tagline: identity.tagline,
    website: identity.website,
  };
}

function outputValue(value: unknown): AgentOutput {
  return oneOf(value, ['json', 'raw'] as const, 'json', 'output');
}

function backgroundSettings(value: unknown, defaults: BackgroundSettings = DEFAULT_BACKGROUND_SETTINGS): BackgroundSettings {
  const input = asRecord(value, 'settings');
  const width = numberValue(
    input.width,
    defaults.width,
    'settings.width',
    64,
    4096,
    true,
    'invalid_dimensions'
  );
  const height = numberValue(
    input.height,
    defaults.height,
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
    angle: numberValue(input.angle, defaults.angle, 'settings.angle', -360, 360),
    bandCount: numberValue(input.bandCount, defaults.bandCount, 'settings.bandCount', 3, 24, true),
    bandDepth: numberValue(input.bandDepth, defaults.bandDepth, 'settings.bandDepth', 0, 100),
    bandGap: numberValue(input.bandGap, defaults.bandGap, 'settings.bandGap', 0, 64),
    colorA: colorValue(input.colorA, defaults.colorA, 'settings.colorA'),
    colorB: colorValue(input.colorB, defaults.colorB, 'settings.colorB'),
    colorC: colorValue(input.colorC, defaults.colorC, 'settings.colorC'),
    ditherMatrix: numericOneOf(
      input.ditherMatrix,
      [2, 4, 8] as const,
      defaults.ditherMatrix,
      'settings.ditherMatrix',
    ),
    ditherShape: oneOf(
      input.ditherShape,
      ['dots', 'squares'] as const satisfies readonly BackgroundDitherShape[],
      defaults.ditherShape,
      'settings.ditherShape'
    ),
    focalX: numberValue(input.focalX, defaults.focalX, 'settings.focalX', 0, 100),
    focalY: numberValue(input.focalY, defaults.focalY, 'settings.focalY', 0, 100),
    gradient: oneOf(
      input.gradient,
      ['linear', 'radial', 'mesh', 'orbit', 'wave', 'bloom'] as const satisfies readonly BackgroundGradient[],
      defaults.gradient,
      'settings.gradient'
    ),
    grain: numberValue(input.grain, defaults.grain, 'settings.grain', 0, 100),
    height,
    logoColor: colorValue(input.logoColor, defaults.logoColor, 'settings.logoColor'),
    logoOpacity: numberValue(input.logoOpacity, defaults.logoOpacity, 'settings.logoOpacity', 0, 100),
    logoScale: numberValue(input.logoScale, defaults.logoScale, 'settings.logoScale', 5, 90),
    logoTone: oneOf(input.logoTone, ['black', 'white'] as const, defaults.logoTone, 'settings.logoTone'),
    logoX: numberValue(input.logoX, defaults.logoX, 'settings.logoX', -50, 50),
    logoY: numberValue(input.logoY, defaults.logoY, 'settings.logoY', -50, 50),
    lightingEnabled: booleanValue(
      input.lightingEnabled,
      defaults.lightingEnabled,
      'settings.lightingEnabled'
    ),
    pattern: oneOf(
      input.pattern,
      ['none', 'dots', 'lines', 'grid', 'fibers', 'speckles', 'topographic', 'crosshatch'] as const satisfies readonly BackgroundPattern[],
      defaults.pattern,
      'settings.pattern'
    ),
    patternOpacity: numberValue(input.patternOpacity, defaults.patternOpacity, 'settings.patternOpacity', 0, 100),
    relief: numberValue(input.relief, defaults.relief, 'settings.relief', 0, 80),
    spacing: numberValue(input.spacing, defaults.spacing, 'settings.spacing', 8, 256, true),
    style: oneOf(
      input.style,
      ['gradient', 'grain-gradient', 'dither', 'pattern'] as const satisfies readonly BackgroundStyle[],
      defaults.style,
      'settings.style'
    ),
    surfaceAngle: numberValue(input.surfaceAngle, defaults.surfaceAngle, 'settings.surfaceAngle', 0, 180),
    surfaceDepth: numberValue(input.surfaceDepth, defaults.surfaceDepth, 'settings.surfaceDepth', 0, 100),
    surfaceMaterial: oneOf(
      input.surfaceMaterial,
      SURFACE_MATERIAL_IDS,
      defaults.surfaceMaterial,
      'settings.surfaceMaterial'
    ),
    surfaceMetallic: numberValue(input.surfaceMetallic, defaults.surfaceMetallic, 'settings.surfaceMetallic', 0, 100),
    surfaceOpenArea: numberValue(input.surfaceOpenArea, defaults.surfaceOpenArea, 'settings.surfaceOpenArea', 0, 92),
    surfaceRoughness: numberValue(input.surfaceRoughness, defaults.surfaceRoughness, 'settings.surfaceRoughness', 0, 100),
    surfaceScale: numberValue(input.surfaceScale, defaults.surfaceScale, 'settings.surfaceScale', 12, 140),
    surfaceTextureAmount: numberValue(input.surfaceTextureAmount, defaults.surfaceTextureAmount, 'settings.surfaceTextureAmount', 0, 100),
    surfaceIrregularity: numberValue(input.surfaceIrregularity, defaults.surfaceIrregularity, 'settings.surfaceIrregularity', 0, 100),
    surfaceLibraryAssetId: oneOf(
      input.surfaceLibraryAssetId,
      ['', ...OPEN_SURFACE_LIBRARY_IDS],
      defaults.surfaceLibraryAssetId,
      'settings.surfaceLibraryAssetId'
    ),
    width,
  };
}

/** Colors default to the identity's palette, so { style } alone stays on brand. */
function brandBackgroundDefaults(identity: AgentIdentity, input: Record<string, unknown>): BackgroundSettings {
  if (!identity.base) return DEFAULT_BACKGROUND_SETTINGS;
  const brand = agentBrandIdentity(identity);
  const settings = asRecord(input.settings, 'settings');
  const [colorA, colorB, colorC] = brandBackgroundPalette(brand);
  const style = typeof settings.style === 'string' ? settings.style : DEFAULT_BACKGROUND_SETTINGS.style;
  return {
    ...DEFAULT_BACKGROUND_SETTINGS,
    colorA,
    colorB,
    colorC,
    logoColor: readableOn(colorA, brand),
    logoTone: readableOn(colorA, brand) === baseColor(brand, 'paper', '#FFFFFF') ? 'white' : 'black',
    ...(style === 'pattern'
      ? brandPatternSettings(
        brand,
        typeof settings.width === 'number' ? settings.width : DEFAULT_BACKGROUND_SETTINGS.width,
        typeof settings.height === 'number' ? settings.height : DEFAULT_BACKGROUND_SETTINGS.height
      )
      : {}),
  };
}

function readableOn(background: string, brand: BrandIdentity): string {
  const ink = baseColor(brand, 'ink', '#181818');
  const paper = baseColor(brand, 'paper', '#FFFFFF');
  return colorContrastRatio(background, paper) >= colorContrastRatio(background, ink) ? paper : ink;
}

function backgroundPlan(input: Record<string, unknown>): AgentBackgroundPlan {
  const identity = resolveAgentIdentity(input.identity);
  const settings = backgroundSettings(input.settings, brandBackgroundDefaults(identity, input));
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

const TEMPLATE_KINDS = ['blog', 'partnership', 'slides', 'opengraph', 'terminal'] as const;

function templateLayout(input: Record<string, unknown>, template: ExpressionToolKind): string {
  const layouts = expressionLayouts(template).map(({ id }) => id);
  if (template === 'slides' && input.slideLayout !== undefined) {
    if (input.layout !== undefined) throw new AgentGenerationError('Pass slideLayout or layout, not both.', 'layout');
    return oneOf(input.slideLayout, layouts, 'title', 'slideLayout');
  }
  if (template !== 'slides' && input.slideLayout !== undefined) {
    throw new AgentGenerationError('slideLayout applies to template slides; use layout for other templates.', 'slideLayout');
  }
  return oneOf(input.layout, layouts, template === 'slides' ? 'title' : '', 'layout');
}

function templateCopy(input: Record<string, unknown>, kind: ExpressionToolKind) {
  return {
    body: input.body === undefined ? undefined : textValue(input.body, '', 'body', kind === 'terminal' ? 4000 : 1000),
    title: input.title === undefined ? undefined : textValue(input.title, '', 'title', 240),
  };
}

function templatePartner(input: Record<string, unknown>, brand: BrandIdentity): string | undefined {
  if (input.partnerId === undefined) return undefined;
  const options = expressionPartnerOptions(brand).map(({ id }) => id);
  const partnerId = textValue(input.partnerId, '', 'partnerId', 80);
  if (!options.includes(partnerId)) {
    throw new AgentGenerationError(`partnerId must reference a partner from /api/identities: ${options.join(', ')}.`, 'partnerId');
  }
  return partnerId;
}

function templatePlan(input: Record<string, unknown>): AgentTemplatePlan {
  const identity = resolveAgentIdentity(input.identity);
  const template = oneOf(input.template, TEMPLATE_KINDS, 'slides', 'template');
  const brand = agentBrandIdentity(identity);
  const layout = templateLayout(input, template);
  const format = input.format === undefined
    ? undefined
    : oneOf(input.format, expressionFormats(template).map(({ id }) => id), expressionFormats(template)[0]!.id, 'format');
  if (input.language !== undefined && template !== 'terminal') throw new AgentGenerationError('language applies to template terminal.', 'language');
  const document = buildExpressionGenerationDocument({
    background: input.background === undefined ? undefined : colorValue(input.background, '#FFFFFF', 'background'),
    backgroundImageDataUrl: imageDataUrl(input.backgroundImageDataUrl, 'backgroundImageDataUrl'),
    ...templateCopy(input, template),
    foreground: input.foreground === undefined ? undefined : colorValue(input.foreground, '#000000', 'foreground'),
    format,
    identity: brand,
    language: input.language === undefined ? undefined : oneOf(input.language, CODE_LANGUAGES.map(({ id }) => id), 'typescript', 'language'),
    layout: layout || undefined,
    partnerId: templatePartner(input, brand),
    partnerLogoDataUrl: imageDataUrl(input.partnerLogoDataUrl, 'partnerLogoDataUrl'),
    template,
    texture: input.texture === undefined ? undefined : oneOf(input.texture, ['dark', 'grid', 'noise', 'white'] as const, 'white', 'texture'),
  });
  const page = document.pages[document.pageIds[0]!]!;
  return {
    brand,
    document,
    filename: `${slug(identity.name)}-${template}-${page.width}x${page.height}.svg`,
    height: page.height,
    identity,
    kind: 'template',
    layout: layout || expressionState(document).pages[document.pageIds[0]!]!.layout,
    output: outputValue(input.output),
    template,
    width: page.width,
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

function designSequenceEffect(input: unknown): AgentDesignSequencePlan['effect'] {
  if (input === undefined || input === null) return null;
  const effectInput = asRecord(input, 'effect');
  const kind = oneOf(
    effectInput.kind,
    ['ascii', 'bayer', 'halftone', 'posterize'] as const satisfies readonly CompositionEffectKind[],
    'bayer',
    'effect.kind'
  );
  const defaults = defaultCompositionEffectSettings(kind);
  return {
    opacity: numberValue(effectInput.opacity, 1, 'effect.opacity', 0, 1),
    settings: {
      ...defaults,
      background: colorValue(effectInput.background, defaults.background, 'effect.background'),
      cellSize: numberValue(effectInput.cellSize, defaults.cellSize, 'effect.cellSize', 1, 64),
      contrast: numberValue(effectInput.contrast, defaults.contrast, 'effect.contrast', 0.1, 4),
      foreground: colorValue(effectInput.foreground, defaults.foreground, 'effect.foreground'),
      invert: booleanValue(effectInput.invert, defaults.invert, 'effect.invert'),
      levels: numberValue(effectInput.levels, defaults.levels, 'effect.levels', 2, 8, true),
      threshold: numberValue(effectInput.threshold, defaults.threshold, 'effect.threshold', 0, 1),
    },
  };
}

function designSequenceTexts(
  input: unknown,
  identity: AgentIdentity
): AgentDesignText[] {
  const textInputs = input === undefined
    ? [{ value: 'Open Source' }]
    : recordArray(input, 'texts', 32);
  return textInputs.map((text, index): AgentDesignText => ({
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
}

function designSequenceLogoPath(identity: AgentIdentity): string | null {
  const assets = identity.base?.assets ?? [];
  const pathsById = new Map(assets.map((asset) => [asset.id, asset.path]));
  for (const id of ['mark-light', 'logo-light', 'mark-dark']) {
    const path = pathsById.get(id);
    if (path) return path;
  }
  return null;
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
  const effect = designSequenceEffect(input.effect);
  const texts = designSequenceTexts(input.texts, identity);
  const exportInput = asRecord(input.export, 'export');
  const logoPath = designSequenceLogoPath(identity);

  return {
    backgroundColor: colorValue(input.backgroundColor, '#111216', 'backgroundColor'),
    effect,
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
      ? expressionGenerationAssetPaths(plan.document)
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

  const rendered = renderExpressionGeneration(plan.document, plan.brand, assets);
  return {
    content: rendered.content,
    filename: plan.filename,
    height: rendered.height,
    mimeType: 'image/svg+xml',
    output: plan.output,
    width: rendered.width,
  };
}
