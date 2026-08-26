/**
 * claimsGate — the server's copy of the §42 language gate's
 * BLOCK-severity vocabulary (Wave-2 PR5).
 *
 * The gate itself lives in the app
 * (artifacts/aforce-os/utils/intelligence/languageGate/) and the
 * api-server build cannot import app modules at runtime, so the
 * blocking concepts + the gate's whole-word matcher are duplicated
 * here as literals — locked to the app policy by
 * lib/__tests__/claimsGateParity.test.ts (cross-boundary CI import,
 * same pattern as the entitlement + plan parity locks).
 *
 * Fail-closed contract: a hit means the text must NOT be relayed to a
 * consumer (reject / suppress). Never strip or rewrite — deleting
 * negations can strengthen a claim, which §42 forbids.
 */

/** Block-severity prohibited concepts (p42-v1.0), sorted. */
export const BLOCKING_PROHIBITED_CONCEPTS: readonly string[] = [
  "aforce is required",
  "at risk",
  "biologically determined",
  "boost your hydrostate",
  "buy to improve",
  "buying increases",
  "clinically proven",
  "confidence score of",
  "cure",
  "cured",
  "cures",
  "deficiency",
  "dehydration diagnosis",
  "diagnose",
  "diagnosed",
  "diagnoses",
  "diagnosis",
  "diagnostic",
  "disease",
  "disorder",
  "dna score",
  "dna test",
  "drinking this raises your score",
  "fixed trait",
  "genetic",
  "genetically",
  "genetics",
  "graph score",
  "hardwired",
  "in your dna",
  "increase your hydrostate",
  "injured",
  "injuries",
  "injury",
  "injury prevention",
  "injury risk protection",
  "injury-risk protection",
  "medical condition",
  "medical risk",
  "medical risk detection",
  "medical-risk detection",
  "medically necessary",
  "must drink aforce",
  "only aforce",
  "overall score is",
  "pattern score",
  "permanent",
  "permanently",
  "predicts injury",
  "purchase increases",
  "purchase to improve",
  "raises your hydrostate",
  "required to complete",
  "requires aforce",
  "risk of",
  "scan increases your score",
  "scan to raise",
  "scanning increases",
  "scanning raises",
  "second score",
  "symptom",
  "symptoms",
  "this recommendation raises",
  "treat",
  "treatment",
  "treats",
  "unchangeable",
  "unhealthy",
  "you are a",
  "you are healthy",
  "you are unhealthy",
  "you need aforce",
  "your intelligence score",
];

/** Whole-word / phrase match, case-insensitive (the gate's own matcher). */
export function conceptPresent(text: string, concept: string): boolean {
  const escaped = concept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

/** First blocking concept present in `text`, or null when clean. */
export function findBlockedConcept(text: string): string | null {
  if (!text) return null;
  for (const concept of BLOCKING_PROHIBITED_CONCEPTS) {
    if (conceptPresent(text, concept)) return concept;
  }
  return null;
}
