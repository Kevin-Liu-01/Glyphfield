import Image from 'next/image';
import Link from 'next/link';
import { T } from 'gt-next';
import { getGT } from 'gt-next/server';
import {
  ArrowRight,
  Bot,
  BookOpen,
  Braces,
  Film,
  Github,
  Layers3,
  Palette,
  ScanLine,
  Sparkles,
} from 'lucide-react';

import type { ReactNode } from 'react';

import AnimationStudio from '@/components/AnimationStudio';
import MarketingArcField from '@/components/MarketingArcField';
import MarketingCopyPromptButton from '@/components/MarketingCopyPromptButton';
import MarketingMotion from '@/components/MarketingMotion';
import { MarketingThemeShell, MarketingThemeToggle } from '@/components/MarketingTheme';
import { GT_BRAND_IDENTITY } from '@/lib/brandIdentity';
import { DEFAULT_LIVE_MATERIAL_SETTINGS } from '@/lib/liveMaterials';
import { PRODUCT_BRAND } from '@/lib/productBrand';

const BRAND_LOGOS = [
  { id: 'gt', name: 'General Translation', src: '/brands/gt/logos/mark-black.svg' },
  { id: 'ramp', name: 'Ramp', src: '/brands/ramp/logos/wordmark-slate.svg' },
  { id: 'mintlify', name: 'Mintlify', src: '/brands/mintlify/logos/wordmark.svg' },
  { id: 'tailwind', name: 'Tailwind CSS', src: '/brands/tailwind/logos/wordmark.svg' },
  { id: 'viteplus', name: 'Vite+', src: '/brands/viteplus/logos/wordmark-dark.svg' },
  { id: 'stripe', name: 'Stripe', src: '/brands/stripe/logos/wordmark-slate.svg' },
  { id: 'cloudflare', name: 'Cloudflare', src: '/brands/cloudflare/logos/wordmark.svg' },
] as const;

const GLYPH_FIELD_ROWS = [
  'GLYPHFIELD GLYPHFIELD',
  'GLYPH',
  'GLYPH',
  'GLYPH      FIELDGLYPH',
  'GLYPH           FIELD',
  'GLYPHFIELD GLYPHFIELD',
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

const OPEN_SOURCE_FIELD_SETTINGS = {
  ...DEFAULT_LIVE_MATERIAL_SETTINGS,
  amplitude: 4.5,
  brightness: 1.18,
  colorA: '#0A0A0B',
  colorB: '#FFFFFF',
  colorC: '#9A86FF',
  density: 1.18,
  detail: 5.4,
  frequency: 4.8,
  grain: 20,
  speed: 0.12,
  strength: 0.56,
};

const FEATURES = [
  {
    description: 'Logo families, source assets, fonts, color roles, voice, and layout rules stay connected.',
    image: '/screenshots/studio-gt-identity-2026.png',
    icon: Palette,
    label: 'Identity source',
  },
  {
    description: 'Compose moodboards, email, decks, product UI, editorial graphics, and physical pieces.',
    image: '/screenshots/studio-gt-elements-2026.png',
    icon: Layers3,
    label: 'Brand applications',
  },
  {
    description: 'Morph text, logos, images, and live backgrounds with editable curves and deterministic timing.',
    image: '/screenshots/studio-gt-animation-2026.png',
    icon: Film,
    label: 'Motion system',
  },
  {
    description: 'Use shader materials, grain, dither, gradients, grids, and image treatments behind any mark.',
    image: '/screenshots/studio-gt-material-lab-2026.png',
    icon: Sparkles,
    label: 'Material lab',
  },
  {
    description: 'Select, drag, resize, layer, zoom, and export from a direct-manipulation canvas.',
    image: '/screenshots/studio-gt-background-lab-2026.png',
    icon: ScanLine,
    label: 'Editable canvas',
  },
  {
    description: 'Agents discover the same identities and tools, then generate stable SVG and browser artifacts.',
    image: '/screenshots/studio-gt-components-2026.png',
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
        <span className='marketing-v5-header-triangles' aria-hidden='true'><i /><i /></span>
        <Link className='marketing-v5-brand' href='/' aria-label={gt('Glyphfield home')}>
          <Image alt='' aria-hidden='true' height={30} priority src={PRODUCT_BRAND.markPath} width={30} />
          <span>{PRODUCT_BRAND.name}</span>
        </Link>
        <nav className='marketing-v5-nav' aria-label={gt('Main navigation')}>
          <a href='#studio'><T>Studio</T></a>
          <a href='#agents'><T>Agents</T></a>
          <a href='#open-source'><T>Open source</T></a>
        </nav>
        <div className='marketing-v5-header-actions'>
          <MarketingThemeToggle />
          <a
            aria-label={gt('Open Glyphfield on GitHub')}
            className='marketing-v5-header-icon-link'
            href='https://github.com/Kevin-Liu-01/Glyphfield'
            rel='noreferrer'
            target='_blank'
            title={gt('GitHub')}
          >
            <Github aria-hidden='true' />
          </a>
          <Link
            aria-label={gt('Open documentation')}
            className='marketing-v5-header-icon-link'
            href='/docs'
            title={gt('Docs')}
          >
            <BookOpen aria-hidden='true' />
          </Link>
          <Link className='marketing-v5-primary-link' href='/studio'>
            <T>Open Studio</T>
            <ArrowRight aria-hidden='true' />
          </Link>
        </div>
      </header>

      <div id='main'>
        <section className='marketing-v5-hero marketing-v7-corner-frame' aria-labelledby='hero-title'>
          <FrameTriangles />
          <div className='marketing-v5-hero-copy' data-motion-reveal>
            <Image
              alt=''
              aria-hidden='true'
              className='marketing-v5-hero-mark'
              data-motion-item
              height={48}
              priority
              src={PRODUCT_BRAND.markPath}
              width={48}
            />
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
              <Link
                className='marketing-v5-primary-link marketing-v5-primary-link--large marketing-v5-primary-link--iridescent'
                href='/studio'
              >
                <T>Open Glyphfield</T>
                <ArrowRight aria-hidden='true' />
              </Link>
              <Link className='marketing-v5-secondary-link' href='/docs/getting-started'>
                <T>Docs</T>
              </Link>
              <MarketingCopyPromptButton />
            </div>
            <p className='marketing-v5-hero-license' data-motion-item>
              <T>Free and open source under the MIT License.</T>
            </p>
          </div>

          <div className='marketing-v5-hero-field' data-motion-reveal>
            <MarketingArcField materialId='shaders-spectral-bloom' settings={HERO_FIELD_SETTINGS} />
            <div className='marketing-v5-product-window' data-motion-item>
              <ProductFrame
                alt={gt('Glyphfield Studio showing the General Translation identity source')}
                label='Brand identity / General Translation'
                priority
                src='/screenshots/studio-gt-identity-2026.png'
                themeLabel='Dark / Studio'
              />
            </div>
          </div>
        </section>

        <LogoRail gt={gt} />
        <SectionSpacer />

        <section className='marketing-v5-composer marketing-v7-corner-frame' data-motion-reveal id='studio'>
          <FrameTriangles />
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

        <SectionSpacer />

        <section className='marketing-v5-capabilities marketing-v7-corner-frame' data-motion-reveal>
          <FrameTriangles />
          <SectionHeading title='Foundations in. Useful artifacts out.'>
            <T>
              Every tool inherits the active identity, preserves the right aspect ratio, and exposes
              only the controls needed for the artifact it makes.
            </T>
          </SectionHeading>
          <div className='marketing-v5-capability-grid'>
            {FEATURES.map(({ description, icon: Icon, image, label }) => (
              <article data-motion-item key={label}>
                <Icon aria-hidden='true' />
                <div className='marketing-v5-capability-copy'>
                  <h3>{gt(label)}</h3>
                  <p>{gt(description)}</p>
                </div>
                <div className='marketing-v5-capability-preview' aria-hidden='true'>
                  <Image alt='' fill sizes='(max-width: 760px) 54vw, (max-width: 1100px) 38vw, 18vw' src={image} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <ThemeGallery gt={gt} />

        <section className='marketing-v5-product-grid marketing-v7-corner-frame' data-motion-reveal>
          <FrameTriangles />
          <article className='marketing-v5-product-card marketing-v5-product-card--wide' data-motion-item>
            <h2><T>Build the brand where it will live.</T></h2>
            <p>
              <T>Email, product surfaces, editorial graphics, and physical pieces inherit the same source identity.</T>
            </p>
            <div className='marketing-v5-product-card-image'>
              <Image
                alt={gt('General Translation welcome email open in the Glyphfield brand-elements editor')}
                fill
                sizes='(max-width: 800px) 96vw, 64vw'
                src='/screenshots/studio-gt-elements-2026.png'
              />
            </div>
          </article>
          <article className='marketing-v5-product-card marketing-v5-product-card--dark' data-motion-item>
            <h2><T>Design the mark and its motion together.</T></h2>
            <p><T>Apply live type, material, depth, and timing to a mark, then reuse the result across every export.</T></p>
            <div className='marketing-v5-product-card-image'>
              <Image
                alt={gt('A General Translation mark surrounded by an animated Glyphfield letter field')}
                fill
                sizes='(max-width: 800px) 96vw, 36vw'
                src='/screenshots/studio-glyph-field-lab-2026.png'
              />
            </div>
          </article>
        </section>

        <SectionSpacer dark />

        <section className='marketing-v5-agents marketing-v7-corner-frame' data-motion-reveal id='agents'>
          <FrameTriangles dark />
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

        <SectionSpacer dark />

        <section className='marketing-v7-open-source marketing-v7-corner-frame' data-motion-reveal id='open-source'>
          <FrameTriangles dark />
          <MarketingArcField
            className='marketing-v8-open-source-glyph-field'
            materialId='glyphfield-glyph-field'
            settings={OPEN_SOURCE_FIELD_SETTINGS}
          />
          <div className='marketing-v8-open-source-letterform' aria-hidden='true'>
            {GLYPH_FIELD_ROWS.map((row, index) => <span key={`${index}-${row}`}>{row}</span>)}
          </div>
          <div className='marketing-v7-open-source-copy' data-motion-item>
            <h2><T>Free, open source, and built to extend.</T></h2>
            <p>
              <T>
                Read the source, fork the Studio, add a tool, or connect an agent. Glyphfield is MIT
                licensed and the artifact format is documented.
              </T>
            </p>
            <div className='marketing-v7-social-links'>
              <a href='https://github.com/Kevin-Liu-01/Glyphfield' rel='noreferrer' target='_blank'>
                <Github aria-hidden='true' />
                <T>View on GitHub</T>
                <ArrowRight aria-hidden='true' />
              </a>
              <a href='https://x.com/intent/post?text=Glyphfield%20is%20an%20open-source%20brand%20studio.&url=https%3A%2F%2Fgithub.com%2FKevin-Liu-01%2FGlyphfield' rel='noreferrer' target='_blank'>
                <XSocialIcon />
                <T>Share on X</T>
                <ArrowRight aria-hidden='true' />
              </a>
            </div>
          </div>
          <div className='marketing-v7-open-source-panel' data-motion-item>
            <Image alt='' aria-hidden='true' height={64} src={PRODUCT_BRAND.markPath} width={64} />
            <div className='marketing-v7-open-source-meta'>
              <strong>MIT</strong>
              <span><T>Source, agent API, and artifact model included.</T></span>
            </div>
          </div>
        </section>

        <SectionSpacer dark />

        <footer className='marketing-v5-footer marketing-v7-corner-frame' data-motion-footer>
          <FrameTriangles dark />
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
              <a href='https://github.com/Kevin-Liu-01/Glyphfield' rel='noreferrer' target='_blank'><T>GitHub</T> ↗</a>
              <a href='https://x.com/intent/post?text=Glyphfield%20is%20an%20open-source%20brand%20studio.&url=https%3A%2F%2Fgithub.com%2FKevin-Liu-01%2FGlyphfield' rel='noreferrer' target='_blank'>X ↗</a>
              <Link href='/llms.txt'>llms.txt ↗</Link>
            </div>
          </div>
        </footer>
      </div>
    </MarketingThemeShell>
  );
}

function SectionSpacer({ dark = false }: { dark?: boolean }) {
  return (
    <div className={`marketing-v5-spacer${dark ? ' marketing-v5-spacer--dark' : ''}`} aria-hidden='true' />
  );
}

function LogoRail({ gt }: { gt: Awaited<ReturnType<typeof getGT>> }) {
  return (
    <section className='marketing-v5-logo-rail marketing-v7-corner-frame' aria-labelledby='example-identities'>
      <FrameTriangles />
      <Link className='marketing-v5-logo-rail-heading' href='/studio?folder=examples'>
        <span id='example-identities'><T>View brands in the Studio</T></span>
        <ArrowRight aria-hidden='true' />
      </Link>
      <ul>
        {BRAND_LOGOS.map(({ id, name, src }) => (
          <li key={id}>
            <Link
              aria-label={gt(`Open ${name} in the Studio`)}
              data-brand-id={id}
              data-testid={`brand-launch-${id}`}
              href={`/studio?project=${id}`}
              title={gt(`Open ${name} in the Studio`)}
            >
              <Image
                alt=''
                aria-hidden='true'
                className={id === 'gt' ? 'marketing-v5-logo-rail-gt' : undefined}
                height={id === 'gt' ? 64 : 34}
                src={src}
                width={id === 'gt' ? 64 : 116}
              />
            </Link>
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

function FrameTriangles({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`marketing-v6-triangles${dark ? ' marketing-v6-triangles--dark' : ''}`} aria-hidden='true'>
      <i /><i /><i /><i />
    </span>
  );
}

function XSocialIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 24 24'>
      <path d='M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.966 6.817H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z' />
    </svg>
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
    <section className='marketing-v5-theme-gallery marketing-v7-corner-frame' data-motion-reveal id='themes'>
      <FrameTriangles />
      <div className='marketing-v5-theme-gallery-copy' data-motion-item>
        <h2><T>Current Studio. Real brand materials.</T></h2>
        <p>
          <T>
            See identity settings and an art-directed moodboard inside the same working workspace.
          </T>
        </p>
      </div>
      <div className='marketing-v5-theme-gallery-grid'>
        <div data-motion-item>
          <ProductFrame
            alt={gt('General Translation identity settings in Glyphfield Studio')}
            darkSrc='/screenshots/studio-gt-identity-2026.png'
            label='Brand identity / General Translation'
            src='/screenshots/studio-gt-identity-light-2026.png'
          />
        </div>
        <div data-motion-item>
          <ProductFrame
            alt={gt('Stripe moodboard in Glyphfield Studio')}
            darkSrc='/screenshots/studio-stripe-moodboard-dark-2026.png'
            label='Moodboard / Stripe'
            src='/screenshots/studio-stripe-moodboard-light-2026.png'
          />
        </div>
      </div>
    </section>
  );
}

function AgentPanel() {
  return (
    <div className='marketing-v5-agent-panel marketing-v7-corner-frame' data-motion-item>
      <FrameTriangles dark />
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
