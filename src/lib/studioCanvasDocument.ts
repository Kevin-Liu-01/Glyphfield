import {
  asCanvasJsonObject as objectValue,
  createCanvasDocument,
  createCanvasElement,
  createEmbeddedCanvasAsset,
  inferCanvasAssetMimeType,
  parseCanvasDocument,
  serializeCanvasDocument,
  toCanvasJsonObject,
  toCanvasJsonValue,
  type CanvasAssetKind,
  type CanvasBounds,
  type CanvasDocument,
  type CanvasElementKind,
  type CanvasJsonObject,
  type CanvasJsonValue,
} from './canvasDocument';

const STUDIO_METADATA_KEY = 'studio';

type StudioCanvasLayer = {
  asset?: {
    kind?: CanvasAssetKind;
    name: string;
    source: string;
  };
  bounds: CanvasBounds;
  content?: string;
  data?: object;
  hidden?: boolean;
  id: string;
  kind: CanvasElementKind;
  name: string;
  opacity?: number;
};

export type StudioCanvasDocumentInput = {
  background: string;
  brandId: string;
  createdAt: string;
  height: number;
  id: string;
  layers: readonly StudioCanvasLayer[];
  revision: number;
  state: object;
  title: string;
  toolId: string;
  updatedAt: string;
  width: number;
};

function jsonValue(value: unknown): CanvasJsonValue {
  return toCanvasJsonValue(value, 'Studio state');
}

export function createStudioCanvasDocument(input: StudioCanvasDocumentInput): CanvasDocument {
  const base = createCanvasDocument(
    input.id,
    input.brandId,
    input.title,
    input.width,
    input.height,
    ['animation', 'assets', 'constraints', 'history', 'layers', 'pages', 'text']
  );
  const pageId = base.pageIds[0]!;
  const elements: CanvasDocument['elements'] = {};
  const assets: CanvasDocument['assets'] = {};
  const elementIds: string[] = [];

  for (const layer of input.layers) {
    if (elements[layer.id]) throw new TypeError(`Studio layer ${layer.id} is duplicated.`);
    const element = createCanvasElement(layer.id, layer.name, layer.kind, layer.bounds);
    const layerAsset = layer.asset;
    const assetId = layerAsset ? `resource:${layer.id}` : undefined;
    if (layerAsset && assetId) {
      assets[assetId] = /^data:/i.test(layerAsset.source)
        ? createEmbeddedCanvasAsset({
            id: assetId,
            kind: layerAsset.kind ?? 'image',
            name: layerAsset.name,
            source: layerAsset.source,
          })
        : {
            byteLength: 0,
            id: assetId,
            kind: layerAsset.kind ?? 'image',
            mimeType: inferCanvasAssetMimeType(layerAsset.source),
            name: layerAsset.name,
            source: layerAsset.source,
          };
    }
    elements[layer.id] = {
      ...element,
      assetId,
      content: layer.content,
      data: toCanvasJsonObject(layer.data ?? {}, `${layer.name} layer data`),
      hidden: layer.hidden ?? false,
      style: { ...element.style, opacity: layer.opacity ?? 1 },
    };
    elementIds.push(layer.id);
  }

  return {
    ...base,
    assets,
    createdAt: input.createdAt,
    elements,
    metadata: {
      [STUDIO_METADATA_KEY]: {
        sourceVersion: 1,
        state: jsonValue(input.state),
        toolId: input.toolId,
      },
      tool: input.toolId,
    },
    pages: {
      [pageId]: {
        ...base.pages[pageId]!,
        background: input.background,
        elementIds,
      },
    },
    revision: input.revision,
    updatedAt: input.updatedAt,
  };
}

export function studioCanvasStateFromDocument(
  document: CanvasDocument,
  expectedToolId?: string
): CanvasJsonObject {
  const metadata = objectValue(document.metadata[STUDIO_METADATA_KEY]);
  const toolId = metadata?.toolId;
  if (!metadata || typeof toolId !== 'string' || (expectedToolId && toolId !== expectedToolId)) {
    throw new TypeError(`This canvas document is not a ${expectedToolId ?? 'studio'} document.`);
  }
  const state = objectValue(metadata.state);
  if (!state) throw new TypeError('Studio document state is missing.');
  return state;
}

export function serializeStudioCanvasDocument(document: CanvasDocument): string {
  return serializeCanvasDocument(document);
}

export function parseStudioCanvasDocument(source: string, expectedToolId?: string): {
  document: CanvasDocument;
  state: CanvasJsonObject;
} {
  const document = parseCanvasDocument(source);
  return { document, state: studioCanvasStateFromDocument(document, expectedToolId) };
}
