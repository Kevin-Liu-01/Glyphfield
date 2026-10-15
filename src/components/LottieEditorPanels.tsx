'use client';

import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { T as GTText } from 'gt-next';

import { Button } from '@/components/ui/Button';
import ColorControl from '@/components/ui/ColorControl';
import { Eye, EyeOff, Pause, Play, Plus, RotateCcw, Trash2 } from '@/components/ui/SolidIcons';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioRange from '@/components/ui/StudioRange';
import { useMotionGT } from '@/components/MotionTranslation';
import { MAX_LOTTIE_MARKERS, type LottieColorSummary, type LottieLayerSummary, type LottieMarker, type LottieTextLayer } from '@/lib/lottieEditing';

const T = memo(GTText);
T.displayName = 'LottieEditorTranslation';

export type BrandToken = { hex: string; id: string; name: string };

type FrameListener = (frame: number) => void;

/**
 * Transport for the Lottie canvas. Frame updates arrive through a subscription
 * and re-render only this bar, never the editor and its inspectors.
 */
export const LottieTransport = memo(function LottieTransport({
  isPlaying,
  markers,
  onScrub,
  onTogglePlayback,
  segmentEnd,
  segmentStart,
  subscribeToFrame,
  totalFrames,
}: {
  isPlaying: boolean;
  markers: readonly LottieMarker[];
  onScrub: (frame: number) => void;
  onTogglePlayback: () => void;
  segmentEnd: number;
  segmentStart: number;
  subscribeToFrame: (listener: FrameListener) => () => void;
  totalFrames: number;
}) {
  const gt = useMotionGT();
  const [frame, setFrame] = useState(segmentStart);
  useEffect(() => subscribeToFrame(setFrame), [subscribeToFrame]);
  return (
    <div className='grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-border bg-background px-4 py-3'>
      <Button aria-label={isPlaying ? gt('Pause animation') : gt('Play animation')} onClick={onTogglePlayback} size='icon-sm' type='button' variant='outline'>{isPlaying ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}</Button>
      <div className='relative'>
        <StudioRange aria-label={gt('Animation frame')} max={Math.max(1, segmentEnd)} min={segmentStart} onChange={(event) => { const next = Number(event.target.value); setFrame(next); onScrub(next); }} value={Math.min(Math.max(frame, segmentStart), segmentEnd)} />
        {markers.length > 0 ? (
          <div aria-hidden='true' className='pointer-events-none absolute inset-x-0 -bottom-2 h-2'>
            {markers.filter((marker) => marker.frame >= segmentStart && marker.frame <= segmentEnd).map((marker) => (
              <span
                className='absolute top-0 h-2 w-px bg-foreground/50'
                key={`${marker.name}-${marker.frame}`}
                style={{ left: `${((marker.frame - segmentStart) / Math.max(1, segmentEnd - segmentStart)) * 100}%` }}
              />
            ))}
          </div>
        ) : null}
      </div>
      <output className='min-w-24 text-right font-mono text-xs tabular-nums text-muted-foreground'>{Math.round(frame)} / {Math.max(0, totalFrames - 1)}</output>
    </div>
  );
});

export const LottieMarkerControls = memo(function LottieMarkerControls({
  editable,
  markers,
  onAddMarker,
  onPlayMarker,
  onRemoveMarker,
  onRenameMarker,
}: {
  editable: boolean;
  markers: readonly LottieMarker[];
  onAddMarker: () => void;
  onPlayMarker: (marker: LottieMarker) => void;
  onRemoveMarker: (index: number) => void;
  onRenameMarker: (index: number, name: string) => void;
}) {
  const gt = useMotionGT();
  return (
    <div className='flex flex-col gap-2'>
      {markers.length === 0 ? (
        <p className='text-xs leading-5 text-muted-foreground'><T>No named segments yet. Add one at the current frame to loop just that part.</T></p>
      ) : (
        <ol aria-label={gt('Animation markers')} className='flex flex-col divide-y divide-border border-y border-border'>
          {markers.map((marker, index) => (
            <li className='grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 py-1.5' key={`${index}-${marker.frame}`}>
              <span className='min-w-0'>
                {editable ? (
                  <input
                    aria-label={`${gt('Marker')} ${index + 1} ${gt('name')}`}
                    className='h-7 w-full min-w-0 border border-transparent bg-transparent px-1 text-sm outline-none hover:border-input focus:border-foreground'
                    maxLength={64}
                    onChange={(event) => onRenameMarker(index, event.target.value)}
                    value={marker.name}
                  />
                ) : <span className='block truncate px-1 text-sm'>{marker.name}</span>}
                <small className='block px-1 font-mono text-[10px] tabular-nums text-muted-foreground'>{Math.round(marker.frame)}–{Math.round(marker.frame + marker.duration)}</small>
              </span>
              <Button aria-label={`${gt('Play marker')} ${marker.name}`} onClick={() => onPlayMarker(marker)} size='icon-xs' type='button' variant='ghost'><Play aria-hidden='true' /></Button>
              {editable ? (
                <Button aria-label={`${gt('Remove marker')} ${marker.name}`} onClick={() => onRemoveMarker(index)} size='icon-xs' type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>
              ) : <span />}
            </li>
          ))}
        </ol>
      )}
      {editable ? (
        <>
          <Button aria-label={gt('Add marker at the current frame')} className='h-8' disabled={markers.length >= MAX_LOTTIE_MARKERS} onClick={onAddMarker} size='sm' type='button' variant='outline'><Plus aria-hidden='true' /><T>Add marker</T></Button>
          {markers.length >= MAX_LOTTIE_MARKERS ? <p className='text-xs leading-5 text-muted-foreground'><T>Glyphfield keeps at most 64 markers per animation.</T></p> : null}
        </>
      ) : <p className='text-xs leading-5 text-muted-foreground'><T>Markers come from the .lottie bundle and play as named segments.</T></p>}
    </div>
  );
});

const LAYER_TYPE_LABELS: Record<LottieLayerSummary['type'], string> = {
  image: 'Image', null: 'Null', other: 'Layer', precomp: 'Precomp', shape: 'Shape', solid: 'Solid', text: 'Text',
};

export const LottieLayerControls = memo(function LottieLayerControls({
  hiddenLayers,
  layers,
  onTextChange,
  onVisibilityChange,
  textLayers,
  textOverrides,
}: {
  hiddenLayers: readonly string[];
  layers: readonly LottieLayerSummary[];
  onTextChange: (key: string, text: string | null) => void;
  onVisibilityChange: (key: string, visible: boolean) => void;
  textLayers: readonly LottieTextLayer[];
  textOverrides: Readonly<Record<string, string>>;
}) {
  const gt = useMotionGT();
  const hidden = new Set(hiddenLayers);
  const textByKey = new Map(textLayers.map((layer) => [layer.key, layer]));
  return (
    <ol aria-label={gt('Lottie layers')} className='flex max-h-[420px] flex-col divide-y divide-border overflow-y-auto border-y border-border'>
      {layers.map((layer) => {
        const visible = !hidden.has(layer.key) && !layer.hidden;
        const text = textByKey.get(layer.key);
        return (
          <li className='flex flex-col gap-1 py-1.5' data-hidden={visible ? undefined : 'true'} key={layer.key}>
            <div className='grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2'>
              <Button
                aria-label={`${visible ? gt('Hide layer') : gt('Show layer')} ${layer.name}`}
                aria-pressed={!visible}
                disabled={layer.hidden}
                onClick={() => onVisibilityChange(layer.key, !visible)}
                size='icon-xs'
                title={layer.hidden ? gt('Hidden in the source document') : undefined}
                type='button'
                variant='ghost'
              >
                {visible ? <Eye aria-hidden='true' /> : <EyeOff aria-hidden='true' />}
              </Button>
              <span className={`min-w-0 truncate text-sm ${visible ? '' : 'text-muted-foreground line-through'}`}>{layer.name}</span>
              <small className='font-mono text-[10px] uppercase tracking-wide text-muted-foreground'>{gt(LAYER_TYPE_LABELS[layer.type])}</small>
            </div>
            {text ? (
              <div className='flex items-center gap-1 pl-8'>
                <input
                  aria-label={`${gt('Text for layer')} ${layer.name}`}
                  className='h-7 min-w-0 flex-1 border border-input bg-background px-2 text-xs outline-none focus:border-foreground'
                  maxLength={500}
                  onChange={(event) => onTextChange(layer.key, event.target.value)}
                  value={textOverrides[layer.key] ?? text.text}
                />
                {textOverrides[layer.key] !== undefined ? (
                  <Button aria-label={`${gt('Restore original text for')} ${layer.name}`} onClick={() => onTextChange(layer.key, null)} size='icon-xs' type='button' variant='ghost'><RotateCcw aria-hidden='true' /></Button>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
});

/** One-click brand colour tokens for a colour slot. */
export const BrandTokenChips = memo(function BrandTokenChips({
  onSelect,
  target,
  tokens,
  value,
}: {
  onSelect: (hex: string) => void;
  target: string;
  tokens: readonly BrandToken[];
  value: string;
}) {
  const gt = useMotionGT();
  return (
    <div aria-label={`${gt('Brand tokens for')} ${target}`} className='flex flex-wrap gap-1' role='group'>
      {tokens.map((token) => (
        <button
          aria-label={`${gt('Use')} ${token.name} ${gt('for')} ${target}`}
          aria-pressed={token.hex.toUpperCase() === value.toUpperCase()}
          className='size-5 rounded-[3px] outline-none ring-offset-1 ring-offset-background aria-pressed:ring-2 aria-pressed:ring-foreground focus-visible:ring-2 focus-visible:ring-[hsl(var(--focus-ring))]'
          key={token.id}
          onClick={() => onSelect(token.hex)}
          style={{ backgroundColor: token.hex, boxShadow: 'inset 0 0 0 1px hsl(var(--foreground) / 0.18)' }}
          title={`${token.name} · ${token.hex}`}
          type='button'
        />
      ))}
    </div>
  );
});

export const LottieSourceColorControls = memo(function LottieSourceColorControls({
  colorMap,
  colors,
  onBrandMap,
  onChange,
  onReset,
  tokens,
}: {
  colorMap: Readonly<Record<string, string>>;
  colors: readonly LottieColorSummary[];
  onBrandMap: () => void;
  onChange: (from: string, to: string | null) => void;
  onReset: () => void;
  tokens: readonly BrandToken[];
}) {
  const gt = useMotionGT();
  return (
    <div className='flex flex-col gap-3'>
      <div className='grid grid-cols-2 gap-1.5'>
        <Button aria-label={gt('Map colours to brand tokens')} className='h-8' onClick={onBrandMap} size='sm' type='button' variant='outline'><T>Brand tokens</T></Button>
        <Button aria-label={gt('Restore authored colours')} className='h-8' disabled={Object.keys(colorMap).length === 0} onClick={onReset} size='sm' type='button' variant='ghost'><T>Authored</T></Button>
      </div>
      {colors.length === 0 ? <p className='text-xs leading-5 text-muted-foreground'><T>This document has no static colours to replace.</T></p> : null}
      {colors.slice(0, 16).map(({ count, hex }) => {
        const value = colorMap[hex] ?? hex;
        return (
          <div className='flex flex-col gap-1.5' key={hex}>
            <ColorControl
              ariaLabel={`${gt('Replace colour')} ${hex}`}
              label={<span className='inline-flex items-center gap-1.5'><span aria-hidden='true' className='size-2.5 rounded-[2px]' style={{ backgroundColor: hex }} /><span className='font-mono text-[11px]'>{hex}</span><small className='text-muted-foreground'>×{count}</small></span>}
              onChange={(next) => onChange(hex, next.toUpperCase() === hex ? null : next)}
              value={value}
            />
            <BrandTokenChips onSelect={(next) => onChange(hex, next)} target={hex} tokens={tokens} value={value} />
          </div>
        );
      })}
    </div>
  );
});

export function LottieRecolorModeToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }): ReactNode {
  const gt = useMotionGT();
  return (
    <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'>
      <span><T>Palette recolours every paint</T></span>
      <StudioCheckbox aria-label={gt('Palette recolours every paint')} checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function LottieBrandLogoToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }): ReactNode {
  const gt = useMotionGT();
  return (
    <label className='flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2 text-sm'>
      <span><T>Show brand logo</T></span>
      <StudioCheckbox aria-label={gt('Show brand logo')} checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

export function useFrameSubscription() {
  const listenersRef = useRef(new Set<FrameListener>());
  const frameRef = useRef(0);
  const [api] = useState(() => ({
    publish(frame: number) {
      frameRef.current = frame;
      listenersRef.current.forEach((listener) => listener(frame));
    },
    subscribe(listener: FrameListener) {
      listenersRef.current.add(listener);
      listener(frameRef.current);
      return () => { listenersRef.current.delete(listener); };
    },
  }));
  return { frameRef, ...api };
}
