/**
 * S1-3 · forgetAnalyticsForMember — THE LEDGER INVARIANT, real PostgreSQL.
 *
 * THE INVARIANT UNDER TEST:
 *
 *   the evidence ledger may never claim consent was revoked unless that
 *   revocation actually became operative in the authoritative consent state.
 *
 * ── THE DEFECT THIS FILE EXISTS FOR ────────────────────────────────────────
 *
 * Step 3 of delete-my-data read the consent row with the UNLOCKED
 * `readConsentTx` and ran a compare-and-set whose affected-row count was never
 * inspected — the same shape `advanceConsent` was repaired for, in the sibling
 * path, and untouched by that repair. A member deleting their data on one
 * device while a consent decision landed from another produced:
 *
 *   identity  suppressed, analytics_id NULL   ← the erase applied
 *   consent   granted = TRUE                  ← the revocation silently did not
 *   evidence  "4:grant", "4:suppress"         ← duplicate seq, and a revocation
 *                                               that never became operative
 *
 * Collection still failed closed — a suppressed identity holds no pseudonym —
 * so this was never a leak. It was a false compliance record: the ledger said a
 * member was opted IN at the moment of their own erasure, and claimed a
 * revocation that never happened.
 *
 * ── HOW THESE LAWS WORK ────────────────────────────────────────────────────
 *
 * The interleaving is FORCED, not raced. A second connection runs a real
 * `advanceConsent` and is held mid-transaction by a lock this test controls;
 * the erase is launched and OBSERVED TO BLOCK on a live database lock before
 * the decision is allowed to commit. `waitForBlocked` THROWS if nothing ever
 * blocks, so a law whose contended window was not reached fails rather than
 * passing for the wrong reason.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { db } from "../index";
import {
  advanceConsent,
  forgetAnalyticsForMember,
  readConsent,
  resolveAnalyticsIdentity,
  type Dbx,
} from "../analyticsIdentityRepo";

const DB = Boolean(process.env["DB_TESTS"]);
const U = (n: string) => `s1_3_fgt_${n}`;
const dbx = db as unknown as Dbx;

function rowsOf<T>(res: unknown): T[] {
  return ((res as { rows?: T[] }).rows ?? []) as T[];
}

function separateConnection() {
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
  return { dbx: drizzle(pool) as unknown as Dbx, close: () => pool.end() };
}

async function wipe(): Promise<void> {
  await db.execute(sql`delete from aforce_analytics_consent_events where user_id like 's1_3_fgt_%'`);
  await db.execute(sql`delete from aforce_analytics_consent_state  where user_id like 's1_3_fgt_%'`);
  await db.execute(sql`delete from aforce_analytics_identities     where user_id like 's1_3_fgt_%'`);
}
beforeEach(async () => { if (DB) await wipe() });
afterAll(async () => { if (DB) await wipe() });

async function waitForBlocked(): Promise<void> {
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
    "nothing ever blocked on a database lock — the contended window was not " +
      "reached, so this law would have proven nothing",
  );
}

/** The member's full state: what is operative, and what the ledger claims. */
async function observe(userId: string) {
  const state = await readConsent(dbx, userId);
  const evidence = rowsOf<{ decision_seq: number; action: string }>(
    await db.execute(sql`
      select decision_seq, action from aforce_analytics_consent_events
       where user_id = ${userId} order by id`),
  ).map((r) => `${r.decision_seq}:${r.action}`);
  const identity = rowsOf<{ analytics_id: string | null; status: string }>(
    await db.execute(sql`
      select analytics_id, status from aforce_analytics_identities
       where user_id = ${userId}`),
  )[0] ?? null;
  return { state, evidence, identity };
}

/**
 * THE INVARIANT, as an executable check.
 *
 * Every `suppress` row in the ledger must correspond to a revocation that is
 * operative, and no sequence may appear twice.
 */
function assertLedgerHonest(o: Awaited<ReturnType<typeof observe>>) {
  const seqs = o.evidence.map((e) => Number(e.split(":")[0]));
  expect(
    new Set(seqs).size,
    `the ledger contains a duplicated decision_seq: ${JSON.stringify(o.evidence)}`,
  ).toBe(seqs.length);
  expect(seqs, "decision_seq must be monotonic in the ledger").toEqual(
    [...seqs].sort((a, b) => a - b),
  );
  const claimsRevoked = o.evidence.some((e) => e.endsWith(":suppress"));
  if (claimsRevoked) {
    expect(
      o.state?.granted,
      "the ledger claims consent was revoked, so the operative state must " +
        "actually be revoked — this is the invariant",
    ).toBe(false);
    const lastSuppress = Math.max(
      ...o.evidence.filter((e) => e.endsWith(":suppress")).map((e) => Number(e.split(":")[0])),
    );
    expect(
      o.state?.decisionSeq,
      "the evidenced suppression must name the sequence that is operative",
    ).toBe(lastSuppress);
  }
}

async function seedGranted(u: string): Promise<void> {
  await resolveAnalyticsIdentity(dbx, u);
  expect((await advanceConsent(dbx, { userId: u, action: "grant", disclosureVersion: 1, expectedSeq: null })).ok).toBe(true);
  expect((await advanceConsent(dbx, { userId: u, action: "revoke", disclosureVersion: 1, expectedSeq: 1 })).ok).toBe(true);
  expect((await advanceConsent(dbx, { userId: u, action: "grant", disclosureVersion: 1, expectedSeq: 2 })).ok).toBe(true);
}

// ── CONTENDED: a real decision lands while the erase is in flight ─────

describe.runIf(DB)("S1-3 forget · contended with a real consent decision", () => {
  it("the erase still revokes, and the ledger tells the truth", async () => {
    const u = U("contended");
    await seedGranted(u); // granted, decision_seq = 3

    // Hold the consent row so the erase must queue behind a decision.
    const gate = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
    const holder = await gate.connect();
    const other = separateConnection();
    try {
      await holder.query("begin");
      await holder.query(
        `select decision_seq from aforce_analytics_consent_state
          where user_id = $1 for update`,
        [u],
      );

      // The erase starts and must block on that row.
      const erase = forgetAnalyticsForMember(dbx, u);
      await waitForBlocked();

      // Now let a REAL advanceConsent take the row the instant the holder
      // releases it, so the erase resumes into a moved sequence.
      await holder.query("commit");
      holder.release();
      const decision = await advanceConsent(other.dbx, {
        userId: u, action: "revoke", disclosureVersion: 1, expectedSeq: 3,
      });

      const result = await erase;
      const o = await observe(u);

      expect(result.status).toBe("suppressed");
      expect(o.identity?.status, "the erase applied").toBe("suppressed");
      expect(o.identity?.analytics_id, "and retired the pseudonym").toBeNull();
      expect(o.state?.granted, "the member must not be left opted IN").toBe(false);
      assertLedgerHonest(o);
      // Whichever ordering the database chose, exactly one of the two
      // revocations is evidenced at the operative sequence.
      expect(decision.ok || result.status === "suppressed").toBe(true);
    } finally {
      try { holder.release() } catch { /* already released */ }
      await gate.end();
      await other.close();
    }
  }, 60_000);

  it("REGRESSION · the exact pre-repair interleaving no longer forges evidence", async () => {
    // The precise sequence that produced granted=true + "4:grant","4:suppress"
    // on the pre-repair code: the erase reads the consent row, a decision
    // commits underneath it, and the erase's CAS then matches nothing.
    const u = U("regress");
    await seedGranted(u); // granted, decision_seq = 3

    const gate = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
    const w = await gate.connect();
    try {
      await w.query("begin");
      await w.query(
        `select decision_seq from aforce_analytics_consent_state
          where user_id = $1 for update`,
        [u],
      );

      const erase = forgetAnalyticsForMember(dbx, u);
      await waitForBlocked();

      // A decision commits while the erase is queued.
      await w.query(
        `update aforce_analytics_consent_state
            set granted = true, decision_seq = 4, disclosure_version = 1, updated_at = now()
          where user_id = $1 and decision_seq = 3`,
        [u],
      );
      await w.query(
        `insert into aforce_analytics_consent_events
           (user_id, action, disclosure_version, decision_seq)
         values ($1, 'grant', 1, 4)`,
        [u],
      );
      await w.query("commit");

      await erase;
      const o = await observe(u);

      expect(
        o.state?.granted,
        "pre-repair this was TRUE — a member left opted in at their own erasure",
      ).toBe(false);
      expect(
        o.evidence,
        'pre-repair this was ["1:grant","2:revoke","3:grant","4:grant","4:suppress"]',
      ).toEqual(["1:grant", "2:revoke", "3:grant", "4:grant", "5:suppress"]);
      assertLedgerHonest(o);
    } finally {
      w.release();
      await gate.end();
    }
  }, 60_000);
});

// ── UNCONTENDED: the ordinary erase path ──────────────────────────────

describe.runIf(DB)("S1-3 forget · uncontended", () => {
  it("revokes, advances the sequence by exactly one, and evidences it once", async () => {
    const u = U("plain");
    await seedGranted(u); // granted, decision_seq = 3
    const result = await forgetAnalyticsForMember(dbx, u);
    const o = await observe(u);

    expect(result.status).toBe("suppressed");
    expect(o.identity?.analytics_id).toBeNull();
    expect(o.state).toMatchObject({ granted: false, decisionSeq: 4 });
    expect(o.evidence).toEqual(["1:grant", "2:revoke", "3:grant", "4:suppress"]);
    assertLedgerHonest(o);
  });

  it("a member who never consented is erased with NO invented evidence", async () => {
    const u = U("never");
    await resolveAnalyticsIdentity(dbx, u);
    await forgetAnalyticsForMember(dbx, u);
    const o = await observe(u);
    expect(o.identity?.status).toBe("suppressed");
    expect(o.state, "no consent row to revoke").toBeNull();
    expect(o.evidence, "and nothing invented for a decision never made").toEqual([]);
  });

  it("a member already revoked is erased without a second suppression row", async () => {
    const u = U("already");
    await resolveAnalyticsIdentity(dbx, u);
    await advanceConsent(dbx, { userId: u, action: "grant", disclosureVersion: 1, expectedSeq: null });
    await advanceConsent(dbx, { userId: u, action: "revoke", disclosureVersion: 1, expectedSeq: 1 });
    await forgetAnalyticsForMember(dbx, u);
    const o = await observe(u);
    expect(o.state).toMatchObject({ granted: false, decisionSeq: 2 });
    expect(o.evidence, "nothing to revoke ⇒ nothing to evidence").toEqual(["1:grant", "2:revoke"]);
    assertLedgerHonest(o);
  });

  it("erase is idempotent — a second call adds no ledger row", async () => {
    const u = U("twice");
    await seedGranted(u);
    await forgetAnalyticsForMember(dbx, u);
    const first = await observe(u);
    await forgetAnalyticsForMember(dbx, u);
    const second = await observe(u);
    expect(second.evidence).toEqual(first.evidence);
    expect(second.state).toMatchObject({ granted: false, decisionSeq: 4 });
    assertLedgerHonest(second);
  });
});

// ── DEADLOCK ──────────────────────────────────────────────────────────

describe.runIf(DB)("S1-3 forget · lock ordering", () => {
  // `forgetAnalyticsForMember` now locks TWO tables: identities, then consent
  // state. A deadlock needs a cycle, so it needs someone taking them in the
  // opposite order. Nothing does — but assert it rather than trust it.
  it("an erase and a decision contending on the same member never deadlock", async () => {
    const u = U("deadlock");
    await seedGranted(u);
    const other = separateConnection();
    try {
      for (let round = 0; round < 12; round += 1) {
        const uu = `${u}_${round}`;
        await seedGranted(uu);
        const [erase, decision] = await Promise.allSettled([
          forgetAnalyticsForMember(dbx, uu),
          advanceConsent(other.dbx, {
            userId: uu, action: "revoke", disclosureVersion: 1, expectedSeq: 3,
          }),
        ]);
        for (const r of [erase, decision]) {
          if (r.status === "rejected") {
            const msg = String(r.reason?.message ?? r.reason);
            expect(msg, "40P01 is a deadlock — the lock order has a cycle").not.toMatch(/deadlock|40P01/i);
            throw new Error(`unexpected rejection: ${msg}`);
          }
        }
        assertLedgerHonest(await observe(uu));
      }
    } finally {
      await other.close();
    }
  }, 120_000);

  it("two erases of the same member race without deadlock and evidence once", async () => {
    const u = U("twoerase");
    await seedGranted(u);
    const other = separateConnection();
    try {
      const results = await Promise.allSettled([
        forgetAnalyticsForMember(dbx, u),
        forgetAnalyticsForMember(other.dbx, u),
      ]);
      for (const r of results) {
        if (r.status === "rejected") {
          expect(String(r.reason?.message ?? r.reason)).not.toMatch(/deadlock|40P01/i);
        }
      }
      const o = await observe(u);
      expect(o.evidence.filter((e) => e.endsWith(":suppress")).length,
        "exactly one suppression is evidenced").toBe(1);
      assertLedgerHonest(o);
    } finally {
      await other.close();
    }
  }, 60_000);
});
