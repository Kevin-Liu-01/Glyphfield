import type { BrandPalette } from '../brandOutputKit';
import { round, type DeviceContext } from '../brandDeviceContext';
import { mixHexColors } from '../color';

/** ISO ID-1 card proportions, 85.60 by 53.98 mm. */
const CARD_RATIO = 85.6 / 53.98;
/** The steel band starts this far down the card. */
const BAND_START = 0.765;
/** The most the card turns either way, in degrees. */
const MAX_TURN = 7;

/** Concentric circles about (cx, cy) wide enough to cross a w by h face; a clip trims them to it. */
function guilloche(cx: number, cy: number, step: number, w: number, h: number): string {
  const corners: ReadonlyArray<readonly [number, number]> = [[0, 0], [w, 0], [0, h], [w, h]];
  const distances = corners.map(([x, y]) => Math.hypot(x - cx, y - cy));
  const near = Math.min(...distances);
  const far = Math.max(...distances);
  let path = '';
  for (let radius = Math.ceil(near / step) * step; radius <= far; radius += step) {
    const r = round(radius);
    path += `M${round(cx - radius)} ${round(cy)}a${r} ${r} 0 1 0 ${round(radius * 2)} 0a${r} ${r} 0 1 0 ${round(-radius * 2)} 0`;
  }
  return path;
}

/** EMV contacts: a central pad with three contacts down each side. */
function chipContacts(x: number, y: number, w: number, h: number): string {
  const third = w / 3;
  return [
    `M${round(x + third)} ${round(y)}v${round(h * 0.3)}`,
    `M${round(x + third * 2)} ${round(y)}v${round(h * 0.3)}`,
    `M${round(x + third)} ${round(y + h)}v${round(-h * 0.3)}`,
    `M${round(x + third * 2)} ${round(y + h)}v${round(-h * 0.3)}`,
    `M${round(x + third)} ${round(y + h * 0.3)}c${round(third * 0.2)} ${round(-h * 0.06)} ${round(third * 0.8)} ${round(-h * 0.06)} ${round(third)} 0`,
    `M${round(x + third)} ${round(y + h * 0.3)}v${round(h * 0.4)}c${round(third * 0.2)} ${round(h * 0.06)} ${round(third * 0.8)} ${round(h * 0.06)} ${round(third)} 0v${round(-h * 0.4)}`,
    `M${round(x)} ${round(y + h * 0.36)}h${round(third)}`,
    `M${round(x)} ${round(y + h * 0.64)}h${round(third)}`,
    `M${round(x + third * 2)} ${round(y + h * 0.36)}h${round(third)}`,
    `M${round(x + third * 2)} ${round(y + h * 0.64)}h${round(third)}`,
  ].join('');
}

/** Everything that changes with tone: the card's metal and print, the panel, the shadows. */
type Finish = {
  bandLine: number;
  chipDark: string;
  chipLight: string;
  chipLine: string;
  dotOpacity: number;
  edge: string;
  face: readonly [string, string, string, string];
  hairOpacity: number;
  line: string;
  outerRing: number;
  panel: string;
  panelShade: number;
  shadow: string;
  shadowSoft: number;
  shadowTight: number;
  sheen: string;
  sheenOpacity: number;
  sheenRim: number;
  steel: readonly [string, string, string];
  steelFoot: number;
};

const lift = (color: string, amount: number) => mixHexColors(color, '#FFFFFF', amount);

function cardFinish(palette: BrandPalette, dark: boolean): Finish {
  const chip = {
    chipDark: mixHexColors(mixHexColors(mixHexColors(palette.ink, palette.muted, 0.5), palette.progress, 0.1), palette.accent, 0.04),
    chipLight: mixHexColors(mixHexColors(mixHexColors(palette.ink, palette.muted, 0.78), palette.progress, 0.08), palette.accent, 0.05),
    chipLine: mixHexColors(palette.ink, palette.muted, 0.3),
  };
  if (dark) {
    // A charcoal card on the deep panel. Its shadow must be darker than deep, or it only erases the dots.
    return {
      ...chip,
      bandLine: 0.4,
      dotOpacity: 0.15,
      edge: mixHexColors(palette.deep, palette.ink, 0.35),
      face: [mixHexColors(palette.deep, palette.ink, 0.75), mixHexColors(palette.ink, palette.paper, 0.13), mixHexColors(palette.ink, palette.paper, 0.04), mixHexColors(palette.deep, palette.ink, 0.6)],
      hairOpacity: 0.12,
      line: palette.paper,
      outerRing: 0.05,
      panel: palette.deep,
      panelShade: 0.32,
      shadow: mixHexColors(palette.deep, '#000000', 0.55),
      shadowSoft: 0.55,
      shadowTight: 0.7,
      sheen: lift(palette.paper, 0.3),
      sheenOpacity: 0.16,
      sheenRim: 0.22,
      steel: [mixHexColors(palette.deep, palette.muted, 0.3), mixHexColors(palette.deep, palette.muted, 0.36), mixHexColors(palette.deep, palette.muted, 0.45)],
      steelFoot: 0.3,
    };
  }
  // The approved cover: a pale card on the stone panel.
  return {
    ...chip,
    bandLine: 0.18,
    dotOpacity: 0.16,
    edge: mixHexColors(palette.ink, palette.muted, 0.72),
    face: [mixHexColors(palette.paper, palette.muted, 0.55), lift(palette.paper, 1), lift(palette.paper, 0.4), mixHexColors(palette.muted, palette.paper, 0.35)],
    hairOpacity: 0.14,
    line: palette.ink,
    outerRing: 0.045,
    panel: palette.muted,
    panelShade: 0.2,
    shadow: palette.ink,
    shadowSoft: 0.3,
    shadowTight: 0.34,
    sheen: lift(palette.paper, 1),
    sheenOpacity: 0.22,
    sheenRim: 0.9,
    steel: [mixHexColors(palette.ink, palette.muted, 0.47), mixHexColors(palette.ink, palette.muted, 0.53), mixHexColors(palette.ink, palette.muted, 0.585)],
    steelFoot: 0.12,
  };
}

/**
 * Ramp: the corporate card on ramp.com's dotted stone panel. The card (fine-line
 * guilloche face, steel band, EMV chip) lies near the panel's rounded corner, which
 * opens onto the highlighter accent field. Light tone is the approved cover: a pale
 * card on a stone panel. Dark tone is a charcoal card on a deep panel. The card's
 * turn, the panel corner and the dot phase vary with the seed.
 */
export function ledgerDevice(context: DeviceContext): string {
  const { h, id, palette, random, tone, w } = context;
  const unit = Math.min(w, h);
  const finish = cardFinish(palette, tone === 'dark');

  // Composition. The card sits near the middle of the box; the panel corner sits a
  // seeded gap beyond its lower right, and the accent field shows past that corner.
  const turn = (random() * 2 - 1) * MAX_TURN;
  const gapX = unit * (0.05 + random() * 0.055);
  const gapY = unit * (0.05 + random() * 0.055);
  const centerX = w / 2 + unit * (random() - 0.5) * 0.08;
  const centerY = h / 2 + unit * (random() - 0.5) * 0.05;
  const dotPhaseX = random();
  const dotPhaseY = random();
  const radians = (Math.abs(turn) * Math.PI) / 180;
  // Bounding box of the turned card per unit of card width.
  const spanX = Math.cos(radians) + Math.sin(radians) / CARD_RATIO;
  const spanY = Math.sin(radians) + Math.cos(radians) / CARD_RATIO;
  const fieldMinX = Math.max(unit * 0.14, w * 0.1);
  const fieldMinY = Math.max(unit * 0.13, h * 0.1);
  const marginX = unit * 0.07;
  const marginY = unit * 0.07;
  const halfX = Math.min(w - centerX - gapX - fieldMinX, centerX - marginX);
  const halfY = Math.min(h - centerY - gapY - fieldMinY, centerY - marginY);
  // 0.6 of the short side, as on the cover; wide bands have spare width, so the card grows into it.
  const reach = unit * Math.min(0.75, 0.6 + Math.max(0, w / h - 1.78) * 0.12);
  const cardW = Math.max(unit * 0.2, Math.min(reach, (halfX * 2) / spanX, (halfY * 2) / spanY));
  const cardH = cardW / CARD_RATIO;
  const cornerX = centerX + (cardW * spanX) / 2 + gapX;
  const cornerY = centerY + (cardW * spanY) / 2 + gapY;

  // Scale every stroke, blur and offset to the card, as drawn on the 600px cover card.
  const k = cardW / 600;
  const band = cardH * BAND_START;
  const radius = cardW * 0.04;
  const panelRadius = Math.max(4, unit * 0.018);
  const dot = Math.max(6, unit * 0.024);

  const chipW = cardW * 0.132;
  const chipH = cardH * 0.205;
  const chipX = cardW * 0.752;
  const chipY = cardH * 0.47;

  // The panel bleeds off the top and left edges, so only its lower right corner shows.
  const bleed = panelRadius * 2 + unit * 0.05;
  const panelRect = `x="${round(-bleed)}" y="${round(-bleed)}" width="${round(cornerX + bleed)}" height="${round(cornerY + bleed)}" rx="${round(panelRadius)}"`;
  const softBlur = cardW * 0.037;
  const defs = `<defs>`
    + `<pattern id="${id('dots')}" x="${round(dotPhaseX * dot)}" y="${round(dotPhaseY * dot)}" width="${round(dot)}" height="${round(dot)}" patternUnits="userSpaceOnUse"><circle cx="${round(dot / 2)}" cy="${round(dot / 2)}" r="${round(Math.max(0.6, dot * 0.052))}" fill="${finish.line}" fill-opacity="${finish.dotOpacity}"/></pattern>`
    + `<filter id="${id('soft')}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${round(softBlur)}"/></filter>`
    + `<filter id="${id('tight')}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${round(Math.max(0.6, cardW * 0.0083))}"/></filter>`
    + `<linearGradient id="${id('face')}" x1="0" y1="0" x2="${round(cardW)}" y2="${round(band)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${finish.face[0]}"/><stop offset=".38" stop-color="${finish.face[1]}"/><stop offset=".62" stop-color="${finish.face[2]}"/><stop offset="1" stop-color="${finish.face[3]}"/></linearGradient>`
    + `<linearGradient id="${id('steel')}" x1="0" y1="0" x2="${round(cardW)}" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${finish.steel[1]}"/><stop offset=".3" stop-color="${finish.steel[0]}"/><stop offset=".7" stop-color="${finish.steel[2]}"/><stop offset=".9" stop-color="${finish.steel[1]}"/><stop offset="1" stop-color="${finish.steel[0]}"/></linearGradient>`
    + `<linearGradient id="${id('steelV')}" x1="0" y1="${round(band)}" x2="0" y2="${round(cardH)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${finish.sheen}" stop-opacity="${finish.sheenOpacity}"/><stop offset=".08" stop-color="${finish.sheen}" stop-opacity="0"/><stop offset=".85" stop-color="${finish.shadow}" stop-opacity="0"/><stop offset="1" stop-color="${finish.shadow}" stop-opacity="${finish.steelFoot}"/></linearGradient>`
    + `<linearGradient id="${id('chip')}" x1="${round(chipX)}" y1="${round(chipY)}" x2="${round(chipX + chipW)}" y2="${round(chipY + chipH)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${finish.chipLight}"/><stop offset=".55" stop-color="${mixHexColors(finish.chipLight, finish.chipDark, 0.55)}"/><stop offset="1" stop-color="${finish.chipDark}"/></linearGradient>`
    + `<clipPath id="${id('face-clip')}"><rect width="${round(cardW)}" height="${round(band)}"/></clipPath>`
    + `<clipPath id="${id('card-clip')}"><rect width="${round(cardW)}" height="${round(cardH)}" rx="${round(radius)}"/></clipPath>`
    + `</defs>`;

  // Light comes from the upper right, so shadows fall down and to the left.
  const panel = `<rect ${panelRect} fill="${finish.shadow}" fill-opacity="${finish.panelShade}" filter="url(#${id('soft')})" transform="translate(${round(-unit * 0.01)} ${round(unit * 0.018)})"/>`
    + `<rect ${panelRect} fill="${finish.panel}"/>`
    + `<rect ${panelRect} fill="url(#${id('dots')})"/>`
    + `<rect ${panelRect} fill="none" stroke="${finish.line}" stroke-opacity="${finish.hairOpacity}" stroke-width="${round(Math.max(1, unit * 0.002))}"/>`;

  const place = (dx: number, dy: number) => `translate(${round(centerX + dx)} ${round(centerY + dy)}) rotate(${round(turn)}) translate(${round(-cardW / 2)} ${round(-cardH / 2)})`;
  const cardShape = `width="${round(cardW)}" height="${round(cardH)}" rx="${round(radius)}"`;
  const shadows = `<g transform="${place(-20 * k, 28 * k)}"><rect ${cardShape} fill="${finish.shadow}" fill-opacity="${finish.shadowSoft}" filter="url(#${id('soft')})"/></g>`
    + `<g transform="${place(-6 * k, 9 * k)}"><rect ${cardShape} fill="${finish.shadow}" fill-opacity="${finish.shadowTight}" filter="url(#${id('tight')})"/></g>`;

  const step = Math.max(2.2, 4.6 * k);
  const ringStroke = round(Math.min(1.2, Math.max(0.5, 0.9 * k)));
  const rings = `<path d="${guilloche(cardW * 1.1, -cardH * 0.95, step, cardW, band)}" fill="none" stroke="${finish.line}" stroke-opacity=".07" stroke-width="${ringStroke}"/>`
    + `<path d="${guilloche(cardW * 1.16, -cardH * 0.86, step, cardW, band)}" fill="none" stroke="${finish.line}" stroke-opacity="${finish.outerRing}" stroke-width="${ringStroke}"/>`;

  const chipRadius = round(chipW * 0.17);
  const contacts = chipContacts(chipX, chipY, chipW, chipH);
  const hair = Math.max(0.5, k);
  const chip = `<rect x="${round(chipX)}" y="${round(chipY)}" width="${round(chipW)}" height="${round(chipH)}" rx="${chipRadius}" fill="url(#${id('chip')})"/>`
    + `<path d="${contacts}" fill="none" stroke="${lift(palette.paper, 1)}" stroke-opacity=".4" stroke-width="${round(hair)}" transform="translate(${round(0.9 * k)} ${round(0.9 * k)})"/>`
    + `<path d="${contacts}" fill="none" stroke="${finish.chipLine}" stroke-opacity=".7" stroke-width="${round(hair * 1.2)}"/>`
    + `<rect x="${round(chipX + hair / 2)}" y="${round(chipY + hair / 2)}" width="${round(chipW - hair)}" height="${round(chipH - hair)}" rx="${chipRadius}" fill="none" stroke="${palette.ink}" stroke-opacity=".28" stroke-width="${round(hair)}"/>`;

  const card = `<g transform="${place(0, 0)}">`
    + `<rect y="${round(2 * k)}" ${cardShape} fill="${finish.edge}"/>`
    + `<g clip-path="url(#${id('card-clip')})">`
    + `<rect width="${round(cardW)}" height="${round(cardH)}" fill="url(#${id('face')})"/>`
    + `<g clip-path="url(#${id('face-clip')})">${rings}</g>`
    + `<rect y="${round(band)}" width="${round(cardW)}" height="${round(cardH - band)}" fill="url(#${id('steel')})"/>`
    + `<rect y="${round(band)}" width="${round(cardW)}" height="${round(cardH - band)}" fill="url(#${id('steelV')})"/>`
    + `<path d="M0 ${round(band)}H${round(cardW)}" stroke="${finish.shadow}" stroke-opacity="${finish.bandLine}" stroke-width="${round(1.2 * k)}"/>`
    + `</g>`
    + `<rect x="${round(0.75 * k)}" y="${round(0.75 * k)}" width="${round(cardW - 1.5 * k)}" height="${round(cardH - 1.5 * k)}" rx="${round(radius - 0.75 * k)}" fill="none" stroke="${finish.sheen}" stroke-opacity="${finish.sheenRim}" stroke-width="${round(Math.max(0.75, 1.5 * k))}" clip-path="url(#${id('face-clip')})"/>`
    + `<rect ${cardShape} fill="none" stroke="${finish.line}" stroke-opacity="${finish.hairOpacity}" stroke-width="${round(hair)}"/>`
    + chip
    + `</g>`;

  return `${defs}<rect width="${round(w)}" height="${round(h)}" fill="${palette.accent}"/>${panel}${shadows}${card}`;
}
