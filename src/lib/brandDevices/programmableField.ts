import { deviceBackground, round, type DeviceContext } from '../brandDeviceContext';
import { mixHexColors } from '../color';

type Point = readonly [number, number];
type Strand = { fill: string; opacity?: number; points: readonly [Point, Point, Point, Point]; taper?: number; width: number };

const SKEW = Math.tan((12 * Math.PI) / 180);
/** The approved cover's band space: x runs along the band (0 to 1600 visible), y across it (0 to 560). */
const BAND_LENGTH = 1600;
const BAND_SPAN = 560;

function bezier(points: Strand['points'], t: number): Point {
  const u = 1 - t;
  const [a, b, c, d] = points;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

/** A wave of colour: a ribbon along a cubic curve that swells in the middle and tapers at both ends. */
function strandPath({ fill, opacity = 1, points, taper = 0.5, width }: Strand): string {
  const steps = 22;
  const spine = Array.from({ length: steps + 1 }, (_, index) => bezier(points, index / steps));
  const left: Point[] = [];
  const right: Point[] = [];
  spine.forEach((point, index) => {
    const before = spine[Math.max(0, index - 1)]!;
    const after = spine[Math.min(steps, index + 1)]!;
    const length = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1;
    const nx = -(after[1] - before[1]) / length;
    const ny = (after[0] - before[0]) / length;
    const s = Math.min(Math.max(index / steps, 0.001), 0.999);
    const half = (width / 2) * Math.pow(Math.sin(Math.PI * s), taper);
    left.push([point[0] + nx * half, point[1] + ny * half]);
    right.push([point[0] - nx * half, point[1] - ny * half]);
  });
  const outline = [...left, ...right.reverse()].map(([x, y]) => `${Math.round(x)} ${Math.round(y)}`).join('L');
  return `<path d="M${outline}Z" fill="${fill}"${opacity < 1 ? ` opacity="${opacity}"` : ''}/>`;
}

/**
 * Stripe: the Stripe stripe. A band skewed at -12 degrees crosses the frame,
 * filled with soft overlapping waves of the accent, secondary, highlight and
 * progress colours that darken to deep, with silk sheen lines and thin angled
 * stripes along its edges. Light: on the muted field. Dark: glowing on deep.
 */
export function programmableFieldDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const dark = tone === 'dark';
  const drop = w * SKEW;
  const margin = h * 0.05;
  // The band fills the frame between the corners, as on the cover, within sane proportions.
  const span = Math.min(Math.max(h - drop - margin * 2, h * 0.36), Math.min(w, h) * 0.62);
  const travel = Math.max(h * 0.06, (h - drop - span) / 2 - margin);
  const centre = h / 2 + (random() - 0.5) * 2 * travel;
  const top = centre - span / 2 + (w / 2) * SKEW;
  const sy = span / BAND_SPAN;
  // Tall boxes show a closer crop of the waves rather than squeezing them sideways.
  const sx = Math.max(w / BAND_LENGTH, sy * 0.8);
  const shift = (w - BAND_LENGTH * sx) / 2 + (random() - 0.5) * 0.24 * BAND_LENGTH * sx;
  const fine = (value: number) => Math.round(value * 10000) / 10000;
  const matrix = `matrix(${fine(sx)} ${fine(-SKEW * sx)} 0 ${fine(sy)} ${round(shift)} ${round(top - SKEW * shift)})`;

  const base = mixHexColors(palette.accent, palette.progress, 0.45);
  const pale = mixHexColors(palette.secondary, palette.paper, 0.5);
  const flare = mixHexColors(palette.highlight, palette.paper, 0.4);
  const shade = dark ? mixHexColors(palette.deep, palette.accent, 0.22) : palette.deep;
  const sheen = palette.paper;

  // Each wave's inner control points drift by a seeded phase so no two elements share a picture.
  const phase = (points: Strand['points'], amount = 1): Strand['points'] => {
    const dx = (random() - 0.5) * 200 * amount;
    const dy = (random() - 0.5) * 90 * amount;
    return [points[0], [points[1][0] + dx, points[1][1] + dy], [points[2][0] + dx * 0.6, points[2][1] - dy], points[3]];
  };
  const waves: Strand[] = [
    { fill: palette.secondary, points: phase([[-300, 610], [100, 450], [200, 130], [700, -40]]), width: 280 },
    { fill: pale, points: phase([[-200, 450], [150, 330], [250, 130], [560, 10]]), width: 100 },
    { fill: palette.progress, points: phase([[150, 630], [450, 490], [500, 170], [900, -20]]), width: 200 },
    { fill: palette.highlight, points: phase([[440, 650], [720, 490], [720, 170], [1130, -30]]), width: 250 },
    { fill: flare, points: phase([[710, 260], [830, 180], [880, 90], [1090, 0]], 0.6), width: 104 },
    { fill: palette.accent, points: phase([[860, 650], [1080, 490], [1120, 170], [1520, -30]]), width: 250 },
    { fill: palette.progress, opacity: 0.9, points: phase([[1000, 510], [1150, 370], [1180, 170], [1400, -10]]), width: 70 },
    { fill: shade, opacity: 0.92, points: phase([[900, 640], [1250, 550], [1480, 440], [1950, 410]], 0.5), width: 190 },
    { fill: palette.highlight, points: phase([[1240, 350], [1460, 190], [1620, 90], [1950, 30]]), width: 150 },
    { fill: flare, opacity: 0.8, points: phase([[1380, 150], [1560, 60], [1720, 20], [1950, -10]], 0.5), width: 60 },
  ];
  const silk: Strand[] = [
    { fill: sheen, opacity: dark ? 0.26 : 0.32, points: phase([[500, 540], [680, 430], [700, 240], [1020, 30]], 0.6), width: 22 },
    { fill: sheen, opacity: dark ? 0.24 : 0.3, points: phase([[-100, 490], [160, 370], [230, 170], [520, 40]], 0.6), width: 18 },
    { fill: sheen, opacity: 0.25, points: phase([[1300, 310], [1480, 190], [1640, 110], [1900, 50]], 0.6), width: 16 },
  ];

  // Thin angled stripes ride the band's edges: pale secondary over the top left, accent under the bottom right.
  const lead = (random() - 0.5) * 160;
  const tail = (random() - 0.5) * 160;
  const stripes: Array<readonly [number, number, number, number, string, number]> = [
    [-400, -36, 960 + lead, 36, pale, 0.9],
    [560 + lead, -18, 300, 18, base, 0.5],
    [1020 + tail, BAND_SPAN, 1200, 36, palette.accent, 0.92],
    [760 + tail, BAND_SPAN, 260, 18, palette.highlight, 0.7],
  ];
  const stripeMarkup = stripes.map(([x, y, width, height, fill, opacity]) => `<rect x="${round(x)}" y="${y}" width="${round(width)}" height="${height}" fill="${fill}" opacity="${opacity}"/>`).join('');

  const filter = (name: string, deviation: number) => `<filter id="${id(name)}" filterUnits="userSpaceOnUse" x="${round(-w * 0.2)}" y="${round(-h * 0.2)}" width="${round(w * 1.4)}" height="${round(h * 1.4)}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${round(deviation * sx)} ${round(deviation * sy)}"/></filter>`;
  const glow = dark ? 170 : 0;
  const defs = [
    `<clipPath id="${id('band')}"><rect x="-700" y="0" width="3000" height="${BAND_SPAN}" transform="${matrix}"/></clipPath>`,
    filter('waves', 26),
    filter('silk', 9),
    `<linearGradient id="${id('ground')}" x1="0" y1="0" x2="${BAND_LENGTH}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0.3" stop-color="${palette.secondary}"/><stop offset="0.48" stop-color="${base}"/><stop offset="0.72" stop-color="${palette.accent}"/></linearGradient>`,
    `<linearGradient id="${id('dusk')}" x1="1200" y1="260" x2="1320" y2="${BAND_SPAN}" gradientUnits="userSpaceOnUse"><stop stop-color="${shade}" stop-opacity="0"/><stop offset="1" stop-color="${shade}" stop-opacity="0.95"/></linearGradient>`,
    ...(dark ? [
      `<linearGradient id="${id('haloTop')}" x1="0" y1="${-glow}" x2="0" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="${mixHexColors(palette.secondary, palette.progress, 0.5)}" stop-opacity="0"/><stop offset="1" stop-color="${mixHexColors(palette.secondary, palette.progress, 0.5)}" stop-opacity="0.3"/></linearGradient>`,
      `<linearGradient id="${id('haloBottom')}" x1="0" y1="${BAND_SPAN}" x2="0" y2="${BAND_SPAN + glow}" gradientUnits="userSpaceOnUse"><stop stop-color="${base}" stop-opacity="0.34"/><stop offset="1" stop-color="${base}" stop-opacity="0"/></linearGradient>`,
    ] : []),
  ];
  const halo = dark
    ? `<rect x="-700" y="${-glow}" width="3000" height="${glow}" fill="url(#${id('haloTop')})"/><rect x="-700" y="${BAND_SPAN}" width="3000" height="${glow}" fill="url(#${id('haloBottom')})"/>`
    : '';

  return [
    `<defs>${defs.join('')}</defs>`,
    deviceBackground(context, palette.deep, palette.muted),
    `<g transform="${matrix}">${halo}${stripeMarkup}</g>`,
    `<g clip-path="url(#${id('band')})">`,
    `<rect x="-700" y="-40" width="3000" height="${BAND_SPAN + 80}" fill="url(#${id('ground')})" transform="${matrix}"/>`,
    `<rect x="-700" y="-40" width="3000" height="${BAND_SPAN + 80}" fill="url(#${id('dusk')})" transform="${matrix}"/>`,
    `<g filter="url(#${id('waves')})"><g transform="${matrix}">${waves.map(strandPath).join('')}</g></g>`,
    `<g filter="url(#${id('silk')})"><g transform="${matrix}">${silk.map(strandPath).join('')}</g></g>`,
    '</g>',
  ].join('');
}
