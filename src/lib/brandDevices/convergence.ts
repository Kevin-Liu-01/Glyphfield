import { round, type DeviceContext } from '../brandDeviceContext';
import type { BrandPalette } from '../brandOutputKit';
import { mixHexColors, normalizeHexOrFallback } from '../color';

/** A thick streak on a radial line: angle in degrees, start and end radius, width, and whether it is mint. */
type Streak = readonly [angle: number, start: number, end: number, width: number, mint: boolean];

/** The approved cover's streaks at its 1600 x 1000 scale, most prominent first. */
const STREAKS: readonly Streak[] = [
  [-117, 300, 1100, 30, true],
  [-61, 400, 1050, 20, true],
  [-25, 560, 1250, 16, true],
  [-133, 520, 1250, 14, true],
  [-161, 640, 1250, 12, true],
  [-111.5, 520, 1150, 8, false],
  [-56.5, 560, 1150, 10, true],
  [-151, 600, 1250, 9, false],
  [-66, 640, 1150, 6, false],
  [-38, 720, 1250, 6, false],
  [-96, 520, 1000, 5, false],
  [-84, 600, 1000, 4, false],
];

/** The arch's gradient ellipse is this much larger than its crest, leaving room for the outer dissolve. */
const OUTER = 1.36;

type Stop = readonly [offset: number, color: string, opacity: number];

/** Where everything sits: `s` is 1 at the cover's 1600 x 1000, `g` sizes the ground gradients. */
type Geometry = { g: number; h: number; rx: number; ry: number; s: number; vx: number; vy: number; w: number };

/** Every colour the device paints with in one tone, each taken or mixed from the palette. */
type Roles = {
  bloom: readonly Stop[];
  core: string;
  crest: string;
  glow: readonly [center: number, middle: number];
  glowColor: string;
  ground: string;
  halo: string;
  haloOpacity: readonly [rise: number, crest: number, fall: number];
  lit: string;
  mint: string;
  rayColors: readonly [violet: string, soft: string, crisp: string, mint: string];
  rayStrength: number;
  ring: string;
  shade: string;
  shadeOpacity: readonly [near: number, middle: number, far: number, corner: number];
  speckDark: string;
  speckLight: string;
  tintOpacity: readonly [rise: number, crest: number, fall: number];
};

function toneRoles(palette: BrandPalette, dark: boolean): Roles {
  if (dark) {
    // The cover: an electric progress field lit by accent, darkening to deep at the corners.
    return {
      bloom: [[0.1, palette.accent, 0], [0.42, palette.accent, 0.85], [0.52, palette.highlight, 0.45], [0.62, palette.accent, 0.5], [1, palette.accent, 0]],
      core: palette.muted,
      crest: palette.muted,
      glow: [0.7, 0.22],
      glowColor: palette.accent,
      ground: palette.progress,
      halo: palette.secondary,
      haloOpacity: [0.42, 0.46, 0.18],
      lit: palette.muted,
      mint: palette.secondary,
      rayColors: [palette.accent, palette.highlight, palette.muted, palette.secondary],
      rayStrength: 1,
      ring: palette.highlight,
      shade: palette.deep,
      shadeOpacity: [0.06, 0.3, 0.54, 0.72],
      speckDark: palette.ink,
      speckLight: palette.highlight,
      tintOpacity: [0.12, 0.22, 0.1],
    };
  }
  // Lilac: a highlight field with a muted glow, the arch in accent and the rays at half strength.
  const mint = mixHexColors(palette.secondary, palette.ink, 0.32);
  return {
    bloom: [[0.1, palette.paper, 0], [0.42, palette.paper, 0.7], [0.52, palette.paper, 0.85], [0.62, palette.paper, 0.4], [1, palette.paper, 0]],
    core: palette.paper,
    crest: palette.accent,
    glow: [0.75, 0.3],
    glowColor: palette.muted,
    ground: palette.highlight,
    halo: palette.progress,
    haloOpacity: [0.3, 0.32, 0.12],
    lit: palette.accent,
    mint,
    rayColors: [mixHexColors(palette.accent, palette.highlight, 0.4), palette.paper, palette.accent, mint],
    rayStrength: 0.5,
    ring: palette.accent,
    shade: palette.accent,
    shadeOpacity: [0, 0.07, 0.16, 0.26],
    speckDark: palette.accent,
    speckLight: palette.paper,
    tintOpacity: [0.06, 0.1, 0.04],
  };
}

/** The red, green and blue rows of a feColorMatrix that paints one flat colour. */
function colorRows(hex: string): string {
  const value = normalizeHexOrFallback(hex).slice(1);
  return [0, 2, 4].map((offset) => `0 0 0 0 ${round(Number.parseInt(value.slice(offset, offset + 2), 16) / 255)}`).join(' ');
}

function stops(list: readonly Stop[]): string {
  return list.map(([offset, color, opacity]) => `<stop offset="${round(Math.min(1, Math.max(0, offset)))}" stop-color="${color}" stop-opacity="${round(opacity)}"/>`).join('');
}

function measure(w: number, h: number, random: () => number): Geometry {
  // Portrait boxes are held by their width; long bands let the arch grow a little past the cover's proportion.
  const s = Math.min(w * 1.25, h * Math.min(1.9, Math.max(1.6, 1.6 + (w / h - 1.6) * 0.3))) / 1600;
  const rx = 470 * s * (0.93 + random() * 0.14);
  const half = Math.min(w / 2, rx * 1.12);
  return {
    g: Math.max(s, Math.hypot(w, h) / 1887),
    h,
    rx,
    ry: rx * (0.78 + random() * 0.07),
    s,
    vx: Math.min(w - half, Math.max(half, w * (0.5 + (random() - 0.5) * 0.16))),
    vy: h * ((h > w ? 0.74 : 0.8) + (random() - 0.5) * 0.05),
    w,
  };
}

type Ray = readonly [kind: number, width: number, opacity: number];

/** The cover's four ray families (violet, soft, crisp and mint), picked by weight. */
function pickRay(random: () => number): Ray {
  const pick = random();
  if (pick < 0.06) return [3, 1 + random() * 2, 0.12 + random() * 0.25];
  if (pick < 0.22) return [2, 0.6 + random() * 1.2, 0.08 + random() ** 2 * 0.3];
  if (pick < 0.42) return [1, 1 + random() * 4, 0.04 + random() ** 1.8 * 0.18];
  return [0, 1.5 + random() * 4.5, 0.12 + random() ** 1.3 * 0.4];
}

/** Fine rays: the zoom-blur streak texture, bucketed by family, width and opacity into a few paths. */
function fineRays(geometry: Geometry, roles: Roles, random: () => number, reach: number, hidden: number): string {
  const { h, s, vx, vy, w } = geometry;
  const count = Math.round(160 + 180 * Math.min(1, Math.hypot(w, h) / 1887));
  const widthScale = Math.max(s, 0.32);
  const turn = random() * Math.PI * 2;
  const buckets = new Map<string, { color: string; d: string[]; opacity: number; width: number }>();
  for (let index = 0; index < count; index += 1) {
    const angle = turn + ((index + random()) / count) * Math.PI * 2;
    const r0 = (110 + random() * 300) * s;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const [kind, width, opacity] = pickRay(random);
    // Rays that leave through the bottom edge behind the terminal are never seen.
    if (sin > 0 && Math.abs(((h - vy) / sin) * cos) < hidden) continue;
    const quantized = { opacity: round(Math.max(1, Math.round(opacity * roles.rayStrength * 20)) / 20), width: round(Math.round(width) * widthScale) };
    const key = `${kind}|${quantized.width}|${quantized.opacity}`;
    const bucket = buckets.get(key) ?? { ...quantized, color: roles.rayColors[kind] ?? roles.rayColors[0], d: [] };
    bucket.d.push(`M${Math.round(vx + cos * r0)} ${Math.round(vy + sin * r0)}L${Math.round(vx + cos * reach)} ${Math.round(vy + sin * reach)}`);
    buckets.set(key, bucket);
  }
  return [...buckets.values()].map(({ color, d, opacity, width }) => (
    `<path d="${d.join('')}" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}"/>`
  )).join('');
}

type StreakDraw = (scale: number, fill: (mint: boolean) => string, opacity?: number) => string;

/** Thick streaks: the cover's set, mirrored or not, nudged, and thinned to a random count. */
function streakSet(geometry: Geometry, random: () => number, reach: number): StreakDraw {
  const { s, vx, vy } = geometry;
  const mirror = random() < 0.5;
  const count = 7 + Math.floor(random() * 6);
  const streaks = STREAKS.slice(0, count).map(([angle, start, end, width, mint]) => ({
    angle: (mirror ? -180 - angle : angle) + (random() - 0.5) * 9,
    end: Math.max(end * s, reach * 0.9),
    mint,
    start: start * s,
    width: width * s,
  }));
  return (scale, fill, opacity = 1) => streaks.map(({ angle, end, mint, start, width }) => {
    const h0 = width * 0.18 * scale;
    const h1 = width * 0.5 * scale;
    const x0 = round(vx + start);
    const x1 = round(vx + end);
    const fade = opacity < 1 ? ` fill-opacity="${opacity}"` : '';
    return `<path d="M${x0} ${round(vy - h0)}L${x1} ${round(vy - h1)}L${x1} ${round(vy + h1)}L${x0} ${round(vy + h0)}Z" fill="url(#${fill(mint)})"${fade} transform="rotate(${round(angle)} ${round(vx)} ${round(vy)})"/>`;
  }).join('');
}

/** The one command the field converges on: over the convergence point and running off the bottom edge. */
function terminalPanel(geometry: Geometry, palette: BrandPalette, id: DeviceContext['id'], half: number): { glow: string; panel: string } {
  const { h, s, vx, vy } = geometry;
  const tx = vx - half;
  const ty = vy - 14 * s;
  const tw = half * 2;
  const tr = 22 * s;
  const th = h - ty + tr * 2;
  const box = `x="${round(tx)}" y="${round(ty)}" width="${round(tw)}" height="${round(th)}" rx="${round(tr)}"`;
  const edge = Math.max(1, 3 * s);
  const mark = Math.max(s, 0.3);
  const px = tx + 52 * s;
  const py = ty + 54 * s;
  const chevron = `M${round(px)} ${round(py)}l${round(15 * mark)} ${round(13 * mark)}-${round(15 * mark)} ${round(13 * mark)}`;
  return {
    // The accent border's glow, softened and grained by the stipple filter.
    glow: `<rect ${box} fill="none" stroke="${palette.accent}" stroke-width="${round(52 * s)}" stroke-opacity=".2"/><rect ${box} fill="none" stroke="${palette.accent}" stroke-width="${round(20 * s)}" stroke-opacity=".6"/>`,
    panel: `<rect ${box} fill="${palette.ink}"/><rect ${box} fill="url(#${id('panel')})"/><rect x="${round(tx + edge / 2)}" y="${round(ty + edge / 2)}" width="${round(tw - edge)}" height="${round(th)}" rx="${round(tr - edge / 2)}" fill="none" stroke="url(#${id('edge')})" stroke-width="${round(edge)}"/><path d="${chevron}" fill="none" stroke="${palette.secondary}" stroke-width="${round(Math.max(1, 4.5 * mark))}" stroke-linecap="round" stroke-linejoin="round"/><rect x="${round(px + 32 * mark)}" y="${round(py - 2 * mark)}" width="${round(14 * mark)}" height="${round(30 * mark)}" rx="${round(2 * mark)}" fill="${palette.accent}"/>`,
  };
}

function definitions(geometry: Geometry, roles: Roles, palette: BrandPalette, id: DeviceContext['id'], seed: number): string {
  const { g, h, ry, s, vx, vy, w } = geometry;
  const box = `x="0" y="0" width="${round(w)}" height="${round(h)}"`;
  const frame = `width="${round(w)}" height="${round(h)}"`;
  // Arch gradients are written with the crest at .5 and moved onto the ellipse's crest radius.
  const crest = 1 / OUTER - 0.5;
  const ring = (name: string, list: readonly Stop[]) => `<radialGradient id="${id(name)}">${stops(list.map(([offset, color, opacity]) => [offset > 0 && offset < 1 ? offset + crest : offset, color, opacity] as const))}</radialGradient>`;
  const span = (name: string, list: readonly Stop[]) => `<linearGradient id="${id(name)}">${stops(list)}</linearGradient>`;
  const [tintRise, tintCrest, tintFall] = roles.tintOpacity;
  const [haloRise, haloCrest, haloFall] = roles.haloOpacity;
  const [near, middle, far, corner] = roles.shadeOpacity;
  return [
    `<radialGradient id="${id('field')}" cx="${round(vx)}" cy="${round(vy - 260 * s)}" r="${round(900 * g)}" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.3 0 0 1 ${round(-0.3 * vx)} 0)">${stops([[0, roles.glowColor, roles.glow[0]], [0.45, roles.glowColor, roles.glow[1]], [1, roles.glowColor, 0]])}</radialGradient>`,
    `<radialGradient id="${id('shade')}" cx="${round(vx)}" cy="${round(vy - 260 * s)}" r="${round(1000 * g)}" gradientUnits="userSpaceOnUse" gradientTransform="matrix(1.25 0 0 1 ${round(-0.25 * vx)} 0)">${stops([[0.2, roles.shade, near], [0.55, roles.shade, middle], [0.8, roles.shade, far], [1, roles.shade, corner]])}</radialGradient>`,
    ring('tint', [[0, roles.mint, 0.04], [0.38, roles.mint, tintRise], [0.48, roles.mint, tintCrest], [0.6, roles.mint, tintFall], [1, roles.mint, 0]]),
    ring('bloom', roles.bloom),
    ring('ring', [[0.2, roles.ring, 0], [0.35, roles.ring, 0.22], [0.44, roles.ring, 0.62], [0.48, roles.crest, 0.94], [0.51, roles.crest, 0.9], [0.54, roles.ring, 0.64], [0.61, roles.ring, 0.26], [0.7, roles.ring, 0.08], [1, roles.ring, 0]]),
    ring('halo', [[0.3, roles.halo, 0], [0.44, roles.halo, haloRise], [0.52, roles.halo, haloCrest], [0.62, roles.halo, haloFall], [1, roles.halo, 0]]),
    `<linearGradient id="${id('legFade')}" x1="0" y1="${round(vy - ry * OUTER)}" x2="0" y2="${round(vy - 20 * s)}" gradientUnits="userSpaceOnUse">${stops([[0, '#FFFFFF', 1], [0.5, '#FFFFFF', 0.9], [1, '#FFFFFF', 0]])}</linearGradient>`,
    `<mask id="${id('legs')}" maskUnits="userSpaceOnUse" ${box}><rect ${frame} fill="url(#${id('legFade')})"/></mask>`,
    `<radialGradient id="${id('rayFade')}" cx="${round(vx)}" cy="${round(vy)}" r="${round(1000 * s)}" gradientUnits="userSpaceOnUse">${stops([[0.1, '#FFFFFF', 0], [0.34, '#FFFFFF', 0.6], [0.55, '#FFFFFF', 0.85], [1, '#FFFFFF', 1]])}</radialGradient>`,
    `<mask id="${id('rayMask')}" maskUnits="userSpaceOnUse" ${box}><rect ${frame} fill="url(#${id('rayFade')})"/></mask>`,
    span('mint', [[0, roles.mint, 0], [0.22, roles.mint, 0.95], [0.6, roles.mint, 0.75], [1, roles.mint, 0]]),
    span('lit', [[0, roles.lit, 0], [0.3, roles.lit, 0.9], [0.7, roles.lit, 0.5], [1, roles.lit, 0]]),
    span('core', [[0, roles.core, 0], [0.3, roles.core, 0.9], [0.7, roles.core, 0.5], [1, roles.core, 0]]),
    `<linearGradient id="${id('panel')}" x1="0" y1="0" x2="0" y2="1">${stops([[0, palette.deep, 1], [0.6, palette.deep, 0]])}</linearGradient>`,
    `<linearGradient id="${id('edge')}" x1="0" y1="0" x2="1" y2="0">${stops([[0, palette.progress, 1], [0.5, palette.accent, 1], [1, palette.progress, 1]])}</linearGradient>`,
    `<filter id="${id('soft')}" filterUnits="userSpaceOnUse" ${box} color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${round(Math.max(0.3, 2 * s))}"/></filter>`,
    // Grain: one fractal noise. Red turns the stippled layer's soft alpha into dots of the same
    // density; green and blue scatter dark and light specks across the field.
    `<filter id="${id('grain')}" filterUnits="userSpaceOnUse" ${box} color-interpolation-filters="sRGB"><feGaussianBlur in="SourceGraphic" stdDeviation="${round(Math.max(0.4, 4 * s))}" result="b"/><feTurbulence type="fractalNoise" baseFrequency=".57" numOctaves="1" seed="${seed}" result="n"/><feColorMatrix in="n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 3.4 0 0 0 -1.2" result="na"/><feComposite in="b" in2="na" operator="arithmetic" k2="3.5" k3="-3.5" result="m"/><feComposite in="b" in2="m" operator="in" result="dots"/><feColorMatrix in="n" values="${colorRows(roles.speckDark)} 0 1.1 0 0 -0.62" result="dark"/><feColorMatrix in="n" values="${colorRows(roles.speckLight)} 0 0 1.1 0 -0.66" result="lite"/><feMerge><feMergeNode in="dark"/><feMergeNode in="lite"/><feMergeNode in="dots"/></feMerge></filter>`,
  ].join('');
}

/**
 * Vite+: the vite.plus hero light field. Fine rays and thick mint streaks converge
 * on one point behind a dark terminal, under a grainy arch of light whose crest
 * dissolves into dots.
 */
export function convergenceDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const roles = toneRoles(palette, tone === 'dark');
  const geometry = measure(w, h, random);
  const { rx, ry, s, vx, vy } = geometry;
  const reach = Math.hypot(Math.max(vx, w - vx), Math.max(vy, h - vy)) + 8;
  const half = 380 * s;
  const rays = fineRays(geometry, roles, random, reach, half);
  const streaks = streakSet(geometry, random, reach);
  const terminal = terminalPanel(geometry, palette, id, half);
  const defs = definitions(geometry, roles, palette, id, Math.floor(random() * 97));
  const frame = `width="${round(w)}" height="${round(h)}"`;
  const arch = (fill: string) => `<ellipse cx="${round(vx)}" cy="${round(vy)}" rx="${round(rx * OUTER)}" ry="${round(ry * OUTER)}" fill="url(#${id(fill)})" mask="url(#${id('legs')})"/>`;
  const streakFill = (mint: boolean) => id(mint ? 'mint' : 'lit');
  return `<defs>${defs}</defs><rect ${frame} fill="${roles.ground}"/><rect ${frame} fill="url(#${id('field')})"/><rect ${frame} fill="url(#${id('shade')})"/>${arch('bloom')}${arch('tint')}<g filter="url(#${id('soft')})"><g mask="url(#${id('rayMask')})" fill="none">${rays}</g>${streaks(0.28, () => id('core'))}</g><g filter="url(#${id('grain')})">${arch('halo')}${arch('ring')}${streaks(1.6, streakFill, 0.55)}${streaks(1, streakFill)}${terminal.glow}</g>${terminal.panel}`;
}
