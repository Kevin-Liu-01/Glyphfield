export type SourceEditorShortcut = 'apply' | 'close' | 'find' | 'format' | null;

export type SourceEditorInsertion = {
  cursorOffset: number;
  inserted: string;
};

export type SourceEditorReplacement = {
  selectionEnd: number;
  selectionStart: number;
  value: string;
};

export type SourceEditorSection = {
  key: string;
  line: number;
  position: number;
};

type SourceSectionScanState = {
  arrayDepth: number;
  escaped: boolean;
  insideString: boolean;
  line: number;
  objectDepth: number;
  stringStart: number;
};

function sourceEditorSectionAt(
  value: string,
  stringStart: number,
  stringEnd: number,
  line: number
): SourceEditorSection | null {
  let cursor = stringEnd + 1;
  while (/\s/.test(value[cursor] ?? '')) cursor += 1;
  if (value[cursor] !== ':') return null;
  try {
    return {
      key: JSON.parse(value.slice(stringStart, stringEnd + 1)) as string,
      line,
      position: stringStart,
    };
  } catch {
    return null;
  }
}

function scanSourceStringCharacter(
  state: SourceSectionScanState,
  character: string,
  index: number,
  value: string,
  sections: SourceEditorSection[]
): boolean {
  if (!state.insideString) return false;
  if (state.escaped) {
    state.escaped = false;
    return true;
  }
  if (character === '\\') {
    state.escaped = true;
    return true;
  }
  if (character !== '"') return true;

  state.insideString = false;
  if (state.objectDepth !== 1 || state.arrayDepth !== 0) return true;
  const section = sourceEditorSectionAt(value, state.stringStart, index, state.line);
  if (section) sections.push(section);
  return true;
}

function scanSourceStructuralCharacter(
  state: SourceSectionScanState,
  character: string,
  index: number
) {
  if (character === '"') {
    state.insideString = true;
    state.stringStart = index;
    return;
  }
  if (character === '\n') state.line += 1;
  else if (character === '{') state.objectDepth += 1;
  else if (character === '}') state.objectDepth = Math.max(0, state.objectDepth - 1);
  else if (character === '[') state.arrayDepth += 1;
  else if (character === ']') state.arrayDepth = Math.max(0, state.arrayDepth - 1);
}

export function sourceEditorSections(value: string): SourceEditorSection[] {
  const sections: SourceEditorSection[] = [];
  const state: SourceSectionScanState = {
    arrayDepth: 0,
    escaped: false,
    insideString: false,
    line: 1,
    objectDepth: 0,
    stringStart: 0,
  };

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]!;
    if (scanSourceStringCharacter(state, character, index, value, sections)) continue;
    scanSourceStructuralCharacter(state, character, index);
  }

  return sections;
}

export function sourceEditorShortcut({
  altKey,
  controlKey,
  key,
  metaKey,
  shiftKey,
}: {
  altKey: boolean;
  controlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}): SourceEditorShortcut {
  const normalizedKey = key.toLocaleLowerCase();
  const command = metaKey || controlKey;
  if (command && normalizedKey === 'f') return 'find';
  if (command && (normalizedKey === 's' || key === 'Enter')) return 'apply';
  if (altKey && shiftKey && normalizedKey === 'f') return 'format';
  return key === 'Escape' ? 'close' : null;
}

export function sourceEditorEnterInsertion(
  value: string,
  position: number,
  indentUnit: string
): SourceEditorInsertion {
  const lineStart = value.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
  const indent = /^\s*/.exec(value.slice(lineStart, position))![0];
  const previous = value.slice(lineStart, position).trimEnd().at(-1);
  const next = value.slice(position).match(/^\s*([}\]])/)?.[1];
  const closing = previous === '{' ? '}' : previous === '[' ? ']' : null;
  if (closing && next === closing) {
    return {
      cursorOffset: 1 + indent.length + indentUnit.length,
      inserted: `\n${indent}${indentUnit}\n${indent}`,
    };
  }
  const nestedIndent = closing ? indentUnit : '';
  const inserted = `\n${indent}${nestedIndent}`;
  return { cursorOffset: inserted.length, inserted };
}

function isInsideJsonString(value: string, position: number): boolean {
  let escaped = false;
  let insideString = false;
  for (let index = 0; index < position; index += 1) {
    const character = value[index];
    if (insideString && character === '\\' && !escaped) {
      escaped = true;
      continue;
    }
    if (character === '"' && !escaped) insideString = !insideString;
    escaped = false;
  }
  return insideString;
}

export function sourceEditorPairInsertion(
  value: string,
  start: number,
  end: number,
  key: string
): SourceEditorInsertion | null {
  const pair = key === '{' ? '}' : key === '[' ? ']' : key === '"' ? '"' : null;
  if (!pair) return null;
  if (key === '"' && isInsideJsonString(value, start) && start === end) return null;
  const selected = value.slice(start, end);
  return { cursorOffset: 1 + selected.length, inserted: `${key}${selected}${pair}` };
}

export function sourceEditorSkipClosing(value: string, position: number, key: string): boolean {
  return (key === '}' || key === ']' || key === '"') && value[position] === key;
}

export function sourceEditorDeletesPair(value: string, position: number): boolean {
  const pair = `${value[position - 1] ?? ''}${value[position] ?? ''}`;
  return pair === '{}' || pair === '[]' || pair === '""';
}

function removableIndent(line: string, indentUnit: string): number {
  if (line.startsWith('\t')) return 1;
  const leadingSpaces = /^ */.exec(line)?.[0] ?? '';
  return Math.min(indentUnit.length, leadingSpaces.length);
}

export function sourceEditorIndentReplacement(
  value: string,
  start: number,
  end: number,
  outdent: boolean,
  indentUnit: string
): SourceEditorReplacement {
  if (start === end) {
    return {
      selectionEnd: start + indentUnit.length,
      selectionStart: start + indentUnit.length,
      value: `${value.slice(0, start)}${indentUnit}${value.slice(end)}`,
    };
  }
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const effectiveEnd = value[end - 1] === '\n' ? end - 1 : end;
  const followingBreak = value.indexOf('\n', effectiveEnd);
  const lineEnd = followingBreak === -1 ? value.length : followingBreak;
  let firstDelta = 0;
  let totalDelta = 0;
  const nextBlock = value.slice(lineStart, lineEnd).split('\n').map((line, index) => {
    const delta = outdent ? -removableIndent(line, indentUnit) : indentUnit.length;
    if (index === 0) firstDelta = delta;
    totalDelta += delta;
    return outdent ? line.slice(-delta) : `${indentUnit}${line}`;
  }).join('\n');
  return {
    selectionEnd: Math.max(lineStart, end + totalDelta),
    selectionStart: Math.max(lineStart, start + firstDelta),
    value: `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`,
  };
}
