/**
 * DATA CONFIDENCE LAYER™ — how complete & verified is the data an
 * intelligence engine is working with right now?
 *
 * Every AForce intelligence engine (Performance Age, Command Confidence,
 * the Evidence read inside the Impact Engine, Performance Memory) reasons
 * over whatever signals happen to be available. This layer answers ONE
 * orthogonal question for each of them — not "which source do we trust"
 * (that is the Verification Layer, utils/verification) and not "which
 * source's value do we pick" (that is Signal Hierarchy, utils/signalHierarchy)
 * — but "how much real, verified data is behind this read?":
 *
 *   High   — multiple verified signals.
 *   Medium — partial (some real data, but thin / proxied / self-reported).
 *   Low    — estimated (no real signal; pure defaults / first-run).
 *
 * It is purely a QUALIFIER. It never awards, inflates, or mutates a score,
 * band, or any engine output (Score-Protection). It is INTERNAL — never
 * displayed publicly, so it carries no user-facing copy and needs no i18n.
 *
 * Build 100% · Show 10%: the core resolver plus one pure adapter per named
 * consumer are all built here. Nothing is wired into a consumer's return
 * type and no feature flag gates it — the layer changes no existing runtime
 * behaviour; consumers opt in by CALLING an adapter when they choose to
 * surface confidence, exactly like the Verification Layer and Impact Engine.
 *
 * Pure module — no React Native, no AsyncStorage, no Date.now(), no I/O.
 */

import type { ImpactContext } from '../impact/impactEngine';
import type { PerformanceAgeRawSignals } from '../../services/performanceAgeService';

// ─── Core vocabulary ──────────────────────────────────────────────────

/** Categorical confidence band reported to (never shown by) an engine. */
export type DataConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Quality of a single input signal feeding an engine:
 *   - `verified`  — a real reading is present from a trusted source.
 *   - `partial`   — present, but proxied / weak / self-reported (phone floor).
 *   - `estimated` — absent; the engine falls back to a default/renormalize.
 */
export type SignalQuality = 'verified' | 'partial' | 'estimated';

/** One input signal's contribution to an engine's data confidence. */
export interface DataSignalInput {
  /** Stable id of the signal (for the debug trace; not a UI string). */
  key: string;
  quality: SignalQuality;
}

export interface DataConfidenceResult {
  /** The resolved band. */
  level: DataConfidenceLevel;
  /** How many inputs were verified. */
  verifiedCount: number;
  /** How many inputs were partial. */
  partialCount: number;
  /** How many inputs were estimated / absent. */
  estimatedCount: number;
  /** Total inputs considered. */
  totalSignals: number;
  /** 0..1 weighted completeness = (verified + 0.5·partial) / total. */
  coverage: number;
  /** Echo of the inputs, in the order given (debug trace). */
  signals: DataSignalInput[];
}

// ─── Locked thresholds ────────────────────────────────────────────────

/** "Multiple verified signals" — the floor for a HIGH band. */
export const HIGH_MIN_VERIFIED = 2;
/** A partial signal counts as half a verified one for coverage. */
export const PARTIAL_WEIGHT = 0.5;
/**
 * Signal-source confidence (0..1, from the Verification Layer) at/above
 * which an Impact/Command signal counts as `verified` rather than merely
 * `partial`. 0.7 is the Verification Layer's `wearable` base — i.e. a
 * connected wearable or Phantom verifies; the phone/self-report floor
 * (0.4) is partial; no signal at all is estimated.
 */
export const VERIFIED_CONFIDENCE_THRESHOLD = 0.7;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

// ─── Core resolver ────────────────────────────────────────────────────

/**
 * Resolve a set of input signals into a categorical data-confidence band.
 * Pure + deterministic. Locked rules:
 *
 *   - no signals at all                  → 'low'   (nothing to go on)
 *   - ≥ HIGH_MIN_VERIFIED verified       → 'high'  (multiple verified)
 *   - exactly 1 verified OR ≥1 partial   → 'medium'(partial)
 *   - only estimated / absent            → 'low'   (estimated)
 */
export function assessDataConfidence(
  signals: readonly DataSignalInput[],
): DataConfidenceResult {
  let verifiedCount = 0;
  let partialCount = 0;
  let estimatedCount = 0;
  for (const s of signals) {
    if (s.quality === 'verified') verifiedCount++;
    else if (s.quality === 'partial') partialCount++;
    else estimatedCount++;
  }
  const totalSignals = signals.length;

  let level: DataConfidenceLevel;
  if (totalSignals === 0) {
    level = 'low';
  } else if (verifiedCount >= HIGH_MIN_VERIFIED) {
    level = 'high';
  } else if (verifiedCount >= 1 || partialCount >= 1) {
    level = 'medium';
  } else {
    level = 'low';
  }

  const coverage =
    totalSignals === 0
      ? 0
      : round2((verifiedCount + PARTIAL_WEIGHT * partialCount) / totalSignals);

  return {
    level,
    verifiedCount,
    partialCount,
    estimatedCount,
    totalSignals,
    coverage,
    signals: [...signals],
  };
}

// ─── Adapters (one per named consumer; pure) ──────────────────────────

/**
 * Data confidence for **Performance Age** from its raw (un-normalized)
 * signals. The four behaviour sub-scores map to:
 *   - hydration  (compliance streak) → verified when a real streak exists.
 *   - recovery   (recovery capacity) → verified when present.
 *   - sleep      (sleep hours)       → verified when present.
 *   - activity   → at best `partial`: the primary source is the user's
 *     SELF-REPORTED activity level, and the fallback is a workout-load
 *     proxy — neither is a verified activity-frequency series, so it never
 *     counts as a verified signal (mirrors the service's documented caveat).
 * Absent signals are `estimated` (the engine drops & renormalizes them).
 */
export function performanceAgeDataConfidence(
  raw: PerformanceAgeRawSignals,
): DataConfidenceResult {
  const hydration: SignalQuality =
    isFiniteNumber(raw.complianceStreak) && raw.complianceStreak >= 0
      ? 'verified'
      : 'estimated';
  const recovery: SignalQuality = isFiniteNumber(raw.recoveryCapacity)
    ? 'verified'
    : 'estimated';
  const sleep: SignalQuality = isFiniteNumber(raw.sleepHours)
    ? 'verified'
    : 'estimated';
  const activity: SignalQuality =
    isFiniteNumber(raw.activityLevel) ||
    isFiniteNumber(raw.workoutMinutes) ||
    isFiniteNumber(raw.strain)
      ? 'partial'
      : 'estimated';

  return assessDataConfidence([
    { key: 'hydrationConsistency', quality: hydration },
    { key: 'recoveryTrend', quality: recovery },
    { key: 'sleepQuality', quality: sleep },
    { key: 'activityConsistency', quality: activity },
  ]);
}

/**
 * Data confidence for the **Impact Engine** read (the shared substrate for
 * Command Confidence and the Evidence read). Reflects which before/after
 * signal pairs are actually present, plus the source quality behind the
 * always-present hydration/command signal:
 *   - hydration/command → quality is gated by the Verification-Layer
 *     `signalConfidence`: ≥ VERIFIED_CONFIDENCE_THRESHOLD ⇒ verified,
 *     > 0 ⇒ partial (phone/self-report floor), 0 ⇒ estimated.
 *   - recovery / heat   → verified only when BOTH before & after are finite
 *     (a real measured pair), else estimated.
 * Per design, `signalConfidence` gates ONLY the command floor — it does not
 * globally downgrade the independent recovery/heat completeness.
 */
export function impactDataConfidence(ctx: ImpactContext): DataConfidenceResult {
  const sc = isFiniteNumber(ctx.signalConfidence)
    ? Math.max(0, Math.min(1, ctx.signalConfidence))
    : 0;
  const hydrationPresent =
    isFiniteNumber(ctx.hydrationBefore) && isFiniteNumber(ctx.hydrationAfter);
  const command: SignalQuality = !hydrationPresent
    ? 'estimated'
    : sc >= VERIFIED_CONFIDENCE_THRESHOLD
      ? 'verified'
      : sc > 0
        ? 'partial'
        : 'estimated';

  const recovery: SignalQuality =
    isFiniteNumber(ctx.recoveryBefore) && isFiniteNumber(ctx.recoveryAfter)
      ? 'verified'
      : 'estimated';
  const heat: SignalQuality =
    isFiniteNumber(ctx.heatPressureBefore) && isFiniteNumber(ctx.heatPressureAfter)
      ? 'verified'
      : 'estimated';

  return assessDataConfidence([
    { key: 'command', quality: command },
    { key: 'recovery', quality: recovery },
    { key: 'heat', quality: heat },
  ]);
}

/**
 * Data confidence for **Command Confidence**. Command Confidence is derived
 * inside the Impact Engine from the same context, so it shares the impact
 * adapter — exposed under its own name to satisfy the consumer contract
 * without duplicating logic.
 */
export function commandConfidenceDataConfidence(
  ctx: ImpactContext,
): DataConfidenceResult {
  return impactDataConfidence(ctx);
}

/**
 * Data confidence for the **Evidence Engine** read (currently the Impact
 * Engine's "did the command work" measurement). Same substrate as Command
 * Confidence; named separately for the consumer contract.
 */
export function evidenceDataConfidence(ctx: ImpactContext): DataConfidenceResult {
  return impactDataConfidence(ctx);
}

/**
 * Data confidence for **Performance Memory**. Performance Memory rolls up
 * SELF-REPORTED voice check-ins — a phone-floor source that can never be
 * "multiple verified signals", so it is capped at MEDIUM by design:
 *   - 0 logged days  → one `estimated` signal → low.
 *   - ≥1 logged days → one `partial` signal   → medium.
 * `entriesLogged` is the distinct-day count Performance Memory already
 * computes; passing the count (not the records) keeps this decoupled.
 */
export function performanceMemoryDataConfidence(
  entriesLogged: number,
): DataConfidenceResult {
  const has = isFiniteNumber(entriesLogged) && entriesLogged >= 1;
  return assessDataConfidence([
    { key: 'checkInHistory', quality: has ? 'partial' : 'estimated' },
  ]);
}
