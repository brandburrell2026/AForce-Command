/**
 * A retried note write does not file a second note.
 *
 * THE FAILURE THIS CLOSES. The write path commits the note and then writes
 * its audit row. An audit failure therefore returned 500 on an ALREADY
 * DURABLE note, and the offline outbox — which retries forever by design —
 * sent it again. The result was two records of one assessment, each with its
 * own version chain, in a document a clinician relies on.
 *
 * Everything here runs against real Postgres, because the interesting cases
 * are races: two retries landing at once is the case a `SELECT` then
 * `INSERT` cannot handle and a unique index can.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTrainerDocsRepo, db, pool } from "@workspace/db";

const DB = Boolean(process.env["DB_TESTS"]);

const PROGRAM = `prog_idem_${process.pid}`;
const OTHER_PROGRAM = `prog_idem_other_${process.pid}`;
const ATHLETE = `athlete_${process.pid}`;
const TRAINER = `trainer_${process.pid}`;

const docs = createTrainerDocsRepo(db);

const FIELDS = {
  subjective: "reports posterior thigh tightness",
  objective: "antalgic gait",
  assessment: "grade 1 strain suspected",
  plan: "isometrics, reassess Thursday",
};

async function countNotes(programId = PROGRAM): Promise<number> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT count(*)::int AS n FROM aforce_athlete_soap_notes WHERE program_id = $1",
      [programId],
    );
    return (rows[0] as { n: number }).n;
  } finally {
    client.release();
  }
}

async function wipe(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("DELETE FROM aforce_athlete_soap_notes WHERE program_id = ANY($1)", [
      [PROGRAM, OTHER_PROGRAM],
    ]);
  } finally {
    client.release();
  }
}

const file = (key: string | null, over: Partial<typeof FIELDS> = {}, programId = PROGRAM) =>
  docs.fileNote({
    programId,
    subjectUserId: ATHLETE,
    authorUserId: TRAINER,
    fields: { ...FIELDS, ...over },
    idempotencyKey: key,
  });

describe.runIf(DB)("note writes are idempotent", () => {
  beforeEach(wipe);
  afterAll(wipe);

  describe("the retry scenario, end to end", () => {
    /**
     * The exact sequence from the audit: durable write, 500 to the client,
     * client retries the same queued entry.
     */
    it("a retry after a successful-but-500'd write creates no second note", async () => {
      const key = "outbox_avail_001";

      const first = await file(key);
      expect(first.replayed).toBe(false);
      // ... the audit insert fails here and the route answers 500 ...
      const retry = await file(key);

      expect(retry.replayed).toBe(true);
      expect(await countNotes()).toBe(1);
    });

    it("the retry returns the ORIGINAL note, not a new one", async () => {
      const key = "outbox_note_002";
      const first = await file(key);
      const retry = await file(key);

      // Indistinguishable from the original, which is the point: a retry
      // must be safe, not merely harmless.
      expect(retry.entry.id).toBe(first.entry.id);
      expect(retry.entry.rootId).toBe(first.entry.rootId);
      expect(retry.entry.version).toBe(1);
      expect(retry.entry.createdAt).toBe(first.entry.createdAt);
      expect(retry.entry.subjective).toBe(FIELDS.subjective);
    });

    it("survives many retries, not just one", async () => {
      const key = "outbox_note_003";
      await file(key);
      for (let i = 0; i < 8; i += 1) {
        expect((await file(key)).replayed).toBe(true);
      }
      expect(await countNotes()).toBe(1);
    });

    /**
     * A replay must not silently adopt different text. The stored note is
     * the one that was committed; if a client sends the same key with
     * different content, the FIRST write is the record.
     */
    it("a replay returns the stored text even if the retry body differs", async () => {
      const key = "outbox_note_004";
      await file(key);
      const retry = await file(key, { subjective: "completely different text" });

      expect(retry.replayed).toBe(true);
      expect(retry.entry.subjective).toBe(FIELDS.subjective);
      expect(await countNotes()).toBe(1);
    });
  });

  describe("concurrent retries", () => {
    /**
     * THE RACE A `SELECT` THEN `INSERT` CANNOT HANDLE. Both attempts find no
     * existing row and both try to insert. Only the unique index decides it
     * correctly — and the loser must read back the winner's note rather than
     * erroring, or the client sees a 500 for a note that exists.
     */
    it("six simultaneous retries of one entry produce exactly one note", async () => {
      const key = "outbox_note_race";
      const results = await Promise.all(Array.from({ length: 6 }, () => file(key)));

      expect(await countNotes()).toBe(1);
      // Exactly one did the writing; the rest replayed.
      expect(results.filter((r) => !r.replayed)).toHaveLength(1);
      expect(results.filter((r) => r.replayed)).toHaveLength(5);
      // And every caller got the same note back.
      expect(new Set(results.map((r) => r.entry.id)).size).toBe(1);
    });

    it("no caller receives an error", async () => {
      const key = "outbox_note_race_2";
      await expect(
        Promise.all(Array.from({ length: 6 }, () => file(key))),
      ).resolves.toHaveLength(6);
    });
  });

  describe("legitimately distinct notes are never merged", () => {
    it("different keys write different notes", async () => {
      await file("entry_a");
      await file("entry_b");
      await file("entry_c");
      expect(await countNotes()).toBe(3);
    });

    /**
     * Two notes about the same athlete with identical text, filed minutes
     * apart, are two clinical observations — not a duplicate. Only the KEY
     * decides, never the content.
     */
    it("identical text under different keys is two notes", async () => {
      await file("morning");
      await file("afternoon");
      expect(await countNotes()).toBe(2);
    });

    it("a write with NO key is never deduplicated", async () => {
      // Direct API callers and future imports have no queue entry behind
      // them. Nulls must not collide with each other under the index.
      await file(null);
      await file(null);
      await file(null);
      expect(await countNotes()).toBe(3);
    });

    it("the same key in a different program does not collide", async () => {
      const key = "outbox_shared_key";
      const a = await file(key, {}, PROGRAM);
      const b = await file(key, {}, OTHER_PROGRAM);

      expect(b.replayed).toBe(false);
      expect(b.entry.id).not.toBe(a.entry.id);
      expect(await countNotes(PROGRAM)).toBe(1);
      expect(await countNotes(OTHER_PROGRAM)).toBe(1);
    });
  });

  describe("amendments are idempotent too", () => {
    it("a retried amendment does not add a second version", async () => {
      const original = await file(null);
      const key = "outbox_amend_001";

      const first = await docs.amendNote({
        programId: PROGRAM,
        noteId: original.entry.id,
        authorUserId: TRAINER,
        fields: { ...FIELDS, subjective: "corrected" },
        amendmentReason: "wrong side recorded",
        idempotencyKey: key,
      });
      const retry = await docs.amendNote({
        programId: PROGRAM,
        noteId: original.entry.id,
        authorUserId: TRAINER,
        fields: { ...FIELDS, subjective: "corrected" },
        amendmentReason: "wrong side recorded",
        idempotencyKey: key,
      });

      expect(first.ok && retry.ok).toBe(true);
      if (!first.ok || !retry.ok) throw new Error("unreachable");
      expect(retry.replayed).toBe(true);
      expect(retry.entry.id).toBe(first.entry.id);

      // Version 1 and version 2 — not 1, 2 and 3. A chain reading as though
      // a clinician revised twice is a false record of clinical activity.
      const versions = await docs.noteVersions(PROGRAM, original.entry.rootId);
      expect(versions.map((v) => v.version)).toEqual([1, 2]);
      expect(retry.subjectUserId).toBe(ATHLETE);
    });

    it("concurrent retried amendments still yield one new version", async () => {
      const original = await file(null);
      const key = "outbox_amend_race";
      const amend = () =>
        docs.amendNote({
          programId: PROGRAM,
          noteId: original.entry.id,
          authorUserId: TRAINER,
          fields: { ...FIELDS, subjective: "corrected" },
          amendmentReason: "reason",
          idempotencyKey: key,
        });

      await Promise.all([amend(), amend(), amend(), amend()]);

      const versions = await docs.noteVersions(PROGRAM, original.entry.rootId);
      expect(versions.map((v) => v.version)).toEqual([1, 2]);
    });
  });

  describe("the index is what enforces it", () => {
    it("a duplicate key written around the application is refused by Postgres", async () => {
      const key = "outbox_direct";
      await file(key);

      const client = await pool.connect();
      try {
        await expect(
          client.query(
            `INSERT INTO aforce_athlete_soap_notes
               (program_id, subject_user_id, author_user_id, version, subjective, idempotency_key)
             VALUES ($1, $2, $3, 1, 'sneaking past the app', $4)`,
            [PROGRAM, ATHLETE, TRAINER, key],
          ),
        ).rejects.toMatchObject({ code: "23505" });
      } finally {
        client.release();
      }
      expect(await countNotes()).toBe(1);
    });
  });
});
