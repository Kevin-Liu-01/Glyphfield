'use client';

import { memo, type CSSProperties, type ReactNode } from 'react';

import BrandEditableText from '@/components/BrandEditableText';
import {
  ArrowUpRight,
  Asterisk,
  Circle,
  Grid2X2,
  Layers3,
  Maximize2,
  MoveUpRight,
  Rows3,
  Sparkles,
  Square,
  Target,
  Triangle,
} from '@/components/ui/SolidIcons';
import { brandAssetPath, brandFontAssets, brandTypographyFamily, brandTypographyRole, type BrandAsset, type BrandIdentity } from '@/lib/brandIdentity';
import type { BookPage, BookSection } from '@/lib/brandBookModel';
import {
  brandDeviceSvg,
  brandSurface,
  contrastRatio,
  imageFits,
  isDarkColor,
  readableOn,
  wcagRating,
  type BrandPalette,
  type BrandSurfaceTone,
} from '@/lib/brandOutputKit';
import { formatOklch, mixHexColors } from '@/lib/color';

import styles from './BrandBook.module.css';

export type BookPageContext = {
  editable: boolean;
  folios: ReadonlyMap<string, number>;
  identity: BrandIdentity;
  onCopy: (pageId: string, slot: string, value: string) => void;
  page: BookPage;
  palette: BrandPalette;
  scope: string;
  sectionNumber: string;
  sections: readonly BookSection[];
};

type TextOptions = { as?: 'blockquote' | 'div' | 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'strong'; className?: string; multiline?: boolean };

function Text({ context, options = {}, slot }: { context: BookPageContext; options?: TextOptions; slot: string }) {
  const value = context.page.copy[slot] ?? '';
  return (
    <BrandEditableText
      as={options.as ?? 'p'}
      className={options.className}
      editable={context.editable}
      label={`${context.page.title} ${slot}`}
      maxLength={1200}
      multiline={options.multiline ?? true}
      onCommit={(next) => context.onCopy(context.page.id, slot, next)}
      value={value}
    />
  );
}

function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`${styles.label} ${className}`.trim()}>{children}</span>;
}

function assetById(identity: BrandIdentity, id: string): BrandAsset | undefined {
  return [...identity.assets, ...identity.proofAssets].find((asset) => asset.id === id);
}

function visualAssets(identity: BrandIdentity): BrandAsset[] {
  return identity.assets.filter((asset) => ['background', 'image', 'motion', 'product', 'texture'].includes(asset.type)
    && !/(?:^|\/)(?:references|screenshots)\//i.test(asset.path));
}

function BookImage({ asset, className = '', identity }: { asset?: BrandAsset; className?: string; identity: BrandIdentity }) {
  if (!asset) return null;
  const fit = imageFits(asset);
  const position = asset.focalPoint ? `${asset.focalPoint.x * 100}% ${asset.focalPoint.y * 100}%` : 'center';
  return (
    <span className={`${styles.image} ${className}`.trim()} data-fit={fit} data-treatment={identity.style?.imageTreatment ?? 'natural'}>
      <img alt={asset.alt ?? asset.label} decoding='async' loading='lazy' src={asset.path} style={{ objectFit: fit, objectPosition: position }} />
    </span>
  );
}

function Device({ className = '', context, dark, seed = 0 }: { className?: string; context: BookPageContext; dark: boolean; seed?: number }) {
  const markup = brandDeviceSvg(context.identity, {
    height: 1000,
    prefix: `${context.scope}-${context.page.id}-${seed}`,
    seed: seed + context.identity.id.length * 97,
    tone: dark ? 'dark' : 'light',
    width: 1600,
  });
  return <span aria-hidden='true' className={`${styles.device} ${className}`.trim()} dangerouslySetInnerHTML={{ __html: markup }} />;
}

function Mark({ className = '', identity, kind = 'mark', onDark }: { className?: string; identity: BrandIdentity; kind?: 'mark' | 'wordmark'; onDark: boolean }) {
  const mark = onDark ? brandAssetPath(identity, 'mark-light') ?? brandAssetPath(identity, 'mark-dark') : brandAssetPath(identity, 'mark-dark') ?? brandAssetPath(identity, 'mark-light');
  const wordmark = onDark ? brandAssetPath(identity, 'wordmark-light') : brandAssetPath(identity, 'wordmark');
  const source = kind === 'wordmark' ? wordmark ?? mark : mark;
  if (!source) return <strong className={`${styles.markFallback} ${className}`.trim()}>{identity.shortName || identity.name}</strong>;
  return <img alt={`${identity.name} ${kind}`} className={`${styles.mark} ${className}`.trim()} src={source} />;
}

function pageDark(context: BookPageContext): boolean {
  return isDarkColor(brandSurface(context.palette, context.page.tone).background);
}

function pageAsset(context: BookPageContext, offset = 0): BrandAsset | undefined {
  const assets = visualAssets(context.identity);
  const chosen = context.page.assetId ? assetById(context.identity, context.page.assetId) : undefined;
  if (offset === 0 && chosen) return chosen;
  const pool = assets.filter((asset) => asset.id !== chosen?.id);
  return pool[(offset + context.page.id.length) % Math.max(1, pool.length)] ?? chosen;
}

// ---------------------------------------------------------------------------
// Introduction
// ---------------------------------------------------------------------------

function CoverPage({ context }: { context: BookPageContext }) {
  const { identity, page } = context;
  const dark = pageDark(context);
  const art = page.variant === 'image'
    ? <BookImage asset={pageAsset(context)} className={styles.coverArt} identity={identity} />
    : page.variant === 'device' ? <Device className={styles.coverArt} context={context} dark={dark} /> : null;
  return (
    <div className={styles.cover}>
      {art}
      <div className={styles.coverPanel}>
        <Mark className={styles.coverMark} identity={identity} kind='wordmark' onDark={dark} />
        <Text context={context} options={{ as: 'h1', className: styles.coverTitle }} slot='title' />
        <Text context={context} options={{ className: styles.coverSubtitle }} slot='subtitle' />
        <div className={styles.coverMeta}>
          <Label>Brand guidelines</Label>
          <Label>Rev. {identity.revision}</Label>
          <Label>{identity.website}</Label>
        </div>
      </div>
    </div>
  );
}

function ContentsPage({ context }: { context: BookPageContext }) {
  const sections = context.sections.filter((section) => section.id !== 'intro' && section.id !== 'closing' && !section.hidden);
  return (
    <div className={styles.grid} data-layout='contents'>
      <Text context={context} options={{ as: 'h1', className: styles.h1, multiline: false }} slot='title' />
      <ol className={styles.contentsList}>
        {sections.map((section, index) => {
          const firstPage = section.pages.find((page) => !page.hidden);
          return (
            <li key={section.id}>
              <span className={styles.label}>{String(index + 1).padStart(2, '0')}</span>
              <strong>{section.name}</strong>
              <span className={styles.quiet}>{firstPage ? String(context.folios.get(firstPage.id) ?? '').padStart(2, '0') : '—'}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ForewordPage({ context }: { context: BookPageContext }) {
  return (
    <div className={styles.grid} data-layout='foreword'>
      <Label>{context.page.title}</Label>
      <Text context={context} options={{ as: 'blockquote', className: styles.d1 }} slot='statement' />
      <Text context={context} options={{ className: styles.lead }} slot='body' />
    </div>
  );
}

function OpenerPage({ context }: { context: BookPageContext }) {
  const dark = pageDark(context);
  const art = context.page.variant === 'device'
    ? <Device className={styles.openerArt} context={context} dark={dark} seed={3} />
    : context.page.variant === 'image' ? <BookImage asset={pageAsset(context)} className={styles.openerArt} identity={context.identity} /> : null;
  return (
    <div className={styles.opener}>
      {art}
      <div className={styles.openerText}>
        <span className={styles.openerNumeral}>{context.sectionNumber}</span>
        <Text context={context} options={{ as: 'h1', className: styles.d2, multiline: false }} slot='title' />
        <Text context={context} options={{ className: styles.lead }} slot='summary' />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

function PremisePage({ context }: { context: BookPageContext }) {
  return (
    <div className={styles.grid} data-layout='premise'>
      <Label>Brand idea</Label>
      <Text context={context} options={{ as: 'h1', className: styles.d2 }} slot='statement' />
      <div className={styles.aside}>
        <Label>Positioning</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='aside' />
      </div>
    </div>
  );
}

function ChallengePage({ context }: { context: BookPageContext }) {
  const steps = [['challenge', 'Challenge'], ['promise', 'Promise'], ['outcome', 'Outcome']] as const;
  return (
    <div className={styles.grid} data-layout='flow'>
      {steps.map(([slot, name], index) => (
        <article className={styles.flowStep} key={slot}>
          <span className={styles.flowIndex}>{String(index + 1).padStart(2, '0')}</span>
          <h2 className={styles.h3}>{name}</h2>
          <Text context={context} options={{ className: index === 1 ? styles.lead : styles.bodyText }} slot={slot} />
          {index < steps.length - 1 ? <span aria-hidden='true' className={styles.flowArrow}>→</span> : null}
        </article>
      ))}
    </div>
  );
}

function MissionPage({ context }: { context: BookPageContext }) {
  return (
    <div className={styles.grid} data-layout='mission'>
      <div>
        <Label>Mission</Label>
        <Text context={context} options={{ as: 'h1', className: styles.d1 }} slot='mission' />
      </div>
      <div className={styles.aside}>
        <Label>Position</Label>
        <Text context={context} options={{ className: styles.lead }} slot='position' />
      </div>
    </div>
  );
}

function AudiencePage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  const audiences = identity.audiences.slice(0, 4);
  const traits = identity.strategy.personality;
  return (
    <div className={styles.grid} data-layout='cards'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.h2 }} slot='lead' />
      </div>
      <div className={styles.cards}>
        {audiences.map((audience, index) => (
          <article key={audience}>
            <span className={styles.label}>{String(index + 1).padStart(2, '0')}</span>
            <strong className={styles.h3}>{audience}</strong>
            <span className={styles.quiet}>{traits[index % Math.max(1, traits.length)] ?? ''}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function PillarsPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  return (
    <div className={styles.grid} data-layout='pillars'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
        <div className={styles.valueList}>{identity.values.map((value) => <span key={value}>{value}</span>)}</div>
      </div>
      <ol className={styles.pillarList}>
        {identity.strategy.pillars.slice(0, 5).map((pillar, index) => (
          <li key={pillar}><span className={styles.label}>{String(index + 1).padStart(2, '0')}</span><strong className={styles.h2}>{pillar}</strong></li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Logo
// ---------------------------------------------------------------------------

function LogoPrimaryPage({ context }: { context: BookPageContext }) {
  const dark = pageDark(context);
  return (
    <div className={styles.grid} data-layout='logo-primary'>
      <div className={styles.logoStage}><Mark identity={context.identity} kind='wordmark' onDark={dark} /></div>
      <div className={styles.caption}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
    </div>
  );
}

function LogoFamilyPage({ context }: { context: BookPageContext }) {
  const { identity, palette } = context;
  const dark = brandSurface(palette, isDarkColor(palette.deep) ? 'deep' : 'ink');
  const cells = [
    { kind: 'mark', label: 'Mark · on light', onDark: false },
    { kind: 'wordmark', label: 'Wordmark · on light', onDark: false },
    { kind: 'mark', label: 'Mark · on dark', onDark: true },
    { kind: 'wordmark', label: 'Wordmark · on dark', onDark: true },
  ] as const;
  return (
    <div className={styles.grid} data-layout='logo-family'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <div className={styles.logoGrid}>
        {cells.map((cell) => (
          <figure key={cell.label} style={cell.onDark ? { background: dark.background, color: dark.foreground } : { background: palette.paper, color: readableOn(palette.paper, palette) }}>
            <Mark identity={identity} kind={cell.kind} onDark={cell.onDark} />
            <figcaption className={styles.label}>{cell.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function ClearspacePage({ context }: { context: BookPageContext }) {
  return (
    <div className={styles.grid} data-layout='clearspace'>
      <div className={styles.clearspace}>
        <span className={styles.clearspaceZone}>
          <Mark identity={context.identity} kind='wordmark' onDark={pageDark(context)} />
          <i aria-hidden='true' data-edge='top'>x</i>
          <i aria-hidden='true' data-edge='right'>x</i>
          <i aria-hidden='true' data-edge='bottom'>x</i>
          <i aria-hidden='true' data-edge='left'>x</i>
        </span>
      </div>
      <div className={styles.caption}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
        <span className={styles.label}>x = ½ mark height</span>
      </div>
    </div>
  );
}

function MinimumPage({ context }: { context: BookPageContext }) {
  const dark = pageDark(context);
  const sizes = [
    { digital: '20 px', print: '6 mm', scale: 1, use: 'Mark' },
    { digital: '64 px', print: '18 mm', scale: 3.2, use: 'Wordmark' },
  ] as const;
  return (
    <div className={styles.grid} data-layout='minimum'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <div className={styles.minimumRows}>
        {sizes.map((size) => (
          <div key={size.use}>
            <span className={styles.minimumSample} style={{ '--scale': size.scale } as CSSProperties}>
              <Mark identity={context.identity} kind={size.use === 'Mark' ? 'mark' : 'wordmark'} onDark={dark} />
            </span>
            <strong className={styles.h3}>{size.use}</strong>
            <span className={styles.label}>Digital {size.digital}</span>
            <span className={styles.label}>Print {size.print}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorwaysPage({ context }: { context: BookPageContext }) {
  const { identity, palette } = context;
  const tones: BrandSurfaceTone[] = ['paper', 'muted', 'accent', 'ink', 'deep'];
  const seen = new Set<string>();
  const unique = tones.filter((tone) => {
    const color = brandSurface(palette, tone).background.toUpperCase();
    if (seen.has(color)) return false;
    seen.add(color);
    return true;
  });
  return (
    <div className={styles.grid} data-layout='colorways'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <div className={styles.colorways}>
        {unique.map((tone) => {
          const surface = brandSurface(palette, tone);
          return (
            <figure key={tone} style={{ background: surface.background, color: surface.foreground }}>
              <Mark identity={identity} kind='wordmark' onDark={isDarkColor(surface.background)} />
              <figcaption className={styles.label}>{surface.background}</figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

const MISUSE = [
  { label: 'Do not stretch or squash', style: { transform: 'scaleX(1.45)' } },
  { label: 'Do not rotate', style: { transform: 'rotate(-14deg)' } },
  { label: 'Do not recolour', style: { filter: 'invert(42%) sepia(92%) saturate(2400%) hue-rotate(300deg)' } },
  { label: 'Do not add effects', style: { filter: 'drop-shadow(0.4cqi 0.5cqi 0.4cqi rgb(0 0 0 / 0.55)) blur(0.04cqi)' } },
  { label: 'Do not outline', style: { filter: 'drop-shadow(1px 0 0 currentColor) drop-shadow(-1px 0 0 currentColor) drop-shadow(0 1px 0 currentColor) drop-shadow(0 -1px 0 currentColor) opacity(.35)' } },
  { label: 'Do not place on busy fields', style: {} },
] as const;

function MisusePage({ context }: { context: BookPageContext }) {
  const dark = pageDark(context);
  return (
    <div className={styles.grid} data-layout='misuse'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <div className={styles.misuseGrid}>
        {MISUSE.map((rule, index) => (
          <figure key={rule.label}>
            <span className={styles.misuseStage}>
              {index === MISUSE.length - 1 ? <Device className={styles.fill} context={context} dark={!dark} seed={9} /> : null}
              <span style={rule.style}><Mark identity={context.identity} kind='wordmark' onDark={index === MISUSE.length - 1 ? !dark : dark} /></span>
            </span>
            <figcaption><span aria-hidden='true' className={styles.cross}>✕</span>{rule.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

function rgb(hex: string): string {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(' ');
}

function safeOklch(hex: string): string {
  try {
    return formatOklch(hex);
  } catch {
    return '';
  }
}

function PalettePage({ context }: { context: BookPageContext }) {
  const { identity, palette } = context;
  return (
    <div className={styles.grid} data-layout='palette'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <div className={styles.palette} data-count={Math.min(8, identity.colors.length)}>
        {identity.colors.slice(0, 8).map((color) => {
          const text = readableOn(color.hex, palette);
          return (
            <article key={color.id} style={{ background: color.hex, color: text }}>
              <strong>{color.name}</strong>
              <span className={styles.paletteRole}>{color.role}</span>
              <dl>
                <div><dt>HEX</dt><dd>{color.hex.toUpperCase()}</dd></div>
                <div><dt>RGB</dt><dd>{rgb(color.hex)}</dd></div>
                <div><dt>OKLCH</dt><dd>{safeOklch(color.hex).replace(/^oklch\(|\)$/g, '')}</dd></div>
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function paletteProportions(identity: BrandIdentity, palette: BrandPalette) {
  const darkLed = ['editorial-interruption', 'unified-terminal', 'utility-wave'].includes(identity.artDirection?.preview ?? '');
  const name = (hex: string, fallback: string) => identity.colors.find((color) => color.hex.toUpperCase() === hex.toUpperCase())?.name ?? fallback;
  const dominant = darkLed ? palette.deep : palette.paper;
  const support = darkLed ? palette.paper : palette.ink;
  return [
    { color: dominant, name: name(dominant, 'Dominant'), role: 'Dominant field', share: 60 },
    { color: support, name: name(support, 'Support'), role: 'Type and structure', share: 25 },
    { color: palette.accent, name: name(palette.accent, 'Accent'), role: 'Signal and action', share: 10 },
    { color: palette.secondary, name: name(palette.secondary, 'Secondary'), role: 'Rare emphasis', share: 5 },
  ];
}

function ProportionPage({ context }: { context: BookPageContext }) {
  const shares = paletteProportions(context.identity, context.palette);
  return (
    <div className={styles.grid} data-layout='proportion'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.h2 }} slot='lead' />
      </div>
      <div className={styles.proportion} data-variant={context.page.variant}>
        {shares.map((share) => (
          <figure key={share.role} style={{ '--share': share.share, background: share.color, color: readableOn(share.color, context.palette) } as CSSProperties}>
            <strong>{share.share}%</strong>
            <figcaption><span>{share.name}</span><span className={styles.label}>{share.role}</span></figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function PairingsPage({ context }: { context: BookPageContext }) {
  const { palette } = context;
  const backgrounds = [['Paper', palette.paper], ['Muted', palette.muted], ['Accent', palette.accent], ['Deep', palette.deep]] as const;
  const foregrounds = [['Ink', palette.ink], ['Paper', palette.paper], ['Accent', palette.accent]] as const;
  return (
    <div className={styles.grid} data-layout='pairings'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <table className={styles.pairings}>
        <thead><tr><th scope='col'><span className={styles.label}>Text / surface</span></th>{backgrounds.map(([name, color]) => <th key={name} scope='col'><span className={styles.label}>{name} · {color}</span></th>)}</tr></thead>
        <tbody>
          {foregrounds.map(([name, foreground]) => (
            <tr key={name}>
              <th scope='row'><span className={styles.label}>{name}</span></th>
              {backgrounds.map(([backgroundName, background]) => {
                const ratio = contrastRatio(foreground, background);
                const rating = wcagRating(ratio);
                return (
                  <td data-pass={rating !== 'Fail'} key={backgroundName} style={{ background, color: foreground }}>
                    <span className={styles.pairSample}>Aa</span>
                    <span className={styles.pairRatio}>{ratio.toFixed(1)} : 1</span>
                    <span className={styles.pairRating}>{foreground.toUpperCase() === background.toUpperCase() ? '—' : rating}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TintsPage({ context }: { context: BookPageContext }) {
  const { palette } = context;
  const ramps = [['Accent', palette.accent], ['Ink', palette.ink], ['Secondary', palette.secondary]] as const;
  return (
    <div className={styles.grid} data-layout='tints'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <div className={styles.tints}>
        {ramps.map(([name, base]) => (
          <div key={name}>
            <span className={styles.label}>{name}</span>
            <ol>
              {Array.from({ length: 9 }, (_, index) => {
                const amount = (index - 4) / 5;
                const color = amount < 0 ? mixHexColors(base, '#FFFFFF', -amount) : mixHexColors(base, '#000000', amount);
                return <li key={index} style={{ background: color, color: readableOn(color, palette) }}><span>{(index + 1) * 100}</span><span>{color}</span></li>;
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

function weightsFor(identity: BrandIdentity, role: 'Body' | 'Display'): number[] {
  const family = brandTypographyFamily(identity, role);
  const weights = brandFontAssets(identity)
    .filter((font) => font.family === family)
    .flatMap((font) => (font.weightMin !== undefined && font.weightMax !== undefined ? [300, 400, 500, 600, 700].filter((weight) => weight >= font.weightMin! && weight <= font.weightMax!) : [font.weight]));
  return [...new Set(weights)].sort((left, right) => left - right).slice(0, 5);
}

function TypeDisplayPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  const family = brandTypographyFamily(identity, 'Display');
  return (
    <div className={styles.grid} data-layout='type-display'>
      <Label>{context.page.title}</Label>
      <h1 className={styles.d4} data-face='display'>{family}</h1>
      <Text context={context} options={{ className: styles.d1, multiline: false }} slot='sample' />
      <div className={styles.typeMeta}>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
        <div className={styles.weights} data-face='display'>{weightsFor(identity, 'Display').map((weight) => <span key={weight} style={{ fontWeight: weight }}>Aa <small className={styles.label}>{weight}</small></span>)}</div>
        <span className={styles.glyphLine} data-face='display'>ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789</span>
      </div>
    </div>
  );
}

function TypeTextPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  const body = brandTypographyRole(identity, 'Body');
  return (
    <div className={styles.grid} data-layout='type-text'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <h1 className={styles.d2} data-face='body'>{brandTypographyFamily(identity, 'Body')}</h1>
        <Text context={context} options={{ className: styles.small }} slot='lead' />
        <span className={styles.label}>18 / {Math.round((body.lineHeight ?? 1.5) * 18)} px · {body.weight ?? 400}</span>
      </div>
      <Text context={context} options={{ className: styles.textColumns }} slot='sample' />
    </div>
  );
}

function TypePairingPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  return (
    <div className={styles.grid} data-layout='pairing'>
      <div className={styles.pairingSpec}>
        <Label>Display · {brandTypographyFamily(identity, 'Display')}</Label>
        <Label>Text · {brandTypographyFamily(identity, 'Body')}</Label>
      </div>
      <Text context={context} options={{ as: 'h1', className: styles.d2 }} slot='headline' />
      <Text context={context} options={{ className: styles.lead }} slot='body' />
    </div>
  );
}

const SCALE_STEPS = [
  { face: 'display', name: 'Display', step: 5 },
  { face: 'display', name: 'Heading 1', step: 4 },
  { face: 'display', name: 'Heading 2', step: 3 },
  { face: 'display', name: 'Heading 3', step: 2 },
  { face: 'body', name: 'Lead', step: 1 },
  { face: 'body', name: 'Body', step: 0 },
  { face: 'code', name: 'Caption', step: -1 },
] as const;

function TypeScalePage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  const samples = [identity.tagline, identity.voice.phrases[0] ?? identity.name, identity.voice.phrases[1] ?? identity.strategy.promise, identity.strategy.pillars[0] ?? identity.name, identity.strategy.promise, identity.mission, `${identity.website} · ${identity.socialHandle}`];
  return (
    <div className={styles.grid} data-layout='type-scale'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.small }} slot='lead' />
      </div>
      <ol className={styles.scale}>
        {SCALE_STEPS.map((entry, index) => {
          const size = Math.round(16 * 1.333 ** entry.step);
          const lineHeight = entry.face === 'display' ? 1.05 : 1.5;
          return (
            <li key={entry.name}>
              <span className={styles.label}>{entry.name}</span>
              <span className={styles.label}>{size} / {Math.round(size * lineHeight)}</span>
              <span className={styles.scaleSample} data-face={entry.face} style={{ fontSize: `${(size / 16) * 0.72}cqi`, lineHeight }}>{samples[index]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TypeRolesPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  return (
    <div className={styles.grid} data-layout='type-roles'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <table className={styles.roles}>
        <thead><tr>{['Role', 'Family', 'Weight', 'Usage', ''].map((heading) => <th key={heading} scope='col'><span className={styles.label}>{heading}</span></th>)}</tr></thead>
        <tbody>
          {(['Display', 'Body', 'Accent', 'Code'] as const).map((role) => {
            const typography = brandTypographyRole(identity, role);
            return (
              <tr key={role}>
                <th scope='row'>{role}</th>
                <td>{brandTypographyFamily(identity, role)}</td>
                <td>{typography.weight ?? 400}</td>
                <td className={styles.quiet}>{typography.usage}</td>
                <td className={styles.roleSample} data-face={role.toLocaleLowerCase()}>Aa</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graphic device
// ---------------------------------------------------------------------------

function DeviceHeroPage({ context }: { context: BookPageContext }) {
  const dark = pageDark(context);
  return (
    <div className={styles.deviceHero} data-variant={context.page.variant}>
      <Device className={styles.deviceHeroArt} context={context} dark={dark} />
      <div className={styles.deviceHeroText}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ as: 'h1', className: styles.d1 }} slot='title' />
        <Text context={context} options={{ className: styles.bodyText }} slot='body' />
      </div>
    </div>
  );
}

function ConstructionPage({ context }: { context: BookPageContext }) {
  const notes = ['Field', 'Anchor', 'Margin'];
  return (
    <div className={styles.grid} data-layout='construction'>
      <div className={styles.construction}>
        <Device className={styles.fill} context={context} dark={!pageDark(context)} seed={2} />
        <span aria-hidden='true' className={styles.constructionGrid} />
        {notes.map((note, index) => <span className={styles.constructionNote} data-index={index} key={note}><b>{index + 1}</b>{note}</span>)}
      </div>
      <div className={styles.caption}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
    </div>
  );
}

function VariationsPage({ context }: { context: BookPageContext }) {
  const dark = pageDark(context);
  const crops = context.page.variant === 'pair' ? ['Hero', 'Card'] : ['Hero', 'Card', 'Banner'];
  return (
    <div className={styles.grid} data-layout='variations'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <div className={styles.variations} data-count={crops.length}>
        {crops.map((crop, index) => (
          <figure key={crop}>
            <Device className={styles.fill} context={context} dark={index === 1 ? !dark : true} seed={20 + index} />
            <figcaption className={styles.label}>{crop}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

const ICONS = [Asterisk, ArrowUpRight, Circle, Grid2X2, Layers3, Maximize2, MoveUpRight, Sparkles, Square, Target, Triangle, Rows3];

function IconsPage({ context }: { context: BookPageContext }) {
  const stroke = context.identity.style.density === 'compact' ? 2 : 1.5;
  return (
    <div className={styles.grid} data-layout='icons'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
        <dl className={styles.iconMetrics}>
          <div><dt className={styles.label}>Grid</dt><dd>24 px</dd></div>
          <div><dt className={styles.label}>Stroke</dt><dd>{stroke} px</dd></div>
          <div><dt className={styles.label}>Corner</dt><dd>{context.identity.style.borderRadius} px</dd></div>
        </dl>
      </div>
      <div className={styles.icons}>{ICONS.map((Icon, index) => <span key={index}><Icon aria-hidden='true' strokeWidth={stroke} /></span>)}</div>
    </div>
  );
}

function DeviceRulesPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  return (
    <div className={styles.grid} data-layout='dodont'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.h3 }} slot='lead' />
      </div>
      <div className={styles.doColumn}>
        <span className={styles.label}><span aria-hidden='true' className={styles.check}>✓</span> Do</span>
        {identity.graphicSystem.rules.slice(0, 5).map((rule) => <p className={styles.bodyText} key={rule}>{rule}</p>)}
      </div>
      <div className={styles.dontColumn}>
        <span className={styles.label}><span aria-hidden='true' className={styles.cross}>✕</span> Don’t</span>
        {identity.dossier.prohibited.slice(0, 5).map((rule) => <p className={styles.bodyText} key={rule}>{rule}</p>)}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Imagery
// ---------------------------------------------------------------------------

function DirectionPage({ context }: { context: BookPageContext }) {
  return (
    <div className={styles.split} data-variant={context.page.variant}>
      <BookImage asset={pageAsset(context)} className={styles.splitArt} identity={context.identity} />
      <div className={styles.splitText}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ as: 'h1', className: styles.h2 }} slot='title' />
        <Text context={context} options={{ className: styles.bodyText }} slot='body' />
      </div>
    </div>
  );
}

function LibraryPage({ context }: { context: BookPageContext }) {
  const assets = [0, 1, 2, 3, 4, 5].map((offset) => pageAsset(context, offset)).filter((asset, index, all): asset is BrandAsset => Boolean(asset) && all.findIndex((candidate) => candidate?.id === asset?.id) === index);
  return (
    <div className={styles.grid} data-layout='library'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <div className={styles.library} data-variant={context.page.variant}>
        {assets.map((asset) => (
          <figure key={asset.id}>
            <BookImage asset={asset} className={styles.fill} identity={context.identity} />
            <figcaption className={styles.label}>{asset.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function TreatmentPage({ context }: { context: BookPageContext }) {
  const asset = pageAsset(context);
  return (
    <div className={styles.grid} data-layout='treatment'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.h3 }} slot='lead' />
      </div>
      <div className={styles.treatment}>
        <figure><span className={styles.untreated}><BookImage asset={asset} className={styles.fill} identity={context.identity} /></span><figcaption className={styles.label}>Source</figcaption></figure>
        <figure><BookImage asset={asset} className={styles.fill} identity={context.identity} /><figcaption className={styles.label}>{context.identity.style.imageTreatment} treatment</figcaption></figure>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Voice
// ---------------------------------------------------------------------------

function VoicePrinciplesPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  return (
    <div className={styles.grid} data-layout='principles'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <ol className={styles.principles}>
        {identity.voice.principles.slice(0, 4).map((principle, index) => (
          <li key={principle}><span className={styles.label}>{String(index + 1).padStart(2, '0')}</span><strong className={styles.d1}>{principle}</strong></li>
        ))}
      </ol>
    </div>
  );
}

function VoiceDoDontPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  const rows = Math.max(identity.voice.phrases.length, identity.voice.avoid.length);
  return (
    <div className={styles.grid} data-layout='voice-dodont'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <table className={styles.dodont}>
        <thead><tr><th scope='col'><span className={styles.label}><span aria-hidden='true' className={styles.check}>✓</span> Write</span></th><th scope='col'><span className={styles.label}><span aria-hidden='true' className={styles.cross}>✕</span> Avoid</span></th></tr></thead>
        <tbody>
          {Array.from({ length: Math.min(4, rows) }, (_, index) => (
            <tr key={index}>
              <td className={styles.h3} data-face='display'>{identity.voice.phrases[index] ? `“${identity.voice.phrases[index]}”` : ''}</td>
              <td className={styles.bodyText}>{identity.voice.avoid[index] ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessagingPage({ context }: { context: BookPageContext }) {
  const levels = [['tagline', 'Tagline', styles.d2], ['promise', 'Promise', styles.h2], ['phrase', 'Proof line', styles.h3]] as const;
  return (
    <div className={styles.grid} data-layout='messaging'>
      <Label>{context.page.title}</Label>
      <ol className={styles.messaging}>
        {levels.map(([slot, name, className]) => (
          <li key={slot}><span className={styles.label}>{name}</span><Text context={context} options={{ className }} slot={slot} /></li>
        ))}
      </ol>
    </div>
  );
}

function VoiceSamplePage({ context }: { context: BookPageContext }) {
  const { identity, palette } = context;
  return (
    <div className={styles.grid} data-layout='sample'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <p className={styles.bodyText}>A lifecycle email written in the brand voice. Short subject, one idea, one action.</p>
      </div>
      <div className={styles.email}>
        <div className={styles.emailHeader}><Device className={styles.fill} context={context} dark seed={13} /><Mark className={styles.emailMark} identity={identity} onDark /></div>
        <div className={styles.emailBody}>
          <Text context={context} options={{ as: 'h2', className: styles.h2 }} slot='subject' />
          <Text context={context} options={{ className: styles.bodyText }} slot='body' />
          <span className={styles.button} style={{ background: palette.accent, color: readableOn(palette.accent, palette) }}><Text context={context} options={{ as: 'span', multiline: false }} slot='cta' /></span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------

function GridPage({ context }: { context: BookPageContext }) {
  const columns = context.page.variant === 'six' ? 6 : 12;
  return (
    <div className={styles.grid} data-layout='layout-grid'>
      <div className={styles.layoutDemo} style={{ '--columns': columns } as CSSProperties}>
        <span aria-hidden='true' className={styles.layoutColumns}>{Array.from({ length: columns }, (_, index) => <i key={index} />)}</span>
        <strong className={styles.d1} data-face='display'>{context.identity.tagline}</strong>
        <span className={styles.layoutImage}><Device className={styles.fill} context={context} dark seed={4} /></span>
        <p className={styles.small}>{context.identity.positioning}</p>
      </div>
      <div className={styles.caption}>
        <Label>{context.page.title} · {columns} columns</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
    </div>
  );
}

function BusinessCard({ context, side }: { context: BookPageContext; side: 'back' | 'front' }) {
  const { identity, palette } = context;
  if (side === 'front') {
    return (
      <div className={styles.card} data-side='front' style={{ background: palette.deep }}>
        <Device className={styles.cardArt} context={context} dark seed={5} />
        <Mark className={styles.cardMark} identity={identity} kind='wordmark' onDark />
      </div>
    );
  }
  return (
    <div className={styles.card} data-side='back' style={{ background: palette.paper, color: readableOn(palette.paper, palette) }}>
      <Text context={context} options={{ as: 'strong', className: styles.cardName, multiline: false }} slot='name' />
      <Text context={context} options={{ as: 'span', className: styles.cardRole, multiline: false }} slot='role' />
      <span className={styles.cardContact}>{identity.contactEmail}<br />{identity.website}</span>
      <Mark className={styles.cardSmallMark} identity={identity} onDark={false} />
    </div>
  );
}

function PrintPage({ context }: { context: BookPageContext }) {
  const { identity, palette } = context;
  return (
    <div className={styles.print} data-variant={context.page.variant}>
      <div className={styles.cardPair}><BusinessCard context={context} side='front' /><BusinessCard context={context} side='back' /></div>
      {context.page.variant === 'stationery' ? (
        <div className={styles.letterhead} style={{ background: palette.paper, color: readableOn(palette.paper, palette) }}>
          <Mark className={styles.letterMark} identity={identity} kind='wordmark' onDark={false} />
          <span className={styles.letterLines} aria-hidden='true'><i /><i /><i /><i /><i /><i /></span>
          <span className={styles.letterFoot}>{identity.website} · {identity.contactEmail}</span>
        </div>
      ) : null}
      <Label className={styles.printLabel}>{context.page.title} · 3.5 × 2 in · A4</Label>
    </div>
  );
}

function DigitalPage({ context }: { context: BookPageContext }) {
  const { identity, palette } = context;
  const asset = context.page.assetId ? assetById(identity, context.page.assetId) : undefined;
  return (
    <div className={styles.digital}>
      <div className={styles.browser} style={{ background: palette.paper, color: readableOn(palette.paper, palette) }}>
        <div className={styles.browserBar}><i /><i /><i /><span>{identity.website}</span></div>
        <div className={styles.browserNav}><Mark identity={identity} kind='wordmark' onDark={false} />{identity.products.slice(0, 4).map((product) => <span key={product}>{product}</span>)}</div>
        <div className={styles.browserHero}>
          <div>
            <Text context={context} options={{ as: 'h1', className: styles.h1 }} slot='headline' />
            <Text context={context} options={{ className: styles.small }} slot='body' />
            <span className={styles.button} style={{ background: palette.accent, color: readableOn(palette.accent, palette) }}>Get started</span>
          </div>
          {asset ? <BookImage asset={asset} className={styles.browserArt} identity={identity} /> : <Device className={styles.browserArt} context={context} dark={false} seed={17} />}
        </div>
      </div>
    </div>
  );
}

function SocialPage({ context }: { context: BookPageContext }) {
  const { identity, palette } = context;
  const headlines = [context.page.copy.headline ?? identity.tagline, ...identity.voice.phrases, identity.strategy.promise].filter((value, index, all) => value && all.indexOf(value) === index).slice(0, 3);
  return (
    <div className={styles.grid} data-layout='social'>
      <div className={styles.social} data-variant={context.page.variant}>
        {headlines.map((headline, index) => (
          <figure key={headline} style={{ background: palette.deep, color: readableOn(palette.deep, palette) }}>
            {index === 0 && context.page.assetId ? <BookImage asset={assetById(identity, context.page.assetId)} className={styles.socialArt} identity={identity} /> : <Device className={styles.socialArt} context={context} dark seed={30 + index} />}
            <Mark className={styles.socialMark} identity={identity} kind='wordmark' onDark />
            {index === 0 ? <Text context={context} options={{ as: 'strong', className: styles.socialHeadline }} slot='headline' /> : <strong className={styles.socialHeadline}>{headline}</strong>}
          </figure>
        ))}
      </div>
      <Label className={styles.printLabel}>{context.page.variant === 'stories' ? 'Stories · 1080 × 1920' : 'Posts · 1080 × 1080'} · {identity.socialHandle}</Label>
    </div>
  );
}

function EventPage({ context }: { context: BookPageContext }) {
  const { identity, palette } = context;
  return (
    <div className={styles.event} data-variant={context.page.variant}>
      <div className={styles.backdrop} style={{ background: palette.deep, color: readableOn(palette.deep, palette) }}>
        <Device className={styles.fill} context={context} dark seed={19} />
        <Mark className={styles.backdropMark} identity={identity} kind='wordmark' onDark />
        <Text context={context} options={{ as: 'strong', className: styles.backdropTitle, multiline: false }} slot='event' />
      </div>
      <div className={styles.badge}>
        <span className={styles.badgeStrap} style={{ background: palette.accent }} />
        <div className={styles.badgeCard} style={{ background: palette.paper, color: readableOn(palette.paper, palette) }}>
          <span className={styles.badgeBand} style={{ background: palette.deep }}><Device className={styles.fill} context={context} dark seed={21} /></span>
          <Text context={context} options={{ as: 'strong', className: styles.badgeName, multiline: false }} slot='name' />
          <span className={styles.label}>Speaker</span>
        </div>
      </div>
    </div>
  );
}

function SheetPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  const applications = identity.applications.slice(0, context.page.variant === 'strip' ? 4 : 6);
  return (
    <div className={styles.grid} data-layout='sheet'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <div className={styles.sheet} data-variant={context.page.variant}>
        {applications.map((application, index) => (
          <figure key={application.id}>
            {index % 2 === 0 ? <BookImage asset={pageAsset(context, index)} className={styles.fill} identity={identity} /> : <Device className={styles.fill} context={context} dark={index % 4 === 1} seed={50 + index} />}
            <figcaption><strong>{application.name}</strong><span className={styles.label}>{application.format}</span></figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

function bezier(curve: string): [number, number, number, number] {
  const values = curve.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  return values.length >= 4 ? [values[0]!, values[1]!, values[2]!, values[3]!] : [0.22, 1, 0.36, 1];
}

function motionItems(identity: BrandIdentity) {
  return identity.motion.length > 0
    ? identity.motion.slice(0, 4)
    : [{ curve: 'cubic-bezier(0.22, 1, 0.36, 1)', description: identity.dossier.motion, durationMs: 900, id: 'default', name: 'Brand cadence', previewPath: '' }];
}

function CurveGraph({ curve }: { curve: string }) {
  const [x1, y1, x2, y2] = bezier(curve);
  const point = (x: number, y: number) => `${x * 100} ${100 - y * 100}`;
  return (
    <svg aria-hidden='true' className={styles.curve} viewBox='-4 -12 108 124'>
      <rect className={styles.curveFrame} height='100' width='100' />
      <path className={styles.curveHandle} d={`M${point(0, 0)}L${point(x1, y1)}M${point(1, 1)}L${point(x2, y2)}`} />
      <path className={styles.curveLine} d={`M${point(0, 0)}C${point(x1, y1)} ${point(x2, y2)} ${point(1, 1)}`} />
    </svg>
  );
}

function MotionPrinciplesPage({ context }: { context: BookPageContext }) {
  const items = motionItems(context.identity);
  return (
    <div className={styles.grid} data-layout='motion'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.h3 }} slot='lead' />
      </div>
      <div className={styles.curves} data-count={items.length}>
        {items.map((item) => (
          <figure key={item.id}>
            <CurveGraph curve={item.curve} />
            <figcaption><strong>{item.name}</strong><span className={styles.label}>{item.durationMs} ms</span><span className={styles.small}>{item.description}</span></figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function MotionTokensPage({ context }: { context: BookPageContext }) {
  const items = motionItems(context.identity);
  const [x1, y1, x2, y2] = bezier(items[0]!.curve);
  const tokens = [
    { name: 'duration-fast', usage: 'Hover, press, and focus feedback', value: `${Math.round(items[0]!.durationMs * 0.2)} ms` },
    { name: 'duration-base', usage: 'Panels, menus, and content changes', value: `${Math.round(items[0]!.durationMs * 0.4)} ms` },
    ...items.map((item) => ({ name: `motion-${item.id}`, usage: item.description, value: `${item.durationMs} ms` })),
    { name: 'ease-brand', usage: 'Every brand transition', value: `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})` },
  ].slice(0, 6);
  return (
    <div className={styles.grid} data-layout='tokens'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.bodyText }} slot='lead' />
      </div>
      <table className={styles.roles}>
        <thead><tr>{['Token', 'Value', 'Use'].map((heading) => <th key={heading} scope='col'><span className={styles.label}>{heading}</span></th>)}</tr></thead>
        <tbody>{tokens.map((token) => <tr key={token.name}><th className={styles.code} scope='row'>{token.name}</th><td className={styles.code}>{token.value}</td><td className={styles.quiet}>{token.usage}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function MotionSequencePage({ context }: { context: BookPageContext }) {
  const duration = motionItems(context.identity)[0]!.durationMs;
  return (
    <div className={styles.grid} data-layout='sequence'>
      <div className={styles.intro}>
        <Label>{context.page.title}</Label>
        <Text context={context} options={{ className: styles.h3 }} slot='lead' />
      </div>
      <ol className={styles.frames}>
        {[0, 1, 2, 3, 4].map((frame) => (
          <li key={frame}>
            <span style={{ opacity: 0.35 + frame * 0.16, transform: `scale(${0.88 + frame * 0.03})` }}><Device className={styles.fill} context={context} dark={pageDark(context)} seed={60 + frame} /></span>
            <span className={styles.label}>{Math.round((duration * frame) / 4)} ms</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ClosingPage({ context }: { context: BookPageContext }) {
  const { identity } = context;
  return (
    <div className={styles.closing} data-variant={context.page.variant}>
      <Mark className={styles.closingMark} identity={identity} kind={context.page.variant === 'mark' ? 'mark' : 'wordmark'} onDark={pageDark(context)} />
      <Text context={context} options={{ as: 'h1', className: styles.d2 }} slot='statement' />
      <div className={styles.coverMeta}>
        <Label>{identity.website}</Label>
        <Label>{identity.socialHandle}</Label>
        <Label>{identity.contactEmail}</Label>
      </div>
    </div>
  );
}

const PAGE_RENDERERS: Record<BookPage['kind'], (props: { context: BookPageContext }) => ReactNode> = {
  applicationsDigital: DigitalPage,
  applicationsEvent: EventPage,
  applicationsGrid: GridPage,
  applicationsPrint: PrintPage,
  applicationsSheet: SheetPage,
  applicationsSocial: SocialPage,
  closing: ClosingPage,
  colourPairings: PairingsPage,
  colourPalette: PalettePage,
  colourProportion: ProportionPage,
  colourTints: TintsPage,
  contents: ContentsPage,
  cover: CoverPage,
  deviceConstruction: ConstructionPage,
  deviceHero: DeviceHeroPage,
  deviceIcons: IconsPage,
  deviceRules: DeviceRulesPage,
  deviceVariations: VariationsPage,
  foreword: ForewordPage,
  imageryDirection: DirectionPage,
  imageryLibrary: LibraryPage,
  imageryTreatment: TreatmentPage,
  logoClearspace: ClearspacePage,
  logoColorways: ColorwaysPage,
  logoFamily: LogoFamilyPage,
  logoMinimum: MinimumPage,
  logoMisuse: MisusePage,
  logoPrimary: LogoPrimaryPage,
  motionPrinciples: MotionPrinciplesPage,
  motionSequence: MotionSequencePage,
  motionTokens: MotionTokensPage,
  opener: OpenerPage,
  strategyAudience: AudiencePage,
  strategyChallenge: ChallengePage,
  strategyMission: MissionPage,
  strategyPillars: PillarsPage,
  strategyPremise: PremisePage,
  typeDisplay: TypeDisplayPage,
  typePairing: TypePairingPage,
  typeRoles: TypeRolesPage,
  typeScale: TypeScalePage,
  typeText: TypeTextPage,
  voiceDoDont: VoiceDoDontPage,
  voiceMessaging: MessagingPage,
  voicePrinciples: VoicePrinciplesPage,
  voiceSample: VoiceSamplePage,
};

const CHROMELESS: ReadonlySet<BookPage['kind']> = new Set(['cover', 'opener', 'closing', 'deviceHero']);

export type BookPageViewProps = {
  context: BookPageContext;
  folio?: number;
  sectionName: string;
};

function samePage(previous: BookPageViewProps, next: BookPageViewProps): boolean {
  const before = previous.context;
  const after = next.context;
  if (previous.folio !== next.folio || previous.sectionName !== next.sectionName) return false;
  if (before.editable !== after.editable || before.identity !== after.identity || before.sectionNumber !== after.sectionNumber || before.scope !== after.scope) return false;
  // The contents page lists every section, so it follows the whole book.
  if (after.page.kind === 'contents' && (before.sections !== after.sections || before.folios !== after.folios)) return false;
  return before.page === after.page || JSON.stringify(before.page) === JSON.stringify(after.page);
}

/** One printed page: editorial chrome around the page's single idea. */
export const BookPageView = memo(function BookPageView({ context, folio, sectionName }: BookPageViewProps) {
  const { identity, page, palette } = context;
  const surface = brandSurface(palette, page.tone);
  const Renderer = PAGE_RENDERERS[page.kind];
  const style = {
    '--page-bg': surface.background,
    '--page-fg': surface.foreground,
    '--page-quiet': surface.secondary,
    '--page-rule': surface.rule,
  } as CSSProperties;
  const chrome = !CHROMELESS.has(page.kind);
  return (
    <article
      aria-label={`${folio ? `${folio}. ` : ''}${page.title}`}
      className={styles.page}
      data-book-page={page.id}
      data-brand={identity.id}
      data-chrome={chrome}
      data-hidden={page.hidden || undefined}
      data-kind={page.kind}
      data-tone={page.tone}
      data-variant={page.variant}
      style={style}
    >
      {chrome ? (
        <header className={styles.runningHead}>
          <span>{identity.name}</span>
          <span>{context.sectionNumber ? `${context.sectionNumber}  ${sectionName}` : sectionName}</span>
        </header>
      ) : null}
      <div className={styles.pageBody}><Renderer context={context} /></div>
      {chrome ? (
        <footer className={styles.folio}>
          <span>Brand guidelines · Rev. {identity.revision}</span>
          <span>{folio ? String(folio).padStart(2, '0') : '—'}</span>
        </footer>
      ) : null}
    </article>
  );
}, samePage);
