import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  aforceIntakeLogs, aforceUserState, aforceScoreSnapshots,
  createDrizzleScoreSnapshotRepo,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { HYDROSTATE_MODEL_VERSION } from "../../lib/hydroStateModelVersion";
import { getUserState } from "../../lib/aforceState";
import { logger } from "../../lib/logger";
import { resolveUserId, unlockAchievementCode } from "./shared";

const router: IRouter = Router();

// ─── Sweat-sensor import ───────────────────────────────────────────────────────
// Accepts parsed rows from a third-party patch (hDrop / Nix / Gx).
// Each row creates an intake_log + a score_snapshot tagged with
// `reason='sensor:<source>'`. We approximate the intake side as a
// water-equivalent rehydration: 1 oz per 30 mL replaced (= a ~30 mL
// AForce stick converts back to 1 oz, the user's drinking unit). The
// snapshot deficit_pct stores the actual sweat loss / sodium loss so
// the journal still reflects the raw sensor data.

const SENSOR_SOURCES = ["hdrop", "nix", "gatorade_gx"] as const;

const sensorRowSchema = z.object({
  timestamp: z.string().min(1),
  sweatLossMl: z.number().nonnegative(),
  sodiumMg: z.number().nonnegative().default(0),
  potassiumMg: z.number().nonnegative().optional(),
});

const sensorImportSchema = z.object({
  source: z.enum(SENSOR_SOURCES),
  rows: z.array(sensorRowSchema).min(1).max(2000),
});

router.post("/sensors/import", async (req, res) => {
  try {
    const body = sensorImportSchema.parse(req.body);
    const userId = resolveUserId(req);
    await getUserState(userId);
    const reason = `sensor:${body.source}`;

    let lastTs = 0;
    const intakes: Array<typeof aforceIntakeLogs.$inferInsert> = [];
    const snapshots: Array<typeof aforceScoreSnapshots.$inferInsert> = [];

    for (const row of body.rows) {
      const ts = new Date(row.timestamp);
      if (Number.isNaN(ts.getTime())) continue;
      lastTs = Math.max(lastTs, ts.getTime());
      // Approximate water-equivalent rehydration: 30 mL ≈ 1 oz.
      const ozEquivalent = Math.max(0, row.sweatLossMl / 30);
      intakes.push({
        userId,
        fluidType: "water",
        ozAmount: ozEquivalent,
        // Score before/after on a sensor-derived row are placeholders;
        // the engine recomputes the displayed score on the next /state
        // fetch. We just need a non-null pair that the timeline can
        // render.
        scoreBefore: 70,
        scoreAfter: 70,
        loggedAt: ts,
      });
      // Use deficit_pct as the carrier for "sodium-loss vs delivered"
      // ratio for this interval — bounded 0–100 to match the column
      // semantics elsewhere.
      const sodiumLost = row.sodiumMg;
      const deficitPct = Math.min(100, sodiumLost / 50); // rough %: 5g lost ≈ 100
      snapshots.push({
        userId,
        score: 70,
        level: "BALANCED",
        ozConsumedToday: ozEquivalent,
        aforceUnitsToday: 0,
        unitsConsumedToday: 1,
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

    if (intakes.length === 0) {
      return res.status(400).json({ error: "no_valid_rows" });
    }

    // Defensive guard against client-side timestamp parsing bugs
    // (e.g. unix-seconds misread as unix-ms producing 1970 dates, or
    // future-dated samples from clock-skewed sensors). Only allow
    // `lastIntakeTime` to advance into a plausible window.
    const TS_MIN = Date.UTC(2015, 0, 1);
    const TS_MAX = Date.now() + 24 * 60 * 60 * 1000; // +1 day grace
    const safeLastTs = lastTs > TS_MIN && lastTs < TS_MAX ? lastTs : 0;

    await db.transaction(async (tx) => {
      await tx.insert(aforceIntakeLogs).values(intakes);
      // D-08 / DR-009: snapshots go through the central repository so every
      // row is stamped with the HydroState model version. The tx handle keeps
      // the batch atomic (founder Decision 4 scope).
      const snapshotRepo = createDrizzleScoreSnapshotRepo(tx, HYDROSTATE_MODEL_VERSION);
      await snapshotRepo.createMany(snapshots);
      // Bump lastIntakeTime to the most recent valid sensor sample so
      // the engine's recency-aware terms reflect the import.
      if (safeLastTs > 0) {
        await tx
          .update(aforceUserState)
          .set({ lastIntakeTime: new Date(safeLastTs), updatedAt: new Date() })
          .where(eq(aforceUserState.userId, userId));
      }
    });

    // Auto-unlock Sensor Sync on first successful import (idempotent).
    await unlockAchievementCode(userId, "sensor_sync");

    return res.json({ imported: intakes.length, source: body.source, reason });
  } catch (err) {
    logger.error({ err }, "POST /aforce/sensors/import failed");
    return res.status(400).json({ error: "sensor_import_failed" });
  }
});

export default router;
