import { indexedDB as fakeIndexedDB } from 'fake-indexeddb';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  activeSavedDesignStorageKey,
  autosaveRecoveryStorageKey,
  autosavedDesignStorageKey,
  createAutosavedDesign,
  createSavedDesign,
  deleteSavedDesign,
  loadAutosavedDesign,
  loadSavedDesigns,
  saveAutosavedDesign,
  saveSavedDesign,
  savedDesignStorageKey,
  savedDesignRecordKey,
  uniqueDesignName,
  updateSavedDesign,
  writeAutosaveRecovery,
  type SavedDesign,
} from '@/lib/savedDesigns';

const DATABASE_NAME = 'glyphfield-saved-designs';
const localValues = new Map<string, string>();
const localStorage = {
  getItem: vi.fn((key: string) => localValues.get(key) ?? null),
  removeItem: vi.fn((key: string) => {
    localValues.delete(key);
  }),
  setItem: vi.fn((key: string, value: string) => {
    localValues.set(key, value);
  }),
};

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = fakeIndexedDB.deleteDatabase(DATABASE_NAME);
    request.addEventListener('success', () => resolve());
    request.addEventListener('error', () => reject(request.error));
  });
}

const saved: SavedDesign = {
  createdAt: '2026-08-17T12:00:00.000Z',
  id: 'design-1',
  name: 'Launch frame',
  origin: 'saved',
  source: '{"frame":1}',
  updatedAt: '2026-08-17T12:00:00.000Z',
};

describe('saved designs', () => {
  beforeEach(async () => {
    await deleteDatabase();
    localValues.clear();
    localStorage.getItem.mockClear();
    localStorage.removeItem.mockClear();
    localStorage.setItem.mockClear();
    vi.stubGlobal('indexedDB', fakeIndexedDB);
    vi.stubGlobal('window', { localStorage });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it('creates unique readable names without overwriting an existing design', () => {
    expect(uniqueDesignName([saved], 'Launch frame')).toBe('Launch frame 2');
    expect(uniqueDesignName([saved, { ...saved, id: 'design-2', name: 'Launch frame 2' }], 'Launch frame')).toBe('Launch frame 3');
  });

  it('records fork lineage while preserving the source recipe', () => {
    expect(createSavedDesign({
      designs: [saved],
      id: 'design-2',
      name: 'Launch frame · Fork',
      now: '2026-08-17T12:05:00.000Z',
      origin: 'fork',
      parentId: saved.id,
      revision: 'revision-2',
      source: saved.source,
    })).toMatchObject({
      id: 'design-2',
      name: 'Launch frame · Fork',
      origin: 'fork',
      parentId: saved.id,
      revision: 'revision-2',
      source: saved.source,
    });
  });

  it('updates only the active saved design', () => {
    const second = { ...saved, id: 'design-2', name: 'Second' };
    const updated = updateSavedDesign([saved, second], saved.id, {
      revision: 'revision-2',
      source: '{"frame":2}',
      updatedAt: '2026-08-17T12:10:00.000Z',
    });
    expect(updated[0]?.source).toBe('{"frame":2}');
    expect(updated[0]?.revision).toBe('revision-2');
    expect(updated[1]).toEqual(second);
  });

  it('names IndexedDB records by workspace and design without collisions', () => {
    expect(savedDesignRecordKey('glyphfield-saved-designs-v1:gt:shader-lab', 'design-1'))
      .toBe('glyphfield-saved-designs-v1:gt:shader-lab:design-1');
    expect(savedDesignStorageKey('gt', 'shader-lab')).toBe('glyphfield-saved-designs-v1:gt:shader-lab');
    expect(activeSavedDesignStorageKey('gt', 'shader-lab')).toBe('glyphfield-active-saved-design-v1:gt:shader-lab');
  });

  it('keeps the automatic working draft outside the named design workspace', () => {
    const workspaceKey = 'glyphfield-saved-designs-v1:gt:shader-lab';

    expect(autosavedDesignStorageKey(workspaceKey))
      .toBe('glyphfield-saved-designs-v1:gt:shader-lab:autosave');
    expect(createAutosavedDesign({
      now: '2026-08-31T12:00:00.000Z',
      revision: 'revision-3',
      source: '{"composition":{"layerOrder":["logo-1"]}}',
    })).toMatchObject({
      id: 'autosaved-draft',
      name: 'Autosaved draft',
      revision: 'revision-3',
      source: '{"composition":{"layerOrder":["logo-1"]}}',
    });
  });

  it('persists, updates, and deletes named designs in IndexedDB', async () => {
    const workspaceKey = savedDesignStorageKey('gt', 'shader-lab');
    await saveSavedDesign(workspaceKey, saved);
    expect(await loadSavedDesigns(workspaceKey)).toEqual([saved]);

    const updated = { ...saved, source: '{"frame":2}', updatedAt: '2026-08-17T13:00:00.000Z' };
    await saveSavedDesign(workspaceKey, updated);
    expect(await loadSavedDesigns(workspaceKey)).toEqual([updated]);

    await deleteSavedDesign(workspaceKey, saved.id);
    expect(await loadSavedDesigns(workspaceKey)).toEqual([]);
  });

  it('stores and replaces the single autosaved draft independently from named designs', async () => {
    const workspaceKey = savedDesignStorageKey('gt', 'shader-lab');
    await saveAutosavedDesign(workspaceKey, '{"frame":1}', 'revision-1', '2026-09-01T12:00:00.000Z');
    expect(await loadAutosavedDesign(workspaceKey)).toMatchObject({
      id: 'autosaved-draft',
      revision: 'revision-1',
      source: '{"frame":1}',
    });

    await saveAutosavedDesign(workspaceKey, '{"frame":2}', 'revision-2', '2026-09-01T12:01:00.000Z');
    expect(await loadAutosavedDesign(workspaceKey)).toMatchObject({
      revision: 'revision-2',
      source: '{"frame":2}',
    });
    expect(await loadAutosavedDesign('missing-workspace')).toBeNull();
  });

  it('recovers a newer unload journal into IndexedDB and then removes it', async () => {
    const workspaceKey = savedDesignStorageKey('gt', 'shader-lab');
    await saveAutosavedDesign(workspaceKey, '{"frame":1}', 'revision-1', '2026-09-01T12:00:00.000Z');

    expect(writeAutosaveRecovery(
      workspaceKey,
      '{"frame":2}',
      'revision-2',
      '2026-09-01T12:01:00.000Z'
    )).toBe(true);
    expect(await loadAutosavedDesign(workspaceKey)).toMatchObject({
      revision: 'revision-2',
      source: '{"frame":2}',
    });
    expect(localStorage.removeItem).toHaveBeenCalledWith(autosaveRecoveryStorageKey(workspaceKey));
    expect(await loadAutosavedDesign(workspaceKey)).toMatchObject({ revision: 'revision-2' });
  });

  it('keeps a newer IndexedDB draft and discards stale or malformed recovery data', async () => {
    const workspaceKey = savedDesignStorageKey('gt', 'shader-lab');
    const recoveryKey = autosaveRecoveryStorageKey(workspaceKey);
    await saveAutosavedDesign(workspaceKey, '{"frame":3}', 'revision-3', '2026-09-01T12:03:00.000Z');
    writeAutosaveRecovery(workspaceKey, '{"frame":2}', 'revision-2', '2026-09-01T12:02:00.000Z');

    expect(await loadAutosavedDesign(workspaceKey)).toMatchObject({ revision: 'revision-3' });
    localValues.set(recoveryKey, '{broken');
    expect(await loadAutosavedDesign(workspaceKey)).toMatchObject({ revision: 'revision-3' });
    expect(localValues.has(recoveryKey)).toBe(false);
  });

  it('falls back cleanly when synchronous recovery storage is unavailable', () => {
    localStorage.setItem.mockImplementationOnce(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    expect(writeAutosaveRecovery('large-workspace', 'large-source', 'revision-1')).toBe(false);
  });

  it('migrates valid legacy localStorage designs once and ignores malformed entries', async () => {
    const workspaceKey = savedDesignStorageKey('gt', 'shader-lab');
    const migrated = { ...saved, id: 'legacy-design' };
    localValues.set(workspaceKey, JSON.stringify([migrated, null, { id: 'broken' }]));

    expect(await loadSavedDesigns(workspaceKey)).toEqual([migrated]);
    expect(localStorage.removeItem).toHaveBeenCalledWith(workspaceKey);
    expect(await loadSavedDesigns(workspaceKey)).toEqual([migrated]);
  });

  it('returns an empty legacy set for invalid storage and reports unavailable browser storage', async () => {
    const workspaceKey = savedDesignStorageKey('gt', 'shader-lab');
    localValues.set(workspaceKey, '{not-json');
    expect(await loadSavedDesigns(workspaceKey)).toEqual([]);

    localValues.set(workspaceKey, '{}');
    expect(await loadSavedDesigns(workspaceKey)).toEqual([]);

    vi.stubGlobal('indexedDB', undefined);
    await expect(loadSavedDesigns(workspaceKey)).rejects.toThrow(/storage is unavailable/i);
  });

  it('keeps the IndexedDB migration authoritative when legacy cleanup is blocked', async () => {
    const workspaceKey = savedDesignStorageKey('gt', 'shader-lab');
    const migrated = { ...saved, id: 'cleanup-blocked' };
    localValues.set(workspaceKey, JSON.stringify([migrated]));
    localStorage.removeItem.mockImplementationOnce(() => {
      throw new Error('blocked');
    });

    expect(await loadSavedDesigns(workspaceKey)).toEqual([migrated]);
    expect(await loadSavedDesigns(workspaceKey)).toEqual([migrated]);
  });
});
