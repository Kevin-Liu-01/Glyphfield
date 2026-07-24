import {
  buildBackgroundSvg,
  DEFAULT_BACKGROUND_SETTINGS,
  type BackgroundGradient,
  type BackgroundPattern,
  type BackgroundSettings,
  type BackgroundStyle,
} from '@/lib/backgroundSvg';
import { BRAND_ELEMENTS, type BrandElement } from '@/lib/brandElements';
import {
  BUILT_IN_BRAND_IDENTITIES,
  STARTER_BRAND_IDENTITY,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { escapeXml } from '@/lib/download';
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

export type AgentGenerationPlan =
  | AgentBackgroundPlan
  | AgentElementBriefPlan
  | AgentTemplatePlan;

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
  integer = false
): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new AgentGenerationError(`${field} must be a finite number.`, field);
  }
  if (value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    const qualifier = integer ? 'an integer' : 'a number';
    throw new AgentGenerationError(
      `${field} must be ${qualifier} between ${minimum} and ${maximum}.`,
      field
    );
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
    true
  );
  const height = numberValue(
    input.height,
    DEFAULT_BACKGROUND_SETTINGS.height,
    'settings.height',
    64,
    4096,
    true
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
    colorA: colorValue(input.colorA, DEFAULT_BACKGROUND_SETTINGS.colorA, 'settings.colorA'),
    colorB: colorValue(input.colorB, DEFAULT_BACKGROUND_SETTINGS.colorB, 'settings.colorB'),
    ditherMatrix: numericOneOf(
      input.ditherMatrix,
      [2, 4, 8] as const,
      DEFAULT_BACKGROUND_SETTINGS.ditherMatrix,
      'settings.ditherMatrix',
    ),
    gradient: oneOf(
      input.gradient,
      ['linear', 'radial'] as const satisfies readonly BackgroundGradient[],
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
    pattern: oneOf(
      input.pattern,
      ['none', 'dots', 'lines', 'grid'] as const satisfies readonly BackgroundPattern[],
      DEFAULT_BACKGROUND_SETTINGS.pattern,
      'settings.pattern'
    ),
    patternOpacity: numberValue(input.patternOpacity, DEFAULT_BACKGROUND_SETTINGS.patternOpacity, 'settings.patternOpacity', 0, 100),
    spacing: numberValue(input.spacing, DEFAULT_BACKGROUND_SETTINGS.spacing, 'settings.spacing', 8, 256, true),
    style: oneOf(
      input.style,
      ['gradient', 'grain-gradient', 'dither', 'pattern'] as const satisfies readonly BackgroundStyle[],
      DEFAULT_BACKGROUND_SETTINGS.style,
      'settings.style'
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

export function planAgentGeneration(value: unknown): AgentGenerationPlan {
  const input = asRecord(value, 'request');
  const kind = oneOf(
    input.kind,
    ['background', 'element-brief', 'template'] as const,
    'template',
    'kind'
  );

  if (kind === 'background') return backgroundPlan(input);
  if (kind === 'element-brief') return elementBriefPlan(input);
  return templatePlan(input);
}

export function agentAssetPaths(plan: AgentGenerationPlan): string[] {
  const paths = plan.kind === 'background'
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
