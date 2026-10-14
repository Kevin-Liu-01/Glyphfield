'use client';

import { memo, startTransition, useCallback, useId, useSyncExternalStore, type ReactNode } from 'react';
import { T as GTText } from 'gt-next';

import StudioRangeLabel from '@/components/StudioRangeLabel';
import { Button } from '@/components/ui/Button';
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Plus,
  RotateCcw,
  Target,
  Trash2,
} from '@/components/ui/SolidIcons';
import StudioCheckbox from '@/components/ui/StudioCheckbox';
import StudioRange from '@/components/ui/StudioRange';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMotionGT } from '@/components/MotionTranslation';
import { resolveSequencePosition, type CubicBezier, type SequenceLayout } from '@/lib/animation';
import {
  DEFAULT_TEXT_ANIMATION,
  EASING_CHOICES,
  easingChoiceId,
  MAX_SCENE_KEYFRAMES,
  MOTION_PRESETS,
  resolveKeyframePose,
  TEXT_ANIMATION_LABELS,
  TEXT_ANIMATION_PRESETS,
  type AnimationKeyframe,
  type AnimationPose,
  type MotionPresetId,
  type TextAnimationPreset,
  type TextAnimationSettings,
} from '@/lib/animationMotion';
import type { StudioFrameSettings } from '@/lib/studio';

const T = memo(GTText);
T.displayName = 'AnimationMotionTranslation';

export type AnimationAlignEdge = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

export type AnimationSceneTimingPatch = { holdMs?: number | null; transitionMs?: number | null };

export type AnimationKeyframePatch = { atMs?: number; easing?: CubicBezier };

/** Shared inspector range: label, tabular readout, low-priority commit. */
export function AnimationRangeControl({
  ariaLabel,
  formatValue,
  label,
  max,
  min,
  onChange,
  step,
  unit,
  value,
}: {
  ariaLabel?: string;
  formatValue?: (value: number) => string;
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step: number;
  unit?: string;
  value: number;
}) {
  const resolvedValue = Math.min(max, Math.max(min, value));
  const rangeLabelId = useId();
  return (
    <label htmlFor={`${rangeLabelId}-input`} className='studio-range-control flex flex-col gap-2'>
      <StudioRangeLabel id={rangeLabelId}
        className='text-sm'
        label={label}
        value={<output className='font-mono text-xs tabular-nums text-muted-foreground'>
          {formatValue?.(resolvedValue) ?? resolvedValue}
          {formatValue ? null : unit}
        </output>}
      />
      <StudioRange id={`${rangeLabelId}-input`} aria-labelledby={ariaLabel ? undefined : rangeLabelId}
        aria-label={ariaLabel}
        max={max}
        min={min}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value);
          startTransition(() => onChange(nextValue));
        }}
        step={step}
        value={resolvedValue}
      />
    </label>
  );
}

function formatSigned(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(2)}`;
}

function formatSeconds(timeMs: number): string {
  return `${(Math.max(0, timeMs) / 1000).toFixed(2)}s`;
}

const noSubscription = () => () => {};

/** Time into a scene's hold at the current playhead: 0 before it, the full hold during its transition. */
export function sceneTimeAtPlayhead(timeMs: number, layout: SequenceLayout, sceneIndex: number): number {
  const position = resolveSequencePosition(timeMs, layout);
  if (position.index !== sceneIndex) return 0;
  return position.phase === 'hold' ? Math.round(position.sceneElapsedMs ?? 0) : layout.holds[sceneIndex] ?? 0;
}

/** Subscribes to the paused playhead only while a scene is keyframed. */
function useSceneTime({
  currentMsRef,
  enabled,
  layout,
  sceneIndex,
  subscribeToPlayhead,
}: {
  currentMsRef: { current: number };
  enabled: boolean;
  layout: SequenceLayout;
  sceneIndex: number;
  subscribeToPlayhead: (listener: (timeMs: number) => void) => () => void;
}): number {
  const read = useCallback(() => (enabled ? sceneTimeAtPlayhead(currentMsRef.current, layout, sceneIndex) : 0), [currentMsRef, enabled, layout, sceneIndex]);
  return useSyncExternalStore(enabled ? subscribeToPlayhead : noSubscription, read, () => 0);
}

type PlayheadProps = {
  currentMsRef: { current: number };
  layout: SequenceLayout;
  sceneIndex: number;
  subscribeToPlayhead: (listener: (timeMs: number) => void) => () => void;
};

/**
 * Transform sliders. With keyframes they show the pose at the playhead and an
 * edit writes (or creates) the keyframe there; without keyframes they edit the
 * scene's static pose. Only this block re-renders when the playhead moves.
 */
export function AnimationPoseControls({
  following = true,
  frameSettings,
  onPoseChange,
  ...playhead
}: PlayheadProps & {
  following?: boolean;
  frameSettings: StudioFrameSettings;
  onPoseChange: (patch: Partial<AnimationPose>) => void;
}) {
  const gt = useMotionGT();
  const keyframes = frameSettings.keyframes;
  const keyed = Boolean(keyframes?.length);
  const sceneTime = useSceneTime({ ...playhead, enabled: keyed && following });
  const pose = resolveKeyframePose(frameSettings, keyframes, sceneTime);
  // Matches the editor's keyframe snap: edits within a frame update that keyframe.
  const onKey = keyed && keyframes!.some((keyframe) => Math.abs(keyframe.atMs - sceneTime) <= 25);
  return (
    <div className='flex flex-col gap-4' data-animation-pose-controls={keyed ? 'keyed' : 'static'}>
      {keyed ? (
        <p className='text-xs leading-5 text-muted-foreground'>
          {onKey ? <T>Editing the keyframe at</T> : <T>Edits add a keyframe at</T>} <span className='font-mono tabular-nums text-foreground'>{formatSeconds(sceneTime)}</span>
        </p>
      ) : null}
      <AnimationRangeControl formatValue={formatSigned} label={<T>Horizontal</T>} max={1} min={-1} onChange={(alignX) => onPoseChange({ alignX })} step={0.01} value={pose.alignX} />
      <AnimationRangeControl formatValue={formatSigned} label={<T>Vertical</T>} max={1} min={-1} onChange={(alignY) => onPoseChange({ alignY })} step={0.01} value={pose.alignY} />
      <AnimationRangeControl formatValue={(value) => `${value.toFixed(2)}×`} label={<T>Scale</T>} max={2.5} min={0.1} onChange={(scale) => onPoseChange({ scale })} step={0.01} value={pose.scale} />
      <AnimationRangeControl formatValue={(value) => `${Math.round(value)}°`} label={<T>Rotation</T>} max={180} min={-180} onChange={(rotation) => onPoseChange({ rotation })} step={1} value={pose.rotation} />
      <AnimationRangeControl label={<T>Opacity</T>} max={100} min={0} onChange={(opacity) => onPoseChange({ opacity: opacity / 100 })} step={1} unit='%' value={Math.round(pose.opacity * 100)} />
      <span className='sr-only'>{gt('Pose values follow the playhead when the layer has keyframes.')}</span>
    </div>
  );
}

export function AnimationAlignControls({
  guidesVisible,
  onAlign,
  onGuidesVisibleChange,
}: {
  guidesVisible: boolean;
  onAlign: (edge: AnimationAlignEdge) => void;
  onGuidesVisibleChange: (visible: boolean) => void;
}) {
  const gt = useMotionGT();
  const actions: readonly { edge: AnimationAlignEdge; icon: ReactNode; label: string }[] = [
    { edge: 'left', icon: <AlignHorizontalJustifyStart aria-hidden='true' />, label: gt('Align layer left') },
    { edge: 'center', icon: <AlignHorizontalJustifyCenter aria-hidden='true' />, label: gt('Align layer to horizontal center') },
    { edge: 'right', icon: <AlignHorizontalJustifyEnd aria-hidden='true' />, label: gt('Align layer right') },
    { edge: 'top', icon: <AlignVerticalJustifyStart aria-hidden='true' />, label: gt('Align layer top') },
    { edge: 'middle', icon: <AlignVerticalJustifyCenter aria-hidden='true' />, label: gt('Align layer to vertical middle') },
    { edge: 'bottom', icon: <AlignVerticalJustifyEnd aria-hidden='true' />, label: gt('Align layer bottom') },
  ];
  return (
    <div className='flex flex-col gap-2'>
      <div aria-label={gt('Align to safe area')} className='grid grid-cols-6 gap-1' role='group'>
        {actions.map(({ edge, icon, label }) => (
          <Button aria-label={label} key={edge} onClick={() => onAlign(edge)} size='icon-sm' title={label} type='button' variant='outline'>{icon}</Button>
        ))}
      </div>
      <label className='studio-toggle-row'>
        <span><T>Show layout guides</T></span>
        <StudioCheckbox aria-label={gt('Show layout guides')} checked={guidesVisible} onChange={(event) => onGuidesVisibleChange(event.target.checked)} />
      </label>
    </div>
  );
}

export function AnimationSceneTimingControls({
  defaultHoldMs,
  holdMs,
  onTimingChange,
  overridden,
}: {
  defaultHoldMs: number;
  holdMs: number;
  onTimingChange: (patch: AnimationSceneTimingPatch) => void;
  overridden: boolean;
}) {
  return (
    <div className='flex flex-col gap-2'>
      <AnimationRangeControl
        ariaLabel='Scene duration'
        formatValue={(value) => formatSeconds(value)}
        label={<T>Scene duration</T>}
        max={10_000}
        min={100}
        onChange={(value) => onTimingChange({ holdMs: value })}
        step={10}
        value={holdMs}
      />
      <div className='flex items-center justify-between gap-2 text-xs text-muted-foreground'>
        <span>{overridden ? <T>Custom for this scene</T> : <><T>Follows sequence</T> · {formatSeconds(defaultHoldMs)}</>}</span>
        {overridden ? (
          <Button className='h-7 px-2 text-xs' onClick={() => onTimingChange({ holdMs: null })} size='sm' type='button' variant='ghost'>
            <RotateCcw aria-hidden='true' /><T>Use sequence duration</T>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function AnimationTextEntranceControls({
  onChange,
  textAnimation,
}: {
  onChange: (next: TextAnimationSettings | undefined) => void;
  textAnimation: TextAnimationSettings | undefined;
}) {
  const gt = useMotionGT();
  const current = textAnimation ?? DEFAULT_TEXT_ANIMATION;
  const preset = current.preset;
  const update = (patch: Partial<TextAnimationSettings>) => {
    const next = { ...current, ...patch };
    onChange(next.preset === 'none' ? undefined : next);
  };
  return (
    <div className='flex flex-col gap-3'>
      <div className='studio-field'>
        <span className='studio-field-label'><T>Preset</T></span>
        <StudioSelect
          ariaLabel={gt('Text entrance')}
          onValueChange={(value) => update({ preset: value as TextAnimationPreset })}
          options={TEXT_ANIMATION_PRESETS.map((id) => ({ label: gt(TEXT_ANIMATION_LABELS[id].label), value: id }))}
          value={preset}
        />
        <p className='text-xs leading-5 text-muted-foreground'>{gt(TEXT_ANIMATION_LABELS[preset].description)}</p>
      </div>
      {preset === 'none' ? null : (
        <>
          <AnimationRangeControl ariaLabel={gt('Entrance duration')} formatValue={formatSeconds} label={<T>Entrance duration</T>} max={3_000} min={100} onChange={(durationMs) => update({ durationMs })} step={10} value={current.durationMs} />
          {preset === 'word-rise' || preset === 'glyph-stagger' ? (
            <AnimationRangeControl ariaLabel={gt('Entrance stagger')} formatValue={(value) => (value === 0 ? gt('Auto') : `${value}ms`)} label={<T>Stagger</T>} max={300} min={0} onChange={(staggerMs) => update({ staggerMs })} step={5} value={current.staggerMs} />
          ) : null}
          {preset === 'type-on' ? null : (
            <div className='studio-field'>
              <span className='studio-field-label'><T>Entrance easing</T></span>
              <StudioSelect
                ariaLabel={gt('Entrance easing')}
                onValueChange={(id) => {
                  const choice = EASING_CHOICES.find((entry) => entry.id === id);
                  if (choice) update({ easing: [...choice.value] as unknown as CubicBezier });
                }}
                options={[...EASING_CHOICES.map(({ id, label }) => ({ label: gt(label), value: id })), ...(easingChoiceId(current.easing) === 'custom' ? [{ label: gt('Custom'), value: 'custom' }] : [])]}
                value={easingChoiceId(current.easing)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AnimationKeyframeControls({
  holdMs,
  keyframes,
  onAddKeyframe,
  onClearKeyframes,
  onKeyframeChange,
  onMotionPreset,
  onRemoveKeyframe,
  onSeekKeyframe,
}: {
  holdMs: number;
  keyframes: readonly AnimationKeyframe[] | undefined;
  onAddKeyframe: () => void;
  onClearKeyframes: () => void;
  onKeyframeChange: (id: string, patch: AnimationKeyframePatch) => void;
  onMotionPreset: (preset: MotionPresetId) => void;
  onRemoveKeyframe: (id: string) => void;
  onSeekKeyframe: (atMs: number) => void;
}) {
  const gt = useMotionGT();
  const count = keyframes?.length ?? 0;
  return (
    <div className='flex flex-col gap-3'>
      <div aria-label={gt('Motion presets')} className='grid grid-cols-3 gap-1.5' role='group'>
        {MOTION_PRESETS.map((preset) => (
          <Button
            aria-label={`${gt('Motion preset')}: ${gt(preset.label)}`}
            className='h-8 px-2 text-xs'
            key={preset.id}
            onClick={() => onMotionPreset(preset.id)}
            size='sm'
            title={gt(preset.description)}
            type='button'
            variant='outline'
          >
            {gt(preset.label)}
          </Button>
        ))}
      </div>
      <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-1.5'>
        <Button aria-label={gt('Add keyframe at playhead')} className='h-8' disabled={count >= MAX_SCENE_KEYFRAMES} onClick={onAddKeyframe} size='sm' type='button' variant='outline'>
          <Plus aria-hidden='true' /><T>Add keyframe</T>
        </Button>
        <Button aria-label={gt('Clear keyframes')} className='h-8' disabled={count === 0} onClick={onClearKeyframes} size='sm' type='button' variant='ghost'>
          <T>Clear</T>
        </Button>
      </div>
      {count === 0 ? (
        <p className='text-xs leading-5 text-muted-foreground'><T>Static pose. Add a keyframe, move the playhead, then move the layer to animate it across this scene.</T></p>
      ) : (
        <ol aria-label={gt('Layer keyframes')} className='flex flex-col divide-y divide-border border-y border-border'>
          {keyframes!.map((keyframe, index) => {
            const number = index + 1;
            return (
              <li className='grid grid-cols-[auto_minmax(0,64px)_minmax(0,1fr)_auto_auto] items-center gap-1.5 py-1.5' key={keyframe.id}>
                <span aria-hidden='true' className='size-2 rotate-45 bg-foreground' />
                <input
                  aria-label={`${gt('Keyframe')} ${number} ${gt('time in milliseconds')}`}
                  className='h-7 min-w-0 border border-input bg-background px-1.5 font-mono text-[11px] tabular-nums outline-none focus:border-foreground'
                  max={holdMs}
                  min={0}
                  onChange={(event) => {
                    const value = event.currentTarget.valueAsNumber;
                    if (Number.isFinite(value)) onKeyframeChange(keyframe.id, { atMs: value });
                  }}
                  step={10}
                  type='number'
                  value={Math.round(keyframe.atMs)}
                />
                <StudioSelect
                  ariaLabel={`${gt('Keyframe')} ${number} ${gt('easing')}`}
                  className='h-7 text-[11px]'
                  onValueChange={(id) => {
                    const choice = EASING_CHOICES.find((entry) => entry.id === id);
                    if (choice) onKeyframeChange(keyframe.id, { easing: [...choice.value] as unknown as CubicBezier });
                  }}
                  options={[...EASING_CHOICES.map(({ id, label }) => ({ label: gt(label), value: id })), ...(easingChoiceId(keyframe.easing) === 'custom' ? [{ label: gt('Custom'), value: 'custom' }] : [])]}
                  value={easingChoiceId(keyframe.easing)}
                />
                <Button aria-label={`${gt('Go to keyframe')} ${number}`} onClick={() => onSeekKeyframe(keyframe.atMs)} size='icon-xs' type='button' variant='ghost'><Target aria-hidden='true' /></Button>
                <Button aria-label={`${gt('Remove keyframe')} ${number}`} onClick={() => onRemoveKeyframe(keyframe.id)} size='icon-xs' type='button' variant='ghost'><Trash2 aria-hidden='true' /></Button>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
