// A UI capture is a Design Lab artboard: a full-bleed shader ground with one product capture
// centered on it at 16:9. Presets name the ground (material, settings and palette) the way capy's
// per-image shader presets do. The capture's rounded corners are baked into its pixels, so the
// layer's own shadow and border follow them, and every part stays an ordinary editable layer.
import { studioArtboardPresetForSize } from './artboardSizes';
import { hexToOklch, mixHexColors } from './color';
import {
  DEFAULT_LAYER_TRANSFORM,
  type AssetLayerId,
  type CompositionAsset,
  type CompositionShaderLayer,
  type DesignArtboardSnapshot,
  type DesignShaderSequenceSettings,
  type ShaderLayerId,
} from './designLabModel';
import { designLayerGeometry } from './designWorkspace';
import { DEFAULT_LIVE_MATERIAL_SETTINGS, type LiveMaterialId, type LiveMaterialSettings } from './liveMaterials';
import { DEFAULT_LOGO_APPEARANCE } from './logoAppearance';
import { SHADER_LAB_LOADABLE_MATERIAL_IDS, shaderLabSettingsFor } from './shaderLab';

type Palette = readonly [string, string, string];
type GroundSettings = Partial<Omit<LiveMaterialSettings, 'colorA' | 'colorB' | 'colorC' | 'effectProps'>>;

export type UiCapturePreset = {
  description: string;
  id: string;
  materialId: LiveMaterialId;
  name: string;
  /** 'brand' builds the ground around the active identity's accent; see uiCaptureBrandGround. */
  palette: 'brand' | Palette;
  settings: GroundSettings;
};

export const UI_CAPTURE_PRESETS = [
  {
    description: 'A purple grain gradient, the ground capy uses for its product stills and covers.',
    id: 'purple-grain',
    materialId: 'paper-grain-gradient',
    name: 'Purple grain',
    palette: ['#2B1466', '#7B5CF5', '#E6DCFF'],
    settings: { grain: 18, speed: 0.3 },
  },
  {
    description: 'A grain gradient in the brand palette.',
    id: 'brand-grain',
    materialId: 'paper-grain-gradient',
    name: 'Brand grain',
    palette: 'brand',
    settings: { grain: 18, speed: 0.3 },
  },
  {
    description: 'A mesh gradient in the brand palette.',
    id: 'brand-mesh',
    materialId: 'paper-mesh-gradient',
    name: 'Brand mesh',
    palette: 'brand',
    settings: {},
  },
  {
    description: 'Warped color bands in the brand palette.',
    id: 'brand-warp',
    materialId: 'paper-warp',
    name: 'Brand warp',
    palette: 'brand',
    settings: {},
  },
  {
    description: 'An ordered-dither field in the brand palette.',
    id: 'brand-dither',
    materialId: 'paper-dithering',
    name: 'Brand dither',
    palette: 'brand',
    settings: {},
  },
] as const satisfies readonly UiCapturePreset[];

export type UiCapturePresetId = (typeof UI_CAPTURE_PRESETS)[number]['id'];
export const DEFAULT_UI_CAPTURE_PRESET_ID: UiCapturePresetId = 'brand-grain';

export const UI_CAPTURE_LIMITS = {
  maxWidth: 3840,
  minWidth: 960,
  maxPadding: 0.3,
  maxRadius: 96,
} as const;

export const UI_CAPTURE_DEFAULTS = {
  padding: 0.1,
  radius: 20,
  shadow: true,
  width: 1600,
} as const;

const SETTING_KEYS = ['amplitude', 'brightness', 'centerX', 'centerY', 'density', 'detail', 'frequency', 'grain', 'rotationX', 'rotationY', 'rotationZ', 'speed', 'strength'] as const;
const REQUEST_KEYS = ['height', 'image', 'materialId', 'name', 'padding', 'palette', 'preset', 'radius', 'settings', 'shadow', 'width'] as const;
const HEX = /^#[0-9a-f]{6}$/i;

export type UiCaptureRequest = {
  materialId: LiveMaterialId;
  name: string;
  padding: number;
  palette: 'brand' | Palette;
  presetId: string | null;
  radius: number;
  settings: GroundSettings;
  shadow: boolean;
  size: { height: number; width: number };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function numberIn(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${label} must be a number from ${min} to ${max}.`);
  }
  return value;
}

function readPalette(value: unknown): 'brand' | Palette {
  if (value === 'brand') return 'brand';
  if (Array.isArray(value) && value.length === 3 && value.every((color) => typeof color === 'string' && HEX.test(color))) {
    return value.map((color: string) => color.toUpperCase()) as unknown as Palette;
  }
  throw new TypeError("palette must be 'brand' or three #RRGGBB colors.");
}

function readSettings(value: unknown): GroundSettings {
  if (!isRecord(value)) throw new TypeError('settings must be an object.');
  const unknown = Object.keys(value).filter((key) => !(SETTING_KEYS as readonly string[]).includes(key));
  if (unknown.length) throw new TypeError(`Unknown ground setting: ${unknown.join(', ')}. Set colors with palette.`);
  return Object.fromEntries(Object.entries(value).map(([key, setting]) => {
    if (typeof setting !== 'number' || !Number.isFinite(setting)) throw new TypeError(`settings.${key} must be a finite number.`);
    return [key, setting];
  }));
}

/**
 * Validates a capture request, apart from its image, which the Studio decodes. A preset supplies
 * the ground; materialId, palette and settings override it field by field.
 */
export function resolveUiCaptureRequest(input: unknown): UiCaptureRequest {
  if (!isRecord(input)) throw new TypeError('design.capture requires an input object.');
  const unknown = Object.keys(input).filter((key) => !(REQUEST_KEYS as readonly string[]).includes(key));
  if (unknown.length) throw new TypeError(`Unknown design.capture field: ${unknown.join(', ')}.`);
  return { ...readGround(input), ...readFrame(input) };
}

/** The shader ground: a preset, with materialId, palette and settings overriding it. */
function readGround(input: Record<string, unknown>): Pick<UiCaptureRequest, 'materialId' | 'palette' | 'presetId' | 'settings'> {
  const presetId = input.preset ?? (input.materialId === undefined ? DEFAULT_UI_CAPTURE_PRESET_ID : null);
  const preset = presetId === null ? null : UI_CAPTURE_PRESETS.find(({ id }) => id === presetId);
  if (presetId !== null && !preset) {
    throw new TypeError(`Unknown capture preset. Use one of: ${UI_CAPTURE_PRESETS.map(({ id }) => id).join(', ')}.`);
  }
  const materialId = input.materialId ?? preset?.materialId;
  if (typeof materialId !== 'string' || !SHADER_LAB_LOADABLE_MATERIAL_IDS.has(materialId)) {
    throw new TypeError('materialId must be a material id from /api/materials.');
  }
  return {
    materialId: materialId as LiveMaterialId,
    palette: input.palette === undefined ? preset?.palette ?? 'brand' : readPalette(input.palette),
    presetId: preset?.id ?? null,
    settings: { ...preset?.settings, ...(input.settings === undefined ? {} : readSettings(input.settings)) },
  };
}

/** The artboard and the capture's place on it. */
function readFrame(input: Record<string, unknown>): Pick<UiCaptureRequest, 'name' | 'padding' | 'radius' | 'shadow' | 'size'> {
  if (input.height !== undefined) throw new TypeError('A capture is 16:9; set width and the height follows.');
  if (input.name !== undefined && (typeof input.name !== 'string' || !input.name.trim())) throw new TypeError('name must be a non-empty string.');
  if (input.shadow !== undefined && typeof input.shadow !== 'boolean') throw new TypeError('shadow must be a boolean.');
  const optional = (key: 'padding' | 'radius' | 'width', min: number, max: number) => (
    input[key] === undefined ? UI_CAPTURE_DEFAULTS[key] : numberIn(input[key], key, min, max)
  );
  // A multiple of 16 keeps the 16:9 height a whole, even number of pixels.
  const width = Math.round(optional('width', UI_CAPTURE_LIMITS.minWidth, UI_CAPTURE_LIMITS.maxWidth) / 16) * 16;
  return {
    name: typeof input.name === 'string' ? input.name.trim() : 'UI capture',
    padding: optional('padding', 0, UI_CAPTURE_LIMITS.maxPadding),
    radius: optional('radius', 0, UI_CAPTURE_LIMITS.maxRadius),
    shadow: typeof input.shadow === 'boolean' ? input.shadow : UI_CAPTURE_DEFAULTS.shadow,
    size: { height: Math.round(width * 9 / 16), width },
  };
}

/**
 * The capture's box on the artboard: the largest box of its aspect inside the padded area, centered.
 * Padding is a fraction of the height, so a wide capture is not shrunk by a 16:9 artboard's width.
 */
export function uiCaptureBox(size: { height: number; width: number }, image: { height: number; width: number }, padding: number) {
  const inset = size.height * padding;
  const fit = Math.min((size.width - inset * 2) / image.width, (size.height - inset * 2) / image.height);
  const width = image.width * fit;
  const height = image.height * fit;
  return { height, width, x: (size.width - width) / 2, y: (size.height - height) / 2 };
}

/** Corner radius in the capture's own pixels, for a radius authored in artboard pixels. */
export function uiCaptureImageRadius(radius: number, image: { width: number }, boxWidth: number): number {
  return boxWidth > 0 ? radius * image.width / boxWidth : 0;
}

/**
 * A brand ground starts from the accent, not the ink, so the capture sits on color: the accent, a
 * tint toward the highlight and a shade toward the ink. brandPalette is [ink, accent, highlight].
 */
export function uiCaptureBrandGround([ink, accent, highlight]: Palette): Palette {
  return [accent, mixHexColors(accent, highlight, 0.55), mixHexColors(accent, ink, 0.45)];
}

export function uiCaptureArtboardSnapshot({
  brandPalette,
  createId = () => globalThis.crypto.randomUUID(),
  image,
  request,
  shaderSequence,
}: {
  brandPalette: Palette;
  createId?: () => string;
  /** The prepared capture: corners already rounded, natural pixel size. */
  image: { height: number; url: string; width: number };
  request: UiCaptureRequest;
  shaderSequence: Omit<DesignShaderSequenceSettings, 'targetLayerId'>;
}): DesignArtboardSnapshot {
  const { size } = request;
  const palette = request.palette === 'brand' ? uiCaptureBrandGround(brandPalette) : request.palette;
  // On a dark ground the shadow cannot separate the capture, so a faint light edge does.
  const darkGround = palette.reduce((sum, color) => sum + hexToOklch(color).lightness, 0) / palette.length < 0.4;
  const shaderId = `shader-${createId()}` as ShaderLayerId;
  const assetId = `asset-${createId()}` as AssetLayerId;
  const shader: CompositionShaderLayer = {
    blendMode: 'normal',
    id: shaderId,
    materialId: request.materialId,
    name: 'Capture ground',
    opacity: 1,
    settings: {
      ...shaderLabSettingsFor(request.materialId, {
        ...DEFAULT_LIVE_MATERIAL_SETTINGS,
        colorA: palette[0],
        colorB: palette[1],
        colorC: palette[2],
      }),
      ...request.settings,
    },
    shaderSize: 1,
    transform: { ...DEFAULT_LAYER_TRANSFORM },
    visible: true,
  };
  const box = uiCaptureBox(size, image, request.padding);
  const base = designLayerGeometry(assetId, size);
  const capture: CompositionAsset = {
    appearance: {
      ...DEFAULT_LOGO_APPEARANCE,
      borderColor: '#FFFFFF',
      borderEnabled: darkGround,
      // The border is drawn as four offset passes whose alpha compounds: 6% each is about 18% at the edge.
      borderOpacity: 6,
      borderWidth: 1,
      shadowBlur: Math.round(size.width * 0.035),
      shadowEnabled: request.shadow,
      shadowOffsetY: Math.round(size.width * 0.018),
      shadowOpacity: 45,
    },
    id: assetId,
    kind: 'image',
    name: request.name,
    opacity: 1,
    transform: {
      heightScale: box.height / base.baseHeight,
      scale: 1,
      widthScale: box.width / base.baseWidth,
      // Offsets move the layer's center from its default box's center.
      x: box.x + box.width / 2 - (base.baseX + base.baseWidth / 2),
      y: box.y + box.height / 2 - (base.baseY + base.baseHeight / 2),
    },
    url: image.url,
    visible: true,
  };
  return {
    assets: [capture],
    backgroundColor: palette[0],
    dimensions: { ...size },
    effectLayers: [],
    groups: [],
    layerOrder: [shaderId, assetId],
    layerShaders: {},
    logos: [],
    ratio: studioArtboardPresetForSize(size.width, size.height)?.id ?? 'custom',
    shaderLayers: [shader],
    shaderSequence: { ...shaderSequence, targetLayerId: shaderId },
    textLayers: [],
    timeline: { frame: 0, paused: false, timeMs: 0 },
  };
}

/** The presets and limits a caller can choose from, as `design.capture.presets` returns them. */
export function describeUiCapturePresets() {
  return {
    defaultPreset: DEFAULT_UI_CAPTURE_PRESET_ID,
    defaults: UI_CAPTURE_DEFAULTS,
    limits: UI_CAPTURE_LIMITS,
    presets: UI_CAPTURE_PRESETS.map(({ description, id, materialId, name, palette, settings }) => ({ description, id, materialId, name, palette, settings })),
  };
}
