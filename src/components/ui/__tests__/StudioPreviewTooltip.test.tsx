// @vitest-environment happy-dom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StudioPreviewTooltip from '@/components/ui/StudioPreviewTooltip';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('StudioPreviewTooltip', () => {
  let container: HTMLDivElement;
  let root: Root;
  let testTime = Date.UTC(2030, 0, 1);

  beforeEach(() => {
    vi.useFakeTimers();
    testTime += 10_000;
    vi.setSystemTime(testTime);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    container.remove();
    document.querySelectorAll('.studio-preview-tooltip').forEach((tooltip) => tooltip.remove());
  });

  function renderTooltip() {
    act(() => root.render(
      <StudioPreviewTooltip description='Shows the complete frame.' preview={<span>Preview</span>} size='compact' title='Frame one'>
        <button type='button'>Frame</button>
      </StudioPreviewTooltip>
    ));
    return container.querySelector<HTMLButtonElement>('button')!;
  }

  it('opens on keyboard focus, describes the trigger, and dismisses with Escape', () => {
    const trigger = renderTooltip();
    act(() => trigger.dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');
    expect(tooltip?.textContent).toContain('Frame one');
    expect(tooltip?.dataset.size).toBe('compact');
    expect(trigger.getAttribute('aria-describedby')).toBe(tooltip?.id);

    act(() => trigger.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });

  it('waits before the first pointer preview to avoid accidental activation', () => {
    const trigger = renderTooltip();
    act(() => trigger.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' })));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    act(() => vi.advanceTimersByTime(420));
    expect(document.querySelector('[role="tooltip"]')?.textContent).toContain('Shows the complete frame.');
  });
});
