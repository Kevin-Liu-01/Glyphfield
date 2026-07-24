import type { CSSProperties, ReactNode } from 'react';

import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { capVisibleFontWeight } from '@/lib/typography';

type BrandIdentityPreviewProps = {
  darkMark?: string;
  identity: BrandIdentity;
  lightMark?: string;
};

function Mark({ fallback, path }: { fallback: string; path?: string }) {
  return path ? <img alt='' src={path} /> : <span>{fallback}</span>;
}

function PreviewShell({ children, identity }: { children: ReactNode; identity: BrandIdentity }) {
  const display = brandTypographyRole(identity, 'Display');
  const body = brandTypographyRole(identity, 'Body');
  const style = {
    '--brand-body': brandTypographyFamily(identity, 'Body'),
    '--brand-body-weight': capVisibleFontWeight(body.weight ?? 400),
    '--brand-display': brandTypographyFamily(identity, 'Display'),
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

  if (recipe === 'translation-frame') {
    return (
      <PreviewShell identity={identity}>
        <div className='brand-art-translation-rail'>
          <Mark fallback={identity.shortName} path={darkMark} />
          <span>{identity.website}</span>
        </div>
        <div className='brand-art-translation-copy'>
          <h2>{identity.tagline}</h2>
          <div aria-hidden='true' className='brand-art-language-stack'>
            {identity.greetings.slice(0, 4).map((greeting) => <span key={greeting}>{greeting}</span>)}
          </div>
        </div>
        <p>{identity.positioning}</p>
      </PreviewShell>
    );
  }

  if (recipe === 'focus-window') {
    return (
      <PreviewShell identity={identity}>
        <header><Mark fallback={identity.shortName} path={darkMark} /><span>{identity.name}</span></header>
        <div className='brand-art-focus-grid'>
          <div className='brand-art-focus-window'><span>01</span><strong>{identity.strategy.concept}</strong></div>
          <div className='brand-art-focus-notes'>
            {identity.strategy.pillars.slice(0, 3).map((pillar, index) => <p key={pillar}><b>{String(index + 1).padStart(2, '0')}</b>{pillar}</p>)}
          </div>
        </div>
        <h2>{identity.tagline}</h2>
      </PreviewShell>
    );
  }

  if (recipe === 'economic-ledger') {
    return (
      <PreviewShell identity={identity}>
        <div className='brand-art-ledger-title'><Mark fallback={identity.shortName} path={darkMark} /><span>{identity.website}</span></div>
        <div className='brand-art-ledger-metric'><small>{identity.strategy.pillars[0]}</small><strong>{identity.proof[0]}</strong></div>
        <div className='brand-art-ledger-rule' />
        <h2>{identity.tagline}</h2>
        <div className='brand-art-ledger-list'>{identity.products.slice(0, 4).map((product, index) => <span key={product}>{String(index + 1).padStart(2, '0')} {product}</span>)}</div>
      </PreviewShell>
    );
  }

  if (recipe === 'knowledge-beam') {
    return (
      <PreviewShell identity={identity}>
        <header><Mark fallback={identity.shortName} path={lightMark} /><span>{identity.website}</span></header>
        <div className='brand-art-knowledge-beam' aria-hidden='true' />
        <div className='brand-art-knowledge-copy'><h2>{identity.tagline}</h2><p>{identity.positioning}</p></div>
        <div className='brand-art-doc-stack'>{identity.products.slice(0, 3).map((product, index) => <span key={product}><b>{index + 1}</b>{product}</span>)}</div>
      </PreviewShell>
    );
  }

  if (recipe === 'utility-wave') {
    return (
      <PreviewShell identity={identity}>
        <header><Mark fallback={identity.shortName} path={lightMark} /><span>{identity.website}</span></header>
        <div className='brand-art-utility-code'><span>className=</span><strong>&quot;{identity.products.slice(0, 3).join(' ')}&quot;</strong></div>
        <div className='brand-art-utility-wave' aria-hidden='true'><i /><i /><i /></div>
        <h2>{identity.tagline}</h2>
      </PreviewShell>
    );
  }

  if (recipe === 'unified-terminal') {
    return (
      <PreviewShell identity={identity}>
        <div className='brand-art-terminal-field' aria-hidden='true' />
        <header><Mark fallback={identity.shortName} path={darkMark} /><span>{identity.website}</span></header>
        <h2>{identity.tagline}</h2>
        <div className='brand-art-terminal-window'>
          <span>$ vp create</span>
          {identity.products.slice(0, 3).map((product) => <p key={product}>✓ {product}</p>)}
        </div>
      </PreviewShell>
    );
  }

  if (recipe === 'network-horizon') {
    return (
      <PreviewShell identity={identity}>
        <header><Mark fallback={identity.shortName} path={darkMark} /><span>{identity.website}</span></header>
        <div className='brand-art-network-map' aria-hidden='true'>{identity.products.slice(0, 5).map((product, index) => <i key={product} style={{ '--node': index } as CSSProperties} />)}</div>
        <div className='brand-art-network-horizon' />
        <h2>{identity.tagline}</h2>
        <p>{identity.positioning}</p>
      </PreviewShell>
    );
  }

  if (recipe === 'programmable-field') {
    return (
      <PreviewShell identity={identity}>
        <div className='brand-art-spectrum' aria-hidden='true' />
        <header><Mark fallback={identity.shortName} path={darkMark} /><span>{identity.website}</span></header>
        <div className='brand-art-programmable-copy'><h2>{identity.tagline}</h2><p>{identity.positioning}</p></div>
        <div className='brand-art-transaction'><span>{identity.products[0]}</span><strong>{identity.proof[0]}</strong><i /></div>
      </PreviewShell>
    );
  }

  return (
    <PreviewShell identity={identity}>
      <header><Mark fallback={identity.shortName} path={darkMark} /><span>{identity.website}</span></header>
      <div className='brand-art-editorial-copy'><h2>{identity.tagline}</h2><p>{identity.positioning}</p></div>
      <div className='brand-art-interruption'><span>{identity.strategy.concept}</span></div>
      <footer>{identity.voice.principles.slice(0, 3).join(' / ')}</footer>
    </PreviewShell>
  );
}
