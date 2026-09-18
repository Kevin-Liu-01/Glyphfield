/** UTF-16 offsets match the browser Selection/Range APIs. Plain text stays canonical. */
export type TextSelectionRange = { start: number; end: number; backward?: boolean };
export type InlineTextStyle = {
  color?: string;
  fontRole?: 'Display' | 'Body' | 'Accent' | 'Code';
  fontSize?: number;
  weight?: number;
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  strikethrough?: boolean;
  tracking?: number;
};
export type TextStyleRun = TextSelectionRange & { style: InlineTextStyle };
export type ResolvedTextStyle = {
  color: string; fontFamily: string; fontSize: number; fontStyle: 'normal' | 'italic';
  fontWeight: number; tracking: number; underline: boolean; strikethrough: boolean;
};
export type ResolvedTextSegment = TextSelectionRange & { style: ResolvedTextStyle };
export const INLINE_TEXT_KEYS = ['color', 'fontRole', 'fontSize', 'weight', 'fontStyle', 'underline', 'strikethrough', 'tracking'] as const;

function sameStyle(a: InlineTextStyle, b: InlineTextStyle) {
  return INLINE_TEXT_KEYS.every((key) => a[key] === b[key]);
}

export function textStyleSegments(value: string, runs: readonly TextStyleRun[] = []): TextStyleRun[] {
  const points = [...new Set([0, value.length, ...runs.flatMap(({ start, end }) => [start, end])])]
    .filter((point) => point >= 0 && point <= value.length).sort((a, b) => a - b);
  return points.slice(0, -1).map((start, index) => ({
    start, end: points[index + 1],
    style: Object.assign({}, ...runs.filter((run) => run.start <= start && run.end > start).map(({ style }) => style)),
  }));
}

function compactRuns(runs: TextStyleRun[]): TextStyleRun[] {
  const result: TextStyleRun[] = [];
  for (const run of runs) {
    if (run.end <= run.start || !Object.keys(run.style).length) continue;
    const last = result.at(-1);
    if (last && last.end === run.start && sameStyle(last.style, run.style)) last.end = run.end;
    else result.push({ ...run, style: { ...run.style } });
  }
  return result;
}

export function formatTextRange(value: string, runs: readonly TextStyleRun[] | undefined, range: TextSelectionRange, patch: InlineTextStyle): TextStyleRun[] {
  const start = Math.max(0, Math.min(value.length, range.start));
  const end = Math.max(start, Math.min(value.length, range.end));
  return compactRuns(textStyleSegments(value, [...(runs ?? []), { start, end, style: patch }]));
}

function selectionExplainsEdit(previous: string, next: string, selection: TextSelectionRange) {
  return next.startsWith(previous.slice(0, selection.start)) && next.endsWith(previous.slice(selection.end))
    && next.length >= selection.start + previous.length - selection.end;
}

/** Preserve unaffected formatting, and let inserted text inherit its insertion point. */
export function editTextRuns(previous: string, next: string, runs: readonly TextStyleRun[] | undefined, selection?: TextSelectionRange | null): TextStyleRun[] | undefined {
  if (!runs?.length || previous === next) return runs ? [...runs] : undefined;
  let start = 0;
  while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
  let oldEnd = previous.length;
  let newEnd = next.length;
  while (oldEnd > start && newEnd > start && previous[oldEnd - 1] === next[newEnd - 1]) { oldEnd--; newEnd--; }
  // Repeated characters make a string diff ambiguous. Prefer the browser's
  // actual replacement range when it explains the edit (including plain paste).
  if (selection && selectionExplainsEdit(previous, next, selection)) {
    start = selection.start;
    oldEnd = selection.end;
    newEnd = next.length - (previous.length - oldEnd);
  }
  const delta = newEnd - oldEnd;
  const insertionPoint = oldEnd > start ? start : Math.max(0, start - 1);
  const inherited = textStyleSegments(previous, runs).find((run) => run.start <= insertionPoint && run.end > insertionPoint)?.style ?? {};
  const result: TextStyleRun[] = [];
  for (const run of runs) {
    if (run.start < start) result.push({ ...run, end: Math.min(run.end, start) });
    if (run.end > oldEnd) result.push({ ...run, start: Math.max(run.start, oldEnd) + delta, end: run.end + delta });
  }
  if (newEnd > start) result.push({ start, end: newEnd, style: inherited });
  return compactRuns(result.sort((a, b) => a.start - b.start));
}

export function clearTextStyleProperties(runs: readonly TextStyleRun[] | undefined, patch: InlineTextStyle): TextStyleRun[] | undefined {
  if (!runs) return undefined;
  return compactRuns(runs.map((run) => {
    const style = { ...run.style };
    for (const key of INLINE_TEXT_KEYS) if (patch[key] !== undefined) delete style[key];
    return { ...run, style };
  }));
}

function validateInlineTextStyle(style: Record<string, unknown>) {
  for (const key of Object.keys(style)) if (!INLINE_TEXT_KEYS.includes(key as keyof InlineTextStyle)) throw new TypeError(`Unsupported text run style: ${key}.`);
  if (style.fontRole !== undefined && !['Display', 'Body', 'Accent', 'Code'].includes(String(style.fontRole))) throw new TypeError('Text run fontRole is unsupported.');
  if (style.fontStyle !== undefined && !['normal', 'italic'].includes(String(style.fontStyle))) throw new TypeError('Text run fontStyle is unsupported.');
  for (const key of ['underline', 'strikethrough']) if (style[key] !== undefined && typeof style[key] !== 'boolean') throw new TypeError(`Text run ${key} must be Boolean.`);
  for (const [key, min, max] of [['fontSize', Number.MIN_VALUE, 1_000_000], ['weight', 1, 1000], ['tracking', -10, 100]] as const) {
    const value = style[key];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)) throw new TypeError(`Text run ${key} is out of range.`);
  }
  if (style.color !== undefined && (typeof style.color !== 'string' || !style.color.trim() || style.color.length > 128 || /[;{}<>]/.test(style.color))) throw new TypeError('Text run color must be a color value.');
}

export function validateTextStyleRuns(value: unknown, text: string): asserts value is TextStyleRun[] | undefined {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length > 10000) throw new TypeError('Text runs must be an array of at most 10000 ranges.');
  let previousEnd = 0;
  for (const run of value) {
    if (!run || !Number.isInteger(run.start) || !Number.isInteger(run.end) || run.start < previousEnd || run.end <= run.start || run.end > text.length) throw new TypeError('Text runs must be ordered, non-overlapping ranges within the text.');
    previousEnd = run.end;
    const style = run.style;
    if (!style || typeof style !== 'object' || Array.isArray(style)) throw new TypeError('Text run style must be an object.');
    validateInlineTextStyle(style);
  }
}
