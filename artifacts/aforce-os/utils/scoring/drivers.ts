/**
 * Score Drivers — the plain-language explainability layer.
 *
 * Rolls the detailed `ScoreContribution[]` (produced by `buildBreakdown`)
 * up into the four simple, trust-building drivers the user actually
 * thinks in: Water, Sleep, Heat, Recovery. Each driver carries a single
 * signed number and ONE plain sentence — no formulas, no clinical terms
 * (no "HRV", "urine signal", "decay", "deficit", "output stress").
 *
 * This is a pure, dependency-free helper so it unit-tests in plain
 * vitest and can be reused anywhere a friendly score explanation is
 * needed. It never changes the score — it only re-describes the same
 * contributions in human words.
 */
import type { ScoreContribution } from '../../types';

export type ScoreDriverId = 'water' | 'sleep' | 'heat' | 'recovery';

export interface ScoreDriver {
  id: ScoreDriverId;
  /** Display name: 'Water' | 'Sleep' | 'Heat' | 'Recovery'. */
  label: string;
  /** Signed, rounded sum of the contributions that roll up into this driver. */
  delta: number;
  direction: 'positive' | 'negative' | 'neutral';
  /** One plain sentence, jargon-free. */
  text: string;
}

/** Stable display order — mirrors how the spec lists the drivers. */
export const SCORE_DRIVER_ORDER: readonly ScoreDriverId[] = [
  'water',
  'sleep',
  'heat',
  'recovery',
] as const;

const DRIVER_LABEL: Record<ScoreDriverId, string> = {
  water: 'Water',
  sleep: 'Sleep',
  heat: 'Heat',
  recovery: 'Recovery',
};

/**
 * Which detailed contribution ids roll up into which friendly driver.
 *
 * - water    → what you drank and how recently (intake, protocol, time
 *              since last drink, hydration signal)
 * - sleep    → overnight carryover + connected rest/recovery signals
 * - heat     → environment + effort load (heat, sweat, activity)
 * - recovery → behaviour that restores you (recent intake momentum,
 *              follow-through, consistency, how you're feeling)
 *
 * `social_intake` is intentionally omitted from the simple summary — it
 * stays visible in the detailed breakdown below and only appears when a
 * social session is active.
 */
const DRIVER_MEMBERS: Record<ScoreDriverId, readonly string[]> = {
  water: ['base', 'aforce_bonus', 'recency', 'urine'],
  sleep: ['sleep', 'health_signals'],
  heat: ['context', 'output'],
  recovery: ['recovery', 'confirmation', 'consistency', 'symptom'],
};

const DRIVER_COPY: Record<
  ScoreDriverId,
  Record<'positive' | 'negative' | 'neutral', string>
> = {
  water: {
    positive: 'Your water intake is lifting your score.',
    negative: "You're due for more water.",
    neutral: 'Water is steady for now.',
  },
  // Build-50 Gate 2, item 5: this pill folds `health_signals` in with
  // `sleep` (see DRIVER_MEMBERS above) — `health_signals` is the combined
  // HRV / sleep / readiness / recovery% / stress delta from ANY connected
  // platform (`computeRecoverySignal`), so a user whose only contributing
  // field is HRV or Garmin stress (sleep genuinely absent) used to see a
  // sleep-specific sentence ("Short sleep is weighing on your score.")
  // attributing the movement to rest quality that was never measured.
  // Copy widened to "sleep and recovery signals" so it stays true
  // regardless of which member of the pill actually moved.
  sleep: {
    positive: 'Sleep and recovery signals are helping your score.',
    negative: 'Sleep and recovery signals are weighing on your score.',
    neutral: 'Sleep and recovery are steady for now.',
  },
  heat: {
    positive: 'Conditions are comfortable right now.',
    negative: 'Heat and effort are draining you faster.',
    neutral: 'Conditions are neutral right now.',
  },
  recovery: {
    positive: 'Staying consistent is paying off.',
    negative: 'Your body could use some recovery.',
    neutral: 'Recovery is steady for now.',
  },
};

function directionOf(delta: number): 'positive' | 'negative' | 'neutral' {
  if (delta > 0) return 'positive';
  if (delta < 0) return 'negative';
  return 'neutral';
}

/**
 * Roll the detailed contributions up into the four simple drivers.
 *
 * Always returns the four drivers in `SCORE_DRIVER_ORDER` so the UI is
 * predictable and the user sees a complete, honest picture — including
 * drivers currently at zero (shown as neutral). Contribution ids that
 * don't map to any driver (e.g. `social_intake`) are simply skipped.
 */
export function buildScoreDrivers(
  contributions: readonly ScoreContribution[],
): ScoreDriver[] {
  const totals: Record<ScoreDriverId, number> = {
    water: 0,
    sleep: 0,
    heat: 0,
    recovery: 0,
  };

  for (const id of SCORE_DRIVER_ORDER) {
    const members = DRIVER_MEMBERS[id];
    for (const c of contributions) {
      if (members.includes(c.id)) {
        totals[id] += c.delta;
      }
    }
  }

  return SCORE_DRIVER_ORDER.map((id) => {
    const delta = Math.round(totals[id]);
    const direction = directionOf(delta);
    return {
      id,
      label: DRIVER_LABEL[id],
      delta,
      direction,
      text: DRIVER_COPY[id][direction],
    };
  });
}

/** Format a driver delta the way the spec writes it: +8, -3, +0. */
export function formatDriverDelta(delta: number): string {
  const n = Math.round(delta);
  return n >= 0 ? `+${n}` : `${n}`;
}
