/**
 * Wave-3 PR2 — Stripe deployment decoupling invariants.
 *
 * 1. STRIPE_SECRET_KEY (standard env) is the PRIMARY credential source —
 *    resolving it makes ZERO calls to the Replit Connectors API, so the
 *    real production deployment (Railway) can operate.
 * 2. Replit Connectors remain the fallback when env vars are absent.
 * 3. Missing configuration everywhere fails LOUDLY (typed throw), never
 *    silently.
 * 4. An absent webhook secret is passed as ABSENT (never coerced to ''),
 *    so the sync package's managed-webhook fallback and its fail-closed
 *    no-secret throw stay distinguishable.
 * 5. Managed-webhook registration uses PUBLIC_BASE_URL first (Railway),
 *    Replit domains as fallback, and warns loudly when neither exists.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const stripeSyncCtor = vi.fn();
vi.mock("stripe-replit-sync", () => ({
  StripeSync: class {
    constructor(cfg: unknown) {
      stripeSyncCtor(cfg);
    }
  },
  runMigrations: vi.fn(async () => {}),
}));
vi.mock("stripe", () => ({
  default: class {
    key: string;
    constructor(key: string) {
      this.key = key;
    }
  },
}));
vi.mock("../lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

const ENV_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PUBLISHABLE_KEY",
  "REPLIT_CONNECTORS_HOSTNAME",
  "REPL_IDENTITY",
  "WEB_REPL_RENEWAL",
  "REPLIT_DOMAINS",
  "REPLIT_DEV_DOMAIN",
  "PUBLIC_BASE_URL",
  "DATABASE_URL",
] as const;
let prev: Record<string, string | undefined> = {};
const fetchSpy = vi.fn();

beforeEach(() => {
  prev = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  process.env["DATABASE_URL"] = "postgres://test";
  stripeSyncCtor.mockReset();
  fetchSpy.mockReset();
  vi.stubGlobal("fetch", fetchSpy);
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV_KEYS) {
    if (prev[k] === undefined) delete process.env[k];
    else process.env[k] = prev[k];
  }
});

describe("credential resolution", () => {
  it("STRIPE_SECRET_KEY resolves with ZERO Replit Connectors calls", async () => {
    process.env["STRIPE_SECRET_KEY"] = "sk_test_env_primary";
    process.env["REPLIT_CONNECTORS_HOSTNAME"] = "connectors.replit.example";
    process.env["REPL_IDENTITY"] = "should-not-be-consulted";
    const { getUncachableStripeClient } = await import("../lib/stripeClient");
    const client = (await getUncachableStripeClient()) as unknown as { key: string };
    expect(client.key).toBe("sk_test_env_primary");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("missing configuration everywhere fails loudly with remediation, never silently", async () => {
    const { getUncachableStripeClient } = await import("../lib/stripeClient");
    await expect(getUncachableStripeClient()).rejects.toThrow(/STRIPE_SECRET_KEY/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("absent webhook secret is passed as ABSENT to the sync engine — never ''", async () => {
    process.env["STRIPE_SECRET_KEY"] = "sk_test_env_primary";
    const { getStripeSync } = await import("../lib/stripeClient");
    await getStripeSync();
    const cfg = stripeSyncCtor.mock.calls[0]![0] as Record<string, unknown>;
    expect(cfg["stripeSecretKey"]).toBe("sk_test_env_primary");
    expect("stripeWebhookSecret" in cfg).toBe(false);
  });

  it("present webhook secret is passed through verbatim", async () => {
    process.env["STRIPE_SECRET_KEY"] = "sk_test_env_primary";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_configured";
    const { getStripeSync } = await import("../lib/stripeClient");
    await getStripeSync();
    const cfg = stripeSyncCtor.mock.calls[0]![0] as Record<string, unknown>;
    expect(cfg["stripeWebhookSecret"]).toBe("whsec_configured");
  });

  it("Replit Connectors fallback still works when env vars are absent", async () => {
    process.env["REPLIT_CONNECTORS_HOSTNAME"] = "connectors.replit.example";
    process.env["REPL_IDENTITY"] = "repl-token";
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [{ settings: { secret_key: "sk_from_replit", webhook_secret: "whsec_replit" } }],
      }),
    });
    const { getUncachableStripeClient } = await import("../lib/stripeClient");
    const client = (await getUncachableStripeClient()) as unknown as { key: string };
    expect(client.key).toBe("sk_from_replit");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("managed webhook registration URL", () => {
  async function runInitStripe(): Promise<{ registered: string[] }> {
    const registered: string[] = [];
    vi.doMock("../lib/stripeClient", () => ({
      getStripeSync: async () => ({
        findOrCreateManagedWebhook: async (url: string) => {
          registered.push(url);
        },
        syncBackfill: async () => {},
      }),
    }));
    const { initStripe } = await import("../lib/initStripe");
    await initStripe();
    vi.doUnmock("../lib/stripeClient");
    return { registered };
  }

  it("PUBLIC_BASE_URL is primary (trailing slash tolerated)", async () => {
    process.env["PUBLIC_BASE_URL"] = "https://aforce-command-production.up.railway.app/";
    process.env["REPLIT_DEV_DOMAIN"] = "old.replit.dev";
    const { registered } = await runInitStripe();
    expect(registered).toEqual([
      "https://aforce-command-production.up.railway.app/api/stripe/webhook",
    ]);
  });

  it("Replit domains remain the fallback", async () => {
    process.env["REPLIT_DOMAINS"] = "my-app.replit.app,alt.replit.app";
    const { registered } = await runInitStripe();
    expect(registered).toEqual(["https://my-app.replit.app/api/stripe/webhook"]);
  });

  it("neither configured → webhook NOT registered (and nothing throws)", async () => {
    const { registered } = await runInitStripe();
    expect(registered).toEqual([]);
  });
});
