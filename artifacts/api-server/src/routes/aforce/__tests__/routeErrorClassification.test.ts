/**
 * ROUTE-LEVEL CLASSIFICATION LAWS — a client fault is a 4xx, an operation
 * failure is a 5xx, and the two can no longer be confused.
 *
 * THE DEFECT THESE PIN. Every handler in routes/aforce/* wrapped BOTH its
 * schema parse AND its database work in one try, then answered 400 for
 * whatever came out. A database outage was therefore reported to the client as
 * "your request was malformed" — so a retry policy keyed on 4xx-vs-5xx did the
 * opposite of the right thing at exactly the moment it mattered.
 *
 * The repair is STRUCTURAL, not a classifier: validation now runs BEFORE the
 * try, so the 400 path and the 500 path are different code paths rather than
 * two readings of one catch. These are route-level tests, not helper tests —
 * they drive the real routers over HTTP and inject a real failure.
 *
 * ENV. NODE_ENV is left at 'test' and CLERK_SECRET_KEY unset so requireAuth
 * grants DEFAULT_USER_ID (requireAuth.ts:44) and the handlers actually execute;
 * the auth surface itself is covered by smartCaptureMountOrder/apiErrorContract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";

// The DB seam. `updateUserState` is what every status/social handler awaits
// after validation, so making it throw injects an operation failure at exactly
// the point a real outage would appear. DEFAULT_USER_ID must survive the mock —
// requireAuth imports it from the same module.
const dbFailure = { shouldThrow: false };
vi.mock("../../../lib/aforceState", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    DEFAULT_USER_ID: "default",
    getUserState: vi.fn(async () => {
      if (dbFailure.shouldThrow) throw new Error("connection terminated unexpectedly");
      return { userId: "default", socialMode: null };
    }),
    updateUserState: vi.fn(async (_u: string, patch: Record<string, unknown>) => {
      if (dbFailure.shouldThrow) throw new Error("connection terminated unexpectedly");
      return { userId: "default", ...patch };
    }),
  };
});

// The journal timeline reads the DB directly rather than through
// aforceState, so it needs its own seam. Mocking `db.select` is the closest
// stand-in for the outage this route used to report as a 400.
vi.mock("@workspace/db", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    db: {
      ...(actual["db"] as Record<string, unknown>),
      select: (...args: unknown[]) => {
        if (dbFailure.shouldThrow) throw new Error("connection terminated unexpectedly");
        return (actual["db"] as { select: (...a: unknown[]) => unknown }).select(...args);
      },
    },
  };
});

vi.mock("../shared", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, broadcastState: vi.fn(() => undefined) };
});

const ENV = ["NODE_ENV", "CLERK_SECRET_KEY"] as const;
let prev: Record<string, string | undefined> = {};

beforeEach(() => {
  prev = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));
  process.env["NODE_ENV"] = "test";
  delete process.env["CLERK_SECRET_KEY"];
  dbFailure.shouldThrow = false;
});

afterEach(() => {
  for (const k of ENV) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
});

/** Mounts the REAL routers the way app.ts does: /api/aforce behind requireAuth. */
async function boot() {
  const { default: aforceRouter } = await import("../../aforce");
  const app = express();
  app.use(express.json({ limit: "64kb" }));
  app.use("/api/aforce", aforceRouter);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

async function post(base: string, path: string, body: unknown) {
  const res = await fetch(base + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { json = null; }
  return { status: res.status, json };
}

// Representative across all three shapes: a plain body handler, a handler whose
// resolveUserId precedes the parse, and a query-param handler.
const CASES = [
  { name: "POST /signals", path: "/api/aforce/signals", bad: { symptoms: 42 }, good: { symptoms: ["dizzy"] }, code: "signals_failed" },
  { name: "POST /urine", path: "/api/aforce/urine", bad: { urineSignal: 99 }, good: { urineSignal: 3 }, code: "urine_failed" },
  { name: "POST /flags", path: "/api/aforce/flags", bad: { clutchActive: "yes" }, good: { clutchActive: true }, code: "flags_failed" },
  { name: "POST /language", path: "/api/aforce/language", bad: { language: "xx" }, good: { language: "es" }, code: "language_failed" },
];

describe("LAW — malformed input is a 400, on every migrated route", () => {
  it.each(CASES)("$name rejects a bad body with 400", async ({ path, bad, code }) => {
    const app = await boot();
    try {
      const r = await post(app.base, path, bad);
      expect(r.status).toBe(400);
      // `error` is PRESERVED byte-for-byte; `code` is the new discriminator.
      expect(r.json).toMatchObject({ error: code, code: "invalid_body" });
    } finally {
      await app.close();
    }
  });

  it("validation happens BEFORE the database is touched", async () => {
    // The structural guarantee: with the DB rigged to throw, a malformed body
    // still yields 400 — proving the 400 path never reaches the operation.
    dbFailure.shouldThrow = true;
    const app = await boot();
    try {
      const r = await post(app.base, "/api/aforce/signals", { symptoms: 42 });
      expect(r.status).toBe(400);
      expect(r.json).toMatchObject({ code: "invalid_body" });
    } finally {
      await app.close();
    }
  });
});

describe("LAW — an injected database failure is a 500, never a 400", () => {
  it.each(CASES)("$name reports an operation failure as 500", async ({ path, good, code }) => {
    dbFailure.shouldThrow = true;
    const app = await boot();
    try {
      const r = await post(app.base, path, good);
      expect(r.status, "400 here means the route still blanket-400s a DB fault").toBe(500);
      // `error` unchanged from before this PR; `code` now names the operation.
      expect(r.json).toMatchObject({ error: code, code });
      expect(typeof r.json?.["requestId"] === "string" || r.json?.["requestId"] === undefined).toBe(true);
    } finally {
      await app.close();
    }
  });

  it("the 500 body carries no driver text, stack or connection detail", async () => {
    dbFailure.shouldThrow = true;
    const app = await boot();
    try {
      const r = await post(app.base, "/api/aforce/signals", { symptoms: ["dizzy"] });
      const raw = JSON.stringify(r.json);
      expect(raw).not.toMatch(/connection terminated|at .*\(|stack|Error:/i);
    } finally {
      await app.close();
    }
  });
});

describe("LAW — success is unchanged", () => {
  it.each(CASES)("$name still returns 200 and a userState", async ({ path, good }) => {
    const app = await boot();
    try {
      const res = await fetch(app.base + path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(good),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toHaveProperty("userState");
    } finally {
      await app.close();
    }
  });
});

describe("LAW — GET /journal/timeline (the CONFIRMED misclassification)", () => {
  // This route has no request body and no client-supplied field to blame: the
  // try wraps DB reads only. Every realistic failure is a server fault, and it
  // returned 400 timeline_failed. It is the one site the inventory classified
  // as CONFIRMED rather than ambiguous.
  //
  // This block exists because a mutation caught its absence: reverting only
  // /journal/timeline to a blanket 400 left the whole suite green, which meant
  // the route with the clearest defect had no law at all.
  it("an injected database failure is a 500, not a 400", async () => {
    dbFailure.shouldThrow = true;
    const app = await boot();
    try {
      const res = await fetch(`${app.base}/api/aforce/journal/timeline?days=7`);
      expect(res.status, "400 here is the original defect").toBe(500);
      expect(await res.json()).toMatchObject({ error: "timeline_failed", code: "timeline_failed" });
    } finally {
      await app.close();
    }
  });

  it("a malformed query is still a 400", async () => {
    dbFailure.shouldThrow = true; // proves validation precedes the DB here too
    const app = await boot();
    try {
      const res = await fetch(`${app.base}/api/aforce/journal/timeline?days=999`);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: "timeline_failed", code: "invalid_body" });
    } finally {
      await app.close();
    }
  });
});

describe("LAW — client-dependent statuses are untouched", () => {
  it("no migrated aforce route emits 404 or 409", async () => {
    // Five client sites branch on 404/409 (garmin.ts:86/170, whoopConnect.ts:80/164,
    // healthConnectionMapping.ts:54). None of them reads these routes, and this
    // law pins that the migrated files cannot start emitting those statuses.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const f of ["status.ts", "social.ts", "sensors.ts", "achievements.ts", "analytics.ts"]) {
      const src = readFileSync(join(__dirname, "..", f), "utf8");
      expect(src, f).not.toMatch(/res\.status\(404\)/);
      expect(src, f).not.toMatch(/res\.status\(409\)/);
    }
  });

  it("a genuine client fault that was ALREADY a 400 stays a 400", async () => {
    // social_not_active is a real client fault (hydrating with no active
    // session) and was deliberately NOT migrated. If the sweep had been done
    // with a blanket find-and-replace it would have become a 500.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "social.ts"), "utf8");
    expect(src).toMatch(/res\.status\(400\)\.json\(\{ error: "social_not_active" \}\)/);
  });
});
