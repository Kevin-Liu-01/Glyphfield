import type { BrandPalette } from '../brandOutputKit';
import { round, type DeviceContext } from '../brandDeviceContext';
import { mixHexColors } from '../color';

type Vector = readonly [number, number, number];
type Point = readonly [number, number];

/** Latitude and longitude of the cities the network lights. The last row lies beyond the horizon. */
const CITIES: Readonly<Record<string, readonly [number, number]>> = {
  lon: [51.5, -0.1], par: [48.9, 2.35], fra: [50.1, 8.7], ams: [52.4, 4.9], mad: [40.4, -3.7], lis: [38.7, -9.1], mil: [45.5, 9.2], rom: [41.9, 12.5],
  vie: [48.2, 16.4], waw: [52.2, 21], sto: [59.3, 18.1], osl: [59.9, 10.75], hel: [60.2, 24.9], cph: [55.7, 12.6], dub: [53.3, -6.3], man: [53.5, -2.2],
  ber: [52.5, 13.4], ham: [53.6, 10], muc: [48.1, 11.6], zrh: [47.4, 8.5], mrs: [43.3, 5.4], bcn: [41.4, 2.2], bru: [50.8, 4.4], prg: [50.1, 14.4],
  bud: [47.5, 19], buh: [44.4, 26.1], sof: [42.7, 23.3], ath: [38, 23.7], ist: [41, 29], kbp: [50.45, 30.5], mow: [55.75, 37.6], led: [59.9, 30.3],
  rix: [56.9, 24.1], tll: [59.4, 24.7], vno: [54.7, 25.3], kef: [64.1, -21.9], edi: [55.95, -3.2], lys: [45.76, 4.8], dus: [51.2, 6.8], beg: [44.8, 20.5],
  zag: [45.8, 16], kzn: [55.8, 49.1], tbs: [41.7, 44.8], gyd: [40.4, 49.9], alg: [36.75, 3], cmn: [33.6, -7.6], tun: [36.8, 10.2], cai: [30, 31.2],
  tlv: [32.1, 34.8], amm: [31.95, 35.9], bey: [33.9, 35.5], pmo: [38.1, 13.4], her: [35.3, 25.1], yar: [57.6, 39.9], arh: [64.5, 40.5], ekb: [56.8, 60.6],
  got: [57.7, 11.97], bgo: [60.4, 5.3], tos: [69.6, 18.9], orl: [47.9, 1.9], bod: [44.8, -0.6], opo: [41.15, -8.6], svq: [37.4, -6], lca: [34.9, 33.6],
  skg: [40.6, 22.9], odz: [46.5, 30.7], krk: [50.06, 19.9], ruh: [24.7, 46.7], bgw: [33.3, 44.4], thr: [35.7, 51.4],
  sfo: [37.8, -122.4], sea: [47.6, -122.3], yvr: [49.3, -123.1], nrt: [35.7, 139.7], icn: [37.5, 127], hkg: [22.3, 114.2], ord: [41.9, -87.6], kix: [34.7, 135.5],
};

/** Long hauls rise over the horizon to the far side; short hops stay on the near side. */
const LONG_HAULS = ['mow sfo', 'hel sea', 'ist yvr', 'dub nrt', 'lon icn', 'mad kix', 'lon sfo', 'fra nrt', 'ams sea', 'muc hkg', 'par ord', 'sto icn'];
const SHORT_HOPS = ['mad fra', 'vie cai', 'ams waw', 'lon ist', 'mil mow', 'cmn par', 'dub waw'];

const DEG = Math.PI / 180;

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [list[index], list[swap]] = [list[swap]!, list[index]!];
  }
  return list;
}

/** A unit vector on the globe, turned so `center` longitude faces the viewer and tipped back by `tilt`. */
function onGlobe(lat: number, lon: number, center: number, tilt: number): Vector {
  const phi = lat * DEG;
  const lambda = (lon - center) * DEG;
  const x = Math.cos(phi) * Math.sin(lambda);
  const y = Math.sin(phi);
  const z = Math.cos(phi) * Math.cos(lambda);
  return [x, y * Math.cos(tilt) - z * Math.sin(tilt), y * Math.sin(tilt) + z * Math.cos(tilt)];
}

/** A great circle lifted off the surface, in globe units with y up. Points hidden behind the globe are null. */
function routePoints(from: Vector, to: Vector, lift: number, cap: number, steps: number): (Point | null)[] {
  const angle = Math.acos(Math.min(1, Math.max(-1, from[0] * to[0] + from[1] * to[1] + from[2] * to[2])));
  const sine = Math.sin(angle);
  const height = Math.min(lift * angle, cap);
  return Array.from({ length: steps + 1 }, (_, index) => {
    const s = index / steps;
    const a = Math.sin((1 - s) * angle) / sine;
    const b = Math.sin(s * angle) / sine;
    const radius = 1 + height * Math.sin(Math.PI * s);
    const x = (from[0] * a + to[0] * b) * radius;
    const y = (from[1] * a + to[1] * b) * radius;
    const z = from[2] * a + to[2] * b;
    return z > 0 || x * x + y * y > 1 ? [x, y] : null;
  });
}

const dotPath = (points: readonly Point[], digits: number): string => points.map(([x, y]) => `M${x.toFixed(digits).replace(/\.0+$/, '')} ${y.toFixed(digits).replace(/\.0+$/, '')}h0`).join('');

/** Each tone's colours. Dark is the cover: an orange sky over a night globe. Light keeps the globe in muted tints under a paper sky. */
function horizonColors(palette: BrandPalette, dark: boolean) {
  const { accent, deep, highlight, ink, muted, paper, progress, secondary } = palette;
  return dark
    ? { arcGlobe: secondary, arcSky: highlight, bloom: [highlight, 1, 0.75], dot: progress, dotOpacity: [0.5, 0.55, 0.6], globe: [ink, deep], glow: highlight, hubCore: secondary, hubEye: highlight, led: highlight, ledOpacity: [0.18, 0.45], limb: [0.5, 0.75, 0.85, 0.3], rim: highlight, rimOpacity: 1, sky: accent, warm: [secondary, 0.4] } as const
    : { arcGlobe: mixHexColors(accent, deep, 0.2), arcSky: accent, bloom: [mixHexColors(highlight, secondary, 0.25), 0.8, 0.45], dot: ink, dotOpacity: [0.18, 0.24, 0.3], globe: [mixHexColors(muted, ink, 0.06), mixHexColors(muted, ink, 0.14)], glow: secondary, hubCore: accent, hubEye: paper, led: mixHexColors(accent, paper, 0.3), ledOpacity: [0.12, 0.32], limb: [0.3, 0.45, 0.55, 0.18], rim: accent, rimOpacity: 0.8, sky: paper, warm: [highlight, 0.6] } as const;
}

/** Picks this element's routes: five or six long hauls and two or three short hops. */
function pickRoutes(random: () => number, cities: Readonly<Record<string, Vector>>) {
  return [
    ...shuffled(LONG_HAULS, random).slice(0, 5 + Math.floor(random() * 2)).map((pair) => ({ cap: 0.24 + random() * 0.1, lift: 0.3, pair, steps: 56 })),
    ...shuffled(SHORT_HOPS, random).slice(0, 2 + Math.floor(random() * 2)).map((pair) => ({ cap: 0.1, lift: 0.45, pair, steps: 28 })),
  ].map(({ cap, lift, pair, steps }) => {
    const [from, to] = pair.split(' ') as [string, string];
    return { ends: [from, to], points: routePoints(cities[from]!, cities[to]!, lift, cap, steps) };
  });
}

/** Path data for a route, lifting the pen where it passes behind the globe or far out of frame. */
function routeData(points: readonly (Point | null)[], toScreen: (point: Point) => Point, w: number, h: number): string {
  let pen = false;
  return points.map((point) => {
    const screen = point ? toScreen(point) : null;
    if (!screen || screen[0] < -w * 0.25 || screen[0] > w * 1.25 || screen[1] < -h * 0.25) {
      pen = false;
      return '';
    }
    const segment = `${pen ? ' ' : 'M'}${round(screen[0])} ${round(screen[1])}`;
    pen = true;
    return segment;
  }).join('');
}

/** The LED dot texture on the globe's face, bucketed by how squarely each dot faces the viewer. */
function globeDots(view: { center: number; step: number; tilt: number }, toScreen: (point: Point) => Point, w: number, h: number): [Point[], Point[], Point[]] {
  const { center, step, tilt } = view;
  const buckets: [Point[], Point[], Point[]] = [[], [], []];
  for (let row = 0; -60 + row * step <= 89; row += 1) {
    const lat = -60 + row * step;
    const lonStep = step / Math.cos(lat * DEG);
    const count = Math.floor(180 / lonStep);
    for (let column = -count; column <= count; column += 1) {
      const vector = onGlobe(lat, center + column * lonStep + (row % 2) * lonStep / 2, center, tilt);
      const [x, y] = toScreen([vector[0], vector[1]]);
      const inFrame = x > -6 && x < w + 6 && y > -6 && y < h + 6;
      if (vector[2] > 0.02 && inFrame) buckets[vector[2] < 0.25 ? 0 : vector[2] < 0.5 ? 1 : 2].push([x, y]);
    }
  }
  return buckets;
}

/**
 * Cloudflare: the network horizon. A dark dotted globe rises into the orange
 * sky; city lights burn on its face and long-haul routes arc over the limb to
 * the far side of the world.
 */
export function horizonDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const colors = horizonColors(palette, tone === 'dark');
  const unit = Math.min(w, h);

  // The view: which longitude faces us, how far the globe tips back, where the limb crests.
  const center = 14 + (random() - 0.5) * 18;
  const tilt = (-6 + (random() - 0.5) * 8) * DEG;
  // Portrait frames lift the horizon so the globe still fills the lower half.
  const horizon = h * (0.47 + random() * 0.1 - Math.min(0.12, Math.max(0, h / w - 1) * 0.5));
  const cities = Object.fromEntries(Object.entries(CITIES).map(([name, [lat, lon]]) => [name, onGlobe(lat, lon, center, tilt)]));
  const routes = pickRoutes(random, cities);

  // Size the globe so the highest route still clears the top edge.
  const rise = Math.max(0.12, ...routes.flatMap(({ points }) => points.map((point) => (point ? point[1] - 1 : 0))));
  const r = Math.min(w * 0.78, (horizon - unit * 0.06) / rise);
  const cx = w / 2;
  const cy = horizon + r;
  const s = Math.max(r / 1250, 0.2);
  const digits = r > 500 ? 0 : 1;
  const toScreen = ([x, y]: Point): Point => [cx + r * x, cy - r * y];
  const visible = (vector: Vector) => vector[2] > 0.02;

  const hubs = new Set(routes.flatMap(({ ends }) => ends));
  const hubPoints = [...hubs].map((name) => cities[name]!).filter(visible).map(([x, y]) => toScreen([x, y]));
  const lights = Object.entries(cities).filter(([name, vector]) => !hubs.has(name) && visible(vector)).map(([, [x, y]]) => toScreen([x, y]));
  const spacing = Math.max(6, unit * 0.035);
  const buckets = globeDots({ center, step: spacing / r / DEG, tilt }, toScreen, w, h);

  const squash = (scale: number) => `translate(0 ${round(horizon)}) scale(1 ${scale}) translate(0 ${round(-horizon)})`;
  const radial = (name: string, radius: number, scale: number, stops: string) => `<radialGradient id="${id(name)}" cx="${round(cx)}" cy="${round(horizon)}" r="${round(radius)}" gradientUnits="userSpaceOnUse" gradientTransform="${squash(scale)}">${stops}</radialGradient>`;
  const stop = (offset: number, color: string, opacity = 1) => `<stop offset="${Math.round(offset * 10000) / 10000}" stop-color="${color}"${opacity < 1 ? ` stop-opacity="${round(opacity)}"` : ''}/>`;
  // The glow along the limb is one ring gradient (orange inside, highlight outside) instead of a blur filter.
  const limbOut = 34 * s;
  const ring = (offset: number) => Math.min(1, Math.max(0, (r + offset) / (r + limbOut)));
  const [inner, edge, crest, outer] = colors.limb;
  const limbStops = `${stop(ring(-66 * s), palette.accent, 0)}${stop(ring(-16 * s), palette.accent, inner)}${stop(ring(-3 * s), colors.glow, edge)}${stop(ring(0), colors.glow, crest)}${stop(ring(12 * s), colors.glow, outer)}${stop(1, colors.glow, 0)}`;
  const [warm, warmMid] = colors.warm;
  const [bloom, bloomPeak, bloomMid] = colors.bloom;
  const tile = Math.max(5, Math.round(unit * 0.012));
  const globe = `cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}"`;
  const full = `width="${round(w)}" height="${round(h)}"`;
  const ref = (name: string) => `url(#${id(name)})`;

  const defs = `<defs>${radial('warm', r * 0.84, 0.6, `${stop(0, warm)}${stop(0.45, warm, warmMid)}${stop(1, warm, 0)}`)}${radial('bloom', r * 0.58, 0.4, `${stop(0, bloom, bloomPeak)}${stop(0.28, bloom, bloomMid)}${stop(1, bloom, 0)}`)}${radial('night', r * 0.61, 0.55, `${stop(0, colors.globe[0])}${stop(1, colors.globe[1])}`)}${radial('fade', r * 0.72, 0.62, `${stop(0, '#FFFFFF')}${stop(1, '#FFFFFF', 0)}`)}`
    + `<radialGradient id="${id('limb')}" cx="${round(cx)}" cy="${round(cy)}" r="${round(r + limbOut)}" gradientUnits="userSpaceOnUse">${limbStops}</radialGradient>`
    + `<radialGradient id="${id('halo')}">${stop(0, palette.accent, 0.85)}${stop(0.3, palette.accent, 0.75)}${stop(0.6, palette.accent, 0.42)}${stop(1, palette.accent, 0)}</radialGradient>`
    + `<pattern id="${id('led')}" width="${tile}" height="${round(tile * 4 / 3)}" patternUnits="userSpaceOnUse"><rect x="${round(tile * 0.375)}" y="${round(tile * 0.34)}" width="${round(tile * 0.25)}" height="${round(tile * 0.42)}" rx="${round(tile * 0.09)}" fill="${colors.led}"/></pattern>`
    + `<mask id="${id('ledMask')}" maskUnits="userSpaceOnUse" x="0" y="0" ${full}><rect ${full} fill="${ref('fade')}"/></mask>`
    + `<clipPath id="${id('globe')}"><circle ${globe}/></clipPath>`
    + `<clipPath id="${id('sky')}"><path clip-rule="evenodd" d="M0 0H${round(w)}V${round(h)}H0ZM${round(cx - r)} ${round(cy)}a${round(r)} ${round(r)} 0 1 0 ${round(r * 2)} 0a${round(r)} ${round(r)} 0 1 0 ${round(-r * 2)} 0Z"/></clipPath>`
    + `<path id="${id('routes')}" d="${routes.map(({ points }) => routeData(points, toScreen, w, h)).join('')}"/></defs>`;

  const ground = `<rect ${full} fill="${colors.sky}"/><rect ${full} fill="${ref('warm')}"/><rect ${full} fill="${ref('led')}" opacity="${colors.ledOpacity[0]}"/><rect ${full} fill="${ref('led')}" opacity="${colors.ledOpacity[1]}" mask="${ref('ledMask')}"/><rect ${full} fill="${ref('bloom')}"/>`;
  const dotWidths = [0.07, 0.092, 0.115].map((ratio, index) => Math.max(spacing * ratio, 1.1 + index * 0.35));
  const face = `<circle ${globe} fill="${ref('night')}"/><g clip-path="${ref('globe')}" fill="none" stroke="${colors.dot}" stroke-linecap="round">${buckets.map((points, index) => `<path d="${dotPath(points, digits)}" stroke-width="${round(dotWidths[index]!)}" stroke-opacity="${colors.dotOpacity[index]}"/>`).join('')}</g>`;
  const limb = `<circle cx="${round(cx)}" cy="${round(cy)}" r="${round(r + limbOut)}" fill="${ref('limb')}"/><circle ${globe} fill="none" stroke="${colors.rim}" stroke-width="${round(3 * s)}" stroke-opacity="${colors.rimOpacity}"/>`;
  const city = `<path d="${dotPath(lights, digits)}" fill="none" stroke="${palette.accent}" stroke-width="${round(9 * s)}" stroke-linecap="round" clip-path="${ref('globe')}"/>`;
  const arcs = `<g fill="none" stroke-linecap="round"><use href="#${id('routes')}" clip-path="${ref('sky')}" stroke="${colors.arcSky}" stroke-width="${round(3 * s)}"/><use href="#${id('routes')}" clip-path="${ref('globe')}" stroke="${colors.arcGlobe}" stroke-width="${round(2.6 * s)}"/></g>`;
  const hubDots = dotPath(hubPoints, digits);
  const hubMarks = `<g fill="${ref('halo')}">${hubPoints.map(([x, y]) => `<circle cx="${round(x)}" cy="${round(y)}" r="${round(25 * s)}"/>`).join('')}</g><g fill="none" stroke-linecap="round"><path d="${hubDots}" stroke="${colors.hubCore}" stroke-width="${round(13 * s)}"/><path d="${hubDots}" stroke="${colors.hubEye}" stroke-width="${round(5.2 * s)}"/></g>`;

  return `${defs}${ground}${face}${limb}${city}${arcs}${hubMarks}`;
}
