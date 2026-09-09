// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ShaderFrameImage from '@/components/ShaderFrameImage';
import { acquireShaderFrameAssetUrl, type ShaderFrameSnapshot } from '@/lib/shaderFrameAssets';
import { preloadShaderFramePresentation } from '@/lib/shaderFramePresentation';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';
import { previewLiveMaterialPatternScale, previewLiveMaterialSettings } from '@/lib/liveMaterialPreview';
import type { LiveMaterialCanvasProps } from '@/components/LiveMaterialCanvas';

vi.mock('@/lib/shaderFrameAssets', () => ({ acquireShaderFrameAssetUrl: vi.fn() }));
vi.mock('@/lib/shaderFramePresentation', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/shaderFramePresentation')>(),
  preloadShaderFramePresentation: vi.fn(async () => {}),
}));

const snapshot: ShaderFrameSnapshot = { assetId: `shader-frame:${'a'.repeat(64)}`, height: 6, version: 1, width: 8 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('ShaderFrameImage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let release: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.clearAllMocks();
    release = vi.fn();
    vi.mocked(acquireShaderFrameAssetUrl).mockResolvedValue({ url: 'blob:frame-a', release });
    vi.mocked(preloadShaderFramePresentation).mockResolvedValue();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render(value = snapshot, withChildren = false) {
    await act(async () => {
      root.render(<ShaderFrameImage snapshot={value}>{withChildren ? <canvas data-native-retained='true' /> : undefined}</ShaderFrameImage>);
    });
  }

  function image() {
    const element = container.querySelector<HTMLImageElement>('img');
    if (!element) throw new Error('Missing captured image.');
    Object.defineProperties(element, { naturalWidth: { configurable: true, value: 8 }, naturalHeight: { configurable: true, value: 6 } });
    element.decode = vi.fn(async () => {});
    return element;
  }

  async function load(element: HTMLImageElement) {
    await act(async () => { element.dispatchEvent(new Event('load')); });
  }

  it('keeps the shared skeleton until the correct full-box PNG has decoded', async () => {
    await render();
    expect(container.querySelector('[data-shader-skeleton="loading"]')).not.toBeNull();
    expect(container.querySelector('[data-live-material-ready="false"]')).not.toBeNull();
    const element = image();
    expect(element.style.objectFit).toBe('fill');
    expect(element.style.maxWidth).toBe('none');
    await load(element);
    expect(element.decode).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-live-material-ready="true"]')).not.toBeNull();
    expect(container.querySelector('[data-shader-skeleton]')).toBeNull();
    expect(acquireShaderFrameAssetUrl).toHaveBeenCalledWith(snapshot.assetId);
  });

  it('retains native paused pixels through URL loading and decoding, then releases that child', async () => {
    const pending = deferred<{ url: string; release: () => void }>();
    vi.mocked(acquireShaderFrameAssetUrl).mockReturnValueOnce(pending.promise);
    await act(async () => root.render(<ShaderFrameImage><canvas data-native-retained='true' /></ShaderFrameImage>));
    await render(snapshot, true);
    const native = container.querySelector('canvas');
    expect(native).not.toBeNull();
    expect(container.querySelector('[data-shader-skeleton]')).toBeNull();
    await act(async () => { pending.resolve({ url: 'blob:frame-a', release }); });
    expect(container.querySelector('canvas')).toBe(native);
    const element = image();
    const decode = deferred<void>();
    element.decode = vi.fn(() => decode.promise);
    await load(element);
    expect(container.querySelector('canvas')).toBe(native);
    await act(async () => { decode.resolve(); });
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-shader-frame-ready="true"]')).not.toBeNull();
  });

  it('preserves the same native canvas when the always-mounted wrapper switches from live to captured', async () => {
    const live = <canvas data-native-retained='true' data-live-material-ready='true' />;
    await act(async () => { root.render(<ShaderFrameImage>{live}</ShaderFrameImage>); });
    const native = container.querySelector('canvas');
    expect(container.firstElementChild?.hasAttribute('data-live-material-ready')).toBe(false);
    expect(acquireShaderFrameAssetUrl).not.toHaveBeenCalled();
    await act(async () => { root.render(<ShaderFrameImage snapshot={snapshot}>{live}</ShaderFrameImage>); });
    expect(container.querySelector('canvas')).toBe(native);
    await load(image());
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('invariant_the_retained_native_renderer_is_paused_during_capture_handoff', async () => {
    function Native({ paused }: Pick<LiveMaterialCanvasProps, 'paused' | 'settings'>) {
      return <canvas data-paused={String(paused)} />;
    }
    const live = <Native paused={false} settings={DEFAULT_LIVE_MATERIAL_SETTINGS} />;
    await act(async () => root.render(<ShaderFrameImage>{live}</ShaderFrameImage>));
    const native = container.querySelector('canvas');
    expect(native?.dataset.paused).toBe('false');
    await act(async () => root.render(<ShaderFrameImage snapshot={snapshot}>{live}</ShaderFrameImage>));
    expect(container.querySelector('canvas')).toBe(native);
    expect(native?.dataset.paused).toBe('true');
    await load(image());
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('holds the decoded frame and URL lease until resumed native rendering is ready', async () => {
    await render(snapshot, true);
    const previousImage = image();
    await load(previousImage);
    await act(async () => {
      root.render(<ShaderFrameImage><canvas data-live-material-ready='false' /></ShaderFrameImage>);
    });
    const native = container.querySelector('canvas')!;
    expect(container.querySelector('img')).toBe(previousImage);
    expect(release).not.toHaveBeenCalled();
    expect(container.querySelector<HTMLElement>('[data-shader-frame-live-view]')?.style.opacity).toBe('0');
    await act(async () => {
      native.dataset.liveMaterialReady = 'true';
      await new Promise((resolve) => setTimeout(resolve, 70));
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('canvas')).toBe(native);
    expect(release).toHaveBeenCalledOnce();
    expect(container.querySelector<HTMLElement>('[data-shader-frame-live-view]')?.style.opacity).toBe('1');
  });

  it('releases the acquired lease once when the consumer unmounts', async () => {
    await render();
    await act(async () => { root.render(null); });
    expect(release).toHaveBeenCalledOnce();
  });

  it('releases a late stale acquisition and never displays it over the newly selected frame', async () => {
    const pending = deferred<{ url: string; release: () => void }>();
    const staleRelease = vi.fn();
    vi.mocked(acquireShaderFrameAssetUrl).mockReturnValueOnce(pending.promise);
    await render();
    const next = { ...snapshot, assetId: `shader-frame:${'b'.repeat(64)}` };
    await render(next);
    await act(async () => { pending.resolve({ url: 'blob:stale', release: staleRelease }); });
    expect(staleRelease).toHaveBeenCalledOnce();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:frame-a');
    expect(container.querySelector('[data-shader-frame-asset-id]')?.getAttribute('data-shader-frame-asset-id')).toBe(next.assetId);
  });

  it('ignores a previous image decode after its snapshot has changed', async () => {
    await render();
    const previous = image();
    const pending = deferred<void>();
    previous.decode = vi.fn(() => pending.promise);
    await load(previous);
    vi.mocked(acquireShaderFrameAssetUrl).mockResolvedValueOnce({ url: 'blob:next', release: vi.fn() });
    await render({ ...snapshot, assetId: `shader-frame:${'b'.repeat(64)}` });
    await act(async () => { pending.resolve(); });
    expect(release).toHaveBeenCalledOnce();
    expect(container.querySelector('[data-shader-frame-ready="true"]')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:next');
  });

  it('uses only the shared unavailable skeleton when storage fails', async () => {
    vi.mocked(acquireShaderFrameAssetUrl).mockRejectedValueOnce(new Error('Missing stored PNG.'));
    await render();
    expect(container.querySelector('[data-shader-skeleton="unavailable"]')).not.toBeNull();
    expect(container.querySelector('[data-live-material-ready="error"]')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('invariant_a_saved_image_decode_failure_never_mounts_native_children', async () => {
    await render(snapshot, true);
    expect(container.querySelector('canvas')).toBeNull();
    await act(async () => { image().dispatchEvent(new Event('error')); });
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-shader-skeleton="unavailable"]')).not.toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toContain('could not be loaded');
    expect(container.querySelector('[data-live-material-ready="error"]')).not.toBeNull();
  });

  it('invariant_a_saved_asset_storage_failure_does_not_start_a_new_shader', async () => {
    const mounts = vi.fn();
    function Native() {
      mounts();
      return <canvas />;
    }
    vi.mocked(acquireShaderFrameAssetUrl).mockRejectedValueOnce(new Error('Missing stored PNG.'));
    await act(async () => root.render(<ShaderFrameImage snapshot={snapshot}><Native /></ShaderFrameImage>));
    expect(mounts).not.toHaveBeenCalled();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-shader-skeleton="unavailable"]')).not.toBeNull();
  });

  it('invariant_a_ready_saved_frame_does_not_remount_native_after_an_image_error', async () => {
    await render(snapshot, true);
    const storedImage = image();
    await load(storedImage);
    expect(container.querySelector('canvas')).toBeNull();
    await act(async () => storedImage.dispatchEvent(new Event('error')));
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-shader-skeleton="unavailable"]')).not.toBeNull();
  });

  it('invariant_a_failed_live_to_capture_handoff_shows_unavailable_without_restarting_motion', async () => {
    await act(async () => root.render(<ShaderFrameImage><canvas data-native-retained='true' /></ShaderFrameImage>));
    await render(snapshot, true);
    const native = container.querySelector('canvas');
    expect(native).not.toBeNull();
    await act(async () => image().dispatchEvent(new Event('error')));
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('[data-shader-skeleton="unavailable"]')).not.toBeNull();
  });

  it('rejects an empty/wrong-sized decoded image instead of marking it ready', async () => {
    await render();
    const element = image();
    Object.defineProperty(element, 'naturalWidth', { value: 9 });
    await load(element);
    expect(container.querySelector('[data-live-material-ready="error"]')).not.toBeNull();
  });

  it('replays the whole-group filter and square grain tile scale', async () => {
    await render({ ...snapshot, presentation: { filter: 'brightness(0.8) contrast(1.2)', grainOpacity: 0.2, grainTileSize: 4 } });
    await load(image());
    expect(image().parentElement?.style.filter).toBe('brightness(0.8) contrast(1.2)');
    const grain = container.querySelector<HTMLElement>('.paper-material-grain');
    expect(grain?.style.backgroundSize).toBe('50% auto');
    expect(grain?.style.mixBlendMode).toBe('soft-light');
    expect(grain?.style.opacity).toBe('0.2');
  });

  it('rejects unsafe presentation before acquiring any asset', async () => {
    await render({ ...snapshot, presentation: { filter: 'url(https://example.com/filter.svg)' } });
    expect(acquireShaderFrameAssetUrl).not.toHaveBeenCalled();
    expect(container.querySelector('[data-live-material-ready="error"]')).not.toBeNull();
  });

  it('seeds the first edited native frame while keeping the saved PNG and recipe untouched', async () => {
    const draws = vi.fn();
    function Native({ settings, patternScale, previewChannel }: Pick<LiveMaterialCanvasProps, 'settings' | 'patternScale' | 'previewChannel'>) {
      draws(settings);
      return <canvas data-color={settings.colorA} data-scale={patternScale} data-channel={previewChannel} data-live-material-ready='false' />;
    }
    const settings = { ...DEFAULT_LIVE_MATERIAL_SETTINGS };
    const originalSnapshot = structuredClone(snapshot);
    const originalSettings = structuredClone(settings);
    const live = <Native settings={settings} patternScale={1} previewChannel='canvas-one' />;
    await act(async () => root.render(<ShaderFrameImage previewChannel='canvas-one' snapshot={snapshot}>{live}</ShaderFrameImage>));
    await load(image());
    expect(container.querySelector('canvas')).toBeNull();

    const frames = new Map<number, FrameRequestCallback>();
    let sequence = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++sequence, callback); return sequence; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
    const paint = async () => {
      await act(async () => {
        const pending = [...frames.values()];
        frames.clear();
        pending.forEach((callback) => callback(performance.now()));
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    };
    const count = draws.mock.calls.length;
    previewLiveMaterialSettings('another-layer', { colorA: '#00ff00' });
    await paint();
    expect(container.querySelector('canvas')).toBeNull();
    previewLiveMaterialSettings('canvas-one', { colorA: '#ff0000' });
    previewLiveMaterialSettings('canvas-one', { colorA: '#ff3300', strength: 0.8 });
    previewLiveMaterialPatternScale('canvas-one', 1.8);
    await paint();
    const native = container.querySelector('canvas')!;
    expect(draws).toHaveBeenCalledTimes(count + 1);
    expect(native.dataset.color).toBe('#ff3300');
    expect(native.dataset.scale).toBe('1.8');
    expect(native.hasAttribute('data-channel')).toBe(false);
    expect(container.querySelector('[data-shader-frame-editing="true"]')).not.toBeNull();
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector<HTMLElement>('[data-shader-frame-live-view]')?.style.opacity).toBe('0');

    await act(async () => {
      native.dataset.liveMaterialReady = 'true';
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await paint();
    expect(container.querySelector('img')).not.toBeNull();
    await paint();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('canvas')).toBe(native);
    expect(container.querySelector('[data-shader-frame-preview-revision]')).not.toBeNull();
    expect(snapshot).toEqual(originalSnapshot);
    expect(settings).toEqual(originalSettings);

    previewLiveMaterialSettings('canvas-one', { colorA: '#6633ff' });
    await paint();
    expect(container.querySelector('canvas')).toBe(native);
    expect(native.dataset.color).toBe('#6633ff');
    await act(async () => root.render(<ShaderFrameImage previewChannel='canvas-one'>
      <Native settings={{ ...settings, colorA: '#6633ff', strength: 0.8 }} patternScale={1.8} previewChannel='canvas-one' />
    </ShaderFrameImage>));
    expect(container.querySelector('canvas')).toBe(native);
    expect(native.dataset.color).toBe('#6633ff');
    expect(native.dataset.channel).toBe('canvas-one');
    expect(container.querySelector('[data-shader-frame-editing]')).toBeNull();

    // Reopening even the same stored asset must discard the transient preview.
    await act(async () => root.render(<ShaderFrameImage previewChannel='canvas-one' snapshot={{ ...snapshot }}>{live}</ShaderFrameImage>));
    expect(container.querySelector('canvas')?.dataset.color).toBe(settings.colorA);
    await load(image());
    expect(container.querySelector('canvas')).toBeNull();
  });
});
