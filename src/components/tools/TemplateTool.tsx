'use client';

import { useMemo, useState } from 'react';
import { T, useGT } from 'gt-next';
import { Download } from '@/components/ui/SolidIcons';

import CanvasViewport from '@/components/CanvasViewport';
import CanvasLayerPanel from '@/components/CanvasLayerPanel';
import {
  alignCanvasLayer,
  type CanvasLayerAlignment,
  type CanvasLayerGeometry,
  type CanvasLayerTransform,
} from '@/lib/canvasInteraction';
import DesignVersionControls from '@/components/DesignVersionControls';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import TemplateCanvasPreview from '@/components/TemplateCanvasPreview';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { ToolShell } from '@/components/tools/ToolShell';
import {
  INPUT_CLASS,
  TEXTAREA_CLASS,
  useLocalAsset,
  ControlSection,
  Field,
  RangeField,
  SegmentedChoice,
  UploadField,
  monogramDataUrl,
} from '@/components/tools/ToolFields';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import {
  BUILT_IN_BRAND_IDENTITIES,
  brandFontAssets,
  brandTypographyFamily,
  brandTypographyRole,
  type BrandIdentity,
  type BrandTypography,
} from '@/lib/brandIdentity';
import {
  canvasElementAssetSource,
  canvasRevisionFromSignature,
  type CanvasDocument,
} from '@/lib/canvasDocument';
import { resolveSvgRasterDimensions, svgToPngBlob } from '@/lib/download';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { savedDesignStorageKey } from '@/lib/savedDesigns';
import { createStudioCanvasDocument } from '@/lib/studioCanvasDocument';
import { STUDIO_ARTIFACT_STAGE_CLASS } from '@/lib/studioCanvasPresentation';
import { parseTemplateWorkspaceSource } from '@/lib/expressionWorkspaceSource';
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
import { capVisibleFontWeight, MAX_VISIBLE_FONT_WEIGHT } from '@/lib/typography';

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

const TEMPLATE_FONT_ARIA_LABELS: Record<TemplateKind, string> = {
  blog: 'Template typography role',
  partnership: 'GT headline font',
  slides: 'Template typography role',
};

function TemplateFontRoleLabel({ kind }: { kind: TemplateKind }) {
  return kind === 'partnership' ? <T>GT headline font</T> : <T>Typography role</T>;
}

function TemplateFontWeightLabel({ kind }: { kind: TemplateKind }) {
  return kind === 'partnership' ? <T>GT headline weight</T> : <T>Font weight</T>;
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
    'partner-treatment-v2',
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
    partnerRenderingVersion: 2,
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
      const raster = resolveSvgRasterDimensions(width, height);
      const blob = await svgToPngBlob(previewSvg, width, height);
      const asset: ExportPreviewAsset = { blob, fileName: `studio-${kind}.png`, format: 'PNG', height: raster.height, width: raster.width };
      setLastExport(asset);
      return asset;
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
              { label: 'Use logo', value: 'logo' },
              { label: 'Write name', value: 'text' },
            ]}
            value={partnerTreatment}
          />
        </div>
        {partnerTreatment === 'text' ? (
          <Field label={<T>Lockup name</T>}>
            <input
              className={INPUT_CLASS}
              onChange={(event) => setPartnerName(event.target.value)}
              value={partnerName}
            />
          </Field>
        ) : (
          <UploadField
            accept='image/*,.svg'
            fileName={partnerAsset.asset?.name}
            label='Replace partner logo'
            onFile={partnerAsset.select}
          />
        )}
        <Field label={<T>Partner headline font</T>}>
          <StudioSelect
            ariaLabel='Partner headline font'
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
          label='Upload partner headline font'
          onFile={uploadPartnerFont}
        />
        <RangeField
          label={<T>Partner headline weight</T>}
          max={MAX_VISIBLE_FONT_WEIGHT}
          min={100}
          onChange={setPartnerFontWeight}
          step={50}
          value={partnerFontWeight}
        />
        <p className='text-xs leading-5 text-muted-foreground'>
          <T>Styles the partner name in the headline and in text-based lockups.</T>
        </p>
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
        <Field label={<TemplateFontRoleLabel kind={kind} />}><StudioSelect ariaLabel={TEMPLATE_FONT_ARIA_LABELS[kind]} onValueChange={(value) => { const role = value as BrandTypography['role']; setRestoredFontSource(null); setFontRole(role); setFontWeight(brandTypographyRole(identity, role).weight ?? 400); }} options={identity.typography.map((font) => ({ label: `${font.role} · ${brandTypographyFamily(identity, font.role)}`, value: font.role }))} value={fontRole} /></Field>
        <RangeField label={<TemplateFontWeightLabel kind={kind} />} max={MAX_VISIBLE_FONT_WEIGHT} min={100} onChange={setFontWeight} step={50} value={fontWeight} />
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
      automation={{
        actions: studioToolActionNames(tool.id),
        invoke: (action) => {
          if (action === `${kind}.export.png`) return exportTemplate();
          throw new RangeError(`Unknown ${tool.name} action: ${action}.`);
        },
      }}
      versions={<DesignVersionControls
            autosaveState={templateAutosaveState}
            identityId={identity.id}
            onOpen={applySourceCode}
            revision={String(templateDocument.revision)}
            source={() => sourceCode}
            toolId={tool.id}
            workspaceLabel={tool.name}
          />}
      actions={
        <>
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
      <CanvasViewport fontFamily={displayFont} fontWeight={capVisibleFontWeight(fontWeight)} identityId={identity.id} onDeselect={() => setSelectedLayer(null)} stageClassName={STUDIO_ARTIFACT_STAGE_CLASS} toolId={tool.id}>
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

export default TemplateTool;
