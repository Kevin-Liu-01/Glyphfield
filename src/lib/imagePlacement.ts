export type ImageLayerPlacement = {
  heightScale: number;
  scale: number;
  widthScale: number;
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
