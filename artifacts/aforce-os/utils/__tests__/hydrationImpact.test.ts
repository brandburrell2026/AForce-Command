import { describe, it, expect } from 'vitest';
import {
  computeHydrationImpact,
  levelForScore,
  IMPACT_THRESHOLDS,
  DEMAND_WEIGHTS,
  type HydrationImpactInput,
  type HydrationImpactProduct,
  type HydrationImpactProfile,
  type HydrationImpactEnvironment,
} from '../impact/hydrationImpact';

// ── product fixtures ────────────────────────────────────────────────
const cola: HydrationImpactProduct = {
  hydrationSpeed: 30,
  electrolyteDensity: 5,
  sugarLevel: 70,
  stimulantLevel: 20,
  isAForce: false,
};
const aforceElectrolyte: HydrationImpactProduct = {
  hydrationSpeed: 70,
  electrolyteDensity: 85,
  sugarLevel: 10,
  stimulantLevel: 0,
  isAForce: true,
};
const plainWater: HydrationImpactProduct = {
  hydrationSpeed: 100,
  electrolyteDensity: 0,
  sugarLevel: 0,
  stimulantLevel: 0,
  isAForce: false,
  isWater: true,
};
const energyDrink: HydrationImpactProduct = {
  hydrationSpeed: 20,
  electrolyteDensity: 5,
  sugarLevel: 85,
  stimulantLevel: 70,
  isAForce: false,
};

// ── profile / env fixtures ──────────────────────────────────────────
const highDemandProfile: HydrationImpactProfile = {
  bodyWeightLbs: 220,
  biologicalSex: 'male',
  activityLevel: 9,
};
const lowDemandProfile: HydrationImpactProfile = {
  bodyWeightLbs: 130,
  biologicalSex: 'female',
  activityLevel: 1,
};
const emptyProfile: HydrationImpactProfile = {
  bodyWeightLbs: null,
  biologicalSex: 'unspecified',
  activityLevel: null,
};
const hotEnv: HydrationImpactEnvironment = { heat01: 0.8, humidity01: 0.7, tempC: 35 };
const coolEnv: HydrationImpactEnvironment = { heat01: 0.1, humidity01: null, tempC: 18 };

function input(
  product: HydrationImpactProduct,
  profile: HydrationImpactProfile,
  state: HydrationImpactInput['state'],
  environment: HydrationImpactEnvironment,
): HydrationImpactInput {
  return { product, profile, state, environment };
}

describe('hydrationImpact · levelForScore', () => {
  it('maps scores to the 4 levels at the documented thresholds', () => {
    expect(levelForScore(IMPACT_THRESHOLDS.highSupport)).toBe('HIGH_SUPPORT');
    expect(levelForScore(IMPACT_THRESHOLDS.neutral)).toBe('NEUTRAL');
    expect(levelForScore(IMPACT_THRESHOLDS.moderateImpact)).toBe('MODERATE_IMPACT');
    expect(levelForScore(IMPACT_THRESHOLDS.moderateImpact - 1)).toBe('HIGH_IMPACT');
  });
});

describe('hydrationImpact · demand weights', () => {
  it('demand weights sum to 1.0', () => {
    const sum =
      DEMAND_WEIGHTS.weight +
      DEMAND_WEIGHTS.activity +
      DEMAND_WEIGHTS.heat +
      DEMAND_WEIGHTS.humidity +
      DEMAND_WEIGHTS.state;
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('hydrationImpact · SAME product differs by profile (core requirement)', () => {
  it('a cola loads MORE for a high-demand user than a low-demand user', () => {
    const high = computeHydrationImpact(input(cola, highDemandProfile, 'DEPLETED', hotEnv));
    const low = computeHydrationImpact(input(cola, lowDemandProfile, 'PEAK', coolEnv));

    // Same product, different headline.
    expect(high.level).toBe('HIGH_IMPACT');
    expect(low.level).toBe('MODERATE_IMPACT');
    // And the high-demand read scores strictly lower (more loading).
    expect(high.score).toBeLessThan(low.score);
  });

  it('an electrolyte mix supports MORE for a high-demand user', () => {
    const high = computeHydrationImpact(
      input(aforceElectrolyte, highDemandProfile, 'DEPLETED', hotEnv),
    );
    const low = computeHydrationImpact(
      input(aforceElectrolyte, lowDemandProfile, 'PEAK', coolEnv),
    );
    expect(high.level).toBe('HIGH_SUPPORT');
    expect(high.score).toBeGreaterThanOrEqual(low.score);
    // Supportive product never reads below NEUTRAL.
    expect(low.score).toBeGreaterThanOrEqual(IMPACT_THRESHOLDS.neutral);
  });
});

describe('hydrationImpact · Water-First floor', () => {
  it('plain water never reads below NEUTRAL, even for a low-demand user', () => {
    for (const profile of [highDemandProfile, lowDemandProfile, emptyProfile]) {
      for (const env of [hotEnv, coolEnv]) {
        const r = computeHydrationImpact(input(plainWater, profile, 'PEAK', env));
        expect(['HIGH_SUPPORT', 'NEUTRAL']).toContain(r.level);
      }
    }
  });
});

describe('hydrationImpact · drivers + confidence', () => {
  it('an energy drink surfaces sugar + stimulant as load drivers', () => {
    const r = computeHydrationImpact(input(energyDrink, highDemandProfile, 'DEPLETED', hotEnv));
    const loadKeys = r.drivers.filter((d) => d.direction === 'load').map((d) => d.key);
    expect(loadKeys).toContain('sugar');
    expect(loadKeys).toContain('stimulant');
  });

  it('flags lowConfidence when body weight or activity is missing', () => {
    const r = computeHydrationImpact(input(cola, emptyProfile, 'BALANCED', coolEnv));
    expect(r.lowConfidence).toBe(true);
  });

  it('is high-confidence when weight + activity are present', () => {
    const r = computeHydrationImpact(input(cola, highDemandProfile, 'BALANCED', coolEnv));
    expect(r.lowConfidence).toBe(false);
  });

  it('an electrolyte mix surfaces electrolytes as a support driver', () => {
    const r = computeHydrationImpact(
      input(aforceElectrolyte, highDemandProfile, 'DEPLETED', hotEnv),
    );
    const supportKeys = r.drivers.filter((d) => d.direction === 'support').map((d) => d.key);
    expect(supportKeys).toContain('electrolytes');
  });
});
