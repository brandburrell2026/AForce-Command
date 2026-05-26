/**
 * Admin / debug endpoint: compute + persist a Hydration Demand
 * snapshot derived from a user's persisted `aforce_user_state` row.
 *
 *   POST /api/admin/demand/snapshot/from-state
 *     body: { userId, clientSnapshotId?, source?, computedAt?,
 *             overrides? }
 *     1. Reads the user's state row.
 *     2. Runs the pure `buildHydrationDemandInputsFromState` adapter
 *        (server-side mirror of the mobile adapter).
 *     3. Computes the engine output via the shared
 *        `@workspace/demand-engine`.
 *     4. Persists to `aforce_demand_snapshots` with the same first-
 *        write-wins semantics PR #12 introduced (returns
 *        `{ inputs, outputs, snapshot, replayed, trace }`).
 *
 * Architecture lock alignment:
 *   - Hidden infra: no UI consumes it.
 *   - Default `source = 'from_state'` so the audit trail can tell
 *     these apart from ad-hoc `admin_debug` pings.
 *   - Source of truth: persisted UserState columns +
 *     freshest-wins across `appleHealth` (legacy) and the new
 *     multi-provider `biometrics` blob. Never fabricates.
 *
 * Injectability:
 *   - Both the snapshot repo AND the state reader are injected via
 *     `buildAdminDemandFromStateRouter(repo, stateReader)` so
 *     tests can fully simulate without touching Postgres. The
 *     default export wires the Drizzle implementations.
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  computeHydrationDemand,
  type HydrationDemandInputs,
  type HydrationDemandOutputs,
} from "@workspace/demand-engine";
import {
  db,
  aforceUserState,
  createDrizzleDemandSnapshotRepo,
  type DemandSnapshotRecord,
  type DemandSnapshotRepo,
} from "@workspace/db";
import { requireAdmin } from "../middlewares/requireAdmin";
import {
  buildHydrationDemandInputsFromState,
  type DemandAdapterOverrides,
  type DemandAdapterTrace,
  type DemandSourceState,
} from "../lib/hydrationDemandStateAdapter";

const DEFAULT_SOURCE = "from_state";

const SweatProfile = z.enum(["low", "moderate", "high", "very_high"]);
const EnvironmentProfile = z.enum([
  "mostly_indoor",
  "mixed",
  "mostly_outdoor",
  "hot_climate",
  "travel_often",
]);

const OverridesSchema = z
  .object({
    consumedOz: z.number().finite().optional(),
    completedCycles: z.number().finite().optional(),
    sweatProfile: SweatProfile.optional(),
    environmentProfile: EnvironmentProfile.optional(),
    recoveryScore: z.number().finite().optional(),
  })
  .strict();

const BodySchema = z
  .object({
    userId: z.string().min(1).max(128),
    clientSnapshotId: z.string().min(1).max(128).optional(),
    source: z.string().min(1).max(64).optional(),
    computedAt: z.string().datetime({ offset: true }).optional(),
    overrides: OverridesSchema.optional(),
  })
  .strict();

/** Public row shape returned in the API envelope. Drops the JSONB
 *  blobs the caller already sees inline. */
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

function generateClientSnapshotId(): string {
  return `snap_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reads the projection of `aforce_user_state` the adapter consumes.
 * Returns `null` when no row exists for the user. Injectable so
 * tests can supply an in-memory map.
 */
export type DemandStateReader = (
  userId: string,
) => Promise<DemandSourceState | null>;

export const createDrizzleDemandStateReader = (): DemandStateReader => {
  return async (userId) => {
    const rows = await db
      .select({
        bodyWeightLbs: aforceUserState.bodyWeightLbs,
        activityLevel: aforceUserState.activityLevel,
        weatherTempC: aforceUserState.weatherTempC,
        weatherHumidity: aforceUserState.weatherHumidity,
        appleHealth: aforceUserState.appleHealth,
        biometrics: aforceUserState.biometrics,
      })
      .from(aforceUserState)
      .where(eq(aforceUserState.userId, userId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      bodyWeightLbs: row.bodyWeightLbs ?? null,
      activityLevel: row.activityLevel ?? null,
      weatherTempC: row.weatherTempC ?? null,
      weatherHumidity: row.weatherHumidity ?? null,
      appleHealth: row.appleHealth ?? null,
      biometrics: row.biometrics ?? null,
    };
  };
};

export function buildAdminDemandFromStateRouter(
  repo: DemandSnapshotRepo,
  stateReader: DemandStateReader,
): IRouter {
  const router: IRouter = Router();
  router.use("/admin/demand", requireAdmin);

  router.post("/admin/demand/snapshot/from-state", async (req, res) => {
    const parsed = BodySchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_inputs", issues: parsed.error.issues });
      return;
    }
    const { userId, clientSnapshotId, source, computedAt, overrides } =
      parsed.data;

    let state: DemandSourceState | null;
    try {
      state = await stateReader(userId);
    } catch (err) {
      req.log?.error({ err }, "adminDemandFromState:state read failed");
      res.status(500).json({ error: "state_read_failed" });
      return;
    }
    if (!state) {
      res.status(404).json({ error: "user_state_not_found" });
      return;
    }

    const adapted = buildHydrationDemandInputsFromState(
      state,
      (overrides ?? {}) as DemandAdapterOverrides,
    );
    const outputs = computeHydrationDemand(adapted.inputs);

    try {
      const result = await repo.insert({
        userId,
        clientSnapshotId: clientSnapshotId ?? generateClientSnapshotId(),
        source: source ?? DEFAULT_SOURCE,
        computedAt: computedAt ? new Date(computedAt) : new Date(),
        inputs: adapted.inputs,
        outputs,
        targetOz: outputs.targetOz,
        remainingOz: outputs.remainingOz,
        load: outputs.load,
        command: outputs.command,
      });
      const canonicalInputs = (
        result.inserted ? adapted.inputs : result.record.inputs
      ) as HydrationDemandInputs;
      const canonicalOutputs = (
        result.inserted ? outputs : result.record.outputs
      ) as HydrationDemandOutputs;
      // Trace describes THIS request's derivation. On replay it
      // describes how the current state would have mapped — still
      // useful for debugging, but flagged via `replayed` so the
      // caller knows the persisted row wasn't written from this
      // trace.
      const trace: DemandAdapterTrace = adapted.trace;
      res.json({
        inputs: canonicalInputs,
        outputs: canonicalOutputs,
        snapshot: toPublicSnapshot(result.record),
        replayed: !result.inserted,
        trace,
      });
    } catch (err) {
      req.log?.error({ err }, "adminDemandFromState:persist failed");
      res.status(500).json({ error: "snapshot_persist_failed" });
    }
  });

  return router;
}

const router: IRouter = buildAdminDemandFromStateRouter(
  createDrizzleDemandSnapshotRepo(db),
  createDrizzleDemandStateReader(),
);

export default router;
