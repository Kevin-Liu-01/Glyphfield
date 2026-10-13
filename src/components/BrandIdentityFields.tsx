'use client';

import { useId, type ReactNode } from 'react';

import StudioRangeLabel from '@/components/StudioRangeLabel';
import StudioRange from '@/components/ui/StudioRange';

import styles from './BrandIdentityStudio.module.css';

export const INPUT_CLASS =
  'h-10 w-full border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-foreground';
export const TEXTAREA_CLASS =
  'min-h-24 w-full resize-y border border-input bg-background p-3 text-sm leading-6 text-foreground outline-none focus:border-foreground';

export function listValue(values: readonly string[]): string {
  return values.join('\n');
}

export function parseList(value: string): string[] {
  return value.split('\n').map((item) => item.trim()).filter(Boolean);
}

export function Field({ children, hint, label }: { children: ReactNode; hint?: ReactNode; label: ReactNode }) {
  return (
    <label className='brand-identity-field'>
      <span>{label}</span>
      {children}
      {hint ? <small className={styles.fieldHint}>{hint}</small> : null}
    </label>
  );
}

export function Panel({
  actions,
  children,
  description,
  id,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  id?: string;
  title: ReactNode;
}) {
  return (
    <section className={styles.panel} id={id}>
      <header className={styles.panelHeader}>
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className={styles.panelActions}>{actions}</div> : null}
      </header>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

export function TextField({
  label,
  maxLength,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  label: ReactNode;
  maxLength?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'email' | 'text' | 'url';
  value: string;
}) {
  return (
    <Field label={label}>
      <input className={INPUT_CLASS} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </Field>
  );
}

export function TextAreaField({ hint, label, onChange, value }: { hint?: ReactNode; label: ReactNode; onChange: (value: string) => void; value: string }) {
  return (
    <Field hint={hint} label={label}>
      <textarea className={TEXTAREA_CLASS} onChange={(event) => onChange(event.target.value)} value={value} />
    </Field>
  );
}

/** One item per line. Blank lines are dropped on change. */
export function ListField({ label, onChange, values }: { label: ReactNode; onChange: (values: string[]) => void; values: readonly string[] }) {
  return (
    <Field label={label}>
      <textarea className={TEXTAREA_CLASS} onChange={(event) => onChange(parseList(event.target.value))} value={listValue(values)} />
    </Field>
  );
}

export function RangeField({
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix = '',
  value,
}: {
  label: ReactNode;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  const resolvedValue = Math.min(value, max);
  const rangeLabelId = useId();
  return (
    <label htmlFor={`${rangeLabelId}-input`} className='brand-identity-range'>
      <StudioRangeLabel id={rangeLabelId} label={label} value={<output>{resolvedValue}{suffix}</output>} />
      <StudioRange id={`${rangeLabelId}-input`} aria-labelledby={rangeLabelId} max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} value={resolvedValue} />
    </label>
  );
}

/** A thin completeness meter. Its tone is the most severe open finding, not the ratio. */
export function Meter({ label, tone = 'pass', value }: { label: string; tone?: 'error' | 'info' | 'pass' | 'warning'; value: number }) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <span aria-label={label} className={styles.meter} data-tone={tone} role='img'>
      <span style={{ width: `${percent}%` }} />
    </span>
  );
}
