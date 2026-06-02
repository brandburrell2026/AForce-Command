/**
 * Daily Wins Engine — Priority #3.
 *
 * Positive-reinforcement only. This pure helper turns the user's REAL
 * state into short, encouraging "wins" — never guilt, shame, or
 * penalty. It surfaces small wins often: lower-priority wins (a single
 * water cycle, an early streak) fire on almost any forward motion, so
 * there is nearly always something kind to show, while the home surface
 * renders only the single most meaningful win at a time (one line max).
 *
 * Retention over gamification: the copy reinforces behaviour, it does
 * not rank users or invite competition.
 *
 * The helper is intentionally pure — no Date, no store, no flags. The
 * caller (DailyWinBanner) reads the live slices, decides correction
 * freshness, and passes a flat snapshot in. That keeps win logic fully
 * unit-testable and free of side effects.
 */

export type DailyWinId =
  | 'seven_day_streak'
  | 'three_day_streak'
  | 'daily_goal'
  | 'stabilized_faster'
  | 'recovery_trend'
  | 'first_correction'
  | 'hydration_consistency'
  | 'water_cycle';

export interface DailyWin {
  id: DailyWinId;
  /** Short, positive, single-line reinforcement. No guilt/shame. */
  text: string;
  /** Higher = more meaningful. The home surface shows the top win only. */
  priority: number;
}

export interface DailyWinInput {
  /** Consecutive compliant days. */
  complianceStreak: number;
  /** Water-cycle units logged today. */
  unitsConsumedToday: number;
  /** Unit target for the day. */
  dailyTarget: number;
  /** Ounces logged today. */
  ozConsumedToday: number;
  /** Ounce target for the day. */
  ozTarget: number;
  /**
   * True when a post-recheck correction was just completed (a fresh,
   * positive ±3 confirmation). Freshness is judged by the caller so
   * this helper stays free of `Date`.
   */
  correctionCompleted: boolean;
  /** Recovery direction from the recovery engine. */
  recoveryTrend: 'rising' | 'stable' | 'declining';
  /** Recovery capacity 0-100 from the recovery engine. */
  recovery: number;
}

/**
 * Build every win the current state earns, highest-priority first.
 * Always returns positive items only; an empty array simply means
 * "nothing to celebrate yet" — never a negative message.
 */
export function buildDailyWins(input: DailyWinInput): DailyWin[] {
  const wins: DailyWin[] = [];
  const streak = input.complianceStreak;

  if (streak >= 7) {
    wins.push({
      id: 'seven_day_streak',
      priority: 100,
      text: '7-day streak — you’re locked in.',
    });
  } else if (streak >= 3) {
    wins.push({
      id: 'three_day_streak',
      priority: 90,
      text: 'Three days strong — momentum’s building.',
    });
  } else if (streak >= 1) {
    wins.push({
      id: 'hydration_consistency',
      priority: 40,
      text: 'Your hydration’s getting more consistent.',
    });
  }

  if (input.dailyTarget > 0 && input.unitsConsumedToday >= input.dailyTarget) {
    wins.push({
      id: 'daily_goal',
      priority: 80,
      text: 'Daily goal done — great work today.',
    });
  }

  if (input.recoveryTrend === 'rising') {
    if (input.recovery >= 80) {
      wins.push({
        id: 'stabilized_faster',
        priority: 70,
        text: 'You stabilized fast today — strong.',
      });
    } else {
      wins.push({
        id: 'recovery_trend',
        priority: 65,
        text: 'Recovery’s trending up — keep it going.',
      });
    }
  }

  if (input.correctionCompleted) {
    wins.push({
      id: 'first_correction',
      priority: 60,
      text: 'Correction locked in — that’s the work.',
    });
  }

  if (input.unitsConsumedToday >= 1) {
    wins.push({
      id: 'water_cycle',
      priority: 30,
      text: 'Water cycle complete — nice rhythm.',
    });
  }

  return wins.sort((a, b) => b.priority - a.priority);
}

/**
 * The single most meaningful win to surface right now, or null when
 * there is nothing to celebrate yet (the banner then renders nothing —
 * silence, never a downer).
 */
export function topDailyWin(input: DailyWinInput): DailyWin | null {
  const wins = buildDailyWins(input);
  return wins.length > 0 ? wins[0] : null;
}
