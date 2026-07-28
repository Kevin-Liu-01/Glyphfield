import { escapeXml } from '@/lib/download';
import {
  compositeFinishedLayer,
  DEFAULT_MATERIAL_FINISH,
} from '@/lib/materialFinish';

export type LogoAppearanceSettings = {
  borderColor: string;
  borderEnabled: boolean;
  borderOpacity: number;
  borderWidth: number;
  ditherAmount: number;
  ditherAngle: number;
  ditherEnabled: boolean;
  ditherScale: number;
  invert: boolean;
  shadowBlur: number;
  shadowColor: string;
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
};

export const DEFAULT_LOGO_APPEARANCE: LogoAppearanceSettings = {
  borderColor: '#FFFFFF',
  borderEnabled: false,
  borderOpacity: 100,
  borderWidth: 2,
  ditherAmount: 72,
  ditherAngle: 24,
  ditherEnabled: false,
  ditherScale: 6,
  invert: false,
  shadowBlur: 18,
  shadowColor: '#000000',
  shadowEnabled: false,
  shadowOffsetX: 0,
  shadowOffsetY: 8,
  shadowOpacity: 28,
};

function alphaHex(opacity: number): string {
  return Math.round((Math.min(100, Math.max(0, opacity)) * 255) / 100)
    .toString(16)
    .padStart(2, '0');
}

export function logoAppearanceCssFilter(settings: LogoAppearanceSettings): string {
  const filters: string[] = [];
  if (settings.invert) filters.push('invert(1)');
  if (settings.shadowEnabled) {
    filters.push(
      `drop-shadow(${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${settings.shadowColor}${alphaHex(settings.shadowOpacity)})`
    );
  }
  if (settings.borderEnabled && settings.borderWidth > 0) {
    const color = `${settings.borderColor}${alphaHex(settings.borderOpacity)}`;
    const width = settings.borderWidth;
    filters.push(
      `drop-shadow(${width}px 0 0 ${color})`,
      `drop-shadow(${-width}px 0 0 ${color})`,
      `drop-shadow(0 ${width}px 0 ${color})`,
      `drop-shadow(0 ${-width}px 0 ${color})`,
      `drop-shadow(${width}px ${width}px 0 ${color})`,
      `drop-shadow(${-width}px ${width}px 0 ${color})`,
      `drop-shadow(${width}px ${-width}px 0 ${color})`,
      `drop-shadow(${-width}px ${-width}px 0 ${color})`
    );
  }
  return filters.join(' ') || 'none';
}

export function buildLogoSvgFilter(
  settings: LogoAppearanceSettings,
  color: string,
  id = 'logo-appearance'
): string {
  const coloredResult = settings.invert ? 'inverted' : 'colored';
  const invert = settings.invert
    ? '<feComponentTransfer in="colored" result="inverted"><feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/></feComponentTransfer>'
    : '';
  const ditherFrequency = 1 / Math.max(2, settings.ditherScale || DEFAULT_LOGO_APPEARANCE.ditherScale);
  const ditherRadians = ((settings.ditherAngle || 0) * Math.PI) / 180;
  const ditherFrequencyX = ditherFrequency * (0.72 + Math.abs(Math.cos(ditherRadians)) * 0.52);
  const ditherFrequencyY = ditherFrequency * (0.72 + Math.abs(Math.sin(ditherRadians)) * 0.52);
  const ditheredResult = settings.ditherEnabled ? 'dithered' : coloredResult;
  const ditherCutoff = Math.max(1, Math.min(4, Math.round((settings.ditherAmount / 100) * 4)));
  const ditherTable = Array.from({ length: 6 }, (_, index) => index <= ditherCutoff ? '0' : '1').join(' ');
  const dither = settings.ditherEnabled
    ? `<feTurbulence type="fractalNoise" baseFrequency="${ditherFrequencyX.toFixed(4)} ${ditherFrequencyY.toFixed(4)}" numOctaves="1" seed="23" stitchTiles="stitch" result="dither-noise"/><feColorMatrix in="dither-noise" type="luminanceToAlpha" result="dither-alpha"/><feComponentTransfer in="dither-alpha" result="dither-threshold"><feFuncA type="discrete" tableValues="${ditherTable}"/></feComponentTransfer><feComposite in="${coloredResult}" in2="dither-threshold" operator="in" result="dithered"/>`
    : '';
  const border = settings.borderEnabled && settings.borderWidth > 0
    ? `<feMorphology in="SourceAlpha" operator="dilate" radius="${settings.borderWidth}" result="expanded"/><feComposite in="expanded" in2="SourceAlpha" operator="out" result="outline-alpha"/><feFlood flood-color="${escapeXml(settings.borderColor)}" flood-opacity="${settings.borderOpacity / 100}" result="outline-color"/><feComposite in="outline-color" in2="outline-alpha" operator="in" result="outline"/>`
    : '';
  const shadow = settings.shadowEnabled
    ? `<feDropShadow in="${ditheredResult}" dx="${settings.shadowOffsetX}" dy="${settings.shadowOffsetY}" stdDeviation="${settings.shadowBlur / 2}" flood-color="${escapeXml(settings.shadowColor)}" flood-opacity="${settings.shadowOpacity / 100}" result="shadow"/>`
    : '';
  const merge = [
    settings.shadowEnabled ? '<feMergeNode in="shadow"/>' : '',
    settings.borderEnabled && settings.borderWidth > 0 ? '<feMergeNode in="outline"/>' : '',
    `<feMergeNode in="${ditheredResult}"/>`,
  ].join('');

  return `<filter id="${escapeXml(id)}" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB"><feFlood flood-color="${escapeXml(color)}" result="logo-color"/><feComposite in="logo-color" in2="SourceAlpha" operator="in" result="colored"/>${invert}${dither}${border}${shadow}<feMerge>${merge}</feMerge></filter>`;
}

const BAYER_4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

function applyOrderedDither(
  context: CanvasRenderingContext2D,
  bounds: { height: number; width: number; x: number; y: number },
  settings: LogoAppearanceSettings
): void {
  if (!settings.ditherEnabled || settings.ditherAmount <= 0) return;
  const left = Math.max(0, Math.floor(bounds.x));
  const top = Math.max(0, Math.floor(bounds.y));
  const width = Math.min(context.canvas.width - left, Math.max(1, Math.ceil(bounds.width)));
  const height = Math.min(context.canvas.height - top, Math.max(1, Math.ceil(bounds.height)));
  if (width <= 0 || height <= 0) return;
  const image = context.getImageData(left, top, width, height);
  const radians = (settings.ditherAngle * Math.PI) / 180;
  const directionX = Math.cos(radians);
  const directionY = Math.sin(radians);
  const scale = Math.max(1, settings.ditherScale);
  const amount = Math.max(0, Math.min(1, settings.ditherAmount / 100));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      if (image.data[index + 3] === 0) continue;
      const cellX = Math.floor(x / scale);
      const cellY = Math.floor(y / scale);
      const threshold = BAYER_4[(cellY % 4) * 4 + (cellX % 4)]! / 16;
      const progress = Math.max(0, Math.min(1, 0.5 + ((x / width) - 0.5) * directionX + ((y / height) - 0.5) * directionY));
      const coverage = 1 - amount + progress * amount;
      if (coverage < threshold) image.data[index + 3] = 0;
    }
  }
  context.putImageData(image, left, top);
}

export function drawLogoAppearanceLayer(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  settings: LogoAppearanceSettings,
  opacity = 1
): void {
  const layer = document.createElement('canvas');
  layer.width = context.canvas.width;
  layer.height = context.canvas.height;
  const layerContext = layer.getContext('2d');
  if (!layerContext) return;

  layerContext.save();
  layerContext.globalAlpha = Math.max(0, Math.min(1, opacity));
  layerContext.filter = settings.invert ? 'invert(1)' : 'none';
  layerContext.drawImage(source, x, y, width, height);
  layerContext.restore();
  applyOrderedDither(layerContext, { height, width, x, y }, settings);

  compositeFinishedLayer(
    context,
    layer,
    { height, width, x, y },
    {
      ...DEFAULT_MATERIAL_FINISH,
      borderColor: settings.borderColor,
      borderEnabled: settings.borderEnabled,
      borderOpacity: settings.borderOpacity,
      borderWidth: settings.borderWidth,
      shadowBlur: settings.shadowBlur,
      shadowColor: settings.shadowColor,
      shadowEnabled: settings.shadowEnabled,
      shadowOffsetX: settings.shadowOffsetX,
      shadowOffsetY: settings.shadowOffsetY,
      shadowOpacity: settings.shadowOpacity,
    }
  );
}
