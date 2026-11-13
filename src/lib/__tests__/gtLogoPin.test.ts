// @vitest-environment happy-dom

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Prototemplate's public/brand/gt-globe-logo.json fingerprint of LOGO.d (the refined globe, 2026-11-12).
const LOGO_SHA = '4cd01651f9291bb8efba81f2bd255d4e90247e3d5454d9ab38edfe2f4c6b46a4';
const PREVIOUS_LOGO_SHA = '50fbc3ecf6a586e6bd1aec15d6cb0518efea8fd83ec0a0e45d69a4fce65b243c';

const LOGO_COPIES = [
  'public/brand/gt-wordmark.svg',
  'public/brands/gt/logos/banner-black.svg',
  'public/brands/gt/logos/banner-white.svg',
  'public/brands/gt/logos/mark-black.svg',
  'public/brands/gt/logos/mark-white.svg',
  'public/brands/gt/logos/wordmark-black.svg',
  'public/brands/gt/logos/wordmark-white.svg',
];

function svgFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return svgFiles(path);
    return entry.name.endsWith('.svg') ? [path] : [];
  });
}

function pathHashes(file: string): string[] {
  const svg = new DOMParser().parseFromString(readFileSync(file, 'utf8'), 'image/svg+xml');
  return Array.from(svg.querySelectorAll('path[d]'), (path) => createHash('sha256').update(path.getAttribute('d') ?? '').digest('hex'));
}

describe('General Translation logo pin', () => {
  it.each(LOGO_COPIES)('%s draws the refined globe', (file) => {
    expect(pathHashes(file)).toContain(LOGO_SHA);
  });

  it('no SVG carries the 11-06 globe', () => {
    const stale = [...svgFiles('public'), ...svgFiles('src')].filter((file) => pathHashes(file).includes(PREVIOUS_LOGO_SHA));
    expect(stale).toEqual([]);
  }, 30_000);
});
