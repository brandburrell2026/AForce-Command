/**
 * Urgent boundary: fixed governed copy, never model output, clean under every gate.
 */
import { describe, it, expect } from "vitest";
import { detectUrgent, URGENT_ANSWER, URGENT_NEXT_STEP } from "../urgent";
import { findBlockedConcept } from "../../claimsGate";
import { findLanguageViolations, findUngroundedQuantities } from "../gates";

describe("detectUrgent", () => {
  it.each([
    "I have chest pain and feel dizzy",
    "my friend passed out after the run",
    "I can't breathe properly",
    "I think I'm having a heat stroke",
    "haven't peed in 12 hours and feel confused",
    "should I call 911?",
    "I want to end my life",
  ])("flags: %s", (msg) => {
    expect(detectUrgent(msg)).toBe(true);
  });

  it.each([
    "What should I focus on today?",
    "Help me build my daily ritual.",
    "I slept poorly. Help me adjust today.",
    "Explain my hydration target.",
    "I have a mild headache after the gym, what's the next move?",
  ])("does not flag ordinary coaching: %s", (msg) => {
    expect(detectUrgent(msg)).toBe(false);
  });
});

describe("governed urgent copy", () => {
  it("passes the §42 gate, the §59/§64 language rule and carries no quantity", () => {
    for (const text of [URGENT_ANSWER, URGENT_NEXT_STEP]) {
      expect(findBlockedConcept(text)).toBeNull();
      expect(findLanguageViolations(text)).toEqual([]);
      expect(findUngroundedQuantities(text, { numbers: new Set() })).toEqual([]);
    }
  });
  it("says the app does not detect emergencies and points to real help", () => {
    expect(URGENT_ANSWER).toMatch(/does not monitor for or detect emergencies/);
    expect(URGENT_ANSWER).toMatch(/emergency services or a clinician/);
  });
});
