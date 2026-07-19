/**
 * In-memory Strava auth-state store tests. Faithful mirror of
 * `ouraAuthStateStore.test.ts`, minus `codeVerifier` (Strava's auth-
 * state record carries no PKCE verifier — see `stravaAuthStateStore.ts`).
 *
 * Covers:
 *   - put: empty state rejected
 *   - consume: missing state -> null
 *   - happy: put then consume returns the record verbatim
 *   - SINGLE-USE: a second consume of the same state returns null
 *     even if still within TTL (replay protection)
 *   - expired record -> null AND is deleted (cannot be revived by
 *     a later consume regardless of clock movement)
 *   - ttlMs override is respected
 *   - put with the same state twice is treated as overwrite (last
 *     write wins)
 */
import { describe, it, expect } from "vitest";
import {
  createInMemoryStravaAuthStateStore,
  type StravaAuthStateRecord,
} from "../stravaAuthStateStore";

function rec(overrides: Partial<StravaAuthStateRecord> = {}): StravaAuthStateRecord {
  return {
    userId: "user_1",
    createdAtMs: 1_000_000,
    ...overrides,
  };
}

describe("createInMemoryStravaAuthStateStore", () => {
  it("rejects an empty state on put", async () => {
    const store = createInMemoryStravaAuthStateStore();
    await expect(store.put("", rec())).rejects.toThrow(/non-empty/);
  });

  it("consume on a never-issued state returns null", async () => {
    const store = createInMemoryStravaAuthStateStore();
    expect(await store.consume("nope", 0)).toBeNull();
  });

  it("put then consume returns the record verbatim", async () => {
    const store = createInMemoryStravaAuthStateStore();
    const r = rec({ userId: "u1", createdAtMs: 100 });
    await store.put("s1", r);
    expect(await store.consume("s1", 100)).toEqual(r);
  });

  it("is single-use — a second consume returns null even within TTL", async () => {
    const store = createInMemoryStravaAuthStateStore({ ttlMs: 60_000 });
    await store.put("s1", rec({ createdAtMs: 0 }));
    expect(await store.consume("s1", 1_000)).not.toBeNull();
    expect(await store.consume("s1", 1_001)).toBeNull();
  });

  it("expired records return null AND are deleted (no clock-rewind revive)", async () => {
    const store = createInMemoryStravaAuthStateStore({ ttlMs: 1_000 });
    await store.put("s1", rec({ createdAtMs: 0 }));
    expect(await store.consume("s1", 5_000)).toBeNull();
    expect(await store.consume("s1", 0)).toBeNull();
  });

  it("respects a custom ttlMs", async () => {
    const store = createInMemoryStravaAuthStateStore({ ttlMs: 50 });
    await store.put("s1", rec({ createdAtMs: 0 }));
    expect(await store.consume("s1", 49)).not.toBeNull();
    await store.put("s2", rec({ createdAtMs: 0 }));
    expect(await store.consume("s2", 51)).toBeNull();
  });

  it("put with the same state twice is last-write-wins (defensive)", async () => {
    const store = createInMemoryStravaAuthStateStore();
    await store.put("s1", rec({ userId: "u1" }));
    await store.put("s1", rec({ userId: "u2" }));
    const got = await store.consume("s1", rec().createdAtMs);
    expect(got?.userId).toBe("u2");
  });
});
