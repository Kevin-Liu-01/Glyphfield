import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_BRAND_IDENTITIES,
  hydrateBrandIdentities,
  isEditedBuiltInIdentity,
  restoreBuiltInBrandIdentity,
  type BrandIdentity,
} from '../brandIdentity';
import { brandIdentityFingerprint } from '../brandIdentityFingerprint';
import { isPristineBuiltInIdentity, LEGACY_PRISTINE_FINGERPRINTS } from '../builtInIdentityRevision';

function stored(identities: readonly BrandIdentity[]): BrandIdentity[] {
  return JSON.parse(JSON.stringify(identities)) as BrandIdentity[];
}

function shippedGt(): BrandIdentity {
  return stored(hydrateBrandIdentities(null)).find(({ id }) => id === 'gt')!;
}

/** A pristine built-in as an earlier release would have stamped and saved it. */
function previousRelease(identity: BrandIdentity): BrandIdentity {
  const previous = { ...identity, revision: identity.revision - 1, tagline: 'Previously shipped tagline' };
  return { ...previous, presetFingerprint: brandIdentityFingerprint(previous) };
}

describe('built-in identity revisions', () => {
  it('stamps every hydrated built-in with the fingerprint of its shipped preset', () => {
    const identities = hydrateBrandIdentities(null);
    for (const preset of BUILT_IN_BRAND_IDENTITIES) {
      const identity = identities.find(({ id }) => id === preset.id)!;
      expect(identity.presetFingerprint).toMatch(/^bif1\./);
      expect(isEditedBuiltInIdentity(identity)).toBe(false);
    }
  });

  it('keeps pristine built-ins pristine through a storage round trip', () => {
    const first = hydrateBrandIdentities(null);
    const second = hydrateBrandIdentities(stored(first));
    expect(second).toEqual(first);
    expect(second.every((identity) => !identity.builtIn || isPristineBuiltInIdentity(identity))).toBe(true);
  });

  it('refreshes an untouched built-in saved by an earlier release', () => {
    const current = shippedGt();
    const gt = hydrateBrandIdentities([previousRelease(current)]).find(({ id }) => id === 'gt')!;

    expect(gt.tagline).toBe(current.tagline);
    expect(gt.revision).toBe(current.revision);
    expect(isEditedBuiltInIdentity(gt)).toBe(false);
  });

  it('never replaces an edited built-in saved by an earlier release', () => {
    const current = shippedGt();
    const edited = { ...previousRelease(current), tagline: 'Our own line', name: 'GT (team copy)' };
    const gt = hydrateBrandIdentities([edited]).find(({ id }) => id === 'gt')!;

    expect(gt).toMatchObject({ builtIn: true, name: 'GT (team copy)', revision: current.revision, tagline: 'Our own line' });
    expect(gt.presetFingerprint).toBe(current.presetFingerprint);
    expect(isEditedBuiltInIdentity(gt)).toBe(true);
    expect(hydrateBrandIdentities(stored([gt])).find(({ id }) => id === 'gt')).toEqual(gt);
  });

  it('treats unrecognized legacy content without a fingerprint as edited and keeps it', () => {
    const legacy: Record<string, unknown> = { ...shippedGt(), mission: 'Legacy mission' };
    delete legacy.presetFingerprint;
    expect(isPristineBuiltInIdentity(legacy as BrandIdentity)).toBe(false);
    const gt = hydrateBrandIdentities([legacy]).find(({ id }) => id === 'gt')!;
    expect(gt.mission).toBe('Legacy mission');
  });

  it('recognizes the pre-fingerprint save of every built-in', () => {
    expect(Object.keys(LEGACY_PRISTINE_FINGERPRINTS).sort())
      .toEqual(BUILT_IN_BRAND_IDENTITIES.map(({ id }) => id).sort());
  });

  it('restores the shipped preset on request', () => {
    const restored = restoreBuiltInBrandIdentity('ramp')!;
    expect(restored).toMatchObject({ builtIn: true, id: 'ramp', kind: 'example' });
    expect(isEditedBuiltInIdentity(restored)).toBe(false);
    expect(isEditedBuiltInIdentity({ ...restored, tagline: 'Edited' })).toBe(true);
    expect(restoreBuiltInBrandIdentity('missing')).toBeUndefined();
  });

  it('ignores bookkeeping fields and key order when fingerprinting', () => {
    const gt = shippedGt();
    const reordered = Object.fromEntries(Object.entries(gt).reverse()) as BrandIdentity;
    expect(brandIdentityFingerprint({ ...reordered, builtIn: false, kind: 'custom', revision: 1 }))
      .toBe(brandIdentityFingerprint(gt));
  });
});
