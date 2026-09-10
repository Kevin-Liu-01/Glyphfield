// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StudioArtboardBar, { type StudioArtboardBarProps } from '@/components/StudioArtboardBar';

describe('shared Studio artboard bar', () => {
  let container: HTMLDivElement;
  let root: Root;
  let props: StudioArtboardBarProps;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.useFakeTimers();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) =>
      window.setTimeout(() => callback(performance.now()), 0));
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => window.clearTimeout(id));
    props = {
      activeArtboardId: 'banner',
      addLabel: 'Add animation artboard',
      ariaLabel: 'Animation artboards',
      artboards: [{ id: 'banner', name: 'Banner animation' }, { id: 'portrait', name: 'Portrait animation' }],
      dimensions: { width: 1000, height: 300 },
      duplicateLabel: 'Duplicate animation artboard',
      onAdd: vi.fn(),
      onDimensionsChange: vi.fn(),
      onDuplicate: vi.fn(),
      onRemove: vi.fn(),
      onRename: vi.fn(),
      onSelect: vi.fn(),
      removeLabel: 'Delete animation artboard',
      selectLabel: 'Active animation artboard',
      summary: '3 frames · 4.50s · Morph Fade',
    };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render(patch: Partial<StudioArtboardBarProps> = {}) {
    props = { ...props, ...patch };
    await act(() => root.render(
      <div className='studio-project-workspace-layer' data-active='true'>
        <div className='studio-workspace-layer' data-active='true'>
          <StudioArtboardBar {...props} />
        </div>
      </div>
    ));
  }

  function button(label: string) {
    const result = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!result) throw new Error(`Missing button: ${label}`);
    return result;
  }

  async function openContextMenu(key = 'F10') {
    const bar = container.querySelector<HTMLElement>('section')!;
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, shiftKey: key === 'F10' });
    await act(() => bar.dispatchEvent(event));
    await act(() => vi.runOnlyPendingTimersAsync());
    expect(event.defaultPrevented).toBe(true);
    return document.querySelector<HTMLElement>('[role="menu"]')!;
  }

  it('keeps Animation markup classes, dimensions, summary and accessible labels', async () => {
    await render();
    const bar = container.querySelector('section')!;
    expect(bar.getAttribute('aria-label')).toBe('Animation artboards');
    expect(bar.classList.contains('studio-artboard-bar')).toBe(true);
    expect(bar.classList.contains('animation-artboard-bar')).toBe(true);
    expect(bar.hasAttribute('data-canvas-selection-preserve')).toBe(true);
    expect(bar.hasAttribute('data-has-file-controls')).toBe(false);
    expect(button('Active animation artboard').textContent).toContain('Banner animation');
    expect(button('Set artboard size. Current size 1000 by 300')).not.toBeNull();
    expect(button(props.addLabel).title).toBe(props.addLabel);
    expect(container.querySelector('.studio-artboard-summary')?.textContent).toBe(props.summary);
  });

  it('keeps artboard settings on the left, with related commands grouped separately on the right', async () => {
    await render({
      extraActions: <button type='button'>Arrange</button>,
    });
    const start = container.querySelector('[data-slot="artboard-start"]')!;
    const end = container.querySelector('[data-slot="artboard-end"]')!;
    expect(start.querySelector('[role="group"][aria-label="Document actions"]')).toBeNull();
    const settings = start.querySelector('[role="group"][aria-label="Artboard settings"]')!;
    expect(settings.contains(button(props.selectLabel))).toBe(true);
    expect(settings.contains(button('Set artboard size. Current size 1000 by 300'))).toBe(true);
    const actions = end.querySelector('[role="group"][aria-label="Artboard actions"]')!;
    for (const label of [props.addLabel, props.duplicateLabel, props.removeLabel]) {
      expect(actions.contains(button(label))).toBe(true);
    }
    expect(actions.textContent).not.toContain('Arrange');
    expect(end.querySelector('[role="group"][aria-label="Layout and help"]')?.textContent).toBe('Arrange');
    expect(container.querySelector('[data-slot="artboard-summary"]')?.parentElement).toBe(start.parentElement);
    expect(start.nextElementSibling?.getAttribute('data-slot')).toBe('artboard-summary');
    expect(start.nextElementSibling?.nextElementSibling).toBe(end);
  });

  it('keeps the bar compact without empty file or secondary action groups', async () => {
    await render();
    expect(container.querySelector('[data-slot="artboard-start"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="artboard-file-actions"]')).toBeNull();
    expect(container.querySelector('[data-slot="artboard-extra-actions"]')).toBeNull();
    expect(container.querySelector('[data-slot="artboard-end"]')?.contains(button(props.addLabel))).toBe(true);
  });

  it('selects another artboard through the existing keyboard-operated StudioSelect', async () => {
    await render();
    const select = button('Active animation artboard');
    await act(() => select.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' })));
    await act(() => vi.runOnlyPendingTimersAsync());
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')]
      .find((element) => element.textContent === 'Portrait animation')!;
    expect(option).toBeDefined();
    await act(() => option.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })));
    expect(props.onSelect).toHaveBeenCalledExactlyOnceWith('portrait');
    await render({ activeArtboardId: 'portrait' });
    expect(button('Active animation artboard').textContent).toContain('Portrait animation');
  });

  it('preserves fallback selection and the host’s untitled artboard label without mutating its state', async () => {
    await render({ activeArtboardId: 'missing', artboards: [{ id: 'banner', name: '  ' }], untitledName: 'Untitled animation' });
    expect(button('Active animation artboard').textContent).toContain('Untitled animation');
    expect(props.onSelect).not.toHaveBeenCalled();
  });

  it('uses the shared setup menu for presets, renaming and custom dimensions', async () => {
    await render();
    await act(() => button('Set artboard size. Current size 1000 by 300').click());
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Artboard setup"]')!;
    const preset = [...dialog.querySelectorAll<HTMLButtonElement>('button')]
      .find((element) => element.textContent?.includes('OG Social'))!;
    await act(() => preset.click());
    expect(props.onDimensionsChange).toHaveBeenLastCalledWith({ width: 1200, height: 630 });
    const name = dialog.querySelector<HTMLInputElement>('input:not([type="number"])')!;
    const width = dialog.querySelector<HTMLInputElement>('input[type="number"]')!;
    await act(() => {
      const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setValue.call(name, 'Updated board');
      name.dispatchEvent(new Event('input', { bubbles: true }));
      setValue.call(width, '1234');
      width.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(() => width.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })));
    expect(props.onRename).toHaveBeenLastCalledWith('Updated board');
    expect(props.onDimensionsChange).toHaveBeenLastCalledWith({ width: 1234, height: 300 });
  });

  it('routes add, duplicate and remove exactly once', async () => {
    await render();
    for (const label of [props.addLabel, props.duplicateLabel, props.removeLabel]) {
      await act(() => button(label).click());
    }
    expect(props.onAdd).toHaveBeenCalledOnce();
    expect(props.onDuplicate).toHaveBeenCalledOnce();
    expect(props.onRemove).toHaveBeenCalledOnce();
  });

  it('allows duplicating the only artboard but disables deleting it in both action surfaces', async () => {
    await render({ artboards: [props.artboards[0]] });
    expect(button(props.duplicateLabel).disabled).toBe(false);
    expect(button(props.removeLabel).disabled).toBe(true);
    await act(() => button(props.removeLabel).click());
    const menu = await openContextMenu();
    const remove = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((element) => element.textContent?.includes('Delete artboard'))!;
    expect(remove.disabled).toBe(true);
    await act(() => remove.click());
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it.each(['F10', 'ContextMenu'])('opens the contextual actions with %s and restores focus on Escape', async (key) => {
    await render();
    const menu = await openContextMenu(key);
    expect(menu.textContent).toContain('Banner animation');
    expect(menu.textContent).toContain('1000 × 300');
    expect(document.activeElement?.textContent).toContain('Duplicate artboard');
    await act(() => menu.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' })));
    expect(document.activeElement?.textContent).toContain('New artboard');
    await act(() => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    await act(() => vi.runOnlyPendingTimersAsync());
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(container.querySelector('section'));
  });

  it('opens a pointer context menu and invokes duplication without changing selection', async () => {
    await render();
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 60 });
    await act(() => container.querySelector('section')!.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    const duplicate = document.querySelector<HTMLButtonElement>('[role="menuitem"]')!;
    await act(() => duplicate.click());
    expect(props.onDuplicate).toHaveBeenCalledOnce();
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it.each(['studio-workspace-layer', 'studio-project-workspace-layer'])('dismisses the portaled menu when its %s becomes inactive without stealing navigation focus', async (ownerClass) => {
    await render();
    await openContextMenu();
    const navigation = document.createElement('button');
    container.append(navigation);
    await act(async () => {
      navigation.focus();
      container.querySelector(`.${ownerClass}`)!.setAttribute('data-active', 'false');
      await vi.runOnlyPendingTimersAsync();
    });
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(navigation);
    expect(props.onDuplicate).not.toHaveBeenCalled();
    expect(props.onRemove).not.toHaveBeenCalled();
  });

  it('does not restore queued Escape focus after the owning workspace becomes inactive', async () => {
    await render();
    await openContextMenu();
    const navigation = document.createElement('button');
    container.append(navigation);
    await act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      container.querySelector('.studio-project-workspace-layer')!.setAttribute('data-active', 'false');
      navigation.focus();
    });
    await act(() => vi.runOnlyPendingTimersAsync());
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.activeElement).toBe(navigation);
  });

  it('removes its body portal when the artboard bar unmounts', async () => {
    await render();
    await openContextMenu();
    await act(() => root.render(null));
    await act(() => vi.runOnlyPendingTimersAsync());
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });

  it('accepts Design Lab labels and slots without an Animation-specific state model', async () => {
    await render({
      activeArtboardId: 'page-1', artboards: [{ id: 'page-1', name: 'Launch' }],
      ariaLabel: 'Design Lab artboards', selectLabel: 'Active design artboard',
      addLabel: 'Add design artboard', duplicateLabel: 'Duplicate design artboard', removeLabel: 'Delete design artboard',
      className: 'design-lab-artboard-bar', summary: <span>4 layers</span>,
      extraActions: <button type='button'>Arrange</button>,
    });
    const bar = container.querySelector('section')!;
    expect(bar.classList.contains('design-lab-artboard-bar')).toBe(true);
    expect(bar.hasAttribute('data-has-file-controls')).toBe(false);
    expect(container.querySelector('.studio-artboard-file-controls')).toBeNull();
    expect(container.querySelector('.studio-artboard-actions')?.textContent).toContain('Arrange');
    expect(button('Active design artboard').textContent).toContain('Launch');
    expect(button('Add design artboard')).not.toBeNull();
    expect(button('Add design artboard').title).toBe('Add design artboard');
  });
});
