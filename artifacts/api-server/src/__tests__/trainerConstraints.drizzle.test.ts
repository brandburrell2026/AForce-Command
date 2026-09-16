/**
 * The invariants are in the DATABASE now, not only in TypeScript.
 *
 * Every rule on this surface — the availability vocabulary, the role
 * vocabulary, an RPE between 1 and 10, "an amendment must state a reason" —
 * lived in one `if` at one route. That protects a REQUEST. It does not
 * protect the table from a seed script, a data import, a backfill, or a
 * second writer that never passes through the route at all, and those are
 * exactly the paths that put a value nobody expected into a medical record.
 *
 * Each test writes the bad row directly with SQL, going around every
 * application check, and asserts Postgres refuses it. That is the only way to
 * test a constraint: through the code that validates, they all pass.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { pool } from "@workspace/db";

const DB = Boolean(process.env["DB_TESTS"]);
const PROGRAM = `prog_constraints_${process.pid}`;
const ATHLETE = `athlete_${process.pid}`;
const TRAINER = `trainer_${process.pid}`;

/** 23514 is check_violation. Asserting the CODE, not a message. */
const CHECK_VIOLATION = "23514";

async function run(sql: string, params: unknown[] = []): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(sql, params);
  } finally {
    client.release();
  }
}

async function wipe(): Promise<void> {
  for (const table of [
    "aforce_athlete_availability",
    "aforce_athlete_sessions",
    "aforce_athlete_soap_notes",
    "aforce_rtp_signoffs",
    "aforce_program_members",
  ]) {
    await run(`DELETE FROM ${table} WHERE program_id = $1`, [PROGRAM]);
  }
}

describe.runIf(DB)("the trainer tables refuse invalid rows", () => {
  beforeEach(wipe);
  afterAll(wipe);

  describe("availability status", () => {
    it.each(["available", "limited", "out"])("accepts %s", async (status) => {
      await expect(
        run(
          `INSERT INTO aforce_athlete_availability (program_id, athlete_user_id, status, set_by_user_id)
           VALUES ($1, $2, $3, $4)`,
          [PROGRAM, ATHLETE, status, TRAINER],
        ),
      ).resolves.toBeUndefined();
    });

    it.each(["questionable", "AVAILABLE", "", "probable"])("refuses %s", async (status) => {
      await expect(
        run(
          `INSERT INTO aforce_athlete_availability (program_id, athlete_user_id, status, set_by_user_id)
           VALUES ($1, $2, $3, $4)`,
          [PROGRAM, ATHLETE, status, TRAINER],
        ),
      ).rejects.toMatchObject({ code: CHECK_VIOLATION });
    });
  });

  describe("program membership", () => {
    it("accepts every role the API knows about", async () => {
      for (const role of [
        "athletic_trainer",
        "team_physician",
        "strength",
        "coach",
        "program_admin",
        "athlete",
      ]) {
        await expect(
          run(
            `INSERT INTO aforce_program_members (program_id, user_id, role, status)
             VALUES ($1, $2, $3, 'active')`,
            [PROGRAM, `${role}_user`, role],
          ),
        ).resolves.toBeUndefined();
      }
    });

    /**
     * `parseProgramRole` fails closed on an unknown role, so a row like this
     * produced a 403 at read time — correct, and a support call rather than a
     * violation whoever wrote it sees immediately.
     */
    it("refuses a role no projection knows", async () => {
      await expect(
        run(
          `INSERT INTO aforce_program_members (program_id, user_id, role, status)
           VALUES ($1, $2, 'head_coach', 'active')`,
          [PROGRAM, ATHLETE],
        ),
      ).rejects.toMatchObject({ code: CHECK_VIOLATION });
    });

    it("refuses a membership status outside active/removed", async () => {
      await expect(
        run(
          `INSERT INTO aforce_program_members (program_id, user_id, role, status)
           VALUES ($1, $2, 'athlete', 'suspended')`,
          [PROGRAM, ATHLETE],
        ),
      ).rejects.toMatchObject({ code: CHECK_VIOLATION });
    });
  });

  describe("training load", () => {
    const insert = (rpe: number, durationMin: number) =>
      run(
        `INSERT INTO aforce_athlete_sessions
           (program_id, athlete_user_id, session_date, rpe, duration_min, entered_by_user_id)
         VALUES ($1, $2, '2026-09-16', $3, $4, $5)`,
        [PROGRAM, ATHLETE, rpe, durationMin, TRAINER],
      );

    it("accepts the boundaries", async () => {
      await expect(insert(1, 1)).resolves.toBeUndefined();
      await expect(insert(10, 600)).resolves.toBeUndefined();
    });

    it.each([
      ["rpe of 0", 0, 60],
      ["rpe of 11", 11, 60],
      ["rpe of 400", 400, 60],
      ["a negative rpe", -3, 60],
      ["zero duration", 5, 0],
      ["a 25-hour session", 5, 1500],
    ])("refuses %s", async (_label, rpe, duration) => {
      await expect(insert(rpe, duration)).rejects.toMatchObject({ code: CHECK_VIOLATION });
    });
  });

  describe("an amendment must state a reason", () => {
    const insertNote = (version: number, reason: string | null) =>
      run(
        `INSERT INTO aforce_athlete_soap_notes
           (program_id, subject_user_id, author_user_id, root_id, version, amendment_reason, subjective)
         VALUES ($1, $2, $3, NULL, $4, $5, 'text')`,
        [PROGRAM, ATHLETE, TRAINER, version, reason],
      );

    it("version 1 needs no reason — it is the original", async () => {
      await expect(insertNote(1, null)).resolves.toBeUndefined();
    });

    it("an amendment with a reason is accepted", async () => {
      await expect(insertNote(2, "wrong side recorded")).resolves.toBeUndefined();
    });

    /**
     * The rule the whole append-only design rests on. It lived in one `if` at
     * one route; a silent revision is exactly what it exists to prevent.
     */
    it.each([
      ["no reason", null],
      ["an empty reason", ""],
      ["whitespace", "   "],
    ])("refuses an amendment with %s", async (_label, reason) => {
      await expect(insertNote(2, reason)).rejects.toMatchObject({ code: CHECK_VIOLATION });
    });

    it("refuses a version below 1", async () => {
      await expect(insertNote(0, "x")).rejects.toMatchObject({ code: CHECK_VIOLATION });
    });
  });

  describe("return-to-play sign-offs", () => {
    it("refuses a negative stage index", async () => {
      // It would satisfy the unique index and mean nothing.
      await expect(
        run(
          `INSERT INTO aforce_rtp_signoffs
             (progression_id, program_id, stage_index, stage_key, signed_by_user_id)
           VALUES ('p1', $1, -1, 'rest', $2)`,
          [PROGRAM, TRAINER],
        ),
      ).rejects.toMatchObject({ code: CHECK_VIOLATION });
    });

    it("accepts stage zero", async () => {
      await expect(
        run(
          `INSERT INTO aforce_rtp_signoffs
             (progression_id, program_id, stage_index, stage_key, signed_by_user_id)
           VALUES ('p_ok', $1, 0, 'rest', $2)`,
          [PROGRAM, TRAINER],
        ),
      ).resolves.toBeUndefined();
    });
  });

  /**
   * The application still writes valid rows. A constraint that rejected
   * something the product legitimately does would be a worse bug than the one
   * it prevents, so the repository path is exercised too.
   */
  it("every value the repositories write is still accepted", async () => {
    const { createTrainerRepo, createTrainerDocsRepo, db } = await import("@workspace/db");
    const repo = createTrainerRepo(db);
    const docs = createTrainerDocsRepo(db);

    for (const status of ["available", "limited", "out"]) {
      const current = await repo.currentAvailability(PROGRAM, ATHLETE);
      const result = await repo.appendAvailability({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        status,
        reason: status === "available" ? null : "held",
        setByUserId: TRAINER,
        expectedVersion: current?.version ?? null,
      });
      expect(result.ok, status).toBe(true);
    }

    const note = await docs.fileNote({
      programId: PROGRAM,
      subjectUserId: ATHLETE,
      authorUserId: TRAINER,
      fields: { subjective: "s", objective: null, assessment: null, plan: null },
    });
    const amended = await docs.amendNote({
      programId: PROGRAM,
      noteId: note.id,
      authorUserId: TRAINER,
      fields: { subjective: "s2", objective: null, assessment: null, plan: null },
      amendmentReason: "corrected",
    });
    expect(amended.ok).toBe(true);

    await expect(
      docs.recordSession({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        sessionDate: "2026-09-16",
        rpe: 7,
        durationMin: 90,
        sessionType: "field",
        enteredByUserId: TRAINER,
      }),
    ).resolves.toBeTruthy();
  });
});
