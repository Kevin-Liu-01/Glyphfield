'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { T, useGT } from 'gt-next';
import { Check, Copy } from '@/components/ui/SolidIcons';
import ComponentLibraryCatalog, { ComponentPatternIcon } from '@/components/ComponentLibraryCatalog';
import { ComponentPanes, ComponentPreviewStyle, useComponentPreviewCss } from '@/components/ComponentLibraryPreview';
import { LabPanelHeading } from '@/components/LabWorkspace';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioSelect from '@/components/ui/StudioSelect';
import { ToolShell } from '@/components/tools/ToolShell';
import { INPUT_CLASS, TEXTAREA_CLASS, ControlSection, Field, RangeField } from '@/components/tools/ToolFields';
import styles from '@/components/tools/components/ComponentLibraryTool.module.css';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useLiveValue, usePersistentLiveStore, type LiveStore } from '@/hooks/useLiveStore';
import { readPersistentValue } from '@/hooks/usePersistentState';
import { brandTypographyFamily, brandTypographyRole, type BrandIdentity, type BrandTypography } from '@/lib/brandIdentity';
import { copyTextToClipboard } from '@/lib/clipboard';
import { componentCode, type ComponentCodeFile } from '@/lib/componentCode';
import {
  COMPONENT_FAMILY_OPTIONS,
  COMPONENT_PALETTE_KEYS,
  COMPONENT_PATTERNS,
  COMPONENT_STATES,
  componentBrandPalette,
  componentContent,
  componentPattern,
  componentRoleColors,
  componentSource,
  defaultComponentSettings,
  migrateLegacyComponentDrafts,
  parseComponentSource,
  resolvedComponentSettings,
  type ComponentCodeFormat,
  type ComponentLibrarySettings,
  type ComponentPalette,
  type ComponentPatternId,
} from '@/lib/componentLibrary';
import { EMPTY_DEMO_STATE, type DemoState } from '@/lib/componentTemplates';
import type { ColorMode } from '@/lib/colorSystem';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';
import { stringifySource } from '@/lib/sourceCode';

type Store = LiveStore<ComponentLibrarySettings>;

const PALETTE_LABELS: Record<keyof ComponentPalette, { aria: string; label: string }> = {
  accent: { aria: 'Component accent color', label: 'Accent' },
  accentForeground: { aria: 'Component accent text color', label: 'Accent text' },
  background: { aria: 'Component canvas color', label: 'Canvas' },
  border: { aria: 'Component border color', label: 'Border' },
  danger: { aria: 'Component danger color', label: 'Danger' },
  foreground: { aria: 'Component text color', label: 'Text' },
  muted: { aria: 'Component muted color', label: 'Muted surface' },
  mutedForeground: { aria: 'Component muted text color', label: 'Muted text' },
  success: { aria: 'Component success color', label: 'Success' },
  surface: { aria: 'Component surface color', label: 'Surface' },
};

const CODE_FORMATS: readonly { id: ComponentCodeFormat; label: string }[] = [
  { id: 'react', label: 'React + Tailwind' },
  { id: 'html', label: 'HTML + CSS' },
];

function useSetting<K extends keyof ComponentLibrarySettings>(store: Store, key: K): ComponentLibrarySettings[K] {
  return useLiveValue(store, (settings) => settings[key]);
}

function useResolved<S>(store: Store, identity: BrandIdentity, selector: (settings: ComponentLibrarySettings) => S): S {
  return useLiveValue(store, (settings) => selector(resolvedComponentSettings(identity, settings)));
}

function patch(store: Store, value: Partial<ComponentLibrarySettings>) {
  store.set((current) => ({ ...current, ...value }));
}

function codeText(files: readonly ComponentCodeFile[]): string {
  return files.map((file) => `/* ${file.name} */\n${file.code.trimEnd()}`).join('\n\n');
}

// ── Inspector ───────────────────────────────────────────────────────────────

function ContentSection({ store }: { store: Store }) {
  const label = useSetting(store, 'label');
  const supportingCopy = useSetting(store, 'supportingCopy');
  return (
    <ControlSection title={<T>Content</T>}>
      <Field label={<T>Label</T>}>
        <input className={INPUT_CLASS} onChange={(event) => patch(store, { label: event.target.value })} value={label} />
      </Field>
      <Field label={<T>Supporting copy</T>}>
        <textarea className={TEXTAREA_CLASS} onChange={(event) => patch(store, { supportingCopy: event.target.value })} value={supportingCopy} />
      </Field>
    </ControlSection>
  );
}

function SystemSection({ identity, store }: { identity: BrandIdentity; store: Store }) {
  const useBrandDefaults = useSetting(store, 'useBrandDefaults');
  const size = useSetting(store, 'size');
  const surface = useSetting(store, 'surface');
  const borderWidth = useSetting(store, 'borderWidth');
  const elevation = useSetting(store, 'elevation');
  const disabled = useSetting(store, 'disabled');
  const density = useResolved(store, identity, (settings) => settings.density);
  const radius = useResolved(store, identity, (settings) => settings.radius);
  return (
    <ControlSection title={<T>System</T>}>
      <label className='flex items-center justify-between gap-4 text-sm'>
        <span><T>Follow brand defaults</T></span>
        <StudioCheckbox checked={useBrandDefaults} onChange={(event) => patch(store, { useBrandDefaults: event.target.checked })} />
      </label>
      <Field label={<T>Component size</T>}>
        <StudioSelect ariaLabel='Component size' onValueChange={(value) => patch(store, { size: value as ComponentLibrarySettings['size'] })} options={[{ label: 'Small', value: 'sm' }, { label: 'Default', value: 'default' }, { label: 'Large', value: 'lg' }]} value={size} />
      </Field>
      <Field label={<T>Density</T>}>
        <StudioSelect ariaLabel='Component density' onValueChange={(value) => store.set((current) => ({ ...current, density: value as ComponentLibrarySettings['density'], radius: resolvedComponentSettings(identity, current).radius, useBrandDefaults: false }))} options={[{ label: 'Compact', value: 'compact' }, { label: 'Comfortable', value: 'comfortable' }, { label: 'Spacious', value: 'spacious' }]} value={density} />
      </Field>
      <Field label={<T>Surface mode</T>}>
        <StudioSelect ariaLabel='Component surface' onValueChange={(value) => patch(store, { surface: value as ComponentLibrarySettings['surface'] })} options={[{ label: 'Base', value: 'base' }, { label: 'Soft', value: 'soft' }]} value={surface} />
      </Field>
      <RangeField label={<T>Corner radius</T>} max={32} min={0} onChange={(value) => store.set((current) => ({ ...current, density: resolvedComponentSettings(identity, current).density, radius: value, useBrandDefaults: false }))} suffix='px' value={radius} />
      <RangeField label={<T>Border width</T>} max={4} min={0} onChange={(value) => patch(store, { borderWidth: value })} suffix='px' value={borderWidth} />
      <Field label={<T>Elevation</T>}>
        <StudioSelect ariaLabel='Component elevation' onValueChange={(value) => patch(store, { elevation: value as ComponentLibrarySettings['elevation'] })} options={[{ label: 'None', value: 'none' }, { label: 'Soft', value: 'soft' }, { label: 'Strong', value: 'strong' }]} value={elevation} />
      </Field>
      <label className='flex items-center justify-between gap-4 text-sm'>
        <T>Disabled state</T>
        <StudioCheckbox checked={disabled} onChange={(event) => patch(store, { disabled: event.target.checked })} />
      </label>
    </ControlSection>
  );
}

function ColorSystemSection({ identity, store }: { identity: BrandIdentity; store: Store }) {
  const gt = useGT();
  const useBrandDefaults = useSetting(store, 'useBrandDefaults');
  const colors = useSetting(store, 'colors');
  const palette = useMemo(() => (useBrandDefaults ? componentBrandPalette(identity) : colors), [colors, identity, useBrandDefaults]);
  const update = (key: keyof ComponentPalette, value: string) => store.set((current) => ({
    ...current,
    colors: { ...(current.useBrandDefaults ? componentBrandPalette(identity) : current.colors), [key]: value },
    useBrandDefaults: false,
  }));
  return (
    <ControlSection title={<T>Color system</T>}>
      <p className='lab-section-description'>
        {useBrandDefaults ? <T>Following the brand&apos;s semantic roles in light and dark. Edit a color to override them here.</T> : <T>Custom palette for light; dark inverts it.</T>}
      </p>
      {COMPONENT_PALETTE_KEYS.map((key) => (
        <ColorControl ariaLabel={gt(PALETTE_LABELS[key].aria)} key={key} label={gt(PALETTE_LABELS[key].label)} onChange={(value) => update(key, value)} onPreview={(value) => update(key, value)} value={palette[key]} />
      ))}
    </ControlSection>
  );
}

function TypographySection({ identity, store }: { identity: BrandIdentity; store: Store }) {
  const role = useResolved(store, identity, (settings) => settings.typography.role);
  const weight = useResolved(store, identity, (settings) => settings.typography.weight);
  const textScale = useSetting(store, 'textScale');
  const letterSpacing = useSetting(store, 'letterSpacing');
  return (
    <ControlSection title={<T>Typography</T>}>
      <Field label={<T>Font role</T>}>
        <StudioSelect ariaLabel='Component font role' onValueChange={(value) => { const next = value as BrandTypography['role']; store.set((current) => ({ ...current, density: resolvedComponentSettings(identity, current).density, radius: resolvedComponentSettings(identity, current).radius, typography: { role: next, weight: brandTypographyRole(identity, next).weight ?? 400 }, useBrandDefaults: false })); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={role} />
      </Field>
      <RangeField label={<T>Font weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(value) => store.set((current) => ({ ...current, density: resolvedComponentSettings(identity, current).density, radius: resolvedComponentSettings(identity, current).radius, typography: { role: resolvedComponentSettings(identity, current).typography.role, weight: value }, useBrandDefaults: false }))} step={50} value={capVisibleFontWeight(weight)} />
      <RangeField label={<T>Text scale</T>} max={140} min={70} onChange={(value) => patch(store, { textScale: value })} suffix='%' value={textScale} />
      <RangeField label={<T>Letter spacing</T>} max={12} min={-6} onChange={(value) => patch(store, { letterSpacing: value })} suffix='%' value={letterSpacing} />
    </ControlSection>
  );
}

function MediaSection({ identity, store }: { identity: BrandIdentity; store: Store }) {
  const asset = useSetting(store, 'asset');
  const assets = useMemo(() => [...identity.assets, ...identity.proofAssets].filter((entry) => !entry.path.toLocaleLowerCase().endsWith('.pdf')), [identity.assets, identity.proofAssets]);
  const selected = assets.find(({ id }) => id === asset.id);
  return (
    <ControlSection title={<T>Shared media</T>}>
      <Field label={<T>Shared asset</T>}>
        <StudioSelect ariaLabel='Component shared asset' onValueChange={(id) => patch(store, { asset: { ...asset, id } })} options={[{ label: 'None', value: 'none' }, ...assets.map((entry) => ({ label: `${entry.label} · ${entry.type}`, value: entry.id }))]} value={selected?.id ?? 'none'} />
      </Field>
      {selected ? <RangeField label={<T>Asset opacity</T>} max={100} min={0} onChange={(opacity) => patch(store, { asset: { ...asset, opacity } })} value={asset.opacity} /> : null}
    </ControlSection>
  );
}

// ── Canvas ──────────────────────────────────────────────────────────────────

function CodePanel({ identity, onCopy, store }: { identity: BrandIdentity; onCopy: (text: string) => Promise<void>; store: Store }) {
  const gt = useGT();
  const settings = useDeferredValue(useLiveValue(store, (value) => value));
  const files = useMemo(() => componentCode(identity, settings), [identity, settings]);
  const [fileIndex, setFileIndex] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const file = files[Math.min(fileIndex, files.length - 1)]!;
  async function copy(text: string, key: string) {
    await onCopy(text);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  }
  return (
    <section aria-label={gt('Component code')} className={styles.code}>
      <header className={styles.codeHead}>
        <div aria-label={gt('Code format')} className={styles.segmented} role='group'>
          {CODE_FORMATS.map((format) => (
            <button aria-pressed={settings.codeFormat === format.id} key={format.id} onClick={() => { patch(store, { codeFormat: format.id }); setFileIndex(0); }} type='button'>{format.label}</button>
          ))}
        </div>
        <div aria-label={gt('Code files')} className={styles.fileTabs} role='tablist'>
          {files.map((entry, index) => (
            <button aria-selected={index === fileIndex} key={entry.name} onClick={() => setFileIndex(index)} role='tab' type='button'>{entry.name}</button>
          ))}
        </div>
        <div className={styles.codeActions}>
          <Button onClick={() => void copy(file.code, 'file')} size='sm' type='button' variant='outline'>
            {copied === 'file' ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
            {gt('Copy {file}', { file: file.name })}
          </Button>
        </div>
      </header>
      <pre aria-label={gt('{file} source', { file: file.name })} className={`${styles.codeBody} studio-scroll-area`} role='tabpanel' tabIndex={0}>{file.code}</pre>
    </section>
  );
}

function ComponentCanvas({ identity, onCopy, store }: { identity: BrandIdentity; onCopy: (text: string) => Promise<void>; store: Store }) {
  const gt = useGT();
  const pattern = useSetting(store, 'pattern');
  const theme = useSetting(store, 'theme');
  const surface = useSetting(store, 'surface');
  const label = useSetting(store, 'label');
  const supportingCopy = useSetting(store, 'supportingCopy');
  const disabled = useSetting(store, 'disabled');
  const assetId = useSetting(store, 'asset').id;
  const fontRole = useResolved(store, identity, (settings) => settings.typography.role);
  const content = useMemo(() => componentContent(identity), [identity]);
  const [demo, setDemo] = useState<DemoState>(EMPTY_DEMO_STATE);
  const config = componentPattern(pattern) ?? COMPONENT_PATTERNS[0];
  const settingsForCss = useMemo(() => ({ ...store.get(), typography: { ...store.get().typography, role: fontRole } }), [fontRole, store]);
  const css = useComponentPreviewCss(config.id, content, settingsForCss, componentRoleColors(identity, resolvedComponentSettings(identity, store.get()), 'light').foreground);
  const modes: readonly ColorMode[] = theme === 'both' ? ['light', 'dark'] : [theme];
  const textSettings = useMemo(() => ({ disabled, label, supportingCopy }), [disabled, label, supportingCopy]);
  const assetPath = [...identity.assets, ...identity.proofAssets].find(({ id }) => id === assetId)?.path;
  const family = COMPONENT_FAMILY_OPTIONS.find(({ value }) => value === config.family)?.label ?? config.family;

  return (
    <div className={styles.stage} data-surface={surface}>
      <ComponentPreviewStyle css={css} />
      <div className={styles.toolbar}>
        <div className={styles.toolbarTitle}>
          <span><T>Component library</T></span>
          <strong>{gt(config.label)}</strong>
        </div>
        <div aria-label={gt('Component theme')} className={styles.segmented} role='group'>
          {(['light', 'dark', 'both'] as const).map((value) => (
            <button aria-label={gt('Show {theme} theme', { theme: value })} aria-pressed={theme === value} key={value} onClick={() => patch(store, { theme: value })} type='button'>{value}</button>
          ))}
        </div>
      </div>
      <div className={styles.canvas}>
        <header className={styles.patternHead}>
          <span className={styles.patternIcon}><ComponentPatternIcon pattern={config.id} /></span>
          <div>
            <h3>{gt(config.label)}</h3>
            <p>{gt(config.description)}</p>
          </div>
          <dl>
            <div><dt><T>Family</T></dt><dd>{gt(family)}</dd></div>
            <div><dt><T>States</T></dt><dd>{config.states.map((state) => gt(COMPONENT_STATES.find(({ id }) => id === state)!.label)).join(' · ')}</dd></div>
          </dl>
        </header>
        <div className={styles.panes}>
          <ComponentPanes
            assetPath={assetPath}
            content={content}
            demo={demo}
            identity={identity}
            modes={modes}
            onDemo={setDemo}
            pattern={config.id}
            settingsStore={store}
            states={config.states}
            textSettings={textSettings}
          />
        </div>
        <CodePanel identity={identity} onCopy={onCopy} store={store} />
      </div>
    </div>
  );
}

// ── Tool ────────────────────────────────────────────────────────────────────

function ComponentLibraryTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const draftKey = (field: string) => `glyphfield-draft-v1:${identity.id}:${tool.id}:${field}`;
  const store = usePersistentLiveStore<ComponentLibrarySettings>(draftKey('settings-v2'), () => defaultComponentSettings(identity), (stored) => {
    if (stored && typeof stored === 'object') {
      try {
        return parseComponentSource(identity, defaultComponentSettings(identity), stored as Record<string, unknown>);
      } catch {
        return null;
      }
    }
    return migrateLegacyComponentDrafts(identity, (field) => readPersistentValue<unknown>(draftKey(field), undefined));
  });
  const identityRef = useCommittedRef(identity);
  const pattern = useSetting(store, 'pattern');
  const [copied, setCopied] = useState(false);

  async function copyText(text: string, throwOnError = false) {
    try {
      await copyTextToClipboard(text);
    } catch {
      if (throwOnError) throw new Error('Clipboard access was denied.');
    }
  }

  function codeInput(input: unknown): { files: ComponentCodeFile[]; pattern: ComponentPatternId } {
    const record = input && typeof input === 'object' ? input as Record<string, unknown> : {};
    const settings = store.get();
    const requested = typeof record.pattern === 'string' ? record.pattern : settings.pattern;
    const config = componentPattern(requested);
    if (!config) throw new RangeError(`Unknown component pattern "${requested}".`);
    const format = record.format === undefined ? settings.codeFormat : record.format;
    if (format !== 'react' && format !== 'html') throw new RangeError('format must be react or html.');
    return { files: componentCode(identityRef.current, settings, config.id, format), pattern: config.id };
  }

  const handlers: Record<string, (input?: unknown) => unknown> = {
    'components.code.copy': async (input) => {
      const text = codeText(codeInput(input).files);
      await copyText(text, true);
      return text;
    },
    'components.code.read': (input) => codeInput(input),
    'components.list': () => COMPONENT_PATTERNS.map(({ description, family, id, label, states }) => ({ description, family, id, label, states })),
  };

  const sourceCode = useMemo(() => ({
    format: 'JSON',
    onApply: (source: string) => { store.set(parseComponentSource(identityRef.current, store.get(), source)); },
    // Read on demand so typing in Label never re-renders the tool to refresh source.
    get source() {
      return stringifySource(componentSource(store.get()));
    },
    title: gt('Component source'),
  }), [gt, identityRef, store]);

  const config = componentPattern(pattern) ?? COMPONENT_PATTERNS[0];
  const library = <ComponentLibraryCatalog onSelect={(next) => patch(store, { pattern: next })} selectedPattern={config.id} />;
  const inspector = (
    <>
      <LabPanelHeading
        description={<T>Settings drive the live preview, every state and the generated code.</T>}
        title={<span className='component-library-inspector-title'><ComponentPatternIcon pattern={config.id} />{gt(config.label)}</span>}
      />
      <ContentSection store={store} />
      <SystemSection identity={identity} store={store} />
      <ColorSystemSection identity={identity} store={store} />
      <TypographySection identity={identity} store={store} />
      <MediaSection identity={identity} store={store} />
    </>
  );

  return (
    <ToolShell
      actions={(
        <Button onClick={() => { const text = codeText(componentCode(identityRef.current, store.get())); void copyText(text).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1200); }); }} type='button' variant='outline'>
          {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
          {copied ? <T>Copied</T> : <T>Copy code</T>}
        </Button>
      )}
      automation={{ actions: studioToolActionNames('buttons'), invoke: (action, input) => {
        const handler = handlers[action];
        if (!handler) throw new RangeError(`Unknown Component library action: ${action}.`);
        return handler(input);
      } }}
      inspector={inspector}
      library={library}
      sourceCode={sourceCode}
      tool={tool}
    >
      <ComponentCanvas identity={identity} onCopy={(text) => copyText(text, true)} store={store} />
    </ToolShell>
  );
}

export default ComponentLibraryTool;
