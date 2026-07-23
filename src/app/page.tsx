import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { T } from 'gt-next';
import { getGT } from 'gt-next/server';
import {
  ArrowRight,
  Bot,
  Braces,
  Download,
  Layers3,
  Play,
  Sparkles,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { PRODUCT_BRAND } from '@/lib/productBrand';

const SYSTEM_FEATURES = [
  {
    detail: 'Logos, type, color, texture, and reusable assets stay connected.',
    index: '01',
    name: 'One identity system',
  },
  {
    detail: 'Build everything from OpenGraph images to decks, emails, and CLI art.',
    index: '02',
    name: 'Every brand surface',
  },
  {
    detail: 'Export PNG, SVG, and GIF files without sending source assets away.',
    index: '03',
    name: 'Browser-native output',
  },
  {
    detail: 'A public manifest and generation API let agents use the same system.',
    index: '04',
    name: 'Human and agent ready',
  },
] as const;

export default async function HomePage() {
  const gt = await getGT();

  return (
    <main className='marketing-page min-h-dvh bg-background text-foreground'>
      <a className='marketing-skip-link' href='#main'>
        <T>Skip to content</T>
      </a>

      <header className='marketing-header'>
        <Link className='marketing-brand' href='/' aria-label={gt('Glyphfield home')}>
          <Image
            alt=''
            aria-hidden='true'
            className='marketing-brand-mark'
            height={34}
            priority
            src={PRODUCT_BRAND.markPath}
            width={34}
          />
          <span>{PRODUCT_BRAND.name}</span>
        </Link>

        <nav className='marketing-nav' aria-label={gt('Main navigation')}>
          <a href='#studio'>
            <T>Studio</T>
          </a>
          <a href='#system'>
            <T>System</T>
          </a>
          <a href='#motion'>
            <T>Motion</T>
          </a>
          <a href='#agents'>
            <T>Agents</T>
          </a>
        </nav>

        <Button asChild size='sm'>
          <Link href='/studio'>
            <T>Open Studio</T>
            <ArrowRight aria-hidden='true' />
          </Link>
        </Button>
      </header>

      <div id='main'>
        <ConstructionSpacer />

        <section className='marketing-hero' aria-labelledby='hero-title'>
          <div className='marketing-hero-dither' aria-hidden='true'>
            <i />
            <i />
            <i />
          </div>
          <IsometricStudioDiagram />

          <div className='marketing-hero-copy'>
            <p className='marketing-eyebrow'>
              <Sparkles aria-hidden='true' />
              <T>The programmable brand operating system</T>
            </p>
            <h1 id='hero-title'>
              <T>Build the system.</T>
              <br />
              <T>Generate every surface.</T>
            </h1>
            <p>
              <T>
                Glyphfield turns a brand identity into a working Studio for motion, graphics,
                templates, and agent-generated output.
              </T>
            </p>
            <div className='marketing-hero-actions'>
              <Button asChild className='h-12 px-5' size='lg'>
                <Link href='/studio'>
                  <T>Open the Studio</T>
                  <ArrowRight aria-hidden='true' />
                </Link>
              </Button>
              <Button asChild className='h-12 px-5' size='lg' variant='outline'>
                <a href='#studio'>
                  <Play aria-hidden='true' />
                  <T>See it in action</T>
                </a>
              </Button>
            </div>
            <div className='marketing-hero-proof' aria-label={gt('Product highlights')}>
              <span>
                <b>33</b>
                <T>brand surfaces</T>
              </span>
              <span>
                <b>14</b>
                <T>focused tools</T>
              </span>
              <span>
                <b>0</b>
                <T>assets uploaded</T>
              </span>
            </div>
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-feature-strip' aria-label={gt('Glyphfield system overview')}>
          {SYSTEM_FEATURES.map((feature) => (
            <article key={feature.index}>
              <span>{feature.index}</span>
              <div>
                <h2>{gt(feature.name)}</h2>
                <p>{gt(feature.detail)}</p>
              </div>
            </article>
          ))}
        </section>

        <ConstructionSpacer />

        <section className='marketing-section marketing-studio-section' id='studio'>
          <SectionHeading
            eyebrow={<T>The Studio</T>}
            title={<T>A complete brand workspace, already assembled.</T>}
            copy={
              <T>
                Search the whole system, move between brand projects, and create from the same
                foundations every time. This is a live view of the actual product.
              </T>
            }
          />

          <div className='marketing-gradient-stage marketing-gradient-stage--teal'>
            <CornerHatches />
            <div className='marketing-live-window'>
              <div className='marketing-live-bar'>
                <span>
                  <i />
                  <T>Live Studio preview</T>
                </span>
                <span>glyphfield.local/studio</span>
                <Link href='/studio'>
                  <T>Open full size</T> ↗
                </Link>
              </div>
              <div className='marketing-live-viewport'>
                <iframe
                  className='marketing-live-frame'
                  loading='lazy'
                  src='/studio'
                  tabIndex={-1}
                  title={gt('Live preview of the Glyphfield Studio')}
                />
                <Link
                  className='marketing-live-overlay'
                  href='/studio'
                  aria-label={gt('Open the Glyphfield Studio')}
                />
              </div>
            </div>
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-section' id='system'>
          <SectionHeading
            eyebrow={<T>Identity system</T>}
            title={<T>Foundations that become real things.</T>}
            copy={
              <T>
                Define the identity once, then inspect it as components, campaigns, developer
                surfaces, and a high-resolution design board.
              </T>
            }
          />

          <div className='marketing-split-showcase'>
            <div className='marketing-gradient-stage marketing-gradient-stage--purple'>
              <CornerHatches />
              <IdentityBoardPreview />
            </div>
            <div className='marketing-feature-copy'>
              <span className='marketing-feature-number'>01 / SYSTEM</span>
              <h3>
                <T>One identity. Thirty-three applications.</T>
              </h3>
              <p>
                <T>
                  Generate the pieces teams actually need: social images, partnership lockups,
                  email, event badges, slide covers, terminal themes, app icons, and more.
                </T>
              </p>
              <ul>
                <li>
                  <Layers3 aria-hidden='true' />
                  <T>Project tabs keep multiple identities separate</T>
                </li>
                <li>
                  <Download aria-hidden='true' />
                  <T>Export production-size assets from each tool</T>
                </li>
                <li>
                  <Braces aria-hidden='true' />
                  <T>HEX, OKLCH, typography, and code remain inspectable</T>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-section' id='motion'>
          <SectionHeading
            eyebrow={<T>Motion and materials</T>}
            title={<T>Design movement with the same precision.</T>}
            copy={
              <T>
                Work with cubic Bézier timing, grapheme-safe type, live logo materials, grain,
                dither, gradients, grids, and export-ready animation packages.
              </T>
            }
          />

          <div className='marketing-motion-showcase'>
            <div className='marketing-gradient-stage marketing-gradient-stage--green'>
              <CornerHatches />
              <MotionPreview />
            </div>
            <div className='marketing-gradient-stage marketing-gradient-stage--blue'>
              <CornerHatches />
              <MaterialPreview />
            </div>
          </div>

          <div className='marketing-motion-caption'>
            <div>
              <span>01</span>
              <h3>
                <T>Motion packages, not one-off timelines</T>
              </h3>
              <p>
                <T>
                  Tune duration, hold time, easing, alignment, and export size—then reuse the
                  recipe with new copy or images.
                </T>
              </p>
            </div>
            <div>
              <span>02</span>
              <h3>
                <T>Background and logo labs</T>
              </h3>
              <p>
                <T>
                  Build dithered fields, grainy gradients, line systems, and shader materials for
                  both static and animated brand assets.
                </T>
              </p>
            </div>
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-agent-section' id='agents'>
          <div className='marketing-agent-dither' aria-hidden='true' />
          <div className='marketing-agent-copy'>
            <p className='marketing-eyebrow marketing-eyebrow--dark'>
              <Bot aria-hidden='true' />
              <T>Agent-native by design</T>
            </p>
            <h2>
              <T>Your brand system is an interface, not a folder.</T>
            </h2>
            <p>
              <T>
                llms.txt explains the system. The catalog exposes every generator. Agents can
                inspect capabilities and produce deterministic artifacts through the public API.
              </T>
            </p>
            <div className='marketing-agent-links'>
              <Button asChild size='lg' variant='secondary'>
                <Link href='/api/catalog'>
                  <T>View agent catalog</T>
                  <ArrowRight aria-hidden='true' />
                </Link>
              </Button>
              <Link href='/llms.txt'>llms.txt ↗</Link>
            </div>
          </div>

          <div className='marketing-code-window'>
            <div>
              <span>generate.sh</span>
              <span>POST /api/generate</span>
            </div>
            <pre>
              <code>{`curl -X POST /api/generate \\
  -H "content-type: application/json" \\
  -d '{
    "tool": "opengraph",
    "project": "general-translation",
    "format": "svg"
  }'`}</code>
            </pre>
            <footer>
              <span>
                <i /> 200 · image/svg+xml
              </span>
              <span>deterministic output</span>
            </footer>
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-closing'>
          <Image
            alt=''
            aria-hidden='true'
            height={64}
            src={PRODUCT_BRAND.markWhitePath}
            width={64}
          />
          <p className='marketing-eyebrow marketing-eyebrow--dark'>
            <T>Your brand, operational.</T>
          </p>
          <h2>
            <T>Start with a template. Make the system yours.</T>
          </h2>
          <Button asChild className='h-12 px-6' size='lg' variant='secondary'>
            <Link href='/studio'>
              <T>Open Glyphfield</T>
              <ArrowRight aria-hidden='true' />
            </Link>
          </Button>
        </section>
      </div>

      <ConstructionSpacer />

      <footer className='marketing-footer'>
        <Link className='marketing-brand' href='/'>
          <Image alt='' aria-hidden='true' height={28} src={PRODUCT_BRAND.markPath} width={28} />
          <span>{PRODUCT_BRAND.name}</span>
        </Link>
        <p>
          <T>A source-available brand Studio by Kevin Liu.</T>
        </p>
        <div>
          <Link href='/studio'>
            <T>Studio</T> ↗
          </Link>
          <Link href='/api/catalog'>
            <T>Agent API</T> ↗
          </Link>
          <Link href='/llms.txt'>llms.txt ↗</Link>
        </div>
      </footer>
    </main>
  );
}

function ConstructionSpacer() {
  return (
    <div className='marketing-construction-spacer' aria-hidden='true'>
      <i className='marketing-reticle marketing-reticle--tl' />
      <i className='marketing-reticle marketing-reticle--tr' />
      <i className='marketing-reticle marketing-reticle--bl' />
      <i className='marketing-reticle marketing-reticle--br' />
    </div>
  );
}

function CornerHatches() {
  return (
    <div className='marketing-corner-hatches' aria-hidden='true'>
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

function SectionHeading({
  copy,
  eyebrow,
  title,
}: {
  copy: ReactNode;
  eyebrow: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className='marketing-section-heading'>
      <p className='marketing-eyebrow'>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </div>
  );
}

function IsometricStudioDiagram() {
  return (
    <div className='marketing-isometric-art' aria-hidden='true'>
      <svg viewBox='0 0 720 560'>
        <g className='marketing-iso-decor'>
          <circle cx='594' cy='42' r='3' />
          <circle cx='624' cy='59' r='3' />
          <circle cx='594' cy='76' r='3' />
          <path d='M594 42l30 17-30 17-30-17z' />
          <path d='M96 438l24 14-24 14-24-14z' />
          <path d='M120 452l24 14-24 14-24-14z' />
        </g>

        <g className='marketing-iso-shadow'>
          <path d='M93 386l283-164 251 145-283 164z' />
        </g>

        <g className='marketing-iso-board'>
          <path className='marketing-iso-side-left' d='M110 348l238 137v34L110 382z' />
          <path className='marketing-iso-side-right' d='M348 485l258-149v34L348 519z' />
          <path className='marketing-iso-top' d='M110 348l258-149 238 137-258 149z' />
          <path className='marketing-iso-grid' d='M146 348l222-128 202 116-222 128z' />
          <path className='marketing-iso-tile marketing-iso-tile--dark' d='M176 345l89-51 74 43-89 51z' />
          <path className='marketing-iso-tile marketing-iso-tile--purple' d='M282 284l87-50 73 42-87 50z' />
          <path className='marketing-iso-tile marketing-iso-tile--green' d='M369 338l86-50 72 42-86 50z' />
          <path className='marketing-iso-tile marketing-iso-tile--teal' d='M263 400l86-50 73 42-87 50z' />
          <path className='marketing-iso-word' d='M198 339l27-15 31 18-27 15zM235 318l17-10 31 18-17 10z' />
          <path className='marketing-iso-lines' d='M304 277l55-32m-40 41l55-32m18 77l55-32m-40 41l55-32M287 397l55-32m-39 41l55-32' />
        </g>

        <g className='marketing-iso-stack marketing-iso-stack--one'>
          <path className='marketing-iso-panel-side' d='M431 211l122-70v92l-122 70z' />
          <path className='marketing-iso-panel' d='M318 146l113 65 122-70-113-65z' />
          <path className='marketing-iso-panel-left' d='M318 146l113 65v92l-113-65z' />
          <path className='marketing-iso-panel-screen' d='M337 151l96 55 98-57-95-55z' />
          <path className='marketing-iso-screen-line' d='M381 145l57-33m-38 44l57-33m-38 44l42-24' />
          <path className='marketing-iso-screen-chip' d='M354 148l24 14 22-13-24-14z' />
        </g>

        <g className='marketing-iso-stack marketing-iso-stack--two'>
          <path className='marketing-iso-panel-side' d='M537 272l80-46v72l-80 46z' />
          <path className='marketing-iso-panel' d='M463 229l74 43 80-46-74-43z' />
          <path className='marketing-iso-panel-left' d='M463 229l74 43v72l-74-43z' />
          <path className='marketing-iso-mini-logo' d='M499 232l37 21 38-22-37-21z' />
        </g>

        <g className='marketing-iso-wires marketing-iso-wires--base'>
          <path d='M248 388v42l-72-42v-44' />
          <path d='M443 379v44l112-64v-54' />
          <path d='M377 198v-41l88-51' />
        </g>
        <g className='marketing-iso-wires marketing-iso-wires--signal'>
          <path d='M248 388v42l-72-42v-44' />
          <path d='M443 379v44l112-64v-54' />
          <path d='M377 198v-41l88-51' />
        </g>

        <g className='marketing-iso-labels'>
          <text x='118' y='512'>IDENTITY</text>
          <text x='488' y='395'>OUTPUT</text>
          <text x='476' y='87'>STUDIO</text>
        </g>
      </svg>
    </div>
  );
}

function IdentityBoardPreview() {
  return (
    <div className='marketing-board-preview'>
      <div className='marketing-board-topline'>
        <span>GENERAL TRANSLATION / IDENTITY 01</span>
        <span>DESIGN BOARD</span>
      </div>
      <div className='marketing-board-grid'>
        <div className='marketing-board-logo'>
          <Image alt='' aria-hidden='true' height={104} src='/brand/gt-mark.png' width={104} />
          <strong>GT</strong>
          <span>GENERAL TRANSLATION</span>
        </div>
        <div className='marketing-board-type'>
          <small>PRIMARY / INTER</small>
          <strong>Aa</strong>
          <p>General Translation</p>
          <code>ABCDEFGHIJKLMN<br />abcdefghijklmn</code>
        </div>
        <div className='marketing-board-colors'>
          <span><i />#111111</span>
          <span><i />#FFFFFF</span>
          <span><i />OKLCH 17% 0 0</span>
        </div>
        <div className='marketing-board-terminal'>
          <div>$ npx gt-next init</div>
          <p><i /> identity synced</p>
          <span>hello → こんにちは → مرحبا</span>
        </div>
        <div className='marketing-board-lockup'>
          <small>PARTNERSHIP LOCKUP</small>
          <div>
            <Image alt='' aria-hidden='true' height={44} src='/brand/gt-mark.png' width={44} />
            <span>×</span>
            <strong>PARTNER</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function MotionPreview() {
  return (
    <div className='marketing-motion-preview'>
      <div className='marketing-preview-toolbar'>
        <span>MORPH FADE / GT</span>
        <span>1000 × 300 · GIF</span>
      </div>
      <div className='marketing-motion-output'>
        <Image
          alt='General Translation multilingual morph animation'
          height={300}
          src='/examples/gt-morph.gif'
          unoptimized
          width={1000}
        />
      </div>
      <div className='marketing-timeline'>
        <span className='marketing-playhead' />
        <i /><i /><i /><i /><i /><i /><i /><i />
      </div>
      <div className='marketing-curve'>
        <span>cubic-bezier(.22, 1, .36, 1)</span>
        <svg aria-hidden='true' viewBox='0 0 200 76'>
          <path d='M7 68C66 68 70 7 193 7' />
          <circle cx='69' cy='52' r='4' />
          <circle cx='124' cy='12' r='4' />
        </svg>
      </div>
    </div>
  );
}

function MaterialPreview() {
  return (
    <div className='marketing-material-preview'>
      <div className='marketing-preview-toolbar'>
        <span>BACKGROUND LAB</span>
        <span>LIVE MATERIALS</span>
      </div>
      <div className='marketing-material-grid'>
        <div className='marketing-material marketing-material--metal'>
          <Image alt='' aria-hidden='true' height={68} src={PRODUCT_BRAND.markWhitePath} width={68} />
          <span>LIQUID METAL</span>
        </div>
        <div className='marketing-material marketing-material--dither'>
          <Image alt='' aria-hidden='true' height={68} src={PRODUCT_BRAND.markPath} width={68} />
          <span>DITHER FIELD</span>
        </div>
        <div className='marketing-material marketing-material--grain'>
          <Image alt='' aria-hidden='true' height={68} src={PRODUCT_BRAND.markPath} width={68} />
          <span>GRAIN MESH</span>
        </div>
        <div className='marketing-material marketing-material--grid'>
          <Image alt='' aria-hidden='true' height={68} src={PRODUCT_BRAND.markPath} width={68} />
          <span>LINE SYSTEM</span>
        </div>
      </div>
    </div>
  );
}
