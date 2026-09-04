import { Router, type IRouter } from "express";
import { serializeError } from "../../lib/serializeError";
import { incCounter } from "../../observability/metrics";
import { z } from "zod";
import {
  db,
  aforceIntakeLogs, aforceScoreSnapshots, aforceConfirmations, aforceUserState,
  createDrizzleScoreSnapshotRepo,
} from "@workspace/db";
import { inArray, eq, sql, and, gte, asc, desc, isNull, isNotNull } from "drizzle-orm";
import { HYDROSTATE_MODEL_VERSION } from "../../lib/hydroStateModelVersion";
import { buildJournalRollupsResponse } from "../../lib/journalRollupsAggregation";
import { rollupsQuery } from "../../lib/journalRollupsQuery";
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
    incCounter("score_write_rejected.schema");
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
            // A §10 correction row is bookkeeping, not intake evidence.
            .where(and(
              eq(aforceIntakeLogs.userId, userId),
              gte(aforceIntakeLogs.loggedAt, evidenceSince),
              isNull(aforceIntakeLogs.correctsIntakeId),
            )),
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
    logger.error({ err: serializeError(err) }, "POST /aforce/journal/snapshot write failed");
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
    logger.error({ err: serializeError(err) }, "GET /aforce/recovery/snapshot failed");
    return res.status(500).json({ error: "recovery_snapshot_failed" });
  }
});

export const daysQuery = z.object({
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
        // Correction rows are §10 bookkeeping, never intake entries.
        .where(and(
          eq(aforceIntakeLogs.userId, userId),
          gte(aforceIntakeLogs.loggedAt, since),
          isNull(aforceIntakeLogs.correctsIntakeId),
        ))
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
          /** The HydroState model that produced this score. NULL on rows
           *  written before the column existed — "not recorded", which is
           *  weaker than any known version and never coerced to one. A v0
           *  score and a v1 score are different measurements sharing a unit;
           *  the client decides comparability from this field. */
          modelVersion: string | null;
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
        modelVersion: s.hydroStateModelVersion,
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
    logger.error({ err: serializeError(err) }, "GET /aforce/journal/timeline failed");
    return res.status(400).json({ error: "timeline_failed" });
  }
});

router.get("/journal/rollups", async (req, res) => {
  try {
    const { days, dense } = rollupsQuery.parse(req.query);
    const userId = resolveUserId(req);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [snapshots, intakes, correctionRows, stateRows] = await Promise.all([
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
        // Correction rows are §10 bookkeeping, never intake entries.
        .where(and(
          eq(aforceIntakeLogs.userId, userId),
          gte(aforceIntakeLogs.loggedAt, since),
          isNull(aforceIntakeLogs.correctsIntakeId),
        ))
        .orderBy(asc(aforceIntakeLogs.loggedAt)),
          db
        .select({ corrected: aforceIntakeLogs.correctsIntakeId })
        .from(aforceIntakeLogs)
        .where(and(eq(aforceIntakeLogs.userId, userId), isNotNull(aforceIntakeLogs.correctsIntakeId))),
      // The member's own history stamp, for the densification floor below.
      // NULL (or no row at all) means "seeded before the column existed" and
      // falls back to the repository-owned epoch — never to an inference from
      // the journal data itself, which a sparse wire makes appear late.
      db
        .select({ historyStartAt: aforceUserState.historyStartAt })
        .from(aforceUserState)
        .where(eq(aforceUserState.userId, userId))
        .limit(1),
]);

    /* ── DENSE EFFECTIVE RANGE — the canonical rollup contract ───────────────
     *
     * `GET /aforce/journal/rollups` used to return only the days it had data
     * for. Every consumer then had to independently decide what an absent
     * day meant, and several got it wrong — a missing observation read as a
     * comparability event, a compliance failure, a broken streak, or (via
     * the sentinel `avgScore: 0` this route already emits for a real "intake
     * logged, no snapshot captured" day) a measured zero.
     *
     * A prior attempt densified this route and reverted it because six live
     * consumers read `rollups.length` as an observation count. This time
     * every one of them is migrated onto `observedRows`/`observedCount`
     * (utils/scoring/boundarySeries.ts) in the SAME change.
     *
     * The aggregation itself lives in `buildJournalRollupsResponse`
     * (lib/journalRollupsAggregation.ts) — this route's own suites are
     * DB-gated and skipped locally, so anything left inline here could only
     * be proven by scanning source text. Extracting it means the real logic
     * gets full execution tests, and this handler's only remaining job —
     * fetch, call, respond — is honestly thin enough for a source-level
     * wiring law to mean something.
     */
    return res.json(
      buildJournalRollupsResponse({
        snapshots,
        intakes,
        correctionRows,
        historyStartAt: stateRows[0]?.historyStartAt ?? null,
        days,
        dense: dense === 1,
        now: new Date(),
      }),
    );
  } catch (err) {
    logger.error({ err: serializeError(err) }, "GET /aforce/journal/rollups failed");
    return res.status(400).json({ error: "rollups_failed" });
  }
});

export default router;
