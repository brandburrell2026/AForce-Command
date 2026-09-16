/**
 * Trainer surface — server-side field redaction.
 *
 * The rule from `docs/TRAINER-DASHBOARD-BRIEF.md` §2.3, verbatim: "A coach's
 * API response must never contain a medical note field, not even nulled out or
 * empty-stringed."
 *
 * That is why every projection here BUILDS A NEW OBJECT with only the keys the
 * level is entitled to, rather than taking the full row and deleting from it.
 * A delete-based approach leaves the shape one forgotten branch away from
 * leaking, and `JSON.stringify` will happily emit `"reason": null`. Constructing
 * upward means a field that is not written cannot appear, and the tests assert
 * exact key sets rather than absence of specific values.
 *
 * Two gates run before any projection, in this order:
 *
 *   1. CONSENT. No consent, no health content — for every staff level,
 *      including clinical. An unconsented athlete projects to identity and
 *      consent state only, so staff can see the roster is incomplete without
 *      learning anything about the person. (Phase 0 ruling, `docs/trainer-dashboard-plan.md` §0b.)
 *   2. LEVEL. The §2.3 row for the actor's program role.
 *
 * Nothing here reads the request. It is a pure function of (source, level,
 * consent) so it can be exhaustively tested without a server.
 */

import type { RedactionLevel } from "./roles";

/**
 * The full internal shape. Assembled server-side from `aforce_user_state`,
 * `aforce_score_snapshots`, availability and notes. NEVER returned directly —
 * it is the input to a projection, not a response type.
 */
export interface AthleteSource {
  athleteUserId: string;
  displayName: string;
  position: string | null;
  consentGranted: boolean;
  consentDecisionSeq: number | null;

  /** Readiness / hydration. Raw biometrics are the numbers themselves. */
  readinessScore: number | null;
  tier: string | null;
  hydrationScore: number | null;
  minutesSinceLastIntake: number | null;

  /** Training load. */
  loadSummary: string | null;
  loadDetail: Record<string, number> | null;

  /** Availability. `status` is broadly visible; `reason` is medical. */
  availabilityStatus: string | null;
  availabilityReason: string | null;
  availabilitySetByUserId: string | null;
  availabilitySetAt: string | null;

  /** Medical content. Clinical and self only, ever. */
  medicalNotes: { id: number; body: string; authorUserId: string; createdAt: string }[];
}

/**
 * Every key in `AthleteSource` that carries medical content.
 *
 * Exported because the audit layer and the tests must agree with the
 * projections about what "medical" means. One list, three consumers.
 */
export const MEDICAL_FIELDS = ["availabilityReason", "medicalNotes"] as const;

/** Raw physiological numbers. Withheld from the coaching level by §2.3. */
export const BIOMETRIC_FIELDS = [
  "readinessScore",
  "hydrationScore",
  "minutesSinceLastIntake",
] as const;

export type ProjectedAthlete = Record<string, unknown>;

/** Identity + consent state. The floor: what every permitted reader sees. */
function identityOnly(src: AthleteSource): ProjectedAthlete {
  return {
    athleteUserId: src.athleteUserId,
    displayName: src.displayName,
    position: src.position,
    consentGranted: src.consentGranted,
  };
}

/**
 * Project one athlete for one reader.
 *
 * @returns the payload plus the key names it contains, so the caller can audit
 *          what was actually disclosed without re-deriving it.
 */
export function projectAthlete(
  src: AthleteSource,
  level: RedactionLevel,
): { payload: ProjectedAthlete; fields: string[] } {
  // GATE 1 — consent. Applies to every level including clinical. The athlete,
  // reading their own record, is not gated by their own grant.
  if (!src.consentGranted && level !== "self") {
    const payload = identityOnly(src);
    return { payload, fields: Object.keys(payload) };
  }

  let payload: ProjectedAthlete;

  switch (level) {
    // Full clinical picture. The only level that sees medical content about
    // someone else, and every read of it is audited.
    case "clinical":
    case "self":
      payload = {
        ...identityOnly(src),
        readinessScore: src.readinessScore,
        tier: src.tier,
        hydrationScore: src.hydrationScore,
        minutesSinceLastIntake: src.minutesSinceLastIntake,
        loadSummary: src.loadSummary,
        loadDetail: src.loadDetail,
        availabilityStatus: src.availabilityStatus,
        availabilityReason: src.availabilityReason,
        availabilitySetByUserId: src.availabilitySetByUserId,
        availabilitySetAt: src.availabilitySetAt,
        medicalNotes: src.medicalNotes,
      };
      break;

    // Strength & performance: full signals and load, availability status,
    // never a reason and never a note.
    case "performance":
      payload = {
        ...identityOnly(src),
        readinessScore: src.readinessScore,
        tier: src.tier,
        hydrationScore: src.hydrationScore,
        minutesSinceLastIntake: src.minutesSinceLastIntake,
        loadSummary: src.loadSummary,
        loadDetail: src.loadDetail,
        availabilityStatus: src.availabilityStatus,
      };
      break;

    // Coach: tier, no raw biometrics, load as a summary string only,
    // availability status with no reason.
    case "coaching":
      payload = {
        ...identityOnly(src),
        tier: src.tier,
        loadSummary: src.loadSummary,
        availabilityStatus: src.availabilityStatus,
      };
      break;

    // Admin / compliance: availability only. No readiness, no load, no
    // medical. Audit metadata is served by its own endpoint, not this one.
    case "compliance":
      payload = {
        ...identityOnly(src),
        availabilityStatus: src.availabilityStatus,
      };
      break;

    // Unreachable while `RedactionLevel` is exhaustive. If a level is ever
    // added and this switch is not updated, TypeScript fails the build at the
    // `never` assignment — and at runtime the caller gets identity only rather
    // than an accidental full payload.
    default: {
      const _exhaustive: never = level;
      void _exhaustive;
      payload = identityOnly(src);
      break;
    }
  }

  return { payload, fields: Object.keys(payload) };
}

/** Did this projection actually disclose medical content? Drives the audit. */
export function disclosedMedical(fields: readonly string[]): boolean {
  return (MEDICAL_FIELDS as readonly string[]).some((f) => fields.includes(f));
}
