/**
 * Unit tests for requireAuth — the gate that makes unauthorized access to
 * authed routes (e.g. /api/scans) impossible in production.
 *
 * requireAuth captures IS_PRODUCTION from process.env.NODE_ENV at MODULE
 * LOAD time, so each scenario sets NODE_ENV, then re-imports the middleware
 * via vi.resetModules() + dynamic import to get a fresh production/dev gate.
 *
 * Clerk's getAuth() is mocked through a hoisted mutable holder so each test
 * can simulate "no session" vs "valid session" without a real Clerk backend.
 */
import { describe, it, expect, vi, afterAll } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import { DEFAULT_USER_ID } from "../lib/aforceState";

const { authHolder } = vi.hoisted(() => ({
  authHolder: {
    value: { userId: null as string | null, sessionClaims: null as unknown },
  },
}));

vi.mock("@clerk/express", () => ({
  getAuth: () => authHolder.value,
}));

const ORIGINAL_NODE_ENV = process.env["NODE_ENV"];
const ORIGINAL_CLERK_KEY = process.env["CLERK_SECRET_KEY"];

afterAll(() => {
  if (ORIGINAL_NODE_ENV === undefined) delete process.env["NODE_ENV"];
  else process.env["NODE_ENV"] = ORIGINAL_NODE_ENV;
  if (ORIGINAL_CLERK_KEY === undefined) delete process.env["CLERK_SECRET_KEY"];
  else process.env["CLERK_SECRET_KEY"] = ORIGINAL_CLERK_KEY;
});

async function buildProbeApp(
  nodeEnv: string,
  clerkKey: string | undefined,
): Promise<Express> {
  vi.resetModules();
  process.env["NODE_ENV"] = nodeEnv;
  if (clerkKey === undefined) delete process.env["CLERK_SECRET_KEY"];
  else process.env["CLERK_SECRET_KEY"] = clerkKey;
  const { requireAuth } = await import("../middlewares/requireAuth");
  const app = express();
  app.get("/probe", requireAuth, (req, res) => {
    res.json({ userId: req.userId });
  });
  return app;
}

async function probe(
  app: Express,
): Promise<{ status: number; body: { userId?: string; error?: string } }> {
  const server: http.Server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}/probe`);
    const body = (await res.json().catch(() => ({}))) as {
      userId?: string;
      error?: string;
    };
    return { status: res.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("requireAuth — production fail-closed", () => {
  it("returns 503 in production when CLERK_SECRET_KEY is missing (operator misconfig)", async () => {
    authHolder.value = { userId: null, sessionClaims: null };
    const app = await buildProbeApp("production", undefined);
    const { status, body } = await probe(app);
    expect(status).toBe(503);
    expect(body.error).toBe("auth_unavailable");
  });

  it("returns 401 in production when Clerk is configured but there is no session", async () => {
    authHolder.value = { userId: null, sessionClaims: null };
    const app = await buildProbeApp("production", "sk_test_prod");
    const { status, body } = await probe(app);
    expect(status).toBe(401);
    expect(body.error).toBe("Unauthorized");
  });

  it("admits a verified session in production and exposes the real userId", async () => {
    authHolder.value = { userId: "user_real_123", sessionClaims: null };
    const app = await buildProbeApp("production", "sk_test_prod");
    const { status, body } = await probe(app);
    expect(status).toBe(200);
    expect(body.userId).toBe("user_real_123");
  });

  it("prefers sessionClaims.sub over auth.userId when present", async () => {
    authHolder.value = {
      userId: "fallback_id",
      sessionClaims: { sub: "claims_id" },
    };
    const app = await buildProbeApp("production", "sk_test_prod");
    const { body } = await probe(app);
    expect(body.userId).toBe("claims_id");
  });
});

describe("requireAuth — dev convenience fallback", () => {
  it("falls back to the demo user in non-production when no session is present", async () => {
    authHolder.value = { userId: null, sessionClaims: null };
    const app = await buildProbeApp("test", undefined);
    const { status, body } = await probe(app);
    expect(status).toBe(200);
    expect(body.userId).toBe(DEFAULT_USER_ID);
  });
});
