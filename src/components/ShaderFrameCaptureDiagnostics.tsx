'use client';

import { useEffect } from 'react';
import { captureLiveMaterialFrameState, freezeLiveMaterialFrame, type LiveMaterialFrameState } from '@/lib/liveMaterialPreview';
import { waitForLiveMaterialReady } from '@/lib/liveMaterialReadiness';
import { compareShaderPixels, readShaderPixels, summarizeShaderPixels } from '@/lib/shaderPixelReadback';

const nextPaint = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/** Opt-in regression harness only. No observers/readback are added to Studio or landing. */
export default function ShaderFrameCaptureDiagnostics({ materialId, rootRef, restore }: {
  materialId: string;
  rootRef: { current: HTMLElement | null };
  restore: (state: LiveMaterialFrameState, timeMs: number | null, remount: boolean) => Promise<void>;
}) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frozen: ReturnType<typeof freezeLiveMaterialFrame>;
    let capturedPixels: ReturnType<typeof readShaderPixels> | undefined;
    const harness = {
      async ready() {
        await waitForLiveMaterialReady(root, 30_000);
        await nextPaint();
        const pixels = readShaderPixels(root);
        return { materialId, ...summarizeShaderPixels(pixels) };
      },
      read() {
        const pixels = readShaderPixels(root);
        return { materialId, state: captureLiveMaterialFrameState(root, 1000),
          pixels: summarizeShaderPixels(pixels), comparison: capturedPixels ? compareShaderPixels(capturedPixels, pixels) : null };
      },
      freeze() {
        frozen?.resume();
        frozen = freezeLiveMaterialFrame(root, 1000);
        if (!frozen) throw new Error('Native shader capture is not ready.');
        capturedPixels = readShaderPixels(root);
        const gl = frozen.state.engine === 'canvas2d' ? null
          : frozen.canvas.getContext('webgl2') ?? frozen.canvas.getContext('webgl');
        return { state: frozen.state, presentation: frozen.presentation,
          drawingBufferPreserved: gl?.getContextAttributes()?.preserveDrawingBuffer ?? null,
          pixels: summarizeShaderPixels(capturedPixels) };
      },
      async pngRoundTrip() {
        if (!frozen || !capturedPixels) throw new Error('Freeze the native shader before encoding.');
        const copy = document.createElement('canvas');
        copy.width = frozen.canvas.width;
        copy.height = frozen.canvas.height;
        const context = copy.getContext('2d');
        if (!context) throw new Error('Pixel copying is unavailable.');
        context.drawImage(frozen.canvas, 0, 0);
        const blob = await new Promise<Blob>((resolve, reject) => copy.toBlob((value) => value ? resolve(value) : reject(new Error('PNG encoding failed.')), 'image/png'));
        const image = await createImageBitmap(blob);
        try {
          context.clearRect(0, 0, copy.width, copy.height);
          context.drawImage(image, 0, 0);
          const decoded = { data: context.getImageData(0, 0, copy.width, copy.height).data, width: copy.width, height: copy.height };
          return { bytes: blob.size, mime: blob.type, comparison: compareShaderPixels(capturedPixels, decoded) };
        } finally { image.close(); }
      },
      resume() { frozen?.resume(); frozen = undefined; },
      async restore(state: LiveMaterialFrameState, timeMs: number | null, remount = true) {
        frozen?.resume();
        frozen = undefined;
        await restore(state, timeMs, remount);
        await nextPaint();
        await waitForLiveMaterialReady(root, 30_000);
        await nextPaint();
        return harness.read();
      },
    };
    const target = window as typeof window & { glyphfieldShaderFrames?: typeof harness };
    target.glyphfieldShaderFrames = harness;
    return () => {
      frozen?.resume();
      if (target.glyphfieldShaderFrames === harness) delete target.glyphfieldShaderFrames;
    };
  }, [materialId, restore, rootRef]);
  return null;
}
