// @vitest-environment happy-dom

import { act, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { useDismissibleMenu } from '../useDismissibleMenu';
import StudioSelect from '@/components/ui/StudioSelect';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

function Harness({ onDismiss }: { onDismiss: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissibleMenu(rootRef, onDismiss, '[data-floating-layer]');
  return <div ref={rootRef}><button type='button'>Inside</button></div>;
}

describe('useDismissibleMenu', () => {
  it('lets a nested select consume Escape without also closing the parent menu', async () => {
    const onDismiss = vi.fn();
    function NestedSelect() {
      const rootRef = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(true);
      useDismissibleMenu(rootRef, () => {
        onDismiss();
        setOpen(false);
      }, '[data-radix-popper-content-wrapper]');
      return <div ref={rootRef}>{open ? <StudioSelect
        ariaLabel='Studio font'
        defaultValue='one'
        options={[{ label: 'One', value: 'one' }, { label: 'Two', value: 'two' }]}
      /> : null}</div>;
    }
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    try {
      await act(() => root.render(<NestedSelect />));
      const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
      await act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowDown' })));
      const listbox = document.querySelector<HTMLElement>('[role="listbox"]')!;
      expect(listbox).not.toBeNull();
      await act(() => listbox.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })));
      expect(document.querySelector('[role="listbox"]')).toBeNull();
      expect(onDismiss).not.toHaveBeenCalled();
      expect(trigger.isConnected).toBe(true);
      await act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Escape' })));
      expect(onDismiss).toHaveBeenCalledOnce();
      expect(trigger.isConnected).toBe(false);
    } finally {
      await act(() => root.unmount());
      container.remove();
    }
  });

  it('dismisses on outside pointer presses and Escape while respecting nested floating layers', () => {
    const onDismiss = vi.fn();
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    act(() => root.render(<Harness onDismiss={onDismiss} />));

    container.querySelector('button')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();

    const floating = document.createElement('div');
    floating.dataset.floatingLayer = '';
    document.body.append(floating);
    floating.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onDismiss).not.toHaveBeenCalled();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDismiss).toHaveBeenCalledTimes(2);

    act(() => root.unmount());
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
    floating.remove();
    container.remove();
  });
});
