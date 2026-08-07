/**
 * RC-2 Ruling A (2026-08-06) — the full sleep SELECTION chain, exercised
 * end-to-end through `fetchAppleHealthSnapshot`, mirroring
 * `appleHealth.stepsSelection.test.ts`'s role for the steps fix.
 *
 * `appleHealth.sleepAggregation.test.ts` tests `selectSleepIntervals` /
 * `reduceSleepByIntervalUnion` in isolation; `appleHealth.sleepAdapter.test.ts`
 * tests `mapCategorySamplesToSleepIntervals` in isolation. Neither exercises
 * the wiring in `fetchAppleHealthSnapshot` that ties them together: the
 * empty-selection fallback guard, the diagnostics capture (total vs. summed
 * sample counts, selection branch, per-source totals), and the reproduction
 * of the actual device scenario (build 48: 13.332682222222223h from 49
 * samples for a ~7.5h night) through the real fetch path.
 *
 * Mocks the native module's dynamic import the same way
 * `appleHealth.stepsSelection.test.ts` does: `vi.doMock` + `vi.resetModules()`
 * + a fresh dynamic `import('../appleHealth')` per test, so
 * `isAppleHealthSupported()` is genuinely `true` via the
 * `EXPO_PUBLIC_INTERNAL_TESTFLIGHT` seam Ruling A already proved.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

interface FakeHK {
  queryQuantitySamples: ReturnType<typeof vi.fn>;
  queryStatisticsCollectionForQuantitySeparateBySource: ReturnType<typeof vi.fn>;
  queryStatisticsForQuantity: ReturnType<typeof vi.fn>;
  queryStatisticsForQuantitySeparateBySource: ReturnType<typeof vi.fn>;
  queryCategorySamples: ReturnType<typeof vi.fn>;
}

/** A harmless HealthKit quantity sample — used for RHR/HRV/steps paths this suite does not focus on. */
function harmlessQuantitySample() {
  return { quantity: 50, startDate: new Date(), endDate: new Date(), sourceRevision: { source: { name: 'iPhone' } } };
}

/**
 * Builds a fake `@kingstinct/react-native-healthkit` module. `sleepSamples`
 * controls exactly what `queryCategorySamples` resolves to (or an Error to
 * throw); every other query resolves harmlessly so RHR/HRV/steps code paths
 * never throw and never distract from the sleep assertions under test.
 */
function makeFakeHK(opts: { sleepSamples: unknown }): FakeHK {
  const { sleepSamples } = opts;
  return {
    queryQuantitySamples: vi.fn(async () => [harmlessQuantitySample()]),
    queryStatisticsCollectionForQuantitySeparateBySource: vi.fn(async () => []),
    queryStatisticsForQuantity: vi.fn(async () => ({ sumQuantity: undefined })),
    queryStatisticsForQuantitySeparateBySource: vi.fn(async () => []),
    queryCategorySamples: vi.fn(async () => {
      if (sleepSamples instanceof Error) throw sleepSamples;
      return sleepSamples;
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
});

function stageSample(startIso: string, endIso: string, value: 3 | 4 | 5, source: string) {
  return { startDate: new Date(startIso), endDate: new Date(endIso), value, sourceRevision: { source: { name: source } } };
}
function unspecifiedSample(startIso: string, endIso: string, source: string) {
  return { startDate: new Date(startIso), endDate: new Date(endIso), value: 1, sourceRevision: { source: { name: source } } };
}

describe('fetchAppleHealthSnapshot — sleep selection chain (Ruling A device scenario)', () => {
  it('reproduces the build-48 evidence: Watch stages + iPhone unspecified overlapping the same night collapse to ~6.7h, NOT ~13.3h', async () => {
    const watchStages = [
      stageSample('2026-08-05T23:00:00.000Z', '2026-08-06T01:00:00.000Z', 3, "Brandon's Apple Watch"),
      stageSample('2026-08-06T01:00:00.000Z', '2026-08-06T03:00:00.000Z', 4, "Brandon's Apple Watch"),
      stageSample('2026-08-06T03:00:00.000Z', '2026-08-06T05:40:00.000Z', 5, "Brandon's Apple Watch"), // total 6h40m = 6.6667h
    ];
    const iPhoneLayer = [unspecifiedSample('2026-08-05T23:00:00.000Z', '2026-08-06T05:36:00.000Z', 'iPhone')]; // 6.6h overlapping
    const fakeHK = makeFakeHK({ sleepSamples: [...watchStages, ...iPhoneLayer] });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBeCloseTo(400 / 60, 2); // 6.6667h — the stage total, not stage+unspecified

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.selectionBranch).toBe('stages');
    expect(diag?.sleep.usedFallback).toBe(false);
    // Old-method comparison: flat sum of ALL asleep samples (stages + the
    // overlapping unspecified layer) — the number the device evidence
    // actually showed the shape of (~13h class, not ~6.7h).
    expect(diag?.sleep.rawSumHours).toBeCloseTo((400 + 396) / 60, 2);
    expect(diag?.sleep.unionHours).toBeCloseTo(400 / 60, 2);
  });

  it('distinguishes total vs. summed sample counts: inBed/awake rows count toward the total but not the summed selection', async () => {
    const samples = [
      { startDate: new Date('2026-08-05T22:30:00.000Z'), endDate: new Date('2026-08-05T23:00:00.000Z'), value: 0, sourceRevision: { source: { name: 'iPhone' } } }, // inBed
      stageSample('2026-08-05T23:00:00.000Z', '2026-08-06T02:00:00.000Z', 4, "Brandon's Apple Watch"),
      { startDate: new Date('2026-08-06T02:00:00.000Z'), endDate: new Date('2026-08-06T02:10:00.000Z'), value: 2, sourceRevision: { source: { name: 'iPhone' } } }, // awake
      stageSample('2026-08-06T02:10:00.000Z', '2026-08-06T05:00:00.000Z', 3, "Brandon's Apple Watch"),
    ];
    const fakeHK = makeFakeHK({ sleepSamples: samples });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    await appleHealth.fetchAppleHealthSnapshot();
    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.totalSampleCount).toBe(4); // every returned row
    expect(diag?.sleep.summedSampleCount).toBe(2); // only the two stage rows
    expect(diag?.sleep.selectionBranch).toBe('stages');
  });

  it('surfaces per-source, per-value-class totals in diagnostics for on-device comparison', async () => {
    const samples = [
      stageSample('2026-08-05T23:00:00.000Z', '2026-08-06T05:40:00.000Z', 4, "Brandon's Apple Watch"),
      unspecifiedSample('2026-08-05T23:00:00.000Z', '2026-08-06T05:36:00.000Z', 'iPhone'),
    ];
    const fakeHK = makeFakeHK({ sleepSamples: samples });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    await appleHealth.fetchAppleHealthSnapshot();
    const diag = diagnostics.getLastAppleHealthDiagnostics();
    const perSource = diag?.sleep.perSourceTotals ?? [];
    expect(perSource).toContainEqual({ sourceName: "Brandon's Apple Watch", valueClass: 'stage', totalHours: 400 / 60 });
    expect(perSource).toContainEqual({ sourceName: 'iPhone', valueClass: 'unspecified', totalHours: 396 / 60 });
  });

  it('the interval-union query THROWING is handled by `safe()` — resolves null, not a crash', async () => {
    const fakeHK = makeFakeHK({ sleepSamples: new Error('HealthKit query failed') });
    const { appleHealth } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBeNull();
  });

  it('empty-selection guard: every sample fails the adapter\'s defensive checks (missing startDate) while the raw flat sum still finds real duration — falls back rather than silently reporting 0h', async () => {
    // Synthetic malformed-response fixture (mirrors the steps fix's SF-2
    // `sumQuantity: undefined` fixture in spirit): `mapCategorySamplesToSleepIntervals`
    // correctly drops this row (no startDate to build an interval from),
    // while the OLD flat-sum method's looser field access still computes a
    // nonzero duration from it. This is what an empty selection with real
    // raw data looks like, not a realistic on-device shape.
    const samples = [
      { startDate: null, endDate: new Date('2026-08-06T05:30:00.000Z'), value: 1, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    const fakeHK = makeFakeHK({ sleepSamples: samples });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    // Without the fix: mapCategorySamplesToSleepIntervals(...) === [],
    // reduceSleepByIntervalUnion(...) === 0, and this would silently report
    // "0h asleep" for a night with a real (if malformed) raw sample.
    expect(snapshot.sleepHoursLastNight).toBeGreaterThan(0);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.usedFallback).toBe(true);
    expect(diag?.sleep.unionHours).toBe(0);
    expect(diag?.sleep.selectionBranch).toBe('none');
    expect(diag?.sleep.summedSampleCount).toBe(0);
    expect(diag?.sleep.totalSampleCount).toBe(1);
  });

  it('a genuine no-sleep window (zero samples) is NOT treated as a fallback trigger — 0h is reported plainly', async () => {
    const fakeHK = makeFakeHK({ sleepSamples: [] });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBe(0);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.usedFallback).toBe(false);
    expect(diag?.sleep.selectionBranch).toBe('none');
  });

  it('a window with only inBed/awake samples (real rows, but nothing asleep) is also NOT a fallback trigger', async () => {
    const samples = [
      { startDate: new Date('2026-08-05T22:00:00.000Z'), endDate: new Date('2026-08-06T06:00:00.000Z'), value: 0, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    const fakeHK = makeFakeHK({ sleepSamples: samples });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBe(0);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.usedFallback).toBe(false);
    expect(diag?.sleep.rawSumHours).toBe(0);
  });
});
