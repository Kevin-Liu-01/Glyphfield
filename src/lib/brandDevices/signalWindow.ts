import type { BrandPalette } from '../brandOutputKit';
import { contrastRatio, deviceBackground, readableOn, round, type DeviceContext } from '../brandDeviceContext';
import { mixHexColors } from '../color';

type Box = { h: number; w: number; x: number; y: number };
type Point = readonly [number, number];
type WallKind = 'chart' | 'note' | 'photo' | 'sticky' | 'swatch';
type FocusKind = 'chart' | 'note' | 'photo';
type Subject = 'arch' | 'landscape' | 'portrait';

/** Fills for a photograph reduced to tone. `sky`, `near`, `sun` and `mist` are gradient references. */
type PhotoTones = { far: string; mid: string; mist: string; near: string; sky: string; sun: string; sunCore: string };

/** The colours one layer draws with: the quiet wall, or the lit card inside the window. */
type Tones = {
  area: string;
  card: string;
  edge: string;
  line: string;
  mark: string;
  photo: PhotoTones;
  soft: string;
  sticky: string;
  stickyInk: string;
  tape: string;
};

type Layer = { detail: boolean; random: () => number; stroke: number; tones: Tones };

const WALL_KINDS: readonly (readonly [WallKind, number])[] = [['photo', 0.38], ['note', 0.25], ['chart', 0.2], ['sticky', 0.11], ['swatch', 0.06]];
const SUBJECTS: readonly Subject[] = ['landscape', 'arch', 'landscape', 'portrait', 'landscape', 'arch'];
const FOCUS_SUBJECTS: readonly Subject[] = ['landscape', 'arch', 'landscape'];

function weighted<T>(random: () => number, table: readonly (readonly [T, number])[]): T {
  const total = table.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of table) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return table[table.length - 1]![0];
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

function rect(box: Box, fill: string, extra = ''): string {
  return `<rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.w)}" height="${round(box.h)}" fill="${fill}"${extra}/>`;
}

/** A rounded bar: one line of set text, a rule, or a chip. */
function bar(x: number, y: number, width: number, height: number, fill: string, opacity = 1): string {
  return `<rect x="${round(x)}" y="${round(y)}" width="${round(Math.max(0, width))}" height="${round(height)}" rx="${round(height / 2)}" fill="${fill}"${opacity < 1 ? ` fill-opacity="${round(opacity)}"` : ''}/>`;
}

function circle(x: number, y: number, r: number, fill: string, extra = ''): string {
  return `<circle cx="${round(x)}" cy="${round(y)}" r="${round(Math.max(0, r))}" fill="${fill}"${extra}/>`;
}

/** Catmull-Rom through the points, as cubic Bezier segments. */
function smoothPath(points: readonly Point[]): string {
  let d = `M${round(points[0]![0])} ${round(points[0]![1])}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]!;
    const p1 = points[index]!;
    const p2 = points[index + 1]!;
    const p3 = points[index + 2] ?? p2;
    d += `C${round(p1[0] + (p2[0] - p0[0]) / 6)} ${round(p1[1] + (p2[1] - p0[1]) / 6)} ${round(p2[0] - (p3[0] - p1[0]) / 6)} ${round(p2[1] - (p3[1] - p1[1]) / 6)} ${round(p2[0])} ${round(p2[1])}`;
  }
  return d;
}

/** A rolling ridge across the image, closed along its bottom edge. */
function ridge(box: Box, base: number, amp: number, fill: string, random: () => number): string {
  const y0 = box.y + box.h * base;
  const a = box.h * amp;
  const step = box.w / 3;
  const ys = [0, 1, 2, 3].map(() => y0 + (random() - 0.5) * a * 0.8);
  const crest = y0 - a * (0.55 + random() * 0.45);
  return `<path d="M${round(box.x)} ${round(ys[0]!)}Q${round(box.x + step * 0.5)} ${round(crest)} ${round(box.x + step)} ${round(ys[1]!)}T${round(box.x + step * 2)} ${round(ys[2]!)}T${round(box.x + box.w)} ${round(ys[3]!)}V${round(box.y + box.h)}H${round(box.x)}Z" fill="${fill}"/>`;
}

function landscape(box: Box, tones: PhotoTones, layer: Layer): string {
  const { random } = layer;
  const sunX = box.x + box.w * (0.24 + random() * 0.52);
  const sunY = box.y + box.h * (0.24 + random() * 0.12);
  const sunR = box.w * 0.06;
  const glow = Math.min(sunR * 3.4, sunY - box.y, sunX - box.x, box.x + box.w - sunX);
  const sun = `${circle(sunX, sunY, glow, `url(#${tones.sun})`)}${circle(sunX, sunY, sunR, tones.sunCore)}`;
  const mist = layer.detail ? `${ridge(box, 0.6, 0.1, tones.mid, random)}${rect({ h: box.h * 0.22, w: box.w, x: box.x, y: box.y + box.h * 0.56 }, `url(#${tones.mist})`)}` : '';
  return `${sun}${ridge(box, 0.5, 0.16, tones.far, random)}${mist}${ridge(box, 0.76, 0.1, `url(#${tones.near})`, random)}`;
}

function arch(box: Box, tones: PhotoTones, layer: Layer): string {
  const { random } = layer;
  const floor = box.y + box.h * 0.74;
  const half = box.w * (0.17 + random() * 0.06);
  const cx = box.x + box.w * (0.42 + random() * 0.16);
  const spring = floor - box.h * 0.3;
  const wall = `<path fill-rule="evenodd" d="M${round(box.x)} ${round(box.y)}H${round(box.x + box.w)}V${round(floor)}H${round(box.x)}ZM${round(cx - half)} ${round(floor)}V${round(spring)}A${round(half)} ${round(half)} 0 0 1 ${round(cx + half)} ${round(spring)}V${round(floor)}Z" fill="url(#${tones.near})"/>`;
  const ground = rect({ h: box.y + box.h - floor, w: box.w, x: box.x, y: floor }, tones.far);
  const reach = box.w * 0.22;
  const light = `<path d="M${round(cx - half)} ${round(floor)}H${round(cx + half)}L${round(Math.max(box.x, cx + half - reach))} ${round(box.y + box.h)}H${round(Math.max(box.x, cx - half - reach * 1.6))}Z" fill="${tones.sunCore}" fill-opacity="0.7"/>`;
  return `${circle(cx, spring, Math.min(half * 1.6, cx - box.x, box.x + box.w - cx), `url(#${tones.sun})`)}${wall}${ground}${light}`;
}

function portrait(box: Box, tones: PhotoTones, layer: Layer): string {
  const { random } = layer;
  const cx = box.x + box.w * (0.42 + random() * 0.16);
  const r = Math.min(box.w * 0.15, box.h * 0.15);
  const cy = box.y + box.h * 0.44;
  const bottom = box.y + box.h;
  const reach = Math.min(r * 2.5, cx - box.x, box.x + box.w - cx);
  const shoulder = cy + r * 1.55;
  const body = `<path d="M${round(cx - reach)} ${round(bottom)}C${round(cx - reach)} ${round(shoulder + r * 0.3)} ${round(cx - r * 1.5)} ${round(shoulder)} ${round(cx)} ${round(shoulder)}S${round(cx + reach)} ${round(shoulder + r * 0.3)} ${round(cx + reach)} ${round(bottom)}Z" fill="url(#${tones.near})"/>`;
  const neck = rect({ h: r * 1.1, w: r * 0.6, x: cx - r * 0.3, y: cy + r * 0.6 }, `url(#${tones.near})`);
  const rim = layer.detail ? `<path d="M${round(cx + r * 0.34)} ${round(cy - r * 0.94)}A${round(r)} ${round(r)} 0 0 1 ${round(cx + r * 0.7)} ${round(cy + r * 0.71)}" fill="none" stroke="${tones.sunCore}" stroke-width="${round(r * 0.1)}" stroke-linecap="round" stroke-opacity="0.85"/>` : '';
  return `${circle(cx + r * 0.7, cy - r * 0.3, Math.min(r * 2.8, box.x + box.w - cx - r * 0.7, cy - r * 0.3 - box.y), `url(#${tones.sun})`)}${neck}${body}${circle(cx, cy, r, `url(#${tones.near})`)}${rim}`;
}

/** A photograph reduced to tone: sky, light and two or three planes of shade. */
function photograph(box: Box, subject: Subject, layer: Layer): string {
  const tones = layer.tones.photo;
  const sky = rect(box, `url(#${tones.sky})`);
  if (subject === 'arch') return sky + arch(box, tones, layer);
  if (subject === 'portrait') return sky + portrait(box, tones, layer);
  return sky + landscape(box, tones, layer);
}

function textLines(x: number, y: number, width: number, count: number, layer: Layer, leading: number): string {
  const { random, stroke, tones } = layer;
  return Array.from({ length: count }, (_, index) => bar(x, y + index * leading, width * (index === count - 1 ? 0.45 + random() * 0.2 : 0.82 + random() * 0.18), stroke * 1.5, tones.soft)).join('');
}

function photoCard(box: Box, layer: Layer, bleed: boolean): string {
  const pad = bleed ? 0 : box.w * 0.06;
  const caption = bleed ? 0 : box.h * 0.16;
  const image = { h: box.h - pad * 2 - caption, w: box.w - pad * 2, x: box.x + pad, y: box.y + pad };
  const lines = bleed ? '' : bar(image.x, image.y + image.h + caption * 0.38, image.w * (0.42 + layer.random() * 0.3), layer.stroke * 1.6, layer.tones.line);
  return photograph(image, pick(layer.random, SUBJECTS), layer) + lines;
}

function noteCard(box: Box, layer: Layer): string {
  const pad = box.w * 0.11;
  const { stroke, tones } = layer;
  const head = bar(box.x + pad, box.y + pad, (box.w - pad * 2) * 0.62, stroke * 2.4, tones.line);
  const leading = Math.max(stroke * 3.4, box.w * 0.075);
  const count = Math.max(2, Math.min(7, Math.floor((box.h - pad * 2.6) / leading)));
  return head + textLines(box.x + pad, box.y + pad * 1.9, box.w - pad * 2, count, layer, leading);
}

function chartPoints(box: Box, count: number, random: () => number): Point[] {
  let level = 0.14 + random() * 0.14;
  return Array.from({ length: count }, (_, index) => {
    level = Math.min(0.9, Math.max(0.06, level + (random() - 0.24) * 0.22));
    return [box.x + (box.w * index) / (count - 1), box.y + box.h * (1 - level)] as const;
  });
}

function chartCard(box: Box, layer: Layer): string {
  const { random, stroke, tones } = layer;
  const pad = box.w * 0.1;
  const plot = { h: box.h - pad * 3, w: box.w - pad * 2, x: box.x + pad, y: box.y + pad * 2 };
  const head = bar(plot.x, box.y + pad * 0.85, plot.w * 0.4, stroke * 1.8, tones.line);
  const base = `<path d="M${round(plot.x)} ${round(plot.y + plot.h)}H${round(plot.x + plot.w)}" stroke="${tones.edge}" stroke-width="${round(stroke * 0.7)}"/>`;
  if (random() < 0.45) {
    const count = 6;
    const slot = plot.w / count;
    const hot = Math.floor(random() * count);
    return head + base + Array.from({ length: count }, (_, index) => {
      const height = plot.h * (0.25 + random() * 0.7);
      return rect({ h: height, w: slot * 0.62, x: plot.x + slot * index + slot * 0.19, y: plot.y + plot.h - height }, index === hot ? tones.mark : tones.soft);
    }).join('');
  }
  const points = chartPoints(plot, 8, random);
  const line = smoothPath(points);
  return `${head}${base}<path d="${line}V${round(plot.y + plot.h)}H${round(plot.x)}Z" fill="url(#${tones.area})"/><path d="${line}" fill="none" stroke="${tones.line}" stroke-width="${round(stroke * 1.1)}" stroke-linejoin="round"/>`;
}

function scribble(x: number, y: number, width: number, amp: number, color: string, weight: number): string {
  const step = width / 6;
  return `<path d="M${round(x)} ${round(y)}q${round(step / 2)} ${round(-amp)} ${round(step)} 0t${round(step)} 0t${round(step)} 0t${round(step)} 0t${round(step)} 0t${round(step * 0.7)} 0" fill="none" stroke="${color}" stroke-width="${round(weight)}" stroke-linecap="round"/>`;
}

function stickyNote(box: Box, layer: Layer): string {
  const { stroke, tones } = layer;
  const pad = box.w * 0.16;
  const fold = box.w * 0.16;
  const right = box.x + box.w;
  const bottom = box.y + box.h;
  const lines = [0, 1, 2].map((index) => scribble(box.x + pad, box.y + pad * 1.3 + index * box.h * 0.2, (box.w - pad * 2) * (index === 2 ? 0.55 : 0.92), box.h * 0.025, tones.stickyInk, stroke * 1.05)).join('');
  return `<path d="M${round(box.x)} ${round(box.y)}H${round(right)}V${round(bottom - fold)}L${round(right - fold)} ${round(bottom)}H${round(box.x)}Z" fill="${tones.sticky}"/><path d="M${round(right)} ${round(bottom - fold)}L${round(right - fold)} ${round(bottom)}V${round(bottom - fold)}Z" fill="${tones.stickyInk}" fill-opacity="0.22"/>${lines}`;
}

function swatchCard(box: Box, layer: Layer, chips: readonly string[]): string {
  const pad = box.w * 0.08;
  const chipW = (box.w - pad * 2) / chips.length;
  const chipH = box.h - pad * 2.8;
  return chips.map((fill, index) => rect({ h: chipH, w: chipW, x: box.x + pad + chipW * index, y: box.y + pad }, fill)).join('') + bar(box.x + pad, box.y + box.h - pad * 1.3, box.w * 0.4, layer.stroke * 1.4, layer.tones.soft);
}

function wallCardHeight(kind: WallKind, width: number, random: () => number): number {
  if (kind === 'photo') return width * pick(random, [0.86, 1.08, 1.32]);
  if (kind === 'note') return width * (0.95 + random() * 0.5);
  if (kind === 'chart') return width * (0.7 + random() * 0.18);
  if (kind === 'swatch') return width * (0.58 + random() * 0.14);
  return width;
}

type WallCard = { box: Box; kind: WallKind };

function wallCardMarkup({ box, kind }: WallCard, layer: Layer, unit: number, chips: readonly string[], shadow: string): string {
  const { random, tones } = layer;
  const angle = (random() - 0.5) * (kind === 'sticky' ? 7 : 3.2);
  const bleed = kind === 'photo' && random() < 0.28;
  const lift = unit * 0.005;
  const ground = kind === 'sticky' ? '' : rect(box, tones.card, ` stroke="${tones.edge}" stroke-width="${round(layer.stroke * 0.6)}"`);
  let body = '';
  if (kind === 'photo') body = photoCard(box, layer, bleed);
  else if (kind === 'note') body = noteCard(box, layer);
  else if (kind === 'chart') body = chartCard(box, layer);
  else if (kind === 'swatch') body = swatchCard(box, layer, chips);
  else body = stickyNote(box, layer);
  const tapeW = box.w * 0.3;
  const tape = layer.detail && kind !== 'sticky' && random() < 0.4
    ? `<rect x="${round(box.x + box.w / 2 - tapeW / 2)}" y="${round(box.y - unit * 0.012)}" width="${round(tapeW)}" height="${round(unit * 0.024)}" fill="${tones.tape}" fill-opacity="0.7" transform="rotate(${round((random() - 0.5) * 10)} ${round(box.x + box.w / 2)} ${round(box.y)})"/>`
    : '';
  return `<g transform="rotate(${round(angle)} ${round(box.x + box.w / 2)} ${round(box.y + box.h / 2)})">${rect({ ...box, y: box.y + lift }, shadow, ' fill-opacity="0.1"')}${ground}${body}${tape}</g>`;
}

function overlapArea(a: Box, b: Box): number {
  const across = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return across > 0 && down > 0 ? across * down : 0;
}

/** Masonry columns of unequal width with a clearing kept around the window. */
function layoutWall(w: number, h: number, unit: number, clear: Box, random: () => number): WallCard[] {
  const cards: WallCard[] = [];
  const gap = unit * 0.034;
  let x = -unit * (0.05 + random() * 0.12);
  while (x < w + gap) {
    const column = unit * pick(random, [0.2, 0.25, 0.3, 0.36]);
    let y = -unit * random() * 0.24;
    while (y < h) {
      const kind = weighted(random, WALL_KINDS);
      const cw = kind === 'sticky' ? column * (0.6 + random() * 0.2) : column * (0.82 + random() * 0.18);
      const box = { h: wallCardHeight(kind, cw, random), w: cw, x: x + (column - cw) * random(), y };
      // Cards may tuck behind the window, but none is mostly hidden by it.
      const hidden = overlapArea(box, clear) / (box.w * box.h);
      if (random() < 0.1) y += box.h * 0.5 + gap;
      else if (hidden < 0.4) cards.push({ box, kind });
      y += box.h + gap * (0.7 + random() * 0.9);
    }
    x += column + gap * (0.7 + random() * 0.7);
  }
  return cards;
}

function focusPhoto(box: Box, layer: Layer): string {
  const pad = box.w * 0.055;
  const caption = box.h * 0.15;
  const image = { h: box.h - pad * 2 - caption, w: box.w - pad * 2, x: box.x + pad, y: box.y + pad };
  const { stroke, tones } = layer;
  const lineY = image.y + image.h + caption * 0.36;
  return `${photograph(image, pick(layer.random, FOCUS_SUBJECTS), layer)}${rect(image, 'none', ` stroke="${tones.edge}" stroke-width="${round(stroke * 0.5)}"`)}${bar(image.x, lineY, image.w * 0.5, stroke * 2.2, tones.line)}${bar(image.x, lineY + stroke * 4.2, image.w * 0.32, stroke * 1.6, tones.soft)}${circle(image.x + image.w - stroke * 2.2, lineY + stroke * 2.6, stroke * 2.2, tones.mark)}`;
}

function focusChart(box: Box, layer: Layer, accent: string): string {
  const { random, stroke, tones } = layer;
  const pad = box.w * 0.075;
  const head = `${bar(box.x + pad, box.y + pad, box.w * 0.3, stroke * 2, tones.soft)}${bar(box.x + pad, box.y + pad + stroke * 5, box.w * 0.36, stroke * 6.4, tones.line)}${bar(box.x + box.w - pad - box.w * 0.16, box.y + pad + stroke * 5.6, box.w * 0.16, stroke * 5.2, tones.sticky)}${bar(box.x + box.w - pad - box.w * 0.13, box.y + pad + stroke * 7.6, box.w * 0.1, stroke * 1.2, tones.stickyInk)}`;
  const plot = { h: box.h * 0.54, w: box.w - pad * 2, x: box.x + pad, y: box.y + box.h * 0.36 };
  const grid = [0, 1, 2, 3].map((index) => `<path d="M${round(plot.x)} ${round(plot.y + (plot.h * index) / 3)}H${round(plot.x + plot.w)}" stroke="${tones.edge}" stroke-width="${round(stroke * 0.5)}"${index < 3 ? ` stroke-dasharray="${round(stroke)} ${round(stroke * 1.6)}"` : ''}/>`).join('');
  const points = chartPoints(plot, 9, random);
  const line = smoothPath(points);
  const floor = plot.y + plot.h;
  const baseline = smoothPath(chartPoints(plot, 9, random).map(([x, y]) => [x, y + (floor - y) * 0.5] as const));
  const [px, py] = points[5 + Math.floor(random() * 3)]!;
  const marker = `<path d="M${round(px)} ${round(py)}V${round(plot.y + plot.h)}" stroke="${accent}" stroke-width="${round(stroke * 0.6)}" stroke-dasharray="${round(stroke * 1.2)} ${round(stroke)}"/>${circle(px, py, stroke * 5, accent, ' fill-opacity="0.16"')}${circle(px, py, stroke * 2.2, tones.card, ` stroke="${accent}" stroke-width="${round(stroke * 1.1)}"`)}`;
  return `${head}${grid}<path d="${baseline}" fill="none" stroke="${tones.soft}" stroke-width="${round(stroke)}" stroke-dasharray="${round(stroke * 2)} ${round(stroke * 1.6)}"/><path d="${line}V${round(floor)}H${round(plot.x)}Z" fill="url(#${tones.area})"/><path d="${line}" fill="none" stroke="${accent}" stroke-width="${round(stroke * 1.5)}" stroke-linejoin="round" stroke-linecap="round"/>${marker}`;
}

function focusNote(box: Box, layer: Layer, palette: BrandPalette): string {
  const { stroke, tones } = layer;
  const pad = box.w * 0.09;
  const inner = box.w - pad * 2;
  const x = box.x + pad;
  const at = (fraction: number) => box.y + box.h * fraction;
  const text = box.h * 0.017;
  const titleH = box.h * 0.034;
  const title = `${bar(x, at(0.08), inner * 0.74, titleH, tones.line)}${bar(x, at(0.08) + titleH * 1.7, inner * 0.48, titleH, tones.line)}`;
  const leading = box.h * 0.058;
  const swipe = bar(x - text * 0.6, at(0.26) - text * 0.9, inner * 0.8, text * 2.8, tones.sticky, 0.9);
  const body = [0.76, 0.94, 0.58].map((width, index) => bar(x, at(0.26) + leading * index, inner * width, text, tones.soft)).join('');
  const size = box.h * 0.042;
  const onAccent = readableOn(palette.accent, palette);
  const rows = [0, 1, 2].map((index) => {
    const y = at(0.52) + index * box.h * 0.09;
    const check = index === 0
      ? `${rect({ h: size, w: size, x, y }, palette.accent, ` rx="${round(size * 0.22)}"`)}<path d="M${round(x + size * 0.24)} ${round(y + size * 0.52)}l${round(size * 0.18)} ${round(size * 0.2)}l${round(size * 0.34)} ${round(-size * 0.4)}" fill="none" stroke="${onAccent}" stroke-width="${round(size * 0.13)}" stroke-linecap="round" stroke-linejoin="round"/>`
      : rect({ h: size, w: size, x, y }, 'none', ` rx="${round(size * 0.22)}" stroke="${tones.soft}" stroke-width="${round(Math.max(1, size * 0.08))}"`);
    return `${check}${bar(x + size * 1.8, y + (size - text) / 2, inner * (index === 0 ? 0.52 : 0.64 - index * 0.12), text, index === 0 ? tones.line : tones.soft)}`;
  }).join('');
  const actionH = box.h * 0.075;
  const actionY = box.y + box.h - pad - actionH;
  const action = `${bar(x, actionY, inner * 0.5, actionH, palette.accent)}${bar(x + actionH * 0.55, actionY + (actionH - text) / 2, inner * 0.26, text, onAccent)}${bar(x + inner * 0.56, actionY + (actionH - text) / 2, inner * 0.2, text, tones.soft)}`;
  return `${title}${swipe}${body}<path d="M${round(x)} ${round(at(0.45))}H${round(x + inner)}" stroke="${tones.edge}" stroke-width="${round(stroke * 0.6)}"/>${rows}${action}`;
}

type Frame = { box: Box; pad: number; tabH: number; window: Box };

/** Size and place the focused card so the window, its brackets and tab stay inside every crop. */
function placeFocus(w: number, h: number, unit: number, kind: FocusKind, random: () => number): Frame {
  const aspect = kind === 'photo' ? pick(random, [0.8, 1.0, 1.22]) : kind === 'chart' ? 1.3 : 0.82;
  let ch = unit * (0.54 + random() * 0.06);
  let cw = ch * aspect;
  if (cw > w * 0.6) {
    ch *= (w * 0.6) / cw;
    cw = w * 0.6;
  }
  const pad = unit * 0.026;
  const tabH = unit * 0.046;
  const margin = unit * 0.09;
  const halfW = cw / 2 + pad + margin;
  const cx = Math.min(w - halfW, Math.max(halfW, w * (0.5 + (random() - 0.5) * 0.26)));
  const top = margin + tabH + pad;
  const room = h - top - margin - pad - ch;
  const y = top + room * (0.42 + random() * 0.16);
  const box = { h: ch, w: cw, x: cx - cw / 2, y };
  return { box, pad, tabH, window: { h: ch + pad * 2, w: cw + pad * 2, x: box.x - pad, y: y - pad } };
}

function gradient(name: string, stops: readonly (readonly [number, string, number])[], vertical = true): string {
  const body = stops.map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}"${opacity < 1 ? ` stop-opacity="${opacity}"` : ''}/>`).join('');
  return `<linearGradient id="${name}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${body}</linearGradient>`;
}

function radial(name: string, cx: number, cy: number, r: number, stops: readonly (readonly [number, string, number])[]): string {
  const body = stops.map(([offset, color, opacity]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`).join('');
  return `<radialGradient id="${name}" cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}" gradientUnits="userSpaceOnUse">${body}</radialGradient>`;
}

type PhotoStops = { far: string; mid: string; mist: string; nearBottom: string; nearTop: string; skyBottom: string; skyTop: string; sun: string; sunCore: string };

function photoSet(id: (name: string) => string, key: string, stops: PhotoStops): { defs: string; tones: PhotoTones } {
  const tones = { far: stops.far, mid: stops.mid, mist: id(`${key}Mist`), near: id(`${key}Near`), sky: id(`${key}Sky`), sun: id(`${key}Sun`), sunCore: stops.sunCore };
  const defs = gradient(tones.sky, [[0, stops.skyTop, 1], [1, stops.skyBottom, 1]])
    + gradient(tones.near, [[0, stops.nearTop, 1], [1, stops.nearBottom, 1]])
    + gradient(tones.mist, [[0, stops.mist, 0], [0.45, stops.mist, 0.6], [1, stops.mist, 0]])
    + `<radialGradient id="${tones.sun}"><stop offset="0" stop-color="${stops.sun}" stop-opacity="0.85"/><stop offset="1" stop-color="${stops.sun}" stop-opacity="0"/></radialGradient>`;
  return { defs, tones };
}

function wallStops(palette: BrandPalette, dark: boolean): PhotoStops {
  const tint = (amount: number) => (dark ? mixHexColors(palette.deep, palette.paper, amount) : mixHexColors(palette.paper, palette.ink, amount));
  return dark
    ? { far: tint(0.17), mid: tint(0.12), mist: tint(0.3), nearBottom: tint(0.04), nearTop: tint(0.09), skyBottom: tint(0.3), skyTop: tint(0.2), sun: tint(0.55), sunCore: tint(0.5) }
    : { far: tint(0.24), mid: tint(0.34), mist: palette.paper, nearBottom: tint(0.62), nearTop: tint(0.46), skyBottom: tint(0.05), skyTop: tint(0.15), sun: palette.paper, sunCore: palette.paper };
}

function focusStops(palette: BrandPalette): PhotoStops {
  const { accent, deep, highlight, paper, secondary } = palette;
  return {
    far: mixHexColors(accent, paper, 0.55),
    mid: mixHexColors(accent, deep, 0.32),
    mist: paper,
    nearBottom: deep,
    nearTop: mixHexColors(deep, accent, 0.3),
    skyBottom: mixHexColors(paper, highlight, 0.5),
    skyTop: mixHexColors(mixHexColors(secondary, accent, 0.25), paper, 0.3),
    sun: highlight,
    sunCore: mixHexColors(highlight, paper, 0.45),
  };
}

function wallTones(palette: BrandPalette, dark: boolean, photo: PhotoTones, area: string): Tones {
  const { accent, deep, highlight, ink, paper } = palette;
  const card = dark ? mixHexColors(deep, paper, 0.08) : paper;
  return {
    area,
    card,
    edge: dark ? mixHexColors(deep, paper, 0.15) : mixHexColors(paper, ink, 0.1),
    line: dark ? mixHexColors(deep, paper, 0.34) : mixHexColors(paper, ink, 0.44),
    mark: mixHexColors(card, accent, 0.32),
    photo,
    soft: dark ? mixHexColors(deep, paper, 0.2) : mixHexColors(paper, ink, 0.2),
    sticky: dark ? mixHexColors(deep, highlight, 0.42) : mixHexColors(highlight, paper, 0.25),
    stickyInk: dark ? mixHexColors(deep, highlight, 0.18) : mixHexColors(highlight, ink, 0.5),
    tape: dark ? mixHexColors(deep, paper, 0.28) : mixHexColors(paper, ink, 0.07),
  };
}

function focusTones(palette: BrandPalette, photo: PhotoTones, area: string): Tones {
  const { accent, highlight, ink, paper } = palette;
  return {
    area,
    card: paper,
    edge: mixHexColors(paper, ink, 0.12),
    line: ink,
    mark: accent,
    photo,
    soft: mixHexColors(paper, ink, 0.36),
    sticky: highlight,
    stickyInk: mixHexColors(highlight, ink, 0.55),
    tape: mixHexColors(paper, ink, 0.07),
  };
}

/** Crop-mark brackets just outside each corner of the window. */
function brackets(window: Box, unit: number, color: string): string {
  const offset = unit * 0.018;
  const arm = unit * 0.042;
  const left = window.x - offset;
  const right = window.x + window.w + offset;
  const top = window.y - offset;
  const bottom = window.y + window.h + offset;
  const d = `M${round(left)} ${round(top + arm)}V${round(top)}H${round(left + arm)}M${round(right - arm)} ${round(top)}H${round(right)}V${round(top + arm)}M${round(right)} ${round(bottom - arm)}V${round(bottom)}H${round(right - arm)}M${round(left + arm)} ${round(bottom)}H${round(left)}V${round(bottom - arm)}`;
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${round(Math.max(1.25, unit * 0.0045))}" stroke-linecap="square"/>`;
}

function labelTab(frame: Frame, unit: number, stroke: number, palette: BrandPalette): string {
  const { tabH, window } = frame;
  const tabW = Math.min(window.w * 0.46, Math.max(unit * 0.13, window.w * 0.36));
  const x = window.x - stroke / 2;
  const y = window.y - stroke / 2 - tabH;
  const onAccent = readableOn(palette.accent, palette);
  const dot = tabH * 0.26;
  return `<path d="M${round(x)} ${round(y + tabH + stroke / 2)}V${round(y + tabH * 0.18)}Q${round(x)} ${round(y)} ${round(x + tabH * 0.18)} ${round(y)}H${round(x + tabW - tabH * 0.18)}Q${round(x + tabW)} ${round(y)} ${round(x + tabW)} ${round(y + tabH * 0.18)}V${round(y + tabH + stroke / 2)}Z" fill="${palette.accent}"/>${rect({ h: dot, w: dot, x: x + tabH * 0.38, y: y + (tabH - dot) / 2 }, onAccent)}${bar(x + tabH * 0.38 + dot * 1.9, y + tabH / 2 - Math.max(0.8, tabH * 0.07), tabW * 0.46, Math.max(1.6, tabH * 0.14), onAccent, 0.9)}${bar(x + tabW - tabH * 0.38 - tabH * 0.36, y + tabH / 2 - Math.max(0.8, tabH * 0.07), tabH * 0.36, Math.max(1.6, tabH * 0.14), onAccent, 0.6)}`;
}

function focusSticky(frame: Frame, w: number, unit: number, layer: Layer): string {
  const size = unit * 0.13;
  const { window } = frame;
  const fitsRight = window.x + window.w + size * 0.62 < w - unit * 0.04;
  const x = fitsRight ? window.x + window.w - size * 0.38 : window.x - size * 0.62;
  const y = window.y + window.h * 0.58;
  const box = { h: size, w: size, x, y };
  const angle = (fitsRight ? 1 : -1) * (3 + layer.random() * 3);
  return `<g transform="rotate(${round(angle)} ${round(x + size / 2)} ${round(y + size / 2)})">${rect({ ...box, y: y + unit * 0.006 }, layer.tones.line, ' fill-opacity="0.14"')}${stickyNote(box, layer)}</g>`;
}

/**
 * Starter: the signal window. A research wall of evidence (photographs
 * reduced to tone, charts, notes, swatches, highlight stickies) recedes
 * out of focus behind a veil; one accent window with crop-mark brackets
 * and a label tab holds the card that matters, crisp and lit.
 */
export function signalWindowDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const dark = tone === 'dark';
  const unit = Math.min(w, h);
  const stroke = Math.max(1, unit * 0.0032);
  const detail = unit >= 300;
  const focusKind = weighted<FocusKind>(random, [['photo', 0.5], ['chart', 0.25], ['note', 0.25]]);
  const frame = placeFocus(w, h, unit, focusKind, random);
  const { window } = frame;
  const clear = { h: window.h + frame.tabH + unit * 0.05, w: window.w + unit * 0.05, x: window.x - unit * 0.025, y: window.y - frame.tabH - unit * 0.025 };

  const wallPhoto = photoSet(id, 'w', wallStops(palette, dark));
  const focusPhotoSet = photoSet(id, 'f', focusStops(palette));
  const wall = wallTones(palette, dark, wallPhoto.tones, id('wArea'));
  const lit = focusTones(palette, focusPhotoSet.tones, id('fArea'));
  const wallLayer: Layer = { detail, random, stroke, tones: wall };
  const focusLayer: Layer = { detail, random, stroke, tones: lit };
  const shadowInk = contrastRatio(palette.ink, palette.paper) > contrastRatio(palette.deep, palette.paper) ? palette.ink : palette.deep;
  const chips = [palette.accent, palette.secondary, palette.highlight, palette.deep].map((color) => mixHexColors(color, wall.card, dark ? 0.6 : 0.5));
  // Wide bands size the wall by area, so a 3:1 strip does not fill with tiny cards.
  const cards = layoutWall(w, h, Math.max(unit, Math.sqrt(w * h) * 0.75), clear, random).map((card) => wallCardMarkup(card, wallLayer, unit, chips, shadowInk)).join('');

  const ground = dark ? palette.deep : palette.muted;
  const centerX = window.x + window.w / 2;
  const centerY = window.y + window.h / 2;
  const reach = Math.hypot(w, h) * 0.62;
  const defs = [
    wallPhoto.defs,
    focusPhotoSet.defs,
    gradient(wall.area, [[0, wall.line, 0.28], [1, wall.line, 0]]),
    gradient(lit.area, [[0, palette.accent, 0.26], [1, palette.accent, 0]]),
    radial(id('light'), centerX, centerY, unit * 0.8, dark ? [[0, palette.accent, 0.4], [0.5, palette.accent, 0.1], [1, palette.accent, 0]] : [[0, palette.paper, 0.6], [1, palette.paper, 0]]),
    radial(id('vignette'), centerX, centerY, reach, [[0.35, shadowInk, 0], [1, shadowInk, dark ? 0.5 : 0.1]]),
    `<pattern id="${id('dots')}" width="${round(unit * 0.036)}" height="${round(unit * 0.036)}" patternUnits="userSpaceOnUse">${circle(unit * 0.018, unit * 0.018, Math.max(0.5, unit * 0.0022), dark ? palette.paper : palette.ink, ` fill-opacity="${dark ? 0.08 : 0.1}"`)}</pattern>`,
    `<filter id="${id('depth')}" x="0" y="0" width="${round(w)}" height="${round(h)}" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="${round(unit * 0.0034)}"/></filter>`,
    `<filter id="${id('soft')}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${round(unit * 0.018)}"/></filter>`,
  ].join('');

  const frameStroke = Math.max(2, unit * 0.0075);
  const veil = rect({ h, w, x: 0, y: 0 }, ground, ` fill-opacity="${dark ? 0.32 : 0.22}"`);
  const atmosphere = `${rect({ h, w, x: 0, y: 0 }, `url(#${id('light')})`)}${rect({ h, w, x: 0, y: 0 }, `url(#${id('vignette')})`)}`;
  const plate = rect(window, dark ? mixHexColors(palette.deep, palette.accent, 0.26) : mixHexColors(palette.paper, palette.accent, 0.08));
  const lift = dark
    ? rect(window, 'none', ` stroke="${palette.accent}" stroke-width="${round(frameStroke * 2.4)}" filter="url(#${id('soft')})"`)
    : rect({ ...frame.box, y: frame.box.y + unit * 0.02 }, shadowInk, ` fill-opacity="0.2" filter="url(#${id('soft')})"`);
  const card = rect(frame.box, lit.card, ` rx="${round(stroke)}"`);
  const content = focusKind === 'photo' ? focusPhoto(frame.box, focusLayer) : focusKind === 'chart' ? focusChart(frame.box, focusLayer, palette.accent) : focusNote(frame.box, focusLayer, palette);
  // An accent too close to the ground (a pale lime on paper) gets ink keylines on both sides.
  const keyStroke = round(Math.max(1, frameStroke * 0.28));
  const keyline = (inset: number) => rect({ h: window.h - inset * 2, w: window.w - inset * 2, x: window.x + inset, y: window.y + inset }, 'none', ` stroke="${shadowInk}" stroke-opacity="0.7" stroke-width="${keyStroke}"`);
  const keylines = contrastRatio(palette.accent, ground) < 1.7 ? keyline(-frameStroke * 0.5) + keyline(frameStroke * 0.5) : '';
  const outline = `${rect(window, 'none', ` stroke="${palette.accent}" stroke-width="${round(frameStroke)}"`)}${keylines}`;
  const note = detail && focusKind !== 'note' ? focusSticky(frame, w, unit, focusLayer) : '';
  const bracketColor = dark ? palette.paper : palette.ink;

  return `<defs>${defs}</defs>${deviceBackground(context, ground, ground)}${rect({ h, w, x: 0, y: 0 }, `url(#${id('dots')})`)}<g filter="url(#${id('depth')})">${cards}</g>${veil}${atmosphere}${dark ? lift + plate : plate + lift}${card}${content}${outline}${note}${brackets(window, unit, bracketColor)}${labelTab(frame, unit, frameStroke, palette)}`;
}
