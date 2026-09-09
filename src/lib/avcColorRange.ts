const EXTENDED_PROFILES = new Set([44, 83, 86, 100, 110, 118, 122, 128, 134, 135, 138, 139, 244]);

class SpsBits {
  private cursor = 0;
  constructor(private readonly bytes: Uint8Array) {}

  read(count = 1): number {
    if (count > 32 || this.cursor + count > this.bytes.length * 8) throw new RangeError('Incomplete SPS');
    let value = 0;
    for (let index = 0; index < count; index += 1) {
      value = value * 2 + ((this.bytes[this.cursor >> 3] >> (7 - (this.cursor & 7))) & 1);
      this.cursor += 1;
    }
    return value;
  }

  unsigned(): number {
    let zeros = 0;
    while (this.read() === 0) {
      if (++zeros > 30) throw new RangeError('Invalid SPS Exp-Golomb value');
    }
    return 2 ** zeros - 1 + this.read(zeros);
  }

  signed(): number {
    const value = this.unsigned();
    return value % 2 ? (value + 1) / 2 : -value / 2;
  }
}

function spsBits(nal: Uint8Array): SpsBits {
  if ((nal[0] & 0x9f) !== 7) throw new RangeError('Not an SPS NAL');
  const rbsp: number[] = [];
  for (let index = 1; index < nal.length; index += 1) {
    if (index >= 3 && nal[index] === 3 && nal[index - 1] === 0 && nal[index - 2] === 0) {
      if (index + 1 >= nal.length || nal[index + 1] > 3) throw new RangeError('Invalid SPS escape');
      continue;
    }
    rbsp.push(nal[index]);
  }
  return new SpsBits(Uint8Array.from(rbsp));
}

function skipExtendedProfile(bits: SpsBits): void {
  const chromaFormat = bits.unsigned();
  if (chromaFormat > 3) throw new RangeError('Invalid SPS chroma format');
  if (chromaFormat === 3) bits.read(); // separate_colour_plane_flag
  bits.unsigned(); // bit_depth_luma_minus8
  bits.unsigned(); // bit_depth_chroma_minus8
  bits.read(); // qpprime_y_zero_transform_bypass_flag
  if (!bits.read()) return; // seq_scaling_matrix_present_flag
  for (let list = 0; list < (chromaFormat === 3 ? 12 : 8); list += 1) {
    if (!bits.read()) continue;
    let previous = 8;
    let next = 8;
    for (let index = 0; index < (list < 6 ? 16 : 64); index += 1) {
      if (next !== 0) next = ((previous + bits.signed()) % 256 + 256) % 256;
      if (next !== 0) previous = next;
    }
  }
}

function skipPictureOrder(bits: SpsBits): void {
  const mode = bits.unsigned();
  if (mode === 0) bits.unsigned(); // log2_max_pic_order_cnt_lsb_minus4
  else if (mode === 1) {
    bits.read(); // delta_pic_order_always_zero_flag
    bits.signed(); // offset_for_non_ref_pic
    bits.signed(); // offset_for_top_to_bottom_field
    const cycle = bits.unsigned();
    if (cycle > 255) throw new RangeError('Invalid SPS reference cycle');
    for (let index = 0; index < cycle; index += 1) bits.signed();
  } else if (mode !== 2) throw new RangeError('Invalid SPS picture order');
}

function spsFullRange(nal: Uint8Array): boolean {
  const bits = spsBits(nal);
  const profile = bits.read(8);
  bits.read(16); // constraint flags, level_idc
  bits.unsigned(); // seq_parameter_set_id
  if (EXTENDED_PROFILES.has(profile)) skipExtendedProfile(bits);
  else if (![66, 77, 88].includes(profile)) throw new RangeError('Unknown SPS profile');
  bits.unsigned(); // log2_max_frame_num_minus4
  skipPictureOrder(bits);
  bits.unsigned(); // max_num_ref_frames
  bits.read(); // gaps_in_frame_num_value_allowed_flag
  bits.unsigned(); // pic_width_in_mbs_minus1
  bits.unsigned(); // pic_height_in_map_units_minus1
  if (!bits.read()) bits.read(); // frame_mbs_only_flag, mb_adaptive_frame_field_flag
  bits.read(); // direct_8x8_inference_flag
  if (bits.read()) { // frame_cropping_flag
    for (let index = 0; index < 4; index += 1) bits.unsigned();
  }
  // ITU-T H.264 Annex E.2.1: absent video_full_range_flag is inferred as 0,
  // including absent VUI or video_signal_type_present_flag. Preserve explicit 1.
  // https://www.itu.int/rec/T-REC-H.264
  if (!bits.read()) return false; // vui_parameters_present_flag
  if (bits.read() && bits.read(8) === 255) bits.read(32); // extended aspect ratio
  if (bits.read()) bits.read(); // overscan_info_present_flag
  if (!bits.read()) return false; // video_signal_type_present_flag
  bits.read(3); // video_format
  return Boolean(bits.read());
}

function hasCompletePictureSets(bytes: Uint8Array, start: number): boolean {
  if (start >= bytes.length) return false; // numOfPictureParameterSets
  let cursor = start;
  const count = bytes[cursor++];
  for (let index = 0; index < count; index += 1) {
    if (cursor + 2 > bytes.length) return false;
    const size = bytes[cursor] * 256 + bytes[cursor + 1];
    cursor += 2;
    if (size < 1 || cursor + size > bytes.length || (bytes[cursor] & 0x9f) !== 8) return false;
    cursor += size;
  }
  return true;
}

function avccFullRange(description: AllowSharedBufferSource): boolean | null {
  const bytes = ArrayBuffer.isView(description)
    ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
    : new Uint8Array(description);
  if (bytes.length < 7 || bytes.length > 65_536 || bytes[0] !== 1
    || (bytes[4] & 252) !== 252 || (bytes[5] & 224) !== 224) return null;
  const count = bytes[5] & 31;
  if (!count) return null;
  let cursor = 6;
  let range: boolean | null = null;
  try {
    for (let index = 0; index < count; index += 1) {
      if (cursor + 2 > bytes.length) return null;
      const size = bytes[cursor] * 256 + bytes[cursor + 1];
      cursor += 2;
      if (size < 4 || cursor + size > bytes.length) return null;
      const next = spsFullRange(bytes.subarray(cursor, cursor + size));
      if (range !== null && range !== next) return null;
      range = next;
      cursor += size;
    }
    if (!hasCompletePictureSets(bytes, cursor)) return null;
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
  return range;
}

/** Called before muxing encoder output, never on the live animation render path. */
export function reconcileAvcColorRange(metadata: EncodedVideoChunkMetadata | undefined): void {
  const config = metadata?.decoderConfig;
  if (!config?.description || !/^avc[13]\./i.test(config.codec)) return;
  const fullRange = avccFullRange(config.description);
  if (fullRange === null || config.colorSpace?.fullRange === fullRange) return;
  // WebKit may copy the full-range *input canvas* descriptor despite emitting
  // limited-range H.264. Align MP4 colr with the encoded SPS, not a UA guess.
  metadata!.decoderConfig = { ...config, colorSpace: { ...config.colorSpace, fullRange } };
}
