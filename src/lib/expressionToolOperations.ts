import { BUILT_IN_BRAND_IDENTITIES, type BrandIdentity } from './brandIdentity';
import type { CanvasDocument, CanvasElement } from './canvasDocument';
import type { ExpressionDeviceId } from './expressionDevices';
import {
  activeCodeTab,
  expressionAsset,
  insertElements,
  newExpressionElement,
  pageSettings,
  patchElement,
  pruneAssets,
  readCodeTabs,
  readLockupPartners,
  removeElements,
  slotElement,
  withAssets,
  type CodeTab,
  type LockupPartner,
} from './expressionModel';
import { updateExpressionLayer } from './expressionOperations';
import { hashString, setCodeTab, uploadedFontFamily } from './expressionSource';
import { expressionFont, expressionPartnerOptions, expressionRecipe, LEGACY_CODE_SAMPLES, setPageSurface } from './expressionTemplates';
import { defaultTemplatePartnerFont, templatePartnerFontOptions } from './templateAssets';

/** Tool-specific edits behind the content controls and Browser API. */

export type MediaSource =
  | { device: ExpressionDeviceId; type: 'device' }
  | { assetId: string; type: 'library' }
  | { name: string; type: 'upload'; url: string };

const IMAGE_TREATMENT = {
  blur: 0, crop: { height: 1, width: 1, x: 0, y: 0 }, dither: 0, focalPoint: { x: 0.5, y: 0.5 }, grain: 0, halation: 0, objectFit: 'cover' as const, posterize: 0, saturation: 1,
};

function mediaElement(document: CanvasDocument, pageId: string, slot: string, bounds: CanvasElement['bounds'], source: MediaSource, identity: BrandIdentity): { assets: ReturnType<typeof expressionAsset>[]; element: CanvasElement } {
  const id = `${pageId}:${slot}-${source.type === 'device' ? 'device' : 'image'}-${hashString(JSON.stringify(source)).slice(0, 5)}`;
  if (source.type === 'device') {
    const font = expressionFont(identity, 'Body');
    const element = newExpressionElement(id, 'Brand device', 'component', bounds, { component: 'device', device: source.device, slot, styled: ['asset'] });
    return {
      assets: [font.asset],
      element: { ...element, textStyle: { align: 'left', casing: 'none', color: '#FFFFFF', fontFamily: font.family, fontId: font.asset.id, fontRole: 'Body', fontSize: 16, fontWeight: 450, letterSpacing: 0, lineHeight: 1.4, tokenBound: true } },
    };
  }
  const library = source.type === 'library' ? [...identity.assets, ...identity.proofAssets].find(({ id: assetId }) => assetId === source.assetId) : null;
  if (source.type === 'library' && !library) throw new TypeError(`Unknown library asset ${source.assetId}.`);
  const assetId = source.type === 'upload' ? `upload:${hashString(source.url)}` : `image:${library!.id}`;
  const asset = expressionAsset(assetId, source.type === 'upload' ? source.name : library!.label, source.type === 'upload' ? source.url : library!.path);
  const element = newExpressionElement(id, source.type === 'upload' ? source.name : library!.label, 'image', bounds, {
    libraryAssetId: library?.id,
    slot,
    styled: ['asset'],
    treatment: identity.style.imageTreatment,
  });
  return { assets: [asset], element: { ...element, assetId, imageTreatment: IMAGE_TREATMENT } };
}

/** Swap the media slot between the brand device, a library image, and an upload. */
export function setMediaSource(document: CanvasDocument, pageId: string, source: MediaSource, identity: BrandIdentity): CanvasDocument {
  const current = slotElement(document, pageId, 'media');
  if (!current) return document;
  const { assets, element } = mediaElement(document, pageId, 'media', current.bounds, source, identity);
  const index = document.pages[pageId]!.elementIds.indexOf(current.id);
  const next = { ...element, hidden: current.hidden, locked: current.locked, style: { ...element.style, opacity: current.style.opacity } };
  return insertElements(withAssets(removeElements(document, [current.id]), assets), pageId, [next], index);
}

export function mediaSourceValue(document: CanvasDocument, pageId: string): string {
  const media = slotElement(document, pageId, 'media');
  if (!media) return 'none';
  if (media.kind === 'component') return 'none';
  const library = media.data.libraryAssetId;
  return typeof library === 'string' && library ? library : 'upload';
}

/** Full-bleed background picture under the content (blog, slides, terminal). */
export function setBackgroundImage(document: CanvasDocument, pageId: string, source: MediaSource | null, identity: BrandIdentity, opacity = 0.28): CanvasDocument {
  const current = slotElement(document, pageId, 'background-image');
  const cleared = current ? removeElements(document, [current.id]) : document;
  if (!source) return cleared;
  const page = cleared.pages[pageId]!;
  const { assets, element } = mediaElement(cleared, pageId, 'background-image', { height: page.height, rotation: 0, width: page.width, x: 0, y: 0 }, source, identity);
  const next = { ...element, name: 'Background image', style: { ...element.style, opacity: current?.style.opacity ?? opacity } };
  const backgroundIndex = slotElement(cleared, pageId, 'background') ? 1 : 0;
  return insertElements(withAssets(cleared, assets), pageId, [next], backgroundIndex);
}

export type LegacySurface = 'dark' | 'grid' | 'noise' | 'white';

/** The legacy four-way surface control: base white, base dark, grid, or noise texture. */
export function setLegacySurface(document: CanvasDocument, pageId: string, surface: LegacySurface, identity: BrandIdentity): CanvasDocument {
  let next = setPageSurface(document, pageId, surface === 'dark' ? 'ink' : 'paper', identity);
  const texture = slotElement(next, pageId, 'texture');
  if (surface !== 'grid' && surface !== 'noise') return texture ? removeElements(next, [texture.id]) : next;
  if (texture) return patchElement(next, texture.id, { data: { texture: surface } });
  const page = next.pages[pageId]!;
  const element = newExpressionElement(`${pageId}:texture`, surface === 'grid' ? 'Grid texture' : 'Noise texture', 'texture', { height: page.height, rotation: 0, width: page.width, x: 0, y: 0 }, {
    fill: 'progress', slot: 'texture', spacing: 40, texture: surface,
  });
  const index = slotElement(next, pageId, 'background') ? 1 : 0;
  next = insertElements(next, pageId, [{ ...element, style: { ...element.style, opacity: surface === 'grid' ? 0.22 : 1 } }], index);
  return next;
}

export function legacySurfaceValue(document: CanvasDocument, pageId: string): LegacySurface {
  const texture = slotElement(document, pageId, 'texture');
  if (texture?.data.texture === 'grid' || texture?.data.texture === 'noise') return texture.data.texture;
  const surface = pageSettings(document, pageId).surface;
  return surface === 'ink' || surface === 'error' ? 'dark' : 'white';
}

// Terminal ------------------------------------------------------------------

export function addCodeTab(document: CanvasDocument, elementId: string, tab: Partial<CodeTab> = {}): { document: CanvasDocument; tabId: string } {
  const element = document.elements[elementId];
  if (!element) throw new RangeError(`Unknown layer ${elementId}.`);
  const tabs = readCodeTabs(element);
  let index = tabs.length + 1;
  while (tabs.some(({ id }) => id === `tab-${index}`)) index += 1;
  const id = `tab-${index}`;
  const language = tab.language ?? 'typescript';
  const next: CodeTab = {
    code: tab.code ?? LEGACY_CODE_SAMPLES[language as keyof typeof LEGACY_CODE_SAMPLES] ?? '',
    highlight: tab.highlight ?? [],
    id,
    language,
    name: tab.name ?? `file-${index}.ts`,
  };
  return { document: patchElement(document, elementId, { data: { activeTab: id, tabs: [...tabs, next] } }), tabId: id };
}

export function removeCodeTab(document: CanvasDocument, elementId: string, tabId: string): CanvasDocument {
  const element = document.elements[elementId];
  if (!element) return document;
  const tabs = readCodeTabs(element);
  if (tabs.length <= 1) return document;
  const remaining = tabs.filter(({ id }) => id !== tabId);
  const active = activeCodeTab(element);
  return patchElement(document, elementId, { data: { activeTab: active?.id === tabId ? remaining[0]!.id : active?.id, tabs: remaining } });
}

/** Switch a tab's language; untouched samples follow the language, edited code stays. */
export function setCodeLanguage(document: CanvasDocument, elementId: string, tabId: string, language: string): CanvasDocument {
  const element = document.elements[elementId];
  const tab = element ? readCodeTabs(element).find(({ id }) => id === tabId) : null;
  if (!element || !tab) return document;
  const samples = Object.values(LEGACY_CODE_SAMPLES) as string[];
  const sample = LEGACY_CODE_SAMPLES[language as keyof typeof LEGACY_CODE_SAMPLES];
  return setCodeTab(document, elementId, tabId, {
    code: sample && samples.includes(tab.code) ? sample : tab.code,
    language,
  });
}

// Partnership ---------------------------------------------------------------

export function partnerFromOption(identity: BrandIdentity, optionId: string, index: number): { asset: ReturnType<typeof expressionAsset>; partner: LockupPartner } {
  const option = expressionPartnerOptions(identity).find(({ id }) => id === optionId);
  if (!option) throw new TypeError(`Unknown partner ${optionId}.`);
  const asset = expressionAsset(`partner:${option.id}`, option.label, option.path);
  return { asset, partner: { aspect: option.aspect, assetId: asset.id, id: `partner-${index}`, kind: 'logo', label: option.label, sourceId: option.id } };
}

function writePartners(document: CanvasDocument, lockupId: string, partners: readonly LockupPartner[]): CanvasDocument {
  return pruneAssets(patchElement(document, lockupId, { data: { partners: partners.map((partner) => ({ ...partner })) } }));
}

export function setLockupPartner(document: CanvasDocument, lockupId: string, partnerId: string, patch: Partial<LockupPartner>): CanvasDocument {
  const element = document.elements[lockupId];
  if (!element) return document;
  return writePartners(document, lockupId, readLockupPartners(element).map((partner) => partner.id === partnerId ? { ...partner, ...patch } : partner));
}

/** Choose a partner from the list; a matching "Brand × Partner" headline follows. */
export function choosePartner(document: CanvasDocument, lockupId: string, partnerId: string, optionId: string, identity: BrandIdentity): CanvasDocument {
  const element = document.elements[lockupId];
  if (!element) return document;
  const partners = readLockupPartners(element);
  const previous = partners.find(({ id }) => id === partnerId);
  const { asset, partner } = partnerFromOption(identity, optionId, 1);
  let next = withAssets(document, [asset]);
  next = writePartners(next, lockupId, partners.map((item) => item.id === partnerId ? { ...partner, id: partnerId } : item));
  const pageId = next.pageIds.find((id) => next.pages[id]!.elementIds.includes(lockupId));
  const headline = pageId ? slotElement(next, pageId, 'headline') : null;
  if (headline && previous && headline.content === `${identity.name} × ${previous.label}`) {
    next = patchElement(next, headline.id, { content: `${identity.name} × ${partner.label}` });
  }
  if (headline && partnerId === partners[1]?.id) {
    const font = defaultTemplatePartnerFont(identity, optionId, BUILT_IN_BRAND_IDENTITIES);
    next = setHeadlinePartnerFont(next, headline.id, { family: font.family, id: font.id, path: font.path, weight: font.weight });
  }
  return next;
}

export function addLockupPartner(document: CanvasDocument, lockupId: string, identity: BrandIdentity, input: { kind?: 'logo' | 'text'; label?: string; partnerId?: string } = {}): { document: CanvasDocument; id: string } {
  const element = document.elements[lockupId];
  if (!element) throw new RangeError('This page has no partner lockup.');
  const partners = readLockupPartners(element);
  let index = partners.length;
  while (partners.some(({ id }) => id === `partner-${index}`)) index += 1;
  const id = `partner-${index}`;
  if (input.kind === 'text') {
    const font = expressionFont(identity, 'Display');
    const next = withAssets(document, [font.asset]);
    return { document: writePartners(next, lockupId, [...partners, { aspect: 3, fontAssetId: font.asset.id, fontFamily: font.family, fontWeight: font.weight, id, kind: 'text', label: input.label ?? 'Partner' }]), id };
  }
  const used = new Set(partners.map(({ sourceId }) => sourceId));
  const optionId = input.partnerId ?? expressionPartnerOptions(identity).find((option) => !used.has(option.id))?.id;
  if (!optionId) throw new TypeError('No partner is left to add.');
  const { asset, partner } = partnerFromOption(identity, optionId, index);
  return { document: writePartners(withAssets(document, [asset]), lockupId, [...partners, { ...partner, id }]), id };
}

export function removeLockupPartner(document: CanvasDocument, lockupId: string, partnerId: string): CanvasDocument {
  const element = document.elements[lockupId];
  if (!element || partnerId === 'brand') return document;
  const partners = readLockupPartners(element);
  if (partners.length <= 1) return document;
  return writePartners(document, lockupId, partners.filter(({ id }) => id !== partnerId));
}

export function setHeadlinePartnerFont(
  document: CanvasDocument,
  headlineId: string,
  font: { family: string; id: string; path: string; weight: number } | { family?: undefined; name: string; url: string; weight: number }
): CanvasDocument {
  const asset = 'url' in font
    ? expressionAsset(`font:upload-${hashString(font.url)}`, font.name, font.url, 'font')
    : expressionAsset(`font:${font.id.replace(':', '-')}`, font.family, font.path, 'font');
  const family = 'url' in font ? uploadedFontFamily(asset.id) : font.family;
  return pruneAssets(patchElement(withAssets(document, [asset]), headlineId, {
    data: { partnerFontAssetId: asset.id, partnerFontFamily: family, partnerFontWeight: font.weight },
  }));
}

export function partnerFontOptions(identity: BrandIdentity, partnerId: string) {
  return templatePartnerFontOptions(identity, partnerId, BUILT_IN_BRAND_IDENTITIES);
}

export function defaultMediaDevice(identity: BrandIdentity): ExpressionDeviceId {
  return expressionRecipe(identity).device;
}

const LOCKUP_RULES = {
  justify: ['start', 'center', 'end'],
  separator: ['×', '+', '/', '|', 'none'],
  sizing: ['optical', 'height', 'width'],
  tone: ['original', 'mono'],
  verticalAlign: ['center', 'top', 'bottom'],
} as const;

/** Validate and apply lockup alignment rules from the inspector or Browser API. */
export function updateLockup(document: CanvasDocument, lockupId: string, input: Record<string, unknown>, identity: BrandIdentity): CanvasDocument {
  const data: Record<string, string | number> = {};
  for (const [key, allowed] of Object.entries(LOCKUP_RULES)) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw new TypeError(`${key} must be one of ${allowed.join(', ')}.`);
    data[key] = value;
  }
  if (input.gap !== undefined) {
    if (typeof input.gap !== 'number' || !Number.isFinite(input.gap)) throw new TypeError('gap must be a finite number.');
    data.gap = Math.max(0, Math.min(400, input.gap));
  }
  return updateExpressionLayer(document, lockupId, { data }, identity);
}
