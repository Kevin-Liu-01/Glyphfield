'use client';

import { useId, useState, type ReactNode } from 'react';
import { useGT } from 'gt-next';
import { Upload } from '@/components/ui/SolidIcons';
import { LabInspectorSection } from '@/components/LabWorkspace';
import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioRange from '@/components/ui/StudioRange';
import { Button } from '@/components/ui/Button';
import { useCommittedRef } from '@/hooks/useCommittedRef';
import { useMountEffect } from '@/hooks/useMountEffect';
import type { BrandIdentity } from '@/lib/brandIdentity';
import { blobToDataUrl, escapeXml } from '@/lib/download';

export const INPUT_CLASS =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground';
export const TEXTAREA_CLASS =
  'min-h-28 w-full resize-y rounded-md border border-input bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-foreground';

type LocalAsset = {
  name: string;
  url: string;
};

export function useLocalAsset() {
  const [asset, setAsset] = useState<LocalAsset | null>(null);
  const assetRef = useCommittedRef(asset);

  useMountEffect(
    () => () => {
      if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    }
  );

  async function select(file: File) {
    const nextAsset = { name: file.name, url: await blobToDataUrl(file) };
    assetRef.current = nextAsset;
    setAsset(nextAsset);
  }

  function restore(nextAsset: LocalAsset | null) {
    assetRef.current = nextAsset;
    setAsset(nextAsset);
  }

  function clear() {
    if (assetRef.current) URL.revokeObjectURL(assetRef.current.url);
    assetRef.current = null;
    setAsset(null);
  }

  return { asset, clear, restore, select };
}

export function ControlSection({ children, title }: { children: ReactNode; title: ReactNode }) {
  return (
    <LabInspectorSection className='tool-control-section' title={title}>
      {children}
    </LabInspectorSection>
  );
}

export function Field({ children, label }: { children: ReactNode; label: ReactNode }) {
  return (
    <label className='flex flex-col gap-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      {children}
    </label>
  );
}

export function RangeField({
  label,
  max,
  min,
  onChange,
  onChangeEnd,
  onChangeStart,
  step = 1,
  suffix = '',
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  onChangeEnd?: () => void;
  onChangeStart?: () => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  const resolvedValue = Math.min(value, max);
  const rangeLabelId = useId();
  return (
    <label htmlFor={`${rangeLabelId}-input`} className='flex flex-col gap-2 text-sm text-muted-foreground'>
      <StudioRangeLabel id={rangeLabelId}
        label={label}
        value={<output className='font-mono text-xs tabular-nums'>{resolvedValue}{suffix}</output>}
      />
      <StudioRange id={`${rangeLabelId}-input`} aria-labelledby={rangeLabelId}
        max={max}
        min={min}
        onBlur={onChangeEnd}
        onChange={(event) => onChange(Number(event.target.value))}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp'].includes(event.key)) onChangeStart?.();
        }}
        onKeyUp={(event) => {
          if (['ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'End', 'Home', 'PageDown', 'PageUp'].includes(event.key)) onChangeEnd?.();
        }}
        onPointerCancel={onChangeEnd}
        onPointerDown={onChangeStart}
        onPointerUp={onChangeEnd}
        step={step}
        value={resolvedValue}
      />
    </label>
  );
}

/** Compact numeric input; commits each valid value and keeps partial input ("-", "1.") as a draft. */
export function NumberField({
  ariaLabel,
  className = '',
  label,
  max,
  min,
  onCommit,
  step = 1,
  value,
}: {
  ariaLabel: string;
  className?: string;
  label: ReactNode;
  max?: number;
  min?: number;
  onCommit: (value: number) => void;
  step?: number;
  value: number;
}) {
  const gt = useGT();
  const [draft, setDraft] = useState<string | null>(null);
  const display = Math.round(value * 100) / 100;
  const commit = (raw: string) => {
    const next = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(next)) return;
    const clamped = Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next));
    if (clamped !== display) onCommit(clamped);
  };
  return (
    <label className={`grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-1 rounded-md border border-input pl-2 text-[11px] text-muted-foreground focus-within:border-foreground ${className}`.trim()}>
      <span aria-hidden='true'>{label}</span>
      <input
        aria-label={gt(ariaLabel)}
        className='h-8 min-w-0 border-0 bg-transparent text-[13px] tabular-nums text-foreground outline-none'
        inputMode='decimal'
        max={max}
        min={min}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
          commit(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') setDraft(null);
        }}
        step={step}
        type='number'
        value={draft ?? String(display)}
      />
    </label>
  );
}

export function SegmentedChoice<T extends string | number>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel?: string;
  onChange: (value: T) => void;
  options: readonly { label: string; value: T }[];
  value: T;
}) {
  const gt = useGT();

  return (
    <div
      aria-label={ariaLabel ? gt(ariaLabel) : undefined}
      className='grid grid-cols-2 gap-px overflow-hidden rounded-md border border-border bg-border'
      role={ariaLabel ? 'group' : undefined}
    >
      {options.map((option) => (
        <Button
          aria-pressed={value === option.value}
          className='rounded-none border-0'
          key={option.value}
          onClick={() => onChange(option.value)}
          size='sm'
          type='button'
          variant={value === option.value ? 'default' : 'secondary'}
        >
          {gt(option.label)}
        </Button>
      ))}
    </div>
  );
}

export function UploadField({
  accept,
  fileName,
  label,
  onFile,
}: {
  accept: string;
  fileName?: string;
  label: string;
  onFile: (file: File) => void;
}) {
  const gt = useGT();

  return (
    <label className='flex min-h-20 cursor-pointer items-center gap-3 rounded-md border border-dashed border-input p-3 hover:bg-muted'>
      <Upload className='size-4 shrink-0' aria-hidden='true' />
      <span className='min-w-0 flex-1'>
        <span className='block text-sm font-medium'>{gt(label)}</span>
        <span className='block truncate text-xs text-muted-foreground'>
          {fileName ?? gt('Choose a local file')}
        </span>
      </span>
      <input
        accept={accept}
        className='sr-only'
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
        type='file'
      />
    </label>
  );
}

export function monogramDataUrl(identity: BrandIdentity, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="none"/><text x="256" y="310" text-anchor="middle" fill="${color}" font-family="Switzer, Arial, sans-serif" font-size="180" font-weight="550">${escapeXml(identity.shortName)}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
