import type { ReactNode } from 'react';

export function ConditionalRender({ children, when }: {
  children: () => ReactNode;
  when: boolean;
}) {
  return when ? children() : null;
}

export function OptionalRender<T>({ children, value }: {
  children: (value: T) => ReactNode;
  value: T | null | undefined;
}) {
  return value === null || value === undefined ? null : children(value);
}
