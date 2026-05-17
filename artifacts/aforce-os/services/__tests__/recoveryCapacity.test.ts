import { describe, it, expect } from 'vitest';

import {
  bandFor,
  clamp,
  complianceFromStreak,
  computeRecoveryCapacity,
  environmentalStress,
  ramp,
  RECOVERY_BANDS,
} from '../recoveryCapacity';

describe('clamp / ramp', () => {
  it('clamps to bounds and treats NaN as the lower bound', () => {
    expect(clamp(50, 0, 100)).toBe(50);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(Number.NaN, 0, 100)).toBe(0);
  });

  it('ramps linearly between from and to, clamped 0–1', () => {
    expect(ramp(0, 0, 10)).toBe(0);
    expect(ramp(10, 0, 10)).toBe(1);
    expect(ramp(5, 0, 10)).toBe(0.5);
    expect(ramp(-1, 0, 10)).toBe(0);
    expect(ramp(11, 0, 10)).toBe(1);
    expect(ramp(Number.NaN, 0, 10)).toBe(0);
  });
});

describe('complianceFromStreak', () => {
  it('returns 0 for a zero streak and 1 for 7+ days', () => {
    expect(complianceFromStreak(0)).toBe(0);
    expect(complianceFromStreak(7)).toBe(1);
    expect(complianceFromStreak(30)).toBe(1);
  });

  it('ramps linearly across the first week', () => {
    expect(complianceFromStreak(3.5)).toBeCloseTo(0.5);
  });
});

describe('environmentalStress', () => {
  it('returns 0 when all inputs are missing — never fabricates stress', () => {
    expect(environmentalStress({})).toBe(0);
  });

  it('treats each sub-signal independently and takes the worst', () => {
    // Heat alone is enough.
    expect(environmentalStress({ tempC: 38 })).toBe(1);
    // Humidity alone is enough.
    expect(environmentalStress({ humidity: 90 })).toBe(1);
    // Activity alone is enough.
    expect(environmentalStress({ activityLevel: 10 })).toBe(1);
    // A cool, dry, sedentary baseline reports zero stress.
    expect(environmentalStress({ tempC: 20, humidity: 30, activityLevel: 0 })).toBe(0);
    // The max() combine means humidity dominates here.
    expect(environmentalStress({ tempC: 22, humidity: 65, activityLevel: 2 })).toBeCloseTo(0.5);
  });
});

describe('bandFor', () => {
  it('returns Peak at the upper rail and Critical at the lower', () => {
    expect(bandFor(100).band).toBe('peak');
    expect(bandFor(85).band).toBe('peak');
    expect(bandFor(84).band).toBe('stable');
    expect(bandFor(60).band).toBe('stable');
    expect(bandFor(59).band).toBe('declining');
    expect(bandFor(45).band).toBe('declining');
    expect(bandFor(44).band).toBe('critical');
    expect(bandFor(0).band).toBe('critical');
  });

  it('covers the entire 0–100 range without gaps', () => {
    for (let i = 0; i <= 100; i += 1) {
      expect(RECOVERY_BANDS).toContain(bandFor(i));
    }
  });

  it('uses the WHOOP-Cinematic Ferrari crimson for Critical', () => {
    expect(bandFor(10).color.toUpperCase()).toBe('#FF2800');
  });
});

describe('computeRecoveryCapacity', () => {
  it('hits 100 when everything is ideal', () => {
    const r = computeRecoveryCapacity({
      autoPilotScore: 100,
      hydrationCompliance: 1,
      environmentalStress: 0,
    });
    expect(r.score).toBe(100);
    expect(r.band).toBe('peak');
  });

  it('hits 0 when everything is at the floor', () => {
    const r = computeRecoveryCapacity({
      autoPilotScore: 0,
      hydrationCompliance: 0,
      environmentalStress: 1,
    });
    expect(r.score).toBe(0);
    expect(r.band).toBe('critical');
  });

  it('applies the documented 60 / 25 / 15 weights', () => {
    // Pure AutoPilot contribution: 50 × 0.60 = 30
    const a = computeRecoveryCapacity({
      autoPilotScore: 50, hydrationCompliance: 0, environmentalStress: 1,
    });
    expect(a.contributions.autoPilot).toBeCloseTo(30);
    expect(a.score).toBe(30);

    // Pure hydration contribution: 0.8 × 100 × 0.25 = 20
    const h = computeRecoveryCapacity({
      autoPilotScore: 0, hydrationCompliance: 0.8, environmentalStress: 1,
    });
    expect(h.contributions.hydrationCompliance).toBeCloseTo(20);
    expect(h.score).toBe(20);

    // Pure env contribution at zero stress: (1 − 0) × 100 × 0.15 = 15
    const e = computeRecoveryCapacity({
      autoPilotScore: 0, hydrationCompliance: 0, environmentalStress: 0,
    });
    expect(e.contributions.environmental).toBeCloseTo(15);
    expect(e.score).toBe(15);
  });

  it('clamps out-of-range inputs without throwing', () => {
    const r = computeRecoveryCapacity({
      autoPilotScore: 9_999,
      hydrationCompliance: -2,
      environmentalStress: 17,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });

  it('a typical "stable" user lands in the Stable band', () => {
    // AutoPilot 72, 5-day compliance streak, mild heat (28°C), moderate activity.
    const r = computeRecoveryCapacity({
      autoPilotScore: 72,
      hydrationCompliance: complianceFromStreak(5),
      environmentalStress: environmentalStress({ tempC: 28, humidity: 55, activityLevel: 4 }),
    });
    expect(r.band).toBe('stable');
  });

  it('a depleted user under heat stress lands in Critical', () => {
    const r = computeRecoveryCapacity({
      autoPilotScore: 32,
      hydrationCompliance: complianceFromStreak(0),
      environmentalStress: environmentalStress({ tempC: 38, humidity: 80, activityLevel: 8 }),
    });
    expect(r.band).toBe('critical');
    expect(r.meta.color.toUpperCase()).toBe('#FF2800');
  });
});
