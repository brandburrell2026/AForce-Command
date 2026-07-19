/**
 * Process-level Strava refresh singleflight registry.
 *
 * Faithful mirror of `ouraRefreshRegistry.ts` / `whoopRefreshRegistry.ts`
 * / `garminRefreshRegistry.ts`. The fetch worker mints a fresh manager
 * per run, so two concurrent runs for the same user would each hold
 * their own per-manager `inflight` slot and fire two POSTs. Strava's
 * refresh tokens rotate on every successful refresh; the second POST
 * wins and invalidates the first's refresh_token. This registry
 * promotes singleflight to the PROCESS level keyed by userId.
 *
 * Scope: a single Node process (current Replit topology). Cross-replica
 * coordination would need a distributed lock — out of scope.
 *
 * Architecture lock: hidden-infra. No HTTP route consumes the registry
 * directly; it is plumbed only into the fetch worker deps.
 */

import type { StravaTokens } from "@workspace/db";

export type StravaRefreshCoordinator = (
  impl: () => Promise<StravaTokens>,
) => Promise<StravaTokens>;

export interface StravaRefreshRegistry {
  /** Returns a coordinator bound to this userId. Multiple managers for
   *  the same user share an inflight slot when given coordinators from
   *  the same registry. */
  coordinatorFor(userId: string): StravaRefreshCoordinator;
  /** Observability — number of in-flight refreshes right now. */
  size(): number;
}

/**
 * Build a process-level singleflight registry. Internal Map keyed by
 * userId; entries cleared on settle (resolve OR reject) so a failed
 * refresh does not cache the failure for the next caller.
 */
export function createStravaRefreshRegistry(): StravaRefreshRegistry {
  const inflight = new Map<string, Promise<StravaTokens>>();
  return {
    coordinatorFor(userId: string): StravaRefreshCoordinator {
      if (!userId) {
        throw new Error(
          "createStravaRefreshRegistry.coordinatorFor: userId must be non-empty",
        );
      }
      return (impl) => {
        const existing = inflight.get(userId);
        if (existing) return existing;
        const p = impl().finally(() => {
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
