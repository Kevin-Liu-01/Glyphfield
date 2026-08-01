'use client';

import { useDocsLayout } from 'fumadocs-ui/layouts/docs';
import { T, useGT } from 'gt-next';
import { Github } from 'lucide-react';

export default function DocsTocActions() {
  const gt = useGT();
  const { slots } = useDocsLayout();
  const SearchFull = slots.searchTrigger ? slots.searchTrigger.full : null;

  return (
    <nav aria-label={gt('Documentation utilities')} className='glyphfield-docs-toc-actions'>
      {SearchFull ? (
        <SearchFull className='glyphfield-docs-toc-search' hideIfDisabled />
      ) : null}
      <a
        href='https://github.com/Kevin-Liu-01/Glyphfield'
        rel='noreferrer'
        target='_blank'
      >
        <Github aria-hidden='true' />
        <T>GitHub</T>
      </a>
    </nav>
  );
}
