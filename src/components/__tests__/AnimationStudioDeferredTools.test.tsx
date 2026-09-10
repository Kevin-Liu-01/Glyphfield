// @vitest-environment happy-dom

import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const deferred = vi.hoisted(() => ({
  loaded: [] as string[],
  source: '{"version":1}',
  gif: vi.fn(),
  mp4: vi.fn(),
  shader: vi.fn(),
}));

vi.mock('gt-next', () => ({ T: ({ children }: { children: ReactNode }) => children, useGT: () => (text: string) => text }));
vi.mock('@/hooks/useCachedGT', () => {
  const translate = (text: string) => text;
  return { useCachedGT: () => translate };
});
vi.mock('@/hooks/usePersistentState', () => ({ useStudioDraft: (_identity: string, _tool: string, _key: string, initial: unknown) => useState(initial) }));
vi.mock('@/hooks/usePortableCanvasWorkspace', () => ({ usePortableCanvasWorkspace: () => ({ autosaveState: 'saved', source: deferred.source }) }));
vi.mock('@/components/StudioExportProgress', () => ({ useStudioExportProgress: () => ({ start() {}, update() {}, finish() {} }) }));
vi.mock('@/components/CanvasViewport', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/CanvasDimensionHandles', () => ({ default: () => null }));
vi.mock('@/components/AnimationCanvasSelection', () => ({ default: () => null }));
vi.mock('@/components/StudioArtboardBar', () => ({ default: () => null }));
vi.mock('@/components/DesignVersionControls', () => ({
  DesignVersionFileActions: () => null, DesignVersionHeaderControls: () => null, DesignVersionHistory: () => null, DesignVersionStatus: () => null,
  DesignVersionProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/EditableCanvasLayer', () => ({ default: () => null }));
vi.mock('@/components/StudioControls', () => ({ default: ({ sources }: { sources: { text?: string }[] }) => <output data-scenes>{sources.map(({ text }) => text).join('|')}</output> }));
vi.mock('@/components/StudioToolHeader', () => ({
  default: ({ actions, context }: { actions: ReactNode; context: ReactNode }) => <header>{context}{actions}</header>,
  StudioToolbarGroup: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/components/LiveMaterialCanvas', () => ({ default: () => null }));
vi.mock('@/components/TimelinePanel', () => ({ default: () => null }));
vi.mock('@/lib/renderFrame', async (original) => ({ ...await original<typeof import('@/lib/renderFrame')>(), renderFrame: vi.fn() }));
vi.mock('@/lib/shaderFramePresentation', () => ({ preloadShaderFramePresentation: () => Promise.resolve() }));
vi.mock('@/components/SourceCodeDrawer', () => {
  deferred.loaded.push('source');
  return {
    SourceCodeButton: ({ onClick }: { onClick: () => void }) => <button onClick={onClick}>Edit source code</button>,
    default: ({ onClose, source }: { onClose: () => void; source: string }) => <section aria-label='Loaded source editor'><output>{source}</output><button onClick={onClose}>Close source</button></section>,
  };
});
vi.mock('@/components/ExportPreview', () => {
  deferred.loaded.push('preview');
  return { default: ({ asset }: { asset: { blob: Blob; format: string } | null }) => asset ? <output aria-label='Exported artifact'>{asset.format}:{asset.blob.size}</output> : null };
});
vi.mock('@/lib/animationShaderExport', () => {
  deferred.loaded.push('shader-export');
  return { createAnimationShaderExport: deferred.shader };
});
vi.mock('@/lib/exportGif', () => {
  deferred.loaded.push('gif');
  return { exportGif: deferred.gif };
});
vi.mock('@/lib/canvasExport', () => {
  deferred.loaded.push('mp4');
  return { encodeCanvasMp4: deferred.mp4 };
});

describe('Animation Studio on-demand source and export tools', () => {
  let AnimationStudio: typeof import('@/components/AnimationStudio')['default'];
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.resetModules();
    deferred.loaded.length = 0;
    deferred.source = '{"version":1}';
    vi.clearAllMocks();
    deferred.gif.mockResolvedValue(new Blob(['GIF89a'], { type: 'image/gif' }));
    deferred.mp4.mockResolvedValue(new Blob(['ftypmp42'], { type: 'video/mp4' }));
    deferred.shader.mockImplementation((sources) => ({
      sources, captureEntryPose: () => ({ states: new Map(), release() {} }), refresh: async () => undefined, dispose() {},
    }));
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.stubGlobal('requestAnimationFrame', () => 1);
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect() {}, save() {}, scale() {}, restore() {}, setTransform() {} } as unknown as CanvasRenderingContext2D);
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    // Keep the cold editor dependency graph in setup, not the interaction's
    // deadline. Each test still evaluates a fresh graph to detect eager tools.
    ({ default: AnimationStudio } = await import('@/components/AnimationStudio'));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount() {
    // Flush the source debounce in React's scope without sleeping for an
    // assumed wall-clock delay or leaving its update outside act().
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      await act(async () => root.render(<AnimationStudio embedded />));
      await act(async () => { await vi.runOnlyPendingTimersAsync(); });
    } finally {
      vi.useRealTimers();
    }
    await waitForUi(() => expect(findButton('Edit source code')?.disabled).toBe(false));
  }

  function findButton(label: string) {
    return [...container.querySelectorAll('button')].find((element) => element.getAttribute('aria-label') === label || element.textContent === label);
  }

  async function waitForUi(assertReady: () => void) {
    await vi.waitFor(async () => {
      await act(async () => { await vi.dynamicImportSettled(); });
      assertReady();
    });
  }

  async function click(label: string) {
    const button = findButton(label);
    expect(button, `Missing ${label}`).toBeDefined();
    await act(async () => {
      button!.click();
      await vi.dynamicImportSettled();
    });
  }

  it('does not evaluate source, preview, or export implementations when mounting the editor', async () => {
    await mount();
    expect(deferred.loaded).toEqual([]);
  });

  it('keeps the public source adapter available and current without loading the Code drawer', async () => {
    await mount();
    expect(window.glyphfield?.studio.describe().source).toEqual({ apply: true, read: true });
    expect(window.glyphfield?.studio.readSource()).toBe('{"version":1}');
    deferred.source = '{"version":2}';
    await act(async () => root.render(<AnimationStudio embedded viewportVisible={false} />));
    expect(window.glyphfield?.studio.readSource()).toBe('{"version":2}');
    const commitFrames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => commitFrames.push(callback));
    await act(async () => {
      const applied = window.glyphfield!.studio.applySource({ textFrames: 'Fresh source' });
      await Promise.resolve();
      commitFrames.shift()!(performance.now());
      commitFrames.shift()!(performance.now());
      await applied;
    });
    expect(container.querySelector('[data-scenes]')?.textContent).toContain('Fresh source');
    expect(() => window.glyphfield!.studio.readSource()).toThrow('preparing');
    expect(deferred.loaded).toEqual([]);
  });

  it('loads source only on its first click and preserves source and close behavior', async () => {
    await mount();
    expect(deferred.loaded).not.toContain('source');
    await click('Edit source code');
    await waitForUi(() => expect(container.querySelector('[aria-label="Loaded source editor"] output')?.textContent).toBe('{"version":1}'));
    expect(deferred.loaded).toEqual(['source']);
    await click('Close source');
    expect(container.querySelector('[aria-label="Loaded source editor"]')).toBeNull();
  });

  it.each(['GIF', 'Export MP4'])('loads only the selected %s export path and displays its artifact', async (label) => {
    await mount();
    expect(deferred.loaded).toEqual([]);
    await click(label);
    const mp4 = label === 'Export MP4';
    await waitForUi(() => expect(container.querySelector('[aria-label="Exported artifact"]')?.textContent).toBe(mp4 ? 'MP4:8' : 'GIF:6'));
    expect(deferred.loaded).toContain(mp4 ? 'mp4' : 'gif');
    expect(deferred.loaded).not.toContain(mp4 ? 'gif' : 'mp4');
    expect(deferred.loaded).not.toContain('source');
    expect(deferred.shader).toHaveBeenCalledOnce();
    expect(mp4 ? deferred.mp4 : deferred.gif).toHaveBeenCalledOnce();
    expect(mp4 ? deferred.gif : deferred.mp4).not.toHaveBeenCalled();
  });
});
