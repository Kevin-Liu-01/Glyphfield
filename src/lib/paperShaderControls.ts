import { liveMaterialCenterOffset, type LiveMaterialSettings } from '@/lib/liveMaterials';
import { clampShaderZoom } from '@/lib/shaderZoom';

function scaleNumericControls(
  params: Record<string, unknown>,
  overrides: Record<string, unknown>,
  keys: readonly string[],
  factor: number,
  zeroSpan = 0.25,
  integer = false
) {
  keys.forEach((key) => {
    const original = params[key];
    if (typeof original !== 'number') return;
    const scaled = original === 0
      ? Math.max(0, (factor - 1) * zeroSpan)
      : Math.max(0, original * factor);
    overrides[key] = integer ? Math.max(1, Math.round(scaled)) : scaled;
  });
}

function controlFactor(value: number, defaultValue: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, 0.4 + (value / defaultValue) * 0.6));
}

export function paperControlOverrides(
  params: Record<string, unknown>,
  settings: LiveMaterialSettings,
  preservePresetAppearance: boolean
): Record<string, unknown> {
  if (preservePresetAppearance) return {};
  const overrides: Record<string, unknown> = {};
  const setIfPresent = (key: string, value: unknown) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) overrides[key] = value;
  };
  const scale = (keys: readonly string[], factor: number, zeroSpan = 0.25, integer = false) => {
    scaleNumericControls(params, overrides, keys, factor, zeroSpan, integer);
  };
  const strengthFactor = controlFactor(settings.strength, 0.3, 0.35, 3.4);
  const detailFactor = controlFactor(settings.detail, 3.2, 0.35, 2.5);
  const frequencyFactor = controlFactor(settings.frequency, 5.5, 0.3, 2.3);
  const amplitudeFactor = controlFactor(settings.amplitude, 3.2, 0.3, 2.4);
  const densityFactor = controlFactor(settings.density, 0.8, 0.35, 2.2);
  const palette = [settings.colorB, settings.colorC, settings.colorA];
  if (Array.isArray(params.colors)) {
    overrides.colors = params.colors.map((_, index) => palette[index % palette.length]);
  }
  setIfPresent('colorBack', settings.colorA);
  setIfPresent('colorGap', settings.colorA);
  setIfPresent('colorShadow', settings.colorA);
  setIfPresent('colorFill', settings.colorB);
  setIfPresent('colorFront', settings.colorB);
  setIfPresent('colorInner', settings.colorB);
  setIfPresent('colorMid', settings.colorB);
  setIfPresent('colorBloom', settings.colorC);
  setIfPresent('colorGlow', settings.colorC);
  setIfPresent('colorHighlight', settings.colorC);
  setIfPresent('colorStroke', settings.colorC);
  setIfPresent('colorTint', settings.colorC);
  setIfPresent('colorC', settings.colorB);
  setIfPresent('colorM', settings.colorC);
  setIfPresent('colorY', settings.colorB);
  setIfPresent('colorK', settings.colorA);

  scale(['intensity', 'contrast', 'bloom', 'outerGlow', 'innerGlow', 'highlights', 'glow'], strengthFactor, 0.35);
  scale(['noiseIterations', 'octaveCount', 'foldCount', 'count', 'bandCount', 'stepsPerColor', 'layering', 'edges'], detailFactor, 2, true);
  scale(['frequency', 'noiseFrequency', 'noiseScale', 'repetition', 'spots', 'gapX', 'gapY', 'strokeWidth'], frequencyFactor, 1.5);
  scale(['amplitude', 'waves', 'waveX', 'waveY', 'thickness', 'radius', 'size', 'distortion', 'swirl', 'stretch'], amplitudeFactor, 0.3);
  scale(['density', 'proportion', 'spreading', 'softness', 'spotty', 'smoke', 'noise', 'roughness', 'fiber', 'crumples', 'folds'], densityFactor, 0.25);

  const presetScale = typeof params.scale === 'number' ? params.scale : 1;
  setIfPresent('scale', presetScale * amplitudeFactor * Math.sqrt(frequencyFactor) * (0.92 + detailFactor * 0.08));
  const presetRotation = typeof params.rotation === 'number' ? params.rotation : 0;
  setIfPresent('rotation', presetRotation + settings.rotationZ);
  const presetOffsetX = typeof params.offsetX === 'number' ? params.offsetX : 0;
  const presetOffsetY = typeof params.offsetY === 'number' ? params.offsetY : 0;
  const centerOffset = liveMaterialCenterOffset(settings);
  setIfPresent('offsetX', presetOffsetX + centerOffset.x);
  setIfPresent('offsetY', presetOffsetY + centerOffset.y);

  const grainAmount = Math.min(1, Math.max(0, settings.grain / 100));
  setIfPresent('grainMixer', grainAmount);
  setIfPresent('grainOverlay', grainAmount);
  setIfPresent('grainSize', 0.12 + grainAmount * 1.6);
  setIfPresent('gridNoise', grainAmount);
  if (typeof params.brightness === 'number') {
    overrides.brightness = params.brightness * settings.brightness;
  }
  return overrides;
}

export function resolvePaperShaderScale(
  presetScale: unknown,
  patternScale: number,
  {
    gemSmoke = false,
    rendersBackdrop = false,
    rotation = 0,
  }: {
    gemSmoke?: boolean;
    rendersBackdrop?: boolean;
    rotation?: number;
  } = {}
): number {
  const nativeScale = typeof presetScale === 'number' && Number.isFinite(presetScale) && presetScale > 0
    ? presetScale
    : 1;
  const rotationCoverBoost = 1 + Math.abs(Math.sin(rotation * Math.PI / 180)) * 1.15;
  const presentationScale = gemSmoke
    ? Math.min(1.45, Math.max(1.12, nativeScale * 1.45))
    : rendersBackdrop
      ? Math.min(4, Math.max(1, nativeScale) * rotationCoverBoost)
      : nativeScale;

  return presentationScale * clampShaderZoom(patternScale);
}
