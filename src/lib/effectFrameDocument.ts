import {
  asCanvasJsonObject,
  canvasRevisionFromSignature,
  toCanvasJsonObject,
  type CanvasDocument,
} from './canvasDocument';
import { normalizeShaderFrameSnapshot, shaderFrameCanvasAsset, type ShaderFrameSnapshot } from './shaderFrameAssets';

type SourceRecord = Record<string, unknown>;
const compositionKeys = new WeakMap<object, Map<string, string>>();

function record(value: unknown): SourceRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as SourceRecord : undefined;
}

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  const object = record(value);
  return object ? Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => [key, sorted(value)])) : value;
}

function paintSource(value: unknown): unknown {
  const source = record(value);
  if (!source) return source;
  const { id: _id, name: _name, layerType: _layerType, frameSnapshot, frameState, ...paint } = source;
  const snapshot = normalizeShaderFrameSnapshot(frameSnapshot);
  if (snapshot && !(typeof source.id === 'string' && source.id.startsWith('effect-'))) {
    paint.frameSnapshot = { assetId: snapshot.assetId, width: snapshot.width, height: snapshot.height, presentation: snapshot.presentation };
  } else if (frameState) {
    const { timelineTimeMs: _anchor, ...nativeState } = record(frameState) ?? {};
    paint.frameState = nativeState;
  }
  return paint;
}

/** Includes only paint inputs through this converter, not editor IDs or clocks. */
export function effectFrameCompositionKey(snapshot: object, effectId: string): string {
  const cached = compositionKeys.get(snapshot)?.get(effectId);
  if (cached) return cached;
  const source = snapshot as SourceRecord;
  const order = Array.isArray(source.layerOrder) ? source.layerOrder : [];
  const end = order.indexOf(effectId);
  if (end < 0) throw new TypeError('The captured converter no longer belongs to this artboard.');
  const entries = ['shaderLayers', 'effectLayers', 'textLayers', 'logos', 'assets'].flatMap((key) =>
    Array.isArray(source[key]) ? (source[key] as unknown[]).flatMap((item) => record(item) ? [record(item)!] : []) : []);
  const layers = new Map(entries.map((layer) => [layer.id, layer]));
  const applications = record(source.layerShaders) ?? {};
  const pixels = order.slice(0, end + 1).flatMap((id) => {
    const layer = layers.get(id);
    if (!layer || layer.visible === false) return [];
    return [{ layer: paintSource(layer), application: typeof id === 'string' ? paintSource(applications[id]) : undefined }];
  });
  const signature = JSON.stringify(sorted({ backgroundColor: source.backgroundColor, dimensions: source.dimensions, pixels }));
  const key = `effect-frame:1:${canvasRevisionFromSignature(signature)}:${canvasRevisionFromSignature(`paint:${signature}`)}:${signature.length}`;
  const keys = compositionKeys.get(snapshot) ?? new Map<string, string>();
  keys.set(effectId, key);
  compositionKeys.set(snapshot, keys);
  return key;
}

export function effectFrameMatches(frame: ShaderFrameSnapshot | undefined, snapshot: object, effectId: string): boolean {
  return Boolean(frame && frame.effectCompositionKey === effectFrameCompositionKey(snapshot, effectId));
}

/** Patch after shader capture so dependency keys use the final captured PNGs. */
export function applyEffectFrameCaptures(
  document: CanvasDocument,
  captures: ReadonlyMap<string, ShaderFrameSnapshot>,
  activeArtboardId: string
): CanvasDocument {
  if (!captures.size) return document;
  const metadata = asCanvasJsonObject(document.metadata.designLab);
  const workspace = asCanvasJsonObject(metadata?.workspace);
  const artboards = Array.isArray(workspace?.artboards) ? workspace.artboards : [];
  const active = artboards.map(asCanvasJsonObject).find((board) => board?.id === activeArtboardId);
  const snapshot = asCanvasJsonObject(active?.snapshot);
  if (document.metadata.tool !== 'design-lab' || workspace?.activeArtboardId !== activeArtboardId || !snapshot) {
    throw new TypeError('The active artboard changed before converter frames could be preserved.');
  }
  const elements = { ...document.elements };
  const assets = { ...document.assets };
  const frames = new Map<string, ShaderFrameSnapshot>();
  for (const [id, captured] of captures) {
    if (elements[id]?.kind !== 'effect') throw new TypeError('A captured converter no longer belongs to this artboard.');
    const normalized = normalizeShaderFrameSnapshot(captured);
    if (!normalized) throw new TypeError('The converter frame capture is incomplete.');
    const frameSnapshot = { ...normalized, effectCompositionKey: effectFrameCompositionKey(snapshot, id) };
    frames.set(id, frameSnapshot);
    elements[id] = { ...elements[id], data: toCanvasJsonObject({ ...elements[id].data, frameSnapshot }, 'Captured converter') };
    assets[frameSnapshot.assetId] ??= shaderFrameCanvasAsset(frameSnapshot);
  }
  const effectLayers = Array.isArray(snapshot.effectLayers) ? snapshot.effectLayers : [];
  return {
    ...document,
    assets,
    elements,
    metadata: {
      ...document.metadata,
      designLab: {
        ...metadata,
        workspace: {
          ...workspace,
          artboards: artboards.map((value) => value === active ? {
            ...active,
            snapshot: {
              ...snapshot,
              effectLayers: effectLayers.map((value) => {
                const layer = asCanvasJsonObject(value);
                const frame = layer && typeof layer.id === 'string' ? frames.get(layer.id) : undefined;
                return frame ? { ...layer, frameSnapshot: toCanvasJsonObject(frame, 'Converter frame') } : value;
              }),
            },
          } : value),
        },
      },
    },
  };
}
