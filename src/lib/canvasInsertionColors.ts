/**
 * Sample the theme owner's resolved root class only when inserting content.
 * Persist these literal colors on the new layer; never use them to render or
 * normalize existing artwork, which must not follow later theme changes.
 */
export function canvasInsertionColors() {
  const light = document.documentElement.classList.contains('light');
  return {
    color: light ? '#000000' : '#FFFFFF',
    outlineColor: light ? '#FFFFFF' : '#000000',
  };
}
