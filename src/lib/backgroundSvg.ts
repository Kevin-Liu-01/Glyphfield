import {
  DEFAULT_LIVE_MATERIAL_ID,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import { buildLogoSvgFilter, DEFAULT_LOGO_APPEARANCE, type LogoAppearanceSettings } from '@/lib/logoAppearance';

export type BackgroundStyle = 'gradient' | 'grain-gradient' | 'dither' | 'pattern' | 'live-shader';
export type BackgroundPattern = 'none' | 'dots' | 'lines' | 'grid';
export type BackgroundGradient = 'linear' | 'radial' | 'mesh' | 'orbit' | 'wave';
export type BackgroundDitherShape = 'dots' | 'squares';

export type BackgroundSettings = {
  angle: number;
  bandCount: number;
  bandDepth: number;
  bandGap: number;
  colorA: string;
  colorB: string;
  colorC: string;
  ditherMatrix: 2 | 4 | 8;
  ditherShape: BackgroundDitherShape;
  focalX: number;
  focalY: number;
  gradient: BackgroundGradient;
  grain: number;
  height: number;
  logoOpacity: number;
  logoColor: string;
  logoScale: number;
  logoTone: 'black' | 'white';
  logoX: number;
  logoY: number;
  lightingEnabled: boolean;
  liveMaterialId?: LiveMaterialId;
  liveSettings?: LiveMaterialSettings;
  pattern: BackgroundPattern;
  patternOpacity: number;
  relief: number;
  spacing: number;
  style: BackgroundStyle;
  width: number;
};

export const DEFAULT_BACKGROUND_SETTINGS: BackgroundSettings = {
  angle: 32,
  bandCount: 15,
  bandDepth: 56,
  bandGap: 0,
  colorA: '#FFFFFF',
  colorB: '#181818',
  colorC: '#737373',
  ditherMatrix: 4,
  ditherShape: 'dots',
  focalX: 42,
  focalY: 38,
  gradient: 'linear',
  grain: 18,
  height: 750,
  logoOpacity: 100,
  logoColor: '#FFFFFF',
  logoScale: 28,
  logoTone: 'white',
  logoX: 0,
  logoY: 0,
  lightingEnabled: true,
  liveMaterialId: DEFAULT_LIVE_MATERIAL_ID,
  liveSettings: DEFAULT_LIVE_MATERIAL_SETTINGS,
  pattern: 'none',
  patternOpacity: 12,
  relief: 24,
  spacing: 24,
  style: 'gradient',
  width: 1200,
};

export const BACKGROUND_PRESETS = [
  {
    description: 'A clean mirrored aperture built from a dense shared-gradient field.',
    id: 'spectral-mesh',
    name: 'Spectral aperture',
    settings: { angle: 90, bandCount: 15, bandDepth: 58, bandGap: 0, colorA: '#02030A', colorB: '#284CFF', colorC: '#FFC1D8', focalX: 50, gradient: 'mesh', grain: 16, lightingEnabled: true, relief: 0, style: 'grain-gradient' },
  },
  {
    description: 'Warm amber, coral, and lilac moving through an orbit field.',
    id: 'solar-orbit',
    name: 'Solar orbit',
    settings: { angle: 24, colorA: '#25113D', colorB: '#FF763D', colorC: '#FFD06A', focalX: 62, focalY: 46, gradient: 'orbit', grain: 18, relief: 18, style: 'grain-gradient' },
  },
  {
    description: 'A quiet cyan field with broad directional movement.',
    id: 'mineral-wave',
    name: 'Mineral wave',
    settings: { angle: 138, colorA: '#061A22', colorB: '#28B9B1', colorC: '#B9FFF2', gradient: 'wave', grain: 15, relief: 38, style: 'grain-gradient' },
  },
  {
    description: 'Soft paper neutrals with a restrained radial glow.',
    id: 'paper-light',
    name: 'Paper light',
    settings: { colorA: '#F7F5F0', colorB: '#D9D5CC', colorC: '#FFFFFF', focalX: 36, focalY: 28, gradient: 'radial', grain: 8, relief: 8, style: 'grain-gradient' },
  },
  {
    description: 'A monochrome ordered-dither transition for marks and fields.',
    id: 'ink-dither',
    name: 'Ink dither',
    settings: { angle: 24, colorA: '#F4F4F0', colorB: '#181818', colorC: '#737373', ditherMatrix: 4, ditherShape: 'dots', spacing: 16, style: 'dither' },
  },
  {
    description: 'Electric violet and mint resolved into a compact pixel field.',
    id: 'signal-dither',
    name: 'Signal dither',
    settings: { angle: 145, colorA: '#130A33', colorB: '#795CFF', colorC: '#7BFFD9', ditherMatrix: 8, ditherShape: 'squares', spacing: 13, style: 'dither' },
  },
] as const satisfies ReadonlyArray<{
  description: string;
  id: string;
  name: string;
  settings: Partial<BackgroundSettings>;
}>;

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
  const stroke = settings.colorB;

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
  const radians = (settings.angle * Math.PI) / 180;
  const directionX = Math.cos(radians);
  const directionY = Math.sin(radians);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const normalizedX = (column + 0.5) / Math.max(columns, 1) - 0.5;
      const normalizedY = (row + 0.5) / Math.max(rows, 1) - 0.5;
      const progress = Math.max(0, Math.min(1, 0.5 + normalizedX * directionX + normalizedY * directionY));
      const threshold = bayerValue(column, row, settings.ditherMatrix);
      const active = progress > threshold;
      const size = active ? cell * 0.84 : cell * 0.16;
      const color = progress > 0.62 ? settings.colorC : settings.colorB;
      if (settings.ditherShape === 'squares') {
        circles.push(`<rect x="${(column * cell + (cell - size) / 2).toFixed(2)}" y="${(row * cell + (cell - size) / 2).toFixed(2)}" width="${size.toFixed(2)}" height="${size.toFixed(2)}" fill="${color}"/>`);
      } else {
        circles.push(`<circle cx="${column * cell + cell / 2}" cy="${row * cell + cell / 2}" r="${(size / 2).toFixed(2)}" fill="${color}"/>`);
      }
    }
  }

  return `<g data-dither-matrix="${settings.ditherMatrix}" data-dither-shape="${settings.ditherShape}">${circles.join('')}</g>`;
}

function gradientDefinition(settings: BackgroundSettings): string {
  const radians = (settings.angle * Math.PI) / 180;
  const x1 = 50 - Math.cos(radians) * 50;
  const y1 = 50 - Math.sin(radians) * 50;
  const x2 = 50 + Math.cos(radians) * 50;
  const y2 = 50 + Math.sin(radians) * 50;

  if (settings.gradient === 'radial') {
    return `<radialGradient id="surface-gradient" cx="${settings.focalX}%" cy="${settings.focalY}%" r="82%"><stop stop-color="${settings.colorC}"/><stop offset=".48" stop-color="${settings.colorA}"/><stop offset="1" stop-color="${settings.colorB}"/></radialGradient>`;
  }
  if (settings.gradient === 'mesh') {
    return `<linearGradient id="band-gradient" gradientUnits="userSpaceOnUse" x1="${(settings.width * x1 / 100).toFixed(2)}" y1="${(settings.height * y1 / 100).toFixed(2)}" x2="${(settings.width * x2 / 100).toFixed(2)}" y2="${(settings.height * y2 / 100).toFixed(2)}"><stop stop-color="${settings.colorA}"/><stop offset=".48" stop-color="${settings.colorB}"/><stop offset="1" stop-color="${settings.colorC}"/></linearGradient>`;
  }
  if (settings.gradient === 'orbit') {
    return `<radialGradient id="surface-gradient" cx="${settings.focalX}%" cy="${settings.focalY}%" r="76%" gradientTransform="rotate(${settings.angle} .5 .5) scale(1 .72)"><stop stop-color="${settings.colorC}"/><stop offset=".24" stop-color="${settings.colorB}"/><stop offset=".58" stop-color="${settings.colorA}"/><stop offset=".82" stop-color="${settings.colorB}"/><stop offset="1" stop-color="${settings.colorA}"/></radialGradient>`;
  }
  return `<linearGradient id="surface-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%"><stop stop-color="${settings.colorA}"/><stop offset=".5" stop-color="${settings.colorC}"/><stop offset="1" stop-color="${settings.colorB}"/></linearGradient>`;
}

function bandSurface(settings: BackgroundSettings): string {
  const count = Math.max(3, Math.min(24, Math.round(settings.bandCount)));
  const segmentWidth = settings.width / count;
  const gap = Math.max(0, Math.min(segmentWidth * 0.8, settings.bandGap));
  const peak = Math.max(0.05, Math.min(0.95, settings.focalX / 100));
  const depth = settings.height * Math.max(0, Math.min(1, settings.bandDepth / 100));
  const bars = Array.from({ length: count }, (_, index) => {
    const position = (index + 0.5) / count;
    const distance = position < peak
      ? (peak - position) / peak
      : (position - peak) / (1 - peak);
    const top = Math.pow(Math.max(0, Math.min(1, distance)), 1.65) * depth;
    const x = index * segmentWidth + gap / 2;
    const width = Math.max(0.5, segmentWidth - gap);
    const fill = settings.lightingEnabled ? 'url(#band-gradient)' : settings.colorB;
    return `<rect data-band-index="${index}" x="${x.toFixed(2)}" y="${top.toFixed(2)}" width="${width.toFixed(2)}" height="${Math.max(0.5, settings.height - top).toFixed(2)}" fill="${fill}"/>`;
  });

  return `<rect width="100%" height="100%" fill="${settings.colorA}"/><g data-gradient-layout="bands" data-band-count="${count}">${bars.join('')}</g>`;
}

function gradientSurface(settings: BackgroundSettings): string {
  const reliefFilter = settings.relief > 0 && ['orbit', 'wave'].includes(settings.gradient)
    ? ' filter="url(#surface-relief)"'
    : '';
  if (settings.gradient === 'mesh') {
    return bandSurface(settings);
  }
  return `<rect x="-4%" y="-4%" width="108%" height="108%" fill="url(#surface-gradient)"${reliefFilter}/>`;
}

export function buildBackgroundSvg(
  settings: BackgroundSettings,
  identity?: {
    asset?: string;
    assetFit?: 'contain' | 'cover';
    assetOpacity?: number;
    logo?: string;
    logoAppearance?: LogoAppearanceSettings;
    name: string;
    showLogo?: boolean;
  }
): string {
  const gradient = gradientDefinition(settings);
  const pattern = patternDefinition(settings);
  const grain = `<filter id="surface-grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="4" seed="12" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 ${Math.max(0, Math.min(1, settings.grain / 100))}"/></feComponentTransfer></filter>`;
  const relief = `<filter id="surface-relief" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".006 .018" numOctaves="2" seed="19" result="relief-noise"/><feDisplacementMap in="SourceGraphic" in2="relief-noise" scale="${Math.max(0, settings.relief)}" xChannelSelector="R" yChannelSelector="B"/></filter>`;
  const patternLayer =
    settings.pattern === 'none'
      ? ''
      : `<rect width="100%" height="100%" fill="url(#pattern-${settings.pattern})" opacity="${(settings.patternOpacity / 100).toFixed(2)}"/>`;
  const surface =
    settings.style === 'dither'
      ? `<rect width="100%" height="100%" fill="${settings.colorA}"/>${ditherField(settings)}`
      : settings.style === 'pattern'
        ? `<rect width="100%" height="100%" fill="${settings.colorA}"/>`
        : gradientSurface(settings);
  const grainLayer =
    settings.style === 'grain-gradient' && settings.grain > 0
      ? `<rect width="100%" height="100%" fill="#FFFFFF" filter="url(#surface-grain)" style="mix-blend-mode:soft-light"/>`
      : '';
  const markSize = Math.min(settings.width, settings.height) * (settings.logoScale / 100);
  const markX = (settings.width - markSize) / 2 + (settings.logoX / 100) * settings.width;
  const markY = (settings.height - markSize) / 2 + (settings.logoY / 100) * settings.height;
  const logoAppearance = { ...DEFAULT_LOGO_APPEARANCE, ...identity?.logoAppearance };
  const logoFilter = identity && identity.showLogo !== false
    ? buildLogoSvgFilter(logoAppearance, settings.logoColor, 'background-logo')
    : '';
  const mark = identity?.showLogo === false
    ? ''
    : identity?.logo
    ? `<image href="${identity.logo.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" preserveAspectRatio="xMidYMid meet" opacity="${settings.logoOpacity / 100}"/>`
    : identity
      ? `<text x="${settings.width / 2 + (settings.logoX / 100) * settings.width}" y="${settings.height * 0.52 + (settings.logoY / 100) * settings.height}" text-anchor="middle" dominant-baseline="middle" fill="${settings.logoColor}" opacity="${settings.logoOpacity / 100}" font-family="Switzer,sans-serif" font-size="${markSize * 0.42}" font-weight="550" letter-spacing="-.02em">${identity.name.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</text>`
      : '';
  const brandAsset = identity?.asset
    ? `<image href="${identity.asset.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" width="100%" height="100%" preserveAspectRatio="xMidYMid ${identity.assetFit === 'contain' ? 'meet' : 'slice'}" opacity="${Math.max(0, Math.min(1, (identity.assetOpacity ?? 100) / 100))}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.width}" height="${settings.height}" viewBox="0 0 ${settings.width} ${settings.height}"><defs>${gradient}${grain}${relief}${pattern}${logoFilter}</defs>${surface}${grainLayer}${patternLayer}${brandAsset}${mark ? `<g filter="url(#background-logo)">${mark}</g>` : ''}</svg>`;
}
