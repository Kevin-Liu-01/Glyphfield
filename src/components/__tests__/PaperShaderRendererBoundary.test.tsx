// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import PaperShaderRendererBoundary from '@/components/PaperShaderRendererBoundary';
import { loadPaperShaderRenderer, readPaperShaderRenderer } from '@/components/paperShaderRegistry';
import type { PaperShaderRenderer } from '@/components/paperShaderRenderer';
import type { PaperShaderFamilyId } from '@/lib/liveMaterials';

vi.mock('@/components/paperShaderRegistry', () => ({ loadPaperShaderRenderer: vi.fn(), readPaperShaderRenderer: vi.fn() }));

describe('Paper family loading readiness', () => {
  let host: HTMLDivElement;
  let root: Root;
  let ready: Map<PaperShaderFamilyId, PaperShaderRenderer>;
  let pending: Map<PaperShaderFamilyId, { resolve: (renderer: PaperShaderRenderer) => void; reject: (error: Error) => void }>;
  const renderer: PaperShaderRenderer = { component: () => null, presets: [{ name: 'Default', params: {} }] };

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    ready = new Map([['dithering', renderer], ['grain-gradient', renderer]]);
    pending = new Map();
    vi.mocked(readPaperShaderRenderer).mockImplementation((family) => ready.get(family));
    vi.mocked(loadPaperShaderRenderer).mockImplementation((family) => new Promise((resolve, reject) => pending.set(family, { resolve, reject })));
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });
  afterEach(() => { act(() => root.unmount()); host.remove(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

  async function render(family: PaperShaderFamilyId, timeMs = 0) {
    await act(async () => root.render(<PaperShaderRendererBoundary family={family}>
      {() => <canvas data-live-material-ready='false' data-time={timeMs} />}
    </PaperShaderRendererBoundary>));
  }
  async function resolve(family: PaperShaderFamilyId) {
    await act(async () => { ready.set(family, renderer); pending.get(family)!.resolve(renderer); });
  }

  it('renders the landing families immediately without requesting additional code', async () => {
    await render('dithering');
    expect(host.querySelector('canvas')).not.toBeNull();
    await render('grain-gradient');
    expect(loadPaperShaderRenderer).not.toHaveBeenCalled();
  });

  it('keeps loading unexportable and uses the latest seek when the real renderer arrives', async () => {
    await render('gem-smoke', 1250);
    expect(host.querySelector('[data-live-material-ready="false"]')).not.toBeNull();
    expect(host.querySelector('canvas')).toBeNull();
    await render('gem-smoke', 2500);
    expect(loadPaperShaderRenderer).toHaveBeenCalledOnce();
    await resolve('gem-smoke');
    expect(host.querySelector('canvas')?.dataset.time).toBe('2500');
    expect(host.querySelector('[data-live-material-ready="true"]')).toBeNull();
  });

  it('does not mount an old family after selection changes or the owner unmounts', async () => {
    await render('gem-smoke');
    await render('water');
    await resolve('gem-smoke');
    expect(host.querySelector('canvas')).toBeNull();
    await act(async () => root.render(null));
    await resolve('water');
    expect(host.childElementCount).toBe(0);
  });

  it('reports a failed import as unavailable rather than a ready fallback', async () => {
    await render('gem-smoke');
    await act(async () => pending.get('gem-smoke')!.reject(new Error('Offline')));
    expect(host.querySelector('[data-live-material-ready="error"]')).not.toBeNull();
    expect(host.querySelector('canvas')).toBeNull();
    await render('dithering');
    expect(host.querySelector('canvas')).not.toBeNull();
  });
});
