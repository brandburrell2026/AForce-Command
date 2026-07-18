/**
 * GATHER DATA BEHIND SIGNALS — pure app-state → DataBehindSignal[] adapter for
 * the Show-10 DATA BEHIND THIS sheet (slice ①).
 *
 * Reads the multi-provider biometric snapshot (types/biometrics.ts) and, per
 * signal family, resolves the WINNING source by SIGNAL HIERARCHY™ priority
 * (`resolveSignal`, utils/signalHierarchy.ts) — not freshest-wins — then maps
 * that resolution onto the §54 quality kind + §53 freshness kind the sheet
 * composes. The winning source drives §54 quality; the winning reading's
 * `fetchedAt` drives §53 freshness.
 *
 * Honest absence: a family with no non-null candidate in its ladder produces NO
 * row — never a fabricated "unavailable" placeholder. (Once a signal HAS a
 * source but it's poor/stale, the composed chip already says so.) This mirrors
 * the no-fabrication discipline in resolveSignal / commandConfidence.
 *
 * Scope (Show-10 slice ①): biometric-backed families only (sleep, heart rate,
 * activity). Environmental (§54 `weather`) and hydration-verification rows are
 * out of this slice — their sources don't live in ProviderBiometrics. NO §56.
 *
 * Pure · no React Native · no Date.now() · no I/O. The RN sheet supplies `now`
 * to `buildDataBehindThis`; this only names the signals + their source/capture.
 */
import {
  resolveSignal,
  type SignalCandidate,
  type SignalKind,
  type SignalSourceId,
} from '../signalHierarchy';
import type { ProviderBiometrics, ProviderSnapshot } from '../../types/biometrics';
import type { HealthProviderId } from '../../data/healthProviders';
import type { QualitySignalKind } from './signalQuality';
import type { FreshnessSignalKind } from '../../config/hydroStateModel';
import type { DataBehindSignal } from './dataBehindThis';

interface SignalSpec {
  /** Structural row label (not a claim). */
  label: string;
  /** Ladder used to pick the winning source (§ Signal Hierarchy). */
  ladderKind: SignalKind;
  /** §54 quality vocabulary this family grades under. */
  qualityKind: QualitySignalKind;
  /** §53 freshness window this family ages under. */
  freshnessKind: FreshnessSignalKind;
  /** Extract this family's reading from a provider snapshot (null = no data). */
  value: (snap: ProviderSnapshot) => number | null | undefined;
}

/**
 * The three biometric families the sheet surfaces today. Sleep freshness ages
 * under its own window; heart-rate and activity age under `wearable_sync` — the
 * recency of the last successful biometric pull is the honest freshness clock
 * for a wearable-sourced instantaneous reading (there is no dedicated HR/activity
 * freshness window, by design).
 */
const SIGNAL_SPECS: readonly SignalSpec[] = [
  { label: 'Sleep', ladderKind: 'sleep', qualityKind: 'sleep', freshnessKind: 'sleep', value: (s) => s.sleepHoursLastNight },
  { label: 'Heart Rate', ladderKind: 'heart_rate', qualityKind: 'heart_rate', freshnessKind: 'wearable_sync', value: (s) => s.restingHeartRate },
  { label: 'Activity', ladderKind: 'activity', qualityKind: 'activity', freshnessKind: 'wearable_sync', value: (s) => s.stepsToday ?? s.workoutMinutesToday },
] as const;

/**
 * Providers that are BOTH in ProviderBiometrics AND valid ladder sources. `oura`
 * and `strava` are deliberately excluded — Oura enters via Apple Health upstream
 * (never its own ladder rung) and Strava sits in no ladder; passing them would be
 * a no-op in resolveSignal anyway, but naming the real set keeps the cast honest.
 */
const LADDER_PROVIDERS: readonly HealthProviderId[] = [
  'whoop',
  'apple_health',
  'samsung_health',
  'garmin',
  'google_health',
];

/**
 * Build the sheet's signal list from the biometric snapshot. Pure + deterministic;
 * row order follows SIGNAL_SPECS. Missing biometrics → no rows.
 */
export function gatherDataBehindSignals(
  biometrics: ProviderBiometrics | undefined,
): DataBehindSignal[] {
  if (!biometrics) return [];

  const signals: DataBehindSignal[] = [];
  for (const spec of SIGNAL_SPECS) {
    const candidates: SignalCandidate<number>[] = LADDER_PROVIDERS.map((id) => {
      const snap = biometrics[id];
      return {
        // Every LADDER_PROVIDERS id is also a SignalSourceId (see the list above).
        source: id as SignalSourceId,
        value: snap ? spec.value(snap) ?? null : null,
        fetchedAt: snap?.fetchedAt,
      };
    });

    const resolved = resolveSignal<number>(spec.ladderKind, candidates);
    if (!resolved) continue; // honest absence — no fabricated row

    signals.push({
      label: spec.label,
      quality: { kind: spec.qualityKind, source: resolved.source },
      freshness: { kind: spec.freshnessKind, capturedAt: resolved.fetchedAt ?? null },
    });
  }
  return signals;
}
