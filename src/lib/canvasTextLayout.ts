import type { CanvasTextAlign, CanvasTextWrap } from './canvasText';
import type { ResolvedTextSegment, ResolvedTextStyle } from './richText';

type TextTypography = {
  align: CanvasTextAlign;
  fontFamily: string;
  fontSize: string;
  fontStyle: 'normal' | 'italic';
  fontWeight: number;
  lineHeight: number;
  tracking: number;
  wrap: CanvasTextWrap;
};

/** One typography contract for the editable canvas and browser-native layout. */
export function canvasTextTypography(options: TextTypography) {
  return {
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    fontStyle: options.fontStyle,
    fontWeight: String(options.fontWeight),
    fontKerning: 'normal' as const,
    // View/export scale must not select a different variable-font optical size.
    fontOpticalSizing: 'none' as const,
    justifyContent: options.align === 'left' ? 'flex-start' : options.align === 'right' ? 'flex-end' : 'center',
    letterSpacing: `${options.tracking}em`,
    lineHeight: String(options.lineHeight),
    overflowWrap: options.wrap === 'wrap' ? 'anywhere' as const : 'normal' as const,
    textAlign: options.align,
    whiteSpace: options.wrap === 'wrap' ? 'pre-wrap' as const : 'pre' as const,
  };
}

type NativeTextLine = { value: string; x: number; baseline: number; style?: ResolvedTextStyle };
export type NativeCanvasTextLayout = {
  lines: NativeTextLine[];
  height: number;
  offsetY: number;
};

const layouts = new Map<string, NativeCanvasTextLayout>();
let observedFonts: FontFaceSet | undefined;

/** Select the painted fragment, not Safari's extra caret at the previous line. */
export function canvasTextRangeRect(range: Pick<Range, 'getClientRects' | 'getBoundingClientRect'>): DOMRect {
  const rects = range.getClientRects();
  for (let index = 0; index < rects.length; index += 1) {
    const rect = rects[index]!;
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  // Preserve zero-width whitespace/newline geometry when there is no ink.
  return range.getBoundingClientRect();
}

function textLines(text: HTMLElement, origin: DOMRect, ascent: number, runs?: Map<Node, { ascent: number; style: ResolvedTextStyle }>): NativeTextLine[] {
  const lines: NativeTextLine[] = [];
  const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    // Read where the browser placed the text, including hyphen/CJK/NBSP breaks,
    // blank lines, and hanging whitespace. Never re-wrap or rewrite paragraphs.
    const value = node.textContent!;
    const run = runs?.get(node);
    for (let index = 0; index < value.length; index += 1) {
      range.setStart(node, index);
      range.setEnd(node, index + 1);
      const rect = canvasTextRangeRect(range);
      if (!rect.height) continue;
      const baseline = rect.top - origin.top + (run?.ascent ?? ascent);
      const x = rect.left - origin.left;
      const previous = lines.at(-1);
      if (previous && previous.style === run?.style && Math.abs(previous.baseline - baseline) < 0.5) {
        previous.value += value[index];
        previous.x = Math.min(previous.x, x);
      } else {
        lines.push({ value: value[index], x, baseline, ...(run ? { style: run.style } : {}) });
      }
    }
  }
  return lines;
}

function nativeTextAscent(host: HTMLElement, typography: ReturnType<typeof canvasTextTypography>): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'all:initial;position:absolute;left:0;top:0;white-space:pre;';
  Object.assign(probe.style, typography);
  probe.style.whiteSpace = 'pre';
  const sample = document.createTextNode('Mg');
  const baseline = document.createElement('i');
  baseline.style.cssText = 'all:initial;display:inline-block;width:0;height:0;vertical-align:baseline;';
  probe.append(sample, baseline);
  host.append(probe);
  const range = document.createRange();
  range.selectNode(sample);
  // Unlike Canvas TextMetrics, the inline marker exposes the browser's actual
  // fractional baseline, without resolution-dependent ascent rounding.
  return baseline.getBoundingClientRect().top - range.getBoundingClientRect().top;
}

/** Browser renderer boundary. Measure in authored pixels, never export pixels. */
export function layoutNativeCanvasText(options: Omit<TextTypography, 'fontSize'> & {
  boxHeight: number;
  boxWidth: number;
  fontSize: number;
  value: string;
  runs?: ResolvedTextSegment[];
}): NativeCanvasTextLayout {
  if (observedFonts !== document.fonts) {
    observedFonts = document.fonts;
    layouts.clear();
    observedFonts?.addEventListener('loadingdone', () => layouts.clear());
    observedFonts?.addEventListener('loadingerror', () => layouts.clear());
  }
  const key = JSON.stringify(options);
  const cached = layouts.get(key);
  if (cached) return cached;
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = 'all:initial;position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;display:grid;place-items:center;contain:layout style;';
  host.style.width = `${options.boxWidth}px`;
  host.style.height = `${options.boxHeight}px`;
  const text = document.createElement('span');
  text.style.cssText = 'all:initial;display:flex;width:100%;min-width:0;min-height:1em;align-items:center;overflow:visible;word-break:normal;';
  const typography = canvasTextTypography({ ...options, fontSize: `${options.fontSize}px` });
  Object.assign(text.style, typography);
  // Same native insertion as CanvasEditableText, including trailing newlines.
  const runs = new Map<Node, { ascent: number; style: ResolvedTextStyle }>();
  if (options.runs?.length) {
    text.style.display = 'block';
    for (const run of options.runs) {
      const span = document.createElement('span');
      Object.assign(span.style, canvasTextTypography({ ...options, ...run.style, fontSize: `${run.style.fontSize}px` }));
      span.textContent = options.value.slice(run.start, run.end);
      text.append(span);
    }
  } else text.innerText = options.value;
  host.append(text);
  document.body.append(host);
  try {
    const origin = host.getBoundingClientRect();
    const bounds = text.getBoundingClientRect();
    const ascent = nativeTextAscent(host, typography);
    options.runs?.forEach((run, index) => {
      const node = text.children[index]?.firstChild;
      if (node) runs.set(node, { style: run.style, ascent: nativeTextAscent(host, canvasTextTypography({ ...options, ...run.style, fontSize: `${run.style.fontSize}px` })) });
    });
    const layout = { lines: textLines(text, origin, ascent, runs), height: bounds.height, offsetY: bounds.top - origin.top };
    // Motion/effect frames reuse layout; loaded/replaced fonts invalidate it.
    if (layouts.size >= 128) layouts.delete(layouts.keys().next().value!);
    layouts.set(key, layout);
    return layout;
  } finally {
    host.remove();
  }
}
