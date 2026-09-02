import type { BrandAsset, BrandIdentity } from './brandIdentity';
import { moodboardAssets } from './moodboard';

type BrandAuditSeverity = 'error' | 'warning';

type BrandAuditCheck = {
  actual: number;
  id:
    | 'applications'
    | 'asset-provenance'
    | 'asset-taxonomy'
    | 'asset-uniqueness'
    | 'background-safety'
    | 'font-bindings'
    | 'diagram-system'
    | 'library-completeness'
    | 'moodboard-original-assets'
    | 'moodboard-readiness'
    | 'native-source-media'
    | 'product-framing'
    | 'reference-depth'
    | 'reference-evidence'
    | 'unique-composition'
    | 'unique-moodboard'
    | 'visual-library';
  label: string;
  message: string;
  minimum: number;
  passed: boolean;
  severity: BrandAuditSeverity;
};

export type BrandAuditReport = {
  checks: BrandAuditCheck[];
  id: string;
  name: string;
  score: number;
  status: 'fail' | 'pass' | 'warn';
  summary: {
    assets: number;
    capturedReferences: number;
    diagrams: number;
    fonts: number;
    moodboardAssets: number;
    nativeMedia: number;
    references: number;
    visualAssets: number;
  };
};

const VISUAL_ASSET_TYPES: readonly BrandAsset['type'][] = [
  'background',
  'image',
  'motion',
  'product',
  'proof',
  'reference',
  'texture',
];

const REQUIRED_LIBRARY_SLOTS = [
  'library-overview',
  'library-editorial',
  'library-detail',
  'library-atmosphere',
  'library-campaign',
  'library-interface',
  'library-motion',
  'library-hero',
  'library-workflow',
  'library-system',
  'library-material',
  'library-signal',
] as const;

function check(
  id: BrandAuditCheck['id'],
  label: string,
  actual: number,
  minimum: number,
  message: string,
  severity: BrandAuditSeverity = 'error'
): BrandAuditCheck {
  return { actual, id, label, message, minimum, passed: actual >= minimum, severity };
}

function auditBrandIdentity(
  identity: BrandIdentity,
  identities: readonly BrandIdentity[] = [identity]
): BrandAuditReport {
  const assets = [...identity.assets, ...identity.proofAssets];
  const uniquePaths = new Set(assets.map((asset) => asset.path)).size;
  const visualAssets = assets.filter((asset) => VISUAL_ASSET_TYPES.includes(asset.type));
  const uniqueVisualPaths = new Set(visualAssets.map((asset) => asset.path)).size;
  const assetTypes = new Set(assets.map((asset) => asset.type)).size;
  const sourcedVisualAssets = visualAssets.filter((asset) =>
    Boolean(asset.redistribution && asset.usage && (asset.sourceUrl || asset.redistribution === 'original'))
  ).length;
  const nativeMedia = visualAssets.filter((asset) =>
    asset.tags?.includes('source-native') ||
    (asset.redistribution === 'original' && asset.tags?.includes('brand-diagram'))
  ).length;
  const diagrams = assets.filter((asset) =>
    asset.id === 'identity-field' || asset.tags?.includes('brand-diagram')
  ).length;
  const fonts = identity.fonts ?? [];
  const fontIds = new Set(fonts.map((font) => font.id));
  const boundFontRoles = identity.typography.filter((role) => role.fontId && fontIds.has(role.fontId)).length;
  const capturedReferences = identity.references.filter((reference) => reference.status !== 'planned').length;
  const linkedReferences = identity.references.filter((reference) => reference.assetId).length;
  const duplicateRecipes = identities.filter((candidate) =>
    candidate.id !== identity.id && candidate.artDirection.preview === identity.artDirection.preview
  ).length;
  const duplicateMoodboardRecipes = identities.filter((candidate) =>
    candidate.id !== identity.id && candidate.artDirection.moodboard === identity.artDirection.moodboard
  ).length;
  const libraryAssets = assets.filter((asset) => asset.id.startsWith('library-'));
  const boardAssets = moodboardAssets(identity);
  const librarySlots = REQUIRED_LIBRARY_SLOTS.filter((id) =>
    libraryAssets.some((asset) => asset.id === id)
  ).length;
  const backgroundAssets = libraryAssets.filter((asset) =>
    asset.type === 'background' || asset.type === 'texture'
  );
  const safeBackgroundAssets = backgroundAssets.filter((asset) =>
    asset.tags?.includes('background-safe') && asset.tags.includes('people-free')
  ).length;
  const productAssets = libraryAssets.filter((asset) => asset.type === 'product');
  const centeredProductAssets = productAssets.filter((asset) =>
    asset.tags?.includes('centered-product') &&
    asset.focalPoint &&
    asset.focalPoint.x >= 0.35 &&
    asset.focalPoint.x <= 0.65 &&
    asset.focalPoint.y >= 0.35 &&
    asset.focalPoint.y <= 0.65
  ).length;

  const checks: BrandAuditCheck[] = [
    check('asset-uniqueness', 'Distinct files', uniquePaths, 12, 'The library needs at least twelve distinct files, not repeated labels pointing at the same image.'),
    check('visual-library', 'Visual evidence', uniqueVisualPaths, 12, 'Add twelve non-logo visuals spanning product, imagery, texture, reference, or motion.'),
    check('asset-taxonomy', 'Semantic roles', assetTypes, 5, 'The asset library must cover at least five semantic roles so designs can select material intentionally.'),
    check('library-completeness', 'Complete discovery set', librarySlots, REQUIRED_LIBRARY_SLOTS.length, 'Every library needs all twelve discovery roles: overview, editorial, detail, atmosphere, campaign, interface, motion, hero, workflow, system, material, and signal.'),
    check('moodboard-readiness', 'Moodboard-ready assets', boardAssets.length, 6, 'Every identity needs at least six original diagrams or source-native files that can form a board without screenshots.'),
    check('moodboard-original-assets', 'Original moodboard sources', boardAssets.length, libraryAssets.length, 'Every moodboard library asset must be source-native or an original brand diagram, never a browser capture or reference screenshot.'),
    check('background-safety', 'People-free backgrounds', safeBackgroundAssets, backgroundAssets.length, 'Every background and texture must be explicitly approved as people-free and safe for full-canvas use.'),
    check('product-framing', 'Centered product evidence', centeredProductAssets, productAssets.length, 'Every product asset needs a centered focal point and non-destructive product framing.'),
    check('asset-provenance', 'Usable provenance', sourcedVisualAssets, 4, 'At least four visual assets need usage, source, and redistribution records.'),
    check('native-source-media', 'Native or authored media', nativeMedia, 5, 'Use at least five official native files or original brand diagrams instead of cropped webpage captures.'),
    check('diagram-system', 'System diagram', diagrams, 1, 'Every identity needs a reusable diagram that accurately explains its product or practice.'),
    check('reference-depth', 'Reference depth', identity.references.length, 20, 'Each identity needs a twenty-reference research pack.'),
    check('reference-evidence', 'Captured evidence', Math.max(capturedReferences, linkedReferences), 1, 'At least one reference must be captured and connected to a real asset.', 'warning'),
    check('font-bindings', 'Brand font bindings', boundFontRoles, identity.typography.length, 'Every typography role must resolve to a font file stored by the brand.'),
    check('applications', 'Application range', identity.applications.length, 8, 'The identity must prove itself across at least eight real applications.'),
    check('unique-composition', 'Unique composition', duplicateRecipes === 0 ? 1 : 0, 1, 'No other built-in identity may use the same preview composition.'),
    check('unique-moodboard', 'Unique moodboard recipe', duplicateMoodboardRecipes === 0 ? 1 : 0, 1, 'Every built-in identity needs its own art-directed moodboard recipe.'),
  ];
  const errors = checks.filter((item) => !item.passed && item.severity === 'error').length;
  const warnings = checks.filter((item) => !item.passed && item.severity === 'warning').length;
  const score = Math.max(0, Math.round(100 - (errors * 11.5) - (warnings * 4)));

  return {
    checks,
    id: identity.id,
    name: identity.name,
    score,
    status: errors > 0 ? 'fail' : warnings > 0 ? 'warn' : 'pass',
    summary: {
      assets: assets.length,
      capturedReferences,
      diagrams,
      fonts: fonts.length,
      moodboardAssets: boardAssets.length,
      nativeMedia,
      references: identity.references.length,
      visualAssets: uniqueVisualPaths,
    },
  };
}

export function auditBrandIdentities(identities: readonly BrandIdentity[]): BrandAuditReport[] {
  return identities.map((identity) => auditBrandIdentity(identity, identities));
}
