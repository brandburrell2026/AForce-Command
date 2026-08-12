/**
 * Route-level tests for /api/scans.
 *
 * Two responsibilities:
 *
 *  1. SECURITY (IDOR): the endpoint must isolate scan data by the
 *     authenticated Clerk user (`req.userId` from requireAuth) and must
 *     IGNORE the client-supplied `x-device-id` header entirely. A caller
 *     can no longer read or write another user's scans by spoofing that
 *     header, and an unauthenticated caller is rejected.
 *
 *  2. LEGACY CONTRACT: swapping the in-memory store onto the Drizzle-backed
 *     HydroScanRepo did NOT introduce externally observable drift on the
 *     edge inputs the architect flagged:
 *       - `body.id === ""` is accepted verbatim, not regenerated.
 *       - `body.loggedAt` is echoed in the response exactly as sent.
 *       - `?limit` accepts negative values and applies tail-trimming slice.
 *
 * Auth is exercised through the REAL requireAuth middleware. We set a dummy
 * CLERK_SECRET_KEY and mock @clerk/express's getAuth() so each request's
 * identity is driven by an `x-auth-user` test header. This proves the route
 * keys off the verified user id, not the device header.
 */
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import express, { type Express, type Request } from "express";
import http from "node:http";
import { eq } from "drizzle-orm";
import { db, aforceHydroScans } from "@workspace/db";
import scansRouter from "../routes/scans";
import { logger } from "../lib/logger";

process.env["NODE_ENV"] = "test";
// requireAuth only consults Clerk when a secret key is present; with the
// mock below, getAuth() returns the identity carried in the x-auth-user
// header so each test request can act as a distinct user.
process.env["CLERK_SECRET_KEY"] = "sk_test_dummy_for_scans_route";

vi.mock("@clerk/express", () => ({
  getAuth: (req: Request) => {
    const u = req.header("x-auth-user");
    return { userId: u && u.length > 0 ? u : null, sessionClaims: null };
  },
}));

// requires real Postgres — runs in the DB lane (pnpm test:db)
const DB = Boolean(process.env['DB_TESTS']);

const TEST_USER_PREFIX = "test_scans_route_";

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });
  app.use("/api", scansRouter);
  return app;
}

let server: http.Server;
let baseUrl = "";

async function cleanupTestRows(): Promise<void> {
  const all = await db.select().from(aforceHydroScans);
  for (const row of all) {
    if (row.userId.startsWith(TEST_USER_PREFIX)) {
      await db.delete(aforceHydroScans).where(eq(aforceHydroScans.id, row.id));
    }
  }
}

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = buildApp().listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await cleanupTestRows();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(async () => {
  await cleanupTestRows();
});

const user = (suffix: string) => `${TEST_USER_PREFIX}${suffix}_${Date.now()}`;

/** Authenticated request helper — identity is carried in x-auth-user. */
function authHeaders(userId: string, extra?: Record<string, string>) {
  return { "content-type": "application/json", "x-auth-user": userId, ...extra };
}

describe.runIf(DB)("/api/scans — IDOR / authorization", () => {
  // NOTE: requireAuth's hard 401/503 fail-closed only fires in production
  // (IS_PRODUCTION is read at module load). That production gate is proven
  // directly in requireAuth.test.ts. Here we prove the dev-convenience
  // fallback still cannot leak a real user's data: an unauthenticated caller
  // is mapped to the isolated demo user, never to a seeded real user.
  it("dev fallback maps an unauthenticated caller to the demo user, never a real user's data", async () => {
    const real = user("real_owner");
    await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: authHeaders(real),
      body: JSON.stringify({ id: "real_only", productName: "secret" }),
    });

    // No auth header at all → demo user, must not contain the real row.
    const anon = (await (
      await fetch(`${baseUrl}/api/scans`)
    ).json()) as { scans: Array<{ id: string }> };
    expect(anon.scans.find((s) => s.id === "real_only")).toBeUndefined();
  });

  it("isolates scans by authenticated user — user B cannot see user A's data", async () => {
    const a = user("owner_a");
    const b = user("owner_b");

    await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: authHeaders(a),
      body: JSON.stringify({ id: "a_scan", productName: "A-only" }),
    });

    // B reads — must see nothing belonging to A.
    const bView = (await (
      await fetch(`${baseUrl}/api/scans`, { headers: authHeaders(b) })
    ).json()) as { scans: Array<{ id: string }> };
    expect(bView.scans).toHaveLength(0);

    // A reads — must see only its own row.
    const aView = (await (
      await fetch(`${baseUrl}/api/scans`, { headers: authHeaders(a) })
    ).json()) as { scans: Array<{ id: string }> };
    expect(aView.scans.map((s) => s.id)).toEqual(["a_scan"]);
  });

  it("ignores a spoofed x-device-id header — identity comes from auth only", async () => {
    const a = user("spoof_a");
    const victim = user("spoof_victim");

    // A writes a scan while LYING with someone else's device id header.
    await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: authHeaders(a, { "x-device-id": victim }),
      body: JSON.stringify({ id: "owned_by_a", productName: "A" }),
    });

    // The victim's authenticated view must NOT contain the spoofed write.
    const victimView = (await (
      await fetch(`${baseUrl}/api/scans`, {
        headers: authHeaders(victim),
      })
    ).json()) as { scans: Array<{ id: string }> };
    expect(victimView.scans).toHaveLength(0);

    // Attacker cannot READ the victim's data by spoofing x-device-id either:
    // identity is the attacker (a), so they only ever see their own row.
    const attackerView = (await (
      await fetch(`${baseUrl}/api/scans`, {
        headers: authHeaders(a, { "x-device-id": victim }),
      })
    ).json()) as { scans: Array<{ id: string; deviceId: string }> };
    expect(attackerView.scans.map((s) => s.id)).toEqual(["owned_by_a"]);
    // The persisted owner is the authenticated user, not the spoofed header.
    expect(attackerView.scans[0]?.deviceId).toBe(a);
  });
});

describe.runIf(DB)("/api/scans — legacy contract preservation", () => {
  it("body.id === '' is accepted verbatim (not regenerated)", async () => {
    const u = user("empty_id");
    const res = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: authHeaders(u),
      body: JSON.stringify({ id: "", productName: "X", fitScore: 10 }),
    });
    const json = (await res.json()) as { scan: { id: string } };
    expect(res.status).toBe(201);
    expect(json.scan.id).toBe("");
  });

  it("body.loggedAt is echoed verbatim, even if non-ISO", async () => {
    const u = user("logged_at_echo");
    const raw = "2026/05/01 12:00 PT"; // not a valid ISO, but legacy echoed it
    const res = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: authHeaders(u),
      body: JSON.stringify({
        id: "scan_logged",
        loggedAt: raw,
        productName: "X",
      }),
    });
    const json = (await res.json()) as { scan: { loggedAt: string } };
    expect(res.status).toBe(201);
    expect(json.scan.loggedAt).toBe(raw);

    // And on the way out via GET, the same raw string still echoes.
    const getRes = await fetch(`${baseUrl}/api/scans`, {
      headers: authHeaders(u),
    });
    const getJson = (await getRes.json()) as {
      scans: Array<{ loggedAt: string }>;
    };
    expect(getJson.scans[0]?.loggedAt).toBe(raw);
  });

  it("?limit=-1 returns all-but-the-last-1 (legacy slice semantics)", async () => {
    const u = user("neg_limit");
    for (let i = 0; i < 3; i += 1) {
      await fetch(`${baseUrl}/api/scans`, {
        method: "POST",
        headers: authHeaders(u),
        body: JSON.stringify({
          id: `scan_${i}`,
          loggedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
          productName: `P${i}`,
        }),
      });
    }
    // Default GET — 3 rows.
    const all = (await (
      await fetch(`${baseUrl}/api/scans`, { headers: authHeaders(u) })
    ).json()) as { scans: Array<{ id: string }> };
    expect(all.scans).toHaveLength(3);

    // limit=-1 → slice(0, -1) → first 2 items, matching legacy
    // (newest-first ordering preserved).
    const neg = (await (
      await fetch(`${baseUrl}/api/scans?limit=-1`, {
        headers: authHeaders(u),
      })
    ).json()) as { scans: Array<{ id: string }> };
    expect(neg.scans.map((s) => s.id)).toEqual(["scan_2", "scan_1"]);
  });

  it("?limit with large histories — negative slice runs over 500-row ceiling, not 200", async () => {
    // Seed 250 rows so a -1 slice should return 249 (legacy semantics
    // over a >200 history); a -50 slice should return 200.
    const u = user("big_neg");
    const SEED = 250;
    for (let i = 0; i < SEED; i += 1) {
      await fetch(`${baseUrl}/api/scans`, {
        method: "POST",
        headers: authHeaders(u),
        body: JSON.stringify({
          id: `s_${i}`,
          // Strictly ascending so DESC ordering is well-defined.
          loggedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
          productName: `P${i}`,
        }),
      });
    }
    const negOne = (await (
      await fetch(`${baseUrl}/api/scans?limit=-1`, {
        headers: authHeaders(u),
      })
    ).json()) as { scans: unknown[] };
    expect(negOne.scans.length).toBe(SEED - 1);

    const negFifty = (await (
      await fetch(`${baseUrl}/api/scans?limit=-50`, {
        headers: authHeaders(u),
      })
    ).json()) as { scans: unknown[] };
    expect(negFifty.scans.length).toBe(SEED - 50);
  });

  it("ordering contract: rows come back scannedAt DESC even when loggedAt is backfilled out of order", async () => {
    const u = user("ordering");
    // Insert in mixed wall-clock order; loggedAt is what should sort.
    const inserts = [
      { id: "old", loggedAt: "2026-05-01T08:00:00Z" },
      { id: "new", loggedAt: "2026-05-01T12:00:00Z" },
      { id: "mid", loggedAt: "2026-05-01T10:00:00Z" },
    ];
    for (const i of inserts) {
      await fetch(`${baseUrl}/api/scans`, {
        method: "POST",
        headers: authHeaders(u),
        body: JSON.stringify({ ...i, productName: i.id }),
      });
    }
    const rows = (await (
      await fetch(`${baseUrl}/api/scans`, { headers: authHeaders(u) })
    ).json()) as { scans: Array<{ id: string }> };
    expect(rows.scans.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("replay POST with same id returns the original row, not the mutated attempt", async () => {
    const u = user("replay");
    const r1 = (await (
      await fetch(`${baseUrl}/api/scans`, {
        method: "POST",
        headers: authHeaders(u),
        body: JSON.stringify({
          id: "scan_dup",
          productName: "First",
          fitScore: 90,
          verdict: "strong",
        }),
      })
    ).json()) as { scan: { fitScore: number; verdict: string } };
    const r2 = (await (
      await fetch(`${baseUrl}/api/scans`, {
        method: "POST",
        headers: authHeaders(u),
        body: JSON.stringify({
          id: "scan_dup",
          productName: "Different",
          fitScore: 1,
          verdict: "avoid",
        }),
      })
    ).json()) as { scan: { fitScore: number; verdict: string } };
    expect(r2.fitScore ?? r2.scan.fitScore).toBe(90);
    expect(r2.scan.verdict).toBe("strong");
    expect(r1.scan.fitScore).toBe(90);
  });
});
