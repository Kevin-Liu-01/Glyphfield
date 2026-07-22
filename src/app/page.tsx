import Image from 'next/image';
import Link from 'next/link';
import { T } from 'gt-next';
import { getGT } from 'gt-next/server';
import { ArrowRight } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { PRODUCT_BRAND } from '@/lib/productBrand';

const EXAMPLES = [
  {
    detail: '1.25s hold · cubic Bézier',
    name: 'Morph fade',
    src: '/examples/gt-morph.gif',
  },
  {
    detail: '1.00s hold · cubic Bézier',
    name: 'Morph fade / 1s',
    src: '/examples/gt-morph-one-second.gif',
  },
  {
    detail: 'Grapheme-by-grapheme · no cursor',
    name: 'Type / delete',
    src: '/examples/gt-type-delete.gif',
  },
  {
    detail: '0.75s hold · fast package',
    name: 'Fast morph',
    src: '/examples/gt-morph-fast.gif',
  },
] as const;

export default async function HomePage() {
  const gt = await getGT();

  return (
    <main className='landing-grid min-h-dvh bg-background text-foreground'>
      <div className='landing-shell mx-auto min-h-dvh max-w-[1120px] border-x border-border bg-background'>
        <header className='flex h-16 items-center justify-between gap-4 border-b border-border px-6 sm:px-9'>
          <Link className='flex items-center gap-3' href='/'>
            <Image
              alt={gt('Glyphfield mark')}
              className='size-8 object-contain'
              height={32}
              priority
              src={PRODUCT_BRAND.markPath}
              width={32}
            />
            <span className='font-mono text-sm font-semibold tracking-tight'>
              {PRODUCT_BRAND.displayName}
            </span>
          </Link>
          <Button asChild size='sm'>
            <Link href='/studio'>
              <T>Open Studio</T>
              <ArrowRight aria-hidden='true' />
            </Link>
          </Button>
        </header>

        <section className='grid min-h-[510px] border-b border-border lg:grid-cols-[1.15fr_0.85fr]'>
          <div className='flex flex-col justify-center gap-7 border-b border-border p-8 sm:p-12 lg:border-r lg:border-b-0 lg:p-14'>
            <div className='flex flex-col gap-5'>
              <div className='flex items-center gap-5'>
                <Image
                  alt=''
                  aria-hidden='true'
                  className='size-14 object-contain sm:size-16'
                  height={64}
                  priority
                  src={PRODUCT_BRAND.markPath}
                  width={64}
                />
                <h1 className='text-6xl font-semibold tracking-[-0.07em] sm:text-7xl lg:text-8xl'>
                  glyphfield
                </h1>
              </div>
              <p className='max-w-xl text-xl leading-8 text-muted-foreground sm:text-2xl'>
                <T>
                  A local brand studio for identity systems, motion, and repeatable graphics.
                </T>
              </p>
            </div>

            <Button asChild className='h-14 w-fit px-6 font-mono text-base' size='lg'>
              <Link href='/studio'>
                <span aria-hidden='true'>$</span>
                <span>
                  <T>glyphfield open</T>
                </span>
              </Link>
            </Button>

            <p className='font-mono text-sm text-muted-foreground'>
              <T>No upload required · exports stay in your browser</T>
            </p>
          </div>

          <div className='flex items-center p-8 sm:p-12'>
            <pre className='w-full overflow-x-auto rounded-md border border-border bg-background p-5 font-mono text-sm leading-6 text-muted-foreground'>
              <code>{`{
  "ok": true,
  "workspace": "glyphfield",
  "local": true,
  "tools": [
    "project-tabs",
    "brand-elements",
    "design-board",
    "logo-shaders",
    "motion",
    "opengraph",
    "logo",
    "color",
    "type",
    "terminal",
    "slides"
  ]
}`}</code>
            </pre>
          </div>
        </section>

        <section className='flex flex-col gap-6 p-6 sm:p-9'>
          <div className='flex flex-wrap items-end justify-between gap-3'>
            <div className='flex flex-col gap-1'>
              <p className='text-xs uppercase tracking-widest text-muted-foreground'>
                <T>Made in Glyphfield</T>
              </p>
              <h2 className='text-2xl font-semibold tracking-tight'>
                <T>GT motion packages</T>
              </h2>
            </div>
            <Link className='text-sm font-medium underline underline-offset-4' href='/studio'>
              <T>Make your own</T> →
            </Link>
          </div>

          <div className='grid gap-px overflow-hidden rounded-md border border-border bg-border sm:grid-cols-2 lg:grid-cols-4'>
            {EXAMPLES.map((example) => (
              <article className='flex min-w-0 flex-col bg-background' key={example.name}>
                <div className='aspect-[10/3] bg-foreground'>
                  <Image
                    alt={gt(example.name)}
                    className='size-full object-cover'
                    height={300}
                    src={example.src}
                    unoptimized
                    width={1000}
                  />
                </div>
                <div className='flex flex-col gap-1 p-4'>
                  <h3 className='text-sm font-semibold'>{gt(example.name)}</h3>
                  <p className='font-mono text-xs text-muted-foreground'>
                    {gt(example.detail)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <footer className='flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4 font-mono text-xs text-muted-foreground sm:px-9'>
          <span>
            <T>© 2026 Kevin Liu · Source available</T>
          </span>
          <div className='flex items-center gap-4'>
            <Link className='underline underline-offset-4' href='/llms.txt'>
              llms.txt
            </Link>
            <Link className='underline underline-offset-4' href='/api/catalog'>
              <T>Agent catalog</T>
            </Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
