import { describe, it, expect } from 'vitest';
import {
  findLessonFramingViolations,
  findLessonLanguageViolations,
  isCompliantLessonCopy,
  assertCompliantLessonCopy,
  ON_TRACK_MESSAGE,
} from '../intelligence/livingPerformanceLanguage';
import en from '../../locales/en.json';

describe('Section 61 — living-performance language guard', () => {
  it('rejects first-person-OS-knows / "learned about [name]" framing', () => {
    for (const bad of [
      'What did I learn about Jane today',
      'I learned that you skip water',
      'We learned about you this week',
      'Here is what I learned',
      'learned about her routine',
    ]) {
      expect(findLessonFramingViolations(bad), bad).not.toHaveLength(0);
      expect(isCompliantLessonCopy(bad), bad).toBe(false);
    }
  });

  it('accepts the required "your body taught us" framing', () => {
    const ok = 'Your body taught us that starting with water lines up with your steadiest energy.';
    expect(isCompliantLessonCopy(ok)).toBe(true);
    expect(() => assertCompliantLessonCopy(ok)).not.toThrow();
  });

  it('also inherits the Section 59 forbidden words (no prevention/causal-medical)', () => {
    expect(findLessonLanguageViolations('this helps prevent injury')).toEqual(expect.arrayContaining(['prevent', 'injury']));
    expect(isCompliantLessonCopy('reduces risk')).toBe(false);
  });

  it('the canonical Silent Intelligence line passes the guard', () => {
    expect(isCompliantLessonCopy(ON_TRACK_MESSAGE)).toBe(true);
    expect(ON_TRACK_MESSAGE).toBe("You're exactly where you should be.");
  });
});

describe('Section 61 — every livingPerformance locale string is compliant', () => {
  const ns = (en as unknown as Record<string, Record<string, string>>).livingPerformance;

  it('the namespace exists', () => {
    expect(ns).toBeTruthy();
  });

  it('every string satisfies the word + framing rules', () => {
    for (const [k, v] of Object.entries(ns)) {
      expect(isCompliantLessonCopy(v), `livingPerformance.${k} = ${JSON.stringify(v)}`).toBe(true);
    }
  });

  it('the lesson lines use the "taught us" framing', () => {
    expect(ns.lesson_improved.toLowerCase()).toContain('taught us');
    expect(ns.lesson_declined.toLowerCase()).toContain('taught us');
  });
});
