/**
 * Wave-3 PR3 — purchase→app transition invariants (server side).
 *
 * B1: the app's REAL scheme (aforce-os:) is accepted — it was missing
 *     from the allowlist, so every native checkout 400'd before Stripe
 *     was contacted.
 * B11: the "same-origin" web check no longer validates attacker input
 *     against attacker input — PUBLIC_BASE_URL pins the origin.
 * Session forwarding: only well-formed cs_ ids pass through the bounce.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("../lib/aforceState", () => ({ DEFAULT_USER_ID: "test-default-user" }));
vi.mock("../lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));
vi.mock("@workspace/db", () => ({ db: {}, aforceUsers: {} }));
vi.mock("../lib/stripeClient", () => ({
  getUncachableStripeClient: async () => ({}),
  getStripeSync: async () => ({}),
}));
vi.mock("../lib/serverAnalytics", () => ({
  analyticsIdFromHeader: () => null,
  emitServerEvent: async () => {},
}));

const ENV_KEYS = ["PUBLIC_BASE_URL"] as const;
let prev: Record<string, string | undefined> = {};
beforeEach(() => {
  prev = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  vi.resetModules();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
});

describe("return-URL allowlist (B1 regression lock)", () => {
  it("aforce-os:// — the app's registered scheme — is ACCEPTED", async () => {
    const { isAllowedReturnUrl } = await import("../routes/checkout");
    expect(isAllowedReturnUrl("aforce-os://subscription", null)).toBe(true);
    expect(isAllowedReturnUrl("aforce-os://subscription?x=1", "anything.example")).toBe(true);
  });

  it("app.json scheme parity: the registered scheme is in the server set", async () => {
    const { NATIVE_APP_RETURN_SCHEMES } = await import("../routes/checkout");
    const appJson = JSON.parse(
      readFileSync(resolve(__dirname, "../../../aforce-os/app.json"), "utf8"),
    ) as { expo: { scheme: string } };
    expect(NATIVE_APP_RETURN_SCHEMES.has(`${appJson.expo.scheme}:`)).toBe(true);
  });

  it("web returnUrls must match the pinned host; foreign hosts rejected", async () => {
    const { isAllowedReturnUrl } = await import("../routes/checkout");
    expect(isAllowedReturnUrl("https://evil.example/phish", "api.real.example")).toBe(false);
    expect(isAllowedReturnUrl("https://api.real.example/return", "api.real.example")).toBe(true);
    expect(isAllowedReturnUrl("javascript:alert(1)", null)).toBe(false);
    expect(isAllowedReturnUrl("not a url", null)).toBe(false);
  });
});

describe("origin pinning (B11 open-redirect fix)", () => {
  function fakeReq(headers: Record<string, string>): never {
    return {
      headers,
      protocol: "https",
      get: (h: string) => headers[h.toLowerCase()],
    } as never;
  }

  it("with PUBLIC_BASE_URL set, attacker x-forwarded-host is IGNORED", async () => {
    process.env["PUBLIC_BASE_URL"] = "https://aforce-command-production.up.railway.app";
    const { publicBaseUrl, inboundHost } = await import("../routes/checkout");
    const req = fakeReq({ "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" });
    expect(publicBaseUrl(req)).toBe("https://aforce-command-production.up.railway.app");
    expect(inboundHost(req)).toBe("aforce-command-production.up.railway.app");
  });

  it("an https returnUrl on the attacker host is rejected when the origin is pinned", async () => {
    process.env["PUBLIC_BASE_URL"] = "https://aforce-command-production.up.railway.app";
    const { isAllowedReturnUrl, inboundHost } = await import("../routes/checkout");
    const req = fakeReq({ "x-forwarded-host": "evil.example" });
    expect(isAllowedReturnUrl("https://evil.example/return", inboundHost(req))).toBe(false);
  });
});

describe("bounce session_id forwarding", () => {
  it("forwards a well-formed cs_ id and drops malformed ones (source lock)", async () => {
    const src = readFileSync(resolve(__dirname, "../routes/checkout.ts"), "utf8");
    expect(src).toContain("session_id={CHECKOUT_SESSION_ID}");
    expect(src).toMatch(/\^cs_\[A-Za-z0-9_\]\+\$/);
    // bounce page escapes the target for both sinks
    expect(src).toContain("escapeHtml(target)");
    expect(src).toContain("u003C");
  });

  it("GET /checkout/session/:id is authenticated and throttled", async () => {
    const src = readFileSync(resolve(__dirname, "../routes/checkout.ts"), "utf8");
    expect(src).toMatch(/checkout\/session\/:id',\s*requireAuth,\s*checkoutLimiter/);
  });
});
