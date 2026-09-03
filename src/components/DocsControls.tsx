'use client';

import { useDocsLayout } from 'fumadocs-ui/layouts/docs';
import Link from 'next/link';

import DocsThemeButton from '@/components/DocsThemeButton';
import GitHubStarButton from '@/components/GitHubStarButton';

export default function DocsControls() {
  const { slots } = useDocsLayout();
  const Search = slots.searchTrigger ? slots.searchTrigger.sm : null;

  return (
    <nav aria-label='Documentation controls' className='glyphfield-docs-controls'>
      {Search ? <Search className='glyphfield-docs-controls__icon' hideIfDisabled /> : null}
      <DocsThemeButton className='glyphfield-docs-controls__icon' />
      <GitHubStarButton className='glyphfield-docs-controls__github' showLabel={false} />
      <Link className='glyphfield-docs-controls__link' href='/'>
        Home
      </Link>
      <Link className='glyphfield-docs-controls__studio' href='/studio'>
        Open Studio
      </Link>
    </nav>
  );
}
