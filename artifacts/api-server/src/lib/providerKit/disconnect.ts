/**
 * providerKit — provider disconnect + local cleanup (Lane F5:
 * privacy/disconnect/deletion enforcement).
 *
 * "Disconnect" today (pre-F5) only clears the token row
 * (`tokenStoreFor(userId).clear()` — see `routes/ouraOAuth.ts` /
 * `stravaOAuth.ts` / `garminOAuth.ts`). That's honest about auth (the
 * app can no longer call the provider on the user's behalf) but NOT
 * honest about DATA: the last-synced snapshot stays in
 * `aforce_user_state.biometrics[providerKey]` and keeps rendering in
 * `GET /api/aforce/state` as if the connection were still live.
 *
 * This module closes that gap with one provider-parameterized
 * disconnector, run in a fixed order every time:
 *
 *   1. Best-effort provider-side token REVOCATION (never blocks the
 *      rest — a dead/expired/already-revoked token must not prevent
 *      local cleanup).
 *   2. Token row DELETE (existing `store.clear()` — real failure here
 *      DOES throw; the caller must not report success while tokens
 *      are still live).
 *   3. Remove ONLY this provider's key from the `biometrics` jsonb
 *      blob via the Postgres `#-` (delete-path) operator — every
 *      other connected provider's snapshot in the same row survives
 *      untouched. Real failure here also throws.
 *   4. OPTIONAL record-plane tombstone (`HealthRecordsRepo.
 *      tombstoneProvider`, soft delete) when the caller explicitly
 *      asks for it via `purgeRecords`. Default false — product ruling
 *      D9 is keep-history-by-default; a provider disconnect alone
 *      does not erase historical readiness/recovery context. Real
 *      failure here throws too, for the same honesty reason as 2/3.
 *
 * Idempotency: every step is safe to repeat. No stored tokens -> revoke
 * is skipped (not attempted); `store.clear()` on an already-empty row
 * is a no-op DELETE; the `#-` operator on an absent key is a no-op;
 * `tombstoneProvider` only counts newly-tombstoned rows (see
 * `healthRecordsRepo.ts`). Calling `disconnect()` twice in a row always
 * succeeds and returns a "nothing left to do" result the second time.
 *
 * Provider parameterization mirrors `tokenManager.ts` /
 * `fetchWorker.ts`: `provider` is a display name (e.g. "Oura"),
 * lowercased internally to `providerKey` — this MUST match the exact
 * key `providerKit/fetchWorker.ts` writes into the biometrics blob
 * (`provider.toLowerCase()`), or disconnect silently fails to find the
 * entry to remove.
 *
 * WHOOP follow-up (tracked, not done here): WHOOP is frozen/production
 * for this lane (W3 owns `whoopOAuth.ts` / `whoopFetchWorker.ts`) and is
 * NOT wired onto this disconnector. `DELETE /api/whoop/*` disconnect
 * (if/when it exists) and the WHOOP branch of `POST
 * /api/account/delete-health-data` (see `routes/accountDeletion.ts`)
 * should adopt these exact semantics — revoke-then-clear-then-purge-
 * snapshot, all idempotent — as a documented follow-up immediately
 * after W3 merges. Until then WHOOP keeps its pre-existing
 * `store.clear()`-only disconnect behavior.
 *
 * Garmin: no revoker is wired for Garmin anywhere in this file. The
 * Garmin Health API partner endpoints are UNVERIFIED / DORMANT pending
 * partner credentials (see `lib/garminSnapshot.ts`'s module doc) — there
 * is no confirmed revoke contract to call. Guessing an endpoint against a
 * partner API AForce has no live credentials for risks a silent no-op at
 * best and an unexpected side effect at worst, so `createProviderDisconnector`
 * for Garmin is mounted with `revoker` omitted; disconnect proceeds with
 * local cleanup only (steps 2–4), which is still a strict improvement over
 * today's clear()-only behavior.
 */

import type { Logger } from "pino";
import { and, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { aforceUserState } from "@workspace/db";
import type { HealthProviderId, DeletionStatus } from "@workspace/health-core";
import type { ProviderTokens, ProviderTokenStore } from "./tokenManager";

/* ─── Snapshot-blob removal seam ─────────────────────────────────────────── */

/**
 * Minimal seam disconnect needs against `aforce_user_state.biometrics`.
 * Deliberately narrower than the full `NodePgDatabase` (which is why
 * this isn't just "pass drizzle's `db`") so unit tests can fake this
 * interface directly without a real Postgres — the jsonb `#-` operator
 * itself is only proven against a REAL Postgres in
 * `lib/db/src/__integration__/providerCleanup.integration.test.ts`.
 */
export interface ProviderUserStateDb {
  /**
   * Remove `biometrics[providerKey]` if present. `removed: false` (not
   * a throw) covers every "nothing to remove" case: no row for this
   * user, `biometrics` is null, or the key was already absent —
   * disconnect must stay idempotent, not error, on a repeat call.
   */
  removeProviderSnapshotEntry(
    userId: string,
    providerKey: string,
  ): Promise<{ removed: boolean }>;
}

/**
 * Real Drizzle-backed implementation. Uses the jsonb `#-` (delete-path)
 * operator so ONLY the named provider's key is removed — every other
 * provider's entry in the same `biometrics` blob is untouched. The path
 * is built as a parameterized `text[]` (never string-interpolated into
 * a `{...}` path literal) so the providerKey value can't alter Postgres
 * path semantics — same defensive pattern as
 * `whoopFetchWorker.ts`'s `writeProviderEntry` (ARRAY[$1]::text[]).
 * `COALESCE(biometrics, '{}'::jsonb)` makes this safe against a NULL
 * biometrics column (the `#-` operator on NULL is NULL, which would
 * otherwise wipe the column instead of leaving it alone).
 *
 * The `WHERE` clause guards on the jsonb `?` (key-exists) operator IN
 * ADDITION to `user_id` — proven necessary by
 * `providerCleanup.integration.test.ts` against a real Postgres: an
 * UPDATE whose WHERE only matches on `user_id` returns a row (via
 * RETURNING) for ANY existing user row, even when the key was already
 * absent and the `#-` was a true no-op. Without the extra guard,
 * `removed` would be true merely because the user has a state row,
 * defeating the idempotency contract this function documents (`removed:
 * false` on a repeat call). Guarding on key-presence means the UPDATE
 * itself only fires — and only then does RETURNING produce a row — when
 * there is something to actually remove.
 */
export function createDrizzleProviderUserStateDb(
  db: NodePgDatabase<Record<string, unknown>>,
): ProviderUserStateDb {
  return {
    async removeProviderSnapshotEntry(userId, providerKey) {
      const result = await db
        .update(aforceUserState)
        .set({
          biometrics: sql`(COALESCE(${aforceUserState.biometrics}, '{}'::jsonb) #- ARRAY[${providerKey}]::text[])` as never,
        })
        .where(
          and(
            eq(aforceUserState.userId, userId),
            sql`COALESCE(${aforceUserState.biometrics}, '{}'::jsonb) ? ${providerKey}`,
          ),
        )
        .returning({ id: aforceUserState.userId });
      return { removed: result.length > 0 };
    },
  };
}

/* ─── Provider-side revocation ───────────────────────────────────────────── */

/**
 * Best-effort provider-side token revocation. Throws on failure — the
 * disconnector (below) catches, logs, and records the failure in its
 * result; a revoke failure NEVER blocks local cleanup (token delete +
 * snapshot purge always proceed regardless).
 */
export type ProviderRevoker = (tokens: ProviderTokens) => Promise<void>;

export interface RevokerFetchOpts {
  /** Test seam. Defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Oura: POST https://api.ouraring.com/oauth/revoke?access_token=...
 * (https://cloud.ouraring.com/docs/authentication — "Revoking Tokens").
 */
export function createOuraRevoker(opts: RevokerFetchOpts = {}): ProviderRevoker {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return async (tokens) => {
    const url = `https://api.ouraring.com/oauth/revoke?access_token=${encodeURIComponent(
      tokens.accessToken,
    )}`;
    const res = await fetchImpl(url, { method: "POST" });
    if (!res.ok) {
      throw new Error(`oura revoke failed: HTTP ${res.status}`);
    }
  };
}

/**
 * Strava: POST https://www.strava.com/oauth/deauthorize?access_token=...
 * (https://developers.strava.com/docs/authentication/ — "Deauthorization").
 */
export function createStravaRevoker(opts: RevokerFetchOpts = {}): ProviderRevoker {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return async (tokens) => {
    const url = `https://www.strava.com/oauth/deauthorize?access_token=${encodeURIComponent(
      tokens.accessToken,
    )}`;
    const res = await fetchImpl(url, { method: "POST" });
    if (!res.ok) {
      throw new Error(`strava deauthorize failed: HTTP ${res.status}`);
    }
  };
}

// No `createGarminRevoker` export — see the module doc's Garmin section.

/* ─── Disconnector ────────────────────────────────────────────────────────── */

export interface ProviderDisconnectOptions {
  /**
   * Hard-delete-adjacent: also SOFT-tombstone this provider's canonical
   * health records (health-core record plane), not just the legacy
   * `biometrics` snapshot. Default false — product ruling D9 is
   * keep-history-by-default; a plain disconnect must not silently erase
   * historical readiness/recovery context a user may want to keep.
   */
  purgeRecords?: boolean;
}

export interface ProviderDisconnectResult {
  provider: string;
  userId: string;
  /** Final lifecycle stage reached this call — see `DeletionStatus` in
   *  `@workspace/health-core`. */
  status: DeletionStatus;
  revocation: { attempted: boolean; ok: boolean | null; reason?: string };
  tokensDeleted: boolean;
  snapshotRemoved: boolean;
  /** `null` when `purgeRecords` was false or no records repo was
   *  configured (not attempted) — distinct from `0` (attempted, nothing
   *  left to tombstone). */
  recordsTombstoned: number | null;
}

/** Minimal surface `createProviderDisconnector` needs from
 *  `HealthRecordsRepo` — narrowed so callers don't have to construct a
 *  full repo just to satisfy the type. `createHealthRecordsRepo(db)`
 *  from `@workspace/db` satisfies this directly. */
export interface ProviderRecordsRepoLike {
  tombstoneProvider(
    userId: string,
    provider: HealthProviderId,
  ): Promise<{ tombstoned: number }>;
}

export interface CreateProviderDisconnectorOptions {
  /**
   * Provider display name, e.g. "Oura". Lowercased internally
   * (`providerKey`) to match the `biometrics` blob key convention
   * `providerKit/fetchWorker.ts` uses (`provider.toLowerCase()`) and
   * the `HealthProviderId` literal (`'oura' | 'strava' | 'garmin' |
   * 'whoop' | ...`) `tombstoneProvider` expects.
   */
  provider: string;
  tokenStoreFor: (userId: string) => ProviderTokenStore;
  /** Biometrics-blob removal seam — see `ProviderUserStateDb` above.
   *  Pass `createDrizzleProviderUserStateDb(db)` in production. */
  db: ProviderUserStateDb;
  /** Best-effort provider-side revocation. Omit for providers with no
   *  verified revoke contract (Garmin — see module doc). */
  revoker?: ProviderRevoker;
  /** Record-plane tombstone. Omit to make `purgeRecords` a no-op
   *  (`recordsTombstoned` stays `null` even when the caller asks). */
  healthRecordsRepo?: ProviderRecordsRepoLike;
  log?: Pick<Logger, "info" | "warn" | "error">;
}

export interface ProviderDisconnector {
  /**
   * Idempotent. Repeat calls for the same user are a no-op success —
   * never throws for "nothing left to clean up". Only throws when a
   * step that's supposed to have a durable effect (token clear,
   * snapshot removal, record tombstone) genuinely fails against its
   * store — those failures propagate so the calling route can 500
   * instead of reporting a disconnect that didn't actually happen.
   */
  disconnect(
    userId: string,
    opts?: ProviderDisconnectOptions,
  ): Promise<ProviderDisconnectResult>;
}

function errName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown_error";
}

export function createProviderDisconnector(
  opts: CreateProviderDisconnectorOptions,
): ProviderDisconnector {
  const provider = opts.provider;
  const providerKey = provider.toLowerCase();
  const log = opts.log;

  return {
    async disconnect(userId, disconnectOpts = {}) {
      const purgeRecords = disconnectOpts.purgeRecords ?? false;
      const store = opts.tokenStoreFor(userId);

      // Step 1 — best-effort provider-side revocation. Read the CURRENT
      // tokens (before step 2 deletes them) so there's something to
      // revoke. A read failure or revoke failure is caught, logged, and
      // recorded in the result; it NEVER throws out of this step.
      const revocation: ProviderDisconnectResult["revocation"] = {
        attempted: false,
        ok: null,
      };
      if (opts.revoker) {
        let tokens: ProviderTokens | null = null;
        try {
          tokens = await store.read();
        } catch (err) {
          log?.warn(
            { userId, provider, err: errName(err) },
            `${providerKey}Disconnect: token read before revoke failed (non-blocking)`,
          );
        }
        if (tokens) {
          revocation.attempted = true;
          try {
            await opts.revoker(tokens);
            revocation.ok = true;
          } catch (err) {
            revocation.ok = false;
            revocation.reason = errName(err);
            log?.warn(
              { userId, provider, err: errName(err) },
              `${providerKey}Disconnect: provider-side revocation failed (non-blocking)`,
            );
          }
        } else {
          // Nothing stored to revoke — the idempotent repeat-call case.
          revocation.reason = "no_tokens_stored";
        }
      } else {
        revocation.reason = "no_revoker_configured";
      }

      // Step 2 — token row delete. Real failure here DOES throw: the
      // user asked to disconnect and the tokens are still live in the
      // DB, so reporting success would be dishonest.
      try {
        await store.clear();
      } catch (err) {
        log?.error(
          { userId, provider, err: errName(err) },
          `${providerKey}Disconnect: token clear failed`,
        );
        throw err;
      }

      // Step 3 — remove this provider's key from the biometrics
      // snapshot blob. Every OTHER provider's key in the same jsonb
      // blob survives untouched.
      let snapshotRemoved: boolean;
      try {
        const result = await opts.db.removeProviderSnapshotEntry(
          userId,
          providerKey,
        );
        snapshotRemoved = result.removed;
      } catch (err) {
        log?.error(
          { userId, provider, err: errName(err) },
          `${providerKey}Disconnect: snapshot removal failed`,
        );
        throw err;
      }

      // Step 4 — optional record-plane tombstone (soft delete,
      // keep-history default). Only runs when the caller both asked
      // for it AND a records repo was wired.
      let recordsTombstoned: number | null = null;
      if (purgeRecords && opts.healthRecordsRepo) {
        try {
          const result = await opts.healthRecordsRepo.tombstoneProvider(
            userId,
            providerKey as HealthProviderId,
          );
          recordsTombstoned = result.tombstoned;
        } catch (err) {
          log?.error(
            { userId, provider, err: errName(err) },
            `${providerKey}Disconnect: record tombstone failed`,
          );
          throw err;
        }
      }

      const status: DeletionStatus =
        recordsTombstoned !== null ? "data_tombstoned" : "snapshot_removed";

      log?.info(
        {
          userId,
          provider,
          status,
          revocationAttempted: revocation.attempted,
          revocationOk: revocation.ok,
          snapshotRemoved,
          recordsTombstoned,
        },
        `${providerKey}Disconnect: complete`,
      );

      return {
        provider,
        userId,
        status,
        revocation,
        tokensDeleted: true,
        snapshotRemoved,
        recordsTombstoned,
      };
    },
  };
}
