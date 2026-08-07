/**
 * SLEEP MODE — canonical-consumer bridge (W3.3).
 *
 * Pure adapter between the Sleep Mode container's raw state and THE canonical
 * health selector (`resolveHealthSignals`, ./signalResolution.ts — a frozen
 * contract, consumed here and never modified). Gated behind
 * `health_canonical_consumers` (default OFF, see featureFlags/flags.ts):
 *
 *   - Flag OFF → `legacySignals` reproduces the screen's original inline
 *     freshest-wins-across-snapshots / Apple-Health-only logic EXACTLY
 *     (byte-for-byte parity with the pre-W3.3 container).
 *   - Flag ON → `canonicalSignals` routes sleep hours, HRV, and resting heart
 *     rate through `resolveHealthSignals`, so HRV/RHR can come from ANY
 *     connected provider (method-aware for HRV), not just Apple Health — while
 *     staying honest: a stale/expired reading is NEVER surfaced as
 *     connected-fresh, and an unavailable reading is NEVER a fabricated value.
 *
 * `sleepSignalsForContainer` is the one export the screen calls; the two
 * branches are exported too, purely for direct unit testing.
 *
 * Pure — no React Native, no store, no Date.now() (nowMs is injected).
 */
import {
  resolveHealthSignals,
  type ResolveHealthSignalsInput,
} from './signalResolution';
import type { HrvMethod } from '@workspace/health-core';
import { HEALTH_PROVIDERS, type HealthProviderId } from '@/data/healthProviders';
import type { AppleHealthInputs, ProviderBiometrics } from '@/types';
import type { SleepMetricInput, HealthChip } from '@/services/sleep/sleepModeView';

/**
 * The slice of container state this bridge needs. Mirrors
 * `ResolveHealthSignalsInput` minus `nowMs` (injected separately) so a future
 * store that actually populates `records` / `connections` /
 * `activeDirectProviders` needs no change here — today's container only has
 * `appleHealth` + `biometrics` (the snapshot plane) and the rest stay
 * undefined, which `resolveHealthSignals` already treats honestly (no
 * fabricated connection state, see PARTIAL_PERMISSIONS / NO_DATA fixtures).
 */
export interface SleepSignalsContainerState {
  appleHealth: AppleHealthInputs | undefined;
  biometrics: ProviderBiometrics | undefined;
  records?: ResolveHealthSignalsInput['records'];
  activeDirectProviders?: ResolveHealthSignalsInput['activeDirectProviders'];
  connections?: ResolveHealthSignalsInput['connections'];
}

export interface SleepSignalsForContainer {
  /** Real last-night sleep hours, or null — never a placeholder number. */
  sleepLastNight: number | null;
  /** Only ever contains metrics with a genuinely real value (`real: true`). */
  recoveryMetrics: readonly SleepMetricInput[];
  chip: HealthChip;
  /** null ⇒ let `resolveSleepModeView` pick its own honest default copy. */
  freshness: string | null;
  /** Display name of the provider that supplied the winning sleep signal.
   *  Only ever populated on the canonical (flag-ON) path with an available
   *  reading — null everywhere else so the container's own platform-based
   *  provider label stays the honest fallback. */
  providerLabel: string | null;
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function providerDisplayName(id: HealthProviderId): string {
  return HEALTH_PROVIDERS.find((p) => p.id === id)?.name ?? id;
}

/**
 * HRV METHOD LABELING (honesty rule — see signalResolution.ts's own header on
 * `HrvSignalValue.method`, which is PRESERVED, never inferred or coerced).
 * The canonical path can surface HRV from ANY connected provider — RMSSD
 * (WHOOP/Oura/Garmin/Health Connect) and SDNN (Apple Health) are different
 * statistics on different numeric scales, not interchangeable readings of
 * "the same HRV." A generic "HRV" label on both would silently imply they
 * are, and would make a provider switch (e.g. WHOOP → Apple Watch) read as an
 * unexplained jump in the same metric. `method` is non-optional on an
 * AVAILABLE reading in today's contract, so the `default` branch below is
 * defensive-only — never label a value with the WRONG method; omit the
 * qualifier entirely rather than guess.
 */
export function hrvMetricLabel(method: HrvMethod | undefined): string {
  switch (method) {
    case 'rmssd':
      return 'HRV (RMSSD)';
    case 'sdnn':
      return 'HRV (SDNN)';
    default:
      return 'HRV';
  }
}

// ─── Flag OFF — exact legacy behavior ────────────────────────────────────────

/**
 * Byte-for-byte port of the container's original inline logic: Apple Health
 * first, else freshest-across-snapshots for sleep; Apple-Health-only for
 * HRV/resting HR. Do not "improve" this branch — its entire job is parity.
 */
export function legacySignals(state: SleepSignalsContainerState): SleepSignalsForContainer {
  const fromApple = state.appleHealth?.sleepHoursLastNight;
  let sleepLastNight: number | null = isFiniteNum(fromApple) ? fromApple : null;
  if (sleepLastNight == null && state.biometrics) {
    let best: { v: number; at: number } | null = null;
    for (const snap of Object.values(state.biometrics)) {
      const v = snap?.sleepHoursLastNight;
      if (!isFiniteNum(v)) continue;
      const at = snap?.fetchedAt ?? 0;
      if (!best || at > best.at) best = { v, at };
    }
    sleepLastNight = best?.v ?? null;
  }

  const hasHealthObject =
    state.appleHealth != null || (state.biometrics != null && Object.keys(state.biometrics).length > 0);
  const chip: HealthChip = sleepLastNight != null ? 'connected' : hasHealthObject ? 'waiting' : 'not_connected';
  const freshness: string | null = sleepLastNight != null ? 'Last night' : hasHealthObject ? 'No recent signal' : null;

  const recoveryMetrics: SleepMetricInput[] = [];
  const hrv = state.appleHealth?.hrvSdnn;
  const rhr = state.appleHealth?.restingHeartRate;
  if (isFiniteNum(hrv)) {
    // RC-2 ruling E (item 3): unit-spacing sweep — was 'ms' (no leading
    // space), rendering "58ms" while the sibling `resting_hr` metric right
    // below already renders "54 bpm" (unit: ' bpm'). Normalized to the
    // with-space convention the Apple card's i18n `unit_ms`/`unit_h` keys
    // already use ("{{value}} ms").
    recoveryMetrics.push({ key: 'hrv', label: 'HRV', value: Math.round(hrv), unit: ' ms', real: true });
  }
  if (isFiniteNum(rhr)) {
    recoveryMetrics.push({ key: 'resting_hr', label: 'Resting HR', value: Math.round(rhr), unit: ' bpm', real: true });
  }

  return { sleepLastNight, recoveryMetrics, chip, freshness, providerLabel: null };
}

// ─── Flag ON — canonical selector ────────────────────────────────────────────

/**
 * Honest connection-chip mapping from the SLEEP signal's own availability +
 * freshness (the screen's headline metric) — never fabricated, never
 * upgraded. `stale` / `expired` and `permission_denied` both read as
 * `needs_attention` (a connection exists but needs the user's attention),
 * distinct from `not_connected` (no eligible provider at all) and `waiting`
 * (a provider is present but hasn't produced a reading yet).
 */
function chipAndFreshnessForSleep(
  sleepSignal: ReturnType<typeof resolveHealthSignals>['sleepDuration'],
): { chip: HealthChip; freshness: string | null } {
  if (sleepSignal.available) {
    if (sleepSignal.freshness === 'stale' || sleepSignal.freshness === 'expired') {
      return { chip: 'needs_attention', freshness: 'Signal is stale' };
    }
    return { chip: 'connected', freshness: 'Last night' };
  }
  switch (sleepSignal.reason) {
    case 'permission_denied':
      return { chip: 'needs_attention', freshness: 'Permission needed' };
    case 'stale_expired':
      return { chip: 'needs_attention', freshness: 'Signal is stale' };
    case 'no_data':
      return { chip: 'waiting', freshness: null };
    case 'no_provider':
    default:
      return { chip: 'not_connected', freshness: null };
  }
}

export function canonicalSignals(
  state: SleepSignalsContainerState,
  nowMs: number,
): SleepSignalsForContainer {
  const input: ResolveHealthSignalsInput = {
    biometrics: state.biometrics,
    records: state.records,
    activeDirectProviders: state.activeDirectProviders ?? new Set<HealthProviderId>(),
    connections: state.connections,
    nowMs,
  };
  const signals = resolveHealthSignals(input);

  const sleepSignal = signals.sleepDuration;
  const sleepLastNight = sleepSignal.available ? sleepSignal.value.totalSleepHours : null;
  const providerLabel = sleepSignal.available ? providerDisplayName(sleepSignal.source) : null;

  const recoveryMetrics: SleepMetricInput[] = [];
  if (signals.hrv.available) {
    recoveryMetrics.push({
      key: 'hrv',
      label: hrvMetricLabel(signals.hrv.value.method),
      value: Math.round(signals.hrv.value.valueMs),
      // RC-2 ruling E (item 3): same unit-spacing normalization as
      // `legacySignals` above — was 'ms', now matches the sibling
      // `resting_hr` metric's ' bpm' convention.
      unit: ' ms',
      real: true,
    });
  }
  if (signals.restingHeartRate.available) {
    recoveryMetrics.push({
      key: 'resting_hr', label: 'Resting HR', value: Math.round(signals.restingHeartRate.value), unit: ' bpm', real: true,
    });
  }

  const { chip, freshness } = chipAndFreshnessForSleep(sleepSignal);

  return { sleepLastNight, recoveryMetrics, chip, freshness, providerLabel };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/** The one export the Sleep Mode container calls. */
export function sleepSignalsForContainer(
  state: SleepSignalsContainerState,
  nowMs: number,
  flagOn: boolean,
): SleepSignalsForContainer {
  return flagOn ? canonicalSignals(state, nowMs) : legacySignals(state);
}
