import {
  brandFontAssets,
  brandTypographyRole,
  type BrandAsset,
  type BrandIdentity,
} from '@/lib/brandIdentity';

export type TemplateKind = 'partnership' | 'blog' | 'slides';
export type TemplatePartnerTreatment = 'logo' | 'text';

export type TemplatePartnerFontOption = {
  family: string;
  id: string;
  label: string;
  letterSpacing: number;
  path: string;
  weight: number;
};

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
  const assetsById = new Map(identity.assets.map((asset) => [asset.id, asset]));
  const preferredAsset = preferredIds
    .map((id) => assetsById.get(id))
    .find((asset) => asset !== undefined);
  if (preferredAsset) return preferredAsset;

  const surface = isDark ? 'dark' : 'light';
  return identity.assets.find(
    (asset) => asset.type === 'logo' && (asset.surface === surface || asset.surface === 'any')
  ) ?? null;
}

export function templatePartnerOptions(identity: BrandIdentity): BrandAsset[] {
  return [NORTHSTAR_PARTNER, ...identity.proofAssets];
}

export function templateBackgroundOptions(identity: BrandIdentity): BrandAsset[] {
  return identity.assets.filter(
    ({ type }) => type === 'background' || type === 'image' || type === 'reference' || type === 'texture'
  );
}

export function defaultTemplatePartner(identity: BrandIdentity): BrandAsset {
  return identity.proofAssets.find(({ id }) => id === 'ramp')
    ?? identity.proofAssets[0]
    ?? NORTHSTAR_PARTNER;
}

export function templatePartnerFontOptions(
  identity: BrandIdentity,
  partnerId: string,
  availableIdentities: readonly BrandIdentity[]
): TemplatePartnerFontOption[] {
  const partnerIdentity = availableIdentities.find(({ id }) => id === partnerId);
  const sourceIdentities = partnerIdentity && partnerIdentity.id !== identity.id
    ? [partnerIdentity, identity]
    : [identity];

  return sourceIdentities.flatMap((sourceIdentity) => (
    brandFontAssets(sourceIdentity)
      .filter(({ style }) => style === 'normal')
      .map((font) => {
        const typography = sourceIdentity.typography.find(({ fontId }) => fontId === font.id);
        return {
          family: font.family,
          id: `${sourceIdentity.id}:${font.id}`,
          label: `${sourceIdentity.name} · ${font.label}`,
          letterSpacing: typography?.letterSpacing ?? 0,
          path: font.path,
          weight: font.weight,
        };
      })
  ));
}

export function defaultTemplatePartnerFont(
  identity: BrandIdentity,
  partnerId: string,
  availableIdentities: readonly BrandIdentity[]
): TemplatePartnerFontOption {
  const options = templatePartnerFontOptions(identity, partnerId, availableIdentities);
  const partnerIdentity = availableIdentities.find(({ id }) => id === partnerId);
  const partnerDisplayFontId = partnerIdentity
    ? brandTypographyRole(partnerIdentity, 'Display').fontId
    : undefined;
  const preferredId = partnerDisplayFontId
    ? `${partnerIdentity!.id}:${partnerDisplayFontId}`
    : undefined;
  return options.find(({ id }) => id === preferredId) ?? options[0]!;
}

export function defaultTemplatePartnerTreatment(
  _partnerId: string,
  _availableIdentities: readonly BrandIdentity[]
): TemplatePartnerTreatment {
  return 'logo';
}
