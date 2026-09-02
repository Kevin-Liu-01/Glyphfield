import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob, downloadSvg, imageUrlToDataUrl } from '../download';

describe('browser downloads', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('attaches, clicks, and removes a blob download before revoking its URL', () => {
    vi.useFakeTimers();
    const anchor = {
      click: vi.fn(),
      download: '',
      href: '',
      remove: vi.fn(),
      style: { display: '' },
    };
    const append = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:glyphfield-export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('document', {
      body: { append },
      createElement: vi.fn(() => anchor),
    });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('window', { setTimeout });

    downloadBlob(new Blob(['gif'], { type: 'image/gif' }), 'motion.gif');

    expect(anchor.download).toBe('motion.gif');
    expect(anchor.href).toBe('blob:glyphfield-export');
    expect(anchor.style.display).toBe('none');
    expect(append).toHaveBeenCalledWith(anchor);
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:glyphfield-export');
  });

  it('keeps an SVG object URL alive long enough for the browser to consume it', () => {
    vi.useFakeTimers();
    const anchor = {
      click: vi.fn(),
      download: '',
      href: '',
      remove: vi.fn(),
      style: { display: '' },
    };
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('document', {
      body: { append: vi.fn() },
      createElement: vi.fn(() => anchor),
    });
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:glyphfield-svg'),
      revokeObjectURL,
    });
    vi.stubGlobal('window', { setTimeout });

    downloadSvg('<svg/>', 'mark.svg');

    expect(anchor.click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:glyphfield-svg');
  });
});

describe('asset embedding', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns embedded data without another browser request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);

    await expect(imageUrlToDataUrl('data:image/png;base64,aGVybw=='))
      .resolves.toBe('data:image/png;base64,aGVybw==');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shares concurrent embedding work and releases it after completion', async () => {
    class Reader {
      error = null;
      result: string | null = null;
      private listeners = new Map<string, () => void>();

      addEventListener(type: string, listener: () => void) {
        this.listeners.set(type, listener);
      }

      readAsDataURL() {
        this.result = 'data:image/png;base64,aGVybw==';
        queueMicrotask(() => this.listeners.get('load')?.());
      }
    }
    const fetch = vi.fn(async () => ({
      blob: async () => new Blob(['hero'], { type: 'image/png' }),
      ok: true,
      status: 200,
    }));
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('FileReader', Reader);

    const first = imageUrlToDataUrl('/hero.png');
    const second = imageUrlToDataUrl('/hero.png');
    expect(second).toBe(first);
    await expect(first).resolves.toBe('data:image/png;base64,aGVybw==');
    expect(fetch).toHaveBeenCalledTimes(1);

    await imageUrlToDataUrl('/hero.png');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retain failed requests', async () => {
    const fetch = vi.fn(async () => ({ blob: vi.fn(), ok: false, status: 404 }));
    vi.stubGlobal('fetch', fetch);

    await expect(imageUrlToDataUrl('/missing.png')).rejects.toThrow('404');
    await expect(imageUrlToDataUrl('/missing.png')).rejects.toThrow('404');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
