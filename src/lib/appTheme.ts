export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface AppThemeController {
  getSnapshot: () => string;
  setTheme: (theme: ThemePreference) => void;
  subscribe: (listener: () => void) => () => void;
  toggleTheme: () => void;
}

declare global {
  interface Window {
    __glyphfieldTheme?: AppThemeController;
  }
}

export const APP_THEME_CONFIG = {
  storageKey: 'glyphfield-theme-v1',
  legacyGlobalKey: 'theme',
  legacyAppearanceKey: 'glyphfield-appearance-v1',
  legacyMarketingKey: 'glyphfield-marketing-theme',
  themeColorId: 'glyphfield-theme-color',
  colors: { light: '#f8f8f5', dark: '#121212' },
} as const;

/**
 * The only theme owner, installed synchronously in <head>, before any page paints.
 * Keep this function self-contained: the server serializes it for the bootstrap;
 * React subscribes to that same controller instead of resolving a second theme.
 */
export function initializeAppTheme(
  browser: Window,
  config: typeof APP_THEME_CONFIG
): AppThemeController {
  if (browser.__glyphfieldTheme) return browser.__glyphfieldTheme;

  const root = browser.document.documentElement;
  const media = browser.matchMedia('(prefers-color-scheme: dark)');
  const listeners = new Set<() => void>();

  function isPreference(value: unknown): value is ThemePreference {
    return value === 'light' || value === 'dark' || value === 'system';
  }

  function read(key: string): string | null {
    try { return browser.localStorage.getItem(key); } catch { return null; }
  }

  function readInitialPreference(): ThemePreference {
    const current = read(config.storageKey);
    // Invalid new data must not resurrect an obsolete, route-specific choice.
    if (current !== null) return isPreference(current) ? current : 'system';
    const previousGlobal = read(config.legacyGlobalKey);
    // Old Studio wrote 'system' even without a user action. Do not let that
    // automatic default hide an explicit legacy light/dark selection.
    if (previousGlobal === 'light' || previousGlobal === 'dark') return previousGlobal;
    try {
      const appearance = JSON.parse(read(config.legacyAppearanceKey) ?? 'null');
      if (appearance?.theme === 'light' || appearance?.theme === 'dark') return appearance.theme;
    } catch { /* Malformed legacy appearance does not prevent native theming. */ }
    const marketing = read(config.legacyMarketingKey);
    return marketing === 'light' || marketing === 'dark' ? marketing : 'system';
  }

  let preference = readInitialPreference();
  let resolved: ResolvedTheme;
  let snapshot = '';
  let hasUnsavedPreference = false;
  let transitionFrame = 0;

  function suppressThemeTransitions() {
    // Theme colors must change together: independently transitioning inherited
    // text and panel backgrounds briefly paints white-on-white during a toggle.
    root.dataset.themeChanging = '';
    browser.cancelAnimationFrame(transitionFrame);
    transitionFrame = browser.requestAnimationFrame(() => {
      transitionFrame = browser.requestAnimationFrame(() => {
        delete root.dataset.themeChanging;
        transitionFrame = 0;
      });
    });
  }

  function persist() {
    try {
      if (browser.localStorage.getItem(config.storageKey) !== preference) {
        browser.localStorage.setItem(config.storageKey, preference);
      }
      hasUnsavedPreference = false;
    } catch {
      // A BFCache restore must not replace a newer in-memory choice after a
      // denied/quota-limited write with an older value still in storage.
      hasUnsavedPreference = true;
    }
  }

  function apply() {
    const nextResolved = preference === 'system' ? (media.matches ? 'dark' : 'light') : preference;
    if (snapshot && nextResolved !== resolved) suppressThemeTransitions();
    resolved = nextResolved;
    root.classList.remove(resolved === 'dark' ? 'light' : 'dark');
    root.classList.add(resolved);
    root.style.colorScheme = resolved;
    root.dataset.themePreference = preference;
    // This tag belongs to the controller, not React's hoisted metadata registry.
    // Mutating an SSR <meta> would cause React to insert a second, stale light tag.
    let themeColor = browser.document.getElementById(config.themeColorId);
    if (!themeColor) {
      themeColor = browser.document.createElement('meta');
      themeColor.id = config.themeColorId;
      themeColor.setAttribute('name', 'theme-color');
      browser.document.head.appendChild(themeColor);
    }
    themeColor.setAttribute('content', config.colors[resolved]);
    const next = `${preference}:${resolved}`;
    if (snapshot === next) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function setTheme(next: ThemePreference) {
    if (!isPreference(next)) return;
    preference = next;
    apply();
    persist();
  }

  const controller: AppThemeController = {
    getSnapshot: () => snapshot,
    setTheme,
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    toggleTheme: () => setTheme(resolved === 'dark' ? 'light' : 'dark'),
  };

  browser.__glyphfieldTheme = controller;
  apply();
  persist();
  // Document-lifetime subscriptions: route changes/React Strict Mode never
  // destroy or reset the selected theme, and there is no polling or frame loop.
  media.addEventListener('change', () => { if (preference === 'system') apply(); });
  browser.addEventListener('pageshow', (event) => {
    if (event.persisted && !hasUnsavedPreference) {
      try {
        const saved = browser.localStorage.getItem(config.storageKey);
        preference = isPreference(saved) ? saved : 'system';
      } catch { /* Storage access can be revoked while the page is in BFCache. */ }
    }
    apply();
  });
  browser.addEventListener('storage', (event) => {
    if (event.key !== config.storageKey && event.key !== null) return;
    try {
      if (event.storageArea && event.storageArea !== browser.localStorage) return;
    } catch { return; }
    preference = isPreference(event.newValue) ? event.newValue : 'system';
    hasUnsavedPreference = false;
    apply();
    // Retain a system reset across reloads even if obsolete legacy keys remain.
    if (event.newValue === null) persist();
  });
  return controller;
}

export function appThemeBootstrapScript(): string {
  return `(${initializeAppTheme.toString()})(window,${JSON.stringify(APP_THEME_CONFIG)});`;
}
