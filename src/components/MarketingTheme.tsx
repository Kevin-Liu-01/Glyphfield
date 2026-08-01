'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import type { ReactNode } from 'react';

type MarketingTheme = 'light' | 'dark';

type MarketingThemeContextValue = {
  setTheme: (theme: MarketingTheme) => void;
  theme: MarketingTheme;
};

const MarketingThemeContext = createContext<MarketingThemeContextValue | null>(null);

export function MarketingThemeShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<MarketingTheme>('light');

  useEffect(() => {
    document.documentElement.dataset.marketingTheme = theme;

    return () => {
      delete document.documentElement.dataset.marketingTheme;
    };
  }, [theme]);

  return (
    <MarketingThemeContext.Provider value={{ setTheme, theme }}>
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
      className='marketing-v5-theme-toggle'
      onClick={() => context.setTheme(nextTheme)}
      title={`${nextTheme === 'dark' ? 'Dark' : 'Light'} theme`}
      type='button'
    >
      {context.theme === 'light' ? <Moon aria-hidden='true' /> : <Sun aria-hidden='true' />}
    </button>
  );
}
