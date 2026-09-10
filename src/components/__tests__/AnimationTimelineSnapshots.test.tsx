// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AnimationTimelinePreview from '@/components/AnimationTimelinePreview';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';
import { renderFrame, type StudioSource } from '@/lib/renderFrame';
import { DEFAULT_SETTINGS } from '@/lib/studio';

vi.mock('@/lib/renderFrame', () => ({ renderFrame: vi.fn() }));

describe('shared frozen Animation timeline shader snapshots', () => {
  let host: HTMLDivElement;
  let nativeHost: HTMLDivElement;
  let root: Root;
  let copy: ReturnType<typeof vi.fn>;
  let context: CanvasRenderingContext2D;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    copy = vi.fn();
    context = {
      clearRect() {}, fillRect() {}, save() {}, restore() {}, translate() {}, scale() {}, drawImage: copy,
    } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    host = document.body.appendChild(document.createElement('div'));
    nativeHost = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    nativeHost.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function nativeCanvas(width = 960, height = 540) {
    const canvas = nativeHost.appendChild(document.createElement('canvas'));
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function sources(image: HTMLCanvasElement, colorA = '#000000'): StudioSource[] {
    return Array.from({ length: 4 }, (_, index) => ({
      id: `text-${index}`, kind: 'text', text: `Frame ${index}`, background: {
        style: 'shader', image, materialId: 'paper-dithering-swirl', angle: 0, opacity: 1,
        colorA, colorB: '#ffffff', colorC: '#eeeeee', materialSettings: DEFAULT_LIVE_MATERIAL_SETTINGS,
        shaderPresentation: { filter: 'brightness(1.2)', grainOpacity: 0.2 },
      },
    }));
  }

  async function cards(currentSources: StudioSource[]) {
    await act(async () => root.render(<>{currentSources.flatMap((_, index) => (
      ['frame', 'transition'] as const
    ).map((kind) => <AnimationTimelinePreview index={index} key={`${index}-${kind}`} kind={kind}
      layout='tooltip' settings={DEFAULT_SETTINGS} sources={currentSources} />))}</>));
  }

  function renderedImages() {
    return vi.mocked(renderFrame).mock.calls.flatMap(([, currentSources]) => currentSources.map(({ background }) => background?.image));
  }

  it('copies one native shader only once for four frame cards and four transition cards', async () => {
    const native = nativeCanvas();
    await cards(sources(native));
    expect(renderFrame).toHaveBeenCalledTimes(8);
    expect(copy).toHaveBeenCalledExactlyOnceWith(native, 0, 0, 400, 225);
    const frozen = renderedImages()[0];
    expect(frozen).not.toBe(native);
    expect(renderedImages().every((image) => image === frozen)).toBe(true);
    expect(vi.mocked(renderFrame).mock.calls[0]?.[1][0]?.background?.shaderPresentation)
      .toEqual({ filter: 'brightness(1.2)', grainOpacity: 0.2 });
  });

  it('keeps equal-appearance native canvases independent, including within a transition', async () => {
    const first = nativeCanvas();
    const second = nativeCanvas();
    const currentSources = sources(first);
    currentSources[1] = sources(second)[1]!;
    await cards(currentSources);
    expect(copy).toHaveBeenCalledTimes(2);
    const transition = vi.mocked(renderFrame).mock.calls[1]![1];
    expect(transition[0]!.background!.image).not.toBe(transition[1]!.background!.image);
  });

  it('invalidates changed intrinsic dimensions without mutating the prior shared snapshot', async () => {
    const native = nativeCanvas();
    await cards(sources(native));
    const prior = renderedImages()[0] as HTMLCanvasElement;
    native.width = 480;
    native.height = 480;
    vi.mocked(renderFrame).mockClear();
    await cards(sources(native));
    expect(copy).toHaveBeenCalledTimes(2);
    const resized = renderedImages()[0] as HTMLCanvasElement;
    expect(resized).not.toBe(prior);
    expect([resized.width, resized.height]).toEqual([400, 400]);
    expect([prior.width, prior.height]).toEqual([400, 225]);
  });

  it('recaptures appearance changes and keeps only the current variant per native canvas', async () => {
    const native = nativeCanvas();
    await cards(sources(native));
    const prior = renderedImages()[0];
    await cards(sources(native, '#ff0000'));
    await cards(sources(native));
    expect(copy).toHaveBeenCalledTimes(3);
    expect(renderedImages().at(-1)).not.toBe(prior);
  });

  it('does not resample advancing native pixels or recapture a bitmap after another card unmounts', async () => {
    const native = nativeCanvas();
    await cards(sources(native));
    const frozen = renderedImages()[0];
    await act(async () => root.render(null));
    native.dataset.simulatedLiveFrame = '1000';
    await cards(sources(native));
    expect(copy).toHaveBeenCalledOnce();
    expect(renderedImages().at(-1)).toBe(frozen);
  });

  it('does not cache zero-sized native buffers', async () => {
    const native = nativeCanvas(0, 0);
    await cards(sources(native));
    expect(copy).not.toHaveBeenCalled();
    expect(renderedImages().every((image) => image === undefined)).toBe(true);
    native.width = 200;
    native.height = 100;
    await cards(sources(native));
    expect(copy).toHaveBeenCalledExactlyOnceWith(native, 0, 0, 200, 100);
  });

  it('does not cache failed bitmap copies and retries a later draw', async () => {
    const native = nativeCanvas();
    copy.mockImplementation(() => { throw new Error('Native canvas unavailable'); });
    await cards(sources(native));
    expect(renderedImages().every((image) => image === undefined)).toBe(true);
    copy.mockReset();
    await cards(sources(native));
    expect(copy).toHaveBeenCalledOnce();
    expect(renderedImages().at(-1)).toBeInstanceOf(HTMLCanvasElement);
  });

  it('does not cache an unavailable destination context', async () => {
    const native = nativeCanvas();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
    await cards(sources(native));
    expect(copy).not.toHaveBeenCalled();
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(context);
    await cards(sources(native));
    expect(copy).toHaveBeenCalledOnce();
    expect(renderedImages().at(-1)).toBeInstanceOf(HTMLCanvasElement);
  });

  it.each(['false', 'error'])('does not freeze a %s native canvas and redraws after actual readiness changes', async (readiness) => {
    const native = nativeCanvas();
    nativeHost.dataset.liveMaterialSurface = 'paper-dithering-swirl';
    nativeHost.dataset.liveMaterialReady = readiness;
    await cards(sources(native));
    expect(copy).not.toHaveBeenCalled();
    expect(renderedImages().every((image) => image === undefined)).toBe(true);
    await act(async () => { nativeHost.dataset.liveMaterialReady = 'true'; });
    expect(copy).toHaveBeenCalledExactlyOnceWith(native, 0, 0, 400, 225);
    expect(renderedImages().at(-1)).toBeInstanceOf(HTMLCanvasElement);
  });

  it('invalidates a previously ready snapshot during native recovery before recapturing', async () => {
    const native = nativeCanvas();
    nativeHost.dataset.liveMaterialSurface = 'paper-dithering-swirl';
    nativeHost.dataset.liveMaterialReady = 'true';
    await cards(sources(native));
    const previous = renderedImages()[0];
    await act(async () => { nativeHost.dataset.liveMaterialReady = 'false'; });
    expect(renderedImages().at(-1)).toBeUndefined();
    expect(copy).toHaveBeenCalledOnce();
    await act(async () => { nativeHost.dataset.liveMaterialReady = 'true'; });
    expect(copy).toHaveBeenCalledTimes(2);
    expect(renderedImages().at(-1)).not.toBe(previous);
  });
});
