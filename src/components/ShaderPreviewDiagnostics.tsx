'use client';

import { useEffect, useRef } from 'react';

import { waitForLiveMaterialReady } from '@/lib/liveMaterialReadiness';
import { readShaderDiagnostics } from '@/lib/shaderDiagnostics';
import { compareShaderPixels, readShaderPixels, summarizeShaderPixels, type ShaderPixels } from '@/lib/shaderPixelReadback';

async function digestPixels(data: Uint8ClampedArray) {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(data));
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('');
}

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

/** Explicit diagnostic surface. Never loaded by normal Studio/landing rendering. */
export default function ShaderPreviewDiagnostics({
  captureTimeMs, materialId, rootRef, setCaptureTimeMs,
}: {
  captureTimeMs: number;
  materialId: string;
  rootRef: { current: HTMLElement | null };
  setCaptureTimeMs: (time: number) => void;
}) {
  const committedTime = useRef(captureTimeMs);
  const pendingCommits = useRef<{ resolve: () => void; time: number }[]>([]);
  useEffect(() => {
    committedTime.current = captureTimeMs;
    const completed = pendingCommits.current.filter((commit) => commit.time === captureTimeMs);
    pendingCommits.current = pendingCommits.current.filter((commit) => commit.time !== captureTimeMs);
    completed.forEach((commit) => commit.resolve());
  }, [captureTimeMs]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let previous: ShaderPixels | null = null;
    const startedAt = performance.now();
    const harness = {
      async ready(timeoutMs = 15_000) {
        await waitForLiveMaterialReady(root, timeoutMs);
        await nextPaint();
        // A removed loading marker with no mounted renderer is not readiness.
        readShaderPixels(root);
        return { materialId, readinessMs: performance.now() - startedAt };
      },
      async read() {
        const pixels = readShaderPixels(root);
        const comparison = previous ? compareShaderPixels(previous, pixels) : null;
        previous = pixels;
        return {
          captureTimeMs: committedTime.current,
          comparison,
          diagnostics: readShaderDiagnostics(root),
          materialId,
          pixels: { ...summarizeShaderPixels(pixels), sha256: await digestPixels(pixels.data) },
        };
      },
      async setTime(time: number) {
        if (!Number.isFinite(time) || time < 0 || time > 120_000) throw new Error('Capture time must be between 0 and 120000ms.');
        if (time !== committedTime.current) {
          // React can commit after the caller's next rAF. Wait for the actual
          // passive-effect commit before waiting for the invalidated GPU draw.
          await new Promise<void>((resolve) => {
            pendingCommits.current.push({ resolve, time });
            setCaptureTimeMs(time);
          });
        }
        await nextPaint();
        await waitForLiveMaterialReady(root);
      },
    };
    const diagnosticWindow = window as typeof window & { glyphfieldShaderPreview?: typeof harness };
    diagnosticWindow.glyphfieldShaderPreview = harness;
    return () => {
      if (diagnosticWindow.glyphfieldShaderPreview === harness) delete diagnosticWindow.glyphfieldShaderPreview;
    };
  }, [materialId, rootRef, setCaptureTimeMs]);
  return null;
}
