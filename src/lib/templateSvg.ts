import { escapeXml } from '@/lib/download';
import type { TemplateKind } from '@/lib/templateAssets';

export type TemplateTexture = 'white' | 'dark' | 'grid' | 'noise';

type TemplateSvgOptions = {
  background: string;
  backgroundImage?: string | null;
  backgroundImageOpacity?: number;
  backgroundImageScale?: number;
  backgroundImageX?: number;
  backgroundImageY?: number;
  brandLogo: string;
  brandLogoScale?: number;
  brandLogoX?: number;
  brandLogoY?: number;
  eyebrow: string;
  foreground: string;
  height: number;
  identityName: string;
  invertPartner?: boolean;
  kind: TemplateKind;
  partnerLogo?: string | null;
  partnerLogoScale?: number;
  partnerLogoX?: number;
  partnerLogoY?: number;
  texture: TemplateTexture;
  textureOpacity?: number;
  title: string;
  website: string;
  width: number;
};

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

export function buildTemplateSvg(options: TemplateSvgOptions): string {
  const {
    background,
    backgroundImage,
    backgroundImageOpacity = 24,
    backgroundImageScale = 100,
    backgroundImageX = 0,
    backgroundImageY = 0,
    brandLogo,
    brandLogoScale = 100,
    brandLogoX = 0,
    brandLogoY = 0,
    eyebrow,
    foreground,
    height,
    identityName,
    invertPartner,
    kind,
    partnerLogo,
    partnerLogoScale = 100,
    partnerLogoX = 0,
    partnerLogoY = 0,
    texture,
    textureOpacity = 100,
    title,
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
  const imageLayer = `<rect width="${width}" height="${height}" fill="${background}"/>${
    backgroundImage
      ? `<image href="${backgroundImage}" x="${backgroundPlacement.x}" y="${backgroundPlacement.y}" width="${backgroundPlacement.width}" height="${backgroundPlacement.height}" preserveAspectRatio="xMidYMid slice" opacity="${backgroundImageOpacity / 100}"/>`
      : ''
  }${textureLayer(texture, textureOpacity / 100)}`;
  const lineStart = kind === 'partnership' ? 310 : kind === 'slides' ? 330 : 286;
  const fontSize = kind === 'slides' ? 78 : 68;
  const lineHeight = kind === 'slides' ? 88 : 78;
  const lines = titleLines(title, kind)
    .map((line, index) => `<text x="84" y="${lineStart + index * lineHeight}" fill="${foreground}" font-family="Inter,Arial,sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="-2">${escapeXml(line)}</text>`)
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
    ? `${partnerFilter}<image href="${brandLogo}" x="${brandPlacement.x}" y="${brandPlacement.y}" width="${brandPlacement.width}" height="${brandPlacement.height}" preserveAspectRatio="xMidYMid meet"/><text x="${width - 356}" y="131" fill="${foreground}" opacity="0.38" font-family="Inter,Arial,sans-serif" font-size="30">×</text>${partnerLogo ? `<image href="${partnerLogo}" x="${partnerPlacement.x}" y="${partnerPlacement.y}" width="${partnerPlacement.width}" height="${partnerPlacement.height}" preserveAspectRatio="xMidYMid meet"${invertPartner ? ' filter="url(#partner-tone)"' : ''}/>` : ''}`
    : `<image href="${brandLogo}" x="${brandPlacement.x}" y="${brandPlacement.y}" width="${brandPlacement.width}" height="${brandPlacement.height}" preserveAspectRatio="xMidYMid meet"/>`;
  const identityLabel = kind === 'blog'
    ? `<text x="158" y="99" fill="${foreground}" font-family="Inter,Arial,sans-serif" font-size="19" font-weight="650">${escapeXml(identityName)}</text>`
    : '';
  const pageNumber = kind === 'slides'
    ? `<text x="${width - 84}" y="${height - 64}" text-anchor="end" fill="${foreground}" opacity="0.58" font-family="ui-monospace,monospace" font-size="16">01 / 12</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${imageLayer}${logoLayer}${identityLabel}<text x="84" y="224" fill="${foreground}" opacity="0.58" font-family="ui-monospace,monospace" font-size="17" letter-spacing="2">${escapeXml(eyebrow)}</text>${lines}<text x="84" y="${height - 64}" fill="${foreground}" opacity="0.58" font-family="ui-monospace,monospace" font-size="16">${escapeXml(website)}</text>${pageNumber}</svg>`;
}
