/**
 * #595 verdict, S3 — never fabricate an observation time for a null metric.
 *
 * Three sites in `fetchAppleHealthSnapshot` derived a per-field
 * `*ObservedAtMs` from a HealthKit sample's own `endDate` (or, for steps,
 * from `now`/the bucketed-end) WITHOUT first checking whether the metric
 * itself actually resolved to a value:
 *
 *   - restingHeartRateObservedAtMs (:~745) — a present RHR sample whose
 *     `.quantity` is null/undefined still had its `endDate` timestamped.
 *   - hrvSdnnObservedAtMs (:~754) — same shape, HRV.
 *   - stepsTodayObservedAtMs (:~880) — when the bucketed query throws AND
 *     the raw fallback query also fails (the ordinary shape of a denied
 *     steps permission), `stepsToday` is null but the old code still
 *     stamped `now.getTime()` onto it via `stepsUsedFallback`.
 *
 * Each is a "timestamped null" — it violates this file's own documented
 * contract on `AppleHealthSnapshot` ("OPTIONAL and ADDITIVE: undefined
 * whenever the corresponding metric itself is null ... never fabricated")
 * and pollutes `latestObservedAtMs` (max over all four fields) up to a
 * fabricated value, corrupting Apple's tier-2 fallback for every OTHER
 * field in the same snapshot (utils/biometricsAggregator.ts's
 * `resolveComparisonTimestamp`).
 *
 * Mocks the native module's dynamic import the same way
 * `appleHealth.stepsSelection.test.ts` does: `vi.doMock` +
 * `vi.resetModules()` + a fresh dynamic `import('../appleHealth')` per
 * test, reaching `isAppleHealthSupported() === true` via
 * `EXPO_PUBLIC_INTERNAL_TESTFLIGHT` rather than poking at
 * `DEFAULT_FLAGS.healthkit_native_enabled`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeHK {
  queryQuantitySamples: ReturnType<typeof vi.fn>;
  queryStatisticsCollectionForQuantitySeparateBySource: ReturnType<typeof vi.fn>;
  queryStatisticsForQuantity: ReturnType<typeof vi.fn>;
  queryStatisticsForQuantitySeparateBySource: ReturnType<typeof vi.fn>;
  queryCategorySamples: ReturnType<typeof vi.fn>;
}

const DEFAULT_RHR_ENDDATE = new Date('2026-08-06T07:00:00.000Z');
const DEFAULT_HRV_ENDDATE = new Date('2026-08-06T07:05:00.000Z');

type QuantityFixture = { quantity: number } | 'null-quantity';

/**
 * `restingHeartRate` / `hrv` are each independently configurable as either
 * a real sample (default) or `'null-quantity'` — a sample HealthKit DID
 * return (a non-empty array; `mostRecentQuantitySample` sees a real row)
 * whose `.quantity` is itself null/undefined, exactly the shape the #595
 * verdict's S3 finding calls out. `stepsBucketed` / `stepsRawTotal`
 * independently reproduce the steps fallback-chain shapes.
 */
function makeFakeHK(opts: {
  restingHeartRate?: QuantityFixture;
  hrv?: QuantityFixture;
  stepsBucketed?: unknown[] | Error;
  stepsRawTotal?: number | 'throw';
}): FakeHK {
  const {
    restingHeartRate = { quantity: 58 },
    hrv = { quantity: 42 },
    stepsBucketed = [],
    stepsRawTotal = 0,
  } = opts;

  const quantitySampleFor = (fixture: QuantityFixture, endDate: Date) => {
    if (fixture === 'null-quantity') {
      return [{ quantity: undefined, startDate: endDate, endDate, sourceRevision: { source: { name: 'iPhone' } } }];
    }
    return [{ quantity: fixture.quantity, startDate: endDate, endDate, sourceRevision: { source: { name: 'iPhone' } } }];
  };

  return {
    queryQuantitySamples: vi.fn(async (identifier: string) => {
      if (identifier === 'HKQuantityTypeIdentifierStepCount') {
        if (stepsRawTotal === 'throw') throw new Error('HealthKit raw steps query failed');
        return stepsRawTotal > 0 ? [{ quantity: stepsRawTotal, startDate: new Date(), endDate: new Date() }] : [];
      }
      if (identifier === 'HKQuantityTypeIdentifierRestingHeartRate') {
        return quantitySampleFor(restingHeartRate, DEFAULT_RHR_ENDDATE);
      }
      if (identifier === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') {
        return quantitySampleFor(hrv, DEFAULT_HRV_ENDDATE);
      }
      return [];
    }),
    queryStatisticsCollectionForQuantitySeparateBySource: vi.fn(async () => {
      if (stepsBucketed instanceof Error) throw stepsBucketed;
      return stepsBucketed;
    }),
    queryStatisticsForQuantity: vi.fn(async () => ({ sumQuantity: undefined })),
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
  return { appleHealth };
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT;
  vi.doUnmock('react-native');
  vi.doUnmock('@kingstinct/react-native-healthkit');
  vi.resetModules();
});

describe('fetchAppleHealthSnapshot — steps observedAt null guard (#595 verdict S3)', () => {
  it('bucketed query throws AND the raw fallback also fails (denied-steps-permission shape): stepsToday is null and stepsTodayObservedAtMs is never fabricated', async () => {
    const fakeHK = makeFakeHK({
      stepsBucketed: new Error('HealthKit bucketed steps query failed'),
      stepsRawTotal: 'throw',
    });
    const { appleHealth } = await loadAppleHealthWithHK(fakeHK);
    const snapshot = await appleHealth.fetchAppleHealthSnapshot();

    expect(snapshot.stepsToday).toBeNull();
    expect(snapshot.stepsTodayObservedAtMs).toBeUndefined();
    // RHR/HRV (both default to real samples) still contributed genuine
    // observations — latestObservedAtMs must reflect ONLY those, never a
    // fabricated `now` smuggled in via the null steps metric.
    expect(snapshot.latestObservedAtMs).toBe(DEFAULT_HRV_ENDDATE.getTime());
  });

  it('normal path (bucketed query succeeds) is unchanged: stepsTodayObservedAtMs is the bucketed bucket end, not fabricated', async () => {
    const fakeHK = makeFakeHK({
      stepsBucketed: [
        {
          source: { name: 'iPhone' },
          sumQuantity: { unit: 'count', quantity: 400 },
          startDate: new Date('2026-08-06T09:00:00.000Z'),
        },
      ],
    });
    const { appleHealth } = await loadAppleHealthWithHK(fakeHK);
    const snapshot = await appleHealth.fetchAppleHealthSnapshot();

    expect(snapshot.stepsToday).toBe(400);
    expect(snapshot.stepsTodayObservedAtMs).toBe(Date.parse('2026-08-06T10:00:00.000Z'));
  });
});

describe('fetchAppleHealthSnapshot — resting heart rate observedAt null guard (#595 verdict S3)', () => {
  it('a present RHR sample with a null quantity never gets a fabricated observedAt', async () => {
    const fakeHK = makeFakeHK({ restingHeartRate: 'null-quantity' });
    const { appleHealth } = await loadAppleHealthWithHK(fakeHK);
    const snapshot = await appleHealth.fetchAppleHealthSnapshot();

    expect(snapshot.restingHeartRate).toBeNull();
    expect(snapshot.restingHeartRateObservedAtMs).toBeUndefined();
    // HRV (default real sample) is the only genuine observation present —
    // latestObservedAtMs must not be corrupted by RHR's null-quantity sample.
    expect(snapshot.latestObservedAtMs).toBe(DEFAULT_HRV_ENDDATE.getTime());
  });

  it("normal path (a real quantity present) is unchanged: observedAt is the sample's own endDate", async () => {
    const fakeHK = makeFakeHK({ restingHeartRate: { quantity: 58 } });
    const { appleHealth } = await loadAppleHealthWithHK(fakeHK);
    const snapshot = await appleHealth.fetchAppleHealthSnapshot();

    expect(snapshot.restingHeartRate).toBe(58);
    expect(snapshot.restingHeartRateObservedAtMs).toBe(DEFAULT_RHR_ENDDATE.getTime());
  });
});

describe('fetchAppleHealthSnapshot — HRV observedAt null guard (#595 verdict S3)', () => {
  it('a present HRV sample with a null quantity never gets a fabricated observedAt', async () => {
    const fakeHK = makeFakeHK({ hrv: 'null-quantity' });
    const { appleHealth } = await loadAppleHealthWithHK(fakeHK);
    const snapshot = await appleHealth.fetchAppleHealthSnapshot();

    expect(snapshot.hrvSdnn).toBeNull();
    expect(snapshot.hrvSdnnObservedAtMs).toBeUndefined();
    // RHR (default real sample) is the only genuine observation present —
    // latestObservedAtMs must not be corrupted by HRV's null-quantity sample.
    expect(snapshot.latestObservedAtMs).toBe(DEFAULT_RHR_ENDDATE.getTime());
  });

  it("normal path (a real quantity present) is unchanged: observedAt is the sample's own endDate", async () => {
    const fakeHK = makeFakeHK({ hrv: { quantity: 42 } });
    const { appleHealth } = await loadAppleHealthWithHK(fakeHK);
    const snapshot = await appleHealth.fetchAppleHealthSnapshot();

    expect(snapshot.hrvSdnn).toBe(42);
    expect(snapshot.hrvSdnnObservedAtMs).toBe(DEFAULT_HRV_ENDDATE.getTime());
  });
});
