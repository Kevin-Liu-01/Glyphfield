'use client';

import AnimationStudio from '@/components/AnimationStudio';
import { GT_BRAND_IDENTITY } from '@/lib/brandIdentity';
import { SHADER_LIBRARY_SCENES } from '@/lib/shaderLab';

const MARKETING_ANIMATION_IDENTITY = {
  ...GT_BRAND_IDENTITY,
  builtIn: false,
  id: 'marketing-animation-demo-dithering-swirl-v1',
};

export default function MarketingAnimationStudioLive() {
  const { materialId, settings } = SHADER_LIBRARY_SCENES.heroAnimation;
  return (
    <AnimationStudio
      compactControls
      embedded
      identity={MARKETING_ANIMATION_IDENTITY}
      initialFontWeight={350}
      initialSequenceBackground={{
        colorA: settings.colorA,
        colorB: settings.colorB,
        colorC: settings.colorC,
        materialId,
        materialSettings: settings,
        style: 'shader',
      }}
    />
  );
}
