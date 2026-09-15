import { canvasLayerBounds, canvasLayerDimensions, type CanvasLayerTransform } from './canvasInteraction';
import { resolveDesignLabFontSize } from './designLabTypography';
import { asCanvasJsonObject, type CanvasJsonObject } from './canvasDocument';

// An internal editor handle, not an artboard. Portable source stores it in
// workspace.canvas; older artboard-only documents remain valid.
export const DESIGN_CANVAS_ID = 'artboard-canvas' as const;
export const DESIGN_CANVAS_DIMENSIONS = { width: 1600, height: 900 };
type Size = { width: number; height: number };
type Surface = { id: string; x: number; y: number; displayScale?: number; snapshot: { dimensions: Size } };

export function designSurfaceSize(dimensions: Size, displayScale?: number): Size {
  const scale = displayScale ?? Math.min(720 / dimensions.width, 520 / dimensions.height);
  return { width: dimensions.width * scale, height: dimensions.height * scale };
}

export function designLayerGeometry(id: string, canvas: Size) {
  const [w, h] = id.startsWith('shader-') ? [1, 1]
    : id.startsWith('text-') ? [.72, .25]
      : id.startsWith('logo-') ? [.42, .32] : [.34, .38];
  const baseWidth = canvas.width * w;
  const baseHeight = canvas.height * h;
  return { baseWidth, baseHeight, baseX: (canvas.width - baseWidth) / 2, baseY: (canvas.height - baseHeight) / 2 };
}

export function designLayerWorldBounds(surface: Surface, layer: { id: string; transform: CanvasLayerTransform }) {
  const dimensions = surface.snapshot.dimensions;
  const bounds = canvasLayerBounds(layer.transform, designLayerGeometry(layer.id, dimensions));
  const scale = designSurfaceSize(dimensions, surface.displayScale).width / dimensions.width;
  return { x: surface.x + bounds.left * scale, y: surface.y + bounds.top * scale, width: bounds.width * scale, height: bounds.height * scale };
}

/** Preserve the authored box and native text layout when changing ownership. */
export function reparentDesignLayer<T extends { id: string; transform: CanvasLayerTransform; fontSize?: number }>(
  layer: T, from: Surface, to: Surface, offset = { x: 0, y: 0 }
): T {
  const a = from.snapshot.dimensions;
  const b = to.snapshot.dimensions;
  const scaleA = designSurfaceSize(a, from.displayScale).width / a.width;
  const scaleB = designSurfaceSize(b, to.displayScale).width / b.width;
  const ratio = scaleA / scaleB;
  const geometry = designLayerGeometry(layer.id, a);
  const target = designLayerGeometry(layer.id, b);
  const size = canvasLayerDimensions(layer.transform, geometry);
  const centerX = geometry.baseX + geometry.baseWidth / 2 + layer.transform.x;
  const centerY = geometry.baseY + geometry.baseHeight / 2 + layer.transform.y;
  const transform = {
    ...layer.transform,
    x: (from.x + centerX * scaleA + offset.x - to.x) / scaleB - b.width / 2,
    y: (from.y + centerY * scaleA + offset.y - to.y) / scaleB - b.height / 2,
    widthScale: size.width * ratio / target.baseWidth,
    heightScale: size.height * ratio / target.baseHeight,
  };
  const result = {
    ...layer,
    transform,
    ...(layer.id.startsWith('text-') ? { fontSize: resolveDesignLabFontSize(layer, a.height) * ratio / layer.transform.scale } : {}),
  };
  if (layer.id.startsWith('text-')) {
    for (const key of ['outlineWidth', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY'] as const) {
      const value = (layer as T & Partial<Record<typeof key, number>>)[key];
      if (typeof value === 'number') Object.assign(result, { [key]: value * ratio });
    }
  }
  return result;
}

export function unpackDesignWorkspace<T extends { id: string }>(workspace: {
  activeArtboardId?: string; activeSurfaceId?: string; artboards?: T[]; canvas?: T;
} | undefined) {
  return {
    ...workspace,
    activeArtboardId: workspace?.activeSurfaceId === 'canvas' ? DESIGN_CANVAS_ID : workspace?.activeArtboardId,
    artboards: [...(workspace?.artboards ?? []), ...(workspace?.canvas ? [workspace.canvas] : [])],
  };
}

export function packDesignWorkspace<T extends { id: string }>(artboards: readonly T[], activeId: string) {
  return {
    activeArtboardId: activeId === DESIGN_CANVAS_ID ? undefined : activeId,
    activeSurfaceId: activeId === DESIGN_CANVAS_ID ? 'canvas' : activeId,
    artboards: artboards.filter(({ id }) => id !== DESIGN_CANVAS_ID),
    canvas: artboards.find(({ id }) => id === DESIGN_CANVAS_ID),
  };
}

export function unpackDesignWorkspaceJson(workspace: CanvasJsonObject): CanvasJsonObject {
  const { canvas, activeSurfaceId, ...rest } = workspace;
  return {
    ...rest,
    ...(activeSurfaceId === 'canvas' ? { activeArtboardId: DESIGN_CANVAS_ID } : {}),
    artboards: [...(Array.isArray(rest.artboards) ? rest.artboards : []), ...(canvas ? [canvas] : [])],
  };
}

export function packDesignWorkspaceJson(workspace: CanvasJsonObject): CanvasJsonObject {
  const surfaces = Array.isArray(workspace.artboards) ? workspace.artboards : [];
  const next: CanvasJsonObject = {
    ...workspace,
    artboards: surfaces.filter((surface) => asCanvasJsonObject(surface)?.id !== DESIGN_CANVAS_ID),
  };
  const canvas = surfaces.find((surface) => asCanvasJsonObject(surface)?.id === DESIGN_CANVAS_ID);
  if (canvas) next.canvas = canvas;
  else delete next.canvas;
  if (workspace.activeArtboardId === DESIGN_CANVAS_ID) {
    next.activeSurfaceId = 'canvas';
    delete next.activeArtboardId;
  } else if (workspace.activeArtboardId) next.activeSurfaceId = workspace.activeArtboardId;
  return next;
}
