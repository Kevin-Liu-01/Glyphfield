import type { BrandIdentity } from './brandIdentity';
import { escapeXml } from './download';
import {
  buildLogoSvgFilter,
  DEFAULT_LOGO_APPEARANCE,
  type LogoAppearanceSettings,
} from './logoAppearance';

export type OpenGraphSvgOptions = {
  background: string;
  backgroundImage: string | null;
  backgroundOpacity: number;
  backgroundScale: number;
  backgroundX: number;
  backgroundY: number;
  fontData: string | null;
  fontFamily: string;
  fontWeight: number;
  foreground: string;
  identityId: string;
  logoAppearance: LogoAppearanceSettings;
  logoScale: number;
  logoSource: string;
  logoX: number;
  logoY: number;
  panelColor: string;
  panelForeground: string;
  promiseLines: readonly string[];
  proof: string;
  proofChipBackground: string;
  proofChipForeground: string;
  recipe: BrandIdentity['artDirection']['preview'];
  titleFontSize: number;
  titleLineHeight: number;
  titleLines: readonly string[];
  usesMintlifyAtmosphere: boolean;
  usesTailwindAtmosphere: boolean;
  website: string;
};

function atmosphereDefinitions(options: OpenGraphSvgOptions): string {
  if (options.usesMintlifyAtmosphere) {
    return '<radialGradient id="og-mint-glow" cx="52%" cy="42%" r="74%"><stop offset="0%" stop-color="#70F1C2" stop-opacity="0.54"/><stop offset="46%" stop-color="#18B985" stop-opacity="0.2"/><stop offset="100%" stop-color="#04110D" stop-opacity="0"/></radialGradient><linearGradient id="og-mint-beam" x1="0%" x2="100%" y1="100%" y2="0%"><stop offset="0%" stop-color="#0A6A50"/><stop offset="48%" stop-color="#7EF2CA"/><stop offset="100%" stop-color="#E9FFF8"/></linearGradient><pattern id="og-mint-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#D9FFF2" opacity="0.12"/></pattern>';
  }
  if (options.usesTailwindAtmosphere) {
    return '<linearGradient id="og-tailwind-current" x1="0%" x2="100%" y1="20%" y2="80%"><stop offset="0%" stop-color="#0EA5E9"/><stop offset="50%" stop-color="#67E8F9"/><stop offset="100%" stop-color="#38BDF8"/></linearGradient><radialGradient id="og-tailwind-glow" cx="58%" cy="46%" r="70%"><stop offset="0%" stop-color="#38BDF8" stop-opacity="0.24"/><stop offset="100%" stop-color="#061724" stop-opacity="0"/></radialGradient><pattern id="og-tailwind-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#BAE6FD" opacity="0.1"/></pattern>';
  }
  return '';
}

function atmosphereLayer(options: OpenGraphSvgOptions): string | null {
  if (options.usesMintlifyAtmosphere) {
    return '<g clip-path="url(#opengraph-media)"><rect x="620" width="580" height="630" fill="#04110D"/><rect x="620" width="580" height="630" fill="url(#og-mint-glow)"/><path d="M500 600 C660 480 770 390 870 270 S1090 70 1320 -80" fill="none" stroke="url(#og-mint-beam)" stroke-width="104" opacity="0.88"/><path d="M530 650 C700 530 830 430 935 300 S1120 90 1300 -30" fill="none" stroke="#DFFFF4" stroke-width="22" opacity="0.28"/><path d="M540 500 C700 410 790 315 880 215 S1090 45 1280 -60" fill="none" stroke="#72EDC1" stroke-width="2" opacity="0.78"/><rect x="620" width="580" height="630" fill="url(#og-mint-dots)"/></g>';
  }
  if (options.usesTailwindAtmosphere) {
    return '<g clip-path="url(#opengraph-media)"><rect x="620" width="580" height="630" fill="#061724"/><rect x="620" width="580" height="630" fill="url(#og-tailwind-glow)"/><path d="M520 125 C660 10 775 245 930 130 S1160 40 1320 135" fill="none" stroke="#0EA5E9" stroke-width="90" opacity="0.08"/><path d="M520 125 C660 10 775 245 930 130 S1160 40 1320 135" fill="none" stroke="url(#og-tailwind-current)" stroke-width="20" opacity="0.92"/><path d="M510 310 C670 205 795 420 950 310 S1175 220 1320 315" fill="none" stroke="#38BDF8" stroke-width="74" opacity="0.07"/><path d="M510 310 C670 205 795 420 950 310 S1175 220 1320 315" fill="none" stroke="url(#og-tailwind-current)" stroke-width="16" opacity="0.78"/><path d="M520 495 C665 390 810 575 965 480 S1165 385 1320 480" fill="none" stroke="url(#og-tailwind-current)" stroke-width="12" opacity="0.62"/><rect x="620" width="580" height="630" fill="url(#og-tailwind-dots)"/></g>';
  }
  return null;
}

function mediaLayer(options: OpenGraphSvgOptions, fontFamily: string): string {
  const atmosphere = atmosphereLayer(options);
  if (atmosphere) return atmosphere;
  if (options.backgroundImage) {
    const mediaWidth = 580;
    const mediaHeight = 630;
    const resolvedWidth = mediaWidth * (options.backgroundScale / 100);
    const resolvedHeight = mediaHeight * (options.backgroundScale / 100);
    const x = 620 + (mediaWidth - resolvedWidth) / 2 + (options.backgroundX / 100) * mediaWidth;
    const y = (mediaHeight - resolvedHeight) / 2 + (options.backgroundY / 100) * mediaHeight;
    return `<rect x="620" width="580" height="630" fill="${options.panelColor}"/><g clip-path="url(#opengraph-media)"><image href="${escapeXml(options.backgroundImage)}" x="${x}" y="${y}" width="${resolvedWidth}" height="${resolvedHeight}" preserveAspectRatio="xMidYMid slice" opacity="${options.backgroundOpacity / 100}"/></g>`;
  }
  if (options.recipe === 'translation-frame') {
    return `<rect x="620" width="580" height="630" fill="${options.panelColor}"/><rect x="620" width="580" height="630" fill="url(#opengraph-dots)"/><text x="724" y="242" fill="${options.panelForeground}" opacity="0.78" font-family="${fontFamily}" font-size="30" font-weight="500">Welcome</text><text x="934" y="242" fill="${options.panelForeground}" opacity="0.92" font-family="${fontFamily}" font-size="34" font-weight="500">你好</text><text x="724" y="348" fill="${options.panelForeground}" opacity="0.72" font-family="${fontFamily}" font-size="26" font-weight="500">Bienvenidos</text><text x="932" y="348" fill="${options.panelForeground}" opacity="0.84" font-family="${fontFamily}" font-size="30" font-weight="500">ようこそ</text><text x="820" y="448" fill="${options.panelForeground}" opacity="0.74" font-family="${fontFamily}" font-size="30" font-weight="500">أهلاً وسهلاً</text>`;
  }
  return `<rect x="620" width="580" height="630" fill="${options.panelColor}"/><rect x="662" y="154" width="496" height="76" fill="${options.panelForeground}" opacity="0.12"/><rect x="662" y="254" width="416" height="76" fill="${options.panelForeground}" opacity="0.2"/><rect x="662" y="354" width="468" height="76" fill="${options.panelForeground}" opacity="0.1"/>`;
}

export function buildOpenGraphSvg(options: OpenGraphSvgOptions): string {
  const fontDefinition = options.fontData
    ? `<style>@font-face{font-family:'StudioCustom';src:url('${options.fontData}')}</style>`
    : '';
  const fontFamily = escapeXml(options.fontData ? 'StudioCustom' : options.fontFamily);
  const title = options.titleLines.map((line, index) => (
    `<text x="72" y="${options.titleLines.length === 1 ? 392 : 350 + index * options.titleLineHeight}" fill="${options.foreground}" font-family="${fontFamily}" font-size="${options.titleFontSize}" font-weight="${options.fontWeight}" letter-spacing="${options.titleFontSize >= 54 ? -1.8 : -1.4}">${escapeXml(line)}</text>`
  )).join('');
  const promiseStartY = options.titleLines.length === 1
    ? 438
    : 350 + options.titleLines.length * options.titleLineHeight + 26;
  const promise = options.promiseLines.map((line, index) => (
    `<text x="72" y="${promiseStartY + index * 20}" fill="${options.foreground}" opacity="0.72" font-family="${fontFamily}" font-size="16" font-weight="400">${escapeXml(line)}</text>`
  )).join('');
  const proofY = Math.min(530, promiseStartY + options.promiseLines.length * 20 + 18);
  const proof = options.proof
    ? `<rect x="72" y="${proofY}" width="${Math.min(340, Math.max(124, options.proof.length * 8.5 + 36))}" height="38" fill="${options.proofChipBackground}"/><text x="90" y="${proofY + 24}" fill="${options.proofChipForeground}" font-family="${fontFamily}" font-size="13" font-weight="500" letter-spacing="-0.1">${escapeXml(options.proof)}</text>`
    : '';
  const mediaHasImagery = Boolean(options.backgroundImage || options.usesMintlifyAtmosphere || options.usesTailwindAtmosphere);
  const metadataColor = mediaHasImagery ? '#FFFFFF' : options.panelForeground;
  const website = options.identityId === 'gt'
    ? ''
    : `<text x="1160" y="590" text-anchor="end" fill="${metadataColor}" opacity="0.84" font-family="${fontFamily}" font-size="13" font-weight="450">${escapeXml(options.website)}</text>`;
  const metadata = `${mediaHasImagery ? '<rect x="620" y="480" width="580" height="150" fill="url(#opengraph-media-bottom-scrim)"/>' : ''}${website}`;
  const logoSize = 52 * (options.logoScale / 100);
  const logoX = 72 - (logoSize - 52) / 2 + options.logoX;
  const logoY = 64 - (logoSize - 52) / 2 + options.logoY;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs>${fontDefinition}<clipPath id="opengraph-media"><rect x="620" width="580" height="630"/></clipPath><linearGradient id="opengraph-media-bottom-scrim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.58"/></linearGradient><pattern id="opengraph-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${options.panelForeground}" opacity="0.08"/></pattern>${atmosphereDefinitions(options)}${buildLogoSvgFilter({ ...DEFAULT_LOGO_APPEARANCE, ...options.logoAppearance }, options.foreground, 'opengraph-logo')}</defs><rect width="1200" height="630" fill="${options.background}"/>${mediaLayer(options, fontFamily)}${metadata}<image href="${escapeXml(options.logoSource)}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}" filter="url(#opengraph-logo)"/>${title}${promise}${proof}</svg>`;
}
