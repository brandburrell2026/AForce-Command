/**
 * SIGNAL RESOLUTION — THE canonical consumer-facing health selector contract.
 *
 * PR W3.1 (Wave 3 keystone). Every product surface that reads a wearable
 * signal (sleep, resting heart rate, HRV, workouts, steps, provider scores)
 * builds on `resolveHealthSignals` — not on the three scattered policies it
 * supersedes:
 *
 *   - utils/biometricsAggregator.ts     — freshest-wins per metric
 *   - utils/signalHierarchy.ts          — pure priority ladder, no recency
 *   - services/profileBodyModel.ts#selectFreshestSleepHours — single-metric
 *     freshest-wins for sleep only
 *
 * Those three files are UNTOUCHED (consumers migrate onto this contract in
 * W3.2–W3.6, one surface at a time). This module unifies their intent with
 * `@workspace/health-core`'s frozen policy: PRIORITY LADDER first
 * (`SOURCE_PRIORITY`), gated by a FRESHNESS window (`selectPreferredSource`)
 * — never plain freshest-wins, never plain priority-ignoring-age.
 *
 * TWO PLANES, ONE OUTPUT SHAPE
 *   - Record plane (forward-compat): `input.records` — canonical, provenance
 *     -bearing `CanonicalHealthRecord[]`. Preferred whenever a family has at
 *     least one record. Runs `dedupeRecords` first (direct-vs-aggregator-copy
 *     drop, same-origin overlap collapse) — see health-core/dedupe.ts.
 *   - Snapshot plane (today's real data): `input.biometrics` — the legacy
 *     per-provider daily snapshot. Used per-family whenever that family has
 *     no records (records plane is additive, not yet populated everywhere).
 *   Selection between the two is PER FAMILY, not global: a caller mid-
 *   migration can supply records for one metric type and rely on snapshots
 *   for the rest without losing data.
 *
 * HONESTY RULES (enforced throughout, see fixtures + tests)
 *   - Never sum or blend a value across DIFFERENT providers. Cross-provider
 *     disagreement is resolved by SELECTING one winning source (priority +
 *     freshness), never by averaging. Within one winning provider's own
 *     samples for the same day (e.g. granular step counts), summing is fine
 *     — that is not cross-provider blending.
 *   - HRV method is PRESERVED, never inferred or coerced. `hrv.value.method`
 *     always reflects the winning record's own `hrvMethod` (or the honest
 *     per-provider translation in health-core's `resolveHrv`). When multiple
 *     candidates disagree on method, the priority winner is reported and the
 *     conflict is surfaced via `unavailableReason: 'method_conflict_resolved'`
 *     — an ANNOTATION on an AVAILABLE reading, never a claim the data is
 *     missing (see `HealthSignalReading.unavailableReason` doc below).
 *   - Provider scores (`providerScores`) are ATTRIBUTED, never cross-selected
 *     or relabeled — health-core's `SOURCE_PRIORITY` deliberately excludes
 *     `provider_score` for exactly this reason. Each entry keeps its
 *     provider-qualified `kind` (e.g. `'whoop_recovery'`), never renamed to
 *     an AForce concept.
 *   - Every unavailable output carries a CLOSED, honest reason — never a
 *     silent `null`/zero and never a fabricated value.
 *
 * SCORE-PROTECTION (governance hard lock)
 *   Nothing in this module computes, derives, or outputs an "AForce score"
 *   of any kind. It selects and attributes SIGNALS only, feeding Readiness
 *   surfaces — never scoringEngine.ts / statusColor.ts (both off-limits and
 *   unread here). See `SIGNAL_RESOLUTION_SCORE_PROTECTION` below.
 *
 * Pure module — no React Native, no store, no feature-flag import, no I/O,
 * no `Date.now()` (`nowMs` is injected by the caller). Reads only frozen /
 * read-only contracts: `@workspace/health-core`, `config/hydroStateModel.ts`
 * (§53 `FRESHNESS_WINDOWS`, read-only), and `utils/confidence/dataFreshness.ts`
 * (§53 age→rating grader, reused rather than re-implemented).
 */

import {
  dedupeRecords,
  isDirect,
  originOf,
  selectPreferredSource,
  resolveHrv,
  HEALTH_PROVIDER_CAPABILITIES,
  type CanonicalHealthMetricType,
  type CanonicalHealthRecord,
  type CanonicalHealthValue,
  type FreshnessWindowsMs,
  type HealthOriginId,
  type HealthProviderId,
  type HrvMethod,
  type ProviderBiometrics,
  type ProviderPresentationState,
  type ProviderScoreKind,
  type ProviderSnapshot,
  type SleepSessionValue,
  type SourceCandidate,
  type WorkoutValue,
} from '@workspace/health-core';
import { assessFreshness, type FreshnessRating } from '@/utils/confidence/dataFreshness';
import { FRESHNESS_WINDOWS, type FreshnessSignalKind } from '@/config/hydroStateModel';

// ─── Score-Protection ─────────────────────────────────────────────────────────

/**
 * Governance hard lock, asserted by `__tests__/signalResolution.test.ts`:
 * `resolveHealthSignals` selects and attributes health SIGNALS only. It never
 * computes, derives, mutates, or outputs an "AForce score" of any kind, and
 * `providerScores` entries stay provider-attributed forever — never blended
 * into each other or relabeled as an AForce concept. Health data informs
 * Readiness surfaces only.
 */
export const SIGNAL_RESOLUTION_SCORE_PROTECTION =
  'resolveHealthSignals selects and attributes health signals only. It never computes, mutates, or outputs an AForce score; provider scores remain provider-attributed and are never blended or relabeled.';

// ─── Vocabulary ───────────────────────────────────────────────────────────────

/** §53 age→rating vocabulary, reused verbatim from utils/confidence/dataFreshness. */
export type HealthSignalFreshness = FreshnessRating;

/**
 * A convenience, DISPLAY-oriented confidence summary local to this contract —
 * distinct from (and coarser than) §54's `SignalQualityRating` vocabulary.
 * Derived from two axes only: how fresh the reading is (§53) and whether it
 * came directly from the measuring device vs. through a platform aggregator /
 * an unresolved chain. Consumers needing the full §53×§54 composition should
 * still call `applyFreshness` / `assessSignalQuality` directly; this field is
 * a cheap, already-computed summary for surfaces that just need a tri-state.
 */
export type HealthSignalConfidence = 'high' | 'medium' | 'low';

/**
 * Closed reason vocabulary. `method_conflict_resolved` is the one entry that
 * can appear on an AVAILABLE reading (see `HealthSignalReading.unavailableReason`
 * doc) — every other value only ever appears on `HealthSignalUnavailable`.
 */
export type HealthSignalUnavailableReason =
  | 'no_provider'
  | 'no_data'
  | 'stale_expired'
  | 'permission_denied'
  | 'method_conflict_resolved';

/** A resolved, available reading. */
export interface HealthSignalReading<TValue, TUnit extends string = string> {
  available: true;
  value: TValue;
  unit: TUnit;
  /** The TRUE origin (who measured it), never the delivering aggregator when known. */
  source: HealthProviderId;
  /** Raw native origin identifier (HK bundle id / HC package name), when known. */
  originalSource?: string;
  /** The platform that DELIVERED this reading, when different from `source`. */
  aggregator?: HealthProviderId;
  observedAtMs: number;
  freshness: HealthSignalFreshness;
  confidence: HealthSignalConfidence;
  /**
   * INFORMATIONAL ANNOTATION ONLY. Its presence here never means the value is
   * missing — see `HealthSignalUnavailable` for that. Today the only reading
   * -level use is `'method_conflict_resolved'`: candidates disagreed on HRV
   * statistic (rmssd vs sdnn); the priority winner's own value + method are
   * reported as-is, and this flag records that a conflict existed so callers
   * can show a "methods differ across your devices" hint if they choose to.
   */
  unavailableReason?: HealthSignalUnavailableReason;
}

/** An honest absence. Never a placeholder value, never a silent null. */
export interface HealthSignalUnavailable {
  available: false;
  reason: HealthSignalUnavailableReason;
}

export type HealthSignal<TValue, TUnit extends string = string> =
  | HealthSignalReading<TValue, TUnit>
  | HealthSignalUnavailable;

// ─── Selector value shapes ─────────────────────────────────────────────────────

export interface SleepSignalValue {
  totalSleepHours: number;
  /** Present only when the winning record supplied stage data; null otherwise. */
  stages: SleepSessionValue['stages'];
}

export interface HrvSignalValue {
  valueMs: number;
  /** PRESERVED from the winning candidate — never averaged/coerced across methods. */
  method: HrvMethod;
}

export interface WorkoutSignalEntry {
  activityKind: string;
  durationMin: number;
  activeEnergyKcal: number | null;
  avgHeartRateBpm: number | null;
  source: HealthProviderId;
  originalSource?: string;
  aggregator?: HealthProviderId;
  observedAtMs: number;
}

/** One provider-attributed score. Never cross-selected, never blended. */
export interface ProviderScoreEntry {
  kind: ProviderScoreKind;
  provider: HealthProviderId;
  value: number;
  unit: 'score';
  observedAtMs: number;
  freshness: HealthSignalFreshness;
  confidence: HealthSignalConfidence;
  originalSource?: string;
}

// ─── Input contract ─────────────────────────────────────────────────────────

export interface HealthSignalConnectionInput {
  /** Passed through for caller bookkeeping. Connectivity for `no_provider` /
   *  `no_data` purposes here is derived from `activeDirectProviders` +
   *  presence in `biometrics`/`records` — presentation-state gating (is this
   *  provider *actually* live right now?) is `providerPresentation.ts`'s job,
   *  not re-implemented here. */
  presentationState: ProviderPresentationState;
  /** Record types this user has actually granted (subset of the capability's recordTypes). */
  grantedTypes: readonly CanonicalHealthMetricType[];
  /** Record types this user has actually denied. Drives `permission_denied`. */
  deniedTypes: readonly CanonicalHealthMetricType[];
}

export type HealthSignalConnections = Partial<Record<HealthProviderId, HealthSignalConnectionInput>>;

export interface ResolveHealthSignalsInput {
  /** Snapshot plane — today's real per-provider data. */
  biometrics: ProviderBiometrics | undefined;
  /** Record plane — forward-compat. Resolved from records when present for a family, else snapshots. */
  records?: readonly CanonicalHealthRecord[];
  /** Providers with an ACTIVE direct connection — feeds dedupe's aggregator-copy drop. */
  activeDirectProviders: ReadonlySet<HealthProviderId>;
  /** Per-provider permission/presentation facts, when known. */
  connections?: HealthSignalConnections;
  /** Epoch ms, injected — this module never reads the clock. */
  nowMs: number;
}

// ─── Output contract ────────────────────────────────────────────────────────

export interface HealthSignals {
  sleepDuration: HealthSignal<SleepSignalValue, 'hours'>;
  restingHeartRate: HealthSignal<number, 'bpm'>;
  hrv: HealthSignal<HrvSignalValue, 'ms'>;
  workouts: HealthSignal<WorkoutSignalEntry[], 'entries'>;
  steps: HealthSignal<number, 'count'>;
  /** Always an array (possibly empty) — absence of a score is its own honesty, not an `unavailable` shape. */
  providerScores: readonly ProviderScoreEntry[];
}

// ─── Internal helpers — freshness / windows ──────────────────────────────────

/** §53 signals share names with `FreshnessSignalKind` where they exist; everything
 *  else (hrv / RHR / workout / steps / provider_score) uses `wearable_sync`. */
function freshnessKindForMetric(metricType: CanonicalHealthMetricType): FreshnessSignalKind {
  return metricType === 'sleep_session' ? 'sleep' : 'wearable_sync';
}

function dedupeWindowsFor(metricType: CanonicalHealthMetricType): FreshnessWindowsMs {
  const w = FRESHNESS_WINDOWS[freshnessKindForMetric(metricType)];
  return { staleAfterMs: w.staleAfterMs, expireAfterMs: w.expireAfterMs ?? null };
}

function confidenceFor(freshness: HealthSignalFreshness, isDirectHighTrust: boolean): HealthSignalConfidence {
  if (freshness === 'stale' || freshness === 'expired') return 'low';
  if (freshness === 'aging') return 'medium';
  return isDirectHighTrust ? 'high' : 'medium';
}

function freshest(records: readonly CanonicalHealthRecord[]): CanonicalHealthRecord {
  return [...records].sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0];
}

// ─── Internal helpers — provenance / value coercion ──────────────────────────

/**
 * Surfaces `source` / `originalSource` / `aggregator` from a record's own
 * provenance chain + top-level fields (never re-derived): the ORIGIN
 * (`originOf`) is `source` whenever it resolves to a real provider; the
 * DELIVERING provider (`record.provider`) becomes `aggregator` only when it
 * differs from the origin. An unattributable origin ('unknown_device_app')
 * honestly falls back to the delivering provider as `source` — never
 * upgraded to a claimed identity.
 */
function attributionFor(
  record: CanonicalHealthRecord,
): { source: HealthProviderId; originalSource?: string; aggregator?: HealthProviderId } {
  const origin = originOf(record);
  if (origin !== 'unknown_device_app') {
    if (origin === record.provider) {
      return { source: origin, originalSource: record.originalSource };
    }
    return { source: origin, originalSource: record.originalSource, aggregator: record.provider };
  }
  return {
    source: record.provider,
    originalSource: record.originalSource,
    aggregator: isDirect(record) ? undefined : record.provider,
  };
}

function asNumber(v: CanonicalHealthValue): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function asSleepSessionValue(v: CanonicalHealthValue): SleepSessionValue | null {
  return v && typeof v === 'object' && 'totalSleepHours' in v ? (v as SleepSessionValue) : null;
}

function asWorkoutValue(v: CanonicalHealthValue): WorkoutValue | null {
  return v && typeof v === 'object' && 'activityKind' in v ? (v as WorkoutValue) : null;
}

/** Build a resolved reading from a winning record — attribution + freshness + confidence, in one place. */
function readingFrom<T, U extends string>(
  record: CanonicalHealthRecord,
  freshnessKind: FreshnessSignalKind,
  nowMs: number,
  extra: { value: T; unit: U },
  annotate?: HealthSignalUnavailableReason,
): HealthSignalReading<T, U> {
  const attribution = attributionFor(record);
  const observedAtMs = Date.parse(record.observedAt);
  const freshness = assessFreshness(freshnessKind, observedAtMs, nowMs).rating;
  const directHighTrust = attribution.aggregator == null;
  let confidence = confidenceFor(freshness, directHighTrust);
  if (annotate === 'method_conflict_resolved' && confidence === 'high') confidence = 'medium';
  return {
    available: true,
    value: extra.value,
    unit: extra.unit,
    source: attribution.source,
    originalSource: attribution.originalSource,
    aggregator: attribution.aggregator,
    observedAtMs,
    freshness,
    confidence,
    unavailableReason: annotate,
  };
}

function buildUnavailable(reason: HealthSignalUnavailableReason): HealthSignalUnavailable {
  return { available: false, reason };
}

/**
 * A revoked/never-granted permission must NEVER surface a value, even if a
 * stale local blob happens to still carry one — otherwise `permission_denied`
 * could never actually be reached. Keyed on the CONNECTED provider identity
 * (the entity the OS permission was granted to: `record.provider` / the
 * snapshot's own key), not the upstream origin — that mirrors how HealthKit /
 * Health Connect / OAuth scopes are actually granted. An explicit grant wins
 * over a denial if a caller (incorrectly) sets both.
 */
function isDeniedForFamily(
  providerId: HealthProviderId,
  metricType: CanonicalHealthMetricType,
  connections: HealthSignalConnections | undefined,
): boolean {
  const c = connections?.[providerId];
  if (!c) return false;
  return c.deniedTypes.includes(metricType) && !c.grantedTypes.includes(metricType);
}

// ─── Internal helpers — winner selection ─────────────────────────────────────

/**
 * Picks the winning ORIGIN for a non-empty family of deduped records (priority
 * + freshness gate). Three-way result: `'no_candidates'` means every record
 * for this family belonged to an explicitly denied provider (or the family
 * was empty after that filter) — the caller falls through to the snapshot
 * plane and ultimately `reasonForNoData`, which reports `permission_denied`
 * honestly. `'expired'` means real, permitted candidates existed but all
 * aged past the §53 expiry window.
 */
function selectWinnerRecords(
  metricType: CanonicalHealthMetricType,
  familyRecords: readonly CanonicalHealthRecord[],
  nowMs: number,
  connections: HealthSignalConnections | undefined,
): { origin: HealthOriginId; records: CanonicalHealthRecord[] } | 'expired' | 'no_candidates' {
  const permitted = familyRecords.filter((r) => !isDeniedForFamily(r.provider, metricType, connections));
  if (permitted.length === 0) return 'no_candidates';
  const windows = dedupeWindowsFor(metricType);
  const latestByOrigin = new Map<HealthOriginId, number>();
  for (const r of permitted) {
    const origin = originOf(r);
    const t = Date.parse(r.observedAt);
    const cur = latestByOrigin.get(origin);
    if (cur == null || t > cur) latestByOrigin.set(origin, t);
  }
  const candidates: SourceCandidate[] = [...latestByOrigin.entries()].map(([origin, fetchedAtMs]) => ({
    origin,
    fetchedAtMs,
  }));
  const winner = selectPreferredSource(metricType, candidates, nowMs, windows);
  if (!winner) return 'expired';
  return { origin: winner.origin, records: permitted.filter((r) => originOf(r) === winner.origin) };
}

type SnapshotMetric = 'sleep_session' | 'resting_heart_rate' | 'steps' | 'workout';

function snapshotFieldFor(metricType: SnapshotMetric, snap: ProviderSnapshot): number | null {
  switch (metricType) {
    case 'sleep_session':
      return snap.sleepHoursLastNight ?? null;
    case 'resting_heart_rate':
      return snap.restingHeartRate ?? null;
    case 'steps':
      return snap.stepsToday ?? null;
    case 'workout':
      return snap.workoutMinutesToday ?? null;
  }
}

/** Snapshot-plane equivalent of `selectWinnerRecords` — priority + freshness gate over `ProviderBiometrics`. */
function selectWinnerSnapshot(
  metricType: SnapshotMetric,
  biometrics: ProviderBiometrics | undefined,
  nowMs: number,
  connections: HealthSignalConnections | undefined,
): { provider: HealthProviderId; fetchedAtMs: number; snapshot: ProviderSnapshot } | 'expired' | null {
  if (!biometrics) return null;
  const windows = dedupeWindowsFor(metricType);
  const candidates: SourceCandidate[] = [];
  const byProvider = new Map<HealthProviderId, ProviderSnapshot>();
  for (const key of Object.keys(biometrics) as HealthProviderId[]) {
    const snap = biometrics[key];
    if (!snap || snapshotFieldFor(metricType, snap) == null) continue;
    if (isDeniedForFamily(key, metricType, connections)) continue;
    candidates.push({ origin: key, fetchedAtMs: snap.fetchedAt });
    byProvider.set(key, snap);
  }
  if (candidates.length === 0) return null;
  const winner = selectPreferredSource(metricType, candidates, nowMs, windows);
  if (!winner) return 'expired';
  const provider = winner.origin as HealthProviderId;
  return { provider, fetchedAtMs: winner.fetchedAtMs, snapshot: byProvider.get(provider)! };
}

// ─── Internal helpers — unavailable-reason engine ────────────────────────────

/** Providers "present" for this family in ANY input shape, capability-eligible. */
function capableConnectedProviders(
  metricType: CanonicalHealthMetricType,
  input: ResolveHealthSignalsInput,
  dedupedRecords: readonly CanonicalHealthRecord[] | null,
  capabilities: Record<HealthProviderId, { recordTypes: readonly CanonicalHealthMetricType[] }>,
): Set<HealthProviderId> {
  const recordPresence = new Set<HealthProviderId>();
  if (dedupedRecords) {
    for (const r of dedupedRecords) {
      if (r.metricType !== metricType) continue;
      const origin = originOf(r);
      if (origin !== 'unknown_device_app') recordPresence.add(origin);
      recordPresence.add(r.provider);
    }
  }
  const set = new Set<HealthProviderId>();
  for (const pid of Object.keys(capabilities) as HealthProviderId[]) {
    if (!capabilities[pid].recordTypes.includes(metricType)) continue;
    const present =
      input.activeDirectProviders.has(pid) ||
      input.biometrics?.[pid] != null ||
      input.connections?.[pid] != null ||
      recordPresence.has(pid);
    if (present) set.add(pid);
  }
  return set;
}

function reasonForNoData(
  metricType: CanonicalHealthMetricType,
  input: ResolveHealthSignalsInput,
  dedupedRecords: readonly CanonicalHealthRecord[] | null,
  capabilities: Record<HealthProviderId, { recordTypes: readonly CanonicalHealthMetricType[] }>,
): HealthSignalUnavailableReason {
  const capable = capableConnectedProviders(metricType, input, dedupedRecords, capabilities);
  if (capable.size === 0) return 'no_provider';
  const withConnection = [...capable].filter((pid) => input.connections?.[pid] != null);
  const anyGranted = withConnection.some((pid) => input.connections![pid]!.grantedTypes.includes(metricType));
  const anyDenied = withConnection.some((pid) => input.connections![pid]!.deniedTypes.includes(metricType));
  if (withConnection.length > 0 && anyDenied && !anyGranted) return 'permission_denied';
  return 'no_data';
}

// ─── Per-family resolvers ─────────────────────────────────────────────────────

function resolveSleepDuration(
  input: ResolveHealthSignalsInput,
  dedupedRecords: readonly CanonicalHealthRecord[] | null,
  capabilities: Record<HealthProviderId, { recordTypes: readonly CanonicalHealthMetricType[] }>,
): HealthSignal<SleepSignalValue, 'hours'> {
  const metricType: CanonicalHealthMetricType = 'sleep_session';

  if (dedupedRecords) {
    const familyRecords = dedupedRecords.filter((r) => r.metricType === metricType);
    if (familyRecords.length > 0) {
      const winner = selectWinnerRecords(metricType, familyRecords, input.nowMs, input.connections);
      if (winner === 'expired') return buildUnavailable('stale_expired');
      if (winner !== 'no_candidates') {
        const chosen = freshest(winner.records); // most recent session from the winning origin ("last night")
        const sessionValue = asSleepSessionValue(chosen.value);
        if (sessionValue) {
          return readingFrom(chosen, 'sleep', input.nowMs, {
            value: { totalSleepHours: sessionValue.totalSleepHours, stages: sessionValue.stages },
            unit: 'hours',
          });
        }
      }
    }
  }

  const snapWinner = selectWinnerSnapshot('sleep_session', input.biometrics, input.nowMs, input.connections);
  if (snapWinner === 'expired') return buildUnavailable('stale_expired');
  if (snapWinner) {
    const hours = snapWinner.snapshot.sleepHoursLastNight!;
    const freshness = assessFreshness('sleep', snapWinner.fetchedAtMs, input.nowMs).rating;
    return {
      available: true,
      value: { totalSleepHours: hours, stages: null },
      unit: 'hours',
      source: snapWinner.provider,
      observedAtMs: snapWinner.fetchedAtMs,
      freshness,
      confidence: confidenceFor(freshness, true),
    };
  }

  return buildUnavailable(reasonForNoData(metricType, input, dedupedRecords, capabilities));
}

function resolveRestingHeartRate(
  input: ResolveHealthSignalsInput,
  dedupedRecords: readonly CanonicalHealthRecord[] | null,
  capabilities: Record<HealthProviderId, { recordTypes: readonly CanonicalHealthMetricType[] }>,
): HealthSignal<number, 'bpm'> {
  const metricType: CanonicalHealthMetricType = 'resting_heart_rate';

  if (dedupedRecords) {
    const familyRecords = dedupedRecords.filter((r) => r.metricType === metricType);
    if (familyRecords.length > 0) {
      const winner = selectWinnerRecords(metricType, familyRecords, input.nowMs, input.connections);
      if (winner === 'expired') return buildUnavailable('stale_expired');
      if (winner !== 'no_candidates') {
        const chosen = freshest(winner.records);
        const bpm = asNumber(chosen.value);
        if (bpm != null) return readingFrom(chosen, 'wearable_sync', input.nowMs, { value: bpm, unit: 'bpm' });
      }
    }
  }

  const snapWinner = selectWinnerSnapshot('resting_heart_rate', input.biometrics, input.nowMs, input.connections);
  if (snapWinner === 'expired') return buildUnavailable('stale_expired');
  if (snapWinner) {
    const freshness = assessFreshness('wearable_sync', snapWinner.fetchedAtMs, input.nowMs).rating;
    return {
      available: true,
      value: snapWinner.snapshot.restingHeartRate!,
      unit: 'bpm',
      source: snapWinner.provider,
      observedAtMs: snapWinner.fetchedAtMs,
      freshness,
      confidence: confidenceFor(freshness, true),
    };
  }

  return buildUnavailable(reasonForNoData(metricType, input, dedupedRecords, capabilities));
}

function resolveHrvSignal(
  input: ResolveHealthSignalsInput,
  dedupedRecords: readonly CanonicalHealthRecord[] | null,
  capabilities: Record<HealthProviderId, { recordTypes: readonly CanonicalHealthMetricType[] }>,
): HealthSignal<HrvSignalValue, 'ms'> {
  const metricType: CanonicalHealthMetricType = 'hrv';

  if (dedupedRecords) {
    const familyRecords = dedupedRecords.filter((r) => r.metricType === metricType);
    if (familyRecords.length > 0) {
      const methodsPresent = new Set(
        familyRecords
          .filter((r) => !isDeniedForFamily(r.provider, metricType, input.connections))
          .map((r) => r.hrvMethod)
          .filter((m): m is HrvMethod => m != null),
      );
      const winner = selectWinnerRecords(metricType, familyRecords, input.nowMs, input.connections);
      if (winner === 'expired') return buildUnavailable('stale_expired');
      if (winner !== 'no_candidates') {
        const chosen = freshest(winner.records);
        const ms = asNumber(chosen.value);
        const method = chosen.hrvMethod;
        if (ms != null && method != null) {
          const conflict = methodsPresent.size > 1 ? ('method_conflict_resolved' as const) : undefined;
          return readingFrom(
            chosen,
            'wearable_sync',
            input.nowMs,
            { value: { valueMs: ms, method }, unit: 'ms' },
            conflict,
          );
        }
      }
    }
  }

  // Snapshot fallback — honest per-provider HRV statistic via health-core's resolveHrv.
  if (input.biometrics) {
    const windows = dedupeWindowsFor(metricType);
    const candidates: SourceCandidate[] = [];
    const resolvedByProvider = new Map<HealthProviderId, { valueMs: number; method: HrvMethod; legacyTranslated: boolean }>();
    for (const key of Object.keys(input.biometrics) as HealthProviderId[]) {
      const snap = input.biometrics[key];
      if (!snap) continue;
      if (isDeniedForFamily(key, metricType, input.connections)) continue;
      const resolved = resolveHrv(snap);
      if (!resolved) continue;
      resolvedByProvider.set(key, resolved);
      candidates.push({ origin: key, fetchedAtMs: snap.fetchedAt });
    }
    if (candidates.length > 0) {
      const winner = selectPreferredSource(metricType, candidates, input.nowMs, windows);
      if (!winner) return buildUnavailable('stale_expired');
      const provider = winner.origin as HealthProviderId;
      const resolved = resolvedByProvider.get(provider)!;
      const methodsPresent = new Set([...resolvedByProvider.values()].map((r) => r.method));
      const freshness = assessFreshness('wearable_sync', winner.fetchedAtMs, input.nowMs).rating;
      const conflict = methodsPresent.size > 1 ? ('method_conflict_resolved' as const) : undefined;
      let confidence = confidenceFor(freshness, true);
      if ((resolved.legacyTranslated || conflict) && confidence === 'high') confidence = 'medium';
      return {
        available: true,
        value: { valueMs: resolved.valueMs, method: resolved.method },
        unit: 'ms',
        source: provider,
        observedAtMs: winner.fetchedAtMs,
        freshness,
        confidence,
        unavailableReason: conflict,
      };
    }
  }

  return buildUnavailable(reasonForNoData(metricType, input, dedupedRecords, capabilities));
}

function resolveWorkouts(
  input: ResolveHealthSignalsInput,
  dedupedRecords: readonly CanonicalHealthRecord[] | null,
  capabilities: Record<HealthProviderId, { recordTypes: readonly CanonicalHealthMetricType[] }>,
): HealthSignal<WorkoutSignalEntry[], 'entries'> {
  const metricType: CanonicalHealthMetricType = 'workout';

  if (dedupedRecords) {
    const familyRecords = dedupedRecords.filter((r) => r.metricType === metricType);
    if (familyRecords.length > 0) {
      const winner = selectWinnerRecords(metricType, familyRecords, input.nowMs, input.connections);
      if (winner === 'expired') return buildUnavailable('stale_expired');
      if (winner !== 'no_candidates') {
        const entries: WorkoutSignalEntry[] = [];
        for (const r of winner.records) {
          const wv = asWorkoutValue(r.value);
          if (!wv) continue;
          const attribution = attributionFor(r);
          entries.push({
            activityKind: wv.activityKind,
            durationMin: wv.durationMin,
            activeEnergyKcal: wv.activeEnergyKcal,
            avgHeartRateBpm: wv.avgHeartRateBpm,
            source: attribution.source,
            originalSource: attribution.originalSource,
            aggregator: attribution.aggregator,
            observedAtMs: Date.parse(r.observedAt),
          });
        }
        entries.sort((a, b) => b.observedAtMs - a.observedAtMs);
        if (entries.length > 0) {
          const top = entries[0];
          const freshness = assessFreshness('wearable_sync', top.observedAtMs, input.nowMs).rating;
          return {
            available: true,
            value: entries,
            unit: 'entries',
            source: top.source,
            originalSource: top.originalSource,
            aggregator: top.aggregator,
            observedAtMs: top.observedAtMs,
            freshness,
            confidence: confidenceFor(freshness, top.aggregator == null),
          };
        }
      }
    }
  }

  // Snapshot fallback — only a single unspecified daily total is available (no structured sessions).
  const snapWinner = selectWinnerSnapshot('workout', input.biometrics, input.nowMs, input.connections);
  if (snapWinner === 'expired') return buildUnavailable('stale_expired');
  if (snapWinner) {
    const freshness = assessFreshness('wearable_sync', snapWinner.fetchedAtMs, input.nowMs).rating;
    const entry: WorkoutSignalEntry = {
      activityKind: 'unspecified',
      durationMin: snapWinner.snapshot.workoutMinutesToday!,
      activeEnergyKcal: null,
      avgHeartRateBpm: null,
      source: snapWinner.provider,
      observedAtMs: snapWinner.fetchedAtMs,
    };
    return {
      available: true,
      value: [entry],
      unit: 'entries',
      source: snapWinner.provider,
      observedAtMs: snapWinner.fetchedAtMs,
      freshness,
      confidence: confidenceFor(freshness, true),
    };
  }

  return buildUnavailable(reasonForNoData(metricType, input, dedupedRecords, capabilities));
}

function resolveSteps(
  input: ResolveHealthSignalsInput,
  dedupedRecords: readonly CanonicalHealthRecord[] | null,
  capabilities: Record<HealthProviderId, { recordTypes: readonly CanonicalHealthMetricType[] }>,
): HealthSignal<number, 'count'> {
  const metricType: CanonicalHealthMetricType = 'steps';

  if (dedupedRecords) {
    const familyRecords = dedupedRecords.filter((r) => r.metricType === metricType);
    if (familyRecords.length > 0) {
      const winner = selectWinnerRecords(metricType, familyRecords, input.nowMs, input.connections);
      if (winner === 'expired') return buildUnavailable('stale_expired');
      if (winner !== 'no_candidates') {
        // Sum within the ONE winning origin's own samples (granular counts for the
        // same provider) — never across providers, which stays a single winner.
        const nums = winner.records.map((r) => asNumber(r.value)).filter((n): n is number => n != null);
        if (nums.length > 0) {
          const total = nums.reduce((a, b) => a + b, 0);
          return readingFrom(freshest(winner.records), 'wearable_sync', input.nowMs, { value: total, unit: 'count' });
        }
      }
    }
  }

  const snapWinner = selectWinnerSnapshot('steps', input.biometrics, input.nowMs, input.connections);
  if (snapWinner === 'expired') return buildUnavailable('stale_expired');
  if (snapWinner) {
    const freshness = assessFreshness('wearable_sync', snapWinner.fetchedAtMs, input.nowMs).rating;
    return {
      available: true,
      value: snapWinner.snapshot.stepsToday!,
      unit: 'count',
      source: snapWinner.provider,
      observedAtMs: snapWinner.fetchedAtMs,
      freshness,
      confidence: confidenceFor(freshness, true),
    };
  }

  return buildUnavailable(reasonForNoData(metricType, input, dedupedRecords, capabilities));
}

function resolveProviderScores(
  input: ResolveHealthSignalsInput,
  dedupedRecords: readonly CanonicalHealthRecord[] | null,
): readonly ProviderScoreEntry[] {
  const entries: ProviderScoreEntry[] = [];

  const hasScoreRecords = dedupedRecords?.some((r) => r.metricType === 'provider_score') ?? false;
  if (hasScoreRecords && dedupedRecords) {
    for (const r of dedupedRecords) {
      if (r.metricType !== 'provider_score' || !r.scoreKind) continue;
      if (isDeniedForFamily(r.provider, 'provider_score', input.connections)) continue;
      const value = asNumber(r.value);
      if (value == null) continue;
      const observedAtMs = Date.parse(r.observedAt);
      const freshness = assessFreshness('wearable_sync', observedAtMs, input.nowMs).rating;
      entries.push({
        kind: r.scoreKind,
        provider: r.provider,
        value,
        unit: 'score',
        observedAtMs,
        freshness,
        confidence: confidenceFor(freshness, isDirect(r)),
        originalSource: r.originalSource,
      });
    }
    return entries;
  }

  const biometrics = input.biometrics;
  if (!biometrics) return entries;

  const pushScore = (
    pid: HealthProviderId,
    kind: ProviderScoreKind,
    value: number | null | undefined,
    fetchedAt: number,
  ) => {
    if (value == null || !Number.isFinite(value)) return;
    if (isDeniedForFamily(pid, 'provider_score', input.connections)) return;
    const freshness = assessFreshness('wearable_sync', fetchedAt, input.nowMs).rating;
    entries.push({
      kind,
      provider: pid,
      value,
      unit: 'score',
      observedAtMs: fetchedAt,
      freshness,
      confidence: confidenceFor(freshness, true),
    });
  };

  const whoop = biometrics.whoop;
  if (whoop) {
    pushScore('whoop', 'whoop_recovery', whoop.recoveryPct, whoop.fetchedAt);
    pushScore('whoop', 'whoop_strain', whoop.strain, whoop.fetchedAt);
  }
  const oura = biometrics.oura;
  if (oura) pushScore('oura', 'oura_readiness', oura.readinessScore, oura.fetchedAt);
  const garmin = biometrics.garmin;
  if (garmin) pushScore('garmin', 'garmin_stress', garmin.stressScore, garmin.fetchedAt);
  const strava = biometrics.strava;
  if (strava) pushScore('strava', 'strava_training_load', strava.trainingLoad, strava.fetchedAt);

  return entries;
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * THE canonical health-signal selector. Pure: same inputs (any record order)
 * ⇒ same output. See file header for the full contract.
 */
export function resolveHealthSignals(input: ResolveHealthSignalsInput): HealthSignals {
  const dedupedRecords = input.records
    ? dedupeRecords(input.records, { activeDirectProviders: input.activeDirectProviders }).kept
    : null;

  const capabilities = HEALTH_PROVIDER_CAPABILITIES;

  return {
    sleepDuration: resolveSleepDuration(input, dedupedRecords, capabilities),
    restingHeartRate: resolveRestingHeartRate(input, dedupedRecords, capabilities),
    hrv: resolveHrvSignal(input, dedupedRecords, capabilities),
    workouts: resolveWorkouts(input, dedupedRecords, capabilities),
    steps: resolveSteps(input, dedupedRecords, capabilities),
    providerScores: resolveProviderScores(input, dedupedRecords),
  };
}
