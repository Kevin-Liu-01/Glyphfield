'use client';

import { useMemo, useState } from 'react';
import { T } from 'gt-next';
import { Download, FileJson, Layers3 } from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import ResizableSidebar from '@/components/ResizableSidebar';
import SourceCodeDrawer, { SourceCodeButton } from '@/components/SourceCodeDrawer';
import ThemeAwareBrandMark from '@/components/ThemeAwareBrandMark';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  brandAssetPath,
  brandFontAssets,
  brandTypographyRole,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { imageUrlToDataUrl, svgToPngBlob } from '@/lib/download';
import {
  moodboardFilename,
  moodboardAssets,
  MOODBOARD_EXPORT_PRESETS,
  resolveMoodboardExport,
  type MoodboardComposition,
  type MoodboardExportPresetId,
} from '@/lib/moodboard';
import { buildMoodboardSvg } from '@/lib/moodboardSvg';
import {
  parseSourceObject,
  sourceNumber,
  sourceString,
  stringifySource,
} from '@/lib/sourceCode';
import type { StudioTool } from '@/lib/studioCatalog';

function fontPath(
  identity: BrandIdentity,
  role: 'Accent' | 'Body' | 'Code' | 'Display'
): string {
  const typography = brandTypographyRole(identity, role);
  return brandFontAssets(identity).find(({ id }) => id === typography.fontId)?.path
    ?? (role === 'Code' ? '/fonts/geist-mono-variable.ttf' : '/fonts/inter-variable.ttf');
}

async function loadFontAssets(identity: BrandIdentity) {
  const [accentFont, bodyFont, codeFont, displayFont] = await Promise.all([
    imageUrlToDataUrl(fontPath(identity, 'Accent')),
    imageUrlToDataUrl(fontPath(identity, 'Body')),
    imageUrlToDataUrl(fontPath(identity, 'Code')),
    imageUrlToDataUrl(fontPath(identity, 'Display')),
  ]);
  return { accentFont, bodyFont, codeFont, displayFont };
}

async function loadOptionalAsset(source: string | undefined): Promise<string | undefined> {
  return source ? imageUrlToDataUrl(source) : undefined;
}

function downloadIdentity(identity: BrandIdentity) {
  const blob = new Blob([JSON.stringify(identity, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${identity.id}-brand-identity.json`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DesignBoard({
  identity,
  tool,
}: {
  identity: BrandIdentity;
  tool: StudioTool;
}) {
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [exportPresetId, setExportPresetId] = useStudioDraft<MoodboardExportPresetId>(
    identity.id,
    tool.id,
    'export-preset',
    'retina'
  );
  const [composition, setComposition] = useStudioDraft<MoodboardComposition>(
    identity.id,
    tool.id,
    'composition',
    'showcase'
  );
  const [customWidth, setCustomWidth] = useStudioDraft(
    identity.id,
    tool.id,
    'custom-width',
    2400
  );
  const exportDimensions = resolveMoodboardExport(
    exportPresetId,
    customWidth,
    composition
  );
  const markDarkPath = brandAssetPath(identity, 'mark-dark');
  const markLightPath = brandAssetPath(identity, 'mark-light');
  const logoPaths = useMemo(
    () =>
      identity.assets
        .filter(({ type }) => type === 'logo')
        .slice(0, 4)
        .map(({ path }) => path),
    [identity.assets]
  );
  const boardAssets = useMemo(() => moodboardAssets(identity), [identity]);
  const previewSvg = useMemo(
    () =>
      buildMoodboardSvg(
        identity,
        {
          accentFont: fontPath(identity, 'Accent'),
          artAssets: boardAssets,
          bodyFont: fontPath(identity, 'Body'),
          codeFont: fontPath(identity, 'Code'),
          displayFont: fontPath(identity, 'Display'),
          logoMarks: logoPaths,
          markDark: markDarkPath,
          markLight: markLightPath,
        },
        composition
      ),
    [boardAssets, composition, identity, logoPaths, markDarkPath, markLightPath]
  );

  async function exportBoard() {
    setExporting(true);
    try {
      const [fontAssets, logoMarks, markDark, markLight, embeddedBoardAssets] =
        await Promise.all([
          loadFontAssets(identity),
          Promise.all(logoPaths.map((path) => imageUrlToDataUrl(path))),
          loadOptionalAsset(markDarkPath),
          loadOptionalAsset(markLightPath),
          Promise.all(
            boardAssets.map(async (asset) => ({
              ...asset,
              path: await imageUrlToDataUrl(asset.path),
            }))
          ),
        ]);
      const svg = buildMoodboardSvg(
        identity,
        {
          ...fontAssets,
          artAssets: embeddedBoardAssets,
          logoMarks,
          markDark,
          markLight,
        },
        composition
      );

      const fileName = moodboardFilename(identity.name, exportDimensions.width, exportDimensions.height);
      const blob = await svgToPngBlob(
        svg,
        exportDimensions.width,
        exportDimensions.height
      );
      setLastExport({
        blob,
        fileName,
        format: 'PNG',
        height: exportDimensions.height,
        width: exportDimensions.width,
      });
    } finally {
      setExporting(false);
    }
  }

  function applySource(source: string) {
    const next = parseSourceObject(source);
    const nextComposition = sourceString(next, 'composition', composition);
    const nextPreset = sourceString(next, 'exportPresetId', exportPresetId);
    if (!['showcase', 'system', 'catalog'].includes(nextComposition)) {
      throw new TypeError('Composition must be showcase, system, or catalog.');
    }
    if (!MOODBOARD_EXPORT_PRESETS.some(({ id }) => id === nextPreset)) {
      throw new TypeError('Export preset does not exist.');
    }
    setComposition(nextComposition as MoodboardComposition);
    setExportPresetId(nextPreset as MoodboardExportPresetId);
    setCustomWidth(Math.min(4800, Math.max(800, sourceNumber(next, 'customWidth', customWidth))));
  }

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='app-navbar tool-header flex items-center justify-between gap-4 border-b border-border px-5'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{tool.name}</p>
          <p className='truncate text-sm text-muted-foreground'>{tool.description}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <SourceCodeButton onClick={() => setSourceOpen(true)} />
          <Button onClick={() => downloadIdentity(identity)} type='button' variant='outline'>
            <FileJson aria-hidden='true' />
            <T>Identity JSON</T>
          </Button>
          <ExportPreview asset={lastExport} />
          <Button loading={exporting} onClick={exportBoard} type='button'>
            <Download aria-hidden='true' />
            <T>Download PNG</T>
          </Button>
        </div>
      </header>

      <div className='design-board-body tool-body'>
        <ResizableSidebar
          className='tool-inspector min-h-0 border-r border-border bg-background'
          label={`${tool.name} controls`}
          storageKey={`tool-${tool.id}`}
        >
          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div className='flex items-center gap-3'>
              <div className='grid size-10 place-items-center overflow-hidden rounded-md border border-border p-1.5'>
                <ThemeAwareBrandMark className='size-full' identity={identity} />
              </div>
              <div className='min-w-0'>
                <p className='truncate text-sm font-semibold'>{identity.name}</p>
                <p className='font-mono text-xs text-muted-foreground'>
                  {identity.kind === 'template'
                    ? 'TEMPLATE / DUPLICATE TO START'
                    : identity.kind === 'example'
                      ? 'EXAMPLE / REPO AUDIT'
                      : 'LOCAL / EDITABLE'}
                </p>
              </div>
            </div>
            <p className='text-sm leading-6 text-muted-foreground'>{identity.description}</p>
          </section>

          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div className='flex flex-col gap-1'>
              <h2 className='text-sm font-semibold'>
                <T>Moodboard export</T>
              </h2>
              <p className='text-xs leading-5 text-muted-foreground'>
                <T>Export foundations and polished brand applications with embedded fonts.</T>
              </p>
            </div>
            <div className='flex flex-col gap-2 text-sm'>
              <span className='text-muted-foreground'>
                <T>Board style</T>
              </span>
              <StudioSelect
                ariaLabel='Board style'
                onValueChange={(value) => setComposition(value as MoodboardComposition)}
                options={[
                  { label: 'Showcase · application collage', value: 'showcase' },
                  { label: 'System · foundations and rules', value: 'system' },
                  { label: 'All formats · complete contact sheet', value: 'catalog' },
                ]}
                value={composition}
              />
            </div>
            <p className='text-xs leading-5 text-muted-foreground'>
              {composition === 'showcase' ? (
                <T>
                  Six finished compositions using only original or source-native brand assets.
                </T>
              ) : composition === 'system' ? (
                <T>
                  Review the logo, typography, color, imagery, applications, and system as one contact sheet.
                </T>
              ) : (
                <T>
                  Lay out every system view, eligible source asset, and generated application in one complete review board.
                </T>
              )}
            </p>
            <div className='border border-border bg-muted/50 p-3'>
              <p className='text-xs font-medium'>
                <T>Original asset audit</T>
              </p>
              <p className='mt-1 text-xs text-muted-foreground'>
                {boardAssets.length} eligible assets · screenshot captures excluded
              </p>
            </div>
            <div className='flex flex-col gap-2 text-sm'>
              <span className='text-muted-foreground'>
                <T>Output size</T>
              </span>
              <StudioSelect
                ariaLabel='Output size'
                onValueChange={(value) => setExportPresetId(value as MoodboardExportPresetId)}
                options={MOODBOARD_EXPORT_PRESETS.map((preset) => ({
                  label: `${preset.label}${preset.id === 'custom' ? '' : ` · ${resolveMoodboardExport(preset.id, customWidth, composition).width} × ${resolveMoodboardExport(preset.id, customWidth, composition).height}`}`,
                  value: preset.id,
                }))}
                value={exportPresetId}
              />
            </div>
            {exportPresetId === 'custom' ? (
              <label className='flex flex-col gap-2 text-sm'>
                <span className='text-muted-foreground'>
                  <T>Custom width</T>
                </span>
                <div className='flex items-center gap-2'>
                  <input
                    className='h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-sm outline-none focus:border-foreground'
                    max={4800}
                    min={800}
                    onChange={(event) => setCustomWidth(Number(event.target.value))}
                    step={100}
                    type='number'
                    value={customWidth}
                  />
                  <span className='font-mono text-xs text-muted-foreground'>PX</span>
                </div>
              </label>
            ) : null}
            <div className='border border-border bg-muted/50 p-3'>
              <p className='font-mono text-xs font-semibold'>
                {exportDimensions.width} × {exportDimensions.height} PX
              </p>
              <p className='mt-1 font-mono text-[10px] text-muted-foreground'>
                PNG / {exportDimensions.megapixels.toFixed(1)} MP /{' '}
                {composition === 'showcase' ? '16:9' : composition === 'system' ? '4:5' : '2:3'}
              </p>
            </div>
          </section>

          <section className='flex flex-col gap-3 border-b border-border p-5'>
            <div className='flex items-center justify-between gap-3'>
              <h2 className='text-sm font-semibold'>
                <T>Generated applications</T>
              </h2>
              <span className='font-mono text-[10px] text-muted-foreground'>
                {identity.applications.length} TOTAL
              </span>
            </div>
            {identity.applications.map((application, index) => (
              <div className='flex items-center justify-between gap-4 text-sm' key={application.id}>
                <span className='min-w-0'>
                  <span className='block truncate text-muted-foreground'>{application.name}</span>
                  <span className='block font-mono text-[9px] uppercase text-muted-foreground/60'>
                    {application.category} / {application.format}
                  </span>
                </span>
                <span className='shrink-0 font-mono'>{String(index + 1).padStart(2, '0')}</span>
              </div>
            ))}
          </section>

          <section className='flex flex-col gap-3 border-b border-border p-5'>
            <p className='font-mono text-[10px] uppercase tracking-widest text-muted-foreground'>
              <T>Central idea</T>
            </p>
            <p className='text-sm font-semibold leading-6'>{identity.strategy.concept}</p>
            <p className='text-xs leading-5 text-muted-foreground'>
              {identity.graphicSystem.device} · {identity.graphicSystem.pattern}
            </p>
          </section>

          <section className='flex flex-col gap-3 p-5'>
            <div className='flex items-center gap-2 text-sm font-semibold'>
              <Layers3 className='size-4' aria-hidden='true' />
              <T>Sources</T>
            </div>
            {identity.sourceNotes.map((note) => (
              <p className='text-xs leading-5 text-muted-foreground' key={note}>
                {note}
              </p>
            ))}
          </section>
        </ResizableSidebar>

        <div className='tool-canvas min-h-0 overflow-hidden'>
          <CanvasViewport className='moodboard-canvas' identityId={identity.id} stageClassName='moodboard-canvas-stage p-5 sm:p-8' toolId={tool.id}>
          <div
            aria-label={`${identity.name} ${composition} moodboard with brand foundations and generated applications`}
            className='moodboard-preview mx-auto w-full max-w-[1200px] shadow-sm'
            dangerouslySetInnerHTML={{ __html: previewSvg }}
            data-testid='moodboard-preview'
            role='img'
          />
          </CanvasViewport>
        </div>
      </div>
      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · moodboard composition'
          onApply={applySource}
          onClose={() => setSourceOpen(false)}
          source={stringifySource({ composition, customWidth, exportPresetId })}
          title={`${identity.name} moodboard source`}
        />
      ) : null}
    </div>
  );
}
