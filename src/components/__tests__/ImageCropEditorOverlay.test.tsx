// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ImageCropEditorOverlay from '@/components/ImageCropEditorOverlay';

describe('ImageCropEditorOverlay', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 30, 200, 100));
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('exposes the source image and supports precise keyboard crop positioning', async () => {
    const onChange = vi.fn();
    const onDone = vi.fn();
    const onPreview = vi.fn();
    await act(() => root.render(
      <ImageCropEditorOverlay
        crop={{ enabled: true, focalPointX: 0.5, focalPointY: 0.5, zoom: 1 }}
        label='Campaign photo'
        onChange={onChange}
        onDone={onDone}
        onPreview={onPreview}
        sourcePreview={<span data-testid='formatted-source'>Formatted source</span>}
        url='data:image/png;base64,AA=='
      />
    ));

    const editor = container.querySelector<HTMLElement>('[role="application"]')!;
    const measure = container.querySelector<HTMLImageElement>('.image-crop-editor-overlay__measure')!;
    Object.defineProperties(measure, {
      naturalHeight: { configurable: true, value: 800 },
      naturalWidth: { configurable: true, value: 1_600 },
    });
    await act(() => measure.dispatchEvent(new Event('load')));
    expect(editor.getAttribute('aria-label')).toContain('inside the blue frame');
    const source = container.querySelector<HTMLElement>('.image-crop-editor-overlay__source')!;
    expect(source.hasAttribute('data-image-crop-source')).toBe(true);
    expect(source.querySelector('[data-testid="formatted-source"]')).not.toBeNull();
    expect(source.style.width).toBe('800px');
    expect(source.style.height).toBe('400px');

    await act(() => editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })));
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ focalPointX: 0.51 }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ focalPointX: 0.51 }));

    await act(() => editor.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('converts pointer movement from the zoomed viewport into authored layer coordinates', async () => {
    const onChange = vi.fn();
    const onPreview = vi.fn();
    await act(() => root.render(
      <ImageCropEditorOverlay
        crop={{ enabled: true, focalPointX: 0.5, focalPointY: 0.5, zoom: 2 }}
        label='Campaign photo'
        onChange={onChange}
        onDone={vi.fn()}
        onPreview={onPreview}
        url='data:image/png;base64,AA=='
      />
    ));

    const editor = container.querySelector<HTMLElement>('[role="application"]')!;
    const measure = container.querySelector<HTMLImageElement>('.image-crop-editor-overlay__measure')!;
    Object.defineProperties(editor, {
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      setPointerCapture: { configurable: true, value: vi.fn() },
    });
    Object.defineProperties(measure, {
      naturalHeight: { configurable: true, value: 800 },
      naturalWidth: { configurable: true, value: 1_600 },
    });
    await act(() => measure.dispatchEvent(new Event('load')));

    await act(() => editor.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
      clientY: 50,
      isPrimary: true,
      pointerId: 7,
    })));
    await act(() => editor.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: 150,
      clientY: 50,
      isPrimary: true,
      pointerId: 7,
    })));
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ focalPointX: 0.25 }));

    await act(() => editor.dispatchEvent(new PointerEvent('pointerup', {
      bubbles: true,
      clientX: 150,
      clientY: 50,
      isPrimary: true,
      pointerId: 7,
    })));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ focalPointX: 0.25 }));
  });

  it('commits the visible crop when pointer capture ends before pointer up', async () => {
    const onChange = vi.fn();
    const onDone = vi.fn();
    const onPreview = vi.fn();
    await act(() => root.render(
      <ImageCropEditorOverlay
        crop={{ enabled: true, focalPointX: 0.5, focalPointY: 0.5, zoom: 2 }}
        label='Campaign photo'
        onChange={onChange}
        onDone={onDone}
        onPreview={onPreview}
        url='data:image/png;base64,AA=='
      />
    ));

    const editor = container.querySelector<HTMLElement>('[role="application"]')!;
    const measure = container.querySelector<HTMLImageElement>('.image-crop-editor-overlay__measure')!;
    Object.defineProperties(editor, {
      hasPointerCapture: { configurable: true, value: vi.fn(() => false) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
      setPointerCapture: { configurable: true, value: vi.fn() },
    });
    Object.defineProperties(measure, {
      naturalHeight: { configurable: true, value: 800 },
      naturalWidth: { configurable: true, value: 1_600 },
    });
    await act(() => measure.dispatchEvent(new Event('load')));

    await act(() => editor.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
      clientY: 50,
      isPrimary: true,
      pointerId: 9,
    })));
    await act(() => editor.dispatchEvent(new PointerEvent('pointermove', {
      bubbles: true,
      clientX: 150,
      clientY: 50,
      isPrimary: true,
      pointerId: 9,
    })));
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ focalPointX: 0.25 }));
    expect(onChange).not.toHaveBeenCalled();

    await act(() => editor.dispatchEvent(new PointerEvent('lostpointercapture', {
      bubbles: true,
      isPrimary: true,
      pointerId: 9,
    })));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ focalPointX: 0.25 }));

    await act(() => editor.querySelector<HTMLButtonElement>('.image-crop-editor-overlay__done')!.click());
    expect(onDone).toHaveBeenCalledOnce();
  });
});
