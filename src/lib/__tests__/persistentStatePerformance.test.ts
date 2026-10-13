import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readPersistentValue,
  schedulePersistentWrite,
} from '../../hooks/usePersistentState';

describe('persistent state write scheduling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('coalesces rapid updates and writes only the latest value for each key', () => {
    const setItem = vi.fn();
    const addEventListener = vi.fn();
    vi.stubGlobal('window', {
      addEventListener,
      clearTimeout: (timer: number) => clearTimeout(timer),
      localStorage: { setItem },
      setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    });

    schedulePersistentWrite('draft:position', { x: 1 });
    schedulePersistentWrite('draft:position', { x: 2 });
    schedulePersistentWrite('draft:zoom', 90);

    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(119);
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    // The quiet period ends; serialization waits for the next idle slot, not this task.
    expect(setItem).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(setItem.mock.calls).toEqual([
      ['draft:position', JSON.stringify({ x: 2 })],
      ['draft:zoom', '90'],
    ]);
    expect(addEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
  });

  it('loads the requested key without leaking a previous workspace value', () => {
    const values = new Map([
      ['draft:brand-a', JSON.stringify({ x: 12 })],
      ['draft:brand-b', JSON.stringify({ x: 84 })],
    ]);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: vi.fn(),
      },
    });

    expect(readPersistentValue('draft:brand-a', { x: 0 })).toEqual({ x: 12 });
    expect(readPersistentValue('draft:brand-b', { x: 0 })).toEqual({ x: 84 });
    expect(readPersistentValue('draft:brand-c', { x: 0 })).toEqual({ x: 0 });
  });

  it('restores the latest queued edit when a workspace reopens before the write debounce', () => {
    const values = new Map([
      ['draft:quick-return', JSON.stringify({ x: 12 })],
      ['draft:other-workspace', JSON.stringify({ x: 84 })],
    ]);
    const setItem = vi.fn((key: string, value: string) => values.set(key, value));
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      clearTimeout: (timer: number) => clearTimeout(timer),
      localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem },
      setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    });

    schedulePersistentWrite('draft:quick-return', { x: 36 });
    expect(setItem).not.toHaveBeenCalled();
    expect(readPersistentValue('draft:quick-return', { x: 0 })).toEqual({ x: 36 });
    expect(readPersistentValue('draft:other-workspace', { x: 0 })).toEqual({ x: 84 });

    vi.advanceTimersByTime(121);
    expect(readPersistentValue('draft:quick-return', { x: 0 })).toEqual({ x: 36 });
    expect(setItem).toHaveBeenCalledExactlyOnceWith('draft:quick-return', '{"x":36}');
  });

  it('serializes in idle time, yields when the idle slice ends, and restarts on new edits', async () => {
    vi.resetModules();
    const { readPersistentValue: read, schedulePersistentWrite: schedule } = await import('../../hooks/usePersistentState');
    const idle: { callback: IdleRequestCallback; options?: IdleRequestOptions }[] = [];
    const cancelIdleCallback = vi.fn();
    const setItem = vi.fn();
    vi.stubGlobal('window', {
      addEventListener: vi.fn(),
      cancelIdleCallback,
      clearTimeout: (timer: number) => clearTimeout(timer),
      localStorage: { getItem: () => null, setItem },
      requestIdleCallback: (callback: IdleRequestCallback, options?: IdleRequestOptions) => idle.push({ callback, options }),
      setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    });

    schedule('draft:a', { layers: 1 });
    vi.advanceTimersByTime(120);
    expect(idle).toHaveLength(1);
    expect(idle[0]?.options).toEqual({ timeout: 1_000 });

    // A new edit cancels the queued idle flush and restarts the quiet period.
    schedule('draft:b', { layers: 2 });
    expect(cancelIdleCallback).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(120);
    expect(idle).toHaveLength(2);

    let remaining = 2;
    idle[1]!.callback({ didTimeout: false, timeRemaining: () => (remaining -= 2) + 2 });
    expect(setItem.mock.calls).toEqual([['draft:a', '{"layers":1}']]);
    // The unwritten key is still readable and goes in the next idle slice.
    expect(read('draft:b', null)).toEqual({ layers: 2 });
    expect(idle).toHaveLength(3);
    idle[2]!.callback({ didTimeout: true, timeRemaining: () => 0 });
    expect(setItem.mock.calls.at(-1)).toEqual(['draft:b', '{"layers":2}']);
  });

  it('writes queued values synchronously when the page or tab is hidden', async () => {
    vi.resetModules();
    const { schedulePersistentWrite: schedule } = await import('../../hooks/usePersistentState');
    const windowListeners = new Map<string, () => void>();
    const documentListeners = new Map<string, () => void>();
    const setItem = vi.fn();
    const fakeDocument = {
      addEventListener: (type: string, listener: () => void) => documentListeners.set(type, listener),
      visibilityState: 'visible',
    };
    vi.stubGlobal('document', fakeDocument);
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: () => void) => windowListeners.set(type, listener),
      clearTimeout: (timer: number) => clearTimeout(timer),
      localStorage: { setItem },
      setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
    });

    schedule('draft:hidden', { x: 1 });
    documentListeners.get('visibilitychange')?.();
    expect(setItem).not.toHaveBeenCalled();
    fakeDocument.visibilityState = 'hidden';
    documentListeners.get('visibilitychange')?.();
    expect(setItem).toHaveBeenCalledExactlyOnceWith('draft:hidden', '{"x":1}');

    schedule('draft:pagehide', { x: 2 });
    windowListeners.get('pagehide')?.();
    expect(setItem).toHaveBeenLastCalledWith('draft:pagehide', '{"x":2}');
    vi.runOnlyPendingTimers();
    expect(setItem).toHaveBeenCalledTimes(2);
  });

  it('drops corrupt storage and keeps the in-memory fallback', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => '{broken',
        removeItem,
      },
    });

    expect(readPersistentValue('draft:broken', { x: 7 })).toEqual({ x: 7 });
    expect(removeItem).toHaveBeenCalledWith('draft:broken');
  });
});
