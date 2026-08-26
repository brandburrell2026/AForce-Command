/**
 * Wave-4 — the Circle GETs must never fabricate.
 *
 * Every read on this router used to seed an invented circle into a REAL
 * user's rows on first open: eight people who do not exist, their
 * "scores" and streaks, two challenges from them, four notifications
 * about them. Written into the user's own tables, those became
 * indistinguishable from a real circle forever — the failure the
 * Constitution names ("observation never diagnosis", "trust over
 * attention"). Social position may not be invented; real data or an
 * honest empty.
 *
 * Locked here, per endpoint:
 *   1. a GET writes NOTHING;
 *   2. a user with no circle reads empty, not a demo circle;
 *   3. a real member (and their status) still comes back;
 *   4. the emitted WHERE excludes the legacy seeded rows — members by
 *      their mock ids, challenges and notifications by their
 *      user-prefixed ids — so rows an earlier build already wrote stop
 *      being served without anything being deleted.
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
// than falling back to DEFAULT_USER_ID — challenge and notification seed
// ids were user-prefixed, so the caller identity is load-bearing here.
const { authHolder } = vi.hoisted(() => ({
  authHolder: { value: { userId: null as string | null, sessionClaims: null as unknown } },
}));
vi.mock("@clerk/express", () => ({ getAuth: () => authHolder.value }));

import circleRouter from "../circle";
import { makeFakeDb, renderWhere, serveRouter, type FakeDb, type Harness } from "./_fakeDrizzleDb";

const USER_A = "user_2aAaAaAaAaAaAaAaAaAaAaAa";
const USER_B = "user_2bBbBbBbBbBbBbBbBbBbBbBb";
/** A member id of the shape a real invite produces (a Clerk id) — it
 *  can never collide with the mock ids below. */
const REAL_MEMBER = "user_2cCcCcCcCcCcCcCcCcCcCcCc";

/** The rows the retired seeder wrote, keyed as it stored them. Spelled
 *  out rather than imported from the route so the tests state the
 *  contract independently of the constants they guard. */
const LEGACY_MEMBER_IDS = [
  "u_kai",
  "u_sasha",
  "u_marcus",
  "u_devon",
  "u_riley",
  "u_coach_j",
  "u_mom",
  "u_ari",
];

function legacyChallengeIds(userId: string): string[] {
  return [`${userId}:ch_1`, `${userId}:ch_2`];
}

function legacyNotificationIds(userId: string): string[] {
  return [`${userId}:n1`, `${userId}:n2`, `${userId}:n3`, `${userId}:n4`];
}

function memberRow(memberUserId: string, ownerUserId: string, status = "active") {
  return {
    id: 1,
    ownerUserId,
    memberUserId,
    name: "Jordan Ellis",
    initials: "JE",
    city: "Tampa",
    group: "friends",
    status,
    joinedAt: new Date("2026-08-01T00:00:00Z"),
  };
}

function statusRow(memberUserId: string, ownerUserId: string) {
  return {
    id: 1,
    ownerUserId,
    memberUserId,
    score: 77,
    state: "Balanced",
    streakDays: 4,
    protocolComplete: false,
    trend: "flat",
    updatedAt: new Date("2026-08-11T18:00:00Z"),
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
  harness = await serveRouter("/api/circle", circleRouter);
});

afterEach(async () => {
  await harness.close();
});

function install(rows: Record<string, unknown[]> = {}): FakeDb {
  fake = makeFakeDb(rows);
  dbRef.current = fake.db as Record<string, (...args: never[]) => unknown>;
  return fake;
}

function whereFor(table: string) {
  const call = fake.selects.find((s) => s.table === table);
  expect(call, `no read of ${table}`).toBeDefined();
  return renderWhere(call?.where);
}

describe("Circle GETs — a user with no circle reads empty, and nothing is written", () => {
  it.each([
    ["/api/circle/", "users"],
    ["/api/circle/pending", "users"],
    ["/api/circle/feed", "feed"],
    ["/api/circle/challenges", "challenges"],
    ["/api/circle/notifications", "notifications"],
  ])("%s returns an empty %s", async (path, key) => {
    install();

    const res = await harness.get(path);

    expect(res.status).toBe(200);
    expect(res.json).toEqual({ [key]: [] });
    // The whole point of the change: a read is a read.
    expect(fake.writes).toEqual([]);
  });
});

describe("Circle GETs — real members still come back", () => {
  it("GET / returns a real member", async () => {
    install({ aforce_circle_users: [memberRow(REAL_MEMBER, USER_A)] });

    const res = await harness.get("/api/circle/");

    expect(res.json).toMatchObject({ users: [{ userId: REAL_MEMBER, name: "Jordan Ellis" }] });
    expect(fake.writes).toEqual([]);
  });

  it("GET /feed joins a real member to their real status", async () => {
    install({
      aforce_circle_users: [memberRow(REAL_MEMBER, USER_A)],
      aforce_circle_statuses: [statusRow(REAL_MEMBER, USER_A)],
    });

    const res = await harness.get("/api/circle/feed");

    expect(res.json).toMatchObject({
      feed: [{ score: 77, user: { userId: REAL_MEMBER } }],
    });
    expect(fake.writes).toEqual([]);
  });
});

describe("Circle GETs — legacy seeded rows are excluded on read, not deleted", () => {
  it("GET / excludes the seeded member ids", async () => {
    install();

    await harness.get("/api/circle/");

    const { sql, params } = whereFor("aforce_circle_users");
    expect(sql).toContain('"aforce_circle_users"."member_user_id" not in');
    expect(params).toEqual([USER_A, "active", ...LEGACY_MEMBER_IDS]);
  });

  it("GET /?group= keeps the exclusion on the group-filtered branch", async () => {
    install();

    await harness.get("/api/circle/?group=team");

    const { params } = whereFor("aforce_circle_users");
    expect(params).toEqual([USER_A, "active", "team", ...LEGACY_MEMBER_IDS]);
  });

  it("GET /pending excludes the seeded member ids", async () => {
    install();

    await harness.get("/api/circle/pending");

    const { params } = whereFor("aforce_circle_users");
    // `u_ari` was the seeded pending request — the one this endpoint served.
    expect(params).toEqual([USER_A, "pending", ...LEGACY_MEMBER_IDS]);
  });

  it("GET /feed excludes seeded members from BOTH the users and statuses reads", async () => {
    install();

    await harness.get("/api/circle/feed");

    expect(whereFor("aforce_circle_users").params).toEqual([
      USER_A,
      "active",
      ...LEGACY_MEMBER_IDS,
    ]);
    const statuses = whereFor("aforce_circle_statuses");
    expect(statuses.sql).toContain('"aforce_circle_statuses"."member_user_id" not in');
    expect(statuses.params).toEqual([USER_A, ...LEGACY_MEMBER_IDS]);
  });

  it("GET /challenges excludes the seeded challenge ids, per caller", async () => {
    install();
    await harness.get("/api/circle/challenges");
    expect(whereFor("aforce_circle_challenges").params).toEqual([
      USER_A,
      "open",
      ...legacyChallengeIds(USER_A),
    ]);

    authHolder.value = { userId: USER_B, sessionClaims: null };
    install();
    await harness.get("/api/circle/challenges");
    // Ids were stored user-prefixed, so the list is rebuilt per caller.
    expect(whereFor("aforce_circle_challenges").params).toEqual([
      USER_B,
      "open",
      ...legacyChallengeIds(USER_B),
    ]);
  });

  it("GET /notifications excludes the seeded notification ids, per caller", async () => {
    install();
    await harness.get("/api/circle/notifications");
    expect(whereFor("aforce_circle_notifications").params).toEqual([
      USER_A,
      ...legacyNotificationIds(USER_A),
    ]);

    authHolder.value = { userId: USER_B, sessionClaims: null };
    install();
    await harness.get("/api/circle/notifications");
    expect(whereFor("aforce_circle_notifications").params).toEqual([
      USER_B,
      ...legacyNotificationIds(USER_B),
    ]);
  });
});
