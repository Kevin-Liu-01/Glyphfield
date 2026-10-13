import { brandIdentityFingerprint } from './brandIdentityFingerprint';

/**
 * Fingerprints of every built-in exactly as releases before `presetFingerprint`
 * saved them (preset revisions 22, 23 and GT 27). A stored built-in matching one
 * of these was never edited, so it may refresh to the current preset.
 */
export const LEGACY_PRISTINE_FINGERPRINTS: Readonly<Record<string, readonly string[]>> = {
  basement: ['bif1.l8t.5t52wz.1g6e6xb'],
  cloudflare: ['bif1.jax.1ipqd4q.xm9di6'],
  gt: ['bif1.ubk.o5f6vj.tpycd7'],
  mintlify: ['bif1.iwi.1b4h988.tfq4n8'],
  ramp: ['bif1.j27.1dzpw2h.1xwk079'],
  starter: ['bif1.h68.11r7cpf.18jf20n'],
  stripe: ['bif1.j7t.116xeg.l7av6s'],
  tailwind: ['bif1.jck.a7wrnl.1gue6ph'],
  viteplus: ['bif1.ikv.opndst.1gau74h'],
};

/**
 * True when a stored built-in still equals the preset it was hydrated from.
 * Unknown legacy content counts as edited, so it is kept rather than replaced.
 */
export function isPristineBuiltInIdentity(stored: { id: string; presetFingerprint?: unknown }): boolean {
  const fingerprint = brandIdentityFingerprint(stored);
  if (typeof stored.presetFingerprint === 'string') return fingerprint === stored.presetFingerprint;
  return LEGACY_PRISTINE_FINGERPRINTS[stored.id]?.includes(fingerprint) ?? false;
}
