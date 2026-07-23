import {
  cubicBezierAt,
  resolveAnchor,
  type CubicBezier,
  type TimelinePosition,
} from './animation';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from './liveMaterials';
import {
  compositeFinishedLayer,
  hasMaterialFinish,
  normalizeMaterialFinish,
  type MaterialBounds,
  type MaterialFinishSettings,
} from './materialFinish';

export type AnimationPackageId =
  | 'morph-fade'
  | 'type-delete'
  | 'crossfade'
  | 'scale-fade'
  | 'slide-fade';

export type BackgroundStyle = 'solid' | 'gradient' | 'shader';

export type BackgroundTransitionId = 'crossfade' | 'wipe' | 'radial';

export type StudioBackground = {
  angle: number;
  colorA: string;
  colorB: string;
  colorC: string;
  image?: CanvasImageSource;
  materialId: LiveMaterialId;
  materialSettings: LiveMaterialSettings;
  style: BackgroundStyle;
};

type StudioSourceBase = {
  alignX?: number;
  alignY?: number;
  background?: StudioBackground;
  fit?: 'contain' | 'cover';
  finish?: MaterialFinishSettings;
  fontSize?: number;
  fontWeight?: number;
  foreground?: string;
  id: string;
  opacity?: number;
  rotation?: number;
  scale?: number;
};

export type StudioSource =
  | (StudioSourceBase & { kind: 'text'; text: string })
  | (StudioSourceBase & {
      height: number;
      image: CanvasImageSource;
      kind: 'image';
      name: string;
      width: number;
    });

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
  fontSize: number;
  fontWeight: number;
  foreground: string;
  height: number;
  packageId: AnimationPackageId;
  scale: number;
  width: number;
};

type DrawOptions = {
  alpha?: number;
  backdrop?: CanvasImageSource;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  textOverride?: string;
};

function graphemes(text: string): string[] {
  const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
  return Array.from(segmenter.segment(text), ({ segment }) => segment);
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
  let bounds: MaterialBounds = {
    height: config.height * 0.2,
    width: config.width * 0.4,
    x: anchor.x - config.width * 0.2,
    y: anchor.y - config.height * 0.1,
  };
  context.save();
  context.globalAlpha = (source.opacity ?? 1) * (options.alpha ?? 1);
  context.filter = options.blur ? `blur(${options.blur}px)` : 'none';
  context.translate(
    anchor.x + (options.offsetX ?? 0),
    anchor.y + (options.offsetY ?? 0)
  );
  context.rotate(((source.rotation ?? 0) * Math.PI) / 180);
  context.scale(scale, scale);

  if (source.kind === 'text') {
    const text = options.textOverride ?? source.text;
    context.fillStyle = source.foreground ?? config.foreground;
    context.font = `${source.fontWeight ?? config.fontWeight} ${source.fontSize ?? config.fontSize}px Inter, Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const measuredWidth = context.measureText(text).width;
    const maximumWidth = config.width * 0.84;
    let textScale = 1;
    if (measuredWidth > maximumWidth) {
      textScale = maximumWidth / measuredWidth;
      context.scale(textScale, textScale);
    }
    context.fillText(text, 0, 0);
    const renderedWidth = measuredWidth * textScale * scale;
    const renderedHeight = (source.fontSize ?? config.fontSize) * 1.18 * textScale * scale;
    bounds = {
      height: renderedHeight,
      width: renderedWidth,
      x: anchor.x - renderedWidth / 2,
      y: anchor.y - renderedHeight / 2,
    };
  } else {
    const availableWidth = config.width * 0.78;
    const availableHeight = config.height * 0.74;
    const containScale = Math.min(
      availableWidth / source.width,
      availableHeight / source.height
    );
    const coverScale = Math.max(
      availableWidth / source.width,
      availableHeight / source.height
    );
    const imageScale = (source.fit ?? config.fit) === 'cover' ? coverScale : containScale;
    const width = source.width * imageScale;
    const height = source.height * imageScale;
    context.drawImage(source.image, -width / 2, -height / 2, width, height);
    bounds = {
      height: height * scale,
      width: width * scale,
      x: anchor.x - (width * scale) / 2,
      y: anchor.y - (height * scale) / 2,
    };
  }

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

function drawBackgroundLayer(
  context: CanvasRenderingContext2D,
  background: StudioBackground,
  config: RenderConfig,
  alpha = 1
): void {
  context.save();
  context.globalAlpha = alpha;

  if (background.style === 'shader' && background.image) {
    const sourceWidth = 'width' in background.image ? Number(background.image.width) : config.width;
    const sourceHeight = 'height' in background.image ? Number(background.image.height) : config.height;
    const scale = Math.max(config.width / sourceWidth, config.height / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    context.drawImage(
      background.image,
      (config.width - width) / 2,
      (config.height - height) / 2,
      width,
      height
    );
    context.restore();
    return;
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

export function renderFrame(
  context: CanvasRenderingContext2D,
  sources: readonly StudioSource[],
  config: RenderConfig,
  position: TimelinePosition
): void {
  if (sources.length === 0) {
    drawBackgroundLayer(context, fallbackBackground(config), config);
    context.save();
    context.fillStyle = config.foreground;
    context.globalAlpha = 0.34;
    context.font = `600 ${Math.max(18, config.fontSize * 0.24)}px Inter, Arial, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('IMPORT IMAGES TO BEGIN', config.width / 2, config.height / 2);
    context.restore();
    return;
  }

  const current = sources[position.index % sources.length] ?? sources[0];
  if (!current) return;
  const next = sources[position.nextIndex % sources.length] ?? current;
  const currentBackground = current.background ?? fallbackBackground(config);
  const nextBackground = next.background ?? currentBackground;
  const backgroundProgress = cubicBezierAt(position.progress, config.bezier);
  if (position.phase === 'transition' && sources.length > 1) {
    drawBackgroundTransition(
      context,
      currentBackground,
      nextBackground,
      config,
      backgroundProgress
    );
  } else {
    drawBackgroundLayer(context, currentBackground, config);
  }
  const needsBackdrop = current.finish?.glassEnabled || next.finish?.glassEnabled;
  const backdrop = needsBackdrop ? captureBackdrop(context) : undefined;
  if (position.phase === 'hold' || sources.length === 1) {
    drawSource(context, current, config, { backdrop });
    return;
  }

  const eased = cubicBezierAt(position.progress, config.bezier);
  if (config.packageId === 'type-delete') {
    drawTypeDelete(context, current, next, config, position.progress, backdrop);
    return;
  }

  if (config.packageId === 'morph-fade') {
    const melt = Math.sin(Math.PI * eased);
    const blur = config.blur * melt;
    drawSource(context, current, config, {
      alpha: 1 - eased,
      backdrop,
      blur,
      scale: 1 + melt * 0.025,
    });
    drawSource(context, next, config, {
      alpha: eased,
      backdrop,
      blur,
      scale: 0.975 + eased * 0.025,
    });
    return;
  }

  if (config.packageId === 'scale-fade') {
    drawSource(context, current, config, {
      alpha: 1 - eased,
      backdrop,
      scale: 1 - eased * 0.08,
    });
    drawSource(context, next, config, {
      alpha: eased,
      backdrop,
      scale: 1.08 - eased * 0.08,
    });
    return;
  }

  if (config.packageId === 'slide-fade') {
    const travel = config.width * 0.08;
    drawSource(context, current, config, {
      alpha: 1 - eased,
      backdrop,
      offsetX: -travel * eased,
    });
    drawSource(context, next, config, {
      alpha: eased,
      backdrop,
      offsetX: travel * (1 - eased),
    });
    return;
  }

  drawSource(context, current, config, { alpha: 1 - eased, backdrop });
  drawSource(context, next, config, { alpha: eased, backdrop });
}
