/**
 * Strava OAuth2 token store — server-side, per-user persistence.
 *
 * Faithful mirror of `ouraTokenStore.ts` / `whoopTokenStore.ts` /
 * `garminTokenStore.ts`. The four stores are intentionally
 * shape-identical so the Strava token manager can be a near-drop-in
 * port of Oura's/WHOOP's.
 *
 * `expiresAt` semantics:
 *   - In-memory / manager: epoch ms (cheap arithmetic).
 *   - Postgres boundary: `timestamptz`. Converted at the store boundary.
 *
 * Hidden-infra: nothing writes here until STRAVA_CLIENT_ID +
 * STRAVA_CLIENT_SECRET + STRAVA_OAUTH_REDIRECT_URI are all configured
 * (the OAuth router is only mounted then). With nothing configured the
 * schema simply sits unused.
 */

import { eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceStravaTokens } from "./schema/aforce";

/** Same shape as the WHOOP/Garmin/Oura token bundle. `expiresAt` is epoch ms. */
export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms when the access token expires. */
  expiresAt: number;
  /** Space-delimited scopes the user granted. Optional — null when
   *  Strava doesn't echo `scope` back. */
  scope?: string | null;
}

/**
 * Minimal logger shape — keeps this lib pino-free. The store only
 * needs `warn` (decrypt fallback) and `error` (unrecoverable).
 */
export interface StravaTokenStoreLogger {
  warn: (obj: Record<string, unknown>, msg?: string) => void;
}

export interface DrizzleStravaTokenStoreOptions {
  /**
   * **Phase A invariant — all writers in the same deployment MUST
   * agree on this key.** If some writers run keyed and others keyless
   * against the same row, the keyless writes update the plaintext
   * column but leave the enc column stale; a subsequent keyed read
   * then prefers the stale enc value. The runtime call sites read the
   * same `STRAVA_TOKEN_ENCRYPTION_KEY` env var to keep this invariant.
   *
   * pgcrypto symmetric key. When set, the store DUAL-WRITES (plaintext
   * column + `pgp_sym_encrypt(token, key)` ciphertext column) and
   * PREFERS the encrypted column on read. When the ciphertext column
   * is null (legacy row) OR `pgp_sym_decrypt` throws (wrong key,
   * corruption), the store falls back to the plaintext column and the
   * read still succeeds.
   *
   * **Hidden-infra contract**: unset (default) = unchanged behavior.
   * Plaintext-only writes/reads, encrypted columns stay null.
   */
  encryptionKey?: string | null;
  /** Optional logger for decrypt fallback / dual-write failure paths.
   *  Defaults to a no-op. */
  log?: StravaTokenStoreLogger;
}

/**
 * Per-user storage adapter. Once a store is created it is bound to a
 * single `userId`; the manager doesn't need to know about user
 * identity, which keeps the mobile/server manager surfaces identical.
 */
export interface StravaTokenStore {
  read(): Promise<StravaTokens | null>;
  write(t: StravaTokens): Promise<void>;
  clear(): Promise<void>;
}

/** In-memory store. Use for tests, local dev, and as a fallback when
 *  DB is unavailable. */
export function createInMemoryStravaTokenStore(
  seed: StravaTokens | null = null,
): StravaTokenStore {
  let current: StravaTokens | null = seed;
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
 * Phase B operational helper — encrypt plaintext columns into the enc
 * columns for rows that pre-date the encryption opt-in. Idempotent and
 * batched; returns the number of rows updated. Mirrors the
 * WHOOP/Garmin/Oura backfill helper exactly.
 */
export async function backfillStravaTokenEncryption(
  db: NodePgDatabase<Record<string, unknown>>,
  encryptionKey: string,
  batchSize: number,
): Promise<number> {
  if (typeof encryptionKey !== "string" || encryptionKey.trim() === "") {
    throw new Error(
      "backfillStravaTokenEncryption: encryptionKey must be a non-empty string",
    );
  }
  if (!Number.isFinite(batchSize) || batchSize <= 0) {
    throw new Error(
      "backfillStravaTokenEncryption: batchSize must be a positive number",
    );
  }
  const result = await db.execute<{ user_id: string }>(sql`
    update aforce_strava_tokens
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
       select user_id from aforce_strava_tokens
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
 * Operational readout — count rows by encryption status. Mirrors the
 * WHOOP/Garmin/Oura status helper exactly (single SQL roundtrip via
 * FILTER aggregates).
 */
export async function getStravaTokenEncryptionStatus(
  db: NodePgDatabase<Record<string, unknown>>,
): Promise<{
  total: number;
  encrypted: number;
  plaintextOnly: number;
  halfEncrypted: number;
}> {
  const result = await db.execute<{
    total: string;
    encrypted: string;
    plaintext_only: string;
    half_encrypted: string;
  }>(sql`
    select
      count(*)::text as total,
      count(*) filter (
        where access_token_enc is not null and refresh_token_enc is not null
      )::text as encrypted,
      count(*) filter (
        where access_token_enc is null and refresh_token_enc is null
      )::text as plaintext_only,
      count(*) filter (
        where (access_token_enc is null) <> (refresh_token_enc is null)
      )::text as half_encrypted
    from aforce_strava_tokens
  `);
  const row = result.rows[0];
  return {
    total: row ? Number(row.total) : 0,
    encrypted: row ? Number(row.encrypted) : 0,
    plaintextOnly: row ? Number(row.plaintext_only) : 0,
    halfEncrypted: row ? Number(row.half_encrypted) : 0,
  };
}

/**
 * Per-user, Postgres-backed store. Pass the user's id once; the
 * returned store talks only about that user.
 */
export function createDrizzleStravaTokenStoreForUser(
  db: NodePgDatabase<Record<string, unknown>>,
  userId: string,
  opts: DrizzleStravaTokenStoreOptions = {},
): StravaTokenStore {
  if (!userId) {
    throw new Error(
      "createDrizzleStravaTokenStoreForUser: userId must be non-empty",
    );
  }

  const encryptionKey =
    typeof opts.encryptionKey === "string" && opts.encryptionKey.trim() !== ""
      ? opts.encryptionKey
      : null;
  const log = opts.log;

  return {
    async read() {
      if (encryptionKey) {
        try {
          const rows = await db.execute<{
            access_token: string;
            refresh_token: string;
            expires_at: Date;
            scope: string | null;
            access_token_dec: string | null;
            refresh_token_dec: string | null;
          }>(sql`
            select
              access_token,
              refresh_token,
              expires_at,
              scope,
              case when access_token_enc is not null
                then pgp_sym_decrypt(access_token_enc, ${encryptionKey})
                else null end as access_token_dec,
              case when refresh_token_enc is not null
                then pgp_sym_decrypt(refresh_token_enc, ${encryptionKey})
                else null end as refresh_token_dec
            from aforce_strava_tokens
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
          log?.warn(
            { err: err instanceof Error ? err.message : String(err), userId },
            "stravaTokenStore: pgp_sym_decrypt failed, falling back to plaintext column",
          );
        }
      }

      const rows = await db
        .select()
        .from(aforceStravaTokens)
        .where(eq(aforceStravaTokens.userId, userId))
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
      if (encryptionKey) {
        await db.execute(sql`
          insert into aforce_strava_tokens
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
        .insert(aforceStravaTokens)
        .values({
          userId,
          accessToken: t.accessToken,
          refreshToken: t.refreshToken,
          expiresAt: new Date(t.expiresAt),
          scope: t.scope ?? null,
        })
        .onConflictDoUpdate({
          target: aforceStravaTokens.userId,
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
        .delete(aforceStravaTokens)
        .where(eq(aforceStravaTokens.userId, userId));
    },
  };
}
