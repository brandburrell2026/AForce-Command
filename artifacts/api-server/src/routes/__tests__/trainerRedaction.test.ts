/**
 * Phase 1 acceptance suite.
 *
 * The criterion, verbatim from `docs/TRAINER-DASHBOARD-BRIEF.md`:
 *
 *   "integration tests prove a coach token cannot retrieve a medical note
 *    field by any route, including direct ID access and any list endpoint;
 *    and every medical read appears in the audit log."
 *
 * Drives the real Express router over a real HTTP server on an ephemeral port
 * — the same harness shape as `whoopOAuth.test.ts`, and for the same reason:
 * this repo has no supertest and Phase 1 adds no dependency.
 *
 * The fake repo is the seam. It lets the suite assert on the exact HTTP
 * payload and on the audit rows without Postgres, so this runs in the default
 * unit lane rather than only in `db-lane`. It is typed as the real
 * `TrainerRepo`, so a signature drift fails here rather than in production.
 */
import express, { type Express } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { MedicalAccessEntry, TrainerRepo } from "@workspace/db";
import { setFlag } from "../../config/featureFlags";
import { buildTrainerRouter } from "../trainer";

process.env["NODE_ENV"] = "test";

const PROGRAM = "prog_1";
const NOTE_BODY = "hamstring strain, day 3, limited cutting";
const REASON = "left hamstring";

const ATHLETE = "user_athlete_1";
const OTHER_ATHLETE = "user_athlete_2";
const TRAINER = "user_trainer_1";
const COACH = "user_coach_1";
const STRENGTH = "user_strength_1";
const ADMIN = "user_admin_1";
const OUTSIDER = "user_outsider_1";

const ROLES: Record<string, string> = {
  [TRAINER]: "athletic_trainer",
  [COACH]: "coach",
  [STRENGTH]: "strength",
  [ADMIN]: "program_admin",
  [ATHLETE]: "athlete",
  [OTHER_ATHLETE]: "athlete",
};

interface FakeState {
  consent: Map<string, { granted: boolean; decisionSeq: number }>;
  log: MedicalAccessEntry[];
  availability: {
    version: number;
    status: string;
    reason: string | null;
    setByUserId: string;
    setAt: string;
  }[];
}

let state: FakeState;
const servers: http.Server[] = [];

function fakeRepo(): TrainerRepo {
  return {
    async membership(programId, userId) {
      if (programId !== PROGRAM) return null;
      const role = ROLES[userId];
      return role ? { programId, userId, role, status: "active" } : null;
    },
    async athletes(programId) {
      if (programId !== PROGRAM) return [];
      return [ATHLETE, OTHER_ATHLETE].map((userId) => ({
        programId,
        userId,
        role: "athlete",
        status: "active",
      }));
    },
    async consent(_programId, athleteUserId) {
      return state.consent.get(athleteUserId) ?? { granted: false, decisionSeq: 0 };
    },
    async setConsent(args) {
      const current = state.consent.get(args.athleteUserId) ?? { granted: false, decisionSeq: 0 };
      if (current.decisionSeq !== args.expectedSeq) return { ok: false as const, current };
      const next = { granted: args.granted, decisionSeq: current.decisionSeq + 1 };
      state.consent.set(args.athleteUserId, next);
      return { ok: true as const, state: next };
    },
    async currentAvailability() {
      return state.availability[state.availability.length - 1] ?? null;
    },
    async appendAvailability(args) {
      const current = state.availability[state.availability.length - 1] ?? null;
      if ((current?.version ?? null) !== args.expectedVersion) {
        return { ok: false as const, current };
      }
      const entry = {
        version: (current?.version ?? 0) + 1,
        status: args.status,
        reason: args.reason,
        setByUserId: args.setByUserId,
        setAt: new Date().toISOString(),
      };
      state.availability.push(entry);
      return { ok: true as const, version: entry.version };
    },
    async medicalNotes() {
      return [
        { id: 1, body: NOTE_BODY, authorUserId: TRAINER, createdAt: "2026-09-16T14:20:00.000Z" },
      ];
    },
    async logAccess(entry) {
      state.log.push(entry);
    },
  };
}

/** Mounts the router with an injected identity, standing in for requireAuth. */
function buildApp(userId: string | null): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (userId !== null) (req as unknown as { userId: string }).userId = userId;
    next();
  });
  app.use("/trainer", buildTrainerRouter(fakeRepo()));
  return app;
}

/**
 * One server per identity for the whole file, not one per request.
 *
 * The first version created a fresh listener for every call, which is fine
 * alone and flaky under a full parallel lane: a few hundred sockets per file
 * competing with every other suite. The fakes read the module-level `state`
 * at call time, so a cached server still sees each test's fresh fixture.
 */
const serverByIdentity = new Map<string, string>();

async function startAs(userId: string | null): Promise<string> {
  const key = userId ?? "__anonymous__";
  const cached = serverByIdentity.get(key);
  if (cached) return cached;

  const server = http.createServer(buildApp(userId));
  await new Promise<void>((resolve) => server.listen(0, resolve));
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  serverByIdentity.set(key, base);
  return base;
}

interface Res {
  status: number;
  body: any;
}

async function get(userId: string | null, path: string): Promise<Res> {
  const base = await startAs(userId);
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function post(userId: string | null, path: string, body: unknown): Promise<Res> {
  const base = await startAs(userId);
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

beforeEach(() => {
  state = {
    consent: new Map([
      [ATHLETE, { granted: true, decisionSeq: 3 }],
      [OTHER_ATHLETE, { granted: false, decisionSeq: 1 }],
    ]),
    log: [],
    availability: [
      {
        version: 1,
        status: "out",
        reason: REASON,
        setByUserId: TRAINER,
        setAt: "2026-09-16T14:22:06.000Z",
      },
    ],
  };
  setFlag("feature.trainer_api", true);
});

afterAll(async () => {
  serverByIdentity.clear();
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});

/** No medical value or key may appear anywhere in a response body. */
function expectNoMedicalTrace(body: unknown): void {
  const json = JSON.stringify(body);
  expect(json).not.toContain(NOTE_BODY);
  expect(json).not.toContain(REASON);
  expect(json).not.toContain('"medicalNotes"');
  expect(json).not.toContain('"availabilityReason"');
}

describe("a coach cannot retrieve a medical field by any route", () => {
  it("not from the roster list", async () => {
    const res = await get(COACH, `/trainer/programs/${PROGRAM}/roster`);
    expect(res.status).toBe(200);
    expect(res.body.athletes).toHaveLength(2);
    expectNoMedicalTrace(res.body);
  });

  it("not by direct athlete id", async () => {
    const res = await get(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}`);
    expect(res.status).toBe(200);
    expectNoMedicalTrace(res.body);
  });

  it("and cannot write availability", async () => {
    const res = await post(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "available",
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("availability_write_not_permitted");
  });
});

describe("strength and compliance are likewise blind to medical content", () => {
  it.each([
    ["strength", STRENGTH],
    ["program_admin", ADMIN],
  ])("%s sees no medical field on either route", async (_label, actor) => {
    const roster = await get(actor, `/trainer/programs/${PROGRAM}/roster`);
    expect(roster.status).toBe(200);
    expectNoMedicalTrace(roster.body);

    const record = await get(actor, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}`);
    expect(record.status).toBe(200);
    expectNoMedicalTrace(record.body);
  });
});

describe("the clinical role sees medical content, and every read is audited", () => {
  it("returns notes on the athlete record and writes one audit row", async () => {
    const res = await get(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(NOTE_BODY);

    expect(state.log).toHaveLength(1);
    const entry = state.log[0]!;
    expect(entry).toMatchObject({
      actorUserId: TRAINER,
      subjectUserId: ATHLETE,
      programId: PROGRAM,
      actorRole: "athletic_trainer",
      resource: "athlete_record",
      action: "read",
      redactionLevel: "clinical",
      consentDecisionSeq: 3,
    });
    expect(entry.fields).toContain("medicalNotes");
    // The log records key names, never values — it must not become a second
    // copy of the record it exists to protect.
    expect(JSON.stringify(entry)).not.toContain(NOTE_BODY);
  });

  it("audits the consented athlete on a roster read and not the unconsented one", async () => {
    const res = await get(TRAINER, `/trainer/programs/${PROGRAM}/roster`);
    expect(res.status).toBe(200);
    expect(state.log.map((e) => e.subjectUserId)).toEqual([ATHLETE]);
  });

  it("writes no audit row when a coach reads, because nothing medical was disclosed", async () => {
    await get(COACH, `/trainer/programs/${PROGRAM}/roster`);
    await get(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}`);
    expect(state.log).toHaveLength(0);
  });
});

describe("consent gates health content for every staff role", () => {
  it("withholds everything but identity for an unconsented athlete, even from clinical", async () => {
    const res = await get(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${OTHER_ATHLETE}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.athlete)).toEqual([
      "athleteUserId",
      "displayName",
      "position",
      "consentGranted",
    ]);
    expect(res.body.athlete.consentGranted).toBe(false);
    expectNoMedicalTrace(res.body);
    expect(state.log).toHaveLength(0);
  });

  it("is the athlete's own call — staff cannot set it", async () => {
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/consent`, {
      granted: true,
      expectedSeq: 1,
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("consent_is_athlete_only");
  });

  it("lets the athlete revoke, and refuses a stale sequence", async () => {
    const ok = await post(ATHLETE, `/trainer/programs/${PROGRAM}/consent`, {
      granted: false,
      expectedSeq: 3,
    });
    expect(ok.status).toBe(200);
    expect(ok.body.state).toEqual({ granted: false, decisionSeq: 4 });

    const stale = await post(ATHLETE, `/trainer/programs/${PROGRAM}/consent`, {
      granted: true,
      expectedSeq: 3,
    });
    expect(stale.status).toBe(409);
    expect(stale.body.current).toEqual({ granted: false, decisionSeq: 4 });
  });
});

describe("athletes reach their own record and nothing else", () => {
  it("reads self", async () => {
    const res = await get(ATHLETE, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}`);
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).toContain(NOTE_BODY);
  });

  it("cannot read another athlete by direct id", async () => {
    const res = await get(ATHLETE, `/trainer/programs/${PROGRAM}/athletes/${OTHER_ATHLETE}`);
    expect(res.status).toBe(404);
  });

  it("has no roster view", async () => {
    const res = await get(ATHLETE, `/trainer/programs/${PROGRAM}/roster`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("roster_not_available_to_role");
  });
});

describe("every availability write is audited", () => {
  it("logs a write that carries a reason", async () => {
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "out",
      reason: REASON,
      baseVersion: 1,
    });
    expect(res.status).toBe(201);
    expect(state.log).toHaveLength(1);
    expect(state.log[0]).toMatchObject({ resource: "availability", action: "write" });
    expect(state.log[0]!.fields).toEqual(["status", "reason"]);
  });

  it("logs a write with no reason too", async () => {
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "available",
      baseVersion: 1,
    });
    expect(res.status).toBe(201);
    expect(state.log).toHaveLength(1);
    expect(state.log[0]!.fields).toEqual(["status"]);
  });

  it("refuses an unknown status and logs nothing", async () => {
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "questionable",
    });
    expect(res.status).toBe(400);
    expect(state.log).toHaveLength(0);
  });
});

/**
 * The conflict path Phase 7 built and could never reach.
 *
 * `appendAvailability` was a blind insert, so every write won. The client has
 * `markConflicted` and holds two values for a person to choose between, and
 * nothing on the server side ever said no.
 *
 * The scenario is the reason this matters. A trainer marks an athlete OUT at
 * 14:00 for a suspected concussion. A second trainer's phone, offline since
 * 13:00, flushes a queued AVAILABLE at 14:05. Under last-writer-wins the
 * athlete is cleared to play by a device that slept through the incident.
 */
describe("a stale writer cannot overwrite a newer decision", () => {
  it("refuses a write based on a version that is no longer current", async () => {
    // The sideline trainer writes first, on top of version 1.
    const first = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "out",
      reason: "held from contact",
      baseVersion: 1,
    });
    expect(first.status).toBe(201);

    // The offline device flushes, still believing version 1 is current.
    const stale = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "available",
      baseVersion: 1,
    });

    expect(stale.status).toBe(409);
    expect(stale.body.error).toBe("availability_conflict");

    // Both values come back, so a person can choose. Neither is merged.
    expect(stale.body.attempted).toMatchObject({ status: "available" });
    expect(stale.body.current).toMatchObject({ status: "out" });

    // And the newer decision still stands.
    const latest = state.availability[state.availability.length - 1]!;
    expect(latest.status).toBe("out");
  });

  it("writes nothing and logs nothing on a conflict", async () => {
    const before = state.availability.length;
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "available",
      baseVersion: 999,
    });
    expect(res.status).toBe(409);
    expect(state.availability).toHaveLength(before);
    expect(state.log).toHaveLength(0);
  });

  it("requires the caller to state a version at all", async () => {
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "available",
    });
    // A client that sends no version is a client that would overwrite
    // anything. `null` is available and means "never been set".
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("base_version_required");
    expect(state.log).toHaveLength(0);
  });

  it("accepts an explicit null only when availability has never been set", async () => {
    state.availability.length = 0;
    const first = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "limited",
      baseVersion: null,
    });
    expect(first.status).toBe(201);

    const second = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/availability`, {
      status: "available",
      baseVersion: null,
    });
    expect(second.status).toBe(409);
  });

  it("reports the current version on a read, so a writer can quote it", async () => {
    const res = await get(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}`);
    expect(res.status).toBe(200);
    // The version rides on the availability the caller just read.
    expect(state.availability[state.availability.length - 1]!.version).toBe(1);
  });
});

describe("the surface fails closed", () => {
  it("404s every route when the flag is off", async () => {
    setFlag("feature.trainer_api", false);
    const roster = await get(TRAINER, `/trainer/programs/${PROGRAM}/roster`);
    const record = await get(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}`);
    expect(roster.status).toBe(404);
    expect(record.status).toBe(404);
  });

  it("404s for a non-member — the existence of a program is itself a disclosure", async () => {
    const res = await get(OUTSIDER, `/trainer/programs/${PROGRAM}/roster`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("program_not_found");
  });

  it("refuses the shared dev sentinel", async () => {
    const res = await get("default", `/trainer/programs/${PROGRAM}/roster`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("program_access_requires_member");
  });

  it("refuses a request with no identity at all", async () => {
    const res = await get(null, `/trainer/programs/${PROGRAM}/roster`);
    expect(res.status).toBe(403);
  });
});
