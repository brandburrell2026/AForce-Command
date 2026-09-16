/**
 * Redaction matrix — the §2.3 table, asserted as exact key sets.
 *
 * These tests assert on `Object.keys` and on the serialized JSON, never on
 * `value === undefined`. The brief's rule is that a forbidden field must not be
 * PRESENT — "not even nulled out or empty-stringed" — and a test that only
 * checks the value would pass against a payload carrying `reason: null`.
 */
import { describe, expect, it } from "vitest";

import {
  BIOMETRIC_FIELDS,
  MEDICAL_FIELDS,
  disclosedMedical,
  projectAthlete,
  type AthleteSource,
} from "../redaction";
import { PROGRAM_ROLES, levelSeesMedical, parseProgramRole, redactionLevelFor } from "../roles";

const NOTE_BODY = "hamstring strain, day 3, limited cutting";
const REASON = "left hamstring";

function source(overrides: Partial<AthleteSource> = {}): AthleteSource {
  return {
    athleteUserId: "user_athlete_1",
    displayName: "M. Reyes",
    position: "RB",
    consentGranted: true,
    consentDecisionSeq: 3,
    readinessScore: 41,
    tier: "RECOVERY",
    hydrationScore: 22,
    minutesSinceLastIntake: 110,
    loadSummary: "high, 3rd consecutive day",
    loadDetail: { acute: 812, chronic: 640 },
    availabilityStatus: "out",
    availabilityReason: REASON,
    availabilitySetByUserId: "user_trainer_1",
    availabilitySetAt: "2026-09-16T14:22:06.000Z",
    medicalNotes: [
      { id: 1, body: NOTE_BODY, authorUserId: "user_trainer_1", createdAt: "2026-09-16T14:20:00.000Z" },
    ],
    ...overrides,
  };
}

/** The strongest form of the assertion: the value cannot appear anywhere. */
function expectNoMedicalTrace(payload: unknown): void {
  const json = JSON.stringify(payload);
  expect(json).not.toContain(NOTE_BODY);
  expect(json).not.toContain(REASON);
  for (const field of MEDICAL_FIELDS) {
    expect(json).not.toContain(`"${field}"`);
  }
}

describe("projectAthlete — §2.3 matrix", () => {
  it("clinical sees everything, including notes and the availability reason", () => {
    const { payload, fields } = projectAthlete(source(), "clinical");
    expect(fields).toEqual(
      expect.arrayContaining(["medicalNotes", "availabilityReason", "readinessScore", "loadDetail"]),
    );
    expect(disclosedMedical(fields)).toBe(true);
  });

  it("performance sees full signals and load but no medical field at all", () => {
    const { payload, fields } = projectAthlete(source(), "performance");
    expect(fields).toEqual([
      "athleteUserId",
      "displayName",
      "position",
      "consentGranted",
      "readinessScore",
      "tier",
      "hydrationScore",
      "minutesSinceLastIntake",
      "loadSummary",
      "loadDetail",
      "availabilityStatus",
    ]);
    expectNoMedicalTrace(payload);
    expect(disclosedMedical(fields)).toBe(false);
  });

  it("coaching sees tier and availability status, no raw biometrics, no medical", () => {
    const { payload, fields } = projectAthlete(source(), "coaching");
    expect(fields).toEqual([
      "athleteUserId",
      "displayName",
      "position",
      "consentGranted",
      "tier",
      "loadSummary",
      "availabilityStatus",
    ]);
    for (const biometric of BIOMETRIC_FIELDS) {
      expect(fields).not.toContain(biometric);
    }
    expectNoMedicalTrace(payload);
  });

  it("compliance sees availability only — no readiness, no load, no medical", () => {
    const { payload, fields } = projectAthlete(source(), "compliance");
    expect(fields).toEqual([
      "athleteUserId",
      "displayName",
      "position",
      "consentGranted",
      "availabilityStatus",
    ]);
    expect(fields).not.toContain("tier");
    expect(fields).not.toContain("loadSummary");
    expectNoMedicalTrace(payload);
  });

  it("self sees their own full record", () => {
    const { fields } = projectAthlete(source(), "self");
    expect(fields).toContain("medicalNotes");
    expect(fields).toContain("availabilityReason");
  });
});

describe("projectAthlete — consent gate", () => {
  const unconsented = source({ consentGranted: false, consentDecisionSeq: 2 });

  it.each(["clinical", "performance", "coaching", "compliance"] as const)(
    "withholds every health field from %s when consent is not granted",
    (level) => {
      const { payload, fields } = projectAthlete(unconsented, level);
      expect(fields).toEqual(["athleteUserId", "displayName", "position", "consentGranted"]);
      expectNoMedicalTrace(payload);
      // Not even a tier or an availability status leaks before consent.
      expect(fields).not.toContain("tier");
      expect(fields).not.toContain("availabilityStatus");
      expect(fields).not.toContain("readinessScore");
    },
  );

  it("does not gate an athlete out of their own record", () => {
    const { fields } = projectAthlete(unconsented, "self");
    expect(fields).toContain("medicalNotes");
  });
});

describe("roles", () => {
  it("parses only the closed list and fails closed on anything else", () => {
    for (const role of PROGRAM_ROLES) {
      expect(parseProgramRole(role)).toBe(role);
    }
    for (const bad of ["", "admin", "super_admin", "ATHLETIC_TRAINER", null, 7, {}]) {
      expect(parseProgramRole(bad)).toBeNull();
    }
  });

  it("grants medical sight to clinical and self only", () => {
    expect(levelSeesMedical(redactionLevelFor("athletic_trainer"))).toBe(true);
    expect(levelSeesMedical(redactionLevelFor("team_physician"))).toBe(true);
    expect(levelSeesMedical(redactionLevelFor("athlete"))).toBe(true);
    expect(levelSeesMedical(redactionLevelFor("strength"))).toBe(false);
    expect(levelSeesMedical(redactionLevelFor("coach"))).toBe(false);
    expect(levelSeesMedical(redactionLevelFor("program_admin"))).toBe(false);
  });

  it("agrees with the projections about what medical means", () => {
    // If MEDICAL_FIELDS and the projections ever disagree, this fails: the
    // clinical projection must contain every medical field and the coaching
    // projection none of them.
    const clinical = projectAthlete(source(), "clinical").fields;
    const coaching = projectAthlete(source(), "coaching").fields;
    for (const field of MEDICAL_FIELDS) {
      expect(clinical).toContain(field);
      expect(coaching).not.toContain(field);
    }
  });
});
