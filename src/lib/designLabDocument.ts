import {
  asCanvasJsonObject as objectValue,
  canvasJsonBoolean as booleanValue,
  canvasJsonNumber as numberValue,
  canvasJsonString as stringValue,
  createCanvasDocument,
  createCanvasElement,
  createEmbeddedCanvasAsset,
  insertCanvasElement,
  inferCanvasAssetMimeType,
  parseCanvasDocument,
  registerCanvasAsset,
  serializeCanvasDocument,
  toCanvasJsonObject,
  toCanvasJsonValue,
  type CanvasAsset,
  type CanvasDocument,
  type CanvasElement,
  type CanvasElementKind,
  type CanvasJsonObject,
  type CanvasJsonValue,
} from './canvasDocument';

const DESIGN_LAB_SOURCE_VERSION = 3;
const DESIGN_LAB_METADATA_KEY = 'designLab';

type DesignLabLayerType = 'asset' | 'effect' | 'logo' | 'shader' | 'text';

export type DesignLabDocumentInput = {
  assets: readonly object[];
  backgroundColor: string;
  brandId: string;
  createdAt: string;
  effectLayers: readonly object[];
  exportSettings: object;
  groups: readonly object[];
  id: string;
  layerOrder: readonly string[];
  layerShaders: object;
  logos: readonly object[];
  ratio: string;
  revision: number;
  shaderLayers: readonly object[];
  shaderSequence: object;
  textLayers: readonly object[];
  timeline: object;
  title: string;
  updatedAt: string;
  width: number;
  height: number;
};

export type DesignLabLayerOrderInput = {
  assets: readonly string[];
  effects: readonly string[];
  logos: readonly string[];
  shaders: readonly string[];
  stored: readonly string[];
  text: readonly string[];
};

export type DesignLabLayerGroup = {
  id: string;
  layerIds: string[];
  name: string;
};

export function reconcileDesignLabLayerGroups(
  groups: readonly DesignLabLayerGroup[],
  validLayerIds: readonly string[]
): DesignLabLayerGroup[] {
  const validIds = new Set(validLayerIds);
  const claimedIds = new Set<string>();
  return groups.flatMap((group) => {
    const layerIds = group.layerIds.filter((id) => {
      if (!validIds.has(id) || claimedIds.has(id)) return false;
      claimedIds.add(id);
      return true;
    });
    return layerIds.length >= 2 ? [{ ...group, layerIds }] : [];
  });
}

/**
 * Keeps the authored stacking order while removing stale ids and inserting new
 * layers deterministically. Shader layers always remain behind content so the
 * same order can be consumed by the live canvas, source document, and export.
 */
export function reconcileDesignLabLayerOrder({
  assets,
  effects,
  logos,
  shaders,
  stored,
  text,
}: DesignLabLayerOrderInput): string[] {
  const shaderIds = new Set(shaders);
  const validIds = new Set([...shaders, ...effects, ...text, ...logos, ...assets]);
  const retainedIds = new Set<string>();
  const retained = stored.filter((id) => {
    if (!validIds.has(id) || retainedIds.has(id)) return false;
    retainedIds.add(id);
    return true;
  });
  const missingShaders = shaders.filter((id) => !retainedIds.has(id));
  missingShaders.forEach((id) => retainedIds.add(id));
  const firstContentIndex = retained.findIndex((id) => !shaderIds.has(id));
  const shaderInsertionIndex = firstContentIndex < 0 ? retained.length : firstContentIndex;
  const next = [
    ...retained.slice(0, shaderInsertionIndex),
    ...missingShaders,
    ...retained.slice(shaderInsertionIndex),
  ];
  for (const id of [...text, ...logos, ...assets, ...effects]) {
    if (retainedIds.has(id)) continue;
    retainedIds.add(id);
    next.push(id);
  }
  return next;
}

function jsonValue(value: object): CanvasJsonValue {
  return toCanvasJsonValue(value, 'Design Lab data');
}

function layerTransform(layer: CanvasJsonObject) {
  const transform = objectValue(layer.transform);
  const scale = numberValue(transform?.scale, 1);
  return {
    height: numberValue(transform?.heightScale, scale),
    rotation: numberValue(transform?.rotation, 0),
    width: numberValue(transform?.widthScale, scale),
    x: numberValue(transform?.x, 0),
    y: numberValue(transform?.y, 0),
  };
}

function layerKind(type: DesignLabLayerType): CanvasElementKind {
  if (type === 'asset') return 'image';
  if (type === 'effect') return 'effect';
  return type;
}

function layerAssetId(type: DesignLabLayerType, layer: CanvasJsonObject): string | undefined {
  if (type !== 'asset' && type !== 'logo') return undefined;
  const id = stringValue(layer.id, '');
  const libraryAssetId = type === 'asset' ? stringValue(layer.libraryAssetId, '') : '';
  return libraryAssetId ? `brand-asset:${libraryAssetId}` : `resource:${id}`;
}

function assetFromLayer(layer: CanvasJsonObject, type: DesignLabLayerType): CanvasAsset | null {
  const id = stringValue(layer.id, '');
  const source = stringValue(layer.url, '');
  const assetId = layerAssetId(type, layer);
  if (!assetId || !id || !source) return null;
  const name = stringValue(layer.name, type === 'logo' ? 'Brand mark' : 'Image');
  if (/^data:/i.test(source)) {
    return createEmbeddedCanvasAsset({ id: assetId, kind: 'image', name, source });
  }
  return {
    byteLength: 0,
    id: assetId,
    kind: 'image',
    mimeType: inferCanvasAssetMimeType(source, type === 'logo' ? 'image/svg+xml' : undefined),
    name,
    source,
  };
}

function elementFromLayer(
  layer: CanvasJsonObject,
  type: DesignLabLayerType,
  width: number,
  height: number
): CanvasElement {
  const id = stringValue(layer.id, '');
  if (!id) throw new TypeError(`A ${type} layer is missing its id.`);
  const bounds = type === 'effect'
    ? { height, rotation: 0, width, x: 0, y: 0 }
    : layerTransform(layer);
  const element = createCanvasElement(
    id,
    stringValue(layer.name, type[0]!.toLocaleUpperCase() + type.slice(1)),
    layerKind(type),
    bounds
  );
  const blendMode = stringValue(layer.blendMode, 'normal');
  return {
    ...element,
    assetId: layerAssetId(type, layer),
    content: type === 'text' ? stringValue(layer.value, '') : undefined,
    data: { ...layer, layerType: type },
    hidden: !booleanValue(layer.visible, true),
    style: {
      ...element.style,
      blendMode: ['multiply', 'normal', 'overlay', 'screen'].includes(blendMode)
        ? blendMode as CanvasElement['style']['blendMode']
        : 'normal',
      opacity: numberValue(layer.opacity, 1),
    },
  };
}

function layerEntries(input: DesignLabDocumentInput) {
  const entries: Array<[DesignLabLayerType, CanvasJsonObject]> = [];
  const append = (type: DesignLabLayerType, values: readonly object[]) => {
    values.forEach((value) => entries.push([type, toCanvasJsonObject(value, `${type} layer`)]));
  };
  append('shader', input.shaderLayers);
  append('effect', input.effectLayers);
  append('text', input.textLayers);
  append('logo', input.logos);
  append('asset', input.assets);
  return entries;
}

export function createDesignLabCanvasDocument(input: DesignLabDocumentInput): CanvasDocument {
  let document = createCanvasDocument(
    input.id,
    input.brandId,
    input.title,
    input.width,
    input.height,
    ['animation', 'assets', 'constraints', 'guides', 'history', 'layers', 'pages', 'text']
  );
  const pageId = document.pageIds[0]!;
  const entries = layerEntries(input);
  const byId = new Map(entries.map((entry) => [stringValue(entry[1].id, ''), entry]));
  for (const layerId of input.layerOrder) {
    const entry = byId.get(layerId);
    if (!entry) continue;
    const [type, layer] = entry;
    const asset = assetFromLayer(layer, type);
    if (asset) document = registerCanvasAsset(document, asset);
    document = insertCanvasElement(
      document,
      pageId,
      elementFromLayer(layer, type, input.width, input.height)
    );
  }
  const page = document.pages[pageId]!;
  return {
    ...document,
    createdAt: input.createdAt,
    metadata: {
      [DESIGN_LAB_METADATA_KEY]: {
        exportSettings: jsonValue(input.exportSettings),
        groups: input.groups.map((group) => jsonValue(group)),
        layerShaders: jsonValue(input.layerShaders),
        ratio: input.ratio,
        shaderSequence: jsonValue(input.shaderSequence),
        sourceVersion: DESIGN_LAB_SOURCE_VERSION,
        timeline: jsonValue(input.timeline),
      },
      tool: 'design-lab',
    },
    pages: {
      ...document.pages,
      [pageId]: { ...page, background: input.backgroundColor },
    },
    revision: input.revision,
    updatedAt: input.updatedAt,
  };
}

function restoredTransform(element: CanvasElement): CanvasJsonObject {
  const previous = objectValue(element.data.transform) ?? {};
  const previousScale = numberValue(previous.scale, 1);
  const hadHeightScale = typeof previous.heightScale === 'number';
  const hadWidthScale = typeof previous.widthScale === 'number';
  const uniformScale = !hadHeightScale
    && !hadWidthScale
    && Math.abs(element.bounds.height - element.bounds.width) < 0.000_001;
  const transform: CanvasJsonObject = {
    ...previous,
    scale: uniformScale ? (element.bounds.height + element.bounds.width) / 2 : previousScale,
    x: element.bounds.x,
    y: element.bounds.y,
  };
  if (!uniformScale && (hadHeightScale || Math.abs(element.bounds.height - previousScale) >= 0.000_001)) {
    transform.heightScale = element.bounds.height;
  } else {
    delete transform.heightScale;
  }
  if (!uniformScale && (hadWidthScale || Math.abs(element.bounds.width - previousScale) >= 0.000_001)) {
    transform.widthScale = element.bounds.width;
  } else {
    delete transform.widthScale;
  }
  return transform;
}

function restoreLayer(document: CanvasDocument, element: CanvasElement): {
  source: CanvasJsonObject;
  type: DesignLabLayerType;
} {
  const layer = { ...element.data };
  const layerType = stringValue(layer.layerType, '') as DesignLabLayerType;
  delete layer.layerType;
  layer.id = element.id;
  layer.name = element.name;
  layer.opacity = element.style.opacity;
  layer.visible = !element.hidden;
  if (layerType === 'shader') layer.blendMode = element.style.blendMode;
  if (layerType === 'text') layer.value = element.content ?? '';
  if (layerType === 'asset' || layerType === 'logo' || layerType === 'shader' || layerType === 'text') {
    layer.transform = restoredTransform(element);
  }
  if (element.assetId && document.assets[element.assetId]) {
    layer.url = document.assets[element.assetId]!.source;
  }
  return { source: layer, type: layerType };
}

export function designLabSourceFromCanvasDocument(document: CanvasDocument): CanvasJsonObject {
  const metadata = objectValue(document.metadata[DESIGN_LAB_METADATA_KEY]);
  if (document.metadata.tool !== 'design-lab' || !metadata) {
    throw new TypeError('This canvas document is not a Design Lab composition.');
  }
  const pageId = document.pageIds[0];
  const page = pageId ? document.pages[pageId] : undefined;
  if (!page) throw new TypeError('The Design Lab canvas page is missing.');
  const sourcesByType: Record<DesignLabLayerType, CanvasJsonObject[]> = {
    asset: [],
    effect: [],
    logo: [],
    shader: [],
    text: [],
  };
  page.elementIds.forEach((elementId) => {
    const element = document.elements[elementId];
    if (!element) return;
    const layer = restoreLayer(document, element);
    sourcesByType[layer.type].push(layer.source);
  });
  return {
    composition: {
      assets: sourcesByType.asset,
      backgroundColor: page.background,
      effectLayers: sourcesByType.effect,
      groups: Array.isArray(metadata.groups) ? metadata.groups : [],
      layerOrder: [...page.elementIds],
      layerShaders: objectValue(metadata.layerShaders) ?? {},
      logos: sourcesByType.logo,
      shaderLayers: sourcesByType.shader,
      textLayers: sourcesByType.text,
    },
    exportSettings: objectValue(metadata.exportSettings) ?? {},
    ratio: stringValue(metadata.ratio, 'wide'),
    shaderSequence: objectValue(metadata.shaderSequence) ?? {},
    timeline: objectValue(metadata.timeline) ?? {},
    version: DESIGN_LAB_SOURCE_VERSION,
  };
}

export function serializeDesignLabCanvasDocument(input: DesignLabDocumentInput): string {
  return serializeExistingDesignLabCanvasDocument(createDesignLabCanvasDocument(input));
}

export function serializeExistingDesignLabCanvasDocument(document: CanvasDocument): string {
  return serializeCanvasDocument(document);
}

export function withDesignLabTimeline(
  document: CanvasDocument,
  timeline: object,
  revision: number
): CanvasDocument {
  const metadata = objectValue(document.metadata[DESIGN_LAB_METADATA_KEY]);
  if (!metadata) throw new TypeError('The Design Lab metadata is missing.');
  return {
    ...document,
    metadata: {
      ...document.metadata,
      [DESIGN_LAB_METADATA_KEY]: {
        ...metadata,
        timeline: jsonValue(timeline),
      },
    },
    revision,
  };
}

export function parseDesignLabCanvasDocument(source: string): CanvasJsonObject {
  return designLabSourceFromCanvasDocument(parseCanvasDocument(source));
}
