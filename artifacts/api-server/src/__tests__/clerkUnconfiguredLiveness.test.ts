/**
 * LAW — an UNCONFIGURED Clerk never takes the process down.
 *
 * Observed 2026-10-05 on the circle-api staging service: no CLERK_* keys set,
 * `@clerk/express` threw "Publishable key is missing" on every request, so
 * `/api/healthz` answered 500 and Railway's health check killed the deploy.
 *
 * Contract pinned here, with the REAL app:
 *  1. No Clerk keys + NODE_ENV=production → /api/healthz is 200 (liveness is
 *     dependency-free) and an authenticated route is 503 auth_unavailable,
 *     never 500.
 *  2. Secret present but publishable key absent (partial config) → same: the
 *     middleware is not mounted and requireAuth answers 503, never 500.
 *  3. Both keys present → the middleware IS mounted (an unauthenticated member
 *     route is 401, the documented contract).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn(async () => { throw new Error("unreachable"); }) } } },
}));

const ENV_KEYS = ["NODE_ENV", "CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY", "CORS_ALLOWED_ORIGINS"] as const;
let prev: Record<string, string | undefined> = {};

beforeEach(() => {
  prev = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  vi.resetModules();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
});

async function bootApp(env: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  process.env["NODE_ENV"] = "production";
  process.env["CORS_ALLOWED_ORIGINS"] = "https://example.invalid";
  for (const k of ["CLERK_SECRET_KEY", "CLERK_PUBLISHABLE_KEY"] as const) {
    if (env[k] === undefined) delete process.env[k];
    else process.env[k] = env[k];
  }
  vi.resetModules();
  const { default: app } = await import("../app");
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;
  const get = async (path: string) => {
    const res = await fetch(`${base}${path}`);
    let body: unknown = null;
    try { body = await res.json(); } catch { body = null; }
    return { status: res.status, body: body as Record<string, unknown> | null };
  };
  const close = () => new Promise<void>((r) => server.close(() => r()));
  return { get, close };
}

describe("Clerk unconfigured — liveness survives, auth fails closed", () => {
  it("1. no Clerk keys: /api/healthz 200, member route 503 auth_unavailable (never 500)", async () => {
    const { get, close } = await bootApp({});
    try {
      expect((await get("/api/healthz")).status).toBe(200);
      const r = await get("/api/aforce/state");
      expect(r.status).toBe(503);
      expect(r.body?.["error"]).toBe("auth_unavailable");
      expect((await get("/api/concierge/status")).status).toBe(503);
    } finally {
      await close();
    }
  }, 20_000);

  it("2. partial config (secret only): still 200 / 503, never 500", async () => {
    const { get, close } = await bootApp({ CLERK_SECRET_KEY: "NOT-A-KEY-presence-only" });
    try {
      expect((await get("/api/healthz")).status).toBe(200);
      const r = await get("/api/aforce/state");
      expect(r.status).toBe(503);
      expect(r.body?.["error"]).toBe("auth_unavailable");
    } finally {
      await close();
    }
  }, 20_000);

  it("3. fully configured: the middleware is mounted and an anonymous member route is 401", async () => {
    const { get, close } = await bootApp({
      CLERK_SECRET_KEY: "NOT-A-KEY-presence-only",
      CLERK_PUBLISHABLE_KEY: "pk_test_bW91bnQtb3JkZXItbGF3LmludmFsaWQk",
    });
    try {
      expect((await get("/api/healthz")).status).toBe(200);
      expect((await get("/api/aforce/state")).status).toBe(401);
    } finally {
      await close();
    }
  }, 20_000);
});
