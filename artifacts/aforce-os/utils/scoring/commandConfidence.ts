/**
 * Command Confidence™ — how grounded an AForce command is, derived purely
 * from how much REAL, FRESH data backs it. Pure + dependency-free so it
 * stays unit-testable and never fabricates a signal.
 *
 * Score-Protection: confidence is display-only. It never reads, awards, or
 * mutates the performance score — it only describes the data behind a
 * recommendation. Water-First / command copy is unaffected; this is meta.
 *
 * No-fabrication discipline (why each signal is what it is):
 *  - We count `intakeEvents` for "behavior", NOT `unitsConsumedToday` — the
 *    demo/mock seed (`data/mockData.ts`) ships a non-zero `unitsConsumedToday`,
 *    so it can't prove the *user* logged anything. `intakeEvents` is only ever
 *    written by a real log action.
 *  - We deliberately do NOT use `bodyWeightLbs` as a signal: it is always
 *    present via a default (mock 180 / server fallback 180), so it carries no
 *    provenance about whether the user actually entered a profile.
 *  - Biometrics/weather must be FINITE *and* RECENT. An empty `{}` snapshot,
 *    an all-null Apple Health object, a NaN/Infinity reading, or a stale /
 *    future-dated timestamp does not count.
 */
import type {
  CommandConfidenceLevel,
  UserState,
  AppleHealthInputs,
  ProviderSnapshot,
} from '../../types';

export type { CommandConfidenceLevel };

/** Recovery/sleep/HRV refresh on a daily cadence — count within 24h. */
export const BIOMETRIC_FRESHNESS_MS = 24 * 60 * 60 * 1000;
/** Current conditions go stale fast — count weather within 6h. */
export const WEATHER_FRESHNESS_MS = 6 * 60 * 60 * 1000;
/** Tolerate small clock drift between device/provider and `now`. */
export const CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface CommandConfidenceInputs {
  /** The user has logged at least one real hydration event (rolling 24h). */
  hasTodayBehavior: boolean;
  /** Fresh, finite biometrics from a linked health provider / Apple Health. */
  hasFreshBiometrics: boolean;
  /** Fresh, finite real weather is attached (heat math isn't a placeholder). */
  hasWeather: boolean;
}

/** A real, usable number — rejects null/undefined, NaN, and ±Infinity. */
function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * A timestamp is "fresh" when it is a finite epoch-ms value that is neither
 * stale (older than `maxAgeMs`) nor implausibly in the future (beyond a small
 * clock-skew tolerance). Guards against Infinity / future-dated provider data.
 */
function isFresh(fetchedAt: number | null | undefined, now: number, maxAgeMs: number): boolean {
  if (!isFiniteNumber(fetchedAt) || fetchedAt <= 0 || !Number.isFinite(now)) {
    return false;
  }
  const age = now - fetchedAt;
  return age >= -CLOCK_SKEW_MS && age <= maxAgeMs;
}

function appleHealthHasSignal(a: AppleHealthInputs): boolean {
  return (
    isFiniteNumber(a.restingHeartRate) ||
    isFiniteNumber(a.hrvSdnn) ||
    isFiniteNumber(a.stepsToday) ||
    isFiniteNumber(a.sleepHoursLastNight)
  );
}

function snapshotHasSignal(s: ProviderSnapshot): boolean {
  return (
    isFiniteNumber(s.restingHeartRate) ||
    isFiniteNumber(s.hrvSdnn) ||
    isFiniteNumber(s.sleepHoursLastNight) ||
    isFiniteNumber(s.stepsToday) ||
    isFiniteNumber(s.workoutMinutesToday) ||
    isFiniteNumber(s.strain) ||
    isFiniteNumber(s.recoveryPct) ||
    isFiniteNumber(s.readinessScore) ||
    isFiniteNumber(s.stressScore) ||
    isFiniteNumber(s.trainingLoad)
  );
}

function hasUsableBiometrics(state: UserState, now: number): boolean {
  const ah = state.appleHealth;
  if (ah && appleHealthHasSignal(ah) && isFresh(ah.fetchedAt, now, BIOMETRIC_FRESHNESS_MS)) {
    return true;
  }
  const bio = state.biometrics;
  if (bio) {
    for (const snap of Object.values(bio)) {
      if (snap && snapshotHasSignal(snap) && isFresh(snap.fetchedAt, now, BIOMETRIC_FRESHNESS_MS)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Map raw UserState to the real-signal booleans. Pure. `now` is injected so
 * freshness windows are testable. Any missing/stale/empty/invalid signal stays
 * `false` — we never substitute a placeholder to look more confident than the
 * data supports.
 */
export function commandConfidenceInputsFromState(
  state: UserState,
  now: number = Date.now(),
): CommandConfidenceInputs {
  return {
    hasTodayBehavior: (state.intakeEvents?.length ?? 0) > 0,
    hasFreshBiometrics: hasUsableBiometrics(state, now),
    hasWeather: isFiniteNumber(state.weatherTempC) && isFresh(state.weatherFetchedAt, now, WEATHER_FRESHNESS_MS),
  };
}

/**
 * Derive the confidence level from the real signals available. More live
 * data → higher confidence. When nothing real is known yet we return 'low'
 * (framed in the UI as "building") rather than overstating certainty.
 *
 *   high   — the user is actively logging (behavior) AND we have at least one
 *            fresh context signal (biometrics or weather).
 *   low    — no real signals at all.
 *   medium — anything in between.
 */
export function deriveCommandConfidence(inputs: CommandConfidenceInputs): CommandConfidenceLevel {
  const { hasTodayBehavior, hasFreshBiometrics, hasWeather } = inputs;

  if (hasTodayBehavior && (hasFreshBiometrics || hasWeather)) {
    return 'high';
  }
  if (!hasTodayBehavior && !hasFreshBiometrics && !hasWeather) {
    return 'low';
  }
  return 'medium';
}
