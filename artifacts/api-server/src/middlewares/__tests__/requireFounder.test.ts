import { describe, it, expect } from "vitest";

import { parseFounderAllowList, isFounderAllowed } from "../requireFounder";

describe("parseFounderAllowList", () => {
  it("returns an empty set when unset / blank", () => {
    expect(parseFounderAllowList(undefined).size).toBe(0);
    expect(parseFounderAllowList("").size).toBe(0);
    expect(parseFounderAllowList("   ,  , ").size).toBe(0);
  });

  it("trims, lowercases, and drops empties", () => {
    const set = parseFounderAllowList(" Julius@AForce.com , brandon@aforce.com ,, ");
    expect([...set].sort()).toEqual(["brandon@aforce.com", "julius@aforce.com"]);
  });
});

describe("isFounderAllowed", () => {
  const empty = new Set<string>();
  const allow = parseFounderAllowList("julius@aforce.com,brandon@aforce.com");

  it("rejects every role that is not exactly super_admin (plain admin must NOT pass)", () => {
    for (const role of ["admin", "user", "moderator", null, undefined, ""]) {
      expect(isFounderAllowed(role, ["julius@aforce.com"], empty)).toBe(false);
      expect(isFounderAllowed(role, ["julius@aforce.com"], allow)).toBe(false);
    }
  });

  it("allows super_admin alone when no allow-list is configured (locked, not bricked)", () => {
    expect(isFounderAllowed("super_admin", [], empty)).toBe(true);
    expect(isFounderAllowed("super_admin", ["someone@example.com"], empty)).toBe(true);
  });

  it("requires allow-list membership for super_admin once an allow-list is set", () => {
    expect(isFounderAllowed("super_admin", ["julius@aforce.com"], allow)).toBe(true);
    expect(isFounderAllowed("super_admin", ["JULIUS@AFORCE.COM"], allow)).toBe(true);
    expect(isFounderAllowed("super_admin", ["intruder@evil.com"], allow)).toBe(false);
    expect(isFounderAllowed("super_admin", [], allow)).toBe(false);
  });

  it("matches when any of several emails is on the allow-list", () => {
    expect(
      isFounderAllowed(
        "super_admin",
        ["work@aforce.com", "brandon@aforce.com"],
        allow,
      ),
    ).toBe(true);
  });
});
