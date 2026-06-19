import { describe, it, expect } from 'vitest';
import {
  computeBrainEnergy,
  brainEnergyBand,
  BRAIN_ENERGY_WEIGHTS,
} from '../brainEnergy';

describe('brainEnergy · weights', () => {
  it('weights sum to 1.0', () => {
    const sum =
      BRAIN_ENERGY_WEIGHTS.energy +
      BRAIN_ENERGY_WEIGHTS.stress +
      BRAIN_ENERGY_WEIGHTS.recovery;
    expect(sum).toBeCloseTo(1, 10);
  });
});

describe('brainEnergy · computeBrainEnergy', () => {
  it('is neutral/collecting when no signal is present', () => {
    const r = computeBrainEnergy({});
    expect(r.status).toBe('collecting');
    expect(r.score).toBeNull();
    expect(r.band).toBeNull();
    expect(r.availableSignals).toBe(0);
  });

  it('high energy + low stress reads PRIMED', () => {
    const r = computeBrainEnergy({ energy: 5, stress: 1 });
    expect(r.status).toBe('ready');
    expect(r.score).toBe(100);
    expect(r.band).toBe('PRIMED');
    expect(r.label).toBe('PRIMED');
    expect(r.availableSignals).toBe(2);
  });

  it('low energy + high stress reads LOW with Water-First caption', () => {
    const r = computeBrainEnergy({ energy: 1, stress: 5 });
    expect(r.score).toBe(0);
    expect(r.band).toBe('LOW');
    expect(r.caption.toLowerCase()).toContain('hydrate');
  });

  it('inverts stress (higher stress lowers the score)', () => {
    const calm = computeBrainEnergy({ energy: 3, stress: 1 });
    const tense = computeBrainEnergy({ energy: 3, stress: 5 });
    expect((calm.score as number) > (tense.score as number)).toBe(true);
  });

  it('drops a missing signal and renormalizes the rest', () => {
    // Only energy present → score is energy alone (no flattering default).
    const energyOnly = computeBrainEnergy({ energy: 5 });
    expect(energyOnly.score).toBe(100);
    expect(energyOnly.availableSignals).toBe(1);

    const stressOnly = computeBrainEnergy({ stress: 1 });
    expect(stressOnly.score).toBe(100); // inverted stress 1 → 100
    expect(stressOnly.availableSignals).toBe(1);
  });

  it('blends recovery capacity when provided', () => {
    const r = computeBrainEnergy({ energy: 3, stress: 3, recoveryCapacity: 80 });
    expect(r.availableSignals).toBe(3);
    // energy 50, inverted-stress 50, recovery 80 → weighted ~ 56.
    expect(r.score).toBeGreaterThan(50);
    expect(r.score).toBeLessThanOrEqual(60);
  });

  it('clamps an out-of-range recovery capacity', () => {
    const r = computeBrainEnergy({ energy: 3, stress: 3, recoveryCapacity: 999 });
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe('brainEnergy · brainEnergyBand thresholds', () => {
  it('maps scores to bands', () => {
    expect(brainEnergyBand(90)).toBe('PRIMED');
    expect(brainEnergyBand(75)).toBe('PRIMED');
    expect(brainEnergyBand(60)).toBe('STEADY');
    expect(brainEnergyBand(40)).toBe('FOGGY');
    expect(brainEnergyBand(10)).toBe('LOW');
  });
});
