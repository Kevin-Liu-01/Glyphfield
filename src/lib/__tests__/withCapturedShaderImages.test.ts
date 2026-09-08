// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCanvasImage } from '../canvasDrawing';
import type { CapturedShaderFrame } from '../captureShaderFrames';
import { acquireShaderFrameAssetUrl } from '../shaderFrameAssets';
import { preloadShaderFramePresentation } from '../shaderFramePresentation';
import { withCapturedShaderImages } from '../withCapturedShaderImages';

vi.mock('../canvasDrawing', () => ({ loadCanvasImage: vi.fn() }));
vi.mock('../shaderFrameAssets', () => ({ acquireShaderFrameAssetUrl: vi.fn() }));
vi.mock('../shaderFramePresentation', async (actual) => ({
  ...await actual<typeof import('../shaderFramePresentation')>(),
  preloadShaderFramePresentation: vi.fn(async () => {}),
}));

function captures() {
  const frame = (letter: string): CapturedShaderFrame => ({
    frameState: { engine: 'paper', frame: 100, timelineTimeMs: 50, version: 2 },
    frameSnapshot: { assetId: `shader-frame:${letter.repeat(64)}`, version: 1, width: 80, height: 40,
      presentation: { filter: 'brightness(1.2)', grainOpacity: 0.1, grainTileSize: 160 } },
  });
  return new Map([['canvas-one', frame('a')], ['content-two', frame('b')]]);
}

describe('immutable shader image composition lease', () => {
  let releases: Array<ReturnType<typeof vi.fn>>;
  let decoded: HTMLImageElement[];
  beforeEach(() => {
    releases = [];
    decoded = [];
    vi.mocked(acquireShaderFrameAssetUrl).mockImplementation(async (id) => {
      const release = vi.fn();
      releases.push(release);
      return { url: `blob:${id}`, release };
    });
    vi.mocked(loadCanvasImage).mockImplementation(async (url) => {
      const image = document.createElement('img');
      image.src = url;
      Object.defineProperties(image, { naturalWidth: { value: 80 }, naturalHeight: { value: 40 } });
      image.decode = vi.fn(async () => {});
      decoded.push(image);
      return image;
    });
  });
  afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

  it('uses decoded PNGs and recorded presentation, then releases every lease after synchronous drawing', async () => {
    const result = await withCapturedShaderImages(captures(), (images) => {
      expect(images.size).toBe(2);
      expect(images.get('canvas-one')!.image).toBe(decoded[0]);
      expect(images.get('content-two')!.image).toBe(decoded[1]);
      expect(images.get('canvas-one')!.presentation).toEqual({ filter: 'brightness(1.2)', grainOpacity: 0.1, grainTileSize: 160 });
      decoded.forEach((image) => expect(image.decode).toHaveBeenCalledOnce());
      releases.forEach((release) => expect(release).not.toHaveBeenCalled());
      expect(preloadShaderFramePresentation).toHaveBeenCalledTimes(2);
      return 'copied into independent effect buffers';
    });
    expect(result).toBe('copied into independent effect buffers');
    releases.forEach((release) => expect(release).toHaveBeenCalledOnce());
  });

  it('cleans up prior leases when a later acquisition fails and never composes partial pixels', async () => {
    const normal = vi.mocked(acquireShaderFrameAssetUrl).getMockImplementation()!;
    vi.mocked(acquireShaderFrameAssetUrl).mockImplementationOnce(normal).mockRejectedValueOnce(new Error('Missing PNG'));
    const compose = vi.fn();
    await expect(withCapturedShaderImages(captures(), compose)).rejects.toThrow('Missing PNG');
    expect(compose).not.toHaveBeenCalled();
    expect(releases).toHaveLength(1);
    expect(releases[0]).toHaveBeenCalledOnce();
  });

  it('releases image-load, decode and presentation failures without touching the compositor', async () => {
    const source = new Map([...captures()].slice(0, 1));
    const compose = vi.fn();
    vi.mocked(loadCanvasImage).mockRejectedValueOnce(new Error('Image failed'));
    await expect(withCapturedShaderImages(source, compose)).rejects.toThrow('Image failed');
    const normal = vi.mocked(loadCanvasImage).getMockImplementation()!;
    vi.mocked(loadCanvasImage).mockImplementationOnce(async (url) => {
      const image = await normal(url);
      image.decode = vi.fn().mockRejectedValue(new Error('Decode failed'));
      return image;
    });
    await expect(withCapturedShaderImages(source, compose)).rejects.toThrow('Decode failed');
    vi.mocked(preloadShaderFramePresentation).mockRejectedValueOnce(new Error('Grain failed'));
    await expect(withCapturedShaderImages(source, compose)).rejects.toThrow('Grain failed');
    expect(compose).not.toHaveBeenCalled();
    releases.forEach((release) => expect(release).toHaveBeenCalledOnce());
  });

  it('rejects wrong PNG dimensions and releases all acquired URLs', async () => {
    const source = captures();
    source.get('content-two')!.frameSnapshot.width = 81;
    const compose = vi.fn();
    await expect(withCapturedShaderImages(source, compose)).rejects.toThrow(/saved dimensions/);
    expect(compose).not.toHaveBeenCalled();
    releases.forEach((release) => expect(release).toHaveBeenCalledOnce());
  });

  it('releases buffers when synchronous composition throws', async () => {
    await expect(withCapturedShaderImages(captures(), () => { throw new Error('Converter failed'); })).rejects.toThrow('Converter failed');
    releases.forEach((release) => expect(release).toHaveBeenCalledOnce());
  });

  it('rejects async callbacks so overrides cannot escape their synchronous scope', async () => {
    await expect(withCapturedShaderImages(captures(), async () => 'too late')).rejects.toThrow(/must finish synchronously/);
    releases.forEach((release) => expect(release).toHaveBeenCalledOnce());
    await expect(withCapturedShaderImages(new Map(), () => 0)).resolves.toBe(0);
  });
});
