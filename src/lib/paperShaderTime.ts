import { liveMaterialMotionTimeMs, type PaperLiveMaterialId } from '@/lib/liveMaterials';
import { normalizeLiveMaterialFrameState, type LiveMaterialFrameState } from '@/lib/liveMaterialPreview';

// Keep the existing nonzero controlled epoch; native Paper frame values are
// milliseconds, not frame indices (ShaderMount passes frame * .001 to u_time).
const PAPER_CONTROLLED_FRAME_EPOCH_MS = 1;

export function resolvePaperShaderFrame({ materialId, timeMs, frameState, preserveGeometry, speed, preset }: {
  materialId: PaperLiveMaterialId;
  timeMs: number;
  frameState?: LiveMaterialFrameState;
  preserveGeometry: boolean;
  speed: number;
  preset: Readonly<{ frame?: unknown; speed?: unknown }>;
}): number {
  const presetSpeed = typeof preset.speed === 'number' ? preset.speed : 1;
  const motionSpeed = presetSpeed > 0 ? presetSpeed : 0.35;
  const presetFrame = typeof preset.frame === 'number' ? preset.frame : 0;
  const motionTimeMs = preserveGeometry ? timeMs : liveMaterialMotionTimeMs(timeMs, speed);
  const state = normalizeLiveMaterialFrameState(frameState);
  if (!state || state.engine !== 'paper' || (state.materialId && state.materialId !== materialId)) {
    return presetFrame + PAPER_CONTROLLED_FRAME_EPOCH_MS + motionTimeMs * motionSpeed;
  }
  const anchorTimeMs = preserveGeometry
    ? state.timelineTimeMs
    : liveMaterialMotionTimeMs(state.timelineTimeMs, speed);
  return state.frame + (motionTimeMs - anchorTimeMs) * motionSpeed;
}
