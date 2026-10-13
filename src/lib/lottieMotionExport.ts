/**
 * Maps output time to Lottie frames for GIF/MP4 export, honouring the trimmed
 * segment, playback speed, and direction exactly as the preview plays it.
 */

export type LottieExportTiming = {
  frameRate: number;
  mode: 'bounce' | 'forward' | 'reverse' | 'reverse-bounce';
  segmentEnd: number;
  segmentStart: number;
  speed: number;
};

function passDurationMs({ frameRate, segmentEnd, segmentStart, speed }: LottieExportTiming): number {
  const span = Math.max(1, segmentEnd - segmentStart);
  return (span / Math.max(1, frameRate)) * 1000 / Math.max(0.1, speed);
}

export function lottieExportDurationMs(timing: LottieExportTiming): number {
  const pass = passDurationMs(timing);
  return timing.mode === 'bounce' || timing.mode === 'reverse-bounce' ? pass * 2 : pass;
}

export function lottieExportFrameAt(timeMs: number, timing: LottieExportTiming): number {
  const pass = passDurationMs(timing);
  const span = Math.max(1, timing.segmentEnd - timing.segmentStart);
  const time = Math.max(0, timeMs);
  const forward = (progress: number) => timing.segmentStart + Math.min(1, progress) * span;
  const backward = (progress: number) => timing.segmentEnd - Math.min(1, progress) * span;
  if (timing.mode === 'forward') return forward(time / pass);
  if (timing.mode === 'reverse') return backward(time / pass);
  const firstHalf = time < pass;
  const progress = firstHalf ? time / pass : (time - pass) / pass;
  if (timing.mode === 'bounce') return firstHalf ? forward(progress) : backward(progress);
  return firstHalf ? backward(progress) : forward(progress);
}

/**
 * Composites a bottom-up, premultiplied WebGL readback over an opaque top-down
 * RGBA background in place. One pass flips rows and blends, so export frames
 * never round-trip through an extra canvas.
 */
export function blendPremultipliedFrame(
  source: Uint8Array,
  target: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const stride = width * 4;
  for (let row = 0; row < height; row += 1) {
    const sourceRow = (height - row - 1) * stride;
    const targetRow = row * stride;
    for (let column = 0; column < stride; column += 4) {
      const from = sourceRow + column;
      const alpha = source[from + 3]!;
      if (alpha === 0) continue;
      const to = targetRow + column;
      if (alpha === 255) {
        target[to] = source[from]!;
        target[to + 1] = source[from + 1]!;
        target[to + 2] = source[from + 2]!;
      } else {
        const inverse = 1 - alpha / 255;
        target[to] = source[from]! + target[to]! * inverse;
        target[to + 1] = source[from + 1]! + target[to + 1]! * inverse;
        target[to + 2] = source[from + 2]! + target[to + 2]! * inverse;
      }
      target[to + 3] = 255;
    }
  }
}

/** Fills an RGBA buffer with one opaque #RRGGBB colour. */
export function fillOpaque(target: Uint8ClampedArray, hex: string): void {
  const value = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1] ?? '000000';
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  for (let index = 0; index < target.length; index += 4) {
    target[index] = red;
    target[index + 1] = green;
    target[index + 2] = blue;
    target[index + 3] = 255;
  }
}
