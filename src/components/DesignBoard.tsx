'use client';

import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { T, useGT } from 'gt-next';
import {
  ArrowDown,
  ArrowUp,
  Download,
  Eye,
  EyeOff,
  FileImage,
  FileJson,
  Layers3,
  RotateCcw,
} from '@/components/ui/SolidIcons';

import BrandEditableText from '@/components/BrandEditableText';
import CanvasViewport from '@/components/CanvasViewport';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { LabInspectorSection, StudioSidebar } from '@/components/LabWorkspace';
import SourceCodeDrawer from '@/components/LazySourceCodeDrawer';
import StudioFileMenu from '@/components/StudioFileMenu';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import StudioToolHeader from '@/components/StudioToolHeader';
import ThemeAwareBrandMark from '@/components/ThemeAwareBrandMark';
import { Button } from '@/components/ui/Button';
import StudioSelect from '@/components/ui/StudioSelect';
import { useStudioDraft } from '@/hooks/usePersistentState';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { brandFontAssets, type BrandIdentity } from '@/lib/brandIdentity';

import styles from './DesignBoard.module.css';
import { BRAND_SURFACE_TONE_LABELS, BRAND_SURFACE_TONES } from '@/lib/brandOutputKit';
import { imageUrlToDataUrl, resolveSvgRasterDimensions, svgToPngBlob } from '@/lib/download';
import {
  isMoodboardComposition,
  MOODBOARD_ASPECT_LABELS,
  MOODBOARD_EXPORT_PRESETS,
  moodboardAssets,
  moodboardFilename,
  resolveMoodboardExport,
  type MoodboardComposition,
  type MoodboardExportPresetId,
} from '@/lib/moodboard';
import {
  MOODBOARD_BOARD_TITLES,
  MOODBOARD_COPY_FIELDS,
  MOODBOARD_IMAGE_KINDS,
  MOODBOARD_SOURCE_SCHEMA,
  MOODBOARD_SOURCE_VERSION,
  MOODBOARD_SPAN_LABELS,
  MOODBOARD_TILE_LABELS,
  MOODBOARD_TILE_SPANS,
  MOODBOARD_TILE_VARIANTS,
  MOODBOARD_VARIANT_LABELS,
  moodboardImageAssetIds,
  moodboardSourceBoards,
  parseMoodboardOverrides,
  resetMoodboardBoard,
  resetMoodboardTile,
  sanitizeMoodboardOverrides,
  updateMoodboardBoard,
  updateMoodboardTile,
  type MoodboardCopyField,
  type MoodboardOverrides,
  type MoodboardRect,
  type MoodboardSurface,
  type MoodboardTile,
  type MoodboardTileOverride,
} from '@/lib/moodboardBoard';
import {
  boardColors,
  buildMoodboardSvg,
  layoutMoodboard,
  moodboardFontFaceCss,
  moodboardPreviewAssets,
  renderMoodboardTile,
  type MoodboardTextSlot,
  type MoodboardTileRender,
} from '@/lib/moodboardSvg';
import {
  parseSourceObject,
  sourceNumber,
  sourceString,
  stringifySource,
} from '@/lib/sourceCode';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { registerStudioAutomation } from '@/lib/studioAutomation';

const BOARD_OPTIONS: ReadonlyArray<{ label: string; value: MoodboardComposition }> = [
  { label: 'Showcase · application collage · 16:9', value: 'showcase' },
  { label: 'Campaign · launch in market · 16:9', value: 'campaign' },
  { label: 'System · foundations review · 4:5', value: 'system' },
  { label: 'Specimen · type and colour · 4:5', value: 'specimen' },
  { label: 'Catalog · complete contact sheet · 2:3', value: 'catalog' },
];

const BOARD_DESCRIPTIONS: Record<MoodboardComposition, string> = {
  campaign: 'The identity in market: key visual, billboard, poster and social series, email, badge, and site.',
  catalog: 'Every tile, eligible source asset, and generated application in one complete review board.',
  showcase: 'A presentation collage of the key visual, applications, type, colour, imagery, and voice.',
  specimen: 'Display and text faces, the type scale, character set, colour proportions, contrast pairs, and tonal ramps.',
  system: 'Logo, concept, type scale, colour, device construction, imagery, voice, motion, and proof for review.',
};

const COPY_FIELD_LABELS: Record<MoodboardCopyField, string> = { body: 'Body', caption: 'Caption', headline: 'Headline' };

function finiteInputValue(input: HTMLInputElement, fallback: number): number {
  return Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : fallback;
}

function identityExport(identity: BrandIdentity): ExportPreviewAsset {
  const previewText = JSON.stringify(identity, null, 2);
  return {
    blob: new Blob([previewText], { type: 'application/json' }),
    fileName: `${identity.id}-brand-identity.json`,
    format: 'JSON',
    previewText,
  };
}

/** Session cache so repeated exports never refetch and re-encode the same files. */
const EMBED_CACHE = new Map<string, Promise<string>>();
const EMBED_CACHE_LIMIT = 96;

function embeddedDataUrl(source: string): Promise<string> {
  const cached = EMBED_CACHE.get(source);
  if (cached) return cached;
  const request = imageUrlToDataUrl(source);
  EMBED_CACHE.set(source, request);
  void request.catch(() => EMBED_CACHE.delete(source));
  if (EMBED_CACHE.size > EMBED_CACHE_LIMIT) EMBED_CACHE.delete(EMBED_CACHE.keys().next().value!);
  return request;
}

/** Replace every external `href` in the board with an embedded data URL. */
async function embedBoardImages(svg: string): Promise<string> {
  const sources = [...new Set([...svg.matchAll(/href="([^"]+)"/g)].map((match) => match[1]!))].filter((source) => !source.startsWith('data:') && !source.startsWith('#'));
  const pairs = await Promise.all(sources.map(async (source) => {
    const unescaped = source.replaceAll('&amp;', '&');
    try {
      return [source, await embeddedDataUrl(unescaped)] as const;
    } catch {
      return [source, ''] as const;
    }
  }));
  return pairs.reduce((markup, [source, data]) => (data ? markup.replaceAll(`href="${source}"`, `href="${data}"`) : markup), svg);
}

async function embeddedFontCss(identity: BrandIdentity): Promise<string> {
  const fonts = brandFontAssets(identity);
  const entries = await Promise.all(fonts.map(async (font) => {
    try {
      return [font.path, await embeddedDataUrl(font.path)] as const;
    } catch {
      return [font.path, ''] as const;
    }
  }));
  return moodboardFontFaceCss(identity, new Map(entries.filter(([, data]) => data)));
}

/** Wait for every brand face the board uses so text never rasterises in a fallback. */
async function ensureBrandFonts(identity: BrandIdentity): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(brandFontAssets(identity).map((font) => document.fonts.load(`${font.weight} 32px "${font.family}"`).catch(() => [])));
}

type TileViewProps = {
  dragging: boolean;
  editingField: MoodboardCopyField | null;
  label: string;
  onBeginEdit: (field: MoodboardCopyField) => void;
  onCommitCopy: (field: MoodboardCopyField, value: string) => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
  onEndEdit: () => void;
  onSelect: () => void;
  rect: MoodboardRect;
  render: MoodboardTileRender;
  selected: boolean;
  tile: MoodboardTile;
  boardWidth: number;
  boardHeight: number;
};

function slotStyle(slot: MoodboardTextSlot, rect: MoodboardRect, boardWidth: number): CSSProperties {
  const unit = 100 / boardWidth;
  return {
    background: slot.background,
    color: slot.color,
    fontFamily: slot.family,
    fontSize: `${slot.fontSize * unit}cqi`,
    fontWeight: slot.weight,
    height: `${(slot.height / rect.height) * 100}%`,
    left: `${(slot.x / rect.width) * 100}%`,
    letterSpacing: `${slot.tracking * unit}cqi`,
    lineHeight: `${slot.lineHeight * unit}cqi`,
    textAlign: slot.anchor === 'middle' ? 'center' : 'left',
    top: `${(slot.y / rect.height) * 100}%`,
    width: `${(slot.width / rect.width) * 100}%`,
  };
}

const MoodboardTileView = memo(function MoodboardTileView({
  boardHeight,
  boardWidth,
  dragging,
  editingField,
  label,
  onBeginEdit,
  onCommitCopy,
  onDragStart,
  onDrop,
  onEndEdit,
  onSelect,
  rect,
  render,
  selected,
  tile,
}: TileViewProps) {
  const slots = render.slots.filter((slot, index, all) => all.findIndex((candidate) => candidate.field === slot.field) === index);
  const editing = slots.find((slot) => slot.field === editingField);
  const position: CSSProperties = {
    height: `${(rect.height / boardHeight) * 100}%`,
    left: `${(rect.x / boardWidth) * 100}%`,
    top: `${(rect.y / boardHeight) * 100}%`,
    width: `${(rect.width / boardWidth) * 100}%`,
  };
  const slotPosition = (slot: MoodboardTextSlot): CSSProperties => ({
    height: `${(slot.height / rect.height) * 100}%`,
    left: `${(slot.x / rect.width) * 100}%`,
    top: `${(slot.y / rect.height) * 100}%`,
    width: `${(slot.width / rect.width) * 100}%`,
  });
  return (
    <>
      <div
        aria-label={`Select ${label} tile`}
        aria-pressed={selected}
        className={styles.tile}
        data-canvas-interactive
        data-dragging={dragging || undefined}
        data-selected={selected || undefined}
        data-tile={tile.id}
        draggable={!editing}
        onClick={onSelect}
        onDragOver={(event) => event.preventDefault()}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        role='button'
        style={position}
        tabIndex={0}
      >
        <svg aria-hidden='true' dangerouslySetInnerHTML={{ __html: render.markup }} preserveAspectRatio='none' viewBox={`0 0 ${rect.width} ${rect.height}`} />
      </div>
      {selected ? (
        <div className={styles.slots} data-canvas-interactive style={position}>
          {slots.map((slot) => (slot.field === editingField ? null : (
            <button
              aria-label={`Edit ${label} ${COPY_FIELD_LABELS[slot.field].toLocaleLowerCase()}`}
              className={styles.slot}
              key={slot.field}
              onClick={() => onBeginEdit(slot.field)}
              style={slotPosition(slot)}
              type='button'
            />
          )))}
          {editing ? (
            <BrandEditableText
              as='div'
              autoFocus
              className={styles.slotEditor}
              label={`${label} ${COPY_FIELD_LABELS[editing.field].toLocaleLowerCase()} text`}
              multiline={editing.field === 'body'}
              onCommit={(value) => onCommitCopy(editing.field, value)}
              onDone={onEndEdit}
              style={slotStyle(editing, rect, boardWidth)}
              value={tile.copy[editing.field]}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
});

export default function DesignBoard({
  identity,
  tool,
}: {
  identity: BrandIdentity;
  tool: StudioTool;
}) {
  const gt = useGT();
  const scope = `mb${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const studioRootRef = useRef<HTMLDivElement>(null);
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:moodboard`);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<MoodboardCopyField | null>(null);
  const [draggingTileId, setDraggingTileId] = useState<string | null>(null);
  const [exportPresetId, setExportPresetId] = useStudioDraft<MoodboardExportPresetId>(identity.id, tool.id, 'export-preset', 'retina');
  const [storedComposition, setComposition] = useStudioDraft<MoodboardComposition>(identity.id, tool.id, 'composition', 'showcase');
  const [customWidth, setCustomWidth] = useStudioDraft(identity.id, tool.id, 'custom-width', 2400);
  const [storedBoards, setStoredBoards] = useStudioDraft<MoodboardOverrides>(identity.id, tool.id, 'boards', {});
  const composition: MoodboardComposition = isMoodboardComposition(storedComposition) ? storedComposition : 'showcase';
  const overrides = useMemo(() => sanitizeMoodboardOverrides(identity, storedBoards), [identity, storedBoards]);
  const layout = useMemo(() => layoutMoodboard(identity, composition, overrides), [composition, identity, overrides]);
  const board = layout.board;
  const exportDimensions = resolveMoodboardExport(exportPresetId, customWidth, composition);
  const raster = resolveSvgRasterDimensions(exportDimensions.width, exportDimensions.height);
  const boardAssets = useMemo(() => moodboardAssets(identity), [identity]);
  const previewAssets = useMemo(() => moodboardPreviewAssets(identity, boardAssets), [boardAssets, identity]);
  const imageOptions = useMemo(() => {
    const assets = new Map(identity.assets.map((asset) => [asset.id, asset]));
    return moodboardImageAssetIds(identity).map((id) => ({ label: assets.get(id)?.label ?? id, value: id }));
  }, [identity]);
  const colors = boardColors(identity, board.surface);
  const selectedTile = board.tiles.find((tile) => tile.id === selectedTileId) ?? null;

  // Per-tile render cache: an edit re-renders only the tile it touched.
  const renderCacheRef = useRef<{ identity: BrandIdentity; renders: Map<string, MoodboardTileRender> }>({ identity, renders: new Map() });
  if (renderCacheRef.current.identity !== identity) renderCacheRef.current = { identity, renders: new Map() };
  const tileRenders = useMemo(() => {
    const cache = renderCacheRef.current.renders;
    const used = new Set<string>();
    const renders = layout.tiles.map(({ rect, tile }) => {
      const key = `${JSON.stringify(tile)}|${rect.width}x${rect.height}`;
      used.add(key);
      let render = cache.get(key);
      if (!render) {
        render = renderMoodboardTile({ assets: previewAssets, height: rect.height, identity, scope, tile, width: rect.width });
        cache.set(key, render);
      }
      return render;
    });
    for (const key of cache.keys()) if (!used.has(key)) cache.delete(key);
    return renders;
  }, [identity, layout, previewAssets, scope]);

  // Masthead, board fill, and catalog indexes; tiles render separately so edits stay local.
  const backdropSvg = useMemo(
    () => buildMoodboardSvg(identity, previewAssets, composition, overrides, `${scope}bg`, { tiles: false }),
    [composition, identity, overrides, previewAssets, scope]
  );

  function commitOverrides(next: MoodboardOverrides) {
    setStoredBoards(next);
  }

  function updateTile(tileId: string, patch: MoodboardTileOverride) {
    commitOverrides(updateMoodboardTile(identity, overrides, composition, tileId, patch));
  }

  function updateBoard(patch: { order?: string[]; surface?: MoodboardSurface; title?: string }) {
    commitOverrides(updateMoodboardBoard(identity, overrides, composition, patch));
  }

  function moveTile(tileId: string, offset: number) {
    const order = board.tiles.map(({ id }) => id);
    const index = order.indexOf(tileId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= order.length) return;
    order.splice(index, 1);
    order.splice(target, 0, tileId);
    updateBoard({ order });
  }

  function dropTile(targetId: string) {
    if (!draggingTileId || draggingTileId === targetId) return;
    const order = board.tiles.map(({ id }) => id).filter((id) => id !== draggingTileId);
    order.splice(order.indexOf(targetId), 0, draggingTileId);
    updateBoard({ order });
    setDraggingTileId(null);
  }

  function readSource(): string {
    return stringifySource({
      boards: moodboardSourceBoards(identity, overrides),
      composition,
      customWidth,
      exportPresetId,
      schema: MOODBOARD_SOURCE_SCHEMA,
      version: MOODBOARD_SOURCE_VERSION,
    });
  }

  function applySource(source: string) {
    const next = parseSourceObject(source);
    const nextComposition = sourceString(next, 'composition', composition);
    const nextPreset = sourceString(next, 'exportPresetId', exportPresetId);
    if (!isMoodboardComposition(nextComposition)) {
      throw new TypeError('Composition must be showcase, campaign, system, specimen, or catalog.');
    }
    if (!MOODBOARD_EXPORT_PRESETS.some(({ id }) => id === nextPreset)) {
      throw new TypeError('Export preset does not exist.');
    }
    if (next.version !== undefined && next.version !== 1 && next.version !== MOODBOARD_SOURCE_VERSION) {
      throw new RangeError(`Moodboard source version ${String(next.version)} is not supported.`);
    }
    // Version 1 documents carry no boards; they keep the current tile edits.
    const nextBoards = parseMoodboardOverrides(identity, next.boards, overrides);
    setComposition(nextComposition);
    setExportPresetId(nextPreset as MoodboardExportPresetId);
    setCustomWidth(Math.min(4800, Math.max(800, sourceNumber(next, 'customWidth', customWidth))));
    commitOverrides(nextBoards);
  }

  async function renderExportSvg(): Promise<string> {
    const [fontFaceCss] = await Promise.all([embeddedFontCss(identity), ensureBrandFonts(identity)]);
    const svg = buildMoodboardSvg(identity, { ...previewAssets, fontFaceCss }, composition, overrides, `${scope}x`);
    return embedBoardImages(svg);
  }

  async function exportBoard() {
    setExporting(true);
    studioExport.start('Rendering moodboard PNG');
    const started = performance.now();
    try {
      const svg = await renderExportSvg();
      const blob = await svgToPngBlob(svg, exportDimensions.width, exportDimensions.height);
      const asset: ExportPreviewAsset = {
        blob,
        elapsedMs: Math.round(performance.now() - started),
        fileName: moodboardFilename(identity.name, raster.width, raster.height),
        format: 'PNG',
        height: raster.height,
        width: raster.width,
      };
      setLastExport(asset);
      return asset;
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  async function exportVector() {
    setExporting(true);
    studioExport.start('Packaging moodboard SVG');
    try {
      const svg = await renderExportSvg();
      const asset: ExportPreviewAsset = {
        blob: new Blob([svg], { type: 'image/svg+xml' }),
        fileName: moodboardFilename(identity.name, layout.width, layout.height).replace(/\.png$/, '.svg'),
        format: 'SVG',
        height: layout.height,
        width: layout.width,
      };
      setLastExport(asset);
      return asset;
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  function exportIdentity() {
    const asset = identityExport(identity);
    setLastExport(asset);
    return asset;
  }

  const automationRef = useCommittedRef({ applySource, exportBoard, exportIdentity, exportVector, readSource });
  useEffect(() => registerStudioAutomation({
    actions: studioToolActionNames('design-board'),
    applySource: (source) => automationRef.current.applySource(source),
    getSource: () => automationRef.current.readSource(),
    invoke: (action) => {
      if (action === 'moodboard.export.png') return automationRef.current.exportBoard();
      if (action === 'moodboard.export.svg') return automationRef.current.exportVector();
      if (action === 'moodboard.export.identity') return automationRef.current.exportIdentity();
      throw new RangeError(`Unknown Moodboard action: ${action}.`);
    },
    toolId: 'design-board',
  }, studioRootRef.current), [automationRef]);

  useEffect(() => {
    if (!selectedTileId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !editingField) setSelectedTileId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editingField, selectedTileId]);

  const visibleCount = board.tiles.filter((tile) => !tile.hidden).length;

  return (
    <div className='tool-shell h-full min-h-0' ref={studioRootRef}>
      <StudioToolHeader
        actions={(
          <>
            <StudioFileMenu onSource={() => setSourceOpen(true)} sections={[
              { label: 'Export', items: [
                { id: 'svg', label: 'Export SVG', description: 'Vector board with embedded fonts and images.', icon: <FileImage />, onSelect: () => { void exportVector(); } },
              ] },
              { label: 'Brand data', items: [
                { id: 'identity', label: 'Download identity JSON', description: 'Shared brand settings, not the rendered board.', icon: <FileJson />, onSelect: exportIdentity },
              ] },
            ]} />
            <ExportPreview asset={lastExport} />
            <Button disabled={exporting} onClick={() => { void exportBoard(); }} type='button'>
              <Download aria-hidden='true' />
              <T>Export PNG</T>
            </Button>
          </>
        )}
        metadata={`${MOODBOARD_BOARD_TITLES[composition]} · ${visibleCount} tiles`}
        title={tool.name}
        toolId={tool.id}
      />

      <div className='design-board-body tool-body'>
        <StudioSidebar className='tool-inspector min-h-0' label={`${tool.name} controls`} storageKey={`tool-${tool.id}`}>
          <section className='flex flex-col gap-3 border-b border-border p-5'>
            <div className='flex items-center gap-3'>
              <div className='grid size-10 place-items-center overflow-hidden rounded-md border border-border p-1.5'>
                <ThemeAwareBrandMark className='size-full' identity={identity} />
              </div>
              <div className='min-w-0'>
                <p className='truncate text-sm font-semibold'>{identity.name}</p>
                <p className='font-mono text-xs text-muted-foreground'>
                  {identity.kind === 'template' ? 'TEMPLATE / DUPLICATE TO START' : identity.kind === 'example' ? 'EXAMPLE / REPO AUDIT' : 'LOCAL / EDITABLE'}
                </p>
              </div>
            </div>
          </section>

          <LabInspectorSection action={(
            <Button aria-label={gt('Reset board')} onClick={() => { commitOverrides(resetMoodboardBoard(overrides, composition)); setSelectedTileId(null); }} size='icon-xs' title={gt('Reset board')} type='button' variant='ghost'>
              <RotateCcw aria-hidden='true' />
            </Button>
          )} title={<T>Board</T>}>
            <div className='element-editor-field'>
              <span><T>Board style</T></span>
              <StudioSelect ariaLabel='Board style' onValueChange={(value) => { setComposition(value as MoodboardComposition); setSelectedTileId(null); }} options={BOARD_OPTIONS} value={composition} />
            </div>
            <p className='text-xs leading-5 text-muted-foreground'>{BOARD_DESCRIPTIONS[composition]}</p>
            <label className='element-editor-field'>
              <span><T>Board title</T></span>
              <input aria-label='Board title' className='h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-foreground' maxLength={120} onChange={(event) => updateBoard({ title: event.target.value })} value={board.title} />
            </label>
            <div className='element-editor-field'>
              <span><T>Board surface</T></span>
              <StudioSelect ariaLabel='Board surface' onValueChange={(value) => updateBoard({ surface: value as MoodboardSurface })} options={[{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]} value={board.surface} />
            </div>
          </LabInspectorSection>

          <LabInspectorSection meta={`${visibleCount} / ${board.tiles.length}`} title={<T>Tiles</T>}>
            <ol className={styles.tileList}>
              {board.tiles.map((tile, index) => {
                const label = MOODBOARD_TILE_LABELS[tile.kind];
                return (
                  <li data-hidden={tile.hidden || undefined} data-selected={tile.id === selectedTileId || undefined} key={tile.id}>
                    <button aria-label={`${tile.hidden ? 'Show' : 'Hide'} ${label} tile ${tile.id}`} className={styles.tileIcon} onClick={() => updateTile(tile.id, { hidden: !tile.hidden })} title={tile.hidden ? 'Show tile' : 'Hide tile'} type='button'>
                      {tile.hidden ? <EyeOff aria-hidden='true' /> : <Eye aria-hidden='true' />}
                    </button>
                    <button aria-label={`Select ${label} tile ${tile.id} in list`} className={styles.tileName} onClick={() => setSelectedTileId(tile.id)} type='button'>
                      <span>{label}</span>
                      <small>{MOODBOARD_VARIANT_LABELS[tile.variant] ?? tile.variant} · {tile.span} col</small>
                    </button>
                    <button aria-label={`Move ${label} tile ${tile.id} earlier`} className={styles.tileIcon} disabled={index === 0} onClick={() => moveTile(tile.id, -1)} type='button'><ArrowUp aria-hidden='true' /></button>
                    <button aria-label={`Move ${label} tile ${tile.id} later`} className={styles.tileIcon} disabled={index === board.tiles.length - 1} onClick={() => moveTile(tile.id, 1)} type='button'><ArrowDown aria-hidden='true' /></button>
                  </li>
                );
              })}
            </ol>
            <p className='text-xs leading-5 text-muted-foreground'><T>Drag tiles on the board to reorder. Select a tile, then click its text to edit in place.</T></p>
          </LabInspectorSection>

          {selectedTile ? (
            <TileInspector
              imageOptions={imageOptions}
              key={selectedTile.id}
              onChange={(patch) => updateTile(selectedTile.id, patch)}
              onReset={() => commitOverrides(resetMoodboardTile(overrides, composition, selectedTile.id))}
              tile={selectedTile}
            />
          ) : null}

          <LabInspectorSection title={<T>Export</T>}>
            <div className='element-editor-field'>
              <span><T>Output size</T></span>
              <StudioSelect
                ariaLabel='Output size'
                onValueChange={(value) => setExportPresetId(value as MoodboardExportPresetId)}
                options={MOODBOARD_EXPORT_PRESETS.map((preset) => {
                  const size = resolveMoodboardExport(preset.id, customWidth, composition);
                  return { label: `${preset.label}${preset.id === 'custom' ? '' : ` · ${size.width} × ${size.height}`}`, value: preset.id };
                })}
                value={exportPresetId}
              />
            </div>
            {exportPresetId === 'custom' ? (
              <label className='element-editor-field'>
                <span><T>Custom width</T></span>
                <div className='flex items-center gap-2'>
                  <input aria-label='Custom width' className='h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 font-mono text-sm outline-none focus:border-foreground' max={4800} min={800} onChange={(event) => setCustomWidth(finiteInputValue(event.currentTarget, customWidth))} step={100} type='number' value={customWidth} />
                  <span className='font-mono text-xs text-muted-foreground'>PX</span>
                </div>
              </label>
            ) : null}
            <div className='border border-border bg-muted/50 p-3'>
              <p className='font-mono text-xs font-semibold'>{raster.width} × {raster.height} PX</p>
              <p className='mt-1 font-mono text-[10px] text-muted-foreground'>
                PNG / {((raster.width * raster.height) / 1_000_000).toFixed(1)} MP / {MOODBOARD_ASPECT_LABELS[composition]} · {exportDimensions.width} px layout at {raster.pixelRatio.toFixed(raster.pixelRatio % 1 ? 1 : 0)}×
              </p>
            </div>
            <p className='text-xs text-muted-foreground'>{boardAssets.length} eligible assets · screenshot captures excluded</p>
          </LabInspectorSection>

          <LabInspectorSection defaultExpanded={false} meta={`${identity.applications.length}`} title={<T>Generated applications</T>}>
            {identity.applications.map((application, index) => (
              <div className='flex items-center justify-between gap-4 text-sm' key={application.id}>
                <span className='min-w-0'>
                  <span className='block truncate text-muted-foreground'>{application.name}</span>
                  <span className='block font-mono text-[9px] uppercase text-muted-foreground/60'>{application.category} / {application.format}</span>
                </span>
                <span className='shrink-0 font-mono'>{String(index + 1).padStart(2, '0')}</span>
              </div>
            ))}
          </LabInspectorSection>

          <LabInspectorSection defaultExpanded={false} icon={<Layers3 aria-hidden='true' />} title={<T>Central idea and sources</T>}>
            <p className='text-sm font-semibold leading-6'>{identity.strategy.concept}</p>
            <p className='text-xs leading-5 text-muted-foreground'>{identity.graphicSystem.device} · {identity.graphicSystem.pattern}</p>
            {identity.sourceNotes.map((note) => <p className='text-xs leading-5 text-muted-foreground' key={note}>{note}</p>)}
          </LabInspectorSection>
        </StudioSidebar>

        <div className='tool-canvas min-h-0 overflow-hidden'>
          <CanvasViewport className='moodboard-canvas' identityId={identity.id} onBackgroundClick={() => { setSelectedTileId(null); setEditingField(null); }} stageClassName='moodboard-canvas-stage p-5 sm:p-8' toolId={tool.id}>
            <div
              aria-label={`${identity.name} ${composition} moodboard with brand foundations and generated applications`}
              className={`moodboard-preview ${styles.board} mx-auto w-full max-w-[1200px]`}
              data-board-mode={composition}
              data-testid='moodboard-preview'
              role='group'
              style={{ aspectRatio: `${layout.width} / ${layout.height}`, background: colors.background }}
            >
              <div aria-hidden='true' className={styles.backdrop} dangerouslySetInnerHTML={{ __html: backdropSvg }} />
              {layout.tiles.map(({ rect, tile }, index) => (
                <MoodboardTileView
                  boardHeight={layout.height}
                  boardWidth={layout.width}
                  dragging={draggingTileId === tile.id}
                  editingField={tile.id === selectedTileId ? editingField : null}
                  key={tile.id}
                  label={MOODBOARD_TILE_LABELS[tile.kind]}
                  onBeginEdit={(field) => setEditingField(field)}
                  onCommitCopy={(field, value) => updateTile(tile.id, { copy: { [field]: value } })}
                  onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggingTileId(tile.id); }}
                  onDrop={(event) => { event.preventDefault(); dropTile(tile.id); }}
                  onEndEdit={() => setEditingField(null)}
                  onSelect={() => { setSelectedTileId(tile.id); if (tile.id !== selectedTileId) setEditingField(null); }}
                  rect={rect}
                  render={tileRenders[index]!}
                  selected={tile.id === selectedTileId}
                  tile={tile}
                />
              ))}
            </div>
          </CanvasViewport>
        </div>
      </div>
      {sourceOpen ? (
        <SourceCodeDrawer
          format='JSON · moodboard boards, tiles, and export'
          onApply={applySource}
          onClose={() => setSourceOpen(false)}
          source={readSource()}
          title={`${identity.name} moodboard source`}
        />
      ) : null}
    </div>
  );
}

function TileInspector({
  imageOptions,
  onChange,
  onReset,
  tile,
}: {
  imageOptions: ReadonlyArray<{ label: string; value: string }>;
  onChange: (patch: MoodboardTileOverride) => void;
  onReset: () => void;
  tile: MoodboardTile;
}) {
  const gt = useGT();
  const label = MOODBOARD_TILE_LABELS[tile.kind];
  return (
    <LabInspectorSection action={(
      <Button aria-label={gt('Reset tile')} onClick={onReset} size='icon-xs' title={gt('Reset tile')} type='button' variant='ghost'>
        <RotateCcw aria-hidden='true' />
      </Button>
    )} meta={tile.id} title={label}>
      <div className='element-editor-field'>
        <span><T>Layout</T></span>
        <StudioSelect ariaLabel='Tile layout' onValueChange={(variant) => onChange({ variant })} options={MOODBOARD_TILE_VARIANTS[tile.kind].map((variant) => ({ label: MOODBOARD_VARIANT_LABELS[variant] ?? variant, value: variant }))} value={tile.variant} />
      </div>
      <div className='element-editor-field'>
        <span><T>Size</T></span>
        <StudioSelect ariaLabel='Tile size' onValueChange={(span) => onChange({ span: Number(span) as MoodboardTile['span'] })} options={MOODBOARD_TILE_SPANS.map((span) => ({ label: MOODBOARD_SPAN_LABELS[span], value: String(span) }))} value={String(tile.span)} />
      </div>
      <div className='element-editor-field'>
        <span><T>Surface</T></span>
        <StudioSelect ariaLabel='Tile surface' onValueChange={(tone) => onChange({ tone: tone as MoodboardTile['tone'] })} options={BRAND_SURFACE_TONES.map((tone) => ({ label: BRAND_SURFACE_TONE_LABELS[tone], value: tone }))} value={tile.tone} />
      </div>
      {MOODBOARD_IMAGE_KINDS.has(tile.kind) ? (
        <div className='element-editor-field'>
          <span><T>Image</T></span>
          <StudioSelect ariaLabel='Tile image' onValueChange={(assetId) => onChange({ assetId: assetId === 'none' ? '' : assetId })} options={[{ label: 'Graphic device', value: 'none' }, ...imageOptions]} value={tile.assetId || 'none'} />
        </div>
      ) : null}
      {MOODBOARD_COPY_FIELDS.map((field) => (
        <label className='element-editor-field' key={field}>
          <span>{COPY_FIELD_LABELS[field]}</span>
          <textarea aria-label={`Tile ${field}`} className='min-h-16 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 outline-none focus:border-foreground' maxLength={600} onChange={(event) => onChange({ copy: { [field]: event.target.value } })} value={tile.copy[field]} />
        </label>
      ))}
      <Button onClick={() => onChange({ hidden: !tile.hidden })} size='sm' type='button' variant='outline'>
        {tile.hidden ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
        {tile.hidden ? <T>Show tile</T> : <T>Hide tile</T>}
      </Button>
    </LabInspectorSection>
  );
}
