import { describe, expect, it } from 'vitest';

import {
  buildMotionFrames,
  canvasToImageBlob,
  encodeCanvasGif,
  exportCanvasDocumentStill,
  resolveExportDimensions,
  resolveSeamlessLoopOverlapFrames,
  seamlessLoopBlendAmount,
} from '../canvasExport';
import { createCanvasDocument, createCanvasElement } from '../canvasDocument';

describe('canvas export', () => {
  it('builds deterministic motion timestamps for GIF and MP4 encoders', () => {
    const frames = buildMotionFrames(2_400, 15);

    expect(frames).toHaveLength(36);
    expect(frames[0]).toEqual({ durationMs: 1_000 / 15, index: 0, timeMs: 0 });
    expect(frames.at(-1)?.timeMs).toBeCloseTo(2_333.333, 2);
  });

  it('rejects invalid motion schedules', () => {
    expect(() => buildMotionFrames(0, 15)).toThrow(RangeError);
    expect(() => buildMotionFrames(2_400, 0)).toThrow(RangeError);
  });

  it('resolves ratio-aware export dimensions with encoder-safe even pixels', () => {
    expect(resolveExportDimensions({ aspectHeight: 9, aspectWidth: 16, width: 1_281 }))
      .toEqual({ height: 722, width: 1_282 });
    expect(resolveExportDimensions({ aspectHeight: 630, aspectWidth: 1_200, width: 1_920 }))
      .toEqual({ height: 1_008, width: 1_920 });
    expect(resolveExportDimensions({ aspectHeight: 1, aspectWidth: 1, width: 99 }))
      .toEqual({ height: 320, width: 320 });
    expect(() => resolveExportDimensions({ aspectHeight: 0, aspectWidth: 16, width: 960 }))
      .toThrow(RangeError);
    expect(() => resolveExportDimensions({ aspectHeight: 9, aspectWidth: 16, width: Number.NaN }))
      .toThrow(/finite number/i);
    expect(() => resolveExportDimensions({
      aspectHeight: 9,
      aspectWidth: 16,
      maxWidth: 200,
      minWidth: 320,
      width: 960,
    })).toThrow(/limits are invalid/i);
  });

  it('uses a smooth loop envelope with identical cycle boundaries', () => {
    expect(seamlessLoopBlendAmount(0, 2_400)).toBe(0);
    expect(seamlessLoopBlendAmount(1_200, 2_400)).toBeCloseTo(0.5, 8);
    expect(seamlessLoopBlendAmount(2_400, 2_400)).toBe(1);
    expect(seamlessLoopBlendAmount(2_333.333, 2_400)).toBeGreaterThan(0.998);
    expect(seamlessLoopBlendAmount(-100, 2_400)).toBe(0);
    expect(seamlessLoopBlendAmount(3_000, 2_400)).toBe(1);
    expect(() => seamlessLoopBlendAmount(100, 0)).toThrow(/duration/i);
  });

  it('bounds the temporal overlap by duration, output size, and memory', () => {
    expect(resolveSeamlessLoopOverlapFrames({ durationMs: 1_600, fps: 15, height: 540, width: 960 })).toBe(7);
    expect(resolveSeamlessLoopOverlapFrames({ durationMs: 4_000, fps: 30, height: 2_160, width: 3_840 })).toBe(3);
  });

  it('requests the correct MIME type and quality for JPG output', async () => {
    let requestedMime = '';
    let requestedQuality: number | undefined;
    const canvas = {
      toBlob(callback: BlobCallback, mime?: string, quality?: number) {
        requestedMime = mime ?? '';
        requestedQuality = quality;
        callback(new Blob(['jpeg'], { type: mime }));
      },
    } as HTMLCanvasElement;

    const blob = await canvasToImageBlob(canvas, 'jpg', 0.9);

    expect(requestedMime).toBe('image/jpeg');
    expect(requestedQuality).toBe(0.9);
    expect(blob.type).toBe('image/jpeg');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('omits quality for PNG output and rejects empty browser encodes', async () => {
    let requestedQuality: number | undefined;
    const pngCanvas = {
      toBlob(callback: BlobCallback, mime?: string, quality?: number) {
        requestedQuality = quality;
        callback(new Blob(['png'], { type: mime }));
      },
    } as HTMLCanvasElement;
    expect((await canvasToImageBlob(pngCanvas, 'png')).type).toBe('image/png');
    expect(requestedQuality).toBeUndefined();

    const emptyCanvas = {
      toBlob(callback: BlobCallback) {
        callback(null);
      },
    } as HTMLCanvasElement;
    await expect(canvasToImageBlob(emptyCanvas, 'png')).rejects.toThrow(/empty file/i);
  });

  it('invariant_export_dimensions_follow_the_document_request_not_preview_dpr', async () => {
    const canvasDocument = createCanvasDocument(
      'document',
      'brand',
      'DPR-safe export',
      800,
      500,
      ['layers', 'pages']
    );
    const pageId = canvasDocument.pageIds[0]!;
    const background = createCanvasElement(
      'background',
      'Background',
      'shader',
      { height: 500, rotation: 0, width: 800, x: 0, y: 0 }
    );
    const artwork = createCanvasElement(
      'artwork',
      'Artwork',
      'component',
      { height: 500, rotation: 0, width: 800, x: 0, y: 0 }
    );
    canvasDocument.elements = { artwork, background };
    canvasDocument.pages[pageId] = {
      ...canvasDocument.pages[pageId]!,
      elementIds: ['background', 'artwork'],
    };

    const painted: string[] = [];
    const context = {
      clearRect() {},
      fillRect() {},
      fillStyle: '#000000',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      restore() {},
      save() {},
    } as Pick<
      CanvasRenderingContext2D,
      | 'clearRect'
      | 'fillRect'
      | 'fillStyle'
      | 'globalAlpha'
      | 'globalCompositeOperation'
      | 'restore'
      | 'save'
    > as CanvasRenderingContext2D;
    const output = {
      getContext: () => context,
      height: 0,
      toBlob(callback: BlobCallback, mime?: string) {
        callback(new Blob(['png'], { type: mime }));
      },
      width: 0,
    };

    const exported = await exportCanvasDocumentStill({
      canvasDocument,
      canvasFactory: () => output,
      height: 500,
      renderElement: (_context, layer) => painted.push(layer.element.id),
      width: 800,
    });

    expect({ height: output.height, width: output.width }).toEqual({ height: 500, width: 800 });
    expect(painted).toEqual(['background', 'artwork']);
    expect(exported.report.paintedElementIds).toEqual(painted);
    expect(exported.blob.type).toBe('image/png');
  });

  it('rejects GIF export when the canvas has no rendering context', async () => {
    const canvas = {
      getContext: () => null,
      height: 2,
      width: 2,
    } as Pick<HTMLCanvasElement, 'getContext' | 'height' | 'width'> as HTMLCanvasElement;
    await expect(encodeCanvasGif({
      canvas,
      durationMs: 300,
      fps: 10,
      renderFrame: () => undefined,
    })).rejects.toThrow(/rendering is unavailable/i);
  });

  it('encodes multiple independently-quantized GIF frames', async () => {
    let activeFrame = 0;
    const progress: number[] = [];
    const context = {
      getImageData() {
        return {
          data: new Uint8ClampedArray([
            activeFrame * 80, 20, 220, 255,
            240, activeFrame * 60, 30, 255,
            20, 220, activeFrame * 70, 255,
            255, 255, 255, 255,
          ]),
        };
      },
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      getContext: () => context,
      height: 2,
      width: 2,
    } as unknown as HTMLCanvasElement;

    const blob = await encodeCanvasGif({
      canvas,
      durationMs: 300,
      fps: 10,
      onProgress: (value) => progress.push(value),
      renderFrame: ({ index }) => { activeFrame = index; },
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const signature = new TextDecoder().decode(bytes.slice(0, 6));
    let graphicControlBlocks = 0;
    for (let index = 0; index < bytes.length - 2; index += 1) {
      if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04) graphicControlBlocks += 1;
    }

    expect(signature).toMatch(/^GIF8[79]a$/);
    expect(graphicControlBlocks).toBe(3);
    expect(blob.type).toBe('image/gif');
    expect(blob.size).toBeGreaterThan(20);
    expect(progress).toEqual([1 / 3, 2 / 3, 1]);
  });

  it('encodes multiple GIF frames against one global palette', async () => {
    let activeFrame = 0;
    const renderedFrames: number[] = [];
    const context = {
      getImageData() {
        return {
          data: new Uint8ClampedArray([
            activeFrame * 80, 20, 220, 255,
          240, activeFrame * 60, 30, 255,
          20, 220, activeFrame * 70, 255,
          247, 31, 90, 255,
          ]),
        };
      },
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      getContext: () => context,
      height: 2,
      width: 2,
    } as unknown as HTMLCanvasElement;

    const blob = await encodeCanvasGif({
      canvas,
      colors: 64,
      durationMs: 300,
      fps: 10,
      paletteFormat: 'rgb444',
      paletteStrategy: 'global',
      protectedColors: ['#F71F5A'],
      renderFrame: ({ index }) => { activeFrame = index; renderedFrames.push(index); },
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const frameDescriptors = Array.from(bytes).filter((value) => value === 0x2c).length;
    const globalColorTableSize = 2 ** ((bytes[10]! & 0b111) + 1);
    const globalColorTable = bytes.slice(13, 13 + globalColorTableSize * 3);
    const colors = Array.from({ length: globalColorTableSize }, (_, index) => (
      Array.from(globalColorTable.slice(index * 3, index * 3 + 3))
    ));

    expect(new TextDecoder().decode(bytes.slice(0, 6))).toMatch(/^GIF8[79]a$/);
    expect(frameDescriptors).toBeGreaterThanOrEqual(3);
    expect(colors).toContainEqual([247, 31, 90]);
    expect(renderedFrames).toEqual([0, 1, 2, 0, 1, 2]);
    expect(blob.size).toBeGreaterThan(20);
  });

  it('builds and verifies a seamless GIF from one continuous source timeline', async () => {
    let activeFrame = 0;
    const capturedTimes: number[] = [];
    let report: Parameters<NonNullable<Parameters<typeof encodeCanvasGif>[0]['onLoopReport']>>[0] | undefined;
    const context = {
      getImageData() {
        return {
          data: new Uint8ClampedArray([
            activeFrame * 17, 20, 220, 255,
            240, activeFrame * 13, 30, 255,
            20, 220, activeFrame * 11, 255,
            255, 255, 255, 255,
          ]),
        };
      },
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      getContext: () => context,
      height: 2,
      width: 2,
    } as unknown as HTMLCanvasElement;

    const blob = await encodeCanvasGif({
      canvas,
      durationMs: 600,
      fps: 10,
      loopMode: 'seamless',
      onLoopReport: (nextReport) => { report = nextReport; },
      renderFrame: (frame) => {
        activeFrame = frame.index;
        capturedTimes.push(frame.timeMs);
      },
    });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let graphicControlBlocks = 0;
    for (let index = 0; index < bytes.length - 2; index += 1) {
      if (bytes[index] === 0x21 && bytes[index + 1] === 0xf9 && bytes[index + 2] === 0x04) graphicControlBlocks += 1;
    }

    expect(capturedTimes).toEqual([0, 100, 200, 300, 400, 500, 600, 700]);
    expect(graphicControlBlocks).toBe(6);
    expect(report).toEqual({
      closureMismatchPixels: 0,
      mode: 'seamless',
      outputFrames: 6,
      overlapFrames: 2,
      sourceFrames: 8,
      verified: true,
    });
  });

  it('loads an MP4 container with AVC support', async () => {
    const { Mp4OutputFormat } = await import('mediabunny');
    const format = new Mp4OutputFormat();

    expect(format.mimeType).toBe('video/mp4');
    expect(format.getSupportedVideoCodecs()).toContain('avc');
  });
});
