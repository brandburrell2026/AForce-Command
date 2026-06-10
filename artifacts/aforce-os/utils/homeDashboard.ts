/**
 * homeDashboard — pure, dependency-free derivations that power the
 * redesigned Home dashboard surfaces (Daily Ritual rail, Today's
 * Protocol, Athlete Mode progress, hydration ring + readiness label).
 *
 * SCORE-PROTECTION / NO-FABRICATION CONTRACT
 * ------------------------------------------
 * Everything here is a *read-only projection* of state the user already
 * produced through completed behaviour:
 *   - intake logged today  → `unitsConsumedToday`
 *   - their target         → `dailyTarget`
 *   - engine readiness     → `performanceLevel`
 *   - real compliance run  → `streakDays` (userState.complianceStreak)
 * These functions NEVER award score, never invent progress, and never
 * pre-illuminate a step the user hasn't actually completed. A ritual /
 * protocol step is "complete" only because the underlying behaviour is
 * already on record.
 */

export type PerformanceLevel = 'PEAK' | 'BALANCED' | 'RECOVERING' | 'DEPLETED';

export interface HydrationInputs {
  /** Servings logged so far today (completed intake only). */
  unitsConsumedToday: number;
  /** Personalised daily target in servings. */
  dailyTarget: number;
  /** Engine-computed readiness band. */
  performanceLevel: PerformanceLevel;
}

export type RitualStepId = 'pause' | 'hydrate' | 'lock_in' | 'perform';

export interface RitualStepView {
  id: RitualStepId;
  label: string;
  /** Verb-style caption shown under the step label. */
  caption: string;
  /** True only when the underlying behaviour is already on record. */
  complete: boolean;
  /** The first not-yet-complete step — the user's current focus. */
  active: boolean;
}

const RITUAL_LABELS: Record<RitualStepId, { label: string; caption: string }> = {
  pause: { label: 'PAUSE', caption: 'Check your signal' },
  hydrate: { label: 'HYDRATE', caption: 'Start with water' },
  lock_in: { label: 'LOCK IN', caption: 'Hold the rhythm' },
  perform: { label: 'PERFORM', caption: 'Ready to go' },
};

function safeTarget(dailyTarget: number): number {
  return Math.max(1, Math.floor(dailyTarget) || 1);
}

/**
 * The Daily Ritual rail: PAUSE → HYDRATE → LOCK IN → PERFORM. Each
 * stage reflects a strictly escalating amount of *completed* hydration
 * behaviour, so the rail can only ever light up from real progress:
 *   - PAUSE   : engaged today (any intake on record)
 *   - HYDRATE : at least one full serving logged
 *   - LOCK IN : reached halfway to the daily target
 *   - PERFORM : hit the daily target AND engine reads PEAK / BALANCED
 * `active` marks the first incomplete step (the user's current focus);
 * once everything is complete no step is active.
 */
export function deriveRitualSteps(input: HydrationInputs): RitualStepView[] {
  const units = Math.max(0, input.unitsConsumedToday);
  const target = safeTarget(input.dailyTarget);
  const halfway = Math.ceil(target / 2);
  const ready =
    input.performanceLevel === 'PEAK' || input.performanceLevel === 'BALANCED';

  const completion: Record<RitualStepId, boolean> = {
    pause: units > 0,
    hydrate: units >= 1,
    lock_in: units >= halfway,
    perform: units >= target && ready,
  };

  const order: RitualStepId[] = ['pause', 'hydrate', 'lock_in', 'perform'];
  const firstIncomplete = order.find((id) => !completion[id]);

  return order.map((id) => ({
    id,
    label: RITUAL_LABELS[id].label,
    caption: RITUAL_LABELS[id].caption,
    complete: completion[id],
    active: id === firstIncomplete,
  }));
}

export type ProtocolBlockId = 'morning' | 'midday' | 'evening';

export interface ProtocolBlockView {
  id: ProtocolBlockId;
  period: string;
  label: string;
  /** Driven off real intake progression toward the daily target. */
  complete: boolean;
}

/**
 * Today's Protocol — three time-of-day blocks whose completion mirrors
 * the same intake progression used by the engine's protocol checklist:
 *   - Morning  (Hydration Stick)   : first intake on record
 *   - Midday   (AForce Can)        : halfway to target
 *   - Evening  (Recovery Protocol) : daily target reached
 * No fabrication — completion is a pure function of logged intake.
 */
export function deriveTodaysProtocol(input: {
  unitsConsumedToday: number;
  dailyTarget: number;
}): ProtocolBlockView[] {
  const units = Math.max(0, input.unitsConsumedToday);
  const target = safeTarget(input.dailyTarget);
  const halfway = Math.ceil(target / 2);

  return [
    { id: 'morning', period: 'Morning', label: 'Hydration Stick', complete: units >= 1 },
    { id: 'midday', period: 'Midday', label: 'AForce Can', complete: units >= halfway },
    { id: 'evening', period: 'Evening', label: 'Recovery Protocol', complete: units >= target },
  ];
}

export interface AthleteModeView {
  streakDays: number;
  /** The milestone tier currently being chased. */
  milestoneDays: number;
  /** 0..1 fraction of the way to `milestoneDays`. */
  progress: number;
  /** Whole days left to reach `milestoneDays` (0 once reached). */
  daysRemaining: number;
  /** True once the user has cleared the top tier. */
  achievedTop: boolean;
}

export const ATHLETE_MILESTONE_TIERS = [7, 14, 30, 60, 90] as const;

/**
 * Athlete Mode progress — derived purely from the real compliance
 * streak (userState.complianceStreak) measured against escalating
 * milestone tiers. The active tier is the smallest tier strictly
 * greater than the current streak; once the top tier is cleared the
 * bar is full and `achievedTop` is true. Never fabricates a streak.
 */
export function deriveAthleteMode(
  streakDays: number,
  tiers: readonly number[] = ATHLETE_MILESTONE_TIERS,
): AthleteModeView {
  const streak = Math.max(0, Math.floor(streakDays) || 0);
  const sorted = [...tiers].sort((a, b) => a - b);
  const nextTier = sorted.find((t) => t > streak);

  if (nextTier === undefined) {
    const top = sorted[sorted.length - 1] ?? 0;
    return {
      streakDays: streak,
      milestoneDays: top,
      progress: 1,
      daysRemaining: 0,
      achievedTop: true,
    };
  }

  return {
    streakDays: streak,
    milestoneDays: nextTier,
    progress: Math.min(1, Math.max(0, streak / nextTier)),
    daysRemaining: Math.max(0, nextTier - streak),
    achievedTop: false,
  };
}

/**
 * Hydration completion as an integer percentage (0..100) of the daily
 * target. Caps at 100 so an over-target day doesn't overflow the ring.
 */
export function hydrationPercent(unitsConsumedToday: number, dailyTarget: number): number {
  const units = Math.max(0, unitsConsumedToday);
  const target = safeTarget(dailyTarget);
  return Math.round(Math.min(1, units / target) * 100);
}

const READINESS_LABELS: Record<PerformanceLevel, string> = {
  PEAK: 'READY TO PERFORM',
  BALANCED: 'HOLDING STEADY',
  RECOVERING: 'RECOVER & REBUILD',
  DEPLETED: 'REHYDRATE NOW',
};

/** Short readiness caption shown under the orb's "READINESS SCORE" eyebrow. */
export function readinessLabel(level: PerformanceLevel): string {
  return READINESS_LABELS[level] ?? READINESS_LABELS.BALANCED;
}
