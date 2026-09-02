// @vitest-environment happy-dom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  loadAutosavedDesign: vi.fn(),
  saveAutosavedDesign: vi.fn(),
  writeAutosaveRecovery: vi.fn(),
}));

vi.mock('@/lib/savedDesigns', () => storage);

import {
  useCanvasDocumentAutosave,
  type CanvasDocumentAutosaveState,
} from '@/hooks/useCanvasDocumentAutosave';

type HarnessProps = {
  applySource: (source: string) => Promise<void> | void;
  delayMs?: number;
  onState: (state: CanvasDocumentAutosaveState) => void;
  revision: string;
  source: string | null;
  workspaceKey?: string;
};

function AutosaveHarness({
  applySource,
  delayMs = 180,
  onState,
  revision,
  source,
  workspaceKey = 'workspace',
}: HarnessProps) {
  const state = useCanvasDocumentAutosave({
    applySource,
    delayMs,
    revision,
    source,
    workspaceKey,
  });
  useEffect(() => {
    onState(state);
  }, [onState, state]);
  return <output>{state}</output>;
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('useCanvasDocumentAutosave', () => {
  let container: HTMLDivElement;
  let root: Root;
  let states: CanvasDocumentAutosaveState[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    storage.loadAutosavedDesign.mockReset().mockResolvedValue(null);
    storage.saveAutosavedDesign.mockReset().mockResolvedValue(undefined);
    storage.writeAutosaveRecovery.mockReset().mockReturnValue(true);
    states = [];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (container.isConnected) {
      await act(async () => {
        root.unmount();
        await settle();
      });
    }
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  async function render(props: Omit<HarnessProps, 'onState'>) {
    await act(async () => {
      root.render(<AutosaveHarness {...props} onState={(state) => states.push(state)} />);
      await settle();
    });
  }

  it('hydrates a stored portable source before reporting the draft as saved', async () => {
    const applySource = vi.fn().mockResolvedValue(undefined);
    storage.loadAutosavedDesign.mockResolvedValue({
      revision: 'stored-revision',
      source: '{"stored":true}',
    });

    await render({ applySource, revision: 'initial-revision', source: '{"initial":true}' });

    expect(applySource).toHaveBeenCalledWith('{"stored":true}');
    expect(states).toContain('loading');
    expect(states.at(-1)).toBe('saved');
  });

  it('saves when the portable source changes even if the revision is unchanged', async () => {
    const applySource = vi.fn();
    await render({ applySource, delayMs: 20, revision: 'revision-1', source: '{"frame":1}' });
    await act(async () => {
      vi.advanceTimersByTime(20);
      await settle();
    });
    expect(storage.saveAutosavedDesign).toHaveBeenLastCalledWith(
      'workspace',
      '{"frame":1}',
      'revision-1',
      expect.any(String)
    );

    await render({ applySource, delayMs: 20, revision: 'revision-1', source: '{"frame":2}' });
    await act(async () => {
      vi.advanceTimersByTime(20);
      await settle();
    });
    expect(storage.saveAutosavedDesign).toHaveBeenLastCalledWith(
      'workspace',
      '{"frame":2}',
      'revision-1',
      expect.any(String)
    );
    expect(states.at(-1)).toBe('saved');

    await render({ applySource, delayMs: 21, revision: 'revision-1', source: '{"frame":2}' });
    expect(states.at(-1)).toBe('saved');
  });

  it('flushes the latest snapshot when its canvas unmounts before the debounce', async () => {
    const applySource = vi.fn();
    await render({ applySource, delayMs: 500, revision: 'revision-2', source: '{"x":42}' });

    await act(async () => {
      root.unmount();
      await settle();
    });

    expect(storage.saveAutosavedDesign).toHaveBeenCalledWith(
      'workspace',
      '{"x":42}',
      'revision-2',
      expect.any(String)
    );
  });

  it('journals an unsaved snapshot synchronously when the page is hidden', async () => {
    const applySource = vi.fn();
    await render({ applySource, delayMs: 500, revision: 'revision-3', source: '{"x":84}' });

    await act(async () => {
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      await settle();
    });

    expect(storage.writeAutosaveRecovery).toHaveBeenCalledWith(
      'workspace',
      '{"x":84}',
      'revision-3'
    );
    expect(storage.saveAutosavedDesign).toHaveBeenCalled();

    await render({ applySource, delayMs: 500, revision: 'revision-3b', source: '{"x":85}' });
    storage.writeAutosaveRecovery.mockClear();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(storage.writeAutosaveRecovery).not.toHaveBeenCalled();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(storage.writeAutosaveRecovery).toHaveBeenCalled();
  });

  it('reports a failed write and can retry the same current snapshot', async () => {
    const applySource = vi.fn();
    storage.saveAutosavedDesign.mockRejectedValueOnce(new Error('quota'));
    await render({ applySource, delayMs: 20, revision: 'revision-error', source: '{"retry":true}' });
    await act(async () => {
      vi.advanceTimersByTime(20);
      await settle();
    });
    expect(states.at(-1)).toBe('error');

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await settle();
    });
    await act(async () => {
      vi.advanceTimersByTime(20);
      await settle();
    });
    expect(states.at(-1)).toBe('saved');
  });

  it('never applies or writes a superseded workspace while the next one hydrates', async () => {
    const applySource = vi.fn().mockResolvedValue(undefined);
    let resolveFirst!: (value: { revision: string; source: string }) => void;
    let resolveSecond!: (value: { revision: string; source: string }) => void;
    storage.loadAutosavedDesign.mockImplementation((workspaceKey: string) => (
      new Promise((resolve) => {
        if (workspaceKey === 'first') resolveFirst = resolve;
        else resolveSecond = resolve;
      })
    ));

    await render({ applySource, revision: 'revision-a', source: '{"a":true}', workspaceKey: 'first' });
    await render({ applySource, revision: 'revision-b', source: '{"b":true}', workspaceKey: 'second' });
    expect(storage.saveAutosavedDesign).not.toHaveBeenCalled();

    await act(async () => {
      resolveFirst({ revision: 'stored-a', source: '{"stored":"a"}' });
      await settle();
    });
    expect(applySource).not.toHaveBeenCalled();

    await act(async () => {
      resolveSecond({ revision: 'stored-b', source: '{"stored":"b"}' });
      await settle();
    });
    expect(applySource).toHaveBeenCalledOnce();
    expect(applySource).toHaveBeenCalledWith('{"stored":"b"}');
    expect(states.at(-1)).toBe('saved');
  });

  it('invariant_workspace_switch_flushes_each_source_only_under_its_own_key', async () => {
    const applySource = vi.fn();
    await render({
      applySource,
      delayMs: 500,
      revision: 'revision-a',
      source: '{"workspace":"a"}',
      workspaceKey: 'first',
    });
    storage.saveAutosavedDesign.mockClear();

    await render({
      applySource,
      delayMs: 500,
      revision: 'revision-b',
      source: '{"workspace":"b"}',
      workspaceKey: 'second',
    });

    expect(storage.saveAutosavedDesign).toHaveBeenCalledWith(
      'first',
      '{"workspace":"a"}',
      'revision-a',
      expect.any(String)
    );
    expect(storage.saveAutosavedDesign).not.toHaveBeenCalledWith(
      'first',
      '{"workspace":"b"}',
      'revision-b',
      expect.any(String)
    );
  });

  it('reports preparing without attempting incomplete writes', async () => {
    const applySource = vi.fn();
    await render({ applySource, revision: 'revision-4', source: null });
    expect(states.at(-1)).toBe('preparing');
    expect(storage.saveAutosavedDesign).not.toHaveBeenCalled();
  });

  it('reports a storage load failure', async () => {
    const applySource = vi.fn();
    storage.loadAutosavedDesign.mockRejectedValue(new Error('blocked'));
    await render({
      applySource,
      revision: 'revision-5',
      source: '{"ready":true}',
      workspaceKey: 'blocked-workspace',
    });
    expect(states.at(-1)).toBe('error');
  });
});
