'use client';

import type { CSSProperties } from 'react';
import { T, useGT } from 'gt-next';

import BrandIdentityPreview from '@/components/BrandIdentityPreview';
import { Meter, Panel, TextAreaField, TextField } from '@/components/BrandIdentityFields';
import StarterKitPanel, { LiveDevice } from '@/components/BrandStarterKit';
import ThemeAwareBrandMark from '@/components/ThemeAwareBrandMark';
import { Button } from '@/components/ui/Button';
import { Bot, Code2, Download, RotateCcw, ShieldCheck } from '@/components/ui/SolidIcons';
import {
  brandAssetPath,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import type { BrandHealthReport, BrandHealthSectionId } from '@/lib/brandHealth';
import { displayTrackingEm } from '@/lib/brandOutputKit';
import { colorContrastRatio, hexToOklch } from '@/lib/color';

import styles from './BrandIdentityStudio.module.css';

export type BrandIdentitySectionId =
  | 'overview'
  | 'agent'
  | 'health'
  | 'kit'
  | 'strategy'
  | 'assets'
  | 'colors'
  | 'typography'
  | 'system'
  | 'direction';

/** Where each health section is edited. */
export const HEALTH_SECTION_TARGET: Record<BrandHealthSectionId, BrandIdentitySectionId> = {
  applications: 'direction',
  color: 'colors',
  essentials: 'overview',
  graphic: 'system',
  imagery: 'assets',
  logos: 'assets',
  naming: 'overview',
  products: 'strategy',
  strategy: 'strategy',
  typography: 'typography',
  voice: 'strategy',
};

function colorOf(identity: BrandIdentity, id: string, fallback: string): string {
  return identity.colors.find((color) => color.id === id)?.hex ?? fallback;
}

function readableOn(background: string, preferred: string): string {
  try {
    if (colorContrastRatio(background, preferred) >= 4.5) return preferred;
    return colorContrastRatio(background, '#FFFFFF') >= colorContrastRatio(background, '#111111') ? '#FFFFFF' : '#111111';
  } catch {
    return preferred;
  }
}

function isDark(hex: string): boolean {
  try {
    return hexToOklch(hex).lightness < 0.6;
  } catch {
    return false;
  }
}

/** The asset tagged cover, else the identity field, else another background the brand owns. */
function coverVisual(identity: BrandIdentity) {
  return identity.assets.find(({ tags }) => tags?.includes('cover'))
    ?? identity.assets.find(({ id }) => id === 'identity-field')
    ?? identity.assets.find(({ type }) => type === 'background' || type === 'texture');
}

function CoverVisual({ identity }: { identity: BrandIdentity }) {
  // Editable brands draw their device live, so a palette or device change shows at once,
  // unless the brand has chosen its own cover image.
  const chosenCover = identity.assets.some(({ tags }) => tags?.includes('cover'));
  if (identity.kind !== 'example' && !chosenCover) {
    return (
      <figure aria-hidden='true' className={styles.coverVisual}>
        <LiveDevice height={560} identity={identity} width={520} />
      </figure>
    );
  }
  const visual = coverVisual(identity);
  if (visual) {
    return (
      <figure className={styles.coverVisual}>
        <img alt={visual.alt ?? visual.label} src={visual.path} />
      </figure>
    );
  }
  // A reference brand without a cover file shows its palette in proportion.
  return (
    <figure aria-hidden='true' className={`${styles.coverVisual} ${styles.coverPalette}`}>
      {identity.colors.map((color) => <span key={color.id} style={{ background: color.hex, flexGrow: Math.max(color.proportion ?? 1, 0.5) }} />)}
    </figure>
  );
}

function BrandCover({ identity }: { identity: BrandIdentity }) {
  const gt = useGT();
  // The cover takes the brand's dominant field: dark-first brands get an ink cover.
  const share = (id: string) => identity.colors.find((color) => color.id === id)?.proportion ?? 0;
  const darkFirst = share('ink') > share('paper');
  const paper = colorOf(identity, darkFirst ? 'ink' : 'paper', darkFirst ? '#111111' : '#FFFFFF');
  const ink = readableOn(paper, colorOf(identity, darkFirst ? 'paper' : 'ink', darkFirst ? '#FFFFFF' : '#111111'));
  const accent = colorOf(identity, 'emphasis', ink);
  const display = brandTypographyRole(identity, 'Display');
  const body = brandTypographyRole(identity, 'Body');
  const style = {
    '--cover-accent': accent,
    '--cover-ink': ink,
    '--cover-paper': paper,
    color: ink,
  } as CSSProperties;
  const kind = identity.kind === 'custom' ? gt('Your brand') : identity.kind === 'template' ? gt('Starter template') : gt('Reference brand');
  return (
    <section aria-label={gt('Brand cover')} className={styles.cover} data-identity={identity.id} style={style}>
      <div className={styles.coverMeta}>
        <ThemeAwareBrandMark className={styles.coverMark} identity={identity} surface={isDark(paper) ? 'dark' : 'light'} />
      </div>
      <h1
        className={styles.coverName}
        style={{
          fontFamily: brandTypographyFamily(identity, 'Display'),
          fontWeight: display.weight,
          letterSpacing: `${displayTrackingEm(display.letterSpacing)}em`,
        }}
      >
        {identity.name}
      </h1>
      <div className={styles.coverFoot}>
        <p className={styles.coverTagline} style={{ fontFamily: brandTypographyFamily(identity, 'Display'), fontWeight: display.weight }}>{identity.tagline}</p>
        <p className={styles.coverPositioning} style={{ fontFamily: brandTypographyFamily(identity, 'Body'), fontWeight: body.weight }}>{identity.positioning}</p>
        <p className={styles.coverFootnote}>{[kind, identity.website.replace(/^https?:\/\//, '')].filter(Boolean).join(' · ')}</p>
      </div>
      <CoverVisual identity={identity} />
    </section>
  );
}

function HealthSummary({ onNavigate, report }: { onNavigate: (section: BrandIdentitySectionId) => void; report: BrandHealthReport }) {
  const gt = useGT();
  return (
    <section aria-label={gt('Brand health summary')} className={styles.healthSummary}>
      <div className={styles.score}>
        <strong>{report.score}</strong>
        <span>/100</span>
      </div>
      <p className={styles.scoreCaption}>
        {gt('Brand health')} · {report.grade} · {gt('{errors} errors · {warnings} warnings · {info} suggestions', {
          errors: report.counts.error,
          info: report.counts.info,
          warnings: report.counts.warning,
        })}
      </p>
      <Button onClick={() => onNavigate('health')} size='sm' type='button' variant='outline'>
        <ShieldCheck aria-hidden='true' /><T>Review findings</T>
      </Button>
    </section>
  );
}

function QuickActions({
  edited,
  onExportKit,
  onNavigate,
  onOpenSource,
  onRestore,
}: {
  edited: boolean;
  onExportKit: () => void;
  onNavigate: (section: BrandIdentitySectionId) => void;
  onOpenSource: () => void;
  onRestore: () => void;
}) {
  const gt = useGT();
  return (
    <section aria-label={gt('Quick actions')} className={styles.quickActions}>
      <button className={styles.primaryAction} onClick={() => onNavigate('agent')} type='button'>
        <Bot aria-hidden='true' />
        <span><strong><T>Set up with your agent</T></strong><small><T>Claude Code, Codex or Cursor researches and fills the brand</T></small></span>
      </button>
      <div className={styles.secondaryActions}>
        <Button onClick={onExportKit} size='sm' type='button' variant='outline'><Download aria-hidden='true' /><T>Download brand kit</T></Button>
        <Button onClick={onOpenSource} size='sm' type='button' variant='outline'><Code2 aria-hidden='true' /><T>Edit source</T></Button>
        {edited ? (
          <Button onClick={onRestore} size='sm' title={gt('Replace your edits with the shipped version of this built-in identity')} type='button' variant='ghost'>
            <RotateCcw aria-hidden='true' /><T>Restore the shipped version</T>
          </Button>
        ) : null}
      </div>
      {edited ? <p className={styles.note}><T>You have edited this built-in identity. Your edits stay on this device when Glyphfield updates it.</T></p> : null}
    </section>
  );
}

function DefinedMap({ onNavigate, report }: { onNavigate: (section: BrandIdentitySectionId) => void; report: BrandHealthReport }) {
  const gt = useGT();
  return (
    <section aria-label={gt('What is defined')} className={styles.definedMap}>
      <header className={styles.rowHeader}>
        <h2><T>What is defined</T></h2>
        <span><T>Completeness by section</T></span>
      </header>
      <ol>
        {report.sections.map((section) => (
          <li key={section.id}>
            <span className={styles.definedLabel}>{gt(section.label)}</span>
            <span className={styles.definedSummary}>{section.summary}</span>
            <Meter label={gt('{label} {percent}% complete', { label: section.label, percent: Math.round(section.score * 100) })} tone={section.status} value={section.score} />
            <span className={styles.definedPercent}>{Math.round(section.score * 100)}</span>
            <button aria-label={gt('Edit {label}', { label: section.label })} onClick={() => onNavigate(HEALTH_SECTION_TARGET[section.id])} type='button'><T>Edit</T></button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SystemGlance({ identity }: { identity: BrandIdentity }) {
  const gt = useGT();
  const shares = identity.colors.map((color) => Math.max(0, color.proportion ?? 0));
  const total = shares.reduce((sum, share) => sum + share, 0);
  const display = brandTypographyRole(identity, 'Display');
  const families = [...new Set((['Display', 'Body', 'Accent', 'Code'] as const).map((role) => brandTypographyFamily(identity, role)))];
  return (
    <section aria-label={gt('System at a glance')} className={styles.glance}>
      <figure className={styles.glanceLogos}>
        <div data-surface='light'><ThemeAwareBrandMark identity={identity} surface='light' /></div>
        <div data-surface='dark'><ThemeAwareBrandMark identity={identity} surface='dark' /></div>
        <figcaption><T>Mark on light and dark</T></figcaption>
      </figure>
      <figure className={styles.glancePalette}>
        <div className={styles.paletteBar}>
          {identity.colors.map((color, index) => (
            <span
              key={color.id}
              style={{ background: color.hex, color: readableOn(color.hex, '#111111'), flexGrow: total > 0 ? Math.max(shares[index]!, 0.0001) : 1 }}
              title={`${color.name} ${color.hex}${typeof color.proportion === 'number' ? ` · ${color.proportion}%` : ''}`}
            >
              {total > 0 && shares[index]! >= 8 ? <small>{color.proportion}%</small> : null}
            </span>
          ))}
        </div>
        <figcaption>{total > 0 ? <T>Palette in proportion</T> : <T>Palette · proportions not set</T>}</figcaption>
      </figure>
      <figure className={styles.glanceType}>
        <strong style={{ fontFamily: brandTypographyFamily(identity, 'Display'), fontWeight: display.weight, letterSpacing: `${displayTrackingEm(display.letterSpacing)}em` }}>Aa</strong>
        <figcaption>{families.join(' · ')}</figcaption>
      </figure>
      <figure className={styles.glanceDevice}>
        <LiveDevice height={240} identity={identity} width={640} />
        <figcaption><strong>{identity.graphicSystem.device}</strong>{identity.graphicSystem.rules.slice(0, 2).join(' · ')}</figcaption>
      </figure>
    </section>
  );
}

export default function BrandIdentityFrontPage({
  edited,
  identity,
  onExportKit,
  onNavigate,
  onOpenSource,
  onRestore,
  report,
  update,
}: {
  edited: boolean;
  identity: BrandIdentity;
  onExportKit: () => void;
  onNavigate: (section: BrandIdentitySectionId) => void;
  onOpenSource: () => void;
  onRestore: () => void;
  report: BrandHealthReport;
  update: (patch: Partial<BrandIdentity>) => void;
}) {
  return (
    <div className={styles.frontPage}>
      <BrandCover identity={identity} />
      {identity.kind === 'example' ? null : <StarterKitPanel identity={identity} update={update} />}
      <div className={styles.frontRow}>
        <QuickActions edited={edited} onExportKit={onExportKit} onNavigate={onNavigate} onOpenSource={onOpenSource} onRestore={onRestore} />
        <HealthSummary onNavigate={onNavigate} report={report} />
      </div>
      <DefinedMap onNavigate={onNavigate} report={report} />
      <SystemGlance identity={identity} />
      <Panel description={<T>The durable facts every generated design starts from.</T>} id='brand-identity-essentials' title={<T>Identity essentials</T>}>
        <div className={styles.formGrid}>
          <TextField label={<T>Brand name</T>} onChange={(name) => update({ name })} value={identity.name} />
          <TextField label={<T>Short name</T>} maxLength={8} onChange={(shortName) => update({ shortName: shortName.trim() })} value={identity.shortName} />
          <TextField label={<T>Website</T>} onChange={(website) => update({ website })} value={identity.website} />
          <TextField label={<T>Contact email</T>} onChange={(contactEmail) => update({ contactEmail })} type='email' value={identity.contactEmail} />
          <TextField label={<T>Social handle</T>} onChange={(socialHandle) => update({ socialHandle })} placeholder='@brand' value={identity.socialHandle} />
        </div>
        <div className={styles.formStack}>
          <TextAreaField label={<T>Tagline</T>} onChange={(tagline) => update({ tagline })} value={identity.tagline} />
          <TextAreaField label={<T>Positioning</T>} onChange={(positioning) => update({ positioning })} value={identity.positioning} />
          <TextAreaField label={<T>Mission</T>} onChange={(mission) => update({ mission })} value={identity.mission} />
          <TextAreaField label={<T>Description</T>} onChange={(description) => update({ description })} value={identity.description} />
        </div>
      </Panel>
      <Panel description={<T>The identity applied to its own art-directed composition.</T>} title={<T>Identity preview</T>}>
        <div className={`brand-overview-preview ${styles.previewFrame}`}>
          <BrandIdentityPreview darkMark={brandAssetPath(identity, 'mark-dark')} identity={identity} lightMark={brandAssetPath(identity, 'mark-light')} />
        </div>
      </Panel>
    </div>
  );
}
