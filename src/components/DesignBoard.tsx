'use client';

import { useMemo, useState } from 'react';
import { T } from 'gt-next';
import { Download, FileJson, Layers3 } from 'lucide-react';

import CanvasViewport from '@/components/CanvasViewport';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import {
  brandAssetPath,
  type BrandIdentity,
} from '@/lib/brandIdentity';
import { downloadSvgAsPng, imageUrlToDataUrl } from '@/lib/download';
import {
  moodboardFilename,
  MOODBOARD_EXPORT_PRESETS,
  resolveMoodboardExport,
  type MoodboardExportPresetId,
} from '@/lib/moodboard';
import { buildMoodboardSvg, type MoodboardSvgAssets } from '@/lib/moodboardSvg';
import type { StudioTool } from '@/lib/studioCatalog';

let fontAssetsPromise: Promise<Pick<MoodboardSvgAssets, 'interFont' | 'monoFont'>> | null =
  null;

function loadFontAssets() {
  fontAssetsPromise ??= Promise.all([
    imageUrlToDataUrl('/fonts/inter-latin.woff2'),
    imageUrlToDataUrl('/fonts/geist-mono-latin.woff2'),
  ]).then(([interFont, monoFont]) => ({ interFont, monoFont }));

  return fontAssetsPromise;
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

function BrandMark({ identity }: { identity: BrandIdentity }) {
  const path = brandAssetPath(identity, 'mark-dark');

  if (path) {
    return <img alt='' className='size-full object-contain' src={path} />;
  }

  return (
    <span className='grid size-full place-items-center text-2xl font-semibold tracking-[-0.06em]'>
      {identity.shortName}
    </span>
  );
}

export default function DesignBoard({
  identity,
  tool,
}: {
  identity: BrandIdentity;
  tool: StudioTool;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportPresetId, setExportPresetId] = useStudioDraft<MoodboardExportPresetId>(
    identity.id,
    tool.id,
    'export-preset',
    'retina'
  );
  const [customWidth, setCustomWidth] = useStudioDraft(
    identity.id,
    tool.id,
    'custom-width',
    2400
  );
  const exportDimensions = resolveMoodboardExport(exportPresetId, customWidth);
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
  const previewSvg = useMemo(
    () =>
      buildMoodboardSvg(identity, {
        interFont: '/fonts/inter-latin.woff2',
        logoMarks: logoPaths,
        markDark: markDarkPath,
        markLight: markLightPath,
        monoFont: '/fonts/geist-mono-latin.woff2',
        motionPreview: identity.motion[0]?.previewPath,
        proofMarks: identity.proofAssets.map(({ path }) => path),
      }),
    [identity, logoPaths, markDarkPath, markLightPath]
  );

  async function exportBoard() {
    setExporting(true);
    try {
      const motionPreviewPath = identity.motion[0]?.previewPath;
      const [{ interFont, monoFont }, logoMarks, markDark, markLight, motionPreview, proofMarks] =
        await Promise.all([
          loadFontAssets(),
          Promise.all(logoPaths.map((path) => imageUrlToDataUrl(path))),
          loadOptionalAsset(markDarkPath),
          loadOptionalAsset(markLightPath),
          loadOptionalAsset(motionPreviewPath),
          Promise.all(
            identity.proofAssets.slice(0, 4).map(({ path }) => imageUrlToDataUrl(path))
          ),
        ]);
      const svg = buildMoodboardSvg(identity, {
        interFont,
        logoMarks,
        markDark,
        markLight,
        monoFont,
        motionPreview,
        proofMarks,
      });

      await downloadSvgAsPng(
        svg,
        exportDimensions.width,
        exportDimensions.height,
        moodboardFilename(identity.name, exportDimensions.width, exportDimensions.height)
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className='tool-shell h-full min-h-0'>
      <header className='tool-header flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3'>
        <div className='min-w-0'>
          <p className='text-lg font-semibold tracking-tight'>{tool.name}</p>
          <p className='truncate text-sm text-muted-foreground'>{tool.description}</p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <Button onClick={() => downloadIdentity(identity)} type='button' variant='outline'>
            <FileJson aria-hidden='true' />
            <T>Identity JSON</T>
          </Button>
          <Button loading={exporting} onClick={exportBoard} type='button'>
            <Download aria-hidden='true' />
            <T>Download PNG</T>
          </Button>
        </div>
      </header>

      <div className='design-board-body tool-body'>
        <aside className='tool-inspector min-h-0 overflow-y-auto border-r border-border bg-background'>
          <section className='flex flex-col gap-4 border-b border-border p-5'>
            <div className='flex items-center gap-3'>
              <div className='grid size-10 place-items-center overflow-hidden rounded-md border border-border p-1.5'>
                <BrandMark identity={identity} />
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
                <T>Output size</T>
              </span>
              <StudioSelect
                ariaLabel='Output size'
                onValueChange={(value) => setExportPresetId(value as MoodboardExportPresetId)}
                options={MOODBOARD_EXPORT_PRESETS.map((preset) => ({
                  label: `${preset.label}${preset.id === 'custom' ? '' : ` · ${preset.width} × ${preset.height}`}`,
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
                PNG / {exportDimensions.megapixels.toFixed(1)} MP / 4:5
              </p>
            </div>
          </section>

          <section className='flex flex-col gap-3 border-b border-border p-5'>
            <h2 className='text-sm font-semibold'>
              <T>Generated applications</T>
            </h2>
            {identity.applications.slice(0, 10).map((application, index) => (
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
        </aside>

        <div className='tool-canvas min-h-0 overflow-auto'>
          <CanvasViewport identityId={identity.id} stageClassName='p-5 sm:p-8' toolId={tool.id}>
          <div
            aria-label={`${identity.name} moodboard with brand foundations and generated applications`}
            className='moodboard-preview mx-auto w-full max-w-[1200px] shadow-sm'
            dangerouslySetInnerHTML={{ __html: previewSvg }}
            data-testid='moodboard-preview'
            role='img'
          />
          </CanvasViewport>
        </div>
      </div>
    </div>
  );
}
