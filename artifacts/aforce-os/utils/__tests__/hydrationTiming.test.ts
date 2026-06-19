import { describe, it, expect } from 'vitest';
import {
  computeTimingGuidance,
  HYDRATE_GAP_HOURS,
  type TimingGuidanceInput,
} from '../impact/hydrationTiming';

function input(over: Partial<TimingGuidanceInput>): TimingGuidanceInput {
  return {
    isWater: false,
    impactLevel: 'NEUTRAL',
    state: 'BALANCED',
    hoursSinceLastIntake: 0.5,
    ...over,
  };
}

describe('hydrationTiming · Water-First', () => {
  it('water is ALWAYS good timing, regardless of state or gap', () => {
    expect(
      computeTimingGuidance(
        input({ isWater: true, state: 'DEPLETED', hoursSinceLastIntake: 9 }),
      ).level,
    ).toBe('GOOD_TIMING');
    expect(
      computeTimingGuidance(input({ isWater: true, impactLevel: 'HIGH_IMPACT' })).level,
    ).toBe('GOOD_TIMING');
  });
});

describe('hydrationTiming · loading product', () => {
  it('high-load product when depleted → best after next water cycle', () => {
    const r = computeTimingGuidance(
      input({ impactLevel: 'HIGH_IMPACT', state: 'DEPLETED' }),
    );
    expect(r.level).toBe('BEST_AFTER_NEXT_WATER_CYCLE');
  });

  it('high-load product when fine → hydrate first', () => {
    const r = computeTimingGuidance(
      input({ impactLevel: 'HIGH_IMPACT', state: 'PEAK', hoursSinceLastIntake: 0.2 }),
    );
    expect(r.level).toBe('HYDRATE_FIRST');
  });
});

describe('hydrationTiming · needs-water gating', () => {
  it('supportive product when depleted → hydrate first (water leads)', () => {
    const r = computeTimingGuidance(
      input({ impactLevel: 'HIGH_SUPPORT', state: 'DEPLETED' }),
    );
    expect(r.level).toBe('HYDRATE_FIRST');
  });

  it('a long gap since last intake → hydrate first', () => {
    const r = computeTimingGuidance(
      input({ impactLevel: 'NEUTRAL', state: 'BALANCED', hoursSinceLastIntake: HYDRATE_GAP_HOURS + 1 }),
    );
    expect(r.level).toBe('HYDRATE_FIRST');
  });

  it('neutral product, fresh + balanced → good timing', () => {
    const r = computeTimingGuidance(
      input({ impactLevel: 'NEUTRAL', state: 'BALANCED', hoursSinceLastIntake: 0.3 }),
    );
    expect(r.level).toBe('GOOD_TIMING');
  });

  it('unknown gap is tolerated (no crash, not treated as a gap)', () => {
    const r = computeTimingGuidance(
      input({ impactLevel: 'NEUTRAL', state: 'BALANCED', hoursSinceLastIntake: null }),
    );
    expect(r.level).toBe('GOOD_TIMING');
  });
});
