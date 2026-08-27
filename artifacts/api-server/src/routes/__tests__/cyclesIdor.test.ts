/**
 * cycles.ts IDOR remediation (security PR, founder-approved 2026-08-27).
 *
 * Proves the fix that made cycles.ts consistent with its already-fixed
 * twin scans.ts: the acting user is the verified Clerk id (req.userId via
 * requireAuth), NEVER the client-supplied x-device-id header. Before this
 * fix, any caller could read/write another device's cycles by spoofing
 * that header — a textbook IDOR (directive §17 zero-tolerance).
 *
 * Harness: the codebase idiom — clerk stubbed via a hoisted holder,
 * router on a real ephemeral express server, driven over fetch. (The
 * shared serveRouter helper only exposes GET without headers, so this
 * file mounts its own tiny app supporting POST + arbitrary headers.)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import http from "node:http";

const { authHolder } = vi.hoisted(() => ({
  authHolder: { value: null as { userId: string | null; sessionClaims: unknown } | null },
}));
vi.mock("@clerk/express", () => ({ getAuth: () => authHolder.value }));

import cyclesRouter from "../cycles";

const ORIGINAL_CLERK_KEY = process.env["CLERK_SECRET_KEY"];
const ORIGINAL_NODE_ENV = process.env["NODE_ENV"];

// The in-memory store persists across tests in a file run and has no
// public reset seam (adding one would be a production change unrelated to
// this security fix). Each test therefore mints its own fresh, real-shaped
// user ids so histories never collide.
let seq = 0;
function freshUsers(): { a: string; b: string } {
  seq += 1;
  const pad = String(seq).padStart(2, "0");
  return { a: `user_2a${pad}AaAaAaAaAaAaAaAaAaAa`, b: `user_2b${pad}BbBbBbBbBbBbBbBbBbBb` };
}

let server: http.Server;
let baseUrl: string;

async function req(
  method: "GET" | "POST",
  path: string,
  opts: { userId?: string | null; headers?: Record<string, string>; body?: unknown } = {},
): Promise<{ status: number; json: any }> {
  authHolder.value =
    opts.userId === undefined ? null : { userId: opts.userId, sessionClaims: null };
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

beforeEach(async () => {
  const app = express();
  app.use(express.json());
  app.use((r, _res, next) => {
    (r as unknown as { log: Console }).log = console;
    next();
  });
  app.use(cyclesRouter);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  baseUrl = `http://127.0.0.1:${addr.port}`;
  // A configured key forces requireAuth down the "verify the session"
  // path (getAuth is stubbed) instead of the dev DEFAULT_USER_ID fallback,
  // so the stubbed session id is the acting identity. Non-production so a
  // missing real Clerk backend never 503s.
  process.env["NODE_ENV"] = "test";
  process.env["CLERK_SECRET_KEY"] = "sk_test_configured";
});

afterEach(async () => {
  authHolder.value = null;
  if (ORIGINAL_CLERK_KEY === undefined) delete process.env["CLERK_SECRET_KEY"];
  else process.env["CLERK_SECRET_KEY"] = ORIGINAL_CLERK_KEY;
  if (ORIGINAL_NODE_ENV === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = ORIGINAL_NODE_ENV;
  await new Promise<void>((r) => server.close(() => r()));
});

describe("cycles IDOR — identity is the verified user, never the x-device-id header", () => {
  it("a written cycle is owned by the SESSION user, not the spoofed x-device-id header", async () => {
    const { a, b } = freshUsers();
    const r = await req("POST", "/cycles", {
      userId: a,
      headers: { "x-device-id": b },
      body: { fluidType: "water", ozAmount: 16 },
    });
    expect(r.status).toBe(201);
    expect(r.json.cycle.deviceId).toBe(a);
    expect(r.json.cycle.deviceId).not.toBe(b);
  });

  it("User A cannot read User B's cycles by spoofing x-device-id", async () => {
    const { a, b } = freshUsers();
    // B writes a cycle as themselves.
    await req("POST", "/cycles", { userId: b, body: { fluidType: "aforce_stick", ozAmount: 12 } });
    // A reads, spoofing B's id in the header — must see A's (empty) history.
    const asA = await req("GET", "/cycles", { userId: a, headers: { "x-device-id": b } });
    expect(asA.status).toBe(200);
    expect(asA.json.cycles).toEqual([]);
    // Sanity: B genuinely has their own cycle.
    const asB = await req("GET", "/cycles", { userId: b });
    expect(asB.json.cycles).toHaveLength(1);
  });

  it("User A cannot write into User B's history by spoofing x-device-id", async () => {
    const { a, b } = freshUsers();
    await req("POST", "/cycles", {
      userId: a,
      headers: { "x-device-id": b },
      body: { fluidType: "water", ozAmount: 8 },
    });
    const asB = await req("GET", "/cycles", { userId: b });
    expect(asB.json.cycles).toEqual([]); // nothing landed in B's history
    const asA = await req("GET", "/cycles", { userId: a });
    expect(asA.json.cycles).toHaveLength(1); // it landed in A's, as it should
  });

  it("the x-device-id header is inert — same session id yields the same history regardless of header", async () => {
    const { a } = freshUsers();
    await req("POST", "/cycles", { userId: a, body: { fluidType: "water", ozAmount: 10 } });
    const withHeader = await req("GET", "/cycles", { userId: a, headers: { "x-device-id": "anything-else" } });
    const withoutHeader = await req("GET", "/cycles", { userId: a });
    expect(withHeader.json.cycles).toEqual(withoutHeader.json.cycles);
    expect(withHeader.json.cycles).toHaveLength(1);
  });
});
