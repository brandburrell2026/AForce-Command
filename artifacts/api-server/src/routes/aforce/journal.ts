import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  aforceIntakeLogs, aforceScoreSnapshots,
} from "@workspace/db";
import { eq, sql, and, gte, asc, desc } from "drizzle-orm";
import { logger } from "../../lib/logger";
import { resolveUserId } from "./shared";

const router: IRouter = Router();

// ─── Hydration Journal ─────────────────────────────────────────────────────────
// Longitudinal score / intake / sodium / sessions history.
//   POST /journal/snapshot  → persist a single score snapshot row
//   GET  /journal/timeline  → chronological interleave of snapshots + intake_logs
//   GET  /journal/rollups   → per-day aggregates (avg/min/max score, % time per band, totals)

const LEVELS = ["PEAK", "BALANCED", "RECOVERING", "DEPLETED"] as const;
const snapshotSchema = z.object({
  score: z.number().int().min(0).max(100),
  level: z.enum(LEVELS),
  ozConsumedToday: z.number().min(0).default(0),
  aforceUnitsToday: z.number().int().min(0).default(0),
  unitsConsumedToday: z.number().int().min(0).default(0),
  sodiumDeliveredMg: z.number().min(0).default(0),
  sodiumLostMg: z.number().min(0).default(0),
  deficitPct: z.number().min(0).default(0),
  clutchActive: z.boolean().default(false),
  socialActive: z.boolean().default(false),
  autopilotActive: z.boolean().default(false),
  reason: z.string().max(280).default(""),
  // Recovery Layer — all optional; persisted only when the client opts
  // in (i.e. `spec_recovery` is on). Server is content-agnostic.
  recoveryScore: z.number().int().min(0).max(100).optional(),
  pressureScore: z.number().int().min(0).max(100).optional(),
  recoveryTrend: z.enum(["rising", "stable", "declining"]).optional(),
  recoveryFingerprint: z.string().regex(/^[0-9a-f]{8}$/).optional(),
  recoveryStory: z.string().max(280).optional(),
});

router.post("/journal/snapshot", async (req, res) => {
  try {
    const body = snapshotSchema.parse(req.body);
    const userId = resolveUserId(req);
    const [row] = await db
      .insert(aforceScoreSnapshots)
      .values({ userId, ...body })
      .returning();
    return res.json({ snapshot: row });
  } catch (err) {
    logger.error({ err }, "POST /aforce/journal/snapshot failed");
    return res.status(400).json({ error: "snapshot_failed" });
  }
});

// ─── Recovery Layer snapshot ───────────────────────────────────────────────────
// Returns the most recent snapshot row that actually carries Recovery
// Layer fields. Rows persisted with `spec_recovery` OFF leave the five
// recovery columns NULL, so we filter them out — the response shape
// must be either a fully-populated recovery payload or `null`, never a
// half-populated record.
router.get("/recovery/snapshot", async (req, res) => {
  try {
    const userId = resolveUserId(req);
    const [row] = await db
      .select({
        capturedAt: aforceScoreSnapshots.capturedAt,
        recovery: aforceScoreSnapshots.recoveryScore,
        pressure: aforceScoreSnapshots.pressureScore,
        trend: aforceScoreSnapshots.recoveryTrend,
        fingerprint: aforceScoreSnapshots.recoveryFingerprint,
        story: aforceScoreSnapshots.recoveryStory,
      })
      .from(aforceScoreSnapshots)
      .where(
        and(
          eq(aforceScoreSnapshots.userId, userId),
          sql`${aforceScoreSnapshots.recoveryScore} IS NOT NULL`,
        ),
      )
      .orderBy(desc(aforceScoreSnapshots.capturedAt))
      .limit(1);
    if (!row) return res.json({ snapshot: null });
    return res.json({
      snapshot: {
        capturedAt: row.capturedAt,
        recovery: row.recovery,
        pressure: row.pressure,
        trend: row.trend,
        fingerprint: row.fingerprint,
        story: row.story,
      },
    });
  } catch (err) {
    logger.error({ err }, "GET /aforce/recovery/snapshot failed");
    return res.status(500).json({ error: "recovery_snapshot_failed" });
  }
});

const daysQuery = z.object({
  days: z.coerce.number().int().min(1).max(365).default(7),
});

router.get("/journal/timeline", async (req, res) => {
  try {
    const { days } = daysQuery.parse(req.query);
    const userId = resolveUserId(req);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [snapshots, intakes] = await Promise.all([
      db
        .select()
        .from(aforceScoreSnapshots)
        .where(and(eq(aforceScoreSnapshots.userId, userId), gte(aforceScoreSnapshots.capturedAt, since)))
        .orderBy(asc(aforceScoreSnapshots.capturedAt)),
      db
        .select()
        .from(aforceIntakeLogs)
        .where(and(eq(aforceIntakeLogs.userId, userId), gte(aforceIntakeLogs.loggedAt, since)))
        .orderBy(asc(aforceIntakeLogs.loggedAt)),
    ]);

    type SnapshotLevel = (typeof LEVELS)[number];
    const validLevels = new Set<string>(LEVELS);
    type Entry =
      | {
          type: "snapshot";
          at: string;
          score: number;
          level: SnapshotLevel;
          ozConsumedToday: number;
          aforceUnitsToday: number;
          unitsConsumedToday: number;
          sodiumDeliveredMg: number;
          sodiumLostMg: number;
          deficitPct: number;
          clutchActive: boolean;
          socialActive: boolean;
          autopilotActive: boolean;
          reason: string;
        }
      | {
          type: "intake";
          at: string;
          fluidType: string;
          ozAmount: number;
          scoreBefore: number;
          scoreAfter: number;
        };

    const entries: Entry[] = [
      ...snapshots
        // Drop legacy / corrupted rows whose `level` doesn't match the
        // expected union — keeps the client's PerformanceLevel type
        // honest without crashing the request.
        .filter((s) => validLevels.has(s.level))
        .map<Entry>((s) => ({
        type: "snapshot",
        at: s.capturedAt.toISOString(),
        score: s.score,
        level: s.level as SnapshotLevel,
        ozConsumedToday: s.ozConsumedToday,
        aforceUnitsToday: s.aforceUnitsToday,
        unitsConsumedToday: s.unitsConsumedToday,
        sodiumDeliveredMg: s.sodiumDeliveredMg,
        sodiumLostMg: s.sodiumLostMg,
        deficitPct: s.deficitPct,
        clutchActive: s.clutchActive,
        socialActive: s.socialActive,
        autopilotActive: s.autopilotActive,
        reason: s.reason,
      })),
      ...intakes.map<Entry>((i) => ({
        type: "intake",
        at: i.loggedAt.toISOString(),
        fluidType: i.fluidType,
        ozAmount: i.ozAmount,
        scoreBefore: i.scoreBefore,
        scoreAfter: i.scoreAfter,
      })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    return res.json({ entries, days });
  } catch (err) {
    logger.error({ err }, "GET /aforce/journal/timeline failed");
    return res.status(400).json({ error: "timeline_failed" });
  }
});

router.get("/journal/rollups", async (req, res) => {
  try {
    const { days } = daysQuery.parse(req.query);
    const userId = resolveUserId(req);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [snapshots, intakes] = await Promise.all([
      db
        .select()
        .from(aforceScoreSnapshots)
        .where(and(eq(aforceScoreSnapshots.userId, userId), gte(aforceScoreSnapshots.capturedAt, since)))
        .orderBy(asc(aforceScoreSnapshots.capturedAt)),
      db
        .select()
        .from(aforceIntakeLogs)
        .where(and(eq(aforceIntakeLogs.userId, userId), gte(aforceIntakeLogs.loggedAt, since)))
        .orderBy(asc(aforceIntakeLogs.loggedAt)),
    ]);

    function dayKey(d: Date): string {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    }

    interface DayAcc {
      date: string;
      snapshotsCount: number;
      sumScore: number;
      minScore: number;
      maxScore: number;
      lastOzConsumed: number;
      lastAforceUnits: number;
      lastUnitsConsumed: number;
      lastSodiumDelivered: number;
      lastSodiumLost: number;
      lastDeficitPct: number;
      bandMillis: { PEAK: number; BALANCED: number; RECOVERING: number; DEPLETED: number };
      intakeCount: number;
      autopilotSessions: number;
      socialSessions: number;
      autopilotPrev: boolean;
      socialPrev: boolean;
    }

    const acc = new Map<string, DayAcc>();
    function ensure(date: string): DayAcc {
      let d = acc.get(date);
      if (!d) {
        d = {
          date,
          snapshotsCount: 0,
          sumScore: 0,
          minScore: Number.POSITIVE_INFINITY,
          maxScore: Number.NEGATIVE_INFINITY,
          lastOzConsumed: 0,
          lastAforceUnits: 0,
          lastUnitsConsumed: 0,
          lastSodiumDelivered: 0,
          lastSodiumLost: 0,
          lastDeficitPct: 0,
          bandMillis: { PEAK: 0, BALANCED: 0, RECOVERING: 0, DEPLETED: 0 },
          intakeCount: 0,
          autopilotSessions: 0,
          socialSessions: 0,
          autopilotPrev: false,
          socialPrev: false,
        };
        acc.set(date, d);
      }
      return d;
    }

    /**
     * Attribute a half-open interval `[fromMs, toMs)` to a single level,
     * splitting at UTC day boundaries so each calendar day gets the
     * portion that fell within it. Caller is responsible for capping
     * the interval length (gap policy).
     */
    function attributeInterval(fromMs: number, toMs: number, level: string) {
      if (toMs <= fromMs) return;
      const k = level as keyof DayAcc["bandMillis"];
      let cursor = fromMs;
      while (cursor < toMs) {
        const cursorDate = new Date(cursor);
        const nextMidnight = Date.UTC(
          cursorDate.getUTCFullYear(),
          cursorDate.getUTCMonth(),
          cursorDate.getUTCDate() + 1,
        );
        const segEnd = Math.min(toMs, nextMidnight);
        const dt = segEnd - cursor;
        if (dt > 0) {
          const d = ensure(dayKey(cursorDate));
          if (k in d.bandMillis) d.bandMillis[k] += dt;
        }
        cursor = segEnd;
      }
    }

    // First pass: per-day stats (avg / min / max / end-of-day totals,
    // session edge counts).
    for (const s of snapshots) {
      const date = dayKey(s.capturedAt);
      const d = ensure(date);
      d.snapshotsCount += 1;
      d.sumScore += s.score;
      d.minScore = Math.min(d.minScore, s.score);
      d.maxScore = Math.max(d.maxScore, s.score);
      d.lastOzConsumed = s.ozConsumedToday;
      d.lastAforceUnits = s.aforceUnitsToday;
      d.lastUnitsConsumed = s.unitsConsumedToday;
      d.lastSodiumDelivered = s.sodiumDeliveredMg;
      d.lastSodiumLost = s.sodiumLostMg;
      d.lastDeficitPct = s.deficitPct;
      if (s.autopilotActive && !d.autopilotPrev) d.autopilotSessions += 1;
      if (s.socialActive && !d.socialPrev) d.socialSessions += 1;
      d.autopilotPrev = s.autopilotActive;
      d.socialPrev = s.socialActive;
    }

    // Second pass: continuous band-time attribution across the whole
    // window. Each segment between consecutive samples is held at the
    // previous sample's level, capped at 1 h (to avoid attributing
    // overnight idle time as "still in this band"), and split at UTC
    // day boundaries so single-snapshot days still get their share.
    const GAP_CAP_MS = 60 * 60 * 1000;
    for (let i = 0; i < snapshots.length - 1; i++) {
      const cur = snapshots[i]!;
      const next = snapshots[i + 1]!;
      const fromMs = cur.capturedAt.getTime();
      const toMs = Math.min(next.capturedAt.getTime(), fromMs + GAP_CAP_MS);
      attributeInterval(fromMs, toMs, cur.level);
    }
    if (snapshots.length > 0) {
      const last = snapshots[snapshots.length - 1]!;
      const lastTs = last.capturedAt.getTime();
      const tailEnd = Math.min(Date.now(), lastTs + GAP_CAP_MS);
      attributeInterval(lastTs, tailEnd, last.level);
    }

    for (const i of intakes) {
      const date = dayKey(i.loggedAt);
      const d = ensure(date);
      d.intakeCount += 1;
    }

    const rollups = Array.from(acc.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => {
        const totalBand = d.bandMillis.PEAK + d.bandMillis.BALANCED + d.bandMillis.RECOVERING + d.bandMillis.DEPLETED;
        const pct = (n: number) => (totalBand > 0 ? Math.round((n / totalBand) * 100) : 0);
        return {
          date: d.date,
          snapshotsCount: d.snapshotsCount,
          avgScore: d.snapshotsCount > 0 ? Math.round(d.sumScore / d.snapshotsCount) : 0,
          minScore: d.snapshotsCount > 0 ? d.minScore : 0,
          maxScore: d.snapshotsCount > 0 ? d.maxScore : 0,
          endOzConsumed: d.lastOzConsumed,
          endAforceUnits: d.lastAforceUnits,
          endUnitsConsumed: d.lastUnitsConsumed,
          endSodiumDelivered: d.lastSodiumDelivered,
          endSodiumLost: d.lastSodiumLost,
          endDeficitPct: d.lastDeficitPct,
          pctTimePeak: pct(d.bandMillis.PEAK),
          pctTimeBalanced: pct(d.bandMillis.BALANCED),
          pctTimeRecovering: pct(d.bandMillis.RECOVERING),
          pctTimeDepleted: pct(d.bandMillis.DEPLETED),
          intakeCount: d.intakeCount,
          autopilotSessions: d.autopilotSessions,
          socialSessions: d.socialSessions,
        };
      });

    return res.json({ rollups, days });
  } catch (err) {
    logger.error({ err }, "GET /aforce/journal/rollups failed");
    return res.status(400).json({ error: "rollups_failed" });
  }
});

export default router;
