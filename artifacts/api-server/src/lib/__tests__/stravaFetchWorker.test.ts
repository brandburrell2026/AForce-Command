/**
 * Tests for the Strava fetch worker orchestration. Faithful mirror of
 * `ouraFetchWorker.test.ts`.
 *
 * Pure unit tests with hand-rolled in-memory deps. No Postgres, no
 * HTTP. Each test pins one branch of the state machine.
 *
 * Covers:
 *   - no token stored -> 'skipped_no_token', no fetch, no write
 *   - token resolution throws (defensive) -> 'skipped_no_token'
 *   - no state row -> 'skipped_no_state' (writeProviderEntry returns
 *     false), no biometrics mutation
 *   - happy path -> 'ok', writes ONLY the 'strava' key with the correct
 *     provider blob, stamps fetchedAt
 *   - fetcher throws -> 'error' with sanitized message (no token leak)
 *   - writer throws -> 'error' with sanitized message
 *   - empty userId -> 'error'
 *   - default-fetcher seam: empty token -> skipped_no_token
 */
import { describe, it, expect, vi } from "vitest";
import {
  runStravaFetchOnce,
  type StravaSnapshotFetcher,
} from "../stravaFetchWorker";
import type { UserStateRepo } from "../whoopFetchWorker";
import { EMPTY_STRAVA_SNAPSHOT, type StravaSnapshot } from "../stravaSnapshot";

interface FakeRow {
  biometrics: Record<string, unknown> | null;
}

function inMemoryStateRepo(initial: Map<string, FakeRow>): UserStateRepo & {
  writes: Array<{ userId: string; providerKey: string; entry: unknown }>;
  rows: Map<string, FakeRow>;
} {
  const writes: Array<{
    userId: string;
    providerKey: string;
    entry: unknown;
  }> = [];
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

function fakeTokenManager(token: string | null): {
  getValidAccessToken: () => Promise<string | null>;
} {
  return { getValidAccessToken: async () => token };
}

const SAMPLE_SNAPSHOT: StravaSnapshot = {
  workoutMinutesToday: 45,
  trainingLoad: 55,
};

describe("runStravaFetchOnce", () => {
  it("returns 'error' on empty userId", async () => {
    const out = await runStravaFetchOnce("", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: inMemoryStateRepo(new Map()),
      snapshotFetcher: async () => SAMPLE_SNAPSHOT,
    });
    expect(out.status).toBe("error");
    expect(out.error).toMatch(/empty userId/);
  });

  it("returns 'skipped_no_token' when manager has no tokens", async () => {
    const fetcher = vi.fn();
    const repo = inMemoryStateRepo(new Map([["u1", { biometrics: null }]]));
    const out = await runStravaFetchOnce("u1", {
      tokenManager: fakeTokenManager(null),
      stateRepo: repo,
      snapshotFetcher: fetcher as unknown as StravaSnapshotFetcher,
    });
    expect(out.status).toBe("skipped_no_token");
    expect(fetcher).not.toHaveBeenCalled();
    expect(repo.writes).toHaveLength(0);
  });

  it("treats a token-resolution throw as 'skipped_no_token' (defensive)", async () => {
    const out = await runStravaFetchOnce("u1", {
      tokenManager: {
        getValidAccessToken: async () => {
          throw new Error("boom");
        },
      },
      stateRepo: inMemoryStateRepo(new Map()),
      snapshotFetcher: async () => SAMPLE_SNAPSHOT,
    });
    expect(out.status).toBe("skipped_no_token");
  });

  it("returns 'skipped_no_state' when no state row exists (write returns false)", async () => {
    const repo = inMemoryStateRepo(new Map());
    const out = await runStravaFetchOnce("ghost", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => SAMPLE_SNAPSHOT,
    });
    expect(out.status).toBe("skipped_no_state");
    expect(repo.writes).toHaveLength(0);
  });

  it("happy path: writes only the 'strava' provider key with the snapshot blob + fetchedAt", async () => {
    const repo = inMemoryStateRepo(
      new Map([
        [
          "u1",
          {
            biometrics: {
              whoop: { providerId: "whoop", fetchedAt: 1 },
            },
          },
        ],
      ]),
    );
    const out = await runStravaFetchOnce("u1", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => SAMPLE_SNAPSHOT,
      nowMs: () => 9_999,
    });
    expect(out.status).toBe("ok");
    expect(out.fetchedAt).toBe(9_999);
    expect(out.snapshot).toEqual(SAMPLE_SNAPSHOT);
    expect(repo.writes).toHaveLength(1);
    expect(repo.writes[0]!.providerKey).toBe("strava");
    expect(repo.writes[0]!.entry).toMatchObject({
      providerId: "strava",
      fetchedAt: 9_999,
      workoutMinutesToday: 45,
      trainingLoad: 55,
    });
    // The fake repo merges; verify whoop was preserved by the merge
    // path (mirrors the jsonb_set behaviour the real repo gets from
    // Postgres).
    expect(repo.rows.get("u1")!.biometrics).toMatchObject({
      whoop: { providerId: "whoop", fetchedAt: 1 },
      strava: { providerId: "strava", fetchedAt: 9_999 },
    });
  });

  it("fetcher throw -> 'error' with sanitized message (no token leak)", async () => {
    const out = await runStravaFetchOnce("u1", {
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
    const out = await runStravaFetchOnce("u1", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => EMPTY_STRAVA_SNAPSHOT,
    });
    expect(out.status).toBe("error");
    expect(out.error).toBe("TypeError");
  });

  it("default fetcher seam: empty token from manager skips before HTTP wiring runs", async () => {
    const repo = inMemoryStateRepo(new Map([["u1", { biometrics: null }]]));
    const out = await runStravaFetchOnce("u1", {
      tokenManager: fakeTokenManager(""),
      stateRepo: repo,
    });
    expect(out.status).toBe("skipped_no_token");
    expect(repo.writes).toHaveLength(0);
  });
});
