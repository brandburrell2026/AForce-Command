/**
 * Deterministic, provider-neutral deduplication for canonical health records.
 *
 * Solves the double-count paths named in the integration plan:
 *   1. Oura direct  vs Oura re-exported through Apple Health
 *   2. Garmin direct vs Garmin re-exported through Apple Health
 *   3. WHOOP direct vs WHOOP-exported platform-store records
 *   4. Samsung Health records delivered through Health Connect
 * plus duplicate sync retries, overlapping sleep/workout sessions, and
 * aggregate step totals vs granular samples.
 *
 * INVARIANTS
 *   - Never silently double-count an observation, session, workout, or step
 *     total. Every dropped record is returned with an explicit reason.
 *   - Deterministic: same inputs (any order) ⇒ same survivors. No clocks.
 *   - Provenance is never destroyed: survivors keep their chains; drops
 *     reference the surviving key.
 *   - Cross-provider SELECTION is priority-then-freshness by metric family —
 *     deliberately NOT freshest-wins for every metric (see SOURCE_PRIORITY).
 */

import type {
  CanonicalHealthMetricType,
  CanonicalHealthRecord,
  HealthOriginId,
  HealthProviderId,
  ProvenanceHop,
} from './contracts';

// ─── Origin resolution ───────────────────────────────────────────────────────

/**
 * Native origin identifiers → AForce provider ids. HealthKit exposes the
 * writing app's bundle id (sourceRevision); Health Connect exposes the
 * package name (dataOrigin). Unmapped origins resolve to
 * 'unknown_device_app' — kept and attributed, never claimed as first-party.
 */
export const NATIVE_ORIGIN_MAP: Readonly<Record<string, HealthProviderId>> = {
  // iOS bundle identifiers
  'com.ouraring.oura': 'oura',
  'com.garmin.connect.mobile': 'garmin',
  'com.whoop.iphone': 'whoop',
  'com.samsung.shealth': 'samsung_health',
  'com.strava.stravaride': 'strava',
  // Android package names
  'com.ouraring.oura.android': 'oura',
  'com.garmin.android.apps.connectmobile': 'garmin',
  'com.whoop.android': 'whoop',
  'com.sec.android.app.shealth': 'samsung_health',
  'com.strava': 'strava',
};

export function resolveNativeOrigin(nativeOrigin: string | undefined): HealthOriginId {
  if (!nativeOrigin) return 'unknown_device_app';
  return NATIVE_ORIGIN_MAP[nativeOrigin] ?? 'unknown_device_app';
}

/** A record's ORIGIN is hop 0 of its provenance chain. */
export function originOf(record: CanonicalHealthRecord): HealthOriginId {
  const first: ProvenanceHop | undefined = record.provenanceChain[0];
  return first ? first.provider : record.provider;
}

/** Direct = delivered by its origin (chain length ≤ 1). */
export function isDirect(record: CanonicalHealthRecord): boolean {
  return record.provenanceChain.length <= 1;
}

// ─── Identity (deduplication key) ────────────────────────────────────────────

/**
 * Deterministic identity:
 *   with a provider-native id:  userId|type|origin|ext:<externalId>
 *   without:                    userId|type|origin|win:<startUtc>|<endUtc|observedAt>
 * Re-syncing the same record always rebuilds the same key ⇒ retries upsert
 * instead of duplicating (idempotency).
 */
export function buildDeduplicationKey(r: {
  userId: string;
  metricType: CanonicalHealthMetricType;
  origin: HealthOriginId;
  externalId?: string;
  startTime?: string;
  endTime?: string;
  observedAt: string;
}): string {
  const base = `${r.userId}|${r.metricType}|${r.origin}`;
  if (r.externalId) return `${base}|ext:${r.externalId}`;
  const start = r.startTime ?? r.observedAt;
  const end = r.endTime ?? r.observedAt;
  return `${base}|win:${start}|${end}`;
}

// ─── Time / value comparison helpers ─────────────────────────────────────────

function windowMs(r: CanonicalHealthRecord): { start: number; end: number } | null {
  const start = Date.parse(r.startTime ?? r.observedAt);
  const end = Date.parse(r.endTime ?? r.observedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return { start, end: Math.max(start, end) };
}

/** Overlap as a fraction of the SHORTER window (0 when either is a point). */
export function windowOverlapFraction(a: CanonicalHealthRecord, b: CanonicalHealthRecord): number {
  const wa = windowMs(a);
  const wb = windowMs(b);
  if (!wa || !wb) return 0;
  const overlap = Math.min(wa.end, wb.end) - Math.max(wa.start, wb.start);
  const shorter = Math.min(wa.end - wa.start, wb.end - wb.start);
  if (shorter <= 0 || overlap <= 0) return 0;
  return overlap / shorter;
}

export function valuesWithinTolerance(a: unknown, b: unknown, tolerancePct: number): boolean {
  if (typeof a !== 'number' || typeof b !== 'number') return true; // structured values: window rules decide
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  if (scale === 0) return true;
  return Math.abs(a - b) / scale <= tolerancePct / 100;
}

// ─── Cross-provider source priority (documented strategy, per family) ────────

/**
 * SOURCE-PRIORITY STRATEGY BY METRIC FAMILY (deliberately not freshest-wins):
 *
 * sleep_session / hrv / resting_heart_rate / heart_rate_summary /
 * respiratory_rate — dedicated recovery wearables measure these continuously
 * with validated pipelines; platform aggregators mix re-exports with phone
 * estimates. Direct wearable > aggregator > unknown app.
 *
 * steps / active_energy / daily activity — platform aggregators already
 * reconcile watch-vs-phone double counting internally, so the aggregator
 * outranks individual cloud providers here. NEVER summed across providers.
 *
 * workout — activity-first providers lead; aggregators follow.
 *
 * provider_score — NO cross-provider selection ever: scores are attributed
 *   to their provider and displayed as such, never merged or ranked.
 *
 * Freshness gate (applied by selectPreferredSource): expired candidates are
 * ineligible; a stale higher-priority source loses to a fresh lower-priority
 * one. This unifies the two shipped philosophies (signalHierarchy's pure
 * ladder + biometricsAggregator's freshest-wins) into one deterministic rule.
 */
export const SOURCE_PRIORITY: Readonly<
  Partial<Record<CanonicalHealthMetricType, readonly HealthOriginId[]>>
> = {
  sleep_session: ['whoop', 'oura', 'garmin', 'samsung_health', 'apple_health', 'google_health', 'unknown_device_app'],
  hrv: ['whoop', 'oura', 'garmin', 'apple_health', 'samsung_health', 'google_health', 'unknown_device_app'],
  resting_heart_rate: ['whoop', 'oura', 'garmin', 'apple_health', 'samsung_health', 'google_health', 'unknown_device_app'],
  heart_rate_summary: ['whoop', 'oura', 'garmin', 'apple_health', 'samsung_health', 'google_health', 'unknown_device_app'],
  respiratory_rate: ['whoop', 'oura', 'garmin', 'apple_health', 'samsung_health', 'google_health', 'unknown_device_app'],
  steps: ['apple_health', 'google_health', 'garmin', 'samsung_health', 'oura', 'unknown_device_app'],
  active_energy: ['apple_health', 'google_health', 'garmin', 'samsung_health', 'oura', 'unknown_device_app'],
  workout: ['strava', 'garmin', 'whoop', 'oura', 'apple_health', 'google_health', 'samsung_health', 'unknown_device_app'],
  // provider_score intentionally absent — attributed, never selected across providers.
};

export interface FreshnessWindowsMs {
  staleAfterMs: number;
  expireAfterMs: number | null; // null = never expires
}

export interface SourceCandidate {
  origin: HealthOriginId;
  fetchedAtMs: number;
}

/**
 * Pick the winning SOURCE for a metric family among deduplicated candidates.
 * Priority ladder first; freshness gates it: expired → ineligible; if the
 * ladder winner is stale and any candidate is non-stale, the best non-stale
 * candidate (by ladder order) wins instead. Deterministic; clock injected.
 */
export function selectPreferredSource(
  metricType: CanonicalHealthMetricType,
  candidates: readonly SourceCandidate[],
  nowMs: number,
  windows: FreshnessWindowsMs,
): SourceCandidate | null {
  if (metricType === 'provider_score') return null; // never cross-selected
  const ladder = SOURCE_PRIORITY[metricType];
  if (!ladder || candidates.length === 0) return null;

  const eligible = candidates.filter((c) => {
    if (windows.expireAfterMs == null) return true;
    return nowMs - c.fetchedAtMs <= windows.expireAfterMs;
  });
  if (eligible.length === 0) return null;

  const rank = (c: SourceCandidate) => {
    const i = ladder.indexOf(c.origin);
    return i === -1 ? ladder.length : i;
  };
  const isStale = (c: SourceCandidate) => nowMs - c.fetchedAtMs > windows.staleAfterMs;
  const byLadder = [...eligible].sort((a, b) => rank(a) - rank(b) || b.fetchedAtMs - a.fetchedAtMs);

  const top = byLadder[0];
  if (!isStale(top)) return top;
  const freshAlternative = byLadder.find((c) => !isStale(c));
  return freshAlternative ?? top; // everyone stale → ladder winner, honestly stale
}

// ─── The deduplication pass ──────────────────────────────────────────────────

export type DropReason =
  | 'retry_duplicate'            // same dedup key — idempotent upsert
  | 'aggregator_copy_of_direct'  // origin has an active direct connection
  | 'overlapping_same_origin';   // ≥ overlap threshold, same origin+type

export interface DedupeOptions {
  /** Providers with an ACTIVE direct connection for this user. */
  activeDirectProviders: ReadonlySet<HealthProviderId>;
  /** Same-origin window overlap ⇒ same record. Default 0.8. */
  overlapThreshold?: number;
  /** Numeric value tolerance (%) for overlap identity. Default 5. */
  valueTolerancePct?: number;
}

export interface DedupeResult {
  kept: CanonicalHealthRecord[];
  dropped: { record: CanonicalHealthRecord; reason: DropReason; survivorKey: string }[];
}

function chainRank(r: CanonicalHealthRecord): number {
  return r.provenanceChain.length; // shorter = more direct = better
}

function preferred(a: CanonicalHealthRecord, b: CanonicalHealthRecord): CanonicalHealthRecord {
  if (chainRank(a) !== chainRank(b)) return chainRank(a) < chainRank(b) ? a : b;
  const sa = Date.parse(a.syncedAt);
  const sb = Date.parse(b.syncedAt);
  if (sa !== sb) return sa > sb ? a : b; // retries: newest sync wins (upsert)
  return a.deduplicationKey <= b.deduplicationKey ? a : b; // total order → determinism
}

/**
 * Deduplicate a batch (incoming + existing together). Order-independent.
 *
 * Passes, in order:
 *  1. Key-identical collapse (retry idempotency; upsert semantics).
 *  2. Aggregator-copy drop: chain length > 1 AND origin ∈ activeDirectProviders
 *     ⇒ the direct feed is authoritative — covers Oura/Garmin-via-HealthKit,
 *     WHOOP-via-platform-store. Samsung-via-Health-Connect survives (no direct
 *     Samsung connection exists) with its chain intact — honest attribution.
 *  3. Same-origin overlap collapse (sessions/windows): overlap ≥ threshold and
 *     numeric values within tolerance ⇒ one record; more-direct chain wins.
 *     Cross-ORIGIN records are NEVER collapsed — two real wearables both
 *     measuring sleep is real data; selection (not deletion) chooses a winner
 *     via selectPreferredSource at read time.
 */
export function dedupeRecords(
  records: readonly CanonicalHealthRecord[],
  opts: DedupeOptions,
): DedupeResult {
  const overlapThreshold = opts.overlapThreshold ?? 0.8;
  const tolerancePct = opts.valueTolerancePct ?? 5;
  const dropped: DedupeResult['dropped'] = [];

  // Pass 1 — collapse identical keys (idempotent retries).
  const byKey = new Map<string, CanonicalHealthRecord>();
  // Stable processing order for determinism regardless of input order.
  const sorted = [...records].sort((a, b) =>
    a.deduplicationKey.localeCompare(b.deduplicationKey) || a.syncedAt.localeCompare(b.syncedAt),
  );
  for (const r of sorted) {
    const cur = byKey.get(r.deduplicationKey);
    if (!cur) {
      byKey.set(r.deduplicationKey, r);
    } else {
      const win = preferred(cur, r);
      const lose = win === cur ? r : cur;
      byKey.set(r.deduplicationKey, win);
      dropped.push({ record: lose, reason: 'retry_duplicate', survivorKey: win.deduplicationKey });
    }
  }

  // Pass 2 — drop aggregator copies whose origin is directly connected.
  const afterDirect: CanonicalHealthRecord[] = [];
  for (const r of byKey.values()) {
    const origin = originOf(r);
    if (
      !isDirect(r) &&
      origin !== 'unknown_device_app' &&
      opts.activeDirectProviders.has(origin as HealthProviderId)
    ) {
      dropped.push({
        record: r,
        reason: 'aggregator_copy_of_direct',
        survivorKey: `${r.userId}|${r.metricType}|${origin}|direct`,
      });
      continue;
    }
    afterDirect.push(r);
  }

  // Pass 3 — same-origin overlapping sessions/windows.
  const kept: CanonicalHealthRecord[] = [];
  for (const r of afterDirect) {
    const clashIdx = kept.findIndex(
      (k) =>
        k.userId === r.userId &&
        k.metricType === r.metricType &&
        originOf(k) === originOf(r) &&
        windowOverlapFraction(k, r) >= overlapThreshold &&
        valuesWithinTolerance(k.value, r.value, tolerancePct),
    );
    if (clashIdx === -1) {
      kept.push(r);
      continue;
    }
    const win = preferred(kept[clashIdx], r);
    const lose = win === kept[clashIdx] ? r : kept[clashIdx];
    kept[clashIdx] = win;
    dropped.push({ record: lose, reason: 'overlapping_same_origin', survivorKey: win.deduplicationKey });
  }

  // Determinism of output ordering.
  kept.sort((a, b) => a.deduplicationKey.localeCompare(b.deduplicationKey));
  return { kept, dropped };
}
