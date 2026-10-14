'use client';

import { T as GTText } from 'gt-next';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';

import AnimationAudioTrack from '@/components/AnimationAudioTrack';
import { KeyframeDiamond, SceneTrimHandle, type SceneTrimMode } from '@/components/AnimationTimelineHandles';
import timelineStyles from '@/components/AnimationTimeline.module.css';
import { animationPackagePresentation } from '@/components/AnimationPackageGallery';
import AnimationSequenceTooltipPreview from '@/components/AnimationSequenceTooltipPreview';
import AnimationTimelinePreview from '@/components/AnimationTimelinePreview';
import { Button } from '@/components/ui/Button';
import { Frame, Maximize2, Minus, Pause, Play, Plus, RotateCcw, SkipBack, SkipForward } from '@/components/ui/SolidIcons';
import StudioContextMenu, {
  contextMenuPositionFromElement,
  contextMenuPositionFromEvent,
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import StudioPreviewTooltip from '@/components/ui/StudioPreviewTooltip';
import StudioRange from '@/components/ui/StudioRange';
import StudioSelect from '@/components/ui/StudioSelect';
import { useMotionGT } from '@/components/MotionTranslation';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useTimelineFollow } from '@/hooks/useTimelineFollow';
import {
  clampTimelineZoom,
  DEFAULT_TIMELINE_ZOOM,
  MAX_TIMELINE_ZOOM,
  MIN_TIMELINE_ZOOM,
  sequenceSceneTime,
  uniformSequenceLayout,
  type SequenceLayout,
} from '@/lib/animation';
import type { AnimationAudioClip, AnimationAudioState } from '@/lib/animationAudio';
import type { AnimationKeyframe } from '@/lib/animationMotion';
import type { StudioSource } from '@/lib/renderFrame';
import type { StudioSettings, StudioTransitionSettings } from '@/lib/studio';

const T = memo(GTText);
T.displayName = 'TimelineTranslation';

type PlayheadDragSession = {
  axisLeft: number;
  axisWidth: number;
  frame: number;
  latestClientX: number;
  pointerId: number;
};

const TIMELINE_AXIS_INSET = 10;
/** A scene card's width at default zoom; zoom scales it with the time axis. */
const MIN_SCENE_WIDTH = 224;

type TimelinePanelProps = {
  audio: AnimationAudioState;
  currentMsRef: { current: number };
  disabled?: boolean;
  isPlaying: boolean;
  /** Layer keyframes by scene ID, drawn as retimable diamonds over each hold. */
  keyframes?: Readonly<Record<string, readonly AnimationKeyframe[] | undefined>>;
  /** Per-scene timing. Defaults to the uniform sequence timing in `settings`. */
  layout?: SequenceLayout;
  onKeyframeRemove?: (sourceId: string, keyframeId: string) => void;
  onKeyframeRetime?: (sourceId: string, keyframeId: string, atMs: number) => void;
  onKeyframeSelect?: (sourceId: string, keyframeId: string) => void;
  onSceneTrim?: (index: number, deltaMs: number, mode: SceneTrimMode) => void;
  onZoomChange?: (pixelsPerSecond: number) => void;
  onAudioClipChange: (clipId: string, patch: Partial<AnimationAudioClip>) => void;
  onAudioFiles: (files: FileList) => void;
  onAudioMutedChange: (muted: boolean) => void;
  onAudioRemoveClip: (clipId: string) => void;
  onAudioSelectedClipChange: (clipId: string | null) => void;
  onAudioSplitClip: (clipId: string) => void;
  onAudioVolumeChange: (volume: number) => void;
  onPlayChange: (playing: boolean) => void;
  onRateChange: (rate: number) => void;
  onSeek: (timeMs: number) => void;
  onSelectSource: (id: string) => void;
  onSelectTransition: (index: number) => void;
  playbackRate: number;
  presentationMode?: boolean;
  previewSources: readonly StudioSource[];
  selectedAudioClipId: string | null;
  selectedSourceId: string | null;
  selectedTransitionIndex: number | null;
  settings: StudioSettings;
  subscribeToPlayhead: (listener: (timeMs: number) => void) => () => void;
  sources: readonly StudioSource[];
  totalMs: number;
  transitionSettings: readonly StudioTransitionSettings[];
  /** Horizontal scale of the storyboard in pixels per second. */
  zoom?: number;
};

/** With zoom controls beside the scrubber, the storyboard label stays for assistive tech only. */
function timelineHeadingClass(hasZoom: boolean): string {
  return hasZoom ? 'animation-timeline-heading sr-only' : 'animation-timeline-heading';
}

function TimelineZoomControls({
  disabled,
  onFit,
  onZoomChange,
  pixelsPerSecond,
}: {
  disabled: boolean;
  onFit: () => void;
  onZoomChange: (pixelsPerSecond: number) => void;
  pixelsPerSecond: number;
}) {
  const gt = useMotionGT();
  return (
    <div aria-label={gt('Timeline zoom')} className={timelineStyles.zoom} role='group' title={`${Math.round((pixelsPerSecond / DEFAULT_TIMELINE_ZOOM) * 100)}%`}>
      <Button aria-label={gt('Zoom timeline out')} disabled={disabled || pixelsPerSecond <= MIN_TIMELINE_ZOOM} onClick={() => onZoomChange(clampTimelineZoom(pixelsPerSecond / 1.25))} size='icon-xs' type='button' variant='ghost'><Minus aria-hidden='true' /></Button>
      <Button aria-label={gt('Zoom timeline in')} disabled={disabled || pixelsPerSecond >= MAX_TIMELINE_ZOOM} onClick={() => onZoomChange(clampTimelineZoom(pixelsPerSecond * 1.25))} size='icon-xs' type='button' variant='ghost'><Plus aria-hidden='true' /></Button>
      <Button aria-label={gt('Fit timeline to view')} disabled={disabled} onClick={onFit} size='icon-xs' type='button' variant='ghost'><Maximize2 aria-hidden='true' /></Button>
    </div>
  );
}

function formatTime(timeMs: number): string {
  return `${(Math.max(0, timeMs) / 1000).toFixed(2)}s`;
}

function sourceLabel(source: StudioSource): string {
  return source.kind === 'text' ? source.text : source.name;
}

function TimelinePanel({
  audio,
  currentMsRef,
  disabled = false,
  isPlaying,
  keyframes,
  layout: layoutInput,
  onAudioClipChange,
  onAudioFiles,
  onAudioMutedChange,
  onAudioRemoveClip,
  onAudioSelectedClipChange,
  onAudioSplitClip,
  onAudioVolumeChange,
  onKeyframeRemove,
  onKeyframeRetime,
  onKeyframeSelect,
  onPlayChange,
  onRateChange,
  onSceneTrim,
  onSeek,
  onSelectSource,
  onSelectTransition,
  onZoomChange,
  playbackRate,
  presentationMode = false,
  previewSources,
  selectedAudioClipId,
  selectedSourceId,
  selectedTransitionIndex,
  settings,
  subscribeToPlayhead,
  sources,
  totalMs,
  transitionSettings,
  zoom,
}: TimelinePanelProps) {
  const gt = useMotionGT();
  const disabledRef = useCommittedRef(disabled);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLOutputElement>(null);
  const audioPlayheadRef = useRef<HTMLDivElement>(null);
  const storyboardPlayheadRef = useRef<HTMLDivElement>(null);
  const playheadDragRef = useRef<PlayheadDragSession | null>(null);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [timelineMenu, setTimelineMenu] = useState<{
    index: number;
    kind: 'frame' | 'transition';
    position: StudioContextMenuPosition;
  } | null>(null);
  const { contentRef, follow, scrollRef } = useTimelineFollow({
    currentMsRef, disabled: disabled || timelineMenu !== null, isPlaying, totalMs,
  });
  const frameDuration = 1000 / settings.fps;
  const layout = useMemo(() => layoutInput ?? uniformSequenceLayout({
    holdMs: settings.holdMs,
    itemCount: sources.length,
    transitionMs: settings.transitionMs,
  }), [layoutInput, settings.holdMs, settings.transitionMs, sources.length]);
  const pixelsPerSecond = clampTimelineZoom(zoom);
  // Segments grow in proportion to their duration, so the percentage playhead
  // and audio clips stay aligned with every scene at any zoom.
  const timelineWidth = useMemo(() => Math.max(
    1,
    Math.max(
      sources.length * MIN_SCENE_WIDTH * (pixelsPerSecond / DEFAULT_TIMELINE_ZOOM),
      (layout.totalMs / 1000) * pixelsPerSecond
    ) + TIMELINE_AXIS_INSET * 2
  ), [layout.totalMs, pixelsPerSecond, sources.length]);
  const segmentBoundaries = useMemo(() => (
    layout.totalMs > 0 ? layout.starts.map((start) => start / layout.totalMs) : []
  ), [layout]);
  const sceneStart = (index: number) => sequenceSceneTime(layout, index);
  const transitionMidpoint = (index: number) => sequenceSceneTime(layout, index, 'transition');
  const pixelsPerMs = useCallback(() => {
    const content = contentRef.current;
    const width = (content?.clientWidth ?? timelineWidth) - TIMELINE_AXIS_INSET * 2;
    return Math.max(0.0001, width / Math.max(1, layout.totalMs));
  // contentRef is a stable ref object from useTimelineFollow.
  }, [layout.totalMs, timelineWidth]);
  const syncPlayheadUi = useCallback((timeMs = currentMsRef.current) => {
    follow(timeMs);
    const currentMs = Math.min(timeMs, totalMs);
    const progress = totalMs === 0 ? 0 : currentMs / totalMs * 100;
    for (const playhead of [storyboardPlayheadRef.current, audioPlayheadRef.current]) {
      if (!playhead) continue;
      playhead.style.transform = `translate3d(${progress}%, 0, 0)`;
      const handle = playhead.querySelector<HTMLElement>('[data-timeline-playhead-handle]');
      handle?.setAttribute('aria-valuenow', String(Math.round(currentMs)));
      handle?.setAttribute('aria-valuetext', formatTime(currentMs));
    }
    if (outputRef.current) outputRef.current.value = `${formatTime(currentMs)} / ${formatTime(totalMs)}`;
    if (inputRef.current) {
      inputRef.current.value = String(currentMs);
      const rangeProgress = totalMs === 0 ? 0 : Number(inputRef.current.value) / totalMs * 100;
      inputRef.current.style.setProperty('--studio-range-progress', `${rangeProgress}%`);
    }
  }, [currentMsRef, follow, totalMs]);

  useEffect(() => subscribeToPlayhead(syncPlayheadUi), [subscribeToPlayhead, syncPlayheadUi]);

  const zoomRef = useCommittedRef({ onZoomChange, pixelsPerSecond });
  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    // Ctrl/Cmd + wheel zooms the time axis; plain wheel keeps native scrolling.
    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !zoomRef.current.onZoomChange) return;
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * 0.0025);
      zoomRef.current.onZoomChange(clampTimelineZoom(zoomRef.current.pixelsPerSecond * factor));
    };
    scroll.addEventListener('wheel', handleWheel, { passive: false });
    return () => scroll.removeEventListener('wheel', handleWheel);
  }, [scrollRef, zoomRef]);

  function fitTimeline() {
    const scroll = scrollRef.current;
    if (!scroll || layout.totalMs <= 0) return;
    onZoomChange?.(clampTimelineZoom(((scroll.clientWidth - TIMELINE_AXIS_INSET * 2) / layout.totalMs) * 1000));
  }

  function seekAndSync(timeMs: number) {
    if (disabledRef.current) return;
    onSeek(timeMs);
    follow(timeMs, true);
    syncPlayheadUi(timeMs);
  }

  function applyPlayheadDrag(session: PlayheadDragSession) {
    const progress = Math.min(1, Math.max(0, (session.latestClientX - session.axisLeft) / session.axisWidth));
    seekAndSync(progress * totalMs);
  }

  function beginPlayheadDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabledRef.current || event.button !== 0 || playheadDragRef.current) return;
    const surface = event.currentTarget.closest<HTMLElement>('[data-timeline-scrub-surface]');
    if (!surface) return;
    const bounds = surface.getBoundingClientRect();
    const inset = Number(surface.dataset.timelineAxisInset ?? 0);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const session = {
      axisLeft: bounds.left + inset,
      axisWidth: Math.max(1, bounds.width - inset * 2),
      frame: 0,
      latestClientX: event.clientX,
      pointerId: event.pointerId,
    };
    playheadDragRef.current = session;
    setIsScrubbing(true);
    applyPlayheadDrag(session);
  }

  function movePlayheadDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const session = playheadDragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    session.latestClientX = event.clientX;
    if (session.frame) return;
    session.frame = requestAnimationFrame(() => {
      session.frame = 0;
      applyPlayheadDrag(session);
    });
  }

  function endPlayheadDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const session = playheadDragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (session.frame) cancelAnimationFrame(session.frame);
    session.latestClientX = event.clientX;
    applyPlayheadDrag(session);
    playheadDragRef.current = null;
    setIsScrubbing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handlePlayheadKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (disabledRef.current) return;
    let nextTime: number | null = null;
    if (event.key === 'Home') nextTime = 0;
    if (event.key === 'End') nextTime = totalMs;
    if (event.key === 'ArrowLeft') nextTime = currentMsRef.current - (event.shiftKey ? 1000 : frameDuration);
    if (event.key === 'ArrowRight') nextTime = currentMsRef.current + (event.shiftKey ? 1000 : frameDuration);
    if (nextTime === null) return;
    event.preventDefault();
    seekAndSync(Math.min(totalMs, Math.max(0, nextTime)));
  }

  return (
    <section aria-busy={disabled} className='animation-timeline' data-animation-storyboard data-scrubbing={isScrubbing ? 'true' : 'false'} inert={disabled}>
      <header className='animation-timeline-toolbar'>
        <div className='animation-timeline-transport'>
          <Button aria-label={isPlaying ? gt('Pause preview') : gt('Play preview')} disabled={disabled} onClick={() => onPlayChange(!isPlaying)} size='icon-sm' type='button' variant='outline'>
            {isPlaying ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
          </Button>
          <Button aria-label={gt('Restart preview')} disabled={disabled} onClick={() => seekAndSync(0)} size='icon-sm' type='button' variant='outline'><RotateCcw aria-hidden='true' /></Button>
          <Button aria-label={gt('Previous frame')} disabled={disabled} onClick={() => seekAndSync(Math.max(0, currentMsRef.current - frameDuration))} size='icon-sm' type='button' variant='outline'><SkipBack aria-hidden='true' /></Button>
          <Button aria-label={gt('Next frame')} disabled={disabled} onClick={() => seekAndSync(Math.min(totalMs, currentMsRef.current + frameDuration))} size='icon-sm' type='button' variant='outline'><SkipForward aria-hidden='true' /></Button>
        </div>

        <div className='animation-timeline-storyboard-control'>
          <div className={timelineHeadingClass(Boolean(onZoomChange))}>
            <strong><T>Storyboard</T></strong>
          </div>
          <div className='animation-timeline-scrubber'>
            <StudioRange
              aria-label={gt('Timeline playhead')}
              defaultValue={Math.min(currentMsRef.current, Math.max(1, totalMs))}
              disabled={disabled}
              max={Math.max(1, totalMs)}
              min='0'
              onChange={(event) => seekAndSync(Number(event.currentTarget.value))}
              ref={inputRef}
              step='1'
            />
          </div>
          {onZoomChange ? (
            <TimelineZoomControls disabled={disabled} onFit={fitTimeline} onZoomChange={onZoomChange} pixelsPerSecond={pixelsPerSecond} />
          ) : null}
        </div>

        <div className='animation-timeline-status'>
          <output ref={outputRef}>{formatTime(currentMsRef.current)} / {formatTime(totalMs)}</output>
          <label>
            <span><T>Rate</T></span>
            <StudioSelect
              ariaLabel={gt('Playback rate')}
              className='h-8 w-20 font-mono text-xs'
              disabled={disabled}
              onValueChange={(value) => onRateChange(Number(value))}
              options={[0.1, 0.25, 0.5, 1, 2, 4].map((rate) => ({ label: `${rate}×`, value: String(rate) }))}
              value={String(playbackRate)}
            />
          </label>
        </div>
      </header>

      <div className='animation-timeline-scroll' ref={scrollRef}>
        <div className='animation-timeline-content' ref={contentRef} style={{ width: `${timelineWidth}px` }}>
          <div className='animation-storyboard-track' data-timeline-axis-inset='10' data-timeline-scrub-surface>
            <div className='animation-timeline-playhead' ref={storyboardPlayheadRef}>
              <div
                aria-label={gt('Storyboard playhead')}
                aria-disabled={disabled}
                aria-orientation='horizontal'
                aria-valuemax={Math.round(totalMs)}
                aria-valuemin={0}
                aria-valuenow={Math.round(Math.min(currentMsRef.current, totalMs))}
                aria-valuetext={formatTime(currentMsRef.current)}
                className='animation-timeline-playhead-handle'
                data-timeline-playhead-handle
                onKeyDown={handlePlayheadKeyDown}
                onPointerCancel={endPlayheadDrag}
                onPointerDown={beginPlayheadDrag}
                onPointerMove={movePlayheadDrag}
                onPointerUp={endPlayheadDrag}
                role='slider'
                tabIndex={disabled ? -1 : 0}
              >
                <span /><i />
              </div>
            </div>
            {sources.map((source, index) => {
              const selected = source.id === selectedSourceId;
              const nextSource = sources[(index + 1) % sources.length];
              const holdMs = layout.holds[index] ?? settings.holdMs;
              const transitionMs = layout.transitions[index] ?? 0;
              const segmentMs = Math.max(1, holdMs + transitionMs);
              const holdShare = `${(holdMs / segmentMs) * 100}%`;
              const sceneKeyframes = keyframes?.[source.id];
              const segmentColumns = transitionMs > 0
                ? `minmax(0, ${holdMs}fr) minmax(0, ${transitionMs}fr)`
                : 'minmax(0, 1fr)';
              const transitionSetting = transitionSettings[index];
              const transitionPreviewSettings = transitionSetting
                ? { ...settings, ...transitionSetting }
                : settings;
              const packagePresentation = animationPackagePresentation(
                transitionSetting?.packageId ?? settings.packageId
              );
              return (
                <article
                  className={`animation-storyboard-segment ${timelineStyles.segment}`}
                  data-scene-index={index}
                  key={source.id}
                  style={{ flex: `${segmentMs} 0 0px`, gridTemplateColumns: segmentColumns, minWidth: 0 }}
                >
                  <StudioPreviewTooltip
                    preview={(
                      <AnimationSequenceTooltipPreview count={sources.length} index={index} kind='frame'>
                        <AnimationTimelinePreview index={index} kind='frame' layout='tooltip' settings={settings} sources={previewSources} />
                      </AnimationSequenceTooltipPreview>
                    )}
                    size='compact'
                    title={sourceLabel(source)}
                  >
                    <button
                      aria-keyshortcuts='Shift+F10'
                      aria-label={`${gt('Edit frame')} ${index + 1}: ${sourceLabel(source)}`}
                      className='animation-storyboard-frame'
                      data-studio-context-trigger='timeline-frame'
                      data-selected={selected ? 'true' : 'false'}
                      onClick={() => {
                        // The host parks the playhead where the scene reads as composed.
                        onSelectSource(source.id);
                        follow(sceneStart(index), true);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setTimelineMenu({ index, kind: 'frame', position: contextMenuPositionFromEvent(event) });
                      }}
                      onKeyDown={(event) => {
                        if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return;
                        event.preventDefault();
                        setTimelineMenu({ index, kind: 'frame', position: contextMenuPositionFromElement(event.currentTarget) });
                      }}
                      type='button'
                    >
                      <AnimationTimelinePreview index={index} kind='frame' settings={settings} sources={previewSources} />
                      <span className='animation-storyboard-caption'>
                        <b>{String(index + 1).padStart(2, '0')}</b>
                        <strong>{sourceLabel(source)}</strong>
                        <small>{formatTime(holdMs)}</small>
                      </span>
                    </button>
                  </StudioPreviewTooltip>
                  {sources.length > 1 ? (
                    <StudioPreviewTooltip
                      preview={(
                        <AnimationSequenceTooltipPreview count={sources.length} index={index} kind='transition'>
                          <AnimationTimelinePreview index={index} kind='transition' layout='tooltip' settings={transitionPreviewSettings} sources={previewSources} />
                        </AnimationSequenceTooltipPreview>
                      )}
                      size='compact'
                      title={packagePresentation.label}
                    >
                      <button
                        aria-keyshortcuts='Shift+F10'
                        aria-label={`${gt('Preview transition to')} ${sourceLabel(nextSource ?? source)} · ${packagePresentation.label} · ${Math.round(transitionMs)}ms`}
                        aria-pressed={selectedTransitionIndex === index}
                        className='animation-storyboard-transition'
                        data-studio-context-trigger='timeline-transition'
                        onClick={() => {
                          onSelectTransition(index);
                          seekAndSync(transitionMidpoint(index));
                        }}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          setTimelineMenu({ index, kind: 'transition', position: contextMenuPositionFromEvent(event) });
                        }}
                        onKeyDown={(event) => {
                          if (!((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu')) return;
                          event.preventDefault();
                          setTimelineMenu({ index, kind: 'transition', position: contextMenuPositionFromElement(event.currentTarget) });
                        }}
                        type='button'
                      >
                        <AnimationTimelinePreview index={index} kind='transition' settings={transitionPreviewSettings} sources={previewSources} />
                        <span className='animation-storyboard-transition-caption'>
                          <b aria-hidden='true'>
                            {String(index + 1).padStart(2, '0')}→{String((index + 1) % sources.length + 1).padStart(2, '0')}
                          </b>
                          <strong>{packagePresentation.label}</strong>
                          {(transitionMs / 1000) * pixelsPerSecond >= 96 ? <small>{Math.round(transitionMs)}ms</small> : null}
                        </span>
                      </button>
                    </StudioPreviewTooltip>
                  ) : null}
                  {sceneKeyframes?.length && !presentationMode ? (
                    <div className={timelineStyles.keyLane} style={{ width: holdShare }}>
                      {sceneKeyframes.map((keyframe, keyIndex) => (
                        <KeyframeDiamond
                          atMs={keyframe.atMs}
                          current={selected}
                          disabled={disabled}
                          frameMs={frameDuration}
                          holdMs={holdMs}
                          id={keyframe.id}
                          key={keyframe.id}
                          label={`${gt('Scene')} ${index + 1} ${gt('keyframe')} ${keyIndex + 1} ${gt('at')} ${formatTime(keyframe.atMs)}`}
                          onRemove={(keyframeId) => onKeyframeRemove?.(source.id, keyframeId)}
                          onRetime={(keyframeId, atMs) => onKeyframeRetime?.(source.id, keyframeId, atMs)}
                          onSelect={(keyframeId) => {
                            onKeyframeSelect?.(source.id, keyframeId);
                            seekAndSync(sceneStart(index) + keyframe.atMs);
                          }}
                          pixelsPerMs={pixelsPerMs}
                        />
                      ))}
                    </div>
                  ) : null}
                  {onSceneTrim && !presentationMode ? (
                    <SceneTrimHandle
                      disabled={disabled}
                      frameMs={frameDuration}
                      holdMs={holdMs}
                      index={index}
                      label={`${gt('Scene')} ${index + 1} ${gt('duration')}`}
                      left={holdShare}
                      onCommit={onSceneTrim}
                      pixelsPerMs={pixelsPerMs}
                    />
                  ) : null}
                </article>
              );
            })}
          </div>

          {presentationMode ? null : (
            <AnimationAudioTrack
              audio={audio}
              onClipChange={onAudioClipChange}
              onFiles={onAudioFiles}
              onMutedChange={onAudioMutedChange}
              onPlayheadKeyDown={handlePlayheadKeyDown}
              onPlayheadPointerCancel={endPlayheadDrag}
              onPlayheadPointerDown={beginPlayheadDrag}
              onPlayheadPointerMove={movePlayheadDrag}
              onPlayheadPointerUp={endPlayheadDrag}
              onRemoveClip={onAudioRemoveClip}
              onSelectedClipChange={onAudioSelectedClipChange}
              onSplitClip={onAudioSplitClip}
              onVolumeChange={onAudioVolumeChange}
              playheadMs={Math.min(currentMsRef.current, totalMs)}
              playheadRef={audioPlayheadRef}
              segmentBoundaries={segmentBoundaries}
              selectedClipId={selectedAudioClipId}
              segmentCount={sources.length}
              totalMs={totalMs}
            />
          )}
        </div>
      </div>

      <StudioContextMenu
        detail={timelineMenu ? `${formatTime(sceneStart(timelineMenu.index))} on master timeline` : undefined}
        label={timelineMenu
          ? timelineMenu.kind === 'frame'
            ? `Frame ${timelineMenu.index + 1} · ${sourceLabel(sources[timelineMenu.index]!)}`
            : `${animationPackagePresentation(transitionSettings[timelineMenu.index]?.packageId ?? settings.packageId).label} transition`
          : gt('Timeline')}
        onClose={() => setTimelineMenu(null)}
        position={timelineMenu?.position ?? null}
        sections={timelineMenu ? timelineMenu.kind === 'frame' ? [
          {
            items: [
              {
                icon: <Frame aria-hidden='true' />,
                id: 'edit-frame',
                label: gt('Edit frame'),
                onSelect: () => onSelectSource(sources[timelineMenu.index]!.id),
              },
              {
                icon: <SkipForward aria-hidden='true' />,
                id: 'jump-frame',
                label: gt('Jump to frame start'),
                onSelect: () => seekAndSync(sceneStart(timelineMenu.index)),
              },
              {
                icon: <Play aria-hidden='true' />,
                id: 'play-frame',
                label: gt('Play from here'),
                onSelect: () => {
                  seekAndSync(sceneStart(timelineMenu.index));
                  onPlayChange(true);
                },
              },
            ],
          },
        ] : [
          {
            items: [
              {
                icon: <Frame aria-hidden='true' />,
                id: 'preview-transition',
                label: gt('Preview transition'),
                onSelect: () => seekAndSync(transitionMidpoint(timelineMenu.index)),
              },
              {
                icon: <Play aria-hidden='true' />,
                id: 'play-transition',
                label: gt('Play transition'),
                onSelect: () => {
                  seekAndSync(sequenceSceneTime(layout, timelineMenu.index, 'transition-start'));
                  onPlayChange(true);
                },
              },
              {
                icon: <SkipForward aria-hidden='true' />,
                id: 'edit-next-frame',
                label: gt('Edit next frame'),
                onSelect: () => onSelectSource(sources[(timelineMenu.index + 1) % sources.length]!.id),
              },
            ],
          },
        ] : []}
      />
    </section>
  );
}

export default memo(TimelinePanel);
