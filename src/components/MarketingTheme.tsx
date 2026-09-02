'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useThemeOverride } from '@/components/AppThemeProvider';
import { Moon, Sun } from '@/components/ui/SolidIcons';

import type { ReactNode } from 'react';

type MarketingTheme = 'light' | 'dark';

type MarketingThemeContextValue = {
  setTheme: (theme: MarketingTheme) => void;
  theme: MarketingTheme;
};

const MarketingThemeContext = createContext<MarketingThemeContextValue | null>(null);
const MARKETING_THEME_STORAGE_KEY = 'glyphfield-marketing-theme';

function isMarketingTheme(value: string | null): value is MarketingTheme {
  return value === 'light' || value === 'dark';
}

export function MarketingThemeShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<MarketingTheme>('light');
  const setAppThemeOverride = useThemeOverride();
  const followsSystemTheme = useRef(true);

  const updateTheme = useCallback((nextTheme: MarketingTheme) => {
    followsSystemTheme.current = false;
    setTheme(nextTheme);
    try {
      window.localStorage.setItem(MARKETING_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Storage can be unavailable in private or locked-down browsing contexts.
    }
  }, []);

  const themeContext = useMemo(() => ({ setTheme: updateTheme, theme }), [theme, updateTheme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    let storedTheme: string | null = null;
    try {
      storedTheme = window.localStorage.getItem(MARKETING_THEME_STORAGE_KEY);
    } catch {
      // Fall through to the system preference.
    }

    followsSystemTheme.current = !isMarketingTheme(storedTheme);
    setTheme(isMarketingTheme(storedTheme) ? storedTheme : media.matches ? 'dark' : 'light');

    function handleSystemTheme(event: MediaQueryListEvent) {
      if (followsSystemTheme.current) setTheme(event.matches ? 'dark' : 'light');
    }

    media.addEventListener('change', handleSystemTheme);
    return () => media.removeEventListener('change', handleSystemTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.marketingTheme = theme;
    setAppThemeOverride(theme);
  }, [setAppThemeOverride, theme]);

  useEffect(() => () => {
    delete document.documentElement.dataset.marketingTheme;
    setAppThemeOverride(undefined);
  }, [setAppThemeOverride]);

  return (
    <MarketingThemeContext.Provider value={themeContext}>
      <main
        className='marketing-page marketing-page-v5 min-h-dvh text-foreground'
        data-marketing-theme={theme}
      >
        {children}
      </main>
    </MarketingThemeContext.Provider>
  );
}

export function MarketingThemeToggle() {
  const context = useContext(MarketingThemeContext);
  if (!context) return null;

  const nextTheme = context.theme === 'light' ? 'dark' : 'light';

  return (
    <button
      aria-label={`Use ${nextTheme} theme`}
      aria-pressed={context.theme === 'dark'}
      className='marketing-v5-theme-toggle'
      onClick={() => context.setTheme(nextTheme)}
      title={`${nextTheme === 'dark' ? 'Dark' : 'Light'} theme`}
      type='button'
    >
      {context.theme === 'light' ? <Moon aria-hidden='true' /> : <Sun aria-hidden='true' />}
    </button>
  );
}
