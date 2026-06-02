/**
 * Hidden Recovery Engine — Phase 1.
 *
 * Pure-function derivation of the four Recovery Layer outputs that the
 * existing surfaces (Orb, Coach, Timeline, HydroJournal, Social,
 * Guardian, Clutch) will read from in later phases:
 *
 *   1. recovery     — 0-100 capacity score (what the body can give now)
 *   2. pressure     — 0-100 cumulative load (what the body is carrying)
 *   3. trend        — direction of recovery: 'rising' | 'stable' | 'declining'
 *   4. command      — one short imperative (no explanation, no AI voice)
 *
 * Plus two derived outputs the spec lists as Timeline / Clutch / Phantom
 * inputs:
 *
 *   5. fingerprint  — stable hash of the user's recovery signature
 *                     (climate + activity + sleep + hydration target).
 *                     Phase 1 ships a simple FNV-1a hash; later phases
 *                     can swap in a richer signature.
 *   6. story        — one-sentence narrative the Timeline can attach to
 *                     an entry. Never longer than a single line.
 *
 * The engine is event-driven by definition: it is a pure function of
 * the current store state. The store already broadcasts mutations to
 * subscribers, so consumers simply re-derive on the inputs they care
 * about — no separate scheduler, no live stream.
 *
 * Phase 1 ships the engine + hook ONLY. There are no visible surfaces.
 * The hook is gated on `spec_recovery` (default OFF per the spec:
 * "Build architecture. Do not release. Do not expose.").
 */

import type { ScoreEngineOutput, UserState } from '../types';

export type RecoveryTrend = 'rising' | 'stable' | 'declining';

export interface RecoveryInputs {
  /** Live engine score (0-100) — proxy for current hydration capacity. */
  score: number;
  /** Predicted pts/min decay — higher = body is losing ground. */
  decayPerMinute: number;
  /** Discrete water-cycle count for the day. */
  waterCycles: number;
  /** Urine darkness signal (1 clear → 8 dark). */
  urineSignal: number;
  /** Cumulative environmental + activity heat load (0-100ish). */
  heatLoad: number;
  /** Sustained activity intensity (0-100). */
  activityLevel: number;
  /** Overnight sleep loss in oz (proxy for sleep deficit). */
  overnightLossOz: number;
  /** Logged alcoholic-drink count for the active social session. */
  drinkCount: number;
  /** Compliance streak in days — rewards stable patterns. */
  complianceStreak: number;
  /** Reported energy state. */
  energyState: UserState['energyState'];
}

export interface RecoverySnapshot {
  recovery: number;
  pressure: number;
  trend: RecoveryTrend;
  command: string;
  fingerprint: string;
  story: string;
}

/** Clamp helper — kept private to avoid widening the public API. */
function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * Recovery capacity (0-100). Anchored on the live hydration score and
 * then pulled down by sleep / dark urine / sustained drink load. The
 * intent is "what can this body deliver right now", not "how hydrated
 * is this body" — those overlap heavily but recovery is the broader
 * concept the spec wants Coach + Orb to read.
 */
export function deriveRecovery(i: RecoveryInputs): number {
  const base = i.score;
  const sleepPenalty = i.overnightLossOz > 12 ? 6 : i.overnightLossOz > 6 ? 3 : 0;
  const urinePenalty = i.urineSignal >= 6 ? 8 : i.urineSignal >= 5 ? 4 : 0;
  const drinkPenalty = i.drinkCount >= 3 ? 12 : i.drinkCount >= 1 ? 5 : 0;
  const streakBoost = i.complianceStreak >= 7 ? 4 : i.complianceStreak >= 3 ? 2 : 0;
  return clamp(Math.round(base - sleepPenalty - urinePenalty - drinkPenalty + streakBoost), 0, 100);
}

/**
 * Pressure (0-100). The inverse-but-not-redundant signal: how much
 * load the body is carrying. Heat, activity, and decay all push
 * pressure up; rest and water cycles release it.
 */
export function derivePressure(i: RecoveryInputs): number {
  const heatLoad = clamp(i.heatLoad, 0, 100);
  const activity = clamp(i.activityLevel, 0, 100);
  const decayLoad = clamp(i.decayPerMinute * 20, 0, 40); // ~0.5/min == 10
  const drinkLoad = clamp(i.drinkCount * 8, 0, 30);
  const cycleRelief = clamp(i.waterCycles * 3, 0, 20);
  const raw = heatLoad * 0.35 + activity * 0.25 + decayLoad + drinkLoad - cycleRelief;
  return clamp(Math.round(raw), 0, 100);
}

/**
 * Trend ('rising' | 'stable' | 'declining'). Driven by decay rate and
 * energy state, not by sampling a window — we deliberately avoid
 * keeping a history buffer in Phase 1 so the engine stays pure.
 */
export function deriveTrend(i: RecoveryInputs): RecoveryTrend {
  if (i.energyState === 'peak' && i.decayPerMinute < 0.3) return 'rising';
  if (i.energyState === 'crashed' || i.decayPerMinute > 0.6) return 'declining';
  if (i.energyState === 'low' && i.decayPerMinute > 0.4) return 'declining';
  return 'stable';
}

/**
 * Command — one short imperative. No "AI detected", no explanation.
 * The spec lists this as the line Coach + Orb will surface.
 */
export function deriveRecoveryCommand(i: RecoveryInputs, recovery: number): string {
  if (i.drinkCount >= 1) return 'One water. Now.';
  if (recovery < 35) return 'Pause. Hydrate.';
  if (i.urineSignal >= 6) return 'Cycle water. Twice.';
  if (i.waterCycles < 3) return 'Complete one cycle.';
  if (recovery >= 80) return 'Hold position.';
  return 'Steady. One cycle.';
}

/**
 * Story — one-sentence narrative for the Timeline. Never longer than
 * a single line, never name-drops a system ("AI", "engine"), never
 * exposes raw numbers above 2 decimal places.
 */
export function deriveRecoveryStory(
  i: RecoveryInputs,
  recovery: number,
  pressure: number,
  trend: RecoveryTrend,
): string {
  const trendPhrase =
    trend === 'rising' ? 'climbing'
    : trend === 'declining' ? 'easing back'
    : 'holding';
  if (pressure >= 70) return `Carrying high load; recovery ${trendPhrase}.`;
  if (recovery >= 80) return `Strong base; recovery ${trendPhrase}.`;
  if (i.drinkCount >= 2) return `Session load logged; recovery ${trendPhrase}.`;
  return `Recovery ${trendPhrase} at ${recovery}.`;
}

/**
 * Fingerprint — a stable 8-char FNV-1a hash of the user's recovery
 * signature. Inputs are deliberately coarse (banded, not raw) so the
 * fingerprint only churns when the user's *pattern* changes, not on
 * every score tick.
 */
export function deriveFingerprint(i: RecoveryInputs): string {
  const sleepBand = i.overnightLossOz > 12 ? 'H' : i.overnightLossOz > 6 ? 'M' : 'L';
  const heatBand = i.heatLoad > 66 ? 'H' : i.heatLoad > 33 ? 'M' : 'L';
  const actBand = i.activityLevel > 66 ? 'H' : i.activityLevel > 33 ? 'M' : 'L';
  const cycleBand = i.waterCycles >= 6 ? 'H' : i.waterCycles >= 3 ? 'M' : 'L';
  const sig = `s${sleepBand}|h${heatBand}|a${actBand}|c${cycleBand}|e${i.energyState[0]}`;
  let hash = 0x811c9dc5; // FNV-1a 32-bit offset basis
  for (let n = 0; n < sig.length; n += 1) {
    hash ^= sig.charCodeAt(n);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function deriveRecoverySnapshot(i: RecoveryInputs): RecoverySnapshot {
  const recovery = deriveRecovery(i);
  const pressure = derivePressure(i);
  const trend = deriveTrend(i);
  return {
    recovery,
    pressure,
    trend,
    command: deriveRecoveryCommand(i, recovery),
    fingerprint: deriveFingerprint(i),
    story: deriveRecoveryStory(i, recovery, pressure, trend),
  };
}

/**
 * Extract the inputs the engine needs from the existing store slices.
 * Kept as a separate function so consumers can pre-compute inputs once
 * and feed them to `deriveRecoverySnapshot` outside of React if they
 * need to (e.g. for the journal-write pipeline).
 */
export function recoveryInputsFromState(
  user: UserState,
  engine: Pick<ScoreEngineOutput, 'score' | 'prediction'>,
): RecoveryInputs {
  return {
    score: engine.score,
    decayPerMinute: engine.prediction.decayPerMinute,
    waterCycles: user.unitsConsumedToday,
    urineSignal: user.urineSignal,
    heatLoad: user.heatLoad,
    activityLevel: user.activityLevel,
    overnightLossOz: user.overnightLossOz,
    drinkCount: user.socialMode?.drinks?.length ?? 0,
    complianceStreak: user.complianceStreak,
    energyState: user.energyState,
  };
}

