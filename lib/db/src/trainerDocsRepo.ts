/**
 * Trainer documentation repository — questionnaires, screenings, SOAP notes.
 *
 * Pure persistence. The one rule this module exists to enforce:
 *
 *   NOTHING IS EVER UPDATED.
 *
 * There is no update path on a note. `amendNote` INSERTS a new version and
 * leaves the prior row untouched, which is why the repo exposes no `update`
 * and why `noteVersions` returns the whole chain rather than the latest row.
 * A caller cannot silently overwrite a note because there is no method that
 * would let them.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { decryptNoteField, encryptNoteField, noteEncryptionConfigured } from "./noteCrypto";

import {
  aforceAthleteQuestionnaires,
  aforceAthleteScreenings,
  aforceAthleteSessions,
  aforceAthleteSoapNotes,
} from "./schema/trainerDocs";

type Db = NodePgDatabase<Record<string, unknown>>;

export interface QuestionnaireSubmission {
  programId: string;
  athleteUserId: string;
  answers: Record<string, number>;
  forDate: string;
  formVersion?: number;
}

export interface QuestionnaireEntry {
  id: number;
  answers: Record<string, number>;
  forDate: string;
  submittedAt: string;
}

export interface ScreeningSubmission {
  programId: string;
  athleteUserId: string;
  items: Record<string, boolean>;
  notes: string | null;
  cleared: boolean;
  screenedByUserId: string;
}

export interface ScreeningEntry {
  id: number;
  items: Record<string, boolean>;
  notes: string | null;
  cleared: boolean;
  screenedByUserId: string;
  screenedAt: string;
}

export interface SessionSubmission {
  programId: string;
  athleteUserId: string;
  sessionDate: string;
  rpe: number;
  durationMin: number;
  sessionType: string | null;
  enteredByUserId: string;
}

export interface SessionEntryRow {
  id: number;
  sessionDate: string;
  rpe: number;
  durationMin: number;
  sessionType: string | null;
  enteredByUserId: string;
  createdAt: string;
}

export interface SoapFields {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
}

export interface SoapNoteEntry extends SoapFields {
  id: number;
  rootId: number;
  version: number;
  supersedesId: number | null;
  amendmentReason: string | null;
  authorUserId: string;
  templateId: string | null;
  createdAt: string;
}

/**
 * Read one field back.
 *
 * Ciphertext wins when it is there. The plaintext fallback is what makes
 * turning encryption on a non-event for rows written before it: a reader
 * does not need to know which era a row came from. A row that carries
 * ciphertext it cannot decrypt throws rather than returning the null beside
 * it — a note that silently reads as empty is worse than one that errors.
 */
function readField(plain: string | null, enc: Uint8Array | null): string | null {
  return enc === null ? plain : decryptNoteField(enc);
}

function toEntry(row: {
  id: number;
  rootId: number | null;
  version: number;
  supersedesId: number | null;
  amendmentReason: string | null;
  authorUserId: string;
  templateId: string | null;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  subjectiveEnc?: Uint8Array | null;
  objectiveEnc?: Uint8Array | null;
  assessmentEnc?: Uint8Array | null;
  planEnc?: Uint8Array | null;
  createdAt: Date;
}): SoapNoteEntry {
  return {
    id: row.id,
    rootId: row.rootId ?? row.id,
    version: row.version,
    supersedesId: row.supersedesId,
    amendmentReason: row.amendmentReason,
    authorUserId: row.authorUserId,
    templateId: row.templateId,
    subjective: readField(row.subjective, row.subjectiveEnc ?? null),
    objective: readField(row.objective, row.objectiveEnc ?? null),
    assessment: readField(row.assessment, row.assessmentEnc ?? null),
    plan: readField(row.plan, row.planEnc ?? null),
    createdAt: row.createdAt.toISOString(),
  };
}

const NOTE_COLUMNS = {
  id: aforceAthleteSoapNotes.id,
  rootId: aforceAthleteSoapNotes.rootId,
  version: aforceAthleteSoapNotes.version,
  supersedesId: aforceAthleteSoapNotes.supersedesId,
  amendmentReason: aforceAthleteSoapNotes.amendmentReason,
  authorUserId: aforceAthleteSoapNotes.authorUserId,
  templateId: aforceAthleteSoapNotes.templateId,
  subjective: aforceAthleteSoapNotes.subjective,
  objective: aforceAthleteSoapNotes.objective,
  assessment: aforceAthleteSoapNotes.assessment,
  plan: aforceAthleteSoapNotes.plan,
  subjectiveEnc: aforceAthleteSoapNotes.subjectiveEnc,
  objectiveEnc: aforceAthleteSoapNotes.objectiveEnc,
  assessmentEnc: aforceAthleteSoapNotes.assessmentEnc,
  planEnc: aforceAthleteSoapNotes.planEnc,
  createdAt: aforceAthleteSoapNotes.createdAt,
};

/**
 * Turn note text into the columns it is stored in.
 *
 * WITH A KEY: ciphertext into the `*_enc` columns and NULL into the plaintext
 * ones. Writing both would make the encryption decorative — the whole point
 * is that a replica, a `pg_dump` or a read-only analytics grant yields
 * nothing readable.
 *
 * WITHOUT A KEY: plaintext, as before. That is the local and test path only;
 * `noteEncryptionConfigured` gates production at the route, which refuses the
 * write outright rather than quietly storing a note in the clear.
 */
function noteFieldColumns(fields: SoapFields): {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  subjectiveEnc: Uint8Array | null;
  objectiveEnc: Uint8Array | null;
  assessmentEnc: Uint8Array | null;
  planEnc: Uint8Array | null;
} {
  if (!noteEncryptionConfigured()) {
    return {
      subjective: fields.subjective,
      objective: fields.objective,
      assessment: fields.assessment,
      plan: fields.plan,
      subjectiveEnc: null,
      objectiveEnc: null,
      assessmentEnc: null,
      planEnc: null,
    };
  }
  return {
    subjective: null,
    objective: null,
    assessment: null,
    plan: null,
    subjectiveEnc: encryptNoteField(fields.subjective),
    objectiveEnc: encryptNoteField(fields.objective),
    assessmentEnc: encryptNoteField(fields.assessment),
    planEnc: encryptNoteField(fields.plan),
  };
}

/**
 * Ceiling on a single note read.
 *
 * `currentNotes` reads EVERY version ever filed and reduces in memory, and
 * `allNoteVersions` feeds the chart export, which holds three copies of the
 * document in heap while it renders. Neither had a limit, so the ceiling on a
 * long-running athlete's record was an out-of-memory — and that athlete could
 * reach it on their own record, which no authorization check would refuse.
 *
 * Far above any real chart: 2,000 note versions is decades of daily notes.
 */
export const NOTE_READ_LIMIT = 2000;

/**
 * Postgres unique_violation, found wherever the driver left it.
 *
 * Drizzle wraps a driver error in its own, so the pg error — and its `code`
 * — is on `cause`, sometimes more than one level down. Checking only the top
 * level silently never matched, which would turn every lost race into a 500
 * for a note that exists. Asserting the CODE, never a message.
 */
function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (typeof current === "object" && (current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function findByIdempotencyKey(
  db: Db,
  programId: string,
  key: string,
): Promise<SoapNoteEntry | null> {
  const rows = await db
    .select(NOTE_COLUMNS)
    .from(aforceAthleteSoapNotes)
    .where(
      and(
        eq(aforceAthleteSoapNotes.programId, programId),
        eq(aforceAthleteSoapNotes.idempotencyKey, key),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? toEntry(row) : null;
}

export function createTrainerDocsRepo(db: Db) {
  return {
    // ─── Questionnaire ──────────────────────────────────────────────────
    async submitQuestionnaire(sub: QuestionnaireSubmission): Promise<QuestionnaireEntry> {
      const rows = await db
        .insert(aforceAthleteQuestionnaires)
        .values({
          programId: sub.programId,
          athleteUserId: sub.athleteUserId,
          answers: sub.answers,
          forDate: sub.forDate,
          formVersion: sub.formVersion ?? 1,
        })
        .returning({
          id: aforceAthleteQuestionnaires.id,
          answers: aforceAthleteQuestionnaires.answers,
          forDate: aforceAthleteQuestionnaires.forDate,
          submittedAt: aforceAthleteQuestionnaires.submittedAt,
        });
      const row = rows[0]!;
      return {
        id: row.id,
        answers: row.answers,
        forDate: row.forDate,
        submittedAt: row.submittedAt.toISOString(),
      };
    },

    /** Newest first. A re-submission does not replace the earlier answer. */
    async questionnaires(
      programId: string,
      athleteUserId: string,
      limit = 30,
    ): Promise<QuestionnaireEntry[]> {
      const rows = await db
        .select({
          id: aforceAthleteQuestionnaires.id,
          answers: aforceAthleteQuestionnaires.answers,
          forDate: aforceAthleteQuestionnaires.forDate,
          submittedAt: aforceAthleteQuestionnaires.submittedAt,
        })
        .from(aforceAthleteQuestionnaires)
        .where(
          and(
            eq(aforceAthleteQuestionnaires.programId, programId),
            eq(aforceAthleteQuestionnaires.athleteUserId, athleteUserId),
          ),
        )
        .orderBy(desc(aforceAthleteQuestionnaires.submittedAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        answers: r.answers,
        forDate: r.forDate,
        submittedAt: r.submittedAt.toISOString(),
      }));
    },

    // ─── Screening ──────────────────────────────────────────────────────
    async submitScreening(sub: ScreeningSubmission): Promise<ScreeningEntry> {
      const rows = await db
        .insert(aforceAthleteScreenings)
        .values({
          programId: sub.programId,
          athleteUserId: sub.athleteUserId,
          items: sub.items,
          notes: sub.notes,
          cleared: sub.cleared,
          screenedByUserId: sub.screenedByUserId,
        })
        .returning({
          id: aforceAthleteScreenings.id,
          items: aforceAthleteScreenings.items,
          notes: aforceAthleteScreenings.notes,
          cleared: aforceAthleteScreenings.cleared,
          screenedByUserId: aforceAthleteScreenings.screenedByUserId,
          screenedAt: aforceAthleteScreenings.screenedAt,
        });
      const row = rows[0]!;
      return { ...row, screenedAt: row.screenedAt.toISOString() };
    },

    async screenings(programId: string, athleteUserId: string, limit = 30): Promise<ScreeningEntry[]> {
      const rows = await db
        .select({
          id: aforceAthleteScreenings.id,
          items: aforceAthleteScreenings.items,
          notes: aforceAthleteScreenings.notes,
          cleared: aforceAthleteScreenings.cleared,
          screenedByUserId: aforceAthleteScreenings.screenedByUserId,
          screenedAt: aforceAthleteScreenings.screenedAt,
        })
        .from(aforceAthleteScreenings)
        .where(
          and(
            eq(aforceAthleteScreenings.programId, programId),
            eq(aforceAthleteScreenings.athleteUserId, athleteUserId),
          ),
        )
        .orderBy(desc(aforceAthleteScreenings.screenedAt))
        .limit(limit);
      return rows.map((r) => ({ ...r, screenedAt: r.screenedAt.toISOString() }));
    },

    // ─── Training sessions ──────────────────────────────────────────────
    /** Append a session. A correction is a new row, never an update. */
    async recordSession(sub: SessionSubmission): Promise<SessionEntryRow> {
      const rows = await db
        .insert(aforceAthleteSessions)
        .values({
          programId: sub.programId,
          athleteUserId: sub.athleteUserId,
          sessionDate: sub.sessionDate,
          rpe: sub.rpe,
          durationMin: sub.durationMin,
          sessionType: sub.sessionType,
          enteredByUserId: sub.enteredByUserId,
        })
        .returning({
          id: aforceAthleteSessions.id,
          sessionDate: aforceAthleteSessions.sessionDate,
          rpe: aforceAthleteSessions.rpe,
          durationMin: aforceAthleteSessions.durationMin,
          sessionType: aforceAthleteSessions.sessionType,
          enteredByUserId: aforceAthleteSessions.enteredByUserId,
          createdAt: aforceAthleteSessions.createdAt,
        });
      const row = rows[0]!;
      return { ...row, createdAt: row.createdAt.toISOString() };
    },

    /** Sessions for one athlete, newest first. The load model's only input. */
    async sessions(programId: string, athleteUserId: string, limit = 200): Promise<SessionEntryRow[]> {
      const rows = await db
        .select({
          id: aforceAthleteSessions.id,
          sessionDate: aforceAthleteSessions.sessionDate,
          rpe: aforceAthleteSessions.rpe,
          durationMin: aforceAthleteSessions.durationMin,
          sessionType: aforceAthleteSessions.sessionType,
          enteredByUserId: aforceAthleteSessions.enteredByUserId,
          createdAt: aforceAthleteSessions.createdAt,
        })
        .from(aforceAthleteSessions)
        .where(
          and(
            eq(aforceAthleteSessions.programId, programId),
            eq(aforceAthleteSessions.athleteUserId, athleteUserId),
          ),
        )
        .orderBy(desc(aforceAthleteSessions.sessionDate))
        .limit(limit);
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    },

    // ─── SOAP notes ─────────────────────────────────────────────────────
    /**
     * File a new note — version 1 of its own chain.
     *
     * `rootId` is stamped to the row's own id immediately after insert, so
     * every row in the table has a chain identity and a reader never has to
     * treat null as "this one is its own root".
     */
    async fileNote(args: {
      programId: string;
      subjectUserId: string;
      authorUserId: string;
      fields: SoapFields;
      templateId?: string | null;
      /**
       * Stable across every retry of ONE client entry, different for every
       * distinct entry. Omit it and the write is not idempotent, which is
       * correct for a caller that is not a retrying queue.
       */
      idempotencyKey?: string | null;
    }): Promise<{ entry: SoapNoteEntry; replayed: boolean }> {
      const key = args.idempotencyKey ?? null;

      // A replay that arrives after the original committed. The common case,
      // and it costs one indexed lookup.
      if (key !== null) {
        const existing = await findByIdempotencyKey(db, args.programId, key);
        if (existing) return { entry: existing, replayed: true };
      }

      try {
        const entry = await db.transaction(async (tx) => {
          const inserted = await tx
            .insert(aforceAthleteSoapNotes)
            .values({
              programId: args.programId,
              subjectUserId: args.subjectUserId,
              authorUserId: args.authorUserId,
              version: 1,
              ...noteFieldColumns(args.fields),
              templateId: args.templateId ?? null,
              idempotencyKey: key,
            })
            .returning(NOTE_COLUMNS);

          const row = inserted[0]!;
          await tx
            .update(aforceAthleteSoapNotes)
            .set({ rootId: row.id })
            .where(eq(aforceAthleteSoapNotes.id, row.id));

          return toEntry({ ...row, rootId: row.id });
        });
        return { entry, replayed: false };
      } catch (err) {
        // TWO CONCURRENT RETRIES OF THE SAME ENTRY. Both found no existing
        // row above and both tried to insert; the unique index decided it.
        // The loser reads back the winner's note rather than failing —
        // which is the whole point: a retry must be indistinguishable from
        // the original, not merely harmless.
        if (key !== null && isUniqueViolation(err)) {
          const existing = await findByIdempotencyKey(db, args.programId, key);
          if (existing) return { entry: existing, replayed: true };
        }
        throw err;
      }
    },

    /**
     * Amend a note: a NEW version, with the prior row left exactly as it was.
     *
     * There is no update path to the text of an existing version, here or
     * anywhere else in this module. An amendment must say why.
     */
    async amendNote(args: {
      programId: string;
      noteId: number;
      authorUserId: string;
      fields: SoapFields;
      amendmentReason: string;
      idempotencyKey?: string | null;
    }): Promise<
      | { ok: true; entry: SoapNoteEntry; subjectUserId: string; replayed: boolean }
      | { ok: false; reason: "not_found" }
    > {
      const key = args.idempotencyKey ?? null;

      // An amendment is a write like any other and the queue retries it the
      // same way. Without this, a 500 after a durable amendment produced a
      // SECOND amendment — version N+1 and N+2 with identical text, and a
      // chain that reads as though a clinician revised twice.
      if (key !== null) {
        const existing = await findByIdempotencyKey(db, args.programId, key);
        if (existing) {
          const subjectRows = await db
            .select({ subjectUserId: aforceAthleteSoapNotes.subjectUserId })
            .from(aforceAthleteSoapNotes)
            .where(eq(aforceAthleteSoapNotes.id, existing.id))
            .limit(1);
          return {
            ok: true as const,
            entry: existing,
            subjectUserId: subjectRows[0]!.subjectUserId,
            replayed: true,
          };
        }
      }

      try {
        return await amendInTransaction();
      } catch (err) {
        // Same race as `fileNote`: two retries both got past the pre-check
        // and both inserted. The unique index decided it; the loser reads
        // back the winner's amendment rather than failing.
        if (key !== null && isUniqueViolation(err)) {
          const existing = await findByIdempotencyKey(db, args.programId, key);
          if (existing) {
            const subjectRows = await db
              .select({ subjectUserId: aforceAthleteSoapNotes.subjectUserId })
              .from(aforceAthleteSoapNotes)
              .where(eq(aforceAthleteSoapNotes.id, existing.id))
              .limit(1);
            return {
              ok: true as const,
              entry: existing,
              subjectUserId: subjectRows[0]!.subjectUserId,
              replayed: true,
            };
          }
        }
        throw err;
      }

      async function amendInTransaction() {
       return db.transaction(async (tx) => {
        const found = await tx
          .select(NOTE_COLUMNS)
          .from(aforceAthleteSoapNotes)
          .where(
            and(
              eq(aforceAthleteSoapNotes.id, args.noteId),
              eq(aforceAthleteSoapNotes.programId, args.programId),
            ),
          )
          .limit(1);

        const prior = found[0];
        if (!prior) return { ok: false as const, reason: "not_found" as const };

        const rootId = prior.rootId ?? prior.id;

        // SERIALIZE AMENDMENTS ON THIS CHAIN. Taking the lock on the ROOT row
        // rather than on the max-version read is deliberate: the root always
        // exists, so there is always a row to lock, whereas `FOR UPDATE` on a
        // query that returns nothing locks nothing.
        //
        // Without this, two clinicians amending at once both read the same
        // maximum and both chose N+1. Both inserted, `currentNotes` kept
        // whichever it saw as newest, and the other amendment disappeared
        // from the current view while surviving in the chart export — so the
        // UI and the export disagreed about the record. The unique index on
        // (root_id, version) is the backstop; this is what stops the two
        // writers racing in the first place, so the loser gets a correct
        // version number rather than an error.
        await tx
          .select({ id: aforceAthleteSoapNotes.id })
          .from(aforceAthleteSoapNotes)
          .where(eq(aforceAthleteSoapNotes.id, rootId))
          .for("update");

        // The next version number comes from the chain, not from the row we
        // were handed: amending an older version must not reuse a number.
        const latest = await tx
          .select({ version: aforceAthleteSoapNotes.version })
          .from(aforceAthleteSoapNotes)
          .where(eq(aforceAthleteSoapNotes.rootId, rootId))
          .orderBy(desc(aforceAthleteSoapNotes.version))
          .limit(1);

        const nextVersion = (latest[0]?.version ?? prior.version) + 1;

        const subjectRows = await tx
          .select({ subjectUserId: aforceAthleteSoapNotes.subjectUserId })
          .from(aforceAthleteSoapNotes)
          .where(eq(aforceAthleteSoapNotes.id, args.noteId))
          .limit(1);

        const inserted = await tx
          .insert(aforceAthleteSoapNotes)
          .values({
            programId: args.programId,
            subjectUserId: subjectRows[0]!.subjectUserId,
            authorUserId: args.authorUserId,
            rootId,
            version: nextVersion,
            supersedesId: args.noteId,
            amendmentReason: args.amendmentReason,
            idempotencyKey: key,
            ...noteFieldColumns(args.fields),
          })
          .returning(NOTE_COLUMNS);

        // The subject is returned alongside the entry rather than added to
        // it: the route needs it to file an audit row, and the response shape
        // this repo already produces is not the place to put it.
        return {
          ok: true as const,
          entry: toEntry(inserted[0]!),
          subjectUserId: subjectRows[0]!.subjectUserId,
          replayed: false,
        };
       });
      }
    },

    /** Every version of one note, oldest first. The chain IS the history. */
    async noteVersions(programId: string, rootId: number): Promise<SoapNoteEntry[]> {
      const rows = await db
        .select(NOTE_COLUMNS)
        .from(aforceAthleteSoapNotes)
        .where(
          and(
            eq(aforceAthleteSoapNotes.programId, programId),
            eq(aforceAthleteSoapNotes.rootId, rootId),
          ),
        )
        .orderBy(asc(aforceAthleteSoapNotes.version));
      return rows.map(toEntry);
    },

    /** Current text of every note for one athlete: the newest of each chain. */
    async currentNotes(programId: string, subjectUserId: string): Promise<SoapNoteEntry[]> {
      const rows = await db
        .select(NOTE_COLUMNS)
        .from(aforceAthleteSoapNotes)
        .where(
          and(
            eq(aforceAthleteSoapNotes.programId, programId),
            eq(aforceAthleteSoapNotes.subjectUserId, subjectUserId),
          ),
        )
        .orderBy(desc(aforceAthleteSoapNotes.createdAt))
        .limit(NOTE_READ_LIMIT);

      const newestByRoot = new Map<number, SoapNoteEntry>();
      for (const row of rows.map(toEntry)) {
        const seen = newestByRoot.get(row.rootId);
        if (!seen || row.version > seen.version) newestByRoot.set(row.rootId, row);
      }
      return [...newestByRoot.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    /** Every version of every note, for the chart export. */
    async allNoteVersions(programId: string, subjectUserId: string): Promise<SoapNoteEntry[]> {
      const rows = await db
        .select(NOTE_COLUMNS)
        .from(aforceAthleteSoapNotes)
        .where(
          and(
            eq(aforceAthleteSoapNotes.programId, programId),
            eq(aforceAthleteSoapNotes.subjectUserId, subjectUserId),
          ),
        )
        .orderBy(asc(aforceAthleteSoapNotes.rootId), asc(aforceAthleteSoapNotes.version))
        .limit(NOTE_READ_LIMIT);
      return rows.map(toEntry);
    },
  };
}

export type TrainerDocsRepo = ReturnType<typeof createTrainerDocsRepo>;

/**
 * Re-exported so the route keeps importing the gate from where it always did.
 *
 * The implementation moved to `noteCrypto.ts` and now answers a different
 * question. It used to check that some string was at least 32 characters
 * long — which a caller could satisfy with a sentence — and nothing then used
 * it as a key. It now checks that the value decodes to a usable 32-byte key,
 * which is what the route is actually asking before it refuses a write.
 */
export { noteEncryptionConfigured, noteEncryptionProblem, NoteEncryptionError } from "./noteCrypto";
