import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  browserSupportsWebGL2,
  markWebGLContextUnavailable,
  resetWebGLContextAvailability,
} from '../webglContext';

describe('WebGL context availability', () => {
  afterEach(() => {
    resetWebGLContextAvailability();
    vi.unstubAllGlobals();
  });

  it('fails closed when a sandboxed browser cannot create WebGL2', () => {
    const getContext = vi.fn(() => null);
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ getContext })),
    });

    expect(browserSupportsWebGL2()).toBe(false);
    expect(browserSupportsWebGL2()).toBe(false);
    expect(getContext).toHaveBeenCalledTimes(1);
  });

  it('releases a successful probe context and reports support', () => {
    const loseContext = vi.fn();
    const getExtension = vi.fn(() => ({ loseContext }));
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({
        getContext: vi.fn(() => ({ getExtension })),
      })),
    });

    expect(browserSupportsWebGL2()).toBe(true);
    expect(getExtension).toHaveBeenCalledWith('WEBGL_lose_context');
    expect(loseContext).toHaveBeenCalledOnce();
  });

  it('does not probe again during the failure cooldown', () => {
    const createElement = vi.fn();
    vi.stubGlobal('document', { createElement });

    markWebGLContextUnavailable();

    expect(browserSupportsWebGL2()).toBe(false);
    expect(createElement).not.toHaveBeenCalled();
  });

  it('re-probes after a short failure cooldown instead of caching a transient failure', () => {
    let currentTime = 0;
    const getContext = vi.fn()
      .mockReturnValueOnce(null)
      .mockReturnValue({ getExtension: vi.fn(() => null) });
    vi.stubGlobal('performance', { now: () => currentTime });
    vi.stubGlobal('document', {
      createElement: vi.fn(() => ({ getContext })),
    });

    expect(browserSupportsWebGL2()).toBe(false);
    currentTime = 1_999;
    expect(browserSupportsWebGL2()).toBe(false);
    expect(getContext).toHaveBeenCalledOnce();

    currentTime = 2_001;
    expect(browserSupportsWebGL2()).toBe(true);
    expect(getContext).toHaveBeenCalledTimes(2);
  });
});
