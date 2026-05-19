import { describe, it, expect } from "vitest";
import {
  REFERRAL_TIERS,
  tierFor,
  nextTierFor,
  claimsToNextTier,
  handleForCode,
} from "../referralTiers";

describe("referralTiers", () => {
  it("places 0 claims at Recruit", () => {
    expect(tierFor(0).id).toBe("recruit");
  });

  it("promotes at each threshold boundary", () => {
    expect(tierFor(1).id).toBe("operator");
    expect(tierFor(4).id).toBe("operator");
    expect(tierFor(5).id).toBe("captain");
    expect(tierFor(14).id).toBe("captain");
    expect(tierFor(15).id).toBe("commander");
    expect(tierFor(49).id).toBe("commander");
    expect(tierFor(50).id).toBe("general");
    expect(tierFor(9999).id).toBe("general");
  });

  it("clamps negative + fractional claim counts to a sane tier", () => {
    expect(tierFor(-3).id).toBe("recruit");
    expect(tierFor(1.9).id).toBe("operator");
  });

  it("returns the next tier above current claims, null at top", () => {
    expect(nextTierFor(0)?.id).toBe("operator");
    expect(nextTierFor(1)?.id).toBe("captain");
    expect(nextTierFor(5)?.id).toBe("commander");
    expect(nextTierFor(15)?.id).toBe("general");
    expect(nextTierFor(50)).toBeNull();
    expect(nextTierFor(10000)).toBeNull();
  });

  it("counts claims remaining to the next tier (0 at top)", () => {
    expect(claimsToNextTier(0)).toBe(1);
    expect(claimsToNextTier(1)).toBe(4);
    expect(claimsToNextTier(4)).toBe(1);
    expect(claimsToNextTier(5)).toBe(10);
    expect(claimsToNextTier(15)).toBe(35);
    expect(claimsToNextTier(50)).toBe(0);
    expect(claimsToNextTier(9999)).toBe(0);
  });

  it("derives 'Operator XXXX' from the first 4 code chars", () => {
    expect(handleForCode("GQ55PFUS")).toBe("Operator GQ55");
    expect(handleForCode("abcdefgh")).toBe("Operator ABCD");
    expect(handleForCode("XY")).toBe("Operator XY");
  });

  it("returns 'Operator ????' for null/empty codes (degrades gracefully)", () => {
    expect(handleForCode(null)).toBe("Operator ????");
    expect(handleForCode(undefined)).toBe("Operator ????");
    expect(handleForCode("")).toBe("Operator ????");
  });

  it("exposes a monotonically-increasing ladder", () => {
    for (let i = 1; i < REFERRAL_TIERS.length; i++) {
      expect(REFERRAL_TIERS[i].claimsRequired).toBeGreaterThan(
        REFERRAL_TIERS[i - 1].claimsRequired,
      );
    }
  });
});
