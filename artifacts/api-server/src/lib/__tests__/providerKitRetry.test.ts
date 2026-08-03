/**
 * Tests for `providerKit/retry.ts` — provider-agnostic error
 * classification + deterministic exponential backoff. New shared
 * plumbing (see the module doc); not a rename of existing WHOOP/Oura
 * behavior, so this is the only place these contracts are pinned.
 */
import { describe, it, expect } from "vitest";
import { classifyProviderError, backoffMs } from "../providerKit/retry";

describe("classifyProviderError", () => {
  it.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate_limit"],
    [500, "transient"],
    [502, "transient"],
    [503, "transient"],
    [599, "transient"],
    [400, "permanent"],
    [404, "permanent"],
    [422, "permanent"],
    [499, "permanent"],
  ] as const)("status %d -> %s", (status, expected) => {
    expect(classifyProviderError(status)).toBe(expected);
  });

  it("no status (thrown network error) -> transient", () => {
    expect(classifyProviderError(undefined, new Error("ECONNRESET"))).toBe(
      "transient",
    );
  });

  it("no status and no error -> transient", () => {
    expect(classifyProviderError()).toBe("transient");
  });

  it("a non-finite status falls back to transient rather than throwing", () => {
    expect(classifyProviderError(Number.NaN)).toBe("transient");
  });
});

describe("backoffMs", () => {
  it("matches the exponential formula baseMs * 2^(attempt-1)", () => {
    expect(backoffMs(1, 250)).toBe(250);
    expect(backoffMs(2, 250)).toBe(500);
    expect(backoffMs(3, 250)).toBe(1_000);
    expect(backoffMs(4, 250)).toBe(2_000);
  });

  it("is deterministic — no jitter, same inputs always produce the same output", () => {
    const a = backoffMs(3, 500);
    const b = backoffMs(3, 500);
    expect(a).toBe(b);
  });

  it("caps at the default 30_000ms ceiling", () => {
    expect(backoffMs(20, 1_000)).toBe(30_000);
  });

  it("respects a custom capMs", () => {
    expect(backoffMs(10, 1_000, { capMs: 5_000 })).toBe(5_000);
  });

  it("rejects attempt < 1", () => {
    expect(() => backoffMs(0, 100)).toThrow(/attempt must be >= 1/);
    expect(() => backoffMs(-1, 100)).toThrow(/attempt must be >= 1/);
  });

  it("rejects a negative baseMs", () => {
    expect(() => backoffMs(1, -10)).toThrow(/baseMs must be >= 0/);
  });

  it("baseMs of 0 is valid and always returns 0", () => {
    expect(backoffMs(1, 0)).toBe(0);
    expect(backoffMs(5, 0)).toBe(0);
  });
});
