import { describe, it, expect } from 'vitest';
import {
  CONTEXT_INPUTS,
  CONTEXT_INPUT_LABELS,
  CONTEXT_OUTPUTS,
  CONTEXT_OUTPUT_LABELS,
  ONE_ORB_INVARIANT,
  OneOrbViolationError,
  assertOneOrb,
  isContextInput,
  isContextOutput,
} from '../sharedContextLayer';

describe('sharedContextLayer — inputs', () => {
  it('lists the 13 spec inputs in order', () => {
    expect(CONTEXT_INPUTS).toEqual([
      'profile',
      'weather',
      'temperature',
      'humidity',
      'water',
      'cycles',
      'timeline',
      'hydroScan',
      'journal',
      'sleep',
      'activity',
      'social',
      'cruise',
    ]);
  });

  it('labels match the spec strings verbatim', () => {
    expect(CONTEXT_INPUT_LABELS.profile).toBe('Profile');
    expect(CONTEXT_INPUT_LABELS.weather).toBe('Weather');
    expect(CONTEXT_INPUT_LABELS.temperature).toBe('Temperature');
    expect(CONTEXT_INPUT_LABELS.humidity).toBe('Humidity');
    expect(CONTEXT_INPUT_LABELS.water).toBe('Water');
    expect(CONTEXT_INPUT_LABELS.cycles).toBe('Cycles');
    expect(CONTEXT_INPUT_LABELS.timeline).toBe('Timeline');
    expect(CONTEXT_INPUT_LABELS.hydroScan).toBe('HydroScan');
    expect(CONTEXT_INPUT_LABELS.journal).toBe('Journal');
    expect(CONTEXT_INPUT_LABELS.sleep).toBe('Sleep');
    expect(CONTEXT_INPUT_LABELS.activity).toBe('Activity');
    expect(CONTEXT_INPUT_LABELS.social).toBe('Social');
    expect(CONTEXT_INPUT_LABELS.cruise).toBe('Cruise');
  });
});

describe('sharedContextLayer — outputs', () => {
  it('lists the 5 spec outputs in order', () => {
    expect(CONTEXT_OUTPUTS).toEqual([
      'signal',
      'recovery',
      'protocol',
      'memory',
      'recommendations',
    ]);
  });

  it('labels match the spec strings verbatim', () => {
    expect(CONTEXT_OUTPUT_LABELS.signal).toBe('Signal');
    expect(CONTEXT_OUTPUT_LABELS.recovery).toBe('Recovery');
    expect(CONTEXT_OUTPUT_LABELS.protocol).toBe('Protocol');
    expect(CONTEXT_OUTPUT_LABELS.memory).toBe('Memory');
    expect(CONTEXT_OUTPUT_LABELS.recommendations).toBe('Recommendations');
  });
});

describe('type guards', () => {
  it('isContextInput returns true for every input', () => {
    for (const i of CONTEXT_INPUTS) expect(isContextInput(i)).toBe(true);
  });

  it('isContextInput returns false for unknowns', () => {
    expect(isContextInput('signal')).toBe(false);
    expect(isContextInput('')).toBe(false);
  });

  it('isContextOutput returns true for every output', () => {
    for (const o of CONTEXT_OUTPUTS) expect(isContextOutput(o)).toBe(true);
  });

  it('isContextOutput returns false for unknowns', () => {
    expect(isContextOutput('profile')).toBe(false);
    expect(isContextOutput('')).toBe(false);
  });
});

describe('One Orb invariant', () => {
  it('exports ONE_ORB_INVARIANT as true', () => {
    expect(ONE_ORB_INVARIANT).toBe(true);
  });

  it('assertOneOrb accepts exactly 1', () => {
    expect(() => assertOneOrb(1)).not.toThrow();
  });

  it.each([0, 2, 3, 10, -1])(
    'assertOneOrb throws on count = %i',
    (count) => {
      expect(() => assertOneOrb(count)).toThrow(OneOrbViolationError);
    },
  );

  it('OneOrbViolationError mentions the offending count', () => {
    try {
      assertOneOrb(2);
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('2');
      expect((err as Error).name).toBe('OneOrbViolationError');
    }
  });
});
