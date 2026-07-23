'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  Badge,
  BriefcaseBusiness,
  Download,
  FileText,
  Mail,
  Presentation,
  RotateCcw,
  Search,
  Share2,
  TerminalSquare,
} from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import { Button } from '@/components/ui/Button';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  BRAND_ELEMENT_CATEGORIES,
  BRAND_ELEMENTS,
  createBrandElementSettings,
  filterBrandElements,
  type BrandElement,
  type BrandElementCategory,
  type BrandElementOverrides,
  type BrandElementSettings,
} from '@/lib/brandElements';
import { brandAssetPath, type BrandIdentity } from '@/lib/brandIdentity';
import { hexToOklch } from '@/lib/color';
import type { StudioTool } from '@/lib/studioCatalog';

const CATEGORY_ICONS: Record<BrandElementCategory, typeof Mail> = {
  Developer: TerminalSquare,
  Digital: Mail,
  Editorial: Presentation,
  Event: Badge,
  Physical: BriefcaseBusiness,
  Social: Share2,
};

function downloadElementBrief(
  identity: BrandIdentity,
  element: BrandElement,
  settings: BrandElementSettings
) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          element,
          settings,
          identity: {
            colors: identity.colors,
            id: identity.id,
            name: identity.name,
            shortName: identity.shortName,
            tagline: identity.tagline,
            typography: identity.typography,
            voice: identity.voice,
            website: identity.website,
          },
          schemaVersion: 2,
        },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${identity.id}-${element.id}-brief.json`;
  link.href = url;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isDarkSurface(color: string): boolean {
  try {
    return hexToOklch(color).lightness < 0.62;
  } catch {
    return false;
  }
}

function ElementPattern({ settings }: { settings: BrandElementSettings }) {
  if (settings.pattern === 'none') return null;
  return (
    <span
      aria-hidden='true'
      className='brand-element-pattern'
      data-pattern={settings.pattern}
      style={{ color: settings.foregroundColor, opacity: settings.patternOpacity / 100 }}
    />
  );
}

function artworkStyle(settings: BrandElementSettings): CSSProperties {
  return {
    transform: `translate(${settings.artworkX}px, ${settings.artworkY}px) scale(${settings.artworkScale / 100})`,
    transformOrigin: 'center',
  };
}

function elementSurfaceStyle(settings: BrandElementSettings): CSSProperties {
  return {
    backgroundColor: settings.backgroundColor,
    color: settings.foregroundColor,
  };
}

function ElementTextControl({
  label,
  multiline = false,
  onChange,
  value,
}: {
  label: ReactNode;
  multiline?: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className='element-editor-field'>
      <span>{label}</span>
      {multiline ? (
        <textarea
          className='min-h-20 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 outline-none focus:border-foreground'
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      ) : (
        <input
          className='h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-foreground'
          onChange={(event) => onChange(event.target.value)}
          value={value}
        />
      )}
    </label>
  );
}

function ElementColorControl({
  label,
  onChange,
  value,
}: {
  label: ReactNode;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className='element-editor-color'>
      <span>{label}</span>
      <span>
        <input
          aria-label={typeof label === 'string' ? label : undefined}
          onChange={(event) => onChange(event.target.value.toLocaleUpperCase())}
          type='color'
          value={/^#[\dA-F]{6}$/i.test(value) ? value : '#000000'}
        />
        <input
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          value={value}
        />
      </span>
    </label>
  );
}

function ElementRangeControl({
  label,
  max,
  min,
  onChange,
  suffix,
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <label className='element-editor-range'>
      <span><span>{label}</span><output>{value}{suffix}</output></span>
      <input className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type='range' value={value} />
    </label>
  );
}

function ElementEditor({
  element,
  onChange,
  onReset,
  settings,
}: {
  element: BrandElement;
  onChange: (patch: BrandElementOverrides) => void;
  onReset: () => void;
  settings: BrandElementSettings;
}) {
  const gt = useGT();
  const hasPerson = ['email-signature', 'lanyard', 'event-badge', 'business-card'].includes(
    element.id
  );
  const hasPartner = element.id === 'partnership-lockup';
  const contentless = ['logo-background', 'favicon-set', 'app-icon'].includes(element.id);
  const personOnly = ['email-signature', 'lanyard', 'event-badge', 'business-card'].includes(
    element.id
  );
  const headlineHidden = contentless || personOnly || ['ascii-mark', 'partnership-lockup'].includes(element.id);
  const bodyHidden =
    contentless ||
    personOnly ||
    ['cli-banner', 'terminal-theme', 'event-backdrop', 'partnership-lockup'].includes(
      element.id
    );
  const eyebrowSupported =
    !contentless &&
    !['email-signature', 'ascii-mark', 'cli-banner', 'partnership-lockup', 'business-card', 'sticker-sheet', 'letterhead'].includes(
      element.id
    );
  const actionSupported =
    ['welcome-email', 'transactional-email', 'web-card', 'error-page', 'community-card', 'launch-card', 'cli-banner', 'github-readme', 'docs-header', 'package-card'].includes(
      element.id
    );
  const layoutSupported =
    ['github-readme', 'docs-header', 'package-card', 'x-post', 'linkedin-post', 'community-card', 'launch-card', 'slide-title', 'slide-section', 'blog-cover', 'report-cover', 'press-kit', 'web-card', 'opengraph', 'error-page'].includes(
      element.id
    );
  const scaleSupported =
    ['x-post', 'linkedin-post', 'community-card', 'launch-card', 'slide-title', 'slide-section', 'blog-cover', 'report-cover', 'press-kit', 'event-backdrop', 'web-card', 'opengraph', 'error-page'].includes(
      element.id
    );
  const patternSupported =
    !['email-signature', 'lanyard', 'event-badge', 'business-card', 'letterhead', 'favicon-set', 'app-icon'].includes(
      element.id
    );
  const logoSupported = !['ascii-mark', 'terminal-theme', 'cli-banner'].includes(element.id);
  const artworkSupported =
    ['welcome-email', 'logo-background', 'favicon-set', 'app-icon', 'x-post', 'linkedin-post', 'community-card', 'launch-card', 'event-backdrop', 'partnership-lockup', 'web-card', 'opengraph'].includes(
      element.id
    );
  const websiteSupported =
    ['welcome-email', 'transactional-email', 'email-signature', 'x-post', 'linkedin-post', 'community-card', 'launch-card', 'slide-title', 'slide-section', 'blog-cover', 'report-cover', 'press-kit', 'event-backdrop', 'business-card', 'packaging-label', 'letterhead', 'web-card', 'opengraph', 'error-page'].includes(
      element.id
    );

  return (
    <aside className='brand-elements-editor min-h-0 overflow-y-auto border-l border-border bg-background'>
      {!contentless || hasPerson || hasPartner ? <section className='element-editor-section'>
        <div className='element-editor-heading'>
          <h2><T>Content</T></h2>
          <Button aria-label={gt('Reset element')} onClick={onReset} size='icon-xs' title={gt('Reset element')} type='button' variant='ghost'>
            <RotateCcw aria-hidden='true' />
          </Button>
        </div>
        {eyebrowSupported ? <ElementTextControl label={<T>Eyebrow</T>} onChange={(eyebrow) => onChange({ eyebrow })} value={settings.eyebrow} /> : null}
        {!headlineHidden ? <ElementTextControl label={<T>Headline</T>} multiline onChange={(headline) => onChange({ headline })} value={settings.headline} /> : null}
        {!bodyHidden ? <ElementTextControl label={<T>Supporting copy</T>} multiline onChange={(body) => onChange({ body })} value={settings.body} /> : null}
        {actionSupported ? <ElementTextControl label={<T>Action</T>} onChange={(cta) => onChange({ cta })} value={settings.cta} /> : null}
        {hasPerson ? (
          <>
            <ElementTextControl label={<T>Name</T>} onChange={(personName) => onChange({ personName })} value={settings.personName} />
            <ElementTextControl label={<T>Role</T>} onChange={(personRole) => onChange({ personRole })} value={settings.personRole} />
          </>
        ) : null}
        {hasPartner ? (
          <ElementTextControl label={<T>Partner name</T>} onChange={(partnerName) => onChange({ partnerName })} value={settings.partnerName} />
        ) : null}
      </section> : null}

      {layoutSupported || scaleSupported || patternSupported ? <section className='element-editor-section'>
        <div className='element-editor-heading'><h2><T>Composition</T></h2></div>
        {layoutSupported ? <label className='element-editor-field'>
          <span><T>Layout</T></span>
          <select onChange={(event) => onChange({ layout: event.target.value as BrandElementSettings['layout'] })} value={settings.layout}>
            <option value='split'>{gt('Split')}</option>
            <option value='stacked'>{gt('Stacked')}</option>
            <option value='centered'>{gt('Centered')}</option>
          </select>
        </label> : null}
        {scaleSupported ? <label className='element-editor-field'>
          <span><T>Type scale</T></span>
          <select onChange={(event) => onChange({ scale: event.target.value as BrandElementSettings['scale'] })} value={settings.scale}>
            <option value='compact'>{gt('Compact')}</option>
            <option value='balanced'>{gt('Balanced')}</option>
            <option value='bold'>{gt('Bold')}</option>
          </select>
        </label> : null}
        {patternSupported ? <label className='element-editor-field'>
          <span><T>Pattern</T></span>
          <select onChange={(event) => onChange({ pattern: event.target.value as BrandElementSettings['pattern'] })} value={settings.pattern}>
            <option value='none'>{gt('None')}</option>
            <option value='dots'>{gt('Dots')}</option>
            <option value='grid'>{gt('Grid')}</option>
            <option value='dither'>{gt('Dither')}</option>
          </select>
        </label> : null}
        {patternSupported && settings.pattern !== 'none' ? <ElementRangeControl label={<T>Pattern opacity</T>} max={100} min={0} onChange={(patternOpacity) => onChange({ patternOpacity })} suffix='%' value={settings.patternOpacity} /> : null}
      </section> : null}

      {artworkSupported ? <section className='element-editor-section'>
        <div className='element-editor-heading'><h2><T>Artwork</T></h2></div>
        <ElementRangeControl label={<T>Horizontal</T>} max={120} min={-120} onChange={(artworkX) => onChange({ artworkX })} suffix='px' value={settings.artworkX} />
        <ElementRangeControl label={<T>Vertical</T>} max={120} min={-120} onChange={(artworkY) => onChange({ artworkY })} suffix='px' value={settings.artworkY} />
        <ElementRangeControl label={<T>Scale</T>} max={200} min={40} onChange={(artworkScale) => onChange({ artworkScale })} suffix='%' value={settings.artworkScale} />
      </section> : null}

      <section className='element-editor-section'>
        <div className='element-editor-heading'><h2><T>Color</T></h2></div>
        <ElementColorControl label={<T>Background</T>} onChange={(backgroundColor) => onChange({ backgroundColor })} value={settings.backgroundColor} />
        <ElementColorControl label={<T>Text</T>} onChange={(foregroundColor) => onChange({ foregroundColor })} value={settings.foregroundColor} />
        <ElementColorControl label={<T>Accent</T>} onChange={(accentColor) => onChange({ accentColor })} value={settings.accentColor} />
      </section>

      <section className='element-editor-section'>
        <div className='element-editor-heading'><h2><T>Brand details</T></h2></div>
        {logoSupported ? <label className='element-editor-toggle'>
          <span><T>Show logo</T></span>
          <input checked={settings.showLogo} onChange={(event) => onChange({ showLogo: event.target.checked })} type='checkbox' />
        </label> : null}
        {websiteSupported ? <label className='element-editor-toggle'>
          <span><T>Show website</T></span>
          <input checked={settings.showWebsite} onChange={(event) => onChange({ showWebsite: event.target.checked })} type='checkbox' />
        </label> : null}
      </section>
    </aside>
  );
}

function IdentityMark({
  className,
  identity,
  inverted = false,
  style,
}: {
  className: string;
  identity: BrandIdentity;
  inverted?: boolean;
  style?: CSSProperties;
}) {
  const path = brandAssetPath(identity, inverted ? 'mark-light' : 'mark-dark');
  if (path) return <img alt='' className={className} src={path} style={style} />;
  return (
    <span className={`${className} grid place-items-center font-semibold tracking-[-0.06em]`} style={style}>
      {identity.shortName}
    </span>
  );
}

function ElementFrame({ children }: { children: ReactNode }) {
  return (
    <div className='flex w-full max-w-5xl flex-col'>
      <div className='min-h-0 overflow-auto border border-border bg-muted/30 p-4 sm:p-7'>
        {children}
      </div>
    </div>
  );
}

function typeScale(settings: BrandElementSettings): string {
  if (settings.scale === 'compact') return 'text-3xl sm:text-4xl';
  if (settings.scale === 'bold') return 'text-5xl sm:text-7xl';
  return 'text-4xl sm:text-6xl';
}

function actionStyle(settings: BrandElementSettings): CSSProperties {
  return {
    backgroundColor: settings.accentColor,
    color: isDarkSurface(settings.accentColor) ? '#FFFFFF' : '#181818',
  };
}

function WelcomeEmailPreview({ identity, settings }: { identity: BrandIdentity; settings: BrandElementSettings }) {
  const motion = identity.motion.find(({ id }) => id === 'morph-1250')?.previewPath;
  const cards = identity.id === 'gt'
    ? [
        ['Add GT to your stack', 'Connect your product and start translating in context.', '文'],
        ['Join the Community', 'Meet builders working on products for every locale.', 'ع'],
        ['Let Locadex Open the PR', 'Turn translation work into reviewed repository changes.', 'A'],
      ]
    : [
        [`Add ${identity.shortName} to your stack`, 'Connect the identity to the product and its implementation.', '文'],
        ['Join the community', 'Carry the same voice into conversation and support.', 'ع'],
        ['Start shipping', 'Keep product, documentation, and communication together.', 'A'],
      ];
  const dark = isDarkSurface(settings.backgroundColor);

  return (
    <div className='relative mx-auto w-full max-w-[640px] overflow-hidden p-6 shadow-sm sm:p-8' style={elementSurfaceStyle(settings)}>
      <ElementPattern settings={settings} />
      <div className='relative z-10'>
        {settings.showLogo ? <IdentityMark className='mb-7 size-10 object-contain text-lg' identity={identity} inverted={dark} /> : null}
        <div className='mb-8 grid aspect-[10/3] place-items-center overflow-hidden' style={{ backgroundColor: settings.accentColor }}>
          {motion ? (
            <img alt='' className='size-full object-cover' src={motion} style={artworkStyle(settings)} />
          ) : (
            <p className='max-w-[85%] text-center text-2xl font-semibold tracking-[-0.04em] text-white sm:text-4xl'>{identity.greetings.join(' · ')}</p>
          )}
        </div>
        {settings.eyebrow ? <p className='mb-3 font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p> : null}
        <h2 className='text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl'>{settings.headline}</h2>
        <p className='mt-4 text-sm opacity-80'>Hi Alex,</p>
        <p className='mt-2 max-w-xl text-base leading-7 opacity-65'>{settings.body}</p>
        {settings.cta ? <span className='mt-6 inline-block px-5 py-3 text-sm font-semibold' style={actionStyle(settings)}>{settings.cta} →</span> : null}
        <div className='mt-10 flex flex-col gap-3'>
          {cards.map(([title, body, letter]) => (
            <div className='grid min-h-28 grid-cols-[1fr_104px] overflow-hidden' key={title} style={{ backgroundColor: `color-mix(in srgb, ${settings.foregroundColor} 6%, ${settings.backgroundColor})` }}>
              <div className='p-5'>
                <p className='text-base font-semibold'>{title}</p>
                <p className='mt-2 text-sm leading-5 opacity-60'>{body}</p>
                <p className='mt-3 text-xs font-semibold'>Open →</p>
              </div>
              <div className='grid place-items-center overflow-hidden text-7xl font-semibold opacity-10'>{letter}</div>
            </div>
          ))}
        </div>
        <div className='mt-6 flex items-center justify-between gap-4 text-xs leading-5 opacity-50'><p>Questions? Reply and the {identity.name} team will help.</p>{settings.showWebsite ? <p className='font-mono'>{identity.website}</p> : null}</div>
      </div>
    </div>
  );
}

function TransactionalEmailPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  const dark = isDarkSurface(settings.backgroundColor);
  if (element.id === 'email-signature') {
    return (
      <div className='relative mx-auto flex w-full max-w-xl items-center gap-5 overflow-hidden p-8 shadow-sm' style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        {settings.showLogo ? <IdentityMark className='relative size-14 object-contain text-xl' identity={identity} inverted={dark} /> : null}
        <div className='relative border-l pl-5 text-sm' style={{ borderColor: settings.foregroundColor }}>
          <p className='font-semibold'>{settings.personName}</p>
          <p className='mt-1 opacity-60'>{settings.personRole}</p>
          {settings.showWebsite ? <p className='mt-2 font-mono text-xs opacity-45'>{identity.website}</p> : null}
        </div>
      </div>
    );
  }
  return (
    <div className='relative mx-auto w-full max-w-xl overflow-hidden p-8 shadow-sm' style={elementSurfaceStyle(settings)}>
      <ElementPattern settings={settings} />
      <div className='relative z-10'>
        {settings.showLogo ? <IdentityMark className='size-9 object-contain text-sm' identity={identity} inverted={dark} /> : null}
        {settings.eyebrow ? <p className='mt-12 font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p> : null}
        <h2 className='mt-4 text-3xl font-semibold tracking-[-0.04em]'>{settings.headline}</h2>
        <p className='mt-4 text-base leading-7 opacity-60'>{settings.body}</p>
        {settings.cta ? <span className='mt-7 inline-block px-5 py-3 text-sm font-semibold' style={actionStyle(settings)}>{settings.cta} →</span> : null}
        {settings.showWebsite ? <p className='mt-12 border-t pt-5 text-xs opacity-45' style={{ borderColor: settings.foregroundColor }}>{identity.website}</p> : null}
      </div>
    </div>
  );
}

function EmailPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  return element.id === 'welcome-email' ? <WelcomeEmailPreview identity={identity} settings={settings} /> : <TransactionalEmailPreview element={element} identity={identity} settings={settings} />;
}

function DeveloperPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  const ascii = (
    identity.shortName === 'GT'
      ? [
          ' ██████╗ ████████╗',
          '██╔════╝ ╚══██╔══╝',
          '██║  ███╗   ██║   ',
          '██║   ██║   ██║   ',
          '╚██████╔╝   ██║   ',
          ' ╚═════╝    ╚═╝   ',
        ]
      : identity.shortName === 'ST'
        ? [
            '███████╗████████╗',
            '██╔════╝╚══██╔══╝',
            '███████╗   ██║   ',
            '╚════██║   ██║   ',
            '███████║   ██║   ',
            '╚══════╝   ╚═╝   ',
          ]
        : [
            '┏━━━━━━━━━━━━━━━━━━━━━━┓',
            `┃      ${identity.shortName.padEnd(10, ' ')}      ┃`,
            '┣━━━━━━━━━━━━━━━━━━━━━━┫',
            '┃  ███  BRAND  ███     ┃',
            '┗━━━━━━━━━━━━━━━━━━━━━━┛',
          ]
  ).join('\n');
  const dark = isDarkSurface(settings.backgroundColor);

  if (element.id === 'ascii-mark') {
    return (
      <div className='relative mx-auto grid min-h-[440px] w-full max-w-4xl place-items-center overflow-hidden p-8 shadow-sm' style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        <div className='relative z-10 text-center'>
          <pre className='overflow-x-auto font-mono text-xs leading-5 sm:text-base'>{ascii}</pre>
          <p className='mt-8 max-w-lg text-sm leading-6 opacity-55'>{settings.body}</p>
        </div>
      </div>
    );
  }

  if (element.id === 'terminal-theme') {
    return (
      <div className='relative mx-auto w-full max-w-4xl overflow-hidden p-6 font-mono shadow-xl sm:p-10' style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        <div className='relative z-10'>
          <div className='mb-10 flex items-center justify-between border-b pb-4 text-xs opacity-45' style={{ borderColor: settings.foregroundColor }}>
            <span>{settings.eyebrow}</span><span>● ● ●</span>
          </div>
          <p><span style={{ color: settings.accentColor }}>import</span> {'{ '}tx{' }'} <span style={{ color: settings.accentColor }}>from</span> &apos;{identity.id}&apos;;</p>
          <p className='mt-6'><span style={{ color: settings.accentColor }}>export function</span> Greeting() {'{'}</p>
          <p className='ml-5 mt-2 opacity-70'>return &lt;h1&gt;{'{'}tx(&apos;Hello, world&apos;){'}'}&lt;/h1&gt;;</p>
          <p className='mt-2'>{'}'}</p>
          <h2 className='mt-12 text-2xl font-semibold tracking-tight'>{settings.headline}</h2>
        </div>
      </div>
    );
  }

  if (['github-readme', 'docs-header', 'package-card'].includes(element.id)) {
    return (
      <div className={`relative mx-auto grid w-full max-w-4xl overflow-hidden shadow-sm ${element.id === 'package-card' ? 'aspect-[8/5]' : 'aspect-[16/7]'} ${settings.layout === 'centered' ? 'place-items-center text-center' : 'grid-cols-[1.15fr_0.85fr]'}`} style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        <div className='relative z-10 flex flex-col justify-center p-8 sm:p-12'>
          {settings.showLogo ? <IdentityMark className='mb-8 size-10 object-contain text-sm' identity={identity} inverted={dark} /> : null}
          {settings.eyebrow ? <p className='font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p> : null}
          <h2 className='mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl'>{settings.headline}</h2>
          <p className='mt-4 max-w-xl text-sm leading-6 opacity-60'>{settings.body}</p>
          {settings.cta ? <code className='mt-6 w-fit border px-3 py-2 text-xs' style={{ borderColor: settings.foregroundColor }}>{settings.cta}</code> : null}
        </div>
        {settings.layout !== 'centered' ? (
          <div className='relative z-10 grid place-items-center p-8' style={{ backgroundColor: settings.accentColor, color: isDarkSurface(settings.accentColor) ? '#FFFFFF' : '#181818' }}>
            <span className='font-mono text-6xl font-semibold tracking-[-0.08em]'>{element.id === 'package-card' ? '{}' : identity.shortName}</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className='relative mx-auto w-full max-w-4xl overflow-hidden shadow-xl' style={elementSurfaceStyle(settings)}>
      <ElementPattern settings={settings} />
      <div className='relative z-10 flex items-center justify-between border-b px-5 py-4' style={{ borderColor: settings.foregroundColor }}>
        <span className='font-mono text-xs opacity-50'>{identity.id}</span>
        <span className='size-2' style={{ backgroundColor: settings.accentColor }} />
      </div>
      <div className='relative z-10 p-6 sm:p-10'>
        <pre className='overflow-x-auto font-mono text-xs leading-5 sm:text-sm'>{ascii}</pre>
        <p className='mt-8 font-mono text-sm opacity-45'>$ {settings.cta || `npx ${identity.id} init`}</p>
        <p className='mt-3 font-mono text-sm'>✓ {identity.name} installed</p>
        <p className='mt-2 font-mono text-sm' style={{ color: settings.accentColor }}>✓ Brand context loaded</p>
        <p className='mt-8 max-w-xl text-2xl font-semibold tracking-[-0.035em]'>{settings.headline}</p>
      </div>
    </div>
  );
}

function SocialPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  const dark = isDarkSurface(settings.backgroundColor);
  const square = element.id === 'linkedin-post';
  const centered = settings.layout === 'centered';
  return (
    <div className={`relative mx-auto grid w-full overflow-hidden shadow-sm ${square ? 'aspect-square max-w-3xl' : 'aspect-[16/9] max-w-4xl'} ${centered ? 'place-items-center text-center' : settings.layout === 'stacked' ? 'grid-cols-1' : 'grid-cols-[1fr_0.72fr]'}`} style={elementSurfaceStyle(settings)}>
      <ElementPattern settings={settings} />
      <div className='relative z-10 flex flex-col justify-between p-8 sm:p-12'>
        <div className='flex items-center gap-3'>
          {settings.showLogo ? <IdentityMark className='size-11 object-contain text-xs' identity={identity} inverted={dark} /> : null}
          <div>
            <p className='text-sm font-semibold'>{identity.name}</p>
            {settings.eyebrow ? <p className='font-mono text-xs opacity-45'>{settings.eyebrow}</p> : null}
          </div>
        </div>
        <div className={centered ? 'my-auto' : ''}>
          <p className={`max-w-2xl font-semibold leading-[1.02] tracking-[-0.05em] ${typeScale(settings)}`}>{settings.headline}</p>
          {settings.body ? <p className='mt-5 max-w-xl text-sm leading-6 opacity-60'>{settings.body}</p> : null}
          {settings.cta ? <p className='mt-6 text-sm font-semibold'>{settings.cta} →</p> : null}
        </div>
        {settings.showWebsite ? <p className='font-mono text-xs opacity-40'>{identity.website}</p> : <span />}
      </div>
      {!centered && settings.layout === 'split' ? <div className='relative z-10 grid place-items-center overflow-hidden' style={{ backgroundColor: settings.accentColor }}><IdentityMark className='relative size-36 object-contain text-5xl' identity={identity} inverted={isDarkSurface(settings.accentColor)} style={artworkStyle(settings)} /></div> : null}
    </div>
  );
}

function EditorialPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  const dark = isDarkSurface(settings.backgroundColor);
  const portrait = element.id === 'report-cover';
  const pressKit = element.id === 'press-kit';
  return (
    <div className={`relative mx-auto flex w-full flex-col justify-between overflow-hidden p-8 shadow-sm sm:p-14 ${portrait ? 'aspect-[4/5] max-w-2xl' : 'aspect-[16/9] max-w-5xl'} ${settings.layout === 'centered' ? 'items-center text-center' : ''}`} style={elementSurfaceStyle(settings)}>
      <ElementPattern settings={settings} />
      <div className='relative z-10 flex w-full items-center justify-between'>
        {settings.showLogo ? <IdentityMark className='size-9 object-contain text-sm' identity={identity} inverted={dark} /> : <span />}
        {settings.eyebrow ? <span className='font-mono text-xs uppercase tracking-widest opacity-40'>{settings.eyebrow}</span> : null}
      </div>
      <div className='relative z-10 max-w-4xl'>
        <h2 className={`font-semibold leading-[0.96] tracking-[-0.055em] ${typeScale(settings)}`}>{settings.headline}</h2>
        {settings.body ? <p className='mt-6 max-w-2xl text-sm leading-6 opacity-60'>{settings.body}</p> : null}
      </div>
      <div className='relative z-10 flex w-full items-end justify-between border-t pt-4 font-mono text-xs opacity-45' style={{ borderColor: settings.foregroundColor }}>
        <span>{settings.showWebsite ? identity.website : identity.name}</span>
        <span>{pressKit ? 'LOGOS / IMAGES / CONTACT' : identity.shortName}</span>
      </div>
    </div>
  );
}

function EventPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  const dark = isDarkSurface(settings.backgroundColor);
  const isLockup = element.id === 'partnership-lockup';
  if (isLockup) {
    return (
      <div className='relative mx-auto flex aspect-[16/9] w-full max-w-4xl items-center justify-center gap-10 overflow-hidden p-12 shadow-sm' style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        {settings.showLogo ? <IdentityMark className='relative size-28 object-contain text-4xl' identity={identity} inverted={dark} style={artworkStyle(settings)} /> : null}
        <span className='relative h-28 w-px opacity-20' style={{ backgroundColor: settings.foregroundColor }} />
        <div className='relative grid size-28 place-items-center font-mono text-3xl font-semibold' style={{ backgroundColor: settings.accentColor, color: isDarkSurface(settings.accentColor) ? '#FFFFFF' : '#181818' }}>{settings.partnerName.slice(0, 2).toLocaleUpperCase()}</div>
      </div>
    );
  }
  if (element.id === 'event-backdrop') {
    return (
      <div className='relative mx-auto flex aspect-[16/9] w-full max-w-5xl flex-col justify-between overflow-hidden p-10 shadow-sm sm:p-16' style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        <div className='relative z-10 flex items-center justify-between'>{settings.showLogo ? <IdentityMark className='size-12 object-contain text-xl' identity={identity} inverted={dark} style={artworkStyle(settings)} /> : <span />}{settings.eyebrow ? <span className='font-mono text-xs uppercase tracking-widest opacity-50'>{settings.eyebrow}</span> : null}</div>
        <h2 className={`relative z-10 max-w-4xl font-semibold leading-[0.94] tracking-[-0.06em] ${typeScale(settings)}`}>{settings.headline}</h2>
        {settings.showWebsite ? <p className='relative z-10 font-mono text-xs opacity-50'>{identity.website}</p> : null}
      </div>
    );
  }
  return (
    <div className='mx-auto flex min-h-[560px] w-full max-w-3xl items-start justify-center overflow-hidden bg-[#ECECE8] p-8'>
      <div className='flex flex-col items-center'>
        <div className='h-24 w-8' style={{ backgroundColor: settings.accentColor }} />
        <div className='w-72 shadow-xl' style={elementSurfaceStyle(settings)}>
          <div className='flex h-32 items-center justify-center' style={{ backgroundColor: settings.accentColor }}>
            {settings.showLogo ? <IdentityMark className='size-20 object-contain text-2xl' identity={identity} inverted={isDarkSurface(settings.accentColor)} /> : null}
          </div>
          <div className='p-6'>
            {settings.eyebrow ? <p className='font-mono text-xs uppercase tracking-widest opacity-40'>{settings.eyebrow}</p> : null}
            <p className='mt-10 text-3xl font-semibold tracking-[-0.04em]'>{settings.personName}</p>
            <p className='mt-4 text-sm opacity-55'>{settings.personRole}</p>
            <div className='mt-10 flex items-end justify-between'>
              <span className='font-mono text-[10px] opacity-40'>{identity.shortName}</span>
              <div className='grid size-14 grid-cols-4 gap-0.5 bg-black p-1' aria-hidden='true'>
                {Array.from({ length: 16 }, (_, index) => <span className={index % 3 === 0 ? 'bg-white' : 'bg-black'} key={index} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhysicalPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  const dark = isDarkSurface(settings.backgroundColor);
  if (element.id === 'sticker-sheet') {
    return (
      <div className='relative mx-auto grid min-h-[560px] w-full max-w-4xl grid-cols-3 place-items-center gap-8 overflow-hidden p-10 shadow-sm' style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        {[identity.shortName, '✦', settings.headline, '→', '@', settings.body].map((item, index) => <div className={`relative z-10 grid place-items-center p-6 text-center font-semibold shadow-lg ${index % 2 === 0 ? 'aspect-square w-40 rounded-full' : 'h-28 w-48'}`} key={`${item}-${index}`} style={{ backgroundColor: index % 2 === 0 ? settings.accentColor : settings.foregroundColor, color: index % 2 === 0 && !isDarkSurface(settings.accentColor) ? '#181818' : settings.backgroundColor }}>{item}</div>)}
      </div>
    );
  }
  if (element.id === 'packaging-label') {
    return (
      <div className='mx-auto grid min-h-[520px] w-full max-w-4xl place-items-center bg-[#E9E9E5] p-10'>
        <div className='relative aspect-[3/2] w-full max-w-2xl overflow-hidden border p-8 shadow-xl' style={{ ...elementSurfaceStyle(settings), borderColor: settings.foregroundColor }}>
          <ElementPattern settings={settings} />
          <div className='relative z-10 flex h-full flex-col justify-between'>
            <div className='flex justify-between'>{settings.showLogo ? <IdentityMark className='size-12 object-contain text-lg' identity={identity} inverted={dark} /> : <span />}{settings.eyebrow ? <span className='font-mono text-xs opacity-45'>{settings.eyebrow}</span> : null}</div>
            <div><h2 className='text-4xl font-semibold tracking-[-0.05em]'>{settings.headline}</h2><p className='mt-3 max-w-md text-sm leading-6 opacity-55'>{settings.body}</p></div>
            {settings.showWebsite ? <span className='font-mono text-xs opacity-45'>{identity.website}</span> : null}
          </div>
        </div>
      </div>
    );
  }
  if (element.id === 'letterhead') {
    return (
      <div className='mx-auto min-h-[640px] w-full max-w-xl p-10 shadow-xl' style={elementSurfaceStyle(settings)}>
        <div className='flex items-start justify-between'>{settings.showLogo ? <IdentityMark className='size-10 object-contain text-sm' identity={identity} inverted={dark} /> : <span />}{settings.showWebsite ? <span className='font-mono text-xs opacity-45'>{identity.website}</span> : null}</div>
        <h2 className='mt-24 text-3xl font-semibold tracking-[-0.04em]'>{settings.headline}</h2>
        <p className='mt-8 text-sm leading-7 opacity-60'>{settings.body}</p>
        <p className='mt-6 text-sm leading-7 opacity-60'>{settings.body}</p>
        <div className='mt-24 h-px opacity-15' style={{ backgroundColor: settings.foregroundColor }} />
      </div>
    );
  }
  return (
    <div className='mx-auto grid min-h-[520px] w-full max-w-5xl place-items-center bg-[#E9E9E5] p-8 sm:p-14'>
      <div className='grid w-full max-w-4xl gap-8 md:grid-cols-2'>
        <div className='flex aspect-[1.75/1] flex-col justify-between p-7 shadow-xl' style={{ backgroundColor: settings.accentColor, color: isDarkSurface(settings.accentColor) ? '#FFFFFF' : '#181818' }}>
          {settings.showLogo ? <IdentityMark className='size-16 object-contain text-xl' identity={identity} inverted={isDarkSurface(settings.accentColor)} /> : null}
          <p className='font-mono text-xs uppercase tracking-widest opacity-45'>{identity.shortName}</p>
        </div>
        <div className='flex aspect-[1.75/1] flex-col justify-between p-7 shadow-xl' style={elementSurfaceStyle(settings)}>
          <div>
            <p className='text-xl font-semibold'>{settings.personName}</p>
            <p className='mt-1 text-sm opacity-55'>{settings.personRole}</p>
          </div>
          <div className='flex items-end justify-between gap-4 font-mono text-xs opacity-45'>
            {settings.showWebsite ? <span>{identity.website}<br />hello@{identity.website}</span> : <span />}
            {settings.showLogo ? <IdentityMark className='size-10 object-contain text-xs' identity={identity} inverted={dark} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WebPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  const dark = isDarkSurface(settings.backgroundColor);
  if (element.id === 'error-page') {
    return (
      <div className='relative mx-auto grid aspect-[16/10] w-full max-w-4xl place-items-center overflow-hidden p-10 text-center shadow-sm' style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        <div className='relative z-10 max-w-xl'>{settings.showLogo ? <IdentityMark className='mx-auto mb-10 size-10 object-contain text-sm' identity={identity} inverted={dark} /> : null}<p className='font-mono text-sm opacity-40'>{settings.eyebrow}</p><h2 className={`mt-3 font-semibold tracking-[-0.055em] ${typeScale(settings)}`}>{settings.headline}</h2><p className='mx-auto mt-5 max-w-md text-sm leading-6 opacity-60'>{settings.body}</p>{settings.cta ? <span className='mt-7 inline-block px-5 py-3 text-sm font-semibold' style={actionStyle(settings)}>{settings.cta} →</span> : null}</div>
      </div>
    );
  }
  return (
    <div className={`relative mx-auto grid w-full max-w-4xl overflow-hidden shadow-sm ${element.id === 'opengraph' ? 'aspect-[1200/630]' : 'aspect-[16/10]'} ${settings.layout === 'centered' ? 'place-items-center text-center' : settings.layout === 'stacked' ? 'grid-cols-1' : 'md:grid-cols-[1.2fr_0.8fr]'}`} style={elementSurfaceStyle(settings)}>
      <ElementPattern settings={settings} />
      <div className='relative z-10 flex flex-col justify-between p-8 sm:p-12'>
        {settings.showLogo ? <IdentityMark className='size-10 object-contain text-sm' identity={identity} inverted={dark} /> : <span />}
        <div>
          {settings.eyebrow ? <p className='font-mono text-xs uppercase tracking-widest opacity-40'>{settings.eyebrow}</p> : null}
          <h2 className={`mt-4 font-semibold leading-[1.02] tracking-[-0.055em] ${typeScale(settings)}`}>{settings.headline}</h2>
          {settings.body ? <p className='mt-5 max-w-lg text-sm leading-6 opacity-60'>{settings.body}</p> : null}
          {settings.cta ? <span className='mt-7 inline-block px-5 py-3 text-sm font-semibold' style={actionStyle(settings)}>{settings.cta} →</span> : null}
        </div>
        {settings.showWebsite ? <p className='font-mono text-xs opacity-40'>{identity.website}</p> : <span />}
      </div>
      {settings.layout === 'split' ? <div className='relative z-10 grid place-items-center p-10' style={{ backgroundColor: settings.accentColor }}><IdentityMark className='relative size-44 object-contain text-6xl' identity={identity} inverted={isDarkSurface(settings.accentColor)} style={artworkStyle(settings)} /></div> : null}
    </div>
  );
}

function LogoPreview({ identity, settings }: { identity: BrandIdentity; settings: BrandElementSettings }) {
  return (
    <div className='mx-auto grid aspect-[16/10] w-full max-w-4xl grid-cols-2 overflow-hidden shadow-sm'>
      <div className='relative grid place-items-center overflow-hidden p-10' style={{ backgroundColor: settings.backgroundColor, color: settings.foregroundColor }}><ElementPattern settings={settings} />{settings.showLogo ? <IdentityMark className='relative size-44 object-contain text-6xl' identity={identity} inverted={isDarkSurface(settings.backgroundColor)} style={artworkStyle(settings)} /> : null}</div>
      <div className='grid place-items-center overflow-hidden p-10' style={{ backgroundColor: settings.accentColor, color: isDarkSurface(settings.accentColor) ? '#FFFFFF' : '#181818' }}>{settings.showLogo ? <IdentityMark className='size-44 object-contain text-6xl' identity={identity} inverted={isDarkSurface(settings.accentColor)} style={artworkStyle(settings)} /> : null}</div>
    </div>
  );
}

function IconPreview({ identity, settings }: { identity: BrandIdentity; settings: BrandElementSettings }) {
  return (
    <div className='mx-auto grid w-full max-w-3xl grid-cols-2 gap-px bg-border shadow-sm sm:grid-cols-4'>
      {[32, 64, 128, 256, 512, 1024, 64, 128].map((size, index) => (
        <div className='grid aspect-square place-items-center p-6' key={`${size}-${index}`} style={{ backgroundColor: index % 3 === 0 ? settings.accentColor : settings.backgroundColor, color: index % 3 === 0 ? settings.backgroundColor : settings.foregroundColor }}>
          {settings.showLogo ? <IdentityMark className='size-2/3 object-contain text-2xl' identity={identity} inverted={isDarkSurface(index % 3 === 0 ? settings.accentColor : settings.backgroundColor)} style={artworkStyle(settings)} /> : null}
          <span className='mt-3 font-mono text-[10px] opacity-40'>{size} PX</span>
        </div>
      ))}
    </div>
  );
}

function ElementPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  switch (element.preview) {
    case 'email':
      return <EmailPreview element={element} identity={identity} settings={settings} />;
    case 'developer':
      return <DeveloperPreview element={element} identity={identity} settings={settings} />;
    case 'social':
      return <SocialPreview element={element} identity={identity} settings={settings} />;
    case 'editorial':
      return <EditorialPreview element={element} identity={identity} settings={settings} />;
    case 'event':
      return <EventPreview element={element} identity={identity} settings={settings} />;
    case 'physical':
      return <PhysicalPreview element={element} identity={identity} settings={settings} />;
    case 'logo':
      return <LogoPreview identity={identity} settings={settings} />;
    case 'icon':
      return <IconPreview identity={identity} settings={settings} />;
    case 'web':
      return <WebPreview element={element} identity={identity} settings={settings} />;
  }
}

export default function BrandElementsStudio({
  identity,
  tool,
}: {
  identity: BrandIdentity;
  tool: StudioTool;
}) {
  const gt = useGT();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useStudioDraft<BrandElementCategory | 'All'>(
    identity.id,
    tool.id,
    'category',
    'All'
  );
  const [selectedElementId, setSelectedElementId] = useStudioDraft(
    identity.id,
    tool.id,
    'selected-element',
    'welcome-email'
  );
  const [elementOverrides, setElementOverrides] = useStudioDraft<
    Record<string, BrandElementOverrides>
  >(identity.id, tool.id, 'element-settings', {});
  const filteredElements = useMemo(
    () =>
      filterBrandElements(BRAND_ELEMENTS, query).filter(
        (element) => category === 'All' || element.category === category
      ),
    [category, query]
  );
  const selectedElement =
    BRAND_ELEMENTS.find(({ id }) => id === selectedElementId) ?? BRAND_ELEMENTS[0]!;
  const selectedSettings = {
    ...createBrandElementSettings(selectedElement, identity),
    ...elementOverrides[selectedElement.id],
  };

  function updateSelectedSettings(patch: BrandElementOverrides) {
    setElementOverrides((current) => ({
      ...current,
      [selectedElement.id]: { ...current[selectedElement.id], ...patch },
    }));
  }

  function resetSelectedSettings() {
    setElementOverrides((current) => {
      const next = { ...current };
      delete next[selectedElement.id];
      return next;
    });
  }

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='brand-elements-header tool-header flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{tool.name}</p>
          <p className='truncate text-sm text-muted-foreground'>{tool.description}</p>
        </div>
        <Button onClick={() => downloadElementBrief(identity, selectedElement, selectedSettings)} type='button' variant='outline'>
          <Download aria-hidden='true' />
          <T>Element brief</T>
        </Button>
      </header>

      <div className='brand-elements-body tool-body'>
        <aside className='brand-elements-catalog tool-inspector min-h-0 overflow-y-auto border-r border-border bg-background'>
          <div className='flex flex-col gap-3 border-b border-border p-4'>
            <label className='flex h-9 items-center gap-2 rounded-md border border-input px-3 focus-within:border-foreground'>
              <Search className='size-4 text-muted-foreground' aria-hidden='true' />
              <input
                aria-label={gt('Search brand elements')}
                className='min-w-0 flex-1 bg-transparent text-sm outline-none'
                onChange={(event) => setQuery(event.target.value)}
                placeholder={gt('Email, ASCII, lanyard…')}
                value={query}
              />
            </label>
            <select
              aria-label={gt('Brand element category')}
              className='h-9 rounded-md border border-input bg-background px-3 text-sm outline-none'
              onChange={(event) => setCategory(event.target.value as BrandElementCategory | 'All')}
              value={category}
            >
              <option value='All'>{gt('All elements')}</option>
              {BRAND_ELEMENT_CATEGORIES.map((item) => <option key={item} value={item}>{gt(item)}</option>)}
            </select>
          </div>
          <div className='flex flex-col py-2'>
            {BRAND_ELEMENT_CATEGORIES.map((elementCategory) => {
              const elements = filteredElements.filter((element) => element.category === elementCategory);
              if (elements.length === 0) return null;
              const Icon = CATEGORY_ICONS[elementCategory];
              return (
                <section className='flex flex-col gap-1 px-2 py-2' key={elementCategory}>
                  <div className='flex items-center gap-2 px-2 py-1 text-xs uppercase tracking-widest text-muted-foreground'>
                    <Icon className='size-3.5' aria-hidden='true' />
                    <span>{gt(elementCategory)}</span>
                    <span className='ml-auto font-mono'>{elements.length}</span>
                  </div>
                  {elements.map((element) => (
                    <Button
                      className='relative h-auto min-h-11 w-full justify-start overflow-hidden rounded-none px-2 py-2 text-left'
                      key={element.id}
                      onClick={() => setSelectedElementId(element.id)}
                      type='button'
                      variant={selectedElement.id === element.id ? 'default' : 'ghost'}
                    >
                      <span className='relative z-10 min-w-0 flex-1 pr-14'>
                        <span className='block truncate text-sm'>{gt(element.name)}</span>
                        <span className={`block truncate font-mono text-[10px] ${selectedElement.id === element.id ? 'text-primary-foreground/55' : 'text-muted-foreground'}`}>
                          {element.dimensions}
                        </span>
                      </span>
                      <span
                        aria-hidden='true'
                        className={`pointer-events-none absolute top-1/2 right-1 -translate-y-1/2 font-mono text-[28px] font-semibold leading-none tracking-[-0.08em] ${
                          selectedElement.id === element.id
                            ? 'text-primary-foreground/12'
                            : 'text-foreground/7'
                        }`}
                      >
                        {element.symbol}
                      </span>
                    </Button>
                  ))}
                </section>
              );
            })}
            {filteredElements.length === 0 ? (
              <div className='flex flex-col items-center gap-3 px-5 py-12 text-center'>
                <FileText className='size-5 text-muted-foreground' aria-hidden='true' />
                <p className='text-sm font-medium'><T>No elements found</T></p>
                <p className='text-xs leading-5 text-muted-foreground'><T>Try a medium, format, or application.</T></p>
              </div>
            ) : null}
          </div>
        </aside>

        <div className='brand-elements-canvas tool-canvas min-h-0 overflow-auto'>
          <div className='flex min-h-full flex-col'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-3'>
              <select
                aria-label={gt('Active brand element')}
                className='brand-elements-mobile-select hidden h-9 rounded-md border border-input bg-background px-3 text-sm outline-none'
                onChange={(event) => setSelectedElementId(event.target.value)}
                value={selectedElement.id}
              >
                {BRAND_ELEMENT_CATEGORIES.map((elementCategory) => (
                  <optgroup key={elementCategory} label={gt(elementCategory)}>
                    {BRAND_ELEMENTS.filter((element) => element.category === elementCategory).map((element) => (
                      <option key={element.id} value={element.id}>{gt(element.name)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div>
                <p className='text-sm font-semibold'>{selectedElement.name}</p>
              </div>
              <div className='flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                <span className='rounded-md border border-border px-2 py-1'>{selectedElement.dimensions}</span>
                <span className='rounded-md border border-border px-2 py-1'>{selectedElement.format}</span>
              </div>
            </div>
            <CanvasViewport className='min-h-[560px] flex-1' identityId={identity.id} stageClassName='grid min-h-[560px] place-items-center p-5 sm:p-8' toolId={tool.id}>
              <ElementFrame>
                <ElementPreview element={selectedElement} identity={identity} settings={selectedSettings} />
              </ElementFrame>
            </CanvasViewport>
          </div>
        </div>
        <ElementEditor
          element={selectedElement}
          onChange={updateSelectedSettings}
          onReset={resetSelectedSettings}
          settings={selectedSettings}
        />
      </div>
    </div>
  );
}
