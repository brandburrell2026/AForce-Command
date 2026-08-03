/**
 * WEEKLY HEALTH AGGREGATES — deterministic fixtures for the scenarios named
 * in the W3.4 brief. Pure data only (no RN, no clocks — every timestamp is
 * derived from the frozen `FIXED_NOW`). Mirrors the builder-function
 * convention used by `signalResolutionFixtures.ts`. See
 * `__tests__/weeklyHealthAggregates.test.ts` for the assertions each fixture
 * exists to prove.
 */
import {
  buildDeduplicationKey,
  HEALTH_RECORD_SCHEMA_VERSION,
  type CanonicalHealthMetricType,
  type CanonicalHealthRecord,
  type CanonicalHealthValue,
  type HealthProviderId,
  type HrvMethod,
  type ProviderScoreKind,
  type ProvenanceHop,
} from '@workspace/health-core';
import { defaultDayBoundariesMs } from './weeklyHealthAggregates';
import type { HealthSignals } from './signalResolution';

export const FIXED_NOW = new Date('2026-08-03T12:00:00Z').getTime();
export const HOUR = 60 * 60_000;
export const DAY = 24 * HOUR;
export const DAYS = 7;
export const UTC_OFFSET_MIN = 0;

/** Standard UTC-aligned 7-day window ending on the local day containing FIXED_NOW. */
export const WEEK_BOUNDARIES_UTC = defaultDayBoundariesMs(DAYS, UTC_OFFSET_MIN, FIXED_NOW);

/** A timestamp safely inside local day `dayIndex`'s bucket (midday — never near an edge). */
export function dayMidMs(dayIndex: number, boundaries: readonly number[] = WEEK_BOUNDARIES_UTC): number {
  return boundaries[dayIndex] + 12 * HOUR;
}

const USER_ID = 'user-1';

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

interface MkRecordOverrides {
  provider: HealthProviderId;
  metricType: CanonicalHealthMetricType;
  value: CanonicalHealthValue;
  observedAtMs: number;
  syncedAtMs?: number;
  startTimeMs?: number;
  endTimeMs?: number;
  provenanceChain?: ProvenanceHop[];
  originalSource?: string;
  hrvMethod?: HrvMethod;
  scoreKind?: ProviderScoreKind;
  externalId?: string;
}

/** Deterministic default id — unique per (provider, metric, instant, window) without shared mutable counter state. */
function defaultExternalId(o: MkRecordOverrides): string {
  return `${o.provider}-${o.metricType}-${o.observedAtMs}-${o.startTimeMs ?? ''}-${o.endTimeMs ?? ''}`;
}

export function mkRecord(o: MkRecordOverrides): CanonicalHealthRecord {
  const provenanceChain: ProvenanceHop[] = o.provenanceChain ?? [{ provider: o.provider, transport: 'measured' }];
  const origin = provenanceChain[0].provider;
  const observedAt = iso(o.observedAtMs);
  const syncedAt = iso(o.syncedAtMs ?? o.observedAtMs);
  const externalId = o.externalId ?? defaultExternalId(o);
  const deduplicationKey = buildDeduplicationKey({
    userId: USER_ID,
    metricType: o.metricType,
    origin,
    externalId,
    startTime: o.startTimeMs != null ? iso(o.startTimeMs) : undefined,
    endTime: o.endTimeMs != null ? iso(o.endTimeMs) : undefined,
    observedAt,
  });
  return {
    schemaVersion: HEALTH_RECORD_SCHEMA_VERSION,
    userId: USER_ID,
    provider: o.provider,
    originalSource: o.originalSource,
    externalId,
    metricType: o.metricType,
    value: o.value,
    startTime: o.startTimeMs != null ? iso(o.startTimeMs) : undefined,
    endTime: o.endTimeMs != null ? iso(o.endTimeMs) : undefined,
    observedAt,
    syncedAt,
    hrvMethod: o.hrvMethod,
    scoreKind: o.scoreKind,
    provenanceChain,
    deduplicationKey,
  };
}

// ─── 1. Full week, single provider — clean aggregation math ────────────────

/** Hand-computed elsewhere in the test: mean 7.2, min 6.5, max 8.0. */
export const FULL_WEEK_SLEEP_HOURS = [7.0, 7.5, 6.5, 8.0, 7.2, 6.8, 7.4] as const;

export const FULL_WEEK_SLEEP_RECORDS: CanonicalHealthRecord[] = FULL_WEEK_SLEEP_HOURS.map((hours, dayIndex) =>
  mkRecord({
    provider: 'oura',
    metricType: 'sleep_session',
    value: { totalSleepHours: hours, inBedHours: hours + 0.4, stages: null },
    observedAtMs: dayMidMs(dayIndex),
    startTimeMs: dayMidMs(dayIndex) - 8 * HOUR,
    endTimeMs: dayMidMs(dayIndex),
  }),
);

// ─── 2. Missing days — partial week, still above coverage threshold ────────

/** Sleep present only on days 0, 2, 4, 6 (4 of 7) — days 1, 3, 5 are honestly missing. */
export const MISSING_DAYS_SLEEP_RECORDS: CanonicalHealthRecord[] = [0, 2, 4, 6].map((dayIndex) =>
  mkRecord({
    provider: 'whoop',
    metricType: 'sleep_session',
    value: { totalSleepHours: 7.0 + dayIndex * 0.1, inBedHours: null, stages: null },
    observedAtMs: dayMidMs(dayIndex),
    startTimeMs: dayMidMs(dayIndex) - 7 * HOUR,
    endTimeMs: dayMidMs(dayIndex),
  }),
);

// ─── 3. Insufficient data — below the default 3-of-7 coverage threshold ────

/** Sleep present only on days 5, 6 (2 of 7) — below default minCoverageDays (3). */
export const INSUFFICIENT_DATA_SLEEP_RECORDS: CanonicalHealthRecord[] = [5, 6].map((dayIndex) =>
  mkRecord({
    provider: 'oura',
    metricType: 'sleep_session',
    value: { totalSleepHours: 6.0, inBedHours: null, stages: null },
    observedAtMs: dayMidMs(dayIndex),
    startTimeMs: dayMidMs(dayIndex) - 6 * HOUR,
    endTimeMs: dayMidMs(dayIndex),
  }),
);

// ─── 4. Duplicated source week — Oura direct + Oura-via-Apple, same nights ─
// Three nights (0, 1, 2), each with BOTH a direct Oura RHR reading and an
// Apple Health re-export of the exact same Oura sample. Dedup (Pass 2 —
// aggregator-copy-of-direct) must collapse each night to ONE reading before
// any weekly aggregation happens, so coverage.covered === 3, not a
// double-counted 6, and the mean is computed over the 3 direct values only.

export const DUPLICATED_SOURCE_RHR_DIRECT_VALUES = [50, 52, 49] as const;

export const DUPLICATED_SOURCE_WEEK_RECORDS: CanonicalHealthRecord[] = [0, 1, 2].flatMap((dayIndex, i) => {
  const observedAtMs = dayMidMs(dayIndex);
  const directValue = DUPLICATED_SOURCE_RHR_DIRECT_VALUES[i];
  return [
    mkRecord({
      provider: 'oura',
      metricType: 'resting_heart_rate',
      value: directValue,
      observedAtMs,
      externalId: `oura-rhr-day${dayIndex}`,
    }),
    mkRecord({
      provider: 'apple_health',
      metricType: 'resting_heart_rate',
      value: directValue + 3, // the aggregator copy's own (slightly different) sample — must be DROPPED, not blended
      observedAtMs,
      provenanceChain: [
        { provider: 'oura', nativeOrigin: 'com.ouraring.oura', transport: 'measured' },
        { provider: 'apple_health', transport: 'aggregator_export' },
      ],
      originalSource: 'com.ouraring.oura',
      externalId: `apple-oura-copy-day${dayIndex}`,
    }),
  ];
});

export const DUPLICATED_SOURCE_ACTIVE_DIRECT_PROVIDERS = new Set<HealthProviderId>(['oura']);

// ─── 5. HRV method-conflict week — dominant method wins, minority excluded ─
// 5 days of apple_health SDNN, 2 days of garmin RMSSD — one HRV record per
// day so per-day source selection is trivial (this fixture is about the
// WEEK-level method roll-up, not a same-day cross-provider pick).

export const HRV_SDNN_DAYS = [0, 1, 2, 3, 4] as const;
export const HRV_RMSSD_DAYS = [5, 6] as const;
export const HRV_SDNN_VALUES = [40, 42, 38, 45, 41] as const;
export const HRV_RMSSD_VALUES = [30, 33] as const;

export const HRV_METHOD_CONFLICT_WEEK_RECORDS: CanonicalHealthRecord[] = [
  ...HRV_SDNN_DAYS.map((dayIndex, i) =>
    mkRecord({
      provider: 'apple_health',
      metricType: 'hrv',
      value: HRV_SDNN_VALUES[i],
      hrvMethod: 'sdnn' as HrvMethod,
      observedAtMs: dayMidMs(dayIndex),
    }),
  ),
  ...HRV_RMSSD_DAYS.map((dayIndex, i) =>
    mkRecord({
      provider: 'garmin',
      metricType: 'hrv',
      value: HRV_RMSSD_VALUES[i],
      hrvMethod: 'rmssd' as HrvMethod,
      observedAtMs: dayMidMs(dayIndex),
    }),
  ),
];

// ─── 5b. HRV method-conflict week WITH a genuine gap — coverage must count
// ONLY method-valid (dominant) observations, distinct from both "missing
// entirely" and "excluded for wrong method". 3 sdnn days (dominant, at the
// coverage floor), 2 rmssd days (excluded), 2 genuinely empty days.

export const HRV_GAP_SDNN_DAYS = [0, 1, 2] as const;
export const HRV_GAP_RMSSD_DAYS = [3, 4] as const;
// days 5, 6 — no HRV record at all (honestly missing, not method-excluded).
export const HRV_GAP_SDNN_VALUES = [44, 46, 43] as const;
export const HRV_GAP_RMSSD_VALUES = [28, 31] as const;

export const HRV_METHOD_CONFLICT_WITH_GAP_WEEK_RECORDS: CanonicalHealthRecord[] = [
  ...HRV_GAP_SDNN_DAYS.map((dayIndex, i) =>
    mkRecord({
      provider: 'apple_health',
      metricType: 'hrv',
      value: HRV_GAP_SDNN_VALUES[i],
      hrvMethod: 'sdnn' as HrvMethod,
      observedAtMs: dayMidMs(dayIndex),
    }),
  ),
  ...HRV_GAP_RMSSD_DAYS.map((dayIndex, i) =>
    mkRecord({
      provider: 'garmin',
      metricType: 'hrv',
      value: HRV_GAP_RMSSD_VALUES[i],
      hrvMethod: 'rmssd' as HrvMethod,
      observedAtMs: dayMidMs(dayIndex),
    }),
  ),
];

// ─── 6. Timezone week — local-day bucketing under a non-zero offset ────────
// PDT (UTC-7 => -420 min). Local midnight falls at 07:00 UTC, so a reading
// observed at 2026-08-04T06:30Z is 2026-08-03T23:30 LOCAL — it must bucket
// into the local day CONTAINING FIXED_NOW's local calendar date (dayIndex =
// DAYS - 1, "today"), not the later UTC calendar date the raw timestamp prints.

export const PDT_OFFSET_MIN = -420;
export const TIMEZONE_WEEK_BOUNDARIES = defaultDayBoundariesMs(DAYS, PDT_OFFSET_MIN, FIXED_NOW);

export const TIMEZONE_WEEK_LATE_LOCAL_NIGHT_RECORD: CanonicalHealthRecord = mkRecord({
  provider: 'apple_health',
  metricType: 'resting_heart_rate',
  value: 55,
  // 30 minutes before the LAST boundary (today's local midnight, PDT) — must
  // land in the most recent day's bucket (dayIndex = DAYS - 1), even though
  // its UTC calendar date is one day later.
  observedAtMs: TIMEZONE_WEEK_BOUNDARIES[DAYS] - 30 * 60_000,
});

/** Days 0–5 of the same PDT week, each at local midday — a clean baseline the late-night day-6 record is added on top of. */
export const TIMEZONE_WEEK_MIDDAY_RHR_VALUES = [50, 51, 52, 53, 54, 56] as const;

export const TIMEZONE_WEEK_MIDDAY_RECORDS: CanonicalHealthRecord[] = TIMEZONE_WEEK_MIDDAY_RHR_VALUES.map(
  (value, dayIndex) =>
    mkRecord({
      provider: 'apple_health',
      metricType: 'resting_heart_rate',
      value,
      observedAtMs: dayMidMs(dayIndex, TIMEZONE_WEEK_BOUNDARIES),
    }),
);

// ─── 7. DST week — a non-uniform (23h "spring forward") day mid-week ───────
// Explicit boundaries where day 3 is only 23 hours (clocks jump forward at
// its end). Proves bucketing is correct against ANY strictly-increasing
// boundary set, not just uniform 24h spacing — no record double-counted,
// no day silently empty because of the shortened window.

export function buildDstWeekBoundaries(): number[] {
  const uniform = defaultDayBoundariesMs(DAYS, UTC_OFFSET_MIN, FIXED_NOW);
  const dst = [...uniform];
  // Shift every boundary from index 4 onward back by 1 hour, making the
  // interval [boundaries[3], boundaries[4]) only 23 hours (day 3 = the
  // "spring forward" day) while every other day stays a full 24h.
  for (let i = 4; i < dst.length; i++) {
    dst[i] = dst[i] - HOUR;
  }
  return dst;
}

export const DST_WEEK_BOUNDARIES = buildDstWeekBoundaries();

/** One steps reading per day, placed 1 minute after each day's own start boundary — including the shortened day 3. */
export const DST_WEEK_STEPS_RECORDS: CanonicalHealthRecord[] = Array.from({ length: DAYS }, (_, dayIndex) =>
  mkRecord({
    provider: 'apple_health',
    metricType: 'steps',
    value: 1000 * (dayIndex + 1),
    observedAtMs: DST_WEEK_BOUNDARIES[dayIndex] + 60_000,
  }),
);

/** Exactly at the boundary between day 3 and day 4 — must count for day 4 (half-open interval), never day 3, never both. */
export const DST_WEEK_BOUNDARY_EDGE_RECORD: CanonicalHealthRecord = mkRecord({
  provider: 'apple_health',
  metricType: 'steps',
  value: 9999,
  observedAtMs: DST_WEEK_BOUNDARIES[4],
  externalId: 'dst-edge-record',
});

// ─── 8. Provider scores — attributed per (provider, kind), never blended ───

export const WHOOP_RECOVERY_VALUES_BY_DAY: Record<number, number> = { 1: 62, 2: 70, 3: 55, 4: 80, 5: 65 };

export const PROVIDER_SCORE_WEEK_RECORDS: CanonicalHealthRecord[] = Object.entries(WHOOP_RECOVERY_VALUES_BY_DAY).map(
  ([dayIndexStr, value]) => {
    const dayIndex = Number(dayIndexStr);
    return mkRecord({
      provider: 'whoop',
      metricType: 'provider_score',
      scoreKind: 'whoop_recovery',
      value,
      observedAtMs: dayMidMs(dayIndex),
    });
  },
);

// ─── 8b. Same-day, DISTINCT providers — must never collapse into each other ─
// WHOOP recovery and Oura readiness both land on day 3 of the SAME week.
// They share nothing but the calendar day: different provider, different
// scoreKind. Correct keying is (provider, kind[, day]) — never day alone.

export const SAME_DAY_WHOOP_RECOVERY_VALUE = 58;
export const SAME_DAY_OURA_READINESS_VALUE = 74;

export const SAME_DAY_DISTINCT_PROVIDER_SCORE_RECORDS: CanonicalHealthRecord[] = [
  mkRecord({
    provider: 'whoop',
    metricType: 'provider_score',
    scoreKind: 'whoop_recovery',
    value: SAME_DAY_WHOOP_RECOVERY_VALUE,
    observedAtMs: dayMidMs(3),
  }),
  mkRecord({
    provider: 'oura',
    metricType: 'provider_score',
    scoreKind: 'oura_readiness',
    value: SAME_DAY_OURA_READINESS_VALUE,
    observedAtMs: dayMidMs(3) + HOUR,
  }),
];

// ─── 8c. Duplicate copies of the SAME provider's score, SAME day ───────────
// Two survivors of the SAME (provider, kind) pair land on the SAME calendar
// day — e.g. a retried sync (fresh externalId, so record-level Pass-1 key
// dedup can't catch it). `provider_score` records are points (no start/end
// window), so Pass-3's overlap-based same-origin collapse never applies to
// them regardless of day — see health-core/dedupe.ts windowOverlapFraction.
//
// Since signalResolution.ts's `resolveProviderScores` enforces "at most one
// entry per (origin, kind) per resolution call" (see its own invariant doc),
// and this fixture's two records land in the SAME day bucket, the RESOLVER
// itself already collapses them to the single freshest-observed reading
// before this weekly aggregate ever sees more than one entry for the day.
// This fixture now exercises that resolver-level guarantee end-to-end on the
// records plane — it no LONGER exercises this module's OWN per-day dedup in
// `aggregateProviderScores` (see that function's comment). That dedup
// remains load-bearing ONLY for the `dailySignals` OVERRIDE path, which
// bypasses the resolver entirely — see
// `OVERRIDE_DUPLICATE_SCORE_*` below and
// `__tests__/weeklyHealthAggregates.test.ts`'s override-path duplicate-score
// test for the case that still needs it.
//
// An aggregator copy of a provider score delivered WITHOUT an active direct
// connection is a DIFFERENT case, not exercised by this fixture — this
// module's transport-keyed grouping (by the record's own declared provider)
// would not by itself catch that duplicate. `HEALTH_PROVIDER_CAPABILITIES`
// already excludes `provider_score` for apple_health/google_health, so no
// real ingestion path produces it; and as of `signalResolution.ts`'s
// origin-attribution + capability guard (`resolveProviderScores`), any such
// record is re-attributed to its true origin (surfacing as a same-origin
// duplicate the resolver itself collapses) or dropped outright as a
// contract violation — before it ever reaches this weekly aggregator.

export const PROVIDER_SCORE_DUPLICATE_SAME_DAY_EARLIER_VALUE = 70;
export const PROVIDER_SCORE_DUPLICATE_SAME_DAY_LATER_VALUE = 76;

export const PROVIDER_SCORE_DUPLICATE_SAME_DAY_RECORDS: CanonicalHealthRecord[] = [
  mkRecord({
    provider: 'oura',
    metricType: 'provider_score',
    scoreKind: 'oura_readiness',
    value: PROVIDER_SCORE_DUPLICATE_SAME_DAY_EARLIER_VALUE,
    observedAtMs: dayMidMs(2),
    externalId: 'oura-readiness-day2-sync-a',
  }),
  mkRecord({
    provider: 'oura',
    metricType: 'provider_score',
    scoreKind: 'oura_readiness',
    // The later-observed retry — freshest-observed should win, not blend.
    value: PROVIDER_SCORE_DUPLICATE_SAME_DAY_LATER_VALUE,
    observedAtMs: dayMidMs(2) + 30 * 60_000,
    externalId: 'oura-readiness-day2-sync-b',
  }),
];

// ─── 8d. Duplicate copies of the SAME (provider, kind) via the OVERRIDE path ─
// The `dailySignals` override path bypasses `resolveHealthSignals` (and
// therefore its own resolution-time collapse — see signalResolution.ts's
// `HealthSignals.providerScores` invariant doc) entirely: a caller can hand
// this module an already-resolved `HealthSignals` for a given day whose OWN
// `providerScores` array carries two entries for the SAME (provider, kind).
// This is the one remaining case `aggregateProviderScores`'s intra-group
// per-day dedup (see its own comment) still guards — see
// `__tests__/weeklyHealthAggregates.test.ts`'s override-path duplicate-score
// test, verified by mutation (deleting that dedup fails only that test).

export const OVERRIDE_DUPLICATE_SCORE_EARLIER_VALUE = 60;
export const OVERRIDE_DUPLICATE_SCORE_LATER_VALUE = 66;

/** An honest absence for every family this fixture doesn't care about. */
const OVERRIDE_UNAVAILABLE = { available: false as const, reason: 'no_provider' as const };

export function buildOverrideDuplicateScoreDaySignals(dayIndex: number): HealthSignals {
  return {
    sleepDuration: OVERRIDE_UNAVAILABLE,
    restingHeartRate: OVERRIDE_UNAVAILABLE,
    hrv: OVERRIDE_UNAVAILABLE,
    workouts: OVERRIDE_UNAVAILABLE,
    steps: OVERRIDE_UNAVAILABLE,
    providerScores: [
      {
        kind: 'oura_readiness',
        provider: 'oura',
        value: OVERRIDE_DUPLICATE_SCORE_EARLIER_VALUE,
        unit: 'score',
        observedAtMs: dayMidMs(dayIndex),
        freshness: 'fresh',
        confidence: 'high',
      },
      {
        kind: 'oura_readiness',
        provider: 'oura',
        // The later-observed entry — freshest-observed should win, never blend.
        value: OVERRIDE_DUPLICATE_SCORE_LATER_VALUE,
        unit: 'score',
        observedAtMs: dayMidMs(dayIndex) + 30 * 60_000,
        freshness: 'fresh',
        confidence: 'high',
      },
    ],
  };
}
