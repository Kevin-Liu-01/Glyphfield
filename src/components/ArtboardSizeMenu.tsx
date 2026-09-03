'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Frame } from '@/components/ui/SolidIcons';

import {
  normalizeStudioArtboardDimensions,
  STUDIO_ARTBOARD_PRESETS,
  studioArtboardPresetForSize,
  type StudioArtboardDimensions,
  type StudioArtboardPreset,
} from '@/lib/artboardSizes';

type ArtboardSizeMenuProps = {
  align?: 'end' | 'start';
  artboardName?: string;
  className?: string;
  dimensions: StudioArtboardDimensions;
  onArtboardNameChange?: (name: string) => void;
  onDimensionsChange: (dimensions: StudioArtboardDimensions) => void;
  presets?: readonly StudioArtboardPreset[];
};

type ArtboardSetupFieldsProps = Pick<
  ArtboardSizeMenuProps,
  'artboardName' | 'dimensions' | 'onArtboardNameChange' | 'onDimensionsChange' | 'presets'
> & {
  className?: string;
};

type PopoverPosition = {
  left: number;
  top: number;
  transformOrigin: CSSProperties['transformOrigin'];
  width: number;
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function ArtboardSetupFields({
  artboardName,
  className,
  dimensions,
  onArtboardNameChange,
  onDimensionsChange,
  presets = STUDIO_ARTBOARD_PRESETS,
}: ArtboardSetupFieldsProps) {
  const [draftWidth, setDraftWidth] = useState(String(dimensions.width));
  const [draftHeight, setDraftHeight] = useState(String(dimensions.height));

  useEffect(() => {
    setDraftWidth(String(dimensions.width));
    setDraftHeight(String(dimensions.height));
  }, [dimensions.height, dimensions.width]);

  function commitCustomDimensions() {
    const next = normalizeStudioArtboardDimensions({
      height: draftHeight.trim() ? Number(draftHeight) : undefined,
      width: draftWidth.trim() ? Number(draftWidth) : undefined,
    }, dimensions);
    setDraftHeight(String(next.height));
    setDraftWidth(String(next.width));
    if (next.width !== dimensions.width || next.height !== dimensions.height) {
      onDimensionsChange(next);
    }
  }

  function commitOnEnter(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitCustomDimensions();
    event.currentTarget.select();
  }

  return (
    <div className={joinClassNames('artboard-setup-fields', className)}>
      {onArtboardNameChange ? (
        <label className='studio-field'>
          <span className='studio-field-label'>Artboard name</span>
          <input
            className='studio-field-input'
            maxLength={48}
            onChange={(event) => onArtboardNameChange(event.target.value)}
            value={artboardName ?? ''}
          />
        </label>
      ) : null}

      <div aria-label='Artboard size presets' className='artboard-size-preset-grid' role='group'>
        {presets.map((preset) => {
          const selected = dimensions.width === preset.width && dimensions.height === preset.height;
          return (
            <button
              aria-pressed={selected}
              key={preset.id}
              onClick={() => onDimensionsChange({ height: preset.height, width: preset.width })}
              type='button'
            >
              <span aria-hidden='true' className='artboard-size-preset-shape' style={{ aspectRatio: `${preset.width} / ${preset.height}` }} />
              <span><strong>{preset.label}</strong><small>{preset.width} × {preset.height}</small></span>
              {selected ? <Check aria-hidden='true' /> : null}
            </button>
          );
        })}
      </div>

      <fieldset className='artboard-size-custom-fields'>
        <legend>Custom size</legend>
        <label className='studio-field'>
          <span className='studio-field-label'>Width</span>
          <input
            className='studio-field-input font-mono'
            inputMode='numeric'
            max='4096'
            min='120'
            onBlur={commitCustomDimensions}
            onChange={(event) => setDraftWidth(event.target.value)}
            onKeyDown={commitOnEnter}
            step='1'
            type='number'
            value={draftWidth}
          />
        </label>
        <span aria-hidden='true'>×</span>
        <label className='studio-field'>
          <span className='studio-field-label'>Height</span>
          <input
            className='studio-field-input font-mono'
            inputMode='numeric'
            max='4096'
            min='120'
            onBlur={commitCustomDimensions}
            onChange={(event) => setDraftHeight(event.target.value)}
            onKeyDown={commitOnEnter}
            step='1'
            type='number'
            value={draftHeight}
          />
        </label>
      </fieldset>
    </div>
  );
}

export default function ArtboardSizeMenu({
  align = 'start',
  artboardName,
  className,
  dimensions,
  onArtboardNameChange,
  onDimensionsChange,
  presets = STUDIO_ARTBOARD_PRESETS,
}: ArtboardSizeMenuProps) {
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const activePreset = studioArtboardPresetForSize(dimensions.width, dimensions.height);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const bounds = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const width = Math.min(372, window.innerWidth - viewportPadding * 2);
      const preferredLeft = align === 'end' ? bounds.right - width : bounds.left;
      const left = Math.max(viewportPadding, Math.min(preferredLeft, window.innerWidth - width - viewportPadding));
      const fitsBelow = bounds.bottom + 8 + 428 <= window.innerHeight - viewportPadding;
      const top = fitsBelow
        ? bounds.bottom + 6
        : Math.max(viewportPadding, bounds.top - 6 - 428);
      setPosition({
        left,
        top,
        transformOrigin: `${Math.max(12, Math.min(width - 12, bounds.left + bounds.width / 2 - left))}px ${fitsBelow ? 'top' : 'bottom'}`,
        width,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [align, open]);

  useEffect(() => {
    if (!open) return;
    function dismissOnPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', dismissOnPointerDown);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOnPointerDown);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [open]);

  const panel = open && position ? (
    <div
      aria-label='Artboard setup'
      aria-modal='false'
      className='artboard-size-popover'
      data-canvas-selection-preserve
      id={panelId}
      ref={panelRef}
      role='dialog'
      style={{
        left: position.left,
        top: position.top,
        transformOrigin: position.transformOrigin,
        width: position.width,
      }}
    >
      <header className='artboard-size-popover-header'>
        <span><Frame aria-hidden='true' /></span>
        <div>
          <strong>Artboard setup</strong>
          <small>{activePreset?.label ?? 'Custom'} · {dimensions.width} × {dimensions.height}</small>
        </div>
      </header>

      <ArtboardSetupFields
        artboardName={artboardName}
        dimensions={dimensions}
        onArtboardNameChange={onArtboardNameChange}
        onDimensionsChange={onDimensionsChange}
        presets={presets}
      />
    </div>
  ) : null;

  return (
    <>
      <button
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        aria-haspopup='dialog'
        aria-label={`Set artboard size. Current size ${dimensions.width} by ${dimensions.height}`}
        className={joinClassNames('artboard-size-trigger', className)}
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type='button'
      >
        <span>{dimensions.width} × {dimensions.height}</span>
        <ChevronDown aria-hidden='true' />
      </button>
      {typeof document === 'undefined' ? null : createPortal(panel, document.body)}
    </>
  );
}
