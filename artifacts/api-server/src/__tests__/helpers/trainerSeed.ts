/**
 * Seed a trainer program with a roster of a given size.
 *
 * Shared by the benchmark and the query-count regression guard so both
 * measure the same shape of data. Bulk-inserted in one statement per table:
 * a seeder that itself fans out would make the benchmark's own setup the
 * slowest part of the run, and would muddy a statement count taken around it.
 *
 * The distribution is deliberate rather than uniform, because the board's
 * cost depends on it. Roughly a fifth of athletes have consent withheld (so
 * they project to identity only and file no audit row), and a quarter have
 * notes (so the clinical read has something to redact). That approximates a
 * real squad more closely than "every athlete has everything", which would
 * overstate the payload, or "none do", which would understate the work.
 */
import { pool } from "@workspace/db";

export interface SeedOptions {
  programId: string;
  athletes: number;
  trainerUserId: string;
  /** Fraction of athletes who have NOT granted consent. Default 0.2. */
  withheldConsentRate?: number;
  /** Fraction who have at least one medical note. Default 0.25. */
  noteRate?: number;
}

const TABLES = [
  "aforce_medical_access_log",
  "aforce_athlete_availability",
  "aforce_athlete_consent_events",
  "aforce_athlete_consents",
  "aforce_athlete_medical_notes",
  "aforce_athlete_soap_notes",
  "aforce_athlete_sessions",
  "aforce_athlete_screenings",
  "aforce_athlete_questionnaires",
  "aforce_rtp_signoffs",
  "aforce_rtp_progressions",
  "aforce_rtp_protocols",
  "aforce_program_members",
] as const;

export async function wipeProgram(programId: string): Promise<void> {
  const client = await pool.connect();
  try {
    for (const table of TABLES) {
      await client.query(`DELETE FROM ${table} WHERE program_id = $1`, [programId]);
    }
  } finally {
    client.release();
  }
}

export async function seedRoster(opts: SeedOptions): Promise<string[]> {
  const { programId, athletes, trainerUserId } = opts;
  const withheld = opts.withheldConsentRate ?? 0.2;
  const noteRate = opts.noteRate ?? 0.25;

  const ids = Array.from({ length: athletes }, (_, i) => `${programId}_a${i}`);
  const client = await pool.connect();
  try {
    // Membership: the trainer, then every athlete.
    await client.query(
      `INSERT INTO aforce_program_members (program_id, user_id, role, status)
       SELECT $1, unnest($2::text[]), unnest($3::text[]), 'active'`,
      [
        programId,
        [trainerUserId, ...ids],
        ["athletic_trainer", ...ids.map(() => "athlete")],
      ],
    );

    // Consent, with a slice withheld.
    const granted = ids.map((_, i) => i % Math.max(1, Math.round(1 / withheld)) !== 0);
    await client.query(
      `INSERT INTO aforce_athlete_consents (program_id, athlete_user_id, granted, decision_seq)
       SELECT $1, unnest($2::text[]), unnest($3::boolean[]), 1`,
      [programId, ids, granted],
    );

    // Availability — one current row each, statuses spread across the bands.
    const statuses = ids.map((_, i) => ["available", "limited", "out"][i % 3]!);
    await client.query(
      `INSERT INTO aforce_athlete_availability (program_id, athlete_user_id, status, reason, set_by_user_id)
       SELECT $1, unnest($2::text[]), unnest($3::text[]), unnest($4::text[]), $5`,
      [
        programId,
        ids,
        statuses,
        statuses.map((s) => (s === "available" ? null : "held from contact")),
        trainerUserId,
      ],
    );

    // Notes for a quarter of the roster.
    const withNotes = ids.filter((_, i) => i % Math.max(1, Math.round(1 / noteRate)) === 0);
    if (withNotes.length > 0) {
      await client.query(
        `INSERT INTO aforce_athlete_medical_notes (program_id, subject_user_id, body, author_user_id)
         SELECT $1, unnest($2::text[]), $3, $4`,
        [programId, withNotes, "Progressing through loading. Reassess Thursday.", trainerUserId],
      );
    }
  } finally {
    client.release();
  }
  return ids;
}
