import {
  brandAssetPath,
  brandFontAssets,
  BUILT_IN_BRAND_IDENTITIES,
  type BrandIdentity,
  type BrandTypography,
} from './brandIdentity';
import {
  canvasElementAssetSource,
  isCanvasDocumentEnvelope,
  parseCanvasDocument,
  type CanvasAsset,
  type CanvasDocument,
  type CanvasElement,
} from './canvasDocument';
import {
  parseOpenGraphWorkspaceSource,
  parseTemplateWorkspaceSource,
  type TemplateWorkspaceSource,
} from './expressionWorkspaceSource';
import {
  activeCodeTab,
  dataString,
  elementComponent,
  elementSlot,
  EXPRESSION_SOURCE_VERSION,
  expressionAsset,
  expressionState,
  expressionToolId,
  insertElements,
  isExpressionToolKind,
  newExpressionElement,
  pageElements,
  patchElement,
  readCodeTabs,
  readExpressionState,
  removeElements,
  slotElement,
  touchDocument,
  withAssets,
  withExpressionState,
  type CodeTab,
  type ExpressionFontRole,
  type ExpressionToolKind,
  type LockupPartner,
} from './expressionModel';
import {
  applyExpressionLayout,
  createExpressionDocument,
  expressionFont,
  expressionPartnerOptions,
  expressionRecipe,
  partnerAspectGuess,
} from './expressionTemplates';
import { DEFAULT_LOGO_APPEARANCE } from './logoAppearance';
import { parseSourceObject, sourceNumber, sourceObject, sourceString } from './sourceCode';
import { defaultTemplatePartnerFont, templatePartnerFontOptions, templatePartnerOptions } from './templateAssets';

/**
 * Source boundary for expression tools: reads current (source version 2)
 * documents and migrates the flat version-1 tool states saved before the
 * shared expression editor existed.
 */

export function uploadedFontFamily(assetId: string): string {
  return `gf-${assetId.replace(/^font:/, '').replace(/[^a-zA-Z0-9-]/g, '-')}`;
}

function styled(element: CanvasElement, keys: readonly string[]): string[] {
  const current = Array.isArray(element.data.styled) ? element.data.styled.filter((key): key is string => typeof key === 'string') : [];
  return [...new Set([...current, ...keys])];
}

function fontRoleOrThrow(identity: BrandIdentity, value: string): ExpressionFontRole {
  if (!identity.typography.some(({ role }) => role === value)) throw new TypeError('Unknown typography role.');
  return value as ExpressionFontRole;
}

function setTextRole(document: CanvasDocument, element: CanvasElement, identity: BrandIdentity, role: ExpressionFontRole, weight: number): CanvasDocument {
  const font = expressionFont(identity, role);
  return patchElement(withAssets(document, [font.asset]), element.id, {
    data: { styled: styled(element, ['role', 'weight']) },
    textStyle: { fontFamily: font.family, fontId: font.asset.id, fontRole: role, fontWeight: weight },
  });
}

function applyUploadedFont(document: CanvasDocument, element: CanvasElement, asset: { name: string; url: string }): CanvasDocument {
  const id = `font:upload-${hashString(asset.url)}`;
  return patchElement(withAssets(document, [expressionAsset(id, asset.name, asset.url, 'font')]), element.id, {
    data: { styled: styled(element, ['role']) },
    textStyle: { fontFamily: uploadedFontFamily(id), fontId: id },
  });
}

export function hashString(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += Math.max(1, Math.floor(value.length / 4096))) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function replaceMedia(
  document: CanvasDocument,
  pageId: string,
  source: string,
  name: string,
  libraryId: string | null,
  options: { bounds?: CanvasElement['bounds']; opacity: number; scale: number; x: number; y: number }
): CanvasDocument {
  const current = slotElement(document, pageId, 'media');
  const page = document.pages[pageId]!;
  const bounds = options.bounds ?? current?.bounds ?? { height: page.height, rotation: 0, width: page.width, x: 0, y: 0 };
  const assetId = libraryId ? `image:${libraryId}` : `upload:${hashString(source)}`;
  const element = newExpressionElement(current?.id ?? `${pageId}:media-image`, name, 'image', bounds, {
    libraryAssetId: libraryId ?? undefined,
    panX: options.x / 100,
    panY: options.y / 100,
    slot: current ? 'media' : 'background-image',
    styled: ['asset'],
    zoom: options.scale / 100,
  });
  const image: CanvasElement = {
    ...element,
    assetId,
    imageTreatment: {
      blur: 0, crop: { height: 1, width: 1, x: 0, y: 0 }, dither: 0, focalPoint: { x: 0.5, y: 0.5 }, grain: 0, halation: 0, objectFit: 'cover', posterize: 0, saturation: 1,
    },
    style: { ...element.style, opacity: Math.max(0, Math.min(1, options.opacity / 100)) },
  };
  const asset = expressionAsset(assetId, name, source);
  if (current) {
    // Remove first: removal prunes unreferenced assets, including a not-yet-placed one.
    const index = document.pages[pageId]!.elementIds.indexOf(current.id);
    return insertElements(withAssets(removeElements(document, [current.id]), [asset]), pageId, [image], index);
  }
  return insertElements(withAssets(document, [asset]), pageId, [image], 1);
}

// ---------------------------------------------------------------------------
// Version 1 migrations

type LegacyOpenGraph = ReturnType<typeof parseOpenGraphWorkspaceSource>;

function migrateHeadline(document: CanvasDocument, pageId: string, identity: BrandIdentity, legacy: { fontRole: string; fontWeight: number; title: string }): CanvasDocument {
  const headline = slotElement(document, pageId, 'headline') ?? slotElement(document, pageId, 'title');
  if (!headline) return document;
  const next = patchElement(document, headline.id, { content: legacy.title });
  return setTextRole(next, next.elements[headline.id]!, identity, legacy.fontRole as ExpressionFontRole, legacy.fontWeight);
}

function migrateOpenGraphLogo(document: CanvasDocument, pageId: string, identity: BrandIdentity, logo: NonNullable<LegacyOpenGraph['logo']>): CanvasDocument {
  const element = slotElement(document, pageId, 'logo');
  if (!element) return document;
  const scale = logo.scale / 100;
  const size = 52 * scale;
  const placed = patchElement(document, element.id, {
    bounds: { height: size, width: size, x: 72 + logo.x + 26 * (1 - scale), y: 64 + logo.y + 26 * (1 - scale) },
    data: { appearance: { ...logo.appearance }, tone: 'ink' },
  });
  const libraryPath = brandAssetPath(identity, logo.assetId);
  if (!logo.asset && !libraryPath) return placed;
  const assetId = logo.asset ? `upload:${hashString(logo.asset.url)}` : `logo:${logo.assetId}`;
  const asset = expressionAsset(assetId, logo.asset?.name ?? logo.assetId, logo.asset?.url ?? libraryPath!);
  return patchElement(withAssets(placed, [asset]), element.id, {
    assetId,
    data: { libraryAssetId: logo.asset ? undefined : logo.assetId, styled: ['asset'] },
  });
}

function migrateOpenGraphMedia(document: CanvasDocument, pageId: string, identity: BrandIdentity, background: NonNullable<LegacyOpenGraph['background']>): CanvasDocument {
  if (!background.asset && background.assetId === 'none') return document;
  const library = [...identity.assets, ...identity.proofAssets].find(({ id }) => id === background.assetId);
  const source = background.asset?.url ?? library?.path;
  if (!source) return document;
  const name = background.asset?.name ?? library?.label ?? 'Supporting image';
  return replaceMedia(document, pageId, source, name, background.asset ? null : library?.id ?? null, background);
}

function migrateOpenGraph(source: string, toolId: string, identity: BrandIdentity): CanvasDocument {
  const legacy = parseOpenGraphWorkspaceSource(source, toolId, {
    allowedFontRoles: identity.typography.map(({ role }) => role),
    background: { assetId: 'none', opacity: 100, scale: 100, x: 0, y: 0 },
    fontRole: 'Display',
    fontWeight: expressionFont(identity, 'Display').weight,
    logo: { appearance: DEFAULT_LOGO_APPEARANCE, assetId: 'mark-dark', scale: 100, x: 0, y: 0 },
    surface: 'light',
    title: identity.tagline,
  });
  let document = createExpressionDocument('opengraph', identity, { layout: 'split', surface: legacy.surface === 'dark' ? 'ink' : 'paper', toolId });
  const pageId = document.pageIds[0]!;
  document = migrateHeadline(document, pageId, identity, legacy);
  const headline = slotElement(document, pageId, 'headline')!;
  if (legacy.customFont) document = applyUploadedFont(document, headline, legacy.customFont);
  if (legacy.logo) document = migrateOpenGraphLogo(document, pageId, identity, legacy.logo);
  if (legacy.background) document = migrateOpenGraphMedia(document, pageId, identity, legacy.background);
  return document;
}

const LANGUAGE_NAMES: Record<string, string> = { bash: 'Bash', python: 'Python', typescript: 'TypeScript' };

function legacyState(source: string): { portable: CanvasDocument | null; state: Record<string, unknown> } {
  const root = parseSourceObject(source);
  const portable = isCanvasDocumentEnvelope(root) ? parseCanvasDocument(source) : null;
  const studio = portable?.metadata.studio as Record<string, unknown> | undefined;
  const state = portable ? studio?.state : root;
  return { portable, state: state && typeof state === 'object' && !Array.isArray(state) ? state as Record<string, unknown> : {} };
}

function migrateTypography(document: CanvasDocument, element: CanvasElement | null, identity: BrandIdentity, value: Record<string, unknown> | null, fallbackRole: string, fallbackWeight: number): CanvasDocument {
  if (!element || !value) return document;
  const role = fontRoleOrThrow(identity, sourceString(value, 'role', fallbackRole));
  return setTextRole(document, document.elements[element.id]!, identity, role, sourceNumber(value, 'weight', fallbackWeight));
}

function migrateTerminalBackground(document: CanvasDocument, pageId: string, identity: BrandIdentity, state: Record<string, unknown>, portable: CanvasDocument | null): CanvasDocument {
  const config = sourceObject(state, 'background');
  const assetId = config ? sourceString(config, 'assetId', 'none') : 'none';
  const library = [...identity.assets, ...identity.proofAssets].find(({ id }) => id === assetId);
  const embedded = portable ? canvasElementAssetSource(portable, 'terminal-background') : null;
  const source = embedded ?? library?.path;
  if (!source) return document;
  const page = document.pages[pageId]!;
  return replaceMedia(document, pageId, source, library?.label ?? 'Terminal background', embedded ? null : library?.id ?? null, {
    bounds: { height: page.height, rotation: 0, width: page.width, x: 0, y: 0 },
    opacity: config ? sourceNumber(config, 'opacity', 14) : 14,
    scale: 100,
    x: 0,
    y: 0,
  });
}

function migrateTerminal(source: string, toolId: string, identity: BrandIdentity): CanvasDocument {
  const { portable, state } = legacyState(source);
  const language = sourceString(state, 'language', 'typescript');
  if (!['bash', 'python', 'typescript'].includes(language)) throw new TypeError('language must be typescript, python, or bash.');
  let document = createExpressionDocument('terminal', identity, { layout: 'card', surface: '#0D1117', toolId });
  const pageId = document.pageIds[0]!;
  const title = slotElement(document, pageId, 'title');
  const codeElement = slotElement(document, pageId, 'code')!;
  if (title) {
    const content = sourceString(state, 'title', identity.voice.phrases[0] ?? identity.tagline);
    document = patchElement(document, title.id, { content, data: { fill: '#E6EDF3', styled: styled(title, ['fill']) } });
  }
  document = migrateTypography(document, title, identity, sourceObject(state, 'titleTypography'), 'Display', 500);
  document = patchElement(document, codeElement.id, {
    data: {
      activeTab: 'tab-1',
      tabs: [{ code: sourceString(state, 'code', ''), highlight: [], id: 'tab-1', language, name: LANGUAGE_NAMES[language] ?? language }],
      theme: 'github-dark',
    },
  });
  document = migrateTypography(document, codeElement, identity, sourceObject(state, 'codeTypography'), 'Code', 450);
  return migrateTerminalBackground(document, pageId, identity, state, portable);
}

function templateFallback(identity: BrandIdentity, kind: ExpressionToolKind) {
  const partner = templatePartnerOptions(identity)[0]!;
  const font = defaultTemplatePartnerFont(identity, partner.id, BUILT_IN_BRAND_IDENTITIES);
  return {
    allowedFontRoles: identity.typography.map(({ role }) => role),
    background: { asset: null, libraryAssetId: '', opacity: 28, scale: 100, x: 0, y: 0 },
    body: kind === 'slides' ? 'Foundation\nExpression\nApplication\nDelivery' : identity.description,
    brandLayer: { scale: 1, x: 0, y: 0 },
    brandLogo: { scale: 100, x: 0, y: 0 },
    contentLayer: { scale: 1, x: 0, y: 0 },
    fontRole: 'Display' as BrandTypography['role'],
    fontWeight: expressionFont(identity, 'Display').weight,
    footerLayer: { scale: 1, x: 0, y: 0 },
    layerOrder: ['brand', 'content', 'footer'] as const,
    partner: {
      asset: null, fontAsset: null, fontId: font.id, fontWeight: font.weight, gap: 18, id: partner.id, name: partner.label, opacity: 1, scale: 100, treatment: 'logo' as const, x: 0, y: 0,
    },
    slideLayout: 'title' as const,
    texture: 'white' as const,
    textureOpacity: 100,
    title: identity.tagline,
  };
}

function shiftSlots(document: CanvasDocument, pageId: string, slots: (slot: string) => boolean, transform: { scale: number; x: number; y: number }): CanvasDocument {
  if (transform.scale === 1 && transform.x === 0 && transform.y === 0) return document;
  let next = document;
  for (const element of pageElements(document, pageId)) {
    const slot = elementSlot(element);
    if (!slot || !slots(slot)) continue;
    const { height, width, x, y } = element.bounds;
    next = patchElement(next, element.id, {
      bounds: {
        height: height * transform.scale,
        width: width * transform.scale,
        x: x + transform.x + width * (1 - transform.scale) / 2,
        y: y + transform.y + height * (1 - transform.scale) / 2,
      },
    });
  }
  return next;
}

function legacyPartnerFont(identity: BrandIdentity, legacy: TemplateWorkspaceSource): { asset: CanvasAsset | null; family: string | undefined; letterSpacing: number } {
  if (legacy.partner.fontAsset) {
    const asset = expressionAsset(`font:upload-${hashString(legacy.partner.fontAsset.url)}`, legacy.partner.fontAsset.name, legacy.partner.fontAsset.url, 'font');
    return { asset, family: uploadedFontFamily(asset.id), letterSpacing: 0 };
  }
  const font = templatePartnerFontOptions(identity, legacy.partner.id, BUILT_IN_BRAND_IDENTITIES).find(({ id }) => id === legacy.partner.fontId);
  if (!font) return { asset: null, family: undefined, letterSpacing: 0 };
  return { asset: expressionAsset(`font:${font.id.replace(':', '-')}`, font.label, font.path, 'font'), family: font.family, letterSpacing: font.letterSpacing / 64 };
}

function legacyPartner(identity: BrandIdentity, legacy: TemplateWorkspaceSource): { asset: CanvasAsset | null; fontAsset: CanvasAsset | null; partner: LockupPartner } {
  const option = expressionPartnerOptions(identity).find(({ id }) => id === legacy.partner.id)
    ?? templatePartnerOptions(identity).map((asset) => ({ aspect: 2.6, id: asset.id, label: asset.label, path: asset.path })).find(({ id }) => id === legacy.partner.id);
  const font = legacyPartnerFont(identity, legacy);
  if (legacy.partner.treatment === 'text') {
    return {
      asset: null,
      fontAsset: font.asset,
      partner: { aspect: 3, fontAssetId: font.asset?.id, fontFamily: font.family, fontWeight: legacy.partner.fontWeight, id: 'partner-1', kind: 'text', label: legacy.partner.name, letterSpacing: font.letterSpacing, sourceId: option?.id },
    };
  }
  const source = legacy.partner.asset?.url ?? option?.path;
  const assetId = legacy.partner.asset ? `upload:${hashString(legacy.partner.asset.url)}` : `partner:${option?.id ?? 'unknown'}`;
  const label = option?.label ?? legacy.partner.name;
  return {
    asset: source ? expressionAsset(assetId, legacy.partner.asset?.name ?? label, source) : null,
    fontAsset: font.asset,
    partner: { aspect: option?.aspect ?? 2.6, assetId: source ? assetId : undefined, id: 'partner-1', kind: 'logo', label, sourceId: option?.id },
  };
}

function migrateTexture(document: CanvasDocument, pageId: string, legacy: TemplateWorkspaceSource): CanvasDocument {
  if (legacy.texture !== 'grid' && legacy.texture !== 'noise') return document;
  const page = document.pages[pageId]!;
  const texture = newExpressionElement(`${pageId}:texture`, legacy.texture === 'grid' ? 'Grid texture' : 'Noise texture', 'texture', { height: page.height, rotation: 0, width: page.width, x: 0, y: 0 }, {
    fill: 'progress', slot: 'texture', spacing: 40, texture: legacy.texture,
  });
  const opacity = legacy.textureOpacity / 100 * (legacy.texture === 'grid' ? 0.22 : 1);
  return insertElements(document, pageId, [{ ...texture, style: { ...texture.style, opacity } }], 1);
}

function migrateTemplateBackground(document: CanvasDocument, pageId: string, identity: BrandIdentity, legacy: TemplateWorkspaceSource): CanvasDocument {
  const library = identity.assets.find(({ id }) => id === legacy.background.libraryAssetId);
  const source = legacy.background.asset?.url ?? library?.path;
  if (!source) return document;
  const page = document.pages[pageId]!;
  const name = legacy.background.asset?.name ?? library?.label ?? 'Background image';
  return replaceMedia(document, pageId, source, name, legacy.background.asset ? null : library?.id ?? null, {
    bounds: { height: page.height, rotation: 0, width: page.width, x: 0, y: 0 },
    opacity: legacy.background.opacity,
    scale: legacy.background.scale,
    x: legacy.background.x,
    y: legacy.background.y,
  });
}

function migrateTemplateLogo(document: CanvasDocument, pageId: string, identity: BrandIdentity, legacy: TemplateWorkspaceSource): CanvasDocument {
  const logo = slotElement(document, pageId, 'logo');
  if (!logo) return document;
  let next = document;
  if (legacy.brandLogoSource) {
    const assetId = `upload:${hashString(legacy.brandLogoSource)}`;
    next = patchElement(withAssets(next, [expressionAsset(assetId, `${identity.name} logo`, legacy.brandLogoSource)]), logo.id, { assetId, data: { styled: ['asset'] } });
  }
  return shiftSlots(next, pageId, (slot) => slot === 'logo', { scale: legacy.brandLogo.scale / 100, x: legacy.brandLogo.x, y: legacy.brandLogo.y });
}

function migrateLockup(document: CanvasDocument, pageId: string, identity: BrandIdentity, legacy: TemplateWorkspaceSource): CanvasDocument {
  const lockup = pageElements(document, pageId).find((element) => elementComponent(element) === 'lockup');
  if (!lockup) return document;
  const brand = legacyPartnerBrand(document, lockup, legacy, identity);
  const migrated = legacyPartner(identity, legacy);
  let next = withAssets(document, [brand.asset, migrated.asset, migrated.fontAsset].filter((asset): asset is CanvasAsset => asset !== null));
  next = patchElement(next, lockup.id, {
    data: { gap: Math.max(8, Math.round(legacy.partner.gap * 1.4)), partners: [brand.partner, migrated.partner] },
  });
  const headline = slotElement(next, pageId, 'headline');
  if (!headline || !migrated.fontAsset) return next;
  return patchElement(next, headline.id, {
    data: { partnerFontAssetId: migrated.fontAsset.id, partnerFontFamily: migrated.partner.fontFamily ?? fontFamilyOf(identity, legacy), partnerFontWeight: legacy.partner.fontWeight },
  });
}

const BRAND_SLOTS = new Set(['brand-name', 'lockup', 'logo']);
const FOOTER_SLOTS = new Set(['page-number', 'website']);
const BACKDROP_SLOTS = new Set(['background', 'background-image', 'media', 'texture']);

function migrateLayerTransforms(document: CanvasDocument, pageId: string, legacy: TemplateWorkspaceSource): CanvasDocument {
  let next = shiftSlots(document, pageId, (slot) => BRAND_SLOTS.has(slot), legacy.brandLayer);
  next = shiftSlots(next, pageId, (slot) => !BRAND_SLOTS.has(slot) && !FOOTER_SLOTS.has(slot) && !BACKDROP_SLOTS.has(slot), legacy.contentLayer);
  return shiftSlots(next, pageId, (slot) => FOOTER_SLOTS.has(slot), legacy.footerLayer);
}

function migrateTemplate(source: string, kind: 'blog' | 'partnership' | 'slides', toolId: string, identity: BrandIdentity): CanvasDocument {
  const legacy = parseTemplateWorkspaceSource(source, toolId, templateFallback(identity, kind));
  const firstLine = legacy.body.split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  const deck = kind === 'slides'
    ? [{ content: { attribution: firstLine, headline: legacy.title, items: legacy.body, website: legacy.slideLayout === 'closing' ? legacy.body : identity.website }, layout: legacy.slideLayout }]
    : undefined;
  let document = createExpressionDocument(kind, identity, {
    deck,
    layout: kind === 'blog' ? 'editorial' : kind === 'partnership' ? 'lockup' : undefined,
    surface: legacy.texture === 'dark' ? 'ink' : 'paper',
    toolId,
  });
  const pageId = document.pageIds[0]!;
  document = migrateHeadline(document, pageId, identity, legacy);
  document = migrateTexture(document, pageId, legacy);
  document = migrateTemplateBackground(document, pageId, identity, legacy);
  document = migrateTemplateLogo(document, pageId, identity, legacy);
  if (kind === 'partnership') document = migrateLockup(document, pageId, identity, legacy);
  return migrateLayerTransforms(document, pageId, legacy);
}

function fontFamilyOf(identity: BrandIdentity, legacy: TemplateWorkspaceSource): string {
  return templatePartnerFontOptions(identity, legacy.partner.id, BUILT_IN_BRAND_IDENTITIES).find(({ id }) => id === legacy.partner.fontId)?.family ?? 'Inter';
}

function legacyPartnerBrand(document: CanvasDocument, lockup: CanvasElement, legacy: TemplateWorkspaceSource, identity: BrandIdentity): { asset: CanvasAsset; partner: LockupPartner } {
  const partners = Array.isArray(lockup.data.partners) ? lockup.data.partners : [];
  const brand = partners[0] as LockupPartner | undefined;
  if (legacy.brandLogoSource) {
    const assetId = `upload:${hashString(legacy.brandLogoSource)}`;
    return { asset: expressionAsset(assetId, `${identity.name} logo`, legacy.brandLogoSource), partner: { aspect: brand?.aspect ?? 1, assetId, id: 'brand', kind: 'logo', label: identity.name } };
  }
  const assetId = brand?.assetId ?? '';
  const asset = document.assets[assetId] ?? expressionAsset('logo:monogram', identity.name, '');
  return { asset, partner: brand ?? { aspect: partnerAspectGuess(null), assetId, id: 'brand', kind: 'logo', label: identity.name } };
}

// ---------------------------------------------------------------------------
// Mirrors: flat fields earlier automation reads and writes.

export type ExpressionMirrors = { body?: string; code?: string; language?: string; title: string };

function primaryHeadline(document: CanvasDocument): CanvasElement | null {
  const pageId = document.pageIds[0];
  if (!pageId) return null;
  return slotElement(document, pageId, 'title') ?? slotElement(document, pageId, 'headline');
}

function primaryCode(document: CanvasDocument): CanvasElement | null {
  for (const pageId of document.pageIds) {
    const code = pageElements(document, pageId).find((element) => elementComponent(element) === 'code');
    if (code) return code;
  }
  return null;
}

export function slideItems(document: CanvasDocument, pageId: string): string[] {
  return pageElements(document, pageId)
    .flatMap((element) => {
      const slot = elementSlot(element);
      return slot && /^item-\d+$/.test(slot) ? [[Number(slot.slice(5)), element.content ?? ''] as const] : [];
    })
    .sort(([first], [second]) => first - second)
    .map(([, content]) => content);
}

export function expressionMirrors(document: CanvasDocument): ExpressionMirrors {
  const state = expressionState(document);
  const headline = primaryHeadline(document);
  const code = primaryCode(document);
  const tab = code ? activeCodeTab(code) : null;
  const firstPage = document.pageIds[0];
  const items = firstPage ? slideItems(document, firstPage) : [];
  const dek = firstPage ? slotElement(document, firstPage, 'dek') : null;
  return {
    body: state.kind === 'slides' ? items.join('\n') || dek?.content || '' : dek?.content,
    code: tab?.code,
    language: tab?.language,
    title: headline?.content ?? '',
  };
}

export function withExpressionMirrors(document: CanvasDocument): CanvasDocument {
  const mirrors = expressionMirrors(document);
  const state = expressionState(document);
  if (state.title === mirrors.title && state.body === mirrors.body && state.code === mirrors.code && state.language === mirrors.language) return document;
  return withExpressionState(document, (current) => ({ ...current, ...mirrors }));
}

export function setCodeTab(document: CanvasDocument, elementId: string, tabId: string, patch: Partial<CodeTab>): CanvasDocument {
  const element = document.elements[elementId];
  if (!element) return document;
  const tabs = readCodeTabs(element).map((tab) => tab.id === tabId ? { ...tab, ...patch } : tab);
  return patchElement(document, elementId, { data: { tabs } });
}

export function setSlideItems(document: CanvasDocument, pageId: string, items: readonly string[], identity: BrandIdentity): CanvasDocument {
  const settings = expressionState(document).pages[pageId];
  if (!settings) return document;
  const itemIds = pageElements(document, pageId).filter((element) => /^item-\d+$/.test(elementSlot(element) ?? '')).map(({ id }) => id);
  const cleared = removeElements(document, itemIds);
  const stashed = withExpressionState(cleared, (state) => ({
    ...state,
    pages: { ...state.pages, [pageId]: { ...settings, stash: { ...settings.stash, items: items.join('\n') } } },
  }));
  return applyExpressionLayout(stashed, pageId, settings.layout, identity);
}

function applyMirrors(document: CanvasDocument, identity: BrandIdentity): CanvasDocument {
  const state = expressionState(document);
  const mirrors = expressionMirrors(document);
  let next = document;
  const headline = primaryHeadline(next);
  if (headline && state.title !== '' && state.title !== mirrors.title) next = patchElement(next, headline.id, { content: state.title });
  const code = primaryCode(next);
  const tab = code ? activeCodeTab(code) : null;
  if (code && tab && state.code !== undefined && state.code !== mirrors.code) next = setCodeTab(next, code.id, tab.id, { code: state.code });
  if (code && tab && state.language !== undefined && state.language !== mirrors.language) next = setCodeTab(next, code.id, tab.id, { language: state.language });
  const firstPage = next.pageIds[0];
  if (firstPage && state.body !== undefined && state.body !== mirrors.body) {
    if (state.kind === 'slides') next = setSlideItems(next, firstPage, state.body.split('\n').map((item) => item.trim()).filter(Boolean), identity);
    else {
      const dek = slotElement(next, firstPage, 'dek');
      if (dek) next = patchElement(next, dek.id, { content: state.body });
    }
  }
  return next;
}

// ---------------------------------------------------------------------------
// Library asset refresh

function currentLibrarySource(asset: CanvasAsset, identity: BrandIdentity): string | null {
  const [prefix, id] = [asset.id.slice(0, asset.id.indexOf(':')), asset.id.slice(asset.id.indexOf(':') + 1)];
  if (!id) return null;
  if (prefix === 'logo' || prefix === 'image') return [...identity.assets, ...identity.proofAssets].find((item) => item.id === id)?.path ?? null;
  if (prefix === 'font') return brandFontAssets(identity).find((font) => font.id === id)?.path ?? null;
  if (prefix === 'partner') return expressionPartnerOptions(identity).find((option) => option.id === id)?.path ?? null;
  if (prefix === 'shader') return `/shader-previews/${id}.webp`;
  return null;
}

/** Point embedded library assets back at the identity's files; uploads stay embedded. */
export function refreshLibraryAssets(document: CanvasDocument, identity: BrandIdentity): CanvasDocument {
  let changed = false;
  const assets = Object.fromEntries(Object.entries(document.assets).map(([id, asset]) => {
    if (!asset.source.startsWith('data:')) return [id, asset];
    const source = currentLibrarySource(asset, identity);
    if (!source) return [id, asset];
    changed = true;
    return [id, { ...asset, byteLength: 0, source }];
  }));
  return changed ? { ...document, assets } : document;
}

// ---------------------------------------------------------------------------
// Entry point

export function parseExpressionSource(
  source: string,
  kind: ExpressionToolKind,
  toolId: string,
  identity: BrandIdentity
): CanvasDocument {
  const root = parseSourceObject(source);
  if (isCanvasDocumentEnvelope(root)) {
    const document = parseCanvasDocument(source);
    const current = readExpressionState(document);
    if (current) {
      if (current.kind !== kind) throw new TypeError(`This source is a ${current.kind} document, not ${kind}.`);
      const sourceToolId = expressionToolId(document);
      if (sourceToolId && sourceToolId !== toolId) throw new TypeError(`This canvas document is not a ${toolId} document.`);
      return normalizeExpressionDocument(document, identity);
    }
    const studio = document.metadata.studio as Record<string, unknown> | undefined;
    if (studio && typeof studio.sourceVersion === 'number' && studio.sourceVersion > EXPRESSION_SOURCE_VERSION) {
      throw new TypeError(`Expression source version ${studio.sourceVersion} is newer than this Studio supports.`);
    }
  }
  return migrateExpressionSource(source, kind, toolId, identity);
}

export function migrateExpressionSource(source: string, kind: ExpressionToolKind, toolId: string, identity: BrandIdentity): CanvasDocument {
  if (kind === 'opengraph') return migrateOpenGraph(source, toolId, identity);
  if (kind === 'terminal') return migrateTerminal(source, toolId, identity);
  return migrateTemplate(source, kind, toolId, identity);
}

export function normalizeExpressionDocument(document: CanvasDocument, identity: BrandIdentity): CanvasDocument {
  const state = expressionState(document);
  if (!isExpressionToolKind(state.kind) || document.pageIds.length === 0) throw new TypeError('Expression documents need at least one page.');
  const recipe = expressionRecipe(identity);
  const pages = Object.fromEntries(document.pageIds.map((pageId) => [
    pageId,
    state.pages[pageId] ?? { layout: state.kind === 'slides' ? 'title' : recipe.layouts[state.kind as Exclude<ExpressionToolKind, 'slides'>], surface: 'paper' },
  ]));
  for (const element of Object.values(document.elements)) {
    if (element.kind === 'text' && !element.textStyle) throw new TypeError(`Text layer ${element.id} needs a textStyle.`);
    if (elementComponent(element) === 'code' && readCodeTabs(element).length === 0) throw new TypeError(`Code layer ${element.id} needs at least one tab.`);
    if (dataString(element, 'slot') === '' && element.data.slot !== undefined) throw new TypeError(`Layer ${element.id} has an empty slot.`);
  }
  const normalized = refreshLibraryAssets(withExpressionState(document, (current) => ({ ...current, pages })), identity);
  return applyMirrors(touchDocument(normalized, { revision: document.revision }), identity);
}
