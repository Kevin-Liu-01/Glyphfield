import {
  clamp,
  cubicBezierAt,
  resolveAnchor,
  type CubicBezier,
  type TimelinePosition,
} from './animation';
import {
  resolveKeyframePose,
  textAnimationIsActive,
  textAnimationUnits,
  textUnitProgress,
  textUnitState,
  type AnimationKeyframe,
  type TextAnimationSettings,
} from './animationMotion';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from './liveMaterials';
import {
  compositeFinishedLayer,
  finishColor,
  hasMaterialFinish,
  normalizeMaterialFinish,
  type MaterialBounds,
  type MaterialFinishSettings,
} from './materialFinish';
import { capVisibleFontWeight } from './typography';
import { drawShaderFramePresentation, type ShaderFramePresentation } from './shaderFramePresentation';

export type AnimationPackageId =
  | 'morph-fade'
  | 'type-delete'
  | 'crossfade'
  | 'scale-fade'
  | 'slide-fade'
  | 'rise-fade'
  | 'zoom-through'
  | 'blur-swipe'
  | 'flip-fade'
  | 'spring-pop'
  | 'rotate-fade'
  | 'drift-fade';

export type BackgroundStyle = 'solid' | 'gradient' | 'shader';

export type BackgroundTransitionId = 'crossfade' | 'wipe' | 'radial';

export type StudioBackground = {
  angle: number;
  colorA: string;
  colorB: string;
  colorC: string;
  finish?: MaterialFinishSettings;
  image?: CanvasImageSource;
  /** Runtime-only treatment for live native canvases; exported buffers are already composed. */
  shaderPresentation?: ShaderFramePresentation;
  materialId: LiveMaterialId;
  materialSettings: LiveMaterialSettings;
  opacity?: number;
  patternScale?: number;
  style: BackgroundStyle;
};

export function resolveStudioBackgroundOpacity(
  background: Pick<StudioBackground, 'opacity'>
): number {
  return Math.min(1, Math.max(0, background.opacity ?? 1));
}

export type StudioCaptionPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

/** A small fixed line of scene metadata (eyebrow, index, or proof note) set in the brand's supporting face. */
export type StudioCaption = {
  position: StudioCaptionPosition;
  text: string;
};

/** Where a text layer hangs from its anchor: its centre (default) or its leading edge. */
export type StudioTextAnchor = 'center' | 'start';

type StudioSourceBase = {
  alignX?: number;
  alignY?: number;
  background?: StudioBackground;
  caption?: StudioCaption;
  /** Supporting face for the caption; falls back to the display face. */
  captionFontFamily?: string;
  fit?: 'contain' | 'cover';
  finish?: MaterialFinishSettings;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  foreground?: string;
  id: string;
  /** Layer pose keyframes across the scene hold; absent means a static pose. */
  keyframes?: readonly AnimationKeyframe[];
  /** Runtime only: time into the scene used to resolve the text entrance. Never serialized. */
  motionElapsedMs?: number;
  opacity?: number;
  rotation?: number;
  scale?: number;
  textAnchor?: StudioTextAnchor;
  textAnimation?: TextAnimationSettings;
  /** Display tracking in em, matching the brand typography role. */
  tracking?: number;
};

export type StudioSource =
  | (StudioSourceBase & { kind: 'text'; text: string })
  | (StudioSourceBase & {
      height: number;
      /** Null while the file decodes; the scene keeps its place and draws nothing yet. */
      image: CanvasImageSource | null;
      kind: 'image';
      name: string;
      url?: string;
      width: number;
    });

export function hasAnimatedShaderBackgrounds(sources: readonly StudioSource[]): boolean {
  return sources.some((source) => source.background?.style === 'shader');
}

export function canCompositeShaderDirectly(
  current: StudioSource | undefined,
  next: StudioSource | undefined,
  backgroundOverrides: Readonly<Record<string, boolean>>
): boolean {
  if (!current || !next) return false;
  const currentBackground = current.background;
  const nextBackground = next.background;
  return !backgroundOverrides[current.id]
    && !backgroundOverrides[next.id]
    && currentBackground?.style === 'shader'
    && nextBackground?.style === 'shader'
    && currentBackground.materialId === nextBackground.materialId
    && !hasMaterialFinish(currentBackground.finish)
    && !hasMaterialFinish(nextBackground.finish)
    && !current.finish?.glassEnabled
    && !next.finish?.glassEnabled;
}

export type RenderConfig = {
  alignX: number;
  alignY: number;
  backgroundAngle: number;
  backgroundSecondary: string;
  backgroundStyle: BackgroundStyle;
  backgroundTransition: BackgroundTransitionId;
  background: string;
  bezier: CubicBezier;
  blur: number;
  fit: 'contain' | 'cover';
  fontFamily?: string;
  fontSize: number;
  fontWeight: number;
  foreground: string;
  height: number;
  packageId: AnimationPackageId;
  scale: number;
  width: number;
};

export type RenderFrameOptions = {
  omitBackground?: boolean;
};

type DrawOptions = {
  alpha?: number;
  backdrop?: CanvasImageSource;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  textOverride?: string;
};

const RENDER_GRAPHEME_SEGMENTER = new Intl.Segmenter('und', { granularity: 'grapheme' });

function graphemes(text: string): string[] {
  return Array.from(RENDER_GRAPHEME_SEGMENTER.segment(text), ({ segment }) => segment);
}

function canvasFontFamily(family: string | undefined): string {
  return family ? `${JSON.stringify(family)}, Arial, sans-serif` : 'Switzer, Arial, sans-serif';
}

function drawTrackedText(
  context: CanvasRenderingContext2D,
  units: readonly string[],
  measuredWidth: number,
  extraSpacing: number,
  anchor: StudioTextAnchor
): void {
  const width = measuredWidth + extraSpacing * Math.max(0, units.length - 1);
  const originX = anchor === 'start' ? 0 : -width / 2;
  let prefix = '';
  context.textAlign = 'left';
  units.forEach((unit, index) => {
    context.fillText(unit, originX + context.measureText(prefix).width + extraSpacing * index, 0);
    prefix += unit;
  });
}

function applyTracking(context: CanvasRenderingContext2D, tracking: number | undefined, fontSize: number): void {
  // Native canvas tracking where available; measureText then includes it.
  if (tracking && 'letterSpacing' in context) context.letterSpacing = `${tracking * fontSize}px`;
}

/**
 * Draws a text entrance with the frame's real font metrics. Units are placed at
 * their measured offsets in the full string, so the settled frame matches the
 * static renderer exactly.
 */
function drawAnimatedText(
  context: CanvasRenderingContext2D,
  text: string,
  settings: TextAnimationSettings,
  elapsedMs: number,
  fontSize: number,
  measuredWidth: number,
  anchor: StudioTextAnchor
): void {
  const progress = cubicBezierAt(clamp(elapsedMs / Math.max(1, settings.durationMs), 0, 1), settings.easing);
  const originX = anchor === 'start' ? 0 : -measuredWidth / 2;
  if (settings.preset === 'line-reveal') {
    const lineHeight = fontSize * 1.32;
    context.save();
    context.beginPath();
    context.rect(originX - fontSize, -lineHeight / 2, measuredWidth + fontSize * 2, lineHeight);
    context.clip();
    context.fillText(text, 0, (1 - progress) * lineHeight);
    context.restore();
    return;
  }
  const units = textAnimationUnits(text, settings.preset);
  const baseAlpha = context.globalAlpha;
  if (settings.preset === 'tracking-in') {
    context.globalAlpha = baseAlpha * progress;
    drawTrackedText(context, units, measuredWidth, (1 - progress) * fontSize * 0.42, anchor);
    return;
  }
  context.textAlign = 'left';
  let prefix = '';
  units.forEach((unit, index) => {
    const offset = context.measureText(prefix).width;
    prefix += unit;
    const state = textUnitState(settings.preset, textUnitProgress(settings, index, units.length, elapsedMs), fontSize);
    if (state.alpha <= 0) return;
    const unitWidth = context.measureText(unit).width;
    context.save();
    context.globalAlpha = baseAlpha * state.alpha;
    context.translate(originX + offset + unitWidth / 2, state.offsetY);
    if (state.scale !== 1) context.scale(state.scale, state.scale);
    context.fillText(unit, -unitWidth / 2, 0);
    context.restore();
  });
}

function drawTextContent(
  context: CanvasRenderingContext2D,
  source: Extract<StudioSource, { kind: 'text' }>,
  config: RenderConfig,
  anchor: { x: number; y: number },
  scale: number,
  textOverride?: string
): MaterialBounds {
  const text = textOverride ?? source.text;
  const fontSize = source.fontSize ?? config.fontSize;
  const textAnchor = source.textAnchor ?? 'center';
  context.fillStyle = source.foreground ?? config.foreground;
  context.font = `${capVisibleFontWeight(source.fontWeight ?? config.fontWeight)} ${fontSize}px ${canvasFontFamily(source.fontFamily ?? config.fontFamily)}`;
  applyTracking(context, source.tracking, fontSize);
  context.textAlign = textAnchor === 'start' ? 'left' : 'center';
  context.textBaseline = 'middle';
  const measuredWidth = context.measureText(text).width;
  const textScale = Math.min(1, (config.width * 0.84) / measuredWidth);
  context.scale(textScale, textScale);
  if (
    textOverride === undefined
    && source.motionElapsedMs !== undefined
    && source.textAnimation
    && textAnimationIsActive(source.textAnimation)
    && source.motionElapsedMs < source.textAnimation.durationMs
  ) {
    drawAnimatedText(context, text, source.textAnimation, source.motionElapsedMs, fontSize, measuredWidth, textAnchor);
  } else {
    context.fillText(text, 0, 0);
  }
  const width = measuredWidth * textScale * scale;
  const height = fontSize * 1.18 * textScale * scale;
  return { height, width, x: textAnchor === 'start' ? anchor.x : anchor.x - width / 2, y: anchor.y - height / 2 };
}

/** Caption type scale and safe margin, shared by the renderer and layout guides. */
export function studioCaptionMetrics(width: number, height: number): { fontSize: number; margin: number } {
  const short = Math.min(width, height);
  return { fontSize: Math.max(11, Math.round(short * 0.032)), margin: Math.round(short * 0.08) };
}

function drawCaption(context: CanvasRenderingContext2D, source: StudioSource, config: RenderConfig, alpha: number): void {
  const caption = source.caption;
  if (!caption?.text.trim() || alpha <= 0) return;
  const { fontSize, margin } = studioCaptionMetrics(config.width, config.height);
  const right = caption.position.endsWith('right');
  const bottom = caption.position.startsWith('bottom');
  context.save();
  context.globalAlpha = alpha * 0.74;
  context.fillStyle = source.foreground ?? config.foreground;
  context.font = `500 ${fontSize}px ${canvasFontFamily(source.captionFontFamily ?? source.fontFamily ?? config.fontFamily)}`;
  applyTracking(context, 0.06, fontSize);
  context.textAlign = right ? 'right' : 'left';
  context.textBaseline = bottom ? 'alphabetic' : 'top';
  context.fillText(caption.text, right ? config.width - margin : margin, bottom ? config.height - margin : margin);
  context.restore();
}

let measureContext: CanvasRenderingContext2D | null | undefined;

/**
 * Unscaled layer bounds that match the renderer: text uses the same font,
 * fitting, and line box as drawTextContent; images use their fit box.
 */
export function measureStudioSourceBounds(
  source: StudioSource,
  config: Pick<RenderConfig, 'fit' | 'fontFamily' | 'fontSize' | 'fontWeight' | 'height' | 'width'>
): { height: number; width: number } {
  if (source.kind === 'image') {
    const availableWidth = config.width * 0.78;
    const availableHeight = config.height * 0.74;
    const containScale = Math.min(availableWidth / source.width, availableHeight / source.height);
    const coverScale = Math.max(availableWidth / source.width, availableHeight / source.height);
    const imageScale = (source.fit ?? config.fit) === 'cover' ? coverScale : containScale;
    return { height: source.height * imageScale, width: source.width * imageScale };
  }
  const fontSize = source.fontSize ?? config.fontSize;
  if (measureContext === undefined) {
    const candidate = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
    // Test DOMs can return a context without text metrics; fall back to the estimate.
    measureContext = typeof candidate?.measureText === 'function' ? candidate : null;
  }
  const context = measureContext;
  let measuredWidth = Math.max(1, Array.from(source.text).length) * fontSize * 0.62;
  if (context) {
    context.font = `${capVisibleFontWeight(source.fontWeight ?? config.fontWeight)} ${fontSize}px ${canvasFontFamily(source.fontFamily ?? config.fontFamily)}`;
    if ('letterSpacing' in context) context.letterSpacing = `${(source.tracking ?? 0) * fontSize}px`;
    measuredWidth = context.measureText(source.text).width || measuredWidth;
  }
  const textScale = Math.min(1, (config.width * 0.84) / Math.max(1, measuredWidth));
  return {
    height: fontSize * 1.18 * textScale,
    width: Math.max(fontSize * 0.5, measuredWidth) * textScale,
  };
}

/** Resolves keyframes and the text entrance for one scene at a time on its hold. */
export function applySceneMotion(source: StudioSource, sceneElapsedMs: number | undefined): StudioSource {
  if (sceneElapsedMs === undefined) return source;
  const hasKeyframes = Boolean(source.keyframes?.length);
  const hasText = source.kind === 'text' && textAnimationIsActive(source.textAnimation);
  if (!hasKeyframes && !hasText) return source;
  const pose = hasKeyframes
    ? resolveKeyframePose({
        alignX: source.alignX ?? 0,
        alignY: source.alignY ?? 0,
        opacity: source.opacity ?? 1,
        rotation: source.rotation ?? 0,
        scale: source.scale ?? 1,
      }, source.keyframes, sceneElapsedMs)
    : null;
  return {
    ...source,
    ...pose,
    ...(hasText ? { motionElapsedMs: sceneElapsedMs } : {}),
  };
}

/** True when a scene changes during its hold, so preview and GIF must sample it. */
export function sceneMovesDuringHold(source: StudioSource | undefined): boolean {
  if (!source) return false;
  return (source.keyframes?.length ?? 0) > 1
    || (source.kind === 'text' && textAnimationIsActive(source.textAnimation));
}

function drawImageContent(
  context: CanvasRenderingContext2D,
  source: Extract<StudioSource, { kind: 'image' }>,
  config: RenderConfig,
  anchor: { x: number; y: number },
  scale: number
): MaterialBounds {
  if (!source.image || source.width <= 0 || source.height <= 0) return { height: 0, width: 0, x: anchor.x, y: anchor.y };
  const availableWidth = config.width * 0.78;
  const availableHeight = config.height * 0.74;
  const containScale = Math.min(availableWidth / source.width, availableHeight / source.height);
  const coverScale = Math.max(availableWidth / source.width, availableHeight / source.height);
  const imageScale = (source.fit ?? config.fit) === 'cover' ? coverScale : containScale;
  const imageWidth = source.width * imageScale;
  const imageHeight = source.height * imageScale;
  context.drawImage(source.image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return { height, width, x: anchor.x - width / 2, y: anchor.y - height / 2 };
}

function configureSourceTransform(
  context: CanvasRenderingContext2D,
  source: StudioSource,
  anchor: { x: number; y: number },
  scale: number,
  options: DrawOptions
): void {
  context.globalAlpha = (source.opacity ?? 1) * (options.alpha ?? 1);
  context.filter = options.blur ? `blur(${options.blur}px)` : 'none';
  context.translate(anchor.x + (options.offsetX ?? 0), anchor.y + (options.offsetY ?? 0));
  context.rotate((((source.rotation ?? 0) + (options.rotation ?? 0)) * Math.PI) / 180);
  context.scale(scale * (options.scaleX ?? 1), scale * (options.scaleY ?? 1));
}

function drawSourceContent(
  context: CanvasRenderingContext2D,
  source: StudioSource,
  config: RenderConfig,
  options: DrawOptions = {}
): MaterialBounds {
  const anchor = resolveAnchor(
    config.width,
    config.height,
    source.alignX ?? config.alignX,
    source.alignY ?? config.alignY
  );
  const scale = (source.scale ?? config.scale) * (options.scale ?? 1);
  context.save();
  configureSourceTransform(context, source, anchor, scale, options);
  const bounds = source.kind === 'text'
    ? drawTextContent(context, source, config, anchor, scale, options.textOverride)
    : drawImageContent(context, source, config, anchor, scale);
  context.restore();
  return bounds;
}

function drawSource(
  context: CanvasRenderingContext2D,
  source: StudioSource,
  config: RenderConfig,
  options: DrawOptions = {}
): void {
  if (!hasMaterialFinish(source.finish)) {
    drawSourceContent(context, source, config, options);
    return;
  }
  const layer = document.createElement('canvas');
  layer.width = config.width;
  layer.height = config.height;
  const layerContext = layer.getContext('2d');
  if (!layerContext) return;
  const bounds = drawSourceContent(layerContext, source, config, options);
  compositeFinishedLayer(
    context,
    layer,
    bounds,
    normalizeMaterialFinish(source.finish),
    (source.opacity ?? 1) * (options.alpha ?? 1),
    options.backdrop
  );
}

function captureBackdrop(context: CanvasRenderingContext2D): HTMLCanvasElement {
  const backdrop = document.createElement('canvas');
  backdrop.width = context.canvas.width;
  backdrop.height = context.canvas.height;
  backdrop.getContext('2d')?.drawImage(context.canvas, 0, 0);
  return backdrop;
}

function fallbackBackground(config: RenderConfig): StudioBackground {
  return {
    angle: config.backgroundAngle,
    colorA: config.background,
    colorB: config.backgroundSecondary,
    colorC: config.backgroundSecondary,
    materialId: 'shadergradient-prismatic-sphere',
    materialSettings: { ...DEFAULT_LIVE_MATERIAL_SETTINGS },
    style: config.backgroundStyle,
  };
}

export function resolveDrawableImageSize(
  image: CanvasImageSource,
  fallbackWidth: number,
  fallbackHeight: number
): { height: number; width: number } | null {
  const width = 'width' in image ? Number(image.width) : fallbackWidth;
  const height = 'height' in image ? Number(image.height) : fallbackHeight;
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? { height, width }
    : null;
}

function drawBackgroundContent(
  context: CanvasRenderingContext2D,
  background: StudioBackground,
  config: RenderConfig,
  alpha = 1
): void {
  context.save();
  context.globalAlpha = alpha;

  if (background.style === 'shader' && background.image) {
    const sourceSize = resolveDrawableImageSize(background.image, config.width, config.height);
    if (sourceSize) {
      const { height: sourceHeight, width: sourceWidth } = sourceSize;
      const scale = Math.max(config.width / sourceWidth, config.height / sourceHeight);
      const width = sourceWidth * scale;
      const height = sourceHeight * scale;
      const bounds = { x: (config.width - width) / 2, y: (config.height - height) / 2, width, height };
      if (background.shaderPresentation) {
        drawShaderFramePresentation(context, background.image, background.shaderPresentation, bounds);
      } else {
        context.drawImage(background.image, bounds.x, bounds.y, width, height);
      }
      context.restore();
      return;
    }
  }

  if (background.style === 'gradient' || background.style === 'shader') {
    const radians = (background.angle * Math.PI) / 180;
    const radius = Math.abs(config.width * Math.cos(radians)) + Math.abs(config.height * Math.sin(radians));
    const centerX = config.width / 2;
    const centerY = config.height / 2;
    const offsetX = Math.cos(radians) * radius * 0.5;
    const offsetY = Math.sin(radians) * radius * 0.5;
    const gradient = context.createLinearGradient(
      centerX - offsetX,
      centerY - offsetY,
      centerX + offsetX,
      centerY + offsetY
    );
    gradient.addColorStop(0, background.colorA);
    gradient.addColorStop(1, background.colorB);
    context.fillStyle = gradient;
  } else {
    context.fillStyle = background.colorA;
  }
  context.fillRect(0, 0, config.width, config.height);
  context.restore();
}

function drawBackgroundFinish(
  context: CanvasRenderingContext2D,
  finishInput: MaterialFinishSettings,
  config: RenderConfig,
  alpha: number
): void {
  const finish = normalizeMaterialFinish(finishInput);
  if (finish.shadowEnabled && finish.shadowOpacity > 0) {
    const depth = Math.max(1, finish.shadowBlur * 1.5);
    const gradient = context.createRadialGradient(
      config.width / 2 + finish.shadowOffsetX,
      config.height / 2 + finish.shadowOffsetY,
      Math.min(config.width, config.height) * 0.2,
      config.width / 2,
      config.height / 2,
      Math.hypot(config.width, config.height) * 0.62
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(
      Math.min(
        0.95,
        Math.max(0.45, 1 - depth / Math.max(config.width, config.height))
      ),
      'rgba(0,0,0,0)'
    );
    gradient.addColorStop(
      1,
      finishColor(
        finish.shadowColor,
        (finish.shadowOpacity / 100) * alpha
      )
    );
    context.save();
    context.fillStyle = gradient;
    context.fillRect(0, 0, config.width, config.height);
    context.restore();
  }

  if (finish.glassEnabled) {
    const highlight = context.createLinearGradient(
      0,
      0,
      config.width,
      config.height
    );
    highlight.addColorStop(
      0,
      finishColor('#FFFFFF', (finish.glassHighlight / 100) * 0.28 * alpha)
    );
    highlight.addColorStop(0.46, 'rgba(255,255,255,0)');
    highlight.addColorStop(
      1,
      finishColor(finish.glassTint, (finish.glassOpacity / 100) * alpha)
    );
    context.save();
    context.fillStyle = highlight;
    context.fillRect(0, 0, config.width, config.height);
    context.restore();
  }

  if (finish.reflectionEnabled && finish.reflectionOpacity > 0) {
    const reflection = context.createLinearGradient(
      0,
      0,
      0,
      config.height * Math.max(0.1, finish.reflectionLength / 100)
    );
    reflection.addColorStop(
      0,
      finishColor('#FFFFFF', (finish.reflectionOpacity / 100) * 0.32 * alpha)
    );
    reflection.addColorStop(1, 'rgba(255,255,255,0)');
    context.save();
    context.fillStyle = reflection;
    context.fillRect(0, 0, config.width, config.height);
    context.restore();
  }

  if (finish.borderEnabled && finish.borderWidth > 0) {
    context.save();
    context.globalAlpha = alpha;
    context.lineWidth = finish.borderWidth;
    context.strokeStyle = finishColor(
      finish.borderColor,
      finish.borderOpacity / 100
    );
    const inset = finish.borderWidth / 2;
    context.strokeRect(
      inset,
      inset,
      Math.max(0, config.width - finish.borderWidth),
      Math.max(0, config.height - finish.borderWidth)
    );
    context.restore();
  }
}

function drawBackgroundLayer(
  context: CanvasRenderingContext2D,
  background: StudioBackground,
  config: RenderConfig,
  alpha = 1
): void {
  const effectiveAlpha = alpha * resolveStudioBackgroundOpacity(background);
  drawBackgroundContent(context, background, config, effectiveAlpha);
  if (hasMaterialFinish(background.finish)) {
    drawBackgroundFinish(
      context,
      normalizeMaterialFinish(background.finish),
      config,
      effectiveAlpha
    );
  }
}

function drawBackgroundTransition(
  context: CanvasRenderingContext2D,
  current: StudioBackground,
  next: StudioBackground,
  config: RenderConfig,
  progress: number
): void {
  drawBackgroundLayer(context, current, config);

  if (config.backgroundTransition === 'wipe') {
    context.save();
    context.beginPath();
    context.rect(0, 0, config.width * progress, config.height);
    context.clip();
    drawBackgroundLayer(context, next, config);
    context.restore();
    return;
  }

  if (config.backgroundTransition === 'radial') {
    context.save();
    context.beginPath();
    context.arc(
      config.width / 2,
      config.height / 2,
      Math.hypot(config.width, config.height) * progress,
      0,
      Math.PI * 2
    );
    context.clip();
    drawBackgroundLayer(context, next, config);
    context.restore();
    return;
  }

  drawBackgroundLayer(context, next, config, progress);
}

function drawTypeDelete(
  context: CanvasRenderingContext2D,
  current: StudioSource,
  next: StudioSource,
  config: RenderConfig,
  progress: number,
  backdrop?: CanvasImageSource
): void {
  if (current.kind !== 'text' || next.kind !== 'text') {
    drawSource(context, current, config, { alpha: 1 - progress, backdrop });
    drawSource(context, next, config, { alpha: progress, backdrop });
    return;
  }

  if (progress < 0.5) {
    const units = graphemes(current.text);
    const localProgress = cubicBezierAt(progress * 2, config.bezier);
    const length = Math.max(0, Math.ceil(units.length * (1 - localProgress)));
    drawSource(context, current, config, {
      backdrop,
      textOverride: units.slice(0, length).join(''),
    });
    return;
  }

  const units = graphemes(next.text);
  const localProgress = cubicBezierAt((progress - 0.5) * 2, config.bezier);
  const length = Math.min(units.length, Math.floor(units.length * localProgress));
  drawSource(context, next, config, {
    backdrop,
    textOverride: units.slice(0, length).join(''),
  });
}

type TransitionEffect = (
  context: CanvasRenderingContext2D,
  current: StudioSource,
  next: StudioSource,
  config: RenderConfig,
  eased: number,
  backdrop?: CanvasImageSource
) => void;

function drawTransitionPair(
  context: CanvasRenderingContext2D,
  current: StudioSource,
  next: StudioSource,
  config: RenderConfig,
  currentOptions: DrawOptions,
  nextOptions: DrawOptions,
  backdrop?: CanvasImageSource
): void {
  drawSource(context, current, config, { ...currentOptions, backdrop });
  drawSource(context, next, config, { ...nextOptions, backdrop });
}

const transitionEffects: Record<Exclude<AnimationPackageId, 'type-delete'>, TransitionEffect> = {
  'blur-swipe': (context, current, next, config, eased, backdrop) => {
    const travel = config.width * 0.13;
    const blur = config.blur * 1.35 * Math.sin(Math.PI * eased);
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, blur, offsetX: travel * eased },
      { alpha: eased, blur, offsetX: -travel * (1 - eased) },
      backdrop
    );
  },
  crossfade: (context, current, next, config, eased, backdrop) => {
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased },
      { alpha: eased },
      backdrop
    );
  },
  'drift-fade': (context, current, next, config, eased, backdrop) => {
    const travelX = config.width * 0.07;
    const travelY = config.height * 0.09;
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, offsetX: -travelX * eased, offsetY: travelY * eased, rotation: -3 * eased },
      { alpha: eased, offsetX: travelX * (1 - eased), offsetY: -travelY * (1 - eased), rotation: 3 * (1 - eased) },
      backdrop
    );
  },
  'flip-fade': (context, current, next, config, eased, backdrop) => {
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, scaleX: Math.max(0.04, 1 - eased) },
      { alpha: eased, scaleX: Math.max(0.04, eased) },
      backdrop
    );
  },
  'morph-fade': (context, current, next, config, eased, backdrop) => {
    const melt = Math.sin(Math.PI * eased);
    const blur = config.blur * melt;
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, blur, scale: 1 + melt * 0.025 },
      { alpha: eased, blur, scale: 0.975 + eased * 0.025 },
      backdrop
    );
  },
  'rise-fade': (context, current, next, config, eased, backdrop) => {
    const travel = config.height * 0.14;
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, offsetY: -travel * eased },
      { alpha: eased, offsetY: travel * (1 - eased) },
      backdrop
    );
  },
  'rotate-fade': (context, current, next, config, eased, backdrop) => {
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, rotation: -8 * eased, scale: 1 - eased * 0.05 },
      { alpha: eased, rotation: 8 * (1 - eased), scale: 0.95 + eased * 0.05 },
      backdrop
    );
  },
  'scale-fade': (context, current, next, config, eased, backdrop) => {
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, scale: 1 - eased * 0.08 },
      { alpha: eased, scale: 1.08 - eased * 0.08 },
      backdrop
    );
  },
  'slide-fade': (context, current, next, config, eased, backdrop) => {
    const travel = config.width * 0.08;
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, offsetX: -travel * eased },
      { alpha: eased, offsetX: travel * (1 - eased) },
      backdrop
    );
  },
  'spring-pop': (context, current, next, config, eased, backdrop) => {
    const lift = Math.sin(Math.PI * eased);
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, scale: 1 + lift * 0.08 },
      { alpha: eased, scale: 0.72 + eased * 0.28 + lift * 0.13 },
      backdrop
    );
  },
  'zoom-through': (context, current, next, config, eased, backdrop) => {
    drawTransitionPair(
      context,
      current,
      next,
      config,
      { alpha: 1 - eased, scale: 1 + eased * 0.24 },
      { alpha: eased, scale: 0.76 + eased * 0.24 },
      backdrop
    );
  },
};

function drawEmptyFrame(context: CanvasRenderingContext2D, config: RenderConfig): void {
  drawBackgroundLayer(context, fallbackBackground(config), config);
  context.save();
  context.fillStyle = config.foreground;
  context.globalAlpha = 0.34;
  context.font = `600 ${Math.max(18, config.fontSize * 0.24)}px ${canvasFontFamily(config.fontFamily)}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText('IMPORT IMAGES TO BEGIN', config.width / 2, config.height / 2);
  context.restore();
}

function drawFrameBackground(
  context: CanvasRenderingContext2D,
  current: StudioSource,
  next: StudioSource,
  config: RenderConfig,
  position: TimelinePosition,
  sourceCount: number
): void {
  const currentBackground = current.background ?? fallbackBackground(config);
  const nextBackground = next.background ?? currentBackground;
  if (position.phase !== 'transition' || sourceCount === 1) {
    drawBackgroundLayer(context, currentBackground, config);
    return;
  }
  drawBackgroundTransition(
    context,
    currentBackground,
    nextBackground,
    config,
    cubicBezierAt(position.progress, config.bezier)
  );
}

export function renderFrame(
  context: CanvasRenderingContext2D,
  sources: readonly StudioSource[],
  config: RenderConfig,
  position: TimelinePosition,
  options: RenderFrameOptions = {}
): void {
  if (sources.length === 0) {
    drawEmptyFrame(context, config);
    return;
  }

  const currentSource = sources[position.index % sources.length] ?? sources[0];
  if (!currentSource) return;
  const nextSource = sources[position.nextIndex % sources.length] ?? currentSource;
  // The outgoing scene leaves from the end of its hold; the incoming one enters at its start.
  const current = applySceneMotion(currentSource, position.sceneElapsedMs);
  const next = position.phase === 'transition' && sources.length > 1
    ? applySceneMotion(nextSource, position.sceneElapsedMs === undefined ? undefined : 0)
    : nextSource;
  if (!options.omitBackground) drawFrameBackground(context, current, next, config, position, sources.length);
  const needsBackdrop = current.finish?.glassEnabled || next.finish?.glassEnabled;
  const backdrop = needsBackdrop ? captureBackdrop(context) : undefined;
  if (position.phase === 'hold' || sources.length === 1) {
    drawSource(context, current, config, { backdrop });
    drawCaption(context, current, config, 1);
    return;
  }

  const eased = cubicBezierAt(position.progress, config.bezier);
  if (config.packageId === 'type-delete') {
    drawTypeDelete(context, current, next, config, position.progress, backdrop);
  } else {
    transitionEffects[config.packageId](context, current, next, config, eased, backdrop);
  }
  // Captions stay fixed in the frame and exchange by opacity only.
  drawCaption(context, current, config, 1 - eased);
  drawCaption(context, next, config, eased);
}
