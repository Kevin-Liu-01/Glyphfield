// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';

import { liveMaterialReadinessStatus, shouldMountLiveMaterial, waitForLiveMaterialReady } from '@/lib/liveMaterialReadiness';

describe('live material capture readiness', () => {
  it('mounts an offscreen shader for capture while respecting inactive workspaces', () => {
    const offscreen = {
      activeWhileMounted: false,
      captureTimeMs: null,
      enabled: true,
      renderVisible: false,
      workspaceActive: true,
    };
    expect(shouldMountLiveMaterial(offscreen)).toBe(false);
    expect(shouldMountLiveMaterial({ ...offscreen, captureTimeMs: 0 })).toBe(true);
    expect(shouldMountLiveMaterial({ ...offscreen, captureTimeMs: 900, enabled: false })).toBe(false);
    expect(shouldMountLiveMaterial({ ...offscreen, captureTimeMs: 900, workspaceActive: false })).toBe(false);
  });

  it('distinguishes a loading graphics probe from an unavailable or failed renderer', () => {
    expect(liveMaterialReadinessStatus(true, null, false)).toBe('false');
    expect(liveMaterialReadinessStatus(true, false, false)).toBe('error');
    expect(liveMaterialReadinessStatus(false, null, true)).toBe('error');
    expect(liveMaterialReadinessStatus(true, true, false)).toBeUndefined();
  });

  it('does not capture mounted canvases while their lighting is loading', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-live-material-ready="false"><canvas width="400" height="300"></canvas></div>';
    let captured = false;
    const ready = waitForLiveMaterialReady(root).then(() => { captured = true; });

    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(captured).toBe(false);
    root.firstElementChild!.setAttribute('data-live-material-ready', 'true');
    await ready;
    expect(captured).toBe(true);
  });

  it('waits for every asynchronous shader in the composition', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-live-material-ready="false"></div><div data-live-material-ready="false"></div>';
    let captured = false;
    const ready = waitForLiveMaterialReady(root).then(() => { captured = true; });

    root.children[0]!.setAttribute('data-live-material-ready', 'true');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(captured).toBe(false);
    root.children[1]!.setAttribute('data-live-material-ready', 'true');
    await ready;
    expect(captured).toBe(true);
  });

  it('reports loading failure instead of exporting the incomplete frame', async () => {
    const root = document.createElement('div');
    root.dataset.liveMaterialReady = 'false';
    await expect(waitForLiveMaterialReady(root, 5)).rejects.toThrow('still loading');
  });

  it('does not delay already rendered or static surfaces', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-live-material-ready="true"><canvas></canvas></div><img alt="" />';
    await expect(waitForLiveMaterialReady(root)).resolves.toBeUndefined();
  });

  it('rejects a fallback image when WebGL cannot render the actual shader', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-live-material-ready="error"><img alt="Static fallback" /></div>';
    await expect(waitForLiveMaterialReady(root)).rejects.toThrow('could not render');
  });

  it('rejects when a loading provider switches to its error boundary fallback', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<div data-live-material-ready="false"></div>';
    const result = expect(waitForLiveMaterialReady(root)).rejects.toThrow('try exporting again');
    root.innerHTML = '<div data-live-material-ready="error"></div>';
    await result;
  });
});
