import { afterEach, describe, expect, it, vi } from 'vitest';

import { registerStudioAutomation } from '../studioAutomation';

describe('Studio browser automation', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('downloads a generated artifact through the stable browser API', async () => {
    vi.useFakeTimers();
    const anchor = {
      click: vi.fn(),
      download: '',
      href: '',
      remove: vi.fn(),
      style: { display: '' },
    };
    const createObjectURL = vi.fn(() => 'blob:glyphfield-agent-export');
    const revokeObjectURL = vi.fn();
    const browserWindow = {
      dispatchEvent: vi.fn(),
      setTimeout,
    } as unknown as Window & typeof globalThis;
    vi.stubGlobal('document', {
      body: { append: vi.fn() },
      createElement: vi.fn(() => anchor),
    });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.stubGlobal('window', browserWindow);
    vi.stubGlobal('CustomEvent', class CustomEvent {});

    const unregister = registerStudioAutomation({
      actions: ['artifact.download'],
      toolId: 'material',
    });
    const artifact = {
      blob: new Blob(['animated'], { type: 'image/gif' }),
      fileName: 'glyphfield-motion.gif',
    };

    expect(window.glyphfield?.studio.describe().actions).toContain('artifact.download');
    await expect(window.glyphfield?.studio.invoke('artifact.download', artifact)).resolves.toEqual({
      fileName: 'glyphfield-motion.gif',
    });
    expect(anchor.download).toBe('glyphfield-motion.gif');
    expect(anchor.href).toBe('blob:glyphfield-agent-export');
    expect(anchor.click).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1_000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:glyphfield-agent-export');

    unregister();
    expect(window.glyphfield).toBeUndefined();
  });
});
