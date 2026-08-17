export type SavedDesignOrigin = 'clone' | 'fork' | 'saved';

export type SavedDesign = {
  createdAt: string;
  id: string;
  name: string;
  origin: SavedDesignOrigin;
  parentId?: string;
  source: string;
  updatedAt: string;
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
  source,
}: {
  designs: readonly SavedDesign[];
  id: string;
  name: string;
  now: string;
  origin: SavedDesignOrigin;
  parentId?: string;
  source: string;
}): SavedDesign {
  return {
    createdAt: now,
    id,
    name: uniqueDesignName(designs, name),
    origin,
    parentId,
    source,
    updatedAt: now,
  };
}

export function updateSavedDesign(
  designs: readonly SavedDesign[],
  id: string,
  patch: Partial<Pick<SavedDesign, 'name' | 'source' | 'updatedAt'>>
): SavedDesign[] {
  return designs.map((design) => design.id === id ? { ...design, ...patch } : design);
}

export function savedDesignStorageKey(identityId: string, toolId: string): string {
  return `glyphfield-saved-designs-v1:${identityId}:${toolId}`;
}

export function activeSavedDesignStorageKey(identityId: string, toolId: string): string {
  return `glyphfield-active-saved-design-v1:${identityId}:${toolId}`;
}
