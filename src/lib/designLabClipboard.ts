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

export type DesignLabClipboardPayload =
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
    };

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

export function serializeDesignLabClipboard(
  payload:
    | { artboard: unknown; kind: 'artboard' }
    | { kind: 'layers'; layerIds: readonly string[]; snapshot: unknown }
): string {
  return JSON.stringify({
    ...payload,
    marker: DESIGN_LAB_CLIPBOARD_MARKER,
    version: DESIGN_LAB_CLIPBOARD_VERSION,
  });
}

export function parseDesignLabClipboard(source: string): DesignLabClipboardPayload | null {
  try {
    const parsed = JSON.parse(source) as unknown;
    if (!isRecord(parsed)
      || parsed.marker !== DESIGN_LAB_CLIPBOARD_MARKER
      || parsed.version !== DESIGN_LAB_CLIPBOARD_VERSION) return null;
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
