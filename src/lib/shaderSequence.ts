import type { LiveMaterialId } from './liveMaterials';

type ShaderSequencePace = 'accelerating' | 'even';

export type ShaderSequenceSettings = {
  cutCount: number;
  finalHoldMs: number;
  pace: ShaderSequencePace;
};

export type ShaderSequenceSegment = {
  durationMs: number;
  endMs: number;
  index: number;
  materialId: LiveMaterialId;
  startMs: number;
};

export const DEFAULT_SHADER_SEQUENCE_SETTINGS: ShaderSequenceSettings = {
  cutCount: 10,
  finalHoldMs: 5_000,
  pace: 'accelerating',
};

const SHADER_SEQUENCE_CANDIDATE_IDS: readonly LiveMaterialId[] = [
  'shadergradient-prismatic-sphere',
  'paper-god-rays',
  'paper-liquid-metal',
  'study-line-field',
  'glyphfield-dither-gradient',
  'study-chrome-glares',
  'paper-warp',
  'shaders-fluid-chrome',
  'glyphfield-glyph-field',
  'paper-grain-gradient',
  'shaders-spectral-bloom',
  'pavel-fluid-energy',
];

export function normalizeShaderSequenceSettings(
  settings?: Partial<ShaderSequenceSettings>
): ShaderSequenceSettings {
  return {
    cutCount: Math.min(12, Math.max(8, Math.round(settings?.cutCount ?? DEFAULT_SHADER_SEQUENCE_SETTINGS.cutCount))),
    finalHoldMs: Math.min(6_000, Math.max(3_000, Math.round(settings?.finalHoldMs ?? DEFAULT_SHADER_SEQUENCE_SETTINGS.finalHoldMs))),
    pace: settings?.pace === 'even' ? 'even' : 'accelerating',
  };
}

export function shaderSequenceMaterialIds(
  finalMaterialId: LiveMaterialId,
  cutCount: number,
  candidates: readonly LiveMaterialId[] = SHADER_SEQUENCE_CANDIDATE_IDS,
  offset = 0
): LiveMaterialId[] {
  const normalizedCount = normalizeShaderSequenceSettings({ cutCount }).cutCount;
  const intros = Array.from(new Set(candidates)).filter((id) => id !== finalMaterialId);
  if (intros.length < normalizedCount - 1) {
    throw new RangeError('The shader sequence needs enough unique intro materials.');
  }
  const start = ((Math.round(offset) % intros.length) + intros.length) % intros.length;
  const rotated = [...intros.slice(start), ...intros.slice(0, start)];
  return [...rotated.slice(0, normalizedCount - 1), finalMaterialId];
}

export function buildShaderSequenceTimeline(
  materialIds: readonly LiveMaterialId[],
  settings?: Partial<ShaderSequenceSettings>
): ShaderSequenceSegment[] {
  if (materialIds.length < 2) throw new RangeError('A shader sequence needs at least two materials.');
  const normalized = normalizeShaderSequenceSettings({ ...settings, cutCount: materialIds.length });
  const introCount = materialIds.length - 1;
  let cursorMs = 0;
  return materialIds.map((materialId, index) => {
    const progress = introCount <= 1 ? 1 : index / (introCount - 1);
    const durationMs = index === materialIds.length - 1
      ? normalized.finalHoldMs
      : normalized.pace === 'even'
        ? 620
        : Math.round((1_050 + (280 - 1_050) * progress) / 10) * 10;
    const segment = {
      durationMs,
      endMs: cursorMs + durationMs,
      index,
      materialId,
      startMs: cursorMs,
    };
    cursorMs = segment.endMs;
    return segment;
  });
}

export function shaderSequenceDurationMs(timeline: readonly ShaderSequenceSegment[]): number {
  return timeline.at(-1)?.endMs ?? 0;
}

export function shaderSequenceSegmentAt(
  timeline: readonly ShaderSequenceSegment[],
  timeMs: number
): ShaderSequenceSegment | null {
  if (timeline.length === 0) return null;
  const boundedTime = Math.max(0, timeMs);
  return timeline.find((segment) => boundedTime < segment.endMs) ?? timeline.at(-1)!;
}
