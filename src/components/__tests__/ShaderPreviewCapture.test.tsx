// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ShaderPreviewCapture from '@/components/ShaderPreviewCapture';

const renderer = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
vi.mock('@/components/LazyLiveMaterialCanvas', () => ({ default: (props: Record<string, unknown>) => { renderer.props = props; return <canvas />; } }));
vi.mock('@/components/ShaderPreviewDiagnostics', () => ({ default: () => <span data-pixel-harness /> }));

describe('shader capture and opt-in live benchmark isolation', () => {
  let host: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

  it.each([
    { diagnostics: false, livePlayback: false, live: false },
    { diagnostics: false, livePlayback: true, live: false },
    { diagnostics: true, livePlayback: false, live: false },
    { diagnostics: true, livePlayback: true, live: true },
  ])('keeps motion opt-in for $diagnostics / $livePlayback', async ({ diagnostics, livePlayback, live }) => {
    await act(async () => root.render(<ShaderPreviewCapture diagnostics={diagnostics} livePlayback={livePlayback} materialId='paper-gem-smoke' />));
    expect(renderer.props.captureTimeMs).toBe(live ? null : 1600);
    expect(renderer.props.paused).toBe(!live);
    expect(renderer.props.diagnostics).toBe(diagnostics && !live);
    expect(host.querySelector('main')?.dataset.shaderPlayback).toBe(live ? 'live' : 'captured');
    expect(Boolean(host.querySelector('[data-pixel-harness]'))).toBe(diagnostics && !live);
  });
});
