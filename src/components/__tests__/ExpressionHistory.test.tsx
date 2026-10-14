// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useExpressionDocument } from '@/components/expressions/useExpressionDocument';
import { BUILT_IN_BRAND_IDENTITIES } from '@/lib/brandIdentity';
import { patchElement, slotElement } from '@/lib/expressionModel';
import { createExpressionDocument } from '@/lib/expressionTemplates';

type Handle = ReturnType<typeof useExpressionDocument>;

describe('expression editor history', () => {
  let container: HTMLDivElement;
  let root: Root;
  let handle: Handle;
  const identity = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'gt')!;
  const initial = createExpressionDocument('blog', identity);
  const headlineId = slotElement(initial, initial.pageIds[0]!, 'headline')!.id;

  function Probe() {
    handle = useExpressionDocument(() => initial);
    return null;
  }

  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    await act(() => root.render(<Probe />));
  });

  afterEach(async () => {
    await act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const content = () => handle.document.elements[headlineId]!.content;

  it('coalesces a burst of typing into one undo step and redoes it', async () => {
    for (const value of ['S', 'Sh', 'Shi', 'Ship']) {
      await act(() => { handle.commit((current) => patchElement(current, headlineId, { content: value }), { coalesce: 'type' }); });
    }
    expect(content()).toBe('Ship');
    expect(handle.canUndo).toBe(true);
    await act(() => { handle.undo(); });
    expect(content()).toBe(initial.elements[headlineId]!.content);
    expect(handle.canUndo).toBe(false);
    await act(() => { handle.redo(); });
    expect(content()).toBe('Ship');
  });

  it('keeps separate steps for separate edits and resets on hydration', async () => {
    await act(() => { handle.commit((current) => patchElement(current, headlineId, { content: 'One' }), { label: 'First' }); });
    await act(() => { handle.commit((current) => patchElement(current, headlineId, { content: 'Two' }), { label: 'Second' }); });
    expect(handle.entries.map(({ label }) => label)).toEqual(['First', 'Second']);
    await act(() => { handle.undo(); });
    expect(content()).toBe('One');
    await act(() => { handle.reset(initial); });
    expect(handle.canUndo).toBe(false);
    expect(handle.canRedo).toBe(false);
    expect(handle.editedRef.current).toBe(true);
  });

  it('keeps untouched layers referentially equal so memoized layers skip work', async () => {
    const other = initial.pages[initial.pageIds[0]!]!.elementIds.find((id) => id !== headlineId)!;
    await act(() => { handle.commit((current) => patchElement(current, headlineId, { content: 'Changed' })); });
    expect(handle.document.elements[other]).toBe(initial.elements[other]);
    expect(handle.document.elements[headlineId]).not.toBe(initial.elements[headlineId]);
  });
});
