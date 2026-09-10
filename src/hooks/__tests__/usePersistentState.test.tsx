// @vitest-environment happy-dom

import { act, useLayoutEffect, type Dispatch, type SetStateAction } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePersistentState } from '@/hooks/usePersistentState';

type Draft = { count: number };
type Snapshot = { key: string; value: Draft; setValue: Dispatch<SetStateAction<Draft>> };

function Harness({ initial, onCommit, storageKey }: {
  initial: Draft | (() => Draft);
  onCommit: (snapshot: Snapshot) => void;
  storageKey: string;
}) {
  const [value, setValue] = usePersistentState(storageKey, initial);
  useLayoutEffect(() => { onCommit({ key: storageKey, value, setValue }); });
  return <output>{value.count}</output>;
}

describe('persistent state initialization and equality', () => {
  let root: Root;
  let container: HTMLDivElement;
  let values: Map<string, string>;
  let commits: Snapshot[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    values = new Map();
    commits = [];
    vi.spyOn(window.localStorage, 'getItem').mockImplementation((key) => values.get(key) ?? null);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => values.set(key, value));
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key) => { values.delete(key); });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      vi.runOnlyPendingTimers();
    });
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  async function render(initial: Draft | (() => Draft), storageKey = 'draft') {
    await act(async () => root.render(<Harness initial={initial} onCommit={(snapshot) => commits.push(snapshot)} storageKey={storageKey} />));
  }

  it('evaluates a fresh lazy default once without a redundant hydration commit', async () => {
    const initial = vi.fn(() => ({ count: 4 }));
    await render(initial);

    expect(initial).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem).toHaveBeenCalledExactlyOnceWith('draft');
    expect(commits).toHaveLength(1);
    expect(commits[0]?.value).toEqual({ count: 4 });
  });

  it('does not commit or persist reference-identical direct and functional updates', async () => {
    await render({ count: 4 });
    const current = commits.at(-1)!;
    const count = commits.length;
    await act(async () => {
      current.setValue(current.value);
      current.setValue((value) => value);
      vi.advanceTimersByTime(120);
    });

    expect(commits).toHaveLength(count);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('still persists real updates and does not use deep equality to suppress a new object', async () => {
    await render({ count: 4 });
    await act(async () => commits.at(-1)!.setValue({ count: 4 }));
    expect(commits.at(-1)?.value).not.toBe(commits[0]?.value);
    await act(async () => commits.at(-1)!.setValue((value) => ({ count: value.count + 1 })));
    await act(async () => { vi.advanceTimersByTime(120); });
    expect(window.localStorage.setItem).toHaveBeenCalledExactlyOnceWith('draft', '{"count":5}');
  });

  it('hydrates stored values and switches keys without exposing another workspace draft', async () => {
    values.set('first', '{"count":12}');
    values.set('second', '{"count":84}');
    await render({ count: 0 }, 'first');
    expect(commits.at(-1)?.value.count).toBe(12);
    await render({ count: 9 }, 'second');
    expect(commits.filter(({ key }) => key === 'second').map(({ value }) => value.count)).toEqual([9, 84]);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('restores an unflushed edit when its key is reopened', async () => {
    await render({ count: 0 }, 'queued');
    await act(async () => commits.at(-1)!.setValue({ count: 36 }));
    await render({ count: 9 }, 'other');
    await render({ count: 0 }, 'queued');
    expect(commits.at(-1)?.value.count).toBe(36);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(120); });
    expect(window.localStorage.setItem).toHaveBeenCalledExactlyOnceWith('queued', '{"count":36}');
  });

  it('keeps the same in-memory default when storage access is blocked', async () => {
    vi.mocked(window.localStorage.getItem).mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError'); });
    await render({ count: 7 });
    expect(commits).toHaveLength(1);
    expect(commits[0]?.value.count).toBe(7);
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });
});
