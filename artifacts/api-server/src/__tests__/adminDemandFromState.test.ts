/**
 * Route-level tests for POST /api/admin/demand/snapshot/from-state.
 *
 * Tests inject both the snapshot repo (in-memory) and the state
 * reader (in-memory map keyed by userId) via
 * `buildAdminDemandFromStateRouter`. Real Postgres is untouched.
 *
 * Coverage:
 *   - end-to-end happy path: state row -> adapter -> engine -> repo
 *     -> envelope matches the engine's pure computation byte-for-byte.
 *   - freshest-wins sleep across providers surfaces in `trace`.
 *   - missing user returns 404.
 *   - default `source` is 'from_state' (distinct from 'admin_debug').
 *   - first-write-wins replay: second call returns canonical inputs
 *     from the stored row + `replayed: true`.
 *   - overrides win over derived values.
 *   - strict schema rejects unknown fields with 400.
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
import {
  buildAdminDemandFromStateRouter,
  type DemandStateReader,
} from "../routes/adminDemandFromState";
import type { DemandSourceState } from "../lib/hydrationDemandStateAdapter";
import { logger } from "../lib/logger";

process.env["NODE_ENV"] = "test";
delete process.env["CLERK_SECRET_KEY"];

let repo: DemandSnapshotRepo;
let states: Map<string, DemandSourceState>;
let stateReader: DemandStateReader;

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });
  app.use("/api", buildAdminDemandFromStateRouter(repo, stateReader));
  return app;
}

let server: http.Server;
let baseUrl = "";

beforeAll(async () => {
  repo = createInMemoryDemandSnapshotRepo();
  states = new Map();
  stateReader = async (userId) => states.get(userId) ?? null;

  states.set("user_full", {
    bodyWeightLbs: 195,
    activityLevel: 6,
    weatherTempC: 31,
    weatherHumidity: 72,
    appleHealth: { sleepHoursLastNight: 6.5, fetchedAt: 500 },
    biometrics: {
      whoop: {
        providerId: "whoop",
        sleepHoursLastNight: 8.0,
        fetchedAt: 1000,
      },
      samsung_health: {
        providerId: "samsung_health",
        sleepHoursLastNight: 7.0,
        fetchedAt: 200,
      },
    },
  });
  states.set("user_minimal", {
    bodyWeightLbs: 150,
    activityLevel: 2,
    weatherTempC: null,
    weatherHumidity: null,
    appleHealth: null,
    biometrics: null,
  });

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

describe("POST /api/admin/demand/snapshot/from-state", () => {
  it("happy path: adapts state, computes via shared engine, persists, returns canonical envelope", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/demand/snapshot/from-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "user_full",
          clientSnapshotId: "snap_full_1",
        }),
      },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      inputs: HydrationDemandInputs;
      outputs: ReturnType<typeof computeHydrationDemand>;
      snapshot: {
        id: number;
        userId: string;
        source: string;
        targetOz: number;
        load: string;
      };
      replayed: boolean;
      trace: {
        sleepSource: { source: string; hours: number; fetchedAt: number } | null;
        weightFromProfile: boolean;
      };
    };
    // Inputs reflect adapter output: weight from state, weather from
    // state, freshest sleep = WHOOP at fetchedAt=1000 (8h).
    expect(json.inputs.weightLbs).toBe(195);
    expect(json.inputs.activityLevel).toBe(6);
    expect(json.inputs.heatC).toBe(31);
    expect(json.inputs.humidityPct).toBe(72);
    expect(json.inputs.sleepHours).toBe(8.0);
    // No compliance language slips out (engine module is scrubbed).
    expect(json.outputs.command).not.toMatch(
      /(treats|prevents|cures|blood pressure|pH|alkaline)/i,
    );
    // Outputs are byte-identical to the pure engine on the same inputs.
    expect(json.outputs).toEqual(computeHydrationDemand(json.inputs));
    // Snapshot was persisted with the from_state source label.
    expect(json.snapshot.userId).toBe("user_full");
    expect(json.snapshot.source).toBe("from_state");
    expect(json.snapshot.targetOz).toBe(json.outputs.targetOz);
    expect(json.snapshot.load).toBe(json.outputs.load);
    expect(json.replayed).toBe(false);
    // Trace exposes the freshest-sleep provider for debugging.
    expect(json.trace.sleepSource?.source).toBe("whoop");
    expect(json.trace.weightFromProfile).toBe(true);
  });

  it("returns 404 when no state row exists for the user", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/demand/snapshot/from-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "user_missing" }),
      },
    );
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: string };
    expect(json.error).toBe("user_state_not_found");
  });

  it("omits sleep/weather entirely when the state has none — no fabrication", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/demand/snapshot/from-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "user_minimal",
          clientSnapshotId: "snap_minimal_1",
        }),
      },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      inputs: HydrationDemandInputs;
      trace: { sleepSource: unknown };
    };
    expect(json.inputs).not.toHaveProperty("sleepHours");
    expect(json.inputs).not.toHaveProperty("heatC");
    expect(json.inputs).not.toHaveProperty("humidityPct");
    expect(json.trace.sleepSource).toBeNull();
  });

  it("replay returns the canonical (first) inputs and flags `replayed: true`", async () => {
    const body = {
      userId: "user_full",
      clientSnapshotId: "snap_full_replay",
    };
    const first = await fetch(
      `${baseUrl}/api/admin/demand/snapshot/from-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const firstJson = (await first.json()) as {
      snapshot: { id: number };
      inputs: { sleepHours: number };
      replayed: boolean;
    };
    expect(firstJson.replayed).toBe(false);

    // Mutate the state so the adapter would derive different inputs
    // on replay — proves we return the canonical (first) values.
    const state = states.get("user_full");
    if (!state) throw new Error("seed missing");
    state.bodyWeightLbs = 250;

    const second = await fetch(
      `${baseUrl}/api/admin/demand/snapshot/from-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const secondJson = (await second.json()) as {
      snapshot: { id: number };
      inputs: { weightLbs: number; sleepHours: number };
      replayed: boolean;
    };
    expect(secondJson.snapshot.id).toBe(firstJson.snapshot.id);
    expect(secondJson.replayed).toBe(true);
    expect(secondJson.inputs.weightLbs).toBe(195); // not 250
    expect(secondJson.inputs.sleepHours).toBe(firstJson.inputs.sleepHours);

    // Restore for any later test that relies on the original seed.
    state.bodyWeightLbs = 195;
  });

  it("overrides win over derived values without fabricating", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/demand/snapshot/from-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "user_full",
          clientSnapshotId: "snap_full_ovr",
          overrides: {
            sweatProfile: "very_high",
            environmentProfile: "hot_climate",
            recoveryScore: 28,
            consumedOz: 16,
            completedCycles: 1,
          },
        }),
      },
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { inputs: HydrationDemandInputs };
    expect(json.inputs.sweatProfile).toBe("very_high");
    expect(json.inputs.environmentProfile).toBe("hot_climate");
    expect(json.inputs.recoveryScore).toBe(28);
    expect(json.inputs.consumedOz).toBe(16);
    expect(json.inputs.completedCycles).toBe(1);
  });

  it("rejects missing userId with 400", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/demand/snapshot/from-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    expect(res.status).toBe(400);
  });

  it("rejects unknown top-level fields (strict schema)", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/demand/snapshot/from-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "user_full", not_a_real_field: 42 }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("rejects unknown override fields (strict overrides schema)", async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/demand/snapshot/from-state`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "user_full",
          overrides: { sweatProfile: "high", bogus: true },
        }),
      },
    );
    expect(res.status).toBe(400);
  });
});
