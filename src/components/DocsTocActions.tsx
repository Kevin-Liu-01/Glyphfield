'use client';

import { useGT } from 'gt-next';

import GitHubStarButton from '@/components/GitHubStarButton';

export default function DocsTocActions() {
  const gt = useGT();

  return (
    <nav aria-label={gt('Documentation utilities')} className='glyphfield-docs-toc-actions'>
      <GitHubStarButton />
    </nav>
  );
}
