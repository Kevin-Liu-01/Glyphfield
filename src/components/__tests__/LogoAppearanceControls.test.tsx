// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import { DEFAULT_LOGO_APPEARANCE } from '@/lib/logoAppearance';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (value: string) => value,
}));

Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true);

describe('LogoAppearanceControls', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let animationFrame: FrameRequestCallback | null;

  beforeEach(() => {
    animationFrame = null;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      animationFrame = callback;
      return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.replaceChildren();
    vi.unstubAllGlobals();
  });

  it('previews and commits sticker outline width while using the shared effect groups', () => {
    const onChange = vi.fn();
    const onPreview = vi.fn();
    act(() => root.render(
      <LogoAppearanceControls
        kind='sticker'
        onChange={onChange}
        onPreview={onPreview}
        settings={{
          ...DEFAULT_LOGO_APPEARANCE,
          borderEnabled: true,
          borderWidth: 7,
        }}
      />
    ));

    expect(container.textContent).toContain('Die-cut outline');
    expect(container.querySelectorAll('.shader-lab-v2-effect-group')).toHaveLength(3);
    const outlineLabel = [...container.querySelectorAll('label')]
      .find((label) => label.textContent?.includes('Outline width'));
    const outlineRange = outlineLabel?.querySelector<HTMLInputElement>('input[type="range"]');
    if (!outlineRange) throw new Error('Missing sticker outline width control');
    expect(outlineRange.getAttribute('aria-label')).toBe('Outline width');

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(outlineRange, '15');
      outlineRange.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => animationFrame?.(16));
    expect(onPreview).toHaveBeenLastCalledWith({ borderWidth: 15 });

    act(() => outlineRange.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
    expect(onChange).toHaveBeenLastCalledWith({ borderWidth: 15 });
  });
});
