import { LOGO_ARTWORK, type LogoInkBox } from './logoArtwork';

/**
 * Type and logo proportions for expression formats: one modular scale per
 * format, tracking tuned to the size it is set at, and logos sized by the ink
 * they show rather than the box their file declares.
 */

export const TYPE_STEPS = ['caption', 'body', 'lead', 'subhead', 'headline', 'title', 'hero'] as const;
export type TypeStep = (typeof TYPE_STEPS)[number];
export type ExpressionTypeScale = Readonly<Record<TypeStep, number>>;

/** Perfect fourth. */
export const TYPE_RATIO = 4 / 3;

/**
 * Body size as a share of √(width × height). Social cards are read as small
 * thumbnails, so their body runs larger than a slide's. A 1600 × 900 slide
 * gets a 67px title (7.4% of the height) and a 50px content headline.
 */
const BODY_SHARE = { slides: 0.0176, social: 0.0212 } as const;

export function expressionTypeScale(format: 'slides' | 'social', width: number, height: number): ExpressionTypeScale {
  const body = Math.sqrt(width * height) * BODY_SHARE[format];
  const entries = TYPE_STEPS.map((step, index) => [step, Math.round(body * TYPE_RATIO ** (index - 1))] as const);
  return Object.fromEntries(entries) as Record<TypeStep, number>;
}

/**
 * Letter spacing in em for text set at `size`: tighter as display grows, zero
 * at reading sizes, never positive. Capitals take half the tightening, and
 * monospaced code keeps its designed spacing.
 */
export function trackingFor(size: number, scale: ExpressionTypeScale, options: { code?: boolean; uppercase?: boolean } = {}): number {
  if (options.code) return 0;
  const tracking = size >= scale.title ? -0.022
    : size >= scale.headline ? -0.018
      : size >= scale.subhead ? -0.014
        : size >= scale.lead ? -0.008
          : 0;
  return options.uppercase ? tracking / 2 : tracking;
}

// ---------------------------------------------------------------------------
// Logos

export type LogoArtwork = { aspect: number; ink: LogoInkBox };

/** Bundled artwork for a public logo path; uploads have no record and fill their box. */
export function logoArtwork(source: string | undefined | null): LogoArtwork | null {
  return source ? LOGO_ARTWORK[source] ?? null : null;
}

/** Render-context lookup from a document's asset records to bundled logo artwork. */
export function assetArtworkLookup(assets: Readonly<Record<string, { source: string }>>) {
  return (assetId: string | undefined): LogoArtwork | null => (assetId ? logoArtwork(assets[assetId]?.source) : null);
}

/** Width / height of the visible ink, given the artwork's own aspect. */
export function inkAspect(aspect: number, ink: LogoInkBox): number {
  const width = Math.max(0.01, ink[2] - ink[0]);
  const height = Math.max(0.01, ink[3] - ink[1]);
  return (aspect * width) / height;
}

/**
 * Size a logo's ink box. `base` is the height a square mark would get; wider
 * marks get less height and more width (height ∝ aspect^-0.4), so a wordmark
 * and a monogram carry similar optical weight. Width is capped at `maxWidth`.
 */
export function opticalLogoSize(aspect: number, base: number, maxWidth = Number.POSITIVE_INFINITY): { height: number; width: number } {
  const safe = Math.max(0.2, aspect);
  let height = base * safe ** -0.4;
  let width = height * safe;
  if (width > maxWidth) {
    width = maxWidth;
    height = width / safe;
  }
  return { height: Math.round(height), width: Math.round(width) };
}

/**
 * Place an image so its ink fills `box` (contained, aligned on the cross axis
 * by `align`). Returns the full artwork rectangle to draw.
 */
export function placeInk(
  box: { height: number; width: number; x: number; y: number },
  aspect: number,
  ink: LogoInkBox,
  align: 'center' | 'end' | 'start' = 'center'
): { height: number; width: number; x: number; y: number } {
  const visibleAspect = inkAspect(aspect, ink);
  const inkWidth = Math.min(box.width, box.height * visibleAspect);
  const inkHeight = inkWidth / visibleAspect;
  const inkX = align === 'start' ? box.x : align === 'end' ? box.x + box.width - inkWidth : box.x + (box.width - inkWidth) / 2;
  const inkY = box.y + (box.height - inkHeight) / 2;
  const width = inkWidth / Math.max(0.01, ink[2] - ink[0]);
  const height = inkHeight / Math.max(0.01, ink[3] - ink[1]);
  return { height, width, x: inkX - ink[0] * width, y: inkY - ink[1] * height };
}
