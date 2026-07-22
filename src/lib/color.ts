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

function hexToRgb(value: string): Rgb {
  const hex = normalizeHex(value).slice(1);
  return {
    blue: Number.parseInt(hex.slice(4, 6), 16) / 255,
    green: Number.parseInt(hex.slice(2, 4), 16) / 255,
    red: Number.parseInt(hex.slice(0, 2), 16) / 255,
  };
}

function linearize(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
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

function trimNumber(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.0+$|(?<=\.[0-9]*[1-9])0+$/, '');
}

export function formatOklch(value: string): string {
  const color = hexToOklch(value);
  return `oklch(${trimNumber(color.lightness * 100, 1)}% ${trimNumber(color.chroma, 3)} ${trimNumber(color.hue, 1)})`;
}
