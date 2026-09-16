/**
 * Trainer surface — programs, staff membership, athlete consent, audit.
 *
 * Phase 1 of `docs/TRAINER-DASHBOARD-BRIEF.md`. Everything here is NEW: before
 * this file the database had no team, roster, membership or coach concept at
 * all, and no code path where one member reads another member's data.
 *
 * Three invariants shape the layout:
 *
 *   1. CONSENT IS OPERATIVE, EVIDENCE IS SEPARATE. Same split as the analytics
 *      consent pair (`aforce_analytics_consent_state` / `_events`): if the gate
 *      could be answered from the evidence table, erasing the record would
 *      silently change what staff are permitted to see. `decision_seq` is
 *      server-issued and monotonic per (program, athlete) so a stale device
 *      cannot reorder a revocation.
 *
 *   2. HISTORY IS APPEND-ONLY. Availability and notes are new rows, never
 *      updates. The current value is the newest row. This is the property that
 *      makes the record defensible later, and it costs nothing to adopt now.
 *
 *   3. EVERY COLUMN IS ADDITIVE AND NULLABLE-SAFE. This repo has no migration
 *      files (`drizzle-kit push` only), so a `NOT NULL DEFAULT now()` column on
 *      an existing table would stamp the push date across every historical row.
 *      These are all new tables, so `NOT NULL` is honest here — but nothing in
 *      this file alters an existing table.
 *
 * NOT in this file, deliberately: readiness, hydration and biometrics. Those
 * already live on `aforce_user_state` and `aforce_score_snapshots`, keyed by
 * the athlete's own user id. The trainer surface reads them through the
 * redaction layer; it does not copy them.
 */

import { pgTable, text, integer, boolean, timestamp, jsonb, bigserial, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

/** A team / program. The tenancy root for every table below. */
export const aforcePrograms = pgTable("aforce_programs", {
  /** App-generated (crypto.randomUUID). Text, not serial: ids appear in URLs. */
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Free text ('football', 'basketball'). Not an enum — programs vary. */
  sport: text("sport"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AforceProgramRow = typeof aforcePrograms.$inferSelect;
export type InsertAforceProgram = typeof aforcePrograms.$inferInsert;

/**
 * Who is in a program, and in what capacity.
 *
 * `role` is the SUBJECT-RELATION axis, orthogonal to the existing
 * `Role = user | admin | super_admin` rank in `requireRole.ts`. That rank is
 * linear — more rank means strictly more access. This is not: a coach sees a
 * DIFFERENT projection than a program admin, not a smaller one. Rank semantics
 * cannot express the §2.3 matrix, so this axis exists beside it, never inside.
 *
 * Deliberately not a Postgres enum: adding a role to a pg enum requires a
 * migration this repo has no mechanism for. The closed list is enforced in
 * TypeScript at `artifacts/api-server/src/lib/trainer/roles.ts` and by the
 * fail-closed resolver, which refuses any value it does not recognise.
 */
export const aforceProgramMembers = pgTable(
  "aforce_program_members",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    programId: text("program_id").notNull(),
    userId: text("user_id").notNull(),
    /** 'athletic_trainer' | 'team_physician' | 'strength' | 'coach' | 'program_admin' | 'athlete' */
    role: text("role").notNull(),
    /** 'active' | 'removed'. Removal is a status change, never a delete. */
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One membership per person per program. A person cannot be both the
    // coach and an athlete of the same program by accident.
    uniqueIndex("aforce_program_members_program_user_uq").on(t.programId, t.userId),
    // Roster read: every athlete in a program, and every staff member.
    index("aforce_program_members_program_role_idx").on(t.programId, t.role, t.status),
    // Reverse lookup: which programs is this actor staff for?
    index("aforce_program_members_user_idx").on(t.userId, t.status),
  ],
);

export type AforceProgramMemberRow = typeof aforceProgramMembers.$inferSelect;
export type InsertAforceProgramMember = typeof aforceProgramMembers.$inferInsert;

/**
 * OPERATIVE CONSENT — the gate. One row per (program, athlete).
 *
 * Absent row means NOT granted. The resolver never treats a missing row as
 * permission, which is why there is no default and no nullable `granted`.
 *
 * This is NOT `aforce_privacy.scope = 'team_coach'`. That column is a
 * per-viewer display preference, nothing reads it as a gate, and its default is
 * inverted (scope 'circle', every field true). Consent for a staff surface is
 * an explicit grant, default deny, per program, revocable.
 */
export const aforceAthleteConsents = pgTable(
  "aforce_athlete_consents",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    programId: text("program_id").notNull(),
    athleteUserId: text("athlete_user_id").notNull(),
    granted: boolean("granted").notNull(),
    /** Monotonic per (program, athlete). First decision writes 1. */
    decisionSeq: integer("decision_seq").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("aforce_athlete_consents_program_athlete_uq").on(t.programId, t.athleteUserId),
  ],
);

export type AforceAthleteConsentRow = typeof aforceAthleteConsents.$inferSelect;
export type InsertAforceAthleteConsent = typeof aforceAthleteConsents.$inferInsert;

/**
 * CONSENT EVIDENCE — append-only. Never read by the gate.
 *
 * `action` is 'grant' | 'revoke'. Not CHECK-constrained, matching the analytics
 * events table: the vocabulary may grow and nothing branches on it as a
 * security decision. It is a record, not a gate.
 */
export const aforceAthleteConsentEvents = pgTable(
  "aforce_athlete_consent_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    programId: text("program_id").notNull(),
    athleteUserId: text("athlete_user_id").notNull(),
    action: text("action").notNull(),
    decisionSeq: integer("decision_seq").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Subject-access retrieval: one athlete's decisions in order.
    index("aforce_athlete_consent_events_athlete_idx").on(t.athleteUserId, t.recordedAt),
  ],
);

export type AforceAthleteConsentEventRow = typeof aforceAthleteConsentEvents.$inferSelect;
export type InsertAforceAthleteConsentEvent = typeof aforceAthleteConsentEvents.$inferInsert;

/**
 * MEDICAL ACCESS LOG — append-only. Who read what about whom, and when.
 *
 * Written on every read that actually returns a medical field, and on every
 * availability write. `fields` carries the key names returned, never the
 * values: the log must not become a second copy of the record it is auditing.
 *
 * `consent_decision_seq` pins the consent generation in force at the moment of
 * the read, so "this was read while consent was granted" is provable after a
 * later revocation bumps the sequence.
 */
export const aforceMedicalAccessLog = pgTable(
  "aforce_medical_access_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    subjectUserId: text("subject_user_id").notNull(),
    programId: text("program_id").notNull(),
    /** The actor's program role at the time of access, not their rank. */
    actorRole: text("actor_role").notNull(),
    /** 'roster' | 'athlete_record' | 'availability' | 'medical_note' */
    resource: text("resource").notNull(),
    /** 'read' | 'write' */
    action: text("action").notNull(),
    /** Key names only. Never values. */
    fields: jsonb("fields").notNull().$type<string[]>(),
    /** Which projection produced the payload — the §2.3 row that applied. */
    redactionLevel: text("redaction_level").notNull(),
    consentDecisionSeq: integer("consent_decision_seq"),
    requestId: text("request_id"),
    route: text("route"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // "Who looked at me?" — the athlete's subject-access query.
    index("aforce_medical_access_log_subject_idx").on(t.subjectUserId, t.occurredAt),
    // "What did this staff member look at?" — the compliance query.
    index("aforce_medical_access_log_actor_idx").on(t.actorUserId, t.occurredAt),
  ],
);

export type AforceMedicalAccessLogRow = typeof aforceMedicalAccessLog.$inferSelect;
export type InsertAforceMedicalAccessLog = typeof aforceMedicalAccessLog.$inferInsert;

/**
 * AVAILABILITY — append-only history. The current value is the newest row.
 *
 * `status` is coach-visible by design; `reason` is NOT. A reason is a medical
 * disclosure in everything but name ("hamstring", "concussion protocol"), so it
 * is classified with the notes and never reaches a coach or strength payload.
 * Keeping them in one row with different visibility is the whole point of a
 * field-level projection rather than a table-level permission.
 */
export const aforceAthleteAvailability = pgTable(
  "aforce_athlete_availability",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    programId: text("program_id").notNull(),
    athleteUserId: text("athlete_user_id").notNull(),
    /** 'available' | 'limited' | 'out' */
    status: text("status").notNull(),
    /** Medical-adjacent. Trainer and physician only. */
    reason: text("reason"),
    /** Credentialed human who entered it. The system never writes this itself. */
    setByUserId: text("set_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aforce_athlete_availability_current_idx").on(t.programId, t.athleteUserId, t.createdAt),
  ],
);

export type AforceAthleteAvailabilityRow = typeof aforceAthleteAvailability.$inferSelect;
export type InsertAforceAthleteAvailability = typeof aforceAthleteAvailability.$inferInsert;

/**
 * MEDICAL NOTES — minimal Phase 1 shape, append-only.
 *
 * Phase 4 replaces `body` with the SOAP structure, templates and PDF export.
 * It exists now because the Phase 1 acceptance criterion is "a coach token
 * cannot retrieve a medical note field by any route" — which needs a medical
 * note field to exist in order to be provable.
 *
 * An edit is a NEW row pointing at the one it supersedes. Nothing is updated
 * in place and nothing is deleted.
 */
export const aforceAthleteMedicalNotes = pgTable(
  "aforce_athlete_medical_notes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    programId: text("program_id").notNull(),
    subjectUserId: text("subject_user_id").notNull(),
    authorUserId: text("author_user_id").notNull(),
    body: text("body").notNull(),
    /** Set on the newer row when this note revises an earlier one. */
    supersedesId: bigint("supersedes_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aforce_athlete_medical_notes_subject_idx").on(t.programId, t.subjectUserId, t.createdAt),
  ],
);

export type AforceAthleteMedicalNoteRow = typeof aforceAthleteMedicalNotes.$inferSelect;
export type InsertAforceAthleteMedicalNote = typeof aforceAthleteMedicalNotes.$inferInsert;
