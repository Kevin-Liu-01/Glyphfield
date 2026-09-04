import { CODE_THEME, highlightCode, type CodeLanguage } from './codeHighlight';
import { escapeXml } from './download';
import { terminalLanguageIcon } from './terminalLanguageIcon';
import { capVisibleFontWeight } from './typography';

export type TerminalSvgOptions = {
  assetData?: string | null;
  assetOpacity: number;
  code: string;
  codeFontData?: string | null;
  codeFontFamily: string;
  codeFontWeight: number;
  language: CodeLanguage;
  title: string;
  titleFontData?: string | null;
  titleFontFamily: string;
  titleFontWeight: number;
};

function fontFace(family: string, source: string | null | undefined): string {
  return source ? `@font-face{font-family:'${family}';src:url('${source}')}` : '';
}

function fontFamily(embeddedName: string, source: string | null | undefined, fallback: string): string {
  return source ? embeddedName : escapeXml(fallback);
}

const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  bash: 'Bash',
  python: 'Python',
  typescript: 'TypeScript',
};

const CODE_BLOCK = {
  headerHeight: 64,
  height: 420,
  radius: 24,
  width: 1056,
  x: 72,
  y: 142,
} as const;

const RARE_UI_THEME = {
  accent: '#A997FF',
  background: '#171717',
  border: '#FFFFFF14',
  floating: '#FFFFFF0D',
  header: '#FFFFFF08',
  muted: '#FFFFFF99',
} as const;

function copyIcon(): string {
  return '<g data-slot="code-block-copy" fill="none" stroke="#FFFFFF73" stroke-width="2"><rect x="1082" y="163" width="15" height="15" rx="3"/><path d="M1077 174h-2a3 3 0 0 1-3-3v-9a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v2"/></g>';
}

export function buildTerminalSvg({
  assetData,
  assetOpacity,
  code,
  codeFontData,
  codeFontFamily,
  codeFontWeight,
  language,
  title,
  titleFontData,
  titleFontFamily,
  titleFontWeight,
}: TerminalSvgOptions): string {
  const fontDefinitions = `<style>${fontFace('StudioTerminalTitle', titleFontData)}${fontFace('StudioTerminalCode', codeFontData)}</style>`;
  const assetLayer = assetData
    ? `<image href="${assetData}" width="1200" height="630" preserveAspectRatio="xMidYMid slice" opacity="${Math.min(100, Math.max(0, assetOpacity)) / 100}"/>`
    : '';
  const codeSvg = highlightCode(code, language)
    .slice(0, 10)
    .map((line, index) => {
      const tokens = line.tokens.length > 0
        ? line.tokens.map(({ color, content }) => (
            `<tspan fill="${color}">${escapeXml(content)}</tspan>`
          )).join('')
        : '<tspan> </tspan>';
      const baseline = 248 + index * 30;
      return `<g data-slot="code-block-line"><text aria-hidden="true" x="112" y="${baseline}" text-anchor="end" fill="${CODE_THEME.gutter}" font-family="${fontFamily('StudioTerminalCode', codeFontData, codeFontFamily)}" font-size="17" font-weight="${capVisibleFontWeight(codeFontWeight)}">${index + 1}</text><text x="142" y="${baseline}" fill="${CODE_THEME.foreground}" font-family="${fontFamily('StudioTerminalCode', codeFontData, codeFontFamily)}" font-size="18" font-weight="${capVisibleFontWeight(codeFontWeight)}" xml:space="preserve">${tokens}</text></g>`;
    })
    .join('');

  const frameBottom = CODE_BLOCK.y + CODE_BLOCK.height;
  const headerBottom = CODE_BLOCK.y + CODE_BLOCK.headerHeight;
  const languageIcon = terminalLanguageIcon(language, 96, 162, 24);
  const languageLabel = escapeXml(LANGUAGE_LABELS[language]);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs>${fontDefinitions}<clipPath id="terminal-code-block-clip"><rect x="${CODE_BLOCK.x}" y="${CODE_BLOCK.y}" width="${CODE_BLOCK.width}" height="${CODE_BLOCK.height}" rx="${CODE_BLOCK.radius}"/></clipPath></defs><rect width="1200" height="630" fill="${CODE_THEME.background}"/>${assetLayer}<text x="72" y="98" fill="${CODE_THEME.foreground}" font-family="${fontFamily('StudioTerminalTitle', titleFontData, titleFontFamily)}" font-size="42" font-weight="${capVisibleFontWeight(titleFontWeight)}">${escapeXml(title)}</text><g data-slot="code-block" data-code-block-base="rareui" clip-path="url(#terminal-code-block-clip)"><rect x="${CODE_BLOCK.x}" y="${CODE_BLOCK.y}" width="${CODE_BLOCK.width}" height="${CODE_BLOCK.height}" fill="${RARE_UI_THEME.background}"/><rect data-slot="code-block-header" x="${CODE_BLOCK.x}" y="${CODE_BLOCK.y}" width="${CODE_BLOCK.width}" height="${CODE_BLOCK.headerHeight}" fill="${RARE_UI_THEME.header}"/><line x1="${CODE_BLOCK.x}" y1="${headerBottom}" x2="${CODE_BLOCK.x + CODE_BLOCK.width}" y2="${headerBottom}" stroke="${RARE_UI_THEME.border}"/>${languageIcon}<text x="132" y="181" fill="${RARE_UI_THEME.muted}" font-family="${fontFamily('StudioTerminalCode', codeFontData, codeFontFamily)}" font-size="15" font-weight="${capVisibleFontWeight(codeFontWeight)}">${languageLabel}</text><rect x="1060" y="154" width="52" height="40" rx="11" fill="${RARE_UI_THEME.floating}" stroke="${RARE_UI_THEME.border}"/>${copyIcon()}${codeSvg}</g><rect x="${CODE_BLOCK.x}" y="${CODE_BLOCK.y}" width="${CODE_BLOCK.width}" height="${CODE_BLOCK.height}" rx="${CODE_BLOCK.radius}" fill="none" stroke="${RARE_UI_THEME.border}"/><path d="M92 ${frameBottom - 20}H1108" stroke="${RARE_UI_THEME.accent}" stroke-opacity="0.14"/></svg>`;
}
