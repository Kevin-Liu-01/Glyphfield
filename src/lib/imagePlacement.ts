export type ImageLayerPlacement = {
  heightScale: number;
  scale: number;
  widthScale: number;
  x: number;
  y: number;
};

export type ImageCropSettings = {
  enabled: boolean;
  focalPointX: number;
  focalPointY: number;
  zoom: number;
};

export type ImageCropSourceBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type ImageCropRenderedBounds = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export const DEFAULT_IMAGE_CROP: ImageCropSettings = {
  enabled: false,
  focalPointX: 0.5,
  focalPointY: 0.5,
  zoom: 1,
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

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function isImageCropSettings(value: unknown): value is ImageCropSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const crop = value as Partial<ImageCropSettings>;
  return typeof crop.enabled === 'boolean'
    && typeof crop.focalPointX === 'number' && Number.isFinite(crop.focalPointX)
    && typeof crop.focalPointY === 'number' && Number.isFinite(crop.focalPointY)
    && typeof crop.zoom === 'number' && Number.isFinite(crop.zoom);
}

export function normalizeImageCropSettings(value?: Partial<ImageCropSettings> | null): ImageCropSettings {
  return {
    enabled: value?.enabled === true,
    focalPointX: clamp(Number.isFinite(value?.focalPointX) ? value!.focalPointX! : DEFAULT_IMAGE_CROP.focalPointX, 0, 1),
    focalPointY: clamp(Number.isFinite(value?.focalPointY) ? value!.focalPointY! : DEFAULT_IMAGE_CROP.focalPointY, 0, 1),
    zoom: clamp(Number.isFinite(value?.zoom) ? value!.zoom! : DEFAULT_IMAGE_CROP.zoom, 1, 4),
  };
}

/**
 * Resolves the exact source rectangle used to crop an image into an authored
 * layer frame. The same rectangle is consumed by still and motion export;
 * live CSS uses the matching cover, focal-point, and zoom values.
 */
export function imageCropSourceBounds({
  boxHeight,
  boxWidth,
  crop: cropInput,
  imageHeight,
  imageWidth,
}: {
  boxHeight: number;
  boxWidth: number;
  crop?: Partial<ImageCropSettings> | null;
  imageHeight: number;
  imageWidth: number;
}): ImageCropSourceBounds {
  const crop = normalizeImageCropSettings(cropInput);
  const safeBoxWidth = positive(boxWidth, 1);
  const safeBoxHeight = positive(boxHeight, 1);
  const safeImageWidth = positive(imageWidth, 1);
  const safeImageHeight = positive(imageHeight, 1);
  if (!crop.enabled) {
    return { height: safeImageHeight, width: safeImageWidth, x: 0, y: 0 };
  }

  const targetAspect = safeBoxWidth / safeBoxHeight;
  const imageAspect = safeImageWidth / safeImageHeight;
  const coverWidth = imageAspect > targetAspect ? safeImageHeight * targetAspect : safeImageWidth;
  const coverHeight = imageAspect > targetAspect ? safeImageHeight : safeImageWidth / targetAspect;
  const width = coverWidth / crop.zoom;
  const height = coverHeight / crop.zoom;

  return {
    height,
    width,
    x: (safeImageWidth - width) * crop.focalPointX,
    y: (safeImageHeight - height) * crop.focalPointY,
  };
}

/**
 * Places the complete source image around a crop frame. This is the inverse of
 * `imageCropSourceBounds`: the returned rectangle shows where the uncropped
 * image sits when the crop frame is treated as the viewport.
 */
export function imageCropRenderedBounds({
  boxHeight,
  boxWidth,
  crop,
  imageHeight,
  imageWidth,
}: {
  boxHeight: number;
  boxWidth: number;
  crop?: Partial<ImageCropSettings> | null;
  imageHeight: number;
  imageWidth: number;
}): ImageCropRenderedBounds {
  const safeBoxWidth = positive(boxWidth, 1);
  const safeBoxHeight = positive(boxHeight, 1);
  const safeImageWidth = positive(imageWidth, 1);
  const safeImageHeight = positive(imageHeight, 1);
  const source = imageCropSourceBounds({
    boxHeight: safeBoxHeight,
    boxWidth: safeBoxWidth,
    crop,
    imageHeight: safeImageHeight,
    imageWidth: safeImageWidth,
  });
  const scaleX = safeBoxWidth / source.width;
  const scaleY = safeBoxHeight / source.height;
  const left = -source.x * scaleX;
  const top = -source.y * scaleY;
  return {
    height: safeImageHeight * scaleY,
    left: left === 0 ? 0 : left,
    top: top === 0 ? 0 : top,
    width: safeImageWidth * scaleX,
  };
}

/** Resolve a drag of the visible source image into normalized crop focus. */
export function imageCropAfterDrag({
  boxHeight,
  boxWidth,
  crop: cropInput,
  deltaX,
  deltaY,
  imageHeight,
  imageWidth,
}: {
  boxHeight: number;
  boxWidth: number;
  crop?: Partial<ImageCropSettings> | null;
  deltaX: number;
  deltaY: number;
  imageHeight: number;
  imageWidth: number;
}): ImageCropSettings {
  const crop = normalizeImageCropSettings(cropInput);
  const rendered = imageCropRenderedBounds({ boxHeight, boxWidth, crop, imageHeight, imageWidth });
  const overflowX = Math.max(0, rendered.width - positive(boxWidth, 1));
  const overflowY = Math.max(0, rendered.height - positive(boxHeight, 1));
  return {
    ...crop,
    focalPointX: overflowX > 0 ? clamp(crop.focalPointX - deltaX / overflowX, 0, 1) : 0.5,
    focalPointY: overflowY > 0 ? clamp(crop.focalPointY - deltaY / overflowY, 0, 1) : 0.5,
  };
}

export function imageLayerName(fileName: string, fallback = 'Image'): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, '').trim();
  return withoutExtension || fallback;
}

/** Mirrors the rectangular CSS contain geometry used by live mark previews. */
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
  const scale = Math.min(safeBoxWidth / safeImageWidth, safeBoxHeight / safeImageHeight);
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
