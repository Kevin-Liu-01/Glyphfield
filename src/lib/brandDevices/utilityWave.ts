import { deviceBackground, round, type DeviceContext } from '../brandDeviceContext';
import { mixHexColors } from '../color';

type Point = readonly [number, number];
type Segment = readonly [Point, Point, Point, Point];
type WaveNode = { readonly handle: number; readonly x: number; readonly y: number };

// Geometry in mark units: the Tailwind mark is 54 x 32.4, two waves, the lower one the upper
// moved by (-13.5, 16.2). Each wave's body repeats with this period, crest to crest.
const PERIOD = 35.1;
const TROUGH_DEPTH = 9.45;
const CREST_HANDLE = 9.5;
const TROUGH_HANDLE = 3.5;
const FIRST_CREST = 27;
const MARK_HEIGHT = 32.4;
// The upper wave is unchanged by a half turn about this point, which maps its top edge onto its bottom edge.
const PIVOT: Point = [33.75, 8.1];
const LOWER_OFFSET: Point = [-13.5, 16.2];
const UPPER_TIP = 13.5;
const LOWER_TIP = 40.5;

// The mark's own cubic segments: the left tip of the upper wave and the right tip of the lower wave.
const MARK_TOP_LEFT: readonly Segment[] = [[[13.5, 10.8], [15.3, 3.6], [19.8, 0], [27, 0]]];
const MARK_BOTTOM_LEFT: readonly Segment[] = [
  [[13.5, 10.8], [16.2, 7.2], [19.35, 5.85], [22.95, 6.75]],
  [[22.95, 6.75], [25.004, 7.263], [26.472, 8.754], [28.097, 10.403]],
  [[28.097, 10.403], [30.744, 13.09], [33.808, 16.2], [40.5, 16.2]],
];
const MARK_TOP_RIGHT: readonly Segment[] = [
  [[27, 0], [33.692, 0], [36.756, 3.11], [39.403, 5.797]],
  [[39.403, 5.797], [41.028, 7.446], [42.496, 8.937], [44.55, 9.45]],
  [[44.55, 9.45], [48.15, 10.35], [51.3, 9], [54, 5.4]],
];
const MARK_BOTTOM_RIGHT: readonly Segment[] = [[[40.5, 16.2], [47.7, 16.2], [52.2, 12.6], [54, 5.4]]];

/** Crest and trough nodes of the periodic top edge between two node-aligned x positions. */
function bodyNodes(from: number, to: number): WaveNode[] {
  const nodes: WaveNode[] = [];
  const first = Math.floor((from - FIRST_CREST) / PERIOD) - 1;
  const last = Math.ceil((to - FIRST_CREST) / PERIOD) + 1;
  for (let k = first; k <= last; k += 1) {
    nodes.push({ handle: CREST_HANDLE, x: FIRST_CREST + k * PERIOD, y: 0 });
    nodes.push({ handle: TROUGH_HANDLE, x: FIRST_CREST + (k + 0.5) * PERIOD, y: TROUGH_DEPTH });
  }
  return nodes.filter((node) => node.x >= from - 1e-6 && node.x <= to + 1e-6);
}

function segmentsThrough(nodes: readonly WaveNode[]): Segment[] {
  return nodes.slice(1).map((end, index) => {
    const start = nodes[index]!;
    return [[start.x, start.y], [start.x + start.handle, start.y], [end.x - end.handle, end.y], [end.x, end.y]];
  });
}

function turn([x, y]: Point): Point {
  return [2 * PIVOT[0] - x, 2 * PIVOT[1] - y];
}

function reversed(segment: Segment): Segment {
  return [segment[3], segment[2], segment[1], segment[0]];
}

/** The bottom edge of the body between `from` and `to`, left to right: the top edge turned a half turn. */
function bottomBody(from: number, to: number): Segment[] {
  return segmentsThrough(bodyNodes(2 * PIVOT[0] - to, 2 * PIVOT[0] - from))
    .map((segment): Segment => [turn(segment[3]), turn(segment[2]), turn(segment[1]), turn(segment[0])])
    .reverse();
}

/** The two currents as closed paths in frame pixels, each run a few units past the frame so the blur never shows its end. */
function currents(x0: number, y0: number, unit: number, w: number): { lower: string; upper: string } {
  const pt = ([x, y]: Point, [dx, dy]: Point = [0, 0]) => `${round(x0 + (x + dx) * unit)} ${round(y0 + (y + dy) * unit)}`;
  const curve = (segments: readonly Segment[], offset: Point) => segments.map((segment) => `C${pt(segment[1], offset)} ${pt(segment[2], offset)} ${pt(segment[3], offset)}`).join('');
  const margin = 9;
  const rightPeriods = Math.max(1, Math.ceil(((w - x0) / unit + margin - FIRST_CREST) / PERIOD));
  const leftPeriods = Math.max(1, Math.ceil((LOWER_TIP + LOWER_OFFSET[0] + x0 / unit + margin) / PERIOD));
  const upperTop = [...MARK_TOP_LEFT, ...segmentsThrough(bodyNodes(FIRST_CREST, FIRST_CREST + rightPeriods * PERIOD))];
  const upperBottom = [...MARK_BOTTOM_LEFT, ...bottomBody(LOWER_TIP, LOWER_TIP + rightPeriods * PERIOD)];
  const lowerTop = [...segmentsThrough(bodyNodes(FIRST_CREST - leftPeriods * PERIOD, FIRST_CREST)), ...MARK_TOP_RIGHT];
  const lowerBottom = [...bottomBody(LOWER_TIP - leftPeriods * PERIOD, LOWER_TIP), ...MARK_BOTTOM_RIGHT];
  return {
    // The lower current is the upper's shape moved like the mark's lower wave, its tip on the right.
    lower: `M${pt(lowerTop[0]![0], LOWER_OFFSET)}${curve(lowerTop, LOWER_OFFSET)}${curve(lowerBottom.map(reversed).reverse(), LOWER_OFFSET)}Z`,
    upper: `M${pt(upperTop[0]![0])}${curve(upperTop, [0, 0])}L${pt(upperBottom.at(-1)![3])}${curve(upperBottom.map(reversed).reverse(), [0, 0])}Z`,
  };
}

type Rhythm = { h: number; pitch: number; step: number; taper: number };

/** Slice rectangles for a mask: bar and gap pairs at a fixed pitch, the bars thinning toward the frame edge. */
function slices({ h, pitch, step, taper }: Rhythm, start: number, length: number, direction: 1 | -1): string {
  const count = Math.max(1, Math.ceil(length / pitch));
  return Array.from({ length: count }, (_, index) => {
    const bar = Math.max(1, Math.round((pitch / step) * (1 - (index + 0.5) / count) ** taper)) * step;
    const x = direction === 1 ? start + index * pitch : start - index * pitch - bar;
    return `<rect x="${round(x)}" width="${round(Math.min(bar, pitch - step * 0.5))}" height="${round(h)}"/>`;
  }).join('');
}

/** Page rows stepping outward from `from` toward the `edge` in five to eight unit steps, nearest first. */
function pageRows(from: number, direction: 1 | -1, edge: number, unit: number, random: () => number): number[] {
  const rows: number[] = [];
  let row = from + direction * (5 + Math.floor(random() * 4)) * unit;
  while ((edge - row) * direction >= unit * 1.5) {
    rows.push(row);
    row += direction * (6 + Math.floor(random() * 3)) * unit;
  }
  return rows;
}

/**
 * Tailwind: the utility wave. The two waves of the mark, drawn from its exact curves, run on as
 * currents (the upper one to the right, the lower one to the left) and break into slices on the
 * 4px spacing scale once they leave the selected column. The column sits on a hairline guide grid
 * with diagonally hatched gutters, the way tailwindcss.com lays out its pages, and a dashed
 * selection box with crosshair corners marks the mark like an element picked in dev tools.
 */
export function utilityWaveDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const dark = tone === 'dark';
  // One mark unit; 16px on the 1600 x 1000 cover.
  const unit = Math.min(w / 72, h / 62.5);
  const step = unit / 4;
  const gutter = unit * 3;
  const hairline = Math.max(1, unit / 8);

  // The column (the selected element) and the mark inside it, both nudged so crops differ.
  const columnUnits = 27 + 2 * (7 + random() * 3);
  const columnW = columnUnits * unit;
  const columnRoom = Math.max(0, (w - columnW) / 2 - unit * 6);
  const columnX = w / 2 - columnW / 2 + (random() - 0.5) * 0.6 * columnRoom;
  const markShift = (random() - 0.5) * 2 * (columnUnits / 2 - 13.5 - 5) * unit;
  const verticalRoom = Math.max(0, (h - MARK_HEIGHT * unit) / 2 - unit * 6);
  const markCx = columnX + columnW / 2 + markShift;
  const markCy = h / 2 + (random() - 0.5) * 2 * Math.min(verticalRoom * 0.4, unit * 4);
  const x0 = markCx - 27 * unit;
  const y0 = markCy - (MARK_HEIGHT / 2) * unit;
  const { lower, upper } = currents(x0, y0, unit, w);

  // Utility slices: bar and gap pairs on the 4px scale, bars thinning as the currents run out.
  const columnR = columnX + columnW;
  const span = Math.max(columnX, w - columnR);
  const pitch = Math.max((9 + Math.floor(random() * 5)) * step, Math.ceil(span / 24 / step) * step);
  const taper = 0.7 + random() * 0.8;
  const rhythm = { h, pitch, step, taper };
  const bars = `${slices(rhythm, columnR, w - columnR, 1)}${slices(rhythm, columnX, columnX, -1)}`;

  // Guide rows: the mark's top, middle and bottom, the gutter rows beside them, then page rows outward.
  const yTop = y0;
  const yMid = y0 + (MARK_HEIGHT / 2) * unit;
  const yBottom = y0 + MARK_HEIGHT * unit;
  const rows = [...pageRows(yTop - gutter, -1, 0, unit, random).reverse(), yTop - gutter, yTop, yMid, yBottom, yBottom + gutter, ...pageRows(yBottom + gutter, 1, h, unit, random)];
  const columns = [columnX - gutter, columnX, columnR, columnR + gutter];
  const firstRow = rows[0]!;
  const lastRow = rows.at(-1)!;

  // The selection: usually the whole mark, sometimes with its gutters or just one wave.
  const pick = random();
  const [boxTop, boxBottom] = pick < 0.5 ? [yTop, yBottom] : pick < 0.7 ? [yTop - gutter, yBottom + gutter] : pick < 0.85 ? [yTop, yMid] : [yMid, yBottom];
  const arm = Math.max(4, unit * 0.875);
  const cross = (x: number, y: number) => `M${round(x - arm)} ${round(y)}H${round(x + arm)}M${round(x)} ${round(y - arm)}V${round(y + arm)}`;
  const crosses = [cross(columnX, boxTop), cross(columnR, boxTop), cross(columnX, boxBottom), cross(columnR, boxBottom)].join('');

  const rule = dark ? mixHexColors(palette.paper, palette.accent, 0.15) : palette.ink;
  const ruleOpacity = dark ? 0.1 : 0.09;
  const hatchOpacity = dark ? 0.12 : 0.08;
  const tip = dark ? palette.secondary : mixHexColors(palette.secondary, palette.accent, 0.45);
  const outline = dark ? palette.accent : mixHexColors(palette.accent, palette.ink, 0.25);
  const crosshair = dark ? palette.secondary : mixHexColors(palette.accent, palette.ink, 0.35);
  const blur = unit * 2.4;
  const hatchSize = Math.max(5, unit * 1.06);
  const glowR = unit * 35;
  const upperTipX = x0 + UPPER_TIP * unit;
  const lowerTipX = x0 + (LOWER_TIP + LOWER_OFFSET[0]) * unit;
  const fadeEnd = dark ? 0.35 : 0.3;
  const fade = `<linearGradient id="${id('fade')}" x1="0" y1="0" x2="${round(w)}" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF" stop-opacity="${fadeEnd}"/><stop offset="${round(Math.max(0, columnX / w))}" stop-color="#FFFFFF"/><stop offset="${round(Math.min(1, columnR / w))}" stop-color="#FFFFFF"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="${fadeEnd}"/></linearGradient>`;
  const currentFill = (name: string, from: number, to: number) => `<linearGradient id="${id(name)}" x1="${round(from)}" y1="0" x2="${round(to)}" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="${tip}"/><stop offset=".3" stop-color="${palette.accent}"/><stop offset="1" stop-color="${palette.accent}"/></linearGradient>`;
  const frame = `x="0" y="0" width="${round(w)}" height="${round(h)}"`;

  const defs = `<defs>`
    + `<pattern id="${id('hatch')}" width="${round(hatchSize)}" height="${round(hatchSize)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${round(Math.max(0.75, unit * 0.1))}" height="${round(hatchSize)}" fill="${rule}" fill-opacity="${hatchOpacity}"/></pattern>`
    + `<radialGradient id="${id('glow')}" cx="${round(markCx)}" cy="${round(markCy)}" r="${round(glowR)}" gradientUnits="userSpaceOnUse" gradientTransform="translate(${round(markCx)} ${round(markCy)}) scale(1 .62) translate(${round(-markCx)} ${round(-markCy)})"><stop stop-color="${palette.accent}" stop-opacity="${dark ? 0.2 : 0.1}"/><stop offset=".55" stop-color="${palette.accent}" stop-opacity="${dark ? 0.06 : 0.03}"/><stop offset="1" stop-color="${palette.accent}" stop-opacity="0"/></radialGradient>`
    + currentFill('upper', upperTipX, w)
    + currentFill('lower', lowerTipX, 0)
    + fade
    + `<mask id="${id('slices')}" maskUnits="userSpaceOnUse" ${frame}><g fill="url(#${id('fade')})"><rect x="${round(columnX)}" width="${round(columnW)}" height="${round(h)}"/>${bars}</g></mask>`
    + `<mask id="${id('soft')}" maskUnits="userSpaceOnUse" ${frame}><rect width="${round(w)}" height="${round(h)}" fill="url(#${id('fade')})"/></mask>`
    + `<filter id="${id('blur')}" filterUnits="userSpaceOnUse" x="${round(-blur * 3)}" y="${round(-blur * 3)}" width="${round(w + blur * 6)}" height="${round(h + blur * 6)}"><feGaussianBlur stdDeviation="${round(blur)}"/></filter>`
    + `</defs>`;

  const hatchCells = [
    `<rect x="${round(columnX - gutter)}" width="${round(gutter)}" height="${round(h)}"/>`,
    `<rect x="${round(columnR)}" width="${round(gutter)}" height="${round(h)}"/>`,
    firstRow > unit * 0.5 ? `<rect x="${round(columnX)}" width="${round(columnW)}" height="${round(firstRow)}"/>` : '',
    lastRow < h - unit * 0.5 ? `<rect x="${round(columnX)}" y="${round(lastRow)}" width="${round(columnW)}" height="${round(h - lastRow)}"/>` : '',
  ].join('');
  const guides = `${rows.map((y) => `<path d="M0 ${round(y)}H${round(w)}"/>`).join('')}${columns.map((x) => `<path d="M${round(x)} 0V${round(h)}"/>`).join('')}`;
  const dash = `${round(Math.max(3, unit * 0.625))} ${round(Math.max(2.4, unit * 0.5))}`;

  return `${defs}${deviceBackground(context, palette.deep, palette.paper)}`
    + `<rect width="${round(w)}" height="${round(h)}" fill="url(#${id('glow')})"/>`
    + `<rect x="${round(columnX)}" y="${round(boxTop)}" width="${round(columnW)}" height="${round(boxBottom - boxTop)}" fill="${palette.accent}" fill-opacity="${dark ? 0.05 : 0.04}"/>`
    + `<g fill="url(#${id('hatch')})">${hatchCells}</g>`
    + `<g fill="none" stroke="${rule}" stroke-opacity="${ruleOpacity}" stroke-width="${round(hairline)}">${guides}</g>`
    + `<g mask="url(#${id('soft')})"><g filter="url(#${id('blur')})" opacity="${dark ? 0.42 : 0.2}"><path d="${upper}" fill="${palette.accent}"/><path d="${lower}" fill="${palette.accent}"/></g></g>`
    + `<g mask="url(#${id('slices')})"><path d="${upper}" fill="url(#${id('upper')})"/><path d="${lower}" fill="url(#${id('lower')})"/></g>`
    + `<rect x="${round(columnX)}" y="${round(boxTop)}" width="${round(columnW)}" height="${round(boxBottom - boxTop)}" fill="none" stroke="${outline}" stroke-opacity="${dark ? 0.75 : 0.8}" stroke-width="${round(hairline)}" stroke-dasharray="${dash}"/>`
    + `<path d="${crosses}" fill="none" stroke="${crosshair}" stroke-width="${round(hairline)}"/>`;
}
