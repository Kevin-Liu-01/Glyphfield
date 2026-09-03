// @vitest-environment happy-dom

import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DesignVersionControls from '@/components/DesignVersionControls';
import { createCanvasDocument, serializeCanvasDocument } from '@/lib/canvasDocument';
import {
  activeSavedDesignStorageKey,
  loadSavedDesigns,
  saveSavedDesign,
  savedDesignStorageKey,
  type SavedDesign,
} from '@/lib/savedDesigns';

const DATABASE_NAME = 'glyphfield-saved-designs';
const WORKSPACE_KEY = savedDesignStorageKey('gt', 'design-lab');

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = fakeIndexedDB.deleteDatabase(DATABASE_NAME);
    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => reject(request.error));
  });
}

async function settle() {
  for (let index = 0; index < 4; index += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => window.setTimeout(resolve, 5));
  }
}

function button(label: string): HTMLButtonElement {
  const candidate = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!candidate) throw new Error(`Missing button: ${label}`);
  return candidate;
}

describe('DesignVersionControls', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    await deleteDatabase();
    vi.stubGlobal('indexedDB', fakeIndexedDB);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
      await settle();
    });
    document.body.replaceChildren();
    window.localStorage.clear();
    vi.unstubAllGlobals();
    await deleteDatabase();
  });

  async function render({
    collectionLabel,
    defaultName,
    draftLabel,
    itemLabel,
    layout,
    onNew,
    onOpen = vi.fn(),
    revision = 'revision-1',
    source = '{"version":3}',
  }: {
    collectionLabel?: string;
    defaultName?: string;
    draftLabel?: string;
    itemLabel?: string;
    layout?: 'panel' | 'toolbar';
    onNew?: () => Promise<void> | void;
    onOpen?: (source: string) => Promise<void> | void;
    revision?: string;
    source?: string | null;
  } = {}) {
    await act(() => {
      root.render(
        <DesignVersionControls
          collectionLabel={collectionLabel}
          defaultName={defaultName}
          draftLabel={draftLabel}
          identityId='gt'
          itemLabel={itemLabel}
          layout={layout}
          onNew={onNew}
          onOpen={onOpen}
          revision={revision}
          source={source}
          toolId='design-lab'
          workspaceLabel='Design Lab'
        />
      );
    });
    await act(async () => {
      await settle();
    });
  }

  async function click(target: HTMLButtonElement) {
    await act(async () => {
      target.click();
      await settle();
    });
  }

  async function changeInput(target: HTMLInputElement, value: string) {
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      valueSetter?.call(target, value);
      target.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    });
  }

  function savedDesign(overrides: Partial<SavedDesign> = {}): SavedDesign {
    return {
      createdAt: '2026-09-01T12:00:00.000Z',
      id: 'stored-design',
      name: 'Stored design',
      origin: 'saved',
      revision: 'stored-revision',
      source: '{"stored":true}',
      updatedAt: '2026-09-01T12:00:00.000Z',
      ...overrides,
    };
  }

  it('saves, forks, and clones complete portable source without overwriting lineage', async () => {
    await render();

    expect(button('Save design').disabled).toBe(false);
    await click(button('Save design'));
    let designs = await loadSavedDesigns(WORKSPACE_KEY);
    expect(designs).toHaveLength(1);
    expect(designs[0]).toMatchObject({
      origin: 'saved',
      revision: 'revision-1',
      source: '{"version":3}',
    });

    await click(button('Fork design'));
    designs = await loadSavedDesigns(WORKSPACE_KEY);
    const fork = designs.find(({ origin }) => origin === 'fork');
    expect(fork).toMatchObject({ parentId: designs.find(({ origin }) => origin === 'saved')?.id });

    await click(button('Clone design'));
    designs = await loadSavedDesigns(WORKSPACE_KEY);
    expect(designs.filter(({ origin }) => origin === 'clone')).toHaveLength(1);
    expect(designs.every(({ source }) => source === '{"version":3}')).toBe(true);
  });

  it('checkpoints an autosaved draft before starting a fresh animation', async () => {
    const onNew = vi.fn();
    await render({
      collectionLabel: 'Saved animations',
      defaultName: 'Untitled animation',
      draftLabel: 'Autosaved animation',
      itemLabel: 'animation',
      layout: 'panel',
      onNew,
    });

    expect(document.querySelector('[data-design-version-controls]')?.getAttribute('data-layout')).toBe('panel');
    await click(button('New animation'));

    expect(onNew).toHaveBeenCalledOnce();
    expect(await loadSavedDesigns(WORKSPACE_KEY)).toEqual([
      expect.objectContaining({
        name: 'Untitled animation',
        origin: 'saved',
        revision: 'revision-1',
        source: '{"version":3}',
      }),
    ]);
    const trigger = document.querySelector<HTMLButtonElement>('button[title="Open saved animations"]');
    expect(trigger?.textContent).toContain('Autosaved animation');
  });

  it('waits for asynchronous source application and reports open failures', async () => {
    const stored = savedDesign();
    await saveSavedDesign(WORKSPACE_KEY, stored);
    const onOpen = vi.fn().mockRejectedValue(new Error('Source rejected'));
    await render({ onOpen });

    const trigger = document.querySelector<HTMLButtonElement>('button[title="Open saved designs"]');
    if (!trigger) throw new Error('Missing saved designs trigger');
    await click(trigger);
    const open = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.textContent?.includes('Stored design'));
    if (!open) throw new Error('Missing stored design row');
    await click(open);

    expect(onOpen).toHaveBeenCalledWith('{"stored":true}');
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Source rejected');
  });

  it('opens, clones, and deletes stored designs without losing their portable source', async () => {
    const stored = savedDesign();
    await saveSavedDesign(WORKSPACE_KEY, stored);
    const onOpen = vi.fn().mockResolvedValue(undefined);
    await render({ onOpen });

    const trigger = document.querySelector<HTMLButtonElement>('button[title="Open saved designs"]');
    if (!trigger) throw new Error('Missing saved designs trigger');
    await click(trigger);
    const open = [...document.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.textContent?.includes('Stored design'));
    if (!open) throw new Error('Missing stored design row');
    await click(open);

    expect(onOpen).toHaveBeenLastCalledWith('{"stored":true}');
    expect(trigger.textContent).toContain('Stored design');

    await click(trigger);
    await click(button('Clone Stored design'));
    const clonedDesigns = await loadSavedDesigns(WORKSPACE_KEY);
    const clone = clonedDesigns.find(({ origin }) => origin === 'clone');
    expect(clone).toMatchObject({
      name: 'Stored design · Copy',
      revision: 'stored-revision',
      source: '{"stored":true}',
    });
    expect(onOpen).toHaveBeenLastCalledWith('{"stored":true}');
    expect(trigger.textContent).toContain('Stored design · Copy');

    await click(trigger);
    await click(button('Delete Stored design · Copy'));
    expect(await loadSavedDesigns(WORKSPACE_KEY)).toEqual([stored]);
    expect(trigger.textContent).toContain('Autosaved draft');
  });

  it('updates active source and normalizes duplicate names before persisting them', async () => {
    const active = savedDesign({ id: 'active-design', name: 'Alpha' });
    const sibling = savedDesign({ id: 'sibling-design', name: 'Beta' });
    await saveSavedDesign(WORKSPACE_KEY, active);
    await saveSavedDesign(WORKSPACE_KEY, sibling);
    window.localStorage.setItem(
      activeSavedDesignStorageKey('gt', 'design-lab'),
      JSON.stringify(active.id)
    );
    await render({ revision: 'revision-2', source: '{"stored":"updated"}' });

    await click(button('Save design'));
    let designs = await loadSavedDesigns(WORKSPACE_KEY);
    expect(designs.find(({ id }) => id === active.id)).toMatchObject({
      revision: 'revision-2',
      source: '{"stored":"updated"}',
    });

    const trigger = document.querySelector<HTMLButtonElement>('button[title="Open saved designs"]');
    if (!trigger) throw new Error('Missing saved designs trigger');
    await click(trigger);
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Current design name"]');
    if (!input) throw new Error('Missing current design name input');
    await changeInput(input, 'Beta');
    await act(async () => {
      input.focus();
      input.blur();
      await settle();
    });

    designs = await loadSavedDesigns(WORKSPACE_KEY);
    expect(designs.find(({ id }) => id === active.id)?.name).toBe('Beta 2');
  });

  it('does not mark an equivalent reopened canvas dirty when its legacy revision differs', async () => {
    const canvasSource = serializeCanvasDocument(
      createCanvasDocument('saved-canvas', 'gt', 'Saved canvas', 800, 600, ['pages'])
    );
    const active = savedDesign({ revision: 'legacy-revision', source: canvasSource });
    await saveSavedDesign(WORKSPACE_KEY, active);
    window.localStorage.setItem(
      activeSavedDesignStorageKey('gt', 'design-lab'),
      JSON.stringify(active.id)
    );

    await render({ revision: 'canonical-revision', source: canvasSource });

    expect(button('Design saved').disabled).toBe(true);
  });

  it('disables version actions while portable assets are still preparing', async () => {
    await render({ source: null });

    expect(button('Save design').disabled).toBe(true);
    expect(button('Fork design').disabled).toBe(true);
    expect(button('Clone design').disabled).toBe(true);
  });
});
