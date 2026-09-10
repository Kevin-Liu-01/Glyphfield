import type { BrandFontAsset, BrandIdentity, BrandTypography } from './brandIdentity';

// The previous GT revision shipped Switzer Display + Inter support. This is a
// one-time default migration, not an ongoing override of the user's font choice.
const PREVIOUS_GT_REVISION = 26;
const INTER_GT_REVISION = 27;
const LEGACY_DOSSIER = {
  layout: 'Use deep black or exact white fields, decisive typography, one quiet optical gesture, and generous negative space. Headlines stay within two lines; secondary Rasmus Inter copy remains visibly quieter than Switzer display type.',
  logo: 'Use the official GT mark by itself in black or white. Compose the company name as live Switzer or Rasmus Inter text only when needed; never use baked wordmark images with an unverified typeface.',
  typography: 'Use Switzer for primary display statements and Rasmus Inter for body, multilingual, and interface copy. Keep both open and restrained; visible weight never exceeds 550. Code uses Geist Mono only when the content is genuinely code.',
};

function bundledSwitzer(font: BrandFontAsset): boolean {
  return font.family === 'Switzer' && font.style === 'normal'
    && (font.id === 'switzer-400' || font.id === 'switzer-500')
    && font.path === `/fonts/${font.id}.ttf`;
}

function usesLegacyDisplay(font: BrandTypography, fonts: readonly BrandFontAsset[]): boolean {
  if (font.role !== 'Display' || font.family !== 'Switzer') return false;
  if (font.fontId && font.fontId !== 'switzer-500') return false;
  const asset = fonts.find(({ id }) => id === 'switzer-500');
  return !asset || bundledSwitzer(asset);
}

function migrateGuidance(identity: BrandIdentity, preset: BrandIdentity) {
  const dossier = { ...identity.dossier };
  for (const field of ['layout', 'logo', 'typography'] as const) {
    if (dossier[field] === LEGACY_DOSSIER[field]) dossier[field] = preset.dossier[field];
  }
  if (dossier.renderingRecipe) dossier.renderingRecipe = dossier.renderingRecipe.map((rule) =>
    rule === 'Set Switzer display type against quiet Rasmus Inter support'
      ? 'Set Rasmus Inter display type against quieter Inter support' : rule);
  const graphicSystem = { ...identity.graphicSystem };
  if (graphicSystem.rules) graphicSystem.rules = graphicSystem.rules.map((rule) =>
    rule === 'Set display copy in Switzer and secondary copy in Rasmus Inter'
      ? 'Set display and supporting copy in Rasmus Inter' : rule);
  return { dossier, graphicSystem };
}

export function migrateGtTypography(
  identity: BrandIdentity | undefined,
  preset: BrandIdentity,
  fallbackFonts: readonly BrandFontAsset[]
): BrandIdentity | undefined {
  if (preset.id !== 'gt' || preset.revision !== INTER_GT_REVISION
    || identity?.id !== 'gt' || identity.revision !== PREVIOUS_GT_REVISION) return identity;
  const fonts = identity.fonts?.length ? identity.fonts : fallbackFonts;
  const inter = preset.fonts!.find(({ id }) => id === 'inter-variable')!;
  const storedInter = fonts.find(({ id }) => id === inter.id);
  // A user replacement under the bundled id is still a custom font. Do not
  // overwrite it or silently route another role to that replacement.
  const canonicalInter = !storedInter || (storedInter.path === inter.path
    && (storedInter.family === 'Inter' || storedInter.family === inter.family));
  const typography = identity.typography.map((font) => canonicalInter && usesLegacyDisplay(font, fonts)
    ? { ...font, family: inter.family, fontId: inter.id } : font);
  const migrated = typography.some((font, index) => font !== identity.typography[index]);
  const nextFonts = migrated ? fonts.filter((font) => !bundledSwitzer(font)
    || typography.some((role) => role.fontId === font.id || role.family === font.family))
    .map((font) => font.id === inter.id ? { ...inter } : font) : [...fonts];
  if (migrated && !storedInter) nextFonts.push({ ...inter });
  return { ...identity, ...migrateGuidance(identity, preset), fonts: nextFonts,
    typography, revision: INTER_GT_REVISION };
}
