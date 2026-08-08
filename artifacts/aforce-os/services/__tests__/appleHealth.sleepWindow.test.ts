/**
 * RC-2 sleep-window ruling (founder-ruled 2026-08-08) — end-to-end
 * acceptance coverage through `fetchAppleHealthSnapshot`, exercising the
 * WIDENED [now-36h, now] query window together with session clustering.
 *
 * Every OTHER sleep test file in this repo (`appleHealth.sleepSelection.test.ts`,
 * `appleHealth.sleepAggregation.test.ts`, `appleHealth.sleepAdapter.test.ts`)
 * mocks `queryCategorySamples` to return whatever fixture array it's given,
 * UNCONDITIONALLY — none of them simulate HealthKit's own date-range
 * filtering, because none of their fixtures depend on the query WINDOW's
 * bounds. This file's whole reason to exist is that its fixtures DO: the
 * founder's own regression (a segment old enough to fall outside an 18h
 * window but not a 36h one) and the "outside the 36h cap entirely" case can
 * only be proven with a mock that actually filters by the `filter.date`
 * range it's called with — mirroring HealthKit's real, OVERLAP-MATCHING
 * predicate ("a sample overlapping the window is returned WHOLE, never
 * truncated to it" — see `services/appleHealth.ts`'s "Founder Ruling D"
 * comment above `SleepSession` for why that predicate is exactly what made
 * the OLD 18h window drop, not clip, the front of a night).
 *
 * See `appleHealth.sleepSession.test.ts` for exhaustive, fixture-precise
 * coverage of `clusterSleepIntervalsIntoSessions` / `chooseSleepSession` in
 * isolation (night+nap, shift-worker, fragmented-night, split-boundary).
 * This file covers only what NEEDS the full window-filtering pipeline.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeHK {
  queryQuantitySamples: ReturnType<typeof vi.fn>;
  queryStatisticsCollectionForQuantitySeparateBySource: ReturnType<typeof vi.fn>;
  queryStatisticsForQuantity: ReturnType<typeof vi.fn>;
  queryStatisticsForQuantitySeparateBySource: ReturnType<typeof vi.fn>;
  queryCategorySamples: ReturnType<typeof vi.fn>;
}

interface RawSleepFixtureSample {
  startDate: Date;
  endDate: Date;
  value: number;
  sourceRevision: { source: { name: string } };
}

function stageSample(startIso: string, endIso: string, value: 3 | 4 | 5, source: string): RawSleepFixtureSample {
  return { startDate: new Date(startIso), endDate: new Date(endIso), value, sourceRevision: { source: { name: source } } };
}

/** A harmless HealthKit quantity sample — used for RHR/HRV/steps paths this suite does not focus on. */
function harmlessQuantitySample() {
  return { quantity: 50, startDate: new Date(), endDate: new Date(), sourceRevision: { source: { name: 'iPhone' } } };
}

/**
 * Unlike every other sleep test file's `makeFakeHK`, this one's
 * `queryCategorySamples` actually FILTERS `allSamples` by the `filter.date`
 * range it's called with, using the same overlap-matching predicate real
 * HealthKit uses: a sample is returned WHOLE if any part of it falls inside
 * `[startDate, endDate)` — never truncated to the boundary. This is the
 * mechanism the founder's own regression depended on (see file header).
 */
function makeWindowAwareFakeHK(allSamples: readonly RawSleepFixtureSample[] | Error): FakeHK {
  return {
    queryQuantitySamples: vi.fn(async () => [harmlessQuantitySample()]),
    queryStatisticsCollectionForQuantitySeparateBySource: vi.fn(async () => []),
    queryStatisticsForQuantity: vi.fn(async () => ({ sumQuantity: undefined })),
    queryStatisticsForQuantitySeparateBySource: vi.fn(async () => []),
    queryCategorySamples: vi.fn(async (_identifier: string, options: { filter: { date: { startDate: Date; endDate: Date } } }) => {
      if (allSamples instanceof Error) throw allSamples;
      const windowStartMs = options.filter.date.startDate.getTime();
      const windowEndMs = options.filter.date.endDate.getTime();
      return allSamples.filter((s) => {
        const sStartMs = s.startDate.getTime();
        const sEndMs = s.endDate.getTime();
        // Overlap-matching: any part of [sStartMs, sEndMs) inside
        // [windowStartMs, windowEndMs) is a match, returned WHOLE.
        return sEndMs > windowStartMs && sStartMs < windowEndMs;
      });
    }),
  };
}

async function loadAppleHealthWithHK(fakeHK: FakeHK) {
  vi.stubEnv('EXPO_PUBLIC_INTERNAL_TESTFLIGHT', 'true');
  vi.resetModules();
  vi.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
  vi.doMock('@kingstinct/react-native-healthkit', () => fakeHK);
  const appleHealth = await import('../appleHealth');
  const diagnostics = await import('../appleHealthDiagnostics');
  return { appleHealth, diagnostics };
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT;
  vi.doUnmock('react-native');
  vi.doUnmock('@kingstinct/react-native-healthkit');
  vi.resetModules();
  vi.useRealTimers();
});

describe('fetchAppleHealthSnapshot — THE FOUNDER\'S CASE (RC-2 sleep-window ruling acceptance fixture, 2026-08-08)', () => {
  // Fixed "now" matches the founder's own report: "read at 18:45 same day."
  const FIXED_NOW = new Date('2026-08-08T18:45:00.000Z');
  // A single Apple Watch night, 23:30 → 06:15, split into two stage
  // segments with a genuine 69-minute wake gap between them (well under the
  // 3h session-split threshold, so this stays ONE session) — "5.6h asleep,
  // with gaps."
  //   EARLY: 23:30 (Aug 7) → 00:24 (Aug 8) = 54min = 0.9h. Ends at 00:24,
  //     BEFORE the OLD 18h window's start (00:45 Aug 8) — the OLD query
  //     would never have seen this segment AT ALL (HealthKit's date filter
  //     doesn't return samples with zero overlap): this is the "whole
  //     stage segment dropped outright" the founder's ruling describes, not
  //     a truncation.
  //   LATE: 01:33 (Aug 8) → 06:15 (Aug 8) = 282min = 4.7h. Starts AFTER the
  //     OLD window's start, so the OLD query would have returned it in
  //     full — this is the ~4.696h the founder's device actually reported
  //     (this fixture's round 4.7h stands in for that irrational real
  //     device number; the mechanism under test — a dropped early segment —
  //     is identical).
  const EARLY = stageSample('2026-08-07T23:30:00.000Z', '2026-08-08T00:24:00.000Z', 4, "Brandon's Apple Watch");
  const LATE = stageSample('2026-08-08T01:33:00.000Z', '2026-08-08T06:15:00.000Z', 4, "Brandon's Apple Watch");

  it('sanity check: filtering the SAME raw fixture through the OLD 18h boundary, with the UNCHANGED selection/union pipeline, reproduces the ~4.7h under-report', async () => {
    // This does not call `fetchAppleHealthSnapshot` (which now always uses
    // the 36h window) — it re-derives what the OLD 18h-windowed query would
    // have returned, using the exact overlap predicate `makeWindowAwareFakeHK`
    // implements above, then feeds that through `selectSleepIntervals` +
    // `reduceSleepByIntervalUnionDetailed` — both UNCHANGED by this ruling —
    // to make the regression comparison mathematically explicit rather than
    // asserted by narrative alone.
    const { mapCategorySamplesToSleepIntervals, selectSleepIntervals, reduceSleepByIntervalUnionDetailed } =
      await import('../appleHealth');

    const OLD_WINDOW_MS = 18 * 60 * 60 * 1000;
    const oldWindowStartMs = FIXED_NOW.getTime() - OLD_WINDOW_MS;
    const oldFilteredRaw = [EARLY, LATE].filter(
      (s) => s.endDate.getTime() > oldWindowStartMs && s.startDate.getTime() < FIXED_NOW.getTime(),
    );
    expect(oldFilteredRaw).toEqual([LATE]); // EARLY is entirely dropped by the old window — not clipped, ABSENT

    const oldIntervals = mapCategorySamplesToSleepIntervals(oldFilteredRaw);
    const { selected } = selectSleepIntervals(oldIntervals);
    const { totalMs } = reduceSleepByIntervalUnionDetailed(selected);
    expect(totalMs / (60 * 60 * 1000)).toBeCloseTo(4.7, 5);
  });

  it('the NEW 36h window + session clustering reports the full ~5.6h — the founder\'s dropped segment is recovered', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const fakeHK = makeWindowAwareFakeHK([EARLY, LATE]);
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBeCloseTo(5.6, 5);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.queryWindowStartIso).toBe(new Date(FIXED_NOW.getTime() - 36 * 60 * 60 * 1000).toISOString());
    expect(diag?.sleep.sessionCount).toBe(1); // the 69-minute gap stays under one session
    expect(diag?.sleep.sleepSessionRule).toBe('most-recent-primary');
    expect(diag?.sleep.chosenSessionStartIso).toBe(EARLY.startDate.toISOString());
    expect(diag?.sleep.chosenSessionEndIso).toBe(LATE.endDate.toISOString());
    expect(snapshot.sleepHoursLastNightObservedAtMs).toBe(LATE.endDate.getTime());
  });
});

describe('fetchAppleHealthSnapshot — the 36h cap is a real boundary, not an unbounded lookback (RC-2 sleep-window ruling)', () => {
  const FIXED_NOW = new Date('2026-08-08T12:00:00.000Z');

  it('sleep that ended 40h ago is entirely outside the 36h cap — reports null, not a stale number or a confident 0h', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    // Ended 40h before `now` — outside even the widened [now-36h, now]
    // window. HealthKit's own query would never return this row at all
    // (zero overlap), exactly like `makeWindowAwareFakeHK` simulates here.
    const oldSample = stageSample(
      new Date(FIXED_NOW.getTime() - 41 * 60 * 60 * 1000).toISOString(),
      new Date(FIXED_NOW.getTime() - 40 * 60 * 60 * 1000).toISOString(),
      4,
      "Brandon's Apple Watch",
    );
    const fakeHK = makeWindowAwareFakeHK([oldSample]);
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBeNull();
    expect(snapshot.sleepHoursLastNightObservedAtMs).toBeUndefined();

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.totalSampleCount).toBe(0); // HealthKit returned nothing — genuinely outside the cap
    expect(diag?.sleep.sessionCount).toBe(0);
    expect(diag?.sleep.sleepSessionRule).toBe('none');
    expect(diag?.sleep.sleepValueUnknown).toBe(false); // nothing was DROPPED — there was nothing to drop
  });

  it('contrast case: sleep ending 35h ago (just INSIDE the 36h cap) IS captured', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    const recentEnoughSample = stageSample(
      new Date(FIXED_NOW.getTime() - 36 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString(), // starts just inside the window
      new Date(FIXED_NOW.getTime() - 35 * 60 * 60 * 1000).toISOString(),
      4,
      "Brandon's Apple Watch",
    );
    const fakeHK = makeWindowAwareFakeHK([recentEnoughSample]);
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBeCloseTo(50 / 60, 5); // 50 minutes
    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.sessionCount).toBe(1);
    expect(diag?.sleep.sleepSessionRule).toBe('longest-fallback'); // below the 3h primary min, but the only session
  });
});
