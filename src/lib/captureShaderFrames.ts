import { canvasToImageBlob } from './canvasExport';
import { freezeLiveMaterialFrame, holdLiveMaterialPreviews, type LiveMaterialFrameState } from './liveMaterialPreview';
import { createShaderFrameAsset, type ShaderFrameSnapshot } from './shaderFrameAssets';

export type CapturedShaderFrame = {
  frameSnapshot: ShaderFrameSnapshot;
  frameState: LiveMaterialFrameState;
};

export type ShaderFrameCaptureRequest = {
  key: string;
  root: ParentNode | null;
  recipeKey: string;
  existing?: CapturedShaderFrame;
};

/** Presentation-independent recipe; placement, opacity and blending remain editable. */
export function shaderFrameRecipeKey(application: {
  materialId: string;
  settings: object;
  shaderSize: number;
}): string {
  return JSON.stringify([application.materialId, application.shaderSize,
    Object.entries(application.settings).sort(([left], [right]) => left.localeCompare(right))]);
}

export function shaderFrameMatches(
  snapshot: ShaderFrameSnapshot | undefined,
  application: Parameters<typeof shaderFrameRecipeKey>[0],
  timeMs?: number
): boolean {
  return Boolean(snapshot && snapshot.recipeKey === shaderFrameRecipeKey(application)
    && typeof snapshot.timeMs === 'number' && (timeMs === undefined || Math.abs(snapshot.timeMs - timeMs) < 0.01));
}

/**
 * Copy all displayed buffers in one synchronous transaction before PNG encoding
 * or storage can yield. No shader is stepped, reset or redrawn for readback.
 */
export function beginShaderFrameCapture(
  requests: readonly ShaderFrameCaptureRequest[],
  timelineTimeMs: number,
  { hold = false, previewGroup }: { hold?: boolean; previewGroup?: string } = {}
): { result: Promise<Map<string, CapturedShaderFrame>>; resume: () => void } {
  const resumes: Array<() => void> = [];
  const releasePreviews = holdLiveMaterialPreviews(requests.map(({ key }) => key), previewGroup ? [previewGroup] : []);
  const resume = () => { releasePreviews(); resumes.splice(0).forEach((release) => release()); };
  const copies: Array<{ request: ShaderFrameCaptureRequest; canvas: HTMLCanvasElement;
    state: LiveMaterialFrameState; presentation?: { filter?: string; grainOpacity?: number } }> = [];
  const captured = new Map<string, CapturedShaderFrame>();
  try {
    for (const request of requests) {
      if (request.existing) {
        captured.set(request.key, request.existing);
        continue;
      }
      const frozen = freezeLiveMaterialFrame(request.root, timelineTimeMs);
      if (!frozen) throw new Error('A shader is still loading. Wait for its preview before capturing this design.');
      resumes.push(frozen.resume);
      const canvas = document.createElement('canvas');
      canvas.width = frozen.canvas.width;
      canvas.height = frozen.canvas.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The shader frame could not be copied.');
      context.drawImage(frozen.canvas, 0, 0);
      copies.push({ request, canvas, state: frozen.state, presentation: frozen.presentation });
    }
  } catch (error) {
    resume();
    throw error;
  }
  if (!hold) resume();
  const result = (async () => {
    // Serial encoding bounds temporary memory for multi-layer compositions.
    for (const { request, canvas, state, presentation } of copies) {
      const blob = await canvasToImageBlob(canvas, 'png');
      const snapshot = await createShaderFrameAsset(blob, canvas);
      captured.set(request.key, {
        frameState: state,
        frameSnapshot: { ...snapshot, recipeKey: request.recipeKey,
          timeMs: timelineTimeMs, ...(presentation ? { presentation } : {}) },
      });
      canvas.width = 0;
      canvas.height = 0;
    }
    return captured;
  })().catch((error: unknown) => { resume(); throw error; });
  return { result, resume };
}
