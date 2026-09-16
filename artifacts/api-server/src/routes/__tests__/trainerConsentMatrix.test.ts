/**
 * Consent, proven across the WHOLE trainer surface rather than one router.
 *
 * The gate used to live inside `projectAthlete`, so it ran only where that
 * function was called — `routes/trainer.ts`. `trainerDocs`, `trainerRtp` and
 * `trainerReport` disclosed notes, charts and progressions about athletes who
 * had revoked, and the product demonstrated that consent worked while three
 * routers ignored it. `requireAthleteSubject` moved the gate onto the path
 * every router takes; this suite is the statement that it did.
 *
 * TWO PROPERTIES, and the second is the one that matters in a year:
 *
 *   1. With consent revoked, every route declared `gated` refuses with
 *      `athlete_consent_required` and discloses nothing.
 *
 *   2. THE TABLE IS COMPLETE. The `:athleteId` routes are read back out of the
 *      mounted Express stacks and compared against the table below. A route
 *      added later that nobody listed here fails this suite by existing. That
 *      is deliberate: the original defect was not a wrong decision about one
 *      endpoint, it was three endpoints that never faced the question.
 *
 * `gated: false` is not an exemption from consent. It is a claim that the
 * route's refusal is something other than a 403, and each one states which.
 */
import express, { type Express, type IRouter } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

const ROLES: Record<string, string> = {
  [TRAINER]: "athletic_trainer",
  [ATHLETE]: "athlete",
};

const log: MedicalAccessEntry[] = [];

/**
 * Consent is REVOKED for every athlete. That is the whole fixture: the
 * question this file asks is what the surface does once an athlete says stop.
 */
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
      return { granted: false, decisionSeq: 7 };
    },
    async setConsent() {
      return { ok: true as const, state: { granted: false, decisionSeq: 7 } };
    },
    async currentAvailability() {
      return { status: "out", reason: "left hamstring strain", setByUserId: TRAINER, setAt: "2026-09-16T08:00:00.000Z" };
    },
    async appendAvailability() {},
    async medicalNotes() {
      return [{ id: 1, body: "concussion protocol, stage 3", authorUserId: TRAINER, createdAt: "2026-09-16T08:00:00.000Z" }];
    },
    async accessTrail() {
      return [];
    },
    async logAccess(entry) {
      log.push(entry);
    },
  };
}

function fakeDocs(): TrainerDocsRepo {
  const note = {
    id: 1,
    rootId: 1,
    version: 1,
    subjectUserId: ATHLETE,
    authorUserId: TRAINER,
    subjective: "reports posterior thigh pain",
    objective: "antalgic gait",
    assessment: "grade 1 strain",
    plan: "isometrics",
    amendmentReason: null,
    templateId: null,
    createdAt: "2026-09-16T08:00:00.000Z",
  };
  return {
    async submitQuestionnaire() {
      throw new Error("unused");
    },
    async questionnaires() {
      return [];
    },
    async submitScreening() {
      throw new Error("unused");
    },
    async screenings() {
      return [];
    },
    async recordSession() {
      throw new Error("unused");
    },
    async sessions() {
      return [
        {
          id: 1,
          sessionDate: "2026-09-15",
          rpe: 6,
          durationMin: 70,
          sessionType: "field",
          enteredByUserId: TRAINER,
          createdAt: "2026-09-15T18:00:00.000Z",
        },
      ];
    },
    async fileNote() {
      throw new Error("unused");
    },
    async amendNote() {
      throw new Error("unused");
    },
    async noteVersions() {
      return [note];
    },
    async currentNotes() {
      return [note];
    },
    async allNoteVersions() {
      return [note];
    },
  } as unknown as TrainerDocsRepo;
}

function fakeRtp(): TrainerRtpRepo {
  return {
    async createProtocol() {
      throw new Error("unused");
    },
    async protocols() {
      return [];
    },
    async startProgression() {
      throw new Error("unused");
    },
    async progression() {
      return {
        id: 1,
        programId: PROGRAM,
        athleteUserId: ATHLETE,
        protocolId: 1,
        protocolName: "Concussion",
        stages: [{ key: "rest", label: "Symptom-limited activity", description: "Daily activities only" }],
        status: "active",
        startedAt: "2026-09-10T08:00:00.000Z",
        startedByUserId: TRAINER,
      };
    },
    async signoffs() {
      return [];
    },
    async signOff() {
      throw new Error("unused");
    },
    async setStatus() {
      throw new Error("unused");
    },
  } as unknown as TrainerRtpRepo;
}

// ─── The table ────────────────────────────────────────────────────────────
//
// `key` is `METHOD /path` exactly as Express reports it, so the completeness
// check below compares like with like.

interface RouteCase {
  key: string;
  /** Does a revoked athlete make this route refuse with 403? */
  gated: boolean;
  /** Required when `gated` is false: why the refusal is something else. */
  because?: string;
  body?: unknown;
}

const ROUTES: RouteCase[] = [
  // ── Reads. Every one of these returned full content before the fix. ──
  { key: "GET /programs/:programId/athletes/:athleteId/notes", gated: true },
  { key: "GET /programs/:programId/athletes/:athleteId/chart.pdf", gated: true },
  { key: "GET /programs/:programId/athletes/:athleteId/sessions", gated: true },
  { key: "GET /programs/:programId/athletes/:athleteId/rtp", gated: true },

  // ── Not a 403, and each says what it is instead. ──
  {
    key: "GET /programs/:programId/athletes/:athleteId",
    gated: false,
    because:
      "the record COLLAPSES TO IDENTITY rather than erroring, so staff can see " +
      "the roster is incomplete without learning anything (Phase 0 §0b). " +
      "Asserted explicitly below.",
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/availability",
    gated: false,
    because: "documenting care is not disclosing it — see WRITE_PATHS below",
    body: { status: "out" },
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/screening",
    gated: false,
    because: "documenting care is not disclosing it — see WRITE_PATHS below",
    body: { cleared: true, items: {} },
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/notes",
    gated: false,
    because: "documenting care is not disclosing it — see WRITE_PATHS below",
    body: { subjective: "x" },
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/sessions",
    gated: false,
    because: "documenting care is not disclosing it — see WRITE_PATHS below",
    body: { sessionDate: "2026-09-15", rpe: 6, durationMin: 70 },
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/rtp",
    gated: false,
    because: "documenting care is not disclosing it — see WRITE_PATHS below",
    body: { protocolId: 1 },
  },
  {
    key: "POST /programs/:programId/athletes/:athleteId/rtp/signoff",
    gated: false,
    because: "documenting care is not disclosing it — see WRITE_PATHS below",
    body: { stageIndex: 0 },
  },
];

/**
 * WRITE_PATHS — settled, 2026-09-16 founder ruling.
 *
 * Consent gates DISCLOSURE, not documentation. An athlete who revokes does
 * not thereby become unrecorded: a clinician who gave care has a duty to
 * write it down, and refusing the write would destroy a record someone is
 * obliged to keep. Revocation takes effect on the way back out, which is what
 * the gated routes above prove.
 *
 * `docs/TRAINER-DASHBOARD-RULES.md` rule 10 sends clinical-practice and
 * privacy-law questions to the founder rather than to a default, which is how
 * this was decided rather than guessed.
 */

// ─── Harness ──────────────────────────────────────────────────────────────

const servers: http.Server[] = [];

function mount(app: Express, router: IRouter): void {
  app.use("/trainer", router);
}

function buildApp(userId: string): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { userId: string }).userId = userId;
    next();
  });
  const repo = fakeRepo();
  mount(app, buildTrainerRouter(repo));
  mount(app, buildTrainerDocsRouter(repo, fakeDocs()));
  mount(app, buildTrainerRtpRouter(repo, fakeRtp()));
  mount(app, buildTrainerReportRouter(repo));
  return app;
}

let base = "";

beforeAll(async () => {
  setFlag("feature.trainer_api", true);
  const server = http.createServer(buildApp(TRAINER));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  servers.push(server);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  setFlag("feature.trainer_api", false);
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

function concrete(path: string): string {
  return path.replace(":programId", PROGRAM).replace(":athleteId", ATHLETE);
}

async function call(c: RouteCase): Promise<{ status: number; text: string }> {
  const [method, path] = c.key.split(" ") as [string, string];
  const res = await fetch(`${base}/trainer${concrete(path)}`, {
    method,
    headers: method === "POST" ? { "content-type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(c.body ?? {}) : undefined,
  });
  return { status: res.status, text: await res.text() };
}

/** Every `:athleteId` route actually mounted, as `METHOD /path`. */
function mountedAthleteRoutes(): string[] {
  const repo = fakeRepo();
  const routers: IRouter[] = [
    buildTrainerRouter(repo),
    buildTrainerDocsRouter(repo, fakeDocs()),
    buildTrainerRtpRouter(repo, fakeRtp()),
    buildTrainerReportRouter(repo),
  ];
  const found: string[] = [];
  for (const router of routers) {
    const stack = (router as unknown as { stack: unknown[] }).stack;
    for (const layer of stack) {
      const route = (layer as { route?: { path?: unknown; methods?: Record<string, boolean> } }).route;
      const path = route?.path;
      if (typeof path !== "string" || !path.includes(":athleteId")) continue;
      for (const [method, on] of Object.entries(route?.methods ?? {})) {
        if (on) found.push(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  return found.sort();
}

// ─── The suite ────────────────────────────────────────────────────────────

describe("trainer surface — consent applies to every router", () => {
  it("the table covers every mounted :athleteId route, and no phantom ones", () => {
    const mounted = mountedAthleteRoutes();
    const declared = ROUTES.map((r) => r.key).sort();

    // Sanity: introspection actually found something. A silent empty list
    // would make this whole check vacuous.
    expect(mounted.length).toBeGreaterThan(5);

    const undeclared = mounted.filter((k) => !declared.includes(k));
    const stale = declared.filter((k) => !mounted.includes(k));

    expect(
      undeclared,
      "a new :athleteId route was added without deciding its consent behaviour — " +
        "add it to ROUTES with gated:true, or gated:false and a stated reason",
    ).toEqual([]);
    expect(stale, "ROUTES lists a route that is no longer mounted").toEqual([]);
  });

  it("every gated route refuses a revoked athlete, and leaks nothing", async () => {
    for (const c of ROUTES.filter((r) => r.gated)) {
      const { status, text } = await call(c);
      expect(status, c.key).toBe(403);
      expect(text, c.key).toContain("athlete_consent_required");

      // The refusal body must not carry the content it refused.
      for (const leak of ["hamstring", "concussion", "strain", "antalgic", "pain"]) {
        expect(text.toLowerCase(), `${c.key} leaked "${leak}"`).not.toContain(leak);
      }
    }
  });

  it("every ungated route states why it is ungated", () => {
    for (const c of ROUTES.filter((r) => !r.gated)) {
      expect(c.because, `${c.key} is ungated with no stated reason`).toBeTruthy();
    }
  });

  it("the athlete record collapses to identity rather than erroring", async () => {
    const res = await fetch(`${base}/trainer/programs/${PROGRAM}/athletes/${ATHLETE}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { athlete: Record<string, unknown> };

    expect(Object.keys(body.athlete).sort()).toEqual(
      ["athleteUserId", "consentGranted", "displayName", "position"].sort(),
    );
    expect(body.athlete["consentGranted"]).toBe(false);
  });

  /**
   * The subject must be an athlete member of the caller's own program.
   *
   * Eight of these eleven routes never checked. A note or a progression could
   * be filed against an arbitrary user id — a coach, someone in another
   * program, or a string that is nobody — and the row carries the CALLER's
   * program, so it became readable to every clinical member of it, about a
   * subject who can never see or revoke it.
   */
  it.each([
    ["a staff member", TRAINER],
    ["a stranger", "user_nobody_at_all"],
  ])("refuses %s as the subject of every route, with 404", async (_label, subjectId) => {
    for (const c of ROUTES) {
      const [method, path] = c.key.split(" ") as [string, string];
      const res = await fetch(
        `${base}/trainer${path.replace(":programId", PROGRAM).replace(":athleteId", subjectId)}`,
        {
          method,
          headers: method === "POST" ? { "content-type": "application/json" } : undefined,
          body: method === "POST" ? JSON.stringify(c.body ?? {}) : undefined,
        },
      );
      expect(res.status, `${c.key} with subject ${subjectId}`).toBe(404);
      expect(await res.text(), c.key).toContain("athlete_not_found");
    }
  });

  it("a refused read files no audit row claiming a disclosure", async () => {
    log.length = 0;
    await call({ key: "GET /programs/:programId/athletes/:athleteId/notes", gated: true });
    expect(log).toEqual([]);
  });
});
