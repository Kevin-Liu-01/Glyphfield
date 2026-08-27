import { describe, expect, it, vi } from 'vitest';

import { copyTextToClipboard } from '@/lib/clipboard';

function fallbackDocument(copyResult = true) {
  const textarea = {
    focus: vi.fn(),
    remove: vi.fn(),
    select: vi.fn(),
    setAttribute: vi.fn(),
    style: {},
    value: '',
  };
  const append = vi.fn();
  const execCommand = vi.fn(() => copyResult);
  return {
    document: {
      activeElement: null,
      body: { append },
      createElement: vi.fn(() => textarea),
      execCommand,
      getSelection: vi.fn(() => null),
    } as unknown as Document,
    execCommand,
    textarea,
  };
}

describe('copyTextToClipboard', () => {
  it('uses the asynchronous Clipboard API when available', async () => {
    const writeText = vi.fn(async () => undefined);
    await copyTextToClipboard('asset recipe', { clipboard: { writeText } });
    expect(writeText).toHaveBeenCalledWith('asset recipe');
  });

  it('falls back to the browser copy command when clipboard permission is denied', async () => {
    const fallback = fallbackDocument();
    const writeText = vi.fn(async () => { throw new Error('Permission denied'); });
    await copyTextToClipboard('data:image/png;base64,asset', {
      clipboard: { writeText },
      document: fallback.document,
    });
    expect(fallback.textarea.value).toBe('data:image/png;base64,asset');
    expect(fallback.execCommand).toHaveBeenCalledWith('copy');
    expect(fallback.textarea.remove).toHaveBeenCalledOnce();
  });

  it('reports a copy failure instead of claiming success', async () => {
    const fallback = fallbackDocument(false);
    await expect(copyTextToClipboard('source', {
      clipboard: null,
      document: fallback.document,
    })).rejects.toThrow('Clipboard access was denied.');
  });
});
