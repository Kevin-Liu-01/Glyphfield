import type { BrandIdentity } from './brandIdentity';

export type MoodboardSvgAssets = {
  interFont?: string;
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

export function buildMoodboardSvg(
  identity: BrandIdentity,
  assets: MoodboardSvgAssets
): string {
  const ink = color(identity, 'ink', '#18181B');
  const paper = color(identity, 'paper', '#FFFFFF');
  const muted = color(identity, 'muted', '#F4F4F5');
  const emphasis = color(identity, 'emphasis', '#3B82F6');
  const success = color(identity, 'success', '#16A34A');
  const warning = color(identity, 'warning', '#F59E0B');
  const progress = color(identity, 'progress', '#F97316');
  const error = color(identity, 'error', '#EF4444');
  const products = identity.products.length > 0 ? identity.products : ['Product', 'Platform', 'Community'];
  const applicationTitles = [0, 1, 2].map((index) =>
    wrapText(products[index] ?? ['Product', 'Platform', 'Community'][index], 14, 2)
  );
  const greeting = identity.greetings[0] ?? 'Welcome';
  const phrase = identity.voice.phrases[0] ?? identity.tagline;
  const positioningLines = wrapText(identity.positioning, 38, 4);
  const socialLines = wrapText(phrase, 24, 3);
  const slideLines = wrapText(identity.tagline, 20, 4);
  const sansLabel =
    identity.typography.find(({ role }) => role !== 'Code')?.family ?? 'Inter';
  const monoLabel =
    identity.typography.find(({ role }) => role === 'Code')?.family ?? 'Geist Mono';
  const fontDefinitions = `${embeddedFont('Moodboard Sans', assets.interFont)}${embeddedFont('Moodboard Mono', assets.monoFont)}`;
  const proofMarks = (assets.proofMarks ?? [])
    .slice(0, 4)
    .map(
      (source, index) =>
        `<image href="${escapeXml(source)}" x="${48 + index * 168}" y="500" width="120" height="24" preserveAspectRatio="xMidYMid meet"/>`
    )
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000">
<defs>
  <style>${fontDefinitions}.sans{font-family:'Moodboard Sans';}.mono{font-family:'Moodboard Mono';}</style>
  <pattern id="grid" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="${paper}" stroke-opacity=".12"/></pattern>
  <pattern id="dot" width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${ink}" opacity=".14"/></pattern>
  <linearGradient id="fade" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${emphasis}"/><stop offset="1" stop-color="${ink}"/></linearGradient>
</defs>
<rect width="1600" height="2000" fill="#BDBDBA"/>

<g class="application-panel" transform="translate(28 28)">
  <rect width="762" height="440" fill="${ink}"/>
  ${assets.motionPreview ? `<image href="${escapeXml(assets.motionPreview)}" width="762" height="440" opacity=".22" preserveAspectRatio="xMidYMid slice"/>` : ''}
  <rect width="762" height="440" fill="url(#grid)"/>
  <text x="34" y="42" class="mono" fill="${paper}" opacity=".58" font-size="13" letter-spacing="2">MOTION / HERO</text>
  ${mark(assets.markLight, identity.shortName, 264, 100, 234, 154, paper)}
  <text x="381" y="330" text-anchor="middle" class="sans" fill="${paper}" font-size="48" font-weight="760">${escapeXml(identity.name)}</text>
  <text x="381" y="370" text-anchor="middle" class="sans" fill="${paper}" opacity=".64" font-size="18">${escapeXml(identity.tagline)}</text>
  <text x="34" y="412" class="mono" fill="${paper}" opacity=".46" font-size="12">${escapeXml(identity.website || 'LOCAL BRAND')}</text>
</g>

<g class="application-panel" transform="translate(810 28)">
  <rect width="762" height="440" fill="#FFF9E9"/>
  <text x="36" y="44" class="mono" fill="${ink}" opacity=".5" font-size="13" letter-spacing="2">APPLICATION / SYSTEM</text>
  <g transform="translate(36 86)">
    <rect width="212" height="310" fill="${emphasis}"/>
    <rect x="14" y="14" width="184" height="282" fill="none" stroke="${paper}" stroke-opacity=".62"/>
    ${textLines(applicationTitles[0], 24, 52, 23, `class="sans" fill="${paper}" font-size="18" font-weight="680"`)}
    <text x="24" y="82" class="sans" fill="${paper}" opacity=".78" font-size="14">Built into the stack.</text>
    <rect x="24" y="238" width="104" height="30" fill="${paper}"/>
    <text x="36" y="258" class="mono" fill="${ink}" font-size="9">OPEN PROJECT →</text>
    ${mark(assets.markLight, identity.shortName, 158, 246, 24, 24, paper)}
  </g>
  <g transform="translate(274 86)">
    <rect width="212" height="310" fill="${ink}"/>
    <rect x="14" y="14" width="184" height="282" fill="none" stroke="${paper}" stroke-opacity=".38"/>
    ${textLines(applicationTitles[1], 24, 52, 23, `class="sans" fill="${paper}" font-size="18" font-weight="680"`)}
    <text x="24" y="82" class="sans" fill="${paper}" opacity=".6" font-size="14">One source of truth.</text>
    <rect x="24" y="238" width="104" height="30" fill="${paper}"/>
    <text x="36" y="258" class="mono" fill="${ink}" font-size="9">VIEW SYSTEM →</text>
    ${mark(assets.markLight, identity.shortName, 158, 246, 24, 24, paper)}
  </g>
  <g transform="translate(512 86)">
    <rect width="212" height="310" fill="${progress}"/>
    <rect x="14" y="14" width="184" height="282" fill="none" stroke="${paper}" stroke-opacity=".62"/>
    ${textLines(applicationTitles[2], 24, 52, 23, `class="sans" fill="${paper}" font-size="18" font-weight="680"`)}
    <text x="24" y="82" class="sans" fill="${paper}" opacity=".78" font-size="14">Ready for the world.</text>
    <rect x="24" y="238" width="104" height="30" fill="${paper}"/>
    <text x="36" y="258" class="mono" fill="${ink}" font-size="9">LEARN MORE →</text>
    ${mark(assets.markLight, identity.shortName, 158, 246, 24, 24, paper)}
  </g>
</g>

<g class="application-panel" transform="translate(28 488)">
  <rect width="762" height="440" fill="#F0F0ED"/>
  <text x="34" y="42" class="mono" fill="${ink}" opacity=".5" font-size="13" letter-spacing="2">EMAIL / ONBOARDING</text>
  <g transform="translate(86 68)">
    <rect width="590" height="334" fill="${paper}" stroke="${ink}" stroke-opacity=".12"/>
    ${mark(assets.markDark, identity.shortName, 28, 24, 34, 34, ink)}
    <text x="76" y="47" class="mono" fill="${ink}" font-size="11" font-weight="650">${escapeXml(identity.shortName)} / WELCOME</text>
    <rect x="28" y="78" width="534" height="90" fill="${ink}"/>
    <text x="295" y="132" text-anchor="middle" class="sans" fill="${paper}" font-size="32" font-weight="700">${escapeXml(greeting)}</text>
    <text x="28" y="212" class="sans" fill="${ink}" font-size="28" font-weight="720">Welcome to ${escapeXml(identity.name)}.</text>
    <text x="28" y="242" class="sans" fill="${ink}" opacity=".56" font-size="13">Everything you need to start building with the brand.</text>
    <rect x="28" y="270" width="118" height="34" fill="${ink}"/>
    <text x="43" y="292" class="mono" fill="${paper}" font-size="10">GET STARTED →</text>
    <rect x="334" y="270" width="104" height="34" fill="${muted}"/>
    <rect x="448" y="270" width="114" height="34" fill="${muted}"/>
  </g>
</g>

<g class="application-panel" transform="translate(810 488)">
  <rect width="762" height="440" fill="${ink}"/>
  <text x="34" y="42" class="mono" fill="${paper}" opacity=".52" font-size="13" letter-spacing="2">CLI / TERMINAL</text>
  <g transform="translate(46 72)">
    <rect width="670" height="316" fill="#080808" stroke="${paper}" stroke-opacity=".2"/>
    <circle cx="24" cy="22" r="5" fill="${error}"/><circle cx="42" cy="22" r="5" fill="${warning}"/><circle cx="60" cy="22" r="5" fill="${success}"/>
    <text x="24" y="72" class="mono" fill="${paper}" font-size="18">$ npx ${escapeXml(identity.shortName.toLocaleLowerCase())} init</text>
    <text x="24" y="112" class="mono" fill="${emphasis}" font-size="17">✓ project connected</text>
    <text x="24" y="148" class="mono" fill="${success}" font-size="17">✓ brand assets indexed</text>
    <text x="24" y="184" class="mono" fill="${success}" font-size="17">✓ moodboard generated</text>
    <path d="M24 218H646" stroke="${paper}" stroke-opacity=".12"/>
    <text x="24" y="252" class="mono" fill="${paper}" opacity=".52" font-size="13">OUTPUT</text>
    <text x="24" y="284" class="mono" fill="${paper}" font-size="15">./${escapeXml(identity.id)}-brand-system</text>
    ${mark(assets.markLight, identity.shortName, 564, 226, 70, 70, paper)}
  </g>
</g>

<g class="application-panel" transform="translate(28 948)">
  <rect width="762" height="460" fill="${emphasis}"/>
  <rect width="762" height="460" fill="url(#dot)" opacity=".44"/>
  <text x="36" y="44" class="mono" fill="${paper}" opacity=".66" font-size="13" letter-spacing="2">SOCIAL / LAUNCH</text>
  ${mark(assets.markLight, identity.shortName, 626, 34, 92, 92, paper)}
  ${textLines(socialLines, 48, 150, 62, `class="sans" fill="${paper}" font-size="50" font-weight="760" letter-spacing="-2"`)}
  <rect x="36" y="354" width="690" height="70" fill="${ink}"/>
  <text x="58" y="383" class="mono" fill="${paper}" opacity=".58" font-size="10">${escapeXml(identity.website || 'BRAND LAUNCH')}</text>
  <text x="58" y="408" class="sans" fill="${paper}" font-size="16">${escapeXml(identity.name)} · ${escapeXml(products.slice(0, 3).join(' / '))}</text>
</g>

<g class="application-panel" transform="translate(810 948)">
  <rect width="762" height="460" fill="#242427"/>
  <text x="34" y="42" class="mono" fill="${paper}" opacity=".52" font-size="13" letter-spacing="2">SLIDE / TITLE</text>
  <g transform="translate(44 76)">
    <rect width="674" height="340" fill="${paper}"/>
    <rect x="430" width="244" height="340" fill="url(#fade)"/>
    <rect x="430" width="244" height="340" fill="url(#grid)"/>
    <text x="28" y="42" class="mono" fill="${ink}" opacity=".5" font-size="10">${escapeXml(identity.shortName)} / 01</text>
    ${textLines(slideLines, 28, 104, 39, `class="sans" fill="${ink}" font-size="32" font-weight="720" letter-spacing="-1.2"`)}
    <rect x="28" y="268" width="96" height="30" fill="${emphasis}"/>
    <text x="43" y="288" class="mono" fill="${paper}" font-size="9">VIEW DECK →</text>
    ${mark(assets.markLight, identity.shortName, 500, 112, 104, 104, paper)}
    <text x="552" y="282" text-anchor="middle" class="mono" fill="${paper}" opacity=".62" font-size="10">${escapeXml(identity.website)}</text>
  </g>
</g>

<g class="application-panel" transform="translate(28 1428)">
  <rect width="762" height="544" fill="#E9E9E5"/>
  <text x="34" y="42" class="mono" fill="${ink}" opacity=".5" font-size="13" letter-spacing="2">EVENT / PASS</text>
  <path d="M230 0V86" stroke="${emphasis}" stroke-width="22"/><path d="M532 0V86" stroke="${progress}" stroke-width="22"/>
  <g transform="translate(132 76)">
    <rect width="196" height="408" rx="12" fill="${emphasis}"/>
    <circle cx="98" cy="22" r="8" fill="#E9E9E5"/>
    ${mark(assets.markLight, identity.shortName, 48, 74, 100, 80, paper)}
    <text x="24" y="214" class="mono" fill="${paper}" opacity=".65" font-size="10">ATTENDEE</text>
    <text x="24" y="249" class="sans" fill="${paper}" font-size="24" font-weight="720">ALEX</text>
    <text x="24" y="276" class="sans" fill="${paper}" opacity=".74" font-size="14">PRODUCT TEAM</text>
    <path d="M24 318H172" stroke="${paper}" stroke-opacity=".28"/>
    <text x="24" y="352" class="mono" fill="${paper}" font-size="10">${escapeXml(identity.shortName)} / 2026</text>
  </g>
  <g transform="translate(434 76)">
    <rect width="196" height="408" rx="12" fill="${progress}"/>
    <circle cx="98" cy="22" r="8" fill="#E9E9E5"/>
    ${mark(assets.markLight, identity.shortName, 48, 74, 100, 80, paper)}
    <text x="24" y="214" class="mono" fill="${paper}" opacity=".65" font-size="10">SPEAKER</text>
    <text x="24" y="249" class="sans" fill="${paper}" font-size="24" font-weight="720">SAM</text>
    <text x="24" y="276" class="sans" fill="${paper}" opacity=".74" font-size="14">COMMUNITY</text>
    <path d="M24 318H172" stroke="${paper}" stroke-opacity=".28"/>
    <text x="24" y="352" class="mono" fill="${paper}" font-size="10">${escapeXml(identity.shortName)} / 2026</text>
  </g>
</g>

<g class="application-panel" transform="translate(810 1428)">
  <rect width="762" height="544" fill="${ink}"/>
  <text x="34" y="42" class="mono" fill="${paper}" opacity=".52" font-size="13" letter-spacing="2">LOGO / SYSTEM</text>
  <g transform="translate(36 78)">
    <rect width="214" height="190" fill="${paper}"/>
    ${mark(assets.markDark, identity.shortName, 52, 42, 110, 82, ink)}
    <text x="18" y="168" class="mono" fill="${ink}" opacity=".5" font-size="10">LIGHT / INK</text>
  </g>
  <g transform="translate(274 78)">
    <rect width="214" height="190" fill="${emphasis}"/>
    ${mark(assets.markLight, identity.shortName, 52, 42, 110, 82, paper)}
    <text x="18" y="168" class="mono" fill="${paper}" opacity=".66" font-size="10">PRIMARY / WHITE</text>
  </g>
  <g transform="translate(512 78)">
    <rect width="214" height="190" fill="${paper}"/>
    <text x="24" y="66" class="sans" fill="${ink}" font-size="54" font-weight="780">Aa</text>
    <text x="24" y="104" class="sans" fill="${ink}" font-size="16">${escapeXml(sansLabel)}</text>
    <text x="24" y="132" class="mono" fill="${ink}" font-size="13">${escapeXml(monoLabel)}</text>
    <text x="24" y="168" class="mono" fill="${ink}" opacity=".5" font-size="10">TYPE / PAIRING</text>
  </g>
  <g transform="translate(36 292)">
    <rect width="115" height="82" fill="${ink}" stroke="${paper}" stroke-opacity=".24"/>
    <rect x="115" width="115" height="82" fill="${paper}"/>
    <rect x="230" width="115" height="82" fill="${emphasis}"/>
    <rect x="345" width="115" height="82" fill="${success}"/>
    <rect x="460" width="115" height="82" fill="${warning}"/>
    <rect x="575" width="115" height="82" fill="${error}"/>
    <text x="0" y="108" class="mono" fill="${paper}" opacity=".52" font-size="10">${escapeXml(identity.colors.slice(0, 6).map(({ hex }) => hex).join('  '))}</text>
  </g>
  ${textLines(positioningLines, 36, 418, 20, `class="sans" fill="${paper}" opacity=".68" font-size="14"`)}
  ${proofMarks ? `<rect x="30" y="492" width="702" height="40" fill="${paper}"/>${proofMarks}` : ''}
</g>
</svg>`;
}
