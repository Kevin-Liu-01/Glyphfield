import { describe, expect, it } from 'vitest';

import {
  buildLogoSvgFilter,
  DEFAULT_LOGO_APPEARANCE,
  logoAppearanceCssFilter,
} from '../logoAppearance';

describe('logo appearance', () => {
  it('builds an alpha-aware CSS treatment for inversion, outline, and shadow', () => {
    const filter = logoAppearanceCssFilter({
      ...DEFAULT_LOGO_APPEARANCE,
      borderColor: '#FF0000',
      borderEnabled: true,
      borderOpacity: 50,
      invert: true,
      shadowEnabled: true,
    });

    expect(filter).toContain('invert(1)');
    expect(filter).toContain('drop-shadow(0px 8px 18px #00000047)');
    expect(filter).toContain('drop-shadow(2px 0 0 #FF000080)');
    expect(filter).toContain('drop-shadow(-2px -2px 0 #FF000080)');
  });

  it('builds an SVG filter around the source alpha instead of its bounding box', () => {
    const filter = buildLogoSvgFilter({
      ...DEFAULT_LOGO_APPEARANCE,
      borderEnabled: true,
      invert: true,
      shadowEnabled: true,
    }, '#181818', 'test-logo');

    expect(filter).toContain('id="test-logo"');
    expect(filter).toContain('<feMorphology in="SourceAlpha"');
    expect(filter).toContain('<feComponentTransfer in="colored"');
    expect(filter).toContain('<feDropShadow in="inverted"');
  });

  it('adds a configurable dither pass before outline and shadow composition', () => {
    const filter = buildLogoSvgFilter({
      ...DEFAULT_LOGO_APPEARANCE,
      ditherAmount: 80,
      ditherAngle: 45,
      ditherEnabled: true,
      ditherScale: 8,
      shadowEnabled: true,
    }, '#FFFFFF', 'dither-logo');

    expect(filter).toContain('result="dither-noise"');
    expect(filter).toContain('result="dithered"');
    expect(filter).toContain('<feDropShadow in="dithered"');
  });
});
