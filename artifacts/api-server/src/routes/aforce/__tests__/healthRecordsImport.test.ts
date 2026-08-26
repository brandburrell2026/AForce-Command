/**
 * G2 ingest locks — the one door for canonical health records.
 *
 * What must hold at this boundary, per the founder-approved governance:
 *   - idempotent by canonical UID (server-recomputed, never wire-trusted)
 *   - identity is the AUTHENTICATED user, never the payload's claim
 *   - Samsung-via-Health-Connect attribution survives ingest verbatim
 *     (origin = samsung_health, provider = google_health — never "Google's
 *     data", never a direct Samsung claim)
 *   - third-party composite scores outside the closed ProviderScoreKind list
 *     cannot even be STORED (the HydroState firewall starts at the door)
 *   - hrv without a declared method is rejected (RMSSD/SDNN separation)
 *   - raw health values never reach logs — paths and counts only
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import express from "express";
import type { Server } from "node:http";
import {
  buildHealthRecordsRouter,
  type HealthRecordsRouterDeps,
} from "../healthRecords";
import { HEALTH_RECORD_SCHEMA_VERSION } from "@workspace/health-core";
import type { CanonicalHealthRecord } from "@workspace/health-core";

const upsertRecords = vi.fn(async (records: CanonicalHealthRecord[]) => ({
  upserted: records.length,
}));
const log = { info: vi.fn(), error: vi.fn() };

// House transport pattern (see intake.test.ts): one express app on an
// ephemeral port, exercised with native fetch.
let server: Server;
let base = "";

beforeAll(async () => {
  const a = express();
  // Mirror production (app.ts): 64kb body limit - oversized batches die here
  // as 413 before zod ever sees them.
  a.use(express.json({ limit: "64kb" }));
  // Test auth seam: mirrors requireAuth's dev fallback contract.
  a.use((req, _res, next) => {
    (req as unknown as { userId: string }).userId = "user-auth";
    next();
  });
  a.use(
    buildHealthRecordsRouter({ repo: { upsertRecords } as never, log } as HealthRecordsRouterDeps),
  );
  await new Promise<void>((resolve) => {
    server = a.listen(0, () => {
      const addr = server.address();
      base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
      resolve();
    });
  });
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function post(body: unknown): Promise<{ status: number; json: unknown }> {
  const res = await fetch(`${base}/health-records/import`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

const samsungViaHC = {
  schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
  provider: "google_health",
  originalSource: "com.sec.android.app.shealth",
  metricType: "resting_heart_rate",
  value: 58,
  unit: "bpm",
  observedAt: "2026-08-19T06:00:00.000Z",
  syncedAt: "2026-08-19T07:00:00.000Z",
  provenanceChain: [
    { provider: "samsung_health", nativeOrigin: "com.sec.android.app.shealth", transport: "measured" },
    { provider: "google_health", transport: "aggregator_export" },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("identity and idempotency at the door", () => {
  it("stamps the AUTHENTICATED user and recomputes the dedup key server-side", async () => {
    const res = await post({
        records: [
          {
            ...samsungViaHC,
            // Hostile extras: schema strips unknown keys, so a payload userId
            // or deduplicationKey never reaches the repo.
            userId: "user-victim",
            deduplicationKey: "forged|key",
          },
        ],
      });
    expect(res.status).toBe(200);
    const stored = upsertRecords.mock.calls[0]![0]![0]!;
    expect(stored.userId).toBe("user-auth");
    expect(stored.deduplicationKey).toContain("user-auth|");
    expect(stored.deduplicationKey).not.toContain("victim");
    expect(stored.deduplicationKey).not.toBe("forged|key");
  });

  it("the same record sent twice produces the same key — replay is repo-idempotent", async () => {
    await post({ records: [samsungViaHC] });
    await post({ records: [samsungViaHC] });
    const k1 = upsertRecords.mock.calls[0]![0]![0]!.deduplicationKey;
    const k2 = upsertRecords.mock.calls[1]![0]![0]!.deduplicationKey;
    expect(k1).toBe(k2);
  });
});

describe("Samsung via Health Connect attribution", () => {
  it("origin resolves to samsung_health while provider stays google_health — verbatim chain", async () => {
    await post({ records: [samsungViaHC] });
    const stored = upsertRecords.mock.calls[0]![0]![0]!;
    expect(stored.provider).toBe("google_health");
    expect(stored.provenanceChain).toEqual(samsungViaHC.provenanceChain);
    // The dedup key embeds the resolved ORIGIN — samsung, not google, and
    // with no direct-Samsung claim anywhere (transport stays aggregator).
    expect(stored.deduplicationKey).toContain("|samsung_health");
    expect(stored.originalSource).toBe("com.sec.android.app.shealth");
  });
});

describe("third-party score firewall", () => {
  it("rejects a composite score outside the closed list (Samsung Energy Score shape)", async () => {
    const res = await post({
        records: [
          {
            ...samsungViaHC,
            metricType: "provider_score",
            scoreKind: "samsung_energy_score",
            value: 87,
          },
        ],
      });
    expect(res.status).toBe(400);
    expect(upsertRecords).not.toHaveBeenCalled();
  });

  it("rejects provider_score with no scoreKind at all", async () => {
    const res = await post({
        records: [{ ...samsungViaHC, metricType: "provider_score", value: 87 }],
      });
    expect(res.status).toBe(400);
  });

  it("accepts a known attributed kind (whoop_recovery) — display-only records may store", async () => {
    const res = await post({
        records: [
          {
            ...samsungViaHC,
            provider: "whoop",
            metricType: "provider_score",
            scoreKind: "whoop_recovery",
            value: 94,
            provenanceChain: [{ provider: "whoop", transport: "cloud_api" }],
          },
        ],
      });
    expect(res.status).toBe(200);
  });
});

describe("contract validation", () => {
  it("hrv without a method is rejected — RMSSD/SDNN separation is a contract", async () => {
    const res = await post({ records: [{ ...samsungViaHC, metricType: "hrv", value: 62.8 }] });
    expect(res.status).toBe(400);
  });

  it("hrv with rmssd is accepted", async () => {
    const res = await post({
        records: [{ ...samsungViaHC, metricType: "hrv", hrvMethod: "rmssd", value: 62.8 }],
      });
    expect(res.status).toBe(200);
  });

  it("non-finite values are not measurements", async () => {
    const res = await post({ records: [{ ...samsungViaHC, value: Number.NaN }] });
    expect(res.status).toBe(400);
  });

  it("wrong schemaVersion is rejected rather than reinterpreted", async () => {
    const res = await post({ records: [{ ...samsungViaHC, schemaVersion: 999 }] });
    expect(res.status).toBe(400);
  });

  it("empty and oversized batches are rejected, and neither reaches the repo", async () => {
    expect((await post({ records: [] })).status).toBe(400);
    // 501 records exceed production 64kb JSON body limit long before zod max(500)
    // fires - either guard rejecting (413 body-limit or 400 schema) is the
    // contract; what matters is nothing oversized is ever stored.
    const many = Array.from({ length: 501 }, () => samsungViaHC);
    const res = await post({ records: many });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(upsertRecords).not.toHaveBeenCalled();
  });
});

describe("privacy — raw health data never reaches logs", () => {
  it("success logs carry counts and metric tallies only", async () => {
    await post({ records: [samsungViaHC] });
    const logged = JSON.stringify(log.info.mock.calls);
    expect(logged).not.toContain("58"); // the RHR value
    expect(logged).not.toContain("com.sec.android.app.shealth");
    expect(logged).toContain("resting_heart_rate"); // tally key is fine
  });

  it("rejection logs carry field paths, never received values", async () => {
    await post({ records: [{ ...samsungViaHC, metricType: "hrv", value: 42.42 }] });
    const logged = JSON.stringify(log.info.mock.calls);
    expect(logged).not.toContain("42.42");
    expect(logged).toContain("hrvMethod");
  });
});
