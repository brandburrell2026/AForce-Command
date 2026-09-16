/**
 * Phase 8 acceptance over HTTP — the coach handoff.
 *
 * Proves the export end to end: a coach can fetch it, it reads correctly,
 * and neither the JSON nor the PDF carries anything a reviewer could infer a
 * condition from — including data that exists on the same athletes elsewhere
 * in the system, which is the leak worth testing for.
 */
import express, { type Express } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { MedicalAccessEntry, TrainerRepo } from "@workspace/db";
import { setFlag } from "../../config/featureFlags";
import { buildTrainerReportRouter } from "../trainerReport";

process.env["NODE_ENV"] = "test";

const PROGRAM = "prog_1";
const TRAINER = "user_trainer_1";
const COACH = "user_coach_1";
const STRENGTH = "user_strength_1";
const ADMIN = "user_admin_1";
const ATHLETE = "user_athlete_1";
const OUTSIDER = "user_outsider_1";

const ROLES: Record<string, string> = {
  [TRAINER]: "athletic_trainer",
  [COACH]: "coach",
  [STRENGTH]: "strength",
  [ADMIN]: "program_admin",
  [ATHLETE]: "athlete",
};

/** The athletes on the roster, and the medical context that exists about them. */
const ROSTER = [
  { userId: "athlete_reyes", status: "out", reason: "left hamstring strain" },
  { userId: "athlete_walker", status: "limited", reason: "concussion protocol, stage 3" },
  { userId: "athlete_johnson", status: "available", reason: null },
  { userId: "athlete_cole", status: null, reason: null },
];

let log: MedicalAccessEntry[] = [];
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
      return ROSTER.map((r) => ({
        programId,
        userId: r.userId,
        role: "athlete",
        status: "active",
      }));
    },
    async consent() {
      return { granted: true, decisionSeq: 1 };
    },
    async setConsent() {
      return { ok: true as const, state: { granted: true, decisionSeq: 1 } };
    },
    async currentAvailability(_programId, athleteUserId) {
      const row = ROSTER.find((r) => r.userId === athleteUserId);
      if (!row || row.status === null) return null;
      // The reason EXISTS on the record. The report must not carry it.
      return {
        status: row.status,
        reason: row.reason,
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
    async logAccess(entry) {
      log.push(entry);
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

function buildApp(userId: string | null): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (userId !== null) (req as unknown as { userId: string }).userId = userId;
    next();
  });
  app.use("/trainer", buildTrainerReportRouter(fakeRepo()));
  return app;
}

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

async function get(userId: string | null, path: string) {
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
  log = [];
  setFlag("feature.trainer_api", true);
});

afterAll(async () => {
  serverByIdentity.clear();
  await Promise.all(
    servers.splice(0).map((s) => new Promise<void>((resolve) => s.close(() => resolve()))),
  );
});

describe("a coach can fetch the report and read it correctly", () => {
  it("returns who is in, limited, out and not set", async () => {
    const res = await get(COACH, `/trainer/programs/${PROGRAM}/availability-report`);
    expect(res.status).toBe(200);
    const { report } = JSON.parse(res.text);
    expect(report.counts).toEqual({ available: 1, limited: 1, out: 1, unset: 1, total: 4 });
    expect(report.out[0].athleteUserId).toBe("athlete_reyes");
  });

  it("is available to every staff role", async () => {
    for (const actor of [TRAINER, COACH, STRENGTH, ADMIN]) {
      const res = await get(actor, `/trainer/programs/${PROGRAM}/availability-report`);
      expect(res.status).toBe(200);
    }
  });

  it("is not an athlete-facing surface", async () => {
    const res = await get(ATHLETE, `/trainer/programs/${PROGRAM}/availability-report`);
    expect(res.status).toBe(403);
  });

  it("404s for a non-member and when the flag is off", async () => {
    expect((await get(OUTSIDER, `/trainer/programs/${PROGRAM}/availability-report`)).status).toBe(404);
    setFlag("feature.trainer_api", false);
    expect((await get(COACH, `/trainer/programs/${PROGRAM}/availability-report`)).status).toBe(404);
  });
});

describe("the reason exists on the record and never reaches the report", () => {
  it("is absent from the JSON, though the repository returns it", async () => {
    const res = await get(COACH, `/trainer/programs/${PROGRAM}/availability-report`);
    expect(res.text).not.toContain("hamstring");
    expect(res.text).not.toContain("concussion");
    expect(res.text).not.toContain("protocol");
    expect(res.text).not.toContain("reason");
  });

  it("is absent from the PDF", async () => {
    const res = await get(COACH, `/trainer/programs/${PROGRAM}/availability-report.pdf`);
    expect(res.status).toBe(200);
    expect(res.contentType).toBe("application/pdf");
    expect(res.disposition).toContain("attachment");
    expect(res.text.startsWith("%PDF-1.4")).toBe(true);

    const body = res.text.toLowerCase();
    for (const term of ["hamstring", "concussion", "protocol", "stage", "reason", "injur"]) {
      expect(body).not.toContain(term);
    }
  });

  it("still names every athlete under a status heading", async () => {
    const res = await get(COACH, `/trainer/programs/${PROGRAM}/availability-report.pdf`);
    for (const r of ROSTER) expect(res.text).toContain(r.userId);
    for (const heading of ["AVAILABLE", "LIMITED", "OUT"]) expect(res.text).toContain(heading);
  });

  it("states on the page that it says nothing about why", async () => {
    const res = await get(COACH, `/trainer/programs/${PROGRAM}/availability-report.pdf`);
    expect(res.text).toContain("Availability only");
    expect(res.text).toContain("nothing about why");
  });
});
