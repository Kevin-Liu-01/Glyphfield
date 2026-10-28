import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_BRAND_IDENTITIES,
  createBrandIdentity,
  hydrateBrandIdentities,
} from '../brandIdentity';
import {
  applyBrandIdentitySource,
  BRAND_IDENTITY_PATCH_SCHEMA,
  BRAND_IDENTITY_SOURCE_SCHEMA,
  BrandSourceValidationError,
  validateBrandIdentitySource,
} from '../brandSource';

function errors(input: unknown, mode: 'full' | 'patch' = 'full') {
  return validateBrandIdentitySource(input, mode).issues.filter(({ severity }) => severity === 'error');
}

function applyError(run: () => unknown): BrandSourceValidationError {
  try {
    run();
  } catch (error) {
    if (error instanceof BrandSourceValidationError) return error;
    throw error;
  }
  throw new Error('Expected a validation error.');
}

describe('BrandIdentity source contract', () => {
  it('accepts every built-in and newly created identity as valid source', () => {
    for (const identity of [...hydrateBrandIdentities(null), createBrandIdentity('Acme', 'acme')]) {
      expect(errors(JSON.parse(JSON.stringify(identity))), identity.id).toEqual([]);
    }
  });

  it('publishes a JSON Schema with required fields, formats and merge keys', () => {
    expect(BRAND_IDENTITY_SOURCE_SCHEMA).toMatchObject({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      required: ['id', 'name', 'assets', 'colors', 'typography'],
      type: 'object',
    });
    const properties = BRAND_IDENTITY_SOURCE_SCHEMA.properties as Record<string, Record<string, unknown>>;
    expect(properties.colors).toMatchObject({ 'x-glyphfield-merge-key': 'id' });
    expect(properties.typography).toMatchObject({ 'x-glyphfield-merge-key': 'role' });
    expect(JSON.stringify(properties.colors)).toContain('^#[0-9A-Fa-f]{6}$');
    expect(BRAND_IDENTITY_PATCH_SCHEMA).not.toHaveProperty('required');
  });

  it('reports precise, actionable errors with paths', () => {
    const identity = JSON.parse(JSON.stringify(createBrandIdentity('Acme', 'acme')));
    identity.colors[1].hex = '#FFF';
    identity.typography[0].role = 'Heading';
    identity.assets[0].path = 'https://acme.test/logo.svg';
    identity.colorPairings = [{ background: 'paper', foreground: 'nope', usage: 'Body' }];
    delete identity.name;
    const issues = errors(identity);
    const byPath = Object.fromEntries(issues.map((item) => [item.path, item]));

    expect(byPath['colors[1].hex']?.message).toBe('colors[1].hex must be a six-digit HEX color such as "#1A2B3C"; received "#FFF".');
    expect(byPath['typography[0].role']?.message).toContain('must be one of Display, Body, Accent, Code; received "Heading"');
    expect(byPath['assets[0].path']).toMatchObject({ code: 'remote_url' });
    expect(byPath['colorPairings[0].foreground']?.message).toContain('does not match any colors[].id');
    expect(byPath.name).toMatchObject({ code: 'required' });
  });

  it('flags duplicate record IDs and unknown fields', () => {
    const identity = JSON.parse(JSON.stringify(createBrandIdentity('Acme', 'acme')));
    identity.colors[1].id = identity.colors[0].id;
    identity.brandArchetype = 'Sage';
    const { issues, ok } = validateBrandIdentitySource(identity);
    expect(ok).toBe(false);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'duplicate', path: 'colors[1].id' }),
      expect.objectContaining({ code: 'unknown_field', path: 'brandArchetype', severity: 'warning' }),
    ]));
  });
});

describe('colour system and type axis fields', () => {
  it('validates color refs, scale settings, role steps and variation axes', () => {
    const identity = JSON.parse(JSON.stringify(createBrandIdentity('Acme', 'acme')));
    identity.colorSystem = { dark: { primary: 'emphasis.300' }, light: { border: 'ink.200', primary: 'nope' }, scales: [{ chroma: 80, id: 'ink' }, { id: 'ghost' }] };
    identity.typeScale = { basePx: 16, ratio: 1.25, roleSteps: { Display: 'giant' } };
    identity.typography[0].opticalSize = 400;
    const found = errors(identity).map(({ code, path }) => `${code}:${path}`);
    expect(found).toEqual(expect.arrayContaining([
      'reference:colorSystem.light.primary',
      'reference:colorSystem.scales[1].id',
      'enum:typeScale.roleSteps.Display',
      'range:typography[0].opticalSize',
    ]));
    expect(found).not.toContain('reference:colorSystem.dark.primary');
    identity.colorSystem.light.primary = 'ink.750';
    expect(errors(identity).map(({ code, path }) => `${code}:${path}`)).toContain('format:colorSystem.light.primary');
  });

  it('merges colorSystem by key and its scales by id', () => {
    const base = { ...createBrandIdentity('Acme', 'acme'), colorSystem: { light: { border: 'ink.200' }, scales: [{ chroma: 80, id: 'ink' }] } };
    const next = applyBrandIdentitySource(base, { colorSystem: { light: { primary: 'emphasis' }, scales: [{ hueShift: 10, id: 'ink' }] } }).identity;
    expect(next.colorSystem).toEqual({ light: { border: 'ink.200', primary: 'emphasis' }, scales: [{ chroma: 80, hueShift: 10, id: 'ink' }] });
  });
});

describe('applyBrandIdentitySource', () => {
  const base = createBrandIdentity('Acme', 'acme');

  it('merges a patch by key while keeping stable IDs, other records and unknown fields', () => {
    const current = { ...base, partnerProgram: { tier: 'gold' } } as typeof base;
    const { identity, warnings } = applyBrandIdentitySource(current, {
      colors: [{ hex: '#0a0a0a', id: 'ink' }, { hex: '#C6FF3D', id: 'lime', name: 'Lime', proportion: 8, role: 'Signal' }],
      id: 'something-else',
      strategy: { pillars: ['Fast', 'Clear', 'Kind'] },
      typography: [{ role: 'Display', weight: 500 }],
      voice: { examples: [{ avoid: 'Oops!', context: 'Error', write: 'That did not save. Try again.' }] },
    });

    expect(identity.id).toBe('acme');
    expect(identity.colors.find(({ id }) => id === 'ink')).toMatchObject({ hex: '#0A0A0A', name: base.colors[0]!.name });
    expect(identity.colors.at(-1)).toMatchObject({ hex: '#C6FF3D', id: 'lime' });
    expect(identity.colors).toHaveLength(base.colors.length + 1);
    expect(identity.strategy).toMatchObject({ concept: base.strategy.concept, pillars: ['Fast', 'Clear', 'Kind'] });
    expect(identity.typography.find(({ role }) => role === 'Display')).toMatchObject({ family: base.typography[0]!.family, weight: 500 });
    expect(identity.voice.examples).toHaveLength(1);
    expect(identity.voice.principles).toEqual(base.voice.principles);
    expect((identity as unknown as { partnerProgram: unknown }).partnerProgram).toEqual({ tier: 'gold' });
    expect(warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'locked', path: 'id' })]));
  });

  it('replaces whole record collections on request', () => {
    const { identity } = applyBrandIdentitySource(base, {
      colorPairings: [{ background: 'paper', foreground: 'ink', usage: 'Body' }],
      colors: [{ hex: '#000000', id: 'ink', name: 'Ink', role: 'Text' }, { hex: '#FFFFFF', id: 'paper', name: 'Paper', role: 'Field' }],
    }, { replace: ['colors', 'colorPairings'] });
    expect(identity.colors.map(({ id }) => id)).toEqual(['ink', 'paper']);
    expect(() => applyBrandIdentitySource(base, {}, { replace: ['tagline'] })).toThrow(/replace "tagline" is not a record collection/);
  });

  it('removes records by ID after merging', () => {
    const { identity } = applyBrandIdentitySource(base, {}, { remove: { colors: ['error', 'progress'] } });
    expect(identity.colors.map(({ id }) => id)).not.toContain('error');
    expect(identity.colors).toHaveLength(base.colors.length - 2);
  });

  it('rejects incomplete new records and bad references with the merged path', () => {
    const error = applyError(() => applyBrandIdentitySource(base, {
      colors: [{ hex: '#123456', id: 'new-color' }],
      typography: [{ fontId: 'missing-font', role: 'Body' }],
    }));
    expect(error.message).toMatch(/^Identity source has \d+ problems:/);
    expect(error.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: `colors[${base.colors.length}].name` }),
      expect.objectContaining({ code: 'reference', path: 'typography[1].fontId' }),
    ]));
  });

  it('requires a merge key on patch records', () => {
    const error = applyError(() => applyBrandIdentitySource(base, { assets: [{ label: 'Logo' }] }));
    expect(error.issues[0]).toMatchObject({ code: 'required', path: 'assets[0].id' });
  });

  it('replaces the identity in replace mode but keeps the project fields', () => {
    const source = JSON.parse(JSON.stringify(BUILT_IN_BRAND_IDENTITIES[3]));
    delete source.id;
    const { identity } = applyBrandIdentitySource(base, source, { mode: 'replace' });
    expect(identity).toMatchObject({ builtIn: false, id: 'acme', kind: 'custom', name: source.name });
  });
});

describe('validation cost bounds', () => {
  it('stops item validation at maxItems and skips cross references after too_many', () => {
    const identity = JSON.parse(JSON.stringify(BUILT_IN_BRAND_IDENTITIES[0])) as Record<string, unknown>;
    identity.colors = Array.from({ length: 10_000 }, () => ({}));
    const { issues } = validateBrandIdentitySource(identity, 'full');
    expect(issues.filter(({ code, path }) => code === 'too_many' && path === 'colors')).toHaveLength(1);
    const indices = issues.flatMap(({ path }) => {
      const index = /^colors\[(\d+)\]/.exec(path)?.[1];
      return index === undefined ? [] : [Number(index)];
    });
    expect(indices.length).toBeGreaterThan(0);
    expect(Math.max(...indices)).toBeLessThan(32);
    expect(issues.some(({ code }) => code === 'reference')).toBe(false);
  });

  it('checks references only for known colorSystem role keys', () => {
    const identity = JSON.parse(JSON.stringify(BUILT_IN_BRAND_IDENTITIES[0])) as Record<string, unknown>;
    identity.colorSystem = {
      light: Object.fromEntries(Array.from({ length: 5_000 }, (_, index) => [`role-${index}`, 'not-a-color'])),
    };
    const { issues } = validateBrandIdentitySource(identity, 'full');
    expect(issues.some(({ code }) => code === 'reference')).toBe(false);
  });
});
