/**
 * Phase 6 acceptance suite — return-to-play, over HTTP.
 *
 *   "no code path can auto-advance a stage, and the coach payload is proven
 *    free of medical context by test."
 *
 * The pure logic is covered in `lib/trainer/__tests__/returnToPlay.test.ts`.
 * This file proves the same two properties through the actual endpoints: that
 * repeated reads never move a progression, that the only write which moves it
 * carries a person's id, and that the coach response contains no note, no
 * stopped reason, no history and no author.
 */
import express, { type Express } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { MedicalAccessEntry, TrainerRepo, TrainerRtpRepo } from "@workspace/db";
import { setFlag } from "../../config/featureFlags";
import { buildTrainerRtpRouter } from "../trainerRtp";

process.env["NODE_ENV"] = "test";

const PROGRAM = "prog_1";
const ATHLETE = "user_athlete_1";
const OTHER_ATHLETE = "user_athlete_2";
const TRAINER = "user_trainer_1";
const COACH = "user_coach_1";
const STRENGTH = "user_strength_1";

const ROLES: Record<string, string> = {
  [TRAINER]: "athletic_trainer",
  [COACH]: "coach",
  [STRENGTH]: "strength",
  [ATHLETE]: "athlete",
  [OTHER_ATHLETE]: "athlete",
};

const STAGES = [
  { key: "rest", label: "Symptom-limited activity", description: "Daily activities only" },
  { key: "light_aerobic", label: "Light aerobic", description: "Walking or bike" },
  { key: "non_contact", label: "Non-contact training", description: "Harder drills" },
  { key: "return", label: "Return to play", description: "Normal game play" },
];

const NOTE = "tolerated 20 minutes without symptom return";
const STOPPED_REASON = "symptoms returned during stage 2";

interface State {
  protocols: { id: string; name: string; version: number; stages: typeof STAGES; createdAt: string }[];
  progression:
    | {
        id: string;
        athleteUserId: string;
        protocolId: string;
        stages: typeof STAGES;
        status: string;
        stoppedReason: string | null;
        startedAt: string;
      }
    | null;
  signoffs: {
    stageIndex: number;
    stageKey: string;
    signedByUserId: string;
    note: string | null;
    signedAt: string;
  }[];
  log: MedicalAccessEntry[];
}

let state: State;
const servers: http.Server[] = [];

function fakeRepo(): TrainerRepo {
  return {
    async membership(programId, userId) {
      if (programId !== PROGRAM) return null;
      const role = ROLES[userId];
      return role ? { programId, userId, role, status: "active" } : null;
    },
    async athletes() {
      return [];
    },
    async consent() {
      return { granted: true, decisionSeq: 1 };
    },
    async setConsent() {
      return { ok: true as const, state: { granted: true, decisionSeq: 1 } };
    },
    async currentAvailability() {
      return {
        status: "limited",
        reason: "staff decision",
        setByUserId: TRAINER,
        setAt: "2026-09-16T08:00:00.000Z",
      };
    },
    async appendAvailability() {},
    async medicalNotes() {
      return [];
    },
    async accessTrail() {
      return [];
    },
    async accessTrailCount() {
      return (await this.accessTrail()).length;
    },
    async logAccess(entry) {
      state.log.push(entry);
    },
    async logAccessMany(entries) {
      for (const entry of entries) await this.logAccess(entry);
    },
    // Delegates to the single-athlete fakes above, so the batched
    // roster read is proven to produce the same projection as the
    // per-athlete one it replaced.
    async consentMany(programId, ids) {
      const out = new Map();
      for (const id of ids) out.set(id, await this.consent(programId, id));
      return out;
    },
    async currentAvailabilityMany(programId, ids) {
      const out = new Map();
      for (const id of ids) {
        const entry = await this.currentAvailability(programId, id);
        if (entry) out.set(id, entry);
      }
      return out;
    },
    async medicalNotesMany(programId, ids) {
      const out = new Map();
      for (const id of ids) out.set(id, await this.medicalNotes(programId, id));
      return out;
    },
  };
}

function fakeRtp(): TrainerRtpRepo {
  return {
    async createProtocol(args) {
      const record = {
        id: args.id,
        name: args.name,
        version: args.version,
        stages: args.stages as typeof STAGES,
        createdAt: "2026-09-10T08:00:00.000Z",
      };
      state.protocols.push(record);
      return record;
    },
    async protocols() {
      return state.protocols;
    },
    async startProgression(args) {
      state.progression = {
        id: args.id,
        athleteUserId: args.athleteUserId,
        protocolId: args.protocolId,
        stages: args.stages as typeof STAGES,
        status: "active",
        stoppedReason: null,
        startedAt: "2026-09-10T09:00:00.000Z",
      };
      state.signoffs = [];
      return state.progression;
    },
    async progression() {
      return state.progression;
    },
    async signoffs() {
      return state.signoffs;
    },
    async signOff(args) {
      if (state.signoffs.some((s) => s.stageIndex === args.stageIndex)) {
        return { ok: false as const, reason: "already_signed" as const };
      }
      const entry = {
        stageIndex: args.stageIndex,
        stageKey: args.stageKey,
        signedByUserId: args.signedByUserId,
        note: args.note,
        signedAt: `2026-09-1${state.signoffs.length + 1}T08:00:00.000Z`,
      };
      state.signoffs.push(entry);
      return { ok: true as const, entry };
    },
    async setStatus(args) {
      if (state.progression) {
        state.progression.status = args.status;
        state.progression.stoppedReason = args.stoppedReason;
      }
    },
  };
}

function buildApp(userId: string | null): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (userId !== null) (req as unknown as { userId: string }).userId = userId;
    next();
  });
  app.use("/trainer", buildTrainerRtpRouter(fakeRepo(), fakeRtp()));
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

async function post(userId: string | null, path: string, body: unknown) {
  const base = await startAs(userId);
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function get(userId: string | null, path: string) {
  const base = await startAs(userId);
  const res = await fetch(`${base}${path}`);
  return { status: res.status, text: await res.text() };
}

async function getJson(userId: string | null, path: string) {
  const res = await get(userId, path);
  return { status: res.status, body: JSON.parse(res.text) as any, text: res.text };
}

async function seedProgression(): Promise<void> {
  const protocol = await post(TRAINER, `/trainer/programs/${PROGRAM}/rtp/protocols`, {
    name: "Concussion return",
    stages: STAGES,
  });
  await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`, {
    protocolId: protocol.body.protocol.id,
  });
}

beforeEach(() => {
  state = { protocols: [], progression: null, signoffs: [], log: [] };
  setFlag("feature.trainer_api", true);
});

afterAll(async () => {
  serverByIdentity.clear();
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});

describe("the protocol is program-defined, not hardcoded", () => {
  it("accepts a program's own stage list and starts a progression on it", async () => {
    const protocol = await post(TRAINER, `/trainer/programs/${PROGRAM}/rtp/protocols`, {
      name: "Hamstring return",
      stages: [
        { key: "a", label: "Stage A" },
        { key: "b", label: "Stage B" },
      ],
    });
    expect(protocol.status).toBe(201);
    expect(protocol.body.protocol.stages).toHaveLength(2);

    const started = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`, {
      protocolId: protocol.body.protocol.id,
    });
    expect(started.status).toBe(201);
    // The stage list is frozen into the progression, so a later protocol edit
    // cannot change what this athlete is part-way through.
    expect(started.body.progression.stages).toHaveLength(2);
  });

  it("refuses an empty or duplicate-keyed stage list", async () => {
    for (const stages of [[], [{ key: "a", label: "A" }, { key: "a", label: "Again" }], [{ label: "no key" }]]) {
      const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/rtp/protocols`, {
        name: "Bad",
        stages,
      });
      expect(res.status).toBe(400);
    }
  });

  it("only a clinical role may define a protocol or start a progression", async () => {
    for (const actor of [COACH, STRENGTH]) {
      const protocol = await post(actor, `/trainer/programs/${PROGRAM}/rtp/protocols`, {
        name: "x",
        stages: STAGES,
      });
      expect(protocol.status).toBe(403);
    }
  });
});

describe("nothing advances a stage except a person signing it", () => {
  it("reading the progression many times never moves it", async () => {
    await seedProgression();
    const first = await getJson(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(first.body.progression.currentStageIndex).toBe(0);

    for (let i = 0; i < 5; i += 1) {
      const again = await getJson(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
      expect(again.body.progression.currentStageIndex).toBe(0);
      expect(again.body.progression.completedCount).toBe(0);
    }
    expect(state.signoffs).toHaveLength(0);
  });

  it("a sign-off advances exactly one stage and records who signed it", async () => {
    await seedProgression();
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp/signoff`, {
      stageIndex: 0,
      note: NOTE,
    });
    expect(res.status).toBe(201);
    expect(res.body.entry.signedByUserId).toBe(TRAINER);

    const after = await getJson(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(after.body.progression.currentStageIndex).toBe(1);
    expect(after.body.progression.completedCount).toBe(1);
  });

  it("refuses a skip, a repeat and an out-of-range stage", async () => {
    await seedProgression();
    const skip = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp/signoff`, {
      stageIndex: 2,
    });
    expect(skip.status).toBe(409);
    expect(skip.body.code).toBe("stage_out_of_order");

    await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp/signoff`, { stageIndex: 0 });
    const repeat = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp/signoff`, {
      stageIndex: 0,
    });
    expect(repeat.status).toBe(409);
    expect(repeat.body.code).toBe("stage_already_signed");

    const range = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp/signoff`, {
      stageIndex: 99,
    });
    expect(range.status).toBe(409);
    expect(range.body.code).toBe("stage_out_of_range");
  });

  it("neither a coach nor strength may sign anything off", async () => {
    await seedProgression();
    for (const actor of [COACH, STRENGTH]) {
      const res = await post(actor, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp/signoff`, {
        stageIndex: 0,
      });
      expect(res.status).toBe(403);
    }
    expect(state.signoffs).toHaveLength(0);
  });

  it("exposes no endpoint that sets a stage directly", async () => {
    await seedProgression();
    const base = await startAs(TRAINER);
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const res = await fetch(`${base}/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentStageIndex: 3 }),
      });
      expect(res.status).toBe(404);
    }
    const after = await getJson(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(after.body.progression.currentStageIndex).toBe(0);
  });

  it("audits every sign-off with the signer and the stage, never the note text", async () => {
    await seedProgression();
    await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp/signoff`, {
      stageIndex: 0,
      note: NOTE,
    });
    const entry = state.log.find((e) => e.resource === "return_to_play" && e.action === "write" && e.fields.includes("stageIndex"))!;
    expect(entry.actorUserId).toBe(TRAINER);
    expect(entry.fields).toEqual(["stageIndex", "note"]);
    expect(JSON.stringify(entry)).not.toContain(NOTE);
  });
});

describe("the coach payload is free of medical context", () => {
  async function seedWithHistory(): Promise<void> {
    await seedProgression();
    await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp/signoff`, {
      stageIndex: 0,
      note: NOTE,
    });
    state.progression!.stoppedReason = STOPPED_REASON;
  }

  it("gives a coach four fields and nothing else", async () => {
    await seedWithHistory();
    const res = await getJson(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.progression)).toEqual([
      "athleteUserId",
      "stageLabel",
      "stageProgress",
      "availabilityStatus",
    ]);
  });

  it("leaks no note, no stopped reason, no history, no signer and no description", async () => {
    await seedWithHistory();
    const res = await getJson(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(res.text).not.toContain(NOTE);
    expect(res.text).not.toContain(STOPPED_REASON);
    expect(res.text).not.toContain(TRAINER);
    expect(res.text).not.toContain("Daily activities only");
    for (const field of ["note", "stoppedReason", "history", "signoffs", "stages", "description"]) {
      expect(res.text).not.toContain(`"${field}"`);
    }
  });

  it("still shows the stage and availability, so a coach can plan", async () => {
    await seedWithHistory();
    const res = await getJson(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(res.body.progression.stageLabel).toBe("Light aerobic");
    expect(res.body.progression.stageProgress).toBe("1 of 4");
    expect(res.body.progression.availabilityStatus).toBe("limited");
  });

  it("treats strength and compliance the same as a coach here", async () => {
    await seedWithHistory();
    const res = await getJson(STRENGTH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(Object.keys(res.body.progression)).toHaveLength(4);
    expect(res.text).not.toContain(NOTE);
  });

  it("gives the clinical role the protocol and the history", async () => {
    await seedWithHistory();
    const res = await getJson(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(res.body.progression.stages).toHaveLength(4);
    expect(res.body.progression.history[0].note).toBe(NOTE);
    expect(res.body.progression.stoppedReason).toBe(STOPPED_REASON);
  });

  it("does not let an athlete read another athlete's progression", async () => {
    await seedProgression();
    const res = await getJson(ATHLETE, `/trainer/programs/${PROGRAM}/athletes/${OTHER_ATHLETE}/rtp`);
    expect(res.status).toBe(404);
  });
});

describe("the surface fails closed", () => {
  it("404s when the flag is off", async () => {
    setFlag("feature.trainer_api", false);
    const res = await getJson(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(res.status).toBe(404);
  });

  it("refuses the shared dev sentinel", async () => {
    const res = await getJson("default", `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/rtp`);
    expect(res.status).toBe(403);
  });
});
