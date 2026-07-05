/**
 * Section 64 — Conversational Intelligence™ language guard.
 *
 * Any proactive coach line must be observation-only (Constitution + §59 rules):
 *  - No risk / injury / diagnosis / prevent framing — reuses the §59 guard.
 *  - Never a population comparison ("compared to other users", "most people",
 *    "the average") — the coach speaks from the user's OWN data, never against a
 *    population (§64 rule 6).
 *
 * Pure + RN-free so it runs under the vitest pure runner and can gate copy in
 * tests. Reads no score and mutates nothing.
 */
import { findForbiddenResponseTerms } from './responseLanguage';

/**
 * Population-comparison framing the coach must never use. Matches the disallowed
 * shapes ("compared to others / the average / most", "average user", "most
 * people/users", "than other/the average", "vs other/the average") while leaving
 * the user's own-data framing untouched.
 */
const POPULATION_COMPARISON =
  /\b(compared to (other|others|the average|most)|average user|most (people|users)|than (other|others|the average)|vs\.? (other|others|the average))\b/i;

/** Population-comparison violations in `text` (lowercased). Empty when clean. */
export function findPopulationComparison(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const m = text.match(POPULATION_COMPARISON);
  return m ? [m[0].toLowerCase()] : [];
}

/**
 * Every §64 language violation in `text`: forbidden words (risk / injury /
 * diagnosis / prevent, via the §59 guard) plus population-comparison framing.
 */
export function findCoachLineViolations(text: string): string[] {
  return [...findForbiddenResponseTerms(text), ...findPopulationComparison(text)];
}

/** True when `text` satisfies the §64 observation-only language rule. */
export function isCompliantCoachLine(text: string): boolean {
  return findCoachLineViolations(text).length === 0;
}

/**
 * Throw if `text` violates the rule — for dev/test-time enforcement of every
 * proactive coach string before it can ship.
 */
export function assertCompliantCoachLine(text: string, label = 'coach line'): void {
  const v = findCoachLineViolations(text);
  if (v.length > 0) {
    throw new Error(
      `${label} violates the Section 64 language rule (observation-only; no ` +
        `risk/diagnosis/prevent, no population comparison): ${JSON.stringify(v)} in ${JSON.stringify(text)}`,
    );
  }
}
