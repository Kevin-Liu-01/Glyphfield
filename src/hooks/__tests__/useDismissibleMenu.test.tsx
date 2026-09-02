// @vitest-environment happy-dom

import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { useDismissibleMenu } from '../useDismissibleMenu';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

function Harness({ onDismiss }: { onDismiss: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  useDismissibleMenu(rootRef, onDismiss, '[data-floating-layer]');
  return <div ref={rootRef}><button type='button'>Inside</button></div>;
}

describe('useDismissibleMenu', () => {
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
