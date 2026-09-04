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
import { animationPackagePresentation } from '@/components/AnimationPackageGallery';
import AnimationSequenceTooltipPreview from '@/components/AnimationSequenceTooltipPreview';
import AnimationTimelinePreview from '@/components/AnimationTimelinePreview';
import { Button } from '@/components/ui/Button';
import { Frame, Pause, Play, RotateCcw, SkipBack, SkipForward } from '@/components/ui/SolidIcons';
import StudioContextMenu, {
  contextMenuPositionFromElement,
  contextMenuPositionFromEvent,
  type StudioContextMenuPosition,
} from '@/components/ui/StudioContextMenu';
import StudioPreviewTooltip from '@/components/ui/StudioPreviewTooltip';
import StudioRange from '@/components/ui/StudioRange';
import StudioSelect from '@/components/ui/StudioSelect';
import { useCachedGT } from '@/hooks/useCachedGT';
import type { AnimationAudioClip, AnimationAudioState } from '@/lib/animationAudio';
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

type TimelinePanelProps = {
  audio: AnimationAudioState;
  currentMsRef: { current: number };
  isPlaying: boolean;
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
};

function formatTime(timeMs: number): string {
  return `${(Math.max(0, timeMs) / 1000).toFixed(2)}s`;
}

function sourceLabel(source: StudioSource): string {
  return source.kind === 'text' ? source.text : source.name;
}

export default function TimelinePanel({
  audio,
  currentMsRef,
  isPlaying,
  onAudioClipChange,
  onAudioFiles,
  onAudioMutedChange,
  onAudioRemoveClip,
  onAudioSelectedClipChange,
  onAudioSplitClip,
  onAudioVolumeChange,
  onPlayChange,
  onRateChange,
  onSeek,
  onSelectSource,
  onSelectTransition,
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
}: TimelinePanelProps) {
  const gt = useCachedGT();
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
  const frameDuration = 1000 / settings.fps;
  const effectiveTransitionMs = sources.length > 1 ? settings.transitionMs : 0;
  const timelineWidth = useMemo(() => Math.max(1, sources.length * 224 + 20), [sources.length]);
  const segmentColumns = sources.length > 1
    ? `minmax(0, ${settings.holdMs}fr) minmax(0, ${effectiveTransitionMs}fr)`
    : 'minmax(0, 1fr)';
  const syncPlayheadUi = useCallback((timeMs = currentMsRef.current) => {
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
  }, [currentMsRef, totalMs]);

  useEffect(() => subscribeToPlayhead(syncPlayheadUi), [subscribeToPlayhead, syncPlayheadUi]);

  function seekAndSync(timeMs: number) {
    onSeek(timeMs);
    syncPlayheadUi(timeMs);
  }

  function applyPlayheadDrag(session: PlayheadDragSession) {
    const progress = Math.min(1, Math.max(0, (session.latestClientX - session.axisLeft) / session.axisWidth));
    seekAndSync(progress * totalMs);
  }

  function beginPlayheadDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || playheadDragRef.current) return;
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
    <section className='animation-timeline' data-animation-storyboard data-scrubbing={isScrubbing ? 'true' : 'false'}>
      <header className='animation-timeline-toolbar'>
        <div className='animation-timeline-transport'>
          <Button aria-label={isPlaying ? gt('Pause preview') : gt('Play preview')} onClick={() => onPlayChange(!isPlaying)} size='icon-sm' type='button' variant='outline'>
            {isPlaying ? <Pause aria-hidden='true' /> : <Play aria-hidden='true' />}
          </Button>
          <Button aria-label={gt('Restart preview')} onClick={() => seekAndSync(0)} size='icon-sm' type='button' variant='outline'><RotateCcw aria-hidden='true' /></Button>
          <Button aria-label={gt('Previous frame')} onClick={() => seekAndSync(Math.max(0, currentMsRef.current - frameDuration))} size='icon-sm' type='button' variant='outline'><SkipBack aria-hidden='true' /></Button>
          <Button aria-label={gt('Next frame')} onClick={() => seekAndSync(Math.min(totalMs, currentMsRef.current + frameDuration))} size='icon-sm' type='button' variant='outline'><SkipForward aria-hidden='true' /></Button>
        </div>

        <div className='animation-timeline-storyboard-control'>
          <div className='animation-timeline-heading'>
            <strong><T>Storyboard</T></strong>
          </div>
          <div className='animation-timeline-scrubber'>
            <StudioRange
              aria-label={gt('Timeline playhead')}
              defaultValue={Math.min(currentMsRef.current, Math.max(1, totalMs))}
              max={Math.max(1, totalMs)}
              min='0'
              onChange={(event) => seekAndSync(Number(event.currentTarget.value))}
              ref={inputRef}
              step='1'
            />
          </div>
        </div>

        <div className='animation-timeline-status'>
          <output ref={outputRef}>{formatTime(currentMsRef.current)} / {formatTime(totalMs)}</output>
          <label>
            <span><T>Rate</T></span>
            <StudioSelect
              ariaLabel={gt('Playback rate')}
              className='h-8 w-20 font-mono text-xs'
              onValueChange={(value) => onRateChange(Number(value))}
              options={[0.1, 0.25, 0.5, 1, 2, 4].map((rate) => ({ label: `${rate}×`, value: String(rate) }))}
              value={String(playbackRate)}
            />
          </label>
        </div>
      </header>

      <div className='animation-timeline-scroll'>
        <div className='animation-timeline-content' style={{ width: `${timelineWidth}px` }}>
          <div className='animation-storyboard-track' data-timeline-axis-inset='10' data-timeline-scrub-surface>
            <div className='animation-timeline-playhead' ref={storyboardPlayheadRef}>
              <div
                aria-label={gt('Storyboard playhead')}
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
                tabIndex={0}
              >
                <span /><i />
              </div>
            </div>
            {sources.map((source, index) => {
              const selected = source.id === selectedSourceId;
              const nextSource = sources[(index + 1) % sources.length];
              const transitionSetting = transitionSettings[index];
              const transitionPreviewSettings = transitionSetting
                ? { ...settings, ...transitionSetting }
                : settings;
              const packagePresentation = animationPackagePresentation(
                transitionSetting?.packageId ?? settings.packageId
              );
              return (
                <article
                  className='animation-storyboard-segment'
                  key={source.id}
                  style={{ gridTemplateColumns: segmentColumns }}
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
                        onSelectSource(source.id);
                        seekAndSync(index * (settings.holdMs + effectiveTransitionMs));
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
                        <small>{formatTime(settings.holdMs)}</small>
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
                        aria-label={`${gt('Preview transition to')} ${sourceLabel(nextSource ?? source)} · ${packagePresentation.label} · ${settings.transitionMs}ms`}
                        aria-pressed={selectedTransitionIndex === index}
                        className='animation-storyboard-transition'
                        data-studio-context-trigger='timeline-transition'
                        onClick={() => {
                          onSelectTransition(index);
                          seekAndSync(index * (settings.holdMs + effectiveTransitionMs) + settings.holdMs + settings.transitionMs / 2);
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
                          <small>{settings.transitionMs}ms</small>
                        </span>
                      </button>
                    </StudioPreviewTooltip>
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
              selectedClipId={selectedAudioClipId}
              segmentCount={sources.length}
              totalMs={totalMs}
            />
          )}
        </div>
      </div>

      <StudioContextMenu
        detail={timelineMenu ? `${formatTime(timelineMenu.index * (settings.holdMs + effectiveTransitionMs))} on master timeline` : undefined}
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
                onSelect: () => seekAndSync(timelineMenu.index * (settings.holdMs + effectiveTransitionMs)),
              },
              {
                icon: <Play aria-hidden='true' />,
                id: 'play-frame',
                label: gt('Play from here'),
                onSelect: () => {
                  seekAndSync(timelineMenu.index * (settings.holdMs + effectiveTransitionMs));
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
                onSelect: () => seekAndSync(timelineMenu.index * (settings.holdMs + effectiveTransitionMs) + settings.holdMs + settings.transitionMs / 2),
              },
              {
                icon: <Play aria-hidden='true' />,
                id: 'play-transition',
                label: gt('Play transition'),
                onSelect: () => {
                  seekAndSync(timelineMenu.index * (settings.holdMs + effectiveTransitionMs) + settings.holdMs);
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
