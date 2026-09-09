import { describe, expect, it, vi } from 'vitest';
import { APP_THEME_CONFIG as config, appThemeBootstrapScript, initializeAppTheme, type ThemePreference } from '../appTheme';

/** Separate document lifetimes: no global controller/listener leaks between cases. */
function themeWindow(dark = false, entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
  };
  const classes = new Set(['unrelated-root-class']);
  const root = {
    classList: {
      add: vi.fn((name: string) => classes.add(name)),
      remove: vi.fn((name: string) => classes.delete(name)),
    },
    style: { colorScheme: '' },
    dataset: {} as Record<string, string>,
  };
  const meta = { setAttribute: vi.fn() };
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  let timestamp = 0;
  const media = Object.assign(new EventTarget(), { matches: dark });
  const mediaSubscribe = vi.spyOn(media, 'addEventListener');
  const target = Object.assign(new EventTarget(), {
    document: { documentElement: root, getElementById: vi.fn(() => meta) },
    localStorage: storage,
    matchMedia: vi.fn(() => media),
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      frames.set(++frameId, callback);
      return frameId;
    }),
    cancelAnimationFrame: vi.fn((id: number) => { frames.delete(id); }),
  });
  const browserSubscribe = vi.spyOn(target, 'addEventListener');
  const browser = target as unknown as Window;
  return {
    browser, classes, root, meta, media, mediaSubscribe, browserSubscribe, storage, values, frames,
    flushFrame() {
      timestamp += 16;
      // Newly queued callbacks belong to the next paint; honor cancellations
      // between callbacks without draining frames added by this batch.
      const batch = Array.from(frames);
      for (const [id, callback] of batch) {
        if (frames.delete(id)) callback(timestamp);
      }
    },
    native(next: boolean) { media.matches = next; media.dispatchEvent(new Event('change')); },
    restoreFromBFCache() { target.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })); },
    storageEvent(key: string | null, newValue: string | null, storageArea: unknown = storage) {
      // A real cross-tab event arrives after the shared storage has changed.
      if (storageArea === storage) {
        if (key === null) values.clear();
        else if (newValue === null) values.delete(key);
        else values.set(key, newValue);
      }
      target.dispatchEvent(Object.assign(new Event('storage'), { key, newValue, storageArea }));
    },
  };
}

describe('document-lifetime application theme', () => {
  it.each([false, true])('uses native dark=%s on a fresh document before any consumer', (dark) => {
    const page = themeWindow(dark);
    const controller = initializeAppTheme(page.browser, config);
    const resolved = dark ? 'dark' : 'light';
    expect(controller.getSnapshot()).toBe(`system:${resolved}`);
    expect([...page.classes]).toEqual(['unrelated-root-class', resolved]);
    expect(page.root.style.colorScheme).toBe(resolved);
    expect(page.root.dataset.themePreference).toBe('system');
    expect(page.meta.setAttribute).toHaveBeenLastCalledWith('content', config.colors[resolved]);
    expect(page.values.get(config.storageKey)).toBe('system');
  });

  it.each([
    ['new explicit beats every legacy key', { 'glyphfield-theme-v1': 'light', theme: 'dark', 'glyphfield-appearance-v1': '{"theme":"dark"}', 'glyphfield-marketing-theme': 'dark' }, false, 'light:light'],
    ['new system beats legacy explicit', { 'glyphfield-theme-v1': 'system', theme: 'light' }, true, 'system:dark'],
    ['old global explicit beats Studio and marketing', { theme: 'dark', 'glyphfield-appearance-v1': '{"theme":"light"}', 'glyphfield-marketing-theme': 'light' }, false, 'dark:dark'],
    ['old auto-written global system does not hide Studio explicit', { theme: 'system', 'glyphfield-appearance-v1': '{"theme":"dark"}', 'glyphfield-marketing-theme': 'light' }, false, 'dark:dark'],
    ['old auto-written global system does not hide marketing explicit', { theme: 'system', 'glyphfield-appearance-v1': '{"theme":"system"}', 'glyphfield-marketing-theme': 'dark' }, false, 'dark:dark'],
    ['Studio explicit beats marketing', { 'glyphfield-appearance-v1': '{"theme":"dark","accent":"teal"}', 'glyphfield-marketing-theme': 'light' }, false, 'dark:dark'],
    ['Studio auto does not hide a marketing explicit preference', { 'glyphfield-appearance-v1': '{"theme":"system"}', 'glyphfield-marketing-theme': 'dark' }, false, 'dark:dark'],
    ['invalid old global falls through to Studio', { theme: 'sepia', 'glyphfield-appearance-v1': '{"theme":"light"}' }, true, 'light:light'],
    ['malformed Studio falls through to marketing', { 'glyphfield-appearance-v1': '{invalid', 'glyphfield-marketing-theme': 'light' }, true, 'light:light'],
    ['malformed legacy defaults to native', { theme: 'sepia', 'glyphfield-appearance-v1': 'null', 'glyphfield-marketing-theme': 'sepia' }, true, 'system:dark'],
    ['invalid new key never resurrects a legacy choice', { 'glyphfield-theme-v1': 'sepia', theme: 'dark', 'glyphfield-appearance-v1': '{"theme":"dark"}' }, false, 'system:light'],
    ['empty new key never resurrects a legacy choice', { 'glyphfield-theme-v1': '', theme: 'dark' }, false, 'system:light'],
  ] as const)('%s', (_label, entries, dark, expected) => {
    const page = themeWindow(dark, entries);
    const controller = initializeAppTheme(page.browser, config);
    expect(controller.getSnapshot()).toBe(expected);
    expect(page.values.get(config.storageKey)).toBe(expected.split(':')[0]);
    for (const [key, value] of Object.entries(entries)) {
      if (key !== config.storageKey) expect(page.values.get(key)).toBe(value);
    }
  });

  it('retains in-memory native and explicit choices when storage access itself is denied', () => {
    const page = themeWindow(true);
    Object.defineProperty(page.browser, 'localStorage', { get() { throw new Error('Storage denied'); } });
    const controller = initializeAppTheme(page.browser, config);
    expect(controller.getSnapshot()).toBe('system:dark');
    expect(() => controller.toggleTheme()).not.toThrow();
    expect(controller.getSnapshot()).toBe('light:light');
    expect(page.classes.has('light')).toBe(true);
  });

  it('does not undo a visible choice when storage writes fail', () => {
    const page = themeWindow(false);
    page.storage.setItem.mockImplementation(() => { throw new Error('Quota exceeded'); });
    const controller = initializeAppTheme(page.browser, config);
    controller.setTheme('dark');
    expect(controller.getSnapshot()).toBe('dark:dark');
    expect(page.classes.has('dark')).toBe(true);
    expect(page.values.size).toBe(0);
  });

  it('reacts to native changes only in system mode and notifies only actual changes', () => {
    const page = themeWindow(false);
    const controller = initializeAppTheme(page.browser, config);
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    page.native(true);
    expect(controller.getSnapshot()).toBe('system:dark');
    expect(listener).toHaveBeenCalledTimes(1);
    page.native(true);
    expect(listener).toHaveBeenCalledTimes(1);
    controller.setTheme('dark');
    page.native(false);
    expect(controller.getSnapshot()).toBe('dark:dark');
    expect(listener).toHaveBeenCalledTimes(2);
    controller.setTheme('system');
    expect(controller.getSnapshot()).toBe('system:light');
    unsubscribe();
    page.native(true);
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it.each([false, true])('the first toggle inverts the actual native theme (dark=%s)', (dark) => {
    const page = themeWindow(dark);
    const controller = initializeAppTheme(page.browser, config);
    controller.toggleTheme();
    expect(controller.getSnapshot()).toBe(dark ? 'light:light' : 'dark:dark');
    expect(page.values.get(config.storageKey)).toBe(dark ? 'light' : 'dark');
  });

  it('ignores invalid runtime preferences without changing or rewriting state', () => {
    const page = themeWindow(true, { [config.storageKey]: 'dark' });
    const controller = initializeAppTheme(page.browser, config);
    controller.setTheme('sepia' as ThemePreference);
    expect(controller.getSnapshot()).toBe('dark:dark');
    expect(page.storage.setItem).not.toHaveBeenCalled();
  });

  it('never gates transitions or queues paint frames on initial load or same-resolved updates', () => {
    const page = themeWindow(true);
    const controller = initializeAppTheme(page.browser, config);
    expect(page.frames.size).toBe(0);
    expect(page.root.dataset.themeChanging).toBeUndefined();
    controller.setTheme('dark');
    controller.setTheme('system');
    page.native(true);
    page.restoreFromBFCache();
    initializeAppTheme(page.browser, config);
    expect(page.browser.requestAnimationFrame).not.toHaveBeenCalled();
    expect(page.browser.cancelAnimationFrame).not.toHaveBeenCalled();
    expect(page.root.dataset.themeChanging).toBeUndefined();
  });

  it('holds the transition gate for two paint frames after a resolved theme change', () => {
    const page = themeWindow(true);
    const controller = initializeAppTheme(page.browser, config);
    controller.setTheme('light');
    expect(page.classes.has('light')).toBe(true);
    expect(page.root.dataset.themeChanging).toBe('');
    expect(page.frames.size).toBe(1);
    page.flushFrame();
    expect(page.root.dataset.themeChanging).toBe('');
    expect(page.frames.size).toBe(1);
    // An identical choice must not restart the existing two-paint cleanup.
    controller.setTheme('light');
    expect(page.browser.requestAnimationFrame).toHaveBeenCalledTimes(2);
    page.flushFrame();
    expect(page.root.dataset.themeChanging).toBeUndefined();
    expect(page.frames.size).toBe(0);
  });

  it.each([false, true])('rapid toggles cancel the prior cleanup (after first paint=%s)', (afterFirstPaint) => {
    const page = themeWindow(true);
    const controller = initializeAppTheme(page.browser, config);
    controller.toggleTheme();
    if (afterFirstPaint) page.flushFrame();
    const oldCleanup = [...page.frames.keys()][0]!;
    controller.toggleTheme();
    expect(page.browser.cancelAnimationFrame).toHaveBeenCalledWith(oldCleanup);
    expect(page.frames.has(oldCleanup)).toBe(false);
    expect(page.frames.size).toBe(1);
    expect(page.classes.has('dark')).toBe(true);
    page.flushFrame();
    expect(page.root.dataset.themeChanging).toBe('');
    expect(page.frames.size).toBe(1);
    page.flushFrame();
    expect(page.root.dataset.themeChanging).toBeUndefined();
    expect(page.frames.size).toBe(0);
  });

  it('shares one controller and one set of document listeners across repeated initialization', () => {
    const page = themeWindow(true);
    const first = initializeAppTheme(page.browser, config);
    const second = initializeAppTheme(page.browser, config);
    expect(second).toBe(first);
    expect(page.browser.matchMedia).toHaveBeenCalledOnce();
    expect(page.mediaSubscribe).toHaveBeenCalledOnce();
    expect(page.browserSubscribe.mock.calls.map(([type]) => type)).toEqual(['pageshow', 'storage']);
    expect(page.storage.setItem).toHaveBeenCalledOnce();
    const a = vi.fn(); const b = vi.fn();
    const off = first.subscribe(a);
    second.subscribe(b);
    second.setTheme('light');
    expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledOnce();
    off(); first.setTheme('dark');
    expect(a).toHaveBeenCalledOnce(); expect(b).toHaveBeenCalledTimes(2);
  });

  it('synchronizes valid local-storage changes without writing them back and ignores other storage', () => {
    const page = themeWindow(true);
    const controller = initializeAppTheme(page.browser, config);
    page.storage.setItem.mockClear();
    page.storageEvent(config.storageKey, 'light');
    expect(controller.getSnapshot()).toBe('light:light');
    page.storageEvent(config.storageKey, 'dark', { getItem() {} });
    page.storageEvent(config.legacyGlobalKey, 'dark');
    expect(controller.getSnapshot()).toBe('light:light');
    page.storageEvent(config.storageKey, 'system', null);
    expect(controller.getSnapshot()).toBe('system:dark');
    expect(page.storage.setItem).not.toHaveBeenCalled();
  });

  it.each([config.storageKey, null])('persists native Auto after storage removal (%s), preventing legacy resurrection', (key) => {
    const page = themeWindow(false, { [config.storageKey]: 'dark', [config.legacyGlobalKey]: 'dark' });
    const controller = initializeAppTheme(page.browser, config);
    page.storage.setItem.mockClear();
    page.storageEvent(key, null);
    expect(controller.getSnapshot()).toBe('system:light');
    expect(page.values.get(config.storageKey)).toBe('system');
    expect(page.storage.setItem).toHaveBeenCalledExactlyOnceWith(config.storageKey, 'system');
    const reloaded = themeWindow(false, Object.fromEntries(page.values));
    expect(initializeAppTheme(reloaded.browser, config).getSnapshot()).toBe('system:light');
  });

  it('rejects invalid cross-tab theme values in favor of native resolution', () => {
    const page = themeWindow(true);
    const controller = initializeAppTheme(page.browser, config);
    page.storageEvent(config.storageKey, 'light');
    page.storageEvent(config.storageKey, 'invalid');
    expect(controller.getSnapshot()).toBe('system:dark');
  });

  it('refreshes native resolution on pageshow without overriding an explicit preference', () => {
    const page = themeWindow(false);
    const controller = initializeAppTheme(page.browser, config);
    page.media.matches = true;
    page.browser.dispatchEvent(new Event('pageshow'));
    expect(controller.getSnapshot()).toBe('system:dark');
    controller.setTheme('light');
    page.browser.dispatchEvent(new Event('pageshow'));
    expect(controller.getSnapshot()).toBe('light:light');
  });

  it('resynchronizes the canonical preference on BFCache pageshow when a tab missed storage events', () => {
    const page = themeWindow(true);
    const controller = initializeAppTheme(page.browser, config);
    page.values.set(config.storageKey, 'light');
    page.restoreFromBFCache();
    expect(controller.getSnapshot()).toBe('light:light');
    page.values.set(config.storageKey, 'system');
    page.restoreFromBFCache();
    expect(controller.getSnapshot()).toBe('system:dark');
  });

  it('keeps an unpersisted in-memory choice on pageshow when its storage write failed', () => {
    const page = themeWindow(false, { [config.storageKey]: 'light' });
    const controller = initializeAppTheme(page.browser, config);
    page.storage.setItem.mockImplementation(() => { throw new Error('Quota exceeded'); });
    controller.setTheme('dark');
    expect(page.values.get(config.storageKey)).toBe('light');
    page.restoreFromBFCache();
    expect(controller.getSnapshot()).toBe('dark:dark');
    expect(page.classes.has('dark')).toBe(true);
  });

  it('retains a visible explicit choice if reading storage becomes denied on pageshow', () => {
    const page = themeWindow(true, { [config.storageKey]: 'light' });
    const controller = initializeAppTheme(page.browser, config);
    page.storage.getItem.mockImplementation(() => { throw new Error('Storage became denied'); });
    page.restoreFromBFCache();
    expect(controller.getSnapshot()).toBe('light:light');
  });

  it('executes the serialized bootstrap standalone with no module closures or import helpers', () => {
    const page = themeWindow(true, { 'glyphfield-appearance-v1': '{"theme":"light"}' });
    // Function has no access to this module's imports: everything must be in the script.
    const execute = new Function('window', appThemeBootstrapScript());
    execute(page.browser);
    expect(page.browser.__glyphfieldTheme?.getSnapshot()).toBe('light:light');
    const controller = page.browser.__glyphfieldTheme;
    execute(page.browser);
    expect(page.browser.__glyphfieldTheme).toBe(controller);
    expect(page.mediaSubscribe).toHaveBeenCalledOnce();
    const fresh = themeWindow(true);
    execute(fresh.browser);
    expect(fresh.browser.__glyphfieldTheme?.getSnapshot()).toBe('system:dark');
  });
});
