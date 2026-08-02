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
});
