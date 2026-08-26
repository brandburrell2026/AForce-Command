/**
 * Wave-3 PR7 — real health checks.
 *
 * PROCESS ALIVE (/healthz) is dependency-free; SERVICE READY
 * (/healthz/deep) runs registered checks where a CRITICAL failure
 * (database, critical config) → 503 unready, and a NON-critical failure
 * degrades honestly (200 degraded) — an optional dependency outage must
 * never mark the whole application dead.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import type { Server } from "node:http";

const poolQueryMock = vi.fn();
vi.mock("@workspace/db", () => ({
  pool: { query: (...a: unknown[]) => poolQueryMock(...a) },
  db: {},
}));
vi.mock("../lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

import {
  livenessHandler,
  readinessHandler,
  registerCheck,
  beginDrain,
  __resetChecksForTests,
  __resetDrainForTests,
} from "../health/checks";
import { registerProductionChecks } from "../health/registerChecks";

const ENV_KEYS = ["NODE_ENV", "CLERK_SECRET_KEY", "DATABASE_URL", "REDIS_URL"] as const;
let prevEnv: Record<string, string | undefined> = {};

async function serve(): Promise<{ server: Server; port: number }> {
  const app = express();
  app.get("/healthz", livenessHandler());
  app.get("/healthz/deep", readinessHandler());
  return await new Promise((resolvePromise) => {
    const server = app.listen(0, () => {
      const address = server.address();
      resolvePromise({ server, port: typeof address === "object" && address ? address.port : 0 });
    });
  });
}

async function getJson(port: number, path: string): Promise<{ status: number; body: { status: string; checks?: Array<{ name: string; ok: boolean; critical: boolean }> } }> {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: res.status, body: (await res.json()) as never };
}

beforeEach(() => {
  prevEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env["NODE_ENV"] = "production";
  process.env["CLERK_SECRET_KEY"] = "sk_configured";
  process.env["DATABASE_URL"] = "postgres://test";
  delete process.env["REDIS_URL"];
  poolQueryMock.mockReset();
  __resetChecksForTests();
  __resetDrainForTests();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (prevEnv[k] === undefined) delete process.env[k];
    else process.env[k] = prevEnv[k];
  }
  __resetChecksForTests();
  __resetDrainForTests();
});

describe("PROCESS ALIVE — /healthz", () => {
  it("alive → 200 ok; draining → 503", async () => {
    const { server, port } = await serve();
    try {
      expect(await getJson(port, "/healthz")).toMatchObject({ status: 200, body: { status: "ok" } });
      beginDrain();
      expect(await getJson(port, "/healthz")).toMatchObject({ status: 503, body: { status: "draining" } });
    } finally {
      server.close();
    }
  });
});

describe("SERVICE READY — /healthz/deep", () => {
  it("database available + config present → 200 ok", async () => {
    poolQueryMock.mockResolvedValue({ rows: [{ "?column?": 1 }] });
    registerProductionChecks();
    const { server, port } = await serve();
    try {
      const out = await getJson(port, "/healthz/deep");
      expect(out.status).toBe(200);
      expect(out.body.status).toBe("ok");
      expect(out.body.checks?.find((c) => c.name === "database")?.ok).toBe(true);
    } finally {
      server.close();
    }
  });

  it("database unavailable → 503 unready, database check named", async () => {
    poolQueryMock.mockRejectedValue(new Error("connection refused"));
    registerProductionChecks();
    const { server, port } = await serve();
    try {
      const out = await getJson(port, "/healthz/deep");
      expect(out.status).toBe(503);
      expect(out.body.status).toBe("unready");
      const dbCheck = out.body.checks?.find((c) => c.name === "database");
      expect(dbCheck?.ok).toBe(false);
      expect(dbCheck?.critical).toBe(true);
    } finally {
      server.close();
    }
  });

  it("critical configuration missing (prod without CLERK_SECRET_KEY) → 503 unready", async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });
    delete process.env["CLERK_SECRET_KEY"];
    registerProductionChecks();
    const { server, port } = await serve();
    try {
      const out = await getJson(port, "/healthz/deep");
      expect(out.status).toBe(503);
      expect(out.body.checks?.find((c) => c.name === "critical-config")?.ok).toBe(false);
    } finally {
      server.close();
    }
  });

  it("an OPTIONAL dependency failing → 200 degraded, never dead", async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });
    registerProductionChecks();
    registerCheck({
      name: "optional-provider",
      critical: false,
      run: async () => ({ ok: false, detail: "upstream 503" }),
    });
    const { server, port } = await serve();
    try {
      const out = await getJson(port, "/healthz/deep");
      expect(out.status).toBe(200);
      expect(out.body.status).toBe("degraded");
      expect(out.body.checks?.find((c) => c.name === "optional-provider")?.ok).toBe(false);
    } finally {
      server.close();
    }
  });

  it("draining → 503 regardless of check state", async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });
    registerProductionChecks();
    beginDrain();
    const { server, port } = await serve();
    try {
      const out = await getJson(port, "/healthz/deep");
      expect(out.status).toBe(503);
      expect(out.body.status).toBe("draining");
    } finally {
      server.close();
    }
  });

  it("a check that THROWS is captured as a failed result, not a crashed endpoint", async () => {
    poolQueryMock.mockResolvedValue({ rows: [] });
    registerProductionChecks();
    registerCheck({
      name: "explodes",
      critical: false,
      run: async () => {
        throw new Error("boom");
      },
    });
    const { server, port } = await serve();
    try {
      const out = await getJson(port, "/healthz/deep");
      expect(out.status).toBe(200);
      expect(out.body.checks?.find((c) => c.name === "explodes")?.ok).toBe(false);
    } finally {
      server.close();
    }
  });
});
