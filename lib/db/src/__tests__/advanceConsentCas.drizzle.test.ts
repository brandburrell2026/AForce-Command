/**
 * S1-3 · advanceConsent COMPARE-AND-SET — real PostgreSQL, FORCED interleaving.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * The original CAS was not one. `readConsentTx` took a plain SELECT and the
 * `UPDATE`'s affected-row count was never inspected, so under READ COMMITTED
 * two transactions both read seq N, both passed the guard, and when the winner
 * committed PostgreSQL re-evaluated the loser's WHERE against the NEW row
 * version — matching nothing. The loser, never having looked, returned
 * `ok: true` for a decision that was never written and appended evidence for
 * it. A member's revoke could be reported confirmed and silently dropped.
 *
 * The existing `RACE · two concurrent decisions from the same seq` law was
 * meant to catch this. It could not, reliably: it fires two `advanceConsent`
 * calls with `Promise.all` and hopes the loser's SELECT lands before the
 * winner's COMMIT. Usually it does not, so the law was green on the PR that
 * introduced the defect and red on main — a coin toss reported as a verdict.
 *
 * ── HOW THIS FILE IS DIFFERENT ─────────────────────────────────────────────
 *
 * The interleaving is FORCED, not raced. A third connection takes the row
 * under `FOR UPDATE` and becomes the winner; the loser's real `advanceConsent`
 * is launched and OBSERVED TO BLOCK against a live database lock before the
 * winner applies its transition and commits. The loser therefore always
 * resumes into exactly the window the old code got wrong. Same outcome on
 * every run, on any machine, at any speed.
 *
 * `waitForBlockedBackend` throws rather than continuing if the loser never
 * blocks — if the window is not actually reached, the law must fail, not pass
 * for the wrong reason.
 *
 * ── THE TWO MECHANISMS, AND WHY BOTH LAWS ARE NEEDED ───────────────────────
 *
 * The repair uses `FOR UPDATE` and an affected-row check, and they are not
 * redundant. They answer different questions, so each has its own assertion
 * here and its own mutant in the matrix:
 *
 *   `expect(result.ok).toBe(false)`              ← the affected-row check.
 *       Without it the loser is told it WON. This is the original defect.
 *
 *   `expect(result.current.decisionSeq).toBe(2)` ← the `FOR UPDATE`.
 *       Without it the loser still fails, but reports the STALE seq it read,
 *       and a client reconciling against a stale seq retries with the same
 *       losing expectation forever.
 *
 * Neither assertion can stand in for the other. That is the point: this repo
 * has already shipped a pair of barriers that masked each other, and a law that
 * only checks the end state proves neither of them.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { db } from "../index";
import { advanceConsent, readConsent, type Dbx } from "../analyticsIdentityRepo";

const DB = Boolean(process.env["DB_TESTS"]);
const U = (n: string) => `s1_3_cas_${n}`;
const dbx = db as unknown as Dbx;

function rowsOf<T>(res: unknown): T[] {
  return ((res as { rows?: T[] }).rows ?? []) as T[];
}

/** A genuinely separate connection, so a race contends in Postgres. */
function separateConnection() {
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
  return { dbx: drizzle(pool) as unknown as Dbx, close: () => pool.end() };
}

async function wipe(): Promise<void> {
  await db.execute(sql`delete from aforce_analytics_consent_events where user_id like 's1_3_cas_%'`);
  await db.execute(sql`delete from aforce_analytics_consent_state  where user_id like 's1_3_cas_%'`);
}
beforeEach(async () => { if (DB) await wipe() });
afterAll(async () => { if (DB) await wipe() });

/**
 * Block until some backend is genuinely waiting on a lock.
 *
 * THROWS on timeout. A law whose contended window was never reached must fail
 * loudly — silently proceeding would assert against an uncontended call and
 * pass for a reason that has nothing to do with the mechanism under test.
 */
async function waitForBlockedBackend(): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    const n = rowsOf<{ n: number }>(
      await db.execute(sql`
        select count(*)::int n from pg_stat_activity
         where datname = current_database() and wait_event_type = 'Lock'`),
    )[0]?.n ?? 0;
    if (n >= 1) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(
    "the loser never blocked on a database lock — the contended window was " +
      "not reached, so this law would have proven nothing",
  );
}

async function evidenceFor(userId: string) {
  return rowsOf<{ action: string; decision_seq: number }>(
    await db.execute(sql`
      select action, decision_seq from aforce_analytics_consent_events
       where user_id = ${userId} order by decision_seq, id`),
  );
}

type Action = "grant" | "revoke";

/**
 * Run the loser's REAL advanceConsent into a window a winner controls.
 *
 * The winner holds the row under `FOR UPDATE`, the loser is launched and
 * observed to block, and only then does the winner apply its transition and
 * commit. Returns whatever the loser's advanceConsent returned.
 */
async function forcedInterleave(opts: {
  userId: string;
  winnerAction: Action;
  loserAction: Action;
  seq: number;
}) {
  const other = separateConnection();
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
  const w = await pool.connect();
  try {
    await w.query("begin");
    await w.query(
      `select decision_seq from aforce_analytics_consent_state
        where user_id = $1 for update`,
      [opts.userId],
    );

    const loser = advanceConsent(other.dbx, {
      userId: opts.userId,
      action: opts.loserAction,
      disclosureVersion: 1,
      expectedSeq: opts.seq,
    });
    await waitForBlockedBackend();

    const next = opts.seq + 1;
    await w.query(
      `update aforce_analytics_consent_state
          set granted = $1, decision_seq = $2, disclosure_version = 1, updated_at = now()
        where user_id = $3 and decision_seq = $4`,
      [opts.winnerAction === "grant", next, opts.userId, opts.seq],
    );
    await w.query(
      `insert into aforce_analytics_consent_events
         (user_id, action, disclosure_version, decision_seq)
       values ($1, $2, 1, $3)`,
      [opts.userId, opts.winnerAction, next],
    );
    await w.query("commit");

    return await loser;
  } finally {
    w.release();
    await pool.end();
    await other.close();
  }
}

// ── the four action pairs, each with the interleaving forced ──────────

describe.runIf(DB)("S1-3 CAS · the loser of a contended decision", () => {
  const PAIRS: Array<[Action, Action]> = [
    ["grant", "revoke"],
    ["revoke", "grant"],
    ["grant", "grant"],
    ["revoke", "revoke"],
  ];

  it.each(PAIRS)(
    "winner=%s loser=%s · refused, told the canonical state, and exactly one decision applies",
    async (winnerAction, loserAction) => {
      const u = U(`${winnerAction}_${loserAction}`);
      // Seed decision #1 so both parties have a seq to contend from.
      const seed = await advanceConsent(dbx, {
        userId: u, action: "grant", disclosureVersion: 1, expectedSeq: null,
      });
      expect(seed.ok).toBe(true);

      const result = await forcedInterleave({
        userId: u, winnerAction, loserAction, seq: 1,
      });

      // REQUIREMENT 2 + 3 — the affected-row check. Without it the loser is
      // told it won, which is the defect this lane exists to fix.
      expect(result.ok, "a caller that lost the CAS must not receive ok:true").toBe(false);

      // REQUIREMENT 6 — the FOR UPDATE. The loser must be handed the committed
      // truth, not the snapshot it happened to read before the winner landed.
      if (result.ok === false) {
        expect(
          result.current?.decisionSeq,
          "the loser must receive the CANONICAL current state, not the stale " +
            "seq it read — a client reconciling against a stale seq retries " +
            "the same losing expectation forever",
        ).toBe(2);
        expect(result.current?.granted).toBe(winnerAction === "grant");
      }

      // REQUIREMENT 5 — exactly one decision applied.
      expect(await readConsent(dbx, u)).toMatchObject({
        decisionSeq: 2,
        granted: winnerAction === "grant",
      });

      // REQUIREMENT 4 — evidence matches APPLIED transitions and nothing else:
      // the seed at seq 1 and the winner at seq 2. The loser appended nothing.
      const ev = await evidenceFor(u);
      expect(
        ev.map((e) => `${e.decision_seq}:${e.action}`),
        "the append-only consent log must never describe a transition that " +
          "did not happen",
      ).toEqual(["1:grant", `2:${winnerAction}`]);
    },
  );
});

// ── the first-decision (insert) path, also forced ─────────────────────

describe.runIf(DB)("S1-3 CAS · two first decisions at once", () => {
  it("one insert wins; the loser is refused and reads the winner's state", async () => {
    const u = U("first");
    const other = separateConnection();
    const pool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
    const w = await pool.connect();
    try {
      // The winner inserts the member's first decision but does NOT commit.
      await w.query("begin");
      await w.query(
        `insert into aforce_analytics_consent_state
           (user_id, granted, decision_seq, disclosure_version)
         values ($1, true, 1, 1)`,
        [u],
      );

      // The loser also believes no decision exists. Its ON CONFLICT DO NOTHING
      // blocks on the winner's uncommitted tuple.
      const loser = advanceConsent(other.dbx, {
        userId: u, action: "revoke", disclosureVersion: 1, expectedSeq: null,
      });
      await waitForBlockedBackend();

      await w.query(
        `insert into aforce_analytics_consent_events
           (user_id, action, disclosure_version, decision_seq)
         values ($1, 'grant', 1, 1)`,
        [u],
      );
      await w.query("commit");

      const result = await loser;
      expect(result.ok, "the losing first-decision must not report success").toBe(false);
      if (result.ok === false) {
        expect(result.current?.decisionSeq).toBe(1);
        expect(result.current?.granted, "the winner's value, not the loser's").toBe(true);
      }
      // Exactly one decision, and exactly one evidence row.
      expect(await readConsent(dbx, u)).toMatchObject({ decisionSeq: 1, granted: true });
      expect((await evidenceFor(u)).map((e) => `${e.decision_seq}:${e.action}`)).toEqual([
        "1:grant",
      ]);
    } finally {
      w.release();
      await pool.end();
      await other.close();
    }
  });
});

// ── the positive control ──────────────────────────────────────────────

describe.runIf(DB)("S1-3 CAS · POSITIVE CONTROL", () => {
  // Without this, every law above is satisfiable by an advanceConsent that
  // refuses everything unconditionally.
  it("an UNCONTENDED decision still applies, advances the seq, and records evidence", async () => {
    const u = U("control");
    const first = await advanceConsent(dbx, {
      userId: u, action: "grant", disclosureVersion: 1, expectedSeq: null,
    });
    expect(first.ok).toBe(true);
    expect(first.ok === true && first.state.decisionSeq).toBe(1);

    const second = await advanceConsent(dbx, {
      userId: u, action: "revoke", disclosureVersion: 2, expectedSeq: 1,
    });
    expect(second.ok, "an uncontended CAS with the right expectation must APPLY").toBe(true);
    expect(second.ok === true && second.state.decisionSeq).toBe(2);

    expect(await readConsent(dbx, u)).toMatchObject({
      granted: false, decisionSeq: 2, disclosureVersion: 2,
    });
    expect((await evidenceFor(u)).map((e) => `${e.decision_seq}:${e.action}`)).toEqual([
      "1:grant",
      "2:revoke",
    ]);
  });

  it("a stale expectation is refused even with no contention at all", async () => {
    const u = U("stale");
    await advanceConsent(dbx, { userId: u, action: "grant", disclosureVersion: 1, expectedSeq: null });
    await advanceConsent(dbx, { userId: u, action: "revoke", disclosureVersion: 1, expectedSeq: 1 });

    const stale = await advanceConsent(dbx, {
      userId: u, action: "grant", disclosureVersion: 1, expectedSeq: 1,
    });
    expect(stale.ok).toBe(false);
    expect(stale.ok === false && stale.current?.decisionSeq).toBe(2);
    // and it wrote no evidence
    expect((await evidenceFor(u)).map((e) => e.decision_seq)).toEqual([1, 2]);
  });
});

// ── genuine concurrency, as a belt-and-braces end-to-end check ────────

describe.runIf(DB)("S1-3 CAS · genuine concurrency (unforced)", () => {
  // Racy by nature, so it is NOT the proof — the forced laws above are. It is
  // here because the forced harness drives the winner with raw SQL, and this
  // exercises two real advanceConsent calls contending on real connections.
  it.each([
    ["grant", "revoke"],
    ["revoke", "grant"],
    ["grant", "grant"],
    ["revoke", "revoke"],
  ] as Array<[Action, Action]>)(
    "%s vs %s · exactly one applies and evidence matches",
    async (a, b) => {
      const u = U(`conc_${a}_${b}`);
      await advanceConsent(dbx, { userId: u, action: "grant", disclosureVersion: 1, expectedSeq: null });
      const other = separateConnection();
      try {
        const [ra, rb] = await Promise.all([
          advanceConsent(dbx, { userId: u, action: a, disclosureVersion: 1, expectedSeq: 1 }),
          advanceConsent(other.dbx, { userId: u, action: b, disclosureVersion: 1, expectedSeq: 1 }),
        ]);
        expect([ra.ok, rb.ok].filter(Boolean).length, "exactly one CAS may win").toBe(1);
        const state = await readConsent(dbx, u);
        expect(state?.decisionSeq).toBe(2);
        // One applied transition beyond the seed ⇒ exactly two evidence rows.
        expect((await evidenceFor(u)).map((e) => e.decision_seq)).toEqual([1, 2]);
      } finally {
        await other.close();
      }
    },
  );
});
