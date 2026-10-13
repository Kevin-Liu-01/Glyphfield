'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { T, useGT } from 'gt-next';
import { Download } from '@/components/ui/SolidIcons';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasArtboard from '@/components/CanvasArtboard';
import CanvasLayerPanel from '@/components/CanvasLayerPanel';
import EditableCanvasLayer from '@/components/EditableCanvasLayer';
import { alignCanvasLayer } from '@/lib/canvasInteraction';
import DesignVersionControls from '@/components/DesignVersionControls';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import LogoAppearanceControls from '@/components/LogoAppearanceControls';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { ToolShell } from '@/components/tools/ToolShell';
import {
  TEXTAREA_CLASS,
  useLocalAsset,
  ControlSection,
  Field,
  RangeField,
  SegmentedChoice,
  UploadField,
  monogramDataUrl,
} from '@/components/tools/ToolFields';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useMountEffect } from '@/hooks/useMountEffect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  brandAssetPath,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import { canvasElementAssetSource, canvasRevisionFromSignature } from '@/lib/canvasDocument';
import { resolveReadableColor } from '@/lib/color';
import { blobToDataUrl, resolveSvgRasterDimensions, svgToPngBlob } from '@/lib/download';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { savedDesignStorageKey } from '@/lib/savedDesigns';
import { createStudioCanvasDocument } from '@/lib/studioCanvasDocument';
import {
  STUDIO_ARTIFACT_FRAME_CLASS,
  STUDIO_ARTIFACT_PLANE_CLASS,
  STUDIO_ARTIFACT_STAGE_CLASS,
} from '@/lib/studioCanvasPresentation';
import {
  DEFAULT_LOGO_APPEARANCE,
  type LogoAppearanceSettings,
} from '@/lib/logoAppearance';
import { buildOpenGraphSvg } from '@/lib/openGraphSvg';
import { parseOpenGraphWorkspaceSource } from '@/lib/expressionWorkspaceSource';
import { templateBackgroundOptions } from '@/lib/templateAssets';
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';

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
      const raster = resolveSvgRasterDimensions(1200, 630);
      const blob = await svgToPngBlob(previewSvg, 1200, 630);
      const asset: ExportPreviewAsset = { blob, fileName: 'studio-opengraph.png', format: 'PNG', height: raster.height, width: raster.width };
      setLastExport(asset);
      return asset;
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
      automation={{
        actions: studioToolActionNames('opengraph'),
        invoke: (action) => {
          if (action === 'opengraph.export.png') return exportOpenGraph();
          throw new RangeError(`Unknown OpenGraph action: ${action}.`);
        },
      }}
      versions={<DesignVersionControls
            autosaveState={openGraphAutosaveState}
            identityId={identity.id}
            onOpen={applySourceCode}
            revision={String(openGraphDocument.revision)}
            source={() => sourceCode}
            toolId={tool.id}
            workspaceLabel={tool.name}
          />}
      actions={
        <>
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
      <CanvasViewport fontFamily={brandTypographyFamily(identity, fontRole)} fontWeight={capVisibleFontWeight(fontWeight)} identityId={identity.id} onDeselect={() => setLogoSelected(false)} stageClassName={STUDIO_ARTIFACT_STAGE_CLASS} toolId={tool.id}>
        <CanvasArtboard
          aria-label={gt('OpenGraph canvas')}
          className={STUDIO_ARTIFACT_PLANE_CLASS}
          frameClassName={STUDIO_ARTIFACT_FRAME_CLASS}
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

export default OpenGraphTool;
