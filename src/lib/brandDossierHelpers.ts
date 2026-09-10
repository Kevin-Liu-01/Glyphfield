import type {
  BrandArtDirection,
  BrandDossier,
  BrandReference,
} from './brandIdentity';

export type BrandSystemSource = {
  artDirection: BrandArtDirection;
  dossier: BrandDossier;
  references: BrandReference[];
};

type ReferenceSeed = {
  campaign: string[];
  concept: string[];
  material: string[];
  motion: string[];
  official: string[];
  officialSources?: string[];
  owner: string;
  sourceUrl: string;
};

export function referencePack(id: string, seed: ReferenceSeed): BrandReference[] {
  const nativeAssetIds = [
    'library-overview',
    'library-interface',
    'library-detail',
    'library-campaign',
    'library-editorial',
    'library-motion',
  ] as const;
  const entries = (
    Object.entries({
      official: seed.official,
      campaign: seed.campaign,
      concept: seed.concept,
      material: seed.material,
      motion: seed.motion,
    }) as [BrandReference['category'], string[]][]
  ).flatMap(([category, titles]) =>
    titles.map((title, index) => {
      const assetId = category === 'official'
        ? nativeAssetIds[index]
        : category === 'campaign' && index === 0
          ? 'library-atmosphere'
          : undefined;
      return {
      assetId,
      category,
      capturedAt: assetId ? '2026-07' : undefined,
      id: `${id}-${category}-${index + 1}`,
      intendedUse: `${category} reference for ${title.toLocaleLowerCase()}`,
      owner: assetId ? seed.owner : 'Reference owner to verify before capture',
      redistribution: 'research-only' as const,
      sourceUrl: assetId ? seed.officialSources?.[index] ?? seed.sourceUrl : '',
      status: category === 'official' && index === 0
        ? 'captured' as const
        : assetId
          ? 'reviewed' as const
          : 'planned' as const,
      title,
    }})
  );

  return entries;
}
