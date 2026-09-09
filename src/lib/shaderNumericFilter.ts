export const SHADER_NUMERIC_FILTER_PATTERN = /^(?:(?:brightness|contrast|saturate)\((?:\d+(?:\.\d+)?|\.\d+)\)(?:\s+|$)){1,3}$/;

export function shaderNumericFilterSteps(filter: string | undefined) {
  if (!filter || filter === 'none') return [];
  if (filter.length > 512 || !SHADER_NUMERIC_FILTER_PATTERN.test(filter)) throw new TypeError('The captured shader filter is invalid.');
  return Array.from(filter.matchAll(/(brightness|contrast|saturate)\(([\d.]+)\)/g), ([, kind, value]) => {
    const amount = Number(value);
    if (!Number.isFinite(amount)) throw new TypeError('The captured shader filter amount is invalid.');
    return { kind, amount };
  }).filter(({ amount }) => amount !== 1);
}

/** CSS numeric filters operate on unpremultiplied sRGB, clamped after each step.
 * https://www.w3.org/TR/filter-effects-1/#FilterPrimitivesOverview
 */
export function applyShaderNumericFilter(pixels: Uint8ClampedArray, filter: string): void {
  for (const { kind, amount } of shaderNumericFilterSteps(filter)) {
    if (kind === 'saturate') {
      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index]!;
        const green = pixels[index + 1]!;
        const blue = pixels[index + 2]!;
        const gray = red * 0.213 + green * 0.715 + blue * 0.072;
        pixels[index] = gray + (red - gray) * amount;
        pixels[index + 1] = gray + (green - gray) * amount;
        pixels[index + 2] = gray + (blue - gray) * amount;
      }
    } else {
      const center = kind === 'contrast' ? 127.5 : 0;
      for (let index = 0; index < pixels.length; index += 4) {
        pixels[index] = (pixels[index]! - center) * amount + center;
        pixels[index + 1] = (pixels[index + 1]! - center) * amount + center;
        pixels[index + 2] = (pixels[index + 2]! - center) * amount + center;
      }
    }
  }
}
