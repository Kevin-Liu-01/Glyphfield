// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StudioCommandPalette from '@/components/StudioCommandPalette';
import { STUDIO_TOOLS } from '@/lib/studioCatalog';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message,
}));

describe('Studio command palette', () => {
  let container: HTMLDivElement;
  let root: Root;
  let launcher: HTMLButtonElement;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    launcher = document.createElement('button');
    launcher.textContent = 'Search';
    container = document.createElement('div');
    document.body.append(launcher, container);
    launcher.focus();
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    launcher.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function render() {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    await act(() => root.render(
      <StudioCommandPalette
        onClose={onClose}
        onSelect={onSelect}
        query=''
        setQuery={vi.fn()}
        tools={STUDIO_TOOLS}
      />
    ));
    return { onClose, onSelect };
  }

  it('opens a modal and restores the launcher focus when dismissed', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    await render();
    expect(showModal).toHaveBeenCalledOnce();
    container.querySelector('input')?.focus();
    await act(() => root.render(null));
    expect(document.activeElement).toBe(launcher);
  });

  it('keeps keyboard results in view and opens the selected tool', async () => {
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const { onSelect, onClose } = await render();
    const input = container.querySelector('input')!;
    const lastTool = STUDIO_TOOLS[STUDIO_TOOLS.length - 1];
    for (let index = 1; index < STUDIO_TOOLS.length; index += 1) {
      await act(() => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      });
    }
    expect(input.getAttribute('aria-activedescendant')).toBe(`studio-command-${lastTool.id}`);
    expect(scroll.mock.contexts.at(-1)).toBe(container.querySelector(`#studio-command-${lastTool.id}`));
    await act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledWith(lastTool.id);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
