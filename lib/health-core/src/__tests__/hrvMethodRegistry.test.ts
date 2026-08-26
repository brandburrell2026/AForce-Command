/**
 * HRV METHOD REGISTRY LOCK — RMSSD and SDNN can never be silently conflated.
 *
 * G1 of the Health Connect program (founder-approved 2026-08-19). The registry
 * previously carried a cross-file inconsistency the validation runbook itself
 * flagged: Samsung-via-Health-Connect declared no HRV at all (`hrvMethod:
 * null`, no 'hrv' recordType) while the shipped Health Connect mapper
 * hard-codes RMSSD for every HC HRV record — and Samsung-origin HRV genuinely
 * arrives that way (Galaxy Watch/Ring → HeartRateVariabilityRmssdRecord).
 * A validator observing a real Samsung HRV record would have found the
 * registry claiming it cannot exist.
 *
 * Method is PROVENANCE, not scoring: SDNN (Apple) and RMSSD (everyone else
 * here) measure different things and must never be averaged, compared, or
 * substituted. These locks pin (1) the registry's internal consistency,
 * (2) each provider's declared method by exact value, and (3) the downstream
 * discipline that keeps the two methods apart.
 */
import { describe, it, expect } from 'vitest';
import { HEALTH_PROVIDER_CAPABILITIES as PROVIDER_CAPABILITIES } from '../contracts';

// The downstream source-scan half of this lock (mapper hard-codes RMSSD;
// readiness consumption is method-gated) lives in
// artifacts/aforce-os/services/health/__tests__/hrvMethodDiscipline.test.ts —
// this package is node-API-free by design, so file reads cannot live here.

describe('registry internal consistency — hrv recordType ⇔ hrvMethod', () => {
  // The G1 defect class: a provider claiming HRV with no method, or a method
  // with no HRV claim. Either direction is a lie waiting for a validator.
  for (const [providerId, caps] of Object.entries(PROVIDER_CAPABILITIES)) {
    const declaresRecord = caps.recordTypes.includes('hrv');
    const declaresMethod = caps.hrvMethod !== null;
    it(`${providerId}: 'hrv' recordType and hrvMethod agree`, () => {
      expect(
        declaresRecord,
        `${providerId} declares hrvMethod=${String(caps.hrvMethod)} but no 'hrv' recordType ` +
          '(or vice versa) — the exact cross-file inconsistency G1 corrected.',
      ).toBe(declaresMethod);
    });
  }
});

describe('declared methods, pinned by exact value', () => {
  it('Samsung via Health Connect is RMSSD — the G1 correction', () => {
    expect(PROVIDER_CAPABILITIES.samsung_health.hrvMethod).toBe('rmssd');
    expect(PROVIDER_CAPABILITIES.samsung_health.recordTypes).toContain('hrv');
  });

  it('Health Connect (google_health) is RMSSD', () => {
    expect(PROVIDER_CAPABILITIES.google_health.hrvMethod).toBe('rmssd');
  });

  it('Apple Health remains SDNN — HealthKit exposes SDNN, and flipping it here would silently poison every comparison', () => {
    expect(PROVIDER_CAPABILITIES.apple_health.hrvMethod).toBe('sdnn');
  });

  it('cloud wearables (WHOOP/Oura/Garmin) remain RMSSD', () => {
    expect(PROVIDER_CAPABILITIES.whoop.hrvMethod).toBe('rmssd');
    expect(PROVIDER_CAPABILITIES.oura.hrvMethod).toBe('rmssd');
    expect(PROVIDER_CAPABILITIES.garmin.hrvMethod).toBe('rmssd');
  });
});
