// @vitest-environment happy-dom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Button } from '@/components/ui/Button';
import StudioPreviewTooltip from '@/components/ui/StudioPreviewTooltip';
import StudioTooltipProvider from '@/components/ui/StudioTooltipProvider';

describe('shared control tooltip coverage', () => {
  let host: HTMLDivElement;
  let root: Root;
  const tooltip = () => document.querySelector<HTMLElement>('.studio-control-tooltip');
  const control = () => host.querySelector<HTMLElement>('[data-control]')!;
  const pointer = (target: HTMLElement, type: string, pointerType = 'mouse', relatedTarget: EventTarget | null = null) => {
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType, relatedTarget }));
  };
  const hover = (target = control()) => act(() => pointer(target, 'pointerover'));
  const waitForHint = () => act(() => vi.advanceTimersByTime(420));
  const focus = (target = control()) => act(() => target.focus());

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function render(children = <Button aria-label='Zoom in' data-control size='icon-sm' title='Zoom in'>+</Button>) {
    act(() => root.render(<StudioTooltipProvider>{children}</StudioTooltipProvider>));
  }

  it('shows a delayed shared-button title on hover and restores the native title on exit', () => {
    render();
    hover();
    expect(tooltip()).toBeNull();
    waitForHint();
    expect(tooltip()?.textContent).toBe('Zoom in');
    expect(control().getAttribute('title')).toBe('');
    act(() => pointer(control(), 'pointerout'));
    act(() => vi.advanceTimersByTime(110));
    expect(tooltip()).toBeNull();
    expect(control().getAttribute('title')).toBe('Zoom in');
  });

  it('shows aria-label-only native controls on keyboard focus and preserves existing descriptions', () => {
    render(<button aria-describedby='existing-help' aria-label='Undo' data-control type='button'>↶</button>);
    focus();
    expect(tooltip()?.textContent).toBe('Undo');
    expect(tooltip()?.getAttribute('role')).toBe('tooltip');
    expect(control().getAttribute('aria-describedby')).toBe(`existing-help ${tooltip()?.id}`);
    act(() => control().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(tooltip()).toBeNull();
    expect(control().getAttribute('aria-describedby')).toBe('existing-help');
    expect(document.activeElement).toBe(control());
  });

  it('shows keyboard hints immediately even when the same control has a pending hover', () => {
    render(<button data-control title='Save design'>Save</button>);
    hover();
    expect(tooltip()).toBeNull();
    focus();
    expect(tooltip()?.textContent).toBe('Save design');
    expect(tooltip()?.dataset.keyboard).toBe('true');
  });

  it('warms neighboring hints for 900ms after the first hint and then restores the delay', () => {
    render(<><button aria-label='Zoom in' data-control>+</button><button aria-label='Zoom out' data-next>−</button></>);
    hover();
    expect(tooltip()).toBeNull();
    waitForHint();
    expect(tooltip()?.textContent).toBe('Zoom in');
    const next = host.querySelector<HTMLElement>('[data-next]')!;
    act(() => {
      pointer(control(), 'pointerout', 'mouse', next);
      pointer(next, 'pointerover', 'mouse', control());
    });
    expect(tooltip()?.textContent).toBe('Zoom out');
    act(() => pointer(next, 'pointerout'));
    act(() => vi.advanceTimersByTime(110 + 901));
    hover();
    expect(tooltip()).toBeNull();
    waitForHint();
    expect(tooltip()?.textContent).toBe('Zoom in');
  });

  it('does not install an observer or scan layout until a hint is requested', () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const measure = vi.spyOn(window, 'getComputedStyle');
    render();
    expect(observe).not.toHaveBeenCalled();
    expect(measure).not.toHaveBeenCalled();
    hover();
    expect(observe).toHaveBeenCalled();
    expect(observe.mock.calls.every(([, options]) => !options?.subtree)).toBe(true);
  });

  it('does not consume clicks or open again from pointer-caused focus', () => {
    const clicked = vi.fn();
    render(<Button aria-label='Add artboard' data-control onClick={clicked}>+</Button>);
    hover();
    waitForHint();
    act(() => {
      pointer(control(), 'pointerdown');
      control().focus();
      control().click();
    });
    expect(tooltip()).toBeNull();
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('ignores touch hover but still permits a subsequent keyboard hint', () => {
    render();
    act(() => pointer(control(), 'pointerover', 'touch'));
    waitForHint();
    expect(tooltip()).toBeNull();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    focus();
    expect(tooltip()?.textContent).toBe('Zoom in');
  });

  it('does not create hover hints on a non-hover device but retains keyboard access', () => {
    const matchMedia = window.matchMedia.bind(window);
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => {
      const media = matchMedia(query);
      if (query === '(hover: none)') Object.defineProperty(media, 'matches', { value: true });
      return media;
    });
    render();
    hover();
    waitForHint();
    expect(tooltip()).toBeNull();
    focus();
    expect(tooltip()?.textContent).toBe('Zoom in');
  });

  it('leaves range input and keyboard interactions untouched', () => {
    const changed = vi.fn();
    render(<input aria-label='Text size' data-control onInput={changed} type='range' />);
    focus();
    expect(tooltip()?.textContent).toBe('Text size');
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    act(() => control().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false);
    act(() => control().dispatchEvent(new Event('input', { bubbles: true })));
    expect(changed).toHaveBeenCalledOnce();
    expect(tooltip()).toBeNull();
  });

  it('does not duplicate a rich preview tooltip', () => {
    render(<StudioPreviewTooltip title='Frame preview'><button aria-label='Frame one' data-control title='Frame one'>1</button></StudioPreviewTooltip>);
    hover();
    waitForHint();
    expect(tooltip()).toBeNull();
    expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
  });

  it('allows the pointer to enter and read the tooltip without dismissing it', () => {
    render();
    hover();
    waitForHint();
    const hint = tooltip()!;
    act(() => {
      pointer(control(), 'pointerout', 'mouse', hint);
      pointer(hint, 'pointerover', 'mouse', control());
      vi.advanceTimersByTime(500);
    });
    expect(tooltip()).toBe(hint);
  });

  it('rearms a pending hover after a quick pointer exit and return', () => {
    render();
    hover();
    act(() => vi.advanceTimersByTime(100));
    act(() => pointer(control(), 'pointerout'));
    act(() => vi.advanceTimersByTime(50));
    hover();
    waitForHint();
    expect(tooltip()?.textContent).toBe('Zoom in');
  });

  it('dismisses stale aria-label hints when the control action changes', async () => {
    render(<button aria-label='Play' data-control>▶</button>);
    focus();
    expect(tooltip()?.textContent).toBe('Play');
    await act(async () => {
      control().setAttribute('aria-label', 'Pause');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(tooltip()).toBeNull();
  });

  it('dismisses on scroll without blocking the scroll event', () => {
    render();
    focus();
    const event = new Event('scroll', { cancelable: true });
    act(() => window.dispatchEvent(event));
    expect(tooltip()).toBeNull();
    expect(event.defaultPrevented).toBe(false);
  });

  it('does not show hints for expanded popover triggers or inert owners', () => {
    render(<div inert><button aria-label='Hidden tool' data-control>Hidden</button></div>);
    hover();
    waitForHint();
    expect(tooltip()).toBeNull();
    render(<button aria-expanded='true' aria-label='Open menu' data-control>Menu</button>);
    hover();
    waitForHint();
    expect(tooltip()).toBeNull();
  });

  it('keeps hints inside the owning native popover top layer', () => {
    render(<div popover='manual'><button aria-label='Hue preset' data-control>Hue</button></div>);
    focus();
    expect(tooltip()?.closest('[popover]')).toBe(host.firstElementChild);
  });

  it('skips CSS-hidden owners even when a synthetic focus is dispatched', () => {
    render(<div style={{ display: 'none' }}><button aria-label='Hidden tool' data-control>Hidden</button></div>);
    act(() => control().dispatchEvent(new FocusEvent('focusin', { bubbles: true })));
    expect(tooltip()).toBeNull();
  });

  it('dismisses when the retained tool becomes inactive without moving focus', async () => {
    render(<div className='studio-workspace-layer' data-active='true'><button aria-label='Current tool' data-control>Tool</button></div>);
    focus();
    expect(tooltip()).not.toBeNull();
    await act(async () => {
      host.firstElementChild!.setAttribute('data-active', 'false');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(tooltip()).toBeNull();
    expect(control().hasAttribute('aria-describedby')).toBe(false);
  });

  it('cleans up pending and open hints when a trigger unmounts', async () => {
    render();
    hover();
    act(() => root.render(<StudioTooltipProvider><span>New page</span></StudioTooltipProvider>));
    await act(async () => vi.advanceTimersByTimeAsync(500));
    expect(tooltip()).toBeNull();
    render();
    focus();
    expect(tooltip()).not.toBeNull();
    act(() => root.render(<StudioTooltipProvider><span>Another page</span></StudioTooltipProvider>));
    await act(async () => vi.advanceTimersByTimeAsync(0));
    expect(tooltip()).toBeNull();
  });

  it('never overwrites a new title supplied while the previous title is suppressed', async () => {
    let changeTitle: (title: string) => void;
    function DynamicTitle() {
      const [title, setTitle] = useState('Save design');
      changeTitle = setTitle;
      return <button data-control title={title}>Save</button>;
    }
    render(<DynamicTitle />);
    hover();
    waitForHint();
    await act(async () => {
      changeTitle!('Saved design');
      await vi.advanceTimersByTimeAsync(0);
    });
    act(() => pointer(control(), 'pointerout'));
    act(() => vi.advanceTimersByTime(110));
    expect(control().getAttribute('title')).toBe('Saved design');
  });
});
