import { describe, it, expect } from 'vitest';
import { selectHydrationDemandSnapshot } from '../hydrationDemandSelector';
import { makeState, baseFlags } from '../../store/__tests__/_fixtures';
import type { ProviderBiometrics, FeatureFlags } from '../../types';

const flagsOn: FeatureFlags = { ...baseFlags, spec_demand_engine: true };

describe('selectHydrationDemandSnapshot', () => {
  it('returns null when spec_demand_engine flag is OFF', () => {
    const state = makeState();
    expect(selectHydrationDemandSnapshot(state, baseFlags)).toBeNull();
  });

  it('returns inputs+outputs+trace when flag is ON', () => {
    const state = makeState();
    const snap = selectHydrationDemandSnapshot(state, flagsOn);
    expect(snap).not.toBeNull();
    expect(snap!.inputs.weightLbs).toBeGreaterThan(0);
    expect(snap!.outputs.targetOz).toBeGreaterThanOrEqual(40);
    expect(snap!.outputs.targetOz).toBeLessThanOrEqual(220);
    expect(snap!.outputs.remainingOz).toBeGreaterThanOrEqual(0);
    expect(typeof snap!.outputs.command).toBe('string');
    expect(snap!.outputs.command.length).toBeGreaterThan(0);
    expect(['low', 'moderate', 'high']).toContain(snap!.outputs.load);
    expect(snap!.trace.sleepSource).toBeNull();
  });

  it('records freshest sleep source through to the snapshot trace', () => {
    const biometrics: ProviderBiometrics = {
      apple_health: { providerId: 'apple_health', fetchedAt: 1, sleepHoursLastNight: 6 },
      whoop: { providerId: 'whoop', fetchedAt: 999, sleepHoursLastNight: 8 },
    };
    const state = makeState({
      userState: { ...makeState().userState, biometrics },
    });
    const snap = selectHydrationDemandSnapshot(state, flagsOn);
    expect(snap!.trace.sleepSource?.source).toBe('whoop');
    expect(snap!.inputs.sleepHours).toBe(8);
  });

  it('passes overrides through to the engine result', () => {
    const state = makeState();
    const snap = selectHydrationDemandSnapshot(state, flagsOn, {
      consumedOz: 200,
      sweatProfile: 'high',
    });
    expect(snap!.inputs.consumedOz).toBe(200);
    expect(snap!.inputs.sweatProfile).toBe('high');
    expect(snap!.outputs.remainingOz).toBe(0);
  });

  it('is deterministic — same state yields same outputs', () => {
    const state = makeState();
    const a = selectHydrationDemandSnapshot(state, flagsOn);
    const b = selectHydrationDemandSnapshot(state, flagsOn);
    expect(a).toEqual(b);
  });
});
