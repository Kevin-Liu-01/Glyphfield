type ClipboardEnvironment = {
  clipboard?: Pick<Clipboard, 'writeText'> | null;
  document?: Document;
};

export async function copyTextToClipboard(
  text: string,
  environment: ClipboardEnvironment = {}
): Promise<void> {
  const clipboard = environment.clipboard === undefined
    ? globalThis.navigator?.clipboard
    : environment.clipboard;
  const documentTarget = environment.document ?? globalThis.document;
  let clipboardError: unknown;

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return;
    } catch (error) {
      clipboardError = error;
    }
  }

  if (!documentTarget?.body || typeof documentTarget.execCommand !== 'function') {
    throw clipboardError instanceof Error
      ? clipboardError
      : new Error('Clipboard access is unavailable.');
  }

  const activeElement = typeof HTMLElement !== 'undefined'
    && documentTarget.activeElement instanceof HTMLElement
    ? documentTarget.activeElement
    : null;
  const selection = documentTarget.getSelection?.();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  const textarea = documentTarget.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  Object.assign(textarea.style, {
    height: '1px',
    left: '-9999px',
    opacity: '0',
    pointerEvents: 'none',
    position: 'fixed',
    top: '0',
    width: '1px',
  });
  documentTarget.body.append(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    copied = documentTarget.execCommand('copy');
  } finally {
    textarea.remove();
    selection?.removeAllRanges();
    ranges.forEach((range) => selection?.addRange(range));
    activeElement?.focus();
  }

  if (!copied) {
    throw clipboardError instanceof Error
      ? clipboardError
      : new Error('Clipboard access was denied.');
  }
}
