import {
  asCanvasJsonObject as objectValue,
  canvasJsonBoolean as booleanValue,
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
import {
  createEmptyAnimationAudioState,
  normalizeAnimationAudioState,
  type AnimationAudioState,
} from './animationAudio';
import type { StudioSource } from './renderFrame';
import type { AnimationArtboard } from './animationArtboards';

const ANIMATION_METADATA_KEY = 'animation';

export type AnimationDocumentState = {
  activeArtboardId?: string;
  artboards?: readonly AnimationArtboard[];
  audio?: AnimationAudioState;
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

function audioStateFromValue(
  value: CanvasJsonValue | undefined,
  document: CanvasDocument
): AnimationAudioState | undefined {
  const audio = objectValue(value);
  if (!audio) return undefined;
  const assets = Array.isArray(audio.assets) ? audio.assets.flatMap((value) => {
    const candidate = objectValue(value);
    if (!candidate) return [];
    const assetId = stringValue(candidate.assetId, '');
    const asset = assetId ? document.assets[assetId] : undefined;
    const source = asset?.source ?? stringValue(candidate.source, '');
    const durationMs = numberValue(candidate.durationMs, 0);
    if (!source || durationMs <= 0) return [];
    const peaks = Array.isArray(candidate.peaks)
      ? candidate.peaks.flatMap((peak) => typeof peak === 'number' && Number.isFinite(peak) ? [peak] : [])
      : [];
    return [{
      durationMs,
      id: stringValue(candidate.id, assetId),
      mimeType: asset?.mimeType ?? stringValue(candidate.mimeType, 'audio/mpeg'),
      name: stringValue(candidate.name, asset?.name ?? 'Audio track'),
      peaks,
      source,
    }];
  }) : [];
  const clips = Array.isArray(audio.clips) ? audio.clips.flatMap((value) => {
    const candidate = objectValue(value);
    if (!candidate) return [];
    const id = stringValue(candidate.id, '');
    const assetId = stringValue(candidate.assetId, '');
    if (!id || !assetId) return [];
    return [{
      assetId,
      id,
      timelineStartMs: numberValue(candidate.timelineStartMs, 0),
      trimEndMs: numberValue(candidate.trimEndMs, 0),
      trimStartMs: numberValue(candidate.trimStartMs, 0),
      volume: numberValue(candidate.volume, 1),
    }];
  }) : [];
  return normalizeAnimationAudioState({
    assets,
    clips,
    muted: booleanValue(audio.muted, false),
    volume: numberValue(audio.volume, 1),
  });
}

function audioMetadataFromState(
  audio: AnimationAudioState,
  assets: Record<string, CanvasAsset>
) {
  return {
    ...audio,
    assets: audio.assets.map(({ source, ...asset }) => {
      const assetId = `animation:audio:${asset.id}`;
      assets[assetId] = /^data:/i.test(source)
        ? createEmbeddedCanvasAsset({ id: assetId, kind: 'binary', name: asset.name, source })
        : {
            byteLength: 0,
            id: assetId,
            kind: 'binary',
            mimeType: asset.mimeType || inferCanvasAssetMimeType(source),
            name: asset.name,
            source,
          };
      return { ...asset, assetId };
    }),
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
  const audio = input.state.audio ?? createEmptyAnimationAudioState();
  const audioMetadata = audioMetadataFromState(audio, assets);
  const artboardsMetadata = input.state.artboards?.map((artboard) => ({
    ...artboard,
    snapshot: {
      ...artboard.snapshot,
      audio: artboard.snapshot.audio
        ? audioMetadataFromState(artboard.snapshot.audio, assets)
        : undefined,
    },
  }));

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
      [ANIMATION_METADATA_KEY]: jsonValue({
        ...input.state,
        artboards: artboardsMetadata,
        audio: audioMetadata,
      }),
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
  const artboards = Array.isArray(metadata.artboards)
    ? metadata.artboards.flatMap((value) => {
        const candidate = objectValue(value);
        if (
          !candidate
          || typeof candidate.id !== 'string'
          || typeof candidate.name !== 'string'
          || !objectValue(candidate.snapshot)
        ) return [];
        const snapshot = objectValue(candidate.snapshot);
        if (!snapshot) return [];
        const audio = audioStateFromValue(snapshot.audio, document);
        return [{
          id: candidate.id,
          name: candidate.name,
          snapshot: {
            ...snapshot,
            ...(audio ? { audio } : {}),
          },
        } as unknown as AnimationArtboard];
      })
    : undefined;
  return {
    activeArtboardId: typeof metadata.activeArtboardId === 'string'
      ? metadata.activeArtboardId
      : undefined,
    artboards,
    audio: audioStateFromValue(metadata.audio, document),
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
