// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { useLandingRenderQuality } from '@/hooks/useLandingRenderQuality';
import { LANDING_RENDER_QUALITY_STORAGE_KEY, landingRenderQualityStore } from '@/lib/landingRenderQuality';

vi.mock('@/components/ui/StudioSelect', () => ({
  default: ({ ariaLabel, onValueChange, options, value }: {
    ariaLabel: string;
    onValueChange: (value: string) => void;
    options: { label: string; value: string }[];
    value: string;
  }) => <select aria-label={ariaLabel} onChange={(event) => onValueChange(event.target.value)} value={value}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>,
}));

import MarketingRenderQualityControl from '@/components/MarketingRenderQualityControl';

function OtherLandingDemo() {
  const { quality } = useLandingRenderQuality();
  return <output data-other-demo>{quality}</output>;
}

describe('MarketingRenderQualityControl', () => {
  it('exposes Auto, High, and Low and updates every landing subscriber with a persisted override', () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const container = document.body.appendChild(document.createElement('div'));
    const root = createRoot(container);
    try {
      act(() => root.render(<><MarketingRenderQualityControl /><OtherLandingDemo /></>));
      const select = container.querySelector<HTMLSelectElement>('[aria-label="Landing demo render quality"]')!;
      expect([...select.options].map(({ text }) => text)).toEqual(['Auto', 'High', 'Low']);
      act(() => {
        select.value = 'low';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(container.querySelector('[data-other-demo]')?.textContent).toBe('low');
      expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('Lower GPU use');
      expect(JSON.parse(window.localStorage.getItem(LANDING_RENDER_QUALITY_STORAGE_KEY)!)).toBe('low');
      act(() => {
        select.value = 'high';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(container.querySelector('[data-other-demo]')?.textContent).toBe('high');
    } finally {
      act(() => { landingRenderQualityStore.setMode('auto'); root.unmount(); });
      container.remove();
      vi.unstubAllGlobals();
    }
  });
});
