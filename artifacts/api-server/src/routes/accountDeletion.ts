/**
 * Account-level health-data deletion (Lane F5: privacy/disconnect/
 * deletion enforcement).
 *
 *   POST /api/account/delete-health-data   (requireAuth)
 *     Cascades a HARD delete of every piece of health/biometric data
 *     this server holds for the calling user, across all four
 *     wearable integrations (WHOOP, Garmin, Oura, Strava) regardless of
 *     which are currently connected:
 *       1. Provider token rows — WHOOP + Garmin + Oura + Strava, each
 *          via that provider's existing `TokenStore.clear()`. The WHOOP
 *          token store (`createDrizzleWhoopTokenStoreForUser`) is
 *          imported from `@workspace/db` (lib/db) here — that's a data
 *          deletion, not a behavior change to the frozen
 *          `routes/whoopOAuth.ts` route file, so it's in scope for this
 *          lane per the WHOOP freeze.
 *       2. In-flight OAuth "auth-state" rows — the short-lived
 *          `aforce_{whoop,garmin,oura,strava}_auth_states` PKCE/state
 *          rows written at `/oauth/start` and normally consumed (single-
 *          use DELETE) at `/oauth/callback`. An abandoned flow can leave
 *          one behind; this step guarantees none survive account
 *          deletion even if a flow was mid-flight.
 *       3. `aforce_user_state.biometrics` — set to NULL (every
 *          provider's snapshot at once, not a per-provider `#-`; this is
 *          account deletion, not a single disconnect).
 *       4. `HealthRecordsRepo.purgeUser` — HARD delete of every
 *          canonical health record (health-core record plane),
 *          tombstoned or not. This is the one place `purgeUser` (as
 *          opposed to `tombstoneProvider`) is the correct verb — account
 *          deletion is not keep-history-by-default like a single
 *          provider disconnect (product ruling D9 only covers
 *          disconnect, not account deletion).
 *
 *     Idempotent: every step is a DELETE/no-op-safe operation (empty
 *     token stores stay empty, empty auth-state tables stay empty,
 *     `biometrics = NULL` on an already-null column is a no-op update,
 *     `purgeUser` on an already-empty user returns `purged: 0`).
 *     Calling this endpoint twice in a row is a safe, indistinguishable
 *     no-op the second time.
 *
 *     Scope: HEALTH data only, per the route name. This does NOT delete
 *     the user's AForce account itself (aforce_users row), intake/
 *     hydration history, referrals, circle membership, or Stripe/
 *     billing state — a full-account-delete endpoint (if/when built) is
 *     a superset that would call this plus those additional cascades.
 *     Scoping it this way keeps this lane's blast radius to exactly the
 *     wearable/health surfaces Lane F5 owns.
 *
 * Mount: this is a NEW router (not an extension of `routes/privacy.ts`,
 * which is share-scope/field-visibility settings — a different concern
 * from data deletion) mounted at `/account` in `routes/index.ts`, the
 * only edit made to that file for this lane (see its own comment).
 */

import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
import {
  aforceWhoopAuthStates,
  aforceGarminAuthStates,
  aforceOuraAuthStates,
  aforceStravaAuthStates,
  aforceUserState,
  createDrizzleWhoopTokenStoreForUser,
  createDrizzleGarminTokenStoreForUser,
  createDrizzleOuraTokenStoreForUser,
  createDrizzleStravaTokenStoreForUser,
  createHealthRecordsRepo,
  type HealthRecordsRepo,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

/** Minimal token-store surface this route needs — any provider's
 *  `{Whoop,Garmin,Oura,Strava}TokenStore` satisfies this. */
export interface AccountDeletionTokenStore {
  clear(): Promise<void>;
}

/** Auth-state-row + biometrics-column cleanup seam. Narrower than the
 *  full `NodePgDatabase` so unit tests can fake it without a real
 *  Postgres — the four DELETEs + one UPDATE are proven against a real
 *  Postgres in
 *  `lib/db/src/__integration__/providerCleanup.integration.test.ts`. */
export interface AccountDeletionAuthStateDb {
  deleteWhoopAuthStates(userId: string): Promise<void>;
  deleteGarminAuthStates(userId: string): Promise<void>;
  deleteOuraAuthStates(userId: string): Promise<void>;
  deleteStravaAuthStates(userId: string): Promise<void>;
  /** Sets `aforce_user_state.biometrics` to NULL for this user. No-op
   *  (not an error) when no state row exists. */
  clearBiometrics(userId: string): Promise<void>;
}

export interface AccountDeletionDeps {
  whoopTokenStoreFor: (userId: string) => AccountDeletionTokenStore;
  garminTokenStoreFor: (userId: string) => AccountDeletionTokenStore;
  ouraTokenStoreFor: (userId: string) => AccountDeletionTokenStore;
  stravaTokenStoreFor: (userId: string) => AccountDeletionTokenStore;
  authStateDb: AccountDeletionAuthStateDb;
  /** Only `purgeUser` is needed — narrowed so tests don't have to stand
   *  up a full `HealthRecordsRepo`. */
  healthRecordsRepo: Pick<HealthRecordsRepo, "purgeUser">;
  log?: Pick<Logger, "info" | "warn" | "error">;
}

function errName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown_error";
}

export function buildAccountDeletionRouter(deps: AccountDeletionDeps): IRouter {
  const router: IRouter = Router();

  router.post(
    "/delete-health-data",
    requireAuth,
    async (req, res): Promise<void> => {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      try {
        // Step 1 — provider token rows, all four providers regardless
        // of which are actually connected (clearing an empty store is
        // a no-op).
        await deps.whoopTokenStoreFor(userId).clear();
        await deps.garminTokenStoreFor(userId).clear();
        await deps.ouraTokenStoreFor(userId).clear();
        await deps.stravaTokenStoreFor(userId).clear();

        // Step 2 — in-flight OAuth auth-state rows (abandoned-flow
        // cleanup; normally already consumed by the time a user reaches
        // "delete my data").
        await deps.authStateDb.deleteWhoopAuthStates(userId);
        await deps.authStateDb.deleteGarminAuthStates(userId);
        await deps.authStateDb.deleteOuraAuthStates(userId);
        await deps.authStateDb.deleteStravaAuthStates(userId);

        // Step 3 — biometrics snapshot column, every provider at once.
        await deps.authStateDb.clearBiometrics(userId);

        // Step 4 — canonical health-record plane, hard delete.
        const purge = await deps.healthRecordsRepo.purgeUser(userId);

        req.log?.info(
          { userId, purgedRecords: purge.purged },
          "accountDeletion:delete-health-data complete",
        );
        res
          .status(200)
          .json({ ok: true, status: "purged", purgedRecords: purge.purged });
      } catch (err) {
        req.log?.error(
          { userId, err: errName(err) },
          "accountDeletion:delete-health-data failed",
        );
        res.status(500).json({ error: "account_health_delete_failed" });
      }
    },
  );

  return router;
}

/**
 * Real Drizzle-backed `AccountDeletionAuthStateDb`. Each auth-state
 * table's primary key is the random OAuth `state` string, not `userId`
 * — so unlike the token tables (one row per user, PK = userId) these
 * are ordinary `DELETE ... WHERE user_id = $1` scans, not single-row
 * deletes. That's fine: the tables are TTL-bounded and stay small in
 * steady state (see each table's own module doc in `schema/aforce.ts`).
 */
function createDrizzleAccountDeletionAuthStateDb(
  db: NodePgDatabase<Record<string, unknown>>,
): AccountDeletionAuthStateDb {
  return {
    async deleteWhoopAuthStates(userId) {
      await db
        .delete(aforceWhoopAuthStates)
        .where(eq(aforceWhoopAuthStates.userId, userId));
    },
    async deleteGarminAuthStates(userId) {
      await db
        .delete(aforceGarminAuthStates)
        .where(eq(aforceGarminAuthStates.userId, userId));
    },
    async deleteOuraAuthStates(userId) {
      await db
        .delete(aforceOuraAuthStates)
        .where(eq(aforceOuraAuthStates.userId, userId));
    },
    async deleteStravaAuthStates(userId) {
      await db
        .delete(aforceStravaAuthStates)
        .where(eq(aforceStravaAuthStates.userId, userId));
    },
    async clearBiometrics(userId) {
      await db
        .update(aforceUserState)
        .set({ biometrics: null })
        .where(eq(aforceUserState.userId, userId));
    },
  };
}

/**
 * Convenience wiring for the production mount (`routes/index.ts`):
 * builds every dep against the real `@workspace/db` singleton +
 * per-provider encryption-key env vars, mirroring each OAuth mount's
 * own `tokenStoreFor` wiring exactly (same env var names, same
 * dual-write/prefer-enc behavior).
 */
export function buildDefaultAccountDeletionDeps(
  db: NodePgDatabase<Record<string, unknown>>,
  log?: Pick<Logger, "info" | "warn" | "error">,
): AccountDeletionDeps {
  return {
    whoopTokenStoreFor: (userId) =>
      createDrizzleWhoopTokenStoreForUser(db, userId, {
        encryptionKey: process.env["WHOOP_TOKEN_ENCRYPTION_KEY"] ?? null,
        log,
      }),
    garminTokenStoreFor: (userId) =>
      createDrizzleGarminTokenStoreForUser(db, userId, {
        encryptionKey: process.env["GARMIN_TOKEN_ENCRYPTION_KEY"] ?? null,
        log,
      }),
    ouraTokenStoreFor: (userId) =>
      createDrizzleOuraTokenStoreForUser(db, userId, {
        encryptionKey: process.env["OURA_TOKEN_ENCRYPTION_KEY"] ?? null,
        log,
      }),
    stravaTokenStoreFor: (userId) =>
      createDrizzleStravaTokenStoreForUser(db, userId, {
        encryptionKey: process.env["STRAVA_TOKEN_ENCRYPTION_KEY"] ?? null,
        log,
      }),
    authStateDb: createDrizzleAccountDeletionAuthStateDb(db),
    healthRecordsRepo: createHealthRecordsRepo(db),
    log,
  };
}
