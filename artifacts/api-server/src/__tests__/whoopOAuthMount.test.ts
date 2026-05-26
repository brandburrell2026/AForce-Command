/**
 * Integration test for the env-gated WHOOP OAuth router mount in
 * `routes/index.ts`.
 *
 * The hidden-infra contract: `/api/whoop/oauth/*` exists if and only
 * if all three of WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET, and
 * WHOOP_OAUTH_REDIRECT_URI are set at module-load time. Anything
 * else and the routes 404 — there is no half-configured surface.
 *
 * Strategy: drive a real Express app mounted at /api with the
 * routes/index router that was constructed under specific env. Since
 * `routes/index.ts` reads env at import time, we use vitest's
 * `vi.resetModules()` + dynamic import to load the router twice under
 * different env snapshots in the same process.
 *
 * Coverage:
 *   - all three env vars present -> POST /api/whoop/oauth/start is
 *     reachable (returns 200 with an authorizeUrl)
 *   - one of the three env vars missing -> /api/whoop/oauth/start 404s
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
  // Re-import under the patched env so the conditional mount sees it.
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
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  return {
    baseUrl,
    async close() {
      await new Promise<void>((res) => server.close(() => res()));
      // Restore env so other tests aren't polluted.
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

// The dynamic re-import of `routes/index.ts` pulls in Stripe SDK,
// Clerk, Drizzle, etc. — cold imports under full-suite contention
// can exceed vitest's 5s default. Cold-path tests need more headroom.
describe("WHOOP OAuth router env-gated mount", { timeout: 30_000 }, () => {
  it("all three env vars present -> /api/whoop/oauth/start is mounted (200)", async () => {
    const h = await buildAppWithEnv({
      WHOOP_CLIENT_ID: "cid",
      WHOOP_CLIENT_SECRET: "secret",
      WHOOP_OAUTH_REDIRECT_URI: "https://example.test/cb",
    });
    close = h.close;
    const res = await fetch(`${h.baseUrl}/api/whoop/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { authorizeUrl: string };
    expect(body.authorizeUrl).toContain("api.prod.whoop.com");
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
  ])("$label -> /api/whoop/oauth/start 404s (no half-configured surface)", async ({ env }) => {
    const h = await buildAppWithEnv(env);
    close = h.close;
    const res = await fetch(`${h.baseUrl}/api/whoop/oauth/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(404);
  });
});
