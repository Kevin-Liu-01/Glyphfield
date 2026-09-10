// @vitest-environment happy-dom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ArrowRight as PhosphorArrowRight, GithubLogo } from '@phosphor-icons/react/ssr';
import { act, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ArrowRight, Github } from '@/components/ui/SolidIcons';
import * as sharedIcons from '@/components/ui/SolidIcons';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('shared weighted icons', () => {
  it('declares only the icon leaves side-effect-free so the compatibility barrel can drop unused aliases', () => {
    const metadata = JSON.parse(readFileSync('src/components/ui/icons/package.json', 'utf8'));
    expect(metadata).toEqual({ sideEffects: false });
    expect(JSON.parse(readFileSync('package.json', 'utf8')).sideEffects).toBeUndefined();
  });

  it('keeps every alias in an independent leaf so unused icons are not eagerly constructed', () => {
    const source = readFileSync('src/components/ui/SolidIcons.tsx', 'utf8');
    const exports = [...source.matchAll(/^export \{ (\w+) \} from '([^']+)';/gm)];
    expect(exports.map((entry) => entry[1]).sort()).toEqual(Object.keys(sharedIcons).sort());
    for (const [, name, path] of exports) {
      const leaf = readFileSync(resolve('src/components/ui', `${path}.tsx`), 'utf8');
      expect(leaf).toMatch(/from '@phosphor-icons\/react\/dist\/ssr\/\w+';/);
      expect(leaf).toContain(`export const ${name} = /*#__PURE__*/`);
      expect(leaf).not.toMatch(/from '@phosphor-icons\/react\/ssr'/);
    }
  });

  it('renders filled object icons exactly as their existing Phosphor source', () => {
    const props = { 'aria-label': 'View on GitHub', className: 'brand-icon', color: '#7BFFD9', size: 28 };
    expect(renderToStaticMarkup(<Github {...props} />))
      .toBe(renderToStaticMarkup(<GithubLogo {...props} weight='fill' />));
    expect(Github.displayName).toBe('Github');
    expect(Github).not.toBe(GithubLogo);
  });

  it('renders regular controls exactly as their existing Phosphor source', () => {
    const props = { 'aria-hidden': true as const, className: 'control-icon', size: 16 };
    expect(renderToStaticMarkup(<ArrowRight {...props} />))
      .toBe(renderToStaticMarkup(<PhosphorArrowRight {...props} weight='regular' />));
    expect(ArrowRight.displayName).toBe('ArrowRight');
  });

  it('preserves explicit weight overrides for both factory defaults', () => {
    expect(renderToStaticMarkup(<Github weight='regular' />))
      .toBe(renderToStaticMarkup(<GithubLogo weight='regular' />));
    expect(renderToStaticMarkup(<ArrowRight weight='bold' />))
      .toBe(renderToStaticMarkup(<PhosphorArrowRight weight='bold' />));
  });

  it('forwards SVG refs and attributes without changing the source component', () => {
    const host = document.body.appendChild(document.createElement('div'));
    const root = createRoot(host);
    const ref = createRef<SVGSVGElement>();
    const originalName = GithubLogo.displayName;
    try {
      act(() => root.render(<Github aria-label='GitHub' data-icon-purpose='source' ref={ref} />));
      expect(ref.current).toBe(host.querySelector('svg'));
      expect(ref.current?.getAttribute('aria-label')).toBe('GitHub');
      expect(ref.current?.getAttribute('data-icon-purpose')).toBe('source');
      expect(GithubLogo.displayName).toBe(originalName);
    } finally {
      act(() => root.unmount());
      host.remove();
    }
    expect(ref.current).toBeNull();
  });
});
