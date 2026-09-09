// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import StudioRange from '@/components/ui/StudioRange';

describe('StudioRange', () => {
  it('keeps native range semantics and exposes its initial progress to the shared skin', () => {
    const markup = renderToStaticMarkup(
      <StudioRange aria-label='Speed' max={3} min={1} value={1.5} />
    );

    expect(markup).toContain('type="range"');
    expect(markup).toContain('data-studio-range="true"');
    expect(markup).toContain('--studio-range-progress:25%');
    expect(markup).toContain('aria-label="Speed"');
  });

  it('uses a neutral foreground by default and accepts an explicit workspace highlight', () => {
    const styles = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const sharedRangeStyles = styles.slice(
      styles.indexOf("input.studio-range[data-studio-range='true'] {"),
      styles.indexOf("input.studio-range[data-studio-range='true']::-webkit-slider-runnable-track")
    );

    expect(sharedRangeStyles).toContain(
      '--studio-range-accent: var(--studio-highlight-color, hsl(var(--foreground)));'
    );
    expect(sharedRangeStyles).toContain('--studio-range-thumb-border: var(--studio-range-accent);');
    expect(sharedRangeStyles).not.toContain('#5b7cff');
    expect(styles.match(/--studio-highlight-color: hsl\(var\(--primary\)\);/g)).toHaveLength(3);
  });
});

describe('StudioRange pointer focus', () => {
  let container: HTMLDivElement;
  let root: Root;
  let previous: HTMLButtonElement;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    previous = document.createElement('button');
    document.body.append(previous, container);
    previous.focus();
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    previous.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('waits until primary release to focus, after Safari mousedown can blur', () => {
    const onPointerDown = vi.fn(() => expect(document.activeElement).toBe(previous));
    const onPointerUp = vi.fn(() => expect(document.activeElement).toBe(document.body));
    act(() => root.render(<StudioRange aria-label='Text size' onPointerDown={onPointerDown} onPointerUp={onPointerUp} />));
    const input = container.querySelector('input')!;
    const focus = vi.spyOn(input, 'focus');
    const capture = vi.fn();
    Object.defineProperty(input, 'setPointerCapture', { configurable: true, value: capture });
    const press = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, isPrimary: true });

    act(() => input.dispatchEvent(press));
    expect(onPointerDown).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(previous);
    expect(focus).not.toHaveBeenCalled();
    // Safari's native mousedown moves focus to BODY after pointerdown. Model
    // that default action explicitly; DOM dispatch cannot perform it for us.
    act(() => {
      input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      previous.blur();
    });
    const release = new PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0, isPrimary: true });
    act(() => input.dispatchEvent(release));

    expect(onPointerUp).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
    expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(press.defaultPrevented).toBe(false);
    expect(release.defaultPrevented).toBe(false);
    expect(capture).not.toHaveBeenCalled();
  });

  it.each([
    { reason: 'disabled input', disabled: true, button: 0, isPrimary: true },
    { reason: 'secondary mouse button', disabled: false, button: 2, isPrimary: true },
    { reason: 'non-primary pointer', disabled: false, button: 0, isPrimary: false },
  ])('does not take focus for a $reason', ({ disabled, button, isPrimary }) => {
    act(() => root.render(<StudioRange aria-label='Text size' disabled={disabled} />));
    const input = container.querySelector('input')!;
    const focus = vi.spyOn(input, 'focus');
    act(() => input.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button, isPrimary })));
    expect(document.activeElement).toBe(previous);
    expect(focus).not.toHaveBeenCalled();
  });

  it('lets the consumer cancel pointer focus through preventDefault', () => {
    const onPointerUp = vi.fn((event) => event.preventDefault());
    act(() => root.render(<StudioRange aria-label='Text size' onPointerUp={onPointerUp} />));
    const input = container.querySelector('input')!;
    const focus = vi.spyOn(input, 'focus');
    const press = new PointerEvent('pointerup', { bubbles: true, cancelable: true, button: 0, isPrimary: true });
    act(() => input.dispatchEvent(press));
    expect(onPointerUp).toHaveBeenCalledOnce();
    expect(press.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(previous);
    expect(focus).not.toHaveBeenCalled();
  });

  it('focuses after a completed or assistive click while composing the consumer', () => {
    const onClick = vi.fn(() => expect(document.activeElement).toBe(previous));
    act(() => root.render(<StudioRange aria-label='Text size' onClick={onClick} />));
    const input = container.querySelector('input')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, detail: 0 });
    act(() => input.dispatchEvent(click));
    expect(onClick).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
    expect(click.defaultPrevented).toBe(false);
  });

  it.each([
    { reason: 'disabled input', disabled: true, button: 0, cancel: false },
    { reason: 'secondary mouse button', disabled: false, button: 2, cancel: false },
    { reason: 'canceled consumer click', disabled: false, button: 0, cancel: true },
  ])('does not focus after a click for a $reason', ({ disabled, button, cancel }) => {
    const onClick = vi.fn((event) => { if (cancel) event.preventDefault(); });
    act(() => root.render(<StudioRange aria-label='Text size' disabled={disabled} onClick={onClick} />));
    const input = container.querySelector('input')!;
    const focus = vi.spyOn(input, 'focus');
    act(() => input.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button })));
    expect(document.activeElement).toBe(previous);
    expect(focus).not.toHaveBeenCalled();
  });
});
