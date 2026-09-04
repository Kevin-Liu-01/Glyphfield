import Image from 'next/image';
import Link from 'next/link';
import { T } from 'gt-next';
import { getGT } from 'gt-next/server';
import {
  ArrowRight,
  Bot,
  BookOpen,
  Braces,
  Component,
  Film,
  Layers3,
  MoveDiagonal2,
  Palette,
  ScanLine,
  Sparkles,
} from '@/components/ui/SolidIcons';

import type { ReactNode } from 'react';

import MarketingArcField from '@/components/MarketingArcField';
import MarketingAnimationDemo from '@/components/MarketingAnimationDemo';
import MarketingAgentControlLab from '@/components/MarketingAgentControlLab';
import MarketingCopyPromptButton from '@/components/MarketingCopyPromptButton';
import GitHubStarButton from '@/components/GitHubStarButton';
import MitLogo from '@/components/MitLogo';
import MarketingMotion from '@/components/MarketingMotion';
import MarketingOpenSourceWorkbench from '@/components/MarketingOpenSourceWorkbench';
import MarketingShaderMark from '@/components/MarketingShaderMark';
import MarketingShaderText from '@/components/MarketingShaderText';
import MarketingStudioSearch from '@/components/MarketingStudioSearch';
import MarketingStudioLink from '@/components/MarketingStudioLink';
import {
  MarketingApplicationsDemo,
  MarketingIdentityDemo,
  MarketingMaterialDemo,
  MarketingMotionDemo,
} from '@/components/MarketingStudioShowcaseDemos';
import { MarketingThemeShell, MarketingThemeToggle } from '@/components/MarketingTheme';
import { DEFAULT_LIVE_MATERIAL_SETTINGS, LIVE_MATERIAL_OPTIONS } from '@/lib/liveMaterials';
import { PRODUCT_BRAND } from '@/lib/productBrand';
import { HOME_FAQS, homeJsonLd, serializeJsonLd } from '@/lib/seo';
import { SHADER_LIBRARY_SCENES } from '@/lib/shaderLab';
import { STUDIO_TOOLS } from '@/lib/studioCatalog';

const BRAND_LOGOS = [
  { darkSurfaceSrc: '/brands/gt/logos/mark-white.svg', id: 'gt', lightSurfaceSrc: '/brands/gt/logos/mark-black.svg', name: 'General Translation' },
  { darkSurfaceSrc: '/brands/ramp/logos/mark-white.svg', id: 'ramp', lightSurfaceSrc: '/brands/ramp/logos/mark-slate.svg', name: 'Ramp' },
  { darkSurfaceSrc: '/brands/mintlify/logos/mark-light.svg', id: 'mintlify', lightSurfaceSrc: '/brands/mintlify/logos/mark.svg', name: 'Mintlify' },
  { darkSurfaceSrc: '/brands/tailwind/logos/mark.svg', id: 'tailwind', lightSurfaceSrc: '/brands/tailwind/logos/mark.svg', name: 'Tailwind CSS' },
  { darkSurfaceSrc: '/brands/viteplus/logos/mark.svg', id: 'viteplus', lightSurfaceSrc: '/brands/viteplus/logos/mark.svg', name: 'Vite+' },
  { darkSurfaceSrc: '/brands/stripe/logos/wordmark-white.svg', id: 'stripe', lightSurfaceSrc: '/brands/stripe/logos/wordmark-blurple.svg', name: 'Stripe' },
  { darkSurfaceSrc: '/brands/cloudflare/logos/mark-white.svg', id: 'cloudflare', lightSurfaceSrc: '/brands/cloudflare/logos/mark.svg', name: 'Cloudflare' },
] as const;

const GLYPH_FIELD_ROWS = [
  'GLYPHFIELD GLYPHFIELD',
  'GLYPH',
  'GLYPH',
  'GLYPH      FIELDGLYPH',
  'GLYPH           FIELD',
  'GLYPHFIELD GLYPHFIELD',
] as const;

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

const OPEN_SOURCE_PANEL_DITHERING_WARP_SETTINGS = {
  ...DEFAULT_LIVE_MATERIAL_SETTINGS,
  amplitude: 3.4,
  brightness: 0.96,
  colorA: '#401B45',
  colorB: '#FF9B75',
  colorC: '#FFD08F',
  grain: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: -12,
  speed: 0.26,
};

const AGENT_STAT_SHADER_SETTINGS = [
  {
    materialId: 'paper-dithering-sine-wave',
    settings: {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      amplitude: 2.2,
      brightness: 0.94,
      colorA: '#173E6B',
      colorB: '#B7EBFF',
      colorC: '#B7E5FF',
      grain: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: -3,
      speed: 0.36,
    },
  },
  {
    materialId: 'paper-dithering-warp',
    settings: {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      amplitude: 3,
      brightness: 0.92,
      colorA: '#4C206D',
      colorB: '#E8B4FF',
      colorC: '#F1C0FF',
      grain: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 8,
      speed: 0.28,
    },
  },
  {
    materialId: 'paper-dithering-ripple',
    settings: {
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      amplitude: 2.8,
      brightness: 0.94,
      colorA: '#174C3E',
      colorB: '#C6F29A',
      colorC: '#D9F2A9',
      grain: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 4,
      speed: 0.32,
    },
  },
] as const;

const FOOTER_DITHERING_SWIRL_SETTINGS = {
  ...DEFAULT_LIVE_MATERIAL_SETTINGS,
  amplitude: 5.2,
  brightness: 1.02,
  colorA: '#201046',
  colorB: '#C8C0FF',
  colorC: '#7BFFD9',
  density: 1.1,
  detail: 4.4,
  frequency: 6.8,
  grain: 0,
  rotationX: 0,
  rotationY: 0,
  rotationZ: -8,
  speed: 0.32,
  strength: 0.48,
};

const FEATURES = [
  {
    description: 'Logo families, source assets, fonts, color roles, voice, and layout rules stay connected.',
    darkImage: '/screenshots/studio-gt-moodboard-dark-2026.png',
    icon: Palette,
    label: 'Identity source',
    lightImage: '/screenshots/studio-gt-moodboard-light-2026.png',
  },
  {
    description: 'Compose moodboards, email, decks, product UI, editorial graphics, and physical pieces.',
    darkImage: '/screenshots/studio-gt-brand-book-dark-2026.png',
    icon: Layers3,
    label: 'Brand applications',
    lightImage: '/screenshots/studio-gt-brand-book-light-2026.png',
  },
  {
    description: 'Morph text, logos, images, and live backgrounds with editable curves and deterministic timing.',
    darkImage: '/screenshots/studio-gt-animation-dark-2026.png',
    icon: Film,
    label: 'Motion system',
    lightImage: '/screenshots/studio-gt-animation-light-2026.png',
  },
  {
    description: 'Use shader materials, grain, dither, gradients, grids, and image treatments behind any mark.',
    darkImage: '/screenshots/studio-gt-design-lab-dark-2026.png',
    icon: Sparkles,
    label: 'Material lab',
    lightImage: '/screenshots/studio-gt-design-lab-light-2026.png',
  },
  {
    description: 'Select, drag, resize, layer, add sticker treatments, and export from a direct-manipulation canvas.',
    darkImage: '/screenshots/studio-gt-design-lab-dark-2026.png',
    icon: ScanLine,
    label: 'Editable canvas',
    lightImage: '/screenshots/studio-gt-design-lab-light-2026.png',
  },
  {
    description: 'Agents discover the same identities and tools, then generate stable SVG and browser artifacts.',
    darkImage: '/screenshots/studio-gt-components-dark-2026.png',
    icon: Bot,
    label: 'Agent interface',
    lightImage: '/screenshots/studio-gt-components-light-2026.png',
  },
] as const;

export default async function HomePage() {
  const gt = await getGT();

  return (
    <MarketingThemeShell>
      <script
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(homeJsonLd()) }}
        type='application/ld+json'
      />
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
          <MarketingStudioSearch />
          <MarketingThemeToggle />
          <GitHubStarButton className='marketing-v5-header-icon-link' />
          <Link
            aria-label={gt('Open documentation')}
            className='marketing-v5-header-icon-link'
            href='/docs'
            title={gt('Docs')}
          >
            <BookOpen aria-hidden='true' />
          </Link>
          <MarketingStudioLink className='marketing-v5-primary-link'>
            <T>Open Studio</T>
            <ArrowRight aria-hidden='true' />
          </MarketingStudioLink>
        </div>
      </header>

      <div id='main'>
        <section className='marketing-v5-hero marketing-v7-corner-frame' aria-labelledby='hero-title'>
          <FrameTriangles />
          <div className='marketing-v5-hero-copy' data-motion-reveal>
            <MarketingShaderMark
              materialId={SHADER_LIBRARY_SCENES.heroMark.materialId}
              settings={SHADER_LIBRARY_SCENES.heroMark.settings}
            />
            <h1 id='hero-title'>
              <T>One studio for</T>{' '}
              <MarketingShaderText text={gt('the whole brand.')} />
            </h1>
            <p data-motion-item>
              <T>
                Build identity systems, motion, graphics, and product-ready artifacts in one
                connected workspace that people and agents can use together.
              </T>
            </p>
            <div className='marketing-v5-actions' data-motion-item>
              <MarketingStudioLink
                className='marketing-v5-primary-link marketing-v5-primary-link--large marketing-v5-primary-link--iridescent'
              >
                <T>Open Glyphfield</T>
                <ArrowRight aria-hidden='true' />
              </MarketingStudioLink>
              <Link className='marketing-v5-secondary-link' href='/docs/getting-started'>
                <T>Docs</T>
              </Link>
              <MarketingCopyPromptButton />
            </div>
            <p className='marketing-v5-hero-license' data-motion-item>
              <MitLogo />
              <T>Free and open source under the MIT License.</T>
            </p>
          </div>

          <div className='marketing-v5-hero-field' data-motion-reveal>
            <MarketingArcField
              className='marketing-v5-hero-grain-gradient'
              materialId={SHADER_LIBRARY_SCENES.heroField.materialId}
              maxPixelCount={2_000_000}
              renderScale={1}
              settings={SHADER_LIBRARY_SCENES.heroField.settings}
            />
            <div className='marketing-v5-product-window marketing-v5-animation-demo marketing-v5-hero-studio' data-motion-item>
              <MarketingAnimationDemo eager />
            </div>
          </div>
        </section>

        <LogoRail gt={gt} />
        <SectionSpacer />

        <section className='marketing-v5-capabilities marketing-v7-corner-frame' data-motion-reveal id='studio'>
          <FrameTriangles />
          <SectionHeading title='Foundations in. Useful artifacts out.'>
            <T>
              Every tool inherits the active identity, preserves the right aspect ratio, and exposes
              only the controls needed for the artifact it makes.
            </T>
          </SectionHeading>
          <div className='marketing-v5-capability-grid'>
            {FEATURES.map(({ darkImage, description, icon: Icon, label, lightImage }) => (
              <article data-motion-item key={label}>
                <Icon aria-hidden='true' />
                <div className='marketing-v5-capability-copy'>
                  <h3>{gt(label)}</h3>
                  <p>{gt(description)}</p>
                </div>
                <div className='marketing-v5-capability-preview' aria-hidden='true'>
                  <Image alt='' className='marketing-v5-theme-shot marketing-v5-theme-shot--light' fill sizes='(max-width: 760px) 54vw, (max-width: 1100px) 38vw, 18vw' src={lightImage} />
                  <Image alt='' className='marketing-v5-theme-shot marketing-v5-theme-shot--dark' fill sizes='(max-width: 760px) 54vw, (max-width: 1100px) 38vw, 18vw' src={darkImage} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <ThemeGallery />

        <section className='marketing-v5-product-grid marketing-v7-corner-frame' data-motion-reveal>
          <FrameTriangles />
          <SwissGrid />
          <article className='marketing-v5-product-card marketing-v5-product-card--wide' data-motion-item>
            <span className='marketing-v13-card-index'>03.1 / BRAND APPLICATIONS</span>
            <h2><T>Build the brand where it will live.</T></h2>
            <p>
              <T>Email, product surfaces, editorial graphics, and physical pieces inherit the same source identity.</T>
            </p>
            <div className='marketing-v5-product-card-image marketing-v5-product-card-image--artifacts'>
              <MarketingApplicationsDemo />
            </div>
          </article>
          <article className='marketing-v5-product-card marketing-v5-product-card--dark' data-motion-item>
            <span className='marketing-v13-card-index'>03.2 / MOTION SYSTEM</span>
            <h2 className='marketing-v5-product-card-title--motion'>
              <span><T>Design the mark</T></span>{' '}
              <span><T>and its motion together.</T></span>
            </h2>
            <p><T>Apply live type, material, depth, and timing to a mark, then reuse the result across every export.</T></p>
            <div className='marketing-v5-product-card-image marketing-v5-product-card-image--animation'>
              <MarketingMotionDemo />
            </div>
          </article>
        </section>

        <SectionSpacer />

        <section className='marketing-v5-agents marketing-v7-corner-frame' data-motion-reveal id='agents'>
          <FrameTriangles />
          <SwissGrid />
          <div className='marketing-v5-agents-copy' data-motion-item>
            <span className='marketing-v13-section-index'>04 / AGENT CONTRACT</span>
            <h2 className='marketing-v5-agent-title'>
              <span><T>Plug the system</T></span>{' '}
              <span><T>into any agent.</T></span>
            </h2>
            <p>
              <T>
                Tune the identity visually, then hand an agent the exact same typed values. Every
                control maps directly to one portable generation contract.
              </T>
            </p>
            <div className='marketing-v5-agent-stats' aria-label={gt('Agent API coverage')}>
              <div>
                <MarketingArcField
                  className='marketing-v5-agent-stat-shader'
                  materialId={AGENT_STAT_SHADER_SETTINGS[0].materialId}
                  paperShaderOverrides={{ size: 2.6 }}
                  settings={AGENT_STAT_SHADER_SETTINGS[0].settings}
                />
                <strong>{STUDIO_TOOLS.length}</strong>
                <span className='marketing-v5-agent-stat-label'>
                  <Component aria-hidden='true' />
                  <T>Lab plugins</T>
                </span>
                <code>/api/labs</code>
              </div>
              <div>
                <MarketingArcField
                  className='marketing-v5-agent-stat-shader'
                  materialId={AGENT_STAT_SHADER_SETTINGS[1].materialId}
                  settings={AGENT_STAT_SHADER_SETTINGS[1].settings}
                />
                <strong>{LIVE_MATERIAL_OPTIONS.length}</strong>
                <span className='marketing-v5-agent-stat-label'>
                  <Sparkles aria-hidden='true' />
                  <T>Live shaders</T>
                </span>
                <code>/api/materials</code>
              </div>
              <div>
                <MarketingArcField
                  className='marketing-v5-agent-stat-shader'
                  materialId={AGENT_STAT_SHADER_SETTINGS[2].materialId}
                  settings={AGENT_STAT_SHADER_SETTINGS[2].settings}
                />
                <strong>1</strong>
                <span className='marketing-v5-agent-stat-label'>
                  <Braces aria-hidden='true' />
                  <T>Shared contract</T>
                </span>
                <code>/api/agent</code>
              </div>
            </div>
            <div className='marketing-v5-agent-links'>
              <Link className='marketing-v5-primary-link marketing-v5-primary-link--inverse' href='/docs/agents/connect'>
                <T>Connect an agent</T><ArrowRight aria-hidden='true' />
              </Link>
              <Link href='/api/agent'><T>Manifest</T> ↗</Link>
              <Link href='/openapi.json'>OpenAPI ↗</Link>
            </div>
          </div>
          <div className='marketing-v5-agent-integration' data-motion-item>
            <MarketingAgentControlLab />
          </div>
        </section>

        <section
          aria-labelledby='frequently-asked-questions'
          className='marketing-v10-faq marketing-v7-corner-frame'
          data-motion-reveal
        >
          <FrameTriangles />
          <SwissGrid />
          <header data-motion-item>
            <span>05 / <T>Glyphfield, answered</T></span>
            <div className='marketing-v13-faq-heading'>
              <h2 id='frequently-asked-questions'><T>Frequently asked questions</T></h2>
              <StudioSelectionFrame
                className='marketing-v13-faq-selection'
                label='TEXT 05'
                meta='W 288  /  AUTO HEIGHT'
              />
            </div>
            <p>
              <T>
                The short version of what Glyphfield is, what it makes, and how people and agents
                work from the same brand system.
              </T>
            </p>
          </header>
          <dl>
            {HOME_FAQS.map(({ answer, question }, index) => (
              <div data-motion-item key={question}>
                <dt><span>{String(index + 1).padStart(2, '0')}</span>{gt(question)}</dt>
                <dd>{gt(answer)}</dd>
              </div>
            ))}
          </dl>
        </section>

        <SectionSpacer />

        <section className='marketing-v7-open-source marketing-v7-corner-frame' data-motion-reveal id='open-source'>
          <FrameTriangles dark />
          <SwissGrid dark />
          <MarketingArcField
            className='marketing-v8-open-source-glyph-field'
            frameRate={14}
            materialId='glyphfield-glyph-field'
            settings={OPEN_SOURCE_FIELD_SETTINGS}
          />
          <div className='marketing-v8-open-source-letterform' aria-hidden='true'>
            {GLYPH_FIELD_ROWS.map((row, index) => <span key={`${index}-${row}`}>{row}</span>)}
          </div>
          <div className='marketing-v7-open-source-copy' data-motion-item>
            <span className='marketing-v13-section-index'>06 / OPEN SYSTEM</span>
            <h2><T>Free, open source, and built to extend.</T></h2>
            <p>
              <T>
                Read the source, fork the Studio, add a tool, or connect an agent. Glyphfield is MIT
                licensed and the artifact format is documented.
              </T>
            </p>
            <div className='marketing-v7-social-links'>
              <GitHubStarButton
                className='marketing-v7-github-star-button'
                label={<T>View on GitHub</T>}
              />
              <a href='https://x.com/intent/post?text=Glyphfield%20is%20an%20open-source%20brand%20studio.&url=https%3A%2F%2Fgithub.com%2FKevin-Liu-01%2FGlyphfield' rel='noreferrer' target='_blank'>
                <XSocialIcon />
                <T>Share on X</T>
                <ArrowRight aria-hidden='true' />
              </a>
            </div>
          </div>
          <div className='marketing-v14-open-source-workbench-shell' data-motion-item>
            <MarketingOpenSourceWorkbench
              markPath={PRODUCT_BRAND.markPath}
              materialId='paper-dithering-warp'
              settings={OPEN_SOURCE_PANEL_DITHERING_WARP_SETTINGS}
            />
          </div>
        </section>

        <SectionSpacer dark />

        <footer className='marketing-v5-footer marketing-v7-corner-frame marketing-v12-footer' data-motion-footer>
          <FrameTriangles dark />
          <MarketingArcField
            className='marketing-v12-footer-shader'
            frameRate={18}
            materialId='paper-dithering-swirl'
            maxPixelCount={360_000}
            paperShaderOverrides={{ size: 2.8, type: '4x4' }}
            renderScale={0.72}
            settings={FOOTER_DITHERING_SWIRL_SETTINGS}
          />
          <div className='marketing-v5-footer-top' data-motion-reveal>
            <div data-motion-item>
              <h2><T>Make the field yours.</T></h2>
            </div>
            <MarketingStudioLink className='marketing-v5-primary-link marketing-v5-primary-link--inverse'>
              <T>Open Glyphfield</T><ArrowRight aria-hidden='true' />
            </MarketingStudioLink>
          </div>
          <div className='marketing-v5-footer-wordmark' data-footer-wordmark>GLYPHFIELD</div>
          <div className='marketing-v5-footer-bottom'>
            <span><T>© 2026 Kevin Liu · MIT licensed</T></span>
            <div>
              <MarketingStudioLink><T>Studio</T> ↗</MarketingStudioLink>
              <Link href='/docs'><T>Docs</T> ↗</Link>
              <Link href='/api/catalog'><T>Agent API</T> ↗</Link>
              <a href={PRODUCT_BRAND.repository.url} rel='noreferrer' target='_blank'><T>GitHub</T> ↗</a>
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
        {BRAND_LOGOS.map(({ darkSurfaceSrc, id, lightSurfaceSrc, name }) => (
          <li key={id}>
            <Link
              aria-label={gt(`Open ${name} in the Studio`)}
              data-brand-id={id}
              data-testid={`brand-launch-${id}`}
              href={`/studio?project=${id}`}
              title={gt(`Open ${name} in the Studio`)}
            >
              <span className='marketing-v5-logo-rail-mark' data-brand-id={id}>
                <Image
                  alt=''
                  aria-hidden='true'
                  className='marketing-v5-logo-rail-mark-light-surface'
                  height={64}
                  src={lightSurfaceSrc}
                  width={64}
                />
                <Image
                  alt=''
                  aria-hidden='true'
                  className='marketing-v5-logo-rail-mark-dark-surface'
                  height={64}
                  src={darkSurfaceSrc}
                  width={64}
                />
              </span>
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

function SwissGrid({ dark = false }: { dark?: boolean }) {
  return (
    <span
      aria-hidden='true'
      className={`marketing-v13-swiss-grid${dark ? ' marketing-v13-swiss-grid--dark' : ''}`}
    >
      {Array.from({ length: 11 }, (_, index) => <i key={`column-${index + 1}`} />)}
      <b /><b /><b />
    </span>
  );
}

function StudioSelectionFrame({
  className = '',
  dark = false,
  label,
  meta,
}: {
  className?: string;
  dark?: boolean;
  label: string;
  meta: string;
}) {
  return (
    <span
      aria-hidden='true'
      className={`marketing-v13-selection-frame${dark ? ' marketing-v13-selection-frame--dark' : ''} ${className}`.trim()}
    >
      <span className='marketing-v13-selection-label'>{label}</span>
      <span className='marketing-v13-selection-rotation'><i /></span>
      {Array.from({ length: 7 }, (_, index) => (
        <i className='marketing-v13-selection-handle' key={`handle-${index + 1}`} />
      ))}
      <span className='marketing-v13-selection-corner'><MoveDiagonal2 /></span>
      <small>{meta}</small>
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

function ThemeGallery() {
  return (
    <section className='marketing-v5-theme-gallery marketing-v7-corner-frame' data-motion-reveal id='themes'>
      <FrameTriangles />
      <SwissGrid />
      <div className='marketing-v5-theme-gallery-copy' data-motion-item>
        <span className='marketing-v13-section-index'>02 / LIVE IDENTITY</span>
        <div className='marketing-v13-theme-heading'>
          <h2 className='marketing-v5-theme-gallery-title'>
            <span><T>Current Studio.</T></span>{' '}
            <span><T>Real brand materials.</T></span>
          </h2>
          <StudioSelectionFrame
            className='marketing-v13-theme-selection'
            label='TEXT / DISPLAY'
            meta='X 048  Y 056  W 612'
          />
        </div>
        <div className='marketing-v13-theme-notes'>
          <p>
            <T>
              Tune the identity, compose live materials, and carry the same system into every output.
            </T>
          </p>
        </div>
      </div>
      <div className='marketing-v5-theme-gallery-grid'>
        <div data-motion-item>
          <MarketingIdentityDemo />
        </div>
        <div data-motion-item>
          <MarketingMaterialDemo />
        </div>
      </div>
    </section>
  );
}
