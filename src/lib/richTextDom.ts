import type { TextSelectionRange, TextStyleRun } from './richText';
import { textStyleSegments } from './richText';

/** Plain-text paste/Enter can introduce browser-owned divs and brs. */
export function editableTextValue(root: Node): string {
  if (root.nodeType === Node.TEXT_NODE) return root.textContent ?? '';
  let value = '';
  const children = Array.from(root.childNodes);
  children.forEach((child, index) => {
    if (child.nodeName === 'BR') { if (children.length > 1 || root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) value += '\n'; return; }
    const block = child.nodeName === 'DIV' || child.nodeName === 'P';
    const previousBlock = index > 0 && ['DIV', 'P'].includes(children[index - 1].nodeName);
    if (index > 0 && ((block && previousBlock) || ((block || previousBlock) && !value.endsWith('\n')))) value += '\n';
    value += editableTextValue(child);
  });
  return value.replace(/\r\n/g, '\n');
}

export function readTextSelection(root: HTMLElement): TextSelectionRange | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const offset = (node: Node, position: number) => {
    const prefix = document.createRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(node, position);
    return editableTextValue(prefix.cloneContents()).length;
  };
  return { start: offset(range.startContainer, range.startOffset), end: offset(range.endContainer, range.endOffset),
    ...(!range.collapsed && selection.anchorNode === range.endContainer && selection.anchorOffset === range.endOffset ? { backward: true } : {}) };
}

export function restoreTextSelection(root: HTMLElement, selection: TextSelectionRange) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const nodes: Node[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.nodeType === Node.TEXT_NODE || node.nodeName === 'BR') nodes.push(node);
  }
  const point = (offset: number): [Node, number] => {
    for (const node of nodes) {
      if (node.nodeName === 'BR') {
        const index = Array.from(node.parentNode!.childNodes).indexOf(node as ChildNode);
        if (offset === 0) return [node.parentNode!, index];
        offset--;
        if (offset === 0) return [node.parentNode!, index + 1];
      } else {
        const length = node.textContent?.length ?? 0;
        if (offset <= length) return [node, offset];
        offset -= length;
      }
    }
    return [root, root.childNodes.length];
  };
  const range = document.createRange();
  range.setStart(...point(selection.start));
  range.setEnd(...point(selection.end));
  window.getSelection()?.removeAllRanges();
  window.getSelection()?.addRange(range);
  if (selection.backward) window.getSelection()?.setBaseAndExtent(range.endContainer, range.endOffset, range.startContainer, range.startOffset);
}

export function renderTextRuns(root: HTMLElement, value: string, runs: readonly TextStyleRun[], resolveStyle: (style: TextStyleRun['style']) => Partial<CSSStyleDeclaration>) {
  if (!runs.length) {
    // Keep the proven native plain-text layout (including BR paragraph breaks).
    root.innerText = value;
    return;
  }
  const children = textStyleSegments(value, runs).map(({ start, end, style }) => {
    const span = document.createElement('span');
    span.dataset.textRun = String(start);
    Object.assign(span.style, resolveStyle(style));
    span.textContent = value.slice(start, end);
    return span;
  });
  root.replaceChildren(...children);
}
