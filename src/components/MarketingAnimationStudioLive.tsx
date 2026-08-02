'use client';

import AnimationStudio from '@/components/AnimationStudio';
import { GT_BRAND_IDENTITY } from '@/lib/brandIdentity';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';

const MARKETING_ANIMATION_IDENTITY = {
  ...GT_BRAND_IDENTITY,
  builtIn: false,
  id: 'marketing-animation-demo-liquid-metal-v1',
};

const MARKETING_LIQUID_METAL_SETTINGS = {
  ...DEFAULT_LIVE_MATERIAL_SETTINGS,
  amplitude: 3.4,
  brightness: 0.84,
  colorA: '#0B0908',
  colorB: '#A84322',
  colorC: '#F6D6AE',
  density: 0.9,
  detail: 4.2,
  frequency: 4.6,
  grain: 6,
  rotationZ: 12,
  speed: 0.16,
  strength: 0.64,
};

export default function MarketingAnimationStudioLive() {
  return (
    <AnimationStudio
      compactControls
      embedded
      identity={MARKETING_ANIMATION_IDENTITY}
      initialSequenceBackground={{
        colorA: MARKETING_LIQUID_METAL_SETTINGS.colorA,
        colorB: MARKETING_LIQUID_METAL_SETTINGS.colorB,
        colorC: MARKETING_LIQUID_METAL_SETTINGS.colorC,
        materialId: 'paper-liquid-metal',
        materialSettings: MARKETING_LIQUID_METAL_SETTINGS,
        style: 'shader',
      }}
    />
  );
}
