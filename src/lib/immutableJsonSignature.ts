// Internal change detection for immutable editor snapshots, never portable data.
// Cache unchanged branches so moving a layer does not repeatedly hash embedded
// images/fonts or every other artboard. Two independent hashes reduce collisions
// without retaining megabyte-sized JSON strings in each undo entry.
const objectSignatures = new WeakMap<object, string>();
const stringSignatures = new Map<string, string>();
const MAX_STRING_CACHE_BYTES = 8_000_000;
let stringCacheBytes = 0;

function digest(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${value.length}:${(first >>> 0).toString(16)}:${(second >>> 0).toString(16)}`;
}

/** Call only with immutable JSON-like state; replace changed objects first. */
export function immutableJsonSignature(value: unknown): string {
  if (typeof value === 'string') {
    if (value.length < 1024) return `s${JSON.stringify(value)}`;
    const cached = stringSignatures.get(value);
    if (cached) return cached;
    const signature = `s#${digest(value)}`;
    if (value.length * 2 <= MAX_STRING_CACHE_BYTES) {
      while (stringCacheBytes + value.length * 2 > MAX_STRING_CACHE_BYTES) {
        const oldest = stringSignatures.keys().next().value!;
        stringCacheBytes -= oldest.length * 2;
        stringSignatures.delete(oldest);
      }
      stringSignatures.set(value, signature);
      stringCacheBytes += value.length * 2;
    }
    return signature;
  }
  if (!value || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  const cached = objectSignatures.get(value);
  if (cached) return cached;
  const content = Array.isArray(value)
    ? `[${value.map(immutableJsonSignature).join(',')}]`
    : `{${Object.entries(value).filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, entry]) => `${JSON.stringify(key)}:${immutableJsonSignature(entry)}`).join(',')}}`;
  const signature = digest(content);
  objectSignatures.set(value, signature);
  return signature;
}
