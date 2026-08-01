'use client';

import AnimationStudio from '@/components/AnimationStudio';
import { GT_BRAND_IDENTITY } from '@/lib/brandIdentity';

const MARKETING_ANIMATION_IDENTITY = {
  ...GT_BRAND_IDENTITY,
  builtIn: false,
  id: 'marketing-animation-demo',
};

export default function MarketingAnimationStudioLive() {
  return <AnimationStudio compactControls embedded identity={MARKETING_ANIMATION_IDENTITY} />;
}
