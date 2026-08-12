/**
 * Wave-4 — GET /api/battles must never fabricate.
 *
 * Until this change the route seeded three invented regional rivalries
 * (`b_mia_nyc`, `b_fl_ca`, `b_pulse_apex`) into a REAL user's rows the
 * first time they opened the screen. Once written they were
 * indistinguishable from battles the user actually opened — the failure
 * the Constitution names ("observation never diagnosis", "trust over
 * attention").
 *
 * Locked here:
 *   1. a GET writes NOTHING, so no fabricated row is ever created;
 *   2. a fresh user reads an empty list rather than a demo one;
 *   3. battles the user opened themselves still come back untouched;
 *   4. the emitted WHERE excludes the legacy seed ids, per caller, so
 *      rows an earlier build already wrote stop being served without
 *      anything being deleted.
 *
 * See `_fakeDrizzleDb.ts` for the harness and for what this DB-free lane
 * deliberately does not prove.
 */

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";

const { dbRef } = vi.hoisted(() => ({
  dbRef: {
    current: null as Record<string, (...args: never[]) => unknown> | null,
  },
}));

// Only the `db` handle is faked; the real schema tables are kept so the
// route builds its genuine WHERE. The forwarder exists because the route
// binds `db` once at import while each test installs its own fake.
vi.mock("@workspace/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/db")>();
  const forward =
    (method: string) =>
    (...args: never[]) => {
      const fake = dbRef.current;
      if (!fake) throw new Error(`db.${method}() before a fake was installed`);
      return fake[method]!(...args);
    };
  return {
    ...actual,
    db: {
      select: forward("select"),
      insert: forward("insert"),
      update: forward("update"),
      delete: forward("delete"),
    },
  };
});

// Clerk is stubbed so requireAuth resolves a real-shaped user id rather
// than falling back to DEFAULT_USER_ID — the seed ids are user-prefixed,
// so the caller identity is load-bearing here.
const { authHolder } = vi.hoisted(() => ({
  authHolder: { value: { userId: null as string | null, sessionClaims: null as unknown } },
}));
vi.mock("@clerk/express", () => ({ getAuth: () => authHolder.value }));

import battlesRouter from "../battles";
import { makeFakeDb, renderWhere, serveRouter, type FakeDb, type Harness } from "./_fakeDrizzleDb";

const USER_A = "user_2aAaAaAaAaAaAaAaAaAaAaAa";
const USER_B = "user_2bBbBbBbBbBbBbBbBbBbBbBb";

/** The three rows the retired seeder wrote, keyed as it stored them.
 *  Spelled out rather than imported from the route so the test states
 *  the contract independently of the constant it guards. */
function legacySeedIds(userId: string): string[] {
  return [`${userId}:b_mia_nyc`, `${userId}:b_fl_ca`, `${userId}:b_pulse_apex`];
}

function battleRow(id: string, ownerUserId: string) {
  return {
    id,
    ownerUserId,
    side1RegionId: "city_miami_fl",
    side2RegionId: "city_nyc_ny",
    side1Score: 50,
    side2Score: 50,
    hoursRemaining: 24,
    leader: "tie",
    trend: "flat",
    createdAt: new Date("2026-08-12T00:00:00Z"),
    updatedAt: new Date("2026-08-12T00:00:00Z"),
  };
}

const ORIGINAL_CLERK_KEY = process.env["CLERK_SECRET_KEY"];
afterAll(() => {
  if (ORIGINAL_CLERK_KEY === undefined) delete process.env["CLERK_SECRET_KEY"];
  else process.env["CLERK_SECRET_KEY"] = ORIGINAL_CLERK_KEY;
});

let fake: FakeDb;
let harness: Harness;

beforeEach(async () => {
  process.env["CLERK_SECRET_KEY"] = "sk_test_configured";
  authHolder.value = { userId: USER_A, sessionClaims: null };
  harness = await serveRouter("/api/battles", battlesRouter);
});

afterEach(async () => {
  await harness.close();
});

function install(rows: Record<string, unknown[]> = {}): FakeDb {
  fake = makeFakeDb(rows);
  dbRef.current = fake.db as Record<string, (...args: never[]) => unknown>;
  return fake;
}

describe("GET /api/battles — no fabricated rows", () => {
  it("a user with no battles gets an empty list, and nothing is written", async () => {
    install();

    const res = await harness.get("/api/battles/");

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ battles: [] });
    // The whole point of the change: a read is a read.
    expect(fake.writes).toEqual([]);
  });

  it("a battle the user opened themselves still comes back", async () => {
    const mine = `${USER_A}:b_1755000000000`;
    install({ aforce_battles: [battleRow(mine, USER_A)] });

    const res = await harness.get("/api/battles/");

    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ battles: [{ id: mine, side1Score: 50 }] });
    expect(fake.writes).toEqual([]);
  });

  it("the read excludes the legacy seed ids instead of deleting them", async () => {
    install();

    await harness.get("/api/battles/");

    const [read] = fake.selects;
    expect(read?.table).toBe("aforce_battles");
    const { sql, params } = renderWhere(read?.where);
    expect(sql).toContain('"aforce_battles"."id" not in');
    expect(params).toEqual([USER_A, ...legacySeedIds(USER_A)]);
  });

  it("the exclusion list is rebuilt per caller (ids were user-prefixed)", async () => {
    authHolder.value = { userId: USER_B, sessionClaims: null };
    install();

    await harness.get("/api/battles/");

    const { params } = renderWhere(fake.selects[0]?.where);
    expect(params).toEqual([USER_B, ...legacySeedIds(USER_B)]);
    // A hardcoded prefix would leak user A's exclusions into user B's read.
    expect(params).not.toContain(`${USER_A}:b_mia_nyc`);
  });
});
