import type { BrandIdentity } from './brandIdentity';

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

function mark(
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
  return `<text x="${x + width / 2}" y="${y + height * 0.67}" text-anchor="middle" class="sans" fill="${fill}" font-size="${Math.min(width, height) * 0.54}" font-weight="800">${escapeXml(fallback)}</text>`;
}

function logoAsset(
  source: string | undefined,
  fallback: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string
): string {
  return mark(source, fallback, x, y, width, height, fill);
}

export function buildMoodboardSvg(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets
): string {
  const ink = color(identity, 'ink', '#181818');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F4');
  const silver = color(identity, 'emphasis', '#E4E4E4');
  const cloud = color(identity, 'success', '#D4D4D4');
  const slate = color(identity, 'warning', '#A3A3A3');
  const graphite = color(identity, 'progress', '#525252');
  const charcoal = color(identity, 'error', '#262626');
  const products = identity.products.length > 0
    ? identity.products
    : ['Product', 'Platform', 'Community'];
  const greeting = identity.greetings[1] ?? identity.greetings[0] ?? 'Welcome';
  const positioningLines = wrapText(identity.positioning, 42, 4);
  const taglineLines = wrapText(identity.tagline, 24, 3);
  const sansLabel = identity.typography.find(({ role }) => role !== 'Code')?.family ?? 'Inter';
  const monoLabel = identity.typography.find(({ role }) => role === 'Code')?.family ?? 'Geist Mono';
  const fontDefinitions = `${embeddedFont('Moodboard Sans', assets.interFont)}${embeddedFont('Moodboard Mono', assets.monoFont)}`;
  const logos = assets.logoMarks ?? [];
  const proofMarks = (assets.proofMarks ?? [])
    .slice(0, 4)
    .map(
      (source, index) =>
        `<image href="${escapeXml(source)}" x="${42 + index * 146}" y="363" width="108" height="22" preserveAspectRatio="xMidYMid meet"/>`
    )
    .join('');
  const palette = identity.colors.slice(0, 8);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000">
<defs>
  <style>${fontDefinitions}.sans{font-family:'Moodboard Sans';}.mono{font-family:'Moodboard Mono';}</style>
  <pattern id="dot-dark" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${paper}" opacity=".11"/></pattern>
  <pattern id="dot-light" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${ink}" opacity=".12"/></pattern>
  <linearGradient id="mono-fade" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${paper}"/><stop offset=".5" stop-color="${slate}"/><stop offset="1" stop-color="${ink}"/></linearGradient>
</defs>
<rect width="1600" height="2000" fill="#D0D0D0"/>

<g class="application-panel" transform="translate(28 28)">
  <rect width="762" height="440" fill="${ink}"/>
  ${assets.motionPreview ? `<image href="${escapeXml(assets.motionPreview)}" width="762" height="440" opacity=".12" preserveAspectRatio="xMidYMid slice"/>` : ''}
  <rect width="762" height="440" fill="url(#dot-dark)"/>
  <text x="34" y="42" class="mono" fill="${paper}" opacity=".55" font-size="13" letter-spacing="2">GT / IDENTITY</text>
  ${mark(assets.markLight, identity.shortName, 48, 86, 236, 136, paper)}
  ${textLines(taglineLines, 48, 296, 43, `class="sans" fill="${paper}" font-size="36" font-weight="690" letter-spacing="-1.2"`)}
  <text x="714" y="408" text-anchor="end" class="mono" fill="${paper}" opacity=".48" font-size="11">${escapeXml(identity.website || 'LOCAL BRAND')}</text>
</g>

<g class="application-panel" transform="translate(810 28)">
  <rect width="762" height="440" fill="${paper}"/>
  <text x="34" y="42" class="mono" fill="${ink}" opacity=".5" font-size="13" letter-spacing="2">LOGO / FAMILY</text>
  <g transform="translate(34 76)">
    <rect width="326" height="142" fill="${muted}"/>
    ${logoAsset(logos[0] ?? assets.markDark, identity.shortName, 86, 36, 154, 70, ink)}
    <text x="16" y="128" class="mono" fill="${ink}" opacity=".45" font-size="9">MARK / BLACK</text>
  </g>
  <g transform="translate(380 76)">
    <rect width="348" height="142" fill="${ink}"/>
    ${logoAsset(logos[1] ?? assets.markLight, identity.shortName, 96, 36, 156, 70, paper)}
    <text x="16" y="128" class="mono" fill="${paper}" opacity=".5" font-size="9">MARK / WHITE</text>
  </g>
  <g transform="translate(34 238)">
    <rect width="694" height="82" fill="${muted}"/>
    ${logoAsset(logos[2] ?? assets.markDark, identity.shortName, 38, 18, 618, 46, ink)}
  </g>
  <g transform="translate(34 338)">
    <rect width="694" height="68" fill="none" stroke="${ink}" stroke-opacity=".16"/>
    ${logoAsset(logos[3] ?? assets.markDark, identity.name, 32, 15, 630, 38, ink)}
  </g>
</g>

<g class="application-panel" transform="translate(28 488)">
  <rect width="762" height="440" fill="${paper}"/>
  <text x="34" y="42" class="mono" fill="${ink}" opacity=".5" font-size="13" letter-spacing="2">COLOR / SYSTEM</text>
  <text x="34" y="84" class="sans" fill="${ink}" font-size="26" font-weight="680">Black and white, with depth.</text>
  ${palette.map(({ hex, name }, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 34 + column * 172;
    const y = 116 + row * 132;
    const labelFill = hex.toLocaleUpperCase() === '#FFFFFF' || hex.toLocaleUpperCase() === '#F4F4F4' || hex.toLocaleUpperCase() === '#E4E4E4' || hex.toLocaleUpperCase() === '#D4D4D4' ? ink : paper;
    return `<g transform="translate(${x} ${y})"><rect width="154" height="112" fill="${hex}" stroke="${ink}" stroke-opacity=".12"/><text x="12" y="76" class="sans" fill="${labelFill}" font-size="12" font-weight="650">${escapeXml(name)}</text><text x="12" y="96" class="mono" fill="${labelFill}" opacity=".62" font-size="9">${escapeXml(hex)}</text></g>`;
  }).join('')}
  <text x="34" y="408" class="mono" fill="${ink}" opacity=".46" font-size="10">SURFACE · TYPE · BORDER · STATE · MOTION</text>
</g>

<g class="application-panel" transform="translate(810 488)">
  <rect width="762" height="440" fill="${ink}"/>
  <text x="34" y="42" class="mono" fill="${paper}" opacity=".52" font-size="13" letter-spacing="2">TYPOGRAPHY / SYSTEM</text>
  <text x="34" y="118" class="sans" fill="${paper}" font-size="76" font-weight="760" letter-spacing="-4">Aa</text>
  <text x="170" y="104" class="sans" fill="${paper}" font-size="24" font-weight="650">${escapeXml(sansLabel)}</text>
  <text x="170" y="132" class="sans" fill="${paper}" opacity=".54" font-size="14">Display / UI / Editorial</text>
  <path d="M34 164H728" stroke="${paper}" stroke-opacity=".16"/>
  <text x="34" y="216" class="sans" fill="${paper}" font-size="30" font-weight="650">Bienvenidos · 你好 · ようこそ</text>
  <text x="34" y="262" class="sans" fill="${paper}" font-size="30" font-weight="650">أهلاً وسهلاً · Welcome</text>
  <path d="M34 294H728" stroke="${paper}" stroke-opacity=".16"/>
  <text x="34" y="336" class="mono" fill="${paper}" font-size="17">$ gt translate ./src --locales es,ja,ar</text>
  <text x="34" y="374" class="mono" fill="${silver}" font-size="13">${escapeXml(monoLabel)} / code + metadata</text>
  <text x="34" y="410" class="mono" fill="${paper}" opacity=".4" font-size="10">12 / 14 / 16 / 24 / 32 / 48 / 76</text>
</g>

<g class="application-panel" transform="translate(28 948)">
  <rect width="762" height="460" fill="${muted}"/>
  <text x="34" y="42" class="mono" fill="${ink}" opacity=".5" font-size="13" letter-spacing="2">EMAIL / ONBOARDING</text>
  <g transform="translate(72 68)">
    <rect width="618" height="354" fill="${paper}"/>
    <g transform="translate(28 22)">${mark(assets.markDark, identity.shortName, 0, 0, 36, 36, ink)}</g>
    <text x="76" y="46" class="mono" fill="${ink}" font-size="10">GENERAL TRANSLATION</text>
    <rect x="28" y="76" width="562" height="78" fill="${ink}"/>
    <text x="309" y="124" text-anchor="middle" class="sans" fill="${paper}" font-size="29" font-weight="680">${escapeXml(greeting)}</text>
    <text x="28" y="198" class="sans" fill="${ink}" font-size="25" font-weight="710">Welcome to ${escapeXml(identity.name)}!</text>
    <text x="28" y="226" class="sans" fill="${ink}" opacity=".58" font-size="12">Product copy, documentation, and code—moving together.</text>
    <rect x="28" y="254" width="122" height="34" fill="${ink}"/>
    <text x="44" y="276" class="mono" fill="${paper}" font-size="9">GET STARTED →</text>
    <g transform="translate(28 310)"><rect width="166" height="24" fill="${muted}"/><rect x="178" width="166" height="24" fill="${muted}"/><rect x="356" width="206" height="24" fill="${muted}"/></g>
  </g>
</g>

<g class="application-panel" transform="translate(810 948)">
  <rect width="762" height="460" fill="${ink}"/>
  <text x="34" y="42" class="mono" fill="${paper}" opacity=".52" font-size="13" letter-spacing="2">CLI / TERMINAL</text>
  <g transform="translate(44 72)">
    <rect width="674" height="338" fill="#0A0A0A" stroke="${paper}" stroke-opacity=".2"/>
    <rect width="674" height="38" fill="${charcoal}"/>
    <circle cx="22" cy="19" r="4" fill="${graphite}"/><circle cx="38" cy="19" r="4" fill="${slate}"/><circle cx="54" cy="19" r="4" fill="${cloud}"/>
    <text x="337" y="23" text-anchor="middle" class="mono" fill="${paper}" opacity=".45" font-size="9">${escapeXml(identity.shortName.toLocaleLowerCase())} — brand system</text>
    <text x="24" y="88" class="mono" fill="${paper}" font-size="17">$ npx ${escapeXml(identity.shortName.toLocaleLowerCase())} init</text>
    <text x="24" y="130" class="mono" fill="${silver}" font-size="15">✓ project connected</text>
    <text x="24" y="166" class="mono" fill="${cloud}" font-size="15">✓ locales discovered</text>
    <text x="24" y="202" class="mono" fill="${cloud}" font-size="15">✓ translation pipeline ready</text>
    <path d="M24 234H650" stroke="${paper}" stroke-opacity=".12"/>
    <text x="24" y="270" class="mono" fill="${paper}" opacity=".5" font-size="11">NEXT</text>
    <text x="24" y="304" class="mono" fill="${paper}" font-size="14">git add . && git commit -m "translate"</text>
    ${mark(assets.markLight, identity.shortName, 584, 258, 54, 54, paper)}
  </g>
</g>

<g class="application-panel" transform="translate(28 1428)">
  <rect width="762" height="544" fill="${paper}"/>
  <text x="34" y="42" class="mono" fill="${ink}" opacity=".5" font-size="13" letter-spacing="2">PRODUCT / PAGE</text>
  <g transform="translate(34 70)">
    <rect width="694" height="432" fill="${paper}" stroke="${ink}" stroke-opacity=".16"/>
    <rect width="694" height="46" fill="${ink}"/>
    ${mark(assets.markLight, identity.shortName, 18, 10, 70, 26, paper)}
    <text x="654" y="28" text-anchor="end" class="mono" fill="${paper}" opacity=".6" font-size="9">DOCS  ·  DASHBOARD  ·  GITHUB</text>
    <text x="28" y="108" class="sans" fill="${ink}" font-size="39" font-weight="740" letter-spacing="-1.7">Code is the source of truth.</text>
    ${textLines(positioningLines, 28, 142, 18, `class="sans" fill="${ink}" opacity=".58" font-size="12"`)}
    <rect x="28" y="226" width="120" height="34" fill="${ink}"/><text x="45" y="248" class="mono" fill="${paper}" font-size="9">START BUILDING →</text>
    ${products.slice(0, 3).map((product, index) => `<g transform="translate(${28 + index * 218} 290)"><rect width="202" height="106" fill="${index === 1 ? ink : muted}"/><text x="16" y="34" class="sans" fill="${index === 1 ? paper : ink}" font-size="15" font-weight="670">${escapeXml(product)}</text><text x="16" y="78" class="mono" fill="${index === 1 ? paper : ink}" opacity=".5" font-size="8">EXPLORE →</text></g>`).join('')}
    ${proofMarks ? `<g transform="translate(28 0)">${proofMarks}</g>` : ''}
  </g>
</g>

<g class="application-panel" transform="translate(810 1428)">
  <rect width="762" height="544" fill="${ink}"/>
  <rect width="762" height="544" fill="url(#dot-dark)"/>
  <text x="34" y="42" class="mono" fill="${paper}" opacity=".52" font-size="13" letter-spacing="2">EVENT / PASS</text>
  <g transform="translate(92 78)">
    <rect width="250" height="402" fill="${paper}"/>
    <rect width="250" height="122" fill="${ink}"/>
    ${mark(assets.markLight, identity.shortName, 72, 30, 106, 62, paper)}
    <text x="22" y="174" class="mono" fill="${ink}" opacity=".48" font-size="9">ATTENDEE / 001</text>
    <text x="22" y="220" class="sans" fill="${ink}" font-size="31" font-weight="740">ALEX</text>
    <text x="22" y="250" class="sans" fill="${ink}" opacity=".55" font-size="13">PRODUCT TEAM</text>
    <path d="M22 286H228" stroke="${ink}" stroke-opacity=".16"/>
    <rect x="22" y="316" width="82" height="54" fill="url(#dot-light)" stroke="${ink}" stroke-opacity=".18"/>
    <text x="228" y="348" text-anchor="end" class="mono" fill="${ink}" font-size="10">${escapeXml(identity.shortName)} / 2026</text>
  </g>
  <g transform="translate(374 78)">
    <rect width="296" height="190" fill="${paper}"/>
    ${mark(assets.markDark, identity.shortName, 24, 24, 84, 54, ink)}
    <text x="24" y="116" class="sans" fill="${ink}" font-size="22" font-weight="720">General Translation</text>
    <text x="24" y="142" class="sans" fill="${ink}" opacity=".5" font-size="12">New York · 2026</text>
    <rect x="24" y="162" width="248" height="4" fill="url(#mono-fade)"/>
  </g>
  <g transform="translate(374 292)">
    <rect width="296" height="188" fill="${graphite}"/>
    ${textLines(wrapText(identity.voice.phrases[2] ?? identity.tagline, 20, 3), 24, 50, 29, `class="sans" fill="${paper}" font-size="23" font-weight="680"`)}
    <text x="24" y="164" class="mono" fill="${paper}" opacity=".5" font-size="9">COMMUNITY / NYC</text>
  </g>
</g>
</svg>`;
}
