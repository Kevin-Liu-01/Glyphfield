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
        url='data:image/png;base64,AA=='
      />
    ));

    const editor = container.querySelector<HTMLElement>('[role="application"]')!;
    expect(editor.getAttribute('aria-label')).toContain('inside the blue frame');
    expect(container.querySelector('.image-crop-editor-overlay__source')).not.toBeNull();

    await act(() => editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' })));
    expect(onPreview).toHaveBeenLastCalledWith(expect.objectContaining({ focalPointX: 0.51 }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ focalPointX: 0.51 }));

    await act(() => editor.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })));
    expect(onDone).toHaveBeenCalledOnce();
  });
});
