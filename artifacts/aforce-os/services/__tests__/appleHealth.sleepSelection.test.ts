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
 *
 * RC-2 P0 follow-up (S2, 2026-08-06, post-#585 independent verdict): the
 * empty-selection guard here used to fall back to `sumRawSleepSamples` — a
 * raw, non-deduplicated flat sum — whenever the union came back 0h with
 * `rawMs > 0`. That guard trusted a number (`rawMs`) that could itself be
 * silently corrupted: a single malformed raw sample (`startDate: null`)
 * coerces through `new Date(null).getTime()` to epoch (1970), so a real
 * `endDate` minus epoch measured ~496,109.5 fallback HOURS on-device-shaped
 * test data — this file's own fixture previously asserted only
 * `toBeGreaterThan(0)`, which that bogus value trivially satisfies. The
 * fallback now returns `null` (honest "unknown"), gated on whether the
 * adapter had to drop a raw sample at all, not on the (now also hardened,
 * but no longer trusted as a fallback VALUE) raw sum's magnitude.
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
    expect(diag?.sleep.sleepValueUnknown).toBe(false);
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

  it('S2 (RC-2 P0 follow-up, 2026-08-06): a malformed raw sample (null startDate) that the adapter drops reports null — NOT the ~496,109.5h epoch-to-now bug, and NOT a silent 0h either', async () => {
    // Synthetic malformed-response fixture (mirrors the steps fix's SF-2
    // `sumQuantity: undefined` fixture in spirit): `mapCategorySamplesToSleepIntervals`
    // correctly drops this row (no startDate to build an interval from), so
    // the union selection comes back empty. This is the EXACT shape that
    // produced the measured S2 regression: the OLD fallback guard
    // (`unionMs === 0 && rawMs > 0`) fell back to `sumRawSleepSamples(samples)`
    // — which read `s.startDate` directly with no null guard.
    // `new Date(null).getTime()` is `0` (epoch, NOT `NaN` — the classic JS
    // `Date` gotcha), so a real 2026 `endDate` minus epoch produced roughly
    // 496,109.5 HOURS of "sleep" for one malformed row. `sumRawSleepSamples`
    // is now hardened to skip samples with a null/invalid start or end
    // (asserted directly below via `rawSumHours`), and the live fallback no
    // longer trusts a raw sum at all: when the adapter had to drop a raw
    // sample (`intervals.length < totalSampleCount`) and selection is
    // empty, the honest answer is `null` (unknown), not a guessed number
    // and not a silent 0h (which would falsely claim "confirmed no sleep").
    const samples = [
      { startDate: null, endDate: new Date('2026-08-06T05:30:00.000Z'), value: 1, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    const fakeHK = makeFakeHK({ sleepSamples: samples });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBeNull();

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.sleepValueUnknown).toBe(true);
    expect(diag?.sleep.unionHours).toBe(0);
    expect(diag?.sleep.selectionBranch).toBe('none');
    expect(diag?.sleep.summedSampleCount).toBe(0);
    expect(diag?.sleep.totalSampleCount).toBe(1);
    // The regression proof: without the `sumRawSleepSamples` hardening this
    // would be ~496109.5 — several orders of magnitude off a plausible
    // night's sleep. Bounding it here catches either the epoch bug (0
    // start) or a NaN-propagation bug (unparseable date) reappearing.
    expect(diag?.sleep.rawSumHours).not.toBeNull();
    expect(diag?.sleep.rawSumHours as number).toBeLessThan(24);
    expect(diag?.sleep.rawSumHours).toBe(0);
  });

  it('a raw sample with a genuinely unparseable date string is also dropped from the raw sum, not turned into NaN', async () => {
    // Same S2 hardening, the OTHER JS `Date` gotcha: `new Date('not-a-date').getTime()`
    // is `NaN`, not `0` — unguarded, `sumRawSleepSamples` would propagate
    // `NaN` through the whole reduction (`sum + NaN` is `NaN` forever after),
    // corrupting `rawSumHours` in a different way than the epoch bug.
    const samples = [
      { startDate: 'not-a-date', endDate: '2026-08-06T05:30:00.000Z', value: 1, sourceRevision: { source: { name: 'iPhone' } } },
    ];
    const fakeHK = makeFakeHK({ sleepSamples: samples });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBeNull();

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.rawSumHours).toBe(0);
    expect(Number.isNaN(diag?.sleep.rawSumHours)).toBe(false);
  });

  it('a genuine no-sleep window (zero samples) is NOT treated as a fallback trigger — 0h is reported plainly', async () => {
    const fakeHK = makeFakeHK({ sleepSamples: [] });
    const { appleHealth, diagnostics } = await loadAppleHealthWithHK(fakeHK);

    const snapshot = await appleHealth.fetchAppleHealthSnapshot();
    expect(snapshot.sleepHoursLastNight).toBe(0);

    const diag = diagnostics.getLastAppleHealthDiagnostics();
    expect(diag?.sleep.sleepValueUnknown).toBe(false);
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
    expect(diag?.sleep.sleepValueUnknown).toBe(false);
    expect(diag?.sleep.rawSumHours).toBe(0);
  });
});
