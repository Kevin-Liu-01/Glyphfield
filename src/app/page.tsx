import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { T } from 'gt-next';
import { getGT } from 'gt-next/server';
import {
  ArrowRight,
  Bot,
  Braces,
  Layers3,
  Palette,
  PanelsTopLeft,
  Play,
  Sparkles,
  WandSparkles,
} from 'lucide-react';

import MarketingMotion from '@/components/MarketingMotion';
import { Button } from '@/components/ui/Button';
import { PRODUCT_BRAND } from '@/lib/productBrand';

const SURFACES = [
  'OpenGraph',
  'Welcome email',
  'Slide deck',
  'CLI brand',
  'Partnership',
  'Moodboard',
  'App icon',
  'Blog cover',
] as const;

export default async function HomePage() {
  const gt = await getGT();

  return (
    <main className='marketing-page marketing-page-v2 min-h-dvh bg-background text-foreground'>
      <MarketingMotion />
      <a className='marketing-skip-link' href='#main'>
        <T>Skip to content</T>
      </a>

      <header className='marketing-header marketing-header-v2'>
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
          <a href='#studio'><T>Studio</T></a>
          <a href='#features'><T>Features</T></a>
          <a href='#system'><T>System</T></a>
          <a href='#agents'><T>Agents</T></a>
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

        <section className='marketing-unified-hero' aria-labelledby='hero-title'>
          <div className='marketing-unified-hero-dots' aria-hidden='true' />
          <div className='marketing-unified-hero-copy'>
            <div className='marketing-hero-sigil' aria-hidden='true'>
              <Image height={32} src={PRODUCT_BRAND.markPath} width={32} alt='' />
              <Sparkles />
            </div>
            <h1 id='hero-title'>
              <span><T>One Brand Studio</T></span>
              <span className='marketing-gradient-copy'><T>for Every Surface.</T></span>
            </h1>
            <p>
              <T>
                Build an identity once, then make motion, graphics, templates, and agent-ready
                assets from one connected system.
              </T>
            </p>
            <p className='marketing-hero-note'>
              <T>Local-first · Source-available · Production-ready exports</T>
            </p>
            <div className='marketing-unified-actions'>
              <Button asChild className='h-12 px-5' size='lg'>
                <Link href='/studio'>
                  <T>Open the Studio</T>
                  <ArrowRight aria-hidden='true' />
                </Link>
              </Button>
              <Button asChild className='h-12 px-5' size='lg' variant='outline'>
                <a href='#features'>
                  <Play aria-hidden='true' />
                  <T>Explore the system</T>
                </a>
              </Button>
              <Button asChild className='h-12 px-5' size='lg' variant='outline'>
                <Link href='/api/catalog'>
                  <Braces aria-hidden='true' />
                  <T>Agent catalog</T>
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <ConstructionSpacer />

        <section
          className='marketing-vibrant-field marketing-vibrant-field--hero'
          data-motion-reveal
          id='studio'
        >
          <CornerHatches />
          <div className='marketing-vibrant-orb marketing-vibrant-orb--one' aria-hidden='true' />
          <div className='marketing-vibrant-orb marketing-vibrant-orb--two' aria-hidden='true' />
          <div className='marketing-light-rays' aria-hidden='true' />
          <div data-motion-item>
            <StudioProductPreview />
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-bento-section' data-motion-reveal id='features'>
          <div className='marketing-section-heading marketing-section-heading-v2'>
            <p className='marketing-eyebrow'><T>Everything stays connected</T></p>
            <h2><T>One Studio. The whole identity.</T></h2>
            <p>
              <T>
                Foundations, motion, brand applications, and exports share the same project—not
                separate files that drift apart.
              </T>
            </p>
          </div>

          <div className='marketing-bento-grid'>
            <article className='marketing-bento-card marketing-bento-card--identity marketing-bento-card--wide' data-motion-item>
                <BentoHeader
                  icon={<PanelsTopLeft aria-hidden='true' />}
                  kicker={gt('Identity board')}
                  title={gt('See the whole system at once.')}
              />
              <div className='marketing-bento-board-wrap'>
                <IdentityBoardPreview />
              </div>
            </article>

            <article className='marketing-bento-card marketing-bento-card--motion' data-motion-item>
                <BentoHeader
                  icon={<WandSparkles aria-hidden='true' />}
                  kicker={gt('Motion packages')}
                  title={gt('Timing you can tune and reuse.')}
              />
              <MotionPreview />
            </article>

            <article className='marketing-bento-card marketing-bento-card--materials' data-motion-item>
                <BentoHeader
                  icon={<Palette aria-hidden='true' />}
                  kicker={gt('Materials')}
                  title={gt('Grain, dither, gradients, and shaders.')}
              />
              <MaterialPreview />
            </article>

            <article className='marketing-bento-card marketing-bento-card--surfaces' data-motion-item>
                <BentoHeader
                  icon={<Layers3 aria-hidden='true' />}
                  kicker={gt('33 surfaces')}
                  title={gt('Go from identity to something useful.')}
              />
              <div className='marketing-surface-cloud'>
                {SURFACES.map((surface) => <span key={surface}>{gt(surface)}</span>)}
              </div>
            </article>

            <article className='marketing-bento-card marketing-bento-card--agents marketing-bento-card--wide' data-motion-item>
              <div>
                <BentoHeader
                  icon={<Bot aria-hidden='true' />}
                  kicker={gt('Agent interface')}
                  title={gt('A brand system machines can operate.')}
                />
                <p className='marketing-bento-copy'>
                  <T>
                    llms.txt, a public catalog, and deterministic generation endpoints expose the
                    same tools your team uses in the Studio.
                  </T>
                </p>
              </div>
              <AgentCodePreview />
            </article>
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-system-story' data-motion-reveal id='system'>
          <div className='marketing-system-copy' data-motion-item>
            <p className='marketing-eyebrow'><T>A working identity</T></p>
            <h2><T>Every output traces back to the system.</T></h2>
            <p>
              <T>
                Logo, color, typography, voice, motion, and source assets flow into repeatable
                tools. Change the project; every surface receives the new context.
              </T>
            </p>
            <ol>
              <li><span>01</span><div><strong><T>Define</T></strong><p><T>Bring in the identity and its real source assets.</T></p></div></li>
              <li><span>02</span><div><strong><T>Compose</T></strong><p><T>Use purpose-built tools for each brand expression.</T></p></div></li>
              <li><span>03</span><div><strong><T>Generate</T></strong><p><T>Export for people, products, channels, or agents.</T></p></div></li>
            </ol>
          </div>
          <div className='marketing-isometric-stage' data-motion-item>
            <div className='marketing-isometric-stage-grid' aria-hidden='true' />
            <IsometricStudioDiagram />
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-agent-band' data-motion-reveal id='agents'>
          <div className='marketing-agent-band-copy' data-motion-item>
            <p className='marketing-eyebrow marketing-eyebrow--dark'>
              <Bot aria-hidden='true' />
              <T>Human-made. Agent-usable.</T>
            </p>
            <h2><T>Design language becomes an interface.</T></h2>
            <p>
              <T>
                Agents can discover identities, inspect available elements, and generate stable
                SVG artifacts without guessing the brand rules.
              </T>
            </p>
            <div>
              <Button asChild size='lg' variant='secondary'>
                <Link href='/api/catalog'><T>Read the catalog</T><ArrowRight aria-hidden='true' /></Link>
              </Button>
              <Link href='/llms.txt'>llms.txt ↗</Link>
            </div>
          </div>
          <div className='marketing-agent-metrics' data-motion-item>
            <article><strong>15</strong><span><T>Studio tools</T></span></article>
            <article><strong>33</strong><span><T>brand surfaces</T></span></article>
            <article><strong>3</strong><span><T>export formats</T></span></article>
            <article><strong>0</strong><span><T>uploads required</T></span></article>
          </div>
        </section>

        <ConstructionSpacer />

        <footer className='marketing-footer-v2' data-motion-footer>
          <div className='marketing-footer-halo' aria-hidden='true'>
            <i /><i /><i />
          </div>
          <div className='marketing-footer-noise' aria-hidden='true' />
          <div className='marketing-footer-cta' data-motion-reveal>
            <Image alt='' aria-hidden='true' height={58} src={PRODUCT_BRAND.markWhitePath} width={58} />
            <p className='marketing-eyebrow marketing-eyebrow--dark'><T>Your brand, operational.</T></p>
            <h2 data-motion-item><T>Make the system. Then make everything else.</T></h2>
            <Button asChild className='h-12 px-6' size='lg' variant='secondary'>
              <Link href='/studio'><T>Open Glyphfield</T><ArrowRight aria-hidden='true' /></Link>
            </Button>
          </div>
          <div className='marketing-footer-wordmark' data-footer-wordmark>GLYPHFIELD</div>
          <div className='marketing-footer-marquee' aria-hidden='true'>
            <div>
              BRAND SYSTEMS · MOTION · GRAPHICS · SHADERS · EMAIL · DECKS · AGENTS · BRAND SYSTEMS · MOTION · GRAPHICS · SHADERS · EMAIL · DECKS · AGENTS ·
            </div>
          </div>
          <div className='marketing-footer-bottom'>
            <span><T>© 2026 Kevin Liu · Source available</T></span>
            <div>
              <Link href='/studio'><T>Studio</T> ↗</Link>
              <Link href='/api/catalog'><T>Agent API</T> ↗</Link>
              <Link href='/llms.txt'>llms.txt ↗</Link>
            </div>
          </div>
        </footer>
      </div>
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
  return <div className='marketing-corner-hatches' aria-hidden='true'><i /><i /><i /><i /></div>;
}

function BentoHeader({ icon, kicker, title }: { icon: ReactNode; kicker: string; title: string }) {
  return (
    <div className='marketing-bento-header'>
      <span>{icon}</span>
      <div><small>{kicker}</small><h3>{title}</h3></div>
    </div>
  );
}

function StudioProductPreview() {
  const tools = ['Brand elements', 'Moodboard', 'Animation', 'Logo shader', 'OpenGraph'];
  return (
    <Link className='marketing-product-window' href='/studio' aria-label='Open the Glyphfield Studio'>
      <div className='marketing-product-topbar'>
        <span><Image alt='' height={24} src={PRODUCT_BRAND.markPath} width={24} />Glyphfield</span>
        <span>⌕ &nbsp; Search email, logo, CLI, lanyard…</span>
        <span>⌘K &nbsp; ◐</span>
      </div>
      <div className='marketing-product-tabs'>
        <span className='marketing-product-tabs-dither'>{'{ }'}</span>
        <span>✦ &nbsp;/&nbsp; Starter</span>
        <span className='is-active'>GT &nbsp;/&nbsp; General Translation</span>
        <span>＋</span>
      </div>
      <div className='marketing-product-body'>
        <aside>
          <small>STUDIO TOOLS</small>
          {tools.map((tool, index) => <span className={index === 0 ? 'is-active' : ''} key={tool}>{tool}</span>)}
        </aside>
        <section>
          <div className='marketing-product-panelbar'><strong>Brand elements</strong><span>47 elements</span></div>
          <div className='marketing-product-canvas'>
            <div className='marketing-product-email'>
              <div><Image alt='' height={32} src='/brand/gt-mark.png' width={32} /><span>GENERAL TRANSLATION</span></div>
              <div className='marketing-product-email-hero'>
                <Image alt='' fetchPriority='low' height={300} loading='lazy' src='/examples/gt-morph.gif' unoptimized width={1000} />
              </div>
              <h3>Welcome to General Translation!</h3>
              <p>Keep product copy, documentation, and code moving together across locales.</p>
              <div className='marketing-product-email-cards'><i /><i /><i /></div>
            </div>
          </div>
        </section>
      </div>
    </Link>
  );
}

function IdentityBoardPreview() {
  return (
    <div className='marketing-board-preview'>
      <div className='marketing-board-topline'><span>GENERAL TRANSLATION / IDENTITY 01</span><span>DESIGN BOARD</span></div>
      <div className='marketing-board-grid'>
        <div className='marketing-board-logo'><Image alt='' height={104} src='/brand/gt-mark.png' width={104} /><strong>GT</strong><span>GENERAL TRANSLATION</span></div>
        <div className='marketing-board-type'><small>PRIMARY / INTER</small><strong>Aa</strong><p>General Translation</p><code>ABCDEFGHIJKLMN<br />abcdefghijklmn</code></div>
        <div className='marketing-board-colors'><span><i />#111111</span><span><i />#FFFFFF</span><span><i />OKLCH 17% 0 0</span></div>
        <div className='marketing-board-terminal'><div>$ npx gt-next init</div><p><i /> identity synced</p><span>hello → こんにちは → مرحبا</span></div>
        <div className='marketing-board-lockup'><small>PARTNERSHIP LOCKUP</small><div><Image alt='' height={44} src='/brand/gt-mark.png' width={44} /><span>×</span><strong>PARTNER</strong></div></div>
      </div>
    </div>
  );
}

function MotionPreview() {
  return (
    <div className='marketing-motion-preview'>
      <div className='marketing-preview-toolbar'><span>MORPH FADE / GT</span><span>1000 × 300 · GIF</span></div>
      <div className='marketing-motion-output'><Image alt='General Translation multilingual morph animation' fetchPriority='low' height={300} loading='lazy' src='/examples/gt-morph.gif' unoptimized width={1000} /></div>
      <div className='marketing-timeline'><span className='marketing-playhead' /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div className='marketing-curve'><span>cubic-bezier(.22, 1, .36, 1)</span><svg aria-hidden='true' viewBox='0 0 200 76'><path d='M7 68C66 68 70 7 193 7' /><circle cx='69' cy='52' r='4' /><circle cx='124' cy='12' r='4' /></svg></div>
    </div>
  );
}

function MaterialPreview() {
  return (
    <div className='marketing-material-preview'>
      <div className='marketing-preview-toolbar'><span>BACKGROUND LAB</span><span>LIVE MATERIALS</span></div>
      <div className='marketing-material-grid'>
        <div className='marketing-material marketing-material--metal'><Image alt='' height={68} src={PRODUCT_BRAND.markWhitePath} width={68} /><span>LIQUID METAL</span></div>
        <div className='marketing-material marketing-material--dither'><Image alt='' height={68} src={PRODUCT_BRAND.markPath} width={68} /><span>DITHER FIELD</span></div>
        <div className='marketing-material marketing-material--grain'><Image alt='' height={68} src={PRODUCT_BRAND.markPath} width={68} /><span>GRAIN MESH</span></div>
        <div className='marketing-material marketing-material--grid'><Image alt='' height={68} src={PRODUCT_BRAND.markPath} width={68} /><span>LINE SYSTEM</span></div>
      </div>
    </div>
  );
}

function AgentCodePreview() {
  return (
    <div className='marketing-agent-code-preview'>
      <div><span>generate.sh</span><span>POST /api/generate</span></div>
      <pre><code>{`curl -X POST /api/generate \\
  -H "content-type: application/json" \\
  -d '{ "tool": "opengraph", "project": "gt" }'`}</code></pre>
      <footer><span><i /> 200 · image/svg+xml</span><span>deterministic output</span></footer>
    </div>
  );
}

function IsometricStudioDiagram() {
  return (
    <div className='marketing-isometric-art marketing-isometric-art-v2' aria-hidden='true'>
      <svg viewBox='0 0 720 560'>
        <g className='marketing-iso-shadow'><path d='M93 386l283-164 251 145-283 164z' /></g>
        <g className='marketing-iso-board'>
          <path className='marketing-iso-side-left' d='M110 348l238 137v34L110 382z' />
          <path className='marketing-iso-side-right' d='M348 485l258-149v34L348 519z' />
          <path className='marketing-iso-top' d='M110 348l258-149 238 137-258 149z' />
          <path className='marketing-iso-grid' d='M146 348l222-128 202 116-222 128z' />
          <path className='marketing-iso-tile marketing-iso-tile--dark' d='M176 345l89-51 74 43-89 51z' />
          <path className='marketing-iso-tile marketing-iso-tile--purple' d='M282 284l87-50 73 42-87 50z' />
          <path className='marketing-iso-tile marketing-iso-tile--green' d='M369 338l86-50 72 42-86 50z' />
          <path className='marketing-iso-tile marketing-iso-tile--teal' d='M263 400l86-50 73 42-87 50z' />
        </g>
        <g className='marketing-iso-stack'>
          <path className='marketing-iso-panel-side' d='M431 211l122-70v92l-122 70z' />
          <path className='marketing-iso-panel' d='M318 146l113 65 122-70-113-65z' />
          <path className='marketing-iso-panel-left' d='M318 146l113 65v92l-113-65z' />
          <path className='marketing-iso-panel-screen' d='M337 151l96 55 98-57-95-55z' />
          <path className='marketing-iso-screen-chip' d='M354 148l24 14 22-13-24-14z' />
        </g>
        <g className='marketing-iso-wires marketing-iso-wires--base'><path d='M248 388v42l-72-42v-44' /><path d='M443 379v44l112-64v-54' /><path d='M377 198v-41l88-51' /></g>
        <g className='marketing-iso-wires marketing-iso-wires--signal'><path d='M248 388v42l-72-42v-44' /><path d='M443 379v44l112-64v-54' /><path d='M377 198v-41l88-51' /></g>
        <g className='marketing-iso-labels'><text x='118' y='512'>IDENTITY</text><text x='488' y='395'>OUTPUT</text><text x='476' y='87'>STUDIO</text></g>
      </svg>
    </div>
  );
}
