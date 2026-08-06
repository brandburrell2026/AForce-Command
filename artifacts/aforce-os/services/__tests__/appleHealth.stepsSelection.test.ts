/**
 * RC-2 independent-verdict review (S2 + B1.3) — the full steps SELECTION
 * chain, exercised end-to-end through `fetchAppleHealthSnapshot`.
 *
 * `appleHealth.stepsAggregation.test.ts` tests `reduceStepsByBucketMax` in
 * isolation; `appleHealth.stepsAdapter.test.ts` tests `mapStatsToBuckets` in
 * isolation. Neither exercises the branching logic in
 * `fetchAppleHealthSnapshot` that decides which of the two numbers actually
 * becomes `stepsToday` — including the B1.3 fix (an empty bucket array with
 * real raw samples present must trigger the same fallback a thrown error
 * already does, not silently resolve to `0`).
 *
 * Mocks the native module's dynamic import the same way
 * `appleHealth.internalTestflightGate.test.ts` mocks `react-native`:
 * `vi.doMock` + `vi.resetModules()` + a fresh dynamic `import('../appleHealth')`
 * per test, so `isAppleHealthSupported()` (which gates `loadHealthKit`) is
 * genuinely `true` for the duration of each test via the same
 * `EXPO_PUBLIC_INTERNAL_TESTFLIGHT` seam Ruling A already proved — never by
 * poking at `DEFAULT_FLAGS.healthkit_native_enabled`, which stays `false`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeHK {
  queryQuantitySamples: ReturnType<typeof vi.fn>;
  queryStatisticsCollectionForQuantitySeparateBySource: ReturnType<typeof vi.fn>;
  queryStatisticsForQuantity: ReturnType<typeof vi.fn>;
  queryStatisticsForQuantitySeparateBySource: ReturnType<typeof vi.fn>;
  queryCategorySamples: ReturnType<typeof vi.fn>;
}

/** A HealthKit sample shaped like the real `QuantitySample`. */
function sample(quantity: number) {
  return { quantity, startDate: new Date(), endDate: new Date(), sourceRevision: { source: { name: 'iPhone' } } };
}

/**
 * Builds a fake `@kingstinct/react-native-healthkit` module. `stepsRawTotal`
 * controls both the raw-sum query's returned samples (one sample per unit
 * of quantity would be wasteful — instead a single sample carries the whole
 * total, since `sumRawQuantitySamples` just adds `.quantity` fields) and,
 * via `bucketedEntries`, what the per-source-hourly query returns.
 */
function makeFakeHK(opts: {
  stepsRawTotal: number;
  bucketedEntries: unknown; // what queryStatisticsCollectionForQuantitySeparateBySource resolves to, or an Error to throw
  nativeMergedQuantity?: number | null;
}): FakeHK {
  const { stepsRawTotal, bucketedEntries, nativeMergedQuantity = null } = opts;

  return {
    queryQuantitySamples: vi.fn(async (identifier: string, options: any) => {
      if (identifier === 'HKQuantityTypeIdentifierStepCount') {
        // Both the raw-sum computation (limit: 0) and the diagnostics 24h
        // count paths for RHR/HRV are separate identifiers, so any
        // steps-identifier call here is the raw-sum query.
        return stepsRawTotal > 0 ? [sample(stepsRawTotal)] : [];
      }
      // RHR / HRV most-recent-sample and 24h-count queries: return a single
      // harmless sample so those code paths don't throw; not the focus of
      // this suite.
      if (options?.limit === 1) return [sample(50)];
      return [sample(50)];
    }),
    queryStatisticsCollectionForQuantitySeparateBySource: vi.fn(async () => {
      if (bucketedEntries instanceof Error) throw bucketedEntries;
      return bucketedEntries;
    }),
    queryStatisticsForQuantity: vi.fn(async () => {
      if (nativeMergedQuantity === null) return { sumQuantity: undefined };
      return { sumQuantity: { unit: 'count', quantity: nativeMergedQuantity } };
    }),
    queryStatisticsForQuantitySeparateBySource: vi.fn(async () => []),
    queryCategorySamples: vi.fn(async () => []),
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

/**
 * SF-1 (RC-2 independent-verdict review, second pass): reaches
 * `isAppleHealthSupported() === true` WITHOUT the internal-TestFlight env
 * var, via the OTHER half of that function's OR (`DEFAULT_FLAGS.
 * healthkit_native_enabled`) — mocked true here for this test only, never
 * touched in source. This is deliberately the one way to get HealthKit
 * "supported" while diagnostics stay OFF, since
 * `isAppleHealthDiagnosticsEnabled()` is driven by the SAME
 * `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED` the testflight env var controls —
 * leaving that env var unset is what keeps diagnostics off here.
 */
async function loadAppleHealthWithHKDiagnosticsOff(fakeHK: FakeHK) {
  vi.resetModules();
  vi.doMock('react-native', () => ({ Platform: { OS: 'ios' } }));
  vi.doMock('@kingstinct/react-native-healthkit', () => fakeHK);
  vi.doMock('../../featureFlags/flags', () => ({ DEFAULT_FLAGS: { healthkit_native_enabled: true } }));
  const appleHealth = await import('../appleHealth');
  const diagnostics = await import('../appleHealthDiagnostics');
  return { appleHealth, diagnostics };
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT;
  vi.doUnmock('react-native');
  vi.doUnmock('@kingstinct/react-native-healthkit');
  vi.doUnmock('../../featureFlags/flags');
  vi.resetModules();
});

describe('fetchAppleHealthSnapshot — steps selection chain', () => {
  it('normal path: bucketed-max query succeeds → stepsToday is the bucketed-max value, not the raw sum, and fallback is false', async () => {
    const fakeHK = makeFakeHK({
      stepsRawTotal: 2650, // old (double-counted) total
      bucketedEntries: [
        { source: { name: 'iPhone' }, sumQuantity: { unit: 'count', quantity: 400 }, startDate: new Date('2026-08-05T09:00:00.000Z') },
        { source: { name: "Brandon's Apple Watch" }, sumQuantity: { unit: 'count', quantity: 420 }, startDate: new Date('2026-08-05T09:00:00.000Z') },
      ],
      nativeMergedQuantity: 430,
    });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.stepsToday).toBe(420); // max(400, 420), not 400+420 and not the 2650 raw sum

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.steps.usedFallback).toBe(false);
    expect(diag?.steps.bucketedMaxTotal).toBe(420);
    expect(diag?.steps.rawSampleSum).toBe(2650);
  });

  it('N3: the day-window step-count query runs exactly ONCE — the diagnostics block reuses the raw-sum query\'s sample count instead of re-issuing an identical query', async () => {
    const fakeHK = makeFakeHK({
      stepsRawTotal: 2650,
      bucketedEntries: [
        { source: { name: 'iPhone' }, sumQuantity: { unit: 'count', quantity: 400 }, startDate: new Date('2026-08-05T09:00:00.000Z') },
      ],
    });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    await appleHealth.fetchAppleHealthSnapshot();

    const stepCountCalls = fakeHK.queryQuantitySamples.mock.calls.filter(
      ([identifier]) => identifier === 'HKQuantityTypeIdentifierStepCount',
    );
    expect(stepCountCalls).toHaveLength(1);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.steps.sampleCount).toBe(1); // one fixture sample carries the whole `stepsRawTotal`
  });

  it('B1: captures the native-merged total in diagnostics WITHOUT selecting it — stepsToday still ignores it even when it differs from both other numbers', async () => {
    const fakeHK = makeFakeHK({
      stepsRawTotal: 2650,
      bucketedEntries: [
        { source: { name: 'iPhone' }, sumQuantity: { unit: 'count', quantity: 400 }, startDate: new Date('2026-08-05T09:00:00.000Z') },
        { source: { name: "Brandon's Apple Watch" }, sumQuantity: { unit: 'count', quantity: 420 }, startDate: new Date('2026-08-05T09:00:00.000Z') },
      ],
      nativeMergedQuantity: 9999, // deliberately different from both other numbers
    });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.stepsToday).toBe(420); // NOT 9999 — capture-only per B1.2

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.steps.nativeMergedTotal).toBe(9999); // still captured for the panel
  });

  it('the bucketed query THROWING falls back to the raw sum (pre-existing behavior, unchanged)', async () => {
    const fakeHK = makeFakeHK({
      stepsRawTotal: 5000,
      bucketedEntries: new Error('HealthKit query failed'),
    });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.stepsToday).toBe(5000);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.steps.usedFallback).toBe(true);
  });

  it('B1.3 (the verdict-blocking fix): the bucketed query resolving to an EMPTY array while raw samples exist falls back to the raw sum instead of silently reporting 0', async () => {
    const fakeHK = makeFakeHK({
      stepsRawTotal: 6200, // real samples exist for the day
      bucketedEntries: [], // native `handleHKNoDataOrThrow` resolved [] rather than throwing
    });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    // Without the fix: reduceStepsByBucketMax([]) === 0, usedFallback stays
    // false, and this would be 0 — a hard "0 steps" shown to a user who has
    // 6,200 real raw samples for the day.
    expect(snapshot.stepsToday).toBe(6200);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.steps.usedFallback).toBe(true);
    expect(diag?.steps.bucketedMaxTotal).toBe(0);
  });

  it('an empty bucketed array is NOT treated as a fallback trigger when the raw sum is also zero (a genuine no-data day, not a silent-zero bug)', async () => {
    const fakeHK = makeFakeHK({
      stepsRawTotal: 0, // genuinely no steps recorded today
      bucketedEntries: [],
    });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.stepsToday).toBe(0);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    // The precise condition is "empty buckets AND raw samples > 0" — a
    // genuine zero-step day must not be misreported as a fallback.
    expect(diag?.steps.usedFallback).toBe(false);
  });

  it('SF-2: a NON-empty bucket array whose entries are all zero-quantity (mapStatsToBuckets coerces a missing sumQuantity to 0) falls back to the raw sum instead of silently reporting 0', async () => {
    const fakeHK = makeFakeHK({
      stepsRawTotal: 6200, // real samples exist for the day
      // Non-empty — the OLD `buckets.length === 0` guard would NOT fire here
      // — but every entry's `sumQuantity` is missing, which
      // `mapStatsToBuckets` coerces to `quantity: 0`, so
      // `reduceStepsByBucketMax` still returns 0.
      bucketedEntries: [
        { source: { name: 'iPhone' }, sumQuantity: undefined, startDate: new Date('2026-08-05T09:00:00.000Z') },
        { source: { name: "Brandon's Apple Watch" }, sumQuantity: undefined, startDate: new Date('2026-08-05T10:00:00.000Z') },
      ],
    });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    // Without the SF-2 fix: reduceStepsByBucketMax(buckets) === 0 (buckets
    // is non-empty, so the old length-only guard never fires), usedFallback
    // stays false, and this would be 0 — a hard "0 steps" shown to a user
    // who has 6,200 real raw samples for the day.
    expect(snapshot.stepsToday).toBe(6200);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.steps.usedFallback).toBe(true);
    expect(diag?.steps.bucketedMaxTotal).toBe(0);
  });

  it('SF-1: with diagnostics OFF (healthkit_native_enabled path, no internal-TestFlight env), the native-merged statistics query is NEVER issued — its only consumer is diagnostics-gated', async () => {
    const fakeHK = makeFakeHK({
      stepsRawTotal: 2650,
      bucketedEntries: [
        { source: { name: 'iPhone' }, sumQuantity: { unit: 'count', quantity: 400 }, startDate: new Date('2026-08-05T09:00:00.000Z') },
      ],
      nativeMergedQuantity: 999,
    });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHKDiagnosticsOff(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    // The rest of the pipeline is unaffected by diagnostics being off.
    expect(snapshot.stepsToday).toBe(400);

    // The assertion that actually proves SF-1: the query whose only
    // consumer is the (now-skipped) diagnostics block was never issued.
    expect(fakeHK.queryStatisticsForQuantity).not.toHaveBeenCalled();

    // And, consistently, nothing was captured to read back.
    expect(diagnostics.getLastAppleHealthDiagnostics()).toBeNull();
  });
});
