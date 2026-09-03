import type { BrandTypography } from './brandIdentity';
import {
  canvasElementAssetSource,
  isCanvasDocumentEnvelope,
  type CanvasDocument,
} from './canvasDocument';
import type { CanvasLayerTransform } from './canvasInteraction';
import type { LogoAppearanceSettings } from './logoAppearance';
import { normalizeHexOrFallback } from './color';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceString,
  sourceStringArray,
} from './sourceCode';
import { parseStudioCanvasDocument } from './studioCanvasDocument';
import type { SlideLayout, TemplateLayerId, TemplateTexture } from './templateSvg';
import type { TemplatePartnerTreatment } from './templateAssets';

type PortableNamedAsset = {
  name: string;
  url: string;
};

type ParsedStudioSource = {
  document: CanvasDocument | null;
  state: Record<string, unknown>;
};

function parseStudioSource(source: string, toolId: string): ParsedStudioSource {
  const root = parseSourceObject(source);
  const portable = isCanvasDocumentEnvelope(root)
    ? parseStudioCanvasDocument(source, toolId)
    : null;
  return {
    document: portable?.document ?? null,
    state: portable?.state ?? root,
  };
}

function namedAsset(value: Record<string, unknown> | null): PortableNamedAsset | null {
  if (!value || typeof value.name !== 'string' || typeof value.url !== 'string') return null;
  return { name: value.name, url: value.url };
}

function portableAsset(
  document: CanvasDocument | null,
  elementId: string,
  value: Record<string, unknown> | null,
  importedName: string
): PortableNamedAsset | null {
  const embeddedSource = document
    ? canvasElementAssetSource(document, elementId)
    : null;
  return embeddedSource
    ? { name: importedName, url: embeddedSource }
    : namedAsset(value);
}

function logoAppearance(
  value: Record<string, unknown> | null,
  fallback: LogoAppearanceSettings
): LogoAppearanceSettings {
  if (!value) return fallback;
  return {
    borderColor: normalizeHexOrFallback(sourceString(value, 'borderColor', fallback.borderColor), fallback.borderColor),
    borderEnabled: sourceBoolean(value, 'borderEnabled', fallback.borderEnabled),
    borderOpacity: sourceNumber(value, 'borderOpacity', fallback.borderOpacity),
    borderWidth: sourceNumber(value, 'borderWidth', fallback.borderWidth),
    ditherAmount: sourceNumber(value, 'ditherAmount', fallback.ditherAmount),
    ditherAngle: sourceNumber(value, 'ditherAngle', fallback.ditherAngle),
    ditherEnabled: sourceBoolean(value, 'ditherEnabled', fallback.ditherEnabled),
    ditherScale: sourceNumber(value, 'ditherScale', fallback.ditherScale),
    invert: sourceBoolean(value, 'invert', fallback.invert),
    shadowBlur: sourceNumber(value, 'shadowBlur', fallback.shadowBlur),
    shadowColor: normalizeHexOrFallback(sourceString(value, 'shadowColor', fallback.shadowColor), fallback.shadowColor),
    shadowEnabled: sourceBoolean(value, 'shadowEnabled', fallback.shadowEnabled),
    shadowOffsetX: sourceNumber(value, 'shadowOffsetX', fallback.shadowOffsetX),
    shadowOffsetY: sourceNumber(value, 'shadowOffsetY', fallback.shadowOffsetY),
    shadowOpacity: sourceNumber(value, 'shadowOpacity', fallback.shadowOpacity),
  };
}

export type OpenGraphWorkspaceDefaults = {
  allowedFontRoles: readonly BrandTypography['role'][];
  background: {
    assetId: string;
    opacity: number;
    scale: number;
    x: number;
    y: number;
  };
  fontRole: BrandTypography['role'];
  fontWeight: number;
  logo: {
    appearance: LogoAppearanceSettings;
    assetId: string;
    scale: number;
    x: number;
    y: number;
  };
  surface: 'dark' | 'light';
  title: string;
};

export type OpenGraphWorkspaceSource = {
  background: (OpenGraphWorkspaceDefaults['background'] & { asset: PortableNamedAsset | null }) | null;
  customFont: PortableNamedAsset | null;
  fontRole: BrandTypography['role'];
  fontWeight: number;
  logo: (OpenGraphWorkspaceDefaults['logo'] & { asset: PortableNamedAsset | null }) | null;
  surface: 'dark' | 'light';
  title: string;
};

export function parseOpenGraphWorkspaceSource(
  source: string,
  toolId: string,
  fallback: OpenGraphWorkspaceDefaults
): OpenGraphWorkspaceSource {
  const { document, state } = parseStudioSource(source, toolId);
  const surface = sourceString(state, 'surface', fallback.surface);
  const fontRole = sourceString(state, 'fontRole', fallback.fontRole);
  if (surface !== 'light' && surface !== 'dark') {
    throw new TypeError('surface must be "light" or "dark".');
  }
  if (!fallback.allowedFontRoles.includes(fontRole as BrandTypography['role'])) {
    throw new TypeError('Unknown typography role.');
  }

  const background = sourceObject(state, 'background');
  const logo = sourceObject(state, 'logo');
  const customFont = sourceObject(state, 'customFont');
  return {
    background: background ? {
      asset: portableAsset(document, 'opengraph-background', sourceObject(background, 'asset'), 'Imported OpenGraph background'),
      assetId: sourceString(background, 'assetId', fallback.background.assetId),
      opacity: sourceNumber(background, 'opacity', fallback.background.opacity),
      scale: sourceNumber(background, 'scale', fallback.background.scale),
      x: sourceNumber(background, 'x', fallback.background.x),
      y: sourceNumber(background, 'y', fallback.background.y),
    } : null,
    customFont: portableAsset(document, 'opengraph-font', customFont, 'Imported OpenGraph font'),
    fontRole: fontRole as BrandTypography['role'],
    fontWeight: sourceNumber(state, 'fontWeight', fallback.fontWeight),
    logo: logo ? {
      appearance: logoAppearance(sourceObject(logo, 'appearance'), fallback.logo.appearance),
      asset: portableAsset(document, 'opengraph-logo', sourceObject(logo, 'asset'), 'Imported OpenGraph mark'),
      assetId: sourceString(logo, 'assetId', fallback.logo.assetId),
      scale: sourceNumber(logo, 'scale', fallback.logo.scale),
      x: sourceNumber(logo, 'x', fallback.logo.x),
      y: sourceNumber(logo, 'y', fallback.logo.y),
    } : null,
    surface,
    title: sourceString(state, 'title', fallback.title),
  };
}

const SLIDE_LAYOUT_IDS: readonly SlideLayout[] = [
  'title',
  'section',
  'agenda',
  'split',
  'metrics',
  'quote',
  'timeline',
  'statement',
  'comparison',
  'process',
  'chart',
  'team',
  'image',
  'closing',
];
const TEMPLATE_TEXTURES: readonly TemplateTexture[] = ['white', 'dark', 'grid', 'noise'];
const TEMPLATE_LAYER_IDS: readonly TemplateLayerId[] = ['brand', 'content', 'footer'];
const TEMPLATE_PARTNER_TREATMENTS: readonly TemplatePartnerTreatment[] = ['logo', 'text'];

type TemplateMediaSource = {
  asset: PortableNamedAsset | null;
  opacity: number;
  scale: number;
  x: number;
  y: number;
};

export type TemplateWorkspaceDefaults = {
  allowedFontRoles: readonly BrandTypography['role'][];
  background: TemplateMediaSource & { libraryAssetId: string };
  body: string;
  brandLayer: CanvasLayerTransform;
  brandLogo: Omit<TemplateMediaSource, 'asset' | 'opacity'>;
  contentLayer: CanvasLayerTransform;
  fontRole: BrandTypography['role'];
  fontWeight: number;
  footerLayer: CanvasLayerTransform;
  layerOrder: readonly TemplateLayerId[];
  partner: TemplateMediaSource & {
    fontAsset: PortableNamedAsset | null;
    fontId: string;
    fontWeight: number;
    gap: number;
    id: string;
    name: string;
    treatment: TemplatePartnerTreatment;
  };
  slideLayout: SlideLayout;
  texture: TemplateTexture;
  textureOpacity: number;
  title: string;
};

export type TemplateWorkspaceSource = {
  background: TemplateWorkspaceDefaults['background'];
  body: string;
  brandLayer: CanvasLayerTransform;
  brandLogo: TemplateWorkspaceDefaults['brandLogo'];
  brandLogoSource: string | null;
  contentLayer: CanvasLayerTransform;
  fontRole: BrandTypography['role'];
  fontSource: string | null;
  fontWeight: number;
  footerLayer: CanvasLayerTransform;
  layerOrder: TemplateLayerId[];
  partner: TemplateWorkspaceDefaults['partner'];
  slideLayout: SlideLayout;
  texture: TemplateTexture;
  textureOpacity: number;
  title: string;
};

function layerTransform(
  layers: Record<string, unknown>,
  key: TemplateLayerId,
  fallback: CanvasLayerTransform
): CanvasLayerTransform {
  const value = sourceObject(layers, key) ?? {};
  return {
    scale: sourceNumber(value, 'scale', fallback.scale),
    x: sourceNumber(value, 'x', fallback.x),
    y: sourceNumber(value, 'y', fallback.y),
  };
}

function exactTemplateLayerOrder(value: readonly string[]): value is TemplateLayerId[] {
  return value.length === TEMPLATE_LAYER_IDS.length
    && new Set(value).size === TEMPLATE_LAYER_IDS.length
    && value.every((id) => TEMPLATE_LAYER_IDS.includes(id as TemplateLayerId));
}

export function parseTemplateWorkspaceSource(
  source: string,
  toolId: string,
  fallback: TemplateWorkspaceDefaults
): TemplateWorkspaceSource {
  const { document, state } = parseStudioSource(source, toolId);
  const background = sourceObject(state, 'background') ?? {};
  const brandLogo = sourceObject(state, 'brandLogo') ?? {};
  const layers = sourceObject(state, 'layers') ?? {};
  const partner = sourceObject(state, 'partner') ?? {};
  const texture = sourceObject(state, 'texture') ?? {};
  const typography = sourceObject(state, 'typography') ?? {};
  const slideLayout = sourceString(state, 'slideLayout', fallback.slideLayout);
  const textureType = sourceString(texture, 'type', fallback.texture);
  const fontRole = sourceString(typography, 'role', fallback.fontRole);
  const partnerTreatment = sourceString(partner, 'treatment', fallback.partner.treatment);
  const layerOrder = sourceStringArray(layers, 'order', [...fallback.layerOrder]);

  if (!SLIDE_LAYOUT_IDS.includes(slideLayout as SlideLayout)) throw new TypeError('Unknown slide layout.');
  if (!TEMPLATE_TEXTURES.includes(textureType as TemplateTexture)) throw new TypeError('Unknown surface texture.');
  if (!fallback.allowedFontRoles.includes(fontRole as BrandTypography['role'])) throw new TypeError('Unknown typography role.');
  if (!TEMPLATE_PARTNER_TREATMENTS.includes(partnerTreatment as TemplatePartnerTreatment)) {
    throw new TypeError('Unknown partner treatment.');
  }
  if (!exactTemplateLayerOrder(layerOrder)) {
    throw new TypeError('Layer order must contain brand, content, and footer exactly once.');
  }

  return {
    background: {
      asset: portableAsset(document, 'template-background', sourceObject(background, 'asset'), 'Imported template background'),
      libraryAssetId: sourceString(background, 'libraryAssetId', fallback.background.libraryAssetId),
      opacity: sourceNumber(background, 'opacity', fallback.background.opacity),
      scale: sourceNumber(background, 'scale', fallback.background.scale),
      x: sourceNumber(background, 'x', fallback.background.x),
      y: sourceNumber(background, 'y', fallback.background.y),
    },
    body: sourceString(state, 'body', fallback.body),
    brandLayer: layerTransform(layers, 'brand', fallback.brandLayer),
    brandLogo: {
      scale: sourceNumber(brandLogo, 'scale', fallback.brandLogo.scale),
      x: sourceNumber(brandLogo, 'x', fallback.brandLogo.x),
      y: sourceNumber(brandLogo, 'y', fallback.brandLogo.y),
    },
    brandLogoSource: document
      ? canvasElementAssetSource(document, 'template-brand')
      : null,
    contentLayer: layerTransform(layers, 'content', fallback.contentLayer),
    fontRole: fontRole as BrandTypography['role'],
    fontSource: document
      ? canvasElementAssetSource(document, 'template-font')
      : null,
    fontWeight: sourceNumber(typography, 'weight', fallback.fontWeight),
    footerLayer: layerTransform(layers, 'footer', fallback.footerLayer),
    layerOrder,
    partner: {
      asset: portableAsset(document, 'template-partner', sourceObject(partner, 'asset'), 'Imported partner mark'),
      fontAsset: portableAsset(document, 'template-partner-font', sourceObject(partner, 'fontAsset'), 'Imported partner font'),
      fontId: sourceString(partner, 'fontId', fallback.partner.fontId),
      fontWeight: sourceNumber(partner, 'fontWeight', fallback.partner.fontWeight),
      gap: sourceNumber(partner, 'gap', fallback.partner.gap),
      id: sourceString(partner, 'id', fallback.partner.id),
      name: sourceString(partner, 'name', fallback.partner.name),
      opacity: fallback.partner.opacity,
      scale: sourceNumber(partner, 'scale', fallback.partner.scale),
      treatment: partnerTreatment as TemplatePartnerTreatment,
      x: sourceNumber(partner, 'x', fallback.partner.x),
      y: sourceNumber(partner, 'y', fallback.partner.y),
    },
    slideLayout: slideLayout as SlideLayout,
    texture: textureType as TemplateTexture,
    textureOpacity: sourceNumber(texture, 'opacity', fallback.textureOpacity),
    title: sourceString(state, 'title', fallback.title),
  };
}
