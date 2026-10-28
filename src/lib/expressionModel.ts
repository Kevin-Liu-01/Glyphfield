import {
  asCanvasJsonObject,
  createCanvasDocument,
  createCanvasElement,
  inferCanvasAssetMimeType,
  toCanvasJsonObject,
  type CanvasAsset,
  type CanvasAssetKind,
  type CanvasBounds,
  type CanvasDocument,
  type CanvasElement,
  type CanvasElementKind,
  type CanvasJsonObject,
  type CanvasJsonValue,
  type CanvasPage,
} from './canvasDocument';

/**
 * The shared expression document: one CanvasDocument (schema 2) for OpenGraph,
 * Terminal card, Partnership lockup, Blog cover, and Slide templates.
 * Pages are artboards, elements are layers, `data.slot` names the layout role a
 * layer fills, and color fields hold brand roles so identity edits flow through.
 */

export const EXPRESSION_TOOL_KINDS = ['opengraph', 'terminal', 'partnership', 'blog', 'slides'] as const;
export type ExpressionToolKind = (typeof EXPRESSION_TOOL_KINDS)[number];

export const EXPRESSION_SOURCE_VERSION = 2;
const STUDIO_METADATA_KEY = 'studio';

export const EXPRESSION_COLOR_ROLES = ['ink', 'paper', 'muted', 'emphasis', 'success', 'warning', 'progress', 'error'] as const;
export type ExpressionColorRole = (typeof EXPRESSION_COLOR_ROLES)[number];
/** A brand color role or a literal #RRGGBB value. */
export type ExpressionColor = string;

export type ExpressionFontRole = 'Display' | 'Body' | 'Accent' | 'Code';
export const EXPRESSION_FONT_ROLES: readonly ExpressionFontRole[] = ['Display', 'Body', 'Accent', 'Code'];

export type ExpressionFormat = {
  height: number;
  id: string;
  label: string;
  width: number;
};

export const SOCIAL_FORMATS: readonly ExpressionFormat[] = [
  { height: 630, id: 'opengraph', label: 'OpenGraph · 1200 × 630', width: 1200 },
  { height: 900, id: 'wide', label: 'Wide · 1600 × 900', width: 1600 },
  { height: 1080, id: 'square', label: 'Square · 1080 × 1080', width: 1080 },
  { height: 1350, id: 'portrait', label: 'Portrait · 1080 × 1350', width: 1080 },
  { height: 1920, id: 'story', label: 'Story · 1080 × 1920', width: 1080 },
  { height: 627, id: 'linkedin', label: 'LinkedIn · 1200 × 627', width: 1200 },
  { height: 600, id: 'lockup', label: 'Lockup · 1200 × 600', width: 1200 },
];

export const SLIDE_FORMATS: readonly ExpressionFormat[] = [
  { height: 900, id: '16x9', label: '16:9 · 1600 × 900', width: 1600 },
  { height: 1200, id: '4x3', label: '4:3 · 1600 × 1200', width: 1600 },
  { height: 1200, id: 'square', label: 'Square · 1200 × 1200', width: 1200 },
];

export function expressionFormats(kind: ExpressionToolKind): readonly ExpressionFormat[] {
  return kind === 'slides' ? SLIDE_FORMATS : SOCIAL_FORMATS;
}

export function defaultExpressionFormat(kind: ExpressionToolKind): ExpressionFormat {
  if (kind === 'slides') return SLIDE_FORMATS[0]!;
  if (kind === 'partnership') return SOCIAL_FORMATS.find(({ id }) => id === 'lockup')!;
  return SOCIAL_FORMATS[0]!;
}

export function resolveExpressionFormat(kind: ExpressionToolKind, id: string): ExpressionFormat {
  return expressionFormats(kind).find((format) => format.id === id) ?? defaultExpressionFormat(kind);
}

export type ExpressionPageSettings = {
  layout: string;
  /** Text content of slots the current layout does not use, kept for switching back. */
  stash?: Record<string, string>;
  surface: ExpressionColor;
};

export type ExpressionState = {
  /** Mirrors of the primary content, kept for automation that reads flat fields. */
  body?: string;
  code?: string;
  expressionVersion: typeof EXPRESSION_SOURCE_VERSION;
  format: string;
  kind: ExpressionToolKind;
  language?: string;
  pages: Record<string, ExpressionPageSettings>;
  title: string;
};

export type CodeTab = {
  code: string;
  highlight: number[];
  id: string;
  language: string;
  name: string;
};

export type LockupPartner = {
  /** Width / height of the artwork, used for optical balancing without decoding images. */
  aspect: number;
  assetId?: string;
  fontAssetId?: string;
  fontFamily?: string;
  fontWeight?: number;
  id: string;
  kind: 'logo' | 'text';
  label: string;
  letterSpacing?: number;
  /** Library proof-asset or partner identity id, kept so the picker can show it. */
  sourceId?: string;
};

export type ExpressionElementPatch = Omit<Partial<CanvasElement>, 'bounds' | 'data' | 'id' | 'style' | 'textStyle'> & {
  bounds?: Partial<CanvasBounds>;
  data?: Record<string, CanvasJsonValue | undefined>;
  style?: Partial<CanvasElement['style']>;
  textStyle?: Partial<NonNullable<CanvasElement['textStyle']>>;
};

export function isExpressionToolKind(value: unknown): value is ExpressionToolKind {
  return typeof value === 'string' && (EXPRESSION_TOOL_KINDS as readonly string[]).includes(value);
}

export function isColorRole(value: unknown): value is ExpressionColorRole {
  return typeof value === 'string' && (EXPRESSION_COLOR_ROLES as readonly string[]).includes(value);
}

/** Stored colors are hex (3, 4, 6, or 8 digits); anything else is unsafe for markup. */
const SAFE_EXPRESSION_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}(?:[0-9a-f]{2})?)$/i;

export function isSafeExpressionColor(value: unknown): value is string {
  return typeof value === 'string' && SAFE_EXPRESSION_COLOR.test(value);
}

export function resolveExpressionColor(
  value: ExpressionColor | undefined,
  colors: Readonly<Record<string, string>>,
  fallback: string
): string {
  const safeFallback = isSafeExpressionColor(fallback) ? fallback : '#000000';
  if (!value) return safeFallback;
  if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) return value.toUpperCase();
  const resolved = Object.prototype.hasOwnProperty.call(colors, value) ? colors[value] : undefined;
  return isSafeExpressionColor(resolved) ? resolved : safeFallback;
}

// ---------------------------------------------------------------------------
// Element data accessors

export function elementData(element: CanvasElement): CanvasJsonObject {
  return element.data;
}

export function dataString(element: CanvasElement, key: string, fallback = ''): string {
  const value = element.data[key];
  return typeof value === 'string' ? value : fallback;
}

export function dataNumber(element: CanvasElement, key: string, fallback: number): number {
  const value = element.data[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function dataBoolean(element: CanvasElement, key: string, fallback: boolean): boolean {
  const value = element.data[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function elementSlot(element: CanvasElement): string | null {
  const slot = element.data.slot;
  return typeof slot === 'string' && slot ? slot : null;
}

export function elementComponent(element: CanvasElement): string | null {
  if (element.kind !== 'component') return null;
  const component = element.data.component;
  return typeof component === 'string' ? component : null;
}

export function readCodeTabs(element: CanvasElement): CodeTab[] {
  const raw = element.data.tabs;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value, index) => {
    const tab = asCanvasJsonObject(value);
    if (!tab) return [];
    const highlight = Array.isArray(tab.highlight)
      ? tab.highlight.filter((line): line is number => typeof line === 'number' && Number.isInteger(line) && line > 0)
      : [];
    return [{
      code: typeof tab.code === 'string' ? tab.code : '',
      highlight,
      id: typeof tab.id === 'string' && tab.id ? tab.id : `tab-${index + 1}`,
      language: typeof tab.language === 'string' ? tab.language : 'typescript',
      name: typeof tab.name === 'string' ? tab.name : `file-${index + 1}`,
    }];
  });
}

export function activeCodeTab(element: CanvasElement): CodeTab | null {
  const tabs = readCodeTabs(element);
  const activeId = dataString(element, 'activeTab');
  return tabs.find(({ id }) => id === activeId) ?? tabs[0] ?? null;
}

export function readLockupPartners(element: CanvasElement): LockupPartner[] {
  const raw = element.data.partners;
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((value, index) => {
    const partner = asCanvasJsonObject(value);
    if (!partner) return [];
    const kind = partner.kind === 'text' ? 'text' : 'logo';
    const aspect = typeof partner.aspect === 'number' && partner.aspect > 0 ? partner.aspect : 1;
    return [{
      aspect,
      assetId: typeof partner.assetId === 'string' ? partner.assetId : undefined,
      fontAssetId: typeof partner.fontAssetId === 'string' ? partner.fontAssetId : undefined,
      fontFamily: typeof partner.fontFamily === 'string' ? partner.fontFamily : undefined,
      fontWeight: typeof partner.fontWeight === 'number' ? partner.fontWeight : undefined,
      id: typeof partner.id === 'string' && partner.id ? partner.id : `partner-${index + 1}`,
      kind,
      label: typeof partner.label === 'string' ? partner.label : '',
      letterSpacing: typeof partner.letterSpacing === 'number' ? partner.letterSpacing : undefined,
      sourceId: typeof partner.sourceId === 'string' ? partner.sourceId : undefined,
    }];
  });
}

export function readNumberArray(element: CanvasElement, key: string): number[] {
  const raw = element.data[key];
  return Array.isArray(raw) ? raw.filter((value): value is number => typeof value === 'number' && Number.isFinite(value)) : [];
}

export function readStringArray(element: CanvasElement, key: string): string[] {
  const raw = element.data[key];
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === 'string') : [];
}

// ---------------------------------------------------------------------------
// State

export function readExpressionState(document: CanvasDocument): ExpressionState | null {
  const metadata = asCanvasJsonObject(document.metadata[STUDIO_METADATA_KEY]);
  if (!metadata || metadata.sourceVersion !== EXPRESSION_SOURCE_VERSION) return null;
  const state = asCanvasJsonObject(metadata.state);
  if (!state || !isExpressionToolKind(state.kind)) return null;
  const pages: Record<string, ExpressionPageSettings> = {};
  const rawPages = asCanvasJsonObject(state.pages) ?? {};
  for (const [pageId, value] of Object.entries(rawPages)) {
    const page = asCanvasJsonObject(value);
    if (!page) continue;
    const stash = asCanvasJsonObject(page.stash);
    pages[pageId] = {
      layout: typeof page.layout === 'string' ? page.layout : '',
      stash: stash
        ? Object.fromEntries(Object.entries(stash).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
        : undefined,
      surface: typeof page.surface === 'string' ? page.surface : 'paper',
    };
  }
  return {
    body: typeof state.body === 'string' ? state.body : undefined,
    code: typeof state.code === 'string' ? state.code : undefined,
    expressionVersion: EXPRESSION_SOURCE_VERSION,
    format: typeof state.format === 'string' ? state.format : '',
    kind: state.kind,
    language: typeof state.language === 'string' ? state.language : undefined,
    pages,
    title: typeof state.title === 'string' ? state.title : '',
  };
}

export function expressionState(document: CanvasDocument): ExpressionState {
  const state = readExpressionState(document);
  if (!state) throw new TypeError('This canvas document is not an expression document.');
  return state;
}

export function expressionToolId(document: CanvasDocument): string | null {
  const metadata = asCanvasJsonObject(document.metadata[STUDIO_METADATA_KEY]);
  return typeof metadata?.toolId === 'string' ? metadata.toolId : null;
}

export function pageSettings(document: CanvasDocument, pageId: string): ExpressionPageSettings {
  return expressionState(document).pages[pageId] ?? { layout: '', surface: 'paper' };
}

function writeState(document: CanvasDocument, state: ExpressionState, toolId: string): CanvasDocument {
  return {
    ...document,
    metadata: {
      ...document.metadata,
      [STUDIO_METADATA_KEY]: {
        sourceVersion: EXPRESSION_SOURCE_VERSION,
        state: toCanvasJsonObject(state, 'Expression state'),
        toolId,
      },
      tool: toolId,
    },
  };
}

// ---------------------------------------------------------------------------
// Document construction

let fallbackClock = 0;
function timestamp(): string {
  // Deterministic in tests (no Date mocking needed), real time in the browser.
  if (typeof window === 'undefined') {
    fallbackClock += 1;
    return new Date(Date.UTC(2026, 0, 1, 0, 0, fallbackClock % 60)).toISOString();
  }
  return new Date().toISOString();
}

export function touchDocument(document: CanvasDocument, patch: Partial<CanvasDocument> = {}): CanvasDocument {
  return { ...document, ...patch, revision: document.revision + 1, updatedAt: timestamp() };
}

export function createExpressionShell({
  brandId,
  format,
  id,
  kind,
  pages,
  title,
  toolId,
}: {
  brandId: string;
  format: ExpressionFormat;
  id: string;
  kind: ExpressionToolKind;
  pages: readonly { id: string; name: string; settings: ExpressionPageSettings; background: string }[];
  title: string;
  toolId: string;
}): CanvasDocument {
  const base = createCanvasDocument(id, brandId, title, format.width, format.height, [
    'assets',
    'history',
    'layers',
    'pages',
    'speaker-notes',
    'text',
  ]);
  const pageRecords: Record<string, CanvasPage> = {};
  for (const page of pages) {
    pageRecords[page.id] = {
      background: page.background,
      bleed: 0,
      elementIds: [],
      height: format.height,
      id: page.id,
      name: page.name,
      notes: '',
      safeArea: 0,
      width: format.width,
    };
  }
  const shell: CanvasDocument = {
    ...base,
    createdAt: '2026-01-01T00:00:00.000Z',
    pageIds: pages.map(({ id: pageId }) => pageId),
    pages: pageRecords,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  return writeState(shell, {
    expressionVersion: EXPRESSION_SOURCE_VERSION,
    format: format.id,
    kind,
    pages: Object.fromEntries(pages.map((page) => [page.id, page.settings])),
    title: '',
  }, toolId);
}

export function withExpressionState(
  document: CanvasDocument,
  update: (state: ExpressionState) => ExpressionState
): CanvasDocument {
  const toolId = expressionToolId(document) ?? expressionState(document).kind;
  return writeState(document, update(expressionState(document)), toolId);
}

export function newExpressionElement(
  id: string,
  name: string,
  kind: CanvasElementKind,
  bounds: CanvasBounds,
  data: Record<string, CanvasJsonValue | undefined> = {}
): CanvasElement {
  return { ...createCanvasElement(id, name, kind, roundBounds(bounds)), data: cleanData(data) };
}

function cleanData(data: Record<string, CanvasJsonValue | undefined>): CanvasJsonObject {
  return Object.fromEntries(Object.entries(data).filter((entry): entry is [string, CanvasJsonValue] => entry[1] !== undefined));
}

export function roundBounds(bounds: CanvasBounds): CanvasBounds {
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    height: Math.max(1, round(bounds.height)),
    rotation: round(((bounds.rotation % 360) + 540) % 360 - 180),
    width: Math.max(1, round(bounds.width)),
    x: round(bounds.x),
    y: round(bounds.y),
  };
}

export function expressionAsset(id: string, name: string, source: string, kind: CanvasAssetKind = 'image'): CanvasAsset {
  return {
    byteLength: 0,
    id,
    kind,
    mimeType: inferCanvasAssetMimeType(source, kind === 'font' ? 'font/ttf' : 'application/octet-stream'),
    name,
    source,
  };
}

export function withAssets(document: CanvasDocument, assets: readonly CanvasAsset[]): CanvasDocument {
  if (assets.length === 0) return document;
  const next = { ...document.assets };
  let changed = false;
  for (const asset of assets) {
    const current = next[asset.id];
    if (current && current.source === asset.source && current.name === asset.name) continue;
    next[asset.id] = asset;
    changed = true;
  }
  return changed ? { ...document, assets: next } : document;
}

// ---------------------------------------------------------------------------
// Queries

export function pageElements(document: CanvasDocument, pageId: string): CanvasElement[] {
  const page = document.pages[pageId];
  if (!page) return [];
  return page.elementIds.flatMap((id) => document.elements[id] ? [document.elements[id]!] : []);
}

export function elementPageId(document: CanvasDocument, elementId: string): string | null {
  return document.pageIds.find((pageId) => document.pages[pageId]?.elementIds.includes(elementId)) ?? null;
}

export function slotElement(document: CanvasDocument, pageId: string, slot: string): CanvasElement | null {
  return pageElements(document, pageId).find((element) => elementSlot(element) === slot) ?? null;
}

export function uniqueElementId(document: CanvasDocument, base: string): string {
  const stem = base.toLowerCase().replace(/[^a-z0-9:-]+/g, '-').replace(/^-+|-+$/g, '') || 'layer';
  if (!document.elements[stem]) return stem;
  for (let index = 2; ; index += 1) {
    const candidate = `${stem}-${index}`;
    if (!document.elements[candidate]) return candidate;
  }
}

export function uniquePageId(document: CanvasDocument): string {
  for (let index = document.pageIds.length + 1; ; index += 1) {
    const candidate = `page-${index}`;
    if (!document.pages[candidate]) return candidate;
  }
}

function assetIdsInValue(value: CanvasJsonValue, ids: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((item) => assetIdsInValue(item, ids));
    return;
  }
  const object = asCanvasJsonObject(value);
  if (!object) return;
  for (const [key, item] of Object.entries(object)) {
    if (typeof item === 'string' && /assetid$/i.test(key)) ids.add(item);
    else assetIdsInValue(item, ids);
  }
}

export function referencedAssetIds(document: CanvasDocument): Set<string> {
  const ids = new Set<string>();
  for (const element of Object.values(document.elements)) {
    if (element.assetId) ids.add(element.assetId);
    if (element.textStyle?.fontId) ids.add(element.textStyle.fontId);
    assetIdsInValue(element.data, ids);
  }
  return ids;
}

/** Drop assets no layer references so removed uploads do not stay in saved source. */
export function pruneAssets(document: CanvasDocument): CanvasDocument {
  const referenced = referencedAssetIds(document);
  const entries = Object.entries(document.assets).filter(([id]) => referenced.has(id));
  if (entries.length === Object.keys(document.assets).length) return document;
  return { ...document, assets: Object.fromEntries(entries) };
}

// ---------------------------------------------------------------------------
// Mutations (immutable; every one bumps the revision)

export function patchElement(document: CanvasDocument, elementId: string, patch: ExpressionElementPatch): CanvasDocument {
  const element = document.elements[elementId];
  if (!element) return document;
  const next: CanvasElement = {
    ...element,
    ...patch,
    bounds: patch.bounds ? roundBounds({ ...element.bounds, ...patch.bounds }) : element.bounds,
    data: patch.data ? cleanData({ ...element.data, ...patch.data }) : element.data,
    id: element.id,
    style: patch.style ? { ...element.style, ...patch.style } : element.style,
    textStyle: patch.textStyle && element.textStyle ? { ...element.textStyle, ...patch.textStyle } : element.textStyle,
  };
  return touchDocument(document, { elements: { ...document.elements, [elementId]: next } });
}

export function insertElements(
  document: CanvasDocument,
  pageId: string,
  elements: readonly CanvasElement[],
  index?: number
): CanvasDocument {
  const page = document.pages[pageId];
  if (!page || elements.length === 0) return document;
  const elementIds = [...page.elementIds];
  elementIds.splice(index ?? elementIds.length, 0, ...elements.map(({ id }) => id));
  return touchDocument(document, {
    elements: { ...document.elements, ...Object.fromEntries(elements.map((element) => [element.id, element])) },
    pages: { ...document.pages, [pageId]: { ...page, elementIds } },
  });
}

export function removeElements(document: CanvasDocument, elementIds: readonly string[]): CanvasDocument {
  const remove = new Set(elementIds.filter((id) => document.elements[id]));
  if (remove.size === 0) return document;
  const elements = Object.fromEntries(Object.entries(document.elements).filter(([id]) => !remove.has(id)));
  const pages = Object.fromEntries(Object.entries(document.pages).map(([pageId, page]) => [
    pageId,
    { ...page, elementIds: page.elementIds.filter((id) => !remove.has(id)) },
  ]));
  return pruneAssets(touchDocument(document, { elements, pages }));
}

export function duplicateElements(
  document: CanvasDocument,
  elementIds: readonly string[],
  offset = 24
): { document: CanvasDocument; ids: string[] } {
  let next = document;
  const ids: string[] = [];
  for (const id of elementIds) {
    const element = next.elements[id];
    const pageId = elementPageId(next, id);
    if (!element || !pageId) continue;
    const copyId = uniqueElementId(next, `${id}-copy`);
    const copy: CanvasElement = {
      ...structuredClone(element),
      bounds: roundBounds({ ...element.bounds, x: element.bounds.x + offset, y: element.bounds.y + offset }),
      data: cleanData({ ...element.data, slot: undefined }),
      id: copyId,
      locked: false,
      name: `${element.name} copy`,
    };
    const index = next.pages[pageId]!.elementIds.indexOf(id) + 1;
    next = insertElements(next, pageId, [copy], index);
    ids.push(copyId);
  }
  return { document: next, ids };
}

export type StackTarget = number | 'backward' | 'back' | 'forward' | 'front';

export function reorderElement(document: CanvasDocument, elementId: string, target: StackTarget): CanvasDocument {
  const pageId = elementPageId(document, elementId);
  if (!pageId) return document;
  const page = document.pages[pageId]!;
  const current = page.elementIds.indexOf(elementId);
  const last = page.elementIds.length - 1;
  let destination = typeof target === 'number' ? target : current;
  if (target === 'forward') destination = current + 1;
  else if (target === 'backward') destination = current - 1;
  else if (target === 'front') destination = last;
  else if (target === 'back') destination = 0;
  destination = Math.max(0, Math.min(last, Math.round(destination)));
  if (destination === current) return document;
  const elementIds = page.elementIds.filter((id) => id !== elementId);
  elementIds.splice(destination, 0, elementId);
  return touchDocument(document, { pages: { ...document.pages, [pageId]: { ...page, elementIds } } });
}

export function setPageSettings(
  document: CanvasDocument,
  pageId: string,
  patch: Partial<ExpressionPageSettings>,
  background?: string
): CanvasDocument {
  const page = document.pages[pageId];
  if (!page) return document;
  const withPage = background && background !== page.background
    ? { ...document, pages: { ...document.pages, [pageId]: { ...page, background } } }
    : document;
  return touchDocument(withExpressionState(withPage, (state) => ({
    ...state,
    pages: { ...state.pages, [pageId]: { ...(state.pages[pageId] ?? { layout: '', surface: 'paper' }), ...patch } },
  })));
}

export function setPageNotes(document: CanvasDocument, pageId: string, notes: string): CanvasDocument {
  const page = document.pages[pageId];
  if (!page || page.notes === notes) return document;
  return touchDocument(document, { pages: { ...document.pages, [pageId]: { ...page, notes } } });
}

export function movePage(document: CanvasDocument, pageId: string, index: number): CanvasDocument {
  const current = document.pageIds.indexOf(pageId);
  if (current < 0) return document;
  const destination = Math.max(0, Math.min(document.pageIds.length - 1, Math.round(index)));
  if (destination === current) return document;
  const pageIds = document.pageIds.filter((id) => id !== pageId);
  pageIds.splice(destination, 0, pageId);
  return touchDocument(document, { pageIds });
}

export function removePage(document: CanvasDocument, pageId: string): CanvasDocument {
  if (document.pageIds.length <= 1 || !document.pages[pageId]) return document;
  const page = document.pages[pageId]!;
  const remove = new Set(page.elementIds);
  const pages = { ...document.pages };
  delete pages[pageId];
  const next = touchDocument(document, {
    elements: Object.fromEntries(Object.entries(document.elements).filter(([id]) => !remove.has(id))),
    pageIds: document.pageIds.filter((id) => id !== pageId),
    pages,
  });
  return pruneAssets(withExpressionState(next, (state) => {
    const statePages = { ...state.pages };
    delete statePages[pageId];
    return { ...state, pages: statePages };
  }));
}

export function insertPage(
  document: CanvasDocument,
  page: CanvasPage,
  settings: ExpressionPageSettings,
  elements: readonly CanvasElement[],
  index: number
): CanvasDocument {
  const pageIds = [...document.pageIds];
  pageIds.splice(Math.max(0, Math.min(pageIds.length, index)), 0, page.id);
  const next = touchDocument(document, {
    elements: { ...document.elements, ...Object.fromEntries(elements.map((element) => [element.id, element])) },
    pageIds,
    pages: { ...document.pages, [page.id]: { ...page, elementIds: elements.map(({ id }) => id) } },
  });
  return withExpressionState(next, (state) => ({ ...state, pages: { ...state.pages, [page.id]: settings } }));
}

export function duplicatePage(document: CanvasDocument, pageId: string): { document: CanvasDocument; pageId: string } {
  const page = document.pages[pageId];
  if (!page) return { document, pageId };
  const nextPageId = uniquePageId(document);
  let scratch = document;
  const copies = page.elementIds.flatMap((id) => {
    const element = document.elements[id];
    if (!element) return [];
    const copyId = uniqueElementId(scratch, `${nextPageId}:${id.replace(/^page-\d+:/, '')}`);
    const copy: CanvasElement = { ...structuredClone(element), id: copyId };
    scratch = { ...scratch, elements: { ...scratch.elements, [copyId]: copy } };
    return [copy];
  });
  const settings = structuredClone(pageSettings(document, pageId));
  const next = insertPage(
    document,
    { ...page, id: nextPageId, name: `${page.name} copy` },
    settings,
    copies,
    document.pageIds.indexOf(pageId) + 1
  );
  return { document: next, pageId: nextPageId };
}

// ---------------------------------------------------------------------------
// Geometry helpers

export function scaleBoundsToFormat(bounds: CanvasBounds, from: { height: number; width: number }, to: { height: number; width: number }): CanvasBounds {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const s = Math.min(sx, sy);
  const centerX = (bounds.x + bounds.width / 2) * sx;
  const centerY = (bounds.y + bounds.height / 2) * sy;
  const width = bounds.width * s;
  const height = bounds.height * s;
  return roundBounds({ ...bounds, height, width, x: centerX - width / 2, y: centerY - height / 2 });
}

export type ExpressionAlignment = 'left' | 'horizontal-center' | 'right' | 'top' | 'vertical-center' | 'bottom';

export function alignBounds(bounds: CanvasBounds, page: { height: number; width: number }, alignment: ExpressionAlignment): CanvasBounds {
  if (alignment === 'left') return { ...bounds, x: 0 };
  if (alignment === 'horizontal-center') return { ...bounds, x: (page.width - bounds.width) / 2 };
  if (alignment === 'right') return { ...bounds, x: page.width - bounds.width };
  if (alignment === 'top') return { ...bounds, y: 0 };
  if (alignment === 'vertical-center') return { ...bounds, y: (page.height - bounds.height) / 2 };
  return { ...bounds, y: page.height - bounds.height };
}
