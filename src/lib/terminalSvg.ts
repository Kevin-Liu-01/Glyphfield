import { CODE_THEME, highlightCode, type CodeLanguage } from './codeHighlight';
import { escapeXml } from './download';
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
    .slice(0, 12)
    .map((line, index) => {
      const tokens = line.tokens.length > 0
        ? line.tokens.map(({ color, content }) => (
            `<tspan fill="${color}">${escapeXml(content)}</tspan>`
          )).join('')
        : '<tspan> </tspan>';
      return `<text x="92" y="${236 + index * 34}" fill="${CODE_THEME.foreground}" font-family="${fontFamily('StudioTerminalCode', codeFontData, codeFontFamily)}" font-size="21" font-weight="${capVisibleFontWeight(codeFontWeight)}" xml:space="preserve">${tokens}</text>`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs>${fontDefinitions}</defs><rect width="1200" height="630" fill="${CODE_THEME.background}"/>${assetLayer}<text x="72" y="90" fill="${CODE_THEME.foreground}" font-family="${fontFamily('StudioTerminalTitle', titleFontData, titleFontFamily)}" font-size="42" font-weight="${capVisibleFontWeight(titleFontWeight)}">${escapeXml(title)}</text><text x="72" y="136" fill="${CODE_THEME.gutter}" font-family="${fontFamily('StudioTerminalCode', codeFontData, codeFontFamily)}" font-size="17" font-weight="${capVisibleFontWeight(codeFontWeight)}">${escapeXml(language.toLocaleUpperCase())}</text><rect x="72" y="174" width="1056" height="388" rx="8" fill="${CODE_THEME.background}" stroke="${CODE_THEME.border}"/>${codeSvg}</svg>`;
}
