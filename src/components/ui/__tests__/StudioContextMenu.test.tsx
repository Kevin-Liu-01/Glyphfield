// @vitest-environment happy-dom

import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StudioContextMenu from '@/components/ui/StudioContextMenu';
import { useCanvasSelectionDismiss } from '@/hooks/useCanvasSelectionDismiss';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('StudioContextMenu', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.querySelectorAll('.studio-context-menu').forEach((menu) => menu.remove());
  });

  it('renders a branded menu, focuses its first action, and supports arrow navigation', async () => {
    const onClose = vi.fn();
    act(() => root.render(
      <StudioContextMenu
        detail='One selected item'
        label='Layer actions'
        onClose={onClose}
        position={{ x: 24, y: 24 }}
        sections={[{
          items: [
            { id: 'first', label: 'First action', onSelect: vi.fn() },
            { id: 'disabled', disabled: true, label: 'Disabled action', onSelect: vi.fn() },
            { id: 'last', label: 'Last action', onSelect: vi.fn() },
          ],
        }]}
      />
    ));

    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    const menu = document.querySelector<HTMLElement>('[role="menu"]');
    const items = [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')];
    expect(menu?.classList.contains('studio-context-menu')).toBe(true);
    expect(items[0]).toBe(document.activeElement);

    act(() => menu?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowDown' })));
    expect(items[2]).toBe(document.activeElement);
    expect(items[1]?.disabled).toBe(true);
  });

  it('runs actions, closes on selection, and restores focus after Escape', async () => {
    const action = vi.fn();
    const onClose = vi.fn();
    const anchor = document.createElement('button');
    document.body.append(anchor);
    act(() => root.render(
      <StudioContextMenu
        label='Asset actions'
        onClose={onClose}
        position={{ anchor, x: 24, y: 24 }}
        sections={[{ items: [{ id: 'preview', label: 'Preview', onSelect: action }] }]}
      />
    ));

    const item = document.querySelector<HTMLButtonElement>('[role="menuitem"]');
    act(() => item?.click());
    expect(action).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();

    onClose.mockClear();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(anchor);
    anchor.remove();
  });

  it('preserves canvas selection through a pointer gesture on its portalled action', () => {
    const action = vi.fn();
    const dismissSelection = vi.fn();
    function CanvasMenu() {
      const boundary = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(true);
      useCanvasSelectionDismiss(boundary, () => {
        dismissSelection();
        setOpen(false);
      });
      return <>
        <div ref={boundary}>Selected canvas layer</div>
        <StudioContextMenu
          label='Selection actions'
          onClose={() => setOpen(false)}
          position={open ? { x: 24, y: 24 } : null}
          sections={[{ items: [{ id: 'copy', label: 'Copy', onSelect: action }] }]}
        />
      </>;
    }
    act(() => root.render(<CanvasMenu />));
    const item = document.querySelector<HTMLButtonElement>('[role="menuitem"]')!;
    act(() => item.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    expect(dismissSelection).not.toHaveBeenCalled();
    expect(item.isConnected).toBe(true);
    act(() => {
      item.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0 }));
      item.click();
    });
    expect(action).toHaveBeenCalledOnce();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    act(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })));
    expect(dismissSelection).toHaveBeenCalledOnce();
  });
});
