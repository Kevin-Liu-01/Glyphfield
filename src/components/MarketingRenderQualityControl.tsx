'use client';

import StudioSelect from '@/components/ui/StudioSelect';
import { useLandingRenderQuality } from '@/hooks/useLandingRenderQuality';
import { landingRenderQualityStore, parseLandingRenderQualityMode } from '@/lib/landingRenderQuality';

const QUALITY_OPTIONS = [
  { label: 'Auto', value: 'auto' },
  { label: 'High', value: 'high' },
  { label: 'Low', value: 'low' },
] as const;

export default function MarketingRenderQualityControl({ className = '' }: { className?: string }) {
  const { mode, quality } = useLandingRenderQuality();
  return (
    <div className={`marketing-render-quality ${className}`} data-render-quality={quality}>
      <span>Demo quality</span>
      <StudioSelect
        ariaLabel='Landing demo render quality'
        onValueChange={(value) => landingRenderQualityStore.setMode(parseLandingRenderQualityMode(value))}
        options={QUALITY_OPTIONS}
        title='Landing demos only. Auto lowers resolution after sustained slow frames. High and Low override it; Studio artwork and exports are unchanged.'
        value={mode}
      />
      <output aria-live='polite'>{quality === 'high' ? 'High resolution' : 'Lower GPU use'}</output>
    </div>
  );
}
