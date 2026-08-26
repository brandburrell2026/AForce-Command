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

// RC-1 Wave 4: the worst-10 coach-voice rewrite (item 1) and the new
// context-variant explanations (item 2) both live under `coach.*`, which
// this suite did not previously sweep — added so the guard applies to
// every string that namespace ships, not just `coachIntelligence.*`.
describe('Section 64 — every coach.* locale string is compliant', () => {
  const ns = (en as unknown as Record<string, Record<string, unknown>>).coach;

  it('the namespace exists', () => {
    expect(ns).toBeTruthy();
  });

  it('no coach.* string uses forbidden words or population comparison', () => {
    for (const [k, v] of Object.entries(ns)) {
      if (typeof v !== 'string') continue; // skip nested namespaces (coach.v2.*)
      expect(isCompliantCoachLine(v), `coach.${k} = ${JSON.stringify(v)}`).toBe(true);
    }
  });

  it('the RC-1 Wave-4 rewritten worst-10 lines are present and compliant', () => {
    const rewritten = [
      'balanced_explanation',
      'peak_explanation',
      'morning_explanation',
      'consequence_drop',
      'context_late_night',
      'pattern_streak',
      'social_take_rtd_explanation',
    ];
    for (const k of rewritten) {
      expect(ns[k], k).toBeTruthy();
      expect(isCompliantCoachLine(ns[k] as string), `coach.${k}`).toBe(true);
    }
  });

  it('the new context-variant explanations (heat/sleep/streak) are compliant', () => {
    const variants = [
      'peak_explanation_heat', 'peak_explanation_sleep', 'peak_explanation_streak',
      'balanced_explanation_heat', 'balanced_explanation_sleep', 'balanced_explanation_streak',
      'recovering_explanation_heat', 'recovering_explanation_sleep',
      'depleted_explanation_heat', 'depleted_explanation_sleep',
    ];
    for (const k of variants) {
      expect(ns[k], k).toBeTruthy();
      expect(isCompliantCoachLine(ns[k] as string), `coach.${k}`).toBe(true);
    }
  });

  it('the compliance-flagged lines match their founder-ruled state', () => {
    // depleted_explanation: rewritten under the founder's Stage-1 S1-1
    // claims-emergency authorization (2026-08-25) — the prior text
    // ("Electrolytes will restore your balance.") was a Stage-0
    // REMOVE-class unhedged efficacy claim. This pin now locks the
    // evidence-bound replacement; changing it again requires the same
    // founder/counsel authority as before.
    expect(ns.depleted_explanation).toBe(
      'Deep recovery window. Water and electrolytes support your recovery.',
    );
    // social_do_not_drive_explanation: HELD for founder Decision B
    // (alcohol/BAC memo). Untouched — still founder/counsel owned.
    expect(ns.social_do_not_drive_explanation).toBe(
      'Reaction time and judgment are significantly reduced. A ride is the safer next move.',
    );
  });
});
