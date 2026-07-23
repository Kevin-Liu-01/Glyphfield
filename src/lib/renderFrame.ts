import {
  cubicBezierAt,
  resolveAnchor,
  type CubicBezier,
  type TimelinePosition,
} from './animation';
import type { LiveMaterialId } from './liveMaterials';

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
  style: BackgroundStyle;
};

type StudioSourceBase = {
  alignX?: number;
  alignY?: number;
  background?: StudioBackground;
  fit?: 'contain' | 'cover';
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

function drawSource(
  context: CanvasRenderingContext2D,
  source: StudioSource,
  config: RenderConfig,
  options: DrawOptions = {}
): void {
  const anchor = resolveAnchor(
    config.width,
    config.height,
    source.alignX ?? config.alignX,
    source.alignY ?? config.alignY
  );
  const scale = (source.scale ?? config.scale) * (options.scale ?? 1);
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
    if (measuredWidth > maximumWidth) {
      const textScale = maximumWidth / measuredWidth;
      context.scale(textScale, textScale);
    }
    context.fillText(text, 0, 0);
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
  }

  context.restore();
}

function fallbackBackground(config: RenderConfig): StudioBackground {
  return {
    angle: config.backgroundAngle,
    colorA: config.background,
    colorB: config.backgroundSecondary,
    colorC: config.backgroundSecondary,
    materialId: 'shadergradient-prismatic-sphere',
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
  progress: number
): void {
  if (current.kind !== 'text' || next.kind !== 'text') {
    drawSource(context, current, config, { alpha: 1 - progress });
    drawSource(context, next, config, { alpha: progress });
    return;
  }

  if (progress < 0.5) {
    const units = graphemes(current.text);
    const localProgress = cubicBezierAt(progress * 2, config.bezier);
    const length = Math.max(0, Math.ceil(units.length * (1 - localProgress)));
    drawSource(context, current, config, {
      textOverride: units.slice(0, length).join(''),
    });
    return;
  }

  const units = graphemes(next.text);
  const localProgress = cubicBezierAt((progress - 0.5) * 2, config.bezier);
  const length = Math.min(units.length, Math.floor(units.length * localProgress));
  drawSource(context, next, config, {
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
  if (position.phase === 'hold' || sources.length === 1) {
    drawSource(context, current, config);
    return;
  }

  const eased = cubicBezierAt(position.progress, config.bezier);
  if (config.packageId === 'type-delete') {
    drawTypeDelete(context, current, next, config, position.progress);
    return;
  }

  if (config.packageId === 'morph-fade') {
    const melt = Math.sin(Math.PI * eased);
    const blur = config.blur * melt;
    drawSource(context, current, config, {
      alpha: 1 - eased,
      blur,
      scale: 1 + melt * 0.025,
    });
    drawSource(context, next, config, {
      alpha: eased,
      blur,
      scale: 0.975 + eased * 0.025,
    });
    return;
  }

  if (config.packageId === 'scale-fade') {
    drawSource(context, current, config, {
      alpha: 1 - eased,
      scale: 1 - eased * 0.08,
    });
    drawSource(context, next, config, {
      alpha: eased,
      scale: 1.08 - eased * 0.08,
    });
    return;
  }

  if (config.packageId === 'slide-fade') {
    const travel = config.width * 0.08;
    drawSource(context, current, config, {
      alpha: 1 - eased,
      offsetX: -travel * eased,
    });
    drawSource(context, next, config, {
      alpha: eased,
      offsetX: travel * (1 - eased),
    });
    return;
  }

  drawSource(context, current, config, { alpha: 1 - eased });
  drawSource(context, next, config, { alpha: eased });
}
