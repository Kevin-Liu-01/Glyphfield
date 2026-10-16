import { contrastRatio, round, type DeviceContext } from '../brandDeviceContext';
import { mixHexColors } from '../color';

/**
 * The default device for new identities: a Swiss modular construction field. A column grid with
 * baseline subdivisions and registration marks carries one bold accent module that interlocks with a
 * secondary module along a stepped seam, keyed by a highlight quadrant and layered over tonal plates.
 */

type Frame = {
  baseline: number;
  columns: number;
  gutter: number;
  margin: number;
  pitch: number;
  rowPitch: number;
  rows: number;
  unit: number;
  width: number;
};

type Block = {
  columns: number;
  flip: boolean;
  rows: number;
  split: number[];
  x: number;
  y: number;
};

type Inks = {
  accent: string;
  ground: string;
  hair: number;
  highlight: string;
  rule: string;
  secondary: string;
  tint: (amount: number) => string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** A palette colour moved toward `toward` until it separates from the ground it sits on. */
function separated(color: string, ground: string, toward: string, minimum: number): string {
  for (let step = 0; step < 10; step += 1) {
    const candidate = mixHexColors(color, toward, step * 0.1);
    if (contrastRatio(candidate, ground) >= minimum) return candidate;
  }
  return toward;
}

function box(x0: number, y0: number, x1: number, y1: number, paint: string): string {
  return `<rect x="${round(x0)}" y="${round(y0)}" width="${round(x1 - x0)}" height="${round(y1 - y0)}" ${paint}/>`;
}

function gridFrame(w: number, h: number): Frame {
  const unit = Math.min(w, h);
  const margin = unit * 0.075;
  const gutter = unit * 0.018;
  const columns = clamp(Math.round((w - margin * 2) / (unit * 0.14) / 2) * 2, 4, 24);
  const pitch = (w - margin * 2 + gutter) / columns;
  const rows = Math.max(3, Math.round((h - margin * 2) / pitch));
  // Rows are separated by one baseline, so every module edge sits on the baseline grid.
  const lines = clamp(Math.round(pitch / (unit * 0.024)), 3, 8);
  const rowPitch = (h - margin * 2) / (rows - 1 / lines);
  return { baseline: rowPitch / lines, columns, gutter, margin, pitch, rowPitch, rows, unit, width: pitch - gutter };
}

const left = (frame: Frame, column: number) => frame.margin + column * frame.pitch;
const right = (frame: Frame, column: number) => left(frame, column) + frame.width;
const top = (frame: Frame, row: number) => frame.margin + row * frame.rowPitch;
const bottom = (frame: Frame, row: number) => top(frame, row) + frame.rowPitch - frame.baseline;

function moduleBox(frame: Frame, c0: number, r0: number, c1: number, r1: number, paint: string): string {
  return box(left(frame, c0), top(frame, r0), right(frame, c1), bottom(frame, r1), paint);
}

function layoutBlock(frame: Frame, random: () => number, wide: boolean): Block {
  const rows = Math.max(2, Math.min(frame.rows - 2, Math.round(frame.rows * 0.6)));
  const columns = clamp(Math.round(rows * (1.3 + random() * 0.4)), 3, frame.columns - 2);
  const freeColumns = frame.columns - columns;
  const freeRows = frame.rows - rows;
  const x = clamp(Math.round(freeColumns * (wide ? 0.62 + random() * 0.16 : 0.5)), Math.min(1, freeColumns), Math.max(0, freeColumns - 1));
  const y = clamp(Math.round(freeRows * (0.3 + random() * 0.4)), Math.min(1, freeRows), Math.max(0, freeRows - 1));
  // The seam steps inward one module at a time and at most half the rows, so the accent piece
  // stays the larger, bolder half and the secondary piece locks into it as a stepped L.
  const split: number[] = [];
  let edge = Math.max(2, columns - 1 - Math.floor(random() * 2));
  let steps = Math.ceil(rows / 2);
  for (let row = 0; row < rows; row += 1) {
    split.push(edge);
    if (steps > 0 && edge > 2 && random() < 0.62) {
      edge -= 1;
      steps -= 1;
    }
  }
  if (split.every((value) => value === split[0])) split[rows - 1] = split[0]! - 1;
  return { columns, flip: random() < 0.35, rows, split, x, y };
}

/** Global column span for a run of block-local columns, honouring the mirror. */
function blockSpan(frame: Frame, block: Block, c0: number, c1: number): [number, number] {
  const a = block.x + (block.flip ? block.columns - 1 - c1 : c0);
  const b = block.x + (block.flip ? block.columns - 1 - c0 : c1);
  return [left(frame, a), right(frame, b)];
}

/**
 * The two interlocking pieces as single outlines. The seam keeps one gutter between them: the
 * accent's edge steps along module bottoms, the secondary's along module tops.
 */
function blockPieces(frame: Frame, block: Block, accentPaint: string, secondaryPaint: string): string {
  const x0 = left(frame, block.x);
  const x1 = right(frame, block.x + block.columns - 1);
  const mx = (x: number) => round(block.flip ? x0 + x1 - x : x);
  const last = block.rows - 1;
  const top0 = top(frame, block.y);
  const floor = bottom(frame, block.y + last);
  const accentEdge = (row: number) => right(frame, block.x + block.split[row]! - 1);
  const secondaryEdge = (row: number) => left(frame, block.x + block.split[row]!);
  let accent = `M${mx(x0)} ${round(top0)}H${mx(accentEdge(0))}`;
  let secondary = `M${mx(x1)} ${round(top0)}H${mx(secondaryEdge(0))}`;
  for (let row = 0; row < last; row += 1) {
    accent += `V${round(bottom(frame, block.y + row))}H${mx(accentEdge(row + 1))}`;
    secondary += `V${round(top(frame, block.y + row + 1))}H${mx(secondaryEdge(row + 1))}`;
  }
  accent += `V${round(floor)}H${mx(x0)}Z`;
  secondary += `V${round(floor)}H${mx(x1)}Z`;
  return `<path d="${secondary}" ${secondaryPaint}/><path d="${accent}" ${accentPaint}/>`;
}

type Key = { dx: number; dy: number; px: number; py: number; radius: number };

/** A quarter disc pivoting on a module corner: the highlight key where the seam leaves the block. */
function keyGeometry(frame: Frame, block: Block): Key {
  const above = block.y > 0;
  const localColumn = above ? block.split[0]! : block.split[block.rows - 1]! - 1;
  const column = block.x + (block.flip ? block.columns - 1 - localColumn : localColumn);
  const row = above ? block.y - 1 : block.y + block.rows;
  // The pivot sits on the seam line so the key reads as the seam's continuation.
  const pivotLeft = above !== block.flip;
  return {
    dx: pivotLeft ? 1 : -1,
    dy: above ? -1 : 1,
    px: pivotLeft ? left(frame, column) : right(frame, column),
    py: above ? bottom(frame, row) : top(frame, row),
    radius: Math.min(frame.width, frame.rowPitch - frame.baseline),
  };
}

function highlightKey(key: Key, fill: string): string {
  const { dx, dy, px, py, radius } = key;
  const sweep = dx * dy < 0 ? 1 : 0;
  return `<path d="M${round(px)} ${round(py)}V${round(py + dy * radius)}A${round(radius)} ${round(radius)} 0 0 ${sweep} ${round(px + dx * radius)} ${round(py)}Z" fill="${fill}"/>`;
}

/** Construction geometry from the key's pivot: compass arcs on the module pitch and a 45 degree diagonal. */
function construction(frame: Frame, key: Key, inks: Inks, clip: string): string {
  const { px, py } = key;
  const radii = [2, 3].map((count) => count * frame.pitch - frame.gutter);
  const circles = radii.map((radius) => `<circle cx="${round(px)}" cy="${round(py)}" r="${round(radius)}"/>`).join('');
  const reach = frame.unit * 3;
  const dash = `${round(frame.unit * 0.006)} ${round(frame.unit * 0.008)}`;
  const target = key.radius * 0.12;
  return `<g clip-path="url(#${clip})" fill="none" stroke="${inks.rule}" stroke-width="${round(inks.hair)}" stroke-dasharray="${dash}" stroke-opacity=".3">${circles}<path d="M${round(px - reach * key.dx)} ${round(py - reach * key.dy)}L${round(px + reach * key.dx)} ${round(py + reach * key.dy)}"/></g>`
    + `<circle cx="${round(px)}" cy="${round(py)}" r="${round(target)}" fill="${inks.ground}" stroke="${inks.rule}" stroke-opacity=".8" stroke-width="${round(inks.hair)}"/>`;
}

function gridLines(frame: Frame, w: number, h: number, inks: Inks, patterns: { baseline: string; cross: string }): string {
  const { margin } = frame;
  const edges: string[] = [];
  for (let column = 0; column < frame.columns; column += 1) {
    edges.push(`M${round(left(frame, column))} ${round(margin)}V${round(h - margin)}M${round(right(frame, column))} ${round(margin)}V${round(h - margin)}`);
  }
  for (let row = 0; row < frame.rows; row += 1) {
    edges.push(`M${round(margin)} ${round(top(frame, row))}H${round(w - margin)}M${round(margin)} ${round(bottom(frame, row))}H${round(w - margin)}`);
  }
  const reach = frame.gutter * 0.6 + 2;
  return `${box(margin, margin, w - margin, h - margin, `fill="url(#${patterns.baseline})"`)}<path d="${edges.join('')}" stroke="${inks.rule}" stroke-opacity=".12" stroke-width="${round(inks.hair)}" fill="none"/>${box(margin - frame.gutter / 2 - reach, margin - frame.baseline / 2 - reach, w - margin + frame.gutter / 2 + reach, h - margin + frame.baseline / 2 + reach, `fill="url(#${patterns.cross})"`)}`;
}

function gridPatterns(frame: Frame, inks: Inks, ids: { baseline: string; cross: string; hatch: string }, dark: boolean): string {
  const arm = frame.gutter * 0.6;
  const hair = inks.hair;
  const cx = frame.pitch / 2;
  const cy = frame.rowPitch / 2;
  const hatch = Math.max(4, frame.unit * 0.012);
  return `<pattern id="${ids.baseline}" x="${round(frame.margin)}" y="${round(frame.margin)}" width="${round(frame.pitch)}" height="${round(frame.baseline)}" patternUnits="userSpaceOnUse"><rect width="${round(frame.width)}" height="${round(hair)}" fill="${inks.rule}" fill-opacity="${dark ? '.06' : '.065'}"/></pattern>`
    + `<pattern id="${ids.cross}" x="${round(frame.margin - frame.gutter / 2 - cx)}" y="${round(frame.margin - frame.baseline / 2 - cy)}" width="${round(frame.pitch)}" height="${round(frame.rowPitch)}" patternUnits="userSpaceOnUse"><path d="M${round(cx - arm)} ${round(cy)}H${round(cx + arm)}M${round(cx)} ${round(cy - arm)}V${round(cy + arm)}" stroke="${inks.rule}" stroke-opacity=".42" stroke-width="${round(hair)}"/></pattern>`
    + `<pattern id="${ids.hatch}" width="${round(hatch)}" height="${round(hatch)}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${round(Math.max(1, hair * 1.2))}" height="${round(hatch)}" fill="${inks.rule}" fill-opacity="${dark ? '.16' : '.14'}"/></pattern>`;
}

/** Crop marks at the type area's corners, rulers along two margins and registration targets on the other two. */
function registration(frame: Frame, w: number, h: number, inks: Inks): string {
  const { margin } = frame;
  const gap = margin * 0.2;
  const reach = margin * 0.42;
  const crops = [[margin, margin, -1, -1], [w - margin, margin, 1, -1], [margin, h - margin, -1, 1], [w - margin, h - margin, 1, 1]]
    .map(([x, y, sx, sy]) => `M${round(x! + sx! * gap)} ${round(y!)}h${round(sx! * reach)}M${round(x!)} ${round(y! + sy! * gap)}v${round(sy! * reach)}`)
    .join('');
  const ticks: string[] = [];
  const rulerY = margin * 0.68;
  for (let column = 0; column < frame.columns; column += 1) {
    const x0 = left(frame, column);
    ticks.push(`M${round(x0)} ${round(rulerY)}v${round(-margin * 0.22)}M${round(right(frame, column))} ${round(rulerY)}v${round(-margin * 0.22)}`);
    for (let quarter = 1; quarter < 4; quarter += 1) ticks.push(`M${round(x0 + (frame.width * quarter) / 4)} ${round(rulerY)}v${round(-margin * 0.1)}`);
  }
  const rulerX = margin * 0.68;
  const lines = Math.round((h - margin * 2) / frame.baseline);
  for (let line = 0; line <= lines; line += 1) {
    const y = margin + line * frame.baseline;
    const major = Math.abs(((y - margin) % frame.rowPitch)) < 0.5 || Math.abs(((y - margin) % frame.rowPitch) - frame.rowPitch) < 0.5;
    ticks.push(`M${round(rulerX)} ${round(y)}h${round(-margin * (major ? 0.22 : 0.1))}`);
  }
  const target = (x: number, y: number) => {
    const radius = margin * 0.17;
    return `<circle cx="${round(x)}" cy="${round(y)}" r="${round(radius)}"/><path d="M${round(x - radius * 1.9)} ${round(y)}H${round(x + radius * 1.9)}M${round(x)} ${round(y - radius * 1.9)}V${round(y + radius * 1.9)}"/>`;
  };
  return `<g stroke="${inks.rule}" stroke-width="${round(inks.hair)}" fill="none"><path d="${crops}" stroke-opacity=".7"/><path d="${ticks.join('')}" stroke-opacity=".4"/><g stroke-opacity=".6">${target(w - margin / 2, h / 2)}${target(w / 2, h - margin / 2)}</g></g>`;
}

/** Dimension lines along the block's free edges, the way a grid sheet annotates a module. */
function dimensions(frame: Frame, block: Block, inks: Inks): string {
  const [x0, x1] = blockSpan(frame, block, 0, block.columns - 1);
  const y0 = top(frame, block.y);
  const y1 = bottom(frame, block.y + block.rows - 1);
  const tick = frame.baseline * 0.32;
  const below = block.y > 0 ? y1 + frame.baseline / 2 : y0 - frame.baseline / 2;
  const side = block.flip ? x1 + frame.gutter / 2 : x0 - frame.gutter / 2;
  const d = `M${round(x0)} ${round(below)}H${round(x1)}M${round(x0)} ${round(below - tick)}v${round(tick * 2)}M${round(x1)} ${round(below - tick)}v${round(tick * 2)}`
    + `M${round(side)} ${round(y0)}V${round(y1)}M${round(side - tick)} ${round(y0)}h${round(tick * 2)}M${round(side - tick)} ${round(y1)}h${round(tick * 2)}`;
  return `<path d="${d}" stroke="${inks.rule}" stroke-opacity=".5" stroke-width="${round(inks.hair)}" fill="none"/>`;
}

function definitions(context: DeviceContext, frame: Frame, block: Block, inks: Inks): string {
  const { id, palette, tone, w, h } = context;
  const dark = tone === 'dark';
  const [bx0, bx1] = blockSpan(frame, block, 0, block.columns - 1);
  const by0 = top(frame, block.y);
  const by1 = bottom(frame, block.y + block.rows - 1);
  const cx = (bx0 + bx1) / 2;
  const cy = (by0 + by1) / 2;
  const sheen = `<linearGradient id="${id('accent')}" x1="${round(Math.min(bx0, bx1))}" y1="${round(by0)}" x2="${round(Math.max(bx0, bx1))}" y2="${round(by1)}" gradientUnits="userSpaceOnUse"><stop stop-color="${mixHexColors(inks.accent, '#FFFFFF', dark ? 0.16 : 0.1)}"/><stop offset=".55" stop-color="${inks.accent}"/><stop offset="1" stop-color="${mixHexColors(inks.accent, palette.deep, 0.16)}"/></linearGradient>`;
  const second = `<linearGradient id="${id('secondary')}" x1="0" y1="${round(by0)}" x2="0" y2="${round(by1)}" gradientUnits="userSpaceOnUse"><stop stop-color="${mixHexColors(inks.secondary, '#FFFFFF', 0.08)}"/><stop offset="1" stop-color="${mixHexColors(inks.secondary, palette.deep, dark ? 0.12 : 0.04)}"/></linearGradient>`;
  const glow = `<radialGradient id="${id('glow')}" cx="${round(cx)}" cy="${round(cy)}" r="${round(Math.max(w, h) * 0.55)}" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.accent}" stop-opacity="${dark ? '.2' : '.07'}"/><stop offset=".5" stop-color="${palette.accent}" stop-opacity="${dark ? '.06' : '.02'}"/><stop offset="1" stop-color="${palette.accent}" stop-opacity="0"/></radialGradient>`;
  const panel = `<linearGradient id="${id('panel')}" x1="0" y1="0" x2="0" y2="${round(h)}" gradientUnits="userSpaceOnUse"><stop stop-color="${inks.tint(dark ? 0.035 : 0.03)}"/><stop offset="1" stop-color="${inks.tint(dark ? 0.1 : 0.07)}"/></linearGradient>`;
  const focus = `<radialGradient id="${id('focusFade')}" cx="${round(cx)}" cy="${round(cy)}" r="${round(Math.max(w, h) * 0.72)}" gradientUnits="userSpaceOnUse"><stop stop-color="#FFFFFF"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity=".8"/><stop offset="1" stop-color="#FFFFFF" stop-opacity=".25"/></radialGradient><mask id="${id('focus')}" maskUnits="userSpaceOnUse" x="0" y="0" width="${round(w)}" height="${round(h)}">${box(0, 0, w, h, `fill="url(#${id('focusFade')})"`)}</mask>`;
  const clip = `<clipPath id="${id('field')}">${box(frame.margin, frame.margin, w - frame.margin, h - frame.margin, '')}</clipPath>`;
  return `<defs>${sheen}${second}${glow}${panel}${focus}${clip}${gridPatterns(frame, inks, { baseline: id('baseline'), cross: id('cross'), hatch: id('hatch') }, dark)}</defs>`;
}

/** Tonal plates behind the block: a tall panel it straddles, a hatched field and a shadow plate one module down. */
function plates(context: DeviceContext, frame: Frame, block: Block, inks: Inks): string {
  const { id, random } = context;
  const panelStart = clamp(block.flip ? block.x + block.columns - 2 : block.x - 2 - Math.floor(random() * 2), 0, frame.columns - 1);
  const panelEnd = clamp(panelStart + 3 + Math.floor(random() * 2), 0, frame.columns - 1);
  const panel = moduleBox(frame, panelStart, 0, panelEnd, frame.rows - 1, `fill="url(#${id('panel')})"`)
    + moduleBox(frame, panelStart, 0, panelEnd, frame.rows - 1, `fill="url(#${id('baseline')})"`);
  const hatchRow = block.y + block.rows < frame.rows ? block.y + block.rows : Math.max(0, block.y - 1);
  const hatchStart = block.flip ? block.x + 1 : block.x + block.columns - 2;
  const hatch = moduleBox(frame, clamp(hatchStart, 0, frame.columns - 1), hatchRow, clamp(hatchStart + 2, 0, frame.columns - 1), Math.min(frame.rows - 1, hatchRow + 1), `fill="url(#${id('hatch')})"`);
  const sx = block.x + 1;
  const plate = moduleBox(frame, sx, Math.min(frame.rows - 1, block.y + 1), Math.min(frame.columns - 1, sx + block.columns - 1), Math.min(frame.rows - 1, block.y + block.rows), `fill="${inks.tint(context.tone === 'dark' ? 0.13 : 0.09)}"`);
  return `${panel}${hatch}${plate}`;
}

export function gridDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const dark = tone === 'dark';
  const ground = dark ? palette.deep : palette.paper;
  const rule = dark ? palette.paper : palette.ink;
  // Pale roles on paper deepen toward a dark accent so they keep the brand's hue instead of going grey.
  const away = dark ? '#FFFFFF' : mixHexColors(palette.accent, palette.deep, 0.45);
  // Tonal plates carry a little of the accent so depth reads as the brand's colour, not neutral grey.
  const toneBase = mixHexColors(rule, palette.accent, dark ? 0.6 : 0.55);
  const frame = gridFrame(w, h);
  const inks: Inks = {
    accent: dark ? separated(palette.accent, ground, '#FFFFFF', 2) : palette.accent,
    ground,
    hair: Math.max(0.75, frame.unit * 0.0012),
    highlight: separated(palette.highlight, ground, away, 1.6),
    rule,
    secondary: separated(palette.secondary, ground, away, 1.4),
    tint: (amount) => mixHexColors(ground, toneBase, amount),
  };
  // A piece too close to its ground keeps its true colour and gains a hairline edge instead.
  const edge = (fill: string) => contrastRatio(fill, ground) < 1.6
    ? ` stroke="${mixHexColors(fill, palette.deep, 0.55)}" stroke-width="${round(inks.hair * 1.2)}" stroke-linejoin="miter"`
    : '';
  const block = layoutBlock(frame, random, w / h > 1.25);
  const key = keyGeometry(frame, block);
  return definitions(context, frame, block, inks)
    + box(0, 0, w, h, `fill="${ground}"`)
    + box(0, 0, w, h, `fill="url(#${id('glow')})"`)
    + `<g mask="url(#${id('focus')})">${plates(context, frame, block, inks)}${gridLines(frame, w, h, inks, { baseline: id('baseline'), cross: id('cross') })}</g>`
    + blockPieces(frame, block, `fill="url(#${id('accent')})"${edge(inks.accent)}`, `fill="url(#${id('secondary')})"${edge(inks.secondary)}`)
    + highlightKey(key, inks.highlight)
    + construction(frame, key, inks, id('field'))
    + dimensions(frame, block, inks)
    + registration(frame, w, h, inks);
}
