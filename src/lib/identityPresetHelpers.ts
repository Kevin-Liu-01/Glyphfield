import type { BrandApplication, BrandAsset } from './brandIdentity';

export const REVISION = 22;

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
        `${basePath}/library/overview.png`,
        `${basePath}/library/editorial.png`,
        `${basePath}/library/detail.png`,
        `${basePath}/library/atmosphere.png`,
        `${basePath}/library/campaign.png`,
        `${basePath}/library/interface.png`,
        `${basePath}/library/motion.png`,
        `${basePath}/library/hero.svg`,
        `${basePath}/library/workflow.svg`,
        `${basePath}/library/system.svg`,
        `${basePath}/library/material.svg`,
        `${basePath}/library/signal.svg`,
      ];
  const labels = brandId === 'gt'
    ? ['Monochrome identity field', 'Parallel scripts', 'Matte edge detail', 'Black field', 'Soft light study', 'Locale register', 'Language motion study', 'Gradient light field', 'Source alignment', 'Matte surface study', 'Grayscale range', 'Dithered light field']
    : ['Visual overview', 'Editorial crop', 'Product detail', 'Atmosphere strip', 'Campaign field', 'Interface evidence', 'Motion frame', 'Research hero', 'Evidence workflow', 'Identity system', 'Material field', 'Focus signal'];
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
      focalPoint: types[index] === 'product' ? { x: 0.5, y: 0.5 } : undefined,
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
        : 'Original evidence for Starter previews, moodboards, and identity applications.',
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
