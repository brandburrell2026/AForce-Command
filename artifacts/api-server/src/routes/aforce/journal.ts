import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  db,
  aforceIntakeLogs, aforceScoreSnapshots, aforceConfirmations,
  createDrizzleScoreSnapshotRepo,
} from "@workspace/db";
import { inArray, eq, sql, and, gte, asc, desc } from "drizzle-orm";
import { HYDROSTATE_MODEL_VERSION } from "../../lib/hydroStateModelVersion";
import {
  resolveScoreProtectionMode,
  evaluateScoreWrite,
  decideScoreWrite,
  SCORE_WRITE_GUARD,
} from "../../lib/scoreWriteGuard";
import { logger } from "../../lib/logger";
import { snapshotLimiter } from "../../middlewares/rateLimits";
import { resolveUserId } from "./shared";
import { LEVELS, snapshotSchema } from "./journalSchema";

const router: IRouter = Router();

// ─── Hydration Journal ─────────────────────────────────────────────────────────
// Longitudinal score / intake / sodium / sessions history.
//   POST /journal/snapshot  → persist a single score snapshot row
//   GET  /journal/timeline  → chronological interleave of snapshots + intake_logs
//   GET  /journal/rollups   → per-day aggregates (avg/min/max score, % time per band, totals)

router.post("/journal/snapshot", snapshotLimiter, async (req, res) => {
  // Validate first, and report a schema rejection distinctly from a write
  // failure. The old catch collapsed both into an opaque 400, so a contract
  // mismatch and a DB error were indistinguishable in the field. We surface the
  // failing field PATHS + codes (never the values — privacy), and reserve 5xx
  // for write/DB errors so a deployed-schema drift can't masquerade as a 400.
  const parsed = snapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.code }));
    logger.warn({ issues }, "POST /aforce/journal/snapshot rejected (schema)");
    return res.status(400).json({ error: "snapshot_invalid", issues });
  }
  try {
    const userId = resolveUserId(req);
    // D-08: the model version is stamped centrally by the repository — this
    // route neither supplies nor can omit it (DR-009, founder Decision 5).
    const repo = createDrizzleScoreSnapshotRepo(db, HYDROSTATE_MODEL_VERSION);

    // RC-L8b Score Protection gate (Phase 3A = shadow). Judge the proposed
    // score movement against the append-only behavior record. In `shadow` this
    // ONLY observes + logs; it never blocks and never throws into the write —
    // any guard failure is logged and the write proceeds (observe-only
    // guarantee). `enforce` (Phase 3B) is a deliberate per-env flip.
    const mode = resolveScoreProtectionMode();
    if (mode !== "off") {
      try {
        const [priorRow] = await db
          .select({ score: aforceScoreSnapshots.score, capturedAt: aforceScoreSnapshots.capturedAt })
          .from(aforceScoreSnapshots)
          // Wave-3 PR11: NOT_COMPUTED provenance rows (sensor imports) are
          // not scores — anchoring the unexplained-delta check on one would
          // manufacture false violations (score 0 vs a real 78).
          .where(and(eq(aforceScoreSnapshots.userId, userId), inArray(aforceScoreSnapshots.level, [...LEVELS])))
          .orderBy(desc(aforceScoreSnapshots.capturedAt))
          .limit(1);
        // Evidence window: since the prior snapshot, or a bounded lookback when
        // this is the user's first-ever write.
        const evidenceSince =
          priorRow?.capturedAt ?? new Date(Date.now() - SCORE_WRITE_GUARD.EVIDENCE_WINDOW_MS);
        const [confRows, intakeRows] = await Promise.all([
          db
            .select({ n: sql<number>`count(*)::int` })
            .from(aforceConfirmations)
            .where(and(eq(aforceConfirmations.userId, userId), gte(aforceConfirmations.loggedAt, evidenceSince))),
          db
            .select({ n: sql<number>`count(*)::int` })
            .from(aforceIntakeLogs)
            .where(and(eq(aforceIntakeLogs.userId, userId), gte(aforceIntakeLogs.loggedAt, evidenceSince))),
        ]);
        const verdict = evaluateScoreWrite({
          proposed: { score: parsed.data.score },
          prior: priorRow ? { score: priorRow.score, capturedAt: priorRow.capturedAt } : null,
          evidence: { confirmations: confRows[0]?.n ?? 0, intakeLogs: intakeRows[0]?.n ?? 0 },
        });
        const decision = decideScoreWrite(mode, verdict);
        if (!verdict.ok) {
          logger.warn(
            { mode, userId, delta: verdict.delta, evidenceCount: verdict.evidenceCount, violations: verdict.violations },
            "score-protection: unexplained score movement",
          );
        }
        if (decision.blocked) {
          return res.status(409).json({ error: "score_protection_violation", violations: verdict.violations });
        }
      } catch (guardErr) {
        // The guard must never break a legitimate write. Log and continue.
        logger.error({ err: guardErr }, "score-protection guard failed (write proceeding)");
      }
    }

    const row = await repo.create({ userId, ...parsed.data });
    return res.json({ snapshot: row });
  } catch (err) {
    logger.error({ err }, "POST /aforce/journal/snapshot write failed");
    return res.status(500).json({ error: "snapshot_write_failed" });
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
        .where(and(
          eq(aforceScoreSnapshots.userId, userId),
          gte(aforceScoreSnapshots.capturedAt, since),
          // Wave-3 PR11: aggregates are MEASURED-ONLY — a NOT_COMPUTED
          // provenance row must not pollute snapshotsCount/avg/min/max,
          // band time-share, or the end* fields.
          inArray(aforceScoreSnapshots.level, [...LEVELS]),
        ))
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
