// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeferredRuntime } from '@/hooks/useDeferredRuntime';

function RuntimeHarness({
  deferWhileInteracting = true,
  enabled = true,
  resetWhenDisabled = false,
  urgent = false,
  useIdleCallback = false,
}: {
  deferWhileInteracting?: boolean;
  enabled?: boolean;
  resetWhenDisabled?: boolean;
  urgent?: boolean;
  useIdleCallback?: boolean;
}) {
  const ready = useDeferredRuntime(enabled, 150, { deferWhileInteracting, resetWhenDisabled, urgent, useIdleCallback });
  return <output>{ready ? 'ready' : 'waiting'}</output>;
}

describe('useDeferredRuntime', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function render(props: Parameters<typeof RuntimeHarness>[0] = {}) {
    act(() => root.render(<RuntimeHarness {...props} />));
  }

  function advance(milliseconds: number) {
    act(() => vi.advanceTimersByTime(milliseconds));
  }

  function pointer(type: string, pointerId = 1) {
    act(() => window.dispatchEvent(new PointerEvent(type, { pointerId })));
  }

  it('admits an urgent decorative runtime immediately and latches it after urgency ends', () => {
    const idle = vi.fn();
    vi.stubGlobal('requestIdleCallback', idle);
    render({ deferWhileInteracting: false, urgent: true, useIdleCallback: true });
    expect(container.textContent).toBe('ready');
    expect(vi.getTimerCount()).toBe(0);
    render({ deferWhileInteracting: false, urgent: false, useIdleCallback: true });
    expect(container.textContent).toBe('ready');
    expect(idle).not.toHaveBeenCalled();
  });

  it('cancels queued idle admission when a renderer becomes urgent', () => {
    const callbacks: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => callbacks.push(callback));
    const cancel = vi.fn();
    vi.stubGlobal('cancelIdleCallback', cancel);
    render({ deferWhileInteracting: false, useIdleCallback: true });
    advance(150);
    expect(callbacks).toHaveLength(1);
    render({ deferWhileInteracting: false, urgent: true, useIdleCallback: true });
    expect(container.textContent).toBe('ready');
    expect(cancel).toHaveBeenCalledWith(1);
    render({ deferWhileInteracting: false, enabled: false, resetWhenDisabled: true });
    act(() => callbacks[0]());
    expect(container.textContent).toBe('waiting');
  });

  it('does not let urgency enable a disabled runtime and resets nonpersistent admission', () => {
    render({ deferWhileInteracting: false, enabled: false, urgent: true, resetWhenDisabled: true });
    expect(container.textContent).toBe('waiting');
    render({ deferWhileInteracting: false, urgent: true, resetWhenDisabled: true });
    expect(container.textContent).toBe('ready');
    render({ deferWhileInteracting: false, enabled: false, urgent: true, resetWhenDisabled: true });
    expect(container.textContent).toBe('waiting');
    render({ deferWhileInteracting: false, resetWhenDisabled: true });
    expect(container.textContent).toBe('waiting');
    advance(150);
    expect(container.textContent).toBe('ready');
  });

  it('preserves retained readiness while disabled if resetting was not requested', () => {
    render({ deferWhileInteracting: false, urgent: true });
    render({ deferWhileInteracting: false, enabled: false });
    expect(container.textContent).toBe('ready');
  });

  it('never lets urgency bypass an optional editor held-pointer deferral', () => {
    render({ urgent: true });
    expect(container.textContent).toBe('waiting');
    pointer('pointerdown');
    advance(1_000);
    expect(container.textContent).toBe('waiting');
    pointer('pointerup');
    advance(150);
    expect(container.textContent).toBe('ready');
  });

  it('does not start an optional GPU runtime in the middle of a held pointer drag', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    render();
    advance(100);
    pointer('pointerdown');

    advance(2_000);
    expect(container.textContent).toBe('waiting');

    pointer('pointerup');
    advance(149);
    expect(container.textContent).toBe('waiting');
    advance(1);
    expect(container.textContent).toBe('ready');
  });

  it.each(['pointerup', 'pointercancel'])('waits for every active pointer before resuming after %s', (endEvent) => {
    render();
    pointer('pointerdown', 1);
    pointer('pointerdown', 2);
    pointer(endEvent, 1);
    advance(1_000);
    expect(container.textContent).toBe('waiting');
    pointer(endEvent, 2);
    advance(150);
    expect(container.textContent).toBe('ready');
  });

  it('does not restart work when keyboard, wheel, or scroll events arrive during a pointer gesture', () => {
    render();
    pointer('pointerdown');
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 10 }));
      window.dispatchEvent(new Event('scroll'));
    });
    advance(1_000);
    expect(container.textContent).toBe('waiting');
    pointer('pointerup');
    advance(150);
    expect(container.textContent).toBe('ready');
  });

  it('recovers when the window loses focus before a pointer can be released', () => {
    render();
    pointer('pointerdown');
    act(() => window.dispatchEvent(new Event('blur')));
    advance(149);
    expect(container.textContent).toBe('waiting');
    advance(1);
    expect(container.textContent).toBe('ready');
  });

  it('cancels already queued idle work when an interaction begins', () => {
    const callbacks: Array<() => void> = [];
    vi.stubGlobal('requestIdleCallback', vi.fn((callback: () => void) => callbacks.push(callback)));
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);
    render({ useIdleCallback: true });
    advance(150);
    expect(callbacks).toHaveLength(1);

    pointer('pointerdown');
    expect(cancelIdleCallback).toHaveBeenCalledWith(1);
    act(() => callbacks[0]?.());
    expect(container.textContent).toBe('waiting');

    pointer('pointerup');
    advance(150);
    expect(callbacks).toHaveLength(2);
    act(() => callbacks[1]?.());
    expect(container.textContent).toBe('ready');
  });

  it('uses the quiet delay when the browser has no idle callback API', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    render({ useIdleCallback: true });
    advance(150);
    expect(container.textContent).toBe('ready');
  });

  it('preserves opt-out behavior for runtimes that do not defer interaction', () => {
    render({ deferWhileInteracting: false });
    pointer('pointerdown');
    advance(150);
    expect(container.textContent).toBe('ready');
  });

  it('supports held mouse drags when Pointer Events are unavailable', () => {
    vi.stubGlobal('PointerEvent', undefined);
    render();
    act(() => window.dispatchEvent(new MouseEvent('mousedown')));
    advance(1_000);
    expect(container.textContent).toBe('waiting');
    act(() => window.dispatchEvent(new MouseEvent('mouseup')));
    advance(150);
    expect(container.textContent).toBe('ready');
  });

  it.each(['touchend', 'touchcancel'])('supports multi-touch fallback through %s without starting between touches', (endEvent) => {
    vi.stubGlobal('PointerEvent', undefined);
    render();
    const dispatchTouches = (type: string, count: number) => {
      const event = new Event(type);
      Object.defineProperty(event, 'touches', { value: { length: count } });
      act(() => window.dispatchEvent(event));
    };
    dispatchTouches('touchstart', 2);
    dispatchTouches(endEvent, 1);
    advance(1_000);
    expect(container.textContent).toBe('waiting');
    dispatchTouches(endEvent, 0);
    advance(150);
    expect(container.textContent).toBe('ready');
  });

  it('cancels work and detaches gesture listeners when disabled', () => {
    render();
    pointer('pointerdown');
    render({ enabled: false });
    pointer('pointerup');
    expect(vi.getTimerCount()).toBe(0);
    advance(1_000);
    expect(container.textContent).toBe('waiting');
    render({ enabled: true });
    advance(150);
    expect(container.textContent).toBe('ready');
  });
});
