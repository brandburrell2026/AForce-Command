/**
 * Tests for the Garmin fetch worker orchestration. Faithful mirror of
 * `stravaFetchWorker.test.ts` / `whoopFetchWorker.test.ts`.
 *
 * Pure unit tests with hand-rolled in-memory deps. No Postgres, no
 * HTTP. Each test pins one branch of the state machine.
 *
 * Previously untested: `runGarminMockAdapter.test.ts` only exercises
 * the mock HTTP adapter + health-core normalization, never
 * `runGarminFetchOnce` itself. This file closes that gap AND covers
 * Founder Ruling C (RC-2 arbitration freshness, 2026-08-06).
 *
 * Covers:
 *   - no token stored -> 'skipped_no_token', no fetch, no write
 *   - token resolution throws (defensive) -> 'skipped_no_token'
 *   - no state row -> 'skipped_no_state' (writeProviderEntry returns
 *     false), no biometrics mutation
 *   - happy path -> 'ok', writes ONLY the 'garmin' key with the
 *     correct provider blob, stamps fetchedAt
 *   - fetcher throws -> 'error' with sanitized message (no token leak)
 *   - writer throws -> 'error' with sanitized message
 *   - empty userId -> 'error'
 *   - default-fetcher seam: empty token -> skipped_no_token
 *   - Ruling C: identical content across sweeps preserves fetchedAt;
 *     changed content advances it
 *
 * `@workspace/db` is mocked below: `garminFetchWorker.ts` (via
 * `./whoopFetchWorker`) imports real Drizzle bindings from it at module
 * scope, and that package throws at IMPORT time when `DATABASE_URL` is
 * unset (see `lib/db/src/index.ts`). This file's own tests never touch
 * a real database — every test injects `stateRepo`/`tokenManager`
 * directly into `runGarminFetchOnce`, never calling
 * `buildDefaultGarminFetchDeps` — so the mock only needs to satisfy the
 * module graph's import bindings, not behave like a real DB. Without
 * this, the file would need a real `DATABASE_URL` just to LOAD, which
 * would needlessly inflate the CI baseline's failed-file count with a
 * failure this suite doesn't actually have (see
 * `governance/TEST-BASELINE.md` "Cause B").
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  createDrizzleGarminTokenStoreForUser: vi.fn(),
  aforceWhoopTokens: {},
  createDrizzleWhoopTokenStoreForUser: vi.fn(),
  aforceUserState: {},
}));

import {
  runGarminFetchOnce,
  type GarminSnapshotFetcher,
} from "../garminFetchWorker";
import type { UserStateRepo } from "../whoopFetchWorker";
import { EMPTY_GARMIN_SNAPSHOT, type GarminSnapshot } from "../garminSnapshot";

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

function fakeTokenManager(token: string | null): {
  getValidAccessToken: () => Promise<string | null>;
} {
  return { getValidAccessToken: async () => token };
}

const SAMPLE_SNAPSHOT: GarminSnapshot = {
  restingHeartRate: 56,
  hrvMs: 62,
  sleepHoursLastNight: 7.2,
  stress: 28,
  steps: 8120,
};

describe("runGarminFetchOnce", () => {
  it("returns 'error' on empty userId", async () => {
    const out = await runGarminFetchOnce("", {
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
    const out = await runGarminFetchOnce("u1", {
      tokenManager: fakeTokenManager(null),
      stateRepo: repo,
      snapshotFetcher: fetcher as unknown as GarminSnapshotFetcher,
    });
    expect(out.status).toBe("skipped_no_token");
    expect(fetcher).not.toHaveBeenCalled();
    expect(repo.writes).toHaveLength(0);
  });

  it("treats a token-resolution throw as 'skipped_no_token' (defensive)", async () => {
    const out = await runGarminFetchOnce("u1", {
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
    const out = await runGarminFetchOnce("ghost", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => SAMPLE_SNAPSHOT,
    });
    expect(out.status).toBe("skipped_no_state");
    expect(repo.writes).toHaveLength(0);
  });

  it("happy path: writes only the 'garmin' provider key with the snapshot blob + fetchedAt", async () => {
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
    const out = await runGarminFetchOnce("u1", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => SAMPLE_SNAPSHOT,
      nowMs: () => 9_999,
    });
    expect(out.status).toBe("ok");
    expect(out.fetchedAt).toBe(9_999);
    expect(out.snapshot).toEqual(SAMPLE_SNAPSHOT);
    expect(repo.writes).toHaveLength(1);
    expect(repo.writes[0]!.providerKey).toBe("garmin");
    expect(repo.writes[0]!.entry).toMatchObject({
      providerId: "garmin",
      fetchedAt: 9_999,
      restingHeartRate: 56,
      hrvMs: 62,
      sleepHoursLastNight: 7.2,
      stress: 28,
      steps: 8120,
    });
    // The fake repo merges; verify whoop was preserved by the merge
    // path (mirrors the jsonb_set behaviour the real repo gets from
    // Postgres).
    expect(repo.rows.get("u1")!.biometrics).toMatchObject({
      whoop: { providerId: "whoop", fetchedAt: 1 },
      garmin: { providerId: "garmin", fetchedAt: 9_999 },
    });
  });

  it("fetcher throw -> 'error' with sanitized message (no token leak)", async () => {
    const out = await runGarminFetchOnce("u1", {
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
    const out = await runGarminFetchOnce("u1", {
      tokenManager: fakeTokenManager("AT"),
      stateRepo: repo,
      snapshotFetcher: async () => EMPTY_GARMIN_SNAPSHOT,
    });
    expect(out.status).toBe("error");
    expect(out.error).toBe("TypeError");
  });

  it("default fetcher seam: empty token from manager skips before HTTP wiring runs", async () => {
    const repo = inMemoryStateRepo(new Map([["u1", { biometrics: null }]]));
    const out = await runGarminFetchOnce("u1", {
      tokenManager: fakeTokenManager(""),
      stateRepo: repo,
    });
    expect(out.status).toBe("skipped_no_token");
    expect(repo.writes).toHaveLength(0);
  });

  describe("Founder Ruling C (RC-2 arbitration freshness, 2026-08-06)", () => {
    it("identical Garmin content across repeated sweeps -> stored fetchedAt is PRESERVED", async () => {
      const repo = inMemoryStateRepo(
        new Map([
          [
            "u1",
            {
              biometrics: {
                garmin: { providerId: "garmin", fetchedAt: 1_000, ...SAMPLE_SNAPSHOT },
              },
            },
          ],
        ]),
      );
      const out = await runGarminFetchOnce("u1", {
        tokenManager: fakeTokenManager("AT"),
        stateRepo: repo,
        snapshotFetcher: async () => SAMPLE_SNAPSHOT,
        nowMs: () => 31_000,
      });
      expect(out.status).toBe("ok");
      expect(out.fetchedAt).toBe(1_000);
    });

    it("a changed Garmin field -> fetchedAt advances to now", async () => {
      const repo = inMemoryStateRepo(
        new Map([
          [
            "u1",
            {
              biometrics: {
                garmin: {
                  providerId: "garmin",
                  fetchedAt: 1_000,
                  ...SAMPLE_SNAPSHOT,
                  steps: 1,
                },
              },
            },
          ],
        ]),
      );
      const out = await runGarminFetchOnce("u1", {
        tokenManager: fakeTokenManager("AT"),
        stateRepo: repo,
        snapshotFetcher: async () => SAMPLE_SNAPSHOT, // steps: 8120
        nowMs: () => 31_000,
      });
      expect(out.status).toBe("ok");
      expect(out.fetchedAt).toBe(31_000);
    });
  });
});
