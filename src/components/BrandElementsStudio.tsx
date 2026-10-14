'use client';

import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  Badge,
  BriefcaseBusiness,
  Component,
  Download,
  FileImage,
  FileJson,
  FileText,
  Mail,
  Presentation,
  RotateCcw,
  Search,
  Share2,
  TerminalSquare,
} from '@/components/ui/SolidIcons';

import CanvasViewport from '@/components/CanvasViewport';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { LabInspectorSection, StudioSidebar } from '@/components/LabWorkspace';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import SourceCodeDrawer from '@/components/LazySourceCodeDrawer';
import StudioFileMenu from '@/components/StudioFileMenu';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioRange from '@/components/ui/StudioRange';
import StudioSelect from '@/components/ui/StudioSelect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import {
  BRAND_ELEMENT_CATEGORIES,
  BRAND_ELEMENTS,
  createBrandElementSettings,
  BRAND_ELEMENT_SOURCE_SCHEMA,
  BRAND_ELEMENT_SOURCE_VERSION,
  filterBrandElements,
  parseBrandElementSource,
  type BrandElement,
  type BrandElementCategory,
  type BrandElementOverrides,
  type BrandElementSettings,
} from '@/lib/brandElements';
import { getEmailLifecycleTemplate } from '@/lib/emailLifecycle';
import { brandElementHasEmailHtml } from '@/lib/brandEmailHtml';
import { downloadBlob } from '@/lib/download';
import { exportInput, renderElementHtml, renderElementPng, waitForArtboard } from '@/lib/brandElementExport';
import {
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { brandPalette } from '@/lib/brandOutputKit';
import { DEFAULT_LOGO_APPEARANCE, logoAppearanceCssFilter } from '@/lib/logoAppearance';
import type { StudioTool } from '@/lib/studioCatalog';
import { parseSourceObject, stringifySource } from '@/lib/sourceCode';
import { MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';
import { ElementPreview } from './brandElementPreviews';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { registerStudioAutomation } from '@/lib/studioAutomation';

const CATEGORY_ICONS: Record<BrandElementCategory, typeof Mail> = {
  Developer: TerminalSquare,
  Digital: Mail,
  Editorial: Presentation,
  Event: Badge,
  Physical: BriefcaseBusiness,
  Product: Component,
  Social: Share2,
};

const PERSON_ELEMENT_IDS = new Set(['email-signature', 'lanyard', 'event-badge', 'business-card']);
const CONTENTLESS_ELEMENT_IDS = new Set(['logo-background', 'favicon-set', 'app-icon']);
const HEADLINELESS_ELEMENT_IDS = new Set(['ascii-mark', 'partnership-lockup']);
const BODYLESS_ELEMENT_IDS = new Set(['cli-banner', 'terminal-theme', 'event-backdrop', 'partnership-lockup']);
const ACTIONLESS_ELEMENT_IDS = new Set(['ascii-mark', 'terminal-theme', 'partnership-lockup', 'slide-title', 'slide-section', 'report-cover', 'press-kit', 'event-backdrop', 'booth-wall']);
const FIXED_LAYOUT_ELEMENT_IDS = new Set(['ascii-mark', 'terminal-theme', 'cli-banner', 'partnership-lockup', 'event-backdrop', 'booth-wall']);
const FIXED_SCALE_ELEMENT_IDS = new Set(['form-controls', 'settings-panel', 'data-table']);
const PATTERNLESS_ELEMENT_IDS = new Set(['email-signature', 'lanyard', 'event-badge', 'business-card', 'letterhead', 'favicon-set', 'app-icon']);
const LOGOLESS_ELEMENT_IDS = new Set(['ascii-mark', 'terminal-theme', 'cli-banner']);
const ARTWORK_ELEMENT_IDS = new Set(['logo-background', 'favicon-set', 'app-icon', 'x-post', 'linkedin-post', 'community-card', 'launch-card', 'app-store-gallery', 'video-thumbnail', 'podcast-cover', 'social-carousel', 'event-backdrop', 'booth-wall', 'partnership-lockup', 'web-card', 'opengraph']);
const WEBSITELESS_ELEMENT_IDS = new Set(['ascii-mark', 'terminal-theme', 'cli-banner', 'modal-dialog', 'toast-notification']);

function elementEditorCapabilities(element: BrandElement, identity: BrandIdentity) {
  const contentless = CONTENTLESS_ELEMENT_IDS.has(element.id);
  const personOnly = PERSON_ELEMENT_IDS.has(element.id);
  const layoutSupported = !contentless && !personOnly && !FIXED_LAYOUT_ELEMENT_IDS.has(element.id);
  return {
    actionSupported: !contentless && !personOnly && !ACTIONLESS_ELEMENT_IDS.has(element.id),
    artworkSupported: Boolean(getEmailLifecycleTemplate(element.id, identity)?.artworkPath)
      || ARTWORK_ELEMENT_IDS.has(element.id),
    bodyHidden: contentless || personOnly || BODYLESS_ELEMENT_IDS.has(element.id),
    contentless,
    hasPartner: element.id === 'partnership-lockup',
    hasPerson: personOnly,
    headlineHidden: contentless || personOnly || HEADLINELESS_ELEMENT_IDS.has(element.id),
    layoutSupported,
    logoSupported: !LOGOLESS_ELEMENT_IDS.has(element.id),
    patternSupported: !PATTERNLESS_ELEMENT_IDS.has(element.id),
    scaleSupported: layoutSupported && !FIXED_SCALE_ELEMENT_IDS.has(element.id),
    websiteSupported: !contentless && !WEBSITELESS_ELEMENT_IDS.has(element.id),
  };
}

function elementBriefExport(
  identity: BrandIdentity,
  element: BrandElement,
  settings: BrandElementSettings
): ExportPreviewAsset {
  const previewText = JSON.stringify(
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
  );
  return {
    blob: new Blob([previewText], { type: 'application/json' }),
    fileName: `${identity.id}-${element.id}-brief.json`,
    format: 'JSON',
    previewText,
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
  const rangeLabelId = useId();
  return (
    <label htmlFor={`${rangeLabelId}-input`} className='element-editor-range'>
      <StudioRangeLabel id={rangeLabelId} label={label} value={<output>{resolvedValue}{suffix}</output>} />
      <StudioRange id={`${rangeLabelId}-input`} aria-labelledby={rangeLabelId} max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} value={resolvedValue} />
    </label>
  );
}

type ElementEditorCapabilities = ReturnType<typeof elementEditorCapabilities>;
type ElementEditorChange = (patch: BrandElementOverrides) => void;

function ElementEditorContentSection({
  capabilities,
  onChange,
  onReset,
  settings,
}: {
  capabilities: ElementEditorCapabilities;
  onChange: ElementEditorChange;
  onReset: () => void;
  settings: BrandElementSettings;
}) {
  const gt = useGT();
  if (capabilities.contentless) return null;
  return (
    <LabInspectorSection
      action={<Button aria-label={gt('Reset element')} onClick={onReset} size='icon-xs' title={gt('Reset element')} type='button' variant='ghost'>
          <RotateCcw aria-hidden='true' />
        </Button>}
      title={<T>Content</T>}
    >
      {!capabilities.headlineHidden ? <ElementTextControl label={<T>Headline</T>} multiline onChange={(headline) => onChange({ headline })} value={settings.headline} /> : null}
      {!capabilities.bodyHidden ? <ElementTextControl label={<T>Supporting copy</T>} multiline onChange={(body) => onChange({ body })} value={settings.body} /> : null}
      {capabilities.actionSupported ? <ElementTextControl label={<T>Action</T>} onChange={(cta) => onChange({ cta })} value={settings.cta} /> : null}
      {capabilities.hasPerson ? (
        <>
          <ElementTextControl label={<T>Name</T>} onChange={(personName) => onChange({ personName })} value={settings.personName} />
          <ElementTextControl label={<T>Role</T>} onChange={(personRole) => onChange({ personRole })} value={settings.personRole} />
        </>
      ) : null}
      {capabilities.hasPartner ? <ElementTextControl label={<T>Partner name</T>} onChange={(partnerName) => onChange({ partnerName })} value={settings.partnerName} /> : null}
    </LabInspectorSection>
  );
}

function ElementEditorCompositionSection({
  capabilities,
  onChange,
  settings,
}: {
  capabilities: ElementEditorCapabilities;
  onChange: ElementEditorChange;
  settings: BrandElementSettings;
}) {
  const gt = useGT();
  if (!capabilities.layoutSupported && !capabilities.scaleSupported && !capabilities.patternSupported) return null;
  return (
    <LabInspectorSection title={<T>Composition</T>}>
      {capabilities.layoutSupported ? <div className='element-editor-field'>
        <span><T>Layout</T></span>
        <StudioSelect ariaLabel={gt('Layout')} onValueChange={(layout) => onChange({ layout: layout as BrandElementSettings['layout'] })} options={[
          { label: gt('Split'), value: 'split' },
          { label: gt('Stacked'), value: 'stacked' },
          { label: gt('Centered'), value: 'centered' },
        ]} value={settings.layout} />
      </div> : null}
      {capabilities.scaleSupported ? <div className='element-editor-field'>
        <span><T>Type scale</T></span>
        <StudioSelect ariaLabel={gt('Type scale')} onValueChange={(scale) => onChange({ scale: scale as BrandElementSettings['scale'] })} options={[
          { label: gt('Compact'), value: 'compact' },
          { label: gt('Balanced'), value: 'balanced' },
          { label: gt('Bold'), value: 'bold' },
        ]} value={settings.scale} />
      </div> : null}
      {capabilities.patternSupported ? <div className='element-editor-field'>
        <span><T>Pattern</T></span>
        <StudioSelect ariaLabel={gt('Pattern')} onValueChange={(pattern) => onChange({ pattern: pattern as BrandElementSettings['pattern'] })} options={[
          { label: gt('None'), value: 'none' },
          { label: gt('Dots'), value: 'dots' },
          { label: gt('Grid'), value: 'grid' },
          { label: gt('Dither'), value: 'dither' },
        ]} value={settings.pattern} />
      </div> : null}
      {capabilities.patternSupported && settings.pattern !== 'none' ? <ElementRangeControl label={<T>Pattern opacity</T>} max={100} min={0} onChange={(patternOpacity) => onChange({ patternOpacity })} suffix='%' value={settings.patternOpacity} /> : null}
    </LabInspectorSection>
  );
}

function ElementEditorSharedAssetSection({ onChange, identity, settings }: { identity: BrandIdentity; onChange: ElementEditorChange; settings: BrandElementSettings }) {
  const gt = useGT();
  return (
    <LabInspectorSection title={<T>Shared asset</T>}>
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
    </LabInspectorSection>
  );
}

function ElementEditorArtworkSection({ artworkSupported, onChange, settings }: { artworkSupported: boolean; onChange: ElementEditorChange; settings: BrandElementSettings }) {
  if (!artworkSupported) return null;
  return (
    <LabInspectorSection title={<T>Artwork</T>}>
      <ElementRangeControl label={<T>Horizontal</T>} max={120} min={-120} onChange={(artworkX) => onChange({ artworkX })} suffix='px' value={settings.artworkX} />
      <ElementRangeControl label={<T>Vertical</T>} max={120} min={-120} onChange={(artworkY) => onChange({ artworkY })} suffix='px' value={settings.artworkY} />
      <ElementRangeControl label={<T>Scale</T>} max={200} min={40} onChange={(artworkScale) => onChange({ artworkScale })} suffix='%' value={settings.artworkScale} />
    </LabInspectorSection>
  );
}

function ElementEditorBrandDetailsSection({ capabilities, onChange, settings }: { capabilities: ElementEditorCapabilities; onChange: ElementEditorChange; settings: BrandElementSettings }) {
  return (
    <LabInspectorSection title={<T>Brand details</T>}>
      {capabilities.logoSupported ? <label className='element-editor-toggle'>
        <span><T>Show logo</T></span>
        <StudioCheckbox checked={settings.showLogo} onChange={(event) => onChange({ showLogo: event.target.checked })} variant='switch' />
      </label> : null}
      {capabilities.logoSupported && settings.showLogo ? (
        <div className='mt-2 border-t border-border pt-4'>
          <LogoAppearanceControls
            onChange={(patch) => onChange({ logoAppearance: { ...DEFAULT_LOGO_APPEARANCE, ...settings.logoAppearance, ...patch } })}
            settings={{ ...DEFAULT_LOGO_APPEARANCE, ...settings.logoAppearance }}
          />
        </div>
      ) : null}
      {capabilities.websiteSupported ? <label className='element-editor-toggle'>
        <span><T>Show website</T></span>
        <StudioCheckbox checked={settings.showWebsite} onChange={(event) => onChange({ showWebsite: event.target.checked })} variant='switch' />
      </label> : null}
    </LabInspectorSection>
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
  const capabilities = elementEditorCapabilities(element, identity);

  return (
    <StudioSidebar
      className='brand-elements-editor min-h-0'
      label={gt('Element editor')}
      storageKey={`brand-elements-editor-${identity.id}`}
    >
      <ElementEditorContentSection capabilities={capabilities} onChange={onChange} onReset={onReset} settings={settings} />
      <ElementEditorCompositionSection capabilities={capabilities} onChange={onChange} settings={settings} />

      <LabInspectorSection title={<T>Typography</T>}>
        <div className='element-editor-field'>
          <span><T>Font role</T></span>
          <StudioSelect ariaLabel={gt('Font role')} onValueChange={(fontRole) => onChange({ fontRole: fontRole as BrandElementSettings['fontRole'], fontWeight: brandTypographyRole(identity, fontRole as BrandElementSettings['fontRole']).weight })} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={settings.fontRole} />
        </div>
        <ElementRangeControl label={<T>Weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(fontWeight) => onChange({ fontWeight })} suffix='' value={settings.fontWeight} />
      </LabInspectorSection>

      <ElementEditorSharedAssetSection identity={identity} onChange={onChange} settings={settings} />
      <ElementEditorArtworkSection artworkSupported={capabilities.artworkSupported} onChange={onChange} settings={settings} />

      <LabInspectorSection title={<T>Color</T>}>
        <ElementColorControl label={<T>Background</T>} onChange={(backgroundColor) => onChange({ backgroundColor })} value={settings.backgroundColor} />
        <ElementColorControl label={<T>Text</T>} onChange={(foregroundColor) => onChange({ foregroundColor })} value={settings.foregroundColor} />
        <ElementColorControl label={<T>Accent</T>} onChange={(accentColor) => onChange({ accentColor })} value={settings.accentColor} />
      </LabInspectorSection>

      <ElementEditorBrandDetailsSection capabilities={capabilities} onChange={onChange} settings={settings} />
    </StudioSidebar>
  );
}

type CatalogProps = {
  elements: readonly BrandElement[];
  onSelect: (id: string) => void;
  selectedId: string;
};

type MobileSelectProps = { elements: readonly BrandElement[]; onSelect: (id: string) => void; value: string };

/** The compact-width picker; its long option list is built once per identity. */
const MobileElementSelect = memo(function MobileElementSelect({ elements, onSelect, value }: MobileSelectProps) {
  const gt = useGT();
  const options = useMemo(() => BRAND_ELEMENT_CATEGORIES.flatMap((elementCategory) =>
    elements.filter((element) => element.category === elementCategory).map((element) => ({
      label: `${gt(elementCategory)} / ${gt(element.name)}`,
      value: element.id,
    }))
  // gt-next returns a new function each render; the labels only change with the catalog.
  ), [elements]);
  return (
    <StudioSelect
      ariaLabel={gt('Active brand element')}
      className='brand-elements-mobile-select hidden'
      onValueChange={onSelect}
      options={options}
      value={value}
    />
  );
});

type CatalogItemProps = { element: BrandElement; onSelect: (id: string) => void; selected: boolean };

/** One row; only the previous and next selection re-render when the selection moves. */
const ElementCatalogItem = memo(function ElementCatalogItem({ element, onSelect, selected }: CatalogItemProps) {
  const gt = useGT();
  return (
    <Button
      className='relative h-auto min-h-11 w-full justify-start overflow-hidden rounded-none px-2 py-2 text-left'
      onClick={() => onSelect(element.id)}
      type='button'
      variant={selected ? 'default' : 'ghost'}
    >
      <span className='relative z-10 min-w-0 flex-1 pr-10'>
        <span className='block truncate text-sm'>{gt(element.name)}</span>
        <span className={`block truncate font-mono text-[10px] ${selected ? 'text-primary-foreground/55' : 'text-muted-foreground'}`}>
          {element.dimensions}
        </span>
      </span>
      <span
        aria-hidden='true'
        className={`pointer-events-none absolute right-3 bottom-2 font-mono text-[18px] font-semibold leading-none tracking-[-0.08em] ${selected ? 'text-primary-foreground/12' : 'text-foreground/7'}`}
      >
        {element.symbol}
      </span>
    </Button>
  );
});

/** The element list re-renders only when the filter changes. */
const ElementCatalogList = memo(function ElementCatalogList({ elements, onSelect, selectedId }: CatalogProps) {
  const gt = useGT();
  return (
    <div className='flex flex-col py-2'>
      {BRAND_ELEMENT_CATEGORIES.map((elementCategory) => {
        const categoryElements = elements.filter((element) => element.category === elementCategory);
        if (categoryElements.length === 0) return null;
        const Icon = CATEGORY_ICONS[elementCategory];
        return (
          <section className='flex flex-col gap-1 px-2 py-2' key={elementCategory}>
            <div className='flex items-center gap-2 px-2 py-1 text-xs uppercase tracking-widest text-muted-foreground'>
              <Icon className='size-3.5' aria-hidden='true' />
              <span>{gt(elementCategory)}</span>
              <span className='ml-auto font-mono'>{categoryElements.length}</span>
            </div>
            {categoryElements.map((element) => (
              <ElementCatalogItem element={element} key={element.id} onSelect={onSelect} selected={selectedId === element.id} />
            ))}
          </section>
        );
      })}
      {elements.length === 0 ? (
        <div className='flex flex-col items-center gap-3 px-5 py-12 text-center'>
          <FileText className='size-5 text-muted-foreground' aria-hidden='true' />
          <p className='text-sm font-medium'><T>No elements found</T></p>
          <p className='text-xs leading-5 text-muted-foreground'><T>Try a medium, format, or application.</T></p>
        </div>
      ) : null}
    </div>
  );
});

export default function BrandElementsStudio({
  identity,
  tool,
}: {
  identity: BrandIdentity;
  tool: StudioTool;
}) {
  const studioRootRef = useRef<HTMLDivElement>(null);
  const gt = useGT();
  const scope = `be${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useStudioDraft<BrandElementCategory | 'All'>(identity.id, tool.id, 'category', 'All');
  const [selectedElementId, setSelectedElementId] = useStudioDraft(identity.id, tool.id, 'selected-element', 'welcome-email');
  const [elementOverrides, setElementOverrides] = useStudioDraft<Record<string, BrandElementOverrides>>(identity.id, tool.id, 'element-settings', {});
  const palette = useMemo(() => brandPalette(identity), [identity]);
  const identityElements = useMemo(
    () =>
      BRAND_ELEMENTS.map((element) => {
        const template = getEmailLifecycleTemplate(element.id, identity);
        if (!template) return element;
        return {
          ...element,
          description: template.description,
          format: template.artworkPath ? 'HTML + motion' : 'Plain text',
          keywords: ['email', template.group.toLocaleLowerCase(), ...template.keywords],
          name: template.name,
          symbol: template.symbol,
        };
      }),
    [identity]
  );
  const filteredElements = useMemo(
    () => filterBrandElements(identityElements, query).filter((element) => category === 'All' || element.category === category),
    [category, identityElements, query]
  );
  const selectedElement = identityElements.find(({ id }) => id === selectedElementId) ?? identityElements[0]!;
  const selectedOverrides = elementOverrides[selectedElement.id];
  const selectedSettings = useMemo<BrandElementSettings>(
    () => ({ ...createBrandElementSettings(selectedElement, identity), ...selectedOverrides }),
    [identity, selectedElement, selectedOverrides]
  );
  const selectElement = useCallback((id: string) => setSelectedElementId(id), [setSelectedElementId]);
  const elementId = selectedElement.id;
  const updateSelectedSettings = useCallback((patch: BrandElementOverrides) => {
    setElementOverrides((current) => ({ ...current, [elementId]: { ...current[elementId], ...patch } }));
  }, [elementId, setElementOverrides]);

  function resetSelectedSettings() {
    setElementOverrides((current) => {
      const next = { ...current };
      delete next[selectedElement.id];
      return next;
    });
  }

  function readSource(): string {
    return stringifySource({
      ...selectedSettings,
      elementId: selectedElement.id,
      schema: BRAND_ELEMENT_SOURCE_SCHEMA,
      version: BRAND_ELEMENT_SOURCE_VERSION,
    });
  }

  function applySource(source: string) {
    const parsed = parseBrandElementSource(parseSourceObject(source), identityElements, selectedElement.id, identity);
    setSelectedElementId(parsed.elementId);
    setElementOverrides((current) => {
      // Provided settings replace their stored values; omitted settings stay as they are.
      const kept = Object.fromEntries(Object.entries(current[parsed.elementId] ?? {}).filter(([key]) => !parsed.keys.includes(key as keyof BrandElementSettings)));
      const merged = { ...kept, ...parsed.overrides };
      const next = { ...current };
      if (Object.keys(merged).length > 0) next[parsed.elementId] = merged;
      else delete next[parsed.elementId];
      return next;
    });
  }

  function exportBrief() {
    const asset = elementBriefExport(identity, selectedElement, selectedSettings);
    setLastExport(asset);
    return asset;
  }

  /** Select the requested element (when given) and wait until its artboard is on screen. */
  async function prepareElement(input: unknown): Promise<BrandElement> {
    const { elementId } = exportInput(input);
    const element = elementId === undefined ? selectedElement : identityElements.find(({ id }) => id === elementId);
    if (!element) throw new RangeError('elementId must reference an ID returned by /api/elements.');
    if (element.id !== selectedElement.id) setSelectedElementId(element.id);
    await waitForArtboard(studioRootRef.current, element.id);
    return element;
  }

  function settingsFor(element: BrandElement): BrandElementSettings {
    return { ...createBrandElementSettings(element, identity), ...overridesRef.current[element.id] };
  }

  async function exportPng(input?: unknown): Promise<ExportPreviewAsset> {
    const { download, scale } = exportInput(input);
    const element = await prepareElement(input);
    setExporting(true);
    try {
      const asset = await renderElementPng(studioRootRef.current, identity, element, scale);
      setLastExport(asset);
      if (download) downloadBlob(asset.blob, asset.fileName);
      return asset;
    } finally {
      setExporting(false);
    }
  }

  async function exportHtml(input?: unknown): Promise<ExportPreviewAsset> {
    const { assetOrigin, download, elementId } = exportInput(input);
    const element = elementId === undefined ? selectedElement : identityElements.find(({ id }) => id === elementId);
    if (!element) throw new RangeError('elementId must reference an ID returned by /api/elements.');
    if (!brandElementHasEmailHtml(element)) throw new RangeError(`${element.name} is not an email; use brand-element.export.png.`);
    const asset = await renderElementHtml(identity, element, settingsFor(element), assetOrigin ?? window.location.origin);
    setLastExport(asset);
    if (download) downloadBlob(asset.blob, asset.fileName);
    return asset;
  }

  const overridesRef = useCommittedRef(elementOverrides);
  const automationRef = useCommittedRef({ applySource, exportBrief, exportHtml, exportPng, readSource });
  useEffect(() => registerStudioAutomation({
    actions: studioToolActionNames('brand-elements'),
    applySource: (source) => automationRef.current.applySource(source),
    getSource: () => automationRef.current.readSource(),
    invoke: (action, input) => {
      if (action === 'brand-element.export.brief') return automationRef.current.exportBrief();
      if (action === 'brand-element.export.png') return automationRef.current.exportPng(input);
      if (action === 'brand-element.export.html') return automationRef.current.exportHtml(input);
      throw new RangeError(`Unknown Brand elements action: ${action}.`);
    },
    toolId: 'brand-elements',
  }, studioRootRef.current), [automationRef]);

  const sharedAsset = [...identity.assets, ...identity.proofAssets].find(({ id }) => id === selectedSettings.assetId);
  const previewContext = useMemo(() => ({
    editable: true,
    element: selectedElement,
    identity,
    onChange: updateSelectedSettings,
    palette,
    scope,
    settings: selectedSettings,
  }), [identity, palette, scope, selectedElement, selectedSettings, updateSelectedSettings]);

  return (
    <div className='tool-shell h-full min-h-0' ref={studioRootRef}>
      <StudioToolHeader
        actions={(
          <>
          <StudioFileMenu onSource={() => setSourceOpen(true)} sections={[
            { label: gt('Export'), items: [
              { id: 'png-2x', label: gt('Export PNG at 2×'), description: gt('Twice the real pixel size, for retina screens.'), icon: <FileImage />, onSelect: () => { void exportPng({ scale: 2, download: true }); } },
              { id: 'html', label: gt('Export HTML email'), description: gt('Send-ready table layout with inlined styles.'), disabled: !brandElementHasEmailHtml(selectedElement), icon: <Mail />, onSelect: () => { void exportHtml({ download: true }); } },
              { id: 'brief', label: gt('Download element brief'), description: gt('JSON with the element, its settings and the identity.'), icon: <FileJson />, onSelect: exportBrief },
            ] },
          ]} />
          <ExportPreview asset={lastExport} />
          <Button disabled={exporting} onClick={() => { void exportPng({ download: false }); }} type='button'>
            <Download aria-hidden='true' />
            <T>Export PNG</T>
          </Button>
          </>
        )}
        metadata={tool.description}
        title={tool.name}
        toolId={tool.id}
      />

      <div className='brand-elements-body tool-body'>
        <StudioSidebar
          className='brand-elements-catalog tool-inspector min-h-0'
          kind='library'
          label={gt('Brand element catalog')}
          storageKey={`brand-elements-catalog-${identity.id}`}
        >
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
          <ElementCatalogList elements={filteredElements} onSelect={selectElement} selectedId={selectedElement.id} />
        </StudioSidebar>

        <div className='brand-elements-canvas tool-canvas studio-scroll-area min-h-0 overflow-auto'>
          <div className='flex min-h-full flex-col'>
            <div className='flex flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-5 py-3'>
              <MobileElementSelect elements={identityElements} onSelect={selectElement} value={selectedElement.id} />
              <div>
                <p className='text-sm font-semibold'>{selectedElement.name}</p>
                <p className='text-xs text-muted-foreground'><T>Click any text on the artboard to edit it in place.</T></p>
              </div>
              <div className='flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground'>
                <span className='rounded-md border border-border px-2 py-1'>{selectedElement.dimensions}</span>
                <span className='rounded-md border border-border px-2 py-1'>{selectedElement.format}</span>
              </div>
            </div>
            <CanvasViewport
              className='min-h-[560px] flex-1'
              identityId={identity.id}
              stageClassName='grid min-h-[560px] grid-cols-[minmax(0,1fr)] place-items-center p-5 sm:p-8'
              toolId={tool.id}
            >
              <div
                className='brand-element-stage mx-auto w-full max-w-6xl'
                data-element={selectedElement.id}
                style={{ '--brand-logo-filter': logoAppearanceCssFilter({ ...DEFAULT_LOGO_APPEARANCE, ...selectedSettings.logoAppearance }) } as CSSProperties}
              >
                <ElementPreview context={previewContext} sharedAsset={sharedAsset} />
              </div>
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
      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · selected element settings (version 2, with elementId)'
          onApply={applySource}
          onClose={() => setSourceOpen(false)}
          source={readSource()}
          title={`${selectedElement.name} source`}
        />
      ) : null}
    </div>
  );
}
