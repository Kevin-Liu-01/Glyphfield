export type ImageLayerPlacement = {
  heightScale: number;
  scale: number;
  widthScale: number;
  x: number;
  y: number;
};

export type PreviewContainedImageBounds = {
  boxHeight: number;
  boxWidth: number;
  height: number;
  viewportSize: number;
  width: number;
  x: number;
  y: number;
};

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function imageLayerName(fileName: string, fallback = 'Image'): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').trim();
  return withoutExtension || fallback;
}

/**
 * Mirrors LogoAppearancePreview's square SVG viewBox inside a rectangular
 * canvas layer. The outer SVG first centers a square viewport, then its image
 * is contained inside that square. Export must use the same two-stage contain
 * geometry or wide and tall assets render at a different size than the canvas.
 */
export function previewContainedImageBounds({
  boxHeight,
  boxWidth,
  imageHeight,
  imageWidth,
}: {
  boxHeight: number;
  boxWidth: number;
  imageHeight: number;
  imageWidth: number;
}): PreviewContainedImageBounds {
  const safeBoxWidth = positive(boxWidth, 1);
  const safeBoxHeight = positive(boxHeight, 1);
  const safeImageWidth = positive(imageWidth, 1);
  const safeImageHeight = positive(imageHeight, 1);
  const viewportSize = Math.min(safeBoxWidth, safeBoxHeight);
  const scale = Math.min(viewportSize / safeImageWidth, viewportSize / safeImageHeight);
  const width = safeImageWidth * scale;
  const height = safeImageHeight * scale;

  return {
    boxHeight: safeBoxHeight,
    boxWidth: safeBoxWidth,
    height,
    viewportSize,
    width,
    x: (safeBoxWidth - width) / 2,
    y: (safeBoxHeight - height) / 2,
  };
}

export function fitImageLayerToCanvas({
  baseHeight,
  baseWidth,
  canvasHeight,
  canvasWidth,
  imageHeight,
  imageWidth,
  x = 0,
  y = 0,
}: {
  baseHeight: number;
  baseWidth: number;
  canvasHeight: number;
  canvasWidth: number;
  imageHeight: number;
  imageWidth: number;
  x?: number;
  y?: number;
}): ImageLayerPlacement {
  const safeImageWidth = positive(imageWidth, 1);
  const safeImageHeight = positive(imageHeight, 1);
  const maximumWidth = positive(canvasWidth, 1) * 0.62;
  const maximumHeight = positive(canvasHeight, 1) * 0.62;
  const fit = Math.min(maximumWidth / safeImageWidth, maximumHeight / safeImageHeight);
  const targetWidth = safeImageWidth * fit;
  const targetHeight = safeImageHeight * fit;

  return {
    heightScale: targetHeight / positive(baseHeight, targetHeight),
    scale: 1,
    widthScale: targetWidth / positive(baseWidth, targetWidth),
    x,
    y,
  };
}
