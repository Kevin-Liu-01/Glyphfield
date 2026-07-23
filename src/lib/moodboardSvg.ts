import type {
  BrandApplication,
  BrandGraphicSystem,
  BrandIdentity,
} from './brandIdentity';
import type { MoodboardComposition } from './moodboard';

export type MoodboardSvgAssets = {
  interFont?: string;
  logoMarks?: readonly string[];
  markDark?: string;
  markLight?: string;
  monoFont?: string;
  motionPreview?: string;
  proofMarks?: readonly string[];
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

function embeddedFont(name: string, source: string | undefined): string {
  if (!source) return '';
  return `@font-face{font-family:'${name}';src:url('${escapeXml(source)}');font-style:normal;font-weight:100 900;font-display:block;}`;
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
  return `<text x="${x}" y="${y + height * 0.72}" class="sans" fill="${fill}" font-size="${Math.min(width, height) * 0.58}" font-weight="800">${escapeXml(fallback)}</text>`;
}

function label(index: number, name: string, fill: string, x = 30, y = 34): string {
  return `<text x="${x}" y="${y}" class="mono" fill="${fill}" opacity=".52" font-size="9" letter-spacing="1.7">${String(index).padStart(2, '0')} / ${escapeXml(name.toLocaleUpperCase())}</text>`;
}

function isLight(hex: string): boolean {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return true;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 156;
}

function graphicMotif(
  graphicSystem: BrandGraphicSystem,
  width: number,
  height: number,
  foreground: string,
  accent: string
): string {
  switch (graphicSystem.pattern) {
    case 'brackets':
      return `<path d="M42 36H18V${height - 36}h24M${width - 42} 36h24v${height - 72}h-24" fill="none" stroke="${accent}" stroke-width="8"/><path d="M72 ${height / 2}H${width - 72}" stroke="${foreground}" stroke-opacity=".14"/><circle cx="${width / 2}" cy="${height / 2}" r="5" fill="${accent}"/>`;
    case 'burst':
    case 'rays':
      return Array.from({ length: 11 }, (_, index) => {
        const x = (index / 10) * width;
        return `<path d="M${width * 0.22} ${height * 0.82}L${x} 0" stroke="${index === 6 ? accent : foreground}" stroke-opacity="${index === 6 ? '.74' : '.12'}" stroke-width="${index === 6 ? 8 : 2}"/>`;
      }).join('');
    case 'flow':
    case 'wave':
      return Array.from({ length: 5 }, (_, index) => `<path d="M-30 ${54 + index * 46}C${width * 0.28} ${8 + index * 32},${width * 0.58} ${height - 12 - index * 34},${width + 30} ${46 + index * 41}" fill="none" stroke="${index === 2 ? accent : foreground}" stroke-opacity="${index === 2 ? '.72' : '.12'}" stroke-width="${index === 2 ? 8 : 2}"/>`).join('');
    case 'orbit':
      return Array.from({ length: 4 }, (_, index) => `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${70 + index * 58}" ry="${34 + index * 30}" fill="none" stroke="${index === 2 ? accent : foreground}" stroke-opacity="${index === 2 ? '.72' : '.14'}" stroke-width="${index === 2 ? 7 : 2}" transform="rotate(-18 ${width / 2} ${height / 2})"/>`).join('');
    case 'circuit':
    case 'steps':
      return Array.from({ length: 5 }, (_, index) => `<path d="M${24 + index * 30} ${height - 34 - index * 38}H${width - 30 - index * 18}" stroke="${index === 3 ? accent : foreground}" stroke-opacity="${index === 3 ? '.72' : '.13'}" stroke-width="${index === 3 ? 7 : 2}"/>`).join('');
    case 'blocks':
      return `<rect x="0" y="${height * 0.39}" width="${width}" height="${height * 0.22}" fill="${foreground}" opacity=".12"/><rect x="0" y="${height * 0.39}" width="${width * 0.36}" height="${height * 0.22}" fill="${accent}"/><path d="M${width * 0.36} ${height * 0.39}v${height * 0.22}" stroke="${foreground}" stroke-opacity=".4"/>`;
    case 'grid':
    default:
      return `<path d="${Array.from({ length: 8 }, (_, index) => `M${index * width / 7} 0V${height}`).join('')}${Array.from({ length: 5 }, (_, index) => `M0 ${index * height / 4}H${width}`).join('')}" stroke="${foreground}" stroke-opacity=".1"/><rect x="${width * 0.58}" y="${height * 0.3}" width="${width * 0.2}" height="${height * 0.36}" fill="${accent}"/>`;
  }
}

function selectedApplications(identity: BrandIdentity): BrandApplication[] {
  const preferred = ['editorial', 'product', 'marketing', 'developer', 'event', 'physical', 'social'] as const;
  const selected: BrandApplication[] = [];
  for (const category of preferred) {
    const match = identity.applications.find(
      (application) => application.category === category && !selected.includes(application)
    );
    if (match) selected.push(match);
    if (selected.length === 3) break;
  }
  for (const application of identity.applications) {
    if (selected.length >= 3) break;
    if (!selected.includes(application)) selected.push(application);
  }
  return selected;
}

function buildShowcaseMoodboardSvg(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F4');
  const primary = color(identity, 'emphasis', '#E4E4E4');
  const deep = color(identity, 'error', '#262626');
  const applications = selectedApplications(identity);
  const fontDefinitions = `${embeddedFont('Moodboard Sans', assets.interFont)}${embeddedFont('Moodboard Mono', assets.monoFont)}`;
  const heroLines = wrapText(identity.tagline, 19, 4);
  const storyLines = wrapText(identity.strategy.concept, 26, 4);
  const firstApplication = applications[0] ?? identity.applications[0];
  const secondApplication = applications[1] ?? identity.applications[1] ?? firstApplication;
  const thirdApplication = applications[2] ?? identity.applications[2] ?? firstApplication;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" data-board-mode="showcase" data-brand="${escapeXml(identity.name)}">
<defs><style>${fontDefinitions}.sans{font-family:'Moodboard Sans';}.mono{font-family:'Moodboard Mono';}</style></defs>
<rect width="1600" height="900" fill="${muted}"/>

<g class="application-panel hero-application" transform="translate(24 24)">
  <rect width="928" height="500" fill="${ink}"/>
  ${logo(assets.markLight, identity.shortName, 42, 38, 132, 58, paper)}
  <text x="886" y="58" text-anchor="end" class="mono" fill="${paper}" opacity=".42" font-size="9">${escapeXml(identity.website.toLocaleUpperCase())}</text>
  ${textLines(heroLines, 42, 190, 74, `class="sans" fill="${paper}" font-size="68" font-weight="800" letter-spacing="-4"`)}
  <text x="42" y="452" class="mono" fill="${paper}" opacity=".48" font-size="9" letter-spacing="1.2">${escapeXml(identity.positioning.toLocaleUpperCase().slice(0, 105))}</text>
  <rect y="474" width="928" height="26" fill="${primary}"/>
  <rect y="474" width="318" height="26" fill="${paper}"/>
</g>

<g class="application-panel editorial-application" transform="translate(976 24)">
  <rect width="600" height="500" fill="${paper}"/>
  <text x="32" y="42" class="mono" fill="${ink}" opacity=".42" font-size="9">CASE STUDY / ${escapeXml(firstApplication?.name.toLocaleUpperCase() ?? 'SELECTED WORK')}</text>
  <path d="M32 62H568" stroke="${ink}" stroke-opacity=".16"/>
  ${textLines(storyLines, 32, 148, 52, `class="sans" fill="${ink}" font-size="44" font-weight="760" letter-spacing="-2.3"`)}
  <text x="32" y="392" class="sans" fill="${ink}" opacity=".58" font-size="13">${escapeXml(firstApplication?.description.slice(0, 96) ?? identity.description.slice(0, 96))}</text>
  <rect x="32" y="432" width="536" height="36" fill="${deep}"/>
  <text x="48" y="455" class="mono" fill="${paper}" font-size="8" letter-spacing="1.2">PROBLEM → IDEA → SYSTEM → IMPACT</text>
</g>

<g class="application-panel type-application" transform="translate(24 548)">
  <rect width="480" height="328" fill="${primary}"/>
  <text x="24" y="32" class="mono" fill="${isLight(primary) ? ink : paper}" opacity=".55" font-size="8">TYPE / ${escapeXml(identity.typography[0]?.family.toLocaleUpperCase() ?? 'DISPLAY')}</text>
  <text x="22" y="238" class="sans" fill="${isLight(primary) ? ink : paper}" font-size="222" font-weight="800" letter-spacing="-18">Aa</text>
  <text x="454" y="298" text-anchor="end" class="mono" fill="${isLight(primary) ? ink : paper}" opacity=".5" font-size="8">${escapeXml(identity.typography[0]?.usage.toLocaleUpperCase().slice(0, 54) ?? 'DISPLAY')}</text>
</g>

<g class="application-panel product-application" transform="translate(528 548)">
  <rect width="640" height="328" fill="${paper}"/>
  <rect width="640" height="44" fill="${ink}"/>
  ${logo(assets.markLight, identity.shortName, 20, 11, 70, 22, paper)}
  <text x="616" y="27" text-anchor="end" class="mono" fill="${paper}" opacity=".5" font-size="7">${escapeXml(secondApplication?.format.toLocaleUpperCase() ?? 'RESPONSIVE')}</text>
  <g transform="translate(24 74)">
    <text class="mono" fill="${primary}" font-size="8">${escapeXml(secondApplication?.category.toLocaleUpperCase() ?? 'PRODUCT')} / 01</text>
    ${textLines(wrapText(secondApplication?.name ?? identity.products[0] ?? identity.name, 24, 2), 0, 54, 35, `class="sans" fill="${ink}" font-size="30" font-weight="760" letter-spacing="-1.4"`)}
    <text x="0" y="140" class="sans" fill="${ink}" opacity=".55" font-size="11">${escapeXml(secondApplication?.description.slice(0, 82) ?? identity.description.slice(0, 82))}</text>
    <path d="M0 180H592" stroke="${ink}" stroke-opacity=".14"/>
    ${identity.products.slice(0, 3).map((product, index) => `<text x="${index * 198}" y="214" class="mono" fill="${ink}" opacity="${index === 0 ? '.9' : '.42'}" font-size="8">0${index + 1} / ${escapeXml(product.toLocaleUpperCase())}</text>`).join('')}
  </g>
</g>

<g class="application-panel system-application" transform="translate(1192 548)">
  <rect width="384" height="328" fill="${deep}"/>
  <g opacity=".72">${graphicMotif(identity.graphicSystem, 384, 328, paper, primary)}</g>
  <rect x="20" y="20" width="344" height="288" fill="none" stroke="${paper}" stroke-opacity=".2"/>
  <text x="36" y="48" class="mono" fill="${paper}" opacity=".48" font-size="8">${escapeXml(identity.graphicSystem.device.toLocaleUpperCase())}</text>
  <text x="36" y="282" class="sans" fill="${paper}" font-size="17" font-weight="700">${escapeXml(thirdApplication?.name ?? identity.name)}</text>
</g>
</svg>`;
}

function buildSystemMoodboardSvg(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F4');
  const primary = color(identity, 'emphasis', '#E4E4E4');
  const secondary = color(identity, 'success', '#D4D4D4');
  const accent = color(identity, 'warning', '#A3A3A3');
  const deep = color(identity, 'error', '#262626');
  const applications = selectedApplications(identity);
  const logos = assets.logoMarks ?? [];
  const fontDefinitions = `${embeddedFont('Moodboard Sans', assets.interFont)}${embeddedFont('Moodboard Mono', assets.monoFont)}`;
  const palette = identity.colors.slice(0, 8);
  const heroTitle = wrapText(identity.tagline, 25, 3);
  const conceptLines = wrapText(identity.strategy.concept, 38, 4);
  const deviceLines = wrapText(identity.graphicSystem.description, 54, 4);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000" data-board-mode="system">
<defs><style>${fontDefinitions}.sans{font-family:'Moodboard Sans';}.mono{font-family:'Moodboard Mono';}</style></defs>
<rect width="1600" height="2000" fill="${muted}"/>

<g class="application-panel identity-panel" transform="translate(24 24)">
  <rect width="1552" height="430" fill="${ink}"/>
  ${label(1, `${identity.shortName} identity`, paper, 38, 42)}
  ${logo(assets.markLight, identity.shortName, 38, 64, 168, 74, paper)}
  ${textLines(heroTitle, 38, 238, 67, `class="sans" fill="${paper}" font-size="61" font-weight="800" letter-spacing="-3.4"`)}
  <text x="1514" y="404" text-anchor="end" class="mono" fill="${paper}" opacity=".45" font-size="9">${escapeXml(identity.website.toLocaleUpperCase())}</text>
  <rect x="1002" y="0" width="550" height="430" fill="${paper}" opacity=".04"/>
  <text x="1038" y="90" class="mono" fill="${primary}" font-size="9">PROMISE</text>
  ${textLines(wrapText(identity.strategy.promise, 25, 4), 1038, 140, 42, `class="sans" fill="${paper}" font-size="34" font-weight="720" letter-spacing="-1.5"`)}
  <path d="M1038 346H1504" stroke="${paper}" stroke-opacity=".18"/>
  <text x="1038" y="378" class="mono" fill="${paper}" opacity=".42" font-size="8">MISSION / ${escapeXml(identity.mission.toLocaleUpperCase().slice(0, 72))}</text>
</g>

<g class="application-panel strategy-panel" transform="translate(24 478)">
  <rect width="760" height="320" fill="${paper}"/>
  ${label(2, 'Strategy', ink)}
  <text x="30" y="78" class="mono" fill="${primary}" font-size="8">CENTRAL IDEA</text>
  ${textLines(conceptLines, 30, 118, 31, `class="sans" fill="${ink}" font-size="26" font-weight="740" letter-spacing="-1.1"`)}
  <path d="M30 218H730" stroke="${ink}" stroke-opacity=".14"/>
  ${identity.strategy.pillars.slice(0, 4).map((pillar, index) => `<text x="${30 + (index % 2) * 350}" y="${252 + Math.floor(index / 2) * 34}" class="mono" fill="${ink}" opacity=".62" font-size="8">0${index + 1} / ${escapeXml(pillar.toLocaleUpperCase().slice(0, 38))}</text>`).join('')}
</g>

<g class="application-panel color-panel" transform="translate(808 478)">
  <rect width="768" height="320" fill="${paper}"/>
  ${label(3, 'Color roles', ink)}
  ${palette.map(({ hex, name }, index) => {
    const x = 30 + (index % 4) * 178;
    const y = 66 + Math.floor(index / 4) * 112;
    const fill = isLight(hex) ? ink : paper;
    return `<g transform="translate(${x} ${y})"><rect width="160" height="92" fill="${escapeXml(hex)}"/><text x="10" y="66" class="sans" fill="${fill}" font-size="10" font-weight="650">${escapeXml(name)}</text><text x="10" y="81" class="mono" fill="${fill}" opacity=".62" font-size="7">${escapeXml(hex.toLocaleUpperCase())}</text></g>`;
  }).join('')}
  <text x="30" y="298" class="mono" fill="${ink}" opacity=".4" font-size="8">COLOR HAS A JOB. IT IS NOT FILLER.</text>
</g>

<g class="application-panel logo-panel" transform="translate(24 822)">
  <rect width="760" height="330" fill="${paper}"/>
  ${label(4, 'Logo architecture', ink)}
  <g transform="translate(30 62)"><rect width="336" height="156" fill="${muted}"/>${logo(logos[0] ?? assets.markDark, identity.shortName, 86, 42, 164, 72, ink)}<text x="14" y="140" class="mono" fill="${ink}" opacity=".4" font-size="7">PRIMARY / LIGHT</text></g>
  <g transform="translate(384 62)"><rect width="346" height="156" fill="${ink}"/>${logo(logos[1] ?? assets.markLight, identity.shortName, 88, 42, 170, 72, paper)}<text x="14" y="140" class="mono" fill="${paper}" opacity=".45" font-size="7">REVERSE / DARK</text></g>
  <g transform="translate(30 236)"><rect width="700" height="62" fill="none" stroke="${ink}" stroke-opacity=".14"/>${logo(logos[2] ?? logos[0] ?? assets.markDark, identity.name, 18, 13, 320, 36, ink)}<text x="680" y="38" text-anchor="end" class="mono" fill="${ink}" opacity=".4" font-size="7">CLEAR SPACE / SURFACE / SCALE</text></g>
</g>

<g class="application-panel typography-panel" transform="translate(808 822)">
  <rect width="768" height="330" fill="${deep}"/>
  ${label(5, 'Typography', paper)}
  <text x="30" y="194" class="sans" fill="${paper}" font-size="148" font-weight="800" letter-spacing="-10">Aa</text>
  <text x="242" y="105" class="sans" fill="${paper}" font-size="25" font-weight="720">${escapeXml(identity.typography.find(({ role }) => role === 'Display')?.family ?? 'Display')}</text>
  <text x="242" y="134" class="sans" fill="${paper}" opacity=".52" font-size="11">DISPLAY / ${escapeXml(identity.typography.find(({ role }) => role === 'Display')?.usage.slice(0, 58) ?? 'Headlines')}</text>
  <path d="M242 164H738" stroke="${paper}" stroke-opacity=".14"/>
  <text x="242" y="205" class="sans" fill="${paper}" font-size="17">${escapeXml(identity.greetings.slice(0, 3).join(' · '))}</text>
  <text x="242" y="242" class="mono" fill="${secondary}" font-size="10">${escapeXml(identity.typography.find(({ role }) => role === 'Code')?.family ?? 'MONO')} / CODE + METADATA</text>
  <text x="242" y="282" class="mono" fill="${paper}" opacity=".35" font-size="8">12 / 14 / 18 / 28 / 48 / 72 / 148</text>
</g>

<g class="application-panel graphic-system-panel" transform="translate(24 1176)">
  <rect width="1552" height="350" fill="${paper}"/>
  ${label(6, identity.graphicSystem.device, ink)}
  <g transform="translate(30 72)">
    <text class="mono" fill="${primary}" font-size="8">RECOGNIZABLE DEVICE</text>
    <text y="48" class="sans" fill="${ink}" font-size="36" font-weight="760" letter-spacing="-1.5">${escapeXml(identity.graphicSystem.device)}</text>
    ${textLines(deviceLines, 0, 88, 19, `class="sans" fill="${ink}" opacity=".58" font-size="12"`)}
    ${identity.graphicSystem.rules.slice(0, 3).map((rule, index) => `<text x="0" y="${190 + index * 25}" class="mono" fill="${ink}" opacity=".62" font-size="8">0${index + 1} / ${escapeXml(rule.toLocaleUpperCase().slice(0, 62))}</text>`).join('')}
  </g>
  <g transform="translate(910 0)" opacity=".86">${graphicMotif(identity.graphicSystem, 642, 350, ink, primary)}</g>
</g>

<g class="application-panel applications-panel" transform="translate(24 1550)">
  <rect width="1552" height="426" fill="${ink}"/>
  ${label(7, 'Applications', paper)}
  ${applications.map((application, index) => {
    const x = 30 + index * 502;
    const cardFill = index === 1 ? primary : paper;
    const cardText = isLight(cardFill) ? ink : paper;
    return `<g transform="translate(${x} 68)"><rect width="478" height="318" fill="${cardFill}"/><text x="20" y="30" class="mono" fill="${cardText}" opacity=".5" font-size="7">0${index + 1} / ${escapeXml(application.category.toLocaleUpperCase())}</text>${textLines(wrapText(application.name, 19, 3), 20, 126, 39, `class="sans" fill="${cardText}" font-size="33" font-weight="760" letter-spacing="-1.6"`)}<text x="20" y="260" class="sans" fill="${cardText}" opacity=".56" font-size="10">${escapeXml(application.description.slice(0, 78))}</text><text x="20" y="292" class="mono" fill="${cardText}" opacity=".42" font-size="7">${escapeXml(application.format.toLocaleUpperCase())}</text></g>`;
  }).join('')}
  <text x="1522" y="409" text-anchor="end" class="mono" fill="${accent}" font-size="8">${escapeXml(identity.voice.phrases[0]?.toLocaleUpperCase() ?? identity.tagline.toLocaleUpperCase())}</text>
</g>
</svg>`;
}

export function buildMoodboardSvg(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets,
  composition: MoodboardComposition
): string {
  return composition === 'showcase'
    ? buildShowcaseMoodboardSvg(identity, assets)
    : buildSystemMoodboardSvg(identity, assets);
}
