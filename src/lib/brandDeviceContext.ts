/**
 * The shared contract for graphic device renderers: each draws one identity's
 * device as inner SVG markup for a box of any size, on a dark or light ground.
 */
import type { BrandDeviceTone, BrandPalette } from './brandOutputKit';
import { colorContrastRatio } from './color';

export type DeviceContext = {
  h: number;
  /** Prefixes gradient, pattern, filter and mask IDs so devices can share a document. */
  id: (name: string) => string;
  palette: BrandPalette;
  /** Seeded, so the same element draws the same device every time. */
  random: () => number;
  tone: BrandDeviceTone;
  w: number;
};

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function deviceBackground(context: DeviceContext, dark: string, light: string): string {
  return `<rect width="${round(context.w)}" height="${round(context.h)}" fill="${context.tone === 'dark' ? dark : light}"/>`;
}

export function contrastRatio(first: string, second: string): number {
  try {
    return colorContrastRatio(first, second);
  } catch {
    return 1;
  }
}

/** The palette colour (or plain white or near-black) that reads best on a background. */
export function readableOn(background: string, palette: BrandPalette): string {
  const candidates = [palette.ink, palette.paper, '#FFFFFF', '#0B0B0B'];
  return candidates.reduce((best, candidate) => (
    contrastRatio(background, candidate) > contrastRatio(background, best) + 0.4 ? candidate : best
  ), candidates[0]!);
}
