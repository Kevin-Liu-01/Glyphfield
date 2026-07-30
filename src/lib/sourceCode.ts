export function stringifySource(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function parseSourceObject(source: string): Record<string, unknown> {
  const value: unknown = JSON.parse(source);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Source must contain a JSON object.');
  }
  return value as Record<string, unknown>;
}

export function sourceString(
  value: Record<string, unknown>,
  key: string,
  fallback: string
): string {
  return typeof value[key] === 'string' ? value[key] : fallback;
}

export function sourceNumber(
  value: Record<string, unknown>,
  key: string,
  fallback: number
): number {
  return typeof value[key] === 'number' && Number.isFinite(value[key])
    ? value[key]
    : fallback;
}

export function sourceBoolean(
  value: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  return typeof value[key] === 'boolean' ? value[key] : fallback;
}

export function sourceObject(
  value: Record<string, unknown>,
  key: string
): Record<string, unknown> | null {
  const nested = value[key];
  return nested && typeof nested === 'object' && !Array.isArray(nested)
    ? (nested as Record<string, unknown>)
    : null;
}

export function sourceStringArray(
  value: Record<string, unknown>,
  key: string,
  fallback: string[]
): string[] {
  const nested = value[key];
  return Array.isArray(nested) && nested.every((item) => typeof item === 'string')
    ? nested
    : fallback;
}

export function sourceObjectArray(
  value: Record<string, unknown>,
  key: string
): Record<string, unknown>[] | null {
  const nested = value[key];
  return Array.isArray(nested) && nested.every(
    (item) => item && typeof item === 'object' && !Array.isArray(item)
  )
    ? (nested as Record<string, unknown>[])
    : null;
}
