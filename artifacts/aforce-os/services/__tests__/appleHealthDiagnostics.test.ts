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
      sampleCount: 14,
      valueUsed: 7.2,
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
