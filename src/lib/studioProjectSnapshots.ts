export type StudioProjectSnapshot = { source: string; revision: string };

const readers = new Map<string, () => Promise<StudioProjectSnapshot>>();

/** Mounted editors supply their current document, not their last autosave. */
export function registerStudioProjectSnapshot(workspaceKey: string, read: () => Promise<StudioProjectSnapshot>) {
  readers.set(workspaceKey, read);
  return () => { if (readers.get(workspaceKey) === read) readers.delete(workspaceKey); };
}

export async function captureStudioProjectSnapshots(identityId: string) {
  const prefix = `glyphfield-saved-designs-v1:${identityId}:`;
  return new Map(await Promise.all([...readers].filter(([key]) => key.startsWith(prefix))
    .map(async ([key, read]) => [key, await read()] as const)));
}
