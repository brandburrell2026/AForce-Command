/**
 * Wave-2 PR1 invariants: server-side entitlement enforcement.
 *
 * Client feature state must never be sufficient authorization; unknown /
 * expired / canceled entitlements and lookup failures all fail CLOSED;
 * the entitlement identity is always the authenticated identity.
 *
 * DB-less lane: the resolver is mocked at the module boundary so these
 * tests run without DATABASE_URL (same pattern as smartCaptureAuth).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const resolveEntitlementMock = vi.fn();

vi.mock("../lib/entitlementResolver", () => ({
  resolveEntitlement: (...args: unknown[]) => resolveEntitlementMock(...args),
  ACTIVE_STATUSES: new Set(["active", "trialing", "past_due"]),
}));
vi.mock("../lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));
// DB-less lane for the route-application lock below: social.ts transitively
// imports @workspace/db (via lib/aforceState and routes/aforce/shared).
vi.mock("@workspace/db", () => ({ db: {}, aforceAchievements: {} }));
vi.mock("../lib/aforceState", () => ({
  DEFAULT_USER_ID: "test-default-user",
  getUserState: vi.fn(),
  updateUserState: vi.fn(),
}));

const ENV_KEYS = ["NODE_ENV", "CLERK_SECRET_KEY"] as const;
let prevEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  prevEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env["NODE_ENV"] = "production";
  process.env["CLERK_SECRET_KEY"] = "sk_test_configured";
  resolveEntitlementMock.mockReset();
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (prevEnv[k] === undefined) delete process.env[k];
    else process.env[k] = prevEnv[k];
  }
});

interface RunResult {
  status: number | null;
  body: unknown;
  nexted: boolean;
}

async function run(
  featureId: string,
  req: Record<string, unknown>,
): Promise<RunResult> {
  const { requireEntitlement } = await import("../middlewares/requireEntitlement");
  const middleware = requireEntitlement(featureId);
  const result: RunResult = { status: null, body: null, nexted: false };
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(payload: unknown) {
      result.body = payload;
      return this;
    },
  };
  await middleware(
    req as never,
    res as never,
    () => {
      result.nexted = true;
    },
  );
  return result;
}

describe("requireEntitlement — server-side enforcement", () => {
  it("entitled user (plan grants feature, entitling status) → next()", async () => {
    resolveEntitlementMock.mockResolvedValue({ planId: "recovery_plus", status: "active" });
    const out = await run("recovery_mode_enabled", { userId: "user_A", headers: {}, body: {} });
    expect(out.nexted).toBe(true);
    expect(out.status).toBeNull();
  });

  it("non-entitled user (core plan) → 403 with requiredPlanId", async () => {
    resolveEntitlementMock.mockResolvedValue({ planId: "core", status: "active" });
    const out = await run("recovery_mode_enabled", { userId: "user_A", headers: {}, body: {} });
    expect(out.nexted).toBe(false);
    expect(out.status).toBe(403);
    expect(out.body).toMatchObject({
      error: "entitlement_required",
      featureId: "recovery_mode_enabled",
      requiredPlanId: "recovery_plus",
    });
  });

  it("expired/canceled user (right plan, non-entitling status) → 403", async () => {
    for (const status of ["canceled", "paused", "none", "incomplete_expired"]) {
      resolveEntitlementMock.mockResolvedValue({ planId: "recovery_plus", status });
      const out = await run("recovery_mode_enabled", { userId: "user_A", headers: {}, body: {} });
      expect(out.nexted, `status=${status} must not entitle`).toBe(false);
      expect(out.status).toBe(403);
    }
  });

  it("unknown feature id → 403 (fail closed, never fall open)", async () => {
    resolveEntitlementMock.mockResolvedValue({ planId: "elite", status: "active" });
    const out = await run("not_a_real_feature", { userId: "user_A", headers: {}, body: {} });
    expect(out.nexted).toBe(false);
    expect(out.status).toBe(403);
  });

  it("forged client flags/plan claims are ignored — denial stands", async () => {
    resolveEntitlementMock.mockResolvedValue({ planId: "core", status: "active" });
    const out = await run("recovery_mode_enabled", {
      userId: "user_A",
      headers: {
        "x-feature-flags": "recovery_mode_enabled:true",
        "x-plan-id": "elite",
        "x-entitlement": "granted",
      },
      body: {
        featureFlags: { recovery_mode_enabled: true },
        planId: "elite",
        subscription: { planId: "elite", status: "active" },
      },
      query: { planId: "elite" },
    });
    expect(out.nexted).toBe(false);
    expect(out.status).toBe(403);
  });

  it("mismatched user identity: entitlement is resolved for the AUTHENTICATED id, client-supplied ids ignored", async () => {
    resolveEntitlementMock.mockResolvedValue({ planId: "core", status: "active" });
    const out = await run("recovery_mode_enabled", {
      userId: "user_A",
      headers: {},
      body: { userId: "user_B_who_is_elite" },
      query: { userId: "user_B_who_is_elite" },
    });
    expect(resolveEntitlementMock).toHaveBeenCalledTimes(1);
    expect(resolveEntitlementMock).toHaveBeenCalledWith("user_A");
    expect(out.nexted).toBe(false);
    expect(out.status).toBe(403);
  });

  it("missing authenticated identity → 401, resolver never called", async () => {
    const out = await run("recovery_mode_enabled", { headers: {}, body: {} });
    expect(out.nexted).toBe(false);
    expect(out.status).toBe(401);
    expect(resolveEntitlementMock).not.toHaveBeenCalled();
  });

  it("entitlement lookup failure → 503, never next()", async () => {
    resolveEntitlementMock.mockRejectedValue(new Error("db down"));
    const out = await run("recovery_mode_enabled", { userId: "user_A", headers: {}, body: {} });
    expect(out.nexted).toBe(false);
    expect(out.status).toBe(503);
    expect(out.body).toMatchObject({ error: "entitlement_unavailable" });
  });

  it("production with Clerk configured never uses the dev bypass", async () => {
    resolveEntitlementMock.mockResolvedValue({ planId: "core", status: "active" });
    const out = await run("recovery_mode_enabled", { userId: "user_A", headers: {}, body: {} });
    expect(resolveEntitlementMock).toHaveBeenCalled();
    expect(out.nexted).toBe(false);
  });
});

describe("route application locks", () => {
  it("POST /aforce/social/shield is entitlement-gated before its handler", async () => {
    const { default: socialRouter } = await import("../routes/aforce/social");
    const layer = (
      socialRouter as unknown as {
        stack: Array<{ route?: { path: string; stack: Array<{ handle: { name: string } }> } }>;
      }
    ).stack.find((l) => l.route?.path === "/social/shield");
    expect(layer?.route).toBeTruthy();
    const handlerCount = layer!.route!.stack.length;
    expect(handlerCount).toBeGreaterThanOrEqual(2);
  });

  it("POST /voice/tts requires auth before the limiter/handler", async () => {
    const { default: voiceRouter } = await import("../routes/voiceTts");
    const layer = (
      voiceRouter as unknown as {
        stack: Array<{ route?: { path: string; stack: Array<{ handle: { name: string } }> } }>;
      }
    ).stack.find((l) => l.route?.path === "/voice/tts");
    expect(layer?.route).toBeTruthy();
    const names = layer!.route!.stack.map((s) => s.handle.name);
    expect(names[0]).toBe("requireAuth");
  });
});
