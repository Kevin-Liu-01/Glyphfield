'use client';

import { useMemo } from 'react';
import { useGT, useLocale, useVersionId, type GTTranslationOptions } from 'gt-next';

const translatedStringCaches = new Map<string, Map<string, string>>();

/**
 * General Translation performs locale negotiation for every call. Studio control
 * labels are overwhelmingly static, so keep those resolved strings for the
 * current locale instead of repeating that work during every slider tick.
 */
export function useCachedGT(): ReturnType<typeof useGT> {
  const gt = useGT();
  const locale = useLocale();
  const versionId = useVersionId();
  const localeKey = `${locale}:${versionId ?? 'current'}`;
  const cache = useMemo(() => {
    const current = translatedStringCaches.get(localeKey);
    if (current) return current;
    const next = new Map<string, string>();
    translatedStringCaches.set(localeKey, next);
    return next;
  }, [localeKey]);
  return useMemo(() => {
    return (message: string, options?: GTTranslationOptions) => {
      const key = options ? `${message}\u0000${JSON.stringify(options)}` : message;
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const translated = gt(message, options);
      cache.set(key, translated);
      return translated;
    };
  }, [cache, gt]);
}
