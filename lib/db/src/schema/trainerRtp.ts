/**
 * Trainer surface — return-to-play (Phase 6).
 *
 * Three tables. The shape encodes the rule the brief puts first:
 *
 *   "The system tracks the protocol; a human advances it."
 *
 * So there is no `current_stage` column anywhere. Current stage is DERIVED
 * from the sign-off rows: the stage after the highest one a credentialed
 * person has signed. A column would be a thing a scheduler, a migration or a
 * stray update could move; a derivation from append-only evidence cannot be
 * advanced without someone's name and timestamp being written down.
 *
 * The protocol itself is program-defined (`stages` jsonb), because the brief
 * requires a configurable progression and §5 forbids building a configuration
 * engine. A list of stages in a row is the smallest thing that satisfies both.
 */

import { pgTable, text, integer, timestamp, jsonb, bigserial, index, uniqueIndex } from "drizzle-orm/pg-core";

/** One stage of a progression, as defined by the program. */
export interface RtpStageDefinition {
  /** Stable key, e.g. `light_aerobic`. Referenced by sign-off rows. */
  key: string;
  label: string;
  /** What the stage involves. Shown to staff, never to a coach. */
  description?: string;
}

/**
 * A program's protocol. Versioned by row: changing a protocol means inserting
 * a new version, so a progression already under way keeps the stage list it
 * started with and nobody's history is rewritten by an edit.
 */
export const aforceRtpProtocols = pgTable(
  "aforce_rtp_protocols",
  {
    id: text("id").primaryKey(),
    programId: text("program_id").notNull(),
    name: text("name").notNull(),
    version: integer("version").notNull().default(1),
    stages: jsonb("stages").notNull().$type<RtpStageDefinition[]>(),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("aforce_rtp_protocols_program_idx").on(t.programId, t.createdAt)],
);

export type AforceRtpProtocolRow = typeof aforceRtpProtocols.$inferSelect;
export type InsertAforceRtpProtocol = typeof aforceRtpProtocols.$inferInsert;

/**
 * One athlete's journey through one protocol.
 *
 * `stagesSnapshot` freezes the stage list as it stood when the progression
 * started. A protocol edited mid-progression must not silently change what an
 * athlete is being asked to complete.
 */
export const aforceRtpProgressions = pgTable(
  "aforce_rtp_progressions",
  {
    id: text("id").primaryKey(),
    programId: text("program_id").notNull(),
    athleteUserId: text("athlete_user_id").notNull(),
    protocolId: text("protocol_id").notNull(),
    stagesSnapshot: jsonb("stages_snapshot").notNull().$type<RtpStageDefinition[]>(),
    /** 'active' | 'completed' | 'stopped'. Set by a human, never derived. */
    status: text("status").notNull().default("active"),
    startedByUserId: text("started_by_user_id").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    /** Why a progression was stopped. Staff-only, never in a coach payload. */
    stoppedReason: text("stopped_reason"),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
  },
  (t) => [
    index("aforce_rtp_progressions_athlete_idx").on(t.programId, t.athleteUserId, t.startedAt),
  ],
);

export type AforceRtpProgressionRow = typeof aforceRtpProgressions.$inferSelect;
export type InsertAforceRtpProgression = typeof aforceRtpProgressions.$inferInsert;

/**
 * SIGN-OFFS — append-only, and the only thing that moves a progression.
 *
 * A row is a credentialed human saying "this stage is complete", with their
 * id and the time. The unique index on (progression, stageIndex) means a
 * stage cannot be signed twice, so a retry or a double-tap cannot skip
 * anything, and a race resolves to one winner at the database rather than in
 * application logic.
 */
export const aforceRtpSignoffs = pgTable(
  "aforce_rtp_signoffs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    progressionId: text("progression_id").notNull(),
    programId: text("program_id").notNull(),
    /** Index into the progression's frozen stage list. */
    stageIndex: integer("stage_index").notNull(),
    /** Denormalised for audit readability; the index is authoritative. */
    stageKey: text("stage_key").notNull(),
    signedByUserId: text("signed_by_user_id").notNull(),
    /** Staff-only. Never reaches a coach payload. */
    note: text("note"),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("aforce_rtp_signoffs_stage_uq").on(t.progressionId, t.stageIndex),
    index("aforce_rtp_signoffs_progression_idx").on(t.progressionId, t.signedAt),
  ],
);

export type AforceRtpSignoffRow = typeof aforceRtpSignoffs.$inferSelect;
export type InsertAforceRtpSignoff = typeof aforceRtpSignoffs.$inferInsert;
