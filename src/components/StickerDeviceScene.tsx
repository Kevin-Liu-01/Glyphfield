'use client';

import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import type { BrandIdentity } from '@/lib/brandIdentity';
import {
  clampStickerPosition,
  stickerSceneAssets,
  stickerSceneContrastColor,
  stickerSceneContrastRadius,
  stickerSceneOutlineRadius,
  type StickerSceneAsset,
  type StickerScenePlacement,
} from '@/lib/stickerScene';
import { STICKER_FINISH_PRESETS, type StickerFinishSettings } from '@/lib/surfaceSticker';

type DragState = {
  id: string;
  moved: boolean;
  pointerId: number;
  startX: number;
  startY: number;
};

export type StickerSelection = StickerScenePlacement & {
  label: string;
};

export type StickerRenderLayer = StickerSelection & {
  path: string;
};

export type StickerStudioStageHandle = {
  addSticker: (assetId: string) => void;
  bringSelectedForward: () => void;
  duplicateSelected: () => void;
  exportPng: (size?: number, background?: CanvasImageSource) => Promise<Blob | null>;
  removeSelected: () => void;
  reset: () => void;
  updateSelected: (patch: Partial<Pick<StickerScenePlacement, 'rotation' | 'scale' | 'x' | 'y'>>) => void;
};

function finishSwatch(finish: StickerFinishSettings): string {
  return STICKER_FINISH_PRESETS.find(({ id }) => id === finish.presetId)?.swatch
    ?? STICKER_FINISH_PRESETS[0].swatch;
}

function starterPlacement(asset: StickerSceneAsset | undefined): StickerScenePlacement[] {
  return asset ? [{ assetId: asset.id, id: `starter-${asset.id}`, rotation: -4, scale: 31, x: 50, y: 50, z: 1 }] : [];
}

function loadSceneImage(path: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (/^https?:/i.test(path)) image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = path;
  });
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function exportFinishPalette(finish: StickerFinishSettings): string[] {
  if (finish.presetId === 'embossed-foil') return ['#5E441E', '#F6DC91', '#9D772E', '#FFF0B1', '#60451F'];
  if (finish.presetId === 'epoxy-dome') return ['#DDF1FF', '#98B9D4', '#263F5C', '#EAF7FF'];
  if (['mirror-chrome', 'brushed-metal', 'precision-metal-inset'].includes(finish.presetId)) {
    return ['#25272B', '#F9FAFB', '#777D86', '#FFFFFF', '#34373C', '#DFE3E8'];
  }
  if (['clear-frost', 'soft-touch', 'spot-gloss'].includes(finish.presetId)) {
    return ['#F7FAFC', '#AAB3BC', '#FFFFFF', '#66707A'];
  }
  const hue = finish.hueShift * 3.6;
  return [0, 58, 118, 188, 258, 324, 360].map((offset) => `hsl(${hue + offset} 88% 76%)`);
}

function buildExportStickerLayers(image: HTMLImageElement, finish: StickerFinishSettings) {
  const sourceWidth = Math.max(1, image.naturalWidth);
  const sourceHeight = Math.max(1, image.naturalHeight);
  const scale = Math.min(1, 1400 / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const artwork = document.createElement('canvas');
  const keyline = document.createElement('canvas');
  const outline = document.createElement('canvas');
  artwork.width = keyline.width = outline.width = width;
  artwork.height = keyline.height = outline.height = height;
  const artworkContext = artwork.getContext('2d');
  const keylineContext = keyline.getContext('2d');
  const outlineContext = outline.getContext('2d');
  if (!artworkContext || !keylineContext || !outlineContext) return { artwork, keyline, outline };

  artworkContext.drawImage(image, 0, 0, width, height);
  artworkContext.globalCompositeOperation = 'source-atop';
  const angle = finish.glintAngle * Math.PI / 180;
  const halfSpan = Math.abs(Math.cos(angle)) * width / 2 + Math.abs(Math.sin(angle)) * height / 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const optical = artworkContext.createLinearGradient(
    centerX - Math.cos(angle) * halfSpan,
    centerY - Math.sin(angle) * halfSpan,
    centerX + Math.cos(angle) * halfSpan,
    centerY + Math.sin(angle) * halfSpan
  );
  const colors = exportFinishPalette(finish);
  colors.forEach((color, index) => optical.addColorStop(index / Math.max(1, colors.length - 1), color));
  artworkContext.globalAlpha = Math.min(0.72, Math.max(0.06, finish.intensity / 135));
  artworkContext.fillStyle = optical;
  artworkContext.fillRect(0, 0, width, height);
  const glint = artworkContext.createLinearGradient(0, height, width, 0);
  glint.addColorStop(0.38, 'rgba(255,255,255,0)');
  glint.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  glint.addColorStop(0.62, 'rgba(255,255,255,0)');
  artworkContext.globalAlpha = finish.intensity / 180;
  artworkContext.fillStyle = glint;
  artworkContext.fillRect(0, 0, width, height);
  artworkContext.globalAlpha = 1;
  artworkContext.globalCompositeOperation = 'source-over';

  outlineContext.drawImage(image, 0, 0, width, height);
  outlineContext.globalCompositeOperation = 'source-in';
  outlineContext.fillStyle = finish.borderColor;
  outlineContext.fillRect(0, 0, width, height);
  outlineContext.globalCompositeOperation = 'source-over';
  keylineContext.drawImage(image, 0, 0, width, height);
  keylineContext.globalCompositeOperation = 'source-in';
  keylineContext.fillStyle = stickerSceneContrastColor(finish.borderColor);
  keylineContext.fillRect(0, 0, width, height);
  keylineContext.globalCompositeOperation = 'source-over';
  return { artwork, keyline, outline };
}

const StickerDeviceScene = forwardRef<StickerStudioStageHandle, {
  aspectRatio?: number;
  className?: string;
  enabled?: boolean;
  finish: StickerFinishSettings;
  identity: BrandIdentity;
  logoPath?: string;
  onPlacementsChange?: (placements: StickerRenderLayer[]) => void;
  onSelectionChange?: (selection: StickerSelection | null) => void;
  renderMode?: 'controls' | 'normal';
  surface?: 'metal' | 'transparent';
}>(function StickerDeviceScene({ aspectRatio = 872 / 504, className = '', enabled = true, finish, identity, logoPath, onPlacementsChange, onSelectionChange, renderMode = 'normal', surface = 'metal' }, ref) {
  const assets = useMemo(() => {
    const libraryAssets = stickerSceneAssets(identity, logoPath);
    const primary = logoPath
      ? [{ id: 'current-artwork', label: `${identity.name} current artwork`, path: logoPath, surface: 'dark' as const, type: 'logo' as const }]
      : [];
    return [...primary, ...libraryAssets].filter((asset, index, collection) => (
      collection.findIndex(({ path }) => path === asset.path) === index
    ));
  }, [identity, logoPath]);
  const assetKey = assets.map(({ id, path }) => `${id}:${path}`).join('|');
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const [placements, setPlacements] = useState<StickerScenePlacement[]>(() => starterPlacement(assets[0]));
  const [selectedId, setSelectedId] = useState<string | null>(() => starterPlacement(assets[0])[0]?.id ?? null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const outlineFilterId = `sticker-outline-${useId().replaceAll(':', '')}`;
  const outlineRadius = stickerSceneOutlineRadius(finish.edgeWidth);
  const contrastColor = stickerSceneContrastColor(finish.borderColor);
  const contrastRadius = stickerSceneContrastRadius(finish.seamWidth, finish.edgeWidth);
  const surfaceRef = useRef<HTMLElement>(null);
  const serialRef = useRef(1);
  const dragRef = useRef<DragState | null>(null);
  const lastDraggedRef = useRef<string | null>(null);

  useEffect(() => {
    setPlacements((current) => {
      const retained = current.filter(({ assetId }) => assetMap.has(assetId));
      return retained.length > 0 ? retained : starterPlacement(assets[0]);
    });
  }, [assetKey, assetMap, assets]);

  useEffect(() => {
    if (!enabled) {
      onSelectionChange?.(null);
      return;
    }
    const placement = placements.find(({ id }) => id === selectedId);
    const asset = placement ? assetMap.get(placement.assetId) : undefined;
    onSelectionChange?.(placement && asset ? { ...placement, label: asset.label } : null);
  }, [assetMap, enabled, onSelectionChange, placements, selectedId]);

  useEffect(() => {
    if (!enabled) {
      onPlacementsChange?.([]);
      return;
    }
    onPlacementsChange?.(
      placements
        .map((placement) => {
          const asset = assetMap.get(placement.assetId);
          return asset ? { ...placement, label: asset.label, path: asset.path } : null;
        })
        .filter((placement): placement is StickerRenderLayer => placement !== null)
        .sort((left, right) => left.z - right.z)
    );
  }, [assetMap, enabled, onPlacementsChange, placements]);

  function resetScene() {
    const next = starterPlacement(assets[0]);
    setPlacements(next);
    setSelectedId(next[0]?.id ?? null);
    serialRef.current = 1;
  }

  function addSticker(assetId: string) {
    const asset = assetMap.get(assetId);
    if (!asset) return;
    const serial = serialRef.current;
    serialRef.current += 1;
    const id = `placed-${serial}-${assetId}`;
    setPlacements((current) => {
      if (current.length >= 40) return current;
      const nextZ = current.reduce((largest, placement) => Math.max(largest, placement.z), 0) + 1;
      const offset = ((serial - 1) % 5) * 2.5;
      return [...current, { assetId, id, rotation: 0, scale: 24, x: 50 + offset, y: 50 + offset, z: nextZ }];
    });
    setSelectedId(id);
  }

  function removeSticker(id: string) {
    setPlacements((current) => current.filter((placement) => placement.id !== id));
    setSelectedId((current) => current === id ? null : current);
  }

  function updatePlacement(id: string, patch: Partial<Pick<StickerScenePlacement, 'rotation' | 'scale' | 'x' | 'y'>>) {
    setPlacements((current) => current.map((placement) => {
      if (placement.id !== id) return placement;
      const position = clampStickerPosition(patch.x ?? placement.x, patch.y ?? placement.y);
      return {
        ...placement,
        ...patch,
        ...position,
        rotation: Math.max(-180, Math.min(180, patch.rotation ?? placement.rotation)),
        scale: Math.max(8, Math.min(54, patch.scale ?? placement.scale)),
      };
    }));
  }

  function bringForward(id: string) {
    setPlacements((current) => {
      const nextZ = current.reduce((largest, placement) => Math.max(largest, placement.z), 0) + 1;
      return current.map((placement) => placement.id === id ? { ...placement, z: nextZ } : placement);
    });
  }

  function duplicateSelected() {
    const selected = placements.find(({ id }) => id === selectedId);
    if (!selected) return;
    const serial = serialRef.current;
    serialRef.current += 1;
    const id = `duplicate-${serial}-${selected.assetId}`;
    const nextZ = placements.reduce((largest, placement) => Math.max(largest, placement.z), 0) + 1;
    const position = clampStickerPosition(selected.x + 4, selected.y + 4);
    setPlacements((current) => [...current, {
      ...selected,
      id,
      ...position,
      z: nextZ,
    }]);
    setSelectedId(id);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>, placement: StickerScenePlacement) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: placement.id,
      moved: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setSelectedId(placement.id);
    setDraggingId(placement.id);
    bringForward(placement.id);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !surface) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) drag.moved = true;
    if (!drag.moved) return;
    const bounds = surface.getBoundingClientRect();
    updatePlacement(drag.id, {
      x: ((event.clientX - bounds.left) / bounds.width) * 100,
      y: ((event.clientY - bounds.top) / bounds.height) * 100,
    });
  }

  function finishPointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) lastDraggedRef.current = drag.id;
    dragRef.current = null;
    setDraggingId(null);
  }

  function handlePlacedClick(id: string) {
    if (lastDraggedRef.current === id) lastDraggedRef.current = null;
    setSelectedId(id);
  }

  function handlePlacedKeyDown(event: KeyboardEvent<HTMLButtonElement>, placement: StickerScenePlacement) {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      removeSticker(placement.id);
      return;
    }
    const offset = event.shiftKey ? 5 : 1;
    const direction = {
      ArrowDown: [0, offset],
      ArrowLeft: [-offset, 0],
      ArrowRight: [offset, 0],
      ArrowUp: [0, -offset],
    }[event.key];
    if (!direction) return;
    event.preventDefault();
    updatePlacement(placement.id, { x: placement.x + direction[0], y: placement.y + direction[1] });
  }

  async function exportScene(size = 1800, background?: CanvasImageSource): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = Math.round(size / Math.max(0.25, aspectRatio));
    const context = canvas.getContext('2d');
    if (!context) return null;
    if (background) {
      context.drawImage(background, 0, 0, canvas.width, canvas.height);
    } else if (surface === 'metal') {
      const metal = context.createLinearGradient(0, 0, canvas.width, canvas.height);
      metal.addColorStop(0, '#cbd0d4');
      metal.addColorStop(0.42, '#8f969c');
      metal.addColorStop(0.7, '#d9dde0');
      metal.addColorStop(1, '#747b81');
      context.fillStyle = metal;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    for (const placement of [...placements].sort((left, right) => left.z - right.z)) {
      const asset = assetMap.get(placement.assetId);
      if (!asset) continue;
      try {
        const image = await loadSceneImage(asset.path);
        const boxWidth = canvas.width * placement.scale / 100;
        const boxHeight = boxWidth / 1.24;
        const scale = Math.min(boxWidth / image.naturalWidth, boxHeight / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        const layers = buildExportStickerLayers(image, finish);
        const edge = Math.max(2, finish.edgeWidth * size / 1800);
        const keyline = Math.max(1, finish.seamWidth * size / 2400);
        context.save();
        context.translate(canvas.width * placement.x / 100, canvas.height * placement.y / 100);
        context.rotate(placement.rotation * Math.PI / 180);
        context.shadowColor = `rgba(0,0,0,${Math.min(0.42, finish.shadow / 180)})`;
        context.shadowBlur = Math.max(2, finish.shadow * size / 3600);
        context.shadowOffsetY = Math.max(2, finish.depth * size / 9000);
        for (let index = 0; index < 16; index += 1) {
          const edgeAngle = index / 16 * Math.PI * 2;
          context.drawImage(
            layers.outline,
            -width / 2 + Math.cos(edgeAngle) * edge,
            -height / 2 + Math.sin(edgeAngle) * edge,
            width,
            height
          );
        }
        context.shadowBlur = 0;
        context.shadowOffsetY = 0;
        for (let index = 0; index < 12; index += 1) {
          const keylineAngle = index / 12 * Math.PI * 2;
          context.drawImage(
            layers.keyline,
            -width / 2 + Math.cos(keylineAngle) * keyline,
            -height / 2 + Math.sin(keylineAngle) * keyline,
            width,
            height
          );
        }
        context.drawImage(layers.artwork, -width / 2, -height / 2, width, height);
        context.restore();
      } catch {
        // Keep the remaining placed assets exportable if one source is unavailable.
      }
    }
    return canvasBlob(canvas);
  }

  useImperativeHandle(ref, () => ({
    addSticker,
    bringSelectedForward: () => { if (selectedId) bringForward(selectedId); },
    duplicateSelected,
    exportPng: exportScene,
    removeSelected: () => { if (selectedId) removeSticker(selectedId); },
    reset: resetScene,
    updateSelected: (patch) => { if (selectedId) updatePlacement(selectedId, patch); },
  }));

  const sceneStyle = {
    '--sticker-border': finish.borderColor,
    '--sticker-depth': `${Math.round(5 + finish.depth * 0.1)}px`,
    '--sticker-finish': finishSwatch(finish),
    '--sticker-finish-opacity': Math.max(0.08, finish.intensity / 125),
    '--sticker-shine-x': '50%',
    '--sticker-shine-y': '30%',
  } as CSSProperties;

  return (
    <section
      aria-label={`${identity.name} sticker placement surface`}
      aria-hidden={!enabled}
      className={`sticker-maker-surface ${className}`}
      data-enabled={enabled ? 'true' : 'false'}
      data-render-mode={renderMode}
      data-sticker-maker-surface='true'
      data-surface={surface}
      inert={enabled ? undefined : true}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) setSelectedId(null);
      }}
      onPointerLeave={() => {
        surfaceRef.current?.style.setProperty('--sticker-shine-x', '50%');
        surfaceRef.current?.style.setProperty('--sticker-shine-y', '30%');
      }}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        event.currentTarget.style.setProperty('--sticker-shine-x', `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
        event.currentTarget.style.setProperty('--sticker-shine-y', `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
      }}
      ref={surfaceRef}
      style={{ ...sceneStyle, aspectRatio }}
    >
      <svg aria-hidden='true' className='pointer-events-none absolute size-0' focusable='false'>
        <defs>
          <filter colorInterpolationFilters='sRGB' height='180%' id={outlineFilterId} width='180%' x='-40%' y='-40%'>
            <feMorphology in='SourceAlpha' operator='dilate' radius={outlineRadius} result='sticker-outline-alpha' />
            <feFlood floodColor={finish.borderColor} result='sticker-outline-color' />
            <feComposite in='sticker-outline-color' in2='sticker-outline-alpha' operator='in' result='sticker-outline-fill' />
            <feMorphology in='SourceAlpha' operator='dilate' radius={contrastRadius} result='sticker-keyline-alpha' />
            <feFlood floodColor={contrastColor} result='sticker-keyline-color' />
            <feComposite in='sticker-keyline-color' in2='sticker-keyline-alpha' operator='in' result='sticker-keyline-fill' />
            <feMerge><feMergeNode in='sticker-outline-fill' /><feMergeNode in='sticker-keyline-fill' /><feMergeNode in='SourceGraphic' /></feMerge>
          </filter>
        </defs>
      </svg>
      {surface === 'metal' ? <span aria-hidden='true' className='sticker-maker-metal' /> : null}
      {surface === 'metal' ? <span aria-hidden='true' className='sticker-maker-metal-light' /> : null}
      {placements.map((placement) => {
        const asset = assetMap.get(placement.assetId);
        if (!asset) return null;
        const maskImage = `url("${asset.path.replaceAll('"', '%22')}")`;
        return (
          <button
            aria-label={`${asset.label} sticker. Drag to move; use arrow keys to nudge; Delete removes.`}
            aria-pressed={selectedId === placement.id}
            className={`sticker-maker-sticker ${draggingId === placement.id ? 'is-dragging' : ''} ${selectedId === placement.id ? 'is-selected' : ''}`}
            key={placement.id}
            onClick={() => handlePlacedClick(placement.id)}
            onKeyDown={(event) => handlePlacedKeyDown(event, placement)}
            onPointerCancel={finishPointerDrag}
            onPointerDown={(event) => handlePointerDown(event, placement)}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerDrag}
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
              transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
              width: `${placement.scale}%`,
              zIndex: placement.z + 2,
            }}
            type='button'
          >
            <img alt='' draggable={false} src={asset.path} style={{ filter: `url("#${outlineFilterId}")` }} />
            <span aria-hidden='true' className='sticker-maker-optical' style={{ maskImage, WebkitMaskImage: maskImage }} />
          </button>
        );
      })}
      <p aria-live='polite' className='sr-only'>{placements.length} stickers placed</p>
    </section>
  );
});

export default StickerDeviceScene;
