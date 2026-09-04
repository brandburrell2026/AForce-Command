/**
 * THE ROLLUPS CANARY, over real HTTP.
 *
 * The unit laws prove the classifier. What they cannot prove is that the route
 * actually increments anything, that it counts what it SERVED rather than what
 * was asked for, and that a schema fault now answers 500 instead of hiding in
 * the 4xx bucket. Those are properties of the handler, so the real router is
 * mounted and driven with real GETs.
 *
 * WHY THIS EXISTS AT ALL. `/journal/rollups` selects
 * `aforce_user_state.history_start_at` unconditionally — for sparse callers as
 * well as dense — so when that column was missing from production every rollups
 * request threw and was reported as a 400. The only counter that could see it,
 * `requests_total.api_aforce.4xx`, buckets by the first two path segments and
 * is shared by every AForce route. A total outage was indistinguishable from a
 * bad query string, and it ran for over a day.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTableName, type Table } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm";

const NOW = new Date("2026-09-04T14:30:00.000Z");

const { dbRef, forceSparse } = vi.hoisted(() => ({
  dbRef: { current: null as { next(t: string): unknown[] } | null },
  // Lets one test make the aggregation serve SPARSE while the request asked
  // for dense — the divergence a healthy server can never produce, and the
  // only way to prove the served counter reads the RESPONSE not the REQUEST.
  forceSparse: { current: false },
}));

vi.mock("../../../lib/journalRollupsAggregation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/journalRollupsAggregation")>();
  return {
    ...actual,
    buildJournalRollupsResponse: (input: Parameters<typeof actual.buildJournalRollupsResponse>[0]) => {
      const built = actual.buildJournalRollupsResponse(input);
      return forceSparse.current ? { ...built, dense: false } : built;
    },
  };
});

vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const chain = () => {
    let table = "";
    const link: Record<string, unknown> = {
      from(t: Table) { table = getTableName(t); return link; },
      where() { return link; }, orderBy() { return link; }, limit() { return link; },
      then(ok: (r: unknown[]) => unknown, err: (e: unknown) => unknown) {
        try { return Promise.resolve(dbRef.current?.next(table) ?? []).then(ok, err); }
        catch (e) { return Promise.reject(e).then(ok, err); }
      },
    };
    return link;
  };
  const refuse = (m: string) => () => { throw new Error(`fake db: unexpected ${m}`); };
  return { ...actual, db: { select: chain, insert: refuse("insert"), update: refuse("update"), delete: refuse("delete") } };
});

import journalRouter from "../journal";
import { serveRouter, type Harness } from "../../__tests__/_fakeDrizzleDb";
import { snapshot, __resetForTests } from "../../../observability/metrics";

const snap = (iso: string) => ({
  capturedAt: new Date(iso), score: 80, level: "BALANCED", ozConsumedToday: 60,
  aforceUnitsToday: 2, unitsConsumedToday: 5, sodiumDeliveredMg: 900, sodiumLostMg: 400,
  deficitPct: 12, autopilotActive: false, socialActive: false,
  hydroStateModelVersion: "hydrostate-v1.0",
});
const HEALTHY = () => [
  [snap("2026-08-30T09:00:00.000Z")], [], [],
  [{ historyStartAt: new Date("2026-06-01T00:00:00.000Z") }],
];

let harness: Harness;
const counters = () => snapshot().counters;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  __resetForTests();
  let q: unknown[][] = [];
  forceSparse.current = false;
  dbRef.current = { next: () => { if (q.length === 0) q = HEALTHY(); return (q.shift() ?? []) as unknown[]; } };
  harness = await serveRouter("/api/aforce", journalRouter);
});
afterEach(async () => { await harness.close(); dbRef.current = null; __resetForTests(); vi.useRealTimers(); });

const get = (qs: string) => harness.get(`/api/aforce/journal/rollups${qs}`);

describe("(a)+(b) what was asked, and what was served", () => {
  it("a sparse request counts sparse on BOTH sides", async () => {
    expect((await get("?days=7")).status).toBe(200);
    expect(counters()["rollups_requested.sparse"]).toBe(1);
    expect(counters()["rollups_served.sparse"]).toBe(1);
    expect(counters()["rollups_requested.dense"]).toBeUndefined();
  });

  it("a dense request counts dense on BOTH sides", async () => {
    expect((await get("?days=7&dense=1")).status).toBe(200);
    expect(counters()["rollups_requested.dense"]).toBe(1);
    expect(counters()["rollups_served.dense"]).toBe(1);
  });

  it("BOTH arms are counted — absence of dense is distinguishable from absence of traffic", async () => {
    // Without the sparse arm, "no dense-capable builds in the field" and
    // "nobody called rollups" look identical, which is the question a staged
    // client rollout exists to answer.
    await get("?days=7"); await get("?days=7"); await get("?days=7&dense=1");
    expect(counters()["rollups_requested.sparse"]).toBe(2);
    expect(counters()["rollups_requested.dense"]).toBe(1);
  });

  it("junk capability values fail closed, and both counters agree", async () => {
    const r = await get("?days=7&dense=maybe");
    expect(r.status).toBe(200);
    expect((r.json as { dense: boolean }).dense).toBe(false);
    expect(counters()["rollups_requested.sparse"]).toBe(1);
    expect(counters()["rollups_served.sparse"]).toBe(1);
  });

  it("SERVED IS READ OFF THE BUILT RESPONSE — proven by forcing them to disagree", async () => {
    // A healthy server can never produce this: dense requested, sparse served.
    // Forcing it is the only way to tell the two counters apart — count the
    // request instead and `served` becomes a restatement of `requested`, and
    // the pair proves nothing at exactly the moment it matters.
    forceSparse.current = true;
    const r = await get("?days=7&dense=1");
    expect(r.status).toBe(200);
    expect(counters()["rollups_requested.dense"], "the ASK was dense").toBe(1);
    expect(counters()["rollups_served.sparse"], "the SERVE was sparse").toBe(1);
    expect(counters()["rollups_served.dense"], "and must NOT be counted as dense").toBeUndefined();
  });
});

describe("(c) the contract-violation tripwire", () => {
  it("reads zero on a healthy server — it is an invariant, not a metric", async () => {
    await get("?days=7&dense=1");
    await get("?days=7");
    expect(counters()["rollups_contract_violation.dense_not_served"]).toBeUndefined();
  });

  it("FIRES when dense is asked for and not served — the condition it exists for", async () => {
    // The tripwire should read zero forever in production, which makes it the
    // kind of code that rots unnoticed. Forcing the divergence proves the
    // branch is reachable and spelled correctly, rather than asserting the
    // source text and hoping.
    forceSparse.current = true;
    expect((await get("?days=7&dense=1")).status).toBe(200);
    expect(counters()["rollups_contract_violation.dense_not_served"]).toBe(1);
  });

  it("does NOT fire when sparse was asked for and sparse was served", async () => {
    forceSparse.current = true;
    await get("?days=7");
    expect(counters()["rollups_contract_violation.dense_not_served"]).toBeUndefined();
  });
});

describe("(d) failures are split, and ours answer 500", () => {
  it("A SCHEMA FAULT IS A 500 AND IS COUNTED AS `schema`", async () => {
    // Exactly the production outage: a real DrizzleQueryError wrapping 42703.
    dbRef.current = { next: () => {
      throw new DrizzleQueryError("select ...", [],
        Object.assign(new Error('column "history_start_at" does not exist'), { code: "42703" }));
    } };
    const r = await get("?days=7");
    expect(r.status, "a missing column is OUR fault, not the caller's").toBe(500);
    expect(r.json).toEqual({ error: "rollups_failed" });
    expect(counters()["rollups_failures.schema"]).toBe(1);
    expect(counters()["rollups_failures.aggregation"]).toBeUndefined();
  });

  it("an ordinary db error is counted separately from a schema fault", async () => {
    dbRef.current = { next: () => {
      throw new DrizzleQueryError("select ...", [], Object.assign(new Error("conn"), { code: "08006" }));
    } };
    expect((await get("?days=7")).status).toBe(500);
    expect(counters()["rollups_failures.db"]).toBe(1);
    expect(counters()["rollups_failures.schema"]).toBeUndefined();
  });

  it("a bug in our own code is `aggregation`, still 500", async () => {
    dbRef.current = { next: () => { throw new TypeError("x is not a function"); } };
    expect((await get("?days=7")).status).toBe(500);
    expect(counters()["rollups_failures.aggregation"]).toBe(1);
  });

  it("A BAD QUERY STRING IS STILL A 400 — the only honest 4xx", async () => {
    const r = await get("?days=999");
    expect(r.status).toBe(400);
    expect(counters()["rollups_failures.bad_request"]).toBe(1);
    expect(counters()["rollups_failures.schema"]).toBeUndefined();
  });

  it("the response body never leaks the SQL, the table, or the column", async () => {
    dbRef.current = { next: () => {
      throw new DrizzleQueryError("select \"history_start_at\" from \"aforce_user_state\"", [],
        Object.assign(new Error('column "history_start_at" does not exist'), { code: "42703" }));
    } };
    const r = await get("?days=7");
    expect(JSON.stringify(r.json)).not.toMatch(/aforce_user_state|history_start_at|select/i);
  });
});

describe("the counters are readable the way an operator would read them", () => {
  it("every canary name follows the existing <family>.<dimension> convention", async () => {
    await get("?days=7&dense=1");
    dbRef.current = { next: () => { throw new TypeError("boom"); } };
    await get("?days=7");
    const mine = Object.keys(counters()).filter((k) => k.startsWith("rollups_"));
    expect(mine.length).toBeGreaterThan(0);
    for (const k of mine) {
      expect(k, `${k} must be <family>.<dimension>, snake_case, no interpolated identity`)
        .toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });
});
