import { describe, expect, it, vi } from 'vitest';

import { createPortableAssetResolverCache } from '@/lib/portableCanvasAssets';

describe('portable canvas asset resolver cache', () => {
  it('reuses retained conversions and passes embedded sources through', async () => {
    const load = vi.fn(async (source: string) => `data:image/png;base64,${source}`);
    const cache = createPortableAssetResolverCache(load);
    cache.retain(['blob:first']);

    expect(await cache.resolve('blob:first')).toBe('data:image/png;base64,blob:first');
    expect(await cache.resolve('blob:first')).toBe('data:image/png;base64,blob:first');
    expect(await cache.resolve('data:image/svg+xml;base64,mark')).toBe('data:image/svg+xml;base64,mark');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('prunes removed sources and clears all document-scoped entries', async () => {
    const load = vi.fn(async (source: string) => `data:image/png;base64,${source}`);
    const cache = createPortableAssetResolverCache(load);
    cache.retain(['blob:first']);
    await cache.resolve('blob:first');

    cache.retain([]);
    await cache.resolve('blob:first');
    cache.retain(['blob:first']);
    await cache.resolve('blob:first');
    cache.clear();
    cache.retain(['blob:first']);
    await cache.resolve('blob:first');

    expect(load).toHaveBeenCalledTimes(4);
  });

  it('keeps cached conversions whose sources remain in the active document', async () => {
    const load = vi.fn(async (source: string) => `data:image/png;base64,${source}`);
    const cache = createPortableAssetResolverCache(load);
    cache.retain(['blob:first', 'blob:second']);
    await cache.resolve('blob:first');
    await cache.resolve('blob:second');

    cache.retain(['blob:first']);
    await expect(cache.resolve('blob:first')).resolves.toBe('data:image/png;base64,blob:first');
    expect(load).toHaveBeenCalledTimes(2);

    await cache.resolve('blob:second');
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('treats data-looking text in an external URL as a resource that still needs embedding', async () => {
    const load = vi.fn(async () => 'data:image/png;base64,embedded');
    const cache = createPortableAssetResolverCache(load);
    const source = 'https://assets.example/data:image.png';
    cache.retain([source]);

    await expect(cache.resolve(source)).resolves.toBe('data:image/png;base64,embedded');
    expect(load).toHaveBeenCalledOnce();
  });

  it('invalidates pending conversions and retention when the owning document is cleared', async () => {
    const finishes: Array<(value: string) => void> = [];
    const load = vi.fn(() => new Promise<string>((resolve) => finishes.push(resolve)));
    const cache = createPortableAssetResolverCache(load);
    cache.retain(['blob:asset']);
    const stale = cache.resolve('blob:asset');

    cache.clear();
    cache.retain(['blob:asset']);
    const current = cache.resolve('blob:asset');
    expect(load).toHaveBeenCalledTimes(2);
    finishes[0]!('data:image/png;base64,stale');
    await stale;

    const concurrent = cache.resolve('blob:asset');
    expect(load).toHaveBeenCalledTimes(2);
    finishes[1]!('data:image/png;base64,current');
    await expect(Promise.all([current, concurrent])).resolves.toEqual([
      'data:image/png;base64,current',
      'data:image/png;base64,current',
    ]);

    cache.clear();
    const afterClear = cache.resolve('blob:asset');
    expect(load).toHaveBeenCalledTimes(3);
    finishes[2]!('data:image/png;base64,after-clear');
    await afterClear;

    const stillUnretained = cache.resolve('blob:asset');
    expect(load).toHaveBeenCalledTimes(4);
    finishes[3]!('data:image/png;base64,still-unretained');
    await stillUnretained;
  });

  it('does not retain a conversion completed after its source was removed', async () => {
    let finish!: (value: string) => void;
    let loadCount = 0;
    const load = vi.fn(() => {
      loadCount += 1;
      if (loadCount > 1) return Promise.resolve('data:image/png;base64,reloaded');
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    });
    const cache = createPortableAssetResolverCache(load);
    cache.retain(['blob:slow']);
    const pending = cache.resolve('blob:slow');
    cache.retain([]);
    finish('data:image/png;base64,slow');
    await pending;

    await cache.resolve('blob:slow');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('invariant_concurrent_requests_share_one_asset_conversion', async () => {
    let finish!: (value: string) => void;
    const load = vi.fn(() => new Promise<string>((resolve) => {
      finish = resolve;
    }));
    const cache = createPortableAssetResolverCache(load);
    cache.retain(['blob:shared']);

    const first = cache.resolve('blob:shared');
    const second = cache.resolve('blob:shared');
    expect(load).toHaveBeenCalledOnce();

    finish('data:image/png;base64,shared');
    await expect(Promise.all([first, second])).resolves.toEqual([
      'data:image/png;base64,shared',
      'data:image/png;base64,shared',
    ]);
    expect(await cache.resolve('blob:shared')).toBe('data:image/png;base64,shared');
    expect(load).toHaveBeenCalledOnce();
  });
});
