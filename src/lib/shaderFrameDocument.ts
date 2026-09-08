import {
  asCanvasJsonObject,
  preparePortableCanvasDocument,
  serializeCanvasDocument,
  toCanvasJsonObject,
  type CanvasDocument,
  type CanvasJsonObject,
  type CanvasJsonValue,
} from './canvasDocument';
import { imageUrlToDataUrl } from './download';
import { normalizeLiveMaterialFrameState, type LiveMaterialFrameState } from './liveMaterialPreview';
import {
  isShaderFrameAssetSource,
  normalizeShaderFrameSnapshot,
  resolveShaderFrameAssetSource,
  shaderFrameCanvasAsset,
  type ShaderFrameSnapshot,
} from './shaderFrameAssets';

export type ShaderFrameCapture = {
  frameSnapshot: ShaderFrameSnapshot;
  frameState: LiveMaterialFrameState;
};

type CaptureOptions = {
  activeArtboardId: string;
  timeline: { frame: number; paused: boolean; timeMs?: number };
};

function capturedApplication(application: CanvasJsonObject, capture: ShaderFrameCapture): CanvasJsonObject {
  const frameState = normalizeLiveMaterialFrameState(capture.frameState);
  const frameSnapshot = normalizeShaderFrameSnapshot(capture.frameSnapshot);
  if (!frameState || !frameSnapshot) throw new TypeError('The shader frame capture is incomplete.');
  if (frameState.materialId && typeof application.materialId === 'string'
    && frameState.materialId !== application.materialId) {
    throw new TypeError('The shader changed before its frame could be captured. Try capturing again.');
  }
  return toCanvasJsonObject({ ...application, frameState, frameSnapshot }, 'Captured shader application');
}

function patchContentApplications(
  value: CanvasJsonValue | undefined,
  captures: ReadonlyMap<string, ShaderFrameCapture>,
  applied?: Set<string>
): CanvasJsonObject {
  const applications = asCanvasJsonObject(value) ?? {};
  const next = { ...applications };
  for (const [id, value] of Object.entries(applications)) {
    const application = asCanvasJsonObject(value);
    const key = `content-${id}`;
    const capture = captures.get(key);
    if (!application || !capture) continue;
    next[id] = capturedApplication(application, capture);
    applied?.add(key);
  }
  return next;
}

function patchWorkspace(
  value: CanvasJsonValue | undefined,
  captures: ReadonlyMap<string, ShaderFrameCapture>,
  options: CaptureOptions
): CanvasJsonObject {
  const workspace = asCanvasJsonObject(value) ?? {};
  const artboards = Array.isArray(workspace.artboards) ? workspace.artboards : [];
  const nextArtboards = artboards.map((value) => {
    const artboard = asCanvasJsonObject(value);
    if (!artboard || artboard.id !== options.activeArtboardId) return value;
    const snapshot = asCanvasJsonObject(artboard.snapshot) ?? {};
    const shaderLayers = Array.isArray(snapshot.shaderLayers) ? snapshot.shaderLayers : [];
    return {
      ...artboard,
      snapshot: {
        ...snapshot,
        layerShaders: patchContentApplications(snapshot.layerShaders, captures),
        shaderLayers: shaderLayers.map((value) => {
          const layer = asCanvasJsonObject(value);
          const capture = layer ? captures.get(`canvas-${layer.id}`) : undefined;
          return layer && capture ? capturedApplication(layer, capture) : value;
        }),
        timeline: { ...asCanvasJsonObject(snapshot.timeline), ...options.timeline },
      },
    };
  });
  return { ...workspace, activeArtboardId: options.activeArtboardId, artboards: nextArtboards };
}

/**
 * Patches the existing portable scene, never reconstructing it from editor
 * defaults. Save can serialize this returned document before React commits.
 */
export function applyShaderFrameCaptures(
  document: CanvasDocument,
  captures: ReadonlyMap<string, ShaderFrameCapture>,
  options: CaptureOptions
): CanvasDocument {
  const metadata = asCanvasJsonObject(document.metadata.designLab);
  if (document.metadata.tool !== 'design-lab' || !metadata) throw new TypeError('Shader frame capture requires a Design Lab document.');
  if (!Number.isSafeInteger(options.timeline.frame) || options.timeline.frame < 0
    || typeof options.timeline.paused !== 'boolean') throw new TypeError('The shader frame timeline is invalid.');
  if (options.timeline.timeMs !== undefined && (!Number.isFinite(options.timeline.timeMs) || options.timeline.timeMs < 0)) {
    throw new TypeError('The shader capture time must be a non-negative finite number.');
  }
  const workspace = asCanvasJsonObject(metadata.workspace);
  if (workspace?.activeArtboardId && workspace.activeArtboardId !== options.activeArtboardId) {
    throw new TypeError('The active artboard changed before its shader frames could be captured.');
  }
  const elements = { ...document.elements };
  const applied = new Set<string>();
  for (const [id, element] of Object.entries(elements)) {
    const key = `canvas-${id}`;
    const capture = captures.get(key);
    if (!capture || element.kind !== 'shader') continue;
    elements[id] = { ...element, data: capturedApplication(element.data, capture) };
    applied.add(key);
  }
  const layerShaders = patchContentApplications(metadata.layerShaders, captures, applied);
  if ([...captures.keys()].some((key) => !applied.has(key))) {
    throw new TypeError('A captured shader no longer belongs to this artboard.');
  }
  const assets = { ...document.assets };
  for (const { frameSnapshot } of captures.values()) {
    assets[frameSnapshot.assetId] ??= shaderFrameCanvasAsset(frameSnapshot);
  }
  return {
    ...document,
    assets,
    elements,
    metadata: {
      ...document.metadata,
      designLab: {
        ...metadata,
        layerShaders,
        timeline: { ...asCanvasJsonObject(metadata.timeline), ...options.timeline },
        workspace: patchWorkspace(metadata.workspace, captures, options),
      },
    },
    revision: document.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

/** Embeds IDB-backed captures only at the save/export boundary. */
export async function prepareShaderFrameDocumentSource(document: CanvasDocument): Promise<string> {
  const portable = await preparePortableCanvasDocument(document, (source) => isShaderFrameAssetSource(source)
    ? resolveShaderFrameAssetSource(source)
    : imageUrlToDataUrl(source));
  return serializeCanvasDocument(portable);
}
