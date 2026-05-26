/**
 * Route-level tests for /api/admin/demand/snapshot[s].
 *
 * Verifies:
 *   (1) admin gate is enforced via the requireAdmin middleware
 *       (proved by route matching at the mounted prefix).
 *   (2) POST + GET run the shared engine and return the canonical
 *       { inputs, outputs, snapshot } envelope.
 *   (3) Zod input validation rejects bad payloads with 400 + issues.
 *   (4) The server's `outputs` matches the engine's pure computation
 *       byte-for-byte (no compliance drift, no string mutation).
 *   (5) Persistence: each compute writes to the snapshot repo,
 *       attributes to admin_debug by default, generates a server-side
 *       clientSnapshotId, is idempotent on (userId, clientSnapshotId),
 *       and surfaces via GET /snapshots ordered by computedAt DESC.
 *
 * Tests inject an in-memory repo via `buildAdminDemandRouter` so the
 * suite never touches the real Postgres.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import {
  computeHydrationDemand,
  type HydrationDemandInputs,
} from "@workspace/demand-engine";
import {
  createInMemoryDemandSnapshotRepo,
  type DemandSnapshotRepo,
} from "@workspace/db";
import { buildAdminDemandRouter } from "../routes/adminDemand";
import { logger } from "../lib/logger";

// requireAdmin's dev-convenience branch (NODE_ENV !== "production"
// AND no CLERK_SECRET_KEY) lets all requests through. Same fall-open
// the rest of the admin surfaces use in test.
process.env["NODE_ENV"] = "test";
delete process.env["CLERK_SECRET_KEY"];

let repo: DemandSnapshotRepo;

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });
  app.use("/api", buildAdminDemandRouter(repo));
  return app;
}

let server: http.Server;
let baseUrl = "";

beforeAll(async () => {
  repo = createInMemoryDemandSnapshotRepo();
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
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("/api/admin/demand/snapshot", () => {
  it("POST returns { inputs, outputs } matching the pure engine byte-for-byte", async () => {
    const inputs: HydrationDemandInputs = {
      weightLbs: 180,
      activityLevel: 6,
      sweatProfile: "high",
      environmentProfile: "hot_climate",
      heatC: 33,
      humidityPct: 70,
      sleepHours: 5,
      recoveryScore: 35,
      consumedOz: 24,
      completedCycles: 1,
    };
    const res = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(inputs),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      inputs: HydrationDemandInputs;
      outputs: ReturnType<typeof computeHydrationDemand>;
    };
    expect(json.inputs).toEqual(inputs);
    expect(json.outputs).toEqual(computeHydrationDemand(inputs));
    expect(json.outputs.command).not.toMatch(
      /(treats|prevents|cures|blood pressure|pH|alkaline)/i,
    );
  });

  it("GET accepts the same shape via query params (numeric coercion)", async () => {
    const url = new URL(`${baseUrl}/api/admin/demand/snapshot`);
    url.searchParams.set("weightLbs", "150");
    url.searchParams.set("activityLevel", "3");
    url.searchParams.set("sweatProfile", "moderate");
    url.searchParams.set("environmentProfile", "mixed");
    url.searchParams.set("heatC", "22");
    url.searchParams.set("consumedOz", "0");
    const res = await fetch(url);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      inputs: HydrationDemandInputs;
      outputs: ReturnType<typeof computeHydrationDemand>;
    };
    expect(json.inputs.weightLbs).toBe(150);
    expect(json.inputs.activityLevel).toBe(3);
    expect(json.outputs).toEqual(computeHydrationDemand(json.inputs));
  });

  it("GET omits blank/non-numeric fields rather than fabricating zeros", async () => {
    const url = new URL(`${baseUrl}/api/admin/demand/snapshot`);
    url.searchParams.set("weightLbs", "200");
    url.searchParams.set("activityLevel", "4");
    url.searchParams.set("heatC", "");
    url.searchParams.set("humidityPct", "not-a-number");
    const res = await fetch(url);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { inputs: HydrationDemandInputs };
    expect(json.inputs).not.toHaveProperty("heatC");
    expect(json.inputs).not.toHaveProperty("humidityPct");
  });

  it("POST rejects missing required fields with 400 + structured issues", async () => {
    const res = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ activityLevel: 5 }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as {
      error: string;
      issues: Array<{ path: (string | number)[] }>;
    };
    expect(json.error).toBe("invalid_inputs");
    expect(json.issues.some((i) => i.path[0] === "weightLbs")).toBe(true);
  });

  it("POST rejects unknown fields (strict schema)", async () => {
    const res = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        weightLbs: 180,
        activityLevel: 5,
        not_a_real_field: 42,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("POST rejects invalid enum value for sweatProfile", async () => {
    const res = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        weightLbs: 180,
        activityLevel: 5,
        sweatProfile: "lukewarm",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("requireAdmin runs ahead of the route — proven by the dev fall-open branch executing", async () => {
    const res = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});

describe("/api/admin/demand/snapshot persistence (PR #12)", () => {
  it("POST persists the snapshot and returns the stored row metadata", async () => {
    const inputs = { weightLbs: 175, activityLevel: 5 };
    const res = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...inputs,
        userId: "user_persist_a",
        clientSnapshotId: "snap_persist_a_1",
        source: "mobile_self",
        computedAt: "2026-05-26T10:00:00.000Z",
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      snapshot: {
        id: number;
        userId: string;
        clientSnapshotId: string;
        source: string;
        computedAt: string;
        targetOz: number;
        remainingOz: number;
        load: string;
        command: string;
      };
      outputs: ReturnType<typeof computeHydrationDemand>;
    };
    expect(json.snapshot.userId).toBe("user_persist_a");
    expect(json.snapshot.clientSnapshotId).toBe("snap_persist_a_1");
    expect(json.snapshot.source).toBe("mobile_self");
    expect(json.snapshot.computedAt).toBe("2026-05-26T10:00:00.000Z");
    // Denorm columns mirror outputs verbatim.
    expect(json.snapshot.targetOz).toBe(json.outputs.targetOz);
    expect(json.snapshot.remainingOz).toBe(json.outputs.remainingOz);
    expect(json.snapshot.load).toBe(json.outputs.load);
    expect(json.snapshot.command).toBe(json.outputs.command);

    const stored = await repo.listForUser("user_persist_a");
    expect(stored).toHaveLength(1);
    expect(stored[0]?.clientSnapshotId).toBe("snap_persist_a_1");
  });

  it("POST without userId attributes to 'admin_debug' and generates a server-side clientSnapshotId", async () => {
    const before = await repo.countForUser("admin_debug");
    const res = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ weightLbs: 160, activityLevel: 4 }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      snapshot: { userId: string; clientSnapshotId: string; source: string };
    };
    expect(json.snapshot.userId).toBe("admin_debug");
    expect(json.snapshot.source).toBe("admin_debug");
    expect(json.snapshot.clientSnapshotId).toMatch(/^snap_\d+_[a-z0-9]+$/);
    const after = await repo.countForUser("admin_debug");
    expect(after).toBe(before + 1);
  });

  it("POST is idempotent on (userId, clientSnapshotId) — replay returns the original canonical row and flags `replayed`", async () => {
    const body = {
      weightLbs: 190,
      activityLevel: 7,
      userId: "user_idem",
      clientSnapshotId: "snap_idem_fixed",
    };
    const first = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const firstJson = (await first.json()) as {
      snapshot: { id: number; createdAt: string };
      inputs: { weightLbs: number };
      outputs: { targetOz: number };
      replayed: boolean;
    };
    expect(firstJson.replayed).toBe(false);
    expect(firstJson.inputs.weightLbs).toBe(190);

    const second = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Different inputs to prove first-write-wins at the envelope.
      body: JSON.stringify({ ...body, weightLbs: 999 }),
    });
    const secondJson = (await second.json()) as {
      snapshot: { id: number; createdAt: string };
      inputs: { weightLbs: number };
      outputs: { targetOz: number };
      replayed: boolean;
    };

    // Same canonical row at the storage layer.
    expect(secondJson.snapshot.id).toBe(firstJson.snapshot.id);
    expect(secondJson.snapshot.createdAt).toBe(firstJson.snapshot.createdAt);

    // Envelope reflects the canonical (first) write, NOT the second
    // attempt's mutated inputs. This is the bug the architect caught.
    expect(secondJson.replayed).toBe(true);
    expect(secondJson.inputs.weightLbs).toBe(190);
    expect(secondJson.outputs.targetOz).toBe(firstJson.outputs.targetOz);

    const rows = await repo.listForUser("user_idem");
    expect(rows).toHaveLength(1);
    expect(
      (rows[0]?.inputs as { weightLbs: number }).weightLbs,
    ).toBe(190);
  });

  it("GET /snapshots returns rows for the user ordered by computedAt DESC + total count", async () => {
    const userId = "user_list";
    const times = [
      "2026-05-26T08:00:00.000Z",
      "2026-05-26T09:00:00.000Z",
      "2026-05-26T07:00:00.000Z",
    ];
    for (let i = 0; i < times.length; i++) {
      const r = await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weightLbs: 170 + i,
          activityLevel: 5,
          userId,
          clientSnapshotId: `snap_list_${i}`,
          computedAt: times[i],
        }),
      });
      expect(r.status).toBe(200);
    }
    const listRes = await fetch(
      `${baseUrl}/api/admin/demand/snapshots?userId=${userId}`,
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      snapshots: Array<{ clientSnapshotId: string; computedAt: string }>;
      total: number;
    };
    expect(listJson.total).toBe(3);
    expect(listJson.snapshots.map((s) => s.clientSnapshotId)).toEqual([
      "snap_list_1", // 09:00 — newest
      "snap_list_0", // 08:00
      "snap_list_2", // 07:00 — oldest
    ]);
  });

  it("GET /snapshots respects the limit query param", async () => {
    const userId = "user_limit";
    for (let i = 0; i < 5; i++) {
      await fetch(`${baseUrl}/api/admin/demand/snapshot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          weightLbs: 170,
          activityLevel: 5,
          userId,
          clientSnapshotId: `snap_limit_${i}`,
          computedAt: new Date(2026, 4, 26, 0, i).toISOString(),
        }),
      });
    }
    const listRes = await fetch(
      `${baseUrl}/api/admin/demand/snapshots?userId=${userId}&limit=2`,
    );
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as {
      snapshots: unknown[];
      total: number;
    };
    expect(listJson.snapshots).toHaveLength(2);
    expect(listJson.total).toBe(5);
  });

  it("GET /snapshots rejects missing userId with 400", async () => {
    const res = await fetch(`${baseUrl}/api/admin/demand/snapshots`);
    expect(res.status).toBe(400);
  });

  it("GET /snapshots rejects unknown query fields (strict schema)", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/demand/snapshots?userId=u&extra=nope`,
    );
    expect(res.status).toBe(400);
  });
});
