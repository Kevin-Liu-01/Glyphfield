/**
 * Placeholder marks for brands without a logo: the short name as a pixel
 * monogram on a seeded texture, drawn in the brand's own ink and paper with one
 * accent pixel. Deterministic, so the same brand always draws the same mark.
 */
import type { BrandAsset, BrandColor } from './brandIdentity';
import { colorContrastRatio, normalizeHexOrFallback } from './color';

const GENERATED_LABEL = 'Generated pixel mark';

const PIXEL_GLYPHS: Record<string, string> = {
  '0': '111/101/101/101/111',
  '1': '010/110/010/010/111',
  '2': '110/001/111/100/111',
  '3': '110/001/111/001/110',
  '4': '101/101/111/001/001',
  '5': '111/100/110/001/110',
  '6': '011/100/111/101/111',
  '7': '111/001/010/010/010',
  '8': '111/101/111/101/111',
  '9': '111/101/111/001/110',
  A: '010/101/111/101/101',
  B: '110/101/110/101/110',
  C: '011/100/100/100/011',
  D: '110/101/101/101/110',
  E: '111/100/110/100/111',
  F: '111/100/110/100/100',
  G: '011/100/101/101/011',
  H: '101/101/111/101/101',
  I: '111/010/010/010/111',
  J: '001/001/001/101/010',
  K: '101/101/110/101/101',
  L: '100/100/100/100/111',
  M: '101/111/111/101/101',
  N: '101/111/111/111/101',
  O: '010/101/101/101/010',
  P: '110/101/110/100/100',
  Q: '010/101/101/111/011',
  R: '110/101/110/101/101',
  S: '011/100/010/001/110',
  T: '111/010/010/010/010',
  U: '101/101/101/101/111',
  V: '101/101/101/101/010',
  W: '101/101/111/111/101',
  X: '101/101/010/101/101',
  Y: '101/101/010/010/010',
  Z: '111/001/010/100/111',
};

type PixelMarkColors = { accent: string; ink: string; paper: string };

function hashPixelSeed(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createPixelRandom(seed: string): () => number {
  let state = hashPixelSeed(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function pixelMarkColors(colors: readonly BrandColor[]): PixelMarkColors {
  const hex = (id: string, fallback: string) => normalizeHexOrFallback(colors.find((color) => color.id === id)?.hex, fallback);
  const ink = hex('ink', '#181818');
  return { accent: hex('emphasis', ink), ink, paper: hex('paper', '#FFFFFF') };
}

function createPixelMark(label: string, seed: string, inverted: boolean, colors: PixelMarkColors): string {
  const normalizedLabel = label.replace(/[^A-Z0-9]/gi, '').toLocaleUpperCase().slice(0, 3) || 'BR';
  const random = createPixelRandom(`${seed}:${normalizedLabel}:${inverted ? 'light' : 'dark'}`);
  const background = inverted ? colors.paper : colors.ink;
  const foreground = inverted ? colors.ink : colors.paper;
  // The accent pixel falls back to the foreground where the accent would vanish into the tile.
  const accent = colorContrastRatio(colors.accent, background) >= 1.6 ? colors.accent : foreground;
  const pixelSize = normalizedLabel.length === 1 ? 6 : normalizedLabel.length === 2 ? 5 : 4;
  const labelWidth = normalizedLabel.length * pixelSize * 3 + (normalizedLabel.length - 1) * pixelSize;
  const labelX = (64 - labelWidth) / 2;
  const labelY = (64 - pixelSize * 5) / 2;

  const texture = Array.from({ length: 18 }, (_, index) => {
    const x = Math.floor(random() * 14 + 1) * 4;
    let y = Math.floor(random() * 14 + 1) * 4;
    if (x > 8 && x < 56 && y > 12 && y < 52) {
      y = random() > 0.5 ? 4 : 56;
    }
    // The first texture pixel is the accent detail: larger and fully opaque.
    const size = random() > 0.78 || index === 0 ? 8 : 4;
    const opacity = index === 0 ? '1' : (0.08 + random() * 0.14).toFixed(2);
    return `<rect x="${Math.min(x, 64 - size)}" y="${Math.min(y, 64 - size)}" width="${size}" height="${size}" fill="${index === 0 ? accent : foreground}" opacity="${opacity}"/>`;
  }).join('');

  const glyphs = [...normalizedLabel]
    .map((character, characterIndex) => {
      const rows = (PIXEL_GLYPHS[character] ?? '111/101/010/000/010').split('/');
      return rows
        .flatMap((row, rowIndex) =>
          [...row].map((pixel, columnIndex) =>
            pixel === '1'
              ? `<rect x="${labelX + characterIndex * pixelSize * 4 + columnIndex * pixelSize}" y="${labelY + rowIndex * pixelSize}" width="${pixelSize}" height="${pixelSize}"/>`
              : ''
          )
        )
        .join('');
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" shape-rendering="crispEdges"><rect width="64" height="64" fill="${background}"/>${texture}<g fill="${foreground}">${glyphs}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** The mark for light surfaces (an ink tile) and for dark surfaces (a paper tile). */
export function createPixelBrandAssets(label: string, seed: string, colors: readonly BrandColor[] = []): BrandAsset[] {
  const palette = pixelMarkColors(colors);
  return [
    {
      id: 'mark-dark',
      label: `${GENERATED_LABEL} / dark`,
      path: createPixelMark(label, seed, false, palette),
      surface: 'light',
      type: 'logo',
    },
    {
      id: 'mark-light',
      label: `${GENERATED_LABEL} / light`,
      path: createPixelMark(label, seed, true, palette),
      surface: 'dark',
      type: 'logo',
    },
  ];
}

export function hasGeneratedPixelAssets(assets: readonly BrandAsset[]): boolean {
  return assets.some(({ label }) => label.startsWith(GENERATED_LABEL));
}

/** Redraws generated marks for a new name or palette; uploaded logos are kept as they are. */
export function updateGeneratedPixelAssets(
  assets: BrandAsset[],
  label: string,
  seed: string,
  colors: readonly BrandColor[] = []
): BrandAsset[] {
  const generatedAssets = createPixelBrandAssets(label, seed, colors);
  return assets.map((asset) =>
    asset.label.startsWith(GENERATED_LABEL)
      ? generatedAssets.find(({ id }) => id === asset.id) ?? asset
      : asset
  );
}
