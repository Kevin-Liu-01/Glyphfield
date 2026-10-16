import { deviceBackground, round, type DeviceContext } from '../brandDeviceContext';
import { mixHexColors } from '../color';

/** The 8 by 8 Bayer threshold matrix (values 0 to 63) behind the ordered dither. */
const BAYER: ReadonlyArray<readonly number[]> = (() => {
  let matrix: number[][] = [[0]];
  for (let size = 1; size < 8; size *= 2) {
    const next: number[][] = [];
    for (let y = 0; y < size * 2; y += 1) {
      const row: number[] = [];
      for (let x = 0; x < size * 2; x += 1) {
        const quadrant = (y < size ? 0 : 2) + (x < size ? 0 : 1);
        row.push(4 * matrix[y % size]![x % size]! + [0, 2, 3, 1][quadrant]!);
      }
      next.push(row);
    }
    matrix = next;
  }
  return matrix;
})();

/**
 * Lit cells (of 64) in each dither tile, sparse to dense. Bayer tiles nest, so each
 * denser tile painted over a smaller shading band keeps every cell of the sparser one.
 */
const TILE_COUNTS = [2, 4, 6, 9, 12, 16, 20, 25, 30, 35, 40, 45, 50, 55, 59, 61] as const;
/** Shading model: brightness = AMBIENT + GAIN * (n . L) ^ GAMMA, as on the cover. */
const AMBIENT = 0.025;
const GAIN = 0.94;
const GAMMA = 1.1;

/** The lit cells of one 8 by 8 tile as row runs, in cell units. */
function tilePath(count: number): string {
  let path = '';
  BAYER.forEach((row, y) => {
    let x = 0;
    while (x < 8) {
      if (row[x]! >= count) {
        x += 1;
        continue;
      }
      let end = x;
      while (end < 8 && row[end]! < count) end += 1;
      path += `M${x} ${y}h${end - x}v1h${x - end}z`;
      x = end;
    }
  });
  return path;
}

/**
 * The part of a sphere's disc where n . L >= t (0 < t < 1): a spherical cap seen
 * head on. Its rim projects to an ellipse centred t * (lx, ly), with semi axes
 * lz * sqrt(1 - t^2) along the light and sqrt(1 - t^2) across it. Where the cap
 * reaches the limb, the outline follows the limb between the two tangent points.
 */
function capPath(cx: number, cy: number, radius: number, light: readonly [number, number, number], t: number): string {
  const [lx, ly, lz] = light;
  const spread = Math.hypot(lx, ly);
  const ex = lx / spread;
  const ey = ly / spread;
  const across = Math.sqrt(1 - t * t);
  const rx = round(lz * across * radius);
  const ry = round(across * radius);
  const angle = round((Math.atan2(ey, ex) * 180) / Math.PI);
  const point = (u: number, v: number) => `${round(cx + (u * ex - v * ey) * radius)} ${round(cy + (u * ey + v * ex) * radius)}`;
  if (t >= spread) {
    const reach = lz * across;
    const centre = t * spread;
    return `M${point(centre + reach, 0)}A${rx} ${ry} ${angle} 0 1 ${point(centre - reach, 0)}A${rx} ${ry} ${angle} 0 1 ${point(centre + reach, 0)}Z`;
  }
  const u = t / spread;
  const v = Math.sqrt(1 - u * u);
  const r = round(radius);
  return `M${point(u, v)}A${rx} ${ry} ${angle} 1 1 ${point(u, -v)}A${r} ${r} 0 0 1 ${point(u, v)}Z`;
}

/** Lines one module apart, half a module either side of the centre of a span. */
function gridLines(size: number, moduleSize: number): number[] {
  const out: number[] = [];
  for (let at = (size / 2 + moduleSize / 2) % moduleSize; at <= size + 0.01; at += moduleSize) out.push(at);
  return out;
}

/** Ruler combs on the top and bottom frame lines: minor and half-module ticks, then module ticks. */
function rulerCombs(gx: number, w: number, moduleSize: number, top: number, bottom: number): readonly [string, string] {
  const perModule = moduleSize / 10 >= 6 ? 10 : moduleSize / 5 >= 6 ? 5 : 2;
  const step = moduleSize / perModule;
  let ticks = '';
  let majors = '';
  for (let index = Math.ceil(-gx / step); gx + index * step <= w + 0.01; index += 1) {
    const x = round(gx + index * step);
    const place = ((index % perModule) + perModule) % perModule;
    const half = perModule % 2 === 0 && place === perModule / 2;
    const length = round(Math.max(2, moduleSize * (place === 0 ? 0.175 : half ? 0.1 : 0.05)));
    const marks = `M${x} ${round(top - length)}v${length}M${x} ${round(bottom)}v${length}`;
    if (place === 0) majors += marks;
    else ticks += marks;
  }
  return [ticks, majors];
}

/**
 * The bar's horizontal run: in from the first grid line clear of the limb (or from
 * the frame edge when that line is off the frame) to the grid line short of the centre.
 */
function barRun(cx: number, radius: number, moduleSize: number, w: number, coin: boolean): readonly [number, number] {
  const reach = (Math.ceil((radius + moduleSize / 2) / moduleSize - 0.5) + 0.5) * moduleSize;
  const fitsLeft = cx - reach >= moduleSize / 2;
  const fitsRight = cx + reach <= w - moduleSize / 2;
  const roomier = cx === w - cx ? coin : cx > w - cx;
  const fromLeft = fitsLeft === fitsRight ? (fitsLeft ? coin : roomier) : fitsLeft;
  const outer = fromLeft ? (fitsLeft ? cx - reach : 0) : (fitsRight ? cx + reach : w);
  const inner = fromLeft ? cx - moduleSize / 2 : cx + moduleSize / 2;
  return [Math.min(outer, inner), Math.abs(inner - outer)];
}

/** One pattern-filled shape per dither tile, each on the part of the sphere bright enough for it. */
function ditherBands(context: DeviceContext, cx: number, cy: number, radius: number, light: readonly [number, number, number]): string {
  return TILE_COUNTS.map((count) => {
    const level = (count - 0.5) / 64;
    const fill = `url(#${context.id(`dither-${count}`)})`;
    if (level <= AMBIENT) return `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(radius)}" fill="${fill}"/>`;
    const t = ((level - AMBIENT) / GAIN) ** (1 / GAMMA);
    return t < 1 ? `<path d="${capPath(cx, cy, radius, light, t)}" fill="${fill}"/>` : '';
  }).join('');
}

/**
 * Basement: the engineered interruption. A 1-bit ordered-dither sphere sits on a
 * hairline module grid with dot subdivisions, registration crosses and ruler combs
 * on the frame lines. Ink gaps on the grid lines cut the sphere into a wall of
 * screens, and one solid accent bar, sitting on a grid line, runs in from the frame
 * and stops at the grid line short of the sphere's centre. The dither is a stack of
 * Bayer pattern tiles, each painted on the band of the sphere bright enough for it.
 * Dark tone: paper dither on ink. Light tone: an ink sphere with paper dither on
 * paper, so its lit side reads as ink dither on the page. The seed moves the sphere
 * by whole modules, turns the light, and picks the bar's grid line and side.
 */
export function interruptionDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const unit = Math.min(w, h);
  const ground = tone === 'dark' ? palette.ink : palette.paper;
  const rule = (amount: number) => mixHexColors(ground, tone === 'dark' ? palette.paper : palette.ink, amount);

  // Module: about 0.16 of the short side, a whole number of dither tiles so the
  // Bayer lattice, the screen gaps and the grid lines land on the same cell edges.
  const target = unit * 0.16;
  const cellsPerModule = 8 * Math.min(4, Math.max(2, Math.floor(target / 17.6)));
  const cell = Math.max(1, Math.round((target / cellsPerModule) * 2) / 2);
  const moduleSize = cellsPerModule * cell;
  const hair = Math.max(1, Math.round(unit * 0.004) / 2);

  // Grid lines sit half a module either side of the frame's centre, so the centre
  // and every module centre are places the sphere can sit. The ruler frame is the
  // outermost pair of horizontal lines at least half a module in.
  const xs = gridLines(w, moduleSize);
  const allYs = gridLines(h, moduleSize);
  const framed = allYs.filter((y) => y >= moduleSize / 2 - 0.5 && y <= h - moduleSize / 2 + 0.5);
  const ys = framed.length >= 2 ? framed : allYs;
  const gx = xs[0] ?? 0;
  const gy = allYs[0] ?? 0;

  // Sphere: five modules across when that fits, on a module centre the seed picks.
  const radius = Math.min(moduleSize * 2.5, unit * 0.44);
  const shift = (size: number) => {
    const room = Math.max(0, Math.floor((size / 2 - radius - unit * 0.06) / moduleSize));
    return Math.floor(random() * (room * 2 + 1)) - room;
  };
  const cx = w / 2 + shift(w) * moduleSize;
  const cy = h / 2 + shift(h) * moduleSize;

  // Light from the upper left or upper right, never head on.
  const azimuth = ((random() < 0.5 ? -135 : -45) + (random() - 0.5) * 50) * (Math.PI / 180);
  const lz = 0.66 + random() * 0.14;
  const spread = Math.sqrt(1 - lz * lz);
  const light = [spread * Math.cos(azimuth), spread * Math.sin(azimuth), lz] as const;

  // The bar sits on a grid line in the sphere's middle band.
  const barLines = allYs.filter((y) => y - moduleSize / 2 >= cy - radius * 0.6 - 0.5 && y <= cy + radius * 0.6 + 0.5);
  const barY = (barLines[Math.floor(random() * barLines.length)] ?? cy + moduleSize / 2) - moduleSize / 2;
  const [barX, barWidth] = barRun(cx, radius, moduleSize, w, random() < 0.5);

  // Hairline grid, dot subdivisions, registration crosses, ruler combs.
  const pitch = moduleSize / (moduleSize / 4 >= 12 ? 4 : 2);
  const grid = [...xs.map((x) => `M${round(x)} 0V${round(h)}`), ...ys.map((y) => `M0 ${round(y)}H${round(w)}`)].join('');
  const arm = Math.max(2.5, moduleSize / 16);
  const crosses = xs.flatMap((x) => ys.map((y) => `M${round(x - arm)} ${round(y)}h${round(arm * 2)}M${round(x)} ${round(y - arm)}v${round(arm * 2)}`)).join('');
  const [ticks, majors] = rulerCombs(gx, w, moduleSize, ys[0] ?? h * 0.1, ys[ys.length - 1] ?? h * 0.9);

  // Screen gaps on every grid line crossing the sphere, plus a cell of clearance
  // around the bar, clipped to the disc so the field outside stays untouched.
  const gaps = [
    ...xs.filter((x) => Math.abs(x - cx) < radius).map((x) => `M${round(x)} ${round(cy - radius)}V${round(cy + radius)}`),
    ...allYs.filter((y) => Math.abs(y - cy) < radius).map((y) => `M${round(cx - radius)} ${round(y)}H${round(cx + radius)}`),
  ].join('');

  // Dither tiles in cell units, scaled up and pinned to the grid lattice.
  const tiles = TILE_COUNTS.map((count) => `<pattern id="${id(`dither-${count}`)}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="translate(${round(gx)} ${round(gy)}) scale(${round(cell)})"><path d="${tilePath(count)}" fill="${palette.paper}"/></pattern>`).join('');
  const dots = `<pattern id="${id('dots')}" width="${round(pitch)}" height="${round(pitch)}" patternUnits="userSpaceOnUse" patternTransform="translate(${round(gx - pitch / 2)} ${round(gy - pitch / 2)})"><rect x="${round(pitch / 2 - hair / 2)}" y="${round(pitch / 2 - hair / 2)}" width="${hair}" height="${hair}" fill="${rule(0.42)}"/></pattern>`;
  const disc = `cx="${round(cx)}" cy="${round(cy)}" r="${round(radius)}"`;
  const stroke = (d: string, color: string, width: number) => `<path d="${d}" stroke="${color}" stroke-width="${round(width)}" fill="none"/>`;
  return [
    `<defs>${dots}${tiles}<clipPath id="${id('disc')}"><circle ${disc}/></clipPath></defs>`,
    deviceBackground(context, palette.ink, palette.paper),
    `<rect width="${round(w)}" height="${round(h)}" fill="url(#${id('dots')})"/>`,
    stroke(grid, rule(0.15), hair),
    stroke(ticks, rule(0.52), hair),
    stroke(majors, rule(0.86), hair),
    stroke(crosses, rule(0.52), hair),
    `<circle ${disc} fill="${palette.ink}"/>`,
    ditherBands(context, cx, cy, radius, light),
    `<g clip-path="url(#${id('disc')})">${stroke(gaps, ground, cell * 2)}<rect x="${round(barX - cell)}" y="${round(barY - cell)}" width="${round(barWidth + cell * 2)}" height="${round(moduleSize / 2 + cell * 2)}" fill="${ground}"/></g>`,
    `<rect x="${round(barX)}" y="${round(barY)}" width="${round(barWidth)}" height="${round(moduleSize / 2)}" fill="${palette.accent}"/>`,
  ].join('');
}
