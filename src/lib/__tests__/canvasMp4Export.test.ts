import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  addedFrames: [] as Array<{ duration: number; time: number }>,
  buffer: new ArrayBuffer(4) as ArrayBuffer | null,
  codec: 'avc' as string | null,
  qualityLevels: [] as string[],
  started: 0,
  finalized: 0,
}));

vi.mock('mediabunny', () => ({
  BufferTarget: class BufferTarget {
    buffer = mockState.buffer;
  },
  CanvasSource: class CanvasSource {
    constructor(_canvas: HTMLCanvasElement, _options: object) {}

    async add(time: number, duration: number) {
      mockState.addedFrames.push({ duration, time });
    }
  },
  Mp4OutputFormat: class Mp4OutputFormat {
    mimeType = 'video/mp4';

    getSupportedVideoCodecs() {
      return ['hevc', 'avc'];
    }
  },
  Output: class Output {
    constructor(_options: object) {}

    addVideoTrack(_source: object) {}

    async finalize() {
      mockState.finalized += 1;
    }

    async start() {
      mockState.started += 1;
    }
  },
  Quality: class Quality {
    constructor(level: string) {
      mockState.qualityLevels.push(level);
    }
  },
  getFirstEncodableVideoCodec: async () => mockState.codec,
}));

import { encodeCanvasMp4 } from '../canvasExport';

describe('canvas MP4 export', () => {
  beforeEach(() => {
    mockState.addedFrames.length = 0;
    mockState.buffer = new ArrayBuffer(4);
    mockState.codec = 'avc';
    mockState.qualityLevels.length = 0;
    mockState.started = 0;
    mockState.finalized = 0;
  });

  it.each([
    ['fast', 'medium'],
    ['balanced', 'high'],
    ['best', 'very-high'],
  ] as const)('encodes ordered %s frames at the expected quality', async (quality, expectedLevel) => {
    const renderedFrames: number[] = [];
    const progress: number[] = [];
    const canvas = { height: 2, width: 2 } as HTMLCanvasElement;
    const blob = await encodeCanvasMp4({
      canvas,
      durationMs: 200,
      fps: 10,
      onProgress: (value) => progress.push(value),
      quality,
      renderFrame: ({ index }) => {
        renderedFrames.push(index);
      },
    });

    expect(blob.type).toBe('video/mp4');
    expect(mockState.qualityLevels).toEqual([expectedLevel]);
    expect(renderedFrames).toEqual([0, 1]);
    expect(mockState.addedFrames).toEqual([
      { duration: 0.1, time: 0 },
      { duration: 0.1, time: 0.1 },
    ]);
    expect(progress).toEqual([0.5, 1]);
    expect(mockState.started).toBe(1);
    expect(mockState.finalized).toBe(1);
  });

  it('reports missing browser codec support before starting an encoder', async () => {
    mockState.codec = null;
    const canvas = { height: 2, width: 2 } as HTMLCanvasElement;

    await expect(encodeCanvasMp4({
      canvas,
      durationMs: 200,
      fps: 10,
      renderFrame: () => undefined,
    })).rejects.toThrow(/cannot encode an MP4/i);
    expect(mockState.started).toBe(0);
  });

  it('rejects an encoder that finalizes without bytes', async () => {
    mockState.buffer = new ArrayBuffer(0);
    const canvas = { height: 2, width: 2 } as HTMLCanvasElement;

    await expect(encodeCanvasMp4({
      canvas,
      durationMs: 200,
      fps: 10,
      renderFrame: () => undefined,
    })).rejects.toThrow(/empty file/i);
    expect(mockState.finalized).toBe(1);
  });
});
