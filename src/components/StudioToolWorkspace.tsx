'use client';

import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import {
  Check,
  Copy,
  Download,
  FileImage,
  Upload,
} from 'lucide-react';

import DesignBoard from '@/components/DesignBoard';
import BrandElementsStudio from '@/components/BrandElementsStudio';
import BackgroundStudio from '@/components/BackgroundStudio';
import BrandSettingsStudio from '@/components/BrandSettingsStudio';
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
import LogoShaderStudio from '@/components/LogoShaderStudio';
import ResizableSidebar from '@/components/ResizableSidebar';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import LogoAppearancePreview from '@/components/LogoAppearancePreview';
import LiveMaterialCanvas from '@/components/LazyLiveMaterialCanvas';
import LiveMaterialControls from '@/components/LiveMaterialControls';
import { LiveMaterialSourceBadge } from '@/components/LiveMaterialSourceLabel';
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
import { formatOklch, normalizeHex } from '@/lib/color';
import {
  CODE_THEME,
  highlightCode,
  type CodeLanguage,
} from '@/lib/codeHighlight';
import {
  downloadSvgAsPng,
  escapeXml,
  imageUrlToDataUrl,
} from '@/lib/download';
import type { StudioTool, StudioToolId } from '@/lib/studioCatalog';
import {
  DEFAULT_LIVE_MATERIAL_ID,
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  brandMaterialPalette,
  getLiveMaterial,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from '@/lib/liveMaterials';
import {
  buildLogoSvgFilter,
  DEFAULT_LOGO_APPEARANCE,
  drawLogoAppearanceLayer,
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
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';
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
  sourceCode,
  tool,
}: {
  actions?: ReactNode;
  children: ReactNode;
  inspector: ReactNode;
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
      <header className='app-navbar tool-header flex items-center justify-between gap-4 border-b border-border px-5'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{gt(tool.name)}</p>
          <p className='truncate text-sm text-muted-foreground'>{gt(tool.description)}</p>
        </div>
        {actions || sourceCode ? (
          <div className='flex shrink-0 items-center gap-2'>
            {sourceCode ? <SourceCodeButton onClick={() => setSourceOpen(true)} /> : null}
            {actions}
          </div>
        ) : null}
      </header>
      <div className='tool-body'>
        <ResizableSidebar
          className='tool-inspector min-h-0 border-r border-border bg-background'
          label={gt(`${tool.name} controls`)}
          storageKey={`tool-${tool.id}`}
        >
          {inspector}
        </ResizableSidebar>
        <div className='tool-canvas min-h-0 overflow-auto'>{children}</div>
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
    <section className='flex flex-col gap-4 border-b border-border p-5 last:border-b-0'>
      <h2 className='text-sm font-semibold'>{title}</h2>
      {children}
    </section>
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
      <span className='flex items-center justify-between gap-3'>
        <span>{label}</span>
        <output className='font-mono text-xs tabular-nums'>{resolvedValue}{suffix}</output>
      </span>
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

function textureDefinition(texture: string, background: string): string {
  if (texture === 'grid') {
    return `<defs><pattern id="texture" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M 40 0 L 0 0 0 40" fill="none" stroke="#9A9A93" stroke-opacity="0.22" stroke-width="1"/></pattern></defs><rect width="100%" height="100%" fill="${background}"/><rect width="100%" height="100%" fill="url(#texture)"/>`;
  }

  if (texture === 'noise') {
    return `<defs><filter id="noise"><feTurbulence baseFrequency="0.75" numOctaves="2" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.08"/></feComponentTransfer></filter></defs><rect width="100%" height="100%" fill="${background}"/><rect width="100%" height="100%" filter="url(#noise)" opacity="0.45"/>`;
  }

  return `<rect width="100%" height="100%" fill="${background}"/>`;
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
  mintlify: 'Knowledge infrastructure for agents.',
  ramp: 'Save time. Save money.',
  starter: 'Make the signal visible.',
  stripe: 'Build the internet economy.',
  tailwind: 'CSS-first. Built for the modern web.',
  viteplus: 'One toolchain for the web.',
};

function openGraphDefaultAssetId(identity: BrandIdentity): string {
  const preferredIds: Readonly<Record<BrandIdentity['artDirection']['preview'], string[]>> = {
    'economic-ledger': ['library-editorial', 'library-detail', 'library-overview'],
    'editorial-interruption': ['library-editorial', 'library-overview', 'library-detail'],
    'focus-window': ['library-overview', 'library-editorial', 'library-detail'],
    'knowledge-beam': ['library-interface', 'library-overview', 'library-detail'],
    'network-horizon': ['library-overview', 'library-detail', 'library-atmosphere'],
    'programmable-field': ['library-overview', 'library-interface', 'library-detail'],
    'translation-frame': [],
    'unified-terminal': ['library-overview', 'library-atmosphere', 'library-detail'],
    'utility-wave': ['library-interface', 'library-overview', 'library-detail'],
  };
  const availableAssets = [...identity.assets, ...identity.proofAssets];

  return preferredIds[identity.artDirection.preview]
    .find((id) => availableAssets.some((asset) => asset.id === id)) ?? '';
}

function openGraphRecipeLabel(identity: BrandIdentity): string {
  const labels: Readonly<Record<BrandIdentity['artDirection']['preview'], string>> = {
    'economic-ledger': 'FINANCE OPERATIONS / CONTROL',
    'editorial-interruption': 'INDEPENDENT DIGITAL STUDIO',
    'focus-window': 'RESEARCH / DIRECTION / SYSTEM',
    'knowledge-beam': 'KNOWLEDGE FOR PEOPLE + AGENTS',
    'network-horizon': 'CONNECTIVITY CLOUD',
    'programmable-field': 'PROGRAMMABLE ECONOMY',
    'translation-frame': 'ONE SOURCE / EVERY LANGUAGE',
    'unified-terminal': 'ONE CONFIGURATION / ONE FLOW',
    'utility-wave': 'CSS-FIRST / MODERN WEB',
  };

  return labels[identity.artDirection.preview];
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
  const [title, setTitle] = useStudioDraft(
    identity.id,
    tool.id,
    'identity-title-v2',
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
    'identity-media-v5',
    openGraphDefaultAssetId(identity) || 'none'
  );
  const [libraryLogoId, setLibraryLogoId] = useStudioDraft(
    identity.id,
    tool.id,
    'identity-logo-v2',
    defaultSurface === 'dark' ? 'mark-light' : 'mark-dark'
  );
  const [fontRole, setFontRole] = useStudioDraft<BrandTypography['role']>(identity.id, tool.id, 'font-role', 'Display');
  const [fontWeight, setFontWeight] = useStudioDraft(identity.id, tool.id, 'font-weight', brandTypographyRole(identity, 'Display').weight ?? MAX_VISIBLE_FONT_WEIGHT);
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
  const recipe = identity.artDirection.preview;
  const recipeLabel = openGraphRecipeLabel(identity);
  const panelColor = openGraphPanelColor(identity, background);
  const panelForeground = openGraphPanelIsDark(identity) ? paper : ink;
  const emphasis = identity.colors.find(({ id }) => id === 'emphasis')?.hex ?? foreground;
  const proof = identity.proof[0] ?? identity.products[0] ?? '';
  const mediaObjectPosition = backgroundAsset.asset
    ? '50% 50%'
    : selectedBackground?.focalPoint
    ? `${selectedBackground.focalPoint.x * 100}% ${selectedBackground.focalPoint.y * 100}%`
    : '50% 50%';
  const mediaObjectFit = !backgroundAsset.asset && selectedBackground?.tags?.includes('centered-product')
    ? 'contain'
    : 'cover';
  const titleLines = splitLines(
    title,
    recipe === 'economic-ledger' ? 17 : 22,
    2
  );
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
      const mediaX = 684;
      const mediaY = 136;
      const mediaWidth = 444;
      const mediaHeight = 366;
      const resolvedMediaWidth = mediaWidth * (backgroundScale / 100);
      const resolvedMediaHeight = mediaHeight * (backgroundScale / 100);
      const resolvedMediaX = mediaX + (mediaWidth - resolvedMediaWidth) / 2 + (backgroundX / 100) * mediaWidth;
      const resolvedMediaY = mediaY + (mediaHeight - resolvedMediaHeight) / 2 + (backgroundY / 100) * mediaHeight;
      const exportedTitleLines = titleLines
        .map(
          (line, index) =>
            `<text x="72" y="${titleLines.length === 1 ? 392 : 350 + index * 58}" fill="${foreground}" font-family="${fontFamily}" font-size="56" font-weight="${capVisibleFontWeight(fontWeight)}" letter-spacing="-1.8">${escapeXml(line)}</text>`
        )
        .join('');
      const promiseStartY = titleLines.length === 1 ? 438 : 350 + titleLines.length * 58 + 26;
      const exportedPromiseLines = promiseLines
        .map(
          (line, index) =>
            `<text x="72" y="${promiseStartY + index * 20}" fill="${foreground}" opacity="0.72" font-family="${fontFamily}" font-size="16" font-weight="400">${escapeXml(line)}</text>`
        )
        .join('');
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
      const chipTextColor = proofChipIsDark ? (proofChipBackground === paper ? ink : paper) : ink;
      const proofChip = proof
        ? `<rect x="72" y="${Math.min(536, promiseStartY + promiseLines.length * 20 + 18)}" width="${Math.min(330, Math.max(114, proof.length * 8.5 + 28))}" height="32" fill="${proofChipBackground}"/><text x="86" y="${Math.min(558, promiseStartY + promiseLines.length * 20 + 40)}" fill="${chipTextColor}" font-family="${fontFamily}" font-size="13" font-weight="500">${escapeXml(proof)}</text>`
        : '';
      const mediaLayer = backgroundImage
        ? `<rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}" fill="${panelColor}"/><g clip-path="url(#opengraph-media)"><image href="${backgroundImage}" x="${resolvedMediaX}" y="${resolvedMediaY}" width="${resolvedMediaWidth}" height="${resolvedMediaHeight}" preserveAspectRatio="${mediaObjectFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}" opacity="${backgroundOpacity / 100}"/></g>`
        : recipe === 'translation-frame'
          ? `<rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}" fill="${panelColor}"/><rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}" fill="url(#opengraph-dots)"/><text x="724" y="242" fill="${panelForeground}" opacity="0.78" font-family="${fontFamily}" font-size="30" font-weight="500">Welcome</text><text x="934" y="242" fill="${panelForeground}" opacity="0.92" font-family="${fontFamily}" font-size="34" font-weight="500">你好</text><text x="724" y="348" fill="${panelForeground}" opacity="0.72" font-family="${fontFamily}" font-size="26" font-weight="500">Bienvenidos</text><text x="932" y="348" fill="${panelForeground}" opacity="0.84" font-family="${fontFamily}" font-size="30" font-weight="500">ようこそ</text><text x="820" y="448" fill="${panelForeground}" opacity="0.74" font-family="${fontFamily}" font-size="30" font-weight="500">أهلاً وسهلاً</text>`
          : `<rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}" fill="${panelColor}"/><text x="${mediaX + 34}" y="${mediaY + 56}" fill="${panelForeground}" opacity="0.6" font-family="${fontFamily}" font-size="12" font-weight="500" letter-spacing="1.4">${escapeXml(recipeLabel)}</text><rect x="${mediaX + 34}" y="${mediaY + 100}" width="${mediaWidth - 68}" height="54" fill="${panelForeground}" opacity="0.12"/><rect x="${mediaX + 34}" y="${mediaY + 174}" width="${mediaWidth - 132}" height="54" fill="${panelForeground}" opacity="0.2"/><rect x="${mediaX + 34}" y="${mediaY + 248}" width="${mediaWidth - 92}" height="54" fill="${panelForeground}" opacity="0.1"/>`;
      const resolvedLogoSize = 52 * (logoScale / 100);
      const resolvedLogoX = 72 - (resolvedLogoSize - 52) / 2 + logoX;
      const resolvedLogoY = 64 - (resolvedLogoSize - 52) / 2 + logoY;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs>${fontDefinition}<clipPath id="opengraph-media"><rect x="${mediaX}" y="${mediaY}" width="${mediaWidth}" height="${mediaHeight}"/></clipPath><pattern id="opengraph-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${panelForeground}" opacity="0.08"/></pattern>${buildLogoSvgFilter({ ...DEFAULT_LOGO_APPEARANCE, ...logoAppearance }, foreground, 'opengraph-logo')}</defs><rect width="1200" height="630" fill="${background}"/>${mediaLayer}<image href="${mark}" x="${resolvedLogoX}" y="${resolvedLogoY}" width="${resolvedLogoSize}" height="${resolvedLogoSize}" filter="url(#opengraph-logo)"/><text x="1128" y="88" text-anchor="end" fill="${foreground}" opacity="0.62" font-family="${fontFamily}" font-size="12" font-weight="500" letter-spacing="1.2">${escapeXml(recipeLabel)}</text>${exportedTitleLines}${exportedPromiseLines}${proofChip}<text x="1128" y="574" text-anchor="end" fill="${foreground}" opacity="0.58" font-family="${fontFamily}" font-size="13" font-weight="450">${escapeXml(identity.website)}</text></svg>`;
      await downloadSvgAsPng(svg, 1200, 630, 'studio-opengraph.png');
    } finally {
      setExporting(false);
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
          fileName={customFont.font?.name}
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
        <Button loading={exporting} onClick={exportOpenGraph} type='button'>
          <Download aria-hidden='true' />
          <T>Download PNG</T>
        </Button>
      }
      inspector={inspector}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('OpenGraph source') }}
      tool={tool}
    >
      <CanvasViewport fontFamily={selectedFontFamily} fontWeight={capVisibleFontWeight(fontWeight)} identityId={identity.id} onDeselect={() => setLogoSelected(false)} stageClassName='grid min-h-full place-items-center p-6 lg:p-10' toolId={tool.id}>
        <div className='artifact-preview relative aspect-[1200/630] w-full max-w-5xl overflow-hidden rounded-md border border-border shadow-sm' onPointerDown={() => setLogoSelected(false)}>
          <div className='absolute inset-0' style={{ backgroundColor: background }} />
          <p
            className='absolute right-[6%] top-[11%] max-w-[34%] text-right text-[clamp(7px,1.15vw,12px)] font-medium tracking-[0.1em] opacity-60'
            style={{ color: foreground, fontFamily: selectedFontFamily }}
          >
            {recipeLabel}
          </p>
          <div
            className='absolute bottom-[12%] left-[6%] flex w-[43%] flex-col items-start'
            style={{ color: foreground, fontFamily: selectedFontFamily }}
          >
            <p className='text-[clamp(22px,4.65vw,56px)] font-medium leading-[1.02] tracking-[-0.035em]'>
              {titleLines.map((line, index) => (
                <span className='block max-w-full overflow-hidden text-ellipsis whitespace-nowrap' key={`${line}-${index}`}>{line}</span>
              ))}
            </p>
            <p className='mt-[5%] line-clamp-3 max-w-[92%] text-[clamp(8px,1.35vw,16px)] font-normal leading-[1.35] opacity-70'>
              {identity.strategy.promise}
            </p>
            {proof ? (
              <span
                className='mt-[5%] max-w-full truncate px-[3%] py-[1.5%] text-[clamp(7px,1.1vw,13px)] font-medium'
                style={{
                  backgroundColor: openGraphPanelIsDark(identity) && emphasis === ink ? paper : emphasis,
                  color: openGraphPanelIsDark(identity)
                    ? (emphasis === ink ? ink : paper)
                    : ink,
                }}
              >
                {proof}
              </span>
            ) : null}
          </div>
          <div
            className='absolute left-[57%] top-[21.6%] h-[58%] w-[37%] overflow-hidden'
            style={{ backgroundColor: panelColor }}
          >
            {backgroundAsset.asset || selectedBackground ? (
              <img
                alt=''
                className='size-full'
                src={backgroundAsset.asset?.url ?? selectedBackground?.path}
                style={{
                  objectFit: mediaObjectFit,
                  objectPosition: mediaObjectPosition,
                  opacity: backgroundOpacity / 100,
                  transform: `translate(${backgroundX}%, ${backgroundY}%) scale(${backgroundScale / 100})`,
                  transformOrigin: 'center',
                }}
              />
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
                <p className='text-[clamp(6px,1vw,11px)] font-medium tracking-[0.1em] opacity-60'>{recipeLabel}</p>
                <span className='mt-[4%] h-[16%] w-full bg-current opacity-10' />
                <span className='h-[16%] w-[82%] bg-current opacity-20' />
                <span className='h-[16%] w-[90%] bg-current opacity-10' />
              </div>
            )}
          </div>
          <p
            className='absolute bottom-[8%] right-[6%] text-[clamp(7px,1.15vw,13px)] font-normal opacity-60'
            style={{ color: foreground, fontFamily: selectedFontFamily }}
          >
            {identity.website}
          </p>
          <EditableCanvasLayer
            baseHeight={52}
            baseWidth={52}
            baseX={72}
            baseY={64}
            canvasHeight={630}
            canvasWidth={1200}
            label={gt('Logo')}
            onChange={(next) => { setLogoX(next.x); setLogoY(next.y); setLogoScale(Math.round(next.scale * 100)); }}
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

type LogoSurface = 'white' | 'dark' | 'grid' | 'noise' | 'shader';

function LogoTool({
  identity,
  navigation,
  tool,
}: {
  identity: BrandIdentity;
  navigation?: ReactNode;
  tool: StudioTool;
}) {
  const gt = useGT();
  const defaultPalette = brandMaterialPalette(identity);
  const previewRef = useRef<HTMLDivElement>(null);
  const markPath = brandAssetPath(identity, 'mark-dark');
  const ink = identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B';
  const paper = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const logoColors = [
    identity.colors.find(({ id }) => id === 'ink'),
    identity.colors.find(({ id }) => id === 'paper'),
    identity.colors.find(({ id }) => id === 'emphasis'),
    identity.colors.find(({ id }) => id === 'success'),
  ].filter((color) => color !== undefined);
  const [tone, setTone] = useStudioDraft(identity.id, tool.id, 'tone', logoColors[0]?.id ?? 'ink');
  const [logoColor, setLogoColor] = useStudioDraft(identity.id, tool.id, 'logo-color', logoColors[0]?.hex ?? '#18181B');
  const [surface, setSurface] = useStudioDraft<LogoSurface>(identity.id, tool.id, 'surface', 'white');
  const [size, setSize] = useStudioDraft<64 | 128>(identity.id, tool.id, 'size', 128);
  const [transparent, setTransparent] = useStudioDraft(identity.id, tool.id, 'transparent', false);
  const [materialId, setMaterialId] = useStudioDraft<LiveMaterialId>(identity.id, tool.id, 'material', DEFAULT_LIVE_MATERIAL_ID);
  const [materialSettings, setMaterialSettings] = useStudioDraft<LiveMaterialSettings>(
    identity.id,
    tool.id,
    'material-settings',
    () => ({
      ...DEFAULT_LIVE_MATERIAL_SETTINGS,
      colorA: defaultPalette.colors[0],
      colorB: defaultPalette.colors[1],
      colorC: defaultPalette.colors[2],
    })
  );
  const [appearance, setAppearance] = useStudioDraft<LogoAppearanceSettings>(identity.id, tool.id, 'logo-appearance', DEFAULT_LOGO_APPEARANCE);
  const [logoTransform, setLogoTransform] = useStudioDraft<CanvasLayerTransform>(identity.id, tool.id, 'logo-transform', { scale: 1, x: 0, y: 0 });
  const [logoSelected, setLogoSelected] = useState(false);
  const [exporting, setExporting] = useState(false);
  const selectedColor = logoColors.find(({ id }) => id === tone) ?? {
    hex: logoColor,
    id: 'ink',
    name: 'Custom',
  };
  const surfaceColor = surface === 'dark' ? ink : paper;

  const sourceCode = stringifySource({
    appearance,
    color: logoColor,
    material: {
      id: materialId,
      settings: materialSettings,
    },
    size,
    surface,
    tone,
    transform: logoTransform,
    transparent,
  });

  function applySourceCode(source: string) {
    const value = parseSourceObject(source);
    const nextSurface = sourceString(value, 'surface', surface);
    if (!['white', 'dark', 'grid', 'noise', 'shader'].includes(nextSurface)) {
      throw new TypeError('surface is not a supported logo surface.');
    }
    const nextSize = sourceNumber(value, 'size', size);
    if (nextSize !== 64 && nextSize !== 128) {
      throw new TypeError('size must be 64 or 128.');
    }
    setTone(sourceString(value, 'tone', tone));
    setLogoColor(sourceString(value, 'color', logoColor));
    setSurface(nextSurface as LogoSurface);
    setSize(nextSize);
    setTransparent(sourceBoolean(value, 'transparent', transparent));
    const nextTransform = sourceObject(value, 'transform');
    if (nextTransform) {
      setLogoTransform({
        scale: sourceNumber(nextTransform, 'scale', logoTransform.scale),
        x: sourceNumber(nextTransform, 'x', logoTransform.x),
        y: sourceNumber(nextTransform, 'y', logoTransform.y),
      });
    }
    const nextAppearance = sourceObject(value, 'appearance');
    if (nextAppearance) {
      setAppearance((current) => ({ ...current, ...nextAppearance } as LogoAppearanceSettings));
    }
    const nextMaterial = sourceObject(value, 'material');
    if (nextMaterial) {
      setMaterialId(sourceString(nextMaterial, 'id', materialId) as LiveMaterialId);
      const nextSettings = sourceObject(nextMaterial, 'settings');
      if (nextSettings) {
        setMaterialSettings((current) => ({ ...current, ...nextSettings } as LiveMaterialSettings));
      }
    }
  }

  async function exportLogo() {
    setExporting(true);
    try {
      const mark = await resolveBrandMark(identity, false);
      if (surface === 'shader' && !transparent) {
        const shaderCanvas = previewRef.current?.querySelector('canvas');
        if (!shaderCanvas) return;
        const output = document.createElement('canvas');
        output.width = size;
        output.height = size;
        const context = output.getContext('2d');
        if (!context) return;
        context.drawImage(shaderCanvas, 0, 0, size, size);
        const image = new Image();
        image.src = mark;
        await image.decode();
        const inset = Math.round(size * 0.14);
        const markSize = size - inset * 2;
        const tinted = document.createElement('canvas');
        tinted.width = markSize;
        tinted.height = markSize;
        const tintedContext = tinted.getContext('2d');
        if (!tintedContext) return;
        tintedContext.drawImage(image, 0, 0, markSize, markSize);
        tintedContext.globalCompositeOperation = 'source-in';
        tintedContext.fillStyle = selectedColor.hex;
        tintedContext.fillRect(0, 0, markSize, markSize);
        const resolvedMarkSize = markSize * logoTransform.scale;
        drawLogoAppearanceLayer(
          context,
          tinted,
          inset + logoTransform.x * (size / 512) - (resolvedMarkSize - markSize) / 2,
          inset + logoTransform.y * (size / 512) - (resolvedMarkSize - markSize) / 2,
          resolvedMarkSize,
          resolvedMarkSize,
          appearance
        );
        const url = output.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${identity.id}-mark-${tone}-${size}.png`;
        link.href = url;
        link.click();
        return;
      }
      const backgroundLayer = transparent
        ? ''
        : textureDefinition(surface, surfaceColor);
      const inset = Math.round(size * 0.14);
      const markSize = size - inset * 2;
      const resolvedMarkSize = markSize * logoTransform.scale;
      const resolvedMarkX = inset + logoTransform.x * (size / 512) - (resolvedMarkSize - markSize) / 2;
      const resolvedMarkY = inset + logoTransform.y * (size / 512) - (resolvedMarkSize - markSize) / 2;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${backgroundLayer}<defs>${buildLogoSvgFilter(appearance, selectedColor.hex, 'logo-appearance')}</defs><image href="${mark}" x="${resolvedMarkX}" y="${resolvedMarkY}" width="${resolvedMarkSize}" height="${resolvedMarkSize}" filter="url(#logo-appearance)"/></svg>`;
      await downloadSvgAsPng(svg, size, size, `${identity.id}-mark-${tone}-${size}.png`);
    } finally {
      setExporting(false);
    }
  }

  const inspector = (
    <>
      <ControlSection title={<T>Logo color</T>}>
        <div className='grid grid-cols-2 gap-2'>
          {logoColors.map((color) => (
            <Button
              className='justify-start'
              key={color.id}
              onClick={() => { setTone(color.id); setLogoColor(color.hex); }}
              type='button'
              variant={tone === color.id ? 'default' : 'outline'}
            >
              <span className='size-3 rounded-full border border-border' style={{ backgroundColor: color.hex }} />
              {color.name}
            </Button>
          ))}
        </div>
        <ColorControl ariaLabel={gt('Custom logo color')} label={<T>Custom logo color</T>} onChange={(value) => { setLogoColor(value); setTone('custom'); }} value={logoColor} />
      </ControlSection>
      <ControlSection title={<T>Logo appearance</T>}>
        <LogoAppearanceControls onChange={(patch) => setAppearance((current) => ({ ...current, ...patch }))} settings={{ ...DEFAULT_LOGO_APPEARANCE, ...appearance }} />
      </ControlSection>
      <ControlSection title={<T>Canvas layer</T>}>
        <CanvasLayerPanel
          layers={[{ canMoveBackward: false, canMoveForward: false, id: 'logo', label: gt('Logo'), transform: logoTransform }]}
          onAlign={(alignment) => setLogoTransform(alignCanvasLayer(logoTransform, { baseHeight: 300, baseWidth: 300, baseX: 106, baseY: 106 }, 512, 512, alignment))}
          onMove={() => undefined}
          onReset={() => setLogoTransform({ scale: 1, x: 0, y: 0 })}
          onSelect={() => setLogoSelected(true)}
          selectedLayerId={logoSelected ? 'logo' : null}
        />
      </ControlSection>
      <ControlSection title={<T>Background</T>}>
        <SegmentedChoice
          onChange={setSurface}
          options={[
            { label: 'Base white', value: 'white' },
            { label: 'Base dark', value: 'dark' },
            { label: 'Grid', value: 'grid' },
            { label: 'Noise', value: 'noise' },
            { label: 'Live shader', value: 'shader' },
          ]}
          value={surface}
        />
        {surface === 'shader' ? (
          <div className='flex flex-col gap-3 border-t border-border pt-4'>
            <LiveMaterialControls
              identity={identity}
              materialId={materialId}
              onMaterialIdChange={setMaterialId}
              onSettingsChange={setMaterialSettings}
              settings={materialSettings}
            />
          </div>
        ) : null}
        <label className='flex items-center justify-between gap-4 text-sm'>
          <T>Transparent export</T>
          <input checked={transparent} onChange={(event) => setTransparent(event.target.checked)} type='checkbox' />
        </label>
      </ControlSection>
      <ControlSection title={<T>Output size</T>}>
        <SegmentedChoice
          onChange={setSize}
          options={[
            { label: '64 px', value: 64 },
            { label: '128 px', value: 128 },
          ]}
          value={size}
        />
      </ControlSection>
    </>
  );

  return (
    <ToolShell
      actions={
        <>
          {navigation}
          <Button loading={exporting} onClick={exportLogo} type='button'>
            <Download aria-hidden='true' />
            <T>Download logo</T>
          </Button>
        </>
      }
      inspector={inspector}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Logo source') }}
      tool={tool}
    >
      <CanvasViewport identityId={identity.id} onDeselect={() => setLogoSelected(false)} stageClassName='grid min-h-full place-items-center p-8' toolId={tool.id}>
        <div
          className={`artifact-frame logo-surface logo-surface-${surface} relative grid aspect-square w-full max-w-xl place-items-center overflow-hidden rounded-md`}
          onPointerDown={() => setLogoSelected(false)}
          ref={previewRef}
          style={{ '--brand-ink': ink, '--brand-paper': paper } as CSSProperties}
        >
          {surface === 'shader' ? <LiveMaterialCanvas materialId={materialId} settings={materialSettings} /> : null}
          {surface === 'shader' ? (
            <LiveMaterialSourceBadge
              className='pointer-events-none absolute right-3 bottom-3 z-10 border border-white/20 bg-black/55 px-2 py-1 text-white opacity-100 backdrop-blur-sm'
              engine={getLiveMaterial(materialId).engine}
            />
          ) : null}
          <EditableCanvasLayer
            baseHeight={300}
            baseWidth={300}
            baseX={106}
            baseY={106}
            canvasHeight={512}
            canvasWidth={512}
            label={gt('Logo')}
            onChange={setLogoTransform}
            onSelect={() => setLogoSelected(true)}
            selected={logoSelected}
            transform={logoTransform}
            zIndex={2}
          >
            <LogoAppearancePreview
              ariaLabel={`${identity.name} logo preview`}
              color={selectedColor.hex}
              fallback={
                <span className='grid size-full place-items-center text-5xl font-semibold'>{identity.shortName}</span>
              }
              logoPath={markPath}
              settings={{ ...DEFAULT_LOGO_APPEARANCE, ...appearance }}
            />
          </EditableCanvasLayer>
        </div>
      </CanvasViewport>
    </ToolShell>
  );
}

function SurfaceModeNavigation({
  mode,
  onChange,
}: {
  mode: 'background' | 'logo';
  onChange: (mode: 'background' | 'logo') => void;
}) {
  return (
    <div
      aria-label='Surface Lab mode'
      className='surface-lab-mode-tabs flex items-center gap-1 rounded-md border border-border bg-background p-1'
      role='tablist'
    >
      {([
        ['background', 'Background'],
        ['logo', 'Logo'],
      ] as const).map(([value, label]) => (
        <Button
          aria-selected={mode === value}
          className='border-0'
          key={value}
          onClick={() => onChange(value)}
          role='tab'
          size='sm'
          type='button'
          variant={mode === value ? 'default' : 'ghost'}
        >
          <T>{label}</T>
        </Button>
      ))}
    </div>
  );
}

function SurfaceTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const [mode, setMode] = useStudioDraft<'background' | 'logo'>(
    identity.id,
    tool.id,
    'mode-v2',
    'background'
  );
  const navigation = <SurfaceModeNavigation mode={mode} onChange={setMode} />;
  const draftTool: StudioTool = {
    ...tool,
    id: mode === 'background' ? 'backgrounds' : 'logo',
  };

  if (mode === 'background') {
    return <BackgroundStudio identity={identity} navigation={navigation} tool={draftTool} />;
  }
  return <LogoTool identity={identity} navigation={navigation} tool={draftTool} />;
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

function ColorTool({ identity, tool }: { identity: BrandIdentity; tool: StudioTool }) {
  const gt = useGT();
  const [colors, setColors] = useStudioDraft<EditableColor[]>(
    identity.id,
    tool.id,
    'colors',
    () => identity.colors.map(({ hex, name, role }) => ({ hex, name, opacity: 100, role }))
  );
  const [copied, setCopied] = useState(false);
  const sourceCode = stringifySource({ colors });

  function applySourceCode(source: string) {
    const value = parseSourceObject(source);
    const nextColors = sourceObjectArray(value, 'colors');
    if (!nextColors) throw new TypeError('colors must be an array of color objects.');
    setColors(nextColors.map((color, index) => ({
      hex: sourceString(color, 'hex', colors[index]?.hex ?? '#000000'),
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

  const inspector = (
    <ControlSection title={<T>Semantic palette</T>}>
      <p className='text-sm leading-5 text-muted-foreground'>
        <T>Edit any swatch. HEX and perceptual OKLCH values stay paired.</T>
      </p>
      <div className='flex flex-col gap-3'>
        {colors.map((color, index) => (
          <ColorControl
            ariaLabel={gt('Change {name}', { name: color.name })}
            key={color.name}
            label={gt(color.name)}
            onChange={(hex) =>
              setColors((current) =>
                current.map((item, itemIndex) => itemIndex === index ? { ...item, hex } : item)
              )
            }
            onOpacityChange={(opacity) =>
              setColors((current) =>
                current.map((item, itemIndex) => itemIndex === index ? { ...item, opacity } : item)
              )
            }
            opacity={color.opacity ?? 100}
            value={color.hex}
          />
        ))}
      </div>
    </ControlSection>
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
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Color system source') }}
      tool={tool}
    >
      <div className='grid min-h-full content-center gap-px bg-border lg:grid-cols-2'>
        {colors.map((color) => {
          const oklch = formatOklch(color.hex);
          const lightness = Number(oklch.match(/\d+(\.\d+)?/)?.[0] ?? 0);
          const isDark = lightness < 55;
          return (
            <article
              className='flex min-h-56 flex-col justify-between gap-8 p-6'
              key={color.name}
              style={{
                backgroundColor: `${normalizeHex(color.hex)}${Math.round(((color.opacity ?? 100) / 100) * 255).toString(16).padStart(2, '0')}`,
                color: isDark ? '#FFFFFF' : '#111111',
              }}
            >
              <div className='flex items-start justify-between gap-4'>
                <h2 className='text-xl font-semibold'>{gt(color.name)}</h2>
                <span className='rounded-md border border-current/20 px-2 py-1 font-mono text-xs'>
                  {normalizeHex(color.hex)}
                </span>
              </div>
              <div className='flex flex-col gap-2'>
                <p className='font-mono text-sm'>{oklch}</p>
                <p className='text-sm opacity-70'>{gt(color.role)}</p>
              </div>
            </article>
          );
        })}
      </div>
    </ToolShell>
  );
}

function TypographyTool({ identity, onIdentityChange, tool }: { identity: BrandIdentity; onIdentityChange: (identity: BrandIdentity) => void; tool: StudioTool }) {
  const gt = useGT();
  const fonts = brandFontAssets(identity);
  const sourceCode = stringifySource({ typography: identity.typography });

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

  const inspector = (
    <>
      <ControlSection title={<T>Typography roles</T>}>
        {identity.typography.map((typography) => (
          <div className='flex flex-col gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0' key={typography.role}>
            <Field label={typography.role.toLocaleUpperCase()}>
              <StudioSelect ariaLabel={`${typography.role} font`} onValueChange={(fontId) => { const font = fonts.find((candidate) => candidate.id === fontId); if (font) updateRole(typography.role, { family: font.family, fontId }); }} options={fonts.map((font) => ({ label: `${font.label} · ${font.fileName}`, value: font.id }))} value={brandTypographyRole(identity, typography.role).fontId ?? fonts[0]?.id ?? ''} />
            </Field>
            <RangeField label={<T>Weight</T>} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={(weight) => updateRole(typography.role, { weight })} step={50} value={brandTypographyRole(identity, typography.role).weight ?? 400} />
          </div>
        ))}
        <UploadField accept='.otf,.ttf,.woff,.woff2,font/*' label='Add font file to identity' onFile={loadFont} />
      </ControlSection>
    </>
  );

  const display = brandTypographyRole(identity, 'Display');
  const body = brandTypographyRole(identity, 'Body');
  const accent = brandTypographyRole(identity, 'Accent');
  const code = brandTypographyRole(identity, 'Code');

  return (
    <ToolShell inspector={inspector} sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Typography source') }} tool={tool}>
      <div className='flex min-h-full flex-col justify-center gap-10 p-8 sm:p-12 lg:p-16'>
        <section className='flex flex-col gap-3 border-b border-border pb-10'>
          <p className='text-sm uppercase tracking-widest text-muted-foreground'>DISPLAY / {brandTypographyFamily(identity, 'Display')}</p>
          <p className='max-w-5xl text-5xl text-balance lg:text-7xl' style={{ fontFamily: brandTypographyFamily(identity, 'Display'), fontWeight: display.weight, letterSpacing: `${display.letterSpacing}px`, lineHeight: display.lineHeight }}>{identity.tagline}</p>
          <p className='text-2xl text-muted-foreground' style={{ fontFamily: brandTypographyFamily(identity, 'Accent'), fontWeight: accent.weight, letterSpacing: `${accent.letterSpacing}px`, lineHeight: accent.lineHeight }}>{identity.greetings.join(' · ')}</p>
        </section>
        <div className='grid gap-8 md:grid-cols-2'>
          <section className='flex flex-col gap-3' style={{ fontFamily: brandTypographyFamily(identity, 'Body'), fontWeight: body.weight, letterSpacing: `${body.letterSpacing}px`, lineHeight: body.lineHeight }}><p className='text-sm font-semibold'>BODY / {brandTypographyFamily(identity, 'Body')}</p><p className='max-w-xl text-lg text-muted-foreground'>{identity.positioning}</p></section>
          <section className='flex flex-col gap-3' style={{ fontFamily: brandTypographyFamily(identity, 'Code'), fontWeight: code.weight, letterSpacing: `${code.letterSpacing}px`, lineHeight: code.lineHeight }}><p className='text-sm font-semibold'>CODE / {brandTypographyFamily(identity, 'Code')}</p><p className='rounded-md bg-foreground p-5 text-sm text-background'>$ npx {identity.id} translate --locales es,ja,ar</p></section>
        </div>
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
      await downloadSvgAsPng(svg, 1200, 630, 'studio-terminal.png');
    } finally {
      setExporting(false);
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
        <Button loading={exporting} onClick={exportTerminal} type='button'>
          <Download aria-hidden='true' />
          <T>Download PNG</T>
        </Button>
      }
      inspector={inspector}
      sourceCode={{ format: 'JSON', onApply: applySourceCode, source: sourceCode, title: gt('Terminal source') }}
      tool={tool}
    >
      <div className='grid min-h-full place-items-center p-8 lg:p-14'>
        <div className='relative w-full max-w-4xl overflow-hidden rounded-lg border border-white/10 bg-[#0D1117] text-[#E6EDF3] shadow-[0_18px_60px_rgba(0,0,0,0.18)]'>
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
          <pre className='relative min-h-72 overflow-auto bg-[#0D1117]/90 p-6 text-sm leading-7' style={{ fontFamily: brandTypographyFamily(identity, codeFontRole), fontWeight: capVisibleFontWeight(codeFontWeight) }}>
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
      await downloadSvgAsPng(svg, width, height, `studio-${kind}.png`);
    } finally {
      setExporting(false);
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
        <Button loading={exporting} onClick={exportTemplate} type='button'>
          <Download aria-hidden='true' />
          <T>Download PNG</T>
        </Button>
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
          <EditableCanvasLayer {...layerGeometries.brand} canvasHeight={height} canvasWidth={width} label={gt('Brand lockup')} onChange={(transform) => updateLayer('brand', transform)} onSelect={() => setSelectedLayer('brand')} selected={selectedLayer === 'brand'} transform={brandLayer} zIndex={layerOrder.indexOf('brand') + 5}>
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
          <EditableCanvasLayer {...layerGeometries.content} canvasHeight={height} canvasWidth={width} label={gt('Content')} onChange={(transform) => updateLayer('content', transform)} onSelect={() => setSelectedLayer('content')} selected={selectedLayer === 'content'} transform={contentLayer} zIndex={layerOrder.indexOf('content') + 5}>
            <div className='flex size-full flex-col justify-center'>
              {isSlide ? <SlideTemplatePreview body={body} foreground={foreground} layout={slideLayout} title={title} /> : <div className='template-copy flex flex-col'><h2 className='template-title break-words font-semibold leading-[0.98] tracking-[-0.055em] text-balance'>{title}</h2></div>}
            </div>
          </EditableCanvasLayer>
          <EditableCanvasLayer {...layerGeometries.footer} canvasHeight={height} canvasWidth={width} label={gt('Footer')} onChange={(transform) => updateLayer('footer', transform)} onSelect={() => setSelectedLayer('footer')} selected={selectedLayer === 'footer'} transform={footerLayer} zIndex={layerOrder.indexOf('footer') + 5}>
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
          className={`component-library-demo component-density-${resolvedDensity} relative mx-auto w-full max-w-5xl overflow-hidden border border-border shadow-sm`}
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

export default function StudioToolWorkspace({
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
