'use client';

import dynamic from 'next/dynamic';
import { Fragment, memo, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  Check,
  Copy,
  Download,
  FileImage,
  RotateCcw,
  Upload,
  X,
} from '@/components/ui/SolidIcons';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasArtboard from '@/components/CanvasArtboard';
import CanvasLayerPanel from '@/components/CanvasLayerPanel';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import {
  alignCanvasLayer,
  type CanvasLayerAlignment,
  type CanvasLayerGeometry,
  type CanvasLayerTransform,
} from '@/lib/canvasInteraction';
import ComponentLibraryPreview from '@/components/ComponentLibraryPreview';
import ComponentLibraryCatalog, { ComponentPatternIcon } from '@/components/ComponentLibraryCatalog';
import {
  COMPONENT_FAMILY_OPTIONS,
  COMPONENT_PATTERNS,
  componentBrandPalette,
  componentPreviewStyle,
  getFirstComponentPattern,
  type ComponentElevation,
  type ComponentFamily,
  type ComponentPalette,
  type ComponentPatternId,
} from '@/lib/componentLibrary';
import DesignVersionControls from '@/components/DesignVersionControls';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { LabInspectorSection, LabPanelHeading, StudioSidebar } from '@/components/LabWorkspace';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
import StudioRange from '@/components/ui/StudioRange';
import TemplateCanvasPreview from '@/components/TemplateCanvasPreview';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioSelect from '@/components/ui/StudioSelect';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  BUILT_IN_BRAND_IDENTITIES,
  brandAssetPath,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandFontAsset,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { copyTextToClipboard } from '@/lib/clipboard';
import {
  canvasElementAssetSource,
  canvasRevisionFromSignature,
  isCanvasDocumentEnvelope,
  type CanvasDocument,
} from '@/lib/canvasDocument';
import { colorContrastRatio, formatOklch, hexToOklch, mixHexColors, normalizeHex, normalizeHexOrFallback, oklchToHex, resolveReadableColor } from '@/lib/color';
import { CODE_THEME, type CodeLanguage } from '@/lib/codeHighlight';
import {
  blobToDataUrl,
  escapeXml,
  svgToPngBlob,
} from '@/lib/download';
import type { StudioTool, StudioToolId } from '@/lib/studioCatalog';
import { registerStudioAutomation } from '@/lib/studioAutomation';
import { savedDesignStorageKey } from '@/lib/savedDesigns';
import {
  createStudioCanvasDocument,
  parseStudioCanvasDocument,
} from '@/lib/studioCanvasDocument';
import {
  DEFAULT_LOGO_APPEARANCE,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';
import { buildOpenGraphSvg } from '@/lib/openGraphSvg';
import {
  parseOpenGraphWorkspaceSource,
  parseTemplateWorkspaceSource,
} from '@/lib/expressionWorkspaceSource';
import {
  defaultTemplatePartnerFont,
  defaultTemplatePartnerTreatment,
  defaultTemplatePartner,
  templateBackgroundOptions,
  templateBrandLogo,
  templatePartnerFontOptions,
  templatePartnerOptions,
  type TemplateKind,
  type TemplatePartnerTreatment,
} from '@/lib/templateAssets';
import {
  buildTemplateSvg,
  type SlideLayout,
  type TemplateLayerId,
  type TemplateSvgOptions,
  type TemplateTexture,
} from '@/lib/templateSvg';
import { buildTerminalSvg } from '@/lib/terminalSvg';
import {
  capVisibleFontWeight,
  clampTypographyPreviewSize,
  MAX_VISIBLE_FONT_WEIGHT,
  measureTypingSample,
  TYPOGRAPHY_PREVIEW_DEFAULT_SIZES,
  TYPOGRAPHY_PREVIEW_MAX_SIZES,
} from '@/lib/typography';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceObjectArray,
  sourceString,
  stringifySource,
} from '@/lib/sourceCode';

const BackgroundStudio = dynamic(() => import('@/components/BackgroundStudio'), {
  loading: ToolModuleLoading,
  ssr: false,
});
const BrandBook = dynamic(() => import('@/components/BrandBook'), {
  loading: ToolModuleLoading,
});
const BrandElementsStudio = dynamic(() => import('@/components/BrandElementsStudio'), {
  loading: ToolModuleLoading,
});
const BrandSettingsStudio = dynamic(() => import('@/components/BrandSettingsStudio'), {
  loading: ToolModuleLoading,
});
const DesignBoard = dynamic(() => import('@/components/DesignBoard'), {
  loading: ToolModuleLoading,
});
const LogoShaderStudio = dynamic(() => import('@/components/LogoShaderStudio'), {
  loading: ToolModuleLoading,
  ssr: false,
});

function ToolModuleLoading() {
  return (
    <div aria-busy='true' aria-label='Loading tool' className='studio-workspace-loading'>
      <span />
    </div>
  );
}

const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground';
const TEXTAREA_CLASS =
  'min-h-28 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-foreground';

type LocalAsset = {
  name: string;
  url: string;
};

function useLocalAsset() {
  const [asset, setAsset] = useState<LocalAsset | null>(null);
  const assetRef = useCommittedRef(asset);

  useMountEffect(
    () => () => {
      if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    }
  );

  async function select(file: File) {
    const nextAsset = { name: file.name, url: await blobToDataUrl(file) };
    assetRef.current = nextAsset;
    setAsset(nextAsset);
  }

  function restore(nextAsset: LocalAsset | null) {
    assetRef.current = nextAsset;
    setAsset(nextAsset);
  }

  function clear() {
    if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    assetRef.current = null;
    setAsset(null);
  }

  return { asset, clear, restore, select };
}

type CustomFontAsset = {
  family: string;
  name: string;
  url: string;
};

function useCustomFont() {
  const [font, setFont] = useState<CustomFontAsset | null>(null);
  const fontRef = useCommittedRef(font);

  useMountEffect(
    () => () => {
      if (fontRef.current?.url.startsWith('blob:')) URL.revokeObjectURL(fontRef.current.url);
    }
  );

  async function load(name: string, url: string) {
    if (fontRef.current?.url.startsWith('blob:')) URL.revokeObjectURL(fontRef.current.url);
    const family = `Studio-${crypto.randomUUID()}`;
    const loadedFont = new FontFace(family, `url(${url})`);
    await loadedFont.load();
    document.fonts.add(loadedFont);
    const next = { family, name, url };
    fontRef.current = next;
    setFont(next);
  }

  async function select(file: File) {
    await load(file.name, await blobToDataUrl(file));
  }

  async function restore(asset: Pick<CustomFontAsset, 'name' | 'url'> | null) {
    if (!asset) {
      fontRef.current = null;
      setFont(null);
      return;
    }
    await load(asset.name, asset.url);
  }

  return { font, restore, select };
}

function ToolShell({
  actions,
  children,
  inspector,
  library,
  sourceCode,
  tool,
}: {
  actions?: ReactNode;
  children: ReactNode;
  inspector: ReactNode;
  library?: ReactNode;
  sourceCode?: {
    format: string;
    onApply: (source: string) => Promise<void> | void;
    source: string | null;
    title?: string;
  };
  tool: StudioTool;
}) {
  const gt = useGT();
  const [sourceOpen, setSourceOpen] = useState(false);

  const sourceReady = sourceCode?.source !== null && sourceCode?.source !== undefined;

  useEffect(() => registerStudioAutomation({
    actions: sourceReady
      ? ['source.read', 'source.apply', 'controls.list', 'control.activate', 'control.set']
      : ['controls.list', 'control.activate', 'control.set'],
    applySource: sourceReady ? sourceCode?.onApply : undefined,
    getSource: sourceReady ? () => sourceCode!.source! : undefined,
    toolId: tool.id,
  }), [sourceCode, sourceReady, tool.id]);

  return (
    <div className='tool-shell h-full min-h-0'>
      <StudioToolHeader
        actions={actions || sourceCode ? (
          <>
            {sourceCode ? <SourceCodeButton disabled={!sourceReady} onClick={() => setSourceOpen(true)} /> : null}
            {actions}
          </>
        ) : undefined}
        metadata={gt(tool.description)}
        title={gt(tool.name)}
        toolId={tool.id}
      />
      <div className={`tool-body${library ? ' tool-lab-body lab-workspace' : ''}`}>
        {library ? (
          <StudioSidebar
            className='tool-library min-h-0'
            kind='library'
            label={gt(`${tool.name} library`)}
            storageKey={`tool-${tool.id}-library`}
          >
            {library}
          </StudioSidebar>
        ) : (
          <StudioSidebar
            className='tool-inspector min-h-0'
            label={gt(`${tool.name} controls`)}
            storageKey={`tool-${tool.id}`}
          >
            {inspector}
          </StudioSidebar>
        )}
        <div className='tool-canvas studio-scroll-area min-h-0 overflow-auto'>{children}</div>
        {library ? (
          <StudioSidebar
            className='tool-inspector min-h-0'
            label={gt(`${tool.name} controls`)}
            side='right'
            storageKey={`tool-${tool.id}-inspector`}
          >
            {inspector}
          </StudioSidebar>
        ) : null}
        {sourceCode && sourceReady && sourceOpen ? (
          <SourceCodeDrawer
            format={sourceCode.format}
            key={tool.id}
            onApply={sourceCode.onApply}
            onClose={() => setSourceOpen(false)}
            source={sourceCode.source!}
            title={sourceCode.title ?? gt(`${tool.name} source`)}
          />
        ) : null}
      </div>
    </div>
  );
}

function ControlSection({ children, title }: { children: ReactNode; title: ReactNode }) {
  return (
    <LabInspectorSection className='tool-control-section' title={title}>
      {children}
    </LabInspectorSection>
  );
}

function Field({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <label className='flex flex-col gap-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      {children}
    </label>
  );
}

function RangeField({
  label,
  max,
  min,
  onChange,
  onChangeEnd,
  onChangeStart,
  step = 1,
  suffix = '',
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onChangeEnd?: () => void;
  onChangeStart?: () => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  const resolvedValue = Math.min(value, max);
  return (
    <label className='flex flex-col gap-2 text-sm text-muted-foreground'>
      <StudioRangeLabel
        label={label}
        value={<output className='font-mono text-xs tabular-nums'>{resolvedValue}{suffix}</output>}
      />
      <StudioRange
        max={max}
        min={min}
        onBlur={onChangeEnd}
        onChange={(event) => onChange(Number(event.target.value))}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp'].includes(event.key)) onChangeStart?.();
        }}
        onKeyUp={(event) => {
          if (['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp'].includes(event.key)) onChangeEnd?.();
        }}
        onPointerCancel={onChangeEnd}
        onPointerDown={onChangeStart}
        onPointerUp={onChangeEnd}
        step={step}
        value={resolvedValue}
      />
    </label>
  );
}

function SegmentedChoice<T extends string | number>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel?: string;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  const gt = useGT();

  return (
    <div
      aria-label={ariaLabel ? gt(ariaLabel) : undefined}
      className='grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border'
      role={ariaLabel ? 'group' : undefined}
    >
      {options.map((option) => (
        <Button
          aria-pressed={value === option.value}
          className='rounded-none border-0'
          key={option.value}
          onClick={() => onChange(option.value)}
          size='sm'
          type='button'
          variant={value === option.value ? 'default' : 'secondary'}
        >
          {gt(option.label)}
        </Button>
      ))}
    </div>
  );
}

function UploadField({
  accept,
  fileName,
  label,
  onFile,
}: {
  accept: string;
  fileName?: string;
  label: string;
  onFile: (file: File) => void;
}) {
  const gt = useGT();

  return (
    <label className='flex min-h-20 cursor-pointer items-center gap-3 rounded-md border border-dashed border-input p-3 hover:bg-muted'>
      <Upload className='size-4 shrink-0' aria-hidden='true' />
      <span className='min-w-0 flex-1'>
        <span className='block text-sm font-medium'>{gt(label)}</span>
        <span className='block truncate text-xs text-muted-foreground'>
          {fileName ?? gt('Choose a local file')}
        </span>
      </span>
      <input
        accept={accept}
        className='sr-only'
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
        type='file'
      />
    </label>
  );
}

function PreviewLabel({ children }: { children: ReactNode }) {
  return (
    <div className='absolute top-3 left-3 rounded-md border border-border bg-background/90 px-2 py-1 font-mono text-xs text-muted-foreground backdrop-blur'>
      {children}
    </div>
  );
}

function splitLines(value: string, limit: number, maximumLines = 3): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  for (const [index, word] of words.entries()) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > limit) {
      if (lines.length === maximumLines) {
        const lastLine = lines.at(-1);
        if (lastLine && index < words.length) {
          lines[lines.length - 1] = `${lastLine.replace(/[.\u2026]+$/, '')}\u2026`;
        }
        break;
      }
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }

  return lines;
}

function monogramDataUrl(identity: BrandIdentity, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="none"/><text x="256" y="310" text-anchor="middle" fill="${color}" font-family="Switzer, Arial, sans-serif" font-size="180" font-weight="550">${escapeXml(identity.shortName)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const OPEN_GRAPH_TITLES: Readonly<Record<string, string>> = {
  basement: 'Cool work that performs.',
  cloudflare: 'A better Internet, built everywhere.',
  gt: 'Every language. One source.',
  mintlify: 'Documentation that works for everyone.',
  ramp: 'Save time. Save money.',
  starter: 'Make the signal visible.',
  stripe: 'Build the internet economy.',
  tailwind: 'Build anything. Directly in your markup.',
  viteplus: 'One toolchain for the web.',
};

function openGraphDefaultAssetId(identity: BrandIdentity): string {
  const preferredIds: Readonly<Record<BrandIdentity['artDirection']['preview'], string[]>> = {
    'economic-ledger': ['library-editorial', 'library-detail', 'library-overview'],
    'editorial-interruption': ['library-editorial', 'library-overview', 'library-detail'],
    'focus-window': ['library-overview', 'library-editorial', 'library-detail'],
    'knowledge-beam': [],
    'network-horizon': ['library-overview', 'library-detail', 'library-atmosphere'],
    'programmable-field': ['library-overview', 'library-interface', 'library-detail'],
    'translation-frame': [],
    'unified-terminal': ['library-overview', 'library-atmosphere', 'library-detail'],
    'utility-wave': [],
  };
  const availableAssets = [...identity.assets, ...identity.proofAssets];

  return preferredIds[identity.artDirection.preview]
    .find((id) => availableAssets.some((asset) => asset.id === id)) ?? '';
}

function openGraphPanelColor(identity: BrandIdentity, background: string): string {
  const emphasis = identity.colors.find(({ id }) => id === 'emphasis')?.hex;
  const muted = identity.colors.find(({ id }) => id === 'muted')?.hex;
  const recipe = identity.artDirection.preview;

  if (recipe === 'translation-frame') return '#101010';
  if (recipe === 'knowledge-beam') return '#0C2F25';
  if (recipe === 'utility-wave') return '#0F172A';
  if (recipe === 'unified-terminal') return '#17131D';
  if (recipe === 'programmable-field') return emphasis ?? '#635BFF';
  if (recipe === 'network-horizon') return emphasis ?? '#F48120';
  if (recipe === 'focus-window') return emphasis ?? '#2F6BFF';
  if (recipe === 'editorial-interruption') return muted ?? '#E9E6DE';
  return muted ?? background;
}

function openGraphDefaultSurface(
  identity: BrandIdentity
): 'light' | 'dark' {
  return [
    'knowledge-beam',
    'translation-frame',
    'utility-wave',
  ].includes(identity.artDirection.preview)
    ? 'dark'
    : 'light';
}

function openGraphDefaultFontRole(identity: BrandIdentity): BrandTypography['role'] {
  return identity.artDirection.preview === 'knowledge-beam' ? 'Body' : 'Display';
}

function openGraphDraftDefaults(identity: BrandIdentity) {
  const fontRole = openGraphDefaultFontRole(identity);
  return {
    backgroundId: openGraphDefaultAssetId(identity) || 'none',
    fontRole,
    fontWeight: brandTypographyRole(identity, fontRole).weight ?? MAX_VISIBLE_FONT_WEIGHT,
    title: OPEN_GRAPH_TITLES[identity.id] ?? identity.tagline,
  };
}

function openGraphPanelIsDark(identity: BrandIdentity): boolean {
  return [
    'focus-window',
    'knowledge-beam',
    'network-horizon',
    'programmable-field',
    'translation-frame',
    'unified-terminal',
    'utility-wave',
  ].includes(identity.artDirection.preview);
}

function resolveOpenGraphBackgroundId(
  options: ReturnType<typeof templateBackgroundOptions>,
  requestedId: string,
  defaultId: string
): string {
  if (requestedId === 'none') return '';
  if (options.some(({ id }) => id === requestedId)) return requestedId;
  if (options.some(({ id }) => id === defaultId)) return defaultId;
  return options[0]?.id ?? '';
}

function resolveOpenGraphSurfaceColors(
  identity: BrandIdentity,
  surface: 'light' | 'dark'
) {
  const ink = identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B';
  const paper = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  return {
    background: surface === 'dark' ? ink : paper,
    foreground: surface === 'dark' ? paper : ink,
    ink,
    paper,
  };
}

function resolveOpenGraphTitleLayout(identity: BrandIdentity, title: string) {
  const recipe = identity.artDirection.preview;
  const trimmedTitle = title.trim();
  let titleLines: string[];
  if (identity.id === 'gt' && trimmedTitle === OPEN_GRAPH_TITLES.gt) {
    titleLines = ['Every language.', 'One source.'];
  } else if (identity.id === 'stripe' && trimmedTitle === OPEN_GRAPH_TITLES.stripe) {
    titleLines = ['Build the internet', 'economy.'];
  } else if (recipe === 'utility-wave' && trimmedTitle === 'Build anything. Directly in your markup.') {
    titleLines = ['Build anything.', 'Directly in your markup.'];
  } else {
    const maximumCharacters = recipe === 'economic-ledger'
      ? 17
      : recipe === 'knowledge-beam'
        ? 26
        : 22;
    titleLines = splitLines(title, maximumCharacters, 2);
  }
  const longestLine = Math.max(...titleLines.map((line) => line.length), 1);
  const fontSize = longestLine > 20 ? 48 : longestLine > 17 ? 52 : 56;
  return {
    titleFontSize: fontSize,
    titleLineHeight: Math.round(fontSize * 1.04),
    titleLines,
  };
}

function resolveOpenGraphProof(identity: BrandIdentity): string {
  if (identity.id === 'gt') return identity.website;
  return identity.proof[0] ?? identity.products[0] ?? '';
}

function resolveOpenGraphProofChip(
  dark: boolean,
  emphasis: string,
  ink: string,
  paper: string
) {
  const background = dark && emphasis === ink ? paper : emphasis;
  return {
    proofChipBackground: background,
    proofChipForeground: resolveReadableColor(background, ink).color,
  };
}

function resolveOpenGraphAssetUrl(
  uploadedUrl: string | undefined,
  libraryUrl: string | undefined,
  fallbackUrl: string | null = null
): string | null {
  return uploadedUrl ?? libraryUrl ?? fallbackUrl;
}

function resolveOpenGraphAtmosphere(
  hasUploadedBackground: boolean,
  hasLibraryBackground: boolean,
  recipe: BrandIdentity['artDirection']['preview']
) {
  const useGeneratedAtmosphere = !hasUploadedBackground && !hasLibraryBackground;
  return {
    usesMintlifyAtmosphere: useGeneratedAtmosphere && recipe === 'knowledge-beam',
    usesTailwindAtmosphere: useGeneratedAtmosphere && recipe === 'utility-wave',
  };
}

function resolveOpenGraphLogoFallback(
  identity: BrandIdentity,
  surface: 'light' | 'dark',
  foreground: string
): string {
  const assetId = surface === 'dark' ? 'mark-light' : 'mark-dark';
  return brandAssetPath(identity, assetId) ?? monogramDataUrl(identity, foreground);
}

function resolveOpenGraphPreviewMark(
  uploadedUrl: string | undefined,
  libraryUrl: string | undefined,
  identity: BrandIdentity,
  surface: 'light' | 'dark',
  foreground: string
): string {
  return uploadedUrl
    ?? libraryUrl
    ?? resolveOpenGraphLogoFallback(identity, surface, foreground);
}

function OpenGraphBackgroundAssetField({
  effectiveId,
  onChange,
  options,
  selectedId,
}: {
  effectiveId: string;
  onChange: (value: string) => void;
  options: ReturnType<typeof templateBackgroundOptions>;
  selectedId: string;
}) {
  const gt = useGT();
  if (options.length === 0) return null;
  return (
    <Field label={<T>Identity evidence</T>}>
      <StudioSelect
        ariaLabel='Identity evidence'
        onValueChange={onChange}
        options={[
          { label: gt('No supporting image'), value: 'none' },
          ...options.map((asset) => ({ label: asset.label, value: asset.id })),
        ]}
        value={selectedId === 'none' ? 'none' : effectiveId}
      />
    </Field>
  );
}

function OpenGraphLogoAssetField({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: BrandIdentity['assets'];
  value: string;
}) {
  if (options.length === 0) return null;
  return (
    <Field label={<T>Brand logo asset</T>}>
      <StudioSelect
        ariaLabel='Brand logo asset'
        onValueChange={onChange}
        options={options.map((asset) => ({ label: asset.label, value: asset.id }))}
        value={value}
      />
    </Field>
  );
}

function OpenGraphTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:opengraph`);
  const [documentCreatedAt] = useState(() => new Date().toISOString());
  const backgroundAsset = useLocalAsset();
  const customFont = useCustomFont();
  const logoAsset = useLocalAsset();
  const backgroundOptions = useMemo(
    () => templateBackgroundOptions(identity).filter(
      (asset) => identity.id !== 'ramp' || asset.tags?.includes('source-native')
    ),
    [identity]
  );
  const logoOptions = identity.assets.filter(({ type }) => type === 'logo' || type === 'icon');
  const defaultSurface = openGraphDefaultSurface(identity);
  const recipe = identity.artDirection.preview;
  const defaults = openGraphDraftDefaults(identity);
  const [title, setTitle] = useStudioDraft(
    identity.id,
    tool.id,
    'identity-title-v3',
    defaults.title
  );
  const [surface, setSurface] = useStudioDraft<'light' | 'dark'>(
    identity.id,
    tool.id,
    'identity-surface-v2',
    defaultSurface
  );
  const [libraryBackgroundId, setLibraryBackgroundId] = useStudioDraft(
    identity.id,
    tool.id,
    'identity-media-v8',
    defaults.backgroundId
  );
  const [libraryLogoId, setLibraryLogoId] = useStudioDraft(
    identity.id,
    tool.id,
    'identity-logo-v2',
    defaultSurface === 'dark' ? 'mark-light' : 'mark-dark'
  );
  const [fontRole, setFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'font-role-v2', defaults.fontRole);
  const [fontWeight, setFontWeight] = useStudioDraft(identity.id, tool.id, 'font-weight-v2', defaults.fontWeight);
  const [backgroundOpacity, setBackgroundOpacity] = useStudioDraft(identity.id, tool.id, 'media-opacity-v2', 100);
  const [backgroundX, setBackgroundX] = useStudioDraft(identity.id, tool.id, 'media-x-v2', 0);
  const [backgroundY, setBackgroundY] = useStudioDraft(identity.id, tool.id, 'media-y-v2', 0);
  const [backgroundScale, setBackgroundScale] = useStudioDraft(identity.id, tool.id, 'media-scale-v2', 100);
  const [logoX, setLogoX] = useStudioDraft(identity.id, tool.id, 'logo-x', 0);
  const [logoY, setLogoY] = useStudioDraft(identity.id, tool.id, 'logo-y', 0);
  const [logoScale, setLogoScale] = useStudioDraft(identity.id, tool.id, 'logo-scale', 100);
  const [logoAppearance, setLogoAppearance] = useStudioDraft<LogoAppearanceSettings>(identity.id, tool.id, 'logo-appearance', DEFAULT_LOGO_APPEARANCE);
  const [logoSelected, setLogoSelected] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const { background, foreground, ink, paper } = resolveOpenGraphSurfaceColors(identity, surface);
  const defaultBackgroundId = openGraphDefaultAssetId(identity);
  const effectiveBackgroundId = resolveOpenGraphBackgroundId(
    backgroundOptions,
    libraryBackgroundId,
    defaultBackgroundId
  );
  const selectedBackground = backgroundOptions.find(({ id }) => id === effectiveBackgroundId);
  const selectedLogo = logoOptions.find(({ id }) => id === libraryLogoId);
  const selectedTypography = brandTypographyRole(identity, fontRole);
  const selectedBrandFont = brandFontAssets(identity).find(({ id }) => id === selectedTypography.fontId);
  const { usesMintlifyAtmosphere, usesTailwindAtmosphere } = resolveOpenGraphAtmosphere(
    Boolean(backgroundAsset.asset),
    Boolean(selectedBackground),
    recipe
  );
  const panelColor = openGraphPanelColor(identity, background);
  const panelForeground = openGraphPanelIsDark(identity) ? paper : ink;
  const emphasis = identity.colors.find(({ id }) => id === 'emphasis')?.hex ?? foreground;
  const proof = resolveOpenGraphProof(identity);
  const { proofChipBackground, proofChipForeground } = resolveOpenGraphProofChip(
    openGraphPanelIsDark(identity),
    emphasis,
    ink,
    paper
  );
  const { titleFontSize, titleLineHeight, titleLines } = resolveOpenGraphTitleLayout(
    identity,
    title
  );
  const promiseLines = splitLines(identity.strategy.promise, 44, 3);
  const previewMarkSource = resolveOpenGraphPreviewMark(
    logoAsset.asset?.url,
    selectedLogo?.path,
    identity,
    surface,
    foreground
  );
  const previewBackgroundSource = resolveOpenGraphAssetUrl(
    backgroundAsset.asset?.url,
    selectedBackground?.path
  );
  const previewFontSource = resolveOpenGraphAssetUrl(customFont.font?.url, selectedBrandFont?.path);
  const openGraphState = useMemo(() => ({
    background: {
      asset: backgroundAsset.asset,
      assetId: libraryBackgroundId === 'none' ? 'none' : effectiveBackgroundId,
      opacity: backgroundOpacity,
      scale: backgroundScale,
      x: backgroundX,
      y: backgroundY,
    },
    fontRole,
    fontWeight,
    logo: {
      appearance: logoAppearance,
      asset: logoAsset.asset,
      assetId: libraryLogoId,
      scale: logoScale,
      x: logoX,
      y: logoY,
    },
    customFont: customFont.font ? { name: customFont.font.name, url: customFont.font.url } : null,
    surface,
    title,
  }), [
    backgroundAsset.asset,
    backgroundOpacity,
    backgroundScale,
    backgroundX,
    backgroundY,
    customFont.font,
    effectiveBackgroundId,
    fontRole,
    fontWeight,
    libraryBackgroundId,
    libraryLogoId,
    logoAppearance,
    logoAsset.asset,
    logoScale,
    logoX,
    logoY,
    surface,
    title,
  ]);
  const openGraphRevision = useMemo(() => JSON.stringify(openGraphState), [openGraphState]);
  const openGraphDocument = useMemo(() => createStudioCanvasDocument({
    background,
    brandId: identity.id,
    createdAt: documentCreatedAt,
    height: 630,
    id: `${identity.id}:${tool.id}:opengraph`,
    layers: [
      ...(previewBackgroundSource ? [{
        asset: {
          name: backgroundAsset.asset?.name ?? selectedBackground?.label ?? 'OpenGraph background',
          source: previewBackgroundSource,
        },
        bounds: { height: 630, rotation: 0, width: 1200, x: 0, y: 0 },
        id: 'opengraph-background',
        kind: 'image' as const,
        name: 'Supporting image',
        opacity: backgroundOpacity / 100,
      }] : []),
      {
        asset: {
          name: logoAsset.asset?.name ?? selectedLogo?.label ?? `${identity.name} mark`,
          source: previewMarkSource,
        },
        bounds: {
          height: 52 * logoScale / 100,
          rotation: 0,
          width: 52 * logoScale / 100,
          x: 72 + logoX + 26 * (1 - logoScale / 100),
          y: 64 + logoY + 26 * (1 - logoScale / 100),
        },
        data: { appearance: logoAppearance },
        id: 'opengraph-logo',
        kind: 'logo' as const,
        name: 'Brand mark',
      },
      {
        bounds: { height: 260, rotation: 0, width: 760, x: 72, y: 190 },
        content: title,
        id: 'opengraph-title',
        kind: 'text' as const,
        name: 'Headline',
      },
      ...(previewFontSource ? [{
        asset: {
          kind: 'font' as const,
          name: customFont.font?.name ?? selectedBrandFont?.label ?? 'OpenGraph font',
          source: previewFontSource,
        },
        bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 },
        hidden: true,
        id: 'opengraph-font',
        kind: 'component' as const,
        name: 'Headline font',
      }] : []),
    ],
    revision: canvasRevisionFromSignature(openGraphRevision),
    state: openGraphState,
    title: `${identity.name} ${tool.name}`,
    toolId: tool.id,
    updatedAt: documentCreatedAt,
    width: 1200,
  }), [
    background,
    backgroundAsset.asset,
    backgroundOpacity,
    customFont.font,
    documentCreatedAt,
    identity.id,
    identity.name,
    logoAppearance,
    logoAsset.asset,
    logoScale,
    logoX,
    logoY,
    openGraphRevision,
    openGraphState,
    previewBackgroundSource,
    previewFontSource,
    previewMarkSource,
    selectedBackground?.label,
    selectedBrandFont?.label,
    selectedLogo?.label,
    title,
    tool.id,
    tool.name,
  ]);
  const openGraphWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identity.id, tool.id),
    [identity.id, tool.id]
  );
  const portableOpenGraph = usePortableCanvasWorkspace({
    applySource: applySourceCode,
    document: openGraphDocument,
    workspaceKey: openGraphWorkspaceKey,
  });
  const sourceCode = portableOpenGraph.source;
  const portableOpenGraphDocument = portableOpenGraph.document;
  const resolvedPreviewMark = canvasElementAssetSource(
    portableOpenGraphDocument,
    'opengraph-logo',
    previewMarkSource
  )!;
  const resolvedPreviewBackground = canvasElementAssetSource(
    portableOpenGraphDocument,
    'opengraph-background',
    previewBackgroundSource
  );
  const resolvedPreviewFont = canvasElementAssetSource(
    portableOpenGraphDocument,
    'opengraph-font',
    previewFontSource
  );
  const openGraphAutosaveState = portableOpenGraph.autosaveState;

  async function applySourceCode(source: string) {
    const next = parseOpenGraphWorkspaceSource(source, tool.id, {
      allowedFontRoles: identity.typography.map(({ role }) => role),
      background: {
        assetId: libraryBackgroundId,
        opacity: backgroundOpacity,
        scale: backgroundScale,
        x: backgroundX,
        y: backgroundY,
      },
      fontRole,
      fontWeight,
      logo: {
        appearance: logoAppearance,
        assetId: libraryLogoId,
        scale: logoScale,
        x: logoX,
        y: logoY,
      },
      surface,
      title,
    });
    setTitle(next.title);
    setSurface(next.surface);
    setFontRole(next.fontRole);
    setFontWeight(next.fontWeight);
    if (next.background) {
      setLibraryBackgroundId(next.background.assetId);
      setBackgroundOpacity(next.background.opacity);
      setBackgroundScale(next.background.scale);
      setBackgroundX(next.background.x);
      setBackgroundY(next.background.y);
      backgroundAsset.restore(next.background.asset);
    }
    if (next.logo) {
      setLibraryLogoId(next.logo.assetId);
      setLogoScale(next.logo.scale);
      setLogoX(next.logo.x);
      setLogoY(next.logo.y);
      setLogoAppearance(next.logo.appearance);
      logoAsset.restore(next.logo.asset);
    }
    await customFont.restore(next.customFont);
  }

  function openGraphSvg(mark: string, backgroundImage: string | null, fontData: string | null) {
    return buildOpenGraphSvg({
      background,
      backgroundImage,
      backgroundOpacity,
      backgroundScale,
      backgroundX,
      backgroundY,
      fontData,
      fontFamily: brandTypographyFamily(identity, fontRole),
      fontWeight: capVisibleFontWeight(fontWeight),
      foreground,
      identityId: identity.id,
      logoAppearance,
      logoScale,
      logoSource: mark,
      logoX,
      logoY,
      panelColor,
      panelForeground,
      promiseLines,
      proof,
      proofChipBackground,
      proofChipForeground,
      recipe,
      titleFontSize,
      titleLineHeight,
      titleLines,
      usesMintlifyAtmosphere,
      usesTailwindAtmosphere,
      website: identity.website,
    });
  }

  const previewSvg = openGraphSvg(
    resolvedPreviewMark,
    resolvedPreviewBackground,
    resolvedPreviewFont
  );

  async function exportOpenGraph() {
    if (!portableOpenGraphDocument) throw new Error('Portable OpenGraph assets are still being prepared.');
    setExporting(true);
    studioExport.start('Rendering OpenGraph PNG preview');
    try {
      const blob = await svgToPngBlob(previewSvg, 1200, 630);
      setLastExport({ blob, fileName: 'studio-opengraph.png', format: 'PNG', height: 630, width: 1200 });
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  const inspector = (
    <>
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Headline</T>}>
          <textarea className={TEXTAREA_CLASS} onChange={(event) => setTitle(event.target.value)} value={title} />
        </Field>
        <Field label={<T>Typography role</T>}>
          <StudioSelect ariaLabel='OpenGraph typography role' onValueChange={(value) => { const role = value as BrandTypography['role']; setFontRole(role); setFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={fontRole} />
        </Field>
        <RangeField label={<T>Font weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setFontWeight} step={50} value={fontWeight} />
      </ControlSection>
      <ControlSection title={<T>Surface</T>}>
        <SegmentedChoice
          onChange={setSurface}
          options={[
            { label: 'Base white', value: 'light' },
            { label: 'Base dark', value: 'dark' },
          ]}
          value={surface}
        />
        <UploadField
          accept='image/*'
          fileName={backgroundAsset.asset?.name}
          label='Add supporting image'
          onFile={backgroundAsset.select}
        />
        <OpenGraphBackgroundAssetField
          effectiveId={effectiveBackgroundId}
          onChange={setLibraryBackgroundId}
          options={backgroundOptions}
          selectedId={libraryBackgroundId}
        />
        {backgroundAsset.asset || selectedBackground ? (
          <div className='flex flex-col gap-4 border-t border-border pt-4'>
            <p className='text-xs font-semibold'><T>Supporting image</T></p>
            <RangeField label={<T>Opacity</T>} max={100} min={0} onChange={setBackgroundOpacity} suffix='%' value={backgroundOpacity} />
            <RangeField label={<T>Horizontal</T>} max={100} min={-100} onChange={setBackgroundX} suffix='%' value={backgroundX} />
            <RangeField label={<T>Vertical</T>} max={100} min={-100} onChange={setBackgroundY} suffix='%' value={backgroundY} />
            <RangeField label={<T>Scale</T>} max={240} min={50} onChange={setBackgroundScale} suffix='%' value={backgroundScale} />
          </div>
        ) : null}
        <UploadField
          accept='image/*'
          fileName={logoAsset.asset?.name}
          label='Replace logo'
          onFile={logoAsset.select}
        />
        <OpenGraphLogoAssetField
          onChange={setLibraryLogoId}
          options={logoOptions}
          value={libraryLogoId}
        />
        <UploadField
          accept='.otf,.ttf,.woff,.woff2,font/*'
          fileName={customFont.font ? gt('Custom font loaded') : undefined}
          label='Add font file'
          onFile={customFont.select}
        />
      </ControlSection>
      <ControlSection title={<T>Logo placement</T>}>
        <RangeField label={<T>Horizontal</T>} max={240} min={-240} onChange={setLogoX} suffix='px' value={logoX} />
        <RangeField label={<T>Vertical</T>} max={180} min={-180} onChange={setLogoY} suffix='px' value={logoY} />
        <RangeField label={<T>Scale</T>} max={220} min={40} onChange={setLogoScale} suffix='%' value={logoScale} />
        <LogoAppearanceControls onChange={(patch) => setLogoAppearance((current) => ({ ...current, ...patch }))} settings={{ ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance }} />
        <CanvasLayerPanel
          layers={[{ canMoveBackward: false, canMoveForward: false, id: 'logo', label: gt('Logo'), transform: { scale: logoScale / 100, x: logoX, y: logoY } }]}
          onAlign={(alignment) => {
            const next = alignCanvasLayer({ scale: logoScale / 100, x: logoX, y: logoY }, { baseHeight: 52, baseWidth: 52, baseX: 72, baseY: 64 }, 1200, 630, alignment);
            setLogoX(next.x); setLogoY(next.y); setLogoScale(Math.round(next.scale * 100));
          }}
          onMove={() => undefined}
          onReset={() => { setLogoX(0); setLogoY(0); setLogoScale(100); }}
          onSelect={() => setLogoSelected(true)}
          selectedLayerId={logoSelected ? 'logo' : null}
        />
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <>
          <DesignVersionControls
            autosaveState={openGraphAutosaveState}
            identityId={identity.id}
            onOpen={applySourceCode}
            revision={String(openGraphDocument.revision)}
            source={() => sourceCode}
            toolId={tool.id}
            workspaceLabel={tool.name}
          />
          <ExportPreview asset={lastExport} />
          <Button disabled={exporting || !portableOpenGraphDocument} onClick={exportOpenGraph} type='button'>
            <Download aria-hidden='true' />
            <T>Export PNG</T>
          </Button>
        </>
      }
      inspector={inspector}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('OpenGraph source') }}
      tool={tool}
    >
      <CanvasViewport fontFamily={brandTypographyFamily(identity, fontRole)} fontWeight={capVisibleFontWeight(fontWeight)} identityId={identity.id} onDeselect={() => setLogoSelected(false)} stageClassName='grid min-h-full place-items-center p-6 lg:p-10' toolId={tool.id}>
        <CanvasArtboard
          aria-label={gt('OpenGraph canvas')}
          className='overflow-hidden rounded-md'
          frameClassName='artifact-preview w-full max-w-5xl smooth-shadow-ring-sm'
          height={630}
          onPointerDown={() => setLogoSelected(false)}
          role='group'
          width={1200}
        >
          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 [&>svg]:size-full'
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />
          <EditableCanvasLayer
            baseHeight={52}
            baseWidth={52}
            baseX={72}
            baseY={64}
            canvasHeight={630}
            canvasWidth={1200}
            label={gt('Logo')}
            onChange={(next) => { setLogoX(next.x); setLogoY(next.y); setLogoScale(Math.round(next.scale * 100)); }}
            onDeselect={() => setLogoSelected(false)}
            onSelect={() => setLogoSelected(true)}
            selected={logoSelected}
            transform={{ scale: logoScale / 100, x: logoX, y: logoY }}
            zIndex={4}
          >
            <span aria-hidden='true' className='block size-full' />
          </EditableCanvasLayer>
          <PreviewLabel>1200 × 630</PreviewLabel>
        </CanvasArtboard>
      </CanvasViewport>
    </ToolShell>
  );
}

function SurfaceTool({ active, identity, tool }: { active: boolean; identity: BrandIdentity; tool: StudioTool }) {
  return <BackgroundStudio active={active} identity={identity} tool={{ ...tool, id: 'backgrounds' }} />;
}

function MaterialTool({ active, identity, onIdentitySave, tool }: { active: boolean; identity: BrandIdentity; onIdentitySave: (identity: BrandIdentity) => void; tool: StudioTool }) {
  return <LogoShaderStudio active={active} identity={identity} onIdentitySave={onIdentitySave} tool={{ ...tool, id: 'logo-shader' }} />;
}

type EditableColor = {
  hex: string;
  id: string;
  name: string;
  opacity: number;
  role: string;
};

function sanitizeEditableColors(
  value: unknown,
  fallbacks: BrandIdentity['colors']
): EditableColor[] {
  const candidates = Array.isArray(value) && value.length > 0 ? value : fallbacks;
  return candidates.map((candidate, index) => {
    const source = candidate && typeof candidate === 'object'
      ? candidate as Partial<EditableColor>
      : {};
    const fallback = fallbacks[index];
    const opacity = typeof source.opacity === 'number' && Number.isFinite(source.opacity)
      ? Math.min(100, Math.max(0, source.opacity))
      : 100;
    return {
      hex: normalizeHexOrFallback(source.hex, fallback?.hex ?? '#000000'),
      id: typeof source.id === 'string' ? source.id : fallback?.id ?? `color-${index + 1}`,
      name: typeof source.name === 'string' ? source.name : fallback?.name ?? `Color ${index + 1}`,
      opacity,
      role: typeof source.role === 'string' ? source.role : fallback?.role ?? '',
    };
  });
}

function clonePalette(palette: EditableColor[]) {
  return palette.map((color) => ({ ...color }));
}

function palettesMatch(first: EditableColor[], second: EditableColor[]) {
  return JSON.stringify(first) === JSON.stringify(second);
}

function ColorTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const [storedColors, setColors] = useStudioDraft<EditableColor[]>(
    identity.id,
    tool.id,
    'colors',
    () => identity.colors.map(({ hex, id, name, role }) => ({ hex, id, name, opacity: 100, role }))
  );
  const colors = useMemo(
    () => sanitizeEditableColors(storedColors, identity.colors),
    [identity.colors, storedColors]
  );
  const colorsRef = useCommittedRef(colors);
  const editBaselineRef = useRef<EditableColor[] | null>(null);
  const undoStackRef = useRef<EditableColor[][]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  useEffect(() => {
    if (JSON.stringify(storedColors) !== JSON.stringify(colors)) setColors(colors);
  }, [colors, setColors, storedColors]);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contrastIndex, setContrastIndex] = useState(() => Math.min(1, identity.colors.length - 1));
  const [previewSurface, setPreviewSurface] = useState<'paper' | 'ink' | 'grid'>('paper');
  const [colorPopover, setColorPopover] = useState<{ left: number; top: number } | null>(null);
  const colorCanvasRef = useRef<HTMLDivElement>(null);
  const sourceCode = stringifySource({ colors });
  const resolvedSelectedIndex = Math.min(selectedIndex, Math.max(0, colors.length - 1));
  const selectedColor = colors[resolvedSelectedIndex] ?? { hex: '#000000', name: 'Color', opacity: 100, role: '' };
  const selectedOklch = hexToOklch(selectedColor.hex);
  const draftColorByIdentityId = (id: string, fallback: string) => {
    const identityIndex = identity.colors.findIndex((color) => color.id === id);
    return colors[identityIndex]?.hex ?? identity.colors[identityIndex]?.hex ?? fallback;
  };
  const surfaceBackground = previewSurface === 'ink'
    ? draftColorByIdentityId('ink', '#181818')
    : previewSurface === 'grid'
      ? draftColorByIdentityId('muted', '#F2F2F2')
      : draftColorByIdentityId('paper', '#FFFFFF');
  const selectedBackground = mixHexColors(surfaceBackground, selectedColor.hex, selectedColor.opacity / 100);
  const requestedContrastColor = colors[Math.min(contrastIndex, Math.max(0, colors.length - 1))]?.hex ?? '#FFFFFF';
  const contrastResolution = resolveReadableColor(selectedBackground, requestedContrastColor);
  const contrastColor = contrastResolution.color;
  const contrastRatio = contrastResolution.ratio;
  const actionTextColor = resolveReadableColor(contrastColor, selectedColor.hex).color;
  const darkWordmarkPath = brandAssetPath(identity, 'wordmark');
  const lightWordmarkPath = brandAssetPath(identity, 'wordmark-light');
  const darkMarkPath = brandAssetPath(identity, 'mark-dark');
  const lightMarkPath = brandAssetPath(identity, 'mark-light');
  const useLightLogo = colorContrastRatio(selectedBackground, '#FFFFFF') >= colorContrastRatio(selectedBackground, '#000000');
  const proofLogo = (useLightLogo
    ? [
        { kind: 'wordmark' as const, path: lightWordmarkPath },
        { kind: 'mark' as const, path: lightMarkPath },
        { kind: 'wordmark' as const, path: darkWordmarkPath },
        { kind: 'mark' as const, path: darkMarkPath },
      ]
    : [
        { kind: 'wordmark' as const, path: darkWordmarkPath },
        { kind: 'mark' as const, path: darkMarkPath },
        { kind: 'wordmark' as const, path: lightWordmarkPath },
        { kind: 'mark' as const, path: lightMarkPath },
      ]).find(({ path }) => Boolean(path));

  useEffect(() => {
    if (!colorPopover) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setColorPopover(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [colorPopover]);

  function writePalette(nextPalette: EditableColor[]) {
    const sanitized = sanitizeEditableColors(nextPalette, identity.colors);
    colorsRef.current = sanitized;
    setColors(sanitized);
  }

  function pushUndoSnapshot(snapshot: EditableColor[]) {
    const previous = undoStackRef.current.at(-1);
    if (previous && palettesMatch(previous, snapshot)) return;
    undoStackRef.current = [...undoStackRef.current, clonePalette(snapshot)].slice(-40);
    setUndoDepth(undoStackRef.current.length);
  }

  function beginColorEdit() {
    if (!editBaselineRef.current) editBaselineRef.current = clonePalette(colorsRef.current);
  }

  function patchedSelectedPalette(patch: Partial<EditableColor>) {
    return colorsRef.current.map((color, index) => (
      index === resolvedSelectedIndex ? { ...color, ...patch } : color
    ));
  }

  function previewSelectedColor(patch: Partial<EditableColor>) {
    beginColorEdit();
    const nextPalette = patchedSelectedPalette(patch);
    if (!palettesMatch(colorsRef.current, nextPalette)) writePalette(nextPalette);
  }

  function commitSelectedColor(patch: Partial<EditableColor>) {
    const baseline = editBaselineRef.current ?? clonePalette(colorsRef.current);
    const nextPalette = patchedSelectedPalette(patch);
    editBaselineRef.current = null;
    if (palettesMatch(baseline, nextPalette)) return;
    pushUndoSnapshot(baseline);
    writePalette(nextPalette);
  }

  function finishColorEdit() {
    const baseline = editBaselineRef.current;
    editBaselineRef.current = null;
    if (!baseline || palettesMatch(baseline, colorsRef.current)) return;
    pushUndoSnapshot(baseline);
  }

  function commitPalette(nextPalette: EditableColor[]) {
    const current = clonePalette(colorsRef.current);
    const sanitized = sanitizeEditableColors(nextPalette, identity.colors);
    editBaselineRef.current = null;
    if (palettesMatch(current, sanitized)) return;
    pushUndoSnapshot(current);
    writePalette(sanitized);
  }

  function undoLastColorChange() {
    const previous = undoStackRef.current.at(-1);
    if (!previous) return;
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setUndoDepth(undoStackRef.current.length);
    editBaselineRef.current = null;
    writePalette(previous);
  }

  function openColorPopover(target: HTMLElement, index: number, clientX?: number, clientY?: number) {
    const canvas = colorCanvasRef.current;
    if (!canvas) return;
    const canvasBounds = canvas.getBoundingClientRect();
    const targetBounds = target.getBoundingClientRect();
    const popoverWidth = Math.min(300, Math.max(240, canvasBounds.width - 24));
    const popoverHeight = 430;
    const pointerX = clientX ?? targetBounds.left + targetBounds.width / 2;
    const pointerY = clientY ?? targetBounds.top + targetBounds.height / 2;
    const maximumLeft = Math.max(12, canvasBounds.width - popoverWidth - 12);
    const maximumTop = Math.max(12, canvasBounds.height - popoverHeight - 12);
    setSelectedIndex(index);
    setColorPopover({
      left: Math.min(maximumLeft, Math.max(12, pointerX - canvasBounds.left + 14)),
      top: Math.min(maximumTop, Math.max(12, pointerY - canvasBounds.top + 14)),
    });
  }

  function openColorPopoverFromClick(event: MouseEvent<HTMLElement>, index: number) {
    event.stopPropagation();
    openColorPopover(event.currentTarget, index, event.clientX, event.clientY);
  }

  function applySourceCode(source: string) {
    const value = parseSourceObject(source);
    const nextColors = sourceObjectArray(value, 'colors');
    if (!nextColors) throw new TypeError('colors must be an array of color objects.');
    commitPalette(nextColors.map((color, index) => ({
      hex: normalizeHex(sourceString(color, 'hex', colors[index]?.hex ?? '#000000')),
      id: sourceString(color, 'id', colors[index]?.id ?? `color-${index + 1}`),
      name: sourceString(color, 'name', colors[index]?.name ?? `Color ${index + 1}`),
      opacity: sourceNumber(color, 'opacity', colors[index]?.opacity ?? 100),
      role: sourceString(color, 'role', colors[index]?.role ?? ''),
    })));
  }

  async function copyTokens() {
    const value = colors
      .map(
        (color) =>
          `--color-${color.name.toLocaleLowerCase().replaceAll(' ', '-')}: ${formatOklch(color.hex).replace(')', ` / ${color.opacity ?? 100}%)`)}; /* ${normalizeHex(color.hex)} */`
      )
      .join('\n');
    try {
      await copyTextToClipboard(value);
      setCopyError(false);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }

  const library = (
    <>
      <LabPanelHeading
        description={<T>Select a semantic token to edit and test in context.</T>}
        title={<T>Brand colors</T>}
      />
      <div className='color-lab-library'>
        {colors.map((color, index) => (
          <button
            aria-pressed={selectedIndex === index}
            className='color-lab-token'
            key={color.id}
            onClick={() => {
              setSelectedIndex(index);
              setColorPopover(null);
            }}
            type='button'
          >
            <span style={{ backgroundColor: color.hex }} />
            <span><strong>{color.name}</strong><small>{color.role || formatOklch(color.hex)}</small></span>
            <code>{normalizeHex(color.hex)}</code>
          </button>
        ))}
      </div>
    </>
  );

  const inspector = (
    <>
      <LabPanelHeading
        description={<T>Adjust perceptual channels while keeping production values visible.</T>}
        title={selectedColor.name}
      />
      <LabInspectorSection index='01' meta='OKLCH' title={<T>Color</T>}>
        <ColorControl
          ariaLabel={gt('Change {name}', { name: selectedColor.name })}
          label={<T>Exact color</T>}
          onChange={(hex) => commitSelectedColor({ hex })}
          onOpacityChange={(opacity) => commitSelectedColor({ opacity })}
          onOpacityPreview={(opacity) => previewSelectedColor({ opacity })}
          onPreview={(hex) => previewSelectedColor({ hex })}
          opacity={selectedColor.opacity}
          value={selectedColor.hex}
        />
        <RangeField label={<T>Lightness</T>} max={100} min={0} onChange={(lightness) => previewSelectedColor({ hex: oklchToHex({ ...hexToOklch(colorsRef.current[resolvedSelectedIndex]?.hex ?? selectedColor.hex), lightness: lightness / 100 }) })} onChangeEnd={finishColorEdit} onChangeStart={beginColorEdit} suffix='%' value={Math.round(selectedOklch.lightness * 100)} />
        <RangeField label={<T>Chroma</T>} max={0.4} min={0} onChange={(chroma) => previewSelectedColor({ hex: oklchToHex({ ...hexToOklch(colorsRef.current[resolvedSelectedIndex]?.hex ?? selectedColor.hex), chroma }) })} onChangeEnd={finishColorEdit} onChangeStart={beginColorEdit} step={0.005} value={Number(selectedOklch.chroma.toFixed(3))} />
        <RangeField label={<T>Hue</T>} max={360} min={0} onChange={(hue) => previewSelectedColor({ hex: oklchToHex({ ...hexToOklch(colorsRef.current[resolvedSelectedIndex]?.hex ?? selectedColor.hex), hue }) })} onChangeEnd={finishColorEdit} onChangeStart={beginColorEdit} suffix='°' value={Math.round(selectedOklch.hue)} />
      </LabInspectorSection>
      <LabInspectorSection index='02' meta='Semantic' title={<T>Token</T>}>
        <Field label={<T>Name</T>}><input className={INPUT_CLASS} onBlur={finishColorEdit} onChange={(event) => previewSelectedColor({ name: event.target.value })} onFocus={beginColorEdit} value={selectedColor.name} /></Field>
        <Field label={<T>Role</T>}><textarea className={TEXTAREA_CLASS} onBlur={finishColorEdit} onChange={(event) => previewSelectedColor({ role: event.target.value })} onFocus={beginColorEdit} value={selectedColor.role} /></Field>
      </LabInspectorSection>
      <LabInspectorSection index='03' meta={`${contrastRatio.toFixed(2)}:1`} title={<T>Contrast check</T>}>
        <StudioSelect
          ariaLabel={gt('Contrast color')}
          onValueChange={(value) => setContrastIndex(Number(value))}
          options={colors.map((color, index) => ({ label: color.name, value: String(index) }))}
          value={String(contrastIndex)}
        />
        <p className='lab-section-description'>{contrastRatio >= 4.5 ? <T>Passes WCAG AA for normal text.</T> : contrastRatio >= 3 ? <T>Passes for large text only.</T> : <T>Use this pairing for decoration, not text.</T>}</p>
      </LabInspectorSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <>
          <Button disabled={undoDepth === 0} onClick={undoLastColorChange} title={undoDepth === 0 ? gt('Change a color to enable undo.') : gt('Restore the previous color value.')} type='button' variant='outline'>
            <RotateCcw aria-hidden='true' />
            <T>Undo color</T>
          </Button>
          <Button onClick={() => void copyTokens()} title={copyError ? gt('Clipboard access was denied. Try again.') : undefined} type='button' variant='outline'>
            {copied ? <Check aria-hidden='true' /> : copyError ? <X aria-hidden='true' /> : <Copy aria-hidden='true' />}
            {copied ? <T>Copied</T> : copyError ? <T>Try copy again</T> : <T>Copy tokens</T>}
          </Button>
        </>
      }
      inspector={inspector}
      library={library}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Color system source') }}
      tool={tool}
    >
      <div className='color-lab-stage' data-surface={previewSurface}>
        <div className='color-lab-toolbar'>
          <div>
            <span><T>Live token proof</T></span>
            <strong>{selectedColor.name}</strong>
          </div>
          <div className='color-lab-segmented'>
            {(['paper', 'ink', 'grid'] as const).map((surface) => <button aria-pressed={previewSurface === surface} key={surface} onClick={() => setPreviewSurface(surface)} type='button'>{surface}</button>)}
          </div>
        </div>
        <div className='color-lab-canvas' onClick={() => setColorPopover(null)} ref={colorCanvasRef}>
          <button
            aria-label={gt('Inspect and edit {name}', { name: selectedColor.name })}
            className='color-lab-proof'
            onClick={(event) => openColorPopoverFromClick(event, resolvedSelectedIndex)}
            data-auto-contrast={contrastResolution.fallbackApplied ? 'true' : 'false'}
            style={{ backgroundColor: selectedBackground, color: contrastColor }}
            type='button'
          >
            <span className='color-lab-proof-meta'><span>{selectedColor.role || 'Semantic brand color'}{contrastResolution.fallbackApplied ? ' · Auto contrast' : ''}</span><code>{normalizeHex(selectedColor.hex)}</code></span>
            {proofLogo?.path ? (
              <img
                alt={`${identity.name} ${proofLogo.kind}`}
                className='color-lab-proof-logo'
                data-logo-kind={proofLogo.kind}
                src={proofLogo.path}
              />
            ) : <span className='color-lab-proof-title'>{identity.shortName}</span>}
            <span className='color-lab-proof-description'>{identity.tagline}</span>
            <span className='color-lab-proof-action' style={{ backgroundColor: contrastColor, color: actionTextColor }}><T>Primary action</T></span>
          </button>
          <div className='color-lab-values'>
            <div><span>HEX</span><strong>{normalizeHex(selectedColor.hex)}</strong></div>
            <div><span>OKLCH</span><strong>{formatOklch(selectedColor.hex)}</strong></div>
            <div><span>CONTRAST</span><strong>{contrastRatio.toFixed(2)}:1</strong></div>
          </div>
          <div className='color-lab-ramp' aria-label={gt('Tonal ramp')}>
            {[0.9, 0.72, 0.5, 0.28, 0.12].map((amount) => <span key={`light-${amount}`} style={{ backgroundColor: mixHexColors('#FFFFFF', selectedColor.hex, amount) }} />)}
            {[0.15, 0.32, 0.52, 0.72, 0.88].map((amount) => <span key={`dark-${amount}`} style={{ backgroundColor: mixHexColors(selectedColor.hex, '#000000', amount) }} />)}
          </div>
          <div aria-label={gt('Color token canvas')} className='color-lab-token-map'>
            {colors.map((color, index) => (
              <button
                aria-label={gt('Inspect and edit {name}', { name: color.name })}
                aria-pressed={resolvedSelectedIndex === index}
                key={`${color.id}-canvas`}
                onClick={(event) => openColorPopoverFromClick(event, index)}
                style={{ backgroundColor: color.hex }}
                type='button'
              >
                <span>{color.name}</span>
                <code>{normalizeHex(color.hex)}</code>
              </button>
            ))}
          </div>
          {colorPopover ? (
            <aside
              aria-label={gt('Edit {name}', { name: selectedColor.name })}
              className='color-lab-canvas-popover'
              onClick={(event) => event.stopPropagation()}
              role='region'
              style={{ left: colorPopover.left, top: colorPopover.top }}
            >
              <header>
                <div>
                  <span><T>Canvas color</T></span>
                  <strong>{selectedColor.name}</strong>
                </div>
                <button aria-label={gt('Close color editor')} onClick={() => setColorPopover(null)} type='button'><X aria-hidden='true' /></button>
              </header>
              <ColorControl
                ariaLabel={gt('Change {name}', { name: selectedColor.name })}
                label={<T>Edit sampled token</T>}
                onChange={(hex) => commitSelectedColor({ hex })}
                onOpacityChange={(opacity) => commitSelectedColor({ opacity })}
                onOpacityPreview={(opacity) => previewSelectedColor({ opacity })}
                onPreview={(hex) => previewSelectedColor({ hex })}
                opacity={selectedColor.opacity}
                value={selectedColor.hex}
              />
              <div className='color-lab-canvas-popover-meta'>
                <span>{formatOklch(selectedColor.hex)}</span>
                <span>{contrastRatio.toFixed(2)}:1</span>
              </div>
            </aside>
          ) : null}
        </div>
      </div>
    </ToolShell>
  );
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

function resolveTypographySelection(
  identity: BrandIdentity,
  fonts: BrandFontAsset[],
  selectedRole: BrandTypography['role'],
  previewSizes: Record<BrandTypography['role'], number>
) {
  const typography = brandTypographyRole(identity, selectedRole);
  const family = brandTypographyFamily(identity, selectedRole);
  const size = clampTypographyPreviewSize(
    selectedRole,
    previewSizes[selectedRole] ?? TYPOGRAPHY_PREVIEW_DEFAULT_SIZES[selectedRole]
  );
  const selectedFont = fonts.find(({ id }) => id === typography.fontId)
    ?? fonts.find((font) => font.family === family);
  const familyAssets = fonts.filter((font) => font.family === family);
  const minimumWeight = Math.max(
    100,
    selectedFont?.weightMin ?? Math.min(...familyAssets.map(({ weight }) => weight), 100)
  );
  const maximumWeight = Math.min(
    MAX_VISIBLE_FONT_WEIGHT,
    selectedFont?.weightMax
      ?? Math.max(...familyAssets.map(({ weight }) => weight), MAX_VISIBLE_FONT_WEIGHT)
  );
  const weightStep = Math.max(
    25,
    Math.round((maximumWeight - minimumWeight) / 3 / 25) * 25
  );
  const weights = Array.from(new Set([
    minimumWeight,
    minimumWeight + weightStep,
    minimumWeight + weightStep * 2,
    maximumWeight,
    capVisibleFontWeight(typography.weight ?? 400),
    ...familyAssets.map(({ weight }) => capVisibleFontWeight(weight)),
  ]))
    .filter((weight) => weight >= minimumWeight && weight <= maximumWeight)
    .sort((first, second) => first - second)
    .slice(0, 6);
  return {
    selectedFamily: family,
    selectedSize: size,
    selectedTypography: typography,
    specimenWeights: weights,
  };
}

function resolveTypographySystemPresentation(identity: BrandIdentity) {
  const display = brandTypographyRole(identity, 'Display');
  const body = brandTypographyRole(identity, 'Body');
  const accent = brandTypographyRole(identity, 'Accent');
  const code = brandTypographyRole(identity, 'Code');
  const primaryColor = identity.colors.find(({ id }) => id === 'emphasis')?.hex
    ?? identity.colors.find(({ name }) => name.toLocaleLowerCase() === 'primary')?.hex
    ?? identity.colors[0]?.hex
    ?? '#181818';
  const isRamp = identity.id === 'ramp';
  return {
    accent,
    accentFamily: brandTypographyFamily(identity, 'Accent'),
    accentWeight: capVisibleFontWeight(accent.weight ?? 400),
    body,
    bodyFamily: brandTypographyFamily(identity, 'Body'),
    bodyLineHeight: body.lineHeight ?? 1.5,
    bodyWeight: capVisibleFontWeight(body.weight ?? 400),
    code,
    codeFamily: brandTypographyFamily(identity, 'Code'),
    codeLabel: isRamp ? 'Operational data' : 'Command line',
    codeSample: isRamp ? '$24,680.00  /  Q3 2026  /  APPROVED' : `$ npx ${identity.id} build --brand`,
    codeUsesPrompt: !isRamp,
    codeWeight: capVisibleFontWeight(code.weight ?? 400),
    display,
    displayFamily: brandTypographyFamily(identity, 'Display'),
    displayLineHeight: display.lineHeight ?? 1,
    displayWeight: capVisibleFontWeight(display.weight ?? 400),
    primaryColor,
    primaryForeground: hexToOklch(primaryColor).lightness < 0.58 ? '#FFFFFF' : '#111111',
  };
}

function TypographyTool({ identity, onIdentityChange, tool }: { identity: BrandIdentity; onIdentityChange: (identity: BrandIdentity) => void; tool: StudioTool }) {
  const gt = useGT();
  const fonts = brandFontAssets(identity);
  const [selectedRole, setSelectedRole] = useState<BrandTypography['role']>('Display');
  const [sampleText, setSampleText] = useStudioDraft(identity.id, tool.id, 'sample-text', identity.tagline);
  const [previewSizes, setPreviewSizes] = useStudioDraft<Record<BrandTypography['role'], number>>(
    identity.id,
    tool.id,
    'preview-sizes',
    TYPOGRAPHY_PREVIEW_DEFAULT_SIZES
  );
  const [previewAlign, setPreviewAlign] = useState<'left' | 'center'>('left');
  const [previewMode, setPreviewMode] = useState<'system' | 'type'>('type');
  const [typingCharactersEntered, setTypingCharactersEntered] = useState(0);
  const [typingStartedAt, setTypingStartedAt] = useState<number | null>(null);
  const [typingNow, setTypingNow] = useState<number | null>(null);
  const liveSpecimenRef = useRef<HTMLTextAreaElement>(null);
  const sourceCode = stringifySource({ typography: identity.typography });

  useEffect(() => {
    if (typingStartedAt === null) return;
    const timer = window.setInterval(() => setTypingNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [typingStartedAt]);

  function applySourceCode(source: string) {
    const value = parseSourceObject(source);
    const typography = sourceObjectArray(value, 'typography');
    if (!typography) throw new TypeError('typography must be an array of typography roles.');
    const nextTypography = identity.typography.map((current) => {
      const next = typography.find((item) => sourceString(item, 'role', '') === current.role);
      return next ? {
        ...current,
        family: sourceString(next, 'family', current.family),
        fontId: sourceString(next, 'fontId', current.fontId ?? '') || undefined,
        letterSpacing: sourceNumber(next, 'letterSpacing', current.letterSpacing ?? 0),
        lineHeight: sourceNumber(next, 'lineHeight', current.lineHeight ?? 1.2),
        weight: sourceNumber(next, 'weight', current.weight ?? 400),
      } : current;
    });
    onIdentityChange({ ...identity, typography: nextTypography });
  }

  function updateRole(role: BrandTypography['role'], patch: Partial<BrandTypography>) {
    onIdentityChange({
      ...identity,
      typography: identity.typography.map((font) => font.role === role ? { ...font, ...patch } : font),
    });
  }

  function editSampleText(value: string) {
    const now = Date.now();
    if (typingStartedAt === null) setTypingStartedAt(now);
    setTypingCharactersEntered((current) => current + Math.max(0, Array.from(value).length - Array.from(sampleText).length));
    setTypingNow(now);
    setSampleText(value);
  }

  function resetTypingSession() {
    setSampleText('');
    setTypingCharactersEntered(0);
    setTypingStartedAt(null);
    setTypingNow(null);
  }

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
    onIdentityChange({ ...identity, fonts: [...fonts, nextFont] });
  }

  const {
    selectedFamily,
    selectedSize,
    selectedTypography,
    specimenWeights,
  } = resolveTypographySelection(
    identity,
    fonts,
    selectedRole,
    previewSizes
  );
  const typingElapsedMs = typingStartedAt === null || typingNow === null ? 0 : typingNow - typingStartedAt;
  const sampleMeasurement = measureTypingSample(sampleText, 0);
  const typingPace = measureTypingSample('x'.repeat(typingCharactersEntered), typingElapsedMs);
  const typingMeasurement = {
    ...sampleMeasurement,
    seconds: typingPace.seconds,
    wordsPerMinute: typingPace.wordsPerMinute,
  };

  useEffect(() => {
    const specimen = liveSpecimenRef.current;
    if (!specimen || previewMode !== 'type') return;
    specimen.style.height = '0px';
    specimen.style.height = `${specimen.scrollHeight}px`;
  }, [previewMode, sampleText, selectedRole, selectedSize, selectedTypography.letterSpacing, selectedTypography.lineHeight, selectedTypography.weight]);

  const library = (
    <>
      <LabPanelHeading
        description={<T>Select a role to inspect it at production scale.</T>}
        title={<T>Typography roles</T>}
      />
      <div className='typography-lab-library'>
        {identity.typography.map((typography) => (
          <button aria-pressed={selectedRole === typography.role} key={typography.role} onClick={() => setSelectedRole(typography.role)} type='button'>
            <span>{typography.role}</span>
            <strong style={{ fontFamily: brandTypographyFamily(identity, typography.role), fontWeight: capVisibleFontWeight(typography.weight ?? 400) }}>Aa</strong>
            <small>{brandTypographyFamily(identity, typography.role)}</small>
          </button>
        ))}
      </div>
      <div className='p-4'><UploadField accept='.otf,.ttf,.woff,.woff2,font/*' label='Add font file to identity' onFile={loadFont} /></div>
    </>
  );

  const inspector = (
    <>
      <LabPanelHeading
        description={<T>Make live changes to the selected role and specimen.</T>}
        title={`${selectedRole} · ${selectedFamily}`}
      />
      <LabInspectorSection index='01' meta={selectedRole} title={<T>Typeface</T>}>
        <Field label={<T>Font family</T>}>
          <StudioSelect ariaLabel={`${selectedRole} font`} onValueChange={(fontId) => { const font = fonts.find((candidate) => candidate.id === fontId); if (font) updateRole(selectedRole, { family: font.family, fontId }); }} options={fonts.map((font) => ({ label: font.label, value: font.id }))} value={selectedTypography.fontId ?? fonts[0]?.id ?? ''} />
        </Field>
        <RangeField label={<T>Preview size</T>} max={TYPOGRAPHY_PREVIEW_MAX_SIZES[selectedRole]} min={10} onChange={(fontSize) => setPreviewSizes((current) => ({ ...current, [selectedRole]: fontSize }))} suffix='px' value={selectedSize} />
        <RangeField label={<T>Weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(weight) => updateRole(selectedRole, { weight })} step={25} value={selectedTypography.weight ?? 400} />
        <RangeField label={<T>Line height</T>} max={2} min={0.7} onChange={(lineHeight) => updateRole(selectedRole, { lineHeight })} step={0.02} value={selectedTypography.lineHeight ?? 1.2} />
        <RangeField label={<T>Tracking</T>} max={12} min={-8} onChange={(letterSpacing) => updateRole(selectedRole, { letterSpacing })} step={0.1} suffix='px' value={selectedTypography.letterSpacing ?? 0} />
      </LabInspectorSection>
      <LabInspectorSection index='02' meta='Live copy' title={<T>Specimen</T>}>
        <Field label={<T>Sample text</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => editSampleText(event.target.value)} value={sampleText} /></Field>
        <SegmentedChoice onChange={setPreviewAlign} options={[{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }]} value={previewAlign} />
      </LabInspectorSection>
      <LabInspectorSection index='03' meta={selectedTypography.usage} title={<T>Role guidance</T>}>
        <p className='lab-section-description'>{selectedTypography.usage}</p>
      </LabInspectorSection>
    </>
  );

  const {
    accent,
    accentFamily,
    accentWeight,
    body,
    bodyFamily,
    bodyLineHeight,
    bodyWeight,
    code,
    codeFamily,
    codeLabel,
    codeSample,
    codeUsesPrompt,
    codeWeight,
    display,
    displayFamily,
    displayLineHeight,
    displayWeight,
    primaryColor,
    primaryForeground,
  } = resolveTypographySystemPresentation(identity);

  return (
    <ToolShell inspector={inspector} library={library} sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Typography source') }} tool={tool}>
      <div className='typography-lab-stage'>
        <div className='typography-lab-toolbar'>
          <div><span><T>Live specimen</T></span><strong>{selectedRole} / {selectedFamily}</strong></div>
          <div className='color-lab-segmented'>
            {(['type', 'system'] as const).map((mode) => <button aria-pressed={previewMode === mode} key={mode} onClick={() => setPreviewMode(mode)} type='button'>{mode}</button>)}
          </div>
        </div>
        {previewMode === 'type' ? (
          <div className='typography-lab-focus'>
            <article data-align={previewAlign}>
              <div><span>{selectedRole}</span><code>{selectedFamily} · {selectedTypography.weight ?? 400} / {selectedTypography.lineHeight ?? 1.2}</code></div>
              <textarea
                aria-label={gt('{role} live type specimen', { role: selectedRole })}
                className='typography-lab-live-input'
                onChange={(event) => editSampleText(event.target.value)}
                placeholder={gt('Type here to test the family…')}
                ref={liveSpecimenRef}
                style={{
                  fontFamily: selectedFamily,
                  fontSize: `${selectedSize}px`,
                  fontWeight: capVisibleFontWeight(selectedTypography.weight ?? 400),
                  letterSpacing: `${selectedTypography.letterSpacing ?? 0}px`,
                  lineHeight: selectedTypography.lineHeight ?? 1.2,
                }}
                value={sampleText}
              />
              <section className='typography-lab-role-lines' aria-label={gt('Typography role specimens')}>
                {identity.typography.map((typography) => (
                  <label data-active={selectedRole === typography.role} key={typography.role}>
                    <span><strong>{typography.role}</strong><code>{brandTypographyFamily(identity, typography.role)}</code></span>
                    <input
                      aria-label={gt('{role} editable specimen', { role: typography.role })}
                      onChange={(event) => editSampleText(event.target.value)}
                      onFocus={() => setSelectedRole(typography.role)}
                      style={{
                        fontFamily: brandTypographyFamily(identity, typography.role),
                        fontStyle: fonts.find(({ id }) => id === typography.fontId)?.style ?? 'normal',
                        fontWeight: capVisibleFontWeight(typography.weight ?? 400),
                      }}
                      value={sampleText}
                    />
                  </label>
                ))}
              </section>
              <section className='typography-lab-weight-lines' aria-label={gt('Font weight specimens')}>
                {specimenWeights.map((weight) => (
                  <div data-active={capVisibleFontWeight(selectedTypography.weight ?? 400) === weight} key={weight}>
                    <button onClick={() => updateRole(selectedRole, { weight })} type='button'>
                      <span>{weight}</span>
                      <small>{weight < 350 ? 'Light' : weight < 475 ? 'Regular' : 'Medium'}</small>
                    </button>
                    <input
                      aria-label={gt('{weight} weight editable specimen', { weight })}
                      onChange={(event) => editSampleText(event.target.value)}
                      onFocus={() => updateRole(selectedRole, { weight })}
                      style={{ fontFamily: selectedFamily, fontWeight: weight }}
                      value={sampleText}
                    />
                  </div>
                ))}
              </section>
              <footer className='typography-lab-typing-meter'>
                <span><strong>{typingMeasurement.wordsPerMinute}</strong> wpm</span>
                <span><strong>{typingMeasurement.words}</strong> words</span>
                <span><strong>{typingMeasurement.characters}</strong> chars</span>
                <span><strong>{typingMeasurement.seconds}</strong> sec</span>
                <button aria-label={gt('Clear specimen and restart typing meter')} onClick={resetTypingSession} title={gt('Clear and restart')} type='button'><RotateCcw aria-hidden='true' /></button>
              </footer>
            </article>
          </div>
        ) : (
      <div className='flex min-h-full items-center p-4 sm:p-7 xl:p-10'>
        <article className='mx-auto w-full max-w-[1480px] overflow-hidden bg-background/90 smooth-shadow-ring-xl backdrop-blur-sm'>
          <section
            className='px-5 pb-10 pt-8 sm:px-8 sm:pb-12 sm:pt-10 lg:px-12 lg:pb-14 lg:pt-12'
            style={{ backgroundColor: primaryColor, color: primaryForeground }}
          >
            <div className='flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] opacity-65'>
              <p>Display / {displayFamily}</p>
              <p className='flex gap-4 tabular-nums'>
                <span>Wt {displayWeight}</span>
                <span>Lh {displayLineHeight.toFixed(2)}</span>
                <span>Tr {display.letterSpacing ?? 0}</span>
              </p>
            </div>
            <h2
              className='mt-7 max-w-[18ch] text-balance text-[clamp(2.2rem,4vw,2.75rem)] text-current'
              style={{
                fontFamily: displayFamily,
                fontWeight: displayWeight,
                letterSpacing: `${display.letterSpacing}px`,
                lineHeight: Math.min(displayLineHeight, 1.02),
              }}
            >
              {identity.tagline}
            </h2>
            <p
              className='mt-7 text-[clamp(1rem,1.55vw,1.35rem)] text-current opacity-70'
              style={{
                fontFamily: accentFamily,
                fontWeight: accentWeight,
                letterSpacing: `${accent.letterSpacing}px`,
                lineHeight: accent.lineHeight,
              }}
            >
              {identity.greetings.join('  ·  ')}
            </p>
          </section>

          <div className='grid border-t border-border/80 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]'>
            <section className='flex min-h-[20rem] flex-col justify-between p-5 sm:p-8 lg:border-r lg:border-border/80 lg:p-10'>
              <div>
                <div className='flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>
                  <p>Body / {bodyFamily}</p>
                  <p className='tabular-nums'>Wt {bodyWeight} / {bodyLineHeight.toFixed(2)}</p>
                </div>
                <p
                  className='mt-7 max-w-[39ch] text-[clamp(1.2rem,2vw,1.75rem)] text-foreground/80'
                  style={{
                    fontFamily: bodyFamily,
                    fontWeight: bodyWeight,
                    letterSpacing: `${body.letterSpacing}px`,
                    lineHeight: bodyLineHeight,
                  }}
                >
                  {identity.positioning}
                </p>
              </div>
              <div
                className='mt-10 grid gap-3 border-t border-border/70 pt-5 text-sm text-muted-foreground sm:grid-cols-[1fr_auto] sm:items-end'
                style={{ fontFamily: bodyFamily, fontWeight: bodyWeight }}
              >
                <p className='break-words tracking-[0.08em]'>Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm</p>
                <p className='tabular-nums tracking-[0.12em]'>0123456789</p>
              </div>
            </section>

            <div className='grid border-t border-border/80 lg:border-t-0'>
              <section className='p-5 sm:p-8 lg:p-10'>
                <div className='flex flex-wrap items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>
                  <p>Code / {codeFamily}</p>
                  <p className='tabular-nums'>Wt {codeWeight}</p>
                </div>
                <div
                  className='mt-6 bg-foreground p-5 text-background shadow-[inset_0_0_0_1px_rgba(127,127,127,0.2)] sm:p-6'
                  style={{
                    fontFamily: codeFamily,
                    fontWeight: codeWeight,
                    letterSpacing: `${code.letterSpacing}px`,
                    lineHeight: code.lineHeight,
                  }}
                >
                  <p className='text-[11px] uppercase tracking-[0.14em] opacity-55'>{codeLabel}</p>
                  <p className='studio-scroll-area mt-5 overflow-x-auto whitespace-nowrap text-[clamp(0.8rem,1.2vw,1rem)]'>
                    {codeUsesPrompt ? <><span className='mr-3 opacity-45'>$</span>{codeSample.slice(2)}</> : codeSample}
                  </p>
                </div>
              </section>
              <section className='grid grid-cols-[auto_1fr] items-center gap-5 border-t border-border/80 p-5 sm:gap-8 sm:p-8 lg:p-10'>
                <p
                  className='text-[clamp(2.2rem,4vw,2.75rem)] text-foreground'
                  style={{
                    fontFamily: accentFamily,
                    fontWeight: accentWeight,
                    letterSpacing: `${accent.letterSpacing}px`,
                    lineHeight: 0.8,
                  }}
                >
                  Aa
                </p>
                <div className='min-w-0'>
                  <p className='text-[11px] uppercase tracking-[0.16em] text-muted-foreground'>Accent</p>
                  <p className='mt-2 truncate text-sm text-foreground'>{accentFamily}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>{accent.usage}</p>
                </div>
              </section>
            </div>
          </div>
        </article>
      </div>
        )}
      </div>
    </ToolShell>
  );
}

const CODE_SAMPLES = {
  bash: `$ gt translate --locales es,ja,ar\n✓ 42 strings translated\n✓ 3 locale files written`,
  python: `from gt import translate\n\nresult = translate(\n    "Hello, world",\n    locales=["es", "ja", "ar"],\n)`,
  typescript: `import { tx } from 'gt-next';\n\nexport function Greeting() {\n  return <h1>{tx('Hello, world')}</h1>;\n}`,
} as const;

function TerminalTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:terminal`);
  const [documentCreatedAt] = useState(() => new Date().toISOString());
  const [language, setLanguage] = useStudioDraft<CodeLanguage>(identity.id, tool.id, 'language', 'typescript');
  const [code, setCode] = useStudioDraft<string>(
    identity.id,
    tool.id,
    'code',
    CODE_SAMPLES.typescript
  );
  const [title, setTitle] = useStudioDraft(
    identity.id,
    tool.id,
    'title',
    identity.voice.phrases[0] ?? identity.tagline
  );
  const [titleFontRole, setTitleFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'title-font-role', 'Display');
  const [titleFontWeight, setTitleFontWeight] = useStudioDraft(identity.id, tool.id, 'title-font-weight', brandTypographyRole(identity, 'Display').weight ?? MAX_VISIBLE_FONT_WEIGHT);
  const [codeFontRole, setCodeFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'code-font-role', 'Code');
  const [codeFontWeight, setCodeFontWeight] = useStudioDraft(identity.id, tool.id, 'code-font-weight', brandTypographyRole(identity, 'Code').weight ?? 450);
  const terminalAssets = [...identity.assets, ...identity.proofAssets].filter((asset) => !asset.path.toLocaleLowerCase().endsWith('.pdf'));
  const [terminalAssetId, setTerminalAssetId] = useStudioDraft(
    identity.id,
    tool.id,
    'background-asset-id-v2',
    'none'
  );
  const [terminalAssetOpacity, setTerminalAssetOpacity] = useStudioDraft(identity.id, tool.id, 'asset-opacity', 14);
  const terminalAsset = terminalAssets.find(({ id }) => id === terminalAssetId);
  const titleTypography = brandTypographyRole(identity, titleFontRole);
  const codeTypography = brandTypographyRole(identity, codeFontRole);
  const titleFont = brandFontAssets(identity).find(({ id }) => id === titleTypography.fontId);
  const codeFont = brandFontAssets(identity).find(({ id }) => id === codeTypography.fontId);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [restoredAssetSources, setRestoredAssetSources] = useState<Record<string, string>>({});
  const terminalState = useMemo(() => ({
    background: { assetId: terminalAssetId, opacity: terminalAssetOpacity },
    code,
    codeTypography: { role: codeFontRole, weight: codeFontWeight },
    language,
    title,
    titleTypography: { role: titleFontRole, weight: titleFontWeight },
  }), [
    code,
    codeFontRole,
    codeFontWeight,
    language,
    terminalAssetId,
    terminalAssetOpacity,
    title,
    titleFontRole,
    titleFontWeight,
  ]);
  const terminalRevision = useMemo(() => JSON.stringify(terminalState), [terminalState]);
  const terminalDocument = useMemo(() => createStudioCanvasDocument({
    background: CODE_THEME.background,
    brandId: identity.id,
    createdAt: documentCreatedAt,
    height: 630,
    id: `${identity.id}:${tool.id}:terminal`,
    layers: [
      ...(terminalAsset || restoredAssetSources.background ? [{
        asset: {
          name: terminalAsset?.label ?? 'Imported terminal background',
          source: restoredAssetSources.background ?? terminalAsset!.path,
        },
        bounds: { height: 630, rotation: 0, width: 1200, x: 0, y: 0 },
        id: 'terminal-background',
        kind: 'image' as const,
        name: 'Background image',
        opacity: terminalAssetOpacity / 100,
      }] : []),
      {
        bounds: { height: 56, rotation: 0, width: 1056, x: 72, y: 48 },
        content: title,
        id: 'terminal-title',
        kind: 'text' as const,
        name: 'Card title',
      },
      {
        bounds: { height: 388, rotation: 0, width: 1056, x: 72, y: 174 },
        content: code,
        id: 'terminal-code',
        kind: 'text' as const,
        name: 'Source code',
      },
      ...(titleFont || restoredAssetSources.titleFont ? [{
        asset: {
          kind: 'font' as const,
          name: titleFont?.label ?? 'Imported title font',
          source: restoredAssetSources.titleFont ?? titleFont!.path,
        },
        bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 },
        hidden: true,
        id: 'terminal-title-font',
        kind: 'component' as const,
        name: 'Title font',
      }] : []),
      ...(codeFont || restoredAssetSources.codeFont ? [{
        asset: {
          kind: 'font' as const,
          name: codeFont?.label ?? 'Imported code font',
          source: restoredAssetSources.codeFont ?? codeFont!.path,
        },
        bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 },
        hidden: true,
        id: 'terminal-code-font',
        kind: 'component' as const,
        name: 'Code font',
      }] : []),
    ],
    revision: canvasRevisionFromSignature(terminalRevision),
    state: terminalState,
    title: `${identity.name} ${tool.name}`,
    toolId: tool.id,
    updatedAt: documentCreatedAt,
    width: 1200,
  }), [
    code,
    codeFont,
    documentCreatedAt,
    identity.id,
    identity.name,
    restoredAssetSources,
    terminalAsset,
    terminalAssetOpacity,
    terminalRevision,
    terminalState,
    title,
    titleFont,
    tool.id,
    tool.name,
  ]);
  const terminalWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identity.id, tool.id),
    [identity.id, tool.id]
  );
  const portableTerminal = usePortableCanvasWorkspace({
    applySource: applySourceCode,
    document: terminalDocument,
    workspaceKey: terminalWorkspaceKey,
  });
  const sourceCode = portableTerminal.source;
  const portableTerminalDocument = portableTerminal.document;
  const terminalBackgroundSource = canvasElementAssetSource(
    portableTerminalDocument,
    'terminal-background',
    restoredAssetSources.background ?? terminalAsset?.path ?? null
  );
  const terminalTitleFontSource = canvasElementAssetSource(
    portableTerminalDocument,
    'terminal-title-font',
    restoredAssetSources.titleFont ?? titleFont?.path ?? null
  );
  const terminalCodeFontSource = canvasElementAssetSource(
    portableTerminalDocument,
    'terminal-code-font',
    restoredAssetSources.codeFont ?? codeFont?.path ?? null
  );
  const previewSvg = useMemo(() => buildTerminalSvg({
    assetData: terminalBackgroundSource,
    assetOpacity: terminalAssetOpacity,
    code,
    codeFontData: terminalCodeFontSource,
    codeFontFamily: brandTypographyFamily(identity, codeFontRole),
    codeFontWeight,
    language,
    title,
    titleFontData: terminalTitleFontSource,
    titleFontFamily: brandTypographyFamily(identity, titleFontRole),
    titleFontWeight,
  }), [
    code,
    codeFontRole,
    codeFontWeight,
    identity,
    language,
    terminalAssetOpacity,
    terminalBackgroundSource,
    terminalCodeFontSource,
    terminalTitleFontSource,
    title,
    titleFontRole,
    titleFontWeight,
  ]);
  const terminalAutosaveState = portableTerminal.autosaveState;

  function applySourceCode(source: string) {
    const sourceRoot = parseSourceObject(source);
    const parsed = isCanvasDocumentEnvelope(sourceRoot)
      ? parseStudioCanvasDocument(source, tool.id)
      : null;
    const value = parsed?.state ?? sourceRoot;
    const nextLanguage = sourceString(value, 'language', language);
    if (!Object.hasOwn(CODE_SAMPLES, nextLanguage)) throw new TypeError('language must be typescript, python, or bash.');
    setLanguage(nextLanguage as CodeLanguage);
    setCode(sourceString(value, 'code', code));
    setTitle(sourceString(value, 'title', title));
    const titleType = sourceObject(value, 'titleTypography');
    const codeType = sourceObject(value, 'codeTypography');
    const backgroundConfig = sourceObject(value, 'background');
    if (titleType) {
      setTitleFontRole(sourceString(titleType, 'role', titleFontRole) as BrandTypography['role']);
      setTitleFontWeight(sourceNumber(titleType, 'weight', titleFontWeight));
    }
    if (codeType) {
      setCodeFontRole(sourceString(codeType, 'role', codeFontRole) as BrandTypography['role']);
      setCodeFontWeight(sourceNumber(codeType, 'weight', codeFontWeight));
    }
    if (backgroundConfig) {
      setTerminalAssetId(sourceString(backgroundConfig, 'assetId', terminalAssetId));
      setTerminalAssetOpacity(sourceNumber(backgroundConfig, 'opacity', terminalAssetOpacity));
    }
    if (parsed) {
      setRestoredAssetSources({
        ...(canvasElementAssetSource(parsed.document, 'terminal-background')
          ? { background: canvasElementAssetSource(parsed.document, 'terminal-background')! }
          : {}),
        ...(canvasElementAssetSource(parsed.document, 'terminal-code-font')
          ? { codeFont: canvasElementAssetSource(parsed.document, 'terminal-code-font')! }
          : {}),
        ...(canvasElementAssetSource(parsed.document, 'terminal-title-font')
          ? { titleFont: canvasElementAssetSource(parsed.document, 'terminal-title-font')! }
          : {}),
      });
    }
  }

  function changeLanguage(nextLanguage: CodeLanguage) {
    setLanguage(nextLanguage);
    setCode(CODE_SAMPLES[nextLanguage]);
  }

  async function exportTerminal() {
    if (!portableTerminalDocument) throw new Error('Portable terminal assets are still being prepared.');
    setExporting(true);
    studioExport.start('Rendering terminal PNG preview');
    try {
      const blob = await svgToPngBlob(previewSvg, 1200, 630);
      setLastExport({ blob, fileName: 'studio-terminal.png', format: 'PNG', height: 630, width: 1200 });
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  const inspector = (
    <>
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Card title</T>}>
          <input className={INPUT_CLASS} onChange={(event) => setTitle(event.target.value)} value={title} />
        </Field>
        <Field label={<T>Language</T>}>
          <StudioSelect ariaLabel='Language' onValueChange={(value) => changeLanguage(value as CodeLanguage)} options={[
            { label: 'TypeScript', value: 'typescript' },
            { label: 'Python', value: 'python' },
            { label: 'Bash', value: 'bash' },
          ]} value={language} />
        </Field>
      </ControlSection>
      <ControlSection title={<T>Source</T>}>
        <textarea aria-label='Terminal source code' className={`${TEXTAREA_CLASS} min-h-56 font-mono`} onChange={(event) => setCode(event.target.value)} spellCheck={false} value={code} />
      </ControlSection>
      <ControlSection title={<T>Typography</T>}>
        <Field label={<T>Title font</T>}><StudioSelect ariaLabel='Terminal title font' onValueChange={(value) => { const role = value as BrandTypography['role']; setRestoredAssetSources((current) => { const { titleFont: _titleFont, ...next } = current; return next; }); setTitleFontRole(role); setTitleFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={titleFontRole} /></Field>
        <RangeField label={<T>Title weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setTitleFontWeight} step={50} value={titleFontWeight} />
        <Field label={<T>Code font</T>}><StudioSelect ariaLabel='Terminal code font' onValueChange={(value) => { const role = value as BrandTypography['role']; setRestoredAssetSources((current) => { const { codeFont: _codeFont, ...next } = current; return next; }); setCodeFontRole(role); setCodeFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={codeFontRole} /></Field>
        <RangeField label={<T>Code weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setCodeFontWeight} step={50} value={codeFontWeight} />
      </ControlSection>
      <ControlSection title={<T>Brand asset</T>}>
        <Field label={<T>Card background</T>}><StudioSelect ariaLabel='Terminal card background' onValueChange={(value) => { setRestoredAssetSources((current) => { const { background: _background, ...next } = current; return next; }); setTerminalAssetId(value); }} options={[{ label: 'None', value: 'none' }, ...terminalAssets.map((asset) => ({ label: `${asset.label} · ${asset.type}`, value: asset.id }))]} value={terminalAsset?.id ?? 'none'} /></Field>
        {terminalAsset ? <RangeField label={<T>Asset opacity</T>} max={100} min={0} onChange={setTerminalAssetOpacity} value={terminalAssetOpacity} /> : null}
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <>
          <DesignVersionControls
            autosaveState={terminalAutosaveState}
            identityId={identity.id}
            onOpen={applySourceCode}
            revision={String(terminalDocument.revision)}
            source={() => sourceCode}
            toolId={tool.id}
            workspaceLabel={tool.name}
          />
          <ExportPreview asset={lastExport} />
          <Button disabled={exporting || !portableTerminalDocument} onClick={exportTerminal} type='button'>
            <Download aria-hidden='true' />
            <T>Export PNG</T>
          </Button>
        </>
      }
      inspector={inspector}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Terminal source') }}
      tool={tool}
    >
      <CanvasViewport identityId={identity.id} stageClassName='grid min-h-full place-items-center p-6 lg:p-10' toolId={tool.id}>
        <CanvasArtboard
          aria-label={gt('Terminal card canvas')}
          className='artifact-preview overflow-hidden rounded-lg bg-[#0D1117]'
          frameClassName='w-full max-w-4xl smooth-shadow-ring-lg smooth-ring-white/10'
          height={630}
          role='group'
          width={1200}
        >
          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 [&>svg]:size-full'
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />
        </CanvasArtboard>
      </CanvasViewport>
    </ToolShell>
  );
}

const SLIDE_LAYOUTS: readonly { id: SlideLayout; label: string; symbol: string }[] = [
  { id: 'title', label: 'Title', symbol: 'Aa' },
  { id: 'section', label: 'Section', symbol: '01' },
  { id: 'agenda', label: 'Agenda', symbol: '≡' },
  { id: 'split', label: 'Split', symbol: '▥' },
  { id: 'metrics', label: 'Metrics', symbol: '%' },
  { id: 'quote', label: 'Quote', symbol: '“' },
  { id: 'timeline', label: 'Timeline', symbol: '→' },
  { id: 'statement', label: 'Statement', symbol: '!!' },
  { id: 'comparison', label: 'Comparison', symbol: '↔' },
  { id: 'process', label: 'Process', symbol: '1—4' },
  { id: 'chart', label: 'Chart', symbol: '▥' },
  { id: 'team', label: 'Team', symbol: '●●' },
  { id: 'image', label: 'Image', symbol: '▧' },
  { id: 'closing', label: 'Closing', symbol: '✦' },
];

const TEMPLATE_LAYER_LABELS: Record<TemplateLayerId, string> = {
  brand: 'Brand lockup',
  content: 'Content',
  footer: 'Footer',
};

const DEFAULT_TEMPLATE_LAYER: CanvasLayerTransform = { scale: 1, x: 0, y: 0 };

function templateDraftDefaults(
  identity: BrandIdentity,
  kind: TemplateKind,
  partnerLabel: string
) {
  let title = identity.tagline;
  if (kind === 'partnership') title = `${identity.name} × ${partnerLabel}`;
  if (kind === 'blog') title = identity.voice.phrases[0] ?? identity.tagline;
  return {
    body: kind === 'slides'
      ? 'Foundation\nExpression\nApplication\nDelivery'
      : identity.description,
    fontWeight: brandTypographyRole(identity, 'Display').weight ?? MAX_VISIBLE_FONT_WEIGHT,
    title,
  };
}

function resolveTemplatePresentation(
  identity: BrandIdentity,
  kind: TemplateKind,
  texture: TemplateTexture
) {
  const isDark = texture === 'dark';
  const ink = identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B';
  const paper = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const isSlide = kind === 'slides';
  const width = isSlide ? 1600 : 1200;
  const height = isSlide ? 900 : kind === 'blog' ? 630 : 600;
  const foreground = isDark ? paper : ink;
  const brandLogo = templateBrandLogo(identity, kind, isDark);
  return {
    background: isDark ? ink : paper,
    brandLogo,
    brandLogoSource: brandLogo?.path ?? monogramDataUrl(identity, foreground),
    foreground,
    height,
    isDark,
    isSlide,
    width,
  };
}

function resolveTemplateAssetSource(uploadedUrl: string | undefined, libraryUrl: string): string {
  return uploadedUrl ?? libraryUrl;
}

function resolvePartnershipAssetSource(
  kind: TemplateKind,
  document: CanvasDocument | null,
  elementId: string,
  fallback: string
): string | null {
  if (kind !== 'partnership') return null;
  return canvasElementAssetSource(document, elementId, fallback);
}

function TemplateSlideBodyField({
  body,
  kind,
  onChange,
}: {
  body: string;
  kind: TemplateKind;
  onChange: (value: string) => void;
}) {
  if (kind !== 'slides') return null;
  return (
    <Field label={<T>Body or list · one item per line</T>}>
      <textarea className={TEXTAREA_CLASS} onChange={(event) => onChange(event.target.value)} value={body} />
    </Field>
  );
}

function TemplateSlideLibrary({
  kind,
  onChange,
  value,
}: {
  kind: TemplateKind;
  onChange: (value: SlideLayout) => void;
  value: SlideLayout;
}) {
  if (kind !== 'slides') return null;
  return (
    <ControlSection title={<T>Slide library</T>}>
      <div className='grid grid-cols-2 gap-2'>
        {SLIDE_LAYOUTS.map((layout) => (
          <Button
            className='h-16 flex-col items-start gap-1 px-3'
            key={layout.id}
            onClick={() => onChange(layout.id)}
            type='button'
            variant={value === layout.id ? 'default' : 'outline'}
          >
            <span className='font-mono text-lg'>{layout.symbol}</span>
            <span className='text-xs'>{layout.label}</span>
          </Button>
        ))}
      </div>
    </ControlSection>
  );
}

function TemplateBackgroundAssetField({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: ReturnType<typeof templateBackgroundOptions>;
  value: string;
}) {
  const gt = useGT();
  if (options.length === 0) return null;
  return (
    <Field label={<T>Brand background asset</T>}>
      <StudioSelect
        ariaLabel='Brand background asset'
        onValueChange={onChange}
        options={[
          { label: gt('No library background'), value: '' },
          ...options.map((asset) => ({ label: asset.label, value: asset.id })),
        ]}
        value={value}
      />
    </Field>
  );
}

function TemplateTextureOpacityField({
  onChange,
  texture,
  value,
}: {
  onChange: (value: number) => void;
  texture: TemplateTexture;
  value: number;
}) {
  if (texture !== 'grid' && texture !== 'noise') return null;
  return (
    <RangeField
      label={<T>Texture opacity</T>}
      max={100}
      min={0}
      onChange={onChange}
      suffix='%'
      value={value}
    />
  );
}

function TemplateTool({ identity, kind, tool }: { identity: BrandIdentity; kind: TemplateKind; tool: StudioTool }) {
  const gt = useGT();
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:${kind}`);
  const partnerAsset = useLocalAsset();
  const partnerFontAsset = useLocalAsset();
  const backgroundAsset = useLocalAsset();
  const backgroundOptions = useMemo(() => templateBackgroundOptions(identity), [identity]);
  const partnerOptions = useMemo(() => templatePartnerOptions(identity), [identity]);
  const initialPartner = defaultTemplatePartner(identity);
  const initialPartnerFont = defaultTemplatePartnerFont(
    identity,
    initialPartner.id,
    BUILT_IN_BRAND_IDENTITIES
  );
  const defaults = templateDraftDefaults(identity, kind, initialPartner.label);
  const [partnerId, setPartnerId] = useStudioDraft(
    identity.id,
    tool.id,
    'partner',
    initialPartner.id
  );
  const selectedPartner = partnerOptions.find(({ id }) => id === partnerId) ?? initialPartner;
  const partnerFontOptions = useMemo(
    () => templatePartnerFontOptions(identity, selectedPartner.id, BUILT_IN_BRAND_IDENTITIES),
    [identity, selectedPartner.id]
  );
  const selectedPartnerDefaultFont = defaultTemplatePartnerFont(
    identity,
    selectedPartner.id,
    BUILT_IN_BRAND_IDENTITIES
  );
  const [partnerName, setPartnerName] = useStudioDraft(
    identity.id,
    tool.id,
    'partner-name',
    initialPartner.label
  );
  const [partnerTreatment, setPartnerTreatment] = useStudioDraft<TemplatePartnerTreatment>(
    identity.id,
    tool.id,
    'partner-treatment',
    defaultTemplatePartnerTreatment(initialPartner.id, BUILT_IN_BRAND_IDENTITIES)
  );
  const [partnerFontId, setPartnerFontId] = useStudioDraft(
    identity.id,
    tool.id,
    'partner-font',
    initialPartnerFont.id
  );
  const selectedPartnerFont = partnerFontOptions.find(({ id }) => id === partnerFontId)
    ?? selectedPartnerDefaultFont;
  const [partnerFontWeight, setPartnerFontWeight] = useStudioDraft(
    identity.id,
    tool.id,
    'partner-font-weight',
    initialPartnerFont.weight
  );
  const [partnerGap, setPartnerGap] = useStudioDraft(
    identity.id,
    tool.id,
    'partner-lockup-gap',
    18
  );
  const [title, setTitle] = useStudioDraft(
    identity.id,
    tool.id,
    'title',
    defaults.title
  );
  const [body, setBody] = useStudioDraft(
    identity.id,
    tool.id,
    'body',
    defaults.body
  );
  const [slideLayout, setSlideLayout] = useStudioDraft<SlideLayout>(
    identity.id,
    tool.id,
    'slide-layout',
    'title'
  );
  const [texture, setTexture] = useStudioDraft<TemplateTexture>(
    identity.id,
    tool.id,
    'texture',
    'white'
  );
  const [textureOpacity, setTextureOpacity] = useStudioDraft(identity.id, tool.id, 'texture-opacity', 100);
  const [libraryBackgroundId, setLibraryBackgroundId] = useStudioDraft(identity.id, tool.id, 'library-background-v2', '');
  const [fontRole, setFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'font-role', 'Display');
  const [fontWeight, setFontWeight] = useStudioDraft(identity.id, tool.id, 'font-weight', defaults.fontWeight);
  const [backgroundOpacity, setBackgroundOpacity] = useStudioDraft(identity.id, tool.id, 'background-opacity', 28);
  const [backgroundX, setBackgroundX] = useStudioDraft(identity.id, tool.id, 'background-x', 0);
  const [backgroundY, setBackgroundY] = useStudioDraft(identity.id, tool.id, 'background-y', 0);
  const [backgroundScale, setBackgroundScale] = useStudioDraft(identity.id, tool.id, 'background-scale', 100);
  const [brandLogoX, setBrandLogoX] = useStudioDraft(identity.id, tool.id, 'brand-logo-x', 0);
  const [brandLogoY, setBrandLogoY] = useStudioDraft(identity.id, tool.id, 'brand-logo-y', 0);
  const [brandLogoScale, setBrandLogoScale] = useStudioDraft(identity.id, tool.id, 'brand-logo-scale', 100);
  const [partnerLogoX, setPartnerLogoX] = useStudioDraft(identity.id, tool.id, 'partner-logo-x', 0);
  const [partnerLogoY, setPartnerLogoY] = useStudioDraft(identity.id, tool.id, 'partner-logo-y', 0);
  const [partnerLogoScale, setPartnerLogoScale] = useStudioDraft(identity.id, tool.id, 'partner-logo-scale', 100);
  const [brandLayer, setBrandLayer] = useStudioDraft<CanvasLayerTransform>(identity.id, tool.id, 'brand-layer', DEFAULT_TEMPLATE_LAYER);
  const [contentLayer, setContentLayer] = useStudioDraft<CanvasLayerTransform>(identity.id, tool.id, 'content-layer', DEFAULT_TEMPLATE_LAYER);
  const [footerLayer, setFooterLayer] = useStudioDraft<CanvasLayerTransform>(identity.id, tool.id, 'footer-layer', DEFAULT_TEMPLATE_LAYER);
  const [layerOrder, setLayerOrder] = useStudioDraft<TemplateLayerId[]>(identity.id, tool.id, 'layer-order', ['brand', 'content', 'footer']);
  const [restoredBrandLogoSource, setRestoredBrandLogoSource] = useState<string | null>(null);
  const [restoredFontSource, setRestoredFontSource] = useState<string | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<TemplateLayerId | null>(null);
  const [documentCreatedAt] = useState(() => new Date().toISOString());
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const {
    background,
    brandLogoSource,
    foreground,
    height,
    isDark,
    isSlide,
    width,
  } = resolveTemplatePresentation(identity, kind, texture);
  const displayFont = brandTypographyFamily(identity, fontRole);
  const selectedTypography = brandTypographyRole(identity, fontRole);
  const selectedFont = brandFontAssets(identity).find(({ id }) => id === selectedTypography.fontId);
  const selectedBackground = backgroundOptions.find(({ id }) => id === libraryBackgroundId);
  const effectiveBrandLogoSource = restoredBrandLogoSource ?? brandLogoSource;
  const partnerLogoSource = resolveTemplateAssetSource(
    partnerAsset.asset?.url,
    selectedPartner.path
  );
  const partnerFontSource = resolveTemplateAssetSource(
    partnerFontAsset.asset?.url,
    selectedPartnerFont.path
  );
  const fontSource = restoredFontSource ?? selectedFont?.path ?? null;
  const layerTransforms = useMemo<Record<TemplateLayerId, CanvasLayerTransform>>(() => ({
    brand: brandLayer,
    content: contentLayer,
    footer: footerLayer,
  }), [brandLayer, contentLayer, footerLayer]);
  const layerGeometries = useMemo<Record<TemplateLayerId, CanvasLayerGeometry>>(() => ({
    brand: { baseHeight: kind === 'partnership' ? 145 : 110, baseWidth: width - 168, baseX: 84, baseY: 54 },
    content: { baseHeight: height - (isSlide ? 250 : 260), baseWidth: width - 168, baseX: 84, baseY: isSlide ? 145 : 165 },
    footer: { baseHeight: 50, baseWidth: width - 168, baseX: 84, baseY: height - 104 },
  }), [height, isSlide, kind, width]);

  function updateLayer(id: TemplateLayerId, transform: CanvasLayerTransform) {
    if (id === 'brand') setBrandLayer(transform);
    else if (id === 'content') setContentLayer(transform);
    else setFooterLayer(transform);
  }

  function moveLayer(id: TemplateLayerId, direction: -1 | 1) {
    setLayerOrder((current) => {
      const complete = [...current, ...(['brand', 'content', 'footer'] as const).filter((candidate) => !current.includes(candidate))];
      const index = complete.indexOf(id);
      const destination = Math.min(complete.length - 1, Math.max(0, index + direction));
      if (index === destination) return complete;
      const next = [...complete];
      [next[index], next[destination]] = [next[destination]!, next[index]!];
      return next;
    });
  }

  function alignSelectedLayer(alignment: CanvasLayerAlignment) {
    if (!selectedLayer) return;
    updateLayer(
      selectedLayer,
      alignCanvasLayer(
        layerTransforms[selectedLayer],
        layerGeometries[selectedLayer],
        width,
        height,
        alignment
      )
    );
  }

  const templateState = useMemo(() => ({
    background: {
      asset: backgroundAsset.asset,
      libraryAssetId: libraryBackgroundId,
      opacity: backgroundOpacity,
      scale: backgroundScale,
      x: backgroundX,
      y: backgroundY,
    },
    body,
    brandLogo: { scale: brandLogoScale, x: brandLogoX, y: brandLogoY },
    kind,
    layers: {
      brand: brandLayer,
      content: contentLayer,
      footer: footerLayer,
      order: layerOrder,
    },
    partner: {
      asset: partnerAsset.asset,
      fontAsset: partnerFontAsset.asset,
      fontId: selectedPartnerFont.id,
      fontWeight: partnerFontWeight,
      gap: partnerGap,
      id: partnerId,
      name: partnerName,
      scale: partnerLogoScale,
      treatment: partnerTreatment,
      x: partnerLogoX,
      y: partnerLogoY,
    },
    slideLayout,
    texture: { opacity: textureOpacity, type: texture },
    title,
    typography: { role: fontRole, weight: fontWeight },
  }), [
    backgroundAsset.asset,
    backgroundOpacity,
    backgroundScale,
    backgroundX,
    backgroundY,
    body,
    brandLayer,
    brandLogoScale,
    brandLogoX,
    brandLogoY,
    contentLayer,
    fontRole,
    fontWeight,
    footerLayer,
    kind,
    layerOrder,
    libraryBackgroundId,
    partnerAsset.asset,
    partnerFontAsset.asset,
    partnerFontWeight,
    partnerGap,
    partnerId,
    partnerLogoScale,
    partnerLogoX,
    partnerLogoY,
    partnerName,
    partnerTreatment,
    selectedPartnerFont.id,
    slideLayout,
    texture,
    textureOpacity,
    title,
  ]);
  const templateRevision = useMemo(() => JSON.stringify(templateState), [templateState]);
  const templateDocument = useMemo(() => {
    const transformedBounds = (id: TemplateLayerId) => {
      const geometry = layerGeometries[id];
      const transform = layerTransforms[id];
      return {
        height: geometry.baseHeight * transform.scale,
        rotation: 0,
        width: geometry.baseWidth * transform.scale,
        x: geometry.baseX + transform.x + geometry.baseWidth * (1 - transform.scale) / 2,
        y: geometry.baseY + transform.y + geometry.baseHeight * (1 - transform.scale) / 2,
      };
    };
    const contentById = {
      brand: {
        asset: { name: `${identity.name} brand mark`, source: effectiveBrandLogoSource },
        content: undefined,
        kind: 'group' as const,
      },
      content: { content: title, kind: 'text' as const },
      footer: { content: identity.website, kind: 'text' as const },
    };
    return createStudioCanvasDocument({
      background,
      brandId: identity.id,
      createdAt: documentCreatedAt,
      height,
      id: `${identity.id}:${tool.id}:template`,
      layers: [
        ...(backgroundAsset.asset || selectedBackground ? [{
          asset: {
            name: backgroundAsset.asset?.name ?? selectedBackground?.label ?? 'Background image',
            source: backgroundAsset.asset?.url ?? selectedBackground!.path,
          },
          bounds: { height, rotation: 0, width, x: 0, y: 0 },
          id: 'template-background',
          kind: 'image' as const,
          name: 'Background image',
          opacity: backgroundOpacity / 100,
        }] : []),
        ...layerOrder.map((id) => ({
          ...contentById[id],
          bounds: transformedBounds(id),
          data: { id, transform: layerTransforms[id] },
          id: `template-${id}`,
          name: TEMPLATE_LAYER_LABELS[id],
        })),
        ...(kind === 'partnership' ? [
          {
            asset: {
              name: partnerAsset.asset?.name ?? selectedPartner.label,
              source: partnerLogoSource,
            },
            bounds: transformedBounds('brand'),
            data: { scale: partnerLogoScale, x: partnerLogoX, y: partnerLogoY },
            id: 'template-partner',
            kind: 'logo' as const,
            name: 'Partner mark',
          },
          {
            asset: {
              kind: 'font' as const,
              name: partnerFontAsset.asset?.name ?? selectedPartnerFont.label,
              source: partnerFontSource,
            },
            bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 },
            hidden: true,
            id: 'template-partner-font',
            kind: 'component' as const,
            name: 'Partner font',
          },
        ] : []),
        ...(fontSource ? [{
          asset: {
            kind: 'font' as const,
            name: selectedFont?.label ?? 'Imported template font',
            source: fontSource,
          },
          bounds: { height: 1, rotation: 0, width: 1, x: 0, y: 0 },
          hidden: true,
          id: 'template-font',
          kind: 'component' as const,
          name: 'Template font',
        }] : []),
      ],
      revision: canvasRevisionFromSignature(templateRevision),
      state: templateState,
      title: `${identity.name} ${tool.name}`,
      toolId: tool.id,
      updatedAt: documentCreatedAt,
      width,
    });
  }, [
    background,
    backgroundAsset.asset,
    backgroundOpacity,
    effectiveBrandLogoSource,
    documentCreatedAt,
    height,
    identity.id,
    identity.name,
    identity.website,
    kind,
    layerGeometries,
    layerOrder,
    layerTransforms,
    partnerAsset.asset,
    partnerFontAsset.asset,
    partnerFontSource,
    partnerLogoScale,
    partnerLogoSource,
    partnerLogoX,
    partnerLogoY,
    selectedBackground,
    fontSource,
    selectedFont,
    selectedPartner.label,
    selectedPartnerFont.label,
    templateRevision,
    templateState,
    title,
    tool.id,
    tool.name,
    width,
  ]);
  const templateWorkspaceKey = useMemo(
    () => savedDesignStorageKey(identity.id, tool.id),
    [identity.id, tool.id]
  );
  const portableTemplate = usePortableCanvasWorkspace({
    applySource: applySourceCode,
    document: templateDocument,
    workspaceKey: templateWorkspaceKey,
  });
  const sourceCode = portableTemplate.source;
  const portableTemplateDocument = portableTemplate.document;
  const resolvedBrandLogo = canvasElementAssetSource(
    portableTemplateDocument,
    'template-brand',
    effectiveBrandLogoSource
  )!;
  const resolvedBackground = backgroundAsset.asset || selectedBackground
    ? canvasElementAssetSource(
        portableTemplateDocument,
        'template-background',
        backgroundAsset.asset?.url ?? selectedBackground!.path
      )
    : null;
  const resolvedPartnerLogo = resolvePartnershipAssetSource(
    kind,
    portableTemplateDocument,
    'template-partner',
    partnerLogoSource
  );
  const resolvedPartnerFont = resolvePartnershipAssetSource(
    kind,
    portableTemplateDocument,
    'template-partner-font',
    partnerFontSource
  );
  const resolvedFont = fontSource
    ? canvasElementAssetSource(portableTemplateDocument, 'template-font', fontSource)
    : null;
  const templateSvgOptions = useMemo<TemplateSvgOptions>(() => ({
    background,
    backgroundImage: resolvedBackground,
    backgroundImageOpacity: backgroundOpacity,
    backgroundImageScale: backgroundScale,
    backgroundImageX: backgroundX,
    backgroundImageY: backgroundY,
    body,
    brandLogo: resolvedBrandLogo,
    brandLogoScale,
    brandLogoX,
    brandLogoY,
    brandScale: brandLayer.scale,
    brandX: brandLayer.x,
    brandY: brandLayer.y,
    contentScale: contentLayer.scale,
    contentX: contentLayer.x,
    contentY: contentLayer.y,
    footerScale: footerLayer.scale,
    footerX: footerLayer.x,
    footerY: footerLayer.y,
    foreground,
    fontData: resolvedFont,
    fontFamily: displayFont,
    fontWeight: capVisibleFontWeight(fontWeight),
    height,
    identityName: identity.name,
    imageTreatment: identity.style.imageTreatment,
    invertPartner: isDark,
    kind,
    layerOrder,
    partnerLogo: kind === 'partnership'
      ? resolvedPartnerLogo
      : null,
    partnerFontData: resolvedPartnerFont,
    partnerFontFamily: selectedPartnerFont.family,
    partnerFontWeight,
    partnerGap,
    partnerLetterSpacing: selectedPartnerFont.letterSpacing,
    partnerLogoScale,
    partnerLogoX,
    partnerLogoY,
    partnerName,
    partnerTreatment,
    slideLayout,
    texture,
    textureOpacity,
    title,
    website: identity.website,
    width,
  }), [
    background,
    backgroundOpacity,
    backgroundScale,
    backgroundX,
    backgroundY,
    body,
    brandLayer,
    brandLogoScale,
    brandLogoX,
    brandLogoY,
    contentLayer,
    displayFont,
    fontWeight,
    footerLayer,
    foreground,
    height,
    identity.name,
    identity.style.imageTreatment,
    identity.website,
    isDark,
    kind,
    layerOrder,
    partnerLogoScale,
    partnerFontWeight,
    partnerGap,
    resolvedBackground,
    resolvedBrandLogo,
    resolvedFont,
    resolvedPartnerLogo,
    resolvedPartnerFont,
    partnerLogoX,
    partnerLogoY,
    partnerName,
    partnerTreatment,
    selectedPartnerFont.family,
    selectedPartnerFont.letterSpacing,
    selectedBackground,
    fontSource,
    slideLayout,
    texture,
    textureOpacity,
    title,
    width,
  ]);
  const previewSvg = useMemo(
    () => buildTemplateSvg(templateSvgOptions),
    [templateSvgOptions]
  );
  const templateAutosaveState = portableTemplate.autosaveState;

  function applySourceCode(source: string) {
    const next = parseTemplateWorkspaceSource(source, tool.id, {
      allowedFontRoles: identity.typography.map(({ role }) => role),
      background: {
        asset: backgroundAsset.asset,
        libraryAssetId: libraryBackgroundId,
        opacity: backgroundOpacity,
        scale: backgroundScale,
        x: backgroundX,
        y: backgroundY,
      },
      body,
      brandLayer,
      brandLogo: { scale: brandLogoScale, x: brandLogoX, y: brandLogoY },
      contentLayer,
      fontRole,
      fontWeight,
      footerLayer,
      layerOrder,
      partner: {
        asset: partnerAsset.asset,
        fontAsset: partnerFontAsset.asset,
        fontId: selectedPartnerFont.id,
        fontWeight: partnerFontWeight,
        gap: partnerGap,
        id: partnerId,
        name: partnerName,
        opacity: 1,
        scale: partnerLogoScale,
        treatment: partnerTreatment,
        x: partnerLogoX,
        y: partnerLogoY,
      },
      slideLayout,
      texture,
      textureOpacity,
      title,
    });
    setTitle(next.title);
    setBody(next.body);
    setSlideLayout(next.slideLayout);
    setTexture(next.texture);
    setTextureOpacity(next.textureOpacity);
    setLibraryBackgroundId(next.background.libraryAssetId);
    backgroundAsset.restore(next.background.asset);
    setBackgroundOpacity(next.background.opacity);
    setBackgroundScale(next.background.scale);
    setBackgroundX(next.background.x);
    setBackgroundY(next.background.y);
    setBrandLogoScale(next.brandLogo.scale);
    setBrandLogoX(next.brandLogo.x);
    setBrandLogoY(next.brandLogo.y);
    setPartnerId(next.partner.id);
    partnerAsset.restore(next.partner.asset);
    partnerFontAsset.restore(next.partner.fontAsset);
    setPartnerFontId(next.partner.fontId);
    setPartnerFontWeight(next.partner.fontWeight);
    setPartnerGap(next.partner.gap);
    setPartnerLogoScale(next.partner.scale);
    setPartnerLogoX(next.partner.x);
    setPartnerLogoY(next.partner.y);
    setPartnerName(next.partner.name);
    setPartnerTreatment(next.partner.treatment);
    setRestoredBrandLogoSource(next.brandLogoSource);
    setRestoredFontSource(next.fontSource);
    setFontRole(next.fontRole);
    setFontWeight(next.fontWeight);
    setBrandLayer(next.brandLayer);
    setContentLayer(next.contentLayer);
    setFooterLayer(next.footerLayer);
    setLayerOrder(next.layerOrder);
  }

  async function exportTemplate() {
    if (!portableTemplateDocument) throw new Error('Portable template assets are still being prepared.');
    setExporting(true);
    studioExport.start(`Rendering ${kind} PNG preview`);
    try {
      const blob = await svgToPngBlob(previewSvg, width, height);
      setLastExport({ blob, fileName: `studio-${kind}.png`, format: 'PNG', height, width });
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  function selectTemplatePartner(value: string) {
    const nextPartner = partnerOptions.find(({ id }) => id === value) ?? initialPartner;
    const nextFont = defaultTemplatePartnerFont(
      identity,
      nextPartner.id,
      BUILT_IN_BRAND_IDENTITIES
    );
    if (title === `${identity.name} × ${selectedPartner.label}`) {
      setTitle(`${identity.name} × ${nextPartner.label}`);
    }
    partnerAsset.clear();
    partnerFontAsset.clear();
    setPartnerId(nextPartner.id);
    setPartnerName(nextPartner.label);
    setPartnerTreatment(defaultTemplatePartnerTreatment(
      nextPartner.id,
      BUILT_IN_BRAND_IDENTITIES
    ));
    setPartnerFontId(nextFont.id);
    setPartnerFontWeight(nextFont.weight);
  }

  function selectPartnerFont(value: string) {
    if (value === 'custom') return;
    const nextFont = partnerFontOptions.find(({ id }) => id === value)
      ?? selectedPartnerDefaultFont;
    partnerFontAsset.clear();
    setPartnerFontId(nextFont.id);
    setPartnerFontWeight(nextFont.weight);
  }

  function uploadPartnerFont(file: File) {
    void partnerFontAsset.select(file);
  }

  function renderPartnerControls() {
    if (kind !== 'partnership') return null;
    return (
      <ControlSection title={<T>Partner</T>}>
        <Field label={<T>Partner</T>}>
          <StudioSelect
            ariaLabel='Partner'
            onValueChange={selectTemplatePartner}
            options={partnerOptions.map((asset) => ({ label: asset.label, value: asset.id }))}
            value={partnerId}
          />
        </Field>
        <div className='flex flex-col gap-2 text-sm'>
          <span className='text-muted-foreground'><T>Partner treatment</T></span>
          <SegmentedChoice
            ariaLabel='Partner treatment'
            onChange={setPartnerTreatment}
            options={[
              { label: 'Write name', value: 'text' },
              { label: 'Use logo', value: 'logo' },
            ]}
            value={partnerTreatment}
          />
        </div>
        {partnerTreatment === 'text' ? (
          <>
            <Field label={<T>Partner name</T>}>
              <input
                className={INPUT_CLASS}
                onChange={(event) => setPartnerName(event.target.value)}
                value={partnerName}
              />
            </Field>
            <Field label={<T>Partner font</T>}>
                <StudioSelect
                  ariaLabel='Partner font'
                  onValueChange={selectPartnerFont}
                  options={[
                    ...(partnerFontAsset.asset ? [{
                      label: `Uploaded · ${partnerFontAsset.asset.name}`,
                      value: 'custom',
                    }] : []),
                    ...partnerFontOptions.map((font) => ({ label: font.label, value: font.id })),
                  ]}
                  value={partnerFontAsset.asset ? 'custom' : selectedPartnerFont.id}
                />
            </Field>
            <UploadField
              accept='.otf,.ttf,.woff,.woff2,font/*'
              fileName={partnerFontAsset.asset?.name}
              label='Upload partner font'
              onFile={uploadPartnerFont}
            />
            <RangeField
              label={<T>Partner font weight</T>}
              max={MAX_VISIBLE_FONT_WEIGHT}
              min={100}
              onChange={setPartnerFontWeight}
              step={50}
              value={partnerFontWeight}
            />
          </>
        ) : (
          <UploadField
            accept='image/*,.svg'
            fileName={partnerAsset.asset?.name}
            label='Replace partner logo'
            onFile={partnerAsset.select}
          />
        )}
        <RangeField
          label={<T>Lockup spacing</T>}
          max={160}
          min={0}
          onChange={setPartnerGap}
          suffix='px'
          value={partnerGap}
        />
      </ControlSection>
    );
  }

  const inspector = (
    <>
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Title</T>}>
          <textarea className={TEXTAREA_CLASS} onChange={(event) => setTitle(event.target.value)} value={title} />
        </Field>
        <TemplateSlideBodyField body={body} kind={kind} onChange={setBody} />
        <Field label={<T>Typography role</T>}><StudioSelect ariaLabel='Template typography role' onValueChange={(value) => { const role = value as BrandTypography['role']; setRestoredFontSource(null); setFontRole(role); setFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={fontRole} /></Field>
        <RangeField label={<T>Font weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setFontWeight} step={50} value={fontWeight} />
      </ControlSection>
      {renderPartnerControls()}
      <TemplateSlideLibrary kind={kind} onChange={setSlideLayout} value={slideLayout} />
      <ControlSection title={<T>Layers</T>}>
        <CanvasLayerPanel
          layers={[...layerOrder].reverse().map((id) => {
            const index = layerOrder.indexOf(id);
            return {
              canMoveBackward: index > 0,
              canMoveForward: index < layerOrder.length - 1,
              id,
              label: gt(TEMPLATE_LAYER_LABELS[id]),
              transform: layerTransforms[id],
            };
          })}
          onAlign={alignSelectedLayer}
          onMove={moveLayer}
          onReset={(id) => updateLayer(id, DEFAULT_TEMPLATE_LAYER)}
          onSelect={setSelectedLayer}
          selectedLayerId={selectedLayer}
        />
      </ControlSection>
      <ControlSection title={<T>Surface</T>}>
        <SegmentedChoice
          onChange={setTexture}
          options={[
            { label: 'Base white', value: 'white' },
            { label: 'Base dark', value: 'dark' },
            { label: 'Grid', value: 'grid' },
            { label: 'Noise', value: 'noise' },
          ]}
          value={texture}
        />
        <UploadField
          accept='image/*'
          fileName={backgroundAsset.asset?.name}
          label='Add background image'
          onFile={backgroundAsset.select}
        />
        <TemplateBackgroundAssetField
          onChange={setLibraryBackgroundId}
          options={backgroundOptions}
          value={libraryBackgroundId}
        />
        <TemplateTextureOpacityField
          onChange={setTextureOpacity}
          texture={texture}
          value={textureOpacity}
        />
        {backgroundAsset.asset || selectedBackground ? (
          <div className='flex flex-col gap-4 border-t border-border pt-4'>
            <p className='text-xs font-semibold'><T>Background image</T></p>
            <RangeField label={<T>Opacity</T>} max={100} min={0} onChange={setBackgroundOpacity} suffix='%' value={backgroundOpacity} />
            <RangeField label={<T>Horizontal</T>} max={100} min={-100} onChange={setBackgroundX} suffix='%' value={backgroundX} />
            <RangeField label={<T>Vertical</T>} max={100} min={-100} onChange={setBackgroundY} suffix='%' value={backgroundY} />
            <RangeField label={<T>Scale</T>} max={240} min={50} onChange={setBackgroundScale} suffix='%' value={backgroundScale} />
          </div>
        ) : null}
      </ControlSection>
      <ControlSection title={<T>Brand artwork</T>}>
        <RangeField label={<T>Horizontal</T>} max={240} min={-240} onChange={setBrandLogoX} suffix='px' value={brandLogoX} />
        <RangeField label={<T>Vertical</T>} max={180} min={-180} onChange={setBrandLogoY} suffix='px' value={brandLogoY} />
        <RangeField label={<T>Scale</T>} max={220} min={40} onChange={setBrandLogoScale} suffix='%' value={brandLogoScale} />
        {kind === 'partnership' && (
          <div className='flex flex-col gap-4 border-t border-border pt-4'>
            <p className='text-xs font-semibold'><T>Partner artwork</T></p>
            <RangeField label={<T>Horizontal</T>} max={240} min={-240} onChange={setPartnerLogoX} suffix='px' value={partnerLogoX} />
            <RangeField label={<T>Vertical</T>} max={180} min={-180} onChange={setPartnerLogoY} suffix='px' value={partnerLogoY} />
            <RangeField label={<T>Scale</T>} max={220} min={40} onChange={setPartnerLogoScale} suffix='%' value={partnerLogoScale} />
          </div>
        )}
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <>
          <DesignVersionControls
            autosaveState={templateAutosaveState}
            identityId={identity.id}
            onOpen={applySourceCode}
            revision={String(templateDocument.revision)}
            source={() => sourceCode}
            toolId={tool.id}
            workspaceLabel={tool.name}
          />
          <ExportPreview asset={lastExport} />
          <Button disabled={exporting || !portableTemplateDocument} onClick={exportTemplate} type='button'>
            <Download aria-hidden='true' />
            <T>Export PNG</T>
          </Button>
        </>
      }
      inspector={inspector}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt(`${tool.name} source`) }}
      tool={tool}
    >
      <CanvasViewport fontFamily={displayFont} fontWeight={capVisibleFontWeight(fontWeight)} identityId={identity.id} onDeselect={() => setSelectedLayer(null)} stageClassName='template-workspace grid min-h-full place-items-center p-5 md:p-8 xl:p-12' toolId={tool.id}>
        <TemplateCanvasPreview
          ariaLabel={gt(`${tool.name} canvas`)}
          background={background}
          borderRadius={kind === 'slides' ? 0 : identity.style.borderRadius}
          height={height}
          kind={kind}
          layerGeometries={layerGeometries}
          layerOrder={layerOrder}
          layerTransforms={layerTransforms}
          onChange={updateLayer}
          onDeselect={() => setSelectedLayer(null)}
          onSelect={setSelectedLayer}
          selectedLayer={selectedLayer}
          svg={previewSvg}
          width={width}
        />
      </CanvasViewport>
    </ToolShell>
  );
}

function ComponentLibraryTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const brandPalette = componentBrandPalette(identity);
  const [family, setFamily] = useStudioDraft<ComponentFamily>(identity.id, tool.id, 'family', 'actions');
  const [pattern, setPattern] = useStudioDraft<ComponentPatternId>(
    identity.id,
    tool.id,
    'pattern',
    'buttons'
  );
  const [label, setLabel] = useStudioDraft(identity.id, tool.id, 'label', 'Get started');
  const [supportingCopy, setSupportingCopy] = useStudioDraft(
    identity.id,
    tool.id,
    'supporting-copy',
    identity.description
  );
  const [disabled, setDisabled] = useStudioDraft(identity.id, tool.id, 'disabled', false);
  const [radius, setRadius] = useStudioDraft(
    identity.id,
    tool.id,
    'radius',
    identity.style.borderRadius
  );
  const [density, setDensity] = useStudioDraft(
    identity.id,
    tool.id,
    'density',
    identity.style.density
  );
  const [useBrandDefaults, setUseBrandDefaults] = useStudioDraft(
    identity.id,
    tool.id,
    'use-brand-defaults',
    true
  );
  const [surface, setSurface] = useStudioDraft<'base' | 'soft' | 'inverse'>(
    identity.id,
    tool.id,
    'surface',
    'base'
  );
  const [size, setSize] = useStudioDraft<'sm' | 'default' | 'lg'>(
    identity.id,
    tool.id,
    'size',
    'default'
  );
  const [fontRole, setFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'font-role', 'Body');
  const [fontWeight, setFontWeight] = useStudioDraft(identity.id, tool.id, 'font-weight', brandTypographyRole(identity, 'Body').weight ?? 400);
  const [textScale, setTextScale] = useStudioDraft(identity.id, tool.id, 'text-scale', 100);
  const [letterSpacing, setLetterSpacing] = useStudioDraft(identity.id, tool.id, 'letter-spacing', 0);
  const [borderWidth, setBorderWidth] = useStudioDraft(identity.id, tool.id, 'border-width', 1);
  const [elevation, setElevation] = useStudioDraft<ComponentElevation>(identity.id, tool.id, 'elevation', 'soft');
  const [backgroundColor, setBackgroundColor] = useStudioDraft(identity.id, tool.id, 'color-background', brandPalette.background);
  const [surfaceColor, setSurfaceColor] = useStudioDraft(identity.id, tool.id, 'color-surface', brandPalette.surface);
  const [foregroundColor, setForegroundColor] = useStudioDraft(identity.id, tool.id, 'color-foreground', brandPalette.foreground);
  const [mutedColor, setMutedColor] = useStudioDraft(identity.id, tool.id, 'color-muted', brandPalette.muted);
  const [mutedForegroundColor, setMutedForegroundColor] = useStudioDraft(identity.id, tool.id, 'color-muted-foreground', brandPalette.mutedForeground);
  const [accentColor, setAccentColor] = useStudioDraft(identity.id, tool.id, 'color-accent', brandPalette.accent);
  const [accentForegroundColor, setAccentForegroundColor] = useStudioDraft(identity.id, tool.id, 'color-accent-foreground', brandPalette.accentForeground);
  const [borderColor, setBorderColor] = useStudioDraft(identity.id, tool.id, 'color-border', brandPalette.border);
  const [successColor, setSuccessColor] = useStudioDraft(identity.id, tool.id, 'color-success', brandPalette.success);
  const [dangerColor, setDangerColor] = useStudioDraft(identity.id, tool.id, 'color-danger', brandPalette.danger);
  const componentAssets = [...identity.assets, ...identity.proofAssets].filter((asset) => !asset.path.toLocaleLowerCase().endsWith('.pdf'));
  const [componentAssetId, setComponentAssetId] = useStudioDraft(identity.id, tool.id, 'asset-id', 'none');
  const [componentAssetOpacity, setComponentAssetOpacity] = useStudioDraft(identity.id, tool.id, 'asset-opacity', 10);
  const componentAsset = componentAssets.find(({ id }) => id === componentAssetId);
  const resolvedDensity = useBrandDefaults ? identity.style.density : density;
  const resolvedRadius = useBrandDefaults ? identity.style.borderRadius : radius;
  const resolvedFontRole = useBrandDefaults ? 'Body' : fontRole;
  const resolvedFontWeight = useBrandDefaults ? brandTypographyRole(identity, 'Body').weight ?? 400 : fontWeight;
  const customPalette: ComponentPalette = {
    accent: accentColor,
    accentForeground: accentForegroundColor,
    background: backgroundColor,
    border: borderColor,
    danger: dangerColor,
    foreground: foregroundColor,
    muted: mutedColor,
    mutedForeground: mutedForegroundColor,
    success: successColor,
    surface: surfaceColor,
  };
  const resolvedPalette = useBrandDefaults ? brandPalette : customPalette;
  const selectedPattern =
    COMPONENT_PATTERNS.some((item) => item.id === pattern && item.family === family)
      ? pattern
      : getFirstComponentPattern(family);
  const selectedPatternConfig =
    COMPONENT_PATTERNS.find((item) => item.id === selectedPattern) ?? COMPONENT_PATTERNS[0];

  function selectPattern(nextPattern: ComponentPatternId) {
    const nextPatternConfig = COMPONENT_PATTERNS.find((item) => item.id === nextPattern);
    if (!nextPatternConfig) return;
    setFamily(nextPatternConfig.family);
    setPattern(nextPattern);
  }

  function updateManualColor(setter: (value: string) => void, value: string) {
    setter(value);
    setUseBrandDefaults(false);
  }

  const sourceCode = stringifySource({
    asset: { id: componentAssetId, opacity: componentAssetOpacity },
    borderWidth,
    colors: customPalette,
    density,
    disabled,
    elevation,
    family,
    label,
    letterSpacing,
    pattern: selectedPattern,
    radius,
    size,
    supportingCopy,
    surface,
    textScale,
    typography: { role: fontRole, weight: fontWeight },
    useBrandDefaults,
  });

  function applySourceCode(source: string) {
    const next = parseSourceObject(source);
    const assetSource = sourceObject(next, 'asset') ?? {};
    const colorsSource = sourceObject(next, 'colors') ?? {};
    const typographySource = sourceObject(next, 'typography') ?? {};
    const nextFamily = sourceString(next, 'family', family);
    const nextPattern = sourceString(next, 'pattern', selectedPattern);
    const nextDensity = sourceString(next, 'density', density);
    const nextSurface = sourceString(next, 'surface', surface);
    const nextSize = sourceString(next, 'size', size);
    const nextElevation = sourceString(next, 'elevation', elevation);
    const nextRole = sourceString(typographySource, 'role', fontRole);
    const patternConfig = COMPONENT_PATTERNS.find(({ id }) => id === nextPattern);
    if (!COMPONENT_FAMILY_OPTIONS.some(({ value }) => value === nextFamily)) throw new Error(gt('Unknown component family.'));
    if (!patternConfig || patternConfig.family !== nextFamily) throw new Error(gt('The component does not belong to that family.'));
    if (!['compact', 'comfortable', 'spacious'].includes(nextDensity)) throw new Error(gt('Unknown component density.'));
    if (!['base', 'soft', 'inverse'].includes(nextSurface)) throw new Error(gt('Unknown component surface.'));
    if (!['sm', 'default', 'lg'].includes(nextSize)) throw new Error(gt('Unknown component size.'));
    if (!['none', 'soft', 'strong'].includes(nextElevation)) throw new Error(gt('Unknown component elevation.'));
    if (!identity.typography.some(({ role }) => role === nextRole)) throw new Error(gt('Unknown typography role.'));
    setFamily(nextFamily as ComponentFamily);
    setPattern(nextPattern as ComponentPatternId);
    setDensity(nextDensity as typeof density);
    setSurface(nextSurface as typeof surface);
    setSize(nextSize as typeof size);
    setElevation(nextElevation as ComponentElevation);
    setFontRole(nextRole as BrandTypography['role']);
    setLabel(sourceString(next, 'label', label));
    setSupportingCopy(sourceString(next, 'supportingCopy', supportingCopy));
    setDisabled(sourceBoolean(next, 'disabled', disabled));
    setRadius(sourceNumber(next, 'radius', radius));
    setBorderWidth(sourceNumber(next, 'borderWidth', borderWidth));
    setTextScale(sourceNumber(next, 'textScale', textScale));
    setLetterSpacing(sourceNumber(next, 'letterSpacing', letterSpacing));
    setUseBrandDefaults(sourceBoolean(next, 'useBrandDefaults', useBrandDefaults));
    setFontWeight(sourceNumber(typographySource, 'weight', fontWeight));
    setComponentAssetId(sourceString(assetSource, 'id', componentAssetId));
    setComponentAssetOpacity(sourceNumber(assetSource, 'opacity', componentAssetOpacity));
    setBackgroundColor(normalizeHexOrFallback(sourceString(colorsSource, 'background', backgroundColor), backgroundColor));
    setSurfaceColor(normalizeHexOrFallback(sourceString(colorsSource, 'surface', surfaceColor), surfaceColor));
    setForegroundColor(normalizeHexOrFallback(sourceString(colorsSource, 'foreground', foregroundColor), foregroundColor));
    setMutedColor(normalizeHexOrFallback(sourceString(colorsSource, 'muted', mutedColor), mutedColor));
    setMutedForegroundColor(normalizeHexOrFallback(sourceString(colorsSource, 'mutedForeground', mutedForegroundColor), mutedForegroundColor));
    setAccentColor(normalizeHexOrFallback(sourceString(colorsSource, 'accent', accentColor), accentColor));
    setAccentForegroundColor(normalizeHexOrFallback(sourceString(colorsSource, 'accentForeground', accentForegroundColor), accentForegroundColor));
    setBorderColor(normalizeHexOrFallback(sourceString(colorsSource, 'border', borderColor), borderColor));
    setSuccessColor(normalizeHexOrFallback(sourceString(colorsSource, 'success', successColor), successColor));
    setDangerColor(normalizeHexOrFallback(sourceString(colorsSource, 'danger', dangerColor), dangerColor));
  }

  const library = (
    <ComponentLibraryCatalog
      onSelect={selectPattern}
      selectedPattern={selectedPattern}
    />
  );

  const inspector = (
    <>
      <LabPanelHeading
        description={<T>Configuration updates the live preview without hiding the catalog.</T>}
        title={(
          <span className='component-library-inspector-title'>
            <ComponentPatternIcon pattern={selectedPattern} />
            {gt(selectedPatternConfig.label)}
          </span>
        )}
      />
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Label</T>}>
          <input
            className={INPUT_CLASS}
            onChange={(event) => setLabel(event.target.value)}
            value={label}
          />
        </Field>
        <Field label={<T>Supporting copy</T>}>
          <textarea
            className={TEXTAREA_CLASS}
            onChange={(event) => setSupportingCopy(event.target.value)}
            value={supportingCopy}
          />
        </Field>
      </ControlSection>
      <ControlSection title={<T>System</T>}>
        <label className='flex items-center justify-between gap-4 text-sm'>
          <span><T>Follow brand defaults</T></span>
          <StudioCheckbox
            checked={useBrandDefaults}
            onChange={(event) => setUseBrandDefaults(event.target.checked)}
          />
        </label>
        <Field label={<T>Component size</T>}>
          <StudioSelect
            ariaLabel='Component size'
            onValueChange={(value) => setSize(value as typeof size)}
            options={[
              { label: 'Small', value: 'sm' },
              { label: 'Default', value: 'default' },
              { label: 'Large', value: 'lg' },
            ]}
            value={size}
          />
        </Field>
        <Field label={<T>Density</T>}>
          <StudioSelect
            ariaLabel='Component density'
            onValueChange={(value) => {
              setDensity(value as typeof density);
              setUseBrandDefaults(false);
            }}
            options={[
              { label: 'Compact', value: 'compact' },
              { label: 'Comfortable', value: 'comfortable' },
              { label: 'Spacious', value: 'spacious' },
            ]}
            value={resolvedDensity}
          />
        </Field>
        <Field label={<T>Surface mode</T>}>
          <StudioSelect
            ariaLabel='Component surface'
            onValueChange={(value) => setSurface(value as typeof surface)}
            options={[
              { label: 'Base', value: 'base' },
              { label: 'Soft', value: 'soft' },
              { label: 'Inverse', value: 'inverse' },
            ]}
            value={surface}
          />
        </Field>
        <RangeField
          label={<T>Corner radius</T>}
          max={32}
          min={0}
          onChange={(value) => {
            setRadius(value);
            setUseBrandDefaults(false);
          }}
          suffix='px'
          value={resolvedRadius}
        />
        <RangeField label={<T>Border width</T>} max={4} min={0} onChange={setBorderWidth} suffix='px' value={borderWidth} />
        <Field label={<T>Elevation</T>}>
          <StudioSelect
            ariaLabel='Component elevation'
            onValueChange={(value) => setElevation(value as ComponentElevation)}
            options={[
              { label: 'None', value: 'none' },
              { label: 'Soft', value: 'soft' },
              { label: 'Strong', value: 'strong' },
            ]}
            value={elevation}
          />
        </Field>
        <label className='flex items-center justify-between gap-4 text-sm'>
          <T>Disabled state</T>
          <StudioCheckbox
            checked={disabled}
            onChange={(event) => setDisabled(event.target.checked)}
          />
        </label>
      </ControlSection>
      <ControlSection title={<T>Color system</T>}>
        <ColorControl ariaLabel={gt('Component canvas color')} label={<T>Canvas</T>} onChange={(value) => updateManualColor(setBackgroundColor, value)} onPreview={(value) => updateManualColor(setBackgroundColor, value)} value={resolvedPalette.background} />
        <ColorControl ariaLabel={gt('Component surface color')} label={<T>Surface</T>} onChange={(value) => updateManualColor(setSurfaceColor, value)} onPreview={(value) => updateManualColor(setSurfaceColor, value)} value={resolvedPalette.surface} />
        <ColorControl ariaLabel={gt('Component text color')} label={<T>Text</T>} onChange={(value) => updateManualColor(setForegroundColor, value)} onPreview={(value) => updateManualColor(setForegroundColor, value)} value={resolvedPalette.foreground} />
        <ColorControl ariaLabel={gt('Component accent color')} label={<T>Accent</T>} onChange={(value) => updateManualColor(setAccentColor, value)} onPreview={(value) => updateManualColor(setAccentColor, value)} value={resolvedPalette.accent} />
        <ColorControl ariaLabel={gt('Component accent text color')} label={<T>Accent text</T>} onChange={(value) => updateManualColor(setAccentForegroundColor, value)} onPreview={(value) => updateManualColor(setAccentForegroundColor, value)} value={resolvedPalette.accentForeground} />
        <ColorControl ariaLabel={gt('Component muted color')} label={<T>Muted surface</T>} onChange={(value) => updateManualColor(setMutedColor, value)} onPreview={(value) => updateManualColor(setMutedColor, value)} value={resolvedPalette.muted} />
        <ColorControl ariaLabel={gt('Component muted text color')} label={<T>Muted text</T>} onChange={(value) => updateManualColor(setMutedForegroundColor, value)} onPreview={(value) => updateManualColor(setMutedForegroundColor, value)} value={resolvedPalette.mutedForeground} />
        <ColorControl ariaLabel={gt('Component border color')} label={<T>Border</T>} onChange={(value) => updateManualColor(setBorderColor, value)} onPreview={(value) => updateManualColor(setBorderColor, value)} value={resolvedPalette.border} />
        <ColorControl ariaLabel={gt('Component success color')} label={<T>Success</T>} onChange={(value) => updateManualColor(setSuccessColor, value)} onPreview={(value) => updateManualColor(setSuccessColor, value)} value={resolvedPalette.success} />
        <ColorControl ariaLabel={gt('Component danger color')} label={<T>Danger</T>} onChange={(value) => updateManualColor(setDangerColor, value)} onPreview={(value) => updateManualColor(setDangerColor, value)} value={resolvedPalette.danger} />
      </ControlSection>
      <ControlSection title={<T>Typography</T>}>
        <Field label={<T>Font role</T>}><StudioSelect ariaLabel='Component font role' onValueChange={(value) => { const role = value as BrandTypography['role']; setFontRole(role); setFontWeight(brandTypographyRole(identity, role).weight ?? 400); setUseBrandDefaults(false); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={resolvedFontRole} /></Field>
        <RangeField label={<T>Font weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(value) => { setFontWeight(value); setUseBrandDefaults(false); }} step={50} value={resolvedFontWeight} />
        <RangeField label={<T>Text scale</T>} max={140} min={70} onChange={setTextScale} suffix='%' value={textScale} />
        <RangeField label={<T>Letter spacing</T>} max={12} min={-6} onChange={setLetterSpacing} suffix='%' value={letterSpacing} />
      </ControlSection>
      <ControlSection title={<T>Shared media</T>}>
        <Field label={<T>Shared asset</T>}><StudioSelect ariaLabel='Component shared asset' onValueChange={setComponentAssetId} options={[{ label: 'None', value: 'none' }, ...componentAssets.map((asset) => ({ label: `${asset.label} · ${asset.type}`, value: asset.id }))]} value={componentAsset?.id ?? 'none'} /></Field>
        {componentAsset ? <RangeField label={<T>Asset opacity</T>} max={100} min={0} onChange={setComponentAssetOpacity} value={componentAssetOpacity} /> : null}
      </ControlSection>
    </>
  );

  return (
    <ToolShell inspector={inspector} library={library} sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Component source') }} tool={tool}>
      <div className='grid min-h-full content-center p-5 sm:p-8'>
        <div
          className={`component-library-demo component-density-${resolvedDensity} relative mx-auto w-full max-w-5xl overflow-hidden smooth-shadow-ring-sm`}
          data-component-size={size}
          data-elevation={elevation}
          data-surface={surface}
          style={{ ...componentPreviewStyle(resolvedRadius, identity, { borderWidth, elevation, letterSpacing, palette: resolvedPalette, surface, textScale }), fontFamily: brandTypographyFamily(identity, resolvedFontRole), fontWeight: capVisibleFontWeight(resolvedFontWeight) }}
        >
          {componentAsset ? <img alt='' aria-hidden='true' className='pointer-events-none absolute inset-0 size-full object-cover' src={componentAsset.path} style={{ opacity: componentAssetOpacity / 100 }} /> : null}
          <header className='component-library-header relative z-10 flex items-center justify-between gap-6 border-b border-border px-5 py-4'>
            <div className='component-library-preview-title'>
              <span><ComponentPatternIcon pattern={selectedPattern} /></span>
              <div>
                <p className='text-sm font-semibold'>{gt(selectedPatternConfig.label)}</p>
                <p className='mt-1 text-xs capitalize text-muted-foreground'>{family} · {resolvedDensity}</p>
              </div>
            </div>
            <span className='font-mono text-xs text-muted-foreground'>
              {COMPONENT_PATTERNS.length} <T>patterns</T> · {COMPONENT_FAMILY_OPTIONS.length} <T>families</T>
            </span>
          </header>
          <div className='relative z-10'>
            <ComponentLibraryPreview
              disabled={disabled}
              identity={identity}
              label={label}
              pattern={selectedPattern}
              size={size}
              supportingCopy={supportingCopy}
            />
          </div>
        </div>
      </div>
    </ToolShell>
  );
}

function ToolPlaceholder({ tool }: { tool: StudioTool }) {
  return (
    <ToolShell inspector={<ControlSection title={<T>Asset inputs</T>}><UploadField accept='image/*' label='Add source asset' onFile={() => {}} /></ControlSection>} tool={tool}>
      <div className='grid min-h-full place-items-center p-8'>
        <div className='flex max-w-md flex-col items-center gap-4 text-center'>
          <FileImage className='size-8 text-muted-foreground' aria-hidden='true' />
          <h2 className='text-xl font-semibold'><T>Start with a source asset</T></h2>
          <p className='text-sm leading-6 text-muted-foreground'>{tool.description}</p>
        </div>
      </div>
    </ToolShell>
  );
}

function StudioToolWorkspace({
  active = true,
  hasPendingIdentityChanges,
  identity,
  onIdentityChange,
  onIdentitySave,
  tool,
}: {
  active?: boolean;
  hasPendingIdentityChanges: boolean;
  identity: BrandIdentity;
  onIdentityChange: (identity: BrandIdentity) => void;
  onIdentitySave: (identity: BrandIdentity) => void;
  tool: StudioTool;
}) {
  const renderers: Partial<Record<StudioToolId, ReactNode>> = {
    blog: <TemplateTool identity={identity} kind='blog' tool={tool} />,
    'brand-book': <BrandBook identity={identity} tool={tool} />,
    'brand-elements': <BrandElementsStudio identity={identity} tool={tool} />,
    buttons: <ComponentLibraryTool identity={identity} tool={tool} />,
    colors: <ColorTool identity={identity} tool={tool} />,
    'design-board': <DesignBoard identity={identity} tool={tool} />,
    identity: <BrandSettingsStudio hasPendingChanges={hasPendingIdentityChanges} identity={identity} onChange={onIdentityChange} tool={tool} />,
    material: <MaterialTool active={active} identity={identity} onIdentitySave={onIdentitySave} tool={tool} />,
    opengraph: <OpenGraphTool key={`${identity.id}:${tool.id}`} identity={identity} tool={tool} />,
    partnership: <TemplateTool identity={identity} kind='partnership' tool={tool} />,
    slides: <TemplateTool identity={identity} kind='slides' tool={tool} />,
    surface: <SurfaceTool active={active} identity={identity} tool={tool} />,
    terminal: <TerminalTool identity={identity} tool={tool} />,
    typography: <TypographyTool identity={identity} onIdentityChange={onIdentityChange} tool={tool} />,
  };

  return (
    <Fragment key={`${identity.id}:${tool.id}`}>
      {renderers[tool.id] ?? <ToolPlaceholder tool={tool} />}
    </Fragment>
  );
}

export default memo(StudioToolWorkspace);
