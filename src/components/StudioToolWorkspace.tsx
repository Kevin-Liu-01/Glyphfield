'use client';

import dynamic from 'next/dynamic';
import { memo, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  Check,
  Copy,
  Download,
  FileImage,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasLayerPanel from '@/components/CanvasLayerPanel';
import EditableCanvasLayer, {
  alignCanvasLayer,
  type CanvasLayerAlignment,
  type CanvasLayerGeometry,
  type CanvasLayerTransform,
} from '@/components/EditableCanvasLayer';
import ComponentLibraryPreview, {
  COMPONENT_FAMILY_OPTIONS,
  COMPONENT_PATTERNS,
  componentPreviewStyle,
  getFirstComponentPattern,
  type ComponentFamily,
  type ComponentPatternId,
} from '@/components/ComponentLibraryPreview';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { LabInspectorSection, LabPanelHeading, StudioSidebar } from '@/components/LabWorkspace';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioToolHeader from '@/components/StudioToolHeader';
import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  brandAssetPath,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandFontAsset,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { colorContrastRatio, formatOklch, hexToOklch, mixHexColors, normalizeHex, normalizeHexOrFallback, oklchToHex, resolveReadableColor } from '@/lib/color';
import {
  CODE_THEME,
  highlightCode,
  type CodeLanguage,
} from '@/lib/codeHighlight';
import {
  escapeXml,
  imageUrlToDataUrl,
  svgToPngBlob,
} from '@/lib/download';
import type { StudioTool, StudioToolId } from '@/lib/studioCatalog';
import {
  buildLogoSvgFilter,
  DEFAULT_LOGO_APPEARANCE,
  logoAppearanceCssFilter,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';
import {
  defaultTemplatePartner,
  templateBackgroundOptions,
  templateBrandLogo,
  templatePartnerOptions,
  type TemplateKind,
} from '@/lib/templateAssets';
import { buildTemplateSvg, type SlideLayout, type TemplateLayerId, type TemplateTexture } from '@/lib/templateSvg';
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT, measureTypingSample } from '@/lib/typography';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceObjectArray,
  sourceString,
  sourceStringArray,
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
  const assetRef = useRef<LocalAsset | null>(null);
  assetRef.current = asset;

  useMountEffect(
    () => () => {
      if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    }
  );

  function select(file: File) {
    if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    const nextAsset = { name: file.name, url: URL.createObjectURL(file) };
    assetRef.current = nextAsset;
    setAsset(nextAsset);
  }

  function clear() {
    if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    assetRef.current = null;
    setAsset(null);
  }

  return { asset, clear, select };
}

type CustomFontAsset = {
  family: string;
  name: string;
  url: string;
};

function readFileDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new DOMException('The selected file could not be read.'));
    });
    reader.addEventListener('error', () => reject(reader.error ?? new DOMException('The selected file could not be read.')));
    reader.readAsDataURL(file);
  });
}

function useCustomFont() {
  const [font, setFont] = useState<CustomFontAsset | null>(null);
  const fontRef = useRef(font);
  fontRef.current = font;

  useMountEffect(
    () => () => {
      if (fontRef.current) URL.revokeObjectURL(fontRef.current.url);
    }
  );

  async function select(file: File) {
    if (fontRef.current) URL.revokeObjectURL(fontRef.current.url);
    const url = URL.createObjectURL(file);
    const family = `Studio-${crypto.randomUUID()}`;
    const loadedFont = new FontFace(family, `url(${url})`);
    await loadedFont.load();
    document.fonts.add(loadedFont);
    setFont({ family, name: file.name, url });
  }

  return { font, select };
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
    onApply: (source: string) => void;
    source: string;
    title?: string;
  };
  tool: StudioTool;
}) {
  const gt = useGT();
  const [sourceOpen, setSourceOpen] = useState(false);

  return (
    <div className='tool-shell h-full min-h-0'>
      <StudioToolHeader
        actions={actions || sourceCode ? (
          <>
            {sourceCode ? <SourceCodeButton onClick={() => setSourceOpen(true)} /> : null}
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
        {sourceCode && sourceOpen ? (
          <SourceCodeDrawer
            format={sourceCode.format}
            key={tool.id}
            onApply={sourceCode.onApply}
            onClose={() => setSourceOpen(false)}
            source={sourceCode.source}
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
  step = 1,
  suffix = '',
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
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
      <input className='studio-range' max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type='range' value={resolvedValue} />
    </label>
  );
}

function SegmentedChoice<T extends string | number>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  const gt = useGT();

  return (
    <div className='grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border'>
      {options.map((option) => (
        <Button
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

async function resolveBrandMark(identity: BrandIdentity, inverted: boolean): Promise<string> {
  const path = brandAssetPath(identity, inverted ? 'mark-light' : 'mark-dark');
  return path ? imageUrlToDataUrl(path) : monogramDataUrl(identity, inverted ? '#FFFFFF' : '#18181B');
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

function OpenGraphTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:opengraph`);
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
  const defaultFontRole: BrandTypography['role'] = recipe === 'knowledge-beam' ? 'Body' : 'Display';
  const [title, setTitle] = useStudioDraft(
    identity.id,
    tool.id,
    'identity-title-v3',
    OPEN_GRAPH_TITLES[identity.id] ?? identity.tagline
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
    openGraphDefaultAssetId(identity) || 'none'
  );
  const [libraryLogoId, setLibraryLogoId] = useStudioDraft(
    identity.id,
    tool.id,
    'identity-logo-v2',
    defaultSurface === 'dark' ? 'mark-light' : 'mark-dark'
  );
  const [fontRole, setFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'font-role-v2', defaultFontRole);
  const [fontWeight, setFontWeight] = useStudioDraft(identity.id, tool.id, 'font-weight-v2', brandTypographyRole(identity, defaultFontRole).weight ?? MAX_VISIBLE_FONT_WEIGHT);
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
  const ink = identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B';
  const paper = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const foreground = surface === 'dark' ? paper : ink;
  const background = surface === 'dark' ? ink : paper;
  const defaultBackgroundId = openGraphDefaultAssetId(identity);
  const effectiveBackgroundId = libraryBackgroundId === 'none'
    ? ''
    : backgroundOptions.some(({ id }) => id === libraryBackgroundId)
      ? libraryBackgroundId
      : backgroundOptions.some(({ id }) => id === defaultBackgroundId)
        ? defaultBackgroundId
        : backgroundOptions[0]?.id ?? '';
  const selectedBackground = backgroundOptions.find(({ id }) => id === effectiveBackgroundId);
  const selectedLogo = logoOptions.find(({ id }) => id === libraryLogoId);
  const selectedTypography = brandTypographyRole(identity, fontRole);
  const selectedBrandFont = brandFontAssets(identity).find(({ id }) => id === selectedTypography.fontId);
  const selectedFontFamily = customFont.font?.family ?? brandTypographyFamily(identity, fontRole);
  const isMintlifyOpenGraph = recipe === 'knowledge-beam';
  const isTailwindOpenGraph = recipe === 'utility-wave';
  const usesMintlifyAtmosphere =
    !backgroundAsset.asset && !selectedBackground && isMintlifyOpenGraph;
  const usesTailwindAtmosphere =
    !backgroundAsset.asset && !selectedBackground && isTailwindOpenGraph;
  const usesBrandAtmosphere = usesMintlifyAtmosphere || usesTailwindAtmosphere;
  const hasOpenGraphMedia =
    usesBrandAtmosphere || Boolean(backgroundAsset.asset || selectedBackground);
  const hasCustomOpenGraphScene =
    !usesBrandAtmosphere &&
    !backgroundAsset.asset &&
    !selectedBackground &&
    (isMintlifyOpenGraph || isTailwindOpenGraph);
  const panelColor = openGraphPanelColor(identity, background);
  const panelForeground = openGraphPanelIsDark(identity) ? paper : ink;
  const emphasis = identity.colors.find(({ id }) => id === 'emphasis')?.hex ?? foreground;
  const proof =
    identity.id === 'gt'
      ? identity.website
      : identity.proof[0] ?? identity.products[0] ?? '';
  const proofChipIsDark = [
    'focus-window',
    'knowledge-beam',
    'network-horizon',
    'programmable-field',
    'translation-frame',
    'unified-terminal',
    'utility-wave',
  ].includes(recipe);
  const proofChipBackground = proofChipIsDark && emphasis === ink ? paper : emphasis;
  const proofChipForeground = resolveReadableColor(proofChipBackground, ink).color;
  const mediaObjectPosition = backgroundAsset.asset
    ? '50% 50%'
    : selectedBackground?.focalPoint
    ? `${selectedBackground.focalPoint.x * 100}% ${selectedBackground.focalPoint.y * 100}%`
    : '50% 50%';
  const titleLines = identity.id === 'gt' && title.trim() === OPEN_GRAPH_TITLES.gt
    ? ['Every language.', 'One source.']
    : identity.id === 'stripe' && title.trim() === OPEN_GRAPH_TITLES.stripe
      ? ['Build the internet', 'economy.']
      : isTailwindOpenGraph && title.trim() === 'Build anything. Directly in your markup.'
        ? ['Build anything.', 'Directly in your markup.']
        : splitLines(
            title,
            recipe === 'economic-ledger' ? 17 : isTailwindOpenGraph ? 22 : isMintlifyOpenGraph ? 26 : 22,
            2
          );
  const longestTitleLine = Math.max(...titleLines.map((line) => line.length), 1);
  const titleFontSize = longestTitleLine > 20 ? 48 : longestTitleLine > 17 ? 52 : 56;
  const titleLineHeight = Math.round(titleFontSize * 1.04);
  const promiseLines = splitLines(identity.strategy.promise, 44, 3);

  const sourceCode = stringifySource({
    background: {
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
      assetId: libraryLogoId,
      scale: logoScale,
      x: logoX,
      y: logoY,
    },
    surface,
    title,
  });

  function applySourceCode(source: string) {
    const value = parseSourceObject(source);
    const nextSurface = sourceString(value, 'surface', surface);
    if (nextSurface !== 'light' && nextSurface !== 'dark') {
      throw new TypeError('surface must be "light" or "dark".');
    }
    setTitle(sourceString(value, 'title', title));
    setSurface(nextSurface);
    setFontWeight(sourceNumber(value, 'fontWeight', fontWeight));
    const nextFontRole = sourceString(value, 'fontRole', fontRole);
    if (identity.typography.some(({ role }) => role === nextFontRole)) {
      setFontRole(nextFontRole as BrandTypography['role']);
    }
    const nextBackground = sourceObject(value, 'background');
    if (nextBackground) {
      setLibraryBackgroundId(sourceString(nextBackground, 'assetId', libraryBackgroundId));
      setBackgroundOpacity(sourceNumber(nextBackground, 'opacity', backgroundOpacity));
      setBackgroundScale(sourceNumber(nextBackground, 'scale', backgroundScale));
      setBackgroundX(sourceNumber(nextBackground, 'x', backgroundX));
      setBackgroundY(sourceNumber(nextBackground, 'y', backgroundY));
    }
    const nextLogo = sourceObject(value, 'logo');
    if (nextLogo) {
      setLibraryLogoId(sourceString(nextLogo, 'assetId', libraryLogoId));
      setLogoScale(sourceNumber(nextLogo, 'scale', logoScale));
      setLogoX(sourceNumber(nextLogo, 'x', logoX));
      setLogoY(sourceNumber(nextLogo, 'y', logoY));
      const nextAppearance = sourceObject(nextLogo, 'appearance');
      if (nextAppearance) {
        setLogoAppearance((current) => ({ ...current, ...nextAppearance } as LogoAppearanceSettings));
      }
    }
  }

  async function exportOpenGraph() {
    setExporting(true);
    studioExport.start('Rendering OpenGraph PNG preview');
    try {
      const mark = logoAsset.asset
        ? await imageUrlToDataUrl(logoAsset.asset.url)
        : selectedLogo
          ? await imageUrlToDataUrl(selectedLogo.path)
          : await resolveBrandMark(identity, surface === 'dark');
      const backgroundImage = backgroundAsset.asset
        ? await imageUrlToDataUrl(backgroundAsset.asset.url)
        : selectedBackground
          ? await imageUrlToDataUrl(selectedBackground.path)
          : null;
      const fontData = customFont.font
        ? await imageUrlToDataUrl(customFont.font.url)
        : selectedBrandFont
          ? await imageUrlToDataUrl(selectedBrandFont.path)
          : null;
      const fontDefinition = fontData
        ? `<style>@font-face{font-family:'StudioCustom';src:url('${fontData}')}</style>`
        : '';
      const fontFamily = fontData ? 'StudioCustom' : brandTypographyFamily(identity, fontRole);
      const mediaX = 620;
      const mediaY = 0;
      const mediaWidth = 580;
      const mediaHeight = 630;
      const resolvedMediaWidth = mediaWidth * (backgroundScale / 100);
      const resolvedMediaHeight = mediaHeight * (backgroundScale / 100);
      const resolvedMediaX = mediaX + (mediaWidth - resolvedMediaWidth) / 2 + (backgroundX / 100) * mediaWidth;
      const resolvedMediaY = mediaY + (mediaHeight - resolvedMediaHeight) / 2 + (backgroundY / 100) * mediaHeight;
      const exportedTitleLines = titleLines
        .map(
          (line, index) =>
            `<text x="72" y="${titleLines.length === 1 ? 392 : 350 + index * titleLineHeight}" fill="${foreground}" font-family="${fontFamily}" font-size="${titleFontSize}" font-weight="${capVisibleFontWeight(fontWeight)}" letter-spacing="${titleFontSize >= 54 ? -1.8 : -1.4}">${escapeXml(line)}</text>`
        )
        .join('');
      const promiseStartY = titleLines.length === 1 ? 438 : 350 + titleLines.length * titleLineHeight + 26;
      const exportedPromiseLines = promiseLines
        .map(
          (line, index) =>
            `<text x="72" y="${promiseStartY + index * 20}" fill="${foreground}" opacity="0.72" font-family="${fontFamily}" font-size="16" font-weight="400">${escapeXml(line)}</text>`
        )
        .join('');
      const proofChipY = Math.min(530, promiseStartY + promiseLines.length * 20 + 18);
      const proofChipHeight = 38;
      const proofChip = proof
        ? `<rect x="72" y="${proofChipY}" width="${Math.min(340, Math.max(124, proof.length * 8.5 + 36))}" height="${proofChipHeight}" fill="${proofChipBackground}"/><text x="90" y="${proofChipY + 24}" fill="${proofChipForeground}" font-family="${fontFamily}" font-size="13" font-weight="500" letter-spacing="-0.1">${escapeXml(proof)}</text>`
        : '';
      const mediaLayer = backgroundImage
        ? `<rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}" fill="${panelColor}"/><g clip-path="url(#opengraph-media)"><image href="${backgroundImage}" x="${resolvedMediaX}" y="${resolvedMediaY}" width="${resolvedMediaWidth}" height="${resolvedMediaHeight}" preserveAspectRatio="xMidYMid slice" opacity="${backgroundOpacity / 100}"/></g>`
        : recipe === 'translation-frame'
          ? `<rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}" fill="${panelColor}"/><rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}" fill="url(#opengraph-dots)"/><text x="724" y="242" fill="${panelForeground}" opacity="0.78" font-family="${fontFamily}" font-size="30" font-weight="500">Welcome</text><text x="934" y="242" fill="${panelForeground}" opacity="0.92" font-family="${fontFamily}" font-size="34" font-weight="500">你好</text><text x="724" y="348" fill="${panelForeground}" opacity="0.72" font-family="${fontFamily}" font-size="26" font-weight="500">Bienvenidos</text><text x="932" y="348" fill="${panelForeground}" opacity="0.84" font-family="${fontFamily}" font-size="30" font-weight="500">ようこそ</text><text x="820" y="448" fill="${panelForeground}" opacity="0.74" font-family="${fontFamily}" font-size="30" font-weight="500">أهلاً وسهلاً</text>`
          : `<rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}" fill="${panelColor}"/><rect x="${mediaX + 42}" y="154" width="${mediaWidth - 84}" height="76" fill="${panelForeground}" opacity="0.12"/><rect x="${mediaX + 42}" y="254" width="${mediaWidth - 164}" height="76" fill="${panelForeground}" opacity="0.2"/><rect x="${mediaX + 42}" y="354" width="${mediaWidth - 112}" height="76" fill="${panelForeground}" opacity="0.1"/>`;
      const mediaMetadataColor = backgroundImage ? '#FFFFFF' : panelForeground;
      const websiteMetadataLayer =
        identity.id === 'gt'
          ? ''
          : `<text x="1160" y="590" text-anchor="end" fill="${mediaMetadataColor}" opacity="0.84" font-family="${fontFamily}" font-size="13" font-weight="450">${escapeXml(identity.website)}</text>`;
      const mediaMetadataLayer = `${backgroundImage && identity.id !== 'gt' ? `<rect x="${mediaX}" y="480" width="${mediaWidth}" height="150" fill="url(#opengraph-media-bottom-scrim)"/>` : ''}${websiteMetadataLayer}`;
      const resolvedLogoSize = 52 * (logoScale / 100);
      const resolvedLogoX = 72 - (resolvedLogoSize - 52) / 2 + logoX;
      const resolvedLogoY = 64 - (resolvedLogoSize - 52) / 2 + logoY;
      if (hasCustomOpenGraphScene) {
        const customTitle = titleLines
          .map((line, index) => `<text x="72" y="${isMintlifyOpenGraph ? 318 + index * 62 : 326 + index * 54}" fill="${foreground}" font-family="${fontFamily}" font-size="${isMintlifyOpenGraph ? 54 : 46}" font-weight="${capVisibleFontWeight(fontWeight)}" letter-spacing="-1.5">${escapeXml(line)}</text>`)
          .join('');
        const customGradientDefinitions = isMintlifyOpenGraph
          ? `<linearGradient id="mintlify-panel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#F7FBF9"/><stop offset="1" stop-color="#EAF6F0"/></linearGradient><linearGradient id="mintlify-accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#0D9373"/><stop offset="1" stop-color="#54D6A0"/></linearGradient>`
          : `<linearGradient id="tailwind-signal" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#0EA5E9"/><stop offset="1" stop-color="#67E8F9"/></linearGradient>`;
        const customScene = isMintlifyOpenGraph
          ? `<rect x="620" y="72" width="508" height="486" fill="url(#mintlify-panel)"/><rect x="620" y="72" width="508" height="54" fill="#FFFFFF"/><circle cx="646" cy="99" r="4" fill="#0D9373"/><rect x="664" y="88" width="250" height="22" rx="11" fill="#E8F1ED"/><circle cx="682" cy="99" r="5" fill="none" stroke="#62746D" stroke-width="1.5"/><line x1="686" y1="103" x2="691" y2="108" stroke="#62746D" stroke-width="1.5"/><text x="702" y="103" fill="#62746D" font-family="${fontFamily}" font-size="10">Search documentation</text><rect x="620" y="126" width="132" height="432" fill="#EDF5F1"/><text x="642" y="166" fill="#66746E" font-family="${fontFamily}" font-size="10" font-weight="500">DOCUMENTATION</text><rect x="634" y="184" width="104" height="32" rx="4" fill="#DDF0E7"/><rect x="642" y="196" width="4" height="8" rx="2" fill="#0D9373"/><text x="654" y="203" fill="#12372C" font-family="${fontFamily}" font-size="11" font-weight="500">Introduction</text><text x="654" y="242" fill="#62746D" font-family="${fontFamily}" font-size="11">Quickstart</text><text x="654" y="276" fill="#62746D" font-family="${fontFamily}" font-size="11">Components</text><text x="654" y="310" fill="#62746D" font-family="${fontFamily}" font-size="11">API reference</text><text x="790" y="174" fill="#0F172A" font-family="${fontFamily}" font-size="11" font-weight="500">GETTING STARTED</text><text x="790" y="216" fill="#0F172A" font-family="${fontFamily}" font-size="30" font-weight="520" letter-spacing="-0.8">Build with context.</text><text x="790" y="248" fill="#62746D" font-family="${fontFamily}" font-size="12">Documentation for readers, builders,</text><text x="790" y="266" fill="#62746D" font-family="${fontFamily}" font-size="12">and the agents working beside them.</text><rect x="790" y="302" width="294" height="98" rx="8" fill="#10211C"/><circle cx="812" cy="326" r="5" fill="#54D6A0"/><text x="828" y="330" fill="#D8EEE5" font-family="${fontFamily}" font-size="11">Install the SDK</text><text x="812" y="365" fill="#8EAEA1" font-family="${fontFamily}" font-size="11">npm install @mintlify/sdk</text><rect x="790" y="424" width="138" height="84" rx="8" fill="#FFFFFF"/><rect x="946" y="424" width="138" height="84" rx="8" fill="#FFFFFF"/><rect x="806" y="442" width="28" height="28" rx="6" fill="url(#mintlify-accent)"/><rect x="962" y="442" width="28" height="28" rx="6" fill="#DDF0E7"/><text x="806" y="491" fill="#17372C" font-family="${fontFamily}" font-size="11" font-weight="500">Human-ready</text><text x="962" y="491" fill="#17372C" font-family="${fontFamily}" font-size="11" font-weight="500">Agent-ready</text>`
          : `<rect x="628" y="92" width="500" height="446" fill="#081A2B"/><rect x="628" y="92" width="500" height="54" fill="#0B2135"/><circle cx="652" cy="119" r="4" fill="#38BDF8"/><text x="670" y="123" fill="#BAE6FD" font-family="${fontFamily}" font-size="11" font-weight="500">component.tsx</text><text x="654" y="183" fill="#7DD3FC" font-family="${fontFamily}" font-size="11">&lt;div className=</text><text x="758" y="183" fill="#E0F2FE" font-family="${fontFamily}" font-size="11">&quot;grid gap-4 sm:grid-cols-2&quot;</text><text x="654" y="207" fill="#7DD3FC" font-family="${fontFamily}" font-size="11">&gt;</text><rect x="654" y="236" width="448" height="2" fill="url(#tailwind-signal)"/><rect x="654" y="270" width="448" height="224" rx="8" fill="#F8FAFC"/><rect x="678" y="294" width="186" height="176" rx="6" fill="#FFFFFF" stroke="#E2E8F0"/><rect x="888" y="294" width="190" height="176" rx="6" fill="#0F172A"/><rect x="698" y="316" width="74" height="10" rx="5" fill="#38BDF8"/><rect x="698" y="344" width="130" height="8" rx="4" fill="#CBD5E1"/><rect x="698" y="362" width="104" height="8" rx="4" fill="#E2E8F0"/><rect x="698" y="410" width="92" height="32" rx="5" fill="#0EA5E9"/><rect x="910" y="316" width="62" height="10" rx="5" fill="#7DD3FC"/><rect x="910" y="344" width="126" height="8" rx="4" fill="#334155"/><rect x="910" y="362" width="92" height="8" rx="4" fill="#334155"/><path d="M914 426 C938 396 964 446 990 414 S1040 426 1054 394" fill="none" stroke="url(#tailwind-signal)" stroke-width="6" stroke-linecap="round"/>`;
        const customDescription = isMintlifyOpenGraph
          ? `<text x="72" y="452" fill="${foreground}" opacity="0.68" font-family="${fontFamily}" font-size="17">One workspace for product knowledge,</text><text x="72" y="477" fill="${foreground}" opacity="0.68" font-family="${fontFamily}" font-size="17">from first read to final answer.</text>`
          : `<text x="72" y="458" fill="${foreground}" opacity="0.7" font-family="${fontFamily}" font-size="17">Compose the interface you mean</text><text x="72" y="483" fill="${foreground}" opacity="0.7" font-family="${fontFamily}" font-size="17">without leaving your markup.</text>`;
        const customSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs>${fontDefinition}${customGradientDefinitions}${buildLogoSvgFilter({ ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance }, foreground, 'opengraph-logo')}</defs><rect width="1200" height="630" fill="${background}"/>${customScene}<image href="${mark}" x="${resolvedLogoX}" y="${resolvedLogoY}" width="${resolvedLogoSize}" height="${resolvedLogoSize}" filter="url(#opengraph-logo)"/>${customTitle}${customDescription}</svg>`;
        const blob = await svgToPngBlob(customSvg, 1200, 630);
        setLastExport({ blob, fileName: 'studio-opengraph.png', format: 'PNG', height: 630, width: 1200 });
        return;
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs>${fontDefinition}<clipPath id="opengraph-media"><rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}"/></clipPath><linearGradient id="opengraph-media-top-scrim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#000000" stop-opacity="0.58"/><stop offset="1" stop-color="#000000" stop-opacity="0"/></linearGradient><linearGradient id="opengraph-media-bottom-scrim" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.58"/></linearGradient><pattern id="opengraph-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${panelForeground}" opacity="0.08"/></pattern>${buildLogoSvgFilter({ ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance }, foreground, 'opengraph-logo')}</defs><rect width="1200" height="630" fill="${background}"/>${mediaLayer}${mediaMetadataLayer}<image href="${mark}" x="${resolvedLogoX}" y="${resolvedLogoY}" width="${resolvedLogoSize}" height="${resolvedLogoSize}" filter="url(#opengraph-logo)"/>${exportedTitleLines}${exportedPromiseLines}${proofChip}</svg>`;
      const blob = await svgToPngBlob(svg, 1200, 630);
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
        {backgroundOptions.length > 0 ? <Field label={<T>Identity evidence</T>}><StudioSelect ariaLabel='Identity evidence' onValueChange={setLibraryBackgroundId} options={[{ label: gt('No supporting image'), value: 'none' }, ...backgroundOptions.map((asset) => ({ label: asset.label, value: asset.id }))]} value={libraryBackgroundId === 'none' ? 'none' : effectiveBackgroundId} /></Field> : null}
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
        {logoOptions.length > 0 ? <Field label={<T>Brand logo asset</T>}><StudioSelect ariaLabel='Brand logo asset' onValueChange={setLibraryLogoId} options={logoOptions.map((asset) => ({ label: asset.label, value: asset.id }))} value={libraryLogoId} /></Field> : null}
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
          <ExportPreview asset={lastExport} />
          <Button disabled={exporting} onClick={exportOpenGraph} type='button'>
            <Download aria-hidden='true' />
            <T>Export PNG</T>
          </Button>
        </>
      }
      inspector={inspector}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('OpenGraph source') }}
      tool={tool}
    >
      <CanvasViewport fontFamily={selectedFontFamily} fontWeight={capVisibleFontWeight(fontWeight)} identityId={identity.id} onDeselect={() => setLogoSelected(false)} stageClassName='grid min-h-full place-items-center p-6 lg:p-10' toolId={tool.id}>
        <div
          className='artifact-preview relative aspect-[1200/630] w-full max-w-5xl overflow-hidden rounded-md smooth-shadow-ring-sm'
          onPointerDown={() => setLogoSelected(false)}
          style={{ containerType: 'inline-size' }}
        >
          <div className='absolute inset-0' style={{ backgroundColor: background }} />
          {hasCustomOpenGraphScene ? (
            <>
              <div
                className='absolute bottom-[15%] left-[6%] flex w-[40%] flex-col items-start'
                style={{ color: foreground, fontFamily: selectedFontFamily }}
              >
                <p className={`${isTailwindOpenGraph ? 'text-[clamp(20px,3.1vw,38px)]' : 'text-[clamp(22px,4.6vw,56px)]'} font-medium leading-[1.04] tracking-[-0.035em]`}>
                  {titleLines.map((line, index) => (
                    <span className='block whitespace-nowrap' key={`${line}-${index}`}>{line}</span>
                  ))}
                </p>
                <p className='mt-[7%] max-w-[84%] text-[clamp(8px,1.35vw,16px)] font-normal leading-[1.45] opacity-[0.68]'>
                  {isMintlifyOpenGraph
                    ? 'One workspace for product knowledge, from first read to final answer.'
                    : 'Compose the interface you mean without leaving your markup.'}
                </p>
              </div>
              {isMintlifyOpenGraph ? (
                <div className='absolute left-[51.7%] top-[11.4%] h-[77.1%] w-[42.3%] overflow-hidden bg-[#f3f8f5] text-[#17372c]'>
                  <div className='flex h-[11%] items-center border-b border-[#dbe8e1] bg-white px-[4.6%]'>
                    <span className='size-[clamp(3px,0.55vw,6px)] rounded-full bg-[#0d9373]' />
                    <div className='ml-[4%] flex h-[43%] w-[58%] items-center rounded-full bg-[#e8f1ed] px-[4%] text-[clamp(5px,0.8vw,9px)] text-[#62746d]'>
                      <span className='mr-[4%] size-[clamp(4px,0.65vw,7px)] rounded-full border border-[#62746d]' />
                      Search documentation
                    </div>
                  </div>
                  <div className='flex h-[89%]'>
                    <div className='w-[26%] bg-[#edf5f1] px-[5%] py-[7%]'>
                      <p className='text-[clamp(4px,0.7vw,8px)] font-medium tracking-[0.08em] text-[#66746e]'>DOCUMENTATION</p>
                      <div className='mt-[12%] flex h-[10%] items-center rounded-[4px] bg-[#ddf0e7] px-[8%] text-[clamp(5px,0.8vw,9px)] font-medium text-[#12372c]'>
                        <span className='mr-[8%] h-[36%] w-[3px] rounded-full bg-[#0d9373]' />
                        Introduction
                      </div>
                      <div className='mt-[14%] space-y-[14%] pl-[8%] text-[clamp(5px,0.8vw,9px)] text-[#62746d]'>
                        <p>Quickstart</p>
                        <p>Components</p>
                        <p>API reference</p>
                      </div>
                    </div>
                    <div className='w-[74%] px-[8%] py-[9%]'>
                      <p className='text-[clamp(5px,0.8vw,9px)] font-medium tracking-[0.08em]'>GETTING STARTED</p>
                      <p className='mt-[6%] text-[clamp(14px,2.45vw,28px)] font-medium leading-none tracking-[-0.025em]'>Build with context.</p>
                      <p className='mt-[5%] max-w-[88%] text-[clamp(5px,0.9vw,10px)] leading-[1.5] text-[#62746d]'>Documentation for readers, builders, and the agents working beside them.</p>
                      <div className='mt-[8%] rounded-[6px] bg-[#10211c] px-[6%] py-[5%] text-[clamp(5px,0.82vw,9px)] text-[#d8eee5]'>
                        <div className='flex items-center'><span className='mr-[4%] size-[clamp(4px,0.7vw,7px)] rounded-full bg-[#54d6a0]' />Install the SDK</div>
                        <p className='mt-[6%] text-[#8eaea1]'>npm install @mintlify/sdk</p>
                      </div>
                      <div className='mt-[7%] grid grid-cols-2 gap-[5%]'>
                        <div className='bg-white p-[9%]'><span className='block size-[clamp(12px,2.2vw,25px)] rounded-[5px] bg-gradient-to-br from-[#0d9373] to-[#54d6a0]' /><p className='mt-[10%] text-[clamp(5px,0.82vw,9px)] font-medium'>Human-ready</p></div>
                        <div className='bg-white p-[9%]'><span className='block size-[clamp(12px,2.2vw,25px)] rounded-[5px] bg-[#ddf0e7]' /><p className='mt-[10%] text-[clamp(5px,0.82vw,9px)] font-medium'>Agent-ready</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className='absolute left-[52.3%] top-[14.6%] h-[70.8%] w-[41.7%] overflow-hidden bg-[#081a2b] text-[#e0f2fe]'>
                  <div className='flex h-[12%] items-center bg-[#0b2135] px-[5%] text-[clamp(5px,0.9vw,10px)] font-medium text-[#bae6fd]'>
                    <span className='mr-[4%] size-[clamp(3px,0.6vw,6px)] rounded-full bg-[#38bdf8]' />component.tsx
                  </div>
                  <div className='px-[5%] py-[7%]'>
                    <p className='text-[clamp(5px,0.9vw,10px)] text-[#7dd3fc]'>&lt;div className=<span className='text-[#e0f2fe]'>&quot;grid gap-4 sm:grid-cols-2&quot;</span>&gt;</p>
                    <div className='mt-[7%] h-[2px] w-full bg-gradient-to-r from-[#0ea5e9] to-[#67e8f9]' />
                    <div className='mt-[7%] grid grid-cols-2 gap-[5%] rounded-[7px] bg-[#f8fafc] p-[5%]'>
                      <div className='rounded-[5px] border border-[#e2e8f0] bg-white p-[9%]'>
                        <span className='block h-[6px] w-[42%] rounded-full bg-[#38bdf8]' />
                        <span className='mt-[10%] block h-[5px] w-[78%] rounded-full bg-[#cbd5e1]' />
                        <span className='mt-[6%] block h-[5px] w-[60%] rounded-full bg-[#e2e8f0]' />
                        <span className='mt-[24%] block h-[clamp(14px,2.5vw,28px)] w-[55%] rounded-[4px] bg-[#0ea5e9]' />
                      </div>
                      <div className='rounded-[5px] bg-[#0f172a] p-[9%]'>
                        <span className='block h-[6px] w-[38%] rounded-full bg-[#7dd3fc]' />
                        <span className='mt-[10%] block h-[5px] w-[75%] rounded-full bg-[#334155]' />
                        <span className='mt-[6%] block h-[5px] w-[54%] rounded-full bg-[#334155]' />
                        <svg aria-hidden='true' className='mt-[18%] h-[34%] w-full' viewBox='0 0 160 50'>
                          <defs><linearGradient id='tailwind-preview-signal'><stop stopColor='#0ea5e9' /><stop offset='1' stopColor='#67e8f9' /></linearGradient></defs>
                          <path d='M4 36 C28 6 52 48 78 18 S128 32 156 8' fill='none' stroke='url(#tailwind-preview-signal)' strokeLinecap='round' strokeWidth='6' />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className='absolute bottom-[12%] left-[6%] flex w-[45.5%] flex-col items-start'
                style={{ color: foreground, fontFamily: selectedFontFamily }}
              >
                <p
                  className='font-medium leading-[1.02] tracking-[-0.035em]'
                  style={{ fontSize: `clamp(18px, ${(titleFontSize / 12).toFixed(3)}cqw, ${titleFontSize}px)` }}
                >
                  {titleLines.map((line, index) => (
                    <span className='block max-w-full whitespace-nowrap' key={`${line}-${index}`}>{line}</span>
                  ))}
                </p>
                <p className='mt-[5%] line-clamp-3 max-w-[92%] text-[clamp(8px,1.35vw,16px)] font-normal leading-[1.35] opacity-70'>
                  {identity.strategy.promise}
                </p>
                {proof ? (
                  <span
                    className='mt-[5%] inline-flex min-h-[clamp(28px,3.2vw,38px)] max-w-full items-center truncate px-[4%] py-[2%] text-[clamp(7px,1.1vw,13px)] font-medium tracking-[-0.01em]'
                    style={{
                      backgroundColor: proofChipBackground,
                      color: proofChipForeground,
                    }}
                  >
                    {proof}
                  </span>
                ) : null}
              </div>
              <div
                className='absolute inset-y-0 right-0 w-[48.33%] overflow-hidden'
                style={{ backgroundColor: panelColor }}
              >
                {backgroundAsset.asset || selectedBackground ? (
                  <img
                    alt=''
                    className='size-full'
                    src={backgroundAsset.asset?.url ?? selectedBackground?.path}
                    style={{
                      objectFit: 'cover',
                      objectPosition: mediaObjectPosition,
                      opacity: backgroundOpacity / 100,
                      transform: `translate(${backgroundX}%, ${backgroundY}%) scale(${backgroundScale / 100})`,
                      transformOrigin: 'center',
                    }}
                  />
                ) : usesMintlifyAtmosphere ? (
                  <div className='relative size-full overflow-hidden bg-[#04110D]'>
                    <svg
                      aria-hidden='true'
                      className='size-full'
                      preserveAspectRatio='xMidYMid slice'
                      viewBox='0 0 580 630'
                    >
                      <defs>
                        <radialGradient
                          id={`${identity.id}-og-mint-glow`}
                          cx='52%'
                          cy='42%'
                          r='74%'
                        >
                          <stop offset='0%' stopColor='#70F1C2' stopOpacity='0.54' />
                          <stop offset='46%' stopColor='#18B985' stopOpacity='0.2' />
                          <stop offset='100%' stopColor='#04110D' stopOpacity='0' />
                        </radialGradient>
                        <linearGradient
                          id={`${identity.id}-og-mint-beam`}
                          x1='0%'
                          x2='100%'
                          y1='100%'
                          y2='0%'
                        >
                          <stop offset='0%' stopColor='#0A6A50' />
                          <stop offset='48%' stopColor='#7EF2CA' />
                          <stop offset='100%' stopColor='#E9FFF8' />
                        </linearGradient>
                        <pattern
                          id={`${identity.id}-og-mint-dots`}
                          width='18'
                          height='18'
                          patternUnits='userSpaceOnUse'
                        >
                          <circle cx='1' cy='1' r='1' fill='#D9FFF2' opacity='0.12' />
                        </pattern>
                      </defs>
                      <rect width='580' height='630' fill='#04110D' />
                      <rect
                        width='580'
                        height='630'
                        fill={`url(#${identity.id}-og-mint-glow)`}
                      />
                      <path
                        d='M-120 600 C40 480 150 390 250 270 S470 70 700 -80'
                        fill='none'
                        stroke={`url(#${identity.id}-og-mint-beam)`}
                        strokeWidth='104'
                        opacity='0.88'
                      />
                      <path
                        d='M-90 650 C80 530 210 430 315 300 S500 90 680 -30'
                        fill='none'
                        stroke='#DFFFF4'
                        strokeWidth='22'
                        opacity='0.28'
                      />
                      <path
                        d='M-80 500 C80 410 170 315 260 215 S470 45 660 -60'
                        fill='none'
                        stroke='#72EDC1'
                        strokeWidth='2'
                        opacity='0.78'
                      />
                      <rect
                        width='580'
                        height='630'
                        fill={`url(#${identity.id}-og-mint-dots)`}
                      />
                    </svg>
                  </div>
                ) : usesTailwindAtmosphere ? (
                  <div className='relative size-full overflow-hidden bg-[#061724]'>
                    <svg
                      aria-hidden='true'
                      className='size-full'
                      preserveAspectRatio='xMidYMid slice'
                      viewBox='0 0 580 630'
                    >
                      <defs>
                        <linearGradient
                          id={`${identity.id}-og-tailwind-current`}
                          x1='0%'
                          x2='100%'
                          y1='20%'
                          y2='80%'
                        >
                          <stop offset='0%' stopColor='#0EA5E9' />
                          <stop offset='50%' stopColor='#67E8F9' />
                          <stop offset='100%' stopColor='#38BDF8' />
                        </linearGradient>
                        <radialGradient
                          id={`${identity.id}-og-tailwind-glow`}
                          cx='58%'
                          cy='46%'
                          r='70%'
                        >
                          <stop offset='0%' stopColor='#38BDF8' stopOpacity='0.24' />
                          <stop offset='100%' stopColor='#061724' stopOpacity='0' />
                        </radialGradient>
                        <pattern
                          id={`${identity.id}-og-tailwind-dots`}
                          width='20'
                          height='20'
                          patternUnits='userSpaceOnUse'
                        >
                          <circle cx='1' cy='1' r='1' fill='#BAE6FD' opacity='0.1' />
                        </pattern>
                      </defs>
                      <rect width='580' height='630' fill='#061724' />
                      <rect
                        width='580'
                        height='630'
                        fill={`url(#${identity.id}-og-tailwind-glow)`}
                      />
                      <path
                        d='M-100 125 C40 10 155 245 310 130 S540 40 700 135'
                        fill='none'
                        stroke='#0EA5E9'
                        strokeWidth='90'
                        opacity='0.08'
                      />
                      <path
                        d='M-100 125 C40 10 155 245 310 130 S540 40 700 135'
                        fill='none'
                        stroke={`url(#${identity.id}-og-tailwind-current)`}
                        strokeWidth='20'
                        opacity='0.92'
                      />
                      <path
                        d='M-110 310 C50 205 175 420 330 310 S555 220 700 315'
                        fill='none'
                        stroke='#38BDF8'
                        strokeWidth='74'
                        opacity='0.07'
                      />
                      <path
                        d='M-110 310 C50 205 175 420 330 310 S555 220 700 315'
                        fill='none'
                        stroke={`url(#${identity.id}-og-tailwind-current)`}
                        strokeWidth='16'
                        opacity='0.78'
                      />
                      <path
                        d='M-100 495 C45 390 190 575 345 480 S545 385 700 480'
                        fill='none'
                        stroke={`url(#${identity.id}-og-tailwind-current)`}
                        strokeWidth='12'
                        opacity='0.62'
                      />
                      <rect
                        width='580'
                        height='630'
                        fill={`url(#${identity.id}-og-tailwind-dots)`}
                      />
                    </svg>
                  </div>
                ) : recipe === 'translation-frame' ? (
                  <div
                    className='grid size-full grid-cols-2 place-items-center gap-x-[6%] px-[8%] py-[10%] text-center font-medium'
                    style={{
                      backgroundImage: `radial-gradient(${panelForeground}18 1px, transparent 1px)`,
                      backgroundSize: '14px 14px',
                      color: panelForeground,
                    }}
                  >
                    <span className='text-[clamp(13px,2.5vw,30px)] opacity-80'>Welcome</span>
                    <span className='text-[clamp(15px,2.8vw,34px)] opacity-95'>你好</span>
                    <span className='text-[clamp(12px,2.2vw,26px)] opacity-75'>Bienvenidos</span>
                    <span className='text-[clamp(13px,2.5vw,30px)] opacity-85'>ようこそ</span>
                    <span className='col-span-2 text-[clamp(13px,2.5vw,30px)] opacity-75'>أهلاً وسهلاً</span>
                  </div>
                ) : (
                  <div className='flex size-full flex-col gap-[6%] p-[8%]' style={{ color: panelForeground }}>
                    <span className='mt-[18%] h-[16%] w-full bg-current opacity-10' />
                    <span className='h-[16%] w-[82%] bg-current opacity-20' />
                    <span className='h-[16%] w-[90%] bg-current opacity-10' />
                  </div>
                )}
                {hasOpenGraphMedia ? (
                  <span className='pointer-events-none absolute inset-x-0 bottom-0 h-[24%] bg-gradient-to-t from-black/60 to-transparent' />
                ) : null}
                {identity.id !== 'gt' ? (
                  <p
                    className='absolute bottom-[6%] right-[7%] text-[clamp(7px,1.15vw,13px)] font-normal'
                    style={{
                      color: hasOpenGraphMedia ? '#FFFFFF' : panelForeground,
                      fontFamily: selectedFontFamily,
                      opacity: 0.84,
                    }}
                  >
                    {identity.website}
                  </p>
                ) : null}
              </div>
            </>
          )}
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
            <img
              alt=''
              className='size-full object-contain'
              src={logoAsset.asset?.url ?? selectedLogo?.path ?? brandAssetPath(identity, surface === 'dark' ? 'mark-light' : 'mark-dark') ?? monogramDataUrl(identity, foreground)}
              style={{ filter: logoAppearanceCssFilter({ ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance }) }}
            />
          </EditableCanvasLayer>
          <PreviewLabel>1200 × 630</PreviewLabel>
        </div>
      </CanvasViewport>
    </ToolShell>
  );
}

function SurfaceTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  return <BackgroundStudio identity={identity} tool={{ ...tool, id: 'backgrounds' }} />;
}

function MaterialTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  return <LogoShaderStudio identity={identity} tool={{ ...tool, id: 'logo-shader' }} />;
}

type EditableColor = {
  hex: string;
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
      name: typeof source.name === 'string' ? source.name : fallback?.name ?? `Color ${index + 1}`,
      opacity,
      role: typeof source.role === 'string' ? source.role : fallback?.role ?? '',
    };
  });
}

function ColorTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const [storedColors, setColors] = useStudioDraft<EditableColor[]>(
    identity.id,
    tool.id,
    'colors',
    () => identity.colors.map(({ hex, name, role }) => ({ hex, name, opacity: 100, role }))
  );
  const colors = useMemo(
    () => sanitizeEditableColors(storedColors, identity.colors),
    [identity.colors, storedColors]
  );
  useEffect(() => {
    if (JSON.stringify(storedColors) !== JSON.stringify(colors)) setColors(colors);
  }, [colors, setColors, storedColors]);
  const [copied, setCopied] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contrastIndex, setContrastIndex] = useState(Math.min(1, identity.colors.length - 1));
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

  function updateSelectedColor(patch: Partial<EditableColor>) {
    setColors((current) => sanitizeEditableColors(current, identity.colors).map((color, index) => (
      index === resolvedSelectedIndex ? { ...color, ...patch } : color
    )));
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
    setColors(nextColors.map((color, index) => ({
      hex: normalizeHex(sourceString(color, 'hex', colors[index]?.hex ?? '#000000')),
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
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  const library = (
    <>
      <LabPanelHeading
        description={<T>Select a semantic token to edit and test in context.</T>}
        eyebrow={<T>Token library</T>}
        title={<T>Brand colors</T>}
      />
      <div className='color-lab-library'>
        {colors.map((color, index) => (
          <button
            aria-pressed={selectedIndex === index}
            className='color-lab-token'
            key={`${color.name}-${index}`}
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
        eyebrow={<T>Live inspector</T>}
        title={selectedColor.name}
      />
      <LabInspectorSection index='01' meta='OKLCH' title={<T>Color</T>}>
        <ColorControl
          ariaLabel={gt('Change {name}', { name: selectedColor.name })}
          label={<T>Exact color</T>}
          onChange={(hex) => updateSelectedColor({ hex })}
          onOpacityChange={(opacity) => updateSelectedColor({ opacity })}
          opacity={selectedColor.opacity}
          value={selectedColor.hex}
        />
        <RangeField label={<T>Lightness</T>} max={100} min={0} onChange={(lightness) => updateSelectedColor({ hex: oklchToHex({ ...selectedOklch, lightness: lightness / 100 }) })} suffix='%' value={Math.round(selectedOklch.lightness * 100)} />
        <RangeField label={<T>Chroma</T>} max={0.4} min={0} onChange={(chroma) => updateSelectedColor({ hex: oklchToHex({ ...selectedOklch, chroma }) })} step={0.005} value={Number(selectedOklch.chroma.toFixed(3))} />
        <RangeField label={<T>Hue</T>} max={360} min={0} onChange={(hue) => updateSelectedColor({ hex: oklchToHex({ ...selectedOklch, hue }) })} suffix='°' value={Math.round(selectedOklch.hue)} />
      </LabInspectorSection>
      <LabInspectorSection index='02' meta='Semantic' title={<T>Token</T>}>
        <Field label={<T>Name</T>}><input className={INPUT_CLASS} onChange={(event) => updateSelectedColor({ name: event.target.value })} value={selectedColor.name} /></Field>
        <Field label={<T>Role</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => updateSelectedColor({ role: event.target.value })} value={selectedColor.role} /></Field>
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
        <Button onClick={copyTokens} type='button' variant='outline'>
          {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
          {copied ? <T>Copied</T> : <T>Copy tokens</T>}
        </Button>
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
          <article
            aria-label={gt('Inspect and edit {name}', { name: selectedColor.name })}
            className='color-lab-proof'
            onClick={(event) => openColorPopoverFromClick(event, resolvedSelectedIndex)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              openColorPopover(event.currentTarget, resolvedSelectedIndex);
            }}
            role='button'
            data-auto-contrast={contrastResolution.fallbackApplied ? 'true' : 'false'}
            style={{ backgroundColor: selectedBackground, color: contrastColor }}
            tabIndex={0}
          >
            <div><span>{selectedColor.role || 'Semantic brand color'}{contrastResolution.fallbackApplied ? ' · Auto contrast' : ''}</span><code>{normalizeHex(selectedColor.hex)}</code></div>
            {proofLogo?.path ? (
              <img
                alt={`${identity.name} ${proofLogo.kind}`}
                className='color-lab-proof-logo'
                data-logo-kind={proofLogo.kind}
                src={proofLogo.path}
              />
            ) : <h2>{identity.shortName}</h2>}
            <p>{identity.tagline}</p>
            <span className='color-lab-proof-action' style={{ backgroundColor: contrastColor, color: actionTextColor }}><T>Primary action</T></span>
          </article>
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
                key={`${color.name}-canvas-${index}`}
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
              role='dialog'
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
                onChange={(hex) => updateSelectedColor({ hex })}
                onOpacityChange={(opacity) => updateSelectedColor({ opacity })}
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

function TypographyTool({ identity, onIdentityChange, tool }: { identity: BrandIdentity; onIdentityChange: (identity: BrandIdentity) => void; tool: StudioTool }) {
  const gt = useGT();
  const fonts = brandFontAssets(identity);
  const [selectedRole, setSelectedRole] = useState<BrandTypography['role']>('Display');
  const [sampleText, setSampleText] = useStudioDraft(identity.id, tool.id, 'sample-text', identity.tagline);
  const [previewSizes, setPreviewSizes] = useStudioDraft<Record<BrandTypography['role'], number>>(
    identity.id,
    tool.id,
    'preview-sizes',
    { Accent: 44, Body: 26, Code: 18, Display: 112 }
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
    const extension = file.name.split('.').pop()?.toLocaleLowerCase();
    const format: BrandFontAsset['format'] = extension === 'ttf'
      ? 'truetype'
      : extension === 'otf'
        ? 'opentype'
        : extension === 'woff'
          ? 'woff'
          : 'woff2';
    const family = file.name.replace(/\.(otf|ttf|woff2?)$/i, '').replace(/[-_]+/g, ' ');
    const nextFont: BrandFontAsset = {
      family,
      fileName: file.name,
      format,
      id: `font-${crypto.randomUUID()}`,
      label: family,
      path: await readFileDataUrl(file),
      style: file.name.toLocaleLowerCase().includes('italic') ? 'italic' : 'normal',
      weight: file.name.toLocaleLowerCase().includes('bold') ? 700 : 400,
    };
    onIdentityChange({ ...identity, fonts: [...fonts, nextFont] });
  }

  const selectedTypography = brandTypographyRole(identity, selectedRole);
  const selectedFamily = brandTypographyFamily(identity, selectedRole);
  const selectedSize = previewSizes[selectedRole] ?? ({ Accent: 44, Body: 26, Code: 18, Display: 112 } as const)[selectedRole];
  const selectedFont = fonts.find(({ id }) => id === selectedTypography.fontId)
    ?? fonts.find(({ family }) => family === selectedFamily);
  const familyAssets = fonts.filter(({ family }) => family === selectedFamily);
  const minimumSpecimenWeight = Math.max(100, selectedFont?.weightMin ?? Math.min(...familyAssets.map(({ weight }) => weight), 100));
  const maximumSpecimenWeight = Math.min(
    MAX_VISIBLE_FONT_WEIGHT,
    selectedFont?.weightMax ?? Math.max(...familyAssets.map(({ weight }) => weight), MAX_VISIBLE_FONT_WEIGHT)
  );
  const weightStep = Math.max(25, Math.round((maximumSpecimenWeight - minimumSpecimenWeight) / 3 / 25) * 25);
  const specimenWeights = Array.from(new Set([
    minimumSpecimenWeight,
    minimumSpecimenWeight + weightStep,
    minimumSpecimenWeight + weightStep * 2,
    maximumSpecimenWeight,
    capVisibleFontWeight(selectedTypography.weight ?? 400),
    ...familyAssets.map(({ weight }) => capVisibleFontWeight(weight)),
  ]))
    .filter((weight) => weight >= minimumSpecimenWeight && weight <= maximumSpecimenWeight)
    .sort((first, second) => first - second)
    .slice(0, 6);
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
        eyebrow={<T>Type library</T>}
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
        eyebrow={<T>Live inspector</T>}
        title={`${selectedRole} · ${selectedFamily}`}
      />
      <LabInspectorSection index='01' meta={selectedRole} title={<T>Typeface</T>}>
        <Field label={<T>Font family</T>}>
          <StudioSelect ariaLabel={`${selectedRole} font`} onValueChange={(fontId) => { const font = fonts.find((candidate) => candidate.id === fontId); if (font) updateRole(selectedRole, { family: font.family, fontId }); }} options={fonts.map((font) => ({ label: font.label, value: font.id }))} value={selectedTypography.fontId ?? fonts[0]?.id ?? ''} />
        </Field>
        <RangeField label={<T>Preview size</T>} max={selectedRole === 'Display' ? 180 : 96} min={10} onChange={(fontSize) => setPreviewSizes((current) => ({ ...current, [selectedRole]: fontSize }))} suffix='px' value={selectedSize} />
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

  const display = brandTypographyRole(identity, 'Display');
  const body = brandTypographyRole(identity, 'Body');
  const accent = brandTypographyRole(identity, 'Accent');
  const code = brandTypographyRole(identity, 'Code');
  const displayFamily = brandTypographyFamily(identity, 'Display');
  const bodyFamily = brandTypographyFamily(identity, 'Body');
  const accentFamily = brandTypographyFamily(identity, 'Accent');
  const codeFamily = brandTypographyFamily(identity, 'Code');
  const displayWeight = capVisibleFontWeight(display.weight ?? 400);
  const bodyWeight = capVisibleFontWeight(body.weight ?? 400);
  const accentWeight = capVisibleFontWeight(accent.weight ?? 400);
  const codeWeight = capVisibleFontWeight(code.weight ?? 400);
  const displayLineHeight = display.lineHeight ?? 1;
  const bodyLineHeight = body.lineHeight ?? 1.5;
  const primaryColor = identity.colors.find(({ id }) => id === 'emphasis')?.hex
    ?? identity.colors.find(({ name }) => name.toLocaleLowerCase() === 'primary')?.hex
    ?? identity.colors[0]?.hex
    ?? '#181818';
  const primaryForeground = hexToOklch(primaryColor).lightness < 0.58 ? '#FFFFFF' : '#111111';
  const codeLabel = identity.id === 'ramp' ? 'Operational data' : 'Command line';
  const codeSample = identity.id === 'ramp'
    ? '$24,680.00  /  Q3 2026  /  APPROVED'
    : `$ npx ${identity.id} build --brand`;

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
                  <label data-active={capVisibleFontWeight(selectedTypography.weight ?? 400) === weight} key={weight}>
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
                  </label>
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
              className='mt-7 max-w-[13ch] text-balance text-[clamp(3.5rem,8.5vw,8.75rem)] text-current'
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
                    {identity.id === 'ramp' ? codeSample : <><span className='mr-3 opacity-45'>$</span>{codeSample.slice(2)}</>}
                  </p>
                </div>
              </section>
              <section className='grid grid-cols-[auto_1fr] items-center gap-5 border-t border-border/80 p-5 sm:gap-8 sm:p-8 lg:p-10'>
                <p
                  className='text-6xl text-foreground sm:text-7xl'
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
  const highlightedLines = useMemo(() => highlightCode(code, language), [code, language]);
  const sourceCode = stringifySource({
    background: { assetId: terminalAssetId, opacity: terminalAssetOpacity },
    code,
    codeTypography: { role: codeFontRole, weight: codeFontWeight },
    language,
    title,
    titleTypography: { role: titleFontRole, weight: titleFontWeight },
  });

  function applySourceCode(source: string) {
    const value = parseSourceObject(source);
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
  }

  function changeLanguage(nextLanguage: CodeLanguage) {
    setLanguage(nextLanguage);
    setCode(CODE_SAMPLES[nextLanguage]);
  }

  async function exportTerminal() {
    setExporting(true);
    studioExport.start('Rendering terminal PNG preview');
    try {
      const [titleFontData, codeFontData, assetData] = await Promise.all([
        titleFont ? imageUrlToDataUrl(titleFont.path) : undefined,
        codeFont ? imageUrlToDataUrl(codeFont.path) : undefined,
        terminalAsset ? imageUrlToDataUrl(terminalAsset.path) : undefined,
      ]);
      const fontDefinitions = `<style>${titleFontData ? `@font-face{font-family:'StudioTerminalTitle';src:url('${titleFontData}')}` : ''}${codeFontData ? `@font-face{font-family:'StudioTerminalCode';src:url('${codeFontData}')}` : ''}</style>`;
      const assetLayer = assetData
        ? `<image href="${assetData}" width="1200" height="630" preserveAspectRatio="xMidYMid slice" opacity="${terminalAssetOpacity / 100}"/>`
        : '';
      const codeSvg = highlightedLines
        .slice(0, 12)
        .map(
          (line, index) => {
            const tokens = line.tokens.length > 0
              ? line.tokens
                  .map(
                    ({ color, content }) =>
                      `<tspan fill="${color}">${escapeXml(content)}</tspan>`
                  )
                  .join('')
              : '<tspan> </tspan>';
            return `<text x="92" y="${236 + index * 34}" fill="${CODE_THEME.foreground}" font-family="${codeFontData ? 'StudioTerminalCode' : escapeXml(brandTypographyFamily(identity, codeFontRole))}" font-size="21" font-weight="${capVisibleFontWeight(codeFontWeight)}" xml:space="preserve">${tokens}</text>`;
          }
        )
        .join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs>${fontDefinitions}</defs><rect width="1200" height="630" fill="${CODE_THEME.background}"/>${assetLayer}<text x="72" y="90" fill="${CODE_THEME.foreground}" font-family="${titleFontData ? 'StudioTerminalTitle' : escapeXml(brandTypographyFamily(identity, titleFontRole))}" font-size="42" font-weight="${capVisibleFontWeight(titleFontWeight)}">${escapeXml(title)}</text><text x="72" y="136" fill="${CODE_THEME.gutter}" font-family="${codeFontData ? 'StudioTerminalCode' : escapeXml(brandTypographyFamily(identity, codeFontRole))}" font-size="17" font-weight="${capVisibleFontWeight(codeFontWeight)}">${language.toLocaleUpperCase()}</text><rect x="72" y="174" width="1056" height="388" rx="8" fill="${CODE_THEME.background}" stroke="${CODE_THEME.border}"/>${codeSvg}</svg>`;
      const blob = await svgToPngBlob(svg, 1200, 630);
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
        <textarea className={`${TEXTAREA_CLASS} min-h-56 font-mono`} onChange={(event) => setCode(event.target.value)} spellCheck={false} value={code} />
      </ControlSection>
      <ControlSection title={<T>Typography</T>}>
        <Field label={<T>Title font</T>}><StudioSelect ariaLabel='Terminal title font' onValueChange={(value) => { const role = value as BrandTypography['role']; setTitleFontRole(role); setTitleFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={titleFontRole} /></Field>
        <RangeField label={<T>Title weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setTitleFontWeight} step={50} value={titleFontWeight} />
        <Field label={<T>Code font</T>}><StudioSelect ariaLabel='Terminal code font' onValueChange={(value) => { const role = value as BrandTypography['role']; setCodeFontRole(role); setCodeFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={codeFontRole} /></Field>
        <RangeField label={<T>Code weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setCodeFontWeight} step={50} value={codeFontWeight} />
      </ControlSection>
      <ControlSection title={<T>Brand asset</T>}>
        <Field label={<T>Card background</T>}><StudioSelect ariaLabel='Terminal card background' onValueChange={setTerminalAssetId} options={[{ label: 'None', value: 'none' }, ...terminalAssets.map((asset) => ({ label: `${asset.label} · ${asset.type}`, value: asset.id }))]} value={terminalAsset?.id ?? 'none'} /></Field>
        {terminalAsset ? <RangeField label={<T>Asset opacity</T>} max={100} min={0} onChange={setTerminalAssetOpacity} value={terminalAssetOpacity} /> : null}
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <>
          <ExportPreview asset={lastExport} />
          <Button disabled={exporting} onClick={exportTerminal} type='button'>
            <Download aria-hidden='true' />
            <T>Export PNG</T>
          </Button>
        </>
      }
      inspector={inspector}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Terminal source') }}
      tool={tool}
    >
      <div className='grid min-h-full place-items-center p-8 lg:p-14'>
        <div className='relative w-full max-w-4xl overflow-hidden rounded-lg bg-[#0D1117] text-[#E6EDF3] smooth-shadow-ring-lg smooth-ring-white/10'>
          {terminalAsset ? <img alt='' aria-hidden='true' className='pointer-events-none absolute inset-0 size-full object-cover' src={terminalAsset.path} style={{ opacity: terminalAssetOpacity / 100 }} /> : null}
          <div className='relative flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4'>
            <div className='flex flex-col gap-1'>
              <h2 className='text-lg' style={{ fontFamily: brandTypographyFamily(identity, titleFontRole), fontWeight: capVisibleFontWeight(titleFontWeight) }}>{title}</h2>
              <p className='text-[10px] uppercase tracking-widest text-[#8B949E]' style={{ fontFamily: brandTypographyFamily(identity, codeFontRole), fontWeight: capVisibleFontWeight(codeFontWeight) }}>
                {language}
              </p>
            </div>
            <div className='flex gap-1.5' aria-hidden='true'>
              <span className='size-1.5 rounded-full bg-white/20' />
              <span className='size-1.5 rounded-full bg-white/20' />
              <span className='size-1.5 rounded-full bg-white/20' />
            </div>
          </div>
          <pre className='studio-scroll-area relative min-h-72 overflow-auto bg-[#0D1117]/90 p-6 text-sm leading-7' style={{ fontFamily: brandTypographyFamily(identity, codeFontRole), fontWeight: capVisibleFontWeight(codeFontWeight) }}>
            {highlightedLines.map((line, index) => (
              <span className='grid grid-cols-[28px_1fr] gap-4' key={`${index}-${line.tokens.map(({ content }) => content).join('')}`}>
                <span className='select-none text-right text-[#6E7681]'>{index + 1}</span>
                <span>
                  {line.tokens.length > 0
                    ? line.tokens.map(({ color, content }, tokenIndex) => (
                        <span key={`${tokenIndex}-${content}`} style={{ color }}>{content}</span>
                      ))
                    : ' '}
                </span>
              </span>
            ))}
          </pre>
        </div>
      </div>
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

function SlideTemplatePreview({
  body,
  foreground,
  layout,
  title,
}: {
  body: string;
  foreground: string;
  layout: SlideLayout;
  title: string;
}) {
  const items = body.split('\n').map((item) => item.trim()).filter(Boolean);
  const resolvedItems = items.length > 0 ? items : ['Foundation', 'Expression', 'Application', 'Delivery'];
  if (layout === 'section') return <div className='relative flex flex-1 items-center'><span className='absolute -left-[1cqw] text-[30cqw] font-bold leading-none opacity-[0.08]'>01</span><h2 className='relative ml-[23cqw] max-w-[62cqw] text-[7cqw] font-semibold leading-[0.98] tracking-[-0.055em]'>{title}</h2></div>;
  if (layout === 'agenda') return <div className='grid flex-1 grid-cols-[1fr_0.8fr] items-center gap-[7cqw]'><div><h2 className='mt-[2cqw] text-[5.2cqw] font-semibold leading-[1.02] tracking-[-0.05em]'>{title}</h2></div><div className='flex flex-col'>{resolvedItems.slice(0, 4).map((item, index) => <div className='grid grid-cols-[4cqw_1fr] border-b py-[1.6cqw] text-[1.6cqw]' key={item} style={{ borderColor: `color-mix(in srgb, ${foreground} 18%, transparent)` }}><span className='opacity-35'>0{index + 1}</span><span>{item}</span></div>)}</div></div>;
  if (layout === 'split') return <div className='grid flex-1 grid-cols-2 items-center gap-[7cqw]'><div><h2 className='mt-[2cqw] text-[5cqw] font-semibold leading-[1] tracking-[-0.05em]'>{title}</h2></div><div className='border-l pl-[5cqw]' style={{ borderColor: `color-mix(in srgb, ${foreground} 18%, transparent)` }}>{resolvedItems.slice(0, 5).map((item, index) => <p className='mb-[2cqw] flex gap-[2cqw] text-[1.6cqw]' key={item}><span className='opacity-35'>0{index + 1}</span>{item}</p>)}</div></div>;
  if (layout === 'metrics') return <div className='flex flex-1 flex-col justify-center'><h2 className='mt-[1.5cqw] text-[4.2cqw] font-semibold tracking-[-0.045em]'>{title}</h2><div className='mt-[5cqw] grid grid-cols-3 gap-[1cqw]'>{[['98.7%', 'Coverage'], ['42', 'Markets'], ['7d', 'Launch']].map(([value, label]) => <div className='border p-[3cqw]' key={label} style={{ borderColor: `color-mix(in srgb, ${foreground} 20%, transparent)` }}><p className='text-[5cqw] font-semibold tracking-[-0.05em]'>{value}</p><p className='mt-[1cqw] text-[1.1cqw] opacity-50'>{label}</p></div>)}</div></div>;
  if (layout === 'quote') return <div className='relative flex flex-1 items-center pl-[9cqw]'><span className='absolute left-0 top-[9cqw] font-serif text-[16cqw] leading-none opacity-10'>“</span><div><h2 className='max-w-[75cqw] text-[5cqw] font-semibold leading-[1.08] tracking-[-0.045em]'>{title}</h2><p className='mt-[4cqw] text-[1.2cqw] opacity-55'>{resolvedItems[0] ?? 'Alex Morgan · Customer'}</p></div></div>;
  if (layout === 'timeline') return <div className='flex flex-1 flex-col justify-center'><h2 className='mt-[1.5cqw] text-[4.5cqw] font-semibold tracking-[-0.045em]'>{title}</h2><div className='relative mt-[7cqw] grid grid-cols-4'><span className='absolute left-0 right-0 top-[0.5cqw] h-px opacity-20' style={{ backgroundColor: foreground }} />{resolvedItems.slice(0, 4).map((item, index) => <div className='relative pt-[3cqw]' key={item}><span className='absolute top-0 size-[1cqw] rounded-full' style={{ backgroundColor: foreground }} /><p className='text-[1cqw] opacity-35'>0{index + 1}</p><p className='mt-[0.8cqw] text-[1.5cqw]'>{item}</p></div>)}</div></div>;
  if (layout === 'statement') return <div className='flex flex-1 flex-col items-center justify-center text-center'><h2 className='mt-[2cqw] max-w-[88cqw] text-[9cqw] font-semibold leading-[0.9] tracking-[-0.07em]'>{title}</h2></div>;
  if (layout === 'comparison') return <div className='flex flex-1 flex-col justify-center'><h2 className='mt-[1.5cqw] text-[4.2cqw] font-semibold tracking-[-0.045em]'>{title}</h2><div className='mt-[4cqw] grid grid-cols-2 gap-[1cqw]'>{[resolvedItems[0] ?? 'Before', resolvedItems[1] ?? 'After'].map((item, index) => <div className='min-h-[22cqw] border p-[3cqw]' key={item} style={{ borderColor: `color-mix(in srgb, ${foreground} 20%, transparent)` }}><p className='text-[1cqw] opacity-35'>0{index + 1}</p><p className='mt-[7cqw] text-[3cqw] font-semibold tracking-[-0.04em]'>{item}</p></div>)}</div></div>;
  if (layout === 'process') return <div className='flex flex-1 flex-col justify-center'><h2 className='mt-[1.5cqw] text-[4.2cqw] font-semibold tracking-[-0.045em]'>{title}</h2><div className='mt-[5cqw] grid grid-cols-4 gap-[1cqw]'>{resolvedItems.slice(0, 4).map((item, index) => <div className='min-h-[18cqw] border p-[2cqw]' key={item} style={{ borderColor: `color-mix(in srgb, ${foreground} 20%, transparent)` }}><p className='text-[1cqw] opacity-35'>0{index + 1}</p><p className='mt-[7cqw] text-[1.8cqw] font-semibold'>{item}</p></div>)}</div></div>;
  if (layout === 'chart') return <div className='grid flex-1 grid-cols-[0.7fr_1.3fr] items-center gap-[7cqw]'><div><h2 className='mt-[2cqw] text-[4.2cqw] font-semibold leading-[1] tracking-[-0.05em]'>{title}</h2><p className='mt-[4cqw] text-[8cqw] font-semibold tracking-[-0.07em]'>+42%</p><p className='text-[1cqw] opacity-40'>YEAR OVER YEAR</p></div><div className='flex h-[30cqw] items-end gap-[2cqw] border-b px-[2cqw]' style={{ borderColor: `color-mix(in srgb, ${foreground} 24%, transparent)` }}>{[42, 68, 55, 88, 76].map((value, index) => <span className='flex-1' key={value} style={{ backgroundColor: foreground, height: `${value}%`, opacity: 0.28 + index * 0.13 }} />)}</div></div>;
  if (layout === 'team') return <div className='flex flex-1 flex-col justify-center'><h2 className='mt-[1.5cqw] text-[4.2cqw] font-semibold tracking-[-0.045em]'>{title}</h2><div className='mt-[6cqw] grid grid-cols-3 gap-[4cqw]'>{resolvedItems.slice(0, 3).map((item, index) => <div className='text-center' key={item}><span className='mx-auto grid size-[12cqw] place-items-center rounded-full text-[3cqw] font-semibold' style={{ backgroundColor: `color-mix(in srgb, ${foreground} ${12 + index * 8}%, transparent)` }}>{item.slice(0, 2).toLocaleUpperCase()}</span><p className='mt-[2cqw] text-[1.5cqw] font-semibold'>{item}</p></div>)}</div></div>;
  if (layout === 'image') return <div className='grid flex-1 grid-cols-[0.82fr_1.18fr] items-center gap-[6cqw]'><div><h2 className='mt-[2cqw] text-[5cqw] font-semibold leading-[0.98] tracking-[-0.055em]'>{title}</h2><p className='mt-[3cqw] text-[1.4cqw] leading-[1.6] opacity-55'>{body}</p></div><div className='relative aspect-[4/3] overflow-hidden' style={{ backgroundColor: `color-mix(in srgb, ${foreground} 8%, transparent)` }}><span className='absolute inset-[12%] rounded-full border opacity-20' style={{ borderColor: foreground }} /><span className='absolute inset-0 bg-[linear-gradient(135deg,transparent_49.8%,currentColor_50%,transparent_50.2%)] opacity-10' /></div></div>;
  if (layout === 'closing') return <div className='flex flex-1 flex-col items-center justify-center text-center'><h2 className='mt-[2cqw] max-w-[75cqw] text-[7cqw] font-semibold leading-[0.98] tracking-[-0.055em]'>{title}</h2><p className='mt-[3cqw] max-w-[60cqw] text-[1.5cqw] opacity-55'>{body}</p></div>;
  return <div className='template-copy flex flex-1 flex-col justify-center'><h2 className='template-title mt-[2cqw] break-words font-semibold leading-[0.98] tracking-[-0.055em] text-balance'>{title}</h2></div>;
}

function TemplateTool({ identity, kind, tool }: { identity: BrandIdentity; kind: TemplateKind; tool: StudioTool }) {
  const gt = useGT();
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:${kind}`);
  const partnerAsset = useLocalAsset();
  const backgroundAsset = useLocalAsset();
  const backgroundOptions = useMemo(() => templateBackgroundOptions(identity), [identity]);
  const partnerOptions = useMemo(() => templatePartnerOptions(identity), [identity]);
  const initialPartner = defaultTemplatePartner(identity);
  const [partnerId, setPartnerId] = useStudioDraft(
    identity.id,
    tool.id,
    'partner',
    initialPartner.id
  );
  const selectedPartner = partnerOptions.find(({ id }) => id === partnerId) ?? initialPartner;
  const [title, setTitle] = useStudioDraft(
    identity.id,
    tool.id,
    'title',
    kind === 'partnership'
      ? `${identity.name} × ${initialPartner.label}`
      : kind === 'blog'
        ? identity.voice.phrases[0] ?? identity.tagline
        : identity.tagline
  );
  const [body, setBody] = useStudioDraft(
    identity.id,
    tool.id,
    'body',
    kind === 'slides'
      ? 'Foundation\nExpression\nApplication\nDelivery'
      : identity.description
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
  const [fontWeight, setFontWeight] = useStudioDraft(identity.id, tool.id, 'font-weight', brandTypographyRole(identity, 'Display').weight ?? MAX_VISIBLE_FONT_WEIGHT);
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
  const [selectedLayer, setSelectedLayer] = useState<TemplateLayerId | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const isDark = texture === 'dark';
  const foreground = isDark
    ? identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF'
    : identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B';
  const background = isDark
    ? identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B'
    : identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const isSlide = kind === 'slides';
  const width = isSlide ? 1600 : 1200;
  const height = isSlide ? 900 : kind === 'blog' ? 630 : 600;
  const brandLogo = templateBrandLogo(identity, kind, isDark);
  const displayFont = brandTypographyFamily(identity, fontRole);
  const selectedTypography = brandTypographyRole(identity, fontRole);
  const selectedFont = brandFontAssets(identity).find(({ id }) => id === selectedTypography.fontId);
  const selectedBackground = backgroundOptions.find(({ id }) => id === libraryBackgroundId);
  const brandLogoSource = brandLogo?.path ?? monogramDataUrl(identity, foreground);
  const partnerLogoSource = partnerAsset.asset?.url ?? selectedPartner.path;
  const layerTransforms: Record<TemplateLayerId, CanvasLayerTransform> = {
    brand: brandLayer,
    content: contentLayer,
    footer: footerLayer,
  };
  const layerGeometries: Record<TemplateLayerId, CanvasLayerGeometry> = {
    brand: { baseHeight: kind === 'partnership' ? 145 : 110, baseWidth: width - 168, baseX: 84, baseY: 54 },
    content: { baseHeight: height - (isSlide ? 250 : 260), baseWidth: width - 168, baseX: 84, baseY: isSlide ? 145 : 165 },
    footer: { baseHeight: 50, baseWidth: width - 168, baseX: 84, baseY: height - 104 },
  };

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

  const sourceCode = stringifySource({
    background: {
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
      id: partnerId,
      scale: partnerLogoScale,
      x: partnerLogoX,
      y: partnerLogoY,
    },
    slideLayout,
    texture: { opacity: textureOpacity, type: texture },
    title,
    typography: { role: fontRole, weight: fontWeight },
  });

  function applySourceCode(source: string) {
    const next = parseSourceObject(source);
    const backgroundSource = sourceObject(next, 'background') ?? {};
    const brandLogoSource = sourceObject(next, 'brandLogo') ?? {};
    const layersSource = sourceObject(next, 'layers') ?? {};
    const partnerSource = sourceObject(next, 'partner') ?? {};
    const textureSource = sourceObject(next, 'texture') ?? {};
    const typographySource = sourceObject(next, 'typography') ?? {};
    const nextLayout = sourceString(next, 'slideLayout', slideLayout);
    const nextTexture = sourceString(textureSource, 'type', texture);
    const nextRole = sourceString(typographySource, 'role', fontRole);
    const nextOrder = sourceStringArray(layersSource, 'order', layerOrder);
    const allowedLayers = ['brand', 'content', 'footer'];
    if (!SLIDE_LAYOUTS.some(({ id }) => id === nextLayout)) throw new Error(gt('Unknown slide layout.'));
    if (!['white', 'dark', 'grid', 'noise'].includes(nextTexture)) throw new Error(gt('Unknown surface texture.'));
    if (!identity.typography.some(({ role }) => role === nextRole)) throw new Error(gt('Unknown typography role.'));
    if (nextOrder.length !== allowedLayers.length || nextOrder.some((id) => !allowedLayers.includes(id))) {
      throw new Error(gt('Layer order must contain brand, content, and footer exactly once.'));
    }
    const readTransform = (key: TemplateLayerId, current: CanvasLayerTransform) => {
      const value = sourceObject(layersSource, key) ?? {};
      return {
        scale: sourceNumber(value, 'scale', current.scale),
        x: sourceNumber(value, 'x', current.x),
        y: sourceNumber(value, 'y', current.y),
      };
    };
    setTitle(sourceString(next, 'title', title));
    setBody(sourceString(next, 'body', body));
    setSlideLayout(nextLayout as SlideLayout);
    setTexture(nextTexture as TemplateTexture);
    setTextureOpacity(sourceNumber(textureSource, 'opacity', textureOpacity));
    setLibraryBackgroundId(sourceString(backgroundSource, 'libraryAssetId', libraryBackgroundId));
    setBackgroundOpacity(sourceNumber(backgroundSource, 'opacity', backgroundOpacity));
    setBackgroundScale(sourceNumber(backgroundSource, 'scale', backgroundScale));
    setBackgroundX(sourceNumber(backgroundSource, 'x', backgroundX));
    setBackgroundY(sourceNumber(backgroundSource, 'y', backgroundY));
    setBrandLogoScale(sourceNumber(brandLogoSource, 'scale', brandLogoScale));
    setBrandLogoX(sourceNumber(brandLogoSource, 'x', brandLogoX));
    setBrandLogoY(sourceNumber(brandLogoSource, 'y', brandLogoY));
    setPartnerId(sourceString(partnerSource, 'id', partnerId));
    setPartnerLogoScale(sourceNumber(partnerSource, 'scale', partnerLogoScale));
    setPartnerLogoX(sourceNumber(partnerSource, 'x', partnerLogoX));
    setPartnerLogoY(sourceNumber(partnerSource, 'y', partnerLogoY));
    setFontRole(nextRole as BrandTypography['role']);
    setFontWeight(sourceNumber(typographySource, 'weight', fontWeight));
    setBrandLayer(readTransform('brand', brandLayer));
    setContentLayer(readTransform('content', contentLayer));
    setFooterLayer(readTransform('footer', footerLayer));
    setLayerOrder(nextOrder as TemplateLayerId[]);
  }

  async function exportTemplate() {
    setExporting(true);
    studioExport.start(`Rendering ${kind} PNG preview`);
    try {
      const resolvedBrandLogo = brandLogo
        ? await imageUrlToDataUrl(brandLogo.path)
        : monogramDataUrl(identity, foreground);
      const partner = kind === 'partnership'
        ? await imageUrlToDataUrl(partnerLogoSource)
        : null;
      const backgroundImage = backgroundAsset.asset
        ? await imageUrlToDataUrl(backgroundAsset.asset.url)
        : selectedBackground
          ? await imageUrlToDataUrl(selectedBackground.path)
          : null;
      const fontData = selectedFont ? await imageUrlToDataUrl(selectedFont.path) : null;
      const svg = buildTemplateSvg({
        background,
        backgroundImage,
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
        foreground,
        fontData,
        fontFamily: displayFont,
        fontWeight: capVisibleFontWeight(fontWeight),
        height,
        identityName: identity.name,
        imageTreatment: identity.style.imageTreatment,
        invertPartner: isDark,
        kind,
        layerOrder,
        partnerLogo: partner,
        partnerLogoScale,
        partnerLogoX,
        partnerLogoY,
        slideLayout,
        texture,
        textureOpacity,
        title,
        footerScale: footerLayer.scale,
        footerX: footerLayer.x,
        footerY: footerLayer.y,
        website: identity.website,
        width,
      });
      const blob = await svgToPngBlob(svg, width, height);
      setLastExport({ blob, fileName: `studio-${kind}.png`, format: 'PNG', height, width });
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  const inspector = (
    <>
      <ControlSection title={<T>Content</T>}>
        <Field label={<T>Title</T>}>
          <textarea className={TEXTAREA_CLASS} onChange={(event) => setTitle(event.target.value)} value={title} />
        </Field>
        {kind === 'slides' ? <Field label={<T>Body or list · one item per line</T>}><textarea className={TEXTAREA_CLASS} onChange={(event) => setBody(event.target.value)} value={body} /></Field> : null}
        <Field label={<T>Typography role</T>}><StudioSelect ariaLabel='Template typography role' onValueChange={(value) => { const role = value as BrandTypography['role']; setFontRole(role); setFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={fontRole} /></Field>
        <RangeField label={<T>Font weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setFontWeight} step={50} value={fontWeight} />
      </ControlSection>
      {kind === 'slides' ? <ControlSection title={<T>Slide library</T>}>
        <div className='grid grid-cols-2 gap-2'>
          {SLIDE_LAYOUTS.map((layout) => <Button className='h-16 flex-col items-start gap-1 px-3' key={layout.id} onClick={() => setSlideLayout(layout.id)} type='button' variant={slideLayout === layout.id ? 'default' : 'outline'}><span className='font-mono text-lg'>{layout.symbol}</span><span className='text-xs'>{layout.label}</span></Button>)}
        </div>
      </ControlSection> : null}
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
        {backgroundOptions.length > 0 ? <Field label={<T>Brand background asset</T>}><StudioSelect ariaLabel='Brand background asset' onValueChange={setLibraryBackgroundId} options={[{ label: gt('No library background'), value: '' }, ...backgroundOptions.map((asset) => ({ label: asset.label, value: asset.id }))]} value={libraryBackgroundId} /></Field> : null}
        {texture === 'grid' || texture === 'noise' ? <RangeField label={<T>Texture opacity</T>} max={100} min={0} onChange={setTextureOpacity} suffix='%' value={textureOpacity} /> : null}
        {backgroundAsset.asset || selectedBackground ? (
          <div className='flex flex-col gap-4 border-t border-border pt-4'>
            <p className='text-xs font-semibold'><T>Background image</T></p>
            <RangeField label={<T>Opacity</T>} max={100} min={0} onChange={setBackgroundOpacity} suffix='%' value={backgroundOpacity} />
            <RangeField label={<T>Horizontal</T>} max={100} min={-100} onChange={setBackgroundX} suffix='%' value={backgroundX} />
            <RangeField label={<T>Vertical</T>} max={100} min={-100} onChange={setBackgroundY} suffix='%' value={backgroundY} />
            <RangeField label={<T>Scale</T>} max={240} min={50} onChange={setBackgroundScale} suffix='%' value={backgroundScale} />
          </div>
        ) : null}
        {kind === 'partnership' ? (
          <>
            <Field label={<T>Partner logo</T>}>
              <StudioSelect
                ariaLabel='Partner logo'
                onValueChange={(value) => {
                  partnerAsset.clear();
                  setPartnerId(value);
                }}
                options={partnerOptions.map((asset) => ({ label: asset.label, value: asset.id }))}
                value={partnerId}
              />
            </Field>
            <UploadField
              accept='image/*,.svg'
              fileName={partnerAsset.asset?.name}
              label='Replace partner logo'
              onFile={partnerAsset.select}
            />
          </>
        ) : null}
      </ControlSection>
      <ControlSection title={<T>Brand artwork</T>}>
        <RangeField label={<T>Horizontal</T>} max={240} min={-240} onChange={setBrandLogoX} suffix='px' value={brandLogoX} />
        <RangeField label={<T>Vertical</T>} max={180} min={-180} onChange={setBrandLogoY} suffix='px' value={brandLogoY} />
        <RangeField label={<T>Scale</T>} max={220} min={40} onChange={setBrandLogoScale} suffix='%' value={brandLogoScale} />
        {kind === 'partnership' ? (
          <div className='flex flex-col gap-4 border-t border-border pt-4'>
            <p className='text-xs font-semibold'><T>Partner artwork</T></p>
            <RangeField label={<T>Horizontal</T>} max={240} min={-240} onChange={setPartnerLogoX} suffix='px' value={partnerLogoX} />
            <RangeField label={<T>Vertical</T>} max={180} min={-180} onChange={setPartnerLogoY} suffix='px' value={partnerLogoY} />
            <RangeField label={<T>Scale</T>} max={220} min={40} onChange={setPartnerLogoScale} suffix='%' value={partnerLogoScale} />
          </div>
        ) : null}
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <>
          <ExportPreview asset={lastExport} />
          <Button disabled={exporting} onClick={exportTemplate} type='button'>
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
        <div
          className={`artifact-preview ratio-safe template-artboard template-artboard-${kind} relative w-full max-w-5xl overflow-hidden border border-border`}
          onPointerDown={() => setSelectedLayer(null)}
          style={{ aspectRatio: `${width} / ${height}`, backgroundColor: background, borderRadius: kind === 'slides' ? 0 : identity.style.borderRadius, color: foreground, fontFamily: displayFont, fontWeight: capVisibleFontWeight(fontWeight) }}
        >
          {backgroundAsset.asset || selectedBackground ? (
            <img alt='' className='absolute inset-0 size-full object-cover' src={backgroundAsset.asset?.url ?? selectedBackground?.path} style={{ filter: identity.style.imageTreatment === 'monochrome' ? 'grayscale(1) contrast(1.08)' : identity.style.imageTreatment === 'duotone' ? 'grayscale(1) sepia(1) hue-rotate(155deg) saturate(1.6)' : undefined, opacity: backgroundOpacity / 100, transform: `translate(${backgroundX}%, ${backgroundY}%) scale(${backgroundScale / 100})`, transformOrigin: 'center' }} />
          ) : null}
          {texture === 'grid' || texture === 'noise' ? <div className={`template-texture-layer template-surface-${texture} absolute inset-0`} style={{ opacity: textureOpacity / 100 }} /> : null}
          <EditableCanvasLayer {...layerGeometries.brand} canvasHeight={height} canvasWidth={width} label={gt('Brand lockup')} onChange={(transform) => updateLayer('brand', transform)} onDeselect={() => setSelectedLayer(null)} onSelect={() => setSelectedLayer('brand')} selected={selectedLayer === 'brand'} transform={brandLayer} zIndex={layerOrder.indexOf('brand') + 5}>
            {kind === 'partnership' ? (
              <div className='template-partnership-lockup h-full' aria-label={gt(`${identity.name} and ${selectedPartner.label}`)}>
                <img alt={identity.name} className='template-partnership-brand object-contain' src={brandLogoSource} style={{ transform: `translate(${brandLogoX}px, ${brandLogoY}px) scale(${brandLogoScale / 100})` }} />
                <span className='template-partnership-times' aria-hidden='true'>×</span>
                <img alt={partnerAsset.asset?.name ?? selectedPartner.label} className='template-partner-logo object-contain' src={partnerLogoSource} style={{ filter: isDark ? 'brightness(0) invert(1)' : undefined, transform: `translate(${partnerLogoX}px, ${partnerLogoY}px) scale(${partnerLogoScale / 100})` }} />
              </div>
            ) : (
              <div className='template-brand-lockup h-full'>
                <img alt={identity.name} className='template-brand-logo object-contain' src={brandLogoSource} style={{ transform: `translate(${brandLogoX}px, ${brandLogoY}px) scale(${brandLogoScale / 100})` }} />
              </div>
            )}
          </EditableCanvasLayer>
          <EditableCanvasLayer {...layerGeometries.content} canvasHeight={height} canvasWidth={width} label={gt('Content')} onChange={(transform) => updateLayer('content', transform)} onDeselect={() => setSelectedLayer(null)} onSelect={() => setSelectedLayer('content')} selected={selectedLayer === 'content'} transform={contentLayer} zIndex={layerOrder.indexOf('content') + 5}>
            <div className='flex size-full flex-col justify-center'>
              {isSlide ? <SlideTemplatePreview body={body} foreground={foreground} layout={slideLayout} title={title} /> : <div className='template-copy flex flex-col'><h2 className='template-title break-words font-semibold leading-[0.98] tracking-[-0.055em] text-balance'>{title}</h2></div>}
            </div>
          </EditableCanvasLayer>
          <EditableCanvasLayer {...layerGeometries.footer} canvasHeight={height} canvasWidth={width} label={gt('Footer')} onChange={(transform) => updateLayer('footer', transform)} onDeselect={() => setSelectedLayer(null)} onSelect={() => setSelectedLayer('footer')} selected={selectedLayer === 'footer'} transform={footerLayer} zIndex={layerOrder.indexOf('footer') + 5}>
            <div className='template-footer flex size-full items-center justify-between gap-4 opacity-60'>
              <span>{identity.website}</span>
              {isSlide ? <span>01 / 12</span> : null}
            </div>
          </EditableCanvasLayer>
        </div>
      </CanvasViewport>
    </ToolShell>
  );
}

function ComponentLibraryTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
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
  const componentAssets = [...identity.assets, ...identity.proofAssets].filter((asset) => !asset.path.toLocaleLowerCase().endsWith('.pdf'));
  const [componentAssetId, setComponentAssetId] = useStudioDraft(identity.id, tool.id, 'asset-id', 'none');
  const [componentAssetOpacity, setComponentAssetOpacity] = useStudioDraft(identity.id, tool.id, 'asset-opacity', 10);
  const componentAsset = componentAssets.find(({ id }) => id === componentAssetId);
  const resolvedDensity = useBrandDefaults ? identity.style.density : density;
  const resolvedRadius = useBrandDefaults ? identity.style.borderRadius : radius;
  const selectedPattern =
    COMPONENT_PATTERNS.some((item) => item.id === pattern && item.family === family)
      ? pattern
      : getFirstComponentPattern(family);
  const selectedPatternConfig =
    COMPONENT_PATTERNS.find((item) => item.id === selectedPattern) ?? COMPONENT_PATTERNS[0];
  const familyPatterns = COMPONENT_PATTERNS.filter((item) => item.family === family);

  function selectFamily(nextFamily: ComponentFamily) {
    setFamily(nextFamily);
    setPattern(getFirstComponentPattern(nextFamily));
  }

  function selectPattern(nextPattern: ComponentPatternId) {
    const nextPatternConfig = COMPONENT_PATTERNS.find((item) => item.id === nextPattern);
    if (!nextPatternConfig) return;
    setFamily(nextPatternConfig.family);
    setPattern(nextPattern);
  }

  const sourceCode = stringifySource({
    asset: { id: componentAssetId, opacity: componentAssetOpacity },
    density,
    disabled,
    family,
    label,
    pattern: selectedPattern,
    radius,
    size,
    supportingCopy,
    surface,
    typography: { role: fontRole, weight: fontWeight },
    useBrandDefaults,
  });

  function applySourceCode(source: string) {
    const next = parseSourceObject(source);
    const assetSource = sourceObject(next, 'asset') ?? {};
    const typographySource = sourceObject(next, 'typography') ?? {};
    const nextFamily = sourceString(next, 'family', family);
    const nextPattern = sourceString(next, 'pattern', selectedPattern);
    const nextDensity = sourceString(next, 'density', density);
    const nextSurface = sourceString(next, 'surface', surface);
    const nextSize = sourceString(next, 'size', size);
    const nextRole = sourceString(typographySource, 'role', fontRole);
    const patternConfig = COMPONENT_PATTERNS.find(({ id }) => id === nextPattern);
    if (!COMPONENT_FAMILY_OPTIONS.some(({ value }) => value === nextFamily)) throw new Error(gt('Unknown component family.'));
    if (!patternConfig || patternConfig.family !== nextFamily) throw new Error(gt('The component does not belong to that family.'));
    if (!['compact', 'comfortable', 'spacious'].includes(nextDensity)) throw new Error(gt('Unknown component density.'));
    if (!['base', 'soft', 'inverse'].includes(nextSurface)) throw new Error(gt('Unknown component surface.'));
    if (!['sm', 'default', 'lg'].includes(nextSize)) throw new Error(gt('Unknown component size.'));
    if (!identity.typography.some(({ role }) => role === nextRole)) throw new Error(gt('Unknown typography role.'));
    setFamily(nextFamily as ComponentFamily);
    setPattern(nextPattern as ComponentPatternId);
    setDensity(nextDensity as typeof density);
    setSurface(nextSurface as typeof surface);
    setSize(nextSize as typeof size);
    setFontRole(nextRole as BrandTypography['role']);
    setLabel(sourceString(next, 'label', label));
    setSupportingCopy(sourceString(next, 'supportingCopy', supportingCopy));
    setDisabled(sourceBoolean(next, 'disabled', disabled));
    setRadius(sourceNumber(next, 'radius', radius));
    setUseBrandDefaults(sourceBoolean(next, 'useBrandDefaults', useBrandDefaults));
    setFontWeight(sourceNumber(typographySource, 'weight', fontWeight));
    setComponentAssetId(sourceString(assetSource, 'id', componentAssetId));
    setComponentAssetOpacity(sourceNumber(assetSource, 'opacity', componentAssetOpacity));
  }

  const inspector = (
    <>
      <ControlSection title={<T>Component controls</T>}>
        <Field label={<T>Component family</T>}>
          <StudioSelect
            ariaLabel='Component family'
            onValueChange={(value) => selectFamily(value as ComponentFamily)}
            options={COMPONENT_FAMILY_OPTIONS}
            value={family}
          />
        </Field>
        <Field label={<T>Component</T>}>
          <StudioSelect
            ariaLabel='Component'
            onValueChange={(value) => selectPattern(value as ComponentPatternId)}
            options={familyPatterns.map((item) => ({ label: item.label, value: item.id }))}
            value={selectedPattern}
          />
        </Field>
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
        <Field label={<T>Size</T>}>
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
        <label className='flex items-center justify-between gap-4 text-sm'>
          <span><T>Follow brand defaults</T></span>
          <input
            checked={useBrandDefaults}
            onChange={(event) => setUseBrandDefaults(event.target.checked)}
            type='checkbox'
          />
        </label>
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
        <Field label={<T>Surface</T>}>
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
        <label className='flex items-center justify-between gap-4 text-sm'>
          <T>Disabled state</T>
          <input
            checked={disabled}
            onChange={(event) => setDisabled(event.target.checked)}
            type='checkbox'
          />
        </label>
      </ControlSection>
      <ControlSection title={<T>Brand expression</T>}>
        <Field label={<T>Font role</T>}><StudioSelect ariaLabel='Component font role' onValueChange={(value) => { const role = value as BrandTypography['role']; setFontRole(role); setFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={fontRole} /></Field>
        <RangeField label={<T>Font weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setFontWeight} step={50} value={fontWeight} />
        <Field label={<T>Shared asset</T>}><StudioSelect ariaLabel='Component shared asset' onValueChange={setComponentAssetId} options={[{ label: 'None', value: 'none' }, ...componentAssets.map((asset) => ({ label: `${asset.label} · ${asset.type}`, value: asset.id }))]} value={componentAsset?.id ?? 'none'} /></Field>
        {componentAsset ? <RangeField label={<T>Asset opacity</T>} max={100} min={0} onChange={setComponentAssetOpacity} value={componentAssetOpacity} /> : null}
      </ControlSection>
      <ControlSection title={<T>Included</T>}>
        <div className='grid grid-cols-2 gap-2 text-xs'>
          {COMPONENT_PATTERNS.map((item) => (
            <button
              aria-pressed={selectedPattern === item.id}
              className={`min-w-0 border px-2 py-1.5 text-left transition-colors ${
                selectedPattern === item.id
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground hover:border-foreground/45 hover:text-foreground'
              }`}
              key={item.id}
              onClick={() => selectPattern(item.id)}
              type='button'
            >
              {gt(item.label)}
            </button>
          ))}
        </div>
      </ControlSection>
    </>
  );

  return (
    <ToolShell inspector={inspector} sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Component source') }} tool={tool}>
      <div className='grid min-h-full content-center p-5 sm:p-8'>
        <div
          className={`component-library-demo component-density-${resolvedDensity} relative mx-auto w-full max-w-5xl overflow-hidden smooth-shadow-ring-sm`}
          data-surface={surface}
          style={{ ...componentPreviewStyle(resolvedRadius, identity), fontFamily: brandTypographyFamily(identity, fontRole), fontWeight: capVisibleFontWeight(fontWeight) }}
        >
          {componentAsset ? <img alt='' aria-hidden='true' className='pointer-events-none absolute inset-0 size-full object-cover' src={componentAsset.path} style={{ opacity: componentAssetOpacity / 100 }} /> : null}
          <header className='component-library-header relative z-10 flex items-center justify-between gap-6 border-b border-border px-5 py-4'>
            <div>
              <p className='text-sm font-semibold'>{gt(selectedPatternConfig.label)}</p>
              <p className='mt-1 text-xs capitalize opacity-55'>{family} · {resolvedDensity}</p>
            </div>
            <span className='font-mono text-xs opacity-55'>
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
  hasPendingIdentityChanges,
  identity,
  onIdentityChange,
  tool,
}: {
  hasPendingIdentityChanges: boolean;
  identity: BrandIdentity;
  onIdentityChange: (identity: BrandIdentity) => void;
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
    material: <MaterialTool identity={identity} tool={tool} />,
    opengraph: <OpenGraphTool key={`${identity.id}:${tool.id}`} identity={identity} tool={tool} />,
    partnership: <TemplateTool identity={identity} kind='partnership' tool={tool} />,
    slides: <TemplateTool identity={identity} kind='slides' tool={tool} />,
    surface: <SurfaceTool identity={identity} tool={tool} />,
    terminal: <TerminalTool identity={identity} tool={tool} />,
    typography: <TypographyTool identity={identity} onIdentityChange={onIdentityChange} tool={tool} />,
  };

  return renderers[tool.id] ?? <ToolPlaceholder tool={tool} />;
}

export default memo(StudioToolWorkspace);
