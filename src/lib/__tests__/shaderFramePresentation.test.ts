// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type PresentationModule = typeof import('../shaderFramePresentation');

describe('shader frame presentation', () => {
  let presentation: PresentationModule;
  let images: HTMLImageElement[];

  beforeEach(async () => {
    vi.resetModules();
    presentation = await import('../shaderFramePresentation');
    images = [];
    vi.stubGlobal('Image', vi.fn(function () {
      const image = document.createElement('img');
      Object.defineProperties(image, { naturalWidth: { value: 160 }, naturalHeight: { value: 160 } });
      Object.defineProperty(image, 'src', { configurable: true, value: '', writable: true });
      image.decode = vi.fn(async () => {});
      images.push(image);
      return image;
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function destination() {
    return {
      drawImage: vi.fn(),
      filter: 'none',
      globalAlpha: 0.6,
      restore: vi.fn(),
      save: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
  }

  function source() {
    const image = document.createElement('img');
    Object.defineProperty(image, 'naturalWidth', { value: 1_000 });
    return image;
  }

  const bounds = { x: 20, y: 30, width: 500, height: 400 };

  async function preload() {
    const loaded = presentation.preloadShaderFramePresentation({ grainOpacity: 0.2 });
    images[0]!.dispatchEvent(new Event('load'));
    await loaded;
  }

  it('accepts authored presentation values and rejects non-finite/unsafe values', () => {
    expect(presentation.normalizeShaderFramePresentation(undefined)).toEqual({});
    expect(presentation.normalizeShaderFramePresentation({ filter: 'brightness(0.8) contrast(1.2) saturate(1)', grainOpacity: 0.2, grainTileSize: 320 }))
      .toEqual({ filter: 'brightness(0.8) contrast(1.2) saturate(1)', grainOpacity: 0.2, grainTileSize: 320 });
    for (const value of [{ filter: 'url(#remote)' }, { grainOpacity: Number.NaN }, { grainOpacity: 2 }, { grainTileSize: 0 }, { grainTileSize: Infinity }, []]) {
      expect(() => presentation.normalizeShaderFramePresentation(value)).toThrow();
    }
  });

  it('does not load grain when absent and deduplicates simultaneous grain preload', async () => {
    await presentation.preloadShaderFramePresentation();
    expect(images).toHaveLength(0);
    const first = presentation.preloadShaderFramePresentation({ grainOpacity: 0.2 });
    const second = presentation.preloadShaderFramePresentation({ grainOpacity: 0.4 });
    expect(first).toBe(second);
    expect(images).toHaveLength(1);
    expect(images[0]!.src).toBe(presentation.PAPER_MATERIAL_GRAIN_IMAGE);
    images[0]!.dispatchEvent(new Event('load'));
    await Promise.all([first, second]);
    await presentation.preloadShaderFramePresentation({ grainOpacity: 0.2 });
    expect(images).toHaveLength(1);
  });

  it('allows retry after a grain load failure instead of caching rejection forever', async () => {
    const first = presentation.preloadShaderFramePresentation({ grainOpacity: 0.2 });
    const rejection = expect(first).rejects.toThrow('could not be loaded');
    images[0]!.dispatchEvent(new Event('error'));
    await rejection;
    const retry = presentation.preloadShaderFramePresentation({ grainOpacity: 0.2 });
    expect(images).toHaveLength(2);
    images[1]!.dispatchEvent(new Event('load'));
    await retry;
  });

  it('draws a filter-only snapshot synchronously without an intermediate canvas', () => {
    const context = destination();
    const image = source();
    const create = vi.spyOn(document, 'createElement');
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(0.8)' }, bounds);
    expect(context.drawImage).toHaveBeenCalledWith(image, 20, 30, 500, 400);
    expect(context.filter).toBe('brightness(0.8)');
    expect(context.globalAlpha).toBe(0.6);
    expect(context.save).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledOnce();
    expect(create).not.toHaveBeenCalled();
  });

  it('fails before touching destination pixels if grain has not been preloaded', () => {
    const context = destination();
    expect(() => presentation.drawShaderFramePresentation(context, source(), { grainOpacity: 0.2 }, bounds)).toThrow('Preload');
    expect(context.save).not.toHaveBeenCalled();
    expect(context.drawImage).not.toHaveBeenCalled();
  });

  it('composites raw image plus scaled soft-light grain before the final group filter', async () => {
    await preload();
    const pattern = {} as CanvasPattern;
    const scratch = { createPattern: vi.fn(() => pattern), drawImage: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn(), scale: vi.fn(), fillRect: vi.fn(), globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '' };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(scratch as unknown as CanvasRenderingContext2D);
    const context = destination();
    const image = source();
    presentation.drawShaderFramePresentation(context, image, { filter: 'contrast(1.2)', grainOpacity: 0.2, grainTileSize: 320 }, bounds);
    expect(scratch.drawImage).toHaveBeenCalledWith(image, 0, 0, 500, 400);
    expect(scratch.createPattern).toHaveBeenCalledWith(images[0], 'repeat');
    expect(scratch.globalCompositeOperation).toBe('soft-light');
    expect(scratch.globalAlpha).toBe(0.2);
    expect(scratch.scale).toHaveBeenCalledWith(1, 1);
    expect(scratch.fillRect).toHaveBeenCalledWith(0, 0, 500, 400);
    expect(context.filter).toBe('contrast(1.2)');
    expect(context.drawImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 20, 30, 500, 400);
    expect(scratch.drawImage.mock.invocationCallOrder[0]).toBeLessThan(scratch.fillRect.mock.invocationCallOrder[0]!);
    expect(scratch.fillRect.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(context.drawImage).mock.invocationCallOrder[0]!);
    presentation.drawShaderFramePresentation(context, image, { filter: 'contrast(1.4)', grainOpacity: 0.2, grainTileSize: 320 }, bounds);
    expect(scratch.drawImage).toHaveBeenCalledOnce();
    expect(scratch.fillRect).toHaveBeenCalledOnce();
    expect(context.drawImage).toHaveBeenCalledTimes(2);
    expect(context.filter).toBe('contrast(1.4)');
  });

  it('restores caller state even when the destination rejects drawing', () => {
    const context = destination();
    vi.mocked(context.drawImage).mockImplementation(() => { throw new Error('Draw failed.'); });
    expect(() => presentation.drawShaderFramePresentation(context, source(), undefined, bounds)).toThrow('Draw failed');
    expect(context.restore).toHaveBeenCalledOnce();
  });

  it('rejects invalid bounds and skips an empty box', () => {
    const context = destination();
    expect(() => presentation.drawShaderFramePresentation(context, source(), undefined, { ...bounds, x: Infinity })).toThrow('bounds');
    presentation.drawShaderFramePresentation(context, source(), undefined, { ...bounds, width: 0 });
    expect(context.drawImage).not.toHaveBeenCalled();
  });
});
