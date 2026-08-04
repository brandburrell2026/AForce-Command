/**
 * The account-deletion health-data cascade — single source of truth
 * for the four-step sequence, shared between:
 *
 *   - `buildDefaultAccountDeletionDeps`'s `runCascadeInTransaction` in
 *     `artifacts/api-server/src/routes/accountDeletion.ts` (production,
 *     wrapped in `db.transaction`).
 *   - That same file's "legacy/test path" fallback (no transaction —
 *     DB-free unit tests pass plain fakes here; see that file's own
 *     comment for why the fallback exists).
 *   - `lib/db/src/__integration__/accountDeletionTransaction
 *     .integration.test.ts`, which proves the REAL transactional
 *     wrapper rolls back completely on a real Postgres SQL failure.
 *
 * #506 review finding this closes: before this file existed, the
 * four-step sequence was hand-written twice (once in
 * `runCascadeInTransaction`, once — byte-for-byte "mirrored" by eye —
 * in the integration test's `deleteHealthDataTransactional` helper),
 * so `runCascadeInTransaction`, the only code path that runs the
 * cascade atomically in production, had ZERO direct test coverage:
 * the integration test only ever proved its own structural copy was
 * correct. Extracting the body here means every caller — production
 * and test alike — runs the identical function; the integration test
 * now exercises the real thing inside `db.transaction`, closing that
 * gap.
 *
 * Deliberately dependency-injected rather than parameterized on a
 * raw db-or-tx handle: the token-store factories need per-provider
 * encryption-key wiring that's an api-server application concern
 * (`WHOOP_TOKEN_ENCRYPTION_KEY` etc, read by that file's
 * `buildTokenStoresFor` — kept as-is; that's the seam this function
 * plugs into), and the DB-free unit tests in
 * `destructiveEndpointSecurity.test.ts` construct `authStateDb` /
 * `healthRecordsRepo` as plain spies with no real Postgres handle at
 * all. A `dbx`-first signature would make the fallback path
 * un-callable without threading a real (or fake-shaped)
 * `NodePgDatabase` through code that today never touches one — pure
 * type churn on a frozen test file for no atomicity benefit, since
 * the fallback path has no transaction to enroll in either way.
 * Atomicity comes entirely from what handle the CALLER'S factories
 * are already bound to: `tx` for the production wrapper, nothing in
 * particular for the fallback's fakes.
 */

import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { HealthRecordsRepo, PurgeUserResult } from "./healthRecordsRepo";
import {
  aforceUserState,
  aforceWhoopAuthStates,
  aforceGarminAuthStates,
  aforceOuraAuthStates,
  aforceStravaAuthStates,
} from "./schema/aforce";

/** Minimal token-store surface the cascade needs — any provider's
 *  `{Whoop,Garmin,Oura,Strava}TokenStore` satisfies this. */
export interface AccountDeletionCascadeTokenStore {
  clear(): Promise<void>;
}

/** Per-provider token-store factories, keyed by userId. Callers build
 *  these bound to whichever db-or-tx handle they're using (see
 *  `buildTokenStoresFor` in `accountDeletion.ts`) so the cascade
 *  function itself never has to know about encryption-key env vars
 *  or which handle is in play. */
export interface AccountDeletionCascadeStores {
  whoopTokenStoreFor: (userId: string) => AccountDeletionCascadeTokenStore;
  garminTokenStoreFor: (userId: string) => AccountDeletionCascadeTokenStore;
  ouraTokenStoreFor: (userId: string) => AccountDeletionCascadeTokenStore;
  stravaTokenStoreFor: (userId: string) => AccountDeletionCascadeTokenStore;
}

/** Auth-state-row + biometrics-column cleanup seam — the four
 *  per-provider OAuth auth-state DELETEs plus the
 *  `aforce_user_state.biometrics` clear, narrowed to an interface so
 *  DB-free unit tests can fake it without a real Postgres. */
export interface AccountDeletionCascadeAuthStateDb {
  deleteWhoopAuthStates(userId: string): Promise<void>;
  deleteGarminAuthStates(userId: string): Promise<void>;
  deleteOuraAuthStates(userId: string): Promise<void>;
  deleteStravaAuthStates(userId: string): Promise<void>;
  /** Sets `aforce_user_state.biometrics` to NULL for this user. No-op
   *  (not an error) when no state row exists. */
  clearBiometrics(userId: string): Promise<void>;
}

export interface AccountDeletionCascadeDeps extends AccountDeletionCascadeStores {
  authStateDb: AccountDeletionCascadeAuthStateDb;
  /** Only `purgeUser` is needed — narrowed so tests don't have to
   *  stand up a full `HealthRecordsRepo`. */
  healthRecordsRepo: Pick<HealthRecordsRepo, "purgeUser">;
}

/**
 * Real Drizzle-backed `AccountDeletionCascadeAuthStateDb`. Each
 * auth-state table's primary key is the random OAuth `state` string,
 * not `userId` — so unlike the token tables (one row per user, PK =
 * userId) these are ordinary `DELETE ... WHERE user_id = $1` scans,
 * not single-row deletes. That's fine: the tables are TTL-bounded and
 * stay small in steady state (see each table's own module doc in
 * `schema/aforce.ts`).
 *
 * Unlike the per-provider token stores (which need application-level
 * encryption-key wiring — see `buildTokenStoresFor` in
 * `accountDeletion.ts`), these five statements are pure schema
 * operations with no such dependency, so — unlike the token stores —
 * this builder lives here rather than behind an api-server-side seam.
 * Both `accountDeletion.ts` call sites (plain `db` and `tx`) and the
 * integration test below use this same function.
 */
export function createAccountDeletionAuthStateDb(
  dbx: NodePgDatabase<Record<string, unknown>>,
): AccountDeletionCascadeAuthStateDb {
  return {
    async deleteWhoopAuthStates(userId) {
      await dbx
        .delete(aforceWhoopAuthStates)
        .where(eq(aforceWhoopAuthStates.userId, userId));
    },
    async deleteGarminAuthStates(userId) {
      await dbx
        .delete(aforceGarminAuthStates)
        .where(eq(aforceGarminAuthStates.userId, userId));
    },
    async deleteOuraAuthStates(userId) {
      await dbx
        .delete(aforceOuraAuthStates)
        .where(eq(aforceOuraAuthStates.userId, userId));
    },
    async deleteStravaAuthStates(userId) {
      await dbx
        .delete(aforceStravaAuthStates)
        .where(eq(aforceStravaAuthStates.userId, userId));
    },
    async clearBiometrics(userId) {
      await dbx
        .update(aforceUserState)
        .set({ biometrics: null })
        .where(eq(aforceUserState.userId, userId));
    },
  };
}

/**
 * Runs the four-step account-deletion health-data cascade, in order,
 * against whichever dependencies the caller supplies:
 *
 *   1. Provider token rows — WHOOP + Garmin + Oura + Strava, each via
 *      that provider's `TokenStore.clear()`, regardless of which are
 *      currently connected (clearing an empty store is a no-op).
 *   2. In-flight OAuth "auth-state" rows for all four providers
 *      (abandoned-flow cleanup).
 *   3. `aforce_user_state.biometrics` — set to NULL (every provider's
 *      snapshot at once).
 *   4. `HealthRecordsRepo.purgeUser` — HARD delete of every canonical
 *      health record.
 *
 * Idempotent: every step is a DELETE/no-op-safe operation, so calling
 * this twice in a row for the same user is a safe, indistinguishable
 * no-op the second time.
 *
 * Atomicity is the CALLER's responsibility: pass dependencies bound
 * to a transaction handle (`tx`) for all-or-nothing semantics, or
 * plain/fake dependencies (as the DB-free unit tests do) when no
 * transactional guarantee is being exercised. This function makes no
 * assumption either way — it just runs the four steps in order.
 */
export async function runAccountDeletionCascade(
  deps: AccountDeletionCascadeDeps,
  userId: string,
): Promise<PurgeUserResult> {
  // Step 1 — provider token rows, all four providers regardless of
  // which are actually connected (clearing an empty store is a
  // no-op).
  await deps.whoopTokenStoreFor(userId).clear();
  await deps.garminTokenStoreFor(userId).clear();
  await deps.ouraTokenStoreFor(userId).clear();
  await deps.stravaTokenStoreFor(userId).clear();

  // Step 2 — in-flight OAuth auth-state rows (abandoned-flow cleanup;
  // normally already consumed by the time a user reaches "delete my
  // data").
  await deps.authStateDb.deleteWhoopAuthStates(userId);
  await deps.authStateDb.deleteGarminAuthStates(userId);
  await deps.authStateDb.deleteOuraAuthStates(userId);
  await deps.authStateDb.deleteStravaAuthStates(userId);

  // Step 3 — biometrics snapshot column, every provider at once.
  await deps.authStateDb.clearBiometrics(userId);

  // Step 4 — canonical health-record plane, hard delete.
  return deps.healthRecordsRepo.purgeUser(userId);
}
