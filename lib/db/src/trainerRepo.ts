/**
 * Trainer surface repository — membership, consent, availability, audit.
 *
 * Pure persistence. No Express, no auth, no redaction: this module answers
 * "what is stored" and the API layer decides "what may be shown". Keeping the
 * projection out of here is deliberate — a repo that redacts is a repo whose
 * callers cannot audit what was withheld.
 *
 * Consent follows the analytics-consent design (`analyticsIdentityRepo.ts`):
 * operative state separate from append-only evidence, a server-issued
 * monotonic `decisionSeq`, and a compare-and-swap whose test IS the UPDATE's
 * WHERE clause so the check and the write cannot disagree.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  aforceAthleteAvailability,
  aforceAthleteConsentEvents,
  aforceAthleteConsents,
  aforceAthleteMedicalNotes,
  aforceMedicalAccessLog,
  aforceProgramMembers,
} from "./schema/roster";

type Db = NodePgDatabase<Record<string, unknown>>;

/** Membership as stored. `role` is an unvalidated string here by design — the
 *  API layer parses it through `parseProgramRole`, which fails closed. */
export interface ProgramMembership {
  programId: string;
  userId: string;
  role: string;
  status: string;
}

/** Named `Athlete…` to avoid colliding with the analytics `ConsentState`. */
export interface AthleteConsentState {
  granted: boolean;
  decisionSeq: number;
}

export interface AvailabilityEntry {
  status: string;
  reason: string | null;
  setByUserId: string;
  setAt: string;
}

export interface MedicalNote {
  id: number;
  body: string;
  authorUserId: string;
  createdAt: string;
}

export interface MedicalAccessEntry {
  actorUserId: string;
  subjectUserId: string;
  programId: string;
  actorRole: string;
  resource: string;
  action: string;
  fields: string[];
  redactionLevel: string;
  consentDecisionSeq: number | null;
  requestId: string | null;
  route: string | null;
}

export function createTrainerRepo(db: Db) {
  return {
    /**
     * The actor's membership in one program, or null.
     *
     * Null is the fail-closed answer for every "not a member", "removed", and
     * "no such program" case. Callers must not distinguish them: telling an
     * outsider that a program exists is itself a disclosure.
     */
    async membership(programId: string, userId: string): Promise<ProgramMembership | null> {
      const rows = await db
        .select({
          programId: aforceProgramMembers.programId,
          userId: aforceProgramMembers.userId,
          role: aforceProgramMembers.role,
          status: aforceProgramMembers.status,
        })
        .from(aforceProgramMembers)
        .where(
          and(
            eq(aforceProgramMembers.programId, programId),
            eq(aforceProgramMembers.userId, userId),
            eq(aforceProgramMembers.status, "active"),
          ),
        )
        .limit(1);
      return rows[0] ?? null;
    },

    /** Every active athlete in a program, roster order resolved by the caller. */
    async athletes(programId: string): Promise<ProgramMembership[]> {
      return db
        .select({
          programId: aforceProgramMembers.programId,
          userId: aforceProgramMembers.userId,
          role: aforceProgramMembers.role,
          status: aforceProgramMembers.status,
        })
        .from(aforceProgramMembers)
        .where(
          and(
            eq(aforceProgramMembers.programId, programId),
            eq(aforceProgramMembers.role, "athlete"),
            eq(aforceProgramMembers.status, "active"),
          ),
        );
    },

    /**
     * Operative consent. An absent row is NOT granted — never permission.
     */
    async consent(programId: string, athleteUserId: string): Promise<AthleteConsentState> {
      const rows = await db
        .select({
          granted: aforceAthleteConsents.granted,
          decisionSeq: aforceAthleteConsents.decisionSeq,
        })
        .from(aforceAthleteConsents)
        .where(
          and(
            eq(aforceAthleteConsents.programId, programId),
            eq(aforceAthleteConsents.athleteUserId, athleteUserId),
          ),
        )
        .limit(1);
      const row = rows[0];
      return row ? { granted: row.granted, decisionSeq: row.decisionSeq } : { granted: false, decisionSeq: 0 };
    },

    /**
     * Grant or revoke, by the athlete only (enforced at the route).
     *
     * The CAS lives in the UPDATE's WHERE clause. A caller passing a stale
     * `expectedSeq` writes nothing and gets the committed state back, so a
     * device that slept through a revocation cannot reorder it.
     */
    async setConsent(args: {
      programId: string;
      athleteUserId: string;
      granted: boolean;
      expectedSeq: number;
    }): Promise<{ ok: true; state: AthleteConsentState } | { ok: false; current: AthleteConsentState }> {
      return db.transaction(async (tx) => {
        const existing = await tx
          .select({
            granted: aforceAthleteConsents.granted,
            decisionSeq: aforceAthleteConsents.decisionSeq,
          })
          .from(aforceAthleteConsents)
          .where(
            and(
              eq(aforceAthleteConsents.programId, args.programId),
              eq(aforceAthleteConsents.athleteUserId, args.athleteUserId),
            ),
          )
          .for("update")
          .limit(1);

        const current = existing[0];

        if (!current) {
          // First decision. Only seq 0 may create the row; anything else is a
          // caller working from a state that never existed.
          if (args.expectedSeq !== 0) {
            return { ok: false as const, current: { granted: false, decisionSeq: 0 } };
          }
          await tx.insert(aforceAthleteConsents).values({
            programId: args.programId,
            athleteUserId: args.athleteUserId,
            granted: args.granted,
            decisionSeq: 1,
          });
          await tx.insert(aforceAthleteConsentEvents).values({
            programId: args.programId,
            athleteUserId: args.athleteUserId,
            action: args.granted ? "grant" : "revoke",
            decisionSeq: 1,
          });
          return { ok: true as const, state: { granted: args.granted, decisionSeq: 1 } };
        }

        const nextSeq = current.decisionSeq + 1;
        const applied = await tx
          .update(aforceAthleteConsents)
          .set({ granted: args.granted, decisionSeq: nextSeq, updatedAt: sql`now()` })
          .where(
            and(
              eq(aforceAthleteConsents.programId, args.programId),
              eq(aforceAthleteConsents.athleteUserId, args.athleteUserId),
              eq(aforceAthleteConsents.decisionSeq, args.expectedSeq),
            ),
          )
          .returning({ decisionSeq: aforceAthleteConsents.decisionSeq });

        if (applied.length !== 1) {
          // Nothing written, so nothing is claimed and no evidence is appended.
          return {
            ok: false as const,
            current: { granted: current.granted, decisionSeq: current.decisionSeq },
          };
        }

        await tx.insert(aforceAthleteConsentEvents).values({
          programId: args.programId,
          athleteUserId: args.athleteUserId,
          action: args.granted ? "grant" : "revoke",
          decisionSeq: nextSeq,
        });
        return { ok: true as const, state: { granted: args.granted, decisionSeq: nextSeq } };
      });
    },

    /** Newest availability row, or null if status was never set. */
    async currentAvailability(
      programId: string,
      athleteUserId: string,
    ): Promise<AvailabilityEntry | null> {
      const rows = await db
        .select({
          status: aforceAthleteAvailability.status,
          reason: aforceAthleteAvailability.reason,
          setByUserId: aforceAthleteAvailability.setByUserId,
          createdAt: aforceAthleteAvailability.createdAt,
        })
        .from(aforceAthleteAvailability)
        .where(
          and(
            eq(aforceAthleteAvailability.programId, programId),
            eq(aforceAthleteAvailability.athleteUserId, athleteUserId),
          ),
        )
        .orderBy(desc(aforceAthleteAvailability.createdAt))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        status: row.status,
        reason: row.reason,
        setByUserId: row.setByUserId,
        setAt: row.createdAt.toISOString(),
      };
    },

    /** Append a status change. Never an update — history is the record. */
    async appendAvailability(args: {
      programId: string;
      athleteUserId: string;
      status: string;
      reason: string | null;
      setByUserId: string;
    }): Promise<void> {
      await db.insert(aforceAthleteAvailability).values({
        programId: args.programId,
        athleteUserId: args.athleteUserId,
        status: args.status,
        reason: args.reason,
        setByUserId: args.setByUserId,
      });
    },

    /** Notes for one athlete, newest first. Clinical and self reads only. */
    async medicalNotes(programId: string, subjectUserId: string): Promise<MedicalNote[]> {
      const rows = await db
        .select({
          id: aforceAthleteMedicalNotes.id,
          body: aforceAthleteMedicalNotes.body,
          authorUserId: aforceAthleteMedicalNotes.authorUserId,
          createdAt: aforceAthleteMedicalNotes.createdAt,
        })
        .from(aforceAthleteMedicalNotes)
        .where(
          and(
            eq(aforceAthleteMedicalNotes.programId, programId),
            eq(aforceAthleteMedicalNotes.subjectUserId, subjectUserId),
          ),
        )
        .orderBy(desc(aforceAthleteMedicalNotes.createdAt));
      return rows.map((r) => ({
        id: r.id,
        body: r.body,
        authorUserId: r.authorUserId,
        createdAt: r.createdAt.toISOString(),
      }));
    },

    /**
     * The access trail for one subject, oldest first.
     *
     * Attached to the chart export: a chart that can be separated from its
     * access log is a chart whose history can be quietly lost.
     */
    async accessTrail(
      programId: string,
      subjectUserId: string,
      limit = 500,
    ): Promise<
      { actorUserId: string; actorRole: string; resource: string; action: string; occurredAt: string }[]
    > {
      const rows = await db
        .select({
          actorUserId: aforceMedicalAccessLog.actorUserId,
          actorRole: aforceMedicalAccessLog.actorRole,
          resource: aforceMedicalAccessLog.resource,
          action: aforceMedicalAccessLog.action,
          occurredAt: aforceMedicalAccessLog.occurredAt,
        })
        .from(aforceMedicalAccessLog)
        .where(
          and(
            eq(aforceMedicalAccessLog.programId, programId),
            eq(aforceMedicalAccessLog.subjectUserId, subjectUserId),
          ),
        )
        .orderBy(asc(aforceMedicalAccessLog.occurredAt))
        .limit(limit);
      return rows.map((r) => ({ ...r, occurredAt: r.occurredAt.toISOString() }));
    },

    /**
     * Append to the medical access log.
     *
     * Field NAMES only. If this ever carried values it would become a second,
     * unredacted copy of the record it exists to protect.
     */
    async logAccess(entry: MedicalAccessEntry): Promise<void> {
      await db.insert(aforceMedicalAccessLog).values({
        actorUserId: entry.actorUserId,
        subjectUserId: entry.subjectUserId,
        programId: entry.programId,
        actorRole: entry.actorRole,
        resource: entry.resource,
        action: entry.action,
        fields: entry.fields,
        redactionLevel: entry.redactionLevel,
        consentDecisionSeq: entry.consentDecisionSeq,
        requestId: entry.requestId,
        route: entry.route,
      });
    },
  };
}

export type TrainerRepo = ReturnType<typeof createTrainerRepo>;
