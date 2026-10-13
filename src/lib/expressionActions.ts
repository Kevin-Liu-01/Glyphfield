import type { ExpressionToolKind } from './expressionModel';

/**
 * Browser API action contracts for the expression tools. Kept free of
 * runtime imports so the shared capability map can spread them in.
 */

type Contract = { description: string; input: string; output: string };

const EXPORT_ARTIFACT = 'ExportPreviewAsset with a non-empty Blob and deterministic fileName; use studio.download(artifact) to save';

const SUBJECT: Record<ExpressionToolKind, string> = {
  blog: 'blog cover',
  opengraph: 'OpenGraph composition',
  partnership: 'partnership lockup',
  slides: 'active slide',
  terminal: 'terminal card',
};

function shared(kind: ExpressionToolKind): Record<string, Contract> {
  const subject = SUBJECT[kind];
  return {
    [`${kind}.document.describe`]: {
      description: `Describe the ${kind === 'slides' ? 'deck' : subject}: format, pages, layouts, and every layer with its id, kind, slot, bounds, visibility, and lock state (top layer first).`,
      input: 'No input',
      output: '{ format, formats, layouts, activePageId, selection, pages: [{ id, name, layout, surface, width, height, notes, layers }] }',
    },
    [`${kind}.export.svg`]: {
      description: `Render the ${subject} as a self-contained SVG with embedded images and fonts.`,
      input: 'No input',
      output: EXPORT_ARTIFACT,
    },
    [`${kind}.format.set`]: {
      description: 'Change the output format preset and re-flow every page; free layers scale with the page.',
      input: '{ format: string } using an id from document.describe().formats',
      output: 'null',
    },
    [`${kind}.history.redo`]: { description: 'Redo the last undone canvas change.', input: 'No input', output: 'boolean (false when nothing to redo)' },
    [`${kind}.history.undo`]: { description: 'Undo the last canvas change.', input: 'No input', output: 'boolean (false when nothing to undo)' },
    [`${kind}.layer.add`]: {
      description: 'Add a layer: text, image (identity library id or data:image URL), logo, shape, divider, shader (Shader Library still), texture, or brand device.',
      input: "{ kind: 'text' | 'image' | 'logo' | 'shape' | 'divider' | 'shader' | 'texture' | 'device', content?, bounds?, fill?, libraryAssetId?, dataUrl?, materialId?, device?, shape?: 'rect' | 'ellipse', variant?: 'mark' | 'wordmark' }",
      output: '{ id: string }',
    },
    [`${kind}.layer.align`]: {
      description: 'Align layers to an artboard edge or center.',
      input: "{ ids: string[], alignment: 'left' | 'horizontal-center' | 'right' | 'top' | 'vertical-center' | 'bottom' }",
      output: 'null',
    },
    [`${kind}.layer.duplicate`]: { description: 'Duplicate layers with a small offset and select the copies.', input: '{ ids: string[] }', output: '{ ids: string[] }' },
    [`${kind}.layer.remove`]: { description: 'Delete layers.', input: '{ ids: string[] }', output: 'null' },
    [`${kind}.layer.reorder`]: {
      description: 'Move a layer in the stack.',
      input: "{ id: string, to: 'forward' | 'backward' | 'front' | 'back' | number }",
      output: 'null',
    },
    [`${kind}.layer.select`]: { description: 'Select layers on the canvas and in the inspector.', input: '{ ids: string[] }', output: 'null' },
    [`${kind}.layer.update`]: {
      description: 'Edit a layer: text, bounds (x, y, width, height, rotation), opacity, visibility, lock, brand color role, type role, size, weight, tracking (em), line height, alignment, casing, or layer data.',
      input: '{ id, name?, content?, bounds?, opacity?, hidden?, locked?, fill?, fontRole?, fontSize?, fontWeight?, letterSpacing?, lineHeight?, align?, casing?, radius?, data? }',
      output: 'null',
    },
    [`${kind}.layout.apply`]: {
      description: 'Re-flow a page into a layout variant. Content and hand-set styles stay; geometry follows the layout.',
      input: '{ layout: string, pageId?: string } using an id from document.describe().layouts',
      output: 'null',
    },
    [`${kind}.template.reset`]: {
      description: 'Start over from the identity\'s brand template for this tool.',
      input: 'No input',
      output: 'null',
    },
  };
}

export function expressionActionContracts(kind: ExpressionToolKind): Record<string, Contract> {
  const contracts = shared(kind);
  if (kind === 'slides') {
    Object.assign(contracts, {
      'slides.export.pdf': { description: 'Render every slide into one multi-page PDF (lossless page images).', input: 'No input', output: EXPORT_ARTIFACT },
      'slides.slide.add': { description: 'Add a slide after the active one using a layout.', input: '{ layout?: string, index?: number }', output: '{ pageId: string }' },
      'slides.slide.duplicate': { description: 'Duplicate a slide (default: active).', input: '{ pageId?: string }', output: '{ pageId: string }' },
      'slides.slide.move': { description: 'Move a slide to a new position.', input: '{ pageId: string, index: number }', output: 'null' },
      'slides.slide.remove': { description: 'Delete a slide; the deck keeps at least one.', input: '{ pageId: string }', output: 'null' },
      'slides.slide.select': { description: 'Show a slide on the canvas.', input: '{ pageId: string }', output: 'null' },
    });
  }
  if (kind === 'terminal') {
    Object.assign(contracts, {
      'terminal.tab.add': { description: 'Add a file tab to the code window and show it.', input: '{ name?: string, language?: string, code?: string }', output: '{ tabId: string }' },
      'terminal.tab.remove': { description: 'Remove a file tab; the window keeps at least one.', input: '{ tabId: string }', output: 'null' },
      'terminal.tab.select': { description: 'Show a file tab.', input: '{ tabId: string }', output: 'null' },
      'terminal.tab.update': { description: 'Edit a tab\'s name, language, code, or highlighted lines (1-based).', input: '{ tabId: string, name?, language?, code?, highlight?: number[] }', output: 'null' },
    });
  }
  if (kind === 'partnership') {
    Object.assign(contracts, {
      'partnership.partner.add': { description: 'Add a partner to the lockup from the partner list or as written text.', input: "{ partnerId?: string, kind?: 'logo' | 'text', label?: string }", output: '{ id: string }' },
      'partnership.partner.remove': { description: 'Remove a partner from the lockup; the active brand stays.', input: '{ id: string }', output: 'null' },
      'partnership.lockup.update': { description: 'Set lockup alignment rules.', input: "{ separator?: '×' | '+' | '/' | '|' | 'none', sizing?: 'optical' | 'height' | 'width', justify?: 'start' | 'center' | 'end', verticalAlign?: 'center' | 'top' | 'bottom', gap?: number, tone?: 'original' | 'mono' }", output: 'null' },
    });
  }
  return contracts;
}
