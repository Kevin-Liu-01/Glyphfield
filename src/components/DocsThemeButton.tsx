'use client';

import { useTheme } from 'next-themes';

import { Moon, Sun } from '@/components/ui/SolidIcons';

export default function DocsThemeButton({ className = '' }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  const nextTheme = dark ? 'light' : 'dark';

  return (
    <button
      aria-label={`Use ${nextTheme} theme`}
      className={`docs-theme-button ${className}`.trim()}
      onClick={() => setTheme(nextTheme)}
      title={`${nextTheme === 'dark' ? 'Dark' : 'Light'} theme`}
      type='button'
    >
      <Sun aria-hidden='true' className='docs-theme-button__sun' />
      <Moon aria-hidden='true' className='docs-theme-button__moon' />
    </button>
  );
}
