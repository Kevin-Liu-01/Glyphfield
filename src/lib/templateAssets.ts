import type { BrandAsset, BrandIdentity } from '@/lib/brandIdentity';

export type TemplateKind = 'partnership' | 'blog' | 'slides';

const NORTHSTAR_PARTNER: BrandAsset = {
  id: 'template-northstar',
  label: 'Northstar',
  path: '/templates/logos/northstar.svg',
  surface: 'light',
  type: 'proof',
};

export function templateBrandLogo(
  identity: BrandIdentity,
  kind: TemplateKind,
  isDark: boolean
): BrandAsset | null {
  const preferredIds = kind === 'blog'
    ? [isDark ? 'mark-light' : 'mark-dark']
    : [isDark ? 'wordmark-light' : 'wordmark', isDark ? 'mark-light' : 'mark-dark'];

  for (const id of preferredIds) {
    const asset = identity.assets.find((candidate) => candidate.id === id);
    if (asset) return asset;
  }

  const surface = isDark ? 'dark' : 'light';
  return identity.assets.find(
    (asset) => asset.type === 'logo' && (asset.surface === surface || asset.surface === 'any')
  ) ?? null;
}

export function templatePartnerOptions(identity: BrandIdentity): BrandAsset[] {
  return [NORTHSTAR_PARTNER, ...identity.proofAssets];
}

export function defaultTemplatePartner(identity: BrandIdentity): BrandAsset {
  return identity.proofAssets.find(({ id }) => id === 'ramp')
    ?? identity.proofAssets[0]
    ?? NORTHSTAR_PARTNER;
}
