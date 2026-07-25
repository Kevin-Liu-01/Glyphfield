import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { auditBrandIdentities } from '../brandAudit';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';
import { moodboardAssets } from '../moodboard';

describe('built-in brand visual audit', () => {
  it('keeps every identity above the structural quality floor', () => {
    const reports = auditBrandIdentities(BUILT_IN_BRAND_IDENTITIES);
    const failures = reports.flatMap((report) =>
      report.checks
        .filter((check) => !check.passed && check.severity === 'error')
        .map((check) => `${report.id}: ${check.id} (${check.actual}/${check.minimum})`)
    );

    expect(failures).toEqual([]);
  });

  it('uses a different preview recipe for every built-in identity', () => {
    const recipes = BUILT_IN_BRAND_IDENTITIES.map((identity) => identity.artDirection.preview);
    expect(new Set(recipes).size).toBe(BUILT_IN_BRAND_IDENTITIES.length);
  });

  it('uses a different moodboard recipe for every built-in identity', () => {
    const recipes = BUILT_IN_BRAND_IDENTITIES.map((identity) => identity.artDirection.moodboard);
    expect(new Set(recipes).size).toBe(BUILT_IN_BRAND_IDENTITIES.length);
  });

  it('builds every moodboard from original diagrams or source-native files only', () => {
    const invalid = BUILT_IN_BRAND_IDENTITIES.flatMap((identity) =>
      moodboardAssets(identity)
        .filter((asset) =>
          /\/references\/|\/screenshots\/|screen[-_ ]?shot|capture|homepage/i.test(asset.path)
        )
        .map((asset) => `${identity.id}: ${asset.id}`)
    );
    const shallow = BUILT_IN_BRAND_IDENTITIES
      .filter((identity) => moodboardAssets(identity).length < 6)
      .map((identity) => `${identity.id}: ${moodboardAssets(identity).length}`);

    expect(invalid).toEqual([]);
    expect(shallow).toEqual([]);
  });

  it('keeps every bundled brand file resolvable from public', () => {
    const missing = BUILT_IN_BRAND_IDENTITIES.flatMap((identity) =>
      [...identity.assets, ...identity.proofAssets]
        .filter((asset) => asset.path.startsWith('/'))
        .filter((asset) => !existsSync(join(process.cwd(), 'public', asset.path)))
        .map((asset) => `${identity.id}: ${asset.path}`)
    );

    expect(missing).toEqual([]);
  });

  it('uses native source media or original diagrams instead of webpage crops', () => {
    const invalidAssets = BUILT_IN_BRAND_IDENTITIES.flatMap((identity) =>
      identity.assets
        .filter((asset) => asset.id.startsWith('library-'))
        .filter((asset) => !asset.tags?.includes('source-native') && !asset.tags?.includes('brand-diagram'))
        .map((asset) => `${identity.id}: ${asset.id}`)
    );
    const captureAttributions = BUILT_IN_BRAND_IDENTITIES.flatMap((identity) =>
      identity.assets
        .filter((asset) => asset.attribution?.toLocaleLowerCase().includes('site capture'))
        .map((asset) => `${identity.id}: ${asset.id}`)
    );

    expect(invalidAssets).toEqual([]);
    expect(captureAttributions).toEqual([]);
  });

  it('gives every identity a canonical system diagram', () => {
    const missing = BUILT_IN_BRAND_IDENTITIES
      .filter((identity) => !identity.assets.some((asset) => asset.id === 'identity-field'))
      .map((identity) => identity.id);

    expect(missing).toEqual([]);
  });

  it('gives every identity all twelve discovery roles', () => {
    const requiredSlots = [
      'overview',
      'editorial',
      'detail',
      'atmosphere',
      'campaign',
      'interface',
      'motion',
      'hero',
      'workflow',
      'system',
      'material',
      'signal',
    ].map((slot) => `library-${slot}`);
    const incomplete = BUILT_IN_BRAND_IDENTITIES.flatMap((identity) => {
      const assetIds = new Set(identity.assets.map((asset) => asset.id));
      const missing = requiredSlots.filter((slot) => !assetIds.has(slot));

      return missing.map((slot) => `${identity.id}: ${slot}`);
    });

    expect(incomplete).toEqual([]);
  });

  it('keeps backgrounds people-free and product evidence centered', () => {
    const invalidBackgrounds = BUILT_IN_BRAND_IDENTITIES.flatMap((identity) =>
      identity.assets
        .filter((asset) => asset.id.startsWith('library-'))
        .filter((asset) => asset.type === 'background' || asset.type === 'texture')
        .filter((asset) => !asset.tags?.includes('people-free') || !asset.tags.includes('background-safe'))
        .map((asset) => `${identity.id}: ${asset.id}`)
    );
    const invalidProducts = BUILT_IN_BRAND_IDENTITIES.flatMap((identity) =>
      identity.assets
        .filter((asset) => asset.id.startsWith('library-') && asset.type === 'product')
        .filter((asset) =>
          !asset.tags?.includes('centered-product') ||
          !asset.focalPoint ||
          asset.focalPoint.x < 0.35 ||
          asset.focalPoint.x > 0.65 ||
          asset.focalPoint.y < 0.35 ||
          asset.focalPoint.y > 0.65
        )
        .map((asset) => `${identity.id}: ${asset.id}`)
    );

    expect(invalidBackgrounds).toEqual([]);
    expect(invalidProducts).toEqual([]);
  });
});
