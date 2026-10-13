/** Color conversion for shader uniforms: sRGB hex in, linear light and OKLab out. */
export type Vec3 = readonly [number, number, number];

export function hexToSrgb(hex: string): Vec3 {
  const value = Number.parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function channelToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

export function srgbToLinear([red, green, blue]: Vec3): Vec3 {
  return [channelToLinear(red), channelToLinear(green), channelToLinear(blue)];
}

export function linearToOklab([red, green, blue]: Vec3): Vec3 {
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ];
}

export type ShaderColor = { lab: Vec3; linear: Vec3 };

const shaderColorCache = new Map<string, ShaderColor>();

/** Cached per hex string; uniforms are re-sent every frame. */
export function shaderColor(hex: string): ShaderColor {
  const cached = shaderColorCache.get(hex);
  if (cached) return cached;
  const linear = srgbToLinear(hexToSrgb(hex));
  const color = { lab: linearToOklab(linear), linear };
  if (shaderColorCache.size > 256) shaderColorCache.clear();
  shaderColorCache.set(hex, color);
  return color;
}
