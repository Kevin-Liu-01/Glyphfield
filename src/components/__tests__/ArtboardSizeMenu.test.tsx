// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ArtboardSizeMenu from '@/components/ArtboardSizeMenu';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('ArtboardSizeMenu', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
  });

  it('opens every shared preset and commits presets, names, and custom dimensions', () => {
    const onDimensionsChange = vi.fn();
    const onArtboardNameChange = vi.fn();
    act(() => root.render(
      <ArtboardSizeMenu
        artboardName='Launch frame'
        dimensions={{ height: 900, width: 1600 }}
        onArtboardNameChange={onArtboardNameChange}
        onDimensionsChange={onDimensionsChange}
      />
    ));

    const trigger = container.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]');
    if (!trigger) throw new Error('Missing size trigger');
    act(() => trigger.click());

    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Artboard setup"]');
    expect(dialog?.textContent).toContain('Wide');
    expect(dialog?.textContent).toContain('OG Social');
    expect(dialog?.textContent).toContain('Story');

    const ogPreset = [...dialog!.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.textContent?.includes('OG Social'));
    if (!ogPreset) throw new Error('Missing OG Social preset');
    act(() => ogPreset.click());
    expect(onDimensionsChange).toHaveBeenLastCalledWith({ height: 630, width: 1200 });

    const name = dialog!.querySelector<HTMLInputElement>('input:not([type="number"])');
    if (!name) throw new Error('Missing artboard name input');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(name, 'Social launch');
      name.dispatchEvent(new Event('input', { bubbles: true }));
      name.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onArtboardNameChange).toHaveBeenLastCalledWith('Social launch');

    const [width, height] = dialog!.querySelectorAll<HTMLInputElement>('input[type="number"]');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(width, '1234');
      width!.dispatchEvent(new Event('input', { bubbles: true }));
      width!.dispatchEvent(new Event('change', { bubbles: true }));
      setter?.call(height, '777');
      height!.dispatchEvent(new Event('input', { bubbles: true }));
      height!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => height!.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));
    expect(onDimensionsChange).toHaveBeenLastCalledWith({ height: 777, width: 1234 });

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(document.querySelector('[role="dialog"][aria-label="Artboard setup"]')).toBeNull();
  });
});
