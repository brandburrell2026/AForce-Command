import { describe, it, expect } from 'vitest';
import {
  HEALTH_PROVIDER_CAPABILITIES,
  HEALTH_RECORD_SCHEMA_VERSION,
  type HealthProviderId,
} from '../contracts';

const ALL: HealthProviderId[] = [
  'apple_health', 'oura', 'samsung_health', 'google_health', 'garmin', 'whoop', 'strava',
];

describe('provider capability declarations', () => {
  it('every provider has a declaration; no undeclared providers', () => {
    expect(Object.keys(HEALTH_PROVIDER_CAPABILITIES).sort()).toEqual([...ALL].sort());
  });

  it('partner-program providers are marked requiresExternalApproval', () => {
    expect(HEALTH_PROVIDER_CAPABILITIES.garmin.requiresExternalApproval).toBe(true);
    expect(HEALTH_PROVIDER_CAPABILITIES.samsung_health.requiresExternalApproval).toBe(true);
    expect(HEALTH_PROVIDER_CAPABILITIES.oura.requiresExternalApproval).toBe(false);
    expect(HEALTH_PROVIDER_CAPABILITIES.whoop.requiresExternalApproval).toBe(false);
  });

  it('Samsung is modeled as via_health_connect — never a false direct-connection claim in Phase 1', () => {
    expect(HEALTH_PROVIDER_CAPABILITIES.samsung_health.method).toBe('via_health_connect');
  });

  it('Garmin is dormant: activation gates name partner credentials + endpoint verification', () => {
    const gates = HEALTH_PROVIDER_CAPABILITIES.garmin.activationGates.join(' ');
    expect(gates).toMatch(/DORMANT/);
    expect(gates).toMatch(/partner credentials/i);
    expect(gates).toMatch(/endpoints verified/i);
  });

  it('Strava is parked: kept intact, not exposed', () => {
    expect(HEALTH_PROVIDER_CAPABILITIES.strava.activationGates.join(' ')).toMatch(/PARKED/);
  });

  it('HRV method declarations match the honest statistics (Apple SDNN; cloud wearables RMSSD)', () => {
    expect(HEALTH_PROVIDER_CAPABILITIES.apple_health.hrvMethod).toBe('sdnn');
    expect(HEALTH_PROVIDER_CAPABILITIES.whoop.hrvMethod).toBe('rmssd');
    expect(HEALTH_PROVIDER_CAPABILITIES.oura.hrvMethod).toBe('rmssd');
    expect(HEALTH_PROVIDER_CAPABILITIES.garmin.hrvMethod).toBe('rmssd');
    expect(HEALTH_PROVIDER_CAPABILITIES.strava.hrvMethod).toBeNull();
  });

  it('provider scores are declared per provider and stay attributed (no shared score kind)', () => {
    expect(HEALTH_PROVIDER_CAPABILITIES.whoop.providerScores).toEqual(['whoop_recovery', 'whoop_strain']);
    expect(HEALTH_PROVIDER_CAPABILITIES.oura.providerScores).toEqual(['oura_readiness']);
    const all = ALL.flatMap((p) => HEALTH_PROVIDER_CAPABILITIES[p].providerScores);
    expect(new Set(all).size).toBe(all.length); // no score kind claimed by two providers
  });

  it('no two DISTINCT providers declare the same providerScores kind (explicit pairwise check)', () => {
    // Independent of the Set-size trick above: enumerate every provider pair
    // and assert their declared providerScores arrays share no kind. This is
    // the invariant signalResolution.ts's `SCORE_KIND_OWNER` / ownership
    // guard depends on — if it ever failed, a provider_score record's true
    // owner would be ambiguous.
    for (let i = 0; i < ALL.length; i++) {
      for (let j = i + 1; j < ALL.length; j++) {
        const a = HEALTH_PROVIDER_CAPABILITIES[ALL[i]].providerScores;
        const b = HEALTH_PROVIDER_CAPABILITIES[ALL[j]].providerScores;
        const shared = a.filter((kind) => b.includes(kind));
        expect(shared).toEqual([]);
      }
    }
  });

  it('backfill caps respect the Health Connect 30-day floor; SpO₂ / clinical types are absent from release-1 record types', () => {
    for (const p of ALL) {
      expect(HEALTH_PROVIDER_CAPABILITIES[p].maxBackfillDays).toBeLessThanOrEqual(30);
      const types = HEALTH_PROVIDER_CAPABILITIES[p].recordTypes.join(' ');
      expect(types).not.toMatch(/spo2|oxygen|clinical|medication|diagnos/i);
    }
  });

  it('schema version is 1', () => {
    expect(HEALTH_RECORD_SCHEMA_VERSION).toBe(1);
  });
});
