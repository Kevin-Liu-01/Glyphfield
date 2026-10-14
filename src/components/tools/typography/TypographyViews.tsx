'use client';

import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import { Button } from '@/components/ui/Button';
import styles from '@/components/tools/typography/TypographyTool.module.css';
import {
  typeIntoSpecimen,
  useFontAxes,
  useSpecimen,
  useSpecimenStore,
  useTypeState,
} from '@/components/tools/typography/typographyStore';
import {
  brandFontAssets,
  brandTypographyFamily,
  type BrandFontAsset,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { brandFontStyle, brandFontVariationSettings, brandRoleTypeStep, brandTypeScale } from '@/lib/brandTokens';
import { hexToOklch } from '@/lib/color';
import { resolveSemanticColors } from '@/lib/colorSystem';
import { capVisibleFontWeight } from '@/lib/typography';
import { roleTypeStep, TYPE_ROLES, TYPE_SCALE_RATIOS, typeScaleRatioName, usedFontFiles } from '@/lib/typeSystem';

export type TypographyView = 'specimen' | 'scale' | 'pairing' | 'wrap' | 'fonts';
export type WrapMode = 'wrap' | 'balance' | 'pretty';

export const TYPOGRAPHY_VIEWS: readonly { id: TypographyView; label: string }[] = [
  { id: 'specimen', label: 'Specimen' },
  { id: 'scale', label: 'Scale' },
  { id: 'pairing', label: 'Pairing' },
  { id: 'wrap', label: 'Wrap' },
  { id: 'fonts', label: 'Fonts' },
];

type Role = BrandTypography['role'];

/** The working identity: committed fields plus live role and scale edits. */
export function useWorkingTypeIdentity(identity: BrandIdentity): BrandIdentity {
  const typography = useTypeState((state) => state.typography);
  const typeScale = useTypeState((state) => state.typeScale);
  return useMemo(() => {
    const { typeScale: _scale, ...rest } = identity;
    return { ...rest, ...(typeScale ? { typeScale } : {}), typography };
  }, [identity, typeScale, typography]);
}

export function roleTypography(identity: BrandIdentity, role: Role): BrandTypography {
  return identity.typography.find((entry) => entry.role === role) ?? identity.typography[0] ?? { family: 'Inter', role, usage: '' };
}

/** CSS for one role: family, capped weight, leading, tracking and fixed axes. */
export function roleStyle(identity: BrandIdentity, role: Role, sizePx?: number): CSSProperties {
  const typography = roleTypography(identity, role);
  const variation = brandFontVariationSettings(typography);
  const fontStyle = brandFontStyle(typography);
  const font = brandFontAssets(identity).find(({ id }) => id === typography.fontId);
  return {
    fontFamily: brandTypographyFamily(identity, role),
    fontFeatureSettings: '"kern" 1',
    fontKerning: 'normal',
    fontOpticalSizing: variation ? 'none' : 'auto',
    fontStyle: fontStyle ?? font?.style ?? 'normal',
    fontVariationSettings: variation ?? undefined,
    fontWeight: capVisibleFontWeight(typography.weight ?? 400),
    letterSpacing: `${typography.letterSpacing ?? 0}px`,
    lineHeight: typography.lineHeight ?? 1.2,
    ...(sizePx ? { fontSize: `${sizePx}px` } : {}),
  };
}

function ViewHeader({ action, description, title }: { action?: ReactNode; description: ReactNode; title: ReactNode }) {
  return (
    <div className={styles.viewHeader}>
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

// ── Specimen ────────────────────────────────────────────────────────────────

export function SpecimenView({
  identity,
  meter,
  onSelectRole,
  onWeightPick,
  selectedRole,
}: {
  identity: BrandIdentity;
  meter: ReactNode;
  onSelectRole: (role: Role) => void;
  onWeightPick: (weight: number) => void;
  selectedRole: Role;
}) {
  const gt = useGT();
  const working = useWorkingTypeIdentity(identity);
  const store = useSpecimenStore();
  const sampleText = useSpecimen((state) => state.sampleText);
  const align = useSpecimen((state) => state.align);
  const size = useSpecimen((state) => state.previewSizes[selectedRole]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typography = roleTypography(working, selectedRole);
  const family = brandTypographyFamily(working, selectedRole);
  const fonts = brandFontAssets(working).filter((font) => font.family === family && font.style === 'normal');
  const weights = specimenWeights(fonts, typography.weight ?? 400);
  const style = roleStyle(working, selectedRole, size);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    const fit = () => {
      element.style.height = '0px';
      element.style.height = `${element.scrollHeight}px`;
    };
    fit();
    // Re-fit when the brand font finishes loading or the canvas width changes.
    const resize = new ResizeObserver(fit);
    resize.observe(element.parentElement ?? element);
    document.fonts?.addEventListener('loadingdone', fit);
    return () => {
      resize.disconnect();
      document.fonts?.removeEventListener('loadingdone', fit);
    };
  }, [sampleText, size, style.fontFamily, style.letterSpacing, style.lineHeight, style.fontWeight]);

  return (
    <article className={styles.specimen} data-align={align}>
      <textarea
        aria-label={gt('{role} live type specimen', { role: selectedRole })}
        className={styles.liveInput}
        onChange={(event) => typeIntoSpecimen(store, event.target.value)}
        placeholder={gt('Type here to test the family…')}
        ref={textareaRef}
        style={style}
        value={sampleText}
      />
      <p className={styles.specimenHead}>
        <span>{selectedRole} · {family}</span>
        <code>{typography.weight ?? 400} / {typography.lineHeight ?? 1.2} · {size}px</code>
      </p>
      <section aria-label={gt('Typography role specimens')} className={styles.roleLines}>
        {TYPE_ROLES.map((role) => (
          <label data-active={selectedRole === role} key={role}>
            <span><strong>{role}</strong><code>{brandTypographyFamily(working, role)} · {roleTypeStep(working, role).name}</code></span>
            <input
              aria-label={gt('{role} editable specimen', { role })}
              onChange={(event) => typeIntoSpecimen(store, event.target.value)}
              onFocus={() => onSelectRole(role)}
              style={{ ...roleStyle(working, role), lineHeight: 1.2 }}
              value={sampleText}
            />
          </label>
        ))}
      </section>
      <section aria-label={gt('Font weight specimens')} className={styles.weightLines}>
        {weights.map((weight) => (
          <div data-active={capVisibleFontWeight(typography.weight ?? 400) === weight} key={weight}>
            <button onClick={() => onWeightPick(weight)} type='button'>
              <span>{weight}</span>
              <small>{weight < 350 ? 'Light' : weight < 475 ? 'Regular' : 'Medium'}</small>
            </button>
            <input
              aria-label={gt('{weight} weight editable specimen', { weight })}
              onChange={(event) => typeIntoSpecimen(store, event.target.value)}
              onFocus={() => onWeightPick(weight)}
              style={{ ...roleStyle(working, selectedRole), fontWeight: weight, lineHeight: 1.2 }}
              value={sampleText}
            />
          </div>
        ))}
      </section>
      {meter}
    </article>
  );
}

function specimenWeights(fonts: readonly BrandFontAsset[], current: number): number[] {
  const minimum = Math.max(100, fonts.length ? Math.min(...fonts.map((font) => font.weightMin ?? font.weight)) : 100);
  const maximum = Math.min(550, fonts.length ? Math.max(...fonts.map((font) => font.weightMax ?? font.weight)) : 550);
  const step = Math.max(25, Math.round((maximum - minimum) / 3 / 25) * 25);
  return Array.from(new Set([minimum, minimum + step, minimum + step * 2, maximum, capVisibleFontWeight(current), ...fonts.map((font) => capVisibleFontWeight(font.weight))]))
    .filter((weight) => weight >= minimum && weight <= maximum)
    .sort((first, second) => first - second)
    .slice(0, 6);
}

// ── Scale ───────────────────────────────────────────────────────────────────

export function ScaleView({
  identity,
  onAssignStep,
  onRatioPick,
  selectedRole,
}: {
  identity: BrandIdentity;
  onAssignStep: (step: string) => void;
  onRatioPick: (ratio: number) => void;
  selectedRole: Role;
}) {
  const gt = useGT();
  const working = useWorkingTypeIdentity(identity);
  const sample = useSpecimen((state) => state.sampleText) || identity.tagline;
  const steps = brandTypeScale(working);
  const scale = working.typeScale ?? { basePx: 16, ratio: 1.25 };
  const rolesByStep = new Map<string, Role[]>();
  for (const role of TYPE_ROLES) {
    const step = brandRoleTypeStep(working, role);
    rolesByStep.set(step, [...(rolesByStep.get(step) ?? []), role]);
  }
  const fontRoleFor = (step: { step: number }, roles: readonly Role[]): Role => roles[0] ?? (step.step >= 2 ? 'Display' : 'Body');

  return (
    <div className={styles.view}>
      <ViewHeader
        action={(
          <div aria-label={gt('Scale ratio')} className={styles.chips} role='group'>
            {TYPE_SCALE_RATIOS.map((ratio) => (
              <button aria-label={gt('Use {name} ratio', { name: gt(ratio.label) })} aria-pressed={Math.abs(scale.ratio - ratio.value) < 0.0015} key={ratio.value} onClick={() => onRatioPick(ratio.value)} title={gt(ratio.label)} type='button'>{ratio.value}</button>
            ))}
          </div>
        )}
        description={gt('{base}px base × {ratio}{name}. Select a step to set {role} on it.', { base: scale.basePx, name: typeScaleRatioName(scale.ratio) ? ` (${gt(typeScaleRatioName(scale.ratio)!)})` : '', ratio: scale.ratio, role: selectedRole })}
        title={<T>Modular scale</T>}
      />
      <ol className={styles.ladder}>
        {[...steps].reverse().map((step) => {
          const roles = rolesByStep.get(step.name) ?? [];
          const fontRole = fontRoleFor(step, roles);
          return (
            <li data-selected={roles.includes(selectedRole) ? 'true' : undefined} key={step.name}>
              <button aria-label={gt('Set {role} to {step}', { role: selectedRole, step: step.name })} aria-pressed={roles.includes(selectedRole)} onClick={() => onAssignStep(step.name)} type='button'>
                <span className={styles.ladderMeta}>
                  <strong>{step.name}</strong>
                  <code>{step.px}px · {step.rem}rem</code>
                  <span className={styles.ladderRoles}>{roles.map((role) => <em key={role}>{role}</em>)}</span>
                </span>
                <span className={styles.ladderSample} style={{ ...roleStyle(working, fontRole, step.px), lineHeight: 1.1 }}>{sample}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Pairing ─────────────────────────────────────────────────────────────────

export function PairingView({ identity, onUseFont }: { identity: BrandIdentity; onUseFont: (role: Role, font: BrandFontAsset) => void }) {
  const gt = useGT();
  const working = useWorkingTypeIdentity(identity);
  const families = useMemo(() => {
    const seen = new Map<string, BrandFontAsset>();
    for (const font of brandFontAssets(working)) if (font.style === 'normal' && !seen.has(font.family)) seen.set(font.family, font);
    return [...seen.values()];
  }, [working]);
  const displayFamily = brandTypographyFamily(working, 'Display');
  const bodyFamily = brandTypographyFamily(working, 'Body');
  const light = resolveSemanticColors(working, 'light');
  const primary = light.primary.hex;
  const primaryText = hexToOklch(primary).lightness < 0.6 ? '#FFFFFF' : '#111111';
  const display = roleTypography(working, 'Display');
  const body = roleTypography(working, 'Body');
  const code = roleTypography(working, 'Code');
  const codeSample = working.id === 'ramp' ? '$24,680.00  /  Q3 2026  /  APPROVED' : `$ npx ${working.id} build --brand`;

  return (
    <div className={styles.view}>
      <ViewHeader description={<T>The roles together on one surface, then every display face from this brand paired with the body face.</T>} title={<T>Pairing</T>} />
      <article className={styles.system}>
        <section className={styles.systemBand} style={{ backgroundColor: primary, color: primaryText }}>
          <h4 className={styles.systemDisplay} style={{ ...roleStyle(working, 'Display'), lineHeight: Math.min(display.lineHeight ?? 1, 1.04) }}>{working.tagline}</h4>
          <p className={styles.systemAccent} style={roleStyle(working, 'Accent')}>{working.greetings.slice(0, 4).join('  ·  ')}</p>
          <p className={styles.systemMeta}><span>Display · {displayFamily}</span><span>Wt {capVisibleFontWeight(display.weight ?? 400)} · Lh {(display.lineHeight ?? 1).toFixed(2)} · Tr {display.letterSpacing ?? 0}</span></p>
        </section>
        <div className={styles.systemGrid}>
          <section className={styles.systemBody}>
            <p className={styles.systemParagraph} style={roleStyle(working, 'Body')}>{working.positioning}</p>
            <p className={styles.systemAlphabet} style={{ ...roleStyle(working, 'Body'), lineHeight: 1.4 }}><span>Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm</span><span>0123456789</span></p>
            <p className={styles.systemMeta}><span>Body · {bodyFamily}</span><span>Wt {capVisibleFontWeight(body.weight ?? 400)} · Lh {(body.lineHeight ?? 1.5).toFixed(2)}</span></p>
          </section>
          <section className={styles.systemCode}>
            <pre style={roleStyle(working, 'Code')}>{codeSample}</pre>
            <p className={styles.systemMeta}><span>Code · {brandTypographyFamily(working, 'Code')}</span><span>Wt {capVisibleFontWeight(code.weight ?? 400)}</span></p>
          </section>
        </div>
      </article>
      <div className={styles.pairGrid}>
        {families.map((font) => {
          const active = font.family === displayFamily;
          return (
            <article className={styles.pairCard} data-active={active ? 'true' : undefined} key={font.id}>
              <p className={styles.pairHeadline} style={{ ...roleStyle(working, 'Display'), fontFamily: font.family, fontStyle: font.style, lineHeight: 1.05 }}>{working.tagline}</p>
              <p className={styles.pairBody} style={roleStyle(working, 'Body')}>{working.description}</p>
              <footer>
                <span><strong>{font.family}</strong> + {bodyFamily}</span>
                <Button disabled={active} onClick={() => onUseFont('Display', font)} size='sm' type='button' variant='outline'>
                  {active ? <T>Display face</T> : gt('Use {family} for Display', { family: font.family })}
                </Button>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ── Wrap ────────────────────────────────────────────────────────────────────

const WRAP_WIDTHS = [320, 480, 680] as const;

export function WrapView({ identity, mode, onModeChange }: { identity: BrandIdentity; mode: WrapMode; onModeChange: (mode: WrapMode) => void }) {
  const gt = useGT();
  const working = useWorkingTypeIdentity(identity);
  const headlineSize = Math.min(44, roleTypeStep(working, 'Display').px);
  const bodySize = roleTypeStep(working, 'Body').px;
  return (
    <div className={styles.view}>
      <ViewHeader
        action={(
          <div aria-label={gt('Text wrap')} className={styles.chips} role='group'>
            {(['wrap', 'balance', 'pretty'] as const).map((value) => (
              <button aria-label={gt('Use text-wrap {mode}', { mode: value })} aria-pressed={mode === value} key={value} onClick={() => onModeChange(value)} type='button'>{value}</button>
            ))}
          </div>
        )}
        description={<T>The headline and lead at three container widths. Balance evens headline lines; pretty avoids a lonely last word.</T>}
        title={<T>Wrapping</T>}
      />
      <div className={styles.wrapList}>
        {WRAP_WIDTHS.map((width) => (
          <section className={styles.wrapCase} key={width}>
            <div className={styles.wrapFrame} style={{ width: `min(100%, ${width}px)` }}>
              <h4 style={{ ...roleStyle(working, 'Display', headlineSize), textWrap: mode }}>{working.tagline}</h4>
              <p style={{ ...roleStyle(working, 'Body', bodySize), textWrap: mode === 'wrap' ? 'wrap' : 'pretty' }}>{working.positioning}</p>
            </div>
            <p className={styles.wrapMeta}><span>{width}px</span><span>{gt('about {count} characters per line', { count: Math.round(width / (bodySize * 0.5)) })}</span></p>
          </section>
        ))}
      </div>
    </div>
  );
}

// ── Fonts ───────────────────────────────────────────────────────────────────

function axesLabel(axes: ReturnType<typeof useFontAxes>, gt: ReturnType<typeof useGT>): ReactNode {
  if (axes === undefined) return <span className={styles.muted}>{gt('Reading…')}</span>;
  if (axes === null) return <span className={styles.muted}>{gt('Not readable in this browser')}</span>;
  return axes.length ? axes.map((axis) => `${axis.tag} ${axis.min}–${axis.max}`).join(' · ') : gt('Static');
}

function FontRow({ font, roles }: { font: BrandFontAsset; roles: readonly Role[] }) {
  const gt = useGT();
  const axes = useFontAxes(font.path);
  const weight = font.weightMin !== undefined && font.weightMax !== undefined ? `${font.weightMin}–${font.weightMax}` : String(font.weight);
  return (
    <tr>
      <th scope='row'>
        <span className={styles.fontSample} style={{ fontFamily: font.family, fontStyle: font.style, fontWeight: capVisibleFontWeight(font.weight) }}>Ag</span>
        <span className={styles.fontName}><strong>{font.label}</strong><small>{font.fileName} · {font.format}</small></span>
      </th>
      <td>{roles.length ? roles.join(', ') : '—'}</td>
      <td className={styles.num}>{weight}{font.style === 'italic' ? ' italic' : ''}</td>
      <td>{axesLabel(axes, gt)}</td>
      <td>
        {font.license ? <span>{font.license}</span> : <span className={styles.warn}><T>No licence recorded</T></span>}
        {font.sourceUrl ? <a className={styles.source} href={font.sourceUrl} rel='noreferrer' target='_blank'><T>Source</T></a> : null}
      </td>
    </tr>
  );
}

export function FontsView({ identity }: { identity: BrandIdentity }) {
  const working = useWorkingTypeIdentity(identity);
  const files = usedFontFiles(working);
  const other = brandFontAssets(working).filter((font) => !files.some(({ id }) => id === font.id));
  const rolesFor = (font: BrandFontAsset) => TYPE_ROLES.filter((role) => brandTypographyFamily(working, role) === font.family);
  return (
    <div className={styles.view}>
      <ViewHeader description={<T>Every font file in this brand, the roles that use it, its variation axes and its licence.</T>} title={<T>Fonts and licences</T>} />
      <div className={styles.tableWrap}>
        <table className={styles.fontsTable}>
          <caption className='sr-only'><T>Font files</T></caption>
          <thead><tr><th scope='col'><T>File</T></th><th scope='col'><T>Roles</T></th><th scope='col'><T>Weight</T></th><th scope='col'><T>Axes</T></th><th scope='col'><T>Licence</T></th></tr></thead>
          <tbody>
            {[...files, ...other].map((font) => <FontRow font={font} key={font.id} roles={rolesFor(font)} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
