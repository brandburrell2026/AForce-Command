/**
 * API ERROR-CONTRACT LAWS — asserted against the REAL app.ts middleware order.
 *
 * WHY THE REAL APP AND NOT A HAND-BUILT ONE. The PR 1 defect
 * (/api/smart-capture answering 500 instead of 401) survived because
 * smartCaptureAuth.test.ts builds its own express app and so never saw app.ts's
 * ordering. A contract law that assembles its own middleware stack proves
 * nothing about production. Every case below boots app.ts and makes a real HTTP
 * request. Harness copied from smartCaptureMountOrder.test.ts, which established
 * that app.ts imports in the DB-less lane with only the OpenAI package mocked.
 *
 * ENV DISCIPLINE. NODE_ENV=production is required twice over: requireAuth grants
 * DEFAULT_USER_ID below production (so 401 cases would pass for the wrong
 * reason), and rateLimits.ts's SKIP_IN_TEST disables every limiter when
 * NODE_ENV === 'test' (so a 429 case would be inert). Both Clerk values are
 * synthetic non-credentials; a tokenless request resolves signed-out with no
 * network call.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { buildApiErrorBody, classifyThrown } from "../lib/apiError";

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn(async () => {
          throw new Error("OpenAI must never be reached by these tests");
        }),
      },
    },
  },
}));

const ENV_KEYS = [
  "NODE_ENV",
  "CLERK_SECRET_KEY",
  "CLERK_PUBLISHABLE_KEY",
  "CORS_ALLOWED_ORIGINS",
  "SHOPIFY_WEBHOOK_SECRET",
] as const;
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

async function bootRealApp() {
  process.env["NODE_ENV"] = "production";
  process.env["CLERK_SECRET_KEY"] = "NOT-A-KEY-error-contract-presence-only";
  process.env["CLERK_PUBLISHABLE_KEY"] = "pk_test_bW91bnQtb3JkZXItbGF3LmludmFsaWQk";
  process.env["CORS_ALLOWED_ORIGINS"] = "https://example.invalid";
  // Left UNSET on purpose: the Shopify route answers 503 before any signature
  // work and before any outbound call, so the 429 case below never contacts
  // Shopify. It exercises OUR limiter, nothing else.
  delete process.env["SHOPIFY_WEBHOOK_SECRET"];

  const { default: app } = await import("../app");
  const server = http.createServer(app as never);
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

async function call(base: string, path: string, init?: RequestInit) {
  const res = await fetch(base + path, init);
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(text) as Record<string, unknown>; } catch { json = null; }
  return { status: res.status, contentType: res.headers.get("content-type") ?? "", text, json };
}

// ── 1 · the JSON 404 catch-all ──────────────────────────────────────────────

describe("LAW 1 — an unmatched /api path answers JSON, never HTML", () => {
  it("returns a JSON body with error, code and requestId", async () => {
    const app = await bootRealApp();
    try {
      const r = await call(app.base, "/api/definitely-not-a-route");
      expect(r.status).toBe(404);
      expect(r.contentType).toContain("application/json");
      expect(r.json).toMatchObject({ error: "not_found", code: "not_found" });
      expect(typeof r.json?.["requestId"]).toBe("string");
    } finally {
      await app.close();
    }
  });

  it("the body is not Express's HTML error page", async () => {
    // The precise regression: before this change the same request produced
    // `<!DOCTYPE html>...Cannot GET /api/...`, so a client doing res.json()
    // threw on parse instead of reading a status.
    const app = await bootRealApp();
    try {
      const r = await call(app.base, "/api/definitely-not-a-route");
      expect(r.text).not.toMatch(/<!DOCTYPE html>/i);
      expect(r.text).not.toMatch(/Cannot (GET|POST)/);
      expect(r.json, "body must parse as JSON").not.toBeNull();
    } finally {
      await app.close();
    }
  });

  it("does not shadow routes mounted BEFORE the global parsers", async () => {
    // The catch-all sits after the router, so the three pre-parser routers
    // (stripe webhook, shopify webhook, smart capture) must still win. If the
    // catch-all ever moved above them they would all answer 404.
    const app = await bootRealApp();
    try {
      const smart = await call(app.base, "/api/smart-capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: "x" }),
      });
      // PR 1's contract — unchanged by this PR.
      expect(smart.status, "smart-capture must still be reached, not 404'd").toBe(401);
      expect(smart.json).toMatchObject({ error: "Unauthorized" });
    } finally {
      await app.close();
    }
  });
});

// ── 2 · client fault vs server fault ────────────────────────────────────────

describe("LAW 2 — a client fault is not reported as a server fault", () => {
  it("malformed JSON is 400 invalid_json, not 500", async () => {
    const app = await bootRealApp();
    try {
      const r = await call(app.base, "/api/aforce/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      });
      expect(r.status, "500 here means the terminal handler still blanket-500s").toBe(400);
      expect(r.json).toMatchObject({ error: "invalid_json", code: "invalid_json" });
    } finally {
      await app.close();
    }
  });

  it("an oversize body is 413 payload_too_large, not 500", async () => {
    const app = await bootRealApp();
    try {
      const r = await call(app.base, "/api/aforce/signals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ a: "Z".repeat(100_000) }),
      });
      expect(r.status).toBe(413);
      expect(r.json).toMatchObject({ code: "payload_too_large" });
    } finally {
      await app.close();
    }
  });

  it("an unsupported content-encoding is 415, not 500", async () => {
    const app = await bootRealApp();
    try {
      const r = await call(app.base, "/api/aforce/signals", {
        method: "POST",
        headers: { "content-type": "application/json", "content-encoding": "bogus" },
        body: "{}",
      });
      expect(r.status).toBe(415);
      expect(r.json).toMatchObject({ code: "unsupported_encoding" });
    } finally {
      await app.close();
    }
  });

  it("an UNRECOGNISED throw stays 500 — the safe direction", async () => {
    // classifyThrown is a closed allowlist on purpose. Trusting an arbitrary
    // err.status would let any thrown object choose its own response code, so
    // anything unrecognised is a server fault until proven otherwise.
    expect(classifyThrown(new Error("boom"))).toEqual({ status: 500, code: "internal_error" });
    expect(classifyThrown({ status: 403 })).toEqual({ status: 500, code: "internal_error" });
    expect(classifyThrown({ statusCode: 404 })).toEqual({ status: 500, code: "internal_error" });
    expect(classifyThrown(null)).toEqual({ status: 500, code: "internal_error" });
    expect(classifyThrown(undefined)).toEqual({ status: 500, code: "internal_error" });
  });
});

// ── 3 · existing statuses are unchanged (the compatibility proof) ───────────

describe("LAW 3 — statuses clients depend on are untouched", () => {
  it("401 on an authenticated route keeps its existing shape", async () => {
    const app = await bootRealApp();
    try {
      const r = await call(app.base, "/api/aforce/state");
      expect(r.status).toBe(401);
      expect(r.json).toMatchObject({ error: "Unauthorized" });
    } finally {
      await app.close();
    }
  });

  it("429 still carries error and scope, and the limiter is LIVE outside test", async () => {
    // SHOPIFY_WEBHOOK_SECRET is unset, so this path answers 503 before any
    // signature work and never contacts Shopify. Only OUR limiter is exercised.
    // webhookLimiter is the first middleware on the route (shopifyWebhook.ts:26),
    // ahead of express.raw and the HMAC check, and its cap is 120/min.
    const app = await bootRealApp();
    try {
      let last = await call(app.base, "/api/shopify/webhook", { method: "POST" });
      for (let i = 0; i < 125 && last.status !== 429; i++) {
        last = await call(app.base, "/api/shopify/webhook", { method: "POST" });
      }
      expect(last.status, "limiter never fired — is SKIP_IN_TEST active?").toBe(429);
      expect(last.json).toMatchObject({ error: "rate_limited", scope: "webhook" });
    } finally {
      await app.close();
    }
  }, 30_000);

  it("403 keeps the shape the guards emit today", async () => {
    // Every 403 producer in the server (requireRole:156, requireAdmin:125,
    // requireFounder:68/86, destructiveGuards:159) emits a bare
    // {error: "<code>"} and is NOT migrated by this PR. Pinned as the current
    // contract so the debt is visible and any drift is caught.
    const guards = [
      "middlewares/requireRole.ts",
      "middlewares/requireAdmin.ts",
      "middlewares/requireFounder.ts",
      "middlewares/destructiveGuards.ts",
    ];
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const g of guards) {
      const src = readFileSync(join(__dirname, "..", g), "utf8");
      expect(src, g).toMatch(/res\.status\(403\)\.json\(\{[\s\S]{0,80}error:/);
    }
  });
});

// ── 4 · nothing sensitive can reach a response body ─────────────────────────

describe("LAW 4 — the body cannot carry internal detail", () => {
  it("a 500 body contains no stack, no message, no internals", async () => {
    const body = buildApiErrorBody({ id: 42 } as never, "internal_error");
    expect(Object.keys(body).sort()).toEqual(["code", "error", "requestId"]);
    expect(JSON.stringify(body)).not.toMatch(/at .*\(|Error:|stack|password|token|secret|postgres|ECONN/i);
  });

  it("the helper has NO parameter through which internal detail could arrive", async () => {
    // The guarantee is the SIGNATURE, not a convention: sendApiError takes a
    // number and strings — no `unknown`, no error argument, no object spread —
    // so there is no expression a caller can write that leaks. If this law
    // fails, someone widened the helper and the guarantee is gone.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(__dirname, "..", "lib/apiError.ts"), "utf8");
    const sig = src.slice(src.indexOf("export function sendApiError"), src.indexOf("export function classifyThrown"));
    expect(sig).not.toMatch(/:\s*unknown/);
    expect(sig).not.toMatch(/\.\.\./);
    expect(sig).not.toMatch(/Record<string,\s*unknown>/);
    expect(sig).toMatch(/status: number/);
    expect(sig).toMatch(/code: string/);
  });

  it("requestId is echoed when present and omitted when absent — never faked", async () => {
    expect(buildApiErrorBody({ id: 7 } as never, "x").requestId).toBe("7");
    expect(buildApiErrorBody({} as never, "x").requestId).toBeUndefined();
    expect("requestId" in buildApiErrorBody({} as never, "x")).toBe(false);
  });
});
