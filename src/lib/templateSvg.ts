import { escapeXml } from '@/lib/download';
import type { TemplateKind } from '@/lib/templateAssets';

export type TemplateTexture = 'white' | 'dark' | 'grid' | 'noise';

type TemplateSvgOptions = {
  background: string;
  backgroundImage?: string | null;
  brandLogo: string;
  eyebrow: string;
  foreground: string;
  height: number;
  identityName: string;
  invertPartner?: boolean;
  kind: TemplateKind;
  partnerLogo?: string | null;
  texture: TemplateTexture;
  title: string;
  website: string;
  width: number;
};

function textureLayer(texture: TemplateTexture, background: string): string {
  if (texture === 'grid') {
    return `<defs><pattern id="texture" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#9A9A93" stroke-opacity="0.22"/></pattern></defs><rect width="100%" height="100%" fill="${background}"/><rect width="100%" height="100%" fill="url(#texture)"/>`;
  }

  if (texture === 'noise') {
    return `<defs><filter id="noise"><feTurbulence baseFrequency="0.75" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.08"/></feComponentTransfer></filter></defs><rect width="100%" height="100%" fill="${background}"/><rect width="100%" height="100%" filter="url(#noise)" opacity="0.45"/>`;
  }

  return `<rect width="100%" height="100%" fill="${background}"/>`;
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
    brandLogo,
    eyebrow,
    foreground,
    height,
    identityName,
    invertPartner,
    kind,
    partnerLogo,
    texture,
    title,
    website,
    width,
  } = options;
  const imageLayer = backgroundImage
    ? `<image href="${backgroundImage}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/><rect width="${width}" height="${height}" fill="${background}" opacity="0.84"/>`
    : textureLayer(texture, background);
  const lineStart = kind === 'partnership' ? 310 : kind === 'slides' ? 330 : 286;
  const fontSize = kind === 'slides' ? 78 : 68;
  const lineHeight = kind === 'slides' ? 88 : 78;
  const lines = titleLines(title, kind)
    .map((line, index) => `<text x="84" y="${lineStart + index * lineHeight}" fill="${foreground}" font-family="Inter,Arial,sans-serif" font-size="${fontSize}" font-weight="700" letter-spacing="-2">${escapeXml(line)}</text>`)
    .join('');

  const partnerFilter = invertPartner
    ? '<defs><filter id="partner-tone"><feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter></defs>'
    : '';
  const logoLayer = kind === 'partnership'
    ? `${partnerFilter}<image href="${brandLogo}" x="84" y="54" width="136" height="136" preserveAspectRatio="xMidYMid meet"/><text x="${width - 356}" y="131" fill="${foreground}" opacity="0.38" font-family="Inter,Arial,sans-serif" font-size="30">×</text>${partnerLogo ? `<image href="${partnerLogo}" x="${width - 292}" y="78" width="208" height="82" preserveAspectRatio="xMidYMid meet"${invertPartner ? ' filter="url(#partner-tone)"' : ''}/>` : ''}`
    : `<image href="${brandLogo}" x="84" y="64" width="${kind === 'slides' ? 104 : 56}" height="${kind === 'slides' ? 104 : 56}" preserveAspectRatio="xMidYMid meet"/>`;
  const identityLabel = kind === 'blog'
    ? `<text x="158" y="99" fill="${foreground}" font-family="Inter,Arial,sans-serif" font-size="19" font-weight="650">${escapeXml(identityName)}</text>`
    : '';
  const pageNumber = kind === 'slides'
    ? `<text x="${width - 84}" y="${height - 64}" text-anchor="end" fill="${foreground}" opacity="0.58" font-family="ui-monospace,monospace" font-size="16">01 / 12</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${imageLayer}${logoLayer}${identityLabel}<text x="84" y="224" fill="${foreground}" opacity="0.58" font-family="ui-monospace,monospace" font-size="17" letter-spacing="2">${escapeXml(eyebrow)}</text>${lines}<text x="84" y="${height - 64}" fill="${foreground}" opacity="0.58" font-family="ui-monospace,monospace" font-size="16">${escapeXml(website)}</text>${pageNumber}</svg>`;
}
