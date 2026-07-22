import {
  cubicBezierAt,
  resolveAnchor,
  type CubicBezier,
  type TimelinePosition,
} from './animation';

export type AnimationPackageId =
  | 'morph-fade'
  | 'type-delete'
  | 'crossfade'
  | 'scale-fade'
  | 'slide-fade';

export type StudioSource =
  | { kind: 'text'; text: string }
  | {
      height: number;
      image: CanvasImageSource;
      kind: 'image';
      name: string;
      width: number;
    };

export type RenderConfig = {
  alignX: number;
  alignY: number;
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
    config.alignX,
    config.alignY
  );
  const scale = config.scale * (options.scale ?? 1);
  context.save();
  context.globalAlpha = options.alpha ?? 1;
  context.filter = options.blur ? `blur(${options.blur}px)` : 'none';
  context.translate(anchor.x + (options.offsetX ?? 0), anchor.y);
  context.scale(scale, scale);

  if (source.kind === 'text') {
    const text = options.textOverride ?? source.text;
    context.fillStyle = config.foreground;
    context.font = `${config.fontWeight} ${config.fontSize}px Inter, Arial, sans-serif`;
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
    const imageScale = config.fit === 'cover' ? coverScale : containScale;
    const width = source.width * imageScale;
    const height = source.height * imageScale;
    context.drawImage(source.image, -width / 2, -height / 2, width, height);
  }

  context.restore();
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
  context.save();
  context.fillStyle = config.background;
  context.fillRect(0, 0, config.width, config.height);
  context.restore();

  if (sources.length === 0) {
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
