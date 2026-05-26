/**
 * Route-level legacy-compatibility tests for /api/scans.
 *
 * These tests assert that swapping the in-memory store onto the
 * Drizzle-backed HydroScanRepo did NOT introduce externally
 * observable drift on the edge inputs the architect flagged:
 *   - `body.id === ""` is accepted verbatim, not regenerated.
 *   - `body.loggedAt` is echoed in the response exactly as sent
 *     (no Date normalization round-trip).
 *   - `?limit` accepts negative values and applies tail-trimming
 *     slice semantics (legacy used Array.slice(0, N)).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import { eq } from "drizzle-orm";
import { db, aforceHydroScans } from "@workspace/db";
import scansRouter from "../routes/scans";
import { logger } from "../lib/logger";

process.env["NODE_ENV"] = "test";

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

const device = (suffix: string) => `${TEST_USER_PREFIX}${suffix}_${Date.now()}`;

describe("/api/scans — legacy contract preservation", () => {
  it("body.id === '' is accepted verbatim (not regenerated)", async () => {
    const d = device("empty_id");
    const res = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-id": d },
      body: JSON.stringify({ id: "", productName: "X", fitScore: 10 }),
    });
    const json = (await res.json()) as { scan: { id: string } };
    expect(res.status).toBe(201);
    expect(json.scan.id).toBe("");
  });

  it("body.loggedAt is echoed verbatim, even if non-ISO", async () => {
    const d = device("logged_at_echo");
    const raw = "2026/05/01 12:00 PT"; // not a valid ISO, but legacy echoed it
    const res = await fetch(`${baseUrl}/api/scans`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-device-id": d },
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
      headers: { "x-device-id": d },
    });
    const getJson = (await getRes.json()) as {
      scans: Array<{ loggedAt: string }>;
    };
    expect(getJson.scans[0]?.loggedAt).toBe(raw);
  });

  it("?limit=-1 returns all-but-the-last-1 (legacy slice semantics)", async () => {
    const d = device("neg_limit");
    for (let i = 0; i < 3; i += 1) {
      await fetch(`${baseUrl}/api/scans`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-id": d },
        body: JSON.stringify({
          id: `scan_${i}`,
          loggedAt: new Date(2026, 0, 1, 0, 0, i).toISOString(),
          productName: `P${i}`,
        }),
      });
    }
    // Default GET — 3 rows.
    const all = (await (
      await fetch(`${baseUrl}/api/scans`, { headers: { "x-device-id": d } })
    ).json()) as { scans: Array<{ id: string }> };
    expect(all.scans).toHaveLength(3);

    // limit=-1 → slice(0, -1) → first 2 items, matching legacy
    // (newest-first ordering preserved).
    const neg = (await (
      await fetch(`${baseUrl}/api/scans?limit=-1`, {
        headers: { "x-device-id": d },
      })
    ).json()) as { scans: Array<{ id: string }> };
    expect(neg.scans.map((s) => s.id)).toEqual(["scan_2", "scan_1"]);
  });

  it("?limit with large histories — negative slice runs over 500-row ceiling, not 200", async () => {
    // Seed 250 rows so a -1 slice should return 249 (legacy semantics
    // over a >200 history); a -50 slice should return 200.
    const d = device("big_neg");
    const SEED = 250;
    for (let i = 0; i < SEED; i += 1) {
      await fetch(`${baseUrl}/api/scans`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-id": d },
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
        headers: { "x-device-id": d },
      })
    ).json()) as { scans: unknown[] };
    expect(negOne.scans.length).toBe(SEED - 1);

    const negFifty = (await (
      await fetch(`${baseUrl}/api/scans?limit=-50`, {
        headers: { "x-device-id": d },
      })
    ).json()) as { scans: unknown[] };
    expect(negFifty.scans.length).toBe(SEED - 50);
  });

  it("ordering contract: rows come back scannedAt DESC even when loggedAt is backfilled out of order", async () => {
    const d = device("ordering");
    // Insert in mixed wall-clock order; loggedAt is what should sort.
    const inserts = [
      { id: "old", loggedAt: "2026-05-01T08:00:00Z" },
      { id: "new", loggedAt: "2026-05-01T12:00:00Z" },
      { id: "mid", loggedAt: "2026-05-01T10:00:00Z" },
    ];
    for (const i of inserts) {
      await fetch(`${baseUrl}/api/scans`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-id": d },
        body: JSON.stringify({ ...i, productName: i.id }),
      });
    }
    const rows = (await (
      await fetch(`${baseUrl}/api/scans`, { headers: { "x-device-id": d } })
    ).json()) as { scans: Array<{ id: string }> };
    expect(rows.scans.map((r) => r.id)).toEqual(["new", "mid", "old"]);
  });

  it("missing x-device-id returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/scans`);
    expect(res.status).toBe(400);
  });

  it("replay POST with same id returns the original row, not the mutated attempt", async () => {
    const d = device("replay");
    const r1 = (await (
      await fetch(`${baseUrl}/api/scans`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-id": d },
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
        headers: { "content-type": "application/json", "x-device-id": d },
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
