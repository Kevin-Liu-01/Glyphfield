/**
 * The identity's signature art: the asset tagged `cover`, else its
 * `identity-field` asset. Output tools lead with this file and fall back to the
 * generated graphic device only when an identity has none.
 */
import type { BrandAsset, BrandIdentity } from './brandIdentity';

const COVER_TYPES: ReadonlySet<BrandAsset['type']> = new Set(['background', 'image', 'motion', 'product', 'texture']);

/** True for a visual asset that an identity names as its signature art. */
export function isBrandCoverAsset(asset: Pick<BrandAsset, 'id' | 'tags' | 'type'>): boolean {
  return COVER_TYPES.has(asset.type) && (asset.id === 'identity-field' || Boolean(asset.tags?.includes('cover')));
}

export function brandCoverAsset(identity: Pick<BrandIdentity, 'assets'>): BrandAsset | undefined {
  const assets = (Array.isArray(identity.assets) ? identity.assets : []).filter(isBrandCoverAsset);
  return assets.find(({ tags }) => tags?.includes('cover')) ?? assets.find(({ id }) => id === 'identity-field');
}
