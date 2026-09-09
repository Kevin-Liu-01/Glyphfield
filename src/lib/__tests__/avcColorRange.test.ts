import { describe, expect, it } from 'vitest';
import { reconcileAvcColorRange } from '../avcColorRange';

// Actual WebKit H.264 output: high profile, no VUI, limited YUV pixels. The
// encoder incorrectly labeled its decoderConfig as full-range canvas RGB.
const safariAvcc = Uint8Array.from(Buffer.from('0164000dffe1000b2764000dac56281419f9d001000428ee3cb0fdf8f800', 'hex'));

function metadata(description = safariAvcc, fullRange = true): EncodedVideoChunkMetadata {
  return { decoderConfig: { codec: 'avc1.64000d', description, codedWidth: 320, codedHeight: 180,
    colorSpace: { fullRange, primaries: 'bt709', transfer: 'iec61966-2-1', matrix: 'bt709' } } };
}

function baselineSps(range: boolean | 'no-signal' | 'no-vui', aspectRatio = false) {
  // A minimal Baseline SPS through video_signal_type_present_flag. All unsigned
  // Exp-Golomb values here are zero (bit 1); dimensions are one macroblock.
  let bits = '01000010' + '00000000' + '00011110'; // profile, constraints, level
  bits += '1' + '1' + '1' + '1' + '1' + '0' + '1' + '1' + '1' + '1' + '0';
  bits += range === 'no-vui' ? '0' : '1';
  if (range !== 'no-vui') {
    bits += aspectRatio ? '1' + '11111111' + '0000000000000001'.repeat(2) : '0';
    bits += '0'; // overscan_info_present_flag
    bits += range === 'no-signal' ? '0' : '1' + '101' + (range ? '1' : '0') + '0';
  }
  bits += '1'; // rbsp_stop_one_bit
  bits = bits.padEnd(Math.ceil(bits.length / 8) * 8, '0');
  return Uint8Array.from([0x67, ...bits.match(/.{8}/g)!.map((part) => parseInt(part, 2))]);
}

function avcc(...sps: Uint8Array[]) {
  return Uint8Array.from([1, 66, 0, 30, 255, 224 | sps.length,
    ...sps.flatMap((bytes) => [bytes.length >> 8, bytes.length & 255, ...bytes]), 0]);
}

describe('AVC encoded color range', () => {
  it('fixes the actual Safari limited-range SPS metadata without changing the encoded bytes or other fields', () => {
    const value = metadata();
    const before = structuredClone(value);
    reconcileAvcColorRange(value);
    expect(value).toEqual({ decoderConfig: { ...before.decoderConfig,
      colorSpace: { ...before.decoderConfig!.colorSpace, fullRange: false } } });
    expect(value.decoderConfig!.description).toBe(safariAvcc);
  });

  it.each([true, false, 'no-signal', 'no-vui'] as const)('respects SPS range %s without a browser-name check', (range) => {
    const value = metadata(avcc(baselineSps(range, true)), range !== true);
    reconcileAvcColorRange(value);
    expect(value.decoderConfig!.colorSpace!.fullRange).toBe(range === true);
  });

  it('reads ArrayBufferView offsets rather than the surrounding allocation', () => {
    const bytes = new Uint8Array(safariAvcc.length + 8);
    bytes.set(safariAvcc, 4);
    const value = metadata(bytes.subarray(4, -4));
    reconcileAvcColorRange(value);
    expect(value.decoderConfig!.colorSpace!.fullRange).toBe(false);
  });

  it.each([
    ['truncated', safariAvcc.slice(0, 10)],
    ['truncated PPS', safariAvcc.slice(0, 23)],
    ['missing PPS count', safariAvcc.slice(0, 19)],
    ['invalid reserved header', Uint8Array.from([1, 66, 0, 30, 0, ...avcc(baselineSps(false)).slice(5)])],
    ['wrong header', Uint8Array.of(0, 1, 2, 3, 4, 5, 6)],
    ['no SPS', avcc()],
    ['mixed ranges', avcc(baselineSps(true), baselineSps(false))],
    ['non-SPS NAL', avcc(Uint8Array.of(0x68, 0, 0, 0, 0))],
    ['unbounded Exp-Golomb', avcc(Uint8Array.from([0x67, 66, 0, 30, ...Array.from({ length: 80 }, () => 0)]))],
  ])('leaves %s metadata untouched', (_name, bytes) => {
    const value = metadata(bytes as Uint8Array<ArrayBuffer>);
    const before = structuredClone(value);
    reconcileAvcColorRange(value);
    expect(value).toEqual(before);
  });

  it('leaves unsupported codecs and missing descriptions untouched', () => {
    for (const value of [undefined, {}, { decoderConfig: { codec: 'avc1.64000d' } },
      { decoderConfig: { ...metadata().decoderConfig!, codec: 'hvc1.1.6.L93.B0' } }]) {
      const before = structuredClone(value);
      reconcileAvcColorRange(value);
      expect(value).toEqual(before);
    }
  });
});
