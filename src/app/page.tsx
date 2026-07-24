import Image from 'next/image';
import Link from 'next/link';
import { T } from 'gt-next';
import { getGT } from 'gt-next/server';
import {
  ArrowRight,
  Bot,
  Braces,
  Film,
  Layers3,
  Palette,
  ScanLine,
  Sparkles,
} from 'lucide-react';

import type { ReactNode } from 'react';

import AnimationStudio from '@/components/AnimationStudio';
import MarketingArcField from '@/components/MarketingArcField';
import MarketingMotion from '@/components/MarketingMotion';
import { MarketingThemeShell, MarketingThemeToggle } from '@/components/MarketingTheme';
import { GT_BRAND_IDENTITY } from '@/lib/brandIdentity';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';
import { PRODUCT_BRAND } from '@/lib/productBrand';

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
  },
  {
    description: 'Compose moodboards, email, decks, product UI, editorial graphics, and physical pieces.',
    icon: Layers3,
    label: 'Brand applications',
  },
  {
    description: 'Morph text, logos, images, and live backgrounds with editable curves and deterministic timing.',
    icon: Film,
    label: 'Motion system',
  },
  {
    description: 'Use shader materials, grain, dither, gradients, grids, and image treatments behind any mark.',
    icon: Sparkles,
    label: 'Material lab',
  },
  {
    description: 'Select, drag, resize, layer, zoom, and export from a direct-manipulation canvas.',
    icon: ScanLine,
    label: 'Editable canvas',
  },
  {
    description: 'Agents discover the same identities and tools, then generate stable SVG and browser artifacts.',
    icon: Bot,
    label: 'Agent interface',
  },
] as const;

const MARKETING_ANIMATION_IDENTITY = {
  ...GT_BRAND_IDENTITY,
  builtIn: false,
  id: 'marketing-animation-demo',
};

export default async function HomePage() {
  const gt = await getGT();

  return (
    <MarketingThemeShell>
      <MarketingMotion />
      <a className='marketing-skip-link' href='#main'>
        <T>Skip to content</T>
      </a>

      <header className='marketing-v5-header'>
        <Link className='marketing-v5-brand' href='/' aria-label={gt('Glyphfield home')}>
          <Image alt='' aria-hidden='true' height={30} priority src={PRODUCT_BRAND.markPath} width={30} />
          <span>{PRODUCT_BRAND.name}</span>
        </Link>
        <nav className='marketing-v5-nav' aria-label={gt('Main navigation')}>
          <a href='#studio'><T>Studio</T></a>
          <a href='#agents'><T>Agents</T></a>
          <Link href='/docs'><T>Docs</T></Link>
        </nav>
        <div className='marketing-v5-header-actions'>
          <MarketingThemeToggle />
          <Link className='marketing-v5-primary-link' href='/studio'>
            <T>Open Studio</T>
            <ArrowRight aria-hidden='true' />
          </Link>
        </div>
      </header>

      <div id='main'>
        <section className='marketing-v5-hero' aria-labelledby='hero-title'>
          <div className='marketing-v5-hero-copy' data-motion-reveal>
            <h1 id='hero-title' data-motion-item>
              <T>One studio for</T>{' '}
              <em><T>the whole brand.</T></em>
            </h1>
            <p data-motion-item>
              <T>
                Build identity systems, motion, graphics, and product-ready artifacts in one
                connected workspace that people and agents can use together.
              </T>
            </p>
            <div className='marketing-v5-actions' data-motion-item>
              <Link className='marketing-v5-primary-link marketing-v5-primary-link--large' href='/studio'>
                <T>Open Glyphfield</T>
                <ArrowRight aria-hidden='true' />
              </Link>
              <Link className='marketing-v5-secondary-link' href='/docs/getting-started'>
                <T>Read the docs</T>
              </Link>
            </div>
          </div>

          <div className='marketing-v5-hero-field' data-motion-reveal>
            <MarketingArcField materialId='shaders-spectral-bloom' settings={HERO_FIELD_SETTINGS} />
            <div className='marketing-v5-product-window' data-motion-item>
              <ProductFrame
                alt={gt('Glyphfield Studio showing the General Translation identity moodboard')}
                darkSrc='/screenshots/studio-moodboard-dark-2026.png'
                label='Moodboard / General Translation'
                priority
                src='/screenshots/studio-moodboard-light-2026.png'
              />
            </div>
          </div>
        </section>

        <LogoRail gt={gt} />

        <section className='marketing-v5-composer' data-motion-reveal id='studio'>
          <div className='marketing-v5-composer-copy' data-motion-item>
            <div>
              <h2><T>The Animation Studio, live.</T></h2>
              <p>
                <T>
                  This is the same editor used inside Glyphfield: the real source sequence,
                  per-frame controls, Bézier editor, canvas, playback, and timeline.
                </T>
              </p>
            </div>
            <Link className='marketing-v5-text-link' href='/studio'>
              <T>Open the full Studio</T>
              <ArrowRight aria-hidden='true' />
            </Link>
          </div>

          <div className='marketing-v5-animation-demo' data-motion-item>
            <AnimationStudio embedded identity={MARKETING_ANIMATION_IDENTITY} />
          </div>
        </section>

        <section className='marketing-v5-capabilities' data-motion-reveal>
          <SectionHeading title='Foundations in. Useful artifacts out.'>
            <T>
              Every tool inherits the active identity, preserves the right aspect ratio, and exposes
              only the controls needed for the artifact it makes.
            </T>
          </SectionHeading>
          <div className='marketing-v5-capability-grid'>
            {FEATURES.map(({ description, icon: Icon, label }) => (
              <article data-motion-item key={label}>
                <Icon aria-hidden='true' />
                <h3>{gt(label)}</h3>
                <p>{gt(description)}</p>
              </article>
            ))}
          </div>
        </section>

        <ThemeGallery gt={gt} />

        <section className='marketing-v5-product-grid' data-motion-reveal>
          <article className='marketing-v5-product-card marketing-v5-product-card--wide' data-motion-item>
            <h2><T>See the system as designed work.</T></h2>
            <p>
              <T>Fonts, color, logo family, product surfaces, and motion resolve into a composed board.</T>
            </p>
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

        <section className='marketing-v5-agents' data-motion-reveal id='agents'>
          <div className='marketing-v5-agents-copy' data-motion-item>
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
          </div>
          <AgentPanel />
        </section>

        <footer className='marketing-v5-footer' data-motion-footer>
          <div className='marketing-v5-footer-field' aria-hidden='true'>
            <i /><i /><i />
          </div>
          <div className='marketing-v5-footer-top' data-motion-reveal>
            <div data-motion-item>
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
    </MarketingThemeShell>
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

function SectionHeading({ children, title }: { children: ReactNode; title: string }) {
  return (
    <div className='marketing-v5-section-heading'>
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}

function ProductFrame({
  alt,
  darkSrc,
  label,
  priority = false,
  src,
  themeLabel = 'Light / Studio',
}: {
  alt: string;
  darkSrc?: string;
  label: string;
  priority?: boolean;
  src: string;
  themeLabel?: string;
}) {
  return (
    <figure className={`marketing-v5-studio-frame${darkSrc ? ' marketing-v5-studio-frame--adaptive' : ''}`}>
      <figcaption>
        <span><i /><i /><i />{label}</span>
        <small className='marketing-v5-studio-label marketing-v5-studio-label--light'>{themeLabel}</small>
        {darkSrc ? <small className='marketing-v5-studio-label marketing-v5-studio-label--dark'>Dark / Studio</small> : null}
      </figcaption>
      <div>
        <Image alt={alt} className='marketing-v5-studio-shot marketing-v5-studio-shot--light' fill priority={priority} sizes='(max-width: 900px) 92vw, 76vw' src={src} />
        {darkSrc ? <Image alt='' aria-hidden='true' className='marketing-v5-studio-shot marketing-v5-studio-shot--dark' fill priority={priority} sizes='(max-width: 900px) 92vw, 76vw' src={darkSrc} /> : null}
      </div>
    </figure>
  );
}

function ThemeGallery({ gt }: { gt: Awaited<ReturnType<typeof getGT>> }) {
  return (
    <section className='marketing-v5-theme-gallery' data-motion-reveal id='themes'>
      <div className='marketing-v5-theme-gallery-copy' data-motion-item>
        <h2><T>The same working Studio, in both modes.</T></h2>
        <p><T>Light and dark appearance changes the workspace chrome while the brand artifact remains accurate.</T></p>
      </div>
      <div className='marketing-v5-theme-gallery-grid'>
        <div data-motion-item>
          <ProductFrame alt={gt('Glyphfield Studio moodboard in light mode')} label='Moodboard / Light' src='/screenshots/studio-moodboard-light-2026.png' />
        </div>
        <div data-motion-item>
          <ProductFrame alt={gt('Glyphfield Studio moodboard in dark mode')} label='Moodboard / Dark' src='/screenshots/studio-moodboard-dark-2026.png' themeLabel='Dark / Studio' />
        </div>
      </div>
    </section>
  );
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
