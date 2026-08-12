/**
 * Wave-1 P0 invariant: Founder Mode (and admin surfaces generally) are
 * unavailable to ordinary production users — the founder gate fails CLOSED
 * in production when auth is not configured, and never silently opens.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/aforceState", () => ({ DEFAULT_USER_ID: "test-default-user" }));
vi.mock("../lib/logger", () => ({ logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} } }));

const ENV_KEYS = ["NODE_ENV", "CLERK_SECRET_KEY", "FOUNDER_USER_IDS", "FOUNDER_EMAILS"] as const;
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

function run(middleware: unknown): { status: number | null; nexted: boolean } {
  const result = { status: null as number | null, nexted: false };
  const req = { headers: {}, auth: undefined } as never;
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json() {
      return this;
    },
  } as never;
  (middleware as (rq: never, rs: never, nx: () => void) => void)(req, res, () => {
    result.nexted = true;
  });
  return result;
}

describe("requireFounder — production fail-closed", () => {
  it("production with no auth configured → 5xx, never next()", async () => {
    process.env["NODE_ENV"] = "production";
    delete process.env["CLERK_SECRET_KEY"];
    const { requireFounder } = await import("../middlewares/requireFounder");
    const out = run(requireFounder);
    expect(out.nexted).toBe(false);
    expect(out.status).toBeGreaterThanOrEqual(500);
  });

});
