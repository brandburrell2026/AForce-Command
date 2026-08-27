/**
 * §18 INTELLIGENCE EVALUATION — tranche 7: injection & BOLA (§16/§17).
 *
 * The security seam of the eval program. The recon (workflow
 * wf_fea5f434-66c) confirmed the surface is sound AFTER the /cycles IDOR
 * fix (#853): scans + cycles scope on the verified user, health-records
 * server-stamps userId, requireRealAuth has no dev fallback on
 * destructive routes, webhook HMAC is constant-time + fail-closed,
 * requireFounder is super_admin-exact. The pure gates already carry
 * EXAMPLE unit tests (shopifyWebhook.test, requireFounder.test,
 * intakeCorrection.test) — this tranche does not duplicate them; it pins
 * the UNIVERSAL security laws over those pure gates (the "for all
 * attackers" strengthening) with a seeded generator, so a regression
 * that widens any gate is caught even on inputs no example enumerated.
 *
 * Seeded LCG — deterministic, Date.now/Math.random-free.
 */
import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  planIntakeCorrection,
  CORRECTION_LIVE_WINDOW_MS,
  type CorrectableLog,
} from "../lib/intakeCorrection";
import { verifyShopifyHmac } from "../lib/shopifyWebhook";
import { isFounderAllowed } from "../middlewares/requireFounder";

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const NOW = Date.UTC(2026, 7, 3, 12, 0, 0);

function log(over: Partial<CorrectableLog> = {}): CorrectableLog {
  return {
    id: 1,
    userId: "user_owner",
    fluidType: "water",
    ozAmount: 16,
    clientEventId: "cid-1",
    correctsIntakeId: null,
    loggedAt: new Date(NOW - 60_000),
    ...over,
  };
}

describe("§18/BOLA — the ownership gate denies every cross-user correction, universally", () => {
  it("for ANY owner≠requester pair, the plan is a rejection — never a mutation", () => {
    const rand = lcg(0xb01a);
    for (let i = 0; i < 500; i += 1) {
      const owner = `user_${Math.floor(rand() * 1e6)}`;
      let requester = `user_${Math.floor(rand() * 1e6)}`;
      if (requester === owner) requester += "_x"; // guarantee they differ
      const plan = planIntakeCorrection({
        log: log({ userId: owner }),
        requestUserId: requester,
        alreadyCorrected: false,
        isAforceFluid: false,
        nowMs: NOW,
      });
      expect("ok" in plan && plan.ok).toBe(false);
      if (!("ok" in plan) || !plan.ok) {
        expect(plan.reason).toBe("not_owner");
      }
    }
  });

  it("the owner themselves is never spuriously denied on a fresh, uncorrected log", () => {
    const plan = planIntakeCorrection({
      log: log({ userId: "user_owner" }),
      requestUserId: "user_owner",
      alreadyCorrected: false,
      isAforceFluid: false,
      nowMs: NOW,
    });
    expect("ok" in plan && plan.ok).toBe(true);
  });

  it("a missing log is not_found — distinct from not_owner, so neither leaks the other's existence", () => {
    const missing = planIntakeCorrection({
      log: null,
      requestUserId: "user_a",
      alreadyCorrected: false,
      isAforceFluid: false,
      nowMs: NOW,
    });
    expect("ok" in missing && missing.ok).toBe(false);
    if (!("ok" in missing) || !missing.ok) expect(missing.reason).toBe("not_found");
    // NOTE for the route layer (not asserted here — no route in scope): both
    // not_found and not_owner should surface as the SAME 404 so a caller
    // cannot enumerate which ids exist. The planner keeps them distinct for
    // server-side telemetry; the mapping is the route's responsibility.
  });
});

describe("§17 — webhook HMAC: no forgery ever validates, only the exact signature", () => {
  it("only the correct HMAC of the exact body+secret passes; everything else fails", () => {
    const rand = lcg(0x5109);
    const secret = "shpss_test_secret";
    for (let i = 0; i < 300; i += 1) {
      const body = Buffer.from(`{"id":${Math.floor(rand() * 1e9)},"n":"${rand()}"}`);
      const good = createHmac("sha256", secret).update(body).digest("base64");
      expect(verifyShopifyHmac(body, good, secret)).toBe(true);
      // Forgeries: truncated, padded, wrong secret, empty, tampered body.
      expect(verifyShopifyHmac(body, good.slice(0, -2), secret)).toBe(false);
      expect(verifyShopifyHmac(body, good + "AA", secret)).toBe(false);
      expect(verifyShopifyHmac(body, good, "wrong_secret")).toBe(false);
      expect(verifyShopifyHmac(body, "", secret)).toBe(false);
      expect(verifyShopifyHmac(Buffer.concat([body, Buffer.from("x")]), good, secret)).toBe(false);
    }
  });

  it("an unset secret can never validate anything (fail-closed)", () => {
    const body = Buffer.from("{}");
    const anyHeader = createHmac("sha256", "s").update(body).digest("base64");
    expect(verifyShopifyHmac(body, anyHeader, "")).toBe(false);
  });
});

describe("§16 — founder authority: a plain admin is never founder, universally", () => {
  it("only exact super_admin is admitted; user/admin/anything-else never is", () => {
    const roles = ["user", "admin", "super_admin", "owner", "moderator", "", "SUPER_ADMIN"];
    const emails = ["founder@aforce.com"];
    // Empty allow-list: super_admin alone suffices, nothing else does.
    for (const role of roles) {
      expect(isFounderAllowed(role, emails, new Set())).toBe(role === "super_admin");
    }
  });

  it("with an allow-list set, super_admin STILL needs an allow-listed email", () => {
    const allow = new Set(["founder@aforce.com"]);
    expect(isFounderAllowed("super_admin", ["founder@aforce.com"], allow)).toBe(true);
    expect(isFounderAllowed("super_admin", ["someone@else.com"], allow)).toBe(false);
    // A plain admin can never pass even with an allow-listed email.
    expect(isFounderAllowed("admin", ["founder@aforce.com"], allow)).toBe(false);
  });
});

describe("§18 — the correction live-window boundary is exact (no off-by-one score reversal)", () => {
  it("a log inside the window reverses counters; one at/after the edge does not", () => {
    const inWindow = planIntakeCorrection({
      log: log({ loggedAt: new Date(NOW - (CORRECTION_LIVE_WINDOW_MS - 1)) }),
      requestUserId: "user_owner",
      alreadyCorrected: false,
      isAforceFluid: false,
      nowMs: NOW,
    });
    const atEdge = planIntakeCorrection({
      log: log({ loggedAt: new Date(NOW - CORRECTION_LIVE_WINDOW_MS) }),
      requestUserId: "user_owner",
      alreadyCorrected: false,
      isAforceFluid: false,
      nowMs: NOW,
    });
    expect("ok" in inWindow && inWindow.ok && inWindow.reverseCounters).toBe(true);
    expect("ok" in atEdge && atEdge.ok && atEdge.reverseCounters).toBe(false);
  });
});
