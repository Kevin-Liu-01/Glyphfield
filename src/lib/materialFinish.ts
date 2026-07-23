export type MaterialFinishPresetId =
  | 'none'
  | 'soft-depth'
  | 'mirror'
  | 'liquid-glass'
  | 'gallery-glass';

export type MaterialFinishSettings = {
  borderColor: string;
  borderEnabled: boolean;
  borderOpacity: number;
  borderWidth: number;
  glassBlur: number;
  glassEnabled: boolean;
  glassHighlight: number;
  glassOpacity: number;
  glassPadding: number;
  glassRadius: number;
  glassRefraction: number;
  glassTint: string;
  presetId: MaterialFinishPresetId | 'custom';
  reflectionBlur: number;
  reflectionEnabled: boolean;
  reflectionGap: number;
  reflectionLength: number;
  reflectionOpacity: number;
  shadowBlur: number;
  shadowColor: string;
  shadowEnabled: boolean;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
};

export type MaterialBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export const DEFAULT_MATERIAL_FINISH: MaterialFinishSettings = {
  borderColor: '#FFFFFF',
  borderEnabled: false,
  borderOpacity: 38,
  borderWidth: 1,
  glassBlur: 18,
  glassEnabled: false,
  glassHighlight: 58,
  glassOpacity: 18,
  glassPadding: 36,
  glassRadius: 28,
  glassRefraction: 6,
  glassTint: '#FFFFFF',
  presetId: 'none',
  reflectionBlur: 2,
  reflectionEnabled: false,
  reflectionGap: 16,
  reflectionLength: 72,
  reflectionOpacity: 24,
  shadowBlur: 32,
  shadowColor: '#000000',
  shadowEnabled: false,
  shadowOffsetX: 0,
  shadowOffsetY: 18,
  shadowOpacity: 28,
};

export const MATERIAL_FINISH_PRESETS: readonly {
  description: string;
  id: MaterialFinishPresetId;
  label: string;
  settings: MaterialFinishSettings;
}[] = [
  {
    description: 'No added surface treatment.',
    id: 'none',
    label: 'Clean',
    settings: DEFAULT_MATERIAL_FINISH,
  },
  {
    description: 'A broad, quiet studio shadow with no added frame.',
    id: 'soft-depth',
    label: 'Soft depth',
    settings: {
      ...DEFAULT_MATERIAL_FINISH,
      presetId: 'soft-depth',
      shadowEnabled: true,
    },
  },
  {
    description: 'A fading floor reflection with restrained depth.',
    id: 'mirror',
    label: 'Mirror',
    settings: {
      ...DEFAULT_MATERIAL_FINISH,
      presetId: 'mirror',
      reflectionEnabled: true,
      reflectionOpacity: 30,
      shadowBlur: 20,
      shadowEnabled: true,
      shadowOffsetY: 10,
      shadowOpacity: 20,
    },
  },
  {
    description: 'Refracted translucent glass, edge light, and soft depth.',
    id: 'liquid-glass',
    label: 'Liquid glass',
    settings: {
      ...DEFAULT_MATERIAL_FINISH,
      borderEnabled: true,
      glassEnabled: true,
      presetId: 'liquid-glass',
      shadowEnabled: true,
    },
  },
  {
    description: 'A sharper display case with reflection and luminous edge.',
    id: 'gallery-glass',
    label: 'Gallery glass',
    settings: {
      ...DEFAULT_MATERIAL_FINISH,
      borderEnabled: true,
      borderOpacity: 64,
      glassBlur: 10,
      glassEnabled: true,
      glassHighlight: 78,
      glassOpacity: 10,
      glassRadius: 12,
      presetId: 'gallery-glass',
      reflectionEnabled: true,
      reflectionOpacity: 18,
      shadowBlur: 22,
      shadowEnabled: true,
      shadowOffsetY: 12,
      shadowOpacity: 20,
    },
  },
];

export function normalizeMaterialFinish(
  finish?: Partial<MaterialFinishSettings>
): MaterialFinishSettings {
  return { ...DEFAULT_MATERIAL_FINISH, ...finish };
}

export function materialFinishPreset(id: MaterialFinishPresetId): MaterialFinishSettings {
  const preset = MATERIAL_FINISH_PRESETS.find((candidate) => candidate.id === id)
    ?? MATERIAL_FINISH_PRESETS[0]!;
  return { ...preset.settings };
}

export function hasMaterialFinish(finish?: Partial<MaterialFinishSettings>): boolean {
  const resolved = normalizeMaterialFinish(finish);
  return resolved.borderEnabled
    || resolved.glassEnabled
    || resolved.reflectionEnabled
    || resolved.shadowEnabled;
}

export function finishColor(color: string, opacity: number): string {
  const normalized = color.replace('#', '');
  const expanded = normalized.length === 3
    ? normalized.split('').map((character) => `${character}${character}`).join('')
    : normalized.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(expanded, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${Math.max(0, Math.min(1, opacity))})`;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  bounds: MaterialBounds,
  radius: number
): void {
  const resolvedRadius = Math.min(radius, bounds.width / 2, bounds.height / 2);
  context.beginPath();
  context.roundRect(bounds.x, bounds.y, bounds.width, bounds.height, resolvedRadius);
}

function paddedBounds(bounds: MaterialBounds, padding: number): MaterialBounds {
  return {
    height: bounds.height + padding * 2,
    width: bounds.width + padding * 2,
    x: bounds.x - padding,
    y: bounds.y - padding,
  };
}

export function drawLiquidGlassPanel(
  context: CanvasRenderingContext2D,
  bounds: MaterialBounds,
  finish: MaterialFinishSettings,
  alpha = 1,
  backdrop?: CanvasImageSource
): void {
  if (!finish.glassEnabled) return;
  const panel = paddedBounds(bounds, finish.glassPadding);
  const snapshot = backdrop ?? context.canvas;
  const scale = 1 + finish.glassRefraction / 100;
  const centerX = panel.x + panel.width / 2;
  const centerY = panel.y + panel.height / 2;

  context.save();
  roundedRectPath(context, panel, finish.glassRadius);
  context.clip();
  context.globalAlpha = Math.min(1, alpha * 0.9);
  context.filter = `blur(${finish.glassBlur}px)`;
  context.translate(centerX, centerY);
  context.scale(scale, scale);
  context.translate(-centerX, -centerY);
  context.drawImage(snapshot, 0, 0);
  context.restore();

  context.save();
  if (finish.shadowEnabled) {
    context.shadowBlur = finish.shadowBlur;
    context.shadowColor = finishColor(finish.shadowColor, finish.shadowOpacity / 100);
    context.shadowOffsetX = finish.shadowOffsetX;
    context.shadowOffsetY = finish.shadowOffsetY;
  }
  roundedRectPath(context, panel, finish.glassRadius);
  const glassGradient = context.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y + panel.height);
  glassGradient.addColorStop(0, finishColor('#FFFFFF', finish.glassHighlight / 100 * alpha));
  glassGradient.addColorStop(0.36, finishColor(finish.glassTint, finish.glassOpacity / 100 * alpha));
  glassGradient.addColorStop(1, finishColor(finish.glassTint, finish.glassOpacity / 250 * alpha));
  context.fillStyle = glassGradient;
  context.fill();
  if (finish.borderEnabled && finish.borderWidth > 0) {
    context.lineWidth = finish.borderWidth;
    context.strokeStyle = finishColor(finish.borderColor, finish.borderOpacity / 100 * alpha);
    context.stroke();
  }
  context.restore();
}

function drawReflection(
  context: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  bounds: MaterialBounds,
  finish: MaterialFinishSettings
): void {
  if (!finish.reflectionEnabled || finish.reflectionOpacity <= 0) return;
  const reflection = createCanvas(layer.width, layer.height);
  const reflectionContext = reflection.getContext('2d');
  if (!reflectionContext) return;
  const startY = bounds.y + bounds.height + finish.reflectionGap;
  const reflectionHeight = Math.max(1, bounds.height * (finish.reflectionLength / 100));
  const reflectionAxis = bounds.y + bounds.height + finish.reflectionGap / 2;
  reflectionContext.save();
  reflectionContext.translate(0, reflectionAxis * 2);
  reflectionContext.scale(1, -1);
  reflectionContext.drawImage(layer, 0, 0);
  reflectionContext.restore();
  reflectionContext.globalCompositeOperation = 'destination-in';
  const fade = reflectionContext.createLinearGradient(0, startY, 0, startY + reflectionHeight);
  fade.addColorStop(0, 'rgba(0,0,0,0.88)');
  fade.addColorStop(1, 'rgba(0,0,0,0)');
  reflectionContext.fillStyle = fade;
  reflectionContext.fillRect(bounds.x - finish.borderWidth, startY, bounds.width + finish.borderWidth * 2, reflectionHeight);
  context.save();
  context.globalAlpha = finish.reflectionOpacity / 100;
  context.filter = finish.reflectionBlur > 0 ? `blur(${finish.reflectionBlur}px)` : 'none';
  context.drawImage(reflection, 0, 0);
  context.restore();
}

function drawOutline(
  context: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  finish: MaterialFinishSettings
): void {
  if (!finish.borderEnabled || finish.borderWidth <= 0 || finish.borderOpacity <= 0) return;
  const tint = createCanvas(layer.width, layer.height);
  const tintContext = tint.getContext('2d');
  if (!tintContext) return;
  tintContext.drawImage(layer, 0, 0);
  tintContext.globalCompositeOperation = 'source-in';
  tintContext.fillStyle = finishColor(finish.borderColor, finish.borderOpacity / 100);
  tintContext.fillRect(0, 0, tint.width, tint.height);
  const samples = Math.max(8, Math.min(24, Math.ceil(finish.borderWidth * 4)));
  for (let index = 0; index < samples; index += 1) {
    const angle = (Math.PI * 2 * index) / samples;
    context.drawImage(
      tint,
      Math.cos(angle) * finish.borderWidth,
      Math.sin(angle) * finish.borderWidth
    );
  }
}

export function compositeFinishedLayer(
  context: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  bounds: MaterialBounds,
  finishInput?: Partial<MaterialFinishSettings>,
  alpha = 1,
  backdrop?: CanvasImageSource
): void {
  const finish = normalizeMaterialFinish(finishInput);
  drawLiquidGlassPanel(context, bounds, finish, alpha, backdrop);
  drawReflection(context, layer, bounds, finish);
  drawOutline(context, layer, finish);
  context.save();
  if (finish.shadowEnabled && !finish.glassEnabled) {
    context.filter = `drop-shadow(${finish.shadowOffsetX}px ${finish.shadowOffsetY}px ${finish.shadowBlur}px ${finishColor(finish.shadowColor, finish.shadowOpacity / 100)})`;
  }
  context.drawImage(layer, 0, 0);
  context.restore();
}
