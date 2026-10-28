'use client';

import type { BrandIdentity } from '@/lib/brandIdentity';
import { blobToDataUrl } from '@/lib/download';
import { EXPRESSION_COLOR_ROLES, type ExpressionColor } from '@/lib/expressionModel';

export async function readFileAsAsset(file: File): Promise<{ name: string; url: string }> {
  return { name: file.name, url: await blobToDataUrl(file) };
}

/** Width / height of an image; SVGs without intrinsic size fall back to the viewBox. */
export async function measureImageAspect(source: string, fallback = 1): Promise<number> {
  try {
    const image = new Image();
    image.src = source;
    await image.decode();
    if (image.naturalWidth > 0 && image.naturalHeight > 0) return image.naturalWidth / image.naturalHeight;
  } catch {
    // Fall through to the viewBox read below.
  }
  try {
    const text = source.startsWith('data:image/svg+xml')
      ? decodeURIComponent(source.slice(source.indexOf(',') + 1))
      : source.endsWith('.svg') ? await (await fetch(source)).text() : '';
    const viewBox = /viewBox="\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)/.exec(text);
    if (viewBox) return Number(viewBox[1]) / Number(viewBox[2]);
  } catch {
    // Keep the fallback.
  }
  return fallback;
}

export function colorRoleOptions(identity: BrandIdentity, options: { custom?: string; none?: boolean } = {}) {
  const named = new Map(identity.colors.map((color) => [color.id, color]));
  return [
    ...(options.none ? [{ label: 'None', value: 'none' }] : []),
    ...EXPRESSION_COLOR_ROLES.flatMap((role) => {
      const color = named.get(role);
      return color ? [{ label: `${color.name} · ${color.hex.toUpperCase()}`, value: role }] : role === 'ink' || role === 'paper' ? [{ label: role === 'ink' ? 'Ink' : 'Paper', value: role }] : [];
    }),
    ...(options.custom && options.custom.startsWith('#') ? [{ label: `Custom · ${options.custom.toUpperCase()}`, value: options.custom }] : []),
    { label: 'Custom color…', value: 'custom' },
  ];
}

export function isLiteralColor(value: ExpressionColor | undefined): boolean {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

/** Parse "2, 4-6" into [2, 4, 5, 6]. */
export function parseLineList(value: string): number[] {
  const lines = new Set<number>();
  for (const part of value.split(',')) {
    const range = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
    if (!range) continue;
    const start = Number(range[1]);
    const end = Number(range[2] ?? range[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) continue;
    const min = Math.max(1, Math.min(start, end));
    for (let line = min; line <= Math.min(Math.max(start, end), min + 199); line += 1) {
      lines.add(line);
    }
  }
  return [...lines].sort((first, second) => first - second);
}

export function formatLineList(lines: readonly number[]): string {
  const parts: string[] = [];
  let start: number | null = null;
  let previous: number | null = null;
  for (const line of [...lines].sort((first, second) => first - second)) {
    if (start === null) {
      start = line;
    } else if (previous !== null && line !== previous + 1) {
      parts.push(start === previous ? String(start) : `${start}-${previous}`);
      start = line;
    }
    previous = line;
  }
  if (start !== null && previous !== null) parts.push(start === previous ? String(start) : `${start}-${previous}`);
  return parts.join(', ');
}
