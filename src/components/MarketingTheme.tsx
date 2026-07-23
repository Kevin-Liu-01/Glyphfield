'use client';

import { createContext, useContext, useState } from 'react';
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

  return (
    <div aria-label='Website theme' className='marketing-v5-theme-toggle' role='group'>
      <button
        aria-label='Use light theme'
        aria-pressed={context.theme === 'light'}
        onClick={() => context.setTheme('light')}
        type='button'
      >
        <Sun aria-hidden='true' />
        <span>Light</span>
      </button>
      <button
        aria-label='Use dark theme'
        aria-pressed={context.theme === 'dark'}
        onClick={() => context.setTheme('dark')}
        type='button'
      >
        <Moon aria-hidden='true' />
        <span>Dark</span>
      </button>
    </div>
  );
}
