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

import {
  aforceAthleteQuestionnaires,
  aforceAthleteScreenings,
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
    subjective: row.subjective,
    objective: row.objective,
    assessment: row.assessment,
    plan: row.plan,
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
  createdAt: aforceAthleteSoapNotes.createdAt,
};

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
    }): Promise<SoapNoteEntry> {
      return db.transaction(async (tx) => {
        const inserted = await tx
          .insert(aforceAthleteSoapNotes)
          .values({
            programId: args.programId,
            subjectUserId: args.subjectUserId,
            authorUserId: args.authorUserId,
            version: 1,
            subjective: args.fields.subjective,
            objective: args.fields.objective,
            assessment: args.fields.assessment,
            plan: args.fields.plan,
            templateId: args.templateId ?? null,
          })
          .returning(NOTE_COLUMNS);

        const row = inserted[0]!;
        await tx
          .update(aforceAthleteSoapNotes)
          .set({ rootId: row.id })
          .where(eq(aforceAthleteSoapNotes.id, row.id));

        return toEntry({ ...row, rootId: row.id });
      });
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
    }): Promise<{ ok: true; entry: SoapNoteEntry } | { ok: false; reason: "not_found" }> {
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
            subjective: args.fields.subjective,
            objective: args.fields.objective,
            assessment: args.fields.assessment,
            plan: args.fields.plan,
          })
          .returning(NOTE_COLUMNS);

        return { ok: true as const, entry: toEntry(inserted[0]!) };
      });
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
        .orderBy(desc(aforceAthleteSoapNotes.createdAt));

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
        .orderBy(asc(aforceAthleteSoapNotes.rootId), asc(aforceAthleteSoapNotes.version));
      return rows.map(toEntry);
    },
  };
}

export type TrainerDocsRepo = ReturnType<typeof createTrainerDocsRepo>;

/**
 * Is note encryption configured?
 *
 * Phase 0 ruling Q9 builds to the strictest plausible regime. The route
 * refuses to write note text in production without a key rather than writing
 * plaintext and calling it a follow-up.
 */
export function noteEncryptionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const key = env["MEDICAL_NOTE_ENCRYPTION_KEY"];
  return typeof key === "string" && key.length >= 32;
}
