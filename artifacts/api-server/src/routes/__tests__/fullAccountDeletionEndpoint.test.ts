/**
 * Route and guard behaviour of `POST /account/delete` (SS-04 stage 2).
 *
 * This file proves WHO may call the endpoint and WHEN it runs. What the
 * deletion does to the database is proved against a real PostgreSQL in
 * `lib/db/src/__tests__/accountDeletionExecutor.test.ts`. Neither file
 * substitutes for the other.
 */
import "../../lib/__tests__/_f5Env";
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import express, { type RequestHandler } from "express";
import http from "node:http";
import type { AccountDeletionResult } from "@workspace/db";

const { authHolder } = vi.hoisted(() => ({
  authHolder: {
    value: { userId: null as string | null, sessionClaims: null as unknown },
  },
}));
vi.mock("@clerk/express", () => ({
  getAuth: () => authHolder.value,
}));

import {
  buildAccountDeletionRouter,
  fullAccountDeletionEnabled,
  FULL_DELETION_CONFIRMATION,
  type AccountDeletionDeps,
} from "../accountDeletion";

process.env["NODE_ENV"] = "test";

const USER_A = "user_2aAaAaAaAaAaAaAaAaAaAaAa";
const USER_B = "user_2bBbBbBbBbBbBbBbBbBbBbBb";

const SAVED = {
  clerk: process.env["CLERK_SECRET_KEY"],
  cors: process.env["CORS_ALLOWED_ORIGINS"],
  flag: process.env["ACCOUNT_FULL_DELETION_ENABLED"],
};
const restore = (name: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};
afterAll(() => {
  restore("CLERK_SECRET_KEY", SAVED.clerk);
  restore("CORS_ALLOWED_ORIGINS", SAVED.cors);
  restore("ACCOUNT_FULL_DELETION_ENABLED", SAVED.flag);
});
beforeEach(() => {
  authHolder.value = { userId: null, sessionClaims: null };
  delete process.env["CLERK_SECRET_KEY"];
  delete process.env["CORS_ALLOWED_ORIGINS"];
  delete process.env["ACCOUNT_FULL_DELETION_ENABLED"];
});

const authAs =
  (userId: string): RequestHandler =>
  (req, _res, next) => {
    req.userId = userId;
    next();
  };

const DONE: AccountDeletionResult = {
  purged: { aforce_users: 1, aforce_intake_logs: 4 },
  anonymised: {},
  skippedTables: [],
  accountRowDeleted: true,
};

interface Opts {
  auth?: RequestHandler;
  enabled?: boolean | "env";
  limit?: number;
  run?: ((userId: string) => Promise<AccountDeletionResult>) | null;
}

async function harness(opts: Opts = {}) {
  const deleted: string[] = [];
  const healthCascade: string[] = [];
  const run =
    opts.run === null
      ? undefined
      : (opts.run ??
        (async (userId: string) => {
          deleted.push(userId);
          return DONE;
        }));
  const never = () => {
    throw new Error("the health-data cascade must not run from POST /delete");
  };
  const deps: AccountDeletionDeps = {
    whoopTokenStoreFor: never,
    garminTokenStoreFor: never,
    ouraTokenStoreFor: never,
    stravaTokenStoreFor: never,
    authStateDb: {
      deleteWhoopAuthStates: never,
      deleteGarminAuthStates: never,
      deleteOuraAuthStates: never,
      deleteStravaAuthStates: never,
      clearBiometrics: never,
    },
    healthRecordsRepo: { purgeUser: never },
    runCascadeInTransaction: async (userId) => {
      healthCascade.push(userId);
      return { purged: 0 };
    },
    runFullDeletionInTransaction: run,
    fullDeletionEnabled: opts.enabled === "env" ? undefined : () => opts.enabled ?? true,
    destructiveAuth: opts.auth,
    destructiveRateLimit: opts.limit ? { limit: opts.limit } : undefined,
  };
  const app = express();
  app.use(express.json());
  app.use("/account", buildAccountDeletionRouter(deps));
  const server: http.Server = app.listen(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  const post = (body?: unknown, headers: Record<string, string> = {}, query = "") =>
    fetch(`http://127.0.0.1:${port}/account/delete${query}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    post,
    deleted,
    healthCascade,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

const CONFIRM = { confirm: FULL_DELETION_CONFIRMATION };

describe("POST /account/delete is off unless switched on", () => {
  it("the environment switch is on only for exactly 'true'", () => {
    for (const value of [undefined, "", "1", "TRUE", "yes", "true "]) {
      restore("ACCOUNT_FULL_DELETION_ENABLED", value);
      expect(fullAccountDeletionEnabled(), String(value)).toBe(false);
    }
    process.env["ACCOUNT_FULL_DELETION_ENABLED"] = "true";
    expect(fullAccountDeletionEnabled()).toBe(true);
  });

  it("503s and deletes nothing with the switch unset, even with a valid confirmation", async () => {
    const h = await harness({ auth: authAs(USER_A), enabled: "env" });
    try {
      const res = await h.post(CONFIRM);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "account_deletion_unavailable" });
      expect(h.deleted).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it("503s when no transactional runner is wired, rather than deleting outside a transaction", async () => {
    const h = await harness({ auth: authAs(USER_A), run: null });
    try {
      expect((await h.post(CONFIRM)).status).toBe(503);
    } finally {
      await h.close();
    }
  });
});

describe("POST /account/delete guards", () => {
  it("401s an unauthenticated caller and 503s when Clerk is unconfigured", async () => {
    process.env["CLERK_SECRET_KEY"] = "sk_test_present";
    const h1 = await harness();
    try {
      expect((await h1.post(CONFIRM)).status).toBe(401);
      expect(h1.deleted).toEqual([]);
    } finally {
      await h1.close();
    }
    delete process.env["CLERK_SECRET_KEY"];
    const h2 = await harness();
    try {
      expect((await h2.post(CONFIRM)).status).toBe(503);
      expect(h2.deleted).toEqual([]);
    } finally {
      await h2.close();
    }
  });

  it("403s a cross-origin request without deleting anything", async () => {
    const h = await harness({ auth: authAs(USER_A) });
    try {
      const res = await h.post(CONFIRM, { Origin: "https://evil.example" });
      expect(res.status).toBe(403);
      expect(h.deleted).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it("429s once the bucket is exhausted", async () => {
    const h = await harness({ auth: authAs(USER_A), limit: 1 });
    try {
      expect((await h.post(CONFIRM)).status).toBe(200);
      expect((await h.post(CONFIRM)).status).toBe(429);
      expect(h.deleted).toEqual([USER_A]);
    } finally {
      await h.close();
    }
  });

  it("400s without the exact confirmation and deletes nothing", async () => {
    const h = await harness({ auth: authAs(USER_A), limit: 50 });
    try {
      for (const body of [undefined, {}, { confirm: "delete" }, { confirm: true }, { confirm: "DELETE " }]) {
        const res = await h.post(body);
        expect(res.status, JSON.stringify(body)).toBe(400);
        expect(await res.json()).toEqual({ error: "confirmation_required" });
      }
      expect(h.deleted).toEqual([]);
    } finally {
      await h.close();
    }
  });
});

describe("POST /account/delete behaviour", () => {
  it("deletes only the authenticated caller, whatever the body or query names", async () => {
    const h = await harness({ auth: authAs(USER_A) });
    try {
      const res = await h.post({ ...CONFIRM, userId: USER_B }, {}, `?userId=${USER_B}`);
      expect(res.status).toBe(200);
      expect(h.deleted).toEqual([USER_A]);
    } finally {
      await h.close();
    }
  });

  it("says plainly that sign-in and billing are not handled yet", async () => {
    const h = await harness({ auth: authAs(USER_A) });
    try {
      const res = await h.post(CONFIRM);
      expect(await res.json()).toEqual({
        ok: true,
        status: "deleted",
        accountRowDeleted: true,
        signInAccountDeleted: false,
        subscriptionCancelled: false,
      });
    } finally {
      await h.close();
    }
  });

  it("is idempotent: a repeat call succeeds and reports nothing left", async () => {
    let calls = 0;
    const h = await harness({
      auth: authAs(USER_A),
      run: async () => {
        calls += 1;
        return calls === 1
          ? DONE
          : { purged: {}, anonymised: {}, skippedTables: [], accountRowDeleted: false };
      },
    });
    try {
      expect(((await (await h.post(CONFIRM)).json()) as { accountRowDeleted: boolean }).accountRowDeleted).toBe(true);
      const second = await h.post(CONFIRM);
      expect(second.status).toBe(200);
      expect(((await second.json()) as { accountRowDeleted: boolean }).accountRowDeleted).toBe(false);
    } finally {
      await h.close();
    }
  });

  it("500s without leaking the cause when the transaction fails", async () => {
    const h = await harness({
      auth: authAs(USER_A),
      run: async () => {
        throw new Error("relation \"secret_table\" does not exist");
      },
    });
    try {
      const res = await h.post(CONFIRM);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "account_delete_failed" });
    } finally {
      await h.close();
    }
  });

  it("does not run the separate health-data endpoint's path", async () => {
    const h = await harness({ auth: authAs(USER_A) });
    try {
      await h.post(CONFIRM);
      expect(h.healthCascade).toEqual([]);
    } finally {
      await h.close();
    }
  });
});
