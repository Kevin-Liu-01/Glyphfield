import Image from 'next/image';
import Link from 'next/link';
import { T } from 'gt-next';
import { getGT } from 'gt-next/server';
import {
  ArrowRight,
  Bot,
  Braces,
  Check,
  CircleDot,
  Film,
  Grid2X2,
  Layers3,
  Palette,
  ScanLine,
  Sparkles,
  TerminalSquare,
} from 'lucide-react';

import type { ReactNode } from 'react';

import MarketingArcField from '@/components/MarketingArcField';
import MarketingMotion from '@/components/MarketingMotion';
import { BRAND_ELEMENTS } from '@/lib/brandElements';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';
import { PRODUCT_BRAND } from '@/lib/productBrand';
import { STUDIO_TOOLS } from '@/lib/studioCatalog';

const OUTPUTS = [
  'Identity systems',
  'Logo materials',
  'Motion packages',
  'Moodboards',
  'Product UI',
  'Email',
  'Slides',
  'Agent artifacts',
] as const;

const BRAND_LOGOS = [
  { name: 'General Translation', src: '/brands/gt/logos/wordmark-black.svg' },
  { name: 'Ramp', src: '/brands/ramp/logos/wordmark-slate.svg' },
  { name: 'Mintlify', src: '/brands/mintlify/logos/wordmark.svg' },
  { name: 'Tailwind CSS', src: '/brands/tailwind/logos/wordmark.svg' },
  { name: 'Vite+', src: '/brands/viteplus/logos/wordmark-dark.svg' },
  { name: 'Stripe', src: '/brands/stripe/logos/wordmark-slate.svg' },
  { name: 'Cloudflare', src: '/brands/cloudflare/logos/wordmark.svg' },
] as const;

const HERO_FIELD_SETTINGS = {
  ...DEFAULT_LIVE_MATERIAL_SETTINGS,
  amplitude: 2.6,
  brightness: 1.06,
  colorA: '#1B0A47',
  colorB: '#725CFF',
  colorC: '#D7FFF7',
  detail: 4.2,
  frequency: 5.8,
  grain: 38,
  rotationZ: 24,
  speed: 0.14,
  strength: 0.64,
};

const FEATURES = [
  {
    description: 'Logo families, source assets, fonts, color roles, voice, and layout rules stay connected.',
    icon: Palette,
    label: 'Identity source',
    metric: '01',
  },
  {
    description: 'Compose moodboards, email, decks, product UI, editorial graphics, and physical pieces.',
    icon: Layers3,
    label: 'Brand applications',
    metric: '02',
  },
  {
    description: 'Morph text, logos, images, and live backgrounds with editable curves and deterministic timing.',
    icon: Film,
    label: 'Motion system',
    metric: '03',
  },
  {
    description: 'Use shader materials, grain, dither, gradients, grids, and image treatments behind any mark.',
    icon: Sparkles,
    label: 'Material lab',
    metric: '04',
  },
  {
    description: 'Select, drag, resize, layer, zoom, and export from a direct-manipulation canvas.',
    icon: ScanLine,
    label: 'Editable canvas',
    metric: '05',
  },
  {
    description: 'Agents discover the same identities and tools, then generate stable SVG and browser artifacts.',
    icon: Bot,
    label: 'Agent interface',
    metric: '06',
  },
] as const;

export default async function HomePage() {
  const gt = await getGT();

  return (
    <main className='marketing-page marketing-page-v5 min-h-dvh text-foreground'>
      <MarketingMotion />
      <a className='marketing-skip-link' href='#main'>
        <T>Skip to content</T>
      </a>

      <header className='marketing-v5-header'>
        <Link className='marketing-v5-brand' href='/' aria-label={gt('Glyphfield home')}>
          <Image alt='' aria-hidden='true' height={30} priority src={PRODUCT_BRAND.markPath} width={30} />
          <span>{PRODUCT_BRAND.name}</span>
          <small><T>Brand Studio</T></small>
        </Link>
        <nav className='marketing-v5-nav' aria-label={gt('Main navigation')}>
          <a href='#studio'><T>Studio</T></a>
          <a href='#agents'><T>Agents</T></a>
          <Link href='/docs'><T>Docs</T></Link>
        </nav>
        <Link className='marketing-v5-primary-link' href='/studio'>
          <T>Open Studio</T>
          <ArrowRight aria-hidden='true' />
        </Link>
      </header>

      <div id='main'>
        <SectionRule coordinate='Y 000' label='Brand operating field' />

        <section className='marketing-v5-hero' aria-labelledby='hero-title'>
          <div className='marketing-v5-hero-copy' data-motion-reveal>
            <p className='marketing-v5-kicker' data-motion-item>
              <CircleDot aria-hidden='true' />
              <T>One identity. Every expression.</T>
            </p>
            <h1 id='hero-title' data-motion-item>
              <T>The working studio</T>
              <br />
              <em><T>for your entire brand.</T></em>
            </h1>
            <p data-motion-item>
              <T>
                Define the system, make every surface, animate the mark, and give agents the same
                visual language from one connected workspace.
              </T>
            </p>
            <div className='marketing-v5-actions' data-motion-item>
              <Link className='marketing-v5-primary-link marketing-v5-primary-link--large' href='/studio'>
                <T>Open Glyphfield</T>
                <ArrowRight aria-hidden='true' />
              </Link>
              <Link className='marketing-v5-secondary-link' href='/docs/getting-started'>
                <T>Read the field guide</T>
              </Link>
            </div>
          </div>

          <div className='marketing-v5-hero-specs' aria-label={gt('Glyphfield product summary')}>
            <span><strong>{STUDIO_TOOLS.length}</strong><T>focused tools</T></span>
            <span><strong>{BRAND_ELEMENTS.length}</strong><T>editable surfaces</T></span>
            <span><strong>5</strong><T>export formats</T></span>
          </div>

          <div className='marketing-v5-hero-field' data-motion-reveal>
            <MarketingArcField materialId='shaders-spectral-bloom' settings={HERO_FIELD_SETTINGS} />
            <div className='marketing-v5-field-coordinates' aria-hidden='true'>
              <span>X 014.80</span>
              <span>FIELD / LIVE</span>
              <span>Y 006.30</span>
            </div>
            <div className='marketing-v5-product-window' data-motion-item>
              <ProductFrame
                alt={gt('Glyphfield Studio showing the General Translation identity moodboard')}
                label='Moodboard / General Translation'
                src='/screenshots/studio-moodboard-gt-2026.jpg'
              />
            </div>
          </div>
        </section>

        <OutputRail gt={gt} />
        <LogoRail gt={gt} />
        <SectionRule coordinate='Y 018' label='Logo Lab × Animation Library' />

        <section className='marketing-v5-composer' data-motion-reveal id='studio'>
          <div className='marketing-v5-composer-copy' data-motion-item>
            <p className='marketing-v5-kicker'><Grid2X2 aria-hidden='true' /><T>One connected canvas</T></p>
            <h2><T>Build the mark and its motion together.</T></h2>
            <p>
              <T>
                Move from source logo to material, then into a timed sequence without rebuilding the
                asset. Text, images, marks, and shader states can all become frames.
              </T>
            </p>
            <ul>
              <li><Check aria-hidden='true' /><T>Drag and layer every visual element</T></li>
              <li><Check aria-hidden='true' /><T>Edit cubic Bézier handles directly</T></li>
              <li><Check aria-hidden='true' /><T>Export high-resolution PNG, SVG, and GIF</T></li>
            </ul>
            <Link className='marketing-v5-text-link' href='/studio'>
              <T>Open the motion workspace</T>
              <ArrowRight aria-hidden='true' />
            </Link>
          </div>

          <LogoMotionDemo gt={gt} />
        </section>

        <SectionRule coordinate='Y 032' label='System capabilities' />

        <section className='marketing-v5-capabilities' data-motion-reveal>
          <SectionHeading
            eyebrow='A practical brand operating system'
            title='Foundations in. Useful artifacts out.'
          >
            <T>
              Every focused tool inherits the active identity, preserves the correct aspect ratio,
              and exposes controls for the output it makes.
            </T>
          </SectionHeading>
          <div className='marketing-v5-capability-grid'>
            {FEATURES.map(({ description, icon: Icon, label, metric }) => (
              <article data-motion-item key={label}>
                <span>{metric}</span>
                <Icon aria-hidden='true' />
                <h3>{gt(label)}</h3>
                <p>{gt(description)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className='marketing-v5-product-grid' data-motion-reveal>
          <article className='marketing-v5-product-card marketing-v5-product-card--wide' data-motion-item>
            <CardLabel index='07' label='Identity board' />
            <h2><T>See the system as designed work.</T></h2>
            <p><T>Fonts, color, logo family, product surfaces, and motion resolve into a composed board.</T></p>
            <div className='marketing-v5-product-card-image'>
              <Image
                alt={gt('General Translation identity moodboard in Glyphfield')}
                fill
                sizes='(max-width: 800px) 96vw, 64vw'
                src='/screenshots/studio-moodboard-gt-2026.jpg'
              />
            </div>
          </article>
          <article className='marketing-v5-product-card marketing-v5-product-card--dark' data-motion-item>
            <CardLabel index='08' label='Material study' />
            <h2><T>Give the logo a surface.</T></h2>
            <p><T>Mask live Shaders.com materials inside the mark or place them behind it.</T></p>
            <div className='marketing-v5-product-card-image'>
              <Image
                alt={gt('Glyphfield logo shader workspace')}
                fill
                sizes='(max-width: 800px) 96vw, 36vw'
                src='/screenshots/studio-logo-shader-gt-2026.jpg'
              />
            </div>
          </article>
        </section>

        <SectionRule coordinate='Y 054' dark label='Agent interface' />

        <section className='marketing-v5-agents' data-motion-reveal id='agents'>
          <div className='marketing-v5-agents-copy' data-motion-item>
            <p className='marketing-v5-kicker marketing-v5-kicker--dark'>
              <Bot aria-hidden='true' />
              <T>Agent-first, not agent-adjacent</T>
            </p>
            <h2><T>The visual system is also an interface.</T></h2>
            <p>
              <T>
                Agents can discover identities, inspect tools, generate deterministic SVG, and know
                when a browser render is required. The catalog and the canvas speak the same language.
              </T>
            </p>
            <div className='marketing-v5-agent-links'>
              <Link className='marketing-v5-primary-link marketing-v5-primary-link--inverse' href='/docs/agents'>
                <T>Read agent docs</T><ArrowRight aria-hidden='true' />
              </Link>
              <Link href='/api/catalog'><T>Catalog</T> ↗</Link>
              <Link href='/llms.txt'>llms.txt ↗</Link>
            </div>
            <div className='marketing-v5-agent-flow' aria-label={gt('Agent workflow')}>
              <span><Braces aria-hidden='true' /><T>Discover</T></span>
              <i aria-hidden='true' />
              <span><TerminalSquare aria-hidden='true' /><T>Generate</T></span>
              <i aria-hidden='true' />
              <span><Check aria-hidden='true' /><T>Artifact</T></span>
            </div>
          </div>
          <AgentPanel />
        </section>

        <SectionRule coordinate='Y 072' dark label='Open field' />

        <footer className='marketing-v5-footer' data-motion-footer>
          <div className='marketing-v5-footer-field' aria-hidden='true'>
            <i /><i /><i />
          </div>
          <div className='marketing-v5-footer-top' data-motion-reveal>
            <Image alt='' aria-hidden='true' height={72} src={PRODUCT_BRAND.markWhitePath} width={72} />
            <div data-motion-item>
              <p className='marketing-v5-kicker marketing-v5-kicker--dark'><T>Your brand, as a working system</T></p>
              <h2><T>Make the field yours.</T></h2>
            </div>
            <Link className='marketing-v5-primary-link marketing-v5-primary-link--inverse' href='/studio'>
              <T>Open Glyphfield</T><ArrowRight aria-hidden='true' />
            </Link>
          </div>
          <div className='marketing-v5-footer-wordmark' data-footer-wordmark>GLYPHFIELD</div>
          <div className='marketing-v5-footer-bottom'>
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

function SectionRule({ coordinate, dark = false, label }: { coordinate: string; dark?: boolean; label: string }) {
  return (
    <div className={`marketing-v5-rule${dark ? ' marketing-v5-rule--dark' : ''}`} aria-hidden='true'>
      <span>{coordinate}</span>
      <i />
      <strong>{label}</strong>
      <i />
    </div>
  );
}

function OutputRail({ gt }: { gt: Awaited<ReturnType<typeof getGT>> }) {
  return (
    <div className='marketing-v5-output-rail' aria-label={gt('Studio outputs')}>
      <span><T>One source of truth</T></span>
      <div>{OUTPUTS.map((output) => <span key={output}>{gt(output)}</span>)}</div>
    </div>
  );
}

function LogoRail({ gt }: { gt: Awaited<ReturnType<typeof getGT>> }) {
  return (
    <section className='marketing-v5-logo-rail' aria-labelledby='example-identities'>
      <div>
        <p id='example-identities'><T>Example identity library</T></p>
        <span><T>Actual source marks, not placeholders</T></span>
      </div>
      <ul>
        {BRAND_LOGOS.map(({ name, src }) => (
          <li key={name} title={gt(name)}>
            <Image alt={gt(`${name} wordmark`)} height={34} src={src} width={116} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionHeading({ children, eyebrow, title }: { children: ReactNode; eyebrow: string; title: string }) {
  return (
    <div className='marketing-v5-section-heading'>
      <p className='marketing-v5-kicker'><CircleDot aria-hidden='true' />{eyebrow}</p>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

function ProductFrame({ alt, label, src }: { alt: string; label: string; src: string }) {
  return (
    <figure className='marketing-v5-studio-frame'>
      <figcaption>
        <span><i /><i /><i />{label}</span>
        <small>LIGHT / STUDIO</small>
      </figcaption>
      <div>
        <Image alt={alt} fill priority sizes='(max-width: 900px) 92vw, 76vw' src={src} />
      </div>
    </figure>
  );
}

function LogoMotionDemo({ gt }: { gt: Awaited<ReturnType<typeof getGT>> }) {
  return (
    <div className='marketing-v5-composer-demo' data-motion-item>
      <header>
        <span><i />COMPOSITION 01</span>
        <div><button type='button'>Logo Lab</button><button type='button'>Animation</button></div>
        <small>1600 × 1000</small>
      </header>
      <div className='marketing-v5-composer-body'>
        <aside>
          <p><T>Source marks</T></p>
          {BRAND_LOGOS.slice(0, 5).map(({ name, src }, index) => (
            <button className={index === 0 ? 'is-active' : ''} key={name} type='button'>
              <Image alt='' aria-hidden='true' height={22} src={src} width={70} />
              <span>{gt(name)}</span>
            </button>
          ))}
        </aside>
        <section>
          <div className='marketing-v5-demo-stage'>
            <div className='marketing-v5-demo-arcs' aria-hidden='true'><i /><i /><i /></div>
            <Image
              alt={gt('General Translation logo')}
              className='marketing-v5-demo-logo'
              height={72}
              src='/brands/gt/logos/wordmark-white.svg'
              width={250}
            />
            <span className='marketing-v5-selection-box' aria-hidden='true'><i /><i /><i /><i /></span>
            <div className='marketing-v5-demo-gif'>
              <Image
                alt={gt('General Translation multilingual text morph')}
                fill
                unoptimized
                src='/examples/gt-morph-one-second.gif'
              />
            </div>
          </div>
          <div className='marketing-v5-timeline'>
            <span>00:00</span>
            <div>
              {['GT', 'Welcome', 'Bienvenidos', '你好', 'ようこそ'].map((frame, index) => (
                <i className={index === 0 ? 'is-active' : ''} key={frame}><b>{frame}</b></i>
              ))}
            </div>
            <span>00:05</span>
          </div>
        </section>
      </div>
      <footer>
        <span><T>Cubic Bézier</T> 0.20, 0.80, 0.20, 1.00</span>
        <span><T>Logo → text → image</T></span>
        <strong><T>Export GIF</T></strong>
      </footer>
    </div>
  );
}

function CardLabel({ index, label }: { index: string; label: string }) {
  return <span className='marketing-v5-card-label'>{index} / {label}</span>;
}

function AgentPanel() {
  return (
    <div className='marketing-v5-agent-panel' data-motion-item>
      <header>
        <span><Braces aria-hidden='true' /> POST /api/generate</span>
        <small>200 · image/svg+xml</small>
      </header>
      <pre><code>{`{
  "kind": "template",
  "template": "logo-motion",
  "identity": { "preset": "gt" },
  "settings": {
    "sequence": ["logo", "text", "image"],
    "material": "spectral-bloom",
    "curve": [0.2, 0.8, 0.2, 1]
  },
  "output": "raw"
}`}</code></pre>
      <footer>
        <span><i /> deterministic artifact</span>
        <span>identity.json</span>
      </footer>
    </div>
  );
}
