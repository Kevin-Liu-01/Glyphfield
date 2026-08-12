import { afterEach, describe, expect, it, vi } from 'vitest';

import { downloadBlob, downloadSvg } from '../download';

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
