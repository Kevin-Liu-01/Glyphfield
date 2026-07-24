'use client';

import { useDocsLayout } from 'fumadocs-ui/layouts/docs';
import { T, useGT } from 'gt-next';
import { Braces, PanelsTopLeft } from 'lucide-react';
import Link from 'next/link';

export default function DocsTocActions() {
  const gt = useGT();
  const { slots } = useDocsLayout();
  const ThemeSwitch = slots.themeSwitch || null;

  return (
    <nav aria-label={gt('Documentation utilities')} className='glyphfield-docs-toc-actions'>
      <Link href='/studio'><PanelsTopLeft aria-hidden='true' /><T>Studio</T></Link>
      <Link href='/docs/agents'><Braces aria-hidden='true' /><T>Agent API</T></Link>
      {ThemeSwitch ? <ThemeSwitch className='glyphfield-docs-toc-theme' /> : null}
    </nav>
  );
}
