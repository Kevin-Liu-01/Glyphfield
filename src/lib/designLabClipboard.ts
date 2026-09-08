import type { CanvasAsset } from './canvasDocument';
import { normalizeLiveMaterialFrameState } from './liveMaterialPreview';
import { collectShaderFrameSnapshots, importShaderFrameAssets, readShaderFrameAsset } from './shaderFrameAssets';

export const DESIGN_LAB_CLIPBOARD_MIME = 'application/x-glyphfield-design-lab';

const DESIGN_LAB_CLIPBOARD_MARKER = 'glyphfield-design-lab';
const DESIGN_LAB_CLIPBOARD_VERSION = 1;

type ClipboardRecord = Record<string, unknown>;

type ClipboardLayer = ClipboardRecord & {
  id: string;
  name?: string;
  transform?: ClipboardRecord;
};

type ClipboardGroup = ClipboardRecord & {
  id: string;
  layerIds: string[];
  name?: string;
};

export type DesignLabClipboardSnapshot = ClipboardRecord & {
  assets: ClipboardLayer[];
  backgroundColor: string;
  effectLayers: ClipboardLayer[];
  groups: ClipboardGroup[];
  layerOrder: string[];
  layerShaders: Record<string, unknown>;
  logos: ClipboardLayer[];
  ratio: string;
  shaderLayers: ClipboardLayer[];
  shaderSequence: ClipboardRecord;
  textLayers: ClipboardLayer[];
};

export type DesignLabClipboardArtboard = ClipboardRecord & {
  id: string;
  name: string;
  snapshot: DesignLabClipboardSnapshot;
  x: number;
  y: number;
};

export type DesignLabClipboardPayload = (
  | {
      artboard: DesignLabClipboardArtboard;
      kind: 'artboard';
      marker: typeof DESIGN_LAB_CLIPBOARD_MARKER;
      version: typeof DESIGN_LAB_CLIPBOARD_VERSION;
    }
  | {
      kind: 'layers';
      layerIds: string[];
      marker: typeof DESIGN_LAB_CLIPBOARD_MARKER;
      snapshot: DesignLabClipboardSnapshot;
      version: typeof DESIGN_LAB_CLIPBOARD_VERSION;
    }
) & { frameAssets?: CanvasAsset[] };

export type DesignLabClipboardLayerKind = 'asset' | 'effect' | 'group' | 'logo' | 'shader' | 'text';

type RemapDesignLabClipboardSnapshotOptions = {
  createId?: (kind: DesignLabClipboardLayerKind) => string;
  layerIds?: readonly string[];
  offset?: number;
  renameLayers?: boolean;
};

const LAYER_COLLECTIONS = [
  ['shaderLayers', 'shader'],
  ['effectLayers', 'effect'],
  ['textLayers', 'text'],
  ['logos', 'logo'],
  ['assets', 'asset'],
] as const satisfies readonly [keyof DesignLabClipboardSnapshot, DesignLabClipboardLayerKind][];

function isRecord(value: unknown): value is ClipboardRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isClipboardLayer(value: unknown): value is ClipboardLayer {
  return isRecord(value) && typeof value.id === 'string';
}

function isClipboardGroup(value: unknown): value is ClipboardGroup {
  return isClipboardLayer(value) && Array.isArray(value.layerIds) && value.layerIds.every((id) => typeof id === 'string');
}

function isClipboardSnapshot(value: unknown): value is DesignLabClipboardSnapshot {
  if (!isRecord(value)) return false;
  return typeof value.backgroundColor === 'string'
    && typeof value.ratio === 'string'
    && Array.isArray(value.layerOrder)
    && value.layerOrder.every((id) => typeof id === 'string')
    && isRecord(value.layerShaders)
    && isRecord(value.shaderSequence)
    && Array.isArray(value.groups)
    && value.groups.every(isClipboardGroup)
    && LAYER_COLLECTIONS.every(([key]) => Array.isArray(value[key]) && value[key].every(isClipboardLayer));
}

function isClipboardArtboard(value: unknown): value is DesignLabClipboardArtboard {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && Number.isFinite(value.x)
    && Number.isFinite(value.y)
    && isClipboardSnapshot(value.snapshot);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultClipboardId(kind: DesignLabClipboardLayerKind): string {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${kind}-${suffix}`;
}

function offsetLayerTransform(layer: ClipboardLayer, offset: number) {
  if (!offset || !isRecord(layer.transform)) return;
  if (typeof layer.transform.x === 'number') layer.transform.x += offset;
  if (typeof layer.transform.y === 'number') layer.transform.y += offset;
}

function isClipboardFrameAsset(value: unknown): value is CanvasAsset {
  return isRecord(value) && typeof value.id === 'string' && /^shader-frame:[a-f0-9]{64}$/.test(value.id)
    && value.kind === 'image' && value.mimeType === 'image/png'
    && typeof value.name === 'string' && value.name.length <= 512
    && Number.isSafeInteger(value.byteLength) && (value.byteLength as number) > 0 && (value.byteLength as number) <= 25_000_000
    && typeof value.source === 'string' && value.source.length <= 33_333_358
    && /^data:image\/png;base64,[a-z\d+/]*={0,2}$/i.test(value.source);
}

function selectedClipboardSnapshot(source: unknown, layerIds: readonly string[]): DesignLabClipboardSnapshot {
  if (!isClipboardSnapshot(source)) throw new TypeError('The copied Design Lab layers are invalid.');
  const snapshot = cloneJson(source);
  const selected = new Set(layerIds);
  for (const [key] of LAYER_COLLECTIONS) {
    (snapshot as ClipboardRecord)[key] = (snapshot[key] as ClipboardLayer[]).filter(({ id }) => selected.has(id));
  }
  snapshot.layerOrder = snapshot.layerOrder.filter((id) => selected.has(id));
  snapshot.layerShaders = Object.fromEntries(Object.entries(snapshot.layerShaders).filter(([id]) => selected.has(id)));
  snapshot.groups = snapshot.groups.filter((group) => group.layerIds.every((id) => selected.has(id)));
  if (typeof snapshot.shaderSequence.targetLayerId === 'string' && !selected.has(snapshot.shaderSequence.targetLayerId)) {
    snapshot.shaderSequence.targetLayerId = null;
  }
  return snapshot;
}

/** Validate references before importing any frame or mutating the destination. */
export function designLabClipboardFrameAssets(payload: DesignLabClipboardPayload): CanvasAsset[] {
  const snapshot = payload.kind === 'artboard' ? payload.artboard.snapshot : payload.snapshot;
  const references = collectShaderFrameSnapshots(snapshot);
  const assets = payload.frameAssets ?? [];
  if (!Array.isArray(assets) || assets.some((asset) => !isClipboardFrameAsset(asset))) {
    throw new TypeError('Copied shader frames must include embedded lossless PNG assets.');
  }
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  if (byId.size !== assets.length) throw new TypeError('The copied shader frame assets contain duplicate ids.');
  return references.map(({ assetId }) => {
    const asset = byId.get(assetId);
    if (!asset) throw new TypeError('A copied shader frame is missing its PNG asset. Copy the design again.');
    return asset;
  });
}

export async function hydrateDesignLabClipboardFrames(payload: DesignLabClipboardPayload): Promise<void> {
  const assets = designLabClipboardFrameAssets(payload);
  await importShaderFrameAssets(assets);
  const snapshot = payload.kind === 'artboard' ? payload.artboard.snapshot : payload.snapshot;
  for (const reference of collectShaderFrameSnapshots(snapshot)) {
    const blob = await readShaderFrameAsset(reference.assetId);
    const header = new DataView(await blob.slice(16, 24).arrayBuffer());
    if (header.getUint32(0) !== reference.width || header.getUint32(4) !== reference.height) {
      throw new TypeError('The copied shader frame dimensions do not match its PNG pixels.');
    }
  }
}

/** Move provider anchors onto the destination clock without changing saved pixels. */
export function reanchorDesignLabClipboardSnapshot(source: unknown, timeMs: number): DesignLabClipboardSnapshot {
  if (!isClipboardSnapshot(source) || !Number.isFinite(timeMs) || timeMs < 0) throw new TypeError('The pasted shader time is invalid.');
  const snapshot = cloneJson(source);
  const reanchor = (application: unknown) => {
    if (!isRecord(application)) return;
    const state = normalizeLiveMaterialFrameState(application.frameState);
    if (state) application.frameState = { ...(isRecord(application.frameState) ? application.frameState : {}), ...state, timelineTimeMs: timeMs };
    if (isRecord(application.frameSnapshot)) application.frameSnapshot = { ...application.frameSnapshot, timeMs };
  };
  snapshot.shaderLayers.forEach(reanchor);
  Object.values(snapshot.layerShaders).forEach(reanchor);
  snapshot.timeline = { ...(isRecord(snapshot.timeline) ? snapshot.timeline : {}), paused: true, timeMs };
  return snapshot;
}

export function serializeDesignLabClipboard(
  payload:
    | { artboard: unknown; frameAssets?: readonly CanvasAsset[]; kind: 'artboard' }
    | { frameAssets?: readonly CanvasAsset[]; kind: 'layers'; layerIds: readonly string[]; snapshot: unknown }
): string {
  if (payload.kind === 'artboard' && !isClipboardArtboard(payload.artboard)) {
    throw new TypeError('The copied Design Lab artboard is invalid.');
  }
  const selected = payload.kind === 'layers'
    ? { ...payload, snapshot: selectedClipboardSnapshot(payload.snapshot, payload.layerIds) }
    : payload;
  const candidate = {
    ...selected,
    marker: DESIGN_LAB_CLIPBOARD_MARKER,
    version: DESIGN_LAB_CLIPBOARD_VERSION,
  } as DesignLabClipboardPayload;
  const frameAssets = designLabClipboardFrameAssets(candidate);
  return JSON.stringify({ ...candidate, ...(frameAssets.length ? { frameAssets } : { frameAssets: undefined }) });
}

export function parseDesignLabClipboard(source: string): DesignLabClipboardPayload | null {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!isRecord(parsed)
      || parsed.marker !== DESIGN_LAB_CLIPBOARD_MARKER
      || parsed.version !== DESIGN_LAB_CLIPBOARD_VERSION) return null;
    if (parsed.frameAssets !== undefined && (!Array.isArray(parsed.frameAssets) || !parsed.frameAssets.every(isClipboardFrameAsset))) return null;
    if (parsed.kind === 'artboard' && isClipboardArtboard(parsed.artboard)) {
      return parsed as DesignLabClipboardPayload;
    }
    if (parsed.kind === 'layers'
      && Array.isArray(parsed.layerIds)
      && parsed.layerIds.every((id) => typeof id === 'string')
      && isClipboardSnapshot(parsed.snapshot)) {
      return parsed as DesignLabClipboardPayload;
    }
    return null;
  } catch {
    return null;
  }
}

/** Start this during the copy event; promised Blob data retains user activation. */
export async function writePreparedDesignLabClipboard(
  source: Promise<string>,
  environment: {
    clipboard?: Partial<Pick<Clipboard, 'write' | 'writeText'>> | null;
    clipboardItem?: typeof ClipboardItem | null;
  } = {}
): Promise<boolean> {
  const clipboard = environment.clipboard === undefined ? globalThis.navigator?.clipboard : environment.clipboard;
  const Item = environment.clipboardItem === undefined
    ? typeof ClipboardItem === 'undefined' ? undefined : ClipboardItem
    : environment.clipboardItem;
  if (clipboard?.write && Item) {
    const blob = source.then((value) => new Blob([value], { type: 'text/plain' }));
    // Some implementations reject write() before consuming the promised data.
    void blob.catch(() => {});
    try {
      await clipboard.write([new Item({ 'text/plain': blob })]);
      return true;
    } catch {
      // The prepared source may still be written through the text-only API.
    }
  }
  const value = await source;
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function remapDesignLabClipboardSnapshot(
  source: unknown,
  {
    createId = defaultClipboardId,
    layerIds,
    offset = 0,
    renameLayers = false,
  }: RemapDesignLabClipboardSnapshotOptions = {}
): { layerIds: string[]; snapshot: DesignLabClipboardSnapshot } {
  if (!isClipboardSnapshot(source)) throw new TypeError('The copied Design Lab layers are invalid.');
  const snapshot = cloneJson(source);
  const requestedIds = layerIds ? new Set(layerIds) : null;
  const idMap = new Map<string, string>();

  for (const [key, kind] of LAYER_COLLECTIONS) {
    const layers = (snapshot[key] as ClipboardLayer[]).filter((layer) => !requestedIds || requestedIds.has(layer.id));
    layers.forEach((layer) => {
      const previousId = layer.id;
      const nextId = createId(kind);
      idMap.set(previousId, nextId);
      layer.id = nextId;
      if (renameLayers && typeof layer.name === 'string') layer.name = `${layer.name} copy`;
      offsetLayerTransform(layer, offset);
    });
    (snapshot as ClipboardRecord)[key] = layers;
  }

  snapshot.layerOrder = snapshot.layerOrder
    .filter((id) => idMap.has(id))
    .map((id) => idMap.get(id)!);
  snapshot.layerShaders = Object.fromEntries(Object.entries(snapshot.layerShaders).flatMap(([id, application]) => {
    const nextId = idMap.get(id);
    return nextId ? [[nextId, application]] : [];
  }));
  snapshot.groups = snapshot.groups.flatMap((group) => {
    if (!group.layerIds.every((id) => idMap.has(id))) return [];
    return [{
      ...group,
      id: createId('group'),
      layerIds: group.layerIds.map((id) => idMap.get(id)!),
      name: renameLayers && typeof group.name === 'string' ? `${group.name} copy` : group.name,
    }];
  });
  const targetLayerId = snapshot.shaderSequence.targetLayerId;
  snapshot.shaderSequence = {
    ...snapshot.shaderSequence,
    targetLayerId: typeof targetLayerId === 'string' ? idMap.get(targetLayerId) ?? null : targetLayerId,
  };

  const selectedIds = layerIds ?? source.layerOrder;
  return {
    layerIds: selectedIds.flatMap((id) => {
      const nextId = idMap.get(id);
      return nextId ? [nextId] : [];
    }),
    snapshot,
  };
}
