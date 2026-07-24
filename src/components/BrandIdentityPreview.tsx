import type { CSSProperties, ReactNode } from 'react';

import BrandSystemDiagram from '@/components/BrandSystemDiagram';
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
  gt: 'One source. Every language.',
  mintlify: 'Knowledge, beautifully organized.',
  ramp: 'Save time. Save money.',
  starter: 'Make the signal visible.',
  stripe: 'Build the internet economy.',
  tailwind: 'Build exactly what you imagine.',
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
  return <img alt={asset.alt ?? asset.label} className={className} src={asset.path} />;
}

function PreviewTitle({ children }: { children: ReactNode }) {
  return <h2 data-preview-title='true'>{children}</h2>;
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

  if (recipe === 'translation-frame') {
    return (
      <PreviewShell identity={identity}>
        <div className='brand-art-translation-rail'>
          <Mark name={identity.name} path={darkMark} />
          <span>GENERAL TRANSLATION / 01</span>
        </div>
        <div className='brand-art-translation-copy'>
          <div>
            <PreviewTitle>{title}</PreviewTitle>
            <p>Product language and code move together.</p>
          </div>
          <div aria-label='Greetings in multiple languages' className='brand-art-language-stack'>
            {identity.greetings.slice(0, 5).map((greeting, index) => <span data-active={index === 1 ? 'true' : 'false'} key={greeting}>{greeting}</span>)}
          </div>
        </div>
        <div className='brand-art-translation-footer'>{identity.products.slice(0, 4).map((product) => <span key={product}>{product}</span>)}</div>
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
          <BrandSystemDiagram compact identity={identity} />
        </div>
      </PreviewShell>
    );
  }

  if (recipe === 'knowledge-beam') {
    return (
      <PreviewShell identity={identity}>
        <header><Mark name={identity.name} path={lightMark} /><span>DOCS THAT FEEL BUILT IN</span></header>
        <div className='brand-art-knowledge-copy'><PreviewTitle>{title}</PreviewTitle><p>{identity.strategy.promise}</p></div>
        <div className='brand-art-knowledge-browser'>
          <div className='brand-art-browser-bar'><i /><i /><i /><span>Search documentation</span></div>
          <EvidenceImage asset={overview} />
          <div className='brand-art-doc-stack'>{identity.products.slice(0, 3).map((product, index) => <span key={product}><b>{index + 1}</b>{product}</span>)}</div>
        </div>
      </PreviewShell>
    );
  }

  if (recipe === 'utility-wave') {
    return (
      <PreviewShell identity={identity}>
        <header><Mark name={identity.name} path={lightMark} /><span>UTILITY → INTERFACE</span></header>
        <div className='brand-art-utility-result'><EvidenceImage asset={interfaceEvidence ?? overview} /></div>
        <div className='brand-art-utility-copy'>
          <div className='brand-art-utility-code'><span>className=</span><strong>&quot;grid gap-6 text-cyan-400&quot;</strong></div>
          <PreviewTitle>{title}</PreviewTitle>
          <p>{identity.strategy.promise}</p>
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
