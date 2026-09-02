import {
  canvasElementAssetSource,
  isCanvasDocumentEnvelope,
  type CanvasDocument,
} from './canvasDocument';
import {
  DEFAULT_LIVE_MATERIAL_SETTINGS,
  normalizeLiveMaterialId,
  type LiveMaterialId,
  type LiveMaterialSettings,
} from './liveMaterials';
import type { LottieDocument } from './lottieExamples';
import {
  parseSourceObject,
  sourceBoolean,
  sourceNumber,
  sourceObject,
  sourceString,
} from './sourceCode';
import { parseStudioCanvasDocument } from './studioCanvasDocument';

type LottieCanvasPreset = 'landscape' | 'portrait' | 'square';
type LottieCanvasFit = 'contain' | 'cover' | 'fill' | 'fit-height' | 'fit-width' | 'none';
type LottieCanvasMode = 'bounce' | 'forward' | 'reverse' | 'reverse-bounce';
type LottieCanvasBackgroundStyle = 'gradient' | 'shader' | 'solid';

type LottieCanvasSource = {
  category: string;
  data: LottieDocument | null;
  description: string;
  fileName: string;
  format: 'dotlottie' | 'json';
  id: string;
  name: string;
  provenance: 'Glyphfield example' | 'Local import';
};

export type LottieCanvasState = {
  appearance: {
    accentColor: string;
    artColor: string;
    cornerRadius: number;
    secondaryColor: string;
    strokeWidth: number;
  };
  background: {
    color: string;
    materialId: LiveMaterialId;
    materialSettings: LiveMaterialSettings;
    style: LottieCanvasBackgroundStyle;
    transparent: boolean;
  };
  canvasPreset: LottieCanvasPreset;
  playback: {
    fit: LottieCanvasFit;
    interpolate: boolean;
    loop: boolean;
    mode: LottieCanvasMode;
    segmentEnd: number;
    segmentStart: number;
    speed: number;
  };
  source: LottieCanvasSource;
};

export type ParsedLottieWorkspaceSource = {
  binarySource: string | null;
  document: CanvasDocument | null;
  legacy: boolean;
  state: LottieCanvasState;
};

const LIVE_MATERIAL_NUMBER_KEYS = [
  'amplitude',
  'brightness',
  'centerX',
  'centerY',
  'density',
  'detail',
  'frequency',
  'grain',
  'rotationX',
  'rotationY',
  'rotationZ',
  'speed',
  'strength',
] as const;

export function parseLottieDocument(value: Record<string, unknown> | null): LottieDocument {
  if (!value || !Array.isArray(value.layers) || typeof value.fr !== 'number') {
    throw new TypeError('Lottie source must include a layers array and numeric frame rate.');
  }
  return value;
}

function liveMaterialSettings(
  value: Record<string, unknown> | null,
  fallback: LiveMaterialSettings
): LiveMaterialSettings {
  if (!value) return { ...fallback };
  const restored = { ...DEFAULT_LIVE_MATERIAL_SETTINGS, ...fallback };
  for (const key of LIVE_MATERIAL_NUMBER_KEYS) {
    restored[key] = sourceNumber(value, key, restored[key]);
  }
  restored.colorA = sourceString(value, 'colorA', restored.colorA);
  restored.colorB = sourceString(value, 'colorB', restored.colorB);
  restored.colorC = sourceString(value, 'colorC', restored.colorC);
  return restored;
}

function oneOf<T extends string>(
  value: string,
  allowed: readonly T[],
  message: string
): T {
  if (!allowed.includes(value as T)) throw new TypeError(message);
  return value as T;
}

/**
 * Restores either the shared portable composition or legacy raw Lottie JSON.
 * Binary bytes stay as an embedded data URL until the player boundary needs an ArrayBuffer.
 */
export function parseLottieWorkspaceSource(
  source: string,
  fallback: LottieCanvasState
): ParsedLottieWorkspaceSource {
  const root = parseSourceObject(source);
  if (!isCanvasDocumentEnvelope(root)) {
    return {
      binarySource: null,
      document: null,
      legacy: true,
      state: {
        ...fallback,
        source: {
          ...fallback.source,
          data: parseLottieDocument(root),
          fileName: fallback.source.fileName.replace(/\.lottie$/i, '.json'),
          format: 'json',
          provenance: 'Local import',
        },
      },
    };
  }

  const parsed = parseStudioCanvasDocument(source, 'lottie');
  const appearance = sourceObject(parsed.state, 'appearance') ?? {};
  const background = sourceObject(parsed.state, 'background') ?? {};
  const playback = sourceObject(parsed.state, 'playback') ?? {};
  const savedSource = sourceObject(parsed.state, 'source');
  if (!savedSource) throw new TypeError('Lottie source state is missing.');

  const format = oneOf(
    sourceString(savedSource, 'format', fallback.source.format),
    ['dotlottie', 'json'] as const,
    'Lottie format must be json or dotlottie.'
  );
  const canvasPreset = oneOf(
    sourceString(parsed.state, 'canvasPreset', fallback.canvasPreset),
    ['landscape', 'portrait', 'square'] as const,
    'Unknown Lottie canvas preset.'
  );
  const fit = oneOf(
    sourceString(playback, 'fit', fallback.playback.fit),
    ['contain', 'cover', 'fill', 'fit-height', 'fit-width', 'none'] as const,
    'Unknown Lottie fit mode.'
  );
  const mode = oneOf(
    sourceString(playback, 'mode', fallback.playback.mode),
    ['bounce', 'forward', 'reverse', 'reverse-bounce'] as const,
    'Unknown Lottie playback direction.'
  );
  const style = oneOf(
    sourceString(background, 'style', fallback.background.style),
    ['gradient', 'shader', 'solid'] as const,
    'Unknown Lottie background style.'
  );
  const binarySource = format === 'dotlottie'
    ? canvasElementAssetSource(parsed.document, 'lottie-animation')
    : null;
  if (format === 'dotlottie' && !binarySource) {
    throw new TypeError('The embedded .lottie bundle is missing.');
  }
  const data = format === 'json'
    ? parseLottieDocument(sourceObject(savedSource, 'data'))
    : null;

  return {
    binarySource,
    document: parsed.document,
    legacy: false,
    state: {
      appearance: {
        accentColor: sourceString(appearance, 'accentColor', fallback.appearance.accentColor),
        artColor: sourceString(appearance, 'artColor', fallback.appearance.artColor),
        cornerRadius: sourceNumber(appearance, 'cornerRadius', fallback.appearance.cornerRadius),
        secondaryColor: sourceString(appearance, 'secondaryColor', fallback.appearance.secondaryColor),
        strokeWidth: sourceNumber(appearance, 'strokeWidth', fallback.appearance.strokeWidth),
      },
      background: {
        color: sourceString(background, 'color', fallback.background.color),
        materialId: normalizeLiveMaterialId(sourceString(background, 'materialId', fallback.background.materialId)),
        materialSettings: liveMaterialSettings(
          sourceObject(background, 'materialSettings'),
          fallback.background.materialSettings
        ),
        style,
        transparent: sourceBoolean(background, 'transparent', fallback.background.transparent),
      },
      canvasPreset,
      playback: {
        fit,
        interpolate: sourceBoolean(playback, 'interpolate', fallback.playback.interpolate),
        loop: sourceBoolean(playback, 'loop', fallback.playback.loop),
        mode,
        segmentEnd: sourceNumber(playback, 'segmentEnd', fallback.playback.segmentEnd),
        segmentStart: sourceNumber(playback, 'segmentStart', fallback.playback.segmentStart),
        speed: sourceNumber(playback, 'speed', fallback.playback.speed),
      },
      source: {
        category: sourceString(savedSource, 'category', fallback.source.category),
        data,
        description: sourceString(savedSource, 'description', fallback.source.description),
        fileName: sourceString(savedSource, 'fileName', fallback.source.fileName),
        format,
        id: sourceString(savedSource, 'id', fallback.source.id),
        name: sourceString(savedSource, 'name', fallback.source.name),
        provenance: sourceString(savedSource, 'provenance', fallback.source.provenance) === 'Glyphfield example'
          ? 'Glyphfield example'
          : 'Local import',
      },
    },
  };
}
