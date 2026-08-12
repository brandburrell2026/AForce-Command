/**
 * Wave-3 PR4 — Shopify→AForce identity bridge invariants.
 *
 * aforce_users.email (the web-rail join key) is now written from the
 * VERIFIED Clerk primary email at row creation, with a one-time backfill
 * for pre-bridge rows. Clerk user id stays the canonical identity; a
 * Shopify email can never replace it; unverified addresses never
 * establish the linkage; Clerk failures never block entitlement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const getUserMock = vi.fn();
vi.mock("@clerk/express", () => ({
  clerkClient: { users: { getUser: (...a: unknown[]) => getUserMock(...a) } },
}));
vi.mock("../lib/logger", () => ({
  logger: { error: () => {}, warn: () => {}, info: () => {}, debug: () => {} },
}));

beforeEach(() => {
  getUserMock.mockReset();
  vi.resetModules();
});

describe("fetchVerifiedPrimaryEmail", () => {
  it("returns the normalized VERIFIED primary email", async () => {
    getUserMock.mockResolvedValue({
      primaryEmailAddressId: "em_1",
      emailAddresses: [
        { id: "em_2", emailAddress: "other@x.com", verification: { status: "verified" } },
        { id: "em_1", emailAddress: "  Brandon@AkalFresh.com ", verification: { status: "verified" } },
      ],
    });
    const { fetchVerifiedPrimaryEmail } = await import("../lib/clerkEmail");
    expect(await fetchVerifiedPrimaryEmail("user_A")).toBe("brandon@akalfresh.com");
  });

  it("an UNVERIFIED primary email never establishes the linkage", async () => {
    getUserMock.mockResolvedValue({
      primaryEmailAddressId: "em_1",
      emailAddresses: [
        { id: "em_1", emailAddress: "victim@x.com", verification: { status: "unverified" } },
      ],
    });
    const { fetchVerifiedPrimaryEmail } = await import("../lib/clerkEmail");
    expect(await fetchVerifiedPrimaryEmail("user_A")).toBeNull();
  });

  it("Clerk failure returns null (never throws into entitlement resolution)", async () => {
    getUserMock.mockRejectedValue(new Error("clerk down"));
    const { fetchVerifiedPrimaryEmail } = await import("../lib/clerkEmail");
    expect(await fetchVerifiedPrimaryEmail("user_A")).toBeNull();
  });
});

describe("resolver wiring (source locks — full round-trip proven in the E2E lane)", () => {
  const src = readFileSync(resolve(__dirname, "../lib/entitlementResolver.ts"), "utf8");

  it("row creation carries the verified email; backfill only when NULL", () => {
    expect(src).toContain("fetchVerifiedPrimaryEmail(userId)");
    expect(src).toMatch(/\.\.\.\(email \? \{ email \} : \{\}\)/);
    expect(src).toMatch(/isNull\(aforceUsers\.email\)/);
  });

  it("email is never overwritten and never sourced from Shopify", () => {
    // the only .set({ email ... }) is the isNull-guarded backfill
    const setEmailSites = src.match(/\.set\(\{ email/g) ?? [];
    expect(setEmailSites.length).toBe(1);
    expect(src).not.toMatch(/web\.email|shopify.*email.*set/i);
    // canonical identity stays the Clerk id
    expect(src).toContain('values({ id: userId, planId: "core"');
  });

  it("duplicate-email safety: the web rail's grant clamp and expiry survive untouched", () => {
    expect(src).toContain("WEB_GRANTABLE_PLANS");
    expect(src).toContain("currentPeriodEnd} IS NULL OR");
  });
});
