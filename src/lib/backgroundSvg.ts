import {
  DEFAULT_LIVE_MATERIAL_ID,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import { mixHexColors } from '@/lib/color';
import { buildLogoSvgFilter, DEFAULT_LOGO_APPEARANCE, type LogoAppearanceSettings } from '@/lib/logoAppearance';

export type BackgroundStyle = 'gradient' | 'grain-gradient' | 'dither' | 'pattern' | 'live-shader';
export type BackgroundPattern = 'none' | 'dots' | 'lines' | 'grid' | 'fibers' | 'speckles' | 'topographic' | 'crosshatch';
export type BackgroundGradient = 'linear' | 'radial' | 'mesh' | 'orbit' | 'wave' | 'bloom';
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
  grain: 10,
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
  relief: 18,
  spacing: 24,
  style: 'gradient',
  width: 1200,
};

export const BACKGROUND_GRADIENT_DEFAULTS: Readonly<Record<BackgroundGradient, Partial<BackgroundSettings>>> = {
  bloom: { angle: 24, focalX: 34, focalY: 32, relief: 24 },
  linear: { angle: 24 },
  radial: { focalX: 38, focalY: 42 },
  mesh: { bandCount: 9, bandDepth: 72, bandGap: 2, focalX: 50, lightingEnabled: true },
  orbit: { angle: 24, focalX: 62, focalY: 46, relief: 12 },
  wave: { angle: 138, focalY: 38, relief: 24 },
};

export const BACKGROUND_PRESETS = [
  {
    category: 'Gradient',
    description: 'A quiet directional field with smooth tonal separation and deep edge contrast.',
    id: 'signal-axis',
    name: 'Signal axis',
    settings: { angle: 24, colorA: '#07090D', colorB: '#394457', colorC: '#F5F7FA', gradient: 'linear', grain: 3, relief: 0, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Full-height architectural strips hold crisp edges over a controlled vertical falloff.',
    id: 'spectral-mesh',
    name: 'Signal terraces',
    settings: { angle: 90, bandCount: 9, bandDepth: 72, bandGap: 2, colorA: '#06070A', colorB: '#28334A', colorC: '#EEF2FF', focalX: 50, gradient: 'mesh', grain: 3, lightingEnabled: true, relief: 0, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Warm amber, coral, and lilac moving through an orbit field.',
    id: 'solar-orbit',
    name: 'Solar orbit',
    settings: { angle: 24, colorA: '#25113D', colorB: '#FF763D', colorC: '#FFD06A', focalX: 62, focalY: 46, gradient: 'orbit', grain: 8, relief: 12, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'A quiet cyan field with broad directional movement.',
    id: 'mineral-wave',
    name: 'Mineral wave',
    settings: { angle: 138, colorA: '#061A22', colorB: '#28B9B1', colorC: '#B9FFF2', gradient: 'wave', grain: 6, relief: 24, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'A focused off-axis aperture with a soft paper falloff and restrained vignette.',
    id: 'paper-light',
    name: 'Paper aperture',
    settings: { angle: 18, colorA: '#DDD8CE', colorB: '#F3F0EA', colorC: '#FFFFFF', focalX: 34, focalY: 31, gradient: 'radial', grain: 2, relief: 8, style: 'grain-gradient' },
  },
  {
    category: 'Print',
    description: 'A monochrome ordered-dither transition for marks and fields.',
    id: 'ink-dither',
    name: 'Ink dither',
    settings: { angle: 24, colorA: '#F4F4F0', colorB: '#181818', colorC: '#737373', ditherMatrix: 4, ditherShape: 'dots', spacing: 16, style: 'dither' },
  },
  {
    category: 'Print',
    description: 'Electric violet and mint resolved into a compact pixel field.',
    id: 'signal-dither',
    name: 'Signal dither',
    settings: { angle: 145, colorA: '#130A33', colorB: '#795CFF', colorC: '#7BFFD9', ditherMatrix: 8, ditherShape: 'squares', spacing: 13, style: 'dither' },
  },
  {
    category: 'Gradient',
    description: 'A soft lilac, mineral blue, and opal field assembled from broad overlapping light blooms.',
    id: 'aurora-veil',
    name: 'Aurora veil',
    settings: { angle: 18, colorA: '#15112B', colorB: '#7C70FF', colorC: '#C9FFF1', focalX: 32, focalY: 28, gradient: 'bloom', grain: 5, relief: 28, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Deep ultraviolet with a concentrated electric-blue glow and a quiet rose counterpoint.',
    id: 'ultraviolet-dusk',
    name: 'Ultraviolet dusk',
    settings: { angle: 146, colorA: '#09051D', colorB: '#5137FF', colorC: '#FF8ED8', focalX: 66, focalY: 30, gradient: 'bloom', grain: 7, relief: 34, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Muted rose, warm stone, and clear milk light for editorial and cosmetic surfaces.',
    id: 'rose-quartz',
    name: 'Rose quartz',
    settings: { angle: 32, colorA: '#7E4E5B', colorB: '#D8A9A4', colorC: '#FFF4E8', focalX: 38, focalY: 34, gradient: 'bloom', grain: 4, relief: 22, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'A nocturnal cobalt field with cold cyan light pooling at the edge.',
    id: 'cobalt-haze',
    name: 'Cobalt haze',
    settings: { angle: 154, colorA: '#02091D', colorB: '#164ED8', colorC: '#A8F4FF', focalX: 72, focalY: 38, gradient: 'orbit', grain: 6, relief: 18, style: 'grain-gradient' },
  },
  {
    category: 'Gradient',
    description: 'Oxidized teal moving through warm copper and soft mineral highlights.',
    id: 'copper-patina',
    name: 'Copper patina',
    settings: { angle: 126, colorA: '#102F2B', colorB: '#B8603B', colorC: '#E5C48E', focalY: 46, gradient: 'wave', grain: 10, relief: 28, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'Warm cotton stock with restrained fibers and a soft, off-center studio light.',
    id: 'cotton-rag',
    name: 'Cotton rag',
    settings: { angle: 12, colorA: '#CFC7B8', colorB: '#ECE6DA', colorC: '#FFFDF8', focalX: 42, focalY: 35, gradient: 'radial', grain: 14, pattern: 'fibers', patternOpacity: 18, spacing: 30, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'A cool translucent paper field with fine clouding and scattered pulp flecks.',
    id: 'vellum-mist',
    name: 'Vellum mist',
    settings: { angle: 20, colorA: '#C9CED0', colorB: '#E7EAE7', colorC: '#FFFFFF', focalX: 31, focalY: 28, gradient: 'bloom', grain: 18, pattern: 'speckles', patternOpacity: 10, spacing: 26, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'Uncoated kraft with visible directional fiber and low-contrast natural variation.',
    id: 'kraft-fiber',
    name: 'Kraft fiber',
    settings: { angle: 18, colorA: '#8C6D49', colorB: '#BA9567', colorC: '#D7B98B', gradient: 'linear', grain: 22, pattern: 'fibers', patternOpacity: 24, spacing: 24, style: 'grain-gradient' },
  },
  {
    category: 'Paper',
    description: 'Bleached stock with faint blue-gray shadow and a subtle recycled-paper speckle.',
    id: 'pulp-white',
    name: 'Pulp white',
    settings: { angle: 142, colorA: '#D8DDE0', colorB: '#F0F1ED', colorC: '#FFFFFF', gradient: 'linear', grain: 18, pattern: 'speckles', patternOpacity: 12, spacing: 32, style: 'grain-gradient' },
  },
  {
    category: 'Print',
    description: 'A warm risograph bloom with ink overlap, paper grain, and a fine crosshatch screen.',
    id: 'riso-sunset',
    name: 'Riso sunset',
    settings: { angle: 30, colorA: '#3C2B66', colorB: '#F05D4D', colorC: '#FFD16B', focalX: 38, focalY: 35, gradient: 'bloom', grain: 18, pattern: 'crosshatch', patternOpacity: 12, spacing: 18, style: 'grain-gradient' },
  },
  {
    category: 'Print',
    description: 'Quiet elevation lines over a mineral gray wash for maps, packaging, and editorial fields.',
    id: 'topographic-mist',
    name: 'Topographic mist',
    settings: { angle: 18, colorA: '#D4D8D1', colorB: '#A3ADA2', colorC: '#F6F7F2', focalX: 42, focalY: 36, gradient: 'radial', grain: 8, pattern: 'topographic', patternOpacity: 20, spacing: 38, style: 'grain-gradient' },
  },
  {
    category: 'Print',
    description: 'Dense graphite crosshatching that reads like ink, carbon paper, and technical drafting film.',
    id: 'graphite-hatch',
    name: 'Graphite hatch',
    settings: { angle: 26, colorA: '#111216', colorB: '#555B61', colorC: '#DDE1E4', gradient: 'linear', grain: 12, pattern: 'crosshatch', patternOpacity: 34, spacing: 14, style: 'grain-gradient' },
  },
  {
    category: 'Film',
    description: 'A milky pearl film carrying cool blue and pale rose interference without animation.',
    id: 'pearl-film',
    name: 'Pearl film',
    settings: { angle: 154, colorA: '#A9C7D5', colorB: '#F3D6DF', colorC: '#FFFDF2', focalX: 62, focalY: 38, gradient: 'bloom', grain: 4, relief: 18, style: 'grain-gradient' },
  },
  {
    category: 'Film',
    description: 'Static spectral laminate with a dark violet base, cyan shift, and warm foil edge.',
    id: 'spectral-laminate',
    name: 'Spectral laminate',
    settings: { angle: 128, colorA: '#21114F', colorB: '#39D9E6', colorC: '#FFB169', focalX: 36, focalY: 30, gradient: 'bloom', grain: 6, relief: 36, style: 'grain-gradient' },
  },
  {
    category: 'Film',
    description: 'Dark anodized blue with machined vertical terraces and a cool metallic crest.',
    id: 'anodized-cobalt',
    name: 'Anodized cobalt',
    settings: { angle: 90, bandCount: 14, bandDepth: 88, bandGap: 1, colorA: '#020714', colorB: '#123D9B', colorC: '#7BCBFF', focalX: 62, gradient: 'mesh', grain: 7, lightingEnabled: true, style: 'grain-gradient' },
  },
] as const satisfies ReadonlyArray<{
  category: 'Gradient' | 'Paper' | 'Print' | 'Film';
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
  if (settings.pattern === 'fibers') {
    return `<pattern id="pattern-fibers" width="${spacing * 2}" height="${spacing}" patternUnits="userSpaceOnUse" patternTransform="rotate(${settings.angle * 0.24})"><path d="M-${spacing} ${spacing * 0.3} C${spacing * 0.2} ${spacing * 0.08},${spacing * 0.7} ${spacing * 0.58},${spacing * 2} ${spacing * 0.26}" fill="none" stroke="${stroke}" stroke-width=".75"/><path d="M0 ${spacing * 0.76} C${spacing * 0.5} ${spacing * 0.55},${spacing * 1.2} ${spacing * 0.98},${spacing * 2} ${spacing * 0.7}" fill="none" stroke="${settings.colorC}" stroke-width=".5"/></pattern>`;
  }
  if (settings.pattern === 'speckles') {
    return `<pattern id="pattern-speckles" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><circle cx="${spacing * 0.18}" cy="${spacing * 0.28}" r=".8" fill="${stroke}"/><circle cx="${spacing * 0.73}" cy="${spacing * 0.66}" r="1.1" fill="${stroke}"/><circle cx="${spacing * 0.48}" cy="${spacing * 0.12}" r=".45" fill="${settings.colorC}"/></pattern>`;
  }
  if (settings.pattern === 'topographic') {
    return `<pattern id="pattern-topographic" width="${spacing * 2}" height="${spacing * 1.5}" patternUnits="userSpaceOnUse"><path d="M-${spacing} ${spacing} C${spacing * 0.15} ${spacing * 0.05},${spacing * 0.8} ${spacing * 1.55},${spacing * 2.2} ${spacing * 0.45} S${spacing * 3.2} ${spacing * 1.3},${spacing * 4} ${spacing * 0.35}" fill="none" stroke="${stroke}" stroke-width=".8"/><path d="M-${spacing} ${spacing * 1.28} C${spacing * 0.25} ${spacing * 0.38},${spacing * 0.95} ${spacing * 1.8},${spacing * 2.35} ${spacing * 0.72} S${spacing * 3.25} ${spacing * 1.58},${spacing * 4} ${spacing * 0.62}" fill="none" stroke="${stroke}" stroke-width=".55"/></pattern>`;
  }
  if (settings.pattern === 'crosshatch') {
    return `<pattern id="pattern-crosshatch" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse"><path d="M-${spacing} ${spacing}L${spacing} -${spacing}M0 ${spacing * 2}L${spacing * 2} 0M-${spacing} 0L${spacing} ${spacing * 2}M0 -${spacing}L${spacing * 2} ${spacing}" fill="none" stroke="${stroke}" stroke-width=".55"/></pattern>`;
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

function smoothGradientStops(start: string, middle: string, end: string): string {
  return Array.from({ length: 33 }, (_, index) => {
    const offset = index / 32;
    const color = offset <= 0.5
      ? mixHexColors(start, middle, offset * 2)
      : mixHexColors(middle, end, (offset - 0.5) * 2);

    return `<stop offset="${offset}" stop-color="${color}"/>`;
  })
    .join('');
}

function gradientDefinition(settings: BackgroundSettings): string {
  const radians = (settings.angle * Math.PI) / 180;
  const x1 = 50 - Math.cos(radians) * 50;
  const y1 = 50 - Math.sin(radians) * 50;
  const x2 = 50 + Math.cos(radians) * 50;
  const y2 = 50 + Math.sin(radians) * 50;
  const forwardStops = smoothGradientStops(settings.colorA, settings.colorB, settings.colorC);
  const reverseStops = smoothGradientStops(settings.colorC, settings.colorB, settings.colorA);

  if (settings.gradient === 'radial') {
    return `<radialGradient id="radial-aperture" cx="${settings.focalX}%" cy="${settings.focalY}%" fx="${settings.focalX}%" fy="${settings.focalY}%" r="76%" gradientTransform="rotate(${settings.angle} .5 .5) scale(1 .72)" color-interpolation="sRGB"><stop offset="0" stop-color="${settings.colorC}"/><stop offset=".34" stop-color="${mixHexColors(settings.colorC, settings.colorB, 0.5)}"/><stop offset=".62" stop-color="${settings.colorB}"/><stop offset="1" stop-color="${settings.colorA}"/></radialGradient><radialGradient id="radial-vignette" cx="${100 - settings.focalX}%" cy="${100 - settings.focalY}%" r="88%" color-interpolation="sRGB"><stop offset=".42" stop-color="${settings.colorA}" stop-opacity="0"/><stop offset="1" stop-color="${settings.colorB}" stop-opacity=".22"/></radialGradient>`;
  }
  if (settings.gradient === 'mesh') {
    return '';
  }
  if (settings.gradient === 'orbit') {
    return `<radialGradient id="orbit-primary" cx="${settings.focalX}%" cy="${settings.focalY}%" r="84%" gradientTransform="rotate(${settings.angle} .5 .5) scale(1 .68)" color-interpolation="sRGB">${forwardStops}</radialGradient><radialGradient id="orbit-secondary" cx="${100 - settings.focalX}%" cy="${100 - settings.focalY}%" r="78%" gradientTransform="rotate(${settings.angle + 90} .5 .5) scale(1 .74)" color-interpolation="sRGB">${reverseStops}</radialGradient>`;
  }
  if (settings.gradient === 'bloom') {
    return `<radialGradient id="bloom-a" cx="${settings.focalX}%" cy="${settings.focalY}%" r="72%" gradientTransform="rotate(${settings.angle} .5 .5) scale(1 .7)" color-interpolation="sRGB"><stop offset="0" stop-color="${settings.colorC}"/><stop offset=".48" stop-color="${settings.colorB}" stop-opacity=".82"/><stop offset="1" stop-color="${settings.colorA}" stop-opacity="0"/></radialGradient><radialGradient id="bloom-b" cx="${100 - settings.focalX}%" cy="${Math.min(92, 100 - settings.focalY * 0.62)}%" r="68%" gradientTransform="rotate(${settings.angle + 86} .5 .5) scale(1 .64)" color-interpolation="sRGB"><stop offset="0" stop-color="${settings.colorB}"/><stop offset=".42" stop-color="${settings.colorC}" stop-opacity=".64"/><stop offset="1" stop-color="${settings.colorA}" stop-opacity="0"/></radialGradient>`;
  }
  if (settings.gradient === 'wave') {
    return `<linearGradient id="surface-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" color-interpolation="sRGB">${forwardStops}</linearGradient><linearGradient id="wave-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${settings.width}" y2="${settings.height}" color-interpolation="sRGB">${reverseStops}</linearGradient>`;
  }
  return `<linearGradient id="surface-gradient" x1="${x1}%" y1="${y1}%" x2="${x2}%" y2="${y2}%" color-interpolation="sRGB">${forwardStops}</linearGradient>`;
}

function bandSurface(settings: BackgroundSettings): string {
  const count = Math.max(3, Math.min(24, Math.round(settings.bandCount)));
  const segmentWidth = settings.width / count;
  const gap = Math.max(0, Math.min(segmentWidth * 0.8, settings.bandGap));
  const depth = Math.max(0.28, Math.min(1, settings.bandDepth / 100));
  const split = Math.max(0.18, Math.min(0.82, settings.focalX / 100));
  const bars = Array.from({ length: count }, (_, index) => {
    const x = index * segmentWidth + gap / 2;
    const width = Math.max(0.5, segmentWidth - gap);
    const progress = count === 1 ? 0 : index / (count - 1);
    const tone = progress <= split
      ? mixHexColors(settings.colorA, settings.colorB, progress / split)
      : mixHexColors(settings.colorB, settings.colorC, (progress - split) / (1 - split));
    const lowerTone = mixHexColors(tone, settings.colorC, 0.22);
    const gradientId = `band-strip-${index}`;
    const definition = settings.lightingEnabled
      ? `<linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${settings.colorA}"/><stop offset="${(1 - depth).toFixed(2)}" stop-color="${settings.colorA}"/><stop offset=".78" stop-color="${tone}"/><stop offset="1" stop-color="${lowerTone}"/></linearGradient>`
      : '';
    const fill = settings.lightingEnabled ? `url(#${gradientId})` : tone;
    return {
      definition,
      rect: `<rect data-band-index="${index}" x="${x.toFixed(2)}" y="0" width="${width.toFixed(2)}" height="${settings.height}" fill="${fill}"/>`,
    };
  });

  return `<rect width="100%" height="100%" fill="${settings.colorA}"/><g data-gradient-layout="bands" data-band-count="${count}" data-band-geometry="full-height"><defs>${bars.map(({ definition }) => definition).join('')}</defs>${bars.map(({ rect }) => rect).join('')}</g>`;
}

function gradientSurface(settings: BackgroundSettings): string {
  if (settings.gradient === 'mesh') {
    return bandSurface(settings);
  }
  if (settings.gradient === 'orbit') {
    return `<g data-gradient-layout="orbit"><rect width="100%" height="100%" fill="${settings.colorA}"/><rect x="-8%" y="-8%" width="116%" height="116%" fill="url(#orbit-primary)"/><rect x="-8%" y="-8%" width="116%" height="116%" fill="url(#orbit-secondary)" opacity=".34"/></g>`;
  }
  if (settings.gradient === 'bloom') {
    const glow = Math.max(0.18, Math.min(0.78, 0.28 + settings.relief / 160));
    return `<g data-gradient-layout="bloom"><rect width="100%" height="100%" fill="${settings.colorA}"/><rect x="-10%" y="-10%" width="120%" height="120%" fill="url(#bloom-a)"/><rect x="-10%" y="-10%" width="120%" height="120%" fill="url(#bloom-b)" opacity="${glow.toFixed(2)}"/></g>`;
  }
  if (settings.gradient === 'wave') {
    const amplitude = settings.height * (0.12 + Math.max(0, Math.min(100, settings.relief)) / 420);
    const centerY = settings.height * (settings.focalY / 100);
    const overscan = settings.width * 0.12;
    const wavePath = `M ${-overscan.toFixed(2)} ${centerY.toFixed(2)} C ${(settings.width * 0.16).toFixed(2)} ${(centerY - amplitude).toFixed(2)}, ${(settings.width * 0.34).toFixed(2)} ${(centerY + amplitude).toFixed(2)}, ${(settings.width * 0.52).toFixed(2)} ${centerY.toFixed(2)} S ${(settings.width * 0.84).toFixed(2)} ${(centerY - amplitude).toFixed(2)}, ${(settings.width + overscan).toFixed(2)} ${centerY.toFixed(2)}`;
    const secondCenterY = centerY + settings.height * 0.24;
    const secondWavePath = `M ${-overscan.toFixed(2)} ${secondCenterY.toFixed(2)} C ${(settings.width * 0.18).toFixed(2)} ${(secondCenterY + amplitude * 0.72).toFixed(2)}, ${(settings.width * 0.38).toFixed(2)} ${(secondCenterY - amplitude * 0.72).toFixed(2)}, ${(settings.width * 0.56).toFixed(2)} ${secondCenterY.toFixed(2)} S ${(settings.width * 0.86).toFixed(2)} ${(secondCenterY + amplitude * 0.62).toFixed(2)}, ${(settings.width + overscan).toFixed(2)} ${secondCenterY.toFixed(2)}`;
    const strokeWidth = Math.min(settings.width, settings.height) * 0.34;
    const normalizedAngle = ((settings.angle % 180) + 180) % 180;
    const waveTilt = (normalizedAngle - 90) * 0.28;
    return `<g data-gradient-layout="wave"><rect x="-4%" y="-4%" width="108%" height="108%" fill="url(#surface-gradient)"/><g transform="rotate(${waveTilt.toFixed(2)} ${settings.width / 2} ${settings.height / 2})" filter="url(#wave-soften)" opacity=".72"><path d="${wavePath}" fill="none" stroke="url(#wave-gradient)" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round"/><path d="${secondWavePath}" fill="none" stroke="${settings.colorC}" stroke-opacity=".28" stroke-width="${(strokeWidth * 0.58).toFixed(2)}" stroke-linecap="round"/></g></g>`;
  }
  if (settings.gradient === 'radial') {
    return `<g data-gradient-layout="radial"><rect width="100%" height="100%" fill="${settings.colorA}"/><rect x="-8%" y="-8%" width="116%" height="116%" fill="url(#radial-aperture)"/><rect width="100%" height="100%" fill="url(#radial-vignette)"/></g>`;
  }
  return `<rect data-gradient-layout="${settings.gradient}" x="-4%" y="-4%" width="108%" height="108%" fill="url(#surface-gradient)"/>`;
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
  const grain = `<filter id="surface-grain" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".52" numOctaves="2" seed="12" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 ${Math.max(0, Math.min(0.45, settings.grain / 180))}"/></feComponentTransfer></filter>`;
  const waveBlur = Math.max(18, Math.min(settings.width, settings.height) * 0.045);
  const smoothFilters = `<filter id="wave-soften" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${waveBlur.toFixed(2)}"/></filter>`;
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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.width}" height="${settings.height}" viewBox="0 0 ${settings.width} ${settings.height}"><defs>${gradient}${grain}${smoothFilters}${pattern}${logoFilter}</defs>${surface}${grainLayer}${patternLayer}${brandAsset}${mark ? `<g filter="url(#background-logo)">${mark}</g>` : ''}</svg>`;
}
