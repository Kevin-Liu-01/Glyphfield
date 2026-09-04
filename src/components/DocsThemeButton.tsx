'use client';

import { useTheme } from 'next-themes';

import { Moon, Sun } from '@/components/ui/SolidIcons';

export default function DocsThemeButton({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const toggleTheme = () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');

  return (
    <button
      aria-label='Toggle color theme'
      className={`docs-theme-button ${className}`.trim()}
      onClick={toggleTheme}
      title='Toggle color theme'
      type='button'
    >
      <Sun aria-hidden='true' className='docs-theme-button__sun' />
      <Moon aria-hidden='true' className='docs-theme-button__moon' />
    </button>
  );
}
