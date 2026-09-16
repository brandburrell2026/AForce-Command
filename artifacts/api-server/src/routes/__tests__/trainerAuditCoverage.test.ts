/**
 * Every route that discloses or writes files an audit row.
 *
 * Four routes did not. The amendment wrote nothing — the one operation the
 * append-only note design exists to make defensible. Session reads and writes
 * wrote nothing. And the return-to-play read returned the coach view ABOVE
 * the log call, so every coach and strength read of a progression left no
 * trace at all: the reads most worth tracing, because they are the ones going
 * to someone who may not see why an athlete is on a protocol. Both report
 * exports logged nothing, so an athlete's own "who looked at me" query could
 * not show that they appeared in a roster document someone forwarded.
 *
 * TWO PROPERTIES, and the second is the one that matters in a year:
 *
 *   1. Each route below marked `audited` files at least one row naming the
 *      right subject.
 *
 *   2. THE TABLE IS COMPLETE. Routes are read back out of the mounted Express
 *      stacks and compared against it. A route added later that nobody listed
 *      fails this suite by existing — the original defect was not a wrong
 *      decision about one endpoint, it was four endpoints that never faced
 *      the question.
 *
 * `audited: false` is not an exemption. It is a claim that the access log is
 * the wrong place for that event, and each one says where the right place is.
 */
import express, { type Express, type IRouter } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type {
  MedicalAccessEntry,
  TrainerDocsRepo,
  TrainerRepo,
  TrainerRtpRepo,
} from "@workspace/db";
import { setFlag } from "../../config/featureFlags";
import { buildTrainerRouter } from "../trainer";
import { buildTrainerDocsRouter } from "../trainerDocs";
import { buildTrainerRtpRouter } from "../trainerRtp";
import { buildTrainerReportRouter } from "../trainerReport";

process.env["NODE_ENV"] = "test";

const PROGRAM = "prog_1";
const ATHLETE = "user_athlete_1";
const TRAINER = "user_trainer_1";
const COACH = "user_coach_1";

const ROLES: Record<string, string> = {
  [TRAINER]: "athletic_trainer",
  [COACH]: "coach",
  [ATHLETE]: "athlete",
};

let log: MedicalAccessEntry[] = [];

const STAGES = [
  { key: "rest", label: "Symptom-limited activity", description: "Daily activities only" },
  { key: "light", label: "Light aerobic", description: "Walking or bike" },
];

function fakeRepo(): TrainerRepo {
  return {
    async membership(programId, userId) {
      if (programId !== PROGRAM) return null;
      const role = ROLES[userId];
      return role ? { programId, userId, role, status: "active" } : null;
    },
    async athletes() {
      return [{ programId: PROGRAM, userId: ATHLETE, role: "athlete", status: "active" }];
    },
    async consent() {
      return { granted: true, decisionSeq: 4 };
    },
    async setConsent() {
      return { ok: true as const, state: { granted: true, decisionSeq: 5 } };
    },
    async currentAvailability() {
      return {
        version: 1,
        status: "out",
        reason: "held from contact",
        setByUserId: TRAINER,
        setAt: "2026-09-16T08:00:00.000Z",
      };
    },
    async appendAvailability() {
      return { ok: true as const, version: 2 };
    },
    async medicalNotes() {
      return [{ id: 1, body: "progressing", authorUserId: TRAINER, createdAt: "2026-09-16T08:00:00.000Z" }];
    },
    async accessTrail() {
      return [];
    },
    async logAccess(entry) {
      log.push(entry);
    },
    async logAccessMany(entries) {
      for (const entry of entries) log.push(entry);
    },
  };
}

const NOTE = {
  id: 1,
  rootId: 1,
  version: 1,
  supersedesId: null,
  amendmentReason: null,
  authorUserId: TRAINER,
  templateId: null,
  subjective: "s",
  objective: "o",
  assessment: "a",
  plan: "p",
  createdAt: "2026-09-16T08:00:00.000Z",
};

function fakeDocs(): TrainerDocsRepo {
  return {
    async submitQuestionnaire() {
      return { id: 1, forDate: "2026-09-16", answers: { sleep: 3 }, submittedAt: NOTE.createdAt };
    },
    async questionnaires() {
      return [];
    },
    async submitScreening() {
      return {
        id: 1,
        cleared: true,
        items: {},
        notes: null,
        screenedByUserId: TRAINER,
        screenedAt: NOTE.createdAt,
      };
    },
    async screenings() {
      return [];
    },
    async recordSession() {
      return {
        id: 1,
        sessionDate: "2026-09-15",
        rpe: 6,
        durationMin: 70,
        sessionType: "field",
        enteredByUserId: TRAINER,
        createdAt: NOTE.createdAt,
      };
    },
    async sessions() {
      return [];
    },
    async fileNote() {
      return NOTE;
    },
    async amendNote() {
      return { ok: true as const, entry: { ...NOTE, version: 2 }, subjectUserId: ATHLETE };
    },
    async noteVersions() {
      return [NOTE];
    },
    async currentNotes() {
      return [NOTE];
    },
    async allNoteVersions() {
      return [NOTE];
    },
  } as unknown as TrainerDocsRepo;
}

function fakeRtp(): TrainerRtpRepo {
  const progression = {
    id: 1,
    programId: PROGRAM,
    athleteUserId: ATHLETE,
    protocolId: "proto_1",
    protocolName: "Concussion",
    stages: STAGES,
    status: "active",
    stoppedReason: null,
    startedAt: "2026-09-10T08:00:00.000Z",
    startedByUserId: TRAINER,
  };
  return {
    async createProtocol() {
      return { id: "proto_1", programId: PROGRAM, name: "Concussion", stages: STAGES };
    },
    async protocols() {
      return [{ id: "proto_1", programId: PROGRAM, name: "Concussion", stages: STAGES }];
    },
    async startProgression() {
      return progression;
    },
    async progression() {
      return progression;
    },
    async signoffs() {
      return [];
    },
    async signOff() {
      return {
        ok: true as const,
        entry: {
          id: 1,
          progressionId: 1,
          stageIndex: 0,
          stageKey: "rest",
          signedByUserId: TRAINER,
          note: null,
          signedAt: "2026-09-16T08:00:00.000Z",
        },
      };
    },
    async setStatus() {},
  } as unknown as TrainerRtpRepo;
}

// ─── The table ────────────────────────────────────────────────────────────

interface RouteCase {
  key: string;
  audited: boolean;
  /** Required when `audited` is false: where the event is recorded instead. */
  because?: string;
  as?: string;
  body?: unknown;
  /** Expected subject of the row. Defaults to the athlete. */
  subject?: string;
}

const ROUTES: RouteCase[] = [
  // ── trainer.ts ──
  { key: "GET /programs/:programId/roster", audited: true },
  { key: "GET /programs/:programId/athletes/:athleteId", audited: true },
  {
    key: "POST /programs/:programId/athletes/:athleteId/availability",
    audited: true,
    body: { status: "limited", baseVersion: 1 },
  },
  {
    key: "POST /programs/:programId/consent",
    audited: false,
    because:
      "consent decisions are recorded in aforce_athlete_consent_events, an " +
      "append-only evidence table with its own server-issued sequence. A " +
      "second record in the access log would be a second source of truth.",
    as: ATHLETE,
    body: { granted: true, expectedSeq: 4 },
  },

  // ── trainerDocs.ts ──
  {
    key: "POST /programs/:programId/questionnaire",
    audited: true,
    as: ATHLETE,
    subject: ATHLETE,
    body: { answers: { sleep: 3 }, forDate: "2026-09-16" },
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/screening",
    audited: true,
    body: { cleared: true, items: {} },
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/notes",
    audited: true,
    body: { subjective: "reports soreness" },
  },
  {
    key: "POST /programs/:programId/notes/:noteId/amend",
    audited: true,
    body: { subjective: "corrected", amendmentReason: "wrong side recorded" },
  },
  { key: "GET /programs/:programId/athletes/:athleteId/notes", audited: true },
  { key: "GET /programs/:programId/athletes/:athleteId/chart.pdf", audited: true },
  {
    key: "POST /programs/:programId/athletes/:athleteId/sessions",
    audited: true,
    body: { sessionDate: "2026-09-15", rpe: 6, durationMin: 70 },
  },
  { key: "GET /programs/:programId/athletes/:athleteId/sessions", audited: true },

  // ── trainerRtp.ts ──
  {
    key: "POST /programs/:programId/rtp/protocols",
    audited: false,
    because:
      "a protocol is a program-level TEMPLATE with no subject. This table's " +
      "subject column is not null and its index answers an athlete's 'who " +
      "looked at me', which a protocol definition cannot answer.",
    body: { name: "Concussion", stages: STAGES },
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/rtp",
    audited: true,
    body: { protocolId: "proto_1" },
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/rtp/signoff",
    audited: true,
    body: { stageIndex: 0 },
  },
  { key: "GET /programs/:programId/athletes/:athleteId/rtp", audited: true },

  // ── trainerReport.ts ──
  { key: "GET /programs/:programId/availability-report", audited: true },
  { key: "GET /programs/:programId/availability-report.pdf", audited: true },
];

// ─── Harness ──────────────────────────────────────────────────────────────

const servers: http.Server[] = [];
const baseByIdentity = new Map<string, string>();

function buildApp(userId: string): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { userId: string }).userId = userId;
    next();
  });
  const repo = fakeRepo();
  app.use("/trainer", buildTrainerRouter(repo));
  app.use("/trainer", buildTrainerDocsRouter(repo, fakeDocs()));
  app.use("/trainer", buildTrainerRtpRouter(repo, fakeRtp()));
  app.use("/trainer", buildTrainerReportRouter(repo));
  return app;
}

async function baseFor(userId: string): Promise<string> {
  const cached = baseByIdentity.get(userId);
  if (cached) return cached;
  const server = http.createServer(buildApp(userId));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  servers.push(server);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  baseByIdentity.set(userId, base);
  return base;
}

async function call(c: RouteCase): Promise<number> {
  const [method, path] = c.key.split(" ") as [string, string];
  const base = await baseFor(c.as ?? TRAINER);
  const url = path
    .replace(":programId", PROGRAM)
    .replace(":athleteId", ATHLETE)
    .replace(":noteId", "1");
  const res = await fetch(`${base}${"/trainer"}${url}`, {
    method,
    headers: method === "POST" ? { "content-type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(c.body ?? {}) : undefined,
  });
  return res.status;
}

function mountedRoutes(): string[] {
  const repo = fakeRepo();
  const routers: IRouter[] = [
    buildTrainerRouter(repo),
    buildTrainerDocsRouter(repo, fakeDocs()),
    buildTrainerRtpRouter(repo, fakeRtp()),
    buildTrainerReportRouter(repo),
  ];
  const found: string[] = [];
  for (const router of routers) {
    for (const layer of (router as unknown as { stack: unknown[] }).stack) {
      const route = (layer as { route?: { path?: unknown; methods?: Record<string, boolean> } }).route;
      if (typeof route?.path !== "string") continue;
      for (const [method, on] of Object.entries(route.methods ?? {})) {
        if (on) found.push(`${method.toUpperCase()} ${route.path}`);
      }
    }
  }
  return found.sort();
}

beforeAll(() => setFlag("feature.trainer_api", true));
beforeEach(() => {
  log = [];
});
afterAll(async () => {
  setFlag("feature.trainer_api", false);
  baseByIdentity.clear();
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

// ─── The suite ────────────────────────────────────────────────────────────

describe("the access log covers the whole trainer surface", () => {
  it("the table covers every mounted route, and no phantom ones", () => {
    const mounted = mountedRoutes();
    const declared = ROUTES.map((r) => r.key).sort();

    expect(mounted.length).toBeGreaterThan(15);
    expect(
      mounted.filter((k) => !declared.includes(k)),
      "a route was added without deciding whether it files an audit row — " +
        "add it to ROUTES with audited:true, or audited:false and a stated reason",
    ).toEqual([]);
    expect(declared.filter((k) => !mounted.includes(k)), "ROUTES lists a route that is not mounted").toEqual([]);
  });

  it("every audited route files a row naming the right subject", async () => {
    for (const c of ROUTES.filter((r) => r.audited)) {
      log = [];
      const status = await call(c);
      // Guard against a route that 4xx'd for an unrelated reason and so
      // "passed" by never reaching its own log call.
      expect(status, `${c.key} did not reach its success path`).toBeLessThan(400);
      expect(log.length, `${c.key} filed no audit row`).toBeGreaterThan(0);
      for (const row of log) {
        expect(row.subjectUserId, c.key).toBe(c.subject ?? ATHLETE);
        expect(row.actorUserId, c.key).toBe(c.as ?? TRAINER);
        expect(row.programId, c.key).toBe(PROGRAM);
        expect(row.route, c.key).toBeTruthy();
      }
    }
  });

  it("every unaudited route says where the event is recorded instead", () => {
    for (const c of ROUTES.filter((r) => !r.audited)) {
      expect(c.because, `${c.key} is unaudited with no stated reason`).toBeTruthy();
    }
  });

  /**
   * The specific regression. A coach read the four-field view and the route
   * returned before the log call, so nothing recorded it.
   */
  it("logs a coach's return-to-play read, not only a clinician's", async () => {
    log = [];
    const status = await call({ key: "GET /programs/:programId/athletes/:athleteId/rtp", audited: true, as: COACH });
    expect(status).toBe(200);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      actorUserId: COACH,
      subjectUserId: ATHLETE,
      resource: "return_to_play",
      action: "read",
      redactionLevel: "coaching",
    });
  });

  it("records what the coach actually received, not the fullest view", async () => {
    log = [];
    await call({ key: "GET /programs/:programId/athletes/:athleteId/rtp", audited: true, as: COACH });
    // The four-field coach view, named exactly.
    expect(log[0]!.fields.sort()).toEqual(
      ["athleteUserId", "availabilityStatus", "stageLabel", "stageProgress"].sort(),
    );
    for (const forbidden of ["stages", "signoffs", "stoppedReason", "history"]) {
      expect(log[0]!.fields, forbidden).not.toContain(forbidden);
    }
  });

  it("records the amendment, and says it was an amendment", async () => {
    log = [];
    await call({
      key: "POST /programs/:programId/notes/:noteId/amend",
      audited: true,
      body: { subjective: "corrected", amendmentReason: "wrong side recorded" },
    });
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      resource: "medical_note",
      action: "amend",
      subjectUserId: ATHLETE,
    });
    // The reason lives in the note chain. The log records key names only.
    expect(JSON.stringify(log[0])).not.toContain("wrong side recorded");
  });

  /**
   * A roster-wide export is still an access of every athlete in it. One row
   * with no subject could not answer an athlete's "who looked at me", which
   * is what this table's subject index exists for.
   */
  it.each([
    ["JSON", "GET /programs/:programId/availability-report"],
    ["PDF", "GET /programs/:programId/availability-report.pdf"],
  ])("files one row per athlete for the %s report", async (_label, key) => {
    log = [];
    await call({ key, audited: true });
    expect(log).toHaveLength(1); // one athlete in the fixture
    expect(log[0]!.subjectUserId).toBe(ATHLETE);
    expect(log[0]!.action).toBe("read");
    // Exactly what the report discloses, and nothing it does not.
    expect(log[0]!.fields).toEqual(["displayName", "position", "availability"]);
  });

  it("never puts a value in the fields list, only key names", async () => {
    for (const c of ROUTES.filter((r) => r.audited)) {
      log = [];
      await call(c);
      for (const row of log) {
        for (const field of row.fields) {
          expect(field, `${c.key}: "${field}" looks like a value`).not.toMatch(/\s/);
        }
      }
    }
  });
});
