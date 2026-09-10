// @vitest-environment happy-dom
import { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnimationActionHistory } from '../useAnimationActionHistory';

describe('Animation action history', () => {
  let root: Root;
  let host: HTMLDivElement;
  let latest: ReturnType<typeof useAnimationActionHistory<{ text: string; size: number }>>;
  let change: (patch: { text?: string; size?: number }) => void;
  function Harness({ enabled = true, disabled = false, scope = 'one' }: { enabled?: boolean; disabled?: boolean; scope?: string }) {
    const workspaceRef = useRef<HTMLDivElement>(null);
    const [value, setValue] = useState({ text: 'First', size: 48 });
    change = (patch) => setValue((current) => ({ ...current, ...patch }));
    latest = useAnimationActionHistory({ disabled, enabled, scope, value, workspaceRef,
      onRestore: (next) => setValue({ ...next }),
    });
    return <div ref={workspaceRef}><output>{JSON.stringify(value)}</output><input aria-label='Size' /></div>;
  }
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    act(() => root.render(<Harness />));
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const state = () => JSON.parse(host.querySelector('output')!.textContent!);

  it('undoes an uncheckpointed edit and redoes it after normalized host restoration', () => {
    expect(latest.canUndo).toBe(false);
    act(() => change({ text: 'Second' }));
    expect(latest.canUndo).toBe(true);
    act(() => latest.onUndo());
    expect(state()).toEqual({ text: 'First', size: 48 });
    expect(latest.canRedo).toBe(true);
    act(() => latest.onRedo());
    expect(state().text).toBe('Second');
    expect(latest.canRedo).toBe(false);
  });

  it('keeps multiple completed actions and clears redo when editing a restored state', () => {
    act(() => change({ text: 'Second' }));
    act(() => vi.advanceTimersByTime(450));
    act(() => change({ size: 12 }));
    act(() => vi.advanceTimersByTime(450));
    act(() => latest.onUndo());
    expect(state()).toEqual({ text: 'Second', size: 48 });
    act(() => latest.onUndo());
    expect(state().text).toBe('First');
    act(() => change({ size: 20 }));
    expect(latest.canRedo).toBe(false);
    act(() => latest.onRedo());
    expect(state().size).toBe(20);
  });

  it('coalesces a held drag even when released outside the workspace', () => {
    const input = host.querySelector('input')!;
    act(() => input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 4 })));
    act(() => change({ size: 30 }));
    act(() => vi.advanceTimersByTime(500));
    act(() => change({ size: 12 }));
    act(() => vi.advanceTimersByTime(500));
    act(() => document.body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 4 })));
    act(() => vi.runOnlyPendingTimers());
    act(() => latest.onUndo());
    expect(state().size).toBe(48);
  });

  it('does not record playback-only rerenders', () => {
    act(() => root.render(<Harness />));
    act(() => vi.advanceTimersByTime(1000));
    expect(latest.entries).toHaveLength(1);
    expect(latest.canUndo).toBe(false);
  });

  it('starts history after hydration and keeps presentation mode out of history', () => {
    act(() => root.render(<Harness enabled={false} />));
    act(() => change({ text: 'Restored autosave' }));
    expect(latest.canUndo).toBe(false);
    act(() => root.render(<Harness />));
    expect(latest.canUndo).toBe(false);
    act(() => change({ size: 12 }));
    act(() => latest.onUndo());
    expect(state().text).toBe('Restored autosave');
  });

  it('blocks history during export and resets ownership across workspaces', () => {
    act(() => change({ size: 12 }));
    act(() => root.render(<Harness disabled />));
    expect(latest.canUndo).toBe(false);
    act(() => latest.onUndo());
    expect(state().size).toBe(12);
    act(() => root.render(<Harness scope='two' />));
    expect(latest.canUndo).toBe(false);
  });
});
