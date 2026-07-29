'use client';

import { T, useGT } from 'gt-next';
import { Braces, Github, PanelsTopLeft } from 'lucide-react';
import Link from 'next/link';

export default function DocsTocActions() {
  const gt = useGT();

  return (
    <nav aria-label={gt('Documentation utilities')} className='glyphfield-docs-toc-actions'>
      <Link href='/studio'><PanelsTopLeft aria-hidden='true' /><T>Studio</T></Link>
      <Link href='/docs/agents'><Braces aria-hidden='true' /><T>Agent API</T></Link>
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
