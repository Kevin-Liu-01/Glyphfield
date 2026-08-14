import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { schedulePersistentWrite } from '../../hooks/usePersistentState';

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
});
