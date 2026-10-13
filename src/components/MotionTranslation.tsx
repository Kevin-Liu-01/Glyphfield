'use client';

import { createContext, useContext } from 'react';

import type { useCachedGT } from '@/hooks/useCachedGT';

type MotionGT = ReturnType<typeof useCachedGT>;

/**
 * One cached translator per Motion editor. General Translation resolves the
 * locale from cookies on every hook call, so dozens of scene rows, storyboard
 * cards, and inspector groups read the editor's translator from context instead
 * of each calling the locale hooks on every scrub or slider tick.
 */
export const MotionTranslationContext = createContext<MotionGT | null>(null);

/** Outside a Motion editor (isolated tests), strings pass through with `{name}` interpolation. */
const passthrough = ((message: string, options?: Record<string, unknown>) => (
  options ? message.replace(/\{(\w+)\}/g, (match, key: string) => (key in options ? String(options[key]) : match)) : message
)) as MotionGT;

export function useMotionGT(): MotionGT {
  return useContext(MotionTranslationContext) ?? passthrough;
}
