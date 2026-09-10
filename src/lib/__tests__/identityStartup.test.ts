import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { BUILT_IN_BRAND_IDENTITIES } from '../brandIdentity';

describe('landing identity dependencies', () => {
  it('preserves every serialized built-in field while splitting the startup identity', () => {
    // Extraction baseline: update only when intentionally editing canonical preset data.
    expect(createHash('sha256').update(JSON.stringify(BUILT_IN_BRAND_IDENTITIES)).digest('hex'))
      .toBe('93f9d4127c9dc8c988403867ced93a25b071793ae2c4a3c7844af4518780f107');
  });

  it('loads the canonical GT leaf without the all-brand catalog', () => {
    const hero = readFileSync('src/components/MarketingAnimationStudioLive.tsx', 'utf8');
    expect(hero).toContain("import { GT_BRAND_IDENTITY } from '@/lib/gtBrandIdentity';");
  });

  it('does not evaluate any all-brand module when importing the GT identity', async () => {
    vi.resetModules();
    const loadCatalog = vi.fn(() => { throw new Error('The hero must not initialize all brands'); });
    vi.doMock('../brandIdentity', loadCatalog);
    vi.doMock('../identityPresets', loadCatalog);
    vi.doMock('../brandDossiers', loadCatalog);
    try {
      const { GT_BRAND_IDENTITY } = await import('../gtBrandIdentity');
      expect(GT_BRAND_IDENTITY).toEqual(BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'gt'));
      expect(loadCatalog).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('../brandIdentity');
      vi.doUnmock('../identityPresets');
      vi.doUnmock('../brandDossiers');
      vi.resetModules();
    }
  });
});
