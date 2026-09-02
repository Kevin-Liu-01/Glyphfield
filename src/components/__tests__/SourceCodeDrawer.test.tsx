// @vitest-environment happy-dom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SourceCodeDrawer from '@/components/SourceCodeDrawer';

vi.mock('gt-next', () => ({
  T: ({ children }: { children: ReactNode }) => children,
  useGT: () => (message: string) => message,
}));

function editableSource(): HTMLTextAreaElement {
  const editor = document.querySelector<HTMLTextAreaElement>(
    'textarea[aria-label="Editable source code"]'
  );
  if (!editor) throw new Error('Missing source editor');
  return editor;
}

function actionButton(label: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')]
    .find((candidate) => candidate.textContent?.includes(label));
  if (!button) throw new Error(`Missing ${label} button`);
  return button;
}

describe('SourceCodeDrawer', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(() => root.unmount());
    document.body.replaceChildren();
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  async function render(source: string, onApply = vi.fn()) {
    await act(() => {
      root.render(
        <SourceCodeDrawer
          format='Canvas document · JSON'
          onApply={onApply}
          onClose={vi.fn()}
          source={source}
        />
      );
    });
    return onApply;
  }

  it('cleans rich-text spacing on paste and keeps validation actionable', async () => {
    const onApply = await render('{"original":true}');
    const editor = editableSource();
    const pasted = '{\n\u00a0\u00a0"version": 3\n}';

    editor.setSelectionRange(0, editor.value.length);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => pasted },
    });
    await act(async () => {
      editor.dispatchEvent(event);
      await new Promise((resolve) => setImmediate(resolve));
    });

    expect(event.defaultPrevented).toBe(true);
    expect(editor.value).toBe('{\n  "version": 3\n}');
    expect(document.querySelector('#source-code-diagnostic')).toMatchObject({
      textContent: 'Valid JSON · rich-text spacing cleaned on paste',
    });
    expect(document.body.textContent).not.toContain('Checking JSON');
    expect(actionButton('Apply code').disabled).toBe(false);

    await act(async () => {
      actionButton('Apply code').click();
      await new Promise((resolve) => setImmediate(resolve));
    });
    expect(onApply).toHaveBeenCalledWith('{\n  "version": 3\n}');
  });

  it('marks malformed source at once and disables application', async () => {
    await render('{\n  broken\n}');

    expect(editableSource().getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('#source-code-diagnostic')?.textContent).toContain(
      'Line 2, column 3'
    );
    expect(actionButton('Apply code').disabled).toBe(true);
  });
});
