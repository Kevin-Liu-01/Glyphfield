import { describe, expect, it } from 'vitest';

import {
  BUILT_IN_BRAND_IDENTITIES,
  GT_BRAND_IDENTITY,
  STARTER_BRAND_IDENTITY,
} from '../brandIdentity';
import {
  defaultTemplatePartnerFont,
  defaultTemplatePartnerTreatment,
  defaultTemplatePartner,
  templateBackgroundOptions,
  templateBrandLogo,
  templatePartnerFontOptions,
  templatePartnerOptions,
} from '../templateAssets';

describe('template assets', () => {
  it('uses the mark-only GT logo family for template surfaces', () => {
    expect(templateBrandLogo(GT_BRAND_IDENTITY, 'partnership', false)?.path).toBe(
      '/brands/gt/logos/mark-black.svg'
    );
    expect(templateBrandLogo(GT_BRAND_IDENTITY, 'slides', true)?.path).toBe(
      '/brands/gt/logos/mark-white.svg'
    );
    expect(templateBrandLogo(GT_BRAND_IDENTITY, 'blog', false)?.path).toBe(
      '/brands/gt/logos/mark-black.svg'
    );
  });

  it('starts GT partnerships with a real proof logo', () => {
    expect(defaultTemplatePartner(GT_BRAND_IDENTITY)).toMatchObject({
      id: 'ramp',
      path: '/brands/gt/proof/ramp.svg',
    });
    expect(templatePartnerOptions(GT_BRAND_IDENTITY).map(({ id }) => id)).toEqual(
      expect.arrayContaining(['ramp', 'cursor', 'template-northstar'])
    );
  });

  it('uses the partner brand font when a matching identity exists', () => {
    expect(defaultTemplatePartnerFont(
      GT_BRAND_IDENTITY,
      'ramp',
      BUILT_IN_BRAND_IDENTITIES
    )).toMatchObject({
      family: 'Lausanne',
      id: 'ramp:ramp-lausanne-350',
      path: '/fonts/brands/ramp/lausanne-350.woff2',
      weight: 350,
    });
    expect(templatePartnerFontOptions(
      GT_BRAND_IDENTITY,
      'ramp',
      BUILT_IN_BRAND_IDENTITIES
    ).map(({ family }) => family)).toContain('Lausanne');
    expect(defaultTemplatePartnerTreatment('ramp', BUILT_IN_BRAND_IDENTITIES)).toBe('text');
    expect(defaultTemplatePartnerTreatment('cursor', BUILT_IN_BRAND_IDENTITIES)).toBe('logo');
  });

  it('keeps product identities out of background artwork options', () => {
    const options = templateBackgroundOptions(GT_BRAND_IDENTITY);

    expect(options.map(({ id }) => id)).toEqual(
      expect.arrayContaining(['identity-field', 'library-atmosphere', 'library-signal'])
    );
    expect(options.map(({ id }) => id)).not.toContain('reference-homepage');
    expect(options.map(({ id }) => id)).not.toContain('locadex');
  });

  it('gives a blank project a designed template partner instead of a text placeholder', () => {
    expect(defaultTemplatePartner(STARTER_BRAND_IDENTITY)).toMatchObject({
      id: 'template-northstar',
      path: '/templates/logos/northstar.svg',
    });
    expect(templateBrandLogo(STARTER_BRAND_IDENTITY, 'slides', false)?.path).toBe(
      '/templates/logos/starter-wordmark.svg'
    );
  });
});
