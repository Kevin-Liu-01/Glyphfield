import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import BrandOpenGraphImage, {
  HOME_OPEN_GRAPH_ALT,
  HOME_OPEN_GRAPH_CARD,
  STUDIO_OPEN_GRAPH_ALT,
  STUDIO_OPEN_GRAPH_CARD,
  blockHeight,
  blockWidth,
  fitHeadline,
  getBrandOpenGraphFonts,
  truncateAtWord,
} from '@/components/BrandOpenGraphImage';
import interDisplay600 from '../../../public/og/inter-display-600.json';

const COLUMN = { maxHeight: 360, maxWidth: 640 };

function textNodes(markup: string) {
  return Array.from(markup.matchAll(/>([^<]+)</g), (match) => match[1]!);
}

function sfntTables(file: string) {
  const data = readFileSync(join(process.cwd(), 'public/og', file));
  const count = data.readUInt16BE(4);
  return Array.from({ length: count }, (_, index) => data.toString('latin1', 12 + index * 16, 16 + index * 16));
}

describe('BrandOpenGraphImage', () => {
  it('renders the home card: mark, name, headline, lead and footer', () => {
    const markup = renderToStaticMarkup(<BrandOpenGraphImage {...HOME_OPEN_GRAPH_CARD} />);
    const text = textNodes(markup).join('');

    expect(markup).toContain('d="M6 6H58V22H48V16H16V48H48V40H58V58H6Z"');
    expect(markup).toContain('d="M33 24.5H50L46 29.5H61L42 42.5L46 35.5H30L34 30H25Z"');
    expect(text).toContain('Glyphfield');
    expect(text).toContain('Onestudioforthewholebrand.');
    expect(text).toContain('Buildidentitysystems,motion,graphics,');
    expect(text).toContain('FreeandopensourceundertheMITLicense.');
    expect(text).toContain('glyphfield.com');
    expect(markup).toContain('data-og-shader="paper-dithering-swirl"');
    for (const panel of ['copy', 'image', 'footer']) expect(markup).toContain(`data-og-panel="${panel}"`);
    for (const legacy of ['OPEN BRAND STUDIO', 'LOCAL-FIRST', 'Switzer', '→']) expect(markup).not.toContain(legacy);
  });

  it('sets the highlighted phrase in the accent on its own line', () => {
    const block = fitHeadline({ ...COLUMN, highlightedTitle: 'the whole brand.', title: 'One studio for the whole brand.' });
    const lineText = block.lines.map((line) => line.flatMap((word) => word.pieces.map((piece) => piece.text)).join(''));

    expect(lineText).toEqual(['Onestudiofor', 'thewholebrand.']);
    expect(block.lines[1]!.every((word) => word.pieces.every((piece) => piece.highlighted))).toBe(true);
    expect(block.lines[0]!.some((word) => word.pieces.some((piece) => piece.highlighted))).toBe(false);

    const markup = renderToStaticMarkup(<BrandOpenGraphImage {...HOME_OPEN_GRAPH_CARD} accent='#8b5cf6' />);
    expect(markup).toMatch(/color:#8b5cf6[^>]*>the</);
    expect(markup).toMatch(/color:#F0F0ED[^>]*>One</);
  });

  it('fits the longest docs titles and the longest /api/og title inside the column', () => {
    for (const title of ['Troubleshooting and recovery', 'Identities and custom assets', 'Lottie']) {
      const block = fitHeadline({ ...COLUMN, title });
      expect(blockWidth(block)).toBeLessThanOrEqual(COLUMN.maxWidth);
      expect(blockHeight(block)).toBeLessThanOrEqual(COLUMN.maxHeight);
      expect(block.lines.length).toBeLessThanOrEqual(2);
      expect(block.style.size).toBeGreaterThanOrEqual(84);
    }

    const plain = fitHeadline({ ...COLUMN, maxHeight: 250, title: 'One studio for the whole brand.' });
    expect(plain.lines).toHaveLength(2);
    expect(plain.style.size).toBeGreaterThanOrEqual(72);

    const longest = 'Apply the identity to email, product UI, developer, social, editorial, and event work.'.slice(0, 84);
    const block = fitHeadline({ ...COLUMN, maxHeight: 250, title: longest });
    expect(blockWidth(block)).toBeLessThanOrEqual(COLUMN.maxWidth);
    expect(blockHeight(block)).toBeLessThanOrEqual(250);
  });

  it('places each word at its kerned advance, which Satori alone would not', () => {
    const block = fitHeadline({ ...COLUMN, title: 'AVATAR Type' });
    const [avatar] = block.lines.flat();
    const { size, tracking } = block.style;
    const scale = size / interDisplay600.unitsPerEm;
    const advances: Record<string, number> = interDisplay600.advances;
    const kerning: Record<string, Record<string, number>> = interDisplay600.kerning;
    const characters = Array.from('AVATAR');
    const unkerned = characters.reduce((total, character) => total + advances[character]! * scale + tracking * size, 0);
    const pairs = characters.slice(1).reduce((total, character, index) => total + (kerning[characters[index]!]?.[character] ?? 0) * scale, 0);

    expect(pairs).toBeLessThan(-10);
    expect(avatar!.width).toBeCloseTo(unkerned + pairs, 6);
    expect(avatar!.pieces[0]!.marginRight).toBeCloseTo(unkerned + pairs - Math.ceil(unkerned), 6);
  });

  it('ends a description longer than three lines with an ellipsis after the last whole word', () => {
    const markup = renderToStaticMarkup(
      <BrandOpenGraphImage
        description='Build, tune, and export a connected brand system with Glyphfield. Apply the identity to 89 templates for email, product UI, developer, social, editorial, event, and physical use.'
        title='Apply the identity'
      />
    );
    const nodes = textNodes(markup);
    const ellipsisIndex = nodes.indexOf('…');

    expect(ellipsisIndex).toBeGreaterThan(0);
    expect(nodes[ellipsisIndex - 1]).not.toMatch(/[,.;:]$/);
    expect(nodes.join('')).not.toContain('physicaluse.');
  });

  it('shortens /api/og text at a whole word within its limit', () => {
    const title = 'Apply the identity to email, product UI, developer, social, editorial, and event work.';
    expect(truncateAtWord(title, 84)).toBe('Apply the identity to email, product UI, developer, social, editorial, and event…');
    expect(truncateAtWord(title, 84).length).toBeLessThanOrEqual(84);
    expect(truncateAtWord('Short title.', 84)).toBe('Short title.');
    expect(truncateAtWord('Supercalifragilistic', 10)).toBe('Supercali…');
  });

  it('draws the field in the landing violets by default and from a custom accent otherwise', () => {
    const landing = renderToStaticMarkup(<BrandOpenGraphImage title='Make the identity visible.' />);
    for (const color of ['#201046', '#7058FF', '#C8C0FF']) expect(landing).toContain(`fill="${color}"`);

    const custom = renderToStaticMarkup(<BrandOpenGraphImage accent='#E5484D' title='Make the identity visible.' />);
    expect(custom).toContain('fill="#E5484D"');
    expect(custom).not.toContain('#201046');
  });

  it('sets the Studio capture over the field on the Studio card', () => {
    const markup = renderToStaticMarkup(
      <BrandOpenGraphImage {...STUDIO_OPEN_GRAPH_CARD} screenshot='data:image/jpeg;base64,AAAA' />
    );

    expect(markup).toContain('data-og-screenshot="studio"');
    expect(markup).toContain('src="data:image/jpeg;base64,AAAA"');
    expect(textNodes(markup).join('')).toContain('glyphfield.com/studio');
  });

  it('shrinks the headline rather than adding lines when the 2:1 Twitter card is shorter', () => {
    const markup = renderToStaticMarkup(<BrandOpenGraphImage {...HOME_OPEN_GRAPH_CARD} height={600} />);
    expect(markup).toContain('height:524px');
    expect(textNodes(markup).join('')).toContain('Onestudioforthewholebrand.');

    const tall = fitHeadline({ ...COLUMN, highlightedTitle: 'the whole brand.', title: HOME_OPEN_GRAPH_CARD.title });
    const short = fitHeadline({ ...COLUMN, highlightedTitle: 'the whole brand.', maxHeight: 170, title: HOME_OPEN_GRAPH_CARD.title });
    expect(short.lines).toHaveLength(2);
    expect(short.style.size).toBeLessThan(tall.style.size);
    expect(blockHeight(short)).toBeLessThanOrEqual(170);
  });

  it('writes alt text and copy as plain sentences without em dashes', () => {
    const copy = [HOME_OPEN_GRAPH_ALT, STUDIO_OPEN_GRAPH_ALT, ...Object.values(HOME_OPEN_GRAPH_CARD), ...Object.values(STUDIO_OPEN_GRAPH_CARD)];
    for (const value of copy) expect(value).not.toContain('—');
  });

  it('loads static Inter cuts that next/og can parse, with a legacy kern table', async () => {
    const fonts = await getBrandOpenGraphFonts();

    expect(fonts.map(({ name, weight }) => `${name} ${weight}`)).toEqual(['Inter Display 600', 'Inter 400', 'Inter 500']);
    for (const file of ['inter-display-600.ttf', 'inter-text-400.ttf', 'inter-text-500.ttf']) {
      const tables = sfntTables(file);
      expect(tables).toContain('kern');
      expect(tables).not.toContain('fvar');
      expect(tables).not.toContain('GPOS');
    }
  });
});
