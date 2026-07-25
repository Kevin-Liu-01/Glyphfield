import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BASEMENT_BRAND_IDENTITY,
  brandFontFaceCss,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  BUILT_IN_BRAND_IDENTITIES,
  createBrandIdentity,
  duplicateBrandIdentity,
  GT_BRAND_IDENTITY,
  hydrateBrandIdentities,
  STARTER_BRAND_IDENTITY,
} from '../brandIdentity';

describe('BASEMENT_BRAND_IDENTITY', () => {
  it('ships the researched studio system, licensed typeface, and restrained defaults', () => {
    expect(BASEMENT_BRAND_IDENTITY.graphicSystem.device).toBe('The engineered interruption');
    expect(BASEMENT_BRAND_IDENTITY.style.grid).toBe('none');
    expect(BASEMENT_BRAND_IDENTITY.typography[0]).toMatchObject({
      family: 'Basement Grotesque',
      weight: 550,
    });
    expect(BASEMENT_BRAND_IDENTITY.sourceNotes).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ElevenLabs'),
        expect.stringContaining('Baseten'),
        expect.stringContaining('Mastering Color Gradients'),
      ])
    );
    expect(BASEMENT_BRAND_IDENTITY.applications.length).toBeGreaterThanOrEqual(8);
  });
});

describe('GT_BRAND_IDENTITY', () => {
  it('captures the GT system as a complete built-in identity', () => {
    expect(GT_BRAND_IDENTITY.builtIn).toBe(true);
    expect(GT_BRAND_IDENTITY.assets.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['mark-dark', 'mark-light', 'wordmark', 'locadex', 'identity-field'])
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
    expect(GT_BRAND_IDENTITY.strategy.concept).toContain('source of truth');
    expect(GT_BRAND_IDENTITY.graphicSystem.device).toBe('The translation frame');
    expect(GT_BRAND_IDENTITY.applications.length).toBeGreaterThanOrEqual(8);
    expect(brandTypographyRole({
      ...GT_BRAND_IDENTITY,
      typography: [{ ...GT_BRAND_IDENTITY.typography[0]!, weight: 800 }],
    }, 'Display').weight).toBe(550);
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

  it('isolates the official Rasmus Inter face across every non-code GT role', () => {
    const roles = ['Display', 'Body', 'Accent'] as const;

    expect(roles.map((role) => brandTypographyFamily(GT_BRAND_IDENTITY, role))).toEqual([
      'Rasmus Inter',
      'Rasmus Inter',
      'Rasmus Inter',
    ]);
    expect(brandTypographyFamily(GT_BRAND_IDENTITY, 'Code')).toBe('Geist Mono');
    expect(brandFontAssets(GT_BRAND_IDENTITY).find(({ id }) => id === 'inter-variable')).toMatchObject({
      family: 'Rasmus Inter',
      label: 'Rasmus Inter Variable',
      path: '/fonts/inter-variable.ttf',
      weightMax: 900,
      weightMin: 100,
    });
    expect(brandFontFaceCss(GT_BRAND_IDENTITY)).toContain(
      '@font-face{font-family:"Rasmus Inter";src:url("/fonts/inter-variable.ttf") format("truetype");font-style:normal;font-weight:100 900;font-display:swap;}'
    );
  });
});

describe('BUILT_IN_BRAND_IDENTITIES', () => {
  it('ships Starter, GT, and the reference identity library', () => {
    expect(BUILT_IN_BRAND_IDENTITIES.map(({ id }) => id)).toEqual([
      'starter',
      'basement',
      'gt',
      'ramp',
      'mintlify',
      'tailwind',
      'viteplus',
      'cloudflare',
      'stripe',
    ]);

    for (const identity of BUILT_IN_BRAND_IDENTITIES) {
      expect(identity.builtIn).toBe(true);
      expect(identity.revision).toBeGreaterThanOrEqual(2);
      expect(identity.strategy.pillars.length).toBeGreaterThanOrEqual(4);
      expect(identity.graphicSystem.rules.length).toBeGreaterThanOrEqual(4);
      expect(identity.applications.length).toBeGreaterThanOrEqual(8);
      expect(identity.assets.some(({ id }) => id === 'mark-dark')).toBe(true);
      expect(identity.assets.some(({ type }) => type === 'background')).toBe(true);
      if (identity.id !== 'starter') {
        expect(identity.assets.some(({ type }) => type === 'reference')).toBe(true);
      }
      expect(
        brandFontAssets(identity).every(({ path }) => /\.(?:otf|ttf|woff2)$/.test(path))
      ).toBe(true);
      const fontIds = new Set(brandFontAssets(identity).map(({ id }) => id));
      expect(identity.typography).toHaveLength(4);
      expect(identity.typography.every(({ fontId }) => fontId && fontIds.has(fontId))).toBe(true);
      expect(brandTypographyFamily(identity, 'Display')).toBeTruthy();
      expect(identity.dossier.premise.length).toBeGreaterThan(40);
      expect(identity.dossier.renderingRecipe.length).toBeGreaterThanOrEqual(5);
      expect(identity.dossier.prohibited.length).toBeGreaterThanOrEqual(4);
      expect(identity.references).toHaveLength(20);
    }
  });

  it('gives every identity a bespoke preview and a balanced provenance-aware reference pack', () => {
    expect(new Set(BUILT_IN_BRAND_IDENTITIES.map(({ artDirection }) => artDirection.preview)).size).toBe(
      BUILT_IN_BRAND_IDENTITIES.length
    );

    for (const identity of BUILT_IN_BRAND_IDENTITIES) {
      const categories = identity.references.reduce<Record<string, number>>((counts, reference) => {
        counts[reference.category] = (counts[reference.category] ?? 0) + 1;
        return counts;
      }, {});

      expect(categories).toEqual({ campaign: 4, concept: 4, material: 3, motion: 3, official: 6 });
      expect(identity.references.every(({ intendedUse, owner, redistribution, title }) => (
        intendedUse && owner && redistribution && title
      ))).toBe(true);
      expect(identity.references.filter(({ category }) => category === 'official').every(({ sourceUrl }) => sourceUrl.startsWith('https://'))).toBe(true);
      expect(identity.references.filter(({ status }) => status === 'captured')).toHaveLength(1);
      expect(identity.references.find(({ status }) => status === 'captured')?.assetId).toBe('library-overview');
      expect(identity.references.filter(({ status }) => status === 'reviewed').length).toBeGreaterThanOrEqual(6);
      expect(identity.assets.find(({ id }) => id === 'reference-homepage')).toMatchObject({
        redistribution: 'research-only',
        type: 'reference',
      });
    }
  });

  it('renders Ramp exclusively with its registered Lausanne family', () => {
    const ramp = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'ramp')!;
    const fontIds = new Set(brandFontAssets(ramp).map(({ id }) => id));

    expect(brandFontAssets(ramp).map(({ family }) => family)).toEqual([
      'Lausanne',
      'Lausanne',
      'Lausanne',
      'Lausanne',
    ]);
    expect(ramp.typography.every(({ fontId }) => fontId && fontIds.has(fontId))).toBe(true);
    expect(['Display', 'Body', 'Accent', 'Code'].map((role) => (
      brandTypographyFamily(ramp, role as 'Display' | 'Body' | 'Accent' | 'Code')
    ))).toEqual(['Lausanne', 'Lausanne', 'Lausanne', 'Lausanne']);

    expect(brandFontFaceCss(ramp)).toContain(
      '@font-face{font-family:"Lausanne";src:url("/fonts/brands/ramp/lausanne-400.woff2") format("woff2");font-style:normal;font-weight:400;font-display:swap;}'
    );
  });

  it('renders Mintlify with the same four font roles as its production site', () => {
    const mintlify = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'mintlify')!;
    const roles = ['Display', 'Body', 'Accent', 'Code'] as const;

    expect(roles.map((role) => brandTypographyFamily(mintlify, role))).toEqual([
      'Arizona Flare',
      'Mintlify Inter',
      'Paper Mono',
      'Mintlify Geist Mono',
    ]);
    expect(brandFontAssets(mintlify).every(({ path }) => (
      existsSync(join(process.cwd(), 'public', path))
    ))).toBe(true);
    expect(brandFontFaceCss(mintlify)).toContain(
      '@font-face{font-family:"Mintlify Inter";src:url("/fonts/brands/mintlify/inter-variable.ttf") format("truetype");font-style:normal;font-weight:100 900;font-display:swap;}'
    );
    expect(brandFontFaceCss(mintlify)).toContain(
      '@font-face{font-family:"Mintlify Geist Mono";src:url("/fonts/brands/mintlify/geist-mono-latin.woff2") format("woff2");font-style:normal;font-weight:100 900;font-display:swap;}'
    );
  });
});

describe('createBrandIdentity', () => {
  it('creates an editable identity without sharing GT arrays', () => {
    const identity = createBrandIdentity('Acme', 'acme');

    expect(identity).toMatchObject({ builtIn: false, id: 'acme', kind: 'custom', name: 'Acme' });
    expect(identity.colors).not.toBe(GT_BRAND_IDENTITY.colors);
    expect(identity.assets).not.toBe(GT_BRAND_IDENTITY.assets);
    expect(identity.fonts).not.toBe(GT_BRAND_IDENTITY.fonts);
    expect(identity.fonts?.map(({ path }) => path)).toEqual([
      '/fonts/switzer-400.ttf',
      '/fonts/switzer-500.ttf',
      '/fonts/inter-variable.ttf',
      '/fonts/geist-mono-variable.ttf',
    ]);
    expect(identity.typography.every(({ fontId, weight }) => fontId && weight)).toBe(true);
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
  it('places Starter first, keeps custom tabs, and preserves current-revision built-in edits', () => {
    const oldGt = { ...GT_BRAND_IDENTITY, name: 'Old GT' };
    const custom = createBrandIdentity('Acme', 'acme');

    const identities = hydrateBrandIdentities([oldGt, custom]);

    expect(identities.slice(0, 2).map(({ id }) => id)).toEqual(['starter', 'acme']);
    expect(identities.find(({ id }) => id === 'acme')).toEqual(custom);
    expect(identities.find(({ id }) => id === 'gt')).toMatchObject({ builtIn: true, id: 'gt', kind: 'example', name: 'Old GT' });
  });

  it('drops the retired Template project from saved state', () => {
    const retiredTemplate = {
      ...STARTER_BRAND_IDENTITY,
      id: 'template',
      name: 'Template',
    };

    expect(hydrateBrandIdentities([retiredTemplate]).some(({ id }) => id === 'template')).toBe(false);
  });

  it('adds generated marks to legacy custom projects without assets', () => {
    const custom = { ...createBrandIdentity('Brand 1', 'brand-one'), assets: [] };
    const identities = hydrateBrandIdentities([custom]);

    expect(identities.find(({ id }) => id === 'brand-one')?.assets.map(({ id }) => id)).toEqual(['mark-dark', 'mark-light']);
  });

  it('refreshes stale built-in identities to the current audited revision', () => {
    const staleGt = {
      ...GT_BRAND_IDENTITY,
      name: 'Stale GT',
      revision: GT_BRAND_IDENTITY.revision - 1,
      strategy: undefined,
    };

    const gt = hydrateBrandIdentities([staleGt]).find(({ id }) => id === 'gt')!;

    expect(gt.name).toBe(GT_BRAND_IDENTITY.name);
    expect(gt.revision).toBe(GT_BRAND_IDENTITY.revision);
    expect(gt.strategy).toEqual(GT_BRAND_IDENTITY.strategy);
  });

  it('backfills new shared system fields in legacy built-in projects', () => {
    const legacyGt: Record<string, unknown> = { ...GT_BRAND_IDENTITY };
    delete legacyGt.contactEmail;
    delete legacyGt.mission;
    delete legacyGt.socialHandle;
    delete legacyGt.style;
    delete legacyGt.values;

    const hydrated = hydrateBrandIdentities([legacyGt]);
    const gt = hydrated.find(({ id }) => id === 'gt')!;

    expect(gt.contactEmail).toBe(GT_BRAND_IDENTITY.contactEmail);
    expect(gt.mission).toBe(GT_BRAND_IDENTITY.mission);
    expect(gt.socialHandle).toBe(GT_BRAND_IDENTITY.socialHandle);
    expect(gt.style).toEqual(GT_BRAND_IDENTITY.style);
    expect(gt.values).toEqual(GT_BRAND_IDENTITY.values);
    expect(brandFontAssets(gt).map(({ path }) => path)).toEqual([
      '/fonts/inter-variable.ttf',
      '/fonts/geist-mono-variable.ttf',
    ]);
    expect(gt.assets.some(({ type }) => type === 'background')).toBe(true);
  });
});
