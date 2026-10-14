import { describe, expect, it } from 'vitest';

import { hydrateBrandIdentities } from '../brandIdentity';
import { brandProjectHost, parseBrandProjectCreateInput, prepareBrandProject, registerBrandProjectHost } from '../brandProjectHost';

describe('brand project creation', () => {
  const identities = hydrateBrandIdentities(null);

  it('copies the Starter template by default and renames the copy', () => {
    const prepared = prepareBrandProject(parseBrandProjectCreateInput({ name: 'Kestrel' }), identities);
    expect(prepared.source).toBe('template');
    if (prepared.source !== 'template') return;
    expect(prepared.identity).toMatchObject({ builtIn: false, kind: 'custom', name: 'Kestrel', shortName: 'Kestrel' });
    expect(prepared.identity.id).not.toBe('starter');
    expect(prepared.identity.strategy.concept).toBe(identities.find(({ id }) => id === 'starter')!.strategy.concept);
  });

  it('starts from scratch, copies any built-in, and hands custom projects to the host to duplicate', () => {
    const scratch = prepareBrandProject(parseBrandProjectCreateInput({ from: 'scratch', name: 'Acme Labs' }), identities);
    expect(scratch.source === 'scratch' && scratch.identity).toMatchObject({ name: 'Acme Labs', shortName: 'AL' });
    const ramp = prepareBrandProject(parseBrandProjectCreateInput({ from: 'ramp' }), identities);
    expect(ramp.source === 'template' && ramp.identity.name).toBe('Ramp copy 1');
    const custom = { ...identities[0]!, builtIn: false, id: 'custom-1', kind: 'custom' as const, name: 'Mine' };
    expect(prepareBrandProject({ from: 'custom-1' }, [...identities, custom])).toEqual({ source: 'project', target: custom });
  });

  it('rejects unknown sources and input', () => {
    expect(() => prepareBrandProject({ from: 'nope' }, identities)).toThrow(RangeError);
    expect(() => parseBrandProjectCreateInput({ from: 'starter', template: 'x' })).toThrow(TypeError);
    expect(() => parseBrandProjectCreateInput({ name: '' })).toThrow(TypeError);
  });

  it('keeps one registered host and forgets it on cleanup', () => {
    const host = { activate: () => undefined, duplicate: async () => identities[0]!, identities: () => identities };
    const unregister = registerBrandProjectHost(host);
    expect(brandProjectHost()).toBe(host);
    unregister();
    expect(brandProjectHost()).toBeNull();
  });
});
