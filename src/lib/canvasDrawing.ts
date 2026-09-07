/** Loads an image for canvas composition and asks the browser to decode it off the main path. */
export function loadCanvasImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

/** Paints a source edge-to-edge while preserving its intrinsic aspect ratio. */
export function drawCanvasImageCover(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number
) {
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  context.drawImage(source, (width - drawnWidth) / 2, (height - drawnHeight) / 2, drawnWidth, drawnHeight);
}

/** Scale a configured font without parsing a different CSS font for every glyph.
 * Coordinates are CSS pixels; glyphScale is relative to the context's font size.
 * Like other canvas primitives, this leaves its transform in the caller's context.
 */
export function drawCanvasGlyph(
  context: CanvasRenderingContext2D,
  glyph: string,
  x: number,
  y: number,
  glyphScale: number,
  pixelRatio: number
) {
  const scale = pixelRatio * glyphScale;
  context.setTransform(scale, 0, 0, scale, x * pixelRatio, y * pixelRatio);
  context.fillText(glyph, 0, 0);
}
