import {
  asCanvasJsonObject as objectValue,
  canvasJsonNumber as numberValue,
  canvasJsonString as stringValue,
  createCanvasDocument,
  createCanvasElement,
  createCanvasPage,
  createEmbeddedCanvasAsset,
  inferCanvasAssetMimeType,
  parseCanvasDocument,
  serializeCanvasDocument,
  toCanvasJsonObject as jsonObject,
  toCanvasJsonValue,
  type CanvasAsset,
  type CanvasDocument,
  type CanvasJsonObject,
  type CanvasJsonValue,
} from './canvasDocument';
import type { StudioSource } from './renderFrame';

const ANIMATION_METADATA_KEY = 'animation';

export type AnimationDocumentState = {
  backgroundOverrides: object;
  frameSettings: object;
  includeBrandLogo: boolean;
  mode: string;
  playbackRate: number;
  sequenceBackground: object;
  sequenceOrder: readonly string[];
  settings: object;
  textFrames: string;
};

export type AnimationDocumentInput = {
  brandId: string;
  createdAt: string;
  id: string;
  revision: number;
  sources: readonly StudioSource[];
  state: AnimationDocumentState;
  title: string;
  updatedAt: string;
};

export type AnimationDocumentAsset = {
  assetId: string;
  height: number;
  id: string;
  name: string;
  source: string;
  width: number;
};

function jsonValue(value: unknown): CanvasJsonValue {
  return toCanvasJsonValue(value, 'Animation data');
}

function imageAsset(source: Extract<StudioSource, { kind: 'image' }>): CanvasAsset | null {
  if (!source.url) return null;
  const id = `animation:${source.id}`;
  if (/^data:/i.test(source.url)) {
    return createEmbeddedCanvasAsset({ id, kind: 'image', name: source.name, source: source.url });
  }
  return {
    byteLength: 0,
    id,
    kind: 'image',
    mimeType: inferCanvasAssetMimeType(source.url),
    name: source.name,
    source: source.url,
  };
}

function sourceData(source: StudioSource): CanvasJsonObject {
  const background = source.background
    ? { ...source.background, image: undefined }
    : undefined;
  if (source.kind === 'text') {
    return jsonObject({ ...source, background, text: undefined }, 'Animation text frame');
  }
  return jsonObject({
    ...source,
    assetId: `animation:${source.id}`,
    background,
    image: undefined,
    url: undefined,
  }, 'Animation image frame');
}

function sourceBounds(source: StudioSource, width: number, height: number) {
  const anchorX = width * (((source.alignX ?? 0) + 1) / 2);
  const anchorY = height * (((source.alignY ?? 0) + 1) / 2);
  const scale = source.scale ?? 1;
  const base = source.kind === 'text'
    ? {
        height: Math.min(height * 0.72, (source.fontSize ?? 108) * 1.18),
        width: Math.min(width * 0.84, Math.max(1, Array.from(source.text).length) * (source.fontSize ?? 108) * 0.62),
      }
    : (() => {
        const ratio = source.width / Math.max(1, source.height);
        const availableWidth = width * 0.78;
        const availableHeight = height * 0.74;
        const fittedWidth = (source.fit ?? 'contain') === 'cover'
          ? Math.max(availableWidth, availableHeight * ratio)
          : Math.min(availableWidth, availableHeight * ratio);
        return { height: fittedWidth / ratio, width: fittedWidth };
      })();
  return {
    height: base.height * scale,
    rotation: source.rotation ?? 0,
    width: base.width * scale,
    x: anchorX - (base.width * scale) / 2,
    y: anchorY - (base.height * scale) / 2,
  };
}

export function createAnimationCanvasDocument(input: AnimationDocumentInput): CanvasDocument {
  const settings = jsonObject(input.state.settings, 'Animation settings');
  const canvasWidth = numberValue(settings.width, 1000);
  const canvasHeight = numberValue(settings.height, 300);
  const base = createCanvasDocument(
    input.id,
    input.brandId,
    input.title,
    canvasWidth,
    canvasHeight,
    ['animation', 'assets', 'history', 'layers', 'pages', 'text']
  );
  const assets: Record<string, CanvasAsset> = {};
  const elements: CanvasDocument['elements'] = {};
  const pages: CanvasDocument['pages'] = {};
  const pageIds: string[] = [];

  for (const source of input.sources) {
    const pageId = `${input.id}:frame:${source.id}`;
    const background = source.background?.colorA ?? stringValue(settings.background, '#000000');
    const page = createCanvasPage(pageId, source.kind === 'text' ? source.text : source.name, canvasWidth, canvasHeight, background);
    const element = createCanvasElement(
      source.id,
      source.kind === 'text' ? source.text : source.name,
      source.kind,
      sourceBounds(source, canvasWidth, canvasHeight)
    );
    const asset = source.kind === 'image' ? imageAsset(source) : null;
    if (asset) assets[asset.id] = asset;
    elements[element.id] = {
      ...element,
      assetId: asset?.id,
      content: source.kind === 'text' ? source.text : undefined,
      data: sourceData(source),
      style: { ...element.style, opacity: source.opacity ?? 1 },
    };
    pages[pageId] = { ...page, elementIds: [element.id] };
    pageIds.push(pageId);
  }

  return {
    ...base,
    assets,
    createdAt: input.createdAt,
    elements,
    metadata: {
      [ANIMATION_METADATA_KEY]: jsonValue(input.state),
      tool: 'animation-studio',
    },
    pageIds,
    pages,
    revision: input.revision,
    updatedAt: input.updatedAt,
  };
}

export function animationStateFromCanvasDocument(document: CanvasDocument): AnimationDocumentState {
  const metadata = objectValue(document.metadata[ANIMATION_METADATA_KEY]);
  if (document.metadata.tool !== 'animation-studio' || !metadata) {
    throw new TypeError('This canvas document is not an Animation Studio scene.');
  }
  const sequenceOrder = Array.isArray(metadata.sequenceOrder)
    ? metadata.sequenceOrder.filter((value): value is string => typeof value === 'string')
    : [];
  return {
    backgroundOverrides: objectValue(metadata.backgroundOverrides) ?? {},
    frameSettings: objectValue(metadata.frameSettings) ?? {},
    includeBrandLogo: metadata.includeBrandLogo === true,
    mode: stringValue(metadata.mode, 'sequence'),
    playbackRate: numberValue(metadata.playbackRate, 1),
    sequenceBackground: objectValue(metadata.sequenceBackground) ?? {},
    sequenceOrder,
    settings: objectValue(metadata.settings) ?? {},
    textFrames: stringValue(metadata.textFrames, ''),
  };
}

export function animationAssetsFromCanvasDocument(document: CanvasDocument): AnimationDocumentAsset[] {
  return document.pageIds.flatMap((pageId) => {
    const elementId = document.pages[pageId]?.elementIds[0];
    const element = elementId ? document.elements[elementId] : undefined;
    const asset = element?.assetId ? document.assets[element.assetId] : undefined;
    if (!element || !asset || element.kind !== 'image') return [];
    const source = objectValue(element.data);
    return [{
      assetId: asset.id,
      height: numberValue(source?.height, element.bounds.height),
      id: element.id,
      name: element.name,
      source: asset.source,
      width: numberValue(source?.width, element.bounds.width),
    }];
  });
}

export function serializeAnimationCanvasDocument(document: CanvasDocument): string {
  return serializeCanvasDocument(document);
}

export function parseAnimationCanvasDocument(source: string): {
  assets: AnimationDocumentAsset[];
  document: CanvasDocument;
  state: AnimationDocumentState;
} {
  const document = parseCanvasDocument(source);
  return {
    assets: animationAssetsFromCanvasDocument(document),
    document,
    state: animationStateFromCanvasDocument(document),
  };
}
