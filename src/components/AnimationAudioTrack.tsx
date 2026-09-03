'use client';

import { T, useGT } from 'gt-next';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

import { Button } from '@/components/ui/Button';
import StudioRange from '@/components/ui/StudioRange';
import {
  ChevronDown,
  ChevronRight,
  Music,
  Plus,
  Scissors,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
} from '@/components/ui/SolidIcons';
import {
  MIN_AUDIO_CLIP_MS,
  animationAudioClipDurationMs,
  type AnimationAudioClip,
  type AnimationAudioState,
} from '@/lib/animationAudio';

type DragKind = 'move' | 'trim-end' | 'trim-start';

type DragSession = {
  clip: AnimationAudioClip;
  frame: number;
  kind: DragKind;
  laneWidth: number;
  latestClientX: number;
  pointerId: number;
  startClientX: number;
};

type AnimationAudioTrackProps = {
  audio: AnimationAudioState;
  onClipChange: (clipId: string, patch: Partial<AnimationAudioClip>) => void;
  onFiles: (files: FileList) => void;
  onMutedChange: (muted: boolean) => void;
  onRemoveClip: (clipId: string) => void;
  onSelectedClipChange: (clipId: string | null) => void;
  onSplitClip: (clipId: string) => void;
  onVolumeChange: (volume: number) => void;
  selectedClipId: string | null;
  totalMs: number;
};

function formatDuration(timeMs: number): string {
  return `${(Math.max(0, timeMs) / 1000).toFixed(2)}s`;
}

function waveformPeaks(assetPeaks: readonly number[], clip: AnimationAudioClip, assetDurationMs: number) {
  if (assetPeaks.length === 0 || assetDurationMs <= 0) return [];
  const start = Math.floor(clip.trimStartMs / assetDurationMs * assetPeaks.length);
  const end = Math.max(start + 1, Math.ceil(clip.trimEndMs / assetDurationMs * assetPeaks.length));
  return assetPeaks.slice(start, end);
}

export default function AnimationAudioTrack({
  audio,
  onClipChange,
  onFiles,
  onMutedChange,
  onRemoveClip,
  onSelectedClipChange,
  onSplitClip,
  onVolumeChange,
  selectedClipId,
  totalMs,
}: AnimationAudioTrackProps) {
  const gt = useGT();
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const laneRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const selectedClip = audio.clips.find(({ id }) => id === selectedClipId) ?? null;
  const selectedAsset = selectedClip
    ? audio.assets.find(({ id }) => id === selectedClip.assetId) ?? null
    : null;

  function applyDrag(session: DragSession) {
    const deltaMs = (session.latestClientX - session.startClientX) / session.laneWidth * totalMs;
    const durationMs = animationAudioClipDurationMs(session.clip);
    if (session.kind === 'move') {
      onClipChange(session.clip.id, {
        timelineStartMs: Math.min(
          Math.max(0, session.clip.timelineStartMs + deltaMs),
          Math.max(0, totalMs - durationMs)
        ),
      });
      return;
    }
    if (session.kind === 'trim-start') {
      const clampedDelta = Math.min(
        durationMs - MIN_AUDIO_CLIP_MS,
        Math.max(-Math.min(session.clip.timelineStartMs, session.clip.trimStartMs), deltaMs)
      );
      onClipChange(session.clip.id, {
        timelineStartMs: session.clip.timelineStartMs + clampedDelta,
        trimStartMs: session.clip.trimStartMs + clampedDelta,
      });
      return;
    }
    const asset = audio.assets.find(({ id }) => id === session.clip.assetId);
    if (!asset) return;
    onClipChange(session.clip.id, {
      trimEndMs: Math.min(
        asset.durationMs,
        Math.max(session.clip.trimStartMs + MIN_AUDIO_CLIP_MS, session.clip.trimEndMs + deltaMs)
      ),
    });
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLElement>,
    clip: AnimationAudioClip,
    kind: DragKind
  ) {
    if (event.button !== 0 || !laneRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectedClipChange(clip.id);
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      clip,
      frame: 0,
      kind,
      laneWidth: Math.max(1, laneRef.current.getBoundingClientRect().width),
      latestClientX: event.clientX,
      pointerId: event.pointerId,
      startClientX: event.clientX,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    session.latestClientX = event.clientX;
    if (session.frame) return;
    session.frame = requestAnimationFrame(() => {
      session.frame = 0;
      applyDrag(session);
    });
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const session = dragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (session.frame) cancelAnimationFrame(session.frame);
    session.latestClientX = event.clientX;
    applyDrag(session);
    dragRef.current = null;
  }

  return (
    <section className='animation-audio-track' aria-label={gt('Audio track')} data-expanded={expanded ? 'true' : 'false'}>
      <header className='animation-audio-track-header'>
        <button
          aria-expanded={expanded}
          className='animation-audio-track-title'
          onClick={() => setExpanded((current) => !current)}
          type='button'
        >
          <Music aria-hidden='true' />
          <span><T>Audio</T></span>
          <small>{audio.clips.length ? `${audio.clips.length} ${audio.clips.length === 1 ? 'clip' : 'clips'}` : <T>Optional for MP4</T>}</small>
          {expanded ? <ChevronDown aria-hidden='true' /> : <ChevronRight aria-hidden='true' />}
        </button>
        {expanded ? <div className='animation-audio-track-actions'>
          <input
            accept='audio/*'
            className='sr-only'
            multiple
            onChange={(event) => {
              if (event.currentTarget.files?.length) onFiles(event.currentTarget.files);
              event.currentTarget.value = '';
            }}
            ref={fileInputRef}
            type='file'
          />
          <Button onClick={() => fileInputRef.current?.click()} size='sm' type='button' variant='outline'>
            <Plus aria-hidden='true' /><T>Add audio</T>
          </Button>
          <Button
            aria-label={gt('Split selected audio clip at the playhead')}
            disabled={!selectedClip}
            onClick={() => selectedClip && onSplitClip(selectedClip.id)}
            size='sm'
            type='button'
            variant='outline'
          >
            <Scissors aria-hidden='true' /><T>Split</T>
          </Button>
          <Button
            aria-label={audio.muted ? gt('Unmute audio') : gt('Mute audio')}
            aria-pressed={audio.muted}
            onClick={() => onMutedChange(!audio.muted)}
            size='icon-sm'
            type='button'
            variant='outline'
          >
            {audio.muted ? <VolumeX aria-hidden='true' /> : <Volume2 aria-hidden='true' />}
          </Button>
          <label className='animation-audio-master-volume'>
            <span className='sr-only'><T>Master audio volume</T></span>
            <input
              aria-label={gt('Master audio volume')}
              max='1'
              min='0'
              onChange={(event) => onVolumeChange(Number(event.currentTarget.value))}
              step='0.01'
              value={audio.volume}
            />
          </label>
        </div> : null}
      </header>

      {expanded ? <><div
        className='animation-audio-lane'
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (event.dataTransfer.files.length) onFiles(event.dataTransfer.files);
        }}
        onPointerDown={() => onSelectedClipChange(null)}
        ref={laneRef}
      >
        {audio.clips.length === 0 ? (
          <button className='animation-audio-empty' onClick={() => fileInputRef.current?.click()} type='button'>
            <Upload aria-hidden='true' />
            <span><T>Drop audio here or choose a file</T></span>
            <small><T>Position, trim, and split it against the playhead.</T></small>
          </button>
        ) : audio.clips.map((clip) => {
          const asset = audio.assets.find(({ id }) => id === clip.assetId);
          if (!asset) return null;
          const peaks = waveformPeaks(asset.peaks, clip, asset.durationMs);
          const selected = clip.id === selectedClipId;
          const visibleDurationMs = Math.min(
            animationAudioClipDurationMs(clip),
            Math.max(MIN_AUDIO_CLIP_MS, totalMs - clip.timelineStartMs)
          );
          return (
            <div
              className='animation-audio-clip'
              data-selected={selected ? 'true' : 'false'}
              key={clip.id}
              onPointerDown={(event) => event.stopPropagation()}
              style={{
                left: `${clip.timelineStartMs / Math.max(1, totalMs) * 100}%`,
                width: `${visibleDurationMs / Math.max(1, totalMs) * 100}%`,
              }}
            >
              <button
                aria-label={`${gt('Move audio clip')} ${asset.name}`}
                className='animation-audio-clip-body'
                onClick={() => onSelectedClipChange(clip.id)}
                onPointerDown={(event) => beginDrag(event, clip, 'move')}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                type='button'
              >
                <span className='animation-audio-waveform' aria-hidden='true'>
                  {peaks.map((peak, index) => (
                    <i key={`${clip.id}:${index}`} style={{ height: `${Math.max(8, peak * 86)}%` }} />
                  ))}
                </span>
                <span className='animation-audio-clip-label'>{asset.name}</span>
                <small>{formatDuration(animationAudioClipDurationMs(clip))}</small>
              </button>
              <button
                aria-label={gt('Trim audio clip start')}
                className='animation-audio-trim animation-audio-trim-start'
                onPointerDown={(event) => beginDrag(event, clip, 'trim-start')}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                type='button'
              />
              <button
                aria-label={gt('Trim audio clip end')}
                className='animation-audio-trim animation-audio-trim-end'
                onPointerDown={(event) => beginDrag(event, clip, 'trim-end')}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                type='button'
              />
            </div>
          );
        })}
      </div>

      {selectedClip && selectedAsset ? (
        <div className='animation-audio-inspector'>
          <strong>{selectedAsset.name}</strong>
          <label>
            <span><T>Start</T></span>
            <input
              min='0'
              onChange={(event) => onClipChange(selectedClip.id, { timelineStartMs: Number(event.currentTarget.value) * 1000 })}
              step='0.01'
              type='number'
              value={(selectedClip.timelineStartMs / 1000).toFixed(2)}
            />
          </label>
          <label>
            <span><T>In</T></span>
            <input
              min='0'
              onChange={(event) => onClipChange(selectedClip.id, { trimStartMs: Number(event.currentTarget.value) * 1000 })}
              step='0.01'
              type='number'
              value={(selectedClip.trimStartMs / 1000).toFixed(2)}
            />
          </label>
          <label>
            <span><T>Out</T></span>
            <input
              min='0.1'
              onChange={(event) => onClipChange(selectedClip.id, { trimEndMs: Number(event.currentTarget.value) * 1000 })}
              step='0.01'
              type='number'
              value={(selectedClip.trimEndMs / 1000).toFixed(2)}
            />
          </label>
          <label>
            <span><T>Clip volume</T></span>
            <StudioRange
              max='1'
              min='0'
              onChange={(event) => onClipChange(selectedClip.id, { volume: Number(event.currentTarget.value) })}
              step='0.01'
              value={selectedClip.volume}
            />
          </label>
          <Button
            aria-label={gt('Delete selected audio clip')}
            onClick={() => onRemoveClip(selectedClip.id)}
            size='icon-sm'
            type='button'
            variant='outline'
          >
            <Trash2 aria-hidden='true' />
          </Button>
        </div>
      ) : null}</> : null}
    </section>
  );
}
