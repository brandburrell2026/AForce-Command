/**
 * Foundation 1A — health_* feature flags govern provider connectability.
 * All flags default OFF; WHOOP keeps its server-credential gating until the
 * provider-kit cutover (PR 1B). A real link always wins over flag state —
 * flags gate NEW connections, they never fake or hide a genuine one.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveProviderRowStatus,
  healthFlagsFromFeatureFlags,
  HEALTH_FLAG_BY_PROVIDER,
} from '../health/providerRowStatus';
import { DEFAULT_FLAGS } from '@/featureFlags/flags';

const NOW = 1_800_000_000_000;

describe('flag gating (default OFF) blocks new connections', () => {
  it('Apple Health: native module ready but health_apple_enabled off → NOT connectable', () => {
    const s = deriveProviderRowStatus({
      provider: 'apple_health', platform: 'ios', appleNativeReady: true, nowMs: NOW,
      healthFlags: healthFlagsFromFeatureFlags(DEFAULT_FLAGS),
    });
    expect(s.connectable).toBe(false);
    expect(s.status).toBe('coming_soon');
  });

  it('Apple Health: flag ON + native ready → connectable (connect state)', () => {
    const s = deriveProviderRowStatus({
      provider: 'apple_health', platform: 'ios', appleNativeReady: true, nowMs: NOW,
      healthFlags: { apple_health: true },
    });
    expect(s.status).toBe('connect');
    expect(s.connectable).toBe(true);
  });

  it('omitted healthFlags map ⇒ not enabled (fail-closed) for every non-WHOOP provider', () => {
    const s = deriveProviderRowStatus({
      provider: 'apple_health', platform: 'ios', appleNativeReady: true, nowMs: NOW,
    });
    expect(s.connectable).toBe(false);
  });

  it('WHOOP carve-out: connectability still governed by the server credential probe, not the flag', () => {
    const s = deriveProviderRowStatus({
      provider: 'whoop', platform: 'ios', whoopState: 'not_connected', nowMs: NOW,
      healthFlags: healthFlagsFromFeatureFlags(DEFAULT_FLAGS), // health_whoop_enabled false
    });
    expect(s.status).toBe('connect'); // unchanged shipped behavior until PR 1B cutover
    expect(s.connectable).toBe(true);
  });

  it('a REAL link always wins with flags off — flags never hide a genuine connection', () => {
    const s = deriveProviderRowStatus({
      provider: 'garmin', platform: 'ios', garminLive: true, nowMs: NOW,
      healthFlags: healthFlagsFromFeatureFlags(DEFAULT_FLAGS),
    });
    expect(s.status).toBe('connected');
    expect(s.live).toBe(true);
  });
});

describe('flag map plumbing', () => {
  it('healthFlagsFromFeatureFlags maps every provider to its declared flag key', () => {
    const map = healthFlagsFromFeatureFlags({
      health_apple_enabled: true,
      health_google_connect_enabled: false,
      health_whoop_enabled: false,
      health_oura_enabled: true,
      health_strava_enabled: false,
      health_garmin_enabled: false,
      health_samsung_direct_enabled: false,
    });
    expect(map.apple_health).toBe(true);
    expect(map.oura).toBe(true);
    expect(map.google_health).toBe(false);
    expect(Object.keys(HEALTH_FLAG_BY_PROVIDER).sort()).toEqual([
      'apple_health', 'garmin', 'google_health', 'oura', 'samsung_health', 'strava', 'whoop',
    ]);
  });
});
