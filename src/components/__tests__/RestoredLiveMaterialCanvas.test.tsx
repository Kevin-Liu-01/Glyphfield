// @vitest-environment happy-dom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RestoredLiveMaterialCanvas, { type RestoredLiveMaterialCanvasProps } from '@/components/RestoredLiveMaterialCanvas';
import type { LiveMaterialCanvasProps } from '@/components/LiveMaterialCanvas';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';

const observed = vi.hoisted(() => ({ props: {} as LiveMaterialCanvasProps, mounts: 0 }));
vi.mock('@/components/LazyLiveMaterialCanvas', () => ({ default: (props: LiveMaterialCanvasProps) => {
  observed.props = props;
  useEffect(() => { observed.mounts++; }, []);
  return <canvas data-live-material-ready='false' />;
} }));

describe('source timeline restoration before native playback', () => {
  let host: HTMLDivElement;
  let root: Root;
  let rafs: Map<number, FrameRequestCallback>;
  let serial: number;
  let onRestoreReady: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    rafs = new Map(); serial = 0; observed.mounts = 0; onRestoreReady = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { rafs.set(++serial, callback); return serial; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => rafs.delete(id));
    host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
  async function render(overrides: Partial<RestoredLiveMaterialCanvasProps> = {}, key = 'source-1') {
    await act(async () => root.render(<RestoredLiveMaterialCanvas key={key} materialId='shaders-drift'
      settings={DEFAULT_LIVE_MATERIAL_SETTINGS} captureTimeMs={null} paused={false}
      restoreTimeMs={1250} holdRestoredPlayback={false} onRestoreReady={onRestoreReady} {...overrides} />));
  }
  async function paint() {
    await act(async () => { const pending = [...rafs.values()]; rafs.clear(); pending.forEach((callback) => callback(100)); });
  }
  async function ready() {
    await act(async () => { host.querySelector('canvas')!.dataset.liveMaterialReady = 'true'; await new Promise((resolve) => setTimeout(resolve, 0)); });
    await paint(); await paint();
  }
  it('holds an imported playing timeline at its actual timestamp until the native draw is ready', async () => {
    await render();
    expect(observed.props.captureTimeMs).toBe(1250);
    expect(observed.props.paused).toBe(true);
    expect(host.querySelector('[data-shader-time-restoring="true"]')).not.toBeNull();
    await paint(); await paint();
    expect(onRestoreReady).not.toHaveBeenCalled();
    await ready();
    expect(onRestoreReady).toHaveBeenCalledOnce();
    expect(observed.props.captureTimeMs).toBeNull();
    expect(observed.props.paused).toBe(false);
  });
  it('preserves the native anchor and pointer while sampling an imported timeline offset', async () => {
    const frameState = { engine: 'webgl' as const, version: 2 as const, frame: 812.25, timelineTimeMs: 400, pointer: { x: 0.2, y: 0.7 } };
    await render({ frameState });
    expect(observed.props.frameState).toBe(frameState);
    expect(observed.props.captureTimeMs).toBe(1250);
  });
  it('releases all ready layers together, not while another source shader is still loading', async () => {
    await render({ holdRestoredPlayback: true }); await ready();
    expect(onRestoreReady).toHaveBeenCalledOnce();
    expect(observed.props.captureTimeMs).toBe(1250);
    await render({ restoreTimeMs: undefined });
    expect(observed.props.captureTimeMs).toBeNull();
    expect(observed.mounts).toBe(1);
  });
  it('same-ID source reapply reseeds the phase but normal edits and export do not remount', async () => {
    await render(); await ready();
    await render({ restoreTimeMs: undefined, captureTimeMs: 1500, paused: true });
    expect(observed.props.captureTimeMs).toBe(1500);
    await render({ restoreTimeMs: undefined });
    expect(observed.mounts).toBe(1);
    expect(observed.props.captureTimeMs).toBeNull();
    await render({}, 'source-2');
    expect(observed.mounts).toBe(2);
    expect(observed.props.captureTimeMs).toBe(1250);
  });
  it('never fabricates timestamp replay for Fluid', async () => {
    await render({ materialId: 'pavel-fluid-energy' });
    expect(observed.props.captureTimeMs).toBeNull();
    expect(observed.props.paused).toBe(true);
    await ready();
    expect(observed.props.paused).toBe(false);
  });
  it('does not seed an ordinary renderer remount after durable capture', async () => {
    await render({ restoreTimeMs: undefined });
    expect(observed.props.captureTimeMs).toBeNull();
    expect(observed.props.paused).toBe(false);
    expect(onRestoreReady).not.toHaveBeenCalled();
  });
  it('never reseeds a released renderer when a different shader begins loading', async () => {
    await render(); await ready();
    await render({ restoreTimeMs: undefined, holdRestoredPlayback: true });
    expect(observed.props.captureTimeMs).toBeNull();
    expect(observed.mounts).toBe(1);
    expect(onRestoreReady).toHaveBeenCalledOnce();
  });
  it('never releases failed or unmounted source restoration', async () => {
    await render();
    await act(async () => { host.querySelector('canvas')!.dataset.liveMaterialReady = 'error'; });
    await paint(); await paint();
    expect(observed.props.paused).toBe(true);
    expect(onRestoreReady).not.toHaveBeenCalled();
    await act(async () => root.render(null)); await paint(); await paint();
    expect(onRestoreReady).not.toHaveBeenCalled();
  });
});
