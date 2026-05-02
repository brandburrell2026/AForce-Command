/**
 * scoreBand thresholds must NEVER drift from the engine's
 * `levelFromScore` in scoringEngine.ts. These tests pin both the
 * boundary inclusivity (>= vs >) and the color mapping so the orb
 * digit colour and the AI Coach colour stay locked together.
 */

import { describe, it, expect } from 'vitest';
import {
  BAND_THRESHOLDS,
  levelForScore,
  accentForLevel,
  accentForScore,
} from '../scoreBand';
import { Colors } from '../../theme/colors';

describe('levelForScore — boundary inclusivity', () => {
  it('exactly 90 is PEAK', () => expect(levelForScore(90)).toBe('PEAK'));
  it('89 is BALANCED', () => expect(levelForScore(89)).toBe('BALANCED'));
  it('exactly 75 is BALANCED', () => expect(levelForScore(75)).toBe('BALANCED'));
  it('74 is RECOVERING', () => expect(levelForScore(74)).toBe('RECOVERING'));
  it('exactly 60 is RECOVERING', () => expect(levelForScore(60)).toBe('RECOVERING'));
  it('59 is DEPLETED', () => expect(levelForScore(59)).toBe('DEPLETED'));
  it('0 is DEPLETED', () => expect(levelForScore(0)).toBe('DEPLETED'));
  it('100 is PEAK', () => expect(levelForScore(100)).toBe('PEAK'));
});

describe('levelForScore — out-of-range tolerance', () => {
  it('negative scores fall to DEPLETED', () => expect(levelForScore(-5)).toBe('DEPLETED'));
  it('over-100 scores fall to PEAK', () => expect(levelForScore(150)).toBe('PEAK'));
});

describe('accentForLevel — palette wiring', () => {
  it('PEAK uses lime', () => {
    const a = accentForLevel('PEAK');
    expect(a.primary).toBe(Colors.states.PEAK.primary);
    expect(a.glow).toBe(Colors.states.PEAK.glow);
  });
  it('BALANCED uses teal', () => {
    expect(accentForLevel('BALANCED').primary).toBe(Colors.states.BALANCED.primary);
  });
  it('RECOVERING uses amber', () => {
    expect(accentForLevel('RECOVERING').primary).toBe(Colors.states.RECOVERING.primary);
  });
  it('DEPLETED uses red', () => {
    expect(accentForLevel('DEPLETED').primary).toBe(Colors.states.DEPLETED.primary);
  });
});

describe('accentForScore — score → color in one call', () => {
  it('score 78 → BALANCED teal', () => {
    expect(accentForScore(78)).toEqual({
      level: 'BALANCED',
      primary: Colors.states.BALANCED.primary,
      glow: Colors.states.BALANCED.glow,
    });
  });

  it('score 35 → DEPLETED red', () => {
    expect(accentForScore(35).primary).toBe(Colors.states.DEPLETED.primary);
  });

  it('every value 0-100 returns a defined accent (no gaps)', () => {
    for (let s = 0; s <= 100; s++) {
      const a = accentForScore(s);
      expect(a.primary).toBeDefined();
      expect(a.glow).toBeDefined();
      expect(['PEAK', 'BALANCED', 'RECOVERING', 'DEPLETED']).toContain(a.level);
    }
  });
});

describe('BAND_THRESHOLDS — invariants for the engine contract', () => {
  it('thresholds are sorted descending by min so first-match wins', () => {
    for (let i = 1; i < BAND_THRESHOLDS.length; i++) {
      expect(BAND_THRESHOLDS[i]!.min).toBeLessThan(BAND_THRESHOLDS[i - 1]!.min);
    }
  });

  it('covers every score from 0 to 100', () => {
    expect(BAND_THRESHOLDS[BAND_THRESHOLDS.length - 1]!.min).toBe(0);
  });
});
