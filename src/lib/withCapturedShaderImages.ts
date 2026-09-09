import { loadCanvasImage } from './canvasDrawing';
import type { ShaderFrameImageCapture } from './captureShaderFrames';
import { acquireShaderFrameAssetUrl } from './shaderFrameAssets';
import {
  normalizeShaderFramePresentation,
  preloadShaderFramePresentation,
  type ShaderFramePresentation,
} from './shaderFramePresentation';

export type CapturedShaderImage = {
  image: HTMLImageElement;
  presentation: ShaderFramePresentation;
};

function acquireTransientUrl(blob: Blob): { url: string; release: () => void } {
  const url = URL.createObjectURL(blob);
  let released = false;
  return { url, release: () => {
    if (released) return;
    released = true;
    URL.revokeObjectURL(url);
  } };
}

/**
 * Compose only from immutable captured PNGs, never the still-mounted renderer.
 * URL ownership lasts through the synchronous composition, not later encoding.
 */
export async function withCapturedShaderImages<T>(
  captures: ReadonlyMap<string, ShaderFrameImageCapture>,
  compose: (images: ReadonlyMap<string, CapturedShaderImage>) => T
): Promise<T> {
  const leases: Array<Awaited<ReturnType<typeof acquireShaderFrameAssetUrl>>> = [];
  const images = new Map<string, CapturedShaderImage>();
  try {
    // Serial hydration also makes early failure cleanup complete: there are no
    // outstanding acquisitions that could produce another lease after finally.
    for (const [key, capture] of captures) {
      const pixels = capture.frameBlob ? capture : capture.frameSnapshot;
      const presentation = normalizeShaderFramePresentation(pixels.presentation);
      const lease = capture.frameBlob ? acquireTransientUrl(capture.frameBlob) : await acquireShaderFrameAssetUrl(capture.frameSnapshot.assetId);
      leases.push(lease);
      const [image] = await Promise.all([
        loadCanvasImage(lease.url),
        preloadShaderFramePresentation(presentation),
      ]);
      if (typeof image.decode === 'function') await image.decode();
      if (image.naturalWidth !== pixels.width || image.naturalHeight !== pixels.height) {
        throw new Error('The captured shader pixels do not match their saved dimensions.');
      }
      images.set(key, { image, presentation });
    }
    const result = compose(images);
    if (result && typeof (result as unknown as PromiseLike<unknown>).then === 'function') {
      // Observe a mistaken async callback's rejection even while failing fast.
      void Promise.resolve(result).catch(() => {});
      throw new TypeError('Captured shader composition must finish synchronously before encoding.');
    }
    return result;
  } finally {
    leases.forEach((lease) => lease.release());
  }
}
