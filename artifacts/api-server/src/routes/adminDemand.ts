/**
 * Admin / debug endpoints for the Hydration Demand Engine.
 *
 * Surface (admin-gated, Phase 1 — invisible to end users):
 *
 *   POST /api/admin/demand/snapshot
 *     body: HydrationDemandInputs (+ optional userId, clientSnapshotId,
 *           source, computedAt)
 *     Persists the computation to `aforce_demand_snapshots` and
 *     returns { inputs, outputs, snapshot } where `snapshot` is the
 *     stored row (id, userId, clientSnapshotId, source, computedAt,
 *     createdAt). Idempotent on (userId, clientSnapshotId).
 *
 *   GET  /api/admin/demand/snapshot?weightLbs=...&...
 *     Same shape via query params. Also persists.
 *
 *   GET  /api/admin/demand/snapshots?userId=...&limit=...
 *     Returns the most recent persisted snapshots for `userId`,
 *     ordered by computedAt DESC.
 *
 * Architecture lock alignment:
 *   - Hidden infra: no visible surface consumes these endpoints.
 *   - The engine is the shared @workspace/demand-engine module
 *     (single source of truth — same code mobile uses).
 *   - Mobile selector still respects `spec_demand_engine`; the
 *     admin endpoints deliberately bypass that flag because admins
 *     are debugging the engine itself.
 *   - No compliance language is generated server-side; all output
 *     strings come from the shared engine module which is already
 *     scrubbed.
 *
 * Persistence:
 *   - Every successful compute is written to
 *     `aforce_demand_snapshots`. When the caller doesn't supply a
 *     `userId`, the row is attributed to a synthetic 'admin_debug'
 *     userId — separating ad-hoc admin pings from user-attributed
 *     snapshots.
 *   - `clientSnapshotId` is generated server-side when absent so
 *     every row has a stable idempotency key. Callers that want
 *     replay-safe writes should pass their own.
 */

import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  computeHydrationDemand,
  type HydrationDemandInputs,
  type HydrationDemandOutputs,
} from "@workspace/demand-engine";
import {
  db,
  createDrizzleDemandSnapshotRepo,
  type DemandSnapshotRecord,
  type DemandSnapshotRepo,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";

const ADMIN_DEBUG_USER_ID = "admin_debug";
const DEFAULT_SOURCE = "admin_debug";

const SweatProfile = z.enum(["low", "moderate", "high", "very_high"]);
const EnvironmentProfile = z.enum([
  "mostly_indoor",
  "mixed",
  "mostly_outdoor",
  "hot_climate",
  "travel_often",
]);

/** Inputs the engine consumes. Strict (rejects unknown fields). */
const InputsSchema = z
  .object({
    weightLbs: z.number().finite(),
    activityLevel: z.number().finite(),
    sweatProfile: SweatProfile.optional(),
    environmentProfile: EnvironmentProfile.optional(),
    heatC: z.number().finite().optional(),
    humidityPct: z.number().finite().optional(),
    sleepHours: z.number().finite().optional(),
    recoveryScore: z.number().finite().optional(),
    consumedOz: z.number().finite().optional(),
    completedCycles: z.number().finite().optional(),
  })
  .strict();

/** Persistence metadata callers may opt into. All optional. */
const PersistMetaSchema = z
  .object({
    /** Attribute the row to a specific user; defaults to admin_debug. */
    userId: z.string().min(1).max(128).optional(),
    /** Stable idempotency key; generated server-side when absent. */
    clientSnapshotId: z.string().min(1).max(128).optional(),
    /** Origin label, e.g. 'mobile_self' | 'background_job'. */
    source: z.string().min(1).max(64).optional(),
    /** Wall-clock when the engine was run (ISO string). */
    computedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

/** Full POST body: inputs ∪ optional persistence meta. */
const PostBodySchema = InputsSchema.merge(PersistMetaSchema);

const ListQuerySchema = z
  .object({
    userId: z.string().min(1).max(128),
    limit: z.coerce.number().int().optional(),
  })
  .strict();

function numFromQuery(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v !== "string" || v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function bodyFromQuery(q: Record<string, unknown>): unknown {
  const out: Record<string, unknown> = {};
  for (const k of [
    "weightLbs",
    "activityLevel",
    "heatC",
    "humidityPct",
    "sleepHours",
    "recoveryScore",
    "consumedOz",
    "completedCycles",
  ]) {
    const n = numFromQuery(q[k]);
    if (n !== undefined) out[k] = n;
  }
  for (const k of [
    "sweatProfile",
    "environmentProfile",
    "userId",
    "clientSnapshotId",
    "source",
    "computedAt",
  ]) {
    if (typeof q[k] === "string" && (q[k] as string).length > 0) {
      out[k] = q[k];
    }
  }
  return out;
}

function generateClientSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Public row shape returned in the API envelope. Drops the
 *  JSONB blobs that the caller already sees inline as
 *  `inputs` / `outputs`. */
interface PublicSnapshot {
  id: number;
  userId: string;
  clientSnapshotId: string;
  source: string;
  computedAt: string;
  targetOz: number;
  remainingOz: number;
  load: string;
  command: string;
  createdAt: string;
}

function toPublicSnapshot(r: DemandSnapshotRecord): PublicSnapshot {
  return {
    id: r.id,
    userId: r.userId,
    clientSnapshotId: r.clientSnapshotId,
    source: r.source,
    computedAt: r.computedAt.toISOString(),
    targetOz: r.targetOz,
    remainingOz: r.remainingOz,
    load: r.load,
    command: r.command,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Build the admin/demand router against an injected repo. Exported
 * so tests can swap in `createInMemoryDemandSnapshotRepo()` without
 * touching the production DB. Production code uses the default
 * export below, which is bound to the Drizzle repo.
 */
export function buildAdminDemandRouter(repo: DemandSnapshotRepo): IRouter {
  const router: IRouter = Router();

  async function computeAndPersist(
    parsed: z.infer<typeof PostBodySchema>,
  ): Promise<{
    inputs: HydrationDemandInputs;
    outputs: HydrationDemandOutputs;
    snapshot: PublicSnapshot;
    replayed: boolean;
  }> {
    const {
      userId,
      clientSnapshotId,
      source,
      computedAt,
      ...inputs
    } = parsed;
    const outputs = computeHydrationDemand(inputs as HydrationDemandInputs);
    const result = await repo.insert({
      userId: userId ?? ADMIN_DEBUG_USER_ID,
      clientSnapshotId: clientSnapshotId ?? generateClientSnapshotId(),
      source: source ?? DEFAULT_SOURCE,
      computedAt: computedAt ? new Date(computedAt) : new Date(),
      inputs,
      outputs,
      targetOz: outputs.targetOz,
      remainingOz: outputs.remainingOz,
      load: outputs.load,
      command: outputs.command,
    });
    // First-write-wins: on replay, return the canonical inputs/outputs
    // from the stored row instead of the request-derived ones, so the
    // envelope never mixes a stored snapshot with a discarded attempt.
    const canonicalInputs = (
      result.inserted ? inputs : result.record.inputs
    ) as HydrationDemandInputs;
    const canonicalOutputs = (
      result.inserted ? outputs : result.record.outputs
    ) as HydrationDemandOutputs;
    return {
      inputs: canonicalInputs,
      outputs: canonicalOutputs,
      snapshot: toPublicSnapshot(result.record),
      replayed: !result.inserted,
    };
  }

  router.use("/admin/demand", requireAdmin);

  router.post("/admin/demand/snapshot", async (req, res) => {
    const parsed = PostBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_inputs", issues: parsed.error.issues });
      return;
    }
    try {
      const result = await computeAndPersist(parsed.data);
      res.json(result);
    } catch (err) {
      req.log?.error({ err }, "adminDemand:POST snapshot failed");
      res.status(500).json({ error: "snapshot_persist_failed" });
    }
  });

  router.get("/admin/demand/snapshot", async (req, res) => {
    const parsed = PostBodySchema.safeParse(bodyFromQuery(req.query));
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_inputs", issues: parsed.error.issues });
      return;
    }
    try {
      const result = await computeAndPersist(parsed.data);
      res.json(result);
    } catch (err) {
      req.log?.error({ err }, "adminDemand:GET snapshot failed");
      res.status(500).json({ error: "snapshot_persist_failed" });
    }
  });

  router.get("/admin/demand/snapshots", async (req, res) => {
    const parsed = ListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_query", issues: parsed.error.issues });
      return;
    }
    try {
      const rows = await repo.listForUser(parsed.data.userId, {
        limit: parsed.data.limit,
      });
      const total = await repo.countForUser(parsed.data.userId);
      res.json({
        snapshots: rows.map(toPublicSnapshot),
        total,
      });
    } catch (err) {
      req.log?.error({ err }, "adminDemand:list failed");
      res.status(500).json({ error: "snapshot_list_failed" });
    }
  });

  return router;
}

/** Production-wired router. Bound to the Drizzle repo. */
const router: IRouter = buildAdminDemandRouter(
  createDrizzleDemandSnapshotRepo(db),
);

export default router;
