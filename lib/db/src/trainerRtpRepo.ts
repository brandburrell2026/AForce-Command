/**
 * Return-to-play repository.
 *
 * Pure persistence. Two properties are enforced here rather than left to
 * callers:
 *
 *   1. THERE IS NO STAGE COLUMN TO MOVE. Current stage is derived from
 *      sign-off rows by the API layer. This module exposes no method that
 *      sets a stage, because no such column exists.
 *
 *   2. A SIGN-OFF IS INSERT-ONLY, AND THE DATABASE BREAKS TIES. The unique
 *      index on (progression, stageIndex) means a duplicate loses at the
 *      database rather than in application logic, so two staff tapping at
 *      once produce one sign-off and one honest error.
 */

import { and, asc, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import {
  aforceRtpProgressions,
  aforceRtpProtocols,
  aforceRtpSignoffs,
  type RtpStageDefinition,
} from "./schema/trainerRtp";

type Db = NodePgDatabase<Record<string, unknown>>;

export interface RtpProtocolRecord {
  id: string;
  name: string;
  version: number;
  stages: RtpStageDefinition[];
  createdAt: string;
}

export interface RtpProgressionRecord {
  id: string;
  athleteUserId: string;
  protocolId: string;
  stages: RtpStageDefinition[];
  status: string;
  stoppedReason: string | null;
  startedAt: string;
}

export interface RtpSignoffRecord {
  stageIndex: number;
  stageKey: string;
  signedByUserId: string;
  note: string | null;
  signedAt: string;
}

export function createTrainerRtpRepo(db: Db) {
  return {
    /** Define a protocol. Editing one means inserting a new version. */
    async createProtocol(args: {
      id: string;
      programId: string;
      name: string;
      version: number;
      stages: RtpStageDefinition[];
      createdByUserId: string;
    }): Promise<RtpProtocolRecord> {
      const rows = await db
        .insert(aforceRtpProtocols)
        .values(args)
        .returning({
          id: aforceRtpProtocols.id,
          name: aforceRtpProtocols.name,
          version: aforceRtpProtocols.version,
          stages: aforceRtpProtocols.stages,
          createdAt: aforceRtpProtocols.createdAt,
        });
      const row = rows[0]!;
      return { ...row, createdAt: row.createdAt.toISOString() };
    },

    async protocols(programId: string): Promise<RtpProtocolRecord[]> {
      const rows = await db
        .select({
          id: aforceRtpProtocols.id,
          name: aforceRtpProtocols.name,
          version: aforceRtpProtocols.version,
          stages: aforceRtpProtocols.stages,
          createdAt: aforceRtpProtocols.createdAt,
        })
        .from(aforceRtpProtocols)
        .where(eq(aforceRtpProtocols.programId, programId))
        .orderBy(desc(aforceRtpProtocols.createdAt));
      return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
    },

    /**
     * Start a progression, freezing the protocol's stages into it.
     *
     * The snapshot is the point: a protocol edited next week must not change
     * what this athlete is part-way through completing.
     */
    async startProgression(args: {
      id: string;
      programId: string;
      athleteUserId: string;
      protocolId: string;
      stages: RtpStageDefinition[];
      startedByUserId: string;
    }): Promise<RtpProgressionRecord> {
      const rows = await db
        .insert(aforceRtpProgressions)
        .values({
          id: args.id,
          programId: args.programId,
          athleteUserId: args.athleteUserId,
          protocolId: args.protocolId,
          stagesSnapshot: args.stages,
          startedByUserId: args.startedByUserId,
        })
        .returning({
          id: aforceRtpProgressions.id,
          athleteUserId: aforceRtpProgressions.athleteUserId,
          protocolId: aforceRtpProgressions.protocolId,
          stagesSnapshot: aforceRtpProgressions.stagesSnapshot,
          status: aforceRtpProgressions.status,
          stoppedReason: aforceRtpProgressions.stoppedReason,
          startedAt: aforceRtpProgressions.startedAt,
        });
      const row = rows[0]!;
      return {
        id: row.id,
        athleteUserId: row.athleteUserId,
        protocolId: row.protocolId,
        stages: row.stagesSnapshot,
        status: row.status,
        stoppedReason: row.stoppedReason,
        startedAt: row.startedAt.toISOString(),
      };
    },

    /** The newest progression for one athlete, or null. */
    async progression(programId: string, athleteUserId: string): Promise<RtpProgressionRecord | null> {
      const rows = await db
        .select({
          id: aforceRtpProgressions.id,
          athleteUserId: aforceRtpProgressions.athleteUserId,
          protocolId: aforceRtpProgressions.protocolId,
          stagesSnapshot: aforceRtpProgressions.stagesSnapshot,
          status: aforceRtpProgressions.status,
          stoppedReason: aforceRtpProgressions.stoppedReason,
          startedAt: aforceRtpProgressions.startedAt,
        })
        .from(aforceRtpProgressions)
        .where(
          and(
            eq(aforceRtpProgressions.programId, programId),
            eq(aforceRtpProgressions.athleteUserId, athleteUserId),
          ),
        )
        .orderBy(desc(aforceRtpProgressions.startedAt))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        id: row.id,
        athleteUserId: row.athleteUserId,
        protocolId: row.protocolId,
        stages: row.stagesSnapshot,
        status: row.status,
        stoppedReason: row.stoppedReason,
        startedAt: row.startedAt.toISOString(),
      };
    },

    async signoffs(progressionId: string): Promise<RtpSignoffRecord[]> {
      const rows = await db
        .select({
          stageIndex: aforceRtpSignoffs.stageIndex,
          stageKey: aforceRtpSignoffs.stageKey,
          signedByUserId: aforceRtpSignoffs.signedByUserId,
          note: aforceRtpSignoffs.note,
          signedAt: aforceRtpSignoffs.signedAt,
        })
        .from(aforceRtpSignoffs)
        .where(eq(aforceRtpSignoffs.progressionId, progressionId))
        .orderBy(asc(aforceRtpSignoffs.signedAt));
      return rows.map((r) => ({ ...r, signedAt: r.signedAt.toISOString() }));
    },

    /**
     * Record a sign-off. Insert-only; a duplicate stage loses at the unique
     * index and is reported rather than swallowed.
     */
    async signOff(args: {
      progressionId: string;
      programId: string;
      stageIndex: number;
      stageKey: string;
      signedByUserId: string;
      note: string | null;
    }): Promise<{ ok: true; entry: RtpSignoffRecord } | { ok: false; reason: "already_signed" }> {
      const inserted = await db
        .insert(aforceRtpSignoffs)
        .values(args)
        .onConflictDoNothing({
          target: [aforceRtpSignoffs.progressionId, aforceRtpSignoffs.stageIndex],
        })
        .returning({
          stageIndex: aforceRtpSignoffs.stageIndex,
          stageKey: aforceRtpSignoffs.stageKey,
          signedByUserId: aforceRtpSignoffs.signedByUserId,
          note: aforceRtpSignoffs.note,
          signedAt: aforceRtpSignoffs.signedAt,
        });
      const row = inserted[0];
      if (!row) return { ok: false as const, reason: "already_signed" as const };
      return { ok: true as const, entry: { ...row, signedAt: row.signedAt.toISOString() } };
    },

    /**
     * Stop or complete a progression. A human decision, with a reason when
     * stopping. This is the ONLY status write, and it never touches stages.
     */
    async setStatus(args: {
      programId: string;
      progressionId: string;
      status: "completed" | "stopped";
      stoppedReason: string | null;
    }): Promise<void> {
      await db
        .update(aforceRtpProgressions)
        .set({
          status: args.status,
          stoppedReason: args.stoppedReason,
          stoppedAt: new Date(),
        })
        .where(
          and(
            eq(aforceRtpProgressions.id, args.progressionId),
            eq(aforceRtpProgressions.programId, args.programId),
          ),
        );
    },
  };
}

export type TrainerRtpRepo = ReturnType<typeof createTrainerRtpRepo>;
