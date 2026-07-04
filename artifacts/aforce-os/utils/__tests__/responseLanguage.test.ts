import { describe, it, expect } from 'vitest';
import {
  findForbiddenResponseTerms,
  containsForbiddenResponseLanguage,
  assertCauseAndEffectResponseCopy,
  shouldPromptPhysicianConsultation,
  PHYSICIAN_CONSULTATION_MESSAGE,
} from '../intelligence/responseLanguage';
import {
  RECURRING_SYMPTOM_MIN_OCCURRENCES,
  RECURRING_SYMPTOM_WINDOW_MS,
} from '../../config/hydroStateModel';

describe('Section 59 — response language guard', () => {
  it('catches every forbidden stem and its family', () => {
    for (const t of ['risk', 'risks', 'risky', 'injury', 'injuries', 'diagnosis', 'diagnose', 'prevent', 'prevention']) {
      expect(containsForbiddenResponseLanguage(`You should ${t} it`), t).toBe(true);
    }
  });

  it('is case-insensitive and reports the matched terms', () => {
    expect(findForbiddenResponseTerms('This may PREVENT injury')).toEqual(['prevent', 'injury']);
  });

  it('does not false-positive on words that merely contain the letters', () => {
    for (const clean of ['a brisk walk', 'the asterisk', 'friskiness aside']) {
      expect(containsForbiddenResponseLanguage(clean), clean).toBe(false);
    }
  });

  it('passes clean cause-and-effect copy', () => {
    const ok = 'Starting with water before caffeine has produced your steadiest mornings.';
    expect(containsForbiddenResponseLanguage(ok)).toBe(false);
    expect(() => assertCauseAndEffectResponseCopy(ok)).not.toThrow();
  });

  it('assert throws with the offending terms when copy is non-compliant', () => {
    expect(() => assertCauseAndEffectResponseCopy('reduces injury risk')).toThrow(/injur|risk/);
  });

  it('the canonical physician message itself passes the guard', () => {
    expect(containsForbiddenResponseLanguage(PHYSICIAN_CONSULTATION_MESSAGE)).toBe(false);
  });

  it('prompts physician consultation only at/above the recurring threshold in-window', () => {
    const now = 1_700_000_000_000;
    const recent = (n: number) => Array.from({ length: n }, (_, i) => now - i * 24 * 60 * 60 * 1000);
    expect(shouldPromptPhysicianConsultation(recent(RECURRING_SYMPTOM_MIN_OCCURRENCES), now)).toBe(true);
    expect(shouldPromptPhysicianConsultation(recent(RECURRING_SYMPTOM_MIN_OCCURRENCES - 1), now)).toBe(false);
  });

  it('ignores occurrences outside the window (never counted)', () => {
    const now = 1_700_000_000_000;
    const stale = now - RECURRING_SYMPTOM_WINDOW_MS - 1;
    const ts = Array.from({ length: RECURRING_SYMPTOM_MIN_OCCURRENCES }, () => stale);
    expect(shouldPromptPhysicianConsultation(ts, now)).toBe(false);
  });
});
