import { freezeLiveMaterialFrame, type LiveMaterialFrameState } from './liveMaterialPreview';
import type { ShaderFrameCaptureRequest } from './captureShaderFrames';

/** Pause the displayed renderers without encoding pixels or writing storage. */
export function pauseShaderFrames(requests: readonly ShaderFrameCaptureRequest[], timeMs: number) {
  const states = new Map<string, LiveMaterialFrameState>();
  const releases: Array<() => void> = [];
  const release = () => releases.splice(0).forEach((resume) => resume());
  try {
    for (const request of requests) {
      if (request.existing) {
        states.set(request.key, request.existing.frameState);
        continue;
      }
      const frozen = freezeLiveMaterialFrame(request.root, timeMs);
      if (!frozen) throw new Error('A shader is still loading. Wait for its preview before pausing.');
      releases.push(frozen.resume);
      states.set(request.key, frozen.state);
    }
    return { states, release };
  } catch (error) {
    release();
    throw error;
  }
}
