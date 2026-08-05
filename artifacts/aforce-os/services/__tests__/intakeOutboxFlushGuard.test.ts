/**
 * `runExclusiveFlush` — module-level in-flight flush coalescing guard
 * (RC-1 W3P2 carried follow-up, #547 code review — should-fix c).
 *
 * Before this, "only one flush runs at a time" was enforced solely by a
 * `useRef` inside `store/useAppStore.tsx`'s `AppProvider` — a per-component-
 * instance guard that only protects concurrent calls originating from that
 * one component instance. This suite pins the module-level replacement
 * directly: two overlapping callers must coalesce onto the SAME in-flight
 * promise (the task runs exactly once), the guard must release once that
 * promise settles (success OR failure) so the next trigger gets a fresh
 * run, and a rejection must propagate to every coalesced caller rather than
 * being silently swallowed.
 */
import { describe, it, expect, vi } from 'vitest';
import { runExclusiveFlush } from '../intakeOutbox';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('runExclusiveFlush', () => {
  it('coalesces a concurrent call onto the same in-flight promise instead of starting a second task', async () => {
    const d = deferred();
    const task = vi.fn(() => d.promise);

    const first = runExclusiveFlush(task);
    const second = runExclusiveFlush(task);

    expect(task).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);

    d.resolve();
    await Promise.all([first, second]);
  });

  it('runs a fresh task once the prior flush has fully settled', async () => {
    const task = vi.fn(async () => {});

    await runExclusiveFlush(task);
    await runExclusiveFlush(task);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('clears the in-flight guard even when the task rejects, so a later flush can retry', async () => {
    const failing = vi.fn(async () => {
      throw new Error('offline');
    });
    await expect(runExclusiveFlush(failing)).rejects.toThrow('offline');

    const succeeding = vi.fn(async () => {});
    await runExclusiveFlush(succeeding);

    expect(succeeding).toHaveBeenCalledTimes(1);
  });

  it('propagates a rejection to every caller coalesced onto the failing in-flight task', async () => {
    const d = deferred();
    const task = vi.fn(() => d.promise);

    const first = runExclusiveFlush(task);
    const second = runExclusiveFlush(task);
    expect(task).toHaveBeenCalledTimes(1);

    d.reject(new Error('boom'));

    await expect(first).rejects.toThrow('boom');
    await expect(second).rejects.toThrow('boom');
  });

  // RC-1 W3 r2 hardening (#551 nit 3): the guard used to be assigned to
  // `flushInFlight` only AFTER `task()` had already been invoked
  // (`const run = task().finally(...); flushInFlight = run;`). The two
  // tests above call `runExclusiveFlush` twice back-to-back from the TEST
  // body, which doesn't exercise that ordering bug — by the time the test's
  // second call runs, the first call's synchronous statements (including
  // the old post-hoc `flushInFlight = run` assignment) have already
  // finished executing. The bug only surfaces when the RE-ENTRANT call
  // happens from INSIDE `task`'s own synchronous prefix — i.e. before
  // `task()`'s call expression has even finished evaluating — which is
  // exactly what this test drives.
  it('a task whose synchronous prefix re-enters runExclusiveFlush coalesces onto the SAME in-flight promise instead of starting a second, overlapping flush', async () => {
    const inner = vi.fn(async () => {});
    let reentrant: Promise<void> | null = null;
    const outer = vi.fn((): Promise<void> => {
      // Synchronous prefix of `outer` — runs as part of evaluating
      // `outer()` inside `runExclusiveFlush`, before `outer` reaches (or
      // even has) an `await`. Under the old implementation,
      // `flushInFlight` was still `null` at this exact point.
      reentrant = runExclusiveFlush(inner);
      return Promise.resolve();
    });

    const first = runExclusiveFlush(outer);

    expect(outer).toHaveBeenCalledTimes(1);
    // The re-entrant call from inside `outer`'s synchronous prefix must
    // coalesce onto the SAME in-flight promise `runExclusiveFlush(outer)`
    // returned...
    expect(reentrant).toBe(first);
    // ...meaning `inner` is never started as a second, overlapping flush.
    expect(inner).not.toHaveBeenCalled();

    await first;
  });
});
