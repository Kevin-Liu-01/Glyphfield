'use client';

import { T, useGT } from 'gt-next';
import { Github } from 'lucide-react';

export default function DocsTocActions() {
  const gt = useGT();

  return (
    <nav aria-label={gt('Documentation utilities')} className='glyphfield-docs-toc-actions'>
      <a
        aria-label={gt('View Glyphfield on GitHub')}
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
