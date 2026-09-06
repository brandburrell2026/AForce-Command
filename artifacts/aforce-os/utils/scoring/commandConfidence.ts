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
import { weatherFreshWindowMs, resolveCurrentWeather } from '../environment/weatherFreshness';
import type {
  CommandConfidenceLevel,
  UserState,
  AppleHealthInputs,
  ProviderSnapshot,
} from '../../types';

export type { CommandConfidenceLevel };

/** Recovery/sleep/HRV refresh on a daily cadence — count within 24h. */
export const BIOMETRIC_FRESHNESS_MS = 24 * 60 * 60 * 1000;
/**
 * PR5 — ONE freshness truth. This was a private 6-hour rule: for five hours
 * after the presentation layer, the evidence contract and (post-PR5) Core had
 * all stopped calling a reading current, confidence still counted it as
 * grounding. Now DERIVED from the versioned ValidityPolicy (PR3/3.1), so the
 * ledger consumers that record this as `maxAgeMs` and the replay adapters that
 * gate on it all move with the one policy — deliberately NOT re-hard-coded to
 * six hours to preserve legacy behavior (founder ruling, PR5).
 */
export const WEATHER_FRESHNESS_MS = weatherFreshWindowMs();
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

/**
 * The most-recent source `fetchedAt` among biometric sources that BOTH carry a
 * usable signal AND are still within the freshness window, or `null` when none
 * qualify. This is the faithful freshness ANCHOR for the command ledger: a
 * consumer that re-applies the same window against this timestamp can never
 * report biometrics fresh past the live expiry. Picking the max fetchedAt among
 * fresh sources mirrors the "any fresh source counts" rule below — it is the
 * last source to age out, so the boolean flips at the same instant live does.
 * Pure; `now` injected for testability.
 */
export function freshBiometricAnchorMs(state: UserState, now: number = Date.now()): number | null {
  let anchor: number | null = null;
  const consider = (fetchedAt: number): void => {
    if (isFresh(fetchedAt, now, BIOMETRIC_FRESHNESS_MS) && (anchor === null || fetchedAt > anchor)) {
      anchor = fetchedAt;
    }
  };
  const ah = state.appleHealth;
  if (ah && appleHealthHasSignal(ah)) consider(ah.fetchedAt);
  const bio = state.biometrics;
  if (bio) {
    for (const snap of Object.values(bio)) {
      if (snap && snapshotHasSignal(snap)) consider(snap.fetchedAt);
    }
  }
  return anchor;
}

function hasUsableBiometrics(state: UserState, now: number): boolean {
  return freshBiometricAnchorMs(state, now) !== null;
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
    // PR5 — the verdict itself, not a private re-derivation of it. The same
    // classifier Core's decay gate uses, so confidence can never again call
    // grounding what the score has stopped believing (or vice versa).
    hasWeather: resolveCurrentWeather(state, now).tempC != null,
  };
}

/**
 * The context fields the command ledger records for a single observation, with
 * each freshness flag bound INSEPARABLY to its source-fetch anchor.
 *
 * `hasFreshBiometrics` is true IF AND ONLY IF `biometricsFetchedAtMs` is non-null,
 * and likewise weather is only "present" when `weatherFetchedAtMs` is non-null.
 * This is the fail-closed contract a ledger reader relies on: it can anchor
 * freshness to the real source window and never has to fall back to the
 * observation time (which would silently re-extend a window from "now").
 */
export interface ContextSnapshotFields {
  /** At least one context signal is live-fresh and worth recording. */
  hasContext: boolean;
  /** Live-fresh weather reading, else null (no usable reading recorded). */
  weatherTempC: number | null;
  /** Weather source fetch time when fresh, else null. */
  weatherFetchedAtMs: number | null;
  /** True iff a biometric anchor exists — flag and anchor are emitted together. */
  hasFreshBiometrics: boolean;
  /** Freshest qualifying biometric source fetch time, else null. */
  biometricsFetchedAtMs: number | null;
}

/**
 * Build the ledger's context-snapshot fields from raw state using a SINGLE
 * evaluation clock, so a freshness boolean can never disagree with its own
 * source-timestamp anchor.
 *
 * Why a single clock matters: deriving `hasFreshBiometrics` and the anchor from
 * two separate `Date.now()` reads can straddle the freshness boundary — the
 * flag reads fresh at t, the anchor ages out at t+ε and returns null. Emitting
 * `hasFreshBiometrics: true` with no anchor forces a reader to fall back to the
 * observation time and silently re-extend a full freshness window — the exact
 * confidence upgrade Score-Protection forbids. Here the flag is DERIVED FROM the
 * anchor (`biometricsFetchedAtMs != null`), so they can never disagree.
 *
 * Pure; `now` injected for testability.
 */
export function deriveContextSnapshotFields(
  state: UserState,
  now: number = Date.now(),
): ContextSnapshotFields {
  const inputs = commandConfidenceInputsFromState(state, now);
  const hasWeather = inputs.hasWeather;
  // hasWeather already requires a finite, fresh weatherFetchedAt, so this anchor
  // is non-null whenever hasWeather is true; null-guarded for type-safety.
  const weatherFetchedAtMs =
    hasWeather && isFiniteNumber(state.weatherFetchedAt) ? state.weatherFetchedAt : null;
  const biometricsFetchedAtMs = freshBiometricAnchorMs(state, now);
  const hasFreshBiometrics = biometricsFetchedAtMs != null;
  return {
    hasContext: hasWeather || hasFreshBiometrics,
    weatherTempC: hasWeather && isFiniteNumber(state.weatherTempC) ? state.weatherTempC : null,
    weatherFetchedAtMs,
    hasFreshBiometrics,
    biometricsFetchedAtMs,
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
