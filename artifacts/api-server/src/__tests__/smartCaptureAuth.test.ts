/**
 * Wave-1 P0 invariant: /api/smart-capture must never send user imagery to
 * the external AI processor unauthenticated.
 *
 * Two layers proven here:
 *  1. Middleware order — requireAuth sits BEFORE the rate limiter and
 *     handler on the route stack (introspection; survives refactors that
 *     would silently drop it).
 *  2. Behavior — in a production environment with no auth configured the
 *     route fails CLOSED (5xx/4xx, never 2xx) and the OpenAI client is
 *     never invoked. The mock throws if any completion is attempted.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import http from "node:http";

// aforceState transitively imports the DB package, which throws without
// DATABASE_URL — mock the single constant requireAuth needs so this suite
// runs in the DB-less unit lane (the same pathology that reds the baseline).
vi.mock("../lib/aforceState", () => ({ DEFAULT_USER_ID: "test-default-user" }));

const openaiCalls: unknown[] = [];
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(async (args: unknown) => {
          openaiCalls.push(args);
          throw new Error("OpenAI must not be reachable in this test");
        }),
      },
    },
  },
}));

const ENV_KEYS = ["NODE_ENV", "CLERK_SECRET_KEY"] as const;
let prevEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  prevEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  openaiCalls.length = 0;
  vi.resetModules();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (prevEnv[k] === undefined) delete process.env[k];
    else process.env[k] = prevEnv[k];
  }
});

async function buildApp(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const { default: smartCaptureRouter } = await import("../routes/smartCapture");
  const app = express();
  app.use("/api", smartCaptureRouter);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe("smart-capture auth invariant", () => {
  it("requireAuth is on the route stack before the handler", async () => {
    process.env["NODE_ENV"] = "test";
    const { default: smartCaptureRouter } = await import("../routes/smartCapture");
    const route = (smartCaptureRouter as unknown as {
      stack: { route?: { path: string; stack: { name: string }[] } }[];
    }).stack.find((l) => l.route?.path === "/smart-capture");
    expect(route).toBeDefined();
    const names = route!.route!.stack.map((l) => l.name);
    expect(names[0]).toBe("requireAuth");
  });

  it("production + unauthenticated → fails closed, OpenAI never called", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["CLERK_SECRET_KEY"];
    const { baseUrl, close } = await buildApp();
    try {
      const res = await fetch(`${baseUrl}/api/smart-capture`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: "x".repeat(128) }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400); // 401/503 — never 2xx
      expect(res.ok).toBe(false);
      expect(openaiCalls).toHaveLength(0);
    } finally {
      await close();
    }
  });
});
