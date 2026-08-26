import { Router, type IRouter } from "express";
import { serializeError } from "../../lib/serializeError";
import { z } from "zod";
import {
  db,
  aforceScoreSnapshots,
  createDrizzleScoreSnapshotRepo,
} from "@workspace/db";
import { HYDROSTATE_MODEL_VERSION } from "../../lib/hydroStateModelVersion";
import { getUserState } from "../../lib/aforceState";
import { logger } from "../../lib/logger";
import { sensorImportLimiter } from "../../middlewares/rateLimits";
import { resolveUserId, unlockAchievementCode } from "./shared";

const router: IRouter = Router();

/**
 * PURE row mapper (exported for tests): sensor rows → provenance-only
 * score-snapshot inserts. INVARIANTS (Wave-1 P0):
 *   - produces no intake rows of any kind,
 *   - consumption fields are always 0 (oz/units/aforceUnits),
 *   - sweat/sodium loss are preserved as the provenance carriers,
 *   - invalid timestamps are skipped, never coerced.
 * The score/level pair remains the timeline's neutral placeholder (70 /
 * BALANCED) — a pre-existing display convention this fix does not expand;
 * flagged in the Wave-1 report for a proper sweat-session record.
 */
export function mapSensorRowsToSnapshots(
  userId: string,
  reason: string,
  rows: ReadonlyArray<{ timestamp: string; sweatLossMl: number; sodiumMg?: number }>,
): Array<typeof aforceScoreSnapshots.$inferInsert> {
  const snapshots: Array<typeof aforceScoreSnapshots.$inferInsert> = [];
  for (const row of rows) {
    const ts = new Date(row.timestamp);
    if (Number.isNaN(ts.getTime())) continue;
    // Wave-2 PR2: reject future-dated provenance rows (small clock-skew
    // grace) — same skip semantics as invalid timestamps.
    if (ts.getTime() - Date.now() > 5 * 60 * 1000) continue;
    const sodiumLost = row.sodiumMg ?? 0;
    const deficitPct = Math.min(100, sodiumLost / 50); // rough %: 5g lost ≈ 100
    snapshots.push({
      userId,
      // Wave-3 PR11 (founder decision W2-N3): a sensor row has NOT been
      // scored by the canonical scoring path — it must never carry an
      // apparently-physiological score/state. level NOT_COMPUTED is the
      // honest marker every consumer filters on; the 0 is an inert
      // sentinel for the NOT NULL column and is never read as a score
      // (safety comes from `level`, locked by tests).
      score: 0,
      level: "NOT_COMPUTED",
      ozConsumedToday: 0,
      aforceUnitsToday: 0,
      unitsConsumedToday: 0,
      sodiumDeliveredMg: 0,
      sodiumLostMg: sodiumLost,
      deficitPct,
      clutchActive: false,
      socialActive: false,
      autopilotActive: false,
      reason,
      capturedAt: ts,
    });
  }
  return snapshots;
}

// ─── Sweat-sensor import ───────────────────────────────────────────────────────
// Accepts parsed rows from a third-party patch (hDrop / Nix / Gx).
//
// Wave-1 P0 integrity fix (founder authorization 2026-08-12): sensor rows
// record LOSS provenance ONLY. A previous revision converted sweat loss to
// water-intake credit (1 oz per 30 mL lost), fabricated intake_log rows,
// and advanced lastIntakeTime — i.e. sweating MORE increased hydration
// credit and reset the engine's recency decay. That inverted the physics
// and breached Score Protection (HydroState may change only through
// approved completed hydration behavior). Sensor import now:
//   • creates NO intake logs (measurement is not consumption),
//   • never advances lastIntakeTime,
//   • never records consumption fields (oz/units stay 0),
//   • preserves source provenance in score_snapshots tagged
//     `reason='sensor:<source>'` (sweat/sodium loss carriers, as before).

const SENSOR_SOURCES = ["hdrop", "nix", "gatorade_gx"] as const;

const sensorRowSchema = z.object({
  timestamp: z.string().min(1),
  sweatLossMl: z.number().nonnegative().max(10000),
  // Wave-2 PR2 bound: sodiumMg flows into sodiumLostMg (and the derived
  // deficitPct) on the snapshot row — cap at an impossible-but-generous
  // per-reading ceiling so forged imports can't post absurd loss.
  sodiumMg: z.number().nonnegative().max(50000).default(0),
  potassiumMg: z.number().nonnegative().optional(),
});

const sensorImportSchema = z.object({
  source: z.enum(SENSOR_SOURCES),
  rows: z.array(sensorRowSchema).min(1).max(2000),
});

router.post("/sensors/import", sensorImportLimiter, async (req, res) => {
  try {
    const body = sensorImportSchema.parse(req.body);
    const userId = resolveUserId(req);
    await getUserState(userId);
    const reason = `sensor:${body.source}`;

    const snapshots = mapSensorRowsToSnapshots(userId, reason, body.rows);

    if (snapshots.length === 0) {
      return res.status(400).json({ error: "no_valid_rows" });
    }

    await db.transaction(async (tx) => {
      // D-08 / DR-009: snapshots go through the central repository so every
      // row is stamped with the HydroState model version. The tx handle keeps
      // the batch atomic (founder Decision 4 scope).
      const snapshotRepo = createDrizzleScoreSnapshotRepo(tx, HYDROSTATE_MODEL_VERSION);
      await snapshotRepo.createMany(snapshots);
      // Deliberately NO intake insert and NO lastIntakeTime update:
      // sensor measurement is not hydration behavior (Score Protection).
    });

    // Auto-unlock Sensor Sync on first successful import (idempotent).
    await unlockAchievementCode(userId, "sensor_sync");

    return res.json({ imported: snapshots.length, source: body.source, reason });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/sensors/import failed");
    return res.status(400).json({ error: "sensor_import_failed" });
  }
});

export default router;
