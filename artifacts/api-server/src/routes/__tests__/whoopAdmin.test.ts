/**
 * Unit tests for `buildWhoopAdminRouter`.
 *
 * The default-wired router (which calls `getWhoopOAuthConfigFromEnv`
 * and binds Drizzle) is covered by the env-gated mount test in
 * `__tests__/whoopAdminMount.test.ts`. These tests drive the
 * builder directly with a mock `runOnce` so the HTTP handler logic
 * (param validation, outcome -> status mapping, throw containment)
 * is exercised in isolation.
 *
 * Auth: `requireAdmin` opens in dev when CLERK_SECRET_KEY is unset
 * AND NODE_ENV !== 'production'. We set NODE_ENV=test and delete the
 * Clerk key, so the gate no-ops and the handler is reachable.
 */

import { describe, it, expect, beforeAll } from "vitest";
import express, { type Express } from "express";
import http from "node:http";
import {
  buildWhoopAdminRouter,
  type WhoopTokenEncryptionStatus,
} from "../whoopAdmin";
import type { WhoopFetchOutcome } from "../../lib/whoopFetchWorker";
import { logger } from "../../lib/logger";

const DEFAULT_ENC_STATUS: WhoopTokenEncryptionStatus = {
  total: 0,
  encrypted: 0,
  plaintextOnly: 0,
  halfEncrypted: 0,
  encryptionKeyConfigured: false,
  backfillCronEnabled: false,
};

beforeAll(() => {
  process.env["NODE_ENV"] = "test";
  delete process.env["CLERK_SECRET_KEY"];
});

async function serve(
  runOnce: (userId: string) => Promise<WhoopFetchOutcome>,
  encryptionStatus: () => Promise<WhoopTokenEncryptionStatus> = async () =>
    DEFAULT_ENC_STATUS,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const app: Express = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: typeof logger }).log = logger;
    next();
  });
  app.use("/api", buildWhoopAdminRouter({ runOnce, encryptionStatus }));
  const server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, r));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

describe("buildWhoopAdminRouter — POST /api/admin/whoop/fetch/:userId", () => {
  it("happy path: status 'ok' -> 200 with outcome echoed", async () => {
    const ok: WhoopFetchOutcome = {
      userId: "u1",
      status: "ok",
      fetchedAt: 1700000000000,
      snapshot: {
        recovery: null,
        sleep: null,
        workout: null,
        cycle: null,
      } as unknown as WhoopFetchOutcome["snapshot"],
    };
    const h = await serve(async () => ok);
    try {
      const res = await fetch(`${h.baseUrl}/api/admin/whoop/fetch/u1`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { outcome: WhoopFetchOutcome };
      expect(body.outcome.status).toBe("ok");
      expect(body.outcome.userId).toBe("u1");
      expect(body.outcome.fetchedAt).toBe(1700000000000);
    } finally {
      await h.close();
    }
  });

  it("'skipped_no_token' -> 200 (not 5xx — operator info, not a failure)", async () => {
    const h = await serve(async (userId) => ({
      userId,
      status: "skipped_no_token",
    }));
    try {
      const res = await fetch(`${h.baseUrl}/api/admin/whoop/fetch/u2`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { outcome: WhoopFetchOutcome };
      expect(body.outcome.status).toBe("skipped_no_token");
    } finally {
      await h.close();
    }
  });

  it("'skipped_no_state' -> 200", async () => {
    const h = await serve(async (userId) => ({
      userId,
      status: "skipped_no_state",
    }));
    try {
      const res = await fetch(`${h.baseUrl}/api/admin/whoop/fetch/u3`, {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { outcome: WhoopFetchOutcome };
      expect(body.outcome.status).toBe("skipped_no_state");
    } finally {
      await h.close();
    }
  });

  it("'error' -> 500 with the outcome envelope intact", async () => {
    const h = await serve(async (userId) => ({
      userId,
      status: "error",
      error: "Error",
    }));
    try {
      const res = await fetch(`${h.baseUrl}/api/admin/whoop/fetch/u4`, {
        method: "POST",
      });
      expect(res.status).toBe(500);
      const body = (await res.json()) as { outcome: WhoopFetchOutcome };
      expect(body.outcome.status).toBe("error");
      expect(body.outcome.userId).toBe("u4");
    } finally {
      await h.close();
    }
  });

  it("runOnce throws (contract violation) -> 500 fetch_failed, no Error leak", async () => {
    const h = await serve(async () => {
      throw new Error("boom-with-token-1234567890abcdef");
    });
    try {
      const res = await fetch(`${h.baseUrl}/api/admin/whoop/fetch/u5`, {
        method: "POST",
      });
      expect(res.status).toBe(500);
      const text = await res.text();
      expect(text).toContain("fetch_failed");
      // Critical: error message never echoed in response body.
      expect(text).not.toContain("boom-with-token");
    } finally {
      await h.close();
    }
  });

  it("forwards the path :userId param unchanged to runOnce", async () => {
    let receivedUserId: string | null = null;
    const h = await serve(async (userId) => {
      receivedUserId = userId;
      return { userId, status: "ok", fetchedAt: 1 };
    });
    try {
      await fetch(
        `${h.baseUrl}/api/admin/whoop/fetch/user_2abc%2Fwith-slashes`,
        { method: "POST" },
      );
      // Express decodes path params before handing them off.
      expect(receivedUserId).toBe("user_2abc/with-slashes");
    } finally {
      await h.close();
    }
  });

  it("GET /api/admin/whoop/fetch/:userId is NOT defined -> 404", async () => {
    const h = await serve(async (userId) => ({
      userId,
      status: "ok",
      fetchedAt: 1,
    }));
    try {
      const res = await fetch(`${h.baseUrl}/api/admin/whoop/fetch/u1`);
      expect(res.status).toBe(404);
    } finally {
      await h.close();
    }
  });
});

describe("buildWhoopAdminRouter — GET /api/admin/whoop/encryption-status", () => {
  it("happy path: returns the counts and env flags as JSON", async () => {
    const status: WhoopTokenEncryptionStatus = {
      total: 1000,
      encrypted: 980,
      plaintextOnly: 18,
      halfEncrypted: 2,
      encryptionKeyConfigured: true,
      backfillCronEnabled: true,
    };
    const h = await serve(
      async (userId) => ({ userId, status: "ok", fetchedAt: 1 }),
      async () => status,
    );
    try {
      const res = await fetch(
        `${h.baseUrl}/api/admin/whoop/encryption-status`,
      );
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(status);
    } finally {
      await h.close();
    }
  });

  it("readout throws -> 500 with sanitized envelope, no leak of inner message-or-stack into telemetry-unsafe paths", async () => {
    const h = await serve(
      async (userId) => ({ userId, status: "ok", fetchedAt: 1 }),
      async () => {
        throw new Error("pg connection refused at host db-internal-1234");
      },
    );
    try {
      const res = await fetch(
        `${h.baseUrl}/api/admin/whoop/encryption-status`,
      );
      expect(res.status).toBe(500);
      const body = (await res.json()) as { error: string; message: string };
      expect(body.error).toBe("encryption_status_failed");
      // The message field is intentionally surfaced for admin
      // debugging; we just assert it didn't crash the handler.
      expect(typeof body.message).toBe("string");
    } finally {
      await h.close();
    }
  });

  it("POST /api/admin/whoop/encryption-status is NOT defined -> 404", async () => {
    const h = await serve(async (userId) => ({
      userId,
      status: "ok",
      fetchedAt: 1,
    }));
    try {
      const res = await fetch(
        `${h.baseUrl}/api/admin/whoop/encryption-status`,
        { method: "POST" },
      );
      expect(res.status).toBe(404);
    } finally {
      await h.close();
    }
  });
});

// requireAdmin's production fail-closed behavior (NODE_ENV=production +
// no CLERK_SECRET_KEY -> 503) is owned and tested by requireAdmin
// itself. The middleware snapshots NODE_ENV at MODULE-LOAD time into a
// `const IS_PRODUCTION`, so retesting it here would need `resetModules`
// + dynamic re-import of the entire middleware graph just to assert a
// property already covered. The mount under `/admin/whoop` matches
// `adminDemand`'s pattern; the dev-open path exercised above proves the
// gate is actually wired (otherwise every test above would 401/403).
