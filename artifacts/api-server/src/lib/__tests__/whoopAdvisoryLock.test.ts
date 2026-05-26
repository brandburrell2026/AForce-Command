/**
 * Pure unit tests for `withWhoopUserAdvisoryLock` using a fake
 * `PgPoolLike`. Cross-connection mutual exclusion against a real
 * Postgres is proven separately in
 * `src/__tests__/whoopAdvisoryLock.drizzle.test.ts`.
 *
 * What we lock down here:
 *   - acquire=true path runs fn and returns { acquired: true, value }
 *   - acquire=false path SKIPS fn and returns { acquired: false }
 *   - fn-throws path still unlocks + releases, then re-throws
 *   - unlock-throws path is swallowed (connection close frees lock)
 *   - release is called EXACTLY ONCE in every path
 *   - lock is NOT released when not acquired (we never held it —
 *     unlocking would touch a key we don't own and pollute logs)
 */
import { describe, it, expect, vi } from "vitest";
import {
  withWhoopUserAdvisoryLock,
  WHOOP_USER_ADVISORY_LOCK_NAMESPACE,
  type PgClientLike,
  type PgPoolLike,
} from "../whoopAdvisoryLock";

interface FakeClient extends PgClientLike {
  queries: Array<{ text: string; values?: unknown[] }>;
  releaseCalls: Array<Error | boolean | undefined>;
}

function makeFakeClient(opts: {
  acquired?: boolean;
  acquireThrows?: boolean;
  unlockThrows?: boolean;
}): FakeClient {
  const queries: Array<{ text: string; values?: unknown[] }> = [];
  const releaseCalls: Array<Error | boolean | undefined> = [];
  return {
    queries,
    releaseCalls,
    async query(text, values) {
      queries.push({ text, values });
      if (text.includes("pg_try_advisory_lock")) {
        if (opts.acquireThrows) throw new Error("acquire blew up");
        return { rows: [{ got: opts.acquired ?? true }] };
      }
      if (text.includes("pg_advisory_unlock")) {
        if (opts.unlockThrows) throw new Error("unlock blew up");
        return { rows: [{ pg_advisory_unlock: true }] };
      }
      return { rows: [] };
    },
    release(arg) {
      releaseCalls.push(arg);
    },
  };
}

function makeFakePool(client: PgClientLike): PgPoolLike {
  return {
    async connect() {
      return client;
    },
  };
}

describe("withWhoopUserAdvisoryLock — unit (fake pool)", () => {
  it("runs fn and returns value when the lock is acquired", async () => {
    const client = makeFakeClient({ acquired: true });
    const pool = makeFakePool(client);
    const fn = vi.fn(async () => 42);

    const result = await withWhoopUserAdvisoryLock(pool, "user-A", fn);

    expect(result).toEqual({ acquired: true, value: 42 });
    expect(fn).toHaveBeenCalledTimes(1);
    // Happy-path release is plain (no error arg), so the client
    // returns to the pool for reuse.
    expect(client.releaseCalls).toEqual([undefined]);
    // Two queries: try_lock, then unlock.
    expect(client.queries).toHaveLength(2);
    expect(client.queries[0]!.text).toMatch(/pg_try_advisory_lock/);
    expect(client.queries[0]!.text).toMatch(/hashtextextended/);
    expect(client.queries[1]!.text).toMatch(/pg_advisory_unlock/);
    // Args are (userId, namespace) for hashtextextended($1, $2::bigint).
    expect(client.queries[0]!.values).toEqual([
      "user-A",
      WHOOP_USER_ADVISORY_LOCK_NAMESPACE,
    ]);
    expect(client.queries[1]!.values).toEqual([
      "user-A",
      WHOOP_USER_ADVISORY_LOCK_NAMESPACE,
    ]);
  });

  it("skips fn and returns acquired:false when another holder owns the lock", async () => {
    const client = makeFakeClient({ acquired: false });
    const pool = makeFakePool(client);
    const fn = vi.fn(async () => "should-not-run");

    const result = await withWhoopUserAdvisoryLock(pool, "user-B", fn);

    expect(result).toEqual({ acquired: false });
    expect(fn).not.toHaveBeenCalled();
    expect(client.releaseCalls).toEqual([undefined]);
    // ONLY the try_lock — no unlock, because we never held the lock.
    // Sending pg_advisory_unlock for a key we don't own would surface
    // a Postgres NOTICE "you don't own a lock of type ..." which is
    // noise, not correctness.
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]!.text).toMatch(/pg_try_advisory_lock/);
  });

  it("re-throws fn errors AFTER unlocking and releasing", async () => {
    const client = makeFakeClient({ acquired: true });
    const pool = makeFakePool(client);
    const boom = new Error("fn boom");
    const fn = vi.fn(async () => {
      throw boom;
    });

    await expect(
      withWhoopUserAdvisoryLock(pool, "user-C", fn),
    ).rejects.toBe(boom);

    // Critical: unlock must have run before the throw escaped, and
    // the connection must have been released cleanly (no unlock err
    // so the client returns to the pool for reuse).
    expect(client.releaseCalls).toEqual([undefined]);
    expect(client.queries).toHaveLength(2);
    expect(client.queries[1]!.text).toMatch(/pg_advisory_unlock/);
  });

  it("DESTROYS the client when unlock throws so the pool can't reuse a session that may still hold the lock", async () => {
    // This is the critical regression guard for the architect's
    // round-1 finding on PR #23: a plain release() of a session
    // whose unlock failed would return a session that MAY still
    // hold the advisory lock to the pool, causing persistent
    // false-contention. We must pass an Error to release() so node-
    // postgres terminates the backend session.
    const client = makeFakeClient({ acquired: true, unlockThrows: true });
    const pool = makeFakePool(client);
    const fn = vi.fn(async () => "ok");

    // Helper still resolves cleanly with the fn value — unlock
    // failure is operational, not a fn failure.
    const result = await withWhoopUserAdvisoryLock(pool, "user-D", fn);
    expect(result).toEqual({ acquired: true, value: "ok" });

    // Single release call, and it MUST carry an Error so node-pg
    // destroys instead of recycles.
    expect(client.releaseCalls).toHaveLength(1);
    const arg = client.releaseCalls[0];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe("unlock blew up");
  });

  it("releases the connection exactly once even when fn throws (no double-release)", async () => {
    const client = makeFakeClient({ acquired: true });
    const pool = makeFakePool(client);
    await expect(
      withWhoopUserAdvisoryLock(pool, "user-E", async () => {
        throw new Error("once");
      }),
    ).rejects.toThrow("once");
    // One release, with no error arg (unlock succeeded; only fn
    // threw, which is unrelated to lock state).
    expect(client.releaseCalls).toEqual([undefined]);
  });

  it("DESTROYS the client and re-throws when the acquire query itself throws (lock state unknown)", async () => {
    // Architect's PR-23 round-2 follow-up: if pg_try_advisory_lock
    // throws, we can't tell whether the lock was taken at the
    // backend or not. Recycling that session risks a stuck lock on
    // a later checkout. We MUST destroy the client (release(err))
    // and we MUST propagate the error to the caller — this is NOT
    // a skip outcome, it's a real failure the sweep should tally
    // as an error.
    const client = makeFakeClient({ acquireThrows: true });
    const pool = makeFakePool(client);
    const fn = vi.fn();

    await expect(
      withWhoopUserAdvisoryLock(pool, "user-G", fn),
    ).rejects.toThrow("acquire blew up");
    expect(fn).not.toHaveBeenCalled();
    expect(client.releaseCalls).toHaveLength(1);
    const arg = client.releaseCalls[0];
    expect(arg).toBeInstanceOf(Error);
    expect((arg as Error).message).toBe("acquire blew up");
    // No unlock attempt — we never confirmed acquisition.
    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]!.text).toMatch(/pg_try_advisory_lock/);
  });

  it("treats a non-true `got` value as acquired=false (defensive parsing)", async () => {
    // Guards against a future driver that returns the row in a
    // different shape — anything other than strict boolean true is
    // a miss. Better to skip the user this tick than to risk a
    // double-fetch on ambiguous lock state.
    const client: PgClientLike = {
      async query() {
        return { rows: [{ got: "yes" /* not boolean true */ }] };
      },
      release: vi.fn(),
    };
    const fn = vi.fn();
    const result = await withWhoopUserAdvisoryLock(
      { async connect() { return client; } },
      "user-F",
      fn,
    );
    expect(result).toEqual({ acquired: false });
    expect(fn).not.toHaveBeenCalled();
  });
});
