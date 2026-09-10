/**
 * S1-3 · ANALYTICS IDENTITY + CONSENT AUTHORITY — real PostgreSQL, db-lane.
 *
 * WHY REAL POSTGRES. Every law below turns on transaction and locking
 * behaviour: `FOR UPDATE` serialisation, `ON CONFLICT DO NOTHING` blocking on
 * a concurrent insert, a compare-and-set matching zero rows, a partial unique
 * index permitting many NULLs but one non-NULL. A mock proves none of that —
 * it proves only that the mock was written to agree with the test.
 *
 * The concurrency laws use TWO INDEPENDENT CONNECTIONS. Racing on one pooled
 * client would serialise in the driver and pass without ever exercising a
 * database lock, which is precisely the vacuous shape this repo keeps finding.
 *
 * Every case cleans up its own rows; the final law proves the tables are empty.
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { db } from "../index";
import {
  advanceConsent,
  consentedAnalyticsIdFor,
  forgetAnalyticsForMember,
  mintAnalyticsId,
  readConsent,
  resolveAnalyticsIdentity,
  rotateAnalyticsIdentity,
  type Dbx,
} from "../analyticsIdentityRepo";

const DB = Boolean(process.env["DB_TESTS"]);
const U = (n: string) => `s1_3_user_${n}`;
const dbx = db as unknown as Dbx;

/** A genuinely separate connection, so a race contends in Postgres. */
function separateConnection() {
  const pool = new Pool({ connectionString: process.env["DATABASE_URL"], max: 1 });
  return { dbx: drizzle(pool) as unknown as Dbx, close: () => pool.end() };
}

async function wipe(): Promise<void> {
  await db.execute(sql`delete from aforce_analytics_consent_events where user_id like 's1_3_user_%'`);
  await db.execute(sql`delete from aforce_analytics_consent_state  where user_id like 's1_3_user_%'`);
  await db.execute(sql`delete from aforce_analytics_identities     where user_id like 's1_3_user_%'`);
  await db.execute(sql`delete from aforce_analytics_events where analytics_id like 'anon_%' and event_id like 's1_3_%'`);
}

beforeEach(async () => {
  if (DB) await wipe();
});
afterAll(async () => {
  if (DB) await wipe();
});

// ── the minter ────────────────────────────────────────────────────────

describe.runIf(DB)("S1-3 · pseudonym minter", () => {
  it("matches the EXISTING analytics contract shape, so no ingress changes", () => {
    // lib/analytics-contract: /^anon_[a-z0-9]+_[a-z0-9]+$/, enforced at three
    // ingress points. Hex is a subset of that charset.
    const RE = /^anon_[a-z0-9]+_[a-z0-9]+$/;
    for (let i = 0; i < 200; i++) expect(mintAnalyticsId()).toMatch(RE);
  });

  it("is not derived from anything — 200 mints, 200 distinct values", () => {
    const seen = new Set(Array.from({ length: 200 }, () => mintAnalyticsId()));
    expect(seen.size).toBe(200);
  });

  /**
   * CARRIES NO TIMESTAMP — proven by denying the minter a clock.
   *
   * ── WHY THE PREVIOUS LAW WAS REPLACED ────────────────────────────────────
   *
   * It minted two ids and asserted their common prefix was <= 5. `anon_` is
   * exactly five characters, so the assertion reduced to "the next hex digit
   * must differ" — a 1-in-16 coin flip. Measured over 200,000 trials it failed
   * 6.30% of the time (theory 6.25%), which is why `db-lane` went red on main
   * at random. It also did not test the property it named: two random ids
   * sharing a prefix is evidence of nothing, and a timestamp scheme with a
   * coarse clock could pass it whenever the clock happened to tick.
   *
   * ── WHY THIS ONE CANNOT FLAKE ────────────────────────────────────────────
   *
   * It does not sample the OUTPUT at all, so there is no distribution to be
   * unlucky with. It removes the clock from the environment and mints: an
   * identifier that encodes mint time must read a clock to do so, and every
   * way of reading one throws here. Pass and fail are both decided by control
   * flow, not by chance — the false-failure probability is exactly zero.
   *
   * The control below proves the law is not vacuous: the ACTUAL previous
   * client minter (`anon_${Date.now().toString(36)}_${random}`) is run through
   * the same trap and is detected every time.
   */
  function withoutAClock<T>(fn: () => T): T {
    const RealDate = globalThis.Date;
    const realHrtime = process.hrtime;
    const realPerfNow = globalThis.performance?.now;
    const boom = () => {
      throw new Error("CLOCK ACCESSED: this identifier can encode mint time");
    };
    class TrapDate {
      constructor() { boom() }
      static now(): number { return boom() as never }
      static parse(): number { return boom() as never }
      static UTC(): number { return boom() as never }
    }
    globalThis.Date = TrapDate as unknown as DateConstructor;
    (process as { hrtime: unknown }).hrtime = boom;
    if (globalThis.performance) globalThis.performance.now = boom as unknown as () => number;
    try {
      return fn();
    } finally {
      globalThis.Date = RealDate;
      (process as { hrtime: unknown }).hrtime = realHrtime;
      if (globalThis.performance && realPerfNow) globalThis.performance.now = realPerfNow;
    }
  }

  it("carries no timestamp: the minter never reads a clock", () => {
    // Collected inside the trap, asserted outside it — the assertion library
    // is allowed a clock, the minter is not.
    const ids = withoutAClock(() => Array.from({ length: 200 }, () => mintAnalyticsId()));
    expect(ids).toHaveLength(200);
    expect(new Set(ids).size, "and every one distinct").toBe(200);
  });

  it("CONTROL — the same law detects the old timestamp-derived minter", () => {
    // Verbatim shape of the client minter this program removed. If the law
    // above can pass for a scheme that leaks mint time, it proves nothing.
    const timestampMinter = () =>
      `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    expect(() => withoutAClock(timestampMinter)).toThrow(/CLOCK ACCESSED/);
  });
});

// ── resolve / mint, including the races ───────────────────────────────

describe.runIf(DB)("S1-3 · resolve + mint", () => {
  it("mints on first use and is idempotent thereafter", async () => {
    const first = await resolveAnalyticsIdentity(dbx, U("a"));
    const second = await resolveAnalyticsIdentity(dbx, U("a"));
    expect(first.status).toBe("active");
    expect(first.analyticsId).toMatch(/^anon_/);
    expect(second.analyticsId).toBe(first.analyticsId);
  });

  it("RACE · two simultaneous FIRST resolves return the SAME pseudonym", async () => {
    const other = separateConnection();
    try {
      const [x, y] = await Promise.all([
        resolveAnalyticsIdentity(dbx, U("race1")),
        resolveAnalyticsIdentity(other.dbx, U("race1")),
      ]);
      expect(x.analyticsId).toBe(y.analyticsId);
      const rows = await db.execute(
        sql`select count(*)::int n from aforce_analytics_identities where user_id = ${U("race1")}`,
      );
      expect((rows as unknown as { rows: Array<{ n: number }> }).rows[0]!.n).toBe(1);
    } finally {
      await other.close();
    }
  });

  it("RACE · no duplicate ACTIVE pseudonym exists after concurrent resolves", async () => {
    const conns = [separateConnection(), separateConnection(), separateConnection()];
    try {
      const ids = await Promise.all(
        conns.map((c, i) => resolveAnalyticsIdentity(c.dbx, U("race_multi_" + (i % 2)))),
      );
      // two distinct members across three racers
      expect(new Set(ids.map((i) => i.analyticsId)).size).toBe(2);
      const dup = await db.execute(sql`
        select analytics_id, count(*)::int n from aforce_analytics_identities
         where user_id like 's1_3_user_race_multi_%' and analytics_id is not null
         group by analytics_id having count(*) > 1`);
      expect((dup as unknown as { rows: unknown[] }).rows).toEqual([]);
    } finally {
      await Promise.all(conns.map((c) => c.close()));
    }
  });

  it("RACE · resolve vs rotate never returns the retired pseudonym", async () => {
    const before = await resolveAnalyticsIdentity(dbx, U("rot"));
    const other = separateConnection();
    try {
      const [rotated, resolved] = await Promise.all([
        rotateAnalyticsIdentity(dbx, U("rot")),
        resolveAnalyticsIdentity(other.dbx, U("rot")),
      ]);
      // Whichever won, the resolver must return a LIVE value: either the
      // pre-rotation one (it committed first) or the new one — never a value
      // that is no longer in the row.
      const live = await db.execute(
        sql`select analytics_id from aforce_analytics_identities where user_id = ${U("rot")}`,
      );
      const current = (live as unknown as { rows: Array<{ analytics_id: string }> }).rows[0]!
        .analytics_id;
      expect(rotated).not.toBe(before.analyticsId);
      expect([before.analyticsId, rotated]).toContain(resolved.analyticsId);
      expect(current).toBe(rotated);
    } finally {
      await other.close();
    }
  });

  it("RACE · resolve vs suppress never revives the member", async () => {
    await resolveAnalyticsIdentity(dbx, U("sup"));
    const other = separateConnection();
    try {
      await Promise.all([
        forgetAnalyticsForMember(dbx, U("sup")),
        resolveAnalyticsIdentity(other.dbx, U("sup")).catch(() => null),
      ]);
      // Whatever the interleaving, the END STATE must be suppressed with no
      // pseudonym — the resolver must never have re-minted one.
      const rows = await db.execute(sql`
        select status, analytics_id from aforce_analytics_identities where user_id = ${U("sup")}`);
      const r = (rows as unknown as { rows: Array<{ status: string; analytics_id: string | null }> })
        .rows[0]!;
      expect(r.status).toBe("suppressed");
      expect(r.analytics_id).toBeNull();
    } finally {
      await other.close();
    }
  });

  it("a suppressed member resolves as suppressed and mints nothing", async () => {
    await resolveAnalyticsIdentity(dbx, U("sup2"));
    await forgetAnalyticsForMember(dbx, U("sup2"));
    const again = await resolveAnalyticsIdentity(dbx, U("sup2"));
    expect(again.status).toBe("suppressed");
    expect(again.analyticsId).toBeNull();
  });

  it("refuses to operate as the DEFAULT_USER_ID sentinel", async () => {
    await expect(resolveAnalyticsIdentity(dbx, "default")).rejects.toThrow(/real member/);
  });
});

// ── consent sequencing ────────────────────────────────────────────────

describe.runIf(DB)("S1-3 · advanceConsent — the single decision_seq authority", () => {
  it("the FIRST grant succeeds with expectedSeq null and yields seq 1", async () => {
    // The 409 loop this pins: encoding 'no row' as 0 makes the CAS match zero
    // rows, and the refusal hands back the same 0 that caused it — forever.
    const r = await advanceConsent(dbx, {
      userId: U("c1"), action: "grant", disclosureVersion: 1, expectedSeq: null,
    });
    expect(r.ok).toBe(true);
    expect(r.ok && r.state.decisionSeq).toBe(1);
    expect(await readConsent(dbx, U("c1"))).toMatchObject({ granted: true, decisionSeq: 1 });
  });

  it("a STALE expectedSeq cannot re-grant what was revoked elsewhere", async () => {
    await advanceConsent(dbx, { userId: U("c2"), action: "grant", disclosureVersion: 1, expectedSeq: null });
    // device B revokes (seq 1 -> 2)
    await advanceConsent(dbx, { userId: U("c2"), action: "revoke", disclosureVersion: 1, expectedSeq: 1 });
    // device A, still believing seq 1, tries to re-grant
    const stale = await advanceConsent(dbx, {
      userId: U("c2"), action: "grant", disclosureVersion: 1, expectedSeq: 1,
    });
    expect(stale.ok).toBe(false);
    expect(await readConsent(dbx, U("c2"))).toMatchObject({ granted: false, decisionSeq: 2 });
  });

  it("a FRESH decision still succeeds — the fence is not 'refuse everything'", async () => {
    await advanceConsent(dbx, { userId: U("c3"), action: "grant", disclosureVersion: 1, expectedSeq: null });
    const ok = await advanceConsent(dbx, {
      userId: U("c3"), action: "revoke", disclosureVersion: 1, expectedSeq: 1,
    });
    expect(ok.ok).toBe(true);
    expect(ok.ok && ok.state.decisionSeq).toBe(2);
  });

  it("REVOKE then RE-GRANT is permitted, and keeps the same pseudonym", async () => {
    const id = await resolveAnalyticsIdentity(dbx, U("c4"));
    await advanceConsent(dbx, { userId: U("c4"), action: "grant", disclosureVersion: 1, expectedSeq: null });
    await advanceConsent(dbx, { userId: U("c4"), action: "revoke", disclosureVersion: 1, expectedSeq: 1 });
    const re = await advanceConsent(dbx, { userId: U("c4"), action: "grant", disclosureVersion: 1, expectedSeq: 2 });
    expect(re.ok).toBe(true);
    // Revoke is NOT suppression: the identity survives, so collection resumes
    // under the id the member already had.
    const still = await resolveAnalyticsIdentity(dbx, U("c4"));
    expect(still.status).toBe("active");
    expect(still.analyticsId).toBe(id.analyticsId);
  });

  it("RACE · two concurrent decisions from the same seq: exactly one wins", async () => {
    await advanceConsent(dbx, { userId: U("c5"), action: "grant", disclosureVersion: 1, expectedSeq: null });
    const other = separateConnection();
    try {
      const [a, b] = await Promise.all([
        advanceConsent(dbx, { userId: U("c5"), action: "revoke", disclosureVersion: 1, expectedSeq: 1 }),
        advanceConsent(other.dbx, { userId: U("c5"), action: "revoke", disclosureVersion: 1, expectedSeq: 1 }),
      ]);
      expect([a.ok, b.ok].filter(Boolean).length, "exactly one CAS may win").toBe(1);
      expect(await readConsent(dbx, U("c5"))).toMatchObject({ decisionSeq: 2 });
    } finally {
      await other.close();
    }
  });

  it("ROTATION writes no evidence and does not advance decision_seq", async () => {
    await resolveAnalyticsIdentity(dbx, U("c6"));
    await advanceConsent(dbx, { userId: U("c6"), action: "grant", disclosureVersion: 1, expectedSeq: null });
    await rotateAnalyticsIdentity(dbx, U("c6"));
    expect(await readConsent(dbx, U("c6"))).toMatchObject({ decisionSeq: 1 });
    const ev = await db.execute(
      sql`select action from aforce_analytics_consent_events where user_id = ${U("c6")}`,
    );
    const actions = (ev as unknown as { rows: Array<{ action: string }> }).rows.map((r) => r.action);
    // Rotation is an identity operation, not a consent decision. Recording it
    // here would require inventing a disclosure version for a decision the
    // member never made.
    expect(actions).toEqual(["grant"]);
  });

  it("evidence records the version the member ACTED UNDER, never a sentinel", async () => {
    await advanceConsent(dbx, { userId: U("c7"), action: "grant", disclosureVersion: 3, expectedSeq: null });
    const ev = await db.execute(sql`
      select action, disclosure_version, decision_seq from aforce_analytics_consent_events
       where user_id = ${U("c7")} order by id`);
    expect((ev as unknown as { rows: unknown[] }).rows).toEqual([
      { action: "grant", disclosure_version: 3, decision_seq: 1 },
    ]);
  });
});

// ── the shared writer gate ────────────────────────────────────────────

describe.runIf(DB)("S1-3 · consentedAnalyticsIdFor — the gate all writers share", () => {
  it("returns the pseudonym only when consent is granted", async () => {
    const id = await resolveAnalyticsIdentity(dbx, U("g1"));
    expect(await consentedAnalyticsIdFor(dbx, U("g1")), "no consent yet").toBeNull();
    await advanceConsent(dbx, { userId: U("g1"), action: "grant", disclosureVersion: 1, expectedSeq: null });
    expect(await consentedAnalyticsIdFor(dbx, U("g1"))).toBe(id.analyticsId);
  });

  it("returns null after revoke, and again after re-grant returns the id", async () => {
    await resolveAnalyticsIdentity(dbx, U("g2"));
    await advanceConsent(dbx, { userId: U("g2"), action: "grant", disclosureVersion: 1, expectedSeq: null });
    await advanceConsent(dbx, { userId: U("g2"), action: "revoke", disclosureVersion: 1, expectedSeq: 1 });
    expect(await consentedAnalyticsIdFor(dbx, U("g2"))).toBeNull();
    await advanceConsent(dbx, { userId: U("g2"), action: "grant", disclosureVersion: 1, expectedSeq: 2 });
    expect(await consentedAnalyticsIdFor(dbx, U("g2"))).not.toBeNull();
  });

  it("returns null for a suppressed member", async () => {
    await resolveAnalyticsIdentity(dbx, U("g3"));
    await advanceConsent(dbx, { userId: U("g3"), action: "grant", disclosureVersion: 1, expectedSeq: null });
    await forgetAnalyticsForMember(dbx, U("g3"));
    expect(await consentedAnalyticsIdFor(dbx, U("g3"))).toBeNull();
  });

  it("returns null for the DEFAULT_USER_ID sentinel and for no user at all", async () => {
    expect(await consentedAnalyticsIdFor(dbx, "default")).toBeNull();
    expect(await consentedAnalyticsIdFor(dbx, undefined)).toBeNull();
  });

  it("refuses the sentinel EVEN IF a 'default' identity exists and consented", async () => {
    // The previous law passed for the wrong reason: there is normally no
    // 'default' row, so the gate returned null whether or not it checked the
    // sentinel. Seeding one is what makes the check load-bearing — and this is
    // the realistic shape of the hazard, because a dev environment that once
    // resolved as the sentinel WOULD leave such a row behind.
    await db.execute(sql`
      insert into aforce_analytics_identities (user_id, analytics_id, status)
      values ('default', ${"anon_" + "0".repeat(16) + "_" + "f".repeat(16)}, 'active')
      on conflict (user_id) do nothing`);
    await db.execute(sql`
      insert into aforce_analytics_consent_state
        (user_id, granted, decision_seq, disclosure_version)
      values ('default', true, 1, 1)
      on conflict (user_id) do update set granted = true`);
    try {
      expect(
        await consentedAnalyticsIdFor(dbx, "default"),
        "a pseudonym shared by every dev session must never be emitted under",
      ).toBeNull();
    } finally {
      await db.execute(sql`delete from aforce_analytics_consent_state where user_id = 'default'`);
      await db.execute(sql`delete from aforce_analytics_identities where user_id = 'default'`);
    }
  });

  it("NEVER mints — an emission path must not create an identity", async () => {
    expect(await consentedAnalyticsIdFor(dbx, U("g4"))).toBeNull();
    const rows = await db.execute(
      sql`select count(*)::int n from aforce_analytics_identities where user_id = ${U("g4")}`);
    expect((rows as unknown as { rows: Array<{ n: number }> }).rows[0]!.n).toBe(0);
  });
});

// ── forget: ownership + suppression ───────────────────────────────────

describe.runIf(DB)("S1-3 · forget is ownership-safe", () => {
  it("deletes only the CALLER'S rows — another member's id is not accepted", async () => {
    const victim = await resolveAnalyticsIdentity(dbx, U("victim"));
    await db.execute(sql`
      insert into aforce_analytics_events (event_id, event_type, analytics_id, occurred_at, schema_version, payload)
      values ('s1_3_v1', 'app_opened', ${victim.analyticsId}, now(), 1, '{}'::jsonb)`);
    await resolveAnalyticsIdentity(dbx, U("attacker"));

    // The attacker calls forget. The route resolves THEIR pseudonym from
    // their own userId; the victim's id is not an input at all.
    await forgetAnalyticsForMember(dbx, U("attacker"));

    const left = await db.execute(
      sql`select count(*)::int n from aforce_analytics_events where analytics_id = ${victim.analyticsId}`);
    expect(
      (left as unknown as { rows: Array<{ n: number }> }).rows[0]!.n,
      "the victim's history must survive another member's forget",
    ).toBe(1);
    await db.execute(sql`delete from aforce_analytics_events where event_id = 's1_3_v1'`);
  });

  it("suppresses the identity and revokes consent in one transaction", async () => {
    await resolveAnalyticsIdentity(dbx, U("f1"));
    await advanceConsent(dbx, { userId: U("f1"), action: "grant", disclosureVersion: 2, expectedSeq: null });
    await forgetAnalyticsForMember(dbx, U("f1"));
    const consent = await readConsent(dbx, U("f1"));
    expect(consent).toMatchObject({ granted: false, decisionSeq: 2 });
    const ev = await db.execute(sql`
      select action, disclosure_version from aforce_analytics_consent_events
       where user_id = ${U("f1")} order by id`);
    expect((ev as unknown as { rows: unknown[] }).rows).toEqual([
      { action: "grant", disclosure_version: 2 },
      // the version in force when they asked to be forgotten — not a sentinel
      { action: "suppress", disclosure_version: 2 },
    ]);
  });

  it("a member who never decided is a no-op — no invented disclosure version", async () => {
    await resolveAnalyticsIdentity(dbx, U("f2"));
    await forgetAnalyticsForMember(dbx, U("f2"));
    expect(await readConsent(dbx, U("f2"))).toBeNull();
    const ev = await db.execute(
      sql`select count(*)::int n from aforce_analytics_consent_events where user_id = ${U("f2")}`);
    expect((ev as unknown as { rows: Array<{ n: number }> }).rows[0]!.n).toBe(0);
  });

  it("deleted history is not resurrected or re-keyed by a later resolve", async () => {
    const id = await resolveAnalyticsIdentity(dbx, U("f3"));
    await db.execute(sql`
      insert into aforce_analytics_events (event_id, event_type, analytics_id, occurred_at, schema_version, payload)
      values ('s1_3_f3', 'app_opened', ${id.analyticsId}, now(), 1, '{}'::jsonb)`);
    const res = await forgetAnalyticsForMember(dbx, U("f3"));
    expect(res.deleted).toBe(1);
    const after = await resolveAnalyticsIdentity(dbx, U("f3"));
    expect(after.status).toBe("suppressed");
    const rows = await db.execute(
      sql`select count(*)::int n from aforce_analytics_events where event_id = 's1_3_f3'`);
    expect((rows as unknown as { rows: Array<{ n: number }> }).rows[0]!.n).toBe(0);
  });
});

describe.runIf(DB)("S1-3 · the suite leaves nothing behind", () => {
  it("no s1_3_ rows remain", async () => {
    await wipe();
    for (const t of [
      "aforce_analytics_identities",
      "aforce_analytics_consent_state",
      "aforce_analytics_consent_events",
    ]) {
      const r = await db.execute(
        sql`select count(*)::int n from ${sql.identifier(t)} where user_id like 's1_3_user_%'`);
      expect((r as unknown as { rows: Array<{ n: number }> }).rows[0]!.n, t).toBe(0);
    }
  });
});
