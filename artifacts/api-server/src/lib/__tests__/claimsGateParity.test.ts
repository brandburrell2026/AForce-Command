/**
 * Wave-2 PR5 parity lock: the server's claims-gate literals must exactly
 * match the app's §42 policy registry (block-severity concepts + the
 * whole-word matcher semantics). Cross-boundary CI import, same pattern
 * as entitlementFeatureParity.
 */
import { describe, it, expect } from "vitest";

import {
  POLICY_RULES,
  conceptPresent as appConceptPresent,
} from "../../../../aforce-os/utils/intelligence/languageGate/policyRegistry";
import {
  BLOCKING_PROHIBITED_CONCEPTS,
  conceptPresent,
  findBlockedConcept,
} from "../claimsGate";

describe("server↔app §42 claims-gate parity", () => {
  it("block-severity concept set matches the app policy exactly", () => {
    const appBlocking = Array.from(
      new Set(
        POLICY_RULES.filter((r) => r.severity === "block").flatMap(
          (r) => r.prohibitedConcepts,
        ),
      ),
    ).sort();
    expect([...BLOCKING_PROHIBITED_CONCEPTS]).toEqual(appBlocking);
  });

  it("matcher semantics agree with the app matcher on every concept", () => {
    for (const c of BLOCKING_PROHIBITED_CONCEPTS) {
      const embedded = `Take one now — ${c}, then recheck.`;
      expect(conceptPresent(embedded, c)).toBe(appConceptPresent(embedded, c));
      expect(conceptPresent(embedded, c)).toBe(true);
      // substring inside a longer word must NOT match (whole-word anchor)
      const glued = `xx${c.replace(/ /g, "")}yy`;
      expect(conceptPresent(glued, c)).toBe(appConceptPresent(glued, c));
    }
  });

  it("findBlockedConcept: clean copy passes, representative claims fail", () => {
    expect(findBlockedConcept("Drink 12 ounces now and recheck in 20 minutes.")).toBeNull();
    expect(findBlockedConcept("This drink cures dehydration.")).toBe("cures");
    expect(findBlockedConcept("Reduces your injury risk before tonight.")).toBe("injury");
    expect(findBlockedConcept("")).toBeNull();
  });
});
