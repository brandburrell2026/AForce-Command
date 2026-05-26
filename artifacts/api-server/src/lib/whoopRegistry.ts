/**
 * Process-singleton WhoopRefreshRegistry.
 *
 * Why a singleton: `buildDefaultWhoopFetchDeps` mints a fresh
 * `WhoopTokenManager` per `runWhoopFetchOnce` invocation. Two
 * concurrent fetches for the same user — sweep tick overlapping with
 * admin trigger, or two sweep workers — would each hold their own
 * per-manager `inflight` slot and fire two POSTs to WHOOP's
 * /oauth/oauth2/token. WHOOP rotates refresh tokens; the second wins,
 * the first's refresh_token is invalidated. invalid_grant storm.
 *
 * Sharing ONE registry across all call sites (sweep loop, admin
 * trigger, future webhook handler) collapses concurrent refreshes for
 * the same userId into a single in-flight Promise at the process level.
 *
 * Multi-replica note: this is process-local. Horizontal scaling needs
 * a Postgres advisory lock keyed by `hashtext(user_id)` (or a
 * `whoop_sweep_claims` table with SKIP LOCKED) on top of this. The
 * registry remains useful even with the lock — it eliminates redundant
 * refreshes within a replica before they ever contend for the lock.
 *
 * Hidden-infra: this module exports a lazy getter so test files that
 * don't touch the WHOOP path never construct the registry.
 */

import {
  createWhoopRefreshRegistry,
  type WhoopRefreshRegistry,
} from "./whoopRefreshRegistry";

let instance: WhoopRefreshRegistry | null = null;

/** Return the process-wide singleton; constructs on first call. */
export function getWhoopRefreshRegistry(): WhoopRefreshRegistry {
  if (!instance) {
    instance = createWhoopRefreshRegistry();
  }
  return instance;
}

/** Test-only: reset the singleton between tests that need isolation. */
export function __resetWhoopRefreshRegistryForTests(): void {
  instance = null;
}
