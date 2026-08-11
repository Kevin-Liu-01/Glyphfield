import type {
  BrandArtDirection,
  BrandAsset,
  BrandIdentity,
} from './brandIdentity';
import type { MoodboardComposition } from './moodboard';

export type MoodboardSvgAssets = {
  accentFont?: string;
  artAssets?: readonly Pick<
    BrandAsset,
    'focalPoint' | 'id' | 'label' | 'path' | 'type'
  >[];
  bodyFont?: string;
  codeFont?: string;
  displayFont?: string;
  logoMarks?: readonly string[];
  markDark?: string;
  markLight?: string;
};

type BoardTileKind =
  | 'application'
  | 'editorial'
  | 'hero'
  | 'logo'
  | 'motion'
  | 'palette'
  | 'system'
  | 'triptych'
  | 'type';

const COMPLETE_BOARD_TILES: readonly BoardTileKind[] = [
  'hero',
  'logo',
  'type',
  'palette',
  'system',
  'triptych',
  'editorial',
  'application',
  'motion',
];

type BoardRecipe = {
  applicationIds: readonly [string, string];
  heroId: string;
  heroTone: 'dark' | 'light';
  id: BrandArtDirection['moodboard'];
  showcaseOrder: readonly [
    BoardTileKind,
    BoardTileKind,
    BoardTileKind,
    BoardTileKind,
    BoardTileKind,
    BoardTileKind,
  ];
  systemId: string;
  systemOrder: readonly [
    BoardTileKind,
    BoardTileKind,
    BoardTileKind,
    BoardTileKind,
    BoardTileKind,
    BoardTileKind,
  ];
  triptychIds: readonly [string, string, string];
};

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapText(value: string, lineLength: number, maximumLines: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  for (const word of words) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > lineLength) {
      if (lines.length === maximumLines) break;
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }

  return lines;
}

function textLines(
  lines: readonly string[],
  x: number,
  y: number,
  lineHeight: number,
  attributes: string
): string {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * lineHeight}" ${attributes}>${escapeXml(line)}</text>`
    )
    .join('');
}

function color(identity: BrandIdentity, id: string, fallback: string): string {
  return identity.colors.find((entry) => entry.id === id)?.hex ?? fallback;
}

function isLight(hex: string): boolean {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return true;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 156;
}

function embeddedFont(name: string, source: string | undefined): string {
  if (!source) return '';
  return `@font-face{font-family:'${name}';src:url('${escapeXml(source)}');font-style:normal;font-weight:100 900;font-display:block;}`;
}

function imageFilter(treatment: BrandIdentity['style']['imageTreatment']): string {
  if (treatment === 'monochrome') {
    return '<filter id="brand-image-treatment"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="1.05" intercept="-.025"/><feFuncG type="linear" slope="1.05" intercept="-.025"/><feFuncB type="linear" slope="1.05" intercept="-.025"/></feComponentTransfer></filter>';
  }
  if (treatment === 'duotone') {
    return '<filter id="brand-image-treatment"><feColorMatrix values=".62 .24 .14 0 .06 .28 .52 .2 0 .03 .12 .24 .64 0 0 0 0 0 1 0"/></filter>';
  }
  return '';
}

function artAsset(
  assets: MoodboardSvgAssets,
  id: string
): Pick<BrandAsset, 'focalPoint' | 'id' | 'label' | 'path' | 'type'> | undefined {
  return assets.artAssets?.find((asset) => asset.id === id);
}

function assetImage(
  asset: Pick<BrandAsset, 'focalPoint' | 'id' | 'label' | 'path' | 'type'> | undefined,
  x: number,
  y: number,
  width: number,
  height: number,
  treatment: BrandIdentity['style']['imageTreatment']
): string {
  if (!asset) return '';
  const focalX = asset.focalPoint?.x ?? 0.5;
  const focalY = asset.focalPoint?.y ?? 0.5;
  const alignX = focalX < 0.4 ? 'xMin' : focalX > 0.6 ? 'xMax' : 'xMid';
  const alignY = focalY < 0.4 ? 'YMin' : focalY > 0.6 ? 'YMax' : 'YMid';
  const applyTreatment = treatment !== 'natural' && !asset.path.endsWith('.svg');
  const inset = Math.max(6, Math.min(width, height) * 0.045);

  return `<image href="${escapeXml(asset.path)}" x="${x + inset}" y="${y + inset}" width="${Math.max(1, width - inset * 2)}" height="${Math.max(1, height - inset * 2)}" preserveAspectRatio="${alignX}${alignY} meet"${applyTreatment ? ' filter="url(#brand-image-treatment)"' : ''}/>`;
}

function logo(
  source: string | undefined,
  fallback: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string
): string {
  if (source) {
    return `<image href="${escapeXml(source)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMinYMid meet"/>`;
  }
  return `<text x="${x}" y="${y + height * 0.72}" class="display" fill="${fill}" font-size="${Math.min(width, height) * 0.58}" font-weight="500">${escapeXml(fallback)}</text>`;
}

function recipe(identity: BrandIdentity): BoardRecipe {
  switch (identity.artDirection.moodboard) {
    case 'monochrome-language':
      return {
        applicationIds: ['library-workflow', 'library-system'],
        heroId: 'library-hero',
        heroTone: 'dark',
        id: 'monochrome-language',
        showcaseOrder: ['hero', 'logo', 'triptych', 'type', 'palette', 'system'],
        systemId: 'library-system',
        systemOrder: ['logo', 'type', 'palette', 'hero', 'triptych', 'system'],
        triptychIds: ['library-workflow', 'library-material', 'library-signal'],
      };
    case 'research-wall':
      return {
        applicationIds: ['library-interface', 'library-detail'],
        heroId: 'library-hero',
        heroTone: 'light',
        id: 'research-wall',
        showcaseOrder: ['hero', 'editorial', 'triptych', 'palette', 'system', 'type'],
        systemId: 'library-system',
        systemOrder: ['editorial', 'logo', 'triptych', 'type', 'palette', 'system'],
        triptychIds: ['library-editorial', 'library-material', 'library-signal'],
      };
    case 'editorial-evidence':
      return {
        applicationIds: ['library-overview', 'library-interface'],
        heroId: 'library-campaign',
        heroTone: 'dark',
        id: 'editorial-evidence',
        showcaseOrder: ['hero', 'application', 'editorial', 'triptych', 'palette', 'type'],
        systemId: 'library-system',
        systemOrder: ['logo', 'editorial', 'palette', 'application', 'type', 'system'],
        triptychIds: ['library-editorial', 'library-detail', 'library-motion'],
      };
    case 'knowledge-system':
      return {
        applicationIds: ['library-hero', 'library-workflow'],
        heroId: 'library-atmosphere',
        heroTone: 'dark',
        id: 'knowledge-system',
        showcaseOrder: ['hero', 'application', 'triptych', 'editorial', 'type', 'palette'],
        systemId: 'library-system',
        systemOrder: ['logo', 'type', 'system', 'palette', 'application', 'editorial'],
        triptychIds: ['library-system', 'library-material', 'library-signal'],
      };
    case 'utility-current':
      return {
        applicationIds: ['library-interface', 'library-workflow'],
        heroId: 'library-hero',
        heroTone: 'dark',
        id: 'utility-current',
        showcaseOrder: ['hero', 'triptych', 'application', 'type', 'palette', 'system'],
        systemId: 'library-system',
        systemOrder: ['editorial', 'logo', 'type', 'system', 'palette', 'application'],
        triptychIds: ['library-overview', 'library-editorial', 'library-signal'],
      };
    case 'cinematic-field':
      return {
        applicationIds: ['library-editorial', 'library-detail'],
        heroId: 'library-overview',
        heroTone: 'dark',
        id: 'cinematic-field',
        showcaseOrder: ['hero', 'motion', 'application', 'triptych', 'type', 'system'],
        systemId: 'library-workflow',
        systemOrder: ['logo', 'system', 'type', 'palette', 'editorial', 'application'],
        triptychIds: ['library-material', 'library-signal', 'library-campaign'],
      };
    case 'network-atlas':
      return {
        applicationIds: ['library-overview', 'library-workflow'],
        heroId: 'library-hero',
        heroTone: 'dark',
        id: 'network-atlas',
        showcaseOrder: ['hero', 'triptych', 'system', 'application', 'palette', 'editorial'],
        systemId: 'library-system',
        systemOrder: ['logo', 'palette', 'system', 'type', 'application', 'editorial'],
        triptychIds: ['library-material', 'library-signal', 'library-atmosphere'],
      };
    case 'product-spectrum':
      return {
        applicationIds: ['library-overview', 'library-interface'],
        heroId: 'library-atmosphere',
        heroTone: 'dark',
        id: 'product-spectrum',
        showcaseOrder: ['hero', 'triptych', 'application', 'editorial', 'palette', 'type'],
        systemId: 'library-motion',
        systemOrder: ['logo', 'type', 'palette', 'application', 'system', 'editorial'],
        triptychIds: ['library-editorial', 'library-detail', 'library-material'],
      };
    case 'modular-proof':
    default:
      return {
        applicationIds: ['library-interface', 'library-workflow'],
        heroId: 'library-hero',
        heroTone: 'dark',
        id: 'modular-proof',
        showcaseOrder: ['hero', 'triptych', 'editorial', 'type', 'palette', 'system'],
        systemId: 'library-system',
        systemOrder: ['editorial', 'triptych', 'logo', 'palette', 'type', 'system'],
        triptychIds: ['library-editorial', 'library-material', 'library-signal'],
      };
  }
}

function panelLabel(value: string, x: number, y: number, fill: string, large: boolean): string {
  return `<text x="${x}" y="${y}" class="body" fill="${fill}" opacity=".62" font-size="${large ? 14 : 9}" font-weight="500" letter-spacing="${large ? 2.2 : 1.5}">${escapeXml(value.toLocaleUpperCase())}</text>`;
}

function renderHero(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  boardRecipe: BoardRecipe,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const emphasis = color(identity, 'emphasis', ink);
  const large = height > 400;
  const heroFill = identity.id === 'gt' ? ink : emphasis;
  const titleFill = isLight(heroFill) ? ink : paper;
  const pad = large ? 42 : 26;
  const titleSize = large ? 68 : 34;
  const lineHeight = large ? 70 : 35;
  const title = wrapText(identity.tagline, large ? 24 : 29, 2);
  const mark = isLight(heroFill) ? assets.markDark : assets.markLight;

  if (identity.id === 'gt') {
    const source = artAsset(assets, boardRecipe.heroId);
    const markWidth = large ? 190 : 116;
    const markHeight = large ? 108 : 68;
    return `<rect width="${width}" height="${height}" fill="#050606"/>${source ? `<image href="${escapeXml(source.path)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>` : ''}${logo(assets.markLight, identity.shortName, width / 2 - markWidth / 2, height / 2 - markHeight / 2, markWidth, markHeight, '#FFFFFF')}`;
  }

  return `<rect width="${width}" height="${height}" fill="${heroFill}"/>${logo(mark, identity.shortName, pad, pad, large ? 156 : 92, large ? 58 : 34, titleFill)}${textLines(title, pad, height - pad - (title.length - 1) * lineHeight, lineHeight, `class="display" fill="${titleFill}" font-size="${titleSize}" font-weight="500" letter-spacing="${large ? -2.4 : -1.2}"`)}<text x="${width - pad}" y="${pad + (large ? 18 : 11)}" text-anchor="end" class="body" fill="${titleFill}" font-size="${large ? 14 : 9}">${escapeXml(identity.website)}</text>`;
}

function renderTriptych(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  boardRecipe: BoardRecipe,
  width: number,
  height: number
): string {
  const paper = color(identity, 'paper', '#FFFFFF');
  const ink = color(identity, 'ink', '#181818');
  const large = height > 400;
  const gap = large ? 16 : 10;
  const pad = large ? 28 : 18;
  const labelHeight = large ? 64 : 40;
  const imageWidth = (width - pad * 2 - gap * 2) / 3;

  return `<rect width="${width}" height="${height}" fill="${paper}"/>${boardRecipe.triptychIds.map((id, index) => {
    const source = artAsset(assets, id);
    const x = pad + index * (imageWidth + gap);
    return `<g transform="translate(${x} ${pad})"><rect width="${imageWidth}" height="${height - pad * 2}" fill="${color(identity, 'muted', '#F4F4F4')}"/>${assetImage(source, 0, 0, imageWidth, height - pad * 2 - labelHeight, identity.style.imageTreatment)}<rect y="${height - pad * 2 - labelHeight}" width="${imageWidth}" height="${labelHeight}" fill="${index === 1 ? ink : paper}"/><text x="${large ? 18 : 12}" y="${height - pad * 2 - (large ? 25 : 16)}" class="body" fill="${index === 1 ? paper : ink}" font-size="${large ? 15 : 9}" font-weight="500">${escapeXml(source?.label ?? identity.name)}</text></g>`;
  }).join('')}`;
}

function renderEditorial(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  boardRecipe: BoardRecipe,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const large = height > 400;
  const imageWidth = width * (large ? 0.46 : 0.42);
  const source = artAsset(assets, boardRecipe.applicationIds[0]);
  const pad = large ? 42 : 26;
  const concept = wrapText(identity.strategy.concept, large ? 30 : 26, large ? 4 : 3);

  return `<rect width="${width}" height="${height}" fill="${paper}"/><rect width="${imageWidth}" height="${height}" fill="${color(identity, 'muted', '#F4F4F4')}"/>${assetImage(source, 0, 0, imageWidth, height, identity.style.imageTreatment)}<g transform="translate(${imageWidth} 0)"><rect width="${width - imageWidth}" height="${height}" fill="${paper}"/>${panelLabel(identity.strategy.promise, pad, pad + (large ? 12 : 6), ink, large)}${textLines(concept, pad, large ? 170 : 100, large ? 48 : 28, `class="display" fill="${ink}" font-size="${large ? 42 : 23}" font-weight="500" letter-spacing="${large ? -1.4 : -.5}"`)}<text x="${pad}" y="${height - pad}" class="body" fill="${ink}" font-size="${large ? 14 : 9}">${escapeXml(identity.name)}</text></g>`;
}

function renderPalette(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const large = height > 400;
  const palette = identity.colors.slice(0, 4);
  const swatchWidth = width / Math.max(1, palette.length);
  const logoHeight = large ? 158 : 86;

  return `<rect width="${width}" height="${height}" fill="${paper}"/>${palette.map(({ hex, name }, index) => {
    const textColor = isLight(hex) ? ink : paper;
    return `<g transform="translate(${index * swatchWidth} 0)"><rect width="${swatchWidth}" height="${height - logoHeight}" fill="${escapeXml(hex)}"/><text x="${large ? 20 : 12}" y="${height - logoHeight - (large ? 50 : 28)}" class="body" fill="${textColor}" font-size="${large ? 17 : 10}" font-weight="500">${escapeXml(name)}</text><text x="${large ? 20 : 12}" y="${height - logoHeight - (large ? 22 : 12)}" class="body" fill="${textColor}" opacity=".62" font-size="${large ? 13 : 8}">${escapeXml(hex.toLocaleUpperCase())}</text></g>`;
  }).join('')}<rect y="${height - logoHeight}" width="${width}" height="${logoHeight}" fill="${paper}"/>${logo(assets.logoMarks?.[2] ?? assets.markDark, identity.name, large ? 30 : 18, height - logoHeight + (large ? 34 : 20), width * 0.52, large ? 86 : 46, ink)}<text x="${width - (large ? 30 : 18)}" y="${height - (large ? 30 : 18)}" text-anchor="end" class="body" fill="${ink}" opacity=".52" font-size="${large ? 13 : 8}">COLOR / SURFACE / CONTRAST</text>`;
}

function renderType(identity: BrandIdentity, width: number, height: number): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const accent = color(identity, 'emphasis', '#E4E4E4');
  const large = height > 400;
  const display = identity.typography.find(({ role }) => role === 'Display');
  const body = identity.typography.find(({ role }) => role === 'Body');
  const specimen = 'Aa';

  return `<rect width="${width}" height="${height}" fill="${ink}"/>${panelLabel('Typography', large ? 34 : 22, large ? 54 : 32, paper, large)}<text x="${large ? 34 : 22}" y="${height * 0.63}" class="display" fill="${paper}" font-size="${large ? 232 : 116}" font-weight="500" letter-spacing="${large ? -12 : -6}">${escapeXml(specimen)}</text><path d="M${width * 0.48} 0V${height}" stroke="${paper}" stroke-opacity=".18"/><text x="${width * 0.54}" y="${height * 0.35}" class="display" fill="${paper}" font-size="${large ? 34 : 19}" font-weight="500">${escapeXml(display?.family ?? identity.name)}</text><text x="${width * 0.54}" y="${height * 0.44}" class="body" fill="${paper}" opacity=".58" font-size="${large ? 17 : 10}">${escapeXml(body?.family ?? display?.family ?? identity.name)}</text><text x="${width * 0.54}" y="${height * 0.62}" class="body" fill="${accent}" font-size="${large ? 22 : 13}" font-weight="400">${escapeXml(identity.greetings.slice(0, 3).join(' · '))}</text><text x="${width * 0.54}" y="${height * 0.78}" class="body" fill="${paper}" opacity=".46" font-size="${large ? 13 : 8}">${escapeXml((display?.usage ?? 'Display typography').toLocaleUpperCase())}</text>`;
}

function renderLogo(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const large = height > 400;
  const half = width / 2;
  const markWidth = large ? half * 0.5 : half * 0.42;
  const markHeight = large ? height * 0.36 : height * 0.34;

  return `<rect width="${half}" height="${height}" fill="${paper}"/><rect x="${half}" width="${half}" height="${height}" fill="${ink}"/>${logo(assets.logoMarks?.[0] ?? assets.markDark, identity.shortName, (half - markWidth) / 2, (height - markHeight) / 2, markWidth, markHeight, ink)}${logo(assets.logoMarks?.[1] ?? assets.markLight, identity.shortName, half + (half - markWidth) / 2, (height - markHeight) / 2, markWidth, markHeight, paper)}${panelLabel('Primary', large ? 28 : 16, large ? 48 : 28, ink, large)}${panelLabel('Reverse', half + (large ? 28 : 16), large ? 48 : 28, paper, large)}<text x="${half - (large ? 28 : 16)}" y="${height - (large ? 28 : 16)}" text-anchor="end" class="body" fill="${ink}" opacity=".5" font-size="${large ? 13 : 8}">LIGHT</text><text x="${width - (large ? 28 : 16)}" y="${height - (large ? 28 : 16)}" text-anchor="end" class="body" fill="${paper}" opacity=".5" font-size="${large ? 13 : 8}">DARK</text>`;
}

function renderSystem(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  boardRecipe: BoardRecipe,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F4');
  const large = height > 400;
  const source = artAsset(assets, boardRecipe.systemId);
  const imageWidth = width * 0.62;
  const pad = large ? 34 : 20;
  const description = wrapText(identity.graphicSystem.composition, large ? 30 : 24, 4);

  return `<rect width="${width}" height="${height}" fill="${muted}"/>${assetImage(source, 0, 0, imageWidth, height, identity.style.imageTreatment)}<g transform="translate(${imageWidth} 0)"><rect width="${width - imageWidth}" height="${height}" fill="${paper}"/>${panelLabel(identity.graphicSystem.device, pad, pad + (large ? 12 : 6), ink, large)}${textLines(description, pad, large ? 132 : 78, large ? 27 : 17, `class="body" fill="${ink}" font-size="${large ? 16 : 10}" font-weight="400"`)}</g>`;
}

function renderApplication(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  boardRecipe: BoardRecipe,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F4');
  const large = height > 400;
  const gap = large ? 18 : 10;
  const pad = large ? 28 : 16;
  const cardWidth = (width - pad * 2 - gap) / 2;
  const labelHeight = large ? 88 : 50;

  return `<rect width="${width}" height="${height}" fill="${muted}"/>${boardRecipe.applicationIds.map((id, index) => {
    const source = artAsset(assets, id);
    const x = pad + index * (cardWidth + gap);
    const fill = index === 0 ? paper : ink;
    const textColor = index === 0 ? ink : paper;
    return `<g transform="translate(${x} ${pad})"><rect width="${cardWidth}" height="${height - pad * 2}" fill="${fill}"/>${assetImage(source, 0, 0, cardWidth, height - pad * 2 - labelHeight, identity.style.imageTreatment)}<rect y="${height - pad * 2 - labelHeight}" width="${cardWidth}" height="${labelHeight}" fill="${fill}"/><text x="${large ? 18 : 11}" y="${height - pad * 2 - (large ? 48 : 27)}" class="body" fill="${textColor}" opacity=".5" font-size="${large ? 12 : 7}">0${index + 1}</text><text x="${large ? 18 : 11}" y="${height - pad * 2 - (large ? 20 : 11)}" class="body" fill="${textColor}" font-size="${large ? 17 : 10}" font-weight="500">${escapeXml(source?.label ?? identity.products[index] ?? identity.name)}</text></g>`;
  }).join('')}`;
}

function renderMotion(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  boardRecipe: BoardRecipe,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F4');
  const large = height > 400;
  const ids = ['library-motion', 'library-signal', boardRecipe.triptychIds[0]] as const;
  const stripWidth = width / 3;
  const labelHeight = large ? 62 : 38;

  return `<rect width="${width}" height="${height}" fill="${muted}"/>${ids.map((id, index) => {
    const source = artAsset(assets, id);
    return `<g transform="translate(${index * stripWidth} 0)"><rect width="${stripWidth}" height="${height - labelHeight}" fill="${muted}"/>${assetImage(source, 0, 0, stripWidth, height - labelHeight, identity.style.imageTreatment)}<rect y="${height - labelHeight}" width="${stripWidth}" height="${labelHeight}" fill="${index === 1 ? ink : paper}"/><text x="${large ? 22 : 13}" y="${height - (large ? 24 : 15)}" class="body" fill="${index === 1 ? paper : ink}" font-size="${large ? 14 : 8}" font-weight="500">0${index + 1} / ${escapeXml(source?.label ?? 'MOTION STATE')}</text></g>`;
  }).join('')}`;
}

function renderTile(
  kind: BoardTileKind,
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  boardRecipe: BoardRecipe,
  width: number,
  height: number
): string {
  switch (kind) {
    case 'application':
      return renderApplication(identity, assets, boardRecipe, width, height);
    case 'editorial':
      return renderEditorial(identity, assets, boardRecipe, width, height);
    case 'hero':
      return renderHero(identity, assets, boardRecipe, width, height);
    case 'logo':
      return renderLogo(identity, assets, width, height);
    case 'motion':
      return renderMotion(identity, assets, boardRecipe, width, height);
    case 'palette':
      return renderPalette(identity, assets, width, height);
    case 'system':
      return renderSystem(identity, assets, boardRecipe, width, height);
    case 'triptych':
      return renderTriptych(identity, assets, boardRecipe, width, height);
    case 'type':
      return renderType(identity, width, height);
  }
}

function renderGtMaterialPanel(
  _assets: MoodboardSvgAssets,
  width: number,
  height: number
): string {
  const gap = 14;
  const pad = 18;
  const panelWidth = (width - pad * 2 - gap * 2) / 3;
  const panelHeight = height - pad * 2;
  const labelY = panelHeight - 18;

  return `<defs>
    <linearGradient id="gt-soft-field" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".48" stop-color="#f2f2f2"/><stop offset="1" stop-color="#cfcfcf"/></linearGradient>
    <linearGradient id="gt-matte-glass" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff" stop-opacity=".9"/><stop offset=".52" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient>
    <radialGradient id="gt-light-pool" cx="50%" cy="45%" r="60%"><stop stop-color="#fff" stop-opacity=".72"/><stop offset=".4" stop-color="#a8a8a8" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <pattern id="gt-fine-dither" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".75" fill="#fff" fill-opacity=".2"/></pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="#080808"/>
  <g transform="translate(${pad} ${pad})"><rect width="${panelWidth}" height="${panelHeight}" fill="url(#gt-soft-field)"/><rect x="${panelWidth * 0.2}" y="${panelHeight * 0.2}" width="${panelWidth * 0.6}" height="${panelHeight * 0.46}" fill="#fff" fill-opacity=".52" stroke="#000" stroke-opacity=".1"/><text x="14" y="${labelY}" class="body" fill="#111" opacity=".62" font-size="10">01 / SOFT LIGHT</text></g>
  <g transform="translate(${pad + panelWidth + gap} ${pad})"><rect width="${panelWidth}" height="${panelHeight}" fill="#050505"/><rect width="${panelWidth}" height="${panelHeight - 44}" fill="url(#gt-light-pool)"/><rect width="${panelWidth}" height="${panelHeight - 44}" fill="url(#gt-fine-dither)"/><text x="14" y="${labelY}" class="body" fill="#fff" opacity=".62" font-size="10">02 / FINE DITHER</text></g>
  <g transform="translate(${pad + (panelWidth + gap) * 2} ${pad})"><rect width="${panelWidth}" height="${panelHeight}" fill="#e6e6e6"/><rect x="${panelWidth * 0.14}" y="${panelHeight * 0.16}" width="${panelWidth * 0.72}" height="${panelHeight * 0.5}" rx="6" fill="url(#gt-matte-glass)" stroke="#111" stroke-opacity=".16"/><rect x="${panelWidth * 0.29}" y="${panelHeight * 0.28}" width="${panelWidth * 0.42}" height="${panelHeight * 0.26}" rx="3" fill="#111"/><text x="14" y="${labelY}" class="body" fill="#111" opacity=".62" font-size="10">03 / MATTE GLASS</text></g>`;
}

function renderGtStudyGallery(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  ids: readonly string[],
  width: number,
  height: number
): string {
  const pad = 16;
  const gap = 12;
  const labelHeight = 46;
  const cardWidth = (width - pad * 2 - gap * (ids.length - 1)) / ids.length;
  const cardHeight = height - pad * 2;

  return `<rect width="${width}" height="${height}" fill="#f4f4f3"/>${ids.map((id, index) => {
    const source = artAsset(assets, id);
    const x = pad + index * (cardWidth + gap);
    const labelFill = index === 1 ? '#171717' : '#ffffff';
    const labelColor = index === 1 ? '#ffffff' : '#181818';

    return `<g transform="translate(${x} ${pad})"><rect width="${cardWidth}" height="${cardHeight}" fill="#ffffff"/>${assetImage(source, 0, 0, cardWidth, cardHeight - labelHeight, identity.style.imageTreatment)}<rect y="${cardHeight - labelHeight}" width="${cardWidth}" height="${labelHeight}" fill="${labelFill}"/><text x="14" y="${cardHeight - 18}" class="body" fill="${labelColor}" font-size="10" font-weight="500">0${index + 1} / ${escapeXml(source?.label ?? 'MONOCHROME STUDY')}</text></g>`;
  }).join('')}`;
}

function renderGtTypePanel(
  identity: BrandIdentity,
  width: number,
  height: number
): string {
  const display = identity.typography.find(({ role }) => role === 'Display');
  const body = identity.typography.find(({ role }) => role === 'Body');
  const pad = height > 500 ? 34 : 24;
  const dividerX = width * 0.5;
  const specimenSize = Math.min(height * 0.44, width * 0.42);
  const greetingY = height * 0.67;

  return `<rect width="${width}" height="${height}" fill="#0a0b0c"/>${panelLabel('Typography', pad, pad + 18, '#fff', height > 500)}<text x="${pad}" y="${height * 0.58}" class="display" fill="#fff" font-size="${specimenSize}" font-weight="500" letter-spacing="${-specimenSize * 0.055}">Aa</text><path d="M${dividerX} 0V${height}" stroke="#fff" stroke-opacity=".18"/><text x="${dividerX + pad}" y="${height * 0.28}" class="display" fill="#fff" font-size="${height > 500 ? 32 : 21}" font-weight="500">${escapeXml(display?.family ?? 'Switzer')}</text><text x="${dividerX + pad}" y="${height * 0.37}" class="body" fill="#fff" opacity=".58" font-size="${height > 500 ? 16 : 11}">${escapeXml(body?.family ?? 'Rasmus Inter')}</text><text x="${dividerX + pad}" y="${greetingY}" class="body" fill="#fff" font-size="${height > 500 ? 18 : 12}" font-weight="400">Welcome · Bienvenidos</text><text x="${dividerX + pad}" y="${greetingY + (height > 500 ? 34 : 24)}" class="body" fill="#fff" opacity=".66" font-size="${height > 500 ? 18 : 12}" font-weight="400">你好 · ようこそ · أهلاً</text><text x="${dividerX + pad}" y="${height - pad}" class="body" fill="#fff" opacity=".42" font-size="${height > 500 ? 11 : 8}" letter-spacing="1.2">DISPLAY / INTERFACE / MULTILINGUAL</text>`;
}

function renderGtHeroPanel(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  width: number,
  height: number
): string {
  const markWidth = Math.min(width * 0.18, 156);
  const markHeight = markWidth * 0.54;

  const fieldX = width * 0.48;
  const fieldY = height * 0.34;
  const fieldWidth = width - fieldX;
  const fieldHeight = height - fieldY;

  return `<defs>
    <radialGradient id="gt-hero-field" cx="100%" cy="100%" r="108%"><stop stop-color="#f7f7f7"/><stop offset=".16" stop-color="#bdbdbd"/><stop offset=".38" stop-color="#575757"/><stop offset=".66" stop-color="#171717"/><stop offset="1" stop-color="#050505"/></radialGradient>
    <pattern id="gt-hero-dither" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".62" fill="#fff" fill-opacity=".1"/></pattern>
  </defs>
  <rect width="${width}" height="${height}" fill="#050505"/>
  <rect x="${fieldX}" y="${fieldY}" width="${fieldWidth}" height="${fieldHeight}" fill="url(#gt-hero-field)"/>
  <rect x="${fieldX}" y="${fieldY}" width="${fieldWidth}" height="${fieldHeight}" fill="url(#gt-hero-dither)"/>
  ${logo(assets.markLight, identity.shortName, 30, 28, markWidth, markHeight, '#fff')}
  <text x="30" y="${height - 38}" class="display" fill="#fff" font-size="28" font-weight="500">Language, in sync.</text>`;
}

function renderGtBoard(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  composition: Exclude<MoodboardComposition, 'catalog'>,
  dimensions: ReturnType<typeof boardDimensions>
): string {
  const margin = dimensions.margin;
  const gap = dimensions.gap;

  if (composition === 'showcase') {
    const tileWidth = (dimensions.width - margin * 2 - gap) / 2;
    const tileHeight = (dimensions.height - margin * 2 - gap * 2) / 3;
    const secondY = margin + tileHeight + gap;
    const thirdY = secondY + tileHeight + gap;
    const rightX = margin + tileWidth + gap;
    const boardRecipe = recipe(identity);

    return `<g class="application-panel hero-panel" data-panel="hero" transform="translate(${margin} ${margin})">${renderGtHeroPanel(identity, assets, tileWidth, tileHeight)}</g><g class="application-panel triptych-panel" data-panel="triptych" data-primary-assets="library-advance library-constellation" transform="translate(${rightX} ${margin})">${renderGtStudyGallery(identity, assets, ['library-material', 'library-advance', 'library-constellation'], tileWidth, tileHeight)}</g><g class="application-panel application-study-panel" data-panel="application" transform="translate(${margin} ${secondY})">${renderGtStudyGallery(identity, assets, ['library-workflow', 'library-system'], tileWidth, tileHeight)}</g><g class="application-panel type-panel" data-panel="type" transform="translate(${rightX} ${secondY})">${renderGtTypePanel(identity, tileWidth, tileHeight)}</g><g class="application-panel logo-panel" data-panel="logo" transform="translate(${margin} ${thirdY})">${renderLogo(identity, assets, tileWidth, tileHeight)}</g><g class="application-panel system-panel" data-panel="system" transform="translate(${rightX} ${thirdY})">${renderSystem(identity, assets, boardRecipe, tileWidth, tileHeight)}</g>`;
  }

  const contentWidth = dimensions.width - margin * 2;
  const topHeight = 500;
  const secondY = margin + topHeight + gap;
  const secondHeight = 620;
  const thirdY = secondY + secondHeight + gap;
  const thirdHeight = dimensions.height - thirdY - margin;
  const heroWidth = 988;
  const sideWidth = contentWidth - gap - heroWidth;
  const halfWidth = (contentWidth - gap) / 2;
  const paletteWidth = 520;
  const systemWidth = contentWidth - gap - paletteWidth;
  const boardRecipe = recipe(identity);

  return `<g class="application-panel hero-panel" data-panel="hero" transform="translate(${margin} ${margin})">${renderGtHeroPanel(identity, assets, heroWidth, topHeight)}</g><g class="application-panel logo-panel" data-panel="logo" transform="translate(${margin + heroWidth + gap} ${margin})">${renderLogo(identity, assets, sideWidth, topHeight)}</g><g class="application-panel triptych-panel" data-panel="triptych" transform="translate(${margin} ${secondY})">${renderGtMaterialPanel(assets, halfWidth, secondHeight)}</g><g class="application-panel type-panel" data-panel="type" transform="translate(${margin + halfWidth + gap} ${secondY})">${renderGtTypePanel(identity, halfWidth, secondHeight)}</g><g class="application-panel palette-panel" data-panel="palette" transform="translate(${margin} ${thirdY})">${renderPalette(identity, assets, paletteWidth, thirdHeight)}</g><g class="application-panel system-panel" data-panel="system" transform="translate(${margin + paletteWidth + gap} ${thirdY})">${renderSystem(identity, assets, boardRecipe, systemWidth, thirdHeight)}</g>`;
}

function renderCatalogHeader(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F4');
  const applicationCount = identity.applications.length;
  const assetCount = assets.artAssets?.length ?? 0;

  return `<rect width="${width}" height="${height}" fill="${paper}"/>${logo(assets.markDark, identity.shortName, 28, 30, 118, 48, ink)}<text x="176" y="54" class="body" fill="${ink}" opacity=".5" font-size="12" font-weight="500" letter-spacing="2">COMPLETE BRAND SYSTEM</text><text x="28" y="116" class="display" fill="${ink}" font-size="44" font-weight="500" letter-spacing="-1.8">${escapeXml(identity.name)}</text><text x="28" y="148" class="body" fill="${ink}" opacity=".62" font-size="16">${escapeXml(identity.tagline)}</text><rect x="${width - 414}" y="24" width="386" height="${height - 48}" fill="${muted}"/><text x="${width - 386}" y="68" class="code" fill="${ink}" font-size="12" opacity=".52">SYSTEM VIEWS</text><text x="${width - 386}" y="106" class="display" fill="${ink}" font-size="30" font-weight="500">${COMPLETE_BOARD_TILES.length}</text><text x="${width - 258}" y="68" class="code" fill="${ink}" font-size="12" opacity=".52">SOURCE ASSETS</text><text x="${width - 258}" y="106" class="display" fill="${ink}" font-size="30" font-weight="500">${assetCount}</text><text x="${width - 126}" y="68" class="code" fill="${ink}" font-size="12" opacity=".52">APPLICATIONS</text><text x="${width - 126}" y="106" class="display" fill="${ink}" font-size="30" font-weight="500">${applicationCount}</text>`;
}

function renderCatalogSources(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F4');
  const columns = 6;
  const gap = 12;
  const sources = assets.artAssets ?? [];
  const rows = Math.max(1, Math.ceil(sources.length / columns));
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const cardHeight = (height - gap * (rows - 1)) / rows;

  if (sources.length === 0) {
    return `<rect width="${width}" height="${height}" fill="${paper}"/><text x="24" y="${height / 2}" class="body" fill="${ink}" opacity=".45" font-size="14">NO ELIGIBLE SOURCE ASSETS</text>`;
  }

  return sources.map((source, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * (cardWidth + gap);
    const y = row * (cardHeight + gap);
    const captionHeight = 30;
    return `<g class="source-asset" data-asset="${escapeXml(source.id)}" transform="translate(${x} ${y})"><rect width="${cardWidth}" height="${cardHeight}" fill="${paper}"/>${assetImage(source, 0, 0, cardWidth, cardHeight - captionHeight, identity.style.imageTreatment)}<rect y="${cardHeight - captionHeight}" width="${cardWidth}" height="${captionHeight}" fill="${muted}"/><text x="10" y="${cardHeight - 11}" class="body" fill="${ink}" font-size="9" font-weight="500">${escapeXml(source.label.toLocaleUpperCase().slice(0, 34))}</text></g>`;
  }).join('');
}

function renderCatalogApplications(
  identity: BrandIdentity,
  width: number,
  height: number
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F4');
  const emphasis = color(identity, 'emphasis', '#E4E4E4');
  const columns = 3;
  const gap = 16;
  const applications = identity.applications;
  const rows = Math.max(1, Math.ceil(applications.length / columns));
  const cardWidth = (width - gap * (columns - 1)) / columns;
  const cardHeight = (height - gap * (rows - 1)) / rows;

  return applications.map((application, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * (cardWidth + gap);
    const y = row * (cardHeight + gap);
    const description = wrapText(application.description, cardHeight < 145 ? 54 : 62, cardHeight < 145 ? 2 : 3);
    const meta = `${application.category} / ${application.format}`.toLocaleUpperCase();
    const accentFill = index % 3 === 0 ? emphasis : index % 3 === 1 ? muted : ink;
    const accentText = isLight(accentFill) ? ink : paper;

    return `<g class="generated-application" data-application="${escapeXml(application.id)}" transform="translate(${x} ${y})"><rect width="${cardWidth}" height="${cardHeight}" fill="${paper}"/><rect width="8" height="${cardHeight}" fill="${accentFill}"/><text x="24" y="30" class="code" fill="${ink}" opacity=".46" font-size="9">${String(index + 1).padStart(2, '0')} / ${escapeXml(meta.slice(0, 56))}</text><text x="24" y="60" class="display" fill="${ink}" font-size="20" font-weight="500" letter-spacing="-.5">${escapeXml(application.name)}</text>${textLines(description, 24, 86, 17, `class="body" fill="${ink}" opacity=".62" font-size="11"`)}<rect x="${cardWidth - 48}" y="18" width="28" height="28" fill="${accentFill}"/><text x="${cardWidth - 34}" y="37" text-anchor="middle" class="code" fill="${accentText}" font-size="10">${escapeXml(identity.shortName)}</text></g>`;
  }).join('');
}

function renderCompleteCatalog(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  boardRecipe: BoardRecipe,
  dimensions: ReturnType<typeof boardDimensions>
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const margin = dimensions.margin;
  const contentWidth = dimensions.width - margin * 2;
  const headerHeight = 174;
  const systemTop = margin + headerHeight + 44;
  const systemGap = 14;
  const systemTileHeight = 276;
  const systemTileWidth = (contentWidth - systemGap * 2) / 3;
  const systemBottom = systemTop + systemTileHeight * 3 + systemGap * 2;
  const sourcesLabelY = systemBottom + 44;
  const sourcesTop = sourcesLabelY + 18;
  const sourceRows = Math.max(1, Math.ceil((assets.artAssets?.length ?? 0) / 6));
  const sourcesHeight = sourceRows * 100 + (sourceRows - 1) * 12;
  const applicationsLabelY = sourcesTop + sourcesHeight + 44;
  const applicationsTop = applicationsLabelY + 18;
  const applicationsHeight = dimensions.height - applicationsTop - margin;

  return `<g transform="translate(${margin} ${margin})">${renderCatalogHeader(identity, assets, contentWidth, headerHeight)}</g><text x="${margin}" y="${systemTop - 16}" class="code" fill="${ink}" opacity=".54" font-size="11" font-weight="500" letter-spacing="2">ALL SYSTEM VIEWS</text>${COMPLETE_BOARD_TILES.map((kind, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + column * (systemTileWidth + systemGap);
    const y = systemTop + row * (systemTileHeight + systemGap);
    return `<g class="application-panel ${kind}-panel" data-panel="${kind}" transform="translate(${x} ${y})"><rect width="${systemTileWidth}" height="${systemTileHeight}" fill="${paper}"/>${renderTile(kind, identity, assets, boardRecipe, systemTileWidth, systemTileHeight)}</g>`;
  }).join('')}<text x="${margin}" y="${sourcesLabelY}" class="code" fill="${ink}" opacity=".54" font-size="11" font-weight="500" letter-spacing="2">ALL SOURCE ASSETS · ${assets.artAssets?.length ?? 0}</text><g data-panel="source-catalog" transform="translate(${margin} ${sourcesTop})">${renderCatalogSources(identity, assets, contentWidth, sourcesHeight)}</g><text x="${margin}" y="${applicationsLabelY}" class="code" fill="${ink}" opacity=".54" font-size="11" font-weight="500" letter-spacing="2">ALL GENERATED APPLICATIONS · ${identity.applications.length}</text><g data-panel="application-catalog" transform="translate(${margin} ${applicationsTop})">${renderCatalogApplications(identity, contentWidth, applicationsHeight)}</g>`;
}

function boardDimensions(composition: MoodboardComposition) {
  if (composition === 'showcase') {
    return { gap: 18, height: 900, margin: 24, tileHeight: 272, width: 1600 };
  }
  if (composition === 'catalog') {
    return { gap: 16, height: 2400, margin: 30, tileHeight: 276, width: 1600 };
  }
  return { gap: 24, height: 2000, margin: 30, tileHeight: 630, width: 1600 };
}

export function buildMoodboardSvg(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  composition: MoodboardComposition
): string {
  const boardRecipe = recipe(identity);
  const dimensions = boardDimensions(composition);
  const order = composition === 'showcase'
    ? boardRecipe.showcaseOrder
    : boardRecipe.systemOrder;
  const tileWidth = (dimensions.width - dimensions.margin * 2 - dimensions.gap) / 2;
  const fontDefinitions = [
    embeddedFont('Brand Display', assets.displayFont),
    embeddedFont('Brand Body', assets.bodyFont ?? assets.displayFont),
    embeddedFont('Brand Accent', assets.accentFont ?? assets.displayFont),
    embeddedFont('Brand Code', assets.codeFont ?? assets.bodyFont ?? assets.displayFont),
  ].join('');
  const boardFill = identity.id === 'gt' && composition === 'showcase'
    ? '#C8C8C2'
    : identity.id === 'gt'
      ? '#1A1A1A'
      : '#C8C8C2';

  const boardContent = identity.id === 'gt' && composition !== 'catalog'
    ? renderGtBoard(identity, assets, composition, dimensions)
    : composition === 'catalog'
      ? renderCompleteCatalog(identity, assets, boardRecipe, dimensions)
      : order.map((kind, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = dimensions.margin + column * (tileWidth + dimensions.gap);
        const y = dimensions.margin + row * (dimensions.tileHeight + dimensions.gap);
        return `<g class="application-panel ${kind}-panel" data-panel="${kind}" transform="translate(${x} ${y})"><rect width="${tileWidth}" height="${dimensions.tileHeight}" fill="${color(identity, 'paper', '#FFFFFF')}"/>${renderTile(kind, identity, assets, boardRecipe, tileWidth, dimensions.tileHeight)}</g>`;
      }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" viewBox="0 0 ${dimensions.width} ${dimensions.height}" data-board-mode="${composition}" data-board-recipe="${boardRecipe.id}" data-brand="${escapeXml(identity.id)}">
<defs><style>${fontDefinitions}.display{font-family:'Brand Display';}.body{font-family:'Brand Body';}.accent{font-family:'Brand Accent';}.code{font-family:'Brand Code';}</style>${imageFilter(identity.style.imageTreatment)}</defs>
<rect width="${dimensions.width}" height="${dimensions.height}" fill="${boardFill}"/>
${boardContent}
</svg>`;
}
