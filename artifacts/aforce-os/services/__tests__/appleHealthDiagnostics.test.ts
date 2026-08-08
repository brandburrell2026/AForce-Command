/**
 * services/appleHealthDiagnostics.ts — gating + formatting.
 *
 * The whole point of this module is that it can NEVER leak into a
 * production build: `isAppleHealthDiagnosticsEnabled()` is
 * `INTERNAL_TESTFLIGHT_OVERLAY_ENABLED`, a module-level constant evaluated
 * once at import time from `EXPO_PUBLIC_INTERNAL_TESTFLIGHT` (mirroring the
 * real build-time inlining babel-preset-expo does). Following the exact
 * pattern `appleHealth.internalTestflightGate.test.ts` already established:
 * stub the env var, `vi.resetModules()`, then dynamically re-import so the
 * module graph is re-evaluated against the new value.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadDiagnosticsModule(internalTestflight: string | undefined) {
  if (internalTestflight === undefined) {
    delete process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT;
  } else {
    vi.stubEnv('EXPO_PUBLIC_INTERNAL_TESTFLIGHT', internalTestflight);
  }
  vi.resetModules();
  return import('../appleHealthDiagnostics');
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.EXPO_PUBLIC_INTERNAL_TESTFLIGHT;
  vi.resetModules();
});

function fixtureSnapshot(overrides: Partial<Parameters<typeof buildFixture>[0]> = {}) {
  return buildFixture(overrides);
}

function buildFixture(overrides: Record<string, unknown> = {}) {
  return {
    capturedAt: 1_700_000_000_000,
    restingHeartRate: {
      identifier: 'HKQuantityTypeIdentifierRestingHeartRate',
      queried: true,
      sampleCount24h: 3,
      newest: {
        startDate: '2026-08-05T10:00:00.000Z',
        endDate: '2026-08-05T10:00:00.000Z',
        quantity: 58,
        unit: 'count/min',
        sourceName: 'iPhone',
      },
      valueUsed: 58,
    },
    hrv: {
      identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
      queried: true,
      sampleCount24h: 12,
      newest: {
        startDate: '2026-08-05T09:30:00.000Z',
        endDate: '2026-08-05T09:30:00.000Z',
        quantity: 45,
        unit: 'ms',
        sourceName: "Brandon's Apple Watch",
      },
      valueUsed: 45,
    },
    steps: {
      identifier: 'HKQuantityTypeIdentifierStepCount' as const,
      queried: true as const,
      rawSampleSum: 12000,
      bucketedMaxTotal: 7200,
      nativeMergedTotal: 7300,
      perSourceTotals: [
        { sourceName: 'iPhone', total: 4800 },
        { sourceName: "Brandon's Apple Watch", total: 7200 },
      ],
      sampleCount: 240,
      valueUsed: 7200,
      usedFallback: false,
    },
    sleep: {
      identifier: 'HKCategoryTypeIdentifierSleepAnalysis' as const,
      queried: true as const,
      queryWindowStartIso: '2026-08-05T15:00:00.000Z',
      queryWindowEndIso: '2026-08-06T09:00:00.000Z',
      totalSampleCount: 49,
      summedSampleCount: 45,
      selectionBranch: 'stages' as const,
      rawSumHours: 13.33,
      unionHours: 7.2,
      unionLastEndMs: 1_754_470_800_000,
      perSourceTotals: [
        { sourceName: 'iPhone', valueClass: 'unspecified' as const, totalHours: 6.6 },
        { sourceName: "Brandon's Apple Watch", valueClass: 'stage' as const, totalHours: 6.7 },
      ],
      valueUsed: 7.2,
      sleepValueUnknown: false,
      // RC-2 sleep-window ruling (2026-08-08): a single-session night — the
      // ordinary case, one session chosen under 'most-recent-primary'.
      sessionCount: 1,
      chosenSessionStartIso: '2026-08-05T23:00:00.000Z',
      chosenSessionEndIso: '2026-08-06T05:42:00.000Z',
      sleepSessionRule: 'most-recent-primary' as const,
      sleepSessions: [
        { startIso: '2026-08-05T23:00:00.000Z', endIso: '2026-08-06T05:42:00.000Z', durationHours: 7.2 },
      ],
    },
    workout: {
      identifier: 'HKWorkoutTypeIdentifier' as const,
      queried: false as const,
      reason: 'never queried',
    },
    mappedSnapshot: {
      restingHeartRate: 58,
      hrvSdnn: 45,
      stepsToday: 7200,
      sleepHoursLastNight: 7.2,
    },
    ...overrides,
  };
}

describe('isAppleHealthDiagnosticsEnabled — the single gate this whole module trusts', () => {
  it('production build (env unset) → disabled', async () => {
    const { isAppleHealthDiagnosticsEnabled } = await loadDiagnosticsModule(undefined);
    expect(isAppleHealthDiagnosticsEnabled()).toBe(false);
  });

  it("internal TestFlight (env='true') → enabled", async () => {
    const { isAppleHealthDiagnosticsEnabled } = await loadDiagnosticsModule('true');
    expect(isAppleHealthDiagnosticsEnabled()).toBe(true);
  });
});

describe('setLastAppleHealthDiagnostics / getLastAppleHealthDiagnostics — gated on BOTH write and read', () => {
  it('off-gate: a set is a no-op and get always returns null, even if something was set while briefly enabled', async () => {
    const mod = await loadDiagnosticsModule(undefined);
    expect(mod.getLastAppleHealthDiagnostics()).toBeNull();
    mod.setLastAppleHealthDiagnostics(fixtureSnapshot() as any);
    expect(mod.getLastAppleHealthDiagnostics()).toBeNull();
  });

  it('on-gate: a set is retained and read back verbatim', async () => {
    const mod = await loadDiagnosticsModule('true');
    expect(mod.getLastAppleHealthDiagnostics()).toBeNull();
    const snap = fixtureSnapshot();
    mod.setLastAppleHealthDiagnostics(snap as any);
    expect(mod.getLastAppleHealthDiagnostics()).toEqual(snap);
  });

  it('clearAppleHealthDiagnostics resets captured state back to null while enabled', async () => {
    const mod = await loadDiagnosticsModule('true');
    mod.setLastAppleHealthDiagnostics(fixtureSnapshot() as any);
    expect(mod.getLastAppleHealthDiagnostics()).not.toBeNull();
    mod.clearAppleHealthDiagnostics();
    expect(mod.getLastAppleHealthDiagnostics()).toBeNull();
  });
});

describe('formatAppleHealthDiagnosticsSummary — pure text formatting', () => {
  it('renders the old-vs-new steps comparison and per-source totals', async () => {
    const { formatAppleHealthDiagnosticsSummary } = await loadDiagnosticsModule(undefined);
    const text = formatAppleHealthDiagnosticsSummary(fixtureSnapshot() as any);
    expect(text).toContain('raw sample sum (old method): 12000');
    expect(text).toContain('bucketed max-per-hour (new method): 7200');
    expect(text).toContain("native merged (HealthKit's own, capture-only): 7300");
    expect(text).toContain('iPhone: 4800');
    expect(text).toContain("Brandon's Apple Watch: 7200");
  });

  it('renders the old-vs-new sleep comparison, selection branch, sample counts, and per-source totals', async () => {
    const { formatAppleHealthDiagnosticsSummary } = await loadDiagnosticsModule(undefined);
    const text = formatAppleHealthDiagnosticsSummary(fixtureSnapshot() as any);
    expect(text).toContain('raw sum (old method, no dedup): 13.33 h');
    expect(text).toContain('interval union (new method): 7.2 h');
    expect(text).toContain('selection branch: stages');
    expect(text).toContain('selected slices: 45 (from 49 samples)');
    expect(text).toContain('iPhone (unspecified): 6.60h');
    expect(text).toContain("Brandon's Apple Watch (stage): 6.70h");
  });

  it('flags the sleep value as UNKNOWN when the interval-union selection was empty and the adapter dropped a sample (F2, RC-2 P0 gate for build 49)', async () => {
    // F2: `valueUsed: 6.2` alongside a set "empty selection" flag is
    // UNREACHABLE post-#592 (S2) — when that guard fires, `sleepHoursLastNight`
    // is `null`, never a real number (see `services/appleHealth.ts`'s
    // `sleepValueUnknown` guard: it always `return null`s in the same branch
    // that sets the flag). This fixture used to assert that stale,
    // never-reachable combination, which is exactly what let the old
    // "(fallback → raw sum)" mislabel through — no raw sum is ever used.
    const { formatAppleHealthDiagnosticsSummary } = await loadDiagnosticsModule(undefined);
    const snap = fixtureSnapshot({
      sleep: {
        identifier: 'HKCategoryTypeIdentifierSleepAnalysis' as const,
        queried: true as const,
        totalSampleCount: 6,
        summedSampleCount: 0,
        selectionBranch: 'none' as const,
        rawSumHours: 6.2,
        unionHours: 0,
        perSourceTotals: [],
        valueUsed: null,
        sleepValueUnknown: true,
        // RC-2 sleep-window ruling (2026-08-08): an empty selection means
        // zero sessions — `chooseSleepSession` never ran/chose anything.
        sessionCount: 0,
        chosenSessionStartIso: null,
        chosenSessionEndIso: null,
        sleepSessionRule: 'none' as const,
        sleepSessions: [],
      },
    });
    const text = formatAppleHealthDiagnosticsSummary(snap as any);
    expect(text).toMatch(/UNKNOWN — adapter dropped raw samples; interval-union selection was empty/);
    expect(text).not.toMatch(/FALLBACK to raw sum/);
  });

  it('RC-2 sleep-window ruling (2026-08-08): renders session count, rule fired, chosen session, and all-sessions list', async () => {
    const { formatAppleHealthDiagnosticsSummary } = await loadDiagnosticsModule(undefined);
    const snap = fixtureSnapshot({
      sleep: {
        identifier: 'HKCategoryTypeIdentifierSleepAnalysis' as const,
        queried: true as const,
        totalSampleCount: 10,
        summedSampleCount: 8,
        selectionBranch: 'stages' as const,
        rawSumHours: 8.0,
        unionHours: 4.7,
        perSourceTotals: [],
        valueUsed: 4.7,
        sleepValueUnknown: false,
        sessionCount: 2,
        chosenSessionStartIso: '2026-08-06T13:00:00.000Z',
        chosenSessionEndIso: '2026-08-06T17:42:00.000Z',
        sleepSessionRule: 'longest-fallback' as const,
        sleepSessions: [
          { startIso: '2026-08-05T23:30:00.000Z', endIso: '2026-08-06T00:24:00.000Z', durationHours: 0.9 },
          { startIso: '2026-08-06T13:00:00.000Z', endIso: '2026-08-06T17:42:00.000Z', durationHours: 4.7 },
        ],
      },
    });
    const text = formatAppleHealthDiagnosticsSummary(snap as any);
    expect(text).toContain('sessions in window: 2');
    expect(text).toContain('session rule fired: longest-fallback');
    expect(text).toContain('chosen session: 2026-08-06T13:00:00.000Z → 2026-08-06T17:42:00.000Z');
    expect(text).toContain('2026-08-05T23:30:00.000Z → 2026-08-06T00:24:00.000Z (0.90h)');
    expect(text).toContain('2026-08-06T13:00:00.000Z → 2026-08-06T17:42:00.000Z (4.70h)');
  });

  it('RC-2 sleep-window ruling: a null value with no session in the window (nothing dropped) is labeled distinctly from the adapter-dropped UNKNOWN case', async () => {
    const { formatAppleHealthDiagnosticsSummary } = await loadDiagnosticsModule(undefined);
    const snap = fixtureSnapshot({
      sleep: {
        identifier: 'HKCategoryTypeIdentifierSleepAnalysis' as const,
        queried: true as const,
        totalSampleCount: 0,
        summedSampleCount: 0,
        selectionBranch: 'none' as const,
        rawSumHours: 0,
        unionHours: 0,
        perSourceTotals: [],
        valueUsed: null,
        sleepValueUnknown: false,
        sessionCount: 0,
        chosenSessionStartIso: null,
        chosenSessionEndIso: null,
        sleepSessionRule: 'none' as const,
        sleepSessions: [],
      },
    });
    const text = formatAppleHealthDiagnosticsSummary(snap as any);
    expect(text).toMatch(/no sleep session in the 36h window/);
    expect(text).not.toMatch(/UNKNOWN — adapter dropped raw samples/);
    expect(text).toContain('sessions in window: 0');
    expect(text).toContain('session rule fired: none');
    expect(text).toContain('chosen session: none');
    expect(text).toContain('all sessions: none');
  });

  it('flags a fallback explicitly when the bucketed query failed', async () => {
    const { formatAppleHealthDiagnosticsSummary } = await loadDiagnosticsModule(undefined);
    const snap = fixtureSnapshot({
      steps: {
        identifier: 'HKQuantityTypeIdentifierStepCount' as const,
        queried: true as const,
        rawSampleSum: 12000,
        bucketedMaxTotal: null,
        nativeMergedTotal: null,
        perSourceTotals: [],
        sampleCount: 240,
        valueUsed: 12000,
        usedFallback: true,
      },
    });
    const text = formatAppleHealthDiagnosticsSummary(snap as any);
    expect(text).toMatch(/FALLBACK to raw sum/);
  });

  it('reports workouts as not queried, with the reason', async () => {
    const { formatAppleHealthDiagnosticsSummary } = await loadDiagnosticsModule(undefined);
    const text = formatAppleHealthDiagnosticsSummary(fixtureSnapshot() as any);
    expect(text).toContain('Workouts: NOT QUERIED — never queried');
  });

  it('reports "not set" for scoring input when none is passed', async () => {
    const { formatAppleHealthDiagnosticsSummary } = await loadDiagnosticsModule(undefined);
    const text = formatAppleHealthDiagnosticsSummary(fixtureSnapshot() as any);
    expect(text).toContain('biometrics.apple_health: not set');
    expect(text).toContain('breakdown row: none found');
  });

  it('renders the scoring-input side when supplied by the caller', async () => {
    const { formatAppleHealthDiagnosticsSummary } = await loadDiagnosticsModule(undefined);
    const text = formatAppleHealthDiagnosticsSummary(fixtureSnapshot() as any, {
      biometricsEntry: {
        restingHeartRate: 58,
        hrvSdnn: 45,
        sleepHoursLastNight: 7.2,
        stepsToday: 7200,
        fetchedAt: 1_700_000_000_000,
      },
      recoveryContribution: {
        id: 'health_signals',
        label: 'Health platform (HRV / sleep / strain)',
        delta: 7,
        hint: 'HRV 45ms · Sleep 7.2h',
      },
    });
    expect(text).toContain('biometrics.apple_health: RHR=58 HRV=45 sleep=7.2 steps=7200');
    expect(text).toContain('breakdown row "Health platform (HRV / sleep / strain)": delta=7');
  });
});
