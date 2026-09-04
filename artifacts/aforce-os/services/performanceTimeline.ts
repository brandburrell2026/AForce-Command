/**
 * Performance Timeline derivations.
 *
 * Pure, dependency-free helpers that turn the existing JournalRollup
 * stream into:
 *
 *   1. SectionSummary[] — one summary tile per Timeline section
 *      (Recovery / Heat / Hydration / Corrections / Territory Movement
 *      / Streaks). Each summary aggregates the visible rollup window
 *      into a single primary metric for the section tile.
 *
 *   2. WinMoment[] — short, achievement-style sentences derived from
 *      day-over-day deltas on the rollup stream (e.g. "Recovery
 *      restored after 3 corrections", "4-day streak active").
 *
 * Both functions are total: empty input is safe and returns sensible
 * defaults. No I/O, no React imports — these are unit-tested directly.
 *
 * Rollups come in chronological order (oldest → newest), matching
 * what `/api/aforce/journal/rollups` returns.
 */

import type { JournalRollup } from '@/types';
import { observedRows } from '@/utils/scoring/boundarySeries';

/** Honest-data glyph for a reading nobody took (app-wide convention). */
const EM_DASH = '—';

export type SectionKey =
  | 'recovery'
  | 'heat'
  | 'hydration'
  | 'corrections'
  | 'territory'
  | 'streaks';

export interface SectionSummary {
  key: SectionKey;
  label: string;
  value: string;
  hint: string;
}

export type WinMomentIcon =
  | 'zap'
  | 'heart'
  | 'trending-up'
  | 'award'
  | 'check-circle';

export interface WinMoment {
  id: string;
  icon: WinMomentIcon;
  text: string;
}

// ────────────────────────────────────────────────────────────────────
// Section summary
// ────────────────────────────────────────────────────────────────────

/**
 * Build the 6 always-present section tiles from a rollup window.
 *
 * Ordering matches the user-facing spec: Recovery, Heat, Hydration,
 * Corrections, Territory Movement, Streaks.
 */
export function deriveSectionSummary(
  rollups: JournalRollup[],
  complianceStreak: number,
): SectionSummary[] {
  // The WINDOW width — every calendar day the range covers. Correct as the
  // label on a SUM (the hydration tile totals ounces across the whole window,
  // and an unobserved day contributes 0, which is true). It is NOT a count of
  // measurements: `observed.length` below answers that.
  const days = rollups.length;

  // RECOVERY IS AN AVERAGE, so its denominator must be OBSERVED days. The
  // sums below (heat / hydration / corrections / territory) are safe against
  // the dense wire by construction — an unobserved day contributes 0 to a
  // total, which is correct — but averaging over `rollups.length` divides real
  // band-time by the width of the eligible window, diluting a member's
  // "time in green" with days nothing was measured.
  const observed = observedRows(rollups);
  // NULL when nothing was measured. "0% — Time in green" is a claim about the
  // member's physiology, and a window with no observations cannot support it:
  // the honest answer is that we do not know, not that they spent none of
  // their time in the green. The SUM tiles below are different — 0 oz
  // consumed is TRUE — which is why only this one withholds.
  const recoveryPct: number | null = observed.length === 0
    ? null
    : Math.round(
        observed.reduce(
          (acc, r) => acc + (r.pctTimeBalanced + r.pctTimePeak),
          0,
        ) / observed.length,
      );

  // Heat: total sodium lost (mg) over the window. Sodium loss is the
  // canonical proxy for heat-driven sweat output in the engine.
  const heatMg = Math.round(
    rollups.reduce((acc, r) => acc + r.endSodiumLost, 0),
  );

  // Hydration: total oz consumed over the window.
  const hydrationOz = Math.round(
    rollups.reduce((acc, r) => acc + r.endOzConsumed, 0),
  );

  // Corrections: total intake events (each logged drink is a
  // corrective action against the depletion curve).
  const corrections = rollups.reduce((acc, r) => acc + r.intakeCount, 0);

  // Territory Movement: total autopilot + social sessions. These are
  // the in-app moments where the user actively moved through a
  // protocol surface (autopilot run, social session), which we treat
  // as the closest available proxy for territory engagement.
  const territory = rollups.reduce(
    (acc, r) => acc + r.autopilotSessions + r.socialSessions,
    0,
  );

  return [
    {
      key: 'recovery',
      label: 'Recovery',
      value: recoveryPct == null ? EM_DASH : `${recoveryPct}%`,
      hint: 'Time in green',
    },
    {
      key: 'heat',
      label: 'Heat',
      value: formatMg(heatMg),
      hint: 'Sodium lost',
    },
    {
      key: 'hydration',
      label: 'Hydration',
      value: `${hydrationOz} oz`,
      hint: `${days}d total`,
    },
    {
      key: 'corrections',
      label: 'Corrections',
      value: `${corrections}`,
      hint: 'Intake events',
    },
    {
      key: 'territory',
      label: 'Territory',
      value: `${territory}`,
      hint: 'Sessions',
    },
    {
      key: 'streaks',
      label: 'Streaks',
      value: `${complianceStreak}d`,
      hint: complianceStreak > 0 ? 'Active' : 'Start today',
    },
  ];
}

function formatMg(mg: number): string {
  if (mg >= 1000) {
    return `${(mg / 1000).toFixed(1)}g`;
  }
  return `${mg}mg`;
}

/** Whole-day UTC difference between two `YYYY-MM-DD` keys, or null if either
 *  is not a valid calendar date. */
function isPreviousCalendarDay(earlier: string, later: string): boolean {
  const parse = (v: string): number | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const t = Date.UTC(y, mo - 1, d);
    const back = new Date(t);
    return back.getUTCFullYear() === y && back.getUTCMonth() === mo - 1 && back.getUTCDate() === d
      ? t
      : null;
  };
  const a = parse(earlier);
  const b = parse(later);
  if (a == null || b == null) return false;
  return b - a === 24 * 60 * 60 * 1000;
}

// ────────────────────────────────────────────────────────────────────
// Win moments
// ────────────────────────────────────────────────────────────────────

/**
 * Derive achievement-style moments from the rollup stream.
 *
 * Returns at most 5 moments, ranked by recency / impact. Empty input
 * returns []. All comparisons are between the latest day (today) and
 * the prior day in the window.
 *
 * Inputs are intentionally narrow — this helper is pure so it can be
 * unit-tested without any React / store dependencies.
 */
export function deriveWinMoments(
  rollups: JournalRollup[],
  complianceStreak: number,
): WinMoment[] {
  const moments: WinMoment[] = [];
  // A win is a claim about a MEASURED change, so both sides of every
  // day-over-day comparison below must be observed days — and they must be
  // the two most recent OBSERVED days, not merely the last two rows.
  //
  // This was already wrong before the wire densified: a day with a logged
  // intake and no captured snapshot has always shipped with the sentinel
  // `endDeficitPct: 0`, so "Stabilized faster than yesterday" (a ≥5-point
  // deficit drop) could fire on a day HydroState never observed — awarding an
  // achievement for a measurement that does not exist. Densification would
  // have made it routine rather than merely possible.
  const observed = observedRows(rollups);
  const last = observed[observed.length - 1];
  const prevObserved = observed.length >= 2 ? observed[observed.length - 2] : null;
  // ...AND THEY MUST BE CALENDAR-ADJACENT. Every moment below is phrased as a
  // day-over-day claim — "Recovery restored", "Heat recovery improved",
  // "Territory momentum increased", "Stabilized faster than yesterday". Once
  // unobserved days are filtered out, the two most recent OBSERVED days can
  // be a week apart, and comparing them still produced copy that says
  // "yesterday". Adjacency is what makes the sentence true, so it is a
  // precondition rather than a detail.
  const adjacent = prevObserved != null && isPreviousCalendarDay(prevObserved.date, last!.date);

  // ...AND THE PAIR MUST STILL BE CURRENT. Adjacency to EACH OTHER does not
  // make a pair recent: a member who measured Monday and Tuesday and then went
  // quiet was still shown "Stabilized faster than yesterday" on Friday. Before
  // the observed-rows filter above, `last` was necessarily the final row, so
  // this could not happen; filtering is what let the pair drift into the past,
  // and the copy is phrased in the present tense throughout.
  //
  // The dense window always ends at today, so trailing unobserved rows are
  // days since the last sync. ONE is today-not-yet-synced — pending, not
  // absent, the same distinction `classifyStreakEligibility` draws. More than
  // one means the member has been away a full day or longer, and a
  // "yesterday" claim about their last two measured days is stale.
  const trailingUnmeasured = last == null ? 0 : rollups.length - 1 - rollups.lastIndexOf(last);
  const prev = adjacent && trailingUnmeasured <= 1 ? prevObserved : null;

  // 1. Active streak — universal, even on a single day of data.
  if (complianceStreak >= 2) {
    moments.push({
      id: 'streak',
      icon: 'award',
      text: `${complianceStreak}-day streak active`,
    });
  }

  // The remaining moments need a day-over-day delta.
  if (last && prev) {
    // 2. Recovery restored after corrections — today's avg recovered
    //    by ≥10pts and the user logged ≥3 intakes (corrections).
    const recoveryGain = last.avgScore - prev.avgScore;
    if (recoveryGain >= 10 && last.intakeCount >= 3) {
      moments.push({
        id: 'recovery-restored',
        icon: 'heart',
        text: `Recovery restored after ${last.intakeCount} corrections`,
      });
    }

    // 3. Heat recovery improved — sodium delivered today is higher
    //    than yesterday while losses stayed similar (within 15%).
    //    Translation: you out-paced the sweat load.
    const sodiumInGain = last.endSodiumDelivered - prev.endSodiumDelivered;
    const sodiumLossDelta = Math.abs(last.endSodiumLost - prev.endSodiumLost);
    const sodiumLossBaseline = Math.max(prev.endSodiumLost, 1);
    if (
      sodiumInGain > 200 &&
      sodiumLossDelta / sodiumLossBaseline <= 0.15
    ) {
      moments.push({
        id: 'heat-recovery',
        icon: 'zap',
        text: 'Heat recovery improved',
      });
    }

    // 4. Territory momentum — more sessions today than yesterday.
    const territoryToday = last.autopilotSessions + last.socialSessions;
    const territoryPrev = prev.autopilotSessions + prev.socialSessions;
    if (territoryToday > territoryPrev && territoryToday >= 1) {
      moments.push({
        id: 'territory-momentum',
        icon: 'trending-up',
        text: 'Territory momentum increased',
      });
    }

    // 5. Stabilized faster — deficit % shrank by ≥5 points.
    const deficitDrop = prev.endDeficitPct - last.endDeficitPct;
    if (deficitDrop >= 5) {
      moments.push({
        id: 'stabilized',
        icon: 'check-circle',
        text: 'Stabilized faster than yesterday',
      });
    }
  }

  return moments.slice(0, 5);
}
