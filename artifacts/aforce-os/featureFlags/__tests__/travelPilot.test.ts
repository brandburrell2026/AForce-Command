import { describe, it, expect } from 'vitest';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS, demoUnlockAllFlags, travelPilotAvailable } from '../flags';

describe('travel pilot exposure', () => {
  const internal = { dev: false, internalTestflight: true };
  const publicBuild = { dev: false, internalTestflight: false };
  it('requires explicit opt-in in internal and local builds', () => {
    expect(travelPilotAvailable(DEFAULT_FLAGS, internal)).toBe(false);
    expect(travelPilotAvailable(DEMO_ALL_ON_FLAGS, internal)).toBe(false);
    expect(travelPilotAvailable({ travel_mode_enabled: true }, internal)).toBe(true);
    expect(travelPilotAvailable({ travel_mode_enabled: true }, { dev: true, internalTestflight: false })).toBe(true);
  });
  it('rejects hostile persisted flags and generic unlocks in public builds', () => {
    expect(travelPilotAvailable({ travel_mode_enabled: true }, publicBuild)).toBe(false);
    expect(demoUnlockAllFlags({ ...DEMO_ALL_ON_FLAGS, travel_mode_enabled: true }, publicBuild).travel_mode_enabled).toBe(false);
  });
});
