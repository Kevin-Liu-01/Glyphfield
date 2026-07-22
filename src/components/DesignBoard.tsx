'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { T } from 'gt-next';
import { Download, FileJson, Layers3 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { formatOklch } from '@/lib/color';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { brandAssetPath } from '@/lib/brandIdentity';
import { downloadSvgAsPng, escapeXml, imageUrlToDataUrl } from '@/lib/download';
import {
  moodboardFilename,
  MOODBOARD_EXPORT_PRESETS,
  resolveMoodboardExport,
  type MoodboardExportPresetId,
} from '@/lib/moodboard';
import type { StudioTool } from '@/lib/studioCatalog';

function wrapText(value: string, lineLength: number, maximumLines = 4): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  for (const word of words) {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > lineLength) {
      if (lines.length === maximumLines) break;
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${current} ${word}`;
    }
  }

  return lines;
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

function BrandMark({ identity, inverted = false }: { identity: BrandIdentity; inverted?: boolean }) {
  const path = brandAssetPath(identity, inverted ? 'mark-light' : 'mark-dark');

  if (path) {
    return <img alt='' className='size-full object-contain' src={path} />;
  }

  return (
    <span className='grid size-full place-items-center text-5xl font-semibold tracking-[-0.06em]'>
      {identity.shortName}
    </span>
  );
}

function BoardLabel({ children }: { children: ReactNode }) {
  return (
    <p className='font-mono text-[10px] uppercase tracking-[0.18em] text-black/45'>
      {children}
    </p>
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
  const [exportPresetId, setExportPresetId] =
    useState<MoodboardExportPresetId>('retina');
  const [customWidth, setCustomWidth] = useState(2400);
  const ink = identity.colors.find(({ id }) => id === 'ink')?.hex ?? '#18181B';
  const paper = identity.colors.find(({ id }) => id === 'paper')?.hex ?? '#FFFFFF';
  const markPath = brandAssetPath(identity, 'mark-dark');
  const exportDimensions = resolveMoodboardExport(exportPresetId, customWidth);

  async function exportBoard() {
    setExporting(true);
    try {
      const mark = markPath ? await imageUrlToDataUrl(markPath) : null;
      const descriptionLines = wrapText(identity.positioning, 58, 4)
        .map(
          (line, index) =>
            `<text x="92" y="${310 + index * 42}" fill="#666666" font-family="Inter, Arial, sans-serif" font-size="28">${escapeXml(line)}</text>`
        )
        .join('');
      const colorWidth = 1320 / Math.max(1, identity.colors.length);
      const colorBlocks = identity.colors
        .map(
          (color, index) =>
            `<rect x="${92 + index * colorWidth}" y="650" width="${colorWidth}" height="190" fill="${color.hex}"/><text x="${104 + index * colorWidth}" y="875" fill="#18181B" font-family="monospace" font-size="14">${escapeXml(color.name.toLocaleUpperCase())}</text><text x="${104 + index * colorWidth}" y="900" fill="#777777" font-family="monospace" font-size="14">${escapeXml(color.hex)}</text>`
        )
        .join('');
      const products = identity.products
        .slice(0, 4)
        .map(
          (product, index) =>
            `<rect x="${92 + index * 330}" y="1260" width="300" height="170" fill="#F4F4F5"/><text x="${116 + index * 330}" y="1320" fill="#18181B" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="700">0${index + 1}</text><text x="${116 + index * 330}" y="1384" fill="#18181B" font-family="Inter, Arial, sans-serif" font-size="22">${escapeXml(product)}</text>`
        )
        .join('');
      const principles = identity.voice.principles
        .slice(0, 4)
        .map(
          (principle, index) =>
            `<text x="92" y="${1600 + index * 42}" fill="#18181B" font-family="Inter, Arial, sans-serif" font-size="25">${String(index + 1).padStart(2, '0')}  ${escapeXml(principle)}</text>`
        )
        .join('');
      const logoImages = await Promise.all(
        identity.assets
          .filter(({ type }) => type === 'logo')
          .slice(0, 4)
          .map(async (asset) => ({ ...asset, dataUrl: await imageUrlToDataUrl(asset.path) }))
      );
      const logoFamily =
        logoImages.length > 0
          ? logoImages
              .map(
                (asset, index) => {
                  const tileFill = asset.surface === 'dark' ? ink : '#F4F4F5';
                  const labelFill = asset.surface === 'dark' ? '#FFFFFF' : '#777777';
                  return `<rect x="${500 + index * 250}" y="454" width="230" height="92" fill="${tileFill}"/><image href="${asset.dataUrl}" x="${520 + index * 250}" y="470" width="190" height="48" preserveAspectRatio="xMidYMid meet"/><text x="${520 + index * 250}" y="535" fill="${labelFill}" opacity=".72" font-family="monospace" font-size="10">${escapeXml(asset.label.toLocaleUpperCase())}</text>`;
                }
              )
              .join('')
          : `<rect x="500" y="454" width="230" height="92" fill="#F4F4F5"/><text x="615" y="515" text-anchor="middle" fill="${ink}" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700">${escapeXml(identity.shortName)}</text>`;
      const proofImages = await Promise.all(
        identity.proofAssets
          .slice(0, 5)
          .map(async (asset) => ({ ...asset, dataUrl: await imageUrlToDataUrl(asset.path) }))
      );
      const proofRow = proofImages
        .map(
          (asset, index) =>
            `<image href="${asset.dataUrl}" x="${858 + index * 128}" y="1848" width="104" height="30" preserveAspectRatio="xMidYMid meet"/>`
        )
        .join('');
      const typographyLabel = [
        ...new Set(identity.typography.map(({ family }) => family)),
      ].join(' / ');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000"><rect width="1600" height="2000" fill="#FFFFFF"/><text x="92" y="94" fill="#777777" font-family="monospace" font-size="15" letter-spacing="3">BRAND IDENTITY / MOODBOARD</text><text x="92" y="205" fill="${ink}" font-family="Inter, Arial, sans-serif" font-size="76" font-weight="700" letter-spacing="-4">${escapeXml(identity.name)}</text><text x="92" y="260" fill="#777777" font-family="Inter, Arial, sans-serif" font-size="25">${escapeXml(identity.tagline)}</text>${descriptionLines}${mark ? `<image href="${mark}" x="1240" y="92" width="260" height="260" preserveAspectRatio="xMidYMid meet"/>` : `<text x="1310" y="235" fill="${ink}" font-family="Inter, Arial, sans-serif" font-size="72" font-weight="700">${escapeXml(identity.shortName)}</text>`}<text x="92" y="510" fill="#777777" font-family="monospace" font-size="13" letter-spacing="2">LOGO FAMILY</text>${logoFamily}<line x1="92" y1="570" x2="1508" y2="570" stroke="#DDDDDD"/><text x="92" y="620" fill="#777777" font-family="monospace" font-size="15" letter-spacing="3">COLOR SYSTEM</text>${colorBlocks}<line x1="92" y1="980" x2="1508" y2="980" stroke="#DDDDDD"/><text x="92" y="1035" fill="#777777" font-family="monospace" font-size="15" letter-spacing="3">TYPOGRAPHY</text><text x="92" y="1145" fill="${ink}" font-family="Inter, Arial, sans-serif" font-size="70" font-weight="700" letter-spacing="-3">Aa  ${escapeXml(identity.name)}</text><text x="1010" y="1140" fill="#777777" font-family="monospace" font-size="20">${escapeXml(typographyLabel)}</text><line x1="92" y1="1200" x2="1508" y2="1200" stroke="#DDDDDD"/><text x="92" y="1240" fill="#777777" font-family="monospace" font-size="15" letter-spacing="3">PRODUCT SYSTEM</text>${products}<line x1="92" y1="1500" x2="1508" y2="1500" stroke="#DDDDDD"/><text x="92" y="1550" fill="#777777" font-family="monospace" font-size="15" letter-spacing="3">VOICE</text>${principles}<rect x="850" y="1550" width="658" height="250" fill="${ink}"/><text x="890" y="1610" fill="#FFFFFF" opacity=".55" font-family="monospace" font-size="14" letter-spacing="2">IN LANGUAGE</text>${wrapText(identity.voice.phrases[0] ?? identity.tagline, 35, 3).map((line, index) => `<text x="890" y="${1690 + index * 42}" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="28" font-weight="700">${escapeXml(line)}</text>`).join('')}${proofRow}<text x="92" y="1912" fill="#777777" font-family="monospace" font-size="14">${escapeXml(identity.website || 'LOCAL IDENTITY')}</text><text x="1508" y="1912" text-anchor="end" fill="#777777" font-family="monospace" font-size="14">GLYPHFIELD / ${escapeXml(identity.shortName)}</text></svg>`;
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
                <T>Rasterize the complete board into a production-ready 4:5 PNG.</T>
              </p>
            </div>
            <label className='flex flex-col gap-2 text-sm'>
              <span className='text-muted-foreground'>
                <T>Output size</T>
              </span>
              <select
                className='h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-foreground'
                onChange={(event) =>
                  setExportPresetId(event.target.value as MoodboardExportPresetId)
                }
                value={exportPresetId}
              >
                {MOODBOARD_EXPORT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                    {preset.id === 'custom' ? '' : ` · ${preset.width} × ${preset.height}`}
                  </option>
                ))}
              </select>
            </label>
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
            <h2 className='text-sm font-semibold'><T>Board contents</T></h2>
            {[
              ['Logo assets', identity.assets.length],
              ['Color tokens', identity.colors.length],
              ['Type roles', identity.typography.length],
              ['Motion studies', identity.motion.length],
              ['Product layers', identity.products.length],
              ['Proof points', identity.proof.length],
            ].map(([label, value]) => (
              <div className='flex items-center justify-between gap-4 text-sm' key={label}>
                <span className='text-muted-foreground'>{label}</span>
                <span className='font-mono'>{value}</span>
              </div>
            ))}
          </section>
          <section className='flex flex-col gap-3 p-5'>
            <div className='flex items-center gap-2 text-sm font-semibold'>
              <Layers3 className='size-4' aria-hidden='true' />
              <T>Sources</T>
            </div>
            {identity.sourceNotes.map((note) => (
              <p className='text-xs leading-5 text-muted-foreground' key={note}>{note}</p>
            ))}
          </section>
        </aside>

        <div className='tool-canvas min-h-0 overflow-auto p-5 sm:p-8'>
          <article
            className='design-board mx-auto w-full max-w-[1440px] overflow-hidden border border-black/15 bg-white text-black shadow-sm'
            data-testid='design-board'
          >
            <section className='grid min-h-[500px] grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(272px,0.65fr)]'>
              <div className='flex min-w-0 flex-col justify-between gap-16 p-8 sm:p-10 lg:p-12'>
                <BoardLabel>Brand identity / moodboard</BoardLabel>
                <div className='flex max-w-4xl flex-col gap-5'>
                  <h1 className='break-words text-5xl font-semibold leading-[0.94] tracking-[-0.06em] sm:text-6xl'>
                    {identity.name}
                  </h1>
                  <p className='max-w-2xl text-xl leading-8 text-black/55'>{identity.tagline}</p>
                </div>
                <p className='max-w-3xl text-lg leading-8 text-black/65'>{identity.positioning}</p>
              </div>
              <div className='grid min-h-80 min-w-0 place-items-center p-10' style={{ backgroundColor: ink, color: paper }}>
                <div className='size-40'>
                  <BrandMark identity={identity} inverted />
                </div>
              </div>
            </section>

            <section className='border-t border-black/15 p-8 sm:p-12 lg:p-16'>
              <BoardLabel>01 / Logo family</BoardLabel>
              <div className='mt-8 grid gap-px bg-black/15 sm:grid-cols-2 lg:grid-cols-4'>
                {identity.assets.length > 0 ? identity.assets.slice(0, 4).map((asset) => (
                  <div className='flex min-h-48 flex-col justify-between gap-8 bg-white p-6' key={asset.id}>
                    <img alt={asset.label} className='h-24 w-full object-contain' src={asset.path} />
                    <p className='font-mono text-[10px] uppercase tracking-wider text-black/45'>{asset.label}</p>
                  </div>
                )) : (
                  <div className='grid min-h-48 place-items-center bg-white p-6 text-5xl font-semibold'>{identity.shortName}</div>
                )}
              </div>
            </section>

            <section className='border-t border-black/15 p-8 sm:p-12 lg:p-16'>
              <BoardLabel>02 / Color system</BoardLabel>
              <div className='mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                {identity.colors.map((color) => (
                  <div className='flex min-h-48 flex-col justify-end p-5' key={color.id} style={{ backgroundColor: color.hex, color: ['#18181B', '#000000', '#3B82F6'].includes(color.hex.toLocaleUpperCase()) ? '#FFFFFF' : '#18181B' }}>
                    <p className='text-sm font-semibold'>{color.name}</p>
                    <p className='mt-1 font-mono text-xs opacity-60'>{color.hex}</p>
                    <p className='font-mono text-xs opacity-60'>{formatOklch(color.hex)}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className='grid border-t border-black/15 lg:grid-cols-[1.25fr_0.75fr]'>
              <div className='p-8 sm:p-12 lg:p-16'>
                <BoardLabel>03 / Typography</BoardLabel>
                <p className='mt-12 text-6xl font-semibold leading-[0.95] tracking-[-0.055em] sm:text-8xl'>Aa</p>
                <p className='mt-8 max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.04em] sm:text-6xl'>
                  {identity.greetings.join(' ')}
                </p>
                <p className='mt-8 max-w-2xl text-lg leading-8 text-black/55'>{identity.description}</p>
              </div>
              <div className='flex flex-col justify-center gap-5 border-t border-black/15 bg-[#F4F4F5] p-8 lg:border-t-0 lg:border-l sm:p-12'>
                {identity.typography.map((font) => (
                  <div className='border-b border-black/15 pb-5 last:border-b-0' key={font.role}>
                    <p className='font-mono text-[10px] uppercase tracking-wider text-black/40'>{font.role}</p>
                    <p className='mt-1 text-xl font-semibold'>{font.family}</p>
                    <p className='mt-1 text-sm leading-5 text-black/50'>{font.usage}</p>
                  </div>
                ))}
              </div>
            </section>

            {identity.motion.length > 0 ? (
              <section className='border-t border-black/15 p-8 sm:p-12 lg:p-16'>
                <BoardLabel>04 / Motion language</BoardLabel>
                <div className='mt-8 grid gap-px bg-black/15 md:grid-cols-2'>
                  {identity.motion.map((motion) => (
                    <div className='bg-white' key={motion.id}>
                      <div className='grid aspect-[5/2] place-items-center bg-black p-5'>
                        <img alt={motion.name} className='size-full object-contain' src={motion.previewPath} />
                      </div>
                      <div className='flex items-start justify-between gap-6 p-5'>
                        <div>
                          <p className='text-sm font-semibold'>{motion.name}</p>
                          <p className='mt-1 text-xs leading-5 text-black/50'>{motion.description}</p>
                        </div>
                        <p className='shrink-0 font-mono text-[10px] text-black/45'>{motion.curve}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className='grid border-t border-black/15 lg:grid-cols-2'>
              <div className='p-8 sm:p-12 lg:p-16'>
                <BoardLabel>05 / Product architecture</BoardLabel>
                <div className='mt-8 grid gap-px bg-black/15 sm:grid-cols-2'>
                  {identity.products.length > 0 ? identity.products.map((product, index) => (
                    <div className='min-h-40 bg-[#F4F4F5] p-5' key={product}>
                      <p className='font-mono text-xs text-black/40'>0{index + 1}</p>
                      <p className='mt-12 text-xl font-semibold'>{product}</p>
                    </div>
                  )) : <p className='bg-[#F4F4F5] p-5 text-sm text-black/50'>Add product layers to this identity.</p>}
                </div>
              </div>
              <div className='p-8 sm:p-12 lg:p-16' style={{ backgroundColor: ink, color: paper }}>
                <p className='font-mono text-[10px] uppercase tracking-[0.18em] opacity-45'>06 / Voice</p>
                <div className='mt-10 flex flex-col gap-7'>
                  {identity.voice.principles.map((principle, index) => (
                    <div className='grid grid-cols-[32px_1fr] gap-4 border-b border-white/15 pb-5' key={principle}>
                      <span className='font-mono text-xs opacity-40'>0{index + 1}</span>
                      <span className='text-xl font-semibold'>{principle}</span>
                    </div>
                  ))}
                </div>
                {identity.voice.phrases[0] ? <blockquote className='mt-12 text-3xl font-semibold leading-tight tracking-[-0.035em]'>“{identity.voice.phrases[0]}”</blockquote> : null}
              </div>
            </section>

            {identity.proofAssets.length > 0 ? (
              <section className='border-t border-black/15 p-8 sm:p-12 lg:p-16'>
                <BoardLabel>07 / In good company</BoardLabel>
                <div className='mt-10 grid items-center gap-10 sm:grid-cols-3 lg:grid-cols-5'>
                  {identity.proofAssets.map((asset) => (
                    <img alt={asset.label} className='mx-auto h-8 max-w-36 object-contain' key={asset.id} src={asset.path} />
                  ))}
                </div>
              </section>
            ) : null}

            <footer className='flex flex-wrap items-center justify-between gap-4 border-t border-black/15 px-8 py-6 font-mono text-[10px] uppercase tracking-wider text-black/45 sm:px-12 lg:px-16'>
              <span>{identity.website || 'Local identity'}</span>
              <span>Glyphfield / {identity.shortName}</span>
            </footer>
          </article>
        </div>
      </div>
    </div>
  );
}
