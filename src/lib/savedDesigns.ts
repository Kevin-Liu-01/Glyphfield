export type SavedDesignOrigin = 'clone' | 'fork' | 'saved';

export type SavedDesign = {
  createdAt: string;
  id: string;
  name: string;
  origin: SavedDesignOrigin;
  parentId?: string;
  revision?: string;
  source: string;
  updatedAt: string;
};

const SAVED_DESIGN_DATABASE_NAME = 'glyphfield-saved-designs';
const SAVED_DESIGN_DATABASE_VERSION = 1;
const SAVED_DESIGN_STORE_NAME = 'designs';
const SAVED_DESIGN_WORKSPACE_INDEX = 'workspaceKey';
const AUTOSAVED_DESIGN_ID = 'autosaved-draft';
const AUTOSAVE_RECOVERY_PREFIX = 'glyphfield-autosave-recovery-v1:';

type SavedDesignRecord = {
  design: SavedDesign;
  key: string;
  workspaceKey: string;
};

export function uniqueDesignName(designs: readonly SavedDesign[], requestedName: string): string {
  const base = requestedName.trim() || 'Untitled design';
  const names = new Set(designs.map(({ name }) => name.toLocaleLowerCase()));
  if (!names.has(base.toLocaleLowerCase())) return base;
  let index = 2;
  while (names.has(`${base} ${index}`.toLocaleLowerCase())) index += 1;
  return `${base} ${index}`;
}

export function createSavedDesign({
  designs,
  id,
  name,
  now,
  origin,
  parentId,
  revision,
  source,
}: {
  designs: readonly SavedDesign[];
  id: string;
  name: string;
  now: string;
  origin: SavedDesignOrigin;
  parentId?: string;
  revision?: string;
  source: string;
}): SavedDesign {
  return {
    createdAt: now,
    id,
    name: uniqueDesignName(designs, name),
    origin,
    parentId,
    revision,
    source,
    updatedAt: now,
  };
}

export function updateSavedDesign(
  designs: readonly SavedDesign[],
  id: string,
  patch: Partial<Pick<SavedDesign, 'name' | 'revision' | 'source' | 'updatedAt'>>
): SavedDesign[] {
  return designs.map((design) => design.id === id ? { ...design, ...patch } : design);
}

export function savedDesignStorageKey(identityId: string, toolId: string): string {
  return `glyphfield-saved-designs-v1:${identityId}:${toolId}`;
}

export function activeSavedDesignStorageKey(identityId: string, toolId: string): string {
  return `glyphfield-active-saved-design-v1:${identityId}:${toolId}`;
}

export function autosavedDesignStorageKey(workspaceKey: string): string {
  return `${workspaceKey}:autosave`;
}

export function autosaveRecoveryStorageKey(workspaceKey: string): string {
  return `${AUTOSAVE_RECOVERY_PREFIX}${workspaceKey}`;
}

export function createAutosavedDesign({
  now,
  revision,
  source,
}: {
  now: string;
  revision: string;
  source: string;
}): SavedDesign {
  return {
    createdAt: now,
    id: AUTOSAVED_DESIGN_ID,
    name: 'Autosaved draft',
    origin: 'saved',
    revision,
    source,
    updatedAt: now,
  };
}

function isSavedDesign(value: unknown): value is SavedDesign {
  if (!value || typeof value !== 'object') return false;
  const design = value as Partial<SavedDesign>;
  return typeof design.createdAt === 'string'
    && design.id === AUTOSAVED_DESIGN_ID
    && design.name === 'Autosaved draft'
    && design.origin === 'saved'
    && typeof design.source === 'string'
    && typeof design.updatedAt === 'string';
}

function readAutosaveRecovery(workspaceKey: string): SavedDesign | null {
  const key = autosaveRecoveryStorageKey(workspaceKey);
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === null) return null;
    const parsed = JSON.parse(stored) as unknown;
    if (isSavedDesign(parsed)) return parsed;
    window.localStorage.removeItem(key);
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Recovery storage is best-effort when browser privacy settings block it.
    }
  }
  return null;
}

export function writeAutosaveRecovery(
  workspaceKey: string,
  source: string,
  revision: string,
  now = new Date().toISOString()
): boolean {
  try {
    window.localStorage.setItem(
      autosaveRecoveryStorageKey(workspaceKey),
      JSON.stringify(createAutosavedDesign({ now, revision, source }))
    );
    return true;
  } catch {
    return false;
  }
}

function clearMatchingAutosaveRecovery(
  workspaceKey: string,
  source: string,
  revision: string
): void {
  const recovery = readAutosaveRecovery(workspaceKey);
  if (recovery?.source !== source || recovery.revision !== revision) return;
  try {
    window.localStorage.removeItem(autosaveRecoveryStorageKey(workspaceKey));
  } catch {
    // A stale recovery entry is harmless and will be retried on the next load.
  }
}

export function savedDesignRecordKey(workspaceKey: string, designId: string): string {
  return `${workspaceKey}:${designId}`;
}

function openSavedDesignDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Browser design storage is unavailable.'));
      return;
    }
    const request = indexedDB.open(SAVED_DESIGN_DATABASE_NAME, SAVED_DESIGN_DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
      const database = request.result;
      const store = database.createObjectStore(SAVED_DESIGN_STORE_NAME, { keyPath: 'key' });
      if (!store.indexNames.contains(SAVED_DESIGN_WORKSPACE_INDEX)) {
        store.createIndex(SAVED_DESIGN_WORKSPACE_INDEX, 'workspaceKey', { unique: false });
      }
    });
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('Saved designs could not be opened.')));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error ?? new Error('The saved design request failed.')));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve());
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('The saved design transaction was aborted.')));
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('The saved design transaction failed.')));
  });
}

function legacySavedDesigns(workspaceKey: string): SavedDesign[] {
  try {
    const source = window.localStorage.getItem(workspaceKey);
    if (source === null) return [];
    const parsed = JSON.parse(source) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((design): design is SavedDesign => Boolean(
          design
          && typeof design === 'object'
          && typeof (design as SavedDesign).id === 'string'
          && typeof (design as SavedDesign).source === 'string'
        ))
      : [];
  } catch {
    return [];
  }
}

async function writeSavedDesignRecords(
  database: IDBDatabase,
  workspaceKey: string,
  designs: readonly SavedDesign[]
): Promise<void> {
  if (designs.length === 0) return;
  const transaction = database.transaction(SAVED_DESIGN_STORE_NAME, 'readwrite');
  const store = transaction.objectStore(SAVED_DESIGN_STORE_NAME);
  designs.forEach((design) => {
    const record: SavedDesignRecord = {
      design,
      key: savedDesignRecordKey(workspaceKey, design.id),
      workspaceKey,
    };
    store.put(record);
  });
  await transactionComplete(transaction);
}

export async function loadSavedDesigns(workspaceKey: string): Promise<SavedDesign[]> {
  const database = await openSavedDesignDatabase();
  try {
    const transaction = database.transaction(SAVED_DESIGN_STORE_NAME, 'readonly');
    const records = await requestResult(
      transaction.objectStore(SAVED_DESIGN_STORE_NAME)
        .index(SAVED_DESIGN_WORKSPACE_INDEX)
        .getAll(workspaceKey)
    ) as SavedDesignRecord[];
    const storedDesigns = records.map(({ design }) => design);
    const legacyDesigns = legacySavedDesigns(workspaceKey).filter(
      (legacy) => !storedDesigns.some(({ id }) => id === legacy.id)
    );
    if (legacyDesigns.length > 0) {
      await writeSavedDesignRecords(database, workspaceKey, legacyDesigns);
      try {
        window.localStorage.removeItem(workspaceKey);
      } catch {
        // The IndexedDB copy is authoritative even when legacy cleanup is blocked.
      }
    }
    return [...storedDesigns, ...legacyDesigns];
  } finally {
    database.close();
  }
}

export async function saveSavedDesign(workspaceKey: string, design: SavedDesign): Promise<void> {
  const database = await openSavedDesignDatabase();
  try {
    await writeSavedDesignRecords(database, workspaceKey, [design]);
  } finally {
    database.close();
  }
}

export async function loadAutosavedDesign(workspaceKey: string): Promise<SavedDesign | null> {
  const designs = await loadSavedDesigns(autosavedDesignStorageKey(workspaceKey));
  const stored = designs.find(({ id }) => id === AUTOSAVED_DESIGN_ID) ?? null;
  const recovery = readAutosaveRecovery(workspaceKey);
  if (!recovery) return stored;
  if (stored && stored.updatedAt >= recovery.updatedAt) {
    clearMatchingAutosaveRecovery(workspaceKey, recovery.source, recovery.revision ?? '');
    return stored;
  }
  await saveSavedDesign(autosavedDesignStorageKey(workspaceKey), recovery);
  clearMatchingAutosaveRecovery(workspaceKey, recovery.source, recovery.revision ?? '');
  return recovery;
}

export async function saveAutosavedDesign(
  workspaceKey: string,
  source: string,
  revision: string,
  now = new Date().toISOString()
): Promise<void> {
  await saveSavedDesign(
    autosavedDesignStorageKey(workspaceKey),
    createAutosavedDesign({ now, revision, source })
  );
  clearMatchingAutosaveRecovery(workspaceKey, source, revision);
}

export async function deleteSavedDesign(workspaceKey: string, designId: string): Promise<void> {
  const database = await openSavedDesignDatabase();
  try {
    const transaction = database.transaction(SAVED_DESIGN_STORE_NAME, 'readwrite');
    transaction.objectStore(SAVED_DESIGN_STORE_NAME).delete(savedDesignRecordKey(workspaceKey, designId));
    await transactionComplete(transaction);
  } finally {
    database.close();
  }
}
