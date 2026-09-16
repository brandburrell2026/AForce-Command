/**
 * The trainer repositories against real Postgres.
 *
 * Until this file, NO trainer test had ever touched a database. The consent
 * compare-and-swap, the availability advisory lock, the sign-off unique
 * index, `onConflictDoNothing`, the note version chain and every line of SQL
 * underneath them were covered only by fakes that agreed with whatever the
 * code did. CI created the tables with `push-force` in a throwaway container,
 * which proved the schema parses and nothing else.
 *
 * These are the properties a fake cannot check, so each one runs two real
 * sessions and interleaves them:
 *
 *   - a compare-and-swap that is genuinely atomic across connections
 *   - an advisory lock that genuinely excludes a second writer
 *   - a unique index that genuinely refuses the second insert
 *   - a row lock that genuinely serializes two amendments
 *
 * Every test namespaces its rows by pid so the lane can run in parallel and
 * against a database that already has data, and cleans up after itself.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createTrainerDocsRepo,
  createTrainerRepo,
  createTrainerRtpRepo,
  db,
  pool,
} from "@workspace/db";

// requires real Postgres — runs in the DB lane (pnpm test:db)
const DB = Boolean(process.env["DB_TESTS"]);

const PROGRAM = `prog_trainer_${process.pid}`;
const ATHLETE = `athlete_${process.pid}`;
const TRAINER_A = `trainer_a_${process.pid}`;
const TRAINER_B = `trainer_b_${process.pid}`;

const repo = createTrainerRepo(db);
const docs = createTrainerDocsRepo(db);
const rtp = createTrainerRtpRepo(db);

async function wipe(): Promise<void> {
  const client = await pool.connect();
  try {
    for (const table of [
      "aforce_medical_access_log",
      "aforce_athlete_availability",
      "aforce_athlete_consent_events",
      "aforce_athlete_consents",
      "aforce_athlete_soap_notes",
      "aforce_athlete_sessions",
      "aforce_athlete_screenings",
      "aforce_athlete_questionnaires",
      "aforce_rtp_signoffs",
      "aforce_rtp_progressions",
      "aforce_rtp_protocols",
      "aforce_program_members",
    ]) {
      // Scoped to this pid's program. Never a bare DELETE.
      await client.query(`DELETE FROM ${table} WHERE program_id = $1`, [PROGRAM]);
    }
  } finally {
    client.release();
  }
}

describe.runIf(DB)("trainer repositories — real Postgres", () => {
  beforeEach(wipe);
  afterAll(async () => {
    await wipe();
  });

  // ─── Consent: the compare-and-swap ──────────────────────────────────────

  describe("consent is a compare-and-swap, across connections", () => {
    it("defaults to not granted, sequence zero", async () => {
      expect(await repo.consent(PROGRAM, ATHLETE)).toEqual({ granted: false, decisionSeq: 0 });
    });

    it("only sequence 0 may create the first decision", async () => {
      const wrong = await repo.setConsent({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        granted: true,
        expectedSeq: 3,
      });
      expect(wrong.ok).toBe(false);
      // And nothing was written.
      expect(await repo.consent(PROGRAM, ATHLETE)).toEqual({ granted: false, decisionSeq: 0 });

      const right = await repo.setConsent({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        granted: true,
        expectedSeq: 0,
      });
      expect(right).toMatchObject({ ok: true, state: { granted: true, decisionSeq: 1 } });
    });

    it("refuses a stale sequence and returns the committed state", async () => {
      await repo.setConsent({ programId: PROGRAM, athleteUserId: ATHLETE, granted: true, expectedSeq: 0 });
      await repo.setConsent({ programId: PROGRAM, athleteUserId: ATHLETE, granted: false, expectedSeq: 1 });

      // A device that slept through the revocation tries to re-grant on seq 1.
      const stale = await repo.setConsent({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        granted: true,
        expectedSeq: 1,
      });
      expect(stale).toEqual({ ok: false, current: { granted: false, decisionSeq: 2 } });
      expect(await repo.consent(PROGRAM, ATHLETE)).toEqual({ granted: false, decisionSeq: 2 });
    });

    it("two simultaneous writers on the same sequence: exactly one wins", async () => {
      await repo.setConsent({ programId: PROGRAM, athleteUserId: ATHLETE, granted: true, expectedSeq: 0 });

      const [a, b] = await Promise.all([
        repo.setConsent({ programId: PROGRAM, athleteUserId: ATHLETE, granted: false, expectedSeq: 1 }),
        repo.setConsent({ programId: PROGRAM, athleteUserId: ATHLETE, granted: true, expectedSeq: 1 }),
      ]);

      expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
      expect(await repo.consent(PROGRAM, ATHLETE)).toMatchObject({ decisionSeq: 2 });
    });

    it("appends one evidence row per ACCEPTED decision and none per refusal", async () => {
      await repo.setConsent({ programId: PROGRAM, athleteUserId: ATHLETE, granted: true, expectedSeq: 0 });
      await repo.setConsent({ programId: PROGRAM, athleteUserId: ATHLETE, granted: false, expectedSeq: 1 });
      await repo.setConsent({ programId: PROGRAM, athleteUserId: ATHLETE, granted: true, expectedSeq: 0 }); // refused

      const client = await pool.connect();
      try {
        const { rows } = await client.query(
          "SELECT action, decision_seq FROM aforce_athlete_consent_events WHERE program_id = $1 ORDER BY decision_seq",
          [PROGRAM],
        );
        expect(rows).toEqual([
          { action: "grant", decision_seq: 1 },
          { action: "revoke", decision_seq: 2 },
        ]);
      } finally {
        client.release();
      }
    });
  });

  // ─── Availability: the CAS and its advisory lock ────────────────────────

  describe("availability refuses a stale writer", () => {
    it("takes the first write on an explicit null, and refuses a second", async () => {
      const first = await repo.appendAvailability({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        status: "out",
        reason: "held from contact",
        setByUserId: TRAINER_A,
        expectedVersion: null,
      });
      expect(first.ok).toBe(true);

      const second = await repo.appendAvailability({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        status: "available",
        reason: null,
        setByUserId: TRAINER_B,
        expectedVersion: null,
      });
      expect(second).toMatchObject({ ok: false, current: { status: "out" } });

      // The newer decision still stands.
      expect(await repo.currentAvailability(PROGRAM, ATHLETE)).toMatchObject({ status: "out" });
    });

    /**
     * The scenario from the audit, end to end against a real database.
     */
    it("an offline device cannot overwrite a newer decision", async () => {
      // 13:00 — the device reads this state and goes offline.
      const start = await repo.appendAvailability({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        status: "available",
        reason: null,
        setByUserId: TRAINER_A,
        expectedVersion: null,
      });
      const staleVersion = start.ok ? start.version : -1;

      // 14:00 — the sideline trainer marks the athlete out.
      const out = await repo.appendAvailability({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        status: "out",
        reason: "suspected concussion",
        setByUserId: TRAINER_A,
        expectedVersion: staleVersion,
      });
      expect(out.ok).toBe(true);

      // 14:05 — the offline device flushes, still believing the old version.
      const flushed = await repo.appendAvailability({
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        status: "available",
        reason: null,
        setByUserId: TRAINER_B,
        expectedVersion: staleVersion,
      });

      expect(flushed.ok).toBe(false);
      expect(await repo.currentAvailability(PROGRAM, ATHLETE)).toMatchObject({
        status: "out",
        reason: "suspected concussion",
      });
    });

    it("two simultaneous first writes: the advisory lock admits exactly one", async () => {
      // With no row to select FOR UPDATE, only the advisory lock stops both
      // from inserting. This is the test that proves it does.
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          repo.appendAvailability({
            programId: PROGRAM,
            athleteUserId: ATHLETE,
            status: "limited",
            reason: `writer ${i}`,
            setByUserId: TRAINER_A,
            expectedVersion: null,
          }),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);

      const client = await pool.connect();
      try {
        const { rows } = await client.query(
          "SELECT count(*)::int AS n FROM aforce_athlete_availability WHERE program_id = $1",
          [PROGRAM],
        );
        expect((rows[0] as { n: number }).n).toBe(1);
      } finally {
        client.release();
      }
    });

    it("reports the version by row id, so same-millisecond writes cannot tie", async () => {
      let version: number | null = null;
      for (let i = 0; i < 4; i += 1) {
        const r = await repo.appendAvailability({
          programId: PROGRAM,
          athleteUserId: ATHLETE,
          status: i % 2 === 0 ? "out" : "limited",
          reason: null,
          setByUserId: TRAINER_A,
          expectedVersion: version,
        });
        expect(r.ok, `write ${i}`).toBe(true);
        version = r.ok ? r.version : null;
      }
      const current = await repo.currentAvailability(PROGRAM, ATHLETE);
      expect(current?.version).toBe(version);
      expect(current?.status).toBe("limited");
    });
  });

  // ─── Notes: the chain, the amendment race, and encryption ───────────────

  describe("the note chain cannot lose an amendment", () => {
    const fields = { subjective: "s1", objective: null, assessment: null, plan: null };

    it("files version 1 as its own root", async () => {
      const { entry: note } = await docs.fileNote({
        programId: PROGRAM,
        subjectUserId: ATHLETE,
        authorUserId: TRAINER_A,
        fields,
      });
      expect(note.version).toBe(1);
      expect(note.rootId).toBe(note.id);
    });

    it("an amendment inserts a new version and leaves the prior row untouched", async () => {
      const { entry: first } = await docs.fileNote({
        programId: PROGRAM,
        subjectUserId: ATHLETE,
        authorUserId: TRAINER_A,
        fields,
      });
      const amended = await docs.amendNote({
        programId: PROGRAM,
        noteId: first.id,
        authorUserId: TRAINER_B,
        fields: { ...fields, subjective: "s2" },
        amendmentReason: "wrong side recorded",
      });
      expect(amended.ok).toBe(true);

      const versions = await docs.noteVersions(PROGRAM, first.rootId);
      expect(versions.map((v) => v.version)).toEqual([1, 2]);
      expect(versions[0]!.subjective).toBe("s1");
      expect(versions[0]!.amendmentReason).toBeNull();
      expect(versions[1]!.subjective).toBe("s2");
      expect(versions[1]!.amendmentReason).toBe("wrong side recorded");
    });

    /**
     * THE RACE. `amendNote` picks the next version from the chain's current
     * maximum. Without the row lock, concurrent amendments both read the same
     * maximum, both chose N+1, both inserted — and `currentNotes` kept one,
     * so a clinician's amendment vanished from the current view while
     * surviving in the chart export.
     */
    it("concurrent amendments produce consecutive versions, and lose none", async () => {
      const { entry: first } = await docs.fileNote({
        programId: PROGRAM,
        subjectUserId: ATHLETE,
        authorUserId: TRAINER_A,
        fields,
      });

      const results = await Promise.all(
        Array.from({ length: 4 }, (_, i) =>
          docs.amendNote({
            programId: PROGRAM,
            noteId: first.id,
            authorUserId: TRAINER_B,
            fields: { ...fields, subjective: `amend ${i}` },
            amendmentReason: `reason ${i}`,
          }),
        ),
      );
      expect(results.every((r) => r.ok)).toBe(true);

      const versions = await docs.noteVersions(PROGRAM, first.rootId);
      // Five rows, versions 1..5, every one distinct. Not four rows, and not
      // two rows sharing version 2.
      expect(versions.map((v) => v.version)).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(versions.map((v) => v.subjective)).size).toBe(5);
    });

    it("the unique index refuses a duplicate version outright", async () => {
      const { entry: first } = await docs.fileNote({
        programId: PROGRAM,
        subjectUserId: ATHLETE,
        authorUserId: TRAINER_A,
        fields,
      });
      const client = await pool.connect();
      try {
        await expect(
          client.query(
            `INSERT INTO aforce_athlete_soap_notes
               (program_id, subject_user_id, author_user_id, root_id, version, subjective)
             VALUES ($1, $2, $3, $4, 1, 'duplicate')`,
            [PROGRAM, ATHLETE, TRAINER_A, first.rootId],
          ),
        ).rejects.toThrow(/duplicate key|unique/i);
      } finally {
        client.release();
      }
    });

    it("currentNotes returns the newest version of each chain and no older one", async () => {
      const { entry: a } = await docs.fileNote({
        programId: PROGRAM,
        subjectUserId: ATHLETE,
        authorUserId: TRAINER_A,
        fields: { ...fields, subjective: "chain a v1" },
      });
      await docs.amendNote({
        programId: PROGRAM,
        noteId: a.id,
        authorUserId: TRAINER_A,
        fields: { ...fields, subjective: "chain a v2" },
        amendmentReason: "r",
      });
      await docs.fileNote({
        programId: PROGRAM,
        subjectUserId: ATHLETE,
        authorUserId: TRAINER_A,
        fields: { ...fields, subjective: "chain b v1" },
      });

      const current = await docs.currentNotes(PROGRAM, ATHLETE);
      const texts = current.map((n) => n.subjective).sort();
      expect(texts).toEqual(["chain a v2", "chain b v1"]);
    });

    it("amending an unknown note is not_found, and writes nothing", async () => {
      const result = await docs.amendNote({
        programId: PROGRAM,
        noteId: 2147483000,
        authorUserId: TRAINER_A,
        fields,
        amendmentReason: "r",
      });
      expect(result).toEqual({ ok: false, reason: "not_found" });
      expect(await docs.currentNotes(PROGRAM, ATHLETE)).toEqual([]);
    });
  });

  // ─── Sign-offs: the unique index and onConflictDoNothing ────────────────

  describe("a return-to-play stage can be signed exactly once", () => {
    const STAGES = [
      { key: "rest", label: "Symptom-limited activity", description: "Daily activities only" },
      { key: "light", label: "Light aerobic", description: "Walking or bike" },
    ];

    async function progression() {
      // `id` and `version` are supplied by the caller, as the route does
      // with randomUUID() — this table's primary key has no default.
      const protocol = await rtp.createProtocol({
        id: `protocol_${process.pid}_${Math.random().toString(36).slice(2)}`,
        programId: PROGRAM,
        name: "Concussion",
        version: 1,
        stages: STAGES,
        createdByUserId: TRAINER_A,
      });
      return rtp.startProgression({
        id: `progression_${process.pid}_${Math.random().toString(36).slice(2)}`,
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        protocolId: protocol.id,
        stages: STAGES,
        startedByUserId: TRAINER_A,
      });
    }

    it("admits the first sign-off and refuses a repeat of the same stage", async () => {
      const p = await progression();
      const first = await rtp.signOff({
        progressionId: p.id,
        programId: PROGRAM,
        stageIndex: 0,
        stageKey: "rest",
        signedByUserId: TRAINER_A,
        note: null,
      });
      expect(first.ok).toBe(true);

      const repeat = await rtp.signOff({
        progressionId: p.id,
        programId: PROGRAM,
        stageIndex: 0,
        stageKey: "rest",
        signedByUserId: TRAINER_B,
        note: null,
      });
      expect(repeat.ok).toBe(false);
      expect(await rtp.signoffs(p.id)).toHaveLength(1);
    });

    it("two clinicians signing the same stage at once: exactly one row", async () => {
      const p = await progression();
      const results = await Promise.all(
        [TRAINER_A, TRAINER_B, TRAINER_A, TRAINER_B].map((who) =>
          rtp.signOff({
            progressionId: p.id,
            programId: PROGRAM,
            stageIndex: 1,
            stageKey: "light",
            signedByUserId: who,
            note: null,
          }),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(await rtp.signoffs(p.id)).toHaveLength(1);
    });

    it("different stages of the same progression are independent", async () => {
      const p = await progression();
      expect(
        (
          await rtp.signOff({
            progressionId: p.id,
            programId: PROGRAM,
            stageIndex: 0,
            stageKey: "rest",
            signedByUserId: TRAINER_A,
            note: null,
          })
        ).ok,
      ).toBe(true);
      expect(
        (
          await rtp.signOff({
            progressionId: p.id,
            programId: PROGRAM,
            stageIndex: 1,
            stageKey: "light",
            signedByUserId: TRAINER_A,
            note: null,
          })
        ).ok,
      ).toBe(true);
      expect(await rtp.signoffs(p.id)).toHaveLength(2);
    });
  });

  // ─── Batched reads: parity with the per-athlete reads ───────────────────

  /**
   * The roster's batched reads replaced a per-athlete fan-out. The only thing
   * that must be true of them is that they answer IDENTICALLY — including for
   * the athletes who have nothing, which is where a batch most easily
   * diverges: a `WHERE id = ANY(...)` returns no row for them, and the caller
   * has to supply the same default the single read did.
   *
   * Both implementations still exist, so this compares them directly rather
   * than against a hand-written expectation.
   */
  describe("batched reads answer exactly what the per-athlete reads answer", () => {
    const WITH_EVERYTHING = `${ATHLETE}_full`;
    const WITH_NOTHING = `${ATHLETE}_empty`;
    const WITH_SOME = `${ATHLETE}_partial`;
    const ALL = [WITH_EVERYTHING, WITH_SOME, WITH_NOTHING];

    beforeEach(async () => {
      // Everything.
      await repo.setConsent({
        programId: PROGRAM,
        athleteUserId: WITH_EVERYTHING,
        granted: true,
        expectedSeq: 0,
      });
      await repo.appendAvailability({
        programId: PROGRAM,
        athleteUserId: WITH_EVERYTHING,
        status: "out",
        reason: "held from contact",
        setByUserId: TRAINER_A,
        expectedVersion: null,
      });
      // Two availability rows, so "newest wins" is actually exercised.
      const second = await repo.currentAvailability(PROGRAM, WITH_EVERYTHING);
      await repo.appendAvailability({
        programId: PROGRAM,
        athleteUserId: WITH_EVERYTHING,
        status: "limited",
        reason: "return to running",
        setByUserId: TRAINER_B,
        expectedVersion: second?.version ?? null,
      });

      // Consent only — no availability, no notes.
      await repo.setConsent({
        programId: PROGRAM,
        athleteUserId: WITH_SOME,
        granted: false,
        expectedSeq: 0,
      });

      // WITH_NOTHING gets nothing at all, deliberately.
    });

    it("consentMany matches consent, including the athlete with no row", async () => {
      const batched = await repo.consentMany(PROGRAM, ALL);
      for (const id of ALL) {
        expect(batched.get(id), id).toEqual(await repo.consent(PROGRAM, id));
      }
      // And the default is the same default: not granted, sequence zero.
      expect(batched.get(WITH_NOTHING)).toEqual({ granted: false, decisionSeq: 0 });
    });

    it("currentAvailabilityMany matches currentAvailability, newest row and all", async () => {
      const batched = await repo.currentAvailabilityMany(PROGRAM, ALL);
      for (const id of ALL) {
        const single = await repo.currentAvailability(PROGRAM, id);
        expect(batched.get(id) ?? null, id).toEqual(single);
      }
      expect(batched.get(WITH_EVERYTHING)?.status).toBe("limited");
      expect(batched.has(WITH_NOTHING)).toBe(false);
    });

    it("medicalNotesMany matches medicalNotes, order included", async () => {
      const client = await pool.connect();
      try {
        for (const body of ["older note", "newer note"]) {
          await client.query(
            `INSERT INTO aforce_athlete_medical_notes
               (program_id, subject_user_id, body, author_user_id, created_at)
             VALUES ($1, $2, $3, $4, now() + ($5 || ' seconds')::interval)`,
            [PROGRAM, WITH_EVERYTHING, body, TRAINER_A, body === "older note" ? "0" : "1"],
          );
        }
      } finally {
        client.release();
      }

      const batched = await repo.medicalNotesMany(PROGRAM, ALL);
      for (const id of ALL) {
        expect(batched.get(id), id).toEqual(await repo.medicalNotes(PROGRAM, id));
      }
      // Newest first, which the board depends on.
      expect(batched.get(WITH_EVERYTHING)?.map((n) => n.body)).toEqual([
        "newer note",
        "older note",
      ]);
      expect(batched.get(WITH_NOTHING)).toEqual([]);
    });

    it("an empty id list returns empty maps without touching the database", async () => {
      expect((await repo.consentMany(PROGRAM, [])).size).toBe(0);
      expect((await repo.currentAvailabilityMany(PROGRAM, [])).size).toBe(0);
      expect((await repo.medicalNotesMany(PROGRAM, [])).size).toBe(0);
    });

    it("never returns an athlete that was not asked for", async () => {
      // A batch that leaked a neighbouring athlete's row would be a
      // cross-athlete disclosure, not just a bug.
      const batched = await repo.consentMany(PROGRAM, [WITH_EVERYTHING]);
      expect([...batched.keys()]).toEqual([WITH_EVERYTHING]);

      const avail = await repo.currentAvailabilityMany(PROGRAM, [WITH_SOME]);
      expect([...avail.keys()]).toEqual([]);
    });
  });

  // ─── The access log ─────────────────────────────────────────────────────

  describe("the access log is append-only and answers both questions", () => {
    const entry = (over: Partial<Parameters<typeof repo.logAccess>[0]> = {}) => ({
      actorUserId: TRAINER_A,
      subjectUserId: ATHLETE,
      programId: PROGRAM,
      actorRole: "athletic_trainer",
      resource: "medical_note",
      action: "read",
      fields: ["subjective"],
      redactionLevel: "clinical",
      consentDecisionSeq: 3,
      requestId: "req_1",
      route: "/x",
      ...over,
    });

    it("writes a row that reads back with every column intact", async () => {
      await repo.logAccess(entry());
      const trail = await repo.accessTrail(PROGRAM, ATHLETE);
      expect(trail).toHaveLength(1);
      expect(trail[0]).toMatchObject({
        actorUserId: TRAINER_A,
        actorRole: "athletic_trainer",
        resource: "medical_note",
        action: "read",
      });
    });

    it("writes many as one insert, preserving every row", async () => {
      await repo.logAccessMany([
        entry({ resource: "availability_report" }),
        entry({ resource: "availability_report", actorUserId: TRAINER_B }),
        entry({ resource: "availability_report", action: "amend" }),
      ]);
      expect(await repo.accessTrail(PROGRAM, ATHLETE)).toHaveLength(3);
    });

    it("an empty batch writes nothing rather than failing", async () => {
      await repo.logAccessMany([]);
      expect(await repo.accessTrail(PROGRAM, ATHLETE)).toEqual([]);
    });

    it("stores the consent decision sequence, so a read is provable after the fact", async () => {
      await repo.logAccess(entry({ consentDecisionSeq: 42 }));
      const client = await pool.connect();
      try {
        const { rows } = await client.query(
          "SELECT consent_decision_seq FROM aforce_medical_access_log WHERE program_id = $1",
          [PROGRAM],
        );
        expect((rows[0] as { consent_decision_seq: number }).consent_decision_seq).toBe(42);
      } finally {
        client.release();
      }
    });
  });
});
