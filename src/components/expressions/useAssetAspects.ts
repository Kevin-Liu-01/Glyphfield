import { useEffect, useRef, useState } from 'react';

import type { CanvasDocument } from '@/lib/canvasDocument';
import { dataUrlAspect } from '@/lib/expressionGeneration';
import { measureImageAspect } from './expressionEditorUtils';

/**
 * Image aspect ratios by asset id; logos and partner marks are fitted with
 * exact boxes. A failed measurement is remembered per source so the same
 * unreadable image is not measured forever; a changed source retries.
 */
export function useAssetAspects(assets: CanvasDocument['assets']): ReadonlyMap<string, number> {
  const [aspects, setAspects] = useState<ReadonlyMap<string, number>>(() => new Map());
  const failed = useRef(new Map<string, string>());
  useEffect(() => {
    let active = true;
    const pending = Object.values(assets).filter((asset) => (
      asset.kind === 'image' && !aspects.has(asset.id) && failed.current.get(asset.id) !== asset.source
    ));
    if (pending.length === 0) return;
    void Promise.all(pending.map(async (asset) => [
      asset.id,
      asset.source,
      dataUrlAspect(asset.source) ?? await measureImageAspect(asset.source, 0),
    ] as const)).then((entries) => {
      if (!active) return;
      entries.forEach(([id, source, aspect]) => {
        if (aspect > 0) failed.current.delete(id);
        else failed.current.set(id, source);
      });
      setAspects((current) => {
        const next = new Map(current);
        entries.forEach(([id, , aspect]) => { if (aspect > 0) next.set(id, aspect); });
        return next.size === current.size ? current : next;
      });
    });
    return () => { active = false; };
  }, [aspects, assets]);
  return aspects;
}
