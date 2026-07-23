import { describe, expect, it } from 'vitest';

import { GT_BRAND_IDENTITY, STARTER_BRAND_IDENTITY } from '../brandIdentity';
import {
  defaultTemplatePartner,
  templateBrandLogo,
  templatePartnerOptions,
} from '../templateAssets';

describe('template assets', () => {
  it('uses the real GT logo family for template surfaces', () => {
    expect(templateBrandLogo(GT_BRAND_IDENTITY, 'partnership', false)?.path).toBe(
      '/brands/gt/logos/wordmark-black.svg'
    );
    expect(templateBrandLogo(GT_BRAND_IDENTITY, 'slides', true)?.path).toBe(
      '/brands/gt/logos/wordmark-white.svg'
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
