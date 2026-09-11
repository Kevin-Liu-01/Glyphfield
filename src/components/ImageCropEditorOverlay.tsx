'use client';

import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';

import { Check, Crop } from '@/components/ui/SolidIcons';
import {
  imageCropAfterDrag,
  imageCropRenderedBounds,
  normalizeImageCropSettings,
  type ImageCropSettings,
} from '@/lib/imagePlacement';

type CropPointerSession = {
  boxHeight: number;
  boxWidth: number;
  crop: ImageCropSettings;
  clientToLocalX: number;
  clientToLocalY: number;
  pointerId: number;
  startX: number;
  startY: number;
};

function sameCrop(a: ImageCropSettings, b: ImageCropSettings) {
  return a.enabled === b.enabled
    && a.focalPointX === b.focalPointX
    && a.focalPointY === b.focalPointY
    && a.zoom === b.zoom;
}

export default function ImageCropEditorOverlay({
  crop: cropInput,
  label,
  onChange,
  onDone,
  onPreview,
  sourcePreview,
  url,
}: {
  crop: ImageCropSettings;
  label: string;
  onChange: (crop: ImageCropSettings) => void;
  onDone: () => void;
  onPreview: (crop: ImageCropSettings) => void;
  sourcePreview?: ReactNode;
  url: string;
}) {
  const crop = normalizeImageCropSettings(cropInput);
  const hostRef = useRef<HTMLDivElement>(null);
  const pointerSessionRef = useRef<CropPointerSession | null>(null);
  const [draft, setDraft] = useState(crop);
  const [frameSize, setFrameSize] = useState({ height: 1, width: 1 });
  const [imageSize, setImageSize] = useState({ height: 1, width: 1 });
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    if (!pointerSessionRef.current) setDraft((current) => sameCrop(current, crop) ? current : crop);
  }, [crop.enabled, crop.focalPointX, crop.focalPointY, crop.zoom]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const measure = () => {
      const bounds = host.getBoundingClientRect();
      const width = host.offsetWidth || host.clientWidth || bounds.width;
      const height = host.offsetHeight || host.clientHeight || bounds.height;
      setFrameSize((current) => current.width === width && current.height === height
        ? current
        : { height: Math.max(1, height), width: Math.max(1, width) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const rendered = imageCropRenderedBounds({
    boxHeight: frameSize.height,
    boxWidth: frameSize.width,
    crop: draft,
    imageHeight: imageSize.height,
    imageWidth: imageSize.width,
  });

  function cropFromPointer(event: Pick<ReactPointerEvent<HTMLDivElement>, 'clientX' | 'clientY' | 'shiftKey'>) {
    const session = pointerSessionRef.current;
    if (!session) return null;
    let deltaX = (event.clientX - session.startX) * session.clientToLocalX;
    let deltaY = (event.clientY - session.startY) * session.clientToLocalY;
    if (event.shiftKey) {
      if (Math.abs(deltaX) >= Math.abs(deltaY)) deltaY = 0;
      else deltaX = 0;
    }
    return imageCropAfterDrag({
      boxHeight: session.boxHeight,
      boxWidth: session.boxWidth,
      crop: session.crop,
      deltaX,
      deltaY,
      imageHeight: imageSize.height,
      imageWidth: imageSize.width,
    });
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerSessionRef.current = {
      boxHeight: frameSize.height,
      boxWidth: frameSize.width,
      clientToLocalX: frameSize.width / Math.max(1, bounds.width),
      clientToLocalY: frameSize.height / Math.max(1, bounds.height),
      crop: draft,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerSessionRef.current?.pointerId !== event.pointerId) return;
    const next = cropFromPointer(event);
    if (!next) return;
    setDraft(next);
    onPreview(next);
  }

  function finishDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (pointerSessionRef.current?.pointerId !== event.pointerId) return;
    const next = cropFromPointer(event) ?? draft;
    pointerSessionRef.current = null;
    setDragging(false);
    setDraft(next);
    onPreview(next);
    onChange(next);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function cancelDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const session = pointerSessionRef.current;
    if (session?.pointerId !== event.pointerId) return;
    pointerSessionRef.current = null;
    setDragging(false);
    setDraft(session.crop);
    onPreview(session.crop);
  }

  function nudgeCrop(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onDone();
      return;
    }
    const step = event.shiftKey ? 0.05 : 0.01;
    const offset = {
      ArrowDown: { x: 0, y: step },
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
    }[event.key];
    if (!offset) return;
    event.preventDefault();
    event.stopPropagation();
    const next = normalizeImageCropSettings({
      ...draft,
      focalPointX: draft.focalPointX + offset.x,
      focalPointY: draft.focalPointY + offset.y,
    });
    setDraft(next);
    onPreview(next);
    onChange(next);
  }

  return (
    <div
      aria-label={`Edit crop for ${label}. Drag the image to reposition it inside the blue frame.`}
      className='image-crop-editor-overlay'
      data-canvas-interactive
      data-dragging={dragging ? 'true' : 'false'}
      onDoubleClick={(event) => { event.preventDefault(); event.stopPropagation(); onDone(); }}
      onKeyDown={nudgeCrop}
      onPointerCancel={cancelDrag}
      onPointerDown={beginDrag}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      ref={hostRef}
      role='application'
      tabIndex={0}
    >
      <div
        aria-hidden='true'
        className='image-crop-editor-overlay__source'
        data-image-crop-source
        style={{
          height: rendered.height,
          left: rendered.left,
          top: rendered.top,
          width: rendered.width,
        }}
      >
        {sourcePreview ?? <img alt='' draggable={false} src={url} />}
      </div>
      <img
        alt=''
        aria-hidden='true'
        className='image-crop-editor-overlay__measure'
        draggable={false}
        onLoad={(event) => setImageSize({
          height: Math.max(1, event.currentTarget.naturalHeight),
          width: Math.max(1, event.currentTarget.naturalWidth),
        })}
        src={url}
      />
      <span aria-hidden='true' className='image-crop-editor-overlay__frame' />
      <span className='image-crop-editor-overlay__hint'>
        <Crop aria-hidden='true' />
        <span><strong>Crop image</strong><small>Drag to reposition · Shift locks axis</small></span>
      </span>
      <button
        className='image-crop-editor-overlay__done'
        onClick={(event) => { event.stopPropagation(); onDone(); }}
        onPointerDown={(event) => event.stopPropagation()}
        type='button'
      >
        <Check aria-hidden='true' />Done
      </button>
    </div>
  );
}
