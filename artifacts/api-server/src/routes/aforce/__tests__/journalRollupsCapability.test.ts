/**
 * `GET /aforce/journal/rollups` — the dense capability, over real HTTP.
 *
 * WHY THIS FILE EXISTS. The founder's rollout ruling turns on four claims:
 * an old request gets the sparse wire, a `dense=1` request gets the dense
 * wire, the shipped client asks for dense, and the legacy path is unchanged.
 * Three of those are properties of THE ROUTE, and this route's own suites are
 * DB-gated — so until now they could only be argued from source text plus a
 * separately-tested aggregation function. Source text cannot prove that the
 * handler actually threads the parsed flag, and an aggregation test cannot
 * prove the route parses the query at all.
 *
 * So this mounts the REAL exported router on an ephemeral port and drives it
 * with real GETs, asserting on the real JSON. The only thing replaced is the
 * `db` handle.
 *
 * A LOCAL QUEUE FAKE, NOT `makeFakeDb`. The shared harness keys its stocked
 * rows by TABLE NAME, and this handler selects `aforce_intake_logs` TWICE in
 * one `Promise.all` — once for intakes, once for the correction bookkeeping.
 * Table-keyed rows would hand the correction query the intake rows, which
 * silently changes which intakes count. The four selects fire in a fixed
 * order, so a queue is deterministic — and the order itself is asserted, so a
 * future reordering of the fetch mis-feeding this queue fails loudly here
 * rather than producing quietly wrong fixtures. (Writing a local fake and
 * saying why is the convention `cyclesIdor.test.ts` set.)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getTableName, type Table } from "drizzle-orm";

const { dbRef } = vi.hoisted(() => ({
  dbRef: { current: null as { next(table: string): unknown[] } | null },
}));

// Only the `db` handle is faked — the real schema tables stay, so the route
// builds its genuine query. The forwarder exists because the route binds `db`
// once at import while each test installs its own fixture.
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const chain = () => {
    let table = "";
    const link: Record<string, unknown> = {
      from(t: Table) { table = getTableName(t); return link; },
      where() { return link; },
      orderBy() { return link; },
      limit() { return link; },
      then(ok: (rows: unknown[]) => unknown, err: (e: unknown) => unknown) {
        const fake = dbRef.current;
        if (!fake) return Promise.reject(new Error("db used before a fixture was installed")).then(ok, err);
        return Promise.resolve(fake.next(table)).then(ok, err);
      },
    };
    return link;
  };
  const refuse = (m: string) => () => { throw new Error(`fake db: unexpected ${m} on a GET`); };
  return {
    ...actual,
    db: { select: chain, insert: refuse("insert"), update: refuse("update"), delete: refuse("delete") },
  };
});

import journalRouter from "../journal";
import { serveRouter, type Harness } from "../../__tests__/_fakeDrizzleDb";

const NOW = new Date("2026-09-02T14:30:00.000Z");

/** A measured snapshot row, shaped as the DB returns it. */
const snap = (iso: string, over: Record<string, unknown> = {}) => ({
  capturedAt: new Date(iso), score: 80, level: "BALANCED",
  ozConsumedToday: 60, aforceUnitsToday: 2, unitsConsumedToday: 5,
  sodiumDeliveredMg: 900, sodiumLostMg: 400, deficitPct: 12,
  autopilotActive: false, socialActive: false,
  hydroStateModelVersion: "hydrostate-v1.0", ...over,
});

/** The member every test in this file describes: measured on two days. */
const FIXTURE = () => [
  [snap("2026-08-28T09:00:00.000Z"), snap("2026-08-31T09:00:00.000Z")], // snapshots
  [],                                                                   // intakes
  [],                                                                   // corrections
  [{ historyStartAt: new Date("2026-06-01T00:00:00.000Z") }],           // user state
];

let harness: Harness;
let served: string[];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  // REFILLED PER REQUEST. Several laws below issue more than one GET — a
  // sparse one and a dense one — so a single drained queue would serve the
  // second request empty rows and "prove" a difference that was really just
  // an exhausted fixture. Each request consumes exactly the four selects
  // asserted below, so refilling on empty keeps every request identical.
  let queue: unknown[][] = [];
  served = [];
  dbRef.current = {
    next(table) {
      served.push(table);
      if (queue.length === 0) queue = FIXTURE();
      return (queue.shift() ?? []) as unknown[];
    },
  };
  harness = await serveRouter("/api/aforce", journalRouter);
});

afterEach(async () => {
  await harness.close();
  dbRef.current = null;
  vi.useRealTimers();
});

type Body = {
  rollups: { date: string; snapshotsCount: number; intakeCount: number }[];
  days: number;
  historyStartAt: string | null;
  dense: boolean;
};

const get = async (qs: string) => {
  const res = await harness.get(`/api/aforce/journal/rollups${qs}`);
  expect(res.status, `GET ${qs} must succeed`).toBe(200);
  return res.json as Body;
};

describe("GET /journal/rollups — the capability is opt-in, over real HTTP", () => {
  it("the fetch order this file's queue depends on is the order the route uses", () => {
    // Guards the FIXTURE, not the route. If the handler ever reorders its
    // Promise.all, the queue would silently feed the correction query the
    // snapshot rows and every law below would assert against nonsense.
    return get("?days=7").then(() => {
      expect(served).toEqual([
        "aforce_score_snapshots",
        "aforce_intake_logs",
        "aforce_intake_logs",
        "aforce_user_state",
      ]);
    });
  });

  it("LAW (a) — the legacy request gets the SPARSE wire", async () => {
    // Exactly what an already-installed build sends.
    const body = await get("?days=7");
    expect(body.rollups.map((r) => r.date)).toEqual(["2026-08-28", "2026-08-31"]);
    expect(body.rollups).toHaveLength(2);
    // Not extended to today, and nothing synthesised.
    expect(body.rollups.some((r) => r.date === "2026-09-02")).toBe(false);
  });

  it("LAW (a) — a request with NO query string at all is sparse too", async () => {
    const body = await get("");
    expect(body.days).toBe(7); // the schema default
    expect(body.rollups).toHaveLength(2);
  });

  it("LAW (b) — dense=1 gets one row per calendar day of the effective window", async () => {
    const body = await get("?days=7&dense=1");
    expect(body.rollups).toHaveLength(7);
    expect(body.rollups[0]!.date).toBe("2026-08-27");
    expect(body.rollups[6]!.date).toBe("2026-09-02"); // always ends at today
  });

  it("LAW (d) — a day present in both responses is IDENTICAL in both", async () => {
    const sparse = await get("?days=7");
    const dense = await get("?days=7&dense=1");
    expect(sparse.rollups.length).toBeGreaterThan(0); // anti-vacuity
    for (const row of sparse.rollups) {
      expect(dense.rollups.find((d) => d.date === row.date)).toEqual(row);
    }
    // ...and the days the dense window ADDS are all empty.
    const added = dense.rollups.filter((d) => !sparse.rollups.some((s) => s.date === d.date));
    expect(added).toHaveLength(5);
    expect(added.every((d) => d.snapshotsCount === 0 && d.intakeCount === 0)).toBe(true);
  });

  it("LAW (d) — historyStartAt is on the wire for BOTH, as #911 shipped it", async () => {
    // The installed build reads this to floor its share window. Extracting the
    // aggregation out of the route dropped it, which no test noticed.
    const iso = "2026-06-01T00:00:00.000Z";
    expect((await get("?days=7")).historyStartAt).toBe(iso);
    expect((await get("?days=7&dense=1")).historyStartAt).toBe(iso);
  });

  it("LAW (d) — `days` echoes back unchanged on both paths", async () => {
    expect((await get("?days=30")).days).toBe(30);
    expect((await get("?days=30&dense=1")).days).toBe(30);
  });

  it("an unparseable capability degrades to sparse — it never 400s", async () => {
    // This route has always ignored parameters it did not recognise, and its
    // catch turns a parse throw into HTTP 400. A shared deep link or a proxy
    // appending junk must not turn a working read into an error, and must
    // certainly not be handed the dense contract.
    for (const junk of ["true", "yes", "2", "0", "", "abc"]) {
      const body = await get(`?days=7&dense=${junk}`);
      expect(body.rollups, `dense=${junk} must be sparse`).toHaveLength(2);
    }
    // Express hands a repeated param over as an array.
    expect((await get("?days=7&dense=1&dense=1")).rollups).toHaveLength(2);
  });

  it("THE 8TH-DAY EDGE over the wire: sparse keeps what dense is too narrow to hold", async () => {
    // The route's SQL cutoff is an instant (now - days*24h) while the dense
    // window is a calendar range ending today, so the fetch reaches one
    // calendar day further back than the window does. A sparse path built as
    // "densify then drop the empties" adds no synthetic rows — it would pass a
    // synthesis-only review — and silently deletes this real measured day.
    let queue: unknown[][] = [];
    const EDGE = () => [
      [snap("2026-08-26T18:00:00.000Z", { score: 77 })],
      [], [],
      [{ historyStartAt: new Date("2026-06-01T00:00:00.000Z") }],
    ];
    dbRef.current = {
      next() {
        if (queue.length === 0) queue = EDGE();
        return (queue.shift() ?? []) as unknown[];
      },
    };
    expect((await get("?days=7")).rollups.map((r) => r.date)).toEqual(["2026-08-26"]);
    // ANTI-VACUITY: the dense window genuinely cannot hold that day.
    expect((await get("?days=7&dense=1")).rollups.map((r) => r.date)).not.toContain("2026-08-26");
  });

  it("the response DECLARES which contract it served", async () => {
    // Without this the two responses are indistinguishable on the wire and a
    // client served sparse after asking for dense reads OBSERVED days as the
    // ELIGIBLE window. It reports what was SERVED, not what was requested —
    // note the second case asks for dense with a junk-duplicated param and is
    // correctly told it got sparse.
    expect((await get("?days=7")).dense).toBe(false);
    expect((await get("?days=7&dense=1")).dense).toBe(true);
    expect((await get("?days=7&dense=nonsense")).dense).toBe(false);
    const dup = await get("?days=7&dense=1&dense=1");
    expect(dup.dense, "asked for dense, served sparse — and says so").toBe(false);
    expect(dup.rollups).toHaveLength(2);
  });

  /* NO TIMELINE LAW LIVES HERE, DELIBERATELY.
   *
   * This suite previously carried one called "the capability does not leak
   * onto /journal/timeline" that asserted a 200 and the absence of a
   * `rollups` key — both true even with `dense` folded into the shared
   * `daysQuery`, so it passed against the exact leak it was named for. The
   * replacement attempt (comparing the timeline response with and without the
   * param) cannot run here either: this file's db fixture is rollups-shaped,
   * and /journal/timeline throws against it, so the comparison would be two
   * identical 400s — green, and proof of nothing.
   *
   * The guard that genuinely holds this is `assertCapabilityIsOptIn` in
   * journalRollupsRouteWiring.test.ts, which reads the `daysQuery`
   * declaration and the timeline handler directly, and has a mutation-verify
   * that introduces ONLY the leak. Leaving a weaker duplicate here would have
   * been worse than leaving nothing: a reviewer would have read the name and
   * believed the behaviour was covered.
   */

  it("the GET performs no write", async () => {
    // The fake throws on insert/update/delete, so a write would surface as a
    // 400 rather than a silent row.
    await get("?days=7&dense=1");
  });
});
