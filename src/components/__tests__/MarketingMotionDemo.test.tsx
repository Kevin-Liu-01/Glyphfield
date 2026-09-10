// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MarketingMotionDemo } from '@/components/MarketingStudioShowcaseDemos';

describe('MarketingMotionDemo activity lifecycle', () => {
  let host: HTMLDivElement;
  let root: Root;
  let intersect: IntersectionObserverCallback | undefined;
  let visibility: DocumentVisibilityState;
  let media: EventTarget & { matches: boolean };
  let disconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    visibility = 'visible';
    intersect = undefined;
    disconnect = vi.fn();
    media = Object.assign(new EventTarget(), { matches: false });
    vi.stubGlobal('matchMedia', () => media);
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback: IntersectionObserverCallback) { intersect = callback; }
      observe() {}
      disconnect = disconnect;
    });
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const render = () => act(() => root.render(<MarketingMotionDemo />));
  const demo = () => host.querySelector<HTMLElement>('.marketing-mini-motion-workspace')!;
  const advance = (ms = 1490) => act(() => vi.advanceTimersByTime(ms));
  function setVisible(visible: boolean) {
    act(() => intersect?.([{ isIntersecting: visible } as IntersectionObserverEntry], {} as IntersectionObserver));
  }
  function setDocumentVisibility(next: DocumentVisibilityState) {
    act(() => {
      visibility = next;
      document.dispatchEvent(new Event('visibilitychange'));
    });
  }
  function setReducedMotion(reduced: boolean) {
    act(() => {
      media.matches = reduced;
      media.dispatchEvent(new Event('change'));
    });
  }
  function click(label: string) {
    const button = host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
    expect(button).not.toBeNull();
    act(() => button!.click());
  }

  it('schedules no frame work before the below-fold demo is visible', () => {
    render();
    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(demo().dataset).toMatchObject({ active: 'false', frame: '0', playing: 'true' });
    setVisible(true);
    expect(vi.getTimerCount()).toBe(1);
    advance();
    expect(demo().dataset).toMatchObject({ active: 'true', frame: '1', playing: 'true' });
  });

  it('suspends offscreen work and resumes from the retained frame without changing play intent', () => {
    render();
    setVisible(true);
    advance();
    setVisible(false);
    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(demo().dataset).toMatchObject({ active: 'false', frame: '1', playing: 'true' });
    setVisible(true);
    expect(demo().dataset.frame).toBe('1');
    advance();
    expect(demo().dataset.frame).toBe('2');
  });

  it('keeps a geometrically visible demo stopped while the browser tab is hidden', () => {
    render();
    setVisible(true);
    advance();
    setDocumentVisibility('hidden');
    setVisible(true);
    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(demo().dataset).toMatchObject({ active: 'false', frame: '1', playing: 'true' });
    setDocumentVisibility('visible');
    advance();
    expect(demo().dataset.frame).toBe('2');
  });

  it('reacts immediately to reduced-motion changes without resetting the frame or play intent', () => {
    render();
    setVisible(true);
    advance();
    setReducedMotion(true);
    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(demo().dataset).toMatchObject({ active: 'false', frame: '1', playing: 'true' });
    setReducedMotion(false);
    advance();
    expect(demo().dataset.frame).toBe('2');
  });

  it('starts without animation when reduced motion is already enabled', () => {
    media.matches = true;
    render();
    setVisible(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(demo().dataset).toMatchObject({ active: 'false', frame: '0', playing: 'true' });
    setReducedMotion(false);
    advance();
    expect(demo().dataset.frame).toBe('1');
  });

  it('preserves a manual pause through every visibility gate until the user explicitly resumes', () => {
    render();
    setVisible(true);
    advance();
    click('Pause animation');
    setVisible(false);
    setDocumentVisibility('hidden');
    setReducedMotion(true);
    setVisible(true);
    setDocumentVisibility('visible');
    setReducedMotion(false);
    expect(vi.getTimerCount()).toBe(0);
    advance(10_000);
    expect(demo().dataset).toMatchObject({ active: 'false', frame: '1', playing: 'false' });
    click('Play timeline');
    advance();
    expect(demo().dataset).toMatchObject({ active: 'true', frame: '2', playing: 'true' });
  });

  it('keeps a manually selected frame paused on return and cleans up activity subscriptions', () => {
    const removeMediaListener = vi.spyOn(media, 'removeEventListener');
    render();
    setVisible(true);
    act(() => host.querySelectorAll<HTMLButtonElement>('.marketing-mini-motion-sources button')[3]!.click());
    setVisible(false);
    setVisible(true);
    advance(10_000);
    expect(demo().dataset).toMatchObject({ active: 'false', frame: '3', playing: 'false' });
    expect(host.querySelector('.marketing-mini-motion-canvas > strong')?.textContent).toBe('ようこそ');
    act(() => root.render(null));
    expect(vi.getTimerCount()).toBe(0);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeMediaListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('gates CSS progress and entrance motion with effective activity, not only manual playback', () => {
    const css = postcss.parse(readFileSync('src/app/globals.css', 'utf8'));
    const declarations = new Map<string, string[]>();
    css.walkRules((rule) => {
      for (const selector of rule.selectors) {
        if (!selector.startsWith(".marketing-mini-motion-workspace[data-active='false']")) continue;
        rule.walkDecls((declaration) => {
          const values = declarations.get(selector) ?? [];
          values.push(`${declaration.prop}:${declaration.value}`);
          declarations.set(selector, values);
        });
      }
    });
    const owner = ".marketing-mini-motion-workspace[data-active='false']";
    expect(declarations.get(`${owner} .marketing-mini-motion-timeline > div button[aria-current='true']::after`)).toContain('animation-play-state:paused');
    expect(declarations.get(`${owner} .marketing-mini-motion-canvas > strong`)).toContain('animation:none');
    expect(declarations.get(`${owner} .marketing-mini-motion-field`)).toContain('transition:none');
  });
});
