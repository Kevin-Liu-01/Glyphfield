'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { T, useGT } from 'gt-next';
import { Check, Copy, RotateCcw, Warning } from '@/components/ui/SolidIcons';
import { LabInspectorSection, LabPanelHeading } from '@/components/LabWorkspace';
import { Button } from '@/components/ui/Button';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioSelect from '@/components/ui/StudioSelect';
import { ToolShell } from '@/components/tools/ToolShell';
import {
  TEXTAREA_CLASS,
  Field,
  RangeField,
  SegmentedChoice,
  UploadField,
} from '@/components/tools/ToolFields';
import styles from '@/components/tools/typography/TypographyTool.module.css';
import {
  SpecimenStoreContext,
  TypeStoreContext,
  typeIntoSpecimen,
  useFontAxes,
  useSpecimen,
  useSpecimenStore,
  type SpecimenState,
  type TypeWorkingState,
} from '@/components/tools/typography/typographyStore';
import {
  FontsView,
  PairingView,
  roleTypography,
  ScaleView,
  SpecimenView,
  TYPOGRAPHY_VIEWS,
  useWorkingTypeIdentity,
  WrapView,
  type TypographyView,
  type WrapMode,
} from '@/components/tools/typography/TypographyViews';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useLiveStore, usePersistentLiveStore } from '@/hooks/useLiveStore';
import { useMountEffect } from '@/hooks/useMountEffect';
import { readPersistentValue, useStudioDraft } from '@/hooks/usePersistentState';
import {
  brandFontAssets,
  brandTypographyFamily,
  type BrandFontAsset,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { STARTER_KIT_FONTS } from '@/lib/brandStarterKit';
import { BRAND_TYPE_STEPS, brandCssVariables, brandDesignTokens, brandRoleTypeStep, brandTailwindTheme, brandTypeScale } from '@/lib/brandTokens';
import { copyTextToClipboard } from '@/lib/clipboard';
import { blobToDataUrl } from '@/lib/download';
import { fontAxis, loadFontAxes } from '@/lib/fontAxes';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import {
  applyTypographySource,
  clampTypeScale,
  MEASURE_LIMITS,
  recommendedLetterSpacing,
  resolvedTypeScale,
  roleFonts,
  rolesOffTracking,
  TYPE_ROLES,
  TYPE_SCALE_LIMITS,
  TYPE_SCALE_RATIOS,
  typeScaleRatioName,
  typographyGuidance,
  typographySource,
  type TypographySpecimenSettings,
} from '@/lib/typeSystem';
import {
  clampTypographyPreviewSize,
  MAX_VISIBLE_FONT_WEIGHT,
  measureTypingSample,
  TYPOGRAPHY_PREVIEW_DEFAULT_SIZES,
  TYPOGRAPHY_PREVIEW_MAX_SIZES,
} from '@/lib/typography';
import { stringifySource } from '@/lib/sourceCode';

type Role = BrandTypography['role'];

const TYPE_TOKEN_FORMATS = [
  { id: 'css', label: 'CSS variables' },
  { id: 'tailwind', label: 'Tailwind v4' },
  { id: 'dtcg', label: 'Design tokens (DTCG)' },
] as const;

type TypeTokenFormat = (typeof TYPE_TOKEN_FORMATS)[number]['id'];

function isTypeTokenFormat(value: unknown): value is TypeTokenFormat {
  return TYPE_TOKEN_FORMATS.some(({ id }) => id === value);
}

function typeTokens(identity: BrandIdentity, format: TypeTokenFormat): string {
  const options = { include: ['type'] as const };
  if (format === 'tailwind') return brandTailwindTheme(identity, options);
  if (format === 'dtcg') return `${JSON.stringify(brandDesignTokens(identity, options), null, 2)}\n`;
  return brandCssVariables(identity, options);
}

function fontFormatFromFileName(fileName: string): BrandFontAsset['format'] {
  const extension = fileName.split('.').pop()?.toLocaleLowerCase();
  const formats: Partial<Record<string, BrandFontAsset['format']>> = {
    otf: 'opentype',
    ttf: 'truetype',
    woff: 'woff',
    woff2: 'woff2',
  };
  return formats[extension ?? ''] ?? 'woff2';
}

function specimenDefaults(identity: BrandIdentity): SpecimenState {
  return {
    align: 'left',
    charactersEntered: 0,
    inputAt: null,
    measure: 64,
    previewSizes: { ...TYPOGRAPHY_PREVIEW_DEFAULT_SIZES },
    sampleText: identity.tagline,
    startedAt: null,
  };
}

/**
 * Live typing pace readout. It owns the 250ms clock so ticks re-render only this
 * footer, not the whole Typography tool.
 */
function TypingMeter({ onReset }: { onReset: () => void }) {
  const gt = useGT();
  const charactersEntered = useSpecimen((state) => state.charactersEntered);
  const inputAt = useSpecimen((state) => state.inputAt);
  const sampleText = useSpecimen((state) => state.sampleText);
  const startedAt = useSpecimen((state) => state.startedAt);
  const [tickAt, setTickAt] = useState<number | null>(null);

  useEffect(() => {
    if (startedAt === null) return;
    const timer = window.setInterval(() => setTickAt(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  // The latest of the last keystroke and the last tick, as one clock did before.
  const now = inputAt === null ? null : Math.max(inputAt, tickAt ?? inputAt);
  const elapsedMs = startedAt === null || now === null ? 0 : now - startedAt;
  const sample = measureTypingSample(sampleText, 0);
  const pace = measureTypingSample('x'.repeat(charactersEntered), elapsedMs);

  return (
    <footer className={styles.meter}>
      <span><strong>{pace.wordsPerMinute}</strong> wpm</span>
      <span><strong>{sample.words}</strong> words</span>
      <span><strong>{sample.characters}</strong> chars</span>
      <span><strong>{pace.seconds}</strong> sec</span>
      <button aria-label={gt('Clear specimen and restart typing meter')} onClick={onReset} title={gt('Clear and restart')} type='button'><RotateCcw aria-hidden='true' /></button>
    </footer>
  );
}

// ── Library ─────────────────────────────────────────────────────────────────

function RoleLibrary({ identity, onFile, onSelect, selectedRole }: { identity: BrandIdentity; onFile: (file: File) => void; onSelect: (role: Role) => void; selectedRole: Role }) {
  const working = useWorkingTypeIdentity(identity);
  return (
    <>
      <LabPanelHeading description={<T>Select a role to inspect it at production scale.</T>} title={<T>Typography roles</T>} />
      <div className={styles.library}>
        {TYPE_ROLES.map((role) => {
          const typography = roleTypography(working, role);
          const step = brandTypeScale(working).find(({ name }) => name === brandRoleTypeStep(working, role));
          return (
            <button aria-pressed={selectedRole === role} className={styles.libraryRow} key={role} onClick={() => onSelect(role)} type='button'>
              <span className={styles.libraryRole}>{role}</span>
              <strong style={{ fontFamily: brandTypographyFamily(working, role), fontWeight: Math.min(typography.weight ?? 400, MAX_VISIBLE_FONT_WEIGHT) }}>Aa</strong>
              <small>{brandTypographyFamily(working, role)}</small>
              <code>{step ? `${step.name} · ${step.px}px` : ''} · {typography.weight ?? 400}</code>
            </button>
          );
        })}
      </div>
      <div className={styles.libraryUpload}><UploadField accept='.otf,.ttf,.woff,.woff2,font/*' label='Add font file to identity' onFile={onFile} /></div>
    </>
  );
}

// ── Inspector ───────────────────────────────────────────────────────────────

type TypeActions = {
  applyRecommendedTracking: () => void;
  begin: () => void;
  /** Stores a font Glyphfield ships with the identity and sets it for the role. */
  chooseBundledFont: (role: Role, font: BrandFontAsset) => void;
  commit: () => void;
  previewRole: (role: Role, patch: Partial<BrandTypography>) => void;
  commitRole: (role: Role, patch: Partial<BrandTypography>, clear?: readonly (keyof BrandTypography)[]) => void;
  previewScale: (patch: Partial<NonNullable<TypeWorkingState['typeScale']>>) => void;
  commitScale: (patch: Partial<NonNullable<TypeWorkingState['typeScale']>>) => void;
};

function TypefaceSection({ actions, identity, role }: { actions: TypeActions; identity: BrandIdentity; role: Role }) {
  const working = useWorkingTypeIdentity(identity);
  const typography = roleTypography(working, role);
  const fonts = brandFontAssets(working);
  // Upright fonts Glyphfield ships that the identity does not store yet, such as the Katagami family.
  const bundled = STARTER_KIT_FONTS.filter((font) => font.style === 'normal' && !fonts.some((candidate) => candidate.id === font.id));
  const size = useSpecimen((state) => clampTypographyPreviewSize(role, state.previewSizes[role] ?? TYPOGRAPHY_PREVIEW_DEFAULT_SIZES[role]));
  const specimen = useSpecimenStore();
  const chooseFont = (fontId: string) => {
    const font = fonts.find((candidate) => candidate.id === fontId);
    if (font) {
      actions.commitRole(role, { family: font.family, fontId });
      return;
    }
    const shipped = bundled.find((candidate) => candidate.id === fontId);
    if (shipped) actions.chooseBundledFont(role, shipped);
  };
  return (
    <LabInspectorSection meta={role} title={<T>Typeface</T>}>
      <Field label={<T>Font family</T>}>
        <StudioSelect ariaLabel={`${role} font`} onValueChange={chooseFont} options={[...fonts, ...bundled].map((font) => ({ label: font.label, value: font.id }))} value={typography.fontId ?? fonts[0]?.id ?? ''} />
      </Field>
      <RangeField label={<T>Preview size</T>} max={TYPOGRAPHY_PREVIEW_MAX_SIZES[role]} min={10} onChange={(value) => specimen.set((current) => ({ ...current, previewSizes: { ...current.previewSizes, [role]: value } }))} suffix='px' value={size} />
      <RangeField label={<T>Weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(weight) => actions.previewRole(role, { weight })} onChangeEnd={actions.commit} onChangeStart={actions.begin} step={25} value={typography.weight ?? 400} />
      <RangeField label={<T>Line height</T>} max={2} min={0.7} onChange={(lineHeight) => actions.previewRole(role, { lineHeight })} onChangeEnd={actions.commit} onChangeStart={actions.begin} step={0.02} value={typography.lineHeight ?? 1.2} />
      <RangeField label={<T>Tracking</T>} max={12} min={-8} onChange={(letterSpacing) => actions.previewRole(role, { letterSpacing })} onChangeEnd={actions.commit} onChangeStart={actions.begin} step={0.1} suffix='px' value={typography.letterSpacing ?? 0} />
    </LabInspectorSection>
  );
}

/** The role's axes: read from the file, or the recorded weight range when this browser cannot read it. */
function useRoleAxes(identity: BrandIdentity, role: Role) {
  const font = roleFonts(identity).find((entry) => entry.role === role)?.asset;
  const read = useFontAxes(font?.path);
  const recorded = font?.weightMin !== undefined && font.weightMax !== undefined ? [{ default: font.weight, max: font.weightMax, min: font.weightMin, tag: 'wght' }] : [];
  return { axes: read === null ? recorded : read, font, unreadable: read === null };
}

function AxisNotes({ family, hasAxes, unreadable }: { family: string; hasAxes: boolean; unreadable: boolean }) {
  const gt = useGT();
  if (unreadable) return <p className='lab-section-description'><T>This browser cannot read the axes of this file, so only the recorded weight range is shown.</T></p>;
  return hasAxes ? null : <p className='lab-section-description'>{gt('{family} has no optical size or slant axis.', { family })}</p>;
}

function AxesSection({ actions, identity, role }: { actions: TypeActions; identity: BrandIdentity; role: Role }) {
  const gt = useGT();
  const working = useWorkingTypeIdentity(identity);
  const typography = roleTypography(working, role);
  const { axes, font, unreadable } = useRoleAxes(working, role);
  const opsz = fontAxis(axes, 'opsz');
  const slnt = fontAxis(axes, 'slnt');
  const wght = fontAxis(axes, 'wght');
  const automatic = typeof typography.opticalSize !== 'number';
  const maxSlant = slnt ? Math.round(Math.abs(Math.min(slnt.min, -slnt.max))) : 0;
  const meta = axes === undefined ? gt('Reading…') : axes.length ? axes.map(({ tag }) => tag).join(' · ') : gt('Static');
  return (
    <LabInspectorSection meta={meta} title={<T>Variable axes</T>}>
      {wght ? <p className='lab-section-description'>{gt('Weight axis {min}–{max}; Studio previews cap at {cap}.', { cap: MAX_VISIBLE_FONT_WEIGHT, max: wght.max, min: wght.min })}</p> : null}
      {opsz ? (
        <>
          <label className={styles.checkRow}>
            <StudioCheckbox aria-label={gt('Automatic optical size')} checked={automatic} onChange={(event) => actions.commitRole(role, event.target.checked ? {} : { opticalSize: Math.round(opsz.default) }, event.target.checked ? ['opticalSize'] : [])} />
            <span><T>Size optical axis automatically</T></span>
          </label>
          {automatic ? null : <RangeField label={<T>Optical size</T>} max={opsz.max} min={opsz.min} onChange={(opticalSize) => actions.previewRole(role, { opticalSize })} onChangeEnd={actions.commit} onChangeStart={actions.begin} value={typography.opticalSize ?? opsz.default} />}
        </>
      ) : null}
      {slnt && maxSlant > 0 ? (
        <RangeField label={<T>Slant</T>} max={maxSlant} min={0} onChange={(slant) => actions.previewRole(role, { slant })} onChangeEnd={actions.commit} onChangeStart={actions.begin} suffix='°' value={typography.slant ?? 0} />
      ) : null}
      {axes === undefined ? null : <AxisNotes family={font?.family ?? brandTypographyFamily(working, role)} hasAxes={Boolean(opsz || slnt)} unreadable={unreadable} />}
    </LabInspectorSection>
  );
}

function ScaleSection({ actions, identity, role }: { actions: TypeActions; identity: BrandIdentity; role: Role }) {
  const gt = useGT();
  const working = useWorkingTypeIdentity(identity);
  const scale = resolvedTypeScale(working);
  const named = typeScaleRatioName(scale.ratio);
  return (
    <LabInspectorSection meta={`${scale.basePx}px × ${scale.ratio}`} title={<T>Type scale</T>}>
      <RangeField label={<T>Base size</T>} max={TYPE_SCALE_LIMITS.basePx.max} min={TYPE_SCALE_LIMITS.basePx.min} onChange={(basePx) => actions.previewScale({ basePx })} onChangeEnd={actions.commit} onChangeStart={actions.begin} suffix='px' value={scale.basePx} />
      <Field label={<T>Named ratio</T>}>
        <StudioSelect
          ariaLabel={gt('Scale ratio preset')}
          onValueChange={(value) => { if (value !== 'custom') actions.commitScale({ ratio: Number(value) }); }}
          options={[...TYPE_SCALE_RATIOS.map((ratio) => ({ label: `${gt(ratio.label)} · ${ratio.value}`, value: String(ratio.value) })), { disabled: true, label: gt('Custom'), value: 'custom' }]}
          value={named ? String(TYPE_SCALE_RATIOS.find(({ label }) => label === named)!.value) : 'custom'}
        />
      </Field>
      <RangeField label={<T>Ratio</T>} max={TYPE_SCALE_LIMITS.ratio.max} min={TYPE_SCALE_LIMITS.ratio.min} onChange={(ratio) => actions.previewScale({ ratio })} onChangeEnd={actions.commit} onChangeStart={actions.begin} step={0.001} value={scale.ratio} />
      <Field label={gt('{role} step', { role })}>
        <StudioSelect ariaLabel={gt('{role} scale step', { role })} onValueChange={(step) => actions.commitScale({ roleSteps: { ...scale.roleSteps, [role]: step } })} options={BRAND_TYPE_STEPS.map(({ name }) => ({ label: `${name} · ${brandTypeScale(working).find((entry) => entry.name === name)?.px ?? ''}px`, value: name }))} value={brandRoleTypeStep(working, role)} />
      </Field>
    </LabInspectorSection>
  );
}

function SpecimenSection() {
  const gt = useGT();
  const store = useSpecimenStore();
  const sampleText = useSpecimen((state) => state.sampleText);
  const align = useSpecimen((state) => state.align);
  const measure = useSpecimen((state) => state.measure);
  return (
    <LabInspectorSection meta={gt('Live copy')} title={<T>Specimen</T>}>
      <Field label={<T>Sample text</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => typeIntoSpecimen(store, event.target.value)} value={sampleText} /></Field>
      <SegmentedChoice ariaLabel='Specimen alignment' onChange={(value) => store.set((current) => ({ ...current, align: value }))} options={[{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }]} value={align} />
      <RangeField label={<T>Measure</T>} max={MEASURE_LIMITS.max} min={MEASURE_LIMITS.min} onChange={(value) => store.set((current) => ({ ...current, measure: value }))} suffix='ch' value={measure} />
    </LabInspectorSection>
  );
}

function GuidanceSection({ actions, identity, role }: { actions: TypeActions; identity: BrandIdentity; role: Role }) {
  const working = useWorkingTypeIdentity(identity);
  const offTracking = rolesOffTracking(working);
  const measure = useSpecimen((state) => state.measure);
  const guidance = useMemo(() => typographyGuidance(working, { measureCh: measure }), [measure, working]);
  const typography = roleTypography(working, role);
  return (
    <LabInspectorSection meta={guidance.length ? `${guidance.length}` : '✓'} title={<T>Role guidance</T>}>
      <p className='lab-section-description'>{typography.usage}</p>
      {guidance.length ? (
        <ul className={styles.guidance}>
          {guidance.map((entry) => (
            <li data-role-match={entry.role === role ? 'true' : undefined} data-severity={entry.severity} key={entry.id}>
              <Warning aria-hidden='true' />
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      ) : <p className={styles.guidanceOk}><Check aria-hidden='true' /><T>Leading, tracking, measure and scale are within the usual ranges.</T></p>}
      {offTracking.length ? (
        <Button onClick={actions.applyRecommendedTracking} size='sm' title={offTracking.join(', ')} type='button' variant='outline'>
          <T>Apply recommended tracking</T>
        </Button>
      ) : null}
    </LabInspectorSection>
  );
}

function TokensSection({ format, identity, onCopy, onFormatChange }: { format: TypeTokenFormat; identity: BrandIdentity; onCopy: () => void; onFormatChange: (format: TypeTokenFormat) => void }) {
  const gt = useGT();
  // Token text trails a drag instead of blocking it.
  const working = useDeferredValue(useWorkingTypeIdentity(identity));
  const code = useMemo(() => typeTokens(working, format), [format, working]);
  return (
    <LabInspectorSection meta={TYPE_TOKEN_FORMATS.find(({ id }) => id === format)?.label} title={<T>Type tokens</T>}>
      <StudioSelect ariaLabel={gt('Type token format')} onValueChange={(value) => { if (isTypeTokenFormat(value)) onFormatChange(value); }} options={TYPE_TOKEN_FORMATS.map(({ id, label }) => ({ label: gt(label), value: id }))} value={format} />
      <pre aria-label={gt('Type token preview')} className={`${styles.code} studio-scroll-area`} tabIndex={0}>{code}</pre>
      <Button onClick={onCopy} size='sm' type='button' variant='outline'><Copy aria-hidden='true' /><T>Copy type tokens</T></Button>
    </LabInspectorSection>
  );
}

// ── Tool ────────────────────────────────────────────────────────────────────

function TypographyTool({ identity, onIdentityChange, tool }: { identity: BrandIdentity; onIdentityChange: (identity: BrandIdentity) => void; tool: StudioTool }) {
  const gt = useGT();
  const draftKey = (field: string) => `glyphfield-draft-v1:${identity.id}:${tool.id}:${field}`;
  const store = useLiveStore<TypeWorkingState>(() => ({ typeScale: identity.typeScale, typography: identity.typography }));
  const specimen = usePersistentLiveStore<SpecimenState>(draftKey('specimen-v2'), () => specimenDefaults(identity), (stored) => {
    if (stored && typeof stored === 'object') return { ...specimenDefaults(identity), ...(stored as Partial<SpecimenState>), charactersEntered: 0, inputAt: null, startedAt: null };
    // Version 1 kept the sample text and preview sizes as separate drafts.
    const sampleText = readPersistentValue<unknown>(draftKey('sample-text'), null);
    const previewSizes = readPersistentValue<unknown>(draftKey('preview-sizes'), null);
    if (typeof sampleText !== 'string' && !(previewSizes && typeof previewSizes === 'object')) return null;
    const defaults = specimenDefaults(identity);
    return { ...defaults, previewSizes: { ...defaults.previewSizes, ...(previewSizes as Partial<TypographySpecimenSettings['previewSizes']> | null) }, sampleText: typeof sampleText === 'string' ? sampleText : defaults.sampleText };
  });
  const identityRef = useCommittedRef(identity);
  const onIdentityChangeRef = useCommittedRef(onIdentityChange);
  const [selectedRole, setSelectedRole] = useState<Role>('Display');
  const [view, setView] = useStudioDraft<TypographyView>(identity.id, tool.id, 'view', 'specimen');
  const [wrapMode, setWrapMode] = useStudioDraft<WrapMode>(identity.id, tool.id, 'wrap-mode', 'balance');
  const [tokenFormat, setTokenFormat] = useStudioDraft<TypeTokenFormat>(identity.id, tool.id, 'token-format', 'css');
  const [copied, setCopied] = useState(false);
  const gesture = useRef(false);
  const idleTimer = useRef<number | null>(null);

  const commitRef = useCommittedRef(() => commit());
  // Leaving the tool mid-edit keeps the edit.
  useMountEffect(() => () => {
    if (idleTimer.current !== null) commitRef.current();
  });

  // Committed identity changes replace in-flight edits unless a slider is held.
  useEffect(() => {
    if (gesture.current) return;
    const current = store.get();
    if (current.typography === identity.typography && current.typeScale === identity.typeScale) return;
    store.set({ typeScale: identity.typeScale, typography: identity.typography });
  }, [identity, store]);

  function withState(state: TypeWorkingState): BrandIdentity {
    const { typeScale: _scale, ...rest } = identityRef.current;
    return { ...rest, ...(state.typeScale ? { typeScale: state.typeScale } : {}), typography: state.typography };
  }

  function commit() {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    gesture.current = false;
    const state = store.get();
    const current = identityRef.current;
    if (state.typography === current.typography && state.typeScale === current.typeScale) return;
    onIdentityChangeRef.current(withState(state));
  }

  function patchRole(role: Role, patch: Partial<BrandTypography>, clear: readonly (keyof BrandTypography)[] = []) {
    store.set((current) => ({
      ...current,
      typography: current.typography.map((entry) => {
        if (entry.role !== role) return entry;
        const next = { ...entry, ...patch };
        for (const key of clear) delete next[key];
        return next;
      }),
    }));
  }

  function patchScale(patch: Partial<NonNullable<TypeWorkingState['typeScale']>>) {
    store.set((current) => ({ ...current, typeScale: clampTypeScale({ ...resolvedTypeScale(current), ...patch }) }));
  }

  /** Live edits commit on release; a quiet period commits too (Browser API set(), keyboard). */
  function commitWhenIdle() {
    gesture.current = true;
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(commit, 450);
  }

  /** −0.02em on large display roles, 0 on text roles, for every role off the spacing rule. */
  function applyRecommendedTracking() {
    const working = withState(store.get());
    const roles = new Set(rolesOffTracking(working));
    store.set((current) => ({
      ...current,
      typography: current.typography.map((entry) => (roles.has(entry.role) ? { ...entry, letterSpacing: recommendedLetterSpacing(working, entry.role) } : entry)),
    }));
    commit();
  }

  const actions: TypeActions = {
    applyRecommendedTracking,
    begin: () => { gesture.current = true; },
    chooseBundledFont: (role, font) => {
      patchRole(role, { family: font.family, fontId: font.id });
      const next = withState(store.get());
      onIdentityChangeRef.current({ ...next, fonts: [...brandFontAssets(identityRef.current), { ...font }] });
    },
    commit,
    commitRole: (role, patch, clear) => { patchRole(role, patch, clear); commit(); },
    commitScale: (patch) => { patchScale(patch); commit(); },
    previewRole: (role, patch) => { patchRole(role, patch); commitWhenIdle(); },
    previewScale: (patch) => { patchScale(patch); commitWhenIdle(); },
  };

  async function loadFont(file: File) {
    const family = file.name.replace(/\.(otf|ttf|woff2?)$/i, '').replace(/[-_]+/g, ' ');
    const nextFont: BrandFontAsset = {
      family,
      fileName: file.name,
      format: fontFormatFromFileName(file.name),
      id: `font-${crypto.randomUUID()}`,
      label: family,
      path: await blobToDataUrl(file),
      style: file.name.toLocaleLowerCase().includes('italic') ? 'italic' : 'normal',
      weight: file.name.toLocaleLowerCase().includes('bold') ? 700 : 400,
    };
    onIdentityChangeRef.current({ ...identityRef.current, fonts: [...brandFontAssets(identityRef.current), nextFont] });
  }

  function resetTyping() {
    specimen.set((current) => ({ ...current, charactersEntered: 0, inputAt: null, sampleText: '', startedAt: null }));
  }

  function specimenSettings(): TypographySpecimenSettings {
    const { align, measure, previewSizes, sampleText } = specimen.get();
    return { align, measure, previewSizes, sampleText };
  }

  // Source is read on demand so specimen typing never re-renders the tool to refresh it.
  const sourceCode = useMemo(() => ({
    format: 'JSON',
    onApply: applySource,
    get source() {
      return stringifySource(typographySource(identityRef.current, specimenSettings()));
    },
    title: gt('Typography source'),
  // applySource and specimenSettings read refs and stores, so the object stays valid.
  }), [gt, identity]);

  function applySource(source: string) {
    const next = applyTypographySource(identityRef.current, specimenSettings(), source);
    specimen.set((current) => ({ ...current, ...next.specimen }));
    store.set({ typeScale: next.identity.typeScale, typography: next.identity.typography });
    onIdentityChangeRef.current(next.identity);
  }

  async function copyTokens(format: TypeTokenFormat = tokenFormat, throwOnError = false) {
    const value = typeTokens(withState(store.get()), format);
    try {
      await copyTextToClipboard(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      if (throwOnError) throw new Error('Clipboard access was denied.');
    }
    return value;
  }

  function formatInput(input: unknown): TypeTokenFormat {
    const format = input && typeof input === 'object' ? (input as { format?: unknown }).format : undefined;
    if (format === undefined) return 'css';
    if (!isTypeTokenFormat(format)) throw new RangeError(`format must be one of ${TYPE_TOKEN_FORMATS.map(({ id }) => id).join(', ')}.`);
    return format;
  }

  async function readAxes() {
    const working = withState(store.get());
    const fonts = roleFonts(working);
    return Object.fromEntries(await Promise.all(fonts.map(async ({ asset, family, role }) => [role, { axes: asset ? await loadFontAxes(asset.path) : null, family, fontId: asset?.id ?? null }])));
  }

  const handlers: Record<string, (input?: unknown) => unknown> = {
    'typography.axes.read': () => readAxes(),
    'typography.guidance.read': () => typographyGuidance(withState(store.get()), { measureCh: specimen.get().measure }),
    'typography.scale.read': () => {
      const working = withState(store.get());
      const scale = resolvedTypeScale(working);
      return {
        basePx: scale.basePx,
        ratio: scale.ratio,
        ratioName: typeScaleRatioName(scale.ratio),
        roleSteps: Object.fromEntries(TYPE_ROLES.map((role) => [role, brandRoleTypeStep(working, role)])),
        steps: brandTypeScale(working),
      };
    },
    'typography.tokens.copy': (input) => copyTokens(formatInput(input), true),
    'typography.tokens.read': (input) => typeTokens(withState(store.get()), formatInput(input)),
  };

  const library = <RoleLibrary identity={identity} onFile={(file) => void loadFont(file)} onSelect={setSelectedRole} selectedRole={selectedRole} />;
  const inspector = (
    <>
      <LabPanelHeading description={<T>Make live changes to the selected role, the scale and the specimen.</T>} title={`${selectedRole} · ${brandTypographyFamily(identity, selectedRole)}`} />
      <TypefaceSection actions={actions} identity={identity} role={selectedRole} />
      <AxesSection actions={actions} identity={identity} role={selectedRole} />
      <ScaleSection actions={actions} identity={identity} role={selectedRole} />
      <SpecimenSection />
      <GuidanceSection actions={actions} identity={identity} role={selectedRole} />
      <TokensSection format={tokenFormat} identity={identity} onCopy={() => void copyTokens()} onFormatChange={setTokenFormat} />
    </>
  );

  return (
    <TypeStoreContext.Provider value={store}>
      <SpecimenStoreContext.Provider value={specimen}>
        <ToolShell
          actions={(
            <Button onClick={() => void copyTokens()} type='button' variant='outline'>
              {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
              {copied ? <T>Copied</T> : <T>Copy type tokens</T>}
            </Button>
          )}
          automation={{ actions: studioToolActionNames('typography'), invoke: (action, input) => {
            const handler = handlers[action];
            if (!handler) throw new RangeError(`Unknown Typography action: ${action}.`);
            return handler(input);
          } }}
          inspector={inspector}
          library={library}
          sourceCode={sourceCode}
          tool={tool}
        >
          <div className={styles.stage}>
            <div className={styles.toolbar}>
              <div className={styles.toolbarTitle}><strong>{selectedRole} · {brandTypographyFamily(identity, selectedRole)}</strong><span><T>Type system</T></span></div>
              <div aria-label={gt('Typography view')} className={styles.segmented} role='group'>
                {TYPOGRAPHY_VIEWS.map((entry) => (
                  <button aria-label={gt('Show {view} view', { view: gt(entry.label) })} aria-pressed={view === entry.id} key={entry.id} onClick={() => setView(entry.id)} type='button'>{gt(entry.label)}</button>
                ))}
              </div>
            </div>
            <div className={styles.canvas}>
              {view === 'specimen' ? (
                <SpecimenView
                  identity={identity}
                  meter={<TypingMeter onReset={resetTyping} />}
                  onSelectRole={setSelectedRole}
                  onWeightPick={(weight) => actions.commitRole(selectedRole, { weight })}
                  selectedRole={selectedRole}
                />
              ) : null}
              {view === 'scale' ? <ScaleView identity={identity} onAssignStep={(step) => actions.commitScale({ roleSteps: { ...resolvedTypeScale(store.get()).roleSteps, [selectedRole]: step } })} onRatioPick={(ratio) => actions.commitScale({ ratio })} selectedRole={selectedRole} /> : null}
              {view === 'pairing' ? <PairingView identity={identity} onUseFont={(role, font) => actions.commitRole(role, { family: font.family, fontId: font.id })} /> : null}
              {view === 'wrap' ? <WrapView identity={identity} mode={wrapMode} onModeChange={setWrapMode} /> : null}
              {view === 'fonts' ? <FontsView identity={identity} /> : null}
            </div>
          </div>
        </ToolShell>
      </SpecimenStoreContext.Provider>
    </TypeStoreContext.Provider>
  );
}

export default TypographyTool;
