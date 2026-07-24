import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { auditBrandIdentities } from '../brandAudit';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';

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
});
