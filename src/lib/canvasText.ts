export type CanvasTextAlign = 'center' | 'left' | 'right';
export type CanvasTextWrap = 'nowrap' | 'wrap';

type MeasureText = (value: string) => number;

export function canvasTextCharacters(value: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(value), ({ segment }) => segment);
  }
  return Array.from(value);
}

export function trackedTextWidth(
  value: string,
  measureText: MeasureText,
  letterSpacing: number
): number {
  const characters = canvasTextCharacters(value);
  return Math.max(
    0,
    characters.reduce((sum, character) => sum + measureText(character), 0)
      + Math.max(0, characters.length - 1) * letterSpacing
  );
}

function wrapParagraph(
  value: string,
  maxWidth: number,
  measureLine: MeasureText
): string[] {
  const characters = canvasTextCharacters(value);
  if (characters.length === 0) return [''];

  const lines: string[] = [];
  let line: string[] = [];
  let lastSoftBreak = -1;

  characters.forEach((character) => {
    const candidate = [...line, character];
    if (line.length === 0 || measureLine(candidate.join('')) <= maxWidth) {
      line = candidate;
      if (/\s/u.test(character)) lastSoftBreak = line.length;
      return;
    }

    if (/\s/u.test(character)) {
      lines.push(line.join('').trimEnd());
      line = [];
      lastSoftBreak = -1;
      return;
    }

    if (lastSoftBreak > 0) {
      lines.push(line.slice(0, lastSoftBreak).join('').trimEnd());
      line = line.slice(lastSoftBreak);
      while (line[0] && /\s/u.test(line[0])) line.shift();
      line.push(character);
    } else {
      lines.push(line.join(''));
      line = [character];
    }
    lastSoftBreak = -1;
    line.forEach((nextCharacter, index) => {
      if (/\s/u.test(nextCharacter)) lastSoftBreak = index + 1;
    });
  });

  lines.push(line.join('').trimEnd());
  return lines;
}

export function layoutCanvasText(
  value: string,
  maxWidth: number,
  measureText: MeasureText,
  letterSpacing: number,
  wrap: CanvasTextWrap,
  measureLine?: MeasureText
): string[] {
  const paragraphs = value.replace(/\r\n?/g, '\n').split('\n');
  if (wrap === 'nowrap') return paragraphs;
  const resolvedMeasureLine = measureLine
    ?? ((line: string) => trackedTextWidth(line, measureText, letterSpacing));
  return paragraphs.flatMap((paragraph) =>
    wrapParagraph(paragraph, Math.max(1, maxWidth), resolvedMeasureLine)
  );
}

export function canvasTextLineX(
  align: CanvasTextAlign,
  boxX: number,
  boxWidth: number,
  lineWidth: number
): number {
  if (align === 'left') return boxX;
  if (align === 'right') return boxX + boxWidth - lineWidth;
  return boxX + (boxWidth - lineWidth) / 2;
}
