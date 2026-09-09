'use client';

import { useAppTheme } from '@/components/AppThemeProvider';

import { Moon, Sun } from '@/components/ui/SolidIcons';

export default function DocsThemeButton({ className = '' }: { className?: string }) {
  const { toggleTheme } = useAppTheme();

  return (
    <button
      aria-label='Toggle color theme'
      className={`docs-theme-button ${className}`.trim()}
      onClick={toggleTheme}
      title='Toggle color theme'
      type='button'
    >
      <Sun aria-hidden='true' className='app-theme-icon--dark' />
      <Moon aria-hidden='true' className='app-theme-icon--light' />
    </button>
  );
}
