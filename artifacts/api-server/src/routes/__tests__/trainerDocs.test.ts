/**
 * Phase 4 acceptance suite — screening and documentation.
 *
 * The criteria, from `docs/TRAINER-DASHBOARD-BRIEF.md`:
 *
 *   "a note takes under 60 seconds to file from a phone, versions are
 *    immutable, and a full athlete chart exports to PDF with an audit trail
 *    attached."
 *
 * Two of those three are decidable here. Immutability is proven by amending a
 * note and showing the prior version is byte-identical afterwards, and the
 * export is parsed back out of the response to prove it is a real PDF that
 * contains the audit trail. The 60-second claim is a device measurement and
 * is NOT tested — see the phase report.
 *
 * Same harness as the Phase 1 suite: a real HTTP server, a fake repo, no
 * Postgres and no new dependency.
 */
import express, { type Express } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { MedicalAccessEntry, SoapNoteEntry, TrainerDocsRepo, TrainerRepo } from "@workspace/db";
import { setFlag } from "../../config/featureFlags";
import { buildTrainerDocsRouter } from "../trainerDocs";

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

interface State {
  notes: SoapNoteEntry[];
  nextId: number;
  questionnaires: { forDate: string; answers: Record<string, number>; submittedAt: string }[];
  screenings: {
    id: number;
    items: Record<string, boolean>;
    notes: string | null;
    cleared: boolean;
    screenedByUserId: string;
    screenedAt: string;
  }[];
  log: MedicalAccessEntry[];
  sessions: {
    id: number;
    sessionDate: string;
    rpe: number;
    durationMin: number;
    sessionType: string | null;
    enteredByUserId: string;
    createdAt: string;
  }[];
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
      return null;
    },
    async appendAvailability() {},
    async medicalNotes() {
      return [];
    },
    async accessTrail() {
      return [
        {
          actorUserId: TRAINER,
          actorRole: "athletic_trainer",
          resource: "athlete_record",
          action: "read",
          occurredAt: "2026-09-16T08:00:00.000Z",
        },
      ];
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

function fakeDocs(): TrainerDocsRepo {
  return {
    async submitQuestionnaire(sub) {
      const entry = {
        id: 1,
        answers: sub.answers,
        forDate: sub.forDate,
        submittedAt: "2026-09-16T06:30:00.000Z",
      };
      state.questionnaires.push(entry);
      return entry;
    },
    async questionnaires() {
      return state.questionnaires;
    },
    async submitScreening(sub) {
      const entry = {
        id: state.screenings.length + 1,
        items: sub.items,
        notes: sub.notes,
        cleared: sub.cleared,
        screenedByUserId: sub.screenedByUserId,
        screenedAt: "2026-09-16T07:45:00.000Z",
      };
      state.screenings.push(entry);
      return entry;
    },
    async screenings() {
      return state.screenings;
    },
    async fileNote(args) {
      const id = state.nextId++;
      const entry: SoapNoteEntry = {
        id,
        rootId: id,
        version: 1,
        supersedesId: null,
        amendmentReason: null,
        authorUserId: args.authorUserId,
        templateId: args.templateId ?? null,
        createdAt: `2026-09-16T09:0${id}:00.000Z`,
        ...args.fields,
      };
      state.notes.push(entry);
      return entry;
    },
    async amendNote(args) {
      const prior = state.notes.find((n) => n.id === args.noteId);
      if (!prior) return { ok: false as const, reason: "not_found" as const };
      const rootId = prior.rootId;
      const latest = Math.max(...state.notes.filter((n) => n.rootId === rootId).map((n) => n.version));
      const id = state.nextId++;
      const entry: SoapNoteEntry = {
        id,
        rootId,
        version: latest + 1,
        supersedesId: args.noteId,
        amendmentReason: args.amendmentReason,
        authorUserId: args.authorUserId,
        templateId: null,
        createdAt: `2026-09-16T10:0${id}:00.000Z`,
        ...args.fields,
      };
      // Append. The prior row is not touched — that is the property under test.
      state.notes.push(entry);
      return { ok: true as const, entry };
    },
    async noteVersions(_programId, rootId) {
      return state.notes.filter((n) => n.rootId === rootId).sort((a, b) => a.version - b.version);
    },
    async currentNotes() {
      const newest = new Map<number, SoapNoteEntry>();
      for (const n of state.notes) {
        const seen = newest.get(n.rootId);
        if (!seen || n.version > seen.version) newest.set(n.rootId, n);
      }
      return [...newest.values()];
    },
    async allNoteVersions() {
      return [...state.notes].sort((a, b) => a.rootId - b.rootId || a.version - b.version);
    },
    async recordSession(sub) {
      const entry = {
        id: state.sessions.length + 1,
        sessionDate: sub.sessionDate,
        rpe: sub.rpe,
        durationMin: sub.durationMin,
        sessionType: sub.sessionType,
        enteredByUserId: sub.enteredByUserId,
        createdAt: "2026-09-16T11:00:00.000Z",
      };
      state.sessions.push(entry);
      return entry;
    },
    async sessions() {
      return state.sessions;
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
  app.use("/trainer", buildTrainerDocsRouter(fakeRepo(), fakeDocs()));
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
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function getRaw(userId: string | null, path: string) {
  const base = await startAs(userId);
  const res = await fetch(`${base}${path}`);
  return {
    status: res.status,
    contentType: res.headers.get("content-type"),
    disposition: res.headers.get("content-disposition"),
    text: await res.text(),
  };
}

beforeEach(() => {
  state = { notes: [], nextId: 1, questionnaires: [], screenings: [], log: [], sessions: [] };
  setFlag("feature.trainer_api", true);
});

afterAll(async () => {
  serverByIdentity.clear();
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});

const NOTE = {
  subjective: "Reports tightness in the left hamstring after sprints.",
  objective: "Mild tenderness, full range of motion.",
  assessment: "Monitoring, no change to participation today.",
  plan: "Recheck before tomorrow's session.",
};

describe("notes are append-only — versions are immutable", () => {
  it("an amendment adds a version and leaves the prior one byte-identical", async () => {
    const filed = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`, NOTE);
    expect(filed.status).toBe(201);
    expect(filed.body.entry.version).toBe(1);

    const before = structuredClone(state.notes[0]!);

    const amended = await post(TRAINER, `/trainer/programs/${PROGRAM}/notes/1/amend`, {
      ...NOTE,
      assessment: "Revised: reduced participation for tomorrow.",
      amendmentReason: "Reassessed after evening treatment.",
    });
    expect(amended.status).toBe(201);
    expect(amended.body.entry.version).toBe(2);
    expect(amended.body.entry.supersedesId).toBe(1);

    // The original row is untouched, field for field.
    expect(state.notes[0]).toEqual(before);
    expect(state.notes).toHaveLength(2);
  });

  it("refuses an amendment with no reason — a silent revision is the failure mode", async () => {
    await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`, NOTE);
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/notes/1/amend`, {
      ...NOTE,
      amendmentReason: "   ",
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("amendment_requires_reason");
    expect(state.notes).toHaveLength(1);
  });

  it("exposes no update or delete verb on a note", async () => {
    const base = await startAs(TRAINER);
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const res = await fetch(`${base}/trainer/programs/${PROGRAM}/notes/1`, { method });
      expect(res.status).toBe(404);
    }
  });

  it("refuses an empty note", async () => {
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`, {
      subjective: "   ",
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("invalid_note");
  });

  it("records the write in the audit log with field names only", async () => {
    await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`, NOTE);
    const entry = state.log.find((e) => e.resource === "medical_note")!;
    expect(entry.action).toBe("write");
    expect(entry.fields).toEqual(["subjective", "objective", "assessment", "plan"]);
    expect(JSON.stringify(entry)).not.toContain("hamstring");
  });
});

describe("only clinical roles write documentation", () => {
  it("a coach cannot file a note, amend one, or screen", async () => {
    const note = await post(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`, NOTE);
    expect(note.status).toBe(403);

    const amend = await post(COACH, `/trainer/programs/${PROGRAM}/notes/1/amend`, {
      ...NOTE,
      amendmentReason: "x",
    });
    expect(amend.status).toBe(403);

    const screening = await post(
      COACH,
      `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/screening`,
      { items: { cleared_movement: true }, cleared: true },
    );
    expect(screening.status).toBe(403);
  });

  it("a coach cannot read notes or export a chart", async () => {
    const notes = await get(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`);
    expect(notes.status).toBe(403);
    const chart = await get(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/chart.pdf`);
    expect(chart.status).toBe(403);
  });
});

describe("the questionnaire belongs to the athlete", () => {
  it("accepts the athlete's own submission", async () => {
    const res = await post(ATHLETE, `/trainer/programs/${PROGRAM}/questionnaire`, {
      answers: { soreness: 3, sleep: 2, stress: 1, energy: 4, hydration: 3 },
      forDate: "2026-09-16",
    });
    expect(res.status).toBe(201);
    expect(state.questionnaires).toHaveLength(1);
  });

  it("refuses a staff member answering on their behalf", async () => {
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/questionnaire`, {
      answers: { soreness: 3 },
      forDate: "2026-09-16",
    });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("questionnaire_is_athlete_only");
  });

  it("refuses an out-of-range answer or a malformed date", async () => {
    const bad = await post(ATHLETE, `/trainer/programs/${PROGRAM}/questionnaire`, {
      answers: { soreness: 9 },
      forDate: "2026-09-16",
    });
    expect(bad.status).toBe(400);

    const date = await post(ATHLETE, `/trainer/programs/${PROGRAM}/questionnaire`, {
      answers: { soreness: 3 },
      forDate: "16/09/2026",
    });
    expect(date.status).toBe(400);
  });
});

describe("screening is a human decision, recorded and attributed", () => {
  it("stores the staff member's own conclusion and audits it", async () => {
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/screening`, {
      items: { movement_screen: true, symptom_check: true },
      cleared: false,
      notes: "Holding out of contact work today.",
    });
    expect(res.status).toBe(201);
    expect(res.body.entry.cleared).toBe(false);
    expect(res.body.entry.screenedByUserId).toBe(TRAINER);
    expect(state.log.some((e) => e.resource === "screening" && e.action === "write")).toBe(true);
  });
});

describe("the chart exports to PDF with the audit trail attached", () => {
  it("returns a real PDF containing every note version and the access log", async () => {
    await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`, NOTE);
    await post(TRAINER, `/trainer/programs/${PROGRAM}/notes/1/amend`, {
      ...NOTE,
      assessment: "Revised assessment text.",
      amendmentReason: "Reassessed after treatment.",
    });
    await post(ATHLETE, `/trainer/programs/${PROGRAM}/questionnaire`, {
      answers: { soreness: 3, sleep: 2 },
      forDate: "2026-09-16",
    });

    const res = await getRaw(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/chart.pdf`);

    expect(res.status).toBe(200);
    expect(res.contentType).toBe("application/pdf");
    expect(res.disposition).toContain("attachment");

    // A real document: header, catalog, page tree, xref and terminator.
    expect(res.text.startsWith("%PDF-1.4")).toBe(true);
    expect(res.text).toContain("/Type /Catalog");
    expect(res.text).toContain("/Type /Pages");
    expect(res.text).toContain("startxref");
    expect(res.text.trimEnd().endsWith("%%EOF")).toBe(true);

    // Both versions are in the document, not just the current text.
    expect(res.text).toContain("version 1");
    expect(res.text).toContain("version 2");
    expect(res.text).toContain("Reassessed after treatment.");

    // The audit trail travels with it.
    expect(res.text).toContain("ACCESS AUDIT TRAIL");
    expect(res.text).toContain("athletic_trainer");

    // And the export itself is logged.
    expect(state.log.some((e) => e.resource === "chart_export")).toBe(true);
  });

  it("carries the not-a-diagnosis line", async () => {
    const res = await getRaw(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/chart.pdf`);
    expect(res.text).toContain("not a diagnosis");
  });
});

describe("the surface fails closed", () => {
  it("404s when the flag is off", async () => {
    setFlag("feature.trainer_api", false);
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`, NOTE);
    expect(res.status).toBe(404);
  });

  it("refuses a note write in production with no encryption key", async () => {
    const priorEnv = process.env["NODE_ENV"];
    const priorKey = process.env["MEDICAL_NOTE_ENCRYPTION_KEY"];
    process.env["NODE_ENV"] = "production";
    delete process.env["MEDICAL_NOTE_ENCRYPTION_KEY"];
    try {
      const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`, NOTE);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe("note_encryption_unavailable");
      expect(state.notes).toHaveLength(0);
    } finally {
      process.env["NODE_ENV"] = priorEnv;
      if (priorKey === undefined) delete process.env["MEDICAL_NOTE_ENCRYPTION_KEY"];
      else process.env["MEDICAL_NOTE_ENCRYPTION_KEY"] = priorKey;
    }
  });

  it("refuses the shared dev sentinel", async () => {
    const res = await post("default", `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/notes`, NOTE);
    expect(res.status).toBe(403);
  });
});

describe("training sessions are the load model's input (Phase 5)", () => {
  const SESSION = { sessionDate: "2026-09-16", rpe: 7, durationMin: 90, sessionType: "practice" };

  it("a trainer can record one", async () => {
    const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/sessions`, SESSION);
    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({ rpe: 7, durationMin: 90, enteredByUserId: TRAINER });
  });

  it("strength and performance can record one too — load is their column", async () => {
    const res = await post(STRENGTH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/sessions`, SESSION);
    expect(res.status).toBe(201);
  });

  it("a coach cannot record one, and cannot read the session list", async () => {
    const write = await post(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/sessions`, SESSION);
    expect(write.status).toBe(403);
    const read = await get(COACH, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/sessions`);
    expect(read.status).toBe(403);
    expect(read.body.code).toBe("sessions_not_available_to_role");
  });

  it("refuses an RPE outside 1-10 or a duration outside 1-600", async () => {
    for (const bad of [
      { ...SESSION, rpe: 0 },
      { ...SESSION, rpe: 11 },
      { ...SESSION, rpe: 6.5 },
      { ...SESSION, durationMin: 0 },
      { ...SESSION, durationMin: 601 },
      { ...SESSION, sessionDate: "16/09/2026" },
    ]) {
      const res = await post(TRAINER, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/sessions`, bad);
      expect(res.status).toBe(400);
    }
    expect(state.sessions).toHaveLength(0);
  });

  it("an athlete reads their own sessions and not another athlete's", async () => {
    const own = await get(ATHLETE, `/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/sessions`);
    expect(own.status).toBe(200);
    const other = await get(ATHLETE, `/trainer/programs/${PROGRAM}/athletes/${OTHER_ATHLETE}/sessions`);
    expect(other.status).toBe(404);
  });

  it("exposes no update or delete verb on a session", async () => {
    const base = await startAs(TRAINER);
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const res = await fetch(
        `${base}/trainer/programs/${PROGRAM}/athletes/${ATHLETE}/sessions`,
        { method },
      );
      expect(res.status).toBe(404);
    }
  });
});
