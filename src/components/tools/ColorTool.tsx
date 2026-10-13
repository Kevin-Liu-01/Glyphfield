'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { T, useGT } from 'gt-next';
import { Check, Copy, Plus, RotateCcw, Trash2, X } from '@/components/ui/SolidIcons';
import { LabInspectorSection, LabPanelHeading } from '@/components/LabWorkspace';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioSelect from '@/components/ui/StudioSelect';
import { ToolShell } from '@/components/tools/ToolShell';
import { INPUT_CLASS, TEXTAREA_CLASS, Field, RangeField } from '@/components/tools/ToolFields';
import { ColorStoreContext, useColorState } from '@/components/tools/color/colorStore';
import {
  COLOR_VIEWS,
  ColorActionsContext,
  ContrastView,
  PaletteView,
  ProportionView,
  RolesView,
  ScalesView,
  VisionView,
  type ColorActions,
  type ColorView,
  type ContrastMetric,
  type ProofSurface,
} from '@/components/tools/color/ColorViews';
import styles from '@/components/tools/color/ColorTool.module.css';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useLiveStore } from '@/hooks/useLiveStore';
import { readPersistentValue, schedulePersistentWrite, useStudioDraft } from '@/hooks/usePersistentState';
import { useMountEffect } from '@/hooks/useMountEffect';
import { brandAssetPath, type BrandColor, type BrandIdentity } from '@/lib/brandIdentity';
import { adjustForContrast, applyBrandHealthFix, brandColorPairings } from '@/lib/brandHealth';
import { copyTextToClipboard } from '@/lib/clipboard';
import { colorContrastRatio, formatOklch, hexToOklch, normalizeHexOrFallback, oklchToHex } from '@/lib/color';
import {
  apcaContrast,
  COLOR_SCALE_STEPS,
  COLOR_VISION_MODES,
  colorScale,
  colorScaleSettings,
  confusableColorPairs,
  contrastMatrix,
  CORE_COLOR_IDS,
  findPairing,
  nextColorId,
  normalizeProportions,
  parseColorRef,
  removePaletteColor,
  resolveColorScaleSettings,
  resolveSemanticColors,
  SEMANTIC_COLOR_ROLES,
  semanticContrastChecks,
  setColorProportion,
  setColorScaleSettings,
  setSemanticOverride,
  simulateColorVision,
  toggleColorPairing,
  wcagLevel,
  type ColorMode,
  type ColorVisionMode,
  type SemanticColorRole,
} from '@/lib/colorSystem';
import {
  COLOR_TOKEN_FORMATS,
  colorOpacity,
  colorTokens,
  colorToolSource,
  colorWorkingState,
  isColorTokenFormat,
  migrateLegacyColorDraft,
  parseColorToolSource,
  withColorWorkingState,
  type ColorTokenFormat,
  type ColorWorkingState,
} from '@/lib/colorToolSource';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { stringifySource } from '@/lib/sourceCode';

const UNDO_LIMIT = 40;
const IDLE_COMMIT_DELAY_MS = 450;

function sameState(first: ColorWorkingState, second: ColorWorkingState): boolean {
  return first.colors === second.colors && first.colorPairings === second.colorPairings && first.colorSystem === second.colorSystem && first.opacity === second.opacity;
}

function patchColor(state: ColorWorkingState, id: string, patch: Partial<BrandColor>): ColorWorkingState {
  return { ...state, colors: state.colors.map((color) => (color.id === id ? { ...color, ...patch } : color)) };
}

/** The proof card's logo: the light or dark wordmark/mark that suits the background. */
function proofLogoFor(identity: BrandIdentity) {
  const dark = [{ kind: 'wordmark' as const, path: brandAssetPath(identity, 'wordmark') }, { kind: 'mark' as const, path: brandAssetPath(identity, 'mark-dark') }];
  const light = [{ kind: 'wordmark' as const, path: brandAssetPath(identity, 'wordmark-light') }, { kind: 'mark' as const, path: brandAssetPath(identity, 'mark-light') }];
  return (background: string) => {
    const useLight = colorContrastRatio(background, '#FFFFFF') >= colorContrastRatio(background, '#000000');
    const found = (useLight ? [...light, ...dark] : [...dark, ...light]).find(({ path }) => Boolean(path));
    return found?.path ? { kind: found.kind, path: found.path } : undefined;
  };
}

// ── Library ─────────────────────────────────────────────────────────────────

function PaletteRow({ id, selected, onSelect }: { id: string; onSelect: (id: string) => void; selected: boolean }) {
  const color = useColorState((state) => state.colors.find((entry) => entry.id === id));
  if (!color) return null;
  const hex = normalizeHexOrFallback(color.hex);
  return (
    <button aria-pressed={selected} className={styles.libraryRow} onClick={() => onSelect(id)} type='button'>
      <span aria-hidden='true' className={styles.librarySwatch} style={{ backgroundColor: hex }} />
      <span className={styles.libraryText}>
        <strong>{color.name}</strong>
        <small>{color.role || formatOklch(hex)}</small>
      </span>
      <span className={styles.libraryMeta}>
        <code>{hex}</code>
        {typeof color.proportion === 'number' ? <small>{Math.round(color.proportion)}%</small> : null}
      </span>
    </button>
  );
}

function PaletteLibrary({ onAdd, onSelect, selectedId }: { onAdd: () => void; onSelect: (id: string) => void; selectedId: string }) {
  const gt = useGT();
  const ids = useColorState((state) => state.colors.map(({ id }) => id).join('\u0000'));
  const shares = useColorState((state) => state.colors.map((color) => `${normalizeHexOrFallback(color.hex)}:${color.proportion ?? 0}`).join('|'));
  return (
    <>
      <LabPanelHeading
        action={<Button aria-label={gt('Add color')} onClick={onAdd} size='icon-sm' title={gt('Add color')} type='button' variant='outline'><Plus aria-hidden='true' /></Button>}
        description={<T>Select a token to edit it and test it in context.</T>}
        title={<T>Brand colors</T>}
      />
      <div aria-hidden='true' className={styles.libraryShares}>
        {shares.split('|').map((entry, index) => {
          const [hex, share] = entry.split(':');
          return Number(share) > 0 ? <i key={`${hex}-${index}`} style={{ backgroundColor: hex, flexGrow: Number(share) }} /> : null;
        })}
      </div>
      <div className={styles.library}>
        {ids.split('\u0000').filter(Boolean).map((id) => <PaletteRow id={id} key={id} onSelect={onSelect} selected={id === selectedId} />)}
      </div>
    </>
  );
}

// ── Inspector ───────────────────────────────────────────────────────────────

function ColorSection({ actions, id }: { actions: ColorInspectorActions; id: string }) {
  const gt = useGT();
  const color = useColorState((state) => state.colors.find((entry) => entry.id === id));
  const opacity = useColorState((state) => colorOpacity(state, id));
  if (!color) return null;
  const hex = normalizeHexOrFallback(color.hex);
  const oklch = hexToOklch(hex);
  const setChannel = (patch: Partial<ReturnType<typeof hexToOklch>>) => actions.previewColor(id, { hex: oklchToHex({ ...hexToOklch(actions.currentHex(id)), ...patch }) });
  return (
    <LabInspectorSection meta='OKLCH' title={<T>Color</T>}>
      <ColorControl
        ariaLabel={gt('Change {name}', { name: color.name })}
        label={<T>Exact color</T>}
        onChange={(value) => actions.commitColor(id, { hex: value })}
        onOpacityChange={(value) => actions.commitOpacity(id, value)}
        onOpacityPreview={(value) => actions.previewOpacity(id, value)}
        onPreview={(value) => actions.previewColor(id, { hex: value })}
        opacity={opacity}
        value={hex}
      />
      <RangeField label={<T>Lightness</T>} max={100} min={0} onChange={(value) => setChannel({ lightness: value / 100 })} onChangeEnd={actions.finish} onChangeStart={actions.begin} suffix='%' value={Math.round(oklch.lightness * 100)} />
      <RangeField label={<T>Chroma</T>} max={0.4} min={0} onChange={(value) => setChannel({ chroma: value })} onChangeEnd={actions.finish} onChangeStart={actions.begin} step={0.005} value={Number(oklch.chroma.toFixed(3))} />
      <RangeField label={<T>Hue</T>} max={360} min={0} onChange={(value) => setChannel({ hue: value })} onChangeEnd={actions.finish} onChangeStart={actions.begin} suffix='°' value={Math.round(oklch.hue)} />
    </LabInspectorSection>
  );
}

function TokenSection({ actions, id }: { actions: ColorInspectorActions; id: string }) {
  const gt = useGT();
  const color = useColorState((state) => state.colors.find((entry) => entry.id === id));
  const total = useColorState((state) => state.colors.length);
  if (!color) return null;
  const core = (CORE_COLOR_IDS as readonly string[]).includes(id);
  return (
    <LabInspectorSection meta={id} title={<T>Token</T>}>
      <Field label={<T>Name</T>}><input className={INPUT_CLASS} onBlur={actions.flushText} onChange={(event) => actions.editText(id, { name: event.target.value })} onFocus={actions.begin} value={color.name} /></Field>
      <Field label={<T>Role</T>}><textarea className={TEXTAREA_CLASS} onBlur={actions.flushText} onChange={(event) => actions.editText(id, { role: event.target.value })} onFocus={actions.begin} value={color.role} /></Field>
      <Button
        disabled={core || total <= 1}
        onClick={() => actions.remove(id)}
        size='sm'
        title={core ? gt('Glyphfield tools read {id}; edit it instead of removing it.', { id }) : undefined}
        type='button'
        variant='outline'
      >
        <Trash2 aria-hidden='true' />
        <T>Remove color</T>
      </Button>
    </LabInspectorSection>
  );
}

function ProportionSection({ actions, id, rebalance }: { actions: ColorInspectorActions; id: string; rebalance: boolean }) {
  const proportion = useColorState((state) => state.colors.find((entry) => entry.id === id)?.proportion);
  const total = useColorState((state) => Math.round(state.colors.reduce((sum, color) => sum + (color.proportion ?? 0), 0)));
  return (
    <LabInspectorSection meta={`${total}%`} title={<T>Share of layout</T>}>
      <RangeField label={<T>Proportion</T>} max={100} min={0} onChange={(value) => actions.setProportion(id, value, rebalance)} onChangeEnd={actions.finish} onChangeStart={actions.begin} suffix='%' value={Math.round(proportion ?? 0)} />
    </LabInspectorSection>
  );
}

function ScaleSection({ actions, id }: { actions: ColorInspectorActions; id: string }) {
  const gt = useGT();
  const settings = useColorState((state) => colorScaleSettings({ colorSystem: state.colorSystem }, id));
  const resolved = resolveColorScaleSettings(settings);
  return (
    <LabInspectorSection meta='50–950' title={<T>Tint and shade scale</T>}>
      <RangeField label={<T>Lightest step</T>} max={100} min={50} onChange={(value) => actions.setScale(id, { lightest: value / 100 })} onChangeEnd={actions.finish} onChangeStart={actions.begin} step={0.5} suffix='%' value={Math.round(resolved.lightest * 1000) / 10} />
      <RangeField label={<T>Darkest step</T>} max={50} min={0} onChange={(value) => actions.setScale(id, { darkest: value / 100 })} onChangeEnd={actions.finish} onChangeStart={actions.begin} step={0.5} suffix='%' value={Math.round(resolved.darkest * 1000) / 10} />
      <RangeField label={<T>Scale chroma</T>} max={200} min={0} onChange={(value) => actions.setScale(id, { chroma: value })} onChangeEnd={actions.finish} onChangeStart={actions.begin} step={5} suffix='%' value={resolved.chroma} />
      <RangeField label={<T>Hue shift</T>} max={90} min={-90} onChange={(value) => actions.setScale(id, { hueShift: value })} onChangeEnd={actions.finish} onChangeStart={actions.begin} suffix='°' value={resolved.hueShift} />
      <label className={styles.checkRow}>
        <StudioCheckbox aria-label={gt('Anchor the brand value')} checked={resolved.anchor} onChange={(event) => actions.commitScale(id, { anchor: event.target.checked })} />
        <span><T>Keep the exact brand value as a step</T></span>
      </label>
      <Button disabled={!settings} onClick={() => actions.commitScale(id, null)} size='sm' type='button' variant='outline'><RotateCcw aria-hidden='true' /><T>Reset scale</T></Button>
    </LabInspectorSection>
  );
}

function ContrastSection({ contrastId, id, onContrastChange }: { contrastId: string; id: string; onContrastChange: (id: string) => void }) {
  const gt = useGT();
  const colors = useColorState((state) => state.colors);
  const color = colors.find((entry) => entry.id === id);
  const pair = colors.find((entry) => entry.id === contrastId) ?? colors[0];
  if (!color || !pair) return null;
  const ratio = colorContrastRatio(normalizeHexOrFallback(pair.hex), normalizeHexOrFallback(color.hex));
  const apca = apcaContrast(normalizeHexOrFallback(pair.hex), normalizeHexOrFallback(color.hex));
  return (
    <LabInspectorSection meta={`${ratio.toFixed(2)}:1`} title={<T>Contrast check</T>}>
      <StudioSelect ariaLabel={gt('Contrast color')} onValueChange={onContrastChange} options={colors.map((entry) => ({ label: entry.name, value: entry.id }))} value={pair.id} />
      <p className='lab-section-description'>
        {ratio >= 4.5 ? <T>Passes WCAG AA for normal text.</T> : ratio >= 3 ? <T>Passes for large text only.</T> : <T>Use this pairing for decoration, not text.</T>}
        {' '}
        {gt('APCA Lc {value}.', { value: Math.round(apca) })}
      </p>
    </LabInspectorSection>
  );
}

const STEP_OPTIONS = [{ label: 'Brand value', value: 'base' }, ...COLOR_SCALE_STEPS.map((step) => ({ label: String(step), value: String(step) }))];

function RoleSection({ actions, identity, role }: { actions: ColorInspectorActions; identity: BrandIdentity; role: SemanticColorRole }) {
  const gt = useGT();
  const colors = useColorState((state) => state.colors);
  const colorSystem = useColorState((state) => state.colorSystem);
  const working = useMemo(() => ({ ...identity, colorSystem, colors }), [colorSystem, colors, identity]);
  const meta = SEMANTIC_COLOR_ROLES.find(({ id }) => id === role)!;
  return (
    <LabInspectorSection meta={meta.label} title={<T>Semantic role</T>}>
      <p className='lab-section-description'>{meta.usage}</p>
      {(['light', 'dark'] as const).map((mode) => {
        const resolved = resolveSemanticColors(working, mode)[role];
        const parsed = parseColorRef(resolved.ref);
        const modeLabel = mode === 'light' ? gt('Light') : gt('Dark');
        return (
          <div className={styles.roleEditor} key={mode}>
            <span className={styles.roleEditorHead}><i style={{ backgroundColor: resolved.hex }} /><strong>{modeLabel}</strong><code>{resolved.ref}</code></span>
            <div className={styles.roleEditorControls}>
              <StudioSelect
                ariaLabel={gt('{mode} {role} color', { mode: modeLabel, role: meta.label })}
                onValueChange={(value) => actions.setRole(mode, role, parsed?.step ? `${value}.${parsed.step}` : value)}
                options={colors.map((color) => ({ label: color.name, value: color.id }))}
                value={parsed?.id ?? ''}
              />
              <StudioSelect
                ariaLabel={gt('{mode} {role} step', { mode: modeLabel, role: meta.label })}
                onValueChange={(value) => actions.setRole(mode, role, value === 'base' ? parsed?.id ?? '' : `${parsed?.id}.${value}`)}
                options={STEP_OPTIONS.map((option) => ({ ...option, label: option.value === 'base' ? gt('Brand value') : option.label }))}
                value={parsed?.step ? String(parsed.step) : 'base'}
              />
            </div>
          </div>
        );
      })}
      <Button onClick={() => { actions.setRole('light', role, null); actions.setRole('dark', role, null); }} size='sm' type='button' variant='outline'>
        <RotateCcw aria-hidden='true' />
        {gt('Derive {role} from the palette', { role: meta.label })}
      </Button>
    </LabInspectorSection>
  );
}

function TokensSection({ format, identity, onCopy, onFormatChange }: { format: ColorTokenFormat; identity: BrandIdentity; onCopy: () => void; onFormatChange: (format: ColorTokenFormat) => void }) {
  const gt = useGT();
  const state = useColorState((value) => value);
  const code = useMemo(() => colorTokens(identity, state, format), [format, identity, state]);
  return (
    <LabInspectorSection meta={COLOR_TOKEN_FORMATS.find(({ id }) => id === format)?.label} title={<T>Export tokens</T>}>
      <StudioSelect ariaLabel={gt('Token format')} onValueChange={(value) => { if (isColorTokenFormat(value)) onFormatChange(value); }} options={COLOR_TOKEN_FORMATS.map(({ id, label }) => ({ label: gt(label), value: id }))} value={format} />
      <pre aria-label={gt('Token preview')} className={`${styles.code} studio-scroll-area`} tabIndex={0}>{code}</pre>
      <Button onClick={onCopy} size='sm' type='button' variant='outline'><Copy aria-hidden='true' /><T>Copy these tokens</T></Button>
    </LabInspectorSection>
  );
}

type ColorInspectorActions = {
  begin: () => void;
  commitColor: (id: string, patch: Partial<BrandColor>) => void;
  commitOpacity: (id: string, value: number) => void;
  commitScale: (id: string, patch: Parameters<typeof setColorScaleSettings>[2]) => void;
  currentHex: (id: string) => string;
  editText: (id: string, patch: Partial<BrandColor>) => void;
  finish: () => void;
  flushText: () => void;
  previewColor: (id: string, patch: Partial<BrandColor>) => void;
  previewOpacity: (id: string, value: number) => void;
  remove: (id: string) => void;
  setProportion: (id: string, value: number, rebalance: boolean) => void;
  setRole: (mode: ColorMode, role: SemanticColorRole, ref: string | null) => void;
  setScale: (id: string, patch: Parameters<typeof setColorScaleSettings>[2]) => void;
};

// ── Tool ────────────────────────────────────────────────────────────────────

function ColorTool({ identity, onIdentityChange, tool }: { identity: BrandIdentity; onIdentityChange: (identity: BrandIdentity) => void; tool: StudioTool }) {
  const gt = useGT();
  const opacityKey = `glyphfield-draft-v1:${identity.id}:${tool.id}:opacity`;
  const legacyKey = `glyphfield-draft-v1:${identity.id}:${tool.id}:colors`;
  const store = useLiveStore(() => colorWorkingState(identity));
  const identityRef = useCommittedRef(identity);
  const onIdentityChangeRef = useCommittedRef(onIdentityChange);
  const [selectedId, setSelectedId] = useStudioDraft(identity.id, tool.id, 'selected-color', identity.colors[0]?.id ?? 'ink');
  const [view, setView] = useStudioDraft<ColorView>(identity.id, tool.id, 'view', 'palette');
  const [surface, setSurface] = useStudioDraft<ProofSurface>(identity.id, tool.id, 'surface', 'paper');
  const [metric, setMetric] = useStudioDraft<ContrastMetric>(identity.id, tool.id, 'contrast-metric', 'wcag');
  const [visionMode, setVisionMode] = useStudioDraft<ColorVisionMode>(identity.id, tool.id, 'vision', 'deuteranopia');
  const [tokenFormat, setTokenFormat] = useStudioDraft<ColorTokenFormat>(identity.id, tool.id, 'token-format', 'oklch-css');
  const [rebalance, setRebalance] = useStudioDraft(identity.id, tool.id, 'rebalance', true);
  const [contrastId, setContrastId] = useState(() => identity.colors[1]?.id ?? identity.colors[0]?.id ?? 'paper');
  const [selectedRole, setSelectedRole] = useState<SemanticColorRole | null>(null);
  const [popover, setPopover] = useState<{ id: string; left: number; top: number } | null>(null);
  const [legacyDraft, setLegacyDraft] = useState<ColorWorkingState | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [undoDepth, setUndoDepth] = useState(0);
  const undoStack = useRef<ColorWorkingState[]>([]);
  const baseline = useRef<ColorWorkingState | null>(null);
  const idleTimer = useRef<number | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const commitRef = useCommittedRef(() => commit());
  const colors = identity.colors;
  const resolvedSelectedId = colors.some(({ id }) => id === selectedId) ? selectedId : colors[0]?.id ?? '';

  // Opacity is a tool preference; the palette itself lives on the identity.
  useMountEffect(() => {
    const opacity = readPersistentValue<Record<string, number>>(opacityKey, {});
    if (opacity && typeof opacity === 'object' && Object.keys(opacity).length) store.set((current) => ({ ...current, opacity }));
    const legacy = migrateLegacyColorDraft(identityRef.current, readPersistentValue<unknown>(legacyKey, null));
    if (legacy) setLegacyDraft(legacy);
    // Leaving the tool mid-edit keeps the edit.
    return () => {
      if (idleTimer.current !== null) commitRef.current();
    };
  });

  // Committed identity changes (save, source, other tools) replace the working palette unless a gesture is open.
  useEffect(() => {
    if (baseline.current) return;
    const current = store.get();
    if (current.colors === identity.colors && current.colorPairings === identity.colorPairings && current.colorSystem === identity.colorSystem) return;
    store.set({ ...colorWorkingState(identity), opacity: current.opacity });
  }, [identity, store]);

  useEffect(() => {
    if (!popover) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setPopover(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [popover]);

  function pushUndo(snapshot: ColorWorkingState) {
    const previous = undoStack.current.at(-1);
    if (previous && sameState(previous, snapshot)) return;
    undoStack.current = [...undoStack.current, snapshot].slice(-UNDO_LIMIT);
    setUndoDepth(undoStack.current.length);
  }

  function begin() {
    if (!baseline.current) baseline.current = store.get();
  }

  /** Write the working state to the identity (pending until Save) and the opacity draft. */
  function commit(next?: ColorWorkingState) {
    if (idleTimer.current !== null) {
      window.clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
    const before = baseline.current ?? store.get();
    if (next) store.set(next);
    baseline.current = null;
    const state = store.get();
    if (sameState(before, state)) return;
    pushUndo(before);
    if (state.opacity !== before.opacity) schedulePersistentWrite(opacityKey, state.opacity);
    if (state.colors !== before.colors || state.colorPairings !== before.colorPairings || state.colorSystem !== before.colorSystem) {
      onIdentityChangeRef.current(withColorWorkingState(identityRef.current, state));
    }
  }

  /**
   * Live edits commit on release; a quiet period commits too, so Browser API
   * `set()` and keyboard edits without a release still reach the identity.
   */
  function preview(next: ColorWorkingState) {
    begin();
    store.set(next);
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => { idleTimer.current = null; commit(); }, IDLE_COMMIT_DELAY_MS);
  }

  function undo() {
    const previous = undoStack.current.at(-1);
    if (!previous) return;
    undoStack.current = undoStack.current.slice(0, -1);
    setUndoDepth(undoStack.current.length);
    baseline.current = null;
    store.set(previous);
    schedulePersistentWrite(opacityKey, previous.opacity);
    onIdentityChangeRef.current(withColorWorkingState(identityRef.current, previous));
  }

  function addColor() {
    const state = store.get();
    const id = nextColorId(state.colors);
    const base = state.colors.find(({ id: colorId }) => colorId === 'emphasis')?.hex ?? '#5B5BD6';
    const hue = (hexToOklch(normalizeHexOrFallback(base)).hue + 137.5) % 360;
    const hex = oklchToHex({ chroma: 0.14, hue, lightness: 0.62 });
    commit({ ...state, colors: [...state.colors, { hex, id, name: gt('New color'), proportion: 0, role: gt('Describe what this color is for') }] });
    setSelectedId(id);
  }

  function removeColor(id: string) {
    const next = removePaletteColor(withColorWorkingState(identityRef.current, store.get()), id);
    const state = store.get();
    const { [id]: _removed, ...opacity } = state.opacity;
    commit({ ...colorWorkingState(next), opacity });
    setSelectedId(next.colors[0]?.id ?? '');
  }

  function rolePatch(mode: ColorMode, role: SemanticColorRole, ref: string | null) {
    const state = store.get();
    const colorSystem = setSemanticOverride({ colorSystem: state.colorSystem, colors: state.colors }, mode, role, ref && parseColorRef(ref) ? ref : null);
    const { colorSystem: _system, ...rest } = state;
    commit(colorSystem ? { ...rest, colorSystem } : rest);
  }

  function scalePatch(id: string, patch: Parameters<typeof setColorScaleSettings>[2], live: boolean) {
    const state = store.get();
    const colorSystem = setColorScaleSettings({ colorSystem: state.colorSystem, colors: state.colors }, id, patch);
    const { colorSystem: _system, ...rest } = state;
    const next = colorSystem ? { ...rest, colorSystem } : rest;
    if (live) preview(next);
    else commit(next);
  }

  function togglePairing(foreground: string, background: string): ColorWorkingState['colorPairings'] {
    const state = store.get();
    const current = state.colorPairings ?? brandColorPairings({ ...identityRef.current, colorPairings: undefined, colors: state.colors });
    const colorPairings = toggleColorPairing(current, state.colors, foreground, background);
    commit({ ...state, colorPairings });
    return colorPairings;
  }

  function updatePairings(update: (pairings: NonNullable<ColorWorkingState['colorPairings']>) => NonNullable<ColorWorkingState['colorPairings']>) {
    const state = store.get();
    const current = state.colorPairings ?? brandColorPairings({ ...identityRef.current, colorPairings: undefined, colors: state.colors });
    commit({ ...state, colorPairings: update(current) });
  }

  function fixPairing(foreground: string, background: string) {
    const state = store.get();
    const fg = state.colors.find(({ id }) => id === foreground);
    const bg = state.colors.find(({ id }) => id === background);
    const pairing = findPairing(state.colorPairings ?? brandColorPairings({ ...identityRef.current, colorPairings: undefined, colors: state.colors }), foreground, background);
    if (!fg || !bg || !pairing) return;
    const hex = adjustForContrast(normalizeHexOrFallback(fg.hex), normalizeHexOrFallback(bg.hex), pairing.level === 'AA-large' ? 3 : 4.5);
    commit(patchColor(state, foreground, { hex }));
  }

  function balanceProportions() {
    const next = applyBrandHealthFix(withColorWorkingState(identityRef.current, store.get()), 'proportions');
    commit({ ...store.get(), colors: next.colors });
  }

  const inspectorActions: ColorInspectorActions = {
    begin,
    commitColor: (id, patch) => commit(patchColor(store.get(), id, patch)),
    commitOpacity: (id, value) => commit({ ...store.get(), opacity: { ...store.get().opacity, [id]: value } }),
    commitScale: (id, patch) => scalePatch(id, patch, false),
    currentHex: (id) => normalizeHexOrFallback(store.get().colors.find((color) => color.id === id)?.hex),
    editText: (id, patch) => preview(patchColor(store.get(), id, patch)),
    finish: () => commit(),
    flushText: () => commit(),
    previewColor: (id, patch) => preview(patchColor(store.get(), id, patch)),
    previewOpacity: (id, value) => preview({ ...store.get(), opacity: { ...store.get().opacity, [id]: value } }),
    remove: removeColor,
    setProportion: (id, value, keepTotal) => preview({ ...store.get(), colors: setColorProportion(store.get().colors, id, value, keepTotal) }),
    setRole: rolePatch,
    setScale: (id, patch) => scalePatch(id, patch, true),
  };

  const viewActions: ColorActions = {
    balanceProportions,
    beginEdit: begin,
    commit: (next) => commit(next),
    fixPairing,
    normalizeProportions: () => commit({ ...store.get(), colors: normalizeProportions(store.get().colors) }),
    openPopover: (event: MouseEvent<HTMLElement>, id: string) => {
      event.stopPropagation();
      const canvas = canvasRef.current;
      setSelectedId(id);
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      const width = Math.min(300, Math.max(240, bounds.width - 24));
      setPopover({
        id,
        left: Math.min(Math.max(12, bounds.width - width - 12), Math.max(12, event.clientX - bounds.left + 14)),
        top: Math.max(12, event.clientY - bounds.top + canvas.scrollTop + 14),
      });
    },
    preview,
    removePairing: (foreground, background) => updatePairings((pairings) => pairings.filter((pairing) => !(pairing.foreground === foreground && pairing.background === background))),
    selectColor: (id) => setSelectedId(id),
    selectRole: setSelectedRole,
    setPairingUsage: (foreground, background, usage) => updatePairings((pairings) => pairings.map((pairing) => (pairing.foreground === foreground && pairing.background === background ? { ...pairing, usage } : pairing))),
    setProportion: (id, value) => preview({ ...store.get(), colors: setColorProportion(store.get().colors, id, value, rebalance) }),
    togglePairing: (foreground, background) => { togglePairing(foreground, background); },
  };

  async function copyTokens(format: ColorTokenFormat = tokenFormat, throwOnError = false) {
    const value = colorTokens(identityRef.current, store.get(), format);
    try {
      await copyTextToClipboard(value);
      setCopyError(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      setCopyError(true);
      if (throwOnError) throw new Error('Clipboard access was denied.');
    }
    return value;
  }

  function tokenFormatInput(input: unknown): ColorTokenFormat {
    const format = input && typeof input === 'object' ? (input as { format?: unknown }).format : undefined;
    if (format === undefined) return 'oklch-css';
    if (!isColorTokenFormat(format)) throw new RangeError(`format must be one of ${COLOR_TOKEN_FORMATS.map(({ id }) => id).join(', ')}.`);
    return format;
  }

  function inputRecord(input: unknown): Record<string, unknown> {
    return input && typeof input === 'object' ? input as Record<string, unknown> : {};
  }

  function workingNow() {
    const state = store.get();
    return { state, working: withColorWorkingState(identityRef.current, state) };
  }

  function declaredPairings() {
    const { state, working } = workingNow();
    return state.colorPairings ?? brandColorPairings({ ...working, colorPairings: undefined });
  }

  function readContrast() {
    const { state, working } = workingNow();
    const pairings = declaredPairings();
    return {
      matrix: contrastMatrix(state.colors).flat().filter((cell) => cell.foreground !== cell.background).map((cell) => ({
        apca: Math.round(cell.apca * 10) / 10,
        apcaLevel: cell.apcaLevel,
        approved: Boolean(findPairing(pairings, cell.foreground, cell.background)),
        background: cell.background,
        foreground: cell.foreground,
        ratio: Math.round(cell.ratio * 100) / 100,
        wcag: cell.wcag,
      })),
      pairings,
      semantic: Object.fromEntries((['light', 'dark'] as const).map((mode) => [mode, semanticContrastChecks(resolveSemanticColors(working, mode)).map((check) => ({ ...check, ratio: Math.round(check.ratio * 100) / 100 }))])),
    };
  }

  function togglePairingAction(input: unknown) {
    const { state } = workingNow();
    const record = inputRecord(input);
    const hexOf = (id: unknown) => state.colors.find((color) => color.id === id)?.hex;
    const foreground = typeof record.foreground === 'string' ? record.foreground : '';
    const background = typeof record.background === 'string' ? record.background : '';
    const foregroundHex = hexOf(foreground);
    const backgroundHex = hexOf(background);
    if (!foregroundHex || !backgroundHex) throw new RangeError('foreground and background must be colors[].id values.');
    if (foreground === background) throw new RangeError('A color cannot be paired with itself.');
    const approving = !findPairing(declaredPairings(), foreground, background);
    if (approving && colorContrastRatio(normalizeHexOrFallback(foregroundHex), normalizeHexOrFallback(backgroundHex)) < 3) {
      throw new RangeError(`${foreground} on ${background} is below 3:1 and cannot be approved for text.`);
    }
    return togglePairing(foreground, background);
  }

  function readScales(input: unknown) {
    const { state, working } = workingNow();
    const record = inputRecord(input);
    const ids = typeof record.id === 'string' ? [record.id] : state.colors.map(({ id }) => id);
    return Object.fromEntries(ids.map((id) => {
      const color = state.colors.find((entry) => entry.id === id);
      if (!color) throw new RangeError(`No color ${id} in this palette.`);
      return [id, colorScale(color.hex, colorScaleSettings(working, id)).map(({ anchored, hex, step }) => ({ anchored, hex, oklch: formatOklch(hex), step }))];
    }));
  }

  function readVision(input: unknown) {
    const { state } = workingNow();
    const mode = inputRecord(input).mode ?? 'deuteranopia';
    if (!COLOR_VISION_MODES.some(({ id }) => id === mode)) throw new RangeError(`mode must be one of ${COLOR_VISION_MODES.map(({ id }) => id).join(', ')}.`);
    const visionMode = mode as ColorVisionMode;
    return {
      colors: state.colors.map((color) => ({ hex: normalizeHexOrFallback(color.hex), id: color.id, simulated: simulateColorVision(color.hex, visionMode) })),
      confusable: confusableColorPairs(state.colors, visionMode),
      mode: visionMode,
    };
  }

  const handlers: Record<string, (input?: unknown) => unknown> = {
    'colors.contrast.read': readContrast,
    'colors.pairing.toggle': togglePairingAction,
    'colors.proportion.balance': () => {
      balanceProportions();
      return store.get().colors.map(({ id, proportion }) => ({ id, proportion }));
    },
    'colors.scale.read': readScales,
    'colors.semantic.read': () => {
      const { working } = workingNow();
      return Object.fromEntries((['light', 'dark'] as const).map((mode) => [mode, resolveSemanticColors(working, mode)]));
    },
    'colors.tokens.copy': (input) => copyTokens(tokenFormatInput(input), true),
    'colors.tokens.read': (input) => colorTokens(identityRef.current, store.get(), tokenFormatInput(input)),
    'colors.vision.read': readVision,
  };

  function invoke(action: string, input?: unknown): unknown {
    const handler = handlers[action];
    if (!handler) throw new RangeError(`Unknown Color tokens action: ${action}.`);
    return handler(input);
  }

  const sourceCode = useMemo(
    () => stringifySource(colorToolSource(colorWorkingState(identity, store.get().opacity))),
    // Opacity edits commit through the draft; re-read on every identity or undo change.
    [identity, undoDepth, store]
  );

  function applySource(source: string) {
    const next = parseColorToolSource(store.get(), source);
    commit(next);
  }

  const library = <PaletteLibrary onAdd={addColor} onSelect={(id) => { setSelectedId(id); setPopover(null); }} selectedId={resolvedSelectedId} />;
  const inspector = (
    <>
      <LabPanelHeading
        description={<T>Edit perceptual channels, share, scale and roles while production values stay visible.</T>}
        title={colors.find(({ id }) => id === resolvedSelectedId)?.name ?? gt('Color')}
      />
      {selectedRole ? <RoleSection actions={inspectorActions} identity={identity} role={selectedRole} /> : null}
      <ColorSection actions={inspectorActions} id={resolvedSelectedId} />
      <TokenSection actions={inspectorActions} id={resolvedSelectedId} />
      <ProportionSection actions={inspectorActions} id={resolvedSelectedId} rebalance={rebalance} />
      <ScaleSection actions={inspectorActions} id={resolvedSelectedId} />
      <ContrastSection contrastId={contrastId} id={resolvedSelectedId} onContrastChange={setContrastId} />
      <TokensSection format={tokenFormat} identity={identity} onCopy={() => void copyTokens()} onFormatChange={setTokenFormat} />
    </>
  );

  function applyLegacyDraft() {
    if (!legacyDraft) return;
    commit({ ...legacyDraft, opacity: { ...store.get().opacity, ...legacyDraft.opacity } });
    discardLegacyDraft();
  }

  function discardLegacyDraft() {
    setLegacyDraft(null);
    try {
      window.localStorage.removeItem(legacyKey);
    } catch {
      // Storage can be unavailable; the notice still closes for this session.
    }
  }

  const viewProps: ColorCanvasProps = {
    contrastId,
    identity,
    metric,
    onMetricChange: setMetric,
    onRebalanceChange: setRebalance,
    onSurfaceChange: setSurface,
    onVisionModeChange: setVisionMode,
    rebalance,
    selectedId: resolvedSelectedId,
    selectedRole,
    surface,
    view,
    visionMode,
  };

  return (
    <ColorStoreContext.Provider value={store}>
      <ColorActionsContext.Provider value={viewActions}>
        <ToolShell
          actions={(
            <>
              <Button disabled={undoDepth === 0} onClick={undo} title={undoDepth === 0 ? gt('Change a color to enable undo.') : gt('Restore the previous color value.')} type='button' variant='outline'>
                <RotateCcw aria-hidden='true' />
                <T>Undo color</T>
              </Button>
              <CopyTokensButton copied={copied} error={copyError} onCopy={() => void copyTokens()} />
            </>
          )}
          automation={{ actions: studioToolActionNames('colors'), invoke }}
          inspector={inspector}
          library={library}
          sourceCode={{ format: 'JSON', onApply: applySource, source: sourceCode, title: gt('Color system source') }}
          tool={tool}
        >
          <div className={styles.stage}>
            <ColorToolbar identity={identity} onViewChange={(next) => { setView(next); setPopover(null); }} view={view} />
            {legacyDraft ? <LegacyDraftNotice onApply={applyLegacyDraft} onDiscard={discardLegacyDraft} /> : null}
            <div className={styles.canvas} onClick={() => setPopover(null)} ref={canvasRef}>
              <ColorCanvas {...viewProps} />
              {popover ? <CanvasPopover actions={inspectorActions} onClose={() => setPopover(null)} popover={popover} /> : null}
            </div>
          </div>
        </ToolShell>
      </ColorActionsContext.Provider>
    </ColorStoreContext.Provider>
  );
}

function CopyTokensButton({ copied, error, onCopy }: { copied: boolean; error: boolean; onCopy: () => void }) {
  const gt = useGT();
  const icon = copied ? <Check aria-hidden='true' /> : error ? <X aria-hidden='true' /> : <Copy aria-hidden='true' />;
  const label = copied ? <T>Copied</T> : error ? <T>Try copy again</T> : <T>Copy tokens</T>;
  return <Button onClick={onCopy} title={error ? gt('Clipboard access was denied. Try again.') : undefined} type='button' variant='outline'>{icon}{label}</Button>;
}

function ColorToolbar({ identity, onViewChange, view }: { identity: BrandIdentity; onViewChange: (view: ColorView) => void; view: ColorView }) {
  const gt = useGT();
  return (
    <div className={styles.toolbar}>
      <div className={styles.toolbarTitle}>
        <span><T>Color system</T></span>
        <strong>{identity.name}</strong>
      </div>
      <div aria-label={gt('Color view')} className={styles.segmented} role='group'>
        {COLOR_VIEWS.map((entry) => (
          <button aria-label={gt('Show {view} view', { view: gt(entry.label) })} aria-pressed={view === entry.id} key={entry.id} onClick={() => onViewChange(entry.id)} type='button'>{gt(entry.label)}</button>
        ))}
      </div>
    </div>
  );
}

function LegacyDraftNotice({ onApply, onDiscard }: { onApply: () => void; onDiscard: () => void }) {
  return (
    <div className={styles.notice} role='status'>
      <p><T>Colors edited in an earlier version of this tool were kept separately from the brand.</T></p>
      <div>
        <Button onClick={onApply} size='sm' type='button' variant='outline'><T>Apply earlier edits</T></Button>
        <Button onClick={onDiscard} size='sm' type='button' variant='ghost'><T>Discard</T></Button>
      </div>
    </div>
  );
}

type ColorCanvasProps = {
  contrastId: string;
  identity: BrandIdentity;
  metric: ContrastMetric;
  onMetricChange: (metric: ContrastMetric) => void;
  onRebalanceChange: (value: boolean) => void;
  onSurfaceChange: (surface: ProofSurface) => void;
  onVisionModeChange: (mode: ColorVisionMode) => void;
  rebalance: boolean;
  selectedId: string;
  selectedRole: SemanticColorRole | null;
  surface: ProofSurface;
  view: ColorView;
  visionMode: ColorVisionMode;
};

function ColorCanvas(props: ColorCanvasProps) {
  switch (props.view) {
    case 'roles': return <RolesView identity={props.identity} selectedRole={props.selectedRole} />;
    case 'scales': return <ScalesView selectedId={props.selectedId} />;
    case 'contrast': return <ContrastView identity={props.identity} metric={props.metric} onMetricChange={props.onMetricChange} />;
    case 'vision': return <VisionView identity={props.identity} mode={props.visionMode} onModeChange={props.onVisionModeChange} />;
    case 'proportion': return <ProportionView onRebalanceChange={props.onRebalanceChange} rebalance={props.rebalance} />;
    default: return <PaletteView contrastId={props.contrastId} identity={props.identity} onSurfaceChange={props.onSurfaceChange} proofLogo={proofLogoFor(props.identity)} selectedId={props.selectedId} surface={props.surface} />;
  }
}

function CanvasPopover({ actions, onClose, popover }: { actions: ColorInspectorActions; onClose: () => void; popover: { id: string; left: number; top: number } }) {
  const gt = useGT();
  const name = useColorState((state) => state.colors.find(({ id }) => id === popover.id)?.name);
  if (!name) return null;
  return (
    <aside aria-label={gt('Edit {name}', { name })} className={styles.popover} onClick={(event) => event.stopPropagation()} role='region' style={{ left: popover.left, top: popover.top }}>
      <header>
        <div><span><T>Canvas color</T></span><strong>{name}</strong></div>
        <button aria-label={gt('Close color editor')} onClick={onClose} type='button'><X aria-hidden='true' /></button>
      </header>
      <PopoverColor actions={actions} id={popover.id} />
    </aside>
  );
}

function PopoverColor({ actions, id }: { actions: ColorInspectorActions; id: string }) {
  const gt = useGT();
  const color = useColorState((state) => state.colors.find((entry) => entry.id === id));
  const opacity = useColorState((state) => colorOpacity(state, id));
  const paper = useColorState((state) => normalizeHexOrFallback(state.colors.find((entry) => entry.id === 'paper')?.hex, '#FFFFFF'));
  if (!color) return null;
  const hex = normalizeHexOrFallback(color.hex);
  const ratio = colorContrastRatio(hex, paper);
  return (
    <>
      <ColorControl
        ariaLabel={gt('Change {name} on canvas', { name: color.name })}
        label={<T>Edit sampled token</T>}
        onChange={(value) => actions.commitColor(id, { hex: value })}
        onOpacityChange={(value) => actions.commitOpacity(id, value)}
        onOpacityPreview={(value) => actions.previewOpacity(id, value)}
        onPreview={(value) => actions.previewColor(id, { hex: value })}
        opacity={opacity}
        value={hex}
      />
      <div className={styles.popoverMeta}>
        <span>{formatOklch(hex)}</span>
        <span>{ratio.toFixed(2)}:1 · {wcagLevel(ratio)}</span>
      </div>
    </>
  );
}

export default ColorTool;
