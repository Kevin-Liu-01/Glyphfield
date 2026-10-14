import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import interDisplay600 from '../../public/og/inter-display-600.json';
import interText400 from '../../public/og/inter-text-400.json';
import interText500 from '../../public/og/inter-text-500.json';

/**
 * Glyphfield's own social preview cards: home, Studio, every docs page and `/api/og`.
 *
 * next/og (Satori) cannot read Inter Variable, so `public/og/` holds static Inter cuts that
 * `scripts/generate-og-fonts.py` makes, with each cut's advance widths and kerning pairs.
 * Satori draws kerned glyphs but places words by their unkerned width, which leaves a wide gap
 * after any kerned word. The typesetter below measures text with the same metrics, sets each word
 * segment Satori draws as its own box and gives that box a right margin that restores the kerned
 * advance. It also wraps headlines into balanced lines and picks the largest size that fits.
 */

export const OPEN_GRAPH_IMAGE_SIZE = { height: 630, width: 1200 } as const;
/** X shows `summary_large_image` cards at 2:1. */
export const TWITTER_IMAGE_SIZE = { height: 600, width: 1200 } as const;
export const DEFAULT_OPEN_GRAPH_ACCENT = '#7058FF';

type FontMetrics = {
  advances: Readonly<Record<string, number>>;
  kerning: Readonly<Record<string, Readonly<Record<string, number>>>>;
  unitsPerEm: number;
};

type TypeFace = {
  family: string;
  file: string;
  metrics: FontMetrics;
  weight: 400 | 500 | 600;
};

type TypeStyle = {
  face: TypeFace;
  lineHeight: number;
  size: number;
  /** Letter spacing in em. */
  tracking: number;
};

type Piece = {
  highlighted: boolean;
  marginRight: number;
  text: string;
};

type Word = {
  pieces: Piece[];
  text: string;
  /** Width of the space that follows the word. */
  space: number;
  width: number;
};

export type TypesetBlock = {
  lines: Word[][];
  style: TypeStyle;
};

const DISPLAY_FACE: TypeFace = { family: 'Inter Display', file: 'inter-display-600.ttf', metrics: interDisplay600, weight: 600 };
const TEXT_FACE: TypeFace = { family: 'Inter', file: 'inter-text-400.ttf', metrics: interText400, weight: 400 };
const TEXT_MEDIUM_FACE: TypeFace = { family: 'Inter', file: 'inter-text-500.ttf', metrics: interText500, weight: 500 };
const FACES = [DISPLAY_FACE, TEXT_FACE, TEXT_MEDIUM_FACE] as const;

/** The landing page's dark tokens: paper, ink, muted, line and the violet family. */
const COLORS = {
  canvas: '#111111',
  fieldGround: '#201046',
  fieldHigh: '#C8C0FF',
  ink: '#F0F0ED',
  line: '#333331',
  muted: '#A5A5A0',
} as const;

const WIDTH = OPEN_GRAPH_IMAGE_SIZE.width;
const MARGIN = 64;
const TOP = 56;
const BOTTOM = 44;
const FOOTER_HEIGHT = 76;
const PLATE_WIDTH = 432;
const COLUMN_WIDTH = WIDTH - PLATE_WIDTH - MARGIN * 2;
const LOCKUP_HEIGHT = 40;
const HEADLINE_GAP = 48;
const LEAD_GAP = 22;
const SCREENSHOT_INSET = 40;
/** Size of public/og/studio-design-lab.jpg. It fills the plate below the lockup line on the 630 px card. */
const SCREENSHOT_SIZE = { height: 498, width: PLATE_WIDTH - SCREENSHOT_INSET } as const;

const HEADLINE_SIZES = [96, 92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52] as const;
/** A title that fits two lines at this size or larger gets two lines rather than three bigger ones. */
const TWO_LINE_MIN_SIZE = 72;
const HEADLINE_LINE_HEIGHT = 1;
const HEADLINE_TRACKING = -0.022;
const LEAD_STYLE: TypeStyle = { face: TEXT_FACE, lineHeight: 1.36, size: 25, tracking: -0.006 };
const LEAD_MAX_LINES = 3;
const FOOTER_STYLE: TypeStyle = { face: TEXT_FACE, lineHeight: 1.2, size: 22, tracking: -0.004 };
const FOOTER_NOTE_STYLE: TypeStyle = { ...FOOTER_STYLE, face: TEXT_MEDIUM_FACE };
const LOCKUP_STYLE: TypeStyle = { face: TEXT_MEDIUM_FACE, lineHeight: 1, size: 30, tracking: -0.014 };

const MARK_FRAME_PATH = 'M6 6H58V22H48V16H16V48H48V40H58V58H6Z';
const MARK_BOLT_PATH = 'M33 24.5H50L46 29.5H61L42 42.5L46 35.5H30L34 30H25Z';

const DITHER_CELL = 6;
const SWIRL = { centerX: 0.42, centerY: 0.5, highLevel: 1.4, scale: 168, time: 0.8 } as const;
const BAYER_8X8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
] as const;

const wordSegmenter = new Intl.Segmenter('en', { granularity: 'word' });

function readOpenGraphAsset(file: string) {
  return readFile(resolve(process.cwd(), 'public/og', file));
}

let fontsPromise: Promise<{ data: ArrayBuffer; name: string; style: 'normal'; weight: TypeFace['weight'] }[]> | undefined;
let screenshotPromise: Promise<string> | undefined;

/** The static Inter cuts every Glyphfield preview route passes to `ImageResponse`, read once. */
export function getBrandOpenGraphFonts() {
  fontsPromise ??= Promise.all(FACES.map(async (face) => {
    const data = await readOpenGraphAsset(face.file);
    return {
      data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
      name: face.family,
      style: 'normal' as const,
      weight: face.weight,
    };
  }));
  return fontsPromise;
}

/** The real Studio capture (Design Lab, dark theme) that the Studio card shows, as a data URL. */
export function getStudioScreenshot() {
  screenshotPromise ??= readOpenGraphAsset('studio-design-lab.jpg')
    .then((data) => `data:image/jpeg;base64,${data.toString('base64')}`);
  return screenshotPromise;
}

/** Shortens text to `maxLength` characters at its last whole word, ending with an ellipsis. */
export function truncateAtWord(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const cut = value.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

function advanceOf(metrics: FontMetrics, character: string) {
  return metrics.advances[character] ?? metrics.advances['n'] ?? metrics.unitsPerEm * 0.55;
}

function kerningOf(metrics: FontMetrics, left: string, right: string | undefined) {
  return right ? metrics.kerning[left]?.[right] ?? 0 : 0;
}

/**
 * Splits a word into the segments Satori draws one at a time. Satori makes each segment's box
 * as wide as its unkerned advance, rounded up; the margin moves the next segment to the kerned
 * position, including the pair across the segment boundary.
 */
function setWord(word: string, style: TypeStyle, highlightFrom: number, offset: number): Word {
  const { metrics } = style.face;
  const scale = style.size / metrics.unitsPerEm;
  const tracking = style.tracking * style.size;
  const segments = Array.from(wordSegmenter.segment(word), ({ segment }) => segment);
  const pieces: Piece[] = [];
  let position = offset;
  let width = 0;

  segments.forEach((segment, index) => {
    const characters = Array.from(segment);
    const following = segments[index + 1]?.[0];
    let measured = 0;
    let kerning = 0;
    characters.forEach((character, characterIndex) => {
      measured += advanceOf(metrics, character) * scale + tracking;
      kerning += kerningOf(metrics, character, characters[characterIndex + 1] ?? following) * scale;
    });
    pieces.push({
      highlighted: highlightFrom >= 0 && position >= highlightFrom,
      marginRight: measured + kerning - Math.ceil(measured),
      text: segment,
    });
    position += segment.length;
    width += measured + kerning;
  });

  return { pieces, space: advanceOf(metrics, ' ') * scale + tracking, text: word, width };
}

function setWords(text: string, style: TypeStyle, highlightFrom = -1, offset = 0): Word[] {
  const words: Word[] = [];
  let position = offset;
  for (const word of text.split(' ')) {
    if (word) words.push(setWord(word, style, highlightFrom, position));
    position += word.length + 1;
  }
  return words;
}

function lineWidth(line: readonly Word[]) {
  return line.reduce((total, word, index) => total + word.width + (index ? line[index - 1]!.space : 0), 0);
}

function wrapGreedy(words: readonly Word[], maxWidth: number): Word[][] {
  const lines: Word[][] = [];
  let line: Word[] = [];
  for (const word of words) {
    if (line.length && lineWidth([...line, word]) > maxWidth) {
      lines.push(line);
      line = [];
    }
    line.push(word);
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Wraps to the fewest lines that fit, then narrows the measure until the lines are even. */
function wrapBalanced(words: readonly Word[], maxWidth: number): Word[][] {
  const lineCount = wrapGreedy(words, maxWidth).length;
  let narrow = Math.max(0, ...words.map((word) => word.width));
  let wide = Math.max(narrow, maxWidth);
  while (wide - narrow > 0.5) {
    const middle = (narrow + wide) / 2;
    if (wrapGreedy(words, middle).length > lineCount) narrow = middle;
    else wide = middle;
  }
  return wrapGreedy(words, wide);
}

export function blockHeight(block: TypesetBlock) {
  return block.lines.length * Math.round(block.style.size * block.style.lineHeight);
}

export function blockWidth(block: TypesetBlock) {
  return Math.max(0, ...block.lines.map(lineWidth));
}

type HeadlineFrame = {
  highlightedTitle?: string;
  maxHeight: number;
  maxWidth: number;
  title: string;
};

/**
 * Sets the title at the largest size whose balanced lines fit the frame. Two lines at 72 px or more
 * win over three larger lines, and three lines win over four. A highlighted phrase starts its own
 * line, as it does in the landing hero, and both parts stay on one line each when any size allows it.
 */
export function fitHeadline({ highlightedTitle, maxHeight, maxWidth, title }: HeadlineFrame): TypesetBlock {
  const highlightFrom = highlightedTitle ? title.indexOf(highlightedTitle) : -1;
  const blocks = HEADLINE_SIZES.map((size): TypesetBlock => {
    const style: TypeStyle = { face: DISPLAY_FACE, lineHeight: HEADLINE_LINE_HEIGHT, size, tracking: HEADLINE_TRACKING };
    const parts = highlightFrom > 0
      ? [setWords(title.slice(0, highlightFrom), style), setWords(title.slice(highlightFrom), style, highlightFrom, highlightFrom)]
      : [setWords(title, style, highlightFrom)];
    return { lines: parts.flatMap((words) => wrapBalanced(words, maxWidth)), style };
  });
  const fitting = blocks.filter((block) => blockWidth(block) <= maxWidth && blockHeight(block) <= maxHeight);
  const preferences = [
    ({ lines, style }: TypesetBlock) => lines.length <= 2 && (highlightFrom > 0 || style.size >= TWO_LINE_MIN_SIZE),
    ({ lines }: TypesetBlock) => lines.length <= 3,
  ];

  for (const preferred of preferences) {
    const block = fitting.find(preferred);
    if (block) return block;
  }
  return fitting[0] ?? blocks[blocks.length - 1]!;
}

/** Sets running text in at most `maxLines` balanced lines and ends a cut line with an ellipsis. */
function setParagraph(text: string, style: TypeStyle, maxWidth: number, maxLines: number): TypesetBlock {
  const lines = wrapBalanced(setWords(text, style), maxWidth);
  if (lines.length <= maxLines) return { lines, style };

  const kept = wrapGreedy(setWords(text, style), maxWidth).slice(0, maxLines);
  const last = kept[maxLines - 1]!;
  const ellipsis = setWord('…', style, -1, 0);
  while (last.length > 1 && lineWidth(last) + ellipsis.width > maxWidth) last.pop();
  // The ellipsis follows the last word directly, after any trailing punctuation is dropped.
  const lastText = last[last.length - 1]!.text.replace(/[,.;:]+$/, '');
  last[last.length - 1] = { ...setWord(lastText, style, -1, 0), space: 0 };
  last.push(ellipsis);
  return { lines: kept, style };
}

function TypesetText({ accent, block, color }: { accent?: string; block: TypesetBlock; color: string }) {
  const { face, lineHeight, size, tracking } = block.style;
  const lineBox = Math.round(size * lineHeight);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {block.lines.map((line, lineIndex) => (
        <div key={lineIndex} style={{ display: 'flex', height: lineBox }}>
          {line.flatMap((word, wordIndex) => word.pieces.map((piece, pieceIndex) => {
            const space = pieceIndex === word.pieces.length - 1 && wordIndex < line.length - 1 ? word.space : 0;
            return (
              <div
                key={`${wordIndex}-${pieceIndex}`}
                style={{
                  color: piece.highlighted && accent ? accent : color,
                  display: 'flex',
                  flexShrink: 0,
                  fontFamily: face.family,
                  fontSize: size,
                  fontWeight: face.weight,
                  letterSpacing: tracking * size,
                  lineHeight: `${lineBox}px`,
                  marginRight: piece.marginRight + space,
                  whiteSpace: 'pre',
                }}
              >
                {piece.text}
              </div>
            );
          }))}
        </div>
      ))}
    </div>
  );
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const normalized = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return normalized * normalized * (3 - 2 * normalized);
}

/**
 * One frame of the Paper dithering swirl (8×8 Bayer) that the landing hero and the Studio's
 * default animation use, as one SVG path of square cells. `level` 1 is the shader's own
 * threshold; a higher level keeps only the densest cells, for a second, lighter tone.
 */
function buildDitheredSwirlPath(width: number, height: number, level = 1): string {
  const cells: string[] = [];
  const columns = Math.ceil(width / DITHER_CELL);
  const rows = Math.ceil(height / DITHER_CELL);

  const lit = (row: number, column: number) => {
    const x = (column * DITHER_CELL + DITHER_CELL / 2 - width * SWIRL.centerX) / SWIRL.scale;
    const y = (row * DITHER_CELL + DITHER_CELL / 2 - height * SWIRL.centerY) / SWIRL.scale;
    const length = Math.max(0.000001, Math.hypot(x, y));
    const twist = 1.2;
    const angle = 6 * Math.atan2(y, x) + 4 * SWIRL.time;
    const offset = 1 / Math.pow(length, twist) + angle / (Math.PI * 2);
    const middle = smoothstep(0, 1, Math.pow(length, twist));
    const shape = (offset - Math.floor(offset)) * middle;
    return shape + BAYER_8X8[(row % 8) * 8 + (column % 8)]! / 64 >= level;
  };

  // Neighboring lit cells in a row share one rectangle, which keeps the path short.
  for (let row = 0; row < rows; row += 1) {
    let runStart = -1;
    for (let column = 0; column <= columns; column += 1) {
      const on = column < columns && lit(row, column);
      if (on && runStart < 0) runStart = column;
      if (on || runStart < 0) continue;
      const runWidth = (column - runStart) * DITHER_CELL;
      cells.push(`M${runStart * DITHER_CELL} ${row * DITHER_CELL}h${runWidth}v${DITHER_CELL}h-${runWidth}Z`);
      runStart = -1;
    }
  }

  return cells.join('');
}

const swirlPaths = new Map<number, { high: string; low: string }>();

function swirlFor(height: number) {
  let paths = swirlPaths.get(height);
  if (!paths) {
    paths = {
      high: buildDitheredSwirlPath(PLATE_WIDTH, height, SWIRL.highLevel),
      low: buildDitheredSwirlPath(PLATE_WIDTH, height),
    };
    swirlPaths.set(height, paths);
  }
  return paths;
}

function mixHex(color: string, target: string, amount: number) {
  const channel = (hex: string, index: number) => Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  return `#${[0, 1, 2]
    .map((index) => Math.round(channel(color, index) + (channel(target, index) - channel(color, index)) * amount))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`;
}

/** The landing hero's field colors for the default violet; any other accent gets the same steps. */
function fieldPalette(accent: string) {
  if (accent.toUpperCase() === DEFAULT_OPEN_GRAPH_ACCENT) {
    return { ground: COLORS.fieldGround, high: COLORS.fieldHigh, low: DEFAULT_OPEN_GRAPH_ACCENT };
  }
  return { ground: mixHex(accent, '#000000', 0.74), high: mixHex(accent, '#FFFFFF', 0.62), low: accent };
}

/** The Glyphfield mark: a squared G with a lightning-bolt crossbar, on a 64-unit grid. */
function GlyphfieldMark({ color = COLORS.ink, size = 40 }: { color?: string; size?: number }) {
  return (
    <svg height={size} viewBox='0 0 64 64' width={size}>
      <path d={MARK_FRAME_PATH} fill={color} />
      <path d={MARK_BOLT_PATH} fill={color} />
    </svg>
  );
}

function DitheredField({ accent, height }: { accent: string; height: number }) {
  const palette = fieldPalette(accent);
  const paths = swirlFor(height);
  return (
    <svg
      aria-hidden='true'
      data-og-shader='paper-dithering-swirl'
      height={height}
      style={{ left: 0, position: 'absolute', top: 0 }}
      viewBox={`0 0 ${PLATE_WIDTH} ${height}`}
      width={PLATE_WIDTH}
    >
      <rect fill={palette.ground} height={height} width={PLATE_WIDTH} />
      <path d={paths.low} fill={palette.low} />
      <path d={paths.high} fill={palette.high} />
    </svg>
  );
}

export type BrandOpenGraphImageProps = {
  /** Color of the highlighted phrase and the dithered field. */
  accent?: string;
  /** One supporting sentence under the headline. */
  description?: string;
  height?: number;
  /** A phrase at the end of `title` that starts a new line in the accent color. */
  highlightedTitle?: string;
  /** Footer text on the left, such as the docs section. */
  note?: string;
  /** A Studio capture (data URL) set over the field. */
  screenshot?: string;
  title: string;
  /** Footer text on the right. */
  url?: string;
};

export default function BrandOpenGraphImage({
  accent = DEFAULT_OPEN_GRAPH_ACCENT,
  description,
  height = OPEN_GRAPH_IMAGE_SIZE.height,
  highlightedTitle,
  note,
  screenshot,
  title,
  url = 'glyphfield.com',
}: BrandOpenGraphImageProps) {
  const bodyHeight = height - FOOTER_HEIGHT;
  const lead = description ? setParagraph(description, LEAD_STYLE, COLUMN_WIDTH, LEAD_MAX_LINES) : undefined;
  const headline = fitHeadline({
    highlightedTitle,
    maxHeight: bodyHeight - TOP - LOCKUP_HEIGHT - HEADLINE_GAP - BOTTOM - (lead ? blockHeight(lead) + LEAD_GAP : 0),
    maxWidth: COLUMN_WIDTH,
    title,
  });
  const footerUrl = setParagraph(url, FOOTER_STYLE, COLUMN_WIDTH, 1);
  const footerNote = note
    ? setParagraph(note, FOOTER_NOTE_STYLE, WIDTH - MARGIN * 3 - blockWidth(footerUrl), 1)
    : undefined;

  return (
    <div
      style={{
        background: COLORS.canvas,
        color: COLORS.ink,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: TEXT_FACE.family,
        height: '100%',
        width: '100%',
      }}
    >
      {/* Only the plate clips. An overflow clip around text makes the PNG renderer mask every word. */}
      <div style={{ display: 'flex', height: bodyHeight, position: 'relative' }}>
        <div
          data-og-panel='copy'
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            justifyContent: 'space-between',
            padding: `${TOP}px 0 ${BOTTOM}px ${MARGIN}px`,
            width: MARGIN + COLUMN_WIDTH,
          }}
        >
          <div style={{ alignItems: 'center', display: 'flex', height: LOCKUP_HEIGHT }}>
            <GlyphfieldMark size={LOCKUP_HEIGHT} />
            <div style={{ display: 'flex', marginLeft: 14 }}>
              <TypesetText block={setParagraph('Glyphfield', LOCKUP_STYLE, COLUMN_WIDTH, 1)} color={COLORS.ink} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <TypesetText accent={accent} block={headline} color={COLORS.ink} />
            {lead ? (
              <div style={{ display: 'flex', marginTop: LEAD_GAP }}>
                <TypesetText block={lead} color={COLORS.muted} />
              </div>
            ) : null}
          </div>
        </div>
        <div
          data-og-panel='image'
          style={{ display: 'flex', height: '100%', overflow: 'hidden', position: 'absolute', right: 0, top: 0, width: PLATE_WIDTH }}
        >
          <DitheredField accent={accent} height={bodyHeight} />
          {screenshot ? (
            <div
              style={{
                borderLeft: '1px solid rgba(255,255,255,0.22)',
                borderTop: '1px solid rgba(255,255,255,0.22)',
                display: 'flex',
                height: bodyHeight - TOP,
                left: SCREENSHOT_INSET,
                overflow: 'hidden',
                position: 'absolute',
                top: TOP,
                width: SCREENSHOT_SIZE.width,
              }}
            >
              <img alt='' data-og-screenshot='studio' height={SCREENSHOT_SIZE.height} src={screenshot} width={SCREENSHOT_SIZE.width} />
            </div>
          ) : null}
        </div>
      </div>
      <div
        data-og-panel='footer'
        style={{
          alignItems: 'center',
          borderTop: `1px solid ${COLORS.line}`,
          display: 'flex',
          height: FOOTER_HEIGHT,
          justifyContent: 'space-between',
          padding: `0 ${MARGIN}px`,
        }}
      >
        {footerNote ? <TypesetText block={footerNote} color={COLORS.ink} /> : <div style={{ display: 'flex' }} />}
        <TypesetText block={footerUrl} color={COLORS.muted} />
      </div>
    </div>
  );
}

/** The home card: the landing hero's headline and lead, and the license. */
export const HOME_OPEN_GRAPH_CARD = {
  description: 'Build identity systems, motion, graphics, and product-ready artifacts in one connected workspace.',
  highlightedTitle: 'the whole brand.',
  note: 'Free and open source under the MIT License.',
  title: 'One studio for the whole brand.',
  url: 'glyphfield.com',
} as const satisfies BrandOpenGraphImageProps;

export const HOME_OPEN_GRAPH_ALT =
  'The Glyphfield mark and the headline “One studio for the whole brand.” next to a violet dithered swirl.';

/** The Studio card; the route adds the Design Lab capture. */
export const STUDIO_OPEN_GRAPH_CARD = {
  note: 'Projects and uploaded files stay in your browser.',
  title: 'Make motion, graphics, and templates from one identity.',
  url: 'glyphfield.com/studio',
} as const satisfies BrandOpenGraphImageProps;

export const STUDIO_OPEN_GRAPH_ALT =
  'The headline “Make motion, graphics, and templates from one identity.” next to a capture of the Glyphfield Studio Design Lab.';
