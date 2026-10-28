import { mixHexColors } from './color';
import { escapeXml } from './download';
import { isSafeExpressionColor } from './expressionModel';

/**
 * Brand graphic devices drawn as plain SVG in a layer's box. Each one is the
 * identity's own device from its dossier, so a layer reads as that brand
 * without depending on a photo.
 */

export const EXPRESSION_DEVICES = [
  { id: 'greetings', label: 'Language field' },
  { id: 'beam', label: 'Knowledge beam' },
  { id: 'waves', label: 'Utility wave' },
  { id: 'ledger', label: 'Savings ledger' },
  { id: 'horizon', label: 'Network horizon' },
  { id: 'convergence', label: 'Convergence field' },
  { id: 'field', label: 'Programmable field' },
  { id: 'window', label: 'Focus window' },
  { id: 'interruption', label: 'Engineered interruption' },
] as const;

export type ExpressionDeviceId = (typeof EXPRESSION_DEVICES)[number]['id'];

export function isExpressionDevice(value: unknown): value is ExpressionDeviceId {
  return typeof value === 'string' && EXPRESSION_DEVICES.some(({ id }) => id === value);
}

export type DeviceBox = { height: number; width: number; x: number; y: number };

export type DeviceContext = {
  colors: Readonly<Record<string, string>>;
  fontFamily: string;
  /** Short words in many scripts (greetings) or product names (ledger rows). */
  items: readonly string[];
  /** Proof figures, e.g. "$12B+ saved". */
  proof: readonly string[];
  uid: string;
};

const round = (value: number) => Math.round(value * 100) / 100;

function color(context: DeviceContext, role: string, fallback: string) {
  const value = context.colors[role];
  return isSafeExpressionColor(value) ? value : fallback;
}

function clip(box: DeviceBox, uid: string, body: string, background?: string): string {
  return `<defs><clipPath id="${uid}-clip"><rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}"/></clipPath></defs><g clip-path="url(#${uid}-clip)">${background ? `<rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}" fill="${escapeXml(background)}"/>` : ''}${body}</g>`;
}

function dots(box: DeviceBox, uid: string, fill: string, opacity: number, step: number): string {
  return `<defs><pattern id="${uid}-dots" x="${round(box.x)}" y="${round(box.y)}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="${escapeXml(fill)}" opacity="${opacity}"/></pattern></defs><rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}" fill="url(#${uid}-dots)"/>`;
}

function greetings(box: DeviceBox, context: DeviceContext): string {
  const background = '#101010';
  const ink = '#FFFFFF';
  const words = (context.items.length > 0 ? context.items : ['Welcome', '你好', 'Bienvenidos', 'ようこそ', 'أهلاً وسهلاً']).slice(0, 6);
  const unit = Math.min(box.width, box.height);
  const size = round(Math.max(14, unit * 0.06));
  const columns = box.width > box.height * 0.9 ? 2 : 1;
  const rows = Math.ceil(words.length / columns);
  const columnWidth = box.width * 0.36;
  const left = box.x + (box.width - columnWidth * columns) / 2;
  const rowGap = Math.min(box.height * 0.7 / Math.max(rows, 1), size * 3.4);
  const top = box.y + (box.height - rowGap * (rows - 1)) / 2;
  const text = words.map((word, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const opacity = [0.92, 0.72, 0.84, 0.66, 0.78, 0.6][index] ?? 0.7;
    return `<text x="${round(left + column * columnWidth)}" y="${round(top + row * rowGap)}" fill="${ink}" opacity="${opacity}" font-family="${context.fontFamily}" font-size="${size}" font-weight="450">${escapeXml(word)}</text>`;
  }).join('');
  return clip(box, context.uid, `${dots(box, context.uid, ink, 0.08, 14)}${text}`, background);
}

function beam(box: DeviceBox, context: DeviceContext): string {
  const { height, width, x, y } = box;
  const sx = (value: number) => round(x + value * width);
  const sy = (value: number) => round(y + value * height);
  const stroke = Math.max(24, Math.min(width, height) * 0.18);
  const body = `<defs><radialGradient id="${context.uid}-glow" cx="52%" cy="42%" r="74%"><stop offset="0%" stop-color="#70F1C2" stop-opacity="0.54"/><stop offset="46%" stop-color="#18B985" stop-opacity="0.2"/><stop offset="100%" stop-color="#04110D" stop-opacity="0"/></radialGradient><linearGradient id="${context.uid}-beam" x1="0%" x2="100%" y1="100%" y2="0%"><stop offset="0%" stop-color="#0A6A50"/><stop offset="48%" stop-color="#7EF2CA"/><stop offset="100%" stop-color="#E9FFF8"/></linearGradient></defs><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" fill="url(#${context.uid}-glow)"/><path d="M${sx(-0.2)} ${sy(0.95)} C${sx(0.07)} ${sy(0.76)} ${sx(0.26)} ${sy(0.62)} ${sx(0.43)} ${sy(0.43)} S${sx(0.81)} ${sy(0.11)} ${sx(1.2)} ${sy(-0.13)}" fill="none" stroke="url(#${context.uid}-beam)" stroke-width="${round(stroke)}" opacity="0.88"/><path d="M${sx(-0.15)} ${sy(1.03)} C${sx(0.14)} ${sy(0.84)} ${sx(0.36)} ${sy(0.68)} ${sx(0.54)} ${sy(0.48)} S${sx(0.86)} ${sy(0.14)} ${sx(1.17)} ${sy(-0.05)}" fill="none" stroke="#DFFFF4" stroke-width="${round(stroke * 0.22)}" opacity="0.28"/><path d="M${sx(-0.14)} ${sy(0.79)} C${sx(0.14)} ${sy(0.65)} ${sx(0.29)} ${sy(0.5)} ${sx(0.45)} ${sy(0.34)} S${sx(0.81)} ${sy(0.07)} ${sx(1.14)} ${sy(-0.1)}" fill="none" stroke="#72EDC1" stroke-width="2" opacity="0.78"/>${dots(box, context.uid, '#D9FFF2', 0.12, 18)}`;
  return clip(box, context.uid, body, '#04110D');
}

function waves(box: DeviceBox, context: DeviceContext): string {
  const { height, width, x, y } = box;
  const sx = (value: number) => round(x + value * width);
  const sy = (value: number) => round(y + value * height);
  const wave = (offset: number, strokeWidth: number, opacity: number, glow: boolean) => {
    const path = `M${sx(-0.17)} ${sy(0.2 + offset)} C${sx(0.07)} ${sy(0.02 + offset)} ${sx(0.27)} ${sy(0.39 + offset)} ${sx(0.53)} ${sy(0.21 + offset)} S${sx(0.93)} ${sy(0.06 + offset)} ${sx(1.2)} ${sy(0.21 + offset)}`;
    return `${glow ? `<path d="${path}" fill="none" stroke="#0EA5E9" stroke-width="${round(strokeWidth * 4.5)}" opacity="0.08"/>` : ''}<path d="${path}" fill="none" stroke="url(#${context.uid}-current)" stroke-width="${round(strokeWidth)}" opacity="${opacity}"/>`;
  };
  const unit = Math.min(width, height);
  const body = `<defs><linearGradient id="${context.uid}-current" x1="0%" x2="100%" y1="20%" y2="80%"><stop offset="0%" stop-color="#0EA5E9"/><stop offset="50%" stop-color="#67E8F9"/><stop offset="100%" stop-color="#38BDF8"/></linearGradient><radialGradient id="${context.uid}-glow" cx="58%" cy="46%" r="70%"><stop offset="0%" stop-color="#38BDF8" stop-opacity="0.24"/><stop offset="100%" stop-color="#061724" stop-opacity="0"/></radialGradient></defs><rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" fill="url(#${context.uid}-glow)"/>${wave(0, unit * 0.032, 0.92, true)}${wave(0.3, unit * 0.026, 0.78, true)}${wave(0.6, unit * 0.02, 0.62, false)}${dots(box, context.uid, '#BAE6FD', 0.1, 20)}`;
  return clip(box, context.uid, body, '#061724');
}

function ledger(box: DeviceBox, context: DeviceContext): string {
  const ink = color(context, 'ink', '#292827');
  const paper = color(context, 'paper', '#F8F7F3');
  const highlight = color(context, 'emphasis', '#D7FF64');
  const rule = mixHexColors(paper, ink, 0.18);
  const rows = (context.items.length > 0 ? context.items : ['Cards', 'Expenses', 'Bills', 'Travel', 'Procurement']).slice(0, 6);
  const figures = context.proof.map((value) => value.split(' ')[0] ?? value);
  const rowHeight = Math.min(box.height / (rows.length + 1.5), 92);
  const size = round(Math.max(12, rowHeight * 0.3));
  const padding = Math.max(20, box.width * 0.07);
  const top = box.y + (box.height - rowHeight * rows.length) / 2;
  const highlightRow = Math.min(1, rows.length - 1);
  const body = rows.map((label, index) => {
    const rowY = top + index * rowHeight;
    const baseline = round(rowY + rowHeight / 2 + size * 0.35);
    const value = figures[index] ?? `${(index + 2) * 7}%`;
    const mark = index === highlightRow
      ? `<rect x="${round(box.x + padding - size * 0.5)}" y="${round(rowY + rowHeight * 0.14)}" width="${round(box.width - padding * 2 + size)}" height="${round(rowHeight * 0.72)}" fill="${escapeXml(highlight)}"/>`
      : '';
    return `${mark}<line x1="${round(box.x + padding)}" y1="${round(rowY + rowHeight)}" x2="${round(box.x + box.width - padding)}" y2="${round(rowY + rowHeight)}" stroke="${escapeXml(rule)}" stroke-width="1"/><text x="${round(box.x + padding)}" y="${baseline}" fill="${escapeXml(ink)}" font-family="${context.fontFamily}" font-size="${size}" font-weight="400">${escapeXml(label)}</text><text x="${round(box.x + box.width - padding)}" y="${baseline}" text-anchor="end" fill="${escapeXml(ink)}" font-family="${context.fontFamily}" font-size="${size}" font-weight="400" style="font-variant-numeric:tabular-nums">${escapeXml(value)}</text>`;
  }).join('');
  const header = `<line x1="${round(box.x + padding)}" y1="${round(top)}" x2="${round(box.x + box.width - padding)}" y2="${round(top)}" stroke="${escapeXml(ink)}" stroke-width="1.5"/>`;
  return clip(box, context.uid, `${header}${body}`, mixHexColors(paper, ink, 0.04));
}

function horizon(box: DeviceBox, context: DeviceContext): string {
  const orange = color(context, 'emphasis', '#F38020');
  const ink = color(context, 'error', '#1D1D1F');
  const horizonY = box.y + box.height * 0.58;
  const nodes = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    const nx = box.x + box.width * (0.08 + t * 0.84);
    const ny = horizonY - Math.sin(t * Math.PI) * box.height * 0.32;
    return { nx, ny };
  });
  const arcs = nodes.map(({ nx, ny }, index) => `<line x1="${round(nx)}" y1="${round(ny)}" x2="${round(box.x + box.width / 2)}" y2="${round(horizonY)}" stroke="${escapeXml(orange)}" stroke-width="1" opacity="${0.22 + (index % 3) * 0.08}"/><circle cx="${round(nx)}" cy="${round(ny)}" r="${round(Math.max(3, box.width * 0.008))}" fill="#FFFFFF" stroke="${escapeXml(orange)}" stroke-width="1.5"/>`).join('');
  const lower = Array.from({ length: 6 }, (_, index) => {
    const ly = horizonY + (index + 1) * box.height * 0.06;
    return `<line x1="${round(box.x)}" y1="${round(ly)}" x2="${round(box.x + box.width)}" y2="${round(ly)}" stroke="#FFFFFF" stroke-width="1" opacity="${round(0.16 - index * 0.02)}"/>`;
  }).join('');
  const body = `${lower}${arcs}<rect x="${round(box.x)}" y="${round(horizonY - 2)}" width="${round(box.width)}" height="4" fill="${escapeXml(orange)}"/><circle cx="${round(box.x + box.width / 2)}" cy="${round(horizonY)}" r="${round(Math.max(6, box.width * 0.018))}" fill="${escapeXml(orange)}"/>`;
  return clip(box, context.uid, body, ink);
}

function convergence(box: DeviceBox, context: DeviceContext): string {
  const violet = color(context, 'emphasis', '#6254FE');
  const mint = color(context, 'success', '#2BFDD2');
  const deep = color(context, 'progress', '#4E14FF');
  const background = color(context, 'ink', '#08060D');
  const focusX = box.x + box.width * 0.72;
  const focusY = box.y + box.height * 0.5;
  const rays = Array.from({ length: 22 }, (_, index) => {
    const t = index / 21;
    const startY = box.y - box.height * 0.1 + t * box.height * 1.2;
    const bend = (t - 0.5) * box.height * 0.4;
    const stroke = index % 5 === 0 ? mint : index % 2 === 0 ? violet : deep;
    return `<path d="M${round(box.x - box.width * 0.05)} ${round(startY)} C${round(box.x + box.width * 0.35)} ${round(startY)} ${round(focusX - box.width * 0.2)} ${round(focusY + bend * 0.3)} ${round(focusX)} ${round(focusY)}" fill="none" stroke="${escapeXml(stroke)}" stroke-width="${index % 5 === 0 ? 2 : 1.2}" opacity="${index % 5 === 0 ? 0.9 : 0.55}"/>`;
  }).join('');
  const body = `<defs><radialGradient id="${context.uid}-core" cx="${round((focusX - box.x) / box.width * 100)}%" cy="50%" r="45%"><stop offset="0%" stop-color="${escapeXml(violet)}" stop-opacity="0.75"/><stop offset="60%" stop-color="${escapeXml(deep)}" stop-opacity="0.18"/><stop offset="100%" stop-color="${escapeXml(background)}" stop-opacity="0"/></radialGradient></defs><rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}" fill="url(#${context.uid}-core)"/>${rays}<circle cx="${round(focusX)}" cy="${round(focusY)}" r="${round(Math.max(5, box.height * 0.02))}" fill="#FFFFFF"/>`;
  return clip(box, context.uid, body, background);
}

function field(box: DeviceBox, context: DeviceContext): string {
  const navy = color(context, 'error', '#0A2540');
  const blurple = color(context, 'emphasis', '#533AFD');
  const cyan = color(context, 'success', '#00D4FF');
  const pink = color(context, 'warning', '#FF80A6');
  const violet = color(context, 'progress', '#7A73FF');
  const unit = Math.max(box.width, box.height);
  const blur = round(unit * 0.07);
  const blob = (cx: number, cy: number, rx: number, ry: number, fill: string, opacity: number) =>
    `<ellipse cx="${round(box.x + cx * box.width)}" cy="${round(box.y + cy * box.height)}" rx="${round(rx * unit)}" ry="${round(ry * unit)}" fill="${escapeXml(fill)}" opacity="${opacity}"/>`;
  const body = `<defs><filter id="${context.uid}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs><g filter="url(#${context.uid}-blur)">${blob(0.2, 0.75, 0.35, 0.18, blurple, 0.95)}${blob(0.75, 0.45, 0.3, 0.22, cyan, 0.85)}${blob(0.55, 0.85, 0.25, 0.14, pink, 0.75)}${blob(0.9, 0.95, 0.2, 0.16, violet, 0.8)}</g><path d="M${round(box.x)} ${round(box.y + box.height * 0.22)} L${round(box.x + box.width)} ${round(box.y)} L${round(box.x + box.width)} ${round(box.y + box.height * 0.08)} L${round(box.x)} ${round(box.y + box.height * 0.3)} Z" fill="#FFFFFF" opacity="0.06"/>`;
  return clip(box, context.uid, body, navy);
}

function focusWindow(box: DeviceBox, context: DeviceContext): string {
  const blue = color(context, 'emphasis', '#2F6BFF');
  const muted = color(context, 'muted', '#EEF2F8');
  const ink = color(context, 'ink', '#171A21');
  const step = Math.max(24, Math.round(Math.min(box.width, box.height) / 12));
  const grid = `<defs><pattern id="${context.uid}-grid" x="${round(box.x)}" y="${round(box.y)}" width="${step}" height="${step}" patternUnits="userSpaceOnUse"><path d="M${step} 0H0V${step}" fill="none" stroke="${escapeXml(ink)}" stroke-opacity="0.08"/></pattern></defs><rect x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}" fill="url(#${context.uid}-grid)"/>`;
  const wx = box.x + box.width * 0.22;
  const wy = box.y + box.height * 0.24;
  const ww = box.width * 0.5;
  const wh = box.height * 0.42;
  const corner = Math.min(ww, wh) * 0.16;
  const bracket = (cx: number, cy: number, dx: number, dy: number) =>
    `<path d="M${round(cx)} ${round(cy + dy * corner)}V${round(cy)}H${round(cx + dx * corner)}" fill="none" stroke="${escapeXml(ink)}" stroke-width="2"/>`;
  const brackets = [
    bracket(wx - 14, wy - 14, 1, 1),
    bracket(wx + ww + 14, wy - 14, -1, 1),
    bracket(wx - 14, wy + wh + 14, 1, -1),
    bracket(wx + ww + 14, wy + wh + 14, -1, -1),
  ].join('');
  return clip(box, context.uid, `${grid}<rect x="${round(wx)}" y="${round(wy)}" width="${round(ww)}" height="${round(wh)}" fill="${escapeXml(blue)}"/>${brackets}`, muted);
}

function interruption(box: DeviceBox, context: DeviceContext): string {
  const ink = color(context, 'ink', '#0A0A0A');
  const paper = color(context, 'paper', '#F2F0E9');
  const signal = color(context, 'emphasis', '#F3A51B');
  const blockX = box.x + box.width * 0.18;
  const blockY = box.y + box.height * 0.12;
  const blockW = box.width * 0.64;
  const blockH = box.height * 0.76;
  const bars = Array.from({ length: 7 }, (_, index) => `<rect x="${round(blockX)}" y="${round(blockY + index * blockH / 7)}" width="${round(blockW)}" height="${round(blockH / 14)}" fill="${escapeXml(paper)}" opacity="${round(0.04 + index * 0.012)}"/>`).join('');
  return clip(box, context.uid, `<rect x="${round(blockX)}" y="${round(blockY)}" width="${round(blockW)}" height="${round(blockH)}" fill="${escapeXml(ink)}"/>${bars}<rect x="${round(blockX - box.width * 0.12)}" y="${round(blockY + blockH * 0.58)}" width="${round(blockW * 0.72)}" height="${round(Math.max(8, box.height * 0.035))}" fill="${escapeXml(signal)}"/>`, mixHexColors(paper, ink, 0.06));
}

export function renderExpressionDevice(device: ExpressionDeviceId, box: DeviceBox, context: DeviceContext): string {
  const safe = { ...context, uid: escapeXml(context.uid) };
  if (device === 'greetings') return greetings(box, safe);
  if (device === 'beam') return beam(box, safe);
  if (device === 'waves') return waves(box, safe);
  if (device === 'ledger') return ledger(box, safe);
  if (device === 'horizon') return horizon(box, safe);
  if (device === 'convergence') return convergence(box, safe);
  if (device === 'field') return field(box, safe);
  if (device === 'window') return focusWindow(box, safe);
  return interruption(box, safe);
}
