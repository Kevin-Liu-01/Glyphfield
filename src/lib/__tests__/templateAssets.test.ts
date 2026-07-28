import { describe, expect, it } from 'vitest';

import { GT_BRAND_IDENTITY, STARTER_BRAND_IDENTITY } from '../brandIdentity';
import {
  defaultTemplatePartner,
  templateBackgroundOptions,
  templateBrandLogo,
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
