import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BASEMENT_BRAND_IDENTITY,
  brandFontFaceCss,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  brandTypographyWeightRange,
  BUILT_IN_BRAND_IDENTITIES,
  createBrandIdentity,
  duplicateBrandIdentity,
  GT_BRAND_IDENTITY,
  hydrateBrandIdentities,
  resolveBrandTypographyWeight,
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
      expect.arrayContaining(['mark-dark', 'mark-light', 'identity-field'])
    );
    expect(GT_BRAND_IDENTITY.assets.map(({ id }) => id)).not.toContain('locadex');
    expect(GT_BRAND_IDENTITY.assets.map(({ id }) => id)).not.toContain('wordmark');
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
    expect(GT_BRAND_IDENTITY.strategy.concept).toContain('quiet monochrome field');
    expect(GT_BRAND_IDENTITY.graphicSystem.device).toBe('The monochrome light field');
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

  it('uses Rasmus Inter for every non-code GT role without loading Switzer', () => {
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
    expect(brandFontAssets(GT_BRAND_IDENTITY).some(({ family }) => family === 'Switzer')).toBe(false);
    expect(brandTypographyWeightRange(GT_BRAND_IDENTITY, 'Display')).toEqual({ max: 900, min: 100 });
    expect(JSON.stringify(GT_BRAND_IDENTITY.dossier)).not.toContain('Switzer');
    expect(GT_BRAND_IDENTITY.graphicSystem.rules.join(' ')).not.toContain('Switzer');
  });

  it('resolves requested weights to the font files the browser can actually render', () => {
    expect(brandTypographyWeightRange(STARTER_BRAND_IDENTITY, 'Display')).toEqual({ max: 500, min: 400 });
    expect(resolveBrandTypographyWeight(STARTER_BRAND_IDENTITY, 'Display', 900)).toBe(500);
    expect(resolveBrandTypographyWeight(STARTER_BRAND_IDENTITY, 'Display', 450)).toBe(500);
    expect(brandTypographyWeightRange(GT_BRAND_IDENTITY, 'Body')).toEqual({ max: 900, min: 100 });
    expect(resolveBrandTypographyWeight(GT_BRAND_IDENTITY, 'Body', 800)).toBe(800);
  });

  it('keeps the built-in GT sample labels and live SVG typography aligned with Inter', () => {
    expect(readFileSync('src/components/MarketingStudioShowcaseDemos.tsx', 'utf8')).not.toContain('Switzer');
    const constellation = readFileSync('public/brands/gt/library/language-constellation.svg', 'utf8');
    expect(constellation).toContain('font-family="Rasmus Inter, Inter, Arial, sans-serif"');
    expect(constellation).not.toContain('Switzer');
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
      const capturedAsset = identity.assets.find(({ id }) => id === 'reference-homepage');
      if (capturedAsset) {
        expect(capturedAsset).toMatchObject({
          redistribution: 'research-only',
          type: 'reference',
        });
      }
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
  function legacyGt() {
    return {
      ...GT_BRAND_IDENTITY,
      revision: 26,
      fonts: [
        ...brandFontAssets(STARTER_BRAND_IDENTITY).filter(({ family }) => family === 'Switzer'),
        ...brandFontAssets(GT_BRAND_IDENTITY).filter(({ family }) => family !== 'Switzer'),
      ],
      typography: GT_BRAND_IDENTITY.typography.map((font) => font.role === 'Display'
        ? { ...font, family: 'Switzer', fontId: 'switzer-500' } : font),
    };
  }

  it('migrates the previous bundled GT display font without replacing unrelated saved edits', () => {
    const stored = { ...legacyGt(), name: 'My GT project', tagline: 'Keep this copy' };
    const before = JSON.stringify(stored);
    const gt = hydrateBrandIdentities([stored]).find(({ id }) => id === 'gt')!;
    expect(gt).toMatchObject({ name: stored.name, tagline: stored.tagline, revision: GT_BRAND_IDENTITY.revision });
    expect(brandTypographyFamily(gt, 'Display')).toBe('Rasmus Inter');
    expect(gt.typography.find(({ role }) => role === 'Display')).toMatchObject({
      fontId: 'inter-variable', weight: 500, lineHeight: 0.98, letterSpacing: -0.7,
    });
    expect(brandFontAssets(gt).some(({ family }) => family === 'Switzer')).toBe(false);
    expect(JSON.stringify(stored)).toBe(before);
    expect(hydrateBrandIdentities([gt]).find(({ id }) => id === 'gt')).toEqual(gt);
  });

  it('preserves an explicitly selected custom GT display family through the font-default revision', () => {
    const stored = legacyGt();
    const custom = { ...stored.fonts[0]!, id: 'my-font', family: 'My Grotesk', path: 'data:font/ttf;base64,Zg==' };
    stored.fonts.push(custom);
    stored.typography[0] = { ...stored.typography[0]!, family: custom.family, fontId: custom.id,
      letterSpacing: 1.25, lineHeight: 1.15, weight: 400 };
    const gt = hydrateBrandIdentities([stored]).find(({ id }) => id === 'gt')!;
    expect(brandTypographyFamily(gt, 'Display')).toBe('My Grotesk');
    expect(gt.typography[0]).toEqual(stored.typography[0]);
    expect(gt.fonts).toContainEqual(custom);
  });

  it('does not replace a user font uploaded under the old Switzer font id', () => {
    const stored = legacyGt();
    stored.fonts = stored.fonts.map((font) => font.id === 'switzer-500'
      ? { ...font, path: 'data:font/ttf;base64,Y3VzdG9t' } : font);
    const gt = hydrateBrandIdentities([stored]).find(({ id }) => id === 'gt')!;
    expect(gt.typography[0]).toEqual(stored.typography[0]);
    expect(gt.fonts?.find(({ id }) => id === 'switzer-500')?.path).toBe('data:font/ttf;base64,Y3VzdG9t');
  });

  it('migrates the bundled display while retaining a separately customized body font', () => {
    const stored = legacyGt();
    stored.typography[1] = { ...stored.typography[1]!, family: 'Switzer', fontId: 'switzer-400', letterSpacing: 0.1 };
    const gt = hydrateBrandIdentities([stored]).find(({ id }) => id === 'gt')!;
    expect(brandTypographyFamily(gt, 'Display')).toBe('Rasmus Inter');
    expect(brandTypographyFamily(gt, 'Body')).toBe('Switzer');
    expect(gt.typography[1]).toEqual(stored.typography[1]);
    expect(gt.fonts?.find(({ id }) => id === 'switzer-400')).toEqual(stored.fonts[0]);
  });

  it('does not overwrite a custom Inter asset when adopting the new GT revision', () => {
    const stored = legacyGt();
    stored.fonts = stored.fonts.map((font) => font.id === 'inter-variable'
      ? { ...font, path: 'data:font/ttf;base64,Y3VzdG9t' } : font);
    const gt = hydrateBrandIdentities([stored]).find(({ id }) => id === 'gt')!;
    expect(gt.fonts?.find(({ id }) => id === 'inter-variable')?.path).toBe('data:font/ttf;base64,Y3VzdG9t');
    expect(gt.typography).toEqual(stored.typography);
  });

  it('restores missing bundled font assets and updates only unchanged GT typography guidance', () => {
    const legacy = legacyGt();
    const stored = { ...legacy, fonts: undefined,
      dossier: { ...legacy.dossier, layout: 'My custom layout rules',
        typography: 'Use Switzer for primary display statements and Rasmus Inter for body, multilingual, and interface copy. Keep both open and restrained; visible weight never exceeds 550. Code uses Geist Mono only when the content is genuinely code.' },
      graphicSystem: { ...legacy.graphicSystem, rules: [
        'My custom graphic rule', 'Set display copy in Switzer and secondary copy in Rasmus Inter',
      ] } };
    const gt = hydrateBrandIdentities([stored]).find(({ id }) => id === 'gt')!;
    expect(brandTypographyFamily(gt, 'Display')).toBe('Rasmus Inter');
    expect(brandFontFaceCss(gt)).toContain('font-family:"Rasmus Inter"');
    expect(gt.dossier.layout).toBe('My custom layout rules');
    expect(gt.dossier.typography).toBe(GT_BRAND_IDENTITY.dossier.typography);
    expect(gt.graphicSystem.rules).toEqual(['My custom graphic rule', 'Set display and supporting copy in Rasmus Inter']);
  });

  it('keeps explicit font choices in current GT projects and other identities unchanged', () => {
    const currentGt = { ...legacyGt(), revision: GT_BRAND_IDENTITY.revision };
    const custom = { ...legacyGt(), builtIn: false, id: 'gt-custom', kind: 'custom' as const };
    const identities = hydrateBrandIdentities([currentGt, custom, STARTER_BRAND_IDENTITY]);
    expect(brandTypographyFamily(identities.find(({ id }) => id === 'gt')!, 'Display')).toBe('Switzer');
    expect(brandTypographyFamily(identities.find(({ id }) => id === custom.id)!, 'Display')).toBe('Switzer');
    expect(identities.find(({ id }) => id === 'starter')!.typography).toEqual(STARTER_BRAND_IDENTITY.typography);
  });
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

  it('repairs invalid persisted HEX colors while hydrating a project', () => {
    const custom = createBrandIdentity('Acme', 'acme');
    custom.colors[0] = { ...custom.colors[0]!, hex: '#NANNANNAN' };

    const hydrated = hydrateBrandIdentities([custom]).find(({ id }) => id === 'acme')!;

    expect(hydrated.colors[0]?.hex).toBe('#000000');
  });

  it('refreshes stale built-in identities to the current audited revision', () => {
    const staleGt = {
      ...GT_BRAND_IDENTITY,
      name: 'Stale GT',
      revision: GT_BRAND_IDENTITY.revision - 2,
      strategy: undefined,
    };

    const gt = hydrateBrandIdentities([staleGt]).find(({ id }) => id === 'gt')!;

    expect(gt.name).toBe(GT_BRAND_IDENTITY.name);
    expect(gt.revision).toBe(GT_BRAND_IDENTITY.revision);
    expect(gt.strategy).toEqual(GT_BRAND_IDENTITY.strategy);
  });

  it('migrates collision-prone Basement display spacing without dropping other edits', () => {
    const storedBasement = {
      ...BASEMENT_BRAND_IDENTITY,
      name: 'Edited Basement',
      typography: BASEMENT_BRAND_IDENTITY.typography.map((typography) =>
        typography.role === 'Display'
          ? { ...typography, letterSpacing: -5, lineHeight: 0.88, weight: 500 }
          : typography
      ),
    };

    const basement = hydrateBrandIdentities([storedBasement]).find(
      ({ id }) => id === 'basement'
    )!;
    const display = basement.typography.find(({ role }) => role === 'Display')!;

    expect(basement.name).toBe('Edited Basement');
    expect(display.letterSpacing).toBe(-1);
    expect(display.lineHeight).toBe(0.98);
    expect(display.weight).toBe(500);
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

  it('backfills newly registered built-in assets without replacing stored assets', () => {
    const storedGt = {
      ...GT_BRAND_IDENTITY,
      assets: GT_BRAND_IDENTITY.assets
        .filter(({ id }) => id !== 'library-advance' && id !== 'library-constellation')
        .map((asset) => asset.id === 'mark-dark' ? { ...asset, label: 'Stored GT mark' } : asset),
    };

    const gt = hydrateBrandIdentities([storedGt]).find(({ id }) => id === 'gt')!;

    expect(gt.assets.find(({ id }) => id === 'mark-dark')?.label).toBe('Stored GT mark');
    expect(gt.assets.find(({ id }) => id === 'library-advance')?.path).toBe(
      '/brands/gt/library/advance.png'
    );
    expect(gt.assets.find(({ id }) => id === 'library-constellation')?.path).toBe(
      '/brands/gt/library/language-constellation.svg'
    );
  });
});
