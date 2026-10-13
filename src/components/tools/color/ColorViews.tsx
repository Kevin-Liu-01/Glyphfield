'use client';

import { createContext, memo, useContext, useMemo, type CSSProperties, type MouseEvent } from 'react';
import { T, useGT } from 'gt-next';
import { Check, X } from '@/components/ui/SolidIcons';
import { Button } from '@/components/ui/Button';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import { RangeField } from '@/components/tools/ToolFields';
import { useColorState } from '@/components/tools/color/colorStore';
import styles from '@/components/tools/color/ColorTool.module.css';
import { brandTypographyFamily, type BrandColor, type BrandIdentity } from '@/lib/brandIdentity';
import { brandColorPairings } from '@/lib/brandHealth';
import { colorContrastRatio, formatOklch, mixHexColors, normalizeHexOrFallback, resolveReadableColor } from '@/lib/color';
import {
  apcaContrast,
  COLOR_VISION_MODES,
  colorScale,
  colorScaleSettings,
  confusableColorPairs,
  contrastMatrix,
  findPairing,
  pairingRequiredRatio,
  proportionSummary,
  resolveSemanticColors,
  SEMANTIC_COLOR_ROLES,
  semanticContrastChecks,
  semanticHexes,
  simulateColorVision,
  type ColorMode,
  type ColorVisionMode,
  type SemanticColorRole,
} from '@/lib/colorSystem';
import { colorOpacity, withColorWorkingState, type ColorWorkingState } from '@/lib/colorToolSource';

export type ColorView = 'palette' | 'roles' | 'scales' | 'contrast' | 'vision' | 'proportion';
export type ContrastMetric = 'wcag' | 'apca';
export type ProofSurface = 'paper' | 'ink' | 'grid';

export const COLOR_VIEWS: readonly { id: ColorView; label: string }[] = [
  { id: 'palette', label: 'Palette' },
  { id: 'roles', label: 'Roles' },
  { id: 'scales', label: 'Scales' },
  { id: 'contrast', label: 'Contrast' },
  { id: 'vision', label: 'Vision' },
  { id: 'proportion', label: 'Proportion' },
];

export type ColorActions = {
  balanceProportions: () => void;
  beginEdit: () => void;
  commit: (next?: ColorWorkingState) => void;
  normalizeProportions: () => void;
  openPopover: (event: MouseEvent<HTMLElement>, id: string) => void;
  preview: (next: ColorWorkingState) => void;
  removePairing: (foreground: string, background: string) => void;
  fixPairing: (foreground: string, background: string) => void;
  selectColor: (id: string) => void;
  selectRole: (role: SemanticColorRole | null) => void;
  setPairingUsage: (foreground: string, background: string, usage: string) => void;
  setProportion: (id: string, value: number) => void;
  togglePairing: (foreground: string, background: string) => void;
};

export const ColorActionsContext = createContext<ColorActions | null>(null);

function useColorActions(): ColorActions {
  const actions = useContext(ColorActionsContext);
  if (!actions) throw new Error('Color views need ColorActionsContext.');
  return actions;
}

function readableOn(background: string): string {
  return resolveReadableColor(background, '#FFFFFF', 4.5).ratio >= colorContrastRatio(background, '#111111') ? '#FFFFFF' : '#111111';
}

function useWorkingIdentity(identity: BrandIdentity): BrandIdentity {
  const colors = useColorState((state) => state.colors);
  const colorPairings = useColorState((state) => state.colorPairings);
  const colorSystem = useColorState((state) => state.colorSystem);
  return useMemo(() => withColorWorkingState(identity, { colorPairings, colorSystem, colors, opacity: {} }), [colorPairings, colorSystem, colors, identity]);
}

// ── UI proof ────────────────────────────────────────────────────────────────

/** A small product screen painted with one mode's semantic roles. */
export const ColorUiProof = memo(function ColorUiProof({
  colors,
  identity,
  label,
}: {
  colors: Record<SemanticColorRole, string>;
  identity: BrandIdentity;
  label: string;
}) {
  const display = brandTypographyFamily(identity, 'Display');
  const body = brandTypographyFamily(identity, 'Body');
  const code = brandTypographyFamily(identity, 'Code');
  const product = identity.products[0] ?? identity.shortName;
  const bars = [42, 58, 47, 71, 64, 88, 100];
  const style = {
    '--proof-background': colors.background,
    '--proof-border': colors.border,
    '--proof-caution': colors.caution,
    '--proof-focus': colors.focus,
    '--proof-foreground': colors.foreground,
    '--proof-muted': colors['foreground-muted'],
    '--proof-negative': colors.negative,
    '--proof-positive': colors.positive,
    '--proof-primary': colors.primary,
    '--proof-primary-foreground': colors['primary-foreground'],
    '--proof-surface': colors.surface,
    '--proof-surface-muted': colors['surface-muted'],
    fontFamily: body,
  } as CSSProperties;
  return (
    <figure aria-label={label} className={styles.proof} style={style}>
      <figcaption className={styles.proofCaption} style={{ fontFamily: code }}>{label}</figcaption>
      <p className={styles.proofEyebrow} style={{ fontFamily: code }}>{product}</p>
      <p className={styles.proofTitle} style={{ fontFamily: display }}>{identity.tagline}</p>
      <p className={styles.proofBody}>{identity.positioning}</p>
      <div className={styles.proofActions} aria-hidden='true'>
        <span className={styles.proofPrimary}>Get started</span>
        <span className={styles.proofSecondary}>Contact sales</span>
      </div>
      <div className={styles.proofCard} aria-hidden='true'>
        <div className={styles.proofCardHead}>
          <span>{product}</span>
          <strong style={{ fontFamily: display }}>12,840</strong>
        </div>
        <div className={styles.proofBars}>
          {bars.map((height, index) => <i data-accent={index === bars.length - 1 ? 'true' : undefined} key={height} style={{ height: `${height}%` }} />)}
        </div>
        <div className={styles.proofField}><span>{identity.contactEmail || `team@${identity.id}.com`}</span></div>
        <div className={styles.proofBadges}>
          <span><i style={{ background: colors.positive }} />Live</span>
          <span><i style={{ background: colors.caution }} />Review</span>
          <span><i style={{ background: colors.negative }} />Failed</span>
        </div>
      </div>
    </figure>
  );
});

// ── Palette view (proof card, values, scale, token map) ─────────────────────

export function PaletteView({
  identity,
  onSurfaceChange,
  proofLogo,
  selectedId,
  surface,
  contrastId,
}: {
  contrastId: string;
  identity: BrandIdentity;
  onSurfaceChange: (surface: ProofSurface) => void;
  proofLogo: (background: string) => { kind: 'mark' | 'wordmark'; path: string } | undefined;
  selectedId: string;
  surface: ProofSurface;
}) {
  const gt = useGT();
  const actions = useColorActions();
  const colors = useColorState((state) => state.colors);
  const opacity = useColorState((state) => colorOpacity(state, selectedId));
  const selected = colors.find(({ id }) => id === selectedId) ?? colors[0];
  if (!selected) return null;
  const byId = (id: string, fallback: string) => normalizeHexOrFallback(colors.find((color) => color.id === id)?.hex, fallback);
  const surfaceHex = surface === 'ink' ? byId('ink', '#181818') : surface === 'grid' ? byId('muted', '#F2F2F2') : byId('paper', '#FFFFFF');
  const background = mixHexColors(surfaceHex, normalizeHexOrFallback(selected.hex), opacity / 100);
  const preferred = colors.find(({ id }) => id === contrastId)?.hex ?? '#FFFFFF';
  const resolution = resolveReadableColor(background, normalizeHexOrFallback(preferred));
  const action = resolveReadableColor(resolution.color, normalizeHexOrFallback(selected.hex)).color;
  const apca = apcaContrast(resolution.color, background);
  const logo = proofLogo(background);
  const scale = colorScale(selected.hex, colorScaleSettings({ colorSystem: identity.colorSystem }, selected.id));

  return (
    <div className={styles.view} data-surface={surface}>
      <div className={styles.viewHeader}>
        <div>
          <h3><T>Live token proof</T></h3>
          <p><T>The selected color as a surface, with its pair, logo and action.</T></p>
        </div>
        <div aria-label={gt('Proof surface')} className={styles.segmented} role='group'>
          {(['paper', 'ink', 'grid'] as const).map((value) => (
            <button aria-pressed={surface === value} key={value} onClick={() => onSurfaceChange(value)} type='button'>{value}</button>
          ))}
        </div>
      </div>
      <button
        aria-label={gt('Inspect and edit {name}', { name: selected.name })}
        className={styles.proofCardLarge}
        data-auto-contrast={resolution.fallbackApplied ? 'true' : 'false'}
        onClick={(event) => actions.openPopover(event, selected.id)}
        style={{ backgroundColor: background, color: resolution.color }}
        type='button'
      >
        <span className={styles.proofMeta}><span>{selected.role || gt('Semantic brand color')}{resolution.fallbackApplied ? ` · ${gt('Auto contrast')}` : ''}</span><code>{normalizeHexOrFallback(selected.hex)}</code></span>
        {logo ? <img alt={`${identity.name} ${logo.kind}`} className={styles.proofLogo} data-logo-kind={logo.kind} src={logo.path} /> : <span className={styles.proofWordmark}>{identity.shortName}</span>}
        <span className={styles.proofTagline} style={{ fontFamily: brandTypographyFamily(identity, 'Display') }}>{identity.tagline}</span>
        <span className={styles.proofAction} style={{ backgroundColor: resolution.color, color: action }}><T>Primary action</T></span>
      </button>
      <dl className={styles.values}>
        <div><dt>HEX</dt><dd>{normalizeHexOrFallback(selected.hex)}</dd></div>
        <div><dt>OKLCH</dt><dd>{formatOklch(selected.hex)}</dd></div>
        <div><dt>WCAG</dt><dd>{resolution.ratio.toFixed(2)}:1</dd></div>
        <div><dt>APCA</dt><dd>Lc {Math.round(apca)}</dd></div>
      </dl>
      <div aria-label={gt('Tonal ramp')} className={styles.rampStrip} role='list'>
        {scale.map((swatch) => (
          <span data-anchored={swatch.anchored ? 'true' : undefined} key={swatch.step} role='listitem' style={{ backgroundColor: swatch.hex, color: readableOn(swatch.hex) }} title={`${selected.id}.${swatch.step} · ${swatch.hex}`}>
            {swatch.step}
          </span>
        ))}
      </div>
      <div aria-label={gt('Color token canvas')} className={styles.tokenMap}>
        {colors.map((color) => (
          <button
            aria-label={gt('Inspect and edit {name}', { name: color.name })}
            aria-pressed={color.id === selectedId}
            key={color.id}
            onClick={(event) => actions.openPopover(event, color.id)}
            style={{ backgroundColor: normalizeHexOrFallback(color.hex), color: readableOn(normalizeHexOrFallback(color.hex)) }}
            type='button'
          >
            <span>{color.name}</span>
            <code>{normalizeHexOrFallback(color.hex)}</code>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Roles view ──────────────────────────────────────────────────────────────

export function RolesView({ identity, selectedRole }: { identity: BrandIdentity; selectedRole: SemanticColorRole | null }) {
  const gt = useGT();
  const actions = useColorActions();
  const working = useWorkingIdentity(identity);
  const resolved = useMemo(() => ({ dark: resolveSemanticColors(working, 'dark'), light: resolveSemanticColors(working, 'light') }), [working]);
  const checks = useMemo(() => ({ dark: semanticContrastChecks(resolved.dark), light: semanticContrastChecks(resolved.light) }), [resolved]);
  const failing = (mode: ColorMode, role: SemanticColorRole) => checks[mode].filter((check) => check.foreground === role && !check.passes);

  return (
    <div className={styles.view}>
      <div className={styles.viewHeader}>
        <div>
          <h3><T>Semantic roles</T></h3>
          <p><T>Every product surface reads these roles. Light and dark derive from the palette until you override a role.</T></p>
        </div>
      </div>
      <div className={styles.proofPair}>
        <ColorUiProof colors={semanticHexes(resolved.light)} identity={working} label={gt('Light mode')} />
        <ColorUiProof colors={semanticHexes(resolved.dark)} identity={working} label={gt('Dark mode')} />
      </div>
      <table className={styles.rolesTable}>
        <caption className='sr-only'><T>Semantic color roles in light and dark mode</T></caption>
        <thead>
          <tr><th scope='col'><T>Role</T></th><th scope='col'><T>Light</T></th><th scope='col'><T>Dark</T></th></tr>
        </thead>
        <tbody>
          {SEMANTIC_COLOR_ROLES.map((role) => (
            <tr data-selected={selectedRole === role.id ? 'true' : undefined} key={role.id}>
              <th scope='row'>
                <button aria-label={gt('Edit {role} role', { role: role.label })} aria-pressed={selectedRole === role.id} onClick={() => actions.selectRole(selectedRole === role.id ? null : role.id)} type='button'>
                  <strong>{role.label}</strong>
                  <small>{role.usage}</small>
                </button>
              </th>
              {(['light', 'dark'] as const).map((mode) => {
                const value = resolved[mode][role.id];
                const failures = failing(mode, role.id);
                return (
                  <td key={mode}>
                    <span className={styles.roleCell}>
                      <i style={{ backgroundColor: value.hex }} />
                      <code>{value.ref}</code>
                      {value.overridden ? <em title={gt('Overridden; derived default is {ref}', { ref: value.defaultRef })}>●</em> : null}
                      {failures.length ? (
                        <span className={styles.failBadge} title={failures.map((check) => `${check.foreground} on ${check.background}: ${check.ratio.toFixed(2)}:1 < ${check.minimum}:1`).join('\n')}>
                          {failures[0]!.ratio.toFixed(1)}
                        </span>
                      ) : null}
                    </span>
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

// ── Scales view ─────────────────────────────────────────────────────────────

export function ScalesView({ selectedId }: { selectedId: string }) {
  const gt = useGT();
  const actions = useColorActions();
  const colors = useColorState((state) => state.colors);
  const colorSystem = useColorState((state) => state.colorSystem);
  const scales = useMemo(() => colors.map((color) => ({ color, scale: colorScale(color.hex, colorScaleSettings({ colorSystem }, color.id)) })), [colorSystem, colors]);
  const selected = scales.find(({ color }) => color.id === selectedId) ?? scales[0];
  const maxChroma = Math.max(0.0001, ...(selected?.scale.map(({ chroma }) => chroma) ?? [0]));

  return (
    <div className={styles.view}>
      <div className={styles.viewHeader}>
        <div>
          <h3><T>OKLCH scales</T></h3>
          <p><T>Eleven steps per color with even perceptual lightness. The dot marks the exact brand value.</T></p>
        </div>
      </div>
      <div className={styles.scaleGrid} role='list'>
        <div aria-hidden='true' className={styles.scaleSteps}>
          <span />
          {selected?.scale.map(({ step }) => <span key={step}>{step}</span>)}
        </div>
        {scales.map(({ color, scale }) => (
          <div className={styles.scaleRow} data-selected={color.id === selected?.color.id ? 'true' : undefined} key={color.id} role='listitem'>
            <button aria-label={gt('Select {name} scale', { name: color.name })} aria-pressed={color.id === selected?.color.id} onClick={() => actions.selectColor(color.id)} type='button'>
              <strong>{color.name}</strong>
              <code>{color.id}</code>
            </button>
            {scale.map((swatch) => (
              <span data-anchored={swatch.anchored ? 'true' : undefined} key={swatch.step} style={{ backgroundColor: swatch.hex, color: readableOn(swatch.hex) }} title={`${color.id}.${swatch.step} · ${swatch.hex} · ${formatOklch(swatch.hex)}`} />
            ))}
          </div>
        ))}
      </div>
      {selected ? (
        <section aria-label={gt('{name} scale detail', { name: selected.color.name })} className={styles.scaleDetail}>
          <svg aria-hidden='true' className={styles.scaleChart} preserveAspectRatio='none' viewBox='0 0 1100 160'>
            {selected.scale.map((swatch, index) => (
              <rect fill={swatch.hex} height={(swatch.chroma / maxChroma) * 70} key={swatch.step} rx='3' width='64' x={index * 100 + 18} y={150 - (swatch.chroma / maxChroma) * 70} />
            ))}
            <polyline className={styles.scaleLine} fill='none' points={selected.scale.map((swatch, index) => `${index * 100 + 50},${150 - swatch.lightness * 140}`).join(' ')} />
            {selected.scale.map((swatch, index) => <circle className={styles.scaleDot} cx={index * 100 + 50} cy={150 - swatch.lightness * 140} key={swatch.step} r={swatch.anchored ? 7 : 4} />)}
          </svg>
          <table className={styles.scaleTable}>
            <thead><tr><th scope='col'><T>Step</T></th><th scope='col'>HEX</th><th scope='col'>L</th><th scope='col'>C</th><th scope='col'>H</th><th scope='col'><T>on white</T></th><th scope='col'><T>on black</T></th></tr></thead>
            <tbody>
              {selected.scale.map((swatch) => (
                <tr data-anchored={swatch.anchored ? 'true' : undefined} key={swatch.step}>
                  <th scope='row'><i style={{ backgroundColor: swatch.hex }} />{swatch.step}</th>
                  <td>{swatch.hex}</td>
                  <td>{(swatch.lightness * 100).toFixed(1)}</td>
                  <td>{swatch.chroma.toFixed(3)}</td>
                  <td>{Math.round(swatch.hue)}</td>
                  <td>{colorContrastRatio(swatch.hex, '#FFFFFF').toFixed(2)}</td>
                  <td>{colorContrastRatio(swatch.hex, '#000000').toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}

// ── Contrast view ───────────────────────────────────────────────────────────

const GRADE_LABEL: Record<string, string> = { AA: 'AA', 'AA-large': 'AA18', AAA: 'AAA', fail: '—' };
const APCA_LABEL: Record<string, string> = { body: 'Body', content: 'Text', fail: '—', large: 'Large', spot: 'Spot' };

export function ContrastView({ identity, metric, onMetricChange }: { identity: BrandIdentity; metric: ContrastMetric; onMetricChange: (metric: ContrastMetric) => void }) {
  const gt = useGT();
  const actions = useColorActions();
  const colors = useColorState((state) => state.colors);
  const declared = useColorState((state) => state.colorPairings);
  const matrix = useMemo(() => contrastMatrix(colors), [colors]);
  const pairings = useMemo(() => declared ?? brandColorPairings({ ...identity, colorPairings: undefined, colors }), [colors, declared, identity]);
  const nameOf = (id: string) => colors.find((color) => color.id === id)?.name ?? id;

  return (
    <div className={styles.view}>
      <div className={styles.viewHeader}>
        <div>
          <h3><T>Contrast matrix</T></h3>
          <p><T>Rows are text, columns are backgrounds. Select a readable cell to approve the pair for text.</T></p>
        </div>
        <div aria-label={gt('Contrast metric')} className={styles.segmented} role='group'>
          <button aria-pressed={metric === 'wcag'} onClick={() => onMetricChange('wcag')} type='button'>WCAG 2</button>
          <button aria-pressed={metric === 'apca'} onClick={() => onMetricChange('apca')} type='button'>APCA</button>
        </div>
      </div>
      <div className={styles.matrixScroll}>
        <table className={styles.matrix} style={{ '--matrix-columns': colors.length } as CSSProperties}>
          <caption className='sr-only'><T>Contrast of every text color on every background color</T></caption>
          <thead>
            <tr>
              <th scope='col'><span className='sr-only'><T>Text color</T></span></th>
              {colors.map((color) => (
                <th key={color.id} scope='col'><i style={{ backgroundColor: normalizeHexOrFallback(color.hex) }} /><span>{color.name}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={colors[rowIndex]!.id}>
                <th scope='row'><i style={{ backgroundColor: normalizeHexOrFallback(colors[rowIndex]!.hex) }} /><span>{colors[rowIndex]!.name}</span></th>
                {row.map((cell) => {
                  const same = cell.foreground === cell.background;
                  const approved = Boolean(findPairing(pairings, cell.foreground, cell.background));
                  const readable = cell.ratio >= 3;
                  const value = metric === 'wcag' ? cell.ratio.toFixed(cell.ratio >= 10 ? 1 : 2) : `${Math.round(cell.apca)}`;
                  const grade = metric === 'wcag' ? GRADE_LABEL[cell.wcag] : APCA_LABEL[cell.apcaLevel];
                  return (
                    <td key={cell.background}>
                      {same ? <span aria-hidden='true' className={styles.matrixSame} /> : (
                        <button
                          aria-label={gt('{foreground} on {background}: {ratio} to 1, WCAG {grade}, APCA Lc {apca}{state}', {
                            apca: Math.round(cell.apca),
                            background: nameOf(cell.background),
                            foreground: nameOf(cell.foreground),
                            grade: GRADE_LABEL[cell.wcag]!,
                            ratio: cell.ratio.toFixed(2),
                            state: approved ? gt(', approved') : '',
                          })}
                          aria-pressed={approved}
                          className={styles.matrixCell}
                          data-grade={cell.wcag}
                          disabled={!readable && !approved}
                          onClick={() => actions.togglePairing(cell.foreground, cell.background)}
                          style={{ backgroundColor: cell.backgroundHex, color: cell.foregroundHex }}
                          title={readable ? undefined : gt('Below 3:1; use for decoration only')}
                          type='button'
                        >
                          <span>Aa</span>
                          <small>{value}</small>
                          <em>{grade}</em>
                          {approved ? <Check aria-hidden='true' className={styles.matrixCheck} /> : null}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-label={gt('Approved pairings')} className={styles.pairings}>
        <header>
          <h4><T>Approved pairings</T></h4>
          <span>{declared ? gt('{count} declared', { count: declared.length }) : gt('Defaults until you approve a pair')}</span>
        </header>
        <ul>
          {pairings.map((pairing) => {
            const foreground = colors.find((color) => color.id === pairing.foreground);
            const background = colors.find((color) => color.id === pairing.background);
            if (!foreground || !background) return null;
            const ratio = colorContrastRatio(normalizeHexOrFallback(foreground.hex), normalizeHexOrFallback(background.hex));
            const required = pairingRequiredRatio(pairing);
            const passes = ratio >= required;
            return (
              <li data-passes={passes ? 'true' : 'false'} key={`${pairing.foreground}:${pairing.background}`}>
                <span aria-hidden='true' className={styles.pairSample} style={{ backgroundColor: normalizeHexOrFallback(background.hex), color: normalizeHexOrFallback(foreground.hex) }}>Aa</span>
                <span className={styles.pairText}>
                  <strong>{foreground.name} <T>on</T> {background.name}</strong>
                  <input
                    aria-label={gt('Usage for {foreground} on {background}', { background: background.name, foreground: foreground.name })}
                    defaultValue={pairing.usage}
                    key={pairing.usage}
                    onBlur={(event) => { if (event.currentTarget.value.trim() && event.currentTarget.value !== pairing.usage) actions.setPairingUsage(pairing.foreground, pairing.background, event.currentTarget.value.trim()); }}
                    onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                  />
                </span>
                <span className={styles.pairRatio}>{ratio.toFixed(2)}:1 <small>{pairing.level ?? 'AA'}</small></span>
                {passes ? null : <Button onClick={() => actions.fixPairing(pairing.foreground, pairing.background)} size='sm' type='button' variant='outline'><T>Fix</T></Button>}
                {declared ? (
                  <button aria-label={gt('Remove {foreground} on {background}', { background: background.name, foreground: foreground.name })} className={styles.iconButton} onClick={() => actions.removePairing(pairing.foreground, pairing.background)} type='button'><X aria-hidden='true' /></button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

// ── Vision view ─────────────────────────────────────────────────────────────

export function VisionView({ identity, mode, onModeChange }: { identity: BrandIdentity; mode: ColorVisionMode; onModeChange: (mode: ColorVisionMode) => void }) {
  const gt = useGT();
  const working = useWorkingIdentity(identity);
  const colors = working.colors;
  const resolved = useMemo(() => ({ dark: semanticHexes(resolveSemanticColors(working, 'dark')), light: semanticHexes(resolveSemanticColors(working, 'light')) }), [working]);
  const simulate = (roles: Record<SemanticColorRole, string>) => Object.fromEntries(Object.entries(roles).map(([role, hex]) => [role, simulateColorVision(hex, mode)])) as Record<SemanticColorRole, string>;
  const confusable = useMemo(() => confusableColorPairs(colors, mode), [colors, mode]);
  const nameOf = (id: string) => colors.find((color) => color.id === id)?.name ?? id;

  return (
    <div className={styles.view}>
      <div className={styles.viewHeader}>
        <div>
          <h3><T>Color vision</T></h3>
          <p><T>The palette as people with color vision deficiencies see it (Machado 2009 at full severity).</T></p>
        </div>
      </div>
      <div className={styles.visionGrid} role='radiogroup' aria-label={gt('Vision simulation')}>
        {COLOR_VISION_MODES.map((entry) => (
          <button aria-checked={mode === entry.id} className={styles.visionRow} key={entry.id} onClick={() => onModeChange(entry.id)} role='radio' type='button'>
            <span className={styles.visionLabel}><strong>{gt(entry.label)}</strong>{entry.prevalence ? <small>{gt(entry.prevalence)}</small> : null}</span>
            <span className={styles.visionSwatches} aria-hidden='true'>
              {colors.map((color) => <i key={color.id} style={{ backgroundColor: simulateColorVision(color.hex, entry.id) }} />)}
            </span>
          </button>
        ))}
      </div>
      <div className={styles.proofPair}>
        <ColorUiProof colors={simulate(resolved.light)} identity={working} label={gt('Light mode, {mode}', { mode: gt(COLOR_VISION_MODES.find(({ id }) => id === mode)!.label) })} />
        <ColorUiProof colors={simulate(resolved.dark)} identity={working} label={gt('Dark mode, {mode}', { mode: gt(COLOR_VISION_MODES.find(({ id }) => id === mode)!.label) })} />
      </div>
      <section aria-label={gt('Confusable pairs')} className={styles.pairings}>
        <header>
          <h4><T>Confusable pairs</T></h4>
          <span>{mode === 'normal' ? gt('Choose a simulation') : confusable.length ? gt('{count} pairs nearly merge', { count: confusable.length }) : gt('Every pair stays distinct')}</span>
        </header>
        {confusable.length ? (
          <ul>
            {confusable.map((pair) => {
              const first = colors.find((color) => color.id === pair.first)!;
              const second = colors.find((color) => color.id === pair.second)!;
              return (
                <li data-passes='false' key={`${pair.first}:${pair.second}`}>
                  <span className={styles.confusable} aria-hidden='true'>
                    <i style={{ backgroundColor: simulateColorVision(first.hex, mode) }} />
                    <i style={{ backgroundColor: simulateColorVision(second.hex, mode) }} />
                  </span>
                  <span className={styles.pairText}><strong>{nameOf(pair.first)} / {nameOf(pair.second)}</strong><small>{gt('ΔE {distance} here, {typical} in typical vision. Pair them with a label, icon or lightness change.', { distance: pair.distance.toFixed(3), typical: pair.typicalDistance.toFixed(3) })}</small></span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

// ── Proportion view ─────────────────────────────────────────────────────────

const WAFFLE_CELLS = 100;

function waffle(colors: readonly BrandColor[]): string[] {
  const shares = colors
    .filter((color) => (color.proportion ?? 0) > 0)
    .sort((first, second) => (second.proportion ?? 0) - (first.proportion ?? 0));
  const total = shares.reduce((sum, color) => sum + (color.proportion ?? 0), 0);
  if (total <= 0) return [];
  const cells: string[] = [];
  let carried = 0;
  for (const color of shares) {
    const exact = ((color.proportion ?? 0) / total) * WAFFLE_CELLS + carried;
    const count = Math.round(exact);
    carried = exact - count;
    for (let index = 0; index < count && cells.length < WAFFLE_CELLS; index += 1) cells.push(normalizeHexOrFallback(color.hex));
  }
  while (cells.length < WAFFLE_CELLS && shares[0]) cells.push(normalizeHexOrFallback(shares[0].hex));
  return cells;
}

export function ProportionView({ onRebalanceChange, rebalance }: { onRebalanceChange: (value: boolean) => void; rebalance: boolean }) {
  const gt = useGT();
  const actions = useColorActions();
  const colors = useColorState((state) => state.colors);
  const summary = proportionSummary(colors);
  const cells = waffle(colors);
  const hasShares = colors.some((color) => typeof color.proportion === 'number');

  return (
    <div className={styles.view}>
      <div className={styles.viewHeader}>
        <div>
          <h3><T>Proportion</T></h3>
          <p><T>How much of a layout each color covers. One dominant field, a secondary, and a rare accent.</T></p>
        </div>
      </div>
      <div className={styles.proportionLayout}>
        <div aria-label={gt('Proportion waffle chart')} className={styles.waffle} role='img'>
          {cells.length ? cells.map((hex, index) => <i key={index} style={{ backgroundColor: hex }} />) : <p><T>No proportions yet.</T></p>}
        </div>
        <div className={styles.proportionList}>
          {colors.map((color) => (
            <div className={styles.proportionRow} key={color.id}>
              <i aria-hidden='true' style={{ backgroundColor: normalizeHexOrFallback(color.hex) }} />
              <RangeField
                label={color.name}
                max={100}
                min={0}
                onChange={(value) => actions.setProportion(color.id, value)}
                onChangeEnd={() => actions.commit()}
                onChangeStart={actions.beginEdit}
                suffix='%'
                value={Math.round(color.proportion ?? 0)}
              />
            </div>
          ))}
          <label className={styles.checkRow}>
            <StudioCheckbox aria-label={gt('Keep proportions at 100%')} checked={rebalance} onChange={(event) => onRebalanceChange(event.target.checked)} />
            <span><T>Keep the total at 100%</T></span>
          </label>
        </div>
      </div>
      <footer className={styles.proportionFooter} data-passes={summary.passes ? 'true' : 'false'}>
        <p>
          {hasShares
            ? gt('Total {total}%. {dominant} covers {share}%; the accent covers {accent}%.', { accent: summary.accent, dominant: colors.find(({ id }) => id === summary.dominant?.id)?.name ?? '—', share: summary.dominant?.share ?? 0, total: Math.round(summary.total) })
            : gt('Set proportions so layouts can tell the dominant field from the accent.')}
        </p>
        <div>
          <Button onClick={actions.normalizeProportions} size='sm' type='button' variant='outline'><T>Normalize to 100%</T></Button>
          <Button onClick={actions.balanceProportions} size='sm' type='button' variant='outline'><T>Apply 60 / 30 / 10</T></Button>
        </div>
      </footer>
    </div>
  );
}
