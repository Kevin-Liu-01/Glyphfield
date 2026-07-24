export const MAX_VISIBLE_FONT_WEIGHT = 550;

export function capVisibleFontWeight(fontWeight: number): number {
  return Math.min(fontWeight, MAX_VISIBLE_FONT_WEIGHT);
}
