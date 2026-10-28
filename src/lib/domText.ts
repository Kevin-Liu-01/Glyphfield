/**
 * Rewrites an element's single text node in place. Replacing the node is a DOM
 * insertion, which re-runs every `:has()` rule on its ancestors up to `<html>`.
 */
export function writeText(element: HTMLElement | null, text: string) {
  if (!element) return;
  const node = element.firstChild;
  if (node instanceof Text && node === element.lastChild) {
    if (node.data !== text) node.data = text;
    return;
  }
  element.textContent = text;
}
