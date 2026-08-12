import type { CSSProperties, ReactNode } from 'react';

import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandAsset,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { capVisibleFontWeight } from '@/lib/typography';

type BrandIdentityPreviewProps = {
  darkMark?: string;
  identity: BrandIdentity;
  lightMark?: string;
};

const PREVIEW_TITLES: Readonly<Record<string, string>> = {
  basement: 'Cool work that performs.',
  cloudflare: 'A better Internet, built everywhere.',
  gt: 'Every language. One source.',
  mintlify: 'Knowledge infrastructure for agents.',
  ramp: 'Save time. Save money.',
  starter: 'Make the signal visible.',
  stripe: 'Build the internet economy.',
  tailwind: 'CSS-first. Built for the modern web.',
  viteplus: 'One toolchain for the web.',
};

function Mark({ name, path }: { name: string; path?: string }) {
  return path ? <img alt={`${name} mark`} src={path} /> : <span>{name}</span>;
}

function libraryAsset(identity: BrandIdentity, id: string): BrandAsset | undefined {
  return [...identity.assets, ...identity.proofAssets].find((asset) => asset.id === id);
}

function EvidenceImage({
  asset,
  className,
}: {
  asset?: BrandAsset;
  className?: string;
}) {
  if (!asset) return null;
  const centeredProduct = asset.tags?.includes('centered-product') ?? false;
  const objectPosition = asset.focalPoint
    ? `${asset.focalPoint.x * 100}% ${asset.focalPoint.y * 100}%`
    : '50% 50%';

  return (
    <img
      alt={asset.alt ?? asset.label}
      className={className}
      data-fit={centeredProduct ? 'contain' : 'cover'}
      decoding='async'
      loading='lazy'
      src={asset.path}
      style={{ objectPosition }}
    />
  );
}

function PreviewTitle({ children }: { children: ReactNode }) {
  return <h2 data-preview-title='true'>{children}</h2>;
}

function PreviewShell({ children, identity }: { children: ReactNode; identity: BrandIdentity }) {
  const display = brandTypographyRole(identity, 'Display');
  const body = brandTypographyRole(identity, 'Body');
  const code = brandTypographyRole(identity, 'Code');
  const style = {
    '--brand-body': brandTypographyFamily(identity, 'Body'),
    '--brand-body-weight': capVisibleFontWeight(body.weight ?? 400),
    '--brand-code': brandTypographyFamily(identity, 'Code'),
    '--brand-code-weight': capVisibleFontWeight(code.weight ?? 400),
    '--brand-display': brandTypographyFamily(identity, 'Display'),
    '--brand-display-line-height': display.lineHeight ?? 0.98,
    '--brand-display-tracking': `${display.letterSpacing ?? 0}px`,
    '--brand-display-weight': capVisibleFontWeight(display.weight ?? 500),
    '--brand-emphasis': identity.colors.find((color) => color.id === 'emphasis')?.hex ?? '#2f6bff',
    '--brand-ink': identity.colors.find((color) => color.id === 'ink')?.hex ?? '#181818',
    '--brand-muted': identity.colors.find((color) => color.id === 'muted')?.hex ?? '#f1f1f1',
    '--brand-paper': identity.colors.find((color) => color.id === 'paper')?.hex ?? '#ffffff',
  } as CSSProperties;

  return (
    <div
      className='brand-art-preview'
      data-brand-preview={identity.id}
      data-recipe={identity.artDirection.preview}
      style={style}
    >
      {children}
    </div>
  );
}

export default function BrandIdentityPreview({
  darkMark,
  identity,
  lightMark,
}: BrandIdentityPreviewProps) {
  const recipe = identity.artDirection.preview;
  const title = PREVIEW_TITLES[identity.id] ?? identity.tagline;
  const overview = libraryAsset(identity, 'library-overview');
  const editorial = libraryAsset(identity, 'library-editorial');
  const detail = libraryAsset(identity, 'library-detail');
  const atmosphere = libraryAsset(identity, 'library-atmosphere');
  const interfaceEvidence = libraryAsset(identity, 'library-interface');
  const languageConstellation = libraryAsset(identity, 'library-constellation');

  if (recipe === 'translation-frame') {
    const savedGreetings = identity.greetings.includes('환영합니다')
      ? identity.greetings
      : [...identity.greetings, '환영합니다'];
    const spanishIndex = savedGreetings.indexOf('Bienvenidos');
    const koreanIndex = savedGreetings.indexOf('환영합니다');
    const greetings = spanishIndex < koreanIndex
      ? savedGreetings.map((greeting) => {
          if (greeting === 'Bienvenidos') return '환영합니다';
          if (greeting === '환영합니다') return 'Bienvenidos';
          return greeting;
        })
      : savedGreetings;

    return (
      <PreviewShell identity={identity}>
        <div aria-hidden='true' className='brand-art-gt-material'>
          {languageConstellation ? (
            <EvidenceImage asset={languageConstellation} className='brand-art-gt-constellation' />
          ) : (
            <div className='brand-art-gt-metal-stage'>
              {greetings.map((greeting) => (
                <span
                  className='brand-art-gt-metal-language'
                  dir={/[\u0600-\u06ff]/.test(greeting) ? 'rtl' : undefined}
                  key={greeting}
                >
                  {greeting}
                </span>
              ))}
            </div>
          )}
        </div>
        <header className='brand-art-gt-header'>
          <Mark name={identity.name} path={lightMark} />
        </header>
        <div className='brand-art-gt-copy'>
          <PreviewTitle>
            <span>Every language.</span>
            <span>One source.</span>
          </PreviewTitle>
          <p>Product language stays connected to code, context, and delivery.</p>
        </div>
      </PreviewShell>
    );
  }

  if (recipe === 'focus-window') {
    return (
      <PreviewShell identity={identity}>
        <header><Mark name={identity.name} path={darkMark} /><span>RESEARCH / DIRECTION / SYSTEM</span></header>
        <div className='brand-art-focus-grid'>
          <div className='brand-art-focus-image'><EvidenceImage asset={overview} /><span>01 / selected evidence</span></div>
          <div className='brand-art-focus-window'><small>Current signal</small><PreviewTitle>{title}</PreviewTitle><p>{identity.strategy.promise}</p></div>
          <div className='brand-art-focus-notes'>{identity.strategy.pillars.slice(0, 3).map((pillar, index) => <p key={pillar}><b>{String(index + 1).padStart(2, '0')}</b>{pillar}</p>)}</div>
        </div>
      </PreviewShell>
    );
  }

  if (recipe === 'economic-ledger') {
    return (
      <PreviewShell identity={identity}>
        <div className='brand-art-ledger-title'><Mark name={identity.name} path={darkMark} /><span>FINANCE OPERATIONS / CONTROL</span></div>
        <div className='brand-art-ledger-copy'>
          <PreviewTitle>{title}</PreviewTitle>
          <p>{identity.strategy.promise}</p>
          <strong>{identity.proof[0]}</strong>
        </div>
        <div className='brand-art-ledger-evidence'>
          <div className='brand-art-ledger-photo'>
            <EvidenceImage asset={editorial ?? detail} />
            <span>{identity.products.slice(0, 3).join(' · ')}</span>
          </div>
        </div>
      </PreviewShell>
    );
  }

  if (recipe === 'knowledge-beam') {
    return (
      <PreviewShell identity={identity}>
        <header className='brand-art-mintlify-header'><Mark name={identity.name} path={darkMark} /><span>Knowledge for people + agents</span></header>
        <div className='brand-art-mintlify-copy'>
          <PreviewTitle>{title}</PreviewTitle>
          <p>Self-updating documentation for startups, enterprises, and agents.</p>
        </div>
        <div className='brand-art-mintlify-system'>
          <div className='brand-art-mintlify-sources'>
            {['GitHub', 'Slack', 'Product'].map((source) => <span key={source}>{source}</span>)}
          </div>
          <div className='brand-art-mintlify-agent'>
            <Mark name={identity.name} path={lightMark} />
            <div><small>Mintlify agent</small><strong>Knowledge stays current.</strong></div>
            <i />
          </div>
          <div className='brand-art-mintlify-status'>
            <span><b>24/7</b> agents at work</span>
            <span><b>3</b> sources connected</span>
          </div>
        </div>
      </PreviewShell>
    );
  }

  if (recipe === 'utility-wave') {
    return (
      <PreviewShell identity={identity}>
        <header className='brand-art-tailwind-header'><Mark name={identity.name} path={lightMark} /><span>v4.0 / CSS-first configuration</span></header>
        <div className='brand-art-tailwind-copy'>
          <PreviewTitle>{title}</PreviewTitle>
          <p>Compose utilities in markup, define tokens in CSS, and build at microsecond speed.</p>
          <strong>100× <small>faster incremental builds</small></strong>
        </div>
        <div className='brand-art-tailwind-code'>
          <span>app.css</span>
          <code><i>@import</i> &quot;tailwindcss&quot;;</code>
          <code><i>@theme</i> {'{'}</code>
          <code>&nbsp;&nbsp;--color-lagoon: <b>oklch(.72 .16 210)</b>;</code>
          <code>&nbsp;&nbsp;--ease-fluid: <b>cubic-bezier(.3,0,0,1)</b>;</code>
          <code>{'}'}</code>
        </div>
        <div className='brand-art-tailwind-spectrum' aria-label='Tailwind vivid P3 palette'>
          {['sky', 'violet', 'rose', 'amber', 'lime'].map((tone) => <i data-tone={tone} key={tone} />)}
        </div>
      </PreviewShell>
    );
  }

  if (recipe === 'unified-terminal') {
    return (
      <PreviewShell identity={identity}>
        <div className='brand-art-terminal-field'><EvidenceImage asset={overview ?? atmosphere} /></div>
        <header><Mark name={identity.name} path={darkMark} /><span>ONE CONFIGURATION / ONE FLOW</span></header>
        <div className='brand-art-terminal-copy'><PreviewTitle>{title}</PreviewTitle><p>{identity.strategy.promise}</p></div>
        <div className='brand-art-terminal-window'>
          <span>$ vp create</span>
          {identity.products.slice(0, 4).map((product, index) => <p key={product}><b>{index === 3 ? '✓' : '◇'}</b>{product}</p>)}
        </div>
      </PreviewShell>
    );
  }

  if (recipe === 'network-horizon') {
    return (
      <PreviewShell identity={identity}>
        <header><Mark name={identity.name} path={lightMark} /><span>CONNECTIVITY CLOUD</span></header>
        <div className='brand-art-network-image'><EvidenceImage asset={overview} /></div>
        <div className='brand-art-network-copy'><PreviewTitle>{title}</PreviewTitle><p>{identity.strategy.promise}</p></div>
        <div className='brand-art-network-route'>{identity.products.slice(0, 4).map((product, index) => <span key={product}><i />{String(index + 1).padStart(2, '0')} {product}</span>)}</div>
      </PreviewShell>
    );
  }

  if (recipe === 'programmable-field') {
    return (
      <PreviewShell identity={identity}>
        <div className='brand-art-spectrum'><EvidenceImage asset={atmosphere} /></div>
        <header><Mark name={identity.name} path={darkMark} /><span>PROGRAMMABLE ECONOMY</span></header>
        <div className='brand-art-programmable-copy'><PreviewTitle>{title}</PreviewTitle><p>{identity.strategy.promise}</p></div>
        <div className='brand-art-transaction'>
          <EvidenceImage asset={overview ?? interfaceEvidence ?? detail} />
          <div><span>{identity.products[0]}</span><strong>{identity.proof[0]}</strong></div>
        </div>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell identity={identity}>
      <header><Mark name={identity.name} path={darkMark} /><span>INDEPENDENT DIGITAL STUDIO</span></header>
      <div className='brand-art-editorial-image'><EvidenceImage asset={editorial} /></div>
      <div className='brand-art-editorial-copy'><PreviewTitle>{title}</PreviewTitle><p>{identity.strategy.promise}</p></div>
      <footer>{identity.products.slice(0, 4).join(' / ')}</footer>
    </PreviewShell>
  );
}
