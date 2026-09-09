// @vitest-environment happy-dom
import { Window as HappyWindow } from 'happy-dom';
import { act, StrictMode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppThemeProvider, { useAppTheme } from '../AppThemeProvider';
import { APP_THEME_CONFIG, initializeAppTheme } from '@/lib/appTheme';

function Consumer({ name }: { name: string }) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useAppTheme();
  return <section data-consumer={name} data-preference={theme} data-resolved={resolvedTheme ?? 'pending'}>
    <button onClick={toggleTheme}>Toggle {name}</button>
    <button onClick={() => setTheme('system')}>Auto {name}</button>
    <button onClick={() => setTheme('dark')}>Dark {name}</button>
  </section>;
}

describe('shared application theme provider', () => {
  let page: HappyWindow;
  let browser: Window;
  let host: HTMLDivElement;
  let root: Root | null;
  let media: EventTarget & { matches: boolean };

  beforeEach(() => {
    // A fresh Window gives each test a genuine separate controller/listener lifetime.
    page = new HappyWindow({ url: 'https://glyphfield.test' });
    browser = page as unknown as Window;
    media = Object.assign(new page.EventTarget(), { matches: true }) as unknown as typeof media;
    Object.defineProperty(page, 'matchMedia', { value: vi.fn(() => media), configurable: true });
    vi.stubGlobal('window', browser);
    vi.stubGlobal('document', browser.document);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    host = browser.document.body.appendChild(browser.document.createElement('div'));
    root = null;
  });

  afterEach(async () => {
    await act(() => root?.unmount());
    await page.happyDOM.close();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function tree() {
    return <AppThemeProvider><Consumer name='Studio' /><Consumer name='Docs' /></AppThemeProvider>;
  }

  it('renders neutral SSR markup without initializing a browser theme or writing a default', () => {
    const write = vi.spyOn(browser.localStorage, 'setItem');
    const markup = renderToString(tree());
    expect(markup).toContain('data-preference="system"');
    expect(markup).toContain('data-resolved="pending"');
    expect(markup).not.toContain('data-resolved="light"');
    expect(browser.__glyphfieldTheme).toBeUndefined();
    expect(browser.matchMedia).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it.each(['system', 'dark'] as const)('hydrates existing %s:dark first-paint state without a light write', async (preference) => {
    host.innerHTML = renderToString(tree());
    browser.localStorage.setItem(APP_THEME_CONFIG.storageKey, preference);
    const controller = initializeAppTheme(browser, APP_THEME_CONFIG);
    const addClass = vi.spyOn(browser.document.documentElement.classList, 'add');
    const storageWrite = vi.spyOn(browser.localStorage, 'setItem');
    const recoverable = vi.fn();
    await act(() => { root = hydrateRoot(host, tree(), { onRecoverableError: recoverable }); });
    expect([...host.querySelectorAll('[data-consumer]')].map((node) => node.getAttribute('data-resolved'))).toEqual(['dark', 'dark']);
    expect(browser.__glyphfieldTheme).toBe(controller);
    expect(browser.document.documentElement.classList.contains('dark')).toBe(true);
    expect(addClass).not.toHaveBeenCalledWith('light');
    expect(storageWrite).not.toHaveBeenCalled();
    expect(recoverable).not.toHaveBeenCalled();
  });

  it('creates one controller-owned theme-color tag and updates it in place through hydration and toggles', async () => {
    host.innerHTML = renderToString(tree());
    const themeTags = () => browser.document.head.querySelectorAll('meta[name="theme-color"]');
    expect(themeTags()).toHaveLength(0);
    const controller = initializeAppTheme(browser, APP_THEME_CONFIG);
    const tag = browser.document.getElementById(APP_THEME_CONFIG.themeColorId)!;
    expect(themeTags()).toHaveLength(1);
    expect(tag.getAttribute('content')).toBe(APP_THEME_CONFIG.colors.dark);
    await act(() => { root = hydrateRoot(host, tree()); });
    expect(themeTags()).toHaveLength(1);
    expect(themeTags()[0]).toBe(tag);
    await act(() => controller.toggleTheme());
    expect(tag.getAttribute('content')).toBe(APP_THEME_CONFIG.colors.light);
    expect(initializeAppTheme(browser, APP_THEME_CONFIG)).toBe(controller);
    await act(() => controller.toggleTheme());
    expect(themeTags()).toHaveLength(1);
    expect(themeTags()[0]).toBe(tag);
    expect(tag.getAttribute('content')).toBe(APP_THEME_CONFIG.colors.dark);
  });

  it('initializes safely from native dark even if the provider is mounted without the bootstrap', async () => {
    const addClass = vi.spyOn(browser.document.documentElement.classList, 'add');
    const storageWrite = vi.spyOn(browser.localStorage, 'setItem');
    root = createRoot(host);
    await act(() => root!.render(tree()));
    expect(host.querySelector('[data-consumer="Studio"]')?.getAttribute('data-resolved')).toBe('dark');
    expect(addClass).not.toHaveBeenCalledWith('light');
    expect(storageWrite).toHaveBeenCalledExactlyOnceWith(APP_THEME_CONFIG.storageKey, 'system');
    await act(() => host.querySelector<HTMLButtonElement>('button')!.click());
    expect(browser.__glyphfieldTheme?.getSnapshot()).toBe('light:light');
    expect(host.querySelector('[data-consumer="Docs"]')?.getAttribute('data-resolved')).toBe('light');
  });

  it('shares choice and native Auto updates across consumers and route-like remounts', async () => {
    const controller = initializeAppTheme(browser, APP_THEME_CONFIG);
    const nativeSubscribe = vi.spyOn(media, 'addEventListener');
    const storageWrite = vi.spyOn(browser.localStorage, 'setItem');
    root = createRoot(host);
    await act(() => root!.render(<StrictMode>{tree()}</StrictMode>));
    await act(() => host.querySelector<HTMLButtonElement>('[data-consumer="Studio"] button')!.click());
    expect(controller.getSnapshot()).toBe('light:light');
    expect([...host.querySelectorAll('[data-consumer]')].every((node) => node.getAttribute('data-preference') === 'light')).toBe(true);
    await act(() => host.querySelectorAll<HTMLButtonElement>('[data-consumer="Docs"] button')[1]!.click());
    expect(controller.getSnapshot()).toBe('system:dark');
    await act(() => {
      media.matches = false;
      media.dispatchEvent(new page.Event('change') as unknown as Event);
    });
    expect([...host.querySelectorAll('[data-consumer]')].every((node) => node.getAttribute('data-resolved') === 'light')).toBe(true);
    const writesBeforeRoute = storageWrite.mock.calls.length;
    await act(() => root!.render(<AppThemeProvider><Consumer name='Landing' /></AppThemeProvider>));
    expect(browser.__glyphfieldTheme).toBe(controller);
    expect(host.querySelector('[data-consumer="Landing"]')?.getAttribute('data-preference')).toBe('system');
    expect(nativeSubscribe).not.toHaveBeenCalled();
    expect(storageWrite).toHaveBeenCalledTimes(writesBeforeRoute);
  });

  it('unsubscribes removed consumers without tearing down the shared document controller', async () => {
    const controller = initializeAppTheme(browser, APP_THEME_CONFIG);
    const subscribe = vi.spyOn(controller, 'subscribe');
    root = createRoot(host);
    await act(() => root!.render(tree()));
    expect(subscribe).toHaveBeenCalledOnce();
    await act(() => root!.render(null));
    expect(() => controller.setTheme('light')).not.toThrow();
    expect(browser.document.documentElement.classList.contains('light')).toBe(true);
    await act(() => root!.render(tree()));
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[data-consumer="Studio"]')?.getAttribute('data-resolved')).toBe('light');
  });

  it('reports a missing provider rather than silently creating a separate theme owner', () => {
    expect(() => renderToString(<Consumer name='Unwrapped' />)).toThrow('useAppTheme requires AppThemeProvider');
    expect(browser.__glyphfieldTheme).toBeUndefined();
  });
});
