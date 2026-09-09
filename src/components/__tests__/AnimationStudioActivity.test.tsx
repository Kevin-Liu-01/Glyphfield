// @vitest-environment happy-dom

import { act, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AnimationStudio from '@/components/AnimationStudio';
import type { AnimationAudioState } from '@/lib/animationAudio';
import { renderFrame } from '@/lib/renderFrame';

vi.mock('gt-next', () => ({ T: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/hooks/useCachedGT', () => {
  const translate = (text: string) => text;
  return { useCachedGT: () => translate };
});
vi.mock('@/hooks/usePersistentState', () => ({
  useStudioDraft: (_identity: string, _tool: string, _key: string, initial: unknown) => useState(initial),
}));
vi.mock('@/hooks/usePortableCanvasWorkspace', () => ({
  usePortableCanvasWorkspace: () => ({ autosaveState: 'saved', source: null }),
}));
vi.mock('@/components/StudioExportProgress', () => ({ useStudioExportProgress: () => ({ start() {}, update() {}, finish() {} }) }));
vi.mock('@/components/CanvasViewport', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/components/CanvasDimensionHandles', () => ({ default: () => null }));
vi.mock('@/components/ArtboardSizeMenu', () => ({ default: () => null }));
vi.mock('@/components/AnimationStudioFeedback', () => ({ AnimationError: () => null, AnimationSourceDrawer: () => null }));
vi.mock('@/components/DesignVersionControls', () => ({ default: () => null }));
vi.mock('@/components/EditableCanvasLayer', () => ({ default: () => null }));
vi.mock('@/components/ExportPreview', () => ({ default: () => null }));
vi.mock('@/components/SourceCodeDrawer', () => ({ SourceCodeButton: () => null }));
vi.mock('@/components/StudioControls', () => ({ default: () => null }));
vi.mock('@/components/StudioToolHeader', () => ({ default: () => null }));
vi.mock('@/components/ui/StudioContextMenu', () => ({ default: () => null }));
vi.mock('@/components/ui/StudioSelect', () => ({ default: () => null }));
vi.mock('@/components/LiveMaterialCanvas', () => ({
  default: ({ activeWhileMounted, enabled, paused }: { activeWhileMounted: boolean; enabled: boolean; paused: boolean }) => (
    <span data-renderer-enabled={String(enabled)} data-renderer-paused={String(paused)} data-renderer-retained={String(activeWhileMounted)}>{enabled ? <canvas /> : null}</span>
  ),
}));
vi.mock('@/components/TimelinePanel', () => ({
  default: ({ audio, isPlaying, onAudioFiles, onPlayChange, subscribeToPlayhead }: {
    audio: AnimationAudioState;
    isPlaying: boolean;
    onAudioFiles: (files: FileList) => void;
    onPlayChange: (playing: boolean) => void;
    subscribeToPlayhead: (listener: (timeMs: number) => void) => () => void;
  }) => {
    const output = useRef<HTMLOutputElement>(null);
    useEffect(() => subscribeToPlayhead((timeMs) => {
      if (output.current) output.current.value = String(timeMs);
    }), [subscribeToPlayhead]);
    return <>
      <button data-playing={String(isPlaying)} onClick={() => onPlayChange(!isPlaying)}>Play or pause</button>
      <input aria-label='Audio file' onChange={(event) => { if (event.target.files) onAudioFiles(event.target.files); }} type='file' />
      <output data-clip-count={audio.clips.length} ref={output} />
    </>;
  },
}));
vi.mock('@/lib/shaderFramePresentation', () => ({ preloadShaderFramePresentation: () => Promise.resolve() }));
vi.mock('@/lib/renderFrame', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/renderFrame')>(), renderFrame: vi.fn(),
}));
vi.mock('@/lib/download', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/download')>(),
  blobToDataUrl: async (blob: Blob) => `data:${blob.type};base64,${btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())))}`,
}));

describe('Animation Studio viewport playback lifecycle', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let frames: Map<number, FrameRequestCallback>;
  let timestamp: number;
  let intersect: IntersectionObserverCallback;
  let visibility: DocumentVisibilityState;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    visibility = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    frames = new Map();
    timestamp = performance.now();
    let frameId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { intersect = callback; }
      observe() {}
      disconnect() {}
    });
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: vi.fn(), save: vi.fn(), scale: vi.fn(), restore: vi.fn(), setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const shaderBackground = { materialId: 'paper-dithering-warp', style: 'shader' } as const;

  async function render(viewportVisible: boolean, active = true, shader = false, presentationMode = false) {
    const props = { active, autoPlay: true, embedded: true, initialSequenceBackground: shader ? shaderBackground : undefined, presentationMode, viewportVisible };
    await act(async () => root.render(<AnimationStudio {...props} />));
  }

  function advanceFrame(elapsed = 50) {
    timestamp += elapsed;
    act(() => {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(timestamp));
    });
  }

  function time() { return Number(container.querySelector('output')?.value ?? 0); }
  function playing() { return container.querySelector('button[data-playing]')?.getAttribute('data-playing'); }
  function togglePlayback() {
    act(() => container.querySelector<HTMLButtonElement>('button[data-playing]')!.click());
  }

  function mockAudioContext() {
    const nodes: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[] = [];
    const gain = { connect: vi.fn(), gain: { value: 1 } };
    const context = {
      close: vi.fn(async () => undefined),
      createBufferSource: vi.fn(() => {
        const node = { connect: vi.fn(() => gain), playbackRate: { value: 1 }, start: vi.fn(), stop: vi.fn() };
        nodes.push(node);
        return node;
      }),
      createGain: () => gain,
      currentTime: 0,
      decodeAudioData: vi.fn(async () => ({ duration: 1, getChannelData: () => new Float32Array(96), length: 96, numberOfChannels: 1 })),
      destination: {},
      resume: vi.fn(async (): Promise<void> => undefined),
      state: 'running',
    };
    vi.stubGlobal('AudioContext', class { constructor() { return context; } });
    return { context, nodes };
  }

  async function importAudio() {
    const input = container.querySelector<HTMLInputElement>('input[type=file]')!;
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array([82, 73, 70, 70])], 'score.wav', { type: 'audio/wav' }));
    await act(async () => {
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(container.querySelector('output')?.getAttribute('data-clip-count')).toBe('1');
    });
  }

  it('preserves autoplay intent while offscreen and resumes the retained timeline without a time jump', async () => {
    await render(true);
    advanceFrame();
    advanceFrame();
    expect(playing()).toBe('true');
    expect(time()).toBeGreaterThan(0);
    const beforeHide = time();
    await render(false);
    const draws = vi.mocked(renderFrame).mock.calls.length;
    advanceFrame(5_000);
    expect(playing()).toBe('true');
    expect(time()).toBe(beforeHide);
    expect(renderFrame).toHaveBeenCalledTimes(draws);
    expect(frames.size).toBe(0);
    await render(true);
    advanceFrame(5_000);
    expect(time()).toBe(beforeHide);
    advanceFrame();
    expect(time()).toBe(beforeHide + 50);
    expect(playing()).toBe('true');
  });

  it('does no initial preview work offscreen, but preserves explicit user pause across later visibility changes', async () => {
    await render(false);
    advanceFrame();
    expect(renderFrame).not.toHaveBeenCalled();
    expect(time()).toBe(0);
    expect(playing()).toBe('true');
    await render(true);
    advanceFrame();
    advanceFrame();
    togglePlayback();
    expect(playing()).toBe('false');
    const pausedAt = time();
    await render(false);
    advanceFrame();
    await render(true);
    advanceFrame();
    advanceFrame();
    expect(playing()).toBe('false');
    expect(time()).toBe(pausedAt);
  });

  it('continues to stop playback for an explicit inactive tool, rather than treating it as scrolling', async () => {
    await render(true);
    advanceFrame();
    advanceFrame();
    await render(true, false);
    advanceFrame();
    expect(playing()).toBe('false');
    const stoppedAt = time();
    await render(true);
    advanceFrame();
    advanceFrame();
    expect(playing()).toBe('false');
    expect(time()).toBe(stoppedAt);
  });

  it('does not let a positive internal intersection override the external viewport gate', async () => {
    await render(false);
    act(() => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    advanceFrame();
    expect(renderFrame).not.toHaveBeenCalled();
    expect(time()).toBe(0);
  });

  it('disables offscreen shaders and restores their playing or paused state when shown', async () => {
    await render(true, true, true);
    const shader = () => container.querySelector('[data-renderer-enabled]')!;
    expect(shader().getAttribute('data-renderer-enabled')).toBe('true');
    expect(shader().getAttribute('data-renderer-paused')).toBe('false');
    await render(false, true, true);
    expect(shader().getAttribute('data-renderer-enabled')).toBe('false');
    expect(shader().getAttribute('data-renderer-paused')).toBe('true');
    await render(true, true, true);
    expect(shader().getAttribute('data-renderer-paused')).toBe('false');
    togglePlayback();
    await render(false, true, true);
    await render(true, true, true);
    expect(shader().getAttribute('data-renderer-enabled')).toBe('true');
    expect(shader().getAttribute('data-renderer-paused')).toBe('true');
  });

  it('retains the embedded presentation shader while paused offscreen, but releases an inactive tool', async () => {
    await render(true, true, true, true);
    const shader = () => container.querySelector('[data-renderer-enabled]')!;
    const canvas = shader().querySelector('canvas');
    expect(canvas).not.toBeNull();
    await render(false, true, true, true);
    expect(shader().getAttribute('data-renderer-enabled')).toBe('true');
    expect(shader().getAttribute('data-renderer-retained')).toBe('true');
    expect(shader().getAttribute('data-renderer-paused')).toBe('true');
    expect(shader().querySelector('canvas')).toBe(canvas);
    await render(true, true, true, true);
    expect(shader().querySelector('canvas')).toBe(canvas);
    expect(shader().getAttribute('data-renderer-paused')).toBe('false');
    await render(true, false, true, true);
    expect(shader().getAttribute('data-renderer-enabled')).toBe('false');
    expect(shader().querySelector('canvas')).toBeNull();
  });

  it('stops imported audio while hidden and resumes it without overriding an explicit pause', async () => {
    const { nodes } = mockAudioContext();
    await render(true);
    await importAudio();
    expect(nodes.at(-1)?.start).toHaveBeenCalledOnce();
    const playingNode = nodes.at(-1)!;
    await render(false);
    expect(playingNode.stop).toHaveBeenCalledOnce();
    const hiddenNodeCount = nodes.length;
    advanceFrame(5_000);
    expect(nodes).toHaveLength(hiddenNodeCount);
    await render(true);
    expect(nodes.length).toBeGreaterThan(hiddenNodeCount);
    togglePlayback();
    const pausedNodeCount = nodes.length;
    await render(false);
    await render(true);
    expect(nodes).toHaveLength(pausedNodeCount);
  });

  it('rejects an audio resume that finishes after the document becomes hidden', async () => {
    const { context, nodes } = mockAudioContext();
    let finishResume: () => void = () => undefined;
    const resumed = new Promise<void>((resolve) => { finishResume = resolve; });
    context.resume.mockImplementation(() => resumed);
    await render(true);
    await importAudio();
    expect(context.resume).toHaveBeenCalled();
    await act(async () => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
      finishResume();
      await resumed;
    });
    expect(nodes).toHaveLength(0);
    expect(playing()).toBe('true');
    await act(async () => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(nodes).toHaveLength(1);
  });
});
