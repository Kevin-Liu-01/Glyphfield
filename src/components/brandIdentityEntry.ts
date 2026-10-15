import type { BrandIdentitySectionId } from '@/components/BrandIdentityFrontPage';

// A new project's Brand identity editor mounts after its tab opens, so the request waits here.
const requestedSections = new Map<string, BrandIdentitySectionId>();

/** Opens a project's Brand identity editor on `section` the next time it mounts. */
export function requestBrandIdentitySection(identityId: string, section: BrandIdentitySectionId) {
  requestedSections.set(identityId, section);
}

/** Returns and clears the section requested for this project, if any. */
export function takeBrandIdentitySection(identityId: string): BrandIdentitySectionId | undefined {
  const section = requestedSections.get(identityId);
  requestedSections.delete(identityId);
  return section;
}
