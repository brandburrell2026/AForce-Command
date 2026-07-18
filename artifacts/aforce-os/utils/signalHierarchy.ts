/**
 * SIGNAL HIERARCHY™ — deterministic per-source priority resolution.
 *
 * The loop (Signal → Command → Action → Impact) needs ONE answer to
 * "when several sources report the same signal, which one do we trust?"
 * Historically AForce answered that with FRESHEST-WINS (largest
 * `fetchedAt`; see utils/biometricsAggregator.ts and
 * services/profileBodyModel.ts#selectFreshestSleepHours). Signal
 * Hierarchy replaces freshest-wins for source SELECTION with a fixed,
 * deterministic priority ladder per signal type:
 *
 *   Sleep:        Phantom → WHOOP → Apple Health → Samsung Health →
 *                 Garmin → Google Health Connect → Voice Check-In → Manual
 *                 (Oura Ring sleep enters via Apple Health upstream, so
 *                  `oura` is intentionally absent from this ladder.)
 *   Heart Rate:   Phantom → WHOOP → Apple Watch → Samsung Watch → Garmin →
 *                 Google Health Connect → Manual
 *   Activity:     Phantom → Apple Health → Samsung Health → Garmin →
 *                 Google Health Connect → Manual
 *   Hydration
 *   Verification: Urine Intelligence → Hydration Logs → Voice Check-In
 *
 * Resolution rule (locked):
 *   - Pure PRIORITY over availability. The highest-priority source that
 *     has a NON-NULL value wins, regardless of how fresh a lower-priority
 *     source is. There is deliberately NO staleness/recency guard — the
 *     spec is a deterministic ladder, and re-introducing recency would
 *     re-introduce freshest-wins semantics.
 *   - Graceful fallback downward: if the top source has no value, the
 *     next one is used, and so on, so the loop never goes dark.
 *
 * Relationship to the Verification Layer (utils/verification):
 *   Signal Hierarchy answers WHICH source's value to use. The
 *   Verification Layer answers HOW MUCH confidence to place in whatever
 *   source won (phantom > wearable > phone). They are complementary and
 *   intentionally kept separate.
 *
 * Score-Protection: this module only chooses an INPUT value. It never
 * awards, inflates, or mutates score. Build 100% · Show 10%: all four
 * ladders are fully built here; Phase 1 wires only the SLEEP ladder into
 * the (already headless, flag-gated) Hydration Demand read path. Sources
 * not yet ingested (Phantom Band, Voice Check-In, Manual Entry, the
 * watch-distinct Apple/Samsung HR streams) live in the ladders so the
 * engine is complete; they simply produce no candidates until wired.
 *
 * Pure module — no React Native, no AsyncStorage, no Date.now(), no I/O.
 */

import type { HealthProviderId } from '../data/healthProviders';
import type { ProviderBiometrics } from '../types/biometrics';

/** The four signal families that have a deterministic source ladder. */
export type SignalKind = 'sleep' | 'heart_rate' | 'activity' | 'hydration_verification';

/**
 * Superset of signal sources. Deliberately NOT `HealthProviderId`: the
 * spec introduces sources outside the health-platform catalog (Phantom
 * Band, Voice Check-In, Manual Entry, the watch-distinct Apple/Samsung
 * heart-rate streams) and pseudo-sources for hydration verification
 * (Urine Intelligence, Hydration Logs). The provider catalog stays
 * untouched; this union is the engine's own vocabulary.
 */
export type SignalSourceId =
  | 'phantom'
  | 'whoop'
  | 'apple_health'
  | 'samsung_health'
  | 'garmin'
  | 'google_health'
  | 'apple_watch'
  | 'samsung_watch'
  | 'voice_checkin'
  | 'manual'
  | 'urine_intelligence'
  | 'hydration_logs';

/**
 * Sleep ladder. Oura is intentionally absent — Oura sleep is folded in
 * via the `apple_health` slot upstream (an Oura snapshot populates Apple
 * Health), matching "Oura Ring data enters through Apple Health."
 */
export const SLEEP_PRIORITY: readonly SignalSourceId[] = [
  'phantom',
  'whoop',
  'apple_health',
  'samsung_health',
  'garmin',
  'google_health',
  'voice_checkin',
  'manual',
] as const;

/**
 * Heart-rate ladder. WHOOP sits at #2 (after Phantom, above the watches),
 * mirroring its rank on the sleep ladder — it's a dedicated continuous-HR
 * recovery device, trusted for HR as it is for sleep. Apple/Samsung WATCH
 * streams then sit above Garmin. All of these grade as `wearable` tier in
 * SOURCE_TIER, so this order only tie-breaks which source wins when a user has
 * more than one; it does not change the §54 quality rating.
 */
export const HEART_RATE_PRIORITY: readonly SignalSourceId[] = [
  'phantom',
  'whoop',
  'apple_watch',
  'samsung_watch',
  'garmin',
  'google_health',
  'manual',
] as const;

/** Activity ladder. Uses the Apple/Samsung HEALTH platforms (not watches). */
export const ACTIVITY_PRIORITY: readonly SignalSourceId[] = [
  'phantom',
  'apple_health',
  'samsung_health',
  'garmin',
  'google_health',
  'manual',
] as const;

/** Hydration-verification ladder — distinct, non-wearable sources. */
export const HYDRATION_VERIFICATION_PRIORITY: readonly SignalSourceId[] = [
  'urine_intelligence',
  'hydration_logs',
  'voice_checkin',
] as const;

/** Lookup of every ladder by signal kind. */
export const SIGNAL_PRIORITY: Record<SignalKind, readonly SignalSourceId[]> = {
  sleep: SLEEP_PRIORITY,
  heart_rate: HEART_RATE_PRIORITY,
  activity: ACTIVITY_PRIORITY,
  hydration_verification: HYDRATION_VERIFICATION_PRIORITY,
};

/** A single source's reading for a signal. `value` null/undefined = no data. */
export interface SignalCandidate<T> {
  source: SignalSourceId;
  value: T | null | undefined;
  /** When the reading was captured (epoch ms), if known. Informational only. */
  fetchedAt?: number;
}

/** The winning source for a signal, plus a trace for debugging. */
export interface SignalResolution<T> {
  kind: SignalKind;
  /** The winning source. */
  source: SignalSourceId;
  /** The winning non-null value. */
  value: T;
  /** 1-based rank of the winner within the ladder (1 = top priority). */
  rank: number;
  /** Capture time of the winning reading, if the candidate provided one. */
  fetchedAt?: number;
  /** Sources that had a non-null value, in ladder order (best → worst). */
  availableSources: SignalSourceId[];
  /** The full ladder considered, best → worst. */
  consideredOrder: readonly SignalSourceId[];
}

/**
 * Resolve a signal by deterministic priority. Returns the highest-priority
 * candidate that has a non-null value, or `null` when none do.
 *
 * Pure. If the same source appears in `candidates` more than once, the
 * first occurrence with a non-null value is used for that source.
 */
export function resolveSignal<T>(
  kind: SignalKind,
  candidates: readonly SignalCandidate<T>[],
): SignalResolution<T> | null {
  const ladder = SIGNAL_PRIORITY[kind];

  // Index the first non-null candidate per source so a duplicate listing
  // can't change the outcome and lookups stay O(1) per ladder rung.
  const bySource = new Map<SignalSourceId, SignalCandidate<T>>();
  for (const c of candidates) {
    if (c.value == null) continue;
    if (!bySource.has(c.source)) bySource.set(c.source, c);
  }

  const availableSources: SignalSourceId[] = [];
  for (const source of ladder) {
    if (bySource.has(source)) availableSources.push(source);
  }
  if (availableSources.length === 0) return null;

  const winnerSource = availableSources[0];
  const winner = bySource.get(winnerSource)!;
  return {
    kind,
    source: winnerSource,
    value: winner.value as T,
    rank: ladder.indexOf(winnerSource) + 1,
    fetchedAt: winner.fetchedAt,
    availableSources,
    consideredOrder: ladder,
  };
}

/**
 * The `HealthProviderId`-backed sources that can carry a sleep reading in
 * `ProviderBiometrics` today. Phantom / Voice Check-In / Manual sit above
 * or below these in the ladder but aren't part of the biometrics record
 * yet, so they produce no candidate here (Build 100% · Show 10%).
 */
const SLEEP_BIOMETRIC_SOURCES: readonly HealthProviderId[] = [
  'whoop',
  'apple_health',
  'samsung_health',
  'garmin',
  'google_health',
];

/**
 * Sleep resolution result shaped to match
 * `profileBodyModel.FreshestSleep` so it can drop straight into the
 * Hydration Demand adapter's `trace.sleepSource` without widening any
 * type. `source` is always a `HealthProviderId` because only
 * provider-backed sources can appear in `ProviderBiometrics`.
 */
export interface HierarchySleep {
  hours: number;
  source: HealthProviderId;
  fetchedAt: number;
}

/**
 * Pick the sleep reading by SIGNAL HIERARCHY™ priority (WHOOP over Apple
 * over Samsung over Garmin over Google) rather than by freshness. Returns
 * `null` when no provider has a sleep value, so the demand engine falls
 * back to its own default instead of fabricating a number — identical
 * "no data" semantics to `selectFreshestSleepHours`.
 */
export function selectSleepByHierarchy(
  biometrics: ProviderBiometrics | undefined,
): HierarchySleep | null {
  if (!biometrics) return null;

  const candidates: SignalCandidate<number>[] = SLEEP_BIOMETRIC_SOURCES.map((id) => {
    const snap = biometrics[id];
    return {
      source: id as SignalSourceId,
      value: snap?.sleepHoursLastNight ?? null,
      fetchedAt: snap?.fetchedAt,
    };
  });

  const resolved = resolveSignal<number>('sleep', candidates);
  if (!resolved) return null;

  return {
    hours: resolved.value,
    source: resolved.source as HealthProviderId,
    fetchedAt: resolved.fetchedAt ?? 0,
  };
}
