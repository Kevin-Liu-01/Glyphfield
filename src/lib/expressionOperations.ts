import type { BrandIdentity } from './brandIdentity';
import type { CanvasAsset, CanvasBounds, CanvasDocument, CanvasElement, CanvasJsonValue } from './canvasDocument';
import { isExpressionDevice } from './expressionDevices';
import {
  alignBounds,
  dataString,
  elementPageId,
  expressionAsset,
  insertElements,
  isColorRole,
  newExpressionElement,
  pageElements,
  pageSettings,
  patchElement,
  pruneAssets,
  readStringArray,
  resolveExpressionColor,
  roundBounds,
  slotElement,
  uniqueElementId,
  withAssets,
  type ExpressionAlignment,
  type ExpressionElementPatch,
  type ExpressionFontRole,
} from './expressionModel';
import { hashString, uploadedFontFamily } from './expressionSource';
import {
  brandLogoAsset,
  expressionColors,
  expressionFont,
  expressionRecipe,
  foregroundRole,
} from './expressionTemplates';
import { SHADER_LIBRARY_DEFAULT_IDS, shaderPreviewAssetPath } from './shaderLab';
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from './typography';

/** Layer operations shared by the editor UI and the Browser API. */

export const EXPRESSION_ADDABLE_LAYERS = ['text', 'image', 'logo', 'shape', 'divider', 'shader', 'texture', 'device'] as const;
export type ExpressionAddableLayer = (typeof EXPRESSION_ADDABLE_LAYERS)[number];

export type AddLayerInput = {
  bounds?: Partial<CanvasBounds>;
  content?: string;
  dataUrl?: string;
  device?: string;
  fileName?: string;
  fill?: string;
  kind: ExpressionAddableLayer;
  libraryAssetId?: string;
  materialId?: string;
  shape?: 'ellipse' | 'rect';
  variant?: 'mark' | 'wordmark';
};

function centered(page: { height: number; width: number }, width: number, height: number, bounds?: Partial<CanvasBounds>): CanvasBounds {
  return roundBounds({
    height: bounds?.height ?? height,
    rotation: bounds?.rotation ?? 0,
    width: bounds?.width ?? width,
    x: bounds?.x ?? (page.width - (bounds?.width ?? width)) / 2,
    y: bounds?.y ?? (page.height - (bounds?.height ?? height)) / 2,
  });
}

function scaleFor(page: { height: number; width: number }) {
  return Math.max(0.6, Math.sqrt((page.width * page.height) / (1200 * 630)));
}

type LayerBuild = { assets?: CanvasAsset[]; element: CanvasElement; underContent?: boolean };

type LayerContext = {
  fg: 'ink' | 'paper';
  id: string;
  identity: BrandIdentity;
  input: AddLayerInput;
  page: { height: number; width: number };
  s: number;
};

const COVER_TREATMENT = {
  blur: 0, crop: { height: 1, width: 1, x: 0, y: 0 }, dither: 0, focalPoint: { x: 0.5, y: 0.5 }, grain: 0, halation: 0, objectFit: 'cover' as const, posterize: 0, saturation: 1,
};

function bodyTextStyle(identity: BrandIdentity, fill: string, size: number) {
  const font = expressionFont(identity, 'Body');
  return {
    asset: font.asset,
    textStyle: {
      align: 'left' as const, casing: 'none' as const, color: resolveExpressionColor(fill, expressionColors(identity), '#000000'),
      fontFamily: font.family, fontId: font.asset.id, fontRole: 'Body' as const, fontSize: size, fontWeight: font.weight,
      letterSpacing: 0, lineHeight: 1.2, tokenBound: true,
    },
  };
}

function buildTextLayer({ fg, id, identity, input, page, s }: LayerContext): LayerBuild {
  const size = Math.round(32 * s);
  const fill = input.fill ?? fg;
  const { asset, textStyle } = bodyTextStyle(identity, fill, size);
  const base = newExpressionElement(id, 'Text', 'text', centered(page, page.width * 0.42, size * 2.6, input.bounds), { fill, fit: 'none', valign: 'top' });
  return { assets: [asset], element: { ...base, content: input.content ?? 'New text', textStyle } };
}

function libraryImage(identity: BrandIdentity, libraryAssetId: string | undefined) {
  if (libraryAssetId) return [...identity.assets, ...identity.proofAssets].find(({ id }) => id === libraryAssetId);
  return identity.assets.find(({ type }) => type === 'image' || type === 'product') ?? identity.assets.find(({ type }) => type === 'background');
}

function buildImageLayer({ id, identity, input, page }: LayerContext): LayerBuild {
  if (input.dataUrl && !/^data:image\//i.test(input.dataUrl)) throw new TypeError('dataUrl must be a data:image/* URL.');
  const library = input.dataUrl ? undefined : libraryImage(identity, input.libraryAssetId);
  const source = input.dataUrl ?? library?.path;
  if (!source) throw new TypeError('Add an image with dataUrl or a libraryAssetId from the identity.');
  const assetId = input.dataUrl ? `upload:${hashString(input.dataUrl)}` : `image:${library!.id}`;
  const name = input.fileName ?? library?.label ?? 'Image';
  const base = newExpressionElement(id, name, 'image', centered(page, page.width * 0.4, page.width * 0.3, input.bounds), {
    libraryAssetId: library?.id, styled: ['asset'], treatment: 'natural',
  });
  return { assets: [expressionAsset(assetId, name, source)], element: { ...base, assetId, imageTreatment: COVER_TREATMENT } };
}

function buildLogoLayer({ fg, id, identity, input, page, s }: LayerContext): LayerBuild {
  const library = input.libraryAssetId ? identity.assets.find(({ id: assetId }) => assetId === input.libraryAssetId) : null;
  let resolved: { asset: CanvasAsset; libraryId: string | null };
  if (library) resolved = { asset: expressionAsset(`logo:${library.id}`, library.label, library.path), libraryId: library.id };
  else if (input.dataUrl) resolved = { asset: expressionAsset(`upload:${hashString(input.dataUrl)}`, input.fileName ?? 'Logo', input.dataUrl), libraryId: null };
  else resolved = brandLogoAsset(identity, input.variant ?? 'mark', fg === 'paper');
  const size = Math.round(96 * s);
  const element = newExpressionElement(id, 'Logo', 'logo', centered(page, input.variant === 'wordmark' ? size * 3 : size, size, input.bounds), {
    align: 'center', libraryAssetId: resolved.libraryId ?? undefined, styled: ['asset'], tone: 'original',
  });
  return { assets: [resolved.asset], element: { ...element, assetId: resolved.asset.id } };
}

function buildShapeLayer({ id, input, page, s }: LayerContext): LayerBuild {
  return {
    element: newExpressionElement(id, input.shape === 'ellipse' ? 'Ellipse' : 'Rectangle', 'shape', centered(page, 240 * s, 160 * s, input.bounds), {
      fill: input.fill ?? 'emphasis', shape: input.shape ?? 'rect', strokeWidth: 0,
    }),
  };
}

function buildDividerLayer({ fg, id, input, page, s }: LayerContext): LayerBuild {
  const element = newExpressionElement(id, 'Divider', 'shape', centered(page, page.width * 0.4, 12, input.bounds), {
    fill: input.fill ?? fg, shape: 'line', strokeWidth: Math.max(1, Math.round(1.5 * s)),
  });
  return { element: { ...element, style: { ...element.style, opacity: 0.4 } } };
}

function buildShaderLayer({ id, input, page }: LayerContext): LayerBuild {
  const materialId = input.materialId ?? SHADER_LIBRARY_DEFAULT_IDS.surface;
  if (!/^[a-z0-9-]+$/.test(materialId)) throw new TypeError('materialId must be a Shader Library id from /api/materials.');
  const assetId = `shader:${materialId}`;
  const element = newExpressionElement(id, 'Shader background', 'shader', centered(page, page.width, page.height, input.bounds ?? { x: 0, y: 0 }), { materialId, tint: 'none' });
  return {
    assets: [expressionAsset(assetId, materialId, shaderPreviewAssetPath(materialId as typeof SHADER_LIBRARY_DEFAULT_IDS.surface))],
    element: { ...element, assetId, imageTreatment: COVER_TREATMENT },
    underContent: true,
  };
}

function buildTextureLayer({ fg, id, input, page, s }: LayerContext): LayerBuild {
  const element = newExpressionElement(id, 'Texture', 'texture', centered(page, page.width, page.height, input.bounds ?? { x: 0, y: 0 }), {
    fill: input.fill ?? fg, spacing: Math.round(40 * s), texture: 'grid',
  });
  return { element: { ...element, style: { ...element.style, opacity: 0.12 } }, underContent: true };
}

function buildDeviceLayer({ id, identity, input, page }: LayerContext): LayerBuild {
  const device = input.device ?? expressionRecipe(identity).device;
  if (!isExpressionDevice(device)) throw new TypeError('device must be one of the brand devices.');
  const { asset, textStyle } = bodyTextStyle(identity, '#FFFFFF', 16);
  const element = newExpressionElement(id, 'Brand device', 'component', centered(page, page.width * 0.45, page.height * 0.6, input.bounds), { component: 'device', device });
  return { assets: [asset], element: { ...element, textStyle: { ...textStyle, fontWeight: 450, lineHeight: 1.4 } } };
}

const LAYER_BUILDERS: Record<ExpressionAddableLayer, (context: LayerContext) => LayerBuild> = {
  device: buildDeviceLayer,
  divider: buildDividerLayer,
  image: buildImageLayer,
  logo: buildLogoLayer,
  shader: buildShaderLayer,
  shape: buildShapeLayer,
  text: buildTextLayer,
  texture: buildTextureLayer,
};

export function addExpressionLayer(
  document: CanvasDocument,
  pageId: string,
  input: AddLayerInput,
  identity: BrandIdentity
): { document: CanvasDocument; id: string } {
  const page = document.pages[pageId];
  if (!page) throw new RangeError(`Unknown page ${pageId}.`);
  const builder = LAYER_BUILDERS[input.kind];
  if (!builder) throw new TypeError(`kind must be one of ${EXPRESSION_ADDABLE_LAYERS.join(', ')}.`);
  const id = uniqueElementId(document, `${pageId}:${input.kind}`);
  const built = builder({
    fg: foregroundRole(identity, pageSettings(document, pageId).surface),
    id,
    identity,
    input,
    page,
    s: scaleFor(page),
  });
  const index = built.underContent ? (slotElement(document, pageId, 'background') ? 1 : 0) : undefined;
  return { document: insertElements(withAssets(document, built.assets ?? []), pageId, [built.element], index), id };
}

export type UpdateLayerInput = {
  align?: 'center' | 'left' | 'right';
  bounds?: Partial<CanvasBounds>;
  casing?: 'lowercase' | 'none' | 'uppercase';
  content?: string;
  data?: Record<string, CanvasJsonValue | undefined>;
  fill?: string;
  fontRole?: ExpressionFontRole;
  fontSize?: number;
  fontWeight?: number;
  hidden?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  locked?: boolean;
  name?: string;
  opacity?: number;
  radius?: number;
};

function finite(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  return Math.max(min, Math.min(max, value));
}

function validColor(value: string): boolean {
  return value === 'none' || isColorRole(value) || /^#[0-9a-f]{6}$/i.test(value);
}

type TypographyField = {
  key: 'fontSize' | 'fontWeight' | 'letterSpacing' | 'lineHeight';
  max: number;
  min: number;
  styled: string;
};

const TYPOGRAPHY_FIELDS: readonly TypographyField[] = [
  { key: 'fontSize', max: 1200, min: 4, styled: 'size' },
  { key: 'fontWeight', max: MAX_VISIBLE_FONT_WEIGHT, min: 100, styled: 'weight' },
  { key: 'letterSpacing', max: 0.5, min: -0.2, styled: 'tracking' },
  { key: 'lineHeight', max: 3, min: 0.6, styled: 'lineHeight' },
];

const CHOICE_FIELDS = {
  align: ['center', 'left', 'right'],
  casing: ['lowercase', 'none', 'uppercase'],
} as const;

/** Data keys that mean "a person chose this", mapped to the style key layouts must keep. */
const STYLED_DATA_KEYS: Readonly<Record<string, string>> = {
  chrome: 'chrome', device: 'asset', fit: 'fit', shape: 'shape', theme: 'chrome', tone: 'tone', treatment: 'asset', valign: 'valign',
};

type PatchDraft = {
  data: Record<string, CanvasJsonValue | undefined>;
  document: CanvasDocument;
  patch: ExpressionElementPatch;
  styled: Set<string>;
  textStyle: NonNullable<ExpressionElementPatch['textStyle']>;
};

function applyLayerBasics(draft: PatchDraft, element: CanvasElement, input: UpdateLayerInput) {
  if (input.name !== undefined) draft.patch.name = input.name.slice(0, 80) || element.name;
  if (input.content !== undefined) {
    if (element.kind !== 'text') throw new TypeError('content applies to text layers.');
    draft.patch.content = input.content;
  }
  if (input.bounds) {
    draft.patch.bounds = Object.fromEntries(Object.entries(input.bounds).map(([key, value]) => [key, finite(value, `bounds.${key}`, -100_000, 100_000)]));
  }
  if (input.hidden !== undefined) draft.patch.hidden = Boolean(input.hidden);
  if (input.locked !== undefined) draft.patch.locked = Boolean(input.locked);
  if (input.opacity !== undefined) {
    draft.patch.style = { ...draft.patch.style, opacity: finite(input.opacity, 'opacity', 0, 1) };
    draft.styled.add('opacity');
  }
  if (input.radius !== undefined) {
    draft.patch.style = { ...draft.patch.style, borderRadius: finite(input.radius, 'radius', 0, 2000) };
    draft.styled.add('radius');
  }
}

function applyLayerFill(draft: PatchDraft, element: CanvasElement, input: UpdateLayerInput, identity: BrandIdentity) {
  if (input.fill === undefined) return;
  if (!validColor(input.fill)) throw new TypeError('fill must be a brand color role, #RRGGBB, or none.');
  draft.data.fill = input.fill;
  draft.styled.add('fill');
  if (element.textStyle) draft.textStyle.color = resolveExpressionColor(input.fill, expressionColors(identity), element.textStyle.color);
}

function applyLayerTypography(draft: PatchDraft, input: UpdateLayerInput, identity: BrandIdentity) {
  if (input.fontRole !== undefined) {
    if (!identity.typography.some(({ role }) => role === input.fontRole)) throw new TypeError('Unknown typography role.');
    const font = expressionFont(identity, input.fontRole);
    draft.document = withAssets(draft.document, [font.asset]);
    Object.assign(draft.textStyle, { fontFamily: font.family, fontId: font.asset.id, fontRole: input.fontRole });
    if (input.fontWeight === undefined) draft.textStyle.fontWeight = font.weight;
    draft.styled.add('role');
  }
  for (const field of TYPOGRAPHY_FIELDS) {
    const value = input[field.key];
    if (value === undefined) continue;
    const resolved = finite(value, field.key, field.min, field.max);
    draft.textStyle[field.key] = field.key === 'fontWeight' ? capVisibleFontWeight(resolved) : resolved;
    draft.styled.add(field.styled);
  }
  for (const [key, allowed] of Object.entries(CHOICE_FIELDS) as [keyof typeof CHOICE_FIELDS, readonly string[]][]) {
    const value = input[key];
    if (value === undefined) continue;
    if (!allowed.includes(value)) throw new TypeError(`${key} must be one of ${allowed.join(', ')}.`);
    Object.assign(draft.textStyle, { [key]: value });
    draft.styled.add(key);
  }
}

export function updateExpressionLayer(
  document: CanvasDocument,
  elementId: string,
  input: UpdateLayerInput,
  identity: BrandIdentity
): CanvasDocument {
  const element = document.elements[elementId];
  if (!element) throw new RangeError(`Unknown layer ${elementId}.`);
  const draft: PatchDraft = {
    data: { ...input.data },
    document,
    patch: {},
    styled: new Set(readStringArray(element, 'styled')),
    textStyle: {},
  };
  applyLayerBasics(draft, element, input);
  applyLayerFill(draft, element, input, identity);
  applyLayerTypography(draft, input, identity);
  if (Object.keys(draft.textStyle).length > 0) {
    if (!element.textStyle) throw new TypeError('Typography applies to text and code layers.');
    draft.patch.textStyle = draft.textStyle;
  }
  for (const [key, styledKey] of Object.entries(STYLED_DATA_KEYS)) {
    if (draft.data[key] !== undefined) draft.styled.add(styledKey);
  }
  if (draft.styled.size > 0) draft.data.styled = [...draft.styled];
  if (Object.keys(draft.data).length > 0) draft.patch.data = draft.data;
  return pruneAssets(patchElement(draft.document, elementId, draft.patch));
}

export function setLayerAsset(
  document: CanvasDocument,
  elementId: string,
  asset: { libraryAssetId?: string; name: string; source: string; prefix: 'image' | 'logo' | 'partner' | 'shader' | 'upload' }
): CanvasDocument {
  const element = document.elements[elementId];
  if (!element) return document;
  const assetId = asset.prefix === 'upload' ? `upload:${hashString(asset.source)}` : `${asset.prefix}:${asset.libraryAssetId}`;
  const styled = new Set([...readStringArray(element, 'styled'), 'asset']);
  return pruneAssets(patchElement(withAssets(document, [expressionAsset(assetId, asset.name, asset.source)]), elementId, {
    assetId,
    data: { libraryAssetId: asset.libraryAssetId, styled: [...styled] },
  }));
}

export function setUploadedFont(document: CanvasDocument, elementId: string, file: { name: string; url: string }): CanvasDocument {
  const element = document.elements[elementId];
  if (!element?.textStyle) return document;
  const assetId = `font:upload-${hashString(file.url)}`;
  const styled = new Set([...readStringArray(element, 'styled'), 'role']);
  return pruneAssets(patchElement(withAssets(document, [expressionAsset(assetId, file.name, file.url, 'font')]), elementId, {
    data: { styled: [...styled] },
    textStyle: { fontFamily: uploadedFontFamily(assetId), fontId: assetId },
  }));
}

export function alignExpressionLayers(document: CanvasDocument, elementIds: readonly string[], alignment: ExpressionAlignment): CanvasDocument {
  let next = document;
  for (const id of elementIds) {
    const element = next.elements[id];
    const pageId = elementPageId(next, id);
    if (!element || !pageId || element.locked) continue;
    next = patchElement(next, id, { bounds: alignBounds(element.bounds, next.pages[pageId]!, alignment) });
  }
  return next;
}

export function moveExpressionLayers(document: CanvasDocument, elementIds: readonly string[], dx: number, dy: number): CanvasDocument {
  let next = document;
  for (const id of elementIds) {
    const element = next.elements[id];
    if (!element || element.locked) continue;
    next = patchElement(next, id, { bounds: { x: element.bounds.x + dx, y: element.bounds.y + dy } });
  }
  return next;
}

export function describeExpressionDocument(document: CanvasDocument) {
  return document.pageIds.map((pageId, index) => {
    const page = document.pages[pageId]!;
    const settings = pageSettings(document, pageId);
    return {
      height: page.height,
      id: pageId,
      index,
      layers: [...pageElements(document, pageId)].reverse().map((element) => ({
        bounds: element.bounds,
        component: element.kind === 'component' ? dataString(element, 'component') : undefined,
        content: element.kind === 'text' ? element.content : undefined,
        hidden: element.hidden,
        id: element.id,
        kind: element.kind,
        locked: element.locked,
        name: element.name,
        slot: dataString(element, 'slot') || undefined,
      })),
      layout: settings.layout,
      name: page.name,
      notes: page.notes,
      surface: settings.surface,
      width: page.width,
    };
  });
}
