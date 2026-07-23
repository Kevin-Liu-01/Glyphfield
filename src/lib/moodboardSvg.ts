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
  return `@font-face{font-family:'${name}';src:url('${escapeXml(source)}') format('woff2');font-style:normal;font-weight:100 900;font-display:block;}`;
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
    return `<image href="${escapeXml(source)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>`;
  }
  return `<text x="${x + width / 2}" y="${y + height * 0.67}" text-anchor="middle" class="sans" fill="${fill}" font-size="${Math.min(width, height) * 0.5}" font-weight="800">${escapeXml(fallback)}</text>`;
}

function label(index: number, name: string, fill: string): string {
  return `<text x="28" y="34" class="mono" fill="${fill}" opacity=".56" font-size="10" letter-spacing="1.8">${String(index).padStart(2, '0')} / ${escapeXml(name.toLocaleUpperCase())}</text>`;
}

function isLight(hex: string): boolean {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return true;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 156;
}

function pattern(
  graphicSystem: BrandGraphicSystem,
  width: number,
  height: number,
  foreground: string,
  accent: string
): string {
  switch (graphicSystem.pattern) {
    case 'blocks':
      return Array.from({ length: 18 }, (_, index) => {
        const column = index % 6;
        const row = Math.floor(index / 6);
        const size = 18 + ((index * 13) % 34);
        return `<rect x="${28 + column * (width - 64) / 5}" y="${58 + row * (height - 110) / 2}" width="${size}" height="${size}" fill="${index % 3 === 0 ? accent : foreground}" opacity="${index % 3 === 0 ? '.72' : '.15'}"/>`;
      }).join('');
    case 'brackets':
      return `<path d="M46 66H22V${height - 30}h24M${width - 46} 66h24v${height - 96}h-24" fill="none" stroke="${accent}" stroke-width="7"/><path d="M70 ${height / 2}H${width - 70}" stroke="${foreground}" stroke-opacity=".16"/><circle cx="${width / 2}" cy="${height / 2}" r="5" fill="${accent}"/>`;
    case 'burst':
      return Array.from({ length: 22 }, (_, index) => {
        const angle = (index / 22) * Math.PI * 2;
        const x = width / 2 + Math.cos(angle) * width * 0.54;
        const y = height / 2 + Math.sin(angle) * height * 0.64;
        return `<path d="M${width / 2} ${height / 2}L${x.toFixed(1)} ${y.toFixed(1)}" stroke="${index % 4 === 0 ? accent : foreground}" stroke-opacity="${index % 4 === 0 ? '.62' : '.12'}" stroke-width="${index % 4 === 0 ? 3 : 1}"/>`;
      }).join('');
    case 'circuit':
      return Array.from({ length: 7 }, (_, index) => {
        const y = 72 + index * 38;
        const offset = index % 2 === 0 ? 84 : 132;
        return `<path d="M0 ${y}H${offset}l28 28h${width - offset - 28}" fill="none" stroke="${index === 3 ? accent : foreground}" stroke-opacity="${index === 3 ? '.78' : '.15'}" stroke-width="${index === 3 ? 4 : 2}"/><circle cx="${offset}" cy="${y}" r="4" fill="${accent}"/>`;
      }).join('');
    case 'flow':
      return Array.from({ length: 8 }, (_, index) => `<path d="M-40 ${height - 20 - index * 24}C${width * 0.25} ${height * 0.2 + index * 9},${width * 0.7} ${height * 0.86 - index * 13},${width + 40} ${36 + index * 18}" fill="none" stroke="${index % 3 === 0 ? accent : foreground}" stroke-opacity="${index % 3 === 0 ? '.7' : '.13'}" stroke-width="${index % 3 === 0 ? 6 : 2}"/>`).join('');
    case 'orbit':
      return Array.from({ length: 5 }, (_, index) => `<ellipse cx="${width / 2}" cy="${height / 2}" rx="${70 + index * 56}" ry="${32 + index * 28}" fill="none" stroke="${index === 2 ? accent : foreground}" stroke-opacity="${index === 2 ? '.72' : '.14'}" stroke-width="${index === 2 ? 4 : 2}" transform="rotate(-18 ${width / 2} ${height / 2})"/>`).join('');
    case 'rays':
      return Array.from({ length: 16 }, (_, index) => {
        const x = (index / 15) * width;
        return `<path d="M${width * 0.12} ${height * 0.88}L${x} 0" stroke="${index % 5 === 0 ? accent : foreground}" stroke-opacity="${index % 5 === 0 ? '.66' : '.11'}" stroke-width="${index % 5 === 0 ? 7 : 2}"/>`;
      }).join('');
    case 'steps':
      return Array.from({ length: 6 }, (_, index) => `<path d="M${24 + index * 34} ${height - 26 - index * 34}H${width - 26 - index * 12}" stroke="${index === 4 ? accent : foreground}" stroke-opacity="${index === 4 ? '.76' : '.15'}" stroke-width="${index === 4 ? 6 : 2}"/>`).join('');
    case 'wave':
      return Array.from({ length: 7 }, (_, index) => `<path d="M-30 ${70 + index * 32}C${width * 0.25} ${10 + index * 36},${width * 0.42} ${height + 10 - index * 28},${width + 30} ${52 + index * 28}" fill="none" stroke="${index === 2 || index === 5 ? accent : foreground}" stroke-opacity="${index === 2 || index === 5 ? '.74' : '.12'}" stroke-width="${index === 2 || index === 5 ? 7 : 2}"/>`).join('');
    case 'grid':
    default:
      return `<path d="${Array.from({ length: 12 }, (_, index) => `M${index * width / 11} 0V${height}`).join('')}${Array.from({ length: 8 }, (_, index) => `M0 ${index * height / 7}H${width}`).join('')}" stroke="${foreground}" stroke-opacity=".11"/><rect x="${width * 0.54}" y="${height * 0.26}" width="${width * 0.24}" height="${height * 0.42}" fill="${accent}" opacity=".72"/>`;
  }
}

function selectedApplications(identity: BrandIdentity): BrandApplication[] {
  const preferred = ['product', 'marketing', 'developer', 'event', 'physical', 'editorial', 'social'] as const;
  const selected: BrandApplication[] = [];
  for (const category of preferred) {
    const match = identity.applications.find(
      (application) => application.category === category && !selected.includes(application)
    );
    if (match) selected.push(match);
    if (selected.length === 4) break;
  }
  for (const application of identity.applications) {
    if (!selected.includes(application)) selected.push(application);
    if (selected.length === 4) break;
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
  const secondary = color(identity, 'success', '#D4D4D4');
  const accent = color(identity, 'warning', '#A3A3A3');
  const mid = color(identity, 'progress', '#525252');
  const deep = color(identity, 'error', '#262626');
  const applications = selectedApplications(identity);
  const campaignApplication =
    identity.applications.find(({ category }) => category === 'marketing') ?? applications[1];
  const productApplication =
    identity.applications.find(({ category }) => category === 'product') ?? applications[0];
  const editorialApplications = identity.applications
    .filter(({ category }) => category === 'editorial' || category === 'developer')
    .slice(0, 3);
  const editorialCards = [
    ...editorialApplications,
    ...identity.applications.filter((application) => !editorialApplications.includes(application)),
  ].slice(0, 3);
  const outdoorApplication =
    identity.applications.find(
      ({ category }) => category === 'event' || category === 'physical'
    ) ?? applications[3];
  const fontDefinitions = `${embeddedFont('Moodboard Sans', assets.interFont)}${embeddedFont('Moodboard Mono', assets.monoFont)}`;
  const heroLines = wrapText(identity.tagline, 28, 3);
  const campaignLines = wrapText(
    campaignApplication?.name ?? identity.strategy.promise,
    14,
    4
  );
  const websiteLines = wrapText(productApplication?.name ?? identity.tagline, 29, 2);
  const outdoorLines = wrapText(outdoorApplication?.name ?? identity.strategy.promise, 15, 3);
  const pillars = identity.strategy.pillars.slice(0, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" data-board-mode="showcase">
<defs>
  <style>${fontDefinitions}.sans{font-family:'Moodboard Sans';}.mono{font-family:'Moodboard Mono';}</style>
  <linearGradient id="showcase-gradient" x1="0" y1="1" x2="1" y2="0"><stop stop-color="${deep}"/><stop offset=".28" stop-color="${primary}"/><stop offset=".58" stop-color="${accent}"/><stop offset=".82" stop-color="${secondary}"/><stop offset="1" stop-color="${paper}"/></linearGradient>
  <linearGradient id="showcase-environment" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${muted}"/><stop offset=".38" stop-color="${secondary}"/><stop offset=".7" stop-color="${mid}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
  <radialGradient id="showcase-glow" cx="72%" cy="22%" r="82%"><stop stop-color="${paper}" stop-opacity=".72"/><stop offset=".38" stop-color="${primary}" stop-opacity=".58"/><stop offset="1" stop-color="${deep}" stop-opacity="0"/></radialGradient>
  <filter id="showcase-grain" x="-12%" y="-12%" width="124%" height="124%"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" seed="7" result="noise"/><feColorMatrix in="noise" type="saturate" values="0" result="mono-noise"/><feComponentTransfer in="mono-noise" result="soft-noise"><feFuncA type="linear" slope=".22"/></feComponentTransfer><feBlend in="SourceGraphic" in2="soft-noise" mode="soft-light"/></filter>
  <filter id="mock-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="${ink}" flood-opacity=".24"/></filter>
  <clipPath id="shirt-clip"><path d="M104 58 146 34h66l42 24 72 34-32 72-37-17v219H101V147l-37 17-32-72Z"/></clipPath>
  <clipPath id="editorial-card-clip"><rect width="140" height="220" rx="2"/></clipPath>
</defs>
<rect width="1600" height="900" fill="#C8C8C8"/>

<g class="application-panel" transform="translate(0 0)">
  <rect width="358" height="182" fill="${paper}"/>
  <rect width="179" height="182" fill="${ink}"/>
  ${logo(assets.markLight, identity.shortName, 40, 47, 99, 88, paper)}
  ${logo(assets.markDark, identity.shortName, 219, 47, 99, 88, ink)}
</g>

<g class="application-panel" transform="translate(364 0)">
  <rect width="670" height="340" fill="url(#showcase-gradient)" filter="url(#showcase-grain)"/>
  <rect width="670" height="340" fill="url(#showcase-glow)" opacity=".48"/>
  <g opacity=".16">${pattern(identity.graphicSystem, 670, 340, paper, primary)}</g>
  ${logo(assets.markLight, identity.shortName, 270, 74, 130, 74, paper)}
  <text x="335" y="188" text-anchor="middle" class="sans" fill="${paper}" font-size="20" font-weight="680">${escapeXml(identity.name)}</text>
  ${textLines(heroLines, 335, 230, 28, `text-anchor="middle" class="sans" fill="${paper}" font-size="23" font-weight="720" letter-spacing="-.7"`)}
</g>

<g class="application-panel" transform="translate(1040 0)">
  <rect width="560" height="246" fill="${ink}"/>
  <g class="social-profile-mockup" transform="translate(72 24)" filter="url(#mock-shadow)">
    <rect width="416" height="198" rx="7" fill="${paper}"/>
    <rect width="416" height="74" rx="7" fill="url(#showcase-gradient)" filter="url(#showcase-grain)"/>
    <rect y="67" width="416" height="7" fill="url(#showcase-gradient)"/>
    <circle cx="53" cy="78" r="34" fill="${ink}" stroke="${paper}" stroke-width="4"/>
    ${logo(assets.markLight, identity.shortName, 28, 54, 50, 48, paper)}
    <text x="28" y="130" class="sans" fill="${ink}" font-size="15" font-weight="760">${escapeXml(identity.name)}</text>
    <text x="28" y="148" class="mono" fill="${ink}" opacity=".46" font-size="8">${escapeXml(identity.socialHandle || `@${identity.id}`)}</text>
    <text x="28" y="170" class="sans" fill="${ink}" opacity=".7" font-size="10">${escapeXml(identity.positioning.slice(0, 76))}</text>
    <rect x="320" y="102" width="66" height="24" rx="12" fill="${ink}"/><text x="353" y="118" text-anchor="middle" class="sans" fill="${paper}" font-size="8" font-weight="700">FOLLOW</text>
  </g>
</g>

<g class="application-panel" transform="translate(0 188)">
  <g class="campaign-mockup">
    <rect width="220" height="300" fill="url(#showcase-gradient)" filter="url(#showcase-grain)"/>
    <g opacity=".18">${pattern(identity.graphicSystem, 220, 300, paper, primary)}</g>
    ${logo(assets.markLight, identity.shortName, 48, 192, 124, 58, paper)}
    <text x="110" y="274" text-anchor="middle" class="mono" fill="${paper}" opacity=".72" font-size="8">${escapeXml(identity.website)}</text>
    <rect x="220" width="138" height="300" fill="${paper}"/>
    ${logo(assets.markDark, identity.shortName, 245, 30, 50, 35, ink)}
    ${textLines(campaignLines, 244, 126, 31, `class="sans" fill="${ink}" font-size="25" font-weight="760" letter-spacing="-1"`)}
    <text x="244" y="266" class="mono" fill="${ink}" opacity=".45" font-size="7">${escapeXml(campaignApplication?.format ?? 'CAMPAIGN')}</text>
  </g>
</g>

<g class="application-panel" transform="translate(364 346)">
  <rect width="670" height="282" fill="${deep}"/>
  <g opacity=".72">${pattern(identity.graphicSystem, 670, 282, paper, primary)}</g>
  <path d="M72 62 314 142M584 54 360 142M86 230 314 154M586 226 360 154" stroke="${paper}" stroke-opacity=".14"/>
  ${pillars.map((pillar, index) => {
    const positions = [
      [38, 42],
      [486, 34],
      [52, 214],
      [472, 210],
    ];
    const [x, y] = positions[index] ?? positions[0];
    return `<g transform="translate(${x} ${y})"><rect width="10" height="10" fill="${index === 0 ? primary : paper}"/>${textLines(wrapText(pillar, 24, 2), 18, 9, 12, `class="sans" fill="${paper}" font-size="9" font-weight="620"`)}</g>`;
  }).join('')}
  <text x="335" y="154" text-anchor="middle" class="sans" fill="${paper}" font-size="16" font-weight="720">${escapeXml(identity.graphicSystem.device)}</text>
</g>

<g class="application-panel" transform="translate(1040 252)">
  <rect width="560" height="250" fill="${muted}"/>
  <g class="laptop-mockup" transform="translate(28 18)" filter="url(#mock-shadow)">
    <rect x="14" width="476" height="198" rx="12" fill="${ink}"/>
    <rect x="30" y="16" width="444" height="168" fill="url(#showcase-gradient)" filter="url(#showcase-grain)"/>
    <rect x="42" y="28" width="420" height="24" fill="${paper}"/>
    ${logo(assets.markDark, identity.shortName, 52, 32, 46, 15, ink)}
    <text x="444" y="43" text-anchor="end" class="mono" fill="${ink}" opacity=".52" font-size="6">PRODUCT · SYSTEM · PRICING</text>
    ${textLines(websiteLines, 62, 105, 27, `class="sans" fill="${paper}" font-size="23" font-weight="760" letter-spacing="-.8"`)}
    <text x="62" y="154" class="mono" fill="${paper}" opacity=".66" font-size="7">${escapeXml(productApplication?.description.slice(0, 74) ?? identity.positioning.slice(0, 74))}</text>
    <path d="M0 198h504l-27 18H27Z" fill="${mid}"/><path d="M200 198h104l-14 7h-76Z" fill="${paper}" opacity=".24"/>
  </g>
</g>

<g class="application-panel" transform="translate(0 494)">
  <rect width="358" height="406" fill="url(#showcase-environment)" filter="url(#showcase-grain)"/>
  <circle cx="58" cy="62" r="76" fill="${deep}" opacity=".25"/><circle cx="308" cy="82" r="92" fill="${primary}" opacity=".18"/>
  <ellipse cx="180" cy="371" rx="122" ry="20" fill="${ink}" opacity=".28"/>
  <g class="apparel-mockup" filter="url(#mock-shadow)">
    <path d="M104 58 146 34h66l42 24 72 34-32 72-37-17v219H101V147l-37 17-32-72Z" fill="${paper}"/>
    <g clip-path="url(#shirt-clip)" opacity=".13">${pattern(identity.graphicSystem, 358, 406, ink, primary)}</g>
    <path d="M146 34c7 22 55 22 66 0" fill="none" stroke="${ink}" stroke-opacity=".12" stroke-width="5"/>
    ${logo(assets.markDark, identity.shortName, 126, 84, 108, 50, ink)}
    <text x="179" y="336" text-anchor="middle" class="sans" fill="${ink}" font-size="13" font-weight="650">${escapeXml(identity.strategy.promise.slice(0, 38))}</text>
  </g>
</g>

<g class="application-panel" transform="translate(364 634)">
  <rect width="180" height="266" fill="${ink}"/>
  <g class="phone-mockup" transform="translate(20 18)" filter="url(#mock-shadow)">
    <rect width="140" height="230" rx="28" fill="#090909" stroke="${paper}" stroke-opacity=".2"/>
    <rect x="9" y="9" width="122" height="212" rx="22" fill="${deep}"/>
    <rect x="49" y="13" width="42" height="9" rx="5" fill="#050505"/>
    <text x="20" y="39" class="mono" fill="${paper}" font-size="8">11:47</text>
    <rect x="38" y="72" width="64" height="64" rx="15" fill="url(#showcase-gradient)" filter="url(#showcase-grain)"/>
    ${logo(assets.markLight, identity.shortName, 50, 84, 40, 40, paper)}
    <text x="70" y="158" text-anchor="middle" class="sans" fill="${paper}" font-size="12" font-weight="680">${escapeXml(identity.name)}</text>
  </g>
</g>

<g class="application-panel" transform="translate(550 634)">
  <rect width="484" height="266" fill="url(#showcase-gradient)" filter="url(#showcase-grain)"/>
  <g class="editorial-mockup">
    ${editorialCards.map((application, index) => `<g transform="translate(${18 + index * 154} 23)" filter="url(#mock-shadow)"><rect width="140" height="220" fill="${paper}"/><g clip-path="url(#editorial-card-clip)" opacity=".15">${pattern(identity.graphicSystem, 140, 220, ink, primary)}</g><rect x="14" y="14" width="8" height="8" fill="${index === 1 ? primary : ink}"/><text x="14" y="36" class="mono" fill="${ink}" opacity=".45" font-size="6">0${index + 1} / ${escapeXml(application.category.toLocaleUpperCase())}</text>${textLines(wrapText(application.name, 15, 3), 14, 126, 23, `class="sans" fill="${ink}" font-size="18" font-weight="760" letter-spacing="-.6"`)}<text x="14" y="202" class="mono" fill="${ink}" opacity=".45" font-size="6">${escapeXml(application.format.toLocaleUpperCase())}</text></g>`).join('')}
  </g>
</g>

<g class="application-panel" transform="translate(1040 508)">
  <rect width="560" height="392" fill="url(#showcase-environment)" filter="url(#showcase-grain)"/>
  <rect y="282" width="560" height="110" fill="${deep}" opacity=".62"/>
  <rect x="28" y="96" width="116" height="190" fill="${ink}" opacity=".34"/><rect x="154" y="54" width="78" height="232" fill="${mid}" opacity=".32"/>
  <circle cx="58" cy="58" r="54" fill="${secondary}" opacity=".3"/><circle cx="510" cy="62" r="82" fill="${primary}" opacity=".22"/>
  <g class="outdoor-mockup" transform="translate(318 58) rotate(-3 102 137)" filter="url(#mock-shadow)">
    <rect x="92" y="266" width="20" height="84" fill="${ink}"/><rect width="204" height="276" rx="4" fill="${paper}" stroke="${ink}" stroke-opacity=".16" stroke-width="5"/>
    ${logo(assets.markDark, identity.shortName, 20, 20, 58, 38, ink)}
    ${textLines(outdoorLines, 20, 128, 32, `class="sans" fill="${ink}" font-size="26" font-weight="760" letter-spacing="-1"`)}
    <text x="20" y="238" class="mono" fill="${ink}" opacity=".55" font-size="7">${escapeXml(identity.website.toLocaleUpperCase())}</text>
  </g>
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
  const mid = color(identity, 'progress', '#525252');
  const deep = color(identity, 'error', '#262626');
  const logos = assets.logoMarks ?? [];
  const applications = selectedApplications(identity);
  const displayFont = identity.typography.find(({ role }) => role === 'Display')?.family ?? 'Inter';
  const bodyFont = identity.typography.find(({ role }) => role === 'Body')?.family ?? 'Inter';
  const codeFont = identity.typography.find(({ role }) => role === 'Code')?.family ?? 'Geist Mono';
  const fontDefinitions = `${embeddedFont('Moodboard Sans', assets.interFont)}${embeddedFont('Moodboard Mono', assets.monoFont)}`;
  const palette = identity.colors.slice(0, 8);
  const proof = identity.proof.slice(0, 4);
  const panelWidth = 762;
  const panelHeight = 372;
  const panelRows = [28, 420, 812, 1204, 1596];
  const heroTitle = wrapText(identity.tagline, 23, 3);
  const strategyConcept = wrapText(identity.strategy.concept, 31, 4);
  const graphicDescription = wrapText(identity.graphicSystem.description, 46, 4);
  const productApplication = applications[0] ?? identity.applications[0];
  const campaignApplication = applications[1] ?? identity.applications[1] ?? productApplication;
  const technicalApplication = applications[2] ?? identity.applications[2] ?? productApplication;
  const physicalApplication = applications[3] ?? identity.applications[3] ?? productApplication;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000" data-board-mode="system">
<defs>
  <style>${fontDefinitions}.sans{font-family:'Moodboard Sans';}.mono{font-family:'Moodboard Mono';}</style>
  <pattern id="board-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${ink}" opacity=".11"/></pattern>
  <linearGradient id="brand-gradient" x1="0" y1="1" x2="1" y2="0"><stop stop-color="${deep}"/><stop offset=".46" stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient>
  <linearGradient id="fade-light" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${paper}"/><stop offset="1" stop-color="${muted}"/></linearGradient>
</defs>
<rect width="1600" height="2000" fill="#C9C9C9"/>

<g class="application-panel" transform="translate(28 ${panelRows[0]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="${ink}"/>
  <g opacity=".68">${pattern(identity.graphicSystem, panelWidth, panelHeight, paper, primary)}</g>
  ${assets.motionPreview ? `<image href="${escapeXml(assets.motionPreview)}" width="${panelWidth}" height="${panelHeight}" opacity=".08" preserveAspectRatio="xMidYMid slice"/>` : ''}
  ${label(1, `${identity.shortName} identity`, paper)}
  ${logo(assets.markLight, identity.shortName, 34, 62, 138, 82, paper)}
  <text x="190" y="112" class="sans" fill="${paper}" opacity=".7" font-size="14" font-weight="650">${escapeXml(identity.name)}</text>
  ${textLines(heroTitle, 34, 222, 42, `class="sans" fill="${paper}" font-size="36" font-weight="760" letter-spacing="-1.5"`)}
  <text x="728" y="340" text-anchor="end" class="mono" fill="${paper}" opacity=".52" font-size="10">${escapeXml(identity.website || identity.name)}</text>
</g>

<g class="application-panel" transform="translate(810 ${panelRows[0]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="${paper}"/>
  ${label(2, 'Strategy', ink)}
  <text x="28" y="82" class="mono" fill="${primary}" font-size="10" letter-spacing="1.5">CENTRAL IDEA</text>
  ${textLines(strategyConcept, 28, 124, 33, `class="sans" fill="${ink}" font-size="28" font-weight="740" letter-spacing="-1"`)}
  <path d="M28 244H734" stroke="${ink}" stroke-opacity=".14"/>
  ${identity.strategy.pillars.slice(0, 4).map((pillar, index) => `<g transform="translate(${28 + (index % 2) * 352} ${266 + Math.floor(index / 2) * 42})"><text class="mono" fill="${primary}" font-size="9">0${index + 1}</text><text x="30" class="sans" fill="${ink}" font-size="13" font-weight="620">${escapeXml(pillar)}</text></g>`).join('')}
  <text x="734" y="340" text-anchor="end" class="mono" fill="${ink}" opacity=".46" font-size="9">PROMISE / ${escapeXml(identity.strategy.promise.toLocaleUpperCase().slice(0, 72))}</text>
</g>

<g class="application-panel" transform="translate(28 ${panelRows[1]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="${paper}"/>
  ${label(3, 'Logo architecture', ink)}
  <g transform="translate(28 64)"><rect width="330" height="126" fill="${muted}"/>${logo(logos[0] ?? assets.markDark, identity.shortName, 80, 24, 170, 70, ink)}<text x="14" y="114" class="mono" fill="${ink}" opacity=".46" font-size="8">PRIMARY / LIGHT SURFACE</text></g>
  <g transform="translate(376 64)"><rect width="358" height="126" fill="${ink}"/>${logo(logos[1] ?? assets.markLight, identity.shortName, 94, 24, 170, 70, paper)}<text x="14" y="114" class="mono" fill="${paper}" opacity=".52" font-size="8">REVERSE / DARK SURFACE</text></g>
  <g transform="translate(28 208)"><rect width="706" height="96" fill="none" stroke="${ink}" stroke-opacity=".15"/>${logo(logos[2] ?? logos[0] ?? assets.markDark, identity.name, 42, 22, 622, 52, ink)}</g>
  <text x="28" y="340" class="mono" fill="${ink}" opacity=".46" font-size="9">${escapeXml(identity.graphicSystem.rules[0] ?? 'USE CONSISTENT CLEAR SPACE AND SURFACE CONTRAST')}</text>
</g>

<g class="application-panel" transform="translate(810 ${panelRows[1]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="${paper}"/>
  ${label(4, 'Color roles', ink)}
  ${palette.map(({ hex, name, role }, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 28 + column * 178;
    const y = 66 + row * 132;
    const labelFill = isLight(hex) ? ink : paper;
    return `<g transform="translate(${x} ${y})"><rect width="160" height="116" fill="${escapeXml(hex)}" stroke="${ink}" stroke-opacity=".12"/><text x="12" y="73" class="sans" fill="${labelFill}" font-size="11" font-weight="670">${escapeXml(name)}</text><text x="12" y="92" class="mono" fill="${labelFill}" opacity=".7" font-size="8">${escapeXml(hex.toLocaleUpperCase())}</text><text x="12" y="106" class="mono" fill="${labelFill}" opacity=".45" font-size="7">${escapeXml(role.toLocaleUpperCase().slice(0, 22))}</text></g>`;
  }).join('')}
  <text x="28" y="346" class="mono" fill="${ink}" opacity=".45" font-size="9">COLOR IS ASSIGNED BY ROLE, NOT BY DECORATION</text>
</g>

<g class="application-panel" transform="translate(28 ${panelRows[2]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="${ink}"/>
  ${label(5, 'Typography', paper)}
  <text x="28" y="132" class="sans" fill="${paper}" font-size="78" font-weight="780" letter-spacing="-5">Aa</text>
  <text x="174" y="105" class="sans" fill="${paper}" font-size="23" font-weight="680">${escapeXml(displayFont)}</text>
  <text x="174" y="132" class="sans" fill="${paper}" opacity=".55" font-size="12">Display / ${escapeXml(identity.typography.find(({ role }) => role === 'Display')?.usage ?? 'Headlines')}</text>
  <path d="M28 164H734" stroke="${paper}" stroke-opacity=".16"/>
  <text x="28" y="212" class="sans" fill="${paper}" font-size="28" font-weight="670">${escapeXml(identity.greetings.slice(0, 3).join(' · '))}</text>
  <text x="28" y="253" class="sans" fill="${paper}" opacity=".66" font-size="15">${escapeXml(bodyFont)} / Body / product and narrative</text>
  <text x="28" y="292" class="mono" fill="${secondary}" font-size="14">${escapeXml(codeFont)} / CODE + DATA + METADATA</text>
  <text x="28" y="338" class="mono" fill="${paper}" opacity=".38" font-size="9">12 / 14 / 16 / 24 / 36 / 56 / 78</text>
</g>

<g class="application-panel" transform="translate(810 ${panelRows[2]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="${muted}"/>
  ${label(6, identity.graphicSystem.device, ink)}
  <g transform="translate(404 0)" opacity=".88">${pattern(identity.graphicSystem, 358, panelHeight, ink, primary)}</g>
  <rect x="28" y="66" width="338" height="272" fill="${paper}"/>
  <text x="50" y="100" class="mono" fill="${primary}" font-size="9" letter-spacing="1.5">RECOGNIZABLE DEVICE</text>
  <text x="50" y="138" class="sans" fill="${ink}" font-size="25" font-weight="740">${escapeXml(identity.graphicSystem.device)}</text>
  ${textLines(graphicDescription, 50, 174, 18, `class="sans" fill="${ink}" opacity=".62" font-size="12"`)}
  ${identity.graphicSystem.rules.slice(0, 3).map((rule, index) => `<g transform="translate(50 ${252 + index * 25})"><circle cx="4" cy="-4" r="3" fill="${primary}"/><text x="17" class="mono" fill="${ink}" opacity=".72" font-size="8">${escapeXml(rule.toLocaleUpperCase().slice(0, 48))}</text></g>`).join('')}
</g>

<g class="application-panel" transform="translate(28 ${panelRows[3]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="${paper}"/>
  ${label(7, productApplication?.name ?? 'Product application', ink)}
  <g transform="translate(28 62)">
    <rect width="706" height="278" rx="${Math.min(identity.style.borderRadius, 14)}" fill="${muted}" stroke="${ink}" stroke-opacity=".16"/>
    <rect width="706" height="38" rx="${Math.min(identity.style.borderRadius, 14)}" fill="${ink}"/>
    ${logo(assets.markLight, identity.shortName, 16, 9, 72, 20, paper)}
    <text x="676" y="24" text-anchor="end" class="mono" fill="${paper}" opacity=".55" font-size="8">PRODUCT / LIVE STATE</text>
    <rect x="18" y="56" width="144" height="204" fill="${paper}"/><rect x="178" y="56" width="510" height="74" fill="${paper}"/>
    <text x="196" y="83" class="sans" fill="${ink}" font-size="18" font-weight="720">${escapeXml(productApplication?.name ?? identity.products[0] ?? identity.name)}</text>
    ${textLines(wrapText(productApplication?.description ?? identity.positioning, 63, 2), 196, 106, 15, `class="sans" fill="${ink}" opacity=".55" font-size="10"`)}
    ${identity.products.slice(0, 3).map((product, index) => `<g transform="translate(${178 + index * 174} 148)"><rect width="158" height="112" fill="${index === 0 ? primary : paper}"/><text x="13" y="28" class="sans" fill="${index === 0 && !isLight(primary) ? paper : ink}" font-size="12" font-weight="670">${escapeXml(product)}</text><path d="M13 76H145" stroke="${index === 0 && !isLight(primary) ? paper : ink}" stroke-opacity=".18"/><text x="13" y="96" class="mono" fill="${index === 0 && !isLight(primary) ? paper : ink}" opacity=".5" font-size="7">VIEW SYSTEM →</text></g>`).join('')}
  </g>
</g>

<g class="application-panel" transform="translate(810 ${panelRows[3]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="${primary}"/>
  ${label(8, campaignApplication?.name ?? 'Campaign system', isLight(primary) ? ink : paper)}
  <g opacity=".55">${pattern(identity.graphicSystem, panelWidth, panelHeight, isLight(primary) ? ink : paper, secondary)}</g>
  <rect x="32" y="64" width="354" height="274" fill="${paper}"/>
  ${logo(assets.markDark, identity.shortName, 52, 82, 82, 46, ink)}
  ${textLines(wrapText(campaignApplication?.name ?? identity.tagline, 18, 4), 52, 182, 36, `class="sans" fill="${ink}" font-size="30" font-weight="760" letter-spacing="-1.2"`)}
  <text x="52" y="316" class="mono" fill="${ink}" opacity=".5" font-size="8">${escapeXml(campaignApplication?.format ?? 'CAMPAIGN')}</text>
  <text x="728" y="338" text-anchor="end" class="mono" fill="${isLight(primary) ? ink : paper}" opacity=".55" font-size="9">${escapeXml(identity.socialHandle || identity.website)}</text>
</g>

<g class="application-panel" transform="translate(28 ${panelRows[4]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="${deep}"/>
  ${label(9, technicalApplication?.name ?? 'System evidence', paper)}
  <g transform="translate(34 62)"><rect width="694" height="274" fill="${ink}" stroke="${paper}" stroke-opacity=".22"/><rect width="694" height="34" fill="${mid}" opacity=".35"/><circle cx="18" cy="17" r="3" fill="${accent}"/><circle cx="31" cy="17" r="3" fill="${secondary}"/><circle cx="44" cy="17" r="3" fill="${primary}"/>
    <text x="20" y="78" class="mono" fill="${paper}" font-size="14">$ ${escapeXml(identity.shortName.toLocaleLowerCase())} ${escapeXml(identity.products[0]?.toLocaleLowerCase().replaceAll(' ', '-') ?? 'build')}</text>
    <text x="20" y="116" class="mono" fill="${secondary}" font-size="12">✓ ${escapeXml(identity.strategy.pillars[0] ?? 'system ready')}</text>
    <text x="20" y="148" class="mono" fill="${secondary}" font-size="12">✓ ${escapeXml(identity.strategy.pillars[1] ?? 'application ready')}</text>
    <path d="M20 174H674" stroke="${paper}" stroke-opacity=".12"/>
    ${textLines(wrapText(technicalApplication?.description ?? identity.positioning, 78, 3), 20, 206, 18, `class="mono" fill="${paper}" opacity=".6" font-size="9"`)}
    <text x="674" y="252" text-anchor="end" class="mono" fill="${primary}" font-size="9">${escapeXml(technicalApplication?.format ?? 'SYSTEM')}</text>
  </g>
</g>

<g class="application-panel" transform="translate(810 ${panelRows[4]})">
  <rect width="${panelWidth}" height="${panelHeight}" fill="url(#fade-light)"/>
  ${label(10, physicalApplication?.name ?? 'Proof and application', ink)}
  <g transform="translate(30 66)"><rect width="250" height="270" fill="${paper}" stroke="${ink}" stroke-opacity=".14"/>${logo(assets.markDark, identity.shortName, 24, 22, 88, 58, ink)}<text x="24" y="126" class="mono" fill="${primary}" font-size="9">${escapeXml(physicalApplication?.format ?? 'APPLICATION')}</text>${textLines(wrapText(physicalApplication?.name ?? identity.name, 17, 3), 24, 164, 30, `class="sans" fill="${ink}" font-size="24" font-weight="740"`)}<text x="24" y="246" class="mono" fill="${ink}" opacity=".44" font-size="8">${escapeXml(identity.shortName)} / 2026</text></g>
  <g transform="translate(304 66)"><rect width="428" height="126" fill="url(#brand-gradient)"/>${logo(assets.markLight, identity.shortName, 24, 30, 114, 66, paper)}<text x="404" y="102" text-anchor="end" class="mono" fill="${paper}" opacity=".6" font-size="8">${escapeXml(identity.strategy.promise.toLocaleUpperCase().slice(0, 44))}</text></g>
  <g transform="translate(304 210)"><rect width="428" height="126" fill="${paper}" stroke="${ink}" stroke-opacity=".14"/>${proof.map((item, index) => `<text x="${22 + (index % 2) * 202}" y="${42 + Math.floor(index / 2) * 48}" class="sans" fill="${ink}" font-size="13" font-weight="660">${escapeXml(item)}</text>`).join('')}<text x="404" y="108" text-anchor="end" class="mono" fill="${ink}" opacity=".38" font-size="8">PROOF / SOURCES / SCALE</text></g>
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
