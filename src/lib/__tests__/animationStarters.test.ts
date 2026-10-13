import { describe, expect, it } from 'vitest';

import {
  ANIMATION_STARTER_IDS,
  animationStartersFor,
  buildAnimationStarter,
  parseCubicBezier,
  STARTER_CANVAS,
} from '../animationStarters';
import { normalizeSceneMotion } from '../animationMotion';
import { brandTypographyRole } from '../brandIdentity';
import { colorContrastRatio } from '../color';
import { BUILT_IN_BRAND_IDENTITIES } from '../identityPresets';
import { capVisibleFontWeight } from '../typography';

let next = 0;
const createId = () => `id-${next++}`;

describe('Animation brand starters', () => {
  it.each(BUILT_IN_BRAND_IDENTITIES.map((identity) => [identity.id, identity] as const))('composes every %s starter as a valid, readable sequence', (_id, identity) => {
    const starters = animationStartersFor(identity);
    expect(starters.map(({ id }) => id)).toEqual([...ANIMATION_STARTER_IDS]);
    for (const starter of starters) {
      const hasLogo = identity.assets.some((asset) => asset.type === 'logo');
      const pack = buildAnimationStarter({ createId, hasLogo, identity, starterId: starter.id });
      expect(pack.settings).toMatchObject({ height: STARTER_CANVAS.height, width: STARTER_CANVAS.width });
      expect(pack.settings.fontWeight).toBe(capVisibleFontWeight(brandTypographyRole(identity, 'Display').weight ?? 500));
      expect(pack.textFrames.split('\n')).toEqual(starter.scenes);
      const textIds = starter.scenes.map((_, index) => `text-${index}`);
      expect(pack.sequenceOrder.filter((id) => id !== 'brand-logo')).toEqual(textIds);
      expect(pack.sequenceOrder.includes('brand-logo')).toBe(hasLogo);
      for (const id of pack.sequenceOrder) {
        const frame = pack.frameSettings[id]!;
        expect(() => normalizeSceneMotion(frame, `frameSettings.${id}`)).not.toThrow();
        if (id === 'brand-logo') continue;
        expect(frame.caption?.text.trim()).toBeTruthy();
        // Display type is large (>= 24px): WCAG AA large-text contrast against its field.
        const field = pack.backgroundOverrides[id] ? frame.background.colorA : pack.sequenceBackground.colorA;
        expect(colorContrastRatio(frame.foreground, field)).toBeGreaterThanOrEqual(3);
        if (!pack.backgroundOverrides[id] && pack.sequenceBackground.style === 'gradient') {
          expect(colorContrastRatio(frame.foreground, pack.sequenceBackground.colorB)).toBeGreaterThanOrEqual(3);
        }
      }
    }
  });

  it('gives each identity its own art direction', () => {
    const looks = BUILT_IN_BRAND_IDENTITIES.map((identity) => {
      const pack = buildAnimationStarter({ createId, hasLogo: true, identity, starterId: 'brand-intro' });
      const first = pack.frameSettings['text-0']!;
      return JSON.stringify([pack.sequenceBackground.style, pack.sequenceBackground.colorA, pack.settings.packageId, first.textAnimation?.preset ?? 'none', first.textAnchor, pack.settings.fontWeight]);
    });
    expect(new Set(looks).size).toBe(BUILT_IN_BRAND_IDENTITIES.length);
  });

  it('keeps General Translation on its centred one-and-a-quarter-second morph with language captions', () => {
    const gt = BUILT_IN_BRAND_IDENTITIES.find(({ id }) => id === 'gt')!;
    const pack = buildAnimationStarter({ createId, hasLogo: true, identity: gt, starterId: 'brand-intro' });
    expect(pack.settings).toMatchObject({ holdMs: 1250, packageId: 'morph-fade', transitionMs: 240 });
    expect(pack.frameSettings['text-0']).toMatchObject({ caption: { text: 'EN · English' }, textAnchor: 'center' });
    expect(pack.sequenceOrder[0]).toBe('brand-logo');
  });

  it('reads identity motion curves and falls back on malformed input', () => {
    expect(parseCubicBezier('cubic-bezier(0.22, 1, 0.36, 1)')).toEqual([0.22, 1, 0.36, 1]);
    expect(parseCubicBezier('ease-out')).toEqual([0.16, 1, 0.3, 1]);
  });
});
