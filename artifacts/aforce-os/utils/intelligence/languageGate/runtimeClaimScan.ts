/**
 * runtimeClaimScan — the §42 language gate's BLOCK-severity concept set,
 * packaged for the runtime copy seams (Wave-2 PR5).
 *
 * The full gate (`evaluateClaim`) needs a 28-field ClaimCandidate with
 * graph provenance that the live copy paths cannot produce yet — called
 * as-is it would suppress everything as INVALID_PROVENANCE. What CAN be
 * wired today, faithfully, is the policy's hard-block vocabulary:
 * concepts from rules with `severity: 'block'` (medical, injury,
 * causality, product-coercion, score-mechanics, DNA). Transform-severity
 * concepts (certainty words like "always"/"exactly") are deliberately
 * EXCLUDED — the policy's own remedy for those is a governed transform,
 * not a ban, and approved copy legitimately contains them (e.g. the
 * canonical ON_TRACK_MESSAGE).
 *
 * Fail-closed contract for seams: on a hit, SUPPRESS or fall back to
 * approved neutral copy. Never strip words (deleting "not" or "may"
 * can invert meaning into a STRONGER claim, which §42 forbids).
 */

import { POLICY_RULES, conceptPresent } from './policyRegistry';

/** Every prohibited concept across block-severity rules. */
export const BLOCKING_PROHIBITED_CONCEPTS: readonly string[] = Array.from(
  new Set(
    POLICY_RULES.filter((r) => r.severity === 'block').flatMap(
      (r) => r.prohibitedConcepts,
    ),
  ),
).sort();

/**
 * First blocking concept present in `text`, or null when clean.
 * Whole-word/phrase, case-insensitive (the gate's own matcher).
 */
export function findBlockedConcept(text: string): string | null {
  if (!text) return null;
  for (const concept of BLOCKING_PROHIBITED_CONCEPTS) {
    if (conceptPresent(text, concept)) return concept;
  }
  return null;
}

/** True when `text` must not reach a consumer surface. */
export function consumerCopyBlocked(text: string): boolean {
  return findBlockedConcept(text) !== null;
}
