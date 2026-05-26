/**
 * Integration test for the env-gated WHOOP admin router mount in
 * `routes/index.ts`.
 *
 * Hidden-infra contract: `/api/admin/whoop/*` exists if and only if
 * WHOOP_CLIENT_ID + WHOOP_CLIENT_SECRET + WHOOP_OAUTH_REDIRECT_URI are
 * all set at module-load time. The admin trigger shares the OAuth env
 * gate because the default-wired admin router calls
 * `buildDefaultWhoopFetchDeps` -> `getWhoopOAuthConfigFromEnv()`,
 * which throws on missing env. Mounting unconditionally would either
 * crash at request time or expose a half-configured surface.
 *
 * Strategy mirrors `whoopOAuthMount.test.ts`: drive a real Express app
 * mounted at /api with `routes/index` re-imported under a specific env
 * snapshot via `vi.resetModules()`.
 *
 * Auth: NODE_ENV=test + no CLERK_SECRET_KEY -> `requireAdmin` opens
 * (dev convenience). We're testing the MOUNT gate, not the admin gate.
 * The admin gate has its own coverage in `whoopAdmin.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import type { IRouter } from "express";
import { logger } from "../lib/logger";

process.env["NODE_ENV"] = "test";
delete process.env["CLERK_SECRET_KEY"];

async function buildAppWithEnv(env: Record<string, string | undefined>): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const prev = {
    WHOOP_CLIENT_ID: process.env["WHOOP_CLIENT_ID"],
    WHOOP_CLIENT_SECRET: process.env["WHOOP_CLIENT_SECRET"],
    WHOOP_OAUTH_REDIRECT_URI: process.env["WHOOP_OAUTH_REDIRECT_URI"],
  };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  const mod = (await import("../routes/index")) as { default: IRouter };
  const app: Express = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });
  app.use("/api", mod.default);
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    async close() {
      await new Promise<void>((res) => server.close(() => res()));
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    },
  };
}

let close: (() => Promise<void>) | null = null;
beforeEach(async () => {
  if (close) {
    await close();
    close = null;
  }
});

describe("WHOOP admin router env-gated mount", { timeout: 30_000 }, () => {
  it("all three env vars present -> /api/admin/whoop/fetch/:userId is mounted (not 404)", async () => {
    const h = await buildAppWithEnv({
      WHOOP_CLIENT_ID: "cid",
      WHOOP_CLIENT_SECRET: "secret",
      WHOOP_OAUTH_REDIRECT_URI: "https://example.test/cb",
    });
    close = h.close;
    // No real DB / WHOOP — runOnce will fail downstream when
    // `buildDefaultWhoopFetchDeps` touches Drizzle. The point of THIS
    // test is the mount gate: the route must exist (non-404). We
    // assert "not 404" so the test is robust to whatever the
    // downstream failure mode turns out to be.
    const res = await fetch(`${h.baseUrl}/api/admin/whoop/fetch/test-user`, {
      method: "POST",
    });
    expect(res.status).not.toBe(404);
  });

  it.each([
    {
      label: "WHOOP_CLIENT_ID missing",
      env: {
        WHOOP_CLIENT_ID: undefined,
        WHOOP_CLIENT_SECRET: "secret",
        WHOOP_OAUTH_REDIRECT_URI: "https://example.test/cb",
      },
    },
    {
      label: "WHOOP_CLIENT_SECRET missing",
      env: {
        WHOOP_CLIENT_ID: "cid",
        WHOOP_CLIENT_SECRET: undefined,
        WHOOP_OAUTH_REDIRECT_URI: "https://example.test/cb",
      },
    },
    {
      label: "WHOOP_OAUTH_REDIRECT_URI missing",
      env: {
        WHOOP_CLIENT_ID: "cid",
        WHOOP_CLIENT_SECRET: "secret",
        WHOOP_OAUTH_REDIRECT_URI: undefined,
      },
    },
  ])(
    "$label -> /api/admin/whoop/fetch/:userId 404s (no half-configured surface)",
    async ({ env }) => {
      const h = await buildAppWithEnv(env);
      close = h.close;
      const res = await fetch(
        `${h.baseUrl}/api/admin/whoop/fetch/test-user`,
        { method: "POST" },
      );
      expect(res.status).toBe(404);
    },
  );
});
