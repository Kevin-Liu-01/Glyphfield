import { escapeXml } from '@/lib/download';

export type LogoAppearanceSettings = {
  borderColor: string;
  borderEnabled: boolean;
  borderOpacity: number;
  borderWidth: number;
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
  const border = settings.borderEnabled && settings.borderWidth > 0
    ? `<feMorphology in="SourceAlpha" operator="dilate" radius="${settings.borderWidth}" result="expanded"/><feComposite in="expanded" in2="SourceAlpha" operator="out" result="outline-alpha"/><feFlood flood-color="${escapeXml(settings.borderColor)}" flood-opacity="${settings.borderOpacity / 100}" result="outline-color"/><feComposite in="outline-color" in2="outline-alpha" operator="in" result="outline"/>`
    : '';
  const shadow = settings.shadowEnabled
    ? `<feDropShadow in="${coloredResult}" dx="${settings.shadowOffsetX}" dy="${settings.shadowOffsetY}" stdDeviation="${settings.shadowBlur / 2}" flood-color="${escapeXml(settings.shadowColor)}" flood-opacity="${settings.shadowOpacity / 100}" result="shadow"/>`
    : '';
  const merge = [
    settings.shadowEnabled ? '<feMergeNode in="shadow"/>' : '',
    settings.borderEnabled && settings.borderWidth > 0 ? '<feMergeNode in="outline"/>' : '',
    `<feMergeNode in="${coloredResult}"/>`,
  ].join('');

  return `<filter id="${escapeXml(id)}" x="-60%" y="-60%" width="220%" height="220%" color-interpolation-filters="sRGB"><feFlood flood-color="${escapeXml(color)}" result="logo-color"/><feComposite in="logo-color" in2="SourceAlpha" operator="in" result="colored"/>${invert}${border}${shadow}<feMerge>${merge}</feMerge></filter>`;
}
