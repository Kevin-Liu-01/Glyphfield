import { canvasToImageBlob } from './canvasExport';
import { freezeLiveMaterialFrame, holdLiveMaterialPreviews, type LiveMaterialFrameState, type LiveMaterialPresentation } from './liveMaterialPreview';
import { createShaderFrameAsset, validateShaderFramePng, type ShaderFrameSnapshot } from './shaderFrameAssets';

export type CapturedShaderFrame = {
  frameSnapshot: ShaderFrameSnapshot;
  frameState: LiveMaterialFrameState;
  frameBlob?: never;
};

/** Export-only pixels have no asset ID or saved snapshot to persist accidentally. */
export type TransientShaderFrame = {
  frameBlob: Blob;
  frameState: LiveMaterialFrameState;
  width: number;
  height: number;
  presentation?: LiveMaterialPresentation;
};

export type ShaderFrameImageCapture = CapturedShaderFrame | TransientShaderFrame;
type CaptureOperation<T> = { result: Promise<Map<string, T>>; resume: () => void };
type CaptureOptions = { hold?: boolean; previewGroup?: string };

function captureFailure(error: unknown): unknown {
  if (!error || typeof error !== 'object' || !('name' in error) || error.name !== 'SecurityError') return error;
  const failure = new Error('Your browser blocked access to these shader pixels. A cross-origin image may need to be imported locally before this frame can be captured.', { cause: error });
  failure.name = 'SecurityError';
  return failure;
}

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
  options: CaptureOptions & { mode: 'transient' }
): CaptureOperation<ShaderFrameImageCapture>;
export function beginShaderFrameCapture(
  requests: readonly ShaderFrameCaptureRequest[],
  timelineTimeMs: number,
  options?: CaptureOptions & { mode?: 'durable' }
): CaptureOperation<CapturedShaderFrame>;
export function beginShaderFrameCapture(
  requests: readonly ShaderFrameCaptureRequest[],
  timelineTimeMs: number,
  { hold = false, previewGroup, mode = 'durable' }: { hold?: boolean; previewGroup?: string; mode?: 'durable' | 'transient' } = {}
): CaptureOperation<ShaderFrameImageCapture> {
  const resumes: Array<() => void> = [];
  const releasePreviews = holdLiveMaterialPreviews(requests.map(({ key }) => key), previewGroup ? [previewGroup] : []);
  const resume = () => { releasePreviews(); resumes.splice(0).forEach((release) => release()); };
  const copies: Array<{ request: ShaderFrameCaptureRequest; canvas: HTMLCanvasElement;
    state: LiveMaterialFrameState; presentation?: LiveMaterialPresentation }> = [];
  const captured = new Map<string, ShaderFrameImageCapture>();
  const clearCopies = () => copies.forEach(({ canvas }) => { canvas.width = 0; canvas.height = 0; });
  try {
    for (const request of requests) {
      if (request.existing) {
        if (mode === 'durable' && request.existing.frameBlob) {
          throw new TypeError('An export-only capture cannot be reused as a saved shader frame. Capture a durable frame first.');
        }
        captured.set(request.key, request.existing);
        continue;
      }
      const frozen = freezeLiveMaterialFrame(request.root, timelineTimeMs);
      if (!frozen) throw new Error('A shader is still loading. Wait for its preview before capturing this design.');
      resumes.push(frozen.resume);
      const canvas = document.createElement('canvas');
      copies.push({ request, canvas, state: frozen.state, presentation: frozen.presentation });
      canvas.width = frozen.canvas.width;
      canvas.height = frozen.canvas.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The shader frame could not be copied.');
      context.drawImage(frozen.canvas, 0, 0);
    }
  } catch (error) {
    resume();
    clearCopies();
    throw captureFailure(error);
  }
  if (!hold) resume();
  const result = (async () => {
    // Serial encoding bounds temporary memory for multi-layer compositions.
    for (const { request, canvas, state, presentation } of copies) {
      const blob = await canvasToImageBlob(canvas, 'png').catch((error: unknown) => { throw captureFailure(error); });
      if (mode === 'transient') {
        const dimensions = await validateShaderFramePng(blob, canvas);
        captured.set(request.key, { frameBlob: blob, frameState: state, ...dimensions, ...(presentation ? { presentation } : {}) });
      } else {
        const snapshot = await createShaderFrameAsset(blob, canvas);
        captured.set(request.key, {
          frameState: state,
          frameSnapshot: { ...snapshot, recipeKey: request.recipeKey,
            timeMs: timelineTimeMs, ...(presentation ? { presentation } : {}) },
        });
      }
      canvas.width = 0;
      canvas.height = 0;
    }
    return captured;
  })().catch((error: unknown) => { resume(); throw error; }).finally(clearCopies);
  return { result, resume };
}
