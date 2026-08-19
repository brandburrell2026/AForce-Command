/**
 * POST /aforce/health-records/import — the ONE ingest door for canonical
 * health records (G2 of the founder-approved Health Connect sequence).
 *
 * The client's Health Connect sync engine (LANE H2) produces
 * CanonicalHealthRecord batches; this route validates them against the
 * health-core contracts and hands them to the EXISTING healthRecordsRepo —
 * no second normalization system, no second dedupe, no second confidence
 * engine. The repo's upsert is idempotent on `deduplicationKey` with
 * newer-`syncedAt`-wins, so replays and overlapping sync windows are no-ops.
 *
 * Trust boundary (each enforced below, each locked by test):
 *   - `userId` is NEVER read from the payload — every record is re-stamped
 *     with the authenticated user before keying.
 *   - `deduplicationKey` is NEVER trusted from the wire — recomputed
 *     server-side via health-core's buildDeduplicationKey under the
 *     authenticated user, so a hostile client cannot collide another user's
 *     rows or smuggle duplicates under fresh keys.
 *   - Third-party score firewall: `provider_score` records must carry a
 *     scoreKind from the CLOSED ProviderScoreKind list. Unknown composites
 *     (Samsung Energy Score, Fitbit readiness, …) are rejected at the door —
 *     they cannot even be STORED, let alone touch HydroState.
 *   - `hrv` records must declare their method ('rmssd' | 'sdnn') — the
 *     RMSSD/SDNN separation is a contract, not a convention.
 *   - Provenance arrives as a non-empty hop chain and is stored verbatim.
 *     Samsung-via-Health-Connect arrives as
 *     [ {samsung_health, measured}, {google_health, aggregator_export} ] —
 *     `originOf` attributes the row to samsung_health, never to Google and
 *     never as a direct Samsung claim.
 *
 * PRIVACY: request bodies carry raw health data. Nothing from `value`,
 * `device`, or any record field is ever logged — logs carry counts and
 * metric-type tallies only. The catch path logs the zod issue PATHS (field
 * names), never received values.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { createHealthRecordsRepo, type HealthRecordsRepo } from "@workspace/db";
import {
  buildDeduplicationKey,
  originOf,
  HEALTH_RECORD_SCHEMA_VERSION,
  type CanonicalHealthRecord,
} from "@workspace/health-core";
import type { Logger } from "pino";
import { logger as defaultLogger } from "../../lib/logger";
import { resolveUserId } from "./shared";

const isoUtc = z.string().datetime({ offset: true });

const provenanceHopSchema = z.object({
  provider: z.string().min(1).max(64),
  nativeOrigin: z.string().min(1).max(256).optional(),
  transport: z.enum(["measured", "aggregator_export", "cloud_api", "device_push"]),
});

const METRIC_TYPES = [
  "sleep_session",
  "resting_heart_rate",
  "hrv",
  "heart_rate_summary",
  "workout",
  "steps",
  "active_energy",
  "respiratory_rate",
  "provider_score",
] as const;

/** CLOSED list — the third-party score firewall. Additions are governance. */
const PROVIDER_SCORE_KINDS = [
  "whoop_recovery",
  "whoop_strain",
  "oura_readiness",
  "garmin_stress",
  "strava_training_load",
] as const;

const PROVIDERS = [
  "apple_health",
  "oura",
  "samsung_health",
  "google_health",
  "garmin",
  "whoop",
  "strava",
] as const;

/** Finite-number guard: NaN/Infinity are not measurements. */
const finiteNumber = z.number().refine(Number.isFinite, "must be finite");

const wireRecordSchema = z
  .object({
    schemaVersion: z.literal(HEALTH_RECORD_SCHEMA_VERSION),
    provider: z.enum(PROVIDERS),
    originalSource: z.string().min(1).max(256).optional(),
    device: z
      .object({
        manufacturer: z.string().max(128).optional(),
        model: z.string().max(128).optional(),
        hardwareVersion: z.string().max(64).optional(),
        softwareVersion: z.string().max(64).optional(),
      })
      .optional(),
    externalId: z.string().min(1).max(256).optional(),
    metricType: z.enum(METRIC_TYPES),
    value: z.union([finiteNumber, z.string().max(1024), z.record(z.unknown())]),
    unit: z.string().max(32).optional(),
    startTime: isoUtc.optional(),
    endTime: isoUtc.optional(),
    observedAt: isoUtc,
    syncedAt: isoUtc,
    fetchedAt: isoUtc.optional(),
    hrvMethod: z.enum(["rmssd", "sdnn"]).optional(),
    scoreKind: z.enum(PROVIDER_SCORE_KINDS).optional(),
    confidence: z.enum(["high", "medium", "low", "unknown"]).optional(),
    provenanceChain: z.array(provenanceHopSchema).min(1).max(8),
  })
  .superRefine((r, ctx) => {
    if (r.metricType === "hrv" && !r.hrvMethod) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hrvMethod"],
        message: "hrv records must declare rmssd or sdnn",
      });
    }
    if (r.metricType === "provider_score" && !r.scoreKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scoreKind"],
        message: "provider_score records must name a known scoreKind",
      });
    }
    if (r.metricType !== "provider_score" && r.scoreKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scoreKind"],
        message: "scoreKind is only valid on provider_score records",
      });
    }
  });

const importSchema = z.object({
  records: z.array(wireRecordSchema).min(1).max(500),
});

export interface HealthRecordsRouterDeps {
  repo: HealthRecordsRepo;
  log: Pick<Logger, "info" | "error">;
}

export function buildHealthRecordsRouter(deps: HealthRecordsRouterDeps): IRouter {
  const router: IRouter = Router();

  router.post("/health-records/import", async (req, res) => {
    try {
      const userId = resolveUserId(req);
      const parsed = importSchema.safeParse(req.body);
      if (!parsed.success) {
        // Field PATHS only — never received values (raw health data).
        deps.log.info(
          {
            userId,
            issues: parsed.error.issues
              .slice(0, 10)
              .map((i) => ({ path: i.path.join("."), code: i.code })),
          },
          "POST /aforce/health-records/import rejected",
        );
        res.status(400).json({ error: "health_records_invalid" });
        return;
      }

      // Re-stamp identity and identity-derived fields server-side. The wire
      // record carries neither userId nor deduplicationKey by schema; both are
      // computed here under the AUTHENTICATED user.
      const records: CanonicalHealthRecord[] = parsed.data.records.map((r) => {
        const withUser = { ...r, userId } as CanonicalHealthRecord;
        const origin = originOf(withUser);
        return {
          ...withUser,
          deduplicationKey: buildDeduplicationKey({
            userId,
            metricType: r.metricType,
            origin,
            ...(r.externalId ? { externalId: r.externalId } : {}),
            ...(r.startTime ? { startTime: r.startTime } : {}),
            ...(r.endTime ? { endTime: r.endTime } : {}),
            observedAt: r.observedAt,
          }),
        };
      });

      const result = await deps.repo.upsertRecords(records);

      // Counts + metric tallies only — no values, ever.
      const byMetric: Record<string, number> = {};
      for (const r of records) byMetric[r.metricType] = (byMetric[r.metricType] ?? 0) + 1;
      deps.log.info(
        { userId, received: records.length, upserted: result.upserted, byMetric },
        "POST /aforce/health-records/import done",
      );

      res.json({ received: records.length, upserted: result.upserted });
    } catch (err) {
      // Never serialize the request body; the error alone identifies the fault.
      deps.log.error(
        { err: err instanceof Error ? err.message : String(err) },
        "POST /aforce/health-records/import failed",
      );
      res.status(500).json({ error: "health_records_failed" });
    }
  });

  return router;
}

/** Production wiring — the shared drizzle db + the existing repo. */
const router = buildHealthRecordsRouter({
  repo: createHealthRecordsRepo(db),
  log: defaultLogger,
});

export default router;
