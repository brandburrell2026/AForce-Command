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
 *     Sync-state / cursor storage: NONE EXISTS. Verified by grep over
 *     `lib/db/src/schema/aforce.ts` for
 *     `cursor|sync_state|last_sync|watermark|checkpoint|since_token|
 *     next_token` — zero matches. The fetch sweep paginates with a
 *     keyset over `aforce_{provider}_tokens.(updated_at, user_id)`, so
 *     the "cursor" is the token row itself and step 1 already deletes
 *     it; there is no separate per-user cursor table to cascade into.
 *     `routes/__tests__/providerDisconnectMounts.test.ts` pins that with
 *     a schema-drift guard so adding one without extending this cascade
 *     turns the suite red.
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
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Logger } from "pino";
import {
  createDrizzleWhoopTokenStoreForUser,
  createDrizzleGarminTokenStoreForUser,
  createDrizzleOuraTokenStoreForUser,
  createDrizzleStravaTokenStoreForUser,
  createHealthRecordsRepo,
  runAccountDeletionCascade,
  createAccountDeletionAuthStateDb,
  type AccountDeletionCascadeTokenStore,
  type AccountDeletionCascadeAuthStateDb,
  type AccountDeletionCascadeDeps,
} from "@workspace/db";
import {
  destructiveGuards,
  type DestructiveRouteDeps,
} from "../middlewares/destructiveGuards";

/** Minimal token-store surface this route needs — any provider's
 *  `{Whoop,Garmin,Oura,Strava}TokenStore` satisfies this. Re-exported
 *  from `@workspace/db`'s cascade module so existing imports of this
 *  name keep working unchanged. */
export type AccountDeletionTokenStore = AccountDeletionCascadeTokenStore;

/** Auth-state-row + biometrics-column cleanup seam. Narrower than the
 *  full `NodePgDatabase` so unit tests can fake it without a real
 *  Postgres — the four DELETEs + one UPDATE are proven against a real
 *  Postgres in
 *  `lib/db/src/__integration__/providerCleanup.integration.test.ts`.
 *  Re-exported from `@workspace/db`'s cascade module (see
 *  `AccountDeletionTokenStore` above). */
export type AccountDeletionAuthStateDb = AccountDeletionCascadeAuthStateDb;

/**
 * `whoopTokenStoreFor` / `garminTokenStoreFor` / `ouraTokenStoreFor` /
 * `stravaTokenStoreFor` / `authStateDb` / `healthRecordsRepo` come from
 * `AccountDeletionCascadeDeps` (`@workspace/db`) — the exact shape
 * `runAccountDeletionCascade` consumes, so this interface and the
 * cascade's own can never drift apart.
 */
export interface AccountDeletionDeps
  extends DestructiveRouteDeps,
    AccountDeletionCascadeDeps {
  log?: Pick<Logger, "info" | "warn" | "error">;
  /**
   * Optional: run the four cascade steps (`runAccountDeletionCascade`,
   * `@workspace/db`) inside a single DB transaction so a step throwing
   * mid-cascade rolls back everything already done, instead of leaving
   * a partial deletion. All four steps are LOCAL data only (token rows,
   * auth-state rows, the biometrics column, the health-records table)
   * — this route makes no external/network calls, so nothing here needs
   * to sit outside the transaction.
   *
   * Left optional and defaulted to the field-by-field calls below (see
   * the handler) so DB-free unit tests that pass plain fakes for
   * `whoopTokenStoreFor` etc. keep working unchanged — those fakes have
   * no real transaction semantics to prove, and proving atomicity against
   * a fake would be theater. The real guarantee is proven against a real
   * Postgres by the Testcontainers fault-injection test in
   * `lib/db/src/__integration__/`. `buildDefaultAccountDeletionDeps`
   * below always supplies this for the production mount.
   *
   * #506 review nit: making this non-optional (with an explicit `null`
   * for unit-test fakes) was considered so a future mount can't
   * silently lose atomicity. Not done here — `destructiveEndpointSecurity
   * .test.ts`'s `accountDeletionHarnessDeps` (a frozen suite for this
   * lane) builds `AccountDeletionDeps` object literals with this field
   * omitted entirely; a required field would fail to compile there.
   * Revisit if that test is ever touched for other reasons.
   */
  runCascadeInTransaction?: (userId: string) => Promise<{ purged: number }>;
}

function errName(err: unknown): string {
  return err instanceof Error ? err.name : "unknown_error";
}

export function buildAccountDeletionRouter(deps: AccountDeletionDeps): IRouter {
  const router: IRouter = Router();

  router.post(
    "/delete-health-data",
    // The single most destructive endpoint on the server: it hard-deletes
    // every physiological record this user has. Origin allow-list ->
    // rate limit -> REAL auth (no DEFAULT_USER_ID dev fallback, in any
    // environment). A tighter bucket than the per-provider disconnects —
    // a legitimate user calls this at most once.
    ...destructiveGuards({
      scope: "account_delete_health_data",
      limit: deps.destructiveRateLimit?.limit ?? 5,
      windowMs: deps.destructiveRateLimit?.windowMs,
      auth: deps.destructiveAuth,
    }),
    async (req, res): Promise<void> => {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }
      try {
        let purgedRecords: number;
        if (deps.runCascadeInTransaction) {
          // All-or-nothing: a step throwing here rolls back every step
          // already run in this call, including ones before it. The
          // route still 500s below on failure; a subsequent retry runs
          // the same idempotent cascade against a clean, fully-intact
          // (or fully-purged) state.
          const result = await deps.runCascadeInTransaction(userId);
          purgedRecords = result.purged;
        } else {
          // Legacy/test path — no transactional guarantee, kept only so
          // DB-free unit tests with plain fakes are unaffected. `deps`
          // already satisfies `AccountDeletionCascadeDeps`, so this runs
          // the exact same four-step function
          // (`runAccountDeletionCascade`, `@workspace/db`) as the
          // transactional path above — just without a `tx` behind it.
          const purge = await runAccountDeletionCascade(deps, userId);
          purgedRecords = purge.purged;
        }

        req.log?.info(
          { userId, purgedRecords },
          "accountDeletion:delete-health-data complete",
        );
        res.status(200).json({ ok: true, status: "purged", purgedRecords });
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
 * Convenience wiring for the production mount (`routes/index.ts`):
 * builds every dep against the real `@workspace/db` singleton +
 * per-provider encryption-key env vars, mirroring each OAuth mount's
 * own `tokenStoreFor` wiring exactly (same env var names, same
 * dual-write/prefer-enc behavior).
 */
/** Builds the four per-user token-store factories against whichever db
 *  handle is passed — the real singleton for the plain fields below, or
 *  a `tx` inside `runCascadeInTransaction` so every cascade statement
 *  enrolls in the same transaction. Kept as one function so the two
 *  call sites can never drift (same encryption-key env vars, same
 *  options) — see the WHOOP-freeze note in the module doc for why that
 *  matters. */
function buildTokenStoresFor(
  dbx: NodePgDatabase<Record<string, unknown>>,
  log?: Pick<Logger, "info" | "warn" | "error">,
): Pick<
  AccountDeletionDeps,
  | "whoopTokenStoreFor"
  | "garminTokenStoreFor"
  | "ouraTokenStoreFor"
  | "stravaTokenStoreFor"
> {
  return {
    whoopTokenStoreFor: (userId) =>
      createDrizzleWhoopTokenStoreForUser(dbx, userId, {
        encryptionKey: process.env["WHOOP_TOKEN_ENCRYPTION_KEY"] ?? null,
        log,
      }),
    garminTokenStoreFor: (userId) =>
      createDrizzleGarminTokenStoreForUser(dbx, userId, {
        encryptionKey: process.env["GARMIN_TOKEN_ENCRYPTION_KEY"] ?? null,
        log,
      }),
    ouraTokenStoreFor: (userId) =>
      createDrizzleOuraTokenStoreForUser(dbx, userId, {
        encryptionKey: process.env["OURA_TOKEN_ENCRYPTION_KEY"] ?? null,
        log,
      }),
    stravaTokenStoreFor: (userId) =>
      createDrizzleStravaTokenStoreForUser(dbx, userId, {
        encryptionKey: process.env["STRAVA_TOKEN_ENCRYPTION_KEY"] ?? null,
        log,
      }),
  };
}

export function buildDefaultAccountDeletionDeps(
  db: NodePgDatabase<Record<string, unknown>>,
  log?: Pick<Logger, "info" | "warn" | "error">,
): AccountDeletionDeps {
  return {
    ...buildTokenStoresFor(db, log),
    authStateDb: createAccountDeletionAuthStateDb(db),
    healthRecordsRepo: createHealthRecordsRepo(db),
    log,
    // All-or-nothing: every step below runs against `tx`, so a step
    // throwing rolls back everything already done in the same call.
    // `runAccountDeletionCascade` (`@workspace/db`) is the single
    // source of truth for the four-step sequence — this wrapper's only
    // job is binding its dependencies to `tx` instead of the plain
    // `db` used elsewhere in this file, exactly the seam
    // `buildTokenStoresFor` already provides for the token stores.
    runCascadeInTransaction: (userId) =>
      db.transaction((tx) =>
        runAccountDeletionCascade(
          {
            ...buildTokenStoresFor(tx, log),
            authStateDb: createAccountDeletionAuthStateDb(tx),
            healthRecordsRepo: createHealthRecordsRepo(tx),
          },
          userId,
        ),
      ),
  };
}
