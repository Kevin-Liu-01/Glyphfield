'use client';

import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import BrandEditableText from '@/components/BrandEditableText';
import {
  ArrowRight,
  Check,
  ChartLineUp,
  Command,
  CreditCard,
  FileText,
  Folder,
  Layers3,
  Search,
  Settings,
  Sparkles,
  Upload,
} from '@/components/ui/SolidIcons';
import type { BrandElement, BrandElementOverrides, BrandElementSettings } from '@/lib/brandElements';
import {
  brandAssetPath,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import {
  brandDeviceSvg,
  contrastRatio,
  isDarkColor,
  type BrandPalette,
} from '@/lib/brandOutputKit';
import { mixHexColors } from '@/lib/color';
import { asciiBanner, asciiBannerWord } from '@/lib/asciiBanner';
import { brandElementContent, featuredPlanIndex, type BrandElementContent } from '@/lib/brandElementContent';
import { EMAIL_LIFECYCLE_TEMPLATES, getEmailLifecycleTemplate } from '@/lib/emailLifecycle';
import { capVisibleFontWeight } from '@/lib/typography';

import styles from './brandElementPreviews.module.css';

type EditableField = 'body' | 'cta' | 'headline' | 'partnerName' | 'personName' | 'personRole';

export type ElementPreviewContext = {
  editable: boolean;
  element: BrandElement;
  identity: BrandIdentity;
  onChange: (patch: BrandElementOverrides) => void;
  palette: BrandPalette;
  scope: string;
  settings: BrandElementSettings;
};

type Props = { context: ElementPreviewContext };

const FIELD_LABELS: Record<EditableField, string> = {
  body: 'supporting copy',
  cta: 'action',
  headline: 'headline',
  partnerName: 'partner name',
  personName: 'name',
  personRole: 'role',
};

const CONTENT_CACHE = new WeakMap<BrandIdentity, BrandElementContent>();

/** Template content from the identity's own products, proof, customers and samples. */
function contentOf(context: Pick<ElementPreviewContext, 'identity'>): BrandElementContent {
  const cached = CONTENT_CACHE.get(context.identity);
  if (cached) return cached;
  const content = brandElementContent(context.identity);
  CONTENT_CACHE.set(context.identity, content);
  return content;
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] ?? name;
}

function capitalize(value: string): string {
  return value ? `${value[0]!.toLocaleUpperCase()}${value.slice(1)}` : value;
}

function Edit({ as = 'span', className, context, field, multiline = false }: { as?: 'div' | 'h1' | 'h2' | 'p' | 'span' | 'strong'; className?: string; context: ElementPreviewContext; field: EditableField; multiline?: boolean }) {
  return (
    <BrandEditableText
      as={as}
      className={className}
      editable={context.editable}
      label={`Edit ${FIELD_LABELS[field]} in place`}
      multiline={multiline}
      onCommit={(value) => context.onChange({ [field]: value })}
      value={context.settings[field]}
    />
  );
}

function onAccent(context: ElementPreviewContext): string {
  const { accentColor, backgroundColor, foregroundColor } = context.settings;
  const candidates = [backgroundColor, foregroundColor, '#FFFFFF', '#0B0B0B'];
  return candidates.reduce((best, candidate) => (contrastRatio(accentColor, candidate) > contrastRatio(accentColor, best) + 0.5 ? candidate : best), candidates[0]!);
}

function Logo({ className = '', context, kind = 'mark', onDark }: { className?: string; context: ElementPreviewContext; kind?: 'mark' | 'wordmark'; onDark?: boolean }) {
  const { identity, settings } = context;
  if (!settings.showLogo) return null;
  const dark = onDark ?? isDarkColor(settings.backgroundColor);
  const mark = dark ? brandAssetPath(identity, 'mark-light') ?? brandAssetPath(identity, 'mark-dark') : brandAssetPath(identity, 'mark-dark') ?? brandAssetPath(identity, 'mark-light');
  const wordmark = dark ? brandAssetPath(identity, 'wordmark-light') : brandAssetPath(identity, 'wordmark');
  const source = kind === 'wordmark' ? wordmark ?? mark : mark;
  if (!source) return <strong className={`${styles.logoText} ${className}`.trim()}>{identity.shortName || identity.name}</strong>;
  return <img alt={`${identity.name} ${kind}`} className={`brand-identity-mark ${styles.logo} ${className}`.trim()} src={source} />;
}

function Device({ className = '', context, dark, seed = 0 }: { className?: string; context: ElementPreviewContext; dark?: boolean; seed?: number }) {
  const markup = brandDeviceSvg(context.identity, {
    height: 900,
    prefix: `${context.scope}-${context.element.id}-${seed}`,
    seed: seed + 11,
    tone: (dark ?? isDarkColor(context.settings.backgroundColor)) ? 'dark' : 'light',
    width: 1600,
  });
  return <span aria-hidden='true' className={`${styles.device} ${className}`.trim()} dangerouslySetInnerHTML={{ __html: markup }} />;
}

function Pattern({ context }: Props) {
  if (context.settings.pattern === 'none') return null;
  return <span aria-hidden='true' className={styles.pattern} data-pattern={context.settings.pattern} style={{ opacity: context.settings.patternOpacity / 100 }} />;
}

function artworkStyle(settings: BrandElementSettings): CSSProperties {
  return { transform: `translate(${settings.artworkX}px, ${settings.artworkY}px) scale(${settings.artworkScale / 100})` };
}

function Website({ context }: Props) {
  return context.settings.showWebsite ? <span className={styles.meta}>{context.identity.website}</span> : null;
}

function Button({ context, className = '' }: Props & { className?: string }) {
  if (!context.settings.cta) return null;
  return (
    <span className={`${styles.button} ${className}`.trim()}>
      <Edit context={context} field='cta' />
      <ArrowRight aria-hidden='true' className={styles.buttonIcon} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Artboard
// ---------------------------------------------------------------------------

type ArtboardSize = { height: number | 'auto'; width: number };

const FAMILY_SIZES: Partial<Record<BrandElement['preview'], ArtboardSize>> = {
  component: { height: 800, width: 1280 },
  developer: { height: 640, width: 1280 },
  editorial: { height: 900, width: 1600 },
  email: { height: 'auto', width: 640 },
  event: { height: 1200, width: 1000 },
  icon: { height: 720, width: 1200 },
  logo: { height: 1000, width: 1600 },
  physical: { height: 900, width: 1400 },
  social: { height: 900, width: 1600 },
  web: { height: 800, width: 1280 },
};

const ELEMENT_SIZES: Record<string, ArtboardSize> = {
  'app-store-gallery': { height: 1400, width: 1600 },
  'booth-wall': { height: 1000, width: 1500 },
  'case-study-cover': { height: 630, width: 1200 },
  'blog-cover': { height: 630, width: 1200 },
  'checkout-card': { height: 800, width: 1000 },
  'cli-banner': { height: 620, width: 960 },
  'code-playground': { height: 640, width: 960 },
  'command-menu': { height: 720, width: 1100 },
  'community-card': { height: 675, width: 1200 },
  'dashboard-widget': { height: 720, width: 1000 },
  'docs-header': { height: 480, width: 1440 },
  'email-signature': { height: 220, width: 640 },
  'email-system-sheet': { height: 'auto', width: 1440 },
  'error-page': { height: 900, width: 1440 },
  'event-backdrop': { height: 900, width: 1600 },
  'event-badge': { height: 1400, width: 1000 },
  'feature-grid': { height: 800, width: 1440 },
  'github-readme': { height: 640, width: 1280 },
  'hero-section': { height: 760, width: 1440 },
  lanyard: { height: 1400, width: 1000 },
  letterhead: { height: 1414, width: 1000 },
  'linkedin-post': { height: 1200, width: 1200 },
  'navigation-bar': { height: 520, width: 1440 },
  notebook: { height: 1414, width: 1000 },
  'notebook-cover': { height: 1414, width: 1000 },
  opengraph: { height: 630, width: 1200 },
  'package-card': { height: 320, width: 512 },
  'packaging-label': { height: 1500, width: 1000 },
  'partnership-lockup': { height: 900, width: 1600 },
  'podcast-cover': { height: 1200, width: 1200 },
  'pricing-card': { height: 760, width: 1200 },
  'release-notes': { height: 630, width: 1200 },
  'report-cover': { height: 1414, width: 1000 },
  'social-avatar': { height: 720, width: 1200 },
  'social-carousel': { height: 1350, width: 1080 },
  'sticker-sheet': { height: 1060, width: 1500 },
  'testimonial-card': { height: 720, width: 1100 },
  'toast-notification': { height: 600, width: 1000 },
  'video-thumbnail': { height: 720, width: 1280 },
  'web-card': { height: 480, width: 720 },
  'whitepaper-cover': { height: 1414, width: 1000 },
};

function elementArtboardSize(element: BrandElement): ArtboardSize {
  return ELEMENT_SIZES[element.id] ?? FAMILY_SIZES[element.preview] ?? { height: 800, width: 1280 };
}

/** Lays the artboard out at its true pixel size and scales it to the available width. */
function ScaledArtboard({ children, size, style }: { children: ReactNode; size: ArtboardSize; style: CSSProperties }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(size.height === 'auto' ? 800 : size.height);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const board = boardRef.current;
    if (!frame || !board) return;
    const update = () => {
      const available = frame.parentElement?.clientWidth ?? frame.clientWidth;
      setScale(Math.min(1, available / size.width));
      setContentHeight(size.height === 'auto' ? board.offsetHeight : size.height);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame.parentElement ?? frame);
    observer.observe(board);
    return () => observer.disconnect();
  }, [size.height, size.width]);

  return (
    <div className={styles.frame} ref={frameRef} style={{ height: contentHeight * scale, width: size.width * scale }}>
      <div
        className={`brand-element-artboard-surface ${styles.artboard}`}
        data-artboard-width={size.width}
        ref={boardRef}
        style={{ ...style, height: size.height === 'auto' ? undefined : size.height, transform: `scale(${scale})`, width: size.width }}
      >
        {children}
      </div>
    </div>
  );
}

function artboardStyle(context: ElementPreviewContext): CSSProperties {
  const { identity, settings } = context;
  const body = brandTypographyRole(identity, 'Body');
  const code = brandTypographyRole(identity, 'Code');
  const display = brandTypographyRole(identity, settings.fontRole);
  const tracking = Math.max(-3, Math.min(2, display.letterSpacing ?? 0)) * 0.018;
  return {
    '--el-accent': settings.accentColor,
    // Accent used as text or a thin mark falls back to the text colour when it would not read.
    '--el-accent-text': contrastRatio(settings.accentColor, settings.backgroundColor) >= 3 ? settings.accentColor : settings.foregroundColor,
    '--el-bg': settings.backgroundColor,
    '--el-body': `'${brandTypographyFamily(identity, 'Body')}', sans-serif`,
    '--el-body-weight': capVisibleFontWeight(body.weight ?? 400),
    '--el-code': `'${brandTypographyFamily(identity, 'Code')}', monospace`,
    '--el-code-weight': capVisibleFontWeight(code.weight ?? 400),
    '--el-display': `'${brandTypographyFamily(identity, settings.fontRole)}', sans-serif`,
    '--el-display-weight': capVisibleFontWeight(settings.fontWeight),
    '--el-fg': settings.foregroundColor,
    '--el-leading': Math.min(1.1, Math.max(0.92, display.lineHeight ?? 1)),
    '--el-on-accent': onAccent(context),
    '--el-quiet': mixHexColors(settings.foregroundColor, settings.backgroundColor, 0.34),
    '--el-radius': `${Math.min(identity.style?.borderRadius ?? 6, 16)}px`,
    '--el-raised': mixHexColors(settings.foregroundColor, settings.backgroundColor, 0.95),
    '--el-rule': mixHexColors(settings.foregroundColor, settings.backgroundColor, 0.85),
    '--el-scale': settings.scale === 'compact' ? 0.82 : settings.scale === 'bold' ? 1.22 : 1,
    '--el-tracking': `${tracking}em`,
  } as CSSProperties;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

function EmailHeaderArt({ context, compact = false }: Props & { compact?: boolean }) {
  const { element, identity, settings } = context;
  const template = getEmailLifecycleTemplate(element.id, identity) ?? getEmailLifecycleTemplate('welcome-email', identity);
  if (identity.id === 'gt' && template?.artworkPath) {
    return <span className={styles.emailArt}><img alt='' src={template.artworkPath} style={artworkStyle(settings)} /></span>;
  }
  // The wordmark already leads the email; the header is the device alone.
  return (
    <span className={styles.emailArt} data-compact={compact || undefined} style={artworkStyle(settings)}>
      <Device context={context} dark seed={template?.id.length ?? 3} />
    </span>
  );
}

function LifecycleEmail({ context }: Props) {
  const { element, identity, settings } = context;
  const template = getEmailLifecycleTemplate(element.id, identity);
  if (!template) return <TransactionalEmail context={context} />;
  if (template.artworkPath === null) return <PlainTextEmail context={context} />;
  const products = identity.id === 'gt' ? [] : identity.products.slice(0, 3);
  return (
    <div className={styles.email}>
      <header className={styles.emailTop}><Logo context={context} kind='wordmark' /><span className={styles.meta}>{template.timing}</span></header>
      {settings.showLogo ? <EmailHeaderArt context={context} /> : null}
      <div className={styles.emailContent}>
        <Edit as='h1' className={styles.emailTitle} context={context} field='headline' multiline />
        <p className={styles.emailGreeting}>Hi {firstName(contentOf(context).person.name)},</p>
        <Edit as='p' className={styles.emailText} context={context} field='body' multiline />
        <Button context={context} />
        {template.supportingCards.length > 0 ? (
          <div className={styles.emailCards}>
            {template.supportingCards.map((card) => (
              <article key={card.imagePath}>
                <div><strong>{card.title}</strong><p>{card.body}</p></div>
                <span style={{ backgroundColor: card.imageBackgroundColor }}><img alt='' src={card.imagePath} /></span>
              </article>
            ))}
          </div>
        ) : products.length > 0 && element.id === 'welcome-email' ? (
          <ol className={styles.emailProducts}>{products.map((product, index) => <li key={product}><span>{String(index + 1).padStart(2, '0')}</span>{product}</li>)}</ol>
        ) : null}
      </div>
      <EmailFooter context={context} note={template.timing} />
    </div>
  );
}

function EmailFooter({ context, note }: Props & { note?: string }) {
  const { identity } = context;
  return (
    <footer className={styles.emailFooter}>
      <span>Questions? Reply to this email and the {identity.name} team will help.</span>
      <span className={styles.emailFooterLinks}><Website context={context} /><span>Unsubscribe</span>{note ? <span>{note}</span> : null}</span>
    </footer>
  );
}

function PlainTextEmail({ context }: Props) {
  const { identity, settings } = context;
  return (
    <div className={styles.letter}>
      <p className={styles.meta}>Subject · {settings.headline}</p>
      <p>Hi {firstName(contentOf(context).person.name)},</p>
      <Edit as='p' context={context} field='body' multiline />
      <p>All best,<br />{settings.personName}<br /><span className={styles.quiet}>{settings.personRole}</span></p>
      <p className={styles.meta}>{identity.website}/account · Unsubscribe</p>
    </div>
  );
}

function TransactionalEmail({ context }: Props) {
  if (context.element.id === 'email-signature') return <EmailSignature context={context} />;
  if (context.element.id === 'newsletter-email') return <NewsletterEmail context={context} />;
  return <InvitationEmail context={context} />;
}

function EmailSignature({ context }: Props) {
  return (
    <div className={styles.signature}>
      <Logo className={styles.signatureMark} context={context} />
      <div>
        <Edit as='strong' className={styles.signatureName} context={context} field='personName' />
        <Edit as='span' className={styles.quiet} context={context} field='personRole' />
        <span className={styles.meta}>{context.identity.contactEmail}</span>
        <Website context={context} />
      </div>
    </div>
  );
}

function NewsletterEmail({ context }: Props) {
  const content = contentOf(context);
  const stories = content.products.slice(0, 3);
  return (
    <div className={styles.email}>
      <header className={styles.emailTop}><Logo context={context} kind='wordmark' /><span className={styles.meta}>{context.identity.name} update</span></header>
      <EmailHeaderArt context={context} />
      <div className={styles.emailContent}>
        <span className={styles.meta}>What changed</span>
        <Edit as='h1' className={styles.emailTitle} context={context} field='headline' multiline />
        <Edit as='p' className={styles.emailText} context={context} field='body' multiline />
        {content.release.items.length ? <ul className={styles.newsletterList}>{content.release.items.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul> : null}
        <Button context={context} />
        <div className={styles.newsletterStories}>
          {stories.map((story, index) => (
            <article key={story.name}><span className={styles.meta}>{String(index + 1).padStart(2, '0')}</span><strong>{story.name}</strong><p>{story.summary || context.identity.positioning}</p></article>
          ))}
        </div>
      </div>
      <EmailFooter context={context} />
    </div>
  );
}

function InvitationEmail({ context }: Props) {
  const { identity } = context;
  return (
    <div className={styles.email}>
      <header className={styles.emailTop}><Logo context={context} kind='wordmark' /><span className={styles.meta}>Invitation</span></header>
      <EmailHeaderArt context={context} />
      <div className={styles.emailContent}>
        <dl className={styles.inviteFacts}><div><dt>Date</dt><dd>Thu 14 Nov</dd></div><div><dt>Time</dt><dd>17:00 UTC</dd></div><div><dt>Where</dt><dd>Online</dd></div></dl>
        <Edit as='h1' className={styles.emailTitle} context={context} field='headline' multiline />
        <Edit as='p' className={styles.emailText} context={context} field='body' multiline />
        <Button context={context} />
      </div>
      <EmailFooter context={context} note={`${identity.name} events`} />
    </div>
  );
}

function EmailSystemSheet({ context }: Props) {
  const { identity } = context;
  const templates = EMAIL_LIFECYCLE_TEMPLATES.map((template) => getEmailLifecycleTemplate(template.id, identity)).filter((template): template is NonNullable<typeof template> => Boolean(template));
  return (
    <div className={styles.sheet}>
      <header className={styles.sheetHeader}>
        <Logo context={context} kind='wordmark' />
        <Edit as='h1' className={styles.headline} context={context} field='headline' />
        <span className={styles.meta}>{templates.length} templates · lifecycle, utility, and billing</span>
      </header>
      <div className={styles.sheetGrid}>
        {templates.map((template) => (
          <article key={template.id}>
            {template.artworkPath ? (identity.id === 'gt' ? <span className={styles.sheetArt}><img alt='' src={template.artworkPath} /></span> : <span className={styles.sheetArt}><Device context={context} dark seed={template.id.length} /></span>) : <span className={styles.sheetPlain}>Hi {firstName(contentOf(context).person.name)},<br />Plain-text note</span>}
            <strong>{template.subject}</strong>
            <span className={styles.meta}>{template.group} · {template.timing}</span>
          </article>
        ))}
      </div>
    </div>
  );
}

function EmailPreview({ context }: Props) {
  if (context.element.id === 'email-system-sheet') return <EmailSystemSheet context={context} />;
  return <LifecycleEmail context={context} />;
}

// ---------------------------------------------------------------------------
// Social and web
// ---------------------------------------------------------------------------

function Composition({ context, children, art, className = '' }: Props & { art?: ReactNode; children: ReactNode; className?: string }) {
  const { settings } = context;
  return (
    <div className={`${styles.composition} ${className}`.trim()} data-layout={settings.layout}>
      <Pattern context={context} />
      <div className={styles.compositionText}>{children}</div>
      {settings.layout === 'split' ? <div className={styles.compositionArt}>{art ?? <Device context={context} seed={7} />}</div> : null}
      {settings.layout === 'stacked' && art !== null ? <div className={styles.compositionBand}>{art ?? <Device context={context} seed={7} />}</div> : null}
    </div>
  );
}

function SocialHeader({ context }: Props) {
  return (
    <div className={styles.socialHeader}>
      <Logo context={context} />
      <span><strong>{context.identity.name}</strong><span className={styles.meta}>{context.identity.socialHandle}</span></span>
    </div>
  );
}

function SocialPost({ context }: Props) {
  const { element, settings } = context;
  const art = settings.showLogo ? (
    <span className={styles.artStage}><Device context={context} seed={9} /><span className={styles.artMark} style={artworkStyle(settings)}><Logo context={context} kind='mark' onDark={isDarkColor(context.palette.deep)} /></span></span>
  ) : undefined;
  return (
    <Composition art={art} context={context}>
      <SocialHeader context={context} />
      <div className={styles.stack}>
        {element.id === 'launch-card' ? <span className={styles.chip}>Now available</span> : null}
        {element.id === 'community-card' ? <span className={styles.chip}># announcements</span> : null}
        <Edit as='h1' className={styles.headline} context={context} field='headline' multiline />
        {settings.body ? <Edit as='p' className={styles.lead} context={context} field='body' multiline /> : null}
        <Button context={context} />
      </div>
      <div className={styles.footerRow}><Website context={context} />{element.id === 'social-carousel' ? <span className={styles.meta}>1 / 5 →</span> : null}</div>
    </Composition>
  );
}

function VideoThumbnail({ context }: Props) {
  return (
    <div className={styles.thumbnail}>
      <Device className={styles.fill} context={context} dark seed={4} />
      <div className={styles.thumbnailText}>
        <Logo context={context} kind='wordmark' onDark />
        <Edit as='h1' className={styles.thumbnailTitle} context={context} field='headline' multiline />
      </div>
      <span aria-hidden='true' className={styles.play}>▶</span>
    </div>
  );
}

function PodcastCover({ context }: Props) {
  return (
    <div className={styles.podcast}>
      <Device className={styles.fill} context={context} seed={6} />
      <Logo className={styles.podcastMark} context={context} />
      <Edit as='h1' className={styles.podcastTitle} context={context} field='headline' multiline />
      <span className={styles.meta}>A podcast by {context.identity.name}</span>
    </div>
  );
}

function AppStoreGallery({ context }: Props) {
  const content = contentOf(context);
  const [first, second, third] = [content.products[0], content.products[1] ?? content.products[0], content.products[2] ?? content.products[0]];
  return (
    <div className={styles.gallery}>
      <figure>
        <Edit as='h2' className={styles.galleryCaption} context={context} field='headline' multiline />
        <span className={styles.phone}>
          <span className={styles.phoneScreen}>
            <span className={styles.phoneTop}><Logo context={context} /><span className={styles.meta}>{first?.name}</span></span>
            <span className={styles.phoneMetric}><span className={styles.meta}>{content.metric.label}</span><strong>{content.metric.value}</strong><small>{content.metric.change}</small></span>
            <span className={styles.phoneArt}><Device context={context} dark seed={2} /></span>
          </span>
        </span>
      </figure>
      <figure>
        <h2 className={styles.galleryCaption}>{second?.summary || second?.name}</h2>
        <span className={styles.phone}>
          <span className={styles.phoneScreen}>
            <span className={styles.phoneTop}><Logo context={context} /><span className={styles.meta}>{second?.name}</span></span>
            {content.actions.slice(0, 4).map((action, index) => <span className={styles.phoneRow} data-active={index === 0 || undefined} key={action}><i />{capitalize(action)}</span>)}
          </span>
        </span>
      </figure>
      <figure>
        <h2 className={styles.galleryCaption}>{third?.summary || third?.name}</h2>
        <span className={styles.phone}>
          <span className={styles.phoneScreen}>
            <span className={styles.phoneTop}><Logo context={context} /><span className={styles.meta}>{third?.name}</span></span>
            <span className={styles.phoneCode}>{content.code.snippet}</span>
            <span className={styles.phoneFoot}>{content.proof[0] ?? content.tagline}</span>
          </span>
        </span>
      </figure>
    </div>
  );
}

function SocialPreview({ context }: Props) {
  if (context.element.id === 'video-thumbnail') return <VideoThumbnail context={context} />;
  if (context.element.id === 'podcast-cover') return <PodcastCover context={context} />;
  if (context.element.id === 'app-store-gallery') return <AppStoreGallery context={context} />;
  return <SocialPost context={context} />;
}

function ErrorPage({ context }: Props) {
  return (
    <div className={styles.site}>
      <SiteNav context={context} />
      <div className={styles.errorBody}>
        <span className={styles.errorCode}>404</span>
        <Edit as='h1' className={styles.headline} context={context} field='headline' />
        <Edit as='p' className={styles.lead} context={context} field='body' multiline />
        <Button context={context} />
      </div>
    </div>
  );
}

function SiteNav({ context }: Props) {
  return (
    <nav className={styles.siteNav}>
      <Logo context={context} kind='wordmark' />
      <span className={styles.siteLinks}>{context.identity.products.slice(0, 4).map((product) => <span key={product}>{product}</span>)}</span>
    </nav>
  );
}

function WebCard({ context }: Props) {
  return (
    <div className={styles.webCard}>
      <span className={styles.webCardArt}><Device context={context} seed={8} /><span className={styles.artMark} style={artworkStyle(context.settings)}><Logo context={context} onDark={isDarkColor(context.palette.deep)} /></span></span>
      <div className={styles.webCardText}>
        <Edit as='h1' className={styles.cardTitle} context={context} field='headline' multiline />
        <Edit as='p' className={styles.body} context={context} field='body' multiline />
        <Button context={context} />
      </div>
    </div>
  );
}

function WebPreview({ context }: Props) {
  if (context.element.id === 'error-page') return <ErrorPage context={context} />;
  if (context.element.id === 'web-card') return <WebCard context={context} />;
  return <SocialPost context={context} />;
}

// ---------------------------------------------------------------------------
// Developer
// ---------------------------------------------------------------------------

/** Box-drawing shadows as strokes inside a one-by-two cell: [x, y, width, height] rects. */
const ASCII_STROKES: Readonly<Record<string, readonly (readonly [number, number, number, number])[]>> = {
  '═': [[0, 0.8, 1, 0.14], [0, 1.06, 1, 0.14]],
  '║': [[0.3, 0, 0.14, 2], [0.56, 0, 0.14, 2]],
  '╔': [[0.3, 0.8, 0.7, 0.14], [0.3, 0.8, 0.14, 1.2], [0.56, 1.06, 0.44, 0.14], [0.56, 1.06, 0.14, 0.94]],
  '╗': [[0, 0.8, 0.7, 0.14], [0.56, 0.8, 0.14, 1.2], [0, 1.06, 0.44, 0.14], [0.3, 1.06, 0.14, 0.94]],
  '╚': [[0.3, 0, 0.14, 1.2], [0.3, 1.06, 0.7, 0.14], [0.56, 0, 0.14, 0.94], [0.56, 0.8, 0.44, 0.14]],
  '╝': [[0.56, 0, 0.14, 1.2], [0, 1.06, 0.7, 0.14], [0.3, 0, 0.14, 0.94], [0, 0.8, 0.44, 0.14]],
  '▀': [[0, 0, 1.02, 1]],
  '▄': [[0, 1, 1.02, 1]],
};

/**
 * Draws ASCII art as cells so it never depends on a font having block glyphs.
 * Full blocks fill their cell; box-drawing shadows draw as thin double strokes.
 */
function AsciiArt({ className, text }: { className: string; text: string }) {
  const lines = text.split('\n');
  const width = Math.max(...lines.map((line) => [...line].length));
  const cells = lines.flatMap((line, row) => [...line].flatMap((character, column) => {
    if (character === ' ') return [];
    if (character === '█') return [<rect height='2' key={`${row}-${column}`} width='1.02' x={column} y={row * 2} />];
    const strokes = ASCII_STROKES[character] ?? [[0.2, 0.6, 0.6, 0.8]];
    return strokes.map(([x, y, w, h], index) => <rect fillOpacity='0.5' height={h} key={`${row}-${column}-${index}`} width={w} x={column + x} y={row * 2 + y} />);
  }));
  return (
    <svg aria-label={text} className={className} fill='currentColor' role='img' viewBox={`0 0 ${width} ${lines.length * 2}`} style={{ aspectRatio: `${width} / ${lines.length * 2}` }}>
      {cells}
    </svg>
  );
}

function Terminal({ children, context, title }: Props & { children: ReactNode; title: string }) {
  return (
    <div className={styles.terminal}>
      <div className={styles.terminalBar}><i /><i /><i /><span>{title}</span></div>
      <div className={styles.terminalBody}>{children}</div>
      <Pattern context={context} />
    </div>
  );
}

function CliBanner({ context }: Props) {
  const { identity, settings } = context;
  const content = contentOf(context);
  const next = content.code.snippet.split('\n').find((line) => line.trim() && line.trim() !== settings.cta.trim());
  return (
    <Terminal context={context} title={`${identity.website || identity.id} — zsh — 80×24`}>
      <AsciiArt className={styles.ascii} text={asciiBanner(asciiBannerWord(identity.name, identity.shortName))} />
      <p><span className={styles.prompt}>$</span> <Edit context={context} field='cta' /></p>
      {next ? <p><span className={styles.prompt}>$</span> <span className={styles.quiet}>{next}</span></p> : null}
      {settings.headline ? <p className={styles.terminalComment}># <Edit context={context} field='headline' /></p> : null}
    </Terminal>
  );
}

function AsciiMarkPreview({ context }: Props) {
  const word = context.settings.headline.trim() || asciiBannerWord(context.identity.name, context.identity.shortName);
  return (
    <div className={styles.asciiBoard}>
      <AsciiArt className={styles.asciiLarge} text={asciiBanner(word) || asciiBanner(asciiBannerWord(context.identity.name, context.identity.shortName))} />
      <Edit as='p' className={styles.quiet} context={context} field='body' multiline />
    </div>
  );
}

function TerminalTheme({ context }: Props) {
  const { palette } = context;
  const content = contentOf(context);
  const swatches = [['accent', context.settings.accentColor], ['success', palette.secondary], ['warning', palette.highlight], ['comment', mixHexColors(context.settings.foregroundColor, context.settings.backgroundColor, 0.5)]] as const;
  return (
    <Terminal context={context} title={content.code.label}>
      <p className={styles.terminalComment}># <Edit context={context} field='headline' /></p>
      <pre className={styles.codeBlock}>{content.code.snippet}</pre>
      <div className={styles.swatches}>{swatches.map(([name, color]) => <span key={name}><i style={{ background: color }} />{name}<b>{color}</b></span>)}</div>
    </Terminal>
  );
}

function DocsHeader({ context }: Props) {
  const tabs = ['Get started', ...contentOf(context).products.slice(0, 3).map(({ name }) => name)];
  return (
    <div className={styles.docsHeader}>
      <Pattern context={context} />
      <div className={styles.docsTop}><Logo context={context} kind='wordmark' /><span className={styles.search}><Search aria-hidden='true' />Search documentation<kbd>⌘K</kbd></span></div>
      <span className={styles.meta}>Docs / Get started</span>
      <Edit as='h1' className={styles.headline} context={context} field='headline' />
      <Edit as='p' className={styles.lead} context={context} field='body' multiline />
      <span className={styles.docsTabs}>{tabs.map((tab, index) => <span data-active={index === 0 || undefined} key={tab}>{tab}</span>)}</span>
      <Device className={styles.docsArt} context={context} seed={12} />
    </div>
  );
}

function ReadmeHero({ context }: Props) {
  const { identity } = context;
  const content = contentOf(context);
  return (
    <div className={styles.readme}>
      <Device className={styles.fill} context={context} seed={14} />
      <div className={styles.readmeText}>
        <Logo context={context} kind='wordmark' onDark={isDarkColor(context.palette.deep)} />
        <Edit as='h1' className={styles.headline} context={context} field='headline' multiline />
        <Edit as='p' className={styles.lead} context={context} field='body' multiline />
        <code className={styles.install}>$ <Edit context={context} field='cta' /></code>
        <span className={styles.badges}>{[content.packageName, identity.website, identity.socialHandle].filter(Boolean).map((badge) => <span key={badge}>{badge}</span>)}</span>
      </div>
    </div>
  );
}

function PackageCard({ context }: Props) {
  const content = contentOf(context);
  return (
    <div className={styles.package}>
      <div className={styles.packageTop}><Logo context={context} /><Edit as='strong' className={styles.packageName} context={context} field='headline' /><span className={styles.chip}>{context.identity.name}</span></div>
      <Edit as='p' className={styles.body} context={context} field='body' multiline />
      <code className={styles.install}>$ <Edit context={context} field='cta' /></code>
      <span className={styles.packageStats}>{[content.proof[0], context.identity.website].filter(Boolean).map((stat) => <span key={stat}>{stat}</span>)}</span>
    </div>
  );
}

function ApiHero({ context }: Props) {
  const content = contentOf(context);
  const http = /^(GET|POST|PUT|PATCH|DELETE)\s/.test(content.code.label);
  return (
    <div className={styles.api}>
      <div className={styles.apiText}>
        <span className={styles.meta}>{http ? 'API reference' : 'Quickstart'}</span>
        <Edit as='h1' className={styles.headline} context={context} field='headline' />
        <Edit as='p' className={styles.lead} context={context} field='body' multiline />
        <code className={styles.endpoint}><Edit context={context} field='cta' /></code>
      </div>
      <div className={styles.apiCode}>
        <span className={styles.meta}>{http ? 'Request' : content.code.label}</span>
        <pre>{content.code.snippet}</pre>
        {content.install && content.install !== content.code.snippet.split('\n')[0] ? <><span className={styles.meta}>Install</span><pre>{content.install}</pre></> : null}
      </div>
    </div>
  );
}

function CodePlayground({ context }: Props) {
  const lines = contentOf(context).code.snippet.split('\n');
  return (
    <div className={styles.playground}>
      <div className={styles.playgroundBar}><Edit as='strong' context={context} field='headline' /><span className={styles.chip}>Run ▸</span></div>
      <div className={styles.playgroundPanes}>
        <pre className={styles.playgroundEditor}>{lines.map((line, index) => <span key={index}><span className={styles.quiet}>{String(index + 1).padStart(2, ' ')}</span>  {line}{'\n'}</span>)}</pre>
        <div className={styles.playgroundOutput}><span className={styles.meta}>Install</span><p className={styles.ok}>$ <Edit context={context} field='cta' /></p><Edit as='p' className={styles.quiet} context={context} field='body' multiline /></div>
      </div>
    </div>
  );
}

function ReleaseNotes({ context }: Props) {
  const { items } = contentOf(context).release;
  return (
    <div className={styles.release}>
      <Pattern context={context} />
      <div className={styles.releaseTop}><Logo context={context} kind='wordmark' /><span className={styles.chip}>Latest</span><span className={styles.meta}>Changelog</span></div>
      <Edit as='h1' className={styles.headline} context={context} field='headline' multiline />
      <Edit as='p' className={styles.lead} context={context} field='body' multiline />
      <ul className={styles.changes}>{items.map((change) => <li key={change}><Check aria-hidden='true' />{change}</li>)}</ul>
      <Button context={context} />
    </div>
  );
}

const DEVELOPER_RENDERERS: Record<string, (props: Props) => ReactNode> = {
  'api-reference-hero': ApiHero,
  'ascii-mark': AsciiMarkPreview,
  'cli-banner': CliBanner,
  'code-playground': CodePlayground,
  'docs-header': DocsHeader,
  'github-readme': ReadmeHero,
  'package-card': PackageCard,
  'release-notes': ReleaseNotes,
  'terminal-theme': TerminalTheme,
};

function DeveloperPreview({ context }: Props) {
  const Renderer = DEVELOPER_RENDERERS[context.element.id] ?? CliBanner;
  return <Renderer context={context} />;
}

// ---------------------------------------------------------------------------
// Product components
// ---------------------------------------------------------------------------

function AppFrame({ children, context, className = '' }: Props & { children: ReactNode; className?: string }) {
  return (
    <div className={`${styles.app} ${className}`.trim()}>
      <Pattern context={context} />
      {children}
    </div>
  );
}

function listFromBody(value: string): string[] {
  return value.split(/[·|\n]/).map((item) => item.trim()).filter(Boolean);
}

function NavigationBar({ context }: Props) {
  const content = contentOf(context);
  return (
    <AppFrame className={styles.navStage} context={context}>
      <nav className={styles.navBar}>
        <span className={styles.navBrand}><Logo context={context} kind='wordmark' /></span>
        <span className={styles.navLinks}>{listFromBody(context.settings.body).map((item, index) => <span data-active={index === 0 || undefined} key={item}>{item}</span>)}</span>
        <span className={styles.navActions}><span className={styles.quiet}>Sign in</span><Button context={context} /></span>
      </nav>
      <div className={styles.navMenu}>
        <div className={styles.navMenuList}>
          {content.products.slice(0, 4).map((product, index) => (
            <span data-active={index === 0 || undefined} key={product.name}><strong>{product.name}</strong><small>{product.summary}</small></span>
          ))}
        </div>
        <div className={styles.navMenuFeature}>
          <Device className={styles.fill} context={context} seed={2} />
          <span className={styles.navMenuCaption}><span className={styles.meta}>{context.identity.website}</span><Edit as='strong' context={context} field='headline' /></span>
        </div>
      </div>
    </AppFrame>
  );
}

function HeroSection({ context }: Props) {
  return (
    <div className={styles.hero}>
      <nav className={styles.navBar}><span className={styles.navBrand}><Logo context={context} kind='wordmark' /></span><span className={styles.navLinks}>{contentOf(context).products.slice(0, 4).map(({ name }) => <span key={name}>{name}</span>)}</span><span className={styles.quiet}>Sign in</span></nav>
      <Composition context={context}>
        <span className={styles.chip}>{contentOf(context).products[0]?.name ?? context.identity.name}</span>
        <Edit as='h1' className={styles.headline} context={context} field='headline' multiline />
        <Edit as='p' className={styles.lead} context={context} field='body' multiline />
        <span className={styles.buttonRow}><Button context={context} /><span className={styles.ghostButton}>Talk to sales</span></span>
      </Composition>
    </div>
  );
}

const FEATURE_ICONS = [Layers3, Sparkles, ChartLineUp, Settings];

function FeatureGrid({ context }: Props) {
  const products = contentOf(context).products.slice(0, 3);
  return (
    <AppFrame className={styles.features} context={context}>
      <div className={styles.featuresHead}>
        <Edit as='h1' className={styles.headline} context={context} field='headline' multiline />
        <Edit as='p' className={styles.lead} context={context} field='body' multiline />
      </div>
      <div className={styles.featureCards}>
        {products.map((product, index) => {
          const Icon = FEATURE_ICONS[index % FEATURE_ICONS.length]!;
          return (
            <article key={product.name}>
              <span className={styles.featureIcon}><Icon aria-hidden='true' /></span>
              <strong>{product.name}</strong>
              <p>{product.summary || context.identity.positioning}</p>
            </article>
          );
        })}
      </div>
    </AppFrame>
  );
}

function PricingCard({ context }: Props) {
  const plans = contentOf(context).plans.slice(0, 3);
  const featured = featuredPlanIndex(plans);
  return (
    <AppFrame className={styles.pricing} context={context} >
      {plans.map((plan, index) => (
        <article data-featured={index === featured || undefined} key={plan.name}>
          <span className={styles.meta}>{index === featured ? 'Most teams start here' : 'Plan'}</span>
          {index === featured ? <Edit as='h2' className={styles.priceTitle} context={context} field='headline' /> : <h2 className={styles.priceTitle}>{plan.name}</h2>}
          <strong className={styles.price} data-long={plan.price.length > 12 || undefined}>{plan.price}</strong>
          {index === featured && context.settings.body ? <Edit as='p' className={styles.body} context={context} field='body' multiline /> : null}
          <ul>{plan.features.map((feature) => <li key={feature}><Check aria-hidden='true' />{feature}</li>)}</ul>
          {index === featured ? <Button context={context} /> : <span className={styles.ghostButton}>{/contact|custom/i.test(plan.price) ? 'Contact sales' : `Choose ${plan.name}`}</span>}
        </article>
      ))}
    </AppFrame>
  );
}

function TestimonialCard({ context }: Props) {
  const { story, customers } = contentOf(context);
  const others = customers.filter((name) => name !== story?.customer).slice(0, 4);
  return (
    <AppFrame className={styles.testimonial} context={context}>
      <span className={styles.meta}>{story ? 'Customer proof' : 'Proof'}</span>
      <Edit as='h1' className={styles.quote} context={context} field='headline' multiline />
      <span className={styles.person}><span className={styles.avatar}>{(story?.customer ?? context.identity.shortName).slice(0, 2)}</span><Edit as='span' className={styles.quiet} context={context} field='body' /><Logo className={styles.personLogo} context={context} kind='wordmark' /></span>
      {others.length ? <span className={styles.customerRow}><span className={styles.meta}>Also with {context.identity.name}</span>{others.map((name) => <strong key={name}>{name}</strong>)}</span> : null}
    </AppFrame>
  );
}

function FormControls({ context }: Props) {
  const { identity } = context;
  return (
    <AppFrame className={styles.form} context={context}>
      <div className={styles.formHead}><Edit as='h1' className={styles.headlineSmall} context={context} field='headline' /><Edit as='p' className={styles.quiet} context={context} field='body' multiline /></div>
      <label className={styles.field}><span>Workspace name</span><span className={styles.input}>{identity.name}</span></label>
      <label className={styles.field}><span>Website</span><span className={styles.input}>{identity.website}</span><small className={styles.quiet}>Used for previews and email footers.</small></label>
      <label className={styles.field}><span>Region</span><span className={styles.input}>Europe (Frankfurt)<span className={styles.selectChevron}>⌄</span></span></label>
      <label className={styles.field} data-error><span>Billing email</span><span className={styles.input}>finance@</span><small>Enter a complete email address.</small></label>
      <span className={styles.toggleRow}><span className={styles.toggle} data-on />Keep brand assets in sync</span>
      <span className={styles.toggleRow}><span className={styles.checkbox}><Check aria-hidden='true' /></span>Notify the team about exports</span>
      <span className={styles.buttonRow}><Button context={context} /><span className={styles.ghostButton}>Cancel</span></span>
    </AppFrame>
  );
}

function CommandMenu({ context }: Props) {
  const items = contentOf(context).actions.slice(0, 4);
  return (
    <AppFrame className={styles.overlayStage} context={context}>
      <div className={styles.command}>
        <div className={styles.commandInput}><Search aria-hidden='true' /><Edit context={context} field='headline' /><kbd>esc</kbd></div>
        <span className={styles.meta}>Actions</span>
        {items.map((item, index) => <div className={styles.commandItem} data-active={index === 0 || undefined} key={item}><Command aria-hidden='true' />{capitalize(item)}<kbd>↵</kbd></div>)}
        <Edit as='p' className={styles.commandHint} context={context} field='body' />
      </div>
    </AppFrame>
  );
}

function ModalDialog({ context }: Props) {
  return (
    <AppFrame className={styles.overlayStage} context={context}>
      <div className={styles.modal}>
        <Logo context={context} />
        <Edit as='h1' className={styles.headlineSmall} context={context} field='headline' />
        <Edit as='p' className={styles.body} context={context} field='body' multiline />
        <span className={styles.buttonRow}><span className={styles.ghostButton}>Cancel</span><Button context={context} /></span>
      </div>
    </AppFrame>
  );
}

function ToastStack({ context }: Props) {
  const { palette } = context;
  const actions = contentOf(context).actions;
  const states = [[`${capitalize(actions[1] ?? actions[0] ?? 'Saving')}…`, palette.progress], [`${capitalize(actions[2] ?? actions[0] ?? 'Update')} needs review`, palette.highlight]] as const;
  return (
    <AppFrame className={styles.toasts} context={context}>
      <div className={styles.toast} data-primary><span className={styles.toastDot} style={{ background: context.settings.accentColor }} /><span><Edit as='strong' context={context} field='headline' /><Edit as='p' className={styles.quiet} context={context} field='body' multiline /></span></div>
      {states.map(([text, color]) => <div className={styles.toast} key={text}><span className={styles.toastDot} style={{ background: color }} /><span><strong>{text}</strong></span></div>)}
    </AppFrame>
  );
}

function DataTable({ context }: Props) {
  const content = contentOf(context);
  const owners = [content.person.name, 'Platform team', 'Design', 'Support', 'Growth'];
  const statuses = ['Live', 'Live', 'In review', 'Live', 'Draft', 'Live'];
  const updated = ['Today', 'Yesterday', 'Mon', 'Oct 2', 'Sep 28', 'Sep 21'];
  const rows = content.products.slice(0, 6).map((product, index) => [product.name, statuses[index]!, owners[index % owners.length]!, updated[index]!] as const);
  return (
    <AppFrame className={styles.table} context={context}>
      <div className={styles.tableHead}><span><Edit as='h1' className={styles.headlineSmall} context={context} field='headline' /><Edit as='p' className={styles.quiet} context={context} field='body' /></span><Button context={context} /></div>
      <div className={styles.tableGrid}>
        {['Product', 'Status', 'Owner', 'Updated'].map((heading) => <span className={styles.meta} key={heading}>{heading}</span>)}
        {rows.flatMap(([product, status, owner, date]) => [
          <strong key={`${product}-p`}>{product}</strong>,
          <span className={styles.status} data-status={status === 'Live' ? 'Ready' : status} key={`${product}-s`}><i />{status}</span>,
          <span key={`${product}-o`}>{owner}</span>,
          <span className={styles.quiet} key={`${product}-u`}>{date}</span>,
        ])}
      </div>
    </AppFrame>
  );
}

function DashboardWidget({ context }: Props) {
  const points = [32, 40, 36, 52, 48, 61, 58, 72, 69, 84, 80, 96];
  const path = points.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index / (points.length - 1)) * 100} ${100 - value}`).join('');
  return (
    <AppFrame className={styles.widgetStage} context={context}>
      <div className={styles.widget}>
        <span className={styles.meta}>{contentOf(context).metric.label}</span>
        <span className={styles.metric}><Edit as='strong' context={context} field='headline' /></span>
        <Edit as='p' className={styles.quiet} context={context} field='body' />
        <svg aria-hidden='true' className={styles.chart} preserveAspectRatio='none' viewBox='0 0 100 100'><path d={`${path}L100 100L0 100Z`} fill='var(--el-accent)' fillOpacity='0.14' /><path d={path} fill='none' stroke='var(--el-accent)' strokeWidth='2' vectorEffect='non-scaling-stroke' /></svg>
      </div>
    </AppFrame>
  );
}

function EmptyState({ context }: Props) {
  return (
    <AppFrame className={styles.overlayStage} context={context}>
      <div className={styles.empty}>
        <span className={styles.emptyArt}><Device context={context} seed={22} /></span>
        <Edit as='h1' className={styles.headlineSmall} context={context} field='headline' />
        <Edit as='p' className={styles.body} context={context} field='body' multiline />
        <Button context={context} />
      </div>
    </AppFrame>
  );
}

function CheckoutCard({ context }: Props) {
  const plan = contentOf(context).plans[featuredPlanIndex(contentOf(context).plans)];
  return (
    <AppFrame className={styles.overlayStage} context={context}>
      <div className={styles.checkout}>
        <span className={styles.meta}>Order summary</span>
        <Edit as='p' className={styles.body} context={context} field='body' />
        <dl>
          <div><dt>{plan?.name ?? context.identity.name}</dt><dd>{plan?.price ?? ''}</dd></div>
          {plan?.features.slice(1, 3).map((feature) => <div key={feature}><dt className={styles.quiet}>{feature}</dt><dd className={styles.quiet}>Included</dd></div>)}
          <div data-total><dt>Total</dt><dd><Edit context={context} field='headline' /></dd></div>
        </dl>
        <span className={styles.input}><CreditCard aria-hidden='true' />•••• 4242</span>
        <Button className={styles.wide} context={context} />
      </div>
    </AppFrame>
  );
}

function SettingsPanel({ context }: Props) {
  const groups = ['General', 'Brand', 'Members', 'Billing', 'Integrations'];
  return (
    <AppFrame className={styles.settings} context={context}>
      <aside>{groups.map((group, index) => <span data-active={index === 1 || undefined} key={group}>{group}</span>)}</aside>
      <div>
        <Edit as='h1' className={styles.headlineSmall} context={context} field='headline' />
        <Edit as='p' className={styles.quiet} context={context} field='body' multiline />
        <label className={styles.field}><span>Primary colour</span><span className={styles.input}><i className={styles.swatch} style={{ background: context.settings.accentColor }} />{context.settings.accentColor}</span></label>
        <span className={styles.toggleRow}><span className={styles.toggle} data-on />Lock brand colours for all members</span>
        <span className={styles.toggleRow}><span className={styles.toggle} />Allow custom fonts in exports</span>
        <Button context={context} />
      </div>
    </AppFrame>
  );
}

function AuthScreen({ context }: Props) {
  return (
    <AppFrame className={styles.auth} context={context}>
      <div className={styles.authArt}>
        <Device context={context} dark seed={24} />
        <Logo className={styles.authMark} context={context} kind='wordmark' onDark />
        <span className={styles.authCaption}>{context.identity.tagline}</span>
      </div>
      <div className={styles.authForm}>
        <Edit as='h1' className={styles.headlineSmall} context={context} field='headline' />
        <Edit as='p' className={styles.quiet} context={context} field='body' />
        <label className={styles.field}><span>Email</span><span className={styles.input}>{firstName(contentOf(context).person.name).toLocaleLowerCase()}@{context.identity.website || 'example.com'}</span></label>
        <label className={styles.field}><span>Password</span><span className={styles.input}>••••••••••</span></label>
        <Button className={styles.wide} context={context} />
        <span className={styles.divider}>or</span>
        <span className={`${styles.ghostButton} ${styles.wide}`}>Continue with SSO</span>
      </div>
    </AppFrame>
  );
}

function SidebarNavigation({ context }: Props) {
  const icons = [Layers3, Folder, FileText, Settings];
  const content = contentOf(context);
  return (
    <AppFrame className={styles.shell} context={context}>
      <aside>
        <span className={styles.navBrand}><Logo context={context} /><strong>{context.identity.name}</strong></span>
        <Button context={context} />
        {listFromBody(context.settings.body).map((item, index) => {
          const Icon = icons[index % icons.length]!;
          return <span className={styles.sideItem} data-active={index === 0 || undefined} key={item}><Icon aria-hidden='true' />{item}</span>;
        })}
        <span className={styles.sideFoot}><span className={styles.avatar}>{content.person.initials}</span>{content.person.name}</span>
      </aside>
      <div className={styles.shellMain}>
        <Edit as='h1' className={styles.headlineSmall} context={context} field='headline' />
        <div className={styles.shellCards}>{content.products.slice(0, 3).map((product, index) => <article key={product.name}><span className={styles.meta}>0{index + 1}</span><strong>{product.name}</strong><p className={styles.quiet}>{product.summary}</p></article>)}</div>
        <Device className={styles.shellArt} context={context} seed={26} />
      </div>
    </AppFrame>
  );
}

function SearchSurface({ context }: Props) {
  const results = contentOf(context).products.slice(0, 4);
  return (
    <AppFrame className={styles.overlayStage} context={context}>
      <div className={styles.command}>
        <div className={styles.commandInput}><Search aria-hidden='true' /><Edit context={context} field='headline' /><kbd>⌘K</kbd></div>
        <span className={styles.filters}>{['All', 'Products', 'Docs', 'Activity'].map((filter, index) => <span data-active={index === 0 || undefined} key={filter}>{filter}</span>)}</span>
        {results.map((result, index) => <div className={styles.commandItem} data-active={index === 0 || undefined} key={result.name}><FileText aria-hidden='true' /><span>{result.name}<small className={styles.quiet}> · {result.summary || 'Product'}</small></span><kbd>↵</kbd></div>)}
        <Edit as='p' className={styles.commandHint} context={context} field='body' />
      </div>
    </AppFrame>
  );
}

function OnboardingChecklist({ context }: Props) {
  const steps = context.settings.body.split('\n').map((step) => step.trim()).filter(Boolean);
  return (
    <AppFrame className={styles.overlayStage} context={context}>
      <div className={styles.checklist}>
        <Logo context={context} />
        <Edit as='h1' className={styles.headlineSmall} context={context} field='headline' />
        <span className={styles.progress}><i style={{ width: `${Math.round((2 / Math.max(1, steps.length)) * 100)}%` }} /></span>
        <span className={styles.meta}>2 of {steps.length} complete</span>
        <ol>{steps.map((step, index) => <li data-done={index < 2 || undefined} key={step}><span>{index < 2 ? <Check aria-hidden='true' /> : index + 1}</span>{step}</li>)}</ol>
        <Button context={context} />
      </div>
    </AppFrame>
  );
}

function FileUploader({ context }: Props) {
  return (
    <AppFrame className={styles.overlayStage} context={context}>
      <div className={styles.uploader}>
        <div className={styles.dropzone}>
          <span className={styles.featureIcon}><Upload aria-hidden='true' /></span>
          <Edit as='h1' className={styles.headlineSmall} context={context} field='headline' />
          <Edit as='p' className={styles.quiet} context={context} field='body' />
          <Button context={context} />
        </div>
        <div className={styles.uploadRow}><FileText aria-hidden='true' /><span>{context.identity.id}-logo.svg<small className={styles.quiet}> · 24 KB</small></span><span className={styles.progress}><i style={{ width: '72%' }} /></span></div>
      </div>
    </AppFrame>
  );
}

function StatusPage({ context }: Props) {
  const services = listFromBody(context.settings.body);
  return (
    <AppFrame className={styles.statusPage} context={context}>
      <div className={styles.statusTop}><Logo context={context} kind='wordmark' /><span className={styles.quiet}>Subscribe to updates</span></div>
      <div className={styles.statusBanner}><Check aria-hidden='true' /><Edit as='strong' context={context} field='headline' /></div>
      {services.map((service, index) => (
        <div className={styles.statusRow} key={service}>
          <span>{service}</span>
          <span className={styles.uptime}>{Array.from({ length: 45 }, (_, day) => <i data-down={(day + index * 7) % 31 === 0 || undefined} key={day} />)}</span>
          <span className={styles.okText}>Operational</span>
        </div>
      ))}
    </AppFrame>
  );
}

const COMPONENT_RENDERERS: Record<string, (props: Props) => ReactNode> = {
  'auth-screen': AuthScreen,
  'checkout-card': CheckoutCard,
  'command-menu': CommandMenu,
  'dashboard-widget': DashboardWidget,
  'data-table': DataTable,
  'empty-state': EmptyState,
  'feature-grid': FeatureGrid,
  'file-uploader': FileUploader,
  'form-controls': FormControls,
  'hero-section': HeroSection,
  'modal-dialog': ModalDialog,
  'navigation-bar': NavigationBar,
  'onboarding-checklist': OnboardingChecklist,
  'pricing-card': PricingCard,
  'search-surface': SearchSurface,
  'settings-panel': SettingsPanel,
  'sidebar-navigation': SidebarNavigation,
  'status-page': StatusPage,
  'testimonial-card': TestimonialCard,
  'toast-notification': ToastStack,
};

function ComponentPreview({ context }: Props) {
  const Renderer = COMPONENT_RENDERERS[context.element.id] ?? DashboardWidget;
  return <Renderer context={context} />;
}

// ---------------------------------------------------------------------------
// Editorial, event, physical, icon, logo
// ---------------------------------------------------------------------------

function EditorialCover({ context }: Props) {
  const { element, identity } = context;
  if (element.id === 'press-kit') return <PressKit context={context} />;
  if (element.id === 'notebook-cover') return <NotebookCover context={context} />;
  const portrait = ['report-cover', 'whitepaper-cover'].includes(element.id);
  const content = contentOf(context);
  const kicker: Record<string, string> = {
    'blog-cover': `${identity.name} blog`,
    'case-study-cover': content.story ? `Customer story · ${content.story.customer}` : 'Customer story',
    'report-cover': `${identity.name} report`,
    'slide-section': 'Section 02',
    'slide-title': `${identity.name} · ${content.event.name}`,
    'whitepaper-cover': 'Field guide',
  };
  return (
    <div className={styles.editorial} data-layout={context.settings.layout} data-portrait={portrait || undefined}>
      <Pattern context={context} />
      <Device className={styles.editorialArt} context={context} seed={element.id.length} />
      <div className={styles.editorialTop}><Logo context={context} kind='wordmark' /><span className={styles.meta}>{kicker[element.id] ?? identity.name}</span></div>
      <div className={styles.editorialText}>
        <Edit as='h1' className={styles.headline} context={context} field='headline' multiline />
        {context.settings.body ? <Edit as='p' className={styles.lead} context={context} field='body' multiline /> : null}
      </div>
      <div className={styles.footerRow}><Website context={context} /><span className={styles.meta}>{element.id === 'slide-title' ? content.event.date : identity.socialHandle}</span></div>
    </div>
  );
}

function PressKit({ context }: Props) {
  const { identity, palette } = context;
  const content = contentOf(context);
  const facts = [...content.proof.slice(0, 3), ...(content.customers.length ? [`Customers include ${content.customers.slice(0, 4).join(', ')}`] : [])];
  const swatches = [palette.ink, palette.paper, palette.accent, palette.deep];
  return (
    <div className={styles.pressKit}>
      <div className={styles.pressHead}>
        <Logo context={context} kind='wordmark' />
        <span className={styles.meta}>Press and media</span>
      </div>
      <div className={styles.pressMain}>
        <div className={styles.pressIntro}>
          <Edit as='h1' className={styles.headline} context={context} field='headline' multiline />
          <p className={styles.lead}>{identity.positioning}</p>
          <Edit as='p' className={styles.quiet} context={context} field='body' multiline />
        </div>
        <dl className={styles.pressFacts}>
          {facts.map((fact, index) => <div key={fact}><dt className={styles.meta}>{String(index + 1).padStart(2, '0')}</dt><dd>{fact}</dd></div>)}
        </dl>
      </div>
      <div className={styles.pressAssets}>
        <span className={styles.pressTile} data-tone='light'><Logo context={context} kind='wordmark' onDark={false} /><small>Logo · light</small></span>
        <span className={styles.pressTile} data-tone='dark' style={{ background: palette.deep }}><Logo context={context} kind='wordmark' onDark /><small>Logo · dark</small></span>
        <span className={styles.pressTile} data-tone='art'><Device className={styles.fill} context={context} dark seed={17} /><small>Brand field</small></span>
        <span className={styles.pressTile} data-tone='light'>{swatches.map((color) => <i className={styles.pressSwatch} key={color} style={{ background: color }} />)}<small>Colour</small></span>
      </div>
      <div className={styles.footerRow}><span className={styles.meta}>{identity.contactEmail}</span><Website context={context} /></div>
    </div>
  );
}

function NotebookCover({ context }: Props) {
  const { identity } = context;
  return (
    <div className={styles.notebook}>
      <Device className={styles.fill} context={context} dark seed={9} />
      <span className={styles.notebookBand}><Logo context={context} kind='mark' onDark /></span>
      <div className={styles.notebookText}>
        <Edit as='h1' className={styles.notebookTitle} context={context} field='headline' />
        <Edit as='p' className={styles.notebookLine} context={context} field='body' multiline />
      </div>
      <span className={styles.notebookFoot}><span>{identity.website}</span><span>No. 01</span></span>
    </div>
  );
}

function Badge({ context, lanyard }: Props & { lanyard: boolean }) {
  const { settings } = context;
  const { event } = contentOf(context);
  return (
    <div className={styles.badgeStage}>
      {lanyard ? <span className={styles.strap}><span>{Array.from({ length: 6 }, (_, index) => <Logo context={context} key={index} onDark={isDarkColor(settings.accentColor)} />)}</span></span> : null}
      <div className={styles.badgeCard}>
        <span className={styles.badgeBand}><Device context={context} dark seed={21} /><Logo className={styles.badgeMark} context={context} kind='wordmark' onDark /></span>
        <div className={styles.badgeBody}>
          <span className={styles.meta}>{event.name}</span>
          <Edit as='h1' className={styles.badgeName} context={context} field='personName' />
          <Edit as='p' className={styles.quiet} context={context} field='personRole' />
          <span className={styles.badgeFoot}><span className={styles.chip}>Speaker</span><span className={styles.meta}>{event.date} · {event.location}</span><span aria-hidden='true' className={styles.qr}>{Array.from({ length: 49 }, (_, index) => <i data-on={(index * 7 + index % 3) % 5 < 2 || undefined} key={index} />)}</span></span>
        </div>
      </div>
    </div>
  );
}

function Backdrop({ context }: Props) {
  const wall = context.element.id === 'booth-wall';
  const { event } = contentOf(context);
  return (
    <div className={styles.backdrop} data-wall={wall || undefined}>
      <Device className={styles.fill} context={context} seed={31} />
      <div className={styles.backdropText} style={artworkStyle(context.settings)}>
        <Logo context={context} kind='wordmark' />
        <Edit as='h1' className={styles.headline} context={context} field='headline' multiline />
        <Edit as='p' className={styles.backdropLine} context={context} field='body' />
      </div>
      {wall ? <span className={styles.counter}><span className={styles.counterTop}><Logo context={context} kind='wordmark' onDark={isDarkColor(context.palette.ink)} /></span><span className={styles.meta}>{event.name}</span></span> : null}
    </div>
  );
}

function PartnershipLockup({ context }: Props) {
  return (
    <div className={styles.lockup}>
      <Pattern context={context} />
      <span className={styles.lockupMarks} style={artworkStyle(context.settings)}>
        <Logo context={context} kind='wordmark' />
        <span aria-hidden='true' className={styles.lockupX}>×</span>
        <Edit as='strong' className={styles.partner} context={context} field='partnerName' />
      </span>
      <span className={styles.meta}>Partnership lockup · equal height · shared clear space</span>
    </div>
  );
}

function EventPreview({ context }: Props) {
  const { element } = context;
  if (element.id === 'partnership-lockup') return <PartnershipLockup context={context} />;
  if (element.id === 'event-backdrop' || element.id === 'booth-wall') return <Backdrop context={context} />;
  return <Badge context={context} lanyard={element.id === 'lanyard'} />;
}

function BusinessCards({ context }: Props) {
  const { identity, palette } = context;
  return (
    <div className={styles.cardsStage}>
      <div className={styles.bizCard} data-side='front' style={{ background: context.settings.accentColor === context.settings.backgroundColor ? palette.deep : context.settings.accentColor }}>
        <Device className={styles.fill} context={context} dark={isDarkColor(context.settings.accentColor)} seed={5} />
        <span style={artworkStyle(context.settings)}><Logo context={context} kind='wordmark' onDark={isDarkColor(context.settings.accentColor)} /></span>
      </div>
      <div className={styles.bizCard} data-side='back'>
        <Edit as='strong' className={styles.bizName} context={context} field='personName' />
        <Edit as='span' className={styles.quiet} context={context} field='personRole' />
        <span className={styles.bizContact}>{identity.contactEmail}<br />{context.settings.showWebsite ? identity.website : null}</span>
        <Logo className={styles.bizMark} context={context} />
      </div>
    </div>
  );
}

function StickerSheet({ context }: Props) {
  const { identity, settings } = context;
  return (
    <div className={styles.stickers}>
      <span className={styles.sticker} data-shape='circle' style={{ background: settings.accentColor }}><Logo context={context} onDark={isDarkColor(settings.accentColor)} /></span>
      <span className={styles.sticker} data-shape='pill' style={{ background: settings.foregroundColor, color: settings.backgroundColor }}><Edit context={context} field='headline' /></span>
      <span className={styles.sticker} data-shape='square'><Device context={context} dark seed={41} /></span>
      <span className={styles.sticker} data-shape='label' style={{ background: settings.backgroundColor }}><Logo context={context} kind='wordmark' /></span>
      <span className={styles.sticker} data-shape='speech' style={{ background: settings.accentColor, color: onAccent(context) }}><Edit context={context} field='body' multiline /></span>
      <span className={styles.sticker} data-shape='circle' style={{ background: settings.foregroundColor, color: settings.backgroundColor }}>{identity.shortName}</span>
    </div>
  );
}

function PackagingLabel({ context }: Props) {
  const { identity } = context;
  const { person, event } = contentOf(context);
  return (
    <div className={styles.label}>
      <div className={styles.labelTop}><Logo context={context} kind='wordmark' /><span className={styles.meta}>Priority · 1 of 1</span></div>
      <div className={styles.labelAddress}>
        <span className={styles.meta}>Ship to</span>
        <strong>{person.name}</strong>
        <span>{person.role}</span>
        <span>{event.location}</span>
      </div>
      <Device className={styles.labelArt} context={context} seed={43} />
      <Edit as='h1' className={styles.headline} context={context} field='headline' multiline />
      <Edit as='p' className={styles.body} context={context} field='body' multiline />
      <span aria-hidden='true' className={styles.barcode}>{Array.from({ length: 44 }, (_, index) => <i key={index} style={{ width: `${(index * 13) % 4 + 1}px` }} />)}</span>
      <span className={styles.footerRow}><Website context={context} /><span className={styles.meta}>{identity.shortName.toLocaleUpperCase()}-0042</span></span>
    </div>
  );
}

function Letterhead({ context }: Props) {
  const { identity, settings } = context;
  const content = contentOf(context);
  return (
    <div className={styles.letterhead}>
      <div className={styles.letterTop}><Logo context={context} kind='wordmark' /><span className={styles.meta}>{identity.website}<br />{identity.contactEmail}<br />{identity.socialHandle}</span></div>
      <div className={styles.letterMeta}>
        <span className={styles.meta}>14 October {new Date().getFullYear()}</span>
        <span>{content.customers[0] ? `The ${content.customers[0]} team` : 'Dear reader'}</span>
      </div>
      <Edit as='h1' className={styles.headlineSmall} context={context} field='headline' />
      <Edit as='p' className={styles.body} context={context} field='body' multiline />
      <p className={styles.body}>{identity.mission}</p>
      {content.products.length ? <ul className={styles.letterList}>{content.products.slice(0, 3).map((product) => <li key={product.name}><strong>{product.name}.</strong> {product.summary}</li>)}</ul> : null}
      <p className={styles.body}>With thanks,<br /><strong>{settings.personName}</strong><br /><span className={styles.quiet}>{settings.personRole}</span></p>
      <span className={styles.letterFoot}><span>{identity.name}</span><span>{identity.website}</span><span>{identity.contactEmail}</span></span>
    </div>
  );
}

function PhysicalPreview({ context }: Props) {
  const { element } = context;
  if (element.id === 'sticker-sheet') return <StickerSheet context={context} />;
  if (element.id === 'packaging-label') return <PackagingLabel context={context} />;
  if (element.id === 'letterhead') return <Letterhead context={context} />;
  return <BusinessCards context={context} />;
}

function IconPreview({ context }: Props) {
  const { element, settings } = context;
  const sizes = element.id === 'favicon-set' ? [16, 32, 48, 180, 192, 512] : element.id === 'social-avatar' ? [400, 200, 96, 48] : [1024, 512, 180, 120, 87, 60];
  return (
    <div className={styles.icons}>
      {sizes.map((size, index) => {
        const accent = index % 2 === 0;
        const background = accent ? settings.accentColor : settings.backgroundColor;
        return (
          <figure key={size}>
            <span className={styles.iconTile} data-round={element.id === 'social-avatar' || undefined} style={{ background, height: Math.min(240, Math.max(32, size / 2.2)), width: Math.min(240, Math.max(32, size / 2.2)) }}>
              <span style={artworkStyle(settings)}><Logo context={context} onDark={isDarkColor(background)} /></span>
            </span>
            <figcaption className={styles.meta}>{size} px</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function LogoPreview({ context }: Props) {
  const { palette, settings } = context;
  return (
    <div className={styles.logoBoard}>
      <span style={{ background: settings.backgroundColor }}><Device className={styles.fill} context={context} seed={51} /><span style={artworkStyle(settings)}><Logo context={context} kind='wordmark' /></span></span>
      <span style={{ background: settings.accentColor }}><span style={artworkStyle(settings)}><Logo context={context} kind='wordmark' onDark={isDarkColor(settings.accentColor)} /></span></span>
      <span style={{ background: palette.deep }}><Device className={styles.fill} context={context} dark seed={52} /><span style={artworkStyle(settings)}><Logo context={context} kind='wordmark' onDark /></span></span>
    </div>
  );
}

const FAMILY_RENDERERS: Record<BrandElement['preview'], (props: Props) => ReactNode> = {
  component: ComponentPreview,
  developer: DeveloperPreview,
  editorial: EditorialCover,
  email: EmailPreview,
  event: EventPreview,
  icon: IconPreview,
  logo: LogoPreview,
  physical: PhysicalPreview,
  social: SocialPreview,
  web: WebPreview,
};

export type ElementPreviewProps = { context: ElementPreviewContext; sharedAsset?: { path: string } };

function sameSettings(previous: ElementPreviewProps, next: ElementPreviewProps): boolean {
  return previous.context.element === next.context.element
    && previous.context.identity === next.context.identity
    && previous.context.editable === next.context.editable
    && previous.sharedAsset?.path === next.sharedAsset?.path
    && JSON.stringify(previous.context.settings) === JSON.stringify(next.context.settings);
}

/** The selected element at its real pixel size, scaled to fit and editable in place. */
export const ElementPreview = memo(function ElementPreview({ context, sharedAsset }: ElementPreviewProps) {
  const Renderer = FAMILY_RENDERERS[context.element.preview];
  const size = elementArtboardSize(context.element);
  return (
    <ScaledArtboard size={size} style={artboardStyle(context)}>
      <div className={styles.surface} data-element={context.element.id} data-family={context.element.preview}>
        <Renderer context={context} />
        {sharedAsset ? <img alt='' className='brand-element-shared-asset' data-placement={context.settings.assetPlacement} src={sharedAsset.path} style={{ opacity: context.settings.assetOpacity / 100 }} /> : null}
      </div>
    </ScaledArtboard>
  );
}, sameSettings);
