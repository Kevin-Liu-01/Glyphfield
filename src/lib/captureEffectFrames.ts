import { canvasToImageBlob } from './canvasExport';
import { createShaderFrameAsset, type ShaderFrameSnapshot } from './shaderFrameAssets';

/** Copy every completed converter buffer before any asynchronous PNG work. */
export async function captureComposedEffectFrames(
  effectIds: readonly string[],
  render: (copy: (id: string, source: HTMLCanvasElement) => void) => void
): Promise<Map<string, ShaderFrameSnapshot>> {
  const copies = new Map<string, HTMLCanvasElement>();
  try {
    render((id, source) => {
      if (!effectIds.includes(id) || copies.has(id)) throw new Error('The converter capture order changed.');
      if (source.width <= 0 || source.height <= 0) throw new Error('A converter frame is not ready to capture.');
      const canvas = document.createElement('canvas');
      canvas.width = source.width;
      canvas.height = source.height;
      copies.set(id, canvas);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('The converter frame could not be copied.');
      context.drawImage(source, 0, 0);
    });
    if (copies.size !== effectIds.length) throw new Error('A converter frame did not finish rendering.');
    const frames = new Map<string, ShaderFrameSnapshot>();
    for (const [id, canvas] of copies) {
      frames.set(id, await createShaderFrameAsset(await canvasToImageBlob(canvas, 'png'), canvas));
    }
    return frames;
  } finally {
    copies.forEach((canvas) => { canvas.width = 0; canvas.height = 0; });
  }
}
