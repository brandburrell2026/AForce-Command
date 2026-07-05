import { describe, it, expect } from 'vitest';
import {
  findPopulationComparison,
  findCoachLineViolations,
  isCompliantCoachLine,
  assertCompliantCoachLine,
} from '../intelligence/conversationalLanguage';
import en from '../../locales/en.json';

describe('Section 64 — conversational language guard', () => {
  it('rejects population-comparison framing', () => {
    for (const bad of [
      'You are ahead of most people',
      'compared to other users you are behind',
      'better than the average',
      'the average user drinks more',
    ]) {
      expect(findPopulationComparison(bad), bad).not.toHaveLength(0);
      expect(isCompliantCoachLine(bad), bad).toBe(false);
    }
  });

  it('also inherits the §59 forbidden words (no risk/injury/diagnosis/prevent)', () => {
    expect(findCoachLineViolations('this helps prevent injury')).toEqual(
      expect.arrayContaining(['prevent', 'injury']),
    );
    expect(isCompliantCoachLine('lowers your risk')).toBe(false);
  });

  it('accepts observation-only, own-data lines', () => {
    for (const ok of [
      "Recovery window's open. Drink 16 oz water.",
      'Your body taught us something today.',
      'Now — drink 16 oz water.',
    ]) {
      expect(isCompliantCoachLine(ok), ok).toBe(true);
    }
    expect(() => assertCompliantCoachLine("Recovery window's open.")).not.toThrow();
  });
});

describe('Section 64 — every coachIntelligence locale string is compliant', () => {
  const ns = (en as unknown as Record<string, Record<string, string>>).coachIntelligence;

  it('the namespace exists', () => {
    expect(ns).toBeTruthy();
  });

  it('no proactive line uses forbidden words or population comparison', () => {
    for (const [k, v] of Object.entries(ns)) {
      expect(isCompliantCoachLine(v), `coachIntelligence.${k} = ${JSON.stringify(v)}`).toBe(true);
    }
  });

  it('has the keys the policy points at', () => {
    for (const k of ['urgent_command', 'recovery_window', 'daily_lesson']) {
      expect(ns[k], k).toBeTruthy();
    }
  });
});
