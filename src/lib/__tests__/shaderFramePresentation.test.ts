// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

type PresentationModule = typeof import('../shaderFramePresentation');

describe('shader frame presentation', () => {
  let presentation: PresentationModule;
  let images: HTMLImageElement[];
  let probe: { fillRect: ReturnType<typeof vi.fn>; getImageData: ReturnType<typeof vi.fn>; filter: string; fillStyle: string };

  beforeEach(async () => {
    vi.resetModules();
    presentation = await import('../shaderFramePresentation');
    probe = { fillRect: vi.fn(), getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([77, 77, 77, 255]) })), filter: 'none', fillStyle: '' };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      return this.width === 1 && this.height === 1 ? probe as unknown as CanvasRenderingContext2D : null;
    });
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

  it('shares a real lossless raster tile between the preview and canvas export', () => {
    const path = presentation.PAPER_MATERIAL_GRAIN_IMAGE;
    expect(path).toBe('/shader-grain.png');
    const png = readFileSync(`public${path}`);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(presentation.PAPER_MATERIAL_GRAIN_TILE_SIZE);
    expect(png.readUInt32BE(20)).toBe(presentation.PAPER_MATERIAL_GRAIN_TILE_SIZE);
    expect(presentation.shaderFrameGrainStyle({ grainOpacity: 0.2 }, 320).backgroundImage).toBe(`url("${path}")`);
  });

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

  it('probes actual filter pixels once, then draws natively without intermediate canvases', () => {
    const context = destination();
    const image = source();
    const create = vi.spyOn(document, 'createElement');
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(0.8)' }, bounds);
    expect(context.drawImage).toHaveBeenCalledWith(image, 20, 30, 500, 400);
    expect(context.filter).toBe('brightness(0.8)');
    expect(context.globalAlpha).toBe(0.6);
    expect(context.save).toHaveBeenCalledOnce();
    expect(context.restore).toHaveBeenCalledOnce();
    expect(probe.getImageData).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
    presentation.drawShaderFramePresentation(context, image, { filter: 'contrast(1.2)' }, bounds);
    expect(create).toHaveBeenCalledOnce();
  });

  it('bypasses both probe and pixel readback for identity color filters', () => {
    const context = destination();
    const image = source();
    const create = vi.spyOn(document, 'createElement');
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(1) contrast(1) saturate(1)' }, bounds);
    expect(context.drawImage).toHaveBeenCalledWith(image, 20, 30, 500, 400);
    expect(create).not.toHaveBeenCalled();
    expect(probe.getImageData).not.toHaveBeenCalled();
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
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(function (this: HTMLCanvasElement) {
      return (this.width === 1 && this.height === 1 ? probe : scratch) as unknown as CanvasRenderingContext2D;
    });
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

  it('keeps captured-image grain software-backed without changing native canvas acceleration', async () => {
    await preload();
    const scratch = { createPattern: vi.fn(() => ({})), drawImage: vi.fn(), setTransform: vi.fn(),
      clearRect: vi.fn(), scale: vi.fn(), fillRect: vi.fn(), globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '' };
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(scratch as unknown as CanvasRenderingContext2D);
    const context = destination();
    const captured = source();
    presentation.drawShaderFramePresentation(context, captured, { grainOpacity: 0.2 }, bounds);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenLastCalledWith('2d', { willReadFrequently: true });
    const live = document.createElement('canvas'); live.width = 1000; live.height = 800;
    presentation.drawShaderFramePresentation(context, live, { grainOpacity: 0.2 }, bounds);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenLastCalledWith('2d');
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

  function fallbackPixels(values: number[]) {
    // A writable expando is not filter support: probe still returns red.
    probe.getImageData.mockReturnValue({ data: new Uint8ClampedArray([255, 0, 0, 255]) });
    const scratch = { drawImage: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(values) })), putImageData: vi.fn(),
      globalAlpha: 1, globalCompositeOperation: 'source-over', filter: 'none' };
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(function (this: HTMLCanvasElement) {
      return (this.width === 1 && this.height === 1 ? probe : scratch) as unknown as CanvasRenderingContext2D;
    });
    return scratch;
  }

  it('falls back on pixel semantics, caches one immutable result and preserves destination alpha/geometry', () => {
    const scratch = fallbackPixels([100, 50, 20, 128]);
    const context = destination();
    const image = source();
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(0.5)' }, bounds);
    expect([...scratch.putImageData.mock.calls[0]![0].data]).toEqual([50, 25, 10, 128]);
    const output = vi.mocked(context.drawImage).mock.calls[0]![0];
    expect(output).not.toBe(image);
    expect(context.drawImage).toHaveBeenCalledWith(output, 20, 30, 500, 400);
    expect(context.globalAlpha).toBe(0.6);
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(0.5)' }, { ...bounds, x: 120 });
    expect(scratch.getImageData).toHaveBeenCalledOnce();
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(0.8)' }, bounds);
    expect(scratch.getImageData).toHaveBeenCalledTimes(2);
    expect(vi.mocked(context.drawImage).mock.calls[2]![0]).toBe(output);
    expect(probe.getImageData).toHaveBeenCalledOnce();
  });

  it('never caches mutable native shader pixels and sizes fallback work to the destination transform', () => {
    const scratch = fallbackPixels([100, 50, 20, 255]);
    const context = destination();
    context.getTransform = () => ({ a: 0.5, b: 0, c: 0, d: 0.5 } as DOMMatrix);
    const image = document.createElement('canvas'); image.width = 1000; image.height = 800;
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(0.5)' }, bounds);
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(0.5)' }, bounds);
    expect(scratch.getImageData).toHaveBeenCalledTimes(2);
    expect(scratch.getImageData).toHaveBeenCalledWith(0, 0, 250, 200);
    expect(context.drawImage).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), 20, 30, 500, 400);
  });

  it('does not suppress genuine pixel-security failures or reuse a partially changed result', () => {
    const scratch = fallbackPixels([100, 50, 20, 255]);
    const context = destination();
    const image = source();
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(0.5)' }, bounds);
    const error = new DOMException('The operation is insecure.', 'SecurityError');
    scratch.getImageData.mockImplementationOnce(() => { throw error; });
    expect(() => presentation.drawShaderFramePresentation(context, image, { filter: 'contrast(0.5)' }, bounds)).toThrow(error);
    expect(context.drawImage).toHaveBeenCalledOnce();
    presentation.drawShaderFramePresentation(context, image, { filter: 'brightness(0.5)' }, bounds);
    expect(scratch.getImageData).toHaveBeenCalledTimes(3);
  });

  it('applies the numeric fallback after soft-light grain, without filtering caller opacity twice', async () => {
    await preload();
    probe.getImageData.mockReturnValue({ data: new Uint8ClampedArray([255, 0, 0, 255]) });
    const grain = { createPattern: vi.fn(() => ({})), drawImage: vi.fn(), setTransform: vi.fn(),
      clearRect: vi.fn(), scale: vi.fn(), fillRect: vi.fn(), globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '' };
    const filter = { drawImage: vi.fn(), setTransform: vi.fn(), clearRect: vi.fn(),
      getImageData: vi.fn(() => ({ data: new Uint8ClampedArray([120, 80, 40, 255]) })), putImageData: vi.fn(),
      globalAlpha: 1, globalCompositeOperation: 'source-over' };
    const grainCanvases = new Set<HTMLCanvasElement>();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(function (this: HTMLCanvasElement) {
      if (this.width === 1 && this.height === 1) return probe as unknown as CanvasRenderingContext2D;
      if (!grainCanvases.size) grainCanvases.add(this);
      return (grainCanvases.has(this) ? grain : filter) as unknown as CanvasRenderingContext2D;
    });
    const context = destination();
    presentation.drawShaderFramePresentation(context, source(), { filter: 'brightness(0.5)', grainOpacity: 0.2 }, bounds);
    expect(grain.globalCompositeOperation).toBe('soft-light');
    expect(filter.drawImage).toHaveBeenCalledWith([...grainCanvases][0], 0, 0, 500, 400);
    expect(grain.fillRect.mock.invocationCallOrder[0]).toBeLessThan(filter.getImageData.mock.invocationCallOrder[0]!);
    expect([...filter.putImageData.mock.calls[0]![0].data]).toEqual([60, 40, 20, 255]);
    expect(context.globalAlpha).toBe(0.6);
    expect(context.filter).toBe('none');
  });
});
