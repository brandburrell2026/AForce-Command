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
  const days = rollups.length;
  const safeDays = days || 1;

  // Recovery: average % of time spent in BALANCED or PEAK bands
  // across the window. This is the "in-the-green" share of the user's
  // day-to-day — the headline recovery metric.
  const recoveryPct = Math.round(
    rollups.reduce(
      (acc, r) => acc + (r.pctTimeBalanced + r.pctTimePeak),
      0,
    ) / safeDays,
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
      value: `${recoveryPct}%`,
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
  const last = rollups[rollups.length - 1];
  const prev = rollups.length >= 2 ? rollups[rollups.length - 2] : null;

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
