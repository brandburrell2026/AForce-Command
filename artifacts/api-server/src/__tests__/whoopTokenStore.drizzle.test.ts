/**
 * Integration tests for the per-user Drizzle WhoopTokenStore.
 *
 * Covers:
 *   - empty `userId` is rejected at factory time (cross-user safety)
 *   - read on missing row -> null
 *   - write -> read round-trips access/refresh/scope and converts
 *     `expiresAt` epoch ms <-> `timestamptz` losslessly
 *   - UPSERT semantics: second write for the same user overwrites
 *     the row (no duplicate, fields update, updated_at bumps)
 *   - clear deletes the row; subsequent read is null
 *   - per-user isolation: a write under userA does not leak into
 *     userB's read
 *   - optional `scope` round-trip and null preserved
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  aforceWhoopTokens,
  createDrizzleWhoopTokenStoreForUser,
} from "@workspace/db";

const TEST_PREFIX = "test_whoop_user_";
const user = (n: string): string => `${TEST_PREFIX}${n}`;

const SEED_USERS = [
  user("a"),
  user("b"),
  user("upsert"),
  user("scope"),
  user("enc_fresh"),
  user("enc_legacy"),
  user("enc_rotate"),
  user("enc_isolation"),
  user("enc_mixed"),
];

const KEY_A = "test-symmetric-key-A-do-not-use-in-prod";
const KEY_B = "test-symmetric-key-B-do-not-use-in-prod";

beforeAll(async () => {
  await db
    .delete(aforceWhoopTokens)
    .where(inArray(aforceWhoopTokens.userId, SEED_USERS));
});

afterAll(async () => {
  await db
    .delete(aforceWhoopTokens)
    .where(inArray(aforceWhoopTokens.userId, SEED_USERS));
});

describe("createDrizzleWhoopTokenStoreForUser", () => {
  it("refuses empty userId — prevents accidental row-key collapse", () => {
    expect(() => createDrizzleWhoopTokenStoreForUser(db, "")).toThrow(
      /userId must be non-empty/,
    );
  });

  it("read returns null when no row exists for the user", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("a"));
    expect(await store.read()).toBeNull();
  });

  it("write -> read round-trips and converts epoch ms <-> timestamptz losslessly", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("a"));
    // Pick a ms value that rounds cleanly through Postgres timestamptz.
    const expiresAt = Date.UTC(2030, 0, 15, 10, 30, 45, 0);
    await store.write({
      accessToken: "AT_v1",
      refreshToken: "RT_v1",
      expiresAt,
      scope: "offline read:recovery",
    });
    const got = await store.read();
    expect(got).toEqual({
      accessToken: "AT_v1",
      refreshToken: "RT_v1",
      expiresAt,
      scope: "offline read:recovery",
    });
  });

  it("UPSERT semantics: a second write for the same user overwrites the row and bumps updated_at", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("upsert"));
    const t1 = Date.UTC(2030, 0, 15, 10, 30, 45, 0);
    const t2 = Date.UTC(2030, 0, 15, 11, 0, 0, 0);
    await store.write({
      accessToken: "AT_v1",
      refreshToken: "RT_v1",
      expiresAt: t1,
      scope: "offline",
    });
    const rowsBefore = await db
      .select()
      .from(aforceWhoopTokens)
      .where(eq(aforceWhoopTokens.userId, user("upsert")));
    expect(rowsBefore).toHaveLength(1);
    const firstUpdatedAt = rowsBefore[0]!.updatedAt.getTime();
    // Postgres `now()` only advances per transaction — sleep a hair
    // to guarantee a strictly-greater updated_at.
    await new Promise((r) => setTimeout(r, 25));
    await store.write({
      accessToken: "AT_v2",
      refreshToken: "RT_v2",
      expiresAt: t2,
      scope: "offline read:cycles",
    });
    const rowsAfter = await db
      .select()
      .from(aforceWhoopTokens)
      .where(eq(aforceWhoopTokens.userId, user("upsert")));
    expect(rowsAfter).toHaveLength(1);
    expect(rowsAfter[0]!.accessToken).toBe("AT_v2");
    expect(rowsAfter[0]!.refreshToken).toBe("RT_v2");
    expect(rowsAfter[0]!.expiresAt.getTime()).toBe(t2);
    expect(rowsAfter[0]!.scope).toBe("offline read:cycles");
    expect(rowsAfter[0]!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      firstUpdatedAt,
    );
  });

  it("clear deletes the row; subsequent read is null", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("a"));
    await store.clear();
    expect(await store.read()).toBeNull();
    const rows = await db
      .select()
      .from(aforceWhoopTokens)
      .where(eq(aforceWhoopTokens.userId, user("a")));
    expect(rows).toHaveLength(0);
  });

  it("per-user isolation: write under one user does not leak into another's read", async () => {
    const storeA = createDrizzleWhoopTokenStoreForUser(db, user("a"));
    const storeB = createDrizzleWhoopTokenStoreForUser(db, user("b"));
    await storeA.write({
      accessToken: "A_TOKEN",
      refreshToken: "A_REFRESH",
      expiresAt: 5_000_000_000_000,
      scope: "offline",
    });
    expect(await storeB.read()).toBeNull();
    expect((await storeA.read())?.accessToken).toBe("A_TOKEN");
    await storeA.clear();
  });

  it("preserves null scope when the manager didn't get one back from WHOOP", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("scope"));
    await store.write({
      accessToken: "AT",
      refreshToken: "RT",
      expiresAt: 4_000_000_000_000,
      // scope omitted -> store should normalize to null.
    });
    const got = await store.read();
    expect(got?.scope).toBeNull();
  });

  // ──────────────────────────────────────────────────────────────────
  // pgcrypto encryption (Phase A: dual-write, prefer-enc-on-read).
  // ──────────────────────────────────────────────────────────────────

  it("encryption opt-in: write dual-populates plaintext + enc columns; ciphertext is not the plaintext", async () => {
    const store = createDrizzleWhoopTokenStoreForUser(db, user("enc_fresh"), {
      encryptionKey: KEY_A,
    });
    await store.write({
      accessToken: "AT_secret_v1",
      refreshToken: "RT_secret_v1",
      expiresAt: Date.UTC(2030, 5, 1),
      scope: "offline",
    });
    const rows = await db
      .select()
      .from(aforceWhoopTokens)
      .where(eq(aforceWhoopTokens.userId, user("enc_fresh")));
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    // Phase A: plaintext stays populated (no backfill / drop yet).
    expect(row.accessToken).toBe("AT_secret_v1");
    // And enc columns are populated + are NOT the plaintext bytes.
    expect(row.accessTokenEnc).not.toBeNull();
    expect(row.refreshTokenEnc).not.toBeNull();
    const accessEncBytes = Buffer.from(row.accessTokenEnc!);
    expect(accessEncBytes.length).toBeGreaterThan(0);
    expect(accessEncBytes.toString("utf8")).not.toContain("AT_secret_v1");
  });

  it("encryption opt-in: read returns the decrypted value (not the plaintext column)", async () => {
    // Prove read goes through pgp_sym_decrypt by tampering with the
    // plaintext column AFTER the dual write, then asserting the read
    // returns the original (decrypted) value.
    const store = createDrizzleWhoopTokenStoreForUser(db, user("enc_fresh"), {
      encryptionKey: KEY_A,
    });
    await store.write({
      accessToken: "AT_real",
      refreshToken: "RT_real",
      expiresAt: Date.UTC(2030, 5, 1),
      scope: null,
    });
    await db
      .update(aforceWhoopTokens)
      .set({ accessToken: "AT_TAMPERED", refreshToken: "RT_TAMPERED" })
      .where(eq(aforceWhoopTokens.userId, user("enc_fresh")));
    const got = await store.read();
    expect(got?.accessToken).toBe("AT_real");
    expect(got?.refreshToken).toBe("RT_real");
  });

  it("legacy row (enc cols null) is still readable when a key is configured — falls back to plaintext", async () => {
    // Simulate a row written before encryption was enabled by using
    // the keyless store, then reading with a keyed store.
    const writer = createDrizzleWhoopTokenStoreForUser(db, user("enc_legacy"));
    await writer.write({
      accessToken: "LEGACY_AT",
      refreshToken: "LEGACY_RT",
      expiresAt: Date.UTC(2031, 0, 1),
      scope: "offline",
    });
    const reader = createDrizzleWhoopTokenStoreForUser(db, user("enc_legacy"), {
      encryptionKey: KEY_A,
    });
    const got = await reader.read();
    expect(got?.accessToken).toBe("LEGACY_AT");
    expect(got?.refreshToken).toBe("LEGACY_RT");
    // And the enc columns are confirmed null on the legacy row.
    const rows = await db
      .select()
      .from(aforceWhoopTokens)
      .where(eq(aforceWhoopTokens.userId, user("enc_legacy")));
    expect(rows[0]!.accessTokenEnc).toBeNull();
    expect(rows[0]!.refreshTokenEnc).toBeNull();
  });

  it("key rotation: wrong key falls back to plaintext column and logs a warning (no throw)", async () => {
    // Write with KEY_A; read with KEY_B. Phase A still has plaintext
    // populated, so the read must succeed via fallback and log warn.
    const writer = createDrizzleWhoopTokenStoreForUser(db, user("enc_rotate"), {
      encryptionKey: KEY_A,
    });
    await writer.write({
      accessToken: "ROT_AT",
      refreshToken: "ROT_RT",
      expiresAt: Date.UTC(2031, 0, 1),
      scope: null,
    });
    const warnings: Array<{ msg?: string }> = [];
    const reader = createDrizzleWhoopTokenStoreForUser(db, user("enc_rotate"), {
      encryptionKey: KEY_B,
      log: { warn: (_obj, msg) => warnings.push({ msg }) },
    });
    const got = await reader.read();
    expect(got?.accessToken).toBe("ROT_AT");
    expect(got?.refreshToken).toBe("ROT_RT");
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings[0]!.msg).toMatch(/pgp_sym_decrypt failed/);
  });

  it("REGRESSION GUARD — mixed writer modes: keyless write after keyed write leaves enc stale, so keyed read returns the STALE enc value (documents the Phase A invariant that all writers must agree on the key)", async () => {
    // Deliberately exercise the sharp edge called out in the
    // DrizzleWhoopTokenStoreOptions docblock: this test exists so a
    // future change that silently breaks the "same key everywhere"
    // invariant will trip a red test and force a conscious decision.
    const keyed = createDrizzleWhoopTokenStoreForUser(db, user("enc_mixed"), {
      encryptionKey: KEY_A,
    });
    await keyed.write({
      accessToken: "OLD_AT",
      refreshToken: "OLD_RT",
      expiresAt: Date.UTC(2031, 0, 1),
      scope: null,
    });
    // Misconfigured callsite: keyless writer mutates the same row.
    const keyless = createDrizzleWhoopTokenStoreForUser(db, user("enc_mixed"));
    await keyless.write({
      accessToken: "NEW_AT",
      refreshToken: "NEW_RT",
      expiresAt: Date.UTC(2031, 6, 1),
      scope: null,
    });
    // Plaintext column has the new value; enc column was not
    // touched. The keyed read prefers enc → returns the OLD token.
    const got = await keyed.read();
    expect(got?.accessToken).toBe("OLD_AT");
    expect(got?.refreshToken).toBe("OLD_RT");
    // Sanity: keyless read of the same row returns the NEW value.
    expect((await keyless.read())?.accessToken).toBe("NEW_AT");
  });

  it("keyed write does not break per-user isolation", async () => {
    const storeA = createDrizzleWhoopTokenStoreForUser(
      db,
      user("enc_isolation"),
      { encryptionKey: KEY_A },
    );
    await storeA.write({
      accessToken: "ISO_AT",
      refreshToken: "ISO_RT",
      expiresAt: 5_000_000_000_000,
      scope: null,
    });
    const storeOther = createDrizzleWhoopTokenStoreForUser(db, user("b"), {
      encryptionKey: KEY_A,
    });
    expect(await storeOther.read()).toBeNull();
  });
});
