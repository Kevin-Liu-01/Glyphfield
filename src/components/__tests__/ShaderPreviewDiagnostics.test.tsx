// @vitest-environment happy-dom

import { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ShaderPreviewDiagnostics from '@/components/ShaderPreviewDiagnostics';

const readback = vi.hoisted(() => ({ value: 12 }));
vi.mock('@/lib/shaderPixelReadback', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/shaderPixelReadback')>(),
  readShaderPixels: () => ({ data: new Uint8ClampedArray([readback.value, 0, 0, 255]), height: 1, width: 1 }),
}));

type Harness = {
  read: () => Promise<{ captureTimeMs: number; comparison: { changedPixels: number } | null }>;
  ready: (timeoutMs?: number) => Promise<unknown>;
  setTime: (time: number) => Promise<void>;
};
const harnessWindow = window as typeof window & { glyphfieldShaderPreview?: Harness };

function Fixture() {
  const rootRef = useRef<HTMLElement>(null);
  const [time, setTime] = useState(1600);
  return <main ref={rootRef}>
    <output>{time}</output>
    <ShaderPreviewDiagnostics captureTimeMs={time} materialId='test-material' rootRef={rootRef} setCaptureTimeMs={setTime} />
  </main>;
}

describe('diagnostic harness commit/readiness lifecycle (not GPU pixel proof)', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  async function paint() {
    await act(async () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(16));
    });
  }
  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    readback.value = 12;
    await act(async () => root.render(<Fixture />));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    frames.clear();
    vi.unstubAllGlobals();
  });

  it('keeps the same public handle and previous pixels across a committed time edit', async () => {
    const harness = harnessWindow.glyphfieldShaderPreview!;
    expect((await harness.read()).comparison).toBeNull();
    let completed = false;
    let operation: Promise<void>;
    await act(async () => {
      operation = harness.setTime(2300).then(() => { completed = true; });
      expect(host.querySelector('output')!.textContent).toBe('1600');
      expect(completed).toBe(false);
    });
    expect(host.querySelector('output')!.textContent).toBe('2300');
    expect(harnessWindow.glyphfieldShaderPreview).toBe(harness);
    expect(completed).toBe(false);
    await paint();
    expect(completed).toBe(false);
    readback.value = 24;
    await paint();
    await operation!;
    expect(await harness.read()).toMatchObject({ captureTimeMs: 2300, comparison: { changedPixels: 1 } });
  });

  it('waits for the actual loading marker and rejects a readiness timeout', async () => {
    const pending = document.createElement('div');
    pending.dataset.liveMaterialReady = 'false';
    host.querySelector('main')!.append(pending);
    await expect(harnessWindow.glyphfieldShaderPreview!.ready(5)).rejects.toThrow('still loading');
    const ready = harnessWindow.glyphfieldShaderPreview!.ready();
    pending.dataset.liveMaterialReady = 'true';
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    await paint();
    await paint();
    await expect(ready).resolves.toMatchObject({ materialId: 'test-material' });
  });
});
