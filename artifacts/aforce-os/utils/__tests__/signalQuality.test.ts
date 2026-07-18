/**
 * Section 54 — Signal Quality™ grader.
 *
 * Pins the ml-engineer ruling: tier-driven, recency-free per-signal ratings;
 * the four invariants (rating monotonic in tier; the Data-Confidence bridge
 * never contradicts the ratings; environmental never Excellent; a derived kind
 * never rates above its weakest input); corroboration never promotes a tier;
 * and the redistribution/never-fail property the layer asserts.
 */
import { describe, it, expect } from 'vitest';
import { assessDataConfidence } from '../confidence/dataConfidence';
import {
  assessSignalQuality,
  ratingForTier,
  ratingToQuality,
  SOURCE_TIER,
  SIGNAL_QUALITY_RATINGS,
  type SignalQualityRating,
  type SignalQualityInput,
} from '../confidence/signalQuality';

const ORDER: Record<SignalQualityRating, number> = { unavailable: 0, limited: 1, good: 2, excellent: 3 };

describe('Section 54 — tier → rating mapping', () => {
  it('maps each tier, and null → unavailable', () => {
    expect(ratingForTier('phantom')).toBe('excellent');
    expect(ratingForTier('wearable')).toBe('good');
    expect(ratingForTier('phone')).toBe('limited');
    expect(ratingForTier(null)).toBe('unavailable');
  });

  it('invariant (a): rating is monotonic in tier (phantom ≥ wearable ≥ phone ≥ none)', () => {
    expect(ORDER[ratingForTier('phantom')]).toBeGreaterThan(ORDER[ratingForTier('wearable')]);
    expect(ORDER[ratingForTier('wearable')]).toBeGreaterThan(ORDER[ratingForTier('phone')]);
    expect(ORDER[ratingForTier('phone')]).toBeGreaterThan(ORDER[ratingForTier(null)]);
  });

  it('the source→tier table is complete and phone-floored where expected', () => {
    expect(SOURCE_TIER.phantom).toBe('phantom');
    for (const s of ['whoop', 'apple_watch', 'samsung_watch', 'garmin', 'apple_health', 'samsung_health', 'google_health', 'urine_intelligence'] as const) {
      expect(SOURCE_TIER[s], s).toBe('wearable');
    }
    for (const s of ['voice_checkin', 'manual', 'hydration_logs'] as const) {
      expect(SOURCE_TIER[s], s).toBe('phone');
    }
  });
});

describe('Section 54 — rating → Data Confidence bridge', () => {
  it('maps ratings into the confidence vocabulary', () => {
    expect(ratingToQuality('excellent')).toBe('verified');
    expect(ratingToQuality('good')).toBe('verified');
    expect(ratingToQuality('limited')).toBe('partial');
    expect(ratingToQuality('unavailable')).toBe('estimated');
  });

  it('invariant (b): the bridge never contradicts the ratings — any Good+ ⇒ band ≥ medium', () => {
    // one Good signal alone → one verified → medium (not low)
    const one = assessSignalQuality([{ kind: 'sleep', source: 'apple_watch' }]);
    expect(assessDataConfidence(one.asDataSignals).level).toBe('medium');
    // two device-grade signals → high
    const two = assessSignalQuality([
      { kind: 'sleep', source: 'phantom' },
      { kind: 'hydration_verification', source: 'urine_intelligence' },
    ]);
    expect(assessDataConfidence(two.asDataSignals).level).toBe('high');
  });

  it('limited maps to partial, NOT verified — two phone-tier signals stay medium (never high)', () => {
    // if limited→verified regressed, two verified would resolve to high; partial caps at medium
    const two = assessSignalQuality([
      { kind: 'water_intake', source: 'manual' },
      { kind: 'sleep', source: 'voice_checkin' },
    ]);
    expect(assessDataConfidence(two.asDataSignals).level).toBe('medium');
  });
});

describe('Section 54 — per-signal grading by family', () => {
  it('biometric/hydration kinds rate from the winning source tier', () => {
    const r = assessSignalQuality([
      { kind: 'sleep', source: 'phantom' },            // excellent
      { kind: 'heart_rate', source: 'whoop' },         // good
      { kind: 'hrv', source: 'garmin' },               // good (taxonomy includes hrv)
      { kind: 'water_intake', source: 'voice_checkin' }, // limited
      { kind: 'hydration_verification', source: 'urine_intelligence' }, // good (HydroScan)
    ]);
    const byKind = Object.fromEntries(r.signals.map((s) => [s.kind, s.rating]));
    expect(byKind.sleep).toBe('excellent');
    expect(byKind.heart_rate).toBe('good');
    expect(byKind.hrv).toBe('good');
    expect(byKind.water_intake).toBe('limited');
    expect(byKind.hydration_verification).toBe('good');
  });

  it('a null or unknown source is Unavailable', () => {
    const r = assessSignalQuality([
      { kind: 'sleep', source: null },
      { kind: 'heart_rate', source: 'not_a_source' as any },
      { kind: 'activity' }, // no source given
    ]);
    for (const s of r.signals) expect(s.rating, s.kind).toBe('unavailable');
  });

  it('invariant (c): environmental kinds never rate Excellent (ceiling is Good)', () => {
    const provenances = ['measured_live', 'measured_regional', 'default', 'absent'] as const;
    for (const p of provenances) {
      const r = assessSignalQuality([{ kind: 'weather', provenance: p }]);
      expect(r.signals[0].rating, p).not.toBe('excellent');
    }
    expect(assessSignalQuality([{ kind: 'weather', provenance: 'measured_live' }]).signals[0].rating).toBe('good');
    expect(assessSignalQuality([{ kind: 'climate_profile', provenance: 'default' }]).signals[0].rating).toBe('limited');
    expect(assessSignalQuality([{ kind: 'weather', provenance: 'absent' }]).signals[0].rating).toBe('unavailable');
  });

  it('invariant (d): a derived kind rates as the FLOOR of its inputs', () => {
    const r = assessSignalQuality([
      { kind: 'weather', provenance: 'measured_live' },   // good
      { kind: 'climate_profile', provenance: 'default' }, // limited
      { kind: 'environmental_pressure', derivedFrom: ['weather', 'climate_profile'] },
    ]);
    const pressure = r.signals.find((s) => s.kind === 'environmental_pressure')!;
    expect(pressure.rating).toBe('limited'); // floor(good, limited)
  });

  it('a derived kind referencing a missing input floors to unavailable', () => {
    const r = assessSignalQuality([
      { kind: 'weather', provenance: 'measured_live' },
      { kind: 'environmental_pressure', derivedFrom: ['weather', 'climate_profile'] }, // climate absent
    ]);
    expect(r.signals.find((s) => s.kind === 'environmental_pressure')!.rating).toBe('unavailable');
  });
});

describe('Section 54 — corroboration never promotes a tier', () => {
  it('multiple corroborating wearables stay Good, annotated only', () => {
    const r = assessSignalQuality([{ kind: 'sleep', source: 'whoop', corroboratingCount: 3 }]);
    expect(r.signals[0].rating).toBe('good'); // NOT excellent
    expect(r.signals[0].note).toContain('corroborated ×3');
  });

  it('a negative or non-integer corroboratingCount neither promotes nor crashes', () => {
    for (const count of [-3, 1.5, 0]) {
      const r = assessSignalQuality([{ kind: 'sleep', source: 'whoop', corroboratingCount: count }]);
      expect(r.signals[0].rating, `count=${count}`).toBe('good');
    }
  });
});

describe('Section 54 — summary rollup + redistribution assertion', () => {
  it('overall is the best-available rating; counts tally', () => {
    const r = assessSignalQuality([
      { kind: 'sleep', source: 'apple_watch' },  // good
      { kind: 'water_intake', source: 'manual' }, // limited
      { kind: 'hrv', source: null },              // unavailable
    ]);
    expect(r.overall).toBe('good');
    expect(r.counts).toEqual({ excellent: 0, good: 1, limited: 1, unavailable: 1 });
  });

  it('never fails on one missing signal: an Unavailable top signal still yields a usable read from the rest', () => {
    const inputs: SignalQualityInput[] = [
      { kind: 'hydration_verification', source: null },      // HydroScan down → unavailable
      { kind: 'sleep', source: 'phantom' },                  // excellent
      { kind: 'heart_rate', source: 'whoop' },               // good
    ];
    const r = assessSignalQuality(inputs);
    expect(r.overall).toBe('excellent'); // the strongest surviving signal
    // and the confidence bridge still reports high (2 device-grade signals remain)
    expect(assessDataConfidence(r.asDataSignals).level).toBe('high');
  });

  it('asDataSignals keys mirror the kinds; ratings enum is the canonical four', () => {
    const r = assessSignalQuality([{ kind: 'sleep', source: 'phantom' }]);
    expect(r.asDataSignals).toEqual([{ key: 'sleep', quality: 'verified' }]);
    expect([...SIGNAL_QUALITY_RATINGS].sort()).toEqual(['excellent', 'good', 'limited', 'unavailable'].sort());
  });

  it('empty input is a clean empty summary (unavailable overall, never a crash)', () => {
    const r = assessSignalQuality([]);
    expect(r.overall).toBe('unavailable');
    expect(r.signals).toEqual([]);
    expect(r.counts).toEqual({ excellent: 0, good: 0, limited: 0, unavailable: 0 });
    expect(r.asDataSignals).toEqual([]);
  });
});
