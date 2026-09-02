export function stringifySource(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export type SourceTextDiagnostic = {
  column: number | null;
  line: number | null;
  message: string;
  normalized: boolean;
  position: number | null;
  source: string;
  valid: boolean;
};

const NON_JSON_SPACE = /[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u2060\u3000\uFEFF]/;
const FENCE_PADDING = '[\\t \\u00A0\\u1680\\u180E\\u2000-\\u200B\\u202F\\u205F\\u2060\\u3000\\uFEFF]';

function blankText(value: string): string {
  return value.replace(/[^\r\n]/g, ' ');
}

function normalizeMarkdownFence(source: string): string {
  const opening = new RegExp(`^(${FENCE_PADDING}*\`\`\`(?:json|jsonc|javascript|js)?[^\\r\\n]*)(\\r?\\n)`, 'i').exec(source);
  if (!opening) return source;
  const closing = new RegExp(`(\\r?\\n)(${FENCE_PADDING}*\`\`\`${FENCE_PADDING}*)$`).exec(source);
  if (!closing) return source;

  const openingEnd = opening[1].length;
  const closingStart = closing.index + closing[1].length;
  return `${blankText(source.slice(0, openingEnd))}${source.slice(openingEnd, closingStart)}${blankText(source.slice(closingStart))}`;
}

type JsonStringState = {
  escaped: boolean;
  inside: boolean;
};

function normalizeJsonStringCharacter(character: string, state: JsonStringState): string | null {
  if (!state.inside) return null;
  if (state.escaped) state.escaped = false;
  else if (character === '\\') state.escaped = true;
  else if (character === '"') state.inside = false;
  return character;
}

function normalizeJsonWhitespaceCharacter(character: string, state: JsonStringState): string {
  if (character === '"') {
    state.inside = true;
    return character;
  }
  if (character === '\u2028' || character === '\u2029') return '\n';
  return NON_JSON_SPACE.test(character) ? ' ' : character;
}

/**
 * Makes source copied from rich text safe for JSON.parse without changing any
 * characters inside JSON strings. The returned string keeps the same length
 * and line layout so diagnostics still point at the pasted editor position.
 */
export function normalizeSourceText(source: string): string {
  const unfenced = normalizeMarkdownFence(source);
  let normalized = '';
  const state: JsonStringState = { escaped: false, inside: false };

  for (const character of unfenced) {
    normalized += normalizeJsonStringCharacter(character, state)
      ?? normalizeJsonWhitespaceCharacter(character, state);
  }

  return normalized;
}

function indexFromLineColumn(source: string, line: number, column: number): number {
  const lines = source.split('\n');
  let index = 0;
  for (let currentLine = 1; currentLine < line; currentLine += 1) {
    index += (lines[currentLine - 1]?.length ?? 0) + 1;
  }
  return Math.min(source.length, index + Math.max(0, column - 1));
}

function lineColumnFromIndex(source: string, position: number) {
  const before = source.slice(0, Math.max(0, Math.min(source.length, position)));
  const lines = before.split('\n');
  return {
    column: lines.at(-1)!.length + 1,
    line: lines.length,
  };
}

function syntaxDiagnostic(error: unknown, source: string, normalized: boolean): SourceTextDiagnostic {
  const rawMessage = error instanceof Error ? error.message : 'The source is not valid JSON.';
  const lineMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(rawMessage);
  const positionMatch = /position\s+(\d+)/i.exec(rawMessage);
  let line = lineMatch ? Number(lineMatch[1]) : null;
  let column = lineMatch ? Number(lineMatch[2]) : null;
  let position = positionMatch ? Number(positionMatch[1]) : null;

  if (position === null && line !== null && column !== null) {
    position = indexFromLineColumn(source, line, column);
  }
  if ((line === null || column === null) && position !== null) {
    ({ column, line } = lineColumnFromIndex(source, position));
  }

  const reason = rawMessage
    .replace(/\s+in JSON at position\s+\d+.*/i, '')
    .replace(/\s+at position\s+\d+.*/i, '')
    .replace(/\s*\(line\s+\d+\s+column\s+\d+\)\s*$/i, '')
    .trim();
  const location = line !== null && column !== null
    ? `Line ${line}, column ${column}`
    : 'JSON syntax error';

  return {
    column,
    line,
    message: `${location} — ${reason || 'The source is not valid JSON.'}`,
    normalized,
    position,
    source,
    valid: false,
  };
}

export function inspectSourceText(value: string): SourceTextDiagnostic {
  const source = normalizeSourceText(value);
  const normalized = source !== value;
  try {
    JSON.parse(source);
    return {
      column: null,
      line: null,
      message: normalized ? 'Valid JSON · pasted spacing normalized' : 'Valid JSON',
      normalized,
      position: null,
      source,
      valid: true,
    };
  } catch (error) {
    return syntaxDiagnostic(error, source, normalized);
  }
}

function parseSourceValue(source: string): unknown {
  const diagnostic = inspectSourceText(source);
  if (!diagnostic.valid) throw new SyntaxError(diagnostic.message);
  return JSON.parse(diagnostic.source) as unknown;
}

export function formatSource(source: string): string {
  return stringifySource(parseSourceValue(source));
}

export function parseSourceObject(source: string): Record<string, unknown> {
  const value = parseSourceValue(source);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Source must contain a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function sourceString(
  value: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  return typeof value[key] === 'string' ? value[key] : fallback;
}

export function sourceNumber(
  value: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  return typeof value[key] === 'number' && Number.isFinite(value[key])
    ? value[key]
    : fallback;
}

export function sourceBoolean(
  value: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  return typeof value[key] === 'boolean' ? value[key] : fallback;
}

export function sourceObject(
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const nested = value[key];
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : null;
}

export function sourceStringArray(
  value: Record<string, unknown>,
  key: string,
  fallback: string[]
): string[] {
  const nested = value[key];
  return Array.isArray(nested) && nested.every((item) => typeof item === 'string')
    ? nested
    : fallback;
}

export function sourceObjectArray(
  value: Record<string, unknown>,
  key: string
): Record<string, unknown>[] | null {
  const nested = value[key];
  return Array.isArray(nested) && nested.every(
    (item) => item && typeof item === 'object' && !Array.isArray(item)
  )
    ? (nested as Record<string, unknown>[])
    : null;
}
