export type PortableAssetLoader = (source: string) => Promise<string>;

export type PortableAssetResolverCache = {
  clear: () => void;
  resolve: PortableAssetLoader;
  retain: (sources: Iterable<string>) => void;
};

function requiresEmbedding(source: string): boolean {
  return !/^data:/i.test(source);
}

/**
 * Keeps expensive blob/network-to-data-URL conversions stable while a canvas
 * document is being edited. Entries disappear as soon as their source leaves
 * the active document, and the owning hook clears the cache on unmount.
 */
export function createPortableAssetResolverCache(
  load: PortableAssetLoader
): PortableAssetResolverCache {
  const embedded = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();
  let generation = Symbol('portable-asset-generation');
  let retained = new Set<string>();

  return {
    clear() {
      generation = Symbol('portable-asset-generation');
      embedded.clear();
      pending.clear();
      retained.clear();
    },
    async resolve(source) {
      if (!requiresEmbedding(source)) return source;
      const cached = embedded.get(source);
      if (cached) return cached;
      const active = pending.get(source);
      if (active) return active;
      const operationGeneration = generation;
      const operation = load(source)
        .then((resolved) => {
          if (generation === operationGeneration && retained.has(source)) {
            embedded.set(source, resolved);
          }
          return resolved;
        })
        .finally(() => {
          if (pending.get(source) === operation) pending.delete(source);
        });
      pending.set(source, operation);
      return operation;
    },
    retain(sources) {
      // Stryker disable next-line MethodExpression: filtering embedded data URLs is an internal memory optimization; resolve intentionally bypasses them either way.
      retained = new Set([...sources].filter(requiresEmbedding));
      for (const source of embedded.keys()) {
        if (!retained.has(source)) embedded.delete(source);
      }
    },
  };
}
