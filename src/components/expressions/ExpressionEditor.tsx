'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { T, useGT } from 'gt-next';
import { Download, FileDown } from '@/components/ui/SolidIcons';

import CanvasSelectionMenu from '@/components/CanvasSelectionMenu';
import CanvasViewport from '@/components/CanvasViewport';
import DesignVersionControls from '@/components/DesignVersionControls';
import ExportPreview, { type ExportPreviewAsset } from '@/components/ExportPreview';
import { useStudioExportProgress } from '@/components/StudioExportProgress';
import { Button } from '@/components/ui/Button';
import StudioActionMenu from '@/components/ui/StudioActionMenu';
import { contextMenuPositionFromEvent, type StudioContextMenuPosition } from '@/components/ui/StudioContextMenu';
import { ToolShell } from '@/components/tools/ToolShell';
import { usePortableCanvasWorkspace } from '@/hooks/usePortableCanvasWorkspace';
import type { BrandIdentity } from '@/lib/brandIdentity';
import type { CanvasBounds, CanvasDocument } from '@/lib/canvasDocument';
import { isCanvasTextEditingTarget } from '@/lib/canvasInteraction';
import { resolveSvgRasterDimensions } from '@/lib/download';
import {
  buildPdf,
  buildPortableExpressionSvg,
  canvasBlob,
  canvasToPdfPage,
  createCanvasTextMeasure,
  rasterizeSvg,
  type ExportRenderBase,
} from '@/lib/expressionExport';
import {
  duplicateElements,
  duplicatePage,
  elementComponent,
  elementPageId,
  expressionFormats,
  expressionState,
  movePage,
  patchElement,
  removeElements,
  removePage,
  reorderElement,
  resolveExpressionFormat,
  type ExpressionAlignment,
  type ExpressionToolKind,
  type StackTarget,
} from '@/lib/expressionModel';
import {
  addExpressionLayer,
  alignExpressionLayers,
  describeExpressionDocument,
  EXPRESSION_ADDABLE_LAYERS,
  moveExpressionLayers,
  updateExpressionLayer,
  type AddLayerInput,
  type UpdateLayerInput,
} from '@/lib/expressionOperations';
import { parseExpressionSource, setCodeTab, uploadedFontFamily, withExpressionMirrors } from '@/lib/expressionSource';
import { defaultFontFamily, type ExpressionRenderContext } from '@/lib/expressionSvg';
import { assetArtworkLookup } from '@/lib/expressionType';
import {
  applyExpressionLayout,
  createExpressionDocument,
  expressionColors,
  expressionLayouts,
  newSlidePage,
  setExpressionFormat,
} from '@/lib/expressionTemplates';
import { addCodeTab, addLockupPartner, removeCodeTab, removeLockupPartner, updateLockup } from '@/lib/expressionToolOperations';
import { savedDesignStorageKey } from '@/lib/savedDesigns';
import type { StudioTool } from '@/lib/studioCatalog';
import { studioToolActionNames } from '@/lib/studioAgentCapabilities';
import { layerOrderShortcut } from '@/lib/layerOrderShortcut';
import { STUDIO_ARTIFACT_STAGE_CLASS } from '@/lib/studioCanvasPresentation';
import ExpressionCanvas from './ExpressionCanvas';
import { CanvasSection, ExpressionContentSections } from './ExpressionContentSections';
import { SelectionInspector } from './ExpressionInspector';
import ExpressionLayersPanel, { type LayersPanelApi } from './ExpressionLayersPanel';
import { readFileAsAsset } from './expressionEditorUtils';
import { useAssetAspects } from './useAssetAspects';
import { useExpressionDocument } from './useExpressionDocument';

const loadedUploadFonts = new Set<string>();

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, value]);
  return debounced;
}

/** Bumps when fonts finish loading, so text re-measures with real metrics. */
function useFontEpoch(document: CanvasDocument): number {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const fonts = window.document.fonts;
    if (!fonts) return;
    const bump = () => setEpoch((value) => value + 1);
    fonts.addEventListener('loadingdone', bump);
    void fonts.ready.then(bump);
    return () => fonts.removeEventListener('loadingdone', bump);
  }, []);
  useEffect(() => {
    const fonts = window.document.fonts;
    if (!fonts) return;
    const requests: Promise<unknown>[] = [];
    for (const asset of Object.values(document.assets)) {
      if (asset.kind !== 'font' || !asset.id.startsWith('font:upload-')) continue;
      const family = uploadedFontFamily(asset.id);
      if (loadedUploadFonts.has(family)) continue;
      loadedUploadFonts.add(family);
      const face = new FontFace(family, `url(${JSON.stringify(asset.source)})`);
      requests.push(face.load().then((loaded) => { fonts.add(loaded); }).catch(() => loadedUploadFonts.delete(family)));
    }
    const families = new Set<string>();
    for (const element of Object.values(document.elements)) {
      if (element.textStyle) families.add(`${element.textStyle.fontWeight} 32px "${element.textStyle.fontFamily}"`);
    }
    families.forEach((font) => requests.push(fonts.load(font).catch(() => undefined)));
    if (requests.length > 0) void Promise.all(requests).then(() => setEpoch((value) => value + 1));
  }, [document.assets, document.elements]);
  return epoch;
}

function inputRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
}

function inputIds(input: unknown): string[] {
  const ids = inputRecord(input).ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) throw new TypeError('ids must be an array of layer ids.');
  return ids as string[];
}

const STACK_TARGETS = new Set(['back', 'backward', 'forward', 'front']);
const ALIGNMENT_VALUES = new Set(['left', 'horizontal-center', 'right', 'top', 'vertical-center', 'bottom']);

export default function ExpressionEditor({ identity, kind, tool }: { identity: BrandIdentity; kind: ExpressionToolKind; tool: StudioTool }) {
  const gt = useGT();
  const reactId = useId();
  const idPrefix = `xp${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const studioExport = useStudioExportProgress(`${identity.id}:${tool.id}:${kind}`);
  const history = useExpressionDocument(() => createExpressionDocument(kind, identity, { toolId: tool.id }));
  const { commit, document, documentRef } = history;
  const [requestedPageId, setActivePageId] = useState(document.pageIds[0]!);
  const activePageId = document.pages[requestedPageId] ? requestedPageId : document.pageIds[0]!;
  const [requestedSelection, setSelection] = useState<string[]>([]);
  const selection = useMemo(
    () => requestedSelection.filter((id) => document.pages[activePageId]?.elementIds.includes(id)),
    [activePageId, document.pages, requestedSelection]
  );
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const activePageRef = useRef(activePageId);
  activePageRef.current = activePageId;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ ids: string[]; position: StudioContextMenuPosition } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportPreviewAsset | null>(null);

  // Rendering context -------------------------------------------------------
  const fontEpoch = useFontEpoch(document);
  // A new measurer per font epoch drops widths measured with fallback fonts.
  const measure = useMemo(() => {
    void fontEpoch;
    return createCanvasTextMeasure();
  }, [fontEpoch]);
  const colors = useMemo(() => expressionColors(identity), [identity]);
  const assets = document.assets;
  const aspects = useAssetAspects(assets);
  const assetAspect = useCallback((assetId: string | undefined) => (assetId ? aspects.get(assetId) ?? null : null), [aspects]);
  const pageCount = document.pageIds.length;
  const pageIndex = document.pageIds.indexOf(activePageId);
  const assetArtwork = useMemo(() => assetArtworkLookup(assets), [assets]);
  const canvasContext = useMemo<ExpressionRenderContext>(() => ({
    assetArtwork,
    assetAspect,
    assetSource: (assetId) => (assetId ? assets[assetId]?.source ?? null : null),
    colors,
    fontFamily: defaultFontFamily,
    greetings: identity.greetings,
    idPrefix,
    measure,
    pageCount,
    pageIndex,
    products: identity.products,
    proof: identity.proof,
  }), [assetArtwork, assetAspect, assets, colors, idPrefix, identity.greetings, identity.products, identity.proof, measure, pageCount, pageIndex]);
  const deferredDocument = useDeferredValue(document);
  const thumbnailContexts = useMemo(() => new Map<string, ExpressionRenderContext>(), [canvasContext, deferredDocument.pageIds]);
  const thumbnailContext = useCallback((pageId: string) => {
    const cached = thumbnailContexts.get(pageId);
    if (cached) return cached;
    const context = { ...canvasContext, idPrefix: `${idPrefix}t${pageId.replace(/[^a-z0-9]/gi, '')}`, pageIndex: deferredDocument.pageIds.indexOf(pageId) };
    thumbnailContexts.set(pageId, context);
    return context;
  }, [canvasContext, deferredDocument.pageIds, idPrefix, thumbnailContexts]);

  // Source, autosave, and versions ------------------------------------------
  async function applySource(source: string) {
    const next = parseExpressionSource(source, kind, tool.id, identity);
    if (history.editedRef.current) commit(next, { label: gt('Apply source') });
    else history.reset(next);
    setSelection([]);
    setEditingId(null);
  }
  // Source serialization embeds every asset; run it after edits settle, not per keystroke.
  const settledDocument = useDebouncedValue(document, 180);
  const debouncedPortable = useMemo(() => withExpressionMirrors(settledDocument), [settledDocument]);
  const workspaceKey = useMemo(() => savedDesignStorageKey(identity.id, tool.id), [identity.id, tool.id]);
  const portable = usePortableCanvasWorkspace({ applySource, document: debouncedPortable, workspaceKey });
  // Keep the last serialized source readable while the next one embeds its assets,
  // so readSource() never disappears between an edit and its serialization.
  const lastSourceRef = useRef<string | null>(null);
  if (portable.source) lastSourceRef.current = portable.source;
  const readableSource = portable.source ?? lastSourceRef.current;

  // Editing -------------------------------------------------------------------
  const select = useCallback((ids: string[], additive = false) => {
    setEditingId(null);
    setSelection((current) => {
      if (!additive) return ids;
      const next = new Set(current);
      ids.forEach((id) => (next.has(id) ? next.delete(id) : next.add(id)));
      return [...next];
    });
  }, []);

  const onBounds = useCallback((id: string, bounds: CanvasBounds) => {
    const current = documentRef.current;
    const element = current.elements[id];
    if (!element) return;
    const members = selectionRef.current.length > 1 && selectionRef.current.includes(id) ? selectionRef.current : [id];
    const moved = element.bounds.width === bounds.width && element.bounds.height === bounds.height;
    if (members.length > 1 && moved) {
      const dx = bounds.x - element.bounds.x;
      const dy = bounds.y - element.bounds.y;
      commit((doc) => {
        const others = moveExpressionLayers(doc, members.filter((member) => member !== id), dx, dy);
        return { ...others, elements: { ...others.elements, [id]: { ...others.elements[id]!, bounds } }, revision: others.revision + 1 };
      }, { label: gt('Move selection') });
      return;
    }
    // Store the exact bounds object the layer committed so it keeps its transform anchor.
    commit((doc) => ({ ...doc, elements: { ...doc.elements, [id]: { ...doc.elements[id]!, bounds } }, revision: doc.revision + 1 }), {
      coalesce: `${id}:bounds:${moved ? 'move' : 'resize'}`,
      label: gt(moved ? 'Move {name}' : 'Resize {name}', { name: element.name }),
    });
  }, [commit, documentRef, gt]);

  const onEditText = useCallback((id: string, value: string) => {
    commit((doc) => (doc.elements[id] ? patchElement(doc, id, { content: value }) : doc), { coalesce: `${id}:content`, label: gt('Edit text') });
  }, [commit, gt]);

  const onMenu = useCallback((id: string, event: ReactMouseEvent<HTMLDivElement>) => {
    const ids = selectionRef.current.includes(id) ? selectionRef.current : [id];
    if (!selectionRef.current.includes(id)) setSelection([id]);
    setMenu({ ids, position: contextMenuPositionFromEvent(event) });
  }, []);

  const deselect = useCallback(() => {
    setSelection([]);
    setEditingId(null);
  }, []);
  const layerHandlers = useMemo(() => ({
    onBounds,
    onDeselect: deselect,
    onEditEnd: () => setEditingId(null),
    onEditStart: (id: string) => { setSelection([id]); setEditingId(id); },
    onEditText,
    onMenu,
    onSelect: (id: string, additive: boolean) => select([id], additive),
  }), [deselect, onBounds, onEditText, onMenu, select]);

  const duplicate = useCallback((ids: string[]) => {
    let created: string[] = [];
    commit((doc) => {
      const result = duplicateElements(doc, ids);
      created = result.ids;
      return result.document;
    }, { label: gt('Duplicate') });
    setSelection(created);
    return created;
  }, [commit, gt]);
  const remove = useCallback((ids: string[]) => {
    commit((doc) => removeElements(doc, ids), { label: gt('Delete') });
    setSelection([]);
    setEditingId(null);
  }, [commit, gt]);
  const reorder = useCallback((id: string, target: StackTarget) => {
    commit((doc) => reorderElement(doc, id, target), { label: gt('Arrange') });
  }, [commit, gt]);
  const addLayer = useCallback((input: AddLayerInput, pageId = activePageRef.current) => {
    let id = '';
    commit((doc) => {
      const result = addExpressionLayer(doc, pageId, input, identity);
      id = result.id;
      return result.document;
    }, { label: gt('Add {kind}', { kind: input.kind }) });
    setActivePageId(pageId);
    setSelection([id]);
    return id;
  }, [commit, gt, identity]);
  const resetTemplate = useCallback(() => {
    const format = resolveExpressionFormat(kind, expressionState(documentRef.current).format);
    commit(createExpressionDocument(kind, identity, { format, toolId: tool.id }), { label: gt('Reset to brand template') });
    setSelection([]);
  }, [commit, documentRef, gt, identity, kind, tool.id]);

  const panelApi = useMemo<LayersPanelApi>(() => ({
    addLayer: (layer) => { addLayer({ kind: layer }); },
    addSlide: (layout) => {
      let pageId = '';
      commit((doc) => {
        const result = newSlidePage(doc, identity, layout, doc.pageIds.indexOf(activePageRef.current) + 1);
        pageId = result.pageId;
        return result.document;
      }, { label: gt('Add slide') });
      setActivePageId(pageId);
      setSelection([]);
    },
    duplicateSlide: (pageId) => {
      let next = '';
      commit((doc) => {
        const result = duplicatePage(doc, pageId);
        next = result.pageId;
        return result.document;
      }, { label: gt('Duplicate slide') });
      setActivePageId(next);
    },
    moveLayer: (id, index) => reorder(id, index),
    moveSlide: (pageId, index) => commit((doc) => movePage(doc, pageId, index), { label: gt('Move slide') }),
    removeSlide: (pageId) => commit((doc) => removePage(doc, pageId), { label: gt('Delete slide') }),
    select: (ids, additive) => select(ids, additive),
    selectPage: (pageId) => { setActivePageId(pageId); setSelection([]); setEditingId(null); },
    setHidden: (id, hidden) => commit((doc) => patchElement(doc, id, { hidden }), { label: gt(hidden ? 'Hide layer' : 'Show layer') }),
    setLocked: (id, locked) => commit((doc) => patchElement(doc, id, { locked }), { label: gt(locked ? 'Lock layer' : 'Unlock layer') }),
    uploadImage: (file) => {
      void readFileAsAsset(file).then(({ name, url }) => addLayer({ dataUrl: url, fileName: name, kind: 'image' }));
    },
  }), [addLayer, commit, gt, identity, reorder, select]);

  function handleCanvasKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (isCanvasTextEditingTarget(event.target)) return;
    const ids = selectionRef.current;
    const single = ids.length === 1 ? ids[0]! : null;
    const meta = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const orderTarget = meta ? layerOrderShortcut(event) : null;
    const shortcuts: Array<[boolean, () => void]> = [
      [(event.key === 'Delete' || event.key === 'Backspace') && ids.length > 0, () => remove(ids)],
      [meta && key === 'd' && ids.length > 0, () => { duplicate(ids); }],
      [meta && key === 'a', () => setSelection(documentRef.current.pages[activePageRef.current]!.elementIds.filter((id) => !documentRef.current.elements[id]?.locked))],
      [orderTarget !== null && single !== null, () => reorder(single!, orderTarget!)],
      [event.key === 'Enter' && single !== null && documentRef.current.elements[single]?.kind === 'text', () => setEditingId(single)],
      [event.key === 'Escape', deselect],
    ];
    const match = shortcuts.find(([active]) => active);
    if (!match) return;
    event.preventDefault();
    match[1]();
  }

  // Export --------------------------------------------------------------------
  const exportBase = useCallback((current: CanvasDocument): ExportRenderBase => ({
    assetAspect,
    colors,
    greetings: identity.greetings,
    measure,
    pageCount: current.pageIds.length,
    products: identity.products,
    proof: identity.proof,
  }), [assetAspect, colors, identity.greetings, identity.products, identity.proof, measure]);

  async function exportPage(format: 'png' | 'svg', pageId = activePageRef.current): Promise<ExportPreviewAsset> {
    const current = documentRef.current;
    const page = current.pages[pageId];
    if (!page) throw new RangeError(`Unknown page ${pageId}.`);
    setExporting(true);
    studioExport.start(`Rendering ${format.toUpperCase()}`);
    try {
      await window.document.fonts?.ready;
      const svg = await buildPortableExpressionSvg(current, pageId, exportBase(current));
      const index = current.pageIds.indexOf(pageId);
      const suffix = kind === 'slides' && index > 0 ? `-${String(index + 1).padStart(2, '0')}` : '';
      let asset: ExportPreviewAsset;
      if (format === 'svg') {
        asset = { blob: new Blob([svg], { type: 'image/svg+xml' }), fileName: `studio-${kind}${suffix}.svg`, format: 'SVG', height: page.height, width: page.width };
      } else {
        const canvas = await rasterizeSvg(svg, page.width, page.height);
        const raster = resolveSvgRasterDimensions(page.width, page.height);
        asset = { blob: await canvasBlob(canvas), fileName: `studio-${kind}${suffix}.png`, format: 'PNG', height: raster.height, width: raster.width };
      }
      setLastExport(asset);
      return asset;
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  async function exportPdf(): Promise<ExportPreviewAsset> {
    const current = documentRef.current;
    setExporting(true);
    studioExport.start('Rendering PDF deck', 0);
    try {
      await window.document.fonts?.ready;
      const pages = [];
      for (const [index, pageId] of current.pageIds.entries()) {
        const page = current.pages[pageId]!;
        const svg = await buildPortableExpressionSvg(current, pageId, exportBase(current));
        const canvas = await rasterizeSvg(svg, page.width, page.height);
        pages.push(await canvasToPdfPage(canvas, page.width, page.height));
        studioExport.update((index + 1) / current.pageIds.length);
      }
      const bytes = buildPdf(pages, `${identity.name} ${tool.name}`);
      const asset: ExportPreviewAsset = {
        blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
        description: gt('{count} slides', { count: pages.length }),
        fileName: `studio-${kind}.pdf`,
        format: 'FILE',
        previewKind: 'file',
      };
      setLastExport(asset);
      return asset;
    } finally {
      setExporting(false);
      studioExport.finish();
    }
  }

  // Browser API -----------------------------------------------------------------
  function describeDocument() {
    const current = documentRef.current;
    const state = expressionState(current);
    return {
      activePageId: activePageRef.current,
      format: state.format,
      formats: expressionFormats(kind).map(({ height, id, label, width }) => ({ height, id, label, width })),
      layouts: expressionLayouts(kind),
      pages: describeExpressionDocument(current),
      selection: selectionRef.current,
    };
  }

  function setFormatAction(record: Record<string, unknown>) {
    const format = String(record.format ?? '');
    if (!expressionFormats(kind).some(({ id }) => id === format)) throw new RangeError(`format must be one of ${expressionFormats(kind).map(({ id }) => id).join(', ')}.`);
    commit((doc) => setExpressionFormat(doc, format, identity), { label: gt('Format') });
    return null;
  }

  function applyLayoutAction(record: Record<string, unknown>, pageId: string) {
    const layout = String(record.layout ?? '');
    if (!expressionLayouts(kind).some(({ id }) => id === layout)) throw new RangeError(`layout must be one of ${expressionLayouts(kind).map(({ id }) => id).join(', ')}.`);
    if (!documentRef.current.pages[pageId]) throw new RangeError(`Unknown page ${pageId}.`);
    commit((doc) => applyExpressionLayout(doc, pageId, layout, identity), { label: gt('Layout') });
    return null;
  }

  function addLayerAction(record: Record<string, unknown>, pageId: string) {
    if (!EXPRESSION_ADDABLE_LAYERS.includes(record.kind as AddLayerInput['kind'])) throw new TypeError(`kind must be one of ${EXPRESSION_ADDABLE_LAYERS.join(', ')}.`);
    return { id: addLayer(record as unknown as AddLayerInput, documentRef.current.pages[pageId] ? pageId : activePageRef.current) };
  }

  function selectLayersAction(input: unknown) {
    const current = documentRef.current;
    const ids = inputIds(input);
    const page = ids[0] ? elementPageId(current, ids[0]) : null;
    if (page) setActivePageId(page);
    setSelection(ids.filter((id) => current.elements[id]));
    return null;
  }

  function reorderLayerAction(record: Record<string, unknown>) {
    const id = String(record.id ?? '');
    const to = record.to;
    if (!documentRef.current.elements[id]) throw new RangeError(`Unknown layer ${id}.`);
    if (!(typeof to === 'number' || (typeof to === 'string' && STACK_TARGETS.has(to)))) throw new TypeError('to must be forward, backward, front, back, or an index.');
    reorder(id, to as StackTarget);
    return null;
  }

  function alignLayersAction(record: Record<string, unknown>, input: unknown) {
    const alignment = String(record.alignment ?? '');
    if (!ALIGNMENT_VALUES.has(alignment)) throw new TypeError('alignment must be left, horizontal-center, right, top, vertical-center, or bottom.');
    commit((doc) => alignExpressionLayers(doc, inputIds(input), alignment as ExpressionAlignment), { label: gt('Align') });
    return null;
  }

  async function invoke(action: string, input?: unknown): Promise<unknown> {
    const verb = action.startsWith(`${kind}.`) ? action.slice(kind.length + 1) : action;
    const record = inputRecord(input);
    const pageId = typeof record.pageId === 'string' ? record.pageId : activePageRef.current;
    const handlers: Record<string, () => unknown> = {
      'document.describe': describeDocument,
      'export.png': () => exportPage('png'),
      'export.svg': () => exportPage('svg'),
      'format.set': () => setFormatAction(record),
      'history.redo': history.redo,
      'history.undo': history.undo,
      'layer.add': () => addLayerAction(record, pageId),
      'layer.align': () => alignLayersAction(record, input),
      'layer.duplicate': () => ({ ids: duplicate(inputIds(input)) }),
      'layer.remove': () => { remove(inputIds(input)); return null; },
      'layer.reorder': () => reorderLayerAction(record),
      'layer.select': () => selectLayersAction(input),
      'layer.update': () => {
        commit((doc) => updateExpressionLayer(doc, String(record.id ?? ''), record as UpdateLayerInput, identity), { label: gt('Edit layer') });
        return null;
      },
      'layout.apply': () => applyLayoutAction(record, pageId),
      'template.reset': () => { resetTemplate(); return null; },
    };
    const handler = handlers[verb];
    if (handler) return handler();
    if (kind === 'slides' && verb === 'export.pdf') return exportPdf();
    if (kind === 'slides' && verb.startsWith('slide.')) return invokeSlide(verb, record);
    if (kind === 'terminal' && verb.startsWith('tab.')) return invokeTab(verb, record);
    if (kind === 'partnership' && (verb.startsWith('partner.') || verb === 'lockup.update')) return invokePartner(verb, record);
    throw new RangeError(`Unknown ${tool.name} action: ${action}.`);
  }

  function invokeSlide(verb: string, record: Record<string, unknown>): unknown {
    const current = documentRef.current;
    const pageId = typeof record.pageId === 'string' ? record.pageId : activePageRef.current;
    if (verb !== 'slide.add' && !current.pages[pageId]) throw new RangeError(`Unknown slide ${pageId}.`);
    if (verb === 'slide.add') {
      const layout = typeof record.layout === 'string' ? record.layout : 'statement';
      if (!expressionLayouts('slides').some(({ id }) => id === layout)) throw new RangeError('Unknown slide layout.');
      let created = '';
      commit((doc) => {
        const index = typeof record.index === 'number' ? record.index : doc.pageIds.indexOf(activePageRef.current) + 1;
        const result = newSlidePage(doc, identity, layout, index);
        created = result.pageId;
        return result.document;
      }, { label: gt('Add slide') });
      setActivePageId(created);
      return { pageId: created };
    }
    if (verb === 'slide.duplicate') {
      let created = '';
      commit((doc) => {
        const result = duplicatePage(doc, pageId);
        created = result.pageId;
        return result.document;
      }, { label: gt('Duplicate slide') });
      setActivePageId(created);
      return { pageId: created };
    }
    if (verb === 'slide.move') {
      if (typeof record.index !== 'number') throw new TypeError('index must be a number.');
      commit((doc) => movePage(doc, pageId, record.index as number), { label: gt('Move slide') });
      return null;
    }
    if (verb === 'slide.remove') { commit((doc) => removePage(doc, pageId), { label: gt('Delete slide') }); return null; }
    if (verb === 'slide.select') { setActivePageId(pageId); setSelection([]); return null; }
    throw new RangeError(`Unknown slide action: ${verb}.`);
  }

  function codeElementId(): string {
    const current = documentRef.current;
    const code = current.pages[activePageRef.current]!.elementIds.find((id) => current.elements[id] && elementComponent(current.elements[id]!) === 'code');
    if (!code) throw new RangeError('This page has no code window.');
    return code;
  }

  function invokeTab(verb: string, record: Record<string, unknown>): unknown {
    const codeId = codeElementId();
    const tabId = String(record.tabId ?? '');
    if (verb === 'tab.add') {
      let created = '';
      commit((doc) => {
        const result = addCodeTab(doc, codeId, {
          code: typeof record.code === 'string' ? record.code : undefined,
          language: typeof record.language === 'string' ? record.language : undefined,
          name: typeof record.name === 'string' ? record.name : undefined,
        });
        created = result.tabId;
        return result.document;
      }, { label: gt('Add tab') });
      return { tabId: created };
    }
    if (verb === 'tab.remove') { commit((doc) => removeCodeTab(doc, codeId, tabId), { label: gt('Remove tab') }); return null; }
    if (verb === 'tab.select') { commit((doc) => updateExpressionLayer(doc, codeId, { data: { activeTab: tabId } }, identity), { label: gt('Show tab') }); return null; }
    if (verb === 'tab.update') {
      const patch = {
        ...(typeof record.code === 'string' ? { code: record.code } : {}),
        ...(Array.isArray(record.highlight) ? { highlight: record.highlight.filter((line): line is number => Number.isInteger(line) && (line as number) > 0) } : {}),
        ...(typeof record.language === 'string' ? { language: record.language } : {}),
        ...(typeof record.name === 'string' ? { name: record.name } : {}),
      };
      commit((doc) => setCodeTab(doc, codeId, tabId, patch), { label: gt('Edit tab') });
      return null;
    }
    throw new RangeError(`Unknown tab action: ${verb}.`);
  }

  function invokePartner(verb: string, record: Record<string, unknown>): unknown {
    const current = documentRef.current;
    const lockupId = current.pages[activePageRef.current]!.elementIds.find((id) => current.elements[id] && elementComponent(current.elements[id]!) === 'lockup');
    if (!lockupId) throw new RangeError('This page has no partner lockup.');
    if (verb === 'partner.add') {
      let created = '';
      commit((doc) => {
        const result = addLockupPartner(doc, lockupId, identity, {
          kind: record.kind === 'text' ? 'text' : 'logo',
          label: typeof record.label === 'string' ? record.label : undefined,
          partnerId: typeof record.partnerId === 'string' ? record.partnerId : undefined,
        });
        created = result.id;
        return result.document;
      }, { label: gt('Add partner') });
      return { id: created };
    }
    if (verb === 'partner.remove') { commit((doc) => removeLockupPartner(doc, lockupId, String(record.id ?? '')), { label: gt('Remove partner') }); return null; }
    commit((doc) => updateLockup(doc, lockupId, record, identity), { label: gt('Lockup') });
    return null;
  }

  // Layout ----------------------------------------------------------------------
  const inspectorActions = useMemo(() => ({ duplicate, remove, reorder }), [duplicate, remove, reorder]);
  const inspector = (
    <>
      <ExpressionContentSections activePageId={activePageId} commit={commit} document={document} identity={identity} kind={kind} onResetTemplate={resetTemplate} />
      <SelectionInspector actions={inspectorActions} commit={commit} document={document} identity={identity} selection={selection} />
      <CanvasSection activePageId={activePageId} commit={commit} document={document} identity={identity} kind={kind} onResetTemplate={resetTemplate} />
    </>
  );
  const library = (
    <ExpressionLayersPanel activePageId={activePageId} api={panelApi} document={deferredDocument.pages[activePageId] ? deferredDocument : document} kind={kind} selection={selection} thumbnailContext={thumbnailContext} />
  );
  const menuIds = menu?.ids.filter((id) => document.elements[id]) ?? [];

  return (
    <ToolShell
      actions={(
        <>
          <ExportPreview asset={lastExport} />
          <StudioActionMenu
            disabled={exporting || !portable.document}
            icon={<FileDown aria-hidden='true' />}
            label={gt('More exports')}
            sections={[{
              items: [
                { description: gt('Self-contained vector with embedded fonts and images'), icon: <FileDown aria-hidden='true' />, id: 'svg', label: gt('Export SVG'), onSelect: () => void exportPage('svg') },
                ...(kind === 'slides' ? [{ description: gt('Every slide in one PDF'), icon: <FileDown aria-hidden='true' />, id: 'pdf', label: gt('Export PDF deck'), onSelect: () => void exportPdf() }] : []),
              ],
            }]}
          />
          <Button disabled={exporting || !portable.document} onClick={() => void exportPage('png')} type='button'>
            <Download aria-hidden='true' />
            <T>Export PNG</T>
          </Button>
        </>
      )}
      automation={{ actions: studioToolActionNames(tool.id), invoke }}
      inspector={inspector}
      library={library}
      sourceCode={{ format: 'JSON', onApply: applySource, source: readableSource, title: gt(`${tool.name} source`) }}
      tool={tool}
      versions={(
        <DesignVersionControls
          autosaveState={portable.autosaveState}
          identityId={identity.id}
          onOpen={applySource}
          revision={String(debouncedPortable.revision)}
          source={() => readableSource}
          toolId={tool.id}
          workspaceLabel={tool.name}
        />
      )}
    >
      <div className='contents' onKeyDown={handleCanvasKeyDown}>
        <CanvasViewport
          actionHistory={{
            canRedo: history.canRedo,
            canUndo: history.canUndo,
            entries: history.entries,
            onRedo: () => { history.redo(); },
            onUndo: () => { history.undo(); },
          }}
          identityId={identity.id}
          onDeselect={deselect}
          stageClassName={STUDIO_ARTIFACT_STAGE_CLASS}
          toolId={tool.id}
        >
          <ExpressionCanvas
            ariaLabel={gt(`${tool.name} canvas`)}
            context={canvasContext}
            document={document}
            editingId={editingId}
            handlers={layerHandlers}
            pageId={activePageId}
            selection={selection}
          />
        </CanvasViewport>
      </div>
      {menu && menuIds.length > 0 ? (
        <CanvasSelectionMenu
          canGroup={false}
          canUngroup={false}
          count={menuIds.length}
          onAlign={(alignment) => commit((doc) => alignExpressionLayers(doc, menuIds, alignment), { label: gt('Align') })}
          onBringForward={() => menuIds.forEach((id) => reorder(id, 'forward'))}
          onBringToFront={() => menuIds.forEach((id) => reorder(id, 'front'))}
          onClose={() => setMenu(null)}
          onDelete={() => { remove(menuIds); setMenu(null); }}
          onDuplicate={() => { duplicate(menuIds); setMenu(null); }}
          onGroup={() => undefined}
          onSendBackward={() => menuIds.forEach((id) => reorder(id, 'backward'))}
          onSendToBack={() => menuIds.forEach((id) => reorder(id, 'back'))}
          onToggleVisibility={() => commit((doc) => menuIds.reduce((next, id) => patchElement(next, id, { hidden: !next.elements[id]!.hidden }), doc), { label: gt('Visibility') })}
          onUngroup={() => undefined}
          position={menu.position}
          selectionVisible={menuIds.every((id) => !document.elements[id]?.hidden)}
        />
      ) : null}
    </ToolShell>
  );
}
