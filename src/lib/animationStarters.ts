import type { CubicBezier } from './animation';
import {
  motionPresetKeyframes,
  type MotionPresetId,
  type TextAnimationPreset,
  type TextAnimationSettings,
} from './animationMotion';
import { brandTypographyRole, type BrandIdentity } from './brandIdentity';
import { colorContrastRatio } from './color';
import { DEFAULT_LIVE_MATERIAL_SETTINGS, type LiveMaterialId } from './liveMaterials';
import { DEFAULT_MATERIAL_FINISH } from './materialFinish';
import type {
  AnimationPackageId,
  BackgroundTransitionId,
  StudioCaptionPosition,
  StudioTextAnchor,
} from './renderFrame';
import {
  createDefaultFrameSettings,
  DEFAULT_SETTINGS,
  type StudioBackgroundSettings,
  type StudioFrameSettings,
  type StudioSettings,
} from './studio';
import { capVisibleFontWeight } from './typography';

/**
 * Brand starter packages for Animation. Each identity gets the same three
 * story shapes (intro, products, proof) composed in its own art direction:
 * field, type, one accent, cadence, entrance, and supporting metadata.
 */

export const ANIMATION_STARTER_IDS = ['brand-intro', 'product-reel', 'proof-points'] as const;
export type AnimationStarterId = typeof ANIMATION_STARTER_IDS[number];

export type AnimationStarter = {
  description: string;
  id: AnimationStarterId;
  name: string;
  scenes: readonly string[];
};

export type AnimationStarterPackage = {
  backgroundOverrides: Record<string, boolean>;
  frameSettings: Record<string, StudioFrameSettings>;
  includeBrandLogo: boolean;
  /** Which logo artwork reads on this field: a dark mark for light fields. */
  logoSurface: 'dark' | 'light';
  sequenceBackground: StudioBackgroundSettings;
  sequenceOrder: string[];
  settings: StudioSettings;
  starterId: AnimationStarterId;
  textFrames: string;
};

type StarterBackground = {
  angle?: number;
  colorA: string;
  colorB?: string;
  colorC?: string;
  materialId?: LiveMaterialId;
  style: StudioBackgroundSettings['style'];
};

type StarterLook = {
  /** Scene that carries the single accent: an override field and its readable type. */
  accent?: { background?: string; foreground: string; scene: number };
  align: StudioTextAnchor;
  alignY: number;
  background: StarterBackground;
  captionPosition: StudioCaptionPosition;
  captions: (text: string, index: number, starter: AnimationStarterId) => string;
  entrance: TextAnimationPreset;
  entranceMs: number;
  foreground: string;
  holdMs: number;
  /** Display size as a share of the canvas height. */
  measure: number;
  motion: MotionPresetId | null;
  packageId: AnimationPackageId;
  transitionBlend: BackgroundTransitionId;
  transitionMs: number;
};

export const STARTER_CANVAS = { height: 720, width: 1280 } as const;

const EASE_OUT: CubicBezier = [0.16, 1, 0.3, 1];

function hex(identity: BrandIdentity, id: string, fallback: string): string {
  return identity.colors.find((color) => color.id === id)?.hex ?? fallback;
}

/** Parses an identity motion curve such as `cubic-bezier(0.22, 1, 0.36, 1)`. */
export function parseCubicBezier(value: string | undefined, fallback: CubicBezier = EASE_OUT): CubicBezier {
  const match = value ? /cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(value) : null;
  if (!match) return fallback;
  const numbers = match.slice(1).map(Number);
  return numbers.every(Number.isFinite) ? numbers as unknown as CubicBezier : fallback;
}

function indexCaption(name: string) {
  return (_text: string, index: number) => `${String(index + 1).padStart(2, '0')} / ${name.toUpperCase()}`;
}

const GT_LANGUAGE_CODES: Record<string, string> = {
  Bienvenidos: 'ES · Español',
  Bienvenue: 'FR · Français',
  Welcome: 'EN · English',
  'أهلاً وسهلاً': 'AR · العربية',
  'स्वागत है': 'HI · हिन्दी',
  ようこそ: 'JA · 日本語',
  你好: 'ZH · 中文',
  환영합니다: 'KO · 한국어',
};

const TAILWIND_UTILITIES = ['flex items-end gap-6', 'text-sky-400 tracking-tight', 'shadow-2xl ring-1', 'md:grid-cols-3'];

/** Art direction per built-in identity, derived from each identity's graphic system and motion spec. */
function lookFor(identity: BrandIdentity): StarterLook {
  const ink = hex(identity, 'ink', '#171A21');
  const paper = hex(identity, 'paper', '#FFFFFF');
  const emphasis = hex(identity, 'emphasis', '#2F6BFF');
  const name = identity.shortName.length > 2 ? identity.shortName : identity.name;
  switch (identity.id) {
    case 'starter':
      // The signal window: an open white field with one blue window for the decision.
      return { accent: { background: emphasis, foreground: paper, scene: 1 }, align: 'start', alignY: 0.1, background: { colorA: paper, style: 'solid' }, captionPosition: 'bottom-left', captions: indexCaption('Signal'), entrance: 'word-rise', entranceMs: 620, foreground: ink, holdMs: 1600, measure: 0.19, motion: null, packageId: 'slide-fade', transitionBlend: 'wipe', transitionMs: 380 };
    case 'basement':
      // One oversized statement, interrupted once by the orange signal block.
      return { accent: { background: emphasis, foreground: ink, scene: 2 }, align: 'start', alignY: 0.48, background: { colorA: ink, style: 'solid' }, captionPosition: 'bottom-left', captions: (text, index) => `BSMNT — ${String(index + 1).padStart(2, '0')} — ${text.toUpperCase()}`, entrance: 'line-reveal', entranceMs: 520, foreground: paper, holdMs: 1400, measure: 0.26, motion: null, packageId: 'crossfade', transitionBlend: 'crossfade', transitionMs: 120 };
    case 'gt':
      // Centred multilingual morph on exact black, the language named in the corner.
      return { align: 'center', alignY: 0, background: { colorA: hex(identity, 'ink', '#181818'), style: 'solid' }, captionPosition: 'bottom-left', captions: (text, index, starter) => starter === 'brand-intro' ? GT_LANGUAGE_CODES[text] ?? `${String(index + 1).padStart(2, '0')}` : indexCaption('General Translation')(text, index), entrance: 'none', entranceMs: 0, foreground: paper, holdMs: 1250, measure: 0.17, motion: null, packageId: 'morph-fade', transitionBlend: 'crossfade', transitionMs: 240 };
    case 'ramp':
      // The savings ledger: paper field, light Lausanne, one lime proof.
      return { accent: { background: emphasis, foreground: ink, scene: 1 }, align: 'start', alignY: 0.12, background: { colorA: paper, style: 'solid' }, captionPosition: 'bottom-left', captions: indexCaption('Ramp'), entrance: 'word-rise', entranceMs: 560, foreground: ink, holdMs: 1500, measure: 0.2, motion: null, packageId: 'rise-fade', transitionBlend: 'wipe', transitionMs: 420 };
    case 'mintlify':
      // The knowledge beam: a deep green field lit by a directional green gradient.
      return { align: 'start', alignY: 0.06, background: { angle: 115, colorA: hex(identity, 'error', '#071611'), colorB: emphasis, style: 'gradient' }, captionPosition: 'bottom-left', captions: indexCaption('Mintlify Docs'), entrance: 'tracking-in', entranceMs: 760, foreground: paper, holdMs: 1700, measure: 0.19, motion: 'push-in', packageId: 'blur-swipe', transitionBlend: 'crossfade', transitionMs: 520 };
    case 'tailwind':
      // Utility wave: slate night, tight Inter, utilities as the metadata line.
      return { accent: { foreground: emphasis, scene: 1 }, align: 'start', alignY: 0.08, background: { angle: 160, colorA: hex(identity, 'error', '#020617'), colorB: ink, style: 'gradient' }, captionPosition: 'bottom-left', captions: (_text, index) => TAILWIND_UTILITIES[index % TAILWIND_UTILITIES.length]!, entrance: 'glyph-stagger', entranceMs: 640, foreground: paper, holdMs: 1500, measure: 0.2, motion: null, packageId: 'slide-fade', transitionBlend: 'crossfade', transitionMs: 360 };
    case 'viteplus':
      // Convergence field: violet energy behind one command, tracked in from wide.
      return { align: 'center', alignY: 0, background: { colorA: ink, colorB: hex(identity, 'progress', '#4E14FF'), colorC: emphasis, materialId: 'glyphfield-mesh-gradient', style: 'shader' }, captionPosition: 'bottom-left', captions: (text) => `$ vp ${text.toLowerCase().replace(/\s+/g, '-')}`, entrance: 'tracking-in', entranceMs: 620, foreground: paper, holdMs: 1400, measure: 0.2, motion: 'push-in', packageId: 'zoom-through', transitionBlend: 'radial', transitionMs: 420 };
    case 'cloudflare':
      // The network horizon: a white field fading to soft orange, one orange edge scene.
      return { accent: { background: emphasis, foreground: hex(identity, 'error', '#1D1D1F'), scene: 2 }, align: 'start', alignY: -0.02, background: { angle: 90, colorA: paper, colorB: hex(identity, 'warning', '#FFF0DB'), style: 'gradient' }, captionPosition: 'bottom-left', captions: indexCaption('Cloudflare'), entrance: 'word-rise', entranceMs: 600, foreground: ink, holdMs: 1500, measure: 0.19, motion: null, packageId: 'slide-fade', transitionBlend: 'wipe', transitionMs: 420 };
    case 'stripe':
      // The programmable field: blurple, cyan, and pink mesh under light Söhne.
      return { align: 'start', alignY: 0.1, background: { colorA: hex(identity, 'error', '#0A2540'), colorB: emphasis, colorC: hex(identity, 'success', '#00D4FF'), materialId: 'glyphfield-mesh-gradient', style: 'shader' }, captionPosition: 'bottom-left', captions: indexCaption('Stripe'), entrance: 'line-reveal', entranceMs: 680, foreground: paper, holdMs: 1600, measure: 0.21, motion: 'push-in', packageId: 'drift-fade', transitionBlend: 'crossfade', transitionMs: 520 };
    default: {
      // Custom identities: their ink field, paper type, and accent for one scene.
      const foreground = colorContrastRatio(ink, paper) >= 4.5 ? paper : '#FFFFFF';
      return { accent: colorContrastRatio(emphasis, foreground) >= 3 ? { background: emphasis, foreground, scene: 1 } : undefined, align: 'start', alignY: 0.1, background: { colorA: ink, style: 'solid' }, captionPosition: 'bottom-left', captions: indexCaption(name), entrance: 'word-rise', entranceMs: 600, foreground, holdMs: 1500, measure: 0.19, motion: null, packageId: 'slide-fade', transitionBlend: 'crossfade', transitionMs: 380 };
    }
  }
}

function starterScenes(identity: BrandIdentity, starterId: AnimationStarterId): string[] {
  const pick = (values: readonly string[], count: number, fallback: readonly string[]) => {
    const clean = values.map((value) => value.trim()).filter(Boolean);
    return (clean.length > 0 ? clean : [...fallback]).slice(0, count);
  };
  if (starterId === 'product-reel') return pick(identity.products, 4, identity.greetings);
  if (starterId === 'proof-points') return pick(identity.proof, 3, identity.greetings);
  return pick(identity.greetings, 6, [identity.name]);
}

export function animationStartersFor(identity: BrandIdentity): AnimationStarter[] {
  return [
    { description: `${identity.name} mark, then its greeting words.`, id: 'brand-intro', name: 'Brand intro', scenes: starterScenes(identity, 'brand-intro') },
    { description: 'One scene per product, closing on the mark.', id: 'product-reel', name: 'Product reel', scenes: starterScenes(identity, 'product-reel') },
    { description: 'Proof points set large, closing on the mark.', id: 'proof-points', name: 'Proof points', scenes: starterScenes(identity, 'proof-points') },
  ];
}

export function isAnimationStarterId(value: unknown): value is AnimationStarterId {
  return ANIMATION_STARTER_IDS.includes(value as AnimationStarterId);
}

function relativeLuminance(color: string): number {
  return colorContrastRatio(color, '#000000');
}

/** Builds a complete, editable starter for the current artboard in the identity's art direction. */
export function buildAnimationStarter({
  createId,
  hasLogo,
  identity,
  starterId,
}: {
  createId: () => string;
  hasLogo: boolean;
  identity: BrandIdentity;
  starterId: AnimationStarterId;
}): AnimationStarterPackage {
  const look = lookFor(identity);
  const display = brandTypographyRole(identity, 'Display');
  const scenes = starterScenes(identity, starterId);
  const background: StudioBackgroundSettings = {
    angle: look.background.angle ?? 135,
    colorA: look.background.colorA,
    colorB: look.background.colorB ?? look.background.colorA,
    colorC: look.background.colorC ?? look.background.colorB ?? look.background.colorA,
    finish: { ...DEFAULT_MATERIAL_FINISH },
    materialId: look.background.materialId ?? 'paper-dithering-swirl',
    materialSettings: {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: look.background.colorA,
      colorB: look.background.colorB ?? look.background.colorA,
      colorC: look.background.colorC ?? look.background.colorB ?? look.background.colorA,
      // Clean fields: material grain is noise to a GIF encoder and multiplies file size.
      grain: 0,
      speed: 0.28,
    },
    patternScale: 1,
    style: look.background.style,
  };
  const fontSize = Math.round(STARTER_CANVAS.height * look.measure);
  const margin = Math.round(Math.min(STARTER_CANVAS.width, STARTER_CANVAS.height) * 0.08);
  const alignX = look.align === 'start' ? (margin / STARTER_CANVAS.width) * 2 - 1 : 0;
  const settings: StudioSettings = {
    ...DEFAULT_SETTINGS,
    alignX,
    alignY: look.alignY,
    background: background.colorA,
    backgroundAngle: background.angle,
    backgroundSecondary: background.colorB,
    backgroundStyle: background.style,
    backgroundTransition: look.transitionBlend,
    bezier: parseCubicBezier(identity.motion[0]?.curve),
    fontSize,
    fontWeight: capVisibleFontWeight(display.weight ?? 500),
    foreground: look.foreground,
    height: STARTER_CANVAS.height,
    holdMs: look.holdMs,
    packageId: look.packageId,
    shaderSettings: { ...background.materialSettings },
    transitionMs: look.transitionMs,
    width: STARTER_CANVAS.width,
  };
  const tracking = (display.letterSpacing ?? 0) / 100;
  const entrance: TextAnimationSettings | undefined = look.entrance === 'none'
    ? undefined
    : { durationMs: look.entranceMs, easing: [...EASE_OUT] as unknown as CubicBezier, preset: look.entrance, staggerMs: 0 };
  const frameSettings: Record<string, StudioFrameSettings> = {};
  const backgroundOverrides: Record<string, boolean> = {};
  scenes.forEach((text, index) => {
    const id = `text-${index}`;
    const accent = look.accent && look.accent.scene === index ? look.accent : undefined;
    const base = createDefaultFrameSettings(settings);
    const frame: StudioFrameSettings = {
      ...base,
      background: accent?.background
        ? { ...background, colorA: accent.background, colorB: accent.background, style: 'solid' }
        : base.background,
      caption: { position: look.captionPosition, text: look.captions(text, index, starterId) },
      foreground: accent?.foreground ?? look.foreground,
      textAnchor: look.align,
      textAnimation: entrance,
      tracking: tracking || undefined,
    };
    if (look.motion) {
      frame.keyframes = motionPresetKeyframes(look.motion, { alignX: frame.alignX, alignY: frame.alignY, opacity: 1, rotation: 0, scale: 1 }, look.holdMs, createId);
    }
    if (accent?.background) backgroundOverrides[id] = true;
    frameSettings[id] = frame;
  });
  const textIds = scenes.map((_, index) => `text-${index}`);
  if (hasLogo) {
    const base = createDefaultFrameSettings(settings);
    frameSettings['brand-logo'] = {
      ...base,
      alignX: 0,
      alignY: 0,
      fit: 'contain',
      holdMs: Math.round(look.holdMs * 1.1),
      keyframes: motionPresetKeyframes('rise-in', { alignX: 0, alignY: 0, opacity: 1, rotation: 0, scale: 0.42 }, Math.round(look.holdMs * 1.1), createId),
      scale: 0.42,
    };
  }
  const sequenceOrder = hasLogo
    ? starterId === 'brand-intro' ? ['brand-logo', ...textIds] : [...textIds, 'brand-logo']
    : textIds;
  return {
    backgroundOverrides,
    frameSettings,
    includeBrandLogo: hasLogo,
    logoSurface: relativeLuminance(background.colorA) > 7 ? 'light' : 'dark',
    sequenceBackground: background,
    sequenceOrder,
    settings,
    starterId,
    textFrames: scenes.join('\n'),
  };
}
