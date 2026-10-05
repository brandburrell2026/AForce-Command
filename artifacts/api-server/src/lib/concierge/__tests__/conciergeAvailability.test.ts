/**
 * Provider availability — the truth behind GET /status.
 *
 * Pins the two 2026-10-05 incidents (placeholder key → 401; organization with
 * no credits → 429 "no credits remaining") as distinct, non-retryable reasons,
 * plus caching semantics: a good verdict is reused for the cache window, a bad
 * one is re-probed sooner, concurrent callers share one probe, and `reset()`
 * forces a fresh probe.
 */
import { describe, it, expect, vi } from "vitest";
import {
  classifyUpstreamError,
  createAvailabilityChecker,
  reasonForUpstream,
  redactProviderMessage,
} from "../availability";

function apiError(status: number, message: string): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}

describe("classifyUpstreamError", () => {
  it("maps the real production failures", () => {
    expect(classifyUpstreamError(apiError(401, "401 Incorrect API key provided: sk-place**lder."))).toBe("upstream_auth");
    expect(classifyUpstreamError(apiError(429, "429 You have no credits remaining. Add credits to continue using the API"))).toBe("upstream_quota");
    expect(classifyUpstreamError(apiError(429, "Rate limit reached for gpt-5.4, please retry after 2s"))).toBe("upstream_rate_limited");
    expect(classifyUpstreamError(apiError(404, "The model `gpt-5.4` does not exist"))).toBe("upstream_model");
    expect(classifyUpstreamError(new Error("Connection error."))).toBe("upstream_error");
    expect(classifyUpstreamError(new Error("whatever"), true)).toBe("upstream_timeout");
  });
  it("maps codes to member-facing reasons", () => {
    expect(reasonForUpstream("upstream_auth")).toBe("ai_key_invalid");
    expect(reasonForUpstream("upstream_quota")).toBe("ai_quota_exhausted");
    expect(reasonForUpstream("upstream_rate_limited")).toBe("ai_rate_limited");
    expect(reasonForUpstream("upstream_model")).toBe("ai_model_unavailable");
    expect(reasonForUpstream("upstream_timeout")).toBe("ai_unreachable");
    expect(reasonForUpstream("upstream_error")).toBe("ai_unreachable");
  });
  it("redacts anything key-shaped before logging", () => {
    expect(redactProviderMessage("Incorrect API key provided: sk-abc123DEF456xyz. See docs")).toBe(
      "Incorrect API key provided: sk-[redacted]. See docs",
    );
  });
});

describe("createAvailabilityChecker", () => {
  const T0 = Date.parse("2026-10-05T21:00:00Z");

  function checker(retrieve: () => Promise<unknown>, configured = true) {
    const client = { models: { retrieve: vi.fn(retrieve) } };
    const getClient = vi.fn(async () => client);
    const c = createAvailabilityChecker(getClient, { configured: () => configured, cacheMs: 60_000, failCacheMs: 10_000, probeTimeoutMs: 1_000 });
    return { c, client, getClient };
  }

  it("not configured → ai_not_configured without touching the provider", async () => {
    const { c, getClient } = checker(async () => ({}), false);
    const r = await c.check(T0);
    expect(r).toMatchObject({ available: false, reason: "ai_not_configured", cached: false });
    expect(getClient).not.toHaveBeenCalled();
  });

  it("a successful probe is available and cached for the cache window", async () => {
    const { c, client } = checker(async () => ({ id: "gpt-5.4" }));
    expect(await c.check(T0)).toMatchObject({ available: true, reason: null, cached: false });
    expect(await c.check(T0 + 30_000)).toMatchObject({ available: true, cached: true });
    expect(client.models.retrieve).toHaveBeenCalledTimes(1);
    await c.check(T0 + 61_000);
    expect(client.models.retrieve).toHaveBeenCalledTimes(2);
  });

  it("a placeholder key reads as ai_key_invalid, re-probed on the shorter fail window", async () => {
    const { c, client } = checker(async () => { throw apiError(401, "Incorrect API key provided: sk-place**lder"); });
    const r = await c.check(T0);
    expect(r).toMatchObject({ available: false, reason: "ai_key_invalid" });
    expect(r.detail).toMatch(/sk-\[redacted\]/);
    expect(await c.check(T0 + 5_000)).toMatchObject({ cached: true });
    await c.check(T0 + 11_000);
    expect(client.models.retrieve).toHaveBeenCalledTimes(2);
  });

  it("no credits reads as ai_quota_exhausted", async () => {
    const { c } = checker(async () => { throw apiError(429, "You have no credits remaining."); });
    expect(await c.check(T0)).toMatchObject({ available: false, reason: "ai_quota_exhausted" });
  });

  it("recovery shows after the fail window: 401 then a good key", async () => {
    let good = false;
    const { c } = checker(async () => { if (!good) throw apiError(401, "bad"); return {}; });
    expect((await c.check(T0)).available).toBe(false);
    good = true;
    expect((await c.check(T0 + 5_000)).available).toBe(false); // still cached failure
    expect((await c.check(T0 + 11_000)).available).toBe(true);
  });

  it("concurrent callers share one probe", async () => {
    const { c, client } = checker(() => new Promise((r) => setTimeout(() => r({}), 20)));
    const [a, b] = await Promise.all([c.check(T0), c.check(T0)]);
    expect(a.available && b.available).toBe(true);
    expect(client.models.retrieve).toHaveBeenCalledTimes(1);
  });

  it("reset forces a fresh probe", async () => {
    const { c, client } = checker(async () => ({}));
    await c.check(T0);
    c.reset();
    await c.check(T0 + 1);
    expect(client.models.retrieve).toHaveBeenCalledTimes(2);
  });

  it("a hung provider reads as ai_unreachable via the probe timeout", async () => {
    const { c } = checker(() => new Promise(() => {}));
    const r = await c.check(T0);
    expect(r).toMatchObject({ available: false, reason: "ai_unreachable" });
  }, 5_000);
});
