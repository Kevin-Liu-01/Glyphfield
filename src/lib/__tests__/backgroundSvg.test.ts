import { describe, expect, it } from 'vitest';

import { buildBackgroundSvg, DEFAULT_BACKGROUND_SETTINGS } from '../backgroundSvg';

describe('buildBackgroundSvg', () => {
  it('builds configurable gradient, grain, pattern, and logo layers', () => {
    const svg = buildBackgroundSvg(
      {
        ...DEFAULT_BACKGROUND_SETTINGS,
        grain: 36,
        logoOpacity: 42,
        logoX: 10,
        logoY: -5,
        pattern: 'dots',
        patternOpacity: 42,
        style: 'grain-gradient',
      },
      { logo: 'data:image/svg+xml;base64,LOGO', name: 'GT' }
    );

    expect(svg).toContain('linearGradient');
    expect(svg).toContain('feTurbulence');
    expect(svg).toContain('pattern-dots');
    expect(svg).toContain('opacity="0.42"');
    expect(svg).toContain('x="615"');
    expect(svg).toContain('y="232.5"');
    expect(svg).toContain('data:image/svg+xml;base64,LOGO');
  });

  it('renders an ordered dither field without an external shader dependency', () => {
    const svg = buildBackgroundSvg({
      ...DEFAULT_BACKGROUND_SETTINGS,
      ditherMatrix: 4,
      style: 'dither',
    });

    expect(svg).toContain('data-dither-matrix="4"');
    expect(svg.match(/<circle /g)?.length).toBeGreaterThan(100);
  });
});
