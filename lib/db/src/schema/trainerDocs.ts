/**
 * Trainer surface — screening and documentation (Phase 4).
 *
 * Three new tables plus the version chain that makes the note record
 * defensible. Nothing here alters an existing table: this repo has no
 * migration files, so every column is additive and every table is new.
 *
 * THE DOCUMENTATION RULE, from the brief:
 *
 *   "notes are append-only. An edit creates a new version with the prior
 *    version retained and both timestamped. Nothing is ever silently
 *    overwritten — this is the property that makes the record defensible."
 *
 * So a note is never updated. An amendment inserts a NEW row carrying the
 * same `rootId`, an incremented `version`, and `supersedesId` pointing at the
 * row it revises. The chain is the history; the newest version is the current
 * text; every earlier version keeps its own timestamp and author.
 *
 * ENCRYPTION AT REST. Phase 0 ruling Q9: build to the strictest plausible
 * regime and claim none. Note text is classified S3 in
 * `governance/DATA-CLASSIFICATION-MATRIX.md`, so each text column has a
 * `bytea` sibling for pgcrypto ciphertext, following the provider-token
 * pattern (`aforceWhoopTokens.accessTokenEnc`). The route refuses to write in
 * production when no key is configured — fail closed, never silently
 * plaintext.
 */

import { pgTable, text, integer, boolean, timestamp, jsonb, bigserial, bigint, index, customType } from "drizzle-orm/pg-core";

/** Postgres `bytea`, declared the same way `schema/aforce.ts` declares it. */
const customBytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * MORNING WELLNESS QUESTIONNAIRE — submitted by the athlete, append-only.
 *
 * One row per submission, never an update: a member who re-submits has
 * changed their mind, and both answers are part of the record.
 *
 * The item set is configurable per program, so answers live in `answers`
 * rather than as columns. The brief's §5 anti-goal warns against building a
 * configuration engine; this is the minimum that avoids a schema change per
 * program, not a form builder.
 */
export const aforceAthleteQuestionnaires = pgTable(
  "aforce_athlete_questionnaires",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    programId: text("program_id").notNull(),
    athleteUserId: text("athlete_user_id").notNull(),
    /** Which item set the athlete answered. */
    formVersion: integer("form_version").notNull().default(1),
    /** `{ soreness: 3, sleep: 2, stress: 1, energy: 4, hydration: 3 }` — 1..5. */
    answers: jsonb("answers").notNull().$type<Record<string, number>>(),
    /** Local calendar day the submission counts for, `YYYY-MM-DD`. */
    forDate: text("for_date").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aforce_athlete_questionnaires_lookup_idx").on(t.programId, t.athleteUserId, t.forDate),
  ],
);

export type AforceAthleteQuestionnaireRow = typeof aforceAthleteQuestionnaires.$inferSelect;
export type InsertAforceAthleteQuestionnaire = typeof aforceAthleteQuestionnaires.$inferInsert;

/**
 * PRE-PRACTICE SCREENING — completed by staff, append-only.
 *
 * `items` is the checklist as answered. `cleared` is the staff member's own
 * conclusion, recorded as an attributed human decision — the system never
 * sets it and never derives it (brief §2.2).
 */
export const aforceAthleteScreenings = pgTable(
  "aforce_athlete_screenings",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    programId: text("program_id").notNull(),
    athleteUserId: text("athlete_user_id").notNull(),
    items: jsonb("items").notNull().$type<Record<string, boolean>>(),
    notes: text("notes"),
    /** The staff member's decision. Never computed. */
    cleared: boolean("cleared").notNull(),
    screenedByUserId: text("screened_by_user_id").notNull(),
    screenedAt: timestamp("screened_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aforce_athlete_screenings_lookup_idx").on(t.programId, t.athleteUserId, t.screenedAt),
  ],
);

export type AforceAthleteScreeningRow = typeof aforceAthleteScreenings.$inferSelect;
export type InsertAforceAthleteScreening = typeof aforceAthleteScreenings.$inferInsert;

/**
 * SOAP NOTES — append-only, versioned.
 *
 * Separate from the Phase 1 `aforce_athlete_medical_notes`, which stays as
 * the minimal shape that proved redaction. This is the documentation table:
 * structured fields, a version chain, and ciphertext columns.
 *
 * A row is NEVER updated. `rootId` groups a note with its amendments,
 * `version` orders them, `supersedesId` names the row this one revises.
 * `rootId` is null on the first version and set to that row's own id by the
 * repository immediately after insert, so a chain is one indexed lookup.
 */
export const aforceAthleteSoapNotes = pgTable(
  "aforce_athlete_soap_notes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    programId: text("program_id").notNull(),
    subjectUserId: text("subject_user_id").notNull(),
    authorUserId: text("author_user_id").notNull(),

    /** Null only between insert and the repo's immediate self-stamp. */
    rootId: bigint("root_id", { mode: "number" }),
    version: integer("version").notNull().default(1),
    supersedesId: bigint("supersedes_id", { mode: "number" }),
    /** Why this amendment exists. Required on version 2 and beyond. */
    amendmentReason: text("amendment_reason"),

    subjective: text("subjective"),
    objective: text("objective"),
    assessment: text("assessment"),
    plan: text("plan"),

    /** pgcrypto ciphertext siblings — written when a key is configured. */
    subjectiveEnc: customBytea("subjective_enc"),
    objectiveEnc: customBytea("objective_enc"),
    assessmentEnc: customBytea("assessment_enc"),
    planEnc: customBytea("plan_enc"),

    /** Which template seeded this note, for audit. Null for a blank note. */
    templateId: text("template_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aforce_athlete_soap_notes_subject_idx").on(t.programId, t.subjectUserId, t.createdAt),
    // Version-chain retrieval: every version of one note, in order.
    index("aforce_athlete_soap_notes_chain_idx").on(t.rootId, t.version),
  ],
);

export type AforceAthleteSoapNoteRow = typeof aforceAthleteSoapNotes.$inferSelect;
export type InsertAforceAthleteSoapNote = typeof aforceAthleteSoapNotes.$inferInsert;
