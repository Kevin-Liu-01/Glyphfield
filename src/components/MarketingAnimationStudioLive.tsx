'use client';

import AnimationStudio from '@/components/AnimationStudio';
import { GT_BRAND_IDENTITY } from '@/lib/gtBrandIdentity';
import { SHADER_LIBRARY_SCENES } from '@/lib/shaderLab';

const MARKETING_ANIMATION_IDENTITY = {
  ...GT_BRAND_IDENTITY,
  builtIn: false,
  id: 'marketing-animation-demo-dithering-swirl-v2',
};

const HERO_SHADER = SHADER_LIBRARY_SCENES.heroAnimation;
const HERO_BACKGROUND = {
  colorA: HERO_SHADER.settings.colorA,
  colorB: HERO_SHADER.settings.colorB,
  colorC: HERO_SHADER.settings.colorC,
  materialId: HERO_SHADER.materialId,
  materialSettings: HERO_SHADER.settings,
  opacity: 0.88,
  style: 'shader' as const,
};

export default function MarketingAnimationStudioLive({ viewportVisible = true }: { viewportVisible?: boolean }) {
  return (
    <AnimationStudio
      autoPlay
      compactControls
      embedded
      viewportVisible={viewportVisible}
      identity={MARKETING_ANIMATION_IDENTITY}
      initialFontWeight={350}
      initialSequenceBackground={HERO_BACKGROUND}
      presentationMode
    />
  );
}
