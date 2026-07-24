'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  Badge,
  BriefcaseBusiness,
  Component,
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
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
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
import {
  brandAssetPath,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { hexToOklch } from '@/lib/color';
import { DEFAULT_LOGO_APPEARANCE, logoAppearanceCssFilter } from '@/lib/logoAppearance';
import type { StudioTool } from '@/lib/studioCatalog';
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';

const CATEGORY_ICONS: Record<BrandElementCategory, typeof Mail> = {
  Developer: TerminalSquare,
  Digital: Mail,
  Editorial: Presentation,
  Event: Badge,
  Physical: BriefcaseBusiness,
  Product: Component,
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
    <ColorControl
      ariaLabel={typeof label === 'string' ? label : 'Element color'}
      label={label}
      onChange={onChange}
      value={value}
    />
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
  const resolvedValue = Math.min(value, max);
  return (
    <label className='element-editor-range'>
      <span><span>{label}</span><output>{resolvedValue}{suffix}</output></span>
      <input className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type='range' value={resolvedValue} />
    </label>
  );
}

function ElementEditor({
  element,
  identity,
  onChange,
  onReset,
  settings,
}: {
  element: BrandElement;
  identity: BrandIdentity;
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
    !contentless &&
    !personOnly &&
    !['ascii-mark', 'terminal-theme', 'partnership-lockup', 'slide-title', 'slide-section', 'report-cover', 'press-kit', 'event-backdrop', 'booth-wall'].includes(element.id);
  const layoutSupported =
    !contentless &&
    !personOnly &&
    !['ascii-mark', 'terminal-theme', 'cli-banner', 'partnership-lockup', 'event-backdrop', 'booth-wall'].includes(element.id);
  const scaleSupported =
    layoutSupported && !['form-controls', 'settings-panel', 'data-table'].includes(element.id);
  const patternSupported =
    !['email-signature', 'lanyard', 'event-badge', 'business-card', 'letterhead', 'favicon-set', 'app-icon'].includes(
      element.id
    );
  const logoSupported = !['ascii-mark', 'terminal-theme', 'cli-banner'].includes(element.id);
  const artworkSupported =
    ['welcome-email', 'logo-background', 'favicon-set', 'app-icon', 'x-post', 'linkedin-post', 'community-card', 'launch-card', 'app-store-gallery', 'video-thumbnail', 'podcast-cover', 'social-carousel', 'event-backdrop', 'booth-wall', 'partnership-lockup', 'web-card', 'opengraph'].includes(
      element.id
    );
  const websiteSupported =
    !contentless && !['ascii-mark', 'terminal-theme', 'cli-banner', 'modal-dialog', 'toast-notification'].includes(element.id);

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
        {layoutSupported ? <div className='element-editor-field'>
          <span><T>Layout</T></span>
          <StudioSelect ariaLabel={gt('Layout')} onValueChange={(layout) => onChange({ layout: layout as BrandElementSettings['layout'] })} options={[
            { label: gt('Split'), value: 'split' },
            { label: gt('Stacked'), value: 'stacked' },
            { label: gt('Centered'), value: 'centered' },
          ]} value={settings.layout} />
        </div> : null}
        {scaleSupported ? <div className='element-editor-field'>
          <span><T>Type scale</T></span>
          <StudioSelect ariaLabel={gt('Type scale')} onValueChange={(scale) => onChange({ scale: scale as BrandElementSettings['scale'] })} options={[
            { label: gt('Compact'), value: 'compact' },
            { label: gt('Balanced'), value: 'balanced' },
            { label: gt('Bold'), value: 'bold' },
          ]} value={settings.scale} />
        </div> : null}
        {patternSupported ? <div className='element-editor-field'>
          <span><T>Pattern</T></span>
          <StudioSelect ariaLabel={gt('Pattern')} onValueChange={(pattern) => onChange({ pattern: pattern as BrandElementSettings['pattern'] })} options={[
            { label: gt('None'), value: 'none' },
            { label: gt('Dots'), value: 'dots' },
            { label: gt('Grid'), value: 'grid' },
            { label: gt('Dither'), value: 'dither' },
          ]} value={settings.pattern} />
        </div> : null}
        {patternSupported && settings.pattern !== 'none' ? <ElementRangeControl label={<T>Pattern opacity</T>} max={100} min={0} onChange={(patternOpacity) => onChange({ patternOpacity })} suffix='%' value={settings.patternOpacity} /> : null}
      </section> : null}

      <section className='element-editor-section'>
        <div className='element-editor-heading'><h2><T>Typography</T></h2></div>
        <div className='element-editor-field'>
          <span><T>Font role</T></span>
          <StudioSelect ariaLabel={gt('Font role')} onValueChange={(fontRole) => onChange({ fontRole: fontRole as BrandElementSettings['fontRole'], fontWeight: brandTypographyRole(identity, fontRole as BrandElementSettings['fontRole']).weight })} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={settings.fontRole} />
        </div>
        <ElementRangeControl label={<T>Weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(fontWeight) => onChange({ fontWeight })} suffix='' value={settings.fontWeight} />
      </section>

      <section className='element-editor-section'>
        <div className='element-editor-heading'><h2><T>Shared asset</T></h2></div>
        <div className='element-editor-field'>
          <span><T>Library asset</T></span>
          <StudioSelect ariaLabel={gt('Library asset')} onValueChange={(assetId) => onChange({ assetId })} options={[
            { label: gt('No shared asset'), value: '' },
            ...[...identity.assets, ...identity.proofAssets].map((asset) => ({ label: `${asset.label} · ${asset.type}`, value: asset.id })),
          ]} value={settings.assetId} />
        </div>
        {settings.assetId ? <>
          <div className='element-editor-field'>
            <span><T>Placement</T></span>
            <StudioSelect ariaLabel={gt('Asset placement')} onValueChange={(assetPlacement) => onChange({ assetPlacement: assetPlacement as BrandElementSettings['assetPlacement'] })} options={[
              { label: gt('Background'), value: 'background' },
              { label: gt('Header'), value: 'header' },
              { label: gt('Banner'), value: 'banner' },
              { label: gt('Card'), value: 'card' },
            ]} value={settings.assetPlacement} />
          </div>
          <ElementRangeControl label={<T>Asset opacity</T>} max={100} min={0} onChange={(assetOpacity) => onChange({ assetOpacity })} suffix='%' value={settings.assetOpacity} />
        </> : null}
      </section>

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
        {logoSupported && settings.showLogo ? (
          <div className='mt-2 border-t border-border pt-4'>
            <LogoAppearanceControls
              onChange={(patch) => onChange({ logoAppearance: { ...DEFAULT_LOGO_APPEARANCE, ...settings.logoAppearance, ...patch } })}
              settings={{ ...DEFAULT_LOGO_APPEARANCE, ...settings.logoAppearance }}
            />
          </div>
        ) : null}
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
  if (path) return <img alt='' className={`brand-identity-mark ${className}`} src={path} style={style} />;
  return (
    <span className={`brand-identity-mark ${className} grid place-items-center font-semibold tracking-[-0.03em]`} style={style}>
      {identity.shortName}
    </span>
  );
}

function declaredAspectRatio(dimensions: string): number | undefined {
  const match = dimensions.match(/([\d.]+)\s*(?:×|:|x)\s*([\d.]+)/i);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  return width / height;
}

function ElementFrame({ aspectRatio, children, codeFontFamily, fontFamily, fontWeight, logoFilter }: { aspectRatio?: number; children: ReactNode; codeFontFamily: string; fontFamily: string; fontWeight: number; logoFilter: string }) {
  const visibleFontWeight = capVisibleFontWeight(fontWeight);
  return (
    <div
      className='flex w-full max-w-5xl flex-col'
      style={{
        '--brand-element-font': fontFamily,
        '--brand-element-weight': visibleFontWeight,
        '--brand-font-code': codeFontFamily,
        '--brand-logo-filter': logoFilter,
        fontFamily,
        fontWeight: visibleFontWeight,
      } as CSSProperties}
    >
      <div className='min-h-0 overflow-auto border border-border bg-muted/30 p-4 sm:p-7'>
        <div
          className='brand-element-artboard mx-auto'
          data-ratio-locked={aspectRatio ? 'true' : undefined}
          style={aspectRatio ? { aspectRatio } : undefined}
        >
          {children}
        </div>
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
    : identity.applications.slice(0, 3).map(({ description, name }, index) => [
        name,
        description,
        `0${index + 1}`,
      ]);
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
      <div className='relative mx-auto w-full max-w-4xl overflow-hidden border p-6 font-mono sm:p-10' style={{ ...elementSurfaceStyle(settings), borderColor: settings.foregroundColor }}>
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

  if (['github-readme', 'docs-header', 'package-card', 'api-reference-hero', 'code-playground', 'release-notes'].includes(element.id)) {
    return (
      <div className={`relative mx-auto grid w-full max-w-4xl overflow-hidden shadow-sm ${element.id === 'package-card' ? 'aspect-[8/5]' : 'aspect-[16/7]'} ${settings.layout === 'centered' ? 'place-items-center text-center' : settings.layout === 'stacked' ? 'grid-cols-1' : 'grid-cols-[1.15fr_0.85fr]'}`} style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        <div className='relative z-10 flex flex-col justify-center p-8 sm:p-12'>
          {settings.showLogo ? <IdentityMark className='mb-8 size-10 object-contain text-sm' identity={identity} inverted={dark} /> : null}
          {settings.eyebrow ? <p className='font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p> : null}
          <h2 className='mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-5xl'>{settings.headline}</h2>
          <p className='mt-4 max-w-xl text-sm leading-6 opacity-60'>{settings.body}</p>
          {settings.cta ? <code className='mt-6 w-fit border px-3 py-2 text-xs' style={{ borderColor: settings.foregroundColor }}>{settings.cta}</code> : null}
        </div>
        {settings.layout === 'split' ? (
          <div className='relative z-10 grid place-items-center p-8' style={{ backgroundColor: settings.accentColor, color: isDarkSurface(settings.accentColor) ? '#FFFFFF' : '#181818' }}>
            <span className='font-mono text-6xl font-semibold tracking-[-0.08em]'>{element.id === 'package-card' ? '{}' : identity.shortName}</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className='relative mx-auto w-full max-w-4xl overflow-hidden border' style={{ ...elementSurfaceStyle(settings), borderColor: settings.foregroundColor }}>
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
  const square = ['linkedin-post', 'podcast-cover'].includes(element.id);
  const portrait = element.id === 'social-carousel';
  const centered = settings.layout === 'centered';
  return (
    <div className={`relative mx-auto grid w-full overflow-hidden shadow-sm ${square ? 'aspect-square max-w-3xl' : portrait ? 'aspect-[4/5] max-w-2xl' : 'aspect-[16/9] max-w-4xl'} ${centered ? 'place-items-center text-center' : settings.layout === 'stacked' ? 'grid-cols-1' : 'grid-cols-[1fr_0.72fr]'}`} style={elementSurfaceStyle(settings)}>
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
  const portrait = ['report-cover', 'whitepaper-cover', 'notebook-cover'].includes(element.id);
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
  if (['event-backdrop', 'booth-wall'].includes(element.id)) {
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
    <div className='mx-auto flex min-h-[560px] w-full max-w-3xl items-start justify-center overflow-hidden p-8' style={{ backgroundColor: `color-mix(in srgb, ${settings.foregroundColor} 5%, ${settings.backgroundColor})` }}>
      <div className='flex flex-col items-center'>
        <div className='h-24 w-8' style={{ backgroundColor: settings.accentColor }} />
        <div className='w-72 border' style={{ ...elementSurfaceStyle(settings), borderColor: settings.foregroundColor }}>
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
      <div className='mx-auto grid min-h-[520px] w-full max-w-4xl place-items-center p-10' style={{ backgroundColor: `color-mix(in srgb, ${settings.foregroundColor} 5%, ${settings.backgroundColor})` }}>
        <div className='relative aspect-[3/2] w-full max-w-2xl overflow-hidden border p-8' style={{ ...elementSurfaceStyle(settings), borderColor: settings.foregroundColor }}>
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
      <div className='mx-auto min-h-[640px] w-full max-w-xl border p-10' style={{ ...elementSurfaceStyle(settings), borderColor: settings.foregroundColor }}>
        <div className='flex items-start justify-between'>{settings.showLogo ? <IdentityMark className='size-10 object-contain text-sm' identity={identity} inverted={dark} /> : <span />}{settings.showWebsite ? <span className='font-mono text-xs opacity-45'>{identity.website}</span> : null}</div>
        <h2 className='mt-24 text-3xl font-semibold tracking-[-0.04em]'>{settings.headline}</h2>
        <p className='mt-8 text-sm leading-7 opacity-60'>{settings.body}</p>
        <p className='mt-6 text-sm leading-7 opacity-60'>{settings.body}</p>
        <div className='mt-24 h-px opacity-15' style={{ backgroundColor: settings.foregroundColor }} />
      </div>
    );
  }
  return (
    <div className='mx-auto grid min-h-[520px] w-full max-w-5xl place-items-center p-8 sm:p-14' style={{ backgroundColor: `color-mix(in srgb, ${settings.foregroundColor} 5%, ${settings.backgroundColor})` }}>
      <div className='grid w-full max-w-4xl gap-8 md:grid-cols-2'>
        <div className='flex aspect-[1.75/1] flex-col justify-between border p-7' style={{ backgroundColor: settings.accentColor, borderColor: settings.foregroundColor, color: isDarkSurface(settings.accentColor) ? '#FFFFFF' : '#181818' }}>
          {settings.showLogo ? <IdentityMark className='size-16 object-contain text-xl' identity={identity} inverted={isDarkSurface(settings.accentColor)} /> : null}
          <p className='font-mono text-xs uppercase tracking-widest opacity-45'>{identity.shortName}</p>
        </div>
        <div className='flex aspect-[1.75/1] flex-col justify-between border p-7' style={{ ...elementSurfaceStyle(settings), borderColor: settings.foregroundColor }}>
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

function ProductComponentPreview({ element, identity, settings }: { element: BrandElement; identity: BrandIdentity; settings: BrandElementSettings }) {
  const dark = isDarkSurface(settings.backgroundColor);
  const borderColor = `color-mix(in srgb, ${settings.foregroundColor} 16%, transparent)`;
  const mutedSurface = `color-mix(in srgb, ${settings.foregroundColor} 5%, ${settings.backgroundColor})`;
  const radius = identity.style.borderRadius;
  const logo = settings.showLogo ? <IdentityMark className='size-9 object-contain text-sm' identity={identity} inverted={dark} /> : null;
  const action = settings.cta ? <span className='inline-flex w-fit px-4 py-2.5 text-sm font-semibold' style={actionStyle(settings)}>{settings.cta} →</span> : null;

  if (element.id === 'navigation-bar') {
    return (
      <div className='relative mx-auto flex min-h-28 w-full max-w-5xl items-center justify-between gap-6 overflow-hidden px-6 shadow-sm sm:px-8' style={{ ...elementSurfaceStyle(settings), border: `1px solid ${borderColor}` }}>
        <ElementPattern settings={settings} />
        <div className='relative z-10 flex items-center gap-3'>{logo}<span className='font-semibold'>{settings.headline}</span></div>
        <div className='relative z-10 hidden items-center gap-7 text-sm opacity-60 md:flex'>{settings.body.split(/[·|]/).map((item) => <span key={item}>{item.trim()}</span>)}</div>
        <div className='relative z-10'>{action}</div>
      </div>
    );
  }

  if (element.id === 'hero-section') {
    return (
      <div className={`relative mx-auto grid aspect-[16/9] w-full max-w-5xl overflow-hidden shadow-sm ${settings.layout === 'centered' ? 'place-items-center text-center' : settings.layout === 'stacked' ? 'grid-cols-1' : 'md:grid-cols-[1.1fr_0.9fr]'}`} style={elementSurfaceStyle(settings)}>
        <ElementPattern settings={settings} />
        <div className='relative z-10 flex flex-col justify-center p-8 sm:p-14'>{logo}{settings.eyebrow ? <p className='mt-12 font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p> : null}<h2 className={`mt-4 max-w-3xl font-semibold leading-[0.98] tracking-[-0.055em] ${typeScale(settings)}`}>{settings.headline}</h2><p className='mt-5 max-w-xl text-sm leading-6 opacity-60'>{settings.body}</p><div className='mt-7'>{action}</div></div>
        {settings.layout === 'split' ? <div className='relative z-10 grid place-items-center overflow-hidden' style={{ backgroundColor: settings.accentColor }}><div className='grid size-48 place-items-center border border-white/25 text-6xl font-semibold' style={{ color: isDarkSurface(settings.accentColor) ? '#FFFFFF' : '#181818' }}>{identity.shortName}</div></div> : null}
      </div>
    );
  }

  if (element.id === 'auth-screen') {
    return (
      <div className='relative mx-auto grid aspect-[16/10] w-full max-w-4xl overflow-hidden shadow-sm md:grid-cols-[1fr_0.9fr]' style={{ ...elementSurfaceStyle(settings), borderRadius: radius }}>
        <ElementPattern settings={settings} />
        <div className='relative z-10 flex flex-col justify-between p-8 sm:p-12'>{logo}<div><p className='font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p><h2 className='mt-3 text-4xl font-semibold tracking-[-0.05em]'>{settings.headline}</h2><p className='mt-3 text-sm opacity-55'>{settings.body}</p></div><span className='font-mono text-xs opacity-40'>{identity.website}</span></div>
        <div className='relative z-10 flex flex-col justify-center gap-4 p-8' style={{ backgroundColor: mutedSurface }}><label className='text-xs opacity-60'>Email<input className='mt-2 h-11 w-full border bg-transparent px-3 text-sm opacity-100' style={{ borderColor, borderRadius: Math.min(radius, 10) }} value={identity.contactEmail} readOnly /></label><label className='text-xs opacity-60'>Password<input className='mt-2 h-11 w-full border bg-transparent px-3 text-sm opacity-100' style={{ borderColor, borderRadius: Math.min(radius, 10) }} value='••••••••••' readOnly /></label><span className='mt-2 inline-flex h-11 items-center justify-center text-sm font-semibold' style={{ ...actionStyle(settings), borderRadius: Math.min(radius, 10) }}>{settings.cta || 'Continue'}</span></div>
      </div>
    );
  }

  if (element.id === 'sidebar-navigation') {
    const destinations = settings.body.split(/[·|\n]/).map((item) => item.trim()).filter(Boolean);
    return (
      <div className='relative mx-auto grid min-h-[540px] w-full max-w-5xl overflow-hidden shadow-sm md:grid-cols-[240px_1fr]' style={{ ...elementSurfaceStyle(settings), border: `1px solid ${borderColor}`, borderRadius: radius }}>
        <aside className='relative z-10 flex flex-col border-r p-5' style={{ borderColor }}><div className='flex items-center gap-3'>{logo}<strong>{identity.name}</strong></div><div className='mt-10 flex flex-col gap-1'>{destinations.map((item, index) => <span className='px-3 py-2 text-sm' key={item} style={{ backgroundColor: index === 0 ? mutedSurface : undefined, borderRadius: Math.min(radius, 8) }}>{item}</span>)}</div><span className='mt-auto text-xs opacity-45'>{identity.socialHandle}</span></aside>
        <div className='relative z-10 flex flex-col justify-between p-8 sm:p-12'><div><p className='font-mono text-xs opacity-40'>{settings.eyebrow}</p><h2 className='mt-3 text-4xl font-semibold tracking-[-0.045em]'>{settings.headline}</h2></div><div className='grid gap-3 sm:grid-cols-3'>{identity.values.slice(0, 3).map((value, index) => <div className='min-h-32 border p-4' key={value} style={{ borderColor, borderRadius: Math.min(radius, 12) }}><span className='font-mono text-xs opacity-35'>0{index + 1}</span><p className='mt-10 font-semibold'>{value}</p></div>)}</div></div>
      </div>
    );
  }

  if (element.id === 'search-surface') {
    return (
      <div className='relative mx-auto grid min-h-[520px] w-full max-w-4xl place-items-center overflow-hidden p-8 shadow-sm' style={{ ...elementSurfaceStyle(settings), backgroundColor: mutedSurface, borderRadius: radius }}><ElementPattern settings={settings} /><div className='relative z-10 w-full max-w-2xl border p-3' style={{ backgroundColor: settings.backgroundColor, borderColor, borderRadius: radius }}><div className='flex h-12 items-center gap-3 border-b px-3' style={{ borderColor }}><span className='text-lg'>⌕</span><span className='text-sm opacity-45'>{settings.body}</span><kbd className='ml-auto font-mono text-xs opacity-35'>ESC</kbd></div><div className='py-2'>{['Open brand settings', 'Generate a design board', 'Export selected artifact', 'Invite a collaborator'].map((item, index) => <div className='flex items-center justify-between px-4 py-3 text-sm' key={item} style={{ backgroundColor: index === 0 ? mutedSurface : undefined, borderRadius: Math.min(radius, 8) }}><span>{item}</span><span className='font-mono opacity-35'>↵</span></div>)}</div></div></div>
    );
  }

  if (element.id === 'onboarding-checklist') {
    const steps = settings.body.split('\n').map((item) => item.trim()).filter(Boolean);
    return (
      <div className='relative mx-auto w-full max-w-3xl overflow-hidden p-8 shadow-sm sm:p-12' style={{ ...elementSurfaceStyle(settings), border: `1px solid ${borderColor}`, borderRadius: radius }}><ElementPattern settings={settings} /><div className='relative z-10'>{logo}<p className='mt-8 font-mono text-xs opacity-40'>{settings.eyebrow}</p><h2 className='mt-3 text-3xl font-semibold tracking-[-0.04em]'>{settings.headline}</h2><div className='mt-8 flex flex-col gap-2'>{steps.map((step, index) => <div className='flex items-center gap-3 border p-4 text-sm' key={step} style={{ borderColor, borderRadius: Math.min(radius, 10) }}><span className='grid size-6 place-items-center text-xs' style={{ backgroundColor: index < 2 ? settings.accentColor : mutedSurface, color: index < 2 && isDarkSurface(settings.accentColor) ? '#fff' : settings.foregroundColor, borderRadius: 99 }}>{index < 2 ? '✓' : index + 1}</span><span>{step}</span></div>)}</div><div className='mt-7'>{action}</div></div></div>
    );
  }

  if (element.id === 'file-uploader') {
    return (
      <div className='relative mx-auto grid min-h-[480px] w-full max-w-4xl place-items-center overflow-hidden p-8 shadow-sm' style={{ ...elementSurfaceStyle(settings), borderRadius: radius }}><ElementPattern settings={settings} /><div className='relative z-10 flex w-full max-w-xl flex-col items-center border border-dashed p-12 text-center' style={{ borderColor, borderRadius: radius }}><span className='grid size-12 place-items-center border text-xl' style={{ borderColor, borderRadius: Math.min(radius, 10) }}>↑</span><h2 className='mt-6 text-2xl font-semibold'>{settings.headline}</h2><p className='mt-3 max-w-sm text-sm leading-6 opacity-55'>{settings.body}</p><div className='mt-6'>{action}</div></div></div>
    );
  }

  if (element.id === 'status-page') {
    const services = settings.body.split('\n').map((item) => item.trim()).filter(Boolean);
    return (
      <div className='relative mx-auto w-full max-w-4xl overflow-hidden p-8 shadow-sm sm:p-12' style={{ ...elementSurfaceStyle(settings), border: `1px solid ${borderColor}`, borderRadius: radius }}><ElementPattern settings={settings} /><div className='relative z-10 flex items-start justify-between gap-8'>{logo}<span className='font-mono text-xs opacity-40'>{settings.eyebrow}</span></div><div className='relative z-10 mt-16 flex items-center gap-3'><span className='size-3 rounded-full bg-status-success' /><h2 className='text-3xl font-semibold tracking-[-0.04em]'>{settings.headline}</h2></div><div className='relative z-10 mt-10 flex flex-col'>{services.map((service) => <div className='flex items-center justify-between border-t py-4 text-sm' key={service} style={{ borderColor }}><span>{service}</span><span className='text-status-success'>Operational</span></div>)}</div></div>
    );
  }

  if (element.id === 'feature-grid') {
    const features = identity.strategy.pillars.slice(0, 3);
    return (
      <div className='relative mx-auto w-full max-w-5xl overflow-hidden p-8 shadow-sm sm:p-12' style={elementSurfaceStyle(settings)}><ElementPattern settings={settings} /><div className='relative z-10'>{settings.eyebrow ? <p className='font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p> : null}<h2 className='mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.045em]'>{settings.headline}</h2><p className='mt-4 max-w-2xl text-sm leading-6 opacity-55'>{settings.body}</p><div className='mt-12 grid gap-px sm:grid-cols-3' style={{ backgroundColor: borderColor }}>{features.map((title, index) => <div className='min-h-44 p-6' key={title} style={{ backgroundColor: settings.backgroundColor }}><span className='font-mono text-xs opacity-35'>0{index + 1}</span><p className='mt-14 text-lg font-semibold'>{title}</p><p className='mt-2 text-xs uppercase tracking-wide opacity-35'>{identity.values[index] ?? identity.name}</p></div>)}</div></div></div>
    );
  }

  if (['pricing-card', 'testimonial-card', 'checkout-card'].includes(element.id)) {
    const testimonial = element.id === 'testimonial-card';
    const checkout = element.id === 'checkout-card';
    return (
      <div className='relative mx-auto flex min-h-[520px] w-full max-w-xl flex-col justify-between overflow-hidden p-8 sm:p-10' style={{ ...elementSurfaceStyle(settings), border: `1px solid ${borderColor}` }}><ElementPattern settings={settings} /><div className='relative z-10'>{logo}{settings.eyebrow ? <p className='mt-10 font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p> : null}<h2 className={`${testimonial ? 'mt-5 text-4xl leading-tight' : 'mt-4 text-5xl'} font-semibold tracking-[-0.05em]`}>{settings.headline}</h2><p className='mt-5 text-sm leading-6 opacity-60'>{settings.body}</p>{testimonial ? <p className='mt-8 text-sm font-semibold'>Alex Morgan · Customer</p> : <div className='mt-8 flex flex-col gap-3 border-y py-5 text-sm' style={{ borderColor }}><span className='flex justify-between'><span>{checkout ? 'Subtotal' : 'Unlimited projects'}</span><span>✓</span></span><span className='flex justify-between'><span>{checkout ? 'Tax' : 'High-resolution exports'}</span><span>✓</span></span><span className='flex justify-between'><span>{checkout ? 'Total' : 'Shared brand settings'}</span><span>{checkout ? settings.headline : '✓'}</span></span></div>}</div>{!testimonial ? <div className='relative z-10 mt-8'>{action}</div> : null}</div>
    );
  }

  if (['form-controls', 'settings-panel'].includes(element.id)) {
    return (
      <div className='relative mx-auto w-full max-w-3xl overflow-hidden p-8 shadow-sm sm:p-10' style={elementSurfaceStyle(settings)}><ElementPattern settings={settings} /><div className='relative z-10'>{logo}<p className='mt-8 font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p><h2 className='mt-3 text-3xl font-semibold tracking-[-0.04em]'>{settings.headline}</h2><p className='mt-3 text-sm leading-6 opacity-55'>{settings.body}</p><div className='mt-8 grid gap-5 sm:grid-cols-2'><label className='flex flex-col gap-2 text-xs opacity-70'>Workspace name<input className='h-10 border bg-transparent px-3 text-sm opacity-100' style={{ borderColor }} value={identity.name} readOnly /></label><label className='flex flex-col gap-2 text-xs opacity-70'>Website<input className='h-10 border bg-transparent px-3 text-sm opacity-100' style={{ borderColor }} value={identity.website} readOnly /></label><label className='flex items-center justify-between gap-4 border p-3 text-sm sm:col-span-2' style={{ borderColor }}><span>Keep brand assets synchronized</span><input checked readOnly type='checkbox' /></label></div><div className='mt-7'>{action}</div></div></div>
    );
  }

  if (['command-menu', 'modal-dialog', 'toast-notification', 'empty-state'].includes(element.id)) {
    const compact = element.id === 'toast-notification';
    return (
      <div className={`relative mx-auto grid w-full max-w-4xl place-items-center overflow-hidden p-8 shadow-sm ${compact ? 'min-h-72' : 'min-h-[520px]'}`} style={{ ...elementSurfaceStyle(settings), backgroundColor: mutedSurface }}><ElementPattern settings={settings} /><div className={`relative z-10 w-full bg-[var(--background)] p-7 ${compact ? 'max-w-lg' : 'max-w-xl'} ${settings.layout === 'centered' ? 'text-center' : ''}`} style={{ backgroundColor: settings.backgroundColor, border: `1px solid ${borderColor}` }}>{logo}{settings.eyebrow ? <p className='mt-5 font-mono text-xs uppercase tracking-widest opacity-45'>{settings.eyebrow}</p> : null}<h2 className='mt-3 text-2xl font-semibold tracking-[-0.035em]'>{settings.headline}</h2><p className='mt-3 text-sm leading-6 opacity-55'>{settings.body}</p>{element.id === 'command-menu' ? <div className='mt-6 flex flex-col gap-px' style={{ backgroundColor: borderColor }}>{['Open brand settings', 'Create a design board', 'Export current canvas'].map((item) => <div className='flex justify-between bg-inherit p-3 text-left text-sm' key={item} style={{ backgroundColor: settings.backgroundColor }}><span>{item}</span><span className='font-mono opacity-35'>↵</span></div>)}</div> : <div className='mt-6'>{action}</div>}</div></div>
    );
  }

  if (element.id === 'data-table') {
    return (
      <div className='relative mx-auto w-full max-w-5xl overflow-hidden p-8 shadow-sm' style={elementSurfaceStyle(settings)}><ElementPattern settings={settings} /><div className='relative z-10'><div className='flex items-end justify-between gap-6'><div><p className='font-mono text-xs opacity-40'>{settings.eyebrow}</p><h2 className='mt-2 text-3xl font-semibold'>{settings.headline}</h2></div>{action}</div><div className='mt-8 overflow-hidden border' style={{ borderColor }}><div className='grid grid-cols-[1.4fr_1fr_0.8fr] p-3 font-mono text-[10px] uppercase opacity-45'><span>Project</span><span>Status</span><span>Updated</span></div>{['Product launch', 'Documentation', 'Email system', 'Design board'].map((item, index) => <div className='grid grid-cols-[1.4fr_1fr_0.8fr] border-t p-4 text-sm' key={item} style={{ borderColor }}><span className='font-medium'>{item}</span><span><i className='mr-2 inline-block size-2 rounded-full' style={{ backgroundColor: settings.accentColor }} />{index % 2 ? 'Draft' : 'Ready'}</span><span className='opacity-45'>Today</span></div>)}</div></div></div>
    );
  }

  return (
    <div className='relative mx-auto grid aspect-[3/2] w-full max-w-3xl place-items-center overflow-hidden p-8 shadow-sm' style={elementSurfaceStyle(settings)}><ElementPattern settings={settings} /><div className='relative z-10 w-full max-w-md border p-7' style={{ borderColor }}><div className='flex items-start justify-between'>{logo}<span className='font-mono text-xs opacity-45'>{settings.eyebrow}</span></div><h2 className='mt-12 text-5xl font-semibold tracking-[-0.055em]'>{settings.headline}</h2><p className='mt-3 text-sm opacity-55'>{settings.body}</p><div className='mt-8 h-20 border-b border-l' style={{ borderColor }}><div className='h-full w-2/3' style={{ background: `linear-gradient(135deg, transparent 30%, ${settings.accentColor})`, clipPath: 'polygon(0 70%, 32% 50%, 56% 65%, 78% 18%, 100% 0, 100% 100%, 0 100%)' }} /></div></div></div>
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
  let preview: ReactNode;
  switch (element.preview) {
    case 'email':
      preview = <EmailPreview element={element} identity={identity} settings={settings} />;
      break;
    case 'developer':
      preview = <DeveloperPreview element={element} identity={identity} settings={settings} />;
      break;
    case 'social':
      preview = <SocialPreview element={element} identity={identity} settings={settings} />;
      break;
    case 'editorial':
      preview = <EditorialPreview element={element} identity={identity} settings={settings} />;
      break;
    case 'event':
      preview = <EventPreview element={element} identity={identity} settings={settings} />;
      break;
    case 'physical':
      preview = <PhysicalPreview element={element} identity={identity} settings={settings} />;
      break;
    case 'logo':
      preview = <LogoPreview identity={identity} settings={settings} />;
      break;
    case 'icon':
      preview = <IconPreview identity={identity} settings={settings} />;
      break;
    case 'web':
      preview = <WebPreview element={element} identity={identity} settings={settings} />;
      break;
    case 'component':
      preview = <ProductComponentPreview element={element} identity={identity} settings={settings} />;
      break;
  }
  const asset = [...identity.assets, ...identity.proofAssets].find(({ id }) => id === settings.assetId);
  return (
    <div className='brand-element-preview-composite'>
      {preview}
      {asset ? <img alt='' className='brand-element-shared-asset' data-placement={settings.assetPlacement} src={asset.path} style={{ opacity: settings.assetOpacity / 100 }} /> : null}
    </div>
  );
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
      <header className='app-navbar brand-elements-header tool-header flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3'>
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
            <StudioSelect
              ariaLabel={gt('Brand element category')}
              className='min-w-40'
              onValueChange={(value) => setCategory(value as BrandElementCategory | 'All')}
              options={[
                { label: gt('All elements'), value: 'All' },
                ...BRAND_ELEMENT_CATEGORIES.map((item) => ({ label: gt(item), value: item })),
              ]}
              value={category}
            />
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
                      <span className='relative z-10 min-w-0 flex-1 pr-10'>
                        <span className='block truncate text-sm'>{gt(element.name)}</span>
                        <span className={`block truncate font-mono text-[10px] ${selectedElement.id === element.id ? 'text-primary-foreground/55' : 'text-muted-foreground'}`}>
                          {element.dimensions}
                        </span>
                      </span>
                      <span
                        aria-hidden='true'
                        className={`pointer-events-none absolute right-3 bottom-2 font-mono text-[18px] font-semibold leading-none tracking-[-0.08em] ${
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
              <StudioSelect
                ariaLabel={gt('Active brand element')}
                className='brand-elements-mobile-select hidden'
                onValueChange={setSelectedElementId}
                options={BRAND_ELEMENT_CATEGORIES.flatMap((elementCategory) =>
                  BRAND_ELEMENTS.filter((element) => element.category === elementCategory).map((element) => ({
                    label: `${gt(elementCategory)} / ${gt(element.name)}`,
                    value: element.id,
                  }))
                )}
                value={selectedElement.id}
              />
              <div>
                <p className='text-sm font-semibold'>{selectedElement.name}</p>
              </div>
              <div className='flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                <span className='rounded-md border border-border px-2 py-1'>{selectedElement.dimensions}</span>
                <span className='rounded-md border border-border px-2 py-1'>{selectedElement.format}</span>
              </div>
            </div>
            <CanvasViewport className='min-h-[560px] flex-1' identityId={identity.id} stageClassName='grid min-h-[560px] place-items-center p-5 sm:p-8' toolId={tool.id}>
              <ElementFrame
                aspectRatio={declaredAspectRatio(selectedElement.dimensions)}
                codeFontFamily={brandTypographyFamily(identity, 'Code')}
                fontFamily={brandTypographyFamily(identity, selectedSettings.fontRole)}
                fontWeight={selectedSettings.fontWeight}
                logoFilter={logoAppearanceCssFilter({ ...DEFAULT_LOGO_APPEARANCE, ...selectedSettings.logoAppearance })}
              >
                <ElementPreview element={selectedElement} identity={identity} settings={selectedSettings} />
              </ElementFrame>
            </CanvasViewport>
          </div>
        </div>
        <ElementEditor
          element={selectedElement}
          identity={identity}
          onChange={updateSelectedSettings}
          onReset={resetSelectedSettings}
          settings={selectedSettings}
        />
      </div>
    </div>
  );
}
