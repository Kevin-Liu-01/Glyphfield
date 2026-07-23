import Image from 'next/image';
import { Braces, PanelsTopLeft } from 'lucide-react';

import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

import { PRODUCT_BRAND } from '@/lib/productBrand';

export function docsBaseOptions(): BaseLayoutProps {
  return {
    githubUrl: 'https://github.com/Kevin-Liu-01/Glyphfield',
    links: [
      {
        active: 'none',
        icon: <PanelsTopLeft aria-hidden='true' />,
        text: 'Open Studio',
        type: 'main',
        url: '/studio',
      },
      {
        active: 'nested-url',
        icon: <Braces aria-hidden='true' />,
        text: 'Agent API',
        type: 'main',
        url: '/docs/agents',
      },
    ],
    nav: {
      title: (
        <span className='docs-brand-title flex items-center gap-2 font-semibold'>
          <Image alt='' className='docs-brand-mark' height={22} src={PRODUCT_BRAND.markPath} width={22} />
          {PRODUCT_BRAND.name}
          <span className='font-mono text-[10px] font-normal uppercase tracking-widest opacity-50'>Docs</span>
        </span>
      ),
      url: '/docs',
    },
  };
}
