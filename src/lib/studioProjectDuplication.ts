import { waitForProjectAutosaveWrites } from '@/hooks/useCanvasDocumentAutosave';
import { capturePersistentValues } from '@/hooks/usePersistentState';
import { duplicateBrandIdentity, type BrandIdentity } from './brandIdentity';
import {
  autosavedDesignStorageKey, autosaveRecoveryStorageKey, createAutosavedDesign,
  loadProjectDesignRecords, savedDesignRecordKey, savedDesignStorageKey, saveProjectDesignRecords,
  type SavedDesign, type SavedDesignRecord,
} from './savedDesigns';
import { captureStudioProjectSnapshots } from './studioProjectSnapshots';

function mergeRecord(records: Map<string, SavedDesignRecord>, workspaceKey: string, design: SavedDesign) {
  if (!design || typeof design.id !== 'string' || typeof design.source !== 'string') {
    throw new Error('A saved design could not be read. The original project has not been changed.');
  }
  const key = savedDesignRecordKey(workspaceKey, design.id);
  const stored = records.get(key);
  if (!stored || design.updatedAt > stored.design.updatedAt) records.set(key, { key, workspaceKey, design });
}

export async function duplicateStudioProject(identity: BrandIdentity, existingNames: readonly string[]): Promise<BrandIdentity> {
  const copy = duplicateBrandIdentity(identity, undefined, existingNames);
  // Template creation may reseed generated marks. A project copy must preserve
  // the exact artwork as well as the canvases that use it.
  copy.assets = structuredClone(identity.assets);
  const workspacePrefix = savedDesignStorageKey(identity.id, '');
  const recoveryPrefix = autosaveRecoveryStorageKey(workspacePrefix);
  const prefixes = [`glyphfield-draft-v1:${identity.id}:`, `glyphfield-active-saved-design-v1:${identity.id}:`];
  // Capture at invocation, before asynchronous asset embedding/autosave completes.
  const local = capturePersistentValues([...prefixes, workspacePrefix, recoveryPrefix]);
  const snapshots = await captureStudioProjectSnapshots(identity.id);
  await waitForProjectAutosaveWrites(identity.id);
  const records = new Map((await loadProjectDesignRecords(identity.id)).map((record) => [record.key, record]));
  for (const [key, value] of local) {
    if (key.startsWith(workspacePrefix)) {
      const legacy: unknown = JSON.parse(value);
      if (!Array.isArray(legacy)) throw new Error('A saved project version could not be read.');
      for (const design of legacy) mergeRecord(records, key, design);
    } else if (key.startsWith(recoveryPrefix)) {
      mergeRecord(records, autosavedDesignStorageKey(key.slice('glyphfield-autosave-recovery-v1:'.length)), JSON.parse(value));
    }
  }
  for (const [workspaceKey, snapshot] of snapshots) {
    const design = createAutosavedDesign({ ...snapshot, now: new Date().toISOString() });
    const autosaveKey = autosavedDesignStorageKey(workspaceKey);
    const key = savedDesignRecordKey(autosaveKey, design.id);
    records.set(key, { key, workspaceKey: autosaveKey, design });
  }
  const copiedRecords = [...records.values()].map(({ design, workspaceKey }) => {
    const copiedWorkspaceKey = savedDesignStorageKey(copy.id, workspaceKey.slice(workspacePrefix.length));
    return { design, workspaceKey: copiedWorkspaceKey, key: savedDesignRecordKey(copiedWorkspaceKey, design.id) };
  });
  const writtenKeys: string[] = [];
  try {
    for (const [key, value] of local) {
      const prefix = prefixes.find((candidate) => key.startsWith(candidate));
      if (!prefix) continue; // Legacy versions/recovery are now in IndexedDB.
      const copiedKey = `${prefix.replace(`:${identity.id}:`, `:${copy.id}:`)}${key.slice(prefix.length)}`;
      window.localStorage.setItem(copiedKey, value);
      writtenKeys.push(copiedKey);
    }
    await saveProjectDesignRecords(copiedRecords);
  } catch (error) {
    for (const key of writtenKeys) window.localStorage.removeItem(key);
    throw error;
  }
  return copy;
}
