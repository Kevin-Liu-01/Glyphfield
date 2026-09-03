import { inspectSourceText } from './sourceCode';

const CANVAS_DOCUMENT_SCHEMA_VERSION = 2;

type CanvasJsonPrimitive = boolean | null | number | string;
export type CanvasJsonValue = CanvasJsonPrimitive | CanvasJsonValue[] | CanvasJsonObject;
export type CanvasJsonObject = { [key: string]: CanvasJsonValue };

const OMIT_CANVAS_JSON_VALUE = Symbol('omit-canvas-json-value');

function normalizeCanvasJsonValue(
  value: unknown,
  seen: Set<object>,
  inArray: boolean
): CanvasJsonValue | typeof OMIT_CANVAS_JSON_VALUE {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'undefined' || typeof value === 'function' || typeof value === 'symbol') {
    return inArray ? null : OMIT_CANVAS_JSON_VALUE;
  }
  if (typeof value === 'bigint') throw new TypeError('BigInt values are not supported in canvas JSON.');
  if (typeof value !== 'object') throw new TypeError('Canvas data contains an unsupported value.');
  if (seen.has(value)) throw new TypeError('Canvas data cannot contain circular references.');

  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((item) => {
        const normalized = normalizeCanvasJsonValue(item, seen, true);
        return normalized === OMIT_CANVAS_JSON_VALUE ? null : normalized;
      });
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Canvas data must use plain JSON objects.');
    }
    const normalized: CanvasJsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      const next = normalizeCanvasJsonValue(item, seen, false);
      if (next !== OMIT_CANVAS_JSON_VALUE) normalized[key] = next;
    }
    return normalized;
  } finally {
    seen.delete(value);
  }
}

/** Converts runtime state into the strict, portable JSON value used by every canvas adapter. */
export function toCanvasJsonValue(value: unknown, label = 'Canvas data'): CanvasJsonValue {
  const normalized = normalizeCanvasJsonValue(value, new Set(), false);
  if (normalized === OMIT_CANVAS_JSON_VALUE) {
    throw new TypeError(`${label} must be JSON serializable.`);
  }
  return normalized;
}

export function toCanvasJsonObject(value: unknown, label = 'Canvas data'): CanvasJsonObject {
  const parsed = toCanvasJsonValue(value, label);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError(`${label} must serialize to an object.`);
  }
  return parsed;
}

export function asCanvasJsonObject(value: CanvasJsonValue | undefined): CanvasJsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

export function canvasJsonBoolean(value: CanvasJsonValue | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function canvasJsonNumber(value: CanvasJsonValue | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function canvasJsonString(value: CanvasJsonValue | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function inferCanvasAssetMimeType(source: string, fallback = 'application/octet-stream'): string {
  const dataMime = /^data:([^;,]+)/i.exec(source)?.[1];
  if (dataMime) return dataMime.toLocaleLowerCase();
  const clean = source.split(/[?#]/, 1)[0]?.toLocaleLowerCase() ?? '';
  if (clean.endsWith('.svg')) return 'image/svg+xml';
  if (clean.endsWith('.png')) return 'image/png';
  if (clean.endsWith('.webp')) return 'image/webp';
  if (clean.endsWith('.gif')) return 'image/gif';
  if (clean.endsWith('.avif')) return 'image/avif';
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg';
  if (clean.endsWith('.woff2')) return 'font/woff2';
  return fallback;
}

export type CanvasAssetKind = 'binary' | 'font' | 'image' | 'video';

export type CanvasAsset = {
  byteLength: number;
  id: string;
  kind: CanvasAssetKind;
  mimeType: string;
  name: string;
  source: string;
};

export type CanvasCapability =
  | 'animation'
  | 'assets'
  | 'comments'
  | 'constraints'
  | 'guides'
  | 'history'
  | 'layers'
  | 'pages'
  | 'speaker-notes'
  | 'text'
  | 'video';

export type CanvasElementKind =
  | 'component'
  | 'effect'
  | 'frame'
  | 'gradient'
  | 'group'
  | 'image'
  | 'line'
  | 'logo'
  | 'shader'
  | 'shape'
  | 'text'
  | 'texture'
  | 'video';

type CanvasAnchor = 'bottom' | 'center' | 'left' | 'right' | 'scale' | 'stretch' | 'top';

type CanvasBlendMode =
  | 'color'
  | 'difference'
  | 'multiply'
  | 'normal'
  | 'overlay'
  | 'screen';

export type CanvasBounds = {
  height: number;
  rotation: number;
  width: number;
  x: number;
  y: number;
};

type CanvasElementStyle = {
  blendMode: CanvasBlendMode;
  borderColor?: string;
  borderWidth: number;
  borderRadius: number;
  opacity: number;
  shadowBlur: number;
  shadowColor?: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
};

type CanvasElementConstraints = {
  anchors: CanvasAnchor[];
  lockAspectRatio: boolean;
  lockDimensions: boolean;
  lockPosition: boolean;
  lockRotation: boolean;
};

type CanvasTextStyle = {
  align: 'center' | 'justify' | 'left' | 'right';
  casing: 'lowercase' | 'none' | 'uppercase';
  color: string;
  fontFamily: string;
  fontId: string;
  fontRole?: 'Accent' | 'Body' | 'Code' | 'Display';
  fontSize: number;
  fontWeight: number;
  letterSpacing: number;
  lineHeight: number;
  maxLines?: number;
  tokenBound: boolean;
};

type CanvasImageTreatment = {
  blur: number;
  crop: { height: number; width: number; x: number; y: number };
  dither: number;
  focalPoint: { x: number; y: number };
  grain: number;
  halation: number;
  objectFit: 'contain' | 'cover' | 'fill';
  posterize: number;
  saturation: number;
};

export type CanvasElement = {
  assetId?: string;
  bounds: CanvasBounds;
  children: string[];
  constraints: CanvasElementConstraints;
  content?: string;
  data: CanvasJsonObject;
  hidden: boolean;
  id: string;
  imageTreatment?: CanvasImageTreatment;
  kind: CanvasElementKind;
  locked: boolean;
  name: string;
  style: CanvasElementStyle;
  textStyle?: CanvasTextStyle;
  tokenId?: string;
};

type CanvasGuide = {
  axis: 'x' | 'y';
  id: string;
  locked: boolean;
  position: number;
};

export type CanvasPage = {
  background: string;
  bleed: number;
  elementIds: string[];
  height: number;
  id: string;
  name: string;
  notes: string;
  safeArea: number;
  width: number;
};

export type CanvasDocument = {
  assets: Record<string, CanvasAsset>;
  brandId: string;
  capabilities: CanvasCapability[];
  createdAt: string;
  elements: Record<string, CanvasElement>;
  guides: CanvasGuide[];
  id: string;
  metadata: CanvasJsonObject;
  pageIds: string[];
  pages: Record<string, CanvasPage>;
  revision: number;
  schemaVersion: number;
  title: string;
  updatedAt: string;
};

/**
 * Distinguishes the shared canvas envelope from pre-engine workspace payloads.
 * Once a source declares a canvas schema, adapters must parse it as that schema
 * so malformed documents fail visibly instead of silently falling back to a
 * legacy workspace format.
 */
export function isCanvasDocumentEnvelope(value: Readonly<Record<string, unknown>>): boolean {
  return typeof value.schemaVersion === 'number';
}

/** Resolves the asset owned by an element without duplicating asset-id lookup logic in adapters. */
export function canvasElementAsset(
  document: CanvasDocument | null | undefined,
  elementId: string
): CanvasAsset | null {
  const assetId = document?.elements[elementId]?.assetId;
  return assetId ? document?.assets[assetId] ?? null : null;
}

/** Returns an element's portable asset source, or the caller's live preview fallback while embedding. */
export function canvasElementAssetSource(
  document: CanvasDocument | null | undefined,
  elementId: string,
  fallback: string | null = null
): string | null {
  return canvasElementAsset(document, elementId)?.source ?? fallback;
}

export type CanvasDocumentHistory = {
  future: CanvasDocument[];
  past: CanvasDocument[];
  present: CanvasDocument;
};

export type CanvasSavedVersion = {
  author: string;
  createdAt: string;
  document: CanvasDocument;
  id: string;
  name: string;
  note: string;
  revision: number;
};

export type CanvasPreflightIssue = {
  elementId?: string;
  message: string;
  pageId?: string;
  severity: 'error' | 'warning';
  type: 'clipped' | 'missing-asset' | 'missing-font' | 'text-overflow' | 'unembedded-asset' | 'unembedded-font';
};

export type CanvasAssetResolver = (source: string, asset: CanvasAsset) => Promise<string>;

type CanvasElementPatch = Omit<Partial<CanvasElement>, 'bounds' | 'constraints' | 'style'> & {
  bounds?: Partial<CanvasBounds>;
  constraints?: Partial<CanvasElementConstraints>;
  style?: Partial<CanvasElementStyle>;
};

export type CanvasMutation =
  | { elementIds: string[]; type: 'delete-elements' }
  | { assetId: string; elementId: string; type: 'replace-asset' }
  | { bounds: Partial<CanvasBounds>; elementId: string; type: 'resize-element' }
  | { deltaX: number; deltaY: number; elementIds: string[]; type: 'move-elements' }
  | { elementId: string; locked: boolean; type: 'set-lock' }
  | { elementId: string; index: number; pageId: string; type: 'reorder-element' }
  | { elementId: string; patch: CanvasElementPatch; type: 'update-element' };

const DEFAULT_STYLE: CanvasElementStyle = {
  blendMode: 'normal',
  borderRadius: 0,
  borderWidth: 0,
  opacity: 1,
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
};

const DEFAULT_CONSTRAINTS: CanvasElementConstraints = {
  anchors: ['left', 'top'],
  lockAspectRatio: false,
  lockDimensions: false,
  lockPosition: false,
  lockRotation: false,
};

const CANVAS_CAPABILITIES = new Set<CanvasCapability>([
  'animation',
  'assets',
  'comments',
  'constraints',
  'guides',
  'history',
  'layers',
  'pages',
  'speaker-notes',
  'text',
  'video',
]);

const CANVAS_ELEMENT_KINDS = new Set<CanvasElementKind>([
  'component',
  'effect',
  'frame',
  'gradient',
  'group',
  'image',
  'line',
  'logo',
  'shader',
  'shape',
  'text',
  'texture',
  'video',
]);

const CANVAS_ASSET_KINDS = new Set<CanvasAssetKind>(['binary', 'font', 'image', 'video']);
const CANVAS_BLEND_MODES = new Set<CanvasBlendMode>(['color', 'difference', 'multiply', 'normal', 'overlay', 'screen']);
const CANVAS_ANCHORS = new Set<CanvasAnchor>(['bottom', 'center', 'left', 'right', 'scale', 'stretch', 'top']);

function isJsonObject(value: CanvasJsonValue | undefined): value is CanvasJsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredObject(value: CanvasJsonValue | undefined, label: string): CanvasJsonObject {
  if (!isJsonObject(value)) throw new TypeError(`${label} must be an object.`);
  return value;
}

function requiredString(value: CanvasJsonValue | undefined, label: string): string {
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  return value;
}

function requiredNumber(value: CanvasJsonValue | undefined, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return value;
}

function requiredBoolean(value: CanvasJsonValue | undefined, label: string): boolean {
  if (typeof value !== 'boolean') throw new TypeError(`${label} must be a boolean.`);
  return value;
}

function requiredStringArray(value: CanvasJsonValue | undefined, label: string): string[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array of strings.`);
  return value.map((item, index) => requiredString(item, `${label}.${index}`));
}

function optionalString(value: CanvasJsonValue | undefined, label: string): string | undefined {
  return value === undefined ? undefined : requiredString(value, label);
}

function optionalNumber(value: CanvasJsonValue | undefined, label: string): number | undefined {
  return value === undefined ? undefined : requiredNumber(value, label);
}

function optionalObject(value: CanvasJsonValue | undefined, label: string): CanvasJsonObject | undefined {
  return value === undefined ? undefined : requiredObject(value, label);
}

function dataUrlDetails(source: string): { byteLength: number; mimeType: string } | null {
  const match = /^data:([^;,]+)(?:;[^,]*)?,([\s\S]*)$/i.exec(source);
  if (!match) return null;
  const mimeType = match[1]!.toLocaleLowerCase();
  const payload = match[2]!;
  const base64 = /;base64,/i.test(source.slice(0, source.indexOf(',') + 1));
  if (!base64) {
    return { byteLength: new TextEncoder().encode(decodeURIComponent(payload)).length, mimeType };
  }
  const encoded = payload.replace(/\s/g, '');
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return { byteLength: Math.max(0, Math.floor(encoded.length * 3 / 4) - padding), mimeType };
}

function isEmbeddedCanvasAsset(asset: CanvasAsset): boolean {
  return dataUrlDetails(asset.source) !== null;
}

export function canvasRevisionFromSignature(signature: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || 1;
}

export function createEmbeddedCanvasAsset({
  id,
  kind,
  name,
  source,
}: {
  id: string;
  kind: CanvasAssetKind;
  name: string;
  source: string;
}): CanvasAsset {
  const details = dataUrlDetails(source);
  if (!details) throw new TypeError(`${name || id} must use an embedded data URL.`);
  return {
    byteLength: details.byteLength,
    id,
    kind,
    mimeType: details.mimeType,
    name,
    source,
  };
}

function parseBounds(value: CanvasJsonValue | undefined, label: string): CanvasBounds {
  const bounds = requiredObject(value, label);
  return {
    height: requiredNumber(bounds.height, `${label}.height`),
    rotation: requiredNumber(bounds.rotation, `${label}.rotation`),
    width: requiredNumber(bounds.width, `${label}.width`),
    x: requiredNumber(bounds.x, `${label}.x`),
    y: requiredNumber(bounds.y, `${label}.y`),
  };
}

function parseElementStyle(value: CanvasJsonValue | undefined, label: string): CanvasElementStyle {
  const style = requiredObject(value, label);
  const blendMode = requiredString(style.blendMode, `${label}.blendMode`);
  if (!CANVAS_BLEND_MODES.has(blendMode as CanvasBlendMode)) throw new TypeError(`${label}.blendMode is unsupported.`);
  return {
    blendMode: blendMode as CanvasBlendMode,
    borderColor: optionalString(style.borderColor, `${label}.borderColor`),
    borderRadius: requiredNumber(style.borderRadius, `${label}.borderRadius`),
    borderWidth: requiredNumber(style.borderWidth, `${label}.borderWidth`),
    opacity: requiredNumber(style.opacity, `${label}.opacity`),
    shadowBlur: requiredNumber(style.shadowBlur, `${label}.shadowBlur`),
    shadowColor: optionalString(style.shadowColor, `${label}.shadowColor`),
    shadowOffsetX: requiredNumber(style.shadowOffsetX, `${label}.shadowOffsetX`),
    shadowOffsetY: requiredNumber(style.shadowOffsetY, `${label}.shadowOffsetY`),
  };
}

function parseElementConstraints(value: CanvasJsonValue | undefined, label: string): CanvasElementConstraints {
  const constraints = requiredObject(value, label);
  const anchors = requiredStringArray(constraints.anchors, `${label}.anchors`);
  if (anchors.some((anchor) => !CANVAS_ANCHORS.has(anchor as CanvasAnchor))) throw new TypeError(`${label}.anchors contains an unsupported anchor.`);
  return {
    anchors: anchors as CanvasAnchor[],
    lockAspectRatio: requiredBoolean(constraints.lockAspectRatio, `${label}.lockAspectRatio`),
    lockDimensions: requiredBoolean(constraints.lockDimensions, `${label}.lockDimensions`),
    lockPosition: requiredBoolean(constraints.lockPosition, `${label}.lockPosition`),
    lockRotation: requiredBoolean(constraints.lockRotation, `${label}.lockRotation`),
  };
}

function parseTextStyle(value: CanvasJsonValue | undefined, label: string): CanvasTextStyle | undefined {
  if (value === undefined) return undefined;
  const style = requiredObject(value, label);
  const align = requiredString(style.align, `${label}.align`);
  const casing = requiredString(style.casing, `${label}.casing`);
  if (!['center', 'justify', 'left', 'right'].includes(align)) throw new TypeError(`${label}.align is unsupported.`);
  if (!['lowercase', 'none', 'uppercase'].includes(casing)) throw new TypeError(`${label}.casing is unsupported.`);
  const fontRole = optionalString(style.fontRole, `${label}.fontRole`);
  if (fontRole && !['Accent', 'Body', 'Code', 'Display'].includes(fontRole)) throw new TypeError(`${label}.fontRole is unsupported.`);
  return {
    align: align as CanvasTextStyle['align'],
    casing: casing as CanvasTextStyle['casing'],
    color: requiredString(style.color, `${label}.color`),
    fontFamily: requiredString(style.fontFamily, `${label}.fontFamily`),
    fontId: requiredString(style.fontId, `${label}.fontId`),
    fontRole: fontRole as CanvasTextStyle['fontRole'],
    fontSize: requiredNumber(style.fontSize, `${label}.fontSize`),
    fontWeight: requiredNumber(style.fontWeight, `${label}.fontWeight`),
    letterSpacing: requiredNumber(style.letterSpacing, `${label}.letterSpacing`),
    lineHeight: requiredNumber(style.lineHeight, `${label}.lineHeight`),
    maxLines: optionalNumber(style.maxLines, `${label}.maxLines`),
    tokenBound: requiredBoolean(style.tokenBound, `${label}.tokenBound`),
  };
}

function parseImageTreatment(value: CanvasJsonValue | undefined, label: string): CanvasImageTreatment | undefined {
  if (value === undefined) return undefined;
  const treatment = requiredObject(value, label);
  const crop = requiredObject(treatment.crop, `${label}.crop`);
  const focalPoint = requiredObject(treatment.focalPoint, `${label}.focalPoint`);
  const objectFit = requiredString(treatment.objectFit, `${label}.objectFit`);
  if (!['contain', 'cover', 'fill'].includes(objectFit)) throw new TypeError(`${label}.objectFit is unsupported.`);
  return {
    blur: requiredNumber(treatment.blur, `${label}.blur`),
    crop: {
      height: requiredNumber(crop.height, `${label}.crop.height`),
      width: requiredNumber(crop.width, `${label}.crop.width`),
      x: requiredNumber(crop.x, `${label}.crop.x`),
      y: requiredNumber(crop.y, `${label}.crop.y`),
    },
    dither: requiredNumber(treatment.dither, `${label}.dither`),
    focalPoint: {
      x: requiredNumber(focalPoint.x, `${label}.focalPoint.x`),
      y: requiredNumber(focalPoint.y, `${label}.focalPoint.y`),
    },
    grain: requiredNumber(treatment.grain, `${label}.grain`),
    halation: requiredNumber(treatment.halation, `${label}.halation`),
    objectFit: objectFit as CanvasImageTreatment['objectFit'],
    posterize: requiredNumber(treatment.posterize, `${label}.posterize`),
    saturation: requiredNumber(treatment.saturation, `${label}.saturation`),
  };
}

function parseCanvasElement(value: CanvasJsonValue | undefined, key: string): CanvasElement {
  const element = requiredObject(value, `elements.${key}`);
  const id = requiredString(element.id, `elements.${key}.id`);
  const kind = requiredString(element.kind, `elements.${key}.kind`);
  if (id !== key) throw new TypeError(`Element key ${key} does not match its id.`);
  if (!CANVAS_ELEMENT_KINDS.has(kind as CanvasElementKind)) throw new TypeError(`elements.${key}.kind is unsupported.`);
  return {
    assetId: optionalString(element.assetId, `elements.${key}.assetId`),
    bounds: parseBounds(element.bounds, `elements.${key}.bounds`),
    children: requiredStringArray(element.children, `elements.${key}.children`),
    constraints: parseElementConstraints(element.constraints, `elements.${key}.constraints`),
    content: optionalString(element.content, `elements.${key}.content`),
    data: requiredObject(element.data, `elements.${key}.data`),
    hidden: requiredBoolean(element.hidden, `elements.${key}.hidden`),
    id,
    imageTreatment: parseImageTreatment(element.imageTreatment, `elements.${key}.imageTreatment`),
    kind: kind as CanvasElementKind,
    locked: requiredBoolean(element.locked, `elements.${key}.locked`),
    name: requiredString(element.name, `elements.${key}.name`),
    style: parseElementStyle(element.style, `elements.${key}.style`),
    textStyle: parseTextStyle(element.textStyle, `elements.${key}.textStyle`),
    tokenId: optionalString(element.tokenId, `elements.${key}.tokenId`),
  };
}

function parseCanvasAsset(value: CanvasJsonValue | undefined, key: string): CanvasAsset {
  const asset = requiredObject(value, `assets.${key}`);
  const id = requiredString(asset.id, `assets.${key}.id`);
  const kind = requiredString(asset.kind, `assets.${key}.kind`);
  if (id !== key) throw new TypeError(`Asset key ${key} does not match its id.`);
  if (!CANVAS_ASSET_KINDS.has(kind as CanvasAssetKind)) throw new TypeError(`assets.${key}.kind is unsupported.`);
  return {
    byteLength: requiredNumber(asset.byteLength, `assets.${key}.byteLength`),
    id,
    kind: kind as CanvasAssetKind,
    mimeType: requiredString(asset.mimeType, `assets.${key}.mimeType`),
    name: requiredString(asset.name, `assets.${key}.name`),
    source: requiredString(asset.source, `assets.${key}.source`),
  };
}

function parseCanvasPage(value: CanvasJsonValue | undefined, key: string): CanvasPage {
  const page = requiredObject(value, `pages.${key}`);
  const id = requiredString(page.id, `pages.${key}.id`);
  if (id !== key) throw new TypeError(`Page key ${key} does not match its id.`);
  return {
    background: requiredString(page.background, `pages.${key}.background`),
    bleed: requiredNumber(page.bleed, `pages.${key}.bleed`),
    elementIds: requiredStringArray(page.elementIds, `pages.${key}.elementIds`),
    height: requiredNumber(page.height, `pages.${key}.height`),
    id,
    name: requiredString(page.name, `pages.${key}.name`),
    notes: requiredString(page.notes, `pages.${key}.notes`),
    safeArea: requiredNumber(page.safeArea, `pages.${key}.safeArea`),
    width: requiredNumber(page.width, `pages.${key}.width`),
  };
}

function parseCanvasGuide(value: CanvasJsonValue | undefined, index: number): CanvasGuide {
  const guide = requiredObject(value, `guides.${index}`);
  const axis = requiredString(guide.axis, `guides.${index}.axis`);
  if (axis !== 'x' && axis !== 'y') throw new TypeError(`guides.${index}.axis is unsupported.`);
  return {
    axis,
    id: requiredString(guide.id, `guides.${index}.id`),
    locked: requiredBoolean(guide.locked, `guides.${index}.locked`),
    position: requiredNumber(guide.position, `guides.${index}.position`),
  };
}

function parseCanvasDocumentV2(value: CanvasJsonObject): CanvasDocument {
  if (requiredNumber(value.schemaVersion, 'schemaVersion') !== CANVAS_DOCUMENT_SCHEMA_VERSION) {
    throw new TypeError(`Canvas schema version ${String(value.schemaVersion)} is unsupported.`);
  }
  const rawCapabilities = requiredStringArray(value.capabilities, 'capabilities');
  if (rawCapabilities.some((capability) => !CANVAS_CAPABILITIES.has(capability as CanvasCapability))) {
    throw new TypeError('capabilities contains an unsupported capability.');
  }
  const rawAssets = requiredObject(value.assets, 'assets');
  const assets = Object.fromEntries(Object.entries(rawAssets).map(([key, asset]) => [key, parseCanvasAsset(asset, key)]));
  const rawElements = requiredObject(value.elements, 'elements');
  const elements = Object.fromEntries(Object.entries(rawElements).map(([key, element]) => [key, parseCanvasElement(element, key)]));
  const rawPages = requiredObject(value.pages, 'pages');
  const pages = Object.fromEntries(Object.entries(rawPages).map(([key, page]) => [key, parseCanvasPage(page, key)]));
  const pageIds = requiredStringArray(value.pageIds, 'pageIds');
  if (pageIds.some((pageId) => !pages[pageId])) throw new TypeError('pageIds references a missing page.');
  for (const page of Object.values(pages)) {
    if (page.elementIds.some((elementId) => !elements[elementId])) throw new TypeError(`${page.name} references a missing element.`);
  }
  const guidesValue = value.guides;
  if (!Array.isArray(guidesValue)) throw new TypeError('guides must be an array.');
  return {
    assets,
    brandId: requiredString(value.brandId, 'brandId'),
    capabilities: rawCapabilities as CanvasCapability[],
    createdAt: requiredString(value.createdAt, 'createdAt'),
    elements,
    guides: guidesValue.map(parseCanvasGuide),
    id: requiredString(value.id, 'id'),
    metadata: requiredObject(value.metadata, 'metadata'),
    pageIds,
    pages,
    revision: requiredNumber(value.revision, 'revision'),
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
    title: requiredString(value.title, 'title'),
    updatedAt: requiredString(value.updatedAt, 'updatedAt'),
  };
}

function migrateCanvasDocumentV1(value: CanvasJsonObject): CanvasDocument {
  const assetIds = requiredStringArray(value.assetIds, 'assetIds');
  const fontIds = requiredStringArray(value.fontIds, 'fontIds');
  const fontIdSet = new Set(fontIds);
  const resourceIds = [...new Set([...assetIds, ...fontIds])];
  const assets = Object.fromEntries(resourceIds.map((id) => [id, {
    byteLength: 0,
    id,
    kind: fontIdSet.has(id) ? 'font' : 'binary',
    mimeType: 'application/octet-stream',
    name: id,
    source: '',
  }])) as CanvasJsonObject;
  const legacyElements = requiredObject(value.elements, 'elements');
  const elements = Object.fromEntries(Object.entries(legacyElements).map(([id, element]) => {
    const source = requiredObject(element, `elements.${id}`);
    return [id, { ...source, data: isJsonObject(source.data) ? source.data : {} }];
  })) as CanvasJsonObject;
  const metadata = optionalObject(value.metadata, 'metadata') ?? {};
  const { assetIds: _assetIds, fontIds: _fontIds, ...rest } = value;
  return parseCanvasDocumentV2({
    ...rest,
    assets,
    elements,
    metadata: { ...metadata, migratedFromSchemaVersion: 1 },
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
  });
}

function stableJson(value: CanvasJsonValue): CanvasJsonValue {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!isJsonObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableJson(value[key]!)])
  );
}

/** Produces the canonical JSON signature used for stable document revisions. */
export function canvasSignatureFromValue(value: unknown): string {
  return JSON.stringify(stableJson(toCanvasJsonValue(value, 'Canvas revision input')));
}

/** Hashes only editable document content, excluding timestamps and the revision itself. */
function omitCanvasJsonObjectKeys(
  value: CanvasJsonValue,
  omittedKeys: ReadonlySet<string>
): CanvasJsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => omitCanvasJsonObjectKeys(entry, omittedKeys));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => (
    omittedKeys.has(key) ? [] : [[key, omitCanvasJsonObjectKeys(entry, omittedKeys)]]
  )));
}

export type CanvasContentRevisionOptions = {
  omitMetadataKeys?: readonly string[];
};

export function canvasDocumentContentRevision(
  document: CanvasDocument,
  options: CanvasContentRevisionOptions = {}
): number {
  const omittedMetadataKeys = new Set(options.omitMetadataKeys ?? []);
  return canvasRevisionFromSignature(canvasSignatureFromValue({
    assets: document.assets,
    brandId: document.brandId,
    capabilities: document.capabilities,
    elements: document.elements,
    guides: document.guides,
    id: document.id,
    metadata: omitCanvasJsonObjectKeys(document.metadata, omittedMetadataKeys),
    pageIds: document.pageIds,
    pages: document.pages,
    schemaVersion: document.schemaVersion,
    title: document.title,
  }));
}

/** Returns a semantic revision for portable canvas source, or null for non-canvas source. */
export function canvasSourceContentRevision(
  source: string,
  options: CanvasContentRevisionOptions = {}
): number | null {
  try {
    return canvasDocumentContentRevision(parseCanvasDocument(source), options);
  } catch {
    return null;
  }
}

export function parseCanvasDocument(source: string): CanvasDocument {
  const diagnostic = inspectSourceText(source);
  if (!diagnostic.valid) throw new SyntaxError(diagnostic.message);
  const parsed = JSON.parse(diagnostic.source) as CanvasJsonValue;
  const value = requiredObject(parsed, 'Canvas document');
  const schemaVersion = requiredNumber(value.schemaVersion, 'schemaVersion');
  if (schemaVersion === 1) return migrateCanvasDocumentV1(value);
  return parseCanvasDocumentV2(value);
}

export function serializeCanvasDocument(
  document: CanvasDocument,
  { portable = true }: { portable?: boolean } = {}
): string {
  const normalized = parseCanvasDocument(JSON.stringify(document));
  if (portable) {
    const resourceIssues = preflightCanvasDocument(normalized).filter(({ type }) => (
      type === 'missing-asset'
      || type === 'missing-font'
      || type === 'unembedded-asset'
      || type === 'unembedded-font'
    ));
    if (resourceIssues.length > 0) {
      throw new TypeError(`Canvas document is not portable: ${resourceIssues.map(({ message }) => message).join('; ')}`);
    }
  }
  const value = toCanvasJsonValue(normalized, 'Canvas document');
  return JSON.stringify(stableJson(value), null, 2);
}

function cloneDocument(document: CanvasDocument): CanvasDocument {
  return structuredClone(document);
}

function updateDocument(document: CanvasDocument, patch: Partial<CanvasDocument>): CanvasDocument {
  return {
    ...document,
    ...patch,
    revision: document.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

export function registerCanvasAsset(document: CanvasDocument, asset: CanvasAsset): CanvasDocument {
  return updateDocument(document, {
    assets: { ...document.assets, [asset.id]: { ...asset } },
  });
}

export async function embedCanvasDocumentAssets(
  document: CanvasDocument,
  resolve: CanvasAssetResolver
): Promise<CanvasDocument> {
  const entries = await Promise.all(Object.entries(document.assets).map(async ([id, asset]) => {
    if (isEmbeddedCanvasAsset(asset)) return [id, asset] as const;
    const source = await resolve(asset.source, asset);
    return [id, createEmbeddedCanvasAsset({ id, kind: asset.kind, name: asset.name, source })] as const;
  }));
  const assets = Object.fromEntries(entries);
  const changed = entries.some(([id, asset]) => asset !== document.assets[id]);
  return changed ? updateDocument(document, { assets }) : document;
}

export function canvasDocumentNeedsAssetEmbedding(document: CanvasDocument): boolean {
  return Object.values(document.assets).some((asset) => !isEmbeddedCanvasAsset(asset));
}

export async function preparePortableCanvasDocument(
  document: CanvasDocument,
  resolve: CanvasAssetResolver
): Promise<CanvasDocument> {
  if (!canvasDocumentNeedsAssetEmbedding(document)) {
    serializeCanvasDocument(document);
    return document;
  }
  const embedded = await embedCanvasDocumentAssets(document, resolve);
  const portable = {
    ...embedded,
    revision: document.revision,
    updatedAt: document.updatedAt,
  };
  serializeCanvasDocument(portable);
  return portable;
}

export async function serializePortableCanvasDocument(
  document: CanvasDocument,
  resolve: CanvasAssetResolver
): Promise<string> {
  return serializeCanvasDocument(await preparePortableCanvasDocument(document, resolve));
}

export function createCanvasElement(
  id: string,
  name: string,
  kind: CanvasElementKind,
  bounds: CanvasBounds
): CanvasElement {
  return {
    bounds,
    children: [],
    constraints: { ...DEFAULT_CONSTRAINTS, anchors: [...DEFAULT_CONSTRAINTS.anchors] },
    data: {},
    hidden: false,
    id,
    kind,
    locked: false,
    name,
    style: { ...DEFAULT_STYLE },
  };
}

export function createCanvasDocument(
  id: string,
  brandId: string,
  title: string,
  width: number,
  height: number,
  capabilities: CanvasCapability[]
): CanvasDocument {
  const createdAt = new Date().toISOString();
  const pageId = `${id}-page-1`;
  return {
    assets: {},
    brandId,
    capabilities: [...new Set(capabilities)],
    createdAt,
    elements: {},
    guides: [],
    id,
    metadata: {},
    pageIds: [pageId],
    pages: {
      [pageId]: {
        background: '#FFFFFF',
        bleed: 0,
        elementIds: [],
        height,
        id: pageId,
        name: 'Page 1',
        notes: '',
        safeArea: 0,
        width,
      },
    },
    revision: 1,
    schemaVersion: CANVAS_DOCUMENT_SCHEMA_VERSION,
    title,
    updatedAt: createdAt,
  };
}

export function createCanvasPage(
  id: string,
  name: string,
  width: number,
  height: number,
  background = '#FFFFFF'
): CanvasPage {
  if (!id.trim()) throw new TypeError('Canvas page id cannot be empty.');
  if (!name.trim()) throw new TypeError('Canvas page name cannot be empty.');
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('Canvas page dimensions must be positive finite numbers.');
  }
  return {
    background,
    bleed: 0,
    elementIds: [],
    height,
    id,
    name,
    notes: '',
    safeArea: 0,
    width,
  };
}

export function insertCanvasElement(
  document: CanvasDocument,
  pageId: string,
  element: CanvasElement,
  index?: number
): CanvasDocument {
  const page = document.pages[pageId];
  if (!page) return document;
  const elementIds = [...page.elementIds];
  elementIds.splice(index ?? elementIds.length, 0, element.id);
  return updateDocument(document, {
    elements: { ...document.elements, [element.id]: element },
    pages: { ...document.pages, [pageId]: { ...page, elementIds } },
  });
}

function mutateElement(
  document: CanvasDocument,
  elementId: string,
  mutate: (element: CanvasElement) => CanvasElement
): CanvasDocument {
  const element = document.elements[elementId];
  if (!element) return document;
  return updateDocument(document, {
    elements: { ...document.elements, [elementId]: mutate(element) },
  });
}

export function applyCanvasMutation(document: CanvasDocument, mutation: CanvasMutation): CanvasDocument {
  if (mutation.type === 'move-elements') {
    const elements = { ...document.elements };
    let changed = false;
    for (const elementId of mutation.elementIds) {
      const element = elements[elementId];
      if (!element || element.locked || element.constraints.lockPosition) continue;
      elements[elementId] = {
        ...element,
        bounds: {
          ...element.bounds,
          x: element.bounds.x + mutation.deltaX,
          y: element.bounds.y + mutation.deltaY,
        },
      };
      changed = true;
    }
    return changed ? updateDocument(document, { elements }) : document;
  }

  if (mutation.type === 'resize-element') {
    return mutateElement(document, mutation.elementId, (element) => {
      if (element.locked || element.constraints.lockDimensions) return element;
      const bounds = { ...element.bounds, ...mutation.bounds };
      if (element.constraints.lockAspectRatio && mutation.bounds.width && !mutation.bounds.height) {
        bounds.height = mutation.bounds.width * (element.bounds.height / element.bounds.width);
      }
      return { ...element, bounds };
    });
  }

  if (mutation.type === 'replace-asset') {
    return mutateElement(document, mutation.elementId, (element) => ({ ...element, assetId: mutation.assetId }));
  }

  if (mutation.type === 'set-lock') {
    return mutateElement(document, mutation.elementId, (element) => ({ ...element, locked: mutation.locked }));
  }

  if (mutation.type === 'update-element') {
    return mutateElement(document, mutation.elementId, (element) => ({
      ...element,
      ...mutation.patch,
      bounds: mutation.patch.bounds ? { ...element.bounds, ...mutation.patch.bounds } : element.bounds,
      constraints: mutation.patch.constraints ? { ...element.constraints, ...mutation.patch.constraints } : element.constraints,
      style: mutation.patch.style ? { ...element.style, ...mutation.patch.style } : element.style,
    }));
  }

  if (mutation.type === 'reorder-element') {
    const page = document.pages[mutation.pageId];
    if (!page || !page.elementIds.includes(mutation.elementId)) return document;
    const elementIds = page.elementIds.filter((id) => id !== mutation.elementId);
    elementIds.splice(Math.max(0, Math.min(mutation.index, elementIds.length)), 0, mutation.elementId);
    return updateDocument(document, {
      pages: { ...document.pages, [mutation.pageId]: { ...page, elementIds } },
    });
  }

  const deleteIds = new Set(mutation.elementIds);
  const elements = Object.fromEntries(
    Object.entries(document.elements).filter(([elementId]) => !deleteIds.has(elementId))
  );
  const pages = Object.fromEntries(
    Object.entries(document.pages).map(([pageId, page]) => [
      pageId,
      { ...page, elementIds: page.elementIds.filter((elementId) => !deleteIds.has(elementId)) },
    ])
  );
  return updateDocument(document, { elements, pages });
}

export function createCanvasHistory(document: CanvasDocument): CanvasDocumentHistory {
  return { future: [], past: [], present: cloneDocument(document) };
}

export function commitCanvasChange(
  history: CanvasDocumentHistory,
  mutation: CanvasMutation | CanvasMutation[]
): CanvasDocumentHistory {
  const mutations = Array.isArray(mutation) ? mutation : [mutation];
  const next = mutations.reduce(applyCanvasMutation, history.present);
  if (next === history.present) return history;
  return {
    future: [],
    past: [...history.past, cloneDocument(history.present)],
    present: next,
  };
}

export function undoCanvasChange(history: CanvasDocumentHistory): CanvasDocumentHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    future: [cloneDocument(history.present), ...history.future],
    past: history.past.slice(0, -1),
    present: cloneDocument(previous),
  };
}

export function redoCanvasChange(history: CanvasDocumentHistory): CanvasDocumentHistory {
  const next = history.future[0];
  if (!next) return history;
  return {
    future: history.future.slice(1),
    past: [...history.past, cloneDocument(history.present)],
    present: cloneDocument(next),
  };
}

export function saveCanvasVersion(
  document: CanvasDocument,
  id: string,
  name: string,
  author: string,
  note = ''
): CanvasSavedVersion {
  return {
    author,
    createdAt: new Date().toISOString(),
    document: cloneDocument(document),
    id,
    name,
    note,
    revision: document.revision,
  };
}

export function restoreCanvasVersion(version: CanvasSavedVersion): CanvasDocument {
  return cloneDocument(version.document);
}

function assetPreflightIssue(
  document: CanvasDocument,
  pageId: string,
  elementId: string,
  assetId: string,
  assetType: 'asset' | 'font'
): CanvasPreflightIssue | null {
  const asset = document.assets[assetId];
  if (!asset) {
    return {
      elementId,
      message: `Missing ${assetType} ${assetId}`,
      pageId,
      severity: 'error',
      type: assetType === 'font' ? 'missing-font' : 'missing-asset',
    };
  }
  if (isEmbeddedCanvasAsset(asset)) return null;
  return {
    elementId,
    message: `${assetType === 'font' ? 'Font' : 'Asset'} ${assetId} is not embedded`,
    pageId,
    severity: 'error',
    type: assetType === 'font' ? 'unembedded-font' : 'unembedded-asset',
  };
}

function elementExtendsBeyondPage(element: CanvasElement, page: CanvasPage): boolean {
  return element.bounds.x < 0
    || element.bounds.y < 0
    || element.bounds.x + element.bounds.width > page.width
    || element.bounds.y + element.bounds.height > page.height;
}

function textExceedsLineLimit(element: CanvasElement): boolean {
  if (element.kind !== 'text' || !element.textStyle?.maxLines) return false;
  return (element.content?.split('\n').length ?? 0) > element.textStyle.maxLines;
}

function elementPreflightIssues(
  document: CanvasDocument,
  page: CanvasPage,
  pageId: string,
  element: CanvasElement
): CanvasPreflightIssue[] {
  const issues: CanvasPreflightIssue[] = [];
  const addAssetIssue = (assetId: string, assetType: 'asset' | 'font') => {
    const issue = assetPreflightIssue(document, pageId, element.id, assetId, assetType);
    if (issue) issues.push(issue);
  };
  if (element.assetId) addAssetIssue(element.assetId, 'asset');
  if (element.textStyle?.fontId) addAssetIssue(element.textStyle.fontId, 'font');
  if (elementExtendsBeyondPage(element, page)) {
    issues.push({
      elementId: element.id,
      message: `${element.name} extends beyond the page`,
      pageId,
      severity: 'warning',
      type: 'clipped',
    });
  }
  if (textExceedsLineLimit(element)) {
    issues.push({
      elementId: element.id,
      message: `${element.name} exceeds its line limit`,
      pageId,
      severity: 'error',
      type: 'text-overflow',
    });
  }
  return issues;
}

export function preflightCanvasDocument(document: CanvasDocument): CanvasPreflightIssue[] {
  const issues: CanvasPreflightIssue[] = [];
  for (const pageId of document.pageIds) {
    const page = document.pages[pageId];
    if (!page) continue;
    for (const elementId of page.elementIds) {
      const element = document.elements[elementId];
      if (!element || element.hidden) continue;
      issues.push(...elementPreflightIssues(document, page, pageId, element));
    }
  }
  return issues;
}
