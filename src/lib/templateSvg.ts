import { escapeXml } from '@/lib/download';
import type { TemplateKind } from '@/lib/templateAssets';
import { capVisibleFontWeight } from '@/lib/typography';

export type TemplateTexture = 'white' | 'dark' | 'grid' | 'noise';
export type TemplateLayerId = 'brand' | 'content' | 'footer';
export type SlideLayout =
  | 'title'
  | 'section'
  | 'agenda'
  | 'split'
  | 'metrics'
  | 'quote'
  | 'timeline'
  | 'statement'
  | 'comparison'
  | 'process'
  | 'chart'
  | 'team'
  | 'image'
  | 'closing';

export type TemplateSvgOptions = {
  background: string;
  backgroundImage?: string | null;
  backgroundImageOpacity?: number;
  backgroundImageScale?: number;
  backgroundImageX?: number;
  backgroundImageY?: number;
  body?: string;
  brandLogo: string;
  brandLogoScale?: number;
  brandLogoX?: number;
  brandLogoY?: number;
  brandScale?: number;
  brandX?: number;
  brandY?: number;
  foreground: string;
  fontData?: string | null;
  fontFamily?: string;
  fontWeight?: number;
  height: number;
  identityName: string;
  imageTreatment?: 'natural' | 'monochrome' | 'duotone';
  invertPartner?: boolean;
  kind: TemplateKind;
  layerOrder?: readonly TemplateLayerId[];
  partnerLogo?: string | null;
  partnerLogoScale?: number;
  partnerLogoX?: number;
  partnerLogoY?: number;
  slideLayout?: SlideLayout;
  texture: TemplateTexture;
  textureOpacity?: number;
  title: string;
  contentScale?: number;
  contentX?: number;
  contentY?: number;
  footerScale?: number;
  footerX?: number;
  footerY?: number;
  website: string;
  width: number;
};

const DEFAULT_LAYER_ORDER: readonly TemplateLayerId[] = ['brand', 'content', 'footer'];

function transformedLayer(
  id: TemplateLayerId,
  content: string,
  x: number,
  y: number,
  scale: number,
  centerX: number,
  centerY: number
): string {
  return `<g data-layer="${id}" transform="translate(${x} ${y}) translate(${centerX} ${centerY}) scale(${scale}) translate(${-centerX} ${-centerY})">${content}</g>`;
}

function textureLayer(texture: TemplateTexture, opacity: number): string {
  if (texture === 'grid') {
    return `<defs><pattern id="texture" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#9A9A93" stroke-opacity="0.22"/></pattern></defs><rect width="100%" height="100%" fill="url(#texture)" opacity="${opacity}"/>`;
  }

  if (texture === 'noise') {
    return `<defs><filter id="noise"><feTurbulence baseFrequency="0.75" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.08"/></feComponentTransfer></filter></defs><rect width="100%" height="100%" filter="url(#noise)" opacity="${opacity * 0.45}"/>`;
  }

  return '';
}

function imagePlacement(
  x: number,
  y: number,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
  scale: number
) {
  const resolvedWidth = width * (scale / 100);
  const resolvedHeight = height * (scale / 100);
  return {
    height: resolvedHeight,
    width: resolvedWidth,
    x: x - (resolvedWidth - width) / 2 + offsetX,
    y: y - (resolvedHeight - height) / 2 + offsetY,
  };
}

function titleLines(value: string, kind: TemplateKind): string[] {
  const limit = kind === 'slides' ? 34 : 29;
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  for (const word of words) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > limit) {
      if (lines.length === 3) break;
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }

  return lines;
}

function svgTextLines(
  value: string,
  x: number,
  y: number,
  foreground: string,
  options: { anchor?: 'start' | 'middle'; fontSize?: number; lineHeight?: number; maxLines?: number; weight?: number } = {}
): string {
  const fontSize = options.fontSize ?? 68;
  const lineHeight = options.lineHeight ?? 78;
  const words = value.trim().split(/\s+/).filter(Boolean);
  const limit = Math.max(12, Math.round(760 / (fontSize * 0.52)));
  const lines: string[] = [];
  for (const word of words) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > limit) {
      if (lines.length === (options.maxLines ?? 3)) break;
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }
  return lines.map((line, index) => `<text x="${x}" y="${y + index * lineHeight}"${options.anchor === 'middle' ? ' text-anchor="middle"' : ''} fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="${fontSize}" font-weight="${capVisibleFontWeight(options.weight ?? 550)}" letter-spacing="-2">${escapeXml(line)}</text>`).join('');
}

function slideLayoutLayer(
  layout: SlideLayout,
  title: string,
  body: string,
  foreground: string,
  width: number
): string {
  const bodyItems = body.split('\n').map((item) => item.trim()).filter(Boolean);
  const items = bodyItems.length > 0 ? bodyItems : ['Foundation', 'Expression', 'Application', 'Delivery'];
  if (layout === 'section') return `<text x="84" y="520" fill="${foreground}" opacity="0.12" font-family="Switzer,Arial,sans-serif" font-size="330" font-weight="550">01</text>${svgTextLines(title, 420, 370, foreground, { fontSize: 76, lineHeight: 84, maxLines: 2 })}`;
  if (layout === 'agenda') return `${svgTextLines(title, 84, 300, foreground, { fontSize: 64, maxLines: 2 })}${items.slice(0, 4).map((item, index) => `<text x="880" y="270" fill="${foreground}" opacity="0.38" font-family="ui-monospace,monospace" font-size="16">0${index + 1}</text><text x="940" y="270" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="25" transform="translate(0 ${index * 72})">${escapeXml(item)}</text>`).join('')}`;
  if (layout === 'split') return `${svgTextLines(title, 84, 310, foreground, { fontSize: 66, maxLines: 3 })}<line x1="800" y1="230" x2="800" y2="690" stroke="${foreground}" opacity="0.18"/>${items.slice(0, 5).map((item, index) => `<text x="880" y="${290 + index * 70}" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="24">${escapeXml(item)}</text>`).join('')}`;
  if (layout === 'metrics') return `${svgTextLines(title, 84, 300, foreground, { fontSize: 58, maxLines: 2 })}${[['98.7%','Coverage'],['42','Markets'],['7d','Launch']].map(([value, label], index) => `<rect x="${84 + index * 490}" y="470" width="430" height="220" fill="none" stroke="${foreground}" opacity="0.2"/><text x="${120 + index * 490}" y="580" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="64" font-weight="550">${value}</text><text x="${120 + index * 490}" y="635" fill="${foreground}" opacity="0.52" font-family="ui-monospace,monospace" font-size="16">${label}</text>`).join('')}`;
  if (layout === 'quote') return `<text x="84" y="360" fill="${foreground}" opacity="0.16" font-family="Georgia,serif" font-size="180">“</text>${svgTextLines(title, 220, 390, foreground, { fontSize: 62, lineHeight: 72, maxLines: 3, weight: 550 })}<text x="220" y="690" fill="${foreground}" opacity="0.58" font-family="ui-monospace,monospace" font-size="17">${escapeXml(bodyItems[0] ?? 'Alex Morgan · Customer')}</text>`;
  if (layout === 'timeline') return `${svgTextLines(title, 84, 300, foreground, { fontSize: 58, maxLines: 2 })}<line x1="110" y1="560" x2="1490" y2="560" stroke="${foreground}" opacity="0.24"/>${items.slice(0, 4).map((item, index) => `<circle cx="${150 + index * 430}" cy="560" r="10" fill="${foreground}"/><text x="${150 + index * 430}" y="520" fill="${foreground}" opacity="0.45" font-family="ui-monospace,monospace" font-size="15">0${index + 1}</text><text x="${150 + index * 430}" y="620" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="21">${escapeXml(item)}</text>`).join('')}`;
  if (layout === 'statement') return svgTextLines(title, width / 2, 430, foreground, { anchor: 'middle', fontSize: 104, lineHeight: 108, maxLines: 2 });
  if (layout === 'comparison') return `${svgTextLines(title, 84, 290, foreground, { fontSize: 56, maxLines: 2 })}${[items[0] ?? 'Before', items[1] ?? 'After'].map((item, index) => `<rect x="${84 + index * 748}" y="440" width="700" height="280" fill="none" stroke="${foreground}" opacity="0.22"/><text x="${124 + index * 748}" y="510" fill="${foreground}" opacity="0.42" font-family="ui-monospace,monospace" font-size="16">0${index + 1}</text><text x="${124 + index * 748}" y="610" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="36" font-weight="550">${escapeXml(item)}</text>`).join('')}`;
  if (layout === 'process') return `${svgTextLines(title, 84, 290, foreground, { fontSize: 58, maxLines: 2 })}${items.slice(0, 4).map((item, index) => `<rect x="${84 + index * 374}" y="470" width="340" height="220" fill="none" stroke="${foreground}" opacity="0.2"/><text x="${114 + index * 374}" y="525" fill="${foreground}" opacity="0.4" font-family="ui-monospace,monospace" font-size="15">0${index + 1}</text><text x="${114 + index * 374}" y="615" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="25" font-weight="550">${escapeXml(item)}</text>`).join('')}`;
  if (layout === 'chart') return `${svgTextLines(title, 84, 290, foreground, { fontSize: 58, maxLines: 2 })}<line x1="840" y1="690" x2="1500" y2="690" stroke="${foreground}" opacity="0.25"/>${[0.42, 0.68, 0.55, 0.88, 0.76].map((value, index) => `<rect x="${880 + index * 118}" y="${690 - value * 360}" width="72" height="${value * 360}" fill="${foreground}" opacity="${0.28 + index * 0.13}"/>`).join('')}<text x="84" y="610" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="118" font-weight="550" letter-spacing="-5">+42%</text><text x="90" y="660" fill="${foreground}" opacity="0.5" font-family="ui-monospace,monospace" font-size="16">YEAR OVER YEAR</text>`;
  if (layout === 'team') return `${svgTextLines(title, 84, 290, foreground, { fontSize: 58, maxLines: 2 })}${items.slice(0, 3).map((item, index) => `<circle cx="${360 + index * 440}" cy="520" r="88" fill="${foreground}" opacity="${0.12 + index * 0.08}"/><text x="${360 + index * 440}" y="535" text-anchor="middle" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="42" font-weight="550">${escapeXml(item.slice(0, 2).toUpperCase())}</text><text x="${360 + index * 440}" y="660" text-anchor="middle" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="23">${escapeXml(item)}</text>`).join('')}`;
  if (layout === 'image') return `${svgTextLines(title, 84, 330, foreground, { fontSize: 64, maxLines: 3 })}<rect x="900" y="170" width="616" height="560" fill="${foreground}" opacity="0.08"/><circle cx="1208" cy="450" r="150" fill="none" stroke="${foreground}" stroke-width="2" opacity="0.24"/><line x1="900" y1="170" x2="1516" y2="730" stroke="${foreground}" opacity="0.18"/><line x1="1516" y1="170" x2="900" y2="730" stroke="${foreground}" opacity="0.18"/>`;
  if (layout === 'closing') return `${svgTextLines(title, width / 2, 430, foreground, { anchor: 'middle', fontSize: 82, lineHeight: 88, maxLines: 2 })}<text x="${width / 2}" y="660" text-anchor="middle" fill="${foreground}" opacity="0.58" font-family="Switzer,Arial,sans-serif" font-size="22">${escapeXml(body)}</text>`;
  return `${svgTextLines(title, 84, 340, foreground, { fontSize: 78, lineHeight: 88, maxLines: 3 })}`;
}

export function buildTemplateSvg(options: TemplateSvgOptions): string {
  const {
    background,
    backgroundImage,
    backgroundImageOpacity = 24,
    backgroundImageScale = 100,
    backgroundImageX = 0,
    backgroundImageY = 0,
    body = '',
    brandLogo,
    brandLogoScale = 100,
    brandLogoX = 0,
    brandLogoY = 0,
    brandScale = 1,
    brandX = 0,
    brandY = 0,
    foreground,
    fontData,
    fontFamily = 'Switzer',
    fontWeight = 550,
    height,
    identityName,
    imageTreatment = 'natural',
    invertPartner,
    kind,
    layerOrder = DEFAULT_LAYER_ORDER,
    partnerLogo,
    partnerLogoScale = 100,
    partnerLogoX = 0,
    partnerLogoY = 0,
    slideLayout = 'title',
    texture,
    textureOpacity = 100,
    title,
    contentScale = 1,
    contentX = 0,
    contentY = 0,
    footerScale = 1,
    footerX = 0,
    footerY = 0,
    website,
    width,
  } = options;
  const backgroundPlacement = imagePlacement(
    0,
    0,
    width,
    height,
    (backgroundImageX / 100) * width,
    (backgroundImageY / 100) * height,
    backgroundImageScale
  );
  const imageFilter = imageTreatment === 'natural'
    ? ''
    : imageTreatment === 'monochrome'
      ? '<filter id="image-treatment"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.08" intercept="-.04"/><feFuncG type="linear" slope="1.08" intercept="-.04"/><feFuncB type="linear" slope="1.08" intercept="-.04"/></feComponentTransfer></filter>'
      : '<filter id="image-treatment"><feColorMatrix values=".55 .35 .1 0 0 .18 .62 .2 0 0 .08 .28 .64 0 0 0 0 0 1 0"/></filter>';
  const imageLayer = `<rect width="${width}" height="${height}" fill="${background}"/>${
    backgroundImage
      ? `<defs>${imageFilter}</defs><image href="${backgroundImage}" x="${backgroundPlacement.x}" y="${backgroundPlacement.y}" width="${backgroundPlacement.width}" height="${backgroundPlacement.height}" preserveAspectRatio="xMidYMid slice" opacity="${backgroundImageOpacity / 100}"${imageFilter ? ' filter="url(#image-treatment)"' : ''}/>`
      : ''
  }${textureLayer(texture, textureOpacity / 100)}`;
  const lineStart = kind === 'partnership' ? 260 : kind === 'slides' ? 330 : 240;
  const fontSize = kind === 'slides' ? 78 : 68;
  const lineHeight = kind === 'slides' ? 88 : 78;
  const lines = titleLines(title, kind)
    .map((line, index) => `<text x="84" y="${lineStart + index * lineHeight}" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="${fontSize}" font-weight="550" letter-spacing="-2">${escapeXml(line)}</text>`)
    .join('');

  const partnerFilter = invertPartner
    ? '<defs><filter id="partner-tone"><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs>'
    : '';
  const brandBaseSize = kind === 'partnership' ? 136 : kind === 'slides' ? 104 : 56;
  const brandPlacement = imagePlacement(
    84,
    kind === 'partnership' ? 54 : 64,
    brandBaseSize,
    brandBaseSize,
    brandLogoX,
    brandLogoY,
    brandLogoScale
  );
  const partnerPlacement = imagePlacement(
    width - 292,
    78,
    208,
    82,
    partnerLogoX,
    partnerLogoY,
    partnerLogoScale
  );
  const logoLayer = kind === 'partnership'
    ? `${partnerFilter}<image href="${brandLogo}" x="${brandPlacement.x}" y="${brandPlacement.y}" width="${brandPlacement.width}" height="${brandPlacement.height}" preserveAspectRatio="xMidYMid meet"/><text x="${width - 356}" y="131" fill="${foreground}" opacity="0.38" font-family="Switzer,Arial,sans-serif" font-size="30">×</text>${partnerLogo ? `<image href="${partnerLogo}" x="${partnerPlacement.x}" y="${partnerPlacement.y}" width="${partnerPlacement.width}" height="${partnerPlacement.height}" preserveAspectRatio="xMidYMid meet"${invertPartner ? ' filter="url(#partner-tone)"' : ''}/>` : ''}`
    : `<image href="${brandLogo}" x="${brandPlacement.x}" y="${brandPlacement.y}" width="${brandPlacement.width}" height="${brandPlacement.height}" preserveAspectRatio="xMidYMid meet"/>`;
  const identityLabel = kind === 'blog'
    ? `<text x="158" y="99" fill="${foreground}" font-family="Switzer,Arial,sans-serif" font-size="19" font-weight="550">${escapeXml(identityName)}</text>`
    : '';
  const pageNumber = kind === 'slides'
    ? `<text x="${width - 84}" y="${height - 64}" text-anchor="end" fill="${foreground}" opacity="0.58" font-family="ui-monospace,monospace" font-size="16">01 / 12</text>`
    : '';

  const contentLayer = kind === 'slides'
    ? slideLayoutLayer(slideLayout, title, body, foreground, width)
    : lines;
  const fontFace = fontData
    ? `@font-face{font-family:'TemplateBrand';src:url('${escapeXml(fontData)}');font-style:normal;font-weight:100 900;font-display:block;}`
    : '';
  const resolvedFontFamily = fontData ? 'TemplateBrand' : fontFamily;
  const fontStyles = `<style>${fontFace}text:not([font-family*='monospace']){font-family:${JSON.stringify(resolvedFontFamily)} !important;font-weight:${capVisibleFontWeight(fontWeight)};}</style>`;
  const layers: Record<TemplateLayerId, string> = {
    brand: transformedLayer('brand', `${logoLayer}${identityLabel}`, brandX, brandY, brandScale, width / 2, 118),
    content: transformedLayer('content', contentLayer, contentX, contentY, contentScale, width / 2, height / 2),
    footer: transformedLayer('footer', `<text x="84" y="${height - 64}" fill="${foreground}" opacity="0.58" font-family="ui-monospace,monospace" font-size="16">${escapeXml(website)}</text>${pageNumber}`, footerX, footerY, footerScale, width / 2, height - 64),
  };
  const orderedLayerIds = [...layerOrder, ...DEFAULT_LAYER_ORDER.filter((id) => !layerOrder.includes(id))];
  const foregroundLayers = orderedLayerIds.map((id) => layers[id]).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${fontStyles}${imageLayer}${foregroundLayers}</svg>`;
}
