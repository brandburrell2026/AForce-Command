import { describe, it, expect, beforeEach, afterAll } from "vitest";
import express, { type Express } from "express";
import { eq } from "drizzle-orm";
import { db, aforceUserState, aforceIntakeLogs } from "@workspace/db";
import intakeRouter from "../intake";
import { logger } from "../../../lib/logger";
import { getUserState } from "../../../lib/aforceState";

// NODE_ENV=test disables the intake rate limiter (see `SKIP_IN_TEST` in
// middlewares/rateLimits.ts) so vitest can hammer the route freely.
process.env["NODE_ENV"] = "test";

// requires real Postgres — runs in the DB lane (pnpm test:db)
const DB = Boolean(process.env['DB_TESTS']);

const TEST_USER_ID = "intake-outbox-test-user";
const DAY_MS = 24 * 60 * 60 * 1000;

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  // requireAuth normally sets req.userId + pino-http sets req.log; shim both
  // so the route resolves our deterministic test user and logging is safe.
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    (req as unknown as { userId: string }).userId = TEST_USER_ID;
    next();
  });
  app.use("/api/aforce", intakeRouter);
  return app;
}

const app = buildApp();

async function cleanup() {
  await db.delete(aforceIntakeLogs).where(eq(aforceIntakeLogs.userId, TEST_USER_ID));
  await db.delete(aforceUserState).where(eq(aforceUserState.userId, TEST_USER_ID));
}

// Seed via the real seeder (satisfies every NOT NULL column), then zero the
// counters so each test starts from a deterministic, demo-data-free baseline.
// updatedAt = now keeps applyDayRollover() a no-op so the zeros survive.
async function resetBaseline() {
  await cleanup();
  await getUserState(TEST_USER_ID);
  await db
    .update(aforceUserState)
    .set({
      unitsConsumedToday: 0,
      ozConsumedToday: 0,
      aforceUnitsToday: 0,
      intakeEvents: [],
      updatedAt: new Date(),
    })
    .where(eq(aforceUserState.userId, TEST_USER_ID));
}

beforeEach(resetBaseline);
afterAll(cleanup);

type IntakeEvent = {
  id: string;
  fluidType: string;
  oz: number;
  loggedAt: string;
  baseImpact: number;
  capAdjusted: number;
  immediate: number;
  delayed: number;
  delayedDurationMin: number;
  heatGuardActiveAtLog: boolean;
  scoreBeforeAtLog: number;
};

function makeEvent(overrides: Partial<IntakeEvent> = {}): IntakeEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fluidType: "water",
    oz: 16,
    loggedAt: new Date().toISOString(),
    baseImpact: 5,
    capAdjusted: 5,
    immediate: 3,
    delayed: 2,
    delayedDurationMin: 30,
    heatGuardActiveAtLog: false,
    scoreBeforeAtLog: 90,
    ...overrides,
  };
}

async function postIntake(body: unknown): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, async () => {
      const addr = server.address();
      if (typeof addr !== "object" || !addr) {
        server.close();
        reject(new Error("no address"));
        return;
      }
      try {
        const res = await fetch(`http://127.0.0.1:${addr.port}/api/aforce/intake`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        resolve({ status: res.status, json });
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

async function readState() {
  const [row] = await db
    .select()
    .from(aforceUserState)
    .where(eq(aforceUserState.userId, TEST_USER_ID))
    .limit(1);
  return row;
}

async function readLogs() {
  return db
    .select()
    .from(aforceIntakeLogs)
    .where(eq(aforceIntakeLogs.userId, TEST_USER_ID));
}

describe.runIf(DB)("POST /api/aforce/intake — offline-outbox idempotency", () => {
  it("a keyed replay does not double-count score, counters, log, or JSONB event", async () => {
    const event = makeEvent();
    const body = {
      fluidType: "water",
      ozAmount: 16,
      scoreBefore: 90,
      scoreAfter: 92,
      event,
      clientEventId: "evt-key-1",
    };

    const first = await postIntake(body);
    expect(first.status).toBe(200);

    let state = await readState();
    expect(state?.unitsConsumedToday).toBe(1);
    expect(state?.ozConsumedToday).toBeCloseTo(16);
    expect(state?.intakeEvents).toHaveLength(1);
    expect(await readLogs()).toHaveLength(1);

    // Replay the exact same queued item (same clientEventId + event).
    const second = await postIntake(body);
    expect(second.status).toBe(200);

    state = await readState();
    expect(state?.unitsConsumedToday).toBe(1); // not 2
    expect(state?.ozConsumedToday).toBeCloseTo(16); // not 32
    expect(state?.intakeEvents).toHaveLength(1); // no duplicate JSONB event
    expect(await readLogs()).toHaveLength(1); // no second log row
  });

  it("the legacy path (no clientEventId) is unchanged — every write counts", async () => {
    const a = await postIntake({
      fluidType: "water",
      ozAmount: 16,
      scoreBefore: 90,
      scoreAfter: 92,
      event: makeEvent(),
    });
    const b = await postIntake({
      fluidType: "water",
      ozAmount: 16,
      scoreBefore: 92,
      scoreAfter: 94,
      event: makeEvent(),
    });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);

    const state = await readState();
    expect(state?.unitsConsumedToday).toBe(2);
    expect(state?.ozConsumedToday).toBeCloseTo(32);
    expect(state?.intakeEvents).toHaveLength(2);
    expect(await readLogs()).toHaveLength(2);
  });

  it("a stale (>24h) keyed replay persists a historical log but never inflates today's score", async () => {
    const stale = makeEvent({
      loggedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    });
    const res = await postIntake({
      fluidType: "water",
      ozAmount: 16,
      scoreBefore: 90,
      scoreAfter: 92,
      event: stale,
      clientEventId: "evt-stale-1",
    });
    expect(res.status).toBe(200);

    const state = await readState();
    expect(state?.unitsConsumedToday).toBe(0); // counters untouched
    expect(state?.ozConsumedToday).toBeCloseTo(0);
    expect(state?.intakeEvents).toHaveLength(0); // not appended to the 24h window

    const logs = await readLogs();
    expect(logs).toHaveLength(1); // historical log still recorded
    expect(new Date(logs[0]!.loggedAt).getTime()).toBeLessThan(Date.now() - DAY_MS);
  });
});
