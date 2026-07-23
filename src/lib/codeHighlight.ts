import Prism from 'prismjs';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';

export type CodeLanguage = 'bash' | 'python' | 'typescript';

export type HighlightedToken = {
  color: string;
  content: string;
};

export type HighlightedLine = {
  kind: 'code' | 'success';
  tokens: HighlightedToken[];
};

export const CODE_THEME = {
  background: '#0D1117',
  border: '#30363D',
  foreground: '#E6EDF3',
  gutter: '#6E7681',
  success: '#3FB950',
} as const;

const TOKEN_COLORS: Readonly<Record<string, string>> = {
  'attr-name': '#79C0FF',
  boolean: '#79C0FF',
  builtin: '#FFA657',
  'class-name': '#FFA657',
  comment: '#8B949E',
  constant: '#79C0FF',
  function: '#D2A8FF',
  keyword: '#FF7B72',
  number: '#79C0FF',
  operator: '#FF7B72',
  property: '#79C0FF',
  punctuation: '#8B949E',
  regex: '#A5D6FF',
  string: '#A5D6FF',
  variable: '#FFA657',
};

function tokenColor(token: Prism.Token, inheritedColor: string): string {
  const aliases = Array.isArray(token.alias)
    ? token.alias
    : token.alias
      ? [token.alias]
      : [];

  for (const type of [token.type, ...aliases]) {
    const color = TOKEN_COLORS[type];
    if (color) return color;
  }

  return inheritedColor;
}

function appendContent(
  content: string,
  color: string,
  lines: HighlightedLine[]
) {
  const chunks = content.split('\n');

  chunks.forEach((chunk, index) => {
    const line = lines.at(-1)!;
    if (chunk) line.tokens.push({ color, content: chunk });
    if (index < chunks.length - 1) lines.push({ kind: 'code', tokens: [] });
  });
}

function appendToken(
  value: Prism.Token | string,
  inheritedColor: string,
  lines: HighlightedLine[]
) {
  if (typeof value === 'string') {
    appendContent(value, inheritedColor, lines);
    return;
  }

  const color = tokenColor(value, inheritedColor);
  const contents = Array.isArray(value.content) ? value.content : [value.content];
  for (const content of contents) appendToken(content, color, lines);
}

export function highlightCode(code: string, language: CodeLanguage): HighlightedLine[] {
  const grammar = Prism.languages[language] ?? Prism.languages.plain;
  const lines: HighlightedLine[] = [{ kind: 'code', tokens: [] }];

  for (const token of Prism.tokenize(code, grammar)) {
    appendToken(token, CODE_THEME.foreground, lines);
  }

  return lines.map((line) => {
    const content = line.tokens.map((token) => token.content).join('');
    if (language === 'bash' && content.trimStart().startsWith('✓')) {
      return {
        kind: 'success',
        tokens: [{ color: CODE_THEME.success, content }],
      };
    }
    return line;
  });
}
