// @vitest-environment happy-dom

import { act, createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AnimationStudio from '@/components/AnimationStudio';
import { normalizeAnimationAudioState, type AnimationAudioState } from '@/lib/animationAudio';
import { renderFrame, type StudioSource } from '@/lib/renderFrame';
import StudioControls from '@/components/StudioControls';
import { DEFAULT_SETTINGS } from '@/lib/studio';
import { createAnimationCanvasDocument } from '@/lib/animationDocument';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import type { CanvasActionHistory } from '@/components/CanvasViewport';
import { serializeCanvasDocument } from '@/lib/canvasDocument';
import { DesignVersionFileActions, DesignVersionHeaderControls, DesignVersionHistory, DesignVersionProvider, type DesignVersionControlsProps } from '@/components/DesignVersionControls';

vi.mock('gt-next', () => ({ T: ({ children }: { children: ReactNode }) => children, useGT: () => (text: string) => text }));
vi.mock('@/hooks/useCachedGT', () => {
  const translate = (text: string) => text;
  return { useCachedGT: () => translate };
});
vi.mock('@/hooks/usePersistentState', () => ({
  useStudioDraft: (_identity: string, _tool: string, _key: string, initial: unknown) => useState(initial),
}));
vi.mock('@/hooks/usePortableCanvasWorkspace', () => ({
  usePortableCanvasWorkspace: vi.fn(() => ({ autosaveState: 'saved', source: null })),
}));
vi.mock('@/lib/animationDocument', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/animationDocument')>();
  return { ...original, createAnimationCanvasDocument: vi.fn(original.createAnimationCanvasDocument) };
});
vi.mock('@/lib/animationAudio', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/animationAudio')>();
  return { ...original, normalizeAnimationAudioState: vi.fn(original.normalizeAnimationAudioState) };
});
vi.mock('@/components/StudioExportProgress', () => ({ useStudioExportProgress: () => ({ start() {}, update() {}, finish() {} }) }));
vi.mock('@/components/CanvasViewport', () => ({ default: ({ actionHistory, children }: {
  actionHistory?: CanvasActionHistory; children: ReactNode;
}) => <div data-canvas-viewport><div data-canvas-history>{actionHistory ? <>
  <button aria-label='Undo' disabled={!actionHistory.canUndo} onClick={actionHistory.onUndo}>Undo</button>
  <button aria-label='Redo' disabled={!actionHistory.canRedo} onClick={actionHistory.onRedo}>Redo</button>
</> : null}</div>{children}</div> }));
vi.mock('@/components/CanvasDimensionHandles', () => ({ default: () => null }));
vi.mock('@/components/ArtboardSizeMenu', () => ({ default: () => null }));
vi.mock('@/components/AnimationStudioFeedback', () => ({ AnimationError: () => null, AnimationSourceDrawer: () => null }));
vi.mock('@/components/DesignVersionControls', () => {
  const Context = createContext(false);
  const Provider = vi.fn(({ children }: DesignVersionControlsProps & { children: ReactNode }) => <Context.Provider value><div data-version-provider>{children}</div></Context.Provider>);
  const FileActions = vi.fn(() => {
    if (!useContext(Context)) throw new Error('Missing saved-version provider');
    return <div data-version-file-actions />;
  });
  const History = vi.fn(() => {
    if (!useContext(Context)) throw new Error('Missing saved-version provider');
    return <div data-version-history />;
  });
  const HeaderControls = vi.fn(() => {
    if (!useContext(Context)) throw new Error('Missing saved-version provider');
    return <div data-version-header-controls>
      <span data-version-status />
      <div data-version-file-actions />
      <div data-version-history />
    </div>;
  });
  return {
    default: (props: DesignVersionControlsProps) => <Provider {...props}><FileActions /><History /></Provider>,
    DesignVersionFileActions: FileActions,
    DesignVersionHeaderControls: HeaderControls,
    DesignVersionHistory: History,
    DesignVersionProvider: Provider,
    DesignVersionStatus: () => <span data-version-status />,
  };
});
vi.mock('@/components/EditableCanvasLayer', () => ({ default: ({ label }: { label: string }) => <div data-editable-target={label} /> }));
vi.mock('@/components/ExportPreview', () => ({ default: () => null }));
vi.mock('@/components/SourceCodeDrawer', () => ({ SourceCodeButton: () => null }));
vi.mock('@/components/StudioControls', () => ({
  default: vi.fn(({ onFrameSettingsChange, onSelectSequenceBackground, onSelectSourceBackground, onSelectTransition, onSettingsChange, panel, selectedEffectTarget, selectedSource, selectedTransitionIndex, sources }: {
    onFrameSettingsChange: (patch: { fontSize: number }) => void;
    onSelectSequenceBackground: () => void;
    onSelectSourceBackground: (id: string) => void;
    onSelectTransition: (index: number) => void;
    onSettingsChange: (patch: { loop: boolean }) => void;
    panel: string;
    selectedEffectTarget: string;
    selectedSource: StudioSource | null;
    selectedTransitionIndex: number | null;
    sources: StudioSource[];
  }) => <div data-effect-target={selectedEffectTarget} data-selection-panel={panel} data-selected-source={selectedSource?.id ?? ''} data-selected-transition={selectedTransitionIndex ?? ''} data-source-fonts={JSON.stringify(sources.map(({ id, fontSize }) => ({ id, fontSize })))}>
    {panel === 'properties' ? <>
      <button data-edit-current onClick={() => onFrameSettingsChange({ fontSize: 84 })}>Edit displayed scene</button>
      <button data-select-background onClick={() => onSelectSourceBackground('text-1')}>Select scene background</button>
      <button data-select-transition onClick={() => onSelectTransition(0)}>Select transition</button>
      <button data-select-sequence onClick={onSelectSequenceBackground}>Select sequence background</button>
      <button data-stop-loop onClick={() => onSettingsChange({ loop: false })}>Disable looping</button>
    </> : null}
  </div>),
}));
vi.mock('@/components/StudioToolHeader', () => ({ default: ({ actions }: { actions: ReactNode }) => <header data-studio-header>{actions}</header>, StudioToolbarGroup: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/ui/StudioContextMenu', () => ({ default: () => null }));
vi.mock('@/components/ui/StudioSelect', () => ({ default: () => null }));
vi.mock('@/components/LiveMaterialCanvas', () => ({
  default: ({ activeWhileMounted, enabled, paused }: { activeWhileMounted: boolean; enabled: boolean; paused: boolean }) => (
    <span data-renderer-enabled={String(enabled)} data-renderer-paused={String(paused)} data-renderer-retained={String(activeWhileMounted)}>{enabled ? <canvas /> : null}</span>
  ),
}));
vi.mock('@/components/TimelinePanel', () => ({
  default: ({ audio, isPlaying, onAudioFiles, onPlayChange, onSeek, onSelectTransition, selectedSourceId, subscribeToPlayhead }: {
    audio: AnimationAudioState;
    isPlaying: boolean;
    onAudioFiles: (files: FileList) => void;
    onPlayChange: (playing: boolean) => void;
    onSeek: (timeMs: number) => void;
    onSelectTransition: (index: number) => void;
    selectedSourceId: string | null;
    subscribeToPlayhead: (listener: (timeMs: number) => void) => () => void;
  }) => {
    const output = useRef<HTMLOutputElement>(null);
    useEffect(() => subscribeToPlayhead((timeMs) => {
      if (output.current) output.current.value = String(timeMs);
    }), [subscribeToPlayhead]);
    return <>
      <button data-playing={String(isPlaying)} onClick={() => onPlayChange(!isPlaying)}>Play or pause</button>
      <input aria-label='Audio file' onChange={(event) => { if (event.target.files) onAudioFiles(event.target.files); }} type='file' />
      <input aria-label='Seek preview' onChange={(event) => onSeek(Number(event.target.value))} type='range' max='20000' />
      <button data-timeline-transition onClick={() => {
        onSelectTransition(0);
        onSeek(DEFAULT_SETTINGS.holdMs + DEFAULT_SETTINGS.transitionMs / 2);
      }}>Inspect timeline transition</button>
      <output data-audio-assets={JSON.stringify(audio.assets)} data-clip-count={audio.clips.length} data-timeline-selection={selectedSourceId ?? ''} ref={output} />
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
    vi.mocked(usePortableCanvasWorkspace).mockReturnValue({
      autosaveState: 'saved', document: null, error: null, source: null, status: 'ready',
    });
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

  function selectedScene(panel = 'properties') {
    return container.querySelector(`[data-selection-panel=${panel}]`)!.getAttribute('data-selected-source');
  }

  function scrubTo(timeMs: number) {
    const input = container.querySelector<HTMLInputElement>('[aria-label="Seek preview"]')!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(timeMs));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
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
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Audio file"]')!;
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

  it('shares one saved-version owner for the complete header file cluster', async () => {
    await render(true);
    expect(container.querySelectorAll('[data-version-provider]')).toHaveLength(1);
    expect(container.querySelector('[data-canvas-history] [data-version-history]')).toBeNull();
    const headerControls = container.querySelector('[data-version-header-controls]')!;
    expect(headerControls.closest('[data-studio-header]')).not.toBeNull();
    expect(headerControls.querySelector('[data-version-status]')).not.toBeNull();
    expect(headerControls.querySelector('[data-version-file-actions]')).not.toBeNull();
    expect(headerControls.querySelector('[data-version-history]')).not.toBeNull();
    const props = vi.mocked(DesignVersionProvider).mock.calls.at(-1)![0];
    expect(props).toMatchObject({
      collectionLabel: 'Saved animations', defaultName: 'Untitled animation',
      draftLabel: 'Autosaved animation', identityId: 'default', itemLabel: 'animation',
      layout: 'toolbar', toolId: 'animation', workspaceLabel: 'Animation Studio',
    });
    expect(props.autosaveState).toBeDefined();
    expect(props.onNew).toBeTypeOf('function');
    expect(props.onOpen).toBeTypeOf('function');
    expect(props.source).toBeTypeOf('function');
    expect(createAnimationCanvasDocument).toHaveBeenCalled();
    expect(vi.mocked(usePortableCanvasWorkspace).mock.calls.at(-1)?.[0].document).not.toBeNull();
    expect(container.querySelector('[data-studio-header]')).not.toBeNull();
    expect(DesignVersionHeaderControls).toHaveBeenCalled();
  });

  it('undoes and redoes a real scene edit without resetting the animation', async () => {
    await render(true);
    togglePlayback();
    const readFonts = () => container.querySelector('[data-selection-panel=properties]')!.getAttribute('data-source-fonts');
    const before = readFonts();
    act(() => container.querySelector<HTMLButtonElement>('[data-edit-current]')!.click());
    const edited = readFonts();
    expect(edited).not.toBe(before);
    const undo = container.querySelector<HTMLButtonElement>('[aria-label=Undo]')!;
    expect(undo.disabled).toBe(false);
    act(() => undo.click());
    expect(readFonts()).toBe(before);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label=Redo]')!.click());
    expect(readFonts()).toBe(edited);
    expect(playing()).toBe('false');
  });

  it('does not record pre-hydration changes when source preparation overlaps autosave loading', async () => {
    vi.mocked(usePortableCanvasWorkspace).mockReturnValue({
      autosaveState: 'loading', document: null, error: null, source: null, status: 'preparing',
    });
    await render(true);
    togglePlayback();
    act(() => vi.mocked(StudioControls).mock.calls.at(-1)![0].onFrameSettingsChange({ fontSize: 84 }));
    act(() => vi.mocked(StudioControls).mock.calls.at(-1)![0].onFrameSettingsChange({ fontSize: 96 }));
    expect(vi.mocked(DesignVersionProvider).mock.calls.at(-1)![0].autosaveState).toBe('preparing');
    expect(container.querySelector<HTMLButtonElement>('[aria-label=Undo]')!.disabled).toBe(true);

    vi.mocked(usePortableCanvasWorkspace).mockReturnValue({
      autosaveState: 'saved', document: null, error: null, source: null, status: 'ready',
    });
    await render(false);
    expect(container.querySelector<HTMLButtonElement>('[aria-label=Undo]')!.disabled).toBe(true);
    act(() => vi.mocked(StudioControls).mock.calls.at(-1)![0].onFrameSettingsChange({ fontSize: 108 }));
    expect(container.querySelector<HTMLButtonElement>('[aria-label=Undo]')!.disabled).toBe(false);
  });

  it('keeps the inspector on a restored scene when undo removes the newly selected scene', async () => {
    await render(true);
    togglePlayback();
    const before = vi.mocked(StudioControls).mock.calls.at(-1)![0].sources;
    act(() => vi.mocked(StudioControls).mock.calls.at(-1)![0].onAddText());
    const addedId = selectedScene();
    expect(before.some(({ id }) => id === addedId)).toBe(false);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label=Undo]')!.click());
    expect(selectedScene()).toBe(before[0].id);
    expect(vi.mocked(StudioControls).mock.calls.at(-1)![0].sources).toHaveLength(before.length);
    act(() => container.querySelector<HTMLButtonElement>('[aria-label=Redo]')!.click());
    expect(selectedScene()).toBe(before[0].id);
    expect(vi.mocked(StudioControls).mock.calls.at(-1)![0].sources).toHaveLength(before.length + 1);
  });

  it('leaves the current animation untouched when an imported image fails to decode', async () => {
    await render(true);
    const input = vi.mocked(createAnimationCanvasDocument).mock.calls.at(-1)![0];
    const before = vi.mocked(StudioControls).mock.calls.at(-1)![0].sources;
    const document = createAnimationCanvasDocument({ ...input,
      state: { ...input.state, textFrames: 'Should not apply' },
      sources: [...input.sources, { kind: 'image', id: 'broken-image', name: 'Broken', width: 1, height: 1,
        image: window.document.createElement('img'), url: 'data:image/png;base64,AQ==' }],
    });
    vi.stubGlobal('Image', class { src = ''; decode = () => Promise.reject(new Error('Image decode failed')); });
    const onOpen = vi.mocked(DesignVersionProvider).mock.calls.at(-1)![0].onOpen;
    await act(async () => {
      await expect(onOpen(serializeCanvasDocument(document))).rejects.toThrow('Image decode failed');
    });
    expect(vi.mocked(StudioControls).mock.calls.at(-1)![0].sources).toEqual(before);
  });

  it('leaves the current animation untouched when an imported font fails to decode', async () => {
    await render(true);
    const input = vi.mocked(createAnimationCanvasDocument).mock.calls.at(-1)![0];
    const before = vi.mocked(StudioControls).mock.calls.at(-1)![0].sources;
    const project = createAnimationCanvasDocument({ ...input,
      state: { ...input.state, textFrames: 'Should not apply', identity: {
        id: input.brandId, name: 'Imported project',
        fonts: [{ family: 'Broken Font', fileName: 'broken.woff2', format: 'woff2', id: 'broken-font',
          label: 'Broken font', path: 'data:font/woff2;base64,AQ==', style: 'normal', weight: 400 }],
        typography: [{ family: 'Broken Font', fontId: 'broken-font', role: 'Display', usage: 'Headings' }],
      } },
    });
    const load = vi.fn(() => Promise.reject(new Error('Font decode failed')));
    vi.stubGlobal('FontFace', class { load = load; });
    const onOpen = vi.mocked(DesignVersionProvider).mock.calls.at(-1)![0].onOpen;
    await act(async () => {
      await expect(onOpen(serializeCanvasDocument(project))).rejects.toThrow('Font decode failed');
    });
    expect(load).toHaveBeenCalledOnce();
    expect(vi.mocked(StudioControls).mock.calls.at(-1)![0].sources).toEqual(before);
  });

  it('uses the authored initial font weight before the first control render', async () => {
    await act(async () => root.render(<AnimationStudio autoPlay embedded initialFontWeight={350} presentationMode />));
    expect(vi.mocked(StudioControls).mock.calls[0]?.[0].settings.fontWeight).toBe(350);
  });

  it('does not clone empty audio state at startup or when a silent timeline changes duration', async () => {
    await render(true, true, true, true);
    expect(normalizeAnimationAudioState).not.toHaveBeenCalled();
    await act(async () => vi.mocked(StudioControls).mock.calls.at(-1)![0].onSettingsChange({ holdMs: 2_000 }));
    expect(normalizeAnimationAudioState).not.toHaveBeenCalled();
    expect(container.querySelector('output')?.getAttribute('data-clip-count')).toBe('0');
  });

  it('keeps the landing presentation outside saved-version state and UI while autoplay remains live', async () => {
    await render(true, true, true, true);
    expect(DesignVersionProvider).not.toHaveBeenCalled();
    expect(DesignVersionFileActions).not.toHaveBeenCalled();
    expect(DesignVersionHeaderControls).not.toHaveBeenCalled();
    expect(DesignVersionHistory).not.toHaveBeenCalled();
    expect(container.querySelector('[data-version-provider]')).toBeNull();
    expect(container.querySelector('[data-studio-header]')).toBeNull();
    expect(createAnimationCanvasDocument).not.toHaveBeenCalled();
    expect(vi.mocked(usePortableCanvasWorkspace).mock.calls.at(-1)?.[0].document).toBeNull();
    advanceFrame();
    advanceFrame();
    expect(playing()).toBe('true');
    expect(time()).toBeGreaterThan(0);
    act(() => container.querySelector<HTMLButtonElement>('[data-playing]')!.click());
    act(() => container.querySelector<HTMLButtonElement>('[data-edit-current]')!.click());
    expect(container.querySelector('[data-selection-panel="properties"]')?.getAttribute('data-source-fonts')).toContain('"fontSize":84');
    expect(createAnimationCanvasDocument).not.toHaveBeenCalled();
  });

  it('still honors reduced motion in the source-free landing presentation', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    await render(true, true, true, true);
    advanceFrame();
    advanceFrame();
    expect(playing()).toBe('false');
    expect(time()).toBe(0);
    expect(container.querySelector('[data-renderer-paused]')?.getAttribute('data-renderer-paused')).toBe('true');
    expect(createAnimationCanvasDocument).not.toHaveBeenCalled();
  });

  it('tracks the displayed scene in the inspector and both scene lists during autoplay without per-frame parent renders', async () => {
    await render(true);
    advanceFrame();
    expect(selectedScene()).toBe('text-0');
    const holdRenderCount = vi.mocked(StudioControls).mock.calls.length;
    for (let index = 0; index < 5; index += 1) advanceFrame();
    expect(vi.mocked(StudioControls).mock.calls.length).toBe(holdRenderCount);
    for (let index = 0; index < 25; index += 1) advanceFrame();
    const rendered = vi.mocked(renderFrame).mock.calls.at(-1)!;
    expect(rendered[1][rendered[3].index].id).toBe('text-1');
    expect(selectedScene()).toBe('text-1');
    expect(selectedScene('source')).toBe('text-1');
    expect(container.querySelector('output')?.getAttribute('data-timeline-selection')).toBe('text-1');
    togglePlayback();
    expect(selectedScene()).toBe('text-1');
    expect(container.querySelector('[data-editable-target]')?.getAttribute('data-editable-target')).toBe('Bienvenidos');
  });

  it('makes a paused scrub select and edit the displayed hold instead of the prior scene', async () => {
    await render(true);
    advanceFrame();
    togglePlayback();
    scrubTo(DEFAULT_SETTINGS.holdMs + DEFAULT_SETTINGS.transitionMs);
    advanceFrame();
    expect(selectedScene()).toBe('text-1');
    expect(container.querySelector('[data-editable-target]')?.getAttribute('data-editable-target')).toBe('Bienvenidos');
    act(() => container.querySelector<HTMLButtonElement>('[data-edit-current]')!.click());
    const fonts = JSON.parse(container.querySelector('[data-selection-panel=properties]')!.getAttribute('data-source-fonts')!) as { id: string; fontSize: number }[];
    expect(fonts.find(({ id }) => id === 'text-1')?.fontSize).toBe(84);
    expect(fonts.find(({ id }) => id === 'text-0')?.fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    scrubTo(DEFAULT_SETTINGS.holdMs + DEFAULT_SETTINGS.transitionMs / 2);
    advanceFrame();
    expect(container.querySelector('[data-editable-target]')).toBeNull();
    expect(selectedScene()).toBe('');
    expect(container.querySelector('[data-selection-panel=properties]')?.getAttribute('data-selected-transition')).toBe('0');
    act(() => container.querySelector<HTMLButtonElement>('[data-timeline-transition]')!.click());
    expect(selectedScene()).toBe('');
    expect(container.querySelector('[data-selection-panel=properties]')?.getAttribute('data-selected-transition')).toBe('0');
  });

  it('preserves explicit scene-background, transition and sequence-background inspection', async () => {
    await render(true);
    act(() => container.querySelector<HTMLButtonElement>('[data-select-background]')!.click());
    expect(playing()).toBe('false');
    expect(selectedScene()).toBe('text-1');
    expect(container.querySelector('[data-selection-panel=properties]')?.getAttribute('data-effect-target')).toBe('background');
    act(() => container.querySelector<HTMLButtonElement>('[data-select-transition]')!.click());
    expect(selectedScene()).toBe('');
    expect(container.querySelector('[data-selection-panel=properties]')?.getAttribute('data-selected-transition')).toBe('0');
    act(() => container.querySelector<HTMLButtonElement>('[data-select-sequence]')!.click());
    expect(selectedScene()).toBe('');
    expect(container.querySelector('[data-selection-panel=properties]')?.getAttribute('data-selected-transition')).toBe('');
    expect(container.querySelector('[data-selection-panel=properties]')?.getAttribute('data-effect-target')).toBe('background');
    togglePlayback();
    expect(selectedScene()).toBe('text-0');
    expect(container.querySelector('[data-selection-panel=properties]')?.getAttribute('data-effect-target')).toBe('content');
  });

  it('keeps selection aligned with the final rendered frame when playback stops without looping', async () => {
    await render(true);
    act(() => container.querySelector<HTMLButtonElement>('[data-stop-loop]')!.click());
    for (let index = 0; index < 130; index += 1) advanceFrame(100);
    expect(playing()).toBe('false');
    const rendered = vi.mocked(renderFrame).mock.calls.at(-1)!;
    expect(selectedScene()).toBe(rendered[1][rendered[3].index].id);
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

  it('discards an old audio decode after opening a project that reuses the asset id', async () => {
    const { context } = mockAudioContext();
    type Buffer = Awaited<ReturnType<typeof context.decodeAudioData>>;
    let finishOldDecode!: (buffer: Buffer) => void;
    const oldDecode = new Promise<Buffer>((resolve) => { finishOldDecode = resolve; });
    const buffer = (duration: number): Buffer => ({
      duration, getChannelData: () => new Float32Array(96), length: 96, numberOfChannels: 1,
    });
    context.decodeAudioData.mockImplementationOnce(() => oldDecode).mockResolvedValue(buffer(2));
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
    await render(true);
    const input = vi.mocked(createAnimationCanvasDocument).mock.calls.at(-1)![0];
    const makeProject = (source: string) => serializeCanvasDocument(createAnimationCanvasDocument({ ...input,
      state: { ...input.state, audio: {
        assets: [{ id: 'shared-audio', durationMs: 2000, mimeType: 'audio/wav', name: 'Score', peaks: [0.2], source }],
        clips: [{ id: 'clip', assetId: 'shared-audio', timelineStartMs: 0, trimStartMs: 0, trimEndMs: 1000, volume: 1 }],
        muted: false, volume: 1,
      } },
    }));
    const openProject = async (source: string) => {
      await act(async () => vi.mocked(DesignVersionProvider).mock.calls.at(-1)![0].onOpen(source));
    };
    await openProject(makeProject('data:audio/wav;base64,AQ=='));
    togglePlayback();
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledOnce());
    await openProject(makeProject('data:audio/wav;base64,Ag=='));
    const readAudio = () => container.querySelector('output')!.getAttribute('data-audio-assets');
    const replacement = readAudio();
    await act(async () => { finishOldDecode(buffer(5)); await oldDecode; });
    expect(readAudio()).toBe(replacement);
    await act(async () => container.querySelector<HTMLButtonElement>('button[data-playing]')!.click());
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(fetch).toHaveBeenCalledWith('data:audio/wav;base64,Ag==');
      expect(context.decodeAudioData.mock.calls.length).toBeGreaterThan(1);
    });
    expect(readAudio()).toBe(replacement);
  });
});
