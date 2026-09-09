// @vitest-environment happy-dom

import { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import StudioToolHeader from '@/components/StudioToolHeader';
import { useCanvasSelectionDismiss } from '../useCanvasSelectionDismiss';

it('keeps the canvas selection through the first toolbar action without blocking native input', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const dismiss = vi.fn();
  const pause = vi.fn();
  function Editor() {
    const canvas = useRef<HTMLDivElement>(null);
    useCanvasSelectionDismiss(canvas, dismiss);
    return <>
      <StudioToolHeader title='Design Lab' actions={<button onClick={pause} type='button'>Pause</button>} />
      <div ref={canvas}>Selected layer</div>
    </>;
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(() => root.render(<Editor />));
    const button = container.querySelector('button')!;
    const press = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
    await act(() => button.dispatchEvent(press));
    await act(() => button.click());
    expect(press.defaultPrevented).toBe(false);
    expect(pause).toHaveBeenCalledOnce();
    expect(dismiss).not.toHaveBeenCalled();
    await act(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    expect(dismiss).toHaveBeenCalledOnce();
  } finally {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
