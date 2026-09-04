/**
 * THE `/journal/rollups` AGGREGATION PIPELINE, extracted so it is EXECUTABLE.
 *
 * WHY THIS FILE EXISTS. This repo's route-level suites are DB-gated and
 * skipped locally (see `correctionReadIntegrity.test.ts`'s own header), so
 * anything living inline in the Express handler could previously only be
 * asserted by scanning its source text — and a source scan survives any
 * mutation that keeps an identifier and changes what it does. That is
 * precisely how the first densification attempt's "route-wiring" law shipped
 * vacuous: it asserted a `.replace()`-mutated STRING contained the right
 * substrings, which only proves `String.prototype.replace` succeeded.
 *
 * So the aggregation pipeline — day-bucketing, band-time attribution,
 * intake-correction accounting, and densification — is extracted here, taking
 * already-fetched DB rows and returning the exact `{ rollups, days }` shape
 * the route responds with. The route's remaining job is fetch → call this →
 * `res.json(...)`, which makes "does the route actually densify" a THIN,
 * honest wiring check, backed by full execution tests of the real logic here
 * — not a DB-gated integration test, and not a string-substitution proof.
 */
import {
  effectiveRangeKeys,
  densifyRollups,
  type DenseRollupRow,
  type EffectiveRangeInput,
} from "./journalDenseRange";

export interface RollupSnapshotRow {
  capturedAt: Date;
  score: number;
  level: string;
  ozConsumedToday: number;
  aforceUnitsToday: number;
  unitsConsumedToday: number;
  sodiumDeliveredMg: number;
  sodiumLostMg: number;
  deficitPct: number;
  autopilotActive: boolean;
  socialActive: boolean;
  hydroStateModelVersion: string | null;
}

export interface RollupIntakeRow {
  id: number;
  loggedAt: Date;
}

export interface RollupCorrectionRow {
  corrected: number | null;
}

export interface BuildJournalRollupsInput {
  snapshots: readonly RollupSnapshotRow[];
  intakes: readonly RollupIntakeRow[];
  correctionRows: readonly RollupCorrectionRow[];
  historyStartAt: Date | null;
  days: number;
  /** Injected so this is deterministic under test — the route passes `new Date()`. */
  now: Date;
}

export interface BuildJournalRollupsResult {
  rollups: DenseRollupRow[];
  days: number;
}

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
  /** Every distinct HydroState model version contributing to this day.
   *  A day can straddle a model boundary; one field would have to pick a
   *  winner and silently hide that the day is mixed. Insertion-ordered. */
  modelVersions: Set<string | null>;
}

/**
 * Build the `{ rollups, days }` response from already-fetched DB rows.
 *
 * Pure and total: no I/O, no clock reads (`now` is a parameter), so every
 * branch — the two aggregation passes, band-time attribution, correction
 * accounting, and the dense effective window — is directly executable in a
 * unit test with realistic row shapes.
 */
export function buildJournalRollupsResponse(
  input: BuildJournalRollupsInput,
): BuildJournalRollupsResult {
  const { snapshots, intakes, correctionRows, historyStartAt, days, now } = input;

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
        modelVersions: new Set<string | null>(),
      };
      acc.set(date, d);
    }
    return d;
  }

  /**
   * Attribute a half-open interval `[fromMs, toMs)` to a single level,
   * splitting at UTC day boundaries so each calendar day gets the portion
   * that fell within it. Caller is responsible for capping the interval
   * length (gap policy).
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

  // First pass: per-day stats (avg / min / max / end-of-day totals, session
  // edge counts).
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
    d.modelVersions.add(s.hydroStateModelVersion);
  }

  // Second pass: continuous band-time attribution across the whole window.
  // Each segment between consecutive samples is held at the previous
  // sample's level, capped at 1 h (to avoid attributing overnight idle time
  // as "still in this band"), and split at UTC day boundaries so
  // single-snapshot days still get their share.
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
    const tailEnd = Math.min(now.getTime(), lastTs + GAP_CAP_MS);
    attributeInterval(lastTs, tailEnd, last.level);
  }

  // intakeCount means what COUNTED: a corrected original consumed nothing
  // (undo must not leave the day's count inflated).
  const correctedIds = new Set(correctionRows.map((r) => r.corrected));
  for (const i of intakes) {
    if (correctedIds.has(i.id)) continue;
    const date = dayKey(i.loggedAt);
    const d = ensure(date);
    d.intakeCount += 1;
  }

  const rangeInput: EffectiveRangeInput = { now, days, historyStartAt };
  const rangeKeys = effectiveRangeKeys(rangeInput);

  const measured = new Map(
    Array.from(acc.values()).map((d): [string, DenseRollupRow] => {
      const totalBand = d.bandMillis.PEAK + d.bandMillis.BALANCED + d.bandMillis.RECOVERING + d.bandMillis.DEPLETED;
      const pct = (n: number) => (totalBand > 0 ? Math.round((n / totalBand) * 100) : 0);
      return [d.date, {
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
        // Aggregates over a day that spans a model boundary are not
        // comparable to single-version days; the consumer needs to see that
        // rather than infer it.
        modelVersions: [...d.modelVersions],
      }];
    }),
  );

  // The array IS the effective window: one row per calendar day, real data
  // where it exists, an honest empty day (never fabricated) everywhere else.
  const rollups = densifyRollups(measured, rangeKeys);
  return { rollups, days };
}
