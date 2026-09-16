/**
 * The trainer limiters actually refuse.
 *
 * `rateLimits.ts` skips every limiter when `NODE_ENV === "test"` so suites can
 * hammer endpoints — which means a test written the obvious way proves
 * nothing at all, and the limits could be absent without anything noticing.
 * This file sets `NODE_ENV` to something else and imports the module fresh,
 * so the limiters are live.
 *
 * It also pins the tier dispatch. The tier is chosen from the request rather
 * than declared per route, so that a `.pdf` endpoint added later lands in the
 * export tier without anyone remembering to put it there — and that inference
 * is exactly the kind of thing that quietly stops being true.
 */
import express, { type Express, type RequestHandler } from "express";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const servers: http.Server[] = [];
let trainerRateLimit: RequestHandler;
let priorEnv: string | undefined;

beforeAll(async () => {
  priorEnv = process.env["NODE_ENV"];
  // Anything but "test" — the limiters check for that exact string.
  process.env["NODE_ENV"] = "ratelimit-probe";
  vi.resetModules();
  ({ trainerRateLimit } = await import("../trainerOps"));
});

afterAll(async () => {
  if (priorEnv === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = priorEnv;
  vi.resetModules();
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))));
});

/** One app per case, so each gets its own limiter window and key space. */
async function start(userId: string): Promise<string> {
  const app: Express = express();
  app.use((req, _res, next) => {
    (req as unknown as { userId: string }).userId = userId;
    next();
  });
  app.use(trainerRateLimit);
  app.get("/programs/:p/roster", (_req, res) => res.json({ ok: true }));
  app.get("/programs/:p/athletes/:a/chart.pdf", (_req, res) => res.json({ ok: true }));
  app.get("/programs/:p/availability-report", (_req, res) => res.json({ ok: true }));
  app.post("/programs/:p/athletes/:a/notes", (_req, res) => res.status(201).json({ ok: true }));
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  servers.push(server);
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Hammer a path until it refuses, or give up. Returns when 429 first appears. */
async function firstRefusalAt(
  base: string,
  path: string,
  method: "GET" | "POST",
  ceiling: number,
): Promise<number | null> {
  for (let i = 1; i <= ceiling; i += 1) {
    const res = await fetch(`${base}${path}`, { method });
    if (res.status === 429) return i;
  }
  return null;
}

describe("the trainer limiters refuse, and at the right tier", () => {
  it("refuses an export flood far sooner than a read flood", async () => {
    const base = await start("u_export");
    const exportAt = await firstRefusalAt(base, "/programs/p1/athletes/a1/chart.pdf", "GET", 40);

    expect(exportAt, "the export tier never refused").not.toBeNull();
    // Ten a minute: more than anyone legitimately exports, well below what it
    // takes to hurt a process that holds three copies of a document in heap.
    expect(exportAt).toBe(11);
  });

  it("lets reads through well past the export ceiling", async () => {
    const base = await start("u_read");
    const readAt = await firstRefusalAt(base, "/programs/p1/roster", "GET", 40);
    // 120/min, so 40 consecutive reads must all succeed.
    expect(readAt, "a read was refused inside the export ceiling").toBeNull();
  });

  it("puts the availability report in the export tier, not the read tier", async () => {
    const base = await start("u_report");
    const at = await firstRefusalAt(base, "/programs/p1/availability-report", "GET", 40);
    expect(at).toBe(11);
  });

  it("writes get their own budget, separate from reads", async () => {
    const base = await start("u_write");
    // Exhaust nothing on the read side; go straight at writes. 60/min.
    const at = await firstRefusalAt(base, "/programs/p1/athletes/a1/notes", "POST", 80);
    expect(at).toBe(61);
  });

  it("keys on the user, so one trainer cannot lock out the room", async () => {
    const a = await start("u_room_a");
    const b = await start("u_room_b");
    expect(await firstRefusalAt(a, "/programs/p1/athletes/a1/chart.pdf", "GET", 20)).toBe(11);
    // A different identity, unaffected.
    const res = await fetch(`${b}/programs/p1/athletes/a1/chart.pdf`);
    expect(res.status).toBe(200);
  });

  it("says which tier refused, so a 429 is diagnosable", async () => {
    const base = await start("u_scope");
    let body: unknown = null;
    for (let i = 0; i < 12; i += 1) {
      const res = await fetch(`${base}/programs/p1/athletes/a1/chart.pdf`);
      if (res.status === 429) {
        body = await res.json();
        break;
      }
    }
    expect(body).toMatchObject({ error: "rate_limited", scope: "trainer_export" });
  });
});
