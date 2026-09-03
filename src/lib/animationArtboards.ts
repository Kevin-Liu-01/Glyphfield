import type {
  StudioBackgroundSettings,
  StudioFrameSettings,
  StudioSettings,
} from './studio';
import { normalizeMaterialFinish } from './materialFinish';
import {
  STUDIO_ARTBOARD_PRESETS,
  studioArtboardPresetForSize,
} from './artboardSizes';
import {
  cloneAnimationAudioState,
  type AnimationAudioState,
} from './animationAudio';

export type AnimationArtboardId = `animation-artboard-${string}`;

export type AnimationArtboardSnapshot = {
  audio?: AnimationAudioState;
  backgroundOverrides: Record<string, boolean>;
  frameSettings: Record<string, StudioFrameSettings>;
  sequenceBackground: StudioBackgroundSettings;
  sequenceOrder: string[];
  settings: StudioSettings;
};

export type AnimationArtboard = {
  id: AnimationArtboardId;
  name: string;
  snapshot: AnimationArtboardSnapshot;
};

export type AnimationArtboardWorkspace = {
  activeArtboardId?: string;
  artboards?: unknown;
};

export const DEFAULT_ANIMATION_ARTBOARD_ID = 'animation-artboard-main' as AnimationArtboardId;

export const ANIMATION_ARTBOARD_PRESETS = STUDIO_ARTBOARD_PRESETS;

function cloneFrameSettings(frame: StudioFrameSettings): StudioFrameSettings {
  return {
    ...frame,
    background: {
      ...frame.background,
      finish: normalizeMaterialFinish(frame.background.finish),
      materialSettings: { ...frame.background.materialSettings },
    },
    finish: normalizeMaterialFinish(frame.finish),
    transition: frame.transition ? {
      ...frame.transition,
      bezier: [...frame.transition.bezier],
    } : undefined,
  };
}

export function cloneAnimationArtboardSnapshot(
  snapshot: AnimationArtboardSnapshot
): AnimationArtboardSnapshot {
  return {
    audio: snapshot.audio ? cloneAnimationAudioState(snapshot.audio) : undefined,
    backgroundOverrides: { ...snapshot.backgroundOverrides },
    frameSettings: Object.fromEntries(Object.entries(snapshot.frameSettings).map(([id, frame]) => [
      id,
      cloneFrameSettings(frame),
    ])),
    sequenceBackground: {
      ...snapshot.sequenceBackground,
      finish: normalizeMaterialFinish(snapshot.sequenceBackground.finish),
      materialSettings: { ...snapshot.sequenceBackground.materialSettings },
    },
    sequenceOrder: [...snapshot.sequenceOrder],
    settings: {
      ...snapshot.settings,
      bezier: [...snapshot.settings.bezier],
      shaderSettings: { ...snapshot.settings.shaderSettings },
    },
  };
}

export function animationArtboardPresetForSize(width: number, height: number) {
  return studioArtboardPresetForSize(width, height);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSnapshot(value: unknown): value is AnimationArtboardSnapshot {
  if (!isObject(value)) return false;
  if (value.audio !== undefined) {
    if (!isObject(value.audio) || !Array.isArray(value.audio.assets) || !Array.isArray(value.audio.clips)) {
      return false;
    }
  }
  if (!isObject(value.settings) || !isObject(value.settings.shaderSettings)) return false;
  if (!Number.isFinite(value.settings.width) || !Number.isFinite(value.settings.height)) return false;
  if (!Array.isArray(value.settings.bezier) || value.settings.bezier.length !== 4) return false;
  if (!value.settings.bezier.every((entry) => typeof entry === 'number' && Number.isFinite(entry))) return false;
  if (!isObject(value.frameSettings) || !isObject(value.sequenceBackground)) return false;
  if (!isObject(value.sequenceBackground.materialSettings)) return false;
  if (!Object.values(value.frameSettings).every((frame) => (
    isObject(frame)
    && isObject(frame.background)
    && isObject(frame.background.materialSettings)
    && isObject(frame.finish)
    && (frame.transition === undefined || (
      isObject(frame.transition)
      && typeof frame.transition.packageId === 'string'
      && (
        frame.transition.backgroundTransition === undefined
        || frame.transition.backgroundTransition === 'crossfade'
        || frame.transition.backgroundTransition === 'wipe'
        || frame.transition.backgroundTransition === 'radial'
      )
      && Array.isArray(frame.transition.bezier)
      && frame.transition.bezier.length === 4
      && frame.transition.bezier.every((entry) => typeof entry === 'number' && Number.isFinite(entry))
    ))
  ))) return false;
  if (!isObject(value.backgroundOverrides)) return false;
  return Array.isArray(value.sequenceOrder) && value.sequenceOrder.every((entry) => typeof entry === 'string');
}

function isArtboard(value: unknown): value is AnimationArtboard {
  return isObject(value)
    && typeof value.id === 'string'
    && value.id.startsWith('animation-artboard-')
    && typeof value.name === 'string'
    && isSnapshot(value.snapshot);
}

export function restoreAnimationArtboardWorkspace(
  workspace: AnimationArtboardWorkspace | undefined,
  activeSnapshot: AnimationArtboardSnapshot
): { activeArtboardId: AnimationArtboardId; artboards: AnimationArtboard[] } {
  const seen = new Set<string>();
  const incoming = Array.isArray(workspace?.artboards)
    ? workspace.artboards.flatMap((candidate) => {
        if (!isArtboard(candidate) || seen.has(candidate.id)) return [];
        seen.add(candidate.id);
        return [{
          id: candidate.id,
          name: candidate.name.trim().slice(0, 48) || 'Untitled animation',
          snapshot: cloneAnimationArtboardSnapshot(candidate.snapshot),
        }];
      })
    : [];
  const requestedId = workspace?.activeArtboardId;
  const activeArtboardId = incoming.some(({ id }) => id === requestedId)
    ? requestedId as AnimationArtboardId
    : incoming[0]?.id ?? DEFAULT_ANIMATION_ARTBOARD_ID;
  const artboards = incoming.length > 0
    ? incoming.map((artboard) => artboard.id === activeArtboardId
        ? { ...artboard, snapshot: cloneAnimationArtboardSnapshot(activeSnapshot) }
        : artboard)
    : [{
        id: activeArtboardId,
        name: `${animationArtboardPresetForSize(activeSnapshot.settings.width, activeSnapshot.settings.height)?.label ?? 'Custom'} animation`,
        snapshot: cloneAnimationArtboardSnapshot(activeSnapshot),
      }];
  return { activeArtboardId, artboards };
}

export function animationArtboardSnapshotSignature(snapshot: AnimationArtboardSnapshot): string {
  return JSON.stringify(snapshot);
}
