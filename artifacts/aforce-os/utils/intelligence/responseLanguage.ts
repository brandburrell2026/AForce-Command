/**
 * Section 59 — Adaptive Response Engine™ language guard.
 *
 * Enforces the NON-NEGOTIABLE language rule for any copy derived from the
 * Personal Response Library: cause-and-effect only. It must NEVER use risk /
 * injury / diagnosis / prevent framing (or their stems), and recurring/severe
 * symptoms must always route to a physician-consultation nudge rather than any
 * claim of the OS's own.
 *
 * Pure + RN-free (type-only imports) so it runs under the vitest pure runner and
 * can gate copy in tests. It reads NO score and mutates nothing.
 */
import {
  RECURRING_SYMPTOM_MIN_OCCURRENCES,
  RECURRING_SYMPTOM_WINDOW_MS,
} from '../../config/hydroStateModel';

/**
 * The four forbidden stems (spec Section 59). Matched at a word boundary so the
 * whole family is caught — risk/risks/risky, injury/injuries/injure,
 * diagnosis/diagnose/diagnostic, prevent/prevents/prevention — while unrelated
 * words that merely CONTAIN the letters (brisk, asterisk) are not, because the
 * boundary must fall immediately before the stem.
 */
const FORBIDDEN_STEMS: readonly string[] = ['risk', 'injur', 'diagnos', 'prevent'];
const FORBIDDEN_PATTERN = new RegExp(`\\b(${FORBIDDEN_STEMS.join('|')})[a-z]*`, 'gi');

/** All forbidden terms found in `text` (lowercased, in order). Empty when clean. */
export function findForbiddenResponseTerms(text: string): string[] {
  if (typeof text !== 'string' || text.length === 0) return [];
  const found: string[] = [];
  for (const m of text.matchAll(FORBIDDEN_PATTERN)) found.push(m[0].toLowerCase());
  return found;
}

/** True when `text` uses any risk/injury/diagnosis/prevent framing. */
export function containsForbiddenResponseLanguage(text: string): boolean {
  return findForbiddenResponseTerms(text).length > 0;
}

/**
 * Throw if `text` violates the language rule — for dev/test-time enforcement of
 * every Section-59 copy string before it can ship. `label` names the source in
 * the error so a failing string is easy to trace.
 */
export function assertCauseAndEffectResponseCopy(text: string, label = 'response copy'): void {
  const terms = findForbiddenResponseTerms(text);
  if (terms.length > 0) {
    throw new Error(
      `${label} violates the Section 59 language rule (cause-and-effect only): ` +
        `forbidden term(s) ${JSON.stringify(terms)} in ${JSON.stringify(text)}`,
    );
  }
}

/**
 * The single canonical nudge for recurring/severe symptoms. Deliberately worded
 * to pass the guard above (no risk/diagnosis framing) and to defer to a
 * clinician rather than assert anything itself.
 */
export const PHYSICIAN_CONSULTATION_MESSAGE =
  'This has come up several times. Consider checking in with a physician about it.';

/**
 * Decide whether a symptom category's recurrence warrants the physician nudge:
 * at least `minOccurrences` occurrences within `windowMs` ending at `now`.
 * Pure; `now` and thresholds are injected (defaulting to config) for testability.
 * Non-finite / out-of-window timestamps are ignored — never counted.
 */
export function shouldPromptPhysicianConsultation(
  occurrenceTimestampsMs: readonly number[],
  now: number = Date.now(),
  minOccurrences: number = RECURRING_SYMPTOM_MIN_OCCURRENCES,
  windowMs: number = RECURRING_SYMPTOM_WINDOW_MS,
): boolean {
  if (!Number.isFinite(now)) return false;
  const span = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : RECURRING_SYMPTOM_WINDOW_MS;
  const floor = now - span;
  let count = 0;
  for (const t of occurrenceTimestampsMs) {
    if (typeof t === 'number' && Number.isFinite(t) && t >= floor && t <= now) count += 1;
  }
  return count >= minOccurrences;
}
