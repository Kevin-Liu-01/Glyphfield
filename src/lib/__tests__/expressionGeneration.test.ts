import { describe, expect, it } from 'vitest';

import { dataUrlAspect } from '../expressionGeneration';

function svgData(svg: string, base64 = true): string {
  return `data:image/svg+xml${base64 ? `;base64,${Buffer.from(svg).toString('base64')}` : `,${encodeURIComponent(svg)}`}`;
}

describe('dataUrlAspect', () => {
  it('reads viewBox and explicit dimensions from base64 and percent-encoded SVG data URLs', () => {
    expect(dataUrlAspect(svgData('<svg viewBox="0 0 1200 630"><rect/></svg>'))).toBeCloseTo(1200 / 630);
    expect(dataUrlAspect(svgData('<svg width="800" height="600"><rect/></svg>'))).toBeCloseTo(800 / 600);
    expect(dataUrlAspect(svgData('<svg width="800" height="600"><rect/></svg>', false))).toBeCloseTo(800 / 600);
  });

  it('reads a root tag that follows a doctype and comments', () => {
    const svg = '<?xml version="1.0"?>\n<!-- comment -->\n<svg width="640" height="480"></svg>';
    expect(dataUrlAspect(svgData(svg))).toBeCloseTo(640 / 480);
  });

  it('returns null promptly for payloads full of unclosed svg openings', () => {
    const bare = svgData('<svg'.repeat(250_000));
    const spaced = svgData('<svg '.repeat(250_000));
    const start = Date.now();
    expect(dataUrlAspect(bare)).toBeNull();
    expect(dataUrlAspect(spaced)).toBeNull();
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it('returns null when the root tag exceeds 8 KiB', () => {
    const svg = `<svg ${'x'.repeat(9_000)} width="10" height="10"></svg>`;
    expect(dataUrlAspect(svgData(svg))).toBeNull();
  });

  it('returns null for an svg-looking element name like svgx', () => {
    expect(dataUrlAspect(svgData('<svgx width="10" height="10"></svgx>'))).toBeNull();
  });
});

describe('rootSvgTag prolog handling', () => {
  it('skips comments containing svg text before the real root', () => {
    expect(dataUrlAspect(svgData('<!-- Example: <svg> -->\n<svg viewBox="0 0 1200 600"/>'))).toBeCloseTo(2);
  });

  it('reads the viewBox when a quoted > appears before it', () => {
    expect(dataUrlAspect(svgData('<svg data-note="a > b" viewBox="0 0 10 5"></svg>'))).toBeCloseTo(2);
  });

  it('skips an XML declaration, a DOCTYPE with an internal subset and comments', () => {
    const svg = '<?xml version="1.0"?>\n<!DOCTYPE svg [<!ENTITY x "y">]>\n<!-- note -->\n<svg width="640" height="320"></svg>';
    expect(dataUrlAspect(svgData(svg))).toBeCloseTo(2);
  });

  it('returns null for unterminated prolog constructs', () => {
    expect(dataUrlAspect(svgData('<!-- never closed <svg width="1" height="1">'))).toBeNull();
    expect(dataUrlAspect(svgData('<?xml version="1.0" <svg width="1" height="1">'))).toBeNull();
    expect(dataUrlAspect(svgData('<!DOCTYPE svg [ <svg width="1" height="1">'))).toBeNull();
  });

  it('returns null promptly for repeated unclosed comment and PI opens', () => {
    const comments = svgData('<!--'.repeat(250_000));
    const instructions = svgData('<?'.repeat(250_000));
    const doctypes = svgData('<!a>'.repeat(250_000));
    const start = Date.now();
    expect(dataUrlAspect(comments)).toBeNull();
    expect(dataUrlAspect(instructions)).toBeNull();
    expect(dataUrlAspect(doctypes)).toBeNull();
    expect(Date.now() - start).toBeLessThan(1_000);
  });
});
