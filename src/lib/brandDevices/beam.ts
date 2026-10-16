import { deviceBackground, round, type DeviceContext } from '../brandDeviceContext';
import type { BrandPalette } from '../brandOutputKit';
import { mixHexColors } from '../color';

type Point = readonly [number, number];
type Segment = readonly [Point, Point, Point, Point];
type Strand = { readonly a: Segment; readonly b: Segment };
/** The frame and the docs tile every layer is placed against. */
type Layout = { readonly cx: number; readonly cy: number; readonly h: number; readonly size: number; readonly unit: number; readonly w: number };

/** Deterministic lattice hash in [0, 1]; the noise below is fixed, `random()` only moves where it is sampled. */
function latticeHash(x: number, y: number): number {
  let value = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967295;
}

function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smoothStep(x - xi);
  const yf = smoothStep(y - yi);
  const a = latticeHash(xi, yi);
  const b = latticeHash(xi + 1, yi);
  const c = latticeHash(xi, yi + 1);
  const d = latticeHash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}

/** Three octaves of value noise: the ragged edge of the dot clusters. */
function clusterNoise(x: number, y: number): number {
  return 0.6 * valueNoise(x, y) + 0.3 * valueNoise(x * 2.1 + 17, y * 2.1 + 5) + 0.1 * valueNoise(x * 4.3 + 3, y * 4.3 + 11);
}

function bezierPoint(segment: Segment, t: number): Point {
  const [p0, p1, p2, p3] = segment;
  const m = 1 - t;
  const k0 = m * m * m;
  const k1 = 3 * m * m * t;
  const k2 = 3 * m * t * t;
  const k3 = t * t * t;
  return [k0 * p0[0] + k1 * p1[0] + k2 * p2[0] + k3 * p3[0], k0 * p0[1] + k1 * p1[1] + k2 * p2[1] + k3 * p3[1]];
}

function point(value: Point): string {
  return `${round(value[0])} ${round(value[1])}`;
}

function strandPath(strand: Strand): string {
  const [start, c1, c2, waist] = strand.a;
  const [, c3, c4, end] = strand.b;
  return `M${point(start)}C${point(c1)} ${point(c2)} ${point(waist)}C${point(c3)} ${point(c4)} ${point(end)}`;
}

function squares(points: readonly Point[], size: number): string {
  const s = round(size);
  return points.map(([x, y]) => `M${round(x - size / 2)} ${round(y - size / 2)}h${s}v${s}h-${s}z`).join('');
}


/** The docs tile is the focal object: centred, nudged a little per element, always whole. */
function beamLayout(w: number, h: number, random: () => number): Layout {
  const unit = Math.min(w, h);
  const size = unit * 0.27;
  const margin = unit * 0.1 + size / 2;
  const cx = Math.min(w - margin, Math.max(margin, w * (0.5 + (random() - 0.5) * 0.08)));
  const cy = Math.min(h - margin, Math.max(margin, h * (0.5 + (random() - 0.5) * 0.06)));
  return { cx, cy, h, size, unit, w };
}

/**
 * Strands enter low on the left, pinch through the tile and leave high on the
 * right, crossing past the waist. Count, fan and ripple phase change per
 * element; the sweep direction does not.
 */
function strandBundle(layout: Layout, random: () => number): { core: Strand; strands: Strand[] } {
  const { cx, cy, h, size, w } = layout;
  const count = 15 + Math.floor(random() * 9);
  const drop = 0.26 + random() * 0.08;
  const rise = 0.27 + random() * 0.08;
  const fanLeft = 0.68 + random() * 0.16;
  const fanRight = 0.62 + random() * 0.16;
  const sweep = 0.19 + random() * 0.04;
  const phase = random() * Math.PI * 2;
  const makeStrand = (u: number, e: number, waistOffset: number): Strand => {
    const waist: Point = [cx, cy + waistOffset * size * 0.17];
    const start: Point = [-w * 0.05, cy + h * (drop + e * fanLeft)];
    const end: Point = [w * 1.05, cy - h * (rise + e * fanRight)];
    const rippleA = Math.sin(phase + u * 5) * h * 0.03;
    const rippleB = Math.cos(phase + u * 4) * h * 0.03;
    return {
      a: [start, [start[0] + w * (0.325 + e * 0.075), start[1] - h * 0.04 + rippleA], [cx - w * sweep, waist[1] + h * 0.07], waist],
      b: [waist, [cx + w * sweep, waist[1] - h * 0.07], [end[0] - w * (0.35 - e * 0.0875), end[1] + h * 0.06 + rippleB], end],
    };
  };
  const strands = Array.from({ length: count }, (_, index) => {
    const u = index / (count - 1) - 0.5;
    // Denser toward the core of the beam, with a slight irregularity.
    const e = (Math.sign(u) * Math.pow(Math.abs(u * 2), 1.25)) / 2 + (random() - 0.5) * 0.02;
    return makeStrand(u, e, u + (random() - 0.5) * 0.02);
  });
  return { core: makeStrand(0, 0, 0), strands };
}

/** One comet: a short run along a single strand, heading with the flow, inside the frame and off the tile. */
function cometRun(layout: Layout, strands: readonly Strand[], core: Strand, onFirst: boolean, random: () => number): Point[] {
  const { cx, cy, h, size, w } = layout;
  const clear = size * 0.75;
  const low = onFirst ? 0.1 : 0.28;
  const high = onFirst ? 0.72 : 0.9;
  const fits = ([x, y]: Point) => x > w * 0.04 && x < w * 0.96 && y > h * 0.05 && y < h * 0.95 && (Math.abs(x - cx) > clear || Math.abs(y - cy) > clear);
  let samples: Point[] = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const strand = strands[Math.floor(strands.length * (0.12 + random() * 0.76))] ?? core;
    const length = 0.1 + random() * 0.04;
    const t0 = low + random() * (high - low - length);
    samples = Array.from({ length: 13 }, (_, step) => bezierPoint(onFirst ? strand.a : strand.b, t0 + (length * step) / 12));
    if (fits(samples[0] ?? core.a[0]) && fits(samples[12] ?? core.a[3])) break;
  }
  return samples;
}

/** Two continents of square dots, upper left and lower right, ragged at the edge; `random()` picks which light up. */
function dotField(layout: Layout, random: () => number) {
  const { cx, cy, h, size, unit, w } = layout;
  const pitch = Math.max(7, unit * 0.04);
  const noiseX = random() * 64;
  const noiseY = random() * 64;
  const upper: Point = [w * (0.19 + random() * 0.08), h * (0.19 + random() * 0.06)];
  const lower: Point = [w * (0.74 + random() * 0.08), h * (0.77 + random() * 0.06)];
  const keepOut = size / 2 + pitch;
  const field = { dim: [] as Point[], lit: [] as Point[], mid: [] as Point[], pitch, spark: [] as Point[] };
  for (let gy = 0; gy < Math.ceil(h / pitch); gy += 1) {
    for (let gx = 0; gx < Math.ceil(w / pitch); gx += 1) {
      const x = (gx + 0.5) * pitch;
      const y = (gy + 0.5) * pitch;
      const nearUpper = Math.hypot((x - upper[0]) / (w * 0.375), (y - upper[1]) / (h * 0.33));
      const nearLower = Math.hypot((x - lower[0]) / (w * 0.375), (y - lower[1]) / (h * 0.32));
      const region = Math.max(1 - nearUpper, 1 - nearLower, 0);
      const value = region * 1.2 + (clusterNoise(gx / 3.6 + noiseX, gy / 3.6 + noiseY) - 0.5) * 1.5;
      const underTile = Math.abs(x - cx) < keepOut && Math.abs(y - cy) < keepOut;
      if (!underTile && value >= 0.34) field[dotTier(value, random())].push([x, y]);
    }
  }
  return field;
}

function dotTier(value: number, roll: number): 'dim' | 'lit' | 'mid' | 'spark' {
  if (value > 0.52 && roll < 0.045) return 'lit';
  if (value > 0.5 && roll > 0.975) return 'spark';
  return value > 0.56 ? 'mid' : 'dim';
}

/** Forest ground with mint light on dark; ink-tinted strands and an ink comet head on paper. */
function beamColors(palette: BrandPalette, dark: boolean) {
  const inked = (amount: number) => mixHexColors(palette.accent, palette.ink, amount);
  return {
    cometHead: dark ? palette.paper : inked(0.45),
    cometTail: dark ? palette.highlight : palette.accent,
    dot: dark ? palette.secondary : inked(0.2),
    lit: dark ? palette.secondary : palette.accent,
    shadow: dark ? mixHexColors(palette.deep, '#000000', 0.6) : palette.ink,
    spark: dark ? palette.paper : palette.ink,
    strandCore: dark ? palette.secondary : mixHexColors(palette.accent, palette.secondary, 0.3),
    strandEdge: dark ? palette.accent : inked(0.55),
    strandShoulder: dark ? palette.accent : inked(0.3),
  };
}

/** The white docs tile: title bar, three body lines and a code block with one accent token, on a soft shadow. */
function docsTile(layout: Layout, palette: BrandPalette, dark: boolean, shadow: string, filter: string): string {
  const { cx, cy, size, unit } = layout;
  const tileX = cx - size / 2;
  const tileY = cy - size / 2;
  const k = size / 264;
  const bar = (x: number, y: number, width: number, height: number, fill: string, opacity = 1, radius = height / 2) => (
    `<rect x="${round(tileX + x * k)}" y="${round(tileY + y * k)}" width="${round(width * k)}" height="${round(height * k)}" rx="${round(radius * k)}" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''}/>`
  );
  const edge = dark ? '' : ` stroke="${mixHexColors(palette.paper, palette.ink, 0.1)}" stroke-width="${round(Math.max(1, unit * 0.0012))}"`;
  return `<rect x="${round(tileX)}" y="${round(tileY + size * 0.053)}" width="${round(size)}" height="${round(size)}" rx="${round(size * 0.152)}" fill="${shadow}" fill-opacity="${dark ? 0.6 : 0.16}" filter="url(#${filter})"/>`
    + `<rect x="${round(tileX)}" y="${round(tileY)}" width="${round(size)}" height="${round(size)}" rx="${round(size * 0.152)}" fill="${palette.paper}"${edge}/>`
    + bar(40, 46, 122, 20, palette.ink)
    + bar(40, 86, 184, 10, palette.progress, 0.3)
    + bar(40, 108, 152, 10, palette.progress, 0.3)
    + bar(40, 130, 170, 10, palette.progress, 0.3)
    + bar(40, 160, 184, 58, palette.muted, 1, 12)
    + bar(56, 177, 46, 8, palette.accent)
    + bar(110, 177, 74, 8, palette.progress, 0.45)
    + bar(56, 194, 102, 8, palette.progress, 0.3);
}

/**
 * Mintlify: the knowledge beam. A bundle of thin strands sweeps in from the
 * lower left, pinches through a white docs tile and fans out to the upper
 * right, with a soft core glow, comet streaks riding single strands and a
 * field of square dots in ragged clusters behind it.
 */
export function beamDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const dark = tone === 'dark';
  const layout = beamLayout(w, h, random);
  const { cx, cy, unit } = layout;
  const { core, strands } = strandBundle(layout, random);
  const comets = Array.from({ length: 6 }, (_, index) => cometRun(layout, strands, core, index % 2 === 0, random));
  const dots = dotField(layout, random);
  const colors = beamColors(palette, dark);

  // Strands bottom out at one pixel; below that they fade instead, so small tiles keep the same weight.
  const strokeWidth = Math.max(1, unit * 0.0024);
  const strandOpacity = Math.max(0.55, Math.min(1, (unit * 0.0024) / strokeWidth));
  const cometWidth = Math.max(1.6, unit * 0.0042) * (dark ? 1 : 1.2);
  const dot = Math.max(1.2, dots.pitch * 0.125);
  const bigDot = Math.max(1.6, dots.pitch * 0.15);

  const cometDefs = comets.map((samples, index) => {
    const tail = samples[0] ?? core.a[0];
    const head = samples[samples.length - 1] ?? core.a[3];
    return `<linearGradient id="${id(`comet${index}`)}" gradientUnits="userSpaceOnUse" x1="${round(tail[0])}" y1="${round(tail[1])}" x2="${round(head[0])}" y2="${round(head[1])}"><stop stop-color="${colors.cometTail}" stop-opacity="0"/><stop offset=".75" stop-color="${colors.cometTail}" stop-opacity=".7"/><stop offset="1" stop-color="${colors.cometHead}"/></linearGradient>`;
  }).join('');
  const cometPaths = comets.map((samples, index) => `<path stroke="url(#${id(`comet${index}`)})" d="M${samples.map(point).join('L')}"/>`).join('');

  const defs = `<defs>`
    + `<radialGradient id="${id('lift')}" cx="${round(cx)}" cy="${round(cy)}" r="${round(Math.hypot(w, h) * 0.4)}" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.accent}" stop-opacity="${dark ? 0.2 : 0.09}"/><stop offset=".55" stop-color="${palette.accent}" stop-opacity="${dark ? 0.05 : 0.025}"/><stop offset="1" stop-color="${palette.accent}" stop-opacity="0"/></radialGradient>`
    + `<linearGradient id="${id('strand')}" gradientUnits="userSpaceOnUse" x1="${round(cx - w / 2)}" y1="0" x2="${round(cx + w / 2)}" y2="0"><stop stop-color="${colors.strandEdge}" stop-opacity=".3"/><stop offset=".28" stop-color="${colors.strandShoulder}" stop-opacity=".75"/><stop offset=".42" stop-color="${colors.strandCore}"/><stop offset=".58" stop-color="${colors.strandCore}"/><stop offset=".74" stop-color="${colors.strandShoulder}" stop-opacity=".8"/><stop offset="1" stop-color="${colors.strandEdge}" stop-opacity=".35"/></linearGradient>`
    + cometDefs
    + `<filter id="${id('glow')}" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="${round(unit * 0.046)}"/></filter>`
    + `<filter id="${id('shadow')}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${round(layout.size * 0.1)}"/></filter>`
    + `</defs>`;

  const field = `<rect width="${round(w)}" height="${round(h)}" fill="url(#${id('lift')})"/>`
    + `<path fill="${colors.dot}" fill-opacity="${dark ? 0.13 : 0.12}" d="${squares(dots.dim, dot)}"/>`
    + `<path fill="${colors.dot}" fill-opacity="${dark ? 0.26 : 0.24}" d="${squares(dots.mid, dot)}"/>`
    + `<path fill="${colors.lit}" d="${squares(dots.lit, bigDot)}"/>`
    + `<path fill="${colors.spark}" d="${squares(dots.spark, bigDot)}"/>`;

  const beam = `<path d="${strandPath(core)}" fill="none" stroke="${palette.accent}" stroke-opacity="${dark ? 0.5 : 0.2}" stroke-width="${round(unit * 0.11)}" filter="url(#${id('glow')})"/>`
    + `<g fill="none" stroke="url(#${id('strand')})" stroke-width="${round(strokeWidth)}"${strandOpacity < 1 ? ` stroke-opacity="${round(strandOpacity)}"` : ''}>${strands.map((strand) => `<path d="${strandPath(strand)}"/>`).join('')}</g>`
    + `<g fill="none" stroke-width="${round(cometWidth)}" stroke-linecap="round">${cometPaths}</g>`;

  return `${defs}${deviceBackground(context, palette.deep, palette.paper)}${field}${beam}${docsTile(layout, palette, dark, colors.shadow, id('shadow'))}`;
}
