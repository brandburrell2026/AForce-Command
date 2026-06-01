/**
 * Adaptive reminder policy — Priority #5 (Adaptive Reminder Refinements).
 *
 * The "underneath" half: a PURE, deterministic decision engine. Given a
 * reminder level and a snapshot of context (sleep window, recent
 * workout, heat, goal progress, how often reminders are ignored, and how
 * many have already fired today) it returns whether the next reminder
 * should fire and the effective frequency budget.
 *
 * No RN, no storage, no Date.now — every input is passed in, so it is
 * fully unit-testable. The reminder surfaces consult this before showing
 * or scheduling; analytics has no UI and neither does this.
 *
 * Levels set the BASELINE aggressiveness; the rules adapt it; the hard
 * guardrails bound it so notification fatigue is impossible regardless
 * of level or context.
 */

export type ReminderLevel = 'minimal' | 'standard' | 'aggressive';

export interface ReminderLevelConfig {
  /** Baseline reminders allowed per day at this level. */
  maxPerDay: number;
  /** Baseline minimum minutes between reminders. */
  minGapMinutes: number;
  /** Baseline aggressiveness, 0..1. */
  baseIntensity: number;
}

export const REMINDER_LEVELS: Record<ReminderLevel, ReminderLevelConfig> = {
  minimal: { maxPerDay: 1, minGapMinutes: 360, baseIntensity: 0.25 },
  standard: { maxPerDay: 3, minGapMinutes: 180, baseIntensity: 0.5 },
  aggressive: { maxPerDay: 5, minGapMinutes: 120, baseIntensity: 0.85 },
};

// ── Hard guardrails (level- and context-independent) ──────────────────
/** Never schedule reminders closer than this — the anti-fatigue floor. */
export const GUARDRAIL_MIN_GAP_FLOOR = 60;
/** Absolute ceiling on reminders per day, no matter how aggressive. */
export const GUARDRAIL_MAX_PER_DAY_CEIL = 6;

// ── Default quiet hours (local minute-of-day) ─────────────────────────
export const DEFAULT_SLEEP_START_MIN = 22 * 60; // 22:00
export const DEFAULT_SLEEP_END_MIN = 7 * 60; // 07:00

// ── Rule thresholds ───────────────────────────────────────────────────
const WORKOUT_MIN_MINUTES = 20;
const HEAT_INDEX_C = 30;
const IGNORED_RATE = 0.34;
/** Don't treat a tiny sample as "repeatedly ignored". */
const IGNORED_MIN_SAMPLE = 3;

export interface ReminderContext {
  level: ReminderLevel;
  /** Local minute-of-day [0,1439] for the sleep-window check. */
  nowMinuteOfDay: number;
  sleepStartMin?: number;
  sleepEndMin?: number;
  /** Analytics reminder response rate [0,1], or null when unknown. */
  responseRate: number | null;
  /** Reminders shown so far — sample-size guard for responseRate. */
  remindersShown: number;
  /** Active workout / exercise minutes today. */
  workoutMinutesToday: number;
  /** Apparent temperature (heat index) in °C, or null when unknown. */
  heatIndexC: number | null;
  /** Hydration goal progress: consumed / target. >= 1 means met. */
  goalProgress: number;
  /** Reminders already delivered today (daily-cap guardrail). */
  remindersSentToday: number;
  /** Minutes since last reminder, or null if none yet (min-gap guardrail). */
  minutesSinceLastReminder: number | null;
}

export type ReminderReason =
  | 'allowed'
  | 'sleep'
  | 'goal_complete'
  | 'daily_cap'
  | 'min_gap';

export interface ReminderDecision {
  allow: boolean;
  reason: ReminderReason;
  level: ReminderLevel;
  /** Adapted aggressiveness, 0..1. */
  intensity: number;
  /** Effective per-day budget after adaptation + guardrail ceiling. */
  effectiveMaxPerDay: number;
  /** Effective spacing after adaptation + guardrail floor. */
  minGapMinutes: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** True when `min` falls inside [start, end), handling midnight wrap. */
function inSleepWindow(min: number, start: number, end: number): boolean {
  if (start === end) return false;
  if (start < end) return min >= start && min < end;
  return min >= start || min < end; // wraps past midnight
}

/**
 * Simplified apparent-temperature: humidity only meaningfully raises the
 * felt temperature once it's already warm. Monotonic and deterministic;
 * good enough to drive a "is it hot" decision without a full NWS formula.
 */
export function computeHeatIndexC(
  tempC: number | null,
  humidity: number | null,
): number | null {
  if (tempC == null) return null;
  if (humidity == null || tempC < 26) return tempC;
  const bump = Math.max(0, (humidity - 40) / 100) * (tempC - 26) * 0.4;
  return tempC + bump;
}

export function evaluateReminderPolicy(ctx: ReminderContext): ReminderDecision {
  const base = REMINDER_LEVELS[ctx.level];
  const sleepStart = ctx.sleepStartMin ?? DEFAULT_SLEEP_START_MIN;
  const sleepEnd = ctx.sleepEndMin ?? DEFAULT_SLEEP_END_MIN;

  const recentWorkout = ctx.workoutMinutesToday >= WORKOUT_MIN_MINUTES;
  const heat = ctx.heatIndexC != null && ctx.heatIndexC >= HEAT_INDEX_C;
  const goalMet = ctx.goalProgress >= 1;
  const repeatedlyIgnored =
    ctx.responseRate != null &&
    ctx.remindersShown >= IGNORED_MIN_SAMPLE &&
    ctx.responseRate < IGNORED_RATE;

  // ── Adapt intensity from the rules ─────────────────────────────────
  let intensity = base.baseIntensity;
  if (repeatedlyIgnored) intensity *= 0.5; // reduce when ignored
  if (recentWorkout) intensity += 0.2; // increase after workouts
  if (heat) intensity += 0.2; // increase during heat
  if (goalMet) intensity *= 0.4; // reduce after goal met
  intensity = clamp(intensity, 0, 1);

  // Translate intensity into a frequency budget, then clamp to the hard
  // guardrails so fatigue is impossible at any level / context combo.
  const effectiveMaxPerDay = Math.round(
    clamp(
      base.maxPerDay * (0.5 + intensity),
      1,
      Math.min(GUARDRAIL_MAX_PER_DAY_CEIL, base.maxPerDay + 2),
    ),
  );
  const minGapMinutes = Math.max(
    GUARDRAIL_MIN_GAP_FLOOR,
    Math.round(base.minGapMinutes * (1.5 - intensity)),
  );

  const decide = (allow: boolean, reason: ReminderReason): ReminderDecision => ({
    allow,
    reason,
    level: ctx.level,
    intensity,
    effectiveMaxPerDay,
    minGapMinutes,
  });

  // ── Suppression, hard → soft ───────────────────────────────────────
  // 1. Sleep — always suppressed overnight.
  if (inSleepWindow(ctx.nowMinuteOfDay, sleepStart, sleepEnd)) {
    return decide(false, 'sleep');
  }

  // Workout / heat = elevated dehydration risk: override the softer
  // goal-complete suppression (still bounded by cap + gap below).
  const riskOverride = recentWorkout || heat;

  // 2. Goal already met and no active risk — favor fewer reminders.
  if (goalMet && !riskOverride) return decide(false, 'goal_complete');

  // 3. Daily cap — anti-fatigue. (When ignored, the reduced cap above
  //    is what throttles "repeatedly ignored" users.)
  if (ctx.remindersSentToday >= effectiveMaxPerDay) {
    return decide(false, 'daily_cap');
  }

  // 4. Minimum gap — frequency cap.
  if (
    ctx.minutesSinceLastReminder != null &&
    ctx.minutesSinceLastReminder < minGapMinutes
  ) {
    return decide(false, 'min_gap');
  }

  return decide(true, 'allowed');
}
