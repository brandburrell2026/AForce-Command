/**
 * Trainer surface — the subject-relation role axis.
 *
 * This is NOT the existing `Role = "user" | "admin" | "super_admin"` from
 * `middlewares/requireRole.ts`. That one is a linear rank: higher rank means
 * strictly more access, and `requireRole("admin","super_admin")` admits admins
 * because of minimum-rank semantics.
 *
 * The §2.3 matrix in `docs/TRAINER-DASHBOARD-BRIEF.md` is not a rank. A coach
 * sees a DIFFERENT projection than a program admin: the coach gets a readiness
 * tier and no medical content, the admin gets no readiness at all and only
 * audit metadata. Neither is a subset of the other. Expressing that inside
 * `RANK` would be wrong in a way that silently over-grants, so it lives here
 * as its own axis and the two are combined, never conflated.
 *
 * Every function in this file fails closed. An unrecognised role string
 * resolves to `null`, and a `null` role is denied by the caller — it never
 * falls through to a default projection.
 */

/** Program roles, as stored in `aforce_program_members.role`. */
export const PROGRAM_ROLES = [
  "athletic_trainer",
  "team_physician",
  "strength",
  "coach",
  "program_admin",
  "athlete",
] as const;

export type ProgramRole = (typeof PROGRAM_ROLES)[number];

/**
 * The projection applied to a payload. Named per §2.3 row rather than per
 * role, because trainer and physician share one projection and the audit log
 * records which projection ran, not which title the actor holds.
 */
export type RedactionLevel =
  | "clinical" // athletic trainer, team physician — full
  | "performance" // strength & performance — full signals, no medical
  | "coaching" // coach / staff — tier only, availability only
  | "compliance" // admin / compliance — audit metadata only
  | "self"; // the athlete, reading their own record

const ROLE_TO_LEVEL: Record<ProgramRole, RedactionLevel> = {
  athletic_trainer: "clinical",
  team_physician: "clinical",
  strength: "performance",
  coach: "coaching",
  program_admin: "compliance",
  athlete: "self",
};

/** Fail-closed parse of a role string read from the database or a payload. */
export function parseProgramRole(value: unknown): ProgramRole | null {
  if (typeof value !== "string") return null;
  return (PROGRAM_ROLES as readonly string[]).includes(value)
    ? (value as ProgramRole)
    : null;
}

export function redactionLevelFor(role: ProgramRole): RedactionLevel {
  return ROLE_TO_LEVEL[role];
}

/**
 * May this level ever see medical content (notes, availability reason,
 * injury nature)? Used by the audit layer to decide whether a read needs a
 * log row, and by tests as the single statement of the rule.
 *
 * `self` is true: an athlete reading their own record sees their own notes.
 */
export function levelSeesMedical(level: RedactionLevel): boolean {
  return level === "clinical" || level === "self";
}

/** May this level write availability status? Only the clinical roles. */
export function levelWritesAvailability(level: RedactionLevel): boolean {
  return level === "clinical";
}

/**
 * Is this level allowed to read another member's record at all?
 *
 * `compliance` is true but sees no health content — it exists to answer
 * "who is available" and to read audit metadata, which is what the §2.3 row
 * grants it.
 */
export function levelReadsRoster(level: RedactionLevel): boolean {
  return level !== "self";
}
