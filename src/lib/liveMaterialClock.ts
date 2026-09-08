import { normalizeLiveMaterialFrameState, type LiveMaterialFrameState } from './liveMaterialPreview';

export function shouldAdvanceLiveFluid(didRender: boolean, controlledTimeMs: number | null, paused: boolean, rate: number, deltaMs: number) {
  return !didRender || (controlledTimeMs === null && !paused && rate > 0 && deltaMs > 0);
}

function matchingFrameState(state: LiveMaterialFrameState | undefined, engine: LiveMaterialFrameState['engine'], materialId?: string) {
  return state?.engine === engine && (!state.materialId || state.materialId === materialId) ? state : undefined;
}

export function liveMaterialFramePointer(state: LiveMaterialFrameState | undefined, materialId: string) {
  return matchingFrameState(normalizeLiveMaterialFrameState(state), 'webgl', materialId)?.pointer;
}

/** A native render-clock anchor, independent of React updates and timeline sampling FPS. */
export function createLiveMaterialClock(engine: LiveMaterialFrameState['engine'], materialId?: string) {
  let frame = 0;
  let previous: number | undefined;
  let frozen = false;
  let appliedAnchor = '';
  let suspended = true;
  let sourceState: LiveMaterialFrameState | undefined;
  let normalized: LiveMaterialFrameState | undefined;
  return {
    get frame() { return frame; },
    get frozen() { return frozen; },
    freeze() { frozen = true; },
    resume() { frozen = false; previous = undefined; },
    read(timelineTimeMs: number): LiveMaterialFrameState {
      return { engine, frame, timelineTimeMs: Math.max(0, timelineTimeMs), version: 2, ...(materialId ? { materialId } : {}) };
    },
    draw({ now, rate, active, paused, captureTimeMs, frameState }: {
      now: number; rate: number; active: boolean; paused: boolean;
      captureTimeMs: number | null; frameState?: LiveMaterialFrameState;
    }): number {
      if (sourceState !== frameState) {
        sourceState = frameState;
        normalized = normalizeLiveMaterialFrameState(frameState);
      }
      const anchor = matchingFrameState(normalized, engine, materialId);
      const anchorKey = anchor ? `${anchor.frame}:${anchor.timelineTimeMs}:${anchor.materialId ?? ''}` : '';
      const delta = previous === undefined || suspended ? 0 : Math.max(0, now - previous);
      previous = now;
      suspended = frozen || !active || paused || captureTimeMs !== null;
      if (frozen || !active) return frame;
      if (captureTimeMs !== null && engine !== 'fluid') {
        frame = anchor ? anchor.frame + (captureTimeMs - anchor.timelineTimeMs) * rate : Math.max(0, captureTimeMs) * rate;
        appliedAnchor = anchorKey;
      } else if (anchorKey && anchorKey !== appliedAnchor) {
        frame = anchor!.frame;
        appliedAnchor = anchorKey;
      } else if (!paused && captureTimeMs === null) {
        frame += Math.min(64, delta) * rate;
      }
      return frame;
    },
  };
}
