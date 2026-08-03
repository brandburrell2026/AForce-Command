/**
 * WEEKLY HEALTH AGGREGATES — canonical weekly roll-up, built on THE frozen
 * per-day selector contract (`resolveHealthSignals`, ./signalResolution.ts —
 * READ ONLY, never modified here). W3.4 (Wave 3): the Weekly Performance
 * Report's health section, gated behind `health_canonical_consumers`
 * (default OFF — see featureFlags/flags.ts).
 *
 * WHAT THIS MODULE DOES AND DOES NOT DO
 *   - Turns `days` (default 7) worth of per-day canonical signals into one
 *     per-metric weekly aggregate: mean / min / max, coverage (n-of-`days` +
 *     which days are missing), attributed sources (with aggregator info),
 *     freshness of the most recent covered day, and — for HRV only — the
 *     dominant `hrvMethod` plus an honest method-conflict flag.
 *   - It NEVER resolves a single day's winning source itself — that stays
 *     `resolveHealthSignals`'s job, called once per day here. This module
 *     only aggregates ACROSS days, never across providers within a day.
 *   - It NEVER blends HRV methods: if a week contains both rmssd and sdnn
 *     readings, only the DOMINANT method's days are aggregated; the other
 *     days are reported as excluded (`methodConflict: true`,
 *     `excludedMethodConflictDays`), never averaged together.
 *   - `insufficient_data` is a distinct status from a real, merely LOW
 *     aggregate. Coverage below `minCoverageDays` (default 3 of `days`)
 *     ⇒ `insufficient_data`, regardless of what the few available values are.
 *     A metric with full coverage and low values (e.g. 4h average sleep)
 *     reports `status: 'ok'` with that honest number — never silently
 *     recoded as "insufficient" to avoid an uncomfortable finding.
 *
 * DEDUP ASSUMPTION (load-bearing — see health-core/dedupe.ts)
 *   The `records` plane is deduplicated EXACTLY ONCE, over the FULL supplied
 *   week, via `dedupeRecords` — BEFORE any per-day bucketing happens. This is
 *   what makes "Oura direct + Oura-via-Apple, same night" collapse to ONE
 *   night regardless of which local day boundary the two copies' timestamps
 *   nominally fall closest to: the aggregator-copy-of-direct drop (dedupe
 *   Pass 2) and same-origin overlap collapse (Pass 3) both run on the
 *   UN-bucketed set, so a duplicate can never survive by landing in a
 *   different day bucket than its surviving twin. Each day's bucket is then
 *   independently re-resolved via `resolveHealthSignals` (which re-runs
 *   `dedupeRecords` on that day's subset — idempotent on already-deduped
 *   input, never reintroduces a dropped record) to get that day's winning
 *   per-metric source. This module assumes the caller's `records` are the
 *   FULL raw multi-provider set for the week (not pre-deduped, not
 *   pre-filtered to one provider) — that is what lets the canonical dedupe
 *   layer do its job.
 *
 * TIMEZONE / DST
 *   "Which local calendar day does this reading belong to?" matters for
 *   sleep ("last night") and daily totals (steps, workout minutes) in a way
 *   UTC-day bucketing does not honestly capture (see utils/weeklyReport.ts's
 *   OWN header, which deliberately buckets analytics events by UTC day for a
 *   different reason — event *volume* trends, not "which night"). This
 *   module buckets by LOCAL day instead, via day-boundary timestamps.
 *
 *   Callers may supply exact boundaries (`dayBoundariesMs`, length `days+1`,
 *   strictly increasing, in UTC ms) computed however they like — e.g. real
 *   per-instant local midnights derived from `Intl`/`Date`, which correctly
 *   handles a DST transition mid-week (a 23h or 25h "day"). When omitted,
 *   this module falls back to `defaultDayBoundariesMs`, a SIMPLE constant-
 *   offset constructor (`timezoneOffsetMin` applied uniformly across the
 *   whole window) — an honest, documented simplification that assumes no
 *   DST transition within the window. A caller spanning a real transition
 *   should supply exact `dayBoundariesMs`; `__tests__/weeklyHealthAggregates
 *   .test.ts`'s DST case proves bucketing is correct (no double-count, no
 *   gap) against exactly such a non-uniform boundary set, independent of how
 *   those boundaries were computed.
 *
 * SCORE-PROTECTION: this module selects and aggregates health SIGNALS only —
 * mean/min/max of a metric over a week, never a score. `providerScores` stay
 * provider-and-kind attributed, aggregated only WITHIN one (provider, kind)
 * pair across days, never blended across providers or relabeled as an
 * AForce concept. Nothing here reads or writes scoringEngine.ts /
 * statusColor.ts (both off-limits, both unimported here).
 *
 * Pure module — no React Native, no store, no feature-flag import, no I/O,
 * no `Date.now()` (`nowMs` is injected by the caller).
 */

import {
  dedupeRecords,
  type CanonicalHealthRecord,
  type HealthProviderId,
  type HrvMethod,
  type ProviderScoreKind,
} from '@workspace/health-core';
import {
  resolveHealthSignals,
  type HealthSignal,
  type HealthSignalConnections,
  type HealthSignalFreshness,
  type HealthSignals,
  type ResolveHealthSignalsInput,
} from './signalResolution';

const MS_PER_DAY = 86_400_000;

export const DEFAULT_WEEKLY_HEALTH_DAYS = 7;
export const DEFAULT_MIN_COVERAGE_DAYS = 3;

// ─── Input contract ───────────────────────────────────────────────────────

/**
 * One day's explicit override — bypasses records-plane bucketing for that
 * `dayIndex` entirely. Exactly one of `signals` / `input` should be set:
 *   - `signals`: the caller already resolved that day (e.g. persisted from a
 *     prior run, or built via a different adapter) — used verbatim.
 *   - `input`: a raw per-day `ResolveHealthSignalsInput` (its OWN `nowMs`,
 *     honored as-is — see file header on why this differs from the
 *     records-plane path's shared `nowMs`); this module resolves it.
 * If both are set, `signals` wins (cheaper, and avoids re-resolving).
 */
export interface WeeklyHealthDayInput {
  /** 0 = oldest day in the window, `days - 1` = most recent (today). */
  dayIndex: number;
  signals?: HealthSignals;
  input?: ResolveHealthSignalsInput;
}

export interface BuildWeeklyHealthAggregatesInput {
  /**
   * Records plane — the FULL, raw, multi-provider record set for the whole
   * window (any order). Deduplicated ONCE here, then bucketed into local
   * days. See file header's DEDUP ASSUMPTION. Days covered by an explicit
   * `dailySignals` entry never consult this plane.
   */
  records?: readonly CanonicalHealthRecord[];
  /** Same contract as `ResolveHealthSignalsInput.activeDirectProviders`. Defaults to an empty set. */
  activeDirectProviders?: ReadonlySet<HealthProviderId>;
  /** Same contract as `ResolveHealthSignalsInput.connections`, applied to every records-plane day. */
  connections?: HealthSignalConnections;
  /** Explicit per-day overrides — see `WeeklyHealthDayInput`. */
  dailySignals?: readonly WeeklyHealthDayInput[];
  /** Window length in days. Default 7. */
  days?: number;
  /**
   * Local UTC offset in minutes (e.g. -420 for PDT), used ONLY to derive the
   * default day boundaries when `dayBoundariesMs` is omitted. Ignored
   * entirely when `dayBoundariesMs` is supplied.
   */
  timezoneOffsetMin: number;
  /**
   * Exact local-day boundary timestamps (UTC ms), length `days + 1`,
   * strictly increasing; bucket `dayIndex` covers
   * `[dayBoundariesMs[dayIndex], dayBoundariesMs[dayIndex + 1])`. Optional —
   * see file header's TIMEZONE / DST section. A malformed array (wrong
   * length or not strictly increasing) is ignored in favor of the default
   * constructor, never partially trusted.
   */
  dayBoundariesMs?: readonly number[];
  /** Epoch ms "now" anchor — injected, this module never reads the clock. */
  nowMs: number;
  /** Minimum days of real coverage required before a metric is "ok" rather than "insufficient_data". Default 3. */
  minCoverageDays?: number;
}

// ─── Output contract ────────────────────────────────────────────────────────

export interface WeeklyHealthCoverage {
  /** Days with an available, aggregated reading for this metric. */
  covered: number;
  /** Window length (== `days`). */
  total: number;
  /** dayIndex values with NO reading at all for this metric (honest absence, not a conflict exclusion). */
  missingDays: readonly number[];
}

/** One contributing source across the week, with its own day count — never blended into another source's numbers. */
export interface WeeklyHealthSourceAttribution {
  source: HealthProviderId;
  aggregator?: HealthProviderId;
  daysCount: number;
}

export interface WeeklyHealthInsufficientData {
  status: 'insufficient_data';
  coverage: WeeklyHealthCoverage;
  /** == coverage.covered, exposed directly for convenience. Always < minCoverageDays here. */
  daysCovered: number;
}

export interface WeeklyHealthNumericAggregate {
  status: 'ok';
  mean: number;
  min: number;
  max: number;
  /** "Nights" for sleepDuration, "days" for everything else — see per-field docs on `WeeklyHealthAggregates`. */
  daysCovered: number;
  coverage: WeeklyHealthCoverage;
  sources: readonly WeeklyHealthSourceAttribution[];
  /** Freshness of the most recently COVERED day — how current this aggregate is, not an average across the week. */
  freshness: HealthSignalFreshness;
}

export type WeeklyHealthMetricAggregate = WeeklyHealthNumericAggregate | WeeklyHealthInsufficientData;

export interface WeeklyHrvAggregate extends WeeklyHealthNumericAggregate {
  /** The one method these mean/min/max values are computed over — never a mix. */
  hrvMethod: HrvMethod;
  /** True when the week contained BOTH rmssd and sdnn readings on different days. */
  methodConflict: boolean;
  /** Days whose HRV reading used the non-dominant method — excluded from mean/min/max, never averaged in. */
  excludedMethodConflictDays: number;
  excludedMethodConflictDayIndexes: readonly number[];
}

export type WeeklyHrvMetricAggregate = WeeklyHrvAggregate | WeeklyHealthInsufficientData;

export interface WeeklyWorkoutsAggregate {
  status: 'ok';
  totalDurationMin: number;
  workoutCount: number;
  /** Days with at least one workout entry (distinct from `daysCovered`, which counts days the SIGNAL was available at all, including honest zero/empty days). */
  daysWithWorkout: number;
  daysCovered: number;
  coverage: WeeklyHealthCoverage;
  sources: readonly WeeklyHealthSourceAttribution[];
  freshness: HealthSignalFreshness;
}

export type WeeklyWorkoutsMetricAggregate = WeeklyWorkoutsAggregate | WeeklyHealthInsufficientData;

export interface WeeklyProviderScoreAggregate {
  kind: ProviderScoreKind;
  provider: HealthProviderId;
  status: 'ok';
  mean: number;
  min: number;
  max: number;
  daysCovered: number;
  coverage: WeeklyHealthCoverage;
  freshness: HealthSignalFreshness;
}

export interface WeeklyProviderScoreInsufficientData {
  kind: ProviderScoreKind;
  provider: HealthProviderId;
  status: 'insufficient_data';
  coverage: WeeklyHealthCoverage;
  daysCovered: number;
}

export type WeeklyProviderScoreMetricAggregate = WeeklyProviderScoreAggregate | WeeklyProviderScoreInsufficientData;

export interface WeeklyHealthAggregates {
  windowDays: number;
  minCoverageDays: number;
  /** The exact day-boundary timestamps used (own-computed or caller-supplied) — for debugging/audit. */
  dayBoundariesMs: readonly number[];
  generatedAtMs: number;
  /** `daysCovered` here counts NIGHTS (one sleep session per local day). */
  sleepDuration: WeeklyHealthMetricAggregate;
  restingHeartRate: WeeklyHealthMetricAggregate;
  hrv: WeeklyHrvMetricAggregate;
  steps: WeeklyHealthMetricAggregate;
  workouts: WeeklyWorkoutsMetricAggregate;
  /** Always an array (possibly empty) — mirrors `HealthSignals.providerScores`'s own honesty convention. */
  providerScores: readonly WeeklyProviderScoreMetricAggregate[];
}

// ─── Day boundaries ─────────────────────────────────────────────────────────

function isStrictlyIncreasing(values: readonly number[]): boolean {
  for (let i = 1; i < values.length; i++) {
    if (!(values[i] > values[i - 1])) return false;
  }
  return true;
}

/**
 * Default day boundaries: `days` consecutive 24h buckets under a SINGLE
 * constant local offset, the most recent bucket being the local calendar day
 * that contains `nowMs`. See file header — this is a documented
 * simplification for the common (no-DST-transition-in-window) case.
 */
export function defaultDayBoundariesMs(days: number, timezoneOffsetMin: number, nowMs: number): number[] {
  const offsetMs = timezoneOffsetMin * 60_000;
  const localNowMs = nowMs + offsetMs;
  const todayLocalDayIndex = Math.floor(localNowMs / MS_PER_DAY);
  const todayLocalStartUtcMs = todayLocalDayIndex * MS_PER_DAY - offsetMs;
  const boundaries: number[] = [];
  for (let i = 0; i <= days; i++) {
    boundaries.push(todayLocalStartUtcMs - (days - 1 - i) * MS_PER_DAY);
  }
  return boundaries;
}

function resolveDayBoundaries(
  provided: readonly number[] | undefined,
  days: number,
  timezoneOffsetMin: number,
  nowMs: number,
): number[] {
  if (provided && provided.length === days + 1 && isStrictlyIncreasing(provided)) {
    return [...provided];
  }
  return defaultDayBoundariesMs(days, timezoneOffsetMin, nowMs);
}

// ─── Shared per-day attribution shape ────────────────────────────────────────

interface AttributedDayEntry {
  dayIndex: number;
  source: HealthProviderId;
  aggregator?: HealthProviderId;
  freshness: HealthSignalFreshness;
}

function attributeSources(entries: readonly AttributedDayEntry[]): WeeklyHealthSourceAttribution[] {
  const byKey = new Map<string, WeeklyHealthSourceAttribution>();
  for (const e of entries) {
    const key = `${e.source}|${e.aggregator ?? ''}`;
    const cur = byKey.get(key);
    if (cur) {
      byKey.set(key, { ...cur, daysCount: cur.daysCount + 1 });
    } else {
      byKey.set(key, { source: e.source, aggregator: e.aggregator, daysCount: 1 });
    }
  }
  return [...byKey.values()].sort(
    (a, b) => b.daysCount - a.daysCount || a.source.localeCompare(b.source),
  );
}

/** Most recent COVERED day's freshness — never an average across the week. */
function mostRecentFreshness(entries: readonly AttributedDayEntry[]): HealthSignalFreshness {
  return [...entries].sort((a, b) => b.dayIndex - a.dayIndex)[0].freshness;
}

// ─── Generic numeric aggregator (sleepDuration / restingHeartRate / steps) ──

function aggregateSimpleNumeric<TValue, TUnit extends string>(
  daySignals: readonly HealthSignals[],
  pick: (s: HealthSignals) => HealthSignal<TValue, TUnit>,
  toNumber: (v: TValue) => number,
  minCoverageDays: number,
): WeeklyHealthMetricAggregate {
  const total = daySignals.length;
  const covered: (AttributedDayEntry & { value: number })[] = [];
  const missingDays: number[] = [];

  daySignals.forEach((s, dayIndex) => {
    const sig = pick(s);
    if (sig.available) {
      covered.push({
        dayIndex,
        value: toNumber(sig.value),
        source: sig.source,
        aggregator: sig.aggregator,
        freshness: sig.freshness,
      });
    } else {
      missingDays.push(dayIndex);
    }
  });

  const coverage: WeeklyHealthCoverage = { covered: covered.length, total, missingDays };
  if (covered.length < minCoverageDays) {
    return { status: 'insufficient_data', coverage, daysCovered: covered.length };
  }

  const values = covered.map((e) => e.value);
  return {
    status: 'ok',
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    daysCovered: covered.length,
    coverage,
    sources: attributeSources(covered),
    freshness: mostRecentFreshness(covered),
  };
}

// ─── HRV aggregator (method-conflict aware) ──────────────────────────────────

function aggregateHrv(daySignals: readonly HealthSignals[], minCoverageDays: number): WeeklyHrvMetricAggregate {
  const total = daySignals.length;
  interface HrvEntry extends AttributedDayEntry {
    valueMs: number;
    method: HrvMethod;
  }
  const present: HrvEntry[] = [];
  const missingDays: number[] = [];

  daySignals.forEach((s, dayIndex) => {
    const sig = s.hrv;
    if (sig.available) {
      present.push({
        dayIndex,
        valueMs: sig.value.valueMs,
        method: sig.value.method,
        source: sig.source,
        aggregator: sig.aggregator,
        freshness: sig.freshness,
      });
    } else {
      missingDays.push(dayIndex);
    }
  });

  if (present.length === 0) {
    return {
      status: 'insufficient_data',
      coverage: { covered: 0, total, missingDays },
      daysCovered: 0,
    };
  }

  // Dominant method: highest day-count wins; ties broken by whichever
  // method's LATEST contributing day is more recent (deterministic, documented).
  const countByMethod = new Map<HrvMethod, number>();
  const maxDayByMethod = new Map<HrvMethod, number>();
  for (const e of present) {
    countByMethod.set(e.method, (countByMethod.get(e.method) ?? 0) + 1);
    maxDayByMethod.set(e.method, Math.max(maxDayByMethod.get(e.method) ?? -1, e.dayIndex));
  }
  const methods = [...countByMethod.keys()];
  const methodConflict = methods.length > 1;
  const dominant = methods.sort((a, b) => {
    const byCount = (countByMethod.get(b) ?? 0) - (countByMethod.get(a) ?? 0);
    if (byCount !== 0) return byCount;
    return (maxDayByMethod.get(b) ?? -1) - (maxDayByMethod.get(a) ?? -1);
  })[0];

  const dominantEntries = present.filter((e) => e.method === dominant);
  const excludedEntries = present.filter((e) => e.method !== dominant);

  const coverage: WeeklyHealthCoverage = { covered: dominantEntries.length, total, missingDays };
  if (dominantEntries.length < minCoverageDays) {
    return { status: 'insufficient_data', coverage, daysCovered: dominantEntries.length };
  }

  const values = dominantEntries.map((e) => e.valueMs);
  return {
    status: 'ok',
    mean: values.reduce((a, b) => a + b, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    daysCovered: dominantEntries.length,
    coverage,
    sources: attributeSources(dominantEntries),
    freshness: mostRecentFreshness(dominantEntries),
    hrvMethod: dominant,
    methodConflict,
    excludedMethodConflictDays: excludedEntries.length,
    excludedMethodConflictDayIndexes: excludedEntries.map((e) => e.dayIndex).sort((a, b) => a - b),
  };
}

// ─── Workouts aggregator (presence + duration, not a single scalar) ─────────

function aggregateWorkouts(
  daySignals: readonly HealthSignals[],
  minCoverageDays: number,
): WeeklyWorkoutsMetricAggregate {
  const total = daySignals.length;
  interface WorkoutDayEntry extends AttributedDayEntry {
    durationMin: number;
    count: number;
  }
  const covered: WorkoutDayEntry[] = [];
  const missingDays: number[] = [];

  daySignals.forEach((s, dayIndex) => {
    const sig = s.workouts;
    if (sig.available) {
      covered.push({
        dayIndex,
        durationMin: sig.value.reduce((sum, e) => sum + e.durationMin, 0),
        count: sig.value.length,
        source: sig.source,
        aggregator: sig.aggregator,
        freshness: sig.freshness,
      });
    } else {
      missingDays.push(dayIndex);
    }
  });

  const coverage: WeeklyHealthCoverage = { covered: covered.length, total, missingDays };
  if (covered.length < minCoverageDays) {
    return { status: 'insufficient_data', coverage, daysCovered: covered.length };
  }

  return {
    status: 'ok',
    totalDurationMin: covered.reduce((sum, e) => sum + e.durationMin, 0),
    workoutCount: covered.reduce((sum, e) => sum + e.count, 0),
    daysWithWorkout: covered.filter((e) => e.count > 0).length,
    daysCovered: covered.length,
    coverage,
    sources: attributeSources(covered),
    freshness: mostRecentFreshness(covered),
  };
}

// ─── Provider scores aggregator (attributed per provider+kind, never blended) ─

function aggregateProviderScores(
  daySignals: readonly HealthSignals[],
  minCoverageDays: number,
): WeeklyProviderScoreMetricAggregate[] {
  const total = daySignals.length;
  interface ScoreEntry {
    dayIndex: number;
    value: number;
    freshness: HealthSignalFreshness;
  }
  const byGroup = new Map<string, { kind: ProviderScoreKind; provider: HealthProviderId; entries: ScoreEntry[] }>();

  daySignals.forEach((s, dayIndex) => {
    for (const entry of s.providerScores) {
      const key = `${entry.provider}|${entry.kind}`;
      let group = byGroup.get(key);
      if (!group) {
        group = { kind: entry.kind, provider: entry.provider, entries: [] };
        byGroup.set(key, group);
      }
      group.entries.push({ dayIndex, value: entry.value, freshness: entry.freshness });
    }
  });

  const results: WeeklyProviderScoreMetricAggregate[] = [];
  for (const group of byGroup.values()) {
    const coveredDayIndexes = new Set(group.entries.map((e) => e.dayIndex));
    const missingDays = Array.from({ length: total }, (_, i) => i).filter((i) => !coveredDayIndexes.has(i));
    const coverage: WeeklyHealthCoverage = { covered: coveredDayIndexes.size, total, missingDays };

    if (coveredDayIndexes.size < minCoverageDays) {
      results.push({
        kind: group.kind,
        provider: group.provider,
        status: 'insufficient_data',
        coverage,
        daysCovered: coveredDayIndexes.size,
      });
      continue;
    }

    const values = group.entries.map((e) => e.value);
    const freshest = [...group.entries].sort((a, b) => b.dayIndex - a.dayIndex)[0];
    results.push({
      kind: group.kind,
      provider: group.provider,
      status: 'ok',
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      daysCovered: coveredDayIndexes.size,
      coverage,
      freshness: freshest.freshness,
    });
  }

  return results.sort((a, b) => a.provider.localeCompare(b.provider) || a.kind.localeCompare(b.kind));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

/**
 * THE canonical weekly health aggregator. Pure: same inputs (any record
 * order) ⇒ same output. See file header for the full contract.
 */
export function buildWeeklyHealthAggregates(input: BuildWeeklyHealthAggregatesInput): WeeklyHealthAggregates {
  const days = input.days ?? DEFAULT_WEEKLY_HEALTH_DAYS;
  const minCoverageDays = input.minCoverageDays ?? DEFAULT_MIN_COVERAGE_DAYS;
  const activeDirectProviders = input.activeDirectProviders ?? new Set<HealthProviderId>();
  const dayBoundariesMs = resolveDayBoundaries(input.dayBoundariesMs, days, input.timezoneOffsetMin, input.nowMs);

  // ONE dedupe pass over the full, un-bucketed week — see file header's
  // DEDUP ASSUMPTION for why this must happen before bucketing.
  const deduped =
    input.records && input.records.length > 0
      ? dedupeRecords(input.records, { activeDirectProviders }).kept
      : [];

  const overrideByDay = new Map<number, WeeklyHealthDayInput>();
  for (const day of input.dailySignals ?? []) {
    overrideByDay.set(day.dayIndex, day);
  }

  const daySignals: HealthSignals[] = [];
  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const override = overrideByDay.get(dayIndex);
    if (override) {
      if (override.signals) {
        daySignals.push(override.signals);
      } else if (override.input) {
        daySignals.push(resolveHealthSignals(override.input));
      } else {
        // Neither `signals` nor `input` set — an honest "no data" day rather
        // than a runtime throw over a malformed override.
        daySignals.push(
          resolveHealthSignals({
            biometrics: undefined,
            records: [],
            activeDirectProviders,
            connections: input.connections,
            nowMs: input.nowMs,
          }),
        );
      }
      continue;
    }

    const bucketStart = dayBoundariesMs[dayIndex];
    const bucketEnd = dayBoundariesMs[dayIndex + 1];
    const bucketRecords = deduped.filter((r) => {
      const t = Date.parse(r.observedAt);
      return Number.isFinite(t) && t >= bucketStart && t < bucketEnd;
    });

    // FRESHNESS ANCHOR — load-bearing: grade each day's reading against the
    // END OF THAT DAY (capped at the real `nowMs` for the most recent day,
    // which may still be in progress), never against the real "now" for
    // every past day alike. A reading from 5 days ago was genuinely FRESH
    // when it was captured; asking "is this fresh AS OF TODAY" for every
    // historical day would grade nearly the whole week `stale`/`expired`
    // purely from elapsed calendar time, which is not what a weekly
    // rollup means by freshness. `resolveHealthSignals`'s own contract
    // welcomes this — `nowMs` is an injected anchor, not required to be the
    // wall clock (see its header).
    const dayAnchorMs = Math.min(bucketEnd, input.nowMs);

    daySignals.push(
      resolveHealthSignals({
        biometrics: undefined,
        records: bucketRecords,
        activeDirectProviders,
        connections: input.connections,
        nowMs: dayAnchorMs,
      }),
    );
  }

  return {
    windowDays: days,
    minCoverageDays,
    dayBoundariesMs,
    generatedAtMs: input.nowMs,
    sleepDuration: aggregateSimpleNumeric(
      daySignals,
      (s) => s.sleepDuration,
      (v) => v.totalSleepHours,
      minCoverageDays,
    ),
    restingHeartRate: aggregateSimpleNumeric(
      daySignals,
      (s) => s.restingHeartRate,
      (v) => v,
      minCoverageDays,
    ),
    hrv: aggregateHrv(daySignals, minCoverageDays),
    steps: aggregateSimpleNumeric(
      daySignals,
      (s) => s.steps,
      (v) => v,
      minCoverageDays,
    ),
    workouts: aggregateWorkouts(daySignals, minCoverageDays),
    providerScores: aggregateProviderScores(daySignals, minCoverageDays),
  };
}
