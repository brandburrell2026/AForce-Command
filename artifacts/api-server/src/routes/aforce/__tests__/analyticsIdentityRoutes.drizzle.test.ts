/**
 * S1-3 · ANALYTICS IDENTITY ENDPOINTS — real app, real PostgreSQL, db-lane.
 *
 * Boots the REAL `app.ts` and makes real HTTP requests, for the reason
 * `apiErrorContract.test.ts` records: a suite that assembles its own express
 * app proves nothing about production's middleware order. The PR-1 defect
 * (smart-capture answering 500 instead of 401) survived exactly that way.
 *
 * ENV. NODE_ENV is left at 'test' with CLERK_SECRET_KEY unset, so requireAuth
 * grants DEFAULT_USER_ID and the handlers actually execute — which is
 * precisely what lets the sentinel-refusal law below be meaningful rather
 * than hypothetical.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { sql } from "drizzle-orm";
import { db, resolveAnalyticsIdentity, advanceConsent, type Dbx } from "@workspace/db";

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: { chat: { completions: { create: vi.fn(async () => { throw new Error("unreachable"); }) } } },
}));

const DB = Boolean(process.env["DB_TESTS"]);
const dbx = db as unknown as Dbx;
const U = (n: string) => `s1_3_route_${n}`;

async function boot() {
  // Clerk's express middleware throws without a publishable key, which would
  // surface as a 500 from the terminal handler and mask every assertion
  // below. Synthetic non-credentials: a tokenless request resolves signed-out
  // with no network call, and requireAuth then grants DEFAULT_USER_ID below
  // production — which is exactly the condition the sentinel laws need.
  process.env["CLERK_SECRET_KEY"] = "NOT-A-KEY-s1-3-presence-only";
  process.env["CLERK_PUBLISHABLE_KEY"] = "pk_test_czEtMy1pZGVudGl0eS5pbnZhbGlkJA";
  const { default: app } = await import("../../../app");
  const server = http.createServer(app as never);
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  return { base: `http://127.0.0.1:${port}`, close: () => new Promise<void>((r) => server.close(() => r())) };
}

async function call(base: string, path: string, init?: RequestInit) {
  const res = await fetch(base + path, init);
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { json = null; }
  return { status: res.status, json, text };
}

const post = (base: string, p: string, body?: unknown) =>
  call(base, p, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });

async function wipe() {
  await db.execute(sql`delete from aforce_analytics_consent_events where user_id like 's1_3_route_%'`);
  await db.execute(sql`delete from aforce_analytics_consent_state  where user_id like 's1_3_route_%'`);
  await db.execute(sql`delete from aforce_analytics_identities     where user_id like 's1_3_route_%'`);
}
beforeEach(async () => { if (DB) await wipe(); });
afterAll(async () => { if (DB) await wipe(); });

// ── the sentinel refusal ──────────────────────────────────────────────

describe.runIf(DB)("S1-3 · requireMemberIdentity refuses DEFAULT_USER_ID", () => {
  // With CLERK_SECRET_KEY unset below production, requireAuth grants
  // "default" to every caller. On an identity endpoint that would mint ONE
  // pseudonym shared by every developer, preview session and stray curl —
  // and then bind real analytics rows to it.
  it.each([
    ["/api/aforce/analytics-identity/resolve"],
    ["/api/aforce/analytics-identity/rotate"],
    ["/api/aforce/analytics-identity/forget"],
    ["/api/aforce/analytics-consent"],
  ])("%s returns 403 identity_requires_member", async (path) => {
    const app = await boot();
    try {
      const r = await post(app.base, path, { action: "grant", disclosureVersion: 1, expectedSeq: null });
      expect(r.status).toBe(403);
      expect(r.json).toMatchObject({ code: "identity_requires_member" });
    } finally {
      await app.close();
    }
  });

  it("and mints NOTHING for the sentinel", async () => {
    const app = await boot();
    try {
      await post(app.base, "/api/aforce/analytics-identity/resolve");
      const rows = await db.execute(
        sql`select count(*)::int n from aforce_analytics_identities where user_id = 'default'`);
      expect((rows as unknown as { rows: Array<{ n: number }> }).rows[0]!.n).toBe(0);
    } finally {
      await app.close();
    }
  });
});

// ── the writer gates, end to end through the real app ─────────────────

describe.runIf(DB)("S1-3 · all three analytics writers fail closed", () => {
  const ID = "anon_deadbeefdeadbeef_deadbeefdeadbeef";

  it("INGEST · a batch is not stored when the caller has no consented identity", async () => {
    const app = await boot();
    try {
      const before = await db.execute(sql`select count(*)::int n from aforce_analytics_events`);
      const r = await post(app.base, "/api/aforce/analytics", {
        events: [{
          eventId: "evt_s13a_00000001", eventType: "territory_opened", analytics_id: ID,
          occurredAt: new Date().toISOString(), schemaVersion: 1, payload: {},
        }],
      });
      expect(r.status).toBe(200);
      expect(r.json).toMatchObject({ inserted: 0 });
      const after = await db.execute(sql`select count(*)::int n from aforce_analytics_events`);
      const n = (x: unknown) => (x as { rows: Array<{ n: number }> }).rows[0]!.n;
      expect(n(after), "an ungated caller must write nothing").toBe(n(before));
    } finally {
      await app.close();
    }
  });

  it("INGEST · does not leak WHY it refused", async () => {
    // Whether a member exists, revoked, or was suppressed is not something an
    // ingest reply should disclose.
    const app = await boot();
    try {
      const r = await post(app.base, "/api/aforce/analytics", {
        events: [{
          eventId: "evt_s13b_00000001", eventType: "territory_opened", analytics_id: ID,
          occurredAt: new Date().toISOString(), schemaVersion: 1, payload: {},
        }],
      });
      expect(r.status, "must be refused by the GATE, not as a bad body — a 400 " +
        "would also contain none of the words below and pass vacuously").toBe(200);
      expect(r.json).toMatchObject({ inserted: 0 });
      expect(r.text).not.toMatch(/consent|suppress|revoke|identity/i);
    } finally {
      await app.close();
    }
  });

  it("the gate is the SAME function for all three writers — one place decides", async () => {
    // Structural, and behavioural laws for scans/checkout live in their own
    // suites. What this pins is that no writer resolves the id its own way:
    // the header helper must no longer be the source for any of them.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(__dirname, "..", "..", "..");
    for (const f of ["routes/scans.ts", "routes/checkout.ts", "routes/aforce/analytics.ts"]) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src, `${f} must use the shared gate`).toContain("consentedAnalyticsIdForRequest");
      // The old header path must not be how the id is CHOSEN any more.
      expect(
        /const analyticsId = analyticsIdFromHeader\(/.test(src),
        `${f} still derives the analytics id from the client header`,
      ).toBe(false);
    }
  });
});

// ── endpoint contracts ────────────────────────────────────────────────

describe.runIf(DB)("S1-3 · resolve / consent contracts", () => {
  // These drive the repo directly (the sentinel blocks the HTTP path in this
  // env, and that refusal is itself proven above).
  it("resolve is idempotent and reports consent as never-decided", async () => {
    const a = await resolveAnalyticsIdentity(dbx, U("k1"));
    const b = await resolveAnalyticsIdentity(dbx, U("k1"));
    expect(a.analyticsId).toBe(b.analyticsId);
    expect(a.status).toBe("active");
  });

  it("an absent consent row reports decisionSeq null, never 0", async () => {
    // 0 would make the first grant a permanent 409 loop: the CAS matches no
    // row, and the refusal hands back the same 0 that caused it.
    const { readConsent } = await import("@workspace/db");
    expect(await readConsent(dbx, U("k2"))).toBeNull();
  });

  it("a stale expectedSeq is refused and the state is unchanged", async () => {
    await advanceConsent(dbx, { userId: U("k3"), action: "grant", disclosureVersion: 1, expectedSeq: null });
    await advanceConsent(dbx, { userId: U("k3"), action: "revoke", disclosureVersion: 1, expectedSeq: 1 });
    const stale = await advanceConsent(dbx, { userId: U("k3"), action: "grant", disclosureVersion: 1, expectedSeq: 1 });
    expect(stale.ok).toBe(false);
  });
});
