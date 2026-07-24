import type { BrandAsset, BrandIdentity } from './brandIdentity';

export type BrandAuditSeverity = 'error' | 'warning';

export type BrandAuditCheck = {
  actual: number;
  id:
    | 'applications'
    | 'asset-provenance'
    | 'asset-taxonomy'
    | 'asset-uniqueness'
    | 'font-bindings'
    | 'diagram-system'
    | 'native-source-media'
    | 'reference-depth'
    | 'reference-evidence'
    | 'unique-composition'
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

export function auditBrandIdentity(
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

  const checks: BrandAuditCheck[] = [
    check('asset-uniqueness', 'Distinct files', uniquePaths, 8, 'The library needs at least eight distinct files, not repeated labels pointing at the same image.'),
    check('visual-library', 'Visual evidence', uniqueVisualPaths, 9, 'Add at least nine non-logo visuals spanning product, imagery, texture, reference, or motion.'),
    check('asset-taxonomy', 'Semantic roles', assetTypes, 5, 'The asset library must cover at least five semantic roles so designs can select material intentionally.'),
    check('asset-provenance', 'Usable provenance', sourcedVisualAssets, 4, 'At least four visual assets need usage, source, and redistribution records.'),
    check('native-source-media', 'Native or authored media', nativeMedia, 5, 'Use at least five official native files or original brand diagrams instead of cropped webpage captures.'),
    check('diagram-system', 'System diagram', diagrams, 1, 'Every identity needs a reusable diagram that accurately explains its product or practice.'),
    check('reference-depth', 'Reference depth', identity.references.length, 20, 'Each identity needs a twenty-reference research pack.'),
    check('reference-evidence', 'Captured evidence', Math.max(capturedReferences, linkedReferences), 1, 'At least one reference must be captured and connected to a real asset.', 'warning'),
    check('font-bindings', 'Brand font bindings', boundFontRoles, identity.typography.length, 'Every typography role must resolve to a font file stored by the brand.'),
    check('applications', 'Application range', identity.applications.length, 8, 'The identity must prove itself across at least eight real applications.'),
    check('unique-composition', 'Unique composition', duplicateRecipes === 0 ? 1 : 0, 1, 'No other built-in identity may use the same preview composition.'),
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
      nativeMedia,
      references: identity.references.length,
      visualAssets: uniqueVisualPaths,
    },
  };
}

export function auditBrandIdentities(identities: readonly BrandIdentity[]): BrandAuditReport[] {
  return identities.map((identity) => auditBrandIdentity(identity, identities));
}
