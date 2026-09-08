// @vitest-environment happy-dom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ArtboardSizeMenu, { ArtboardSetupFields } from '@/components/ArtboardSizeMenu';
import { STUDIO_ARTBOARD_PRESETS, type StudioArtboardDimensions } from '@/lib/artboardSizes';

describe('shared artboard portrait presets', () => {
  let container: HTMLDivElement;
  let root: Root;
  const changes = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  function Harness() {
    const [dimensions, setDimensions] = useState<StudioArtboardDimensions>({ width: 1600, height: 900 });
    return <ArtboardSetupFields dimensions={dimensions} onDimensionsChange={(next) => {
      changes(next);
      setDimensions(next);
    }} />;
  }

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

  it('renders the three new choices after the existing two rows', async () => {
    await act(() => root.render(<Harness />));
    const buttons = container.querySelectorAll<HTMLButtonElement>('.artboard-size-preset-grid > button');
    expect([...buttons].map((button) => button.querySelector('strong')!.textContent))
      .toEqual(['Wide', 'Square', 'OG Social', 'Banner', 'Portrait', 'Story', '3:4', '2:3', '1:2']);
    for (const button of [...buttons].slice(6)) {
      const shape = button.querySelector<HTMLElement>('.artboard-size-preset-shape')!;
      expect(Number.parseFloat(shape.style.width)).toBeLessThan(25);
      expect(shape.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it.each(STUDIO_ARTBOARD_PRESETS.slice(6))('selects $label and synchronizes the dimension fields', async (preset) => {
    await act(() => root.render(<Harness />));
    const buttons = [...container.querySelectorAll<HTMLButtonElement>('.artboard-size-preset-grid > button')];
    const button = buttons.find((candidate) => candidate.querySelector('strong')!.textContent === preset.label)!;
    await act(() => button.click());
    expect(changes).toHaveBeenCalledExactlyOnceWith({ width: preset.width, height: preset.height });
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(buttons.filter((candidate) => candidate.getAttribute('aria-pressed') === 'true')).toEqual([button]);
    expect([...container.querySelectorAll<HTMLInputElement>('input[type="number"]')].map((input) => input.value))
      .toEqual([String(preset.width), String(preset.height)]);
  });

  it('positions the added row using the measured panel height instead of a fixed estimate', async () => {
    vi.stubGlobal('innerHeight', 700);
    vi.stubGlobal('innerWidth', 1280);
    let panelHeight = 480;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('artboard-size-trigger')
        ? new DOMRect(200, 210, 100, 30)
        : new DOMRect(0, 0, 372, panelHeight);
    });
    await act(() => root.render(<ArtboardSizeMenu
      artboardName='Portrait study'
      dimensions={{ width: 1080, height: 1440 }}
      onArtboardNameChange={vi.fn()}
      onDimensionsChange={changes}
    />));
    await act(() => container.querySelector<HTMLButtonElement>('button')!.click());
    const panel = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Artboard setup"]')!;
    expect(panel.style.top).toBe('12px');
    expect(panel.querySelectorAll('.artboard-size-preset-grid > button')).toHaveLength(9);
    panelHeight = 350;
    await act(() => window.dispatchEvent(new Event('resize')));
    expect(panel.style.top).toBe('246px');
    await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(document.querySelector('[role="dialog"][aria-label="Artboard setup"]')).toBeNull();
  });
});
