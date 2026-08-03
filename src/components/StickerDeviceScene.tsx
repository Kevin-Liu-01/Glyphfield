'use client';

import { RotateCcw } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';

import OpenStickerShaderStage from '@/components/OpenStickerShaderStage';
import type { BackgroundSettings } from '@/lib/backgroundSvg';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { clampStickerPosition, nextStickerPlacement, seedStickerScene, stickerSceneAssets, stickerSceneOutlineRadius, type StickerScenePlacement } from '@/lib/stickerScene';
import { STICKER_FINISH_PRESETS, type StickerFinishSettings } from '@/lib/surfaceSticker';

type DragState = {
  id: string;
  moved: boolean;
  pointerId: number;
  startX: number;
  startY: number;
};

function finishSwatch(finish: StickerFinishSettings): string {
  return STICKER_FINISH_PRESETS.find(({ id }) => id === finish.presetId)?.swatch
    ?? STICKER_FINISH_PRESETS[0].swatch;
}

export default function StickerDeviceScene({
  artworkSvg,
  finish,
  identity,
  logoPath,
  settings,
}: {
  artworkSvg: string;
  finish: StickerFinishSettings;
  identity: BrandIdentity;
  logoPath?: string;
  settings: BackgroundSettings;
}) {
  const assets = useMemo(() => stickerSceneAssets(identity, logoPath), [identity, logoPath]);
  const assetKey = assets.map(({ id, path }) => `${id}:${path}`).join('|');
  const assetMap = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const [placements, setPlacements] = useState<StickerScenePlacement[]>(() => seedStickerScene(assets));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const outlineFilterId = `sticker-outline-${useId().replaceAll(':', '')}`;
  const outlineRadius = stickerSceneOutlineRadius(finish.edgeWidth);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const serialRef = useRef(assets.length);
  const dragRef = useRef<DragState | null>(null);
  const lastDraggedRef = useRef<string | null>(null);

  useEffect(() => {
    setPlacements(seedStickerScene(assets));
    serialRef.current = assets.length;
  }, [assetKey]);

  function resetScene() {
    setPlacements(seedStickerScene(assets));
    serialRef.current = assets.length;
  }

  function addSticker(assetId: string) {
    setPlacements((current) => {
      if (current.length >= 40) return current;
      const serial = serialRef.current;
      serialRef.current += 1;
      const nextZ = current.reduce((largest, placement) => Math.max(largest, placement.z), 0) + 1;
      return [...current, nextStickerPlacement(assetId, serial, nextZ)];
    });
  }

  function removeSticker(id: string) {
    setPlacements((current) => current.filter((placement) => placement.id !== id));
  }

  function moveSticker(id: string, x: number, y: number) {
    const next = clampStickerPosition(x, y);
    setPlacements((current) => current.map((placement) => placement.id === id ? { ...placement, ...next } : placement));
  }

  function bringStickerForward(id: string) {
    setPlacements((current) => {
      const nextZ = current.reduce((largest, placement) => Math.max(largest, placement.z), 0) + 1;
      return current.map((placement) => placement.id === id ? { ...placement, z: nextZ } : placement);
    });
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
    setDraggingId(placement.id);
    bringStickerForward(placement.id);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !surface) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) drag.moved = true;
    if (!drag.moved) return;
    const bounds = surface.getBoundingClientRect();
    moveSticker(
      drag.id,
      ((event.clientX - bounds.left) / bounds.width) * 100,
      ((event.clientY - bounds.top) / bounds.height) * 100
    );
  }

  function finishPointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) lastDraggedRef.current = drag.id;
    dragRef.current = null;
    setDraggingId(null);
  }

  function handlePlacedClick(id: string) {
    if (lastDraggedRef.current === id) {
      lastDraggedRef.current = null;
      return;
    }
    removeSticker(id);
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
    moveSticker(placement.id, placement.x + direction[0], placement.y + direction[1]);
  }

  const sceneStyle = {
    '--sticker-accent-a': settings.colorA,
    '--sticker-accent-b': settings.colorB,
    '--sticker-depth': `${Math.round(6 + finish.depth * 0.12)}px`,
    '--sticker-finish': finishSwatch(finish),
    '--sticker-finish-opacity': Math.max(0.08, finish.intensity / 140),
  } as CSSProperties;

  return (
    <section
      aria-label={`${identity.name} stickers on a laptop lid`}
      className='sticker-device-scene artifact-frame relative isolate overflow-hidden'
      data-sticker-device-scene='true'
      style={sceneStyle}
    >
      <svg aria-hidden='true' className='pointer-events-none absolute size-0' focusable='false'>
        <defs>
          <filter
            colorInterpolationFilters='sRGB'
            height='180%'
            id={outlineFilterId}
            width='180%'
            x='-40%'
            y='-40%'
          >
            <feMorphology in='SourceAlpha' operator='dilate' radius={outlineRadius} result='sticker-outline-alpha' />
            <feFlood floodColor={finish.borderColor} result='sticker-outline-color' />
            <feComposite in='sticker-outline-color' in2='sticker-outline-alpha' operator='in' result='sticker-outline-fill' />
            <feMerge>
              <feMergeNode in='sticker-outline-fill' />
              <feMergeNode in='SourceGraphic' />
            </feMerge>
          </filter>
        </defs>
      </svg>
      <div aria-hidden='true' className='sticker-device-ambient' />
      <div className='sticker-device-heading pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-4 px-4 py-3 sm:px-5'>
        <span className='font-mono text-[9px] uppercase tracking-[0.18em] text-white/48'>Device proof · {finish.presetId.replaceAll('-', ' ')}</span>
        <span className='hidden font-mono text-[9px] uppercase tracking-[0.18em] text-white/42 sm:block'>Drag to arrange · click to peel</span>
      </div>

      <div className='sticker-device-perspective relative z-10 mx-auto w-full max-w-[872px]'>
        <div className='sticker-device-base' aria-hidden='true' />
        <div className='sticker-device-lid' ref={surfaceRef}>
          <div aria-hidden='true' className='sticker-device-metal' />
          <div aria-hidden='true' className='sticker-device-top-light' />
          <div aria-hidden='true' className='sticker-device-bottom-shade' />

          <div
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 z-[1] [&>svg]:size-full'
            dangerouslySetInnerHTML={{ __html: artworkSvg }}
          />
          <OpenStickerShaderStage finish={finish} logoPath={logoPath} settings={settings} />

          {placements.map((placement) => {
            const asset = assetMap.get(placement.assetId);
            if (!asset) return null;
            const maskImage = `url("${asset.path.replaceAll('"', '%22')}")`;
            return (
              <button
                aria-label={`${asset.label} sticker. Drag to move; click, Enter, Delete, or Backspace to peel.`}
                className={`sticker-device-placed ${draggingId === placement.id ? 'is-dragging' : ''}`}
                data-placed-brand-sticker={asset.id}
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
                  zIndex: placement.z + 10,
                }}
                type='button'
              >
                <img alt='' draggable={false} src={asset.path} style={{ filter: `url("#${outlineFilterId}")` }} />
                <span aria-hidden='true' className='sticker-device-optical' style={{ maskImage, WebkitMaskImage: maskImage }} />
              </button>
            );
          })}
        </div>

        <div className='sticker-device-dock-wrap'>
          <div aria-label='Brand sticker assets' className='sticker-device-dock' role='toolbar'>
            <div className='sticker-device-dock-scroll'>
              {assets.map((asset) => (
                <button
                  aria-label={`Place ${asset.label} sticker`}
                  className={`sticker-device-asset ${asset.surface === 'light' ? 'is-light-surface' : ''}`}
                  key={asset.id}
                  onClick={() => addSticker(asset.id)}
                  title={`Place ${asset.label}`}
                  type='button'
                >
                  <img
                    alt=''
                    draggable={false}
                    src={asset.path}
                    style={{ filter: `url("#${outlineFilterId}") drop-shadow(0 2px 2px rgb(0 0 0 / 0.24))` }}
                  />
                </button>
              ))}
            </div>
            <span aria-hidden='true' className='h-6 w-px shrink-0 bg-white/12' />
            <button
              aria-label='Reset sticker arrangement'
              className='sticker-device-reset'
              onClick={resetScene}
              title='Reset sticker arrangement'
              type='button'
            >
              <RotateCcw aria-hidden='true' className='size-4' />
            </button>
          </div>
        </div>
      </div>

      <p aria-live='polite' className='sr-only'>{placements.length} brand stickers placed</p>
    </section>
  );
}
