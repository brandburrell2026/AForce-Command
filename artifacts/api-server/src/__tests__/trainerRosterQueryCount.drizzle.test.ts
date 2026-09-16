/**
 * The board's query count must not depend on roster size.
 *
 * It used to: a consent read, an availability read and a notes read per
 * athlete, then one audit INSERT per disclosure. Measured before the change,
 * a 500-athlete board issued 1,902 statements and 49.7 seconds of summed
 * database time, against a pool of 10 shared with checkout, intake and the
 * health checks. One trainer opening the board at 6am could stall unrelated
 * routes.
 *
 * This is the guard, not the benchmark. It runs in the DB lane on every CI
 * run with small rosters, because the property worth defending is not "fast"
 * — it is "CONSTANT". A fan-out reintroduced by a later change shows up here
 * as a slope, whatever the absolute numbers on the machine that runs it.
 *
 * The benchmark that produces the actual figures is
 * `trainerBoardBench.drizzle.test.ts`, run with `pnpm bench:trainer-board`.
 */
import express from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTrainerRepo, db, pool } from "@workspace/db";
import { setFlag } from "../config/featureFlags";
import { buildTrainerRouter } from "../routes/trainer";
import { countQueries } from "./helpers/queryCounter";
import { seedRoster, wipeProgram } from "./helpers/trainerSeed";

const DB = Boolean(process.env["DB_TESTS"]);

const TRAINER = `qc_trainer_${process.pid}`;
const COACH = `qc_coach_${process.pid}`;

/** Small and large enough that a per-athlete query would differ by 60+. */
const SMALL = 5;
const LARGE = 25;

const repo = createTrainerRepo(db);
const programs: string[] = [];

let base = "";
let server: http.Server;

function app(userId: string): express.Express {
  const a = express();
  a.use(express.json());
  a.use((req, _res, next) => {
    (req as unknown as { userId: string }).userId = userId;
    next();
  });
  a.use("/trainer", buildTrainerRouter(repo));
  return a;
}

/** Statements issued by one roster read, excluding transaction control. */
async function statementsFor(programId: string, athletes: number): Promise<number> {
  programs.push(programId);
  await wipeProgram(programId);
  await seedRoster({ programId, athletes, trainerUserId: TRAINER });

  const url = `${base}/trainer/programs/${programId}/roster`;
  await fetch(url); // warm-up, so connection setup is not counted

  const tally = countQueries(pool);
  const res = await fetch(url);
  await res.arrayBuffer();
  tally.stop();

  expect(res.status, `roster read for ${athletes} athletes`).toBe(200);
  return tally.statements;
}

describe.runIf(DB)("the board's cost does not scale with the roster", () => {
  beforeAll(async () => {
    setFlag("feature.trainer_api", true);
    server = http.createServer(app(TRAINER));
    await new Promise<void>((r) => server.listen(0, r));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    setFlag("feature.trainer_api", false);
    await new Promise<void>((r) => server.close(() => r()));
    for (const p of programs) await wipeProgram(p);
  });

  it("issues the same number of statements for 5 athletes and for 25", async () => {
    const small = await statementsFor(`qc_small_${process.pid}`, SMALL);
    const large = await statementsFor(`qc_large_${process.pid}`, LARGE);

    expect(
      large,
      `roster grew ${LARGE / SMALL}x and statements went ${small} -> ${large}. ` +
        "A per-athlete query has been reintroduced; batch it in the repository " +
        "the way consentMany / currentAvailabilityMany / medicalNotesMany do.",
    ).toBe(small);
  });

  it("stays under a hard ceiling, so a new batched read is still a deliberate choice", async () => {
    const count = await statementsFor(`qc_ceiling_${process.pid}`, LARGE);
    // Six, and every one of them named:
    //   1. requireProgramAccess resolves the CALLER's membership
    //   2. the roster's athlete list
    //   3. consentMany
    //   4. currentAvailabilityMany
    //   5. medicalNotesMany            (clinical only)
    //   6. logAccessMany               (one INSERT, only when something
    //                                   medical was disclosed)
    // Raising this is fine when a query is genuinely needed — but it should
    // be a decision someone made, not a number that drifted.
    expect(count).toBeLessThanOrEqual(6);
  });

  it("a coach read skips the notes query rather than fetching and discarding", async () => {
    const program = `qc_coach_${process.pid}`;
    programs.push(program);
    await wipeProgram(program);
    await seedRoster({ programId: program, athletes: LARGE, trainerUserId: TRAINER });

    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO aforce_program_members (program_id, user_id, role, status)
         VALUES ($1, $2, 'coach', 'active')`,
        [program, COACH],
      );
    } finally {
      client.release();
    }

    const coachServer = http.createServer(app(COACH));
    await new Promise<void>((r) => coachServer.listen(0, r));
    const coachBase = `http://127.0.0.1:${(coachServer.address() as AddressInfo).port}`;
    const url = `${coachBase}/trainer/programs/${program}/roster`;

    try {
      await fetch(url);
      const tally = countQueries(pool);
      const res = await fetch(url);
      await res.arrayBuffer();
      tally.stop();

      expect(res.status).toBe(200);
      // A coaching projection discloses nothing medical, so steps 5 and 6
      // above do not happen at all: caller membership, roster, consent,
      // availability. Four, still independent of N.
      expect(tally.statements).toBeLessThanOrEqual(4);
      expect(
        tally.records.some((r) => /aforce_athlete_medical_notes/.test(r.sql)),
        "a coach read must not fetch medical notes at all, not even to discard them",
      ).toBe(false);
    } finally {
      await new Promise<void>((r) => coachServer.close(() => r()));
    }
  });

  it("an empty roster issues no batched reads at all", async () => {
    const count = await statementsFor(`qc_empty_${process.pid}`, 0);
    // Just the membership lookup for the caller and the roster query. The
    // batched reads short-circuit on an empty id list rather than sending
    // `WHERE id = ANY('{}')`.
    expect(count).toBeLessThanOrEqual(2);
  });
});
