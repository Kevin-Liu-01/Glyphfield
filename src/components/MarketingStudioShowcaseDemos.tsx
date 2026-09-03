'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import StudioRange from '@/components/ui/StudioRange';
import {
  Braces,
  Clock3,
  Grid2X2,
  Image as ImageIcon,
  Layers3,
  Palette,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Type,
} from '@/components/ui/SolidIcons';

type BookSection = 'Color' | 'Foundations' | 'Logo' | 'Typography';
type IdentitySection = 'Color system' | 'Overview' | 'Typography';
type MaterialCard = 'Material' | 'Message' | 'Tokens' | 'Typography';
type MaterialTone = 'mint' | 'mono' | 'violet';
type MotionCurve = 'Material' | 'Snappy' | 'Soft';

const IDENTITY_SECTIONS = [
  { icon: Layers3, label: 'Overview' },
  { icon: Type, label: 'Typography' },
  { icon: Palette, label: 'Color system' },
] as const;

const MATERIAL_TONES = [
  { color: '#111111', id: 'mono', label: 'Mono' },
  { color: '#6b45ee', id: 'violet', label: 'Violet' },
  { color: '#69ddb6', id: 'mint', label: 'Mint' },
] as const;

const IDENTITY_CONTRACTS: Record<IdentitySection, object> = {
  'Color system': {
    colorRoles: { accent: '#6B45EE', ink: '#111111', signal: '#7BFFD9', surface: '#F3F3EF' },
    contrast: 'AAA',
  },
  Overview: {
    assets: 40,
    colors: 8,
    fonts: 4,
    identity: 'General Translation',
  },
  Typography: {
    accent: 'Rasmus Inter',
    body: 'Rasmus Inter',
    display: 'Switzer',
    localeCoverage: 26,
  },
};

const BOOK_SECTION_NOTES: Record<BookSection, string> = {
  Color: 'Core roles and approved pairings stay synchronized across every artifact.',
  Foundations: 'The principles, promise, and strategy behind every brand decision.',
  Logo: 'Primary marks, clear space, scale, and approved usage in one source.',
  Typography: 'Display, body, accent, and multilingual type rules ready for production.',
};

const BOOK_PAGES: Record<BookSection, readonly { dark?: boolean; eyebrow: string; title: string }[]> = {
  Foundations: [
    { dark: true, eyebrow: '01', title: 'Every language. One source.' },
    { eyebrow: '02', title: 'Using this book' },
    { eyebrow: '03', title: 'Table of contents' },
    { dark: true, eyebrow: '04', title: 'Foundations' },
    { eyebrow: '05', title: 'Brand promise' },
    { eyebrow: '06', title: 'Strategy' },
  ],
  Logo: [
    { dark: true, eyebrow: '10', title: 'Logo' },
    { eyebrow: '11', title: 'Primary mark' },
    { eyebrow: '12', title: 'Logo family' },
    { eyebrow: '13', title: 'Clear space' },
    { dark: true, eyebrow: '14', title: 'Small-scale mark' },
    { eyebrow: '15', title: 'Incorrect usage' },
  ],
  Typography: [
    { dark: true, eyebrow: '20', title: 'Typography' },
    { eyebrow: '21', title: 'Display' },
    { eyebrow: '22', title: 'Body' },
    { eyebrow: '23', title: 'Accent' },
    { dark: true, eyebrow: '24', title: 'Type scale' },
    { eyebrow: '25', title: 'Multilingual type' },
  ],
  Color: [
    { dark: true, eyebrow: '30', title: 'Color' },
    { eyebrow: '31', title: 'Core palette' },
    { eyebrow: '32', title: 'Signal violet' },
    { eyebrow: '33', title: 'Functional roles' },
    { dark: true, eyebrow: '34', title: 'Contrast' },
    { eyebrow: '35', title: 'Color pairings' },
  ],
};

const MOTION_FRAMES = ['Welcome', '你好', '환영합니다', 'ようこそ'] as const;

function GtMark({ light = false }: { light?: boolean }) {
  return (
    <Image
      alt=''
      aria-hidden='true'
      height={48}
      src={light ? '/brands/gt/logos/mark-white.svg' : '/brands/gt/logos/mark-black.svg'}
      width={64}
    />
  );
}

function MiniStudioBar({ children, title }: { children?: React.ReactNode; title: string }) {
  return (
    <div className='marketing-mini-studio-bar'>
      <strong>{title}</strong>
      {children ? <div>{children}</div> : null}
    </div>
  );
}

export function MarketingIdentityDemo() {
  const [section, setSection] = useState<IdentitySection>('Overview');
  const [showJson, setShowJson] = useState(false);
  const identityJson = useMemo(() => JSON.stringify(IDENTITY_CONTRACTS[section], null, 2), [section]);

  return (
    <section className='marketing-live-demo marketing-live-identity-workspace' data-section={section}>
      <MiniStudioBar title='Brand identity'>
        <span>General Translation</span>
        <button aria-label='View identity JSON' aria-pressed={showJson} onClick={() => setShowJson((current) => !current)} type='button'><Braces aria-hidden='true' />JSON</button>
      </MiniStudioBar>
      <div className='marketing-mini-identity-body'>
        <nav aria-label='Identity settings'>
          <span>Identity settings</span>
          {IDENTITY_SECTIONS.map(({ icon: Icon, label }) => (
            <button aria-current={section === label ? 'page' : undefined} key={label} onClick={() => setSection(label)} type='button'>
              <Icon aria-hidden='true' />{label}
            </button>
          ))}
        </nav>
        <main>
          <header className='marketing-mini-identity-brand'>
            <div><span><GtMark /></span><p><strong>General Translation</strong><small>Every language. One source.</small></p></div>
            <dl><div><dt>40</dt><dd>Assets</dd></div><div><dt>4</dt><dd>Fonts</dd></div><div><dt>8</dt><dd>Colors</dd></div></dl>
          </header>
          <div className='marketing-mini-identity-preview'>
            <div className='marketing-mini-identity-panel marketing-mini-identity-panel--overview'>
              <section><GtMark light /><strong>Every language.<br />One source.</strong><small>Product language stays connected to code, context, and delivery.</small></section>
              <aside><span>Welcome</span><b>你好</b><span>환영합니다</span><span>ようこそ</span></aside>
            </div>
            <div className='marketing-mini-identity-panel marketing-mini-identity-panel--type'>
              <span>Typography</span><strong>Switzer</strong><small>Display</small><b>Rasmus Inter</b><small>Body / Accent</small>
            </div>
            <div className='marketing-mini-identity-panel marketing-mini-identity-panel--color'>
              <span>Color system</span><div><i /><i /><i /><i /></div><strong>Core roles stay synchronized across every tool.</strong>
            </div>
            <pre className='marketing-mini-identity-json' data-open={showJson ? 'true' : 'false'}><code>{identityJson}</code></pre>
          </div>
        </main>
      </div>
    </section>
  );
}

export function MarketingMaterialDemo() {
  const [tone, setTone] = useState<MaterialTone>('violet');
  const [selectedCard, setSelectedCard] = useState<MaterialCard>('Material');

  return (
    <section className='marketing-live-demo marketing-live-material-demo' data-tone={tone}>
      <div className='marketing-live-material-toolbar'>
        <span><Grid2X2 aria-hidden='true' />Material board <output>{selectedCard}</output></span>
        <div role='group' aria-label='Material color'>
          {MATERIAL_TONES.map(({ color, id, label }) => (
            <button aria-label={label} aria-pressed={tone === id} key={id} onClick={() => setTone(id)} style={{ '--material-swatch': color } as React.CSSProperties} type='button' />
          ))}
        </div>
      </div>
      <div className='marketing-live-material-board'>
        <button aria-pressed={selectedCard === 'Message'} className='marketing-live-material-card marketing-live-material-card--hero' onClick={() => setSelectedCard('Message')} type='button'>
          <span>01 / MESSAGE</span><strong>Language is live.</strong><GtMark light />
        </button>
        <button aria-pressed={selectedCard === 'Material'} className='marketing-live-material-card marketing-live-material-card--shader' onClick={() => setSelectedCard('Material')} type='button'><i /><span>02 / MATERIAL</span></button>
        <button aria-pressed={selectedCard === 'Typography'} className='marketing-live-material-card marketing-live-material-card--type' onClick={() => setSelectedCard('Typography')} type='button'><span>Aa</span><small>Rasmus Inter<br />450 / 0.98</small></button>
        <button aria-label='Color tokens' aria-pressed={selectedCard === 'Tokens'} className='marketing-live-material-card marketing-live-material-card--tokens' onClick={() => setSelectedCard('Tokens')} type='button'><i /><i /><i /><i /></button>
      </div>
    </section>
  );
}

export function MarketingApplicationsDemo() {
  const [section, setSection] = useState<BookSection>('Foundations');
  const [selectedPage, setSelectedPage] = useState(0);
  const pages = BOOK_PAGES[section];
  const selected = pages[selectedPage]!;

  function chooseSection(nextSection: BookSection) {
    setSection(nextSection);
    setSelectedPage(0);
  }

  return (
    <section className='marketing-live-demo marketing-mini-book-workspace' data-book-section={section}>
      <MiniStudioBar title='Brand book'>
        <span>General Translation · 51 pages</span>
        <button aria-label='Overview layout' aria-pressed={section === 'Foundations' && selectedPage === 0} onClick={() => chooseSection('Foundations')} type='button'><Grid2X2 aria-hidden='true' />Overview</button>
      </MiniStudioBar>
      <div className='marketing-mini-book-body'>
        <nav aria-label='Brand book sections'>
          <div><span><GtMark /></span><p><strong>General Translation</strong><small>Brand book / rev. 26</small></p></div>
          {(Object.keys(BOOK_PAGES) as BookSection[]).map((label, index) => (
            <button aria-current={section === label ? 'page' : undefined} key={label} onClick={() => chooseSection(label)} type='button'>
              <span>{index}.0</span>{label}<small>{BOOK_PAGES[label].length.toString().padStart(2, '0')}</small>
            </button>
          ))}
        </nav>
        <main aria-label={`${section} pages`}>
          <article className={selected.dark ? 'is-dark' : undefined} data-page-index={selectedPage}>
            <small>{section.toUpperCase()} / {selected.eyebrow}</small>
            <div className='marketing-mini-book-preview-art'>
              {section === 'Logo' ? <GtMark light={selected.dark} /> : null}
              {section === 'Color' ? <i className={`marketing-mini-book-swatch marketing-mini-book-swatch--${selectedPage}`} /> : null}
              {section === 'Typography' ? <span>Aa</span> : null}
              {section === 'Foundations' ? <GtMark light={selected.dark} /> : null}
            </div>
            <div><strong>{selected.title}</strong><p>{BOOK_SECTION_NOTES[section]}</p></div>
          </article>
          <div className='marketing-mini-book-pages'>
            {pages.map((page, index) => (
              <button aria-label={`Open page ${page.eyebrow}: ${page.title}`} aria-pressed={selectedPage === index} className={page.dark ? 'is-dark' : undefined} key={page.eyebrow} onClick={() => setSelectedPage(index)} type='button'>
                <small>{page.eyebrow}</small>
                {section === 'Logo' && index > 0 ? <GtMark light={page.dark} /> : null}
                {section === 'Color' && index > 0 ? <i className={`marketing-mini-book-swatch marketing-mini-book-swatch--${index}`} /> : null}
                <strong>{page.title}</strong>
              </button>
            ))}
          </div>
        </main>
      </div>
    </section>
  );
}

export function MarketingMotionDemo() {
  const [curve, setCurve] = useState<MotionCurve>('Material');
  const [frame, setFrame] = useState(0);
  const [hold, setHold] = useState(1.25);
  const [playing, setPlaying] = useState(true);
  const [transition, setTransition] = useState(0.24);

  useEffect(() => {
    if (!playing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setTimeout(() => setFrame((current) => (current + 1) % MOTION_FRAMES.length), (hold + transition) * 1000);
    return () => window.clearTimeout(timer);
  }, [frame, hold, playing, transition]);

  return (
    <section
      className='marketing-live-demo marketing-mini-motion-workspace'
      data-curve={curve}
      data-frame={frame}
      data-playing={playing ? 'true' : 'false'}
      style={{
        '--motion-step-duration': `${hold + transition}s`,
        '--motion-transition-duration': `${transition}s`,
      } as React.CSSProperties}
    >
      <MiniStudioBar title='Animation'>
        <span>0{frame + 1} / 04 · 20 FPS</span>
        <button aria-label='Restart animation' onClick={() => { setFrame(0); setPlaying(true); }} type='button'><RotateCcw aria-hidden='true' /></button>
        <button aria-label={playing ? 'Pause animation' : 'Play animation'} className='is-primary' onClick={() => setPlaying((current) => !current)} type='button'>{playing ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}{playing ? 'Pause' : 'Play'}</button>
      </MiniStudioBar>
      <div className='marketing-mini-motion-body'>
        <aside className='marketing-mini-motion-sources'>
          <span>Animation sources</span>
          {MOTION_FRAMES.map((label, index) => (
            <button aria-current={frame === index ? 'true' : undefined} key={label} onClick={() => { setFrame(index); setPlaying(false); }} type='button'>
              {index === 0 ? <ImageIcon aria-hidden='true' /> : <Type aria-hidden='true' />}<span>{label}</span><small>0{index + 1}</small>
            </button>
          ))}
        </aside>
        <main className='marketing-mini-motion-canvas-column'>
          <div className='marketing-mini-motion-canvas'>
            <div className='marketing-mini-motion-field' />
            <GtMark light />
            <strong key={MOTION_FRAMES[frame]}>{MOTION_FRAMES[frame]}</strong>
            <i aria-hidden='true' />
          </div>
          <div className='marketing-mini-motion-timeline'>
            <button aria-label={playing ? 'Pause timeline' : 'Play timeline'} onClick={() => setPlaying((current) => !current)} type='button'>{playing ? <Pause /> : <Play />}</button>
            <div>{MOTION_FRAMES.map((label, index) => <button aria-current={frame === index ? 'true' : undefined} key={label} onClick={() => { setFrame(index); setPlaying(false); }} type='button'><span>0{index + 1}</span>{label}</button>)}</div>
          </div>
        </main>
        <aside className='marketing-mini-motion-properties'>
          <span>Sequence properties</span>
          <label><span><Clock3 aria-hidden='true' />Hold <output>{hold.toFixed(2)}s</output></span><StudioRange aria-label='Frame hold' max={1.8} min={0.6} onChange={(event) => setHold(Number(event.target.value))} step={0.05} value={hold} /></label>
          <label><span><SlidersHorizontal aria-hidden='true' />Transition <output>{Math.round(transition * 1000)}ms</output></span><StudioRange aria-label='Frame transition' max={0.6} min={0.1} onChange={(event) => setTransition(Number(event.target.value))} step={0.01} value={transition} /></label>
          <div>{(['Material', 'Snappy', 'Soft'] as MotionCurve[]).map((label) => <button aria-pressed={curve === label} className={curve === label ? 'is-active' : undefined} key={label} onClick={() => setCurve(label)} type='button'>{label}</button>)}</div>
        </aside>
      </div>
    </section>
  );
}
