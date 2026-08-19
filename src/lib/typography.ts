export const MAX_VISIBLE_FONT_WEIGHT = 550;

export type TypographyPreviewRole = 'Display' | 'Body' | 'Accent' | 'Code';

export const TYPOGRAPHY_PREVIEW_DEFAULT_SIZES = {
  Accent: 32,
  Body: 24,
  Code: 18,
  Display: 40,
} as const satisfies Record<TypographyPreviewRole, number>;

export const TYPOGRAPHY_PREVIEW_MAX_SIZES = {
  Accent: 36,
  Body: 30,
  Code: 24,
  Display: 44,
} as const satisfies Record<TypographyPreviewRole, number>;

export function clampTypographyPreviewSize(role: TypographyPreviewRole, fontSize: number): number {
  const boundedSize = Number.isFinite(fontSize) ? fontSize : TYPOGRAPHY_PREVIEW_DEFAULT_SIZES[role];
  return Math.max(10, Math.min(TYPOGRAPHY_PREVIEW_MAX_SIZES[role], boundedSize));
}

export function capVisibleFontWeight(fontWeight: number): number {
  return Math.min(fontWeight, MAX_VISIBLE_FONT_WEIGHT);
}

export type TypingMeasurement = {
  characters: number;
  lines: number;
  seconds: number;
  words: number;
  wordsPerMinute: number;
};

export function measureTypingSample(text: string, elapsedMs: number): TypingMeasurement {
  const characters = Array.from(text).length;
  const words = text.trim() ? text.trim().split(/\s+/u).length : 0;
  const lines = text ? text.split(/\r?\n/u).length : 0;
  const minutes = Math.max(0, elapsedMs) / 60_000;

  return {
    characters,
    lines,
    seconds: Math.floor(Math.max(0, elapsedMs) / 1000),
    words,
    wordsPerMinute: minutes > 0 && characters > 0
      ? Math.round(characters / 5 / minutes)
      : 0,
  };
}
