'use client';

import { useAppTheme } from '@/components/AppThemeProvider';
import { Moon, Sun } from '@/components/ui/SolidIcons';

import type { ReactNode } from 'react';

export function MarketingThemeShell({ children }: { children: ReactNode }) {
  return (
    <main className='marketing-page marketing-page-v5 min-h-dvh text-foreground'>
      {children}
    </main>
  );
}

export function MarketingThemeToggle() {
  const { resolvedTheme, toggleTheme } = useAppTheme();
  const label = resolvedTheme ? `Use ${resolvedTheme === 'dark' ? 'light' : 'dark'} theme` : 'Toggle color theme';

  return (
    <button
      aria-label={label}
      className='marketing-v5-theme-toggle'
      onClick={toggleTheme}
      title={label}
      type='button'
    >
      <Moon aria-hidden='true' className='app-theme-icon--light' />
      <Sun aria-hidden='true' className='app-theme-icon--dark' />
    </button>
  );
}
