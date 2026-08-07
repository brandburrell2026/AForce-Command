/**
 * Tests for `providerKit/fetchWorker.ts` — the provider-agnostic
 * biometrics fetch-worker orchestration extracted from
 * `whoopFetchWorker.ts`'s `runWhoopFetchOnce` pattern.
 *
 * Faithful in spirit to `whoopFetchWorker.test.ts` / `ouraFetchWorker.test.ts`,
 * generalized to the kit's `createProviderFetchWorker` factory. Pure
 * unit tests with hand-rolled in-memory deps — no Postgres, no HTTP.
 */
import { describe, it, expect, vi } from "vitest";
import {
  createProviderFetchWorker,
  type ProviderTokenManagerLike,
} from "../providerKit/fetchWorker";
import type { UserStateRepo } from "../providerKit/userStateRepo";

interface FakeRow {
  biometrics: Record<string, unknown> | null;
}

function inMemoryStateRepo(initial: Map<string, FakeRow>): UserStateRepo & {
  writes: Array<{ userId: string; providerKey: string; entry: unknown }>;
  rows: Map<string, FakeRow>;
} {
  const writes: Array<{ userId: string; providerKey: string; entry: unknown }> = [];
  return {
    writes,
    rows: initial,
    async readProviderEntry(userId, providerKey) {
      const row = initial.get(userId);
      if (!row || !row.biometrics) return null;
      return (
        (row.biometrics[providerKey] as Record<string, unknown> | undefined) ??
        null
      );
    },
    async writeProviderEntry(userId, providerKey, entry) {
      const row = initial.get(userId);
      if (!row) return false;
      writes.push({ userId, providerKey, entry });
      const next = { ...(row.biometrics ?? {}) };
      next[providerKey] = entry;
      row.biometrics = next;
      return true;
    },
  };
}

function fakeTokenManager(token: string | null): ProviderTokenManagerLike {
  return { getValidAccessToken: async () => token };
}

interface Snapshot {
  readinessScore: number;
}

const SAMPLE: Snapshot = { readinessScore: 82 };

function makeWorker() {
  return createProviderFetchWorker<Snapshot>({
    provider: "Garmin",
    toBlob: (s, fetchedAt) => ({
      providerId: "garmin",
      fetchedAt,
      readinessScore: s.readinessScore,
    }),
  });
}

describe("createProviderFetchWorker.runOnce", () => {
  it("returns 'error' on empty userId, without calling the fetcher", async () => {
    const fetcher = vi.fn();
    const out = await makeWorker().runOnce("", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: inMemoryStateRepo(new Map()),
      snapshotFetcher: fetcher,
    });
    expect(out.status).toBe("error");
    expect(out.error).toMatch(/empty userId/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns 'skipped_no_token' when the manager has no tokens", async () => {
    const fetcher = vi.fn();
    const repo = inMemoryStateRepo(new Map([["u1", { biometrics: null }]]));
    const out = await makeWorker().runOnce("u1", {
      tokenManager: fakeTokenManager(null),
      stateRepo: repo,
      snapshotFetcher: fetcher,
    });
    expect(out.status).toBe("skipped_no_token");
    expect(fetcher).not.toHaveBeenCalled();
    expect(repo.writes).toHaveLength(0);
  });

  it("treats a token-resolution throw as 'skipped_no_token' (defensive)", async () => {
    const out = await makeWorker().runOnce("u1", {
      tokenManager: {
        getValidAccessToken: async () => {
          throw new Error("boom");
        },
      },
      stateRepo: inMemoryStateRepo(new Map()),
      snapshotFetcher: async () => SAMPLE,
    });
    expect(out.status).toBe("skipped_no_token");
  });

  it("returns 'skipped_no_state' when no state row exists (write returns false)", async () => {
    const repo = inMemoryStateRepo(new Map());
    const out = await makeWorker().runOnce("ghost", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => SAMPLE,
    });
    expect(out.status).toBe("skipped_no_state");
    expect(repo.writes).toHaveLength(0);
  });

  it("happy path: writes only the lowercased provider key with the toBlob() output + fetchedAt", async () => {
    const repo = inMemoryStateRepo(
      new Map([
        ["u1", { biometrics: { whoop: { providerId: "whoop", fetchedAt: 1 } } }],
      ]),
    );
    const out = await makeWorker().runOnce("u1", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => SAMPLE,
      nowMs: () => 9_999,
    });
    expect(out.status).toBe("ok");
    expect(out.fetchedAt).toBe(9_999);
    expect(out.snapshot).toEqual(SAMPLE);
    expect(repo.writes).toHaveLength(1);
    expect(repo.writes[0]!.providerKey).toBe("garmin");
    expect(repo.writes[0]!.entry).toEqual({
      providerId: "garmin",
      fetchedAt: 9_999,
      readinessScore: 82,
    });
    // Merge preserves other providers (mirrors jsonb_set behaviour).
    expect(repo.rows.get("u1")!.biometrics).toMatchObject({
      whoop: { providerId: "whoop", fetchedAt: 1 },
      garmin: { providerId: "garmin", fetchedAt: 9_999 },
    });
  });

  it("fetcher throw -> 'error' with sanitized message (no token leak)", async () => {
    const out = await makeWorker().runOnce("u1", {
      tokenManager: fakeTokenManager("AT-SECRET-TOKEN"),
      stateRepo: inMemoryStateRepo(new Map([["u1", { biometrics: null }]])),
      snapshotFetcher: async () => {
        throw new Error("AT-SECRET-TOKEN leaked into err.message");
      },
    });
    expect(out.status).toBe("error");
    expect(out.error).toBe("Error");
    expect(out.error).not.toMatch(/SECRET/);
  });

  it("writer throw -> 'error' with sanitized message", async () => {
    const repo: UserStateRepo = {
      async readProviderEntry() {
        return null;
      },
      async writeProviderEntry() {
        throw new TypeError("db down");
      },
    };
    const out = await makeWorker().runOnce("u1", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => SAMPLE,
    });
    expect(out.status).toBe("error");
    expect(out.error).toBe("TypeError");
  });

  it("empty-string token from the manager is treated as no-token (skips before the fetcher runs)", async () => {
    const fetcher = vi.fn();
    const repo = inMemoryStateRepo(new Map([["u1", { biometrics: null }]]));
    const out = await makeWorker().runOnce("u1", {
      tokenManager: fakeTokenManager(""),
      stateRepo: repo,
      snapshotFetcher: fetcher,
    });
    expect(out.status).toBe("skipped_no_token");
    expect(fetcher).not.toHaveBeenCalled();
    expect(repo.writes).toHaveLength(0);
  });

  it("uses Date.now by default when nowMs is omitted", async () => {
    const repo = inMemoryStateRepo(new Map([["u1", { biometrics: null }]]));
    const before = Date.now();
    const out = await makeWorker().runOnce("u1", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => SAMPLE,
    });
    const after = Date.now();
    expect(out.fetchedAt).toBeGreaterThanOrEqual(before);
    expect(out.fetchedAt).toBeLessThanOrEqual(after);
  });

  it("lowercases a mixed-case provider name for the biometrics key", async () => {
    const repo = inMemoryStateRepo(new Map([["u1", { biometrics: null }]]));
    const worker = createProviderFetchWorker<Snapshot>({
      provider: "STRAVA",
      toBlob: (s, fetchedAt) => ({ providerId: "strava", fetchedAt, ...s }),
    });
    const out = await worker.runOnce("u1", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => SAMPLE,
    });
    expect(out.status).toBe("ok");
    expect(repo.writes[0]!.providerKey).toBe("strava");
  });

  describe("Founder Ruling C (RC-2 arbitration freshness, 2026-08-06)", () => {
    it("identical content across sweeps -> stored fetchedAt is PRESERVED, not restamped", async () => {
      const repo = inMemoryStateRepo(
        new Map([
          [
            "u1",
            {
              biometrics: {
                garmin: { providerId: "garmin", fetchedAt: 1_000, readinessScore: 82 },
              },
            },
          ],
        ]),
      );
      const out = await makeWorker().runOnce("u1", {
        tokenManager: fakeTokenManager("AT"),
        stateRepo: repo,
        snapshotFetcher: async () => SAMPLE, // same { readinessScore: 82 }
        nowMs: () => 9_999,
      });
      expect(out.status).toBe("ok");
      // The sweep ran "now" but the content is byte-identical to what's
      // stored — fetchedAt must stay at the ORIGINAL value, not jump to 9999.
      expect(out.fetchedAt).toBe(1_000);
      expect(repo.writes[0]!.entry).toEqual({
        providerId: "garmin",
        fetchedAt: 1_000,
        readinessScore: 82,
      });
    });

    it("changed content -> fetchedAt ADVANCES to now", async () => {
      const repo = inMemoryStateRepo(
        new Map([
          [
            "u1",
            {
              biometrics: {
                garmin: { providerId: "garmin", fetchedAt: 1_000, readinessScore: 40 },
              },
            },
          ],
        ]),
      );
      const out = await makeWorker().runOnce("u1", {
        tokenManager: fakeTokenManager("AT"),
        stateRepo: repo,
        snapshotFetcher: async () => SAMPLE, // { readinessScore: 82 } — different
        nowMs: () => 9_999,
      });
      expect(out.status).toBe("ok");
      expect(out.fetchedAt).toBe(9_999);
      expect(repo.writes[0]!.entry).toEqual({
        providerId: "garmin",
        fetchedAt: 9_999,
        readinessScore: 82,
      });
    });

    it("first-ever write for a provider key (nothing stored) -> stamps now, no preserve", async () => {
      const repo = inMemoryStateRepo(new Map([["u1", { biometrics: null }]]));
      const out = await makeWorker().runOnce("u1", {
        tokenManager: fakeTokenManager("AT"),
        stateRepo: repo,
        snapshotFetcher: async () => SAMPLE,
        nowMs: () => 9_999,
      });
      expect(out.status).toBe("ok");
      expect(out.fetchedAt).toBe(9_999);
    });

    it("a read-before-write throw fails OPEN to a fresh timestamp (never freezes fetchedAt)", async () => {
      const repo = inMemoryStateRepo(
        new Map([
          [
            "u1",
            {
              biometrics: {
                garmin: { providerId: "garmin", fetchedAt: 1_000, readinessScore: 82 },
              },
            },
          ],
        ]),
      );
      repo.readProviderEntry = async () => {
        throw new Error("read boom");
      };
      const out = await makeWorker().runOnce("u1", {
        tokenManager: fakeTokenManager("AT"),
        stateRepo: repo,
        snapshotFetcher: async () => SAMPLE, // identical content to stored
        nowMs: () => 9_999,
      });
      expect(out.status).toBe("ok");
      // Even though content is identical, the read threw -> fail open to "now".
      expect(out.fetchedAt).toBe(9_999);
    });

    it("three sweeps with unchanged content preserve the ORIGINAL fetchedAt across all three (whoop-vs-apple device scenario)", async () => {
      const repo = inMemoryStateRepo(
        new Map([["u1", { biometrics: null }]]),
      );
      const worker = createProviderFetchWorker<Snapshot>({
        provider: "Whoop",
        toBlob: (s, fetchedAt) => ({ providerId: "whoop", fetchedAt, ...s }),
      });
      const sweep = (nowMs: number) =>
        worker.runOnce("u1", {
          tokenManager: fakeTokenManager("AT"),
          stateRepo: repo,
          snapshotFetcher: async () => SAMPLE,
          nowMs: () => nowMs,
        });

      const first = await sweep(1_000); // initial connect / first sweep
      expect(first.fetchedAt).toBe(1_000);

      const second = await sweep(31_000); // ~30s later, WHOOP data unchanged
      expect(second.fetchedAt).toBe(1_000);

      const third = await sweep(61_000); // another ~30s, still unchanged
      expect(third.fetchedAt).toBe(1_000);

      // A same-key second-provider write (e.g. Apple Health, written by a
      // different path entirely) is out of scope for this worker — the
      // regression this proves is narrower and sufficient: WHOOP's own
      // restamped fetchedAt never leapfrogs forward on unchanged polls,
      // which is the precondition for the client aggregator to be able to
      // compare it fairly against a freshly-synced Apple Health fetchedAt.
    });
  });
});
