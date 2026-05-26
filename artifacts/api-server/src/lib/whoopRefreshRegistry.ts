/**
 * Process-level WHOOP refresh singleflight registry.
 *
 * Why: PR #17 added per-manager singleflight inside `createWhoopTokenManager`,
 * which is sufficient as long as the SAME manager instance handles every
 * concurrent refresh for a given user. The biometrics fetch worker breaks
 * that assumption — `buildDefaultWhoopFetchDeps` mints a fresh manager per
 * `runWhoopFetchOnce` invocation, so two concurrent runs for the same user
 * (cron sweep tick overlapping with an admin trigger, or two sweep workers
 * racing) would each hold their own `inflight` slot and fire two POSTs.
 * WHOOP rotates refresh tokens; the second POST wins and invalidates the
 * first's refresh_token, returning `invalid_grant` for the loser.
 *
 * This registry promotes the singleflight to the PROCESS level keyed by
 * userId. Any number of manager instances handed the same coordinator can
 * be active concurrently — only one network refresh runs per user at a
 * time, every caller awaits the same promise.
 *
 * Scope: a single Node process. Multiple API server replicas still race
 * across replicas. Cross-replica coordination would need a distributed
 * lock (e.g. Postgres advisory locks keyed on the userId hash) — out of
 * scope for this PR; documented as a follow-up. In single-replica
 * deployments (current Replit topology) the process registry is
 * sufficient.
 *
 * Architecture lock: hidden-infra. No HTTP route consumes the registry
 * yet — it is plumbed only into the fetch worker's default deps.
 */

import type { WhoopTokens } from "@workspace/db";

/**
 * A coordinator wraps a single-shot refresh function and decides whether
 * to invoke it or to attach to an in-flight call. The token manager
 * accepts any function with this shape — both the per-manager
 * singleflight and the process-level registry conform to it, which keeps
 * the manager oblivious to keying scope.
 */
export type WhoopRefreshCoordinator = (
  impl: () => Promise<WhoopTokens>,
) => Promise<WhoopTokens>;

export interface WhoopRefreshRegistry {
  /** Returns a coordinator bound to this userId. Multiple managers for
   *  the same user share an inflight slot when given coordinators from
   *  the same registry. */
  coordinatorFor(userId: string): WhoopRefreshCoordinator;
  /** Observability — number of in-flight refreshes right now. Never
   *  affects behavior; used by /admin/whoop/peek-style surfaces. */
  size(): number;
}

/**
 * Build a process-level singleflight registry. The internal Map is
 * keyed by userId; entries are cleared on settle (resolve OR reject)
 * so a failed refresh does not cache the failure for the next caller.
 */
export function createWhoopRefreshRegistry(): WhoopRefreshRegistry {
  const inflight = new Map<string, Promise<WhoopTokens>>();
  return {
    coordinatorFor(userId: string): WhoopRefreshCoordinator {
      if (!userId) {
        // Refuse to bind to an empty key — would otherwise let every
        // empty-userId call share one slot and cross-contaminate.
        throw new Error(
          "createWhoopRefreshRegistry.coordinatorFor: userId must be non-empty",
        );
      }
      return (impl) => {
        const existing = inflight.get(userId);
        if (existing) return existing;
        const p = impl().finally(() => {
          // Owner-check: only the original creator clears its slot.
          // Defensive against future code that might overwrite the
          // entry (e.g. an explicit "force evict" surface) while ours
          // is still pending.
          if (inflight.get(userId) === p) inflight.delete(userId);
        });
        inflight.set(userId, p);
        return p;
      };
    },
    size() {
      return inflight.size;
    },
  };
}
