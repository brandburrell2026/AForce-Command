/**
 * DB integration test for `withWhoopUserAdvisoryLock` against the
 * real Postgres backing `@workspace/db`. The whole point of the
 * advisory lock is cross-connection mutual exclusion — a unit test
 * with a fake pool can't prove that, so this is the test that
 * actually validates the design.
 *
 * Strategy: hand-checkout two distinct clients from the shared pool
 * (each `pool.connect()` returns a different backend session), run
 * raw `pg_try_advisory_lock(ns, hashtext(uid))` queries on them, and
 * assert the second one is blocked while the first holds, then
 * succeeds after the first unlocks.
 *
 * We do NOT go through `withWhoopUserAdvisoryLock` for the
 * interleaving — that would serialize on `await` (one helper call at
 * a time, releasing its own client before the next call's pool.connect
 * returns) and we'd lose the "two replicas at the same instant" race
 * the test is meant to model.
 */
import { describe, it, expect } from "vitest";
import { pool } from "@workspace/db";
import {
  withWhoopUserAdvisoryLock,
  WHOOP_USER_ADVISORY_LOCK_NAMESPACE,
} from "../lib/whoopAdvisoryLock";

const TEST_USER = `test_advlock_${process.pid}`;

describe("withWhoopUserAdvisoryLock — DB integration (cross-connection)", () => {
  it("blocks a second session while a first session holds the lock, then admits it after unlock", async () => {
    const a = await pool.connect();
    const b = await pool.connect();
    try {
      // Session A acquires.
      const aTry = await a.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1, $2::bigint)) AS got",
        [TEST_USER, WHOOP_USER_ADVISORY_LOCK_NAMESPACE],
      );
      expect((aTry.rows[0] as { got: boolean }).got).toBe(true);

      // Session B tries the same key — must be denied immediately
      // (this is `pg_try_*`, not the blocking variant).
      const bTry1 = await b.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1, $2::bigint)) AS got",
        [TEST_USER, WHOOP_USER_ADVISORY_LOCK_NAMESPACE],
      );
      expect((bTry1.rows[0] as { got: boolean }).got).toBe(false);

      // Session A releases.
      const aUnlock = await a.query(
        "SELECT pg_advisory_unlock(hashtextextended($1, $2::bigint)) AS unlocked",
        [TEST_USER, WHOOP_USER_ADVISORY_LOCK_NAMESPACE],
      );
      expect((aUnlock.rows[0] as { unlocked: boolean }).unlocked).toBe(true);

      // Now session B succeeds.
      const bTry2 = await b.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1, $2::bigint)) AS got",
        [TEST_USER, WHOOP_USER_ADVISORY_LOCK_NAMESPACE],
      );
      expect((bTry2.rows[0] as { got: boolean }).got).toBe(true);

      // And releases.
      await b.query(
        "SELECT pg_advisory_unlock(hashtextextended($1, $2::bigint))",
        [TEST_USER, WHOOP_USER_ADVISORY_LOCK_NAMESPACE],
      );
    } finally {
      a.release();
      b.release();
    }
  });

  it("end-to-end via the helper: second concurrent call sees acquired:false", async () => {
    // Hold the lock from outside the helper (so it's held for the
    // duration of the helper's connect()), then call the helper —
    // the helper must observe acquired:false and skip the fn.
    const holder = await pool.connect();
    try {
      const held = await holder.query(
        "SELECT pg_try_advisory_lock(hashtextextended($1, $2::bigint)) AS got",
        [TEST_USER, WHOOP_USER_ADVISORY_LOCK_NAMESPACE],
      );
      expect((held.rows[0] as { got: boolean }).got).toBe(true);

      let fnRan = false;
      const out = await withWhoopUserAdvisoryLock(
        pool,
        TEST_USER,
        async () => {
          fnRan = true;
          return "should-not-happen";
        },
      );
      expect(out).toEqual({ acquired: false });
      expect(fnRan).toBe(false);

      // Drop the lock from the holder.
      await holder.query(
        "SELECT pg_advisory_unlock(hashtextextended($1, $2::bigint))",
        [TEST_USER, WHOOP_USER_ADVISORY_LOCK_NAMESPACE],
      );

      // Now the helper should be able to acquire and run.
      const out2 = await withWhoopUserAdvisoryLock(
        pool,
        TEST_USER,
        async () => "ran",
      );
      expect(out2).toEqual({ acquired: true, value: "ran" });
    } finally {
      holder.release();
    }
  });

  it("releases the lock so a subsequent helper call can re-acquire", async () => {
    // Two sequential helper calls for the same user must both
    // succeed — proves the helper's unlock + release actually
    // returns the lock to the global pool of free advisory locks.
    const out1 = await withWhoopUserAdvisoryLock(
      pool,
      TEST_USER,
      async () => 1,
    );
    expect(out1).toEqual({ acquired: true, value: 1 });
    const out2 = await withWhoopUserAdvisoryLock(
      pool,
      TEST_USER,
      async () => 2,
    );
    expect(out2).toEqual({ acquired: true, value: 2 });
  });
});
