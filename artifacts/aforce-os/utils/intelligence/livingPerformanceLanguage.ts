/**
 * Section 61 — Living Performance Model™ language guard.
 *
 * Enforces the HARD compliance rule for daily-lesson (and future Legacy) copy:
 *  - Always "your body taught us" framing — NEVER "what did I learn about
 *    [name]" / any first-person-OS-knows phrasing. The body teaches; the OS
 *    listens and reflects (Constitution principle 13).
 *  - No risk/injury/diagnosis/prevent framing — reuses the Section 59 guard, so
 *    Legacy summaries can never use prevention or causal-medical language.
 *
 * Pure + RN-free so it runs under the vitest pure runner and can gate copy in
 * tests. Reads no score and mutates nothing.
 */
import {
  findForbiddenResponseTerms,
} from './responseLanguage';

/**
 * First-person-OS-knows / "learned about [name]" framing the rule forbids.
 * Matches the disallowed shapes ("I learned", "what did I learn", "we learned
 * about you", "learned about <name>") while leaving the required "your body
 * taught us" phrasing untouched.
 */
const FORBIDDEN_LESSON_FRAMING =
  /\b(i learned|what (did|do|have) i learn|what i learned|we learned about|learned about (you|your|him|her|them|[a-z]+))\b/i;

/** Framing violations in `text` (lowercased). Empty when the framing is clean. */
export function findLessonFramingViolations(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const m = text.match(FORBIDDEN_LESSON_FRAMING);
  return m ? [m[0].toLowerCase()] : [];
}

/**
 * Every Section-61 language violation in `text`: forbidden words (risk / injury
 * / diagnosis / prevent, via the Section 59 guard) plus forbidden framing.
 */
export function findLessonLanguageViolations(text: string): string[] {
  return [...findForbiddenResponseTerms(text), ...findLessonFramingViolations(text)];
}

/** True when `text` satisfies the Section-61 language rule. */
export function isCompliantLessonCopy(text: string): boolean {
  return findLessonLanguageViolations(text).length === 0;
}

/**
 * Throw if `text` violates the rule — for dev/test-time enforcement of every
 * Section-61 copy string before it can ship.
 */
export function assertCompliantLessonCopy(text: string, label = 'living-performance copy'): void {
  const v = findLessonLanguageViolations(text);
  if (v.length > 0) {
    throw new Error(
      `${label} violates the Section 61 language rule (always "your body taught us"; ` +
        `never risk/diagnosis/prevent or first-person-knows framing): ` +
        `${JSON.stringify(v)} in ${JSON.stringify(text)}`,
    );
  }
}

/** The canonical Silent Intelligence line — plain, and passes the guard. */
export const ON_TRACK_MESSAGE = "You're exactly where you should be.";
