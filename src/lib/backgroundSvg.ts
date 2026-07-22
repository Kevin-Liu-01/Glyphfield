export type BackgroundStyle = 'gradient' | 'grain-gradient' | 'dither' | 'pattern';
export type BackgroundPattern = 'none' | 'dots' | 'lines' | 'grid';
export type BackgroundGradient = 'linear' | 'radial';

export type BackgroundSettings = {
  angle: number;
  colorA: string;
  colorB: string;
  ditherMatrix: 2 | 4 | 8;
  gradient: BackgroundGradient;
  grain: number;
  height: number;
  logoScale: number;
  logoTone: 'black' | 'white';
  pattern: BackgroundPattern;
  patternOpacity: number;
  spacing: number;
  style: BackgroundStyle;
  width: number;
};

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  angle: 32,
  colorA: '#FFFFFF',
  colorB: '#181818',
  ditherMatrix: 4,
  gradient: 'linear',
  grain: 18,
  height: 750,
  logoScale: 28,
  logoTone: 'white',
  pattern: 'none',
  patternOpacity: 24,
  spacing: 24,
  style: 'gradient',
  width: 1200,
};

const BAYER_2 = [0, 2, 3, 1] as const;
const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

function bayerValue(x: number, y: number, size: 2 | 4 | 8): number {
  if (size === 2) return BAYER_2[(y % 2) * 2 + (x % 2)]! / 4;
  if (size === 4) return BAYER_4[(y % 4) * 4 + (x % 4)]! / 16;
  const coarse = BAYER_4[(y % 4) * 4 + (x % 4)]!;
  const fine = BAYER_2[(Math.floor(y / 4) % 2) * 2 + (Math.floor(x / 4) % 2)]!;
  return (coarse * 4 + fine) / 64;
}

function patternDefinition(settings: BackgroundSettings): string {
  const spacing = Math.max(8, settings.spacing);
  const stroke = settings.logoTone === 'white' ? '#FFFFFF' : '#000000';

  if (settings.pattern === 'dots') {
    return `<pattern id="pattern-dots" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><circle cx="${spacing / 2}" cy="${spacing / 2}" r="1.6" fill="${stroke}"/></pattern>`;
  }
  if (settings.pattern === 'lines') {
    return `<pattern id="pattern-lines" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse" patternTransform="rotate(${settings.angle})"><path d="M0 0V${spacing}" stroke="${stroke}" stroke-width="1"/></pattern>`;
  }
  if (settings.pattern === 'grid') {
    return `<pattern id="pattern-grid" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><path d="M${spacing} 0H0V${spacing}" fill="none" stroke="${stroke}" stroke-width="1"/></pattern>`;
  }
  return '';
}

function ditherField(settings: BackgroundSettings): string {
  const cell = Math.max(10, Math.round(settings.spacing * 0.72));
  const columns = Math.ceil(settings.width / cell);
  const rows = Math.ceil(settings.height / cell);
  const circles: string[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const progress = (column + row * 0.34) / (columns + rows * 0.34);
      const threshold = bayerValue(column, row, settings.ditherMatrix);
      const radius = progress > threshold ? cell * 0.42 : cell * 0.1;
      circles.push(
        `<circle cx="${column * cell + cell / 2}" cy="${row * cell + cell / 2}" r="${radius.toFixed(2)}" fill="${settings.colorB}"/>`
      );
    }
  }

  return `<g data-dither-matrix="${settings.ditherMatrix}">${circles.join('')}</g>`;
}

export function buildBackgroundSvg(
  settings: BackgroundSettings,
  identity?: { logo?: string; name: string }
): string {
  const radians = (settings.angle * Math.PI) / 180;
  const x1 = 50 - Math.cos(radians) * 50;
  const y1 = 50 - Math.sin(radians) * 50;
  const x2 = 50 + Math.cos(radians) * 50;
  const y2 = 50 + Math.sin(radians) * 50;
  const gradient =
    settings.gradient === 'radial'
      ? `<radialGradient id="surface-gradient" cx="42%" cy="38%" r="78%"><stop stop-color="${settings.colorA}"/><stop offset="1" stop-color="${settings.colorB}"/></radialGradient>`
      : `<linearGradient id="surface-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop stop-color="${settings.colorA}"/><stop offset="1" stop-color="${settings.colorB}"/></linearGradient>`;
  const pattern = patternDefinition(settings);
  const grain = `<filter id="surface-grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="4" seed="12" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 ${Math.max(0, Math.min(1, settings.grain / 100))}"/></feComponentTransfer></filter>`;
  const patternLayer =
    settings.pattern === 'none'
      ? ''
      : `<rect width="100%" height="100%" fill="url(#pattern-${settings.pattern})" opacity="${(settings.patternOpacity / 100).toFixed(2)}"/>`;
  const surface =
    settings.style === 'dither'
      ? `<rect width="100%" height="100%" fill="${settings.colorA}"/>${ditherField(settings)}`
      : settings.style === 'pattern'
        ? `<rect width="100%" height="100%" fill="${settings.colorA}"/>`
        : `<rect width="100%" height="100%" fill="url(#surface-gradient)"/>`;
  const grainLayer =
    settings.style === 'grain-gradient' && settings.grain > 0
      ? `<rect width="100%" height="100%" fill="#FFFFFF" filter="url(#surface-grain)" style="mix-blend-mode:soft-light"/>`
      : '';
  const markSize = Math.min(settings.width, settings.height) * (settings.logoScale / 100);
  const markX = (settings.width - markSize) / 2;
  const markY = (settings.height - markSize) / 2;
  const mark = identity?.logo
    ? `<image href="${identity.logo.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" preserveAspectRatio="xMidYMid meet"/>`
    : identity
      ? `<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="${settings.logoTone === 'white' ? '#FFFFFF' : '#000000'}" font-family="Inter,sans-serif" font-size="${markSize * 0.42}" font-weight="800" letter-spacing="-.06em">${identity.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</text>`
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.width}" height="${settings.height}" viewBox="0 0 ${settings.width} ${settings.height}"><defs>${gradient}${grain}${pattern}</defs>${surface}${grainLayer}${patternLayer}${mark}</svg>`;
}
