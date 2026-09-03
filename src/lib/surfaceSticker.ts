import { buildBackgroundSvg, type BackgroundSettings } from '@/lib/backgroundSvg';

export type StickerFinishId =
  | 'holo-vinyl'
  | 'prismatic'
  | 'mirror-chrome'
  | 'brushed-metal'
  | 'pearl-laminate'
  | 'glitter-flake'
  | 'retroreflective'
  | 'clear-frost'
  | 'soft-touch'
  | 'spot-gloss'
  | 'epoxy-dome'
  | 'embossed-foil'
  | 'precision-metal-inset';

export type StickerFinishSettings = {
  bands: number;
  bevelWidth: number;
  borderColor: string;
  curl: number;
  cutTolerance: number;
  depth: number;
  edgeWidth: number;
  glintAngle: number;
  hueShift: number;
  ink: number;
  insetDepth: number;
  intensity: number;
  overlay: 'none' | 'triangles' | 'squares' | 'stripes';
  pattern: 'linear' | 'radial' | 'patches';
  peelAmount: number;
  peelDirection: 'top-left' | 'top' | 'top-right' | 'right' | 'bottom-right' | 'bottom' | 'bottom-left' | 'left';
  presetId: StickerFinishId | 'custom';
  relief: number;
  seamWidth: number;
  shadow: number;
  texture: number;
};

export type StickerShaderSource = {
  license: 'MIT';
  name: 'HoloSticker';
  url: string;
};

const HOLO_STICKER_CONTROLS = {
  bands: 9,
  curl: 9,
  cutTolerance: 3,
  hueShift: 0,
  ink: 100,
  overlay: 'none',
  pattern: 'linear',
  peelAmount: 24,
  peelDirection: 'top-right',
  relief: 22,
  shadow: 42,
} as const;

const DEFAULT_EDGE_ARCHITECTURE = {
  ...HOLO_STICKER_CONTROLS,
  bevelWidth: 8,
  borderColor: '#F7F7F2',
  insetDepth: 24,
  seamWidth: 2,
} as const;

export const STICKER_FINISH_PRESETS: readonly {
  description: string;
  id: StickerFinishId;
  label: string;
  settings: StickerFinishSettings;
  source?: StickerShaderSource;
  swatch: string;
}[] = [
  {
    description: 'Rainbow spectral laminate, clear die-cut rim, and a sharp traveling highlight.',
    id: 'holo-vinyl',
    label: 'Holo vinyl',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 46, edgeWidth: 15, glintAngle: 28, intensity: 76, presetId: 'holo-vinyl', texture: 22 },
    source: { license: 'MIT', name: 'HoloSticker', url: 'https://github.com/jal-co/holosticker' },
    swatch: 'linear-gradient(130deg,#ffb7d5 0%,#fff3a4 22%,#9fffd9 44%,#89c8ff 66%,#d9a7ff 84%,#fff 100%)',
  },
  {
    description: 'Geometric rainbow facets modeled after prismatic reflective film.',
    id: 'prismatic',
    label: 'Prismatic',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 38, edgeWidth: 14, glintAngle: 52, intensity: 82, presetId: 'prismatic', texture: 34 },
    source: { license: 'MIT', name: 'HoloSticker', url: 'https://github.com/jal-co/holosticker' },
    swatch: 'conic-gradient(from 35deg,#ff6b9d,#ffe66d,#70ffcc,#59a9ff,#bd75ff,#ff6b9d)',
  },
  {
    description: 'High-contrast silver mirror with a crisp studio-light band.',
    id: 'mirror-chrome',
    label: 'Mirror chrome',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 54, edgeWidth: 13, glintAngle: 112, intensity: 88, presetId: 'mirror-chrome', texture: 4 },
    swatch: 'linear-gradient(150deg,#25272b 0%,#f9fafb 22%,#777d86 41%,#fff 54%,#34373c 78%,#dfe3e8)',
  },
  {
    description: 'Directional metallic grain with a satin aluminum reflection.',
    id: 'brushed-metal',
    label: 'Brushed metal',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 44, edgeWidth: 13, glintAngle: 8, intensity: 64, presetId: 'brushed-metal', texture: 58 },
    swatch: 'repeating-linear-gradient(92deg,#777 0 1px,#d9d9d9 1px 3px,#999 3px 4px)',
  },
  {
    description: 'Milky opal interference with a soft blue-to-rose color shift.',
    id: 'pearl-laminate',
    label: 'Pearl laminate',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 34, edgeWidth: 16, glintAngle: 36, intensity: 58, presetId: 'pearl-laminate', texture: 14 },
    swatch: 'radial-gradient(circle at 28% 26%,#fff 0%,#bde8ff 30%,#f7c8dd 62%,#fff5cf 100%)',
  },
  {
    description: 'Fine reflective particles suspended in a clear glossy laminate.',
    id: 'glitter-flake',
    label: 'Glitter flake',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 42, edgeWidth: 15, glintAngle: 64, intensity: 78, presetId: 'glitter-flake', texture: 88 },
    source: { license: 'MIT', name: 'HoloSticker', url: 'https://github.com/jal-co/holosticker' },
    swatch: 'radial-gradient(circle at 25% 32%,#fff 0 3%,transparent 4%),radial-gradient(circle at 70% 62%,#fff 0 2%,transparent 3%),linear-gradient(135deg,#724cff,#ff81bd,#55e6d2)',
  },
  {
    description: 'Microprismatic high-visibility film with a concentrated flash response.',
    id: 'retroreflective',
    label: 'Retroreflective',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 30, edgeWidth: 12, glintAngle: 92, intensity: 92, presetId: 'retroreflective', texture: 72 },
    swatch: 'radial-gradient(circle,#fff 0 9%,#aeb7c3 10% 24%,transparent 25%) 0 0/12px 12px,#697381',
  },
  {
    description: 'Translucent frosted vinyl with softened color and a pale clear edge.',
    id: 'clear-frost',
    label: 'Clear frost',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 26, edgeWidth: 18, glintAngle: 22, intensity: 34, presetId: 'clear-frost', texture: 52 },
    swatch: 'linear-gradient(135deg,rgba(255,255,255,.9),rgba(182,211,220,.58)),radial-gradient(circle,#fff 0 1px,transparent 1px)',
  },
  {
    description: 'Diffuse low-glare laminate with a dry, velvety surface response.',
    id: 'soft-touch',
    label: 'Soft touch',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 24, edgeWidth: 14, glintAngle: 40, intensity: 18, presetId: 'soft-touch', texture: 38 },
    swatch: 'linear-gradient(145deg,#27292d,#8d9299 48%,#34363a)',
  },
  {
    description: 'Selective high-gloss varnish that leaves the printed surface visible underneath.',
    id: 'spot-gloss',
    label: 'Spot gloss',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 28, edgeWidth: 13, glintAngle: 120, intensity: 68, presetId: 'spot-gloss', texture: 3 },
    swatch: 'linear-gradient(115deg,#30343a 0 38%,#fff 45%,#474c55 53% 100%)',
  },
  {
    description: 'A thick clear resin dome with rounded edge light and amplified depth.',
    id: 'epoxy-dome',
    label: 'Epoxy dome',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 82, edgeWidth: 19, glintAngle: 24, intensity: 86, presetId: 'epoxy-dome', texture: 2 },
    swatch: 'radial-gradient(circle at 28% 20%,#fff 0 7%,transparent 18%),linear-gradient(145deg,#98b9d4,#263f5c)',
  },
  {
    description: 'Pressed metallic foil with a restrained raised edge and tactile paper tooth.',
    id: 'embossed-foil',
    label: 'Embossed foil',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, depth: 68, edgeWidth: 12, glintAngle: 136, intensity: 72, presetId: 'embossed-foil', texture: 48 },
    swatch: 'linear-gradient(140deg,#5e441e,#f6dc91 30%,#9d772e 50%,#fff0b1 68%,#60451f)',
  },
  {
    description: 'A polished structural metal perimeter, microscopic seam, and recessed satin insert inspired by precision-manufactured emblems.',
    id: 'precision-metal-inset',
    label: 'Precision metal inset',
    settings: { ...DEFAULT_EDGE_ARCHITECTURE, bevelWidth: 18, borderColor: '#F4F2EC', depth: 78, edgeWidth: 10, glintAngle: 18, insetDepth: 72, intensity: 88, presetId: 'precision-metal-inset', seamWidth: 3, texture: 46 },
    swatch: 'linear-gradient(145deg,#111317 0 7%,#f8fafb 15%,#696e75 25%,#e9ecef 34%,#22262b 42% 70%,#aeb3b9 78%,#fff 88%,#4e535a 100%)',
  },
] as const;

export const DEFAULT_STICKER_FINISH: StickerFinishSettings = {
  ...STICKER_FINISH_PRESETS[0].settings,
};

export function stickerShaderSource(id: StickerFinishSettings['presetId']): StickerShaderSource | undefined {
  return STICKER_FINISH_PRESETS.find((preset) => preset.id === id)?.source;
}

export function stickerFinishSwatch(value?: Partial<StickerFinishSettings>): string {
  const finish = normalizeStickerFinish(value);
  return STICKER_FINISH_PRESETS.find(({ id }) => id === finish.presetId)?.swatch
    ?? STICKER_FINISH_PRESETS[0].swatch;
}

export function stickerFinishPalette(value?: Partial<StickerFinishSettings>): string[] {
  const finish = normalizeStickerFinish(value);
  if (finish.presetId === 'embossed-foil') return ['#5E441E', '#F6DC91', '#9D772E', '#FFF0B1', '#60451F'];
  if (finish.presetId === 'epoxy-dome') return ['#DDF1FF', '#98B9D4', '#263F5C', '#EAF7FF'];
  if (['mirror-chrome', 'brushed-metal', 'precision-metal-inset'].includes(finish.presetId)) {
    return ['#25272B', '#F9FAFB', '#777D86', '#FFFFFF', '#34373C', '#DFE3E8'];
  }
  if (['clear-frost', 'soft-touch', 'spot-gloss'].includes(finish.presetId)) {
    return ['#F7FAFC', '#AAB3BC', '#FFFFFF', '#66707A'];
  }
  const hue = finish.hueShift * 3.6;
  return [0, 58, 118, 188, 258, 324, 360].map((offset) => `hsl(${hue + offset} 88% 76%)`);
}

export function drawStickerFinishOverlay(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  bounds: { height: number; width: number; x: number; y: number },
  value?: Partial<StickerFinishSettings>,
  opacity = 1
): void {
  const finish = normalizeStickerFinish(value);
  if (finish.intensity <= 0 || opacity <= 0) return;
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const overlay = document.createElement('canvas');
  overlay.width = width;
  overlay.height = height;
  const overlayContext = overlay.getContext('2d');
  if (!overlayContext) return;

  overlayContext.drawImage(source, 0, 0, width, height);
  overlayContext.globalCompositeOperation = 'source-atop';
  const angle = finish.glintAngle * Math.PI / 180;
  const halfSpan = Math.abs(Math.cos(angle)) * width / 2 + Math.abs(Math.sin(angle)) * height / 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const optical = overlayContext.createLinearGradient(
    centerX - Math.cos(angle) * halfSpan,
    centerY - Math.sin(angle) * halfSpan,
    centerX + Math.cos(angle) * halfSpan,
    centerY + Math.sin(angle) * halfSpan
  );
  const palette = stickerFinishPalette(finish);
  palette.forEach((color, index) => optical.addColorStop(index / Math.max(1, palette.length - 1), color));
  overlayContext.globalAlpha = Math.min(0.76, finish.intensity / 132);
  overlayContext.fillStyle = optical;
  overlayContext.fillRect(0, 0, width, height);

  const glint = overlayContext.createLinearGradient(0, height, width, 0);
  glint.addColorStop(0.34, 'rgba(255,255,255,0)');
  glint.addColorStop(0.5, 'rgba(255,255,255,0.96)');
  glint.addColorStop(0.66, 'rgba(255,255,255,0)');
  overlayContext.globalAlpha = finish.intensity / 190;
  overlayContext.fillStyle = glint;
  overlayContext.fillRect(0, 0, width, height);

  if (finish.texture > 0) {
    const texture = document.createElement('canvas');
    texture.width = 24;
    texture.height = 24;
    const textureContext = texture.getContext('2d');
    if (textureContext) {
      textureContext.fillStyle = 'rgba(255,255,255,0.78)';
      textureContext.fillRect(3, 4, 1, 1);
      textureContext.fillRect(17, 7, 1, 1);
      textureContext.fillRect(9, 18, 1, 1);
      textureContext.fillRect(22, 21, 1, 1);
      const pattern = overlayContext.createPattern(texture, 'repeat');
      if (pattern) {
        overlayContext.globalAlpha = finish.texture / 360;
        overlayContext.fillStyle = pattern;
        overlayContext.fillRect(0, 0, width, height);
      }
    }
  }

  overlayContext.globalAlpha = 1;
  overlayContext.globalCompositeOperation = 'source-over';
  context.save();
  context.globalAlpha = Math.max(0, Math.min(1, opacity));
  context.globalCompositeOperation = 'screen';
  context.drawImage(overlay, bounds.x, bounds.y, bounds.width, bounds.height);
  context.restore();
}

export function normalizeStickerFinish(value?: Partial<StickerFinishSettings>): StickerFinishSettings {
  const source = value ?? {};
  const presetCandidate = source.presetId;
  const presetId: StickerFinishSettings['presetId'] = presetCandidate === 'custom' || STICKER_FINISH_PRESETS.some(({ id }) => id === presetCandidate)
    ? presetCandidate as StickerFinishSettings['presetId']
    : DEFAULT_STICKER_FINISH.presetId;
  const clamp = (candidate: number | undefined, fallback: number, min: number, max: number) =>
    typeof candidate === 'number' && Number.isFinite(candidate)
      ? Math.max(min, Math.min(max, candidate))
      : fallback;

  return {
    bands: clamp(source.bands, DEFAULT_STICKER_FINISH.bands, 1, 20),
    bevelWidth: clamp(source.bevelWidth, DEFAULT_STICKER_FINISH.bevelWidth, 2, 32),
    borderColor: typeof source.borderColor === 'string' && /^#[0-9a-f]{6}$/i.test(source.borderColor)
      ? source.borderColor.toUpperCase()
      : DEFAULT_STICKER_FINISH.borderColor,
    curl: clamp(source.curl, DEFAULT_STICKER_FINISH.curl, 2, 25),
    cutTolerance: clamp(source.cutTolerance, DEFAULT_STICKER_FINISH.cutTolerance, 0, 12),
    depth: clamp(source.depth, DEFAULT_STICKER_FINISH.depth, 0, 100),
    edgeWidth: clamp(source.edgeWidth, DEFAULT_STICKER_FINISH.edgeWidth, 2, 32),
    glintAngle: clamp(source.glintAngle, DEFAULT_STICKER_FINISH.glintAngle, 0, 180),
    hueShift: clamp(source.hueShift, DEFAULT_STICKER_FINISH.hueShift, 0, 100),
    ink: clamp(source.ink, DEFAULT_STICKER_FINISH.ink, 0, 200),
    insetDepth: clamp(source.insetDepth, DEFAULT_STICKER_FINISH.insetDepth, 0, 100),
    intensity: clamp(source.intensity, DEFAULT_STICKER_FINISH.intensity, 0, 100),
    overlay: ['none', 'triangles', 'squares', 'stripes'].includes(source.overlay ?? '')
      ? source.overlay as StickerFinishSettings['overlay']
      : DEFAULT_STICKER_FINISH.overlay,
    pattern: ['linear', 'radial', 'patches'].includes(source.pattern ?? '')
      ? source.pattern as StickerFinishSettings['pattern']
      : DEFAULT_STICKER_FINISH.pattern,
    peelAmount: clamp(source.peelAmount, DEFAULT_STICKER_FINISH.peelAmount, 0, 100),
    peelDirection: ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'].includes(source.peelDirection ?? '')
      ? source.peelDirection as StickerFinishSettings['peelDirection']
      : DEFAULT_STICKER_FINISH.peelDirection,
    presetId,
    relief: clamp(source.relief, DEFAULT_STICKER_FINISH.relief, 0, 100),
    seamWidth: clamp(source.seamWidth, DEFAULT_STICKER_FINISH.seamWidth, 0, 12),
    shadow: clamp(source.shadow, DEFAULT_STICKER_FINISH.shadow, 0, 100),
    texture: clamp(source.texture, DEFAULT_STICKER_FINISH.texture, 0, 100),
  };
}

function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

function finishOverlay(id: StickerFinishId | 'custom', background: BackgroundSettings): { defs: string; layers: string } {
  const presetId = id === 'custom' ? 'holo-vinyl' : id;
  const common = `<linearGradient id="sticker-glint" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".38" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".96"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="sticker-noise" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="2" seed="19"/><feColorMatrix type="saturate" values="0"/></filter>`;

  if (presetId === 'holo-vinyl') {
    return { defs: `${common}<linearGradient id="finish-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff78bd"/><stop offset=".18" stop-color="#ffd27a"/><stop offset=".36" stop-color="#b8ff92"/><stop offset=".54" stop-color="#6df5e5"/><stop offset=".72" stop-color="#6aa8ff"/><stop offset=".88" stop-color="#d68aff"/><stop offset="1" stop-color="#ff9fc6"/></linearGradient>`, layers: '<rect width="100%" height="100%" fill="url(#finish-fill)" data-sticker-finish-layer="spectrum"/>' };
  }
  if (presetId === 'prismatic') {
    return { defs: `${common}<linearGradient id="finish-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b9f"/><stop offset=".25" stop-color="#ffe776"/><stop offset=".5" stop-color="#67efcc"/><stop offset=".75" stop-color="#669dff"/><stop offset="1" stop-color="#c573ff"/></linearGradient><pattern id="finish-pattern" width="56" height="48" patternUnits="userSpaceOnUse"><path d="M0 48L28 0l28 48z" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.5"/><path d="M0 0l28 48L56 0" fill="none" stroke="#111" stroke-opacity=".28"/></pattern>`, layers: '<rect width="100%" height="100%" fill="url(#finish-fill)"/><rect width="100%" height="100%" fill="url(#finish-pattern)" data-sticker-finish-layer="facets"/>' };
  }
  if (presetId === 'mirror-chrome') {
    return { defs: `${common}<linearGradient id="finish-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#17191d"/><stop offset=".18" stop-color="#f8fafc"/><stop offset=".33" stop-color="#5d626a"/><stop offset=".52" stop-color="#fff"/><stop offset=".66" stop-color="#25282d"/><stop offset=".84" stop-color="#e9edf1"/><stop offset="1" stop-color="#60656d"/></linearGradient>`, layers: '<rect width="100%" height="100%" fill="url(#finish-fill)" data-sticker-finish-layer="mirror"/>' };
  }
  if (presetId === 'brushed-metal') {
    return { defs: `${common}<linearGradient id="finish-fill" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4d5055"/><stop offset=".35" stop-color="#d8dadd"/><stop offset=".55" stop-color="#73777e"/><stop offset=".78" stop-color="#f3f4f5"/><stop offset="1" stop-color="#5c6066"/></linearGradient><pattern id="finish-pattern" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 1H7M0 4H7" stroke="#fff" stroke-opacity=".28" stroke-width=".55"/></pattern>`, layers: '<rect width="100%" height="100%" fill="url(#finish-fill)"/><rect width="100%" height="100%" fill="url(#finish-pattern)" data-sticker-finish-layer="brushed"/>' };
  }
  if (presetId === 'pearl-laminate') {
    return { defs: `${common}<radialGradient id="finish-fill" cx="28%" cy="24%" r="88%"><stop offset="0" stop-color="#fff"/><stop offset=".28" stop-color="#bfe8ff"/><stop offset=".58" stop-color="#f4c9df"/><stop offset=".78" stop-color="#fff4bd"/><stop offset="1" stop-color="#d7d1ff"/></radialGradient>`, layers: '<rect width="100%" height="100%" fill="url(#finish-fill)" data-sticker-finish-layer="pearl"/>' };
  }
  if (presetId === 'glitter-flake') {
    return { defs: `${common}<linearGradient id="finish-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#7958ff"/><stop offset=".5" stop-color="#ff7fba"/><stop offset="1" stop-color="#4ce5cf"/></linearGradient>`, layers: '<rect width="100%" height="100%" fill="url(#finish-fill)"/><rect width="100%" height="100%" filter="url(#sticker-noise)" opacity=".9" style="mix-blend-mode:screen" data-sticker-finish-layer="glitter"/>' };
  }
  if (presetId === 'retroreflective') {
    return { defs: `${common}<radialGradient id="finish-dot"><stop offset="0" stop-color="#fff"/><stop offset=".22" stop-color="#fff"/><stop offset=".24" stop-color="#7e8792"/><stop offset=".64" stop-color="#c9d0d8"/><stop offset="1" stop-color="#616973"/></radialGradient><pattern id="finish-pattern" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="4" fill="url(#finish-dot)"/><circle cx="14" cy="14" r="4" fill="url(#finish-dot)"/></pattern>`, layers: '<rect width="100%" height="100%" fill="#737d88"/><rect width="100%" height="100%" fill="url(#finish-pattern)" data-sticker-finish-layer="reflective"/>' };
  }
  if (presetId === 'clear-frost') {
    return { defs: common, layers: '<rect width="100%" height="100%" fill="#eef8fb" fill-opacity=".62"/><rect width="100%" height="100%" filter="url(#sticker-noise)" opacity=".62" style="mix-blend-mode:soft-light" data-sticker-finish-layer="frost"/>' };
  }
  if (presetId === 'soft-touch') {
    return { defs: common, layers: '<rect width="100%" height="100%" fill="#2a2c31" fill-opacity=".4"/><rect width="100%" height="100%" filter="url(#sticker-noise)" opacity=".34" style="mix-blend-mode:soft-light" data-sticker-finish-layer="matte"/>' };
  }
  if (presetId === 'epoxy-dome') {
    return { defs: `${common}<radialGradient id="finish-fill" cx="26%" cy="18%" r="92%"><stop offset="0" stop-color="#fff" stop-opacity=".72"/><stop offset=".18" stop-color="#fff" stop-opacity=".18"/><stop offset=".62" stop-color="#93b5d1" stop-opacity=".08"/><stop offset="1" stop-color="#122337" stop-opacity=".34"/></radialGradient>`, layers: '<rect width="100%" height="100%" fill="url(#finish-fill)" data-sticker-finish-layer="resin"/>' };
  }
  if (presetId === 'embossed-foil') {
    return { defs: `${common}<linearGradient id="finish-fill" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#473113"/><stop offset=".22" stop-color="#f1cf78"/><stop offset=".44" stop-color="#8c661f"/><stop offset=".62" stop-color="#fff0ae"/><stop offset="1" stop-color="#63471b"/></linearGradient>`, layers: '<rect width="100%" height="100%" fill="url(#finish-fill)"/><rect width="100%" height="100%" filter="url(#sticker-noise)" opacity=".28" style="mix-blend-mode:multiply" data-sticker-finish-layer="foil"/>' };
  }
  if (presetId === 'precision-metal-inset') {
    return {
      defs: `${common}<linearGradient id="finish-fill" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${escapeAttribute(background.colorC)}"/><stop offset=".22" stop-color="${escapeAttribute(background.colorB)}"/><stop offset=".56" stop-color="${escapeAttribute(background.colorA)}"/><stop offset="1" stop-color="${escapeAttribute(background.colorB)}"/></linearGradient><pattern id="precision-brush" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(92)"><path d="M0 1H5M0 3.6H5" stroke="#fff" stroke-opacity=".18" stroke-width=".45"/></pattern>`,
      layers: '<rect width="100%" height="100%" fill="url(#finish-fill)" data-sticker-finish-layer="matte-inset"/><rect width="100%" height="100%" fill="url(#precision-brush)" data-sticker-finish-layer="satin-brush"/>',
    };
  }

  return { defs: common, layers: '<rect width="100%" height="100%" fill="#fff" fill-opacity=".08" data-sticker-finish-layer="gloss"/>' };
}

export function buildSurfaceStickerSvg(
  background: BackgroundSettings,
  options: {
    finish?: Partial<StickerFinishSettings>;
    logo?: string;
    name: string;
    stage?: 'proof' | 'transparent';
    surfaceAsset?: string;
  }
): string {
  const finish = normalizeStickerFinish(options.finish);
  const shaderSource = stickerShaderSource(finish.presetId);
  const surfaceSvg = buildBackgroundSvg(background, options.surfaceAsset ? {
    asset: options.surfaceAsset,
    assetFit: 'cover',
    assetOpacity: 100,
    name: options.name,
    showLogo: false,
  } : undefined);
  const surfaceUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(surfaceSvg)}`;
  const width = background.width;
  const height = background.height;
  const markSize = Math.min(width, height) * Math.max(0.24, Math.min(0.7, background.logoScale / 100 * 1.72));
  const markX = (width - markSize) / 2 + (background.logoX / 100) * width;
  const markY = (height - markSize) / 2 + (background.logoY / 100) * height;
  const scale = Math.max(0.8, Math.min(width, height) / 750);
  const edge = finish.edgeWidth * scale;
  const bevel = finish.bevelWidth * scale;
  const seam = finish.seamWidth * scale;
  const precisionInset = finish.presetId === 'precision-metal-inset';
  const cutEdge = edge + (precisionInset ? bevel : 0);
  const logo = options.logo ? escapeAttribute(options.logo) : undefined;
  const artShape = logo
    ? `<image href="${logo}" x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" preserveAspectRatio="xMidYMid meet"/>`
    : `<rect x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" rx="${markSize * 0.2}"/>`;
  const overlay = finishOverlay(finish.presetId, background);
  const finishCoversInk = ['prismatic', 'mirror-chrome', 'brushed-metal', 'retroreflective', 'embossed-foil', 'precision-metal-inset'].includes(finish.presetId);
  const finishOpacity = (finish.intensity / 100 * (finish.presetId === 'spot-gloss' ? 0.34 : finishCoversInk ? 0.9 : 0.68)).toFixed(3);
  const glintOpacity = (finish.intensity / 100 * (finish.presetId === 'soft-touch' ? 0.16 : 0.72)).toFixed(3);
  const textureOpacity = (finish.texture / 100 * 0.42).toFixed(3);
  const depth = Math.max(0, finish.depth);
  const stageInset = Math.min(width, height) * 0.045;
  const precisionDefs = precisionInset
    ? `<linearGradient id="precision-frame" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#20242A"/><stop offset=".17" stop-color="#FFFFFF"/><stop offset=".34" stop-color="#747A82"/><stop offset=".56" stop-color="#F6F7F8"/><stop offset=".74" stop-color="#30343A"/><stop offset="1" stop-color="#BFC4CA"/></linearGradient><filter id="sticker-frame-dilate" x="-50%" y="-50%" width="200%" height="200%"><feMorphology in="SourceAlpha" operator="dilate" radius="${bevel.toFixed(2)}"/></filter><filter id="sticker-seam-dilate" x="-50%" y="-50%" width="200%" height="200%"><feMorphology in="SourceAlpha" operator="dilate" radius="${seam.toFixed(2)}"/></filter><mask id="sticker-frame" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><g fill="#fff" filter="url(#sticker-frame-dilate)">${artShape}</g></mask><mask id="sticker-seam" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><g fill="#fff" filter="url(#sticker-seam-dilate)">${artShape}</g></mask>`
    : '';
  const borderLayer = `<rect width="100%" height="100%" fill="${escapeAttribute(finish.borderColor)}" mask="url(#sticker-cut)" data-sticker-finish-layer="cut-border"/>`;
  const precisionLayers = precisionInset
    ? `<rect width="100%" height="100%" fill="url(#precision-frame)" mask="url(#sticker-frame)" data-sticker-finish-layer="polished-frame"/><rect width="100%" height="100%" fill="#050608" fill-opacity="${(0.54 + finish.insetDepth / 220).toFixed(3)}" mask="url(#sticker-seam)" data-sticker-finish-layer="separation-seam"/>`
    : '';

  const sourceAttributes = shaderSource
    ? ` data-sticker-shader-source="${escapeAttribute(shaderSource.name)}" data-sticker-shader-license="${escapeAttribute(shaderSource.license)}"`
    : '';
  const proofStage = options.stage !== 'transparent';
  const stageLayers = proofStage
    ? `<rect width="100%" height="100%" fill="url(#sticker-stage)"/><rect width="100%" height="100%" fill="url(#sticker-stage-grid)"/>`
    : '';
  const proofLabel = proofStage
    ? `<text x="${stageInset}" y="${height - stageInset}" fill="#202124" fill-opacity=".58" font-family="ui-monospace,monospace" font-size="${Math.max(10, Math.min(width, height) * 0.018)}" letter-spacing=".14em">${escapeAttribute(options.name.toUpperCase())} / ${escapeAttribute(String(finish.presetId).toUpperCase().replaceAll('-', ' '))}</text>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" data-sticker-stage="${proofStage ? 'proof' : 'transparent'}"><defs><linearGradient id="sticker-stage" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8e6e1"/><stop offset=".55" stop-color="#c9c6c0"/><stop offset="1" stop-color="#a7a49e"/></linearGradient><pattern id="sticker-stage-grid" width="${stageInset}" height="${stageInset}" patternUnits="userSpaceOnUse"><path d="M${stageInset} 0H0V${stageInset}" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1"/></pattern><filter id="sticker-dilate" x="-50%" y="-50%" width="200%" height="200%"><feMorphology in="SourceAlpha" operator="dilate" radius="${cutEdge.toFixed(2)}"/></filter><filter id="sticker-shadow" x="-60%" y="-60%" width="220%" height="240%"><feDropShadow dx="${(depth * 0.05).toFixed(2)}" dy="${(depth * 0.17).toFixed(2)}" stdDeviation="${(4 + depth * 0.16).toFixed(2)}" flood-color="#101014" flood-opacity="${(0.18 + depth / 220).toFixed(2)}"/></filter><mask id="sticker-art" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><g fill="#fff">${artShape}</g></mask><mask id="sticker-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}"><g fill="#fff" filter="url(#sticker-dilate)">${artShape}</g></mask>${precisionDefs}${overlay.defs}</defs>${stageLayers}<g filter="url(#sticker-shadow)" data-sticker-finish="${finish.presetId}"${sourceAttributes}>${borderLayer}${precisionLayers}<image href="${escapeAttribute(surfaceUrl)}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" mask="url(#sticker-art)"/><g mask="url(#sticker-art)" opacity="${finishOpacity}" style="mix-blend-mode:${finish.presetId === 'soft-touch' ? 'multiply' : finishCoversInk ? 'normal' : 'screen'}">${overlay.layers}</g><rect width="100%" height="100%" fill="#fff" filter="url(#sticker-noise)" mask="url(#sticker-art)" opacity="${textureOpacity}" style="mix-blend-mode:soft-light"/><rect x="-${width * 0.3}" y="0" width="${width * 1.6}" height="100%" fill="url(#sticker-glint)" mask="url(#sticker-cut)" opacity="${glintOpacity}" transform="rotate(${finish.glintAngle} ${width / 2} ${height / 2})" style="mix-blend-mode:screen"/></g>${proofLabel}</svg>`;
}
