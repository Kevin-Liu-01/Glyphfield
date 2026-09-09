import { loadCanvasImage } from './canvasDrawing';

/** Prepared SVG pixels depend on the embedding viewport as well as the URL. */
export function canvasImageViewportKey(source: string, width: number, height: number): string {
  return JSON.stringify([source, width, height]);
}

/** Give an SVG the same viewport as its live img/mask without changing its artwork. */
export function svgAtCanvasViewport(source: string, width: number, height: number): string {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('SVG viewport dimensions must be positive.');
  }
  const document = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = document.documentElement;
  if (root.localName !== 'svg' || document.querySelector('parsererror')) {
    throw new TypeError('The canvas asset is not a valid SVG.');
  }
  // Without a viewBox, img fitting scales the original absolute-coordinate
  // viewport. Replacing its dimensions would instead move or clip the artwork.
  if (!root.hasAttribute('viewBox')) return source;
  // Parsing/serializing retains viewBox, preserveAspectRatio, definitions,
  // masks, and unknown artwork fields. Only the embedding viewport changes.
  root.setAttribute('width', String(width));
  root.setAttribute('height', String(height));
  return new XMLSerializer().serializeToString(root);
}

export async function loadCanvasImageAtViewport(source: string, width: number, height: number): Promise<HTMLImageElement> {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Canvas image could not be loaded (${response.status}).`);
  let blob = await response.blob();
  if (blob.type.split(';', 1)[0] === 'image/svg+xml') {
    blob = new Blob([svgAtCanvasViewport(await blob.text(), width, height)], { type: 'image/svg+xml' });
  }
  const url = URL.createObjectURL(blob);
  try {
    return await loadCanvasImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
