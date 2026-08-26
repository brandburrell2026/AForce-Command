import { Router, type IRouter } from "express";
import { serializeError } from "../../lib/serializeError";
import { z } from "zod";
import {
  db,
  aforceIntakeLogs, aforceScoreSnapshots, aforceAchievements,
} from "@workspace/db";
import { ne, eq, and, gte, asc, desc, inArray } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { resolveUserId, ACH_CODES, unlockAchievementCode } from "./shared";
import type { AchCode } from "./shared";

const router: IRouter = Router();

// ─── Achievements ──────────────────────────────────────────────────────────────
// Catalog lives client-side (services/achievementsCatalog.ts); the
// server only persists which codes a user has unlocked + computes
// progress on the fly from snapshots + intake_logs.

const unlockSchema = z.object({ code: z.enum(ACH_CODES) });

router.post("/achievements/unlock", async (req, res) => {
  try {
    const { code } = unlockSchema.parse(req.body);
    const userId = resolveUserId(req);
    const newlyUnlocked = await unlockAchievementCode(userId, code);
    return res.json({ code, unlocked: true, newlyUnlocked });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "POST /aforce/achievements/unlock failed");
    return res.status(400).json({ error: "unlock_failed" });
  }
});

router.get("/achievements", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    // Pull the snapshots + intakes window we need to compute progress.
    // 60 days is plenty for the longest streak (30) plus headroom.
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const [snapshots, intakes, persisted] = await Promise.all([
      db
        .select()
        .from(aforceScoreSnapshots)
        .where(and(
          eq(aforceScoreSnapshots.userId, userId),
          gte(aforceScoreSnapshots.capturedAt, since),
          // Wave-3 PR11: achievements are earned on MEASURED behavior only.
          // Provenance rows previously counted toward hydration_engineer
          // (one 2000-row import = instant unlock) and their derived
          // deficitPct could fabricate sodium_master-compliant days.
          ne(aforceScoreSnapshots.level, "NOT_COMPUTED"),
        ))
        .orderBy(asc(aforceScoreSnapshots.capturedAt)),
      db
        .select({ id: aforceIntakeLogs.id, loggedAt: aforceIntakeLogs.loggedAt, fluidType: aforceIntakeLogs.fluidType })
        .from(aforceIntakeLogs)
        .where(and(eq(aforceIntakeLogs.userId, userId), gte(aforceIntakeLogs.loggedAt, since)))
        .orderBy(asc(aforceIntakeLogs.loggedAt)),
      db
        .select()
        .from(aforceAchievements)
        .where(and(eq(aforceAchievements.userId, userId), inArray(aforceAchievements.code, ACH_CODES as unknown as string[])))
        .orderBy(desc(aforceAchievements.unlockedAt)),
    ]);

    // ─── Day buckets for streak / sodium-master / heat-survivor ────────
    function dayKey(d: Date): string {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }

    const intakeDays = new Set<string>();
    for (const i of intakes) intakeDays.add(dayKey(i.loggedAt));

    // Longest current trailing streak (back from today).
    function trailingStreak(): number {
      let n = 0;
      const cursor = new Date();
      // Walk backward day by day until we hit a day with no intake.
      for (let safety = 0; safety < 60; safety += 1) {
        if (intakeDays.has(dayKey(cursor))) {
          n += 1;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else {
          break;
        }
      }
      return n;
    }
    const streak = trailingStreak();

    // Day-grouped snapshot stats.
    const dayStats = new Map<string, {
      lastDeficit: number;
      hadHeatPeak: boolean;
      hadAutopilot: boolean;
      hadSocial: boolean;
      maxAforceUnits: number;
    }>();
    for (const s of snapshots) {
      const k = dayKey(s.capturedAt);
      const cur = dayStats.get(k) ?? {
        lastDeficit: 100, hadHeatPeak: false, hadAutopilot: false,
        hadSocial: false, maxAforceUnits: 0,
      };
      cur.lastDeficit = s.deficitPct;
      // Heat Survivor: PEAK while a Heat Guard reason snapshot landed on
      // the same day. We approximate "heat guard active" via the reason
      // string flag — engine writes "heat_guard:..." prefixes.
      if (s.level === "PEAK" && /heat/i.test(s.reason)) cur.hadHeatPeak = true;
      if (s.autopilotActive) cur.hadAutopilot = true;
      if (s.socialActive) cur.hadSocial = true;
      if (s.aforceUnitsToday > cur.maxAforceUnits) cur.maxAforceUnits = s.aforceUnitsToday;
      dayStats.set(k, cur);
    }

    const sodiumMasterDays = Array.from(dayStats.values()).filter((d) => d.lastDeficit <= 5).length;
    const heatSurvivor = Array.from(dayStats.values()).some((d) => d.hadHeatPeak);
    const recoveryRookie = snapshots.some((s) => s.autopilotActive);
    const socialSentinel = snapshots.some((s) => s.socialActive);
    const aforceConvert = snapshots.some((s) => s.aforceUnitsToday >= 10);
    const hydrationEngineerCount = snapshots.length;

    const persistedMap = new Map<string, Date>();
    for (const p of persisted) persistedMap.set(p.code, p.unlockedAt);

    // Compute the live unlock state. A code may be "earned now" without
    // a persisted row yet (e.g. user hit the criterion on the most
    // recent snapshot). We persist on read so the unlock time is
    // anchored to the first time the criterion was satisfied.
    const liveUnlocked: Record<AchCode, boolean> = {
      first_sip:           intakes.length >= 1,
      streak_3:            streak >= 3,
      streak_7:            streak >= 7,
      streak_30:           streak >= 30,
      sodium_master:       sodiumMasterDays >= 4,
      heat_survivor:       heatSurvivor,
      recovery_rookie:     recoveryRookie,
      social_sentinel:     socialSentinel,
      aforce_convert:      aforceConvert,
      hydration_engineer:  hydrationEngineerCount >= 30,
      // pdf_pioneer + sensor_sync are persisted-only — they have no
      // recomputable on-the-fly criterion.
      pdf_pioneer:         persistedMap.has("pdf_pioneer"),
      sensor_sync:         persistedMap.has("sensor_sync"),
    };

    // Persist any newly-satisfied unlocks so the unlock date sticks.
    for (const code of ACH_CODES) {
      if (liveUnlocked[code] && !persistedMap.has(code)) {
        await unlockAchievementCode(userId, code);
        persistedMap.set(code, new Date());
      }
    }

    const progress: Partial<Record<AchCode, number>> = {
      streak_3:            Math.min(1, streak / 3),
      streak_7:            Math.min(1, streak / 7),
      streak_30:           Math.min(1, streak / 30),
      sodium_master:       Math.min(1, sodiumMasterDays / 4),
      hydration_engineer:  Math.min(1, hydrationEngineerCount / 30),
      aforce_convert:      Math.min(
        1,
        Math.max(0, ...Array.from(dayStats.values()).map((d) => d.maxAforceUnits)) / 10,
      ),
    };

    const unlocks = ACH_CODES.map((code) => {
      const unlockedAt = persistedMap.get(code);
      return {
        code,
        unlocked: liveUnlocked[code],
        ...(unlockedAt ? { unlockedAt: unlockedAt.toISOString() } : {}),
        ...(progress[code] != null ? { progress: progress[code] } : {}),
      };
    });

    return res.json({ unlocks });
  } catch (err) {
    logger.error({ err: serializeError(err) }, "GET /aforce/achievements failed");
    return res.status(500).json({ error: "achievements_failed" });
  }
});

export default router;
