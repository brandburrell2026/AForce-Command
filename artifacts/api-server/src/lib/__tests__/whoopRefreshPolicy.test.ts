/**
 * WHOOP refresh policy — the founder-ratified numbers, pinned exactly.
 *
 * These are the parameters approved 2026-08-19
 * (governance/WHOOP-SWEEP-REDESIGN.md). The old 60-second sweep retried two
 * dead tokens every minute forever and kept Neon compute awake 24/7; this
 * policy is the replacement, and every threshold in it is a founder decision,
 * not an implementation convenience — so each is asserted by exact value, not
 * by shape.
 */
import { describe, it, expect } from "vitest";
import {
  WHOOP_DATA_FRESH_MS,
  WHOOP_BACKOFF_STEPS_MS,
  WHOOP_NEEDS_REAUTH_AFTER,
  whoopBackoffDelayMs,
  nextWhoopFailureState,
  isWhoopBlobFresh,
  resolveWhoopEligibility,
} from "../whoopRefreshPolicy";

const M = 60 * 1000;
const H = 60 * M;

describe("founder-ratified constants", () => {
  it("freshness threshold is exactly 30 minutes", () => {
    expect(WHOOP_DATA_FRESH_MS).toBe(30 * M);
  });

  it("backoff progression is exactly 30m → 1h → 2h → 4h → 8h → 16h → 24h cap", () => {
    expect(WHOOP_BACKOFF_STEPS_MS).toEqual([
      30 * M,
      1 * H,
      2 * H,
      4 * H,
      8 * H,
      16 * H,
      24 * H,
    ]);
  });

  it("needs_reauth latches at exactly 8 consecutive failures", () => {
    expect(WHOOP_NEEDS_REAUTH_AFTER).toBe(8);
  });
});

describe("backoff delay per consecutive failure", () => {
  it.each([
    [1, 30 * M],
    [2, 1 * H],
    [3, 2 * H],
    [4, 4 * H],
    [5, 8 * H],
    [6, 16 * H],
    [7, 24 * H],
  ] as const)("failure #%i backs off %i ms", (n, expected) => {
    expect(whoopBackoffDelayMs(n)).toBe(expected);
  });

  it("holds the 24h cap beyond the schedule — never grows, never resets", () => {
    for (const n of [8, 9, 20, 1000]) {
      expect(whoopBackoffDelayMs(n)).toBe(24 * H);
    }
  });

  it("degenerate inputs fall back to the first step, never throw", () => {
    expect(whoopBackoffDelayMs(0)).toBe(30 * M);
    expect(whoopBackoffDelayMs(-3)).toBe(30 * M);
    expect(whoopBackoffDelayMs(Number.NaN)).toBe(30 * M);
  });
});

describe("failure-state progression", () => {
  it("walks the exact ladder from a clean row and latches needs_reauth at 8", () => {
    const now = 1_000_000;
    let count: number | null = null;
    const expectedDelays = [30 * M, 1 * H, 2 * H, 4 * H, 8 * H, 16 * H, 24 * H, 24 * H];
    for (let failure = 1; failure <= 8; failure++) {
      const next = nextWhoopFailureState(count, now);
      expect(next.failureCount).toBe(failure);
      expect(next.backoffUntilMs).toBe(now + expectedDelays[failure - 1]!);
      expect(next.needsReauth).toBe(failure >= 8);
      count = next.failureCount;
    }
  });

  it("failures 1..7 do NOT set needs_reauth", () => {
    for (let prev = 0; prev < 7; prev++) {
      expect(nextWhoopFailureState(prev, 0).needsReauth).toBe(false);
    }
  });

  it("null/undefined history counts as zero prior failures", () => {
    expect(nextWhoopFailureState(null, 0).failureCount).toBe(1);
    expect(nextWhoopFailureState(undefined, 0).failureCount).toBe(1);
  });
});

describe("freshness", () => {
  const now = 10_000_000;

  it("data younger than the threshold is fresh", () => {
    expect(isWhoopBlobFresh(now - (30 * M - 1), now)).toBe(true);
  });

  it("data exactly at the threshold is STALE (strict less-than)", () => {
    expect(isWhoopBlobFresh(now - 30 * M, now)).toBe(false);
  });

  it("never-fetched (null) is stale", () => {
    expect(isWhoopBlobFresh(null, now)).toBe(false);
    expect(isWhoopBlobFresh(undefined, now)).toBe(false);
    expect(isWhoopBlobFresh(Number.NaN, now)).toBe(false);
  });
});

describe("eligibility resolution — precedence is deliberate", () => {
  const now = 10_000_000;
  const base = {
    blobFetchedAtMs: null,
    failureCount: null,
    backoffUntilMs: null,
    needsReauth: null,
  };

  it("clean stale connection → fetch", () => {
    expect(resolveWhoopEligibility(base, now)).toBe("fetch");
  });

  it("fresh data suppresses the fetch", () => {
    expect(
      resolveWhoopEligibility({ ...base, blobFetchedAtMs: now - 5 * M }, now),
    ).toBe("skipped_fresh");
  });

  it("stale data is eligible again", () => {
    expect(
      resolveWhoopEligibility({ ...base, blobFetchedAtMs: now - 31 * M }, now),
    ).toBe("fetch");
  });

  it("armed backoff suppresses even when the data is stale", () => {
    expect(
      resolveWhoopEligibility(
        { ...base, blobFetchedAtMs: now - 2 * H, backoffUntilMs: now + 1 },
        now,
      ),
    ).toBe("skipped_backoff");
  });

  it("an EXPIRED backoff permits the retry", () => {
    expect(
      resolveWhoopEligibility(
        { ...base, blobFetchedAtMs: now - 2 * H, backoffUntilMs: now - 1 },
        now,
      ),
    ).toBe("fetch");
  });

  it("needs_reauth suppresses everything — stale data, expired backoff, all of it", () => {
    expect(
      resolveWhoopEligibility(
        {
          blobFetchedAtMs: now - 48 * H,
          failureCount: 12,
          backoffUntilMs: now - 1 * H,
          needsReauth: true,
        },
        now,
      ),
    ).toBe("skipped_needs_reauth");
  });

  it("a cleared failure state (all nulls) behaves exactly like a new connection", () => {
    // This is the founder-ratified reset contract: successful refresh/re-auth
    // nulls the three columns, and NULLs must read as "no history".
    expect(
      resolveWhoopEligibility(
        { blobFetchedAtMs: now - 31 * M, failureCount: null, backoffUntilMs: null, needsReauth: null },
        now,
      ),
    ).toBe("fetch");
  });
});
