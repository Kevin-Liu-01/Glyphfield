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
