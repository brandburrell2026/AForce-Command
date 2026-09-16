/**
 * Notes are encrypted IN THE DATABASE — read back as raw bytes.
 *
 * `noteCrypto.test.ts` proves the cipher. This proves the storage, which is
 * the claim that was false for two builds: four `*_enc` columns existed and
 * nothing ever wrote them, so every note sat in the plaintext columns where a
 * replica, a `pg_dump`, a backup or a read-only analytics grant could read
 * it — while the module header said the opposite.
 *
 * So this suite does not ask the repository what it stored. It goes around
 * the repository, selects the raw columns with a plain `pg` client, and looks
 * at the bytes. That is the query an analyst with a read-only grant would
 * run, and it is the only version of this test that could have failed before.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTrainerDocsRepo, db, pool } from "@workspace/db";

// requires real Postgres — runs in the DB lane (pnpm test:db)
const DB = Boolean(process.env["DB_TESTS"]);

const PROGRAM = `prog_notecrypto_${process.pid}`;
const ATHLETE = `athlete_${process.pid}`;
const TRAINER = `trainer_${process.pid}`;

const SUBJECTIVE = "Athlete reports posterior thigh pain after sprinting.";
const ASSESSMENT = "Grade 1 hamstring strain suspected. Concussion protocol not indicated.";

const docs = createTrainerDocsRepo(db);

/** The env the repo reads. Restored afterwards so the lane is unaffected. */
const priorKey = process.env["MEDICAL_NOTE_ENCRYPTION_KEY"];

async function wipe(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM aforce_athlete_soap_notes WHERE program_id = $1", [PROGRAM]);
  } finally {
    client.release();
  }
}

/** Raw columns, straight from Postgres. No repository in the path. */
async function rawRow(id: number): Promise<Record<string, unknown>> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT subjective, objective, assessment, plan,
              subjective_enc, objective_enc, assessment_enc, plan_enc
         FROM aforce_athlete_soap_notes WHERE id = $1`,
      [id],
    );
    return rows[0] as Record<string, unknown>;
  } finally {
    client.release();
  }
}

describe.runIf(DB)("medical notes are encrypted at rest", () => {
  beforeAll(() => {
    process.env["MEDICAL_NOTE_ENCRYPTION_KEY"] = Buffer.alloc(32, 11).toString("base64");
  });
  afterAll(async () => {
    if (priorKey === undefined) delete process.env["MEDICAL_NOTE_ENCRYPTION_KEY"];
    else process.env["MEDICAL_NOTE_ENCRYPTION_KEY"] = priorKey;
    await wipe();
  });
  beforeEach(wipe);

  it("writes ciphertext to the *_enc columns and leaves the plaintext columns NULL", async () => {
    const { entry: note } = await docs.fileNote({
      programId: PROGRAM,
      subjectUserId: ATHLETE,
      authorUserId: TRAINER,
      fields: { subjective: SUBJECTIVE, objective: null, assessment: ASSESSMENT, plan: null },
    });

    const row = await rawRow(note.id);

    // The columns that used to hold everything.
    expect(row["subjective"]).toBeNull();
    expect(row["assessment"]).toBeNull();
    // A field that was absent stays absent in both forms — ciphertext of ""
    // would tell a reader the field exists.
    expect(row["objective"]).toBeNull();
    expect(row["objective_enc"]).toBeNull();

    expect(row["subjective_enc"]).not.toBeNull();
    expect(row["assessment_enc"]).not.toBeNull();
  });

  it("the stored bytes do not contain the note, in any encoding a reader would try", async () => {
    const { entry: note } = await docs.fileNote({
      programId: PROGRAM,
      subjectUserId: ATHLETE,
      authorUserId: TRAINER,
      fields: { subjective: SUBJECTIVE, objective: null, assessment: ASSESSMENT, plan: null },
    });

    const row = await rawRow(note.id);
    const bytes = Buffer.concat([
      Buffer.from(row["subjective_enc"] as Uint8Array),
      Buffer.from(row["assessment_enc"] as Uint8Array),
    ]);

    for (const encoding of ["utf8", "latin1", "ascii"] as const) {
      const text = bytes.toString(encoding);
      expect(text).not.toContain(SUBJECTIVE);
      expect(text).not.toContain(ASSESSMENT);
      for (const word of ["thigh", "pain", "hamstring", "strain", "Concussion", "sprinting"]) {
        expect(text, `${encoding}: "${word}"`).not.toContain(word);
      }
    }
  });

  /**
   * The query an analyst with a read-only grant would actually run. It used
   * to return the note.
   */
  it("a LIKE scan across the whole table finds nothing clinical", async () => {
    await docs.fileNote({
      programId: PROGRAM,
      subjectUserId: ATHLETE,
      authorUserId: TRAINER,
      fields: { subjective: SUBJECTIVE, objective: null, assessment: ASSESSMENT, plan: null },
    });

    const client = await pool.connect();
    try {
      for (const term of ["%hamstring%", "%pain%", "%Concussion%"]) {
        const { rows } = await client.query(
          `SELECT count(*)::int AS n FROM aforce_athlete_soap_notes
            WHERE program_id = $1
              AND (subjective ILIKE $2 OR objective ILIKE $2
                OR assessment ILIKE $2 OR plan ILIKE $2)`,
          [PROGRAM, term],
        );
        expect((rows[0] as { n: number }).n, term).toBe(0);
      }
    } finally {
      client.release();
    }
  });

  it("round-trips through the repository, so the note is not merely lost", async () => {
    const { entry: note } = await docs.fileNote({
      programId: PROGRAM,
      subjectUserId: ATHLETE,
      authorUserId: TRAINER,
      fields: { subjective: SUBJECTIVE, objective: null, assessment: ASSESSMENT, plan: null },
    });
    const [current] = await docs.currentNotes(PROGRAM, ATHLETE);

    expect(current!.subjective).toBe(SUBJECTIVE);
    expect(current!.assessment).toBe(ASSESSMENT);
    expect(current!.objective).toBeNull();
    expect(current!.id).toBe(note.id);
  });

  it("encrypts an amendment too, not only the first version", async () => {
    const { entry: first } = await docs.fileNote({
      programId: PROGRAM,
      subjectUserId: ATHLETE,
      authorUserId: TRAINER,
      fields: { subjective: "v1", objective: null, assessment: null, plan: null },
    });
    const amended = await docs.amendNote({
      programId: PROGRAM,
      noteId: first.id,
      authorUserId: TRAINER,
      fields: { subjective: ASSESSMENT, objective: null, assessment: null, plan: null },
      amendmentReason: "corrected",
    });
    expect(amended.ok).toBe(true);

    const row = await rawRow(amended.ok ? amended.entry.id : -1);
    expect(row["subjective"]).toBeNull();
    expect(Buffer.from(row["subjective_enc"] as Uint8Array).toString("utf8")).not.toContain("hamstring");

    const versions = await docs.noteVersions(PROGRAM, first.rootId);
    expect(versions.map((v) => v.subjective)).toEqual(["v1", ASSESSMENT]);
  });

  /**
   * Turning encryption on must not orphan rows written before it. This is
   * what lets the fallback in `readField` exist rather than being dead code.
   */
  it("still reads a row written while no key was configured", async () => {
    const key = process.env["MEDICAL_NOTE_ENCRYPTION_KEY"];
    delete process.env["MEDICAL_NOTE_ENCRYPTION_KEY"];
    const { entry: legacy } = await docs.fileNote({
      programId: PROGRAM,
      subjectUserId: ATHLETE,
      authorUserId: TRAINER,
      fields: { subjective: "written before encryption", objective: null, assessment: null, plan: null },
    });
    process.env["MEDICAL_NOTE_ENCRYPTION_KEY"] = key;

    const raw = await rawRow(legacy.id);
    expect(raw["subjective"]).toBe("written before encryption");
    expect(raw["subjective_enc"]).toBeNull();

    const versions = await docs.noteVersions(PROGRAM, legacy.rootId);
    expect(versions[0]!.subjective).toBe("written before encryption");
  });
});
