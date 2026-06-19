import { describe, it, expect } from 'vitest';
import {
  deriveStackSignal,
  type StackSignalInput,
  type StackSignalProduct,
} from '../impact/stackSignal';

const energy: StackSignalProduct = {
  category: 'energy',
  stimulantLevel: 80,
  sugarLevel: 70,
  electrolyteDensity: 10,
  isAForce: false,
};
const water: StackSignalProduct = {
  category: 'water',
  stimulantLevel: 0,
  sugarLevel: 0,
  electrolyteDensity: 0,
  isAForce: false,
};
const protein: StackSignalProduct = {
  category: 'protein',
  stimulantLevel: 0,
  sugarLevel: 5,
  electrolyteDensity: 20,
  isAForce: false,
};

function input(over: Partial<StackSignalInput>): StackSignalInput {
  return { product: water, consumption: 'consumed', ...over };
}

describe('stackSignal · activation gating (Score-Protection)', () => {
  it('only a consumed item produces active routes', () => {
    for (const consumption of ['not_yet', 'just_curious'] as const) {
      const s = deriveStackSignal(input({ product: energy, consumption }));
      expect(s.active).toBe(false);
      expect(s.routes.brainEnergy).toBe(false);
      expect(s.routes.performanceMemory).toBe(false);
      expect(s.routes.fuelTiming).toBe(false);
      expect(s.routes.caffeine).toBe(false);
      expect(s.note).toBeNull();
      // Descriptors are still populated even when inactive.
      expect(s.caffeineLoad).toBeGreaterThan(0);
    }
  });
});

describe('stackSignal · routing', () => {
  it('a consumed caffeinated energy product routes to caffeine + brainEnergy', () => {
    const s = deriveStackSignal(input({ product: energy, consumption: 'consumed' }));
    expect(s.active).toBe(true);
    expect(s.routes.caffeine).toBe(true);
    expect(s.routes.brainEnergy).toBe(true);
    expect(s.routes.fuelTiming).toBe(true); // "energy" is a fuel keyword
    expect(s.routes.performanceMemory).toBe(true);
    expect(s.note?.toLowerCase()).toContain('water');
  });

  it('a consumed protein routes to fuelTiming (no caffeine)', () => {
    const s = deriveStackSignal(input({ product: protein, consumption: 'consumed' }));
    expect(s.isFuel).toBe(true);
    expect(s.routes.fuelTiming).toBe(true);
    expect(s.routes.caffeine).toBe(false);
    expect(s.note?.toLowerCase()).toContain('water');
  });

  it('water has no caffeine and is not fuel, but still enters performance memory', () => {
    const s = deriveStackSignal(input({ product: water, consumption: 'consumed' }));
    expect(s.caffeineLoad).toBe(0);
    expect(s.isFuel).toBe(false);
    expect(s.routes.caffeine).toBe(false);
    expect(s.routes.performanceMemory).toBe(true);
  });

  it('AForce or high-electrolyte products read as mineral support', () => {
    const s = deriveStackSignal(
      input({ product: { ...protein, electrolyteDensity: 60 }, consumption: 'consumed' }),
    );
    expect(s.isMineralSupport).toBe(true);
  });
});
