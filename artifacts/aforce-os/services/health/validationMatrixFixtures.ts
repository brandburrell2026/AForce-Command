/**
 * VALIDATION MATRIX — cross-module integration fixtures (QA sweep).
 *
 * WHY THIS FILE EXISTS: every per-file unit suite already in this directory
 * (`signalResolution.test.ts`, `weeklyHealthAggregates.test.ts`,
 * `healthSignalsFromStore.test.ts`, `scoreProtectionInvariants.test.ts`, …)
 * exhaustively proves its OWN module's contract in isolation. This fixture
 * set deliberately does NOT repeat those single-module scenarios. It
 * composes the frozen contracts (`resolveHealthSignals` →
 * `buildWeeklyHealthAggregates` / `toReadinessBiometrics`) across REAL
 * multi-day, multi-provider inputs — provider combinations × degradation
 * modes × genuine DST calendar boundaries × mid-week permission changes — to
 * prove the six honesty invariants documented across signalResolution.ts /
 * weeklyHealthAggregates.ts / readinessSignals.ts still hold END TO END, not
 * merely at each stage independently. See `__tests__/validationMatrix.test.ts`
 * for the assertions each fixture exists to prove.
 *
 * DST BOUNDARIES ARE REAL, NOT SYNTHETIC: `weeklyHealthAggregatesFixtures.ts`'s
 * own DST fixture (`buildDstWeekBoundaries`) manually shifts one boundary by
 * exactly 1 hour to *simulate* a spring-forward day — an honest, documented
 * simplification for that file's narrower purpose. This file instead derives
 * boundaries from genuine IANA tz data for real calendar dates (America/
 * New_York, 2026) via `Intl.DateTimeFormat` + binary search — the actual fall
 * -back (Nov 1, a real 25h local day) and spring-forward (Mar 8, a real 23h
 * local day) transitions, verified against Node's ICU data before being
 * hand-computed into fixtures (see PR description for the verification
 * transcript). Ground before asserting.
 *
 * Pure data + one pure helper (`findLocalMidnightUtcMs`) — no RN, no store,
 * no feature-flag import, no `Date.now()`. Reuses the existing builder
 * conventions (`mkRecord`, `dayMidMs`, `FIXED_NOW`) from
 * `weeklyHealthAggregatesFixtures.ts` rather than re-inventing them.
 */
import type { CanonicalHealthRecord, HealthProviderId } from '@workspace/health-core';
import { mkRecord, dayMidMs, HOUR, FIXED_NOW } from './weeklyHealthAggregatesFixtures';
import type { ResolveHealthSignalsInput } from './signalResolution';
import type { WeeklyHealthDayInput } from './weeklyHealthAggregates';

export { HOUR, FIXED_NOW, dayMidMs };

// ─── Real DST boundaries (America/New_York, 2026) ──────────────────────────

/**
 * Binary-search the UTC instant of local midnight for a given (year, month,
 * day) in `timeZone`, using genuine `Intl` tz data — never a synthetic
 * constant-offset shift. Accurate to <1s, far tighter than any record
 * placement granularity used below (minutes/hours). US DST transitions occur
 * at 2am local, never at midnight, so "local midnight" is always a
 * well-defined, unambiguous instant on both transition dates.
 */
export function findLocalMidnightUtcMs(
  year: number,
  month1To12: number,
  day: number,
  timeZone: string,
): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  });
  const localDateNum = (ms: number): number => {
    const parts = fmt.formatToParts(ms);
    const get = (t: string): number => Number(parts.find((p) => p.type === t)!.value);
    return get('year') * 10_000 + get('month') * 100 + get('day');
  };
  const targetNum = year * 10_000 + month1To12 * 100 + day;
  let lo = Date.UTC(year, month1To12 - 1, day) - 30 * HOUR;
  let hi = Date.UTC(year, month1To12 - 1, day) + 30 * HOUR;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDateNum(mid) < targetNum) lo = mid;
    else hi = mid;
  }
  return hi;
}

export const NY_TZ = 'America/New_York';

/**
 * Real fall-back week (America/New_York, 2026): Oct 29 – Nov 4. Day index 3
 * (Nov 1 → Nov 2) is a genuine 25h local day — clocks fall back 2am→1am on
 * Nov 1. Verified against Node's ICU: 05:30 UTC and 06:30 UTC both format to
 * "11/01/2026, 01:30" in this zone (the repeated hour).
 */
export const NY_FALL_BACK_WEEK_BOUNDARIES: number[] = (
  [
    [2026, 10, 29],
    [2026, 10, 30],
    [2026, 10, 31],
    [2026, 11, 1],
    [2026, 11, 2],
    [2026, 11, 3],
    [2026, 11, 4],
    [2026, 11, 5],
  ] as const
).map(([y, m, d]) => findLocalMidnightUtcMs(y, m, d, NY_TZ));

/**
 * Real spring-forward week (America/New_York, 2026): Mar 5 – Mar 11. Day
 * index 3 (Mar 8 → Mar 9) is a genuine 23h local day — clocks spring forward
 * 2am→3am on Mar 8. Verified against Node's ICU: 06:30 UTC → "01:30", 07:30
 * UTC → "03:30" in this zone (the skipped hour).
 */
export const NY_SPRING_FORWARD_WEEK_BOUNDARIES: number[] = (
  [
    [2026, 3, 5],
    [2026, 3, 6],
    [2026, 3, 7],
    [2026, 3, 8],
    [2026, 3, 9],
    [2026, 3, 10],
    [2026, 3, 11],
    [2026, 3, 12],
  ] as const
).map(([y, m, d]) => findLocalMidnightUtcMs(y, m, d, NY_TZ));

// ─── Degradation-mode age offsets ───────────────────────────────────────────
// wearable_sync windows (config/hydroStateModel.ts FRESHNESS_WINDOWS):
// fresh <=6h, aging <=24h, stale <=72h (expireAfterMs), expired >72h.

export const WEARABLE_SYNC_AGE_MS = {
  fresh: 2 * HOUR,
  aging: 12 * HOUR,
  stale: 48 * HOUR,
  expired: 96 * HOUR,
} as const;

// ─── A. Priority-ladder vs. freshness matrix (hrv ladder: whoop > oura > garmin > apple_health > samsung_health > google_health) ─
// signalResolution.ts's own header: "PRIORITY LADDER first … gated by a
// FRESHNESS window … never plain freshest-wins, never plain
// priority-ignoring-age." These two fixtures prove BOTH halves of that
// sentence against the same two competing origins.

/**
 * Top-priority origin (whoop) is AGING (12h — inside its 24h stale ceiling)
 * while a lower-priority origin (oura) is FRESHER (1h). Priority must still
 * win: the ladder winner is only displaced by a fresher alternative when it
 * is STALE, not merely older. Proves "never plain freshest-wins".
 */
export const PRIORITY_BEATS_FRESHER_LOWER_PRIORITY: ResolveHealthSignalsInput = {
  biometrics: undefined,
  records: [
    mkRecord({
      provider: 'whoop',
      metricType: 'hrv',
      value: 40,
      hrvMethod: 'rmssd',
      observedAtMs: FIXED_NOW - WEARABLE_SYNC_AGE_MS.aging,
    }),
    mkRecord({
      provider: 'oura',
      metricType: 'hrv',
      value: 55,
      hrvMethod: 'rmssd',
      observedAtMs: FIXED_NOW - WEARABLE_SYNC_AGE_MS.fresh,
    }),
  ],
  activeDirectProviders: new Set<HealthProviderId>(['whoop', 'oura']),
  connections: undefined,
  nowMs: FIXED_NOW,
};

/**
 * Top-priority origin (whoop) is STALE (48h — past its 24h ceiling, but
 * still short of the 72h expiry) while a lower-priority origin (oura) is
 * FRESH (1h). The freshness gate must now override raw priority. Proves
 * "gated by a freshness window" — the other half of the same sentence.
 */
export const STALE_TOP_PRIORITY_LOSES_TO_FRESH_LOWER_PRIORITY: ResolveHealthSignalsInput = {
  biometrics: undefined,
  records: [
    mkRecord({
      provider: 'whoop',
      metricType: 'hrv',
      value: 40,
      hrvMethod: 'rmssd',
      observedAtMs: FIXED_NOW - WEARABLE_SYNC_AGE_MS.stale,
    }),
    mkRecord({
      provider: 'oura',
      metricType: 'hrv',
      value: 55,
      hrvMethod: 'rmssd',
      observedAtMs: FIXED_NOW - WEARABLE_SYNC_AGE_MS.fresh,
    }),
  ],
  activeDirectProviders: new Set<HealthProviderId>(['whoop', 'oura']),
  connections: undefined,
  nowMs: FIXED_NOW,
};

// ─── B. Samsung-via-Health-Connect attribution, carried into the readiness adapter ─
// signalResolutionFixtures.ts already proves `resolveHealthSignals` attributes
// this to `samsung_health` (the true origin), never `google_health` (the
// transport). This fixture exists to carry that SAME record one hop further
// — through `toReadinessBiometrics` — proving attribution survives the
// adapter boundary too, not just the selector's own output.

export const SAMSUNG_VIA_HEALTH_CONNECT_SINGLE_DAY: ResolveHealthSignalsInput = {
  biometrics: undefined,
  records: [
    mkRecord({
      provider: 'google_health',
      metricType: 'resting_heart_rate',
      value: 52,
      observedAtMs: FIXED_NOW - WEARABLE_SYNC_AGE_MS.fresh,
      provenanceChain: [
        { provider: 'samsung_health', nativeOrigin: 'com.sec.android.app.shealth', transport: 'measured' },
        { provider: 'google_health', transport: 'aggregator_export' },
      ],
      originalSource: 'com.sec.android.app.shealth',
    }),
  ],
  activeDirectProviders: new Set(),
  connections: undefined,
  nowMs: FIXED_NOW,
};

// ─── C. All-five-provider real DST week — full-pipeline provenance sweep ───
// Every number below is hand-computed in the PR description / test file
// comments so the expected aggregate math can be checked by eye, not just by
// running the suite. Uses `NY_FALL_BACK_WEEK_BOUNDARIES` (day index 3 = the
// real 25h Nov 1 → Nov 2 day) so the DST case exercises actual multi-family
// data, not an isolated single-metric fixture.

const B = NY_FALL_BACK_WEEK_BOUNDARIES;

/** "Now" for this week: midday of day 6 (today, in progress) — every earlier day is anchored to ITS OWN day-end per weeklyHealthAggregates.ts's freshness-anchor rule. */
export const ALL_FIVE_WEEK_NOW_MS = dayMidMs(6, B);

export const ALL_FIVE_PROVIDERS_WEEK_RECORDS = [
  // Day 0 (Oct 29) — steps cross-provider race: apple_health (ladder rank 0)
  // must win outright over google_health (rank 1), NEVER summed to 14000.
  mkRecord({ provider: 'apple_health', metricType: 'steps', value: 8000, observedAtMs: dayMidMs(0, B) }),
  mkRecord({ provider: 'google_health', metricType: 'steps', value: 6000, observedAtMs: dayMidMs(0, B) + 5 * 60_000 }),
  mkRecord({ provider: 'apple_health', metricType: 'hrv', value: 42, hrvMethod: 'sdnn', observedAtMs: dayMidMs(0, B) }),
  mkRecord({
    provider: 'whoop',
    metricType: 'provider_score',
    scoreKind: 'whoop_recovery',
    value: 60,
    observedAtMs: dayMidMs(0, B),
  }),

  // Day 1 (Oct 30) — sleep cross-provider race: whoop (ladder rank 0) must
  // win outright over oura (rank 1), NEVER averaged to ~7.05h.
  mkRecord({
    provider: 'whoop',
    metricType: 'sleep_session',
    value: { totalSleepHours: 6.2, inBedHours: 6.8, stages: null },
    observedAtMs: dayMidMs(1, B),
    startTimeMs: dayMidMs(1, B) - 7 * HOUR,
    endTimeMs: dayMidMs(1, B),
  }),
  mkRecord({
    provider: 'oura',
    metricType: 'sleep_session',
    value: { totalSleepHours: 7.9, inBedHours: 8.3, stages: null },
    observedAtMs: dayMidMs(1, B) + 5 * 60_000,
    startTimeMs: dayMidMs(1, B) - 8 * HOUR,
    endTimeMs: dayMidMs(1, B) + 5 * 60_000,
  }),

  // Day 2 (Oct 31) — a plain sdnn hrv day (dominant-method contributor).
  mkRecord({ provider: 'apple_health', metricType: 'hrv', value: 44, hrvMethod: 'sdnn', observedAtMs: dayMidMs(2, B) }),

  // Day 3 (Nov 1, the real 25h fall-back day) — deliberately carries NO steps
  // record of its own; the score below is its only data. The DST proof is
  // the boundary-edge steps record right after this block.
  mkRecord({
    provider: 'whoop',
    metricType: 'provider_score',
    scoreKind: 'whoop_recovery',
    value: 63,
    observedAtMs: dayMidMs(3, B),
  }),

  // Boundary-edge record: placed EXACTLY at boundaries[4] (the real
  // day3→day4 instant, i.e. the end of the 25h day). Half-open bucketing
  // ([start, end)) means this must land in day 4, never day 3, never both.
  mkRecord({ provider: 'apple_health', metricType: 'steps', value: 9999, observedAtMs: B[4], externalId: 'dst-edge-day3-4' }),

  // Day 4 (Nov 2) — its own baseline steps record, same origin as the edge
  // record above. Within-ONE-origin summation is honest (never cross-
  // provider blending) — total must be exactly 9000 + 9999 = 18999.
  mkRecord({ provider: 'apple_health', metricType: 'steps', value: 9000, observedAtMs: dayMidMs(4, B) }),
  mkRecord({ provider: 'apple_health', metricType: 'hrv', value: 46, hrvMethod: 'sdnn', observedAtMs: dayMidMs(4, B) }),

  // Day 5 (Nov 3) — third whoop_recovery day (pushes provider-score coverage to 3-of-7, "ok").
  mkRecord({
    provider: 'whoop',
    metricType: 'provider_score',
    scoreKind: 'whoop_recovery',
    value: 58,
    observedAtMs: dayMidMs(5, B),
  }),

  // Day 6 (Nov 4, "today") — the minority-method hrv day (rmssd, excluded
  // from the dominant-sdnn weekly mean, never averaged in) plus a full set
  // of fresh same-day signals for the full-pipeline / readiness-adapter test.
  mkRecord({
    provider: 'whoop',
    metricType: 'sleep_session',
    value: { totalSleepHours: 7.1, inBedHours: 7.6, stages: null },
    observedAtMs: dayMidMs(6, B),
    startTimeMs: dayMidMs(6, B) - 7 * HOUR,
    endTimeMs: dayMidMs(6, B),
  }),
  mkRecord({ provider: 'whoop', metricType: 'hrv', value: 52, hrvMethod: 'rmssd', observedAtMs: dayMidMs(6, B) }),
  mkRecord({ provider: 'apple_health', metricType: 'steps', value: 10500, observedAtMs: dayMidMs(6, B) }),
  mkRecord({
    provider: 'oura',
    metricType: 'provider_score',
    scoreKind: 'oura_readiness',
    value: 81,
    observedAtMs: dayMidMs(6, B),
  }),
];

export const ALL_FIVE_PROVIDERS_ACTIVE_DIRECT = new Set<HealthProviderId>([
  'apple_health',
  'google_health',
  'oura',
  'whoop',
  'garmin',
]);

/** Day 6's own records, isolated — used for the single-day full-pipeline (resolveHealthSignals → toReadinessBiometrics) check, independent of the weekly rollup's own dominant-method decision. */
export const ALL_FIVE_PROVIDERS_DAY6_RECORDS = ALL_FIVE_PROVIDERS_WEEK_RECORDS.filter(
  (r) => Date.parse(r.observedAt) >= B[6] && Date.parse(r.observedAt) < B[7],
);

/**
 * Day 1's own records (whoop + oura competing sleep sessions), isolated.
 * The weekly sleep aggregate for this fixture is `insufficient_data` (only
 * 2 of 7 days covered) — that branch carries no mean/min/max to inspect, so
 * the "whoop wins outright, never averaged with oura's 7.9h" claim can only
 * be checked by resolving this day directly, the same way
 * `buildWeeklyHealthAggregates` would internally for this bucket.
 */
export const ALL_FIVE_PROVIDERS_DAY1_RECORDS = ALL_FIVE_PROVIDERS_WEEK_RECORDS.filter(
  (r) => Date.parse(r.observedAt) >= B[1] && Date.parse(r.observedAt) < B[2],
);
export const ALL_FIVE_PROVIDERS_DAY1_ANCHOR_MS = B[2]; // end-of-day-1 anchor, matching the module's own freshness-anchor rule

// ─── D. Mid-week permission revocation — sibling-family preservation ───────
// `apple_health` grants BOTH hrv and steps on days 0–3, then the user revokes
// ONLY hrv (steps stays granted) for days 4–6. Modeled via the `dailySignals`
// OVERRIDE path (`WeeklyHealthDayInput.input`), each day carrying its OWN
// `connections` — the realistic way a mid-week permission change would reach
// this module, since a single top-level `connections` map (the records-plane
// path) is applied uniformly to every day (see weeklyHealthAggregates.ts's
// own doc on `BuildWeeklyHealthAggregatesInput.connections`).
//
// PROVES: revoking hrv for a provider must not affect that SAME provider's
// steps signal on the SAME days (sibling preservation) — and the weekly
// coverage math must count the denied days as honestly "missing" (it has no
// permission_denied concept of its own; see `WeeklyHealthCoverage`), never
// silently keep counting them as present.

export const REVOKED_MID_WEEK_HRV_VALUES = [40, 41, 42, 43] as const; // days 0-3 only (days 4-6 revoked)
export const REVOKED_MID_WEEK_STEPS_VALUES = [5000, 5100, 5200, 5300, 5400, 5500, 5600] as const; // all 7 days

export function buildRevokedMidWeekDayInputs(): WeeklyHealthDayInput[] {
  return Array.from({ length: 7 }, (_, dayIndex) => {
    const nowForDay = dayMidMs(dayIndex) + 1 * HOUR; // per-day anchor, honored as-is by the override path
    const revoked = dayIndex >= 4;
    const records = [
      mkRecord({
        provider: 'apple_health',
        metricType: 'steps',
        value: REVOKED_MID_WEEK_STEPS_VALUES[dayIndex],
        observedAtMs: dayMidMs(dayIndex),
      }),
    ];
    if (!revoked) {
      records.push(
        mkRecord({
          provider: 'apple_health',
          metricType: 'hrv',
          value: REVOKED_MID_WEEK_HRV_VALUES[dayIndex],
          hrvMethod: 'sdnn',
          observedAtMs: dayMidMs(dayIndex),
        }),
      );
    } else {
      // The denied family's record still exists in the raw feed (a stale
      // local blob) — signalResolution.ts's `isDeniedForFamily` must
      // suppress it regardless, never surface it just because the bytes are
      // technically present. See that file's own doc on this exact point.
      records.push(
        mkRecord({
          provider: 'apple_health',
          metricType: 'hrv',
          value: 999, // must NEVER appear in any output — proves suppression, not just absence
          hrvMethod: 'sdnn',
          observedAtMs: dayMidMs(dayIndex),
        }),
      );
    }
    return {
      dayIndex,
      input: {
        biometrics: undefined,
        records,
        activeDirectProviders: new Set<HealthProviderId>(['apple_health']),
        connections: revoked
          ? {
              apple_health: {
                presentationState: 'connected_limited' as const,
                grantedTypes: ['steps' as const],
                deniedTypes: ['hrv' as const],
              },
            }
          : undefined,
        nowMs: nowForDay,
      },
    };
  });
}

// ─── E. Duplicates never amplify — direct + a GENUINELY deduplicable aggregator
// copy of the SAME measurement (matching provider-native id, so
// `buildDeduplicationKey` produces an IDENTICAL key for both records — see
// `lib/health-core/src/dedupe.ts`'s Pass 1 key-identical collapse, backed up
// by Pass 2's origin-based aggregator-copy drop). This is deliberately NOT a
// race of two different measurements (that is `SLEEP_OVERLAP_AND_CROSS_ORIGIN`
// / the steps cross-provider-race fixtures elsewhere) — both copies here
// carry the SAME value, because they represent ONE real-world observation
// delivered twice (once by the origin directly, once re-exported by
// `apple_health`). Each metric ships a SINGLE-copy input and a TWO-copy
// (duplicate pair) input built from the identical base record set, so a test
// can assert the resolved output is EXACTLY equal between them — proving the
// duplicate adds nothing, not merely "doesn't crash".
//
// Provider pairings mirror dedupe.ts's own documented double-count paths:
// sleep uses Oura-direct + Oura-via-Apple (the file's own worked example);
// workout uses Garmin-direct + Garmin-via-Apple (path #2, and the FIRST
// fixture coverage `workout` has ever had in this suite — previously zero);
// steps uses Oura-direct + Oura-via-Apple again (path #1), on a DIFFERENT
// metric family from the sleep pair and deliberately distinct from
// `ALL_FIVE_PROVIDERS_WEEK_RECORDS` day 4's WITHIN-ORIGIN summation case
// (two distinct apple_health windows, honestly summed) — this is instead two
// copies of the SAME window/id, which must collapse to ONE, never sum to 2x.

const DUPLICATE_SLEEP_EXTERNAL_ID = 'oura-sleep-dup-1';
const DUPLICATE_SLEEP_VALUE = { totalSleepHours: 7.4, inBedHours: 7.9, stages: null } as const;

export const DUPLICATE_SLEEP_DIRECT_RECORD: CanonicalHealthRecord = mkRecord({
  provider: 'oura',
  metricType: 'sleep_session',
  value: DUPLICATE_SLEEP_VALUE,
  observedAtMs: FIXED_NOW - 6 * HOUR,
  startTimeMs: FIXED_NOW - 14 * HOUR,
  endTimeMs: FIXED_NOW - 6 * HOUR,
  externalId: DUPLICATE_SLEEP_EXTERNAL_ID,
});

/** The SAME Oura sleep session, re-exported through Apple Health — same provider-native id, so `originOf` (hop 0 = oura) and `buildDeduplicationKey` both agree this IS the direct record, not a different one. */
export const DUPLICATE_SLEEP_RELAYED_RECORD: CanonicalHealthRecord = mkRecord({
  provider: 'apple_health',
  metricType: 'sleep_session',
  value: DUPLICATE_SLEEP_VALUE,
  observedAtMs: FIXED_NOW - 6 * HOUR,
  startTimeMs: FIXED_NOW - 14 * HOUR,
  endTimeMs: FIXED_NOW - 6 * HOUR,
  externalId: DUPLICATE_SLEEP_EXTERNAL_ID,
  provenanceChain: [
    { provider: 'oura', nativeOrigin: 'com.ouraring.oura', transport: 'measured' },
    { provider: 'apple_health', transport: 'aggregator_export' },
  ],
  originalSource: 'com.ouraring.oura',
});

export const DUPLICATE_SLEEP_SINGLE_INPUT: ResolveHealthSignalsInput = {
  biometrics: undefined,
  records: [DUPLICATE_SLEEP_DIRECT_RECORD],
  activeDirectProviders: new Set<HealthProviderId>(['oura']),
  connections: undefined,
  nowMs: FIXED_NOW,
};

export const DUPLICATE_SLEEP_PAIR_INPUT: ResolveHealthSignalsInput = {
  ...DUPLICATE_SLEEP_SINGLE_INPUT,
  records: [DUPLICATE_SLEEP_DIRECT_RECORD, DUPLICATE_SLEEP_RELAYED_RECORD],
};

const DUPLICATE_WORKOUT_EXTERNAL_ID = 'garmin-workout-dup-1';
const DUPLICATE_WORKOUT_VALUE = {
  activityKind: 'run',
  durationMin: 32,
  activeEnergyKcal: 210,
  avgHeartRateBpm: 145,
} as const;

export const DUPLICATE_WORKOUT_DIRECT_RECORD: CanonicalHealthRecord = mkRecord({
  provider: 'garmin',
  metricType: 'workout',
  value: DUPLICATE_WORKOUT_VALUE,
  observedAtMs: FIXED_NOW - 4 * HOUR,
  startTimeMs: FIXED_NOW - 4.5 * HOUR,
  endTimeMs: FIXED_NOW - 4 * HOUR,
  externalId: DUPLICATE_WORKOUT_EXTERNAL_ID,
});

/** The SAME Garmin activity, re-exported through Apple Health (dedupe.ts's documented path #2). */
export const DUPLICATE_WORKOUT_RELAYED_RECORD: CanonicalHealthRecord = mkRecord({
  provider: 'apple_health',
  metricType: 'workout',
  value: DUPLICATE_WORKOUT_VALUE,
  observedAtMs: FIXED_NOW - 4 * HOUR,
  startTimeMs: FIXED_NOW - 4.5 * HOUR,
  endTimeMs: FIXED_NOW - 4 * HOUR,
  externalId: DUPLICATE_WORKOUT_EXTERNAL_ID,
  provenanceChain: [
    { provider: 'garmin', nativeOrigin: 'com.garmin.connect.mobile', transport: 'measured' },
    { provider: 'apple_health', transport: 'aggregator_export' },
  ],
  originalSource: 'com.garmin.connect.mobile',
});

export const DUPLICATE_WORKOUT_SINGLE_INPUT: ResolveHealthSignalsInput = {
  biometrics: undefined,
  records: [DUPLICATE_WORKOUT_DIRECT_RECORD],
  activeDirectProviders: new Set<HealthProviderId>(['garmin']),
  connections: undefined,
  nowMs: FIXED_NOW,
};

export const DUPLICATE_WORKOUT_PAIR_INPUT: ResolveHealthSignalsInput = {
  ...DUPLICATE_WORKOUT_SINGLE_INPUT,
  records: [DUPLICATE_WORKOUT_DIRECT_RECORD, DUPLICATE_WORKOUT_RELAYED_RECORD],
};

const DUPLICATE_STEPS_EXTERNAL_ID = 'oura-steps-dup-1';
const DUPLICATE_STEPS_VALUE = 6200;

export const DUPLICATE_STEPS_DIRECT_RECORD: CanonicalHealthRecord = mkRecord({
  provider: 'oura',
  metricType: 'steps',
  value: DUPLICATE_STEPS_VALUE,
  observedAtMs: FIXED_NOW - 2 * HOUR,
  externalId: DUPLICATE_STEPS_EXTERNAL_ID,
});

/** The SAME Oura step total, re-exported through Apple Health. NOT the within-origin-summation case (see `ALL_FIVE_PROVIDERS_WEEK_RECORDS` day 4) — this is one measurement, twice. */
export const DUPLICATE_STEPS_RELAYED_RECORD: CanonicalHealthRecord = mkRecord({
  provider: 'apple_health',
  metricType: 'steps',
  value: DUPLICATE_STEPS_VALUE,
  observedAtMs: FIXED_NOW - 2 * HOUR,
  externalId: DUPLICATE_STEPS_EXTERNAL_ID,
  provenanceChain: [
    { provider: 'oura', nativeOrigin: 'com.ouraring.oura', transport: 'measured' },
    { provider: 'apple_health', transport: 'aggregator_export' },
  ],
  originalSource: 'com.ouraring.oura',
});

export const DUPLICATE_STEPS_SINGLE_INPUT: ResolveHealthSignalsInput = {
  biometrics: undefined,
  records: [DUPLICATE_STEPS_DIRECT_RECORD],
  activeDirectProviders: new Set<HealthProviderId>(['oura']),
  connections: undefined,
  nowMs: FIXED_NOW,
};

export const DUPLICATE_STEPS_PAIR_INPUT: ResolveHealthSignalsInput = {
  ...DUPLICATE_STEPS_SINGLE_INPUT,
  records: [DUPLICATE_STEPS_DIRECT_RECORD, DUPLICATE_STEPS_RELAYED_RECORD],
};

// ─── E2. The same three duplicate pairs, placed inside a full 7-day week ────
// Proves the "N copies == 1 copy" invariant survives `buildWeeklyHealthAggregates`'s
// own dedup-once-BEFORE-bucketing pipeline (file header's DEDUP ASSUMPTION) —
// not merely a single `resolveHealthSignals` call, and NOT merely a
// same-instant duplicate that `resolveHealthSignals`'s OWN per-bucket dedup
// would catch anyway regardless of the weekly module's own pre-pass. To make
// this genuinely load-bearing for `buildWeeklyHealthAggregates`'s "ONE dedupe
// pass over the full, un-bucketed week, THEN bucket" design (as opposed to
// redundant with per-bucket dedup), the relayed copy is placed in the NEXT
// calendar day (index 4) from the direct copy (index 3) — a realistic
// aggregator-relay delivery skew across a local-midnight boundary. Matching
// `externalId` (not matching time) is what identifies these as one real
// measurement (see dedupe.ts's key-identical Pass 1), so the top-level dedup
// must collapse them BEFORE bucketing, keeping only the direct copy's own
// day (3). If that top-level pass were skipped, bucketing would split the
// two raw copies into DIFFERENT day buckets first — and since each bucket
// then gets its OWN separate `resolveHealthSignals` call (which only ever
// sees its own bucket's records), the per-bucket dedup could no longer see
// them together at all, and day 4 would falsely show a second, phantom
// covered day. See the mutation-verification note in the PR description for
// the targeted, reverted `buildWeeklyHealthAggregates` mutation that
// reproduces exactly this failure and confirms this fixture actually
// exercises the module's own pre-pass, not just `resolveHealthSignals`'s.

const WEEK_DUP_DIRECT_DAY_INDEX = 3;
const WEEK_DUP_RELAYED_DAY_INDEX = 4;

export const DUPLICATE_SLEEP_WEEK_SINGLE_RECORDS: CanonicalHealthRecord[] = [
  mkRecord({
    provider: 'oura',
    metricType: 'sleep_session',
    value: DUPLICATE_SLEEP_VALUE,
    observedAtMs: dayMidMs(WEEK_DUP_DIRECT_DAY_INDEX),
    startTimeMs: dayMidMs(WEEK_DUP_DIRECT_DAY_INDEX) - 8 * HOUR,
    endTimeMs: dayMidMs(WEEK_DUP_DIRECT_DAY_INDEX),
    externalId: 'oura-sleep-week-dup',
  }),
];
export const DUPLICATE_SLEEP_WEEK_PAIR_RECORDS: CanonicalHealthRecord[] = [
  ...DUPLICATE_SLEEP_WEEK_SINGLE_RECORDS,
  mkRecord({
    provider: 'apple_health',
    metricType: 'sleep_session',
    value: DUPLICATE_SLEEP_VALUE,
    observedAtMs: dayMidMs(WEEK_DUP_RELAYED_DAY_INDEX), // relay lands a day later — same reading, matching externalId
    startTimeMs: dayMidMs(WEEK_DUP_RELAYED_DAY_INDEX) - 8 * HOUR,
    endTimeMs: dayMidMs(WEEK_DUP_RELAYED_DAY_INDEX),
    externalId: 'oura-sleep-week-dup',
    provenanceChain: [
      { provider: 'oura', nativeOrigin: 'com.ouraring.oura', transport: 'measured' },
      { provider: 'apple_health', transport: 'aggregator_export' },
    ],
    originalSource: 'com.ouraring.oura',
  }),
];
// Deliberately EMPTY — unlike the single-day fixtures above (which set the
// origin as actively directly connected, matching dedupe.ts's documented
// aggregator-copy-of-direct convention). An empty set here means Pass 2
// (origin-based) cannot independently save this fixture from amplifying;
// ONLY Pass 1's key-identical collapse — which requires both copies to be
// compared TOGETHER in the SAME `dedupeRecords` call, i.e. BEFORE
// `buildWeeklyHealthAggregates` buckets them into different days — can. This
// is what makes the weekly-level test load-bearing for the module's own
// pre-bucket dedup pass specifically, not merely a restatement of Pass 2
// (already proven at the single-day level above).
export const DUPLICATE_SLEEP_WEEK_ACTIVE_DIRECT = new Set<HealthProviderId>();

export const DUPLICATE_WORKOUT_WEEK_SINGLE_RECORDS: CanonicalHealthRecord[] = [
  mkRecord({
    provider: 'garmin',
    metricType: 'workout',
    value: DUPLICATE_WORKOUT_VALUE,
    observedAtMs: dayMidMs(WEEK_DUP_DIRECT_DAY_INDEX),
    startTimeMs: dayMidMs(WEEK_DUP_DIRECT_DAY_INDEX) - 0.5 * HOUR,
    endTimeMs: dayMidMs(WEEK_DUP_DIRECT_DAY_INDEX),
    externalId: 'garmin-workout-week-dup',
  }),
];
export const DUPLICATE_WORKOUT_WEEK_PAIR_RECORDS: CanonicalHealthRecord[] = [
  ...DUPLICATE_WORKOUT_WEEK_SINGLE_RECORDS,
  mkRecord({
    provider: 'apple_health',
    metricType: 'workout',
    value: DUPLICATE_WORKOUT_VALUE,
    observedAtMs: dayMidMs(WEEK_DUP_RELAYED_DAY_INDEX),
    startTimeMs: dayMidMs(WEEK_DUP_RELAYED_DAY_INDEX) - 0.5 * HOUR,
    endTimeMs: dayMidMs(WEEK_DUP_RELAYED_DAY_INDEX),
    externalId: 'garmin-workout-week-dup',
    provenanceChain: [
      { provider: 'garmin', nativeOrigin: 'com.garmin.connect.mobile', transport: 'measured' },
      { provider: 'apple_health', transport: 'aggregator_export' },
    ],
    originalSource: 'com.garmin.connect.mobile',
  }),
];
// Deliberately EMPTY — see `DUPLICATE_SLEEP_WEEK_ACTIVE_DIRECT`'s comment above.
export const DUPLICATE_WORKOUT_WEEK_ACTIVE_DIRECT = new Set<HealthProviderId>();

export const DUPLICATE_STEPS_WEEK_SINGLE_RECORDS: CanonicalHealthRecord[] = [
  mkRecord({
    provider: 'oura',
    metricType: 'steps',
    value: DUPLICATE_STEPS_VALUE,
    observedAtMs: dayMidMs(WEEK_DUP_DIRECT_DAY_INDEX),
    externalId: 'oura-steps-week-dup',
  }),
];
export const DUPLICATE_STEPS_WEEK_PAIR_RECORDS: CanonicalHealthRecord[] = [
  ...DUPLICATE_STEPS_WEEK_SINGLE_RECORDS,
  mkRecord({
    provider: 'apple_health',
    metricType: 'steps',
    value: DUPLICATE_STEPS_VALUE,
    observedAtMs: dayMidMs(WEEK_DUP_RELAYED_DAY_INDEX),
    externalId: 'oura-steps-week-dup',
    provenanceChain: [
      { provider: 'oura', nativeOrigin: 'com.ouraring.oura', transport: 'measured' },
      { provider: 'apple_health', transport: 'aggregator_export' },
    ],
    originalSource: 'com.ouraring.oura',
  }),
];
// Deliberately EMPTY — see `DUPLICATE_SLEEP_WEEK_ACTIVE_DIRECT`'s comment above.
export const DUPLICATE_STEPS_WEEK_ACTIVE_DIRECT = new Set<HealthProviderId>();

// ─── F. Spring-forward DST fed through the real aggregator pipeline ────────
// `NY_SPRING_FORWARD_WEEK_BOUNDARIES` (above) was, before this fixture,
// proven correct in isolation (the "ground truth" describe block in
// `__tests__/validationMatrix.test.ts`) but never actually handed to
// `buildWeeklyHealthAggregates` — this is that missing feed. Day index 3
// (Mar 8 → Mar 9) is the real 23h local day. One steps record per day (0-6,
// distinct values so a mis-bucketed or vanished day changes the mean
// detectably) plus a boundary-edge record placed EXACTLY at
// `NY_SPRING_FORWARD_WEEK_BOUNDARIES[4]` (the end of the 23h day) — half-open
// bucketing means this must land in day 4 (summed with day 4's own apple_health
// reading, same origin — honest within-origin summation), never in day 3,
// never in both.

const SF = NY_SPRING_FORWARD_WEEK_BOUNDARIES;
export const SPRING_FORWARD_WEEK_NOW_MS = dayMidMs(6, SF);
export const SPRING_FORWARD_STEPS_VALUES = [4000, 4100, 4200, 4300, 4400, 4500, 4600] as const;

export const SPRING_FORWARD_WEEK_RECORDS: CanonicalHealthRecord[] = [
  ...SPRING_FORWARD_STEPS_VALUES.map((value, dayIndex) =>
    mkRecord({ provider: 'apple_health', metricType: 'steps', value, observedAtMs: dayMidMs(dayIndex, SF) }),
  ),
  // Boundary-edge record: the real day3→day4 instant (end of the 23h day).
  mkRecord({
    provider: 'apple_health',
    metricType: 'steps',
    value: 999,
    observedAtMs: SF[4],
    externalId: 'spring-forward-edge-day3-4',
  }),
];

export const SPRING_FORWARD_ACTIVE_DIRECT = new Set<HealthProviderId>(['apple_health']);

// ─── G. Whole-provider revocation — sibling provider stays fully intact ────
// The user revokes EVERY record type Apple Health is capable of emitting
// (not just one family, unlike `buildRevokedMidWeekDayInputs`'s single-family
// mid-week case) while a completely different provider (Oura, direct) is
// untouched. Proves the revocation is provider-scoped, not global: Apple
// Health disappears from every family it could have supplied, and Oura's own
// reading is entirely unaffected by another provider's connection state.

export const WHOLE_PROVIDER_REVOKED_APPLE_SIBLING_OURA_INTACT: ResolveHealthSignalsInput = {
  biometrics: {
    apple_health: {
      providerId: 'apple_health',
      fetchedAt: FIXED_NOW - 1 * HOUR,
      // Present in the raw blob but every family must be suppressed below —
      // proves suppression (not merely absence of data).
      sleepHoursLastNight: 7.5,
      restingHeartRate: 50,
      hrvSdnnMs: 41,
      stepsToday: 9000,
      workoutMinutesToday: 40,
    },
  },
  records: [
    mkRecord({
      provider: 'oura',
      metricType: 'sleep_session',
      value: { totalSleepHours: 6.9, inBedHours: 7.4, stages: null },
      observedAtMs: FIXED_NOW - 5 * HOUR,
      startTimeMs: FIXED_NOW - 13 * HOUR,
      endTimeMs: FIXED_NOW - 5 * HOUR,
    }),
  ],
  activeDirectProviders: new Set<HealthProviderId>(['oura']),
  connections: {
    apple_health: {
      presentationState: 'disconnected',
      grantedTypes: [],
      deniedTypes: [
        'sleep_session',
        'resting_heart_rate',
        'hrv',
        'heart_rate_summary',
        'workout',
        'steps',
        'active_energy',
        'respiratory_rate',
      ],
    },
  },
  nowMs: FIXED_NOW,
};

// ─── H. HC direct + Samsung-via-HC, together — combo 9's missing half ──────
// `SAMSUNG_VIA_HEALTH_CONNECT_SINGLE_DAY` (above) already proves a Samsung
// reading relayed through Health Connect is attributed to `samsung_health`,
// never `google_health`. What it never tests is the OTHER half of the same
// combo: a genuine Health-Connect-NATIVE reading (Health Connect itself is
// the origin, hop 0 — not a relay of anything) arriving ALONGSIDE a
// Samsung-via-HC reading in the same resolution call. Uses two DIFFERENT
// metric families (steps for the HC-native reading, resting_heart_rate for
// the Samsung-via-HC reading) so there is no cross-family selection to reason
// about — the point is purely that both origins stay independently and
// correctly attributed when both are present together.

export const HC_DIRECT_PLUS_SAMSUNG_VIA_HC: ResolveHealthSignalsInput = {
  biometrics: undefined,
  records: [
    // Health-Connect-native: hop 0 IS google_health (no upstream app authored it).
    mkRecord({
      provider: 'google_health',
      metricType: 'steps',
      value: 7300,
      observedAtMs: FIXED_NOW - 1 * HOUR,
      provenanceChain: [{ provider: 'google_health', nativeOrigin: 'com.google.android.apps.healthdata', transport: 'measured' }],
    }),
    mkRecord({
      provider: 'google_health',
      metricType: 'resting_heart_rate',
      value: 55,
      observedAtMs: FIXED_NOW - 1 * HOUR,
      provenanceChain: [
        { provider: 'samsung_health', nativeOrigin: 'com.sec.android.app.shealth', transport: 'measured' },
        { provider: 'google_health', transport: 'aggregator_export' },
      ],
      originalSource: 'com.sec.android.app.shealth',
    }),
  ],
  activeDirectProviders: new Set(),
  connections: undefined,
  nowMs: FIXED_NOW,
};
