import type { BrandApplication, BrandAsset } from './brandIdentity';

// 23: regenerated built-ins (pairings, proportions, type scales, voice examples, font licenses).
// 24: product one-liners, customers apart from proof, samples, sharper strategy and voice, focal points.
export const REVISION = 24;

export function asset(
  id: string,
  label: string,
  path: string,
  surface: BrandAsset['surface'],
  type: BrandAsset['type'] = 'logo',
  usage?: string
): BrandAsset {
  return {
    alt: label,
    id,
    label,
    path,
    redistribution: type === 'proof' || type === 'reference' ? 'research-only' : 'bundled',
    surface,
    tags: id === 'identity-field' ? [type, 'brand-diagram'] : [type],
    type,
    usage,
  };
}

/**
 * Where the subject of each library image sits, as fractions of its width and
 * height. Layouts that crop an image to fill a frame keep this point in view.
 * Images without an entry are centred.
 */
const LIBRARY_FOCAL_POINTS: Readonly<Record<string, Readonly<Record<string, readonly [number, number]>>>> = {
  basement: { atmosphere: [0.62, 0.42], campaign: [0.42, 0.5], detail: [0.52, 0.5], editorial: [0.5, 0.45], motion: [0.38, 0.45], signal: [0.45, 0.55], system: [0.6, 0.55] },
  cloudflare: { atmosphere: [0.62, 0.5], detail: [0.5, 0.82], motion: [0.62, 0.5], signal: [0.55, 0.5] },
  gt: { atmosphere: [0.5, 0.5], detail: [0.5, 0.4] },
  mintlify: { atmosphere: [0.5, 0.3], editorial: [0.35, 0.5], motion: [0.3, 0.4] },
  ramp: { atmosphere: [0.76, 0.45], campaign: [0.45, 0.5], editorial: [0.5, 0.48], motion: [0.55, 0.5] },
  starter: { atmosphere: [0.68, 0.42], detail: [0.2, 0.2], hero: [0.47, 0.4], overview: [0.5, 0.5], signal: [0.5, 0.5] },
  stripe: { atmosphere: [0.7, 0.5], campaign: [0.35, 0.4], detail: [0.6, 0.65], editorial: [0.6, 0.6], motion: [0.4, 0.6] },
  tailwind: {},
  viteplus: { atmosphere: [0.25, 0.4], overview: [0.5, 0.2] },
};

export function libraryFocalPoint(brandId: string, slot: string): { x: number; y: number } {
  const [x, y] = LIBRARY_FOCAL_POINTS[brandId]?.[slot] ?? [0.5, 0.5];
  return { x, y };
}

export function originalLibraryAssets(
  brandId: 'gt' | 'starter',
  sourceOwner: string,
  basePath: string
): BrandAsset[] {
  const paths = brandId === 'gt'
    ? [
        '/brands/gt/library/overview.svg',
        '/brands/gt/library/editorial.svg',
        '/brands/gt/library/detail.svg',
        '/brands/gt/library/atmosphere.svg',
        '/brands/gt/library/campaign.svg',
        '/brands/gt/library/interface.svg',
        '/brands/gt/library/motion.svg',
        '/brands/gt/library/hero.svg',
        '/brands/gt/library/workflow.svg',
        '/brands/gt/library/system.svg',
        '/brands/gt/library/material.svg',
        '/brands/gt/library/signal.svg',
      ]
    : [
        `${basePath}/library/overview.svg`,
        `${basePath}/library/editorial.svg`,
        `${basePath}/library/detail.svg`,
        `${basePath}/library/atmosphere.svg`,
        `${basePath}/library/campaign.svg`,
        `${basePath}/library/interface.svg`,
        `${basePath}/library/motion.svg`,
        `${basePath}/library/hero.svg`,
        `${basePath}/library/workflow.svg`,
        `${basePath}/library/system.svg`,
        `${basePath}/library/material.svg`,
        `${basePath}/library/signal.svg`,
      ];
  const labels = brandId === 'gt'
    ? ['Monochrome identity field', 'Parallel scripts', 'Matte edge detail', 'Black field', 'Soft light study', 'Locale register', 'Language motion study', 'Gradient light field', 'Source alignment', 'Matte surface study', 'Grayscale range', 'Dithered light field']
    : ['Research wall', 'Field note', 'Window corner', 'Deep field', 'One focus per view', 'Workspace in focus', 'Window in five frames', 'Research board', 'Evidence to next step', 'Identity system', 'Working grid', 'Signal on night'];
  const types: BrandAsset['type'][] = ['image', 'image', 'texture', 'background', 'image', 'product', 'motion', 'image', 'image', 'image', 'texture', 'background'];
  const slots = ['overview', 'editorial', 'detail', 'atmosphere', 'campaign', 'interface', 'motion', 'hero', 'workflow', 'system', 'material', 'signal'];

  const assets: BrandAsset[] = paths.map((path, index) => {
    const isOriginalGtAsset = brandId === 'gt';
    const isNativeGtAsset = brandId === 'gt' && !isOriginalGtAsset;

    return {
      alt: `${sourceOwner} ${labels[index]}`,
      attribution: isNativeGtAsset
        ? 'Native General Translation multilingual and onboarding artwork.'
        : brandId === 'gt'
          ? 'Original Glyphfield monochrome surface study for General Translation; not official GT artwork.'
          : 'Original Glyphfield Starter artwork.',
      id: `library-${slots[index]}`,
      label: brandId === 'gt' ? labels[index] : `${sourceOwner} ${labels[index]}`,
      license: isNativeGtAsset ? 'General Translation source terms apply' : 'Glyphfield original',
      path,
      focalPoint: libraryFocalPoint(brandId, slots[index]!),
      redistribution: isNativeGtAsset ? 'research-only' : 'original',
      sourceOwner: isNativeGtAsset ? 'General Translation' : 'Glyphfield',
      sourceUrl: brandId === 'gt' ? 'https://generaltranslation.com/en-US/' : 'https://glyphfield.app',
      surface: 'any',
      tags: [
        types[index],
        ...(isNativeGtAsset ? ['source-native', 'official-site'] : ['brand-diagram', 'original-system']),
        'people-free',
        ...(types[index] === 'product' ? ['centered-product'] : []),
        ...(types[index] === 'background' || types[index] === 'texture' ? ['background-safe'] : []),
      ],
      type: types[index],
      usage: brandId === 'gt'
        ? isNativeGtAsset
          ? 'Native multilingual or onboarding artwork for GT identity studies and motion direction.'
          : 'Original monochrome light, dither, and matte-surface study for expressing language without literal workflow diagrams.'
        : 'Original Starter artwork built from the signal window: research boards, decisions and the window in use.',
    };
  });

  return assets;
}

export function application(
  id: string,
  name: string,
  category: BrandApplication['category'],
  format: string,
  description: string
): BrandApplication {
  return { category, description, format, id, name };
}
