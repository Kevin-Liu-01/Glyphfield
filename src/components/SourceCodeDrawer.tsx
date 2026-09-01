'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type UIEvent,
} from 'react';
import { T, useGT } from 'gt-next';
import {
  AlertCircle,
  Braces,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  RotateCcw,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';
import { highlightCode } from '@/lib/codeHighlight';
import { copyTextToClipboard } from '@/lib/clipboard';
import { formatSource, inspectSourceText } from '@/lib/sourceCode';
import { registerStudioAutomation } from '@/lib/studioAutomation';

const DEFAULT_DRAWER_WIDTH = 560;
const MIN_DRAWER_WIDTH = 360;
const MAX_DRAWER_WIDTH = 880;
const DRAWER_WIDTH_STORAGE_KEY = 'glyphfield:source-code-drawer:width';
const INDENT = '  ';

function clampDrawerWidth(width: number) {
  return Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, width));
}

function sourceSize(value: string): string {
  const bytes = new TextEncoder().encode(value).length;
  if (bytes < 1_024) return `${bytes} B`;
  const kilobytes = bytes / 1_024;
  return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
}

export function SourceCodeButton({ onClick }: { onClick: () => void }) {
  const gt = useGT();

  return (
    <Button
      aria-label={gt('Edit source code')}
      onClick={onClick}
      title={gt('Edit source code')}
      type='button'
      variant='outline'
    >
      <Code2 aria-hidden='true' />
      <span className='responsive-toolbar-label'><T>Code</T></span>
    </Button>
  );
}

export default function SourceCodeDrawer({
  format,
  onApply,
  onClose,
  source,
  title,
}: {
  format: string;
  onApply: (source: string) => void;
  onClose: () => void;
  source: string;
  title?: string;
}) {
  const gt = useGT();
  const [draft, setDraft] = useState(source);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState(DEFAULT_DRAWER_WIDTH);
  const [resizing, setResizing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const diagnostic = useMemo(() => inspectSourceText(draft), [draft]);
  const highlightedLines = useMemo(() => highlightCode(draft, 'json'), [draft]);
  const lineCount = highlightedLines.length;
  const visibleError = error ?? (diagnostic.valid ? null : diagnostic.message);
  const dragRef = useRef({
    currentWidth: DEFAULT_DRAWER_WIDTH,
    pointerId: 0,
    startWidth: DEFAULT_DRAWER_WIDTH,
    startX: 0,
  });

  useEffect(() => {
    const previousStudio = window.glyphfield?.studio;
    const toolId = previousStudio?.activeTool();
    if (!previousStudio || !toolId) return;
    return registerStudioAutomation({
      actions: previousStudio.describe().actions,
      applySource: onApply,
      getSource: () => source,
      invoke: previousStudio.invoke,
      toolId,
    });
  }, [onApply, source]);

  useMountEffect(() => {
    const storedValue = window.localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
    if (storedValue === null) return;
    const storedWidth = Number(storedValue);
    if (!Number.isFinite(storedWidth)) return;
    const nextWidth = clampDrawerWidth(storedWidth);
    dragRef.current.currentWidth = nextWidth;
    setWidth(nextWidth);
  });

  function updateWidth(nextWidth: number) {
    const clampedWidth = clampDrawerWidth(nextWidth);
    dragRef.current.currentWidth = clampedWidth;
    setWidth(clampedWidth);
    return clampedWidth;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      currentWidth: width,
      pointerId: event.pointerId,
      startWidth: width,
      startX: event.clientX,
    };
    setResizing(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!resizing || event.pointerId !== dragRef.current.pointerId) return;
    updateWidth(
      dragRef.current.startWidth - (event.clientX - dragRef.current.startX)
    );
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizing || event.pointerId !== dragRef.current.pointerId) return;
    setResizing(false);
    window.localStorage.setItem(
      DRAWER_WIDTH_STORAGE_KEY,
      String(dragRef.current.currentWidth)
    );
  }

  function handleResizeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 32 : 8;
    let nextWidth: number | null = null;
    if (event.key === 'Home') nextWidth = MIN_DRAWER_WIDTH;
    if (event.key === 'End') nextWidth = MAX_DRAWER_WIDTH;
    if (event.key === 'ArrowLeft') nextWidth = width + step;
    if (event.key === 'ArrowRight') nextWidth = width - step;
    if (nextWidth === null) return;
    event.preventDefault();
    const clampedWidth = updateWidth(nextWidth);
    window.localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(clampedWidth));
  }

  function syncEditorScroll(event: UIEvent<HTMLTextAreaElement>) {
    if (highlightRef.current) {
      highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
      highlightRef.current.scrollTop = event.currentTarget.scrollTop;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop;
  }

  function restoreSelection(start: number, end = start) {
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start, end);
    });
  }

  function revealDiagnostic() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const position = diagnostic.position ?? 0;
    textarea.focus();
    textarea.setSelectionRange(position, Math.min(draft.length, position + 1));
  }

  function apply() {
    if (!diagnostic.valid) {
      setApplied(false);
      setError(diagnostic.message);
      revealDiagnostic();
      return;
    }
    try {
      onApply(draft);
      setError(null);
      setApplied(true);
    } catch (caught) {
      setApplied(false);
      setError(caught instanceof Error ? caught.message : gt('The source could not be applied.'));
    }
  }

  function formatDraft() {
    try {
      const formatted = formatSource(draft);
      setDraft(formatted);
      setError(null);
      setApplied(false);
      setCopied(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : gt('The source could not be formatted.'));
      revealDiagnostic();
    }
  }

  function reset() {
    setDraft(source);
    setError(null);
    setApplied(false);
    setCopied(false);
  }

  async function copy() {
    try {
      await copyTextToClipboard(draft);
      setError(null);
      setCopied(true);
    } catch (caught) {
      setCopied(false);
      setError(caught instanceof Error ? caught.message : gt('The source could not be copied.'));
    }
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      apply();
      return;
    }
    if (event.altKey && event.shiftKey && event.key.toLocaleLowerCase() === 'f') {
      event.preventDefault();
      formatDraft();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) {
      const next = `${draft.slice(0, start)}${INDENT}${draft.slice(end)}`;
      setDraft(next);
      setApplied(false);
      setCopied(false);
      setError(null);
      restoreSelection(start + INDENT.length);
      return;
    }

    const lineStart = draft.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const effectiveEnd = end > start && draft[end - 1] === '\n' ? end - 1 : end;
    const followingBreak = draft.indexOf('\n', effectiveEnd);
    const lineEnd = followingBreak === -1 ? draft.length : followingBreak;
    const selectedBlock = draft.slice(lineStart, lineEnd);
    const lines = selectedBlock.split('\n');
    let firstDelta = 0;
    let totalDelta = 0;
    const nextBlock = lines.map((line, index) => {
      if (!event.shiftKey) {
        if (index === 0) firstDelta = INDENT.length;
        totalDelta += INDENT.length;
        return `${INDENT}${line}`;
      }
      const removable = line.startsWith('\t') ? 1 : Math.min(INDENT.length, line.match(/^ */)?.[0].length ?? 0);
      if (index === 0) firstDelta = -removable;
      totalDelta -= removable;
      return line.slice(removable);
    }).join('\n');
    const next = `${draft.slice(0, lineStart)}${nextBlock}${draft.slice(lineEnd)}`;
    setDraft(next);
    setApplied(false);
    setCopied(false);
    setError(null);
    restoreSelection(
      Math.max(lineStart, start + firstDelta),
      Math.max(lineStart, end + totalDelta)
    );
  }

  return (
    <aside
      aria-label={gt('Source code editor')}
      className='source-code-drawer'
      data-canvas-selection-preserve
      data-resizing={resizing ? 'true' : 'false'}
      style={{ width: `${width}px` } as CSSProperties}
    >
      <div
        aria-label={gt('Resize source code editor')}
        aria-orientation='vertical'
        aria-valuemax={MAX_DRAWER_WIDTH}
        aria-valuemin={MIN_DRAWER_WIDTH}
        aria-valuenow={width}
        className='source-code-drawer-resize'
        onKeyDown={handleResizeKeyDown}
        onPointerCancel={finishResize}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishResize}
        role='separator'
        tabIndex={0}
      />
      <header className='source-code-drawer-header'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-semibold'>{title ?? gt('Artifact source')}</p>
          <p className='source-code-format'><Braces aria-hidden='true' />{format}</p>
        </div>
        <Button
          aria-label={gt('Close source editor')}
          onClick={onClose}
          size='icon-sm'
          type='button'
          variant='ghost'
        >
          <X aria-hidden='true' />
        </Button>
      </header>

      <div className='source-code-drawer-body'>
        <div className='source-code-toolbar'>
          <div
            className='source-code-validation'
            data-valid={diagnostic.valid ? 'true' : 'false'}
            id='source-code-diagnostic'
            role='status'
          >
            {diagnostic.valid
              ? <CheckCircle2 aria-hidden='true' />
              : <AlertCircle aria-hidden='true' />}
            <span>{diagnostic.message}</span>
          </div>
          <span className='source-code-stats'>{lineCount} lines · {sourceSize(draft)}</span>
          <Button
            aria-label={gt('Format JSON source')}
            onClick={formatDraft}
            size='sm'
            title={gt('Format JSON source (Shift+Alt+F)')}
            type='button'
            variant='ghost'
          >
            <Braces aria-hidden='true' />
            <T>Format</T>
          </Button>
        </div>

        <div className='source-code-editor' data-invalid={diagnostic.valid ? 'false' : 'true'}>
          <div aria-hidden='true' className='source-code-gutter' ref={gutterRef}>
            {highlightedLines.map((_, index) => (
              <span data-error-line={diagnostic.line === index + 1 ? 'true' : 'false'} key={index}>{index + 1}</span>
            ))}
          </div>
          <div className='source-code-stage'>
            <pre aria-hidden='true' className='source-code-highlight' ref={highlightRef}>
              {highlightedLines.map((line, lineIndex) => (
                <span
                  className='source-code-highlight-line'
                  data-error-line={diagnostic.line === lineIndex + 1 ? 'true' : 'false'}
                  key={lineIndex}
                >
                  {line.tokens.length > 0 ? line.tokens.map((token, tokenIndex) => (
                    <span data-token={token.type} key={tokenIndex}>{token.content}</span>
                  )) : '\u200B'}
                </span>
              ))}
            </pre>
            <textarea
              aria-describedby='source-code-diagnostic source-code-shortcuts'
              aria-invalid={!diagnostic.valid}
              aria-label={gt('Editable source code')}
              autoCapitalize='off'
              autoCorrect='off'
              className='source-code-textarea'
              onChange={(event) => {
                setDraft(event.target.value);
                setApplied(false);
                setCopied(false);
                setError(null);
              }}
              onKeyDown={handleEditorKeyDown}
              onScroll={syncEditorScroll}
              ref={textareaRef}
              spellCheck={false}
              value={draft}
              wrap='off'
            />
            <span className='sr-only' id='source-code-shortcuts'>Use Tab to indent, Shift Tab to outdent, Shift Alt F to format, and Command or Control Enter to apply.</span>
          </div>
        </div>

        {visibleError ? (
          <p
            className='source-code-error'
            role={error ? 'alert' : 'status'}
          >
            <AlertCircle aria-hidden='true' />
            <span>{visibleError}</span>
          </p>
        ) : null}
      </div>

      <footer className='source-code-footer'>
        <Button onClick={reset} type='button' variant='outline'>
          <RotateCcw aria-hidden='true' />
          <T>Reset</T>
        </Button>
        <Button onClick={() => void copy()} type='button' variant='outline'>
          {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
          {copied ? <T>Copied</T> : <T>Copy</T>}
        </Button>
        <Button disabled={!diagnostic.valid} onClick={apply} type='button'>
          {applied ? <Check aria-hidden='true' /> : <Code2 aria-hidden='true' />}
          {applied ? <T>Applied</T> : <T>Apply code</T>}
          <kbd>⌘↵</kbd>
        </Button>
      </footer>
    </aside>
  );
}
