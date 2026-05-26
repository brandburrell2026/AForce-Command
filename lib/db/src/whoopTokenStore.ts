/**
 * WHOOP OAuth2 token store — server-side, per-user persistence.
 *
 * Mirrors the mobile `WhoopTokenStore` interface from
 * `artifacts/aforce-os/services/whoopAuth.ts` so the server-side
 * `WhoopTokenManager` can be a near-drop-in port. Differences from
 * mobile:
 *   - Mobile is single-user, device-bound (`expo-secure-store`).
 *   - Server is multi-user, Postgres-backed — every store is bound
 *     to a single `userId` via the factory functions below. Once
 *     bound, the read/write/clear interface is identical, which
 *     keeps the manager code shape-compatible with mobile.
 *
 * `expiresAt` semantics:
 *   - In-memory and in the manager: epoch ms (cheap arithmetic).
 *   - At the Postgres boundary: `timestamptz` for native ordering
 *     and index range scans. Converted at the store boundary.
 *
 * Architecture lock: hidden-infra. No UI / public route writes here
 * yet. The schema + store + manager land first; OAuth callback +
 * biometrics worker follow in later PRs.
 */

import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceWhoopTokens } from "./schema/aforce";

/** Same shape as mobile `WhoopTokens`. `expiresAt` is epoch ms. */
export interface WhoopTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  /** Space-separated scopes the user granted. Optional — null on
   *  legacy rows or when WHOOP didn't echo `scope` back. */
  scope?: string | null;
}

/**
 * Minimal logger shape — keeps this lib pino-free. The store only
 * needs `warn` (decrypt fallback) and `error` (unrecoverable).
 */
export interface WhoopTokenStoreLogger {
  warn: (obj: Record<string, unknown>, msg?: string) => void;
}

export interface DrizzleWhoopTokenStoreOptions {
  /**
   * **Phase A invariant — all writers in the same deployment MUST
   * agree on this key.** If some writers run keyed and others
   * keyless against the same row, the keyless writes will update the
   * plaintext column but leave the enc column stale; a subsequent
   * keyed read will then prefer the stale enc value and return an
   * outdated token. The runtime call sites (OAuth callback in
   * `routes/index.ts` and fetch sweep in `whoopFetchWorker.ts`) both
   * read the same `WHOOP_TOKEN_ENCRYPTION_KEY` env var to keep this
   * invariant. Any new writer must do the same.
   *
   * pgcrypto symmetric key. When set, the Drizzle store DUAL-WRITES
   * (plaintext column + `pgp_sym_encrypt(token, key)` ciphertext
   * column) and PREFERS the encrypted column on read. When the
   * ciphertext column is null (legacy row) OR `pgp_sym_decrypt`
   * throws (wrong key, corruption), the store falls back to the
   * plaintext column and the read still succeeds.
   *
   * **Hidden-infra contract**: unset (default) = unchanged behavior.
   * Plaintext-only writes/reads, encrypted columns stay null.
   *
   * **Rollout phase A** (this PR): dual-write + prefer-enc-on-read.
   * No backfill of legacy rows. Phase B (future) will backfill, flip
   * reads to enc-only, then drop the plaintext columns.
   */
  encryptionKey?: string | null;
  /** Optional logger for decrypt fallback / dual-write failure
   *  paths. Defaults to a no-op. */
  log?: WhoopTokenStoreLogger;
}

/**
 * Per-user storage adapter. Once a store is created it is bound to
 * a single `userId`; the manager doesn't need to know about user
 * identity, which keeps the mobile/server manager surfaces
 * identical.
 */
export interface WhoopTokenStore {
  read(): Promise<WhoopTokens | null>;
  write(t: WhoopTokens): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory store. Use for tests, local dev, and as a fallback
 *  when DB is unavailable. */
export function createInMemoryWhoopTokenStore(
  seed: WhoopTokens | null = null,
): WhoopTokenStore {
  let current: WhoopTokens | null = seed;
  return {
    async read() {
      return current;
    },
    async write(t) {
      current = { ...t };
    },
    async clear() {
      current = null;
    },
  };
}

/**
 * Phase B operational helper — encrypt plaintext columns into the
 * enc columns for rows that pre-date the encryption opt-in (or for
 * any row whose enc cols are NULL for any reason). Idempotent and
 * batched: only touches rows where at least one of the enc columns
 * is NULL, processes up to `batchSize` rows per call, and returns
 * the number of rows updated.
 *
 * Run from a cron (`maybeStartWhoopTokenBackfill`) until it returns
 * 0 for a sustained window, then ops can flip reads to enc-only and
 * eventually drop the plaintext columns (Phase C, separate PR).
 *
 * Safety:
 *   - Idempotent: WHERE access_token_enc IS NULL OR refresh_token_enc
 *     IS NULL — re-running on an already-encrypted row is a no-op.
 *   - Batched via a `user_id IN (SELECT ... LIMIT batchSize)` subquery
 *     (Postgres UPDATE has no LIMIT clause). Bounds row-lock blast
 *     radius and lets the cron make incremental progress without
 *     long-running transactions.
 *   - Same-key invariant: caller must pass the same key used by the
 *     runtime store factories. Mixing keys across backfill runs
 *     would leave rows decryptable only with whichever key wrote
 *     each individual ciphertext.
 *   - Does NOT touch plaintext columns. Phase B is purely additive
 *     enc fill; Phase C will drop plaintext.
 */
export async function backfillWhoopTokenEncryption(
  db: NodePgDatabase<Record<string, unknown>>,
  encryptionKey: string,
  batchSize: number,
): Promise<number> {
  if (typeof encryptionKey !== "string" || encryptionKey.trim() === "") {
    throw new Error(
      "backfillWhoopTokenEncryption: encryptionKey must be a non-empty string",
    );
  }
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(
      "backfillWhoopTokenEncryption: batchSize must be a positive number",
    );
  }
  // COALESCE on each enc column so a mixed row (one side already
  // encrypted, the other NULL) doesn't get its non-NULL side
  // needlessly re-encrypted with a fresh IV. The plaintext value of
  // a non-NULL encrypted column never changes here, so reads stay
  // byte-stable.
  const result = await db.execute<{ user_id: string }>(sql`
    update aforce_whoop_tokens
       set access_token_enc  = coalesce(
             access_token_enc,
             pgp_sym_encrypt(access_token, ${encryptionKey})
           ),
           refresh_token_enc = coalesce(
             refresh_token_enc,
             pgp_sym_encrypt(refresh_token, ${encryptionKey})
           ),
           updated_at        = now()
     where user_id in (
       select user_id from aforce_whoop_tokens
        where access_token_enc is null
           or refresh_token_enc is null
        limit ${batchSize}
        for update skip locked
     )
     returning user_id
  `);
  return result.rows.length;
}

/**
 * Per-user, Postgres-backed store. Pass the user's id once; the
 * returned store talks only about that user.
 */
export function createDrizzleWhoopTokenStoreForUser(
  db: NodePgDatabase<Record<string, unknown>>,
  userId: string,
  opts: DrizzleWhoopTokenStoreOptions = {},
): WhoopTokenStore {
  if (!userId) {
    // Refuse to bind to an empty user id — would otherwise let one
    // caller's tokens be read/written under the empty-string key
    // and cross-contaminate users at the row level.
    throw new Error(
      "createDrizzleWhoopTokenStoreForUser: userId must be non-empty",
    );
  }

  // Strict opt-in: only non-empty string keys enable encryption.
  // Empty/whitespace-only keys are a misconfiguration that would
  // otherwise yield trivially-decryptable ciphertext; refuse.
  const encryptionKey =
    typeof opts.encryptionKey === "string" && opts.encryptionKey.trim() !== ""
      ? opts.encryptionKey
      : null;
  const log = opts.log;

  return {
    async read() {
      if (encryptionKey) {
        // Prefer enc, fall back to plaintext on null OR decrypt
        // failure. COALESCE alone isn't enough because a wrong-key
        // decrypt throws (it doesn't return null), so we do the
        // fallback in two queries: try enc first, catch, fall back.
        try {
          const rows = await db.execute<{
            access_token: string;
            refresh_token: string;
            expires_at: Date;
            scope: string | null;
            access_token_enc_present: boolean;
            refresh_token_enc_present: boolean;
            access_token_dec: string | null;
            refresh_token_dec: string | null;
          }>(sql`
            select
              access_token,
              refresh_token,
              expires_at,
              scope,
              access_token_enc is not null as access_token_enc_present,
              refresh_token_enc is not null as refresh_token_enc_present,
              case when access_token_enc is not null
                then pgp_sym_decrypt(access_token_enc, ${encryptionKey})
                else null end as access_token_dec,
              case when refresh_token_enc is not null
                then pgp_sym_decrypt(refresh_token_enc, ${encryptionKey})
                else null end as refresh_token_dec
            from aforce_whoop_tokens
            where user_id = ${userId}
            limit 1
          `);
          const row = rows.rows[0];
          if (!row) return null;
          return {
            accessToken: row.access_token_dec ?? row.access_token,
            refreshToken: row.refresh_token_dec ?? row.refresh_token,
            expiresAt: new Date(row.expires_at).getTime(),
            scope: row.scope,
          };
        } catch (err) {
          // Wrong key / corrupted ciphertext — fall back to plaintext
          // column and log. Phase A guarantees plaintext is always
          // populated, so the user keeps working through a botched
          // key rotation; ops sees the warning.
          log?.warn(
            { err: err instanceof Error ? err.message : String(err), userId },
            "whoopTokenStore: pgp_sym_decrypt failed, falling back to plaintext column",
          );
        }
      }

      const rows = await db
        .select()
        .from(aforceWhoopTokens)
        .where(eq(aforceWhoopTokens.userId, userId))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        accessToken: row.accessToken,
        refreshToken: row.refreshToken,
        expiresAt: row.expiresAt.getTime(),
        scope: row.scope,
      };
    },
    async write(t) {
      // UPSERT — first connect writes the row; refreshes UPDATE in
      // place. `updated_at` bumps on every write for ops visibility.
      //
      // When a key is configured we DUAL-WRITE: plaintext columns
      // stay populated (Phase A), AND `pgp_sym_encrypt` ciphertext
      // lands in the enc columns. A raw `sql` template handles the
      // pgcrypto call since the encrypted columns are bytea.
      if (encryptionKey) {
        await db.execute(sql`
          insert into aforce_whoop_tokens
            (user_id, access_token, refresh_token,
             access_token_enc, refresh_token_enc,
             expires_at, scope)
          values
            (${userId}, ${t.accessToken}, ${t.refreshToken},
             pgp_sym_encrypt(${t.accessToken}, ${encryptionKey}),
             pgp_sym_encrypt(${t.refreshToken}, ${encryptionKey}),
             ${new Date(t.expiresAt)}, ${t.scope ?? null})
          on conflict (user_id) do update set
            access_token = excluded.access_token,
            refresh_token = excluded.refresh_token,
            access_token_enc = excluded.access_token_enc,
            refresh_token_enc = excluded.refresh_token_enc,
            expires_at = excluded.expires_at,
            scope = excluded.scope,
            updated_at = now()
        `);
        return;
      }

      await db
        .insert(aforceWhoopTokens)
        .values({
          userId,
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
          expiresAt: new Date(t.expiresAt),
          scope: t.scope ?? null,
        })
        .onConflictDoUpdate({
          target: aforceWhoopTokens.userId,
          set: {
            accessToken: t.accessToken,
            refreshToken: t.refreshToken,
            expiresAt: new Date(t.expiresAt),
            scope: t.scope ?? null,
            updatedAt: sql`now()`,
          },
        });
    },
    async clear() {
      await db
        .delete(aforceWhoopTokens)
        .where(eq(aforceWhoopTokens.userId, userId));
    },
  };
}
