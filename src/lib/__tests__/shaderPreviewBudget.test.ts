import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  requestShaderPreviewSlot,
  resetShaderPreviewBudgetForTests,
  shaderPreviewBudgetState,
} from '@/lib/shaderPreviewBudget';

describe('shader preview budget', () => {
  afterEach(() => {
    resetShaderPreviewBudgetForTests();
    vi.useRealTimers();
  });

  it('limits simultaneous preview renderers and promotes queued previews', () => {
    vi.useFakeTimers();
    const grants = Array.from({ length: 6 }, () => vi.fn());
    const releases = grants.map((grant) => requestShaderPreviewSlot(grant));

    expect(grants.map((grant) => grant.mock.calls.length)).toEqual([1, 1, 1, 1, 0, 0]);
    expect(shaderPreviewBudgetState()).toEqual({ active: 4, limit: 4, pending: 2 });

    releases[1]!();
    expect(grants[4]).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(grants[4]).toHaveBeenCalledOnce();
    expect(shaderPreviewBudgetState()).toEqual({ active: 4, limit: 4, pending: 1 });

    releases.forEach((release) => release());
    vi.runAllTimers();
    expect(shaderPreviewBudgetState()).toEqual({ active: 0, limit: 4, pending: 0 });
  });

  it('removes a queued preview when it becomes hidden', () => {
    vi.useFakeTimers();
    const releases = Array.from({ length: 4 }, () => requestShaderPreviewSlot(vi.fn()));
    const queuedGrant = vi.fn();
    const releaseQueued = requestShaderPreviewSlot(queuedGrant);

    releaseQueued();
    releases[0]!();
    vi.advanceTimersByTime(300);

    expect(queuedGrant).not.toHaveBeenCalled();
    expect(shaderPreviewBudgetState()).toEqual({ active: 3, limit: 4, pending: 0 });
    releases.forEach((release) => release());
    vi.runAllTimers();
  });
});
