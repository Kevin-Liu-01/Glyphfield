import { afterEach, describe, expect, it, vi } from 'vitest';

import { drawCanvasGlyph, drawCanvasImageCover, loadCanvasImage } from '../canvasDrawing';

describe('canvas drawing primitives', () => {
  const NativeImage = globalThis.Image;

  afterEach(() => {
    globalThis.Image = NativeImage;
  });

  it('scales glyphs continuously in document coordinates without changing the font', () => {
    const setTransform = vi.fn();
    const fillText = vi.fn();
    const context = { font: '500 32px Switzer', setTransform, fillText } as unknown as CanvasRenderingContext2D;

    drawCanvasGlyph(context, 'G', 20.5, 12.25, 0.3125, 2);
    expect(setTransform).toHaveBeenLastCalledWith(0.625, 0, 0, 0.625, 41, 24.5);
    expect(fillText).toHaveBeenLastCalledWith('G', 0, 0);
    drawCanvasGlyph(context, 'L', -8, 16, 0.35, 0.5);
    expect(setTransform).toHaveBeenLastCalledWith(0.175, 0, 0, 0.175, -4, 8);
    expect(fillText).toHaveBeenLastCalledWith('L', 0, 0);
    expect(context.font).toBe('500 32px Switzer');
  });

  it('covers the destination without changing the source aspect ratio', () => {
    const drawImage = vi.fn();
    const context = { drawImage } as unknown as CanvasRenderingContext2D;
    const source = {} as CanvasImageSource;

    drawCanvasImageCover(context, source, 400, 200, 300, 300);

    expect(drawImage).toHaveBeenCalledWith(source, -150, 0, 600, 300);
  });

  it('requests asynchronous decoding and resolves the loaded image', async () => {
    class TestImage {
      decoding = 'auto';
      onerror: ((event: Event) => void) | null = null;
      onload: (() => void) | null = null;
      private value = '';

      get src() {
        return this.value;
      }

      set src(value: string) {
        this.value = value;
        queueMicrotask(() => this.onload?.());
      }
    }
    globalThis.Image = TestImage as unknown as typeof Image;

    const image = await loadCanvasImage('/asset.png');

    expect(image.src).toBe('/asset.png');
    expect(image.decoding).toBe('async');
  });

  it('rejects when image loading fails', async () => {
    const failure = new Event('error');
    class TestImage {
      decoding = 'auto';
      onerror: ((event: Event) => void) | null = null;
      onload: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onerror?.(failure));
      }
    }
    globalThis.Image = TestImage as unknown as typeof Image;

    await expect(loadCanvasImage('/missing.png')).rejects.toBe(failure);
  });
});
