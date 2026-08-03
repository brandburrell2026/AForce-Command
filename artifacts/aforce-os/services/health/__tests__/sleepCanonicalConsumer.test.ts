/**
 * SLEEP MODE — canonical-consumer bridge unit tests (W3.3).
 *
 * Covers `sleepSignalsForContainer` (services/health/sleepSignals.ts):
 *   - Flag OFF ⇒ EXACT parity with the pre-W3.3 inline container logic,
 *     regardless of what the canonical-plane fields (`records`/`connections`)
 *     say — the OFF path must never even look at them.
 *   - Flag ON ⇒ correct pass-through of `resolveHealthSignals` (the frozen
 *     canonical selector) for Apple/Oura/WHOOP-sourced readings, a stale
 *     reading, a partially-denied provider, and the no-data case — with the
 *     honest chip/freshness/provider-label mapping this bridge owns.
 */
import { describe, it, expect } from 'vitest';
import type { ProviderBiometrics } from '@/types';
import {
  sleepSignalsForContainer,
  legacySignals,
  canonicalSignals,
  type SleepSignalsContainerState,
} from '../sleepSignals';
import type { ResolveHealthSignalsInput } from '../signalResolution';
import {
  FIXED_NOW,
  HOUR,
  APPLE_ONLY,
  OURA_DIRECT,
  WHOOP_DIRECT,
  PARTIAL_PERMISSIONS,
  NO_DATA,
} from '../signalResolutionFixtures';

/** Lifts a `ResolveHealthSignalsInput` fixture into the bridge's own state shape. */
function stateFrom(input: ResolveHealthSignalsInput): SleepSignalsContainerState {
  return {
    appleHealth: undefined,
    biometrics: input.biometrics,
    records: input.records,
    activeDirectProviders: input.activeDirectProviders,
    connections: input.connections,
  };
}

// ─── Flag OFF — exact parity with the pre-W3.3 inline container logic ───────

describe('flag OFF — legacy parity', () => {
  it('Apple Health present: sleep + HRV + resting HR all come from appleHealth, connected/"Last night"', () => {
    const state: SleepSignalsContainerState = {
      appleHealth: {
        restingHeartRate: 54,
        hrvSdnn: 42.4,
        stepsToday: 8500,
        sleepHoursLastNight: 7.2,
        fetchedAt: FIXED_NOW - 1 * HOUR,
      },
      biometrics: undefined,
    };
    const out = sleepSignalsForContainer(state, FIXED_NOW, false);
    expect(out).toEqual({
      sleepLastNight: 7.2,
      recoveryMetrics: [
        { key: 'hrv', label: 'HRV', value: 42, unit: 'ms', real: true },
        { key: 'resting_hr', label: 'Resting HR', value: 54, unit: ' bpm', real: true },
      ],
      chip: 'connected',
      freshness: 'Last night',
      providerLabel: null, // legacy path never attributes a provider
    });
    expect(out).toEqual(legacySignals(state));
  });

  it('no appleHealth, freshest-across-snapshots wins for sleep; HRV/RHR stay Apple-only (absent here)', () => {
    const biometrics: ProviderBiometrics = {
      oura: { providerId: 'oura', fetchedAt: FIXED_NOW - 1 * HOUR, sleepHoursLastNight: 7.8 },
      whoop: { providerId: 'whoop', fetchedAt: FIXED_NOW - 3 * HOUR, sleepHoursLastNight: 6.2 },
    };
    const state: SleepSignalsContainerState = { appleHealth: undefined, biometrics };
    const out = sleepSignalsForContainer(state, FIXED_NOW, false);
    expect(out.sleepLastNight).toBe(7.8); // oura is the freshest fetch, wins outright — never averaged with whoop's 6.2
    expect(out.recoveryMetrics).toEqual([]); // HRV/RHR are Apple-only pre-W3.3, and no appleHealth exists
    expect(out.chip).toBe('connected');
    expect(out.freshness).toBe('Last night');
    expect(out.providerLabel).toBeNull();
  });

  it('a health object exists but carries no sleep signal ⇒ waiting, not fabricated', () => {
    const state: SleepSignalsContainerState = {
      appleHealth: { restingHeartRate: 54, hrvSdnn: null, stepsToday: 8500, sleepHoursLastNight: null, fetchedAt: FIXED_NOW },
      biometrics: undefined,
    };
    const out = sleepSignalsForContainer(state, FIXED_NOW, false);
    expect(out.sleepLastNight).toBeNull();
    expect(out.chip).toBe('waiting');
    expect(out.freshness).toBe('No recent signal');
  });

  it('nothing connected at all ⇒ not_connected, no freshness copy', () => {
    const state: SleepSignalsContainerState = { appleHealth: undefined, biometrics: undefined };
    const out = sleepSignalsForContainer(state, FIXED_NOW, false);
    expect(out.chip).toBe('not_connected');
    expect(out.freshness).toBeNull();
    expect(out.sleepLastNight).toBeNull();
    expect(out.recoveryMetrics).toEqual([]);
  });

  it('OFF path ignores the canonical-plane fields entirely — same fixture, records/connections say "rich data", legacy still reports nothing', () => {
    // OURA_DIRECT has a real sleep record on the RECORD plane, which the legacy
    // path never reads (it only understands `appleHealth` + `biometrics`).
    const state = stateFrom(OURA_DIRECT);
    const out = sleepSignalsForContainer(state, FIXED_NOW, false);
    expect(out.sleepLastNight).toBeNull();
    expect(out.chip).toBe('not_connected');
    expect(out.providerLabel).toBeNull();
  });
});

// ─── Flag ON — canonical selector pass-through ──────────────────────────────

describe('flag ON — canonical selector, multi-provider readings', () => {
  it('Apple-only (snapshot plane): sleep + HRV + resting HR all resolve, attributed to Apple Health', () => {
    const out = canonicalSignals(stateFrom(APPLE_ONLY), FIXED_NOW);
    expect(out.sleepLastNight).toBe(7.2);
    expect(out.chip).toBe('connected');
    expect(out.freshness).toBe('Last night');
    expect(out.providerLabel).toBe('Apple Health');
    expect(out.recoveryMetrics).toEqual(
      expect.arrayContaining([
        { key: 'hrv', label: 'HRV', value: 42, unit: 'ms', real: true },
        { key: 'resting_hr', label: 'Resting HR', value: 54, unit: ' bpm', real: true },
      ]),
    );
  });

  it('Oura direct (record plane): sleep resolves and attributes to Oura Ring — HRV/RHR honestly absent (no reading yet)', () => {
    const out = canonicalSignals(stateFrom(OURA_DIRECT), FIXED_NOW);
    expect(out.sleepLastNight).toBe(7.8);
    expect(out.providerLabel).toBe('Oura Ring');
    expect(out.chip).toBe('connected');
    expect(out.recoveryMetrics).toEqual([]); // no fabricated HRV/RHR just because Oura is connected
  });

  it('WHOOP direct (record plane): HRV now surfaces via the canonical path (previously Apple-only) — sleep stays honestly "waiting"', () => {
    const out = canonicalSignals(stateFrom(WHOOP_DIRECT), FIXED_NOW);
    expect(out.recoveryMetrics).toEqual([{ key: 'hrv', label: 'HRV', value: 38, unit: 'ms', real: true }]);
    // WHOOP is connected (activeDirectProviders) but never produced a sleep
    // reading in this fixture — honestly "waiting", never "connected".
    expect(out.sleepLastNight).toBeNull();
    expect(out.chip).toBe('waiting');
    expect(out.providerLabel).toBeNull();
  });
});

describe('flag ON — stale signal never presents as connected-fresh', () => {
  it('a sleep reading past the staleAfter window (36h) stays available but flips the chip to needs_attention', () => {
    const biometrics: ProviderBiometrics = {
      apple_health: { providerId: 'apple_health', fetchedAt: FIXED_NOW - 40 * HOUR, sleepHoursLastNight: 6.5 },
    };
    const state: SleepSignalsContainerState = { appleHealth: undefined, biometrics, activeDirectProviders: new Set() };
    const out = canonicalSignals(state, FIXED_NOW);
    // The value is still real and available (sleep never hard-expires, see
    // config/hydroStateModel.ts FRESHNESS_WINDOWS.sleep) — but it must NOT
    // read as a fresh "connected" signal to the user.
    expect(out.sleepLastNight).toBe(6.5);
    expect(out.chip).toBe('needs_attention');
    expect(out.freshness).toBe('Signal is stale');
  });
});

describe('flag ON — partial permissions (denied family)', () => {
  it('sleep resolves normally while a denied HRV scope is honestly suppressed, never shown despite a raw value existing', () => {
    const out = canonicalSignals(stateFrom(PARTIAL_PERMISSIONS), FIXED_NOW);
    expect(out.sleepLastNight).toBe(7);
    expect(out.chip).toBe('connected');
    expect(out.providerLabel).toBe('Apple Health');
    // hrvSdnnMs: 40 is present in the raw fixture but HRV is in `deniedTypes` —
    // it must never surface as a recovery metric.
    expect(out.recoveryMetrics).toEqual([]);
  });
});

describe('flag ON — no data anywhere', () => {
  it('reports the fully honest empty state — not_connected, no freshness copy, no metrics', () => {
    const out = canonicalSignals(stateFrom(NO_DATA), FIXED_NOW);
    expect(out.sleepLastNight).toBeNull();
    expect(out.chip).toBe('not_connected');
    expect(out.freshness).toBeNull();
    expect(out.providerLabel).toBeNull();
    expect(out.recoveryMetrics).toEqual([]);
  });
});

// ─── sleepSignalsForContainer — the one seam the screen calls ───────────────

describe('sleepSignalsForContainer — flag routing', () => {
  it('flag false delegates to legacySignals exactly; flag true delegates to canonicalSignals exactly', () => {
    const state = stateFrom(APPLE_ONLY);
    expect(sleepSignalsForContainer(state, FIXED_NOW, false)).toEqual(legacySignals(state));
    expect(sleepSignalsForContainer(state, FIXED_NOW, true)).toEqual(canonicalSignals(state, FIXED_NOW));
  });
});
