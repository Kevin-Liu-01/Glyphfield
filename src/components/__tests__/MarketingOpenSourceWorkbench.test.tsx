// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';

vi.mock('@/components/MarketingArcField', () => ({
  default: ({ maxPixelCount, renderScale, settings }: {
    maxPixelCount: number;
    renderScale: number;
    settings: { colorA: string; colorB: string; colorC: string };
  }) => (
    <div
      data-color-a={settings.colorA}
      data-color-b={settings.colorB}
      data-color-c={settings.colorC}
      data-max-pixel-count={maxPixelCount}
      data-render-scale={renderScale}
      data-testid='live-shader'
    />
  ),
}));

vi.mock('gt-next', () => ({
  T: ({ children }: { children: React.ReactNode }) => children,
}));

import MarketingOpenSourceWorkbench from '@/components/MarketingOpenSourceWorkbench';

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('MarketingOpenSourceWorkbench', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('debounces shader updates while keeping all three palette roles visible', () => {
    act(() => root.render(
      <MarketingOpenSourceWorkbench
        markPath='/mark.svg'
        materialId='paper-dithering-warp'
        settings={{
          ...DEFAULT_LIVE_MATERIAL_SETTINGS,
          colorA: '#401B45',
          colorB: '#FF9B75',
          colorC: '#FFD08F',
        }}
      />
    ));

    const shader = container.querySelector<HTMLElement>('[data-testid="live-shader"]');
    expect(shader?.dataset.colorB).toBe('#FF9B75');
    expect(shader?.dataset.maxPixelCount).toBe('320000');
    expect(shader?.dataset.renderScale).toBe('0.64');

    const accentInput = container.querySelector<HTMLInputElement>('[aria-label="Accent shader color"]');
    if (!accentInput) throw new Error('Missing accent color field');
    act(() => {
      accentInput.value = '#00ff88';
      accentInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(shader?.dataset.colorB).toBe('#FF9B75');
    act(() => vi.advanceTimersByTime(140));
    expect(shader?.dataset.colorB).toBe('#00FF88');
    expect(container.querySelector('[aria-label="Accent shader color"]')).toBe(accentInput);

    const baseButton = [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Shader color stop"] button')]
      .find((button) => button.textContent?.includes('Base'));
    if (!baseButton) throw new Error('Missing base color button');
    act(() => baseButton.click());

    const baseInput = container.querySelector<HTMLInputElement>('[aria-label="Base shader color"]');
    if (!baseInput) throw new Error('Missing base color field');
    act(() => {
      baseInput.value = '#111827';
      baseInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    act(() => vi.advanceTimersByTime(140));
    expect(shader?.dataset.colorA).toBe('#111827');
    expect(shader?.dataset.colorB).toBe('#00FF88');

    const lightButton = [...container.querySelectorAll<HTMLButtonElement>('[aria-label="Shader color stop"] button')]
      .find((button) => button.textContent?.includes('Light'));
    if (!lightButton) throw new Error('Missing light color button');
    act(() => lightButton.click());

    const lightInput = container.querySelector<HTMLInputElement>('[aria-label="Light shader color"]');
    if (!lightInput) throw new Error('Missing light color field');
    act(() => {
      lightInput.value = '#f8fafc';
      lightInput.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(shader?.dataset.colorC).toBe('#FFD08F');
    act(() => vi.advanceTimersByTime(140));
    expect(shader?.dataset.colorC).toBe('#F8FAFC');
    expect(container.querySelector<HTMLElement>('.marketing-v7-open-source-panel-content')?.style
      .getPropertyValue('--marketing-v14-light-color')).toBe('#F8FAFC');
  });
});
