type Rgb = {
  blue: number;
  green: number;
  red: number;
};

type Oklch = {
  chroma: number;
  hue: number;
  lightness: number;
};

type Hsv = {
  hue: number;
  saturation: number;
  value: number;
};

export function normalizeHex(value: string): string {
  const raw = value.trim().replace(/^#/, '');
  const expanded =
    raw.length === 3
      ? raw
          .split('')
          .map((character) => `${character}${character}`)
          .join('')
      : raw;

  if (!/^[\da-f]{6}$/i.test(expanded)) {
    throw new Error(`Unsupported HEX color: ${value}`);
  }

  return `#${expanded.toLocaleUpperCase()}`;
}

export function normalizeHexOrFallback(
  value: unknown,
  fallback = '#000000'
): string {
  let normalizedFallback = '#000000';
  try {
    normalizedFallback = normalizeHex(fallback);
  } catch {
    // Keep the guaranteed valid default when a caller also supplies a bad fallback.
  }
  if (typeof value !== 'string') return normalizedFallback;
  try {
    return normalizeHex(value);
  } catch {
    return normalizedFallback;
  }
}

function hexToRgb(value: string): Rgb {
  const hex = normalizeHex(value).slice(1);
  return {
    blue: Number.parseInt(hex.slice(4, 6), 16) / 255,
    green: Number.parseInt(hex.slice(2, 4), 16) / 255,
    red: Number.parseInt(hex.slice(0, 2), 16) / 255,
  };
}

export function hexToHsv(value: string): Hsv {
  const rgb = hexToRgb(value);
  const maximum = Math.max(rgb.red, rgb.green, rgb.blue);
  const minimum = Math.min(rgb.red, rgb.green, rgb.blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta > 0) {
    if (maximum === rgb.red) {
      hue = 60 * (((rgb.green - rgb.blue) / delta) % 6);
    } else if (maximum === rgb.green) {
      hue = 60 * ((rgb.blue - rgb.red) / delta + 2);
    } else {
      hue = 60 * ((rgb.red - rgb.green) / delta + 4);
    }
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: maximum === 0 ? 0 : delta / maximum,
    value: maximum,
  };
}

function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function delinearize(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function clampChannel(channel: number): number {
  if (!Number.isFinite(channel)) return 0;
  return Math.max(0, Math.min(1, channel));
}

function channelToHex(channel: number): string {
  return Math.round(clampChannel(channel) * 255)
    .toString(16)
    .padStart(2, '0')
    .toLocaleUpperCase();
}

export function mixHexColors(start: string, end: string, amount: number): string {
  const from = hexToRgb(start);
  const to = hexToRgb(end);
  const progress = clampChannel(amount);
  const channel = (first: number, second: number) =>
    Math.round((first + (second - first) * progress) * 255)
      .toString(16)
      .padStart(2, '0')
      .toLocaleUpperCase();

  return `#${channel(from.red, to.red)}${channel(from.green, to.green)}${channel(from.blue, to.blue)}`;
}

export function colorContrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const normalized = normalizeHex(hex).slice(1);
    const channels = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255);
    const [red, green, blue] = channels.map((channel) => linearize(channel));
    return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
  };
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

export function resolveReadableColor(
  background: string,
  preferred: string,
  minimumRatio = 4.5
): { color: string; fallbackApplied: boolean; ratio: number } {
  const normalizedPreferred = normalizeHex(preferred);
  const preferredRatio = colorContrastRatio(background, normalizedPreferred);
  if (preferredRatio >= minimumRatio) {
    return { color: normalizedPreferred, fallbackApplied: false, ratio: preferredRatio };
  }

  const candidates = ['#FFFFFF', '#000000'] as const;
  const fallback = candidates
    .map((color) => ({ color, ratio: colorContrastRatio(background, color) }))
    .sort((first, second) => second.ratio - first.ratio)[0]!;
  return { ...fallback, fallbackApplied: true };
}

export function hsvToHex(hue: number, saturation: number, value: number): string {
  const finiteHue = Number.isFinite(hue) ? hue : 0;
  const normalizedHue = ((finiteHue % 360) + 360) % 360;
  const normalizedSaturation = clampChannel(saturation);
  const normalizedValue = clampChannel(value);
  const chroma = normalizedValue * normalizedSaturation;
  const sector = normalizedHue / 60;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = normalizedValue - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (sector < 1) [red, green, blue] = [chroma, secondary, 0];
  else if (sector < 2) [red, green, blue] = [secondary, chroma, 0];
  else if (sector < 3) [red, green, blue] = [0, chroma, secondary];
  else if (sector < 4) [red, green, blue] = [0, secondary, chroma];
  else if (sector < 5) [red, green, blue] = [secondary, 0, chroma];
  else [red, green, blue] = [chroma, 0, secondary];

  return `#${channelToHex(red + offset)}${channelToHex(green + offset)}${channelToHex(blue + offset)}`;
}

export function hexToOklch(value: string): Oklch {
  const rgb = hexToRgb(value);
  const red = linearize(rgb.red);
  const green = linearize(rgb.green);
  const blue = linearize(rgb.blue);
  const l = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const m = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const s = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const b = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.sqrt(a * a + b * b);
  const hue = chroma < 0.0001 ? 0 : (Math.atan2(b, a) * 180) / Math.PI;

  return {
    chroma,
    hue: hue < 0 ? hue + 360 : hue,
    lightness,
  };
}

/** Linear sRGB channels for an OKLCH color, unclamped so callers can test the gamut. */
function oklchToLinearRgb({ chroma, hue, lightness }: Oklch): Rgb {
  const finiteChroma = Number.isFinite(chroma) ? Math.max(0, chroma) : 0;
  const finiteHue = Number.isFinite(hue) ? hue : 0;
  const finiteLightness = Number.isFinite(lightness) ? clampChannel(lightness) : 0;
  const radians = (finiteHue * Math.PI) / 180;
  const a = finiteChroma * Math.cos(radians);
  const b = finiteChroma * Math.sin(radians);
  const l = (finiteLightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (finiteLightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (finiteLightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    blue: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    green: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    red: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
  };
}

export function oklchToHex(color: Oklch): string {
  const { blue, green, red } = oklchToLinearRgb(color);
  return `#${channelToHex(delinearize(red))}${channelToHex(delinearize(green))}${channelToHex(delinearize(blue))}`;
}

/** True when the OKLCH color is displayable in sRGB without clipping. */
export function oklchInSrgbGamut(color: Oklch, tolerance = 0.0005): boolean {
  const { blue, green, red } = oklchToLinearRgb(color);
  return [red, green, blue].every((channel) => channel >= -tolerance && channel <= 1 + tolerance);
}

/** Keep lightness and hue; reduce chroma until the color fits sRGB. */
export function gamutMapOklch(color: Oklch): Oklch {
  if (oklchInSrgbGamut(color)) return color;
  let low = 0;
  let high = Math.max(0, color.chroma);
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const middle = (low + high) / 2;
    if (oklchInSrgbGamut({ ...color, chroma: middle })) low = middle;
    else high = middle;
  }
  return { ...color, chroma: low };
}

/** Euclidean distance in OKLab, about 0.02 for a just-noticeable difference. */
export function oklabDistance(first: string, second: string): number {
  const toLab = (hex: string) => {
    const { chroma, hue, lightness } = hexToOklch(hex);
    const radians = (hue * Math.PI) / 180;
    return [lightness, chroma * Math.cos(radians), chroma * Math.sin(radians)] as const;
  };
  const [l1, a1, b1] = toLab(first);
  const [l2, a2, b2] = toLab(second);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/** Linear-light sRGB channels (0–1) for a HEX color. */
export function hexToLinearRgb(value: string): [number, number, number] {
  const rgb = hexToRgb(value);
  return [linearize(rgb.red), linearize(rgb.green), linearize(rgb.blue)];
}

/** HEX for linear-light sRGB channels; out-of-range channels are clamped. */
export function linearRgbToHex([red, green, blue]: readonly [number, number, number]): string {
  return `#${channelToHex(delinearize(clampChannel(red)))}${channelToHex(delinearize(clampChannel(green)))}${channelToHex(delinearize(clampChannel(blue)))}`;
}

export function parseOklch(value: string): Oklch | null {
  const match = value
    .trim()
    .match(/^oklch\(\s*(-?[\d.]+)(%)?\s+(-?[\d.]+)\s+(-?[\d.]+)(?:deg)?\s*\)$/i);
  if (!match) return null;

  const rawLightness = Number(match[1]);
  const chroma = Number(match[3]);
  const hue = Number(match[4]);
  if (![rawLightness, chroma, hue].every(Number.isFinite)) return null;

  return {
    chroma: Math.max(0, chroma),
    hue: ((hue % 360) + 360) % 360,
    lightness: Math.max(0, Math.min(1, match[2] ? rawLightness / 100 : rawLightness)),
  };
}

function trimNumber(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '');
}

export function formatOklch(value: string): string {
  const color = hexToOklch(value);
  return `oklch(${trimNumber(color.lightness * 100, 1)}% ${trimNumber(color.chroma, 3)} ${trimNumber(color.hue, 1)})`;
}
