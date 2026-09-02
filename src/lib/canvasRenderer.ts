import type { CanvasBounds, CanvasDocument, CanvasElement, CanvasPage } from './canvasDocument';

export type CanvasRenderLayer = {
  element: CanvasElement;
  outputBounds: CanvasBounds;
};

type CanvasRenderPlan = {
  background: string;
  height: number;
  layers: CanvasRenderLayer[];
  missingElementIds: string[];
  page: CanvasPage;
  width: number;
};

export type CanvasRenderReport = {
  height: number;
  missingElementIds: string[];
  pageId: string;
  paintedElementIds: string[];
  width: number;
};

function outputBounds(bounds: CanvasBounds, scaleX: number, scaleY: number): CanvasBounds {
  return {
    height: bounds.height * scaleY,
    rotation: bounds.rotation,
    width: bounds.width * scaleX,
    x: bounds.x * scaleX,
    y: bounds.y * scaleY,
  };
}

export function createCanvasRenderPlan({
  document,
  elementIds,
  height,
  pageId,
  width,
}: {
  document: CanvasDocument;
  elementIds?: readonly string[];
  height: number;
  pageId: string;
  width: number;
}): CanvasRenderPlan {
  const page = document.pages[pageId];
  if (!page) throw new RangeError(`Canvas page ${pageId} does not exist.`);
  if (!(width > 0) || !(height > 0)) throw new RangeError('Canvas output dimensions must be positive.');
  const ids = elementIds ?? page.elementIds;
  const missingElementIds: string[] = [];
  const layers: CanvasRenderLayer[] = [];
  const seen = new Set<string>();
  const scaleX = width / page.width;
  const scaleY = height / page.height;
  for (const elementId of ids) {
    if (seen.has(elementId)) continue;
    seen.add(elementId);
    const element = document.elements[elementId];
    if (!element) {
      missingElementIds.push(elementId);
      continue;
    }
    if (element.hidden) continue;
    layers.push({ element, outputBounds: outputBounds(element.bounds, scaleX, scaleY) });
  }
  return {
    background: page.background,
    height,
    layers,
    missingElementIds,
    page,
    width,
  };
}

export function renderCanvasDocumentPage({
  context,
  document,
  elementIds,
  height,
  manageCompositing = true,
  pageId,
  renderElement,
  width,
}: {
  context: CanvasRenderingContext2D;
  document: CanvasDocument;
  elementIds?: readonly string[];
  height: number;
  manageCompositing?: boolean;
  pageId: string;
  renderElement: (layer: CanvasRenderLayer) => void;
  width: number;
}): CanvasRenderReport {
  const plan = createCanvasRenderPlan({ document, elementIds, height, pageId, width });
  context.save();
  context.clearRect(0, 0, width, height);
  context.fillStyle = plan.background;
  context.fillRect(0, 0, width, height);
  context.restore();

  const paintedElementIds: string[] = [];
  for (const layer of plan.layers) {
    context.save();
    try {
      if (manageCompositing) {
        context.globalAlpha = layer.element.style.opacity;
        context.globalCompositeOperation = layer.element.style.blendMode === 'normal'
          ? 'source-over'
          : layer.element.style.blendMode;
      }
      renderElement(layer);
      paintedElementIds.push(layer.element.id);
    } finally {
      context.restore();
    }
  }

  return {
    height,
    missingElementIds: plan.missingElementIds,
    pageId,
    paintedElementIds,
    width,
  };
}
