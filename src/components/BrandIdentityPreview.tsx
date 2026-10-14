import type { CSSProperties, ReactNode } from 'react';

import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandAsset,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { brandElementContent } from '@/lib/brandElementContent';
import { displayTrackingEm } from '@/lib/brandOutputKit';
import { capVisibleFontWeight } from '@/lib/typography';

type BrandIdentityPreviewProps = {
  darkMark?: string;
  identity: BrandIdentity;
  lightMark?: string;
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
      src={asset.path}
      style={{ objectPosition }}
    />
  );
}

function AdaptiveEvidenceImage({
  darkAsset,
  lightAsset,
}: {
  darkAsset?: BrandAsset;
  lightAsset?: BrandAsset;
}) {
  if (!lightAsset && !darkAsset) return null;
  if (!lightAsset || !darkAsset) return <EvidenceImage asset={lightAsset ?? darkAsset} />;

  return (
    <>
      <EvidenceImage asset={lightAsset} className='brand-art-evidence-theme brand-art-evidence-theme--light' />
      <EvidenceImage asset={darkAsset} className='brand-art-evidence-theme brand-art-evidence-theme--dark' />
    </>
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
    '--brand-display-tracking': `${displayTrackingEm(display.letterSpacing)}em`,
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

function recipeProps({
  darkMark,
  identity,
  lightMark,
}: BrandIdentityPreviewProps) {
  const title = identity.tagline;
  const content = brandElementContent(identity);
  const promise = content.promise || identity.positioning;
  const overview = libraryAsset(identity, 'library-overview');
  const editorial = libraryAsset(identity, 'library-editorial');
  const detail = libraryAsset(identity, 'library-detail');
  const atmosphere = libraryAsset(identity, 'library-atmosphere');
  const studioOverviewDark = libraryAsset(identity, 'studio-brand-elements-dark');
  const studioOverviewLight = libraryAsset(identity, 'studio-brand-elements-light');
  return { atmosphere, content, darkMark, detail, editorial, identity, lightMark, overview, promise, studioOverviewDark, studioOverviewLight, title };
}

type RecipeProps = ReturnType<typeof recipeProps>;

function TranslationFrame({ identity, lightMark, overview }: RecipeProps) {
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
        {overview ? (
          <EvidenceImage asset={overview} className='brand-art-gt-globe' />
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

function FocusWindow({ darkMark, identity, overview, promise, studioOverviewDark, studioOverviewLight, title }: RecipeProps) {
  return (
    <PreviewShell identity={identity}>
      <header><Mark name={identity.name} path={darkMark} /></header>
      <div className='brand-art-focus-grid'>
        <div className='brand-art-focus-image'>
          {studioOverviewLight || studioOverviewDark
            ? <AdaptiveEvidenceImage darkAsset={studioOverviewDark} lightAsset={studioOverviewLight} />
            : <EvidenceImage asset={overview} />}
          <span>01 / selected evidence</span>
        </div>
        <div className='brand-art-focus-window'><PreviewTitle>{title}</PreviewTitle><p>{promise}</p></div>
        <div className='brand-art-focus-notes'>{identity.strategy.pillars.slice(0, 3).map((pillar) => <p key={pillar}>{pillar}</p>)}</div>
      </div>
    </PreviewShell>
  );
}

function EconomicLedger({ content, darkMark, detail, editorial, identity, promise, title }: RecipeProps) {
  return (
    <PreviewShell identity={identity}>
      <div className='brand-art-ledger-title'><Mark name={identity.name} path={darkMark} /></div>
      <div className='brand-art-ledger-copy'>
        <PreviewTitle>{title}</PreviewTitle>
        <p>{promise}</p>
        {content.proof[0] ? <strong>{content.proof[0]}</strong> : null}
      </div>
      <div className='brand-art-ledger-evidence'>
        <div className='brand-art-ledger-photo'>
          <EvidenceImage asset={editorial ?? detail} />
          <span>{content.products.slice(0, 3).map(({ name }) => name).join(' · ')}</span>
        </div>
      </div>
    </PreviewShell>
  );
}

function KnowledgeBeam({ content, darkMark, identity, lightMark, promise, title }: RecipeProps) {
  return (
    <PreviewShell identity={identity}>
      <header className='brand-art-mintlify-header'><Mark name={identity.name} path={darkMark} /></header>
      <div className='brand-art-mintlify-copy'>
        <PreviewTitle>{title}</PreviewTitle>
        <p>{content.phrases.find((phrase) => phrase !== title) ?? promise}</p>
      </div>
      <div className='brand-art-mintlify-system'>
        <div className='brand-art-mintlify-sources'>
          {content.products.slice(0, 3).map(({ name }) => <span key={name}>{name}</span>)}
        </div>
        <div className='brand-art-mintlify-agent'>
          <Mark name={identity.name} path={lightMark} />
          <div><strong>{content.products[2]?.summary ?? promise}</strong><small>{content.products[2]?.name ?? identity.name}</small></div>
          <i />
        </div>
        <div className='brand-art-mintlify-status'>
          {content.proof.slice(0, 2).map((statement) => <span key={statement}>{statement}</span>)}
        </div>
      </div>
    </PreviewShell>
  );
}

function UtilityWave({ content, identity, lightMark, promise, title }: RecipeProps) {
  return (
    <PreviewShell identity={identity}>
      <header className='brand-art-tailwind-header'><Mark name={identity.name} path={lightMark} /></header>
      <div className='brand-art-tailwind-copy'>
        <PreviewTitle>{title}</PreviewTitle>
        <p>{promise}</p>
        {content.proof[0] ? <strong>{content.proof[0]}</strong> : null}
      </div>
      <div className='brand-art-tailwind-code'>
        <span>{content.code.label}</span>
        <pre>{content.code.snippet}</pre>
        <span>app.css</span>
        <code><i>@import</i> &quot;tailwindcss&quot;;</code>
        <code><i>@theme</i> {'{'}</code>
        {identity.colors.slice(0, 5).map((color) => <code key={color.id}>&nbsp;&nbsp;--color-{color.id}: <b>{color.hex.toLocaleLowerCase()}</b>;</code>)}
        <code>{'}'}</code>
      </div>
      <div className='brand-art-tailwind-spectrum' aria-label='Tailwind vivid P3 palette'>
        {['sky', 'violet', 'rose', 'amber', 'lime'].map((tone) => <i data-tone={tone} key={tone} />)}
      </div>
    </PreviewShell>
  );
}

function UnifiedTerminal({ atmosphere, content, darkMark, identity, overview, promise, title }: RecipeProps) {
  return (
    <PreviewShell identity={identity}>
      <div className='brand-art-terminal-field'><EvidenceImage asset={overview ?? atmosphere} /></div>
      <header><Mark name={identity.name} path={darkMark} /></header>
      <div className='brand-art-terminal-copy'><PreviewTitle>{title}</PreviewTitle><p>{promise}</p></div>
      <div className='brand-art-terminal-window'>
        <span>$ {content.install}</span>
        {content.products.slice(0, 4).map((product, index) => <p key={product.name}><b>{index === 3 ? '✓' : '◇'}</b>{product.name}</p>)}
      </div>
    </PreviewShell>
  );
}

function NetworkHorizon({ content, identity, lightMark, overview, promise, title }: RecipeProps) {
  return (
    <PreviewShell identity={identity}>
      <header><Mark name={identity.name} path={lightMark} /></header>
      <div className='brand-art-network-image'><EvidenceImage asset={overview} /></div>
      <div className='brand-art-network-copy'><PreviewTitle>{title}</PreviewTitle><p>{promise}</p></div>
      <div className='brand-art-network-route'>{content.products.slice(0, 4).map((product) => <span key={product.name}><i />{product.name}</span>)}</div>
    </PreviewShell>
  );
}

function ProgrammableField({ atmosphere, content, darkMark, identity, promise, title }: RecipeProps) {
  return (
    <PreviewShell identity={identity}>
      <div className='brand-art-spectrum'><EvidenceImage asset={atmosphere} /></div>
      <header><Mark name={identity.name} path={darkMark} /></header>
      <div className='brand-art-programmable-copy'><PreviewTitle>{title}</PreviewTitle><p>{promise}</p></div>
      <div className='brand-art-transaction'>
        <strong>{content.metric.value}</strong>
        <small>{content.metric.label} · {content.metric.change}</small>
        <div className='brand-art-transaction-head'><span>{content.products[0]?.name ?? identity.name}</span><span>{content.code.label}</span></div>
        <i />
        <dl>
          {content.products.slice(1, 4).map((product) => <div key={product.name}><dt>{product.name}</dt><dd>{product.summary}</dd></div>)}
        </dl>
        {content.proof[0] ? <footer>{content.proof[0]}</footer> : null}
      </div>
    </PreviewShell>
  );
}

function EditorialInterruption({ content, darkMark, editorial, identity, promise, title }: RecipeProps) {
  return (
  <PreviewShell identity={identity}>
    <header><Mark name={identity.name} path={darkMark} /></header>
    <div className='brand-art-editorial-image'><EvidenceImage asset={editorial} /></div>
    <div className='brand-art-editorial-copy'><PreviewTitle>{title}</PreviewTitle><p>{promise}</p></div>
    <footer>{content.products.slice(0, 4).map(({ name }) => name).join(' / ')}</footer>
  </PreviewShell>
);
}

const RECIPES: Record<BrandIdentity['artDirection']['preview'], (props: RecipeProps) => ReactNode> = {
  'economic-ledger': EconomicLedger,
  'editorial-interruption': EditorialInterruption,
  'focus-window': FocusWindow,
  'knowledge-beam': KnowledgeBeam,
  'network-horizon': NetworkHorizon,
  'programmable-field': ProgrammableField,
  'translation-frame': TranslationFrame,
  'unified-terminal': UnifiedTerminal,
  'utility-wave': UtilityWave,
};

export default function BrandIdentityPreview(props: BrandIdentityPreviewProps) {
  const Recipe = RECIPES[props.identity.artDirection.preview] ?? EditorialInterruption;
  return <Recipe {...recipeProps(props)} />;
}
