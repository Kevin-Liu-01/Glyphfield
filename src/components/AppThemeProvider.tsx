'use client';

import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';

import { APP_THEME_CONFIG, initializeAppTheme, type ResolvedTheme, type ThemePreference } from '@/lib/appTheme';

import type { ReactNode } from 'react';

type AppThemeValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme | undefined;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeValue | null>(null);

export function useAppTheme(): AppThemeValue {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme requires AppThemeProvider');
  return context;
}

const controller = () => initializeAppTheme(window, APP_THEME_CONFIG);
const subscribe = (listener: () => void) => controller().subscribe(listener);
const getSnapshot = () => window.__glyphfieldTheme?.getSnapshot() ?? 'system:pending';
// SSR cannot know the OS. CSS reads the bootstrap's root class; React hydrates
// neutral markup, then subscribes without ever writing a default light theme.
const getServerSnapshot = () => 'system:pending';
const setTheme = (theme: ThemePreference) => controller().setTheme(theme);
const toggleTheme = () => controller().toggleTheme();

export default function AppThemeProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const value = useMemo<AppThemeValue>(() => {
    const [preference, resolved] = snapshot.split(':');
    return {
      theme: preference === 'light' || preference === 'dark' ? preference : 'system',
      resolvedTheme: resolved === 'light' || resolved === 'dark' ? resolved : undefined,
      setTheme,
      toggleTheme,
    };
  }, [snapshot]);
  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}
