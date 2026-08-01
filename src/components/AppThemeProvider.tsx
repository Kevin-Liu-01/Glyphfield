'use client';

import { ThemeProvider } from 'next-themes';
import { createContext, useContext, useState } from 'react';

import type { ReactNode } from 'react';

type ThemeOverride = 'dark' | 'light' | undefined;

const ThemeOverrideContext = createContext<(theme: ThemeOverride) => void>(() => undefined);

export function useThemeOverride() {
  return useContext(ThemeOverrideContext);
}

export default function AppThemeProvider({ children }: { children: ReactNode }) {
  const [forcedTheme, setForcedTheme] = useState<ThemeOverride>();

  return (
    <ThemeOverrideContext.Provider value={setForcedTheme}>
      <ThemeProvider
        attribute='class'
        defaultTheme='system'
        disableTransitionOnChange
        enableSystem
        forcedTheme={forcedTheme}
      >
        {children}
      </ThemeProvider>
    </ThemeOverrideContext.Provider>
  );
}
