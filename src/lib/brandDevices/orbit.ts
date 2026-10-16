import { contrastRatio, round, type DeviceContext } from '../brandDeviceContext';
import { mixHexColors } from '../color';

/**
 * An orbital system for new identities: nested orbits on one tilted plane, drawn as fine solid,
 * dashed and dotted paths with a dial, a luminous accent body with a soft halo, satellites in the
 * secondary and highlight colours with motion trails, and a field of star dust along the plane.
 */

type System = {
  body: number;
  cx: number;
  cy: number;
  flat: number;
  hair: number;
  radii: number[];
  tilt: number;
  unit: number;
};

type Inks = {
  accent: string;
  dark: boolean;
  highlight: string;
  rule: string;
  secondary: string;
  shade: string;
};

type Satellite = {
  color: string;
  ring: number;
  size: number;
  trail: number;
  t: number;
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

function point(system: System, radius: number, t: number): [number, number] {
  return [radius * Math.cos(t), radius * system.flat * Math.sin(t)];
}

function layoutSystem(w: number, h: number, random: () => number): System {
  const unit = Math.min(w, h);
  const aspect = w / h;
  const wide = aspect > 1.25;
  // Wide frames stretch the orbits along the plane so the system still spans the band.
  const scale = clamp(1 + (aspect - 1) * 0.25, 1, 1.5);
  return {
    body: unit * 0.082,
    cx: wide ? w * (0.58 + random() * 0.06) : w * (0.48 + random() * 0.04),
    cy: h * (0.5 + (random() - 0.5) * 0.06),
    flat: 0.3 + random() * 0.08,
    hair: Math.max(0.75, unit * 0.0013),
    radii: [0.21, 0.33, 0.47, 0.63, 0.82, 1.05].map((radius) => radius * unit * scale),
    tilt: -(13 + random() * 12),
    unit,
  };
}

/** Each orbit's look, inner to outer: [dash pattern, opacity, width multiplier]. */
const RING_STYLES: ReadonlyArray<readonly [string, number, number]> = [
  ['', 0.72, 1.2],
  ['dash', 0.62, 1],
  ['', 0.55, 1.1],
  ['dot', 0.8, 2],
  ['', 0.4, 1],
  ['long', 0.32, 1],
];

function dashFor(style: string, system: System): string {
  const u = system.unit;
  if (style === 'dash') return ` stroke-dasharray="${round(u * 0.004)} ${round(u * 0.009)}"`;
  if (style === 'dot') return ` stroke-dasharray="0 ${round(u * 0.011)}" stroke-linecap="round"`;
  if (style === 'long') return ` stroke-dasharray="${round(u * 0.018)} ${round(u * 0.008)}"`;
  return '';
}

/** Orbit halves: the far half sits behind the body and reads fainter, the near half passes in front. */
function rings(system: System, half: 'back' | 'front', gradient: string, dark: boolean): string {
  return system.radii.map((radius, index) => {
    const [style, opacity, weight] = RING_STYLES[index]!;
    const ry = radius * system.flat;
    const d = half === 'back'
      ? `M${round(-radius)} 0A${round(radius)} ${round(ry)} 0 0 1 ${round(radius)} 0`
      : `M${round(radius)} 0A${round(radius)} ${round(ry)} 0 0 1 ${round(-radius)} 0`;
    return `<path d="${d}" stroke="url(#${gradient})" stroke-opacity="${round(Math.min(1, opacity * (half === 'back' ? 0.5 : 1) * (dark ? 1 : 1.25)))}" stroke-width="${round(system.hair * weight * (dark ? 1 : 1.2))}"${dashFor(style, system)}/>`;
  }).join('');
}

/** Degree ticks on the outer dial, foreshortened with the plane, plus the line of nodes and the spin axis. */
function instruments(system: System, inks: Inks, random: () => number): string {
  const dial = system.radii[4]! * 1.04;
  const ticks: string[] = [];
  for (let step = 0; step < 120; step += 1) {
    const t = (step / 120) * Math.PI * 2;
    const length = step % 10 === 0 ? 0.05 : step % 5 === 0 ? 0.03 : 0.014;
    const [x0, y0] = point(system, dial, t);
    const [x1, y1] = point(system, dial * (1 + length), t);
    ticks.push(`M${round(x0)} ${round(y0)}L${round(x1)} ${round(y1)}`);
  }
  // A transfer orbit: periapsis on an inner ring, apoapsis on an outer one, the body at its focus.
  const inner = system.radii[1]!;
  const outer = system.radii[4]!;
  const a = (inner + outer) / 2;
  const c = (outer - inner) / 2;
  const b = Math.sqrt(inner * outer);
  const phi = random() * Math.PI * 2;
  const transfer: string[] = [];
  for (let step = 0; step <= 64; step += 1) {
    const s = (step / 64) * Math.PI * 2;
    const px = -c + a * Math.cos(s);
    const py = b * Math.sin(s);
    const x = px * Math.cos(phi) - py * Math.sin(phi);
    const y = (px * Math.sin(phi) + py * Math.cos(phi)) * system.flat;
    transfer.push(`${step === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`);
  }
  const inclined = system.radii[3]! * 1.04;
  const reach = system.radii[5]! * 1.08;
  const axis = system.body * 2.6;
  const dash = `${round(system.unit * 0.006)} ${round(system.unit * 0.01)}`;
  return `<path d="${ticks.join('')}" stroke="${inks.rule}" stroke-opacity=".32" stroke-width="${round(system.hair)}"/>`
    + `<path d="${transfer.join('')}Z" stroke="${inks.accent}" stroke-opacity="${inks.dark ? '.5' : '.6'}" stroke-width="${round(system.hair)}" stroke-dasharray="${dash}"/>`
    + `<ellipse rx="${round(inclined)}" ry="${round(inclined * system.flat * 0.5)}" transform="rotate(${round(24 + random() * 14)})" stroke="${inks.highlight}" stroke-opacity="${inks.dark ? '.4' : '.55'}" stroke-width="${round(system.hair)}" stroke-dasharray="${round(system.unit * 0.002)} ${round(system.unit * 0.007)}"/>`
    + `<path d="M${round(-reach)} 0H${round(reach)}" stroke="${inks.rule}" stroke-opacity=".14" stroke-width="${round(system.hair)}" stroke-dasharray="${dash}"/>`
    + `<path d="M0 ${round(-axis)}V${round(axis)}" stroke="${inks.rule}" stroke-opacity=".38" stroke-width="${round(system.hair)}"/>`;
}

/** Where a point on an orbit lands in the frame, after the plane's tilt and offset. */
function screen(system: System, radius: number, t: number): [number, number] {
  const [x, y] = point(system, radius, t);
  const angle = (system.tilt * Math.PI) / 180;
  return [system.cx + x * Math.cos(angle) - y * Math.sin(angle), system.cy + x * Math.sin(angle) + y * Math.cos(angle)];
}

/** The first angle from `start` across `range` that keeps a satellite inside the frame's margin. */
function visibleAngle(system: System, w: number, h: number, radius: number, start: number, range: number): number {
  const margin = system.unit * 0.08;
  for (let step = 0; step < 16; step += 1) {
    const t = start + ((step * 0.37) % 1) * range;
    const [x, y] = screen(system, radius, t);
    if (x > margin && x < w - margin && y > margin && y < h - margin) return t;
  }
  return start;
}

function satellites(system: System, inks: Inks, w: number, h: number, random: () => number): Satellite[] {
  const { radii, unit } = system;
  // The secondary moon rides the near half of its orbit, the highlight moon the far half.
  const near = Math.PI * (0.15 + random() * 0.5);
  const far = Math.PI * (1.1 + random() * 0.5);
  return [
    { color: inks.secondary, ring: 2, size: unit * 0.021, trail: 0.62, t: visibleAngle(system, w, h, radii[2]!, near, Math.PI * 0.7) },
    { color: inks.highlight, ring: 4, size: unit * 0.015, trail: 0.42, t: visibleAngle(system, w, h, radii[4]!, far, Math.PI * 0.8) },
    { color: mixHexColors(inks.secondary, inks.rule, 0.35), ring: 0, size: unit * 0.009, trail: 0.9, t: Math.PI * (0.55 + random() * 0.35) },
  ];
}

function satelliteDefs(system: System, list: Satellite[], id: (name: string) => string, shade: string): string {
  return list.map((satellite, index) => {
    const radius = system.radii[satellite.ring]!;
    const [x1, y1] = point(system, radius, satellite.t);
    const [x0, y0] = point(system, radius, satellite.t - satellite.trail);
    return `<linearGradient id="${id(`trail${index}`)}" x1="${round(x0)}" y1="${round(y0)}" x2="${round(x1)}" y2="${round(y1)}" gradientUnits="userSpaceOnUse"><stop stop-color="${satellite.color}" stop-opacity="0"/><stop offset="1" stop-color="${satellite.color}" stop-opacity=".95"/></linearGradient>`
      + `<radialGradient id="${id(`moon${index}`)}" cx=".36" cy=".32" r=".75"><stop stop-color="${mixHexColors(satellite.color, '#FFFFFF', 0.55)}"/><stop offset=".55" stop-color="${satellite.color}"/><stop offset="1" stop-color="${mixHexColors(satellite.color, shade, 0.3)}"/></radialGradient>`;
  }).join('');
}

/** Satellites ride their orbits with a tapering trail behind them and a fine marker ring around them. */
function satelliteMarks(system: System, list: Satellite[], inks: Inks, id: (name: string) => string): string {
  return list.map((satellite, index) => {
    const radius = system.radii[satellite.ring]!;
    const ry = radius * system.flat;
    const [x1, y1] = point(system, radius, satellite.t);
    const [x0, y0] = point(system, radius, satellite.t - satellite.trail);
    const arc = `M${round(x0)} ${round(y0)}A${round(radius)} ${round(ry)} 0 0 1 ${round(x1)} ${round(y1)}`;
    const marker = index < 2
      ? `<circle cx="${round(x1)}" cy="${round(y1)}" r="${round(satellite.size * 2.3)}" fill="none" stroke="${inks.rule}" stroke-opacity=".35" stroke-width="${round(system.hair)}"/>`
      : '';
    return `<path d="${arc}" stroke="url(#${id(`trail${index}`)})" stroke-width="${round(satellite.size * 1.5)}" stroke-opacity=".28" stroke-linecap="round"/>`
      + `<path d="${arc}" stroke="url(#${id(`trail${index}`)})" stroke-width="${round(Math.max(system.hair, satellite.size * 0.5))}" stroke-linecap="round"/>`
      + `<circle cx="${round(x1)}" cy="${round(y1)}" r="${round(satellite.size * 1.7)}" fill="${satellite.color}" fill-opacity="${inks.dark ? '.16' : '.14'}"/>`
      + `<circle cx="${round(x1)}" cy="${round(y1)}" r="${round(satellite.size)}" fill="url(#${id(`moon${index}`)})"/>${marker}`;
  }).join('');
}

/** Star dust: most grains gather along the orbital plane, a few bright ones carry a four-point glint. */
function starDust(w: number, h: number, system: System, inks: Inks, random: () => number): string {
  const count = clamp(Math.round((w * h) / (inks.dark ? 8200 : 11000)), 26, 190);
  const angle = (system.tilt * Math.PI) / 180;
  const tints = [inks.rule, inks.rule, inks.rule, inks.secondary, inks.highlight, inks.accent];
  const grains: string[] = [];
  const glints: string[] = [];
  for (let index = 0; index < count; index += 1) {
    let x = random() * w;
    let y = random() * h;
    if (random() < 0.55) {
      const along = (random() - 0.5) * Math.max(w, h) * 1.3;
      const across = (random() + random() + random() - 1.5) * system.unit * 0.22;
      x = system.cx + along * Math.cos(angle) - across * Math.sin(angle);
      y = system.cy + along * Math.sin(angle) + across * Math.cos(angle);
    }
    if (x < 0 || x > w || y < 0 || y > h) continue;
    const bright = random() < 0.05;
    const size = system.unit * (bright ? 0.0034 : 0.0008 + random() * 0.0022);
    const tint = tints[Math.floor(random() * tints.length)]!;
    const opacity = inks.dark ? 0.25 + random() * 0.6 : 0.25 + random() * 0.45;
    grains.push(`<circle cx="${round(x)}" cy="${round(y)}" r="${round(Math.max(0.45, size))}" fill="${tint}" fill-opacity="${round(opacity)}"/>`);
    if (bright) {
      const arm = size * 4.5;
      glints.push(`M${round(x - arm)} ${round(y)}H${round(x + arm)}M${round(x)} ${round(y - arm)}V${round(y + arm)}`);
    }
  }
  return `${grains.join('')}<path d="${glints.join('')}" stroke="${inks.rule}" stroke-opacity="${inks.dark ? '.55' : '.4'}" stroke-width="${round(system.hair * 0.8)}"/>`;
}

function definitions(context: DeviceContext, system: System, inks: Inks, list: Satellite[]): string {
  const { id, palette } = context;
  const outer = system.radii[5]!;
  const ringStops = `<stop stop-color="${inks.rule}" stop-opacity=".35"/><stop offset=".6" stop-color="${inks.rule}" stop-opacity=".85"/><stop offset="1" stop-color="${inks.rule}"/>`;
  const ring = `<linearGradient id="${id('ring')}" x1="${round(-outer)}" y1="0" x2="${round(outer)}" y2="0" gradientUnits="userSpaceOnUse">${ringStops}</linearGradient>`;
  const glow = `<radialGradient id="${id('glow')}" cx="${round(system.cx)}" cy="${round(system.cy)}" r="${round(system.unit * 0.95)}" gradientUnits="userSpaceOnUse"><stop stop-color="${palette.accent}" stop-opacity="${inks.dark ? '.24' : '.1'}"/><stop offset=".35" stop-color="${palette.accent}" stop-opacity="${inks.dark ? '.08' : '.035'}"/><stop offset="1" stop-color="${palette.accent}" stop-opacity="0"/></radialGradient>`;
  const plane = `<radialGradient id="${id('plane')}" cx="0" cy="0" r="${round(outer)}" gradientUnits="userSpaceOnUse" gradientTransform="scale(1 ${round(system.flat)})"><stop stop-color="${palette.secondary}" stop-opacity="${inks.dark ? '.1' : '.07'}"/><stop offset=".7" stop-color="${palette.secondary}" stop-opacity="${inks.dark ? '.035' : '.025'}"/><stop offset="1" stop-color="${palette.secondary}" stop-opacity="0"/></radialGradient>`;
  const halo = `<radialGradient id="${id('halo')}"><stop stop-color="${inks.accent}" stop-opacity=".7"/><stop offset=".24" stop-color="${inks.accent}" stop-opacity=".42"/><stop offset=".5" stop-color="${inks.accent}" stop-opacity=".12"/><stop offset="1" stop-color="${inks.accent}" stop-opacity="0"/></radialGradient>`;
  const sphere = `<radialGradient id="${id('body')}" cx=".38" cy=".34" r=".72"><stop stop-color="${mixHexColors(inks.accent, '#FFFFFF', 0.6)}"/><stop offset=".3" stop-color="${mixHexColors(inks.accent, '#FFFFFF', 0.18)}"/><stop offset=".72" stop-color="${inks.accent}"/><stop offset="1" stop-color="${mixHexColors(inks.accent, palette.deep, 0.4)}"/></radialGradient>`;
  return `<defs>${ring}${glow}${plane}${halo}${sphere}${satelliteDefs(system, list, id, palette.deep)}</defs>`;
}

function centralBody(system: System, inks: Inks, id: (name: string) => string): string {
  const { body } = system;
  return `<circle r="${round(body * 4.2)}" fill="url(#${id('halo')})"/>`
    + `<circle r="${round(body * 1.5)}" fill="none" stroke="${inks.accent}" stroke-opacity=".55" stroke-width="${round(system.hair)}" stroke-dasharray="${round(system.unit * 0.003)} ${round(system.unit * 0.006)}"/>`
    + `<circle r="${round(body)}" fill="url(#${id('body')})"/>`
    + `<circle r="${round(body * 1.04)}" fill="none" stroke="${mixHexColors(inks.accent, inks.dark ? '#FFFFFF' : inks.shade, 0.5)}" stroke-opacity=".55" stroke-width="${round(system.hair * 1.4)}"/>`;
}

export function orbitDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const dark = tone === 'dark';
  const ground = dark ? palette.deep : palette.paper;
  // Pale roles on paper deepen toward a dark accent so they keep the brand's hue instead of going grey.
  const away = dark ? '#FFFFFF' : mixHexColors(palette.accent, palette.deep, 0.45);
  const inks: Inks = {
    accent: dark ? separated(palette.accent, ground, '#FFFFFF', 1.8) : palette.accent,
    dark,
    highlight: separated(palette.highlight, ground, away, 1.9),
    rule: dark ? palette.paper : palette.ink,
    secondary: separated(palette.secondary, ground, away, 1.9),
    shade: palette.deep,
  };
  const system = layoutSystem(w, h, random);
  const list = satellites(system, inks, w, h, random);
  const frame = `translate(${round(system.cx)} ${round(system.cy)}) rotate(${round(system.tilt)})`;
  const outer = system.radii[5]!;
  return definitions(context, system, inks, list)
    + `<rect width="${round(w)}" height="${round(h)}" fill="${ground}"/>`
    + `<rect width="${round(w)}" height="${round(h)}" fill="url(#${id('glow')})"/>`
    + starDust(w, h, system, inks, random)
    + `<g transform="${frame}" fill="none">`
    + `<ellipse rx="${round(outer)}" ry="${round(outer * system.flat)}" fill="url(#${id('plane')})"/>`
    + rings(system, 'back', id('ring'), dark)
    + instruments(system, inks, random)
    + centralBody(system, inks, id)
    + rings(system, 'front', id('ring'), dark)
    + satelliteMarks(system, list, inks, id)
    + '</g>';
}
