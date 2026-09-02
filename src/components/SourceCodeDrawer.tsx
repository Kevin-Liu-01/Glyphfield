'use client';

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type CSSProperties,
  type ClipboardEvent,
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
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  ListTree,
  RotateCcw,
  Search,
  X,
} from '@/components/ui/SolidIcons';

import { Button } from '@/components/ui/Button';
import { useMountEffect } from '@/hooks/useMountEffect';
import { highlightCode } from '@/lib/codeHighlight';
import { copyTextToClipboard } from '@/lib/clipboard';
import { formatSource, inspectSourceText, normalizeSourceText } from '@/lib/sourceCode';
import {
  sourceEditorDeletesPair,
  sourceEditorEnterInsertion,
  sourceEditorIndentReplacement,
  sourceEditorPairInsertion,
  sourceEditorSections,
  sourceEditorShortcut,
  sourceEditorSkipClosing,
} from '@/lib/sourceEditor';
import { registerStudioAutomation } from '@/lib/studioAutomation';

const DEFAULT_DRAWER_WIDTH = 560;
const MIN_DRAWER_WIDTH = 360;
const MAX_DRAWER_WIDTH = 880;
const DRAWER_WIDTH_STORAGE_KEY = 'glyphfield:source-code-drawer:width';
const INDENT = '  ';

type SourceSelection = {
  end: number;
  start: number;
};

type SourceCodeState = {
  activeMatch: number;
  applied: boolean;
  applying: boolean;
  copied: boolean;
  draft: string;
  error: string | null;
  findOpen: boolean;
  findQuery: string;
  pasteNormalized: boolean;
  replacement: string;
  resizing: boolean;
  selection: SourceSelection;
  width: number;
};

function createSourceCodeState(source: string): SourceCodeState {
  return {
    activeMatch: 0,
    applied: false,
    applying: false,
    copied: false,
    draft: source,
    error: null,
    findOpen: false,
    findQuery: '',
    pasteNormalized: false,
    replacement: '',
    resizing: false,
    selection: { end: 0, start: 0 },
    width: DEFAULT_DRAWER_WIDTH,
  };
}

function sourceCodeStateReducer(state: SourceCodeState, patch: Partial<SourceCodeState>): SourceCodeState {
  return { ...state, ...patch };
}

function clampDrawerWidth(width: number) {
  return Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, width));
}

function sourceSize(value: string): string {
  const bytes = new TextEncoder().encode(value).length;
  if (bytes < 1_024) return `${bytes} B`;
  const kilobytes = bytes / 1_024;
  return `${kilobytes < 10 ? kilobytes.toFixed(1) : Math.round(kilobytes)} KB`;
}

function lineColumnAt(value: string, position: number) {
  const before = value.slice(0, Math.max(0, Math.min(value.length, position)));
  const lines = before.split('\n');
  return {
    column: (lines.at(-1)?.length ?? 0) + 1,
    line: lines.length,
  };
}

function sourceMatches(value: string, query: string): number[] {
  if (!query) return [];
  const matches: number[] = [];
  let position = 0;
  while (position <= value.length - query.length) {
    const match = value.indexOf(query, position);
    if (match === -1) break;
    matches.push(match);
    position = match + Math.max(1, query.length);
  }
  return matches;
}

function sourceValidationPresentation({
  message,
  normalizedPaste,
  translate,
  valid,
}: {
  message: string;
  normalizedPaste: boolean;
  translate: (message: string) => string;
  valid: boolean;
}): { message: string; status: 'invalid' | 'valid' } {
  if (normalizedPaste && valid) {
    return {
      message: translate('Valid JSON · rich-text spacing cleaned on paste'),
      status: 'valid',
    };
  }
  return { message, status: valid ? 'valid' : 'invalid' };
}


function SourceCodeValidation({
  message,
  status,
}: {
  message: string;
  status: 'invalid' | 'valid';
}) {
  return (
    <div
      className='source-code-validation'
      data-status={status}
      id='source-code-diagnostic'
      role='status'
    >
      {status === 'valid'
        ? <CheckCircle2 aria-hidden='true' />
        : <AlertCircle aria-hidden='true' />}
      <span>{message}</span>
    </div>
  );
}

function SourceCodeError({
  applicationError,
  visibleError,
}: {
  applicationError: string | null;
  visibleError: string | null;
}) {
  if (!visibleError) return null;
  return (
    <p className='source-code-error' role={applicationError ? 'alert' : 'status'}>
      <AlertCircle aria-hidden='true' />
      <span>{visibleError}</span>
    </p>
  );
}

function SourceCodeFooter({
  applied,
  applying,
  copied,
  diagnosticValid,
  onApply,
  onCopy,
  onReset,
}: {
  applied: boolean;
  applying: boolean;
  copied: boolean;
  diagnosticValid: boolean;
  onApply: () => void;
  onCopy: () => void;
  onReset: () => void;
}) {
  return (
    <footer className='source-code-footer'>
      <Button onClick={onReset} type='button' variant='outline'>
        <RotateCcw aria-hidden='true' />
        <T>Reset</T>
      </Button>
      <Button onClick={onCopy} type='button' variant='outline'>
        {copied ? <Check aria-hidden='true' /> : <Copy aria-hidden='true' />}
        {copied ? <T>Copied</T> : <T>Copy</T>}
      </Button>
      <Button disabled={!diagnosticValid || applying} onClick={onApply} type='button'>
        {applied ? <Check aria-hidden='true' /> : <Code2 aria-hidden='true' />}
        {applying ? <T>Applying…</T> : applied ? <T>Applied</T> : <T>Apply code</T>}
        <kbd>⌘↵</kbd>
      </Button>
    </footer>
  );
}

export function SourceCodeButton({
  disabled = false,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  const gt = useGT();

  return (
    <Button
      aria-label={gt('Edit source code')}
      disabled={disabled}
      onClick={onClick}
      title={gt(disabled ? 'Preparing portable source' : 'Edit source code')}
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
  onApply: (source: string) => Promise<void> | void;
  onClose: () => void;
  source: string;
  title?: string;
}) {
  const gt = useGT();
  const [state, updateState] = useReducer(sourceCodeStateReducer, source, createSourceCodeState);
  const {
    activeMatch,
    applied,
    applying,
    copied,
    draft,
    error,
    findOpen,
    findQuery,
    pasteNormalized,
    replacement,
    resizing,
    selection,
    width,
  } = state;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const deferredDraft = useDeferredValue(draft);
  const highlightPending = deferredDraft !== draft;
  const diagnostic = useMemo(() => inspectSourceText(draft), [draft]);
  const deferredDiagnostic = useMemo(
    () => inspectSourceText(deferredDraft),
    [deferredDraft]
  );
  const highlightedLines = useMemo(
    () => highlightCode(deferredDiagnostic.source, 'json'),
    [deferredDiagnostic.source]
  );
  const sections = useMemo(() => sourceEditorSections(diagnostic.source), [diagnostic.source]);
  const matches = useMemo(() => sourceMatches(draft, findQuery), [draft, findQuery]);
  const cursor = useMemo(() => lineColumnAt(draft, selection.end), [draft, selection.end]);
  const selectedMatch = Math.min(activeMatch, Math.max(0, matches.length - 1));
  const activeSection = sections.findLast(({ position }) => position <= selection.end);
  const lineCount = draft.split('\n').length;
  const visibleError = error ?? (diagnostic.valid ? null : diagnostic.message);
  const validation = sourceValidationPresentation({
    message: diagnostic.message,
    normalizedPaste: pasteNormalized,
    translate: gt,
    valid: diagnostic.valid,
  });
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
    updateState({ width: nextWidth });
  });

  function updateWidth(nextWidth: number) {
    const clampedWidth = clampDrawerWidth(nextWidth);
    dragRef.current.currentWidth = clampedWidth;
    updateState({ width: clampedWidth });
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
    updateState({ resizing: true });
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!resizing || event.pointerId !== dragRef.current.pointerId) return;
    updateWidth(
      dragRef.current.startWidth - (event.clientX - dragRef.current.startX)
    );
  }

  function finishResize(event: PointerEvent<HTMLDivElement>) {
    if (!resizing || event.pointerId !== dragRef.current.pointerId) return;
    updateState({ resizing: false });
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
    updateState({ selection: { end, start } });
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(start, end);
    });
  }

  function revealDiagnostic(sourceDiagnostic = diagnostic) {
    if (!textareaRef.current) return;
    const position = sourceDiagnostic.position ?? 0;
    restoreSelection(position, Math.min(draft.length, position + 1));
  }

  async function apply() {
    const currentDiagnostic = inspectSourceText(draft);
    if (!currentDiagnostic.valid) {
      updateState({ applied: false, error: currentDiagnostic.message });
      revealDiagnostic(currentDiagnostic);
      return;
    }
    updateState({ applying: true });
    try {
      await onApply(currentDiagnostic.source);
      updateState({
        applied: true,
        draft: currentDiagnostic.normalized ? currentDiagnostic.source : draft,
        error: null,
        pasteNormalized: false,
      });
    } catch (caught) {
      updateState({
        applied: false,
        error: caught instanceof Error ? caught.message : gt('The source could not be applied.'),
      });
    } finally {
      updateState({ applying: false });
    }
  }

  function formatDraft() {
    try {
      const formatted = formatSource(draft);
      updateState({ applied: false, copied: false, draft: formatted, error: null, pasteNormalized: false });
    } catch (caught) {
      updateState({ error: caught instanceof Error ? caught.message : gt('The source could not be formatted.') });
      revealDiagnostic();
    }
  }

  function reset() {
    updateState({ applied: false, copied: false, draft: source, error: null, pasteNormalized: false });
  }

  async function copy() {
    try {
      const currentDiagnostic = inspectSourceText(draft);
      await copyTextToClipboard(currentDiagnostic.valid ? currentDiagnostic.source : draft);
      updateState({ copied: true, error: null });
    } catch (caught) {
      updateState({
        copied: false,
        error: caught instanceof Error ? caught.message : gt('The source could not be copied.'),
      });
    }
  }

  function cleanDraft() {
    updateState({
      applied: false,
      copied: false,
      draft: diagnostic.source,
      error: null,
      pasteNormalized: false,
    });
  }

  function openFind() {
    updateState({ findOpen: true });
    window.requestAnimationFrame(() => {
      findInputRef.current?.focus();
      findInputRef.current?.select();
    });
  }

  function revealMatch(nextIndex: number) {
    if (matches.length === 0) return;
    const index = (nextIndex + matches.length) % matches.length;
    const start = matches[index]!;
    updateState({ activeMatch: index });
    restoreSelection(start, start + findQuery.length);
  }

  function replaceMatch() {
    if (matches.length === 0) return;
    const start = matches[selectedMatch] ?? matches[0]!;
    const next = `${draft.slice(0, start)}${replacement}${draft.slice(start + findQuery.length)}`;
    updateState({ applied: false, copied: false, draft: next, error: null });
    restoreSelection(start, start + replacement.length);
  }

  function replaceEveryMatch() {
    if (!findQuery || matches.length === 0) return;
    updateState({
      activeMatch: 0,
      applied: false,
      copied: false,
      draft: draft.split(findQuery).join(replacement),
      error: null,
    });
  }

  function insertEditorText(start: number, end: number, inserted: string, cursorOffset: number) {
    const next = `${draft.slice(0, start)}${inserted}${draft.slice(end)}`;
    updateState({ applied: false, copied: false, draft: next, error: null });
    restoreSelection(start + cursorOffset);
  }

  function handleEditorPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData.getData('text/plain');
    const normalized = normalizeSourceText(pasted);
    if (normalized === pasted) {
      updateState({ pasteNormalized: false });
      return;
    }

    event.preventDefault();
    const start = event.currentTarget.selectionStart;
    const end = event.currentTarget.selectionEnd;
    insertEditorText(start, end, normalized, normalized.length);
    updateState({ pasteNormalized: true });
  }

  function runEditorShortcut(shortcut: NonNullable<ReturnType<typeof sourceEditorShortcut>>) {
    const actions: Record<NonNullable<ReturnType<typeof sourceEditorShortcut>>, () => void> = {
      apply: () => { void apply(); },
      close: () => {
        if (findOpen) {
          updateState({ findOpen: false });
          textareaRef.current?.focus();
        } else {
          onClose();
        }
      },
      find: openFind,
      format: formatDraft,
    };
    actions[shortcut]();
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    const shortcut = sourceEditorShortcut({
      altKey: event.altKey,
      controlKey: event.ctrlKey,
      key: event.key,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
    });
    if (shortcut) {
      event.preventDefault();
      runEditorShortcut(shortcut);
      return;
    }

    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    if (event.key === 'Enter') {
      event.preventDefault();
      const insertion = sourceEditorEnterInsertion(draft, start, INDENT);
      insertEditorText(start, end, insertion.inserted, insertion.cursorOffset);
      return;
    }

    const hasKeyModifier = event.metaKey || event.ctrlKey || event.altKey;
    const pairInsertion = sourceEditorPairInsertion(draft, start, end, event.key);
    if (pairInsertion && !hasKeyModifier) {
      if (start === end && sourceEditorSkipClosing(draft, start, event.key)) {
        event.preventDefault();
        restoreSelection(start + 1);
        return;
      }
      event.preventDefault();
      insertEditorText(start, end, pairInsertion.inserted, pairInsertion.cursorOffset);
      return;
    }

    if (start === end && sourceEditorSkipClosing(draft, start, event.key)) {
      event.preventDefault();
      restoreSelection(start + 1);
      return;
    }

    if (event.key === 'Backspace' && start === end && start > 0 && sourceEditorDeletesPair(draft, start)) {
      event.preventDefault();
      insertEditorText(start - 1, start + 1, '', 0);
      return;
    }

    if (event.key !== 'Tab') return;

    event.preventDefault();
    const replacement = sourceEditorIndentReplacement(draft, start, end, event.shiftKey, INDENT);
    updateState({ applied: false, copied: false, draft: replacement.value, error: null });
    restoreSelection(replacement.selectionStart, replacement.selectionEnd);
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
        <div className='source-code-controls'>
          <div className='source-code-toolbar'>
            <SourceCodeValidation
              message={validation.message}
              status={validation.status}
            />
            <span className='source-code-stats'>Ln {cursor.line}, Col {cursor.column} · {lineCount} lines · {sourceSize(draft)}</span>
            <div className='source-code-toolbar-actions'>
              {sections.length > 0 ? (
                <label className='source-code-outline'>
                  <ListTree aria-hidden='true' />
                  <span className='sr-only'><T>Jump to section</T></span>
                  <select
                    aria-label={gt('Jump to top-level section')}
                    onChange={(event) => {
                      const position = Number(event.target.value);
                      const section = sections.find((candidate) => candidate.position === position);
                      if (section) restoreSelection(section.position, section.position + section.key.length + 2);
                    }}
                    title={gt('Jump to top-level section')}
                    value={activeSection?.position ?? sections[0]?.position ?? 0}
                  >
                    {sections.map((section) => (
                      <option key={`${section.key}:${section.position}`} value={section.position}>
                        {section.key} · Ln {section.line}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {diagnostic.normalized ? (
                <Button
                  onClick={cleanDraft}
                  size='sm'
                  title={gt('Replace rich-text spacing with standard JSON spaces')}
                  type='button'
                  variant='ghost'
                >
                  <Check aria-hidden='true' />
                  <T>Clean paste</T>
                </Button>
              ) : null}
              <Button
                aria-label={gt('Find and replace')}
                onClick={() => findOpen ? updateState({ findOpen: false }) : openFind()}
                size='icon-sm'
                title={gt('Find and replace (Command or Control F)')}
                type='button'
                variant='ghost'
              >
                <Search aria-hidden='true' />
              </Button>
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
          </div>
          {findOpen ? (
            <div className='source-code-findbar'>
              <label className='source-code-find-field'>
                <span className='sr-only'><T>Find</T></span>
                <Search aria-hidden='true' />
                <input
                  aria-label={gt('Find in source')}
                  onChange={(event) => {
                    updateState({ activeMatch: 0, findQuery: event.target.value });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      updateState({ findOpen: false });
                      textareaRef.current?.focus();
                    } else if (event.key === 'Enter') {
                      event.preventDefault();
                      revealMatch(selectedMatch + (event.shiftKey ? -1 : 1));
                    }
                  }}
                  placeholder={gt('Find')}
                  ref={findInputRef}
                  value={findQuery}
                />
                <span>{matches.length === 0 ? '0 / 0' : `${selectedMatch + 1} / ${matches.length}`}</span>
              </label>
              <Button aria-label={gt('Previous match')} disabled={matches.length === 0} onClick={() => revealMatch(selectedMatch - 1)} size='icon-sm' type='button' variant='ghost'><ChevronUp aria-hidden='true' /></Button>
              <Button aria-label={gt('Next match')} disabled={matches.length === 0} onClick={() => revealMatch(selectedMatch + 1)} size='icon-sm' type='button' variant='ghost'><ChevronDown aria-hidden='true' /></Button>
              <label className='source-code-replace-field'>
                <span className='sr-only'><T>Replace</T></span>
                <input
                  aria-label={gt('Replace in source')}
                  onChange={(event) => updateState({ replacement: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      replaceMatch();
                    }
                  }}
                  placeholder={gt('Replace')}
                  value={replacement}
                />
              </label>
              <Button disabled={matches.length === 0} onClick={replaceMatch} size='sm' type='button' variant='ghost'><T>Replace</T></Button>
              <Button disabled={matches.length === 0} onClick={replaceEveryMatch} size='sm' type='button' variant='ghost'><T>All</T></Button>
              <Button aria-label={gt('Close find and replace')} onClick={() => updateState({ findOpen: false })} size='icon-sm' type='button' variant='ghost'><X aria-hidden='true' /></Button>
            </div>
          ) : null}
        </div>

        <div
          className='source-code-editor'
          data-highlight-pending={highlightPending ? 'true' : 'false'}
          data-invalid={!diagnostic.valid ? 'true' : 'false'}
        >
          <div aria-hidden='true' className='source-code-gutter' ref={gutterRef}>
            {Array.from({ length: lineCount }, (_, index) => (
              <span
                data-current-line={cursor.line === index + 1 ? 'true' : 'false'}
                data-error-line={diagnostic.line === index + 1 ? 'true' : 'false'}
                key={index}
              >{index + 1}</span>
            ))}
          </div>
          <div className='source-code-stage'>
            <pre aria-hidden='true' className='source-code-highlight' ref={highlightRef}>
              {highlightedLines.map((line, lineIndex) => (
                <span
                  className='source-code-highlight-line'
                  data-current-line={cursor.line === lineIndex + 1 ? 'true' : 'false'}
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
                updateState({
                  applied: false,
                  copied: false,
                  draft: event.target.value,
                  error: null,
                  pasteNormalized: false,
                  selection: { end: event.target.selectionEnd, start: event.target.selectionStart },
                });
              }}
              onKeyDown={handleEditorKeyDown}
              onPaste={handleEditorPaste}
              onSelect={(event) => updateState({
                selection: {
                  end: event.currentTarget.selectionEnd,
                  start: event.currentTarget.selectionStart,
                },
              })}
              onScroll={syncEditorScroll}
              ref={textareaRef}
              spellCheck={false}
              value={draft}
              wrap='off'
            />
            <span className='sr-only' id='source-code-shortcuts'>Use Tab to indent, Shift Tab to outdent, Command or Control F to find, Shift Alt F to format, and Command or Control Enter to apply.</span>
          </div>
        </div>

        <SourceCodeError applicationError={error} visibleError={visibleError} />
      </div>

      <SourceCodeFooter
        applied={applied}
        applying={applying}
        copied={copied}
        diagnosticValid={diagnostic.valid}
        onApply={() => void apply()}
        onCopy={() => void copy()}
        onReset={reset}
      />
    </aside>
  );
}
