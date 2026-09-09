import { applyShaderNumericFilter, shaderNumericFilterSteps } from './shaderNumericFilter';

export type ShaderFramePresentation = {
  filter?: string;
  grainOpacity?: number;
  /** Grain tile edge in the captured PNG's pixels, not current CSS pixels. */
  grainTileSize?: number;
};

export type ShaderFrameDrawBounds = { x: number; y: number; width: number; height: number };

export const PAPER_MATERIAL_GRAIN_TILE_SIZE = 160;
// The matching CSS and CanvasPattern share a raster tile. SVG filter images
// taint WebKit canvases, preventing readback, converter effects and downloads.
export const PAPER_MATERIAL_GRAIN_IMAGE = '/shader-grain.png';

let grainImage: HTMLImageElement | undefined;
let pendingGrainImage: Promise<void> | undefined;
const grainScratchCanvases = new WeakMap<object, HTMLCanvasElement>();
const composedImages = new WeakMap<HTMLImageElement, { canvas: HTMLCanvasElement; key: string }>();
const filteredImages = new WeakMap<object, { canvas: HTMLCanvasElement; key: string | null }>();
let canvasFiltersWork: boolean | undefined;

function supportsCanvasFilters(): boolean {
  if (canvasFiltersWork !== undefined) return canvasFiltersWork;
  const probe = document.createElement('canvas');
  probe.width = 1; probe.height = 1;
  try {
    const context = probe.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The shader filter canvas is unavailable.');
    // Checking property presence is insufficient: unsupported engines accept an
    // expando. A single pixel exercises all three authored functions instead.
    context.filter = 'brightness(0.5) contrast(0.5) saturate(0)';
    context.fillStyle = '#ff0000';
    context.fillRect(0, 0, 1, 1);
    const pixel = context.getImageData(0, 0, 1, 1).data;
    canvasFiltersWork = pixel[3] === 255 && [pixel[0], pixel[1], pixel[2]].every((value) => Math.abs(value! - 77) <= 2);
    return canvasFiltersWork;
  } finally { probe.width = 0; probe.height = 0; }
}

/** Only the authored numeric Paper filter functions are accepted; never CSS URLs. */
export function normalizeShaderFramePresentation(value: unknown): ShaderFramePresentation {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError('The captured shader presentation is invalid.');
  const { filter, grainOpacity, grainTileSize } = value as ShaderFramePresentation;
  if (filter !== undefined && typeof filter !== 'string') throw new TypeError('The captured shader filter is invalid.');
  shaderNumericFilterSteps(filter);
  if (grainOpacity !== undefined && (!Number.isFinite(grainOpacity) || grainOpacity < 0 || grainOpacity > 1)) {
    throw new TypeError('The captured shader grain opacity is invalid.');
  }
  if (grainTileSize !== undefined && (!Number.isFinite(grainTileSize) || grainTileSize <= 0 || grainTileSize > 16_384)) {
    throw new TypeError('The captured shader grain size is invalid.');
  }
  return { ...(filter ? { filter } : {}), ...(grainOpacity !== undefined ? { grainOpacity } : {}), ...(grainTileSize !== undefined ? { grainTileSize } : {}) };
}

export function shaderFrameGrainStyle(presentation: ShaderFramePresentation, sourceWidth: number) {
  return {
    backgroundImage: `url("${PAPER_MATERIAL_GRAIN_IMAGE}")`,
    // One percentage plus auto preserves square tiles in portrait/landscape boxes.
    backgroundSize: `${100 * (presentation.grainTileSize ?? PAPER_MATERIAL_GRAIN_TILE_SIZE) / sourceWidth}% auto`,
    backgroundRepeat: 'repeat',
    mixBlendMode: 'soft-light' as const,
    opacity: presentation.grainOpacity ?? 0,
  };
}

/** Call before a synchronous composition/export pass; shared loading is deduplicated. */
export function preloadShaderFramePresentation(presentation?: ShaderFramePresentation): Promise<void> {
  const normalized = normalizeShaderFramePresentation(presentation);
  if (!normalized.grainOpacity || grainImage) return Promise.resolve();
  if (pendingGrainImage) return pendingGrainImage;
  pendingGrainImage = new Promise<void>((resolve, reject) => {
    let settled = false;
    const image = new Image(PAPER_MATERIAL_GRAIN_TILE_SIZE, PAPER_MATERIAL_GRAIN_TILE_SIZE);
    image.decoding = 'async';
    image.onload = async () => {
      try {
        if (typeof image.decode === 'function') await image.decode();
        if (settled) return;
        if (!image.naturalWidth || !image.naturalHeight) throw new Error('The shader grain image is empty.');
        grainImage = image;
        settled = true;
        resolve();
      } catch {
        settled = true;
        reject(new Error('The captured shader grain could not be decoded.'));
      } finally {
        image.onload = null;
        image.onerror = null;
      }
    };
    image.onerror = () => {
      settled = true;
      image.onload = null;
      image.onerror = null;
      reject(new Error('The captured shader grain could not be loaded.'));
    };
    image.src = PAPER_MATERIAL_GRAIN_IMAGE;
  }).catch((error: unknown) => {
    pendingGrainImage = undefined;
    throw error;
  });
  return pendingGrainImage;
}

function imageWidth(image: CanvasImageSource): number {
  if ('naturalWidth' in image) return image.naturalWidth;
  if ('videoWidth' in image) return image.videoWidth;
  if ('displayWidth' in image) return image.displayWidth;
  return typeof image.width === 'number' ? image.width : image.width.baseVal.value;
}

function composeGrain(
  image: CanvasImageSource,
  presentation: ShaderFramePresentation,
  bounds: ShaderFrameDrawBounds
): HTMLCanvasElement {
  if (!grainImage) throw new Error('Preload the captured shader grain before drawing.');
  const sourceWidth = imageWidth(image);
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) throw new Error('The captured shader image is not ready.');
  const immutableImage = 'naturalWidth' in image ? image : undefined;
  const key = `${immutableImage?.currentSrc || immutableImage?.src}:${bounds.width}:${bounds.height}:${sourceWidth}:${presentation.grainOpacity}:${presentation.grainTileSize}`;
  const cached = immutableImage ? composedImages.get(immutableImage) : undefined;
  if (cached?.key === key) return cached.canvas;
  if (immutableImage) composedImages.delete(immutableImage);
  let scratch = grainScratchCanvases.get(image);
  if (!scratch) {
    scratch = document.createElement('canvas');
    grainScratchCanvases.set(image, scratch);
  }
  const width = Math.max(1, Math.ceil(bounds.width));
  const height = Math.max(1, Math.ceil(bounds.height));
  if (scratch.width !== width) scratch.width = width;
  if (scratch.height !== height) scratch.height = height;
  // Decoded saved PNGs need deterministic readback, including the first draw.
  // Keep the continuously changing native-canvas path GPU accelerated.
  const context = immutableImage
    ? scratch.getContext('2d', { willReadFrequently: true })
    : scratch.getContext('2d');
  if (!context) throw new Error('The captured shader presentation canvas is unavailable.');
  const pattern = context.createPattern(grainImage, 'repeat');
  if (!pattern) throw new Error('The captured shader grain pattern is unavailable.');
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'source-over';
  context.globalAlpha = 1;
  context.clearRect(0, 0, scratch.width, scratch.height);
  context.drawImage(image, 0, 0, scratch.width, scratch.height);
  const scale = (presentation.grainTileSize ?? PAPER_MATERIAL_GRAIN_TILE_SIZE) / PAPER_MATERIAL_GRAIN_TILE_SIZE * scratch.width / sourceWidth;
  context.globalCompositeOperation = 'soft-light';
  context.globalAlpha = presentation.grainOpacity ?? 0;
  context.scale(scale, scale);
  context.fillStyle = pattern;
  context.fillRect(0, 0, scratch.width / scale, scratch.height / scale);
  // Frozen decoded PNGs are immutable. Reuse their group in converter/export
  // redraws; never cache a live canvas/video whose pixels can change in place.
  if (immutableImage) composedImages.set(immutableImage, { canvas: scratch, key });
  return scratch;
}

function presentationRasterBounds(context: CanvasRenderingContext2D, bounds: ShaderFrameDrawBounds): ShaderFrameDrawBounds {
  const transform = context.getTransform?.();
  const scaleX = transform ? Math.hypot(transform.a, transform.b) : 1;
  const scaleY = transform ? Math.hypot(transform.c, transform.d) : 1;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) throw new RangeError('The shader presentation transform is invalid.');
  return { x: 0, y: 0, width: Math.max(1, Math.ceil(bounds.width * scaleX)), height: Math.max(1, Math.ceil(bounds.height * scaleY)) };
}

function numericFilteredImage(
  original: CanvasImageSource,
  source: CanvasImageSource,
  presentation: ShaderFramePresentation,
  bounds: ShaderFrameDrawBounds
): HTMLCanvasElement {
  const immutableImage = 'naturalWidth' in original ? original : undefined;
  const key = `${immutableImage?.currentSrc || immutableImage?.src}:${imageWidth(original)}:${bounds.width}:${bounds.height}:${presentation.filter}:${presentation.grainOpacity}:${presentation.grainTileSize}`;
  let entry = filteredImages.get(original);
  if (immutableImage && entry?.key === key) return entry.canvas;
  if (!entry) { entry = { canvas: document.createElement('canvas'), key: null }; filteredImages.set(original, entry); }
  // Each input keeps one reusable buffer, not a cache for every slider value.
  // Invalidate before mutation so a failed draw never revives partial pixels.
  entry.key = null;
  const canvas = entry.canvas;
  try {
    if (canvas.width !== bounds.width) canvas.width = bounds.width;
    if (canvas.height !== bounds.height) canvas.height = bounds.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('The shader filter canvas is unavailable.');
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    applyShaderNumericFilter(pixels.data, presentation.filter!);
    context.putImageData(pixels, 0, 0);
    if (immutableImage) entry.key = key;
    return canvas;
  } catch (error) {
    canvas.width = 0; canvas.height = 0;
    throw error;
  }
}

/**
 * Mirrors the isolated live Paper group: raw pixels, then soft-light grain,
 * then the CSS filter on the whole group. Caller opacity/transform are retained.
 */
export function drawShaderFramePresentation(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  presentation: ShaderFramePresentation | undefined,
  bounds: ShaderFrameDrawBounds
): void {
  const normalized = normalizeShaderFramePresentation(presentation);
  if (!Object.values(bounds).every(Number.isFinite) || bounds.width < 0 || bounds.height < 0) {
    throw new RangeError('The captured shader draw bounds are invalid.');
  }
  if (bounds.width === 0 || bounds.height === 0) return;
  // Resolve the complete group before touching the destination on a failed load.
  const needsFilter = shaderNumericFilterSteps(normalized.filter).length > 0;
  const nativeFilter = !needsFilter || supportsCanvasFilters();
  const rasterBounds = normalized.grainOpacity || !nativeFilter ? presentationRasterBounds(context, bounds) : bounds;
  const grainSource = normalized.grainOpacity ? composeGrain(image, normalized, rasterBounds) : image;
  const source = nativeFilter ? grainSource : numericFilteredImage(image, grainSource, normalized, rasterBounds);
  context.save();
  try {
    context.filter = nativeFilter && needsFilter ? normalized.filter! : 'none';
    context.drawImage(source, bounds.x, bounds.y, bounds.width, bounds.height);
  } finally {
    context.restore();
  }
}
