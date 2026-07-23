import { describe, expect, it } from 'vitest';

import {
  createBrandIdentity,
  duplicateBrandIdentity,
  GT_BRAND_IDENTITY,
  hydrateBrandIdentities,
  STARTER_BRAND_IDENTITY,
} from '../brandIdentity';

describe('GT_BRAND_IDENTITY', () => {
  it('captures the GT system as a complete built-in identity', () => {
    expect(GT_BRAND_IDENTITY.builtIn).toBe(true);
    expect(GT_BRAND_IDENTITY.assets.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['mark-dark', 'mark-light', 'wordmark', 'locadex'])
    );
    expect(GT_BRAND_IDENTITY.colors.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['ink', 'paper', 'emphasis', 'success', 'warning', 'error'])
    );
    expect(GT_BRAND_IDENTITY.typography.map(({ role }) => role)).toEqual(
      expect.arrayContaining(['Display', 'Body', 'Code'])
    );
    expect(GT_BRAND_IDENTITY.motion).toHaveLength(4);
    expect(GT_BRAND_IDENTITY.products).toEqual(
      expect.arrayContaining(['Internationalization', 'Translation', 'Locadex'])
    );
    expect(GT_BRAND_IDENTITY.proof).toEqual(
      expect.arrayContaining(['Cursor', 'Ramp', 'Mintlify', 'ClickHouse'])
    );
  });

  it('keeps every GT identity color monochrome', () => {
    for (const { hex } of GT_BRAND_IDENTITY.colors) {
      const [red, green, blue] = hex
        .slice(1)
        .match(/.{2}/g)!
        .map((channel) => Number.parseInt(channel, 16));

      expect(red).toBe(green);
      expect(green).toBe(blue);
    }
  });
});

describe('createBrandIdentity', () => {
  it('creates an editable identity without sharing GT arrays', () => {
    const identity = createBrandIdentity('Acme', 'acme');

    expect(identity).toMatchObject({ builtIn: false, id: 'acme', kind: 'custom', name: 'Acme' });
    expect(identity.colors).not.toBe(GT_BRAND_IDENTITY.colors);
    expect(identity.assets).not.toBe(GT_BRAND_IDENTITY.assets);
  });

  it('creates stable, distinct pixel marks for template brands', () => {
    const brandOne = createBrandIdentity('Brand 1', 'brand-one');
    const sameBrand = createBrandIdentity('Brand 1', 'brand-one');
    const brandTwo = createBrandIdentity('Brand 2', 'brand-two');
    const brandOneMark = brandOne.assets.find(({ id }) => id === 'mark-dark')!;

    expect(brandOne.assets.map(({ id }) => id)).toEqual(['mark-dark', 'mark-light']);
    expect(brandOneMark.path).toMatch(/^data:image\/svg\+xml/);
    expect(brandOneMark.path).toBe(
      sameBrand.assets.find(({ id }) => id === 'mark-dark')!.path
    );
    expect(brandOneMark.path).not.toBe(
      brandTwo.assets.find(({ id }) => id === 'mark-dark')!.path
    );
    expect(decodeURIComponent(brandOneMark.path)).toContain('<rect');
  });

  it('gives a duplicated template brand a new texture without dropping other assets', () => {
    const source = createBrandIdentity('Brand 1', 'brand-one');
    source.assets.push({
      id: 'wordmark',
      label: 'Uploaded wordmark',
      path: '/wordmark.svg',
      surface: 'light',
      type: 'logo',
    });
    const duplicate = duplicateBrandIdentity(source, 'brand-one-copy');

    expect(duplicate.assets.find(({ id }) => id === 'mark-dark')!.path).not.toBe(
      source.assets.find(({ id }) => id === 'mark-dark')!.path
    );
    expect(duplicate.assets.find(({ id }) => id === 'wordmark')?.path).toBe('/wordmark.svg');
  });
});

describe('hydrateBrandIdentities', () => {
  it('places the starter template first, keeps custom tabs, and preserves edited built-in identities', () => {
    const oldGt = { ...GT_BRAND_IDENTITY, name: 'Old GT' };
    const custom = createBrandIdentity('Acme', 'acme');

    const identities = hydrateBrandIdentities([oldGt, custom]);

    expect(identities[0]).toEqual(STARTER_BRAND_IDENTITY);
    expect(identities[1]).toEqual(custom);
    expect(identities[2]).toMatchObject({ builtIn: true, id: 'gt', kind: 'example', name: 'Old GT' });
  });

  it('adds generated marks to legacy custom projects without assets', () => {
    const custom = { ...createBrandIdentity('Brand 1', 'brand-one'), assets: [] };
    const identities = hydrateBrandIdentities([custom]);

    expect(identities[1].assets.map(({ id }) => id)).toEqual(['mark-dark', 'mark-light']);
  });
});
