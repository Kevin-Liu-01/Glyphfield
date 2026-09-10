// @vitest-environment happy-dom

import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DesignVersionControls, { DesignVersionFileActions, DesignVersionHistory, DesignVersionProvider } from '@/components/DesignVersionControls';
import { createCanvasDocument, serializeCanvasDocument } from '@/lib/canvasDocument';
import * as savedDesignStore from '@/lib/savedDesigns';
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
    // Flush the application's debounced active-design write before replacing
    // storage fixtures. Otherwise the next test can hydrate this test's queued ID.
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    window.localStorage.clear();
    vi.unstubAllGlobals();
    await deleteDatabase();
  });

  async function render({
    collectionLabel,
    defaultName,
    draftLabel,
    identityId = 'gt',
    itemLabel,
    layout,
    onNew,
    onOpen = vi.fn(),
    prepareSource,
    revision = 'revision-1',
    source = '{"version":3}',
  }: {
    collectionLabel?: string;
    defaultName?: string;
    draftLabel?: string;
    identityId?: string;
    itemLabel?: string;
    layout?: 'panel' | 'toolbar';
    onNew?: () => Promise<void> | void;
    onOpen?: (source: string) => Promise<void> | void;
    prepareSource?: () => Promise<string | { source: string; revision: string }>;
    revision?: string;
    source?: string | null;
  } = {}) {
    await act(() => {
      root.render(
        <DesignVersionControls
          collectionLabel={collectionLabel}
          defaultName={defaultName}
          draftLabel={draftLabel}
          identityId={identityId}
          itemLabel={itemLabel}
          layout={layout}
          onNew={onNew}
          onOpen={onOpen}
          prepareSource={prepareSource}
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

  it('shares one checkpoint owner across split history and file actions without rerendering workspace children', async () => {
    expect(DesignVersionProvider).toBeTypeOf('function');
    let finishCapture!: (source: { source: string; revision: string }) => void;
    const prepareSource = vi.fn(() => new Promise<{ source: string; revision: string }>((resolve) => { finishCapture = resolve; }));
    const loadSpy = vi.spyOn(savedDesignStore, 'loadSavedDesigns');
    const workspaceRender = vi.fn();
    function Workspace() {
      workspaceRender();
      return <main data-testid='workspace'>Canvas workspace</main>;
    }
    try {
      await act(() => {
        root.render(<DesignVersionProvider identityId='gt' onOpen={vi.fn()} prepareSource={prepareSource}
          revision='before-capture' source='{"before":true}' toolId='design-lab' workspaceLabel='Design Lab'>
          <header data-testid='file-actions'><DesignVersionFileActions /></header>
          <Workspace />
          <aside data-testid='version-history'><DesignVersionHistory /></aside>
        </DesignVersionProvider>);
      });
      await act(async () => { await settle(); });
      expect(loadSpy).toHaveBeenCalledExactlyOnceWith(WORKSPACE_KEY);
      expect(button('Save design').disabled).toBe(false);
      await click(button('Save design'));
      expect(prepareSource).toHaveBeenCalledOnce();
      expect(button('Fork design').disabled).toBe(true);
      expect(container.querySelector('[data-testid="version-history"] [aria-label="Saving"]')).not.toBeNull();
      await click(container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!);
      expect(document.querySelector('[role="region"]')?.textContent).toContain('Saved designs');
      await act(async () => {
        finishCapture({ source: '{"captured":true}', revision: 'before-capture' });
        await settle();
      });
      expect(await loadSavedDesigns(WORKSPACE_KEY)).toEqual([
        expect.objectContaining({ source: '{"captured":true}', revision: 'before-capture' }),
      ]);
      expect(button('Design saved').disabled).toBe(true);
      expect(container.querySelector('[data-testid="version-history"]')?.textContent).toContain('Untitled design');
      expect(workspaceRender).toHaveBeenCalledOnce();
    } finally {
      loadSpy.mockRestore();
    }
  });

  it('opens, forks, and clones through split controls using the same active checkpoint and focus anchor', async () => {
    expect(DesignVersionProvider).toBeTypeOf('function');
    const stored = savedDesign();
    await saveSavedDesign(WORKSPACE_KEY, stored);
    const onOpen = vi.fn();
    await act(() => {
      root.render(<DesignVersionProvider identityId='gt' onOpen={onOpen} revision={stored.revision}
        source={stored.source} toolId='design-lab' workspaceLabel='Design Lab'>
        <header><DesignVersionFileActions /></header>
        <aside><DesignVersionHistory /></aside>
      </DesignVersionProvider>);
    });
    await act(async () => { await settle(); });
    const trigger = container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!;
    await click(trigger);
    const open = [...document.querySelectorAll<HTMLButtonElement>('[role="region"] button')]
      .find((candidate) => candidate.textContent?.includes(stored.name))!;
    await click(open);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(stored.source);
    expect(button('Design saved').disabled).toBe(true);
    await click(button('Fork design'));
    let designs = await loadSavedDesigns(WORKSPACE_KEY);
    const fork = designs.find(({ origin }) => origin === 'fork')!;
    expect(fork.parentId).toBe(stored.id);
    expect(trigger.textContent).toContain(fork.name);
    await click(button('Clone design'));
    designs = await loadSavedDesigns(WORKSPACE_KEY);
    const clone = designs.find(({ origin }) => origin === 'clone')!;
    expect(clone.parentId).toBeUndefined();
    expect(clone.source).toBe(stored.source);
    expect(trigger.textContent).toContain(clone.name);
    await click(trigger);
    const region = document.querySelector<HTMLElement>('[role="region"]')!;
    expect(container.contains(region)).toBe(false);
    await act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[role="region"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

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

  it('waits for an exact prepared source before saving and blocks duplicate capture requests', async () => {
    let finishCapture!: (source: string) => void;
    const capture = new Promise<string>((resolve) => { finishCapture = resolve; });
    const prepareSource = vi.fn(() => capture);
    await render({ prepareSource, source: '{"stale":true}' });
    await click(button('Save design'));
    expect(prepareSource).toHaveBeenCalledTimes(1);
    expect(await loadSavedDesigns(WORKSPACE_KEY)).toHaveLength(0);
    expect(button('Fork design').disabled).toBe(true);
    await click(button('Fork design'));
    expect(prepareSource).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishCapture('{"capturedFrame":1234.5}');
      await settle();
    });
    expect(await loadSavedDesigns(WORKSPACE_KEY)).toEqual([
      expect.objectContaining({ source: '{"capturedFrame":1234.5}' }),
    ]);
  });

  it('does not save an old source when exact frame preparation fails', async () => {
    const prepareSource = vi.fn(async () => { throw new Error('Shader frame is not ready.'); });
    await render({ prepareSource, source: '{"stale":true}' });
    await click(button('Save design'));
    expect(await loadSavedDesigns(WORKSPACE_KEY)).toHaveLength(0);
    expect(document.body.textContent).toContain('Shader frame is not ready.');
    expect(button('Save design').disabled).toBe(false);
  });

  it.each([false, true])('does not activate an old workspace save after switching projects (existing=%s)', async (existing) => {
    const active = savedDesign({ id: 'old-workspace-design', name: 'Old workspace' });
    if (existing) {
      await saveSavedDesign(WORKSPACE_KEY, active);
      window.localStorage.setItem(activeSavedDesignStorageKey('gt', 'design-lab'), JSON.stringify(active.id));
    }
    await render({ revision: 'updated', source: '{"saved":"old workspace"}' });
    let finishWrite!: () => void;
    const pending = new Promise<void>((resolve) => { finishWrite = resolve; });
    const originalSave = savedDesignStore.saveSavedDesign;
    const saveSpy = vi.spyOn(savedDesignStore, 'saveSavedDesign').mockImplementationOnce(async (...args) => {
      await pending;
      return originalSave(...args);
    });
    try {
      await click(button('Save design'));
      expect(saveSpy).toHaveBeenCalledOnce();
      await render({ identityId: 'other-project', defaultName: 'New workspace', source: '{"new":true}' });
      await act(async () => { finishWrite(); await settle(); });
      window.dispatchEvent(new PageTransitionEvent('pagehide'));
      expect((await loadSavedDesigns(WORKSPACE_KEY))[0]?.source).toBe('{"saved":"old workspace"}');
      expect(await loadSavedDesigns(savedDesignStorageKey('other-project', 'design-lab'))).toEqual([]);
      expect(window.localStorage.getItem(activeSavedDesignStorageKey('other-project', 'design-lab'))).toBeNull();
      expect(container.textContent).not.toContain('Old workspace');
      await click(container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!);
      expect(document.querySelector('[role="region"]')?.textContent).not.toContain('Old workspace');
    } finally {
      finishWrite();
      saveSpy.mockRestore();
    }
  });

  it('stores the captured revision instead of the revision from before preparation', async () => {
    await render({ revision: 'before-capture', prepareSource: async () => ({ source: '{"captured":true}', revision: 'captured-revision' }) });
    await click(button('Save design'));
    expect(await loadSavedDesigns(WORKSPACE_KEY)).toEqual([
      expect.objectContaining({ source: '{"captured":true}', revision: 'captured-revision' }),
    ]);
  });

  it('does not restore another checkpoint while a fork is still being persisted', async () => {
    const active = savedDesign({ id: 'active-design', name: 'Alpha' });
    const other = savedDesign({ id: 'other-design', name: 'Beta', source: '{"canvas":"Beta"}' });
    await saveSavedDesign(WORKSPACE_KEY, active);
    await saveSavedDesign(WORKSPACE_KEY, other);
    window.localStorage.setItem(activeSavedDesignStorageKey('gt', 'design-lab'), JSON.stringify(active.id));
    const onOpen = vi.fn();
    const editedSource = '{"canvas":"edited Alpha","image":"data:image/png;base64,cHJlc2VydmU="}';
    await render({ onOpen, revision: 'edited-alpha', source: editedSource });
    await click(container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!);

    let finishWrite!: () => void;
    const write = new Promise<void>((resolve) => { finishWrite = resolve; });
    const persist = savedDesignStore.saveSavedDesign;
    const saveSpy = vi.spyOn(savedDesignStore, 'saveSavedDesign').mockImplementationOnce(async (key, design) => {
      await write;
      await persist(key, design);
    });
    try {
      await click(button('Fork design'));
      const openOther = [...document.querySelectorAll<HTMLButtonElement>('[role="region"] button')]
        .find((candidate) => candidate.textContent?.includes('Beta'))!;
      await click(openOther);
      expect(onOpen).not.toHaveBeenCalled();
      expect(openOther.disabled).toBe(true);
    } finally {
      await act(async () => {
        finishWrite();
        await settle();
      });
      saveSpy.mockRestore();
    }
    const fork = (await loadSavedDesigns(WORKSPACE_KEY)).find(({ origin }) => origin === 'fork');
    expect(fork).toMatchObject({ parentId: active.id, revision: 'edited-alpha', source: editedSource });
    expect(button('Design saved').disabled).toBe(true);
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

  it('blocks save and other checkpoint operations until source restoration finishes', async () => {
    const first = savedDesign({ id: 'first-design', name: 'Alpha' });
    const second = savedDesign({ id: 'second-design', name: 'Beta', source: '{"canvas":"Beta"}' });
    await saveSavedDesign(WORKSPACE_KEY, first);
    await saveSavedDesign(WORKSPACE_KEY, second);
    let finishOpen!: () => void;
    const applying = new Promise<void>((resolve) => { finishOpen = resolve; });
    const onOpen = vi.fn(() => applying);
    await render({ onOpen });
    const trigger = container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!;
    await click(trigger);
    const rows = [...document.querySelectorAll<HTMLButtonElement>('[role="region"] button')];
    const openFirst = rows.find((candidate) => candidate.textContent?.includes('Alpha'))!;
    const openSecond = rows.find((candidate) => candidate.textContent?.includes('Beta'))!;
    await click(openFirst);
    expect(document.querySelector('[aria-label="Opening"]')).not.toBeNull();
    expect(button('Save design').disabled).toBe(true);
    expect(button('Fork design').disabled).toBe(true);
    expect(button('Clone design').disabled).toBe(true);
    expect(openSecond.disabled).toBe(true);
    await click(openSecond);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(first.source);
    await act(async () => {
      finishOpen();
      await settle();
    });
    expect(trigger.textContent).toContain('Alpha');
    expect(button('Fork design').disabled).toBe(false);
    expect(document.querySelector('[role="region"]')).toBeNull();
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

  it('keeps the current checkpoint selected when a stored clone cannot be restored', async () => {
    const active = savedDesign({ id: 'active-design', name: 'Alpha' });
    const other = savedDesign({ id: 'other-design', name: 'Beta', source: '{"image":"data:image/png;base64,QmV0YQ=="}' });
    await saveSavedDesign(WORKSPACE_KEY, active);
    await saveSavedDesign(WORKSPACE_KEY, other);
    window.localStorage.setItem(activeSavedDesignStorageKey('gt', 'design-lab'), JSON.stringify(active.id));
    const onOpen = vi.fn().mockRejectedValue(new Error('Clone source rejected'));
    await render({ onOpen, revision: active.revision, source: active.source });
    const trigger = container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!;
    await click(trigger);
    await click(button('Clone Beta'));

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(other.source);
    expect(trigger.textContent).toContain('Alpha');
    expect(trigger.textContent).not.toContain('Beta');
    expect(button('Design saved').disabled).toBe(true);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Clone source rejected');
    const designs = await loadSavedDesigns(WORKSPACE_KEY);
    expect(designs.find(({ origin }) => origin === 'clone')).toMatchObject({ name: 'Beta · Copy', source: other.source });
    expect(designs.find(({ id }) => id === active.id)).toEqual(active);
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

  it('saves the edited canvas when clicking Save directly from the checkpoint name field', async () => {
    const active = savedDesign({ id: 'active-design', name: 'Alpha' });
    const sibling = savedDesign({ id: 'sibling-design', name: 'Beta' });
    await saveSavedDesign(WORKSPACE_KEY, active);
    await saveSavedDesign(WORKSPACE_KEY, sibling);
    window.localStorage.setItem(
      activeSavedDesignStorageKey('gt', 'design-lab'),
      JSON.stringify(active.id)
    );
    await render({ revision: 'revision-2', source: '{"canvas":"edited"}' });
    const trigger = document.querySelector<HTMLButtonElement>('button[title="Open saved designs"]');
    if (!trigger) throw new Error('Missing saved designs trigger');
    await click(trigger);
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Current design name"]');
    if (!input) throw new Error('Missing current design name input');
    await changeInput(input, 'Beta');

    // Browsers blur the text field before dispatching the Save button's click.
    await act(async () => {
      input.focus();
      input.blur();
      await Promise.resolve();
    });
    expect(button('Save design').disabled).toBe(false);
    await click(button('Save design'));

    const designs = await loadSavedDesigns(WORKSPACE_KEY);
    expect(designs.find(({ id }) => id === active.id)).toMatchObject({
      name: 'Beta 2',
      revision: 'revision-2',
      source: '{"canvas":"edited"}',
    });
    expect(designs.find(({ id }) => id === sibling.id)).toEqual(sibling);
    expect(button('Design saved').disabled).toBe(true);
  });

  it('disables version actions while portable assets are still preparing', async () => {
    await render({ source: null });

    expect(button('Save design').disabled).toBe(true);
    expect(button('Fork design').disabled).toBe(true);
    expect(button('Clone design').disabled).toBe(true);
  });

  it('portals toolbar checkpoints above the editor and preserves naming, focus, and scroll anchoring', async () => {
    const active = savedDesign({ name: 'Alpha' });
    await saveSavedDesign(WORKSPACE_KEY, active);
    window.localStorage.setItem(
      activeSavedDesignStorageKey('gt', 'design-lab'),
      JSON.stringify(active.id)
    );
    await render();
    const anchor = container.querySelector<HTMLDivElement>('[data-design-version-controls]')!;
    let bounds = { left: 500, right: 700, top: 100, bottom: 132, width: 200, height: 32 };
    vi.spyOn(anchor, 'getBoundingClientRect').mockImplementation(() => bounds as DOMRect);
    const trigger = container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!;
    await click(trigger);
    const region = document.querySelector<HTMLElement>('[role="region"]')!;
    expect(container.contains(region)).toBe(false);
    expect(region.parentElement?.style.left).toBe('340px');
    expect(region.parentElement?.style.top).toBe('142px');
    const input = region.querySelector<HTMLInputElement>('input')!;
    expect(document.activeElement).toBe(input);
    await act(() => {
      input.focus();
      input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    });
    expect(document.querySelector('[role="region"]')).toBe(region);
    await changeInput(input, 'Renamed checkpoint');
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
    });
    expect(document.querySelector('[role="region"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect((await loadSavedDesigns(WORKSPACE_KEY))[0]?.name).toBe('Renamed checkpoint');

    await click(trigger);
    const firstRow = document.querySelector<HTMLButtonElement>('[role="region"] button')!;
    await act(() => firstRow.focus());
    bounds = { ...bounds, left: 460, right: 660, top: 80, bottom: 112 };
    await act(() => window.dispatchEvent(new Event('scroll')));
    expect(document.activeElement).toBe(firstRow);
    const movedRegion = document.querySelector<HTMLElement>('[role="region"]')!;
    expect(movedRegion.parentElement?.style.left).toBe('300px');
    expect(movedRegion.parentElement?.style.top).toBe('122px');
    const renamedInput = movedRegion.querySelector<HTMLInputElement>('input')!;
    await changeInput(renamedInput, 'Outside committed');
    await act(async () => {
      renamedInput.focus();
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      await settle();
    });
    expect(document.querySelector('[role="region"]')).toBeNull();
    expect((await loadSavedDesigns(WORKSPACE_KEY))[0]?.name).toBe('Outside committed');
  });

  it('keeps the panel-layout checkpoint list in its sidebar', async () => {
    await render({ layout: 'panel' });
    const trigger = container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!;
    await click(trigger);
    expect(container.querySelector('[role="region"]')).not.toBeNull();
  });

  it('focuses the first saved checkpoint when opening from an unnamed draft and returns on Escape', async () => {
    await saveSavedDesign(WORKSPACE_KEY, savedDesign());
    await render();
    const trigger = container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!;
    await act(() => trigger.focus());
    await click(trigger);
    const firstRow = document.querySelector<HTMLButtonElement>('[role="region"] button')!;
    expect(document.activeElement).toBe(firstRow);
    await act(() => firstRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.activeElement).toBe(trigger);
    expect(document.querySelector('[role="region"]')).toBeNull();
  });

  it.each(['tool', 'project'] as const)('closes a portal when its retained %s workspace is deactivated without a pointer event', async (owner) => {
    const project = document.createElement('div');
    project.className = 'studio-project-workspace-layer';
    project.dataset.active = 'true';
    const tool = document.createElement('div');
    tool.className = 'studio-workspace-layer';
    tool.dataset.active = 'true';
    document.body.append(project);
    project.append(tool);
    tool.append(container);
    const active = savedDesign({ name: 'Before navigation' });
    await saveSavedDesign(WORKSPACE_KEY, active);
    window.localStorage.setItem(
      activeSavedDesignStorageKey('gt', 'design-lab'),
      JSON.stringify(active.id)
    );
    await render();
    const trigger = container.querySelector<HTMLButtonElement>('button[title="Open saved designs"]')!;
    await click(trigger);
    const input = document.querySelector<HTMLInputElement>('[role="region"] input')!;
    expect(document.activeElement).toBe(input);
    await changeInput(input, 'Named before switching');

    const inactiveOwner = owner === 'tool' ? tool : project;
    await act(async () => {
      inactiveOwner.dataset.active = 'false';
      inactiveOwner.setAttribute('inert', '');
      await settle();
    });
    expect(document.querySelector('[role="region"]')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).not.toBe(trigger);
    expect((await loadSavedDesigns(WORKSPACE_KEY))[0]?.name).toBe('Named before switching');

    await act(async () => {
      inactiveOwner.dataset.active = 'true';
      inactiveOwner.removeAttribute('inert');
      await settle();
    });
    expect(document.querySelector('[role="region"]')).toBeNull();
  });
});
