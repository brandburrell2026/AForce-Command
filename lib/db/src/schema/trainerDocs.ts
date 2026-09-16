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

import { sql } from "drizzle-orm";
import { pgTable, text, integer, boolean, timestamp, jsonb, bigserial, bigint, check, index, uniqueIndex, customType } from "drizzle-orm/pg-core";

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

    /**
     * CLIENT-GENERATED KEY THAT MAKES A RETRY SAFE.
     *
     * The offline outbox retries forever by design, and the write path
     * commits the note before it writes its audit row. An audit failure
     * therefore returned 500 on an ALREADY DURABLE note — and the retry
     * filed a second one. A duplicate clinical note is not a cosmetic
     * problem: it is two records of one assessment, with two versions
     * chains, in a document a clinician relies on.
     *
     * The key is the outbox item id, which is stable across every retry of
     * one entry and different for every distinct entry. Nullable, because
     * notes written by anything other than the queue (a direct API call, a
     * future import) legitimately have none — and a NULL never collides
     * under the partial unique index below.
     */
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aforce_athlete_soap_notes_subject_idx").on(t.programId, t.subjectUserId, t.createdAt),
    // Version-chain retrieval: every version of one note, in order.
    //
    // UNIQUE, and that is the point of it. `amendNote` picks the next version
    // by reading the chain's current maximum, so two amendments that read
    // before either wrote both chose N+1. Both inserted; `currentNotes` keeps
    // whichever it saw as newest; the other clinician's amendment vanished
    // from the current view while surviving in the chart export, so the two
    // artefacts disagreed about the record. The repository takes a row lock
    // to serialize them, and this index is the backstop that makes the
    // failure impossible rather than unlikely.
    uniqueIndex("aforce_athlete_soap_notes_chain_idx").on(t.rootId, t.version),
    // "An amendment must say why" is the rule the whole append-only design
    // rests on, and it lived in one `if` at one route. Version 1 is the
    // original and has no reason; every later version must carry one.
    check(
      "aforce_athlete_soap_notes_amendment_has_reason",
      sql`${t.version} = 1 or (${t.amendmentReason} is not null and length(btrim(${t.amendmentReason})) > 0)`,
    ),
    check("aforce_athlete_soap_notes_version_positive", sql`${t.version} >= 1`),
    /**
     * PARTIAL unique index: the uniqueness is what enforces idempotency, and
     * it must be the DATABASE that enforces it. Two concurrent retries of one
     * entry can both find no existing row and both try to insert; only a
     * unique index decides that race correctly, and the loser is then read
     * back rather than failing.
     *
     * Scoped to the program, so two programs cannot collide on a key.
     * Predicated on NOT NULL, so the many rows with no key do not all
     * collide with each other.
     */
    uniqueIndex("aforce_athlete_soap_notes_idempotency_uq")
      .on(t.programId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
  ],
);

export type AforceAthleteSoapNoteRow = typeof aforceAthleteSoapNotes.$inferSelect;
export type InsertAforceAthleteSoapNote = typeof aforceAthleteSoapNotes.$inferInsert;

/**
 * TRAINING SESSIONS — append-only. The input the load model has never had.
 *
 * Phase 0 question Q13 asked who enters session RPE, because no table in this
 * repo holds it and no surface collects it. Phase 5 answers it the way the
 * §2.3 matrix already implies: staff with load access enter it — the athletic
 * trainer or the strength and performance role — and the athlete's own RPE is
 * what they report to that person.
 *
 * `rpe` is the session rating of perceived exertion, 1-10, and `durationMin`
 * is what it is multiplied by. Session load is NOT stored: it is rpe ×
 * duration, derived at read time so a stored figure can never drift from the
 * two numbers a human actually entered.
 *
 * A correction is a new row, like every other record on this surface.
 */
export const aforceAthleteSessions = pgTable(
  "aforce_athlete_sessions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    programId: text("program_id").notNull(),
    athleteUserId: text("athlete_user_id").notNull(),
    /** Local calendar day the session counts for, `YYYY-MM-DD`. */
    /**
     * A CALENDAR-DAY LABEL in the program's own locale — `YYYY-MM-DD`, text,
     * never a timestamp. A session at 11pm on a Tuesday in Honolulu is
     * Tuesday's session, whatever instant that was in UTC. Load windows do
     * arithmetic on these labels and never convert them; see
     * `utils/trainerLoad.ts`.
     */
    sessionDate: text("session_date").notNull(),
    /** Session RPE, 1-10, as reported by the athlete to staff. */
    rpe: integer("rpe").notNull(),
    durationMin: integer("duration_min").notNull(),
    /** Free text: 'practice', 'lift', 'conditioning'. Not an enum — programs vary. */
    sessionType: text("session_type"),
    enteredByUserId: text("entered_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("aforce_athlete_sessions_lookup_idx").on(t.programId, t.athleteUserId, t.sessionDate),
    // The same bounds the route already validates. Duplicated here on
    // purpose: the route protects a request, the constraint protects the
    // TABLE — from a backfill, an import, or a second writer that never
    // passes through the route at all. An RPE of 400 is not a number anyone
    // should have to reason about downstream.
    check("aforce_athlete_sessions_rpe_range", sql`${t.rpe} between 1 and 10`),
    check(
      "aforce_athlete_sessions_duration_range",
      sql`${t.durationMin} between 1 and 600`,
    ),
  ],
);

export type AforceAthleteSessionRow = typeof aforceAthleteSessions.$inferSelect;
export type InsertAforceAthleteSession = typeof aforceAthleteSessions.$inferInsert;
