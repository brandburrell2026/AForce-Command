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
});
