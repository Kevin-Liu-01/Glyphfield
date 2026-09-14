import { mixHexColors } from '@/lib/color';
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

export function paperShaderFilter(
  preservePresetAppearance: boolean,
  settings: LiveMaterialSettings
): string | undefined {
  if (preservePresetAppearance) return undefined;
  return [
    `brightness(${settings.brightness})`,
    `contrast(${Math.max(0.5, 1 + (settings.strength - 0.3) * 0.24)})`,
    `saturate(${Math.max(0.35, 1 + (settings.density - 0.8) * 0.3)})`,
  ].join(' ');
}

export function paperShaderGrainOpacity(
  preservePresetAppearance: boolean,
  settings: Pick<LiveMaterialSettings, 'grain'>
): number {
  return preservePresetAppearance ? 0 : Math.min(0.34, Math.max(0, settings.grain) / 260);
}

export function paperPaletteOverrides(
  params: Record<string, unknown>,
  settings: LiveMaterialSettings
): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  const setIfPresent = (key: string, value: unknown) => {
    if (Object.prototype.hasOwnProperty.call(params, key)) overrides[key] = value;
  };
  const palette = [settings.colorA, settings.colorB, settings.colorC];
  if (Array.isArray(params.colors)) {
    // Paper presets are allowed to collapse their native ramp to one or two
    // colors. The Studio palette is always a three-stop authored system, so
    // restore those stops instead of silently dropping Base, Mid, or Light.
    overrides.colors = Array.from(
      { length: Math.max(palette.length, params.colors.length) },
      (_, index) => palette[index % palette.length]
    );
  }
  setIfPresent('colorBack', settings.colorA);
  setIfPresent('colorGap', settings.colorA);
  setIfPresent('colorShadow', settings.colorB);
  setIfPresent('colorFill', settings.colorB);
  setIfPresent('colorInner', settings.colorB);
  setIfPresent('colorMid', settings.colorB);
  setIfPresent('colorBloom', settings.colorC);
  setIfPresent('colorGlow', settings.colorC);
  setIfPresent('colorHighlight', settings.colorC);
  setIfPresent('colorStroke', settings.colorC);
  setIfPresent('colorTint', settings.colorC);
  setIfPresent('colorC', settings.colorB);
  setIfPresent('colorM', settings.colorC);
  setIfPresent('colorY', mixHexColors(settings.colorB, settings.colorC, 0.5));
  setIfPresent('colorK', settings.colorA);

  if (Object.prototype.hasOwnProperty.call(params, 'colorFront')) {
    const hasSeparateMid = Object.prototype.hasOwnProperty.call(params, 'colorMid');
    const hasSeparateLight = Object.prototype.hasOwnProperty.call(params, 'colorHighlight')
      || Object.prototype.hasOwnProperty.call(params, 'colorGlow')
      || Object.prototype.hasOwnProperty.call(params, 'colorStroke');
    overrides.colorFront = hasSeparateMid
      ? settings.colorC
      : hasSeparateLight
        ? settings.colorB
        : mixHexColors(settings.colorB, settings.colorC, 0.5);
  }

  // A few two-channel effects expose only a highlight/tint beside their base.
  // Blend the authored Mid and Light stops so both remain meaningful.
  const hasColorRamp = Array.isArray(params.colors)
    || Object.prototype.hasOwnProperty.call(params, 'colorFront')
    || Object.prototype.hasOwnProperty.call(params, 'colorMid')
    || Object.prototype.hasOwnProperty.call(params, 'colorFill')
    || Object.prototype.hasOwnProperty.call(params, 'colorInner')
    || Object.prototype.hasOwnProperty.call(params, 'colorM');
  if (!hasColorRamp && Object.prototype.hasOwnProperty.call(params, 'colorHighlight')) {
    overrides.colorHighlight = mixHexColors(settings.colorB, settings.colorC, 0.5);
  }
  if (!hasColorRamp && Object.prototype.hasOwnProperty.call(params, 'colorTint')) {
    overrides.colorTint = mixHexColors(settings.colorB, settings.colorC, 0.5);
  }
  return overrides;
}

export function paperControlOverrides(
  params: Record<string, unknown>,
  settings: LiveMaterialSettings,
  preservePresetAppearance: boolean
): Record<string, unknown> {
  if (preservePresetAppearance) return {};
  const overrides = paperPaletteOverrides(params, settings);
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
