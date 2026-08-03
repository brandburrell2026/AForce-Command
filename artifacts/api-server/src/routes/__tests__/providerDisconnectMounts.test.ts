/**
 * MOUNT-WIRING evidence for the F5 disconnect work.
 *
 * `providerKit/disconnect.ts` shipped fully unit-tested and completely
 * unmounted: every production `DELETE /api/{provider}/disconnect` fell
 * through to the legacy `store.clear()`-only branch, so the snapshot
 * purge and provider-side revocation the module implements never ran for
 * a single real user. A green unit suite over an unreachable code path
 * is not evidence of anything. This file exists so that specific failure
 * cannot recur silently.
 *
 * Three things are pinned:
 *
 *   1. `buildProviderDisconnectors` (routes/index.ts) actually returns a
 *      disconnector for all FOUR providers, and each one's revocation
 *      semantics match the documented matrix — proven by DRIVING each
 *      disconnector, not by reading the source.
 *   2. The five destructive routes are mounted on the real `/api` router
 *      WITH the full guard stack in front of the handler.
 *   3. Schema drift guard: the set of per-user provider tables in
 *      `@workspace/db` is exactly the set `accountDeletion.ts` cascades
 *      over. Adding a sync-cursor / sync-state table without extending
 *      the cascade turns this red.
 */
import "../../lib/__tests__/_f5Env";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

process.env["NODE_ENV"] = "test";

// The provider routers are hidden-infra: `routes/index.ts` only mounts
// them when all three of each provider's env vars are present. Set them
// BEFORE importing the module so the mounts we're asserting on exist.
for (const p of ["WHOOP", "GARMIN", "OURA", "STRAVA"]) {
  process.env[`${p}_CLIENT_ID`] = `test_${p}_id`;
  process.env[`${p}_CLIENT_SECRET`] = `test_${p}_secret`;
  process.env[`${p}_OAUTH_REDIRECT_URI`] = `https://example.test/api/${p}/cb`;
}

/* ─── 1. Disconnector wiring ──────────────────────────────────────────────── */

/**
 * Empty-database stand-in. Exactly the four builder chains the real
 * token stores and `createDrizzleProviderUserStateDb` issue when no
 * `*_TOKEN_ENCRYPTION_KEY` is configured:
 *
 *   read()   -> db.select().from(t).where(x).limit(1)      -> []
 *   clear()  -> db.delete(t).where(x)                      -> undefined
 *   snapshot -> db.update(t).set(x).where(y).returning(z)   -> []
 *
 * Hand-written rather than a catch-all Proxy: a Proxy that answers every
 * property makes a typo look like a pass, and it hid a real hang the
 * first time round. We are testing the WIRING (which revoker, which
 * provider key, which flags) — the SQL itself is proven against a real
 * Postgres in
 * `lib/db/src/__integration__/providerCleanup.integration.test.ts`.
 */
function emptyDb(): never {
  return {
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    }),
    delete: () => ({ where: async () => undefined }),
    update: () => ({
      set: () => ({ where: () => ({ returning: async () => [] }) }),
    }),
    execute: async () => ({ rows: [] }),
  } as never;
}

describe("buildProviderDisconnectors — production wiring", () => {
  it("returns a disconnector for all four providers with the documented revocation semantics", async () => {
    const { buildProviderDisconnectors } = await import("../index");
    const disconnectors = buildProviderDisconnectors(emptyDb());

    expect(Object.keys(disconnectors).sort()).toEqual([
      "garmin",
      "oura",
      "strava",
      "whoop",
    ]);

    // No tokens are stored behind the fake db, so a provider WITH a
    // revoker wired reports 'skipped_no_tokens' (nothing to revoke)
    // while Garmin — the only provider with no revoke contract at all —
    // reports 'unsupported'. That difference is only reachable if the
    // revokers and the `revocationSupported: false` flag are actually
    // wired, which is exactly the claim under test.
    const outcomes: Record<string, string> = {};
    for (const [key, d] of Object.entries(disconnectors)) {
      const result = await d.disconnect("user_wiring_probe");
      outcomes[key] = result.revocation.outcome;
      // Provider display name is lowercased to the biometrics blob key.
      expect(result.provider.toLowerCase()).toBe(key);
    }

    expect(outcomes).toEqual({
      whoop: "skipped_no_tokens",
      oura: "skipped_no_tokens",
      strava: "skipped_no_tokens",
      garmin: "unsupported",
    });
  });
});

/* ─── 2. Route mounts + guard stack ───────────────────────────────────────── */

/**
 * Live probes against the REAL `/api` router from `routes/index.ts` —
 * the exact object `app.ts` mounts — rather than express-internal stack
 * introspection (express 5 dropped `layer.regexp`, and counting layers
 * proves a number, not a behavior). Each probe is refused by a guard
 * before the handler runs, so nothing touches a database.
 */
describe("destructive routes are mounted WITH the guard stack in production", () => {
  let baseUrl: string;
  let close: () => Promise<void>;

  const DESTRUCTIVE: Array<[string, string]> = [
    ["DELETE", "/api/whoop/disconnect"],
    ["DELETE", "/api/garmin/disconnect"],
    ["DELETE", "/api/oura/disconnect"],
    ["DELETE", "/api/strava/disconnect"],
    ["POST", "/api/account/delete-health-data"],
  ];

  beforeAll(async () => {
    delete process.env["CLERK_SECRET_KEY"];
    delete process.env["CORS_ALLOWED_ORIGINS"];
    const express = (await import("express")).default;
    const http = await import("node:http");
    const router = (await import("../index")).default;
    const app = express();
    app.use("/api", router);
    const server: http.Server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", () => r()));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
    close = () => new Promise<void>((r) => server.close(() => r()));
  });

  afterAll(async () => {
    await close?.();
  });

  for (const [method, path] of DESTRUCTIVE) {
    it(`${method} ${path} — origin guard is live on the real mount`, async () => {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { Origin: "https://evil.example" },
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: "cross_origin_forbidden" });
    });

    it(`${method} ${path} — requireRealAuth is live (no DEFAULT_USER_ID fallback)`, async () => {
      // No CLERK_SECRET_KEY. Under plain `requireAuth` this would be
      // admitted as the demo user and would DELETE that user's data.
      const res = await fetch(`${baseUrl}${path}`, { method });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: "auth_unavailable" });
    });
  }

  it("the rate limiter is live on the real mount (429 after the bucket drains)", async () => {
    // The limiter runs BEFORE auth, so these all-503 requests still
    // consume tokens — which is the point: unauthenticated floods are
    // shaped. Default bucket is 10/min per IP.
    const statuses: number[] = [];
    for (let i = 0; i < 12; i += 1) {
      const res = await fetch(`${baseUrl}/api/garmin/disconnect`, {
        method: "DELETE",
      });
      statuses.push(res.status);
      void (await res.text());
    }
    // Only two statuses are legal here, and once the bucket drains it
    // stays drained — no interleaving. The exact changeover index
    // depends on how many probes above already spent tokens on this IP,
    // which is not what this test is about.
    expect(new Set(statuses)).toEqual(new Set([503, 429]));
    const firstLimited = statuses.indexOf(429);
    expect(firstLimited).toBeGreaterThan(0);
    expect(firstLimited).toBeLessThanOrEqual(10);
    expect(statuses.slice(0, firstLimited).every((s) => s === 503)).toBe(true);
    expect(statuses.slice(firstLimited).every((s) => s === 429)).toBe(true);
  });

  it("there is no generic /api/disconnect route", async () => {
    const res = await fetch(`${baseUrl}/api/disconnect`, { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

/* ─── 3. Cascade drift guard ──────────────────────────────────────────────── */

describe("account-deletion cascade covers every per-user provider table", () => {
  it("no sync-state / cursor table exists that the cascade would miss", async () => {
    const schema = await import("@workspace/db");
    const providerTables = Object.keys(schema)
      .filter((k) => /^aforce(Whoop|Garmin|Oura|Strava)/.test(k))
      // Drop the inferred row/insert TYPE exports (types are erased, but
      // the value namespace is what we enumerate here).
      .sort();

    // Exactly the tables `routes/accountDeletion.ts` deletes from:
    // four token tables + four auth-state tables. `biometrics` lives on
    // aforce_user_state (cleared separately) and health records are
    // purged via HealthRecordsRepo.
    expect(providerTables).toEqual([
      "aforceGarminAuthStates",
      "aforceGarminTokens",
      "aforceOuraAuthStates",
      "aforceOuraTokens",
      "aforceStravaAuthStates",
      "aforceStravaTokens",
      "aforceWhoopAuthStates",
      "aforceWhoopTokens",
    ]);
  });

  it("no table in the schema advertises a per-user sync cursor", async () => {
    // The fetch sweep paginates with a keyset over
    // aforce_{provider}_tokens.(updated_at, user_id) — the token row IS
    // the cursor, and step 1 of the cascade already deletes it. If a
    // dedicated cursor/sync-state table is ever added, this fails and
    // whoever adds it has to extend the cascade.
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const path = fileURLToPath(
      new URL("../../../../../lib/db/src/schema/aforce.ts", import.meta.url),
    );
    const src = readFileSync(path, "utf8");
    const tableNames = [...src.matchAll(/pgTable\(\s*"([^"]+)"/g)].map(
      (m) => m[1]!,
    );
    const suspicious = tableNames.filter((t) =>
      /cursor|sync_state|checkpoint|watermark|last_sync/.test(t),
    );
    expect(suspicious).toEqual([]);
  });
});
