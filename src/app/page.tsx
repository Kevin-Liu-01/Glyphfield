import Image from 'next/image';
import Link from 'next/link';
import { T } from 'gt-next';
import { getGT } from 'gt-next/server';
import {
  ArrowRight,
  Bot,
  Braces,
  Download,
  Film,
  Layers3,
  Search,
  Sparkles,
  SwatchBook,
  Type,
  WandSparkles,
} from 'lucide-react';

import MarketingMotion from '@/components/MarketingMotion';
import { Button } from '@/components/ui/Button';
import { PRODUCT_BRAND } from '@/lib/productBrand';

const OUTPUTS = [
  'Moodboards',
  'Logo materials',
  'OpenGraph',
  'Email',
  'Slide decks',
  'CLI graphics',
  'Partnerships',
  'Components',
] as const;

const CAPABILITIES = [
  {
    description: 'Logos, semantic color, OKLCH, typography roles, voice, and source assets update the whole project.',
    icon: SwatchBook,
    label: 'Foundations',
    metric: '1 source',
  },
  {
    description: 'Morph, type/delete, crossfade, scale, and slide packages share deterministic cubic Bézier timing.',
    icon: Film,
    label: 'Motion',
    metric: '5 packages',
  },
  {
    description: 'ShaderGradient plus ten original WebGL recipes render behind or inside marks with live controls.',
    icon: Sparkles,
    label: 'Materials',
    metric: '11 live fields',
  },
  {
    description: 'Email, social, product, developer, editorial, event, and physical applications stay editable.',
    icon: Layers3,
    label: 'Brand elements',
    metric: '47 surfaces',
  },
  {
    description: 'Position, zoom, opacity, colors, imagery, textures, and layout remain adjustable on the canvas.',
    icon: WandSparkles,
    label: 'Composition',
    metric: 'Live canvas',
  },
  {
    description: 'Download PNG, GIF, SVG, identity JSON, and browser-local artifacts without uploading the brand.',
    icon: Download,
    label: 'Export',
    metric: '5 formats',
  },
] as const;

export default async function HomePage() {
  const gt = await getGT();

  return (
    <main className='marketing-page marketing-page-v3 min-h-dvh text-foreground'>
      <MarketingMotion />
      <a className='marketing-skip-link' href='#main'>
        <T>Skip to content</T>
      </a>

      <header className='marketing-header marketing-header-v3'>
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
          <small><T>Brand Studio</T></small>
        </Link>
        <nav className='marketing-nav' aria-label={gt('Main navigation')}>
          <a href='#product'><T>Product</T></a>
          <a href='#capabilities'><T>Capabilities</T></a>
          <a href='#system'><T>System</T></a>
          <Link href='/docs'><T>Docs</T></Link>
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

        <section className='marketing-v3-hero' aria-labelledby='hero-title'>
          <div className='marketing-v3-hero-grid' aria-hidden='true' />
          <div className='marketing-vibrant-orb marketing-vibrant-orb--one' aria-hidden='true' />
          <div className='marketing-vibrant-orb marketing-vibrant-orb--two' aria-hidden='true' />
          <div className='marketing-v3-hero-copy'>
            <p className='marketing-v3-kicker'>
              <Sparkles aria-hidden='true' />
              <T>One identity. Every expression.</T>
            </p>
            <h1 id='hero-title'>
              <T>The working studio for your entire brand.</T>
            </h1>
            <p>
              <T>
                Define the system, design every surface, animate the mark, and hand agents the same
                language—all inside one connected, browser-local workspace.
              </T>
            </p>
            <div className='marketing-v3-actions'>
              <Button asChild className='h-12 px-5' size='lg'>
                <Link href='/studio'>
                  <T>Open Glyphfield</T>
                  <ArrowRight aria-hidden='true' />
                </Link>
              </Button>
              <Button asChild className='h-12 px-5' size='lg' variant='outline'>
                <Link href='/docs/getting-started'>
                  <T>Read the guide</T>
                </Link>
              </Button>
            </div>
            <div className='marketing-v3-proof'>
              <span><strong>47</strong><T>brand elements</T></span>
              <span><strong>15</strong><T>focused tools</T></span>
              <span><strong>100%</strong><T>browser-local</T></span>
            </div>
          </div>

          <div className='marketing-v3-hero-media'>
            <div className='marketing-v3-shot marketing-v3-shot--hero'>
              <ScreenshotFrame
                alt={gt('Glyphfield Logo Shader in dark mode with the General Translation mark on an animated material')}
                mode='Dark Studio'
                src='/screenshots/studio-logo-shader-dark.png'
                title='Live logo materials'
              />
            </div>
            <div className='marketing-v3-shot marketing-v3-shot--floating'>
              <ScreenshotFrame
                alt={gt('Glyphfield moodboard in light mode showing the General Translation identity system')}
                mode='Light Studio'
                src='/screenshots/studio-moodboard-light.png'
                title='Identity moodboard'
              />
            </div>
          </div>
        </section>

        <OutputTicker />
        <ConstructionSpacer />

        <section className='marketing-v3-intro' data-motion-reveal id='product'>
          <div data-motion-item>
            <p className='marketing-eyebrow'><T>The actual product</T></p>
            <h2><T>Not a gallery. A connected production system.</T></h2>
          </div>
          <p data-motion-item>
            <T>
              Every screen below is captured from Glyphfield itself. Projects persist in tabs,
              brand settings flow through every tool, and each canvas exports the artifact it previews.
            </T>
          </p>
        </section>

        <section className='marketing-v3-feature marketing-v3-feature--light' data-motion-reveal>
          <div className='marketing-v3-feature-copy' data-motion-item>
            <span className='marketing-v3-index'>01 / IDENTITY</span>
            <h2><T>See the whole brand as a designed board.</T></h2>
            <p>
              <T>
                Logo family, color system, typography, email, terminal, product page, and event
                applications resolve into a high-resolution moodboard with embedded fonts.
              </T>
            </p>
            <ul>
              <li><T>1200 × 1500 through 4800 × 6000 export</T></li>
              <li><T>Actual identity assets and generated applications</T></li>
              <li><T>Downloadable PNG and identity JSON</T></li>
            </ul>
          </div>
          <div className='marketing-v3-feature-media' data-motion-item>
            <ScreenshotFrame
              alt={gt('Light mode General Translation moodboard canvas in Glyphfield')}
              mode='Light mode'
              src='/screenshots/studio-moodboard-light.png'
              title='Moodboard / General Translation'
            />
          </div>
        </section>

        <section className='marketing-v3-feature marketing-v3-feature--dark' data-motion-reveal>
          <div className='marketing-v3-feature-media' data-motion-item>
            <ScreenshotFrame
              alt={gt('Dark mode Glyphfield Logo Shader with editable HEX and OKLCH colors')}
              mode='Dark mode'
              src='/screenshots/studio-logo-shader-dark.png'
              title='Logo Shader / ShaderGradient'
            />
          </div>
          <div className='marketing-v3-feature-copy' data-motion-item>
            <span className='marketing-v3-index'>02 / MATERIAL</span>
            <h2><T>Put live material behind—or inside—the mark.</T></h2>
            <p>
              <T>
                Start with the supplied ShaderGradient sphere or choose one of ten original GLSL
                recipes. Tune perceptual color, grain, density, rotation, speed, and distortion live.
              </T>
            </p>
            <ul>
              <li><T>HEX and OKLCH color controls</T></li>
              <li><T>Background, logo mask, or both</T></li>
              <li><T>Still PNG and animated GIF export</T></li>
            </ul>
          </div>
        </section>

        <section className='marketing-v3-feature marketing-v3-feature--soft' data-motion-reveal>
          <div className='marketing-v3-feature-copy' data-motion-item>
            <span className='marketing-v3-index'>03 / APPLICATIONS</span>
            <h2><T>Turn the system into something useful.</T></h2>
            <p>
              <T>
                Build welcome emails, social cards, developer graphics, event passes, physical
                collateral, and product UI without leaving the active identity.
              </T>
            </p>
            <ul>
              <li><T>47 editable applications across seven categories</T></li>
              <li><T>Move, scale, recolor, pattern, and replace artwork</T></li>
              <li><T>Real GT templates included as an example project</T></li>
            </ul>
          </div>
          <div className='marketing-v3-feature-media' data-motion-item>
            <ScreenshotFrame
              alt={gt('Light mode Glyphfield brand element editor showing a General Translation welcome email')}
              mode='Light mode'
              src='/screenshots/studio-brand-elements-light.png'
              title='Brand elements / Welcome email'
            />
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-v3-capabilities' data-motion-reveal id='capabilities'>
          <div className='marketing-v3-section-heading' data-motion-item>
            <p className='marketing-eyebrow'><T>Everything in one project</T></p>
            <h2><T>Foundations in. Production artifacts out.</T></h2>
            <p>
              <T>Each focused tool inherits the same identity and exposes controls built for its output.</T>
            </p>
          </div>
          <div className='marketing-v3-capability-grid'>
            {CAPABILITIES.map(({ description, icon: Icon, label, metric }) => (
              <article data-motion-item key={label}>
                <span><Icon aria-hidden='true' /></span>
                <small>{metric}</small>
                <h3>{gt(label)}</h3>
                <p>{gt(description)}</p>
              </article>
            ))}
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-v3-components' data-motion-reveal>
          <div className='marketing-v3-components-copy' data-motion-item>
            <p className='marketing-eyebrow marketing-eyebrow--dark'><T>Components are brand too</T></p>
            <h2><T>Inspect the interface language, not only the logo.</T></h2>
            <p>
              <T>
                Buttons, inputs, selects, navigation, feedback, data, and cards are rendered in
                context, with shared labels, sizing, state, and theme controls.
              </T>
            </p>
            <div className='marketing-v3-fonts'>
              <span><Type aria-hidden='true' /><T>Studio font</T></span>
              <strong>Switzer</strong>
              <strong>Be Vietnam Pro</strong>
              <strong>Schibsted Grotesk</strong>
              <strong>Rethink Sans</strong>
            </div>
          </div>
          <div className='marketing-v3-components-media' data-motion-item>
            <ScreenshotFrame
              alt={gt('Glyphfield component library in dark mode showing branded button variants')}
              mode='Dark mode'
              src='/screenshots/studio-components-dark.png'
              title='Component library / Actions'
            />
          </div>
        </section>

        <ConstructionSpacer />

        <section className='marketing-v3-system' data-motion-reveal id='system'>
          <CornerHatches />
          <div className='marketing-v3-system-copy' data-motion-item>
            <p className='marketing-eyebrow marketing-eyebrow--dark'>
              <Bot aria-hidden='true' />
              <T>Agent-readable by design</T>
            </p>
            <h2><T>Your design language becomes an interface.</T></h2>
            <p>
              <T>
                Agents can discover identities, search tools, inspect elements, generate stable SVG,
                and learn when browser-local rendering is required.
              </T>
            </p>
            <div className='marketing-v3-system-links'>
              <Button asChild size='lg' variant='secondary'>
                <Link href='/api/catalog'><T>Open agent catalog</T><ArrowRight aria-hidden='true' /></Link>
              </Button>
              <Link href='/docs/agents'><T>Agent docs</T> ↗</Link>
              <Link href='/llms.txt'>llms.txt ↗</Link>
            </div>
          </div>
          <AgentPanel />
        </section>

        <ConstructionSpacer />

        <footer className='marketing-footer-v2 marketing-footer-v3' data-motion-footer>
          <div className='marketing-footer-halo' aria-hidden='true'><i /><i /><i /></div>
          <div className='marketing-footer-noise' aria-hidden='true' />
          <div className='marketing-footer-cta' data-motion-reveal>
            <Image alt='' aria-hidden='true' height={58} src={PRODUCT_BRAND.markWhitePath} width={58} />
            <p className='marketing-eyebrow marketing-eyebrow--dark'><T>Build the identity once.</T></p>
            <h2 data-motion-item><T>Make everything else from the same system.</T></h2>
            <Button asChild className='h-12 px-6' size='lg' variant='secondary'>
              <Link href='/studio'><T>Open Glyphfield</T><ArrowRight aria-hidden='true' /></Link>
            </Button>
          </div>
          <div className='marketing-footer-wordmark' data-footer-wordmark>GLYPHFIELD</div>
          <div className='marketing-footer-bottom'>
            <span><T>© 2026 Kevin Liu · MIT licensed</T></span>
            <div>
              <Link href='/studio'><T>Studio</T> ↗</Link>
              <Link href='/docs'><T>Docs</T> ↗</Link>
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

function OutputTicker() {
  return (
    <div className='marketing-v3-output-ticker' aria-label='Studio outputs'>
      <span><T>One brand system</T></span>
      <div>
        {OUTPUTS.map((output) => <span key={output}>{output}</span>)}
      </div>
    </div>
  );
}

function ScreenshotFrame({
  alt,
  mode,
  src,
  title,
}: {
  alt: string;
  mode: string;
  src: string;
  title: string;
}) {
  return (
    <figure className='marketing-v3-screenshot'>
      <div>
        <span><i /><i /><i />{title}</span>
        <small>{mode}</small>
      </div>
      <Image
        alt={alt}
        height={1209}
        sizes='(max-width: 900px) 94vw, 68vw'
        src={src}
        width={2219}
      />
    </figure>
  );
}

function AgentPanel() {
  return (
    <div className='marketing-v3-agent-panel' data-motion-item>
      <div>
        <span><Braces aria-hidden='true' /> POST /api/generate</span>
        <small>200 · image/svg+xml</small>
      </div>
      <pre><code>{`{
  "kind": "template",
  "template": "slides",
  "identity": { "preset": "gt" },
  "settings": {
    "title": "One system. Every locale.",
    "layout": "statement"
  },
  "output": "raw"
}`}</code></pre>
      <footer>
        <span><i /> deterministic artifact</span>
        <span><Search aria-hidden='true' /> /api/search</span>
      </footer>
    </div>
  );
}
