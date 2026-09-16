import { describe, expect, it, vi } from 'vitest';
import { createAnalyticsAuthorityLifecycle } from '../authorityLifecycle';

function deferred(): { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('analytics authority lifecycle', () => {
  it('coalesces concurrent launch and foreground reconciliation', async () => {
    const first = deferred();
    const sync = vi.fn(() => first.promise);
    const lifecycle = createAnalyticsAuthorityLifecycle(sync);

    const launch = lifecycle.reconcile();
    const foreground = lifecycle.reconcile();

    expect(foreground).toBe(launch);
    await Promise.resolve();
    expect(sync).toHaveBeenCalledTimes(1);

    first.resolve();
    await launch;
  });

  it('allows a later foreground retry after a failed reconciliation', async () => {
    const sync = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined);
    const lifecycle = createAnalyticsAuthorityLifecycle(sync);

    await expect(lifecycle.reconcile()).rejects.toThrow('offline');
    await lifecycle.reconcile();

    expect(sync).toHaveBeenCalledTimes(2);
  });
});
