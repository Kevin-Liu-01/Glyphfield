/**
 * Figlet "ANSI Shadow" letters for terminal banners and README headers. Each
 * glyph is six rows: full blocks draw the letter and box-drawing characters
 * draw its shadow, so the result reads in any monospace font and copies as text.
 */
const ANSI_SHADOW: Readonly<Record<string, readonly string[]>> = {
  '+': ['       ', '  ██╗  ', '██████╗', '╚═██╔═╝', '  ╚═╝  ', '       '],
  A: [' █████╗ ', '██╔══██╗', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  B: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██████╔╝', '╚═════╝ '],
  C: [' ██████╗', '██╔════╝', '██║     ', '██║     ', '╚██████╗', ' ╚═════╝'],
  D: ['██████╗ ', '██╔══██╗', '██║  ██║', '██║  ██║', '██████╔╝', '╚═════╝ '],
  E: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '███████╗', '╚══════╝'],
  F: ['███████╗', '██╔════╝', '█████╗  ', '██╔══╝  ', '██║     ', '╚═╝     '],
  G: [' ██████╗ ', '██╔════╝ ', '██║  ███╗', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  H: ['██╗  ██╗', '██║  ██║', '███████║', '██╔══██║', '██║  ██║', '╚═╝  ╚═╝'],
  I: ['██╗', '██║', '██║', '██║', '██║', '╚═╝'],
  J: ['     ██╗', '     ██║', '     ██║', '██   ██║', '╚█████╔╝', ' ╚════╝ '],
  K: ['██╗  ██╗', '██║ ██╔╝', '█████╔╝ ', '██╔═██╗ ', '██║  ██╗', '╚═╝  ╚═╝'],
  L: ['██╗     ', '██║     ', '██║     ', '██║     ', '███████╗', '╚══════╝'],
  M: ['███╗   ███╗', '████╗ ████║', '██╔████╔██║', '██║╚██╔╝██║', '██║ ╚═╝ ██║', '╚═╝     ╚═╝'],
  N: ['███╗   ██╗', '████╗  ██║', '██╔██╗ ██║', '██║╚██╗██║', '██║ ╚████║', '╚═╝  ╚═══╝'],
  O: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  P: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔═══╝ ', '██║     ', '╚═╝     '],
  Q: [' ██████╗ ', '██╔═══██╗', '██║   ██║', '██║▄▄ ██║', '╚██████╔╝', ' ╚══▀▀═╝ '],
  R: ['██████╗ ', '██╔══██╗', '██████╔╝', '██╔══██╗', '██║  ██║', '╚═╝  ╚═╝'],
  S: ['███████╗', '██╔════╝', '███████╗', '╚════██║', '███████║', '╚══════╝'],
  T: ['████████╗', '╚══██╔══╝', '   ██║   ', '   ██║   ', '   ██║   ', '   ╚═╝   '],
  U: ['██╗   ██╗', '██║   ██║', '██║   ██║', '██║   ██║', '╚██████╔╝', ' ╚═════╝ '],
  V: ['██╗   ██╗', '██║   ██║', '██║   ██║', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚═══╝  '],
  W: ['██╗    ██╗', '██║    ██║', '██║ █╗ ██║', '██║███╗██║', '╚███╔███╔╝', ' ╚══╝╚══╝ '],
  X: ['██╗  ██╗', '╚██╗██╔╝', ' ╚███╔╝ ', ' ██╔██╗ ', '██╔╝ ██╗', '╚═╝  ╚═╝'],
  Y: ['██╗   ██╗', '╚██╗ ██╔╝', ' ╚████╔╝ ', '  ╚██╔╝  ', '   ██║   ', '   ╚═╝   '],
  Z: ['███████╗', '╚══███╔╝', '  ███╔╝ ', ' ███╔╝  ', '███████╗', '╚══════╝'],
};

const SPACE = ['   ', '   ', '   ', '   ', '   ', '   '];

/** The longest word set in the banner; longer names fall back to the short name. */
export const ASCII_BANNER_MAX_LETTERS = 9;

/** Set a word in ANSI Shadow. Characters without a glyph are skipped. */
export function asciiBanner(text: string): string {
  const glyphs = [...text.toLocaleUpperCase()]
    .map((character) => (character === ' ' ? SPACE : ANSI_SHADOW[character]))
    .filter((glyph): glyph is readonly string[] => Boolean(glyph));
  if (!glyphs.length) return '';
  return SPACE.map((_, row) => glyphs.map((glyph) => glyph[row]).join('').replace(/\s+$/, '')).join('\n');
}

/** The word a brand banner sets: the name when it fits, otherwise the short name. */
export function asciiBannerWord(name: string, shortName: string): string {
  const compactName = name.replace(/[^A-Za-z+ ]/g, '').trim();
  const letters = compactName.replace(/\s+/g, '').length;
  if (letters > 0 && letters <= ASCII_BANNER_MAX_LETTERS && !compactName.includes(' ')) return compactName;
  const short = shortName.replace(/[^A-Za-z+]/g, '');
  return short.length > 0 && short.length <= ASCII_BANNER_MAX_LETTERS ? short : compactName.split(/\s+/)[0]!.slice(0, ASCII_BANNER_MAX_LETTERS);
}
