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

export function originalLibraryAssets(sourceOwner: string, basePath: string): BrandAsset[] {
  const labels = ['Research wall', 'Field note', 'Window corner', 'Deep field', 'One focus per view', 'Workspace in focus', 'Window in five frames', 'Research board', 'Evidence to next step', 'Identity system', 'Working grid', 'Signal on night'];
  const types: BrandAsset['type'][] = ['image', 'image', 'texture', 'background', 'image', 'product', 'motion', 'image', 'image', 'image', 'texture', 'background'];
  const slots = ['overview', 'editorial', 'detail', 'atmosphere', 'campaign', 'interface', 'motion', 'hero', 'workflow', 'system', 'material', 'signal'];

  return slots.map((slot, index) => ({
    alt: `${sourceOwner} ${labels[index]}`,
    attribution: 'Original Glyphfield Starter artwork.',
    focalPoint: libraryFocalPoint('starter', slot),
    id: `library-${slot}`,
    label: `${sourceOwner} ${labels[index]}`,
    license: 'Glyphfield original',
    path: `${basePath}/library/${slot}.svg`,
    redistribution: 'original',
    sourceOwner: 'Glyphfield',
    sourceUrl: 'https://glyphfield.app',
    surface: 'any',
    tags: [
      types[index]!,
      'brand-diagram',
      'original-system',
      'people-free',
      ...(types[index] === 'product' ? ['centered-product'] : []),
      ...(types[index] === 'background' || types[index] === 'texture' ? ['background-safe'] : []),
    ],
    type: types[index]!,
    usage: 'Original Starter artwork built from the signal window: research boards, decisions and the window in use.',
  }));
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
