// Persisted with saved built-in projects. Keep the canonical form and digest
// stable: changing either makes every saved built-in look edited.
const VOLATILE_KEYS = new Set(['builtIn', 'kind', 'presetFingerprint', 'revision']);

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => item === undefined ? 'null' : canonicalJson(item)).join(',')}]`;
  }
  return `{${Object.entries(value)
    .filter(([, entry]) => entry !== undefined && typeof entry !== 'function')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function digest(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${value.length.toString(36)}.${(first >>> 0).toString(36)}.${(second >>> 0).toString(36)}`;
}

/** Content fingerprint of an identity, ignoring project bookkeeping fields. */
export function brandIdentityFingerprint(identity: object): string {
  const content = Object.fromEntries(
    Object.entries(identity).filter(([key]) => !VOLATILE_KEYS.has(key))
  );
  return `bif1.${digest(canonicalJson(content))}`;
}
