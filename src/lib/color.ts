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

function delinearize(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function clampChannel(channel: number): number {
  return Math.max(0, Math.min(1, channel));
}

function channelToHex(channel: number): string {
  return Math.round(clampChannel(channel) * 255)
    .toString(16)
    .padStart(2, '0')
    .toLocaleUpperCase();
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

export function oklchToHex({ chroma, hue, lightness }: Oklch): string {
  const radians = (hue * Math.PI) / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lRoot ** 3;
  const m = mRoot ** 3;
  const s = sRoot ** 3;
  const red = delinearize(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = delinearize(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = delinearize(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  return `#${channelToHex(red)}${channelToHex(green)}${channelToHex(blue)}`;
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
