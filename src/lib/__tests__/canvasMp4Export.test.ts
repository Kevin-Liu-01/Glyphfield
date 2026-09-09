import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockState = vi.hoisted(() => ({
  addedAudio: [] as unknown[],
  audioCodec: 'aac' as string | null,
  audioTracks: 0,
  addedFrames: [] as Array<{ duration: number; time: number }>,
  buffer: new ArrayBuffer(4) as ArrayBuffer | null,
  codec: 'avc' as string | null,
  qualityLevels: [] as string[],
  started: 0,
  finalized: 0,
  encodedMetadata: undefined as EncodedVideoChunkMetadata | undefined,
  muxedMetadata: undefined as EncodedVideoChunkMetadata | undefined,
}));

vi.mock('mediabunny', () => ({
  AudioBufferSource: class AudioBufferSource {
    constructor(_options: object) {}

    async add(audio: unknown) {
      mockState.addedAudio.push(audio);
    }
  },
  BufferTarget: class BufferTarget {
    buffer = mockState.buffer;
  },
  CanvasSource: class CanvasSource {
    constructor(_canvas: HTMLCanvasElement, private options: {
      onEncodedPacket?: (packet: unknown, metadata: EncodedVideoChunkMetadata | undefined) => void;
    }) {}

    async add(time: number, duration: number) {
      this.options.onEncodedPacket?.({}, mockState.encodedMetadata);
      mockState.muxedMetadata = structuredClone(mockState.encodedMetadata);
      mockState.addedFrames.push({ duration, time });
    }
  },
  Mp4OutputFormat: class Mp4OutputFormat {
    mimeType = 'video/mp4';

    getSupportedVideoCodecs() {
      return ['hevc', 'avc'];
    }

    getSupportedAudioCodecs() {
      return ['aac', 'opus'];
    }
  },
  Output: class Output {
    constructor(_options: object) {}

    addAudioTrack(_source: object) {
      mockState.audioTracks += 1;
    }

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
  getFirstEncodableAudioCodec: async () => mockState.audioCodec,
  getFirstEncodableVideoCodec: async () => mockState.codec,
}));

import { encodeCanvasMp4 } from '../canvasExport';

describe('canvas MP4 export', () => {
  beforeEach(() => {
    mockState.addedAudio.length = 0;
    mockState.audioCodec = 'aac';
    mockState.audioTracks = 0;
    mockState.addedFrames.length = 0;
    mockState.buffer = new ArrayBuffer(4);
    mockState.codec = 'avc';
    mockState.qualityLevels.length = 0;
    mockState.started = 0;
    mockState.finalized = 0;
    mockState.encodedMetadata = undefined;
    mockState.muxedMetadata = undefined;
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

  it('reconciles actual encoded AVC range before the MP4 muxer consumes its metadata', async () => {
    mockState.encodedMetadata = { decoderConfig: { codec: 'avc1.64000d',
      description: Uint8Array.from(Buffer.from('0164000dffe1000b2764000dac56281419f9d001000428ee3cb0fdf8f800', 'hex')),
      colorSpace: { fullRange: true, primaries: 'bt709', transfer: 'iec61966-2-1', matrix: 'bt709' } } };
    await encodeCanvasMp4({ canvas: { height: 180, width: 320 } as HTMLCanvasElement,
      durationMs: 100, fps: 10, renderFrame: () => undefined });
    expect(mockState.muxedMetadata!.decoderConfig!.colorSpace).toEqual({
      fullRange: false, primaries: 'bt709', transfer: 'iec61966-2-1', matrix: 'bt709',
    });
  });

  it('adds a decoded audio buffer to the MP4 when supplied', async () => {
    const canvas = { height: 2, width: 2 } as HTMLCanvasElement;
    const audio = { numberOfChannels: 2, sampleRate: 48_000 } as AudioBuffer;

    await encodeCanvasMp4({
      audio,
      canvas,
      durationMs: 200,
      fps: 10,
      renderFrame: () => undefined,
    });

    expect(mockState.audioTracks).toBe(1);
    expect(mockState.addedAudio).toEqual([audio]);
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
